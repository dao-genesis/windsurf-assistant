// ═══════════════════════════════════════════════════════════════════════════
// devin_proxy.js · v4.15.0 · IDE 内置浏览器自足注入反代 (不赖 dao-vsix) · 静态资源缓存提速 (内存 L1 + 磁盘 L2 + 客户端 Service Worker L0)
// ───────────────────────────────────────────────────────────────────────────
// 帛书·「天下之至柔·驰骋于天下之致坚；无有入于无间」: IDE 内置浏览器 (simpleBrowser /
//   webview) 是受沙箱约束的 iframe — 无 CDP 端口可控, 无法如系统浏览器般经 CDP
//   addScriptToEvaluateOnNewDocument 种 localStorage。故以本地反向代理为「无间」之道:
//   localhost:port 代 app.devin.ai 取页 → 剥 X-Frame-Options/CSP → <head> 起注入
//   localStorage['auth1_session'] 登录态 → SPA 自判已登录, 零 GUI/OAuth/反代依赖。
// 帛书·「鸡犬相闻·民至老死不相往来」: 每账号独立端口 (独立 origin) → localStorage 隔离 →
//   IDE 内多标签各登各号, 多实例并行不相悖。
// 零外部依赖: 仅 Node 内建 http/https/net/zlib。技法 1:1 移植自 dao-vsix 已验证反代。
// ═══════════════════════════════════════════════════════════════════════════
"use strict";

const http = require("http");
const https = require("https");
const net = require("net");
const tls = require("tls");
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

const DEVIN_APP = "https://app.devin.ai";
const DEVIN_WS = "https://windsurf.com";
const DEVIN_REG = "https://register.windsurf.com";
const DEVIN_CDN = "https://server.codeium.com";
const DEVIN_SS = "https://server.self-serve.windsurf.com";
const DEVIN_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// v4.9.6 · E: keep-alive 连接池 — 根治「IDE 内路由官网非常慢」。SPA 一次加载数百请求,
//   旧实现每请求新建 TLS 握手 (默认 agent keepAlive=false) → 串行重握手即是卡顿主因。
//   复用 socket 后首屏与切页显著提速; maxSockets 适度并行, 空闲 15s 回收。
const _httpsAgent = new https.Agent({ keepAlive: true, keepAliveMsecs: 15000, maxSockets: 64, maxFreeSockets: 16, timeout: 60000 });

// 逐跳头集合 (RFC 7230 §6.1)。缓存命中重放时须剥之 —— 历史落盘条目 baked 了上游
//   `Connection: close`, 原样回放即令 webview 每分片后拆 TCP; 剥后显式 keep-alive 复用 socket。
const _HOP_HEADERS = new Set(["connection", "keep-alive", "proxy-connection", "proxy-authenticate", "proxy-authorization", "te", "trailer", "transfer-encoding", "upgrade"]);
function _keepAliveHeaders(h) {
  const out = {};
  if (h) for (const k of Object.keys(h)) { if (!_HOP_HEADERS.has(k.toLowerCase())) out[k] = h[k]; }
  out["Connection"] = "keep-alive";
  out["X-Dao-Ka"] = "v498";
  return out;
}
// Node http.Server 在 req 被判定 shouldKeepAlive=false 时会强制回 `Connection: close`,
//   即便响应头显式置 keep-alive 亦被协议层覆盖。故落盘缓存重放/上游静态回写前,
//   主动把 res.shouldKeepAlive 拨为 true, 令 socket 真正复用 (根治剩余 TCP 重握手税)。
function _forceKeepAlive(res) { try { res.shouldKeepAlive = true; } catch {} }

// 预热逃生开关 (运维/对照基线): 置 DAO_NO_PREWARM=1 关闭后台预热。
const DAO_NO_PREWARM = !!process.env.DAO_NO_PREWARM;

// email → { server, port, auth }. 每账号独立端口 → origin 隔离 → 多实例不串号。
const _servers = new Map();

// 拖拽上传桥服务钩子 (由 dao-vsix out 层经 rt-flow 注入)。
//   帛书·「同于道者·道亦乐得之」: 桥脚本 /__daobridge.js 与取字节端点 /__dlfile·/__convmd
//   就地服务于本账号反代端口 → 与落点页严格同源, location.origin fetch 即达, 无跨域。
//   根治: 桥此前仅注入 /i/ 同源页与 /__web 通用代理页, 漏了 IDE 内多实例真正承载 Devin 页的
//   本反代 → 拖文件/会话到该页"无反应"。签名: (routePath, urlObj) => {status,contentType,body,binary,headers}|null。
let _bridgeServe = null;
function setBridgeServe(fn) { _bridgeServe = (typeof fn === "function") ? fn : null; }

// ═══ 附件鉴权 Cookie (attachments_token) · 移植手机 APK ══════════════════════════
// 帛书·「无有入于无间」: app.devin.ai/attachments/* 的真鉴权是 httpOnly Cookie
//   `attachments_token`(POST /api/users/set-attachment-cookie 用 Bearer 铸造)。Bearer
//   对该路径无效 → <img>/<video> 由渲染器原生发起(不经 JS·无 Cookie)必 401 → 「电脑端
//   图片显示不了、视频放不了」(手机端因 WebView 层已代铸 Cookie 故正常)。反代须同样代铸
//   Cookie 并按 /attachments/ 转发, 401 时重铸重试一次(自愈)。Cookie 组织级作用域 →
//   缓存键按 orgId(无 org 回落 auth1 前缀), 保守判活 9min(不透明 token 无 exp 可解)。
// ═══ S3 dualstack 域国内 DNS 污染适配 ═══════════════════════════════════════════
// 实测(国内网): `*.s3.dualstack.<region>.amazonaws.com` 被解析到伪 IP → 连接黑洞,
//   附件 307 跳转后取不到字节(图片/视频/下载全断)。同桶非 dualstack 域解析正常。
//   预签名 SigV2(host 不入签)换域签名仍有效; SigV4(X-Amz-Signature, host 入签)原样放行。
function fixS3DualstackUrl(u) {
  try {
    if (u && /\.s3\.dualstack\.[a-z0-9-]+\.amazonaws\.com\//i.test(u) && !/X-Amz-Signature=/i.test(u)) {
      return u.replace(/\.s3\.dualstack\.([a-z0-9-]+)\.amazonaws\.com\//i, ".s3.$1.amazonaws.com/");
    }
  } catch {}
  return u;
}

// 附件字节·宿主代取(免浏览器直连 S3): 307 落点是 S3 预签名 URL, 浏览器直连受 CORS(无 ACAO 头)
//   与国内到 AWS 劣质路由双制约。宿主服务端跟随重定向边取边吐(同源·无 CORS), 并按 uuid 路径
//   落不变缓存(L2 磁盘) → 首取之后任何端秒开。逐块滑动空转闸: 字节在流就不掩。
const _ATT_BODY_CACHE_MAX = 16 * 1024 * 1024;
const _ATT_PROXY_PORTS = [7890, 10809, 7891, 1080, 10808, 8080, 8118];
// 直连与经本机代理(Clash/V2Ray CONNECT)双赛道齐发, 谁先出响应头谁赢(败者即毁)。
//   国内到 S3 直连时有 SYN 黑洞/龟速, 代理路反而通 — 与 genericWebProxy 并行赛道同策。
function _attRequest(su, viaProxyPort, onRes, onFail) {
  let settled = false;
  const fail = (rq) => { if (settled) return; settled = true; try { rq && rq.destroy(); } catch {} onFail(); };
  if (!viaProxyPort) {
    const rq = https.request({
      hostname: su.hostname, port: 443, path: su.pathname + su.search, method: "GET",
      headers: { "User-Agent": DEVIN_UA, Host: su.hostname }, rejectUnauthorized: false, timeout: 20000,
    }, (rs) => { if (settled) { try { rs.destroy(); } catch {} return; } settled = true; onRes(rs, () => { try { rq.destroy(); } catch {} }); });
    rq.on("timeout", () => fail(rq));
    rq.on("error", () => fail(rq));
    rq.end();
    return () => fail(rq);
  }
  const sock = net.connect({ host: "127.0.0.1", port: viaProxyPort, timeout: 3000 }, () => {
    sock.write("CONNECT " + su.hostname + ":443 HTTP/1.1\r\nHost: " + su.hostname + ":443\r\n\r\n");
  });
  let rqRef = null;
  sock.once("data", (buf) => {
    if (settled) { try { sock.destroy(); } catch {} return; }
    if (!/^HTTP\/1\.[01] 200/.test(buf.toString("utf8"))) { fail(null); try { sock.destroy(); } catch {} return; }
    const tsock = tls.connect({ socket: sock, servername: su.hostname, rejectUnauthorized: false });
    const rq = https.request({
      createConnection: () => tsock, path: su.pathname + su.search, method: "GET",
      headers: { "User-Agent": DEVIN_UA, Host: su.hostname }, timeout: 30000,
    }, (rs) => { if (settled) { try { rs.destroy(); } catch {} return; } settled = true; onRes(rs, () => { try { rq.destroy(); } catch {} try { sock.destroy(); } catch {} }); });
    rqRef = rq;
    rq.on("timeout", () => fail(rq));
    rq.on("error", () => fail(rq));
    rq.end();
  });
  sock.on("timeout", () => { fail(null); try { sock.destroy(); } catch {} });
  sock.on("error", () => fail(null));
  return () => { fail(rqRef); try { sock.destroy(); } catch {} };
}
function _streamAttachment(rawUrl, res, cacheKey, hops) {
  if (hops > 3) { try { res.writeHead(502); res.end(); } catch {} return; }
  let su;
  try { su = new URL(fixS3DualstackUrl(rawUrl)); } catch { try { res.writeHead(502); res.end(); } catch {} return; }
  let won = false, failCount = 0;
  const cancels = [];
  const tracks = 1 + _ATT_PROXY_PORTS.length;
  const onFail = () => { if (won) return; if (++failCount >= tracks) { try { res.writeHead(502); res.end(); } catch {} } };
  const onRes = (rs, destroy) => {
    if (won) { try { rs.destroy(); } catch {} return; }
    won = true;
    for (const c of cancels) { try { c(); } catch {} }
    const sc = rs.statusCode || 0;
    if (sc >= 300 && sc < 400 && rs.headers["location"]) {
      rs.resume();
      _streamAttachment(String(rs.headers["location"]), res, cacheKey, hops + 1);
      return;
    }
    const ct = rs.headers["content-type"] || "application/octet-stream";
    const hdrs = { "Content-Type": ct, "Cache-Control": "public, max-age=31536000, immutable" };
    if (rs.headers["content-length"]) hdrs["Content-Length"] = rs.headers["content-length"];
    try { res.writeHead(sc || 200, hdrs); } catch {}
    const chunks = [];
    let total = 0;
    let idle = null;
    const arm = () => { try { if (idle) clearTimeout(idle); } catch {} idle = setTimeout(() => { try { destroy(); } catch {} try { res.end(); } catch {} }, 60000); };
    arm();
    rs.on("data", (c) => { arm(); total += c.length; if (total <= _ATT_BODY_CACHE_MAX) chunks.push(c); try { res.write(c); } catch {} });
    rs.on("end", () => {
      try { if (idle) clearTimeout(idle); } catch {}
      try { res.end(); } catch {}
      if (cacheKey && sc >= 200 && sc < 300 && total > 0 && total <= _ATT_BODY_CACHE_MAX) {
        _diskPut(cacheKey, { status: 200, headers: { "Content-Type": ct, "Cache-Control": "public, max-age=31536000, immutable" }, body: Buffer.concat(chunks) }, "");
      }
    });
    rs.on("error", () => { try { if (idle) clearTimeout(idle); } catch {} try { res.end(); } catch {} });
  };
  cancels.push(_attRequest(su, 0, onRes, onFail));
  for (const p of _ATT_PROXY_PORTS) cancels.push(_attRequest(su, p, onRes, onFail));
}

const _attachCookie = new Map();      // key → { cookie, mintAt }
const _attachMintInflight = new Map(); // key → Promise (单飞防铸造风暴)
const _ATTACH_TTL = 9 * 60 * 1000;
function _attachKey(auth) { return (auth && auth.orgId) || ("a1:" + String((auth && auth.auth1) || "").slice(0, 24)); }
function _mintAttachCookie(auth) {
  return new Promise((resolve) => {
    try {
      if (!auth || !auth.auth1) return resolve("");
      const opt = {
        hostname: "app.devin.ai", port: 443, path: "/api/users/set-attachment-cookie", method: "POST",
        headers: { Authorization: "Bearer " + auth.auth1, "Content-Type": "application/json", "Content-Length": 2, "User-Agent": DEVIN_UA, Host: "app.devin.ai" },
        timeout: 15000, rejectUnauthorized: false, agent: _httpsAgent,
      };
      if (auth.orgId) opt.headers["x-cog-org-id"] = auth.orgId;
      const r = https.request(opt, (rs) => {
        let ck = "";
        const sc = rs.headers["set-cookie"] || [];
        for (const line of (Array.isArray(sc) ? sc : [sc])) {
          const m = /(?:^|;\s*)(attachments_token=[^;]+)/.exec(String(line || ""));
          if (m) ck = m[1];
        }
        rs.resume();
        resolve((rs.statusCode >= 200 && rs.statusCode < 300) ? ck : "");
      });
      r.on("error", () => resolve(""));
      r.on("timeout", () => { try { r.destroy(); } catch {} resolve(""); });
      r.end("{}");
    } catch { resolve(""); }
  });
}
async function _ensureAttachCookie(auth, force) {
  const key = _attachKey(auth);
  const hit = _attachCookie.get(key);
  if (!force && hit && hit.cookie && (Date.now() - hit.mintAt < _ATTACH_TTL)) return hit.cookie;
  if (_attachMintInflight.has(key)) return _attachMintInflight.get(key);
  const p = (async () => {
    const ck = await _mintAttachCookie(auth);
    if (ck) _attachCookie.set(key, { cookie: ck, mintAt: Date.now() });
    _attachMintInflight.delete(key);
    return ck || (hit && hit.cookie) || "";
  })();
  _attachMintInflight.set(key, p);
  return p;
}

// 帛书·「为之于其未有·治之于其未乱」— 静态资源改写结果缓存。
//   Devin SPA 的 JS/CSS/字体 bundle 皆哈希不可变, 改写结果恒定 → 缓存后多标签/重载
//   免重复取上游 + 免重复多次全量 split/join (根治"很慢很卡")。键 = 上游 path,
//   与账号无关 (静态资源各账号同一份) → 跨账号共享, 多开更省。
const _assetCache = new Map(); // targetPath → { status, headers, body }
let _assetCacheBytes = 0;
const ASSET_CACHE_MAX = 96 * 1024 * 1024; // 96MB 上限 · 满则逐出最早
function _cachePut(key, val) {
  try {
    if (_assetCache.has(key)) {
      const old = _assetCache.get(key);
      _assetCacheBytes -= old && old.body ? old.body.length : 0;
      _assetCache.delete(key);
    }
    _assetCache.set(key, val);
    _assetCacheBytes += val.body ? val.body.length : 0;
    while (_assetCacheBytes > ASSET_CACHE_MAX && _assetCache.size) {
      const k = _assetCache.keys().next().value;
      const v = _assetCache.get(k);
      _assetCache.delete(k);
      _assetCacheBytes -= v && v.body ? v.body.length : 0;
    }
  } catch {}
}
// 哈希不可变静态资源 (可强缓存 + 入改写缓存)。HTML/API/json 不在此列 (动态·须实时)。
function isCacheableAsset(p) {
  return /\.(js|css|woff2?|ttf|eot|otf|png|jpe?g|gif|svg|ico|wasm)(\?|$)/i.test(p);
}

// ═══ Service Worker · 客户端「浏览器级」持久资产缓存 (根治 IDE 内置 webview 路由慢) ═══════════
// 帛书·「天下之至柔·驰骋于天下之致坚；无有入于无间」: VS Code 内置浏览器/webview 之 iframe 不像
//   真浏览器那样把哈希不可变资产持久缓存到磁盘 → 每次导航/切标/重载都重取数百分片 (即
//   「系统浏览器/手机/单页壳 = 真浏览器 各快一倍, 唯独 IDE 内 webview 慢」之真因——同一反代,
//   差只在客户端缓存)。故由反代注入同源 Service Worker + CacheStorage: 首载落 Cache, 之后跨
//   导航/跨标/重载即取本地 Cache (零代理往返·零上游往返), 媲美真浏览器磁盘缓存。
//   仅端口模式注入 (每账号独立 origin·scope '/' 干净·资产与账号无关可共享); 前缀模式同源多账号
//   共 scope 暂不启用以免相扰 (其经公网真浏览器, 本就有原生缓存, 无需 SW)。
const _SW_PATH = "/__dao_sw.js";
const _swCode =
  "var C='dao-assets-v1';" +
  "var IM=/\\.(?:js|css|woff2?|ttf|eot|otf|png|jpe?g|gif|svg|ico|wasm)(?:\\?|$)/i;" +
  "self.addEventListener('install',function(e){self.skipWaiting();});" +
  "self.addEventListener('activate',function(e){e.waitUntil(self.clients.claim());});" +
  "self.addEventListener('fetch',function(event){" +
  "var req=event.request;" +
  "if(req.method!=='GET')return;" +
  "try{if(req.headers.get('range'))return;}catch(e){}" +
  "var url;try{url=new URL(req.url);}catch(e){return;}" +
  "if(url.origin!==self.location.origin)return;" +
  "if(!IM.test(url.pathname))return;" +
  "event.respondWith(caches.open(C).then(function(cache){return cache.match(req).then(function(hit){" +
  "if(hit)return hit;" +
  "return fetch(req).then(function(resp){if(resp&&resp.status===200){try{cache.put(req,resp.clone());}catch(e){}}return resp;});" +
  "});}).catch(function(){return fetch(req);}));" +
  "});";
// SW 注册脚本 (注入 HTML <head>·端口模式)。async 注册, 不阻塞首屏。
const _swReg =
  "<script>(function(){try{if('serviceWorker' in navigator){navigator.serviceWorker.register(" +
  JSON.stringify(_SW_PATH) + ").catch(function(){});}}catch(e){}})();</script>";

// ═══ 磁盘二级缓存 (L2) ═══════════════════════════════════════════════════════
// 帛书·「夫物芸芸·各复归其根」: 上面的内存缓存随进程消亡, IDE 重载/重开后内存全空,
//   首屏须重新取上游 + 全量改写 (即"首屏很慢很卡"之根)。故落盘一份: 重载后内存 miss →
//   从磁盘秒级恢复, 免上游往返与全量改写。键 = sha1(上游 path); 跨账号/跨进程共享。
//   注意: JS/CSS 改写体里 baked 了 localBase(含动态端口), 重载后端口可能不同 → 落盘
//   时一并记 base, 命中时若 base 变则仅对文本体做一次 split/join 重定基 (二进制资源里
//   绝不含 base 串, 直发不动以免坏字节)。
const ASSET_DISK_MAX = 256 * 1024 * 1024; // 256MB 磁盘上限 · 满则按 mtime 逐出最旧
let _diskDir = null;
let _diskEvicted = false;
function _diskCacheDir() {
  // 显式 env 覆盖 (运维/单测) 每次生效; 默认路径解析一次即缓存。
  const env = process.env.WAM_PROXY_CACHE_DIR;
  if (env) {
    try { fs.mkdirSync(env, { recursive: true }); return env; } catch { return ""; }
  }
  if (_diskDir !== null) return _diskDir;
  try {
    const d = path.join(os.homedir(), ".wam", "_proxy_asset_cache");
    fs.mkdirSync(d, { recursive: true });
    _diskDir = d;
  } catch {
    _diskDir = "";
  }
  return _diskDir;
}
function _diskKey(key) {
  return crypto.createHash("sha1").update(String(key)).digest("hex");
}
function _isTextCt(headers) {
  try {
    const ct = String((headers && (headers["Content-Type"] || headers["content-type"])) || "").toLowerCase();
    return ct.includes("javascript") || ct.includes("application/x-javascript") || ct.includes("text/css");
  } catch { return false; }
}
// 文本资源落盘时 baked 了旧 localBase(含动态端口); 命中时若端口已变则重定基。
//   仅文本体做 split/join — 二进制资源(字体/图片/wasm)里绝无 base 串, 直发不动以免坏字节。
function _rebaseAsset(body, fromBase, toBase, isText) {
  if (isText && fromBase && toBase && fromBase !== toBase) {
    return Buffer.from(body.toString("utf8").split(fromBase).join(toBase), "utf8");
  }
  return body;
}
// 落盘 (异步·尽力而为·不阻塞请求)。先写临时文件再 rename → 防半成品被读到。
function _diskPut(key, val, base) {
  try {
    const dir = _diskCacheDir();
    if (!dir || !val || !val.body) return;
    const h = _diskKey(key);
    const binPath = path.join(dir, h + ".bin");
    const metaPath = path.join(dir, h + ".json");
    const meta = { status: val.status, headers: val.headers, base: base || "", text: _isTextCt(val.headers), size: val.body.length, t: Date.now() };
    const tmpBin = binPath + ".tmp" + process.pid;
    const tmpMeta = metaPath + ".tmp" + process.pid;
    fs.writeFile(tmpBin, val.body, (e1) => {
      if (e1) { try { fs.unlink(tmpBin, () => {}); } catch {} return; }
      fs.rename(tmpBin, binPath, () => {
        fs.writeFile(tmpMeta, JSON.stringify(meta), (e2) => {
          if (e2) { try { fs.unlink(tmpMeta, () => {}); } catch {} return; }
          fs.rename(tmpMeta, metaPath, () => {});
        });
      });
    });
    if (!_diskEvicted) { _diskEvicted = true; setTimeout(_diskEvict, 2000); }
  } catch {}
}
// 读盘 (异步)。命中返回 { status, headers, body, base, text }, 否则 null。
function _diskGet(key) {
  return new Promise((resolve) => {
    try {
      const dir = _diskCacheDir();
      if (!dir) return resolve(null);
      const h = _diskKey(key);
      const binPath = path.join(dir, h + ".bin");
      const metaPath = path.join(dir, h + ".json");
      fs.readFile(metaPath, "utf8", (em, metaStr) => {
        if (em) return resolve(null);
        let meta;
        try { meta = JSON.parse(metaStr); } catch { return resolve(null); }
        fs.readFile(binPath, (eb, body) => {
          if (eb || !body) return resolve(null);
          resolve({ status: meta.status, headers: meta.headers || {}, body, base: meta.base || "", text: !!meta.text });
        });
      });
    } catch { resolve(null); }
  });
}
// 容量逐出: 累计 .bin 体积超上限则按 mtime 删最旧 (连带其 .json)。启动后延迟跑一次。
function _diskEvict() {
  try {
    const dir = _diskCacheDir();
    if (!dir) return;
    fs.readdir(dir, (er, names) => {
      if (er || !names) return;
      const bins = names.filter((n) => n.endsWith(".bin"));
      const stats = [];
      let pending = bins.length;
      let total = 0;
      if (!pending) return;
      bins.forEach((n) => {
        const p = path.join(dir, n);
        fs.stat(p, (es, st) => {
          if (!es && st) { stats.push({ p, base: n.slice(0, -4), size: st.size, mtime: st.mtimeMs }); total += st.size; }
          if (--pending === 0) {
            if (total <= ASSET_DISK_MAX) return;
            stats.sort((a, b) => a.mtime - b.mtime);
            let cur = total;
            for (const s of stats) {
              if (cur <= ASSET_DISK_MAX) break;
              try { fs.unlink(s.p, () => {}); } catch {}
              try { fs.unlink(path.join(dir, s.base + ".json"), () => {}); } catch {}
              cur -= s.size;
            }
          }
        });
      });
    });
  } catch {}
}

function safeStr(s) {
  return String(s == null ? "" : s);
}

// 取空闲本地端口。
function pickFreePort() {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.on("error", () => resolve(0));
    srv.listen(0, "127.0.0.1", () => {
      const p = srv.address() && srv.address().port;
      srv.close(() => resolve(p || 0));
    });
  });
}

// 帛书·「观天之道·执天之行」— 认证桥接脚本 (运行于 SPA 任何引导脚本之前)。
// Devin SPA 登录态唯一真源 = localStorage['auth1_session'] = {token, userId}。
// 一并注入 org 键 + post-auth 守卫键, 并拦截 fetch/XHR/EventSource 以挂 Authorization + 归一前缀。
//   rewriteBase 形如 `http://localhost:<port>`(端口模式·IDE 内置浏览器) 或 `/i/<accKey>`(同源
//   前缀模式·公网经主口 9920 隧道暴露)。前缀模式下 SPA 自构造的根绝对路径(/api、/assets…)在
//   运行时统一补 `/i/<accKey>` 前缀 → 公网手机/电脑无感同源访问该账号页。
function buildAuthBridge(rewriteBase, auth) {
  const a1 = safeStr(auth.auth1);
  const uid = safeStr(auth.userId);
  const org = safeStr(auth.orgId);
  // org_name 源自 Devin post-auth 响应; 仍剥引号/反斜杠/尖括号 → 杜绝 </script> 闭合逃逸。
  const orgName = safeStr(auth.orgName).replace(/['"\\<>]/g, "");
  const isPrefix = String(rewriteBase).charAt(0) === "/";
  const pfx = isPrefix ? String(rewriteBase) : "";
  const J = JSON.stringify;
  // 帛书·「万物并作·各归其根」— 前缀模式多实例隔离: 同源前缀下所有账号 iframe 共用同一 origin,
  //   localStorage 本会互相覆盖(auth1_session 串号)。故按 accKey 给本 iframe 的 localStorage 键
  //   加私有命名空间前缀 (get/set/remove/clear 全包) → 各账号读写各自键空间, 同源亦完全隔离。
  //   端口模式各账号本就异 origin, 无需此 shim (不注入·零回归)。
  const nsShim = isPrefix
    ? ("try{(function(){var L=window.localStorage;var P=" + J(pfx + "::") + ";" +
       "var og=L.getItem.bind(L),os=L.setItem.bind(L),orm=L.removeItem.bind(L);" +
       "L.getItem=function(k){return og(P+k);};" +
       "L.setItem=function(k,v){return os(P+k,v);};" +
       "L.removeItem=function(k){return orm(P+k);};" +
       "L.clear=function(){try{var ks=[],i;for(i=0;i<L.length;i++){var kk=L.key(i);if(kk&&kk.indexOf(P)===0)ks.push(kk);}for(i=0;i<ks.length;i++)orm(ks[i]);}catch(e){}};" +
       "})();}catch(e){}")
    : "";
  return (
    "<script>(function(){try{" +
    nsShim +
    "var __a1=" + J(a1) + ";var __uid=" + J(uid) + ";var __org=" + J(org) + ";var __orgName=" + J(orgName) + ";" +
    "if(__a1){" +
    "localStorage.setItem('auth1_session',JSON.stringify({token:__a1,userId:__uid}));" +
    "localStorage.setItem('migrated-to-unscoped-auth0-token-2025-12-18','true');" +
    "if(__uid)localStorage.setItem('known-org-ids-'+__uid,JSON.stringify([__org]));" +
    "if(__org)localStorage.setItem('last-internal-org-for-external-org-v1-null',__org);" +
    "if(__org&&__uid&&__orgName){var __k='post-auth-v3-null-'+__uid+'-org_name-'+__orgName;" +
    "if(!localStorage.getItem(__k))localStorage.setItem(__k,JSON.stringify({externalOrgId:null,userId:__uid,internalOrgId:__org,orgName:__orgName,result:{resolved_external_org_id:null,org_id:__org,org_name:__orgName,is_valid_resource:true}}));}" +
    "}" +
    "document.cookie='webapp_logged_in=true; path=/; max-age=31536000; SameSite=Lax';" +
    "var __base=" + J(String(rewriteBase)) + ";var __pfx=" + J(pfx) + ";var __abs='https://app.devin.ai';" +
    // __pf: 统一把请求 URL 规整到本代理可达地址 —— app.devin.ai 绝对 URL 改指 __pfx(前缀模式)
    //   或剥成同源相对(端口模式); 前缀模式下再把 SPA 自构造的根绝对路径(/api、/assets…)补 __pfx。
    "var __pf=function(u){if(typeof u!=='string')return u;" +
    "u=u.split(__abs).join(__pfx);" +
    "if(__pfx&&u.charAt(0)==='/'&&u.charAt(1)!=='/'&&u!==__pfx&&u.indexOf(__pfx+'/')!==0){u=__pfx+u;}" +
    "return u;};" +
    // 运行时兜底: 拦截动态构造的绝对 app.devin.ai 整页跳转(assign/replace/history)→ 改指本代理,
    //   防 SPA 漏改字面量时仍硬跳真站致掉登录(JS/HTML 静态改写之外的双保险)。
    "var __fix=function(u){return (typeof u==='string')?u.split(__abs).join(__base):u;};" +
    "try{var _la=window.location.assign.bind(window.location);window.location.assign=function(u){return _la(__fix(u));};}catch(e){}" +
    "try{var _lr=window.location.replace.bind(window.location);window.location.replace=function(u){return _lr(__fix(u));};}catch(e){}" +
    "try{var _ps=history.pushState;history.pushState=function(s,t,u){return _ps.call(history,s,t,__fix(u));};}catch(e){}" +
    "try{var _rs=history.replaceState;history.replaceState=function(s,t,u){return _rs.call(history,s,t,__fix(u));};}catch(e){}" +
    "var needAuth=function(u){return typeof u==='string'&&(u.charAt(0)==='/'||u.indexOf(__base)===0);};" +
    "var oF=window.fetch;" +
    "window.fetch=function(u,o){if(typeof u!=='string')return oF.call(this,u,o);" +
    "var nu=__pf(u);o=o||{};" +
    "if(needAuth(nu)&&typeof o.headers==='object'&&o.headers&&!Array.isArray(o.headers)){" +
    "if(!o.headers['Authorization'])o.headers['Authorization']='Bearer '+__a1;" +
    "if(!o.headers['x-cog-org-id'])o.headers['x-cog-org-id']=__org;}" +
    "return oF.call(this,nu,o);};" +
    "var oX=XMLHttpRequest.prototype.open;" +
    "XMLHttpRequest.prototype.open=function(m,u){var nu=(typeof u==='string')?__pf(u):u;" +
    "var r=oX.apply(this,[m,nu].concat([].slice.call(arguments,2)));" +
    "if(needAuth(nu)){try{this.setRequestHeader('Authorization','Bearer '+__a1);this.setRequestHeader('x-cog-org-id',__org);}catch(e){}}return r;};" +
    // EventSource(Devin 对话实时事件) 前缀模式下亦须补 __pfx, 否则公网 SSE 打到错账号/根域。
    "try{var _ES=window.EventSource;if(_ES){var nES=function(u,o){return new _ES(__pf(u),o);};nES.prototype=_ES.prototype;try{nES.CONNECTING=_ES.CONNECTING;nES.OPEN=_ES.OPEN;nES.CLOSED=_ES.CLOSED;}catch(e){}window.EventSource=nES;}}catch(e){}" +
    // 对话导航/标题上报(对齐手机 APK 标签追踪): 本页在 iframe 内挂载时, SPA 路由变化与
    //   document.title 变化经 postMessage 上报父窗(__daoConvNav) —— 跨域 iframe(IDE webview 内
    //   localhost 反代)父窗无法读 contentWindow.location, 唯此通道能把「当前打开的对话」告知外层页签。
    "try{if(window.parent&&window.parent!==window){var __lastNav='';" +
    "var __navRe=/\\/sessions\\/(?:devin-)?([A-Za-z0-9_-]+)/;" +
    "var __navRep=function(){try{var p=location.pathname||'';var mm=p.match(__navRe);var sid=(mm&&mm[1])||'';" +
    "var tt=String(document.title||'').replace(/\\s*[|·-]\\s*(Devin|Cognition).*$/i,'').trim();" +
    "var k=sid+'|'+p+'|'+tt;if(k===__lastNav)return;__lastNav=k;" +
    "window.parent.postMessage({__daoConvNav:{sid:sid,path:p,title:tt}},'*');}catch(e){}};" +
    "try{var _ps2=history.pushState;history.pushState=function(){var r=_ps2.apply(history,arguments);setTimeout(__navRep,50);return r;};}catch(e){}" +
    "try{var _rs2=history.replaceState;history.replaceState=function(){var r=_rs2.apply(history,arguments);setTimeout(__navRep,50);return r;};}catch(e){}" +
    "try{window.addEventListener('popstate',function(){setTimeout(__navRep,50);});}catch(e){}" +
    "try{setInterval(__navRep,2000);}catch(e){}" +
    "setTimeout(__navRep,300);}}catch(e){}" +
    "}catch(e){}})();</script>"
  );
}

// 路径前缀 → 上游源站映射 (跨域认证资源经各自前缀透传)。
function resolveUpstream(pathname) {
  if (pathname.startsWith("/__ws/")) return { base: DEVIN_WS, path: pathname.slice(5) };
  if (pathname.startsWith("/__reg/")) return { base: DEVIN_REG, path: pathname.slice(6) };
  if (pathname.startsWith("/__cdn/")) return { base: DEVIN_CDN, path: pathname.slice(6) };
  if (pathname.startsWith("/__ss/")) return { base: DEVIN_SS, path: pathname.slice(5) };
  return { base: DEVIN_APP, path: pathname };
}

// ═══ WebSocket 升级反代 · 实时会话事件通道 (根治「断联」) ════════════════════════
// 帛书·「无有入于无间」: Devin SPA 以同源 WS 收发实时事件
//   (new URL('/api/events/<id>/live?token=..', location.origin.replace('http','ws')))。
//   页面经本端口反代挂载时 location.origin = localhost:<port> → WS 落到本 http.Server。
//   Node http.Server 默认不处理 upgrade → 握手被丢弃 → socketConnected 永假 →
//   多实例网页「只首屏 HTTP 能过, 之后断联·发不出·收不到」。此处补端到端透明 WS 反代
//   (与 dao-vsix 主口 daoProxyWsUpgrade 同法·自足零依赖)。
function handleUpgrade(req, clientSocket, head, auth, log) {
  let done = false, connected = false;
  const bail = () => { if (done) return; done = true; try { clientSocket.destroy(); } catch {} };
  try {
    clientSocket.on("error", bail);
    try { clientSocket.setNoDelay(true); } catch {}
    try { clientSocket.setTimeout(0); } catch {}
    const reqUrl = new URL(req.url || "/", "http://dao.local");
    const up = resolveUpstream(reqUrl.pathname);
    const host = new URL(up.base).hostname;
    const wsPath = up.path + (reqUrl.search || "");
    const h = req.headers || {};
    // token 已内嵌于 WS URL query(SPA getAccessToken 返回本账号令牌); 另注入 Bearer/Cookie 兜底。
    const qToken = reqUrl.searchParams.get("token") || "";
    const qOrg = reqUrl.searchParams.get("org_id") || "";
    const a1 = qToken || (auth && auth.auth1) || "";
    const org = qOrg || (auth && auth.orgId) || "";
    const onUpstream = (upstream) => {
      connected = true;
      const lines = [
        "GET " + wsPath + " HTTP/1.1",
        "Host: " + host,
        "Connection: Upgrade",
        "Upgrade: " + (h["upgrade"] || "websocket"),
        "Sec-WebSocket-Version: " + (h["sec-websocket-version"] || "13"),
      ];
      if (h["sec-websocket-key"]) lines.push("Sec-WebSocket-Key: " + h["sec-websocket-key"]);
      if (h["sec-websocket-protocol"]) lines.push("Sec-WebSocket-Protocol: " + h["sec-websocket-protocol"]);
      if (h["sec-websocket-extensions"]) lines.push("Sec-WebSocket-Extensions: " + h["sec-websocket-extensions"]);
      lines.push("Origin: https://" + host);
      lines.push("User-Agent: " + DEVIN_UA);
      if (a1) {
        lines.push("Authorization: Bearer " + a1);
        if (org) lines.push("x-cog-org-id: " + org);
        const ck = ["auth1_token=" + a1];
        if (org) ck.push("org_id=" + org);
        lines.push("Cookie: " + ck.join("; "));
      }
      lines.push("", "");
      try { upstream.write(lines.join("\r\n")); } catch { bail(); return; }
      if (head && head.length) { try { upstream.write(head); } catch {} }
      // 裸字节双向管道: 上游 101 握手回放 + 之后所有帧透传(不解析·不改写)
      upstream.pipe(clientSocket);
      clientSocket.pipe(upstream);
      upstream.on("error", bail);
      upstream.on("close", bail);
      clientSocket.on("close", () => { try { upstream.destroy(); } catch {} });
    };
    const direct = tls.connect({ host, port: 443, servername: host, rejectUnauthorized: false, ALPNProtocols: ["http/1.1"] }, () => onUpstream(direct));
    direct.once("error", () => { if (!connected) bail(); });
    direct.setTimeout(20000, () => { if (!connected) { try { direct.destroy(); } catch {} bail(); } });
  } catch (e) {
    if (log) try { log("[proxy] ws upgrade error " + (e && e.message)); } catch {}
    bail();
  }
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (d) => chunks.push(d));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", () => resolve(Buffer.alloc(0)));
  });
}

function decode(buf, enc) {
  return new Promise((resolve) => {
    if (enc === "gzip") zlib.gunzip(buf, (e, b) => resolve(e ? buf : b));
    else if (enc === "br") zlib.brotliDecompress(buf, (e, b) => resolve(e ? buf : b));
    else if (enc === "deflate") zlib.inflate(buf, (e, b) => resolve(e ? buf : b));
    else resolve(buf);
  });
}

// ═══ 资源图预热 (prewarm) ════════════════════════════════════════════════════
// 帛书·「为之于其未有·治之于其未乱」: IDE webview 首屏慢之真因 = SPA 模块图按依赖逐层
//   向反代索取分片, 冷态每层皆一次上游往返 → 瀑布式串行累加 (实测冷首屏 DCL ~2s+)。
//   而全部 ~480 分片并行取上游仅 ~150ms; 缓存预热后首屏 DCL ~0.5s (反超系统浏览器直连)。
//   故反代一启动即后台并行抓全模块图入缓存 (L1+L2): 浏览器随后索取皆命中内存 → 瀑布塌缩。
//   缓存键与账号无关·跨实例共享 → 首个实例预热, 其余多实例直接秒开 (正中"IDE 多实例慢于
//   浏览器"之的)。换版 (入口分片哈希变) 自动重热; 失败守柔, 不阻正常反代。
const _ASSET_RE = /\/assets\/[A-Za-z0-9_\-.]+\.(?:js|css)/g;
let _prewarmKey = "";              // 已预热版本键 (入口分片名)
let _prewarmCritical = "";         // 首屏关键路径已暖的版本键 (先于全图完成)
const _prewarmActive = new Set();  // 正在预热的版本键 → 防重复并发

function _fetchUp(targetPath, auth) {
  return new Promise((resolve) => {
    let u; try { u = new URL(DEVIN_APP + targetPath); } catch { return resolve(null); }
    const headers = { "User-Agent": DEVIN_UA, Accept: "*/*", Host: u.hostname, "Accept-Encoding": "gzip", Origin: DEVIN_APP, Referer: DEVIN_APP + "/" };
    if (auth && auth.auth1) headers["Authorization"] = "Bearer " + auth.auth1;
    if (auth && auth.orgId) headers["x-cog-org-id"] = auth.orgId;
    const r = https.request({ hostname: u.hostname, port: 443, path: targetPath, method: "GET", headers, timeout: 20000, rejectUnauthorized: false, agent: _httpsAgent }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", async () => {
        const body = await decode(Buffer.concat(chunks), (res.headers["content-encoding"] || "").toLowerCase());
        resolve({ status: res.statusCode || 0, ct: res.headers["content-type"] || "", body });
      });
    });
    r.on("error", () => resolve(null));
    r.on("timeout", () => { try { r.destroy(); } catch {} resolve(null); });
    r.end();
  });
}

// 与 handleRequest 的 JS/CSS 改写逐字一致 (源站绝对 URL → 本地基址)。
function _rewriteAssetBody(body, ct, localBase) {
  const isJs = ct.includes("javascript") || ct.includes("application/x-javascript");
  const isCss = ct.includes("text/css");
  if (!isJs && !isCss) return body;
  const txt = body.toString("utf8");
  if (isJs) {
    if (txt.indexOf("https://app.devin.ai") < 0 && txt.indexOf("https://windsurf.com/") < 0 &&
        txt.indexOf("https://register.windsurf.com/") < 0 && txt.indexOf("https://server.codeium.com/") < 0 &&
        txt.indexOf("https://server.self-serve.windsurf.com/") < 0) return body;
    return Buffer.from(txt.split("https://app.devin.ai").join(localBase)
      .split("https://windsurf.com/").join(localBase + "/__ws/")
      .split("https://register.windsurf.com/").join(localBase + "/__reg/")
      .split("https://server.codeium.com/").join(localBase + "/__cdn/")
      .split("https://server.self-serve.windsurf.com/").join(localBase + "/__ss/"), "utf8");
  }
  if (txt.indexOf("https://app.devin.ai/") < 0) return body;
  return Buffer.from(txt.split("https://app.devin.ai/").join(localBase + "/"), "utf8");
}

// 帛书·「水善利万物而有静」: 有界并发「工作池」— N 个工人持续从队列取活, 一件完成立刻取下一件,
//   消除「分批栅栏」(旧法每批 Promise.all 须等最慢者才开下一批)的尾部阻塞。同等并发下持续满载,
//   墙钟更短 → 真机 44s 全图预热进一步塌缩。结果按入参序回填 (深层分片发现仍据 JS 体扫描)。
function _drainPool(items, conc, worker) {
  return new Promise((resolve) => {
    const n = items.length;
    if (!n) return resolve([]);
    const results = new Array(n);
    let idx = 0, done = 0, active = 0;
    const pump = () => {
      while (active < conc && idx < n) {
        const i = idx++; active++;
        Promise.resolve(worker(items[i], i)).then(
          (r) => { results[i] = r; },
          () => { results[i] = undefined; },
        ).then(() => {
          active--; done++;
          if (done === n) resolve(results); else pump();
        });
      }
    };
    pump();
  });
}

// 后台预热 SPA 全模块图入缓存。BFS: index.html → 抓引用分片 → 扫分片再发现深层分片。
async function _prewarmGraph(localBase, auth, log) {
  try {
    const idx = await _fetchUp("/", auth);
    if (!idx || idx.status !== 200) return;
    const html = idx.body.toString("utf8");
    const key = ((html.match(/\/assets\/index-[A-Za-z0-9_\-.]+\.js/) || [])[0]) || String(html.length);
    if (_prewarmKey === key || _prewarmActive.has(key)) return; // 已热/在热 → 守静
    _prewarmActive.add(key);
    const t0 = Date.now();
    const seen = new Set();
    let queue = [];
    let m; while ((m = _ASSET_RE.exec(html))) { if (!seen.has(m[0])) { seen.add(m[0]); queue.push(m[0]); } }
    let rounds = 0, fetched = 0;
    const CONC = 48, MAX = 2000;
    const _warmOne = async (p) => {
      if (_assetCache.get(p)) return null;
      const r = await _fetchUp(p, auth);
      if (!r || r.status !== 200) return null;
      const out = _rewriteAssetBody(r.body, r.ct, localBase);
      const hdrs = { "Content-Type": r.ct || "application/octet-stream", "Cache-Control": "public, max-age=31536000, immutable", "Access-Control-Allow-Origin": "*" };
      const ce = { status: 200, headers: hdrs, body: out, base: localBase };
      _cachePut(p, ce); _diskPut(p, ce, localBase); fetched++;
      return r.ct.includes("javascript") ? out.toString("utf8") : "";
    };
    // 帛书·「为之于其未有, 治之于其未乱」: 先以最高优先级灌入口关键路径(index 直引的入口分片+CSS+
    //   modulepreload), 此即首屏所需集。其余深层 dynamic-import 分片走后台续抓。令"新账号首开"只等
    //   首屏几片, 不等全图(根治冷窗口: 全图抓取虽数十秒, 首屏集秒级即暖, 跨账号共享缓存即时命中)。
    //   工作池持续满载 (非分批栅栏) → 尾部不再阻塞下一批, 同等并发墙钟更短。
    const critical = queue.slice();
    const ct0 = Date.now();
    await _drainPool(critical, CONC, _warmOne);
    _prewarmCritical = key; // 首屏集已暖 → 首开新账号即时命中, 无需等全图
    if (log) try { log("[proxy] critical-path warm: " + critical.length + " assets in " + (Date.now() - ct0) + "ms"); } catch {}
    while (queue.length && rounds++ < 6 && seen.size < MAX) {
      const next = [];
      const got = await _drainPool(queue, CONC, _warmOne);
      for (const txt of got) {
        if (!txt) continue;
        const re = new RegExp(_ASSET_RE.source, "g");
        let mm; while ((mm = re.exec(txt))) { if (!seen.has(mm[0])) { seen.add(mm[0]); next.push(mm[0]); } }
      }
      queue = next;
    }
    _prewarmKey = key;
    _prewarmActive.delete(key);
    if (log) try { log("[proxy] prewarm done: " + fetched + " assets in " + (Date.now() - t0) + "ms"); } catch {}
  } catch { _prewarmActive.delete(""); /* 守柔: 预热失败不阻正常反代 */ }
}

// 单账号请求处理: 取上游 → 剥安全头 → HTML 注入登录态 / JS 改写绝对 URL / 其余透传。
//   两种调用形态 (道并行而不相悖):
//     · 端口模式 (旧·IDE 内置浏览器): handleRequest(req,res,auth,port,log) → 改写基址 = http://localhost:<port>
//     · 前缀模式 (新·公网经主口 9920 隧道): handleRequest(req,res,auth,{rewriteBase:'/i/<accKey>',parsePath,log})
//       → 改写基址 = 同源相对前缀, 公网手机/电脑浏览器无感同源访问该账号页。
async function handleRequest(req, res, auth, opts, _log) {
  let rewriteBase, parsePath, log;
  if (opts && typeof opts === "object") {
    rewriteBase = String(opts.rewriteBase || "");
    parsePath = opts.parsePath != null ? opts.parsePath : (req.url || "/");
    log = opts.log;
  } else {
    rewriteBase = "http://localhost:" + opts; // opts = port (旧签名)
    parsePath = req.url || "/";
    log = _log;
  }
  const localBase = rewriteBase; // 下游沿用 localBase 命名 = 改写基址
  const isPrefix = localBase.charAt(0) === "/"; // 同源前缀模式 (/i/<accKey>)
  const parseBase = isPrefix ? "http://dao.local" : localBase; // new URL() 仅需可解析的绝对基址
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, x-cog-org-id");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const reqUrl = new URL(parsePath || "/", parseBase);
  // 拖拽上传桥 (同源直服本反代端口 → 对齐 /i/ 同源页·根治 IDE 内拖拽无反应)。
  if (_bridgeServe) {
    const bp = reqUrl.pathname;
    if (bp === "/__daobridge.js" || bp === "/__dlfile" || bp === "/__convmd" || bp === "/__convguide" || bp === "/__convinfo" || bp === "/__convzip") {
      try {
        const out = await _bridgeServe(bp, reqUrl);
        if (out) {
          const h = Object.assign({ "Content-Type": out.contentType || "application/octet-stream", "Access-Control-Allow-Origin": "*" }, out.headers || {});
          res.writeHead(out.status || 200, h);
          res.end(out.binary ? Buffer.from(String(out.body || ""), "base64") : (out.body || ""));
          return;
        }
      } catch (e) { /* 守柔: 桥失败不阻断正常反代 */ }
      res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" }); res.end("bridge error"); return;
    }
  }
  // Service Worker 脚本就地服务 (端口模式·同源 scope '/')。须先于上游路由短路返回。
  if (!isPrefix && reqUrl.pathname === _SW_PATH) {
    res.writeHead(200, {
      "Content-Type": "application/javascript; charset=utf-8",
      "Service-Worker-Allowed": "/",
      "Cache-Control": "no-cache",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(_swCode);
    return;
  }

  const up = resolveUpstream(reqUrl.pathname);
  const targetUrl = up.base + up.path + (reqUrl.search || "");
  const u = new URL(targetUrl);
  const targetPath = u.pathname + (u.search || "");

  const isPage = !targetPath.match(/\.(js|css|png|jpg|jpeg|svg|ico|woff2?|ttf|eot|map|json|wasm)(\?|$)/i);

  // 改写缓存命中 → 直发, 免上游往返 + 免全量改写 (多标签/重载秒开)。
  const cacheable = (req.method === "GET" || !req.method) && isCacheableAsset(targetPath);
  if (cacheable) {
    const hit = _assetCache.get(targetPath);
    if (hit) {
      // 缓存键与账号无关 (静态资源各账号同份), 但 baked 了改写基址(端口/前缀) → 命中时按当前基址重定基。
      const body = (hit.base && hit.base !== localBase)
        ? _rebaseAsset(hit.body, hit.base, localBase, _isTextCt(hit.headers))
        : hit.body;
      _forceKeepAlive(res);
      res.writeHead(hit.status, _keepAliveHeaders(hit.headers));
      res.end(body);
      return;
    }
    // L2: 内存未命中 → 查磁盘 (重载/重开后秒级恢复, 免上游往返与全量改写)。
    const disk = await _diskGet(targetPath);
    if (disk) {
      const body = _rebaseAsset(disk.body, disk.base, localBase, disk.text);
      _cachePut(targetPath, { status: disk.status, headers: disk.headers, body, base: localBase }); // 提升入内存
      _forceKeepAlive(res);
      res.writeHead(disk.status, _keepAliveHeaders(disk.headers));
      res.end(body);
      return;
    }
  }

  // 附件不变(uuid 键) → L2 磁盘缓存命中即直发(免上游 + 免 S3)。键不含 query。
  const _attCacheKey = "att|" + u.pathname;
  if ((req.method === "GET" || !req.method) && /\/attachments\//i.test(targetPath)) {
    const attHit = await _diskGet(_attCacheKey);
    if (attHit) {
      res.writeHead(attHit.status, attHit.headers);
      res.end(attHit.body);
      return;
    }
  }

  let reqBody = Buffer.alloc(0);
  if (req.method && req.method !== "GET" && req.method !== "HEAD") {
    reqBody = await readBody(req);
  }

  // 帛书·「无有入于无间」— 附件/媒体/下载须原生流式(对照手机 APK Range 修法): 附件路径或带 Range 的
  //   媒体请求, 上游必以 identity 编码回字节(gzip+Range 语义相冲), 并把客户端 Range 透传上游, 换回
  //   206 分段 → <video> 可 seek、大文件下载可断点/边下边存。非流式请求保持 gzip 省带宽。
  const _clientRange = (req.headers && (req.headers["range"] || req.headers["Range"])) || "";
  const _isAttachPath = /\/attachments\//i.test(targetPath);
  const _wantStream = !!_clientRange || _isAttachPath;
  const fwdHeaders = {
    "User-Agent": DEVIN_UA,
    Accept: (req.headers && req.headers["accept"]) || "*/*",
    Host: u.hostname,
    "Accept-Encoding": _wantStream ? "identity" : "gzip",
    Origin: up.base,
    Referer: up.base + "/",
  };
  if (_clientRange) fwdHeaders["Range"] = _clientRange;
  if (req.headers && req.headers["content-type"] && reqBody.length) {
    fwdHeaders["Content-Type"] = req.headers["content-type"];
    fwdHeaders["Content-Length"] = Buffer.byteLength(reqBody).toString();
  }
  // 客户端拦截器可能已挂 Authorization; 透传之, 否则服务端补该账号 auth1。
  const clientAuth = req.headers && req.headers["authorization"];
  if (clientAuth) fwdHeaders["Authorization"] = clientAuth;
  else if (auth.auth1) fwdHeaders["Authorization"] = "Bearer " + auth.auth1;
  if (auth.orgId) fwdHeaders["x-cog-org-id"] = auth.orgId;

  const fire = async (isRetry) => {
  // 附件路径: 代铸并转发 attachments_token Cookie (Bearer 对 /attachments/ 无效)。
  if (_isAttachPath) {
    const _ck = await _ensureAttachCookie(auth, !!isRetry);
    if (_ck) fwdHeaders["Cookie"] = _ck;
  }
  const proxyReq = https.request(
    {
      hostname: u.hostname,
      port: 443,
      path: targetPath,
      method: req.method || "GET",
      headers: fwdHeaders,
      timeout: 20000,
      rejectUnauthorized: false,
      agent: _httpsAgent,
    },
    (proxyRes) => {
      const status = proxyRes.statusCode || 200;
      const ct = proxyRes.headers["content-type"] || "";
      const enc = (proxyRes.headers["content-encoding"] || "").toLowerCase();

      // 3xx 重定向 → 改写 Location 指回本地代理。
      if (status >= 300 && status < 400) {
        let loc = proxyRes.headers["location"] || "";
        // 附件 307 落点 S3 → 宿主代取边流边吐 + 落不变缓存(免浏览器直连 S3)。
        if (_isAttachPath && loc && /\.amazonaws\.com\//i.test(loc) && (req.method === "GET" || !req.method)) {
          proxyRes.resume();
          _streamAttachment(loc, res, _attCacheKey, 0);
          return;
        }
        if (loc) {
          loc = fixS3DualstackUrl(loc)
            .split(DEVIN_APP).join(localBase)
            .split(DEVIN_WS + "/").join(localBase + "/__ws/")
            .split(DEVIN_REG + "/").join(localBase + "/__reg/")
            .split(DEVIN_CDN + "/").join(localBase + "/__cdn/")
            .split(DEVIN_SS + "/").join(localBase + "/__ss/");
          // 前缀模式: 上游下发的根绝对 Location(/login …)须补前缀, 否则公网浏览器跳到根域(脱离本账号)。
          if (isPrefix && loc.charAt(0) === "/" && loc.charAt(1) !== "/" && loc.indexOf(localBase + "/") !== 0 && loc !== localBase) {
            loc = localBase + loc;
          }
        }
        res.writeHead(status, loc ? { Location: loc } : {});
        res.end();
        proxyRes.resume();
        return;
      }

      // 安全头剥离 — 反代核心: 去 X-Frame-Options/CSP 方可嵌入 IDE iframe。
      //   并剥逐跳头 (RFC 7230 §6.1): 上游 CloudFront 对静态资源回 `Connection: close`,
      //   若原样透传给 webview 则每个资源响应后即拆 TCP → 多实例首开数百分片各自重握手,
      //   正是「IDE 内多实例慢于浏览器」之剩余税。剥之并显式置 keep-alive → 客户端复用 socket。
      const safeHeaders = {};
      for (const k of Object.keys(proxyRes.headers)) {
        const kl = k.toLowerCase();
        if (
          kl === "x-frame-options" ||
          kl === "content-security-policy" ||
          kl === "content-security-policy-report-only" ||
          kl === "permissions-policy" ||
          kl === "feature-policy" ||
          kl === "strict-transport-security" ||
          kl === "x-content-type-options" ||
          kl === "content-encoding" ||
          kl === "content-length" ||
          kl === "transfer-encoding" ||
          kl === "connection" ||
          kl === "keep-alive" ||
          kl === "proxy-connection" ||
          kl === "proxy-authenticate" ||
          kl === "proxy-authorization" ||
          kl === "te" ||
          kl === "trailer" ||
          kl === "upgrade"
        )
          continue;
        safeHeaders[k] = proxyRes.headers[k];
      }
      safeHeaders["Connection"] = "keep-alive";
      safeHeaders["X-Dao-Ka"] = "v498u";
      _forceKeepAlive(res);

      // SSE 流式直通 (Devin Cloud 会话实时事件不可缓冲)。
      if (ct.includes("text/event-stream") && !res.headersSent) {
        const sh = {};
        for (const k of Object.keys(safeHeaders)) {
          if (["content-type", "cache-control", "connection"].includes(k.toLowerCase())) continue;
          sh[k] = safeHeaders[k];
        }
        sh["Content-Type"] = ct || "text/event-stream";
        sh["Cache-Control"] = "no-cache, no-transform";
        sh["Connection"] = "keep-alive";
        sh["X-Accel-Buffering"] = "no";
        try { proxyReq.setTimeout(0); } catch {}
        res.writeHead(status, sh);
        let src = proxyRes;
        if (enc === "gzip") src = proxyRes.pipe(zlib.createGunzip());
        else if (enc === "deflate") src = proxyRes.pipe(zlib.createInflate());
        else if (enc === "br") src = proxyRes.pipe(zlib.createBrotliDecompress());
        src.on("data", (c) => { try { res.write(c); } catch {} });
        const endS = () => { try { res.end(); } catch {} };
        src.on("end", endS);
        src.on("error", endS);
        res.on("close", () => { try { proxyReq.destroy(); } catch {} });
        return;
      }

      // ═══ 原生流式直通 (附件/媒体/下载·对齐真浏览器) ═══════════════════════════════
      // 帛书·「大成若缺·其用不敝」: 图片/视频/PDF/任意下载附件与 206 分段响应, 不缓冲整体亦不改写 —
      //   直接把上游字节流管道给客户端, 完整保留 Content-Length / Content-Range / Accept-Ranges /
      //   Content-Disposition。此前一律 chunks 缓冲 + 全量 Buffer.concat: 视频无 206→FFmpeg 无法 seek
      //   (播不了), 大文件全灌内存 (下载/文档卡死或 OOM)。流式后与用户原生浏览器行为一致。
      const _cd = String(proxyRes.headers["content-disposition"] || "");
      const _clen = parseInt(proxyRes.headers["content-length"] || "0", 10) || 0;
      const _isMediaCt = /^(video|audio|image)\//i.test(ct) || ct.includes("application/pdf") || ct.includes("application/octet-stream") || ct.includes("application/zip");
      // 注: cacheable(哈希不可变 /assets 静态资源)不走流式 — 仍入 L1/L2 缓存提速多实例。
      const _streamPass = !res.headersSent && !cacheable && status < 400 && (
        status === 206 || !!_clientRange || _isAttachPath || /attachment/i.test(_cd) || _isMediaCt ||
        (_clen > 4 * 1024 * 1024 && !ct.includes("text/") && !ct.includes("json") && !ct.includes("javascript"))
      );
      if (_streamPass) {
        const ph = {};
        for (const k of Object.keys(proxyRes.headers)) {
          const kl = k.toLowerCase();
          if (kl === "x-frame-options" || kl === "content-security-policy" || kl === "content-security-policy-report-only" ||
              kl === "permissions-policy" || kl === "feature-policy" ||
              kl === "strict-transport-security" || kl === "connection" || kl === "keep-alive" || kl === "proxy-connection" ||
              kl === "proxy-authenticate" || kl === "proxy-authorization" || kl === "te" || kl === "trailer" ||
              kl === "transfer-encoding" || kl === "upgrade") continue;
          ph[k] = proxyRes.headers[k];
        }
        if (!ph["Accept-Ranges"] && !ph["accept-ranges"]) ph["Accept-Ranges"] = "bytes";
        ph["Connection"] = "keep-alive";
        _forceKeepAlive(res);
        try { proxyReq.setTimeout(0); } catch {}
        res.writeHead(status, ph);
        proxyRes.on("data", (c) => { try { res.write(c); } catch {} });
        proxyRes.on("end", () => { try { res.end(); } catch {} });
        proxyRes.on("error", () => { try { res.end(); } catch {} });
        res.on("close", () => { try { proxyReq.destroy(); } catch {} });
        return;
      }

      const chunks = [];
      proxyRes.on("data", (c) => chunks.push(c));
      proxyRes.on("end", async () => {
        // 附件 401/403: Cookie 缺失/过期 → 作废重铸并重试一次 (自愈), 头未发才可重试。
        if (_isAttachPath && (status === 401 || status === 403) && !isRetry && !res.headersSent) {
          _attachCookie.delete(_attachKey(auth));
          try { return void fire(true); } catch {}
        }
        const raw = Buffer.concat(chunks);
        const body = await decode(raw, enc);
        const isHtml = ct.includes("text/html");
        const isJs = ct.includes("javascript") || ct.includes("application/x-javascript");

        if (isHtml && isPage) {
          let html = body.toString("utf8");
          // 帛书·「大制不割」: 整源站前缀(任意结尾字符·含单/双引号/反引号/路径)统一改写,
          //   杜绝单引号 'https://app.devin.ai' 这类绝对 URL 漏改 → SPA 硬跳真站致掉登录。
          //   桥接脚本在本段之后再注入, 故其内置的 app.devin.ai 前缀剥离逻辑不受影响。
          html = html
            .split("https://app.devin.ai").join(localBase)
            .split("https://windsurf.com/").join(localBase + "/__ws/")
            .split("https://register.windsurf.com/").join(localBase + "/__reg/")
            .split("https://server.codeium.com/").join(localBase + "/__cdn/")
            .split("https://server.self-serve.windsurf.com/").join(localBase + "/__ss/");
          // 前缀模式: SPA 入口 index.html 以根绝对引用入口/预载资源(href="/assets/…" · src="/…")。
          //   根绝对路径不随 iframe 文档 base 解析 → 须显式补 /i/<accKey> 前缀, SPA 方能在前缀下启动;
          //   后续 Vite 分片以模块自身 URL 相对解析, 自然留在前缀内。
          if (isPrefix) {
            html = html.replace(/(\s(?:href|src|action)\s*=\s*)(["'])\/(?!\/)/gi, "$1$2" + localBase + "/");
          }
          const bridge = buildAuthBridge(localBase, auth);
          // 认证桥接须先于 SPA 任何引导脚本 → 注入 <head> 起始 (紧随 charset meta)。
          if (/<head[^>]*>/i.test(html)) html = html.replace(/(<head[^>]*>)/i, "$1" + bridge);
          else if (/<\/head>/i.test(html)) html = html.replace(/<\/head>/i, bridge + "</head>");
          else html = bridge + html;
          // Service Worker 注册 (端口模式·IDE webview 提速): 同源注册 → 该 origin 所有标签/导航共享 Cache。
          if (!isPrefix) {
            if (/<head[^>]*>/i.test(html)) html = html.replace(/(<head[^>]*>)/i, "$1" + _swReg);
            else html = _swReg + html;
          }
          // 拖拽上传桥: 内联于 <head>(随首段 HTML 同步执行·document 级监听跨 SPA body 重渲染长存)。
          //   不可用 </body> 前 <script src>: SPA 引导清空/重建 body, 外链脚本走网络往返期间标签已被抹除 →
          //   永不执行(实测 __daoDropBridge 不挂·拖拽无反应)。同源直服本反代端口 → 取字节 fetch 即达。
          if (_bridgeServe) {
            try {
              const _bj = await _bridgeServe("/__daobridge.js", reqUrl);
              if (_bj && _bj.body) {
                const dbg = "<script>" + _bj.body + "</script>";
                if (/<head[^>]*>/i.test(html)) html = html.replace(/(<head[^>]*>)/i, "$1" + dbg);
                else if (/<\/head>/i.test(html)) html = html.replace(/<\/head>/i, dbg + "</head>");
                else html = dbg + html;
              }
            } catch (e) { /* 守柔: 桥注入失败不阻断反代 */ }
          }
          safeHeaders["Content-Type"] = "text/html; charset=utf-8";
          res.writeHead(status, safeHeaders);
          res.end(html, "utf8");
          return;
        }
        if (isJs) {
          // 仅当确含上游绝对URL才全量改写 → 多数 bundle 用相对路径, 跳过省大量 split/join。
          const txt = body.toString("utf8");
          let outBuf;
          if (
            txt.indexOf("https://app.devin.ai") >= 0 ||
            txt.indexOf("https://windsurf.com/") >= 0 ||
            txt.indexOf("https://register.windsurf.com/") >= 0 ||
            txt.indexOf("https://server.codeium.com/") >= 0 ||
            txt.indexOf("https://server.self-serve.windsurf.com/") >= 0
          ) {
            const js = txt
              .split("https://app.devin.ai").join(localBase)
              .split("https://windsurf.com/").join(localBase + "/__ws/")
              .split("https://register.windsurf.com/").join(localBase + "/__reg/")
              .split("https://server.codeium.com/").join(localBase + "/__cdn/")
              .split("https://server.self-serve.windsurf.com/").join(localBase + "/__ss/");
            outBuf = Buffer.from(js, "utf8");
          } else {
            outBuf = body; // 无需改写 → 直用原 buffer
          }
          if (cacheable) { delete safeHeaders["cache-control"]; safeHeaders["Cache-Control"] = "public, max-age=31536000, immutable"; }
          res.writeHead(status, safeHeaders);
          res.end(outBuf);
          if (cacheable && status === 200) {
            const entry = { status, headers: { ...safeHeaders }, body: outBuf, base: localBase };
            _cachePut(targetPath, entry);
            _diskPut(targetPath, entry, localBase);
          }
          return;
        }
        if (ct.includes("application/json")) {
          // 帛书·「域中有四大」: SPA 以 webapp_host 校验规范主机 —— location.host!==webapp_host 即
          //   `location.href=https://${webapp_host}/login?...` 硬跳真站(掉登录之真因)。反代下浏览器
          //   所见 host = 本地代理地址, 故把服务端下发的 webapp_host 改写为本次请求 Host, 令校验通过。
          let txt = body.toString("utf8");
          if (txt.indexOf("webapp_host") >= 0) {
            const reqHost = (req.headers && req.headers.host) ? String(req.headers.host) : "localhost";
            // 守柔·并理 null: 上游实测下发 "webapp_host":null(post-auth/组织 JSON) → SPA 据此回落默认
            //   主机 app.devin.ai → /org/<slug> 跨主机硬跳真站 /login(掉登录之真因)。旧正则仅匹配带引号
            //   字符串值, 漏改 null。故字符串值与 null 字面量一并改写为本次请求 Host。
            txt = txt.replace(/("webapp_host"\s*:\s*)(?:"[^"]*"|null)/g, '$1"' + reqHost + '"');
            txt = txt.replace(/("webappHost"\s*:\s*)(?:"[^"]*"|null)/g, '$1"' + reqHost + '"');
          }
          res.writeHead(status, safeHeaders);
          res.end(Buffer.from(txt, "utf8"));
          return;
        }
        // CSS/字体/图片/wasm 等哈希不可变静态资源: CSS 按需改写, 余直发; 强缓存 + 入缓存。
        if (cacheable) {
          let outBuf = body;
          if (ct.includes("text/css")) {
            const t = body.toString("utf8");
            if (t.indexOf("https://app.devin.ai/") >= 0) {
              outBuf = Buffer.from(t.split("https://app.devin.ai/").join(localBase + "/"), "utf8");
            }
          }
          delete safeHeaders["cache-control"];
          safeHeaders["Cache-Control"] = "public, max-age=31536000, immutable";
          res.writeHead(status, safeHeaders);
          res.end(outBuf);
          if (status === 200) {
            const entry = { status, headers: { ...safeHeaders }, body: outBuf, base: localBase };
            _cachePut(targetPath, entry);
            _diskPut(targetPath, entry, localBase);
          }
          return;
        }
        res.writeHead(status, safeHeaders);
        res.end(body);
      });
    },
  );

  proxyReq.on("error", (e) => {
    if (log) try { log("[proxy] upstream error " + (e && e.message)); } catch {}
    if (!res.headersSent) {
      res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("proxy error: " + (e && e.message));
    }
  });
  proxyReq.on("timeout", () => {
    try { proxyReq.destroy(); } catch {}
    if (!res.headersSent) {
      res.writeHead(504, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("proxy timeout");
    }
  });
  if (reqBody.length) proxyReq.write(reqBody);
  proxyReq.end();
  };
  await fire(false);
}

// 帛书·「为之于其未有」— 确保某账号的注入反代在跑, 返回其本地端口。
//   同账号复用同端口 (origin 稳定 → 标签复活态保持); 不同账号各占端口 → localStorage 隔离。
async function ensureProxyForAccount(email, auth, log) {
  if (!auth || !auth.auth1) return { ok: false, error: "no-auth1" };
  const key = String(email || "default").toLowerCase();
  const existing = _servers.get(key);
  if (existing && existing.port) {
    existing.auth = auth; // 刷新令牌 (auth1 可能已轮换)
    // 复用既有端口亦触发预热 (自守版本键·已热即静) → 换版后重开实例自动重热。
    if (!DAO_NO_PREWARM) setImmediate(() => { _prewarmGraph("http://localhost:" + existing.port, auth, log); });
    return { ok: true, port: existing.port, url: "http://localhost:" + existing.port + "/" };
  }
  const port = await pickFreePort();
  if (!port) return { ok: false, error: "no-port" };
  const entry = { server: null, port, auth };
  const server = http.createServer((req, res) => {
    handleRequest(req, res, entry.auth, port, log).catch((e) => {
      if (!res.headersSent) {
        try {
          res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("proxy fail: " + (e && e.message));
        } catch {}
      }
    });
  });
  entry.server = server;
  // 注册 WS 升级反代: 令实时会话事件通道随网页存活(根治首登后「断联·发不出收不到」)
  server.on("upgrade", (req, socket, head) => {
    try { handleUpgrade(req, socket, head, entry.auth, log); } catch { try { socket.destroy(); } catch {} }
  });
  await new Promise((resolve) => {
    server.on("error", () => resolve());
    server.listen(port, "127.0.0.1", () => resolve());
  });
  _servers.set(key, entry);
  if (log) try { log("[proxy] " + key + " → http://localhost:" + port); } catch {}
  // 帛书·「为之于其未有」: 反代一就绪即后台预热 SPA 全模块图入共享缓存 → 浏览器首屏
  //   不再逐层向上游瀑布往返。跨账号共享 → 首个实例热, 余多实例秒开。失败守柔不阻反代。
  if (!DAO_NO_PREWARM) setImmediate(() => { _prewarmGraph("http://localhost:" + port, auth, log); });
  return { ok: true, port, url: "http://localhost:" + port + "/" };
}

// 帛书·「水善利万物而有静」— 前缀模式入口: 不另起端口, 由主口 9920 的 /i/<accKey>/* 路由
//   就地调用, 把同源前缀作改写基址 → 公网手机/电脑浏览器无感访问该账号页 (含 Devin 对话/多实例)。
//   prefix 形如 '/i/<accKey>' (无尾斜杠); restUrl 为已剥前缀的同源路径 (含 query)。
async function proxyPrefixed(req, res, auth, prefix, restUrl, log) {
  if (!auth || !auth.auth1) {
    if (!res.headersSent) { res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" }); res.end("no-auth1"); }
    return;
  }
  try {
    await handleRequest(req, res, auth, { rewriteBase: String(prefix || "").replace(/\/+$/, ""), parsePath: restUrl, log });
  } catch (e) {
    if (!res.headersSent) {
      try { res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" }); res.end("proxy fail: " + (e && e.message)); } catch {}
    }
  }
}

function stopProxy(email) {
  const key = String(email || "default").toLowerCase();
  const e = _servers.get(key);
  if (e && e.server) try { e.server.close(); } catch {}
  _servers.delete(key);
}

function stopAll() {
  for (const e of _servers.values()) if (e.server) try { e.server.close(); } catch {}
  _servers.clear();
}

module.exports = {
  ensureProxyForAccount,
  handleUpgrade,
  proxyPrefixed,
  stopProxy,
  stopAll,
  buildAuthBridge,
  setBridgeServe,
  // 预热状态自省: criticalWarm=首屏关键路径已暖(可即时供首开新账号), fullWarm=全模块图已暖。
  prewarmStatus: () => ({ criticalWarm: !!_prewarmCritical, fullWarm: !!_prewarmKey, key: _prewarmKey || _prewarmCritical }),
  // 供单测访问磁盘二级缓存内部 (非对外 API)。
  _diskCache: { _diskCacheDir, _diskKey, _diskPut, _diskGet, _diskEvict, _isTextCt, _rebaseAsset, ASSET_DISK_MAX },
};
