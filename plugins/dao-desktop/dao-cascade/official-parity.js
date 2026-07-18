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
  { base: "downloadDiagnostics", cls: "covered", equiv: "设置页·引擎运维「诊断包」" },
  { base: "copyApiKey", cls: "covered", equiv: "统一面板 API key 复制(尾4位显示, 完整仅进剪贴板)" },
  { base: "openChangeLog", cls: "covered", equiv: "dao.cascade.openChangelog" },
  { base: "triggerCascade", cls: "covered", equiv: "dao.cascade.open(Ctrl+L)/newSession(Ctrl+Shift+I 官方同键)" },
  { base: "createWorkflow", cls: "covered", equiv: "dao.cascade.createWorkflow" },
  { base: "createGlobalWorkflow", cls: "covered", equiv: "dao.cascade.createGlobalWorkflow" },
  { base: "createRule", cls: "covered", equiv: "dao.cascade.createRule" },
  { base: "migrateWorkspaceConfig", cls: "na", reason: "官方 IDE 工作区配置迁移, 第三方宿主不适用" },
  { base: "openBrowser", cls: "covered", equiv: "dao.cascade.openBrowser(官方在位直通; 否则宿主 simpleBrowser.show 同位承接)" },
  { base: "setPortalUrl", cls: "na", reason: "企业自托管门户地址, 与插件无关(官方本体在位时由其管理)" },
  { base: "reloadAcpConnections", cls: "pending", reason: "ACP(Agent Client Protocol)连接管理, 待对照官方 ACP 面板承接" },
  { base: "openAcpLocalRegistry", cls: "pending", reason: "同上" },
  { base: "cascade.toggleAgentSelector", cls: "covered", equiv: "dao.cascade.openAgentPicker(Ctrl+Shift+. 官方同键)" },
  { base: "lifeguard.checkCurrentChanges", cls: "pending", reason: "官方 Lifeguard 代码守护(Ctrl+U); LS RPC GetLifeguardConfig 在, 待接" },
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

  context.subscriptions.push(
    vscode.commands.registerCommand("dao.cascade.importRulesFromCursor", importRules),
    vscode.commands.registerCommand("dao.cascade.openBrowser", openBrowser)
  );
  l("官方命令对位就位(importRulesFromCursor/openBrowser)");
}

module.exports = { MANIFEST, KEY_PARITY, audit, register };
