// dao-desktop — Devin Desktop 插件版本体入口
// ─────────────────────────────────────────────────────────────────────────────
// 三件套装配(与 plugins/dao-ai-base 同源):
//   ① windsurf-shim: 垫 Windsurf fork 私有 proposed API → 官方本体可在任意 VS Code 激活;
//   ② dao-cascade:   Cascade 三模式面板(Cascade / Devin Local / Devin Cloud);
//   ③ 官方本体折入:  build.js 把官方 codeium.windsurf dist 放进 engines/windsurf/ 后,
//      本插件以子目录隔离 context 激活之; 未打包时经 host-discover 接任意在跑 LS。
const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
const { installWindsurfShim } = require("./windsurf-shim");
const daoCascade = require("./dao-cascade/panel");

const CORE_DIR = path.join("engines", "windsurf");

let output = null;
function log(m) {
  try {
    if (!output) output = vscode.window.createOutputChannel("Devin Desktop");
    output.appendLine("[" + new Date().toISOString().slice(11, 19) + "] " + m);
  } catch (_) {}
}

// 子目录隔离 context: 官方本体读自身资源时锚到 engines/windsurf/; 其余字段透传。
function subContext(ctx, subDir) {
  const subPath = path.join(ctx.extensionPath, subDir);
  const subUri = vscode.Uri.file(subPath);
  return new Proxy(ctx, {
    get(target, prop) {
      if (prop === "extensionPath") return subPath;
      if (prop === "extensionUri") return subUri;
      if (prop === "asAbsolutePath") return (rel) => path.join(subPath, rel);
      const v = target[prop];
      return typeof v === "function" ? v.bind(target) : v;
    },
  });
}

let coreModule = null;

async function activate(context) {
  log("dao-desktop 激活");

  // ① 垫官方 fork 私有 proposed API。
  try {
    installWindsurfShim((ev, d) => log("[windsurf-shim] " + ev + (d ? " " + d : "")), { ns: "dao" });
    log("✓ windsurf 私有 proposed API 垫片就位");
  } catch (e) { log("✗ windsurf 垫片失败: " + (e && e.stack ? e.stack : e)); }

  // ② Cascade 三模式面板(dao.cascade)。
  let cascadeProvider = null;
  try {
    cascadeProvider = daoCascade.register(context, (m) => log("[cascade] " + m), { ns: "dao" });
    log("✓ Cascade 三模式面板就位 (dao.cascade)");
  } catch (e) { log("✗ Cascade 面板注册失败: " + (e && e.stack ? e.stack : e)); }

  // ②b 归一面板(dao.unified): 插件本源统一管理(主页/双源对话备份/MCP, 持续扩板块)。
  let unifiedPanel = null;
  try {
    const unified = require("./dao-cascade/unified-panel");
    unifiedPanel = unified.register(context, (m) => log("[unified] " + m), { ns: "dao", cascade: cascadeProvider });
    log("✓ 归一面板就位 (dao.unified)");
  } catch (e) { log("✗ 归一面板注册失败: " + (e && e.stack ? e.stack : e)); }

  // ②b′ Agent 看板(dao.cascade.agentBoard): 官方「Agent 模式」整窗会话看板对位。
  try {
    require("./dao-cascade/agent-board").register(context, (m) => log("[agent-board] " + m));
    log("✓ Agent 看板就位 (dao.cascade.agentBoard)");
  } catch (e) { log("✗ Agent 看板注册失败: " + (e && e.stack ? e.stack : e)); }

  // ②b″ Devin Settings 整页(dao.cascade.openSettings): 官方设置页对位。
  try {
    require("./dao-cascade/settings-page").register(context, (m) => log("[settings] " + m), { unified: unifiedPanel });
    log("✓ Devin Settings 整页就位 (dao.cascade.openSettings)");
  } catch (e) { log("✗ Devin Settings 注册失败: " + (e && e.stack ? e.stack : e)); }

  // ②b‴ 编辑器内联键组(dao.cascade.inlineCommand / accept·rejectDiff): 官方编辑器内联操作面对位。
  try {
    require("./dao-cascade/inline-command").register(context, log, { ns: "dao", cascade: cascadeProvider });
    log("✓ 编辑器内联键组就位 (inlineCommand/diff accept·reject)");
  } catch (e) { log("✗ 编辑器内联键组注册失败: " + (e && e.stack ? e.stack : e)); }

  // ②b⁗ Cascade Bar(dao.cascade.cascadeBar): 官方 diff zone 操作条对位(hunk 导航/接受/拒绝)。
  try {
    require("./dao-cascade/cascade-bar").register(context, log);
    log("✓ Cascade Bar 就位 (六键 + 状态栏段)");
  } catch (e) { log("✗ Cascade Bar 注册失败: " + (e && e.stack ? e.stack : e)); }

  // ②b⁙ 官方命令对位补齐(importRulesFromCursor/openBrowser) + 覆盖审计模块。
  try {
    require("./dao-cascade/official-parity").register(context, log);
    log("✓ 官方命令对位就位 (importRulesFromCursor/openBrowser + /api/parity/commands)");
  } catch (e) { log("✗ 官方命令对位注册失败: " + (e && e.stack ? e.stack : e)); }

  // ②c Proxy Pro 独立面板(dao.proxyPro): 与 dao-proxy-pro 独立插件面板对位,
  // 插件自持渠道/路由(~/.dao/proxy-channels.json), 与 dao-vsix 的 ~/.codeium/dao-byok 隔离。
  try {
    const proxyProPanel = require("./dao-cascade/proxy-pro-panel");
    proxyProPanel.register(context, (m) => log("[proxy-pro] " + m));
    log("✓ Proxy Pro 独立面板就位 (dao.proxyPro)");
  } catch (e) { log("✗ Proxy Pro 面板注册失败: " + (e && e.stack ? e.stack : e)); }

  // ②d 本地 API 自启(后端打动一切): 端点全开放是本插件本源, 不应依赖面板按钮手点。
  // dao.localApi.autoStart=false 可关; 端口/token 落 ~/.dao/local-api.json(mode 600)。
  try {
    const auto = vscode.workspace.getConfiguration("dao").get("localApi.autoStart", true);
    if (auto) {
      const localApi = require("./dao-cascade/local-api");
      if (!localApi.running()) await localApi.start(0);
      log("✓ 本地 API 自启 (端口 " + localApi.port() + ", state " + localApi.statePath() + ")");
    }
  } catch (e) { log("✗ 本地 API 自启失败: " + (e && e.stack ? e.stack : e)); }

  // ③ 宿主已内建官方本体(codeium.windsurf) → 共生模式, 面板接宿主 LS, 不重复激活。
  const hostCore = vscode.extensions.getExtension("codeium.windsurf");
  const selfId = context.extension && context.extension.id;
  if (hostCore && hostCore.id !== selfId) {
    log("✓ 宿主内建官方本体 (codeium.windsurf " + ((hostCore.packageJSON || {}).version || "?") + ") · 共生模式");
    startHostDiscovery(context);
    return;
  }

  // ④ 插件内打包了官方本体(build.js 注入 engines/windsurf/dist) → 折入激活。
  const full = path.join(context.extensionPath, CORE_DIR, "dist", "extension.js");
  if (fs.existsSync(full)) {
    try {
      const mod = require(full);
      if (mod && typeof mod.activate === "function") {
        await mod.activate(subContext(context, CORE_DIR));
        coreModule = mod;
        log("✓ 官方 Devin 本体启动 (" + CORE_DIR + ")");
      } else log("✗ 官方本体无 activate: " + full);
    } catch (e) { log("✗ 官方本体启动失败: " + (e && e.stack ? e.stack : e)); }
  } else {
    log("· 未打包官方本体 (缺 " + CORE_DIR + "/dist/extension.js) · 面板经 host-discover 接任意在跑 LS");
    startHostDiscovery(context);
  }
}

function startHostDiscovery(context) {
  try {
    // 由扩展 context 派生 IDE 真实 globalStorage/state.vscdb —— IDE 以自定义
    // --user-data-dir 运行时, 官方登录态(windsurf_api_key)不在默认 ~/.config/<app> 下,
    // 唯此可靠定位, 否则 apiKey 取空 → LS 端口/CSRF 恒不采集 → Cascade「连接服务中」。
    try {
      const gsu = context.globalStorageUri && context.globalStorageUri.fsPath;
      if (gsu) {
        const { registerIdeStateDb } = require("./dao-cascade/host-state");
        registerIdeStateDb(path.join(path.dirname(gsu), "state.vscdb"));
      }
    } catch (_) {}
    try {
      const vscode = require("vscode");
      const wf = vscode.workspace.workspaceFolders;
      if (wf && wf[0] && wf[0].uri && wf[0].uri.fsPath)
        require("./dao-cascade/ls-boot").setWorkspaceDir(wf[0].uri.fsPath);
    } catch (_) {}
    const { startDiscovery } = require("./dao-cascade/host-discover");
    const d = startDiscovery(null, log, 3000);
    context.subscriptions.push({ dispose: () => d.stop() });
  } catch (e) { log("✗ 宿主 LS 发现失败: " + (e && e.stack ? e.stack : e)); }
}

async function deactivate() {
  try { require("./dao-cascade/ls-boot").stop(); } catch (_) {}
  try { if (coreModule && typeof coreModule.deactivate === "function") await coreModule.deactivate(); }
  catch (_) {}
}

module.exports = { activate, deactivate };
