#!/usr/bin/env node
/**
 * run_all.cjs — 印 69 · 全套 ws-deploy 测试串跑
 * ════════════════════════════════════════════════════════════════════════
 *   帛书·六十四: 「为之于其未有也, 治之于其未乱也」· 「慎终若始 · 则无败事」
 *   帛书·四十二: 「道生一, 一生二, 二生三, 三生万物」
 *   帛书·四十:   反者, 道之动也; 弱者, 道之用也.
 *
 *   顺序 (由轻至重):
 *     1. _web_static_audit   (无 IO · 最快 · ~1s)
 *     2. _dao_core_syntax    (require · 静态 · ~1s)
 *     3. _three_pure_smoke   (静态文件读 · 印 65 三清守门 · ~1s)
 *     4. _seal67_smoke       (静态文件读 · 印 67 公网入口三态守门 · ~1s)
 *     5. _seal69_smoke       (静态文件读 · 印 69 公网用户视角全审 + Pages workflow + 3 bug 修 · ~1s)
 *     6. _auth_smoke         (启 unit · 印 63 · ~6s)
 *     7. _seal64_smoke       (启 unit · 印 64 · 4 步链/SSE/stats · ~10s)
 *     8. _seal66_smoke       (启 unit · 印 66 · 反者道之动 · 公网视角 + crash-proof · ~12s)
 *
 *   每测独立子进程 · 互不污染
 */
"use strict";

const path = require("path");
const { spawnSync } = require("child_process");

const TESTS = [
  "_web_static_audit",
  "_dao_core_syntax",
  "_three_pure_smoke", // 印 65 · 一气化三清守门 (README / web / scripts 道义)
  "_seal67_smoke", // 印 67 · 道独立体公网入口三态 (gate/onboarding/mine) + Gist 同步层
  "_seal69_smoke", // 印 69 · 公网用户视角全审 · Pages workflow + el()/messages/role 三 bug 治
  "_auth_smoke",
  "_seal64_smoke", // 印 64 · 4 步链 + SSE + /stats
  "_seal66_smoke", // 印 66 · 反者道之动 · 公网视角 fake-key crash-proof + CORS Allow-Headers
  "_seal88_smoke", // 印 88 · 一账号双路 · 物无非彼物无非是 · 整合 Devin 云原生
  "_seal90_smoke", // 印 90 · 网页端注入器 · 反者道之动 · 弱之胜强 (印 89 TAO_HEADER 柔反)
  "_seal92_smoke", // 印 92 · 反者道之动 · 万物归焉而弗为主 · dao-vm + devin_cloud_engine 升 + ACP 真据
  "_seal95_smoke", // 印 95 · 真本源闭环 · token 池云端化 (gist) · 一 GH 账号即一切
  "_seal100_smoke", // 印 100 · 太极笙万物 · 一 PAT 即一切 · 闭环自举 (民莫之令而自均)
];

let allOk = true;
const results = [];

console.log("═══ ws-deploy 全套测试 · 印 69 ═══\n");

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
