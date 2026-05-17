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
  // (cleanup-2026-05-16 · _web_static_audit 随 legacy.html 同损 · 现 web 由 _seal67/69_smoke 守)
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
  "_seal101_smoke", // 印 101 · 万法归宗 · 大道至简 · 用 + 管 二字 (反者道之动 · 为道日损)
  "_seal115_smoke", // 印 115 · 反者道之动 · GH 面板综合管 · Devin VM 反代核心 (鸡犬相闻)
  "_seal121_smoke", // 印 121 · auth_chain 三口同源守门 (web ↔ workflow ↔ daemon · 圣人执一)
  "_seal122_smoke", // 印 122 · yin122 全审纳入律 (3 件 git tracked + 印号统一 + silk 双源 + §0.1 软接入)
  "_seal122_watchdog_smoke", // 印 122 · vm_pool_watchdog 守门 (自启换之 · tunnel rotation · 5min poll)
  "_yin124_root_runtime_smoke", // 印 124 · 反者道之动 · 根本底层真运 (真起 daemon · 真探 · 真切 SP · 真关 · 由静返动)
  "_yin125_sp_inject_smoke", // 印 125 · 反者道之动 · SP 真注入实证 (POST /v1/system/sp-dryrun · 由号返实 · 居实不居华)
  "_seal128_yiqi_sanqing_smoke", // 印 128 · 一气化三清整体真本源治 · 物无非彼物无非是 · 件齐 + 印号 + 三层对齐
  "_seal129_real_login_smoke", // 印 129 · 真本源切号 · 代主公登 windsurf · 反者道之动 (3-step mock + 失败路径 · 此登录为核心切号本源)
  "_seal130_keys_admin_smoke", // 印 130 · 真本源接入闭环 (主公立 · /admin/keys/{add,list,remove} 真路 · 守隐 + auth + 去重 + warn · 一线到底)
  "_seal130_oauth_device_flow_smoke", // 印 130 · OAuth Device-Flow 一键登 + 池接入闭环合并 (登→入池→用 · 去中心化 · 反者道之动)
  "_seal131_chinese_path_spawn_smoke", // 印 131 · 中文路径子进程承双旗 (圣人执一 · run_all 双旗 + 5 守门 spawn 一致 · ENOENT 治本)
  "_seal132_client_id_loader_smoke", // 印 132 · OAuth client_id 4 源智能加载 (URL > localStorage > window_global > DEFAULT) · 弱者道之用 · 帛书七十八
  "_seal133_wam_md_real_smoke", // 印 133 · 反者道之动 · WAM 本地真本源桥 (~/.wam → /admin/wam/{local,use}) · 大曰逝逝曰远远曰反 · 帛书廿五
  "_seal_inf_parallel_smoke", // 印 ∞ · 对照 tab + A/B 双路 + WAM 无感切号 · 物无非彼 物无非是 · 庄子齐物论
  "_seal_inf2_dc_routes_smoke", // 印 ∞.2 · B 路 /dc/* 显式 devin cloud 反代 · 双反代之实 · 弱者道之用 · 帛书七十八
  "_seal_inf_yiqi_real_impl_smoke", // 印 ∞ · 道动测真实证 (∞.3 apiKey 前缀 + ∞.4 srvUrl 优先 + 133 端点活) · 大曰逝逝曰远远曰反 · 帛书廿五
];

let allOk = true;
const results = [];

console.log("═══ ws-deploy 全套测试 · 印 69 ═══\n");

// 印 131 · 反者道之动 · 中文路径下子孙皆承旗 · 圣人执一以为天下牧
//   帛书·廿二: 「圣人执一 · 以为天下牧」
//   帛书·四十三: 「无有入于无间」
//   Node v24 + Windows + 中文路径 + Junction: realpathSync → ENOENT
//
//   解: 双旗经 NODE_OPTIONS 环境变量传承 · 一旗到底 · 父子孙皆透
//     - CLI 旗 (process.execArgv) 仅子继 · 孙不继
//     - NODE_OPTIONS env 子孙皆继 · 无有入于无间
//   主旗 (--preserve-symlinks-main) 治 main script realpath
//   副旗 (--preserve-symlinks) 治 require() 内之 realpath
//   双旗合一 · 子内复 spawn `node -c` / `node --check` 之 grandchild 亦得保
const _DUAL_FLAGS = ["--preserve-symlinks", "--preserve-symlinks-main"];
const _childEnv = { ...process.env };
{
  const _existing = (_childEnv.NODE_OPTIONS || "").trim();
  const _missing = _DUAL_FLAGS.filter((f) => !_existing.includes(f));
  if (_missing.length) {
    _childEnv.NODE_OPTIONS = [_existing, ..._missing].filter(Boolean).join(" ");
  }
}
// CLI 旗亦添 · 双保 (env + argv) · 帛书廿八 「为天下式 · 恒德不贰」
const _childExecArgv = Array.isArray(process.execArgv)
  ? [...process.execArgv]
  : [];
for (const _flag of _DUAL_FLAGS) {
  if (!_childExecArgv.includes(_flag)) _childExecArgv.push(_flag);
}

for (const t of TESTS) {
  const script = path.join(__dirname, `${t}.cjs`);
  const t0 = Date.now();
  console.log(`\n────── [${t}] ──────`);
  const r = spawnSync(process.execPath, [..._childExecArgv, script], {
    stdio: "inherit",
    cwd: path.join(__dirname, ".."),
    env: _childEnv,
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
