// 道 · 模式融合(headless·零 vscode 依赖) —— 提示词层 × 工具层 (v9.9.373: 工具轴只余 official · 域叠加清空)。
// ─────────────────────────────────────────────────────────────────────────────
// 两层正交, 各自独立切换, 组合即模式矩阵(不生产, 只搬运: 两轴皆映射既有引擎):
//   · 提示词层(4): Proxy Pro 本源引擎同源(sp_invert SP_MODE × 经藏 canon) ——
//       official   官方模式:       /origin/mode=passthrough(字节级原貌)
//       daodejing  道德经模式:     /origin/mode=invert × /origin/canon=laozi
//       yinfujing  阴符经模式:     /origin/mode=invert × /origin/canon=yinfu
//       daoyin     道德经+阴符经:  /origin/mode=invert × /origin/canon=laozi+yinfu(本源默认)
//   · 工具层(1): sp_invert 工具契约轴(/origin/tools) —— v9.9.373 只剩 official 一档
//       default    默认模式:   tools=official(无附加工具契约) · 桥 mode=primary
//       (windows/freecad/kicad 域契约线已废 · 旧项目尸骸出列)


// 真源落盘:
//   · 双轴态: ~/.dao/mode-fusion.json(本插件自持; 旧 invert/passthrough/custom 自动迁移)
//   · 工具层契约: ~/.dao/mode.json(与 ModeManager 同一契约文件, merge 写不覆没自持字段),
//     并 best-effort POST 反代 /origin/tools 与桥 /api/mode.set 令在跑者即刻生效。
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const https = require("https");

// origin: 本源反代(source.js 控制面)之 SP_MODE + 经藏 canon 映射。
const PROMPT_MODES = [
  { id: "official", name: "官方模式", summary: "提示词字节级原貌, 零注入", origin: { mode: "passthrough" } },
  { id: "daodejing", name: "道德经", summary: "官方 SP 反转为帛书《老子》", origin: { mode: "invert", canon: "laozi" } },
  { id: "yinfujing", name: "阴符经", summary: "官方 SP 反转为道藏《陰符經》", origin: { mode: "invert", canon: "yinfu" } },
  { id: "daoyin", name: "道德经+阴符经", summary: "帛书老子+道藏陰符經二经合一(本源默认)", origin: { mode: "invert", canon: "laozi+yinfu" } },
];

// tools: sp_invert TOOLMODE_MAP(/origin/tools) · bridge: ModeManager(~/.dao/mode.json) 模式 id。
const TOOL_MODES = [
  { id: "default", name: "默认模式", summary: "官方工具原貌, 无附加工具契约(日常默认)", tools: "official", bridge: "primary" },



];

// 域叠加层(与提示词层/工具层正交, 非第五模式)：开 = 把该域的工具描述并入系统提示
// (太上下知有之：AI 只是知道有这些工具, 自主择用); 关 = 官方原貌, 工具仍注册在册。
// 不论道德经/阴符经/官方哪种提示词模式, 叠加层都可叠加 —— 两者道并行而不相悖。
// v9.9.373 · 损之又损: pcb/freecad 域叠加层皆旧项目尸骸 —— 出列(overlay 机制留壳)。
const DOMAIN_OVERLAYS = [];



function fusionPath() {
  return process.env.DAO_MODE_FUSION_FILE || path.join(os.homedir(), ".dao", "mode-fusion.json");
}

// 与旧 Dao-Windows-Agent ModeManager 同一契约文件(v9.9.373: 桥已死·文件仅作迁移回读)。
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

// 旧提示词态迁移: invert/custom→daoyin(道化本源), passthrough→official。
const _LEGACY_PROMPT = { invert: "daoyin", custom: "daoyin", passthrough: "official" };

function promptMode() {
  const d = _readJson(fusionPath()) || {};
  if (PROMPT_MODES.some((m) => m.id === d.prompt)) return d.prompt;
  if (_LEGACY_PROMPT[d.prompt]) return _LEGACY_PROMPT[d.prompt];
  return "daoyin";
}

// 旧工具态迁移(契约文件 ModeManager id → 融合 id)。
const _LEGACY_TOOL = { primary: "default", coding: "default", native: "default", windows: "windows", "domain:freecad": "freecad", "domain:kicad": "kicad" };

function toolMode() {
  const d = _readJson(fusionPath()) || {};
  if (TOOL_MODES.some((m) => m.id === d.tool)) return d.tool;
  const c = _readJson(contractPath()) || {};
  if (_LEGACY_TOOL[c.mode]) return _LEGACY_TOOL[c.mode];
  return "default";
}

// 域叠加开关态: fusion 文件 overlays:{<id>:true} —— 默认全关(官方原貌)。
function overlayOn(id) {
  const d = _readJson(fusionPath()) || {};
  return !!(d.overlays && d.overlays[id]);
}

function setOverlay(id, on) {
  if (!DOMAIN_OVERLAYS.some((m) => m.id === id)) throw new Error("无此域叠加层: " + id);
  const d = _readJson(fusionPath()) || {};
  if (!d.overlays || typeof d.overlays !== "object") d.overlays = {};
  d.overlays[id] = !!on;
  d.updated = Math.floor(Date.now() / 1000);
  _writeJson(fusionPath(), d);
  return state();
}

// 叠加层提示词文本(开启者拼接)：供反代/运行期并入系统提示。
function overlayPrompt() {
  return ""; // v9.9.373 · 域叠加层已空 —— 无损可叠
}

function setPromptMode(id) {
  if (!PROMPT_MODES.some((m) => m.id === id)) throw new Error("无此提示词模式: " + id);
  const d = _readJson(fusionPath()) || {};
  d.prompt = id;
  d.updated = Math.floor(Date.now() / 1000);
  _writeJson(fusionPath(), d);
  return state();
}

// 工具层落盘: 融合文件记融合 id; 契约文件 merge 写桥模式 id ——
// ModeManager 自持字段(overlay/tool_policy/replace_official 等)原样保留。
function setToolMode(id) {
  const m = TOOL_MODES.find((x) => x.id === id);
  if (!m) throw new Error("无此工具层模式: " + id);
  const d = _readJson(fusionPath()) || {};
  d.tool = m.id;
  d.updated = Math.floor(Date.now() / 1000);
  _writeJson(fusionPath(), d);
  const c = _readJson(contractPath()) || {};
  c.mode = m.bridge;
  c.name = m.name;
  c.summary = m.summary;
  c.set_by = "dao-desktop";
  c.updated = Math.floor(Date.now() / 1000);
  _writeJson(contractPath(), c);
  return state();
}

// ★ 端口发现归一(v10.3): env 显式 > endpoint.json 软读 > per-user FNV-1a(与 dao-proxy-min
//   扩展同式 8889+hash%100·多账号自然隔离) > 8889 兜底。旧病: 硬编码 8889 — 在 per-user
//   端口部署点(如 zhouyoukang→8957)热切永远打不中真源, 静默失效(读盘生效掩盖之)。
function _fnv1aPort(username) {
  let h = 0x811c9dc5;
  for (let i = 0; i < username.length; i++) {
    h ^= username.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return 8889 + (h % 100);
}
function _discoverOriginPort() {
  if (process.env.ORIGIN_PORT) return process.env.ORIGIN_PORT;
  try {
    const os = require("os");
    const fs = require("fs");
    const path = require("path");
    const home = os.homedir();
    try {
      const j = JSON.parse(fs.readFileSync(path.join(home, ".codeium", "dao-byok", "endpoint.json"), "utf8"));
      const p = parseInt(j && j.port, 10);
      if (p > 0 && p < 65536) return String(p);
    } catch (_) { /* 无 endpoint.json 则继续 */ }
    return String(_fnv1aPort(os.userInfo().username));
  } catch (_) { return "8889"; }
}
function _originBase(opts) {
  return String((opts && opts.originUrl) || process.env.DAO_ORIGIN_URL ||
    "http://127.0.0.1:" + _discoverOriginPort()).replace(/\/+$/, "");
}

function _originReq(method, pathname, payload, opts) {
  opts = opts || {};
  return new Promise((resolve) => {
    let u;
    try { u = new URL(_originBase(opts) + pathname); } catch (_) { return resolve({ synced: false, error: "无效反代地址" }); }
    const mod = u.protocol === "https:" ? https : http;
    const data = payload == null ? null : Buffer.from(JSON.stringify(payload), "utf8");
    const headers = { "Content-Type": "application/json" };
    if (data) headers["Content-Length"] = data.length;
    const req = mod.request({
      method, hostname: u.hostname, port: u.port, path: u.pathname,
      headers, timeout: opts.timeoutMs || 3000,
    }, (res) => {
      let out = "";
      res.on("data", (c) => (out += c));
      res.on("end", () => resolve({ synced: res.statusCode === 200, status: res.statusCode, body: out.slice(0, 200) }));
    });
    req.on("timeout", () => { req.destroy(); resolve({ synced: false, error: "反代超时" }); });
    req.on("error", (e) => resolve({ synced: false, error: e.message }));
    if (data) req.write(data);
    req.end();
  });
}

// 提示词层真生效: 在跑本源反代即刻 POST /origin/mode(+经藏 /origin/canon)热切,
// 不在跑不算失败(_origin_mode.txt/_origin_canon.txt 由反代自持, 下次起跑读盘生效)。
async function syncOrigin(id, opts) {
  const pm = PROMPT_MODES.find((m) => m.id === id);
  if (!pm) return { synced: false, error: "无此提示词模式: " + id };
  const r1 = await _originReq("POST", "/origin/mode", { mode: pm.origin.mode }, opts);
  if (!pm.origin.canon) return r1;
  const r2 = await _originReq("POST", "/origin/canon", { canon: pm.origin.canon }, opts);
  return { synced: r1.synced && r2.synced, mode: r1, canon: r2 };
}

// 工具层真生效(提示面): 在跑反代即刻 POST /origin/tools 热切工具契约,
// 不在跑不算失败(_origin_tools.txt 由反代自持, 下次起跑读盘生效)。
function syncOriginTools(id, opts) {
  const tm = TOOL_MODES.find((m) => m.id === id);
  if (!tm) return Promise.resolve({ synced: false, error: "无此工具层模式: " + id });
  return _originReq("POST", "/origin/tools", { tools: tm.tools }, opts);
}

// 自定经文真生效: 写反代 /origin/custom_sp(用户即道, invert 路径优先接管)。
function setCustomText(text, opts) {
  const sp = String(text == null ? "" : text);
  if (!sp.trim()) return Promise.resolve({ synced: false, error: "自定经文为空" });
  return _originReq("POST", "/origin/custom_sp", { sp, source: "dao-desktop" }, opts);
}

function clearCustomText(opts) {
  return _originReq("DELETE", "/origin/custom_sp", null, opts);
}

// 工具层真生效(机控面): 桥在跑则即刻联动(/api/mode.set 以桥模式 id);
// 不在跑不算失败(契约文件已是真源)。
function syncBridge(id, opts) {
  opts = opts || {};
  const tm = TOOL_MODES.find((m) => m.id === id);
  const bridgeMode = tm ? tm.bridge : id;
  const base = String(opts.bridgeUrl || process.env.DAO_WIN_BRIDGE_URL || "http://127.0.0.1:9930").replace(/\/+$/, "");
  const token = opts.token || process.env.DAO_WIN_TOKEN || "dao-win-lab";
  return new Promise((resolve) => {
    let u;
    try { u = new URL(base + "/api/mode.set"); } catch (_) { return resolve({ synced: false, error: "无效桥地址" }); }
    const mod = u.protocol === "https:" ? https : http;
    const data = Buffer.from(JSON.stringify({ mode: bridgeMode }), "utf8");
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

// 提示词 × 工具 组合矩阵(v9.9.373: 4×1=4)。
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
    overlays: DOMAIN_OVERLAYS.map((m) => ({ id: m.id, name: m.name, summary: m.summary, on: overlayOn(m.id) })),
    total: PROMPT_MODES.length * TOOL_MODES.length,
    fusionFile: fusionPath(), contractFile: contractPath(),
  };
}

module.exports = {
  PROMPT_MODES, TOOL_MODES, DOMAIN_OVERLAYS,
  promptMode, toolMode, setPromptMode, setToolMode, syncBridge, syncOrigin, syncOriginTools,
  overlayOn, setOverlay, overlayPrompt,
  setCustomText, clearCustomText,
  matrix, state, fusionPath, contractPath,
  discoverOriginPort: _discoverOriginPort, originBase: _originBase,
};
