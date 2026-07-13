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
//   🔌 Proxy Pro — 插件自持第三方模型渠道 + 模型路由(proxy-pro.js): 填 Key 即全量识别模型, 与官方模型并存
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

function nonce() { let s = ""; const c = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"; for (let i = 0; i < 24; i++) s += c[Math.floor(Math.random() * c.length)]; return s; }

class UnifiedPanel {
  constructor(log, ctx) {
    this._log = typeof log === "function" ? log : () => {};
    this._view = null; this._board = "overview";
    this._extRoot = (ctx && ctx.extensionUri && ctx.extensionUri.fsPath) || "";
    this._storageDir = (ctx && ctx.globalStorageUri && ctx.globalStorageUri.fsPath) || "";
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
      const acct = (hs.fused && hs.fused.account) || {};
      const ls = require("./ls-bridge");
      const signedIn = !!((hs.auth && (hs.auth.loggedIn === true || hs.auth.state === "signed-in" || hs.auth.apiKey || hs.auth.userName || hs.auth.name)) ||
        acct.email || acct.name || ls.apiKey());
      hostStateMod.publishFused("engines", {
        cascade: { ready: !!(hs.lsPort && hs.csrfToken), lsPort: hs.lsPort || 0, signedIn,
          name: (hs.auth && (hs.auth.userName || hs.auth.name || hs.auth.email)) || acct.name || acct.email || "" },
        devinLocal: { bin: !!bin, signedIn: !!auth.loggedIn, name: auth.name || "" },
        devinCloud: { signedIn: !!auth.loggedIn, name: auth.name || "",
          endpoint: "wss://app.devin.ai/api/acp/live" },
      });
    } catch (e) { this._log("[unified] refreshEngines: " + e.message); }
  }

  _post(m) { if (this._view) try { this._view.webview.postMessage(m); } catch (_) {} }

  _onMessage(msg) {
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
      case "px-list": return this._pxList();
      case "px-add": return this._pxAdd();
      case "px-remove": return this._pxRemove(String(msg.name || ""));
      case "px-refresh": return this._pxRefresh(String(msg.name || ""));
      case "px-route": return this._pxRoute();
      case "ws-search": return this._wsSearch(String(msg.query || ""), String(msg.engine || ""));
      case "ws-open": return vscode.env.openExternal(vscode.Uri.parse(String(msg.url || ""))).then(undefined, () => {});
      case "ws-clear": return this._wsClear();
      case "inj-list": return this._injList();
      case "inj-add": return this._injAdd();
      case "inj-remove": return this._injRemove(String(msg.kind || ""), String(msg.name || ""));
      case "inj-apply-mcp": return this._injApplyMcp();
      case "copy": return vscode.env.clipboard.writeText(String(msg.text || "")).then(undefined, () => {});
      default: return;
    }
  }

  // 归一数据快照(插件自持真源): fused + LS 就绪态 + 备份树扫描。
  _snapshot() {
    let hs = {};
    try { hs = hostStateMod.loadPersisted() || hostStateMod.hostState(); } catch (_) { hs = {}; }
    const fused = (hs && hs.fused) || {};
    const lsReady = !!(hs && hs.lsPort && hs.csrfToken);
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
      const r = await ls.call("GetMcpServerStates", {});
      const servers = ((r && r.states) || []).map((s) => {
        const off = new Set((s.spec || {}).disabledTools || []);
        return {
          name: (s.spec || {}).serverName || "",
          status: (s.status || "").replace("MCP_SERVER_STATUS_", ""),
          disabled: !!(s.spec || {}).disabled,
          error: s.error || "",
          tools: (s.tools || []).map((t) => ({ name: t.name, description: t.description || "", off: off.has(t.name) })),
          prompts: (s.prompts || []).map((p) => ({ name: p.name })),
        };
      });
      this._post({ type: "mcp-detail", servers });
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
        const s = pick.srv;
        id = (s.name || "").replace(/^devin\//, "") || s.title;
        const pkg = (s.packages || [])[0];
        const remote = (s.remotes || [])[0];
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

  // Proxy Pro 板块(插件自持模型渠道+路由): apiKey 永不出后端, 只回尾4位。
  _pxList() { this._post({ type: "px-list", data: proxyPro.listView(), file: proxyPro.cfgPath() }); }

  async _pxAdd() {
    try {
      const presets = proxyPro.PRESETS.map((p) => ({ label: p.n, description: p.u, detail: "拿 Key: " + p.r, _p: p }));
      presets.push({ label: "＋ 自定义渠道", description: "手填名称/类型/base URL", _p: null });
      const pick = await vscode.window.showQuickPick(presets, { placeHolder: "选择模型渠道预设(或自定义)" });
      if (!pick) return;
      let name = pick._p ? pick._p.n : await vscode.window.showInputBox({ prompt: "渠道名称" });
      if (!name) return;
      const type = pick._p ? pick._p.t : ((await vscode.window.showQuickPick(["openai", "anthropic"], { placeHolder: "渠道类型" })) || "openai");
      const baseURL = pick._p ? pick._p.u : await vscode.window.showInputBox({ prompt: "base URL(如 https://api.deepseek.com/v1)" });
      if (!baseURL) return;
      const apiKey = await vscode.window.showInputBox({ prompt: "API Key(留空=保留原 Key)", password: true, ignoreFocusOut: true });
      const r = await proxyPro.addChannel(name, type, baseURL, apiKey || "");
      vscode.window.showInformationMessage("渠道 " + r.name + " 已配置 · 识别 " + r.models + " 模型 · " + (r.verify === "ok" ? "在线✓" : r.verify === "bad" ? "Key 无效" : "待核"));
    } catch (e) { vscode.window.showErrorMessage("配置渠道失败: " + e.message); }
    this._pxList();
  }

  _pxRemove(name) { try { proxyPro.removeChannel(name); } catch (e) { vscode.window.showErrorMessage(e.message); } this._pxList(); }

  async _pxRefresh(name) {
    try { const r = await proxyPro.refreshModels(name); vscode.window.showInformationMessage("渠道 " + name + " 识别 " + r.models + " 模型 · " + (r.verify === "ok" ? "在线✓" : r.verify)); }
    catch (e) { vscode.window.showErrorMessage("刷新模型失败: " + e.message); }
    this._pxList();
  }

  // 配路由适配整合版: 官方模型 UID 直选自 LS 模型清单(listModels 真源, 含标签/倍率),
  // LS 未就绪或选择手填时兑底输入框。
  async _pxRoute() {
    try {
      const view = proxyPro.listView();
      const withModels = view.channels.filter((c) => c.modelCount > 0);
      if (!withModels.length) { vscode.window.showWarningMessage("先添加带 Key 的渠道并识别模型, 再配路由"); return; }
      let uid;
      let official = [];
      try { const ls = require("./ls-bridge"); if (ls.ready() && ls.apiKey()) official = await ls.listModels(); } catch (_) {}
      if (official.length) {
        const up = await vscode.window.showQuickPick(
          official.map((m) => ({ label: m.label + (m.credit != null ? "  ·  " + m.credit + "x" : ""), description: m.uid, _uid: m.uid }))
            .concat([{ label: "＋ 手填官方模型 UID", description: "", _uid: null }]),
          { placeHolder: "选要接管的官方模型(路由到第三方渠道)", matchOnDescription: true });
        if (!up) return;
        uid = up._uid !== null ? up._uid : await vscode.window.showInputBox({ prompt: "官方模型 UID(留空则解除某路由)" });
      } else {
        uid = await vscode.window.showInputBox({ prompt: "官方模型 UID(留空则解除某路由)" });
      }
      if (uid === undefined) return;
      const cPick = await vscode.window.showQuickPick(withModels.map((c) => ({ label: c.name, description: c.modelCount + " 模型", _c: c })), { placeHolder: "路由到哪个渠道(取消=解除该 UID 路由)" });
      if (!cPick) { proxyPro.setRoute(uid, "", ""); this._pxList(); return; }
      const mPick = await vscode.window.showQuickPick(cPick._c.models, { placeHolder: "选择目标模型" });
      if (!mPick) return;
      proxyPro.setRoute(uid, cPick._c.name, mPick);
      vscode.window.showInformationMessage("路由 " + uid + " → " + cPick._c.name + "/" + mPick);
    } catch (e) { vscode.window.showErrorMessage("配置路由失败: " + e.message); }
    this._pxList();
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

  _poolCapture() {
    try {
      const ls = require("./ls-bridge");
      const hs = hostStateMod.loadPersisted() || hostStateMod.hostState();
      const r = acctPool.captureCurrent(ls.apiKey(), (hs.fused || {}).account || {});
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
.nav{width:132px;flex:0 0 132px;border-right:1px solid var(--vscode-panel-border,#3334);padding:6px 0;overflow:auto}
.nav button{display:block;width:100%;text-align:left;background:none;border:none;color:inherit;padding:8px 12px;cursor:pointer;font:inherit;opacity:.75}
.nav button:hover{background:var(--vscode-list-hoverBackground,#8881)}
.nav button.on{opacity:1;background:var(--vscode-list-activeSelectionBackground,#0a5);color:var(--vscode-list-activeSelectionForeground,#fff);border-radius:0 6px 6px 0}
.main{flex:1;overflow:auto;padding:14px 16px}
.st{font-size:11px;text-transform:uppercase;letter-spacing:.06em;opacity:.6;margin:14px 0 6px}
.st:first-child{margin-top:0}
.card{border:1px solid var(--vscode-panel-border,#3334);border-radius:8px;padding:10px 12px;margin-bottom:10px}
.cr{display:flex;justify-content:space-between;gap:12px;padding:3px 0}
.cr .l{opacity:.65}.cr .v{text-align:right;word-break:break-all}
.acc{border:1px solid var(--vscode-panel-border,#3334);border-radius:8px;margin-bottom:10px;overflow:hidden}
.acc .hd{display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:var(--vscode-list-hoverBackground,#8881);font-weight:600}
.badge{font-size:10px;padding:1px 7px;border-radius:10px;background:#0a53;margin-left:6px;font-weight:400}
.badge.cloud{background:#37a3}.badge.mixed{background:#a703}
.conv{padding:6px 12px;border-top:1px solid var(--vscode-panel-border,#2223);cursor:pointer;display:flex;justify-content:space-between;gap:8px}
.conv:hover{background:var(--vscode-list-hoverBackground,#8881)}
.conv .m{opacity:.5;font-size:11px;white-space:nowrap}
.arch{opacity:.5}
.btn{background:var(--vscode-button-background,#0a5);color:var(--vscode-button-foreground,#fff);border:none;border-radius:5px;padding:5px 12px;cursor:pointer;font:inherit}
.btn.sec{background:var(--vscode-button-secondaryBackground,#4443)}
.row{display:flex;gap:8px;align-items:center;margin-bottom:10px}
.muted{opacity:.55}
pre{white-space:pre-wrap;word-break:break-word;background:var(--vscode-textCodeBlock-background,#0002);padding:10px;border-radius:6px;max-height:64vh;overflow:auto}
.back{cursor:pointer;color:var(--vscode-textLink-foreground,#4af)}
.mgr{cursor:pointer;opacity:.55;margin-left:2px;padding:3px 4px;display:inline-block}
.mgr:hover{opacity:1;background:var(--vscode-list-hoverBackground,#8882);border-radius:4px}
h2{font-size:15px;margin:0 0 4px}
</style></head><body>
<div class="wrap">
  <div class="nav" id="nav"></div>
  <div class="main" id="main"><div class="muted">加载中…</div></div>
</div>
<script nonce="${n}">
const vscode=acquireVsCodeApi();
let S=null, CONV=null;
const BOARDS=[["overview","🏠 主页"],["switch","🔀 切号"],["backups","💬 对话备份"],["mcp","🧩 MCP"],["bridge","🌐 桥接"],["github","🐙 GitHub"],["proxy","🔌 Proxy Pro"],["search","🔎 搜索"],["inject","💉 反向注入"]];
function E(s){return String(s==null?"":s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function renderNav(){document.getElementById('nav').innerHTML=BOARDS.map(([k,t])=>
  '<button data-b="'+k+'" class="'+(S&&S.board===k?'on':'')+'">'+t+'</button>').join('');
  document.querySelectorAll('.nav button').forEach(b=>b.onclick=()=>{CONV=null;vscode.postMessage({type:'nav',board:b.dataset.b})});}
function q(x){return (x===0||x)?(x+'%'):'—';}
function renderOverview(){
  const a=S.account||{}, mb=S.mcp&&S.mcp.servers, cb=S.cascadeBackup, eg=S.engines;
  const run=mb?mb.filter(s=>String(s.status||'').toUpperCase().indexOf('RUN')>=0).length:0;
  let h='<h2>归一主页 · 插件自持真源</h2><div class="muted" style="margin-bottom:10px">数据源: 本插件 host-state(fused)+ 本机备份树, 不依赖 IDE 宿主。</div>';
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
  const mb=MCPD.servers||[];
  if(!mb.length){h+='<div class="card muted">无已配置的 MCP 服务器。点「添加」或「配置文件」写入 server 后重载。</div>';return h;}
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
  return h;
}
let PX=null;
function renderProxy(){
  let h='<div class="row"><h2 style="flex:1">Proxy Pro · 插件自持模型路由</h2>'+
    '<button class="btn" id="pxAdd">添加渠道</button>'+
    '<button class="btn sec" id="pxRoute">配路由</button>'+
    '<button class="btn sec" id="pxRf">刷新</button></div>';
  h+='<div class="muted" style="margin-bottom:10px">第三方模型渠道存 ~/.dao/proxy-channels.json(mode 600), 只填 Key 即经 /v1/models 全量识别; apiKey 只显尾4位。渠道模型可路由到官方模型 UID(与官方并存)。</div>';
  if(PX===null){h+='<div class="card muted">加载渠道…</div>';return h;}
  const ch=PX.channels||[];
  if(!ch.length){h+='<div class="card muted">尚无渠道。点「添加渠道」选预设(OpenRouter/DeepSeek/GLM/OpenAI…)或自定义, 填 Key 即自动识别模型。</div>';}
  for(const c of ch){
    const st=c.verify==='ok'?'✓ 在线':(c.verify==='pending'?'⏳ 待核':'✗ Key 无效');
    h+='<div class="acc"><div class="hd"><span>'+E(c.name)+
      '<span class="badge cloud">'+E(c.type)+'</span>'+
      '<span class="badge'+(c.verify==='ok'?'':' cloud')+'">'+st+'</span></span><span>'+
      '<button class="btn sec" data-pxref="'+E(c.name)+'">识别模型</button> '+
      '<button class="btn sec" data-pxrm="'+E(c.name)+'">移除</button></span></div>'+
      '<div class="conv" style="cursor:default"><span class="muted">'+E(c.baseURL)+' · Key …'+E(c.keyTail||'(无)')+' · '+c.modelCount+' 模型</span></div>';
    if(c.models&&c.models.length){
      const show=c.models.slice(0,12).map(m=>E(m)).join('、')+(c.models.length>12?(' …等 '+c.models.length+' 个'):'');
      h+='<div class="conv" style="cursor:default"><span class="muted">模型: '+show+'</span></div>';
    }
    h+='</div>';
  }
  const rt=PX.routes||[];
  h+='<div class="st">模型路由</div>';
  if(!rt.length)h+='<div class="card muted">暂无路由。点「配路由」把官方模型 UID 指向某渠道模型。</div>';
  else{h+='<div class="card">';for(const r of rt)h+=cr(E(r.uid),'→ '+E(r.channel)+' / '+E(r.model)+' <span class="back" data-pxunroute="'+E(r.uid)+'">解除</span>');h+='</div>';}
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
  else if(S.board==='proxy')h=renderProxy();
  else if(S.board==='search')h=renderSearch();
  else if(S.board==='inject')h=renderInject();
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
  if(S.board==='backups'&&!CONV&&CX===null)vscode.postMessage({type:'cx-list'});
  if(S.board==='backups'&&!CONV&&MEM===null)vscode.postMessage({type:'mem-list'});
  const ma=document.getElementById('mcpAdd'); if(ma)ma.onclick=()=>vscode.postMessage({type:'mcp-add'});
  const mc=document.getElementById('mcpCfg'); if(mc)mc.onclick=()=>vscode.postMessage({type:'mcp-config'});
  const mr=document.getElementById('mcpRefresh'); if(mr)mr.onclick=()=>{MCPD=null;render();vscode.postMessage({type:'mcp-refresh'});};
  document.querySelectorAll('[data-mcptoggle]').forEach(el=>el.onclick=()=>vscode.postMessage({type:'mcp-toggle',name:el.dataset.mcptoggle}));
  document.querySelectorAll('[data-mcptool]').forEach(el=>el.onclick=()=>{const [sv,tl]=el.dataset.mcptool.split('|');vscode.postMessage({type:'mcp-tool-toggle',server:sv,tool:tl});});
  if(S.board==='mcp'&&MCPD===null)vscode.postMessage({type:'mcp-detail'});
  const pc=document.getElementById('poolCap'); if(pc)pc.onclick=()=>vscode.postMessage({type:'pool-capture'});
  const pr=document.getElementById('poolRf'); if(pr)pr.onclick=()=>{POOL=null;render();vscode.postMessage({type:'pool-list'});};
  document.querySelectorAll('[data-poolswitch]').forEach(el=>el.onclick=()=>vscode.postMessage({type:'pool-switch',email:el.dataset.poolswitch}));
  document.querySelectorAll('[data-poolremove]').forEach(el=>el.onclick=()=>vscode.postMessage({type:'pool-remove',email:el.dataset.poolremove}));
  if(S.board==='switch'&&POOL===null)vscode.postMessage({type:'pool-list'});
  const bs=document.getElementById('brStart'); if(bs)bs.onclick=()=>vscode.postMessage({type:'bridge-start'});
  const bp=document.getElementById('brStop'); if(bp)bp.onclick=()=>vscode.postMessage({type:'bridge-stop'});
  const brf=document.getElementById('brRf'); if(brf)brf.onclick=()=>{BR=null;render();vscode.postMessage({type:'bridge-state'});};
  const btk=document.getElementById('brTok'); if(btk)btk.onclick=()=>vscode.postMessage({type:'bridge-copy-token'});
  if(S.board==='bridge'&&BR===null)vscode.postMessage({type:'bridge-state'});
  const ga=document.getElementById('ghAdd'); if(ga)ga.onclick=()=>vscode.postMessage({type:'gh-add'});
  const gv=document.getElementById('ghVerify'); if(gv)gv.onclick=()=>{GH=null;render();vscode.postMessage({type:'gh-verify'});};
  const gr=document.getElementById('ghRf'); if(gr)gr.onclick=()=>{GH=null;render();vscode.postMessage({type:'gh-list'});};
  document.querySelectorAll('[data-ghremove]').forEach(el=>el.onclick=()=>vscode.postMessage({type:'gh-remove',login:el.dataset.ghremove}));
  document.querySelectorAll('[data-ghinject]').forEach(el=>el.onclick=()=>vscode.postMessage({type:'gh-inject',login:el.dataset.ghinject}));
  document.querySelectorAll('[data-ghrole]').forEach(el=>el.onclick=()=>{const [lg,rl]=el.dataset.ghrole.split('|');vscode.postMessage({type:'gh-role',login:lg,role:rl});});
  if(S.board==='github'&&GH===null)vscode.postMessage({type:'gh-list'});
  const pxa=document.getElementById('pxAdd'); if(pxa)pxa.onclick=()=>vscode.postMessage({type:'px-add'});
  const pxrt=document.getElementById('pxRoute'); if(pxrt)pxrt.onclick=()=>vscode.postMessage({type:'px-route'});
  const pxrf=document.getElementById('pxRf'); if(pxrf)pxrf.onclick=()=>{PX=null;render();vscode.postMessage({type:'px-list'});};
  document.querySelectorAll('[data-pxref]').forEach(el=>el.onclick=()=>vscode.postMessage({type:'px-refresh',name:el.dataset.pxref}));
  document.querySelectorAll('[data-pxrm]').forEach(el=>el.onclick=()=>vscode.postMessage({type:'px-remove',name:el.dataset.pxrm}));
  document.querySelectorAll('[data-pxunroute]').forEach(el=>el.onclick=()=>vscode.postMessage({type:'px-route',uid:el.dataset.pxunroute}));
  if(S.board==='proxy'&&PX===null)vscode.postMessage({type:'px-list'});
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
  if(S.board==='inject'&&INJ===null)vscode.postMessage({type:'inj-list'});
}
window.addEventListener('message',e=>{const m=e.data||{};
  if(m.type==='state'){S=m.data;if(CONV&&S.board!=='backups')CONV=null;render();}
  else if(m.type==='mcp-detail'){MCPD=m.servers?{servers:m.servers}:{error:m.error||'拉取失败'};if(S&&S.board==='mcp')render();}
  else if(m.type==='cx-list'){CX=m.sessions?{sessions:m.sessions}:{error:m.error||'拉取失败'};if(S&&S.board==='backups'&&!CONV)render();}
  else if(m.type==='mem-list'){MEM=m.memories?{memories:m.memories}:{error:m.error||'拉取失败'};if(S&&S.board==='backups'&&!CONV)render();}
  else if(m.type==='pool-list'){POOL={accounts:m.accounts||[],error:m.error||''};if(S&&S.board==='switch')render();}
  else if(m.type==='bridge-state'){BR=m;if(S&&S.board==='bridge')render();}
  else if(m.type==='gh-list'){GH={accounts:m.accounts||[]};if(S&&S.board==='github')render();}
  else if(m.type==='px-list'){PX=m.data||{channels:[],routes:[]};if(S&&S.board==='proxy')render();}
  else if(m.type==='ws-progress'){WS.running=!!m.running;if(S&&S.board==='search')render();}
  else if(m.type==='ws-result'){WS={data:m.data,history:m.history||[],running:false};if(S&&S.board==='search')render();}
  else if(m.type==='inj-list'){INJ={items:m.items||[],plan:m.plan||{}};if(S&&S.board==='inject')render();}
  else if(m.type==='conv'){CONV=m;render();}
  else if(m.type==='conv-error'){CONV={meta:{},md:'读取失败: '+m.error,folder:''};render();}
  else if(m.type==='backup-progress'){const bk=document.getElementById('bk');if(bk){bk.disabled=m.running;bk.textContent=m.running?'备份中…':'立即备份 Cascade';}}
});
vscode.postMessage({type:'refresh'});
</script></body></html>`;
  }
}

function register(context, log, opts) {
  const panel = new UnifiedPanel(log, context);
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
