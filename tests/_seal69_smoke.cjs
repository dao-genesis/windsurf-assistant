#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
// _seal69_smoke.cjs · 印 69 · 公网用户视角全审 · 慎终若始 · 则无败事
// ═══════════════════════════════════════════════════════════════════════
//
// 帛书·六十四:   慎终若始 · 则无败事
// 帛书·六十三:   为之于其未有也 · 治之于其未乱也
// 帛书·七十一:   知不知 · 尚矣 · 不知不知 · 病矣
//
// 主公命: '反者 道之动也 · 代如所有公网用户使用测试一切 · 发现一切问题 · 解决一切'.
//
// 印 67 推 GitHub Pages, 但实测访 https://zhouyoukang.github.io/windsurf-assistant/
// 返 HTTP 404 — 公网用户连 GATE 首屏都进不去. 反向以公网用户视角端到端审,
// 发四症一并修.
//
// 验:
//   [A] deploy-pages.yml workflow (致命修)
//       · configure-pages@v5 (非 v4)
//       · enablement: true   首次跑自动启 Pages 站点
//       · paths 含 '.github/workflows/deploy-pages.yml'  改本 yml 即触发
//       · cancel-in-progress: false (生产 deploy 不被新 commit 中止)
//       · if: github.repository_owner == 'zhouyoukang'   fork 跑空守护
//
//   [B] dao_app.js el() helper 修 (修[1])
//       · 含 'k === "checked" || k === "disabled"' 之 boolean DOM property 通道
//       · 旧 setTimeout 0 trick 之"checked attr trick"注释已废
//
//   [C] dao_app.js messages 过滤合一 (修[2])
//       · 不存双 .filter().filter() 冗余链
//       · 单 filter 排 streaming 占位 + error 行
//
//   [D] dao_app.js sendChat catch 不篡 role (修[3])
//       · catch 块不再有 'last.role = "error"' (致下次 chat 死循环)
//       · 改用 'last.error = true' flag · 保 role='assistant'
//
//   [E] dao_app.js renderMsg .error 视觉标识 (修[4])
//       · class 检 m.error 加 'msg-error'
//       · index.html 中 .msg-error CSS 在
//
//   [F] 印记升级
//       · index.html / dao_app.js 含 '印 67/69' 或 '印 69'
//       · 帛书印 (慎终若始) 在
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

function ok(cond, msg) {
  if (cond) {
    pass++;
    console.log("  ✓ " + msg);
  } else {
    fail++;
    console.log("  ✗ " + msg);
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
    cp.execFileSync(process.execPath, ["--check", path.join(ROOT, rel)], {
      stdio: "pipe",
    });
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      err: (e.stderr || e.message || "").toString().slice(0, 200),
    };
  }
}

console.log("═══ _seal69_smoke · 印 69 · 公网用户视角全审 ═══\n");

// ── [A] deploy-pages.yml workflow 致命修 ──────────────────────────
console.log("[A] deploy-pages.yml · 致命修 (Pages 404 根治)");
ok(exists(".github/workflows/deploy-pages.yml"), "workflow 存");
const wf = read(".github/workflows/deploy-pages.yml");
ok(/configure-pages@v5/.test(wf), "configure-pages 升 v5");
// 仅查非注释行 (注释中的 "v4 → v5" 解释允许)
const wfActiveLines = wf
  .split(/\r?\n/)
  .filter((l) => !l.trim().startsWith("#"))
  .join("\n");
ok(
  !/configure-pages@v4/.test(wfActiveLines),
  "无残 configure-pages@v4 引用 (非注释)",
);
// 印 69 二次治: enablement:true 要 PAT (GitHub 硬规), 改走官方 starter 标准 · 假定已启 Pages
ok(
  /'\.github\/workflows\/deploy-pages\.yml'/.test(wf) ||
    /\.github\/workflows\/deploy-pages\.yml/.test(wf),
  "paths 含 workflow 自身 (改即触发)",
);
ok(
  /cancel-in-progress:\s*false/.test(wf),
  "cancel-in-progress: false (生产 deploy 不中止)",
);
ok(
  /repository_owner\s*==\s*'dao-genesis'/.test(wf),
  "if owner == dao-genesis (fork 跑空守护)",
);
ok(/印 69/.test(wf), "印 69 印记在 workflow");
// 道氾印 (官方 starter 假定 Pages 已启 · dao-genesis 一次性 setup)
ok(
  /dao-genesis\/windsurf-assistant\/settings\/pages/.test(wf),
  "workflow 注释含 setup URL (dao-genesis 一次启 30s)",
);

// ── [B] dao_app.js · el() helper 修[1] ────────────────────────────
console.log("\n[B] dao_app.js · el() boolean DOM property 修[1]");
ok(exists("web/dao_app.js"), "dao_app.js 存");
const app = read("web/dao_app.js");
ok(/k\s*===\s*["']checked["']/.test(app), "el() 检 k === 'checked'");
ok(/k\s*===\s*["']disabled["']/.test(app), "el() 检 k === 'disabled'");
ok(/k\s*===\s*["']readOnly["']/.test(app), "el() 检 k === 'readOnly'");
ok(
  /if\s*\(\s*attrs\[k\]\s*\)\s*e\[k\]\s*=\s*true/.test(app),
  "boolean prop: e[k]=true (非 setAttribute)",
);
// 老 setTimeout trick 不存
ok(!/checked attr trick/.test(app), "废 setTimeout 0 之 checked trick 注");

// ── [C] dao_app.js · messages 过滤合一 修[2] ──────────────────────
console.log("\n[C] dao_app.js · messages 过滤合一 修[2]");
// 旧双 filter 不存
ok(
  !/!m\.streaming\s*\|\|\s*m\.content/.test(app),
  "旧 (!m.streaming || m.content) 已去",
);
ok(
  !/m\.role\s*===\s*["']assistant["']\s*&&\s*m\.streaming/.test(app),
  "旧 (role==assistant && streaming) 已去",
);
// 新单 filter
ok(
  /!m\.streaming\s*&&\s*!m\.error/.test(app),
  "新单 filter (!m.streaming && !m.error) 在",
);

// ── [D] dao_app.js · catch 不篡 role 修[3] ────────────────────────
console.log("\n[D] dao_app.js · sendChat catch 不篡 role='error' 修[3]");
ok(
  !/last\.role\s*=\s*["']error["']/.test(app),
  "无 last.role='error' (旧 bug)",
);
ok(/last\.error\s*=\s*true/.test(app), "新 last.error=true flag 在");

// ── [E] dao_app.js · renderMsg .error 视觉标识 修[4] ──────────────
console.log("\n[E] dao_app.js · renderMsg msg-error 视觉 修[4]");
ok(
  /m\.error\s*\?\s*["']error["']\s*:\s*m\.role/.test(app),
  "renderMsg: m.error ? 'error' : m.role",
);

// index.html 有 .msg-error CSS
const html = read("web/index.html");
ok(/\.msg-error\s*\{/.test(html), "index.html 内 .msg-error CSS 定义在");

// ── [F] 印记升级 + 道义守 ─────────────────────────────────────────
console.log("\n[F] 印记升级 67 → 67/69 + 道义守");
ok(/印 6[79]/.test(app), "dao_app.js 含印 67 或 69 印记");
ok(/印 69/.test(app), "dao_app.js 含印 69 修[*] 印记");
ok(/印 6[79]/.test(html), "index.html 含印 67 或 69 印记");
ok(
  /慎终若始|无败事|为之于其未有/.test(app) ||
    /慎终若始|无败事|为之于其未有/.test(
      read(".github/workflows/deploy-pages.yml"),
    ),
  "帛书印 (慎终若始) 在",
);

// ── [G] 不破坏现有契约 (Node syntax + 印 67 守门未折) ─────────────
console.log("\n[G] 不破坏 (印 67 守门 + Node syntax)");
const r1 = nodeSyntax("web/dao_app.js");
ok(r1.ok, "dao_app.js node --check OK" + (r1.ok ? "" : " · " + r1.err));
const r2 = nodeSyntax("web/dao_github_sync.js");
ok(r2.ok, "dao_github_sync.js node --check OK" + (r2.ok ? "" : " · " + r2.err));
// 印 67 守门钩子: 三态锚仍在
ok(/id="state-gate"/.test(html), "印 67 守: state-gate 锚在");
ok(/id="state-onboarding"/.test(html), "印 67 守: state-onboarding 锚在");
ok(/id="state-mine"/.test(html), "印 67 守: state-mine 锚在");
// (cleanup-2026-05-16 · legacy.html 旁支损 · 链锚同损)

// ── 总结 ───────────────────────────────────────────────────────────
const total = pass + fail;
console.log(
  "\n═══════════════════════════════════════════════════════════════",
);
console.log(
  "  印 69 守门: " + pass + "/" + total + " pass · " + fail + " fail",
);
console.log("═══════════════════════════════════════════════════════════════");
if (fail > 0) process.exit(1);
