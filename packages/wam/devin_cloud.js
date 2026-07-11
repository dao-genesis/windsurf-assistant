"use strict";
// ═══════════════════════════════════════════════════════════════════════════
// devin_cloud.js · RT Flow 第五板块 · Devin Cloud 接入底层 (无 vscode 依赖 · 可单测)
//
// 帛书·「执天之行」: 把 dao-export 的「对话提取」与 dao-vsix 的「全功能 CRUD」
// 两套底层合一, 直接服务 rt-flow 账号池 —— 每个账号 email+password → auth1+orgId,
// 之后所有 Devin Cloud 能力(对话列表/导出/备份/追踪/水过无痕清理)皆走后端接口。
//
// 软编码·唯变所适: 所有端点与并发/超时集中在 CFG, configure() 可在不改代码下调整。
// 凭证只在内存与 ~/.wam/devin_cloud 缓存, 绝不写入仓库。
// ═══════════════════════════════════════════════════════════════════════════
const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const zlib = require("zlib");

// ── 路径 (与 rt-flow 共用 ~/.wam 根) ──────────────────────────────────────
const WAM_DIR = path.join(os.homedir(), ".wam");
const DC_DIR = path.join(WAM_DIR, "devin_cloud");
const DC_AUTH_CACHE = path.join(DC_DIR, "auth_cache.json"); // email → {auth1,orgId,...,ts}
const DC_TAGS_FILE = path.join(DC_DIR, "account_tags.json"); // email → 标签(防搞混)
const DC_BACKUP_STATE = path.join(DC_DIR, "backup_state.json"); // devinId → {eventCount, backedUpAt} 增量依据
const DC_CLEANUP_STATE = path.join(DC_DIR, "cleanup_state.json"); // email → {backupCompletedAt, lastConvUpdateAt, cleanedAt} 24h冷却期
const DC_HOME_BACKUP = path.join(WAM_DIR, "devin_cloud_backups"); // 旧默认(home·多落 C 盘)
const DC_BACKUP_ROOT_STATE = path.join(DC_DIR, "backup_root.json"); // 持久化「自动数据盘」选择(稳定·不随空闲跳盘)

// ── 数据盘自动择优 (道法自然·让备份自落用户数据盘, 不压系统盘) ──────────────
//   规则: 仅本地固定盘(DriveType=3) · 排除系统盘(C:)与网络/可移动盘 · 取剩余空间最大者。
//   一次择定即持久化, 之后只读缓存(空闲变化不来回跳盘); 无其他盘 → 回落 home(C 盘)。
function _statfsFreeBytes(root) {
  try {
    if (typeof fs.statfsSync !== "function") return -1;
    const s = fs.statfsSync(root);
    return s.bavail * s.bsize;
  } catch (e) { return -1; }
}
function _systemDriveLetter() {
  const r = String(process.env.SystemDrive || (path.parse(os.homedir()).root) || "C:");
  const m = r.match(/[A-Za-z]/);
  return (m ? m[0] : "C").toUpperCase();
}
// CSV 解析: wmic /format:csv 首列是 Node(故 DeviceID 在 c[1]); PowerShell 行直接 DeviceID,Free,Size。
function _parseDriveCsv(out, hasNode) {
  const drives = [];
  for (const line of String(out).split(/\r?\n/)) {
    const c = line.split(",").map((x) => (x || "").trim());
    const dev = hasNode ? c[1] : c[0];
    const free = Number(hasNode ? c[2] : c[1]);
    const size = Number(hasNode ? c[3] : c[2]);
    if (dev && /^[A-Za-z]:$/.test(dev) && isFinite(free)) drives.push({ letter: dev[0].toUpperCase(), free, size: isFinite(size) ? size : 0 });
  }
  return drives;
}
// 现代 Windows(Win11 24H2 起已移除 wmic) → 用 CIM 取仅本地固定盘(DriveType=3)。
function _queryFixedDrivesPS() {
  try {
    const ps = 'Get-CimInstance -ClassName Win32_LogicalDisk -Filter "DriveType=3" | ForEach-Object { $_.DeviceID + "," + $_.FreeSpace + "," + $_.Size }';
    const enc = Buffer.from(ps, "utf16le").toString("base64");
    const out = require("child_process")
      .execSync("powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand " + enc, { timeout: 12000, windowsHide: true, stdio: ["ignore", "pipe", "ignore"] })
      .toString();
    const d = _parseDriveCsv(out, false);
    return d.length ? d : null;
  } catch (e) { return null; }
}
function _queryFixedDrivesWmic() {
  try {
    const out = require("child_process")
      .execSync('wmic logicaldisk where "DriveType=3" get DeviceID,FreeSpace,Size /format:csv', { timeout: 8000, windowsHide: true, stdio: ["ignore", "pipe", "ignore"] })
      .toString();
    const d = _parseDriveCsv(out, true);
    return d.length ? d : null;
  } catch (e) { return null; }
}
// 网络映射盘符 (net use): 末路 statfs 枚举时据此排除, 守「仅本地数据盘」之约。
function _networkDriveLetters() {
  const set = new Set();
  try {
    const out = require("child_process")
      .execSync("net use", { timeout: 6000, windowsHide: true, stdio: ["ignore", "pipe", "ignore"] })
      .toString();
    for (const line of out.split(/\r?\n/)) {
      const m = line.match(/\b([A-Za-z]):\s+\\\\/);
      if (m) set.add(m[1].toUpperCase());
    }
  } catch (e) {}
  return set;
}
// 列本地固定盘 (Windows): CIM 优先(现代可靠·辨 DriveType=3 排网络/可移动) → wmic 回落 → 末路 statfs 枚举(排网络映射盘)。
function listDataDrives() {
  if (process.platform !== "win32") return [];
  let drives = _queryFixedDrivesPS() || _queryFixedDrivesWmic();
  if (!drives || !drives.length) {
    const net = _networkDriveLetters();
    drives = [];
    for (let i = 67; i <= 90; i++) { // C..Z
      const L = String.fromCharCode(i);
      if (net.has(L)) continue; // 排网络盘(无 DriveType 信息时的守约)
      const root = L + ":\\";
      let free = -1;
      try { if (fs.existsSync(root)) free = _statfsFreeBytes(root); } catch (e) {}
      if (free >= 0) drives.push({ letter: L, free, size: 0 });
    }
  }
  const sys = _systemDriveLetter();
  return drives.map((d) => Object.assign({ system: d.letter === sys }, d));
}
let _backupDefaultCache = null;
// 持久化状态版本: 旧版(无 v 或 v<2)可能误选网络盘(wmic 缺失回落枚举所致), 故只信任 v>=2 的选择, 自愈历史脏状态。
const DC_BACKUP_STATE_V = 2;
// 自动择优备份根: 持久化选择优先(快·无需查盘) → 否则择最空数据盘并持久化 → 无则回落 home。
function getOptimalBackupRoot() {
  if (_backupDefaultCache) return _backupDefaultCache;
  if (process.platform !== "win32") return (_backupDefaultCache = DC_HOME_BACKUP);
  // 1) 持久化选择 (版本达标 + 盘仍在即用·稳定不跳盘; 旧版脏状态忽略并重选)
  try {
    const j = JSON.parse(fs.readFileSync(DC_BACKUP_ROOT_STATE, "utf8"));
    if (j && j.root && Number(j.v) >= DC_BACKUP_STATE_V && fs.existsSync(path.parse(j.root).root || "")) return (_backupDefaultCache = j.root);
  } catch (e) {}
  // 2) 择最空非系统固定盘 (需 ≥10GB 余量·避开微型恢复分区/U 盘残留)
  const MIN_FREE = 10 * 1024 * 1024 * 1024;
  const sys = _systemDriveLetter();
  const cands = listDataDrives().filter((d) => d.letter !== sys && !d.system && d.free >= MIN_FREE);
  if (!cands.length) return (_backupDefaultCache = DC_HOME_BACKUP); // 无够大数据盘 → 沿用 home
  cands.sort((a, b) => b.free - a.free);
  const root = path.join(cands[0].letter + ":\\", "DaoDevinBackups");
  try {
    fs.mkdirSync(DC_DIR, { recursive: true });
    fs.writeFileSync(DC_BACKUP_ROOT_STATE, JSON.stringify({ v: DC_BACKUP_STATE_V, root, chosenAt: Date.now(), sysDrive: sys, freeBytes: cands[0].free }));
  } catch (e) {}
  return (_backupDefaultCache = root);
}
// 显式记录选择(供迁移后钉住目标盘·使后续启动走快路径不再查盘)。
function setBackupRoot(root) {
  _backupDefaultCache = root || null;
  try {
    fs.mkdirSync(DC_DIR, { recursive: true });
    fs.writeFileSync(DC_BACKUP_ROOT_STATE, JSON.stringify({ v: DC_BACKUP_STATE_V, root, chosenAt: Date.now(), manual: true }));
  } catch (e) {}
  return root;
}
// 迁移既有备份: 递归拷贝 oldRoot → newRoot (不删源·安全), 回报文件数/字节数。
function migrateBackups(oldRoot, newRoot, opts) {
  opts = opts || {};
  const prog = typeof opts.onProgress === "function" ? opts.onProgress : () => {};
  const res = { ok: false, from: oldRoot, to: newRoot, files: 0, bytes: 0, skipped: false, error: "" };
  try {
    if (!oldRoot || !fs.existsSync(oldRoot)) { res.skipped = true; res.ok = true; prog("无既有备份可迁移"); return res; }
    if (path.resolve(oldRoot) === path.resolve(newRoot)) { res.skipped = true; res.ok = true; prog("源与目标相同·跳过"); return res; }
    // 统计
    const walk = (dir) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) walk(p); else { try { res.files++; res.bytes += fs.statSync(p).size; } catch (x) {} } } };
    walk(oldRoot);
    prog("迁移中: " + res.files + " 个文件 / " + (res.bytes / 1048576).toFixed(1) + " MB → " + newRoot);
    // 迭代式逐文件拷贝 (栈式遍历·非递归): 规避 fs.cpSync 在大目录树/深层结构上的原生崩溃(Windows 0xC0000409),
    // 且可逐文件容错、按字节累计真实进度。
    fs.mkdirSync(newRoot, { recursive: true });
    let copied = 0, copiedBytes = 0, lastTick = 0;
    const stack = [["", true]]; // [相对路径, 是否目录]
    while (stack.length) {
      const [rel, isDir] = stack.pop();
      const srcP = rel ? path.join(oldRoot, rel) : oldRoot;
      const dstP = rel ? path.join(newRoot, rel) : newRoot;
      if (isDir) {
        try { fs.mkdirSync(dstP, { recursive: true }); } catch (x) {}
        let entries = [];
        try { entries = fs.readdirSync(srcP, { withFileTypes: true }); } catch (x) { continue; }
        for (const e of entries) stack.push([rel ? path.join(rel, e.name) : e.name, e.isDirectory()]);
      } else {
        try {
          fs.copyFileSync(srcP, dstP);
          copied++; copiedBytes += (() => { try { return fs.statSync(dstP).size; } catch (x) { return 0; } })();
          if (copied - lastTick >= 500) { lastTick = copied; prog("已拷贝 " + copied + "/" + res.files + " 个文件 / " + (copiedBytes / 1048576).toFixed(1) + " MB"); }
        } catch (x) { res.error = res.error || ("部分文件拷贝失败: " + String((x && x.message) || x)); }
      }
    }
    res.copied = copied; res.copiedBytes = copiedBytes;
    res.ok = (copied >= res.files);
    prog("迁移完成: " + copied + "/" + res.files + " 个文件");
  } catch (e) {
    res.error = String((e && e.message) || e);
    prog("迁移失败: " + res.error);
  }
  return res;
}
const DC_BACKUP_DEFAULT = getOptimalBackupRoot();

// ── 软编码配置 (唯变所适) ──────────────────────────────────────────────────
const CFG = {
  loginUrl: "https://windsurf.com/_devin-auth/password/login",
  apiBase: "https://app.devin.ai/api",
  // 续写消息走官方公开 API (app.devin.ai/api 无此 REST 路由; 实测全部 404)。
  // 实测: api.devin.ai/v1/session/{id}/message 返回 403 (路由存在·凭证不符),
  // 其余 /v1/sessions/{id}/messages 返回 404 → 确证正确端点为单数 /session/{id}/message。
  v1Base: "https://api.devin.ai/v1",
  apiKey: "", // Devin 官方 API Key (apk_...); 续写消息所需, 会话登录态 auth1 不被公开 API 接受。
  ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) rt-flow-devin-cloud",
  authTtlMs: 12 * 60 * 60 * 1000, // 登录态缓存 12h
  reqTimeoutMs: 30000,
  streamTimeoutMs: 90000, // v: 180000→90000 弱链路下更快回收挂死的 event-stream socket
  streamRetryDelayMs: 1500, // event-stream 流式拉取 3 试之间的间隔退避 (软编码·便于单测加速)
  maxRetries: 3, // 瞬态网络错误(TLS socket 断/ECONNRESET/超时)自动重试次数 (弱者道之用·反复至成)
  retryBaseMs: 500, // 重试退避基数 (指数: 500/1000/2000ms)
  rateLimitMaxRetries: 6, // HTTP 429 限流重试次数 (多账号预载/普查最易撞限流·退避后必复)
  retryMaxDelayMs: 30000, // 单次退避上限 (Retry-After 过大时封顶, 不无限等)
  downloadTimeoutMs: 60000, // v: 120000→60000 超时即回收卡死的下载 socket
  downloadConcurrency: 6, // v: 16→6 降低单对话内并发下载 socket 扇出
  presignConcurrency: 4, // v: 8→4
  presignChunk: 40,
  // ── 连接复用 · 有界 keep-alive socket 预算 (釜底抽薪) ──
  // agent:false / 默认 globalAgent 会「每请求新建 socket + 用完不复用」, 多账号×多窗口备份把
  // 家用路由器 NAT/conntrack 打满 → WAN 丢包/隧道反复掉线。下列上限既保全部备份功能,
  // 又把单进程对同一 host 的并发 socket 收敛到家用路由器可承受范围 (鱼与熊掌兼得)。
  maxSocketsPerHost: 8, // 单进程对同一 host 的并发 socket 硬上限 (> downloadConcurrency · 不卡备份吞吐)
  maxFreeSockets: 4, // 空闲保活 socket 上限 (复用而不无限堆积)
  socketIdleTimeoutMs: 15000, // 空闲 socket 超时回收 (防 Bound/FinWait/TimeWait 堆积)
  convConcurrency: 2, // v: 5→2 同账号内并行备份的对话数 (每对话内文件再并发 downloadConcurrency)
  // 备份并发上限 = convConcurrency × downloadConcurrency = 2×6 = 12 (原 5×16 = 80)。
  // ── 前台「极速」档 · 仅用户主动点击的单次下载 (区别于后台周期普查) ──
  // 道法自然·食其时: 后台普查须细水长流(上方 lean 档, 防 conntrack 风暴);
  // 但用户「手动点下载」是一次性、有界、不随窗口数倍增的前台动作 → 可放开并发抢速度。
  // 该档仅在显式 opts.turbo 下生效, 用独立短命 Agent, 用完即毁, 绝不影响后台普查的 socket 预算。
  turboDownloadConcurrency: 24, // 前台单次下载: 单对话内并发下载文件数 (lean 档 6 → 24)
  turboConvConcurrency: 6, // 前台单次下载: 同账号并行对话数 (lean 档 2 → 6)
  turboMaxSocketsPerHost: 32, // 前台 Agent 对同 host 并发 socket 上限 (> turboDownloadConcurrency)
};
function configure(opts) {
  if (opts && typeof opts === "object") Object.assign(CFG, opts);
  _rebuildAgents();
  return CFG;
}

// ── 有界 keep-alive 共享 Agent (连接复用 + 单进程对同 host 并发 socket 硬上限) ──
// 道法自然·绝利一源: 一个进程一组复用池, 杜绝「每请求新建+不复用」的 socket 海量泄漏。
function _mkAgent(mod) {
  return new mod.Agent({
    keepAlive: true,
    keepAliveMsecs: 1000,
    maxSockets: Math.max(1, (CFG.maxSocketsPerHost | 0) || 8),
    maxFreeSockets: Math.max(0, (CFG.maxFreeSockets | 0) || 4),
    timeout: Math.max(1000, (CFG.socketIdleTimeoutMs | 0) || 15000),
    scheduling: "fifo",
  });
}
let _httpsAgent = _mkAgent(https);
let _httpAgent = _mkAgent(http);
// 前台「极速」档专用 Agent (高 socket 上限) · 仅用户主动下载时临时创建、用完即毁。
// 与后台 lean Agent 完全隔离: 后台周期普查的 socket 预算丝毫不受影响 (鱼与熊掌兼得)。
function _mkTurboAgent(mod) {
  return new mod.Agent({
    keepAlive: true,
    keepAliveMsecs: 1000,
    maxSockets: Math.max(1, (CFG.turboMaxSocketsPerHost | 0) || 32),
    maxFreeSockets: Math.max(0, (CFG.maxFreeSockets | 0) || 4),
    timeout: Math.max(1000, (CFG.downloadTimeoutMs | 0) || 60000),
    scheduling: "fifo",
  });
}
function _rebuildAgents() {
  try {
    if (_httpsAgent && _httpsAgent.destroy) _httpsAgent.destroy();
  } catch {}
  try {
    if (_httpAgent && _httpAgent.destroy) _httpAgent.destroy();
  } catch {}
  _httpsAgent = _mkAgent(https);
  _httpAgent = _mkAgent(http);
}

function ensureDir(d) {
  try {
    fs.mkdirSync(d, { recursive: true });
  } catch {}
}
function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}
function writeJson(file, obj) {
  try {
    ensureDir(path.dirname(file));
    fs.writeFileSync(file, JSON.stringify(obj, null, 2));
  } catch {}
}

// ═══ 低层 HTTP (含 env 代理 CONNECT 隧道 + gzip/br 解码) ═══════════════════
function proxyForUrl(targetUrl) {
  const u = new URL(targetUrl);
  const isHttps = u.protocol === "https:";
  const env = process.env;
  const noProxy = env.NO_PROXY || env.no_proxy || "";
  if (noProxy === "*") return null;
  if (noProxy) {
    const host = u.hostname.toLowerCase();
    for (const part of noProxy.split(",").map((s) => s.trim().toLowerCase())) {
      if (part && (host === part || host.endsWith("." + part.replace(/^\./, "")))) return null;
    }
  }
  const p =
    (isHttps && (env.HTTPS_PROXY || env.https_proxy)) ||
    env.HTTP_PROXY ||
    env.http_proxy ||
    env.ALL_PROXY ||
    env.all_proxy ||
    "";
  if (!p) return null;
  try {
    return new URL(p);
  } catch {
    return null;
  }
}

// 瞬态错误判定: TLS 握手前 socket 断开 / 连接重置 / 超时 / DNS 抖动 等可重试
function _isTransientErr(e) {
  const m = String((e && (e.message || e.code)) || e || "").toLowerCase();
  return (
    m.includes("socket disconnected") || // "Client network socket disconnected before secure TLS connection was established"
    m.includes("econnreset") ||
    m.includes("econnrefused") ||
    m.includes("etimedout") ||
    m.includes("timeout") ||
    m.includes("eai_again") ||
    m.includes("enotfound") ||
    m.includes("epipe") ||
    m.includes("ehostunreach") ||
    m.includes("enetunreach") ||
    m.includes("socket hang up") ||
    m.includes("tls")
  );
}
function _sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
// HTTP 状态码层面的可重试判定 (网络层无错·服务端限流/暂不可用):
//   429 限流 → 任意方法皆安全重试 (请求被拒·未被处理, 退避后重发恒幂等);
//   502/503/504 网关/不可用 → 仅幂等方法 (GET/HEAD) 重试, 避免对非幂等变更重复提交。
function _isRetryableStatus(status, method) {
  if (status === 429) return true;
  if (status === 502 || status === 503 || status === 504) {
    const m = String(method || "").toUpperCase();
    return m === "GET" || m === "HEAD";
  }
  return false;
}
// 退避时长: 优先遵从服务端 Retry-After (秒数或 HTTP-date), 取不到则指数退避 + 抖动。
//   抖动 (jitter) 分散「并发预载 N 账号同时撞 429 → 同时重试」的二次冲击 (绝利一源)。
function _retryDelayMs(headers, attempt) {
  const cap = CFG.retryMaxDelayMs | 0 || 30000;
  const ra = headers && (headers["retry-after"] || headers["Retry-After"]);
  if (ra != null && ra !== "") {
    const secs = parseInt(ra, 10);
    if (Number.isFinite(secs) && String(secs) === String(ra).trim()) return Math.min(Math.max(0, secs) * 1000, cap);
    const when = Date.parse(ra);
    if (Number.isFinite(when)) return Math.max(0, Math.min(when - Date.now(), cap));
  }
  const base = CFG.retryBaseMs * Math.pow(2, attempt);
  return Math.min(base + Math.floor(Math.random() * CFG.retryBaseMs), cap);
}
// 善行无辙迹: 瞬态网络错误指数退避重试, 一次性彻底错误(bad_url 等)立即上抛。
async function rawRequest(method, targetUrl, headers, body, timeoutMs, agentOverride) {
  const maxNet = Math.max(0, CFG.maxRetries | 0);
  const maxRl = Math.max(0, CFG.rateLimitMaxRetries | 0);
  const max = Math.max(maxNet, maxRl);
  let lastErr;
  for (let attempt = 0; attempt <= max; attempt++) {
    try {
      const res = await _rawRequestOnce(method, targetUrl, headers, body, timeoutMs, agentOverride);
      // 429/5xx: 状态码层面的暂时性故障 — 退避后重试 (遵从 Retry-After), 而非当作
      // 「请求已失败」直接上抛。这正是多账号预载/普查时 login 误报 LOGIN_FAIL 的根因。
      if (_isRetryableStatus(res.status, method) && attempt < maxRl) {
        await _sleep(_retryDelayMs(res.headers, attempt));
        continue;
      }
      return res;
    } catch (e) {
      lastErr = e;
      if (attempt >= maxNet || !_isTransientErr(e)) break;
      await _sleep(CFG.retryBaseMs * Math.pow(2, attempt));
    }
  }
  throw lastErr;
}
function _rawRequestOnce(method, targetUrl, headers, body, timeoutMs, agentOverride) {
  return new Promise((resolve, reject) => {
    let u;
    try {
      u = new URL(targetUrl);
    } catch (e) {
      return reject(e);
    }
    const isHttps = u.protocol === "https:";
    const tout = timeoutMs || CFG.reqTimeoutMs;
    const hdrs = Object.assign(
      { "User-Agent": CFG.ua, Accept: "application/json" },
      headers || {},
    );
    const proxy = proxyForUrl(targetUrl);

    const onResponse = (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        let buf = Buffer.concat(chunks);
        const enc = String(res.headers["content-encoding"] || "").toLowerCase();
        try {
          if (enc === "gzip") buf = zlib.gunzipSync(buf);
          else if (enc === "deflate") buf = zlib.inflateSync(buf);
          else if (enc === "br") buf = zlib.brotliDecompressSync(buf);
        } catch {}
        resolve({ status: res.statusCode || 0, headers: res.headers, buf });
      });
      res.on("error", reject);
    };

    const fire = (opts, mod) => {
      const req = mod.request(opts, onResponse);
      req.on("error", reject);
      req.on("timeout", () => req.destroy(new Error("timeout")));
      if (body) req.write(body);
      req.end();
    };

    if (proxy && isHttps) {
      // CONNECT 隧道 → 目标 TLS
      const c = http.request({
        host: proxy.hostname,
        port: parseInt(proxy.port || "8080", 10),
        method: "CONNECT",
        path: u.hostname + ":" + (u.port || 443),
        timeout: tout,
      });
      c.on("connect", (_res, socket) => {
        fire(
          {
            method,
            host: u.hostname,
            port: u.port ? parseInt(u.port, 10) : 443,
            path: u.pathname + u.search,
            headers: hdrs,
            timeout: tout,
            socket,
            agent: false,
            rejectUnauthorized: false,
          },
          https,
        );
      });
      c.on("error", reject);
      c.on("timeout", () => c.destroy(new Error("proxy connect timeout")));
      c.end();
      return;
    }
    if (proxy && !isHttps) {
      fire(
        {
          host: proxy.hostname,
          port: parseInt(proxy.port || "8080", 10),
          method,
          path: targetUrl,
          headers: Object.assign({ Host: u.hostname }, hdrs),
          timeout: tout,
          agent: _httpAgent,
        },
        http,
      );
      return;
    }
    fire(
      {
        method,
        host: u.hostname,
        port: u.port ? parseInt(u.port, 10) : isHttps ? 443 : 80,
        path: u.pathname + u.search,
        headers: hdrs,
        timeout: tout,
        agent: agentOverride || (isHttps ? _httpsAgent : _httpAgent),
        rejectUnauthorized: false,
      },
      isHttps ? https : http,
    );
  });
}

async function jsonRequest(method, url, headers, body, timeoutMs) {
  const h = Object.assign({}, headers || {});
  let payload;
  if (body != null) {
    payload = typeof body === "string" ? body : JSON.stringify(body);
    h["Content-Type"] = h["Content-Type"] || "application/json";
  }
  const r = await rawRequest(method, url, h, payload, timeoutMs);
  const text = r.buf.toString("utf8");
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: r.status, json, text, headers: r.headers };
}

// ═══ 登录 / 鉴权 ═══════════════════════════════════════════════════════════
function authHeaders(auth, extra) {
  return Object.assign(
    { Authorization: "Bearer " + auth.auth1, "x-cog-org-id": auth.orgId },
    extra || {},
  );
}

async function login(email, password) {
  const resp = await jsonRequest("POST", CFG.loginUrl, {}, { email, password });
  if (resp.status !== 200 || !resp.json) {
    return { ok: false, error: "login HTTP " + resp.status + ": " + resp.text.slice(0, 160) };
  }
  const auth1 = resp.json.token || resp.json.access_token;
  if (!auth1) return { ok: false, error: "登录响应无 token" };
  // v4.8.0 · user-XXX · 路由官网注入 localStorage['auth1_session'].userId 所需
  const userId = resp.json.user_id || resp.json.userId || "";
  const orgResp = await jsonRequest(
    "POST",
    CFG.apiBase + "/users/post-auth",
    { Authorization: "Bearer " + auth1 },
    {},
  );
  const od = orgResp.json || {};
  const orgId = od.org_id || od.orgId || "";
  if (!orgId) return { ok: false, error: "post-auth 无 org_id (HTTP " + orgResp.status + ")" };
  return {
    ok: true,
    auth1,
    userId,
    orgId,
    orgBare: orgId.replace(/^org-/, ""),
    orgName: od.org_name || od.orgName || "",
    email,
  };
}

// 登录态缓存: email → auth. 12h 内复用, 过期或 force 时重登。
async function getAuth(email, password, opts) {
  opts = opts || {};
  const cache = readJson(DC_AUTH_CACHE, {});
  const key = String(email).toLowerCase();
  const hit = cache[key];
  if (!opts.force && hit && hit.auth1 && Date.now() - (hit.ts || 0) < CFG.authTtlMs) {
    return { ok: true, auth1: hit.auth1, userId: hit.userId || "", orgId: hit.orgId, orgBare: hit.orgBare, orgName: hit.orgName, email, cached: true };
  }
  const r = await login(email, password);
  if (r.ok) {
    cache[key] = { auth1: r.auth1, userId: r.userId || "", orgId: r.orgId, orgBare: r.orgBare, orgName: r.orgName, ts: Date.now() };
    writeJson(DC_AUTH_CACHE, cache);
  }
  return r;
}

function clearAuthCache(email) {
  const cache = readJson(DC_AUTH_CACHE, {});
  if (email) delete cache[String(email).toLowerCase()];
  else for (const k of Object.keys(cache)) delete cache[k];
  writeJson(DC_AUTH_CACHE, cache);
}

// 已登录(缓存内且未过期)账号 → 用于轻量轮询运行状态, 不强行登录全部账号 (无为)
function getCachedAuth(email) {
  const hit = readJson(DC_AUTH_CACHE, {})[String(email).toLowerCase()];
  if (hit && hit.auth1 && Date.now() - (hit.ts || 0) < CFG.authTtlMs) {
    return { auth1: hit.auth1, userId: hit.userId || "", orgId: hit.orgId, orgBare: hit.orgBare, orgName: hit.orgName, email };
  }
  return null;
}
function cachedEmails() {
  const cache = readJson(DC_AUTH_CACHE, {});
  return Object.keys(cache).filter((k) => cache[k] && cache[k].auth1 && Date.now() - (cache[k].ts || 0) < CFG.authTtlMs);
}

// ═══ Cloud 读取 ════════════════════════════════════════════════════════════
function asArray(j, ...keys) {
  if (Array.isArray(j)) return j;
  if (!j || typeof j !== "object") return [];
  for (const k of keys) if (Array.isArray(j[k])) return j[k];
  return [];
}

async function listSessions(auth, limit) {
  let url = CFG.apiBase + "/org-" + auth.orgBare + "/v2sessions";
  if (limit) url += "?limit=" + limit;
  let r = await jsonRequest("GET", url, authHeaders(auth), null, 60000);
  if (r.status === 200) {
    const arr = asArray(r.json, "result", "sessions", "data");
    if (arr.length || (r.json && (r.json.result || r.json.sessions))) return { ok: true, sessions: arr };
  }
  // 备用端点
  r = await jsonRequest("GET", CFG.apiBase + "/sessions", authHeaders(auth), null, 60000);
  if (r.status === 200) return { ok: true, sessions: asArray(r.json, "result", "sessions", "data") };
  return { ok: false, sessions: [], error: "list sessions HTTP " + r.status };
}

async function getSessionDetail(auth, devinId) {
  const r = await jsonRequest("GET", CFG.apiBase + "/sessions/" + devinId, authHeaders(auth));
  return r.status === 200 ? r.json || {} : {};
}

// ═══ Cloud 写入 (代替用户发起对话) ═══════════════════════════════════════════
// 发起一个新的 Devin Cloud 对话 (session)。prompt 为首条用户消息。
// opts: { title, tags, playbookId, repos, sessionSecrets, idempotencyKey }
async function createSession(auth, prompt, opts) {
  opts = opts || {};
  // app.devin.ai 内部 API 的 /sessions 校验字段为 user_message (非 prompt);
  // 两个都带上以兼容内部/公开两套契约 (实跑 422 揭示: body.user_message required)。
  const payload = { user_message: String(prompt || ""), prompt: String(prompt || "") };
  if (opts.title) payload.title = opts.title;
  if (opts.tags) payload.tags = opts.tags;
  if (opts.playbookId) payload.playbook_id = opts.playbookId;
  if (opts.repos) payload.repos = opts.repos;
  if (opts.sessionSecrets) payload.session_secrets = opts.sessionSecrets;
  if (opts.idempotencyKey) payload.idempotency_key = opts.idempotencyKey;
  const r = await jsonRequest("POST", CFG.apiBase + "/sessions", authHeaders(auth), payload);
  if (r.status === 200 || r.status === 201) {
    const j = r.json || {};
    return { ok: true, devinId: j.devin_id || j.session_id || j.id, isNewSession: j.is_new_session, createdAt: j.created_at, raw: j };
  }
  return { ok: false, status: r.status, error: "createSession HTTP " + r.status + ": " + (r.text || "").slice(0, 160) };
}

// 向已有对话追加一条用户消息 (继续对话 → 触发新事件/更新)。
// 端点经实测确证为官方公开 API: POST {v1Base}/session/{id}/message  {message}
//   - app.devin.ai/api 下所有形态 (/session|/sessions ·/message|/messages) 实测均 404, 即内部 API 无此 REST 路由。
//   - api.devin.ai/v1/sessions/{id}/messages 实测 404 (无此路由); /session/{id}/message 实测 403 (路由存在·凭证不符) → 端点正确。
//   - 鉴权: 公开 API 仅认 Devin API Key (apk_...); 会话登录态 auth1 / cog_ service-user 均被拒 (403)。
//     故 opts.apiKey || CFG.apiKey 缺省时不臆造成功, 直接回报需配置 API Key。
async function sendMessage(auth, devinId, message, opts) {
  opts = opts || {};
  const apiKey = opts.apiKey || CFG.apiKey || "";
  if (!apiKey) {
    return {
      ok: false,
      status: 0,
      error: "续写消息需配置 Devin API Key (apk_...); 会话登录态不被公开 API 接受。请在设置 devinCloudApiKey 或 opts.apiKey 后重试。",
    };
  }
  const r = await jsonRequest(
    "POST",
    CFG.v1Base + "/session/" + devinId + "/message",
    { Authorization: "Bearer " + apiKey, "Content-Type": "application/json", "User-Agent": CFG.ua },
    { message: String(message || "") },
  );
  return {
    ok: r.status >= 200 && r.status < 300,
    status: r.status,
    raw: r.json,
    text: (r.text || "").slice(0, 200),
    error: r.status >= 200 && r.status < 300 ? undefined : "sendMessage HTTP " + r.status + ": " + (r.text || "").slice(0, 160),
  };
}

// 事件流 (SSE/ndjson/json 混合) → 去重排序后的事件数组
// 详版: 返回 { events, ok, reason, status }。
//   ok=false 仅当「流 3 试 + first-load 兜底」皆未取得 200 → 硬拉取失败 (区别于"真空对话": 真空对话 first-load 返 200 空数组 → ok=true)。
//   破坏性清理据此判定: ok=false 的备份不可信, 不得据此删原对话 (否则瞬时 403/5xx/限速 → 空备份 → 误删真数据)。
async function fetchEventStreamDetailed(auth, devinId) {
  // /events/<id>/{stream,first-load} 要求 devin- 前缀 (无前缀 → 403 → 0 事件 → 空 MD)。
  // 归一: 内部强制补前缀, 兼容 resolveConvMd 等剥前缀的调用方与已带前缀的调用方。
  const _eid = "devin-" + String(devinId || "").replace(/^devin-/, "");
  const url = CFG.apiBase + "/events/" + _eid + "/stream";
  let resp;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await rawRequest(
        "GET",
        url,
        authHeaders(auth, { Accept: "text/event-stream" }),
        null,
        CFG.streamTimeoutMs,
      );
      if (r.status === 200) {
        resp = r.buf.toString("utf8");
        break;
      }
    } catch {}
    if (attempt < 2) await new Promise((r) => setTimeout(r, (CFG.streamRetryDelayMs || 1500) * (attempt + 1)));
  }
  if (resp == null) {
    // first-load 兜底
    const r = await jsonRequest("GET", CFG.apiBase + "/events/first-load/" + _eid, authHeaders(auth));
    if (r.status !== 200) return { events: [], ok: false, reason: "fetch-failed", status: r.status || 0 };
    return { events: asArray(r.json, "result", "events"), ok: true, reason: "first-load", status: 200 };
  }
  const merged = new Map();
  const add = (ev) => {
    if (!ev || !ev.type) return;
    const eid = ev.event_id || ev.type + "-" + ev.timestamp + "-" + ev.created_at_ms;
    if (!merged.has(eid)) merged.set(eid, ev);
  };
  const raw = resp;
  let i = 0;
  while (i < raw.length) {
    while (i < raw.length && " \r\n\t".includes(raw[i])) i++;
    if (i >= raw.length) break;
    if (raw[i] === "{") {
      let depth = 0, j = i, inStr = false, esc = false;
      for (; j < raw.length; j++) {
        const ch = raw[j];
        if (esc) { esc = false; continue; }
        if (ch === "\\" && inStr) { esc = true; continue; }
        if (ch === '"') { inStr = !inStr; continue; }
        if (inStr) continue;
        if (ch === "{") depth++;
        if (ch === "}") { depth--; if (depth === 0) { j++; break; } }
      }
      try {
        const obj = JSON.parse(raw.slice(i, j));
        if (obj.result && Array.isArray(obj.result)) obj.result.forEach(add);
        else add(obj);
      } catch {}
      i = j;
    } else {
      const lineEnd = raw.indexOf("\n", i);
      const end = lineEnd === -1 ? raw.length : lineEnd;
      const line = raw.slice(i, end).trim();
      i = end + 1;
      if (line.startsWith("data:")) {
        const ds = line.slice(5).trim();
        if (ds && ds !== "[DONE]") {
          try {
            const obj = JSON.parse(ds);
            if (obj.result && Array.isArray(obj.result)) obj.result.forEach(add);
            else add(obj);
          } catch {}
        }
      }
    }
  }
  const events = Array.from(merged.values());
  events.sort((a, b) => (a.created_at_ms || 0) - (b.created_at_ms || 0));
  return { events, ok: true, reason: "stream", status: 200 };
}
// 事件流 (SSE/ndjson/json 混合) → 去重排序后的事件数组。
//   薄壳: 保持旧签名 (恒返数组·非 200 返空·仅网络彻底失败时同旧版上抛), 现有导出/拖会话调用方零改动。
async function getEventStream(auth, devinId) {
  return (await fetchEventStreamDetailed(auth, devinId)).events;
}

async function listKnowledge(auth) {
  const r = await jsonRequest("GET", CFG.apiBase + "/org-" + auth.orgBare + "/learning/all", authHeaders(auth));
  return r.status === 200 ? { ok: true, learnings: asArray(r.json, "learnings") } : { ok: false, learnings: [] };
}
async function listPlaybooks(auth) {
  const r = await jsonRequest("GET", CFG.apiBase + "/org-" + auth.orgBare + "/playbooks", authHeaders(auth));
  return r.status === 200 ? { ok: true, playbooks: asArray(r.json, "playbooks") } : { ok: false, playbooks: [] };
}
async function listSecrets(auth) {
  const r = await jsonRequest("GET", CFG.apiBase + "/org-" + auth.orgBare + "/secrets", authHeaders(auth));
  return r.status === 200 ? { ok: true, secrets: asArray(r.json, "secrets") } : { ok: false, secrets: [] };
}
async function getGitConnections(auth) {
  const r = await jsonRequest("GET", CFG.apiBase + "/organizations/" + auth.orgId + "/git-connections-metadata", authHeaders(auth));
  if (r.status !== 200) return { ok: false, connections: [] };
  const conns = Array.isArray(r.json) ? r.json : asArray(r.json, "connections");
  return { ok: true, connections: conns };
}
// 额度: app.devin.ai/api/{orgId}/billing/status → {overage_credits, billing_error}
async function getBilling(auth) {
  const r = await jsonRequest("GET", CFG.apiBase + "/" + auth.orgId + "/billing/status", authHeaders(auth));
  if (r.status === 200 && r.json) return { ok: true, billing: r.json };
  return { ok: false, billing: null };
}
// v4.9.5 · 反向注入「每条消息额度上限」(Devin Cloud · Usage & limits · Message usage limit · max_credits)。
//   端点: POST /api/org-{bare}/billing/usage/limits  body {max_credits}。与 dao-vsix devinSetMessageLimit 同源同构。
//   对话额度上限(conv-cap)据此把 cap=余额-缓冲 实时写入账号, 让 Devin 自身按此限额花钱(随余额下降跟随)。
// 把对话上限(可为浮点·美元值)归一为服务端可接受的整数 max_credits。
//   服务端要求整数且 ≥1: 浮点→422(int_from_float), <1→400("must be at least 1")。
//   向下取整(不超「余额−缓冲」), 低于 1 视为无法设置 → 返回 null(调用方不发请求·守柔不制造 4xx)。
function messageLimitInt(maxCredits) {
  const n = Number(maxCredits);
  if (!Number.isFinite(n)) return null;
  const i = Math.floor(n);
  return i >= 1 ? i : null;
}
async function setMessageLimit(auth, maxCredits) {
  const intMc = messageLimitInt(maxCredits);
  if (intMc === null) return { ok: false, status: 0, belowMin: true };
  const r = await jsonRequest("POST", CFG.apiBase + "/org-" + auth.orgBare + "/billing/usage/limits", authHeaders(auth), { max_credits: intMc });
  return { ok: r.status === 200 || r.status === 201 || r.status === 204, status: r.status, sent: intMc };
}
// v4.9.5 · 读取当前「每条消息额度上限」 — 用于幂等比对(只在变化时回写, 不制造无谓请求)。
async function getMessageLimit(auth) {
  const r = await jsonRequest("GET", CFG.apiBase + "/org-" + auth.orgBare + "/billing/usage/limits", authHeaders(auth));
  if (r.status === 200 && r.json) {
    const j = r.json;
    // 服务端读端字段为 max_acu_limit (写端为 max_credits·同一值); 兼容历史/嵌套字段。
    //   旧版只认 max_credits → 恒读 null → 幂等失效·每轮空写(本即 status=422 刷屏之一因)。
    const v = (typeof j.max_acu_limit === "number") ? j.max_acu_limit
      : (typeof j.max_credits === "number") ? j.max_credits
      : (j.limits && typeof j.limits.max_credits === "number") ? j.limits.max_credits : null;
    return { ok: true, maxCredits: v };
  }
  return { ok: false, maxCredits: null };
}

// 从 billing 提取「可用余额(美元)」 · 返回 null = 无法判定(调用方禁止据此做破坏性自动清理)
// 实测 Devin billing/status 字段: available_credits / overage_credits(可负=已欠) /
//   has_subscription_or_credits(布尔权威) / is_subscription_valid。
// 旧 v4.4.0 读 prompt_credits/flow_credits(后端根本不返回)→ 健康号被误判 $0 → 误触发 wipe。
function billingBalance(billing) {
  if (!billing) return null;
  const b = billing.billing || billing;
  const num = (...keys) => {
    for (const k of keys) {
      const v = b[k];
      if (typeof v === "number" && isFinite(v)) return v;
    }
    return null;
  };
  const avail = num("available_credits", "availableCredits");
  const overage = num("overage_credits", "overageCredits");
  const dollars = (avail || 0) + Math.max(0, overage || 0);
  // 权威布尔: 明确有订阅/有额度 → 视为充足, 绝不当作低额触发清理
  if (b.has_subscription_or_credits === true || b.is_subscription_valid === true) {
    return dollars > 0 ? dollars : 9999;
  }
  // 明确无订阅且无额度 → 返回真实余额(通常 0)
  if (b.has_subscription_or_credits === false) return dollars;
  // 字段不全/未知 → 仅当能拿到任一额度数值时才给值, 否则 null(安全)
  if (avail !== null || overage !== null) return dollars;
  return null;
}

// 账号本源概览 (下拉框用): 对话(着重) + 知识库/剧本/密钥/Git/额度 简要
async function accountOverview(auth) {
  // 大成若缺: 任一子端点瞬态失败不应毁整份概览。allSettled 逐个降级,
  // rejected 项返回空结果(同各 list 的 ok:false 形态), 只要有一个成功即有概览。
  const settled = await Promise.allSettled([
    listSessions(auth),
    listKnowledge(auth),
    listPlaybooks(auth),
    listSecrets(auth),
    getGitConnections(auth),
    getBilling(auth),
  ]);
  const v = (i, fallback) => (settled[i].status === "fulfilled" ? settled[i].value : fallback);
  const sessions = v(0, { sessions: [] });
  const knowledge = v(1, { learnings: [] });
  const playbooks = v(2, { playbooks: [] });
  const secrets = v(3, { secrets: [] });
  const git = v(4, { connections: [] });
  const billing = v(5, { billing: null });
  const ss = sessions.sessions || [];
  return {
    email: auth.email,
    orgId: auth.orgId,
    sessions: ss.map((s) => ({
      devinId: s.devin_id || s.session_id || s.id,
      title: s.title || s.name || "(未命名)",
      status: s.status || s.activity_status || "",
      statusClass: classifySession(s),
      createdAt: s.created_at,
      updatedAt: s.updated_at,
      tags: s.tags || [],
    })),
    counts: {
      sessions: ss.length,
      running: ss.filter((s) => classifySession(s) === "running").length,
      awaiting: ss.filter((s) => classifySession(s) === "awaiting").length,
      blocked: ss.filter((s) => classifySession(s) === "blocked").length,
      knowledge: (knowledge.learnings || []).length,
      playbooks: (playbooks.playbooks || []).length,
      secrets: (secrets.secrets || []).length,
      gitConnections: (git.connections || []).length,
    },
    knowledge: (knowledge.learnings || []).map((k) => ({ id: k.id, name: k.name || k.title || "", deletable: isUserKnowledge(k) })),
    playbooks: (playbooks.playbooks || []).map((p) => ({ id: p.id || p.playbook_id, name: p.name || p.title || "", deletable: isUserPlaybook(p, auth) })),
    secrets: (secrets.secrets || []).map((s) => ({ id: s.id || s.secret_id, name: s.name || s.key || "", deletable: true })),
    gitConnections: (git.connections || []).map((c) => ({
      id: c.id || c.connection_id,
      name: c.name || c.username || c.account_login || c.org || "",
      provider: c.provider || c.type || "github",
    })),
    billing: billing.billing || null,
  };
}

// ═══ 会话状态分类 (对话追踪用) ════════════════════════════════════════════
// v4.6.0 · 五态细分 (问题①: 中途卡住的任何情况都要前端可见):
//   running:  正常运行中 (streaming/working/coding/planning)
//   awaiting: 中途停顿·需用户输入/回答问题
//   blocked:  额度耗尽/出错/卡死 (out_of_quota/usage_limit_exceeded/error)
//   finished: 已完成/已挂起 · idle: 空闲/其它
//
// 实测要点 (对真实 469 会话取证·不臆造): 权威实时状态在 `latest_status_contents`:
//   { enum:"finished"|..., reason:"user_inactivity"|"out_of_quota"|"usage_limit_exceeded"|"error"|"user_request",
//     user_action_required: null|{...} }   —— 顶层 status 恒为粗粒度("suspended"), activity_status 为"最后动作"(coding/planning)·非实时。
//   ∴ 以 latest_status_contents 为主、字符串启发为辅。user_action_required 非空 = 真·等待用户输入(最高优先·即便已挂起)。
//   终态(enum=finished / status=suspended)归 finished, 不让历史额度耗尽会话反复刷屏前端 (无为·不扰民)。
function classifySession(s) {
  s = s || {};
  const lsc = s.latest_status_contents || {};
  const enumV = String(lsc.enum || "").toLowerCase();
  const reason = String(lsc.reason || "").toLowerCase();
  const uar = lsc.user_action_required;
  const status = String(s.status || "").toLowerCase();
  const act = String(s.activity_status || "").toLowerCase();
  const cur = String(s.current_activity || "").toLowerCase();

  // 1. 等待用户输入 — 权威信号 user_action_required 非空 → 最高优先 (即便会话已被挂起)
  if (uar != null && uar !== "" && uar !== false) return "awaiting";

  // 2. 终态: enum=finished 或顶层 suspended/expired/exited/archived → finished
  //    (历史 out_of_quota/error 已结束的会话不再算"活跃·卡住", 避免前端长期噪声)
  const terminal = enumV === "finished" || /finished|done|completed|suspended|expired|exited|archived|deleted/.test(status);
  if (terminal) return "finished";

  // 3. 进行中(非终态)的细分: 额度/错误 → blocked, 等待 → awaiting, 其余 → running
  const blob = enumV + " " + reason + " " + status + " " + act + " " + cur;
  if (/out_of_quota|usage_limit|insufficient|overage|credit|billing|exceeded|quota/.test(blob)) return "blocked";
  if (/error|failed|stuck|crash/.test(blob)) return "blocked";
  if (/await|waiting_for_user|waiting_for_input|needs_input|user_input|ask_user|blocked_on_user/.test(blob)) return "awaiting";
  if (/blocked/.test(blob)) return "blocked";
  if (/running|working|in_progress|streaming|active|started|resumed|busy|thinking|executing|coding|planning|testing|pr\b/.test(blob)) return "running";
  // 非终态但状态未知 → 视作运行中(需关注·宁可显示也不漏)
  return enumV || status ? "running" : "idle";
}
// v4.6.0 · 是否"活跃·需关注"(运行/等待/卡住) — 对话未到真正结束的那一步
function isActiveClass(cls) { return cls === "running" || cls === "awaiting" || cls === "blocked"; }

// v4.6.0 · 返回所有"活跃·需关注"会话 (运行/等待输入/卡住), 各带 statusClass 供前端细分显示。
//   旧版只返回 running; 现纳入 awaiting/blocked, 让中途停顿/额度耗尽也能在前端实时反馈。
//   devinId 广谱提取: 不同租户/模式(企业·消费者·Ask)返回字段不一, 全部候选字段 + URL 兜底,
//   确保每条活跃对话都有 id → 追踪面板每行的 勾选/IDE内多实例/浏览器多实例/取消追踪 全部可用。
function _extractDevinId(s) {
  const direct = s.devin_id || s.session_id || s.id || s.devinId || s.sessionId || s.uuid || s.conversation_id || s.conversationId || s.query_id;
  if (direct) return String(direct);
  for (const k of ["url", "session_url", "web_url", "link"]) {
    const m = String(s[k] || "").match(/\/sessions\/([A-Za-z0-9-]+)/);
    if (m) return "devin-" + m[1].replace(/^devin-/, "");
  }
  return "";
}
async function listRunningSessions(auth) {
  const r = await listSessions(auth, 100);
  const active = (r.sessions || [])
    .map((s) => {
      const lsc = s.latest_status_contents || {};
      return {
        devinId: _extractDevinId(s),
        title: s.title || s.name || "(未命名)",
        status: (lsc.enum || s.status || s.activity_status || "") + (lsc.reason ? "(" + lsc.reason + ")" : ""),
        reason: lsc.reason || "",
        statusClass: classifySession(s),
      };
    })
    .filter((s) => isActiveClass(s.statusClass));
  return active;
}

// v4.5.0 · 中停运行中对话 (对话额度上限触发 · 知止不殆 · 道法自然)
// v4.7.6 · 端点经实测确证: Devin Cloud 无 stop/pause/sleep/cancel/end REST 路由 (全部 404),
//   唯一可变更运行态的动作为 POST {apiBase}/sessions/{id}/archive (200 → status:running→suspended,
//   is_archived:true, 即时移出活跃列表)。故以 /archive 为首选端点真中停; 其余作回退保险。
//   命中 2xx 即真中停; 全部非 2xx 则如实回报 stopped:false + 各端点状态 (不臆造成功)。
// 调用方据 stopped 真值决定后续 (绝不据未验证的"假成功"误导用户)。
async function stopSession(auth, devinId) {
  const candidates = [
    CFG.apiBase + "/sessions/" + devinId + "/archive",
    CFG.apiBase + "/sessions/" + devinId + "/stop",
    CFG.apiBase + "/sessions/" + devinId + "/pause",
    CFG.apiBase + "/sessions/" + devinId + "/sleep",
    CFG.apiBase + "/sessions/" + devinId + "/cancel",
  ];
  const tried = [];
  for (const url of candidates) {
    try {
      const r = await jsonRequest("POST", url, authHeaders(auth), {});
      tried.push({ url, status: r.status });
      if (r.status >= 200 && r.status < 300) {
        return { ok: true, stopped: true, endpoint: url, status: r.status, tried };
      }
    } catch (e) {
      tried.push({ url, error: String((e && e.message) || e) });
    }
  }
  return { ok: false, stopped: false, tried, error: "无可用中停端点 (全部非 2xx)" };
}

// ═══ 删除接口全集 (水过无痕底层) ══════════════════════════════════════════
function okDelete(status) {
  return status === 200 || status === 202 || status === 204 || status === 404;
}
async function deleteKnowledge(auth, id) {
  const r = await jsonRequest("DELETE", CFG.apiBase + "/org-" + auth.orgBare + "/learning/" + id, authHeaders(auth));
  return { ok: okDelete(r.status), status: r.status };
}
async function deletePlaybook(auth, id) {
  // 实跑确证: 正确端点为 DELETE /api/playbooks/{id} (返 200·真删)。
  // 旧端点 /api/org-{bare}/playbooks/{id} 恒返 404, 被 okDelete 误判为"已删"→ 臆造成功。
  let r = await jsonRequest("DELETE", CFG.apiBase + "/playbooks/" + id, authHeaders(auth));
  if (r.status >= 200 && r.status < 300) return { ok: true, status: r.status };
  // 兜底: 旧 org 作用域端点 (唯变所适)
  const r2 = await jsonRequest("DELETE", CFG.apiBase + "/org-" + auth.orgBare + "/playbooks/" + id, authHeaders(auth));
  if (r2.status >= 200 && r2.status < 300) return { ok: true, status: r2.status };
  // 两端点均 404 视为"已不存在"(幂等)
  if (r.status === 404 && r2.status === 404) return { ok: true, status: 404 };
  return { ok: false, status: r.status };
}
async function deleteSecret(auth, idOrName) {
  let id = idOrName;
  if (!/^[a-z]+-/.test(String(idOrName))) {
    const list = await listSecrets(auth);
    const hit = (list.secrets || []).find((s) => s.name === idOrName || s.id === idOrName);
    if (!hit) return { ok: true, status: 404 };
    id = hit.id;
  }
  // 实跑确证: 正确端点为 DELETE /api/secrets/{id} (返 200·真删)。
  // 旧端点 /api/org-{bare}/secrets/{id} 恒返 404, 被 okDelete 误判为"已删"→ 臆造成功。
  let r = await jsonRequest("DELETE", CFG.apiBase + "/secrets/" + id, authHeaders(auth));
  if (r.status >= 200 && r.status < 300) return { ok: true, status: r.status };
  const r2 = await jsonRequest("DELETE", CFG.apiBase + "/org-" + auth.orgBare + "/secrets/" + id, authHeaders(auth));
  if (r2.status >= 200 && r2.status < 300) return { ok: true, status: r2.status };
  if (r.status === 404 && r2.status === 404) return { ok: true, status: 404 };
  return { ok: false, status: r.status };
}
// 某连接的仓库授权(git-permissions)列举/删除 —— 端点取自前端 useQuery bundle 实证。
async function listGitPermissions(auth, connectionId) {
  const r = await jsonRequest("GET", CFG.apiBase + "/" + auth.orgId + "/integrations/git-permissions?connection_id=" + encodeURIComponent(connectionId), authHeaders(auth));
  return r.status === 200 ? asArray(r.json, "data", "permissions") : [];
}
async function deleteGitPermission(auth, permId) {
  const r = await jsonRequest("DELETE", CFG.apiBase + "/" + auth.orgId + "/integrations/git-permissions/" + permId, authHeaders(auth));
  return { ok: r.status >= 200 && r.status < 300, status: r.status };
}
// 实跑确证(前端 bundle 逐函数审 + 真号 lhfsrb 验证): Devin 无"按 id 删 git 连接"端点。
//   旧码三个 /git-connections/{id} 形态恒 404/405 → 实为臆造(根本啥也没删, 却记成功)。
//   真实可用端点(取自前端 useQuery-*.js):
//     · 列仓库授权: GET    /{orgId}/integrations/git-permissions?connection_id={cid}
//     · 删仓库授权: DELETE /{orgId}/integrations/git-permissions/{permId}  (返 {success:true}·真删)
//     · OAuth 断开: DELETE /integrations/github/user · /integrations/gitlab/user
//   但连接"元数据记录"本身平台不提供删除端点(PAT 与 github_app 均复查仍在)。
//   故能做且该做的: 真删其全部仓库授权(实移除访问权), 复查连接元数据是否消失:
//     消失→真断开(removed); 残留(PAT 典型)→如实回报已清授权数, 不臆造成功。
async function disconnectGit(auth, conn) {
  const cid = (conn && (conn.id || conn.connection_id)) || conn;
  const type = String((conn && (conn.type || conn.provider)) || "").toLowerCase();
  const host = String((conn && conn.host) || "").toLowerCase();
  // 1) 清空该连接全部仓库授权 (真实移除访问权)
  let permsRemoved = 0;
  try {
    const perms = await listGitPermissions(auth, cid);
    for (const p of perms) {
      const pid = p.git_permission_id || p.id;
      if (!pid) continue;
      if ((await deleteGitPermission(auth, pid)).ok) permsRemoved++;
    }
  } catch (_) { /* 授权列举失败不阻断后续 */ }
  // 2) provider 级断开 (OAuth 类真断开; PAT 类幂等无害)
  let provStatus = 0;
  const provUrl = (type.indexOf("gitlab") >= 0 || host.indexOf("gitlab") >= 0)
    ? CFG.apiBase + "/integrations/gitlab/user"
    : CFG.apiBase + "/integrations/github/user";
  try { provStatus = (await jsonRequest("DELETE", provUrl, authHeaders(auth))).status; } catch (_) {}
  // 3) 复查连接元数据是否真消失 (不臆造)
  let gone = false;
  try {
    const after = (await getGitConnections(auth)).connections || [];
    gone = !after.some((c2) => (c2.id || c2.connection_id) === cid);
  } catch (_) {}
  if (gone) return { ok: true, status: 200, removed: true, permissionsRemoved: permsRemoved };
  return {
    ok: false,
    status: provStatus || 0,
    removed: false,
    permissionsRemoved: permsRemoved,
    note: "连接(" + (type || "unknown") + ")元数据平台未开放删除端点; 已清除其仓库授权 " + permsRemoved + " 条(访问权已撤)" + (type.indexOf("individual_token") >= 0 ? "; PAT 本体须在 GitHub 端撤销" : ""),
  };
}
// v4.9.11 · 清理会话: 从仪表盘移除(archive → is_archived=true, 默认视图隐藏)。
//   实跑确证: DELETE /api/sessions/{id} → 405; v3 DELETE 为 "Terminate" 非硬删。
//   平台无硬删 API; archive 是最强清除(对话从活跃列表消失)。
//   v3 DELETE + archive=true 作兜底 (未来若开放硬删 → 自动命中)。
async function deleteSession(auth, devinId) {
  // 优先: archive (可靠, 从仪表盘移除)
  const r = await jsonRequest("POST", CFG.apiBase + "/sessions/" + devinId + "/archive", authHeaders(auth), {});
  if (r.status >= 200 && r.status < 300) return { ok: true, status: r.status, cleaned: true };
  // 兜底: v3 terminate+archive / 旧硬删除端点 (平台若日后开放则命中)
  const candidates = [
    { method: "DELETE", url: CFG.v1Base.replace("/v1", "/v3") + "/organizations/" + auth.orgId + "/sessions/" + devinId + "?archive=true" },
    { method: "DELETE", url: CFG.apiBase + "/v3/organizations/" + auth.orgId + "/sessions/" + devinId },
    { method: "DELETE", url: CFG.apiBase + "/sessions/" + devinId },
    { method: "DELETE", url: CFG.apiBase + "/org-" + auth.orgBare + "/sessions/" + devinId },
  ];
  let last = r.status;
  for (const c of candidates) {
    try {
      const d = await jsonRequest(c.method, c.url, authHeaders(auth));
      last = d.status;
      if (d.status >= 200 && d.status < 300) return { ok: true, status: d.status, cleaned: true };
    } catch {}
  }
  return { ok: false, status: last };
}

// 区分"用户自有数据" vs "Devin 本源默认"(社区剧本 / 内置知识)。
// 实跑确证: 新账号本源自带 3 条 builtin 知识(note_type=builtin·can_write=false·删返 403)
//   + 32 个 community 剧本(access=community·org_id=Cognition clerk-org·删返 404)。
// 这些本源默认删不掉, 也不该删 —— "回归本源"即保留它们。只清用户自建数据。
function isUserKnowledge(k) {
  return !!k && k.note_type !== "builtin" && k.is_default_note !== true && k.can_write !== false;
}
// v4.7.3 · 纯函数(可单测): 由余额/缓冲/抽干开关/地板 算每对话使用额度上限 + 是否抽干模式。
//   常态: cap = balance - buffer (留缓冲·随余额实时下调)。
//   反向重置·将欲予之必故予之: 余额抵缓冲(cap≤0)且尚未见底(>floor) → cap 反抬回剩余余额(=balance),
//   不困住这最后一笔钱, 让美金真正用尽; 仅当余额≤floor(真见底)才回 cap=0(交由调用方中停)。
function computeConvCap(balance, buffer, drainOn, floor) {
  const b = Number(balance);
  if (!Number.isFinite(b)) return { cap: 0, drain: false };
  const buf = Math.max(0, Number(buffer) || 0);
  const flr = Math.max(0, Number(floor) || 0);
  let cap = +(b - buf).toFixed(2);
  let drain = false;
  if (drainOn && cap <= 0 && b > flr) { cap = +b.toFixed(2); drain = true; }
  return { cap: Math.max(0, cap), drain };
}
// v4.7.5 · 低余额预警纯函数(可单测): 由实时余额/阈值/上轮是否已警 算本轮是否发警 + 新的已警态。
//   余额 ≤ 阈值 且 上轮未警 → 本轮发警(只发一次·不刷屏); 余额回升至阈值之上 → 复位已警态(下次跌破再警)。
//   余额无法判定(null/NaN) → 不发警·保持上轮态(安全·不臆断·不误扰)。
//   知止不殆: 一次跌破只提醒一次, 回升后才允许再次提醒。
function lowBalanceVerdict(balance, threshold, prevAlerted) {
  const b = Number(balance);
  const t = Math.max(0, Number(threshold) || 0);
  if (!Number.isFinite(b)) return { alert: false, alerted: !!prevAlerted };
  if (b <= t) return { alert: !prevAlerted, alerted: true };
  return { alert: false, alerted: false };
}

// v4.7.5 · 会话进展签名(可单测): 取「会进展时会变」的状态字段拼成指纹。
//   两轮指纹相同 = 这段时间该会话状态无任何推进 → 卡死监测据此计时。
//   只取状态/原因(非标题), 避免自动命名等无关变更误判为"有进展"。
function sessionSignature(sess) {
  const s = sess || {};
  return [s.statusClass || "", s.status || "", s.reason || ""].join("|");
}

// v4.7.5 · 卡死判定纯函数(可单测): 运行中会话指纹「持续不变」超过 stallMs → 疑似卡死/长时间无进展。
//   stallMs ≤ 0 视为关闭(永不判卡); 仅以「无进展时长」为准, 不臆断真因(保守·只如实surface疑点)。
function stallVerdict(unchangedMs, stallMs) {
  const u = Number(unchangedMs);
  const s = Number(stallMs);
  if (!Number.isFinite(u) || !Number.isFinite(s) || s <= 0) return false;
  return u >= s;
}

// v4.7.7 · 对话最终报告纯函数(可单测): 对话结束时生成结构化终报(outcome/duration/cost/stall)。
//   道法自然·善始且善成: 对话有始有终, 终报如实记载——不臆造、不美化、缺数据则 null。
//   outcome: "success" | "stalled" | "blocked" | "cap_exceeded" | "archived" | "unknown"
//   按 statusClass/reason 实证分类; 无法判定(空输入)→ "unknown"。
function conversationFinalReport(sess, opts) {
  opts = opts || {};
  const s = sess || {};
  const now = opts.now || Date.now();

  // outcome 分类 (反者道之动·以实证分, 不臆断)
  let outcome = "unknown";
  const sc = (s.statusClass || "").toLowerCase();
  const reason = (s.reason || "").toLowerCase();
  if (sc === "finished" || sc === "completed" || sc === "suspended") {
    outcome = sc === "suspended" ? "archived" : "success";
  } else if (sc === "blocked") {
    outcome = reason.includes("usage") || reason.includes("limit") || reason.includes("cap") ? "cap_exceeded" : "blocked";
  } else if (sc === "stalled" || (sc === "running" && opts.stalled)) {
    outcome = "stalled";
  }

  // duration (毫秒): 取 createdAt → now 时间差; 缺 createdAt 则 null
  let durationMs = null;
  if (s.createdAt || s.created_at) {
    const t0 = new Date(s.createdAt || s.created_at).getTime();
    if (Number.isFinite(t0)) durationMs = Math.max(0, now - t0);
  }

  // cost: 取 opts.cost 或 session 内嵌的 total_cost / usage_credits (实测 Devin 会话有此字段)
  let cost = null;
  if (typeof opts.cost === "number" && isFinite(opts.cost)) cost = opts.cost;
  else if (typeof s.total_cost === "number" && isFinite(s.total_cost)) cost = s.total_cost;
  else if (typeof s.usage_credits === "number" && isFinite(s.usage_credits)) cost = s.usage_credits;

  return {
    devinId: s.devinId || s.devin_id || s.id || null,
    title: s.title || null,
    outcome,
    durationMs,
    durationMin: durationMs !== null ? Math.round(durationMs / 60000) : null,
    cost,
    statusClass: s.statusClass || null,
    reason: s.reason || null,
    stalled: !!opts.stalled,
    timestamp: now,
  };
}

// v4.7.7 · 综合健康度纯函数(可单测): 将余额/卡死/阻塞三维度压缩为单一健康分数 0-100。
//   道法自然·三盗既宜三才既安: 余额充足(≥阈值) + 无卡死 + 无阻塞 → 100(全安);
//   任一维度异常按权重扣分: balance 权 40, stall 权 30, blocked 权 30。
//   score ∈ [0,100] 整数; tier: "green" ≥ 80 | "amber" ≥ 50 | "red" < 50。
function healthScore(inputs) {
  const i = inputs || {};
  let score = 100;

  // 余额维度 (权重 40): 余额/阈值 比值越低扣分越多
  const bal = Number(i.balance);
  const thr = Math.max(0, Number(i.balanceThreshold) || 0);
  if (Number.isFinite(bal) && thr > 0) {
    const ratio = Math.max(0, Math.min(1, bal / (thr * 3))); // 3倍阈值 = 满分基准
    score -= Math.round((1 - ratio) * 40);
  }

  // 卡死维度 (权重 30): 有卡死对话即扣分, 多个累加(但封顶 30)
  const stalled = Math.max(0, +(i.stalledCount) || 0);
  if (stalled > 0) {
    score -= Math.min(30, stalled * 15); // 每个卡死扣 15, 最多扣满 30
  }

  // 阻塞维度 (权重 30): 有阻塞对话即扣分
  const blocked = Math.max(0, +(i.blockedCount) || 0);
  if (blocked > 0) {
    score -= Math.min(30, blocked * 15);
  }

  score = Math.max(0, Math.min(100, score));
  const tier = score >= 80 ? "green" : (score >= 50 ? "amber" : "red");
  return { score, tier };
}

function isUserPlaybook(p, auth) {
  if (!p) return false;
  if (p.access === "community") return false; // Cognition 社区共享剧本
  if (p.org_id && auth && auth.orgId && p.org_id !== auth.orgId) return false; // 非本组织
  return true;
}

// 水过无痕: 删除某账号在 Devin Cloud 的全部"用户自建"使用痕迹 → 回到本源(默认)态。
// dryRun=true 只统计不删除 (先把所有东西找出来) · onProgress(msg) 实时回报。
// found 仅计可删的用户数据; 本源默认(社区剧本/内置知识)记入 native.* 不删不臆造。
async function wipeAccount(auth, opts) {
  opts = opts || {};
  const dry = !!opts.dryRun;
  const prog = typeof opts.onProgress === "function" ? opts.onProgress : () => {};
  const report = {
    email: auth.email,
    dryRun: dry,
    sessions: { found: 0, deleted: 0, cleaned: 0, failed: 0 },
    knowledge: { found: 0, deleted: 0, failed: 0 },
    playbooks: { found: 0, deleted: 0, failed: 0 },
    secrets: { found: 0, deleted: 0, failed: 0 },
    gitConnections: { found: 0, deleted: 0, failed: 0, permissionsRemoved: 0 },
    native: { knowledge: 0, playbooks: 0 }, // 本源默认(保留·不删)
    errors: [],
  };

  prog("扫描账号痕迹...");
  const [sess, kn, pb, sec, git] = await Promise.all([
    listSessions(auth, 1000),
    listKnowledge(auth),
    listPlaybooks(auth),
    listSecrets(auth),
    getGitConnections(auth),
  ]);
  const sessions = sess.sessions || [];
  const allLearnings = kn.learnings || [];
  const allPlaybooks = pb.playbooks || [];
  const secrets = sec.secrets || [];
  const conns = git.connections || [];
  // 仅清用户自建; 本源默认单独计数保留
  const learnings = allLearnings.filter(isUserKnowledge);
  const playbooks = allPlaybooks.filter((p) => isUserPlaybook(p, auth));
  report.native.knowledge = allLearnings.length - learnings.length;
  report.native.playbooks = allPlaybooks.length - playbooks.length;
  report.sessions.found = sessions.length;
  report.knowledge.found = learnings.length;
  report.playbooks.found = playbooks.length;
  report.secrets.found = secrets.length;
  report.gitConnections.found = conns.length;

  if (dry) {
    prog(
      "扫描完成(可清理): 对话" + sessions.length + " 知识库" + learnings.length +
      " 剧本" + playbooks.length + " 密钥" + secrets.length + " Git" + conns.length +
      " · 本源默认保留: 知识" + report.native.knowledge + " 剧本" + report.native.playbooks,
    );
    return report;
  }

  // 删除顺序: git连接 → 密钥 → 剧本 → 知识库 → 对话 (先外围后核心)
  for (const c of conns) {
    const id = c.id || c.connection_id;
    if (!id) { report.gitConnections.failed++; continue; }
    const r = await disconnectGit(auth, c);
    report.gitConnections.permissionsRemoved += r.permissionsRemoved || 0;
    if (r.ok) report.gitConnections.deleted++;
    else { report.gitConnections.failed++; report.errors.push("git:" + id + ":" + (r.note || r.status)); }
    prog("断开 Git 连接 " + report.gitConnections.deleted + "/" + conns.length + (r.permissionsRemoved ? "(清授权" + r.permissionsRemoved + ")" : ""));
  }
  for (const s of secrets) {
    const r = await deleteSecret(auth, s.id || s.name);
    r.ok ? report.secrets.deleted++ : (report.secrets.failed++, report.errors.push("secret:" + (s.name || s.id) + ":" + r.status));
    prog("删除密钥 " + report.secrets.deleted + "/" + secrets.length);
  }
  for (const p of playbooks) {
    if (!p.id) { report.playbooks.failed++; continue; }
    const r = await deletePlaybook(auth, p.id);
    r.ok ? report.playbooks.deleted++ : (report.playbooks.failed++, report.errors.push("playbook:" + p.id + ":" + r.status));
    prog("删除剧本 " + report.playbooks.deleted + "/" + playbooks.length);
  }
  for (const k of learnings) {
    if (!k.id) { report.knowledge.failed++; continue; }
    const r = await deleteKnowledge(auth, String(k.id));
    r.ok ? report.knowledge.deleted++ : (report.knowledge.failed++, report.errors.push("knowledge:" + k.id + ":" + r.status));
    prog("删除知识库 " + report.knowledge.deleted + "/" + learnings.length);
  }
  for (const s of sessions) {
    const id = s.devin_id || s.session_id || s.id;
    if (!id) { report.sessions.failed++; continue; }
    const r = await deleteSession(auth, id);
    if (r.ok) { report.sessions.deleted++; if (r.cleaned) report.sessions.cleaned++; }
    else { report.sessions.failed++; report.errors.push("session:" + id + ":" + r.status); }
    prog("清理对话 " + report.sessions.deleted + "/" + sessions.length);
  }
  prog("水过无痕完成");
  return report;
}

// ═══ 并发池 ════════════════════════════════════════════════════════════════
async function runPool(items, concurrency, worker) {
  let next = 0;
  const lanes = Array.from({ length: Math.min(concurrency, items.length) || 0 }, async () => {
    while (next < items.length) {
      const i = next++;
      await worker(items[i], i);
    }
  });
  await Promise.all(lanes);
}

// ═══ 事件 → 文档 (人看的 MD + Agent 看的 JSON) ════════════════════════════
function extractMessageText(v) {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map(extractMessageText).filter(Boolean).join("\n");
  if (typeof v === "object") {
    if (typeof v.text === "string") return v.text;
    if (typeof v.message === "string") return v.message;
    if (v.content != null) return extractMessageText(v.content);
    return JSON.stringify(v, null, 2);
  }
  return String(v);
}
function evTs(ev) {
  const ms = ev.created_at_ms || (ev.timestamp ? Date.parse(ev.timestamp) : 0);
  return ms ? new Date(ms).toISOString() : "";
}
function userAnswerText(ev) {
  const answers = ev.answers || [];
  return answers
    .map((a) => {
      if (!a) return "";
      if (a.other_text) return a.other_text;
      if (Array.isArray(a.selected)) return a.selected.join("; ");
      if (typeof a.text === "string") return a.text;
      return "";
    })
    .filter(Boolean)
    .join("\n");
}
// 事件归类 (HTML/MD 共用): 把 Devin Cloud 真实事件流映射到四类气泡
// 实测事件名 (非臆造): 用户 initial_user_message/user_message/user_question_answered ·
// Devin devin_message · 思考 devin_thoughts/one_line_thoughts ·
// 工具 shell_process_started/multi_edit_result/computer_use/mcp_tool_call/
//      search_file_commands/web_search/web_get_contents/todo_update。
// 返回 { kind:"user"|"devin"|"think"|"tool", role, text?, detail? } 或 null(噪声事件跳过)。
function classifyEvent(ev) {
  if (!ev || typeof ev !== "object") return null;
  const t = ev.type;
  switch (t) {
    case "initial_user_message":
    case "user_message":
      return { kind: "user", role: "用户", text: extractMessageText(ev.message).replace(/^User:\s*/, "") };
    case "user_question_answered": {
      const txt = userAnswerText(ev);
      return txt ? { kind: "user", role: "用户(回答)", text: txt } : null;
    }
    case "devin_message":
      return { kind: "devin", role: "Devin", text: extractMessageText(ev.message) };
    case "devin_thoughts": {
      const txt = extractMessageText(ev.message);
      return txt ? { kind: "think", role: "思考", text: txt } : null;
    }
    case "one_line_thoughts": {
      const txt = ev.short || ev.summary || "";
      return txt ? { kind: "think", role: "思考", text: String(txt) } : null;
    }
    case "shell_process_started":
      return { kind: "tool", role: "🖥️ shell", detail: String(ev.command || "") };
    case "shell_process_completed":
    case "shell_process_completed_background": {
      const code = ev.exit_code == null ? "" : String(ev.exit_code);
      // 成功完成不单列(命令已在 started 显示); 仅非零退出码作为工具气泡留痕
      if (code && code !== "0") return { kind: "tool", role: "🖥️ shell · 退出码 " + code, detail: String(ev.output_trunc || "") };
      return null;
    }
    case "multi_edit_result": {
      const files = (ev.file_updates || []).map((f) => (f.action_type || "edit") + " " + (f.file_path || "")).join("\n");
      return { kind: "tool", role: "✏️ 文件编辑", detail: files };
    }
    case "computer_use": {
      const acts = (ev.actions || []).map((a) => a && a.action_type).filter(Boolean).join(", ");
      return { kind: "tool", role: "🖱️ 电脑操作", detail: acts };
    }
    case "mcp_tool_call": {
      let detail = String(ev.tool_input || "");
      if (ev.output_trunc) detail += (detail ? "\n→ " : "") + String(ev.output_trunc);
      return { kind: "tool", role: "🔌 " + (ev.tool_name || ev.server || "mcp"), detail };
    }
    case "search_file_commands": {
      const cmds = (ev.search_commands || []).map((c) => (c.command_name || "search") + ": " + (c.regex || c.query || "") + (c.path ? " @ " + c.path : "")).join("\n");
      return { kind: "tool", role: "🔍 文件搜索", detail: cmds };
    }
    case "web_search":
      return { kind: "tool", role: "🌐 网络搜索", detail: String(ev.query || "") + ((ev.result_urls || []).length ? "\n" + ev.result_urls.join("\n") : "") };
    case "web_get_contents":
      return { kind: "tool", role: "🌐 抓取网页", detail: (ev.urls || []).join("\n") };
    case "todo_update": {
      const todos = (ev.todos || []).map((td) => "- [" + (td.status === "completed" ? "x" : " ") + "] " + (td.content || "")).join("\n");
      return { kind: "tool", role: "📋 待办更新", detail: todos };
    }
    default:
      return null;
  }
}

// 对话转录 (人看的) — 四类气泡: 👤用户 / 🤖Devin / 💭思考 / 🔧工具
function buildConversationMd(title, devinId, events) {
  const lines = ["# 对话: " + title, "", "- Session: `" + devinId + "`", "- 事件数: " + events.length, ""];
  for (const ev of events) {
    const c = classifyEvent(ev);
    if (!c) continue;
    const ts = evTs(ev);
    if (c.kind === "user") lines.push("## 👤 " + c.role + "  " + ts, "", c.text || "", "");
    else if (c.kind === "devin") lines.push("## 🤖 Devin  " + ts, "", c.text || "", "");
    else if (c.kind === "think") lines.push("### 💭 思考  " + ts, "", "> " + String(c.text || "").replace(/\n/g, "\n> "), "");
    else if (c.kind === "tool") lines.push("### " + c.role + "  " + ts, "", c.detail ? "```\n" + String(c.detail).slice(0, 4000) + "\n```" : "", "");
  }
  return lines.join("\n");
}
// Agent 看的: 全事件 + 产出文件索引 (机器可读)
function buildAgentDoc(title, devinId, detail, events, fileIndex) {
  return JSON.stringify(
    {
      schema: "rt-flow.devin-cloud.conversation/1",
      title,
      devinId,
      sessionInfo: detail || {},
      eventCount: events.length,
      events,
      producedFiles: fileIndex || [],
      generatedAt: new Date().toISOString(),
    },
    null,
    2,
  );
}
function extractAllKeys(events) {
  const keys = new Set();
  (function walk(o) {
    if (!o || typeof o !== "object") return;
    if (Array.isArray(o)) return o.forEach(walk);
    for (const [k, v] of Object.entries(o)) {
      if (k === "contents_key" && typeof v === "string" && v) keys.add(v);
      else walk(v);
    }
  })(events);
  return Array.from(keys).sort();
}
function mapKeysToPaths(events) {
  const m = new Map();
  (function walk(o) {
    if (!o || typeof o !== "object") return;
    if (Array.isArray(o)) return o.forEach(walk);
    if (o.contents_key && o.file_path) m.set(o.contents_key, o.file_path);
    for (const v of Object.values(o)) walk(v);
  })(events);
  return m;
}
function safeName(s, maxLen) {
  maxLen = maxLen || 60;
  return String(s || "")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen) || "untitled";
}

// ═══ 备份目录命名 + 结构 (编号同步 WAM · 账号+密码表层 · 对话/账号信息分明) ═══
// 账号文件夹名 = <编号>_<邮箱本地名>_<密码>
//   · 编号: 与 WAM 面板 1:1 同步 (opts.accountNo) · 密码: 写在表层 (opts.password)
//   · 改号时由 resolveAccountDir 原地改名, 既保持同步又不丢已下内容。
function accountFolderName(auth, opts) {
  opts = opts || {};
  const emailLocal = String((auth && auth.email) || "").split("@")[0] || "account";
  const no = opts.accountNo ? String(opts.accountNo).padStart(2, "0") : "";
  const pwd = opts.password ? safeName(String(opts.password), 32).replace(/\s+/g, "") : "";
  const parts = [];
  if (no) parts.push(no);
  parts.push(safeName(emailLocal, 40));
  if (pwd) parts.push(pwd);
  return safeName(parts.join("_"), 100);
}
// 标题去掉开头的下划线/井号/标点/空白 → 文件夹不再"看起来像系统目录"(_summary_ 之类)
function cleanTitle(title) {
  return String(title == null ? "" : title).replace(/^[\s_#·.、，,\-]+/, "").trim() || "未命名";
}
// 对话文件夹名 = <编号>_<标题>_<ID末8位> (编号 3 位补零·与列表序一致)
function convFolderName(num, title, devinId) {
  const shortId = String(devinId || "").replace(/^devin-/, "").slice(0, 8);
  const n = num ? String(num).padStart(3, "0") + "_" : "";
  return safeName(n + cleanTitle(title), 70) + "_" + shortId;
}
// 在备份根下定位某账号已有目录: 优先读 .account.json 标记 (新)·回退纯邮箱名 (旧)。
function findAccountDir(root, email) {
  const key = String(email || "").toLowerCase();
  let entries = [];
  try { entries = fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()); } catch { return null; }
  for (const d of entries) {
    try {
      const mk = JSON.parse(fs.readFileSync(path.join(root, d.name, ".account.json"), "utf8"));
      if (mk && String(mk.email || "").toLowerCase() === key) return path.join(root, d.name);
    } catch {}
  }
  // 旧命名: 文件夹名 == 邮箱 (或 safeName(邮箱))
  const legacy = entries.find((d) => d.name.toLowerCase() === key || d.name.toLowerCase() === safeName(email, 80).toLowerCase());
  return legacy ? path.join(root, legacy.name) : null;
}
// 解析账号目录: 目标命名(含编号+密码) · 已有则原地改名迁移(不重下) · 写 .account.json 标记。
function resolveAccountDir(root, auth, opts) {
  opts = opts || {};
  const desired = path.join(root, accountFolderName(auth, opts));
  const existing = findAccountDir(root, auth && auth.email);
  if (existing && path.resolve(existing) !== path.resolve(desired)) {
    try { if (!fs.existsSync(desired)) fs.renameSync(existing, desired); } catch {}
  }
  ensureDir(desired);
  try {
    writeJson(path.join(desired, ".account.json"), {
      email: (auth && auth.email) || "", orgId: (auth && auth.orgId) || "",
      accountNo: opts.accountNo || 0, hasPassword: !!opts.password, updatedAt: new Date().toISOString(),
    });
  } catch {}
  return desired;
}

async function resolvePresignedUrls(auth, devinId, keys) {
  const result = new Map();
  const batches = [];
  for (let i = 0; i < keys.length; i += CFG.presignChunk) batches.push(keys.slice(i, i + CFG.presignChunk));
  const url = CFG.apiBase + "/presigned-url/batch/" + devinId;
  await runPool(batches, CFG.presignConcurrency, async (batch) => {
    const r = await jsonRequest("POST", url, authHeaders(auth), { s3_key_list: batch }, 30000);
    if (r.json) {
      const urls = r.json.urls_list || [];
      const hdrs = r.json.headers_list || [];
      for (let j = 0; j < batch.length; j++) if (urls[j]) result.set(batch[j], { url: urls[j], headers: hdrs[j] || {} });
    }
  });
  return result;
}
async function downloadFile(url, headers, agentOverride) {
  const r = await rawRequest("GET", url, headers || {}, null, CFG.downloadTimeoutMs, agentOverride);
  if (r.status < 200 || r.status >= 300) throw new Error("download HTTP " + r.status);
  return r.buf;
}

// 统一的「按 contents_key 批量下载产出文件」· 同时供增量/全量·lean/turbo 复用。
//   opts.turbo=true → 高并发 + 独立短命 turbo Agent (用完即毁); 否则走后台 lean 共享 Agent。
//   写入 cache: key->Buffer; 失败追进 fileIndex。
async function downloadKeysToCache(auth, devinId, allKeys, cache, fileIndex, opts) {
  opts = opts || {};
  if (!allKeys || !allKeys.length) return;
  const urlMap = await resolvePresignedUrls(auth, devinId, allKeys);
  const turbo = !!opts.turbo;
  const conc = turbo
    ? Math.max(1, (CFG.turboDownloadConcurrency | 0) || 24)
    : Math.max(1, (CFG.downloadConcurrency | 0) || 6);
  const agent = turbo ? _mkTurboAgent(https) : null;
  try {
    await runPool(allKeys, conc, async (key) => {
      const info = urlMap.get(key);
      if (!info) return;
      try {
        cache.set(key, await downloadFile(info.url, info.headers, agent));
      } catch (e) {
        fileIndex.push({ key, error: String(e && e.message ? e.message : e) });
      }
    });
  } finally {
    if (agent && agent.destroy) try { agent.destroy(); } catch {}
  }
}

// ═══ 备份 (Devin Cloud 目录结构 · 增量) ═══════════════════════════════════
// 结构: <root>/<账号名>/<devinId 末8位>_<对话名>.zip
//   zip 内: 对话_人类可读.md · 对话_agent.json · files/<产出文件>
// 增量: backup_state[devinId].eventCount 与本次事件数相同则跳过 (同源不重复)。
function backupStateKey(auth, devinId) {
  return auth.orgBare + ":" + devinId;
}
async function backupOneConversation(auth, sess, accountDir, opts) {
  opts = opts || {};
  const devinId = sess.devin_id || sess.devinId || sess.session_id || sess.id;
  const title = sess.title || sess.name || "未命名";
  // 守柔·宁可不删不可误删: 事件流硬拉取失败(非 200)即上抛 → 计入 failed → 备份校验不通过 → 不据空备份清理原对话。
  const _ev = await fetchEventStreamDetailed(auth, devinId);
  if (!_ev.ok) throw new Error("事件流拉取失败(status " + _ev.status + ") · 备份不可信, 拒绝据此清理: " + devinId);
  const events = _ev.events;

  // 增量判断
  const state = readJson(DC_BACKUP_STATE, {});
  const sk = backupStateKey(auth, devinId);
  if (opts.incremental !== false && state[sk] && state[sk].eventCount === events.length) {
    return { devinId, title, skipped: true, reason: "no-new-events", eventCount: events.length };
  }

  const detail = await getSessionDetail(auth, devinId);
  const zip = new ZipWriter();
  const fileIndex = [];

  // 产出文件: 取每个 contents_key 最终态
  const finalState = new Map();
  (function walk(o) {
    if (!o || typeof o !== "object") return;
    if (Array.isArray(o)) return o.forEach(walk);
    if (o.file_path && o.contents_key) finalState.set(o.file_path, o.contents_key);
    for (const v of Object.values(o)) walk(v);
  })(events);
  const changes = Array.from(finalState.entries()).map(([p, k]) => ({ path: p, key: k }));
  const allKeys = Array.from(new Set(changes.map((c) => c.key)));
  if (allKeys.length) {
    const cache = new Map();
    await downloadKeysToCache(auth, devinId, allKeys, cache, fileIndex, opts);
    for (const ch of changes) {
      const data = cache.get(ch.key);
      if (!data) continue;
      const rel = ch.path
        .replace(/^[A-Za-z]:[\\/]/, "")
        .replace(/^[\\/]+/, "")
        .replace(/\\/g, "/")
        .split("/")
        .map((p) => safeName(p, 60))
        .join("/");
      zip.addFile("files/" + rel, data);
      fileIndex.push({ path: ch.path, file: "files/" + rel, size: data.length });
    }
  }

  zip.addFile("对话_人类可读.md", buildConversationMd(title, devinId, events));
  zip.addFile("对话_agent.json", buildAgentDoc(title, devinId, detail, events, fileIndex));
  zip.addFile(
    "_meta.json",
    JSON.stringify(
      { devinId, title, account: auth.email, orgId: auth.orgId, eventCount: events.length, producedFiles: fileIndex.length, backedUpAt: new Date().toISOString() },
      null,
      2,
    ),
  );

  const shortId = String(devinId).replace(/^devin-/, "").slice(0, 8);
  const zipName = shortId + "_" + safeName(title, 50) + ".zip";
  ensureDir(accountDir);
  const zipPath = path.join(accountDir, zipName);
  fs.writeFileSync(zipPath, zip.toBuffer());

  state[sk] = { eventCount: events.length, backedUpAt: Date.now(), zip: zipName };
  writeJson(DC_BACKUP_STATE, state);
  return { devinId, title, skipped: false, eventCount: events.length, producedFiles: fileIndex.length, zip: zipPath };
}

// 多对话合并为单个 ZIP (每对话一子文件夹·含 files/正文md/agent.json) → outDir/合并_<n>对话_<ts>.zip
//   B 阶段·多选下载: 复用单对话备份的事件流/文件取证逻辑, 但所有对话汇入一个 ZipWriter, 一次落盘。
async function backupConversationsBundle(auth, sessList, outDir, opts) {
  opts = opts || {};
  const prog = typeof opts.onProgress === "function" ? opts.onProgress : () => {};
  const list = Array.isArray(sessList) ? sessList : [];
  ensureDir(outDir);
  const zip = new ZipWriter();
  const index = [];
  let done = 0;
  for (const sess of list) {
    const devinId = sess.devin_id || sess.devinId || sess.session_id || sess.id;
    const title = sess.title || sess.name || "未命名";
    prog("打包 " + (done + 1) + "/" + list.length + " · " + title.slice(0, 24));
    try {
      const events = await getEventStream(auth, devinId);
      const detail = await getSessionDetail(auth, devinId);
      const shortId = String(devinId).replace(/^devin-/, "").slice(0, 8);
      const sub = safeName(shortId + "_" + safeName(title, 50), 70) + "/";
      const fileIndex = [];
      const finalState = new Map();
      (function walk(o) {
        if (!o || typeof o !== "object") return;
        if (Array.isArray(o)) return o.forEach(walk);
        if (o.file_path && o.contents_key) finalState.set(o.file_path, o.contents_key);
        for (const v of Object.values(o)) walk(v);
      })(events);
      const changes = Array.from(finalState.entries()).map(([p, k]) => ({ path: p, key: k }));
      const allKeys = Array.from(new Set(changes.map((c) => c.key)));
      if (allKeys.length) {
        const cache = new Map();
        await downloadKeysToCache(auth, devinId, allKeys, cache, fileIndex, opts);
        for (const ch of changes) {
          const data = cache.get(ch.key);
          if (!data) continue;
          const rel = ch.path
            .replace(/^[A-Za-z]:[\\/]/, "")
            .replace(/^[\\/]+/, "")
            .replace(/\\/g, "/")
            .split("/")
            .map((p) => safeName(p, 60))
            .join("/");
          zip.addFile(sub + "files/" + rel, data);
          fileIndex.push({ path: ch.path, size: data.length });
        }
      }
      zip.addFile(sub + "对话_人类可读.md", buildConversationMd(title, devinId, events));
      zip.addFile(sub + "对话_agent.json", buildAgentDoc(title, devinId, detail, events, fileIndex));
      index.push({ devinId, title, files: fileIndex.length, eventCount: events.length });
      done++;
    } catch (e) {
      index.push({ devinId, title, error: String((e && e.message) || e) });
    }
  }
  zip.addFile(
    "_index.json",
    JSON.stringify({ account: auth.email, bundledAt: new Date().toISOString(), count: done, requested: list.length, conversations: index }, null, 2),
  );
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outName = "合并_" + done + "对话_" + ts + ".zip";
  const outPath = path.join(outDir, outName);
  fs.writeFileSync(outPath, zip.toBuffer());
  return { ok: true, outPath, count: done, total: list.length, index };
}

// 备份某账号全部对话 (增量) → <root>/<账号名>/
async function backupAccount(auth, opts) {
  opts = opts || {};
  const root = opts.targetDir || DC_BACKUP_DEFAULT;
  const prog = typeof opts.onProgress === "function" ? opts.onProgress : () => {};
  const accountDir = resolveAccountDir(root, auth, opts);
  const r = await listSessions(auth, 1000);
  const sessions = r.sessions || [];
  const result = { ok: true, account: auth.email, dir: accountDir, total: sessions.length, backedUp: 0, skipped: 0, failed: 0, items: [] };
  for (let i = 0; i < sessions.length; i++) {
    prog("备份 " + (i + 1) + "/" + sessions.length + " ...");
    try {
      const one = await backupOneConversation(auth, sessions[i], accountDir, opts);
      result.items.push(one);
      one.skipped ? result.skipped++ : result.backedUp++;
    } catch (e) {
      result.failed++;
      result.items.push({ error: String(e && e.message ? e.message : e) });
    }
  }
  prog("账号备份完成: 新备份" + result.backedUp + " 跳过" + result.skipped + " 失败" + result.failed);
  return result;
}

// ═══ 账号数据全量快照 (知识库/剧本/密钥/Git/额度/会话清单) ════════════════════
// 对话正文走 backupAccount 的 ZIP; 此处补齐"各方面的数据" —— 知识库正文、剧本正文、
// 密钥元数据(含加密值·不解密)、Git 连接、额度、会话清单 —— 全部留底本地。
// 供「水过无痕」前一键留底, 使账号可在清空后仍可回溯。
// 写入: <root>/<账号名>/_账号快照_<YYYYMMDDHHmmss>/
function _snapStamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
}
async function snapshotAccountData(auth, opts) {
  opts = opts || {};
  const root = opts.targetDir || DC_BACKUP_DEFAULT;
  const prog = typeof opts.onProgress === "function" ? opts.onProgress : () => {};
  const accountDir = resolveAccountDir(root, auth, opts);
  // 账号信息统一收纳于单一「账号信息」目录 (覆盖式·不再按时间戳堆叠 _账号快照_ 致目录乱)
  const snapDir = path.join(accountDir, "账号信息");
  try { if (fs.existsSync(snapDir)) fs.rmSync(snapDir, { recursive: true, force: true }); } catch {}
  ensureDir(snapDir);

  prog("快照: 拉取账号数据…");
  // 单条失败不毁全局: 每条带重试·失败如实记录, 有几条存几条 (allSettled 语义·不臆造)。
  // 旧码用 Promise.all → 任一端点瞬时失败(批量并发 429/抖动)即抛错, 整份快照丢失留下空目录。
  const snapErrors = [];
  const _settle = async (label, fn) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      try { return await fn(); }
      catch (e) {
        if (attempt === 2) { snapErrors.push(label + ": " + String((e && e.message) || e)); return null; }
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
    }
    return null;
  };
  const [kn, pb, sec, git, billing, sess] = await Promise.all([
    _settle("知识库", () => listKnowledge(auth)),
    _settle("剧本", () => listPlaybooks(auth)),
    _settle("密钥", () => listSecrets(auth)),
    _settle("Git连接", () => getGitConnections(auth)),
    _settle("额度", () => getBilling(auth)),
    _settle("会话清单", () => listSessions(auth, 1000)),
  ]);
  const learnings = (kn && kn.learnings) || [];
  const playbooks = (pb && pb.playbooks) || [];
  const secrets = (sec && sec.secrets) || [];
  const conns = (git && git.connections) || [];
  const sessions = (sess && sess.sessions) || [];
  const billingObj = (billing && billing.billing) || {};

  // 知识库: 每条一份正文 MD + 汇总 index (机器可读)
  if (learnings.length) {
    const knDir = path.join(snapDir, "知识库");
    ensureDir(knDir);
    learnings.forEach((k, i) => {
      const nm = safeName(k.name || k.title || "note", 60);
      const md = [
        "# " + (k.name || k.title || "(未命名)"),
        "",
        "- id: " + (k.id || ""),
        "- 触发: " + (k.trigger_description || ""),
        "- 类型: " + (k.note_type || ""),
        "- 创建: " + (k.created_at || ""),
        "",
        "---",
        "",
        String(k.body || ""),
      ].join("\n");
      try { fs.writeFileSync(path.join(knDir, (i + 1) + "_" + nm + ".md"), md); } catch {}
    });
  }
  writeJson(path.join(snapDir, "知识库_index.json"), learnings);

  // 剧本: 每条一份正文 MD (含 examples) + 汇总 index
  if (playbooks.length) {
    const pbDir = path.join(snapDir, "剧本");
    ensureDir(pbDir);
    playbooks.forEach((p, i) => {
      const nm = safeName(p.title || "playbook", 60);
      const md = [
        "# " + (p.title || "(未命名)"),
        "",
        "- id: " + (p.id || ""),
        "- 状态: " + (p.status || ""),
        "- 更新: " + (p.updated_at || ""),
        "",
        "---",
        "",
        String(p.body || ""),
        Array.isArray(p.examples) && p.examples.length
          ? "\n\n## examples\n\n```json\n" + JSON.stringify(p.examples, null, 2) + "\n```"
          : "",
      ].join("\n");
      try { fs.writeFileSync(path.join(pbDir, (i + 1) + "_" + nm + ".md"), md); } catch {}
    });
  }
  writeJson(path.join(snapDir, "剧本_index.json"), playbooks);

  // 密钥(含加密值/元数据·不解密) · Git 连接 · 会话清单 · 额度
  writeJson(path.join(snapDir, "密钥.json"), secrets);
  writeJson(path.join(snapDir, "git连接.json"), conns);
  writeJson(path.join(snapDir, "会话清单.json"), sessions);
  writeJson(path.join(snapDir, "额度.json"), billingObj);

  const counts = {
    sessions: sessions.length,
    knowledge: learnings.length,
    playbooks: playbooks.length,
    secrets: secrets.length,
    gitConnections: conns.length,
  };
  const partial = snapErrors.length > 0;
  writeJson(path.join(snapDir, "_manifest.json"), {
    schema: "rt-flow.devin-cloud.account-snapshot/1",
    account: auth.email,
    orgId: auth.orgId,
    snapshotAt: new Date().toISOString(),
    counts,
    billing: billingObj,
    partial,
    errors: snapErrors,
  });
  const summaryMd = [
    "# 账号本源快照 · " + auth.email,
    "",
    "- 快照时间: " + new Date().toISOString(),
    "- orgId: " + auth.orgId,
    "",
    "## 数据统计",
    "",
    "| 类别 | 数量 |",
    "|------|------|",
    "| 对话 | " + counts.sessions + " |",
    "| 知识库 | " + counts.knowledge + " |",
    "| 剧本 | " + counts.playbooks + " |",
    "| 密钥 | " + counts.secrets + " |",
    "| Git 连接 | " + counts.gitConnections + " |",
    "",
    partial ? "> ⚠ 部分留底: 以下条目拉取失败(已记录, 其余如实留底):\n>\n" + snapErrors.map((e) => ">  - " + e).join("\n") + "\n" : "",
    "> 对话记录见同级 `对话/` 目录 (每条一个带编号的文件夹); 知识库/剧本正文见本目录 `知识库/` `剧本/` 子目录。",
  ].join("\n");
  try { fs.writeFileSync(path.join(snapDir, "账号信息.md"), summaryMd); } catch {}

  // 清理历史遗留: 旧版按时间戳堆叠的 _账号快照_<ts> 目录 (数据已重采于「账号信息」, 安全移除)
  try {
    for (const e of fs.readdirSync(accountDir, { withFileTypes: true })) {
      if (e.isDirectory() && /^_账号快照_/.test(e.name)) {
        try { fs.rmSync(path.join(accountDir, e.name), { recursive: true, force: true }); } catch {}
      }
    }
  } catch {}

  prog("快照" + (partial ? "(部分)" : "完成") + ": 知识" + counts.knowledge + " 剧本" + counts.playbooks + " 密钥" + counts.secrets + " Git" + counts.gitConnections);
  return { ok: true, account: auth.email, dir: snapDir, counts, partial, errors: snapErrors };
}

// ═══ v4.4.0 · 文件夹备份 (ZIP→文件夹 · HTML/MD双视图 · 道法自然) ════════════
// 结构: <root>/<账号名>/<对话名称_关键词_ID末8位>/
//   ├── 对话.html         ← 用户看: 与 Devin AI 网页一致的可视化呈现
//   ├── 对话.md           ← AI 看: Markdown 纯文本, 可直接喂给 Agent
//   ├── 对话_agent.json   ← 全量机器可读: 全部事件+产出文件索引
//   ├── _meta.json        ← 元数据(devinId/标题/事件数/时间戳)
//   └── files/            ← 产出文件(源码/日志等)

// HTML 生成: 与 Devin AI 网页呈现一致的对话 HTML
function buildConversationHtml(title, devinId, events, opts) {
  opts = opts || {};
  const account = opts.account || "";
  const ts = new Date().toISOString();
  const msgBlocks = [];
  const userIndex = []; // 用户消息快速定位索引: {n, snippet}
  let uN = 0;
  for (const ev of events) {
    const c = classifyEvent(ev);
    if (!c) continue;
    const time = evTs(ev);
    const tsSpan = time ? ' <span class="ts">' + time + '</span>' : '';
    if (c.kind === "tool") {
      const detail = _escHtml(String(c.detail || "").slice(0, 4000));
      msgBlocks.push(
        '<div class="msg msg-tool"><div class="avatar">🔧</div>' +
        '<div class="bubble bubble-tool"><div class="role">' + _escHtml(c.role) + tsSpan + '</div>' +
        (detail ? '<details><summary>详情</summary><pre>' + detail + '</pre></details>' : '') +
        '</div></div>'
      );
    } else if (c.kind === "think") {
      // 思考默认折叠 (点「展开」才看) · 内容仍留 DOM → 可被搜索命中后自动展开
      const txt = _escHtml(c.text || "");
      msgBlocks.push(
        '<div class="msg msg-think"><div class="avatar">💭</div>' +
        '<div class="bubble bubble-think"><div class="role think-toggle" onclick="__tk(this)">💭 ' + _escHtml(c.role) + tsSpan +
        ' <span class="exp">▸ 展开思考</span></div>' +
        '<div class="body">' + _mdToHtml(txt) + '</div></div></div>'
      );
    } else {
      const isUser = c.kind === "user";
      const cls = isUser ? "user" : "ai";
      const av = isUser ? "👤" : "🤖";
      const txt = _escHtml(c.text || "");
      let idAttr = "";
      if (isUser) {
        uN++;
        idAttr = ' id="u' + uN + '" data-umsg="' + uN + '"';
        const snip = String(c.text || "").replace(/\s+/g, " ").trim().slice(0, 30);
        userIndex.push({ n: uN, snippet: snip });
      }
      msgBlocks.push(
        '<div class="msg msg-' + cls + '"' + idAttr + '><div class="avatar">' + av + '</div>' +
        '<div class="bubble bubble-' + cls + '"><div class="role">' + _escHtml(c.role) + tsSpan + '</div>' +
        '<div class="body">' + _mdToHtml(txt) + '</div></div></div>'
      );
    }
  }
  // 左上角「用户消息」快速定位索引 (第1行=初始消息, 第2行=第二条…)
  const navRows = userIndex.map((u) =>
    '<li><a href="#u' + u.n + '" onclick="__jump(' + u.n + ');return false" title="' + _escHtml(u.snippet) + '">' +
    '<span class="ni-n">' + u.n + '</span><span class="ni-s">' + _escHtml(u.snippet || ("消息 " + u.n)) + '</span></a></li>'
  ).join("");
  const nav =
    '<aside class="nav" id="nav">' +
    '<div class="nav-tools">' +
    '<input id="q" class="q" type="search" placeholder="🔍 搜索 (含思考)…" oninput="__search(this.value)">' +
    '<div class="cnt" id="cnt"></div>' +
    '<button class="tbtn" id="tkall" onclick="__tkAll()">展开全部思考</button>' +
    '</div>' +
    '<div class="nav-h">👤 我的消息 · ' + userIndex.length + ' 条</div>' +
    '<ol class="ni-list">' + (navRows || '<li class="ni-empty">无用户消息</li>') + '</ol>' +
    '</aside>';
  return '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n' +
    '<title>' + _escHtml(title) + ' · Devin 对话备份</title>\n' +
    '<style>\n' +
    ':root{--bg:#0d1117;--fg:#c9d1d9;--user-bg:#1a3a5c;--ai-bg:#161b22;--tool-bg:#1c1f26;--think-bg:#1a1a2e;--border:#30363d;--accent:#58a6ff}\n' +
    'body{margin:0;padding:0 0 0 232px;background:var(--bg);color:var(--fg);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:14px}\n' +
    '.header{background:#010409;border-bottom:1px solid var(--border);padding:16px 24px;display:flex;align-items:center;gap:12px}\n' +
    '.header h1{margin:0;font-size:18px;color:#fff;font-weight:600}\n' +
    '.header .meta{color:#8b949e;font-size:12px}\n' +
    '.container{max-width:900px;margin:0 auto;padding:24px 16px}\n' +
    '/* 左上角 · 用户消息快速定位索引 + 搜索 */\n' +
    '.nav{position:fixed;top:0;left:0;width:232px;height:100vh;overflow-y:auto;background:#010409;border-right:1px solid var(--border);box-sizing:border-box;z-index:50}\n' +
    '.nav-tools{padding:12px 12px 8px;border-bottom:1px solid var(--border);position:sticky;top:0;background:#010409}\n' +
    '.q{width:100%;box-sizing:border-box;background:#0d1117;border:1px solid var(--border);border-radius:6px;color:var(--fg);padding:7px 9px;font-size:13px;outline:none}\n' +
    '.q:focus{border-color:var(--accent)}\n' +
    '.cnt{font-size:11px;color:#8b949e;min-height:14px;margin:4px 2px 0}\n' +
    '.tbtn{width:100%;margin-top:6px;background:#21262d;border:1px solid var(--border);border-radius:6px;color:var(--fg);padding:6px;font-size:12px;cursor:pointer}\n' +
    '.tbtn:hover{background:#30363d}\n' +
    '.nav-h{padding:10px 12px 4px;font-size:11px;color:#8b949e;font-weight:600}\n' +
    '.ni-list{list-style:none;margin:0;padding:0 6px 24px;counter-reset:none}\n' +
    '.ni-list li{margin:2px 0}\n' +
    '.ni-empty{color:#484f58;font-size:12px;padding:6px 8px}\n' +
    '.ni-list a{display:flex;gap:7px;align-items:baseline;text-decoration:none;color:var(--fg);padding:6px 8px;border-radius:6px;font-size:12px}\n' +
    '.ni-list a:hover{background:#161b22}\n' +
    '.ni-n{flex-shrink:0;min-width:18px;text-align:right;color:var(--accent);font-weight:600}\n' +
    '.ni-s{color:#8b949e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n' +
    '.ni-list a.cur{background:#1f4e79;color:#fff}\n' +
    '.ni-list a.cur .ni-s{color:#cfe3ff}\n' +
    '.msg{display:flex;gap:12px;margin:16px 0;align-items:flex-start;scroll-margin-top:16px}\n' +
    '.avatar{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;background:var(--border)}\n' +
    '.bubble{flex:1;border-radius:12px;padding:12px 16px;line-height:1.6;overflow-wrap:break-word}\n' +
    '.bubble-user{background:var(--user-bg);border:1px solid #1f4e79}\n' +
    '.msg-user.flash .bubble-user{box-shadow:0 0 0 2px var(--accent)}\n' +
    '.bubble-ai{background:var(--ai-bg);border:1px solid var(--border)}\n' +
    '.bubble-tool{background:var(--tool-bg);border:1px solid var(--border);font-size:12px}\n' +
    '.bubble-think{background:var(--think-bg);border:1px solid #2d2d5e;font-style:italic;opacity:.85}\n' +
    '/* 思考默认折叠: 内容隐藏但留 DOM (可被搜索) · 点展开或命中后显示 */\n' +
    '.msg-think .body{display:none}\n' +
    '.msg-think.open .body{display:block}\n' +
    'body.think-open .msg-think .body{display:block}\n' +
    '.think-toggle{cursor:pointer;user-select:none}\n' +
    '.msg-think.open .exp,body.think-open .exp{visibility:hidden}\n' +
    '.role{font-size:12px;font-weight:600;color:var(--accent);margin-bottom:4px}\n' +
    '.exp{color:#8b949e;font-weight:400;font-style:normal}\n' +
    '.ts{color:#8b949e;font-weight:400}\n' +
    '.body p{margin:6px 0}\n' +
    '.body pre{background:#010409;border:1px solid var(--border);border-radius:6px;padding:12px;overflow-x:auto;font-size:13px}\n' +
    '.body code{background:#010409;padding:2px 6px;border-radius:4px;font-size:13px}\n' +
    '.body a{color:var(--accent);text-decoration:none;word-break:break-all}\n' +
    '.body a:hover{text-decoration:underline}\n' +
    '.body .rm-img{max-width:100%;height:auto;border-radius:8px;margin:6px 0;display:block;cursor:zoom-in;background:#010409}\n' +
    '.body .rm-imglink{display:inline-block}\n' +
    '.body .rm-v,.body .rm-a{max-width:100%;border-radius:8px;margin:6px 0;display:block}\n' +
    '.body .rm-v{background:#000}\n' +
    'details{margin:4px 0}\n' +
    'summary{cursor:pointer;color:var(--accent)}\n' +
    'details pre{max-height:300px;overflow:auto}\n' +
    '/* 搜索过滤: 仅显示命中消息 */\n' +
    'body.filtering .msg{display:none}\n' +
    'body.filtering .msg.match{display:flex}\n' +
    '.footer{text-align:center;padding:24px;color:#484f58;font-size:12px;border-top:1px solid var(--border);margin-top:32px}\n' +
    '@media(max-width:760px){body{padding-left:0}.nav{transform:translateX(-100%);transition:transform .2s}.nav.show{transform:none}' +
    '.header{flex-wrap:wrap;padding:12px 16px;gap:8px}.header h1{font-size:16px;flex:1 1 100%;order:2;line-height:1.3}.header .meta{flex:1 1 100%;order:3}.header .back{order:1}}\n' +
    '.header .back{color:var(--accent);text-decoration:none;font-size:13px;padding:5px 10px;border:1px solid var(--border);border-radius:6px;white-space:nowrap}\n' +
    '.header .back:hover{background:#161b22}\n' +
    '</style>\n</head>\n<body>\n' + nav +
    '<div class="header">' + (opts.base ? '<a class="back" href="' + _escHtml(opts.base) + '/" title="返回对话列表">‹ 对话列表</a> ' : '') + '<h1>🔮 ' + _escHtml(title) + '</h1>' +
    '<div class="meta">Session: ' + _escHtml(devinId) + (account ? ' · 账号: ' + _escHtml(account) : '') + ' · 事件: ' + events.length + '</div></div>\n' +
    '<div class="container">\n' + msgBlocks.join("\n") + '\n</div>\n' +
    '<div class="footer">RT Flow 备份 · ' + ts + ' · 道法自然</div>\n' +
    _convClientScript() +
    '</body>\n</html>';
}
// ── 归一 · 账号对话列表 (dao 自渲染·Auth0 免疫·手机+电脑一致) ──────────────────
//   base: 同源前缀 (如 /i/<accKey>) → 各链接/接口同源相对前缀, 公网隧道主口直达。
//   每条对话卡片链到 <base>/sessions/<id> (原生对话视图); 顶部可检索/刷新/新建对话。
function buildSessionsListHtml(account, sessions, opts) {
  opts = opts || {};
  const base = String(opts.base || '');
  const orgName = String(opts.orgName || '');
  const err = String(opts.error || '');
  sessions = Array.isArray(sessions) ? sessions : [];
  const stClass = (s) => {
    s = String(s || '').toLowerCase();
    if (/run|work|active/.test(s)) return 'running';
    if (/finish|complete|done/.test(s)) return 'finished';
    if (/block|wait|stuck/.test(s)) return 'blocked';
    if (/expir|fail|error/.test(s)) return 'expired';
    return '';
  };
  const fmtTime = (t) => {
    if (!t) return '';
    try { const d = new Date(typeof t === 'number' ? t : Date.parse(t)); return isNaN(d) ? String(t).slice(0, 16) : d.toLocaleString(); }
    catch (e) { return String(t).slice(0, 16); }
  };
  const cards = sessions.map((s) => {
    const sid = s.devin_id || s.session_id || s.id || '';
    const title = s.title || s.name || s.prompt || sid || '未命名';
    const st = s.status_enum || s.status || s.state || '';
    const created = s.created_at || s.created || '';
    const hay = (String(title) + ' ' + String(sid)).toLowerCase();
    return '<a class="row" data-h="' + _escHtml(hay) + '" href="' + _escHtml(base) + '/sessions/' + encodeURIComponent(sid) + '">' +
      '<div class="r1"><span class="st ' + stClass(st) + '" title="' + _escHtml(st) + '"></span>' +
      '<span class="s-title">' + _escHtml(String(title).slice(0, 90)) + '</span></div>' +
      '<div class="s-meta"><span>' + _escHtml(String(sid).slice(0, 28)) + '</span>' +
      (st ? '<span>' + _escHtml(st) + '</span>' : '') +
      (created ? '<span>建: ' + _escHtml(fmtTime(created)) + '</span>' : '') + '</div></a>';
  }).join('\n');
  const emptyMsg = err ? ('拉取失败: ' + _escHtml(err)) : '该账号暂无云端对话';
  return '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n<meta charset="UTF-8">\n' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">\n' +
    '<title>' + _escHtml(account) + ' · 对话列表</title>\n<style>\n' +
    '*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}\n' +
    'body{margin:0;background:#0d1117;color:#c9d1d9;font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}\n' +
    '.top{position:sticky;top:0;background:#010409;border-bottom:1px solid #30363d;padding:12px 16px;z-index:5}\n' +
    '.title{font-size:16px;font-weight:600;color:#fff}\n' +
    '.sub{font-size:12px;color:#8b949e;margin-top:3px;word-break:break-all}\n' +
    '.tb{display:flex;flex-wrap:wrap;gap:8px;padding:10px 16px;border-bottom:1px solid #30363d;align-items:center}\n' +
    '.q{flex:1;min-width:140px;background:#0d1117;color:#c9d1d9;border:1px solid #30363d;border-radius:6px;padding:8px 11px;font-size:13px;outline:none}\n' +
    '.q:focus{border-color:#58a6ff}\n' +
    '.btn{background:#21262d;color:#c9d1d9;border:1px solid #30363d;border-radius:6px;padding:8px 12px;font-size:13px;cursor:pointer}\n' +
    '.btn.pri{background:#1f6feb;border-color:#1f6feb;color:#fff}\n' +
    '.btn:active{opacity:.7}\n' +
    '#list{padding:10px 12px 60px;max-width:900px;margin:0 auto}\n' +
    '.row{display:block;text-decoration:none;color:inherit;background:#161b22;border:1px solid #30363d;border-radius:10px;padding:11px 13px;margin-bottom:9px}\n' +
    '.row:hover{border-color:#58a6ff}\n' +
    '.r1{display:flex;align-items:center;gap:8px}\n' +
    '.st{width:9px;height:9px;border-radius:50%;flex:0 0 auto;background:#6e7681}\n' +
    '.st.running{background:#3fb950}.st.finished{background:#58a6ff}.st.blocked{background:#f0883e}.st.expired{background:#f85149}\n' +
    '.s-title{flex:1;font-size:14px;color:#e6edf3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n' +
    '.s-meta{font-size:11px;color:#8b949e;margin-top:4px;display:flex;gap:10px;flex-wrap:wrap}\n' +
    '.empty{text-align:center;color:#6e7681;padding:36px 14px;font-size:14px}\n' +
    '.cnt{font-size:11px;color:#8b949e;margin-left:auto}\n' +
    '.footer{text-align:center;color:#484f58;font-size:11px;padding:18px}\n' +
    '</style>\n</head>\n<body data-base="' + _escHtml(base) + '">\n' +
    '<div class="top"><div class="title">🔮 Devin · 对话列表</div>' +
    '<div class="sub">' + _escHtml(account) + (orgName ? ' · ' + _escHtml(orgName) : '') + ' · 共 ' + sessions.length + ' 个对话</div></div>\n' +
    '<div class="tb"><input class="q" id="q" placeholder="🔍 检索 对话名称 / ID…" autocomplete="off">' +
    '<button class="btn" id="rf">↻ 刷新</button>' +
    '<button class="btn pri" id="nw">＋ 新建对话</button>' +
    '<span class="cnt" id="cnt"></span></div>\n' +
    '<div id="list">' + (cards || '<div class="empty">' + emptyMsg + '</div>') + '</div>\n' +
    '<div class="footer">RT Flow · 归一网页 · dao 自渲染 · 道法自然</div>\n' +
    _sessListClientScript() +
    '</body>\n</html>';
}
function _sessListClientScript() {
  return '<scr' + 'ipt>(function(){\n' +
    'var base=document.body.getAttribute("data-base")||"";\n' +
    'var rows=[].slice.call(document.querySelectorAll(".row"));\n' +
    'var q=document.getElementById("q"),cnt=document.getElementById("cnt");\n' +
    'function flt(){var v=(q.value||"").trim().toLowerCase();var n=0;rows.forEach(function(r){var ok=!v||(r.getAttribute("data-h")||"").indexOf(v)>=0;r.style.display=ok?"":"none";if(ok)n++;});cnt.textContent=v?("命中 "+n):"";}\n' +
    'q.addEventListener("input",flt);\n' +
    'document.getElementById("rf").onclick=function(){location.reload();};\n' +
    'document.getElementById("nw").onclick=function(){var p=prompt("新建对话 · 输入首条消息:");if(!p||!p.trim())return;var b=this;b.disabled=true;b.textContent="创建中…";\n' +
    'fetch(base+"/__dao/create",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt:p})}).then(function(r){return r.json();}).then(function(j){if(j&&j.ok&&j.url){location.href=j.url;}else{alert("创建失败: "+((j&&j.error)||"未知"));b.disabled=false;b.textContent="＋ 新建对话";}}).catch(function(e){alert("创建异常: "+e);b.disabled=false;b.textContent="＋ 新建对话";});};\n' +
    '})();</scr' + 'ipt>\n';
}
// 对话详情交互脚本: 思考折叠/展开 · 用户消息定位 · 全文搜索(含思考·命中自动展开)
function _convClientScript() {
  return '<script>(function(){\n' +
    'var msgs=[].slice.call(document.querySelectorAll(".msg"));\n' +
    'window.__tk=function(el){var m=el.closest(".msg-think");if(m)m.classList.toggle("open");};\n' +
    'window.__tkAll=function(){var b=document.body,on=b.classList.toggle("think-open");var t=document.getElementById("tkall");if(t)t.textContent=on?"折叠全部思考":"展开全部思考";};\n' +
    'window.__jump=function(n){var t=document.getElementById("u"+n);if(!t)return;t.scrollIntoView({behavior:"smooth",block:"start"});t.classList.add("flash");setTimeout(function(){t.classList.remove("flash")},1200);__setCur(n);};\n' +
    'function __setCur(n){[].forEach.call(document.querySelectorAll(".ni-list a"),function(a){a.classList.remove("cur")});var a=document.querySelector(\'.ni-list a[href="#u\'+n+\'"]\');if(a)a.classList.add("cur");}\n' +
    'var qt;window.__search=function(v){clearTimeout(qt);qt=setTimeout(function(){__doSearch(v)},120);};\n' +
    'function __doSearch(v){v=(v||"").trim().toLowerCase();var b=document.body;if(!v){b.classList.remove("filtering");msgs.forEach(function(m){m.classList.remove("match");if(m.classList.contains("msg-think")&&!b.classList.contains("think-open"))m.classList.remove("open")});document.getElementById("cnt").textContent="";return;}\n' +
    'b.classList.add("filtering");var hit=0;msgs.forEach(function(m){var ok=(m.textContent||"").toLowerCase().indexOf(v)>=0;m.classList.toggle("match",ok);if(ok){hit++;if(m.classList.contains("msg-think"))m.classList.add("open");}});\n' +
    'document.getElementById("cnt").textContent="命中 "+hit+" 条";}\n' +
    '})();</script>\n';
}
function _escHtml(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
// 富媒体 MD→HTML (对齐手机 APK): 代码块/行内代码 + 图片/视频/音频/链接(md 与裸 URL) + 段落。
// 输入已 HTML-escaped(& < > " ' 已转义); 反引号/方括号/圆括号/斜杠均原样保留, 可安全解析。
const _RE_IMG = /\.(png|jpe?g|gif|webp|svg|bmp|avif|ico)(?=$|[?#])/i;
const _RE_VID = /\.(mp4|webm|mov|m4v|ogv|mkv)(?=$|[?#])/i;
const _RE_AUD = /\.(mp3|wav|ogg|m4a|flac|aac)(?=$|[?#])/i;
function _mediaTag(url, alt) {
  // url 为已转义文本(其中 & 呈 &amp;), 直接置入 src/href 属性浏览器可正确解码。
  if (_RE_VID.test(url)) return '<video class="rm-v" controls preload="metadata" src="' + url + '"></video>';
  if (_RE_AUD.test(url)) return '<audio class="rm-a" controls preload="metadata" src="' + url + '"></audio>';
  if (_RE_IMG.test(url)) return '<a class="rm-imglink" href="' + url + '" target="_blank" rel="noopener"><img class="rm-img" loading="lazy" src="' + url + '" alt="' + (alt || '') + '"></a>';
  return null;
}
function _mdToHtml(escaped) {
  let s = escaped;
  const stash = [];
  const keep = (html) => { stash.push(html); return '\u0000' + (stash.length - 1) + '\u0000'; };
  // 1) 代码块/行内代码 先抽出保护(内部 URL 不被链接化)
  s = s.replace(/```([^`]*?)```/g, (m, c) => keep('<pre><code>' + c + '</code></pre>'));
  s = s.replace(/`([^`]+?)`/g, (m, c) => keep('<code>' + c + '</code>'));
  // 2) Markdown 图片 ![alt](url)
  s = s.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, (m, alt, url) =>
    keep(_mediaTag(url, alt) || '<a href="' + url + '" target="_blank" rel="noopener">' + (alt || url) + '</a>'));
  // 3) Markdown 链接 [text](url)
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (m, txt, url) =>
    keep('<a href="' + url + '" target="_blank" rel="noopener">' + txt + '</a>'));
  // 4) 裸 URL 自动识别(图片/视频/音频直显, 其余成链接) · 保留前导分隔符与尾随标点
  s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, (m, pre, url) => {
    let trail = '';
    const tm = url.match(/[.,;:!?)\]。，、；：！？）】」》]+$/);
    if (tm) { trail = tm[0]; url = url.slice(0, -trail.length); }
    return pre + keep(_mediaTag(url) || '<a href="' + url + '" target="_blank" rel="noopener">' + url + '</a>') + trail;
  });
  // 5) 段落/换行
  s = s.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>');
  s = '<p>' + s + '</p>';
  // 6) 还原受保护片段
  s = s.replace(/\u0000(\d+)\u0000/g, (m, i) => stash[+i]);
  return s;
}

// 对话备份为文件夹 (v4.4.0: 替代 ZIP · HTML/MD/JSON/files 四位一体)
// 文件夹名: <对话名称>_<ID末8位>  (可读 + 唯一)
// sharedState: 账号级共享的 backup_state 对象 (并行备份时由调用方一次性读写·避免并发读改写竞态)。
async function backupOneConversationFolder(auth, sess, accountDir, opts, sharedState) {
  opts = opts || {};
  const devinId = sess.devin_id || sess.devinId || sess.session_id || sess.id;
  const title = sess.title || sess.name || "未命名";

  const state = sharedState || readJson(DC_BACKUP_STATE, {});
  const sk = backupStateKey(auth, devinId);
  const shortId = String(devinId).replace(/^devin-/, "").slice(0, 8);
  // 对话统一收纳于 <账号>/对话/ 子目录 (与「账号信息」分明) · 文件夹带编号
  const convParent = path.join(accountDir, "对话");
  const folderName = convFolderName(opts.convNum, title, devinId);
  const convDir = path.join(convParent, folderName);
  const relFolder = "对话/" + folderName;

  // 迁移/改名 (先于增量判断, 让已备份对话也能迁入新结构):
  //   prev 可能是旧版 "<标题>_<id>" (直接在账号目录下) 或新版 "对话/<...>"。
  const prevFolder = state[sk] && state[sk].folder;
  if (prevFolder && prevFolder !== relFolder) {
    const prevDir = path.isAbsolute(prevFolder) ? prevFolder : path.join(accountDir, prevFolder);
    try {
      if (fs.existsSync(prevDir) && path.resolve(prevDir) !== path.resolve(convDir)) {
        ensureDir(convParent);
        if (!fs.existsSync(convDir)) fs.renameSync(prevDir, convDir);
        else fs.rmSync(prevDir, { recursive: true, force: true });
      }
    } catch {}
  }

  // 守柔·宁可不删不可误删: 事件流硬拉取失败(非 200)即上抛 → 计入 failed → 备份校验不通过 → 不据空备份清理原对话。
  const _ev = await fetchEventStreamDetailed(auth, devinId);
  if (!_ev.ok) throw new Error("事件流拉取失败(status " + _ev.status + ") · 备份不可信, 拒绝据此清理: " + devinId);
  const events = _ev.events;
  // 增量判断: 事件数未变且目标文件夹已成形 → 跳过 (省去 detail/文件重下)
  if (opts.incremental !== false && state[sk] && state[sk].eventCount === events.length &&
      fs.existsSync(path.join(convDir, "_meta.json"))) {
    return { devinId, title, skipped: true, reason: "no-new-events", eventCount: events.length, folder: relFolder };
  }

  const detail = await getSessionDetail(auth, devinId);
  ensureDir(convDir);

  // 产出文件
  const fileIndex = [];
  const finalState = new Map();
  (function walk(o) {
    if (!o || typeof o !== "object") return;
    if (Array.isArray(o)) return o.forEach(walk);
    if (o.file_path && o.contents_key) finalState.set(o.file_path, o.contents_key);
    for (const v of Object.values(o)) walk(v);
  })(events);
  const changes = Array.from(finalState.entries()).map(([p, k]) => ({ path: p, key: k }));
  const allKeys = Array.from(new Set(changes.map((c) => c.key)));
  if (allKeys.length) {
    const filesDir = path.join(convDir, "files");
    ensureDir(filesDir);
    const cache = new Map();
    await downloadKeysToCache(auth, devinId, allKeys, cache, fileIndex, opts);
    for (const ch of changes) {
      const data = cache.get(ch.key);
      if (!data) continue;
      const rel = ch.path
        .replace(/^[A-Za-z]:[\\/]/, "")
        .replace(/^[\\/]+/, "")
        .replace(/\\/g, "/")
        .split("/")
        .map((p) => safeName(p, 60))
        .join("/");
      const dest = path.join(filesDir, rel);
      ensureDir(path.dirname(dest));
      try { fs.writeFileSync(dest, data); } catch {}
      fileIndex.push({ path: ch.path, file: "files/" + rel, size: data.length });
    }
  }

  // HTML 视图 (用户看)
  const html = buildConversationHtml(title, devinId, events, { account: auth.email });
  try { fs.writeFileSync(path.join(convDir, "对话.html"), html, "utf8"); } catch {}

  // MD 视图 (AI 看)
  const md = buildConversationMd(title, devinId, events);
  try { fs.writeFileSync(path.join(convDir, "对话.md"), md, "utf8"); } catch {}

  // Agent JSON (全量机器可读)
  const agentJson = buildAgentDoc(title, devinId, detail, events, fileIndex);
  try { fs.writeFileSync(path.join(convDir, "对话_agent.json"), agentJson, "utf8"); } catch {}

  // 元数据
  const meta = {
    devinId, title, account: auth.email, orgId: auth.orgId,
    convNo: opts.convNum || 0,
    eventCount: events.length, producedFiles: fileIndex.length,
    backedUpAt: new Date().toISOString(),
  };
  writeJson(path.join(convDir, "_meta.json"), meta);

  state[sk] = { eventCount: events.length, backedUpAt: Date.now(), folder: relFolder };
  if (!sharedState) writeJson(DC_BACKUP_STATE, state);
  return { devinId, title, skipped: false, eventCount: events.length, producedFiles: fileIndex.length, folder: convDir };
}

// 文件夹备份某账号全部对话 (增量) → <root>/<账号名>/
async function backupAccountFolders(auth, opts) {
  opts = opts || {};
  const root = opts.targetDir || DC_BACKUP_DEFAULT;
  const prog = typeof opts.onProgress === "function" ? opts.onProgress : () => {};
  const accountDir = resolveAccountDir(root, auth, opts);
  const r = await listSessions(auth, 1000);
  const sessions = r.sessions || [];
  const result = { ok: true, account: auth.email, dir: accountDir, total: sessions.length, backedUp: 0, skipped: 0, failed: 0, items: new Array(sessions.length) };
  // 账号级共享 state: 一次读 → 并行写入内存 → 末尾一次落盘 (避免并发读改写竞态·并提速)
  const state = readJson(DC_BACKUP_STATE, {});
  const conc = opts.turbo
    ? Math.max(1, +CFG.turboConvConcurrency || 6)
    : Math.max(1, +CFG.convConcurrency || 4);
  let done = 0;
  await runPool(sessions, conc, async (sess, i) => {
    try {
      const one = await backupOneConversationFolder(auth, sess, accountDir, Object.assign({}, opts, { convNum: i + 1 }), state);
      result.items[i] = one;
      one.skipped ? result.skipped++ : result.backedUp++;
    } catch (e) {
      result.failed++;
      result.items[i] = { error: String(e && e.message ? e.message : e) };
    }
    done++;
    prog("备份 " + done + "/" + sessions.length + " ...");
  });
  writeJson(DC_BACKUP_STATE, state);
  // G · 沉寂对话本地 ZIP 归档(零 API 成本·对齐手机 APK)
  try {
    const arc = archiveSettledConvZips(accountDir, opts);
    if (arc.archived) prog("沉寂对话 ZIP 归档 " + arc.archived + " 个(全量含 files)");
    result.archivedZips = arc;
  } catch {}
  prog("账号备份完成: 新备份" + result.backedUp + " 跳过" + result.skipped + " 失败" + result.failed);
  return result;
}

// 沉寂对话本地 ZIP 归档(对齐手机 APK「打包成 ZIP」): folder 模式下, 最后事件变更已沉寂
//   ≥settleMs(默认 7 天)的对话, 把整个对话文件夹压成 <账号>/对话/_归档/<8id>_<标题>.zip
//   (全量·含 files/HTML/MD/agent.json)。有新事件 → 文件夹重备 → backedUpAt 前移 →
//   ZIP 落后即下轮重打(增量更新 ZIP 内容)。零 API 成本·纯本地压缩。
function archiveSettledConvZips(accountDir, opts) {
  opts = opts || {};
  const settleMs = Math.max(3600000, +opts.settleMs || 7 * 24 * 3600000);
  const convParent = path.join(accountDir, "对话");
  const out = { archived: 0, skipped: 0, failed: 0 };
  let entries = [];
  try { entries = fs.readdirSync(convParent, { withFileTypes: true }); } catch { return out; }
  const arcDir = path.join(convParent, "_归档");
  for (const e of entries) {
    if (!e.isDirectory() || e.name.startsWith("_")) continue;
    const convDir = path.join(convParent, e.name);
    let meta = null;
    try { meta = JSON.parse(fs.readFileSync(path.join(convDir, "_meta.json"), "utf8")); } catch { continue; }
    const backedAt = Date.parse(meta.backedUpAt || "") || 0;
    if (!backedAt || Date.now() - backedAt < settleMs) { out.skipped++; continue; } // 未沉寂
    const shortId = String(meta.devinId || "").replace(/^devin-/, "").slice(0, 8) || e.name.slice(-8);
    const zipPath = path.join(arcDir, shortId + "_" + safeName(meta.title || e.name, 50) + ".zip");
    // 增量: ZIP 已存在且不早于最后事件变更 → 免重打
    try { if (fs.statSync(zipPath).mtimeMs >= backedAt) { out.skipped++; continue; } } catch {}
    try {
      const zip = new ZipWriter();
      (function addDir(dir, rel) {
        for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
          const abs = path.join(dir, f.name);
          const r = rel ? rel + "/" + f.name : f.name;
          if (f.isDirectory()) addDir(abs, r);
          else if (f.isFile()) zip.addFile(r, fs.readFileSync(abs));
        }
      })(convDir, "");
      ensureDir(arcDir);
      fs.writeFileSync(zipPath, zip.toBuffer());
      out.archived++;
    } catch { out.failed++; }
  }
  return out;
}

// 完整本源备份(文件夹版) = 文件夹对话备份 + 账号数据全量快照
async function backupAccountFullFolders(auth, opts) {
  opts = opts || {};
  let conversations = null, convError = null;
  try { conversations = await backupAccountFolders(auth, opts); }
  catch (e) { convError = String((e && e.message) || e); }
  const snapshot = await snapshotAccountData(auth, opts);
  return { ok: true, account: auth.email, conversations, convError, snapshot };
}

// 完整本源备份 = 会话 ZIP(增量) + 账号数据全量快照. 供「备份并清空」一步到位。
async function backupAccountFull(auth, opts) {
  opts = opts || {};
  // 对话备份失败(瞬时抖动/超时)不应连累数据快照 —— 两段相互独立, 各自尽力留底。
  let conversations = null, convError = null;
  try { conversations = await backupAccount(auth, opts); }
  catch (e) { convError = String((e && e.message) || e); }
  const snapshot = await snapshotAccountData(auth, opts);
  return { ok: true, account: auth.email, conversations, convError, snapshot };
}

// ═══ 备份浏览 + 快速解锁(解压) ════════════════════════════════════════════
// 列出备份根下「账号(带编号) → 对话(带编号·可查看正文)」树, 供前端浏览。
//   新结构: <账号>/对话/<NNN_标题_id>/(含 _meta.json+对话.html) · <账号>/账号信息/
//   兼容旧结构: 对话文件夹/ZIP 直接位于 <账号>/ 下。
// 短 ID(目录/ZIP 名内嵌的 devinId 前 8 位) → 全量 devinId。
//   backup_state 键形如 <orgBare>:devin-<id>; 唯一前缀命中才返回(宁缺毋错)。
//   意义: ZIP 备份与 _meta.json 缺失/损坏的旧文件夹本无 devinId → 前端「🚀 进入(多实例)」
//   按钮因此消失; 据文件名短 ID 反查即恢复可开。
function _shortIdResolver() {
  let ids = null;
  return (short) => {
    short = String(short || "").toLowerCase();
    if (!/^[a-z0-9]{8}$/.test(short)) return "";
    if (!ids) {
      ids = [];
      try {
        for (const k of Object.keys(readJson(DC_BACKUP_STATE, {}))) {
          const i = k.indexOf(":");
          const id = (i >= 0 ? k.slice(i + 1) : k).trim();
          if (id) ids.push(id);
        }
      } catch {}
    }
    let hit = "";
    for (const id of ids) {
      if (id.replace(/^devin-/, "").toLowerCase().startsWith(short)) {
        if (hit && hit !== id) return ""; // 多义 → 放弃
        hit = id;
      }
    }
    return hit;
  };
}
function _scanConvEntries(base, resolveShort) {
  const convs = [];
  let entries = [];
  try { entries = fs.readdirSync(base, { withFileTypes: true }); } catch { return convs; }
  const rs = resolveShort || _shortIdResolver();
  for (const e of entries) {
    if (e.isFile() && e.name.toLowerCase().endsWith(".zip")) {
      let size = 0, mtime = 0;
      try { const st = fs.statSync(path.join(base, e.name)); size = st.size; mtime = st.mtimeMs; } catch {}
      // ZIP 名 = <devinId 末8位>_<对话名>.zip → 反查全量 devinId + 标题
      const zm = e.name.match(/^([A-Za-z0-9]{8})_(.+)\.zip$/i);
      convs.push({
        name: e.name, path: path.join(base, e.name), size, mtime, type: "zip", num: 0,
        title: zm ? zm[2] : "", devinId: zm ? rs(zm[1]) : "",
      });
    } else if (e.isDirectory() && !e.name.startsWith("_") && e.name !== "账号信息" && e.name !== "对话" && e.name !== "files") {
      const metaPath = path.join(base, e.name, "_meta.json");
      if (!fs.existsSync(metaPath)) continue;
      let mtime = 0, meta = {};
      try { mtime = fs.statSync(metaPath).mtimeMs; } catch {}
      try { meta = JSON.parse(fs.readFileSync(metaPath, "utf8")); } catch {}
      const htmlPath = path.join(base, e.name, "对话.html");
      // 文件夹名 = <NNN>_<标题>_<ID末8位> → meta 缺失/损坏时据尾段短 ID 反查
      let did = meta.devinId || "";
      if (!did) { const fm = e.name.match(/_([A-Za-z0-9]{8})$/); if (fm) did = rs(fm[1]); }
      convs.push({
        name: e.name, path: path.join(base, e.name), mtime, type: "folder",
        title: meta.title || "", devinId: did, eventCount: meta.eventCount || 0, num: meta.convNo || 0,
        hasHtml: fs.existsSync(htmlPath), htmlPath,
      });
    }
  }
  return convs;
}
function listBackups(root) {
  root = root || DC_BACKUP_DEFAULT;
  const out = { root, accounts: [] };
  let dirs = [];
  try { dirs = fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()); } catch { return out; }
  const rs = _shortIdResolver(); // 整树共享一个短ID解析器(state 只读一次)
  for (const d of dirs) {
    if (d.name.startsWith("_")) continue;
    const accDir = path.join(root, d.name);
    let acctMeta = {};
    try { acctMeta = JSON.parse(fs.readFileSync(path.join(accDir, ".account.json"), "utf8")); } catch {}
    const convParent = path.join(accDir, "对话");
    // 新结构优先扫 对话/ 子目录; 同时扫账号目录根 (兼容旧结构遗留的对话/ZIP)
    const convs = _scanConvEntries(fs.existsSync(convParent) ? convParent : accDir, rs);
    if (fs.existsSync(convParent)) {
      // 兼容: 既有 对话/ 又有根级旧文件夹时, 两者合并
      for (const c of _scanConvEntries(accDir, rs)) convs.push(c);
    }
    convs.sort((a, b) => (a.num && b.num ? a.num - b.num : b.mtime - a.mtime));
    const infoDir = path.join(accDir, "账号信息");
    const hasInfo = fs.existsSync(infoDir);
    out.accounts.push({
      account: d.name, email: acctMeta.email || "", accountNo: acctMeta.accountNo || 0,
      dir: accDir, count: convs.length,
      hasAccountInfo: hasInfo, accountInfoPath: hasInfo ? infoDir : "",
      conversations: convs,
    });
  }
  out.accounts.sort((a, b) => (a.accountNo && b.accountNo ? a.accountNo - b.accountNo : b.count - a.count));
  return out;
}

// 解锁(解压)一个对话 ZIP → 同名文件夹, 返回解压目录。用本地 zlib inflate, 零外部依赖。
function unlockBackup(zipPath, opts) {
  opts = opts || {};
  if (!fs.existsSync(zipPath)) return { ok: false, error: "ZIP 不存在: " + zipPath };
  const outDir = opts.outDir || zipPath.replace(/\.zip$/i, "");
  ensureDir(outDir);
  const buf = fs.readFileSync(zipPath);
  const sig = Buffer.from([0x50, 0x4b, 0x01, 0x02]); // central directory header
  let i = 0, count = 0;
  while ((i = buf.indexOf(sig, i)) !== -1) {
    const method = buf.readUInt16LE(i + 10);
    const compSize = buf.readUInt32LE(i + 20);
    const nameLen = buf.readUInt16LE(i + 28);
    const extraLen = buf.readUInt16LE(i + 30);
    const commentLen = buf.readUInt16LE(i + 32);
    const lho = buf.readUInt32LE(i + 42); // local header offset
    const name = buf.slice(i + 46, i + 46 + nameLen).toString("utf8");
    // local header: 30 + nameLen + extraLen → data
    const lNameLen = buf.readUInt16LE(lho + 26);
    const lExtraLen = buf.readUInt16LE(lho + 28);
    const dataStart = lho + 30 + lNameLen + lExtraLen;
    const comp = buf.slice(dataStart, dataStart + compSize);
    let data;
    try { data = method === 8 ? zlib.inflateRawSync(comp) : comp; } catch { data = comp; }
    const dest = path.join(outDir, name);
    if (name.endsWith("/")) { ensureDir(dest); }
    else { ensureDir(path.dirname(dest)); fs.writeFileSync(dest, data); count++; }
    i += 46 + nameLen + extraLen + commentLen;
  }
  return { ok: true, outDir, files: count };
}

// ═══ 账号标签 (防搞混) ════════════════════════════════════════════════════
function getTag(email) {
  return (readJson(DC_TAGS_FILE, {})[String(email).toLowerCase()] || "");
}
function setTag(email, tag) {
  const t = readJson(DC_TAGS_FILE, {});
  const k = String(email).toLowerCase();
  if (tag) t[k] = String(tag).slice(0, 40);
  else delete t[k];
  writeJson(DC_TAGS_FILE, t);
  return t[k] || "";
}
function allTags() {
  return readJson(DC_TAGS_FILE, {});
}

// v4.9.11 · 24h 冷却期状态管理 (email → {backupCompletedAt, lastConvUpdateAt, cleanedAt})
function getCleanupState(email) {
  const all = readJson(DC_CLEANUP_STATE, {});
  return all[String(email).toLowerCase()] || null;
}
function setCleanupState(email, patch) {
  const all = readJson(DC_CLEANUP_STATE, {});
  const k = String(email).toLowerCase();
  all[k] = Object.assign(all[k] || {}, patch);
  writeJson(DC_CLEANUP_STATE, all);
  return all[k];
}
// 出库/重加时清残留冷却态 — 防幽灵: 旧 backupCompletedAt/cleanedAt 不再影响重加后的新一轮判定 (对照手机 APK purgeAccountState)
function clearCleanupState(email) {
  const all = readJson(DC_CLEANUP_STATE, {});
  const k = String(email).toLowerCase();
  if (k in all) {
    delete all[k];
    writeJson(DC_CLEANUP_STATE, all);
  }
}
function isCleanupReady(email, cooldownMs) {
  const st = getCleanupState(email);
  if (!st || !st.backupCompletedAt) return { ready: false, reason: "no_backup" };
  const now = Date.now();
  const cd = cooldownMs || 24 * 60 * 60 * 1000;
  const sinceBk = now - st.backupCompletedAt;
  if (sinceBk < cd) return { ready: false, reason: "cooldown", remaining: cd - sinceBk };
  if (st.lastConvUpdateAt && (now - st.lastConvUpdateAt) < cd)
    return { ready: false, reason: "recent_update", remaining: cd - (now - st.lastConvUpdateAt) };
  // v4.10.0: 允许再次清理 — 旧逻辑 cleanedAt>0 就永远阻断, 导致账号充值后再归零无法再清。
  //   新逻辑: 仅当 cleanedAt 晚于 backupCompletedAt 时阻断 (备份是在上次清理之前做的, 不能再用旧备份清)。
  //   若 backupCompletedAt > cleanedAt 则说明清理后有新的全量备份 → 允许新一轮清理。
  if (st.cleanedAt && st.cleanedAt >= st.backupCompletedAt) return { ready: false, reason: "already_cleaned" };
  return { ready: true };
}

// ═══ 导出 MD (给本地/其它 Agent 的操作指令文档) ═══════════════════════════
// 前端只需一个「导出 MD」按钮: 用户复制此文档给本地 Agent, Agent 据此后端驱动全部能力。
function buildAgentMd(ctx) {
  ctx = ctx || {};
  const accounts = ctx.accounts || [];
  const backupRoot = ctx.backupRoot || DC_BACKUP_DEFAULT;
  const L = [];
  L.push("# RT Flow · Devin Cloud 后端操作指令 (Agent 用)");
  L.push("");
  L.push("> 本文档由 RT Flow 第五板块「导出 MD」生成。把它交给本地 Agent，");
  L.push("> Agent 即可代替用户、经后端接口完成对话导出/备份/水过无痕清理等全部操作。");
  L.push("> 一切软编码、唯变所适：端点若变动，以 rt-flow 配置 (CFG) 为准。");
  L.push("");
  L.push("## 0. 鉴权");
  L.push("- 登录: `POST " + CFG.loginUrl + "` body `{email,password}` → `token` (=auth1)");
  L.push("- 组织: `POST " + CFG.apiBase + "/users/post-auth` (Bearer auth1) → `org_id`");
  L.push("- 之后所有请求带 `Authorization: Bearer <auth1>` 与 `x-cog-org-id: <org_id>`");
  L.push("- bare = org_id 去掉 `org-` 前缀");
  L.push("");
  L.push("## 1. 读取 (对话/知识库/剧本/密钥/Git/额度)");
  L.push("- 对话列表: `GET /api/org-{bare}/v2sessions` (备用 `/api/sessions`)");
  L.push("- 对话详情: `GET /api/sessions/{devinId}`");
  L.push("- 事件流: `GET /api/events/{devinId}/stream` (兜底 `/api/events/first-load/{devinId}`)");
  L.push("- 文件下载: `POST /api/presigned-url/batch/{devinId}` body `{s3_key_list:[...]}` → 逐个 GET 预签 URL");
  L.push("- 知识库: `GET /api/org-{bare}/learning/all`");
  L.push("- 剧本: `GET /api/org-{bare}/playbooks`");
  L.push("- 密钥: `GET /api/org-{bare}/secrets`");
  L.push("- Git 连接: `GET /api/organizations/{org_id}/git-connections-metadata`");
  L.push("- 额度: `GET /api/{org_id}/billing/status`");
  L.push("");
  L.push("## 1b. 写入 (代替用户发起/续写对话)");
  L.push("- 发起对话: `POST /api/sessions` body `{prompt, title?, tags?, playbook_id?, repos?}` → `{devin_id, is_new_session, created_at}`");
  L.push("- 续写对话: `POST /api/session/{devinId}/message` body `{message}` (官方公开 API 形态)");
  L.push("- 发起后用 §1 的对话详情/事件流轮询即可实时观测运行状态、事件增长。");
  L.push("");
  L.push("## 2. 备份 (Devin Cloud 结构 · 增量)");
  L.push("- 目录: `" + backupRoot + "/<账号名>/<devinId末8位>_<对话名>.zip`");
  L.push("- 每个 zip: `对话_人类可读.md` + `对话_agent.json` + `files/<产出文件>` + `_meta.json`");
  L.push("- 增量: 比较本次事件数与上次 `eventCount`，相同则跳过；事件增长则重备(追加新事件)。");
  L.push("- 浏览/解锁: 列出 `<root>/<账号>/*.zip`；解锁=本地 inflate 解压到同名文件夹 (零依赖)。");
  L.push("");
  L.push("## 3. 水过无痕 (一键清理 → 账号回到本源默认态)");
  L.push("先列出再逐个删除 (顺序: Git→密钥→剧本→知识库→对话)。只清用户自建; 本源默认(社区剧本/内置知识)删不掉也不删:");
  L.push("- 密钥: `DELETE /api/secrets/{secretId}` (实跑确证·返 200; 旧 `/api/org-{bare}/secrets/{id}` 恒 404)");
  L.push("- 剧本: `DELETE /api/playbooks/{playbookId}` (实跑确证·返 200; 旧 `/api/org-{bare}/playbooks/{id}` 恒 404)");
  L.push("- 知识库: `DELETE /api/org-{bare}/learning/{knowledgeId}` (返 200; builtin 内置知识返 403 不可删)");
  L.push("- 对话: `POST /api/sessions/{devinId}/archive` (平台不支持硬删除·DELETE 返 405; 归档=移出仪表盘)");
  L.push("- Git 连接: 元数据 `GET /api/organizations/{org_id}/git-connections-metadata` 只读(Allow:GET); 断开端点待实测");
  L.push("- 用户/本源区分: 剧本 `org_id===本组织 && access!=='community'`; 知识 `note_type==='user'`");
  L.push("");
  if (accounts.length) {
    L.push("## 4. 目标账号");
    for (const a of accounts) {
      const tag = getTag(a.email);
      L.push("- " + a.email + (tag ? "  [标签: " + tag + "]" : ""));
    }
    L.push("");
  }
  L.push("## 5. RT Flow 命令 (在 Devin Desktop 内可直接调用)");
  L.push("- `wam.devinBackupAccount` 备份指定账号全部对话 (增量)");
  L.push("- `wam.devinWipeAccount` 水过无痕清理指定账号");
  L.push("- `wam.devinExportMd` 导出本文档");
  L.push("");
  L.push("_生成时间: " + new Date().toISOString() + "_");
  return L.join("\n");
}

// 取数指引 MD (对照手机 APK buildAccessGuide): 账号(邮箱/密码/org)+ Session ID + 提取流程 —
//   与「对话_人类可读.md」配套的第二份文档, 据此任意 Agent 可随时整体重新取回该对话全部文件。
function buildAccessGuide(acc, sid, title) {
  acc = acc || {};
  const full = String(sid || "").indexOf("devin-") === 0 ? sid : "devin-" + sid;
  const bare = String(sid || "").indexOf("devin-") === 0 ? String(sid).slice(6) : sid;
  const email = acc.email || "", pwd = acc.password || "", org = acc.orgName || "", orgId = acc.orgId || "";
  const emailRef = email || "<email>";
  const L = [];
  L.push("# 查看该对话的全部文件 · 取数指引\n");
  L.push("> 本文件与配套的 `对话_人类可读.md`(该对话全量文本) 成对, 仅针对**这一条对话**。\n");
  L.push("## 0、给读到本文的 Agent · 一句话执行\n");
  L.push("你拿到的是 **账号 `" + emailRef + "`** 的对话 **`" + full + "`**(在线查看 https://app.devin.ai/sessions/" + bare + ")。");
  L.push("要**完整取回这条对话的全部内容与产出文件**(只读历史·**不耗额度**), 按下述坐标+鉴权提取即可。\n");
  L.push("## 一、对话坐标\n");
  L.push("| 项 | 值 |\n|----|----|");
  L.push("| 标题 | " + String(title || sid).replace(/\|/g, "\\|") + " |");
  L.push("| Session ID | `" + full + "` |");
  L.push("| 在线查看 | https://app.devin.ai/sessions/" + bare + " |");
  if (org || orgId) L.push("| 组织 | " + String(org).replace(/\|/g, "\\|") + (orgId ? " (`" + orgId + "`)" : "") + " |");
  L.push("\n## 二、该对话所属账号 (额度耗尽也可登录读历史)\n");
  L.push("| 项 | 值 |\n|----|----|");
  L.push("| 邮箱 | " + (email ? "`" + email + "`" : "(未知)") + " |");
  L.push("| 密码 | " + (pwd ? "`" + pwd + "`" : "(未知)") + " |");
  L.push("\n> 提取只读历史数据, **不消耗额度**。\n");
  L.push("## 三、提取流程 (REST · 与本插件备份引擎同源)\n");
  L.push("- 登录: `POST " + CFG.loginUrl + "` body `{email,password}` → `token`(=auth1)");
  L.push("- 组织: `POST " + CFG.apiBase + "/users/post-auth` (Bearer auth1) → `org_id` (bare=去 `org-` 前缀)");
  L.push("- 事件流: `GET /api/events/" + full + "/stream` (兜底 `/api/events/first-load/" + full + "`)");
  L.push("- 详情: `GET /api/sessions/" + full + "`");
  L.push("- 产出文件: `POST /api/presigned-url/batch/" + full + "` body `{s3_key_list:[...]}` → 逐个 GET 预签 URL");
  L.push("\n> 桌面切号面板对话行的 📦「全部文件」按钮等价于整包 ZIP(对话md+取数指引+工作产物 files/)一键落盘。\n");
  L.push("_生成时间: " + new Date().toISOString() + "_");
  return L.join("\n");
}

// ═══ 零依赖 ZIP 写出器 (STORE + DEFLATE) ══════════════════════════════════
let _crcTable;
function crc32(buf) {
  if (!_crcTable) {
    _crcTable = new Int32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      _crcTable[i] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ _crcTable[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}
class ZipWriter {
  constructor() {
    this.entries = [];
    this.chunks = [];
    this.offset = 0;
  }
  addFile(name, data) {
    const buf = typeof data === "string" ? Buffer.from(data, "utf-8") : data;
    const nameBuf = Buffer.from(String(name).replace(/\\/g, "/"), "utf-8");
    const crc = crc32(buf);
    let compressed = Buffer.from(zlib.deflateRawSync(buf, { level: 6 }));
    let method = 8;
    if (compressed.length >= buf.length) {
      compressed = buf;
      method = 0;
    }
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x0800, 6);
    header.writeUInt16LE(method, 8);
    header.writeUInt16LE(0, 10);
    header.writeUInt16LE(0x21, 12);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(compressed.length, 18);
    header.writeUInt32LE(buf.length, 22);
    header.writeUInt16LE(nameBuf.length, 26);
    header.writeUInt16LE(0, 28);
    const entryOffset = this.offset;
    this.chunks.push(header, nameBuf, compressed);
    this.offset += header.length + nameBuf.length + compressed.length;
    this.entries.push({ name: nameBuf, dataLen: buf.length, compressed, crc, offset: entryOffset, method });
  }
  toBuffer() {
    const centralStart = this.offset;
    const central = [];
    let centralSize = 0;
    for (const e of this.entries) {
      const rec = Buffer.alloc(46);
      rec.writeUInt32LE(0x02014b50, 0);
      rec.writeUInt16LE(20, 4);
      rec.writeUInt16LE(20, 6);
      rec.writeUInt16LE(0x0800, 8);
      rec.writeUInt16LE(e.method, 10);
      rec.writeUInt16LE(0, 12);
      rec.writeUInt16LE(0x21, 14);
      rec.writeUInt32LE(e.crc, 16);
      rec.writeUInt32LE(e.compressed.length, 20);
      rec.writeUInt32LE(e.dataLen, 24);
      rec.writeUInt16LE(e.name.length, 28);
      rec.writeUInt16LE(0, 30);
      rec.writeUInt16LE(0, 32);
      rec.writeUInt16LE(0, 34);
      rec.writeUInt16LE(0, 36);
      rec.writeUInt32LE(0, 38);
      rec.writeUInt32LE(e.offset, 42);
      central.push(rec, e.name);
      centralSize += rec.length + e.name.length;
    }
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(0, 4);
    eocd.writeUInt16LE(0, 6);
    eocd.writeUInt16LE(this.entries.length, 8);
    eocd.writeUInt16LE(this.entries.length, 10);
    eocd.writeUInt32LE(centralSize, 12);
    eocd.writeUInt32LE(centralStart, 16);
    eocd.writeUInt16LE(0, 20);
    return Buffer.concat([...this.chunks, ...central, eocd]);
  }
}

// v3.50.65 · 切号激活决策 (纯函数 · 供 extension.loginAccount 复用 + 单测护栏)
//   道法自然·不因末技废本源: IDE 原生认证注入(路丙命令 / 路丁 vscdb 直写) 在
//   headless / Linux Devin Desktop 上本就不可用(无对应认证命令注册·无 Windows DPAPI),
//   但 auth1 token 经 registerUser 预验有效时, 账号在 /shell · 本地API · 多实例反代 ·
//   反向注入层面完全可用(这些路径皆直用 auth1, 不经 IDE 原生登录态)。
//   旧病灶: 注入失败即判 switch 失败 → 不 setActive → _tick 因"无活跃号"永久空转重试
//           (每轮 3×~17s 注入超时), active 号永不落定 · CPU/日志空耗。
//   治法(本函数):
//     · 注入成功            → 激活 (path 保留 injected 真路径)
//     · 注入失败但 token 有效 → 仍激活 (降级 · path='none')
//     · 注入失败且 token 无效 → 不激活 (真失败)
//   Windows 上注入成功则恒走第一支, 行为与旧版完全一致 (无回归)。
function resolveSwitchActivation(injectOk, tokenVerified) {
  if (injectOk) return { activate: true, degraded: false };
  if (tokenVerified) return { activate: true, degraded: true };
  return { activate: false, degraded: false };
}

module.exports = {
  CFG,
  configure,
  resolveSwitchActivation,
  paths: { WAM_DIR, DC_DIR, DC_AUTH_CACHE, DC_TAGS_FILE, DC_BACKUP_STATE, DC_CLEANUP_STATE, DC_BACKUP_DEFAULT, DC_HOME_BACKUP, DC_BACKUP_ROOT_STATE },
  // 数据盘自动择优 + 迁移 (备份不压系统盘)
  getOptimalBackupRoot,
  listDataDrives,
  setBackupRoot,
  migrateBackups,
  // auth
  login,
  getAuth,
  clearAuthCache,
  getCachedAuth,
  cachedEmails,
  authHeaders,
  // reads
  listSessions,
  getSessionDetail,
  getEventStream,
  fetchEventStreamDetailed,
  // writes (代替用户发起/续写对话)
  createSession,
  sendMessage,
  listKnowledge,
  listPlaybooks,
  listSecrets,
  getGitConnections,
  getBilling,
  billingBalance,
  classifyEvent,
  accountOverview,
  classifySession,
  listRunningSessions,
  buildAccessGuide,
  readBackupState: () => readJson(DC_BACKUP_STATE, {}),
  stopSession,
  // deletes / wipe
  deleteKnowledge,
  deletePlaybook,
  deleteSecret,
  disconnectGit,
  listGitPermissions,
  deleteGitPermission,
  deleteSession,
  wipeAccount,
  // backup
  backupAccount,
  backupOneConversation,
  backupConversationsBundle,
  snapshotAccountData,
  backupAccountFull,
  // v4.4.0 · 文件夹备份 (HTML/MD双视图 · 道法自然)
  buildConversationHtml,
  buildConversationMd,
  buildSessionsListHtml,
  backupOneConversationFolder,
  backupAccountFolders,
  archiveSettledConvZips,
  backupAccountFullFolders,
  listBackups,
  unlockBackup,
  // tags
  getTag,
  setTag,
  allTags,
  // cleanup state (24h 冷却期)
  getCleanupState,
  setCleanupState,
  clearCleanupState,
  isCleanupReady,
  // export md
  buildAgentMd,
  // utils
  ZipWriter,
  safeName,
  accountFolderName,
  cleanTitle,
  convFolderName,
  findAccountDir,
  resolveAccountDir,
  runPool,
  // 低层传输(供 devin_git 等同源复用 · 统一代理/TLS 重试于一处)
  rawRequest,
  jsonRequest,
  proxyForUrl,
  // 重试判定 (可单测 · 限流/暂时性故障韧性)
  _isRetryableStatus,
  _retryDelayMs,
  _isTransientErr,
  // v4.7.3 · 对话上限/抽干 (可测纯函数)
  computeConvCap,
  // v4.9.5 · 反向注入消息额度上限 (Devin billing usage limits)
  messageLimitInt,
  setMessageLimit,
  getMessageLimit,
  // v4.7.5 · 低余额预警 / 卡死监测 (可测纯函数)
  lowBalanceVerdict,
  sessionSignature,
  stallVerdict,
  // v4.7.7 · 对话最终报告 + 健康度 (可测纯函数)
  conversationFinalReport,
  healthScore,
};
