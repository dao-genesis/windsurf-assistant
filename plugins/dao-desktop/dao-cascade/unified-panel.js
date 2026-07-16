// 道 · 归一面板(Devin Desktop 插件本源) —— 插件即一切、插件统领万物。
// ─────────────────────────────────────────────────────────────────────────────
// 把 dao-one 六大板块的核心能力搬进插件本体, 并**深度换源为插件自持真源**:
//   数据不取自 IDE 宿主, 而取自本插件的 host-state(fused/LS 端口·登录态)+ 本机备份树。
// 现落地板块(持续迭代扩充):
//   🏠 主页    — Cascade/Devin Desktop 账号·套餐·配额 + 备份水位 + 本地 MCP 概览(fused 真源)
//   💬 对话备份 — 扫描备份根: Cascade 账号与 Devin Cloud 账号同列, 点开即读转录(双源统一)
//   🧩 MCP     — 插件版完整管理: 明细/工具级+server级开关/重载/添加/配置直开(直连 LS)
//   🔀 切号    — 插件自持账号池(~/.dao/cascade-pool.json): 收录当前号/切换/移除, 无回退铁律
//   🌐 桥接    — 插件自持本地 HTTP API(local-api.js): 只绑 127.0.0.1 + Bearer, 暴露插件真源
//   🐙 GitHub  — 插件自持 GitHub 舰队(github-fleet.js): PAT 池/角色/在线核验, 与 Devin 池分离
//   🔎 搜索    — 插件自持站内网页搜索(web-search.js): DuckDuckGo/Bing 直出结果, 不弹外部浏览器
//   💉 反向注入 — 插件自持注入档案(inject.js): MCP/Secret/Knowledge 批量注入账号池(账号池同真源)
// 归一竟功: dao-one 六大板块 + GitHub 纵向 + Proxy Pro 三面板皆已并入插件本源。
// R65 原生延伸: 把原本依赖 IDE 宿主操作的 Cascade/devin-local 管理也并入板块 ——
//   备份板块增 Cascade 会话管理(列表/重命名/归档/硬删)与记忆管理(双源合并/编辑/删除);
//   主页增本机会话·记忆·Flex 额度水位; MCP 添加升级为注册表优先(兼手填 JSON);
//   Proxy Pro 配路由直选官方模型清单(listModels 真源); GitHub 舰队 PAT 可一键入注入档;
//   桥接新增 /api/cascade 暴露本机会话与记忆水位。
"use strict";
const vscode = require("vscode");
const backup = require("./backup");
const hostStateMod = require("./host-state");
const acctPool = require("./account-pool");
const localApi = require("./local-api");
const ghFleet = require("./github-fleet");
const proxyPro = require("./proxy-pro");
const webSearch = require("./web-search");
const inject = require("./inject");
const mcpConfig = require("./mcp-config");
const windowsAgent = require("./windows-agent");
const winCore = require("./windows-panel-core");

function nonce() { let s = ""; const c = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"; for (let i = 0; i < 24; i++) s += c[Math.floor(Math.random() * c.length)]; return s; }

class UnifiedPanel {
  constructor(log, ctx, opts) {
    this._log = typeof log === "function" ? log : () => {};
    this._view = null; this._board = "overview";
    this._extRoot = (ctx && ctx.extensionUri && ctx.extensionUri.fsPath) || "";
    this._storageDir = (ctx && ctx.globalStorageUri && ctx.globalStorageUri.fsPath) || "";
    this._cascade = (opts && opts.cascade) || null; // Cascade 面板 provider(ACP 客户端宿主)
  }

  resolveWebviewView(view) {
    this._view = view;
    const w = view.webview;
    w.options = { enableScripts: true };
    w.onDidReceiveMessage((m) => this._onMessage(m || {}));
    w.html = this._html(w);
    this._pushState();
    this._refreshFused();
  }

  // 插件自主刷新融合真源(不依赖 Cascade 面板是否打开): LS 就绪即直连拉
  // 账号(GetUserStatus)与 MCP 快照(GetMcpServerStates)并 publishFused → 落盘 + 回推。
  // 三模式引擎态(engines)亦自持探测: 不依赖 Cascade 面板, 主页即有三模式感知。
  async _refreshFused() {
    if (this._fusing) return; this._fusing = true;
    try {
      await this._refreshEngines();
      const ls = require("./ls-bridge");
      if (!ls.ready() || !ls.apiKey()) return;
      try {
        const r = await ls.call("GetUserStatus", {});
        const u = (r && r.userStatus) || {};
        const ps = u.planStatus || {}; const pi = ps.planInfo || {};
        const num = (x) => (typeof x === "number" ? x : (x === undefined || x === null ? null : Number(x)));
        hostStateMod.publishFused("account", { name: u.name || "", email: u.email || "", plan: pi.planName || "",
          dailyQuotaPct: num(ps.dailyQuotaRemainingPercent), weeklyQuotaPct: num(ps.weeklyQuotaRemainingPercent),
          flexCredits: num(ps.availableFlexCredits) });
      } catch (e) { this._log("[unified] fused account: " + e.message); }
      try {
        const r = await ls.call("GetMcpServerStates", {});
        const servers = ((r && r.states) || []).map((s) => ({
          name: (s.spec || {}).serverName || "",
          status: (s.status || "").replace("MCP_SERVER_STATUS_", ""),
          disabled: !!(s.spec || {}).disabled,
          toolCount: (s.tools || []).length }));
        hostStateMod.publishFused("mcp", { servers });
      } catch (e) { this._log("[unified] fused mcp: " + e.message); }
      try {
        const r = await ls.call("GetAllCascadeTrajectories", {});
        const m = (r && r.trajectorySummaries) || {};
        const cids = Object.keys(m);
        hostStateMod.publishFused("cascadeLocal", { total: cids.length,
          live: cids.filter((c) => !m[c].isArchived).length,
          archived: cids.filter((c) => !!m[c].isArchived).length });
      } catch (e) { this._log("[unified] fused cascadeLocal: " + e.message); }
      try {
        const r = (await ls.call("GetCascadeMemories", {})) || {};
        hostStateMod.publishFused("memories", { total: ((r && r.memories) || []).length });
      } catch (e) { this._log("[unified] fused memories: " + e.message); }
    } catch (e) { this._log("[unified] refreshFused: " + e.message); }
    finally { this._fusing = false; }
  }

  // 三模式引擎态自持探测(与 Cascade 面板 _pushEnv 同源同结构):
  //   Cascade = LS 端口/CSRF + 官方登录态; Devin Local = 本机 devin 二进制 + CLI 登录态;
  //   Devin Cloud = CLI 登录态(同一凭据) + 远端 ACP 端点。
  async _refreshEngines() {
    try {
      const { resolveDevinBin } = require("./acp-client");
      const { authStatus } = require("./devin-provision");
      const bin = resolveDevinBin(this._extRoot, this._storageDir);
      const auth = await authStatus(bin);
      const hs = hostStateMod.loadPersisted() || hostStateMod.hostState();
      const ls = require("./ls-bridge");
      const ca = ls.cascadeAuth();
      // 端口活性裁决: 宿主退出后落盘态仍留旧端口, TCP 探活防「陈旧就绪」假象。
      let alive = false;
      try { alive = await ls.probeAlive(); } catch (_) {}
      hostStateMod.publishFused("engines", {
        cascade: { ready: !!(hs.lsPort && hs.csrfToken && alive), lsPort: hs.lsPort || 0,
          signedIn: ca.signedIn, name: ca.name },
        devinLocal: { bin: !!bin, signedIn: !!auth.loggedIn, name: auth.name || "" },
        devinCloud: { signedIn: !!auth.loggedIn, name: auth.name || "",
          endpoint: "wss://app.devin.ai/api/acp/live" },
      });
    } catch (e) { this._log("[unified] refreshEngines: " + e.message); }
  }

  _post(m) { if (this._view) try { this._view.webview.postMessage(m); } catch (_) {} }

  _onMessage(msg) {
    // dao-vsix /shell 同构协议: 前端 cmd('loadTabData',{tab}) → 板块懒加载 → 回 {type:'tabData',tab}。
    if (msg.command === "loadTabData") return this._loadTabData(String(msg.tab || ""));
    if (msg.command === "refresh") { this._refreshFused(); return this._pushState(); }
    switch (msg.type) {
      case "nav": this._board = String(msg.board || "overview"); return this._pushState();
      case "refresh": this._refreshFused(); return this._pushState();
      case "open-conv": return this._openConversation(msg.dir, msg.folder);
      case "backup-now": return this._backupNow();
      case "cx-list": return this._cxList();
      case "cx-rename": return this._cxRename(String(msg.cid || ""));
      case "cx-archive": return this._cxArchive(String(msg.cid || ""), !!msg.on);
      case "cx-delete": return this._cxDelete(String(msg.cid || ""));
      case "mem-list": return this._memList();
      case "mem-edit": return this._memEdit(msg.mem || {});
      case "mem-delete": return this._memDelete(String(msg.id || ""));
      case "conv-manage": return this._convManage(msg);
      case "mcp-detail": return this._mcpDetail();
      case "mcp-refresh": return this._mcpOp("RefreshMcpServers", {});
      case "mcp-toggle": return this._mcpToggle(String(msg.name || ""));
      case "mcp-tool-toggle": return this._mcpToolToggle(String(msg.server || ""), String(msg.tool || ""));
      case "mcp-add": return this._mcpAdd();
      case "mcp-install": return this._mcpInstall(String(msg.name || ""));
      case "mcp-config": return this._mcpConfigOpen();
      case "pool-list": return this._poolList();
      case "pool-capture": return this._poolCapture();
      case "pool-switch": return this._poolSwitch(String(msg.email || ""));
      case "pool-remove": return this._poolRemove(String(msg.email || ""));
      case "bridge-state": return this._bridgeState();
      case "bridge-start": return this._bridgeStart();
      case "bridge-stop": return this._bridgeStop();
      case "bridge-copy-token": return vscode.env.clipboard.writeText(localApi.token()).then(() => vscode.window.showInformationMessage("已复制本地 API token"), () => {});
      case "gh-list": return this._ghList();
      case "gh-add": return this._ghAdd();
      case "gh-remove": return this._ghRemove(String(msg.login || ""));
      case "gh-role": return this._ghRole(String(msg.login || ""), String(msg.role || "member"));
      case "gh-verify": return this._ghVerify();
      case "gh-inject": return this._ghInject(String(msg.login || ""));
      case "ws-search": return this._wsSearch(String(msg.query || ""), String(msg.engine || ""));
      case "ws-open": return vscode.env.openExternal(vscode.Uri.parse(String(msg.url || ""))).then(undefined, () => {});
      case "ws-clear": return this._wsClear();
      case "inj-list": return this._injList();
      case "inj-add": return this._injAdd();
      case "inj-remove": return this._injRemove(String(msg.kind || ""), String(msg.name || ""));
      case "inj-apply-mcp": return this._injApplyMcp();
      case "copy": return vscode.env.clipboard.writeText(String(msg.text || "")).then(undefined, () => {});
      case "set-detail": return this._setDetail();
      case "set-toggle": return this._setToggle(String(msg.key || ""), !!msg.on);
      case "set-changelog": return this._setChangelog();
      case "set-open": return vscode.env.openExternal(vscode.Uri.parse(String(msg.url || ""))).then(undefined, () => {});
      case "acp-registry": return this._acpRegistry();
      case "acp-reload": return this._acpReload();
      case "env-open": return this._envOpen(String(msg.path || ""));
      case "win-state": return this._winState();
      case "win-reg-local": return this._winRegLocal();
      case "win-reg-remote": return this._winRegRemote();
      case "win-unreg": return this._winUnreg();
      case "win-release": return this._winRelease(String(msg.key || ""), String(msg.owner || ""));
      case "win-acct-create": return this._winAcctCreate();
      case "win-acct-destroy": return this._winAcctDestroy(String(msg.name || ""));
      case "win-acct-clone": return this._winAcctClone(String(msg.base || ""));
      case "win-open-desktop": return this._winOpenDesktop(String(msg.account || ""));
      default: return;
    }
  }

  // 板块懒加载统一调度(与 dao-vsix /shell 的 loadTabData/tabData 同构):
  // 先回 tabData 信封声明所载板块, 载荷由各板块既有同构消息紧随其后。
  _loadTabData(tab) {
    this._post({ type: "tabData", tab });
    switch (tab) {
      case "switch": return this._poolList();
      case "bridge": return this._bridgeState();
      case "backups": this._cxList(); return this._memList();
      case "inject": return this._injList();
      case "mcp": return this._mcpDetail();
      case "github": return this._ghList();
      case "overview": this._winState(); return this._pushState();
      case "windows": return this._winState();
      case "settings": return this._setDetail();
      default: return this._pushState();
    }
  }

  // 归一数据快照(插件自持真源): fused + LS 就绪态 + 备份树扫描。
  _snapshot() {
    let hs = {};
    try { hs = hostStateMod.loadPersisted() || hostStateMod.hostState(); } catch (_) { hs = {}; }
    const fused = (hs && hs.fused) || {};
    let alive = null;
    try { alive = require("./ls-bridge").aliveSync(); } catch (_) {}
    const lsReady = !!(hs && hs.lsPort && hs.csrfToken) && alive !== false;
    let backups = { root: "", accounts: [] };
    try { backups = backup.listBackups(); } catch (e) { this._log("[unified] listBackups: " + e.message); }
    let github = null, proxy = null;
    try { const v = ghFleet.listView(); github = { count: v.length, ok: v.filter((a) => a.verify === "ok").length }; } catch (_) {}
    try { const v = proxyPro.listView(); proxy = { channels: v.channels.length, routes: v.routes.length }; } catch (_) {}
    return {
      board: this._board,
      lsReady,
      account: fused.account || null,
      mcp: fused.mcp || null,
      engines: fused.engines || null,
      cascadeBackup: fused.cascadeBackup || null,
      cascadeLocal: fused.cascadeLocal || null,
      memories: fused.memories || null,
      auth: hs.auth || null,
      backups,
      github,
      proxy,
    };
  }

  _pushState() { this._post({ type: "state", data: this._snapshot() }); }

  // ── 🪟 Windows 分身板块(数据核在 windows-panel-core.js, headless 可测) ──
  async _winState() {
    try { this._post({ type: "win-state", data: await winCore.probe() }); }
    catch (e) { this._post({ type: "win-state", error: e.message }); }
  }

  async _winRegLocal() {
    const r = windowsAgent.registerLocal({});
    if (!r.ok) vscode.window.showWarningMessage("Windows Agent 注册失败: " + r.error);
    else vscode.window.showInformationMessage("已注册 dao-windows-agent(local) → " + r.configPath);
    return this._winState();
  }

  async _winRegRemote() {
    const url = await vscode.window.showInputBox({ prompt: "DAO Bridge 穿透公网地址(自动补 /mcp)", placeHolder: "https://…" });
    if (!url) return;
    const token = await vscode.window.showInputBox({ prompt: "Bearer token(可空)", password: true });
    const r = windowsAgent.registerRemote({ url, token });
    if (!r.ok) vscode.window.showWarningMessage("注册失败: " + r.error);
    else vscode.window.showInformationMessage("已注册 dao-windows-agent(remote)");
    return this._winState();
  }

  async _winUnreg() {
    windowsAgent.unregister();
    return this._winState();
  }

  async _winRelease(key, owner) {
    const r = await winCore.releaseLease(key, owner);
    if (r && r.error) vscode.window.showWarningMessage("释放失败: " + r.error);
    return this._winState();
  }

  // Windows 总控 · 账号建/销(桥 /api/account.* 同一真源)与开桌面(委派 dao-windows-agent 插件)。
  async _winAcctCreate() {
    const name = await vscode.window.showInputBox({ prompt: "新建 Windows 账号名", validateInput: (v) => /^[A-Za-z0-9][A-Za-z0-9._-]{0,19}$/.test(v || "") ? null : "限字母数字与 . _ -，≤ 20" });
    if (!name) return;
    const r = await winCore.accountCreate(name);
    if (r && r.ok) vscode.window.showInformationMessage("Windows 账号已建: " + name);
    else vscode.window.showErrorMessage("建号失败: " + ((r && r.error) || "未知"));
    return this._winState();
  }

  // 复制分身: 以既有账号为基底再建一路独立桌面账号(同源 /api/account.create)。
  async _winAcctClone(base) {
    if (!base) return;
    const name = await vscode.window.showInputBox({ prompt: "复制分身: 新账号名(与 " + base + " 各自独立桌面会话, 互不相扰)", value: base + "-2", validateInput: (v) => /^[A-Za-z0-9][A-Za-z0-9._-]{0,19}$/.test(v || "") ? null : "限字母数字与 . _ -，≤ 20" });
    if (!name) return;
    const r = await winCore.accountCreate(name);
    if (r && r.ok) vscode.window.showInformationMessage("分身已复制: " + base + " → " + name);
    else vscode.window.showErrorMessage("复制失败: " + ((r && r.error) || "未知"));
    return this._winState();
  }

  async _winAcctDestroy(name) {
    if (!name) return;
    const pick = await vscode.window.showWarningMessage("销毁 Windows 账号 " + name + "? 其独立桌面会话与 profile 一并清除", { modal: true }, "销毁");
    if (pick !== "销毁") return;
    const r = await winCore.accountDestroy(name);
    if (r && r.ok) vscode.window.showInformationMessage("Windows 账号已销毁: " + name);
    else vscode.window.showErrorMessage("销号失败: " + ((r && r.error) || "未知"));
    return this._winState();
  }

  async _winOpenDesktop(account) {
    // 桌面渲染(RDP/guacamole canvas)由 dao-windows-agent 插件承载; 归一主页只做总控入口。
    try {
      await vscode.commands.executeCommand(account ? "daoWin.openAccountDesktop" : "daoWin.openDesktop");
    } catch (e) {
      vscode.window.showWarningMessage("打开桌面需安装 dao-windows-agent 插件(桌面级路由): " + e.message);
    }
  }

  _openConversation(dir, folder) {
    try {
      const c = backup.readConversation(undefined, dir, folder);
      this._post({ type: "conv", dir, folder, meta: c.meta, md: c.md, path: c.path });
    } catch (e) { this._post({ type: "conv-error", error: e.message }); }
  }

  // Cascade 会话管理(本机原生, 并入备份板块): 直连 LS 轨迹真源 ——
  // 列表(GetAllCascadeTrajectories)/重命名(Rename)/归档·取消归档(Archive)/硬删(Delete)。
  async _cxList() {
    try {
      const ls = require("./ls-bridge");
      const r = await ls.call("GetAllCascadeTrajectories", {});
      const m = (r && r.trajectorySummaries) || {};
      const sessions = Object.keys(m).map((cid) => ({
        cid,
        title: m[cid].summary || cid,
        updatedAt: m[cid].lastModifiedTime || "",
        archived: !!m[cid].isArchived,
        workspace: (((m[cid].workspaces || [])[0] || {}).workspaceFolderAbsoluteUri) || "",
      })).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
      this._post({ type: "cx-list", sessions });
      hostStateMod.publishFused("cascadeLocal", { total: sessions.length,
        live: sessions.filter((s) => !s.archived).length,
        archived: sessions.filter((s) => s.archived).length });
    } catch (e) { this._post({ type: "cx-list", sessions: null, error: e.message }); }
  }

  async _cxRename(cid) {
    if (!cid) return;
    const name = await vscode.window.showInputBox({ prompt: "重命名 Cascade 会话", placeHolder: "新会话名" });
    if (name == null || !name.trim()) return;
    try { await require("./ls-bridge").call("RenameCascadeTrajectory", { cascadeId: cid, name: name.trim() }); }
    catch (e) { vscode.window.showErrorMessage("重命名失败: " + e.message); }
    this._cxList();
  }

  async _cxArchive(cid, on) {
    if (!cid) return;
    try { await require("./ls-bridge").call("ArchiveCascadeTrajectory", { cascadeId: cid, isArchived: !!on }); }
    catch (e) { vscode.window.showErrorMessage((on ? "归档" : "取消归档") + "失败: " + e.message); }
    this._cxList();
  }

  async _cxDelete(cid) {
    if (!cid) return;
    const ok = await vscode.window.showWarningMessage("硬删该 Cascade 会话轨迹? 不可恢复(已有备份不受影响)", { modal: true }, "删除");
    if (ok !== "删除") return;
    try { await require("./ls-bridge").call("DeleteCascadeTrajectory", { cascadeId: cid }); }
    catch (e) { vscode.window.showErrorMessage("删除失败: " + e.message); }
    this._cxList();
  }

  // Cascade 记忆管理(并入备份板块): 账号级 GetUserMemories 与工作区级 GetCascadeMemories
  // 双源合并(按 id 去重), 编辑(Update)/删除(Delete)与官方 Memories 页同构。
  async _memList() {
    try {
      const ls = require("./ls-bridge");
      const r = (await ls.call("GetCascadeMemories", {})) || {};
      try {
        const um = await ls.call("GetUserMemories", {});
        const seen = new Set(((r && r.memories) || []).map((m) => m.id));
        for (const m of (um && um.memories) || []) if (!seen.has(m.id)) (r.memories = r.memories || []).push(m);
      } catch (_) {}
      const memories = ((r && r.memories) || []).map((m) => ({
        id: m.memoryId, title: m.title || "",
        content: ((m.textMemory || {}).content) || "",
        tags: ((m.metadata || {}).tags) || [] }));
      this._post({ type: "mem-list", memories });
      hostStateMod.publishFused("memories", { total: memories.length });
    } catch (e) { this._post({ type: "mem-list", memories: null, error: e.message }); }
  }

  async _memEdit(m) {
    if (!m || !m.id) return;
    const content = await vscode.window.showInputBox({ prompt: "编辑记忆内容", value: m.content || "" });
    if (content == null) return;
    try { await require("./ls-bridge").call("UpdateCascadeMemory", { memoryId: m.id, title: m.title || "", content, tags: m.tags || [] }); }
    catch (e) { vscode.window.showErrorMessage("更新记忆失败: " + e.message); }
    this._memList();
  }

  async _memDelete(id) {
    if (!id) return;
    try { await require("./ls-bridge").call("DeleteCascadeMemory", { memoryId: id }); }
    catch (e) { vscode.window.showErrorMessage("删除记忆失败: " + e.message); }
    this._memList();
  }

  // Cascade 轨迹管理(备份板块延伸): 重命名/归档/取消归档/删除 —— LS 官方 RPC + 本地备份树同步。
  async _convManage(msg) {
    const op = String(msg.op || "");
    const opts = { accDir: String(msg.dir || ""), folder: String(msg.folder || ""), cascadeId: String(msg.cascadeId || ""), op, source: String(msg.source || "") };
    try {
      if (op === "rename") {
        const name = await vscode.window.showInputBox({ prompt: "重命名会话", value: String(msg.title || "") });
        if (name == null || !name.trim()) return;
        opts.name = name.trim();
      }
      if (op === "delete") {
        const pick = await vscode.window.showWarningMessage("删除该 Cascade 会话及其本地备份?", { modal: true }, "删除");
        if (pick !== "删除") return;
      }
      const ls = require("./ls-bridge");
      const r = await backup.manageTrajectory(ls, opts);
      if (!r.ok) vscode.window.showErrorMessage("会话管理失败: " + (r.error || op));
    } catch (e) { vscode.window.showErrorMessage("会话管理失败: " + e.message); }
    this._pushState();
  }

  // MCP 完整管理(插件版直连 LS): 明细(含工具/prompts/错误) + server 级开关 + 工具级开关 + 重载 + 添加 + 配置直开。
  // 开关直写配置真源 mcp_config.json(三模式同一份配置), 再 RefreshMcpServers 令 LS 重载。
  async _mcpToggle(name) {
    const r = mcpConfig.toggleServer(name);
    if (!r.ok) { vscode.window.showErrorMessage("MCP 开关失败: " + r.error); return this._mcpDetail(); }
    return this._mcpOp("RefreshMcpServers", {});
  }

  async _mcpToolToggle(server, tool) {
    const r = mcpConfig.toggleTool(server, tool);
    if (!r.ok) {
      // 配置无此 server(如内建)时回退官方 RPC
      return this._mcpOp("ToggleMcpTool", { serverId: server, toolName: tool });
    }
    return this._mcpOp("RefreshMcpServers", {});
  }

  async _mcpDetail() {
    try {
      const ls = require("./ls-bridge");
      const [r, reg] = await Promise.all([
        ls.call("GetMcpServerStates", {}),
        ls.call("GetMcpRegistryServers", {}).catch(() => null),
      ]);
      const servers = mcpConfig.mergedServers((r && r.states) || []);
      const installed = new Set(servers.map((s) => s.name));
      this._mcpRegistry = ((reg && reg.servers) || []);
      const registry = this._mcpRegistry.map((s) => {
        const id = (s.name || "").replace(/^devin\//, "") || s.title || "";
        return { id, title: s.title || id, description: s.description || "",
          installed: installed.has(id),
          how: (s.packages || []).length ? "pkg" : ((s.remotes || []).length ? "remote" : "") };
      });
      this._post({ type: "mcp-detail", servers, registry });
      hostStateMod.publishFused("mcp", { servers: servers.map((s) => ({ name: s.name, status: s.status, disabled: s.disabled, toolCount: s.tools.length })) });
    } catch (e) { this._post({ type: "mcp-detail", servers: null, error: e.message }); }
  }

  async _mcpOp(method, req) {
    try { const ls = require("./ls-bridge"); await ls.call(method, req); }
    catch (e) { this._log("[unified] " + method + ": " + e.message); }
    setTimeout(() => this._mcpDetail(), 1200);
  }

  // 添加升级为注册表优先(GetMcpRegistryServers 自动生成配置模板+必填环境变量), 兑底手填 JSON。
  async _mcpAdd() {
    try {
      const ls = require("./ls-bridge");
      let picks = [{ label: "＋ 手动输入 JSON…", srv: null }];
      try {
        const reg = await ls.call("GetMcpRegistryServers", {});
        picks = picks.concat(((reg && reg.servers) || []).map((s) => ({
          label: s.title || s.name, description: (s.name || "").replace(/^devin\//, ""), detail: s.description || "", srv: s })));
      } catch (_) {}
      const pick = await vscode.window.showQuickPick(picks, { placeHolder: "添加 MCP server(注册表或手动)", matchOnDescription: true, matchOnDetail: true });
      if (!pick) return;
      let id, tplObj;
      if (pick.srv) {
        return this._mcpInstallSrv(pick.srv);
      } else {
        id = await vscode.window.showInputBox({ prompt: "MCP server 名称(写入 mcp_config.json 的键)" });
        if (!id) return;
        const tpl = await vscode.window.showInputBox({
          prompt: 'server 配置 JSON(如 {"command":"npx","args":[...]} 或 {"serverUrl":...})',
          value: '{"command":"","args":[]}' });
        if (!tpl) return;
        try { tplObj = JSON.parse(tpl); } catch (e) { vscode.window.showErrorMessage("JSON 无效: " + e.message); return; }
      }
      await ls.call("SaveMcpServerToConfigFile", { serverId: id, templateJson: JSON.stringify(tplObj) });
      await ls.call("RefreshMcpServers", {});
      setTimeout(() => this._mcpDetail(), 1500);
    } catch (e) { vscode.window.showErrorMessage("添加 MCP 失败: " + e.message); }
  }

  // Marketplace 一键安装(官方注册表同源): packages → 命令模板(必填 env 逐项询问), remotes → serverUrl。
  async _mcpInstall(name) {
    let srv = (this._mcpRegistry || []).find((s) => ((s.name || "").replace(/^devin\//, "") || s.title) === name);
    if (!srv) {
      try {
        const ls = require("./ls-bridge");
        const reg = await ls.call("GetMcpRegistryServers", {});
        this._mcpRegistry = ((reg && reg.servers) || []);
        srv = this._mcpRegistry.find((s) => ((s.name || "").replace(/^devin\//, "") || s.title) === name);
      } catch (_) {}
    }
    if (!srv) { vscode.window.showErrorMessage("注册表中无此 server: " + name); return; }
    return this._mcpInstallSrv(srv);
  }

  async _mcpInstallSrv(s) {
    try {
      const ls = require("./ls-bridge");
      const id = (s.name || "").replace(/^devin\//, "") || s.title;
      const pkg = (s.packages || [])[0];
      const remote = (s.remotes || [])[0];
      let tplObj;
      if (pkg) {
        tplObj = { command: pkg.runtimeHint || "npx", args: pkg.runtimeHint === "npx" ? ["-y", pkg.identifier] : [pkg.identifier], env: {} };
        for (const ev of pkg.environmentVariables || []) {
          if (!ev.isRequired) continue;
          const v = await vscode.window.showInputBox({ prompt: id + " 需要 " + ev.name + "(" + (ev.description || "") + ")", password: !!ev.isSecret, ignoreFocusOut: true });
          if (v === undefined) return;
          tplObj.env[ev.name] = v;
        }
        if (!Object.keys(tplObj.env).length) delete tplObj.env;
      } else if (remote) {
        tplObj = { serverUrl: remote.url };
      } else { vscode.window.showErrorMessage("该注册表项无可用安装方式"); return; }
      await ls.call("SaveMcpServerToConfigFile", { serverId: id, templateJson: JSON.stringify(tplObj) });
      await ls.call("RefreshMcpServers", {});
      setTimeout(() => this._mcpDetail(), 1500);
    } catch (e) { vscode.window.showErrorMessage("安装 MCP 失败: " + e.message); }
  }

  _mcpConfigOpen() {
    const os = require("os"); const path = require("path");
    const p = path.join(os.homedir(), ".codeium", "windsurf", "mcp_config.json");
    vscode.workspace.openTextDocument(p).then((d) => vscode.window.showTextDocument(d), () => {});
  }

  // 桥接板块(插件自持本地 API): token 不入 webview, 只回尾4位指纹。
  _bridgeState() {
    const t = localApi.token();
    this._post({ type: "bridge-state", running: localApi.running(), port: localApi.port(),
      tokenTail: t ? t.slice(-4) : "", stateFile: localApi.statePath() });
  }

  async _bridgeStart() {
    try { await localApi.start(0); } catch (e) { vscode.window.showErrorMessage("本地 API 启动失败: " + e.message); }
    this._bridgeState();
  }

  async _bridgeStop() {
    try { await localApi.stop(); } catch (_) {}
    this._bridgeState();
  }

  // GitHub 板块(插件自持舰队): PAT 绝不入 webview, 只回尾4位指纹。
  _ghList() { this._post({ type: "gh-list", accounts: ghFleet.listView(), file: ghFleet.fleetPath() }); }

  async _ghAdd() {
    try {
      const pat = await vscode.window.showInputBox({ prompt: "GitHub PAT(可附 login, 格式: login:PAT 或纯 PAT)", password: true, ignoreFocusOut: true });
      if (!pat) return;
      let login = "", p = pat.trim();
      const i = p.indexOf(":");
      if (i > 0 && !/^gh[pousr]_/.test(p)) { login = p.slice(0, i).trim(); p = p.slice(i + 1).trim(); }
      const r = await ghFleet.addAccount(p, login, "member");
      vscode.window.showInformationMessage("已入队 " + r.login + (r.pending ? "(待网络恢复再核)" : "") + " · 舰队 " + r.count + " 号");
    } catch (e) { vscode.window.showErrorMessage("入队失败: " + e.message); }
    this._ghList();
  }

  _ghRemove(login) {
    try { ghFleet.remove(login); } catch (e) { vscode.window.showErrorMessage(e.message); }
    this._ghList();
  }

  _ghRole(login, role) {
    try { ghFleet.setRole(login, role); } catch (e) { vscode.window.showErrorMessage(e.message); }
    this._ghList();
  }

  async _ghVerify() {
    try {
      const r = await ghFleet.verifyAll();
      vscode.window.showInformationMessage("核验完成: " + r.map((x) => x.login + "=" + x.state).join(", "));
    } catch (e) { vscode.window.showErrorMessage("核验失败: " + e.message); }
    this._ghList();
  }

  // GitHub → 反向注入打通: 舰队号的 PAT 一键入注入档(secret, 脱敏存储),
  // 成为全账号池应注资源; 值只在后端档案文件间流转, 绝不入 webview。
  _ghInject(login) {
    try {
      const a = ghFleet.loadFleet().find((x) => x.login.toLowerCase() === String(login).toLowerCase());
      if (!a || !a.pat) throw new Error("舰队无此号或无 PAT: " + login);
      const r = inject.addItem("secret", "github-pat-" + a.login, { value: a.pat });
      vscode.window.showInformationMessage("已把 " + a.login + " 的 PAT 入注入档(脱敏存储) · 档案 " + r.count + " 项");
    } catch (e) { vscode.window.showErrorMessage("入档失败: " + e.message); }
    this._ghList();
  }

  // 搜索板块(插件自持站内网页搜索)。
  async _wsSearch(query, engine) {
    this._post({ type: "ws-progress", running: true });
    try { const r = await webSearch.search(query, engine); this._post({ type: "ws-result", data: r, history: webSearch.historyView() }); }
    catch (e) { this._post({ type: "ws-result", data: { ok: false, query, results: [], error: e.message }, history: webSearch.historyView() }); }
  }

  _wsClear() { try { webSearch.clearHistory(); } catch (_) {} this._post({ type: "ws-result", data: null, history: [] }); }

  // 反向注入板块(插件自持注入档案): secret 值永不出后端。
  _injList() {
    let pool = [];
    try { const ls = require("./ls-bridge"); pool = acctPool.listView(ls.apiKey()); } catch (_) {}
    this._post({ type: "inj-list", items: inject.listView(), plan: inject.plan(pool), file: inject.profilePath() });
  }

  async _injAdd() {
    try {
      const kind = await vscode.window.showQuickPick(
        [{ label: "mcp", description: "MCP 服务器(可即刻本机落地)" }, { label: "secret", description: "密钥(脱敏存储)" }, { label: "knowledge", description: "知识片段" }],
        { placeHolder: "注入档类型" });
      if (!kind) return;
      const name = await vscode.window.showInputBox({ prompt: kind.label + " 档名称" });
      if (!name) return;
      let spec = {};
      if (kind.label === "mcp") {
        const tpl = await vscode.window.showInputBox({ prompt: 'MCP 配置 JSON(如 {"command":"npx","args":[...]} 或 {"serverUrl":...})', value: '{"command":"","args":[]}' });
        if (!tpl) return;
        try { spec = JSON.parse(tpl); } catch (e) { vscode.window.showErrorMessage("JSON 无效: " + e.message); return; }
      } else if (kind.label === "secret") {
        const val = await vscode.window.showInputBox({ prompt: "密钥值", password: true, ignoreFocusOut: true });
        if (!val) return; spec = { value: val };
      } else {
        const content = await vscode.window.showInputBox({ prompt: "知识内容(文本)" });
        if (!content) return; spec = { content };
      }
      const r = inject.addItem(kind.label, name, spec);
      vscode.window.showInformationMessage("已入档 " + r.kind + "/" + r.name + " · 档案 " + r.count + " 项");
    } catch (e) { vscode.window.showErrorMessage("入档失败: " + e.message); }
    this._injList();
  }

  _injRemove(kind, name) { try { inject.removeItem(kind, name); } catch (e) { vscode.window.showErrorMessage(e.message); } this._injList(); }

  async _injApplyMcp() {
    try {
      const ls = require("./ls-bridge");
      if (!ls.ready()) { vscode.window.showWarningMessage("LS 未就绪, 无法落地 MCP; 打开 Cascade 面板登录后重试"); return; }
      const r = await inject.applyMcp(ls);
      vscode.window.showInformationMessage("MCP 注入本机: " + r.applied + "/" + r.total + " 已写入 Cascade 配置");
    } catch (e) { vscode.window.showErrorMessage("MCP 落地失败: " + e.message); }
    this._injList();
  }

  // 切号板块(插件自持账号池): key 永不出后端, 只回尾4位指纹; 目标号无 key 即报错不回退。
  _poolList() {
    try {
      const ls = require("./ls-bridge");
      this._post({ type: "pool-list", accounts: acctPool.listView(ls.apiKey()) });
    } catch (e) { this._post({ type: "pool-list", accounts: [], error: e.message }); }
  }

  // 收录必取活体身份: 现场 GetUserStatus 拿当前 key 的真实账号, 绝不信落盘 fused
  // 旧账号残影(否则换号后收录会把新 key 记到旧邮箱名下, 跨号污染)。
  async _poolCapture() {
    try {
      const ls = require("./ls-bridge");
      const r0 = await ls.call("GetUserStatus", {});
      const u = (r0 && r0.userStatus) || {};
      if (!u.email) throw new Error("无法确认当前登录身份(GetUserStatus 无 email), 拒绝盲收");
      const pi = ((u.planStatus || {}).planInfo) || {};
      hostStateMod.publishFused("account", { name: u.name || "", email: u.email, plan: pi.planName || "" });
      const r = acctPool.captureCurrent(ls.apiKey(), { email: u.email, name: u.name || "", plan: pi.planName || "" });
      vscode.window.showInformationMessage("已收录 " + r.email + "(池内 " + r.count + " 号)");
    } catch (e) { vscode.window.showErrorMessage("收录失败: " + e.message); }
    this._poolList();
  }

  async _poolSwitch(email) {
    try {
      acctPool.switchTo(email);
      vscode.window.showInformationMessage("已切到 " + email + " — 插件 LS 调用即刻生效; 重载窗口可使官方 UI 同步");
      await this._refreshAfterSwitch();
    } catch (e) { vscode.window.showErrorMessage("切号失败: " + e.message); }
    this._poolList();
  }

  async _refreshAfterSwitch() {
    this._fusing = false;
    await this._refreshFused();
    this._pushState();
  }

  _poolRemove(email) {
    try { acctPool.remove(email); } catch (e) { vscode.window.showErrorMessage("移除失败: " + e.message); }
    this._poolList();
  }

  // 设置板块(官方同源二级页): 活体 GetUserStatus(账号详情/配额/套餐限额/组织能力矩阵)
  // + GetUserSettings 开关读改写 + GetChangelog 更新日志。key 绝不出后端。
  async _setDetail() {
    try {
      const ls = require("./ls-bridge");
      const [ru, rs] = await Promise.all([ls.call("GetUserStatus", {}), ls.call("GetUserSettings", {})]);
      const u = (ru && ru.userStatus) || {};
      const ps = u.planStatus || {};
      const pi = ps.planInfo || {};
      this._post({ type: "set-detail", data: {
        account: {
          email: u.email || "", name: u.name || "", plan: pi.planName || "", tier: u.teamsTier || "",
          daily: ps.dailyQuotaRemainingPercent, weekly: ps.weeklyQuotaRemainingPercent,
          dailyResetAt: Number(ps.dailyQuotaResetAtUnix || 0), weeklyResetAt: Number(ps.weeklyQuotaResetAtUnix || 0),
          promptCredits: ps.availablePromptCredits, flowCredits: ps.availableFlowCredits,
          monthlyPromptCredits: pi.monthlyPromptCredits, monthlyFlowCredits: pi.monthlyFlowCredits,
          maxChatInputTokens: pi.maxNumChatInputTokens, maxPinnedContext: pi.maxNumPinnedContextItems,
        },
        teamConfig: u.teamConfig || {},
        settings: { openRecent: (((rs || {}).userSettings) || {}).openMostRecentChatConversation === true },
        acp: { running: !!(this._cascade && this._cascade._acpReady && this._cascade._acp),
          registryPath: this._acpRegistryPath() },
        env: require("./env-sync").detect(),
      } });
    } catch (e) {
      // LS 不在线时仍交付本地检测(环境共生零 LS 依赖)
      let env = null; try { env = require("./env-sync").detect(); } catch (_) {}
      this._post({ type: "set-detail", data: { error: e.message, env } });
    }
  }

  // 官方式写回: 读-改-写全量合并(SetUserSettings 为整体替换, 只发补丁会清掉其余键)。
  async _setToggle(key, on) {
    try {
      if (key !== "openMostRecentChatConversation") throw new Error("未知设置键: " + key);
      const ls = require("./ls-bridge");
      const s = ((await ls.call("GetUserSettings", {})) || {}).userSettings || {};
      await ls.call("SetUserSettings", { userSettings: Object.assign(s, { openMostRecentChatConversation: on }) });
    } catch (e) { vscode.window.showErrorMessage("设置失败: " + e.message); }
    this._setDetail();
  }

  _acpRegistryPath() {
    const os = require("os"); const path = require("path");
    return path.join(os.homedir(), ".windsurf", "acp", "registry.json");
  }

  // 官方同源 devin.openAcpLocalRegistry: 不存在则创建 {version:"1.0.0",agents:[]} 后以 jsonc 打开。
  async _acpRegistry() {
    try {
      const p = this._acpRegistryPath();
      const fs = require("fs"); const path = require("path");
      if (!fs.existsSync(p)) {
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, JSON.stringify({ version: "1.0.0", agents: [] }, null, 2) + "\n");
      }
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(p));
      try { await vscode.languages.setTextDocumentLanguage(doc, "jsonc"); } catch (_) {}
      await vscode.window.showTextDocument(doc);
    } catch (e) { vscode.window.showErrorMessage("打开 ACP 本地注册表失败: " + e.message); }
  }

  // 官方同源 devin.reloadAcpConnections 的插件侧对等: 停掉 Cascade 面板持有的 ACP 客户端,
  // 下次消息懒启动即重连(重读 registry 与最新凭证)。
  async _acpReload() {
    try {
      const c = this._cascade;
      if (c && c._acp) { try { c._acp.stop(); } catch (_) {} c._acp = null; c._acpReady = false; }
      if (c) { c._acpFailAt = 0; c._acpBackoff = 0; }
      // 宿主内建官方命令存在则一并触发(Devin IDE 内)。
      try { await vscode.commands.executeCommand("devin.reloadAcpConnections"); } catch (_) {}
      vscode.window.showInformationMessage("ACP 连接已重置 — 下次消息即重连");
    } catch (e) { vscode.window.showErrorMessage("ACP 重连失败: " + e.message); }
    this._setDetail();
  }

  // 环境共生一览的行级打开: 文件开编辑器(二进制走 vscode.open); 目录列出条目可续开; 每个分支都有 IDE 内反馈。
  async _envOpen(p) {
    if (!p) return;
    try {
      const fs = require("fs"); const path = require("path");
      if (!fs.existsSync(p)) {
        try { fs.mkdirSync(path.extname(p) ? path.dirname(p) : p, { recursive: true }); } catch (_) {}
        vscode.window.showInformationMessage("路径待生成: " + p + (fs.existsSync(p) ? " — 已建目录" : " — 已备好父目录"));
      } else if (fs.statSync(p).isFile()) {
        try {
          const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(p));
          await vscode.window.showTextDocument(doc, { preview: false });
        } catch (_) {
          try { await vscode.commands.executeCommand("vscode.open", vscode.Uri.file(p)); }
          catch (_) {
            vscode.window.showInformationMessage("二进制文件, 已在系统中揭示: " + p);
            vscode.commands.executeCommand("revealFileInOS", vscode.Uri.file(p)).then(undefined, () => {});
          }
        }
      } else {
        await this._envOpenDir(p);
      }
    } catch (e) { vscode.window.showErrorMessage("打开失败: " + e.message); }
    this._setDetail();
  }

  // 目录: IDE 内 QuickPick 列条目(不依赖 OS 文管默认程序), 选文件即开、选子目录续入。
  async _envOpenDir(dir) {
    const fs = require("fs"); const path = require("path");
    let names = [];
    try { names = fs.readdirSync(dir); } catch (e) { vscode.window.showErrorMessage("读目录失败: " + e.message); return; }
    if (!names.length) { vscode.window.showInformationMessage("空目录: " + dir); return; }
    const items = names.slice(0, 200).map((n) => {
      let isDir = false; try { isDir = fs.statSync(path.join(dir, n)).isDirectory(); } catch (_) {}
      return { label: (isDir ? "$(folder) " : "$(file) ") + n, description: isDir ? "目录" : "", _p: path.join(dir, n), _d: isDir };
    }).sort((a, b) => (b._d - a._d) || a.label.localeCompare(b.label));
    const pick = await vscode.window.showQuickPick(items, { placeHolder: dir + " — " + names.length + " 项(选择打开)" });
    if (pick) await this._envOpen(pick._p);
  }

  async _setChangelog() {
    try {
      const ls = require("./ls-bridge");
      let r = await ls.call("GetChangelog", { version: "1.63.9250" });
      if (!r || !r.path) r = await ls.call("GetChangelog", { version: "1.12.169" });
      if (!r || !r.path) throw new Error("服务端无对应版本更新日志");
      const uri = vscode.Uri.file(r.path);
      try { await vscode.commands.executeCommand("markdown.showPreview", uri); }
      catch (_) { await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(uri)); }
    } catch (e) { vscode.window.showErrorMessage("更新日志: " + e.message); }
  }

  async _backupNow() {
    this._post({ type: "backup-progress", running: true });
    try {
      await vscode.commands.executeCommand("dao.cascade.backupAll");
    } catch (e) { this._log("[unified] backup-now: " + e.message); }
    // 命令内部异步落盘, 稍候重扫。
    setTimeout(() => { this._post({ type: "backup-progress", running: false }); this._pushState(); }, 1800);
  }

  _html(w) {
    const n = nonce();
    const csp = [
      "default-src 'none'",
      "style-src 'unsafe-inline'",
      "script-src 'nonce-" + n + "'",
    ].join("; ");
    return `<!DOCTYPE html><html lang="zh"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<style>
:root{color-scheme:dark light}
*{box-sizing:border-box}
body{margin:0;font:13px/1.5 var(--vscode-font-family,system-ui);color:var(--vscode-foreground)}
.wrap{display:flex;height:100vh}
/* dao-vsix /shell 左侧图标栏 1:1(.sb/.ni), 颜色映射到 IDE 主题变量 */
.sb{width:48px;background:var(--vscode-sideBar-background,#1e1e1e);border-right:1px solid var(--vscode-panel-border,#3334);display:flex;flex-direction:column;align-items:center;padding:8px 0;flex-shrink:0;overflow-y:auto}
.sb .ni{width:36px;height:36px;display:flex;align-items:center;justify-content:center;border-radius:6px;cursor:pointer;font-size:16px;margin:2px 0;opacity:0.6;transition:all .15s;flex-shrink:0}
.sb .ni:hover{opacity:1;background:var(--vscode-list-hoverBackground,#8881)}
.sb .ni.active{opacity:1;background:var(--vscode-list-activeSelectionBackground,#0a5);color:var(--vscode-list-activeSelectionForeground,#fff)}
.sb .sp{flex:1}
.main{flex:1;min-width:0;overflow:auto;padding:14px 16px}
.st{font-size:11px;text-transform:uppercase;letter-spacing:.06em;opacity:.6;margin:14px 0 6px}
.st:first-child{margin-top:0}
.card{border:1px solid var(--vscode-panel-border,#3334);border-radius:8px;padding:10px 12px;margin-bottom:10px}
.cr{display:flex;justify-content:space-between;gap:12px;padding:3px 0}
.cr .l{opacity:.65}.cr .v{text-align:right;word-break:break-all}
.acc{border:1px solid var(--vscode-panel-border,#3334);border-radius:8px;margin-bottom:10px;overflow:hidden}
.acc .hd{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:6px;padding:8px 12px;background:var(--vscode-list-hoverBackground,#8881);font-weight:600}
.acc .hd>span:first-child{min-width:0;overflow-wrap:anywhere}
.acc .hd>span:last-child{flex:0 0 auto}
.badge{font-size:10px;padding:1px 7px;border-radius:10px;background:#0a53;margin-left:6px;font-weight:400}
.badge.cloud{background:#37a3}.badge.mixed{background:#a703}
.conv{padding:6px 12px;border-top:1px solid var(--vscode-panel-border,#2223);cursor:pointer;display:flex;justify-content:space-between;gap:8px}
.conv:hover{background:var(--vscode-list-hoverBackground,#8881)}
.conv .m{opacity:.5;font-size:11px;white-space:nowrap}
.arch{opacity:.5}
.btn{background:var(--vscode-button-background,#0a5);color:var(--vscode-button-foreground,#fff);border:none;border-radius:5px;padding:5px 12px;cursor:pointer;font:inherit;white-space:nowrap;flex:0 0 auto}
.btn.sec{background:var(--vscode-button-secondaryBackground,#4443)}
.row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px}
.row h2{min-width:120px}
.muted{opacity:.55}
pre{white-space:pre-wrap;word-break:break-word;background:var(--vscode-textCodeBlock-background,#0002);padding:10px;border-radius:6px;max-height:64vh;overflow:auto}
.back{cursor:pointer;color:var(--vscode-textLink-foreground,#4af)}
.mgr{cursor:pointer;opacity:.55;margin-left:2px;padding:3px 4px;display:inline-block}
.mgr:hover{opacity:1;background:var(--vscode-list-hoverBackground,#8882);border-radius:4px}
h2{font-size:15px;margin:0 0 4px}
</style></head><body>
<div class="wrap">
  <nav class="sb" id="nav"></nav>
  <div class="main" id="main"><div class="muted">加载中…</div></div>
</div>
<script nonce="${n}">
const vscode=acquireVsCodeApi();
let S=null, CONV=null;
// 七大板块顺序/图标/标题与 dao-vsix /shell 1:1; 其后为插件版延伸板块。
const BOARDS=[["overview","🏠","主页 · Windows 总控"],["switch","🔀","切号 · 账号池"],["bridge","🌐","内网穿透 · DAO Bridge"],["backups","💬","对话备份"],["inject","💉","反向注入"],["mcp","🧩","MCP 服务器"],["github","🐙","GitHub"],["search","🔎","搜索"],["settings","⚙","设置"]];
function E(s){return String(s==null?"":s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function cmd(c,d){vscode.postMessage(Object.assign({command:c},d||{}))}
function sw(t){CONV=null;vscode.postMessage({type:'nav',board:t});cmd('loadTabData',{tab:t});}
function renderNav(){document.getElementById('nav').innerHTML=BOARDS.map(([k,ic,t])=>
  '<div class="ni'+(S&&S.board===k?' active':'')+'" data-tab="'+k+'" title="'+t+'">'+ic+'</div>').join('')+
  '<div class="sp"></div><div class="ni" id="navRf" title="Refresh">⟳</div>';
  document.querySelectorAll('.sb .ni[data-tab]').forEach(n=>n.onclick=()=>sw(n.dataset.tab));
  const nr=document.getElementById('navRf'); if(nr)nr.onclick=()=>cmd('refresh');}
function q(x){return (x===0||x)?(x+'%'):'—';}
function renderOverview(){
  const a=S.account||{}, mb=S.mcp&&S.mcp.servers, cb=S.cascadeBackup, eg=S.engines;
  const run=mb?mb.filter(s=>String(s.status||'').toUpperCase().indexOf('RUN')>=0).length:0;
  let h='<div class="row"><h2 style="flex:1">主页 · Windows 总控</h2>'+
    '<button class="btn" id="winOpen">开本窗口桌面</button>'+
    '<button class="btn sec" id="winRf">刷新</button></div>';
  h+='<div class="muted" style="margin-bottom:10px">主页即 Windows 统一管理: 账号分身/桌面会话/模式/工具层一目了然(Dao-Windows-Agent 真源直连); 其余板块各司其职。</div>';
  h+=renderWinControl();
  h+='<div class="st">三模式引擎</div><div class="card">';
  if(eg){
    const cx=eg.cascade||{}, dl=eg.devinLocal||{}, dc=eg.devinCloud||{};
    h+=cr('🌊 Cascade',(cx.ready?'⚡LS 就绪(:'+cx.lsPort+')':'LS 未就绪')+' · '+(cx.signedIn?('已登录'+(cx.name?' '+E(cx.name):'')):'未登录'));
    h+=cr('⬢ Devin Local',(dl.bin?'引擎就绪':'无 devin 二进制')+' · '+(dl.signedIn?('CLI 已登录'+(dl.name?' '+E(dl.name):'')):'CLI 未登录'));
    h+=cr('☁ Devin Cloud',(dc.signedIn?'凭据就绪(同 CLI)':'未登录')+' · 远端 ACP');
    if(eg.updatedAt)h+=cr('探测于',E(String(eg.updatedAt).replace('T',' ').slice(0,19)));
  } else h+='<div class="cr muted">无引擎态快照(点右上刷新或打开 Cascade 面板后自动探测)</div>';
  h+='</div>';
  h+='<div class="st">Cascade · Devin Desktop 账号</div><div class="card">';
  if(a.email){h+=cr('账号',(a.name?E(a.name)+' · ':'')+E(a.email));}
  else h+='<div class="cr muted">未获取到账号(LS '+(S.lsReady?'就绪':'未就绪')+', 打开 Cascade 面板登录后自动同步)</div>';
  if(a.plan)h+=cr('套餐',E(a.plan));
  if(a.dailyQuotaPct!==undefined||a.weeklyQuotaPct!==undefined)h+=cr('配额(日/周)',q(a.dailyQuotaPct)+' / '+q(a.weeklyQuotaPct));
  if(a.flexCredits!=null)h+=cr('Flex 额度',E(a.flexCredits));
  if(a.updatedAt)h+=cr('更新于',E(String(a.updatedAt).replace('T',' ').slice(0,19)));
  h+='</div>';
  h+='<div class="st">对话备份</div><div class="card">';
  const nAcc=S.backups.accounts.length, nConv=S.backups.accounts.reduce((s,x)=>s+x.convCount,0);
  h+=cr('已备份账号',nAcc+' 个');
  h+=cr('已备份对话',nConv+' 条'+(cb&&cb.total?' · Cascade 水位 '+cb.total:''));
  h+=cr('备份根',E(S.backups.root));
  h+='</div>';
  h+='<div class="st">本地 MCP(插件版)</div><div class="card">';
  h+= mb ? cr('已配置', mb.length+' 个 · '+run+' 运行中') : '<div class="cr muted">无 MCP 快照(打开 Cascade 面板 MCP 列表后同步)</div>';
  h+='</div>';
  const cl=S.cascadeLocal, me=S.memories;
  h+='<div class="st">Cascade 本机(devin-local)</div><div class="card">';
  h+= cl ? cr('会话轨迹', cl.total+' 条 · '+cl.live+' 活跃 / '+cl.archived+' 归档') : '<div class="cr muted">无会话快照(LS 就绪后自动同步; 也可进「对话备份」板块即刻拉取)</div>';
  h+= me ? cr('记忆', me.total+' 条') : '';
  h+=cr('LS',S.lsReady?'✓ 就绪':'未就绪');
  h+='</div>';
  h+='<div class="st">GitHub 舰队 · Proxy Pro</div><div class="card">';
  h+= S.github ? cr('GitHub 舰队', S.github.count+' 号 · '+S.github.ok+' 在线✓') : cr('GitHub 舰队','—');
  h+= S.proxy ? cr('Proxy Pro', S.proxy.channels+' 渠道 · '+S.proxy.routes+' 路由') : cr('Proxy Pro','—');
  h+='</div>';
  return h;
}
function cr(l,v){return '<div class="cr"><span class="l">'+E(l)+'</span><span class="v">'+v+'</span></div>';}
function renderBackups(){
  if(CONV){return renderConv();}
  let h='<div class="row"><h2 style="flex:1">对话备份 · 三源统一</h2>'+
    '<button class="btn" id="bk">立即备份</button>'+
    '<button class="btn sec" id="rf">刷新</button></div>';
  h+='<div class="muted" style="margin-bottom:10px">Cascade(本机)、Devin Local/Cloud(ACP)与 Devin Cloud 账号同结构、同列并出; 点击任一对话查看转录。</div>';
  const accs=S.backups.accounts;
  if(!accs.length)h+='<div class="card muted">暂无备份。点「立即备份 Cascade」导出本机对话。</div>';
  for(const a of accs){
    const cls=a.source==='cloud'||a.source==='devin'?'cloud':(a.source==='mixed'?'mixed':'');
    h+='<div class="acc"><div class="hd"><span>'+E(a.email)+
      '<span class="badge '+cls+'">'+(a.source==='cloud'?'Devin Cloud':(a.source==='devin'?'Devin(ACP)':(a.source==='mixed'?'混合':'Cascade')))+'</span></span>'+
      '<span class="muted" style="font-weight:400">'+a.convCount+' 条</span></div>';
    for(const c of a.conversations){
      const mg=((c.source==='cascade'||c.source==='devin-acp')&&c.cascadeId)?
        ' <span class="mgr" data-op="rename" title="重命名">✏</span>'+
        (c.source==='cascade'?' <span class="mgr" data-op="'+(c.isArchived?'unarchive':'archive')+'" title="'+(c.isArchived?'取消归档':'归档')+'">🗄</span>':'')+
        ' <span class="mgr" data-op="delete" title="删除">🗑</span>':'';
      h+='<div class="conv'+(c.isArchived?' arch':'')+'" data-dir="'+E(a.dir)+'" data-folder="'+E(c.folder)+'" data-cid="'+E(c.cascadeId||'')+'" data-source="'+E(c.source||'')+'" data-title="'+E(c.title)+'">'+
        '<span>'+(c.convNo?('#'+c.convNo+' '):'')+E(c.title)+(c.isArchived?' 🗄':'')+'</span>'+
        '<span class="m">'+E(String(c.lastModifiedTime||c.backedUpAt||'').replace('T',' ').slice(0,16))+mg+'</span></div>';
    }
    h+='</div>';
  }
  h+='<div class="st">Cascade 会话管理(本机原生)</div>';
  if(CX===null)h+='<div class="card muted">加载会话轨迹…</div>';
  else if(CX.error)h+='<div class="card">⚠ '+E(CX.error)+'</div>';
  else{
    const list=CX.sessions||[];
    if(!list.length)h+='<div class="card muted">本机暂无 Cascade 会话轨迹。</div>';
    for(const s of list){
      h+='<div class="acc"><div class="hd"><span>'+(s.archived?'🗄 ':'🌊 ')+E(s.title)+(s.archived?'<span class="badge mixed">已归档</span>':'')+'</span><span>'+
        '<button class="btn sec" data-cxrename="'+E(s.cid)+'">重命名</button> '+
        '<button class="btn sec" data-cxarchive="'+E(s.cid)+'|'+(s.archived?'0':'1')+'">'+(s.archived?'取消归档':'归档')+'</button> '+
        '<button class="btn sec" data-cxdelete="'+E(s.cid)+'">删除</button></span></div>'+
        '<div class="conv" style="cursor:default"><span class="muted">'+E(s.cid)+(s.workspace?' · '+E(s.workspace):'')+'</span>'+
        '<span class="m">'+E(String(s.updatedAt||'').replace('T',' ').slice(0,16))+'</span></div></div>';
    }
  }
  h+='<div class="st">Cascade 记忆管理(账号级+工作区级双源)</div>';
  if(MEM===null)h+='<div class="card muted">加载记忆…</div>';
  else if(MEM.error)h+='<div class="card">⚠ '+E(MEM.error)+'</div>';
  else{
    const ms=MEM.memories||[];
    if(!ms.length)h+='<div class="card muted">暂无记忆。</div>';
    for(const m of ms){
      h+='<div class="acc"><div class="hd"><span>🧠 '+E(m.title||'(无题)')+'</span><span>'+
        '<button class="btn sec" data-memedit="'+E(m.id)+'">编辑</button> '+
        '<button class="btn sec" data-memdel="'+E(m.id)+'">删除</button></span></div>'+
        '<div class="conv" style="cursor:default"><span class="muted">'+E(String(m.content||'').slice(0,160))+'</span></div></div>';
    }
  }
  return h;
}
function renderConv(){
  const m=CONV.meta||{};
  let h='<div class="back" id="back">← 返回备份列表</div><h2 style="margin-top:8px">'+E(m.title||CONV.folder)+'</h2>';
  h+='<div class="card">';
  if(m.source)h+=cr('来源',E(m.source==='cascade'?'Cascade(插件版)':m.source));
  if(m.cascadeId)h+=cr('Cascade ID',E(m.cascadeId));
  if(m.lastModifiedTime)h+=cr('更新于',E(String(m.lastModifiedTime).replace('T',' ').slice(0,19)));
  if(m.isArchived)h+=cr('状态','🗄 已归档');
  h+='</div><pre>'+E(CONV.md)+'</pre>';
  return h;
}
let CX=null, MEM=null;
let POOL=null;
function renderSwitch(){
  let h='<div class="row"><h2 style="flex:1">切号 · 插件自持账号池</h2>'+
    '<button class="btn" id="poolCap">收录当前号</button>'+
    '<button class="btn sec" id="poolRf">刷新</button></div>';
  h+='<div class="muted" style="margin-bottom:10px">池存于 ~/.dao/cascade-pool.json(插件自持, 不依赖 IDE); 切换写入 credentials.toml, 目标号无 key 绝不冒名回退。</div>';
  if(POOL===null){h+='<div class="card muted">加载账号池…</div>';return h;}
  if(POOL.error)h+='<div class="card">⚠ '+E(POOL.error)+'</div>';
  const list=POOL.accounts||[];
  if(!list.length){h+='<div class="card muted">账号池空。在当前登录态下点「收录当前号」入池。</div>';return h;}
  for(const a of list){
    h+='<div class="acc"><div class="hd"><span>'+E(a.email)+(a.active?'<span class="badge">✓ 当前</span>':'')+
      (a.plan?'<span class="badge cloud">'+E(a.plan)+'</span>':'')+'</span><span>'+
      (a.active?'':'<button class="btn" data-poolswitch="'+E(a.email)+'">切换</button> ')+
      '<button class="btn sec" data-poolremove="'+E(a.email)+'">移除</button></span></div>'+
      '<div class="conv" style="cursor:default"><span class="muted">'+(a.name?E(a.name)+' · ':'')+
      (a.hasKey?'key …'+E(a.keyTail):'无 key')+' · 收录于 '+E(String(a.addedAt||'').replace('T',' ').slice(0,16))+'</span></div></div>';
  }
  return h;
}
let BR=null;
function renderBridge(){
  let h='<div class="row"><h2 style="flex:1">桥接 · 插件自持本地 API</h2>'+
    (BR&&BR.running?'<button class="btn sec" id="brStop">停止</button>':'<button class="btn" id="brStart">启动</button>')+
    '<button class="btn sec" id="brRf">刷新</button></div>';
  h+='<div class="muted" style="margin-bottom:10px">只绑 127.0.0.1 · 除 /api/health 外均需 Bearer token(随机生成·落盘 mode 600); 暴露插件自持真源(账号/备份/MCP/LS 主机), 绝不含凭据。</div>';
  if(BR===null){h+='<div class="card muted">加载桥接状态…</div>';return h;}
  h+='<div class="card">'+cr('状态',BR.running?'⚡运行中':'已停止')+
    (BR.running?cr('地址','http://127.0.0.1:'+BR.port):'')+
    (BR.running?cr('token','…'+E(BR.tokenTail)+' <span class="back" id="brTok">复制完整 token</span>'):'')+
    cr('状态文件',E(BR.stateFile||''))+'</div>';
  if(BR.running){
    h+='<div class="st">端点(全只读)</div><div class="card">'+
      ['/api/health — 健康(免鉴权)','/api/overview — 账号+备份+MCP+LS 总览','/api/account — 账号(脱敏)','/api/backups — 备份水位','/api/mcp — MCP 快照','/api/host — LS 主机态','/api/cascade — 本机会话·记忆水位']
      .map(x=>'<div class="cr"><span class="v" style="text-align:left">'+E(x)+'</span></div>').join('')+'</div>';
  }
  return h;
}
let GH=null;
function renderGithub(){
  let h='<div class="row"><h2 style="flex:1">GitHub · 插件自持舰队</h2>'+
    '<button class="btn" id="ghAdd">入队</button>'+
    '<button class="btn sec" id="ghVerify">在线核验</button>'+
    '<button class="btn sec" id="ghRf">刷新</button></div>';
  h+='<div class="muted" style="margin-bottom:10px">纯 GitHub 纵向(与 Devin/Cascade 账号池完全分离); PAT 存 ~/.dao/github-fleet.json(mode 600), 面板只显尾4位; 首号默认管理者; 断网守柔(带 login 仍入队待核)。</div>';
  if(GH===null){h+='<div class="card muted">加载舰队…</div>';return h;}
  const list=GH.accounts||[];
  if(!list.length){h+='<div class="card muted">舰队空。点「入队」粘入 PAT(或 login:PAT)。</div>';return h;}
  for(const a of list){
    const st=a.verify==='ok'?'✓ 正常':(a.verify==='pending'?'⏳ 待核':'✗ PAT 失效');
    h+='<div class="acc"><div class="hd"><span>'+E(a.login)+
      '<span class="badge'+(a.role==='admin'?'':' cloud')+'">'+(a.role==='admin'?'管理者':'成员')+'</span>'+
      '<span class="badge cloud">'+st+'</span></span><span>'+
      '<button class="btn sec" data-ghrole="'+E(a.login)+'|'+(a.role==='admin'?'member':'admin')+'">'+(a.role==='admin'?'降为成员':'升管理者')+'</button> '+
      '<button class="btn sec" data-ghinject="'+E(a.login)+'">PAT 入注入档</button> '+
      '<button class="btn sec" data-ghremove="'+E(a.login)+'">移出</button></span></div>'+
      '<div class="conv" style="cursor:default"><span class="muted">PAT …'+E(a.patTail)+' · 入队于 '+E(String(a.addedAt||'').replace('T',' ').slice(0,16))+
      (a.lastVerifiedAt?' · 核于 '+E(String(a.lastVerifiedAt).replace('T',' ').slice(0,16)):'')+'</span></div></div>';
  }
  return h;
}
let MCPD=null;
function renderMcp(){
  let h='<div class="row"><h2 style="flex:1">MCP · 插件版管理</h2>'+
    '<button class="btn" id="mcpAdd">添加</button>'+
    '<button class="btn sec" id="mcpCfg">配置文件</button>'+
    '<button class="btn sec" id="mcpRefresh">重载</button></div>';
  if(MCPD===null){h+='<div class="card muted">正在经 LS 拉取 MCP 明细…</div>';return h;}
  if(MCPD.error){h+='<div class="card">⚠ '+E(MCPD.error)+'</div>';return h;}
  const mb=MCPD.servers||[], reg=MCPD.registry||[];
  if(!mb.length&&!reg.length){h+='<div class="card muted">暂无 MCP 服务器与注册表条目。</div>';return h;}
  if(mb.length) h+='<div class="st">已安装</div>';
  if(!mb.length) h+='<div class="card muted">无已配置的 MCP 服务器。点「添加」或从注册表一键安装。</div>';
  for(const s of mb){
    const running=String(s.status||'').toUpperCase().indexOf('READY')>=0||String(s.status||'').toUpperCase().indexOf('RUN')>=0;
    h+='<div class="acc"><div class="hd"><span>'+E(s.name)+
      '<span class="badge'+(running?'':' cloud')+'">'+(s.disabled?'已禁用':(running?'⚡运行中':E(s.status)||'未运行'))+'</span></span>'+
      '<button class="btn sec" data-mcptoggle="'+E(s.name)+'">'+(s.disabled?'启用':'禁用')+'</button></div>';
    if(s.error)h+='<div class="conv" style="cursor:default"><span>⚠ '+E(s.error)+'</span></div>';
    for(const t of s.tools){
      h+='<div class="conv" data-mcptool="'+E(s.name)+'|'+E(t.name)+'" title="'+E(t.description)+'">'+
        '<span'+(t.off?' class="arch" style="text-decoration:line-through"':'')+'>'+(t.off?'◌ ':'● ')+E(t.name)+'</span>'+
        '<span class="m">'+(t.off?'已禁用 · 点启':'启用中 · 点禁')+'</span></div>';
    }
    if(s.prompts&&s.prompts.length)h+='<div class="conv" style="cursor:default"><span class="muted">prompts: '+s.prompts.map(p=>E(p.name)).join(', ')+'</span></div>';
    h+='</div>';
  }
  if(reg.length){
    h+='<div class="st">注册表可安装</div>';
    for(const s of reg){
      h+='<div class="acc"><div class="hd"><span>'+E(s.title||s.id)+
        '<span class="badge cloud">'+(s.installed?'已安装':(s.how==='remote'?'远程':'包安装'))+'</span></span>'+
        '<button class="btn sec" data-mcpinstall="'+E(s.id)+'">'+(s.installed?'重装':'安装')+'</button></div>'+
        '<div class="conv" style="cursor:default"><span class="muted">'+E(s.description||'')+'</span></div></div>';
    }
  }
  return h;
}
let WS={data:null,history:[],running:false};
function renderSearch(){
  let h='<div class="row"><h2 style="flex:1">搜索 · 插件自持站内网页搜索</h2>'+
    '<button class="btn sec" id="wsClear">清历史</button></div>';
  h+='<div class="muted" style="margin-bottom:10px">经搜索引擎直取结果(不弹外部系统浏览器); 结果点开走 IDE 外链。历史仅存查询串于 ~/.dao/web-search.json(mode 600)。</div>';
  h+='<div class="card"><div class="cr"><input id="wsQ" placeholder="输入搜索词…" style="flex:1;background:var(--vscode-input-background,#222);color:inherit;border:1px solid var(--vscode-input-border,#444);border-radius:4px;padding:6px" />'+
    '<select id="wsE" style="margin:0 6px;background:var(--vscode-input-background,#222);color:inherit;border:1px solid #444;border-radius:4px;padding:6px"><option value="duckduckgo">DuckDuckGo</option><option value="bing">Bing</option></select>'+
    '<button class="btn" id="wsGo">搜索</button></div></div>';
  if(WS.running)h+='<div class="card muted">搜索中…</div>';
  else if(WS.data){
    const d=WS.data;
    if(!d.ok)h+='<div class="card">⚠ '+E(d.error||'无结果')+(d.serp?' <span class="back" data-wsurl="'+E(d.serp)+'">在浏览器打开搜索页↗</span>':'')+'</div>';
    else if(d.serp)h+='<div class="muted" style="margin-bottom:6px"><span class="back" data-wsurl="'+E(d.serp)+'">在浏览器打开完整搜索页↗</span></div>';
    h+='<div class="st">结果 · "'+E(d.query)+'" @ '+E(d.engineName||d.engine||'')+'</div>';
    for(const r of (d.results||[])){
      h+='<div class="acc"><div class="conv" data-wsurl="'+E(r.url)+'"><span>'+E(r.title||r.url)+'</span><span class="m">打开↗</span></div>'+
        '<div class="conv" style="cursor:default"><span class="muted">'+E(r.url)+'</span></div>'+
        (r.snippet?'<div class="conv" style="cursor:default"><span class="muted">'+E(r.snippet)+'</span></div>':'')+'</div>';
    }
  }
  if(WS.history&&WS.history.length){
    h+='<div class="st">最近搜索</div><div class="card">';
    for(const x of WS.history.slice(0,10))h+='<div class="cr" data-wshist="'+E(x.query)+'" style="cursor:pointer"><span class="l">'+E(x.query)+'</span><span class="v muted">'+x.n+' 条 · '+E(String(x.at||'').replace('T',' ').slice(0,16))+'</span></div>';
    h+='</div>';
  }
  return h;
}
let WIN=null;
function renderWinControl(){
  if(WIN===null)return '<div class="card muted">Windows 总控探活中…</div>';
  if(WIN.error)return '<div class="card">⚠ '+E(WIN.error)+'</div>';
  const d=WIN;
  let h='';
  const md=d.mode;
  h+='<div class="st">工具层模式(桥 /api/mode.*)</div><div class="card">'+
    (md?cr('当前模式',E(md.name||md.mode_id||'')+(md.summary?' · '+E(md.summary):'')):'<div class="cr muted">桥不在跑时无模式态(契约文件 ~/.dao/mode.json 仍为真源)</div>')+'</div>';
  h+='<div class="st">快速连接(远程桌面连接同式)</div><div class="card"><div class="cr"><span class="l">账号</span><span class="v">'+
    '<select id="winQcAcct"><option value="">本窗口(当前账号)</option>'+
    ((d.accounts||[]).map(a=>'<option value="'+E(a.name)+'">'+E(a.name)+'</option>').join(''))+
    '</select> <button class="btn" id="winQcGo">连接</button></span></div></div>';
  h+='<div class="st">Windows 账号分身(每账号 = 一路独立桌面会话)</div>';
  if(d.accounts===null||d.accounts===undefined)h+='<div class="card muted">隧道不可达时无账号清单。</div>';
  else{
    h+='<div class="card"><div class="cr"><span class="l">账号 '+(d.accounts.length)+' 个</span><span class="v"><button class="btn" id="winAcctNew">新建账号</button></span></div></div>';
    for(const ac of d.accounts){
      h+='<div class="acc"><div class="hd"><span>🪟 '+E(ac.name)+'</span><span>'+
        '<button class="btn" data-winopen="'+E(ac.name)+'">开桌面</button> '+
        '<button class="btn sec" data-winclone="'+E(ac.name)+'">复制分身</button> '+
        '<button class="btn sec" data-winacctdel="'+E(ac.name)+'">销毁</button></span></div>'+
        '<div class="conv" style="cursor:default"><span class="muted">'+E(ac.hostname||'')+(ac.port?':'+E(ac.port):'')+'</span></div></div>';
    }
  }
  const m=d.mcp||{};
  h+='<div class="st">官方工具层接入(dao-windows-agent MCP)</div><div class="card">'+
    cr('注册',m.registered?('✓ 已注册 · '+E(m.transport||'')+(m.disabled?' · 已禁用':'')):'○ 未注册')+
    (m.serverUrl?cr('远端',E(m.serverUrl)):'')+
    (m.cwd?cr('本机检出',E(m.cwd)):(d.checkout?cr('本机检出(可注册)',E(d.checkout)):''))+
    '<div class="cr"><span class="l"></span><span class="v">'+
    (m.registered?'<button class="btn sec" id="winUnreg">移除注册</button>':
      '<button class="btn" id="winRegL">注册 local</button> <button class="btn sec" id="winRegR">注册 remote</button>')+
    '</span></div></div>';
  const b=d.bridge||{};
  h+='<div class="st">桥(软件画像控制面)</div><div class="card">'+
    cr('地址',E(b.url||''))+
    cr('状态',b.ok?'⚡在线':'○ 不可达'+(b.error?' · '+E(b.error):''))+
    (b.ok?cr('软件画像',(b.apps||[]).map(E).join('、')):'')+
    (b.ok?cr('活跃会话',String((b.sessions||[]).length)+' 个'):'')+'</div>';
  const t=d.tunnel||{};
  h+='<div class="st">分身输入租约(隧道 /input)</div>';
  if(!t.ok)h+='<div class="card muted">隧道不可达'+(t.error?' · '+E(t.error):'')+'</div>';
  else if(!(t.holders||[]).length)h+='<div class="card muted">当前无任何分身被持有输入权(空闲)。</div>';
  else{
    for(const x of t.holders){
      const kind=x.kind==='human'?'👤 人手':'🤖 Agent';
      h+='<div class="acc"><div class="hd"><span>'+E(x.key)+'<span class="badge'+(x.kind==='human'?'':' cloud')+'">'+kind+'</span></span>'+
        '<button class="btn sec" data-winrel="'+E(x.key)+'|'+E(x.ownerId)+'">释放</button></div>'+
        '<div class="conv" style="cursor:default"><span class="muted">'+E(x.ownerId)+' · 优先级 '+E(x.priority)+' · TTL 剩 '+E(x.ttlLeft)+'ms</span></div></div>';
    }
  }
  const mx=d.matrix;
  h+='<div class="st">分身隔离矩阵(每软件最低可行档)</div>';
  if(!mx)h+='<div class="card muted">桥不可达时无矩阵。</div>';
  else if(mx.error)h+='<div class="card">⚠ '+E(mx.error)+'</div>';
  else{
    h+='<div class="card">';
    for(const app of Object.keys(mx)){
      const p=mx[app]||{};
      h+=cr(E(app),(p.isolated?'✓':'⚠')+' '+E(p.tier||'?')+' (最低需 '+E(p.min_tier||'?')+')'+(p.isolated?'':' · 有缺口'));
    }
    h+='</div>';
  }
  if(d.probedAt)h+='<div class="muted">探活于 '+E(String(d.probedAt).replace('T',' ').slice(0,19))+'</div>';
  return h;
}
let SET=null;
function tierName(t){return String(t||'').replace('TEAMS_TIER_','').replace(/_/g,' ')||'—';}
function resetAt(u){return u?new Date(u*1000).toISOString().replace('T',' ').slice(0,16)+' UTC':'—';}
function onoff(v){return v===true||v==='enabled'?'✓ 开通':(v===false||v==='disabled'?'✕ 未开':E(String(v)));}
function renderSettings(){
  let h='<div class="row"><h2 style="flex:1">设置 · 官方同源二级页</h2>'+
    '<button class="btn sec" id="setCl">更新日志</button>'+
    '<button class="btn sec" id="setRf">刷新</button></div>';
  h+='<div class="muted" style="margin-bottom:10px">活体直连 LS(GetUserStatus/GetUserSettings): 账号用量与配额、套餐限额、组织能力矩阵、官方设置开关读改写 —— 与官方 IDE 设置/账号页同源。</div>';
  if(SET===null){h+='<div class="card muted">活体拉取中…</div>';return h;}
  if(SET.error)h+='<div class="card">⚠ '+E(SET.error)+' — 以下为本地检测(不依赖 LS)</div>';
  const a=SET.account||{}, tc=SET.teamConfig||{}, st=SET.settings||{};
  if(!SET.error){
  h+='<div class="st">账号与用量</div><div class="card">';
  h+=cr('账号',(a.name?E(a.name)+' · ':'')+E(a.email||'—'));
  h+=cr('套餐',E(a.plan||'—')+' · '+E(tierName(a.tier)));
  h+=cr('配额剩余(日/周)',q(a.daily)+' / '+q(a.weekly));
  h+=cr('日配额重置',resetAt(a.dailyResetAt));
  h+=cr('周配额重置',resetAt(a.weeklyResetAt));
  if(a.promptCredits!=null)h+=cr('Prompt 额度',E(a.promptCredits)+(a.monthlyPromptCredits!=null?' / 月 '+E(a.monthlyPromptCredits):''));
  if(a.flowCredits!=null)h+=cr('Flow 额度',E(a.flowCredits)+(a.monthlyFlowCredits!=null?' / 月 '+E(a.monthlyFlowCredits):''));
  if(a.maxChatInputTokens)h+=cr('单条输入上限',E(a.maxChatInputTokens)+' tokens');
  if(a.maxPinnedContext)h+=cr('固定上下文上限',E(a.maxPinnedContext)+' 项');
  h+='</div>';
  h+='<div class="st">官方设置开关(读改写同源)</div><div class="card">'+
    '<div class="cr"><span class="l">启动自动打开最近会话</span><span class="v">'+
    '<button class="btn'+(st.openRecent?'':' sec')+'" data-settoggle="openMostRecentChatConversation|'+(st.openRecent?'0':'1')+'">'+(st.openRecent?'✓ 已开 · 点关':'◌ 已关 · 点开')+'</button></span></div></div>';
  h+='<div class="st">组织能力矩阵(teamConfig 活体)</div><div class="card">';
  h+=cr('Devin Cloud ACP',onoff(tc.devinCloudAcpEnabled));
  h+=cr('Devin Terminal ACP',onoff(tc.devinTerminalAcpEnabled));
  h+=cr('MCP 服务器',onoff(tc.allowMcpServers));
  h+=cr('Cascade 网页搜索',onoff(tc.cascadeWebSearchEnabled));
  h+=cr('Arena 模式',onoff(tc.allowArenaMode));
  h+=cr('App 部署',onoff(tc.allowAppDeployments));
  h+=cr('CodeMap 分享',onoff(tc.allowCodemapSharing));
  if(tc.maxCascadeAutoExecutionLevel)h+=cr('自动执行上限',E(String(tc.maxCascadeAutoExecutionLevel).replace('CASCADE_COMMANDS_AUTO_EXECUTION_','')));
  h+='</div>';
  const acp=SET.acp||{};
  h+='<div class="st">ACP 连接(官方同源控制)</div><div class="card">'+
    cr('Devin Local 连接',acp.running?'● 已连接':'○ 未连接(按需懒启动)')+
    cr('本地注册表 registry.json','<span class="back" id="setAcpReg">打开/初始化</span>')+
    cr('重载 ACP 连接','<span class="back" id="setAcpRl">重载↺</span>')+'</div>';
  }
  const env=SET.env||{};
  const ide=env.ide||{};
  h+='<div class="st">环境共生(与官方 Devin IDE 同一配置体系)</div><div class="card">'+
    cr('官方 IDE 检测',ide.installed?'● 已安装 '+E(ide.binPath||''):(ide.engineTraces?'◐ 检出引擎痕迹(配置根已存在)':'○ 未检出(装上即自动共用本体系)'));
  let envGrp='';
  for(const s of (env.sources||[])){
    if(s.group&&s.group!==envGrp){envGrp=s.group;h+=cr('— '+E(envGrp)+' —','');}
    const st=(s.exists?'●':'○')+(typeof s.count==='number'?' '+s.count+' 项':(typeof s.sizeKb==='number'&&s.sizeKb>0?' '+s.sizeKb+'KB':(s.exists?' 存在':' 待生成')));
    h+=cr(E(s.label),st+' <span class="back" data-envopen="'+E(s.path)+'">打开↗</span>');
  }
  h+='</div>';
  h+='<div class="st">官方门户(外链)</div><div class="card">'+
    cr('Devin 控制台','<span class="back" data-seturl="https://app.devin.ai">打开↗</span>')+
    cr('用量与订阅(Windsurf 门户)','<span class="back" data-seturl="https://windsurf.com/subscription/usage">打开↗</span>')+
    cr('个人资料','<span class="back" data-seturl="https://windsurf.com/subscription/profile">打开↗</span>')+'</div>';
  return h;
}
let INJ=null;
function renderInject(){
  let h='<div class="row"><h2 style="flex:1">反向注入 · 插件自持注入档案</h2>'+
    '<button class="btn" id="injAdd">添加档</button>'+
    '<button class="btn sec" id="injMcp">MCP 落地本机</button>'+
    '<button class="btn sec" id="injRf">刷新</button></div>';
  h+='<div class="muted" style="margin-bottom:10px">共享资源(MCP/Secret/Knowledge)存 ~/.dao/inject-profile.json(mode 600); 注入目标=切号板块账号池全体。secret 值绝不出后端(只显尾4位)。MCP 档可一键落地本机 Cascade 配置(全账号共享)。</div>';
  if(INJ===null){h+='<div class="card muted">加载注入档案…</div>';return h;}
  const items=INJ.items||[];
  if(!items.length)h+='<div class="card muted">档案空。点「添加档」入 MCP/Secret/Knowledge。</div>';
  for(const it of items){
    const icon=it.kind==='mcp'?'🧩':(it.kind==='secret'?'🔑':'📖');
    let sub='';
    if(it.kind==='secret')sub='值 …'+E(it.valueTail||'')+(it.hasValue?'':' (未设)');
    else if(it.kind==='mcp')sub=E(it.transport)+' · '+E(it.summary||'');
    else sub=it.chars+' 字';
    h+='<div class="acc"><div class="hd"><span>'+icon+' '+E(it.name)+'<span class="badge cloud">'+E(it.kind)+'</span></span>'+
      '<button class="btn sec" data-injrm="'+E(it.kind)+'|'+E(it.name)+'">移除</button></div>'+
      '<div class="conv" style="cursor:default"><span class="muted">'+sub+'</span></div></div>';
  }
  const p=INJ.plan||{};
  h+='<div class="st">注入计划</div><div class="card">'+
    cr('档案项',(p.itemCount||0)+' 项')+cr('目标账号',(p.targetCount||0)+' 个')+cr('应注总量',(p.total||0)+' 次')+'</div>';
  if(p.accounts&&p.accounts.length){
    for(const a of p.accounts)h+='<div class="conv" style="cursor:default"><span>'+E(a.email)+'</span><span class="m">'+a.items.length+' 档</span></div>';
  } else h+='<div class="card muted">账号池为空; 到「切号」板块收录账号后即出现注入目标。</div>';
  return h;
}
function render(){
  renderNav();
  const main=document.getElementById('main');
  if(!S){main.innerHTML='<div class="muted">加载中…</div>';return;}
  let h='';
  if(S.board==='overview')h=renderOverview();
  else if(S.board==='switch')h=renderSwitch();
  else if(S.board==='backups')h=renderBackups();
  else if(S.board==='mcp')h=renderMcp();
  else if(S.board==='bridge')h=renderBridge();
  else if(S.board==='github')h=renderGithub();
  else if(S.board==='search')h=renderSearch();
  else if(S.board==='inject')h=renderInject();
  else if(S.board==='settings')h=renderSettings();
  main.innerHTML=h;
  const bk=document.getElementById('bk'); if(bk)bk.onclick=()=>vscode.postMessage({type:'backup-now'});
  const rf=document.getElementById('rf'); if(rf)rf.onclick=()=>vscode.postMessage({type:'refresh'});
  const back=document.getElementById('back'); if(back)back.onclick=()=>{CONV=null;render();};
  document.querySelectorAll('.conv[data-dir]').forEach(el=>el.onclick=(ev)=>{
    const t=ev.target;
    if(t&&t.classList&&t.classList.contains('mgr')){
      ev.stopPropagation();
      vscode.postMessage({type:'conv-manage',op:t.dataset.op,dir:el.dataset.dir,folder:el.dataset.folder,cascadeId:el.dataset.cid,source:el.dataset.source,title:el.dataset.title});
      return;
    }
    vscode.postMessage({type:'open-conv',dir:el.dataset.dir,folder:el.dataset.folder});
  });
  document.querySelectorAll('[data-cxrename]').forEach(el=>el.onclick=()=>vscode.postMessage({type:'cx-rename',cid:el.dataset.cxrename}));
  document.querySelectorAll('[data-cxarchive]').forEach(el=>el.onclick=()=>{const [cid,on]=el.dataset.cxarchive.split('|');vscode.postMessage({type:'cx-archive',cid:cid,on:on==='1'});});
  document.querySelectorAll('[data-cxdelete]').forEach(el=>el.onclick=()=>vscode.postMessage({type:'cx-delete',cid:el.dataset.cxdelete}));
  document.querySelectorAll('[data-memedit]').forEach(el=>el.onclick=()=>{const m=((MEM&&MEM.memories)||[]).find(x=>x.id===el.dataset.memedit);if(m)vscode.postMessage({type:'mem-edit',mem:m});});
  document.querySelectorAll('[data-memdel]').forEach(el=>el.onclick=()=>vscode.postMessage({type:'mem-delete',id:el.dataset.memdel}));
  if(S.board==='backups'&&!CONV&&CX===null&&MEM===null)cmd('loadTabData',{tab:'backups'});
  else if(S.board==='backups'&&!CONV&&CX===null)vscode.postMessage({type:'cx-list'});
  else if(S.board==='backups'&&!CONV&&MEM===null)vscode.postMessage({type:'mem-list'});
  const ma=document.getElementById('mcpAdd'); if(ma)ma.onclick=()=>vscode.postMessage({type:'mcp-add'});
  const mc=document.getElementById('mcpCfg'); if(mc)mc.onclick=()=>vscode.postMessage({type:'mcp-config'});
  const mr=document.getElementById('mcpRefresh'); if(mr)mr.onclick=()=>{MCPD=null;render();vscode.postMessage({type:'mcp-refresh'});};
  document.querySelectorAll('[data-mcptoggle]').forEach(el=>el.onclick=()=>vscode.postMessage({type:'mcp-toggle',name:el.dataset.mcptoggle}));
  document.querySelectorAll('[data-mcptool]').forEach(el=>el.onclick=()=>{const [sv,tl]=el.dataset.mcptool.split('|');vscode.postMessage({type:'mcp-tool-toggle',server:sv,tool:tl});});
  document.querySelectorAll('[data-mcpinstall]').forEach(el=>el.onclick=()=>vscode.postMessage({type:'mcp-install',name:el.dataset.mcpinstall}));
  if(S.board==='mcp'&&MCPD===null)cmd('loadTabData',{tab:'mcp'});
  const wrf=document.getElementById('winRf'); if(wrf)wrf.onclick=()=>{WIN=null;render();vscode.postMessage({type:'win-state'});};
  const wrl=document.getElementById('winRegL'); if(wrl)wrl.onclick=()=>{WIN=null;render();vscode.postMessage({type:'win-reg-local'});};
  const wrr=document.getElementById('winRegR'); if(wrr)wrr.onclick=()=>vscode.postMessage({type:'win-reg-remote'});
  const wur=document.getElementById('winUnreg'); if(wur)wur.onclick=()=>{WIN=null;render();vscode.postMessage({type:'win-unreg'});};
  document.querySelectorAll('[data-winrel]').forEach(el=>el.onclick=()=>{const [k,o]=el.dataset.winrel.split('|');vscode.postMessage({type:'win-release',key:k,owner:o});});
  const wo=document.getElementById('winOpen'); if(wo)wo.onclick=()=>vscode.postMessage({type:'win-open-desktop',account:''});
  const wan=document.getElementById('winAcctNew'); if(wan)wan.onclick=()=>vscode.postMessage({type:'win-acct-create'});
  document.querySelectorAll('[data-winopen]').forEach(el=>el.onclick=()=>vscode.postMessage({type:'win-open-desktop',account:el.dataset.winopen}));
  document.querySelectorAll('[data-winacctdel]').forEach(el=>el.onclick=()=>vscode.postMessage({type:'win-acct-destroy',name:el.dataset.winacctdel}));
  document.querySelectorAll('[data-winclone]').forEach(el=>el.onclick=()=>vscode.postMessage({type:'win-acct-clone',base:el.dataset.winclone}));
  const wqc=document.getElementById('winQcGo'); if(wqc)wqc.onclick=()=>{const s=document.getElementById('winQcAcct');vscode.postMessage({type:'win-open-desktop',account:(s&&s.value)||''});};
  if(S.board==='overview'&&WIN===null)vscode.postMessage({type:'win-state'});
  const pc=document.getElementById('poolCap'); if(pc)pc.onclick=()=>vscode.postMessage({type:'pool-capture'});
  const pr=document.getElementById('poolRf'); if(pr)pr.onclick=()=>{POOL=null;render();vscode.postMessage({type:'pool-list'});};
  document.querySelectorAll('[data-poolswitch]').forEach(el=>el.onclick=()=>vscode.postMessage({type:'pool-switch',email:el.dataset.poolswitch}));
  document.querySelectorAll('[data-poolremove]').forEach(el=>el.onclick=()=>vscode.postMessage({type:'pool-remove',email:el.dataset.poolremove}));
  if(S.board==='switch'&&POOL===null)cmd('loadTabData',{tab:'switch'});
  const bs=document.getElementById('brStart'); if(bs)bs.onclick=()=>vscode.postMessage({type:'bridge-start'});
  const bp=document.getElementById('brStop'); if(bp)bp.onclick=()=>vscode.postMessage({type:'bridge-stop'});
  const brf=document.getElementById('brRf'); if(brf)brf.onclick=()=>{BR=null;render();vscode.postMessage({type:'bridge-state'});};
  const btk=document.getElementById('brTok'); if(btk)btk.onclick=()=>vscode.postMessage({type:'bridge-copy-token'});
  if(S.board==='bridge'&&BR===null)cmd('loadTabData',{tab:'bridge'});
  const ga=document.getElementById('ghAdd'); if(ga)ga.onclick=()=>vscode.postMessage({type:'gh-add'});
  const gv=document.getElementById('ghVerify'); if(gv)gv.onclick=()=>{GH=null;render();vscode.postMessage({type:'gh-verify'});};
  const gr=document.getElementById('ghRf'); if(gr)gr.onclick=()=>{GH=null;render();vscode.postMessage({type:'gh-list'});};
  document.querySelectorAll('[data-ghremove]').forEach(el=>el.onclick=()=>vscode.postMessage({type:'gh-remove',login:el.dataset.ghremove}));
  document.querySelectorAll('[data-ghinject]').forEach(el=>el.onclick=()=>vscode.postMessage({type:'gh-inject',login:el.dataset.ghinject}));
  document.querySelectorAll('[data-ghrole]').forEach(el=>el.onclick=()=>{const [lg,rl]=el.dataset.ghrole.split('|');vscode.postMessage({type:'gh-role',login:lg,role:rl});});
  if(S.board==='github'&&GH===null)cmd('loadTabData',{tab:'github'});
  const wsGo=document.getElementById('wsGo'); const wsQ=document.getElementById('wsQ'); const wsE=document.getElementById('wsE');
  function doSearch(q){const query=q!==undefined?q:(wsQ?wsQ.value:'');if(!query)return;WS.running=true;render();vscode.postMessage({type:'ws-search',query:query,engine:wsE?wsE.value:'duckduckgo'});}
  if(wsGo)wsGo.onclick=()=>doSearch();
  if(wsQ)wsQ.onkeydown=(e)=>{if(e.key==='Enter')doSearch();};
  const wsC=document.getElementById('wsClear'); if(wsC)wsC.onclick=()=>vscode.postMessage({type:'ws-clear'});
  document.querySelectorAll('[data-wsurl]').forEach(el=>el.onclick=()=>vscode.postMessage({type:'ws-open',url:el.dataset.wsurl}));
  document.querySelectorAll('[data-wshist]').forEach(el=>el.onclick=()=>doSearch(el.dataset.wshist));
  const inja=document.getElementById('injAdd'); if(inja)inja.onclick=()=>vscode.postMessage({type:'inj-add'});
  const injm=document.getElementById('injMcp'); if(injm)injm.onclick=()=>vscode.postMessage({type:'inj-apply-mcp'});
  const injrf=document.getElementById('injRf'); if(injrf)injrf.onclick=()=>{INJ=null;render();vscode.postMessage({type:'inj-list'});};
  document.querySelectorAll('[data-injrm]').forEach(el=>el.onclick=()=>{const [k,nm]=el.dataset.injrm.split('|');vscode.postMessage({type:'inj-remove',kind:k,name:nm});});
  if(S.board==='inject'&&INJ===null)cmd('loadTabData',{tab:'inject'});
  const scl=document.getElementById('setCl'); if(scl)scl.onclick=()=>vscode.postMessage({type:'set-changelog'});
  const srf=document.getElementById('setRf'); if(srf)srf.onclick=()=>{SET=null;render();vscode.postMessage({type:'set-detail'});};
  document.querySelectorAll('[data-settoggle]').forEach(el=>el.onclick=()=>{const [k,on]=el.dataset.settoggle.split('|');SET=null;render();vscode.postMessage({type:'set-toggle',key:k,on:on==='1'});});
  document.querySelectorAll('[data-seturl]').forEach(el=>el.onclick=()=>vscode.postMessage({type:'set-open',url:el.dataset.seturl}));
  const sar=document.getElementById('setAcpReg'); if(sar)sar.onclick=()=>vscode.postMessage({type:'acp-registry'});
  const sal=document.getElementById('setAcpRl'); if(sal)sal.onclick=()=>{SET=null;render();vscode.postMessage({type:'acp-reload'});};
  document.querySelectorAll('[data-envopen]').forEach(el=>el.onclick=()=>vscode.postMessage({type:'env-open',path:el.dataset.envopen}));
  if(S.board==='settings'&&SET===null)cmd('loadTabData',{tab:'settings'});
}
window.addEventListener('message',e=>{const m=e.data||{};
  if(m.type==='state'){S=m.data;if(CONV&&S.board!=='backups')CONV=null;render();}
  else if(m.type==='tabData'){/* dao-vsix /shell 同构信封: 板块载荷紧随其后 */}
  else if(m.type==='mcp-detail'){MCPD=m.servers?{servers:m.servers,registry:m.registry||[]}:{error:m.error||'拉取失败'};if(S&&S.board==='mcp')render();}
  else if(m.type==='cx-list'){CX=m.sessions?{sessions:m.sessions}:{error:m.error||'拉取失败'};if(S&&S.board==='backups'&&!CONV)render();}
  else if(m.type==='mem-list'){MEM=m.memories?{memories:m.memories}:{error:m.error||'拉取失败'};if(S&&S.board==='backups'&&!CONV)render();}
  else if(m.type==='pool-list'){POOL={accounts:m.accounts||[],error:m.error||''};if(S&&S.board==='switch')render();}
  else if(m.type==='bridge-state'){BR=m;if(S&&S.board==='bridge')render();}
  else if(m.type==='win-state'){WIN=m.data?m.data:{error:m.error||'探活失败'};if(S&&(S.board==='overview'||S.board==='windows'))render();}
  else if(m.type==='gh-list'){GH={accounts:m.accounts||[]};if(S&&S.board==='github')render();}
  else if(m.type==='ws-progress'){WS.running=!!m.running;if(S&&S.board==='search')render();}
  else if(m.type==='ws-result'){WS={data:m.data,history:m.history||[],running:false};if(S&&S.board==='search')render();}
  else if(m.type==='inj-list'){INJ={items:m.items||[],plan:m.plan||{}};if(S&&S.board==='inject')render();}
  else if(m.type==='set-detail'){SET=m.data?m.data:{error:m.error||'拉取失败'};if(S&&S.board==='settings')render();}
  else if(m.type==='conv'){CONV=m;render();}
  else if(m.type==='conv-error'){CONV={meta:{},md:'读取失败: '+m.error,folder:''};render();}
  else if(m.type==='backup-progress'){const bk=document.getElementById('bk');if(bk){bk.disabled=m.running;bk.textContent=m.running?'备份中…':'立即备份 Cascade';}}
});
vscode.postMessage({type:'refresh'});
</script></body></html>`;
  }
}

function register(context, log, opts) {
  const panel = new UnifiedPanel(log, context, opts);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("dao.unified", panel, { webviewOptions: { retainContextWhenHidden: true } })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("dao.unified.open", () => {
      try { vscode.commands.executeCommand("dao.unified.focus"); } catch (_) {}
    })
  );
  // host-state 变更(账号/MCP/备份水位刷新)即回推面板。
  try {
    const sub = hostStateMod.subscribe(() => { try { panel._pushState(); } catch (_) {} });
    context.subscriptions.push(sub);
  } catch (_) {}
  return panel;
}

module.exports = { register, UnifiedPanel };
