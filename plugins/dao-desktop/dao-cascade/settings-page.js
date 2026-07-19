// 道 · Devin Settings 整页 — 官方 Devin Desktop「Devin Settings」页的插件版对位。
// ─────────────────────────────────────────────────────────────────────────────
// 官方为整窗多节设置页(General / Plan / Plugins / Agents / Devin Local / Editor /
// Cascade / Advanced)。插件版同结构复刻, 数据与写回全走既有真源:
//   · 账号/套餐/配额/模型: GetUserStatus(与状态栏/账户卡同源)
//   · 团队管控: GetTeamOrganizationalControls
//   · 官方用户设置: GetUserSettings / SetUserSettings(读-改-写全量合并)
//   · MCP: GetMcpServerStates 概览 + 跳归一面板管理
//   · Devin Local: devin-provision(引擎二进制/CLI 登录态)
//   · Editor: import-sync 导入(设置/扩展/Cursor 规则)
//   · Advanced: LS 端口/重启/诊断包 + 本地桥 API
"use strict";

const vscode = require("vscode");
const crypto = require("crypto");

function nonce() { return crypto.randomBytes(16).toString("base64"); }

const SECTIONS = [
  ["general", "General"], ["plan", "Plan"], ["plugins", "Plugins"],
  ["agents", "Agents"], ["local", "Devin Local"], ["editor", "Editor"],
  ["cascade", "Cascade"], ["advanced", "Advanced"],
];

class SettingsPagePanel {
  constructor(log, context, opts) {
    this._log = log || (() => {});
    this._ctx = context;
    this._unified = (opts && opts.unified) || null;
    this._panel = null;
  }

  open(section) {
    if (this._panel) {
      this._panel.reveal();
      if (section) this._post({ type: "goto", section });
      return;
    }
    const p = vscode.window.createWebviewPanel("dao.devinSettings", "Devin Settings",
      vscode.ViewColumn.One, { enableScripts: true, retainContextWhenHidden: true });
    this._panel = p;
    p.onDidDispose(() => { this._panel = null; });
    p.webview.onDidReceiveMessage((m) => this._onMessage(m));
    p.webview.html = this._html();
    this._load();
    if (section) setTimeout(() => this._post({ type: "goto", section }), 300);
  }

  _post(m) { if (this._panel) this._panel.webview.postMessage(m); }

  async _onMessage(msg) {
    const cmd = (id) => vscode.commands.executeCommand(id).then(undefined, (e) =>
      vscode.window.showWarningMessage(String(e && e.message || e)));
    try {
      switch (msg.type) {
        case "load": return this._load();
        case "open-external": return vscode.env.openExternal(vscode.Uri.parse(String(msg.url || "")));
        case "run-cmd": {
          // 白名单直通(与官方账号/Cascade 菜单同径): 本插件命名空间 + 键位设置。
          const id = String(msg.id || "");
          if (/^dao\./.test(id) || id === "workbench.action.openGlobalKeybindings") return cmd(id);
          return;
        }
        // 引擎运维/导入: 委派归一面板既有对等实现(与官方 devin.* 命令同径)。
        case "restart-ls": return this._unified && this._unified._setRestartLs();
        case "diagnostics": return this._unified && this._unified._setDiag();
        case "import": return this._unified && this._unified._setImport(String(msg.what || ""));
        case "bridge-token": {
          const t = require("./local-api").token();
          return vscode.env.clipboard.writeText(t).then(() =>
            vscode.window.showInformationMessage("已复制本地 API token"), () => {});
        }
        case "set-user-setting": {
          // 官方式写回: 读-改-写全量合并(SetUserSettings 为整体替换)。
          const ls = require("./ls-bridge");
          const s = (await ls.call("GetUserSettings", {})).userSettings || {};
          const patch = {}; patch[String(msg.key)] = msg.value;
          await ls.call("SetUserSettings", { userSettings: Object.assign(s, patch) });
          return this._load();
        }
        case "set-config": {
          // VS Code 侧插件配置(dao.cascade.*)。
          await vscode.workspace.getConfiguration().update(String(msg.key), msg.value, true);
          return this._load();
        }
        case "copy": return vscode.env.clipboard.writeText(String(msg.text || "")).then(() => {});
      }
    } catch (e) { vscode.window.showWarningMessage("Devin Settings: " + e.message); }
  }

  // 全量聚合载荷: 各源并行取, 单源失败置 null 不拖垮整页。
  async _load() {
    const ls = require("./ls-bridge");
    const soft = (p) => p.then((v) => v).catch(() => null);
    const [status, settings, mcp, team] = await Promise.all([
      soft(ls.call("GetUserStatus", {})),
      soft(ls.call("GetUserSettings", {})),
      soft(ls.call("GetMcpServerStates", {})),
      soft(ls.call("GetTeamOrganizationalControls", {})),
    ]);
    // Devin Local: CLI 引擎与登录态(devin-provision 同源)。
    let local = null;
    try {
      const prov = require("./devin-provision");
      const gsu = this._ctx && this._ctx.globalStorageUri && this._ctx.globalStorageUri.fsPath;
      const extRoot = this._ctx && this._ctx.extensionPath;
      const bin = prov.resolveEngine(extRoot, gsu);
      const auth = await prov.authStatus(bin);
      local = { bin: bin || "", loggedIn: !!(auth && auth.loggedIn), name: (auth && auth.name) || "" };
    } catch (_) {}
    // Devin Cloud 可达性: 以凭据链实态为准(看板同源), 不依赖 team 控制位推断。
    let cloudReady = false;
    try { cloudReady = !!require("./acp-wss").readCredentials(); } catch (_) {}
    const cfg = vscode.workspace.getConfiguration();
    const version = (() => { try { return require("../package.json").version; } catch (_) { return ""; } })();
    let lsPort = 0; try { const h = ls.ready(); lsPort = (h && h.lsPort) || 0; } catch (_) {}
    this._post({
      type: "data",
      status: status && status.userStatus || null,
      settings: settings && settings.userSettings || null,
      mcp: (mcp && mcp.serverStates || []).map((s) => ({
        name: s.name || "", status: (s.status || "").replace("MCP_SERVER_STATUS_", ""),
        tools: (s.tools || []).length })),
      team: team || null,
      local,
      config: { autoBackup: !!cfg.get("dao.cascade.autoBackup"), backupDir: cfg.get("dao.cascade.backupDir") || "" },
      cloudReady, version, lsPort,
      autoRunPolicy: (this._ctx && this._ctx.globalState.get("cascadeAutoExecutionPolicy")) || "Off",
    });
  }

  _html() {
    const n = nonce();
    return `<!DOCTYPE html><html lang="zh"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${n}'">
<style>
:root{color-scheme:light dark;--line:var(--vscode-widget-border,var(--vscode-panel-border));--dim:var(--vscode-descriptionForeground);--card:var(--vscode-input-background);--hover:var(--vscode-toolbar-hoverBackground,rgba(128,128,128,.15))}
html,body{height:100%;margin:0}body{display:flex;font:13px var(--vscode-font-family);color:var(--vscode-foreground);background:var(--vscode-editor-background)}
aside{width:180px;border-right:1px solid var(--line);padding:16px 8px;flex-shrink:0}
aside .ttl{font-size:14px;font-weight:600;padding:0 10px 10px}
aside .it{padding:6px 10px;border-radius:6px;cursor:pointer;color:var(--dim);font-size:12.5px}
aside .it.on{background:var(--hover);color:var(--vscode-foreground)}
main{flex:1;overflow:auto;padding:20px 28px;max-width:760px}
h2{font-size:16px;margin:26px 0 4px;padding-top:10px}
h2:first-child{margin-top:0}
.sub{color:var(--dim);font-size:12px;margin-bottom:12px}
.card{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:4px 14px;margin-bottom:10px}
.row{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--line);font-size:12.5px}
.row:last-child{border-bottom:none}
.row .k{flex:1}
.row .k .d{color:var(--dim);font-size:11.5px;margin-top:2px}
.row .v{color:var(--dim)}
button,.lk{border:1px solid var(--line);background:transparent;color:var(--vscode-textLink-foreground);border-radius:6px;padding:3px 12px;font-size:12px;cursor:pointer}
button.pri{background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:none}
.sw{width:34px;height:18px;border-radius:9px;background:var(--vscode-input-background);border:1px solid var(--dim);position:relative;cursor:pointer;flex-shrink:0;box-sizing:border-box}
.sw::after{content:"";position:absolute;top:1px;left:1px;width:14px;height:14px;border-radius:50%;background:var(--vscode-foreground);opacity:.75;transition:left .12s}
.sw.on{background:var(--vscode-button-background);border-color:var(--vscode-button-background)}
.sw.on::after{left:17px;background:#fff;opacity:1}
.bar{height:6px;border-radius:3px;background:var(--hover);overflow:hidden;flex:0 0 120px}
.bar i{display:block;height:100%;background:var(--vscode-button-background)}
.tag{border:1px solid var(--line);border-radius:6px;padding:0 6px;font-size:10.5px;color:var(--dim)}
.muted{color:var(--dim)}
</style></head><body>
<aside><div class="ttl">Devin Settings</div>
${SECTIONS.map(([id, t]) => `<div class="it${id === "general" ? " on" : ""}" data-s="${id}">${t}</div>`).join("\n")}
</aside>
<main id="main"><div class="muted">加载中…</div></main>
<script nonce="${n}">
const vs=acquireVsCodeApi();
const E=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
let D=null;
const $=s=>document.querySelector(s);
function row(k,v,d){return '<div class="row"><span class="k">'+k+(d?'<div class="d">'+d+'</div>':"")+'</span><span class="v">'+v+'</span></div>';}
function btn(t,act,arg,tip){return '<button data-act="'+act+'" data-arg="'+E(arg||"")+'"'+(tip?' title="'+E(tip)+'"':'')+'>'+t+'</button>';}
function sw(on,act,arg){return '<span class="sw'+(on?" on":"")+'" data-act="'+act+'" data-arg="'+E(arg||"")+'" data-on="'+(on?1:0)+'"></span>';}
function pct(p){return p==null?"—":'<span class="bar"><i style="width:'+Math.max(0,Math.min(100,p))+'%"></i></span> '+Math.round(p)+"%";}
function render(){
  if(!D){$("#main").innerHTML='<div class="muted">加载中…</div>';return;}
  const u=D.status||{},ps=u.planStatus||{},pi=ps.planInfo||{},st=D.settings||{},tc=(D.team&&D.team.organizationalControls)||D.team||{};
  let h="";
  h+='<h2 id="s-general">General</h2><div class="sub">账号与全局行为(与官方 GetUserStatus/GetUserSettings 同源)</div><div class="card">';
  h+=row("账号",E(u.name||u.email||"未登录")+(u.email&&u.name?' <span class="tag">'+E(u.email)+'</span>':""));
  h+=row("登录/登出",btn("Log in","cmd","dao.cascade.login")+" "+btn("Log Out","cmd","dao.cascade.logout"));
  h+=row("账户页",btn("Profile","cmd","dao.cascade.openProfile")+" "+btn("Changelog","cmd","dao.cascade.openChangelog"));
  h+=row("启动时打开最近会话",sw(!!st.openMostRecentChatConversation,"uset","openMostRecentChatConversation"),"官方 openMostRecentChatConversation 同源");
  h+=row("Auto-Run 策略",'<span class="tag">'+E(D.autoRunPolicy||"Off")+'</span> '+btn("更改","cmd","dao.cascade.autoRunPolicy","Auto-run settings")+" "+btn("Allow/Deny List","cmd","dao.cascade.allowlist"),"官方档位 Off/Allowlist/Auto/Turbo · cascadeAutoExecutionPolicy 同名 · deny list 优先");
  h+='</div>';
  h+='<h2 id="s-plan">Plan</h2><div class="sub">套餐与配额(与官方账户卡同源)</div><div class="card">';
  h+=row("套餐",E(pi.planName||"—")+(pi.isTrial?' <span class="tag">Trial</span>':""));
  h+=row("当日配额剩余",pct(ps.dailyQuotaRemainingPercent!=null?Number(ps.dailyQuotaRemainingPercent):null));
  h+=row("本周配额剩余",pct(ps.weeklyQuotaRemainingPercent!=null?Number(ps.weeklyQuotaRemainingPercent):null));
  h+=row("用量/账单",btn("View Usage","ext","https://windsurf.com/subscription/usage")+" "+btn("Billing","ext","https://windsurf.com/subscription/manage")+" "+btn("Upgrade","ext","https://windsurf.com/pricing"));
  h+='</div>';
  h+='<h2 id="s-plugins">Plugins</h2><div class="sub">MCP 服务器(GetMcpServerStates 同源; 完整管理在归一面板 🧩 MCP)</div><div class="card">';
  const mcp=D.mcp||[];
  h+=row("已载入 MCP","<b>"+mcp.length+"</b> 个 · "+btn("打开 MCP 管理","cmd","dao.unified.open"));
  for(const s of mcp.slice(0,8))h+=row(E(s.name),'<span class="tag">'+E(s.status||"?")+'</span> '+s.tools+" tools");
  if(mcp.length>8)h+=row('<span class="muted">… 其余 '+(mcp.length-8)+' 个见归一面板</span>',"");
  h+='</div>';
  h+='<h2 id="s-agents">Agents</h2><div class="sub">团队/组织管控与代理配置(GetTeamOrganizationalControls 同源)</div><div class="card">';
  h+=row("团队 ID",E(tc.teamId||"—(个人账号)"));
  h+=row("Devin Cloud",D.cloudReady?"凭据就绪(看板可达)":"未登录(credentials 缺失)","以凭据链实态为准, 与 Agent 看板同源");
  h+=row("Agent 看板",btn("打开 Agent 看板","cmd","dao.cascade.agentBoard"),"Devin Cloud 会话 Board/List(与官方 Agent 模式对位)");
  h+='</div>';
  h+='<h2 id="s-local">Devin Local</h2><div class="sub">本机 devin CLI 引擎(devin-provision 同源)</div><div class="card">';
  const lo=D.local||{};
  h+=row("引擎二进制",lo.bin?'<span class="tag">'+E(lo.bin)+'</span>':"未找到");
  h+=row("CLI 登录态",lo.loggedIn?("已登录"+(lo.name?" · "+E(lo.name):"")):"未登录");
  h+='</div>';
  h+='<h2 id="s-editor">Editor</h2><div class="sub">与 VS Code / Cursor 的导入同步(import-sync 同源)</div><div class="card">';
  h+=row("导入 VS Code 设置",btn("导入","imp","vscode-settings"),"并入不覆盖(用户已定制优先)");
  h+=row("导入 VS Code 扩展",btn("导入","imp","vscode-extensions"));
  h+=row("导入 Cursor 规则",btn("导入","imp","cursor"),"官方 ImportFromCursor RPC 同源");
  h+=row("键位",btn("打开键位设置","cmd","workbench.action.openGlobalKeybindings"));
  h+='</div>';
  h+='<h2 id="s-cascade">Cascade</h2><div class="sub">对话面板行为(插件配置 + 官方设置同源)</div><div class="card">';
  const c=D.config||{};
  h+=row("对话自动备份",sw(!!c.autoBackup,"cfg","dao.cascade.autoBackup"),"会话变更即增量导出轨迹转录");
  h+=row("备份目录",E(c.backupDir||"~/.wam/conversation_backups"));
  h+=row("规则/工作流",btn("新建规则","cmd","dao.cascade.createRule")+" "+btn("新建工作流","cmd","dao.cascade.createWorkflow"));
  h+='</div>';
  h+='<h2 id="s-advanced">Advanced</h2><div class="sub">引擎运维与本地桥</div><div class="card">';
  h+=row("插件版本",E(D.version||"—"));
  h+=row("language_server",D.lsPort?("已连接 · 端口 "+D.lsPort):"未连接");
  h+=row("引擎运维",btn("重启 LS","rls","")+" "+btn("诊断包","diag",""),"官方 restartLanguageServer / downloadDiagnostics 对等");
  h+=row("本地桥 API token",btn("复制","btok",""),"归一面板桥接 /api/* 鉴权");
  h+='</div>';
  $("#main").innerHTML=h;
}
document.addEventListener("click",e=>{
  const it=e.target.closest("aside .it");
  if(it){document.querySelectorAll("aside .it").forEach(x=>x.classList.toggle("on",x===it));
    const t=document.getElementById("s-"+it.getAttribute("data-s"));if(t)t.scrollIntoView({behavior:"smooth"});return;}
  const el=e.target.closest("[data-act]");if(!el)return;
  const act=el.getAttribute("data-act"),arg=el.getAttribute("data-arg");
  if(act==="cmd")vs.postMessage({type:"run-cmd",id:arg});
  else if(act==="ext")vs.postMessage({type:"open-external",url:arg});
  else if(act==="imp")vs.postMessage({type:"import",what:arg});
  else if(act==="rls")vs.postMessage({type:"restart-ls"});
  else if(act==="diag")vs.postMessage({type:"diagnostics"});
  else if(act==="btok")vs.postMessage({type:"bridge-token"});
  else if(act==="uset")vs.postMessage({type:"set-user-setting",key:arg,value:el.getAttribute("data-on")!=="1"});
  else if(act==="cfg")vs.postMessage({type:"set-config",key:arg,value:el.getAttribute("data-on")!=="1"});
});
window.addEventListener("message",e=>{const m=e.data;
  if(m.type==="data"){D=m;render();}
  else if(m.type==="goto"){const t=document.getElementById("s-"+m.section);if(t)t.scrollIntoView();}
});
vs.postMessage({type:"load"});
</script></body></html>`;
  }
}

function register(context, log, opts) {
  const page = new SettingsPagePanel(log, context, opts);
  context.subscriptions.push(
    vscode.commands.registerCommand("dao.cascade.openSettings", (section) => page.open(section))
  );
  return page;
}

module.exports = { register, SettingsPagePanel };
