#!/usr/bin/env node
/**
 * vm_meta_deploy.js · 印 122 · 装 meta_router 至 Devin VM (yin122 全审纳入)
 * ════════════════════════════════════════════════════════════════════════
 * 「**水善 · 利万物而有静 · 居众之所恶 · 故几于道矣**」 ──《老子》八
 *
 *  装 meta_router.cjs (port 8081) 至现 VM (auto idx 0)
 *  · 不 touch dao_proxy (7780 仍然) · 仅加层 (8081)
 *  · 自动取 GitHub PAT 从:
 *      1. CLI flag --github-token <pat>
 *      2. ENV GITHUB_TOKEN
 *      3. ENV GITHUB_PAT
 *      4. 留空 (主公 ssh 入 VM 后一字 export 即活)
 *  · 立 keeper.sh (auto-restart watchdog · 同 dao_proxy 之 keeper)
 *
 *  用:
 *    node vm_meta_deploy.js                          # 装至 idx 0
 *    node vm_meta_deploy.js --idx 1                  # 装至池 idx 1
 *    node vm_meta_deploy.js --github-token <pat>     # 注 PAT
 *    GITHUB_TOKEN=ghp_xxx node vm_meta_deploy.js     # 同 (env)
 *    node vm_meta_deploy.js --check                  # 仅探活 不 redeploy
 *    node vm_meta_deploy.js --logs                   # 看 meta.log
 *    node vm_meta_deploy.js --restart                # 杀 redeploy
 * ════════════════════════════════════════════════════════════════════════
 */
"use strict";

const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
const { URL } = require("url");
const crypto = require("crypto");

// ─── 配 ───
const BASE_DIR = __dirname;
const REMOTE_DIR = "/home/ubuntu/dao_proxy_meta";
const META_PORT = 8081;
const META_FILE = path.join(BASE_DIR, "meta_router.cjs");

// 池 file (与 vm_proxy_deploy 同源)
const POOL_FILE_LOCAL = path.join(BASE_DIR, "_state", "vm_pool.json");
const POOL_FILE_LEGACY = path.resolve(
  BASE_DIR,
  "..",
  "..",
  "印95_反者道之动",
  "_state",
  "vm_pool.json",
);
const POOL_FILE =
  process.env.DAO_POOL_JSON ||
  (fs.existsSync(POOL_FILE_LOCAL) ? POOL_FILE_LOCAL : POOL_FILE_LEGACY);

// auth file (本地存 meta auth token)
const META_AUTH_FILE =
  process.env.DAO_META_AUTH_FILE ||
  path.join(BASE_DIR, "..", "01_GH编排", ".dao_meta_auth_token");

// 颜
const C = {
  B: (s) => `\x1b[34m${s}\x1b[0m`,
  G: (s) => `\x1b[32m${s}\x1b[0m`,
  R: (s) => `\x1b[31m${s}\x1b[0m`,
  Y: (s) => `\x1b[33m${s}\x1b[0m`,
};

// ─── CLI ───
const args = process.argv.slice(2);
function cliVal(flag) {
  const i = args.indexOf(flag);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : null;
}
function cliFlag(flag) {
  return args.includes(flag);
}
const IDX = parseInt(cliVal("--idx") || "0", 10);
const GITHUB_TOKEN =
  cliVal("--github-token") ||
  process.env.GITHUB_TOKEN ||
  process.env.GITHUB_PAT ||
  "";
const MODE = cliFlag("--check")
  ? "check"
  : cliFlag("--logs")
    ? "logs"
    : cliFlag("--restart")
      ? "restart"
      : "deploy";

// ─── HTTP 助 ───
function req(urlStr, opts = {}, body = null) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const isHttps = u.protocol === "https:";
    const reqOpts = {
      hostname: u.hostname,
      port: u.port || (isHttps ? 443 : 80),
      path: u.pathname + u.search,
      method: opts.method || "GET",
      headers: opts.headers || {},
      auth:
        u.username && u.password
          ? `${u.username}:${decodeURIComponent(u.password)}`
          : undefined,
      timeout: opts.timeout || 30000,
    };
    const r = (isHttps ? https : http).request(reqOpts, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () =>
        resolve({
          statusCode: res.statusCode,
          text: Buffer.concat(chunks).toString("utf-8"),
          headers: res.headers,
        }),
      );
    });
    r.on("error", reject);
    r.on("timeout", () => {
      r.destroy(new Error("timeout"));
    });
    if (body) r.write(body);
    r.end();
  });
}

// ─── omni helpers ───
async function omniHealth(omniUrl) {
  // 印 117 揭 /_/health 受限 (400/401) · 改用 /_/run echo 探活 (印 119 实证可)
  const body = JSON.stringify({
    cmd: "echo dao_meta_alive",
    timeout: 5000,
    cwd: "/home/ubuntu",
    shell: "/bin/bash",
  });
  const r = await req(
    `${omniUrl}/_/run`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
      timeout: 10000,
    },
    body,
  );
  if (r.statusCode !== 200)
    throw new Error(`health(_/run) ${r.statusCode}: ${r.text.slice(0, 200)}`);
  const j = JSON.parse(r.text);
  if (!(j.stdout || j.text || "").includes("dao_meta_alive"))
    throw new Error(`health echo 失: ${JSON.stringify(j).slice(0, 200)}`);
  return "alive";
}

async function omniRun(omniUrl, cmd, opts = {}) {
  const body = JSON.stringify({
    cmd,
    timeout: opts.timeout || 30000,
    cwd: opts.cwd || "/home/ubuntu",
    shell: opts.shell || "/bin/bash",
  });
  const r = await req(
    `${omniUrl}/_/run`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
      timeout: (opts.timeout || 30000) + 5000,
    },
    body,
  );
  if (r.statusCode !== 200)
    throw new Error(`run ${r.statusCode}: ${r.text.slice(0, 300)}`);
  return JSON.parse(r.text);
}

async function omniPutFile(omniUrl, remotePath, data) {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data, "utf-8");
  const r = await req(
    `${omniUrl}/_/file${remotePath.startsWith("/") ? remotePath : "/" + remotePath}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": buf.length,
      },
      timeout: 30000,
    },
    buf,
  );
  if (r.statusCode !== 200)
    throw new Error(`putFile ${r.statusCode}: ${r.text.slice(0, 200)}`);
  return JSON.parse(r.text);
}

async function omniProxyHttp(omniUrl, port, pathSuffix, opts = {}) {
  const u = `${omniUrl}/port/${port}${pathSuffix.startsWith("/") ? pathSuffix : "/" + pathSuffix}`;
  return await req(u, opts);
}

// ─── 找池 idx ───
function loadPool() {
  if (!fs.existsSync(POOL_FILE)) {
    throw new Error(`池 file 缺: ${POOL_FILE}`);
  }
  return JSON.parse(fs.readFileSync(POOL_FILE, "utf-8"));
}

function getOmniUrl(pool, idx) {
  if (idx >= pool.length)
    throw new Error(`idx ${idx} 越界 (池 size=${pool.length})`);
  const vm = pool[idx];
  const omniUrl = vm.omni?.base_url || vm.urls?.[0];
  if (!omniUrl) throw new Error(`vm idx ${idx} 无 omni URL`);
  return { vm, omniUrl };
}

// ─── 主流 ───
async function deploy() {
  console.log(C.B(`\n═══ 印 120 · meta_router · 装至 VM idx ${IDX} ═══\n`));

  const pool = loadPool();
  const { vm, omniUrl } = getOmniUrl(pool, IDX);
  const omniHost = new URL(omniUrl).hostname;
  console.log(`VM:    ${vm.sessionId}`);
  console.log(`omni:  ${omniHost}`);
  console.log(`mode:  ${MODE}`);
  console.log(
    `PAT:   ${GITHUB_TOKEN ? "✓ 已注 (" + GITHUB_TOKEN.length + " chars)" : C.Y("✗ 缺 · 主公一字便活")}`,
  );
  console.log("");

  // [1/7] VM 健康检
  console.log("[1/7] " + C.B("VM 健康检"));
  await omniHealth(omniUrl);
  console.log("  ✓ VM alive");

  if (MODE === "check") {
    // 仅探活 meta_router
    const r = await omniProxyHttp(omniUrl, META_PORT, "/health", {
      timeout: 10000,
    });
    console.log(`  meta-router:7780 health = ${r.statusCode}`);
    if (r.statusCode === 200) {
      const j = JSON.parse(r.text);
      console.log(
        `  ✓ meta v${j.version} · uptime=${Math.round((j.uptimeMs || 0) / 1000)}s · backends=${JSON.stringify(j.backends)}`,
      );
    }
    return { alive: r.statusCode === 200 };
  }

  if (MODE === "logs") {
    const r = await omniRun(
      omniUrl,
      `tail -n 80 ${REMOTE_DIR}/meta.log 2>&1 || echo '(no log)'`,
    );
    console.log(r.stdout || r.text || "(empty)");
    return;
  }

  if (MODE === "restart") {
    console.log("[2/7] " + C.Y("--restart: 杀旧 meta + keeper"));
    await omniRun(
      omniUrl,
      "pkill -f meta_router.cjs || true; pkill -f meta_keeper.sh || true; sleep 1",
    );
    console.log("  ✓ 旧件已杀");
  }

  // [3/7] 备目录
  console.log("[3/7] " + C.B(`备目录 ${REMOTE_DIR}`));
  await omniRun(omniUrl, `mkdir -p ${REMOTE_DIR} && chmod 755 ${REMOTE_DIR}`);
  console.log("  ✓");

  // [4/7] 上传 meta_router.cjs
  console.log("[4/7] " + C.B("上传 meta_router.cjs"));
  if (!fs.existsSync(META_FILE))
    throw new Error(`meta_router.cjs 缺: ${META_FILE}`);
  const metaContent = fs.readFileSync(META_FILE, "utf-8");
  await omniPutFile(omniUrl, `${REMOTE_DIR}/meta_router.cjs`, metaContent);
  console.log(`  ✓ meta_router.cjs ${metaContent.length}B`);

  // [5a/7] auth token
  let authToken;
  if (fs.existsSync(META_AUTH_FILE)) {
    authToken = fs.readFileSync(META_AUTH_FILE, "utf-8").trim();
  } else {
    authToken = crypto.randomBytes(32).toString("hex");
    fs.writeFileSync(META_AUTH_FILE, authToken, { mode: 0o600 });
  }
  console.log(
    `[5a/7] meta auth token: ${authToken.slice(0, 8)}...${authToken.slice(-4)}`,
  );
  await omniPutFile(omniUrl, `${REMOTE_DIR}/.auth`, authToken);
  await omniRun(omniUrl, `chmod 600 ${REMOTE_DIR}/.auth`);

  // [5b/7] 写 start.sh + keeper.sh
  console.log("[5b/7] " + C.B("写 start.sh + keeper.sh"));
  // 印 120 · 自动读 dao_proxy 之 auth (本地 .dao_auth_token) · 注入 meta_router 之 ENV
  // 优先 00_本源 (vm_proxy_deploy.js 写之最新) > 01_GH编排 (历史)
  const DAO_AUTH_PRIMARY = path.join(BASE_DIR, ".dao_auth_token");
  const DAO_AUTH_FALLBACK = path.join(
    BASE_DIR,
    "..",
    "01_GH编排",
    ".dao_auth_token",
  );
  let daoProxyAuth = "";
  let daoAuthSrc = "";
  if (fs.existsSync(DAO_AUTH_PRIMARY)) {
    daoProxyAuth = fs.readFileSync(DAO_AUTH_PRIMARY, "utf-8").trim();
    daoAuthSrc = "00_本源\\.dao_auth_token (vm_proxy_deploy 之最新)";
  } else if (fs.existsSync(DAO_AUTH_FALLBACK)) {
    daoProxyAuth = fs.readFileSync(DAO_AUTH_FALLBACK, "utf-8").trim();
    daoAuthSrc = "01_GH编排\\.dao_auth_token (历史)";
  }
  console.log(
    `  · DAO_PROXY_AUTH ${daoProxyAuth ? "✓ 已读 (" + daoProxyAuth.slice(0, 8) + "... · 源:" + daoAuthSrc + ")" : C.Y("✗ 缺 (查 00_本源\\.dao_auth_token)")}`,
  );

  const envExports = [
    `export META_PORT=${META_PORT}`,
    `export META_DIR=${REMOTE_DIR}`,
    `export META_AUTH_TOKEN='${authToken}'`,
    `export DAO_PROXY_URL=http://127.0.0.1:7780`,
    daoProxyAuth
      ? `export DAO_PROXY_AUTH='${daoProxyAuth}'`
      : `# DAO_PROXY_AUTH 未读 · meta_router 转 dao_proxy 之 chat 将 401`,
    GITHUB_TOKEN
      ? `export GITHUB_TOKEN='${GITHUB_TOKEN}'`
      : `# GITHUB_TOKEN 未注 · 主公一字便活: export GITHUB_TOKEN=ghp_xxx 然后重起 keeper.sh`,
  ].join("\n");

  const startScript = `#!/bin/bash
# 印 120 · meta_router 之起 · keeper 调用此件
set -e
cd ${REMOTE_DIR}
${envExports}
# nohup 后台 · stdout/stderr 同 log (滚动)
exec nohup node ${REMOTE_DIR}/meta_router.cjs >> ${REMOTE_DIR}/meta.log 2>&1 &
echo "started PID=$!"
sleep 0.6
ss -tnlp | grep ":${META_PORT}" | head -3
`;
  await omniPutFile(omniUrl, `${REMOTE_DIR}/start.sh`, startScript);
  await omniRun(omniUrl, `chmod +x ${REMOTE_DIR}/start.sh`);

  const keeperScript = `#!/bin/bash
# 印 120 · meta_router keeper · 见死即起
# 用: nohup bash keeper.sh > keeper.log 2>&1 &
while true; do
  if ! pgrep -f meta_router.cjs > /dev/null; then
    echo "[$(date -Iseconds)] meta died · 重起" >> ${REMOTE_DIR}/keeper.log
    bash ${REMOTE_DIR}/start.sh >> ${REMOTE_DIR}/keeper.log 2>&1
  fi
  sleep 5
done
`;
  await omniPutFile(omniUrl, `${REMOTE_DIR}/keeper.sh`, keeperScript);
  await omniRun(omniUrl, `chmod +x ${REMOTE_DIR}/keeper.sh`);
  console.log("  ✓");

  // [6a/8] 起 meta-router
  console.log("[6a/8] " + C.B("起 meta-router (bash start.sh)"));
  const startR = await omniRun(
    omniUrl,
    `bash ${REMOTE_DIR}/start.sh 2>&1 | head -10`,
  );
  console.log(
    "  stdout: " + (startR.stdout || startR.text || "").slice(0, 500),
  );

  // [6b/8] 起 keeper daemon
  console.log("[6b/8] " + C.B("起 keeper daemon (auto-restart)"));
  await omniRun(
    omniUrl,
    `pkill -f meta_keeper.sh 2>/dev/null || true; cd ${REMOTE_DIR} && nohup bash ${REMOTE_DIR}/keeper.sh > ${REMOTE_DIR}/keeper.log 2>&1 &`,
  );
  await new Promise((r) => setTimeout(r, 700));
  const ki = await omniRun(omniUrl, `pgrep -af keeper.sh | head -3`);
  console.log("  ✓ keeper: " + (ki.stdout || ki.text || "").slice(0, 200));

  // [7/8] 验 /port/8081/health
  console.log("[7/8] " + C.B(`验 /port/${META_PORT}/health`));
  await new Promise((r) => setTimeout(r, 1500));
  const health = await omniProxyHttp(omniUrl, META_PORT, "/health");
  if (health.statusCode === 200) {
    const j = JSON.parse(health.text);
    console.log(`  ✓ meta v${j.version} alive`);
    console.log(`    seal=${j.seal}`);
    console.log(`    backends.dao.hasAuth=${j.backends.dao.hasAuth}`);
    console.log(`    backends.github.hasKey=${j.backends.github.hasKey}`);
    console.log(`    fallback_chain=[${j.fallback_chain.join(", ")}]`);
    console.log(`    auth.preview=${j.auth.tokenPreview}`);
  } else {
    console.log(
      C.R(`  ✗ health ${health.statusCode}: ${health.text.slice(0, 300)}`),
    );
  }

  // [8/8] 验 keeper alive
  console.log("[8/8] " + C.B("验 keeper alive"));
  const ki2 = await omniRun(omniUrl, `pgrep -af keeper.sh | head -3`);
  console.log("  " + (ki2.stdout || ki2.text || "").slice(0, 300));

  // ─── 报 公网 URL ───
  console.log("\n" + "═".repeat(55));
  console.log(`  ★ 印 120 · meta_router · 三池打通 · 装毕`);
  console.log("═".repeat(55) + "\n");

  // 转 omniUrl 之 user:pass@host 至 https URL
  const u = new URL(omniUrl);
  const publicUrl = `https://${u.username}:${u.password}@${u.hostname}/port/${META_PORT}`;
  const cleanUrl = `https://${u.hostname}/port/${META_PORT}`;

  console.log("  ─ 公网 meta-router URL ─");
  console.log(`    ${publicUrl}/`);
  console.log("");
  console.log("  ─ 双 auth (Basic + X-Dao-Auth) ─");
  console.log(`    Basic ${u.username}:${u.password}`);
  console.log(`    X-Dao-Auth: ${authToken}`);
  console.log(`    存: ${META_AUTH_FILE}`);
  console.log("");
  console.log("  ─ 客端 (任意 OpenAI SDK) ─");
  console.log(`    base_url = ${cleanUrl}`);
  console.log(`    api_key  = ${authToken}`);
  console.log("");
  console.log("  ─ 真测命 ─");
  console.log(
    `    curl -u ${u.username}:${u.password} ${cleanUrl}/v1/models -H 'X-Dao-Auth: ${authToken}'`,
  );
  console.log(
    `    curl -u ${u.username}:${u.password} ${cleanUrl}/backends/status -H 'X-Dao-Auth: ${authToken}'`,
  );
  console.log("");
  if (!GITHUB_TOKEN) {
    console.log(C.Y("  ─ 一字便活 GitHub Models 35 模 ─"));
    console.log(C.Y(`    主公在本机 export GITHUB_TOKEN=ghp_xxx 然后:`));
    console.log(C.Y(`    node vm_meta_deploy.js --restart`));
    console.log("");
  }

  return {
    alive: health.statusCode === 200,
    publicUrl,
    cleanUrl,
    authToken,
    authFile: META_AUTH_FILE,
    omniUrl,
    sessionId: vm.sessionId,
  };
}

// ─── 入 ───
(async () => {
  try {
    const r = await deploy();
    process.exit(r && r.alive ? 0 : 1);
  } catch (e) {
    console.error(C.R("\n✗ deploy 失: " + e.message));
    if (e.stack) console.error(e.stack.split("\n").slice(0, 5).join("\n"));
    process.exit(1);
  }
})();
