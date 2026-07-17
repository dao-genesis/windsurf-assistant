// 道 · Agent 看板 — 官方 Devin Desktop「Agent 模式」整窗会话看板的插件版对位。
// ─────────────────────────────────────────────────────────────────────────────
// 官方 Agent 模式 = 整窗 Devin 云会话看板(Board/List 双视图 + Spaces + 筛选/搜索 +
// New session)。插件版同源复刻, 数据真源(活体实证, 不臆测):
//   · 云端: Devin Cloud ACP `session/list`(acp-wss) — 每会话带 cognition.ai/* 元数据
//     (statusEnum/url/isArchived/isPinned/isUnread/sessionTags/createdAt), 与
//     app.devin.ai 看板同一批数据;
//   · 本机: Cascade 轨迹(GetAllCascadeTrajectories, 与归一面板会话管理同源)。
// 新建会话: session/new(+可选首条 prompt) → 即在 Devin Cloud 起真实会话。
"use strict";

const vscode = require("vscode");
const crypto = require("crypto");

function nonce() { return crypto.randomBytes(16).toString("base64"); }

const STATUS_LABEL = {
  working: "运行中", blocked: "待处理", finished: "已完成",
  expired: "已过期", suspend_requested: "挂起中", suspend_requested_frontend: "挂起中",
  resumed: "运行中", resume_requested: "唤醒中",
};

// cognition.ai/* 元数据 → 扁平会话对象(前端直接消费)。
function mapCloudSession(s) {
  const meta = (s && s._meta) || {};
  const g = (k) => meta["cognition.ai/" + k];
  return {
    kind: "cloud",
    id: s.sessionId || "",
    title: s.title || s.sessionId || "(无标题)",
    status: String(g("statusEnum") || "").toLowerCase(),
    url: g("url") || ("https://app.devin.ai/sessions/" + String(s.sessionId || "").replace(/^devin-/, "")),
    archived: !!g("isArchived"),
    pinned: !!g("isPinned"),
    unread: !!g("isUnread"),
    tags: g("sessionTags") || [],
    origin: g("sessionOrigin") || "",
    createdAt: g("createdAt") || "",
    updatedAt: g("sortUpdatedAt") || s.updatedAt || "",
  };
}

class AgentBoardPanel {
  constructor(log) {
    this._log = log || (() => {});
    this._panel = null;
  }

  open() {
    if (this._panel) { this._panel.reveal(); return; }
    const p = vscode.window.createWebviewPanel("dao.agentBoard", "Devin — Agent",
      vscode.ViewColumn.One, { enableScripts: true, retainContextWhenHidden: true });
    this._panel = p;
    p.onDidDispose(() => { this._panel = null; });
    p.webview.onDidReceiveMessage((m) => this._onMessage(m));
    p.webview.html = this._html();
    this._load();
  }

  _post(m) { if (this._panel) this._panel.webview.postMessage(m); }

  async _onMessage(msg) {
    try {
      if (msg.type === "load") return this._load();
      if (msg.type === "open-cloud") {
        return vscode.env.openExternal(vscode.Uri.parse(String(msg.url || "")));
      }
      if (msg.type === "open-cascade") {
        // 本机会话 → 聚焦 Cascade 面板载入该轨迹(与面板「近期会话」点击同径)。
        try { await vscode.commands.executeCommand("dao.cascade.open"); } catch (_) {}
        return;
      }
      if (msg.type === "new-session") return this._newSession(String(msg.prompt || ""));
      if (msg.type === "editor-mode") {
        // Editor 标签 = 回编辑器(官方同语义: Agent 整窗让位于 IDE)。
        if (this._panel) this._panel.dispose();
        return;
      }
    } catch (e) { this._log("[agent-board] " + e.message); }
  }

  // 云端 + 本机双源并载; 任一源失败不拖垮另一源(各自带 error 回推)。
  async _load() {
    this._post({ type: "loading" });
    const [cloud, local] = await Promise.all([this._loadCloud(), this._loadLocal()]);
    this._post({ type: "data", cloud, local });
  }

  async _loadCloud() {
    let client = null;
    try {
      const { AcpWssClient } = require("./acp-wss");
      client = new AcpWssClient({ log: this._log });
      await client.connect();
      const r = await client.listSessions();
      const list = ((r && r.sessions) || []).map(mapCloudSession)
        .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
      return { ok: true, sessions: list };
    } catch (e) {
      return { ok: false, error: e.message };
    } finally { try { if (client) client.stop(); } catch (_) {} }
  }

  async _loadLocal() {
    try {
      const ls = require("./ls-bridge");
      const r = await ls.call("GetAllCascadeTrajectories", {});
      const m = (r && r.trajectorySummaries) || {};
      const sessions = Object.keys(m).map((cid) => ({
        kind: "local", id: cid,
        title: m[cid].summary || cid,
        updatedAt: m[cid].lastModifiedTime || "",
        archived: !!m[cid].isArchived,
        status: "finished",
        workspace: (((m[cid].workspaces || [])[0] || {}).workspaceFolderAbsoluteUri) || "",
      })).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
      return { ok: true, sessions };
    } catch (e) { return { ok: false, error: e.message }; }
  }

  // New session(官方看板同语义): 云端 session/new + 首条 session/prompt。
  // 实机实证: 无首条 prompt 的 ACP 空会话不落库(刷新不可见且会话页 404),
  // 故首条任务描述为必填(与官方 New session composer 同义)。
  async _newSession(prompt) {
    if (!prompt.trim())
      return this._post({ type: "create-error", error: "首条任务描述必填(云端空会话不会持久化)" });
    let client = null;
    try {
      const { AcpWssClient } = require("./acp-wss");
      client = new AcpWssClient({ log: this._log });
      await client.connect();
      const r = await client.newSession("/");
      const sid = (r && r.sessionId) || "";
      client.prompt(prompt.trim()).catch(() => {});
      // prompt 送达云端后连接才可撤 — 留 3s 送信窗后释放。
      setTimeout(() => { try { client.stop(); } catch (_) {} }, 3000);
      const url = "https://app.devin.ai/sessions/" + sid.replace(/^devin-/, "");
      this._post({ type: "created", id: sid, url });
      vscode.env.openExternal(vscode.Uri.parse(url)).then(undefined, () => {});
      setTimeout(() => this._load(), 1500);
    } catch (e) {
      try { if (client) client.stop(); } catch (_) {}
      this._post({ type: "create-error", error: e.message });
    }
  }

  _html() {
    const n = nonce();
    return `<!DOCTYPE html><html lang="zh"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${n}'">
<style>
:root{color-scheme:light dark;--line:var(--vscode-widget-border,var(--vscode-panel-border));--dim:var(--vscode-descriptionForeground);--card:var(--vscode-input-background);--hover:var(--vscode-toolbar-hoverBackground,rgba(128,128,128,.15))}
html,body{height:100%;margin:0}body{display:flex;flex-direction:column;font:13px var(--vscode-font-family);color:var(--vscode-foreground);background:var(--vscode-editor-background)}
header{display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid var(--line)}
header .ttl{font-size:15px;font-weight:600}
#search{flex:0 1 260px;background:var(--card);border:1px solid var(--line);border-radius:6px;color:inherit;padding:4px 10px;font-size:12px}
.seg{display:flex;border:1px solid var(--line);border-radius:6px;overflow:hidden}
.seg button{border:none;background:transparent;color:var(--dim);padding:4px 12px;font-size:12px;cursor:pointer}
.seg button.on{background:var(--hover);color:var(--vscode-foreground)}
#newbtn{margin-left:auto;background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:none;border-radius:6px;padding:5px 14px;font-size:12px;cursor:pointer}
#refresh{background:transparent;border:1px solid var(--line);border-radius:6px;color:var(--dim);padding:4px 10px;cursor:pointer}
main{flex:1;display:flex;min-height:0}
aside{width:170px;border-right:1px solid var(--line);padding:12px 8px;display:flex;flex-direction:column;gap:2px}
aside .sp{padding:5px 10px;border-radius:6px;cursor:pointer;color:var(--dim);font-size:12.5px}
aside .sp.on{background:var(--hover);color:var(--vscode-foreground)}
aside .hd{font-size:10.5px;color:var(--dim);text-transform:uppercase;letter-spacing:.06em;padding:8px 10px 3px}
#content{flex:1;overflow:auto;padding:14px 16px}
.cols{display:flex;gap:14px;align-items:flex-start}
.col{flex:1;min-width:220px}
.col .chd{font-size:12px;color:var(--dim);margin-bottom:8px;display:flex;gap:6px;align-items:center}
.col .chd .cnt{background:var(--hover);border-radius:8px;padding:0 7px;font-size:11px}
.card{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:9px 11px;margin-bottom:8px;cursor:pointer}
.card:hover{border-color:var(--vscode-focusBorder)}
.card .t{font-weight:600;font-size:12.5px;line-height:1.35;word-break:break-word}
.card .m{display:flex;gap:6px;align-items:center;margin-top:5px;color:var(--dim);font-size:11px;flex-wrap:wrap}
.dot{width:7px;height:7px;border-radius:50%;display:inline-block}
.dot.working,.dot.resumed{background:#3fb950}.dot.blocked{background:#d29922}.dot.finished{background:#8b949e}.dot.expired{background:#6e7681}
.tag{border:1px solid var(--line);border-radius:6px;padding:0 5px;font-size:10px}
.pin{color:#d29922}.unread{width:7px;height:7px;border-radius:50%;background:var(--vscode-textLink-foreground);display:inline-block}
table{width:100%;border-collapse:collapse;font-size:12.5px}
th{color:var(--dim);text-align:left;font-weight:500;font-size:11px;padding:4px 8px;border-bottom:1px solid var(--line)}
td{padding:7px 8px;border-bottom:1px solid var(--line);cursor:pointer}
tr:hover td{background:var(--hover)}
.err{color:var(--vscode-errorForeground);padding:8px 0;font-size:12px}
.muted{color:var(--dim);padding:14px 0;text-align:center}
#modal{display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);align-items:center;justify-content:center}
#modal.show{display:flex}
#modal .box{background:var(--vscode-editor-background);border:1px solid var(--line);border-radius:10px;padding:16px;width:480px;max-width:92vw}
#modal textarea{width:100%;box-sizing:border-box;height:100px;background:var(--card);border:1px solid var(--line);border-radius:6px;color:inherit;padding:8px;font:12.5px var(--vscode-font-family);resize:vertical}
#modal .row{display:flex;gap:8px;justify-content:flex-end;margin-top:10px}
#modal button{border-radius:6px;padding:5px 14px;font-size:12px;cursor:pointer;border:1px solid var(--line);background:transparent;color:inherit}
#modal button.pri{background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:none}
#modal button.pri:disabled{opacity:.45;cursor:not-allowed}
</style></head><body>
<header>
  <span class="ttl">Devin</span>
  <div class="seg" id="modetabs"><button class="on">Agent</button><button id="mt-editor">Editor</button></div>
  <input id="search" placeholder="搜索会话…">
  <div class="seg" id="viewseg"><button data-v="board" class="on">Board</button><button data-v="list">List</button></div>
  <button id="refresh" title="刷新">↻</button>
  <button id="newbtn">＋ New Session</button>
</header>
<main>
  <aside id="spaces">
    <div class="hd">Spaces</div>
    <div class="sp on" data-sp="all">All Sessions</div>
    <div class="sp" data-sp="unread">未读</div>
    <div class="sp" data-sp="pinned">已置顶</div>
    <div class="sp" data-sp="archived">已归档</div>
    <div class="hd">本机</div>
    <div class="sp" data-sp="local">Cascade 会话</div>
  </aside>
  <div id="content"><div class="muted">加载中…</div></div>
</main>
<div id="modal"><div class="box">
  <div style="font-weight:600;margin-bottom:8px">New Session · Devin Cloud</div>
  <textarea id="nprompt" placeholder="首条任务描述(必填 — 云端空会话不会持久化)…"></textarea>
  <div class="row"><button id="ncancel">取消</button><button class="pri" id="ncreate" disabled>创建</button></div>
</div></div>
<script nonce="${n}">
const vs=acquireVsCodeApi();
const E=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const LBL=${JSON.stringify(STATUS_LABEL)};
let D={cloud:null,local:null},view="board",space="all",q="";
const $=s=>document.querySelector(s);
function ago(t){if(!t)return"";const d=Date.now()-new Date(t).getTime();if(!isFinite(d))return"";const m=Math.floor(d/60000);if(m<1)return"刚刚";if(m<60)return m+" 分钟前";const h=Math.floor(m/60);if(h<24)return h+" 小时前";return Math.floor(h/24)+" 天前";}
function filtered(){
  if(space==="local")return(D.local&&D.local.sessions||[]).filter(s=>!q||s.title.toLowerCase().includes(q));
  let l=(D.cloud&&D.cloud.sessions||[]);
  if(space==="archived")l=l.filter(s=>s.archived);else l=l.filter(s=>!s.archived);
  if(space==="unread")l=l.filter(s=>s.unread);
  if(space==="pinned")l=l.filter(s=>s.pinned);
  if(q)l=l.filter(s=>s.title.toLowerCase().includes(q));
  return l;
}
function card(s){return '<div class="card" data-k="'+s.kind+'" data-u="'+E(s.url||"")+'" data-i="'+E(s.id)+'">'+
  '<div class="t">'+(s.pinned?'<span class="pin">📌 </span>':"")+(s.unread?'<span class="unread"></span> ':"")+E(s.title)+'</div>'+
  '<div class="m"><span class="dot '+E(s.status)+'"></span><span>'+(LBL[s.status]||E(s.status)||"—")+'</span>'+
  (s.tags||[]).map(t=>'<span class="tag">'+E(t)+'</span>').join("")+
  '<span style="margin-left:auto">'+ago(s.updatedAt)+'</span></div></div>';}
function render(){
  const c=$("#content");
  if(!D.cloud&&!D.local){c.innerHTML='<div class="muted">加载中…</div>';return;}
  let h="";
  if(space!=="local"&&D.cloud&&!D.cloud.ok)h+='<div class="err">Devin Cloud 不可达: '+E(D.cloud.error)+'</div>';
  if(space==="local"&&D.local&&!D.local.ok)h+='<div class="err">本机 Cascade 不可达: '+E(D.local.error)+'</div>';
  const l=filtered();
  if(!l.length){c.innerHTML=h+'<div class="muted">没有会话</div>';return;}
  if(view==="board"&&space!=="local"){
    const g={working:[],blocked:[],finished:[]};
    for(const s of l){const k=/work|resum/.test(s.status)?"working":(s.status==="blocked"?"blocked":"finished");g[k].push(s);}
    h+='<div class="cols">';
    for(const[k,t]of[["working","运行中"],["blocked","待处理"],["finished","已完成"]])
      h+='<div class="col"><div class="chd">'+t+'<span class="cnt">'+g[k].length+'</span></div>'+g[k].map(card).join("")+'</div>';
    h+='</div>';
  }else{
    h+='<table><tr><th></th><th>会话</th><th>状态</th><th>更新</th></tr>'+l.map(s=>
      '<tr data-k="'+s.kind+'" data-u="'+E(s.url||"")+'" data-i="'+E(s.id)+'"><td>'+(s.unread?'<span class="unread"></span>':"")+'</td><td>'+(s.pinned?"📌 ":"")+E(s.title)+
      (s.workspace?' <span class="tag">'+E(String(s.workspace).split("/").pop())+'</span>':"")+'</td><td><span class="dot '+E(s.status)+'"></span> '+(LBL[s.status]||E(s.status)||"—")+'</td><td>'+ago(s.updatedAt)+'</td></tr>').join("")+'</table>';
  }
  c.innerHTML=h;
}
document.addEventListener("click",e=>{
  const el=e.target.closest("[data-k]");
  if(el){const k=el.getAttribute("data-k");if(k==="cloud")vs.postMessage({type:"open-cloud",url:el.getAttribute("data-u")});else vs.postMessage({type:"open-cascade",cid:el.getAttribute("data-i")});return;}
  const sp=e.target.closest(".sp");
  if(sp){space=sp.getAttribute("data-sp");document.querySelectorAll(".sp").forEach(x=>x.classList.toggle("on",x===sp));render();return;}
  const vb=e.target.closest("#viewseg button");
  if(vb){view=vb.getAttribute("data-v");document.querySelectorAll("#viewseg button").forEach(x=>x.classList.toggle("on",x===vb));render();return;}
});
$("#mt-editor").addEventListener("click",()=>vs.postMessage({type:"editor-mode"}));
$("#refresh").addEventListener("click",()=>{vs.postMessage({type:"load"});});
$("#newbtn").addEventListener("click",()=>{$("#modal").classList.add("show");$("#nprompt").focus();});
$("#ncancel").addEventListener("click",()=>$("#modal").classList.remove("show"));
$("#nprompt").addEventListener("input",e=>{$("#ncreate").disabled=!e.target.value.trim();});
$("#ncreate").addEventListener("click",()=>{const p=$("#nprompt").value;if(!p.trim())return;$("#modal").classList.remove("show");$("#nprompt").value="";$("#ncreate").disabled=true;vs.postMessage({type:"new-session",prompt:p});});
$("#search").addEventListener("input",e=>{q=e.target.value.trim().toLowerCase();render();});
window.addEventListener("message",e=>{const m=e.data;
  if(m.type==="loading"){$("#content").innerHTML='<div class="muted">加载中…</div>';}
  else if(m.type==="data"){D={cloud:m.cloud,local:m.local};render();}
  else if(m.type==="create-error"){$("#content").insertAdjacentHTML("afterbegin",'<div class="err">创建失败: '+E(m.error)+'</div>');}
});
</script></body></html>`;
  }
}

function register(context, log) {
  const board = new AgentBoardPanel(log);
  context.subscriptions.push(
    vscode.commands.registerCommand("dao.cascade.agentBoard", () => board.open())
  );
  return board;
}

module.exports = { register, AgentBoardPanel, mapCloudSession };
