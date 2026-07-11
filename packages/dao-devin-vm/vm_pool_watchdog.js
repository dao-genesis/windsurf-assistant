#!/usr/bin/env node
/**
 * vm_pool_watchdog.js · 印 122 · 自启换之 · tunnel rotation watchdog
 *
 * > 「治大国若烹小鲜 · 以道莅天下」(《老子》六十)
 * > 「为之于其未有也 · 治之于其未乱也」(《老子》六十四)
 *
 * 主公诏「推进到底 · 实现一切 · 道法自然 · 无为而无不为」之实:
 *
 * 印 121 SEAL 第九点 (仍未居其厚之事 #1):
 *   「tunnel 寿命: ~30-60 min · 待自动 rotation: 主公或在 印 122/123 加 cron 之 5min poll
 *    · 自动 spawn 新 VM 替死之」
 *
 * 此 watchdog 之实:
 *   1. 5min poll · vm_pool.json 之每件 VM
 *   2. 双探 · /_/health (omni router · 200 = tunnel 活)
 *      · /port/7780/health (dao_proxy · 200 = daemon 活 · X-Dao-Auth 守门)
 *   3. tunnel 死 (400 cloudfront / 502 / timeout) → 标 status=dead
 *   4. 池中 alive 件 < TARGET_ALIVE (默 1) → spawn 新 VM (vm_omni) + deploy (vm_proxy_deploy)
 *   5. 老件 keep 14 天后 prune (留 archive · 不删)
 *
 * 起:
 *   node vm_pool_watchdog.js              # 5min poll · 至 Ctrl+C
 *   node vm_pool_watchdog.js --once       # 单跑一次 · 出
 *   node vm_pool_watchdog.js --interval 300000  # 自定 ms
 *   node vm_pool_watchdog.js --target 2   # 维持 2 件 alive
 *   node vm_pool_watchdog.js --no-spawn   # dry · 仅探 不起新 VM
 *
 * ENV:
 *   DAO_POOL_JSON       = 池 JSON 路径 (默 _state/vm_pool.json)
 *   DAO_AUTH_FILE       = dao_proxy auth token 文件 (默 ../01_GH编排/.dao_auth_token)
 *   DAO_OMNI_JS         = vm_omni.js 路径 (默 ./vm_omni.js)
 *   DAO_DEPLOY_JS       = vm_proxy_deploy.js 路径 (默 ./vm_proxy_deploy.js)
 *   DAO_WATCHDOG_LOG    = 日志路径 (默 _state/watchdog.log)
 *
 * 0 deps · Node 18+ 之 builtin 之 https/fs/child_process 即足
 */
"use strict";

const fs = require("fs");
const path = require("path");
const https = require("https");
const { spawn } = require("child_process");

// ─── 常 ───
const BASE_DIR = __dirname;
const POOL_FILE =
  process.env.DAO_POOL_JSON || path.join(BASE_DIR, "_state", "vm_pool.json");
const AUTH_FILE =
  process.env.DAO_AUTH_FILE ||
  path.resolve(BASE_DIR, "../01_GH编排/.dao_auth_token");
const OMNI_JS = process.env.DAO_OMNI_JS || path.join(BASE_DIR, "vm_omni.js");
const DEPLOY_JS =
  process.env.DAO_DEPLOY_JS || path.join(BASE_DIR, "vm_proxy_deploy.js");
const LOG_FILE =
  process.env.DAO_WATCHDOG_LOG ||
  path.join(BASE_DIR, "_state", "watchdog.log");

const argv = process.argv.slice(2);
const ONCE = argv.includes("--once");
const NO_SPAWN = argv.includes("--no-spawn") || argv.includes("--dry");
const VERBOSE = argv.includes("--verbose") || argv.includes("-v");
function getArgN(name, def) {
  const i = argv.indexOf(name);
  if (i >= 0 && i + 1 < argv.length) return Number(argv[i + 1]);
  return def;
}
const TARGET_ALIVE = getArgN("--target", 1);
const POLL_INTERVAL = getArgN("--interval", 5 * 60 * 1000);
const PROBE_TIMEOUT = getArgN("--probe-timeout", 8000);
const SPAWN_TIMEOUT_MS = getArgN("--spawn-timeout", 12 * 60 * 1000); // 12 min · spawn ~ 10 min

// ─── 色 (低 dep · 不引 chalk) ───
const C = {
  G: (s) => `\x1b[32m${s}\x1b[0m`,
  R: (s) => `\x1b[31m${s}\x1b[0m`,
  Y: (s) => `\x1b[33m${s}\x1b[0m`,
  B: (s) => `\x1b[36m${s}\x1b[0m`,
  GR: (s) => `\x1b[90m${s}\x1b[0m`,
  M: (s) => `\x1b[35m${s}\x1b[0m`,
};

function ts() {
  return new Date().toISOString().replace("T", " ").substring(0, 19);
}

function logLine(line) {
  const stamped = `[${ts()}] ${line}`;
  console.log(stamped);
  try {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    fs.appendFileSync(LOG_FILE, stamped.replace(/\x1b\[[0-9;]*m/g, "") + "\n");
  } catch (e) {
    /* swallow */
  }
}

// ─── 读池 ───
function readPool() {
  if (!fs.existsSync(POOL_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(POOL_FILE, "utf-8")) || [];
  } catch (e) {
    logLine(C.R("✗ pool JSON 解失: " + e.message));
    return [];
  }
}

function writePool(pool) {
  try {
    fs.mkdirSync(path.dirname(POOL_FILE), { recursive: true });
    fs.writeFileSync(POOL_FILE, JSON.stringify(pool, null, 2));
    return true;
  } catch (e) {
    logLine(C.R("✗ pool JSON 写失: " + e.message));
    return false;
  }
}

function readDaoAuth() {
  try {
    return fs.readFileSync(AUTH_FILE, "utf-8").trim();
  } catch (e) {
    return "";
  }
}

// ─── HTTP probe (双 auth) ───
function httpProbe(urlStr, headers, timeoutMs) {
  return new Promise((resolve) => {
    let url;
    try {
      url = new URL(urlStr);
    } catch (e) {
      return resolve({ status: 0, ok: false, ms: 0, err: "url-parse" });
    }
    const t0 = Date.now();
    const auth = url.username
      ? url.username + ":" + decodeURIComponent(url.password || "")
      : null;
    const req = https.request(
      {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + (url.search || ""),
        method: "GET",
        auth,
        headers: headers || {},
        timeout: timeoutMs,
      },
      (res) => {
        const chunks = [];
        res.on("data", (d) => chunks.push(d));
        res.on("end", () => {
          const ms = Date.now() - t0;
          resolve({
            status: res.statusCode || 0,
            ok: (res.statusCode || 0) >= 200 && (res.statusCode || 0) < 300,
            ms,
            body: Buffer.concat(chunks).toString("utf-8").slice(0, 500),
          });
        });
      },
    );
    req.on("error", (e) =>
      resolve({
        status: 0,
        ok: false,
        ms: Date.now() - t0,
        err: e.code || e.message,
      }),
    );
    req.on("timeout", () => {
      req.destroy();
      resolve({ status: 0, ok: false, ms: timeoutMs, err: "timeout" });
    });
    req.end();
  });
}

// ─── 探 1 件 VM ───
async function probeVm(vm) {
  const baseUrl = vm.omni && vm.omni.base_url;
  if (!baseUrl) return { alive: false, reason: "no-omni-url" };

  // ① /_/health (omni router 自身 · tunnel 活否)
  const omniHealth = await httpProbe(
    baseUrl + "/_/health",
    {},
    PROBE_TIMEOUT,
  );
  if (!omniHealth.ok) {
    return {
      alive: false,
      stage: "omni",
      status: omniHealth.status,
      err: omniHealth.err,
      reason:
        omniHealth.err ||
        (omniHealth.body && omniHealth.body.includes("S3")
          ? "cloudfront-drift"
          : `omni-${omniHealth.status}`),
    };
  }

  // ② /port/7780/health (dao_proxy daemon · X-Dao-Auth 守门)
  const daoAuth = readDaoAuth();
  const proxyHealth = await httpProbe(
    baseUrl + "/port/7780/health",
    daoAuth ? { "X-Dao-Auth": daoAuth } : {},
    PROBE_TIMEOUT,
  );

  return {
    alive: omniHealth.ok && proxyHealth.ok,
    stage: proxyHealth.ok ? "full" : "omni-only",
    omni: { status: omniHealth.status, ms: omniHealth.ms },
    proxy: { status: proxyHealth.status, ms: proxyHealth.ms },
    daoVersion: parseDaoVersion(proxyHealth.body),
  };
}

function parseDaoVersion(body) {
  if (!body) return null;
  try {
    const j = JSON.parse(body);
    return j.version || null;
  } catch {
    return null;
  }
}

// ─── spawn + deploy 新 VM ───
function spawnAndDeploy() {
  return new Promise((resolve) => {
    if (NO_SPAWN) {
      logLine(C.Y("  ⊘ --no-spawn · 跳起新 VM"));
      return resolve({ ok: false, reason: "no-spawn" });
    }
    logLine(C.M("  ▶ spawn vm_omni.js (~10 min · 1 ACU)"));
    const t0 = Date.now();
    const omni = spawn(process.execPath, [OMNI_JS], {
      cwd: BASE_DIR,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let timer = setTimeout(() => {
      logLine(C.R("  ✗ vm_omni spawn timeout"));
      try {
        omni.kill("SIGKILL");
      } catch {}
      resolve({ ok: false, reason: "spawn-timeout" });
    }, SPAWN_TIMEOUT_MS);
    omni.stdout.on("data", (d) => {
      stdout += d.toString();
      if (VERBOSE) process.stdout.write(C.GR(d.toString()));
    });
    omni.stderr.on("data", (d) => {
      stderr += d.toString();
      if (VERBOSE) process.stderr.write(C.GR(d.toString()));
    });
    omni.on("close", async (code) => {
      clearTimeout(timer);
      const ms = Date.now() - t0;
      if (code !== 0) {
        logLine(
          C.R(`  ✗ vm_omni exit=${code} · ${(ms / 1000).toFixed(1)}s`),
        );
        return resolve({ ok: false, reason: `omni-exit-${code}` });
      }
      logLine(C.G(`  ✓ vm_omni 起 · ${(ms / 1000).toFixed(1)}s`));

      // re-read pool · find newest
      const pool = readPool();
      if (pool.length === 0) {
        return resolve({ ok: false, reason: "pool-empty-after-spawn" });
      }
      const newIdx = pool.length - 1;
      logLine(
        C.M(`  ▶ vm_proxy_deploy.js --idx ${newIdx} (~30s · 装 dao_proxy)`),
      );
      const dep = spawn(
        process.execPath,
        [DEPLOY_JS, "--idx", String(newIdx)],
        {
          cwd: BASE_DIR,
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      let depStdout = "";
      let depStderr = "";
      dep.stdout.on("data", (d) => {
        depStdout += d.toString();
        if (VERBOSE) process.stdout.write(C.GR(d.toString()));
      });
      dep.stderr.on("data", (d) => {
        depStderr += d.toString();
        if (VERBOSE) process.stderr.write(C.GR(d.toString()));
      });
      const depTimer = setTimeout(() => {
        try {
          dep.kill("SIGKILL");
        } catch {}
      }, 5 * 60 * 1000);
      dep.on("close", (depCode) => {
        clearTimeout(depTimer);
        if (depCode !== 0) {
          logLine(C.R(`  ✗ deploy exit=${depCode}`));
          return resolve({ ok: false, reason: `deploy-exit-${depCode}` });
        }
        logLine(C.G(`  ✓ deploy 完 · idx=${newIdx}`));
        resolve({ ok: true, idx: newIdx });
      });
    });
  });
}

// ─── 一轮 ───
async function tick() {
  const pool = readPool();
  logLine(
    C.B(`═ 巡 · ${pool.length} 件 (target=${TARGET_ALIVE})`),
  );

  let aliveCount = 0;
  let changed = false;
  for (let i = 0; i < pool.length; i++) {
    const vm = pool[i];
    const r = await probeVm(vm);
    const tag = `[${i}] ${(vm.sessionId || "?").substring(0, 16)}…`;
    if (r.alive) {
      aliveCount++;
      logLine(
        `  ${C.G("✓")} ${tag} · stage=${r.stage} · daoV=${r.daoVersion || "?"} · proxy ${r.proxy.status} ${r.proxy.ms}ms`,
      );
      if (vm.status !== "alive") {
        vm.status = "alive";
        changed = true;
      }
    } else {
      logLine(
        `  ${C.R("✗")} ${tag} · stage=${r.stage || "?"} · ${r.reason || r.err || "unknown"}`,
      );
      const newStatus = r.stage === "omni-only" ? "proxy-down" : "dead";
      if (vm.status !== newStatus) {
        vm.status = newStatus;
        vm.lastDeadAt = new Date().toISOString();
        changed = true;
      }
    }
  }

  if (changed) {
    writePool(pool);
    logLine(C.GR("  · pool JSON 已更"));
  }

  logLine(
    `  · ${C.G(aliveCount)} alive · ${C.R(pool.length - aliveCount)} dead/proxy-down`,
  );

  // 池不足 → spawn
  if (aliveCount < TARGET_ALIVE) {
    const need = TARGET_ALIVE - aliveCount;
    logLine(
      C.Y(`  ⊕ alive ${aliveCount} < target ${TARGET_ALIVE} · 起 ${need} 新 VM`),
    );
    for (let i = 0; i < need; i++) {
      const r = await spawnAndDeploy();
      if (!r.ok) {
        logLine(C.R("  ✗ 起新失: " + r.reason));
        break;
      }
    }
  } else {
    logLine(C.G(`  ✓ alive 足 (${aliveCount} ≥ ${TARGET_ALIVE}) · 不动`));
  }
}

// ─── 主 loop ───
async function main() {
  logLine(
    C.M("═══ vm_pool_watchdog · 印 122 · 自启换之 ═══"),
  );
  logLine(
    `  pool=${POOL_FILE} · interval=${(POLL_INTERVAL / 1000).toFixed(0)}s · target=${TARGET_ALIVE} · once=${ONCE} · noSpawn=${NO_SPAWN}`,
  );

  await tick();
  if (ONCE) {
    logLine(C.GR("─ once · 出"));
    process.exit(0);
  }
  setInterval(tick, POLL_INTERVAL).unref();

  // 优雅退
  process.on("SIGINT", () => {
    logLine(C.Y("⊗ SIGINT · 退"));
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    logLine(C.Y("⊗ SIGTERM · 退"));
    process.exit(0);
  });

  // keep-alive
  setInterval(() => {}, 1 << 30);
}

if (require.main === module) {
  main().catch((e) => {
    logLine(C.R("✗ fatal: " + (e.stack || e.message)));
    process.exit(1);
  });
}

module.exports = { tick, probeVm, readPool, writePool };
