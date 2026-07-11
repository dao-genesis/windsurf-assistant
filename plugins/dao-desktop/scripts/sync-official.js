#!/usr/bin/env node
// 官方同步器(反者道之动·通用体系): 反提官方 Devin Desktop bundle 的 LanguageServerService
// 全量方法 → 与插件实际接入对账 → 输出升级差异(官方新增/移除) → 重写 GAP.md 头部计数。
//
// 官方每次版本升级后只需重跑本器:
//   node plugins/dao-desktop/tools/sync-official.js [官方安装根目录]
// 默认官方根目录: ~/devin-desktop/Devin (或环境变量 DEVIN_DESKTOP_APP)
//
// 基线快照 official/rpcs.json 记录上次同步的 {version, methods[]}; 本器对比新旧集合,
// 打印"官方新增 N / 官方移除 M / 插件新接 K", 并同步更新快照与 GAP.md 计数行。
"use strict";
const fs = require("fs");
const path = require("path");
const os = require("os");

const PLUGIN = path.join(__dirname, "..");
const GAP = path.join(PLUGIN, "dao-cascade", "official", "GAP.md");
const SNAP = path.join(PLUGIN, "dao-cascade", "official", "rpcs.json");

function officialRoot() {
  const arg = process.argv[2] || process.env.DEVIN_DESKTOP_APP;
  if (arg) return arg;
  for (const c of [
    path.join(os.homedir(), "devin-desktop", "Devin"),
    "/usr/share/devin-desktop",
    path.join(os.homedir(), "AppData", "Local", "Programs", "Devin"),
  ]) if (fs.existsSync(c)) return c;
  throw new Error("未找到官方 Devin Desktop 安装目录, 请以参数或 DEVIN_DESKTOP_APP 指定");
}

// 反提: 从官方 windsurf 扩展 bundle 中按 protobuf 服务定义提取全量方法名
function extractOfficial(root) {
  const bundle = path.join(root, "resources", "app", "extensions", "windsurf", "dist", "extension.js");
  const t = fs.readFileSync(bundle, "utf8");
  const anchor = 'typeName:"exa.language_server_pb.LanguageServerService"';
  const i = t.indexOf(anchor);
  if (i < 0) throw new Error("bundle 中未找到 LanguageServerService 服务定义(官方结构可能已变, 请更新反提锚点)");
  let seg = t.slice(i, i + 200000);
  const next = seg.indexOf("typeName:", anchor.length);
  if (next > 0) seg = seg.slice(0, next);
  const methods = [...new Set([...seg.matchAll(/name:"([A-Z][A-Za-z]+)"/g)].map((m) => m[1]))].sort();
  let version = "";
  try {
    version = JSON.parse(fs.readFileSync(path.join(root, "resources", "app", "product.json"), "utf8")).windsurfVersion
      || JSON.parse(fs.readFileSync(path.join(root, "resources", "app", "package.json"), "utf8")).version || "";
  } catch (_) {}
  return { version, methods };
}

// 对账: 扫描插件源里实际经 ls-bridge call/callStream 调用的方法
function extractIntegrated() {
  const dir = path.join(PLUGIN, "dao-cascade");
  const set = new Set();
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".js")) continue;
    const t = fs.readFileSync(path.join(dir, f), "utf8");
    for (const m of t.matchAll(/call(?:Stream)?\(\s*["']([A-Z][A-Za-z]+)["']/g)) set.add(m[1]);
    for (const m of t.matchAll(/SVC\s*\+\s*["']([A-Z][A-Za-z]+)["']/g)) set.add(m[1]);
  }
  return [...set].sort();
}

function main() {
  const root = officialRoot();
  const cur = extractOfficial(root);
  const integrated = extractIntegrated().filter((n) => cur.methods.includes(n));
  const missing = cur.methods.filter((n) => !integrated.includes(n));

  let prev = null;
  try { prev = JSON.parse(fs.readFileSync(SNAP, "utf8")); } catch (_) {}
  const added = prev ? cur.methods.filter((n) => !prev.methods.includes(n)) : [];
  const removed = prev ? prev.methods.filter((n) => !cur.methods.includes(n)) : [];

  console.log(`官方版本: ${cur.version || "未知"} · 方法总数: ${cur.methods.length}`);
  console.log(`插件已接入: ${integrated.length} · 未接入: ${missing.length}`);
  if (prev) {
    console.log(`对比基线(${prev.version || "?"}): 官方新增 ${added.length} · 官方移除 ${removed.length}`);
    for (const n of added) console.log(`  + ${n}`);
    for (const n of removed) console.log(`  - ${n}`);
  } else console.log("(无历史基线, 本次建立首个快照)");

  fs.writeFileSync(SNAP, JSON.stringify({ version: cur.version, syncedAt: new Date().toISOString().slice(0, 10), methods: cur.methods }, null, 1) + "\n");

  // 重写 GAP.md 计数行(保留人工分类与探测实录)
  if (fs.existsSync(GAP)) {
    let g = fs.readFileSync(GAP, "utf8");
    g = g.replace(/- 官方 LanguageServerService 方法总数: \*\*\d+\*\*/, `- 官方 LanguageServerService 方法总数: **${cur.methods.length}**`)
         .replace(/- 插件已接入: \*\*\d+\*\*/, `- 插件已接入: **${integrated.length}**`)
         .replace(/- 未接入: \*\*\d+\*\*/, `- 未接入: **${missing.length}**`);
    const list = `## 已接入 (${integrated.length})\n${integrated.join(", ")}\n`;
    g = g.replace(/## 已接入 \(\d+\)\n[\s\S]*$/, list);
    fs.writeFileSync(GAP, g);
    console.log("GAP.md 计数与已接入清单已重写。");
  }
  if (added.length || removed.length) process.exitCode = 2; // 提示有官方变更待适配
}

main();
