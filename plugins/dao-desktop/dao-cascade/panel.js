// 道 · Cascade 面板(本源校正版) — 单面板 + Agent 切换器,与官方 UX 1:1
// ─────────────────────────────────────────────────────────────────────────────
// 实证(印254 · 真机冷启动 + 登录 + 抓 LS/ACP/DOM):
//   官方是【一个 Cascade 面板 + agent 下拉切换】(Ctrl+' Switch agent),而非三个并列面板。
//   三个 agent 即三模式,后端各走一条 ACP(Agent Client Protocol · JSON-RPC 2.0)轨:
//     · Cascade      → windsurf language_server(本地 gRPC,127.0.0.1:43211)
//     · Devin Local  → 本地 Rust CLI `devin acp`(stdio JSON-RPC · "Affogato Agent")  [Preview]
//     · Devin Cloud  → 远端 ACP `wss://app.devin.ai/api/acp/live`
//   模型选择(SWE-1.6 …,16 组注册表)与 agent 选择是两个正交维度。
//
// 本面板:纯 VS Code 可渲染的 webview,复刻上述 UX,且**彻底自持**(得鱼忘筌):
//   · 引擎:插件内置 engine/<os-arch>/devin(devin-provision 解析,兜底本机安装);
//   · 鉴权:插件自己编排 `devin auth login --force-manual-token-flow`(不依赖 Devin Desktop);
//   · Devin Local:acp-client 真实驱动 `devin acp`,流式(agent_message/thought_chunk)+ 模式(Code/Ask/Plan/Bypass);
//   · Cascade:language_server 同源直连;Devin Cloud:远端 ACP over wss(acp-wss.js)。
const vscode = require("vscode");
const os = require("os");
const fs = require("fs");
const path = require("path");
const { AcpClient, resolveDevinBin } = require("./acp-client");
const { AcpWssClient } = require("./acp-wss");
const { authStatus, startLogin } = require("./devin-provision");
const proxyRuntime = require("./proxy-runtime");
const OI = require("./official-icons"); // 官方图标库(反提 workbench 真源全量 115 枚)
let hostState = null;
try { ({ hostState } = require("../windsurf-shim")); } catch (_) {}

const VIEW_ID = "dao.cascade";

// 三 agent —— 与官方 agent 切换器对齐(id / 标签 / 传输轨 / 是否 Preview)。
const AGENTS = [
  { id: "cascade", label: "Cascade", transport: "language_server", preview: false,
    hint: "Windsurf language_server 本地轨(127.0.0.1:43211)" },
  { id: "devin-local", label: "Devin Local", transport: "acp-stdio", preview: true,
    hint: "本地 `devin acp` · Affogato Agent · stdio JSON-RPC" },
  { id: "devin-cloud", label: "Devin Cloud", transport: "acp-wss", preview: false,
    hint: "远端 ACP · wss://app.devin.ai/api/acp/live" },
];

// 官方同义 prepareProfilePictureBase64: 宿主侧取回头像转 data URI(webview CSP 只放行 data:)。
// 失败返回 null(与官方 catch→sentry 静默同语义)。上限 512KB, 防异常大图。
function profilePictureDataUrl(url) {
  return new Promise((resolve) => {
    try {
      const mod = url.startsWith("https:") ? require("https") : require("http");
      const req = mod.get(url, { timeout: 8000 }, (res) => {
        if (res.statusCode !== 200) { res.resume(); return resolve(null); }
        const mime = String(res.headers["content-type"] || "image/png").split(";")[0];
        const bufs = []; let n = 0;
        res.on("data", (b) => { n += b.length; if (n > 512 * 1024) { req.destroy(); resolve(null); } else bufs.push(b); });
        res.on("end", () => resolve("data:" + mime + ";base64," + Buffer.concat(bufs).toString("base64")));
        res.on("error", () => resolve(null));
      });
      req.on("timeout", () => { req.destroy(); resolve(null); });
      req.on("error", () => resolve(null));
    } catch (_) { resolve(null); }
  });
}

function nonce() {
  let s = "";
  const c = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) s += c.charAt(Math.floor(Math.random() * c.length));
  return s;
}

class CascadePanelProvider {
  constructor(context, log, viewId) {
    this._ctx = context;
    this._log = log || (() => {});
    this._viewId = viewId || VIEW_ID;
    this._view = null;
    this._acp = null;       // Devin Local 的 ACP 客户端(懒启动)
    this._acpReady = false;
  }

  resolveWebviewView(webviewView) {
    this._view = webviewView;
    this._disposed = false;
    // 官方宿主态(LS 端口/CSRF/登录)变更 → 刷新 env 行，与官方登录模式同源
    if (hostState) { const h = hostState(); const fn = () => { this._pushEnvSoon(); this._handleSessionsList(); this._pushCascadeConfigOptions(); }; h.listeners.add(fn);
      webviewView.onDidDispose(() => h.listeners.delete(fn)); }
    const w = webviewView.webview;
    w.options = { enableScripts: true, localResourceRoots: [this._ctx.extensionUri] };
    w.html = this._html(w);

    w.onDidReceiveMessage(async (msg) => {
      try {
        if (msg.type === "ready") {
          this._pushEnv();
          // 官方式面板初始化: 面板就绪即告知 LS 初始化面板状态通道(官方 UI 启动序列同款)
          try { const ls = require("./ls-bridge"); if (ls.ready()) ls.call("InitializeCascadePanelState", {}).catch(() => {}); } catch (_) {}
          this._startHeartbeat();
          // 宿主 LS 发现约需数秒(端口/CSRF), 轮询重试直至全量模型灌入首屏选择器。
          let tries = 0;
          const tick = async () => {
            if (await this._pushCascadeConfigOptions()) return;
            if (++tries < 12) setTimeout(tick, 2000);
          };
          tick();
          this._autoOpenRecent();
          this._pushUserSettings();
          return;
        }
        if (msg.type === "chat") return this._handleChat(msg);
        if (msg.type === "login") return this._handleLogin();
        if (msg.type === "login-code") return this._loginCtrl && this._loginCtrl.submitCode(msg.code);
        if (msg.type === "set-mode") {
          // Cascade 规划模式(cx: 前缀)与 ACP 会话模式分流; 官方对应 STATE_KEYS.cascadePlannerMode
          if (/^cx:/.test(msg.modeId || "")) { this._cascadeMode = msg.modeId.slice(3); this._sbSet({ mode: this._cascadeMode }); return; }
          return this._acp && this._acp.setMode(msg.modeId).catch(() => {});
        }
        if (msg.type === "set-config") {
          if (msg.configId === "model" && msg.agent === "cascade") { this._cascadeModel = msg.value; this._sbSet({ modelLabel: (this._cxModelLabels || {})[msg.value] || msg.value }); return; }
          return this._acp && this._acp.setConfigOption(msg.configId, msg.value).catch((e) => this._post({ type: "error", text: e.message }));
        }
        if (msg.type === "cancel") {
          if (this._cascadeLsId) {
            const ls = require("./ls-bridge");
            // 官方式停止: CancelCascadeInvocationAndWait 同步等 LS 落定运行态, 回执后清 busy(避免停了仍转圈)
            ls.call("CancelCascadeInvocationAndWait", { cascadeId: this._cascadeLsId })
              .then(() => { this._cxRunning = false; this._post({ type: "assistant-done", id: msg.id, text: "⏹ 已停止" }); })
              .catch(() => { ls.call("CancelCascadeInvocation", { cascadeId: this._cascadeLsId }).catch(() => {}); });
          }
          if (this._cloud) this._cloud.cancel();
          return this._acp && this._acp.cancel();
        }
        if (msg.type === "cx-revert") return this._handleCxRevert(msg.stepIndex);
        if (msg.type === "cx-feedback") return this._handleCxFeedback(msg);
        if (msg.type === "cx-step-cancel") return this._handleCxStepCancel(msg.stepIndex);
        if (msg.type === "cx-branch") return this._handleCxBranch(msg.stepIndex, msg.text);
        if (msg.type === "cx-queue-remove" || msg.type === "cx-queue-front" || msg.type === "cx-queue-now") return this._handleCxQueueOp(msg);
        if (msg.type === "worktree-merge") return this._handleWorktreeMerge();
        if (msg.type === "worktree-undo") return this._handleWorktreeUndo();
        if (msg.type === "worktree-open") return this._handleWorktreeOpen();
        if (msg.type === "arena-pick") return this._handleArenaPick(msg.slot);
        if (msg.type === "set-user-setting") return this._handleSetUserSetting(msg.patch);
        if (msg.type === "files-query") return this._handleFilesQuery(msg);
        if (msg.type === "copy") return vscode.env.clipboard.writeText(String(msg.text || "")).then(undefined, () => {});
        if (msg.type === "sessions-list") return this._handleSessionsList();
        if (msg.type === "session-load") return this._handleSessionLoad(msg.sessionId);
        if (msg.type === "session-new") return this._handleSessionNew();
        if (msg.type === "session-archive") return this._handleSessionArchive(msg.sessionId);
        if (msg.type === "session-rename") return this._handleSessionRename(msg.sessionId);
        if (msg.type === "session-export") return this._handleSessionExport(msg.sessionId);
        if (msg.type === "share-conversation") return this._handleShareConversation();
        if (msg.type === "transcribe") return this._handleTranscribe(msg.b64);
        if (msg.type === "record-start") return this._handleRecordStart();
        if (msg.type === "record-stop") return this._handleRecordStop();
        if (msg.type === "bug-report") return this._handleBugReport();
        if (msg.type === "open-file") return this._handleOpenFile(msg.path);
        if (msg.type === "memories-list") return this._handleMemoriesList();
        if (msg.type === "status-info") return this._handleStatusInfo();
        // 顶部模式标签(官方 Agent/Editor 对位): Agent → 整窗会话看板; ⚙ → Devin Settings 整页。
        if (msg.type === "open-agent-board") return vscode.commands.executeCommand("dao.cascade.agentBoard");
        if (msg.type === "open-devin-settings") return vscode.commands.executeCommand("dao.cascade.openSettings");
        if (msg.type === "open-customizations") return this._customizationsQuickPick();
        if (msg.type === "timeline-list") return this._handleTimelineList();
        if (msg.type === "worktree-create") return this._handleWorktreeCreate();
        if (msg.type === "outline-list") return this._handleOutlineList();
        if (msg.type === "plans-list") return this._handlePlansList();
        if (msg.type === "plan-create") return this._handlePlanCreate();
        if (msg.type === "custom-list") return this._handleCustomizationsList();
        if (msg.type === "custom-create") return this._handleCustomizationCreate(msg.kind);
        if (msg.type === "custom-wf-copy") return this._handleWorkflowCopy(msg.name);
        if (msg.type === "insert-terminal") { // 官方 Insert in terminal 同义: 送入活动终端不回车
          const t = vscode.window.activeTerminal || vscode.window.createTerminal("dao");
          t.show(false); t.sendText(String(msg.text || ""), false); return; }
        if (msg.type === "cx-ack") return this._handleCxAck(msg.file, !!msg.accept, !!msg.created);
        if (msg.type === "mcp-list") return this._handleMcpList();
        if (msg.type === "mcp-refresh") return this._handleMcpRefresh();
        if (msg.type === "mcp-add") return this._handleMcpAdd();
        if (msg.type === "mcp-config-open") return this._handleMcpConfigOpen();
        if (msg.type === "mcp-toggle") return this._handleMcpToggle(msg.name);
        if (msg.type === "mcp-store") return this._handleMcpStore();
        if (msg.type === "agents-registry") return this._handleAgentsRegistry();
        if (msg.type === "codemaps-list") return this._handleCodeMapsList();
        if (msg.type === "codemap-generate") return this._handleCodeMapGenerate(msg.prompt);
        if (msg.type === "codemap-meta") return this._handleCodeMapMeta(msg.id, msg.starred, msg.archived);
        if (msg.type === "codemap-share") return this._handleCodeMapShare(msg.id);
        if (msg.type === "codemap-import") return this._handleCodeMapImport();
        if (msg.type === "codemap-sug-dismiss") return this._handleCodeMapSugDismiss(msg.id);
        if (msg.type === "open-file-line") return this._handleOpenFileLine(msg.path, msg.line);
        if (msg.type === "mcp-store-install") return this._handleMcpStoreInstall(msg.id, msg.link);
        if (msg.type === "store-open") return void vscode.env.openExternal(vscode.Uri.parse(msg.url)).then(undefined, () => {});
        if (msg.type === "custom-refresh") return this._handleCustomRefresh();
        if (msg.type === "custom-import-cursor") return this._handleCursorImport();
        if (msg.type === "mcp-tool-toggle") return this._handleMcpToolToggle(msg.server, msg.tool);
        if (msg.type === "mcp-prompt-run") return this._handleMcpPromptRun(msg.server, msg.prompt, msg.args);
        if (msg.type === "account-status") { this._acctPopOpen = true; return this._handleAccountStatus(); }
        if (msg.type === "avatar-cmd") return this._handleAvatarCmd(msg.id);
        if (msg.type === "account-close") { this._acctPopOpen = false; return; }
        if (msg.type === "token-query") return this._handleTokenQuery(msg.reqId, msg.text);
        if (msg.type === "memory-delete") return this._handleMemoryDelete(msg.id);
        if (msg.type === "memory-edit") return this._handleMemoryEdit(msg.memory);
        if (msg.type === "history-open") return this.showHistory();
        if (msg.type === "permission-reply") {
          const r = this._permPending && this._permPending.get(msg.reqId);
          if (r) { this._permPending.delete(msg.reqId); r(msg.optionId || null); }
          return;
        }
      } catch (e) {
        this._post({ type: "error", id: msg && msg.id, text: String(e && e.message ? e.message : e) });
      }
    });

    webviewView.onDidDispose(() => {
      if (this._acp) { this._acp.stop(); this._acp = null; this._acpReady = false; }
      if (this._cloud) { this._cloud.stop(); this._cloud = null; }
      this._disposed = true;
      if (this._cxWatch) { try { this._cxWatch.close(); } catch (_) {} this._cxWatch = null; }
    });
  }

  _post(m) { if (this._view) this._view.webview.postMessage(m); }

  // 同步底部状态栏(官方本体把账号/引擎态放 IDE 状态栏, 插件版在 status-bar.js 补齐)
  _sbSet(patch) { try { if (this._sb) this._sb.set(patch); } catch (_) {} }

  // Cascade 规划模式 → 官方 plannerConfig 配方(二进制实测):
  //   write=agentic; plan=agentic+exit_plan_mode 工具;
  //   其余走 conversationalV2.plannerMode(exa.codeium_common_pb.ConversationalPlannerMode)
  // 任何 plannerConfig 使用前兼保模型已解析(历史会话直接分支/入队时 _cascadeModel 可能为空)
  async _cxEnsureModel() {
    if (this._cascadeModel) return;
    try {
      const ls = require("./ls-bridge");
      const models = await ls.listModels();
      const usable = models.filter((m) => !m.disabled);
      const en = usable.find((m) => !/BYOK/i.test(m.label)) || usable[0];
      this._cascadeModel = (en && en.uid) || "swe-1-6-slow";
    } catch (_) { this._cascadeModel = "swe-1-6-slow"; }
  }

  // 官方式 LS 保活: Heartbeat 每 60s 一次(官方扩展同款, LS 以此判定扩展存活)。
  _startHeartbeat() {
    if (this._hbTimer) return;
    const beat = () => {
      try { const ls = require("./ls-bridge"); if (ls.ready()) ls.call("Heartbeat", {}).catch(() => {}); } catch (_) {}
    };
    beat();
    this._hbTimer = setInterval(beat, 60000);
    if (this._view) this._view.onDidDispose(() => { clearInterval(this._hbTimer); this._hbTimer = null; });
  }

  // 与官方 composer 对齐: 全量模型灌入 webview 模型选择器(config-options 同渠)。
  // 官方首屏(New session)即列全模型, 故此处提前推送, 不再懒到首条消息发送时。
  // 1:1 复刻官方: 列全部模型(含 Pro 门控禁用项), 标注倍率(Nx)与禁用原因(灰置+title)。
  async _pushCascadeConfigOptions() {
    try {
      const ls = require("./ls-bridge");
      if (!ls.ready() || !ls.apiKey()) return false;
      const models = await ls.listModels();
      if (!models.length) return false;
      // 官方式模型健康位: GetModelStatuses → {statuses:{uid:{status,message}}}(当前多为空, 防御式合入)
      let mStatus = {};
      try { const st = await ls.call("GetModelStatuses", {}); mStatus = (st && st.statuses) || {}; } catch (_) {}
      // 官方排序菜单同源(clientModelSorts: Recommended/Provider/Cost)
      let mSorts = [];
      try { mSorts = await ls.listModelSorts(); } catch (_) {}
      this._cxImageModels = new Set(models.filter((m) => m.images).map((m) => m.uid));
      this._cxModelLabels = {};
      for (const m of models) this._cxModelLabels[m.uid] = m.label;
      if (!this._cascadeModel) {
        const usable = models.filter((m) => !m.disabled);
        const en = usable.find((m) => !/BYOK/i.test(m.label)) || usable[0];
        this._cascadeModel = (en && en.uid) || "swe-1-6-slow";
      }
      this._sbSet({ modelLabel: this._cxModelLabels[this._cascadeModel] || null, mode: this._cascadeMode || "write" });
      this._post({ type: "config-options", agent: "cascade", configOptions: [{
        id: "model", category: "model", currentValue: this._cascadeModel,
        sorts: mSorts,
        options: models.map((m) => ({
          value: m.uid,
          name: m.label,
          credit: m.credit,
          disabled: !!m.disabled,
          description: [
            (mStatus[m.uid] && (mStatus[m.uid].message || mStatus[m.uid].status)) || "",
            m.disabled ? (m.reason ? m.reason + " · " + (m.reasonLink || "") : "需升级方案") : "",
            m.dims && m.dims.length ? m.dims.join(" · ") : "",
            m.pricing || "",
          ].filter(Boolean).join("  |  "),
          family: m.familyUid || "",
          familyLabel: m.familyLabel || "",
          recommended: !!m.recommended,
          images: !!m.images,
        })),
      }, {
        id: "mode", category: "mode", currentValue: "cx:" + (this._cascadeMode || "write"),
        options: [
          // 官方 3.4.x 模式三元组(实机菜单 1:1: Code/Ask/Plan + 官方描述文案)
          { value: "cx:write", name: "Code", description: "Can write and edit code" },
          { value: "cx:readOnly", name: "Ask", description: "Reads but won't edit" },
          { value: "cx:plan", name: "Plan", description: "Plan changes before implementing" },
          // 扩展(LS conversationalV2 直通, 官方菜单不露出)
          { value: "cx:chat", name: "Chat", description: "扩展 · conversationalV2 · DEFAULT" },
          { value: "cx:explore", name: "Explore", description: "扩展 · conversationalV2 · EXPLORE" },
          { value: "cx:noTool", name: "No-Tool", description: "扩展 · conversationalV2 · NO_TOOL" },
        ],
      }] });
      return true;
    } catch (_) { return false; /* LS 未就绪时静默, ready 重推 */ }
  }

  _cxPlannerConfig() {
    const base = { requestedModelUid: this._cascadeModel, toolConfig: { askUserQuestion: { enabled: true } } };
    const mode = this._cascadeMode || "write";
    if (mode === "plan") {
      base.plannerTypeConfig = { agentic: {} };
      base.toolConfig.exitPlanMode = { enabled: true };
    } else if (mode === "write") {
      base.plannerTypeConfig = { agentic: {} };
    } else {
      const em = { chat: "CONVERSATIONAL_PLANNER_MODE_DEFAULT", readOnly: "CONVERSATIONAL_PLANNER_MODE_READ_ONLY",
        explore: "CONVERSATIONAL_PLANNER_MODE_EXPLORE", noTool: "CONVERSATIONAL_PLANNER_MODE_NO_TOOL" }[mode]
        || "CONVERSATIONAL_PLANNER_MODE_DEFAULT";
      base.plannerTypeConfig = { conversationalV2: { plannerMode: em } };
      // 硬拦截(R34 实测): runCommand.forceDisable 真实移除命令工具; 写盘类(code 工具)无 forceDisable, 仅提示词层
      if (mode === "readOnly" || mode === "noTool") base.toolConfig.runCommand = { forceDisable: true };
    }
    return base;
  }

  _bin() {
    return resolveDevinBin(this._ctx.extensionUri.fsPath,
      this._ctx.globalStorageUri && this._ctx.globalStorageUri.fsPath);
  }

  // 宿主态广播可能短窗内连发(端口/CSRF/登录态逐项到位各 fire 一次) —— 400ms 尾沿去抖,
  // 配合 devin-provision.authStatus 的单飞+TTL 缓存, 根治 auth status 子进程风暴。
  _pushEnvSoon() {
    if (this._envDebounce) clearTimeout(this._envDebounce);
    this._envDebounce = setTimeout(() => { this._envDebounce = null; this._pushEnv(); }, 400);
  }

  // 环境探测:引擎二进制 + 自持鉴权状态(决定 Devin Local/Cloud 能否真实驱动)。
  // force=true 绕过去抖缓存(登录/登出后需立即取真值)。
  async _pushEnv(force) {
    const bin = this._bin();
    const auth = await authStatus(bin, force ? { force: true } : undefined);
    // 官方本体上报的宿主态: language_server 端口/CSRF(Cascade 轨) + 官方登录态(1:1 同源)
    const h = hostState ? hostState() : null;
    // 端口活性裁决: 宿主退出后落盘态仍留旧端口, TCP 探活防「陈旧就绪」假象。
    let lsAlive = false;
    try { lsAlive = await require("./ls-bridge").probeAlive(); } catch (_) {}
    const ws = h ? { lsPort: lsAlive ? (h.lsPort || 0) : 0, lsCsrf: !!h.csrfToken,
      authName: (h.auth && (h.auth.userName || h.auth.name || h.auth.email)) || null,
      authSignedIn: !!(h.auth && (h.auth.loggedIn === true || h.auth.state === "signed-in" || h.auth.apiKey || h.auth.userName || h.auth.name)) } : null;
    const folder = (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0]
      && vscode.workspace.workspaceFolders[0].name) || null;
    // ACP 会话已就绪即证明凭据有效 — `devin auth status` 冷启动超时时以此兜底, 避免误显未登录
    const loggedIn = auth.loggedIn || !!(this._acpReady && this._acp);
    if (bin && !loggedIn && (this._envRetries = (this._envRetries || 0) + 1) <= 3)
      setTimeout(() => this._pushEnv(), 10000);
    this._post({ type: "env", devinBin: bin || null, agents: AGENTS,
      loggedIn, userName: auth.name, windsurf: ws, folder });
    // 三模式引擎态归一发布(fused.engines): 归一面板主页/桥接 API 直接消费, 与本面板 env 同源。
    // Cascade 登录态经 ls-bridge.cascadeAuth 单一裁决(复用官方唯一登录, 与归一面板同判据)。
    let ca = { signedIn: !!(ws && ws.authSignedIn), name: (ws && ws.authName) || "" };
    try { ca = require("./ls-bridge").cascadeAuth(); } catch (_) {}
    try {
      require("./host-state").publishFused("engines", {
        cascade: { ready: !!(ws && ws.lsPort), lsPort: (ws && ws.lsPort) || 0,
          signedIn: ca.signedIn, name: ca.name },
        devinLocal: { bin: !!bin, signedIn: !!auth.loggedIn, name: auth.name || "" },
        devinCloud: { signedIn: !!auth.loggedIn, name: auth.name || "",
          endpoint: "wss://app.devin.ai/api/acp/live" },
      });
    } catch (_) {}
    this._sbSet({ lsReady: !!(ws && ws.lsPort), user: (ws && ws.authName) || (ca && ca.name) || auth.name || null });
    this._cxPushWorkflows();
  }

  // Cascade 斜杠命令 = 官方 Workflows(GetAllWorkflows; 内建+工作区 .windsurf/workflows)。
  // LS 服务端自行解析 "/name" 文本(实测 "/review" 直接驱动 review 工作流)，插件仅需补全。
  async _cxPushWorkflows(retry) {
    try {
      const ls = require("./ls-bridge");
      if (!ls.ready()) {
        if ((retry || 0) < 5) setTimeout(() => this._cxPushWorkflows((retry || 0) + 1), 3000);
        return;
      }
      const r = await ls.call("GetAllWorkflows", {});
      const cmds = (r.workflows || []).filter((w) => w.name).map((w) => ({
        name: w.name, description: w.description || (w.isBuiltin ? "内建 workflow" : "workflow") }));
      if (cmds.length) this._post({ type: "commands", agent: "cascade", commands: cmds });
    } catch (_) {}
  }

  // 自持登录:插件自己编排 `devin auth login --force-manual-token-flow`,
  // 凭据落本机标准路径 —— 彻底不依赖 Devin Desktop 宿主。
  _handleLogin() {
    const bin = this._bin();
    if (!bin) return this._post({ type: "login-state", state: "error", text: "未找到 devin 引擎二进制" });
    if (this._loginCtrl) this._loginCtrl.cancel();
    this._loginCtrl = startLogin(bin, {
      onUrl: (url) => {
        this._post({ type: "login-state", state: "url", url });
        vscode.env.openExternal(vscode.Uri.parse(url)).then(undefined, () => {});
      },
      onDone: (r) => {
        this._loginCtrl = null;
        this._post({ type: "login-state", state: r.ok ? "ok" : "error", text: r.message });
        this._pushEnv(true);
      },
    });
  }

  // 单飞 + 失败退避 + 先停旧再起新:任何失败路径都不留孤儿 `devin acp` 子进程。
  async _ensureAcp() {
    if (this._acpReady && this._acp) return true;
    if (this._acpStarting) return this._acpStarting;
    if (this._acpFailAt && Date.now() - this._acpFailAt < (this._acpBackoff || 0)) return false;
    const bin = this._bin();
    if (!bin) return false;
    this._permPending = this._permPending || new Map();
    this._acpStarting = (async () => {
      if (this._acp) { try { this._acp.stop(); } catch (_) {} this._acp = null; }
      const acp = new AcpClient({
        bin,
        cwd: (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0]
          && vscode.workspace.workspaceFolders[0].uri.fsPath) || process.cwd(),
        log: this._log,
        onUpdate: (params) => this._onAcpUpdate(params),
        onPermission: (params) => this._askPermission(params),
        onExit: () => { if (this._acp === acp) { this._acp = null; this._acpReady = false; } },
      });
      try {
        acp.start();
        await acp.initialize();
        // 自持凭据:CLI 本地已登录时 session/new 直接可用;仅会话令牌等未落
        // credentials.toml 的登录态下 ACP host 会要求先 authenticate(meta.api_key),
        // 此时用官方登录态 apiKey(ls-bridge 同源: credentials.toml→globalStorage)补鉴权。
        let res;
        try {
          res = await acp.newSession();
        } catch (e) {
          if (!/authenticat/i.test(String(e && e.message || e))) throw e;
          const key = (() => { try { return require("./ls-bridge").apiKey(); } catch (_) { return ""; } })();
          if (!key) throw new Error("ACP 需鉴权且未取得 apiKey(credentials.toml/globalStorage 均空),请先登录");
          this._log("[acp] session/new 需鉴权 → authenticate(windsurf-api-key) 后重试");
          await acp.authenticate("windsurf-api-key", key);
          res = await acp.newSession();
        }
        this._acp = acp;
        this._acpReady = true;
        this._acpFailAt = 0; this._acpBackoff = 0;
        this._pushEnv();
        this._pushSessionMeta(res);
        this._handleSessionsList();
        return true;
      } catch (e) {
        try { acp.stop(); } catch (_) {}
        this._acpFailAt = Date.now();
        this._acpBackoff = Math.min(Math.max((this._acpBackoff || 0) * 2, 5000), 300000);
        this._log("[acp] 启动失败(退避 " + this._acpBackoff + "ms): " + String(e && e.message || e));
        return false;
      } finally {
        this._acpStarting = null;
      }
    })();
    return this._acpStarting;
  }

  _pushSessionMeta(res) {
    if (!res) return;
    if (res.modes) this._post({ type: "modes", modes: res.modes });
    if (res.configOptions) this._post({ type: "config-options", agent: "acp", configOptions: res.configOptions });
    if (this._acp && this._acp.sessionId) this._post({ type: "session-current", sessionId: this._acp.sessionId });
  }

  // 权限请求 → webview 内联按钮;超时/无人应答时回 null 由 acp-client 默认允许一次。
  _askPermission(params) {
    const reqId = "p" + Date.now() + Math.random().toString(36).slice(2, 6);
    return new Promise((resolve) => {
      this._permPending.set(reqId, resolve);
      const tc = params.toolCall || {};
      this._post({ type: "permission", reqId, title: tc.title || tc.kind || "工具调用",
        options: (params.options || []).map((o) => ({ optionId: o.optionId, name: o.name, kind: o.kind })) });
      setTimeout(() => {
        if (this._permPending.has(reqId)) { this._permPending.delete(reqId); resolve(null); this._post({ type: "permission-close", reqId }); }
      }, 60000);
    });
  }

  // 官方式 @ 提及:检索工作区文件作为上下文。无工作区文件夹时回空并置 noWorkspace,
  // 由 webview 提示"打开文件夹后可 @ 引用文件"(与官方在空窗口下的降级一致)。
  // 官方式 @docs: GetWebDocsOptions → {options:[{label,docsUrl}]}，提及时插入 llms.txt URL 让 Cascade 拉取
  async _docsOptions() {
    if (this._docsOpts) return this._docsOpts;
    try {
      const ls = require("./ls-bridge");
      const r = await ls.call("GetWebDocsOptions", {});
      this._docsOpts = (r.options || []).map((o) => ({ label: o.label, url: o.docsUrl }));
    } catch (_) { this._docsOpts = []; }
    return this._docsOpts;
  }

  // 官方式 @code 符号: GetMatchingContextScopeItems → codeContext{nodeName,nodeLineage,
  // workspacePaths[].relativePath,startLine,endLine,contextType} — 与官方 @ 菜单 Code 类目同源
  async _symbolsQuery(q) {
    if (!q || q.length < 2) return [];
    try {
      const ls = require("./ls-bridge");
      const r = await ls.call("GetMatchingContextScopeItems", { query: q });
      return (r.items || []).map((it) => it.codeContext).filter(Boolean).slice(0, 6).map((c) => ({
        name: c.nodeName || "",
        lineage: (c.nodeLineage || []).join("."),
        path: (((c.workspacePaths || [])[0]) || {}).relativePath || "",
        line: (c.startLine || 0) + 1,
        endLine: (c.endLine || 0) + 1,
        kind: /CLASS/.test(c.contextType || "") ? "class" : "fn",
      }));
    } catch (e) { this._log("[syms] " + e.message); return []; }
  }

  async _handleFilesQuery(msg) {
    const q = (msg.query || "").toLowerCase();
    const docs = (await this._docsOptions())
      .filter((d) => q && d.label.toLowerCase().includes(q)).slice(0, 6);
    const syms = await this._symbolsQuery(msg.query || "");
    const folders = vscode.workspace.workspaceFolders || [];
    if (!folders.length) {
      return this._post({ type: "files", reqId: msg.reqId, files: [], docs, syms, noWorkspace: true });
    }
    try {
      const exclude = "{**/node_modules/**,**/.git/**,**/dist/**,**/out/**,**/.venv/**,**/__pycache__/**}";
      const uris = await vscode.workspace.findFiles("**/*", exclude, 2000);
      let rels = uris.map((u) => vscode.workspace.asRelativePath(u, false));
      if (q) {
        const starts = [], subseq = [];
        for (const r of rels) {
          const base = r.split("/").pop().toLowerCase();
          if (base.startsWith(q) || r.toLowerCase().startsWith(q)) starts.push(r);
          else if (r.toLowerCase().includes(q)) subseq.push(r);
        }
        rels = starts.concat(subseq);
      } else {
        rels.sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b));
      }
      this._post({ type: "files", reqId: msg.reqId, files: rels.slice(0, 20), docs, syms });
    } catch (e) {
      this._log("[files-query] " + e.message);
      this._post({ type: "files", reqId: msg.reqId, files: [], docs, syms });
    }
  }

  // 官方式步级撤销: CancelCascadeSteps{cascadeId,stepIndices[]} 取消指定进行中步骤(不停整轮)
  async _handleCxStepCancel(stepIndex) {
    if (!this._cascadeLsId || typeof stepIndex !== "number") return;
    const ls = require("./ls-bridge");
    try { await ls.call("CancelCascadeSteps", { cascadeId: this._cascadeLsId, stepIndices: [stepIndex] }); }
    catch (e) { this._post({ type: "error", text: "取消步骤失败: " + e.message }); }
  }

  // 官方式步卡内容: 轨迹步 metadata.toolCall{name,argumentsJson} → 工具名 + 关键参数
  _cxStepCard(st, k, id) {
    if (st.codeAction) return this._cxDiffCard(st, k, id);
    if (st.runCommand) return this._cxCmdCard(st, k, id);
    if (st.listDirectory) return this._cxBrowseCard(st, k, id);
    if (st.grepSearch) return this._cxBrowseCard(st, k, id);
    if (st.viewFile) return this._cxBrowseCard(st, k, id);
    // EXIT_PLAN_MODE 步(Plan 模式产物): exitPlanMode{planFile,userRequested} → 计划就绪卡
    if (st.exitPlanMode) {
      const pf = st.exitPlanMode.planFile || "";
      return { type: "tool-call", id, toolCallId: "cx" + k,
        title: "Plan ready" + (pf ? " · " + pf : ""),
        kindName: "cascade",
        status: /DONE/.test(st.status || "") ? "completed" : /ERROR/.test(st.status || "") ? "failed" : "in_progress",
        locations: pf ? [{ path: pf }] : [] };
    }
    const tc = (st.metadata || {}).toolCall || {};
    let title = tc.name || (st.type || "").replace("CORTEX_STEP_TYPE_", "").toLowerCase().replace(/_/g, " ");
    try {
      const a = JSON.parse(tc.argumentsJson || "{}");
      const v = a.CommandLine || a.Command || a.Query || a.SearchPath || a.AbsolutePath || a.TargetFile || a.DirectoryPath || a.Url || a.Path;
      if (v) title += " · " + String(v).slice(0, 80);
    } catch (_) {}
    return { type: "tool-call", id, toolCallId: "cx" + k, title,
      kindName: "cascade", stepIndex: k,
      status: /DONE/.test(st.status || "") ? "completed" : /ERROR/.test(st.status || "") ? "failed" : "in_progress",
      locations: [] };
  }

  // 官方式代码变更卡: CODE_ACTION 步 codeAction.actionResult.edit.diff.unifiedDiff → 文件名+增删徽标+彩色 diff
  _cxDiffCard(st, k, id) {
    const ca = st.codeAction || {};
    const res = (ca.actionResult || {}).edit || {};
    const spec = ca.actionSpec || {};
    const uri = res.absoluteUri || (((spec.createFile || spec.editFile || {}).path) || {}).absoluteUri || "";
    const file = decodeURIComponent(uri.replace(/^file:\/\//, ""));
    const lines = ((((res.diff || {}).unifiedDiff) || {}).lines || []).map((l) => ({
      t: /INSERT/.test(l.type || "") ? "+" : /DELETE/.test(l.type || "") ? "-" : " ",
      text: l.text || "" }));
    return { type: "code-diff", id, toolCallId: "cx" + k, file,
      created: !!(res.createFile || spec.createFile),
      status: /DONE/.test(st.status || "") ? "completed" : /ERROR/.test(st.status || "") ? "failed" : "in_progress",
      lines };
  }

  // 官方式终端卡: RUN_COMMAND 步 runCommand{commandLine,cwd,exitCode,combinedOutput.full}
  _cxCmdCard(st, k, id) {
    const rc = st.runCommand || {};
    return { type: "cmd-card", id, toolCallId: "cx" + k,
      command: rc.commandLine || rc.proposedCommandLine || "",
      cwd: rc.cwd || "",
      exitCode: typeof rc.exitCode === "number" ? rc.exitCode : null,
      output: ((rc.combinedOutput || {}).full) || "",
      status: /DONE/.test(st.status || "") ? "completed" : /ERROR/.test(st.status || "") ? "failed" : "in_progress" };
  }

  // 官方式检索/浏览卡: LIST_DIRECTORY / GREP_SEARCH / VIEW_FILE 步 →
  // 「Analyzed <目录> · N 项 / Searched <词> in <路径> · N 处 / Read <文件> L a-b」+ 展开明细
  _cxBrowseCard(st, k, id) {
    const status = /DONE/.test(st.status || "") ? "completed" : /ERROR/.test(st.status || "") ? "failed" : "in_progress";
    const base = { type: "browse-card", id, toolCallId: "cx" + k, status };
    const fromUri = (u) => decodeURIComponent(String(u || "").replace(/^file:\/\//, ""));
    if (st.listDirectory) {
      const ld = st.listDirectory;
      const items = (ld.results || []).map((r) => ({
        name: r.name || "", isDir: !!r.isDir,
        info: r.isDir ? ((r.numChildren != null ? r.numChildren + " 项" : "")) : (r.sizeBytes != null ? r.sizeBytes + " B" : "") }));
      return Object.assign(base, { kind: "list", file: fromUri(ld.directoryPathUri), count: items.length, items });
    }
    if (st.grepSearch) {
      const gs = st.grepSearch;
      const matches = (gs.results || []).map((r) => ({
        file: r.absolutePath || r.relativePath || "", line: r.lineNumber || 0,
        text: r.content || (r.matchCount != null ? r.matchCount + " 处匹配" : "") }));
      return Object.assign(base, { kind: "grep", query: gs.query || "",
        file: fromUri(gs.searchPathUri), count: gs.totalResults != null ? Number(gs.totalResults) : matches.length, matches });
    }
    const vf = st.viewFile || {};
    const start = vf.startLine != null ? Number(vf.startLine) + 1 : 1;
    const end = vf.endLine != null ? Number(vf.endLine) + 1 : null;
    return Object.assign(base, { kind: "view", file: fromUri(vf.absolutePathUri),
      startLine: start, endLine: end, content: vf.content || "" });
  }

  // 官方式自动续聊: 用户设置 openMostRecentChatConversation 为真时, 面板首开即载入最近会话
  // (GetUserSettings 与官方同源; LS 就绪约需数秒, 轮询重试; 用户已有活动会话则不打扰)
  async _autoOpenRecent() {
    const ls = require("./ls-bridge");
    for (let i = 0; i < 12 && (!ls.ready() || !ls.apiKey()); i++) await new Promise((r) => setTimeout(r, 2000));
    if (this._disposed || this._cascadeLsId || this._activeId) return;
    try {
      const s = await ls.call("GetUserSettings", {});
      if (!s || !s.userSettings || s.userSettings.openMostRecentChatConversation !== true) return;
      const list = (await this._cascadeSessions()).sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
      if (!list.length || this._disposed || this._cascadeLsId || this._activeId) return;
      await this._handleSessionLoad(list[0].sessionId);
    } catch (_) {}
  }

  // 官方式 worktree 合并回主工作区: ResolveWorktreeChanges{cascadeId, uris[], mode:MERGE}
  // (后端实测: uris 必填——不带 uris 为空操作; 文件清单取自轨迹摘要 referencedFiles 中的 worktree 内文件;
  //  响应含 hadConflicts/conflictingFiles; 另有 STASH 模式与 UndoWorktreeMerge 可撤销)
  async _handleWorktreeMerge() {
    const ls = require("./ls-bridge");
    try {
      if (!this._cascadeLsId) throw new Error("当前无活动 cascade 会话");
      const all = (await ls.call("GetAllCascadeTrajectories", {})).trajectorySummaries || {};
      const summ = all[this._cascadeLsId] || {};
      const wts = (summ.gitWorktreePaths || []).map((u) => (u.endsWith("/") ? u : u + "/"));
      const uris = (summ.referencedFiles || []).filter((u) => wts.some((w) => u.startsWith(w)));
      if (!uris.length) throw new Error("轨迹中无 worktree 内改动文件可合并");
      const r = await ls.call("ResolveWorktreeChanges", { cascadeId: this._cascadeLsId, uris, mode: "RESOLVE_WORKTREE_CHANGES_MODE_MERGE" });
      const txt = r.hadConflicts
        ? "⚠ 合并存在冲突文件: " + (r.conflictingFiles || []).join(", ")
        : "✓ 已将 " + uris.length + " 个 worktree 改动文件合并回主工作区";
      this._post({ type: "worktree-info", on: true, text: txt, undo: !r.hadConflicts });
    } catch (e) { this._post({ type: "worktree-info", on: true, text: "⚠ 合并失败: " + e.message }); }
  }

  // 官方式撤销合并: UndoWorktreeMerge{cascadeId} 弹出最近一次合并(栈式, 恢复主工作区合并前文件态)
  // (后端实测: 无合并记录时报 not_found "no worktree merge found"; 另有 forceOverwrite/failOnConflicts 参数)
  async _handleWorktreeUndo() {
    const ls = require("./ls-bridge");
    try {
      if (!this._cascadeLsId) throw new Error("当前无活动 cascade 会话");
      await ls.call("UndoWorktreeMerge", { cascadeId: this._cascadeLsId });
      this._post({ type: "worktree-info", on: true, text: "↩ 已撤销最近一次合并，主工作区恢复合并前状态" });
    } catch (e) { this._post({ type: "worktree-info", on: true, text: "⚠ 撤销失败: " + e.message.replace(/^.*no worktree merge found.*$/, "无可撤销的合并记录"), undo: false }); }
  }

  // 官方式在新窗口打开隔离 worktree(轨迹摘要 gitWorktreePaths → vscode.openFolder 新窗)
  async _handleWorktreeOpen() {
    const ls = require("./ls-bridge");
    try {
      if (!this._cascadeLsId) throw new Error("当前无活动 cascade 会话");
      const summ = ((await ls.call("GetAllCascadeTrajectories", {})).trajectorySummaries || {})[this._cascadeLsId] || {};
      const wt = (summ.gitWorktreePaths || [])[0];
      if (!wt) throw new Error("轨迹中无 worktree 路径");
      await vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.parse(wt), { forceNewWindow: true });
    } catch (e) { this._post({ type: "worktree-info", on: true, text: "⚠ 打开失败: " + e.message }); }
  }

  // 官方式设置同源: GetUserSettings → 灌入 ⚔ 初始态(lastArenaModeEnabled)与首页
  // 「自动打开最近会话」开关(openMostRecentChatConversation), 与官方 Settings 页一致。
  async _pushUserSettings() {
    const ls = require("./ls-bridge");
    for (let i = 0; i < 12 && (!ls.ready() || !ls.apiKey()); i++) await new Promise((r) => setTimeout(r, 2000));
    if (this._disposed) return;
    try {
      const s = (await ls.call("GetUserSettings", {})).userSettings || {};
      this._post({ type: "user-settings", arena: s.lastArenaModeEnabled === true, openRecent: s.openMostRecentChatConversation === true });
    } catch (_) {}
  }

  // 官方式设置写回: 读-改-写全量合并(后端实测 SetUserSettings 为整体替换,
  // 直写补丁会清掉 cachedCascadeModelConfigs 等其余字段, 故必须先取后并)。
  async _handleSetUserSetting(patch) {
    const ls = require("./ls-bridge");
    try {
      const s = (await ls.call("GetUserSettings", {})).userSettings || {};
      await ls.call("SetUserSettings", { userSettings: Object.assign(s, patch || {}) });
    } catch (e) { this._log("[settings] " + e.message); }
  }

  // 官方式: Cascade 历史轨迹(GetAllCascadeTrajectories)并入 Recent sessions
  async _cascadeSessions() {
    try {
      const ls = require("./ls-bridge");
      if (!ls.ready() || !ls.apiKey()) return [];
      const r = await ls.call("GetAllCascadeTrajectories", {});
      const m = (r && r.trajectorySummaries) || {};
      const names = this._ctx.globalState.get("dao.cxNames") || {};
      // 官方式归档: summary.isArchived 为真的不入列表(LS 不在服务端过滤, 客户端自筛)
      return Object.keys(m).filter((cid) => !m[cid].isArchived).map((cid) => ({
        sessionId: "cx:" + cid,
        title: "🌊 " + (names[cid] || m[cid].summary || cid),
        updatedAt: m[cid].lastModifiedTime,
        cwd: ((m[cid].workspaces || [])[0] || {}).workspaceFolderAbsoluteUri || "",
      }));
    } catch (e) { this._log("[cascade-sessions] " + e.message); return []; }
  }

  // 官方式实时会话列表: StreamCascadeSummariesReactiveUpdates{protocolVersion:1,id:"summaries"}
  // (Connect server-streaming, 后端实测) —— 任一会话增删/改名/归档即推帧, 以之为变更信号
  // 去抖重拉 Recent sessions, 与官方首页列表实时同步。断流后 5s 自动重连。
  _watchCascadeSummaries() {
    if (this._sumWatching) return;
    const ls = require("./ls-bridge");
    if (!ls.ready() || !ls.apiKey()) return;
    this._sumWatching = true;
    const loop = () => {
      ls.callStream("StreamCascadeSummariesReactiveUpdates", { protocolVersion: 1, id: "summaries" }, () => {
        clearTimeout(this._sumDebounce);
        this._sumDebounce = setTimeout(() => { this._handleSessionsList().catch(() => {}); }, 400);
      }, 24 * 3600 * 1000).catch(() => {}).then(() => {
        if (this._disposed) { this._sumWatching = false; return; }
        setTimeout(loop, 5000);
      });
    };
    loop();
  }

  async _handleSessionsList() {
    this._watchCascadeSummaries();
    let acp = [];
    try {
      if (await this._ensureAcp() && this._acp) {
        const res = await this._acp.listSessions();
        acp = (res && res.sessions) || [];
      }
    } catch (e) { this._log("[sessions] " + e.message); }
    const cx = await this._cascadeSessions();
    const all = acp.concat(cx).sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
    this._post({ type: "sessions", sessions: all, current: this._acp && this._acp.sessionId });
    this._autoBackup();
  }

  // 归一 · Cascade 对话自动备份: 会话列表变更即增量导出轨迹转录(与 dao-one Devin Cloud
  // 备份同构, 同根 ~/.wam/conversation_backups 供全功能面板「💬 对话备份」统一消费)。
  // 去抖 + 串行门闩, 避免流式信号风暴下重入。
  _autoBackup(force) {
    const cfg = vscode.workspace.getConfiguration("dao.cascade");
    if (!force && cfg.get("autoBackup") === false) return;
    clearTimeout(this._bkDebounce);
    this._bkDebounce = setTimeout(async () => {
      if (this._bkRunning) return;
      this._bkRunning = true;
      try {
        const backup = require("./backup");
        const ls = require("./ls-bridge");
        const hs = require("./host-state").hostState();
        const fusedAcct = (hs.fused && hs.fused.account) || {};
        const email = fusedAcct.email || (hs.auth && hs.auth.email) || "";
        const r = await backup.backupAll(ls, { root: cfg.get("backupDir") || "", email, log: this._log });
        if (r.ok && r.saved) this._log("[backup] Cascade 对话备份: 新写 " + r.saved + " / 共 " + r.total + " → " + r.root);
        if (r.ok) this._fusePublish("cascadeBackup", { root: r.root, saved: r.saved, total: r.total });
        else this._log("[backup] Cascade 备份未就绪: " + (r.reason || ""));
        const ra = await this._backupAcpSessions(backup, cfg.get("backupDir") || "", email);
        if (ra && ra.ok && ra.saved) this._log("[backup] Devin(ACP) 会话备份: 新写 " + ra.saved + " / 共 " + ra.total);
        if (force) {
          const acpPart = ra && ra.ok ? (" · Devin(ACP) 新写 " + ra.saved + " / 共 " + ra.total) : "";
          vscode.window.showInformationMessage(r.ok
            ? ("对话备份完成: Cascade 新写 " + r.saved + " / 共 " + r.total + acpPart + " → " + r.root)
            : ("Cascade 备份未就绪: " + (r.reason || "") + acpPart));
        }
      } catch (e) { this._log("[backup] " + e.message); }
      this._bkRunning = false;
    }, force ? 0 : 1500);
  }

  // Devin Local/Cloud(ACP) 会话备份三模式延伸: session/list + session/load 历史回放拼转录。
  // 回放会切换客户端活动会话, 备份后恢复原会话(恢复期间帧经 hookUpdates 截流, 不打扰前端)。
  async _backupAcpSessions(backup, root, email) {
    const clients = [];
    if (this._acpReady && this._acp) clients.push(this._acp);
    if (this._cloud && this._cloud.sessionId) clients.push(this._cloud);
    let agg = null;
    for (const c of clients) {
      if (typeof c.listSessions !== "function" || typeof c.hookUpdates !== "function") continue;
      const prevSid = c.sessionId;
      let r = null;
      try { r = await backup.backupAcp(c, { root, email, log: this._log }); }
      catch (e) { this._log("[backup-acp] " + e.message); }
      finally { c.hookUpdates(null); }
      if (prevSid && c.sessionId !== prevSid) {
        c.hookUpdates(() => {});
        try { await c.loadSession(prevSid); } catch (_) {}
        c.hookUpdates(null);
      }
      if (r && !r.ok && r.reason) this._log("[backup-acp] 跳过: " + r.reason);
      if (r && r.ok) agg = { ok: true, saved: (agg ? agg.saved : 0) + r.saved, total: (agg ? agg.total : 0) + r.total };
    }
    return agg;
  }

  // 归一发布: 插件侧融合态(账户/MCP/备份水位)写入宿主态中枢 → windsurf-host.json,
  // dao-one 主页账号信息与 MCP 板块双逻辑(官方 Devin Cloud 侧 + 插件本地侧)由此同源。
  _fusePublish(part, data) {
    try { require("./host-state").publishFused(part, data); } catch (_) {}
  }

  // 官方式「Response Statistics」: GetCascadeTrajectoryGeneratorMetadata → 每个 planner 步的
  // 模型/输入输出 token/花费/首字延迟, 组成紧凑页脚字符串, 键为该步 stepIndex(与轨迹步下标同)。
  async _cxGenStats(cascadeId) {
    const ls = require("./ls-bridge");
    const fmtS = (s) => { const n = parseFloat(String(s || "").replace("s", "")); return isFinite(n) && n > 0 ? (Math.round(n * 100) / 100) + "s" : ""; };
    const out = { byStep: {}, last: "" };
    let gm; try { gm = await ls.call("GetCascadeTrajectoryGeneratorMetadata", { cascadeId }); } catch (_) { return out; }
    for (const g of ((gm || {}).generatorMetadata || [])) {
      const cm = g.chatModel; if (!cm) continue;
      const u = cm.usage || {};
      let model = "";
      for (const grp of (cm.responseDimensionGroups || [])) for (const d of (grp.dimensions || [])) if (d.uid === "model" && d.metric) model = d.metric.value;
      model = model || u.modelUid || "";
      const parts = [];
      if (model) parts.push(model);
      if (u.inputTokens || u.outputTokens) parts.push("↑" + (u.inputTokens || 0) + " ↓" + (u.outputTokens || 0));
      if (typeof cm.modelCost === "number" && cm.modelCost > 0) parts.push("$" + (cm.modelCost < 0.01 ? cm.modelCost.toFixed(4) : cm.modelCost.toFixed(2)));
      const ttft = fmtS(cm.timeToFirstToken); if (ttft) parts.push(ttft + " 首字");
      const s = parts.join(" · ");
      if (!s) continue;
      for (const si of (g.stepIndices || [])) out.byStep[si] = s;
      out.last = s;
    }
    return out;
  }

  // 官方式回合反馈(👍/👎): 官方链路为 LS→api_server RecordCortexFeedback{cortexId,rating,feedback};
  // LS 本地不暴露该方法, 插件经 apiServerCall 直发同一云端 RPC。rating: 1=👍 2=👎
  async _handleCxFeedback(msg) {
    const cid = this._cascadeLsId;
    if (!cid) return;
    try {
      const ls = require("./ls-bridge");
      await ls.apiServerCall("RecordCortexFeedback", { cortexId: cid, rating: msg.rating, feedback: String(msg.text || "") });
    } catch (e) { this._log("cascade: 反馈上报失败 " + e.message); }
  }

  // 官方式: 载入 Cascade 历史轨迹并回放(用户泡/答复/工具步卡), 后续消息续接同轨
  async _loadCascadeTrajectory(cascadeId) {
    const ls = require("./ls-bridge");
    this._post({ type: "history-clear" });
    const r = await ls.call("GetCascadeTrajectorySteps", { cascadeId });
    const gstats = await this._cxGenStats(cascadeId);
    const steps = ((r.trajectory || r).steps) || [];
    const rid = "cxload" + Date.now();
    for (let k = 0; k < steps.length; k++) {
      const st = steps[k];
      if (st.userInput && (st.userInput.userResponse || (st.userInput.images || []).length)) this._post({ type: "user-replay", text: st.userInput.userResponse || "", images: (st.userInput.images || []).map((im) => "data:" + (im.mimeType || "image/png") + ";base64," + im.base64Data), stepIndex: k });
      else if (st.plannerResponse && (st.plannerResponse.response || st.plannerResponse.thinking)) {
        if (st.plannerResponse.thinking) this._post({ type: "thought-delta", id: rid + k, text: st.plannerResponse.thinking });
        if (st.plannerResponse.response) {
          this._post({ type: "assistant-delta", id: rid + k, text: st.plannerResponse.response });
          this._post({ type: "assistant-done", id: rid + k });
          if (gstats.byStep[k]) this._post({ type: "msg-stats", id: rid + k, text: gstats.byStep[k] });
        }
      } else if (st.errorMessage && st.errorMessage.error) {
        this._post({ type: "assistant-done", id: rid + k, text: "⚠ " + (st.errorMessage.error.userErrorMessage || "") });
      } else if (st.type && !/CHECKPOINT|RETRIEVE_MEMORY|DUMMY|PLANNER_RESPONSE/.test(st.type)) {
        this._post(this._cxStepCard(st, k, rid));
      }
    }
    this._cascadeLsId = cascadeId;
    this._cascadeSeen = steps.length;
    // 加载历史轨迹时恢复 worktree 态: 轨迹摘要含 gitWorktreePaths 即为隔离 worktree 会话
    ls.call("GetAllCascadeTrajectories", {}).then((r) => {
      if (this._cascadeLsId !== cascadeId) return;
      const summ = (r.trajectorySummaries || {})[cascadeId] || {};
      this._cxWorktree = (summ.gitWorktreePaths || []).length > 0;
      if (this._cxWorktree) this._post({ type: "worktree-info", on: true, text: "⏎ 本会话运行于隔离 worktree，改动不直接落入主工作区" });
    }).catch(() => {});
    // 官方限制: 已 converge 过的 cascade 无法再开 Arena(failed_precondition) —— 预先置灰 ⚔
    const inArena = steps.some((s) => s.type === "CORTEX_STEP_TYPE_ARENA_TRAJECTORY_CONVERGE");
    this._post({ type: "arena-avail", ok: !inArena, reason: inArena ? "该会话已经过 Arena 收敛，无法再开" : "" });
    this._post({ type: "history-done" });
    this._watchCascadeTrajectory(cascadeId);
  }

  // 官方式外部续写实时回放: 同一 cascade 被官方面板/他端驱动时, 反应式帧到即拉增量步回放
  // (StreamCascadeReactiveUpdates 帧=轨迹变更信号; 本端发送轮询进行中(_cxRunning)则让位不重复渲染)
  _watchCascadeTrajectory(cascadeId) {
    const ls = require("./ls-bridge");
    if (this._cxWatch) { try { this._cxWatch.close(); } catch (_) {} this._cxWatch = null; }
    this._cxWatchId = cascadeId;
    let t = null;
    const pull = async () => {
      if (this._disposed || this._cxRunning || this._cascadeLsId !== cascadeId) return;
      let r; try { r = await ls.call("GetCascadeTrajectorySteps", { cascadeId }); } catch (_) { return; }
      if (this._cxRunning || this._cascadeLsId !== cascadeId) return;
      const steps = ((r.trajectory || r).steps) || [];
      if (steps.length <= (this._cascadeSeen || 0)) return;
      const gstats = await this._cxGenStats(cascadeId);
      const rid = "cxlive" + Date.now();
      for (let k = this._cascadeSeen || 0; k < steps.length; k++) {
        const st = steps[k];
        if (st.status && !/DONE|ERROR|CANCELLED/.test(st.status)) { steps.length = k; break; } // 未完步待下帧
        if (st.userInput && (st.userInput.userResponse || (st.userInput.images || []).length)) this._post({ type: "user-replay", text: st.userInput.userResponse || "", images: (st.userInput.images || []).map((im) => "data:" + (im.mimeType || "image/png") + ";base64," + im.base64Data), stepIndex: k });
        else if (st.plannerResponse && (st.plannerResponse.response || st.plannerResponse.thinking)) {
          if (st.plannerResponse.thinking) this._post({ type: "thought-delta", id: rid + k, text: st.plannerResponse.thinking });
          if (st.plannerResponse.response) {
            this._post({ type: "assistant-delta", id: rid + k, text: st.plannerResponse.response });
            this._post({ type: "assistant-done", id: rid + k });
            if (gstats.byStep[k]) this._post({ type: "msg-stats", id: rid + k, text: gstats.byStep[k] });
          }
        } else if (st.errorMessage && st.errorMessage.error) {
          this._post({ type: "assistant-done", id: rid + k, text: "⚠ " + (st.errorMessage.error.userErrorMessage || "") });
        } else if (st.type && !/CHECKPOINT|RETRIEVE_MEMORY|DUMMY|PLANNER_RESPONSE/.test(st.type)) {
          this._post(this._cxStepCard(st, k, rid));
        }
        this._cascadeSeen = k + 1;
      }
    };
    this._cxWatch = ls.driveStream(cascadeId, () => { clearTimeout(t); t = setTimeout(pull, 300); });
  }

  async _handleSessionLoad(sessionId) {
    if (sessionId && sessionId.startsWith("cx:")) {
      try { return await this._loadCascadeTrajectory(sessionId.slice(3)); }
      catch (e) { return this._post({ type: "error", text: "加载 Cascade 轨迹失败: " + e.message }); }
    }
    try {
      if (!(await this._ensureAcp()) || !this._acp)
        return this._post({ type: "error", text: "加载会话失败: ACP 未就绪(未登录或启动退避中)" });
      this._post({ type: "history-clear" });
      this._replaying = true;
      this._activeId = "r" + Date.now();
      const res = await this._acp.loadSession(sessionId);
      this._replaying = false;
      this._pushSessionMeta(res || { modes: this._acp.modes });
      this._post({ type: "history-done" });
      this._handleSessionsList();
    } catch (e) {
      this._replaying = false;
      this._post({ type: "error", text: "加载会话失败: " + e.message });
    }
  }

  // 视图标题栏动作(官方式):历史会话 QuickPick
  async showHistory() {
    try {
      let sessions = [];
      try {
        if (await this._ensureAcp() && this._acp) {
          const res = await this._acp.listSessions();
          sessions = (res && res.sessions) || [];
        }
      } catch (_) {}
      sessions = sessions.concat(await this._cascadeSessions())
        .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
      if (!sessions.length) { vscode.window.showInformationMessage("暂无历史会话"); return; }
      const pick = await vscode.window.showQuickPick(sessions.map((s) => ({
        label: s.title || s.sessionId,
        description: s.updatedAt ? new Date(s.updatedAt).toLocaleString() : "",
        detail: s.cwd || "",
        sessionId: s.sessionId,
      })), { placeHolder: "加载历史会话" });
      if (pick) await this._handleSessionLoad(pick.sessionId);
    } catch (e) { vscode.window.showErrorMessage("历史会话加载失败: " + e.message); }
  }

  // 官方式: 归档 Cascade 轨迹(ArchiveCascadeTrajectory{cascadeId,isArchived:true} 置标,
  // 列表侧按 isArchived 自筛; 失败则退回 DeleteCascadeTrajectory 硬删)
  async _handleSessionArchive(sessionId) {
    if (!sessionId || !sessionId.startsWith("cx:")) return;
    try {
      const ls = require("./ls-bridge");
      await ls.call("ArchiveCascadeTrajectory", { cascadeId: sessionId.slice(3), isArchived: true })
        .catch(() => ls.call("DeleteCascadeTrajectory", { cascadeId: sessionId.slice(3) }));
    } catch (e) {
      this._log("[archive] " + e.message);
      this._post({ type: "error", text: "移除失败: " + e.message });
    }
    this._handleSessionsList();
  }

  // 官方式: 重命名 Cascade 轨迹(RenameCascadeTrajectory 页签标题生效,
  // 但后端列表 summary 不回写, 故另存本地覆盖名, 列表显示以覆盖名优先)
  async _handleSessionRename(sessionId) {
    if (!sessionId || !sessionId.startsWith("cx:")) return;
    const cid = sessionId.slice(3);
    const map = Object.assign({}, this._ctx.globalState.get("dao.cxNames") || {});
    const name = await vscode.window.showInputBox({ prompt: "重命名会话", value: map[cid] || "", placeHolder: "新会话名" });
    if (name == null || !name.trim()) return;
    try {
      const ls = require("./ls-bridge");
      await ls.call("RenameCascadeTrajectory", { cascadeId: cid, name: name.trim() });
    } catch (e) { this._log("[rename] " + e.message); }
    map[cid] = name.trim();
    await this._ctx.globalState.update("dao.cxNames", map);
    this._handleSessionsList();
  }

  // 官方式 Memories 管理: GetCascadeMemories / UpdateCascadeMemory / DeleteCascadeMemory
  async _handleMemoriesList() {
    try {
      const ls = require("./ls-bridge");
      const r = (await ls.call("GetCascadeMemories", {})) || {};
      // 官方双源: 账号级 GetUserMemories 与工作区级 GetCascadeMemories 合并(按 id 去重)
      try {
        const um = await ls.call("GetUserMemories", {});
        const seen = new Set(((r && r.memories) || []).map((m) => m.id));
        for (const m of (um && um.memories) || []) if (!seen.has(m.id)) (r.memories = r.memories || []).push(m);
      } catch (_) {}
      const ms = ((r && r.memories) || []).map((m) => ({
        id: m.memoryId, title: m.title || "",
        content: ((m.textMemory || {}).content) || "",
        tags: ((m.metadata || {}).tags) || [] }));
      this._post({ type: "memories", memories: ms });
    } catch (e) { this._post({ type: "error", text: "读取记忆失败: " + e.message }); }
  }

  async _handleMemoryDelete(id) {
    if (!id) return;
    try { const ls = require("./ls-bridge"); await ls.call("DeleteCascadeMemory", { memoryId: id }); }
    catch (e) { this._post({ type: "error", text: "删除记忆失败: " + e.message }); }
    this._handleMemoriesList();
  }

  async _handleMemoryEdit(m) {
    if (!m || !m.id) return;
    const content = await vscode.window.showInputBox({ prompt: "编辑记忆内容", value: m.content || "" });
    if (content == null) return;
    try { const ls = require("./ls-bridge"); await ls.call("UpdateCascadeMemory", { memoryId: m.id, title: m.title || "", content, tags: m.tags || [] }); }
    catch (e) { this._post({ type: "error", text: "更新记忆失败: " + e.message }); }
    this._handleMemoriesList();
  }

  // 官方式诊断页: GetProcesses(lspPort)/GetWorkspaceInfos/GetRepoInfos(branches)/GetDebugDiagnostics(LS 日志)
  async _handleStatusInfo() {
    const ls = require("./ls-bridge");
    try {
      const [pr, wi, ri, dd, rl, we, wo, lg, cm] = await Promise.all([
        ls.call("GetProcesses", {}).catch(() => ({})),
        ls.call("GetWorkspaceInfos", {}).catch(() => ({})),
        ls.call("GetRepoInfos", {}).catch(() => ({})),
        ls.call("GetDebugDiagnostics", {}).catch(() => ({})),
        ls.call("CheckUserMessageRateLimit", {}).catch(() => null),
        ls.call("GetWorkspaceEditState", {}).catch(() => ({})),
        ls.call("GetDefaultWebOrigins", {}).catch(() => ({})),
        ls.call("GetLifeguardConfig", {}).catch(() => ({})),
        ls.call("GetCommandModelConfigs", {}).catch(() => ({})),
      ]);
      const logs = (((dd.languageServerDiagnostics || {}).logs) || []).slice(-15).map((l) => String(l).trim());
      this._post({ type: "status-info", info: {
        lsUrl: (ls.ready() && "127.0.0.1:" + ls.ready().lsPort) || "",
        lspPort: pr.lspPort || 0,
        workspaces: ((wi.workspaceInfos || [])).map((w) => (w.workspaceUri || "").replace("file://", "")),
        repos: (ri.repos || []).map((r) => ({ name: r.name || "", branches: (r.branches || []).map((b) => b.name || "") })),
        rateLimit: rl && { hasCapacity: !!rl.hasCapacity, remaining: Number(rl.messagesRemaining), max: Number(rl.maxMessages),
          resetsIn: Number(rl.resetsInSeconds) || 0 },
        workspaceEdits: (we.workspaceEdits || []).map((x) => ({ repoRoot: x.repoRoot || "",
          files: (x.fileStates || x.files || []).length })),
        webOrigins: wo.defaultOrigins || [],
        lifeguard: (((lg.config || {}).modes || {}).agent) || null,
        commandModels: (cm.clientModelConfigs || []).map((c) => c.label || c.modelUid || ""),
        logs,
      } });
    } catch (e) { this._post({ type: "error", text: "读取诊断信息失败: " + e.message }); }
  }

  // 官方式代码结构大纲: GetFunctions/GetClassInfos{document:{absoluteUri,workspaceUri,editorLanguage,text}}
  // 契约注意: 必须随请求送全量 text, 否则返回空 {}; 仅传 absolutePath 报 no absolute path provided(须 absoluteUri)
  async _handleOutlineList() {
    const ls = require("./ls-bridge");
    try {
      const ed = vscode.window.activeTextEditor || vscode.window.visibleTextEditors[0];
      if (!ed || ed.document.uri.scheme !== "file") throw new Error("无活动文件编辑器");
      const doc = ed.document;
      const ws = vscode.workspace.getWorkspaceFolder(doc.uri);
      const d = {
        absoluteUri: doc.uri.toString(),
        workspaceUri: (ws && ws.uri.toString()) || "",
        editorLanguage: doc.languageId,
        text: doc.getText(),
      };
      const [fr, cr] = await Promise.all([
        ls.call("GetFunctions", { document: d }).catch(() => ({})),
        ls.call("GetClassInfos", { document: d }).catch(() => ({})),
      ]);
      const items = [];
      for (const c of (cr.classInfos || [])) items.push({ line: c.definitionLine || c.startLine || 0, icon: "◆", text: (c.nodeName || "?") });
      for (const f of (fr.functionCaptures || [])) items.push({ line: f.definitionLine || f.startLine || 0, icon: "ƒ", text: (f.nodeName || "(anonymous)") + (f.params || "") });
      items.sort((a, b) => a.line - b.line);
      this._post({ type: "outline", file: doc.uri.fsPath, items });
    } catch (e) { this._post({ type: "error", text: "读取大纲失败: " + e.message }); }
  }

  // 官方式 Plans 面板: GetAllPlans{} → {plans:[{path(fileURI),title,description}]}
  // 契约(实测): 计划源为 <workspace>/.windsurf/plans/*.md; title 取首个 H1, description 取正文首段;
  // 与 Plan 模式(exit_plan_mode → planFile)同源, 点击在编辑器打开计划文档
  async _handlePlansList() {
    try {
      const ls = require("./ls-bridge");
      const r = await ls.call("GetAllPlans", {});
      const items = ((r && r.plans) || []).map((p) => ({
        path: (p.path || "").replace("file://", ""),
        title: p.title || (p.path || "").split("/").pop() || "(无题)",
        description: p.description || "" }));
      this._post({ type: "plans", items });
    } catch (e) { this._post({ type: "error", text: "读取 Plans 失败: " + e.message }); }
  }

  async _handlePlanCreate() {
    try {
      const name = await vscode.window.showInputBox({ prompt: "计划名(生成 .windsurf/plans/<name>.md)" });
      if (!name) return;
      const ws = (vscode.workspace.workspaceFolders || [])[0];
      if (!ws) throw new Error("无工作区");
      const slug = name.trim().toLowerCase().split("").map((c) => (/[a-z0-9\u4e00-\u9fff]/.test(c) ? c : "-")).join("");
      const uri = vscode.Uri.joinPath(ws.uri, ".windsurf", "plans", slug + ".md");
      await vscode.workspace.fs.writeFile(uri, Buffer.from("# " + name.trim() + "\n\n## Goal\n\n## Steps\n- [ ] \n", "utf8"));
      const doc = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(doc, { preview: false });
      this._handlePlansList();
    } catch (e) { this._post({ type: "error", text: "新建计划失败: " + e.message }); }
  }

  // 官方式 standalone 建 worktree: CreateWorktree{} → {worktrees:[{original:{workspaceUri,gitRootUri},worktreePath}]}
  async _handleWorktreeCreate() {
    const ls = require("./ls-bridge");
    try {
      const r = await ls.call("CreateWorktree", {});
      const wt = ((r.worktrees || [])[0] || {}).worktreePath;
      if (!wt) throw new Error("后端未返回 worktreePath");
      this._handleStatusInfo();
      const pick = await vscode.window.showInformationMessage("已创建隔离 worktree: " + wt, "新窗打开");
      if (pick === "新窗打开") await vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(wt), { forceNewWindow: true });
    } catch (e) { this._post({ type: "error", text: "创建 worktree 失败: " + e.message }); }
  }

  // 官方式用户主线轨迹: GetUserTrajectoryDescriptions(current:true) → GetUserTrajectory{trajectoryId}
  // steps 含 GIT_COMMIT/USER_INPUT/PLANNER_RESPONSE/VIEW_FILE/GREP_SEARCH_V2/CODE_ACTION/CHECKPOINT 等
  // 实时追踪: StreamUserTrajectoryReactiveUpdates{protocolVersion:1,id:<trajectoryId>} 帧到即去拖重拉(断流 5s 重连)
  _watchUserTrajectory(tid) {
    if (this._tlWatching) return;
    const ls = require("./ls-bridge");
    if (!ls.ready() || !ls.apiKey()) return;
    this._tlWatching = true;
    const loop = () => {
      ls.callStream("StreamUserTrajectoryReactiveUpdates", { protocolVersion: 1, id: tid }, () => {
        clearTimeout(this._tlDebounce);
        this._tlDebounce = setTimeout(() => { this._handleTimelineList().catch(() => {}); }, 600);
      }, 24 * 3600 * 1000).catch(() => {}).then(() => {
        if (this._disposed) { this._tlWatching = false; return; }
        setTimeout(loop, 5000);
      });
    };
    loop();
  }

  // 官方 Start With History 同位(反者道之动·workbench 真源 tooltip: "messages will automatically
  // include your recent coding history"): 新会话首条消息附带最近编码轨迹摘要。
  // 数据同源: GetUserTrajectoryDescriptions(current) → GetUserTrajectory 末尾步骤。LS 无
  // start_with_history 专用 RPC(二进制实测), 故与官方同为客户端态+消息内附带。
  async _swhContext() { return swhContext(require("./ls-bridge")); }

  async _handleTimelineList() {
    const ls = require("./ls-bridge");
    try {
      const ds = await ls.call("GetUserTrajectoryDescriptions", {});
      const cur = ((ds.trajectories || []).find((t) => t.current) || {});
      if (!cur.trajectoryId) throw new Error("无当前用户轨迹");
      this._watchUserTrajectory(cur.trajectoryId);
      const r = await ls.call("GetUserTrajectory", { trajectoryId: cur.trajectoryId });
      const one = (s) => String(s || "").split("\n")[0].slice(0, 90);
      const rel = (u) => String(u || "").replace(/^file:\/\//, "").split("/").slice(-2).join("/");
      const items = ((r.trajectory || {}).steps || []).map((s) => {
        const t = (s.type || "").replace("CORTEX_STEP_TYPE_", "");
        const ts = ((s.metadata || {}).createdAt || "").replace("T", " ").slice(5, 16);
        if (t === "GIT_COMMIT") return { ts, icon: "⎇", text: one((s.gitCommit || {}).commitMessage) + " · " + String((s.gitCommit || {}).commitHash || "").slice(0, 7) };
        if (t === "USER_INPUT") return { ts, icon: "💬", text: one((s.userInput || {}).userResponse) };
        if (t === "PLANNER_RESPONSE") return { ts, icon: "✦", text: one((s.plannerResponse || {}).response) };
        if (t === "VIEW_FILE") return { ts, icon: "📄", text: "阅读 " + rel((s.viewFile || {}).absolutePathUri) };
        if (t === "GREP_SEARCH_V2") return { ts, icon: "🔍", text: "搜索 " + one((s.grepSearchV2 || {}).pattern) };
        if (t === "CODE_ACTION") return { ts, icon: "✎", text: "代码动作 " + rel(((((s.codeAction || {}).actionSpec || {}).createFile || {}).path || {}).absoluteUri) };
        if (t === "CHECKPOINT") return { ts, icon: "⚑", text: one((s.checkpoint || {}).userIntent) };
        if (t === "ERROR_MESSAGE") return { ts, icon: "⚠", text: one(((s.errorMessage || {}).error || {}).shortError) };
        return null;
      }).filter((it) => it && it.text).slice(-40).reverse();
      this._post({ type: "timeline", tid: cur.trajectoryId, branch: ((cur.trajectoryScope || {}).branchName) || "", items });
    } catch (e) { this._post({ type: "error", text: "读取活动轨迹失败: " + e.message }); }
  }

  // 官方式 MCP 管理: GetMcpServerStates / RefreshMcpServers / SaveMcpServerToConfigFile(serverId+templateJson)
  async _handleMcpList() {
    try {
      const ls = require("./ls-bridge");
      const r = await ls.call("GetMcpServerStates", {});
      const servers = require("./mcp-config").mergedServers((r && r.states) || []);
      this._post({ type: "mcp", servers });
      this._fusePublish("mcp", { servers: servers.map((s) => ({ name: s.name, status: s.status,
        disabled: s.disabled, toolCount: (s.tools || []).length })) });
    } catch (e) { this._post({ type: "error", text: "读取 MCP 状态失败: " + e.message }); }
  }

  // 官方式工具级开关: ToggleMcpTool{serverId,toolName} → 翻转 spec.disabledTools(持久化至 mcp_config.json)
  async _handleMcpToolToggle(server, tool) {
    try {
      const ls = require("./ls-bridge");
      await ls.call("ToggleMcpTool", { serverId: server, toolName: tool });
      this._handleMcpList();
    } catch (e) { this._post({ type: "error", text: "切换工具失败: " + e.message }); }
  }

  // 官方式 MCP prompts: GetMcpPrompt{serverName,promptName,arguments} → {messages:[{role,content:[{text}]}]}
  // 取回拼接各 message 文本塗入 composer
  async _handleMcpPromptRun(server, prompt, argNames) {
    try {
      const ls = require("./ls-bridge");
      const args = {};
      for (const a of (argNames || [])) {
        const v = await vscode.window.showInputBox({ prompt: "MCP prompt 参数 " + a + " (" + server + "/" + prompt + ")" });
        if (v === undefined) return;
        if (v) args[a] = v;
      }
      const r = await ls.call("GetMcpPrompt", { serverName: server, promptName: prompt, arguments: args });
      const text = ((r && r.messages) || []).map((mm) => (mm.content || []).map((c) => c.text || "").join("\n")).filter(Boolean).join("\n");
      if (!text) throw new Error("prompt 无文本内容");
      this._post({ type: "insert-input", text });
    } catch (e) { this._post({ type: "error", text: "获取 MCP prompt 失败: " + e.message }); }
  }

  async _handleMcpRefresh() {
    try { const ls = require("./ls-bridge"); await ls.call("RefreshMcpServers", {}); }
    catch (e) { this._post({ type: "error", text: "刷新 MCP 失败: " + e.message }); }
    setTimeout(() => this._handleMcpList(), 1500);
  }

  // 官方式添加: 先从 GetMcpRegistryServers 注册表挑选(自动生成配置模板+必填环境变量), 兜底手动 JSON
  async _handleMcpAdd() {
    const ls = require("./ls-bridge");
    let picks = [{ label: "$(edit) 手动输入 JSON…", srv: null }];
    try {
      const reg = await ls.call("GetMcpRegistryServers", {});
      picks = picks.concat(((reg && reg.servers) || []).map((s) => ({
        label: s.title || s.name, description: (s.name || "").replace(/^devin\//, ""), detail: s.description || "", srv: s })));
    } catch (_) {}
    const pick = await vscode.window.showQuickPick(picks, { placeHolder: "添加 MCP server(注册表或手动)", matchOnDescription: true, matchOnDetail: true });
    if (!pick) return;
    let id, tplObj;
    if (pick.srv) {
      const s = pick.srv;
      id = (s.name || "").replace(/^devin\//, "") || s.title;
      const pkg = (s.packages || [])[0];
      const remote = (s.remotes || [])[0];
      if (pkg) {
        tplObj = { command: pkg.runtimeHint || "npx", args: pkg.runtimeHint === "npx" ? ["-y", pkg.identifier] : [pkg.identifier], env: {} };
        for (const ev of pkg.environmentVariables || []) {
          if (!ev.isRequired) continue;
          const v = await vscode.window.showInputBox({ prompt: `${id} 需要 ${ev.name}(${ev.description || ""})`, password: !!ev.isSecret });
          if (v === undefined) return;
          tplObj.env[ev.name] = v;
        }
        if (!Object.keys(tplObj.env).length) delete tplObj.env;
      } else if (remote) {
        tplObj = { serverUrl: remote.url };
      } else { this._post({ type: "error", text: "该注册表项无可用安装方式" }); return; }
    } else {
      id = await vscode.window.showInputBox({ prompt: "MCP server 名称(写入 mcp_config.json 的键)" });
      if (!id) return;
      const tpl = await vscode.window.showInputBox({
        prompt: "server 配置 JSON(如 {\"command\":\"npx\",\"args\":[...]} 或 {\"serverUrl\":...})",
        value: '{"command":"","args":[]}' });
      if (!tpl) return;
      try { tplObj = JSON.parse(tpl); } catch (e) { this._post({ type: "error", text: "JSON 无效: " + e.message }); return; }
    }
    try {
      await ls.call("SaveMcpServerToConfigFile", { serverId: id, templateJson: JSON.stringify(tplObj) });
      await ls.call("RefreshMcpServers", {});
    } catch (e) { this._post({ type: "error", text: "添加 MCP 失败: " + e.message }); }
    setTimeout(() => this._handleMcpList(), 1500);
  }

  // 官方式 Code Maps: GetCodeMapsForRepos{repoPaths} → {codeMaps:[json...]}(traces/traceTextDiagram/traceGuide)
  async _handleCodeMapsList() {
    try {
      const ls = require("./ls-bridge");
      const repoPaths = (vscode.workspace.workspaceFolders || []).map((f) => f.uri.fsPath);
      const r = await ls.call("GetCodeMapsForRepos", { repoPaths });
      const idx = this._codeMapIndex();
      const maps = ((r && r.codeMaps) || []).map((s) => {
        let m = {}; try { m = JSON.parse(s); } catch (_) {}
        const ie = idx[m.id] || {};
        return {
          id: m.id || "", title: m.title || m.id || "(无题)",
          prompt: ((m.metadata || {}).originalPrompt) || "",
          time: ((m.metadata || {}).generationTimestamp) || "",
          starred: !!ie.starred, archived: !!ie.archived,
          traces: (m.traces || []).map((t) => ({
            title: t.title || "", desc: t.description || "", diagram: t.traceTextDiagram || "",
            locations: (t.locations || []).map((l) => ({ path: l.path || "", line: l.lineNumber || 1, title: l.title || "", lineContent: l.lineContent || "" })) })) };
      });
      // 归档地图 GetCodeMapsForRepos 不返回——从 codemapindex.json 补条目(仅标题行, 供恢复)
      const seen = new Set(maps.map((m) => m.id));
      for (const id of Object.keys(idx)) {
        const ie = idx[id];
        if (seen.has(id) || !ie.archived) continue;
        maps.push({ id, title: ie.title || id, prompt: "", time: "", starred: !!ie.starred, archived: true, traces: [] });
      }
      // 官方式 Suggested maps: GetCodeMapSuggestions(后端实测: 可选 cascadeId, LLM 即时生成
      // {id,prompt,subtitle,startingPoints}; id 每次重生不可持久, 仅作本屏候选, 点选即以 prompt 生成)
      let suggestions = [];
      try {
        const sr = await ls.call("GetCodeMapSuggestions", this._cascadeLsId ? { cascadeId: this._cascadeLsId } : {});
        suggestions = ((sr && sr.suggestions) || []).map((s) => ({ id: s.id || "", prompt: s.prompt || "", subtitle: s.subtitle || "", startingPoints: s.startingPoints || [] }));
      } catch (_) {}
      this._post({ type: "codemaps", maps, suggestions });
    } catch (e) { this._post({ type: "error", text: "读取 Code Maps 失败: " + e.message }); }
  }

  // codemapindex.json(~/.codeium/windsurf/codemaps): LS 持久化的地图元数据(starred/archived/fileName)
  _codeMapIndex() {
    const out = {};
    try {
      const p = path.join(os.homedir(), ".codeium", "windsurf", "codemaps", "codemapindex.json");
      const j = JSON.parse(fs.readFileSync(p, "utf8"));
      for (const e of (j.codeMaps || [])) out[e.id] = e;
    } catch (_) {}
    return out;
  }

  // 官方式地图元数据: UpdateCodeMapMetadata{id,starred,archived}(整字段写, 持久化至 codemapindex.json)
  async _handleCodeMapMeta(id, starred, archived) {
    if (!id) return;
    try {
      const body = { id };
      if (typeof starred === "boolean") body.starred = starred;
      if (typeof archived === "boolean") body.archived = archived;
      await require("./ls-bridge").call("UpdateCodeMapMetadata", body);
      this._handleCodeMapsList();
    } catch (e) { this._post({ type: "codemap-status", text: "⚠ " + e.message }); }
  }

  // 官方式地图分享: ShareCodeMap{codeMapJson,fileName} → {shareUrl}(windsurf.com/codemaps/…)
  async _handleCodeMapShare(id) {
    if (!id) return;
    try {
      const ie = this._codeMapIndex()[id];
      if (!ie || !ie.fileName) throw new Error("未在 codemapindex 找到该地图");
      const json = fs.readFileSync(path.join(os.homedir(), ".codeium", "windsurf", "codemaps", ie.fileName), "utf8");
      const r = await require("./ls-bridge").call("ShareCodeMap", { codeMapJson: json, fileName: ie.fileName });
      const url = (r && r.shareUrl) || "";
      if (!url) throw new Error("未返回分享链接");
      await vscode.env.clipboard.writeText(url);
      this._post({ type: "codemap-status", text: "✓ 分享链接已复制: " + url });
      vscode.window.showInformationMessage("Code Map 分享链接已复制: " + url, "打开").then((a) => { if (a === "打开") vscode.env.openExternal(vscode.Uri.parse(url)); });
    } catch (e) { this._post({ type: "codemap-status", text: "⚠ 分享失败: " + e.message }); }
  }

  // 官方式建议忽略: DismissCodeMapSuggestion{cascadeId,suggestionId}(两字段均必填, 无会话时不可用)
  async _handleCodeMapSugDismiss(id) {
    if (!id || !this._cascadeLsId) return;
    try {
      await require("./ls-bridge").call("DismissCodeMapSuggestion", { cascadeId: this._cascadeLsId, suggestionId: id });
      this._handleCodeMapsList();
    } catch (e) { this._post({ type: "codemap-status", text: "⚠ " + e.message }); }
  }

  // 官方式共享地图导入: GetSharedCodeMap{codeMapId} → codeMapData(JSON 全文) → SaveCodeMapFromJson
  // (LS 自动重发号 id 时间戳后缀并落盘 codemaps/ + codemapindex.json)
  async _handleCodeMapImport() {
    try {
      const input = await vscode.window.showInputBox({
        prompt: "粘贴共享地图链接或 ID",
        placeHolder: "https://windsurf.com/codemaps/<id> 或 <id>",
      });
      if (!input) return;
      const id = input.trim().replace(/[?#].*$/, "").replace(/\/+$/, "").split("/").pop();
      if (!id) throw new Error("无法解析地图 ID");
      this._post({ type: "codemap-status", text: "导入中…" });
      const ls = require("./ls-bridge");
      const shared = await ls.call("GetSharedCodeMap", { codeMapId: id });
      if (!shared || !shared.codeMapData) throw new Error("共享地图无内容");
      await ls.call("SaveCodeMapFromJson", { codeMapJson: shared.codeMapData });
      this._post({ type: "codemap-status", text: "✓ 导入完成" });
      this._handleCodeMapsList();
    } catch (e) { this._post({ type: "codemap-status", text: "⚠ 导入失败: " + e.message }); }
  }

  // 官方式 Code Map 生成: GenerateCodeMap{prompt}(connect+json 流: status 增量 → success.codeMapJson)
  async _handleCodeMapGenerate(prompt) {
    if (!prompt) return;
    try {
      const ls = require("./ls-bridge");
      let done = false;
      await ls.callStream("GenerateCodeMap", { prompt }, (j) => {
        if (j.status && j.status.trim()) this._post({ type: "codemap-status", text: j.status });
        if (j.success) done = true;
      }, 600000);
      this._post({ type: "codemap-status", text: done ? "✓ 生成完成" : "(未返回结果)" });
      if (done) this._handleCodeMapsList();
    } catch (e) { this._post({ type: "codemap-status", text: "⚠ " + e.message }); }
  }

  async _handleOpenFileLine(p, line) {
    try {
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(p));
      const pos = new vscode.Position(Math.max(0, (line || 1) - 1), 0);
      await vscode.window.showTextDocument(doc, { preview: true, selection: new vscode.Range(pos, pos) });
    } catch (e) { vscode.window.showWarningMessage("打不开 " + p + ": " + e.message); }
  }

  // 官方式 DeepWiki: GetDeepWiki(connect+json 流) —— 对编辑器选中符号生成解释卡(deltaMessage 增量)
  async deepwikiFromEditor() {
    const ed = vscode.window.activeTextEditor;
    if (!ed) return void vscode.window.showInformationMessage("先在编辑器中选中一个符号");
    const sel = ed.selection;
    const range = sel.isEmpty ? ed.document.getWordRangeAtPosition(sel.active) : sel;
    const symbol = range ? ed.document.getText(range).trim() : "";
    if (!symbol) return void vscode.window.showInformationMessage("未选中符号");
    vscode.commands.executeCommand(this._viewId + ".focus").then(undefined, () => {});
    this._handleDeepWiki(symbol.slice(0, 200), ed.document.uri.toString(), ed.document.languageId);
  }

  async _handleDeepWiki(symbolName, symbolUri, language) {
    const id = "dw-" + Date.now();
    this._post({ type: "deepwiki", id, symbol: symbolName, text: "", inProgress: true });
    let acc = "";
    try {
      const ls = require("./ls-bridge");
      await ls.callStream("GetDeepWiki", {
        requestType: "DEEP_WIKI_REQUEST_TYPE_SUMMARY",
        symbolName, symbolUri, language,
        symbolType: "DEEP_WIKI_SYMBOL_TYPE_FUNCTION",
      }, (j) => {
        const dm = ((j || {}).response || {}).deltaMessage || {};
        if (dm.isError) { acc += "\n⚠ " + (dm.text || "DeepWiki 错误"); return; }
        if (dm.text && /^bot-deepwiki/.test(dm.messageId || "")) {
          acc += dm.text;
          this._post({ type: "deepwiki", id, symbol: symbolName, text: acc, inProgress: true });
        }
      });
    } catch (e) { acc += "\n⚠ " + e.message; }
    this._post({ type: "deepwiki", id, symbol: symbolName, text: acc || "(无内容)", inProgress: false });
  }

  // 官方式 ACP agent 注册表: GetAllAcpRegistries → registryJson.agents(Devin Local/Cloud、Claude、Codex 等)
  async _handleAgentsRegistry() {
    try {
      const ls = require("./ls-bridge");
      const r = await ls.call("GetAllAcpRegistries", {});
      let agents = [];
      try { agents = (JSON.parse((r && r.registryJson) || "{}").agents || []); } catch (_) {}
      agents = agents.filter((a) => !a["cognition.ai/hidden"]).map((a) => ({
        id: a.id || "", name: a.name || a.id || "", version: a.version || "",
        desc: a.description || "", authors: (a.authors || []).join(", "),
        featured: !!a["cognition.ai/featured"], bundled: !!a["cognition.ai/bundled"],
        promo: a["cognition.ai/promoLabel"] || "", repo: a.repository || a.website || "" }));
      agents.sort((a, b) => (b.featured - a.featured) || (b.bundled - a.bundled) || a.name.localeCompare(b.name));
      this._post({ type: "agents-registry", agents });
    } catch (e) { this._post({ type: "error", text: "读取 Agent 注册表失败: " + e.message }); }
  }

  // 官方式插件市场: GetAvailableCascadePlugins → {title,id,link,description,installationCount,trustLevel}
  async _handleMcpStore() {
    try {
      const ls = require("./ls-bridge");
      const r = await ls.call("GetAvailableCascadePlugins", {});
      const plugins = ((r && r.plugins) || []).map((p) => ({
        id: p.id || "", title: p.title || p.id || "", desc: p.description || "",
        installs: p.installationCount || "", trust: p.trustLevel || "", link: p.link || "" }));
      this._post({ type: "mcp-store", plugins });
    } catch (e) { this._post({ type: "error", text: "读取插件市场失败: " + e.message }); }
  }

  // 市场安装: 按 id 在 GetMcpRegistryServers 找同名模板走官方安装; 找不到则打开插件主页
  async _handleMcpStoreInstall(id, link) {
    const ls = require("./ls-bridge");
    let srv = null;
    try {
      const reg = await ls.call("GetMcpRegistryServers", {});
      const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      srv = ((reg && reg.servers) || []).find((s) =>
        norm((s.name || "").replace(/^devin\//, "")) === norm(id) || norm(s.title) === norm(id));
    } catch (_) {}
    if (!srv) {
      if (link) vscode.env.openExternal(vscode.Uri.parse(link)).then(undefined, () => {});
      this._post({ type: "error", text: "注册表无 " + id + " 模板，已打开主页手动配置" });
      return;
    }
    const sid = (srv.name || "").replace(/^devin\//, "") || srv.title;
    const pkg = (srv.packages || [])[0];
    const remote = (srv.remotes || [])[0];
    let tplObj;
    if (pkg) {
      tplObj = { command: pkg.runtimeHint || "npx", args: pkg.runtimeHint === "npx" ? ["-y", pkg.identifier] : [pkg.identifier], env: {} };
      for (const ev of pkg.environmentVariables || []) {
        if (!ev.isRequired) continue;
        const v = await vscode.window.showInputBox({ prompt: `${sid} 需要 ${ev.name}(${ev.description || ""})`, password: !!ev.isSecret });
        if (v === undefined) return;
        tplObj.env[ev.name] = v;
      }
      if (!Object.keys(tplObj.env).length) delete tplObj.env;
    } else if (remote) {
      tplObj = { serverUrl: remote.url };
    } else { this._post({ type: "error", text: "该插件无可用安装方式" }); return; }
    try {
      await ls.call("SaveMcpServerToConfigFile", { serverId: sid, templateJson: JSON.stringify(tplObj) });
      await ls.call("RefreshMcpServers", {});
      this._post({ type: "store-installed", id });
    } catch (e) { this._post({ type: "error", text: "安装失败: " + e.message }); }
    setTimeout(() => this._handleMcpList(), 1500);
  }

  // 官方式 token 计数: GetMessageTokenCount{chatMessage:<string>,requestedModelId:<Model 枚举>} → {tokenCount}
  async _handleTokenQuery(reqId, text) {
    try {
      const ls = require("./ls-bridge");
      if (this._maxInputTokens === undefined) {
        try {
          const u = await ls.call("GetUserStatus", {});
          this._maxInputTokens = Number((((u.userStatus || {}).planStatus || {}).planInfo || {}).maxNumChatInputTokens) || 0;
        } catch (_) { this._maxInputTokens = 0; }
      }
      const r = await ls.call("GetMessageTokenCount", { chatMessage: text || "", requestedModelId: 1 });
      this._post({ type: "token-count", reqId, count: r.tokenCount || 0, max: this._maxInputTokens });
    } catch (_) {}
  }

  // 官方式账户/套餐: GetUserStatus → {name,email,planStatus{planInfo{...},实时配额}}
  // planStatus 顶层字段(实测)携当日/本周配额剩余百分比、可用 Flex credits、超额余额与配额重置时刻,
  // 与官方面板底栏账户卡「配额」同源。重置时刻为 Unix 秒, 前端渲染为本地时间。
  async _handleAccountStatus() {
    try {
      const ls = require("./ls-bridge");
      const r = await ls.call("GetUserStatus", {});
      const u = (r && r.userStatus) || {};
      const ps = u.planStatus || {};
      const pi = ps.planInfo || {};
      const num = (x) => (typeof x === "number" ? x : (x === undefined || x === null ? null : Number(x)));
      // 官方同路头像: GetProfileData{apiKey}→profilePictureUrl(官方 extension.js 登录后同路同参,
      // 失败静默容错不阻断账户卡 —— 与官方 try/catch+sentry 同语义)。一次取得即缓存。
      if (this._profileUrl === undefined) {
        try {
          const pd = await ls.call("GetProfileData", { apiKey: ls.apiKey() || "" });
          const u2 = (pd && pd.profilePictureUrl) || "";
          this._profileUrl = u2 ? await profilePictureDataUrl(u2) : null;
        } catch (_) { this._profileUrl = null; }
      }
      // 官方式团队管控: GetTeamOrganizationalControls → 组织级可用模型标签(先取缓存, 首帧即带标签)
      if (this._teamModelLabels === undefined) {
        try {
          const tc = await ls.call("GetTeamOrganizationalControls", {});
          this._teamModelLabels = ((tc && tc.controls) || {}).extensionModelLabels || [];
        } catch (_) { this._teamModelLabels = []; }
      }
      this._post({ type: "account", profileUrl: this._profileUrl || "", name: u.name || "", email: u.email || "",
        plan: pi.planName || "", promptCredits: pi.monthlyPromptCredits || 0,
        flowCredits: pi.monthlyFlowCredits || 0, maxInputTokens: pi.maxNumChatInputTokens || "",
        dailyQuotaPct: num(ps.dailyQuotaRemainingPercent), weeklyQuotaPct: num(ps.weeklyQuotaRemainingPercent),
        flexCredits: num(ps.availableFlexCredits),
        dailyResetUnix: num(ps.dailyQuotaResetAtUnix), weeklyResetUnix: num(ps.weeklyQuotaResetAtUnix),
        teamModelLabels: this._teamModelLabels || [] });
      this._fusePublish("account", { name: u.name || "", email: u.email || "", plan: pi.planName || "",
        dailyQuotaPct: num(ps.dailyQuotaRemainingPercent), weeklyQuotaPct: num(ps.weeklyQuotaRemainingPercent),
        flexCredits: num(ps.availableFlexCredits) });
      this._watchPanelState();
    } catch (e) { this._post({ type: "error", text: "读取账户状态失败: " + e.message }); }
  }

  // 官方头像菜单命令路由(反提官方 extension.js OPEN_* registerCommand 真源):
  // Docs→docs.windsurf.com?referrer=extension / Community→windsurf.com/redirect/windsurf/community /
  // Changelog→windsurf.com/changelog / Usage→getDevinViewUsageUrl 同构(auth/devin/start?redirect_uri=
  // app.devin.ai/auth/windsurf/continue&prompt=none&intent=website); 编辑器组直通宿主原生命令。
  async _handleAvatarCmd(id) {
    const open = (u) => void vscode.env.openExternal(vscode.Uri.parse(u)).then(undefined, () => {});
    const WEB = "https://windsurf.com";
    const cmd = (c, ...a) => void vscode.commands.executeCommand(c, ...a).then(undefined, () => {});
    switch (id) {
      case "account": this._acctPopOpen = true; return this._handleAccountStatus();
      case "settings": return cmd("dao.cascade.openSettings");
      case "usage": {
        const q = new URLSearchParams({ redirect_uri: "https://app.devin.ai/auth/windsurf/continue", prompt: "none", intent: "website" });
        return open(WEB + "/auth/devin/start?" + q.toString());
      }
      case "signout": return cmd(this._viewId + ".logout");
      case "editor-settings": return cmd("workbench.action.openSettings");
      case "keybindings": return cmd("workbench.action.openGlobalKeybindings");
      case "extensions": return cmd("workbench.view.extensions");
      case "snippets": return cmd("workbench.action.openSnippets");
      case "tasks": return cmd("workbench.action.tasks.configureTaskRunner");
      case "themes": return cmd("workbench.action.selectTheme");
      case "updates": return cmd("workbench.extensions.action.checkForUpdates");
      case "docs": return open("https://docs.windsurf.com?referrer=extension");
      case "community": return open(WEB + "/redirect/windsurf/community");
      case "changelog": return open(WEB + "/changelog");
      case "diagnostics": return this._handleStatusInfo();
    }
  }

  // 官方式实时面板状态: StreamCascadePanelReactiveUpdates{protocolVersion:1,id:<apiKey>}
  // (Connect server-streaming, 后端实测)—— 配额消耗/套餐变化即推 fullState/diff 帧, 以之为
  // 变更信号去抖重拉 GetUserStatus, 使账户卡配额与官方面板底栏实时同步。断流后 5s 自动重连。
  // 活性: 仅当账户卡当前可见(_acctPopOpen)才推送刷新, 避免未打开时的无谓抖动。
  _watchPanelState() {
    if (this._panelWatching) return;
    const ls = require("./ls-bridge");
    if (!ls.ready() || !ls.apiKey()) return;
    this._panelWatching = true;
    const loop = () => {
      const id = ls.apiKey();
      if (!id) { this._panelWatching = false; return; }
      ls.callStream("StreamCascadePanelReactiveUpdates", { protocolVersion: 1, id }, () => {
        clearTimeout(this._panelDebounce);
        this._panelDebounce = setTimeout(() => {
          if (this._acctPopOpen) this._handleAccountStatus().catch(() => {});
        }, 400);
      }, 24 * 3600 * 1000).catch(() => {}).then(() => {
        if (this._disposed) { this._panelWatching = false; return; }
        setTimeout(loop, 5000);
      });
    };
    loop();
  }

  // 官方式定制热重载: RefreshCustomization{} 让 LS 重新扫描 rules/skills/workflows
  async _handleCustomRefresh() {
    try { const ls = require("./ls-bridge"); await ls.call("RefreshCustomization", {}); }
    catch (e) { this._post({ type: "error", text: "刷新定制失败: " + e.message }); }
    this._handleCustomizationsList();
  }

  // 官方式 server 级开关: UpdateMcpServerInConfigFile{serverId} → 翻转 disabled 并持久化(LS 自行重载)
  async _handleMcpToggle(name) {
    try {
      const ls = require("./ls-bridge");
      await ls.call("UpdateMcpServerInConfigFile", { serverId: name });
    } catch (e) { this._post({ type: "error", text: "切换 MCP 失败: " + e.message }); }
    setTimeout(() => this._handleMcpList(), 1500);
  }

  // webview 送来的图像(dataURL 或 {dataUrl}) → 官方 ImageData{base64Data,mimeType,caption}
  // 仅当当前模型 supportsImages 时才带图, 否则忽略(避免非图模型报错)。
  _cxImages(images) {
    if (!Array.isArray(images) || !images.length) return [];
    if (this._cxImageModels && !this._cxImageModels.has(this._cascadeModel)) return [];
    const out = [];
    for (const im of images) {
      const url = typeof im === "string" ? im : (im && (im.dataUrl || im.base64Data)) || "";
      const m = /^data:([^;]+);base64,(.*)$/.exec(url);
      if (m) out.push({ base64Data: m[2], mimeType: m[1], caption: (im && im.caption) || "" });
      else if (im && im.base64Data) out.push({ base64Data: im.base64Data, mimeType: im.mimeType || "image/png", caption: im.caption || "" });
    }
    return out;
  }

  // 入队并回推 chip 栏(供运行中发消息 & not-idle 退回复用)
  async _cxEnqueue(text, images) {
    const ls = require("./ls-bridge");
    await this._cxEnsureModel();
    const req = {
      cascadeId: this._cascadeLsId,
      items: [{ text }],
      cascadeConfig: { plannerConfig: this._cxPlannerConfig() },
    };
    if (images && images.length) req.images = images;
    const qr = await ls.call("QueueCascadeMessage", req);
    this._cxQueue = this._cxQueue || [];
    this._cxQueue.push({ queueId: qr.queueId, text });
    this._post({ type: "cx-queue", queue: this._cxQueue });
  }

  // 官方式队列管理: RemoveFromQueue / MoveQueuedMessage{toIndex} / InterruptWithQueuedMessage(立即发送)
  async _handleCxQueueOp(msg) {
    if (!this._cascadeLsId || !this._cxQueue) return;
    const ls = require("./ls-bridge");
    const qi = this._cxQueue.findIndex((q) => q.queueId === msg.queueId);
    if (qi < 0) return;
    try {
      if (msg.type === "cx-queue-remove") {
        await ls.call("RemoveFromQueue", { cascadeId: this._cascadeLsId, queueId: msg.queueId });
        this._cxQueue.splice(qi, 1);
      } else if (msg.type === "cx-queue-front") {
        await ls.call("MoveQueuedMessage", { cascadeId: this._cascadeLsId, queueId: msg.queueId, toIndex: 0 });
        this._cxQueue.unshift(this._cxQueue.splice(qi, 1)[0]);
      } else {
        await ls.call("InterruptWithQueuedMessage", { cascadeId: this._cascadeLsId, queueId: msg.queueId });
        this._cxQueue.splice(qi, 1);
      }
      this._post({ type: "cx-queue", queue: this._cxQueue });
    } catch (e) { this._post({ type: "error", text: "队列操作失败: " + e.message }); }
  }

  // 官方式 Arena 模式(后端实测): StartCascade{startArena:2} → {cascadeId, arenaCascadeIds[]}
  // → 对每个 arena cascade 各发一次 SendUserCascadeMessage(同一消息) → 并行轮询各自回复
  // → 用户拣选 → ConvergeArenaCascades{targetCascadeId:胜者} → {convergedCascadeIds:[败者]},
  //   胜者轨迹尾追 CORTEX_STEP_TYPE_ARENA_TRAJECTORY_CONVERGE 步, 会话在胜者上续行
  //   会话中途: SpawnArenaModeMidConversation{cascadeId,count} → {cascadeIds:[原 id, 克隆 id…]}(克隆携完整历史)
  async _cxArenaRace(msg, ls, imgs) {
    let ids;
    if (this._cascadeLsId) {
      let r;
      try { r = await ls.call("SpawnArenaModeMidConversation", { cascadeId: this._cascadeLsId, count: 2 }); }
      catch (e) {
        // 官方限制: 已 converge 过的 cascade 不能再开 Arena → 友好提示并置灰 ⚔
        if (/already in an arena|failed.precondition/i.test(e.message || "")) {
          this._post({ type: "arena-avail", ok: false, reason: "该会话已经过 Arena 收敛，无法再开" });
          return this._post({ type: "assistant-done", id: msg.id, text: "⚠ 该会话已经过 Arena 收敛，无法再开 Arena；请新建会话使用 ⚔" });
        }
        throw e;
      }
      ids = (r.cascadeIds && r.cascadeIds.length) ? r.cascadeIds : [this._cascadeLsId];
      this._log("cascade: SpawnArenaModeMidConversation → " + ids.join(", "));
    } else {
      const r = await ls.call("StartCascade", { startArena: 2 });
      ids = (r.arenaCascadeIds && r.arenaCascadeIds.length) ? r.arenaCascadeIds : [r.cascadeId];
      this._log("cascade: StartCascade(arena) → " + ids.join(", "));
    }
    // 基线: 中途克隆携历史 plannerResponse, 先取现有全文作增量起点
    const base = await Promise.all(ids.map(async (cid) => {
      try {
        const sr = await ls.call("GetCascadeTrajectorySteps", { cascadeId: cid });
        let f = "";
        for (const st of (((sr.trajectory || sr).steps) || [])) if (st.plannerResponse && st.plannerResponse.response) f += st.plannerResponse.response;
        return f;
      } catch (_) { return ""; }
    }));
    const cfg = { plannerConfig: this._cxPlannerConfig() };
    for (const cid of ids) {
      const req = { cascadeId: cid, items: [{ text: msg.text }], cascadeConfig: cfg };
      if (imgs.length) req.images = imgs;
      await ls.call("SendUserCascadeMessage", req);
    }
    this._post({ type: "arena-start", id: msg.id, count: ids.length });
    this._arenaIds = ids; this._arenaMsgId = msg.id;
    await Promise.all(ids.map(async (cid, slot) => {
      let out = base[slot] || "", grew = false, stable = 0;
      const hadHistory = !!out;
      for (let i = 0; i < 200; i++) {
        await new Promise((rr) => setTimeout(rr, 1000));
        let sr;
        try { sr = await ls.call("GetCascadeTrajectorySteps", { cascadeId: cid }); }
        catch (_) { continue; }
        const steps = ((sr.trajectory || sr).steps) || [];
        let full = "", allDone = true, sawWork = false;
        for (const st of steps) {
          if (st.plannerResponse && st.plannerResponse.response) full += st.plannerResponse.response;
          if (st.type === "CORTEX_STEP_TYPE_PLANNER_RESPONSE") sawWork = true;
          if (st.type === "CORTEX_STEP_TYPE_ARENA_TRAJECTORY_CONVERGE") continue;
          if (st.errorMessage && st.errorMessage.shouldShowUser !== false) {
            const em = (st.errorMessage.error && (st.errorMessage.error.userErrorMessage || st.errorMessage.error.shortError)) || "Cascade 后端错误";
            full += (full ? "\n\n" : "") + "⚠ " + em; sawWork = true;
          }
          if (st.status && !/DONE|ERROR/.test(st.status)) allDone = false;
        }
        if (full.length > out.length) {
          this._post({ type: "arena-delta", id: msg.id, slot, text: full.slice(out.length) });
          out = full; grew = true; stable = 0;
        } else if ((grew || (sawWork && !hadHistory)) && allDone && ++stable >= 3) break;
      }
    }));
    this._post({ type: "arena-done", id: msg.id });
  }

  // 拣选胜者: ConvergeArenaCascades{targetCascadeId} → 会话续行于胜者 cascade
  async _handleArenaPick(slot) {
    const ids = this._arenaIds;
    if (!ids || typeof slot !== "number" || !ids[slot]) return;
    const ls = require("./ls-bridge");
    try {
      const win = ids[slot];
      await ls.call("ConvergeArenaCascades", { targetCascadeId: win });
      this._cascadeLsId = win;
      try {
        const sr = await ls.call("GetCascadeTrajectorySteps", { cascadeId: win });
        this._cascadeSeen = (((sr.trajectory || sr).steps) || []).length;
      } catch (_) { this._cascadeSeen = 0; }
      this._arenaIds = null;
      this._post({ type: "arena-picked", slot });
      this._post({ type: "arena-avail", ok: false, reason: "该会话已经过 Arena 收敛，无法再开" });
      this._log("cascade: ConvergeArenaCascades → 胜者 " + win);
      try { const gs = await this._cxGenStats(win); if (gs.last && this._arenaMsgId) this._post({ type: "msg-stats", id: this._arenaMsgId, text: gs.last }); } catch (_) {}
    } catch (e) { this._post({ type: "error", text: "Arena 拣选失败: " + e.message }); }
  }

  // 官方式回退检查点: 先 GetRevertPreview{cascadeId,stepIndex} 展示将被撤销的文件改动, 确认后 RevertToCascadeStep 截断轨迹重放
  async _handleCxRevert(stepIndex) {
    if (!this._cascadeLsId || typeof stepIndex !== "number") return;
    try {
      const ls = require("./ls-bridge");
      const pv = await ls.call("GetRevertPreview", { cascadeId: this._cascadeLsId, stepIndex }).catch(() => ({}));
      const eds = (pv && pv.codeEditPreviews) || [];
      if (eds.length) {
        const files = eds.map((p) => {
          const f = (p.fileUri || "").replace(/^file:\/\//, "");
          const lines = (p.diff && p.diff.lines) || [];
          const add = lines.filter((l) => l.type === "UNIFIED_DIFF_LINE_TYPE_INSERT").length;
          const del = lines.filter((l) => l.type === "UNIFIED_DIFF_LINE_TYPE_DELETE").length;
          const act = (p.actionType || "").replace("CODE_REVERT_ACTION_TYPE_", "").toLowerCase();
          return f + "  (" + act + (add ? " +" + add : "") + (del ? " -" + del : "") + ")";
        });
        const ok = await vscode.window.showWarningMessage(
          "回退将撤销 " + eds.length + " 个文件的改动:\n" + files.join("\n"),
          { modal: true }, "回退");
        if (ok !== "回退") return;
      }
      await ls.call("RevertToCascadeStep", { cascadeId: this._cascadeLsId, stepIndex });
      await this._loadCascadeTrajectory(this._cascadeLsId);
    } catch (e) { this._post({ type: "error", text: "回退失败: " + e.message }); }
  }

  // 官方式导出会话: GetCascadeTranscriptForTrajectoryId{cascadeId} → 纯文本转录(MESSAGE n - User/Assistant/Tool) 开新文档
  async _handleSessionExport(sessionId) {
    const cid = sessionId && sessionId.startsWith("cx:") ? sessionId.slice(3) : this._cascadeLsId;
    if (!cid) return;
    try {
      const ls = require("./ls-bridge");
      const r = await ls.call("GetCascadeTranscriptForTrajectoryId", { cascadeId: cid });
      const doc = await vscode.workspace.openTextDocument({ language: "markdown",
        content: (r && r.transcript) || "(空转录)" });
      await vscode.window.showTextDocument(doc, { preview: false });
    } catch (e) { this._post({ type: "error", text: "导出失败: " + e.message }); }
  }

  // 官方式从消息开分支: BranchCascade{baseCascadeId,branchFromStepIndex,items} → newCascadeId 新轨迹续跑(原轨迹不动)
  async _handleCxBranch(stepIndex, text) {
    if (!this._cascadeLsId || typeof stepIndex !== "number") return;
    const input = await vscode.window.showInputBox({
      prompt: "从此消息开分支 · 编辑后作为分支首条消息发送", value: text || "" });
    if (input == null || !input.trim()) return;
    try {
      const ls = require("./ls-bridge");
      await this._cxEnsureModel();
      const r = await ls.call("BranchCascade", {
        baseCascadeId: this._cascadeLsId,
        branchFromStepIndex: stepIndex,
        items: [{ text: input.trim() }],
        cascadeConfig: { plannerConfig: this._cxPlannerConfig() },
      });
      if (!r || !r.newCascadeId) throw new Error("未返回 newCascadeId");
      const nid = r.newCascadeId;
      this._post({ type: "assistant-done", id: "cxbr" + Date.now(), text: "⑂ 已开分支，生成中…" });
      // 等分支轨迹本轮收敛(出现 plannerResponse 且末步 DONE/ERROR)后整体重放
      for (let i = 0; i < 120; i++) {
        await new Promise((res) => setTimeout(res, 1500));
        let t; try { t = await ls.call("GetCascadeTrajectorySteps", { cascadeId: nid }); } catch (_) { continue; }
        const steps = ((t.trajectory || t).steps) || [];
        const last = steps[steps.length - 1];
        if (steps.length && last && /DONE|ERROR/.test(last.status || "") &&
            steps.some((s) => s.plannerResponse && s.plannerResponse.response)) break;
      }
      await this._loadCascadeTrajectory(nid);
      this._handleSessionsList();
    } catch (e) { this._post({ type: "error", text: "分支失败: " + e.message }); }
  }

  // 官方式 Rules · Skills 定制面板: GetAllRules → {memories(规则), skills} —— .windsurf/rules 与 .agents/skills 同源
  async _handleCustomizationsList() {
    try {
      const { rules, skills, workflows } = await this._collectCustomizations();
      this._post({ type: "customizations", rules, skills, workflows });
    } catch (e) { this._post({ type: "error", text: "读取 Rules/Skills 失败: " + e.message }); }
  }

  async _collectCustomizations() {
    {
      const ls = require("./ls-bridge");
      const [r, sk, wf] = await Promise.all([
        ls.call("GetAllRules", {}).catch(() => ({})),
        ls.call("GetAllSkills", {}).catch(() => ({})),
        ls.call("GetAllWorkflows", {}).catch(() => ({})),
      ]);
      const fromUri = (u) => (u || "").replace(/^file:\/\//, "");
      const rules = (r.memories || []).map((m) => {
        const ps = (m.scope && m.scope.projectScope) || {};
        return { name: m.title || m.memoryId || "", trigger: (ps.trigger || "").replace("CORTEX_MEMORY_TRIGGER_", "").toLowerCase(),
          path: fromUri(ps.absoluteFilePath) };
      });
      // 全局规则(~/.devin/rules/*.md, 含 Cursor 导入): GetAllRules 只返回工作区规则, 此处直读补显
      try {
        const fs = require("fs");
        const gdir = path.join(os.homedir(), ".devin", "rules");
        const seen = new Set(rules.map((x) => x.path));
        for (const f of fs.readdirSync(gdir)) {
          if (!f.endsWith(".md")) continue;
          const p = path.join(gdir, f);
          if (seen.has(p)) continue;
          let name = f.replace(/\.md$/, "");
          try { const h1 = fs.readFileSync(p, "utf8").match(/^#\s+(.+)$/m); if (h1) name = h1[1].trim(); } catch (_) {}
          rules.push({ name, trigger: "global", path: p });
        }
      } catch (_) {}
      // 官方设置页「+ Global」写入 ~/.codeium/windsurf/memories/global_rules.md, GetAllRules 不含, 直读补显
      try {
        const fs = require("fs");
        const gp = path.join(os.homedir(), ".codeium", "windsurf", "memories", "global_rules.md");
        if (!rules.some((x) => x.path === gp) && fs.statSync(gp).size > 0) {
          const first = (fs.readFileSync(gp, "utf8").split(/\r?\n/).find((l) => l.trim()) || "").replace(/^#\s*/, "").slice(0, 80);
          rules.push({ name: first || "global_rules.md", trigger: "global", path: gp });
        }
      } catch (_) {}
      const skills = (sk.skills || r.skills || []).map((s) => ({
        name: s.name || s.skillName || "", description: s.description || "", path: fromUri(s.path) }));
      const workflows = (wf.workflows || []).map((w) => ({
        name: w.name || "", description: w.description || "", path: fromUri(w.path), builtin: !!w.isBuiltin }));
      return { rules, skills, workflows };
    }
  }

  // 官方 Customizations 页签同源: Rules / Skills / Workflows / Memories 一处总览(QuickPick)
  async _customizationsQuickPick() {
    let data = { rules: [], skills: [], workflows: [] };
    try { data = await this._collectCustomizations(); } catch (_) {}
    const items = [];
    const sect = (label) => items.push({ label, kind: vscode.QuickPickItemKind.Separator });
    sect("Rules");
    for (const r of data.rules) items.push({ label: "$(law) " + r.name, description: r.trigger || "", _path: r.path });
    items.push({ label: "$(add) 新建 Rule…", _create: "rule" });
    sect("Workflows");
    for (const w of data.workflows) items.push({ label: "$(run-all) " + w.name, description: (w.builtin ? "builtin · " : "") + (w.description || ""), _path: w.path });
    items.push({ label: "$(add) 新建 Workflow…", _create: "workflow" });
    sect("Skills");
    for (const s of data.skills) items.push({ label: "$(book) " + s.name, description: s.description || "", _path: s.path });
    items.push({ label: "$(add) 新建 Skill…", _create: "skill" });
    sect("Memories");
    items.push({ label: "$(database) 查看 Memories(面板)", _memories: true });
    // 官方 Customizations 页头同文(反提 workbench 真源): title + description
    const pick = await vscode.window.showQuickPick(items, { title: "Customizations",
      placeHolder: "Customize Cascade to get a better, more personalized experience.", matchOnDescription: true });
    if (!pick) return;
    if (pick._create) return this._handleCustomizationCreate(pick._create);
    if (pick._memories) { await vscode.commands.executeCommand(this._viewId + ".open").then(undefined, () => {}); return this._handleMemoriesList(); }
    if (pick._path) return this._handleOpenFile(pick._path);
  }

  // 官方式新建定制文件: CreateCustomizationFile{fileName,fileType,workspaceConfigDir:".windsurf"} → filePath 开编辑器
  // 实测: RULES → .windsurf/rules/<name>; SKILLS → .windsurf/skills/<name>/SKILL.md; WORKFLOWS → .windsurf/workflows/<name>
  // 全局变体(官方 processCreateWorkflow 同源): GLOBAL_WORKFLOWS/GLOBAL_SKILLS 落 ~/.codeium/windsurf 下, 不需 workspaceConfigDir
  async _handleCustomizationCreate(kind) {
    const ft = { rule: "CUSTOMIZATION_FILE_TYPE_RULES", skill: "CUSTOMIZATION_FILE_TYPE_SKILLS",
      workflow: "CUSTOMIZATION_FILE_TYPE_WORKFLOWS", gskill: "CUSTOMIZATION_FILE_TYPE_GLOBAL_SKILLS",
      gworkflow: "CUSTOMIZATION_FILE_TYPE_GLOBAL_WORKFLOWS" }[kind];
    if (!ft) return;
    const isGlobal = kind === "gskill" || kind === "gworkflow";
    const isSkill = kind === "skill" || kind === "gskill";
    const name = await vscode.window.showInputBox({ prompt: "新建" + (isGlobal ? "全局 " : " ") + kind.replace(/^g/, "") + " 名称(文件名)" });
    if (!name || !name.trim()) return;
    try {
      const ls = require("./ls-bridge");
      // rule/workflow 是 markdown 文件, LS 不自动补扩展名, 无 .md 会不被扫描收录
      let fn = name.trim();
      if (!isSkill && !/\.md$/i.test(fn)) fn += ".md";
      const req = { fileName: fn, fileType: ft };
      if (!isGlobal) req.workspaceConfigDir = ".windsurf";
      const r = await ls.call("CreateCustomizationFile", req);
      const p = ((r && r.filePath) || "").replace(/^file:\/\//, "");
      if (p) await this._handleOpenFile(p);
      this._handleCustomizationsList();
    } catch (e) { this._post({ type: "error", text: "新建失败: " + e.message }); }
  }

  // 官方式从 Cursor 导入规则: ImportFromCursor{sourcePath} → {copiedFiles:[...]}
  // 契约(实测): sourcePath 必须以 .cursor/rules 结尾; *.mdc 拷为 ~/.devin/rules/*.md(全局规则)
  async _handleCursorImport() {
    try {
      const fs = require("fs");
      const cands = [];
      const probe = (p) => { try { if (fs.statSync(p).isDirectory()) cands.push(p); } catch (_) {} };
      probe(path.join(os.homedir(), ".cursor", "rules"));
      for (const ws of vscode.workspace.workspaceFolders || []) probe(path.join(ws.uri.fsPath, ".cursor", "rules"));
      let src = cands[0];
      if (cands.length > 1) src = await vscode.window.showQuickPick(cands, { placeHolder: "选择 Cursor 规则目录" });
      if (!cands.length) {
        const pick = await vscode.window.showOpenDialog({ canSelectFolders: true, canSelectFiles: false, openLabel: "选择 .cursor/rules 目录" });
        src = pick && pick[0] && pick[0].fsPath;
      }
      if (!src) return;
      const ls = require("./ls-bridge");
      const r = await ls.call("ImportFromCursor", { sourcePath: src });
      const n = ((r && r.copiedFiles) || []).length;
      vscode.window.showInformationMessage("已从 Cursor 导入 " + n + " 条规则 → ~/.devin/rules/");
      this._handleCustomRefresh();
    } catch (e) { this._post({ type: "error", text: "Cursor 导入失败: " + e.message }); }
  }

  // 官方式变更存档: AcknowledgeCascadeCodeEdit{cascadeId,absoluteUri:[repeated],accept}(二进制描述符实测 absolute_uri/contents 均 repeated string)
  // 服务端仅记录存档态(拒绝不回改文件); 拒绝新建文件时本地删除, 修改类引导用步骤回退
  async _handleCxAck(file, accept, created) {
    if (!this._cascadeLsId || !file) return;
    try {
      const ls = require("./ls-bridge");
      const uri = file.startsWith("file://") ? file : "file://" + file;
      await ls.call("AcknowledgeCascadeCodeEdit", {
        cascadeId: this._cascadeLsId, absoluteUri: [uri], accept });
      if (!accept && created) {
        const ok = await vscode.window.showWarningMessage(
          "已拒绝新建文件。同时删除 " + file + " ？", { modal: true }, "删除");
        if (ok === "删除") await vscode.workspace.fs.delete(vscode.Uri.file(file.replace(/^file:\/\//, "")));
      } else if (!accept) {
        vscode.window.showInformationMessage("已拒绝归档。如需撤销文件内容，请用消息卡 ↩ 回退到此步。");
      }
      this._post({ type: "cx-acked", file, accept });
    } catch (e) { this._post({ type: "error", text: "存档失败: " + e.message }); }
  }

  // 官方式内建 workflow 拷入工作区定制: CopyBuiltinWorkflowToWorkspace{workflow(全对象)} → 落盘 .devin/workflows/<name>.md
  async _handleWorkflowCopy(name) {
    if (!name) return;
    try {
      const ls = require("./ls-bridge");
      const all = await ls.call("GetAllWorkflows", {});
      const w = (all.workflows || []).find((x) => x.name === name && x.isBuiltin);
      if (!w) throw new Error("非内建 workflow: " + name);
      const r = await ls.call("CopyBuiltinWorkflowToWorkspace", { workflow: w });
      const p = (r && r.workflow && r.workflow.path) || "";
      if (p) await this._handleOpenFile(p.replace(/^file:\/\//, ""));
      this._handleCustomizationsList();
    } catch (e) { this._post({ type: "error", text: "拷贝 workflow 失败: " + e.message }); }
  }

  _handleMcpConfigOpen() {
    const p = path.join(os.homedir(), ".codeium", "windsurf", "mcp_config.json");
    vscode.workspace.openTextDocument(p).then((d) => vscode.window.showTextDocument(d), () => {});
  }

  // 官方式: 点击变更卡文件名在编辑器打开该文件
  async _handleOpenFile(p) {
    if (!p) return;
    try {
      let uri = null;
      if (p.startsWith("/")) uri = vscode.Uri.file(p);
      else {
        const root = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0];
        if (root) {
          const cand = vscode.Uri.joinPath(root.uri, p);
          try { await vscode.workspace.fs.stat(cand); uri = cand; } catch (_) {}
        }
        if (!uri) {
          const hits = await vscode.workspace.findFiles("**/" + p.split("/").pop(), "**/node_modules/**", 1);
          if (hits.length) uri = hits[0];
        }
      }
      if (!uri) throw new Error("未找到文件");
      // 目录(如 list 卡标题)在资源管理器中定位, 而非按文件打开
      try {
        const st = await vscode.workspace.fs.stat(uri);
        if (st.type & vscode.FileType.Directory)
          return await vscode.commands.executeCommand("revealInExplorer", uri);
      } catch (_) {}
      const doc = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(doc, { preview: true });
    } catch (e) { vscode.window.showWarningMessage("打不开 " + p + ": " + e.message); }
  }

  // 官方 bug 报告对位: SubmitBugReport{description,bugType(ide|cascade),diagnosticsJson,tabInfo,other}
  // →{messageLink}(后端实测返回 Slack 链接)。bugType 选项与官方面板同为 IDE/Cascade。
  async _handleBugReport() {
    const type = await vscode.window.showQuickPick(
      [{ label: "Cascade", value: "cascade" }, { label: "IDE", value: "ide" }],
      { placeHolder: "Bug 类型(官方同项)" });
    if (!type) return;
    const desc = await vscode.window.showInputBox({ prompt: "描述问题(Submit bug report)", placeHolder: "What went wrong?" });
    if (!desc) return;
    try {
      const ls = require("./ls-bridge");
      const diag = JSON.stringify({ source: "dao-desktop", cascadeId: this._cascadeLsId || "", agent: this._agent || "" });
      const r = await ls.call("SubmitBugReport", { description: desc, bugType: type.value, diagnosticsJson: diag, tabInfo: "", other: "" });
      vscode.window.showInformationMessage("Bug report submitted" + (r.messageLink ? ": " + r.messageLink : ""));
    } catch (e) { vscode.window.showWarningMessage("Bug 报告提交失败: " + e.message); }
  }

  // 宿主侧录音: 第三方 IDE webview 权限策略禁麦克风(NotAllowedError), 改由扩展宿主进程
  // 调系统录音(ffmpeg pulse/avfoundation/dshow 或 arecord)落 wav, 停止后同路 GetTranscription。
  _recCmd(out) {
    const p = process.platform;
    if (p === "darwin") return ["ffmpeg", ["-y", "-f", "avfoundation", "-i", ":0", "-ac", "1", "-ar", "16000", out]];
    if (p === "win32") return ["ffmpeg", ["-y", "-f", "dshow", "-i", "audio=default", "-ac", "1", "-ar", "16000", out]];
    return ["ffmpeg", ["-y", "-f", "pulse", "-i", "default", "-ac", "1", "-ar", "16000", out]];
  }

  _handleRecordStart() {
    if (this._recProc) return;
    const os = require("os"), path = require("path"), cp = require("child_process");
    this._recFile = path.join(os.tmpdir(), "dao-mic-" + Date.now() + ".wav");
    const [bin, args] = this._recCmd(this._recFile);
    try {
      const proc = cp.spawn(bin, args, { stdio: ["pipe", "ignore", "ignore"] });
      proc.on("error", (e) => { this._recProc = null; this._post({ type: "record-state", on: false }); this._post({ type: "error", text: "录音不可用(" + bin + "): " + e.message }); });
      this._recProc = proc;
      this._post({ type: "record-state", on: true });
    } catch (e) { this._post({ type: "error", text: "录音启动失败: " + e.message }); }
  }

  async _handleRecordStop() {
    const proc = this._recProc, file = this._recFile;
    this._recProc = null;
    this._post({ type: "record-state", on: false });
    if (!proc) return;
    const fs = require("fs");
    await new Promise((res) => { proc.on("exit", res); try { proc.stdin.write("q"); } catch (_) {} try { proc.kill("SIGINT"); } catch (_) {} setTimeout(res, 3000); });
    try {
      const b = fs.readFileSync(file);
      try { fs.unlinkSync(file); } catch (_) {}
      if (b.length < 128) return this._post({ type: "error", text: "录音为空(无麦克风输入?)" });
      return this._handleTranscribe(b.toString("base64"));
    } catch (e) { this._post({ type: "error", text: "录音读取失败: " + e.message }); }
  }

  // 官方语音转写对位: GetTranscription{audioData}→transcribedText(后端实测 wav/webm 均可)。
  async _handleTranscribe(b64) {
    try {
      const ls = require("./ls-bridge");
      const r = await ls.call("GetTranscription", { audioData: String(b64 || "") });
      this._post({ type: "transcribed", text: r.transcribedText || "" });
    } catch (e) { this._post({ type: "error", text: "语音转写失败: " + e.message }); }
  }

  // 官方 Share 对位: CreateTrajectoryShare{cascadeId,shareStatus:TEAM}→shareId,
  // 链接同官方 {webappHost}/windsurf/conversation-shares/{shareId}, 复制到剪贴板。
  async _handleShareConversation() {
    const cid = this._cascadeLsId;
    if (!cid) return vscode.window.showWarningMessage("当前无进行中的 Cascade 会话可分享");
    try {
      const ls = require("./ls-bridge");
      const r = await ls.call("CreateTrajectoryShare", { cascadeId: cid, shareStatus: "TRAJECTORY_SHARE_STATUS_TEAM" });
      if (!r.shareId) throw new Error("服务端未返回 shareId");
      let host = "app.devin.ai";
      try {
        const u = await ls.call("GetUserStatus", {});
        host = ((((u.userStatus || u).planStatus || {}).planInfo || {}).devinInfo || {}).webappHost || host;
      } catch (_) {}
      const url = "https://" + host.replace(/^https?:\/\//, "") + "/windsurf/conversation-shares/" + r.shareId;
      await vscode.env.clipboard.writeText(url);
      vscode.window.showInformationMessage("分享链接已复制: " + url);
    } catch (e) { vscode.window.showWarningMessage("分享失败: " + e.message); }
  }

  async _handleSessionNew() {
    if (this._cxWatch) { try { this._cxWatch.close(); } catch (_) {} this._cxWatch = null; }
    this._cxWatchId = null;
    this._cascadeLsId = null;
    this._cascadeSeen = 0;
    this._cxWorktree = false;
    this._post({ type: "worktree-info", on: false });
    // 官方式: 新建会话回到 New session 首页(居中 logo + Recent sessions)
    this._post({ type: "history-clear", home: true });
    this._post({ type: "arena-avail", ok: true, reason: "" });
    try {
      if (!(await this._ensureAcp()) || !this._acp) throw new Error("ACP 未就绪(未登录或启动退避中)");
      const res = await this._acp.newSession();
      this._pushSessionMeta(res);
      this._post({ type: "history-done" });
      this._handleSessionsList();
    } catch (e) { this._post({ type: "error", text: "新建会话失败: " + e.message }); }
  }

  // ACP session/update → webview 流式增量。实测帧形态(印254):
  //   update.sessionUpdate ∈ { agent_message_chunk(答复) / agent_thought_chunk(思考)
  //     / session_info_update / current_mode_update / usage_update / … },文本在 update.content.text。
  _onAcpUpdate(params) {
    const u = params && params.update;
    if (!u || !u.sessionUpdate) return;
    const kind = u.sessionUpdate;
    const text = u.content && typeof u.content.text === "string" ? u.content.text : "";
    const id = this._activeId;
    if (kind === "agent_message_chunk" && text) {
      this._post({ type: "assistant-delta", id, text });
    } else if (kind === "agent_thought_chunk" && text) {
      this._post({ type: "thought-delta", id, text });
    } else if (kind === "user_message_chunk" && text) {
      // 仅历史回放时出现(session/load)；每个用户回合后的助手增量归入新气泡
      this._activeId = "r" + Date.now() + Math.random().toString(36).slice(2, 6);
      this._post({ type: "user-replay", text });
    } else if (kind === "tool_call" || kind === "tool_call_update") {
      this._post({ type: "tool-call", id, toolCallId: u.toolCallId,
        title: u.title, kindName: u.kind, status: u.status,
        locations: (u.locations || []).map((l) => l.path).filter(Boolean) });
    } else if (kind === "plan") {
      this._post({ type: "plan", id, entries: (u.entries || []).map((e) => ({
        content: e.content, status: e.status, priority: e.priority })) });
    } else if (kind === "config_option_update") {
      this._post({ type: "config-options", agent: "acp", configOptions: u.configOptions || [] });
    } else if (kind === "current_mode_update") {
      this._post({ type: "mode-current", modeId: u.currentModeId });
    } else if (kind === "session_info_update") {
      this._post({ type: "session-info", title: u.title || null });
    } else if (kind === "usage_update") {
      this._post({ type: "usage", usage: u });
    } else if (kind === "available_commands_update") {
      this._post({ type: "commands", agent: "devin-local", commands: (u.availableCommands || []).map((c) => ({
        name: c.name, description: c.description })) });
    }
  }

  // Proxy Pro 路由轨: 周流一轮对话到路由渠道, 维持面板内多轮上下文。
  async _pxChatTurn(msg, uid) {
    this._pxHistory = this._pxHistory || [];
    this._pxHistory.push({ role: "user", content: String(msg.text || "") });
    try {
      const r = await proxyRuntime.chat(uid, { messages: this._pxHistory.slice(-40), maxTokens: 4096, timeoutMs: 120000 });
      if (!r.ok) throw new Error(r.error || ("HTTP " + r.httpCode));
      this._pxHistory.push({ role: "assistant", content: r.content });
      this._post({ type: "px-route-info", uid, channel: r.channel, model: r.model });
      this._log("cascade: 路由生效 " + uid + " → " + r.channel + "/" + r.model);
      return this._post({ type: "assistant-done", id: msg.id, text: r.content });
    } catch (e) {
      this._pxHistory.pop();
      return this._post({ type: "assistant-done", id: msg.id,
        text: "⚠ Proxy Pro 路由投递失败(" + uid + "): " + (e && e.message || e) });
    }
  }

  async _handleChat(msg) {
    const agent = msg.agent || "devin-local";
    if (agent === "devin-local") {
      const bin = this._bin();
      if (!bin) {
        return this._post({ type: "assistant-done", id: msg.id,
          text: "未找到 `devin` 二进制。Devin Local 需 Devin Desktop 内置 CLI;设置环境变量 " +
                "DAO_DEVIN_BIN 指向 …/extensions/windsurf/devin/bin/devin 后重试。" });
      }
      try {
        this._activeId = msg.id;
        if (!(await this._ensureAcp()) || !this._acp) throw new Error("ACP 未就绪(未登录或启动退避中)");
        await this._acp.prompt(msg.text);
        return this._post({ type: "assistant-done", id: msg.id });
      } catch (e) {
        // 鉴权失败多为 ACP 起在登录之前(旧凭据驻留子进程) —— 杀掉令下轮
        // _ensureAcp 以新 credentials.toml 重生, 免手动 Reload Window。
        if (/authenticat|log ?in/i.test(String(e && e.message || e)) && this._acp) {
          try { this._acp.stop(); } catch (_) {}
          this._acp = null; this._acpReady = false;
          return this._post({ type: "assistant-done", id: msg.id,
            text: "ACP 请求失败: " + e.message + "\n(已重置 ACP 进程; 登录后直接重发即可)" });
        }
        return this._post({ type: "assistant-done", id: msg.id, text: "ACP 请求失败: " + e.message });
      }
    }
    if (agent === "cascade") {
      // Cascade 轨 = 官方 language_server 同源直连(Connect RPC · JSON), 实测配方:
      // StartCascade → SendUserCascadeMessage(带 plannerConfig{requestedModelUid,
      // plannerTypeConfig:agentic}) → 挂 StreamCascadeReactiveUpdates 驱动生成
      // → 轮询 GetCascadeTrajectorySteps 取 plannerResponse 增量渲染。
      const ls = require("./ls-bridge");
      let drive = null;
      try {
        if (!ls.ready()) throw new Error("官方 language_server 未就绪(端口/CSRF 未捕获,稍候重试)");
        if (!ls.apiKey()) throw new Error("未取得官方登录态 apiKey(credentials.toml),请先在官方本体登录");
        if (!this._cascadeModel) {
          await this._pushCascadeConfigOptions();
          if (!this._cascadeModel) this._cascadeModel = "swe-1-6-slow";
          this._log("cascade: 可用模型 → " + this._cascadeModel);
        }
        // 格利替换·路由生效层: 选中官方模型 UID 命中 Proxy Pro 路由 → 本轮对话
        // 整体改投第三方渠道(含面板内多轮上下文), 官方 LS 不再收到该消息。
        if (proxyRuntime.resolve(this._cascadeModel)) {
          return await this._pxChatTurn(msg, this._cascadeModel);
        }
        // 图像附件(官方 ImageData{base64Data,mimeType,caption} · 顶层 images[]): 仅当模型支持
        const imgs = this._cxImages(msg.images);
        // 官方式发送前配额闸: CheckUserMessageRateLimit → !hasCapacity 即拦(免费额度耗尽时与官方同款提示)
        try {
          // 官方双闸: CheckUserMessageRateLimit(消息频次) + CheckChatCapacity(后端总容量), 任一无容即拦
          const [cap, chat] = await Promise.all([
            ls.call("CheckUserMessageRateLimit", {}),
            ls.call("CheckChatCapacity", {}).catch(() => null),
          ]);
          if (cap && cap.hasCapacity === false) {
            const left = (cap.messagesRemaining >= 0 && cap.maxMessages >= 0) ? "（" + cap.messagesRemaining + "/" + cap.maxMessages + "）" : "";
            return this._post({ type: "assistant-done", id: msg.id, text: "⚠ 已达消息用量上限" + left + "，请稍后再试或升级套餐" });
          }
          if (chat && chat.hasCapacity === false) {
            return this._post({ type: "assistant-done", id: msg.id, text: "⚠ 后端聊天容量已满，请稍后再试" });
          }
        } catch (_) {}
        // 官方式消息队列: 运行中再发 → QueueCascadeMessage(带 cascadeConfig, 轮次结束 LS 自动续驱)
        if (this._cxRunning && this._cascadeLsId) {
          await this._cxEnqueue(msg.text, imgs);
          return this._post({ type: "assistant-done", id: msg.id, text: "⏳ 已加入队列，当前轮次结束后自动发送" });
        }
        // 官方式 Arena 模式: StartCascade{startArena:N} → 每个 arena cascade 各发同一消息
        // → 并行轮询各自 plannerResponse → 用户择优 → ConvergeArenaCascades{targetCascadeId}
        // 会话中途亦可开 Arena: SpawnArenaModeMidConversation{cascadeId,count} 克隆出携完整历史的并行 cascade
        if (msg.arena) {
          this._cxRunning = true;
          return await this._cxArenaRace(msg, ls, imgs);
        }
        // 官方 Start With History: 新会话首条消息前置最近编码轨迹摘要
        let swhPrefix = "";
        if (msg.startWithHistory && !this._cascadeLsId) swhPrefix = await this._swhContext();
        if (!this._cascadeLsId) {
          // 官方式 worktree 会话(后端实测): StartCascade{gitWorktree:true} → 首次发消息时 LS 自动
          // git worktree add 到 ~/.windsurf/worktrees/<repo>/<repo>-<slug>, 改动隔离于该 worktree, 主工作区不受影响
          const r = await ls.call("StartCascade", msg.worktree ? { gitWorktree: true } : {});
          this._cascadeLsId = r.cascadeId;
          this._cascadeSeen = 0;
          this._cxWorktree = !!msg.worktree;
          this._log("cascade: StartCascade" + (msg.worktree ? "(worktree)" : "") + " → " + this._cascadeLsId);
          if (this._cxWorktree) this._post({ type: "worktree-info", on: true, text: "⏎ 本会话运行于隔离 worktree，改动不直接落入主工作区" });
        }
        this._cxRunning = true;
        try {
          const req = {
            cascadeId: this._cascadeLsId,
            items: [{ text: swhPrefix + msg.text }],
            cascadeConfig: { plannerConfig: this._cxPlannerConfig() },
          };
          if (imgs.length) req.images = imgs;
          await ls.call("SendUserCascadeMessage", req);
        } catch (e) {
          // LS 仍在续驱队列(executor not idle): 标志位与真实态错位 → 退回入队, 由 LS 自动续驱
          if (/not idle|RUN_STATUS_RUNNING/i.test(e.message || "")) {
            await this._cxEnqueue(msg.text, imgs);
            return this._post({ type: "assistant-done", id: msg.id, text: "⏳ 已加入队列，当前轮次结束后自动发送" });
          }
          throw e;
        }
        // R70: 驱动流帧即轨迹变更信号 —— 帧到立即唤醒拉增量(静默时 1s 兜底), 降出字延迟
        let wake = null, pendingFrame = false;
        drive = ls.driveStream(this._cascadeLsId, () => { if (wake) { const w = wake; wake = null; w(); } else pendingFrame = true; });
        const emitted = {}; let firstK = -1, grew = false, stable = 0;
        const sidOf = (k) => (firstK < 0 || k === firstK) ? msg.id : msg.id + "@" + k;
        for (let i = 0; i < 200; i++) {
          await new Promise((r) => setTimeout(r, 150)); // 帧风暴限速: 两次拉取至少间隔 150ms
          if (pendingFrame) pendingFrame = false;
          else await new Promise((r) => { const t = setTimeout(() => { wake = null; r(); }, 850); wake = () => { clearTimeout(t); r(); }; });
          let r;
          try { r = await ls.call("GetCascadeTrajectorySteps", { cascadeId: this._cascadeLsId }); }
          catch (_) { continue; }
          const steps = ((r.trajectory || r).steps) || [];
          let progress = false, allDone = true;
          for (let k = this._cascadeSeen || 0; k < steps.length; k++) {
            const st = steps[k];
            // 队列消息已续驱 → 摘除待发 chip
            if (st.type === "CORTEX_STEP_TYPE_USER_INPUT" && this._cxQueue && this._cxQueue.length) {
              const ut = st.userInput && st.userInput.userResponse;
              const qi = this._cxQueue.findIndex((q) => q.text === ut);
              if (qi >= 0) { this._cxQueue.splice(qi, 1); this._post({ type: "cx-queue", queue: this._cxQueue }); }
            }
            // 官方式逐步泡: 各 plannerResponse 步各自成泡, 与工具步卡按轨迹顺序内联穿插(官方渲染同序)
            if (st.plannerResponse && st.plannerResponse.response) {
              const resp = st.plannerResponse.response;
              if (firstK < 0) firstK = k;
              const prev = emitted[k] || "";
              if (resp.length > prev.length) {
                this._post({ type: "assistant-delta", id: sidOf(k), text: resp.slice(prev.length) });
                emitted[k] = resp; grew = true; progress = true;
              }
            }
            // 官方式思考流: plannerResponse.thinking → thought 泡(与 ACP agent_thought_chunk 同渠)
            if (st.plannerResponse && st.plannerResponse.thinking && !this._cxThoughtSeen) this._cxThoughtSeen = new Set();
            if (st.plannerResponse && st.plannerResponse.thinking && !this._cxThoughtSeen.has(this._cascadeLsId + ":" + k)) {
              this._cxThoughtSeen.add(this._cascadeLsId + ":" + k);
              this._post({ type: "thought-delta", id: sidOf(k), text: st.plannerResponse.thinking });
            }
            // 官方式步卡: 工具类轨迹步以 tool-call 呈现(真实工具名+关键参数, 出自 metadata.toolCall)
            const ty = st.type || "";
            if (ty && !/PLANNER_RESPONSE|USER_INPUT|CHECKPOINT|ERROR_MESSAGE|RETRIEVE_MEMORY|DUMMY/.test(ty)) {
              this._post(this._cxStepCard(st, k, msg.id));
            }
            // 与官方一致: 后端 errorMessage 步(如模型高负载)直接呈现给用户, 不再空转
            if (st.errorMessage && st.errorMessage.shouldShowUser !== false) {
              const em = (st.errorMessage.error && (st.errorMessage.error.userErrorMessage || st.errorMessage.error.shortError)) || "Cascade 后端错误";
              this._cascadeSeen = steps.length;
              if (firstK >= 0) {
                this._post({ type: "assistant-done", id: msg.id + "@e" + k, text: "⚠ " + em });
                return this._post({ type: "assistant-done", id: msg.id });
              }
              return this._post({ type: "assistant-done", id: msg.id, text: "⚠ " + em });
            }
            // 官方式命令审批: RUN_COMMAND 待确认步 → Run/Skip → HandleCascadeUserInteraction
            if (ty === "CORTEX_STEP_TYPE_RUN_COMMAND" && /WAITING|HALTED/.test(st.status || "")) {
              this._cxAsked = this._cxAsked || new Set();
              const akey = this._cascadeLsId + ":" + k;
              if (!this._cxAsked.has(akey)) {
                this._cxAsked.add(akey);
                const reqId = "cxrc-" + Date.now() + "-" + k;
                const cmd = (st.runCommand && (st.runCommand.proposedCommandLine || st.runCommand.commandLine)) || "";
                this._permPending = this._permPending || new Map();
                const cid = this._cascadeLsId, kk = k;
                new Promise((resolve) => {
                  this._permPending.set(reqId, resolve);
                  this._post({ type: "permission", reqId, title: "运行命令? " + cmd,
                    options: [{ optionId: "confirm", name: "Run" }, { optionId: "skip", name: "Skip" }] });
                }).then(async (opt) => {
                  const action = opt === "confirm" ? "RUN_COMMAND_ACTION_CONFIRM" : "RUN_COMMAND_ACTION_SKIP";
                  const tr = await ls.call("GetCascadeTrajectory", { cascadeId: cid });
                  const tid = ((tr && tr.trajectory) || {}).trajectoryId || "";
                  return ls.call("HandleCascadeUserInteraction", { cascadeId: cid,
                    interaction: { trajectoryId: tid, stepIndex: kk, runCommand: { action } } });
                }).catch((e) => this._log("cascade: 审批回传失败 " + e.message));
              }
            }
            // 官方式提问交互: ASK_USER_QUESTION 待答步 → 选项按钮 → askUserQuestion.response 回传
            if (ty === "CORTEX_STEP_TYPE_ASK_USER_QUESTION" && /WAITING|HALTED/.test(st.status || "")) {
              this._cxAsked = this._cxAsked || new Set();
              const qkey = this._cascadeLsId + ":q:" + k;
              if (!this._cxAsked.has(qkey)) {
                this._cxAsked.add(qkey);
                const rq = ((st.askUserQuestion || {}).request) || {};
                const reqId = "cxaq-" + Date.now() + "-" + k;
                this._permPending = this._permPending || new Map();
                const cid = this._cascadeLsId, kk = k;
                const opts = (rq.options || []).map((o) => ({ optionId: o.label, name: o.label }));
                new Promise((resolve) => {
                  this._permPending.set(reqId, resolve);
                  this._post({ type: "permission", reqId, title: rq.question || "Cascade 提问", options: opts });
                }).then(async (label) => {
                  if (label == null) return;
                  const tr = await ls.call("GetCascadeTrajectory", { cascadeId: cid });
                  const tid = ((tr && tr.trajectory) || {}).trajectoryId || "";
                  return ls.call("HandleCascadeUserInteraction", { cascadeId: cid,
                    interaction: { trajectoryId: tid, stepIndex: kk, askUserQuestion: { response: label } } });
                }).catch((e) => this._log("cascade: 提问回传失败 " + e.message));
              }
            }
            if (st.status && !/DONE|ERROR/.test(st.status)) allDone = false;
          }
          if (progress) stable = 0;
          else if (grew && allDone && ++stable >= 3) { this._cascadeSeen = steps.length; break; }
        }
        this._post({ type: "assistant-done", id: msg.id, text: grew ? undefined : "(Cascade 无输出)" });
        if (grew) { try { const gs = await this._cxGenStats(this._cascadeLsId); if (gs.last) this._post({ type: "msg-stats", id: msg.id, text: gs.last }); } catch (_) {} }
        return;
      } catch (e) {
        return this._post({ type: "assistant-done", id: msg.id, text: "Cascade 轨失败: " + e.message });
      } finally {
        this._cxRunning = false; if (drive) drive.close();
        // 新会话首轮结束后同样挂外部续写监听(R74 原仅历史载入路径)
        if (this._cascadeLsId && this._cxWatchId !== this._cascadeLsId) this._watchCascadeTrajectory(this._cascadeLsId);
      }
    }
    if (agent === "devin-cloud") {
      // Devin Cloud 轨 = 远端 ACP over wss(与官方 CLI cloud_handoff 同源):
      // <devin_api_url>/acp/live?token=<windsurf_api_key> → initialize → session/new → session/prompt
      try {
        this._activeId = msg.id;
        if (!this._cloud) this._cloud = new AcpWssClient({ log: this._log,
          onUpdate: (params) => this._onAcpUpdate(params) });
        await this._cloud.connect();
        if (!this._cloud.sessionId) {
          const cwd = (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0]
            && vscode.workspace.workspaceFolders[0].uri.fsPath) || "/";
          const res = await this._cloud.newSession(cwd);
          if (res && res.configOptions) this._post({ type: "config-options", agent: "acp", configOptions: res.configOptions });
        }
        await this._cloud.prompt(msg.text);
        return this._post({ type: "assistant-done", id: msg.id });
      } catch (e) {
        if (this._cloud) { this._cloud.stop(); this._cloud = null; }
        return this._post({ type: "assistant-done", id: msg.id, text: "Devin Cloud 轨失败: " + e.message });
      }
    }
  }

  _html(webview) {
    const n = nonce();
    const csp = [
      "default-src 'none'",
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src 'nonce-${n}'`,
      `connect-src 'none'`,
      `img-src data:`,
    ].join("; ");
    const agentsJson = JSON.stringify(AGENTS);
    return `<!DOCTYPE html><html lang="zh"><head><meta charset="utf-8"/>
<meta http-equiv="Content-Security-Policy" content="${csp}"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<style>
  :root { color-scheme: light dark;
    --card: var(--vscode-input-background);
    --line: var(--vscode-widget-border, var(--vscode-panel-border));
    --dim: var(--vscode-descriptionForeground);
    --pill-hover: var(--vscode-toolbar-hoverBackground, rgba(128,128,128,.15)); }
  html,body { height:100%; margin:0; }
  body { display:flex; flex-direction:column; font:13px var(--vscode-font-family); color:var(--vscode-foreground); background:var(--vscode-sideBar-background); position:relative; }
  /* 官方会话内搜索浮层(SearchConversation · Ctrl+F): 输入 + n/m 计数 + 上/下/关 */
  #convFind { display:none; position:absolute; top:32px; right:12px; z-index:40; background:var(--card); border:1px solid var(--line); border-radius:8px; padding:3px 6px; align-items:center; gap:2px; box-shadow:0 4px 12px rgba(0,0,0,.3); }
  #convFind.show { display:flex; }
  #convFind input { width:150px; background:transparent; border:none; outline:none; color:var(--vscode-foreground); font:12px var(--vscode-font-family); }
  #convFind .cfc { font-size:11px; color:var(--dim); min-width:30px; text-align:center; }
  #convFind button { background:transparent; border:none; color:var(--dim); cursor:pointer; padding:1px 4px; font-size:12px; border-radius:4px; }
  #convFind button:hover { background:var(--pill-hover); color:var(--vscode-foreground); }
  .cfHit { outline:1px solid var(--vscode-editor-findMatchHighlightBorder, rgba(86,156,214,.45)); border-radius:4px; }
  .cfCur { outline:2px solid var(--vscode-focusBorder, rgba(86,156,214,.9)); border-radius:4px; }
  #log { flex:1; overflow:auto; padding:10px 12px; display:flex; flex-direction:column; gap:10px; }
  #log > * { flex-shrink:0; }
  /* 空态 = 官方 New session 首页:居中 logo + 近期会话 */
  .empty { margin:auto auto 0; text-align:center; max-width:320px; width:100%; }
  .empty .logo { opacity:.10; margin-bottom:10px; color:var(--vscode-foreground); }
  .empty .ttl { font-size:15px; font-weight:600; margin-bottom:4px; }
  .empty .sub { font-size:12px; color:var(--dim); line-height:1.5; }
  .empty .kbd, .mhint .kbd { display:inline-block; font-size:10px; color:var(--dim); border:1px solid var(--line); border-radius:4px; padding:0 4px; margin-left:4px; vertical-align:2px; }
  .empty .trycloud { margin-top:12px; background:transparent; color:inherit; border:1px solid var(--line); border-radius:6px; padding:4px 12px; font-size:12px; cursor:pointer; }
  .empty .trycloud:hover { background:var(--pill-hover); }
  .mhint { padding:6px 10px; font-size:10.5px; color:var(--dim); border-top:1px solid var(--line); }
  #recent { margin:14px auto 0; width:100%; max-width:420px; text-align:left; font-size:12px; display:none; }
  #recent.show { display:block; }
  #recent .rhead { display:flex; align-items:center; color:var(--dim); margin-bottom:4px; }
  #recent .rhead .va { margin-left:auto; color:var(--vscode-textLink-foreground); cursor:pointer; }
  #recent .item { display:flex; gap:6px; align-items:center; padding:5px 8px; border-radius:6px; cursor:pointer; }
  #recent .item:hover { background:var(--pill-hover); }
  #recent .item .when { margin-left:auto; color:var(--dim); font-size:11px; white-space:nowrap; }
  #recent .item .arch { display:none; color:var(--dim); cursor:pointer; }
  #recent .item:hover .arch { display:inline; }
  #recent .item .arch:hover { color:var(--vscode-errorForeground,#f44); }
  .msg { padding:8px 10px; border-radius:10px; word-break:break-word; max-width:100%; line-height:1.5; }
  .msg.user { white-space:pre-wrap; }
  .msg pre { position:relative; background:var(--card); border:1px solid var(--line); border-radius:8px; padding:8px 10px; overflow:auto; margin:6px 0; font:12px var(--vscode-editor-font-family, monospace); }
  .msg pre code { white-space:pre-wrap; word-break:break-word; }
  .cblang { font-size:10px; color:var(--dim); border-bottom:1px solid var(--line); margin:-8px -10px 6px; padding:3px 10px; }
  .copybtn { position:absolute; top:4px; right:4px; font-size:10px; padding:1px 6px; border-radius:5px; border:1px solid var(--line); background:var(--vscode-sideBar-background); color:var(--dim); cursor:pointer; opacity:0; transition:opacity .12s; }
  .msg pre:hover .copybtn, .copybtn:hover { opacity:1; }
  .copybtn.done { color:var(--vscode-testing-iconPassed,#4caf50); }
  .mem { text-align:left; border:1px solid var(--line); border-radius:8px; padding:6px 8px; margin:6px 0; font-size:12px; }
  .mem .mh { display:flex; gap:6px; align-items:center; }
  .mem .mt { font-weight:600; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .mem .mi { cursor:pointer; opacity:.6; }
  .mem .mi:hover { opacity:1; }
  .mem .mc { color:var(--dim); margin-top:2px; }
  .mem .mtags { color:var(--dim); font-size:10px; margin-top:2px; }
  code.fchip { cursor:pointer; }
  code.fchip:hover { text-decoration:underline; color:var(--vscode-textLink-foreground); }
  /* 助手气泡悬停复制 */
  .msg.assistant { position:relative; }
  .msgcopy { position:absolute; top:0; right:0; font-size:10px; padding:1px 6px; border-radius:5px; border:1px solid var(--line); background:var(--vscode-sideBar-background); color:var(--dim); cursor:pointer; opacity:0; transition:opacity .12s; }
  .msg.assistant:hover .msgcopy { opacity:.9; }
  .msg.user { position:relative; }
  .msgrevert { position:absolute; top:-8px; right:-6px; font-size:11px; padding:0 5px; border-radius:5px; border:1px solid var(--line); background:var(--vscode-sideBar-background); color:var(--dim); cursor:pointer; opacity:0; transition:opacity .12s; }
  .msg.user:hover .msgrevert { opacity:.9; }
  .msgbranch { position:absolute; top:-8px; right:20px; font-size:11px; padding:0 5px; border-radius:5px; border:1px solid var(--line); background:var(--vscode-sideBar-background); color:var(--dim); cursor:pointer; opacity:0; transition:opacity .12s; }
  .msg.user:hover .msgbranch { opacity:.9; }
  .msgcopy.done { color:var(--vscode-testing-iconPassed,#4caf50); }
  /* 待发队列 chip 栏 */
  #queuebar { display:none; flex-direction:column; gap:4px; padding:4px 10px 0; }
  #queuebar.show { display:flex; }
  .qchip { display:flex; gap:6px; align-items:center; font-size:12px; color:var(--dim); background:var(--card); border:1px solid var(--line); border-radius:8px; padding:3px 8px; }
  .qchip .qtxt { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .qchip button { border:none; background:transparent; color:var(--dim); cursor:pointer; font-size:12px; padding:0 3px; }
  .qchip button:hover { color:var(--vscode-foreground); }
  .msg code { background:var(--card); border-radius:4px; padding:0 4px; font:12px var(--vscode-editor-font-family, monospace); }
  .msg pre code { background:transparent; border:none; padding:0; }
  .msg p { margin:4px 0; }
  .msg ul,.msg ol { margin:4px 0; padding-left:20px; }
  .msg h1,.msg h2,.msg h3 { font-size:13px; font-weight:600; margin:8px 0 4px; }
  .msg a { color:var(--vscode-textLink-foreground); }
  .msg.user { background:var(--card); align-self:flex-end; }
  .msg.assistant { background:transparent; align-self:flex-start; padding-left:0; }
  .msg .thought { display:block; margin-bottom:4px; }
  .msg .msgstats { margin-top:5px; font-size:10px; color:var(--dim); opacity:.72; letter-spacing:.2px; }
  /* 官方式回合尾反馈行: 👍👎 图标排, 悬停提亮; 统计信息降为悬停提示 */
  .msg .fbrow { margin-top:6px; display:flex; gap:2px; opacity:.5; }
  .msg .fbrow:hover { opacity:1; }
  .fbtn { background:none; border:none; color:var(--dim); cursor:pointer; padding:2px 5px; border-radius:4px; display:inline-flex; align-items:center; }
  .fbtn:hover { background:var(--pill-hover); color:var(--vscode-foreground); }
  .fbtn.on { color:var(--vscode-foreground); }
  .msg .thead2 { cursor:pointer; user-select:none; font-size:11px; color:var(--dim); display:flex; gap:4px; align-items:center; }
  .msg .tbody2 { opacity:.55; font-style:italic; font-size:12px; margin-top:2px; white-space:pre-wrap; }
  /* 官方式圆角 composer 卡片 */
  .composer { padding:8px 10px 6px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:8px 10px 6px; display:flex; flex-direction:column; gap:6px; }
  .card.dragover { border-color:var(--accent,#4a9eff); box-shadow:0 0 0 1px var(--accent,#4a9eff) inset; }
  textarea { resize:none; background:transparent; color:var(--vscode-input-foreground); border:none; outline:none; padding:2px 2px 0; font:13px var(--vscode-font-family); min-height:20px; max-height:120px; }
  .row { display:flex; gap:4px; align-items:center; flex-wrap:wrap; row-gap:2px; }
  .pill { display:inline-flex; gap:4px; align-items:center; border:none; background:transparent; color:var(--dim); font:12px var(--vscode-font-family); border-radius:999px; padding:3px 8px; cursor:pointer; }
  .pill:hover { background:var(--pill-hover); color:var(--vscode-foreground); }
  .pill select { appearance:none; -webkit-appearance:none; background:transparent; color:inherit; border:none; font:inherit; cursor:pointer; outline:none; max-width:110px; text-overflow:ellipsis; }
  .pill select option { background:var(--vscode-dropdown-background); color:var(--vscode-dropdown-foreground); }
  /* 官方真源: ＋钮 radius 6px · bg rgba(255,255,255,.05) */
  #plusBtn, #imgBtn, #arenaBtn, #wtBtn { width:24px; height:24px; border-radius:6px; border:none; background:rgba(255,255,255,.05); color:var(--dim); cursor:pointer; font-size:14px; line-height:1; display:inline-flex; align-items:center; justify-content:center; }
  #imgBtn, #arenaBtn, #wtBtn { background:transparent; }
  #micBtn.bare { width:24px; height:24px; border:none; background:transparent; color:var(--dim); cursor:pointer; display:inline-flex; align-items:center; justify-content:center; border-radius:6px; }
  #micBtn.bare:hover { background:var(--pill-hover); }
  #plusBtn:hover, #imgBtn:hover, #arenaBtn:hover, #wtBtn:hover { background:var(--pill-hover); }
  /* 官方空态无此行: 静息隐去, 悬停 Recent 区即现(功能不减) */
  #autoOpenRow { opacity:0; transition:opacity .15s; }
  #recent:hover #autoOpenRow { opacity:1; }
  /* 官方 1:1: 默认行只有 ＋ / Code / 模型 / agent / 🎙 / ↑ —— 增强钮(图/竞技场/worktree)悬停或聚焦时才现身, 静态外观与官方一致 */
  #imgBtn, #arenaBtn, #wtBtn, #tokCount { display:none; }
  .card:hover #imgBtn, .card:focus-within #imgBtn,
  .card:hover #arenaBtn, .card:focus-within #arenaBtn,
  .card:hover #wtBtn, .card:focus-within #wtBtn,
  .card:hover #tokCount, .card:focus-within #tokCount { display:inline-flex; }
  #arenaBtn.on, #wtBtn.on { border-color:var(--accent,#4a9eff); color:var(--accent,#4a9eff); }
  #wtBar { display:none; align-items:center; gap:8px; font-size:11px; color:var(--dim); padding:3px 8px; border:1px dashed var(--line); border-radius:6px; margin:4px 0; }
  #wtBar button { background:transparent; border:1px solid var(--line); border-radius:6px; color:inherit; cursor:pointer; font-size:11px; padding:1px 8px; }
  .arena { display:flex; gap:8px; margin-top:4px; }
  .arenacol { flex:1; min-width:0; border:1px solid var(--line); border-radius:8px; padding:6px 8px; }
  .arenacol .ah { font-size:11px; color:var(--dim); margin-bottom:4px; }
  .arenacol .ab { white-space:pre-wrap; font-size:12px; word-break:break-word; }
  .apick { margin-top:6px; border:1px solid var(--line); background:transparent; color:inherit; border-radius:6px; padding:2px 8px; cursor:pointer; font-size:11px; }
  .apick:disabled { opacity:.4; cursor:default; }
  .arenacol.win { border-color:var(--accent,#4a9eff); }
  .arenacol.lose { opacity:.45; }
  /* 官方式图像附件缩略图条(composer 内 & 消息气泡内复用) */
  .imgstrip { display:flex; flex-wrap:wrap; gap:6px; }
  .imgstrip:empty { display:none; }
  .imgthumb { position:relative; width:56px; height:56px; border-radius:8px; overflow:hidden; border:1px solid var(--line); background:var(--card); }
  .imgthumb img { width:100%; height:100%; object-fit:cover; display:block; }
  .imgthumb .rm { position:absolute; top:1px; right:1px; width:16px; height:16px; border-radius:999px; border:none; background:rgba(0,0,0,.6); color:#fff; font-size:11px; line-height:15px; cursor:pointer; padding:0; }
  .msg .imgstrip { margin-top:6px; }
  .msg .imgthumb { width:120px; height:auto; max-height:200px; }
  .msg .imgthumb img { height:auto; }
  .badge { font-size:9px; padding:0 4px; border-radius:6px; border:1px solid var(--line); color:var(--dim); }
  .spacer { flex:1; }
  /* 官方真源: 发送钮白底圆(rgb 255,255,255 · radius 9999px), 箭头深色 */
  button.send { width:26px; height:26px; border-radius:999px; background:#fff; color:#1e1e1e; border:none; cursor:pointer; font-size:13px; line-height:1; display:inline-flex; align-items:center; justify-content:center; }
  button.send:disabled { opacity:.4; cursor:default; }
  /* 官方式发送钮: 空输入灰圆, 有内容才亮主题色 */
  button.send.idle { background:var(--pill-hover); color:var(--dim); }
  /* 卡片下方目标行: Local · 工作区 —— 与官方一致 */
  .target { display:flex; gap:10px; align-items:center; font-size:11.5px; color:var(--dim); padding:5px 4px 0; }
  .target .seg { display:inline-flex; gap:4px; align-items:center; }
  .target .env { margin-left:auto; }
  /* 官方底行只有「Local」: 工作区/用量/引擎详情静息隐去, 悬停即现(信息不减) */
  .target #folderSeg, .target #usage, .target .env { opacity:0; transition:opacity .15s; }
  .target:hover #folderSeg, .target:hover #usage, .target:hover .env { opacity:1; }
  #authbar { display:none; gap:6px; align-items:center; padding:6px 12px; font-size:12px; flex-wrap:wrap; }
  #authbar.show { display:flex; }
  #authbar input { flex:1; min-width:120px; background:var(--card); color:var(--vscode-input-foreground); border:1px solid var(--line); border-radius:6px; padding:3px 6px; }
  #authbar button { background:var(--vscode-button-secondaryBackground,var(--vscode-button-background)); color:var(--vscode-button-secondaryForeground,var(--vscode-button-foreground)); border:none; border-radius:6px; padding:3px 10px; cursor:pointer; }
  #modeWrap, #modelWrap { display:none; }
  #modeWrap.show, #modelWrap.show { display:inline-flex; }
  .tool { font-size:12px; border:1px solid var(--line); border-radius:8px; padding:4px 8px; align-self:flex-start; opacity:.85; max-width:100%; }
  .tool .thead { display:flex; gap:6px; align-items:center; }
  .tool .tt { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .tool .chev { color:var(--dim); }
  .tool .tbody { margin-top:4px; padding-top:4px; border-top:1px solid var(--line); color:var(--dim); font:11px var(--vscode-editor-font-family, monospace); word-break:break-all; }
  .tool .st { font-size:10px; padding:0 5px; border-radius:5px; border:1px solid var(--line); }
  .tool.completed .st { color:var(--vscode-testing-iconPassed,#4caf50); }
  .tool.failed .st { color:var(--vscode-errorForeground,#f44); }
  .diffcard { font-size:12px; border:1px solid var(--line); border-radius:8px; align-self:stretch; max-width:100%; overflow:hidden; }
  .diffcard .dhead { display:flex; gap:6px; align-items:center; padding:4px 8px; cursor:pointer; }
  .diffcard .fn { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .diffcard .fn:hover { text-decoration:underline; color:var(--vscode-textLink-foreground); }
  .diffcard .add { color:var(--vscode-testing-iconPassed,#4caf50); }
  .diffcard .del { color:var(--vscode-errorForeground,#f44); }
  .diffcard .newb { font-size:10px; padding:0 5px; border-radius:5px; border:1px solid var(--line); color:var(--dim); }
  .diffcard .dbody { border-top:1px solid var(--line); font:11px var(--vscode-editor-font-family,monospace); overflow-x:auto; }
  .diffcard .dl { white-space:pre; padding:0 8px; }
  .diffcard .dl.i { background:rgba(76,175,80,.12); color:var(--vscode-testing-iconPassed,#4caf50); }
  .diffcard .dl.d { background:rgba(244,67,54,.12); color:var(--vscode-errorForeground,#f44); }
  .cmdcard { font-size:12px; border:1px solid var(--line); border-radius:8px; align-self:stretch; max-width:100%; overflow:hidden; }
  .cmdcard .chead { display:flex; gap:6px; align-items:center; padding:4px 8px; cursor:pointer; }
  .cmdcard .cmd { font:11px var(--vscode-editor-font-family,monospace); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .cmdcard .cwd { color:var(--dim); font-size:10px; white-space:nowrap; }
  .cmdcard .cmi { background:transparent; border:none; color:var(--dim); cursor:pointer; padding:1px 3px; border-radius:4px; display:inline-flex; align-items:center; }
  .cmdcard .cmi:hover { background:var(--pill-hover); color:var(--vscode-foreground); }
  .cmdcard .ec { margin-left:auto; font-size:10px; }
  .cmdcard .ec.ok { color:var(--vscode-testing-iconPassed,#4caf50); }
  .cmdcard .ec.bad { color:var(--vscode-errorForeground,#f44); }
  .cmdcard .cbody { border-top:1px solid var(--line); font:11px var(--vscode-editor-font-family,monospace); overflow-x:auto; white-space:pre; padding:4px 8px; color:var(--dim); max-height:180px; overflow-y:auto; }
  .plan { font-size:12px; border-left:2px solid var(--line); padding:2px 8px; align-self:stretch; opacity:.9; }
  .plan .pe { display:block; }
  .plan .pe.completed { text-decoration:line-through; opacity:.6; }
  .perm { border:1px solid var(--vscode-inputValidation-warningBorder,#c90); border-radius:8px; padding:6px 8px; font-size:12px; align-self:stretch; }
  .perm button { margin:2px 4px 0 0; background:var(--vscode-button-background); color:var(--vscode-button-foreground); border:none; border-radius:6px; padding:2px 8px; cursor:pointer; }
  #usage { font-size:10px; opacity:.55; }
  /* 官方式斜杠命令 / @ 提及补全菜单 */
  #slashMenu, #atMenu { display:none; margin:0 0 6px; background:var(--card); border:1px solid var(--line); border-radius:10px; overflow:hidden; max-height:180px; overflow-y:auto; }
  #slashMenu.show, #atMenu.show { display:block; }
  #slashMenu .it, #atMenu .it { padding:5px 10px; font-size:12px; cursor:pointer; display:flex; gap:8px; align-items:baseline; }
  #slashMenu .it .nm, #atMenu .it .nm { font-weight:600; }
  #slashMenu .it .ds, #atMenu .it .ds { color:var(--dim); font-size:11px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  #slashMenu .it.sel, #slashMenu .it:hover, #atMenu .it.sel, #atMenu .it:hover { background:var(--pill-hover); }
  #atMenu .empty2 { padding:6px 10px; font-size:11.5px; color:var(--dim); }
  #modelBtn, #modeBtn, #agentBtn { background:transparent; border:none; color:inherit; font:inherit; cursor:pointer; max-width:130px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; padding:0; }
  #modelMenu, #modeMenu, #agentMenu { display:none; margin:0 0 6px; background:var(--card); border:1px solid var(--line); border-radius:10px; overflow:hidden; }
  #modelMenu.show, #modeMenu.show, #agentMenu.show { display:block; }
  #modelMenu { position:relative; }
  #modelFilterRow { display:flex; align-items:center; gap:6px; border-bottom:1px solid var(--line); padding:0 10px; }
  #modelFilterRow svg { flex-shrink:0; color:var(--dim); }
  #modelMenu #modelFilter { flex:1; min-width:0; box-sizing:border-box; background:transparent; border:none; color:var(--vscode-foreground); font:12px var(--vscode-font-family); padding:6px 0; outline:none; }
  #modelMenu #modelFilter::placeholder { color:var(--dim); }
  #modelList, #modeList, #agentList { max-height:260px; overflow-y:auto; }
  #modeList .mit, #agentList .mit { padding:5px 10px; cursor:pointer; }
  #modeList .mit:hover, #modeList .mit.sel, #modeList .mit.kbd, #agentList .mit:hover, #agentList .mit.sel, #agentList .mit.kbd { background:var(--pill-hover); }
  #modeList .mit.kbd, #agentList .mit.kbd { outline:1px solid var(--line); outline-offset:-1px; }
  #modeList .mit .mrow, #agentList .mit .mrow { display:flex; align-items:baseline; gap:6px; font-size:12px; }
  #modeList .mit .mds, #agentList .mit .mds { color:var(--dim); font-size:10.5px; margin-top:1px; line-height:1.35; }
  #agentList .mit .bdg { font-size:9.5px; padding:0 5px; border:1px solid var(--line); border-radius:6px; color:var(--dim); flex-shrink:0; }
  #agentList .agadd { text-align:center; color:var(--dim); font-size:14px; line-height:1; padding:4px 10px 6px; border-top:1px solid var(--line); }
  #modelList .mgrp { padding:5px 10px 2px; font-size:10.5px; font-weight:600; color:var(--dim); text-transform:uppercase; letter-spacing:.4px; position:sticky; top:0; background:var(--card); }
  #modelList .mit { padding:5px 10px; cursor:pointer; }
  #modelList .mit:hover, #modelList .mit.sel, #modelList .mit.kbd { background:var(--pill-hover); }
  #modelList .mit.kbd { outline:1px solid var(--line); outline-offset:-1px; }
  #modelList .mit.dis { opacity:.45; cursor:default; }
  #modelList .mit .mrow { display:flex; align-items:baseline; gap:6px; font-size:12px; }
  #modelList .mit .mnm { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  #modelList .mit .mx { color:var(--dim); font-size:11px; flex-shrink:0; }
  #modelList .mit .mds { color:var(--dim); font-size:10.5px; margin-top:1px; line-height:1.35; }
  #modelList .empty3 { padding:8px 10px; font-size:11.5px; color:var(--dim); }
  #modelSort { border:none; background:transparent; color:var(--dim); cursor:pointer; padding:2px; display:inline-flex; align-items:center; }
  #modelSort.on { color:var(--vscode-foreground); }
  #modelSortMenu { display:none; position:absolute; right:6px; top:30px; min-width:140px; background:var(--card); border:1px solid var(--line); border-radius:6px; z-index:30; padding:4px 0; }
  #modelSortMenu.show { display:block; }
  #modelSortMenu .sml { padding:3px 10px; font-size:10.5px; color:var(--dim); text-transform:uppercase; letter-spacing:.4px; }
  #modelSortMenu .smi { padding:4px 10px; font-size:12px; cursor:pointer; }
  #modelSortMenu .smi:hover { background:var(--pill-hover); }
  #modelSortMenu .smi.on { color:var(--vscode-textLink-foreground); }
  #modelSortMenu .smsep { height:1px; background:var(--line); margin:4px 0; }
  #modelSortMenu .sminfo { padding:4px 10px; font-size:11px; color:var(--dim); max-width:200px; }
</style></head><body>
  <div id="modetabs" style="display:flex;gap:2px;padding:4px 10px 0;font-size:11px;">
    <button id="mtAgent" title="打开 Agent 看板(Devin Cloud 会话 Board/List)" style="border:1px solid var(--line);background:transparent;color:var(--dim);border-radius:6px 0 0 6px;padding:2px 12px;cursor:pointer;">Agent</button>
    <button id="mtEditor" title="Editor 模式(当前)" style="border:1px solid var(--line);background:var(--pill-hover);color:var(--vscode-foreground);border-radius:0 6px 6px 0;padding:2px 12px;cursor:default;margin-left:-2px;">Editor</button>
    <button id="mtShare" title="Share conversation · 生成团队分享链接并复制" style="margin-left:auto;border:none;background:transparent;color:var(--dim);cursor:pointer;padding:2px 6px;display:inline-flex;align-items:center;">${OI.svg("share-os",13)}</button>
    <button id="mtBug" title="Submit bug report · 官方同路提交 bug 报告" style="border:none;background:transparent;color:var(--dim);cursor:pointer;padding:2px 6px;display:inline-flex;align-items:center;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 2 1.88 1.88"/><path d="M14.12 3.88 16 2"/><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"/><path d="M12 20v-9"/><path d="M6.53 9C4.6 8.8 3 7.1 3 5"/><path d="M6 13H2"/><path d="M3 21c0-2.1 1.7-3.9 3.8-4"/><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"/><path d="M22 13h-4"/><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"/></svg></button>
    <button id="mtCustom" title="Customizations · Rules/Workflows/Skills/Memories" style="border:none;background:transparent;color:var(--dim);cursor:pointer;padding:2px 6px;display:inline-flex;align-items:center;">${OI.svg("book",13)}</button>
    <button id="mtSettings" title="Devin Settings 整页" style="border:none;background:transparent;color:var(--dim);cursor:pointer;padding:2px 6px;display:inline-flex;align-items:center;">${OI.svg("settings-gear-1",13)}</button>
    <button id="acctChip" title="账号 · 点击查看账户卡(官方顶栏头像同位)" style="display:none;border:none;background:#2ea3ff;color:#fff;cursor:pointer;width:18px;height:18px;border-radius:50%;font-size:9px;font-weight:600;line-height:18px;padding:0;margin-left:4px;align-self:center;text-align:center;"></button>
  </div>
  <div id="convFind"><input id="cfIn" placeholder="Search conversation"><span class="cfc" id="cfCnt"></span><button id="cfPrev" title="Previous (Shift+Enter)">↑</button><button id="cfNext" title="Next (Enter)">↓</button><button id="cfClose" title="Close (Escape)">✕</button></div>
  <div id="log">
    <div class="empty" id="empty">
      <div class="logo"><svg width="64" height="37" viewBox="0 0 512 297" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M507.28 0.142623H502.4C476.721 0.10263 455.882 20.899 455.882 46.5745V150.416C455.882 171.153 438.743 187.95 418.344 187.95C406.224 187.95 394.125 181.851 386.945 171.613L280.889 20.1391C272.089 7.56133 257.77 0.0626373 242.271 0.0626373C218.091 0.0626373 196.332 20.6191 196.332 45.9946V150.436C196.332 171.173 179.333 187.97 158.794 187.97C146.634 187.97 134.555 181.871 127.375 171.633L8.69966 2.12228C6.01976 -1.71705 0 0.182617 0 4.8618V95.426C0 100.005 1.39995 104.444 4.01984 108.204L120.815 274.995C127.715 284.853 137.895 292.172 149.634 294.831C179.013 301.51 206.052 278.894 206.052 250.079V145.697C206.052 124.961 222.851 108.164 243.59 108.164H243.65C256.15 108.164 267.87 114.263 275.049 124.501L381.125 275.955C389.945 288.552 403.524 296.031 419.724 296.031C444.443 296.031 465.622 275.455 465.622 250.099V145.677C465.622 124.941 482.421 108.144 503.16 108.144H507.3C509.9 108.144 512 106.044 512 103.445V4.8418C512 2.24226 509.9 0.142623 507.3 0.142623H507.28Z"/></svg></div>
      <div class="ttl" id="emptyTtl"><b>Cascade</b> <span id="emptyModeName">Code</span> <span style="white-space:nowrap"><span class="kbd">Ctrl</span><span class="kbd">.</span></span></div>
      <div class="sub" id="emptySub">Kick off a new project. Make changes across your entire codebase.</div>
      <button id="tryCloud" class="trycloud" title="切换到 Devin Cloud agent"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align:-2px"><path d="M8.120 4.042 C 5.012 4.380,2.409 6.479,1.423 9.443 C 0.555 12.051,1.045 14.847,2.750 17.017 C 3.051 17.400,3.710 18.048,4.102 18.346 C 5.293 19.253,6.701 19.816,8.140 19.961 C 8.444 19.991,10.018 20.000,13.220 19.990 C 18.375 19.973,18.072 19.989,18.949 19.697 C 19.684 19.452,20.371 19.063,20.949 18.562 C 22.629 17.109,23.359 14.796,22.819 12.639 C 22.541 11.528,22.013 10.611,21.194 9.816 C 20.287 8.936,19.251 8.419,17.986 8.215 C 17.669 8.164,17.419 8.155,16.841 8.172 C 15.925 8.200,15.924 8.200,15.636 7.746 C 14.696 6.265,13.372 5.168,11.740 4.520 C 11.360 4.369,10.649 4.180,10.160 4.100 C 9.692 4.024,8.578 3.992,8.120 4.042 M9.907 5.582 C 10.933 5.734,11.911 6.154,12.802 6.825 C 13.349 7.237,13.853 7.787,14.310 8.469 C 14.686 9.031,14.885 9.245,15.200 9.425 C 15.635 9.672,16.011 9.737,16.646 9.675 C 17.475 9.594,18.231 9.720,18.949 10.060 C 19.461 10.302,19.857 10.586,20.248 10.993 C 20.618 11.379,20.793 11.626,21.031 12.101 C 21.344 12.725,21.479 13.327,21.480 14.094 C 21.481 16.114,20.139 17.851,18.180 18.366 C 17.629 18.511,17.051 18.526,12.600 18.510 C 7.987 18.492,8.131 18.499,7.300 18.285 C 4.951 17.679,3.068 15.640,2.616 13.213 C 2.528 12.742,2.497 11.649,2.558 11.184 C 2.840 9.038,4.117 7.199,6.000 6.226 C 6.952 5.735,7.792 5.529,8.875 5.523 C 9.242 5.521,9.658 5.545,9.907 5.582 " stroke="none" fill-rule="evenodd" fill="currentColor"/></svg> Try Devin Cloud</button>
      <div id="recent">
        <div class="rhead"><span>Recent sessions</span><span class="va" id="viewAll">View all</span></div>
        <div id="recentList"></div>
        <label id="autoOpenRow" style="display:flex;align-items:center;gap:6px;margin-top:10px;font-size:11.5px;color:var(--dim);cursor:pointer;"><input type="checkbox" id="autoOpenCk" style="margin:0;">启动时自动打开最近会话</label>
        <label id="swhRow" title="When enabled, messages will automatically include your recent coding history for better context awareness." style="display:flex;align-items:center;gap:6px;margin-top:6px;font-size:11.5px;color:var(--dim);cursor:pointer;"><input type="checkbox" id="swhCk" style="margin:0;">Start With History</label>
      </div>
    </div>
  </div>
  <div id="authbar">
    <span id="authmsg"></span>
    <button id="loginBtn">登录</button>
    <input id="authcode" placeholder="粘贴一次性登录 code" style="display:none"/>
    <button id="authsubmit" style="display:none">提交</button>
  </div>
  <div id="wtBar"><span id="wtTxt"></span><button id="wtMerge" title="ResolveWorktreeChanges: 将 worktree 改动合并回主工作区">合并回工作区</button><button id="wtUndo" style="display:none" title="UndoWorktreeMerge: 撤销最近一次合并，恢复主工作区合并前状态">撤销合并</button><button id="wtOpen" title="在新窗口打开隔离 worktree 目录">打开 worktree</button></div>
  <div id="queuebar"></div>
  <div class="composer">
    <div id="slashMenu"></div>
    <div id="atMenu"></div>
    <div id="modelMenu"><div id="modelFilterRow"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10.207 3.043 C 8.656 3.193,7.096 3.846,5.900 4.847 C 4.985 5.612,4.307 6.477,3.800 7.529 C 2.453 10.317,2.837 13.625,4.789 16.040 C 5.075 16.394,5.761 17.067,6.100 17.326 C 7.743 18.581,9.834 19.176,11.832 18.958 C 13.289 18.798,14.736 18.220,15.883 17.337 L 16.106 17.166 17.943 19.007 C 19.169 20.236,19.833 20.873,19.940 20.923 C 20.243 21.065,20.552 21.004,20.788 20.755 C 21.013 20.516,21.060 20.233,20.923 19.940 C 20.873 19.833,20.236 19.169,19.007 17.943 L 17.166 16.106 17.337 15.883 C 18.220 14.736,18.798 13.289,18.958 11.832 C 19.176 9.834,18.579 7.737,17.325 6.100 C 17.055 5.747,16.510 5.190,16.100 4.847 C 14.483 3.494,12.337 2.837,10.207 3.043 M11.940 4.577 C 14.094 4.908,15.858 6.196,16.838 8.153 C 17.493 9.462,17.661 11.157,17.283 12.629 C 16.641 15.130,14.538 17.031,11.980 17.423 C 11.467 17.502,10.533 17.502,10.020 17.423 C 7.461 17.031,5.360 15.132,4.717 12.629 C 4.451 11.596,4.451 10.404,4.717 9.371 C 5.361 6.863,7.431 4.993,10.020 4.580 C 10.456 4.511,11.498 4.509,11.940 4.577 " stroke="none" fill-rule="evenodd" fill="currentColor"/></svg><input id="modelFilter" type="text" placeholder="Search all models"><button id="modelSort" title="Order by"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6.700 3.076 C 6.506 3.165,6.384 3.292,6.302 3.489 C 6.254 3.604,6.240 3.798,6.240 4.356 L 6.240 5.074 6.110 5.101 C 5.371 5.258,4.488 5.792,3.979 6.388 C 2.197 8.477,2.961 11.662,5.493 12.696 C 5.673 12.770,5.915 12.852,6.030 12.879 L 6.240 12.928 6.240 16.656 L 6.240 20.383 6.330 20.559 C 6.379 20.656,6.489 20.790,6.574 20.858 C 6.711 20.967,6.756 20.980,7.000 20.980 C 7.244 20.980,7.289 20.967,7.426 20.858 C 7.511 20.790,7.620 20.656,7.670 20.559 L 7.760 20.383 7.760 16.656 L 7.760 12.928 7.970 12.878 C 8.260 12.808,8.785 12.593,9.044 12.436 C 10.487 11.567,11.250 9.860,10.921 8.243 C 10.721 7.264,10.197 6.415,9.438 5.843 C 8.976 5.495,8.365 5.202,7.890 5.101 L 7.760 5.074 7.759 4.347 C 7.758 3.726,7.747 3.597,7.684 3.460 C 7.503 3.068,7.077 2.902,6.700 3.076 M16.700 3.076 C 16.506 3.165,16.384 3.292,16.302 3.489 C 16.247 3.620,16.240 4.187,16.240 8.356 L 16.240 13.074 16.110 13.101 C 15.371 13.258,14.488 13.792,13.979 14.388 C 12.196 16.478,12.957 19.649,15.495 20.699 C 17.525 21.539,19.876 20.541,20.704 18.488 C 20.994 17.769,21.070 16.977,20.921 16.243 C 20.721 15.264,20.197 14.415,19.438 13.843 C 18.976 13.495,18.365 13.202,17.890 13.101 L 17.760 13.074 17.759 8.347 C 17.758 3.837,17.755 3.613,17.684 3.460 C 17.503 3.068,17.077 2.902,16.700 3.076 M7.817 6.633 C 8.521 6.888,9.103 7.469,9.370 8.183 C 9.446 8.388,9.458 8.499,9.458 9.000 C 9.458 9.501,9.446 9.612,9.370 9.817 C 9.231 10.187,9.044 10.473,8.736 10.785 C 8.515 11.008,8.377 11.108,8.116 11.232 C 7.695 11.432,7.447 11.490,7.000 11.490 C 6.553 11.490,6.305 11.432,5.884 11.232 C 5.334 10.970,4.852 10.425,4.634 9.817 C 4.526 9.518,4.488 8.830,4.559 8.470 C 4.730 7.598,5.497 6.796,6.371 6.575 C 6.699 6.492,7.520 6.525,7.817 6.633 M17.817 14.633 C 18.521 14.888,19.103 15.469,19.370 16.183 C 19.446 16.388,19.458 16.499,19.458 17.000 C 19.458 17.501,19.446 17.612,19.370 17.817 C 19.231 18.187,19.044 18.473,18.736 18.785 C 18.515 19.008,18.377 19.108,18.116 19.232 C 17.695 19.432,17.447 19.490,17.000 19.490 C 16.553 19.490,16.305 19.432,15.884 19.232 C 15.334 18.970,14.852 18.425,14.634 17.817 C 14.526 17.518,14.488 16.830,14.559 16.470 C 14.730 15.598,15.497 14.796,16.371 14.575 C 16.699 14.492,17.520 14.525,17.817 14.633 " stroke="none" fill-rule="evenodd" fill="currentColor"/></svg></button></div><div id="modelSortMenu"></div><div id="modelList"></div></div>
    <div id="modeMenu"><div id="modeList"></div></div>
    <div id="agentMenu"><div id="agentList"></div></div>
    <div class="card">
      <div id="imgStrip" class="imgstrip"></div>
      <textarea id="input" rows="1" placeholder="Ask anything - use '@' to mention code blocks"></textarea>
      <input type="file" id="imgFile" accept="image/*" multiple style="display:none">
      <div class="row">
        <button id="plusBtn" title="附加上下文"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg></button>
        <span class="pill" id="modeWrap" title="Session Mode (Ctrl+.)"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/></svg><button id="modeBtn" type="button"></button></span>
        <span class="pill" id="modelWrap" title="Model"><button id="modelBtn" type="button"></button></span>
        <button id="imgBtn" title="附加图片（支持粘贴）">🖼</button>
        <button id="arenaBtn" title="Arena 模式：同题双轨候选，择优续行（新会话/会话中途均可）">⚔</button>
        <button id="wtBtn" title="Worktree 模式：新会话在隔离 git worktree 中运行，改动不直接落入主工作区，可随后合并">⎇</button>
        <span class="spacer"></span>
        <span id="tokCount" title="输入 token / 上限 (GetMessageTokenCount)" style="font-size:10.5px;color:var(--dim);"></span>
        <span class="pill" id="agentWrap" title="切换 agent (Ctrl+')"><span id="agentIcon">⬡</span><button id="agentBtn" type="button"></button><span class="badge" id="badge"></span></span>
        <button id="micBtn" class="bare" title="语音输入 · 官方 GetTranscription 转写(不可用时回退 Web Speech)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19v3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><rect x="9" y="2" width="6" height="13" rx="3"/></svg></button>
        <button class="send" id="send" title="发送 (Enter)">${OI.svg("arrow-up",14)}</button>
      </div>
    </div>
    <div class="target">
      <span class="seg" title="本地执行">${OI.svg("macbook",11,"vertical-align:-1px")} Local</span>
      <span class="seg" id="folderSeg">${OI.svg("folder-1",11,"vertical-align:-1px")} <span id="folderName">—</span></span>
      <span class="seg" id="usage"></span>
      <span class="env" id="env"></span>
    </div>
  </div>
<script nonce="${n}">
  const vscode = acquireVsCodeApi();
  const AGENTS = ${agentsJson};
  // 官方图标(反提 workbench 真源): 终端卡头 console-simple / Copy command / Insert in terminal
  const OICONS = ${JSON.stringify({ terminal: OI.svg("console-simple", 12), copy: OI.svg("square-behind-square-2", 12), insert: OI.svg("arrow-corner-down-left", 12) })};
  let agent = AGENTS[0].id;
  const state = vscode.getState() || { history: [] };
  const $ = (id) => document.getElementById(id);
  const logEl=$("log"), inputEl=$("input"), sendEl=$("send"),
        agentBtn=$("agentBtn"), agentMenu=$("agentMenu"), agentList=$("agentList"),
        badgeEl=$("badge"), envEl=$("env"), emptyEl=$("empty"),
        authbar=$("authbar"), authmsg=$("authmsg"), loginBtn=$("loginBtn"),
        authcode=$("authcode"), authsubmit=$("authsubmit"), modeSel=$("modeSel"),
        modelBtn=$("modelBtn"), modelMenu=$("modelMenu"), modelFilter=$("modelFilter"), modelList=$("modelList"),
        modeBtn=$("modeBtn"), modeMenu=$("modeMenu"), modeList=$("modeList"),
        usageEl=$("usage"), folderSeg=$("folderSeg"),
        modeWrap=$("modeWrap"), modelWrap=$("modelWrap"), recentEl=$("recent"),
        recentList=$("recentList"), viewAll=$("viewAll");
  viewAll.onclick=()=>vscode.postMessage({type:"history-open"});

  // 官方式富模型下拉: 自定义弹层(分族分组 + 搜索 + 徽标 + 价目副行), 替代 native select(R61 局限)
  let modelCur=null, modelSortCur=null;
  // 官方排序菜单(反提 workbench 真源 wMs): Order by + clientModelSorts 选项(点选中项复位),
  // 底部官方同文 "All models draw from your Devin ACU balance"(usesACUs 态)
  const modelSortBtn=$("modelSort"), modelSortMenu=$("modelSortMenu");
  function sortDefaultName(){ const ss=(modelCur&&modelCur.sorts)||[]; const d=ss.find(x=>x.isDefault); return (d&&d.name)||(ss[0]&&ss[0].name)||""; }
  function modelSortMenuRender(){
    modelSortMenu.innerHTML=""; const ss=(modelCur&&modelCur.sorts)||[]; const def=sortDefaultName();
    const opts=ss.map(x=>x.name).filter(n=>n!==def);
    if(opts.length){ const l=document.createElement("div"); l.className="sml"; l.textContent="Order by"; modelSortMenu.appendChild(l);
      for(const n of opts){ const it=document.createElement("div"); it.className="smi"+(modelSortCur===n?" on":"");
        it.textContent=n;
        it.onclick=()=>{ modelSortCur=(modelSortCur===n)?null:n; modelSortBtn.classList.toggle("on",!!modelSortCur);
          modelSortMenu.classList.remove("show"); modelMenuRender(modelFilter.value); };
        modelSortMenu.appendChild(it); }
      const sep=document.createElement("div"); sep.className="smsep"; modelSortMenu.appendChild(sep); }
    const info=document.createElement("div"); info.className="sminfo";
    info.textContent="All models draw from your Devin ACU balance"; modelSortMenu.appendChild(info);
  }
  modelSortBtn.onclick=(e)=>{ e.stopPropagation();
    if(modelSortMenu.classList.contains("show")) return modelSortMenu.classList.remove("show");
    modelSortMenuRender(); modelSortMenu.classList.add("show"); };
  const stripCredit=(s)=>String(s||"").replace(/\\s*·\\s*[\\d.]+x\\s*$/,"");
  function modelLabel(o){ return stripCredit(o.name||o.value); }
  // 官方计价标签(反提 workbench 真源): 0→Free(“No credits used”), N→“Nx”(“Nx credits”)
  function creditBadge(c){ if(c==null) return null; if(c===0) return {label:"Free",tip:"No credits used"}; const n=parseFloat(Number(c).toFixed(3)); return {label:n+"x",tip:n+"x credits"}; }
  function modelBtnSync(s){
    const o=(s.options||[]).find(x=>x.value===s.currentValue);
    // 官方 1:1: composer 按钮显模型名+倍率(与官方右栏实机一致, 徽标仅留下拉列表行)
    modelCur=s; modelBtn.textContent=stripCredit(o?(o.name||o.value):(s.currentValue||"模型"));
    modelBtn.title=o&&o.description?o.description:"Model";
  }
  function modelMenuRender(q){
    modelList.innerHTML=""; const s=modelCur; if(!s) return;
    const ql=(q||"").toLowerCase();
    const match=(o)=>!ql||(o.name||o.value).toLowerCase().includes(ql)||(o.familyLabel||"").toLowerCase().includes(ql);
    const mkIt=(o)=>{
      const it=document.createElement("div"); it.className="mit"+(o.disabled?" dis":"")+(o.value===s.currentValue?" sel":"");
      const row=document.createElement("div"); row.className="mrow";
      const nm=document.createElement("span"); nm.className="mnm"; nm.textContent=modelLabel(o); row.appendChild(nm);
      const cb=creditBadge(o.credit);
      if(cb){ const x=document.createElement("span"); x.className="mx"; x.textContent=cb.label; x.title=cb.tip; row.appendChild(x); }
      it.appendChild(row);
      if(o.description){ const ds=document.createElement("div"); ds.className="mds"; ds.textContent=o.description; it.appendChild(ds); }
      if(!o.disabled) it.onclick=()=>{ modelMenuClose();
        vscode.postMessage({type:"set-config", configId:"model", value:o.value, agent});
        modelCur=Object.assign({},s,{currentValue:o.value}); modelBtnSync(modelCur);
        const grp=curGroup(); if(cfgStore[grp]&&cfgStore[grp].model) cfgStore[grp].model.currentValue=o.value; };
      return it; };
    let any=false;
    // 官方排序菜单选中态: 按 clientModelSorts 的 groups(modelLabels 官方序)分组渲染
    const srt=modelSortCur&&((s.sorts||[]).find(x=>x.name===modelSortCur));
    if(srt){
      const byLabel=new Map(); for(const o of (s.options||[])) byLabel.set(stripCredit(o.name||o.value),o);
      for(const g of (srt.groups||[])){
        const items=(g.labels||[]).map(l=>byLabel.get(l)).filter(o=>o&&match(o));
        if(!items.length) continue;
        if(g.name){ const h=document.createElement("div"); h.className="mgrp"; h.textContent=g.name; modelList.appendChild(h); }
        for(const o of items){ modelList.appendChild(mkIt(o)); any=true; } }
    } else {
      // 官方默认排序 Recommended: 推荐项前置(同组内稳定序)
      const opts=(s.options||[]).filter(match).slice().sort((a,b)=>(b.recommended?1:0)-(a.recommended?1:0));
      const groups=new Map(); const flat=[];
      for(const o of opts){ const gl=o.familyLabel||""; if(gl){ if(!groups.has(gl)) groups.set(gl,[]); groups.get(gl).push(o); } else flat.push(o); }
      for(const o of flat){ modelList.appendChild(mkIt(o)); any=true; }
      for(const [gl,items] of groups){ const h=document.createElement("div"); h.className="mgrp"; h.textContent=gl; modelList.appendChild(h);
        for(const o of items){ modelList.appendChild(mkIt(o)); any=true; } }
    }
    if(!any){ const e=document.createElement("div"); e.className="empty3"; e.textContent="No results"; modelList.appendChild(e); }
  }
  function modelMenuClose(){ modelMenu.classList.remove("show"); }
  modelBtn.onclick=(e)=>{ e.stopPropagation();
    if(modelMenu.classList.contains("show")) return modelMenuClose();
    modelFilter.value=""; modelMenuRender(""); modelMenu.classList.add("show");
    modelFilter.focus(); const sel=modelList.querySelector(".mit.sel"); if(sel) sel.scrollIntoView({block:"center"}); };
  modelFilter.addEventListener("input",()=>modelMenuRender(modelFilter.value));
  // 键盘导航: ↑↓ 在可选项间移动(跳过🔒门控与组头, 循环), Enter 选中
  function modelKbdItems(){ return Array.from(modelList.querySelectorAll(".mit:not(.dis)")); }
  modelFilter.addEventListener("keydown",(e)=>{
    if(e.key==="Escape") return modelMenuClose();
    if(e.key!=="ArrowDown"&&e.key!=="ArrowUp"&&e.key!=="Enter") return;
    e.preventDefault();
    const items=modelKbdItems(); if(!items.length) return;
    let i=items.findIndex(x=>x.classList.contains("kbd"));
    if(e.key==="Enter"){ const t=i>=0?items[i]:items.find(x=>x.classList.contains("sel")); if(t) t.click(); return; }
    if(i>=0) items[i].classList.remove("kbd");
    i=e.key==="ArrowDown"?(i+1)%items.length:(i<=0?items.length-1:i-1);
    items[i].classList.add("kbd"); items[i].scrollIntoView({block:"nearest"});
  });
  document.addEventListener("click",(e)=>{ if(!modelMenu.contains(e.target)&&e.target!==modelBtn) modelMenuClose();
    if(!modelSortMenu.contains(e.target)&&!modelSortBtn.contains(e.target)) modelSortMenu.classList.remove("show");
    if(!modeMenu.contains(e.target)&&e.target!==modeBtn) modeMenuClose();
    if(!agentMenu.contains(e.target)&&e.target!==agentBtn) agentMenuClose(); });
  // 发送钮在回合进行中变为停止钮(官方式)
  let busy=false;
  const SEND_SVG=sendEl.innerHTML;
  function setBusy(b){ busy=b; sendEl.innerHTML=b?'<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>':SEND_SVG; sendEl.title=b?"Cancel step":"Send"; } // 官方同文 tooltip(反提 workbench 真源)

  loginBtn.onclick=()=>{ authmsg.textContent="正在拉起登录…"; vscode.postMessage({type:"login"}); };
  authsubmit.onclick=()=>{ if(authcode.value.trim()){ vscode.postMessage({type:"login-code", code:authcode.value.trim()}); authmsg.textContent="校验中…"; } };
  authcode.addEventListener("keydown",(e)=>{ if(e.key==="Enter") authsubmit.onclick(); });
  // 官方式模式下拉(同 R100 模型弹层): 行=名称 + description 副行
  let modeOpts=[], modeVal=null;
  const emptyModeName=document.getElementById("emptyModeName"), emptySub=document.getElementById("emptySub");
  // 官方空态副题随模式同文(反提 workbench Ydr 真源: DEFAULT/READ_ONLY/PLANNING/AUTO 四态)
  const MODE_SUBS={Code:"Kick off a new project. Make changes across your entire codebase.",
    Ask:"Ask questions. Get suggestions. Plan your next move.",
    Plan:"Plan changes before implementing.",Planning:"Plan changes before implementing.",
    Testing:"Build and validate. Test your changes automatically end-to-end."};
  function modeBtnSync(){ const o=modeOpts.find(x=>x.value===modeVal);
    modeBtn.textContent=o?(o.name||o.value):(modeVal||"模式"); modeBtn.title=o&&o.description?o.description:"Session Mode";
    // 官方式空态标题/副题随模式同步: <b>Cascade</b> Code|Ask|Planning|Testing + 各态官方同文副题
    // (官方 picker label "Plan" 在空态标题呈 "Planning", Ydr 真源)
    if(agent==="cascade"&&o){ const tw={Plan:"Planning"}[o.name]||o.name||"";
      if(emptyModeName) emptyModeName.textContent=tw;
      if(emptySub&&MODE_SUBS[o.name]) emptySub.textContent=MODE_SUBS[o.name]; } }
  function modeSet(opts,cur){ modeOpts=opts; modeVal=cur; modeBtnSync(); }
  function modeMenuClose(){ modeMenu.classList.remove("show"); }
  function modeMenuRender(){ modeList.innerHTML="";
    for(const o of modeOpts){ const it=document.createElement("div"); it.className="mit"+(o.value===modeVal?" sel":"");
      const row=document.createElement("div"); row.className="mrow"; row.textContent=o.name||o.value; it.appendChild(row);
      if(o.description){ const ds=document.createElement("div"); ds.className="mds"; ds.textContent=o.description; it.appendChild(ds); }
      it.onclick=()=>{ modeMenuClose(); modeVal=o.value; modeBtnSync();
        vscode.postMessage({type:"set-mode", modeId:o.value});
        const grp=curGroup(); if(cfgStore[grp]&&cfgStore[grp].mode) cfgStore[grp].mode.currentValue=o.value; };
      modeList.appendChild(it); }
    // 官方菜单尾行提示 1:1: Use Ctrl+. to switch modes
    const h=document.createElement("div"); h.className="mhint";
    h.innerHTML='Use <span class="kbd">Ctrl</span><span class="kbd">.</span> to switch modes';
    modeList.appendChild(h); }
  modeBtn.onclick=(e)=>{ e.stopPropagation(); modelMenuClose();
    if(modeMenu.classList.contains("show")) return modeMenuClose();
    modeMenuRender(); modeMenu.classList.add("show"); };

  function renderAgents(){ onAgentChange(); }
  // 官方式 agent 图标:Cascade=波形,Devin Local/Cloud=Devin 六边形(cloud 带云标)
  // 反者道之动·官方真源 W 标(自官方本体 workbench DOM 逆流提取, viewBox 512x297)
  // 反提官方 cloud-simple 图标(GDs viewBox 24, fill currentColor evenodd) —— 官方 Try Devin Cloud 钮/云标同源
  const CLOUD_SVG='<svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align:-2px"><path d="M8.120 4.042 C 5.012 4.380,2.409 6.479,1.423 9.443 C 0.555 12.051,1.045 14.847,2.750 17.017 C 3.051 17.400,3.710 18.048,4.102 18.346 C 5.293 19.253,6.701 19.816,8.140 19.961 C 8.444 19.991,10.018 20.000,13.220 19.990 C 18.375 19.973,18.072 19.989,18.949 19.697 C 19.684 19.452,20.371 19.063,20.949 18.562 C 22.629 17.109,23.359 14.796,22.819 12.639 C 22.541 11.528,22.013 10.611,21.194 9.816 C 20.287 8.936,19.251 8.419,17.986 8.215 C 17.669 8.164,17.419 8.155,16.841 8.172 C 15.925 8.200,15.924 8.200,15.636 7.746 C 14.696 6.265,13.372 5.168,11.740 4.520 C 11.360 4.369,10.649 4.180,10.160 4.100 C 9.692 4.024,8.578 3.992,8.120 4.042 M9.907 5.582 C 10.933 5.734,11.911 6.154,12.802 6.825 C 13.349 7.237,13.853 7.787,14.310 8.469 C 14.686 9.031,14.885 9.245,15.200 9.425 C 15.635 9.672,16.011 9.737,16.646 9.675 C 17.475 9.594,18.231 9.720,18.949 10.060 C 19.461 10.302,19.857 10.586,20.248 10.993 C 20.618 11.379,20.793 11.626,21.031 12.101 C 21.344 12.725,21.479 13.327,21.480 14.094 C 21.481 16.114,20.139 17.851,18.180 18.366 C 17.629 18.511,17.051 18.526,12.600 18.510 C 7.987 18.492,8.131 18.499,7.300 18.285 C 4.951 17.679,3.068 15.640,2.616 13.213 C 2.528 12.742,2.497 11.649,2.558 11.184 C 2.840 9.038,4.117 7.199,6.000 6.226 C 6.952 5.735,7.792 5.529,8.875 5.523 C 9.242 5.521,9.658 5.545,9.907 5.582 " stroke="none" fill-rule="evenodd" fill="currentColor"/></svg>';
  const W_SVG='<svg width="14" height="9" viewBox="0 0 512 297" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M507.28 0.142623H502.4C476.721 0.10263 455.882 20.899 455.882 46.5745V150.416C455.882 171.153 438.743 187.95 418.344 187.95C406.224 187.95 394.125 181.851 386.945 171.613L280.889 20.1391C272.089 7.56133 257.77 0.0626373 242.271 0.0626373C218.091 0.0626373 196.332 20.6191 196.332 45.9946V150.436C196.332 171.173 179.333 187.97 158.794 187.97C146.634 187.97 134.555 181.871 127.375 171.633L8.69966 2.12228C6.01976 -1.71705 0 0.182617 0 4.8618V95.426C0 100.005 1.39995 104.444 4.01984 108.204L120.815 274.995C127.715 284.853 137.895 292.172 149.634 294.831C179.013 301.51 206.052 278.894 206.052 250.079V145.697C206.052 124.961 222.851 108.164 243.59 108.164H243.65C256.15 108.164 267.87 114.263 275.049 124.501L381.125 275.955C389.945 288.552 403.524 296.031 419.724 296.031C444.443 296.031 465.622 275.455 465.622 250.099V145.677C465.622 124.941 482.421 108.144 503.16 108.144H507.3C509.9 108.144 512 106.044 512 103.445V4.8418C512 2.24226 509.9 0.142623 507.3 0.142623H507.28Z"/></svg>';
  // 官方步卡图标(反提 workbench 真源): folder-open / magnifying-glass / file-text 三源 path 逐字同源
  const _bi=(d)=>'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align:-2px"><path d="'+d+'" stroke="none" fill-rule="evenodd" fill="currentColor"/></svg>';
  const FOLDER_SVG=_bi("M4.270 3.040 C 3.699 3.139,3.154 3.443,2.728 3.898 C 2.450 4.195,2.248 4.538,2.114 4.940 L 2.020 5.220 2.009 11.560 C 1.996 18.567,1.984 18.192,2.249 18.728 C 2.401 19.034,2.923 19.570,3.227 19.732 C 3.341 19.792,3.573 19.877,3.743 19.921 C 4.046 19.998,4.209 20.000,11.176 19.999 C 19.165 19.999,18.579 20.021,19.239 19.695 C 19.547 19.542,19.679 19.447,19.942 19.183 C 20.449 18.676,20.464 18.638,21.488 15.180 L 22.376 12.180 22.378 11.740 C 22.380 11.328,22.372 11.283,22.254 11.035 C 22.185 10.889,22.059 10.693,21.974 10.598 C 21.781 10.383,21.422 10.148,21.187 10.082 L 21.007 10.032 20.991 9.126 C 20.976 8.323,20.964 8.188,20.883 7.940 C 20.615 7.108,19.929 6.409,19.109 6.131 L 18.780 6.020 15.620 6.000 C 13.618 5.987,12.437 5.965,12.397 5.940 C 12.362 5.918,12.043 5.466,11.688 4.935 C 10.964 3.852,10.745 3.614,10.215 3.333 C 9.613 3.015,9.727 3.026,6.940 3.016 C 5.576 3.011,4.375 3.022,4.270 3.040 M9.423 4.596 C 9.716 4.729,9.880 4.923,10.566 5.948 C 11.246 6.963,11.392 7.132,11.752 7.318 C 12.100 7.497,12.049 7.494,15.420 7.518 L 18.620 7.540 18.820 7.646 C 19.079 7.784,19.250 7.967,19.377 8.240 C 19.475 8.452,19.479 8.489,19.480 9.229 L 19.480 9.998 14.230 10.009 L 8.980 10.020 8.700 10.113 C 7.958 10.361,7.375 10.857,7.036 11.528 C 6.972 11.655,6.510 13.152,5.999 14.888 C 5.462 16.711,5.041 18.072,4.992 18.144 C 4.829 18.382,4.662 18.460,4.316 18.460 C 3.970 18.460,3.885 18.419,3.662 18.144 L 3.540 17.993 3.530 11.731 L 3.519 5.469 3.622 5.244 C 3.757 4.949,3.927 4.776,4.220 4.635 L 4.460 4.520 6.860 4.521 C 9.107 4.522,9.270 4.526,9.423 4.596 M20.862 11.617 C 20.915 11.698,20.917 11.741,20.879 11.887 C 20.679 12.637,19.185 17.656,19.122 17.789 C 18.999 18.049,18.786 18.257,18.510 18.384 L 18.260 18.500 12.390 18.511 C 8.169 18.519,6.520 18.510,6.520 18.478 C 6.520 18.378,8.327 12.303,8.398 12.163 C 8.502 11.961,8.841 11.660,9.051 11.586 C 9.198 11.534,9.977 11.526,15.009 11.523 L 20.798 11.520 20.862 11.617 ");
  const SEARCH_SVG=_bi("M10.207 3.043 C 8.656 3.193,7.096 3.846,5.900 4.847 C 4.985 5.612,4.307 6.477,3.800 7.529 C 2.453 10.317,2.837 13.625,4.789 16.040 C 5.075 16.394,5.761 17.067,6.100 17.326 C 7.743 18.581,9.834 19.176,11.832 18.958 C 13.289 18.798,14.736 18.220,15.883 17.337 L 16.106 17.166 17.943 19.007 C 19.169 20.236,19.833 20.873,19.940 20.923 C 20.243 21.065,20.552 21.004,20.788 20.755 C 21.013 20.516,21.060 20.233,20.923 19.940 C 20.873 19.833,20.236 19.169,19.007 17.943 L 17.166 16.106 17.337 15.883 C 18.220 14.736,18.798 13.289,18.958 11.832 C 19.176 9.834,18.579 7.737,17.325 6.100 C 17.055 5.747,16.510 5.190,16.100 4.847 C 14.483 3.494,12.337 2.837,10.207 3.043 M11.940 4.577 C 14.094 4.908,15.858 6.196,16.838 8.153 C 17.493 9.462,17.661 11.157,17.283 12.629 C 16.641 15.130,14.538 17.031,11.980 17.423 C 11.467 17.502,10.533 17.502,10.020 17.423 C 7.461 17.031,5.360 15.132,4.717 12.629 C 4.451 11.596,4.451 10.404,4.717 9.371 C 5.361 6.863,7.431 4.993,10.020 4.580 C 10.456 4.511,11.498 4.509,11.940 4.577 ");
  const FILE_SVG=_bi("M6.270 2.041 C 5.700 2.139,5.154 2.443,4.728 2.898 C 4.440 3.206,4.241 3.550,4.113 3.960 L 4.020 4.260 4.020 12.000 L 4.020 19.740 4.113 20.040 C 4.256 20.498,4.455 20.822,4.816 21.184 C 5.178 21.545,5.502 21.744,5.960 21.887 L 6.260 21.980 12.000 21.980 L 17.740 21.980 18.040 21.887 C 18.498 21.744,18.822 21.545,19.184 21.184 C 19.545 20.822,19.744 20.498,19.887 20.040 L 19.980 19.740 19.980 14.640 L 19.980 9.540 19.871 9.220 C 19.662 8.603,19.595 8.529,16.453 5.397 C 13.644 2.597,13.529 2.487,13.220 2.330 C 12.573 2.002,12.826 2.023,9.460 2.015 C 7.810 2.011,6.375 2.022,6.270 2.041 M12.009 5.650 C 12.021 7.753,12.023 7.784,12.114 8.060 C 12.263 8.510,12.464 8.831,12.816 9.184 C 13.169 9.536,13.490 9.737,13.940 9.886 C 14.216 9.977,14.247 9.979,16.350 9.991 L 18.480 10.004 18.480 14.772 L 18.480 19.540 18.366 19.782 C 18.226 20.076,17.954 20.327,17.667 20.428 C 17.471 20.496,17.159 20.500,12.000 20.500 C 6.841 20.500,6.529 20.496,6.333 20.428 C 6.046 20.327,5.774 20.076,5.634 19.782 L 5.520 19.540 5.520 12.000 L 5.521 4.460 5.623 4.240 C 5.758 3.948,5.929 3.775,6.220 3.635 L 6.460 3.520 9.228 3.520 L 11.996 3.520 12.009 5.650 M17.400 8.493 C 17.400 8.511,16.747 8.519,15.950 8.511 C 14.688 8.497,14.476 8.486,14.312 8.425 C 14.038 8.322,13.769 8.066,13.634 7.782 L 13.520 7.540 13.520 6.060 L 13.520 4.580 15.460 6.520 C 16.527 7.587,17.400 8.475,17.400 8.493 M8.420 12.583 C 8.240 12.677,8.156 12.763,8.075 12.940 C 7.987 13.131,7.980 13.355,8.055 13.531 C 8.123 13.688,8.340 13.900,8.493 13.958 C 8.566 13.985,9.261 14.000,10.500 14.000 C 11.739 14.000,12.434 13.985,12.507 13.958 C 12.660 13.900,12.877 13.688,12.945 13.531 C 13.017 13.363,13.015 13.153,12.938 12.970 C 12.859 12.780,12.775 12.689,12.592 12.596 C 12.452 12.524,12.328 12.520,10.492 12.520 C 8.800 12.520,8.524 12.529,8.420 12.583 M8.420 16.583 C 8.240 16.677,8.156 16.763,8.075 16.940 C 7.987 17.131,7.980 17.355,8.055 17.531 C 8.123 17.688,8.340 17.900,8.493 17.958 C 8.569 17.986,9.703 18.000,12.000 18.000 C 14.297 18.000,15.431 17.986,15.507 17.958 C 15.660 17.900,15.877 17.688,15.945 17.531 C 16.017 17.363,16.015 17.153,15.938 16.970 C 15.859 16.780,15.775 16.689,15.592 16.596 C 15.449 16.523,15.300 16.520,11.992 16.520 C 8.940 16.520,8.526 16.528,8.420 16.583 ");
  const BROWSE_ICONS={list:FOLDER_SVG,grep:SEARCH_SVG,view:FILE_SVG};
  const AGENT_ICONS={cascade:"","devin-local":"⬢","devin-cloud":CLOUD_SVG};
  const agentIcon=$("agentIcon");
  // 每 agent 轨各存一份 model/mode 配置; cascade=LS 本地轨, acp=Devin Local/Cloud 云端轨。
  const cfgStore={cascade:{model:null,mode:null},acp:{model:null,mode:null}};
  function curGroup(){ return agent==="cascade"?"cascade":"acp"; }
  function renderConfigFor(grp){
    const s=cfgStore[grp]||{};
    // 配置推送不强制关闭已开弹层(否则频繁 config-options 推送会把刚点开的菜单秒关), 仅刷新内容
    if(s.model){ modelBtnSync(s.model); modelWrap.classList.add("show");
      if(modelMenu.classList.contains("show")) modelMenuRender(modelFilter.value); }
    else { modelWrap.classList.remove("show"); modelMenuClose(); }
    if(s.mode){ modeSet(s.mode.options||[], s.mode.currentValue); modeWrap.classList.add("show");
      if(modeMenu.classList.contains("show")) modeMenuRender(); }
    else { modeWrap.classList.remove("show"); modeMenuClose(); }
  }
  function onAgentChange(){
    if(typeof slashSync==="function") slashSync();
    const a=AGENTS.find(x=>x.id===agent);
    badgeEl.textContent=a&&a.preview?"Preview":"";
    if(agent==="cascade") agentIcon.innerHTML=W_SVG;
    else { const ic=AGENT_ICONS[agent]||"⬡"; if(ic.indexOf("<svg")===0) agentIcon.innerHTML=ic; else agentIcon.textContent=ic; }
    agentBtn.textContent=a?a.label:agent;
    const pill=agentBtn.closest(".pill"); if(pill&&a) pill.title=a.label+" · "+a.hint+" (Ctrl+')";
    renderConfigFor(curGroup());
  }
  // 官方式 agent 下拉(同 R100/R102 弹层): 行=图标+标签+Preview 徽标, hint 副行
  function agentMenuClose(){ agentMenu.classList.remove("show"); }
  function agentMenuRender(){ agentList.innerHTML="";
    for(const a of AGENTS){ const it=document.createElement("div"); it.className="mit"+(a.id===agent?" sel":"");
      const row=document.createElement("div"); row.className="mrow";
      const nm=document.createElement("span"); nm.className="mnm";
      const ic0=a.id==="cascade"?W_SVG:(AGENT_ICONS[a.id]||"⬡");
      if(ic0.indexOf("<svg")===0){ nm.innerHTML=ic0+" "; nm.appendChild(document.createTextNode(a.label)); }
      else nm.textContent=ic0+" "+a.label;
      row.appendChild(nm);
      if(a.preview){ const b=document.createElement("span"); b.className="bdg"; b.textContent="Preview"; row.appendChild(b); }
      it.appendChild(row);
      it.title=a.hint; // 官方菜单仅显名称, 技术轨道信息降为悬停提示
      it.onclick=()=>{ agentMenuClose(); agent=a.id; onAgentChange(); };
      agentList.appendChild(it); }
    const h=document.createElement("div"); h.className="mhint";
    h.innerHTML='Use <span class="kbd">Ctrl</span><span class="kbd">&#39;</span> to switch agents';
    agentList.appendChild(h);
    // 官方菜单尾「+」: 展开 ACP Agent 注册表(GetAllAcpRegistries 真源)
    const add=document.createElement("div"); add.className="mit agadd"; add.textContent="+";
    add.title="Add agent";
    add.onclick=(e)=>{ e.stopPropagation(); vscode.postMessage({type:"agents-registry"}); };
    agentList.appendChild(add); }
  agentBtn.onclick=(e)=>{ e.stopPropagation(); modelMenuClose(); modeMenuClose();
    if(agentMenu.classList.contains("show")) return agentMenuClose();
    agentMenuRender(); agentMenu.classList.add("show"); };
  // Ctrl+' 循环切换 agent(复刻官方快捷键)
  document.addEventListener("keydown",(e)=>{ if(e.ctrlKey && e.key==="'"){ e.preventDefault();
    const i=AGENTS.findIndex(x=>x.id===agent); agent=AGENTS[(i+1)%AGENTS.length].id; onAgentChange(); }});
  // 官方快捷键组: Ctrl+/ 开模型选择器 · Ctrl+Shift+/ 切下一模型 · Ctrl+. 切会话模式
  document.addEventListener("keydown",(e)=>{
    if(!e.ctrlKey) return;
    if(e.key==="/"&&!e.shiftKey){ e.preventDefault(); modelBtn.click(); return; }
    if((e.key==="?"||(e.key==="/"&&e.shiftKey))){ e.preventDefault();
      const s=modelCur; if(!s) return;
      const opts=(s.options||[]).filter(o=>!o.disabled); if(!opts.length) return;
      const i=opts.findIndex(o=>o.value===s.currentValue); const o=opts[(i+1)%opts.length];
      vscode.postMessage({type:"set-config", configId:"model", value:o.value, agent});
      modelCur=Object.assign({},s,{currentValue:o.value}); modelBtnSync(modelCur);
      const grp=curGroup(); if(cfgStore[grp]&&cfgStore[grp].model) cfgStore[grp].model.currentValue=o.value;
      return; }
    if(e.key==="."&&!e.shiftKey){ e.preventDefault(); modeBtn.click(); }
  });
  // 官方 chat-client 键位全表对位(R188·官方 jd 枚举/iPi 键位映射逐条提取):
  //   Ctrl+L 聚焦 composer(ToggleFocus) · Ctrl+Shift+L 新会话(CreateNewConversation)
  //   Ctrl+N 重置当前会话(ResetCurrentConversation) · Ctrl+Shift+. agent 菜单(OpenAgentPicker)
  //   Ctrl+; Worktree 开关(ToggleWorktree) · Ctrl+Shift+M 语音(PressMicrophone)
  //   Ctrl+Alt+C 取消生成(Cancel)
  document.addEventListener("keydown",(e)=>{
    if(!e.ctrlKey) return;
    const k=(e.key||"").toLowerCase();
    if(k==="l"&&!e.shiftKey&&!e.altKey){ e.preventDefault(); inputEl.focus(); return; }
    if(k==="l"&&e.shiftKey&&!e.altKey){ e.preventDefault(); vscode.postMessage({type:"session-new"}); return; }
    if(k==="n"&&!e.shiftKey&&!e.altKey){ e.preventDefault(); vscode.postMessage({type:"session-new"}); return; }
    if((k==="."||k===">")&&e.shiftKey&&!e.altKey){ e.preventDefault(); agentBtn.click(); return; }
    if(e.key===";"&&!e.shiftKey&&!e.altKey){ e.preventDefault(); wtBtn.click(); return; }
    if(k==="m"&&e.shiftKey&&!e.altKey){ e.preventDefault(); micBtn.click(); return; }
    if(k==="c"&&e.altKey){ e.preventDefault(); if(busy){ vscode.postMessage({type:"cancel"}); setBusy(false); } return; }
  });
  // 官方 chat-client 内部快捷键 SearchConversation(Ctrl+F) 同位: 会话内搜索浮层。
  // 匹配行高亮 + n/m 计数, Enter/↓ 下一处 · Shift+Enter/↑ 上一处 · Esc 关闭。
  const convFind=$("convFind"), cfIn=$("cfIn"), cfCnt=$("cfCnt");
  let cfHits=[], cfIdx=-1;
  function cfClear(){ cfHits.forEach(el=>el.classList.remove("cfHit","cfCur")); cfHits=[]; cfIdx=-1; cfCnt.textContent=""; }
  function cfMark(){ cfHits.forEach((el,i)=>el.classList.toggle("cfCur",i===cfIdx)); cfCnt.textContent=(cfIdx+1)+" of "+cfHits.length; if(cfHits[cfIdx]) cfHits[cfIdx].scrollIntoView({block:"center"}); }
  function cfRun(){ cfClear(); const q=cfIn.value.trim().toLowerCase(); if(!q) return;
    for(const el of logEl.children){ if(el.id==="empty") continue;
      if((el.textContent||"").toLowerCase().includes(q)){ el.classList.add("cfHit"); cfHits.push(el); } }
    if(cfHits.length){ cfIdx=0; cfMark(); } else cfCnt.textContent="No results"; }
  function cfStep(d){ if(!cfHits.length) return; cfIdx=(cfIdx+d+cfHits.length)%cfHits.length; cfMark(); }
  function cfOpen(){ convFind.classList.add("show"); cfIn.focus(); cfIn.select(); if(cfIn.value) cfRun(); }
  function cfCloseFn(){ convFind.classList.remove("show"); cfClear(); inputEl.focus(); }
  cfIn.addEventListener("input", cfRun);
  cfIn.addEventListener("keydown",(e)=>{
    if(e.key==="Escape"){ e.preventDefault(); return cfCloseFn(); }
    if(e.key==="Enter"){ e.preventDefault(); return cfStep(e.shiftKey?-1:1); } });
  $("cfPrev").onclick=()=>cfStep(-1); $("cfNext").onclick=()=>cfStep(1); $("cfClose").onclick=cfCloseFn;
  document.addEventListener("keydown",(e)=>{ if(e.ctrlKey&&!e.shiftKey&&!e.altKey&&(e.key==="f"||e.key==="F")){ e.preventDefault(); cfOpen(); }});
  // mode/agent 弹层键盘导航(同 R101): ↑↓ 循环 .kbd 高亮, Enter 选中, Escape 关闭
  document.addEventListener("keydown",(e)=>{
    const open=[[modeMenu,modeList],[agentMenu,agentList]].find(([m])=>m.classList.contains("show"));
    if(!open) return;
    if(e.key==="Escape"){ e.preventDefault(); return open[0]===modeMenu?modeMenuClose():agentMenuClose(); }
    if(e.key!=="ArrowDown"&&e.key!=="ArrowUp"&&e.key!=="Enter") return;
    e.preventDefault();
    const items=Array.from(open[1].querySelectorAll(".mit")); if(!items.length) return;
    let i=items.findIndex(x=>x.classList.contains("kbd"));
    if(e.key==="Enter"){ const t=i>=0?items[i]:items.find(x=>x.classList.contains("sel")); if(t) t.click(); return; }
    if(i>=0) items[i].classList.remove("kbd");
    i=e.key==="ArrowDown"?(i+1)%items.length:(i<=0?items.length-1:i-1);
    items[i].classList.add("kbd"); items[i].scrollIntoView({block:"nearest"});
  });

  // 顶部模式标签(官方 Agent/Editor 对位): Agent → 整窗看板; ⚙ → Devin Settings 整页
  const mtAgent=document.getElementById("mtAgent");
  if(mtAgent) mtAgent.onclick=()=>vscode.postMessage({type:"open-agent-board"});
  const mtSettings=document.getElementById("mtSettings");
  if(mtSettings) mtSettings.onclick=()=>vscode.postMessage({type:"open-devin-settings"});
  const mtCustom=document.getElementById("mtCustom");
  if(mtCustom) mtCustom.onclick=()=>vscode.postMessage({type:"open-customizations"});
  const mtShare=document.getElementById("mtShare");
  if(mtShare) mtShare.onclick=()=>vscode.postMessage({type:"share-conversation"});
  const mtBug=document.getElementById("mtBug");
  if(mtBug) mtBug.onclick=()=>vscode.postMessage({type:"bug-report"});

  // 官方式空态 Try Devin Cloud: 一键切到 devin-cloud agent(与官方按钮同位同义)
  const tryCloudBtn=document.getElementById("tryCloud");
  if(tryCloudBtn) tryCloudBtn.onclick=()=>{ agent="devin-cloud"; onAgentChange(); inputEl.focus(); };
  // 官方式麦克风: 官方真源路径 GetTranscription{audioData}→transcribedText——录音(MediaRecorder)
  // 送 LS 转写入 composer; getUserMedia 不可用时回退 Web Speech, 两者皆不可用则隐藏(不留死按钮)。
  // 官方同文(反提 workbench 真源): composer 占位为单一静态串
  // pe.placeholder ?? "Ask anything - use '@' to mention code blocks" —— 官方不做失焦/聚焦切换,
  // 亦不是 "Focus input"(那是 chat-client 快捷键提示项 focus-input.text, 非 placeholder)。
  const OFFICIAL_PLACEHOLDER="Ask anything - use '@' to mention code blocks";
  inputEl.placeholder=OFFICIAL_PLACEHOLDER;
  const micBtn=document.getElementById("micBtn");
  (function(){
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    const hasMedia=!!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia&&window.MediaRecorder);
    if(!hasMedia&&!SR){ if(micBtn) micBtn.style.display="none"; return; }
    let mr=null, on=false, chunks=[], hostRec=false, gumDenied=false;
    window.__setRecordState=(v)=>{ hostRec=v; on=v; micBtn.style.opacity=v?"0.5":""; };
    function fallbackSR(){ if(!SR) return false;
      let rec=new SR(); rec.continuous=false; rec.interimResults=false;
      rec.onresult=(ev)=>{ const t=Array.from(ev.results).map(r=>r[0].transcript).join(" ");
        if(t){ inputEl.value=(inputEl.value?inputEl.value+" ":"")+t; inputEl.dispatchEvent(new Event("input")); } };
      rec.onend=()=>{ on=false; micBtn.style.opacity=""; };
      rec.onerror=()=>{ on=false; micBtn.style.opacity=""; };
      try{ rec.start(); on=true; micBtn.style.opacity="0.5"; return true; }catch(_){ return false; } }
    micBtn.onclick=async()=>{
      if(on){
        if(hostRec){ vscode.postMessage({type:"record-stop"}); return; }
        try{ mr?mr.stop():null; }catch(_){} on=false; micBtn.style.opacity=""; return; }
      if(gumDenied){ vscode.postMessage({type:"record-start"}); return; }
      if(!hasMedia){ fallbackSR(); return; }
      try{
        const stream=await navigator.mediaDevices.getUserMedia({audio:true});
        chunks=[]; mr=new MediaRecorder(stream);
        mr.ondataavailable=(ev)=>{ if(ev.data&&ev.data.size) chunks.push(ev.data); };
        mr.onstop=async()=>{
          try{ stream.getTracks().forEach(t=>t.stop()); }catch(_){}
          on=false; micBtn.style.opacity="";
          if(!chunks.length) return;
          const buf=await new Blob(chunks,{type:mr.mimeType||"audio/webm"}).arrayBuffer();
          let s="",u=new Uint8Array(buf); for(let i=0;i<u.length;i++) s+=String.fromCharCode(u[i]);
          vscode.postMessage({type:"transcribe", b64:btoa(s)});
        };
        mr.start(); on=true; micBtn.style.opacity="0.5";
      }catch(_){ gumDenied=true; vscode.postMessage({type:"record-start"}); }
    };
  })();

  // 极简 markdown 渲染(围栏代码块/行内码/粗斜体/链接/标题/列表)，先转义再替换
  function esc(s){ return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
  const BT=String.fromCharCode(96), FENCE=BT+BT+BT;
  function mdInline(s){ return s
    .replace(new RegExp(BT+"([^"+BT+"]+)"+BT,"g"),(mm,c)=>/^[\\w@.\\/-]+\\.[A-Za-z0-9]+$/.test(c)?'<code class="fchip" data-path="'+c+'">'+c+"</code>":"<code>"+c+"</code>")
    .replace(/\\*\\*([^*]+)\\*\\*/g,"<b>$1</b>")
    .replace(/(^|[^*])\\*([^*\\n]+)\\*/g,"$1<i>$2</i>")
    .replace(/\\[([^\\]]+)\\]\\((https?:[^)\\s]+)\\)/g,'<a href="$2">$1</a>'); }
  function md(src){
    const parts=String(src).split(FENCE); let html="";
    for(let i=0;i<parts.length;i++){
      if(i%2===1){ const lm=parts[i].match(/^([a-zA-Z0-9+-]*)\\n?/); const lang=lm&&lm[1]?lm[1]:"";
        const body=parts[i].replace(/^[a-zA-Z0-9+-]*\\n?/,"");
        if(i===parts.length-1 && !body.trim()) continue; // 末尾未闭合且为空的 fence 不产出空代码块

        html+='<pre>'+(lang?'<div class="cblang">'+esc(lang)+'</div>':'')+'<button class="copybtn" title="复制">Copy</button><code>'+esc(body)+"</code></pre>"; continue; }
      const lines=esc(parts[i]).split("\\n"); let inList=false;
      for(const ln of lines){
        const li=ln.match(/^\\s*[-*] (.*)$/), h=ln.match(/^(#{1,3}) (.*)$/);
        if(li){ if(!inList){ html+="<ul>"; inList=true; } html+="<li>"+mdInline(li[1])+"</li>"; continue; }
        if(inList){ html+="</ul>"; inList=false; }
        if(h){ html+="<h"+h[1].length+">"+mdInline(h[2])+"</h"+h[1].length+">"; }
        else if(ln.trim()){ html+="<p>"+mdInline(ln)+"</p>"; }
      }
      if(inList) html+="</ul>";
    }
    return html;
  }

  function rel(ts){ if(!ts) return ""; const t=typeof ts==="number"?ts:Date.parse(ts); if(!t) return "";
    const s=Math.max(0,(Date.now()-t)/1000);
    if(s<3600) return Math.max(1,Math.round(s/60))+"m ago";
    if(s<86400) return Math.round(s/3600)+"h ago";
    return Math.round(s/86400)+"d ago"; }
  function addMsg(role,text,images){ if(emptyEl) emptyEl.remove();
    const d=document.createElement("div"); d.className="msg "+role; d.textContent=text;
    if(images&&images.length){ const strip=document.createElement("div"); strip.className="imgstrip";
      for(const u of images){ const t=document.createElement("div"); t.className="imgthumb";
        const im=document.createElement("img"); im.src=(typeof u==="string"?u:u.dataUrl); t.appendChild(im); strip.appendChild(t); }
      d.appendChild(strip); }
    logEl.appendChild(d); logEl.scrollTop=logEl.scrollHeight; return d; }

  // 官方式图像附件: 粘贴 / 🖼 选择 → dataURL 暂存, composer 内缩略图预览, 发送随消息带出
  const imgStrip=$("imgStrip"), imgBtn=$("imgBtn"), imgFile=$("imgFile");
  let pendingImages=[];
  function renderThumbs(){ imgStrip.innerHTML="";
    pendingImages.forEach((u,i)=>{ const t=document.createElement("div"); t.className="imgthumb";
      const im=document.createElement("img"); im.src=u; t.appendChild(im);
      const rm=document.createElement("button"); rm.className="rm"; rm.textContent="✕";
      rm.onclick=()=>{ pendingImages.splice(i,1); renderThumbs(); };
      t.appendChild(rm); imgStrip.appendChild(t); }); }
  function addImageFile(file){ if(!file||!/^image\\//.test(file.type)) return;
    const r=new FileReader(); r.onload=()=>{ pendingImages.push(String(r.result)); renderThumbs(); }; r.readAsDataURL(file); }
  imgBtn.onclick=()=>imgFile.click();
  // 官方式 Arena 模式开关: Cascade 轨新会话首条/会话中途均可, 发送后自动复位
  const wtBtn=$("wtBtn"), wtBar=$("wtBar"), wtTxt=$("wtTxt"), wtMerge=$("wtMerge"), wtUndo=$("wtUndo"); let wtOn=false;
  wtUndo.onclick=()=>vscode.postMessage({type:"worktree-undo"});
  $("wtOpen").onclick=()=>vscode.postMessage({type:"worktree-open"});
  wtBtn.onclick=()=>{ wtOn=!wtOn; wtBtn.classList.toggle("on",wtOn); };
  wtMerge.onclick=()=>vscode.postMessage({type:"worktree-merge"});
  const arenaBtn=$("arenaBtn"); let arenaOn=false;
  const arenaTitle=arenaBtn.title;
  arenaBtn.onclick=()=>{ if(arenaBtn.disabled) return; arenaOn=!arenaOn; arenaBtn.classList.toggle("on",arenaOn); vscode.postMessage({type:"set-user-setting", patch:{lastArenaModeEnabled:arenaOn}}); };
  const autoOpenCk=$("autoOpenCk");
  autoOpenCk.onchange=()=>vscode.postMessage({type:"set-user-setting", patch:{openMostRecentChatConversation:autoOpenCk.checked}});
  // 官方 Start With History 开关同位(官方 label/tooltip 逐字): 开启后新会话首条消息
  // 自动附带最近编码轨迹(GetUserTrajectory)上下文。官方该态为 workbench 本地态(LS 无对应 RPC), 此处同为面板本地持久态。
  const swhCk=$("swhCk");
  swhCk.checked=!!state.startWithHistory;
  swhCk.onchange=()=>{ state.startWithHistory=swhCk.checked; vscode.setState(state); };
  imgFile.onchange=()=>{ for(const f of imgFile.files||[]) addImageFile(f); imgFile.value=""; };
  inputEl.addEventListener("paste",(e)=>{ const items=(e.clipboardData&&e.clipboardData.items)||[]; let got=false;
    for(const it of items){ if(it.kind==="file"&&/^image\\//.test(it.type)){ addImageFile(it.getAsFile()); got=true; } }
    if(got) e.preventDefault(); });
  // 官方式拖拽入图: 把图片文件拖到 composer(卡片区)即附加, dragover 高亮。
  const dropZone=imgStrip.closest(".card")||inputEl;
  ["dragenter","dragover"].forEach(ev=>dropZone.addEventListener(ev,(e)=>{
    if(e.dataTransfer&&Array.from(e.dataTransfer.items||[]).some(it=>it.kind==="file")){ e.preventDefault(); dropZone.classList.add("dragover"); } }));
  ["dragleave","dragend"].forEach(ev=>dropZone.addEventListener(ev,(e)=>{ if(e.target===dropZone) dropZone.classList.remove("dragover"); }));
  dropZone.addEventListener("drop",(e)=>{ dropZone.classList.remove("dragover");
    const files=(e.dataTransfer&&e.dataTransfer.files)||[]; let got=false;
    for(const f of files){ if(/^image\\//.test(f.type)){ addImageFile(f); got=true; } }
    if(got) e.preventDefault(); });
  // 回合完成后为助手气泡挂复制钮(流式期会清空 textContent,故完成时再挂,免被抹除)。
  function attachMsgCopy(node){ if(!node||node.querySelector(".msgcopy")) return;
    const cp=document.createElement("button"); cp.className="msgcopy"; cp.title="复制回复"; cp.textContent="Copy"; node.appendChild(cp); }
  // 官方式复制:代码块右上角 / 助手气泡悬停复制钮 → 交宿主写系统剪贴板(webview 无 clipboard 权限)。
  function flashCopied(btn){ const o=btn.textContent; btn.textContent="Copied"; btn.classList.add("done");
    setTimeout(()=>{ btn.textContent=o; btn.classList.remove("done"); },1200); }
  logEl.addEventListener("click",(e)=>{
    const cb=e.target.closest&&e.target.closest(".copybtn");
    if(cb){ const pre=cb.closest("pre"); const code=pre&&pre.querySelector("code");
      vscode.postMessage({type:"copy", text:(code?code.textContent:"")}); flashCopied(cb); return; }
    const mc=e.target.closest&&e.target.closest(".msgcopy");
    if(mc){ const node=mc.closest(".msg"); const txt=(node&&node.dataset.acc)||(node?node.textContent.replace(/Copy$/,""):"");
      vscode.postMessage({type:"copy", text:txt}); flashCopied(mc); return; }
    const fc=e.target.closest&&e.target.closest("code.fchip");
    if(fc){ vscode.postMessage({type:"open-file", path:fc.dataset.path}); return; }
  });
  // 官方式 composer 随内容增高(单行 → 最多 ~120px 后内部滚动)。
  function autoGrow(){ inputEl.style.height="auto"; inputEl.style.height=Math.min(inputEl.scrollHeight,120)+"px"; }
  // 官方式: 点击 composer 卡片任意空白处即聚焦输入框
  document.querySelector(".composer .card").addEventListener("mousedown",(e)=>{
    if(e.target.closest("button,.pill,textarea,input,select,a")) return;
    e.preventDefault(); inputEl.focus();
  });
  function send(){
    const text=inputEl.value.trim(); const images=pendingImages.slice();
    if(!text && !images.length) return;
    if(busy && agent!=="cascade") return; // Cascade 运行中可继续发(官方式排队, 宿主 QueueCascadeMessage)
    inputEl.value=""; autoGrow(); pendingImages=[]; renderThumbs();
    addMsg("user",text,images);
    state.history.push({role:"user",content:text}); vscode.setState(state);
    const id="m"+Date.now(); const node=addMsg("assistant","…");
    node.dataset.id=id; node.dataset.acc=""; setBusy(true);
    const arena=arenaOn&&agent==="cascade";
    if(arena){ arenaOn=false; arenaBtn.classList.remove("on"); vscode.postMessage({type:"set-user-setting", patch:{lastArenaModeEnabled:false}}); }
    const worktree=wtOn&&agent==="cascade";
    vscode.postMessage({type:"chat", id, agent, text, images, arena, worktree, startWithHistory:!!state.startWithHistory});
  }
  sendEl.onclick=()=>{ if(busy){ vscode.postMessage({type:"cancel"}); setBusy(false); } else send(); };

  // 斜杠命令补全:输入 / 开头时弹出 ACP availableCommands 菜单,↑↓选择、Tab/Enter 应用、Esc 关闭
  const slashMenu=$("slashMenu");
  let slashSel=0, slashItems=[]; const slashCmdsBy={}; let slashCmds=[];
  function slashSync(){ slashCmds=slashCmdsBy[agent]||[]; }
  function slashFilter(){
    const v=inputEl.value;
    if(!v.startsWith("/")||v.includes("\\n")){ slashMenu.classList.remove("show"); slashItems=[]; return; }
    const q=v.slice(1).toLowerCase();
    slashItems=slashCmds.filter(c=>c.name.toLowerCase().startsWith(q)).slice(0,12);
    if(!slashItems.length){ slashMenu.classList.remove("show"); return; }
    slashSel=Math.min(slashSel,slashItems.length-1);
    slashMenu.innerHTML="";
    slashItems.forEach((c,i)=>{ const d=document.createElement("div"); d.className="it"+(i===slashSel?" sel":"");
      const nm=document.createElement("span"); nm.className="nm"; nm.textContent="/"+c.name;
      const ds=document.createElement("span"); ds.className="ds"; ds.textContent=c.description||"";
      d.appendChild(nm); d.appendChild(ds);
      d.onmousedown=(e)=>{ e.preventDefault(); slashApply(c); };
      slashMenu.appendChild(d); });
    slashMenu.classList.add("show");
  }
  function slashApply(c){ inputEl.value="/"+c.name+" "; slashMenu.classList.remove("show"); slashItems=[]; inputEl.focus(); }

  // 官方式 @ 提及:光标前最近的 @token 触发工作区文件检索(＋ 钮亦入口)。
  const atMenu=$("atMenu"), plusBtn=$("plusBtn");
  let atItems=[], atSel=0, atReq=0, atStart=-1, atNoWs=false;
  function atToken(){
    const v=inputEl.value, pos=inputEl.selectionStart==null?v.length:inputEl.selectionStart;
    const m=v.slice(0,pos).match(/(^|\\s)@([\\w./\\-]*)$/);
    if(!m) return null;
    return { q:m[2], start:pos-m[2].length-1 };
  }
  function atClose(){ atMenu.classList.remove("show"); atItems=[]; atStart=-1; }
  function atFilter(){
    if(inputEl.value.startsWith("/")){ atClose(); return; }
    const t=atToken();
    if(!t){ atClose(); return; }
    atStart=t.start;
    vscode.postMessage({type:"files-query", reqId:++atReq, query:t.q});
  }
  function atRender(){
    atMenu.innerHTML="";
    if(atNoWs && !atItems.length){ const e=document.createElement("div"); e.className="empty2";
      e.textContent="未打开文件夹 — 打开工作区后可 @ 引用文件"; atMenu.appendChild(e); atMenu.classList.add("show"); return; }
    if(!atItems.length){ atClose(); return; }
    atSel=Math.min(atSel,atItems.length-1);
    atItems.forEach((f,i)=>{ const d=document.createElement("div"); d.className="it"+(i===atSel?" sel":"");
      const nm=document.createElement("span"); nm.className="nm";
      nm.textContent=f.doc?"docs:"+f.label:f.sym?(f.kind==="class"?"◆ ":"ƒ ")+f.name:f.split("/").pop();
      const ds=document.createElement("span"); ds.className="ds";
      ds.textContent=f.doc?f.url:f.sym?((f.lineage?f.lineage+" · ":"")+f.path+":"+f.line):f;
      d.appendChild(nm); d.appendChild(ds);
      d.onmousedown=(e)=>{ e.preventDefault(); atApply(f); };
      atMenu.appendChild(d); });
    atMenu.classList.add("show");
  }
  function atApply(f){
    if(atStart<0){ atClose(); return; }
    const v=inputEl.value, pos=inputEl.selectionStart==null?v.length:inputEl.selectionStart;
    const before=v.slice(0,atStart), after=v.slice(pos);
    const ins=f.doc?"@docs:"+f.label+"("+f.url+") "
      :f.sym?"@"+f.name+"("+f.path+":"+f.line+"-"+f.endLine+") "
      :"@"+f+" "; inputEl.value=before+ins+after;
    const caret=before.length+ins.length; inputEl.setSelectionRange(caret,caret);
    atClose(); inputEl.focus();
  }
  plusBtn.onclick=()=>{ const v=inputEl.value, pos=inputEl.selectionStart==null?v.length:inputEl.selectionStart;
    const sep=(pos===0||/\\s$/.test(v.slice(0,pos)))?"":" ";
    inputEl.value=v.slice(0,pos)+sep+"@"+v.slice(pos);
    const caret=pos+sep.length+1; inputEl.setSelectionRange(caret,caret); inputEl.focus(); atSel=0; atFilter(); };

  // 官方式 token 计数: 停顿 500ms 后问 LS, 超上限飘红
  const tokEl=$("tokCount"); let tokReq=0, tokTimer=null;
  function tokQuery(){ clearTimeout(tokTimer);
    const t=inputEl.value;
    if(!t.trim()){ tokEl.textContent=""; return; }
    tokTimer=setTimeout(()=>vscode.postMessage({type:"token-query", reqId:++tokReq, text:t}),500); }
  inputEl.addEventListener("input",()=>{ autoGrow(); slashSel=0; slashFilter(); atSel=0; atFilter(); tokQuery();
    sendEl.classList.toggle("idle", !inputEl.value.trim()); });
  sendEl.classList.add("idle");
  inputEl.addEventListener("blur",()=>setTimeout(()=>{ slashMenu.classList.remove("show"); atClose(); },150));
  inputEl.addEventListener("keydown",(e)=>{
    if(slashItems.length&&slashMenu.classList.contains("show")){
      if(e.key==="ArrowDown"){ e.preventDefault(); slashSel=(slashSel+1)%slashItems.length; return slashFilter(); }
      if(e.key==="ArrowUp"){ e.preventDefault(); slashSel=(slashSel-1+slashItems.length)%slashItems.length; return slashFilter(); }
      if(e.key==="Tab"||(e.key==="Enter"&&!e.shiftKey)){ e.preventDefault(); return slashApply(slashItems[slashSel]); }
      if(e.key==="Escape"){ slashMenu.classList.remove("show"); slashItems=[]; return; }
    }
    if(atMenu.classList.contains("show")){
      if(e.key==="Escape"){ atClose(); return; }
      if(atItems.length){
        if(e.key==="ArrowDown"){ e.preventDefault(); atSel=(atSel+1)%atItems.length; return atRender(); }
        if(e.key==="ArrowUp"){ e.preventDefault(); atSel=(atSel-1+atItems.length)%atItems.length; return atRender(); }
        if(e.key==="Tab"||(e.key==="Enter"&&!e.shiftKey)){ e.preventDefault(); return atApply(atItems[atSel]); }
      }
    }
    if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); send(); }});

  function findNode(id){ let n=[...logEl.querySelectorAll(".assistant")].find(x=>x.dataset.id===id);
    if(!n && id){ n=addMsg("assistant",""); n.dataset.id=id; n.dataset.acc=""; }
    return n; }
  window.addEventListener("message",(e)=>{
    const m=e.data;
    if(m.type==="env"){
      envEl.textContent=(m.devinBin?"引擎 ✓":"引擎 ✗")+(m.loggedIn?" · 已登录"+(m.userName?"("+m.userName+")":""):"")
        +(m.windsurf&&m.windsurf.lsPort?" · LS:"+m.windsurf.lsPort+(m.windsurf.lsCsrf?"✓":""):"")
        +(m.windsurf&&m.windsurf.authSignedIn?" · 官登"+(m.windsurf.authName?"("+m.windsurf.authName+")":"✓"):"");
      envEl.title=(m.devinBin||"未找到 devin 引擎(内置 engine/ 或设 DAO_DEVIN_BIN)")
        +(m.windsurf&&m.windsurf.lsPort?"\\n官方 language_server 端口 "+m.windsurf.lsPort+" · CSRF "+(m.windsurf.lsCsrf?"已捕获":"未捕获"):"");
      if(m.folder){ const fn=document.getElementById("folderName"); if(fn) fn.textContent=m.folder; }
      // 官方顶栏头像同位: 已登录即显账号首字母圆片, 点击开账户卡
      (function(){ const ch=document.getElementById("acctChip"); if(!ch) return;
        const nm=(m.windsurf&&m.windsurf.authSignedIn&&m.windsurf.authName)||(m.loggedIn&&m.userName)||"";
        if(nm){ ch.textContent=nm.replace(/[^A-Za-z0-9]/g,"").slice(0,2).toUpperCase()||"?";
          ch.style.display="inline-block";
          // 官方头像下拉菜单同构(官方 GlobalActivity 菜单实机反提: Devin Account/Settings/Usage/
          // Sign Out ┃ Editor Settings/Keyboard Shortcuts/Extensions/Snippets/Tasks/Themes ┃
          // Check for Updates/Docs/Join the Community/Changelog/Download Diagnostics)
          ch.onclick=(ev)=>{ ev.stopPropagation();
            const ex=document.getElementById("avMenu"); if(ex){ ex.remove(); return; }
            const items=[
              ["account","Devin Account ("+nm+")"],["settings","Devin Settings"],["usage","Devin Usage"],["signout","Sign Out"],null,
              ["editor-settings","Editor Settings"],["keybindings","Open Keyboard Shortcuts"],["extensions","Extensions"],
              ["snippets","Configure Snippets"],["tasks","Tasks"],["themes","Themes"],null,
              ["updates","Check for Updates..."],["docs","Docs"],["community","Join the Community"],
              ["changelog","Changelog"],["diagnostics","Download Diagnostics"]];
            const mn=document.createElement("div"); mn.id="avMenu";
            mn.style.cssText="position:fixed;top:26px;right:6px;z-index:9999;min-width:210px;background:var(--vscode-menu-background,#252526);color:var(--vscode-menu-foreground,#ccc);border:1px solid var(--vscode-menu-border,#454545);border-radius:6px;padding:4px 0;font-size:12px;box-shadow:0 4px 12px rgba(0,0,0,.4)";
            for(const it of items){
              if(!it){ const hr=document.createElement("div"); hr.style.cssText="height:1px;background:var(--vscode-menu-separatorBackground,#454545);margin:4px 0"; mn.appendChild(hr); continue; }
              const d=document.createElement("div"); d.textContent=it[1];
              d.style.cssText="padding:4px 14px;cursor:pointer;white-space:nowrap";
              d.onmouseenter=()=>d.style.background="var(--vscode-menu-selectionBackground,#04395e)";
              d.onmouseleave=()=>d.style.background="";
              d.onclick=()=>{ mn.remove(); vscode.postMessage({type:"avatar-cmd",id:it[0]}); };
              mn.appendChild(d);
            }
            document.body.appendChild(mn);
            setTimeout(()=>document.addEventListener("click",function h(){ mn.remove(); document.removeEventListener("click",h); }),0);
          };
        } else ch.style.display="none"; })();
      envEl.style.cursor="pointer"; envEl.onclick=()=>{ const ex=document.getElementById("acctPop");
        if(ex){ ex.remove(); vscode.postMessage({type:"account-close"}); } else vscode.postMessage({type:"account-status"}); };
      if(m.devinBin && !m.loggedIn){ authbar.classList.add("show"); authmsg.textContent="未登录 — 插件自持登录(不依赖 Devin Desktop)"; }
      else { authbar.classList.remove("show"); }
    }
    else if(m.type==="token-count"){
      if(m.reqId!==tokReq) return;
      tokEl.textContent=m.count+(m.max?"/"+m.max:"")+" tok";
      tokEl.style.color=(m.max&&m.count>m.max)?"var(--vscode-errorForeground,#f66)":"var(--dim)";
    }
    else if(m.type==="account"){
      // 官方式账户卡: 点击底栏弹出 姓名/邮箱/套餐/月度额度, 再点关闭
      const old=document.getElementById("acctPop"); if(old) old.remove();
      const p=document.createElement("div"); p.id="acctPop";
      p.style.cssText="position:fixed;left:8px;bottom:34px;z-index:99;background:var(--vscode-editorWidget-background,#252526);border:1px solid var(--vscode-widget-border,#444);border-radius:6px;padding:8px 10px;font-size:11px;line-height:1.7;box-shadow:0 4px 12px rgba(0,0,0,.4);";
      const fmtT=(u)=>{ try{ return new Date(u*1000).toLocaleString(); }catch(_){ return ""; } };
      if(m.profileUrl){ const av=document.createElement("img"); av.src=m.profileUrl; av.alt="";
        av.style.cssText="width:28px;height:28px;border-radius:50%;display:block;margin-bottom:6px;"; p.appendChild(av); }
      const rows=[["账户",m.name],["邮箱",m.email],["套餐",m.plan],["Prompt 额度/月",m.promptCredits],["Flow 额度/月",m.flowCredits],["输入 token 上限",m.maxInputTokens],
        ["今日配额剩余",(m.dailyQuotaPct===null||m.dailyQuotaPct===undefined)?"":m.dailyQuotaPct+"%"],
        ["本周配额剩余",(m.weeklyQuotaPct===null||m.weeklyQuotaPct===undefined)?"":m.weeklyQuotaPct+"%"],
        ["Flex credits",(m.flexCredits===null||m.flexCredits===undefined)?"":m.flexCredits],
        ["日配额重置",m.dailyResetUnix?fmtT(m.dailyResetUnix):""],
        ["周配额重置",m.weeklyResetUnix?fmtT(m.weeklyResetUnix):""]];
      for(const [k,v] of rows){ if(v===""||v===undefined) continue;
        const d=document.createElement("div"); const b=document.createElement("b"); b.textContent=k+": "; d.appendChild(b);
        d.appendChild(document.createTextNode(String(v))); p.appendChild(d); }
      const x=document.createElement("div"); x.textContent="点底栏关闭"; x.style.cssText="opacity:.5;margin-top:4px;"; p.appendChild(x);
      document.body.appendChild(p);
    }
    else if(m.type==="login-state"){
      if(m.state==="url"){ authmsg.textContent="已打开登录页,登录后把 code 粘贴到这里 →"; authcode.style.display=""; authsubmit.style.display=""; }
      else if(m.state==="ok"){ authmsg.textContent="登录成功"; authcode.style.display="none"; authsubmit.style.display="none"; }
      else { authmsg.textContent="登录失败: "+(m.text||""); }
    }
    else if(m.type==="config-options"){
      // 按 agent 分组存配置(cascade=LS 本地轨 133 模型; acp=Devin Local/Cloud 云端轨)。
      // 不同轨模型/模式各异, 存后仅渲染当前 agent 的选择器, 避免 ACP 单模型覆盖 Cascade 全量目录。
      const grp=(m.agent==="cascade")?"cascade":"acp";
      for(const co of (m.configOptions||[])){
        if(co.category==="model"||co.id==="model") cfgStore[grp].model=co;
        else if(co.category==="mode"||co.id==="mode") cfgStore[grp].mode=co;
      }
      renderConfigFor(curGroup());
    }
    else if(m.type==="sessions"){
      // 官方首页式 Recent sessions 列表(空态时展示,点击载入)
      recentList.innerHTML="";
      const rs=(m.sessions||[]).slice(0,5);
      for(const s of rs){ const it=document.createElement("div"); it.className="item";
        const t=document.createElement("span"); t.textContent=(s.title||s.sessionId).slice(0,48);
        const w=document.createElement("span"); w.className="when"; w.textContent=rel(s.updatedAt);
        it.appendChild(t); it.appendChild(w);
        if((s.sessionId||"").startsWith("cx:")){
          const rn=document.createElement("span"); rn.className="arch"; rn.title="重命名会话"; rn.textContent="✎";
          rn.onclick=(ev)=>{ ev.stopPropagation(); vscode.postMessage({type:"session-rename", sessionId:s.sessionId}); };
          it.appendChild(rn);
          const ex=document.createElement("span"); ex.className="arch"; ex.title="导出会话转录"; ex.textContent="⤓";
          ex.onclick=(ev)=>{ ev.stopPropagation(); vscode.postMessage({type:"session-export", sessionId:s.sessionId}); };
          it.appendChild(ex);
          const a=document.createElement("span"); a.className="arch"; a.title="移除会话"; a.textContent="🗑";
          a.onclick=(ev)=>{ ev.stopPropagation(); vscode.postMessage({type:"session-archive", sessionId:s.sessionId}); };
          it.appendChild(a);
        }
        it.onclick=()=>vscode.postMessage({type:"session-load", sessionId:s.sessionId});
        recentList.appendChild(it); }
      recentEl.classList.toggle("show", rs.length>0);
    }
    else if(m.type==="session-current"){ /* 当前会话 id — 标题栏动作接管,无需内嵌 UI */ }
    else if(m.type==="session-info"){ /* 会话标题由 ACP 自动生成,历史 QuickPick 展示 */ }
    else if(m.type==="usage"){ const u=m.usage||{}; if(u.totalTokens||u.usedTokens) usageEl.textContent=(u.usedTokens||u.totalTokens)+" tok"; }
    else if(m.type==="history-clear"){ logEl.innerHTML=""; state.history=[]; vscode.setState(state);
      if(m.home&&emptyEl){ logEl.appendChild(emptyEl); vscode.postMessage({type:"sessions-list"}); } }
    else if(m.type==="history-done"){ logEl.scrollTop=logEl.scrollHeight; }
    else if(m.type==="user-replay"){ const n=addMsg("user", m.text, m.images);
      if(typeof m.stepIndex==="number"){ const rv=document.createElement("button"); rv.className="msgrevert"; rv.title="回退到此消息(丢弃之后步骤)"; rv.textContent="↩";
        rv.onclick=(e)=>{ e.stopPropagation(); vscode.postMessage({type:"cx-revert", stepIndex:m.stepIndex}); }; n.appendChild(rv);
        const br=document.createElement("button"); br.className="msgbranch"; br.title="从此消息开分支(原会话保持不变)"; br.textContent="⑂";
        br.onclick=(e)=>{ e.stopPropagation(); vscode.postMessage({type:"cx-branch", stepIndex:m.stepIndex, text:m.text}); }; n.appendChild(br); } }
    else if(m.type==="deepwiki"){
      // 官方式 DeepWiki 解释卡: 📖 符号头 + 流式 markdown 正文
      let el=logEl.querySelector('[data-dw="'+m.id+'"]');
      if(!el){ if(emptyEl) emptyEl.remove(); el=document.createElement("div"); el.dataset.dw=m.id; el.className="msg assistant"; logEl.appendChild(el); }
      el.innerHTML='<div style="color:var(--dim);font-size:11px;margin-bottom:4px;">\u{1F4D6} DeepWiki \u00b7 '+esc(m.symbol||"")+(m.inProgress?" \u2026":"")+'</div>'+md(m.text||"");
      logEl.scrollTop=logEl.scrollHeight;
    }
    else if(m.type==="cmd-card"){
      // 官方式终端卡: ⌘ 命令 + cwd + 退出码徽标, 点击展开命令输出
      let el=logEl.querySelector('[data-tc="'+m.toolCallId+'"]');
      if(!el){ if(emptyEl) emptyEl.remove(); el=document.createElement("div"); el.dataset.tc=m.toolCallId; logEl.appendChild(el); }
      el.className="cmdcard "+(m.status||""); el.innerHTML="";
      const hd=document.createElement("div"); hd.className="chead";
      const ch=document.createElement("span"); ch.className="chev"; ch.textContent="▸";
      const ic=document.createElement("span"); ic.innerHTML=OICONS.terminal;
      const cm=document.createElement("span"); cm.className="cmd"; cm.textContent=m.command||""; cm.title=m.command||"";
      hd.appendChild(ch); hd.appendChild(ic); hd.appendChild(cm);
      // 官方同文 tooltip: Copy command / Insert in terminal
      const cpb=document.createElement("button"); cpb.className="cmi"; cpb.title="Copy command"; cpb.innerHTML=OICONS.copy;
      cpb.onclick=(ev)=>{ ev.stopPropagation(); navigator.clipboard.writeText(m.command||""); };
      const inb=document.createElement("button"); inb.className="cmi"; inb.title="Insert in terminal"; inb.innerHTML=OICONS.insert;
      inb.onclick=(ev)=>{ ev.stopPropagation(); vscode.postMessage({type:"insert-terminal", text:m.command||""}); };
      hd.appendChild(cpb); hd.appendChild(inb);
      if(m.cwd){ const w=document.createElement("span"); w.className="cwd"; w.textContent="in "+m.cwd; hd.appendChild(w); }
      if(m.exitCode!=null){ const e2=document.createElement("span"); e2.className="ec "+(m.exitCode===0?"ok":"bad");
        e2.textContent=m.exitCode===0?"✓":"exit "+m.exitCode; hd.appendChild(e2); }
      const bd=document.createElement("div"); bd.className="cbody"; bd.style.display="none"; bd.textContent=m.output||"(无输出)";
      hd.onclick=()=>{ const open=bd.style.display==="none"; bd.style.display=open?"":"none"; ch.textContent=open?"▾":"▸"; };
      el.appendChild(hd); el.appendChild(bd); logEl.scrollTop=logEl.scrollHeight;
    }
    else if(m.type==="code-diff"){
      // 官方式代码变更卡: 文件名 + new/±徽标, 点击展开彩色 unified diff
      let el=logEl.querySelector('[data-tc="'+m.toolCallId+'"]');
      if(!el){ if(emptyEl) emptyEl.remove(); el=document.createElement("div"); el.dataset.tc=m.toolCallId; logEl.appendChild(el); }
      el.className="diffcard "+(m.status||""); el.innerHTML="";
      const hd=document.createElement("div"); hd.className="dhead";
      const ch=document.createElement("span"); ch.className="chev"; ch.textContent="▸";
      const fn=document.createElement("span"); fn.className="fn"; fn.textContent=(m.file||"").split("/").pop()||m.file; fn.title=m.file||"";
      fn.onclick=(ev)=>{ ev.stopPropagation(); vscode.postMessage({type:"open-file", path:m.file}); };
      hd.appendChild(ch); hd.appendChild(fn);
      if(m.created){ const b=document.createElement("span"); b.className="newb"; b.textContent="new"; hd.appendChild(b); }
      const na=(m.lines||[]).filter(l=>l.t==="+").length, nd=(m.lines||[]).filter(l=>l.t==="-").length;
      if(na){ const b=document.createElement("span"); b.className="add"; b.textContent="+"+na; hd.appendChild(b); }
      if(nd){ const b=document.createElement("span"); b.className="del"; b.textContent="−"+nd; hd.appendChild(b); }
      if(m.status==="completed"&&!el.dataset.acked){
        // 官方同文(反提 workbench 真源): Accept / Reject 文字钮
        const ok=document.createElement("span"); ok.className="mi"; ok.title="Accept file"; ok.textContent="Accept"; ok.style.cssText="cursor:pointer;color:#4c4;font-size:11px;";
        ok.onclick=(ev)=>{ ev.stopPropagation(); vscode.postMessage({type:"cx-ack", file:m.file, accept:true, created:!!m.created}); };
        const no=document.createElement("span"); no.className="mi"; no.title="Reject file"; no.textContent="Reject"; no.style.cssText="cursor:pointer;color:#c55;font-size:11px;";
        no.onclick=(ev)=>{ ev.stopPropagation(); vscode.postMessage({type:"cx-ack", file:m.file, accept:false, created:!!m.created}); };
        hd.appendChild(ok); hd.appendChild(no); }
      const bd=document.createElement("div"); bd.className="dbody"; bd.style.display="none";
      for(const l of (m.lines||[])){ const r=document.createElement("div"); r.className="dl"+(l.t==="+"?" i":l.t==="-"?" d":"");
        r.textContent=(l.t==="+"?"+ ":l.t==="-"?"− ":"  ")+(l.text||""); bd.appendChild(r); }
      hd.onclick=()=>{ const open=bd.style.display==="none"; bd.style.display=open?"":"none"; ch.textContent=open?"▾":"▸"; };
      el.appendChild(hd); el.appendChild(bd); logEl.scrollTop=logEl.scrollHeight;
    }
    else if(m.type==="cx-acked"){
      // 存档回执: 变更卡标记 Accepted/Rejected(官方同文), 隐藏 Accept/Reject 钮
      for(const el of logEl.querySelectorAll(".diffcard")){
        const fn=el.querySelector(".fn"); if(!fn||fn.title!==m.file) continue;
        el.dataset.acked="1";
        for(const b of el.querySelectorAll(".mi")) b.remove();
        const tag=document.createElement("span"); tag.className="ec "+(m.accept?"ok":"bad");
        tag.textContent=m.accept?"Accepted":"Rejected"; el.querySelector(".dhead").appendChild(tag); }
    }
    else if(m.type==="browse-card"){
      // 官方式检索/浏览卡: Analyzed/Searched/Read + 官方同源图标(folder-open/magnifying-glass/file-text) + 计数徽标, 点击展开明细, 文件名可点开
      let el=logEl.querySelector('[data-tc="'+m.toolCallId+'"]');
      if(!el){ if(emptyEl) emptyEl.remove(); el=document.createElement("div"); el.dataset.tc=m.toolCallId; logEl.appendChild(el); }
      el.className="cmdcard "+(m.status||""); el.innerHTML="";
      const hd=document.createElement("div"); hd.className="chead";
      const ch=document.createElement("span"); ch.className="chev"; ch.textContent="▸";
      const ic=document.createElement("span"); ic.innerHTML=BROWSE_ICONS[m.kind]||FILE_SVG;
      const base=(m.file||"").split("/").pop()||m.file||"";
      const cm=document.createElement("span"); cm.className="cmd";
      cm.textContent=m.kind==="list"?"Analyzed "+base:m.kind==="grep"?"Searched "+(m.query||"")+" in "+base:"Read "+base+(m.endLine?" L"+(m.startLine||1)+"-"+m.endLine:"");
      cm.title=m.file||"";
      cm.onclick=(ev)=>{ ev.stopPropagation(); vscode.postMessage({type:"open-file", path:m.file}); };
      hd.appendChild(ch); hd.appendChild(ic); hd.appendChild(cm);
      if(m.kind!=="view"&&m.count!=null){ const b=document.createElement("span"); b.className="ec ok"; b.textContent=m.count+(m.kind==="grep"?" 处":" 项"); hd.appendChild(b); }
      const bd=document.createElement("div"); bd.className="cbody"; bd.style.display="none";
      if(m.kind==="list"){ for(const it of (m.items||[])){ const r=document.createElement("div");
          if(it.isDir){ const fi=document.createElement("span"); fi.innerHTML=FOLDER_SVG; r.appendChild(fi); r.appendChild(document.createTextNode(" ")); }
          r.appendChild(document.createTextNode((it.isDir?"":"· ")+it.name+(it.info?"  ("+it.info+")":""))); bd.appendChild(r); } if(!(m.items||[]).length) bd.textContent="(空目录)"; }
      else if(m.kind==="grep"){ for(const mt of (m.matches||[])){ const r=document.createElement("div");
          r.textContent=(mt.file?mt.file.split("/").pop():"")+(mt.line?":"+mt.line:"")+"  "+(mt.text||"");
          if(mt.file){ r.style.cursor="pointer"; r.onclick=()=>vscode.postMessage({type:"open-file", path:mt.file}); }
          bd.appendChild(r); } if(!(m.matches||[]).length) bd.textContent="(无匹配)"; }
      else bd.textContent=m.content||"(空)";
      hd.onclick=()=>{ const open=bd.style.display==="none"; bd.style.display=open?"":"none"; ch.textContent=open?"▾":"▸"; };
      el.appendChild(hd); el.appendChild(bd); logEl.scrollTop=logEl.scrollHeight;
    }
    else if(m.type==="tool-call"){
      let el=logEl.querySelector('[data-tc="'+m.toolCallId+'"]');
      if(!el){ if(emptyEl) emptyEl.remove(); el=document.createElement("div"); el.dataset.tc=m.toolCallId; logEl.appendChild(el); }
      el.className="tool "+(m.status||"");
      if(m.title) el.dataset.ti=m.title; if(m.kindName) el.dataset.kn=m.kindName;
      if(m.locations&&m.locations.length) el.dataset.loc=m.locations.join("\\n");
      // 官方式可折叠工具卡片:头部(状态+标题+展开箭头) → 点击展开涉及文件列表
      el.innerHTML=""; const hd=document.createElement("div"); hd.className="thead";
      const st=document.createElement("span"); st.className="st"; st.textContent=m.status||"…";
      const ti=document.createElement("span"); ti.className="tt"; ti.textContent=(el.dataset.kn?"["+el.dataset.kn+"] ":"")+(el.dataset.ti||m.toolCallId);
      hd.appendChild(st); hd.appendChild(ti);
      if(m.kindName==="cascade"&&m.status==="in_progress"&&typeof m.stepIndex==="number"){
        const cx=document.createElement("button"); cx.className="stepcancel"; cx.textContent="✕"; cx.title="取消此步骤(CancelCascadeSteps)";
        cx.style.cssText="margin-left:auto;cursor:pointer;background:none;border:none;color:#8b949e;font-size:11px;";
        cx.onclick=(e)=>{ e.stopPropagation(); cx.remove(); vscode.postMessage({type:"cx-step-cancel", stepIndex:m.stepIndex}); };
        hd.appendChild(cx); }
      if(el.dataset.loc){ const ch=document.createElement("span"); ch.className="chev"; ch.textContent=el.dataset.open?"▾":"▸"; hd.appendChild(ch);
        const bd=document.createElement("div"); bd.className="tbody";
        for(const p of el.dataset.loc.split("\\n")){ const r=document.createElement("div"); r.textContent=p; bd.appendChild(r); }
        bd.style.display=el.dataset.open?"":"none";
        hd.style.cursor="pointer";
        hd.onclick=()=>{ const open=bd.style.display==="none"; bd.style.display=open?"":"none";
          ch.textContent=open?"▾":"▸"; if(open) el.dataset.open="1"; else delete el.dataset.open; };
        el.appendChild(hd); el.appendChild(bd);
      } else { el.appendChild(hd); }
      logEl.scrollTop=logEl.scrollHeight;
    }
    else if(m.type==="plan"){
      let el=logEl.querySelector(".plan[data-active]");
      if(!el){ if(emptyEl) emptyEl.remove(); el=document.createElement("div"); el.className="plan"; el.dataset.active="1"; logEl.appendChild(el); }
      el.innerHTML="";
      for(const pe of (m.entries||[])){ const s=document.createElement("span"); s.className="pe "+(pe.status||"");
        s.textContent=(pe.status==="completed"?"☑ ":pe.status==="in_progress"?"▸ ":"☐ ")+pe.content; el.appendChild(s); }
      logEl.scrollTop=logEl.scrollHeight;
    }
    else if(m.type==="permission"){
      if(emptyEl) emptyEl.remove();
      const el=document.createElement("div"); el.className="perm"; el.dataset.perm=m.reqId;
      const t=document.createElement("div"); t.textContent="权限请求: "+m.title; el.appendChild(t);
      for(const o of (m.options||[])){ const b=document.createElement("button"); b.textContent=o.name||o.optionId;
        b.onclick=()=>{ vscode.postMessage({type:"permission-reply", reqId:m.reqId, optionId:o.optionId}); el.remove(); };
        el.appendChild(b); }
      logEl.appendChild(el); logEl.scrollTop=logEl.scrollHeight;
    }
    else if(m.type==="permission-close"){ const el=logEl.querySelector('[data-perm="'+m.reqId+'"]'); if(el) el.remove(); }
    else if(m.type==="commands"){ slashCmdsBy[m.agent||agent]=m.commands||[]; slashSync(); slashFilter(); }
    else if(m.type==="files"){
      if(m.reqId!==atReq) return;            // 丢弃过期响应
      if(!atToken()){ atClose(); return; }   // 菜单已失效(token 已删)
      atNoWs=!!m.noWorkspace;
      atItems=(m.docs||[]).map(d=>({doc:true,label:d.label,url:d.url}))
        .concat((m.syms||[]).map(s=>({sym:true,name:s.name,lineage:s.lineage,path:s.path,line:s.line,endLine:s.endLine,kind:s.kind})))
        .concat(m.files||[]);
      atRender();
    }
    else if(m.type==="modes" && m.modes && m.modes.availableModes){
      modeSet(m.modes.availableModes.map(md=>({value:md.id,name:md.name,description:md.description})), m.modes.currentModeId);
      modeWrap.classList.add("show");
    }
    else if(m.type==="mode-current"){ if(modeOpts.some(o=>o.value===m.modeId)){ modeVal=m.modeId; modeBtnSync(); } }
    else if(m.type==="ui-action"){
      // 官方全局命令对位(面板外也可触发): 模型选择器/下一模型/会话模式/agent 选择器
      if(m.act==="toggleModel") modelBtn.click();
      else if(m.act==="toggleMode") modeBtn.click();
      else if(m.act==="agentPicker") agentBtn.click();
      else if(m.act==="nextModel") document.dispatchEvent(new KeyboardEvent("keydown",{ctrlKey:true,shiftKey:true,key:"?",cancelable:true}));
    }
    else if(m.type==="thought-delta"){
      // 官方式可折叠思考块:流式中展开计时,答复开始后自动收起为「Thought for Ns」
      const node=findNode(m.id);
      if(node){ let t=node.querySelector(".thought");
        if(!t){ t=document.createElement("span"); t.className="thought"; node.textContent=""; node.dataset.acc="";
          t.dataset.t0=Date.now();
          const hd=document.createElement("div"); hd.className="thead2";
          hd.innerHTML='<span class="chev">▾</span><span class="lbl">Thinking…</span>';
          const bd=document.createElement("div"); bd.className="tbody2";
          hd.onclick=()=>{ const open=bd.style.display==="none"; bd.style.display=open?"":"none";
            hd.querySelector(".chev").textContent=open?"▾":"▸"; };
          t.appendChild(hd); t.appendChild(bd); node.appendChild(t); }
        t.querySelector(".tbody2").textContent=(t.querySelector(".tbody2").textContent||"")+m.text;
        logEl.scrollTop=logEl.scrollHeight; }
    }
    else if(m.type==="assistant-delta"){
      const node=findNode(m.id);
      if(node){ let body=node.querySelector(".body");
        if(!body){ body=document.createElement("span"); const th=node.querySelector(".thought");
          if(!th) node.textContent="";
          else { const secs=Math.max(1,Math.round((Date.now()-(+th.dataset.t0||Date.now()))/1000));
            th.querySelector(".lbl").textContent="Thought for "+secs+"s";
            th.querySelector(".tbody2").style.display="none"; th.querySelector(".chev").textContent="▸"; }
          body.className="body"; node.appendChild(body); }
        node.dataset.acc=(node.dataset.acc||"")+m.text; body.innerHTML=md(node.dataset.acc); logEl.scrollTop=logEl.scrollHeight; }
    } else if(m.type==="cx-queue"){
      const qb=document.getElementById("queuebar"); qb.innerHTML=""; const q=m.queue||[];
      qb.className=q.length?"show":"";
      for(const it of q){ const c=document.createElement("div"); c.className="qchip";
        const tx=document.createElement("span"); tx.className="qtxt"; tx.textContent="⏳ "+it.text; c.appendChild(tx);
        for(const [sym,ty,tip] of [["⚡","cx-queue-now","立即发送(打断当前轮)"],["↑","cx-queue-front","移到队首"],["✕","cx-queue-remove","移出队列"]]){
          const b=document.createElement("button"); b.textContent=sym; b.title=tip;
          b.onclick=()=>vscode.postMessage({type:ty, queueId:it.queueId}); c.appendChild(b); }
        qb.appendChild(c); }
    } else if(m.type==="assistant-done"){
      const node=findNode(m.id);
      if(node){ const fin=(node.dataset.acc||"")||m.text||"(空响应)";
        if(!node.dataset.acc){ node.innerHTML=md(fin); }
        state.history.push({role:"assistant",content:fin}); vscode.setState(state); attachMsgCopy(node);
        if(/^⚠|\\n⚠/.test(fin)){ const lastU=[...state.history].reverse().find(function(h){return h.role==="user";});
          if(lastU&&lastU.content){ const rt=document.createElement("button"); rt.className="msgretry"; rt.textContent="↻ 重试";
            rt.title="重发上一条消息"; rt.style.cssText="display:block;margin-top:6px;cursor:pointer;background:none;border:1px solid #58a6ff;border-radius:4px;color:#58a6ff;padding:2px 10px;font-size:12px;";
            rt.onclick=function(){ rt.remove(); inputEl.value=lastU.content; send(); }; node.appendChild(rt); } } }
      const pl=logEl.querySelector('.plan[data-active]'); if(pl) delete pl.dataset.active;
      setBusy(false);
    } else if(m.type==="arena-start"){
      const n=findNode(m.id); if(n){ n.textContent=""; n.dataset.acc="";
        const wrap=document.createElement("div"); wrap.className="arena"; wrap.id="arenaWrap";
        for(let i=0;i<(m.count||2);i++){ const col=document.createElement("div"); col.className="arenacol";
          const h=document.createElement("div"); h.className="ah"; h.textContent="⚔ 候选 "+(i+1);
          const b=document.createElement("div"); b.className="ab";
          const p=document.createElement("button"); p.className="apick"; p.textContent="选用此回复"; p.disabled=true;
          p.onclick=()=>vscode.postMessage({type:"arena-pick", slot:i});
          col.appendChild(h); col.appendChild(b); col.appendChild(p); wrap.appendChild(col); }
        n.appendChild(wrap); }
    } else if(m.type==="arena-delta"){
      const n=findNode(m.id); const cols=n?n.querySelectorAll(".arenacol .ab"):[];
      if(cols[m.slot]){ cols[m.slot].textContent+=m.text; logEl.scrollTop=logEl.scrollHeight; }
    } else if(m.type==="arena-done"){
      const n=findNode(m.id); if(n) n.querySelectorAll(".apick").forEach(p=>{p.disabled=false;});
      setBusy(false);
    } else if(m.type==="worktree-info"){
      wtBar.style.display=m.on?"flex":"none"; wtTxt.textContent=m.text||"";
      wtUndo.style.display=m.undo?"":"none";
    } else if(m.type==="user-settings"){
      autoOpenCk.checked=!!m.openRecent;
      if(!arenaBtn.disabled){ arenaOn=!!m.arena; arenaBtn.classList.toggle("on",arenaOn); }
    } else if(m.type==="arena-avail"){
      arenaBtn.disabled=!m.ok; arenaBtn.style.opacity=m.ok?"":".4"; arenaBtn.title=m.ok?arenaTitle:(m.reason||arenaTitle);
      if(!m.ok){ arenaOn=false; arenaBtn.classList.remove("on"); }
    } else if(m.type==="arena-picked"){
      const wrap=document.getElementById("arenaWrap");
      if(wrap){ wrap.querySelectorAll(".arenacol").forEach((c,i)=>{ c.classList.toggle("win",i===m.slot); c.classList.toggle("lose",i!==m.slot); });
        wrap.querySelectorAll(".apick").forEach(p=>p.remove()); wrap.removeAttribute("id"); }
    } else if(m.type==="agents-registry"){
      agentList.innerHTML="";
      for(const a of (m.agents||[])){ const it=document.createElement("div"); it.className="mit";
        const row=document.createElement("div"); row.className="mrow"; row.textContent=a.name+(a.version?" "+a.version:"");
        if(a.featured){ const b=document.createElement("span"); b.className="bdg"; b.textContent="Featured"; row.appendChild(b); }
        it.appendChild(row);
        if(a.desc){ const ds=document.createElement("div"); ds.className="mds"; ds.textContent=a.desc; it.appendChild(ds); }
        it.title=a.repo||"";
        it.onclick=()=>{ agentMenuClose(); if(a.repo) vscode.postMessage({type:"store-open", url:a.repo}); };
        agentList.appendChild(it); }
      agentMenu.classList.add("show");
    } else if(m.type==="msg-stats"){ const node=findNode(m.id);
      // 官方回合尾为 👍👎 反馈行(不显成本统计) —— 统计信息降为悬停提示
      if(node&&m.text){ let fb=node.querySelector(".fbrow");
        if(!fb){ fb=document.createElement("div"); fb.className="fbrow";
          const UP='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M11.170 2.062 C 10.856 2.146,10.667 2.256,10.399 2.511 C 10.176 2.723,10.109 2.833,9.519 3.980 C 9.168 4.662,8.328 6.295,7.651 7.610 L 6.420 10.000 5.037 10.000 C 4.213 10.000,3.560 10.018,3.419 10.044 C 2.950 10.130,2.476 10.466,2.230 10.887 C 1.995 11.287,2.000 11.189,2.000 15.500 C 2.000 19.811,1.995 19.713,2.230 20.113 C 2.362 20.339,2.661 20.638,2.887 20.770 C 3.305 21.015,2.855 21.003,10.809 20.990 L 18.060 20.978 18.380 20.887 C 19.112 20.678,19.839 20.207,20.318 19.632 C 20.613 19.277,20.931 18.654,21.039 18.220 C 21.179 17.661,21.964 12.427,21.988 11.897 C 22.057 10.384,21.249 9.040,19.872 8.378 C 19.132 8.023,18.909 8.000,16.164 8.000 L 13.894 8.000 14.129 6.510 C 14.332 5.225,14.362 4.965,14.347 4.620 C 14.315 3.878,14.022 3.252,13.461 2.727 C 12.863 2.167,11.860 1.876,11.170 2.062 M12.175 3.641 C 12.581 3.845,12.848 4.276,12.844 4.721 C 12.843 4.864,12.716 5.791,12.561 6.781 C 12.407 7.770,12.280 8.655,12.280 8.747 C 12.280 8.960,12.337 9.110,12.473 9.254 C 12.719 9.514,12.523 9.498,15.820 9.520 C 18.776 9.540,18.823 9.541,19.030 9.626 C 19.807 9.945,20.363 10.625,20.479 11.399 C 20.534 11.767,20.559 11.560,20.039 14.980 C 19.748 16.892,19.579 17.895,19.521 18.049 C 19.280 18.691,18.745 19.188,18.040 19.425 C 17.831 19.495,17.554 19.499,12.670 19.511 L 7.520 19.523 7.520 15.335 L 7.520 11.148 9.446 7.404 C 10.505 5.345,11.401 3.627,11.436 3.586 C 11.526 3.481,11.913 3.510,12.175 3.641 M6.000 15.522 L 6.000 19.523 4.817 19.512 C 3.699 19.501,3.630 19.496,3.577 19.422 C 3.529 19.357,3.520 18.755,3.520 15.495 C 3.520 12.049,3.527 11.639,3.583 11.583 C 3.637 11.529,3.806 11.520,4.823 11.520 L 6.000 11.520 6.000 15.522 " stroke="none" fill-rule="evenodd" fill="currentColor"/></svg>';
          const DN='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6.000 3.047 C 4.739 3.227,3.488 4.244,3.078 5.424 C 2.937 5.829,2.895 6.065,2.455 8.920 C 2.065 11.445,2.026 11.751,2.025 12.260 C 2.023 12.928,2.102 13.288,2.375 13.855 C 2.586 14.295,2.749 14.525,3.108 14.892 C 3.562 15.356,4.139 15.691,4.820 15.886 C 5.136 15.976,5.172 15.978,7.630 15.991 L 10.121 16.003 10.100 16.092 C 10.036 16.371,9.669 18.833,9.651 19.106 C 9.553 20.561,10.713 21.882,12.180 21.987 C 12.763 22.029,13.251 21.855,13.630 21.470 C 13.863 21.234,13.820 21.315,16.220 16.646 L 17.580 14.001 19.014 14.001 C 20.575 14.000,20.755 13.980,21.113 13.770 C 21.339 13.638,21.638 13.339,21.770 13.113 C 22.005 12.713,22.000 12.811,22.000 8.500 C 22.000 4.189,22.005 4.287,21.770 3.887 C 21.524 3.466,21.050 3.130,20.581 3.044 C 20.282 2.988,6.388 2.992,6.000 3.047 M16.480 8.688 L 16.480 12.856 14.555 16.598 C 13.497 18.656,12.598 20.374,12.558 20.417 C 12.469 20.509,12.231 20.510,11.953 20.418 C 11.517 20.273,11.160 19.767,11.160 19.293 C 11.160 19.153,11.288 18.225,11.443 17.230 C 11.599 16.234,11.727 15.338,11.728 15.237 C 11.729 15.136,11.701 14.999,11.667 14.933 C 11.589 14.783,11.349 14.568,11.229 14.541 C 11.180 14.530,9.835 14.515,8.240 14.509 C 5.035 14.495,5.193 14.507,4.673 14.232 C 4.412 14.094,4.050 13.751,3.853 13.456 C 3.626 13.116,3.551 12.869,3.531 12.400 C 3.516 12.018,3.553 11.722,3.955 9.094 C 4.222 7.350,4.429 6.116,4.478 5.976 C 4.632 5.538,4.968 5.122,5.379 4.859 C 5.600 4.717,5.907 4.582,6.082 4.549 C 6.136 4.539,8.498 4.528,11.330 4.525 L 16.480 4.520 16.480 8.688 M20.417 4.583 C 20.473 4.639,20.480 5.048,20.479 8.493 C 20.479 10.609,20.466 12.360,20.449 12.384 C 20.368 12.506,20.229 12.520,19.123 12.520 L 18.000 12.520 18.000 8.520 L 18.000 4.520 19.177 4.520 C 20.194 4.520,20.363 4.529,20.417 4.583 " stroke="none" fill-rule="evenodd" fill="currentColor"/></svg>';
          const mk=(r,svg,tip)=>{ const b=document.createElement("button"); b.className="fbtn"; b.innerHTML=svg; b.title=tip;
            b.onclick=()=>{ fb.querySelectorAll(".fbtn").forEach(x=>x.classList.remove("on")); b.classList.add("on");
              vscode.postMessage({type:"cx-feedback", rating:r}); };
            return b; };
          fb.appendChild(mk(1,UP,"Good response")); fb.appendChild(mk(2,DN,"Bad response"));
          node.appendChild(fb); }
        fb.title=m.text; }
    } else if(m.type==="insert-input"){ inputEl.value=(inputEl.value?inputEl.value+"\\n":"")+m.text; autoGrow(); inputEl.focus(); }
    else if(m.type==="error"){ addMsg("assistant","⚠ "+m.text); setBusy(false); }
    else if(m.type==="transcribed"){ if(m.text){ inputEl.value=(inputEl.value?inputEl.value+" ":"")+m.text; inputEl.dispatchEvent(new Event("input")); inputEl.focus(); } }
    else if(m.type==="record-state"){ if(window.__setRecordState) window.__setRecordState(!!m.on); }
  });

  renderAgents(); vscode.postMessage({type:"ready"}); vscode.postMessage({type:"sessions-list"});
</script></body></html>`;
  }
}

function register(context, log, opts) {
  // opts.ns: 命名空间(默认 "dao") —— 供 dao-ai-base 被多个领域插件 vendor 时隔离视图/命令 id。
  const ns = (opts && opts.ns) || "dao";
  const viewId = ns + ".cascade";
  const provider = new CascadePanelProvider(context, log, viewId);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(viewId, provider, {
      webviewOptions: { retainContextWhenHidden: true },
    })
  );
  // 官方式底部状态栏(账号/引擎/模型态与面板同源同步)
  try { provider._sb = require("./status-bar").createStatusBar(context, viewId); } catch (_) {}
  // 官方把 Cascade 面板默认放右侧辅助栏 —— 首次安装对齐官方布局(仅一次, 此后尊重用户拖动)。
  // Devin Desktop/Windsurf: 内建 vscode.moveViews 迁入官方原生 Cascade 容器(windsurf.cascadeViewContainerId, 常驻辅助栏)。
  // 标准 VS Code 无该容器(moveViews 对不存在容器静默无效), 迁入辅助栏常驻的 chat 容器(workbench.panel.chat)。
  // 先迁移后聚焦: moveViews 只需视图描述符(无需先创建 webview); 若先 focus 再迁移,
  // webview 会在主侧栏解析到一半被重挂到新容器, 首装呈空白面板直至 Reload Window。
  const MOVED_KEY = viewId + ".movedToAuxBar.v4";
  if (!context.globalState.get(MOVED_KEY)) {
    context.globalState.update(MOVED_KEY, true);
    const isWindsurfHost = /windsurf|devin/i.test(String(vscode.env.appName || ""));
    const destinationId = isWindsurfHost ? "windsurf.cascadeViewContainerId" : "workbench.panel.chat";
    vscode.commands.executeCommand("vscode.moveViews", { viewIds: [viewId], destinationId }).then(
      () => vscode.commands.executeCommand(viewId + ".focus").then(undefined, () => {}),
      () => vscode.commands.executeCommand(viewId + ".focus").then(undefined, () => {})
    );
  }
  // 视图 id 为 <ns>.cascade 时, 工作台自动生成 "<ns>.cascade.focus"; 新版 VS Code 还会
  // 自动生成 "<ns>.cascade.open"(语义同 focus) —— 已存在时不可重复注册。
  vscode.commands.getCommands(true).then((cmds) => {
    if (!cmds.includes(viewId + ".open"))
      context.subscriptions.push(
        vscode.commands.registerCommand(viewId + ".open", () =>
          vscode.commands.executeCommand(viewId + ".focus").then(undefined, () => {})
        )
      );
  }, () => {});
  // 聚焦面板后投递 ui-action(webview 未就绪时聚焦即会挂载, 短暂延迟后必达)
  const _uiAction = async (act) => {
    try { await vscode.commands.executeCommand(viewId + ".focus"); } catch (_) {}
    setTimeout(() => provider._post({ type: "ui-action", act }), 120);
  };
  context.subscriptions.push(
    vscode.commands.registerCommand(viewId + ".newSession", () => provider._handleSessionNew()),
    // 官方快捷命令对位(devin.cascade.toggleModelSelector/switchToNextModel/…): 聚焦面板后投递 ui-action
    vscode.commands.registerCommand(viewId + ".toggleModelSelector", () => _uiAction("toggleModel")),
    vscode.commands.registerCommand(viewId + ".switchToNextModel", () => _uiAction("nextModel")),
    vscode.commands.registerCommand(viewId + ".toggleWriteChatMode", () => _uiAction("toggleMode")),
    vscode.commands.registerCommand(viewId + ".openAgentPicker", () => _uiAction("agentPicker")),
    vscode.commands.registerCommand(viewId + ".backupAll", () => provider._autoBackup(true)),
    vscode.commands.registerCommand(viewId + ".history", () => provider.showHistory()),
    vscode.commands.registerCommand(viewId + ".deepwiki", () => provider.deepwikiFromEditor()),
    // 官方式 Send problems to Cascade: 汇集诊断(当前文件优先, 无则全工作区) → @mention 式塗入 composer
    vscode.commands.registerCommand(viewId + ".sendProblems", async () => {
      const fmt = (uri, ds) => ds.map((d) => {
        const sev = ["错误", "警告", "信息", "提示"][d.severity] || "问题";
        return "- @" + vscode.workspace.asRelativePath(uri) + ":" + (d.range.start.line + 1) +
          " [" + sev + (d.source ? "·" + d.source : "") + "] " + d.message.split("\n")[0];
      });
      const ed = vscode.window.activeTextEditor;
      let lines = [];
      if (ed) lines = fmt(ed.document.uri, vscode.languages.getDiagnostics(ed.document.uri));
      if (!lines.length) for (const [uri, ds] of vscode.languages.getDiagnostics()) { lines.push(...fmt(uri, ds)); if (lines.length >= 30) break; }
      if (!lines.length) return void vscode.window.showInformationMessage("问题面板当前没有诊断");
      await vscode.commands.executeCommand(viewId + ".focus").then(undefined, () => {});
      provider._post({ type: "insert-input", text: "请分析并修复以下问题:\n" + lines.slice(0, 30).join("\n") });
    }),
    // 官方式 Explain and Fix: 选中出错代码 → 带文件@定位与该处诊断塗入 composer
    vscode.commands.registerCommand(viewId + ".explainFix", async () => {
      const ed = vscode.window.activeTextEditor;
      if (!ed) return void vscode.window.showInformationMessage("先在编辑器中选中出错的代码");
      const sel = ed.selection.isEmpty ? (ed.document.getWordRangeAtPosition(ed.selection.active) || ed.selection) : ed.selection;
      const ds = vscode.languages.getDiagnostics(ed.document.uri).filter((d) => d.range.intersection(sel) || d.range.contains(sel.start));
      const rel = vscode.workspace.asRelativePath(ed.document.uri);
      const code = ed.document.getText(sel).slice(0, 2000);
      let text = "解释并修复 @" + rel + ":" + (sel.start.line + 1) + " 处的问题:\n```\n" + code + "\n```";
      if (ds.length) text += "\n诊断:\n" + ds.slice(0, 5).map((d) => "- " + d.message.split("\n")[0]).join("\n");
      await vscode.commands.executeCommand(viewId + ".focus").then(undefined, () => {});
      provider._post({ type: "insert-input", text });
    }),
    // 官方命令面同源: Log in / Log Out(复用面板登录编排与 CLI logout)
    vscode.commands.registerCommand(viewId + ".login", async () => {
      await vscode.commands.executeCommand(viewId + ".focus").then(undefined, () => {});
      provider._handleLogin();
    }),
    vscode.commands.registerCommand(viewId + ".logout", async () => {
      try {
        const provision = require("./devin-provision");
        const bin = provision.resolveEngine(context.extensionPath, null);
        if (!bin) throw new Error("未找到 devin 二进制");
        const { execFile } = require("child_process");
        const r = await new Promise((res) =>
          execFile(bin, ["auth", "logout"], { timeout: 20000 }, (err, so, se) =>
            res({ ok: !err, message: String(so || se || (err && err.message) || "").trim() })));
        if (!r.ok) throw new Error(r.message || "auth logout 退出码非 0");
        vscode.window.setStatusBarMessage("已登出 Devin 账号", 4000);
      } catch (e) { vscode.window.showWarningMessage("登出失败: " + e.message); }
    }),
    // 官方 Add Current File to Cascade: 当前文件 @mention 塗入 composer
    vscode.commands.registerCommand(viewId + ".addFile", async () => {
      const ed = vscode.window.activeTextEditor;
      if (!ed) return void vscode.window.showInformationMessage("没有活动编辑器");
      const rel = vscode.workspace.asRelativePath(ed.document.uri);
      await vscode.commands.executeCommand(viewId + ".focus").then(undefined, () => {});
      provider._post({ type: "insert-input", text: "@" + rel + " " });
    }),
    // Windows Agent 接入官方工具层: 把 Dao-Windows-Agent 的 Windows/FreeCAD/KiCad 能力
    // 注册进 mcp_config.json(官方原生工具扩展面), Cascade 三模式与官方工具同层调度。
    vscode.commands.registerCommand(viewId + ".windowsAgent", async () => {
      const wa = require("./windows-agent");
      const st = wa.status();
      const items = [
        { label: "$(plug) 注册 · 本机检出 (stdio bridge.mcp)", act: "local" },
        { label: "$(globe) 注册 · 远端穿透 (serverUrl /mcp + Bearer)", act: "remote" },
      ];
      if (st.registered) items.push({ label: "$(trash) 注销 dao-windows-agent", act: "off" });
      const pick = await vscode.window.showQuickPick(items, {
        placeHolder: st.registered
          ? "已注册(" + st.transport + (st.disabled ? "·已停用" : "") + ") — Windows 工具已在官方工具层"
          : "未注册 — 选择接入通道",
      });
      if (!pick) return;
      let r;
      if (pick.act === "off") r = wa.unregister();
      else if (pick.act === "local") {
        const found = wa.findLocalCheckout();
        const dir = await vscode.window.showInputBox({
          prompt: "Dao-Windows-Agent 检出目录", value: found || "", ignoreFocusOut: true });
        if (dir === undefined) return;
        r = wa.registerLocal({ dir: dir || undefined });
      } else {
        const url = await vscode.window.showInputBox({
          prompt: "穿透公网 URL(如 https://dao-relay.example.com)", ignoreFocusOut: true });
        if (!url) return;
        const token = await vscode.window.showInputBox({
          prompt: "Bearer Token(可空)", password: true, ignoreFocusOut: true });
        if (token === undefined) return;
        r = wa.registerRemote({ url, token: token || undefined });
      }
      if (r && r.ok === false) return void vscode.window.showWarningMessage("Windows Agent: " + r.error);
      // LS 重载 MCP 配置, 工具即刻并入官方层
      try { const ls = require("./ls-bridge"); if (ls.ready()) await ls.call("RefreshMcpServers", {}); } catch (_) {}
      vscode.window.setStatusBarMessage("Windows Agent 工具层已" + (pick.act === "off" ? "注销" : "注册并刷新"), 4000);
    }),
    // ⚡ PCB 快速面板: KiCad/嘉立创EDA 各模块直开(每选一次 = 一个独立实例) + dao-pcb 工具层注册。
    // web 模块经站内代理路由进 IDE 独立页(与内置浏览器同技术); app 模块拉起独立本机编辑器进程。
    vscode.commands.registerCommand(viewId + ".pcbAgent", async () => {
      const pa = require("./pcb-agent");
      const pc = require("./pcb-panel-core");
      const st = pa.status();
      const items = pc.modules().map((m) => ({
        label: m.icon + " " + m.name,
        description: m.kind === "web" ? "IDE 内网页实例" : "本机编辑器实例",
        act: "open", mod: m,
      }));
      items.push({ label: "$(plug) 注册 dao-pcb 工具层 · 本机检出 (stdio pcb_mcp.py)", act: "local" });
      items.push({ label: "$(globe) 注册 dao-pcb 工具层 · 远端穿透 (serverUrl /mcp + Bearer)", act: "remote" });
      if (st.registered) items.push({ label: "$(trash) 注销 dao-pcb", act: "off" });
      const pick = await vscode.window.showQuickPick(items, {
        placeHolder: st.registered
          ? "dao-pcb 已注册(" + st.transport + (st.disabled ? "·已停用" : "") + ") — 选模块直开或管理工具层"
          : "选 KiCad/嘉立创EDA 模块直开; 或注册 dao-pcb 工具层",
      });
      if (!pick) return;
      if (pick.act === "open") {
        const m = pick.mod;
        if (m.kind === "app") {
          const r = pc.openApp(m.exe);
          if (!r.ok) vscode.window.showWarningMessage(r.error);
          return;
        }
        try {
          const localApi = require("./local-api");
          if (!localApi.running()) await localApi.start(0);
          const src = "http://127.0.0.1:" + localApi.port() + "/web?t=" + encodeURIComponent(localApi.token()) + "&u=" + encodeURIComponent(m.url);
          const p = vscode.window.createWebviewPanel("dao.pcb.module", m.icon + " " + m.name,
            vscode.ViewColumn.Active, { enableScripts: true, retainContextWhenHidden: true });
          p.webview.html = '<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;height:100%;overflow:hidden}iframe{border:0;width:100%;height:100vh}</style></head><body>' +
            '<iframe src="' + src.replace(/"/g, "&quot;") + '" sandbox="allow-scripts allow-forms allow-same-origin allow-popups"></iframe></body></html>';
        } catch (e) { vscode.window.showWarningMessage("开模块失败: " + e.message); }
        return;
      }
      let r;
      if (pick.act === "off") r = pa.unregister();
      else if (pick.act === "local") {
        const found = pa.findLocalCheckout();
        const dir = await vscode.window.showInputBox({
          prompt: "Dao-PCB-Design-Agent 检出目录", value: found || "", ignoreFocusOut: true });
        if (dir === undefined) return;
        r = pa.registerLocal({ dir: dir || undefined });
      } else {
        const url = await vscode.window.showInputBox({
          prompt: "穿透公网 URL(如 https://dao-relay.example.com)", ignoreFocusOut: true });
        if (!url) return;
        const token = await vscode.window.showInputBox({
          prompt: "Bearer Token(可空)", password: true, ignoreFocusOut: true });
        if (token === undefined) return;
        r = pa.registerRemote({ url, token: token || undefined });
      }
      if (r && r.ok === false) return void vscode.window.showWarningMessage("PCB Agent: " + r.error);
      try { const ls = require("./ls-bridge"); if (ls.ready()) await ls.call("RefreshMcpServers", {}); } catch (_) {}
      vscode.window.setStatusBarMessage("dao-pcb 工具层已" + (pick.act === "off" ? "注销" : "注册并刷新"), 4000);
    }),
    // 🧊 FreeCAD 快速面板: 归一外壳各网页模块直开(每选一次 = 一个独立实例) + dao-freecad 工具层注册。
    // web 模块为本机归一外壳网页(iframe 直嵌); app 模块拉起独立本机 FreeCAD 进程。
    vscode.commands.registerCommand(viewId + ".fcAgent", async () => {
      const fa = require("./fc-agent");
      const fc = require("./fc-panel-core");
      const st = fa.status();
      const items = fc.modules().map((m) => ({
        label: m.icon + " " + m.name,
        description: m.kind === "web" ? "IDE 内网页实例" : "本机客户端实例",
        act: "open", mod: m,
      }));
      items.push({ label: "$(plug) 注册 dao-freecad 工具层 · 本机检出 (stdio cad_agent.mcp_server)", act: "local" });
      items.push({ label: "$(globe) 注册 dao-freecad 工具层 · 远端穿透 (serverUrl /mcp + Bearer)", act: "remote" });
      if (st.registered) items.push({ label: "$(trash) 注销 dao-freecad", act: "off" });
      const pick = await vscode.window.showQuickPick(items, {
        placeHolder: st.registered
          ? "dao-freecad 已注册(" + st.transport + (st.disabled ? "·已停用" : "") + ") — 选模块直开或管理工具层"
          : "选 FreeCAD 模块直开; 或注册 dao-freecad 工具层",
      });
      if (!pick) return;
      if (pick.act === "open") {
        const m = pick.mod;
        if (m.kind === "app") {
          const r = fc.openApp(m.exe);
          if (!r.ok) vscode.window.showWarningMessage(r.error);
          return;
        }
        try {
          const p = vscode.window.createWebviewPanel("dao.fc.module", m.icon + " " + m.name,
            vscode.ViewColumn.Active, { enableScripts: true, retainContextWhenHidden: true });
          p.webview.html = '<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;height:100%;overflow:hidden}iframe{border:0;width:100%;height:100vh}</style></head><body>' +
            '<iframe src="' + String(m.url).replace(/"/g, "&quot;") + '" sandbox="allow-scripts allow-forms allow-same-origin allow-popups" allow="clipboard-read; clipboard-write"></iframe></body></html>';
        } catch (e) { vscode.window.showWarningMessage("开模块失败: " + e.message); }
        return;
      }
      let r;
      if (pick.act === "off") r = fa.unregister();
      else if (pick.act === "local") {
        const found = fa.findLocalCheckout();
        const dir = await vscode.window.showInputBox({
          prompt: "Dao-3D-Modeling-Agent 检出目录", value: found || "", ignoreFocusOut: true });
        if (dir === undefined) return;
        r = fa.registerLocal({ dir: dir || undefined });
      } else {
        const url = await vscode.window.showInputBox({
          prompt: "穿透公网 URL(如 https://dao-relay.example.com)", ignoreFocusOut: true });
        if (!url) return;
        const token = await vscode.window.showInputBox({
          prompt: "Bearer Token(可空)", password: true, ignoreFocusOut: true });
        if (token === undefined) return;
        r = fa.registerRemote({ url, token: token || undefined });
      }
      if (r && r.ok === false) return void vscode.window.showWarningMessage("FreeCAD Agent: " + r.error);
      try { const ls = require("./ls-bridge"); if (ls.ready()) await ls.call("RefreshMcpServers", {}); } catch (_) {}
      vscode.window.setStatusBarMessage("dao-freecad 工具层已" + (pick.act === "off" ? "注销" : "注册并刷新"), 4000);
    }),
    // 官方 Create New Rule / Workflow / Global Workflow(CreateCustomizationFile 同源)
    vscode.commands.registerCommand(viewId + ".createRule", () => provider._handleCustomizationCreate("rule")),
    vscode.commands.registerCommand(viewId + ".createWorkflow", () => provider._handleCustomizationCreate("workflow")),
    vscode.commands.registerCommand(viewId + ".createGlobalWorkflow", () => provider._handleCustomizationCreate("gworkflow")),
    // 官方 View Account / Open Changelog
    vscode.commands.registerCommand(viewId + ".openProfile", () =>
      vscode.env.openExternal(vscode.Uri.parse("https://app.devin.ai/settings/profile"))),
    vscode.commands.registerCommand(viewId + ".openChangelog", () =>
      vscode.env.openExternal(vscode.Uri.parse("https://docs.devin.ai/release-notes/overview"))),
    // 官方标题栏头像菜单同源: 账号/套餐/Usage/Billing/Changelog/Sign out 一处总览
    vscode.commands.registerCommand(viewId + ".accountMenu", async () => {
      let name = "", plan = "";
      try {
        const ls = require("./ls-bridge");
        if (ls.ready() && ls.apiKey()) {
          const r = await ls.call("GetUserStatus", {});
          const u = (r && r.userStatus) || {};
          name = u.name || u.email || "";
          plan = ((u.planStatus || {}).planInfo || {}).planName || "";
        }
      } catch (_) {}
      const sep = { label: "", kind: vscode.QuickPickItemKind.Separator };
      const items = [
        { label: name ? "$(account) " + name : "$(account) 未登录", description: plan, _cmd: name ? null : viewId + ".login" },
        sep,
        { label: "$(comment-discussion) 打开 Cascade 面板", _cmd: viewId + ".open" },
        { label: "$(gear) Devin Settings", _cmd: viewId + ".openSettings" },
        { label: "$(book) Customizations", _cmd: viewId + ".customizations" },
        sep,
        { label: "$(graph) Usage", _url: "https://windsurf.com/subscription/usage" },
        { label: "$(credit-card) Billing", _url: "https://windsurf.com/subscription/manage-plan" },
        { label: "$(rocket) Upgrade", _url: "https://windsurf.com/subscription/upgrade" },
        sep,
        { label: "$(person) View Profile", _cmd: viewId + ".openProfile" },
        { label: "$(history) Changelog", _cmd: viewId + ".openChangelog" },
        sep,
        name ? { label: "$(sign-out) Sign out", _cmd: viewId + ".logout" }
             : { label: "$(sign-in) Log in", _cmd: viewId + ".login" },
      ];
      const pick = await vscode.window.showQuickPick(items, { placeHolder: "Devin · 账号菜单(官方头像菜单同源)" });
      if (!pick) return;
      if (pick._cmd) return vscode.commands.executeCommand(pick._cmd);
      if (pick._url) return vscode.env.openExternal(vscode.Uri.parse(pick._url));
    }),
    // 官方 Customizations 页签同源总览
    vscode.commands.registerCommand(viewId + ".customizations", () => provider._customizationsQuickPick()),
    // 官方式提交信息生成: GenerateCommitMessage{repoRootUri} → 写入 SCM 输入框(官方 SCM ✨ 同款)
    vscode.commands.registerCommand(viewId + ".genCommit", async () => {
      try {
        const ls = require("./ls-bridge");
        if (!ls.ready()) throw new Error("官方 language_server 未就绪");
        const ws = (vscode.workspace.workspaceFolders || [])[0];
        if (!ws) throw new Error("无工作区");
        const r = await ls.call("GenerateCommitMessage", { repoRootUri: ws.uri.toString() });
        const text = (r && (r.commitMessage || r.message)) || "";
        if (!text) throw new Error("未生成内容");
        const gitExt = vscode.extensions.getExtension("vscode.git");
        const api = gitExt && gitExt.exports && gitExt.exports.getAPI(1);
        const repo = api && api.repositories && api.repositories[0];
        if (repo) repo.inputBox.value = text;
        else await vscode.env.clipboard.writeText(text);
        vscode.window.setStatusBarMessage("✨ 提交信息已生成" + (repo ? "" : "(已复制到剪贴板)"), 4000);
      } catch (e) { vscode.window.showWarningMessage("生成提交信息失败: " + e.message); }
    })
  );
  return provider;
}

// 官方 Start With History 同位摘要构建器(R187): 无当前轨迹/无可用步骤/RPC 失败均优雅降级为空串。
async function swhContext(ls) {
  try {
    const ds = await ls.call("GetUserTrajectoryDescriptions", {});
    const cur = ((ds.trajectories || []).find((t) => t.current) || {});
    if (!cur.trajectoryId) return "";
    const r = await ls.call("GetUserTrajectory", { trajectoryId: cur.trajectoryId });
    const one = (s) => String(s || "").split("\n")[0].slice(0, 120);
    const rel = (u) => String(u || "").replace(/^file:\/\//, "").split("/").slice(-2).join("/");
    const lines = ((r.trajectory || {}).steps || []).map((s) => {
      const t = (s.type || "").replace("CORTEX_STEP_TYPE_", "");
      if (t === "GIT_COMMIT") return "commit: " + one((s.gitCommit || {}).commitMessage);
      if (t === "USER_INPUT") return "user: " + one((s.userInput || {}).userResponse);
      if (t === "VIEW_FILE") return "viewed: " + rel((s.viewFile || {}).absolutePathUri);
      if (t === "CHECKPOINT") return "intent: " + one((s.checkpoint || {}).userIntent);
      return null;
    }).filter(Boolean).slice(-12);
    if (!lines.length) return "";
    return "<recent_coding_history>\n" + lines.join("\n") + "\n</recent_coding_history>\n\n";
  } catch (_) { return ""; }
}

module.exports = { register, VIEW_ID, AGENTS, swhContext };
