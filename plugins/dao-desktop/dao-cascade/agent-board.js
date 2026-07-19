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

// 官方看板同文(英文真源): 列=Running/Blocked/Ready, 状态标签同语义。
const STATUS_LABEL = {
  working: "Running", blocked: "Blocked", finished: "Ready",
  expired: "Expired", suspend_requested: "Suspending", suspend_requested_frontend: "Suspending",
  resumed: "Running", resume_requested: "Resuming",
};

// cognition.ai/* 元数据 → 扁平会话对象(前端直接消费)。
function mapCloudSession(s) {
  const meta = (s && s._meta) || {};
  const g = (k) => meta["cognition.ai/" + k];
  return {
    kind: "cloud",
    id: s.sessionId || "",
    title: s.title || s.sessionId || "(untitled)",
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
    // 官方 Agent 模式 = 整窗接管: 收起侧栏, 看板独占(Editor 模式时还原)。
    vscode.commands.executeCommand("workbench.action.closeSidebar").then(undefined, () => {});
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
    this._post({ type: "data", cloud, local, mcp: this._mcpCount() });
  }

  // 官方底栏「N MCP servers」同源: 与官方同一份 ~/.codeium/windsurf/mcp_config.json。
  _mcpCount() {
    try {
      const fs = require("fs"), os = require("os"), path = require("path");
      const p = path.join(os.homedir(), ".codeium", "windsurf", "mcp_config.json");
      const j = JSON.parse(fs.readFileSync(p, "utf8"));
      return Object.keys(j.mcpServers || {}).length;
    } catch (_) { return 0; }
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
header{display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid var(--line);flex-wrap:wrap}
header .ttl{font-size:15px;font-weight:600}
#chips{display:flex;align-items:center;gap:8px;padding:8px 16px;border-bottom:1px solid var(--line);flex-wrap:wrap}
.chip{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);border-radius:14px;padding:3px 10px;font-size:11.5px;color:var(--dim);cursor:pointer;background:var(--card)}
.chip b{color:var(--vscode-foreground);font-weight:500}
.chip .x{opacity:.7;padding-left:2px}
.chip.add{border-style:dashed;padding:3px 9px}
#display{margin-left:auto;background:var(--card);border:1px solid var(--line);border-radius:6px;color:inherit;padding:3px 8px;font-size:11.5px}
#search{flex:0 1 260px;background:var(--card);border:1px solid var(--line);border-radius:6px;color:inherit;padding:4px 10px;font-size:12px}
.seg{display:flex;border:1px solid var(--line);border-radius:6px;overflow:hidden}
.seg button{border:none;background:transparent;color:var(--dim);padding:4px 12px;font-size:12px;cursor:pointer}
.seg button.on{background:var(--hover);color:var(--vscode-foreground)}
#newbtn{margin-left:auto;background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:none;border-radius:6px;padding:5px 14px;font-size:12px;cursor:pointer}
#refresh{background:transparent;border:1px solid var(--line);border-radius:6px;color:var(--dim);padding:4px 10px;cursor:pointer}
main{flex:1;display:flex;min-height:0}
aside{width:190px;border-right:1px solid var(--line);padding:12px 8px;display:flex;flex-direction:column;gap:2px}
aside .act{display:flex;align-items:center;gap:7px;padding:6px 10px;border-radius:6px;cursor:pointer;font-size:12.5px}
aside .act:hover{background:var(--hover)}
aside .hdrow{display:flex;align-items:center;padding:8px 10px 3px}
aside .hdrow .hd2{font-size:10.5px;color:var(--dim);text-transform:uppercase;letter-spacing:.06em;flex:1}
aside .hdrow .ic{color:var(--dim);cursor:pointer;padding:0 3px;font-size:12px}
aside .recent{padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
aside .recent:hover{background:var(--hover)}
aside .recent .ra{color:var(--dim);font-size:10.5px;display:block}
footer{display:flex;align-items:center;gap:8px;border-top:1px solid var(--line);padding:5px 16px;font-size:11.5px;color:var(--dim)}
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
  <input id="search" placeholder="Search sessions...">
  <div class="seg" id="viewseg"><button data-v="board" class="on">Board</button><button data-v="list">List</button></div>
  <button id="refresh" title="刷新">↻</button>
  <button id="newbtn">＋ New session</button>
</header>
<div id="chips">
  <span class="chip" id="chip-time">◴ Time is <b id="time-v">Any time</b><span class="x">×</span></span>
  <span class="chip" id="chip-arch">▤ Archived is <b id="arch-v">Excluded</b><span class="x">×</span></span>
  <span class="chip add" id="chip-add" title="官方同位: 叠加筛选">＋</span>
  <select id="display" title="Display">
    <option value="updated">Display · Updated</option>
    <option value="created">Display · Created</option>
    <option value="title">Display · Title</option>
  </select>
</div>
<main>
  <aside id="spaces">
    <div class="act" id="side-new">＋ New session</div>
    <div class="sp on" data-sp="all">💬 Sessions</div>
    <div class="hdrow"><span class="hd2">Spaces</span><span class="ic" id="sp-search" title="搜索">🔍</span><span class="ic" title="新建 Space(官方同位)">＋</span></div>
    <div class="sp" data-sp="unread">Unread</div>
    <div class="sp" data-sp="pinned">Pinned</div>
    <div class="sp" data-sp="archived">Archived</div>
    <div class="hdrow"><span class="hd2">Local</span></div>
    <div class="sp" data-sp="local">Cascade sessions</div>
    <div class="hdrow"><span class="hd2">Recent</span></div>
    <div id="recent"></div>
  </aside>
  <div id="content"><div class="muted">Loading…</div></div>
</main>
<footer><span id="mcpn">0 MCP servers</span></footer>
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
const TIME_OPTS=[["any","Any time"],["24h","Past 24 hours"],["7d","Past 7 days"],["30d","Past 30 days"]];
const ARCH_OPTS=[["excluded","Excluded"],["included","Included"],["only","Only"]];
let F={time:"any",arch:"excluded",sort:"updated"};
function inTime(s){if(F.time==="any")return true;const ms={"24h":864e5,"7d":6048e5,"30d":2592e6}[F.time];const t=new Date(s.updatedAt||s.createdAt||0).getTime();return isFinite(t)&&Date.now()-t<=ms;}
const $=s=>document.querySelector(s);
function ago(t){if(!t)return"";const d=Date.now()-new Date(t).getTime();if(!isFinite(d))return"";const m=Math.floor(d/60000);if(m<1)return"just now";if(m<60)return m+"m ago";const h=Math.floor(m/60);if(h<24)return h+"h ago";return Math.floor(h/24)+"d ago";}
function filtered(){
  if(space==="local")return(D.local&&D.local.sessions||[]).filter(s=>(!q||s.title.toLowerCase().includes(q))&&inTime(s));
  let l=(D.cloud&&D.cloud.sessions||[]);
  if(space==="archived"||F.arch==="only")l=l.filter(s=>s.archived);
  else if(F.arch==="excluded")l=l.filter(s=>!s.archived);
  if(space==="unread")l=l.filter(s=>s.unread);
  if(space==="pinned")l=l.filter(s=>s.pinned);
  if(q)l=l.filter(s=>s.title.toLowerCase().includes(q));
  l=l.filter(inTime);
  if(F.sort==="title")l=l.slice().sort((a,b)=>a.title.localeCompare(b.title));
  else if(F.sort==="created")l=l.slice().sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
  return l;
}
function card(s){return '<div class="card" data-k="'+s.kind+'" data-u="'+E(s.url||"")+'" data-i="'+E(s.id)+'">'+
  '<div class="t">'+(s.pinned?'<span class="pin">📌 </span>':"")+(s.unread?'<span class="unread"></span> ':"")+E(s.title)+'</div>'+
  '<div class="m">'+(s.kind==="cloud"?'<span title="Devin Cloud"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align:-1.5px"><path d="M8.120 4.042 C 5.012 4.380,2.409 6.479,1.423 9.443 C 0.555 12.051,1.045 14.847,2.750 17.017 C 3.051 17.400,3.710 18.048,4.102 18.346 C 5.293 19.253,6.701 19.816,8.140 19.961 C 8.444 19.991,10.018 20.000,13.220 19.990 C 18.375 19.973,18.072 19.989,18.949 19.697 C 19.684 19.452,20.371 19.063,20.949 18.562 C 22.629 17.109,23.359 14.796,22.819 12.639 C 22.541 11.528,22.013 10.611,21.194 9.816 C 20.287 8.936,19.251 8.419,17.986 8.215 C 17.669 8.164,17.419 8.155,16.841 8.172 C 15.925 8.200,15.924 8.200,15.636 7.746 C 14.696 6.265,13.372 5.168,11.740 4.520 C 11.360 4.369,10.649 4.180,10.160 4.100 C 9.692 4.024,8.578 3.992,8.120 4.042 M9.907 5.582 C 10.933 5.734,11.911 6.154,12.802 6.825 C 13.349 7.237,13.853 7.787,14.310 8.469 C 14.686 9.031,14.885 9.245,15.200 9.425 C 15.635 9.672,16.011 9.737,16.646 9.675 C 17.475 9.594,18.231 9.720,18.949 10.060 C 19.461 10.302,19.857 10.586,20.248 10.993 C 20.618 11.379,20.793 11.626,21.031 12.101 C 21.344 12.725,21.479 13.327,21.480 14.094 C 21.481 16.114,20.139 17.851,18.180 18.366 C 17.629 18.511,17.051 18.526,12.600 18.510 C 7.987 18.492,8.131 18.499,7.300 18.285 C 4.951 17.679,3.068 15.640,2.616 13.213 C 2.528 12.742,2.497 11.649,2.558 11.184 C 2.840 9.038,4.117 7.199,6.000 6.226 C 6.952 5.735,7.792 5.529,8.875 5.523 C 9.242 5.521,9.658 5.545,9.907 5.582 " stroke="none" fill-rule="evenodd" fill="currentColor"/></svg></span>':"")+
  (s.tags||[]).map(t=>'<span class="tag">'+E(t)+'</span>').join("")+
  '<span style="margin-left:auto">'+ago(s.updatedAt)+'</span></div></div>';}
function render(){
  const c=$("#content");
  if(!D.cloud&&!D.local){c.innerHTML='<div class="muted">Loading…</div>';return;}
  let h="";
  if(space!=="local"&&D.cloud&&!D.cloud.ok)h+='<div class="err">Devin Cloud 不可达: '+E(D.cloud.error)+'</div>';
  if(space==="local"&&D.local&&!D.local.ok)h+='<div class="err">本机 Cascade 不可达: '+E(D.local.error)+'</div>';
  const l=filtered();
  if(!l.length){c.innerHTML=h+'<div class="muted">No sessions</div>';return;}
  if(view==="board"&&space!=="local"){
    const g={working:[],blocked:[],finished:[]};
    for(const s of l){const k=/work|resum/.test(s.status)?"working":(s.status==="blocked"?"blocked":"finished");g[k].push(s);}
    h+='<div class="cols">';
    const CICO={working:'<span style="color:#8b949e">◌</span>',blocked:'<span style="color:#d29922">⧖</span>',finished:'<span style="color:#3fb950">✓</span>'};
    for(const[k,t]of[["working","Running"],["blocked","Blocked"],["finished","Ready"]])
      h+='<div class="col"><div class="chd">'+CICO[k]+t+'<span class="cnt">'+g[k].length+'</span></div>'+g[k].map(card).join("")+'</div>';
    h+='</div>';
  }else{
    h+='<table><tr><th></th><th>Session</th><th>Status</th><th>Updated</th></tr>'+l.map(s=>
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
function cycle(opts,cur){const i=opts.findIndex(o=>o[0]===cur);return opts[(i+1)%opts.length];}
$("#chip-time").addEventListener("click",e=>{if(e.target.classList.contains("x")){F.time="any";}else{F.time=cycle(TIME_OPTS,F.time)[0];}document.getElementById("time-v").textContent=TIME_OPTS.find(o=>o[0]===F.time)[1];render();});
$("#chip-arch").addEventListener("click",e=>{if(e.target.classList.contains("x")){F.arch="excluded";}else{F.arch=cycle(ARCH_OPTS,F.arch)[0];}document.getElementById("arch-v").textContent=ARCH_OPTS.find(o=>o[0]===F.arch)[1];render();});
$("#display").addEventListener("change",e=>{F.sort=e.target.value;render();});
$("#side-new").addEventListener("click",()=>{$("#modal").classList.add("show");$("#nprompt").focus();});
$("#sp-search").addEventListener("click",()=>$("#search").focus());
function renderRecent(){
  const all=((D.cloud&&D.cloud.sessions)||[]).concat((D.local&&D.local.sessions)||[])
    .sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0,8);
  document.getElementById("recent").innerHTML=all.map(s=>'<div class="recent" data-k="'+s.kind+'" data-u="'+E(s.url||"")+'" data-i="'+E(s.id)+'" title="'+E(s.title)+'">'+E(s.title)+'<span class="ra">◴ '+ago(s.updatedAt)+'</span></div>').join("");
}
window.addEventListener("message",e=>{const m=e.data;
  if(m.type==="loading"){$("#content").innerHTML='<div class="muted">加载中…</div>';}
  else if(m.type==="data"){D={cloud:m.cloud,local:m.local};document.getElementById("mcpn").textContent=(m.mcp||0)+" MCP servers";renderRecent();render();}
  else if(m.type==="create-error"){$("#content").insertAdjacentHTML("afterbegin",'<div class="err">创建失败: '+E(m.error)+'</div>');}
});
</script></body></html>`;
  }
}

function register(context, log) {
  const board = new AgentBoardPanel(log);
  context.subscriptions.push(
    vscode.commands.registerCommand("dao.cascade.agentBoard", () => board.open()),
    // 官方 workbench.action.toggleWindsurfAgentWindow 对位: Agent 模式 ↔ 编辑器模式一键互切
    vscode.commands.registerCommand("dao.cascade.toggleAgentWindow", () => {
      if (board._panel) board._panel.dispose();
      else board.open();
    })
  );
  return board;
}

module.exports = { register, AgentBoardPanel, mapCloudSession };
