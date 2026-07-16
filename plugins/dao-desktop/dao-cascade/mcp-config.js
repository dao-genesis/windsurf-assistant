// 道 · MCP 配置真源(通用底层 · 零 IDE 依赖) —— 直读写 mcp_config.json 的可靠 server 级开关。
// ─────────────────────────────────────────────────────────────────────────────
// 反者道之动: 此前 server 级开关走 UpdateMcpServerInConfigFile RPC, 该路由回 {} 但
// disabled 位行为不定(HANDOFF 存疑)。配置真源本就是本机 mcp_config.json —— 官方 LS 自身
// 亦以此文件为准(SaveMcpServerToConfigFile 即写它)。故开关直接落文件, 再 RefreshMcpServers
// 令 LS 重载, 三模式(Cascade / Devin Local / Devin Cloud)同一份 MCP 配置即同步生效。
// 路径可经 DAO_MCP_CONFIG_FILE 重定向(测试隔离)。
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");

function configPath() {
  return process.env.DAO_MCP_CONFIG_FILE
    || path.join(os.homedir(), ".codeium", "windsurf", "mcp_config.json");
}

function readConfig() {
  try { return JSON.parse(fs.readFileSync(configPath(), "utf8")) || {}; }
  catch (_) { return {}; }
}

function writeConfig(cfg) {
  const p = configPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(cfg, null, 2));
  return p;
}

// server 级开关: 翻转(或按 force 指定)mcpServers.<name>.disabled。
// 返回 { ok, name, disabled } 或 { ok:false, error }。
function toggleServer(name, force) {
  const n = String(name || "").trim();
  if (!n) return { ok: false, error: "缺 server 名" };
  const cfg = readConfig();
  const servers = cfg.mcpServers || cfg.servers || {};
  const spec = servers[n];
  if (!spec || typeof spec !== "object") return { ok: false, error: "配置中无此 server: " + n };
  const disabled = typeof force === "boolean" ? force : !spec.disabled;
  spec.disabled = disabled;
  writeConfig(cfg);
  return { ok: true, name: n, disabled };
}

// 工具级开关: 翻转 mcpServers.<name>.disabledTools 数组中的工具项。
function toggleTool(name, tool, force) {
  const n = String(name || "").trim();
  const t = String(tool || "").trim();
  if (!n || !t) return { ok: false, error: "缺 server/tool 名" };
  const cfg = readConfig();
  const servers = cfg.mcpServers || cfg.servers || {};
  const spec = servers[n];
  if (!spec || typeof spec !== "object") return { ok: false, error: "配置中无此 server: " + n };
  const list = Array.isArray(spec.disabledTools) ? spec.disabledTools.slice() : [];
  const has = list.indexOf(t) >= 0;
  const off = typeof force === "boolean" ? force : !has;
  spec.disabledTools = off ? (has ? list : list.concat(t)) : list.filter((x) => x !== t);
  writeConfig(cfg);
  return { ok: true, name: n, tool: t, off };
}

// 归并视图: 配置文件是 server 存在性/disabled 的真源(LS 的 GetMcpServerStates 不含已停用者),
// LS states 供 status/tools/prompts。返回官方式条目数组 —— 停用的 server 保留在列表(可再启用)。
function mergedServers(states) {
  const cfg = readConfig();
  const specs = cfg.mcpServers || cfg.servers || {};
  const byName = {};
  for (const s of (states || [])) byName[(s.spec || {}).serverName || ""] = s;
  const out = [];
  const seen = new Set();
  for (const name of Object.keys(specs)) {
    const spec = specs[name] || {};
    const s = byName[name];
    const off = new Set((s && (s.spec || {}).disabledTools) || spec.disabledTools || []);
    seen.add(name);
    out.push({
      name,
      status: s ? (s.status || "").replace("MCP_SERVER_STATUS_", "") : (spec.disabled ? "DISABLED" : ""),
      disabled: !!spec.disabled,
      error: (s && s.error) || "",
      tools: ((s && s.tools) || []).map((t) => ({ name: t.name, description: t.description || "", off: off.has(t.name) })),
      prompts: ((s && s.prompts) || []).map((p) => ({ name: p.name, description: p.description || "",
        args: (p.arguments || []).map((a) => a.name || "") })),
    });
  }
  for (const s of (states || [])) { // states 独有者(如注册表远端)也列出
    const name = (s.spec || {}).serverName || "";
    if (!name || seen.has(name)) continue;
    const off = new Set((s.spec || {}).disabledTools || []);
    out.push({ name, status: (s.status || "").replace("MCP_SERVER_STATUS_", ""), disabled: !!(s.spec || {}).disabled,
      error: s.error || "",
      tools: (s.tools || []).map((t) => ({ name: t.name, description: t.description || "", off: off.has(t.name) })),
      prompts: (s.prompts || []).map((p) => ({ name: p.name, description: p.description || "",
        args: (p.arguments || []).map((a) => a.name || "") })) });
  }
  return out;
}

module.exports = { configPath, readConfig, writeConfig, toggleServer, toggleTool, mergedServers };
