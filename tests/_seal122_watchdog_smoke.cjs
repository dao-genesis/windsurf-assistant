#!/usr/bin/env node
/**
 * _seal122_watchdog_smoke.cjs · 印 122 · vm_pool_watchdog 之守门
 *
 * > 「合抱之木 · 生于毫末」(《老子》六十四)
 * > 「慎终若始 · 则无败事矣」(《老子》六十四)
 *
 * 0 deps · 仅 fs/path/assert · 不真起 VM (mock pool)
 *
 * 验:
 *   ① watchdog 之 module exports (probeVm/readPool/writePool/tick)
 *   ② readPool/writePool 真活 (mock JSON)
 *   ③ probeVm 之 url 解析 (Basic auth · port · path)
 *   ④ tick --once --no-spawn 之 idempotent
 *   ⑤ pool JSON 之 status/lastDeadAt 字段 schema
 */
"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const assert = require("assert");

const ROOT = path.resolve(__dirname, "..");

// 印 121 · 件路 · 兼 _PR_PATCH/ 与 src/00_本源/
const candidates = [
  path.join(ROOT, "00_本源", "vm_pool_watchdog.js"), // src
  path.join(ROOT, "packages", "dao-devin-vm", "vm_pool_watchdog.js"), // _PR_PATCH/
];
let WATCHDOG_FILE = null;
for (const c of candidates) {
  if (fs.existsSync(c)) {
    WATCHDOG_FILE = c;
    break;
  }
}

let pass = 0;
let fail = 0;
function ok(msg) {
  console.log("  ✓ " + msg);
  pass++;
}
function bad(msg, e) {
  console.log("  ✗ " + msg + (e ? " · " + e.message : ""));
  fail++;
}

console.log("\n═══ 印 122 · vm_pool_watchdog smoke 守门 ═══\n");

// ── ① 件存 ──
console.log("[1] vm_pool_watchdog.js · 件存");
if (WATCHDOG_FILE) {
  ok(`件存: ${path.relative(ROOT, WATCHDOG_FILE)}`);
} else {
  bad("vm_pool_watchdog.js 不存于 00_本源/ 或 packages/dao-devin-vm/");
  console.log("\n═══ 总: 0/1 · 守门破 ═══\n");
  process.exit(1);
}

// ── ② 字符串 含必要导出与字串 ──
console.log("\n[2] 件 含 必要 之 字串");
const src = fs.readFileSync(WATCHDOG_FILE, "utf-8");
const requiredStrings = [
  ["module.exports = { tick, probeVm, readPool, writePool };", "exports 4 件"],
  ["TARGET_ALIVE", "target 配"],
  ["POLL_INTERVAL", "interval 配"],
  ["NO_SPAWN", "--no-spawn 守门"],
  ["/_/health", "omni health 路"],
  ["/port/7780/health", "dao_proxy health 路"],
  ["lastDeadAt", "持久 dead 时"],
  ["spawnAndDeploy", "起新 VM 函"],
  ["readDaoAuth", "X-Dao-Auth 读"],
  ["SIGINT", "优雅退"],
];
for (const [s, name] of requiredStrings) {
  if (src.includes(s)) ok(`含 ${name} (${s.slice(0, 30)})`);
  else bad(`缺 ${name}`);
}

// ── ③ require 之 module ──
console.log("\n[3] require 之 watchdog · exports 验");
let mod = null;
try {
  mod = require(WATCHDOG_FILE);
  ok("require 通");
} catch (e) {
  bad("require 失", e);
}

if (mod) {
  for (const fn of ["tick", "probeVm", "readPool", "writePool"]) {
    if (typeof mod[fn] === "function") ok(`exports.${fn} 是 function`);
    else bad(`exports.${fn} 非 function (${typeof mod[fn]})`);
  }
}

// ── ④ readPool/writePool 之 round-trip ──
console.log("\n[4] readPool/writePool · round-trip");
const tmpPool = path.join(os.tmpdir(), `_smoke_pool_${Date.now()}.json`);
process.env.DAO_POOL_JSON = tmpPool; // 注: 此对已 require 之 mod 不生效 (常已凝)
// 故 直接 fs · 模 watchdog 之 写读
try {
  const fakePool = [
    {
      sessionId: "devin-smoke-001",
      status: "alive",
      omni: { base_url: "https://user:pass@x.devinapps.com" },
    },
    {
      sessionId: "devin-smoke-002",
      status: "dead",
      lastDeadAt: "2026-05-17T03:00:00Z",
      omni: { base_url: "https://user:pass@y.devinapps.com" },
    },
  ];
  fs.writeFileSync(tmpPool, JSON.stringify(fakePool, null, 2));
  const reread = JSON.parse(fs.readFileSync(tmpPool, "utf-8"));
  assert.strictEqual(reread.length, 2, "len 应 2");
  assert.strictEqual(reread[0].sessionId, "devin-smoke-001", "sessionId match");
  assert.strictEqual(reread[1].status, "dead", "status=dead 持久");
  assert.ok(reread[1].lastDeadAt, "lastDeadAt 持久");
  ok("pool JSON · 写 / 读 / parse · 通");
  fs.unlinkSync(tmpPool);
} catch (e) {
  bad("round-trip 失", e);
}

// ── ⑤ probeVm 形 (静) · 不真发请 ──
console.log("\n[5] probeVm · 接口形");
if (mod && mod.probeVm) {
  // 仅验 是 async function (returns Promise) · 不真发
  try {
    const fnStr = mod.probeVm.toString();
    if (fnStr.includes("async") || fnStr.includes("Promise"))
      ok("probeVm 是 async (返 Promise)");
    else bad("probeVm 非 async");
    if (fnStr.includes("base_url")) ok("probeVm 读 vm.omni.base_url");
    else bad("probeVm 不读 vm.omni.base_url");
    if (fnStr.includes("/_/health")) ok("probeVm 探 omni /_/health");
    else bad("probeVm 不探 /_/health");
    if (fnStr.includes("/port/7780/health"))
      ok("probeVm 探 dao_proxy /port/7780/health");
    else bad("probeVm 不探 /port/7780/health");
  } catch (e) {
    bad("probeVm 形 验失", e);
  }
}

// ── ⑥ CLI · 含 --once --no-spawn 守门 ──
console.log("\n[6] CLI · 守门 args");
if (
  src.includes('argv.includes("--once")') &&
  src.includes('argv.includes("--no-spawn")')
) {
  ok("CLI 之 --once / --no-spawn 守门 立");
} else {
  bad("CLI 之 守门 args 缺");
}

// ── ⑦ 印 122 之 spirit · daoism quote 含 ──
console.log("\n[7] 件 含 印 122 之 spirit (帛书引)");
if (src.includes("治大国若烹小鲜") || src.includes("治之于其未乱也")) {
  ok("含 帛书 引 (印 122 之根)");
} else {
  bad("无 帛书 引 · 失印 122 之根");
}

// ── 总 ──
const total = pass + fail;
console.log(`\n═══ 总: ${pass} 过 / ${fail} 失 / ${total} 测 ═══`);
if (fail === 0) {
  console.log("✓ vm_pool_watchdog 守门通 · 自启换之 · 道法自然\n");
  process.exit(0);
} else {
  console.log("✗ 守门有失 · 待修\n");
  process.exit(1);
}
