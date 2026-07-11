#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════
 *   devin-setup.js · 无为而无不为
 *   Devin AI 全链路认证注入 · 最小通用体
 * ═══════════════════════════════════════════════════════════════
 *
 *   零第三方依赖 · 纯 Node.js · 自包含单文件
 *   代理自适应 · 环境自适应 · 全平台兼容
 *
 *   ─── 最小用法 ───
 *     node devin-setup.js --accounts acc.txt --pat ghp_xxxx
 *
 *   ─── 账号文件格式 (acc.txt) ───
 *     email1@example.com  password1
 *     email2@example.com  password2
 *     # 注释行以 # 开头
 *
 *   ─── 完整参数 ───
 *     --accounts <path>      账号文件(每行: email password)
 *     --pat <ghp_xxx>        GitHub PAT
 *     --proxy <host:port>    代理(如 127.0.0.1:7890)
 *     --no-proxy             禁用代理(海外用户)
 *     --auto-proxy           自动检测代理(默认行为)
 *     --state <path>         状态文件(默认: ~/.devin-setup.json)
 *     --daemon               守护模式(PAT API间歇可用时)
 *     --status               查看状态
 *     --verify               验证已有连接
 *     --retry                重试失败账号
 *     --reset                重置Git状态
 *     --only-pat             仅注入PAT(跳过Secret/Knowledge/Playbook)
 *     --secret-name <n>      Secret名称(默认: GITHUB_PAT)
 *     --secret-value <v>     Secret值(默认: 使用PAT)
 *     --knowledge-name <n>   Knowledge名称
 *     --knowledge-body <b>   Knowledge内容
 *     --playbook-title <t>   Playbook标题
 *     --playbook-body <b>    Playbook内容
 *     --help                 帮助
 *
 *   帛书·四十三「天下之至柔，驰骋于天下之致坚；无有入于无间」
 *   帛书·四十八「为无为，事无事，味无味。大小，多少」
 */
"use strict";

var https = require("https");
var http = require("http");
var crypto = require("crypto");
var url = require("url");
var fs = require("fs");
var path = require("path");
var os = require("os");

// ═══════════════════════════════════════════════════════════
// 常量 · 帛书·三十二「始制有名，名亦既有，夫亦将知止」
// ═══════════════════════════════════════════════════════════

var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36";
var WINDSURF = "https://windsurf.com";
var DEVIN = "https://app.devin.ai";
var TOKEN_PREFIX = "devin-session-token$";

// API 端点
var URL_LOGIN = WINDSURF + "/_devin-auth/password/login";
var URL_POSTAUTH = WINDSURF + "/_backend/exa.seat_management_pb.SeatManagementService/WindsurfPostAuth";
var URL_DEVIN_POST_AUTH = DEVIN + "/api/users/post-auth";
var URL_REGISTER = "https://register.windsurf.com/exa.seat_management_pb.SeatManagementService/RegisterUser";

var HTTP_TIMEOUT = 15000;
var PAT_TIMEOUT = 30000;

// ═══════════════════════════════════════════════════════════
// 代理自适应 · 帛书·四十三「无有入于无间」
//   自动检测: 尝试直连 → 失败则走代理 → 代理也失败则报告
//   用户可 --proxy / --no-proxy / --auto-proxy 覆盖
// ═══════════════════════════════════════════════════════════

var PROXY_HOST = null;  // null = 未确定
var PROXY_PORT = null;
var PROXY_MODE = "auto"; // auto | on | off
var _proxyTested = false;

// 需要代理的域名 (GFW屏蔽)
var PROXY_DOMAINS = [
  "app.devin.ai",
  "windsurf.com",
  "register.windsurf.com",
  "server.codeium.com",
  "server.self-serve.windsurf.com",
];

function domainNeedsProxy(hostname) {
  for (var i = 0; i < PROXY_DOMAINS.length; i++) {
    if (hostname === PROXY_DOMAINS[i] || hostname.endsWith("." + PROXY_DOMAINS[i])) {
      return true;
    }
  }
  return false;
}

function currentProxy() {
  if (PROXY_MODE === "off") return null;
  if (PROXY_MODE === "on") return { host: PROXY_HOST || "127.0.0.1", port: PROXY_PORT || 7890 };
  // auto: 已测试则用结果，未测试返回null(稍后自动检测)
  if (_proxyTested) return PROXY_HOST ? { host: PROXY_HOST, port: PROXY_PORT } : null;
  return null;
}

// 自动检测代理: 尝试直连 Devin，超时则探测本地代理
async function autoDetectProxy() {
  if (PROXY_MODE !== "auto") return currentProxy();
  if (_proxyTested) return currentProxy();

  log("  代理检测: 尝试直连 Devin...");
  var directTest = await rawRequest("GET", DEVIN + "/api/health", null, null, { timeoutMs: 5000, forceDirect: true });

  if (directTest.status > 0 || directTest.text === "timeout") {
    // 直连可达 (哪怕404也说明网络通)
    if (directTest.status > 0 && directTest.text !== "timeout" && directTest.text !== "proxy_timeout") {
      log("  代理检测: ✓ 直连可用，无需代理");
      _proxyTested = true;
      PROXY_HOST = null;
      return null;
    }
  }

  // 直连不通，探测本地代理
  var proxyCandidates = [
    { host: "127.0.0.1", port: 7890 },
    { host: "127.0.0.1", port: 1080 },
    { host: "127.0.0.1", port: 10809 },
    { host: "127.0.0.1", port: 10808 },
    { host: "127.0.0.1", port: 8080 },
    { host: "127.0.0.1", port: 1087 },
    { host: "127.0.0.1", port: 7897 },
  ];

  for (var i = 0; i < proxyCandidates.length; i++) {
    var pc = proxyCandidates[i];
    var proxyTest = await rawRequest("GET", DEVIN + "/api/health", null, null, {
      timeoutMs: 4000,
      forceProxy: pc,
    });
    if (proxyTest.status > 0 && proxyTest.text !== "timeout" && proxyTest.text !== "proxy_timeout" && proxyTest.text !== "proxy_err") {
      PROXY_HOST = pc.host;
      PROXY_PORT = pc.port;
      _proxyTested = true;
      log("  代理检测: ✓ 代理 " + pc.host + ":" + pc.port + " 可用");
      return { host: PROXY_HOST, port: PROXY_PORT };
    }
  }

  // 都不行 — 仍然标记已测试，后续直连重试
  _proxyTested = true;
  PROXY_HOST = null;
  log("  代理检测: ✗ 直连和本地代理均不可用，将尝试直连");
  return null;
}

function setupProxyFromArgs(args) {
  if (args.noProxy) {
    PROXY_MODE = "off";
    _proxyTested = true;
    return;
  }
  if (args.proxy) {
    var parts = args.proxy.split(":");
    PROXY_HOST = parts[0] || "127.0.0.1";
    PROXY_PORT = parseInt(parts[1] || "7890", 10);
    PROXY_MODE = "on";
    _proxyTested = true;
    return;
  }
  // 默认 auto
  PROXY_MODE = "auto";
}

// ═══════════════════════════════════════════════════════════
// HTTP 请求 · 帛书·二十七「善行者无辙迹，善数者不以筹策」
//   统一 GET/POST/PUT，自动代理穿透
// ═══════════════════════════════════════════════════════════

function rawRequest(method, targetUrl, headers, body, opts) {
  opts = opts || {};
  var timeout = opts.timeoutMs || HTTP_TIMEOUT;
  var forceDirect = opts.forceDirect;
  var forceProxy = opts.forceProxy;

  return new Promise(function (resolve) {
    var u;
    try { u = new url.URL(targetUrl); } catch (e) {
      return resolve({ status: 0, json: null, text: "bad_url" });
    }

    var data = body ? Buffer.from(JSON.stringify(body), "utf8") : null;
    var reqHeaders = Object.assign({
      "Content-Type": "application/json",
      "Accept": "application/json, text/plain, */*",
      "User-Agent": UA,
    }, headers || {});
    if (data) reqHeaders["Content-Length"] = data.length;

    // 决定是否走代理
    var useProxy = false;
    var proxyInfo = null;

    if (forceDirect) {
      useProxy = false;
    } else if (forceProxy) {
      useProxy = true;
      proxyInfo = forceProxy;
    } else {
      var proxy = currentProxy();
      if (proxy && domainNeedsProxy(u.hostname)) {
        useProxy = true;
        proxyInfo = proxy;
      }
    }

    if (useProxy && proxyInfo) {
      // HTTP 代理普通模式: path = 完整目标 URL
      var proxyHeaders = Object.assign({}, reqHeaders, { "Host": u.hostname });
      var proxyReq = http.request({
        hostname: proxyInfo.host,
        port: proxyInfo.port,
        path: targetUrl,
        method: method,
        headers: proxyHeaders,
        timeout: timeout,
      }, function (res) {
        var chunks = [];
        res.on("data", function (c) { chunks.push(c); });
        res.on("end", function () {
          var text = Buffer.concat(chunks).toString("utf8");
          var j = null;
          try { j = text ? JSON.parse(text) : null; } catch (e) {}
          resolve({ status: res.statusCode || 0, json: j, text: text });
        });
      });
      proxyReq.on("error", function (e) {
        resolve({ status: 0, json: null, text: "proxy_err: " + e.message });
      });
      proxyReq.on("timeout", function () {
        proxyReq.destroy();
        resolve({ status: 0, json: null, text: "proxy_timeout" });
      });
      if (data) proxyReq.write(data);
      proxyReq.end();
      return;
    }

    // 直连
    var req = https.request({
      method: method,
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + u.search,
      headers: reqHeaders,
      timeout: timeout,
      rejectUnauthorized: !opts.insecure,
    }, function (res) {
      var chunks = [];
      res.on("data", function (c) { chunks.push(c); });
      res.on("end", function () {
        var text = Buffer.concat(chunks).toString("utf8");
        var j = null;
        try { j = text ? JSON.parse(text) : null; } catch (e) {}
        resolve({ status: res.statusCode || 0, json: j, text: text });
      });
    });
    req.on("error", function (e) {
      resolve({ status: 0, json: null, text: "err: " + e.message });
    });
    req.on("timeout", function () {
      req.destroy();
      resolve({ status: 0, json: null, text: "timeout" });
    });
    if (data) req.write(data);
    req.end();
  });
}

function jsonPost(targetUrl, headers, body, opts) {
  return rawRequest("POST", targetUrl, headers, body, opts);
}

function jsonGet(targetUrl, headers, opts) {
  return rawRequest("GET", targetUrl, headers, null, opts);
}

// ═══════════════════════════════════════════════════════════
// 认证链 · 帛书·三十九「天得一以清，地得一以宁」
// ═══════════════════════════════════════════════════════════

async function devinLogin(email, password) {
  var maxRetry = 0;
  while (maxRetry < 3) {
    var r = await jsonPost(URL_LOGIN,
      { Origin: WINDSURF, Referer: WINDSURF + "/account/login" },
      { email: email, password: password }
    );
    // 429 退避
    if (r.status === 429 && maxRetry < 2) {
      var wait = Math.pow(2, maxRetry) * 2000;
      await sleep(wait);
      maxRetry++;
      continue;
    }
    var j = r.json || {};
    if (j.token && j.user_id) {
      return { auth1: j.token, userId: j.user_id };
    }
    var err = j.detail || j.error || j.message || "no_token";
    throw new Error("[login] " + err + " code=" + r.status);
  }
}

async function devinPostAuth(auth1) {
  var r = await jsonPost(URL_DEVIN_POST_AUTH,
    { Authorization: "Bearer " + auth1 },
    {}
  );
  var j = r.json || {};
  var orgId = (j.org && j.org.org_id) || j.org_id || j.orgId || "";
  var orgName = (j.org && j.org.org_name) || j.org_name || j.orgName || "";
  if (!orgId && j.org && typeof j.org === "object") {
    var keys = Object.keys(j.org);
    for (var i = 0; i < keys.length; i++) {
      if (/org.?id/i.test(keys[i])) { orgId = String(j.org[keys[i]]); break; }
    }
  }
  if (!orgId) throw new Error("[post-auth] no orgId code=" + r.status);
  return { orgId: orgId, orgName: orgName };
}

// ═══════════════════════════════════════════════════════════
// 注入 API · 帛书·四十二「道生一，一生二，二生三，三生万物」
// ═══════════════════════════════════════════════════════════

async function injectSecret(orgId, name, value, auth1) {
  var bareOrgId = orgId.replace(/^org-/, "");
  var r = await jsonPost(
    DEVIN + "/api/org-" + bareOrgId + "/secrets",
    { Authorization: "Bearer " + auth1, "x-cog-org-id": orgId },
    { key: name, value: value, type: "key-value", sensitive: true, note: name }
  );
  if (r.status === 200 || r.status === 201 || r.status === 409) {
    return { ok: true, existed: r.status === 409 };
  }
  return { ok: false, error: r.text ? r.text.slice(0, 100) : String(r.status) };
}

async function injectKnowledge(orgId, name, body, trigger, auth1) {
  var bareOrgId = orgId.replace(/^org-/, "");
  var r = await jsonPost(
    DEVIN + "/api/org-" + bareOrgId + "/learning",
    { Authorization: "Bearer " + auth1, "x-cog-org-id": orgId },
    { name: name, body: body, trigger_description: trigger || "", pinned_repo: null, parent_folder_id: null, is_enabled: true }
  );
  if (r.status === 200 || r.status === 201) return { ok: true };
  return { ok: false, error: r.text ? r.text.slice(0, 100) : String(r.status) };
}

async function injectPlaybook(orgId, title, body, auth1) {
  var bareOrgId = orgId.replace(/^org-/, "");
  var r = await jsonPost(
    DEVIN + "/api/org-" + bareOrgId + "/playbooks",
    { Authorization: "Bearer " + auth1, "x-cog-org-id": orgId },
    { title: title, body: body, status: "published", access: "team" }
  );
  if (r.status === 200 || r.status === 201) return { ok: true };
  return { ok: false, error: r.text ? r.text.slice(0, 100) : String(r.status) };
}

async function injectGitHubPAT(orgId, pat, auth1) {
  var r = await jsonPost(
    DEVIN + "/api/" + orgId + "/integrations/github/pat",
    { Authorization: "Bearer " + auth1, "x-cog-org-id": orgId },
    { pat: pat },
    { timeoutMs: PAT_TIMEOUT }
  );
  if (r.status === 200 || r.status === 201) return { ok: true, existed: false };
  if (r.status === 400 && r.text && r.text.includes("already registered")) return { ok: true, existed: true };
  return { ok: false, status: r.status, error: r.text ? r.text.slice(0, 200) : "unknown" };
}

async function checkGitConnections(orgId, auth1) {
  var targetUrl = DEVIN + "/api/organizations/" + orgId + "/git-connections-metadata";
  var r = await jsonGet(targetUrl, {
    Authorization: "Bearer " + auth1,
    "x-cog-org-id": orgId,
  });
  if (r.status === 200 && r.json) {
    var conns = Array.isArray(r.json) ? r.json : (r.json.git_connections || []);
    return { ok: true, connections: conns, count: conns.length };
  }
  return { ok: false, connections: [], count: 0, error: r.text ? r.text.slice(0, 100) : String(r.status) };
}

// ═══════════════════════════════════════════════════════════
// 工具 · 帛书·六十三「图难于其易也，为大于其细也」
// ═══════════════════════════════════════════════════════════

function log(msg) {
  var ts = new Date().toISOString().slice(11, 19);
  console.log("[" + ts + "] " + msg);
}

function sleep(ms) {
  return new Promise(function (r) { setTimeout(r, ms); });
}

function isPatDown(result) {
  if (!result) return true;
  if (result.status === 504 || result.status === 0) return true;
  var patterns = ["proxy_timeout", "timeout", "504", "ECONNRESET", "socket hang up"];
  var text = (result.error || "") + " " + (result.status || "");
  for (var i = 0; i < patterns.length; i++) {
    if (text.includes(patterns[i])) return true;
  }
  return false;
}

// ═══════════════════════════════════════════════════════════
// 参数解析 · 帛书·「言有君，事有宗」
// ═══════════════════════════════════════════════════════════

function parseArgs() {
  var args = process.argv.slice(2);
  var result = {
    command: "run",
    accountsFile: null,
    githubPat: null,
    proxy: null,
    noProxy: false,
    autoProxy: false,
    stateFile: null,
    onlyPat: false,
    secretName: null,
    secretValue: null,
    knowledgeName: null,
    knowledgeBody: null,
    knowledgeTrigger: null,
    playbookTitle: null,
    playbookBody: null,
  };
  for (var i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--accounts": result.accountsFile = args[++i]; break;
      case "--pat": result.githubPat = args[++i]; break;
      case "--proxy": result.proxy = args[++i]; break;
      case "--no-proxy": result.noProxy = true; break;
      case "--auto-proxy": result.autoProxy = true; break;
      case "--state": result.stateFile = args[++i]; break;
      case "--only-pat": result.onlyPat = true; break;
      case "--status": result.command = "status"; break;
      case "--retry": result.command = "retry"; break;
      case "--verify": result.command = "verify"; break;
      case "--daemon": result.command = "daemon"; break;
      case "--reset": result.command = "reset"; break;
      case "--help": case "-h": result.command = "help"; break;
      case "--secret-name": result.secretName = args[++i]; break;
      case "--secret-value": result.secretValue = args[++i]; break;
      case "--knowledge-name": result.knowledgeName = args[++i]; break;
      case "--knowledge-body": result.knowledgeBody = args[++i]; break;
      case "--knowledge-trigger": result.knowledgeTrigger = args[++i]; break;
      case "--playbook-title": result.playbookTitle = args[++i]; break;
      case "--playbook-body": result.playbookBody = args[++i]; break;
    }
  }
  return result;
}

// ═══════════════════════════════════════════════════════════
// 账号加载 · 帛书·「以身观身」
//   支持: 纯文本(email password) / JSON([{email,password}])
// ═══════════════════════════════════════════════════════════

function loadAccounts(filePath) {
  if (!filePath) return [];
  try {
    var raw = fs.readFileSync(filePath, "utf8").trim();
  } catch (e) {
    log("✗ 无法读取账号文件: " + filePath);
    return [];
  }
  // 尝试 JSON 格式
  if (raw.startsWith("[")) {
    try {
      var arr = JSON.parse(raw);
      return arr.filter(function (a) { return a.email && a.password; })
                .map(function (a) { return { email: a.email, password: String(a.password) }; });
    } catch (e) {}
  }
  // 纯文本格式: email password (空格/Tab分隔)
  return raw.split("\n")
    .filter(function (l) { return l.trim() && !l.trim().startsWith("#"); })
    .map(function (l) {
      var parts = l.trim().split(/[\s\t]+/);
      return { email: parts[0], password: parts.slice(1).join("") };
    })
    .filter(function (a) { return a.email && a.password && a.email.includes("@"); });
}

// ═══════════════════════════════════════════════════════════
// 状态管理 · 帛书·「知足不辱，知止不殆」
// ═══════════════════════════════════════════════════════════

var DEFAULT_STATE_FILE = path.join(os.homedir(), ".devin-setup.json");

function loadState(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, "utf8")); } catch (e) {}
  return { accounts: {}, meta: { created: new Date().toISOString(), rounds: 0 } };
}

function saveState(state, filePath) {
  state.meta.lastRun = new Date().toISOString();
  // 清除敏感字段 — 帛书·「知者弗言，言者弗知」
  // _auth1 仅存内存，不持久化到磁盘
  var safeState = JSON.parse(JSON.stringify(state));
  Object.keys(safeState.accounts).forEach(function (email) {
    delete safeState.accounts[email]._auth1;
    delete safeState.accounts[email]._patPending;
  });
  try { fs.writeFileSync(filePath, JSON.stringify(safeState, null, 2), "utf8"); } catch (e) {
    log("  ⚠ 状态保存失败: " + e.message.slice(0, 30));
  }
}

// ═══════════════════════════════════════════════════════════
// 核心注入 · 帛书·「为之于其未有也，治之于其未乱也」
// ═══════════════════════════════════════════════════════════

async function injectOne(email, password, pat, state, config) {
  var acct = state.accounts[email];
  if (!acct) {
    acct = {
      email: email, login: false, orgId: null,
      secret: config.onlyPat, knowledge: config.onlyPat,
      playbook: config.onlyPat, git: false,
      gitType: null, gitName: null, error: null, updatedAt: null,
    };
    state.accounts[email] = acct;
  }

  // 跳过已完成的
  if (acct.login && acct.secret && acct.knowledge && acct.playbook && acct.git) {
    return { skip: true, acct: acct };
  }

  log("── " + email.slice(0, 30) + " ──");

  // 1. 登录
  if (!acct.login || !acct._auth1) {
    try {
      var s1 = await devinLogin(email, password);
      if (!s1.auth1) {
        acct.error = "login_fail";
        acct.updatedAt = new Date().toISOString();
        log("  ✗ 登录失败");
        return { ok: false, step: "login", acct: acct };
      }
      acct.login = true;
      acct._auth1 = s1.auth1;
      log("  ✓ 登录成功");
    } catch (e) {
      acct.error = e.message.slice(0, 40);
      acct.updatedAt = new Date().toISOString();
      log("  ✗ 登录异常: " + e.message.slice(0, 40));
      return { ok: false, step: "login", acct: acct };
    }
  }

  // 2. 获取 orgId
  if (!acct.orgId) {
    try {
      var s3 = await devinPostAuth(acct._auth1);
      if (!s3.orgId) {
        acct.error = "no_orgId";
        acct.updatedAt = new Date().toISOString();
        log("  ✗ 无orgId");
        return { ok: false, step: "orgId", acct: acct };
      }
      acct.orgId = s3.orgId;
      log("  ✓ orgId: " + s3.orgId.slice(0, 20) + "...");
    } catch (e) {
      acct.error = e.message.slice(0, 40);
      acct.updatedAt = new Date().toISOString();
      log("  ✗ orgId异常: " + e.message.slice(0, 40));
      return { ok: false, step: "orgId", acct: acct };
    }
  }

  // 3. Secret
  if (!acct.secret && !config.onlyPat) {
    try {
      var secR = await injectSecret(acct.orgId, config.secretName, config.secretValue || pat, acct._auth1);
      if (secR.ok) { acct.secret = true; log("  ✓ Secret" + (secR.existed ? "(已有)" : "")); }
      else { log("  ✗ Secret失败: " + secR.error); }
    } catch (e) { log("  ✗ Secret异常: " + e.message.slice(0, 30)); }
    await sleep(1000);
  }

  // 4. Knowledge
  if (!acct.knowledge && !config.onlyPat) {
    try {
      var knR = await injectKnowledge(acct.orgId, config.knowledgeName, config.knowledgeBody, config.knowledgeTrigger, acct._auth1);
      if (knR.ok) { acct.knowledge = true; log("  ✓ Knowledge"); }
      else { log("  ✗ Knowledge失败: " + knR.error); }
    } catch (e) { log("  ✗ Knowledge异常: " + e.message.slice(0, 30)); }
    await sleep(1000);
  }

  // 5. Playbook
  if (!acct.playbook && !config.onlyPat) {
    try {
      var pbR = await injectPlaybook(acct.orgId, config.playbookTitle, config.playbookBody, acct._auth1);
      if (pbR.ok) { acct.playbook = true; log("  ✓ Playbook"); }
      else { log("  ✗ Playbook失败: " + pbR.error); }
    } catch (e) { log("  ✗ Playbook异常: " + e.message.slice(0, 30)); }
    await sleep(1000);
  }

  // 6. Git 连接检查
  if (!acct.git) {
    try {
      var gc = await checkGitConnections(acct.orgId, acct._auth1);
      if (gc.ok && gc.count > 0) {
        var ourConn = gc.connections.find(function (c) { return c.type === "github_individual_token"; });
        if (ourConn) {
          acct.git = true; acct.gitType = ourConn.type; acct.gitName = ourConn.name;
          log("  ✓ Git(已有:" + ourConn.type + ")");
        } else {
          log("  ! Git有" + gc.count + "连接但非PAT类型, 需PAT注入");
        }
      } else {
        log("  - Git无连接, 需PAT注入");
      }
    } catch (e) { log("  - Git检查异常: " + e.message.slice(0, 30)); }
    await sleep(1000);
  }

  // 7. PAT 注入 (API down时跳过)
  if (!acct.git) {
    if (config._patApiDown) {
      acct._patPending = true;
      log("  ⏳ PAT API已知down — 标记待注入");
    } else {
      try {
        var patR = await injectGitHubPAT(acct.orgId, pat, acct._auth1);
        if (patR.ok) {
          acct.git = true; acct.gitType = "github_individual_token";
          acct.gitName = pat.slice(0, 10) + "...";
          log("  ✓ Git(PAT注入成功!)");
        } else if (isPatDown(patR)) {
          acct._patPending = true;
          config._patApiDown = true;
          log("  ⏳ PAT API不可用(" + (patR.status || patR.error || "timeout") + ") — 后续跳过");
        } else {
          acct._patPending = true;
          log("  ✗ PAT注入失败: " + (patR.status || patR.error));
        }
      } catch (e) {
        acct._patPending = true;
        config._patApiDown = true;
        log("  ⏳ PAT异常: " + e.message.slice(0, 30) + " — 后续跳过");
      }
    }
  }

  acct.updatedAt = new Date().toISOString();
  var complete = acct.git && acct.secret && acct.knowledge && acct.playbook;
  return { ok: complete, acct: acct };
}

// ═══════════════════════════════════════════════════════════
// 批量注入 · 帛书·「大小，多少」
// ═══════════════════════════════════════════════════════════

async function injectAll(accounts, pat, state, config) {
  var total = accounts.length;
  var done = 0, failed = 0, pending = 0;
  config._patApiDown = false;

  log("═══ 开始注入 " + total + " 个账号 ═══");

  for (var i = 0; i < accounts.length; i++) {
    var a = accounts[i];
    var result = await injectOne(a.email, a.password, pat, state, config);

    if (result.skip) done++;
    else if (result.ok) done++;
    else if (result.acct && result.acct._patPending) pending++;
    else failed++;

    if ((i + 1) % 10 === 0 || i === accounts.length - 1) {
      log("  进度: " + (i + 1) + "/" + total + " ✓=" + done + " ⏳=" + pending + " ✗=" + failed);
    }
    await sleep(2000);
  }

  return { total: total, done: done, pending: pending, failed: failed };
}

// ═══════════════════════════════════════════════════════════
// PAT 守护 · 帛书·「圣人恒无心，以百姓心为心」
// ═══════════════════════════════════════════════════════════

async function patGuard(accounts, pat, state, config) {
  var needPat = accounts.filter(function (a) {
    var acct = state.accounts[a.email];
    return acct && acct.login && acct.orgId && !acct.git && acct._patPending;
  });

  if (needPat.length === 0) return { injected: 0, remaining: 0 };

  log("  PAT守护: " + needPat.length + " 个账号待PAT注入");

  // 探测第一个
  var probe = needPat[0];
  var probeAcct = state.accounts[probe.email];
  try {
    var s1 = await devinLogin(probe.email, probe.password);
    if (!s1.auth1) { log("  PAT探测: 登录失败"); return { injected: 0, remaining: needPat.length }; }
    var s3 = await devinPostAuth(s1.auth1);
    if (!s3.orgId) { log("  PAT探测: 无orgId"); return { injected: 0, remaining: needPat.length }; }

    var gc = await checkGitConnections(s3.orgId, s1.auth1);
    if (gc.ok && gc.count > 0) {
      var ourConn = gc.connections.find(function (c) { return c.type === "github_individual_token"; });
      if (ourConn) {
        probeAcct.git = true; probeAcct.gitType = ourConn.type;
        probeAcct.gitName = ourConn.name; probeAcct._patPending = false;
        log("  ✓ PAT探测发现已有连接(" + ourConn.type + ")");
      }
    }

    if (!probeAcct.git) {
      var patR = await injectGitHubPAT(s3.orgId, pat, s1.auth1);
      if (isPatDown(patR)) {
        log("  PAT API ✗ (" + (patR.status || patR.error || "timeout") + ")");
        return { injected: 0, remaining: needPat.length };
      }
      if (patR.ok) {
        probeAcct.git = true; probeAcct.gitType = "github_individual_token";
        probeAcct.gitName = pat.slice(0, 10) + "..."; probeAcct._patPending = false;
        log("  ✓ PAT探测成功!");
      }
    }
  } catch (e) {
    log("  PAT探测异常: " + e.message.slice(0, 30));
    return { injected: 0, remaining: needPat.length };
  }

  // 爆发注入
  log("  ═══ PAT API可用! 爆发注入! ═══");
  var injected = 0, remaining = 0;

  for (var j = 0; j < needPat.length; j++) {
    var item = needPat[j];
    var itemAcct = state.accounts[item.email];
    if (itemAcct.git) continue;

    try {
      var s1 = await devinLogin(item.email, item.password);
      if (!s1.auth1) { remaining++; continue; }
      var s3 = await devinPostAuth(s1.auth1);
      if (!s3.orgId) { remaining++; continue; }

      var gc2 = await checkGitConnections(s3.orgId, s1.auth1);
      if (gc2.ok && gc2.count > 0) {
        var ourConn2 = gc2.connections.find(function (c) { return c.type === "github_individual_token"; });
        if (ourConn2) {
          itemAcct.git = true; itemAcct.gitType = ourConn2.type;
          itemAcct.gitName = ourConn2.name; itemAcct._patPending = false;
          injected++;
          log("  [" + (j + 1) + "/" + needPat.length + "] ✓(已有) " + item.email.slice(0, 20));
          continue;
        }
      }

      var r = await injectGitHubPAT(s3.orgId, pat, s1.auth1);
      if (r.ok) {
        itemAcct.git = true; itemAcct.gitType = "github_individual_token";
        itemAcct.gitName = pat.slice(0, 10) + "..."; itemAcct._patPending = false;
        injected++;
        log("  [" + (j + 1) + "/" + needPat.length + "] ✓(PAT) " + item.email.slice(0, 20));
      } else if (isPatDown(r)) {
        remaining += needPat.length - j;
        log("  API又挂了! 已注入" + injected + "个");
        break;
      } else {
        remaining++;
        log("  [" + (j + 1) + "/" + needPat.length + "] ✗(" + (r.status || r.error || "").slice(0, 20) + ")");
      }
    } catch (e) { remaining++; }
    await sleep(3000);
  }

  return { injected: injected, remaining: remaining };
}

// ═══════════════════════════════════════════════════════════
// 命令实现 · 帛书·「吾言甚易知也，甚易行也」
// ═══════════════════════════════════════════════════════════

function buildConfig(args, pat) {
  return {
    secretName: args.secretName || "GITHUB_PAT",
    secretValue: args.secretValue || pat,
    knowledgeName: args.knowledgeName || "TEAM_RULES",
    knowledgeBody: args.knowledgeBody || "Team coding standards and best practices. Follow project conventions. Write clean, maintainable code.",
    knowledgeTrigger: args.knowledgeTrigger || "When starting a new task or writing code",
    playbookTitle: args.playbookTitle || "DEFAULT_PLAYBOOK",
    playbookBody: args.playbookBody || "1. Read and understand the existing codebase\n2. Plan your approach before coding\n3. Write tests for new functionality\n4. Document your changes",
    onlyPat: args.onlyPat,
    _patApiDown: false,
  };
}

async function cmdRun(args) {
  var accounts = loadAccounts(args.accountsFile);
  var pat = args.githubPat;
  var stateFile = args.stateFile || DEFAULT_STATE_FILE;
  var state = loadState(stateFile);

  if (accounts.length === 0) { log("✗ 无账号可注入 — 请指定 --accounts <path>"); return; }
  if (!pat) { log("✗ 必须指定 --pat <ghp_xxx>"); return; }

  // 代理自适应
  await autoDetectProxy();

  var config = buildConfig(args, pat);

  log("═══════════════════════════════════════════");
  log("  devin-setup.js · 无为而无不为");
  log("  账号: " + accounts.length);
  log("  PAT: " + pat.slice(0, 10) + "...");
  log("  代理: " + (currentProxy() ? currentProxy().host + ":" + currentProxy().port : "直连"));
  log("  Secret: " + (config.onlyPat ? "跳过" : config.secretName));
  log("  Knowledge: " + (config.onlyPat ? "跳过" : config.knowledgeName));
  log("  Playbook: " + (config.onlyPat ? "跳过" : config.playbookTitle));
  log("═══════════════════════════════════════════");

  var result = await injectAll(accounts, pat, state, config);
  saveState(state, stateFile);

  log("\n═══ 注入完成 ═══");
  log("  总计: " + result.total);
  log("  完成: " + result.done);
  log("  待PAT: " + result.pending);
  log("  失败: " + result.failed);
  if (result.pending > 0) log("\n  有" + result.pending + "个账号待PAT注入, 运行 --daemon 或 --retry 继续");
}

async function cmdDaemon(args) {
  var accounts = loadAccounts(args.accountsFile);
  var pat = args.githubPat;
  var stateFile = args.stateFile || DEFAULT_STATE_FILE;
  var state = loadState(stateFile);

  if (!pat) { log("✗ 必须指定 --pat <ghp_xxx>"); return; }

  await autoDetectProxy();

  var config = buildConfig(args, pat);

  log("═══════════════════════════════════════════");
  log("  devin-setup.js · 守护模式");
  log("  代理: " + (currentProxy() ? currentProxy().host + ":" + currentProxy().port : "直连"));
  log("═══════════════════════════════════════════");

  var r1 = await injectAll(accounts, pat, state, config);
  saveState(state, stateFile);
  log("  第一轮完成: ✓=" + r1.done + " ⏳=" + r1.pending + " ✗=" + r1.failed);

  var round = 1;
  while (round < 999) {
    var needPat = 0, allDone = true;
    for (var i = 0; i < accounts.length; i++) {
      var acct = state.accounts[accounts[i].email];
      if (!acct || !acct.git) { needPat++; allDone = false; }
    }
    if (allDone) { log("\n═══ 全部完成! 无为而无不为! ═══"); break; }

    round++;
    log("\n── 第" + round + "轮 ── 待PAT:" + needPat);
    var gr = await patGuard(accounts, pat, state, config);
    saveState(state, stateFile);
    if (gr.injected > 0) log("  本轮PAT注入: " + gr.injected + " 剩余: " + gr.remaining);
    log("  等待60秒...");
    await sleep(60000);
  }
}

async function cmdStatus(args) {
  var stateFile = args.stateFile || DEFAULT_STATE_FILE;
  var state = loadState(stateFile);
  var accounts = loadAccounts(args.accountsFile);
  var emails = accounts.length > 0 ? accounts.map(function (a) { return a.email; }) : Object.keys(state.accounts);

  if (emails.length === 0) { log("✗ 无账号数据 — 运行一次注入后可查看状态"); return; }

  log("═══════════════════════════════════════════");
  log("  devin-setup.js · 状态总览");
  log("═══════════════════════════════════════════");

  var c = { login: 0, orgId: 0, secret: 0, knowledge: 0, playbook: 0, git: 0, complete: 0, total: emails.length };
  emails.forEach(function (email) {
    var acct = state.accounts[email]; if (!acct) return;
    if (acct.login) c.login++;
    if (acct.orgId) c.orgId++;
    if (acct.secret) c.secret++;
    if (acct.knowledge) c.knowledge++;
    if (acct.playbook) c.playbook++;
    if (acct.git) c.git++;
    if (acct.login && acct.secret && acct.knowledge && acct.playbook && acct.git) c.complete++;
  });

  log("  账号总数: " + c.total);
  log("  ─────────────────────────");
  log("  登录:      " + c.login + "/" + c.total);
  log("  orgId:     " + c.orgId + "/" + c.total);
  log("  Secret:    " + c.secret + "/" + c.total);
  log("  Knowledge: " + c.knowledge + "/" + c.total);
  log("  Playbook:  " + c.playbook + "/" + c.total);
  log("  Git(PAT):  " + c.git + "/" + c.total);
  log("  ─────────────────────────");
  log("  完整配置:  " + c.complete + "/" + c.total + " (" + (c.total > 0 ? Math.round(c.complete / c.total * 100) : 0) + "%)");
}

async function cmdVerify(args) {
  var accounts = loadAccounts(args.accountsFile);
  var stateFile = args.stateFile || DEFAULT_STATE_FILE;
  var state = loadState(stateFile);

  if (accounts.length === 0) { log("✗ 无账号 — 请指定 --accounts"); return; }

  await autoDetectProxy();

  log("═══════════════════════════════════════════");
  log("  devin-setup.js · 验证模式");
  log("═══════════════════════════════════════════");

  var verified = 0, broken = 0;
  for (var i = 0; i < accounts.length; i++) {
    var a = accounts[i];
    var acct = state.accounts[a.email];
    if (!acct || !acct.login || !acct.orgId) { log("  ⏭ " + a.email.slice(0, 24)); continue; }
    try {
      var s1 = await devinLogin(a.email, a.password);
      if (!s1.auth1) { log("  ✗ " + a.email.slice(0, 24) + " — 登录失败"); broken++; continue; }
      var s3 = await devinPostAuth(s1.auth1);
      var gc = await checkGitConnections(s3.orgId, s1.auth1);
      var ourConn = gc.connections && gc.connections.find(function (c) { return c.type === "github_individual_token"; });
      if (ourConn) {
        acct.git = true; acct.gitType = ourConn.type; acct.gitName = ourConn.name;
        verified++;
        log("  ✓ " + a.email.slice(0, 24) + " — " + ourConn.type + " " + ourConn.name);
      } else {
        acct.git = false; acct._patPending = true; broken++;
        log("  ✗ " + a.email.slice(0, 24) + " — 无PAT连接");
      }
    } catch (e) { log("  ? " + a.email.slice(0, 24) + " — 异常: " + e.message.slice(0, 30)); }
    saveState(state, stateFile);
    await sleep(2000);
  }
  log("\n  验证完成: ✓=" + verified + " ✗=" + broken);
}

async function cmdRetry(args) {
  var accounts = loadAccounts(args.accountsFile);
  var pat = args.githubPat;
  var stateFile = args.stateFile || DEFAULT_STATE_FILE;
  var state = loadState(stateFile);

  if (!pat) { log("✗ 必须指定 --pat <ghp_xxx>"); return; }

  await autoDetectProxy();

  var config = buildConfig(args, pat);
  var retryAccounts = accounts.filter(function (a) {
    var acct = state.accounts[a.email];
    if (!acct) return true;
    return !acct.login || !acct.secret || !acct.knowledge || !acct.playbook || !acct.git;
  });

  if (retryAccounts.length === 0) { log("✓ 全部完成!"); return; }
  log("═══ 重试 " + retryAccounts.length + " 个账号 ═══");
  var result = await injectAll(retryAccounts, pat, state, config);
  saveState(state, stateFile);
  log("  完成: " + result.done + " 待PAT: " + result.pending + " 失败: " + result.failed);
}

function cmdReset(args) {
  var stateFile = args.stateFile || DEFAULT_STATE_FILE;
  var state = loadState(stateFile);
  var count = 0;
  Object.keys(state.accounts).forEach(function (email) {
    var acct = state.accounts[email];
    if (acct._patPending || !acct.git) {
      acct._patPending = false; acct.git = false; acct.gitType = null; acct.gitName = null;
      count++;
    }
  });
  saveState(state, stateFile);
  log("✓ 重置了 " + count + " 个账号的Git状态");
}

function cmdHelp() {
  console.log("");
  console.log("═══════════════════════════════════════════");
  console.log("  devin-setup.js · 无为而无不为");
  console.log("  Devin AI 全链路认证注入 · 最小通用体");
  console.log("═══════════════════════════════════════════");
  console.log("");
  console.log("最小用法:");
  console.log("  1. 创建账号文件 acc.txt (每行: email password)");
  console.log("  2. 获取 GitHub PAT: https://github.com/settings/tokens");
  console.log("  3. 运行:");
  console.log("     node devin-setup.js --accounts acc.txt --pat ghp_xxxx");
  console.log("");
  console.log("必需参数:");
  console.log("  --accounts <path>      账号文件(每行: email password)");
  console.log("  --pat <ghp_xxx>        GitHub PAT");
  console.log("");
  console.log("代理 (默认自动检测):");
  console.log("  --proxy <host:port>    手动指定代理(如 127.0.0.1:7890)");
  console.log("  --no-proxy             禁用代理(海外用户)");
  console.log("  --auto-proxy           自动检测(默认行为)");
  console.log("");
  console.log("注入控制:");
  console.log("  --only-pat             仅注入PAT(跳过Secret/Knowledge/Playbook)");
  console.log("  --secret-name <n>      Secret名称(默认: GITHUB_PAT)");
  console.log("  --secret-value <v>     Secret值(默认: 使用PAT)");
  console.log("  --knowledge-name <n>   Knowledge名称");
  console.log("  --knowledge-body <b>   Knowledge内容");
  console.log("  --playbook-title <t>   Playbook标题");
  console.log("  --playbook-body <b>    Playbook内容");
  console.log("");
  console.log("命令:");
  console.log("  (默认)                运行注入");
  console.log("  --daemon              守护模式(PAT API间歇可用时)");
  console.log("  --status              查看状态");
  console.log("  --verify              验证已有连接");
  console.log("  --retry               重试失败账号");
  console.log("  --reset               重置Git状态");
  console.log("");
  console.log("示例:");
  console.log("  # 最小 — 注入全部");
  console.log("  node devin-setup.js --accounts acc.txt --pat ghp_xxx");
  console.log("");
  console.log("  # 仅注入PAT (已有Secret/Knowledge/Playbook)");
  console.log("  node devin-setup.js --accounts acc.txt --pat ghp_xxx --only-pat");
  console.log("");
  console.log("  # 守护模式 — PAT API间歇可用时自动注入");
  console.log("  node devin-setup.js --accounts acc.txt --pat ghp_xxx --daemon");
  console.log("");
  console.log("  # 海外用户 — 禁用代理");
  console.log("  node devin-setup.js --accounts acc.txt --pat ghp_xxx --no-proxy");
  console.log("");
  console.log("  # 自定义注入内容");
  console.log("  node devin-setup.js --accounts acc.txt --pat ghp_xxx \\");
  console.log("    --knowledge-name MY_RULES --knowledge-body '...' \\");
  console.log("    --playbook-title MY_PB --playbook-body '...'");
  console.log("");
  console.log("账号文件格式 (acc.txt):");
  console.log("  email1@example.com  password1");
  console.log("  email2@example.com  password2");
  console.log("  # 注释行");
  console.log("");
  console.log("环境要求:");
  console.log("  Node.js >= 12.0.0");
  console.log("  网络: 能访问 Devin AI (中国用户需代理)");
  console.log("");
}

// ═══════════════════════════════════════════════════════════
// 主入口 · 帛书·「道恒无名，朴唯小，而天下弗敢臣」
// ═══════════════════════════════════════════════════════════

async function main() {
  var args = parseArgs();

  if (args.command === "help") { cmdHelp(); return; }

  // 设置代理
  setupProxyFromArgs(args);

  switch (args.command) {
    case "status": cmdStatus(args); break;
    case "retry": await cmdRetry(args); break;
    case "verify": await cmdVerify(args); break;
    case "daemon": await cmdDaemon(args); break;
    case "reset": cmdReset(args); break;
    default: await cmdRun(args); break;
  }
}

// ═══════════════════════════════════════════════════════════
// 库导出 · 帛书·「朴散则为器，圣人用则为官长」
//   require() 时导出核心函数 · CLI 直跑时走 main()
// ═══════════════════════════════════════════════════════════
module.exports = {
  // 认证链
  devinLogin: devinLogin,
  devinPostAuth: devinPostAuth,
  // 注入 API
  injectSecret: injectSecret,
  injectKnowledge: injectKnowledge,
  injectPlaybook: injectPlaybook,
  injectGitHubPAT: injectGitHubPAT,
  checkGitConnections: checkGitConnections,
  // 批量注入
  injectOne: injectOne,
  injectAll: injectAll,
  patGuard: patGuard,
  // 配置
  buildConfig: buildConfig,
  loadAccounts: loadAccounts,
  loadState: loadState,
  saveState: saveState,
  // 代理
  autoDetectProxy: autoDetectProxy,
  setupProxyFromArgs: setupProxyFromArgs,
  currentProxy: currentProxy,
  // 工具
  log: log,
  sleep: sleep,
  isPatDown: isPatDown,
  // 常量
  DEFAULT_STATE_FILE: DEFAULT_STATE_FILE,
  HTTP_TIMEOUT: HTTP_TIMEOUT,
  PAT_TIMEOUT: PAT_TIMEOUT,
};

// CLI 直跑 · require 时不污染父进程
if (require.main === module) {
  main().catch(function (e) { log("Fatal: " + e.message); process.exit(1); });
}
