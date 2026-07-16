// 道 · Proxy Pro 独立面板(dao.proxyPro) —— 与 dao-proxy-pro 插件同位的独立视图。
// 架构归正(REARCH): Proxy Pro 从归一面板的混合形态拆出, 独立成视图(与 dao-vsix 生态中
// dao-proxy-pro 是独立插件面板 1:1 对位); 数据仍走插件自持真源:
//   渠道/路由存 ~/.dao/proxy-channels.json(mode 600, proxy-pro.js), apiKey 只回尾4位;
//   路由生效层经 proxy-runtime.js 真正投递 —— 与 dao-vsix 的 ~/.codeium/dao-byok 命名空间
//   完全隔离, 双方各自持有渠道与 Key, 互不覆盖。
"use strict";
const vscode = require("vscode");
const proxyPro = require("./proxy-pro");
const proxyRuntime = require("./proxy-runtime");
const modeFusion = require("./mode-fusion");

function nonce() { let s = ""; const c = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"; for (let i = 0; i < 24; i++) s += c[Math.floor(Math.random() * c.length)]; return s; }

class ProxyProPanel {
  constructor(log) {
    this._log = typeof log === "function" ? log : () => {};
    this._view = null;
  }

  resolveWebviewView(view) {
    this._view = view;
    const w = view.webview;
    w.options = { enableScripts: true };
    w.onDidReceiveMessage((m) => this._onMessage(m || {}));
    w.html = this._html();
    this._pxList();
    // retainContextWhenHidden 下重新可见时刷新: 渠道/路由可能已在面板外(headless/切号)变更。
    view.onDidChangeVisibility(() => { if (view.visible) this._pxList(); });
  }

  _post(m) { if (this._view) try { this._view.webview.postMessage(m); } catch (_) {} }

  _onMessage(msg) {
    switch (msg.type) {
      case "px-list": return this._pxList();
      case "px-add": return this._pxAdd();
      case "px-remove": return this._pxRemove(String(msg.name || ""));
      case "px-refresh": return this._pxRefresh(String(msg.name || ""));
      case "px-route": return this._pxRoute();
      case "px-test": return this._pxTest(String(msg.uid || ""));
      case "mf-state": return this._mfState();
      case "mf-set": return this._mfSet(String(msg.layer || ""), String(msg.id || ""));
      default: return;
    }
  }

  // 模式融合(提示词层×工具层 = 3×4 = 12): 真源在 mode-fusion.js(headless)。
  _mfState() {
    try { this._post({ type: "mf-state", data: modeFusion.state() }); }
    catch (e) { this._post({ type: "mf-state", error: e.message }); }
  }

  async _mfSet(layer, id) {
    try {
      if (layer === "prompt") {
        modeFusion.setPromptMode(id);
        // 本源反代在跑则即刻热切(/origin/mode); 不在跑不算失败(_origin_mode.txt 读盘生效)。
        modeFusion.syncOrigin(id).then((r) => {
          if (r.synced) vscode.window.showInformationMessage("提示词层模式已热切在跑反代: " + id);
        });
      } else if (layer === "tool") {
        modeFusion.setToolMode(id);
        // 桥在跑则即刻联动; 不在跑不算失败(契约文件已是真源)。
        modeFusion.syncBridge(id).then((r) => {
          if (r.synced) vscode.window.showInformationMessage("工具层模式已同步在跑桥: " + id);
        });
      } else throw new Error("未知模式层: " + layer);
    } catch (e) { vscode.window.showErrorMessage("切模式失败: " + e.message); }
    this._mfState();
  }

  // Proxy Pro 板块(插件自持模型渠道+路由): apiKey 永不出后端, 只回尾4位。
  _pxList() {
    let routeStatus = [];
    try { routeStatus = proxyRuntime.routeStatus(); } catch (_) {}
    this._post({ type: "px-list", data: proxyPro.listView(), routeStatus, file: proxyPro.cfgPath() });
  }

  // 路由试跑(生效层): 经 proxy-runtime 真正投递到该 UID 路由的第三方渠道, 与 local-api /api/proxy/chat 同源。
  async _pxTest(uid) {
    uid = String(uid || "").trim();
    if (!uid) { vscode.window.showWarningMessage("先选一个已配路由的官方模型 UID"); return; }
    const prompt = await vscode.window.showInputBox({ prompt: "试跑提示词(经路由投递到第三方渠道)", value: "你好, 用一句话自我介绍" });
    if (prompt === undefined) return;
    try {
      const r = await proxyRuntime.chat(uid, { messages: [{ role: "user", content: prompt }] });
      if (r.ok) vscode.window.showInformationMessage("路由生效 ✓ " + r.channel + "/" + r.model + " → " + String(r.content).slice(0, 120));
      else vscode.window.showErrorMessage("路由投递失败: " + (r.error || "未知"));
    } catch (e) { vscode.window.showErrorMessage("路由试跑失败: " + e.message); }
  }

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

  _html() {
    const n = nonce();
    const csp = ["default-src 'none'", "style-src 'unsafe-inline'", "script-src 'nonce-" + n + "'"].join("; ");
    return `<!DOCTYPE html><html lang="zh"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<style>
:root{color-scheme:dark light}
*{box-sizing:border-box}
body{margin:0;font:13px/1.5 var(--vscode-font-family,system-ui);color:var(--vscode-foreground);padding:14px 16px}
.st{font-size:11px;text-transform:uppercase;letter-spacing:.06em;opacity:.6;margin:14px 0 6px}
.card{border:1px solid var(--vscode-panel-border,#3334);border-radius:8px;padding:10px 12px;margin-bottom:10px}
.cr{display:flex;justify-content:space-between;gap:12px;padding:3px 0}
.cr .l{opacity:.65}.cr .v{text-align:right;word-break:break-all}
.acc{border:1px solid var(--vscode-panel-border,#3334);border-radius:8px;margin-bottom:10px;overflow:hidden}
.acc .hd{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:6px;padding:8px 12px;background:var(--vscode-list-hoverBackground,#8881);font-weight:600}
.badge{font-size:10px;padding:1px 7px;border-radius:10px;background:#0a53;margin-left:6px;font-weight:400}
.badge.cloud{background:#37a3}
.conv{padding:6px 12px;border-top:1px solid var(--vscode-panel-border,#2223);display:flex;justify-content:space-between;gap:8px}
.btn{background:var(--vscode-button-background,#0a5);color:var(--vscode-button-foreground,#fff);border:none;border-radius:5px;padding:5px 12px;cursor:pointer;font:inherit;white-space:nowrap;flex:0 0 auto}
.btn.sec{background:var(--vscode-button-secondaryBackground,#4443)}
.row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px}
.muted{opacity:.55}
.back{cursor:pointer;color:var(--vscode-textLink-foreground,#4af)}
h2{font-size:15px;margin:0 0 4px}
</style></head><body>
<div id="main"><div class="muted">加载渠道…</div></div>
<script nonce="${n}">
const vscode=acquireVsCodeApi();
function E(s){return String(s==null?"":s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function cr(l,v){return '<div class="cr"><span class="l">'+E(l)+'</span><span class="v">'+v+'</span></div>';}
let PX=null;let PXRS=[];let MF=null;
function renderModes(){
  let h='<div class="st">模式矩阵 · 提示词层 × 工具层 = 3×4 = 12</div>';
  if(MF===null)return h+'<div class="card muted">加载模式…</div>';
  if(MF.error)return h+'<div class="card">⚠ '+E(MF.error)+'</div>';
  const d=MF;
  h+='<div class="card">'+cr('当前组合',E(d.combinedName)+' <span class="badge">'+E(d.combined)+'</span>')+'</div>';
  h+='<div class="card"><div class="cr"><span class="l">提示词层(经藏契约)</span><span class="v">'+
    d.promptModes.map(m=>'<button class="btn'+(m.id===d.prompt?'':' sec')+'" data-mfp="'+E(m.id)+'" title="'+E(m.summary)+'">'+(m.id===d.prompt?'✓ ':'')+E(m.name)+'</button>').join(' ')+'</span></div>'+
    '<div class="cr"><span class="l">工具层(~/.dao/mode.json 契约)</span><span class="v">'+
    d.toolModes.map(m=>'<button class="btn'+(m.id===d.tool?'':' sec')+'" data-mft="'+E(m.id)+'" title="'+E(m.summary)+'">'+(m.id===d.tool?'✓ ':'')+E(m.name)+'</button>').join(' ')+'</span></div></div>';
  h+='<div class="muted" style="margin-bottom:10px">提示词层与 Proxy Pro 经藏契约同源(invert/passthrough/custom); 工具层与 Dao-Windows-Agent ModeManager 同一契约文件, 桥在跑即刻联动。</div>';
  return h;
}
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
  const rsMap={};for(const s of (PXRS||[]))rsMap[s.uid]=s;
  h+='<div class="st">模型路由(生效层)</div>';
  if(!rt.length)h+='<div class="card muted">暂无路由。点「配路由」把官方模型 UID 指向某渠道模型。</div>';
  else{h+='<div class="card">';for(const r of rt){const s=rsMap[r.uid]||{};const eff=s.effective?'<span class="badge">可投递✓</span>':'<span class="badge cloud">不可投递</span>';h+=cr(E(r.uid),'→ '+E(r.channel)+' / '+E(r.model)+' '+eff+' <span class="back" data-pxtest="'+E(r.uid)+'">试跑</span> <span class="back" data-pxunroute="'+E(r.uid)+'">解除</span>');}h+='</div>';}
  h+=renderModes();
  return h;
}
function render(){
  document.getElementById('main').innerHTML=renderProxy();
  const pxa=document.getElementById('pxAdd'); if(pxa)pxa.onclick=()=>vscode.postMessage({type:'px-add'});
  const pxrt=document.getElementById('pxRoute'); if(pxrt)pxrt.onclick=()=>vscode.postMessage({type:'px-route'});
  const pxrf=document.getElementById('pxRf'); if(pxrf)pxrf.onclick=()=>{PX=null;render();vscode.postMessage({type:'px-list'});};
  document.querySelectorAll('[data-pxref]').forEach(el=>el.onclick=()=>vscode.postMessage({type:'px-refresh',name:el.dataset.pxref}));
  document.querySelectorAll('[data-pxrm]').forEach(el=>el.onclick=()=>vscode.postMessage({type:'px-remove',name:el.dataset.pxrm}));
  document.querySelectorAll('[data-pxunroute]').forEach(el=>el.onclick=()=>vscode.postMessage({type:'px-route',uid:el.dataset.pxunroute}));
  document.querySelectorAll('[data-pxtest]').forEach(el=>el.onclick=()=>vscode.postMessage({type:'px-test',uid:el.dataset.pxtest}));
  document.querySelectorAll('[data-mfp]').forEach(el=>el.onclick=()=>vscode.postMessage({type:'mf-set',layer:'prompt',id:el.dataset.mfp}));
  document.querySelectorAll('[data-mft]').forEach(el=>el.onclick=()=>vscode.postMessage({type:'mf-set',layer:'tool',id:el.dataset.mft}));
}
window.addEventListener('message',e=>{const m=e.data||{};
  if(m.type==='px-list'){PX=m.data||{channels:[],routes:[]};PXRS=m.routeStatus||[];render();}
  else if(m.type==='mf-state'){MF=m.data?m.data:{error:m.error||'拉取失败'};render();}
});
render();
vscode.postMessage({type:'px-list'});
vscode.postMessage({type:'mf-state'});
</script></body></html>`;
  }
}

function register(context, log) {
  const panel = new ProxyProPanel(log);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("dao.proxyPro", panel, { webviewOptions: { retainContextWhenHidden: true } })
  );
  return panel;
}

module.exports = { register, ProxyProPanel };
