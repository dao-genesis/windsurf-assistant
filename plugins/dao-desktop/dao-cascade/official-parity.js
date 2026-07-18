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

// 官方全键位审计表(R177): 官方 3.4.27 keybindings 共 29 条逐条归类(不伪造)。
//   parity  — 插件同键同位承接(ours 指明落点)
//   host    — 官方绑的是宿主原生命令, 插件同键透传即同源
//   na      — 依赖官方引擎内部面(supercomplete/终端命令流/vim fork), 第三方宿主暂无对位面
//   pending — 面板功能待接(如实待办)
const KEYMAP_AUDIT = [
  { key: "ctrl+i", official: "prioritized.terminalCommand.open", cls: "na", reason: "官方终端内联命令流为引擎内部面, 宿主终端暂无注入点" },
  { key: "ctrl+enter", official: "terminalCommand.run", cls: "na", reason: "同上" },
  { key: "alt+enter", official: "terminalCommand.accept", cls: "na", reason: "同上" },
  { key: "shift+ctrl+backspace", official: "terminalCommand.reject", cls: "na", reason: "同上" },
  { key: "ctrl+i", official: "prioritized.command.open", cls: "parity", ours: "dao.cascade.inlineCommand" },
  { key: "ctrl+enter", official: "command.accept", cls: "parity", ours: "dao.cascade.acceptAllInFile(同键同域)" },
  { key: "shift+ctrl+backspace", official: "command.reject", cls: "parity", ours: "dao.cascade.rejectAllInFile(同键同域)" },
  { key: "ctrl+shift+i", official: "triggerCascade", cls: "parity", ours: "dao.cascade.newSession" },
  { key: "ctrl+enter", official: "prioritized.cascadeAcceptAllInFile", cls: "parity", ours: "dao.cascade.acceptAllInFile" },
  { key: "shift+ctrl+backspace", official: "prioritized.cascadeRejectAllInFile", cls: "parity", ours: "dao.cascade.rejectAllInFile" },
  { key: "alt+j", official: "prioritized.cascadeFocusNextHunk", cls: "parity", ours: "dao.cascade.nextDiffHunk" },
  { key: "alt+k", official: "prioritized.cascadeFocusPreviousHunk", cls: "parity", ours: "dao.cascade.prevDiffHunk" },
  { key: "alt+enter", official: "prioritized.cascadeAcceptFocusedHunk", cls: "parity", ours: "dao.cascade.acceptFocusedHunk" },
  { key: "alt+shift+backspace", official: "prioritized.cascadeRejectFocusedHunk", cls: "parity", ours: "dao.cascade.rejectFocusedHunk" },
  { key: "alt+\\", official: "editor.action.inlineSuggest.trigger", cls: "host", ours: "同键绑宿主原生 inlineSuggest.trigger(官方即绑此宿主命令)" },
  { key: "tab", official: "prioritized.supercompleteAccept", cls: "na", reason: "supercomplete 为官方引擎内部渲染面" },
  { key: "escape", official: "prioritized.supercompleteEscape", cls: "na", reason: "同上" },
  { key: "escape", official: "extension.vim_escape", cls: "na", reason: "官方 fork 内置 vim 扩展专用" },
  { key: "alt+enter", official: "cascade.acceptCascadeStep", cls: "parity", ours: "面板步骤接受(webview 内同键)" },
  { key: "alt+shift+backspace", official: "cascade.rejectCascadeStep", cls: "parity", ours: "面板步骤拒绝(webview 内同键)" },
  { key: "ctrl+shift+m", official: "cascade.pressMicrophone", cls: "na", reason: "语音输入为官方 IDE 原生录音面, 宿主 webview 无麦克风注入点" },
  { key: "ctrl+shift+.", official: "cascade.openAgentPicker", cls: "parity", ours: "dao.cascade.openAgentPicker" },
  { key: "ctrl+/", official: "cascade.toggleModelSelector", cls: "parity", ours: "dao.cascade.toggleModelSelector" },
  { key: "ctrl+shift+/", official: "cascade.switchToNextModel", cls: "parity", ours: "dao.cascade.switchToNextModel" },
  { key: "ctrl+;", official: "cascade.toggleWorktree", cls: "na", reason: "官方 worktree 面板为 IDE 原生面, 待官方开放 RPC 面再接" },
  { key: "ctrl+'", official: "cascade.toggleAgentSelector", cls: "parity", ours: "dao.cascade.openAgentPicker(官方同键别名)" },
  { key: "ctrl+.", official: "prioritized.chat.toggleWriteChatMode", cls: "parity", ours: "dao.cascade.toggleWriteChatMode" },
  { key: "ctrl+shift+\\", official: "tabReporting", cls: "na", reason: "官方内部上报工具" },
  { key: "ctrl+u", official: "lifeguard.checkCurrentChanges", cls: "parity", ours: "dao.cascade.lifeguardCheck" },
];

// 官方 chat-client 内部快捷键对位表(R186): 非 contributes 键位,
// 官方 workbench 内 DetectedAndRunByChatClient/jd.* 快捷键面, 逐条审计。
// R188: 官方 3.4.27 workbench 真源全表(jd 枚举 21 动作 + iPi 键位映射, 逐条提取):
//   parity — 插件同键同位已实装; no-surface — 插件无对应面(cascade 多标签/plan 模式/步骤评审);
//   host — DetectedAndRunByWindsurfIde 宿主侧动作(host 会话切换, 非 webview 面)。
const CHAT_CLIENT_KEYS = [
  { key: "ctrl+f", official: "cascade.chat.searchConversation(jd.SearchConversation)", cls: "parity", ours: "面板内会话搜索浮层(webview 同键: 匹配高亮+n/m 计数+Enter/Shift+Enter 巡航+Esc 关闭)" },
  { key: "ctrl+l", official: "prioritized.chat.open(jd.ToggleFocus)", cls: "parity", ours: "聚焦 composer 输入框(webview 同键)" },
  { key: "ctrl+shift+l", official: "prioritized.chat.openNewConversation(jd.CreateNewConversation)", cls: "parity", ours: "新建会话(session-new · 回 New session 首页)" },
  { key: "ctrl+n", official: "cascade.resetCurrentConversation(jd.ResetCurrentConversation)", cls: "parity", ours: "重置当前会话(同组新会话 · session-new)" },
  { key: "ctrl+.", official: "jd.ToggleWriteChatMode", cls: "parity", ours: "会话模式切换(modeBtn)" },
  { key: "ctrl+'", official: "jd.ToggleAgentSelector", cls: "parity", ours: "循环切换 agent" },
  { key: "ctrl+shift+.", official: "jd.OpenAgentPicker", cls: "parity", ours: "打开 agent 选择菜单(agentBtn)" },
  { key: "ctrl+/", official: "jd.ToggleModelSelector", cls: "parity", ours: "模型选择器(modelBtn)" },
  { key: "ctrl+shift+/", official: "jd.SwitchToNextModel", cls: "parity", ours: "切换下一模型" },
  { key: "ctrl+;", official: "jd.ToggleWorktree", cls: "parity", ours: "Worktree 模式开关(wtBtn)" },
  { key: "ctrl+shift+m", official: "jd.PressMicrophone", cls: "parity", ours: "语音输入(micBtn)" },
  { key: "ctrl+alt+c", official: "jd.Cancel", cls: "parity", ours: "取消当前生成(busy 时 cancel)" },
  { key: "alt+enter", official: "cascade.acceptCascadeStep(jd.AcceptCascadeStep)", cls: "no-surface", ours: "插件无步骤评审 accept/reject 面(diff zone 未实装)" },
  { key: "alt+shift+backspace", official: "cascade.rejectCascadeStep(jd.RejectCascadeStep)", cls: "no-surface", ours: "同上" },
  { key: "ctrl+enter", official: "jd.ImplementPlan", cls: "no-surface", ours: "插件无 plan 模式面" },
  { key: "ctrl+w", official: "jd.CloseActiveCascadeTab", cls: "no-surface", ours: "插件单会话面无 cascade 多标签(且 Ctrl+W 归宿主关编辑器)" },
  { key: "", official: "jd.CloseOtherCascadeTabs(官方亦无键位 isMatch:()=>!1)", cls: "no-surface", ours: "同上" },
  { key: "ctrl+shift+t", official: "jd.ReopenClosedCascadeTab", cls: "no-surface", ours: "同上" },
  { key: "ctrl+tab", official: "jd.SwitchToNextCascadeTab", cls: "no-surface", ours: "同上" },
  { key: "ctrl+shift+tab", official: "jd.SwitchToPreviousCascadeTab", cls: "no-surface", ours: "同上" },
  { key: "", official: "jd.SwitchToNextSession/PreviousSession/HighestPrioritySession(DetectedAndRunByWindsurfIde)", cls: "host", ours: "宿主侧会话切换动作, 非 webview 键位面" },
];

// R189 · 官方 LanguageServerService 未接入 77 方法逐项甄别(反提 3.4.27 · 后端实测校准):
//   ux — 用户可见且可接入(候选实装); ux-done — 本轮已实装; telemetry — 埋点/上报(无用户面);
//   completion — 编辑器补全/tab 管线(宿主 IDE 原生补全域, 非聊天面板域); experiment — 实验/灰度开关;
//   internal — LS 内部/生命周期; removed — 官方已弃用(后端实测报 removed); deploy — WindsurfJS 部署域(未开放)。
const RPC_GAP_AUDIT = {
  CreateTrajectoryShare: "ux-done", // 会话分享链接(后端实测: {cascadeId,shareStatus:TEAM}→shareId)
  GetTranscription: "ux", GetProfileData: "ux", GetKnowledgeBaseItemsForTeam: "ux",
  SetPinnedContext: "ux", SetPinnedGuideline: "ux", GetSuggestedContextScopeItems: "ux",
  SubmitBugReport: "ux", GetGithubPullRequestSearchInfo: "ux", GetCascadeModelConfigs: "ux",
  RecordChatFeedback: "ux", GetChatMessage: "ux", RawGetChatMessage: "ux",
  GetConversationTags: "removed", UpdateConversationTags: "removed", // 后端实测: feature has been removed
  AcceptCompletion: "completion", ProvideCompletionFeedback: "completion", OnEdit: "completion",
  HandleStreamingTab: "completion", HandleStreamingCommand: "completion",
  HandleStreamingTerminalCommand: "completion", StreamTerminalShellCommand: "completion",
  CaptureCode: "completion", CaptureFile: "completion", GetMatchingCodeContext: "completion",
  GetCodeMapsForFile: "completion", GetCodeValidationStates: "completion", CheckBugs: "completion",
  GetPatchAndCodeChange: "completion", RefreshContextForIdeAction: "completion",
  GetMatchingIndexedRepos: "completion", WellSupportedLanguages: "completion",
  GenerateVibeAndReplaceStreaming: "completion",
  RecordEvent: "telemetry", RecordLints: "telemetry", RecordSystemMetrics: "telemetry",
  RecordUserGrep: "telemetry", RecordUserStepSnapshot: "telemetry", RecordSearchDocOpen: "telemetry",
  RecordSearchResultsView: "telemetry", RecordCommitMessageSave: "telemetry",
  RecordChatPanelSession: "telemetry", LogCascadeSession: "telemetry", UploadRecentCommands: "telemetry",
  ProgressBars: "telemetry",
  SetBaseExperiments: "experiment", UpdateDevExperiments: "experiment",
  UpdateEnterpriseExperimentsFromUrl: "experiment", GetUnleashData: "experiment",
  ShouldEnableUnleash: "experiment", GetExternalModel: "experiment",
  ResetOnboarding: "experiment", SkipOnboarding: "experiment", SetupUniversitySandbox: "experiment",
  Exit: "internal", CancelRequest: "internal", GetStatus: "internal", GetAuthToken: "internal",
  MigrateApiKey: "internal", GetPrimaryApiKeyForDevsOnly: "internal", StatUri: "internal",
  GetSystemPromptAndTools: "internal", GetBrainStatus: "internal",
  ForceBackgroundResearchRefresh: "internal", ReplayGroundTruthTrajectory: "internal",
  ResolveOutstandingSteps: "internal", SendActionToChatPanel: "internal",
  UpdatePanelStateWithUserStatus: "internal", SyncExploreAgentRun: "internal",
  BranchCascadeAndGenerateCodeMap: "internal", MountCascadeFilesystem: "internal",
  UnmountCascadeFilesystem: "internal", UpdateAutoCascadeGithubCredentials: "internal",
  GetActiveAppDeploymentForWorkspace: "deploy", GetWindsurfJSAppDeployment: "deploy",
  SaveWindsurfJSAppProjectName: "deploy", ValidateWindsurfJSAppProjectName: "deploy",
};

// 官方非命令 contributes 面(R177): 逐面归类。
//   adopted — 官方资源逐字节随包复用(themes/schemas); host — 宿主原生已有; na — 不适用
const SURFACE_AUDIT = [
  { surface: "themes", cls: "adopted", note: "theme-windsurf Devin Dark/Light 逐字节随包(R175)" },
  { surface: "jsonValidation", cls: "adopted", note: "官方 mcp_config/acp_registry JSON Schema 逐字节随包, 同 fileMatch 同校验" },
  { surface: "languages(jsonc: mcp_config.json)", cls: "adopted", note: "同官方: mcp_config.json 按 jsonc 高亮" },
  { surface: "languages(codemap)", cls: "na", note: "官方 codemap 引擎内部格式, 无宿主渲染面" },
  { surface: "configuration", cls: "adopted", note: "插件 configuration 面已有(dao.* 命名空间, 官方语义对位)" },
  { surface: "authentication(windsurf_auth)", cls: "na", note: "官方本体在位时由其提供; 插件登录走 credentials.toml 同一真源" },
  { surface: "menus(commandPalette)", cls: "host", note: "宿主命令面板原生" },
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
    keymap: {
      total: KEYMAP_AUDIT.length,
      parity: KEYMAP_AUDIT.filter((k) => k.cls === "parity").length,
      host: KEYMAP_AUDIT.filter((k) => k.cls === "host").length,
      na: KEYMAP_AUDIT.filter((k) => k.cls === "na").length,
      pending: KEYMAP_AUDIT.filter((k) => k.cls === "pending").length,
    },
    surfaces: {
      total: SURFACE_AUDIT.length,
      adopted: SURFACE_AUDIT.filter((s) => s.cls === "adopted").length,
      host: SURFACE_AUDIT.filter((s) => s.cls === "host").length,
      na: SURFACE_AUDIT.filter((s) => s.cls === "na").length,
    },
    keymapAudit: KEYMAP_AUDIT,
    surfaceAudit: SURFACE_AUDIT,
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

module.exports = { MANIFEST, KEY_PARITY, KEYMAP_AUDIT, CHAT_CLIENT_KEYS, RPC_GAP_AUDIT, SURFACE_AUDIT, audit, register };
