#!/usr/bin/env node
// dao-ai-base 再 vendor 工具: 把真源(本仓 plugins/)同步进各领域插件的 dao-ai-base/。
// ─────────────────────────────────────────────────────────────────────────────
// 真源布局:
//   plugins/dao-ai-base/index.js         — 基底单一入口(activateDaoAiBase / genContributes)
//   plugins/dao-desktop/windsurf-shim.js — Windsurf fork 私有 proposed API 垫片
//   plugins/dao-desktop/dao-cascade/     — Cascade 三模式面板核心
// 用法:
//   node plugins/dao-ai-base/sync.js <领域插件目录>...
// 例:
//   node plugins/dao-ai-base/sync.js \
//     ~/repos/Dao-PCB-Design-Agent/vscode-dao-kicad \
//     ~/repos/Dao-PCB-Design-Agent/vscode-dao-lceda \
//     ~/repos/Dao-3D-Modeling-Agent/90-归一_IDE/vscode-dao-freecad \
//     ~/repos/Dao-Windows-Agent/ide/vscode
// 每个目标得到 <目标>/dao-ai-base/{index.js, windsurf-shim.js, dao-cascade/, VENDOR.md}。
"use strict";
const fs = require("fs");
const path = require("path");

const here = __dirname;
const srcIndex = path.join(here, "index.js");
const srcShim = path.join(here, "..", "dao-desktop", "windsurf-shim.js");
const srcCascade = path.join(here, "..", "dao-desktop", "dao-cascade");

const targets = process.argv.slice(2);
if (!targets.length) {
  console.error("用法: node sync.js <领域插件目录>...");
  process.exit(1);
}

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    e.isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
  }
}

for (const t of targets) {
  const dst = path.join(t, "dao-ai-base");
  if (!fs.existsSync(t)) { console.error("✗ 跳过(目录不存在): " + t); continue; }
  fs.mkdirSync(dst, { recursive: true });
  fs.copyFileSync(srcIndex, path.join(dst, "index.js"));
  fs.copyFileSync(srcShim, path.join(dst, "windsurf-shim.js"));
  copyDir(srcCascade, path.join(dst, "dao-cascade"));
  fs.writeFileSync(path.join(dst, "VENDOR.md"),
    "# dao-ai-base (vendored)\n\n" +
    "真源: windsurf-assistant/plugins/dao-desktop (dao-cascade + windsurf-shim) 及 plugins/dao-ai-base/index.js。\n" +
    "请勿在此处直接改核心; 改真源后用同步脚本重新 vendor:\n\n" +
    "    node plugins/dao-ai-base/sync.js <本插件目录>\n\n" +
    "同步时间: " + new Date().toISOString() + "\n");
  console.log("✓ vendored → " + dst);
}
