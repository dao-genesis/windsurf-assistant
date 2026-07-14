// 道 · 宿主态中枢(通用底层 · 零 IDE 依赖) —— LS 端口/CSRF/登录态的单一事实来源
// ─────────────────────────────────────────────────────────────────────────────
// 反者道之动: 此前 hostState 定义在 windsurf-shim.js 里, 而 shim 顶层 `require("vscode")`
//   —— 于是 ls-bridge/host-discover 只要碰 hostState 就被拖入 vscode 依赖, 纯 Node(无 IDE)
//   环境下 shim 载入即抛、hostState 恒空, RPC 核无法脱离 IDE 独立运行。
// 知止不殆: 把这族「与 IDE 无关」的宿主态(端口/CSRF/登录)下沉到本模块 —— 只用 fs/os/path,
//   任何宿主(VS Code 扩展 / CLI / 独立进程 / 他 IDE)皆可消费, 即所谓「通用底层」。
//   - 进程内(与官方扩展共生): globalThis 单例, shim 经 setPort/setCsrfToken 灌入。
//   - 跨进程(headless): 落盘 ~/.dao/windsurf-host.json(shim 每次变更即写), 后来者读回。
//   - 无宿主写入: 交由 host-discover 就地 /proc 扫描发现 —— 三路兜底, 道并行而不悖。
"use strict";
const os = require("os");
const path = require("path");
const fs = require("fs");

// 落盘路径可经环境变量重定向(便于测试 / 非默认家目录的宿主)。
function hostFilePath() {
  return process.env.DAO_WINDSURF_HOST_FILE
    || path.join(os.homedir(), ".dao", "windsurf-host.json");
}

// 全进程单例(与官方扩展、面板、桥同引用)。
function hostState() {
  const g = globalThis;
  if (!g.__daoWindsurfHost) {
    g.__daoWindsurfHost = { lsPort: 0, csrfToken: "", auth: null, profileUrl: "", fused: {}, listeners: new Set() };
  }
  return g.__daoWindsurfHost;
}

// 变更广播 + 落盘(0600 本机私有): 供 dao 生态(脚本/诊断/headless 核)读取会话信息。
function hostFire() {
  const h = hostState();
  seedFused(h);
  for (const fn of h.listeners) { try { fn(h); } catch (_) {} }
  try {
    const p = hostFilePath();
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify({
      lsPort: h.lsPort, csrfToken: h.csrfToken, profileUrl: h.profileUrl,
      auth: h.auth, fused: h.fused || {}, updatedAt: new Date().toISOString(),
    }), { mode: 0o600 });
  } catch (_) {}
}

// 融合态跨重启保鲜: 首次落盘前把磁盘上已有的 fused 分片回补进内存(内存缺失的键才补),
// 否则进程重启后 shim 首次 hostFire 会用空 fused 整份覆盖磁盘, 抹掉上个进程发布的账号/MCP。
function seedFused(h) {
  if (h._fusedSeeded) return;
  h._fusedSeeded = true;
  try {
    const j = JSON.parse(fs.readFileSync(hostFilePath(), "utf8"));
    if (j && j.fused) {
      h.fused = h.fused || {};
      for (const k of Object.keys(j.fused)) if (!(k in h.fused)) h.fused[k] = j.fused[k];
    }
  } catch (_) {}
}

// 从落盘文件回补单例(端口/CSRF 仅当进程内尚无; fused 分片总是回补缺失键): 跨进程复用会话。
function loadPersisted() {
  const h = hostState();
  seedFused(h);
  if (h.lsPort && h.csrfToken) return h;
  try {
    const j = JSON.parse(fs.readFileSync(hostFilePath(), "utf8"));
    if (j && j.lsPort && j.csrfToken) {
      h.lsPort = Number(j.lsPort) || 0;
      h.csrfToken = String(j.csrfToken || "");
      if (j.profileUrl && !h.profileUrl) h.profileUrl = j.profileUrl;
      if (j.auth && !h.auth) h.auth = j.auth;
    }
  } catch (_) {}
  return h;
}

// 解析可用宿主态: 进程内单例优先, 否则回落落盘文件; 二者皆无返回 null(未就绪)。
function resolveHost() {
  const h = hostState();
  if (h.lsPort && h.csrfToken) return h;
  const p = loadPersisted();
  return (p.lsPort && p.csrfToken) ? p : null;
}

// 归一发布: 把插件侧的融合态(账户信息/MCP 快照/备份水位等)并入宿主态并落盘,
// dao-one / dao-vsix 全功能面板(主页账号信息、MCP 板块)经 windsurf-host.json 直接消费。
function publishFused(part, data) {
  const h = hostState();
  h.fused = h.fused || {};
  h.fused[part] = Object.assign({ updatedAt: new Date().toISOString() },
    data && typeof data === "object" ? data : { value: data });
  hostFire();
  return h.fused[part];
}

// 订阅宿主态变更(返回 disposable)。
function subscribe(fn) {
  const h = hostState();
  h.listeners.add(fn);
  return { dispose() { h.listeners.delete(fn); } };
}

// IDE globalStorage state.vscdb 路径登记(供 apiKey 回退定位官方登录态)。
// 宿主扩展激活时由 context.globalStorageUri 派生真实路径注入 —— IDE 以自定义
// --user-data-dir 运行时, state.vscdb 不在默认 ~/.config/<app> 下, 唯此可靠。
function registerIdeStateDb(p) {
  const h = hostState();
  h._ideStateDbs = h._ideStateDbs || new Set();
  if (p && typeof p === "string") h._ideStateDbs.add(p);
}
function ideStateDbs() {
  const h = hostState();
  return h._ideStateDbs ? [...h._ideStateDbs] : [];
}

module.exports = { hostState, hostFire, loadPersisted, resolveHost, subscribe, hostFilePath, publishFused, registerIdeStateDb, ideStateDbs };
