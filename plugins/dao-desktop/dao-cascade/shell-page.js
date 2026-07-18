// 道 · 归一外壳单网页(/shell) —— dao-vsix「单网页实现一切」在插件本体的原生对位。
// ─────────────────────────────────────────────────────────────────────────────
// 本源(devin-remote/core/dao-vsix): 主口起一张「归一 Devin Cloud 网页」/shell,
// 浏览器套浏览器 —— 外壳是带标签栏的迷你浏览器, 每个板块一张平级标签(iframe 子网页);
// IDE webview 里能操作的, 任意外部浏览器打开 /shell 同样能操作。
// 此处为插件版适配: 数据真源不是 IDE 宿主, 而是本插件 local-api 的自持真源
// (账号/池/MCP/备份/注入/GitHub/Proxy Pro 各 ~/.dao/*.json + LS 直连), 板块页
// 客户端 fetch 同一套 /api/* 路由(与 unified-panel 面板同一真源), 一侧写全侧见。
// 鉴权: iframe/浏览器无法带 Authorization 头, 与 /web 同法 —— token 走 ?t= 查询串
// (只绑 127.0.0.1, token 本机 mode600 落盘, 不外泄凭据)。
"use strict";

const BOARDS = [
  { key: "overview", icon: "🏠", name: "主页" },
  { key: "switch", icon: "🔀", name: "切号" },
  { key: "bridge", icon: "🌐", name: "桥接" },
  { key: "backups", icon: "💬", name: "对话备份" },
  { key: "inject", icon: "💉", name: "反向注入" },
  { key: "mcp", icon: "🧩", name: "MCP" },
  { key: "github", icon: "🐙", name: "GitHub" },
  { key: "proxy", icon: "🛰️", name: "Proxy Pro" },
];

const CSS = `
:root{color-scheme:dark;--bg:#1e1e1e;--fg:#ccc;--line:#3c3c3c;--card:#252526;--dim:#8b8b8b;--acc:#0e639c}
*{box-sizing:border-box}html,body{height:100%;margin:0}
body{font:13px -apple-system,'Segoe UI',sans-serif;background:var(--bg);color:var(--fg)}
h2{font-size:15px;margin:0 0 10px}
.card{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:12px;margin-bottom:10px}
.row{display:flex;justify-content:space-between;gap:10px;padding:4px 0;border-bottom:1px solid var(--line)}
.row:last-child{border-bottom:none}
.row .k{color:var(--dim)}
button{background:var(--acc);color:#fff;border:none;border-radius:5px;padding:5px 12px;font-size:12px;cursor:pointer}
button.ghost{background:transparent;border:1px solid var(--line);color:var(--fg)}
.err{color:#f48771}.ok{color:#89d185}.muted{color:var(--dim)}
table{width:100%;border-collapse:collapse;font-size:12.5px}
th{color:var(--dim);text-align:left;font-weight:500;padding:4px 6px;border-bottom:1px solid var(--line)}
td{padding:5px 6px;border-bottom:1px solid var(--line)}
`;

// 板块子网页: 静态外形 + 客户端 fetch /api/*(带 Bearer) 渲染 —— 与面板同一真源。
function boardPage(key, token, port) {
  const cfg = {
    overview: { title: "🏠 主页 / 单账号管理", eps: ["/api/account", "/api/host", "/api/cascade", "/api/backups"] },
    switch: { title: "🔀 切号 / 账号池", eps: ["/api/pool"] },
    bridge: { title: "🌐 桥接 · 本地 API", eps: ["/api/health", "/api/openapi"] },
    backups: { title: "💬 对话备份", eps: ["/api/backups"] },
    inject: { title: "💉 反向注入 · 全账号", eps: ["/api/inject"] },
    mcp: { title: "🧩 MCP 服务器", eps: ["/api/mcp"] },
    github: { title: "🐙 GitHub 舰队", eps: ["/api/github"] },
    proxy: { title: "🛰️ Proxy Pro", eps: ["/api/proxy", "/api/proxy/routes"] },
  }[key];
  if (!cfg) return null;
  return `<!DOCTYPE html><html lang="zh"><head><meta charset="utf-8"><title>${cfg.title}</title><style>${CSS}body{padding:14px}</style></head><body>
<h2>${cfg.title}</h2><div id="c" class="muted">加载中…</div>
<script>
const T=${JSON.stringify(token)},EPS=${JSON.stringify(cfg.eps)};
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}
function kv(o,d){let h='<div class="card">';for(const k of Object.keys(o||{})){const v=o[k];
  h+='<div class="row"><span class="k">'+esc(k)+'</span><span>'+(typeof v==="object"?esc(JSON.stringify(v).slice(0,160)):esc(v))+'</span></div>';}
  return h+'</div>';}
Promise.all(EPS.map(u=>fetch(u,{headers:{Authorization:"Bearer "+T}}).then(r=>r.json()).catch(e=>({error:e.message}))))
.then(rs=>{let h="";rs.forEach((r,i)=>{h+='<div class="muted" style="margin:8px 0 4px">'+esc(EPS[i])+'</div>';
  if(Array.isArray(r))h+=kv(Object.fromEntries(r.slice(0,50).map((x,j)=>[j,x])));
  else h+=kv(r);});
  document.getElementById("c").innerHTML=h;})
.catch(e=>{document.getElementById("c").innerHTML='<div class="err">'+esc(e.message)+'</div>';});
</script></body></html>`;
}

// 归一外壳: 浏览器套浏览器 —— 标签栏 + 平级 iframe 子网页(板块各一张, 可并开)。
function shellPage(token) {
  return `<!DOCTYPE html><html lang="zh"><head><meta charset="utf-8"><title>归一 · Devin Desktop 插件版</title><style>${CSS}
#bar{display:flex;align-items:center;gap:4px;padding:6px 8px;border-bottom:1px solid var(--line);background:var(--card);flex-wrap:wrap}
#bar .tab{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);border-radius:6px 6px 0 0;padding:5px 12px;cursor:pointer;color:var(--dim);font-size:12.5px;background:transparent}
#bar .tab.on{color:var(--fg);background:var(--bg);border-bottom-color:var(--bg)}
#bar .brand{font-weight:600;margin-right:8px}
main{position:fixed;inset:44px 0 0 0}
iframe{position:absolute;inset:0;width:100%;height:100%;border:none;display:none;background:var(--bg)}
iframe.on{display:block}
</style></head><body>
<div id="bar"><span class="brand">☯ 归一</span></div><main id="mn"></main>
<script>
const T=${JSON.stringify(token)},BOARDS=${JSON.stringify(BOARDS)};
const bar=document.getElementById("bar"),mn=document.getElementById("mn");
function openTab(b){
  let f=document.getElementById("f-"+b.key);
  if(!f){f=document.createElement("iframe");f.id="f-"+b.key;f.src="/shell/board/"+b.key+"?t="+encodeURIComponent(T);mn.appendChild(f);}
  document.querySelectorAll("#bar .tab").forEach(x=>x.classList.toggle("on",x.dataset.k===b.key));
  document.querySelectorAll("iframe").forEach(x=>x.classList.toggle("on",x===f));
}
for(const b of BOARDS){
  const t=document.createElement("span");t.className="tab";t.dataset.k=b.key;
  t.textContent=b.icon+" "+b.name;t.onclick=()=>openTab(b);bar.appendChild(t);
}
openTab(BOARDS[0]);
</script></body></html>`;
}

// 路由处理(local-api 委托): /shell 与 /shell/board/<key>, token 走 ?t=。命中返 true。
function handle(req, res, token, port) {
  const url = req.url || "";
  const u = url.split("?")[0];
  if (u !== "/shell" && !u.startsWith("/shell/board/")) return false;
  const q = url.includes("?") ? url.slice(url.indexOf("?") + 1) : "";
  const t = (q.match(/(?:^|&)t=([^&]*)/) || [])[1];
  const html = (b) => {
    const buf = Buffer.from(b, "utf8");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Content-Length": buf.length });
    res.end(buf);
  };
  if (decodeURIComponent(t || "") !== token) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "unauthorized (?t=token)" }));
    return true;
  }
  if (u === "/shell") { html(shellPage(token)); return true; }
  const key = u.slice("/shell/board/".length);
  const page = boardPage(key, token, port);
  if (!page) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "unknown board" }));
    return true;
  }
  html(page);
  return true;
}

module.exports = { handle, BOARDS, shellPage, boardPage };
