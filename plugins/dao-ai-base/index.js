// dao-ai-base — 可复用「AI 交互基底」(源自 dao-desktop · 得一以为天下正)
// ─────────────────────────────────────────────────────────────────────────────
// 把 dao-desktop 的核心三件套抽成任意领域插件可 vendor 的单一入口:
//   · windsurf-shim: 垫 Windsurf fork 私有 proposed API, 官方本体可在任意 VS Code 激活;
//   · dao-cascade:   纯 VS Code 可渲染的 Cascade 三模式面板(Cascade / Devin Local / Devin Cloud);
//   · 本体装载:      若插件内打包了官方 windsurf/dist, 折入激活; 宿主已有官方本体则共生。
// 领域插件用法(vendor 后):
//   const base = require("./dao-ai-base");
//   await base.activateDaoAiBase(context, { ns: "daoFreecad", log });
// 视图/命令 id 全部落在 <ns>.cascade* 命名空间, 多个领域插件互不相撞。
const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
const { installWindsurfShim } = require("./windsurf-shim");
const daoCascade = require("./dao-cascade/panel");

// 子目录隔离 context: 官方本体读自身资源时锚到 windsurf/ 目录; 其余字段透传。
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

// 激活基底。opts: { ns="dao", log, coreDir="windsurf", loadCore=true }
// 返回 { provider, core } — provider 为 Cascade 面板, core 为官方本体模块(若折入)。
async function activateDaoAiBase(context, opts) {
  const o = opts || {};
  const ns = o.ns || "dao";
  const log = o.log || (() => {});
  const coreDir = o.coreDir || "windsurf";
  const out = { provider: null, core: null };

  // ① 垫官方 fork 私有 proposed API。
  try { installWindsurfShim((ev, d) => log("[windsurf-shim] " + ev + (d ? " " + d : "")), { ns }); log("✓ windsurf 私有 proposed API 垫片就位"); }
  catch (e) { log("✗ windsurf 垫片失败: " + (e && e.stack ? e.stack : e)); }

  // ② Cascade 三模式面板(<ns>.cascade)。
  try { out.provider = daoCascade.register(context, (m) => log("[cascade] " + m), { ns }); log("✓ Cascade 三模式面板就位 (" + ns + ".cascade)"); }
  catch (e) { log("✗ Cascade 面板注册失败: " + (e && e.stack ? e.stack : e)); }

  // ③ 宿主已内建官方本体(codeium.windsurf) → 共生模式, 面板接宿主 LS, 不重复激活。
  const hostCore = vscode.extensions.getExtension("codeium.windsurf");
  const selfId = context.extension && context.extension.id;
  if (hostCore && hostCore.id !== selfId) {
    log("✓ 宿主内建官方本体 (codeium.windsurf " + ((hostCore.packageJSON || {}).version || "?") + ") · 共生模式");
    try {
      const { startDiscovery } = require("./dao-cascade/host-discover");
      const d = startDiscovery(null, log, 3000);
      context.subscriptions.push({ dispose: () => d.stop() });
    } catch (e) { log("✗ 共生宿主 LS 发现失败: " + (e && e.stack ? e.stack : e)); }
    return out;
  }

  // ④ 插件内打包了官方本体(构建期注入 dist) → 折入激活。
  if (o.loadCore !== false) {
    const full = path.join(context.extensionPath, coreDir, "dist", "extension.js");
    if (fs.existsSync(full)) {
      try {
        const mod = require(full);
        if (mod && typeof mod.activate === "function") {
          await mod.activate(subContext(context, coreDir));
          out.core = mod;
          log("✓ 官方 Devin 本体启动 (" + coreDir + ")");
        } else log("✗ 官方本体无 activate: " + full);
      } catch (e) { log("✗ 官方本体启动失败: " + (e && e.stack ? e.stack : e)); }
    } else {
      log("· 未打包官方本体 (缺 " + coreDir + "/dist/extension.js) · 面板经 host-discover 接任意在跑 LS");
      try {
        const { startDiscovery } = require("./dao-cascade/host-discover");
        const d = startDiscovery(null, log, 3000);
        context.subscriptions.push({ dispose: () => d.stop() });
      } catch (_) {}
    }
  }
  return out;
}

async function deactivateDaoAiBase(handle) {
  try { if (handle && handle.core && typeof handle.core.deactivate === "function") await handle.core.deactivate(); }
  catch (_) {}
}

// 生成领域插件 package.json 需合入的 contributes 片段(视图容器 + 视图 + 命令 + 菜单)。
function genContributes(ns, title) {
  const t = title || "AI 交互";
  return {
    viewsContainers: { activitybar: [{ id: ns + "-cascade", title: t, icon: "$(comment-discussion)" }] },
    views: { [ns + "-cascade"]: [{ id: ns + ".cascade", name: "Cascade · 三模式", type: "webview" }] },
    commands: [
      { command: ns + ".cascade.open", title: t + ": 聚焦 Cascade 三模式面板" },
      { command: ns + ".cascade.newSession", title: t + ": 新建 Cascade 会话", icon: "$(add)" },
      { command: ns + ".cascade.history", title: t + ": Cascade 历史会话", icon: "$(history)" },
      { command: ns + ".cascade.deepwiki", title: t + ": DeepWiki 解释选中符号" },
    ],
    menus: {
      "view/title": [
        { command: ns + ".cascade.newSession", when: "view == " + ns + ".cascade", group: "navigation@1" },
        { command: ns + ".cascade.history", when: "view == " + ns + ".cascade", group: "navigation@2" },
      ],
    },
  };
}

module.exports = {
  activateDaoAiBase, deactivateDaoAiBase, genContributes,
  // 领域提示词塑形器(隔离/替换层): 领域插件注册后, 三模式发送前统一塑形。
  setPromptShaper: daoCascade.setPromptShaper,
};
