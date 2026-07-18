// 道 · 真源守望(R166) —— 官方落盘真源变更 → 官方 Refresh RPC 即时重读。
// ─────────────────────────────────────────────────────────────────────────────
// 本源: 官方 IDE 与本插件读写同一份落盘真源(sync-audit.surfaces)。官方 LS 对定制类/MCP
// 提供轻量刷新 RPC(RefreshCustomization/RefreshMcpServers, R165 实机已证), 但不自动
// watch 文件。本模块补上这一环: fs.watch 官方真源 → 去抖 → 对应 Refresh RPC ——
// 由此"一侧改动, 另一侧即见"从手动刷新升级为自动(文件层实时, 无轮询)。
// 会话轨迹为云端真源 pull-on-restart 语义(R160), 不在本模块范围 — 如实不伪造。
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");

const DEBOUNCE_MS = 1500;

function home() { return process.env.DAO_ENV_SYNC_HOME || os.homedir(); }

// 守望点: 真源路径 → 对应官方刷新 RPC。
function watchTargets() {
  const h = home();
  const w = path.join(h, ".codeium", "windsurf");
  return [
    { path: process.env.DAO_MCP_CONFIG_FILE || path.join(w, "mcp_config.json"), rpc: "RefreshMcpServers", label: "MCP 配置" },
    { path: path.join(w, "memories"), rpc: "RefreshCustomization", label: "global_rules.md/记忆" },
    { path: path.join(h, ".devin", "rules"), rpc: "RefreshCustomization", label: "全局 Rules" },
    { path: path.join(w, "global_workflows"), rpc: "RefreshCustomization", label: "全局 Workflows" },
    { path: path.join(w, "skills"), rpc: "RefreshCustomization", label: "全局 Skills" },
  ];
}

let _watchers = [];
let _timers = Object.create(null);

function _fire(rpc, label, log) {
  clearTimeout(_timers[rpc]);
  _timers[rpc] = setTimeout(() => {
    try {
      const ls = require("./ls-bridge");
      if (!ls.ready()) return void log("[truth-watch] " + label + " 变更, 但 LS 未就绪 — 跳过(如实)");
      ls.call(rpc, {}).then(
        () => log("[truth-watch] " + label + " 变更 → " + rpc + " 已重读真源"),
        (e) => log("[truth-watch] " + rpc + " 失败: " + (e && e.message))
      );
    } catch (e) { log("[truth-watch] " + (e && e.message)); }
  }, DEBOUNCE_MS);
}

function start(log) {
  stop();
  const l = (m) => { try { if (log) log(m); } catch (_) {} };
  let n = 0;
  for (const t of watchTargets()) {
    try {
      if (!fs.existsSync(t.path)) continue;
      const w = fs.watch(t.path, { recursive: false }, () => _fire(t.rpc, t.label, l));
      w.on("error", () => {});
      _watchers.push(w);
      n++;
    } catch (_) {}
  }
  l("[truth-watch] 守望 " + n + " 个官方真源点(变更即 Refresh RPC 重读)");
  return n;
}

function stop() {
  for (const w of _watchers) { try { w.close(); } catch (_) {} }
  _watchers = [];
  for (const k of Object.keys(_timers)) clearTimeout(_timers[k]);
  _timers = Object.create(null);
}

function register(context, log) {
  const vscode = require("vscode");
  const enabled = vscode.workspace.getConfiguration("dao").get("truthWatch.enabled", true);
  if (enabled) start(log);
  context.subscriptions.push(
    { dispose: stop },
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (!e.affectsConfiguration("dao.truthWatch.enabled")) return;
      const on = vscode.workspace.getConfiguration("dao").get("truthWatch.enabled", true);
      if (on) start(log); else { stop(); log("[truth-watch] 已停"); }
    })
  );
}

module.exports = { watchTargets, start, stop, register, DEBOUNCE_MS, _fire };
