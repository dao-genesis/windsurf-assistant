#!/usr/bin/env node
/**
 * 印 100 · 太极笙万物 · 一 PAT 即一切 · 闭环自举 · smoke 测
 * ════════════════════════════════════════════════════════════════════════
 *
 *   帛书·三十二: 道恒无名 · 侯王若能守之 · 万物将自宾
 *                天地相合 · 以降甘露 · 民莫之令而自均焉
 *   帛书·四十二: 道生一 · 一生二 · 二生三 · 三生万物
 *
 * 主公诏 (2026-05-14 11:58):
 *   「闭环自举 · 推进到极 · 太极笙万物」
 *
 * 守门 (全离网 · 0 deps · Node vm 沙箱模拟浏览器):
 *   §1  dao_bootstrap.js syntax 真解析
 *   §2  必出函/常 (oneShot/selfHeal/pick/poll/probe/auth/yin)
 *   §3  generateAuthKey 真生 sk-ws-proxy-* (48 hex)
 *   §4  pickActiveDaemon (选 reportedAt 最新 · 排过期)
 *   §5  initialPoolData schema (v2 · yin=100 · bootstrap 节)
 *   §6  dao_github_sync.js DEFAULT_DAO_DATA.cloudPool 新字段
 *   §7  dao-fleet-cloud.yml 真解锁 + 接 inputs
 *   §8  dao_app.js renderOnboarding 调 daoBootstrap.oneShot
 *   §9  index.html 含 9 step + 引 dao_bootstrap.js
 *   §10 道义守 (帛书三十二 + 印 100 + 反者道之动)
 *
 *   零依赖 · ~30s · 仅 Node 内置 (fs/path/vm/url)
 */

"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const ROOT = path.resolve(__dirname, "..");

let passed = 0;
let failed = 0;
const fails = [];
function ok(cond, label) {
  if (cond) {
    passed++;
    console.log("  ✓ " + label);
  } else {
    failed++;
    fails.push(label);
    console.log("  ✗ " + label);
  }
}
function head(s) {
  console.log("\n" + s);
}

console.log("═══ 印 100 太极笙万物 · 闭环自举 · smoke 测 ═══");

// ───────────────────────────────────────────────────────────────────────
// §1 · dao_bootstrap.js syntax 真解析
// ───────────────────────────────────────────────────────────────────────
head("§1 syntax · dao_bootstrap.js");
const dbPath = path.join(ROOT, "web", "dao_bootstrap.js");
ok(fs.existsSync(dbPath), "§1.1 dao_bootstrap.js 在");
const dbSrc = fs.readFileSync(dbPath, "utf8");
ok(dbSrc.length > 8000, "§1.2 文 ≥ 8000 字 (got " + dbSrc.length + ")");

// 用 Node vm 模拟浏览器跑此 IIFE
const sandbox = {
  window: {},
  document: {},
  fetch: async () => ({ ok: true, status: 200, text: async () => "{}" }),
  console: console,
  crypto: {
    getRandomValues(arr) {
      // 简单确定填充以验
      for (let i = 0; i < arr.length; i++) arr[i] = (i * 7 + 13) & 0xff;
      return arr;
    },
  },
  setTimeout: setTimeout,
  Date: Date,
  Math: Math,
  Object: Object,
  Array: Array,
  Promise: Promise,
  AbortSignal: { timeout: (ms) => ({ aborted: false }) },
  JSON: JSON,
  Error: Error,
  isNaN: isNaN,
};
sandbox.window.crypto = sandbox.crypto;
sandbox.daoSync = null; // 等下设
let parsedOk = false;
try {
  vm.createContext(sandbox);
  vm.runInContext(dbSrc, sandbox, { filename: "dao_bootstrap.js" });
  parsedOk = true;
  ok(true, "§1.3 dao_bootstrap.js 真解析 + IIFE 跑通");
} catch (e) {
  ok(false, "§1.3 解析失: " + e.message);
}

// ───────────────────────────────────────────────────────────────────────
// §2 · 必出函/常
// ───────────────────────────────────────────────────────────────────────
head("§2 daoBootstrap 必出函/常");
const DB = sandbox.window.daoBootstrap;
ok(!!DB, "§2.1 window.daoBootstrap 立");
if (DB) {
  ok(typeof DB.oneShot === "function", "§2.2 oneShot 函");
  ok(typeof DB.selfHeal === "function", "§2.3 selfHeal 函");
  ok(
    typeof DB.pickActiveDaemon === "function",
    "§2.4 pickActiveDaemon 函",
  );
  ok(typeof DB.pollDaemonReady === "function", "§2.5 pollDaemonReady 函");
  ok(typeof DB.probeVmHealth === "function", "§2.6 probeVmHealth 函");
  ok(
    typeof DB.generateAuthKey === "function",
    "§2.7 generateAuthKey 函",
  );
  ok(
    typeof DB.findOrCreateDaoPoolGist === "function",
    "§2.8 findOrCreateDaoPoolGist 函",
  );
  ok(
    typeof DB.dispatchCloudFleet === "function",
    "§2.9 dispatchCloudFleet 函",
  );
  ok(
    typeof DB.enableForkActions === "function",
    "§2.10 enableForkActions 函",
  );
  ok(typeof DB.initialPoolData === "function", "§2.11 initialPoolData 函");
  ok(DB.YIN === 100, "§2.12 YIN 常 = 100 (got " + DB.YIN + ")");
  ok(
    DB.POOL_GIST_FILE === "dao-pool.json",
    "§2.13 POOL_GIST_FILE = dao-pool.json",
  );
  ok(
    typeof DB.POOL_GIST_DESC === "string" && DB.POOL_GIST_DESC.includes("dao-pool"),
    "§2.14 POOL_GIST_DESC 含 dao-pool",
  );
}

// ───────────────────────────────────────────────────────────────────────
// §3 · generateAuthKey
// ───────────────────────────────────────────────────────────────────────
head("§3 generateAuthKey · sk-ws-proxy-*");
if (DB) {
  const k1 = DB.generateAuthKey();
  ok(typeof k1 === "string", "§3.1 generateAuthKey 返 string");
  ok(k1.startsWith("sk-ws-proxy-"), "§3.2 prefix=sk-ws-proxy-");
  const hex = k1.slice("sk-ws-proxy-".length);
  ok(hex.length === 48, "§3.3 hex 长 48 (got " + hex.length + ")");
  ok(/^[0-9a-f]+$/.test(hex), "§3.4 hex 仅 [0-9a-f]");
  // 在 vm sandbox 内 crypto 是确定的，所以 k2 应 === k1（用于 smoke 验生 path 同）
  const k2 = DB.generateAuthKey();
  ok(k1 === k2, "§3.5 同 sandbox crypto 出同串 (验生路径同)");
}

// ───────────────────────────────────────────────────────────────────────
// §4 · pickActiveDaemon (选 reportedAt 最新 · 排过期)
// ───────────────────────────────────────────────────────────────────────
head("§4 pickActiveDaemon");
if (DB) {
  const now = Date.now();
  const fresh = new Date(now - 60 * 1000).toISOString(); // 1 min ago
  const old = new Date(now - 90 * 60 * 1000).toISOString(); // 90 min ago
  const mid = new Date(now - 5 * 60 * 1000).toISOString(); // 5 min ago
  const pool = {
    daemons: [
      { url: "https://old.trycloudflare.com", reportedAt: old },
      { url: "https://mid.trycloudflare.com", reportedAt: mid },
      { url: "https://fresh.trycloudflare.com", reportedAt: fresh },
    ],
  };
  const pick = DB.pickActiveDaemon(pool, { maxAgeMin: 30 });
  ok(!!pick, "§4.1 选出 pick (非 null)");
  ok(
    pick && pick.url === "https://fresh.trycloudflare.com",
    "§4.2 选最新 (fresh)",
  );
  // 全过期
  const dead = {
    daemons: [{ url: "https://old.trycloudflare.com", reportedAt: old }],
  };
  ok(
    DB.pickActiveDaemon(dead, { maxAgeMin: 30 }) === null,
    "§4.3 全过期 → null",
  );
  // 空
  ok(DB.pickActiveDaemon({}, {}) === null, "§4.4 空 daemons → null");
  ok(
    DB.pickActiveDaemon(null, {}) === null,
    "§4.5 null poolData → null",
  );
  // 无 reportedAt 视为活
  const noTime = { daemons: [{ url: "https://x.com" }] };
  const p2 = DB.pickActiveDaemon(noTime, { maxAgeMin: 30 });
  ok(!!p2 && p2.url === "https://x.com", "§4.6 无 reportedAt → 视活");
}

// ───────────────────────────────────────────────────────────────────────
// §5 · initialPoolData schema (v2 · yin=100 · bootstrap 节)
// ───────────────────────────────────────────────────────────────────────
head("§5 initialPoolData schema");
if (DB) {
  const seed = DB.initialPoolData();
  ok(seed.schemaVersion === 2, "§5.1 schemaVersion=2");
  ok(seed.yin === 100, "§5.2 yin=100");
  ok(typeof seed.createdAt === "string", "§5.3 createdAt 在");
  ok(seed.pool && Array.isArray(seed.pool.accounts), "§5.4 pool.accounts 数组");
  ok(seed.pool.accounts.length === 0, "§5.5 pool.accounts 初空 (用户后填)");
  ok(seed.pool.total === 0, "§5.6 pool.total=0");
  ok(seed.pool.candidates === 0, "§5.7 pool.candidates=0");
  ok(Array.isArray(seed.daemons) && seed.daemons.length === 0, "§5.8 daemons 初空");
  ok(seed.bootstrap && seed.bootstrap.yin === 100, "§5.9 bootstrap.yin=100");
  ok(
    seed.bootstrap.autoBootstrapped === true,
    "§5.10 bootstrap.autoBootstrapped=true",
  );
  ok(
    seed.bootstrap.seed === "民莫之令而自均焉",
    "§5.11 bootstrap.seed 含帛书三十二",
  );
}

// ───────────────────────────────────────────────────────────────────────
// §6 · dao_github_sync.js DEFAULT_DAO_DATA.cloudPool 新字段
// ───────────────────────────────────────────────────────────────────────
head("§6 dao_github_sync.js · cloudPool 印 100 升");
const gsSrc = fs.readFileSync(
  path.join(ROOT, "web", "dao_github_sync.js"),
  "utf8",
);
ok(gsSrc.includes("印 100"), "§6.1 印 100 印在");
ok(gsSrc.includes("autoBootstrapped"), "§6.2 字段 autoBootstrapped 在");
ok(gsSrc.includes("bootstrapAt"), "§6.3 字段 bootstrapAt 在");
ok(gsSrc.includes("poolUrl"), "§6.4 字段 poolUrl 在");
ok(/yin:\s*0/.test(gsSrc), "§6.5 字段 yin 在 (默 0)");
ok(
  gsSrc.includes("侯王若能守之") || gsSrc.includes("万物将自宾"),
  "§6.6 帛书三十二在",
);

// ───────────────────────────────────────────────────────────────────────
// §7 · dao-fleet-cloud.yml 解锁 + 接 inputs
// ───────────────────────────────────────────────────────────────────────
head("§7 dao-fleet-cloud.yml · 印 100 解锁");
const wfPath = path.join(
  ROOT,
  ".github",
  "workflows",
  "dao-fleet-cloud.yml",
);
const wfSrc = fs.readFileSync(wfPath, "utf8");
ok(
  !/if:\s*github\.repository_owner\s*==\s*'zhouyoukang'/.test(wfSrc),
  "§7.1 锁 if: owner==zhouyoukang 已去 (任 fork 自跑)",
);
ok(wfSrc.includes("gist_id:"), "§7.2 inputs.gist_id 在");
ok(wfSrc.includes("pat:"), "§7.3 inputs.pat 在");
ok(wfSrc.includes("auth_key:"), "§7.4 inputs.auth_key 在");
ok(
  wfSrc.includes("github.event.inputs.gist_id || secrets.DAO_POOL_GIST_ID"),
  "§7.5 env: inputs 优先 secrets · gist_id",
);
ok(
  wfSrc.includes("github.event.inputs.pat || secrets.DAO_POOL_PAT"),
  "§7.6 env: inputs 优先 secrets · pat",
);
ok(
  wfSrc.includes("github.event.inputs.auth_key || secrets.DAO_AUTH_KEY"),
  "§7.7 env: inputs 优先 secrets · auth_key",
);
ok(wfSrc.includes("印 100"), "§7.8 印 100 印在");
ok(wfSrc.includes("民莫之令而自均"), "§7.9 帛书三十二在");

// ───────────────────────────────────────────────────────────────────────
// §8 · dao_app.js renderOnboarding 调 daoBootstrap.oneShot
// ───────────────────────────────────────────────────────────────────────
head("§8 dao_app.js · renderOnboarding 调 oneShot");
const appSrc = fs.readFileSync(path.join(ROOT, "web", "dao_app.js"), "utf8");
ok(appSrc.includes("印 100 太极笙万物"), "§8.1 印 100 太极笙万物 印在");
ok(
  appSrc.includes("window.daoBootstrap.oneShot"),
  "§8.2 renderOnboarding 调 daoBootstrap.oneShot",
);
ok(appSrc.includes("stepIdMap"), "§8.3 stepIdMap 在");
ok(appSrc.includes("step-actions"), "§8.4 step-actions 映射");
ok(appSrc.includes("step-pool-gist"), "§8.5 step-pool-gist 映射");
ok(appSrc.includes("step-dispatch"), "§8.6 step-dispatch 映射");
ok(appSrc.includes("step-poll"), "§8.7 step-poll 映射");
ok(appSrc.includes("step-probe"), "§8.8 step-probe 映射");
ok(appSrc.includes("step-write"), "§8.9 step-write 映射");
ok(appSrc.includes("民莫之令而自均"), "§8.10 帛书三十二在");

// ───────────────────────────────────────────────────────────────────────
// §9 · index.html 9 step + 引 dao_bootstrap.js
// ───────────────────────────────────────────────────────────────────────
head("§9 index.html · 9 step + 引");
const htmlSrc = fs.readFileSync(
  path.join(ROOT, "web", "index.html"),
  "utf8",
);
ok(htmlSrc.includes('id="step-fork"'), "§9.1 step-fork div 在");
ok(htmlSrc.includes('id="step-actions"'), "§9.2 step-actions div 在");
ok(htmlSrc.includes('id="step-pages"'), "§9.3 step-pages div 在");
ok(htmlSrc.includes('id="step-gist"'), "§9.4 step-gist div 在");
ok(htmlSrc.includes('id="step-pool-gist"'), "§9.5 step-pool-gist div 在");
ok(htmlSrc.includes('id="step-dispatch"'), "§9.6 step-dispatch div 在");
ok(htmlSrc.includes('id="step-poll"'), "§9.7 step-poll div 在");
ok(htmlSrc.includes('id="step-probe"'), "§9.8 step-probe div 在");
ok(htmlSrc.includes('id="step-write"'), "§9.9 step-write div 在");
ok(htmlSrc.includes('id="step-redirect"'), "§9.10 step-redirect div 在");
ok(
  htmlSrc.includes('src="dao_bootstrap.js"'),
  "§9.11 引 dao_bootstrap.js",
);
ok(
  htmlSrc.indexOf('src="dao_github_sync.js"') <
    htmlSrc.indexOf('src="dao_bootstrap.js"'),
  "§9.12 引序: dao_github_sync 先于 dao_bootstrap",
);
ok(
  htmlSrc.indexOf('src="dao_bootstrap.js"') <
    htmlSrc.indexOf('src="dao_app.js"'),
  "§9.13 引序: dao_bootstrap 先于 dao_app",
);
ok(
  htmlSrc.includes("印 100") || htmlSrc.includes("太极笙万物"),
  "§9.14 印 100 / 太极笙万物 印在",
);

// ───────────────────────────────────────────────────────────────────────
// §10 · 道义守 (帛书三十二 + 反者道之动 + 印 100)
// ───────────────────────────────────────────────────────────────────────
head("§10 道义守");
ok(dbSrc.includes("印 100"), "§10.1 dao_bootstrap.js 印 100 印");
ok(dbSrc.includes("太极笙万物"), "§10.2 dao_bootstrap.js 太极笙万物 印");
ok(
  dbSrc.includes("民莫之令而自均"),
  "§10.3 dao_bootstrap.js 帛书三十二在",
);
ok(
  dbSrc.includes("反者道之动") || dbSrc.includes("天下之物生于有"),
  "§10.4 dao_bootstrap.js 帛书四十在",
);
ok(
  dbSrc.includes("圣人执一") || dbSrc.includes("独立而不垓"),
  "§10.5 dao_bootstrap.js 帛书廿二/廿五在",
);
// 道义守 (不偷不破)
ok(
  dbSrc.includes("用户 PAT 写用户自有资源") ||
    dbSrc.includes("不写主公中心"),
  "§10.6 道义注 · 不写主公中心",
);
ok(
  dbSrc.includes("不传 token") || dbSrc.includes("池初始为空"),
  "§10.7 道义注 · 不传 token",
);

// ───────────────────────────────────────────────────────────────────────
console.log("\n═══ 印 100 smoke 总览 ═══");
console.log("  通: " + passed);
console.log("  失: " + failed);
if (failed > 0) {
  console.log("\n失项:");
  for (const f of fails) console.log("  · " + f);
  process.exit(1);
}
console.log(
  "\n✓ 印 100 smoke 全通 · 太极笙万物 · 一 PAT 即一切 · 民莫之令而自均",
);
console.log("  帛书·三十二: 道恒无名 · 侯王若能守之 · 万物将自宾");
console.log("              天地相合 · 以降甘露 · 民莫之令而自均焉");
console.log("  帛书·四十二: 道生一 · 一生二 · 二生三 · 三生万物");
console.log("  帛书·四十:  反者道之动 · 弱者道之用");
process.exit(0);
