// 道 · Cascade 轨 → 官方 windsurf language_server 直连桥(Connect RPC · JSON 编码)
// ─────────────────────────────────────────────────────────────────────────────
// 官方 Devin Desktop 里 Cascade 聊天 UI(fork workbench 内)与 language_server 的通信
// = Connect RPC(POST /exa.language_server_pb.LanguageServerService/<Method>,
//   头 x-codeium-csrf-token)。本桥以 JSON 编码走**同一协议、同一后端**,实现插件形态
// 的 Cascade 轨与官方同源 —— 端口与 CSRF 由 windsurf-shim 从官方本体捕获(hostState)。
//
// 实测校准(与官方逐包对齐):
//   · 每个 RPC 需 metadata{ideName,ideVersion,extensionName,extensionVersion,apiKey};
//     apiKey = 官方登录态的 windsurf_api_key(~/.local/share/devin/credentials.toml)。
//   · SendUserCascadeMessage 需 cascadeConfig.plannerConfig{requestedModelUid,
//     plannerTypeConfig:{agentic:{}}} —— 缺 plannerTypeConfig 则 planner 永不执行。
//   · 生成由 StreamCascadeReactiveUpdates(Connect server-streaming, id=cascadeId)
//     驱动 —— 不挂流则轨迹停在 CHECKPOINT;挂流期间轮询 GetCascadeTrajectorySteps
//     取 plannerResponse 文本。
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");

// 宿主态取自通用底层中枢(零 IDE 依赖): 进程内共生单例优先, 否则回落 ~/.dao/windsurf-host.json,
// 故本桥在纯 Node(无 vscode)环境亦可就绪 —— 只要机上官方 LS 会话已被捕获落盘或经 host-discover 发现。
const { resolveHost } = require("./host-state");

const SVC = "/exa.language_server_pb.LanguageServerService/";

function ready() {
  return resolveHost();
}

// 官方登录态 apiKey(windsurf_api_key): credentials.toml 为真源(官方 LS 鉴权用同一把钥匙);
// 部分登录模式(弱加密/仅会话令牌)不落 credentials.toml, 此时回退读 IDE globalStorage
// state.vscdb 里的 windsurfAuthStatus{apiKey}(sqlite 内明文存储, 直接按字节正则提取)。
let _keyCache = { key: "", at: 0 };

function credFilePath() {
  return process.env.DAO_DEVIN_CRED_FILE
    || path.join(os.homedir(), ".local", "share", "devin", "credentials.toml");
}

// 用户数据目录默认基址(跨平台): IDE 以默认 --user-data-dir 时的 globalStorage 落点。
function _defaultUserDataBases() {
  if (process.platform === "win32")
    return [process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming")];
  if (process.platform === "darwin")
    return [path.join(os.homedir(), "Library", "Application Support")];
  return [path.join(os.homedir(), ".config")];
}

// 运行中 IDE(devin-desktop/windsurf/code)的 --user-data-dir 派生 state.vscdb ——
// 自定义 user-data-dir 时官方登录态不落默认路径, 唯此可发现(headless / 冷启动亦然)。
function _runningUserDataDirs() {
  const dirs = new Set();
  if (process.platform !== "linux") return [...dirs];
  try {
    for (const d of fs.readdirSync("/proc")) {
      if (!/^\d+$/.test(d)) continue;
      let cmd = "";
      try { cmd = fs.readFileSync("/proc/" + d + "/cmdline", "latin1"); } catch (_) { continue; }
      if (!cmd) continue;
      const parts = cmd.split("\0");
      const idx = parts.indexOf("--user-data-dir");
      if (idx >= 0 && parts[idx + 1]) { dirs.add(parts[idx + 1]); continue; }
      const m = cmd.match(/--user-data-dir=([^\0]+)/);
      if (m) dirs.add(m[1]);
    }
  } catch (_) {}
  return [...dirs];
}

// 全部 state.vscdb 候选(去重·按可靠度排序): ①扩展注册的真实路径 ②运行中 IDE user-data-dir
// 派生 ③默认安装路径回退。
function stateDbCandidates() {
  const list = [];
  try {
    const { ideStateDbs } = require("./host-state");
    for (const p of ideStateDbs()) list.push(p);
  } catch (_) {}
  for (const udd of _runningUserDataDirs())
    list.push(path.join(udd, "User", "globalStorage", "state.vscdb"));
  for (const base of _defaultUserDataBases())
    for (const app of ["Devin", "Windsurf", "Windsurf - Next", "Code", "VSCodium"])
      list.push(path.join(base, app, "User", "globalStorage", "state.vscdb"));
  return [...new Set(list)];
}

function _keysFromStateDb(dbPath) {
  const keys = [];
  try {
    const s = fs.readFileSync(dbPath).toString("latin1");
    let i = -1;
    while ((i = s.indexOf("windsurfAuthStatus", i + 1)) >= 0) {
      const m = s.slice(i, i + 8192).match(/"apiKey":"([^"]+)"/);
      if (m && keys.indexOf(m[1]) < 0) keys.push(m[1]);
    }
  } catch (_) {}
  return keys;
}

// 有序去重候选 apiKey 集合: credentials.toml 真源 → 各 state.vscdb 登录态。
// 供 host-discover 逐个探测, 选中官方 LS 实际接受者(账号池切号/多登录态时不误判)。
function apiKeyCandidates() {
  const out = [];
  const push = (k) => { if (k && out.indexOf(k) < 0) out.push(k); };
  try {
    const t = fs.readFileSync(credFilePath(), "utf8");
    const m = t.match(/windsurf_api_key\s*=\s*"([^"]+)"/);
    if (m) push(m[1]);
  } catch (_) {}
  for (const db of stateDbCandidates()) for (const k of _keysFromStateDb(db)) push(k);
  return out;
}

// 首选 apiKey(back-compat): 探测选中的有效 key 经 setApiKey 回灌缓存后即返此。
function apiKey() {
  if (_keyCache.key && Date.now() - _keyCache.at < 60000) return _keyCache.key;
  const cands = apiKeyCandidates();
  if (cands.length) { _keyCache = { key: cands[0], at: Date.now() }; return cands[0]; }
  return "";
}

// host-discover 探测命中后回灌: 让后续 RPC 用官方 LS 实际接受的那把 key。
function setApiKey(k) {
  if (k && typeof k === "string") _keyCache = { key: k, at: Date.now() };
}

// 与官方扩展本体一致的调用方元数据(LS 端按此鉴权/归因)
function metadata() {
  return {
    ideName: "windsurf",
    ideVersion: "1.127.0",
    extensionName: "windsurf",
    extensionVersion: "1.63.9250",
    apiKey: apiKey(),
  };
}

function call(method, body, timeoutMs) {
  return new Promise((resolve, reject) => {
    const h = ready();
    if (!h) return reject(new Error("官方 language_server 未就绪(端口/CSRF 未捕获)"));
    const payload = Object.assign({ metadata: metadata() }, body || {});
    const data = Buffer.from(JSON.stringify(payload), "utf8");
    const req = http.request({
      host: "127.0.0.1", port: h.lsPort, path: SVC + method, method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-codeium-csrf-token": h.csrfToken,
        "Content-Length": data.length,
      },
    }, (r) => {
      let b = "";
      r.on("data", (c) => { b += c; });
      r.on("end", () => {
        try {
          const j = b ? JSON.parse(b) : {};
          if (r.statusCode !== 200) reject(new Error(method + ": " + (j.message || j.code || ("HTTP " + r.statusCode))));
          else resolve(j);
        } catch (e) { reject(new Error(method + ": 响应解析失败 " + e.message)); }
      });
    });
    req.setTimeout(timeoutMs || 30000, () => { req.destroy(new Error(method + ": 超时")); });
    req.on("error", reject);
    req.end(data);
  });
}

// 生成驱动流: 官方 UI 靠此 server-streaming 连接推动 Cascade 执行(不挂即停摆)。
// 返回 { close() } —— 消息发完/收完后调用 close 释放连接。
// onFrame(可选): 每收到一个反应式帧(轨迹变更信号)即回调 —— 以之唤醒轮询, 帧到立即拉增量
function driveStream(cascadeId, onFrame) {
  const h = ready();
  if (!h) return { close() {} };
  const body = Buffer.from(JSON.stringify({ metadata: metadata(), protocolVersion: 1, id: cascadeId }), "utf8");
  const env = Buffer.concat([Buffer.from([0, 0, 0, 0, 0]), body]);
  env.writeUInt32BE(body.length, 1); // Connect enveloped message: flags(1B)+len(4B)+json
  const req = http.request({
    host: "127.0.0.1", port: h.lsPort,
    path: SVC + "StreamCascadeReactiveUpdates", method: "POST",
    headers: {
      "Content-Type": "application/connect+json",
      "connect-protocol-version": "1",
      "x-codeium-csrf-token": h.csrfToken,
      "Content-Length": env.length,
    },
  });
  req.on("response", (r) => {
    let buf = Buffer.alloc(0);
    r.on("data", (c) => {
      if (!onFrame) return;
      buf = Buffer.concat([buf, c]);
      while (buf.length >= 5) {
        const len = buf.readUInt32BE(1);
        if (buf.length < 5 + len) break;
        buf = buf.slice(5 + len);
        try { onFrame(); } catch (_) {}
      }
    });
    r.on("error", () => {});
  });
  req.on("error", () => {});
  req.end(env);
  return { close() { try { req.destroy(); } catch (_) {} } };
}

// Connect server-streaming 通用调用(application/connect+json): 逐帧 JSON 回调 onMessage,
// 末帧(flags&2)为 trailer —— 携 error 时以异常抛出。GetDeepWiki 等流式方法走此轨。
// cancelRef(可选): 传入对象时回填 cancelRef.cancel(), 调用即主动断流(resolve, 不报错)
function callStream(method, body, onMessage, timeoutMs, cancelRef) {
  return new Promise((resolve, reject) => {
    const h = ready();
    if (!h) return reject(new Error("官方 language_server 未就绪(端口/CSRF 未捕获)"));
    const json = Buffer.from(JSON.stringify(Object.assign({ metadata: metadata() }, body || {})), "utf8");
    const env = Buffer.concat([Buffer.from([0, 0, 0, 0, 0]), json]);
    env.writeUInt32BE(json.length, 1);
    const req = http.request({
      host: "127.0.0.1", port: h.lsPort, path: SVC + method, method: "POST",
      headers: {
        "Content-Type": "application/connect+json",
        "connect-protocol-version": "1",
        "x-codeium-csrf-token": h.csrfToken,
        "Content-Length": env.length,
      },
    }, (r) => {
      if (r.statusCode !== 200) { r.resume(); return reject(new Error(method + ": HTTP " + r.statusCode)); }
      let buf = Buffer.alloc(0);
      let failed = null;
      r.on("data", (c) => {
        buf = Buffer.concat([buf, c]);
        while (buf.length >= 5) {
          const flags = buf.readUInt8(0), len = buf.readUInt32BE(1);
          if (buf.length < 5 + len) break;
          const raw = buf.slice(5, 5 + len).toString("utf8");
          buf = buf.slice(5 + len);
          let j = {};
          try { j = raw ? JSON.parse(raw) : {}; } catch (_) {}
          if (flags & 2) {
            if (j.error) failed = new Error(method + ": " + (j.error.message || j.error.code || "stream error"));
            continue;
          }
          try { onMessage(j); } catch (_) {}
        }
      });
      r.on("end", () => (failed ? reject(failed) : resolve()));
      r.on("error", (e) => (cancelled ? resolve() : reject(e)));
    });
    let cancelled = false;
    if (cancelRef) cancelRef.cancel = () => { cancelled = true; req.destroy(); resolve(); };
    req.setTimeout(timeoutMs || 120000, () => { req.destroy(new Error(method + ": 超时")); });
    req.on("error", (e) => (cancelled ? resolve() : reject(e)));
    req.end(env);
  });
}

// 可用模型: GetUserStatus → cascadeModelConfigData.clientModelConfigs
// disabled=false 者可用; 另回 creditMultiplier(倍率)与 disabledReason(Pro 门控原因)以 1:1 复刻官方模型选择器。
// 每项本身即携 modelInfo.modelFamilyUid / modelFamilyMetadata(族标签+Effort/Thinking/Fast Mode/1M Context 维度)
// / isRecommended / supportsImages —— 据此在选择器里按「模型族」分组并标注推荐/图像/维度(官方两级选择器同构)。
async function listModels() {
  const r = await call("GetUserStatus", {});
  const cfgs = (((r || {}).userStatus || {}).cascadeModelConfigData || {}).clientModelConfigs || [];
  return cfgs.map((c) => {
    const fm = c.modelFamilyMetadata || {};
    const dims = (fm.entries || []).map((e) => {
      const v = e.value || {};
      return v.name ? (e.key + ":" + v.name) : e.key; // "Effort:High" | "Thinking" | "1M Context"
    });
    // 价目: modelDimensions 中 kind=COST 项(Input/Cached input/Output, 单位 denominator=/1M tokens)
    const pricing = (c.modelDimensions || [])
      .filter((x) => x.kind === "MODEL_DIMENSION_KIND_COST")
      .map((x) => x.label + " $" + x.value + (x.denominator ? "/" + x.denominator : ""))
      .join(" · ");
    return {
      uid: c.modelUid,
      label: c.label || c.modelUid,
      disabled: !!c.disabled,
      credit: (typeof c.creditMultiplier === "number") ? c.creditMultiplier : null,
      reason: ((c.disabledReason || {}).shortReason) || "",
      reasonLink: ((c.disabledReason || {}).link) || "",
      familyUid: ((c.modelInfo || {}).modelFamilyUid) || "",
      familyLabel: fm.modelFamilyLabel || "",
      recommended: !!c.isRecommended,
      defaultInFamily: !!c.isDefaultModelInFamily,
      images: !!c.supportsImages,
      dims,
      pricing,
    };
  });
}

module.exports = { call, callStream, ready, metadata, apiKey, apiKeyCandidates, setApiKey, stateDbCandidates, driveStream, listModels };
