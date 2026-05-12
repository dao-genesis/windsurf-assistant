#!/usr/bin/env node
/**
 * run_all.cjs — 印 63 · 全套 ws-deploy 测试串跑
 * ════════════════════════════════════════════════════════════════════════
 *   帛书·六十四: 「为之于其未有也, 治之于其未乱也」
 *
 *   顺序:
 *     1. _web_static_audit  (无 IO · 最快)
 *     2. _dao_core_syntax   (require · 静态)
 *     3. _auth_smoke        (启 fleet_vm_unit 子进程 · 长)
 *
 *   每测独立子进程 · 互不污染
 */
"use strict";

const path = require("path");
const { spawnSync } = require("child_process");

const TESTS = ["_web_static_audit", "_dao_core_syntax", "_auth_smoke"];

let allOk = true;
const results = [];

console.log("═══ ws-deploy 全套测试 · 印 63 ═══\n");

for (const t of TESTS) {
  const script = path.join(__dirname, `${t}.cjs`);
  const t0 = Date.now();
  console.log(`\n────── [${t}] ──────`);
  const r = spawnSync(process.execPath, [script], {
    stdio: "inherit",
    cwd: path.join(__dirname, ".."),
  });
  const dt = Date.now() - t0;
  const exitCode = r.status === null ? -1 : r.status;
  const ok = exitCode === 0;
  if (!ok) allOk = false;
  results.push({ name: t, exitCode, ok, ms: dt });
}

console.log("\n═══ 总览 ═══");
for (const r of results) {
  const sym = r.ok ? "✓" : "✗";
  console.log(`  ${sym} ${r.name.padEnd(24)} exit=${r.exitCode} (${r.ms}ms)`);
}
console.log(`\n${allOk ? "✓ 全套通过 · 道法自然" : "✗ 有失败 · 见上"}`);
process.exit(allOk ? 0 : 1);
