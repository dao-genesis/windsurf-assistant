#!/usr/bin/env node
// _seal128_yiqi_sanqing_smoke.cjs · 印 128 · 一气化三清整体真本源治 · 反者道之动 · 物无非彼物无非是
// ════════════════════════════════════════════════════════════════════════
//
// 帛书:
//   廿二 「圣人执一 · 以为天下牧 · 不自视故明 · 不自见故章」
//   廿五 「大曰逝 · 逝曰远 · 远曰反」
//   六十三 「图难于其易 · 为大于其细」
//   六十四 「为之于其未有也 · 治之于其未乱也 · 慎终若始 · 则无败事」
//
// 庄子·齐物论 (主公诏引):
//   「物无非彼 · 物无非是 · 自彼则不见 · 自是则知之」
//   ── 三清不分立 · 互为彼此 · 一即三 · 三即一
//
// 主公诏 (2026-05-17 · 14:36 UTC+08):
//   > 从根本底层彻底完善反代底层
//   > 反代链路一气化三清:
//   >   一为 Devin Cloud VM 虚拟机无限制并发 · 一 windsurf 账号一 VM 运行双反代+隔离提示词
//   >   二为用户端 GitHub 账号统一公网管理接口 · 接收虚拟机反代 api · 统一账号管理 · 面板管理一切
//   >   三为用户任意公网设备可无感调用 api
//   > 道法自然 · 实现物无非彼 · 物无非是 · 自彼则不见 · 自是则知之
//   > 无为而无不为
//
// 此守门 (印 128 之实) — 反观印 95→127 之路 · 守 三清整体一气贯之静本源:
//   §1 件齐 · 三清之件全数 git tracked (一清 10 + 二清 4 + vendor/外接api 14 + 守门 18→19)
//   §2 一清 · dao_proxy.js 12 § 节标真存 + SP 7 态枚举完整
//   §3 二清 · web/dao_app.js 印 123 SP 7 态对齐一清 (passthrough/usernote)
//   §4 三清 · 三协议适配器 (handleOpenAI/Anthropic/Gemini) + 智能路由 windsurf/devin
//   §5 印号一致性 · dao-devin-vm 主件 SEAL 含 印 122+ · INDEX_GUIZONG 含 印 128
//   §6 整图 · docs/印 128_一气化三清*.md 真存 + 一气化三清整图 docs/ARCHITECTURE_v123 真存
//
// 0 deps · 30-50 项 · 静测 (动测由 _yin124_root_runtime_smoke 真起 daemon 已覆盖)
// 「为道者日损 · 大道至简」 — 不重复 yin124 · 仅守 yin124 未覆盖之 三清整体对齐
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DEVIN_VM = path.join(ROOT, "packages", "dao-devin-vm");
const PROXY_MIN = path.join(ROOT, "packages", "dao-proxy-min");
const VENDOR_API = path.join(PROXY_MIN, "vendor", "外接api");
const WEB = path.join(ROOT, "web");
const DOCS = path.join(ROOT, "docs");
const TESTS = path.join(ROOT, "tests");

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

function exists(p) {
  try {
    return fs.statSync(p).isFile() || fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}
function readSafe(p) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return "";
  }
}

console.log(
  "\n\x1b[1m═══ 印 128 · 一气化三清整体真本源治 · 物无非彼物无非是 ═══\x1b[0m",
);
console.log(
  "\x1b[90m帛书廿二「圣人执一」+ 庄子「物无非彼物无非是」+ 主公诏「从根本底层彻底完善 · 反代链路一气化三清」\x1b[0m\n",
);

// ════════════════════════════════════════════════════════════════════════
// §1 · 件齐 · 三清件全数 git tracked
// ════════════════════════════════════════════════════════════════════════
console.log(
  "\x1b[1m§1 · 三清件齐 (一清 10 + 二清 4 + vendor 14 + 守门 19)\x1b[0m",
);

// 一清 · dao-devin-vm/ (10 件 · 反代核心)
const QING1_FILES = [
  "dao_proxy.js",
  "deployer.js",
  "meta_router.cjs",
  "package.json",
  "README.md",
  "sp_observe_patch.js",
  "vm_meta_deploy.js",
  "vm_omni.js",
  "vm_pool_watchdog.js",
  "vm_proxy_deploy.js",
];
for (const f of QING1_FILES) {
  const p = path.join(DEVIN_VM, f);
  if (exists(p)) ok(`一清 dao-devin-vm/${f}`);
  else ng(`一清 ${f}`, "缺");
}

// 二清 · web/ (4 件 · 公网管理面板)
const QING2_FILES = [
  "dao_app.js",
  "dao_bootstrap.js",
  "dao_github_sync.js",
  "index.html",
];
for (const f of QING2_FILES) {
  const p = path.join(WEB, f);
  if (exists(p)) ok(`二清 web/${f}`);
  else ng(`二清 ${f}`, "缺");
}

// vendor/外接api/ (14 件 · 印 124 第一细药 · 一身两轨之轨 B)
const VENDOR_FILES = [
  "README.md",
  "lm_register.js",
  "runtime.js",
  "配置.example.json",
  "gateway/capabilities.js",
  "gateway/package.json",
  "gateway/registry.js",
  "gateway/server.js",
  "gateway/translate.js",
  "gateway/providers/anthropic.js",
  "gateway/providers/gemini.js",
  "gateway/providers/http.js",
  "gateway/providers/ollama.js",
  "gateway/providers/openai.js",
];
for (const f of VENDOR_FILES) {
  const p = path.join(VENDOR_API, f);
  if (exists(p)) ok(`vendor/外接api/${f}`);
  else ng(`vendor ${f}`, "缺");
}

// ════════════════════════════════════════════════════════════════════════
// §2 · 一清 · dao_proxy.js 12 § 节标 + SP 7 态枚举
// ════════════════════════════════════════════════════════════════════════
console.log("\n\x1b[1m§2 · 一清 dao_proxy 12 § 节标 + SP 7 态\x1b[0m");

const DP_SRC = readSafe(path.join(DEVIN_VM, "dao_proxy.js"));
const REQUIRED_SECTIONS = [
  "§ 0.1 · 印 122 · sp_observe_patch",
  "§ 0 · 元",
  "§ 1 · 配",
  "§ 2 · 日志",
  "§ 3 · 帛书 silk",
  "§ 4 · SP 三态核",
  "§ 5 · WAM 池",
  "§ 5b · 印 104 · Windsurf 双端池",
  "§ 6 · WSS ACP 客",
  "§ 7 · metrics",
  "§ 8 · HTTP 助函",
  "§ 9 · 三协议",
  "§ 10 · 管理路由",
  "§ 11 · 主路由",
  "§ 11b · 印 104 · Windsurf 双端真转",
  "§ 12 · 主",
];
for (const sec of REQUIRED_SECTIONS) {
  if (DP_SRC.includes(sec)) ok(`§ "${sec.split("·")[0].trim()}"`);
  else ng(`§ ${sec}`, "缺");
}

// SP 7 态枚举 (印 122 升 · 印 123 web 对齐)
const SP_STATES = [
  "bypass",
  "override",
  "prepend",
  "append",
  "dao",
  "custom",
  "usernote",
];
const spArrayMatch = DP_SRC.match(/strategy:\s*\[([^\]]+)\]/);
if (spArrayMatch) {
  let allFound = true;
  for (const s of SP_STATES) {
    if (!spArrayMatch[1].includes(`"${s}"`)) {
      allFound = false;
      break;
    }
  }
  if (allFound)
    ok("SP 7 态枚举完整 (bypass/override/prepend/append/dao/custom/usernote)");
  else ng("SP 7 态枚举", "缺态");
} else ng("SP 7 态枚举", "未匹配 strategy array");

// ════════════════════════════════════════════════════════════════════════
// §3 · 二清 · web/dao_app.js 印 123 SP 7 态对齐
// ════════════════════════════════════════════════════════════════════════
console.log("\n\x1b[1m§3 · 二清 web/dao_app.js 印 123 对齐一清\x1b[0m");

const APP_SRC = readSafe(path.join(WEB, "dao_app.js"));
// 印 123 之核心: passthrough 兼老 alias bypass · usernote §3.17
const WEB_KEYWORDS = [
  '"passthrough"',
  '"usernote"',
  '"dao"',
  '"prepend"',
  '"append"',
  '"override"',
  '"custom"',
  "passthrough 兼老 alias bypass",
  "§3.17",
  "/v1/system/prompt",
];
for (const k of WEB_KEYWORDS) {
  if (APP_SRC.includes(k)) ok(`web SP 真含 ${k}`);
  else ng(`web SP ${k}`, "缺");
}

// 二清 endpoint 真存
if (APP_SRC.includes('mode === "passthrough" ? "bypass"'))
  ok("web 真送字串对齐 (mode passthrough → bypass)");
else ng("web passthrough alias", "缺转译");

// ════════════════════════════════════════════════════════════════════════
// §4 · 三清 · 三协议适配器 + 智能路由
// ════════════════════════════════════════════════════════════════════════
console.log("\n\x1b[1m§4 · 三清 三协议适配器 + 智能路由\x1b[0m");

// § 9 三协议 (OpenAI · Anthropic · Gemini)
const TRIPLE_HANDLERS = [
  "handleOpenAI",
  "handleAnthropic",
  "handleGemini",
  "handleModels",
  "handleHealth",
  "handleDashboard",
];
for (const h of TRIPLE_HANDLERS) {
  if (DP_SRC.includes(`function ${h}`) || DP_SRC.includes(`${h}(`))
    ok(`三协议 ${h}`);
  else ng(`三协议 ${h}`, "缺函");
}

// 三协议路由真存
const TRIPLE_ROUTES = [
  '"POST" && p === "/v1/chat/completions"',
  '"POST" && p === "/v1/messages"',
  '"POST" && p.startsWith("/v1beta/models/")',
];
for (const r of TRIPLE_ROUTES) {
  if (DP_SRC.includes(r)) ok(`三协议路由 ${r.split("&&")[1].trim()}`);
  else ng(`三协议路由 ${r}`, "缺");
}

// windsurf 5 endpoint (印 104 真转)
const WS_ROUTES = [
  '"/windsurf/chat"',
  '"/windsurf/status"',
  '"/windsurf/status/all"',
  '"/windsurf/quota"',
  '"/windsurf/models"',
];
for (const r of WS_ROUTES) {
  if (DP_SRC.includes(r)) ok(`windsurf 路 ${r}`);
  else ng(`windsurf 路 ${r}`, "缺");
}

// ════════════════════════════════════════════════════════════════════════
// §5 · 印号一致性 · 一气化三清之印纪
// ════════════════════════════════════════════════════════════════════════
console.log("\n\x1b[1m§5 · 印号一致性 (印 122 升至印 128)\x1b[0m");

// dao_proxy.js SEAL 常量 (印 122+ · 印 125 sp-dryrun · 主公 14:53 并行改) — 接受 印 12x 任一
if (/SEAL\s*=[\s\S]{0,80}"印 12[2-9]/.test(DP_SRC))
  ok("dao_proxy.js SEAL 含 印 12x (122+ · 双池+SP七态+wss-observe+silk双源)");
else ng("dao_proxy.js SEAL", "未含印 122+");

// dao-devin-vm/package.json version >= 0.122.0
const pkgDvm = JSON.parse(
  readSafe(path.join(DEVIN_VM, "package.json")) || "{}",
);
if (pkgDvm.version && pkgDvm.version >= "0.122.0")
  ok(`dao-devin-vm/package.json version ${pkgDvm.version} >= 0.122.0`);
else ng("dao-devin-vm version", `期 >=0.122.0 实 ${pkgDvm.version}`);

// INDEX_GUIZONG 含 印 128 · 升纪
const INDEX_SRC = readSafe(path.join(ROOT, "INDEX_GUIZONG.md"));
if (INDEX_SRC.includes("印 128") || INDEX_SRC.includes("印128"))
  ok("INDEX_GUIZONG 含 印 128 章");
else ng("INDEX_GUIZONG 印 128", "缺章 · 待加 一·戊");

// dao_proxy.js 注释首行加「末改 印 122+」(印 128 治 真断 ①)
const firstLines = DP_SRC.split("\n").slice(0, 12).join("\n");
if (
  firstLines.includes("印 122") ||
  firstLines.includes("印 124") ||
  firstLines.includes("印 128")
)
  ok("dao_proxy.js 注释首 12 行含 印 122+ 标记");
else ng("dao_proxy.js 首注", "应加「末改 印 122-127」标 · 印 128 治");

// ════════════════════════════════════════════════════════════════════════
// §6 · 一气化三清整图 docs 真存
// ════════════════════════════════════════════════════════════════════════
console.log("\n\x1b[1m§6 · 一气化三清整图 docs 真存\x1b[0m");

const arch123 = path.join(DOCS, "ARCHITECTURE_v123_yiqi_sanqing.md");
if (exists(arch123)) ok("docs/ARCHITECTURE_v123_yiqi_sanqing.md 真存");
else ng("ARCHITECTURE_v123", "缺");

// 印 127 单一真相图谱
const docs = fs
  .readdirSync(DOCS)
  .filter((f) => /印\s*127/.test(f) || /yin127/i.test(f));
if (docs.length > 0) ok(`docs/印 127*.md 真存 (${docs.length} 件)`);
else ng("印 127 docs", "缺单一真相图谱");

// 印 128 一气化三清整图 (本印立)
const docs128 = fs
  .readdirSync(DOCS)
  .filter((f) => /印\s*128/.test(f) || /yin128/i.test(f));
if (docs128.length > 0) ok(`docs/印 128*.md 真存 (${docs128.length} 件)`);
else ng("印 128 docs", "缺 一气化三清整图 · 待立");

// 守门 30 件 (含本 _seal128 + 印 129/130×2/131/132/133 + 印 ∞/∞.2/∞.3-∞.4/∞.5 · 印号承续 · 慎终若始)
//   印 129  · 真本源切号 (autoSigninWindsurf · 代主公登 windsurf)
//   印 130  · 真本源接入闭环 (admin/keys/* + OAuth Device-Flow)
//   印 131  · 中文路径子孙皆承双旗 (圣人执一 · 治 V:\道 junction)
//   印 132  · OAuth client_id 4 源智能加载链 (弱者道之用 · URL>LS>window>DEFAULT)
//   印 133  · WAM 本地真本源桥 (~/.wam → /admin/wam/{local,use} · 大曰逝逝曰远远曰反)
//   印 ∞    · 对照 tab + 上下分屏 (主公并行立 · 庄子齐物论 · 物无非彼物无非是)
//   印 ∞.2  · B 路 /dc/* 显式 devin cloud 反代 (双反代之实 · 弱者道之用)
//   印 ∞.3-∞.4 · 道动测真实证 (apiKey 前缀识 + srvUrl 优先 · 大曰逝逝曰远远曰反)
//   印 ∞.5  · 全链路闭环导中证毕 (一脚本起两子 · 我无为也而民自化)
//   印 134  · 去芜存菁 (本印之承 · _seal128 expectedSmokes 补全)
const expectedSmokes = [
  "_dao_core_syntax",
  "_three_pure_smoke",
  "_seal67_smoke",
  "_seal69_smoke",
  "_auth_smoke",
  "_seal64_smoke",
  "_seal66_smoke",
  "_seal88_smoke",
  "_seal90_smoke",
  "_seal92_smoke",
  "_seal95_smoke",
  "_seal100_smoke",
  "_seal101_smoke",
  "_seal115_smoke",
  "_seal121_smoke",
  "_seal122_smoke",
  "_seal122_watchdog_smoke",
  "_yin124_root_runtime_smoke",
  "_yin125_sp_inject_smoke",
  "_seal128_yiqi_sanqing_smoke",
  "_seal129_real_login_smoke",
  "_seal130_keys_admin_smoke",
  "_seal130_oauth_device_flow_smoke",
  "_seal131_chinese_path_spawn_smoke",
  "_seal132_client_id_loader_smoke",
  "_seal133_wam_md_real_smoke",
  "_seal_inf_parallel_smoke",
  "_seal_inf2_dc_routes_smoke",
  "_seal_inf_yiqi_real_impl_smoke",
  "_seal_inf5_closeloop_smoke",
];
const runAllSrc = readSafe(path.join(TESTS, "run_all.cjs"));
let allInRunAll = true;
for (const s of expectedSmokes) {
  if (!runAllSrc.includes(`"${s}"`)) {
    allInRunAll = false;
    break;
  }
}
if (allInRunAll) ok(`run_all.cjs 含全 ${expectedSmokes.length} 件守门`);
else ng("run_all.cjs", `期 ${expectedSmokes.length} 件 · 实少`);

// ════════════════════════════════════════════════════════════════════════
// §7 · 印 125 sp-dryrun + 印 128 v128 三栏 (主公 14:53 并行立 · 物无非彼物无非是)
// ════════════════════════════════════════════════════════════════════════
console.log(
  "\n\x1b[1m§7 · 主公并行立 · 印 125 sp-dryrun + 印 128 v128 三栏\x1b[0m",
);

// 印 125 · POST /v1/system/sp-dryrun (handleSpDryrun) — 由号返实
if (
  DP_SRC.includes("handleSpDryrun") &&
  DP_SRC.includes("/v1/system/sp-dryrun")
)
  ok(
    "dao_proxy 含 印 125 handleSpDryrun (POST /v1/system/sp-dryrun · 由号返实)",
  );
else ng("印 125 handleSpDryrun", "缺 sp-dryrun 端点");

// 印 125 SEAL 含 "sp-dryrun"
if (/SEAL\s*=[\s\S]{0,120}sp-dryrun/.test(DP_SRC))
  ok("dao_proxy SEAL 含 'sp-dryrun' 标记 (印 125 升)");
else ng("印 125 SEAL", "未含 sp-dryrun");

// _yin125 守门件真存
const yin125 = path.join(TESTS, "_yin125_sp_inject_smoke.cjs");
if (exists(yin125)) {
  ok("_yin125_sp_inject_smoke.cjs 真存 (主公 14:53 并行立)");
  const y125src = readSafe(yin125);
  if (y125src.includes("sp-dryrun") && y125src.includes("反者道之动"))
    ok("_yin125 真含 sp-dryrun 测 + 反者道之动 道义");
  else ng("_yin125 内容", "缺核心字");
} else ng("_yin125 件", "缺");

// 印 128 web/dao_app.js · renderMineV128 三栏并行常驻
if (APP_SRC.includes("renderMineV128") && APP_SRC.includes("一气化三清"))
  ok("web/dao_app.js 含 renderMineV128 + 一气化三清 (印 128 二清升)");
else ng("印 128 web renderMineV128", "缺");

// 印 128 v=128 默 (?v=128 之默 · v=101 retro · v=100 老)
if (APP_SRC.includes('v === "100"') && APP_SRC.includes('v === "101"'))
  ok("web v128 默 + v101 retro + v100 老 (三态兼容)");
else ng("web v 三态", "缺 v=101 或 v=100 retro");

// 印 128 web/index.html · v128-cols grid 三栏
const HTML_SRC = readSafe(path.join(WEB, "index.html"));
if (
  HTML_SRC.includes(".v128-cols") &&
  HTML_SRC.includes("grid-template-columns")
)
  ok("web/index.html 含 .v128-cols grid 三栏 CSS");
else ng("印 128 v128-cols CSS", "缺");

if (HTML_SRC.includes("一气化三清") && HTML_SRC.includes("物无非彼"))
  ok("web/index.html 注 一气化三清 + 物无非彼");
else ng("印 128 注", "缺道义");

// 真断 ⑤ · footer 升 印 128+ (印 129 真本源切号承续 · 反者道之动 · 物无非彼物无非是)
//   印号纪可升不可降 · 验「印 12[8-9]」或更新 · 容三清整体之承续
if (/<footer[\s\S]{0,200}印\s*1(2[8-9]|[3-9]\d)/.test(HTML_SRC))
  ok("web/index.html footer 印号升 印 128+ (真断 ⑤ 治 · 反观自身 · 容承续)");
else ng("印 128 footer", "footer 印号未升至 印 128+ (旧 印 101 等)");

// ════════════════════════════════════════════════════════════════════════
// 总
// ════════════════════════════════════════════════════════════════════════
console.log(
  "\n\x1b[1m═══ 印 128 总: \x1b[32m" +
    pass +
    " 过\x1b[0m\x1b[1m / \x1b[31m" +
    fail +
    " 失\x1b[0m\x1b[1m ═══\x1b[0m",
);

if (fail > 0) {
  console.log("\n\x1b[31m失项:\x1b[0m");
  fails.forEach((f) => console.log("  · " + f));
  process.exit(1);
} else {
  console.log(
    "\n\x1b[32m✓ 一气化三清整体真本源治通 · 物无非彼物无非是 · 反者道之动 · 道法自然\x1b[0m",
  );
  process.exit(0);
}
