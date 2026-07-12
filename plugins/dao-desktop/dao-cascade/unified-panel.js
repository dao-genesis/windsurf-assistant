// 道 · 归一面板(Devin Desktop 插件本源) —— 插件即一切、插件统领万物。
// ─────────────────────────────────────────────────────────────────────────────
// 把 dao-one 六大板块的核心能力搬进插件本体, 并**深度换源为插件自持真源**:
//   数据不取自 IDE 宿主, 而取自本插件的 host-state(fused/LS 端口·登录态)+ 本机备份树。
// 现落地板块(持续迭代扩充):
//   🏠 主页    — Cascade/Devin Desktop 账号·套餐·配额 + 备份水位 + 本地 MCP 概览(fused 真源)
//   💬 对话备份 — 扫描备份根: Cascade 账号与 Devin Cloud 账号同列, 点开即读转录(双源统一)
//   🧩 MCP     — 插件版完整管理: 明细/工具级+server级开关/重载/添加/配置直开(直连 LS)
//   🔀 切号    — 插件自持账号池(~/.dao/cascade-pool.json): 收录当前号/切换/移除, 无回退铁律
// 后续并入: 🌐 桥接 / 💉 反向注入 / 🐙 GitHub / 🔌 Proxy Pro / 🔎 浏览器搜索。
"use strict";
const vscode = require("vscode");
const backup = require("./backup");
const hostStateMod = require("./host-state");
const acctPool = require("./account-pool");

function nonce() { let s = ""; const c = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"; for (let i = 0; i < 24; i++) s += c[Math.floor(Math.random() * c.length)]; return s; }

class UnifiedPanel {
  constructor(log) { this._log = typeof log === "function" ? log : () => {}; this._view = null; this._board = "overview"; }

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
  async _refreshFused() {
    if (this._fusing) return; this._fusing = true;
    try {
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
    } catch (e) { this._log("[unified] refreshFused: " + e.message); }
    finally { this._fusing = false; }
  }

  _post(m) { if (this._view) try { this._view.webview.postMessage(m); } catch (_) {} }

  _onMessage(msg) {
    switch (msg.type) {
      case "nav": this._board = String(msg.board || "overview"); return this._pushState();
      case "refresh": this._refreshFused(); return this._pushState();
      case "open-conv": return this._openConversation(msg.dir, msg.folder);
      case "backup-now": return this._backupNow();
      case "mcp-detail": return this._mcpDetail();
      case "mcp-refresh": return this._mcpOp("RefreshMcpServers", {});
      case "mcp-toggle": return this._mcpOp("UpdateMcpServerInConfigFile", { serverId: String(msg.name || "") });
      case "mcp-tool-toggle": return this._mcpOp("ToggleMcpTool", { serverId: String(msg.server || ""), toolName: String(msg.tool || "") });
      case "mcp-add": return this._mcpAdd();
      case "mcp-config": return this._mcpConfigOpen();
      case "pool-list": return this._poolList();
      case "pool-capture": return this._poolCapture();
      case "pool-switch": return this._poolSwitch(String(msg.email || ""));
      case "pool-remove": return this._poolRemove(String(msg.email || ""));
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
    return {
      board: this._board,
      lsReady,
      account: fused.account || null,
      mcp: fused.mcp || null,
      cascadeBackup: fused.cascadeBackup || null,
      auth: hs.auth || null,
      backups,
    };
  }

  _pushState() { this._post({ type: "state", data: this._snapshot() }); }

  _openConversation(dir, folder) {
    try {
      const c = backup.readConversation(undefined, dir, folder);
      this._post({ type: "conv", dir, folder, meta: c.meta, md: c.md, path: c.path });
    } catch (e) { this._post({ type: "conv-error", error: e.message }); }
  }

  // MCP 完整管理(插件版直连 LS): 明细(含工具/prompts/错误) + server 级开关 + 工具级开关 + 重载 + 添加 + 配置直开。
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

  async _mcpAdd() {
    try {
      const ls = require("./ls-bridge");
      const id = await vscode.window.showInputBox({ prompt: "MCP server 名称(写入 mcp_config.json 的键)" });
      if (!id) return;
      const tpl = await vscode.window.showInputBox({
        prompt: 'server 配置 JSON(如 {"command":"npx","args":[...]} 或 {"serverUrl":...})',
        value: '{"command":"","args":[]}' });
      if (!tpl) return;
      let tplObj; try { tplObj = JSON.parse(tpl); } catch (e) { vscode.window.showErrorMessage("JSON 无效: " + e.message); return; }
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
h2{font-size:15px;margin:0 0 4px}
</style></head><body>
<div class="wrap">
  <div class="nav" id="nav"></div>
  <div class="main" id="main"><div class="muted">加载中…</div></div>
</div>
<script nonce="${n}">
const vscode=acquireVsCodeApi();
let S=null, CONV=null;
const BOARDS=[["overview","🏠 主页"],["switch","🔀 切号"],["backups","💬 对话备份"],["mcp","🧩 MCP"]];
function E(s){return String(s==null?"":s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function renderNav(){document.getElementById('nav').innerHTML=BOARDS.map(([k,t])=>
  '<button data-b="'+k+'" class="'+(S&&S.board===k?'on':'')+'">'+t+'</button>').join('');
  document.querySelectorAll('.nav button').forEach(b=>b.onclick=()=>{CONV=null;vscode.postMessage({type:'nav',board:b.dataset.b})});}
function q(x){return (x===0||x)?(x+'%'):'—';}
function renderOverview(){
  const a=S.account||{}, mb=S.mcp&&S.mcp.servers, cb=S.cascadeBackup;
  const run=mb?mb.filter(s=>String(s.status||'').toUpperCase().indexOf('RUN')>=0).length:0;
  let h='<h2>归一主页 · 插件自持真源</h2><div class="muted" style="margin-bottom:10px">数据源: 本插件 host-state(fused)+ 本机备份树, 不依赖 IDE 宿主。</div>';
  h+='<div class="st">Cascade · Devin Desktop 账号</div><div class="card">';
  if(a.email){h+=cr('账号',(a.name?E(a.name)+' · ':'')+E(a.email));}
  else h+='<div class="cr muted">未获取到账号(LS '+(S.lsReady?'就绪':'未就绪')+', 打开 Cascade 面板登录后自动同步)</div>';
  if(a.plan)h+=cr('套餐',E(a.plan));
  if(a.dailyQuotaPct!==undefined||a.weeklyQuotaPct!==undefined)h+=cr('配额(日/周)',q(a.dailyQuotaPct)+' / '+q(a.weeklyQuotaPct));
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
  return h;
}
function cr(l,v){return '<div class="cr"><span class="l">'+E(l)+'</span><span class="v">'+v+'</span></div>';}
function renderBackups(){
  if(CONV){return renderConv();}
  let h='<div class="row"><h2 style="flex:1">对话备份 · 双源统一</h2>'+
    '<button class="btn" id="bk">立即备份 Cascade</button>'+
    '<button class="btn sec" id="rf">刷新</button></div>';
  h+='<div class="muted" style="margin-bottom:10px">Cascade(本机)与 Devin Cloud 账号同结构、同列并出; 点击任一对话查看转录。</div>';
  const accs=S.backups.accounts;
  if(!accs.length){h+='<div class="card muted">暂无备份。点「立即备份 Cascade」导出本机对话。</div>';return h;}
  for(const a of accs){
    const cls=a.source==='cloud'?'cloud':(a.source==='mixed'?'mixed':'');
    h+='<div class="acc"><div class="hd"><span>'+E(a.email)+
      '<span class="badge '+cls+'">'+(a.source==='cloud'?'Devin Cloud':(a.source==='mixed'?'混合':'Cascade'))+'</span></span>'+
      '<span class="muted" style="font-weight:400">'+a.convCount+' 条</span></div>';
    for(const c of a.conversations){
      h+='<div class="conv'+(c.isArchived?' arch':'')+'" data-dir="'+E(a.dir)+'" data-folder="'+E(c.folder)+'">'+
        '<span>'+(c.convNo?('#'+c.convNo+' '):'')+E(c.title)+(c.isArchived?' 🗄':'')+'</span>'+
        '<span class="m">'+E(String(c.lastModifiedTime||c.backedUpAt||'').replace('T',' ').slice(0,16))+'</span></div>';
    }
    h+='</div>';
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
function render(){
  renderNav();
  const main=document.getElementById('main');
  if(!S){main.innerHTML='<div class="muted">加载中…</div>';return;}
  let h='';
  if(S.board==='overview')h=renderOverview();
  else if(S.board==='switch')h=renderSwitch();
  else if(S.board==='backups')h=renderBackups();
  else if(S.board==='mcp')h=renderMcp();
  main.innerHTML=h;
  const bk=document.getElementById('bk'); if(bk)bk.onclick=()=>vscode.postMessage({type:'backup-now'});
  const rf=document.getElementById('rf'); if(rf)rf.onclick=()=>vscode.postMessage({type:'refresh'});
  const back=document.getElementById('back'); if(back)back.onclick=()=>{CONV=null;render();};
  document.querySelectorAll('.conv[data-dir]').forEach(el=>el.onclick=()=>vscode.postMessage({type:'open-conv',dir:el.dataset.dir,folder:el.dataset.folder}));
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
}
window.addEventListener('message',e=>{const m=e.data||{};
  if(m.type==='state'){S=m.data;if(CONV&&S.board!=='backups')CONV=null;render();}
  else if(m.type==='mcp-detail'){MCPD=m.servers?{servers:m.servers}:{error:m.error||'拉取失败'};if(S&&S.board==='mcp')render();}
  else if(m.type==='pool-list'){POOL={accounts:m.accounts||[],error:m.error||''};if(S&&S.board==='switch')render();}
  else if(m.type==='conv'){CONV=m;render();}
  else if(m.type==='conv-error'){CONV={meta:{},md:'读取失败: '+m.error,folder:''};render();}
  else if(m.type==='backup-progress'){const bk=document.getElementById('bk');if(bk){bk.disabled=m.running;bk.textContent=m.running?'备份中…':'立即备份 Cascade';}}
});
vscode.postMessage({type:'refresh'});
</script></body></html>`;
  }
}

function register(context, log, opts) {
  const panel = new UnifiedPanel(log);
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
