#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
// _seal67_smoke.cjs · 印 67 · 道独立体公网入口守门 · 道并行而不悖
// ═══════════════════════════════════════════════════════════════════════
//
// 帛书·二十二:   圣人执一 · 以为天下牧
// 帛书·四十八:   为道者日损 · 损之又损 · 以至于无为 · 无为而无不为
// 帛书·六十四:   慎终若始 · 则无败事
//
// 主公命: '道法自然 · 无感无为 · 一登录即一切' — 守此道义 · 防再次散乱.
//
// 验:
//   [A] web/index.html 三态融合
//       · 三 section: state-gate / state-onboarding / state-mine
//       · GATE: gate-pat 入框 / gate-btn-login 钮 / 帛书四十八引
//       · ONBOARDING: 4 步骤 (fork / pages / gist / redirect)
//       · MINE: 三栏锚 mine-left / mine-mid / mine-right
//       · 顶栏锚 hdr-host / hdr-login / hdr-gist / hdr-logout
//       · 双 script 加载 dao_github_sync.js + dao_app.js
//       · 印 67 印记
//
//   [B] web/dao_github_sync.js 同步层
//       · IIFE + window.daoSync 暴露
//       · 必备方法: setPat/getPat/hasPat/clearPat/whoami/ensureFork/
//                  ensurePages/findOrCreateGist/readGist/writeGist/
//                  detectSite/forkPagesUrl/defaultData
//       · 常量: UPSTREAM_OWNER='dao-genesis' / UPSTREAM_REPO='windsurf-assistant'
//       · 不外发任何字节到 dao-genesis (除 fork/Pages 元操作)
//       · Node syntax check pass
//
//   [C] web/dao_app.js 交互层
//       · IIFE 包络
//       · 主入口: DOMContentLoaded → boot()
//       · 三态渲染: renderGate / renderOnboarding / enterMine
//       · 三栏渲染: renderLeft / renderMid / renderRight
//       · 数据同步: markDirty / saveNow (debounce 1.5s)
//       · Chat 流: sendChat (SSE 增量 + AbortController)
//       · WAM: addAccount / probeAccount / probeAll / rotateActive
//       · SP 三模: passthrough / dao / custom
//       · Node syntax check pass
//
//   [D] (cleanup-2026-05-16 · legacy.html + _web_static_audit 同损 · 此节已弃)
//       · 文件存
//       · 含旧 5-tab (Setup/Chat/API/Deploy/Docs)
//
//   [E] 三清不悖 (印 65/66 仍立)
//       · README 含 '一气化三清' / '反代 API' / '切号 WAM' / '提示词反代'
//       · packages/dao-core / packages/wam / packages/dao-proxy-min 俱在
//
// 零依赖 · 纯文件读 · 无网络 · 无浏览器
// ═══════════════════════════════════════════════════════════════════════
"use strict";

const fs = require("fs");
const path = require("path");
const cp = require("child_process");

const ROOT = path.join(__dirname, "..");
let pass = 0,
  fail = 0;

function ok(cond, label) {
  if (cond) {
    pass++;
    console.log("  ✓ " + label);
  } else {
    fail++;
    console.error("  ✗ " + label);
  }
}
function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}
function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}
function nodeSyntax(rel) {
  try {
    cp.execSync('node --check "' + path.join(ROOT, rel) + '"', {
      stdio: "pipe",
    });
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      err: (e.stderr || e.message || "").toString().slice(0, 400),
    };
  }
}

console.log("═══ 印 67 · 道独立体公网入口守门 · 道并行而不悖 ═══\n");

// ── [A] web/index.html 三态融合 ──────────────────────────────────────
console.log("[A] web/index.html 三态融合");
ok(exists("web/index.html"), "web/index.html 存");
const idx = read("web/index.html");

// 三 section
ok(/id="state-gate"/.test(idx), "GATE state-gate 段在");
ok(/id="state-onboarding"/.test(idx), "ONBOARDING state-onboarding 段在");
ok(/id="state-mine"/.test(idx), "MINE state-mine 段在");

// GATE 关键锚
ok(/id="gate-pat"/.test(idx), "GATE 输入 gate-pat 在");
ok(/id="gate-btn-login"/.test(idx), "GATE 钮 gate-btn-login 在");
// (cleanup-2026-05-16 · legacy.html 旁支已损 · gate-link-legacy 锚同损)
ok(idx.includes("帛书《老子》") || idx.includes("帛书"), "GATE 含帛书引");
ok(
  /为学者日益.*闻道者日损/.test(idx) || /为道者日损/.test(idx),
  "GATE 含 '日损' 道义",
);

// ONBOARDING 4 步骤
ok(/id="step-fork"/.test(idx), "ONBOARDING § fork 在");
ok(/id="step-pages"/.test(idx), "ONBOARDING § pages 在");
ok(/id="step-gist"/.test(idx), "ONBOARDING § gist 在");
ok(/id="step-redirect"/.test(idx), "ONBOARDING § redirect 在");
ok(/id="onboard-link"/.test(idx), "ONBOARDING 跳链 onboard-link 在");

// MINE 三栏锚
ok(/id="mine-left"/.test(idx), "MINE 左栏 mine-left 在 (API + SP)");
ok(/id="mine-mid"/.test(idx), "MINE 中栏 mine-mid 在 (WAM)");
ok(/id="mine-right"/.test(idx), "MINE 右栏 mine-right 在 (chat)");

// 顶栏 (常驻)
ok(/id="hdr-host"/.test(idx), "顶栏 hdr-host 在");
ok(/id="hdr-login"/.test(idx), "顶栏 hdr-login 在");
ok(/id="hdr-gist"/.test(idx), "顶栏 hdr-gist 在 (同步状态)");
ok(/id="hdr-logout"/.test(idx), "顶栏 hdr-logout 钮 (清 PAT) 在");
ok(/id="hdr-link-upstream"/.test(idx), "顶栏 源 ↗ 链在");

// 脚本加载
ok(
  /<script src="dao_github_sync\.js"><\/script>/.test(idx),
  "<script> dao_github_sync.js 加载",
);
ok(
  /<script src="dao_app\.js"><\/script>/.test(idx),
  "<script> dao_app.js 加载",
);

// 零外部依赖 (无 CDN / 无 npm)
ok(!/cdn\.[a-z]+\.com/i.test(idx), "无 CDN 引");
ok(!/unpkg\.com/i.test(idx), "无 unpkg 引");
ok(!/jsdelivr/i.test(idx), "无 jsdelivr 引");

// 印 67 印记
ok(/印 67/.test(idx), "印 67 印记在");

// toast 容器
ok(/id="toast"/.test(idx), "toast 容器在");

// ── [B] web/dao_github_sync.js 同步层 ─────────────────────────────────
console.log("\n[B] web/dao_github_sync.js 同步层");
ok(exists("web/dao_github_sync.js"), "web/dao_github_sync.js 存");
const sync = read("web/dao_github_sync.js");

// IIFE
ok(
  /^\(function\s*\(\)\s*\{/m.test(sync) || /^\(function/.test(sync.trim()),
  "IIFE 包络 (无全局污染)",
);
// window.daoSync 暴露
ok(/window\.daoSync\s*=/.test(sync), "window.daoSync 暴露");

// 必备方法
const reqMethods = [
  "setPat",
  "getPat",
  "hasPat",
  "clearPat",
  "whoami",
  "ensureFork",
  "ensurePages",
  "findOrCreateGist",
  "readGist",
  "writeGist",
  "getState",
  "setState",
  "getCache",
  "setCache",
  "detectSite",
  "forkPagesUrl",
  "defaultData",
];
for (const m of reqMethods) {
  ok(new RegExp("\\b" + m + "\\s*[\\(:]").test(sync), "方法 " + m + " 存");
}

// 常量
ok(
  /UPSTREAM_OWNER\s*=\s*['"]dao-genesis['"]/.test(sync),
  "UPSTREAM_OWNER='dao-genesis'",
);
ok(
  /UPSTREAM_REPO\s*=\s*['"]windsurf-assistant['"]/.test(sync),
  "UPSTREAM_REPO='windsurf-assistant'",
);
ok(/api\.github\.com/.test(sync), "调 api.github.com (OAuth Bearer)");
ok(
  /Bearer\s*['"\s+]*\s*\+?\s*pat/i.test(sync) ||
    /['"]Authorization['"]\s*\]\s*=\s*['"]Bearer/.test(sync),
  "用 Bearer + PAT 鉴",
);

// schema 关键字段 (确保 dao.json 默认含 vmUrl/accounts/sp 等)
ok(/vmUrl/.test(sync), "schema 含 vmUrl");
ok(/vmAuthKey/.test(sync), "schema 含 vmAuthKey");
ok(/accounts/.test(sync), "schema 含 accounts");
ok(/sp:/.test(sync) || /['"]sp['"]\s*:/.test(sync), "schema 含 sp (SP 管理)");
ok(/passthrough/.test(sync), "SP mode 含 passthrough");

// 道义印 (帛书章)
ok(/帛书|老子|道法自然|无为/.test(sync), "源含道义印");
ok(/印 67/.test(sync), "印 67 印记在");

// Node syntax
const r1 = nodeSyntax("web/dao_github_sync.js");
ok(r1.ok, "node --check syntax OK" + (r1.ok ? "" : " · " + r1.err));

// ── [C] web/dao_app.js 交互层 ──────────────────────────────────────
console.log("\n[C] web/dao_app.js 交互层");
ok(exists("web/dao_app.js"), "web/dao_app.js 存");
const app = read("web/dao_app.js");

// IIFE
ok(
  /^\(function\s*\(\)\s*\{/m.test(app) || /^\(function/.test(app.trim()),
  "IIFE 包络",
);

// 主入口
ok(/DOMContentLoaded/.test(app), "主入口 DOMContentLoaded 在");
ok(/\bboot\s*\(/.test(app), "boot() 函数在");

// 三态渲染
ok(/\brenderGate\s*\(/.test(app), "renderGate() 在");
ok(/\brenderOnboarding\s*\(/.test(app), "renderOnboarding() 在");
ok(/\benterMine\s*\(/.test(app), "enterMine() 在");

// 三栏渲染
ok(/\brenderLeft\s*\(/.test(app), "renderLeft() (左 API+SP) 在");
ok(/\brenderMid\s*\(/.test(app), "renderMid() (中 WAM) 在");
ok(/\brenderRight\s*\(/.test(app), "renderRight() (右 chat) 在");

// 同步层调用 (印 100 后 · ensureFork/ensurePages 迁至 dao_bootstrap.js)
//   测扩范围至 dao_app.js + dao_bootstrap.js (若在 · 印 100 印记)
const bootstrap = exists("web/dao_bootstrap.js")
  ? read("web/dao_bootstrap.js")
  : "";
const webApp = app + "\n/* === dao_bootstrap.js === */\n" + bootstrap;
ok(/daoSync\.whoami\s*\(/.test(webApp), "调 daoSync.whoami");
ok(
  /daoSync\.ensureFork\s*\(/.test(webApp),
  "调 daoSync.ensureFork (印 100: 迁 dao_bootstrap)",
);
ok(
  /daoSync\.ensurePages\s*\(/.test(webApp),
  "调 daoSync.ensurePages (印 100: 迁 dao_bootstrap)",
);
ok(
  /daoSync\.findOrCreateGist\s*\(/.test(webApp),
  "调 daoSync.findOrCreateGist",
);
ok(/daoSync\.readGist\s*\(/.test(webApp), "调 daoSync.readGist");
ok(/daoSync\.writeGist\s*\(/.test(webApp), "调 daoSync.writeGist");

// 同步 debounce
ok(/markDirty\s*\(/.test(app), "markDirty() 在");
ok(/saveNow\s*\(/.test(app), "saveNow() 在");
ok(/setTimeout/.test(app) && /1500/.test(app), "debounce 1500ms 在");

// Chat 流
ok(/\bsendChat\s*\(/.test(app), "sendChat() 在");
ok(/AbortController/.test(app), "AbortController 在 (可中止)");
ok(/\/v1\/chat\/completions/.test(app), "调 /v1/chat/completions");
ok(/data:\s*\[DONE\]|\[DONE\]/.test(app), "SSE [DONE] 终止识");

// WAM 切号
ok(/\baddAccount\s*\(/.test(app), "addAccount() 在");
ok(/\bprobeAccount\s*\(/.test(app), "probeAccount() 在");
ok(/\bprobeAll\s*\(/.test(app), "probeAll() 在");
ok(/\brotateActive\s*\(/.test(app), "rotateActive() 在");

// SP 三模
ok(/passthrough/.test(app), "SP 模 passthrough 在");
ok(/['"]dao['"]/.test(app) || /'dao'/.test(app), "SP 模 dao 在");
ok(/['"]custom['"]/.test(app) || /'custom'/.test(app), "SP 模 custom 在");

// Devin VM bootstrap 命令生成
ok(/genDevinCmd\s*\(/.test(app), "genDevinCmd() (一键令) 在");
ok(/devin-bootstrap\.sh/.test(app), "命令引 devin-bootstrap.sh");

// 道义印
ok(/帛书|老子|道法自然|无为/.test(app), "源含道义印");
ok(/印 67/.test(app), "印 67 印记在");

// Node syntax
const r2 = nodeSyntax("web/dao_app.js");
ok(r2.ok, "node --check syntax OK" + (r2.ok ? "" : " · " + r2.err));

// ── [D] (cleanup-2026-05-16 · legacy.html 旁支损 · 此节已弃) ───────

// ── [E] 三清不悖 (印 65/66 仍立) ────────────────────────────────────
console.log("\n[E] 三清不悖 (印 65/66 仍立)");
ok(exists("README.md"), "README.md 存");
const readme = read("README.md");
ok(/一气化三清/.test(readme), "README 含 '一气化三清'");
ok(/反代\s*API/.test(readme) || /dao-core/.test(readme), "README 含反代 API");
ok(/切号|wam/i.test(readme), "README 含 切号/WAM");
ok(/提示词|dao-proxy-min/.test(readme), "README 含 提示词/dao-proxy-min");
ok(exists("packages/dao-core"), "packages/dao-core 在");
ok(exists("packages/wam"), "packages/wam 在");
ok(exists("packages/dao-proxy-min"), "packages/dao-proxy-min 在");

// ──────────────────────────────────────────────────────────────────
console.log("\n═══ 印 67 守门完毕 · pass=" + pass + " fail=" + fail + " ═══");
if (fail > 0) {
  console.error("\n✗ 道未归一 · 见上 · 修之于易");
  process.exit(1);
} else {
  console.log("\n✓ 道独立体公网入口归一 · 道法自然 · 无为而无不为 · 印 67 安");
  process.exit(0);
}
