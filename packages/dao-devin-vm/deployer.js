#!/usr/bin/env node
/**
 * deployer.js · 印 113 · 反者道之动 · Devin VM 反代部署器 (GH Actions 端)
 * 末改 · 印 118 (流式 gist + retry + 进度) · 印 121 (auth_chain 三口同源) · 印 128 (印号统一)
 *
 *   「上善若水 · 水善利万物而不争」(八)
 *   「弱之胜强 · 柔之胜刚 · 天下莫不知 · 莫能行也」(四十三)
 *   「邻邦相望 · 鸡狗之声相闻 · 民至老死不相往来」(八十)
 *
 * 角色:
 *   跑在 GitHub Actions runner (ubuntu-latest · Node 22)
 *   不是 LLM proxy daemon (那是 dao_proxy 之事 · 在 Devin VM 中)
 *   仅做 "接生婆": spawn Devin VM × N · deploy dao_proxy · 报 URL 至 Gist · 退
 *
 * 链路:
 *   GH Actions runner
 *     ↓ Devin token (从 Gist 池中拉)
 *   wss app.devin.ai/api/acp/live (复用 vm_omni.js)
 *     ↓ spawn Devin VM (omni router :8080)
 *   public URL: https://*.devinapps.com
 *     ↓ deploy dao_proxy v0.4.0 (复用 vm_proxy_deploy.js)
 *   /port/7780/v1/* 真活 (印 112 4 VM × 12 edge = 100% 真证)
 *     ↓ 报 URL · auth_token
 *   Gist dao-pool.json daemons[]
 *     ↓ 退 (不 keep daemon · 不 cf tunnel)
 *   用户面板读 Gist · 任选 alive URL 直调
 *
 * 用 (GH Actions runner):
 *   node deployer.js \
 *     --gist-id <GIST_ID> --pat <PAT> \
 *     --devin-token <TOKEN> \
 *     --n 4
 *
 * 用 (本地仿 · 真测):
 *   node deployer.js --n 2 --dry-gist  # 不真写 Gist · 仅本地起 VM + deploy
 */
"use strict";

const fs = require("fs");
const path = require("path");
const https = require("https");
const { spawn, spawnSync } = require("child_process");

const BASE = __dirname;
// 印 115 · 反者道之动 · 路径同包 fallback (env override · 不依本机外资)
//   GH Actions runner / 本机仿测 / docker 容器 三态一统
//   帛书·六十四「为之于其未有也」+ 二十五「道法自然」
const OMNI_JS = process.env.DAO_OMNI_JS || path.resolve(BASE, "./vm_omni.js");
const DEPLOY_JS =
  process.env.DAO_DEPLOY_JS || path.resolve(BASE, "./vm_proxy_deploy.js");
const POOL_JSON =
  process.env.DAO_POOL_JSON || path.resolve(BASE, "./_state/vm_pool.json");
const AUTH_FILE =
  process.env.DAO_AUTH_FILE || path.resolve(BASE, "./.dao_auth_token");
const PROXY_FILE =
  process.env.DAO_PROXY_FILE || path.resolve(BASE, "./dao_proxy.js");
// 同包 _state/ 自动 mkdir · vm_pool.json 自动空 []
try {
  const stateDir = path.dirname(POOL_JSON);
  if (!fs.existsSync(stateDir)) fs.mkdirSync(stateDir, { recursive: true });
  if (!fs.existsSync(POOL_JSON)) fs.writeFileSync(POOL_JSON, "[]\n");
} catch {}

const args = process.argv.slice(2);
function getArg(name, def) {
  const i = args.indexOf(`--${name}`);
  if (i >= 0 && args[i + 1]) return args[i + 1];
  const eq = args.find((a) => a.startsWith(`--${name}=`));
  return eq ? eq.split("=")[1] : def;
}
const N = parseInt(getArg("n", "4"), 10);
const GIST_ID = getArg("gist-id", process.env.DAO_POOL_GIST_ID || "");
const PAT = getArg("pat", process.env.DAO_POOL_PAT || "");
const DEVIN_TOKEN_OVERRIDE = getArg(
  "devin-token",
  process.env.DEVIN_TOKEN || "",
);
const DRY_GIST = args.includes("--dry-gist");
// 印 113 道义: --reuse-pool · 不耗 ACU spawn 新 VM
// 用现池 alive (主公 keeper 已维) · 仅 deploy dao_proxy (帛书 八 上善若水 · 用其所有)
const REUSE_POOL = args.includes("--reuse-pool");

const C = {
  G: (s) => `\x1b[32m${s}\x1b[0m`,
  Y: (s) => `\x1b[33m${s}\x1b[0m`,
  R: (s) => `\x1b[31m${s}\x1b[0m`,
  B: (s) => `\x1b[36m${s}\x1b[0m`,
  GR: (s) => `\x1b[90m${s}\x1b[0m`,
  BO: (s) => `\x1b[1m${s}\x1b[0m`,
};
const ts = () => new Date().toISOString().slice(11, 23);
const log = (msg) => console.log(`${C.GR(ts())} ${msg}`);

// ─── Gist API (轻量 · 印 95 dao-pool/gist-pool.js 之精) ───
function gistApi(method, urlPath, body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request(
      {
        hostname: "api.github.com",
        port: 443,
        path: urlPath,
        method,
        headers: {
          Authorization: `token ${PAT}`,
          "User-Agent": "dao-devin-deployer/113",
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
        },
        timeout: 30000,
      },
      (res) => {
        let bd = "";
        res.on("data", (c) => (bd += c));
        res.on("end", () => {
          try {
            const j = JSON.parse(bd);
            if (res.statusCode >= 400)
              return reject(
                new Error(
                  `gist ${res.statusCode}: ${j.message || bd.slice(0, 200)}`,
                ),
              );
            resolve(j);
          } catch (e) {
            if (res.statusCode >= 400)
              reject(new Error(`gist ${res.statusCode}: ${bd.slice(0, 200)}`));
            else resolve(bd);
          }
        });
      },
    );
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("gist timeout")));
    if (data) req.write(data);
    req.end();
  });
}

async function pullGistPool() {
  if (!GIST_ID || !PAT) throw new Error("无 gist-id / pat (印 95)");
  const g = await gistApi("GET", `/gists/${GIST_ID}`);
  const file = g.files["dao-pool.json"];
  if (!file) throw new Error("gist 无 dao-pool.json");
  return JSON.parse(file.content);
}

async function pushGistPool(pool) {
  if (DRY_GIST) {
    log(C.Y(`  ⚠ --dry-gist · 不真写 · pool.daemons=${pool.daemons.length}`));
    return;
  }
  await gistApi("PATCH", `/gists/${GIST_ID}`, {
    files: {
      "dao-pool.json": { content: JSON.stringify(pool, null, 2) },
    },
  });
  log(C.G(`  ✓ Gist 写 · daemons=${pool.daemons.length}`));
}

// ─── spawn 1 Devin VM 通过 vm_omni.js (印 104) ───
// 印 118 · 反者道之动 · spawn (非 spawnSync) · 真并发
//   帛书·七十六「兵强则不胜 · 木强则恒 · 强大居下 · 柔弱微细居上」
//   spawnSync 同步阻 promise body · N 件 Promise.all 实顺序 · 改 spawn 真并发
//   timeout 与 vm_omni 之 TIMEOUT_MS=900s 一致 · 兜底 15min 30s · 防 child hang
function spawnDevinVM(devinToken) {
  return new Promise((resolve) => {
    log(`  ▶ vm_omni.js spawn (token=${devinToken.slice(0, 12)}...)`);
    const env = { ...process.env };
    const child = spawn(
      "node",
      [OMNI_JS, "--token", devinToken, "--no-keepalive"],
      { env, stdio: ["ignore", "pipe", "pipe"] },
    );
    let stdout = "";
    let stderr = "";
    let done = false;
    let urlEmitted = null; // 早识 URL · 立 resolve 不等子全闭 (省时)
    const finish = (urlOrNull) => {
      if (done) return;
      done = true;
      clearTimeout(killTimer);
      try {
        child.kill("SIGKILL");
      } catch {}
      if (urlOrNull) {
        log(C.G(`  ✓ VM 起 · ${urlOrNull.split("@")[1].slice(0, 40)}`));
        resolve("https://" + urlOrNull);
      } else {
        const tail = (stdout + stderr).slice(-200);
        log(C.R(`  ✗ spawn 失 · 无 URL · tail: ${tail}`));
        resolve(null);
      }
    };
    child.stdout.on("data", (d) => {
      const s = d.toString();
      stdout += s;
      if (!urlEmitted) {
        const m = (stdout + stderr).match(
          /https:\/\/(user:[a-f0-9]+@[a-z0-9-]+\.devinapps\.com)/,
        );
        if (m) {
          urlEmitted = m[1];
          finish(urlEmitted);
        }
      }
    });
    child.stderr.on("data", (d) => {
      const s = d.toString();
      stderr += s;
      if (!urlEmitted) {
        const m = (stdout + stderr).match(
          /https:\/\/(user:[a-f0-9]+@[a-z0-9-]+\.devinapps\.com)/,
        );
        if (m) {
          urlEmitted = m[1];
          finish(urlEmitted);
        }
      }
    });
    child.on("close", () => finish(urlEmitted));
    child.on("error", (e) => {
      log(C.R(`  ✗ spawn err: ${e.message}`));
      finish(null);
    });
    const killTimer = setTimeout(() => {
      if (!done) {
        log(C.Y(`  ⚠ spawn timeout 930s · 杀子`));
        finish(urlEmitted);
      }
    }, 930000); // 15.5 min · 略 > vm_omni TIMEOUT_MS 900s
  });
}

// ─── deploy dao_proxy 通过 vm_proxy_deploy.js (印 106) ───
// 印 118 · 同 spawnDevinVM · spawn 真并发
function deployDaoProxy(idx) {
  return new Promise((resolve) => {
    log(`  ▶ vm_proxy_deploy.js --idx ${idx}`);
    const child = spawn("node", [DEPLOY_JS, "--idx", String(idx)], {
      cwd: path.dirname(DEPLOY_JS),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let done = false;
    const finish = (result) => {
      if (done) return;
      done = true;
      clearTimeout(killTimer);
      try {
        child.kill("SIGKILL");
      } catch {}
      if (result && result.alive) {
        log(C.G(`  ✓ dao_proxy 起`));
        resolve(result);
      } else {
        const tail = (stdout + stderr).slice(-200);
        log(C.R(`  ✗ deploy 失 · tail: ${tail}`));
        resolve(null);
      }
    };
    child.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    child.on("close", () => {
      const out = stdout + stderr;
      const alive = /proxy alive/.test(out);
      const tok = out.match(/\b([a-f0-9]{64})\b/);
      finish(alive ? { alive: true, auth: (tok && tok[1]) || null } : null);
    });
    child.on("error", (e) => {
      log(C.R(`  ✗ deploy err: ${e.message}`));
      finish(null);
    });
    const killTimer = setTimeout(() => {
      if (!done) {
        log(C.Y(`  ⚠ deploy timeout 360s · 杀子`));
        finish(null);
      }
    }, 360000); // 6 min · vm_proxy_deploy 通常 2-3 min
  });
}

// ─── 验 /health · /v1/models ───
function httpGet(url, headers = {}, timeoutMs = 10000) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const req = https.request(
      {
        hostname: u.hostname,
        port: 443,
        path: u.pathname + u.search,
        method: "GET",
        auth: u.username
          ? `${decodeURIComponent(u.username)}:${decodeURIComponent(u.password)}`
          : undefined,
        headers,
        timeout: timeoutMs,
      },
      (res) => {
        let bd = "";
        res.on("data", (c) => (bd += c));
        res.on("end", () => {
          let j = null;
          try {
            j = JSON.parse(bd);
          } catch {}
          resolve({ status: res.statusCode, body: bd, json: j });
        });
      },
    );
    req.on("error", (e) => resolve({ err: e.message }));
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.end();
  });
}

async function verifyDeployed(base, auth) {
  const h = await httpGet(`${base}/port/7780/health`);
  const m = await httpGet(`${base}/port/7780/v1/models`, {
    "X-Dao-Auth": auth,
  });
  return {
    ok: !!(h.json && h.json.ok) && !!(m.json && Array.isArray(m.json.data)),
    seal: h.json && h.json.seal,
    models_count: m.json && m.json.data ? m.json.data.length : 0,
    pool_total: h.json && h.json.pool && h.json.pool.total,
  };
}

// ─── 主 ───
async function main() {
  const T0 = Date.now();
  console.log(
    C.BO(
      `═══ 印 113 · deployer · 反者道之动 · ${new Date().toISOString()} ═══`,
    ),
  );
  console.log("");

  // 1. 拉 Devin token (REUSE_POOL 时不需要 token)
  let tokens = [];
  if (REUSE_POOL) {
    log(C.Y(`▶ REUSE_POOL · 不需 token (用现池 alive · 帛书 八 上善若水)`));
  } else if (DEVIN_TOKEN_OVERRIDE) {
    tokens = [DEVIN_TOKEN_OVERRIDE];
    log(`▶ 用 --devin-token (1 件)`);
  } else if (DRY_GIST) {
    // 本地仿: 用 WAM
    const wamFile = path.join(
      require("os").homedir(),
      ".wam",
      "wam-state.json",
    );
    if (fs.existsSync(wamFile)) {
      const w = JSON.parse(fs.readFileSync(wamFile, "utf8"));
      tokens = [w.activeApiKey];
      log(C.Y(`▶ DRY-GIST · 用 WAM activeApiKey (1 件 · 不轮)`));
    } else {
      throw new Error("无 token (无 WAM 无 --devin-token)");
    }
  } else {
    log(`▶ Gist 拉 token 池 · ${GIST_ID.slice(0, 8)}...`);
    const pool = await pullGistPool();
    tokens = (pool.accounts || []).map((a) => a.devin_token).filter(Boolean);
    log(`  ✓ 拉 ${tokens.length} 件 token`);
  }

  // 2. 起 N 件 VM · 并发 (或 reuse 池中 alive)
  let spawned = [];
  if (REUSE_POOL) {
    log(`▶ Step 1: ★ reuse-pool · 用现池 alive VM (不 spawn 新 · 不耗 ACU)`);
    const pool = JSON.parse(fs.readFileSync(POOL_JSON, "utf8"));
    const alive = [];
    pool.forEach((p, i) => {
      if (p.status === "alive") {
        const url =
          (p.omni && p.omni.base_url) ||
          (Array.isArray(p.urls) && p.urls[0]) ||
          p.url;
        if (url && url.includes("@")) alive.push({ idx: i, url });
      }
    });
    spawned = alive
      .slice(0, N)
      .map((a) => ({ idx: a.idx, url: a.url, token: null }));
    log(C.G(`  ─ ${spawned.length} / ${N} 件 (池 alive=${alive.length})`));
  } else {
    log(`▶ Step 1: spawn ${N} 件 Devin VM (并发)`);
    const spawnTasks = [];
    for (let i = 0; i < N; i++) {
      const tk = tokens[i % tokens.length];
      spawnTasks.push(
        spawnDevinVM(tk).then((url) => ({ idx: i, url, token: tk })),
      );
    }
    spawned = (await Promise.all(spawnTasks)).filter((s) => s.url);
    log(C.G(`  ─ ${spawned.length} / ${N} 件 spawn 成`));
  }
  console.log("");

  if (spawned.length === 0) {
    log(C.R("✗ 0 件 VM · 退"));
    process.exit(1);
  }

  // 3. 找新 idx (vm_omni 已写 vm_pool.json · 或 reuse 已知 idx)
  const pool = JSON.parse(fs.readFileSync(POOL_JSON, "utf8"));
  const newIndices = [];
  spawned.forEach((s) => {
    if (s.idx !== undefined && pool[s.idx] && pool[s.idx].status === "alive") {
      newIndices.push({ ...s, poolIdx: s.idx });
    } else {
      // 用 host 匹配找池中的 idx
      const host = s.url.split("@")[1];
      const idx = pool.findIndex(
        (p) => p && p.omni && p.omni.base_url && p.omni.base_url.includes(host),
      );
      if (idx >= 0) newIndices.push({ ...s, poolIdx: idx });
    }
  });
  log(`▶ Step 2: 找池 idx · ${newIndices.length} 件 (并发 deploy)`);

  // 4. deploy dao_proxy · 并发
  const deployTasks = newIndices.map((n) =>
    deployDaoProxy(n.poolIdx).then((r) => ({ ...n, deploy: r })),
  );
  const deployed = (await Promise.all(deployTasks)).filter(
    (d) => d.deploy && d.deploy.alive,
  );
  log(C.G(`  ─ ${deployed.length} / ${newIndices.length} 件 deploy 成`));
  console.log("");

  // 5. 验 /health · /v1/models · 并发
  log(`▶ Step 3: 验 /health · /v1/models · 并发`);
  // 印 121 · 反者道之动 · auth token 三泉先后:
  //   ① process.env.DAO_AUTH_TOKEN  (workflow inputs.auth_key 同源 · web oneShot 直传)
  //   ② AUTH_FILE (.dao_auth_token) (workflow step 三 已写 · 或本地仿测自生)
  //   ③ null                        (无守门 · 仅日志警示)
  // 帛书·廿二「圣人执一·以为天下牧」· 三泉同源 · auth-key 不漂不分
  const authToken =
    (process.env.DAO_AUTH_TOKEN || "").trim() ||
    (fs.existsSync(AUTH_FILE)
      ? fs.readFileSync(AUTH_FILE, "utf8").trim()
      : null);
  if (process.env.DAO_AUTH_TOKEN) {
    log(C.GR(`  ◦ auth token 源: env DAO_AUTH_TOKEN (印 121 oneShot 直传)`));
  } else if (authToken) {
    log(C.GR(`  ◦ auth token 源: ${AUTH_FILE} (印 121 workflow 写盘 / 本仿)`));
  } else {
    log(C.Y(`  ⚠ 无 auth token · daemon 未守门 · 公网调可任 (印 121 警)`));
  }
  const verifyTasks = deployed.map((d) =>
    verifyDeployed(d.url, authToken).then((v) => ({ ...d, verify: v })),
  );
  const verified = await Promise.all(verifyTasks);
  verified.forEach((v) => {
    const tag = v.verify.ok ? C.G("✓") : C.R("✗");
    log(
      `  ${tag} VM[${v.poolIdx}] ${v.url.split("@")[1].slice(0, 40)} · seal=${(v.verify.seal || "?").slice(0, 8)} · models=${v.verify.models_count}`,
    );
  });
  const okCount = verified.filter((v) => v.verify.ok).length;
  log(C.G(`  ─ ${okCount} / ${verified.length} 件 真活`));
  console.log("");

  // 6. 报至 Gist (或 DRY_GIST 仅日志)
  log(`▶ Step 4: 报 ${okCount} 件 daemon URL 至 Gist`);
  const daemons = verified
    .filter((v) => v.verify.ok)
    .map((v) => ({
      type: "devin-vm-dao-proxy",
      host: v.url.split("@")[1].slice(0, 50),
      url: v.url + "/port/7780",
      // 印 121 · 反者道之动 · 完整 auth_token 入私有 Gist (用户自有 · 不外漏)
      // 帛书·七十「知我者希·则我贵矣·圣人被褐而怀玉」· 完整 token 玉 · 私 Gist 褐
      // 旧 hint (prefix + ...) 保兼老 web UI · 新 web 用 auth_token 直 X-Dao-Auth
      auth_token: authToken || null,
      auth_token_hint: authToken ? authToken.slice(0, 12) + "..." : null,
      seal: v.verify.seal,
      yin: 121, // 印 121 · 协议标识 · 与 source 互证
      models_count: v.verify.models_count,
      pool_total: v.verify.pool_total,
      reported_at: new Date().toISOString(),
      source: "印 113 · deployer · GH Actions", // ★ 协议向后兼 · workflow 末段 filter 同此串
    }));

  if (DRY_GIST) {
    log(C.Y(`  ⚠ --dry-gist · daemons 至:`));
    daemons.forEach((d, i) =>
      log(
        C.Y(
          `     [${i}] ${d.host} · seal=${d.seal} · models=${d.models_count}`,
        ),
      ),
    );
  } else {
    const pool = await pullGistPool();
    if (!pool.daemons) pool.daemons = [];
    // 清旧 印 113 daemon
    pool.daemons = pool.daemons.filter(
      (d) => d.source !== "印 113 · deployer · GH Actions",
    );
    pool.daemons.push(...daemons);
    pool.last_updated_113 = new Date().toISOString();
    await pushGistPool(pool);
  }
  console.log("");

  // 7. evidence
  const sealOut = {
    印: 113,
    title: "反者道之动 · GH 面板综合管 · Devin VM 反代核心",
    ts: new Date().toISOString(),
    n_requested: N,
    n_spawned: spawned.length,
    n_deployed: deployed.length,
    n_verified: okCount,
    daemons,
    total_ms: Date.now() - T0,
  };
  const evF = path.join(BASE, `seal113_deployer_${Date.now()}.json`);
  fs.writeFileSync(evF, JSON.stringify(sealOut, null, 2));
  log(C.G(`✓ evidence: ${evF}`));
  log(C.BO(`✓ 总耗时: ${((Date.now() - T0) / 1000).toFixed(1)}s`));
  console.log("");
  console.log(C.BO(`═══ 汇总 ═══`));
  console.log(`  spawn   : ${spawned.length} / ${N}`);
  console.log(`  deploy  : ${deployed.length} / ${spawned.length}`);
  console.log(`  verified: ${okCount} / ${deployed.length}`);
  console.log(`  Gist    : ${DRY_GIST ? "(dry)" : "已报"}`);
}

main().catch((e) => {
  console.error(C.R("✗"), e.stack);
  process.exit(1);
});
