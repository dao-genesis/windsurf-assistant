#!/usr/bin/env node
// _seal_inf_parallel_smoke.cjs · 印 ∞ · 对照 tab + A/B 双路 + WAM 无感切号
// ════════════════════════════════════════════════════════════════════════
// 帛书:
//   廿二  「圣人执一 · 以为天下牧」
//   四十二 「道生一 · 一生二 · 二生三 · 三生万物」 (A路+B路即"二")
//   四十八 「为道者日损 · 损之又损 · 以至于无为 · 无为而无不为」
// 庄子·齐物论 (主公诏 2026-05-17 引):
//   「物无非彼 · 物无非是 · 自彼则不见 · 自是则知之」
//
// 主公诏 (2026-05-17 18:07):
//   > 道法自然 推进到底 实现一切 整理所有成果
//   > 完善用户使用端页面 一气化三清 参照 IDE 三栏
//   >   左 · 接收 devin cloud vm 反代出的 windsurf api 和 devin cloud · 提示词隔离注入
//   >   中 · 复用 wam 无感切号之一切 · 管理 windsurf 之账号
//   >   右 · 对照 devin.ai 网页 · 实时交互 · 测试反代 API · 无感使用
//   > 三者道并行而不相悖 · 彻底实现物无非彼 物无非是
//
// 印 ∞ 之实 (此守门 验之):
//   §1 dao_app.js · __useTab 默 "parallel" + renderUseTab_parallel 函数全在
//   §2 dao_app.js · tab bar 含 ★ 对照 + parallel 分支 in renderUseTabContent
//   §3 dao_app.js · renderDrawer_endpt 顶含 v128-route-card (A/B 双路)
//   §4 dao_app.js · probeABRoutes + syncActiveToVm 两函数真存
//   §5 dao_app.js · 切 active radio 含 syncActiveToVm 调用
//   §6 index.html · .v101-parallel CSS + .v128-route-card CSS 真存
//   §7 道义守 · 不破 v101/v128 默 · sendChat 不复写 · 复用一处
//
// 0 deps · 全静测 · ~20 项
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const WEB = path.join(ROOT, "web");
const APP_JS = path.join(WEB, "dao_app.js");
const INDEX_HTML = path.join(WEB, "index.html");

let pass = 0,
  fail = 0;
const fails = [];
const ok = (n) => {
  console.log(`  \x1b[32m✓\x1b[0m ${n}`);
  pass++;
};
const ng = (n, w) => {
  console.log(`  \x1b[31m✗\x1b[0m ${n} · ${w}`);
  fail++;
  fails.push(n + ": " + w);
};

function read(p) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return "";
  }
}

const APP = read(APP_JS);
const HTML = read(INDEX_HTML);

console.log(
  "\n\x1b[1m═══ 印 ∞ · 对照 tab + A/B 双路 + WAM 无感 守门 ═══\x1b[0m",
);
console.log(
  "\x1b[90m帛书·二「物无非彼物无非是」+ 廿二「圣人执一」+ 主公诏「道并行不悖」\x1b[0m\n",
);

// ════════════════════════════════════════════════════════════════════════
// §1 · __useTab 默 parallel + renderUseTab_parallel 函数全在
// ════════════════════════════════════════════════════════════════════════
console.log("\x1b[1m§1 · 默 parallel + 函数全在\x1b[0m");

if (/let __useTab = "parallel"/.test(APP))
  ok("__useTab 默 = \"parallel\" (印 ∞ 默 tab)");
else ng("__useTab 默 parallel", "未改 · 仍 chat 或别");

if (/function renderUseTab_parallel\(container\)/.test(APP))
  ok("renderUseTab_parallel 函数真存");
else ng("renderUseTab_parallel", "函数未定义");

if (/v101-parallel/.test(APP)) ok("v101-parallel class 用于真站 + chat");
else ng("v101-parallel class", "未使用");

if (/D\.iframeSite \|\| "devin"/.test(APP) && /https:\/\/app\.devin\.ai\//.test(APP))
  ok("iframe 默 app.devin.ai (主公诏「对照 devin.ai」)");
else ng("iframe 默 devin.ai", "未匹配");

// ════════════════════════════════════════════════════════════════════════
// §2 · tab bar 含 ★ 对照 + parallel 分支
// ════════════════════════════════════════════════════════════════════════
console.log("\n\x1b[1m§2 · tab bar + dispatch\x1b[0m");

if (/makeUseTab\(\s*"parallel"/.test(APP))
  ok("tab bar 含 makeUseTab(\"parallel\", ...)");
else ng("tab bar parallel", "未注册");

if (/★ 对照/.test(APP)) ok("tab label \"★ 对照\" 真存");
else ng("★ 对照 label", "未含");

if (/__useTab === "parallel"\)\s*renderUseTab_parallel/.test(APP))
  ok("renderUseTabContent dispatch parallel ✓");
else ng("dispatch parallel", "未分支");

// ════════════════════════════════════════════════════════════════════════
// §3 · renderDrawer_endpt 顶含 v128-route-card
// ════════════════════════════════════════════════════════════════════════
console.log("\n\x1b[1m§3 · 左栏 A/B 双路状态卡\x1b[0m");

if (/v128-route-card/.test(APP)) ok("v128-route-card class 用于左栏端点节");
else ng("v128-route-card", "未加");

if (/★ 反代双路 \(印 ∞\)/.test(APP)) ok("反代双路标题真存");
else ng("反代双路标题", "未含");

if (/v128-route-tag.+a.+\["A"\]/s.test(APP) && /v128-route-tag.+b.+\["B"\]/s.test(APP))
  ok("A/B 标签真存 (A: /v1 · B: /dc/v1)");
else ng("A/B 标签", "未匹配");

// ════════════════════════════════════════════════════════════════════════
// §4 · probeABRoutes + syncActiveToVm
// ════════════════════════════════════════════════════════════════════════
console.log("\n\x1b[1m§4 · probeABRoutes + syncActiveToVm\x1b[0m");

if (/async function probeABRoutes\(\)/.test(APP))
  ok("probeABRoutes 函数真存");
else ng("probeABRoutes", "未定义");

if (/D\.vmUrl \+ "\/v1\/models"/.test(APP))
  ok("A 路探 /v1/models (Windsurf codeium)");
else ng("A 路探活", "未匹配");

if (/D\.vmUrl \+ "\/dc\/v1\/models"/.test(APP))
  ok("B 路探 /dc/v1/models (Devin Cloud)");
else ng("B 路探活", "未匹配");

if (/async function syncActiveToVm\(email, key\)/.test(APP))
  ok("syncActiveToVm 函数真存");
else ng("syncActiveToVm", "未定义");

if (/\/admin\/accounts\/active/.test(APP) && /\/admin\/active/.test(APP))
  ok("syncActiveToVm 推 /admin/accounts/active + 兜底 /admin/active");
else ng("syncActiveToVm 端点", "未匹配");

// ════════════════════════════════════════════════════════════════════════
// §5 · 切 active radio 含 syncActiveToVm 调用
// ════════════════════════════════════════════════════════════════════════
console.log("\n\x1b[1m§5 · 中栏切号即推 (无感)\x1b[0m");

if (/syncActiveToVm\(a\.email, a\.key\)\.catch/.test(APP))
  ok("切 active radio 软推 VM (软推 · 失静)");
else ng("切 active 推 VM", "未注入");

// ════════════════════════════════════════════════════════════════════════
// §6 · index.html CSS · .v101-parallel + .v128-route-card
// ════════════════════════════════════════════════════════════════════════
console.log("\n\x1b[1m§6 · index.html CSS\x1b[0m");

if (/\.v101-parallel\s*\{/.test(HTML))
  ok(".v101-parallel CSS 类真存 (flex column 上下分屏)");
else ng(".v101-parallel CSS", "未加");

if (/\.v101-parallel-iframe\s*\{/.test(HTML))
  ok(".v101-parallel-iframe CSS · flex 1 1 45%");
else ng(".v101-parallel-iframe CSS", "未加");

if (/\.v101-parallel-hist\s*\{/.test(HTML))
  ok(".v101-parallel-hist CSS · flex 1 1 55%");
else ng(".v101-parallel-hist CSS", "未加");

if (/\.v128-route-card\s*\{/.test(HTML))
  ok(".v128-route-card CSS 类真存 (A/B 双路状态卡)");
else ng(".v128-route-card CSS", "未加");

if (/\.v128-route-tag\.a\s*\{/.test(HTML) && /\.v128-route-tag\.b\s*\{/.test(HTML))
  ok(".v128-route-tag.a + .v128-route-tag.b CSS (双色)");
else ng(".v128-route-tag a/b CSS", "未加");

// ════════════════════════════════════════════════════════════════════════
// §7 · 道义守 · 不破 v101/v128 · 复用 sendChat · 三清并行
// ════════════════════════════════════════════════════════════════════════
console.log("\n\x1b[1m§7 · 道义守 (帛书廿二「圣人执一」)\x1b[0m");

// 验 sendChat 函数仅一处定义 (圣人执一)
const sendChatDefs = (APP.match(/async function sendChat\b/g) || []).length;
if (sendChatDefs === 1) ok("sendChat 函数唯一定义 (圣人执一 · 不复写)");
else ng("sendChat 唯一", `定义 ${sendChatDefs} 处 (期 1)`);

// 验 renderMineV128 真存且未破
if (/function renderMineV128\(\)/.test(APP))
  ok("renderMineV128 真存 (印 128 三栏并行不破)");
else ng("renderMineV128", "已破");

// 验 renderUseTab_chat 真存 (parallel 不替 chat)
if (/function renderUseTab_chat\(container\)/.test(APP))
  ok("renderUseTab_chat 真存 (chat tab 大屏仍可)");
else ng("renderUseTab_chat", "已破");

// 验 renderUseTab_iframe 真存
if (/function renderUseTab_iframe\(container\)/.test(APP))
  ok("renderUseTab_iframe 真存 (iframe tab 大屏仍可)");
else ng("renderUseTab_iframe", "已破");

// 验 sendChatV101 被 parallel 用 (复用)
if (/onclick: \(\) => sendChatV101\(\)/.test(APP))
  ok("parallel chat 复用 sendChatV101 (一处改万法响应)");
else ng("sendChatV101 复用", "未匹配");

// ════════════════════════════════════════════════════════════════════════
// 总
// ════════════════════════════════════════════════════════════════════════
const total = pass + fail;
console.log(
  `\n\x1b[1m═══ 印 ∞ 守门: ${pass}/${total} ${fail === 0 ? "✓ 全通" : "✗ " + fail + " 失"} ═══\x1b[0m`,
);
if (fail > 0) {
  console.log("\n\x1b[31m失项:\x1b[0m");
  fails.forEach((f) => console.log("  · " + f));
  process.exit(1);
}
process.exit(0);
