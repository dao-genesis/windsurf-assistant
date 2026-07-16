// 道 · 模式融合(headless·零 vscode 依赖) —— 提示词层 × 工具层 = 3×4 = 12 模式。
// ─────────────────────────────────────────────────────────────────────────────
// 两层正交, 各自独立切换, 组合即模式矩阵:
//   · 提示词层(3): Proxy Pro 经藏契约同源(sp_invert SP_MODE_VALID) ——
//       invert      经藏道化: 官方 SP 反转为帛书《老子》+《陰符經》纪律
//       passthrough 官方直通: 提示词字节级原貌
//       custom      自定经文: 用户自持替换文本
//   · 工具层(4): Dao-Windows-Agent ModeManager 内建同源(~/.dao/mode.json 同一契约) ——
//       primary / coding / windows / native
// 真源落盘:
//   · 提示词层态: ~/.dao/mode-fusion.json(本插件自持)
//   · 工具层态:   ~/.dao/mode.json(与 ModeManager 同一契约文件, 互为联动真源),
//     并 best-effort POST 桥 /api/mode.set 令在跑桥即刻生效(桥不在跑则契约文件生效)。
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const https = require("https");

const PROMPT_MODES = [
  { id: "invert", name: "经藏道化", summary: "官方 SP 反转为帛书老子+陰符經纪律(本源默认)" },
  { id: "passthrough", name: "官方直通", summary: "提示词字节级原貌, 零注入" },
  { id: "custom", name: "自定经文", summary: "用户自持替换文本接管提示词层" },
];

const TOOL_MODES = [
  { id: "primary", name: "主模式", summary: "帛书纪律 + 编程全集 + 整机为辅(日常默认)" },
  { id: "coding", name: "纯编程", summary: "官方 Devin Desktop 原貌, 机控面关闭" },
  { id: "windows", name: "Windows 全接管", summary: "整机桌面级路由为主战场, 编程面退辅" },
  { id: "native", name: "原生直通", summary: "官方字节级原貌, 无提示词注入" },
];

function fusionPath() {
  return process.env.DAO_MODE_FUSION_FILE || path.join(os.homedir(), ".dao", "mode-fusion.json");
}

// 与 Dao-Windows-Agent core/agent/modes.py DEFAULT_STATE_PATH 同一契约文件。
function contractPath() {
  return process.env.DAO_MODE_CONTRACT_FILE || path.join(os.homedir(), ".dao", "mode.json");
}

function _readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch (_) { return null; }
}

function _writeJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n", { mode: 0o600 });
}

function promptMode() {
  const d = _readJson(fusionPath()) || {};
  return PROMPT_MODES.some((m) => m.id === d.prompt) ? d.prompt : "invert";
}

function toolMode() {
  const d = _readJson(contractPath()) || {};
  return TOOL_MODES.some((m) => m.id === d.mode) ? d.mode : "primary";
}

function setPromptMode(id) {
  if (!PROMPT_MODES.some((m) => m.id === id)) throw new Error("无此提示词模式: " + id);
  const d = _readJson(fusionPath()) || {};
  d.prompt = id;
  d.updated = Math.floor(Date.now() / 1000);
  _writeJson(fusionPath(), d);
  return state();
}

function setToolMode(id) {
  const m = TOOL_MODES.find((x) => x.id === id);
  if (!m) throw new Error("无此工具层模式: " + id);
  _writeJson(contractPath(), {
    mode: m.id,
    name: m.name,
    summary: m.summary,
    set_by: "dao-desktop",
    updated: Math.floor(Date.now() / 1000),
  });
  return state();
}

// 桥在跑则即刻联动(/api/mode.set); 不在跑不算失败(契约文件已是真源)。
function syncBridge(id, opts) {
  opts = opts || {};
  const base = String(opts.bridgeUrl || process.env.DAO_WIN_BRIDGE_URL || "http://127.0.0.1:9930").replace(/\/+$/, "");
  const token = opts.token || process.env.DAO_WIN_TOKEN || "dao-win-lab";
  return new Promise((resolve) => {
    let u;
    try { u = new URL(base + "/api/mode.set"); } catch (_) { return resolve({ synced: false, error: "无效桥地址" }); }
    const mod = u.protocol === "https:" ? https : http;
    const data = Buffer.from(JSON.stringify({ mode: id }), "utf8");
    const req = mod.request({
      method: "POST", hostname: u.hostname, port: u.port, path: u.pathname,
      headers: { "Content-Type": "application/json", "Content-Length": data.length, Authorization: "Bearer " + token },
      timeout: opts.timeoutMs || 3000,
    }, (res) => {
      let out = "";
      res.on("data", (c) => (out += c));
      res.on("end", () => resolve({ synced: res.statusCode === 200, status: res.statusCode, body: out.slice(0, 200) }));
    });
    req.on("timeout", () => { req.destroy(); resolve({ synced: false, error: "桥超时" }); });
    req.on("error", (e) => resolve({ synced: false, error: e.message }));
    req.write(data);
    req.end();
  });
}

// 3×4 = 12 组合矩阵。
function matrix() {
  const out = [];
  for (const p of PROMPT_MODES) {
    for (const t of TOOL_MODES) {
      out.push({ id: p.id + "+" + t.id, prompt: p.id, tool: t.id, name: p.name + " × " + t.name });
    }
  }
  return out;
}

function state() {
  const p = promptMode();
  const t = toolMode();
  const pm = PROMPT_MODES.find((m) => m.id === p);
  const tm = TOOL_MODES.find((m) => m.id === t);
  return {
    prompt: p, tool: t,
    promptName: pm.name, toolName: tm.name,
    combined: p + "+" + t,
    combinedName: pm.name + " × " + tm.name,
    promptModes: PROMPT_MODES, toolModes: TOOL_MODES,
    total: PROMPT_MODES.length * TOOL_MODES.length,
    fusionFile: fusionPath(), contractFile: contractPath(),
  };
}

module.exports = {
  PROMPT_MODES, TOOL_MODES,
  promptMode, toolMode, setPromptMode, setToolMode, syncBridge,
  matrix, state, fusionPath, contractPath,
};
