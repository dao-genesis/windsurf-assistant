// 道 · Windows Agent 接入官方工具层(樸散則為器 · 官方的壳 + 自建的髓)。
// ─────────────────────────────────────────────────────────────────────────────
// 本源：把 Dao-Windows-Agent 的 Windows/FreeCAD/KiCad 等能力做成 Cascade **原生并列工具**。
// 官方 LS 的原生工具扩展面即 mcp_config.json(SaveMcpServerToConfigFile 同一真源)——
// 注册进去后 Cascade/Devin Local/Devin Cloud 三模式与官方工具同层调度调用，无需任何自定义面板。
// 两种通道：
//   · local  — 本机有 Dao-Windows-Agent 检出：stdio 直起 `python3 -m bridge.mcp`
//              (探活本机桥 9930/9920 自动附着，HTTP 与 MCP 同一份会话态)。
//   · remote — 经 DAO Bridge 内网穿透：serverUrl 指公网 `/mcp`(Bearer 鉴权)，
//              操作用户本地电脑本体(pc_*/browser_*/plugin_*/vscode_* 四模块 + Windows 桌面路由)。
// 配置读写复用 mcp-config.js 真源(DAO_MCP_CONFIG_FILE 可重定向，测试隔离)。
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const mcpConfig = require("./mcp-config");

const SERVER_NAME = "dao-windows-agent";

// 定位本机 Dao-Windows-Agent 检出。显式传入即为权威(无效不回退猜测，误配须可见)；
// 未显式传入才依次猜 DAO_WINDOWS_AGENT_DIR / ~/repos / ~。
function _isCheckout(d) {
  try { return fs.existsSync(path.join(d, "bridge", "mcp.py")); } catch (_) { return false; }
}

function findLocalCheckout(explicit) {
  if (explicit) return _isCheckout(explicit) ? explicit : null;
  const cands = [
    process.env.DAO_WINDOWS_AGENT_DIR,
    path.join(os.homedir(), "repos", "Dao-Windows-Agent"),
    path.join(os.homedir(), "Dao-Windows-Agent"),
  ].filter(Boolean);
  for (const d of cands) if (_isCheckout(d)) return d;
  return null;
}

// 注册 local 通道：stdio 起 bridge.mcp(list_apps/search_verbs/clone_plan/session_* 等)。
// opts: { dir?, bridgeUrl?, token?, disabled? } → { ok, name, transport, configPath } | { ok:false, error }
function registerLocal(opts) {
  opts = opts || {};
  const dir = findLocalCheckout(opts.dir);
  if (!dir) return { ok: false, error: "未找到 Dao-Windows-Agent 检出(可设 DAO_WINDOWS_AGENT_DIR)" };
  const env = {};
  if (opts.bridgeUrl) env.DAO_WIN_BRIDGE_URL = String(opts.bridgeUrl);
  if (opts.token) env.DAO_WIN_TOKEN = String(opts.token);
  const spec = {
    command: process.platform === "win32" ? "python" : "python3",
    args: ["-m", "bridge.mcp"],
    cwd: dir,
  };
  if (Object.keys(env).length) spec.env = env;
  if (opts.disabled) spec.disabled = true;
  return _write(spec, "local");
}

// 注册 remote 通道：serverUrl 指 DAO Bridge 穿透公网 /mcp(Bearer)。
// opts: { url, token, disabled? }。url 须为 http(s) 且以 /mcp 结尾(不合则自动补)。
function registerRemote(opts) {
  opts = opts || {};
  let url = String(opts.url || "").trim().replace(/\/+$/, "");
  if (!/^https?:\/\//.test(url)) return { ok: false, error: "url 须为 http(s) 公网穿透地址" };
  if (!/\/mcp$/.test(url)) url += "/mcp";
  const spec = { serverUrl: url };
  if (opts.token) spec.headers = { Authorization: "Bearer " + String(opts.token) };
  if (opts.disabled) spec.disabled = true;
  return _write(spec, "remote");
}

function _write(spec, transport) {
  const cfg = mcpConfig.readConfig();
  if (!cfg.mcpServers || typeof cfg.mcpServers !== "object") cfg.mcpServers = {};
  cfg.mcpServers[SERVER_NAME] = spec;
  const p = mcpConfig.writeConfig(cfg);
  return { ok: true, name: SERVER_NAME, transport, configPath: p };
}

function unregister() {
  const cfg = mcpConfig.readConfig();
  const servers = cfg.mcpServers || {};
  const had = !!servers[SERVER_NAME];
  delete servers[SERVER_NAME];
  mcpConfig.writeConfig(cfg);
  return { ok: true, removed: had };
}

// 视图(脱敏：headers 只报有无，不回 token)。
function status() {
  const cfg = mcpConfig.readConfig();
  const spec = (cfg.mcpServers || {})[SERVER_NAME];
  if (!spec) return { registered: false };
  return {
    registered: true,
    transport: spec.serverUrl ? "remote" : "local",
    serverUrl: spec.serverUrl || null,
    cwd: spec.cwd || null,
    hasAuth: !!(spec.headers && spec.headers.Authorization) || !!(spec.env && spec.env.DAO_WIN_TOKEN),
    disabled: !!spec.disabled,
  };
}

// ── proxy Pro · Windows Agent 模式提示词(经文+工具) ──
// 阴符经式格式：底层经文(道法自然准则由 proxy Pro 既有隔离层供给) + 本模式工具契约。
// proxy Pro 切到本模式时把此段并入系统提示，令模型知晓 Windows 工具层的调用之道。
const MODE_ID = "windows-agent";

function modePrompt() {
  return [
    "# Windows Agent 模式(道并行而不相悖)",
    "",
    "你已接入用户 Windows 电脑的官方并列工具层(dao-windows-agent MCP)。你即全栈工程师：",
    "既写代码，也经工具直接操作 Windows 桌面、FreeCAD、KiCad 及一切已注册软件画像。",
    "",
    "## 调用之道",
    "- 先 `list_apps`/`search_verbs` 探明能力动词，勿臆测动词名；再 `session_*` 开会话逐步操作。",
    "- 分身规划用 `clone_plan`/`clone_matrix`：不同分身=独立 RDP 会话=独立输入队列，永不互扰。",
    "- 你的每步操作成果都落在用户 IDE 面板可见的同一路真实桌面会话——用户随时观看、协助、纠偏。",
    "- 用户动手时(输入租约被抢占)立即停手让位，待其归还再续。",
    "- 打包应用(AppX)/GPU 合成/全局互斥体软件最低需 SESSION 档隔离，勿假装 HDESK 可隔离。",
    "",
    "水善利万物而有静，唯变所适。",
  ].join("\n");
}

module.exports = {
  SERVER_NAME, MODE_ID,
  findLocalCheckout, registerLocal, registerRemote, unregister, status, modePrompt,
};
