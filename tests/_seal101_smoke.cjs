#!/usr/bin/env node
/**
 * 印 101 · 万法归宗 · 大道至简 · 用 + 管 二字 · smoke 测
 * ════════════════════════════════════════════════════════════════════════
 *
 *   帛书·四十八: 为道者日损 · 损之又损 · 以至于无为 · 无为而无不为
 *   帛书·三十二: 侯王若能守之 · 万物将自宾 · 民莫之令而自均焉
 *   帛书·六十四: 图难于其易 · 为大于其细 · 圣人终不为大 · 故能成其大
 *
 * 主公诏 (2026-05-14 13:35 + 15:23):
 *   「反者道之动 · 重新锚定本源 · 重新解构本源底层需求 · 推进到底」
 *   「专注于用户最终管理使用页面 · 万法归宗 · 大道至简 · 彻底整合」
 *   「反代 windsurf+devin · 提示词综合管理 · 反代 api 管理 ·
 *    wam 切号管理 · agent 交互页面测试使用」
 *   「为学者日益 · 为道者日损 · 从根本底层需求出发 · 大道至简」
 *   「代替用户之一切 · 测试使用验证一切 · 推进到极 · 实现一切」
 *
 * 守门 (全离网 · 0 deps · Node 内置):
 *   §1  dao_app.js syntax 真解析 (沿用印 67 沙箱)
 *   §2  v101 必出函 (renderMineV101 + 子 render * 11)
 *   §3  enterMine 默走 v101 + ?v=100 fallback (反向兼容)
 *   §4  index.html: #mine-v101 容器 + 旧 .mine-cols 隐 + script 引序
 *   §5  CSS v101-* 类齐全 (顶栏/用区/抽屉)
 *   §6  五大功能落地映射 (反代/SP/API/切号/测试)
 *   §7  用 + 管 二字守 (用 80% / 管 抽屉)
 *   §8  道义守 (帛书四十八/三十二/六十四 + 反者道之动)
 *
 *   零依赖 · ~3s · 仅 Node 内置 (fs/path)
 */

"use strict";
const fs = require("fs");
const path = require("path");
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

console.log("═══ 印 101 万法归宗 · 大道至简 · 用 + 管 · smoke 测 ═══");

// ───────────────────────────────────────────────────────────────────────
// §1 · dao_app.js syntax 真解析
// ───────────────────────────────────────────────────────────────────────
head("§1 syntax · dao_app.js (印 101 视图层后)");
const appPath = path.join(ROOT, "web", "dao_app.js");
ok(fs.existsSync(appPath), "§1.1 dao_app.js 在");
const appSrc = fs.readFileSync(appPath, "utf8");
ok(
  appSrc.length > 80000,
  "§1.2 文 ≥ 80000 字 (got " + appSrc.length + " · 印 101 后应膨胀)",
);

// 用 Node 内置 require + 临时 wrapper 真解析 (IIFE 模式)
let parseOk = false;
try {
  // wrap in function 测语法 (不执行 DOM)
  new Function(
    "daoSync",
    "window",
    "document",
    "navigator",
    "location",
    "AbortSignal",
    "crypto",
    appSrc,
  );
  parseOk = true;
  ok(true, "§1.3 dao_app.js 真 parse (印 101 视图层语法正)");
} catch (e) {
  ok(false, "§1.3 parse 失: " + e.message);
}

// ───────────────────────────────────────────────────────────────────────
// §2 · v101 必出函
// ───────────────────────────────────────────────────────────────────────
head("§2 v101 必出函 (主面 + 抽屉 + 业务复用)");
const requiredFns = [
  // 总入口
  "function renderMineV101",
  // 顶栏
  "function renderTopBar",
  // 用区
  "function renderUseArea",
  "function makeUseTab",
  "function renderUseTabContent",
  "function renderUseTab_chat",
  "function renderUseTab_iframe",
  "function renderUseTab_batch",
  // chat 包装 (复用 sendChat)
  "async function sendChatV101",
  // 批跑
  "async function runBatch",
  // 抽屉
  "function renderDrawer",
  "function makeDrawerTab",
  "function openDrawer",
  "function closeDrawer",
  "function toggleDrawer",
  "function refreshDrawerTabs",
  "function renderDrawerContent",
  "function renderDrawer_acct",
  "function renderDrawer_sp",
  "function renderDrawer_endpt",
  "function renderDrawer_test",
];
requiredFns.forEach((fn) => {
  ok(
    appSrc.includes(fn),
    "§2." +
      (requiredFns.indexOf(fn) + 1).toString().padStart(2, "0") +
      " " +
      fn,
  );
});

// 全局状态
//   印 ∞ 升: __useTab 默 'parallel' (上 iframe + 下 chat · 物无非彼 物无非是)
//   印 131.1 治 _seal101 同步 (自是返彼 · 庄子齐物论 · 帛书四十八「日损」)
ok(
  /let __useTab\s*=\s*"parallel"/.test(appSrc),
  "§2.x __useTab 默 'parallel' (上 iframe + 下 chat · 印 ∞ 升)",
);
ok(
  /let __drawerOpen\s*=\s*null/.test(appSrc),
  "§2.y __drawerOpen 默 null (抽屉默收)",
);

// ───────────────────────────────────────────────────────────────────────
// §3 · enterMine 默走 v101 + ?v=100 fallback
// ───────────────────────────────────────────────────────────────────────
// 印 128 · 他清升路: 默 → v128 一气化三清 · v=101 → renderMineV101 · v=100 → 旧三栏
head("§3 enterMine: v=100 旧 · v=101 印101 · 默 v=128 印128 (印 128 升路)");
ok(
  /params\.get\("v"\)/.test(appSrc) && /v\s*===\s*"100"/.test(appSrc),
  "§3.1 enterMine 检 v === '100' fallback (印 128 兼新写)",
);
ok(
  /v\s*===\s*"101"[\s\S]{0,80}renderMineV101\(\)|\}\s*else\s*\{\s*renderMineV101\(\);\s*\}/.test(
    appSrc,
  ),
  "§3.2 v=101 走 renderMineV101 (印 101 路 · 兼默或 else-if)",
);
ok(
  /renderLeft\(\);[\s\S]{0,80}renderMid\(\);[\s\S]{0,80}renderRight\(\);/.test(
    appSrc,
  ),
  "§3.3 ?v=100 fallback 仍调 旧 left/mid/right (反向兼容)",
);

// ───────────────────────────────────────────────────────────────────────
// §4 · index.html · #mine-v101 容器 + 旧 .mine-cols 隐 + 引序
// ───────────────────────────────────────────────────────────────────────
head("§4 index.html · v101 容器 + 旧三栏隐藏");
const htmlPath = path.join(ROOT, "web", "index.html");
ok(fs.existsSync(htmlPath), "§4.1 index.html 在");
const html = fs.readFileSync(htmlPath, "utf8");
ok(
  /<div\s+id="mine-v101"\s+class="mine-v101">/.test(html),
  "§4.2 #mine-v101 容器在",
);
ok(
  /<div class="mine-cols" style="display: none">/.test(html),
  "§4.3 旧 .mine-cols 默隐藏 (只 ?v=100 显)",
);
// script 引序 (印 100 已验过)
const order101 =
  /dao_github_sync\.js[\s\S]+?dao_bootstrap\.js[\s\S]+?dao_app\.js/;
ok(
  order101.test(html),
  "§4.4 script 引序: dao_github_sync → dao_bootstrap → dao_app (印 100 守)",
);

// ───────────────────────────────────────────────────────────────────────
// §5 · CSS v101-* 类齐全
// ───────────────────────────────────────────────────────────────────────
head("§5 CSS · v101-* 类齐 (顶栏/用区/抽屉)");
const cssClasses = [
  ".mine-v101",
  ".v101-topbar",
  ".v101-topbar-l",
  ".v101-topbar-r",
  ".v101-dot",
  ".v101-meta",
  ".v101-chip",
  ".v101-btn",
  ".v101-use",
  ".v101-use-tabs",
  ".v101-tab",
  ".v101-use-content",
  ".v101-iframe",
  ".v101-batch-table",
  ".v101-drawer",
  ".v101-drawer-tabs",
  ".v101-drawer-content",
  ".v101-drawer-section",
  ".v101-acct-table",
  ".v101-sp-row",
  ".v101-test-out",
];
cssClasses.forEach((cls) => {
  ok(
    html.includes(cls),
    "§5." +
      (cssClasses.indexOf(cls) + 1).toString().padStart(2, "0") +
      " CSS " +
      cls,
  );
});

// 抽屉折叠机制
ok(
  /\.v101-drawer\s*{[^}]*max-height:\s*0/.test(html),
  "§5.x 抽屉默 max-height: 0 (收)",
);
ok(
  /\.v101-drawer\.open\s*{[^}]*max-height:\s*55vh/.test(html),
  "§5.y 抽屉 .open 时 max-height: 55vh",
);
ok(/transition:\s*max-height/.test(html), "§5.z 抽屉过渡动画");

// ───────────────────────────────────────────────────────────────────────
// §6 · 五大功能落地映射 (主公诏五大)
// ───────────────────────────────────────────────────────────────────────
head("§6 五大功能落地 (反代/SP/API/切号/测试)");
// ① 反代 ws+devin → iframe tab + vmUrl
ok(
  /chat\.windsurf\.ai/.test(appSrc) && /app\.devin\.ai/.test(appSrc),
  "§6.1 ① 反代 ws+devin: iframe tab 真切 chat.windsurf.ai / app.devin.ai",
);
ok(/iframeSite/.test(appSrc), "§6.2 iframeSite 状态字 (windsurf | devin)");

// ② 提示词综合管理 → renderDrawer_sp + spLibrary
ok(
  /D\.spLibrary/.test(appSrc) && /spLibrary\.push/.test(appSrc),
  "§6.3 ② SP 综合: SP 库 (D.spLibrary)",
);
ok(
  /syncSpModeToVm/.test(appSrc),
  "§6.4 SP 三模 (passthrough/dao/custom) 同步到 VM",
);
ok(/存为模板/.test(appSrc), "§6.5 SP 库存模板");

// ③ 反代 API 管理 → 顶栏 + renderDrawer_endpt
ok(
  /复 Base URL/.test(appSrc) && /vmUrl \+ "\/v1"/.test(appSrc),
  "§6.6 ③ API 管理: 复 Base URL 一笔",
);
ok(/Auth Key.*sk-ws-proxy/.test(appSrc), "§6.7 Auth Key 管理 (sk-ws-proxy-*)");

// ④ WAM 切号管理 → renderDrawer_acct + 顶栏 acctChip
ok(
  /D\.accounts/.test(appSrc) && /D\.activeEmail/.test(appSrc),
  "§6.8 ④ WAM 切号: accounts + activeEmail 字段",
);
ok(
  /probeCloudFleet/.test(appSrc),
  "§6.9 云端 daemon 池入号节 (印 95/100 统一)",
);

// ⑤ agent 交互测试 → renderUseTab_batch
ok(
  /D\.batch\b/.test(appSrc) && /D\.batch\.prompts/.test(appSrc),
  "§6.10 ⑤ agent 测试: 批跑题集",
);
ok(/通过率:/.test(appSrc), "§6.11 通过率统计");
ok(
  /v1\/chat\/completions/.test(appSrc),
  "§6.12 批跑走 vmUrl /v1/chat/completions",
);

// ───────────────────────────────────────────────────────────────────────
// §7 · 用 + 管 二字守 (帛书四十八「为道日损」之体)
// ───────────────────────────────────────────────────────────────────────
head("§7 用 + 管 二字守 (大道至简)");
// 用区 4 tab (parallel/chat/iframe/batch · 印 ∞ 加 parallel 默)
// 印 131.1 治 · 容 prettier 多行 (makeUseTab(\n  "parallel" · 同印 128 容承续)
ok(
  /makeUseTab\(\s*"parallel"[^\)]*\)/.test(appSrc) &&
    /makeUseTab\(\s*"chat"[^\)]*\)/.test(appSrc) &&
    /makeUseTab\(\s*"iframe"[^\)]*\)/.test(appSrc) &&
    /makeUseTab\(\s*"batch"[^\)]*\)/.test(appSrc),
  "§7.1 用区 4 tab: parallel / chat / iframe / batch (印 ∞ parallel 默)",
);
// 管抽屉 4 节 (acct/sp/endpt/test)
ok(
  /makeDrawerTab\("acct"/.test(appSrc) &&
    /makeDrawerTab\("sp"/.test(appSrc) &&
    /makeDrawerTab\("endpt"/.test(appSrc) &&
    /makeDrawerTab\("test"/.test(appSrc),
  "§7.2 管抽屉 4 节: acct / sp / endpt / test",
);
// 默 parallel tab (用户进默见 iframe+chat 对照 · 印 ∞ 升 · 物无非彼)
ok(
  /let __useTab\s*=\s*"parallel"/.test(appSrc),
  "§7.3 默 parallel tab (上 iframe · 下 chat · 印 ∞ 物无非彼)",
);
// 默 抽屉收 (用 80% / 管 默隐)
ok(
  /let __drawerOpen\s*=\s*null/.test(appSrc),
  "§7.4 默 抽屉收 (用 80% 屏 · 管 按需)",
);

// 顶栏一行三态 (反代活/号/模型)
ok(/反代活/.test(appSrc) && /反代未设/.test(appSrc), "§7.5 顶栏 ① 反代活否");
ok(/号: /.test(appSrc) && /accts\.length/.test(appSrc), "§7.6 顶栏 ② 当前号");
ok(
  /curModel/.test(appSrc) && /isB \?/.test(appSrc),
  "§7.7 顶栏 ③ 当前模型 (A/B 路染色)",
);

// ───────────────────────────────────────────────────────────────────────
// §8 · 道义守
// ───────────────────────────────────────────────────────────────────────
head("§8 道义守 (帛书四十八/三十二/六十四)");
ok(
  /为道者日损/.test(appSrc) || /日损之/.test(appSrc),
  "§8.1 帛书四十八「为道者日损」在 dao_app.js",
);
ok(
  /民莫之令而自均/.test(appSrc) || /民莫之令/.test(appSrc),
  "§8.2 帛书三十二「民莫之令而自均」在",
);
ok(
  /图难于其易/.test(appSrc) || /图难/.test(appSrc),
  "§8.3 帛书六十四「图难于其易」在",
);
ok(/反者道之动/.test(appSrc), "§8.4 「反者道之动」在 (主公诏)");
ok(/万法归宗/.test(appSrc), "§8.5 「万法归宗」立印");
ok(/大道至简/.test(appSrc), "§8.6 「大道至简」立印");
// 不破印 100 自举
ok(
  /印 100/.test(appSrc) || /印100/.test(appSrc),
  "§8.7 印 100 仍引 (反向兼容承)",
);
// 不破业务函
ok(
  /sendChat\b/.test(appSrc) && /addAccount\b/.test(appSrc),
  "§8.8 业务函 sendChat / addAccount 复用",
);
ok(
  /probeAccount\b/.test(appSrc) && /probeAll\b/.test(appSrc),
  "§8.9 业务函 probeAccount / probeAll 复用",
);
ok(
  /syncSpModeToVm\b/.test(appSrc) && /testVm\b/.test(appSrc),
  "§8.10 业务函 syncSpModeToVm / testVm 复用",
);

// ═══ 总览 ════════════════════════════════════════════════════════════
console.log("\n═══ 印 101 smoke 总览 ═══");
console.log("  通: " + passed);
if (failed > 0) {
  console.log("  ✗ 失: " + failed);
  fails.forEach((f) => console.log("    - " + f));
  console.log("\n✗ 印 101 smoke 失");
  process.exit(1);
} else {
  console.log(
    "✓ 印 101 smoke 全通 · 万法归宗 · 大道至简 · 用 + 管 · 反者道之动",
  );
  console.log(
    "  帛书·四十八: 为道者日损 · 损之又损 · 以至于无为 · 无为而无不为",
  );
  console.log("  帛书·三十二: 侯王若能守之 · 万物将自宾 · 民莫之令而自均焉");
  console.log(
    "  帛书·六十四: 图难于其易 · 为大于其细 · 圣人终不为大 · 故能成其大",
  );
}
