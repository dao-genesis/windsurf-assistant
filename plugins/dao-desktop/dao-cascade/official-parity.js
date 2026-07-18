// 道 · 官方命令/键位 1:1 覆盖审计(R161) —— 以官方 3.4.27 package.json 真源为锚。
// ─────────────────────────────────────────────────────────────────────────────
// 官方 contributes.commands 共 64 条(devin.*/windsurf.* 成对), 去偶后 33 个基名。
// 每个基名如实归类(不伪造):
//   covered   — 插件已有等价命令/面板承接(equiv 指明落点)
//   passthrough — 官方本体在位时直通(键组/命令序列已接线)
//   na        — 仅对官方 IDE fork 有意义, 第三方宿主天然不适用(reason 指明)
//   pending   — 尚未承接, 待后续轮次(如实待办)
// 审计经 /api/parity/commands 后端可验, 亦供 GAP-ANALYSIS 引用。
"use strict";

// 官方 3.4.27 实测提取的命令基名清单(去 devin./windsurf. 前缀偶)。
const MANIFEST = [
  { base: "login", cls: "covered", equiv: "dao.cascade.login" },
  { base: "logout", cls: "covered", equiv: "dao.cascade.logout" },
  { base: "loginWithAuthToken", cls: "covered", equiv: "dao.cascade.login(后端 token 链路同源)" },
  { base: "importVSCodeSettings", cls: "na", reason: "第三方宿主本身即 VS Code 系, 无需导入自身设置" },
  { base: "importVSCodeExtensions", cls: "na", reason: "同上, 扩展即宿主原生" },
  { base: "importVSCodeRecentWorkspaces", cls: "na", reason: "同上, 最近工作区即宿主原生" },
  { base: "importCursorSettings", cls: "na", reason: "IDE fork 迁移向导, 第三方宿主不适用" },
  { base: "importCursorExtensions", cls: "na", reason: "同上" },
  { base: "importWindsurfSettings", cls: "na", reason: "同上" },
  { base: "importWindsurfExtensions", cls: "na", reason: "同上" },
  { base: "importRulesFromCursor", cls: "covered", equiv: "dao.cascade.importRulesFromCursor(.cursorrules/.cursor/rules → .windsurf/rules 后端复制)" },
  { base: "generateCommitMessage", cls: "covered", equiv: "dao.cascade.genCommit(GenerateCommitMessage RPC 同源)" },
  { base: "addCurrentFileToChat", cls: "covered", equiv: "dao.cascade.addFile" },
  { base: "restartLanguageServer", cls: "covered", equiv: "设置页·引擎运维「重启 LS」(unified-panel 官方命令直通+ls-boot 自持重启)" },
  { base: "resetProductEducation", cls: "na", reason: "官方 IDE 新手引导状态, 第三方宿主无此引导层" },
  { base: "openProfile", cls: "covered", equiv: "dao.cascade.openProfile" },
  { base: "openBillingPage", cls: "covered", equiv: "账号菜单 Billing(windsurf.com/subscription/manage-plan)" },
  { base: "openAutoRefillPage", cls: "covered", equiv: "账号菜单/设置页订阅入口" },
  { base: "downloadDiagnostics", cls: "covered", equiv: "dao.cascade.downloadDiagnostics(官方在位直通; 否则 GetDebugDiagnostics RPC 真源落 JSON) + 设置页·引擎运维「诊断包」" },
  { base: "copyApiKey", cls: "covered", equiv: "统一面板 API key 复制(尾4位显示, 完整仅进剪贴板)" },
  { base: "openChangeLog", cls: "covered", equiv: "dao.cascade.openChangelog" },
  { base: "triggerCascade", cls: "covered", equiv: "dao.cascade.open(Ctrl+L)/newSession(Ctrl+Shift+I 官方同键)" },
  { base: "createWorkflow", cls: "covered", equiv: "dao.cascade.createWorkflow" },
  { base: "createGlobalWorkflow", cls: "covered", equiv: "dao.cascade.createGlobalWorkflow" },
  { base: "createRule", cls: "covered", equiv: "dao.cascade.createRule" },
  { base: "migrateWorkspaceConfig", cls: "na", reason: "官方 IDE 工作区配置迁移, 第三方宿主不适用" },
  { base: "openBrowser", cls: "covered", equiv: "dao.cascade.openBrowser(官方在位直通; 否则宿主 simpleBrowser.show 同位承接)" },
  { base: "setPortalUrl", cls: "na", reason: "企业自托管门户地址, 与插件无关(官方本体在位时由其管理)" },
  { base: "reloadAcpConnections", cls: "covered", equiv: "dao.cascade.acpRegistry(官方在位直通 reload; GetAllAcpRegistries RPC 同源列表)" },
  { base: "openAcpLocalRegistry", cls: "covered", equiv: "dao.cascade.acpRegistry(ACP 代理清单 quickpick + /api/acp/registries)" },
  { base: "cascade.toggleAgentSelector", cls: "covered", equiv: "dao.cascade.openAgentPicker(Ctrl+Shift+. 官方同键)" },
  { base: "lifeguard.checkCurrentChanges", cls: "covered", equiv: "dao.cascade.lifeguardCheck(Ctrl+U 官方同键; 官方在位直通, 否则 GetLifeguardConfig 如实报告引擎态)" },
  { base: "lifeguard.evaluateDataset", cls: "na", reason: "官方内部评测工具, 面向 Windsurf 开发者" },
];

// 官方键位表(3.4.27 keybindings 真源)中已 1:1 对位的键(插件侧同键或直通)。
const KEY_PARITY = [
  { key: "ctrl+i", official: "devin.prioritized.command.open", ours: "dao.cascade.inlineCommand" },
  { key: "ctrl+shift+i", official: "devin.triggerCascade", ours: "dao.cascade.newSession" },
  { key: "ctrl+enter", official: "devin.prioritized.cascadeAcceptAllInFile", ours: "dao.cascade.acceptAllInFile" },
  { key: "shift+ctrl+backspace", official: "devin.prioritized.cascadeRejectAllInFile", ours: "dao.cascade.rejectAllInFile" },
  { key: "alt+j", official: "devin.prioritized.cascadeFocusNextHunk", ours: "dao.cascade.nextDiffHunk" },
  { key: "alt+k", official: "devin.prioritized.cascadeFocusPreviousHunk", ours: "dao.cascade.prevDiffHunk" },
  { key: "alt+enter", official: "devin.prioritized.cascadeAcceptFocusedHunk", ours: "dao.cascade.acceptFocusedHunk" },
  { key: "alt+shift+backspace", official: "devin.prioritized.cascadeRejectFocusedHunk", ours: "dao.cascade.rejectFocusedHunk" },
  { key: "ctrl+/", official: "devin.cascade.toggleModelSelector", ours: "dao.cascade.toggleModelSelector" },
  { key: "ctrl+shift+/", official: "devin.cascade.switchToNextModel", ours: "dao.cascade.switchToNextModel" },
  { key: "ctrl+.", official: "devin.prioritized.chat.toggleWriteChatMode", ours: "dao.cascade.toggleWriteChatMode" },
  { key: "ctrl+shift+.", official: "devin.cascade.openAgentPicker", ours: "dao.cascade.openAgentPicker" },
];

function audit() {
  const by = (c) => MANIFEST.filter((m) => m.cls === c);
  const covered = by("covered"), na = by("na"), pending = by("pending"), pass = by("passthrough");
  const applicable = MANIFEST.length - na.length;
  return {
    officialBaseCommands: MANIFEST.length,
    covered: covered.length, passthrough: pass.length, na: na.length, pending: pending.length,
    applicable, coveragePct: Math.round(((covered.length + pass.length) / applicable) * 100),
    keyParity: KEY_PARITY.length,
    pendingList: pending.map((m) => ({ base: m.base, reason: m.reason })),
    naList: na.map((m) => ({ base: m.base, reason: m.reason })),
    manifest: MANIFEST,
    note: "官方 3.4.27 package.json 真源实测提取; covered=插件等价承接, na=第三方宿主天然不适用(如实), pending=待接(不伪造)",
  };
}

// 两个可后端实作的官方命令对位(其余 covered 项已由面板/既有命令承接)。
function register(context, log) {
  const vscode = require("vscode");
  const fs = require("fs"), path = require("path");
  const l = (m) => { try { if (log) log("[parity] " + m); } catch (_) {} };

  // 官方 importRulesFromCursor 对位: 工作区 .cursorrules/.cursor/rules/* → .windsurf/rules/(mdc→md)。
  const importRules = async () => {
    const ws = (vscode.workspace.workspaceFolders || [])[0];
    if (!ws) return void vscode.window.showWarningMessage("无工作区, 无处导入 Cursor 规则");
    const root = ws.uri.fsPath;
    const out = path.join(root, ".windsurf", "rules");
    const srcs = [];
    const single = path.join(root, ".cursorrules");
    if (fs.existsSync(single)) srcs.push({ from: single, to: path.join(out, "cursorrules.md") });
    const dir = path.join(root, ".cursor", "rules");
    if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir)) {
      if (/\.(md|mdc|txt)$/i.test(f)) srcs.push({ from: path.join(dir, f), to: path.join(out, f.replace(/\.mdc$/i, ".md")) });
    }
    if (!srcs.length) return void vscode.window.showInformationMessage("未发现 .cursorrules / .cursor/rules — 无可导入");
    fs.mkdirSync(out, { recursive: true });
    for (const s of srcs) fs.copyFileSync(s.from, s.to);
    vscode.window.showInformationMessage("已导入 " + srcs.length + " 个 Cursor 规则 → .windsurf/rules(官方同源目录)");
    l("importRulesFromCursor: " + srcs.length + " 个");
  };

  // 官方 lifeguard.checkCurrentChanges 对位(Ctrl+U): 官方在位直通; 纯第三方如实报引擎态(不伪造检查)。
  const lifeguardCheck = async () => {
    const cmds = await vscode.commands.getCommands(true).catch(() => []);
    for (const c of ["devin.lifeguard.checkCurrentChanges", "windsurf.lifeguard.checkCurrentChanges"]) {
      if (cmds.includes(c)) { try { await vscode.commands.executeCommand(c); return; } catch (_) {} }
    }
    try {
      const ls = require("./ls-bridge");
      if (!ls.ready()) throw new Error("LS 未就绪");
      const r = await ls.call("GetLifeguardConfig", {});
      const agent = r && r.config && r.config.modes && r.config.modes.agent;
      vscode.window.showInformationMessage("Lifeguard 引擎: " + (agent && agent.enabled ? "已启用(" + (agent.modelDisplayName || agent.model) + ")" : "未启用") + " · 检查面板由官方本体渲染, 第三方宿主如实不伪造");
    } catch (e) {
      vscode.window.showWarningMessage("Lifeguard: 官方本体不在位且 LS 不可用 — " + (e && e.message));
    }
  };

  // 官方 ACP(reloadAcpConnections/openAcpLocalRegistry) 对位: 直通优先, 否则官方真源清单 quickpick。
  const acpRegistry = async () => {
    const cmds = await vscode.commands.getCommands(true).catch(() => []);
    for (const c of ["devin.openAcpLocalRegistry", "windsurf.openAcpLocalRegistry"]) {
      if (cmds.includes(c)) { try { await vscode.commands.executeCommand(c); return; } catch (_) {} }
    }
    try {
      const ls = require("./ls-bridge");
      if (!ls.ready()) throw new Error("LS 未就绪");
      const r = await ls.call("GetAllAcpRegistries", {});
      const reg = JSON.parse((r && r.registryJson) || "{}");
      const agents = reg.agents || [];
      await vscode.window.showQuickPick(
        agents.map((a) => ({ label: a.name || a.description || "agent", description: (a.authors || []).join(", "), detail: a.description })),
        { placeHolder: "ACP 代理清单(官方 GetAllAcpRegistries 真源) · " + agents.length + " 个" }
      );
    } catch (e) {
      vscode.window.showWarningMessage("ACP: 官方本体不在位且 LS 不可用 — " + (e && e.message));
    }
  };

  // 官方 openBrowser 对位: 官方本体在位直通, 否则用宿主 simpleBrowser 同位承接。
  const openBrowser = async () => {
    const cmds = await vscode.commands.getCommands(true).catch(() => []);
    for (const c of ["devin.openBrowser", "windsurf.openBrowser"]) {
      if (cmds.includes(c)) { try { await vscode.commands.executeCommand(c); return; } catch (_) {} }
    }
    const url = await vscode.window.showInputBox({ prompt: "打开浏览器(官方 openBrowser 对位)", value: "https://windsurf.com" });
    if (url) await vscode.commands.executeCommand("simpleBrowser.show", url).then(undefined,
      () => vscode.env.openExternal(vscode.Uri.parse(url)));
  };

  // 跨端会话重拉(R163): 官方轨迹列表 pull-on-(re)start 语义(R160 实证) — 自持 LS 重启即重拉云端真源。
  const refreshSessions = async () => {
    const boot = require("./ls-boot");
    if (!boot.alive()) return void vscode.window.showInformationMessage("当前接官方共生 LS: 官方侧自身重载即刷新, 插件不代杀官方进程 — 如实标注");
    await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: "重拉云端会话(自持 LS 重启)…" }, async () => {
      boot.stop();
      await boot.boot({ log: () => {} });
    });
    try {
      const ls = require("./ls-bridge");
      const r = await ls.call("GetAllCascadeTrajectories", {});
      const n = Object.keys((r && r.trajectorySummaries) || {}).length;
      vscode.window.showInformationMessage("已重拉云端真源: " + n + " 个会话(另一侧新建/改名/归档即见)");
    } catch (e) { vscode.window.showWarningMessage("重拉后读取失败: " + (e && e.message)); }
    l("refreshSessions: 自持 LS 重启重拉完成");
  };

  // 定制类/MCP 轻量刷新(R165): 官方 RefreshCustomization/RefreshMcpServers RPC(实机已证) — 不重启 LS
  // 即重读 Rules/Workflows/Skills/MCP 文件真源, 跨 IDE 改动即见。
  const refreshVia = (rpcName, label) => async () => {
    try {
      const ls = require("./ls-bridge");
      if (!ls.ready()) throw new Error("LS 未就绪");
      await ls.call(rpcName, {});
      vscode.window.setStatusBarMessage("$(sync) " + label + " 已重读真源(" + rpcName + ")", 2500);
      l(rpcName + " 完成");
    } catch (e) { vscode.window.showWarningMessage(label + " 刷新失败: " + (e && e.message)); }
  };

  // 诊断包下载(R167): 官方 downloadDiagnostics 对位 — 官方在位直通, 否则 GetDebugDiagnostics
  // RPC(实机已证)同源拉 LS 诊断落 JSON 文件。
  const downloadDiagnostics = async () => {
    const cmds = await vscode.commands.getCommands(true).catch(() => []);
    for (const c of ["devin.downloadDiagnostics", "windsurf.downloadDiagnostics"]) {
      if (cmds.includes(c)) { try { await vscode.commands.executeCommand(c); return; } catch (_) {} }
    }
    try {
      const ls = require("./ls-bridge");
      if (!ls.ready()) throw new Error("LS 未就绪");
      const r = await ls.call("GetDebugDiagnostics", {});
      const os = require("os"), path = require("path"), fs = require("fs");
      const out = path.join(os.homedir(), "dao-diagnostics-" + Date.now() + ".json");
      fs.writeFileSync(out, JSON.stringify(r, null, 2));
      vscode.window.showInformationMessage("LS 诊断已落盘(官方 GetDebugDiagnostics 真源): " + out);
    } catch (e) { vscode.window.showWarningMessage("诊断下载失败: " + (e && e.message)); }
  };

  // 定时重拉(R168): 官方无跨端实时推送(R160/R168 实测), 自持 LS 可选周期性重启重拉。
  // dao.cascade.autoRefreshMinutes(默认 0=关); 仅自持 LS 生效, 共生官方 LS 不代杀。
  let _autoTimer = null;
  const applyAutoRefresh = () => {
    if (_autoTimer) { clearInterval(_autoTimer); _autoTimer = null; }
    const mins = vscode.workspace.getConfiguration("dao").get("cascade.autoRefreshMinutes", 0);
    if (!(mins > 0)) return;
    _autoTimer = setInterval(() => {
      const boot = require("./ls-boot");
      if (!boot.alive()) return;
      boot.stop();
      boot.boot({ log: () => {} }).then(() => l("autoRefresh: 自持 LS 周期重拉完成"), () => {});
    }, mins * 60 * 1000);
    l("autoRefresh: 每 " + mins + " 分钟重拉(仅自持 LS)");
  };
  applyAutoRefresh();
  context.subscriptions.push(
    { dispose: () => { if (_autoTimer) clearInterval(_autoTimer); } },
    vscode.workspace.onDidChangeConfiguration((e) => { if (e.affectsConfiguration("dao.cascade.autoRefreshMinutes")) applyAutoRefresh(); })
  );

  // 官方主题对位(R175): theme-windsurf 真源逐字节随包(Devin Dark/Light), 本命令一键切换
  // 宿主 workbench.colorTheme → 官方默认 "Devin Dark"(product.json 同源默认)。
  const applyOfficialTheme = async () => {
    try {
      await vscode.workspace.getConfiguration("workbench").update("colorTheme", "Devin Dark", true);
      vscode.window.showInformationMessage("已应用官方 Devin Desktop 默认主题(Devin Dark) — 真源: 官方 theme-windsurf");
    } catch (e) { vscode.window.showWarningMessage("主题应用失败: " + (e && e.message)); }
  };

  context.subscriptions.push(
    vscode.commands.registerCommand("dao.cascade.applyOfficialTheme", applyOfficialTheme),
    vscode.commands.registerCommand("dao.cascade.importRulesFromCursor", importRules),
    vscode.commands.registerCommand("dao.cascade.openBrowser", openBrowser),
    vscode.commands.registerCommand("dao.cascade.lifeguardCheck", lifeguardCheck),
    vscode.commands.registerCommand("dao.cascade.acpRegistry", acpRegistry),
    vscode.commands.registerCommand("dao.cascade.refreshSessions", refreshSessions),
    vscode.commands.registerCommand("dao.cascade.refreshCustomizations", refreshVia("RefreshCustomization", "Rules/Workflows/Skills")),
    vscode.commands.registerCommand("dao.cascade.refreshMcp", refreshVia("RefreshMcpServers", "MCP 服务")),
    vscode.commands.registerCommand("dao.cascade.downloadDiagnostics", downloadDiagnostics)
  );
  l("官方命令对位就位(importRulesFromCursor/openBrowser/lifeguardCheck/acpRegistry/refreshSessions/refreshCustomizations/refreshMcp)");
}

module.exports = { MANIFEST, KEY_PARITY, audit, register };
