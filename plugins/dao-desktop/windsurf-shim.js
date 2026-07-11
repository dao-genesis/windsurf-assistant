// 道 · Windsurf fork 私有 vscode 命名空间垫片 —— 让官方 codeium.windsurf(Devin)在任意 VS Code 激活
// ─────────────────────────────────────────────────────────────────────────────
// 官方 Devin Desktop = Windsurf fork(打补丁的 VS Code)+ 内置扩展 codeium.windsurf。
// 该 fork 在 `vscode` 模块上注入了一整族私有成员, 原生 VS Code 皆无 → 官方扩展一取即崩。
// 反者道之动: 不改官方一行, 只把这族私有成员在其 activate 前垫回 vscode 对象(全进程同一引用)。
//
// 实测(grep dist/extension.js)官方用到的 fork 私有 vscode 成员:
//   函数: getWindsurfExtensionMetadata / getWindsurfIdeName / getWindsurfIdeVersion(bool→Promise)
//         getWindsurfConfigDirectory / getWindsurfExtensionLogs / getWindsurfJSAppDeployment
//         getWindsurfOrDevinConfiguration(section)→WorkspaceConfiguration
//   命名空间: windsurfAuth / windsurfAcp / windsurfLanguageServer / windsurfSettings /
//             windsurfMcp / windsurfAudio / windsurfProductEducation
//
// 垫片哲学「知止不殆」: 能桥接到标准 vscode API 的就桥接(如 getWindsurfOrDevinConfiguration →
//   vscode.workspace.getConfiguration), 纯 fork 私有的降级为安全 no-op, 绝不抛错。
//   getWindsurfExtensionMetadata 优先载入从真·Devin Desktop 宿主导出的静态元数据(copy 非复刻);
//   缺失时回落「魔法节点」——任意链式取值 / 取 .id / 迭代 / 转字符串皆安全, 保证不崩。
// ─────────────────────────────────────────────────────────────────────────────
const vscode = require("vscode");
const os = require("os");
const path = require("path");
const fs = require("fs");

// 宿主态中枢下沉至通用底层(零 IDE 依赖); shim 仅作 IDE 侧灌入/桥接。
const { hostState, hostFire } = require("./dao-cascade/host-state");

function noop() {}
function disposable() { return { dispose: noop }; }

// ── 魔法节点: 任意属性 → 递归魔法节点; toString/valueOf → 稳定字符串; 迭代 → 空; 可调用。────
function magicNode(hint) {
  const label = String(hint || "windsurf");
  const fn = function () { return magicNode(label); };
  return new Proxy(fn, {
    get(_t, prop) {
      if (prop === Symbol.toPrimitive) return () => label;
      if (prop === "toString" || prop === Symbol.toStringTag) return () => label;
      if (prop === "valueOf") return () => label;
      if (prop === Symbol.iterator) return function* () {};
      if (prop === "then") return undefined; // 非 thenable, 避免被误当 Promise
      if (prop === "id" || prop === "key" || prop === "name") return label + "." + String(prop);
      if (prop === "length") return 0;
      return magicNode(label + "." + String(prop));
    },
    apply() { return magicNode(label); },
    ownKeys() { return []; },
    has() { return false; },
  });
}

// ── 官方宿主元数据(copy 非复刻): 优先用真·Devin Desktop 导出的静态 JSON, 缺失回落魔法节点 ──
function loadHostMetadata() {
  const cands = [
    path.join(__dirname, "windsurf-host-metadata.json"),
    path.join(__dirname, "windsurf", "windsurf-host-metadata.json"),
  ];
  for (const p of cands) {
    try { if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf8")); } catch (_) {}
  }
  return null;
}

function makeExtensionMetadata() {
  const real = loadHostMetadata();
  if (real && typeof real === "object") {
    // 用真元数据, 但对任何缺失字段回落魔法节点 → 既 1:1 又不崩。
    return new Proxy(real, {
      get(t, prop) {
        if (prop in t) return t[prop];
        if (typeof prop === "string") return magicNode("meta." + prop);
        return undefined;
      },
    });
  }
  return magicNode("windsurfExtensionMetadata");
}

// ── windsurfAuth: 登录态 / 深链回跳 / 头像 上报通道(fork 宿主消费; 原生降级 no-op) ─────
function makeWindsurfAuth(emit) {
  let _status = null;
  return {
    notifyAuthRedirectReceived: () => emit("auth:redirect"),
    setAuthStatus: (s) => { _status = s; hostState().auth = s || null; hostFire(); emit("auth:status", s ? "signed-in" : "signed-out"); },
    getAuthStatus: () => _status,
    setProfileUrl: (u) => { hostState().profileUrl = u || ""; hostFire(); }, setProfilePicture: noop,
    onDidChangeAuth: () => disposable(),
  };
}

// ── windsurfAcp: Agent Client Protocol 连接器注册(远程 agent); 原生降级 no-op ─────────
function makeWindsurfAcp(emit) {
  return {
    setReconnectFallback: noop,
    registerAvailableConnector: (desc) => { emit("acp:connector", desc && desc.id); return disposable(); },
    unregisterAvailableConnector: noop,
    RemoteAcpConnector: { tryCreate: () => undefined },
    onDidChangeConnectors: () => disposable(),
  };
}

// ── windsurfLanguageServer: LSP 端口/CSRF/子进程信息注入通道 ───────────────────────────
function makeWindsurfLanguageServer() {
  return {
    version: vscode.version || "1.0.0",
    setPort: (p) => { hostState().lsPort = Number(p) || 0; hostFire(); },
    setCsrfToken: (t) => { hostState().csrfToken = String(t || ""); hostFire(); },
    setChildLanguageServerInfo: (i) => { hostState().child = i; hostFire(); },
  };
}

// 弹性命名空间: 已知方法保真, 未知方法/属性回落魔法节点(可调用·可 dispose·可链式·非 thenable),
// 官方新增任何未枚举方法皆安全不崩 —— 「为变所适」。
function resilient(obj, label) {
  return new Proxy(obj, {
    get(t, prop) {
      if (prop in t) return t[prop];
      if (prop === "then") return undefined;
      if (typeof prop === "symbol") return undefined;
      return magicNode(label + "." + String(prop));
    },
    has() { return true; },
  });
}

function installWindsurfShim(emit, opts) {
  const log = typeof emit === "function" ? emit : noop;
  // opts.ns: 命名空间(默认 "dao") —— openPanel 唤起 <ns>.cascade.open，供 dao-ai-base 多插件共存。
  const ns = (opts && opts.ns) || "dao";
  const def = (name, value) => {
    if (vscode[name] !== undefined) return;
    try { Object.defineProperty(vscode, name, { value, configurable: true, enumerable: false }); }
    catch (_) { try { vscode[name] = value; } catch (_) {} }
  };

  // ── Windsurf fork 给 vscode.workspace / vscode.window 追加的私有成员(原生无) ──
  //    事件 → 取 listener 返回 disposable; 方法 → no-op。直接补到 live 命名空间对象上。
  const patch = (target, name, value) => {
    if (!target || target[name] !== undefined) return;
    try { Object.defineProperty(target, name, { value, configurable: true, enumerable: false }); }
    catch (_) { try { target[name] = value; } catch (_) {} }
  };
  const event = () => () => disposable(); // (listener,...) => Disposable
  patch(vscode.workspace, "onDidFinishSearch", event());
  patch(vscode.window, "onDidTextEditorMouseUp", event());
  patch(vscode.window, "setTextEditorNudge", noop);
  patch(vscode.window, "clearTextEditorNudge", noop);

  // ── 命名空间(皆弹性包裹: 已知方法保真, 未知回落安全魔法节点) ──
  def("windsurfAuth", resilient(makeWindsurfAuth(log), "windsurfAuth"));
  def("windsurfAcp", resilient(makeWindsurfAcp(log), "windsurfAcp"));
  def("windsurfLanguageServer", resilient(makeWindsurfLanguageServer(), "windsurfLanguageServer"));
  def("windsurfSettings", resilient({
    resolveUnspecifiedSettings: (s) => s || {},
    setWindsurfPlanInformation: noop,
  }, "windsurfSettings"));
  def("windsurfMcp", resilient({ updateMcpServers: noop }, "windsurfMcp"));
  def("windsurfAudio", resilient({
    getAverageVolume: () => 0,
    startAudioRecording: () => disposable(),
    stopAudioRecording: noop,
  }, "windsurfAudio"));
  def("windsurfProductEducation", resilient({
    resetOnboardingState: noop,
    updateOnboardingSteps: noop,
  }, "windsurfProductEducation"));

  // WindsurfFiles: 拖拽文件到 Cascade 的事件源(原生无)。
  def("WindsurfFiles", resilient({ onDidDragToCascade: event() }, "WindsurfFiles"));
  // WindsurfNudgeButtonType: fork 提供的枚举, 仅作值传给(已 no-op 的)nudge API → 魔法节点即可。
  def("WindsurfNudgeButtonType", magicNode("WindsurfNudgeButtonType"));

  // Cascade: fork workbench 提供的宿主桥(原生无)。聊天面板 UI 在 fork workbench 内, 这里给出
  //   让扩展逻辑层完整跑通的语义化返回; openPanel 尽力经命令唤起我们自建的 Cascade webview。
  def("Cascade", resilient({
    registerCascadeMemoryProvider: () => disposable(),
    registerCascadeInputProvider: () => disposable(),
    getFocusState: async () => ({ isFocused: false, isVisible: false }),
    getCascadeStarterPrompts: async () => [],
    openPanel: async () => { try { await vscode.commands.executeCommand(ns + ".cascade.open"); } catch (_) {} },
    closePanel: async () => {},
  }, "Cascade"));

  // ── 函数 ──
  def("getWindsurfExtensionMetadata", () => makeExtensionMetadata());
  def("getWindsurfIdeName", () => "windsurf");
  def("getWindsurfIdeVersion", () => Promise.resolve(vscode.version || "1.0.0"));
  def("getWindsurfConfigDirectory", () => path.join(os.homedir(), ".codeium", "windsurf"));
  def("getWindsurfExtensionLogs", () => "");
  def("getWindsurfJSAppDeployment", () => magicNode("jsAppDeployment"));
  // getWindsurfOrDevinConfiguration(section) → 真 WorkspaceConfiguration(有 get/inspect/update)。
  def("getWindsurfOrDevinConfiguration", (section) =>
    vscode.workspace.getConfiguration(section ? "windsurf." + section : "windsurf"));

  return {
    hostMetadata: !!loadHostMetadata(),
    members: [
      "windsurfAuth", "windsurfAcp", "windsurfLanguageServer", "windsurfSettings",
      "windsurfMcp", "windsurfAudio", "windsurfProductEducation",
      "getWindsurfExtensionMetadata", "getWindsurfIdeName", "getWindsurfIdeVersion",
      "getWindsurfConfigDirectory", "getWindsurfExtensionLogs", "getWindsurfJSAppDeployment",
      "getWindsurfOrDevinConfiguration",
    ].filter((m) => vscode[m] !== undefined),
  };
}

module.exports = { installWindsurfShim, magicNode, hostState };