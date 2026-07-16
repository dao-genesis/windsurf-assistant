"use strict";
// 导入同步 · 官方 import 系列命令对等(importVSCodeSettings / importVSCodeExtensions / importRulesFromCursor)。
// 纯逻辑(可 headless 测试)与 IO 分离: merge/list 为纯函数, apply* 才落盘。
const fs = require("fs");
const os = require("os");
const path = require("path");

// 宽容 JSONC: 去注释与尾逗号后解析(官方 settings.json 允许注释)。
function parseJsonc(text) {
  const noComments = String(text || "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'\\])\/\/[^\n]*/g, "$1");
  const noTrailing = noComments.replace(/,\s*([}\]])/g, "$1");
  return JSON.parse(noTrailing || "{}");
}

// 官方 importVSCodeSettings 语义: 源键并入目标, 目标已有键不覆盖(用户已定制优先)。
// 返回 {merged(对象), added(新增键名数组)}。
function mergeSettings(srcText, dstText) {
  const src = parseJsonc(srcText);
  const dst = parseJsonc(dstText);
  const added = [];
  for (const k of Object.keys(src)) {
    if (!(k in dst)) { dst[k] = src[k]; added.push(k); }
  }
  return { merged: dst, added };
}

// ~/.vscode/extensions/extensions.json → 扩展 id 列表(去重, 排除 windsurf/devin 内建冲突项)。
function vscodeExtensionIds(jsonText) {
  let arr = [];
  try { arr = parseJsonc(jsonText); } catch (_) { return []; }
  if (!Array.isArray(arr)) return [];
  const skip = /^(codeium\.|windsurf|devin\.)/i;
  const out = [];
  for (const e of arr) {
    const id = e && e.identifier && e.identifier.id;
    if (id && !skip.test(id) && out.indexOf(id) < 0) out.push(id);
  }
  return out;
}

function vscodeUserDir() {
  if (process.platform === "win32") return path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), "Code", "User");
  if (process.platform === "darwin") return path.join(os.homedir(), "Library", "Application Support", "Code", "User");
  return path.join(os.homedir(), ".config", "Code", "User");
}

function devinUserDir() {
  if (process.platform === "win32") return path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), "Devin", "User");
  if (process.platform === "darwin") return path.join(os.homedir(), "Library", "Application Support", "Devin", "User");
  return path.join(os.homedir(), ".config", "Devin", "User");
}

// 落盘: VS Code settings.json → Devin settings.json(不覆盖已有键, 先备份)。
function applyVSCodeSettings() {
  const srcP = path.join(vscodeUserDir(), "settings.json");
  if (!fs.existsSync(srcP)) throw new Error("未检出 VS Code 用户设置: " + srcP);
  const dstDir = devinUserDir();
  const dstP = path.join(dstDir, "settings.json");
  fs.mkdirSync(dstDir, { recursive: true });
  const dstText = fs.existsSync(dstP) ? fs.readFileSync(dstP, "utf8") : "{}";
  const { merged, added } = mergeSettings(fs.readFileSync(srcP, "utf8"), dstText);
  if (added.length) {
    if (fs.existsSync(dstP)) fs.copyFileSync(dstP, dstP + ".bak-" + Date.now());
    fs.writeFileSync(dstP, JSON.stringify(merged, null, 2) + "\n");
  }
  return { added, dst: dstP };
}

// VS Code 已装扩展清单(id 列表; 安装由调用方经 IDE CLI 逐个执行)。
function listVSCodeExtensions() {
  const p = path.join(os.homedir(), ".vscode", "extensions", "extensions.json");
  if (!fs.existsSync(p)) return [];
  return vscodeExtensionIds(fs.readFileSync(p, "utf8"));
}

module.exports = { parseJsonc, mergeSettings, vscodeExtensionIds, vscodeUserDir, devinUserDir, applyVSCodeSettings, listVSCodeExtensions };
