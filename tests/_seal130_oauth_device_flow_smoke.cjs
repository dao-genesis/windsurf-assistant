#!/usr/bin/env node
// _seal130_oauth_device_flow_smoke.cjs · 印 130 · 一线到底 · 守门
//
// 主公诏 (2026-05-17):
//   「从用户公网登录 github 账号后 · 后端连接操作同步一切底层 · 去中心化」
//
// 帛书·四十八「为道者日损 · 损之又损 · 以至于无为 · 无为而无不为」
// 帛书·廿二  「圣人执一 · 以为天下牧」
// 帛书·廿五  「道法自然」
//
// 印 130 之核 (两面):
//   面一 · 公网登 (OAuth Device-Flow): 用户公网登 GitHub · 一钮代 PAT
//   面二 · 真本源接入闭环 (登→入池→用):
//          autoSigninWindsurf 成功 → POST /admin/keys/add → WS_POOL_STATE.keys.push
//          → 即可走 /v1/messages 反代真活 · 一线到底 · 物无非彼物无非是
//
// 守门策略:
//   静守 ─ 件读 · 检 dao_oauth.js / dao_app.js / dao_proxy.js / index.html 含关键码
//   动守一 · OAuth Device-Flow ─ 起 mock GH server · vm.runInContext 加载
//          dao_oauth.js (浏览器 shim) · 真走 start() 全链 (success / error / cancel)
//   动守二 · 池接入闭环 ─ 起真 dao_proxy daemon · 真调
//          /admin/keys/add → /admin/keys/list → /admin/keys/add (dup) → /admin/keys/remove
"use strict";

const path = require("path");
const http = require("http");
const fs = require("fs");
const vm = require("vm");
const cp = require("child_process");

// 印 131 · 中文路径 · 子进程承双旗 (圣人执一)
function __preserveFlags() {
  const flags = (process.execArgv || []).slice();
  for (const f of ["--preserve-symlinks", "--preserve-symlinks-main"]) {
    if (!flags.includes(f)) flags.push(f);
  }
  return flags;
}

const ROOT = path.resolve(__dirname, "..");
const DAO_OAUTH = path.join(ROOT, "web", "dao_oauth.js");
const DAO_APP = path.join(ROOT, "web", "dao_app.js");
const INDEX_HTML = path.join(ROOT, "web", "index.html");
const DAO_PROXY = path.join(ROOT, "packages", "dao-devin-vm", "dao_proxy.js");

let pass = 0,
  fail = 0;
const fails = [];
function ok(n) {
  console.log("  \x1b[32m\u2713\x1b[0m " + n);
  pass++;
}
function ng(n, w) {
  console.log("  \x1b[31m\u2717\x1b[0m " + n + " \u00b7 " + w);
  fail++;
  fails.push(n + ": " + w);
}

console.log("\u2550".repeat(60));
console.log(
  " \u5370 130 \u00b7 OAuth Device-Flow \u5b88\u95e8 \u00b7 \u53cd\u8005\u9053\u4e4b\u52a8",
);
console.log("\u2550".repeat(60));

// ════════════════════════════════════════════════════════════════════
// § 一 · 静守 · 件读
// ════════════════════════════════════════════════════════════════════
function staticGuard() {
  console.log(
    "\n\u2550\u2550\u2550 \u4e00 \u00b7 \u9759\u5b88 \u00b7 \u4ef6\u8bfb \u2550\u2550\u2550",
  );

  const oauthSrc = fs.readFileSync(DAO_OAUTH, "utf8");
  const appSrc = fs.readFileSync(DAO_APP, "utf8");
  const htmlSrc = fs.readFileSync(INDEX_HTML, "utf8");

  // dao_oauth.js
  const oauthChecks = [
    [
      "dao_oauth.js 含 \u5370 130 \u6807",
      /\u5370\s*130|seal[\s_-]?130/i.test(oauthSrc),
    ],
    [
      "dao_oauth.js 含 DEFAULT_CLIENT_ID",
      oauthSrc.includes("DEFAULT_CLIENT_ID"),
    ],
    [
      "dao_oauth.js 含 GH_DEVICE_CODE_URL",
      oauthSrc.includes("GH_DEVICE_CODE_URL"),
    ],
    [
      "dao_oauth.js 含 GH_ACCESS_TOKEN_URL",
      oauthSrc.includes("GH_ACCESS_TOKEN_URL"),
    ],
    [
      "dao_oauth.js 含 requestDeviceCode",
      oauthSrc.includes("requestDeviceCode"),
    ],
    ["dao_oauth.js 含 pollAccessToken", oauthSrc.includes("pollAccessToken")],
    [
      "dao_oauth.js 含 isConfigured",
      oauthSrc.includes("function isConfigured"),
    ],
    ["dao_oauth.js 含 setupHint", oauthSrc.includes("function setupHint")],
    ["dao_oauth.js 含 start({", oauthSrc.includes("function start(")],
    ["dao_oauth.js 含 window.daoOAuth", oauthSrc.includes("window.daoOAuth")],
    ["dao_oauth.js 含 __setUrlsForTest", oauthSrc.includes("__setUrlsForTest")],
    [
      "dao_oauth.js 含 DEFAULT_SCOPE='repo gist workflow'",
      /DEFAULT_SCOPE\s*=\s*["']repo gist workflow["']/.test(oauthSrc),
    ],
    [
      "dao_oauth.js 含 grant_type device_code",
      oauthSrc.includes("urn:ietf:params:oauth:grant-type:device_code"),
    ],
    [
      "dao_oauth.js 含 authorization_pending 处理",
      oauthSrc.includes("authorization_pending") ||
        oauthSrc.includes("'pending'") ||
        oauthSrc.includes('"pending"'),
    ],
    ["dao_oauth.js 含 slow_down 处理", oauthSrc.includes("slow_down")],
    ["dao_oauth.js 含 expired_token 处理", oauthSrc.includes("expired_token")],
    ["dao_oauth.js 含 access_denied 处理", oauthSrc.includes("access_denied")],
    [
      "dao_oauth.js 调 daoSync.setPat",
      oauthSrc.includes("daoSync.setPat") || oauthSrc.includes(".setPat("),
    ],
    [
      "dao_oauth.js 守隐注 (token 仅入 localStorage)",
      /localStorage|\u4e0d\u5916\u53d1/.test(oauthSrc),
    ],
    [
      "dao_oauth.js 引主公诏 (\u516c\u7f51\u767b\u5f55 / \u53bb\u4e2d\u5fc3\u5316)",
      /\u516c\u7f51\u767b|\u53bb\u4e2d\u5fc3\u5316/.test(oauthSrc),
    ],
  ];

  for (const [n, ok_] of oauthChecks) {
    if (ok_) ok(n);
    else ng(n, "\u7f3a\u5173\u952e\u7801");
  }

  // dao_app.js
  const appChecks = [
    [
      "dao_app.js 含 bindOauthFlow",
      appSrc.includes("function bindOauthFlow") ||
        appSrc.includes("bindOauthFlow()"),
    ],
    ["dao_app.js renderGate 含 OAuth bind", appSrc.includes("bindOauthFlow")],
    ["dao_app.js 含 gate-btn-oauth 引", appSrc.includes("gate-btn-oauth")],
    ["dao_app.js 含 gate-oauth-state 引", appSrc.includes("gate-oauth-state")],
    ["dao_app.js 含 gate-oauth-code 引", appSrc.includes("gate-oauth-code")],
    [
      "dao_app.js 含 daoOAuth.start 调",
      /daoOAuth\.start|window\.daoOAuth\.start/.test(appSrc),
    ],
    [
      "dao_app.js 含 onCode/onPoll/onSuccess/onError 全四 cb",
      /onCode/.test(appSrc) &&
        /onPoll/.test(appSrc) &&
        /onSuccess/.test(appSrc) &&
        /onError/.test(appSrc),
    ],
    [
      "dao_app.js OAuth success 后调 whoami (复用 PAT 同路径)",
      /onSuccess[\s\S]{0,500}daoSync\.whoami/.test(appSrc),
    ],
    ["dao_app.js 含 \u5370 130 \u6ce8", /\u5370\s*130/.test(appSrc)],
    ["dao_app.js 含 client_id_invalid 处理", /client_id_invalid/.test(appSrc)],
  ];
  for (const [n, ok_] of appChecks) {
    if (ok_) ok(n);
    else ng(n, "\u7f3a\u5173\u952e\u7801");
  }

  // index.html
  const htmlChecks = [
    [
      "index.html 含 <script src=dao_oauth.js>",
      /<script\s+src=["']dao_oauth\.js["']/.test(htmlSrc),
    ],
    [
      "index.html 含 id=gate-btn-oauth",
      /id=["']gate-btn-oauth["']/.test(htmlSrc),
    ],
    [
      "index.html 含 id=gate-oauth-state",
      /id=["']gate-oauth-state["']/.test(htmlSrc),
    ],
    [
      "index.html 含 id=gate-oauth-code",
      /id=["']gate-oauth-code["']/.test(htmlSrc),
    ],
    [
      "index.html 含 id=gate-oauth-link",
      /id=["']gate-oauth-link["']/.test(htmlSrc),
    ],
    [
      "index.html 含 id=gate-oauth-cancel",
      /id=["']gate-oauth-cancel["']/.test(htmlSrc),
    ],
    [
      "index.html PAT 入 <details> 兜底",
      /<details[\s\S]{0,800}id=["']gate-pat["']/.test(htmlSrc),
    ],
    [
      "index.html footer 含 \u5370 130+ (\u53bb\u4e2d\u5fc3\u5316)",
      /<footer[\s\S]{0,300}\u5370\s*1(3[0-9]|[4-9]\d)/.test(htmlSrc),
    ],
  ];
  for (const [n, ok_] of htmlChecks) {
    if (ok_) ok(n);
    else ng(n, "\u7f3a\u5173\u952e\u7801");
  }

  // ─── 印 130 池接入闭环静守 ─────────────────────────────────────
  const proxySrc = fs.readFileSync(DAO_PROXY, "utf8");
  const proxyChecks = [
    [
      "dao_proxy.js 含 \u5370 130 \u6ce8 (\u771f\u672c\u6e90\u63a5\u5165\u6c60)",
      /\u5370\s*130|admin\/keys\/add/.test(proxySrc),
    ],
    [
      "dao_proxy.js 含 function handleAdminKeysAdd",
      proxySrc.includes("function handleAdminKeysAdd"),
    ],
    [
      "dao_proxy.js 含 function handleAdminKeysList",
      proxySrc.includes("function handleAdminKeysList"),
    ],
    [
      "dao_proxy.js 含 function handleAdminKeysRemove",
      proxySrc.includes("function handleAdminKeysRemove"),
    ],
    [
      "dao_proxy.js 路由 POST /admin/keys/add",
      /method\s*===?\s*["']POST["'][\s\S]{0,200}\/admin\/keys\/add/.test(
        proxySrc,
      ),
    ],
    [
      "dao_proxy.js 路由 GET /admin/keys/list",
      /method\s*===?\s*["']GET["'][\s\S]{0,200}\/admin\/keys\/list/.test(
        proxySrc,
      ),
    ],
    [
      "dao_proxy.js 路由 POST /admin/keys/remove",
      /method\s*===?\s*["']POST["'][\s\S]{0,200}\/admin\/keys\/remove/.test(
        proxySrc,
      ),
    ],
    [
      "dao_proxy.js handleAdminKeysAdd 含\u53bb\u91cd (duplicate)",
      /duplicate/i.test(proxySrc.split("handleAdminKeysAdd")[1] || ""),
    ],
    [
      "dao_proxy.js handleAdminKeysAdd 推 WS_POOL_STATE.keys",
      /WS_POOL_STATE\.keys\.push/.test(proxySrc),
    ],
    [
      "dao_proxy.js handleAdminKeysAdd 池\u8f6c loaded",
      /WS_POOL_STATE\.loaded\s*=\s*true/.test(proxySrc),
    ],
    [
      "dao_proxy.js \u8131\u654f _maskKey (apiKey \u4ec5\u524d 12 \u5b57)",
      /_maskKey|slice\(0,\s*12\)/.test(proxySrc),
    ],
    [
      "dao_proxy.js 404 hint 含 /admin/keys/add",
      /hint[\s\S]{0,500}\/admin\/keys\/add/.test(proxySrc),
    ],
  ];
  for (const [n, ok_] of proxyChecks) {
    if (ok_) ok(n);
    else ng(n, "\u7f3a\u5173\u952e\u7801");
  }

  // ─── dao_app autoSigninWindsurf 池接入闭环 ────────────────────
  const autoSeg = (appSrc.match(
    /async function autoSigninWindsurf[\s\S]{0,4000}/,
  ) || [""])[0];
  const autoChecks = [
    [
      "dao_app autoSigninWindsurf 含 /admin/keys/add 调",
      /\/admin\/keys\/add/.test(autoSeg),
    ],
    [
      "dao_app autoSigninWindsurf 注 \u5370 130 \u63a5\u5165\u95ed\u73af",
      /\u5370\s*130[\s\S]{0,500}\u63a5\u5165|\u63a5\u5165\u95ed\u73af/.test(
        autoSeg,
      ),
    ],
    [
      "dao_app autoSigninWindsurf 池接入失败不阻 (锦上添花)",
      /\u9526\u4e0a\u6dfb\u82b1|\u4e0d\u963b|fail/.test(autoSeg),
    ],
    [
      "dao_app autoSigninWindsurf 透传 apiKey+srvUrl+email 入 add",
      /apiKey[\s\S]{0,200}srvUrl[\s\S]{0,200}email/.test(autoSeg) ||
        /apiKey[\s\S]{0,200}email[\s\S]{0,200}srvUrl/.test(autoSeg),
    ],
  ];
  for (const [n, ok_] of autoChecks) {
    if (ok_) ok(n);
    else ng(n, "\u7f3a\u5173\u952e\u7801");
  }
}

// ════════════════════════════════════════════════════════════════════
// § 二 · 动守 · mock GH server + vm.runInContext
// ════════════════════════════════════════════════════════════════════
function makeMockServer(handler) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        try {
          const j = body ? JSON.parse(body) : {};
          handler(req, j, res);
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: "mock_crash", msg: e.message }));
        }
      });
    });
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      resolve({ server, url: "http://127.0.0.1:" + addr.port });
    });
  });
}

// 构造浏览器 shim 环境运行 dao_oauth.js
function loadOauthModule(oauthSrc, opts) {
  const stateBag = {
    pat: null,
    pollSetTimeoutCount: 0,
  };
  const fakeWindow = {
    fetch: globalThis.fetch.bind(globalThis),
    daoSync: {
      setPat: function (v) {
        stateBag.pat = v;
      },
      hasPat: function () {
        return !!stateBag.pat;
      },
      clearPat: function () {
        stateBag.pat = null;
      },
    },
    setTimeout: function (cb, ms) {
      stateBag.pollSetTimeoutCount++;
      // 加速 mock 测试 · 5s 跳 50ms
      return setTimeout(cb, Math.min(ms, 50));
    },
    clearTimeout: clearTimeout,
    __DAO_OAUTH_CLIENT_ID__: opts.clientIdOverride || null,
  };
  fakeWindow.window = fakeWindow; // 自引
  const ctx = {
    window: fakeWindow,
    setTimeout: fakeWindow.setTimeout,
    clearTimeout: clearTimeout,
    fetch: fakeWindow.fetch,
    console: console,
  };
  vm.createContext(ctx);
  vm.runInContext(oauthSrc, ctx, { filename: "dao_oauth.js" });
  return { fakeWindow, stateBag, daoOAuth: ctx.window.daoOAuth };
}

async function dynamicGuard() {
  console.log(
    "\n\u2550\u2550\u2550 \u4e8c \u00b7 \u52a8\u5b88 \u00b7 mock GH server + start() \u5168\u94fe \u2550\u2550\u2550",
  );

  const oauthSrc = fs.readFileSync(DAO_OAUTH, "utf8");

  // ───── 一 · 起 mock GH device-flow server ─────
  let pendingHits = 0; // 计 access_token 调次
  let scenario = "success"; // success | client_id_invalid | access_denied
  let lastClientId = null;
  let lastDeviceCode = null;

  const dcMock = await makeMockServer((req, body, res) => {
    lastClientId = body.client_id;
    if (scenario === "client_id_invalid") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "client_id_invalid",
          error_description: "client_id is invalid",
        }),
      );
      return;
    }
    // 正常返
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        device_code: "dev-code-yin130-mock-aaaa",
        user_code: "DAOX-1234",
        verification_uri: "https://github.com/login/device",
        expires_in: 900,
        interval: 1, // mock 内 1s (sw 50ms 加速)
      }),
    );
  });

  const atMock = await makeMockServer((req, body, res) => {
    lastDeviceCode = body.device_code;
    if (scenario === "access_denied") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "access_denied" }));
      return;
    }
    // success 路径: 头 2 次 pending · 第 3 次 success
    pendingHits++;
    if (pendingHits < 3) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "authorization_pending" }));
      return;
    }
    // 第 3 次 success
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        access_token: "gho_yin130OAuthSuccessTokenMock_AAAAAA",
        token_type: "bearer",
        scope: "repo,gist,workflow",
      }),
    );
  });

  console.log(
    "  \u2713 mock servers \u8d77 [device=" +
      dcMock.url +
      " access=" +
      atMock.url +
      "]",
  );

  // ───── 二 · success 路径 ─────
  console.log(
    "\n\u2500\u2500 \u5b9e\u9a8c\u4e00 \u00b7 success \u8def\u5f84 \u2500\u2500",
  );
  scenario = "success";
  pendingHits = 0;
  let mod1 = loadOauthModule(oauthSrc, {});
  const oauth1 = mod1.daoOAuth;
  if (!oauth1) {
    ng("daoOAuth load", "loadOauthModule \u672a\u8fd4 daoOAuth");
    return;
  }
  ok("daoOAuth \u88c5 \u00b7 window.daoOAuth \u51fa");

  // 注 mock URLs + valid client_id
  const setUrlsRet = oauth1.__setUrlsForTest({
    deviceCode: dcMock.url,
    accessToken: atMock.url,
    clientId: "Ov23liYIN130VALIDMOCK01",
  });
  if (
    setUrlsRet.deviceCode === dcMock.url &&
    setUrlsRet.accessToken === atMock.url
  ) {
    ok("__setUrlsForTest \u6ce8 mock URL \u6210");
  } else {
    ng("__setUrlsForTest", "\u8fd4\u503c\u4e0d\u5339");
  }

  if (oauth1.isConfigured()) {
    ok("isConfigured() === true \u5f53 client_id \u6709\u6548");
  } else {
    ng("isConfigured", "\u671f true \u00b7 \u5b9e false");
  }

  // 跑 start()
  const result1 = await new Promise((resolve) => {
    let codeInfo = null;
    let pollCount = 0;
    const flow = oauth1.start({
      scope: "repo gist workflow",
      onCode: (info) => {
        codeInfo = info;
      },
      onPoll: (info) => {
        pollCount++;
      },
      onSuccess: (info) => {
        resolve({ status: "success", info, codeInfo, pollCount });
      },
      onError: (err) => {
        resolve({ status: "error", err, codeInfo, pollCount });
      },
    });
    // 10s 兜底超时
    setTimeout(
      () => resolve({ status: "timeout", codeInfo, pollCount }),
      10000,
    );
  });

  if (result1.status === "success") {
    ok("success \u8def\u5f84 \u00b7 onSuccess \u89e6");
  } else {
    ng("success \u8def\u5f84", "\u8fd4 " + result1.status);
  }
  if (result1.codeInfo && result1.codeInfo.user_code === "DAOX-1234") {
    ok("onCode \u8fd4 user_code DAOX-1234");
  } else {
    ng("onCode", "user_code \u4e0d\u5339");
  }
  if (
    result1.codeInfo &&
    result1.codeInfo.verification_uri === "https://github.com/login/device"
  ) {
    ok("onCode \u8fd4 verification_uri \u6b63");
  } else {
    ng("verification_uri", "\u4e0d\u5339");
  }
  if (result1.pollCount >= 1) {
    ok(
      "onPoll \u89e6 \u00b7 " +
        result1.pollCount +
        " \u6b21 (pending \u4e2d\u95f4\u6001)",
    );
  } else {
    ng("onPoll", "\u672a\u89e6");
  }
  if (
    result1.info &&
    result1.info.access_token &&
    result1.info.access_token.startsWith("gho_yin130")
  ) {
    ok("onSuccess \u8fd4 access_token");
  } else {
    ng("access_token", "\u4e0d\u5339");
  }
  if (mod1.stateBag.pat && mod1.stateBag.pat.startsWith("gho_yin130")) {
    ok(
      "token \u5165 daoSync.setPat (\u5165 localStorage \u4ee3 \u00b7 \u8907\u7528 PAT \u540c\u8def\u5f84)",
    );
  } else {
    ng("setPat", "token \u672a\u5165 daoSync");
  }
  if (lastClientId === "Ov23liYIN130VALIDMOCK01") {
    ok("mock device-code server \u6536\u5230\u6b63 client_id");
  } else {
    ng("client_id transmit", "\u6536: " + lastClientId);
  }
  if (lastDeviceCode === "dev-code-yin130-mock-aaaa") {
    ok(
      "mock access-token server \u6536\u5230\u6b63 device_code (\u4e32\u63a5)",
    );
  } else {
    ng("device_code transmit", "\u6536: " + lastDeviceCode);
  }

  // ───── 三 · client_id_invalid 错链 ─────
  console.log(
    "\n\u2500\u2500 \u5b9e\u9a8c\u4e8c \u00b7 client_id_invalid \u9519\u94fe \u2500\u2500",
  );
  scenario = "client_id_invalid";
  pendingHits = 0;
  let mod2 = loadOauthModule(oauthSrc, {});
  mod2.daoOAuth.__setUrlsForTest({
    deviceCode: dcMock.url,
    accessToken: atMock.url,
    clientId: "PLACEHLDR-invalid", // 这个 placeholder 含 PLACEHLDR · isConfigured → false
  });
  if (!mod2.daoOAuth.isConfigured()) {
    ok("isConfigured() === false \u5f53 client_id \u542b PLACEHLDR");
  } else {
    ng("isConfigured (placeholder)", "\u671f false \u00b7 \u5b9e true");
  }

  // 但走 start (mock 自仍返 client_id_invalid)
  mod2.daoOAuth.__setUrlsForTest({ clientId: "anyvalue" }); // 走 start 用
  const result2 = await new Promise((resolve) => {
    mod2.daoOAuth.start({
      onCode: () => {},
      onPoll: () => {},
      onSuccess: () => resolve({ status: "success" }),
      onError: (err) => resolve({ status: "error", err }),
    });
    setTimeout(() => resolve({ status: "timeout" }), 5000);
  });
  if (
    result2.status === "error" &&
    result2.err &&
    /client_id_invalid|OAuth App 未建/.test(result2.err.message)
  ) {
    ok("client_id_invalid \u9519\u94fe \u00b7 onError \u89e6 + hint \u6b63");
  } else {
    ng("client_id_invalid", "result=" + JSON.stringify(result2).slice(0, 200));
  }
  if (result2.err && result2.err.stage === "device_code") {
    ok("onError stage=device_code \u6b63");
  } else {
    ng("err.stage", JSON.stringify(result2.err || {}).slice(0, 200));
  }

  // ───── 四 · access_denied 错链 ─────
  console.log(
    "\n\u2500\u2500 \u5b9e\u9a8c\u4e09 \u00b7 access_denied \u9519\u94fe \u2500\u2500",
  );
  scenario = "access_denied";
  pendingHits = 0;
  let mod3 = loadOauthModule(oauthSrc, {});
  mod3.daoOAuth.__setUrlsForTest({
    deviceCode: dcMock.url,
    accessToken: atMock.url,
    clientId: "Ov23liYIN130VALID03",
  });
  const result3 = await new Promise((resolve) => {
    mod3.daoOAuth.start({
      onCode: () => {},
      onPoll: () => {},
      onSuccess: () => resolve({ status: "success" }),
      onError: (err) => resolve({ status: "error", err }),
    });
    setTimeout(() => resolve({ status: "timeout" }), 5000);
  });
  if (
    result3.status === "error" &&
    result3.err &&
    /access_denied|拒/.test(result3.err.message)
  ) {
    ok("access_denied \u9519\u94fe \u00b7 onError \u89e6 + msg \u6b63");
  } else {
    ng("access_denied", "result=" + JSON.stringify(result3).slice(0, 200));
  }
  if (result3.err && result3.err.stage === "poll") {
    ok("access_denied stage=poll \u6b63");
  } else {
    ng("access_denied stage", JSON.stringify(result3.err || {}).slice(0, 200));
  }

  // ───── 五 · cancel 路径 ─────
  console.log(
    "\n\u2500\u2500 \u5b9e\u9a8c\u56db \u00b7 cancel \u8def\u5f84 \u2500\u2500",
  );
  scenario = "success"; // mock 仍 success · 但我们立即 cancel
  pendingHits = 0;
  let mod4 = loadOauthModule(oauthSrc, {});
  mod4.daoOAuth.__setUrlsForTest({
    deviceCode: dcMock.url,
    accessToken: atMock.url,
    clientId: "Ov23liYIN130VALID04",
  });
  let cancelledCalled = false;
  const flow4 = mod4.daoOAuth.start({
    onCode: () => {},
    onPoll: () => {},
    onSuccess: () => {
      cancelledCalled = true;
    },
    onError: () => {},
  });
  if (flow4 && typeof flow4.cancel === "function") {
    ok("start() \u8fd4 { cancel() } \u53d8");
  } else {
    ng("flow.cancel", "\u672a\u8fd4");
  }
  if (flow4) flow4.cancel();
  // 等 1s 看 cancel 后 是否 onSuccess 仍触
  await new Promise((r) => setTimeout(r, 1000));
  if (!cancelledCalled) {
    ok(
      "cancel \u540e onSuccess \u4e0d\u518d\u89e6 (\u5e1b\u4e66\u4e03\u5341\u516d \u67d4\u5f31\u80dc\u521a)",
    );
  } else {
    ng("cancel \u540e onSuccess", "\u89e6\u4e86 (\u4e0d\u5e94)");
  }

  // 关 mock
  dcMock.server.close();
  atMock.server.close();
  ok("mock servers \u5173");

  // ───── 六 · setupHint ─────
  console.log(
    "\n\u2500\u2500 \u5b9e\u9a8c\u4e94 \u00b7 setupHint \u9759\u4fe1 \u2500\u2500",
  );
  let mod5 = loadOauthModule(oauthSrc, {});
  const hint = mod5.daoOAuth.setupHint();
  if (hint && typeof hint.hint === "string" && Array.isArray(hint.steps)) {
    ok("setupHint() \u8fd4 { hint, steps[] }");
  } else {
    ng("setupHint", "\u8fd4\u503c\u7ed3\u6784\u5f02");
  }
  if (hint.url && /settings\/developers/.test(hint.url)) {
    ok("setupHint.url \u6307 GH settings/developers");
  } else {
    ng("setupHint.url", "\u4e0d\u6307 GH settings/developers");
  }
  if (hint.steps.length >= 5) {
    ok("setupHint.steps >= 5 \u6761 (\u4e3b\u516c\u5efa OAuth App 7 \u6b65)");
  } else {
    ng("setupHint.steps", "\u592a\u5c11");
  }
}

// ════════════════════════════════════════════════════════════════════
// § 三 · 动守二 · 池接入闭环 · 真起 dao_proxy · /admin/keys/* 真链
//   "登 → 入池 → 用" 之 "入池" 一节真验
//   帛书·廿二「圣人执一」: 一处端点入池 · 万处反代自然受
// ════════════════════════════════════════════════════════════════════
const BIND_POOL = "127.0.0.1";
const PORT_POOL = 17130; // 印 130 池接入测端口 (与其他守门不冲)
const AUTH_POOL = "dao-seal130-auth-token";

function poolProbe(method, urlPath, headers, body) {
  return new Promise((resolve) => {
    const opts = {
      hostname: BIND_POOL,
      port: PORT_POOL,
      path: urlPath,
      method,
      headers: Object.assign({}, headers || {}),
      timeout: 5000,
    };
    let payload = null;
    if (body !== undefined) {
      payload = Buffer.from(JSON.stringify(body), "utf8");
      opts.headers["Content-Type"] = "application/json";
      opts.headers["Content-Length"] = String(payload.length);
    }
    const req = http.request(opts, (res) => {
      const cs = [];
      res.on("data", (c) => cs.push(c));
      res.on("end", () => {
        const text = Buffer.concat(cs).toString("utf8");
        let json = null;
        try {
          json = JSON.parse(text);
        } catch {}
        resolve({ status: res.statusCode, text, json });
      });
    });
    req.on("error", (e) => resolve({ err: e.message }));
    req.on("timeout", () => {
      try {
        req.destroy();
      } catch {}
      resolve({ err: "timeout" });
    });
    if (payload) req.write(payload);
    req.end();
  });
}

function waitPoolHealth(maxMs) {
  const deadline = Date.now() + (maxMs || 8000);
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (Date.now() > deadline) return reject(new Error("/health 探活超时"));
      poolProbe("GET", "/health", { Authorization: "Bearer " + AUTH_POOL })
        .then((r) => {
          if (r.status === 200) return resolve();
          setTimeout(tick, 100);
        })
        .catch(() => setTimeout(tick, 100));
    };
    setTimeout(tick, 200);
  });
}

function killDaemon(child) {
  return new Promise((resolve) => {
    if (!child || child.killed) return resolve();
    let done = false;
    const fin = () => {
      if (!done) {
        done = true;
        resolve();
      }
    };
    child.once("exit", fin);
    try {
      child.kill(process.platform === "win32" ? "SIGTERM" : "SIGINT");
    } catch {}
    setTimeout(() => {
      if (!done) {
        try {
          child.kill("SIGKILL");
        } catch {}
        setTimeout(fin, 400);
      }
    }, 4500);
  });
}

function spawnDaemonPool() {
  return new Promise((resolve, reject) => {
    const env = Object.assign({}, process.env, {
      PORT: String(PORT_POOL),
      BIND: BIND_POOL,
      DAO_AUTH_TOKEN: AUTH_POOL,
      WAM_FILE: path.join(__dirname, "_seal130_no_wam.json"),
      DEVIN_TOKEN: "",
      DEVIN_TOKENS: "",
      DAO_TOKENS_FILE: "",
      WS_TOKENS_FILE: path.join(__dirname, "_seal130_no_ws.txt"),
    });
    const child = cp.spawn(
      process.execPath,
      [...__preserveFlags(), DAO_PROXY],
      {
        env,
        cwd: path.dirname(DAO_PROXY),
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let stderr = "";
    child.stderr.on("data", (c) => (stderr += c.toString()));
    child.stdout.on("data", () => {});
    waitPoolHealth(8000)
      .then(() => resolve(child))
      .catch((e) => {
        try {
          child.kill("SIGKILL");
        } catch {}
        reject(new Error(e.message + " · stderr=" + stderr.slice(-200)));
      });
  });
}

async function dynamicGuardPool() {
  console.log(
    "\n\u2550\u2550\u2550 \u4e09 \u00b7 \u52a8\u5b88\u4e8c \u00b7 \u6c60\u63a5\u5165\u95ed\u73af \u00b7 \u771f\u8d77 dao_proxy \u2550\u2550\u2550",
  );
  let daemon;
  try {
    daemon = await spawnDaemonPool();
    ok("dao_proxy daemon \u8d77 (\u5370 130 \u6c60\u63a5\u5165\u6d4b)");

    // 一 · /health
    const h = await poolProbe("GET", "/health", {
      Authorization: "Bearer " + AUTH_POOL,
    });
    if (h.status === 200) ok("/health 200");
    else ng("/health", "status=" + (h.status || h.err));

    // 二 · /admin/keys/list (初空)
    const l0 = await poolProbe("GET", "/admin/keys/list", {
      Authorization: "Bearer " + AUTH_POOL,
    });
    if (l0.status === 200 && l0.json && Array.isArray(l0.json.keys)) {
      ok(
        "/admin/keys/list \u521d\u8fd4 200 + keys=[] (count=" +
          l0.json.count +
          ")",
      );
    } else {
      ng(
        "/admin/keys/list 初",
        "status=" + (l0.status || l0.err) + " json=" + JSON.stringify(l0.json),
      );
    }

    // 三 · POST /admin/keys/add (印 129 真出 ws-* key 流入此处)
    const a1 = await poolProbe(
      "POST",
      "/admin/keys/add",
      { Authorization: "Bearer " + AUTH_POOL },
      {
        apiKey: "ws-yin130-real-key-aaaa-bbbb-1234",
        srvUrl: "https://mock-server.codeium.com",
        email: "alice@dao.local",
      },
    );
    if (a1.status === 200 && a1.json && a1.json.ok && a1.json.count === 1) {
      ok(
        "/admin/keys/add ws-* \u00b7 200 \u00b7 ok=true \u00b7 count=1 (\u5165\u6c60)",
      );
    } else {
      ng(
        "/admin/keys/add",
        "status=" + (a1.status || a1.err) + " json=" + JSON.stringify(a1.json),
      );
    }
    if (a1.json && /^ws-yin130/.test(a1.json.apiKey || "")) {
      ok("/admin/keys/add \u8fd4 apiKey \u8131\u654f (\u4ec5\u524d 12 \u5b57)");
    } else {
      ng("apiKey 脱敏", "apiKey=" + (a1.json && a1.json.apiKey));
    }
    // warn (ws- prefix) 应 null
    if (a1.json && a1.json.warn === null) {
      ok("ws- prefix \u00b7 warn=null");
    } else {
      ng("ws- prefix warn", "warn=" + JSON.stringify(a1.json && a1.json.warn));
    }

    // 四 · 二度 add 同 key → duplicate=true
    const a2 = await poolProbe(
      "POST",
      "/admin/keys/add",
      { Authorization: "Bearer " + AUTH_POOL },
      {
        apiKey: "ws-yin130-real-key-aaaa-bbbb-1234",
        email: "alice@dao.local",
      },
    );
    if (
      a2.status === 200 &&
      a2.json &&
      a2.json.ok === true &&
      a2.json.duplicate === true &&
      a2.json.count === 1
    ) {
      ok(
        "\u53bb\u91cd \u00b7 \u540c key \u518d add \u8fd4 ok=true+duplicate=true \u00b7 count=1 (\u5e1b\u4e66\u516d\u5341\u56db \u4e3a\u4e4b\u4e8e\u672a\u6709)",
      );
    } else {
      ng("去重", "json=" + JSON.stringify(a2.json));
    }

    // 五 · 加第二 key (非 ws- 前缀 · warn 应触)
    const a3 = await poolProbe(
      "POST",
      "/admin/keys/add",
      { Authorization: "Bearer " + AUTH_POOL },
      {
        apiKey: "mock-non-ws-key-xyz",
        srvUrl: "https://mock-server.codeium.com",
        email: "bob@dao.local",
      },
    );
    if (a3.status === 200 && a3.json && a3.json.ok && a3.json.count === 2) {
      ok("\u7b2c\u4e8c key \u5165 \u00b7 count=2");
    } else {
      ng("第二 key", "json=" + JSON.stringify(a3.json));
    }
    if (a3.json && /ws-/.test(a3.json.warn || "")) {
      ok(
        "non-ws-prefix \u00b7 warn \u89e6 (\u8b66\u4e0d\u963b \u00b7 \u5141 mock \u6d4b)",
      );
    } else {
      ng("warn non-ws", "warn=" + (a3.json && a3.json.warn));
    }

    // 六 · /admin/keys/list (count=2 + loaded=true)
    const l1 = await poolProbe("GET", "/admin/keys/list", {
      Authorization: "Bearer " + AUTH_POOL,
    });
    if (
      l1.status === 200 &&
      l1.json &&
      l1.json.count === 2 &&
      l1.json.loaded === true
    ) {
      ok("/admin/keys/list \u540e \u00b7 count=2 \u00b7 loaded=true");
    } else {
      ng("/admin/keys/list 后", "json=" + JSON.stringify(l1.json));
    }
    // 验脱敏
    if (
      l1.json &&
      l1.json.keys.every((k) => k.apiKey && k.apiKey.endsWith("\u2026"))
    ) {
      ok("/admin/keys/list \u8fd4 apiKey \u5168\u8131\u654f (\u672b\u5e26 …)");
    } else {
      ng(
        "/admin/keys/list 脱敏",
        "keys=" + JSON.stringify(l1.json && l1.json.keys),
      );
    }
    // 验 email 透传
    if (
      l1.json &&
      l1.json.keys.find((k) => k.email === "alice@dao.local") &&
      l1.json.keys.find((k) => k.email === "bob@dao.local")
    ) {
      ok(
        "/admin/keys/list email \u900f\u4f20 (\u4e3b\u516c\u53ef\u8fa8\u540e\u53f0\u662f\u8c01\u4e4b key)",
      );
    } else {
      ng(
        "/admin/keys/list email",
        "keys=" + JSON.stringify(l1.json && l1.json.keys),
      );
    }

    // 七 · /admin/keys/remove
    const r1 = await poolProbe(
      "POST",
      "/admin/keys/remove",
      { Authorization: "Bearer " + AUTH_POOL },
      { apiKey: "ws-yin130-real-key-aaaa-bbbb-1234" },
    );
    if (r1.status === 200 && r1.json && r1.json.ok) {
      ok("/admin/keys/remove \u00b7 200 \u00b7 ok=true");
    } else {
      ng("/admin/keys/remove", "json=" + JSON.stringify(r1.json));
    }
    const l2 = await poolProbe("GET", "/admin/keys/list", {
      Authorization: "Bearer " + AUTH_POOL,
    });
    if (l2.json && l2.json.count === 1) {
      ok("remove \u540e count=1");
    } else {
      ng("remove 后 count", "count=" + (l2.json && l2.json.count));
    }

    // 八 · 缺 apiKey · 400 验
    const a4 = await poolProbe(
      "POST",
      "/admin/keys/add",
      { Authorization: "Bearer " + AUTH_POOL },
      {},
    );
    if (a4.status === 400 && a4.json && a4.json.error === "api_key_required") {
      ok("\u7f3a apiKey \u00b7 400 + api_key_required");
    } else {
      ng(
        "缺 apiKey",
        "status=" + (a4.status || a4.err) + " json=" + JSON.stringify(a4.json),
      );
    }
    // hint 含 ws-*
    if (a4.json && /ws-\*/.test(a4.json.hint || "")) {
      ok("\u7f3a apiKey \u00b7 hint \u542b ws-* (\u4f53\u9a8c\u670b\u5907)");
    } else {
      ng("缺 apiKey hint", "hint=" + (a4.json && a4.json.hint));
    }
  } catch (e) {
    ng("dynamicGuardPool crash", e.stack || e.message);
  } finally {
    if (daemon) {
      await killDaemon(daemon);
      ok("dao_proxy daemon \u5173\u505c");
    }
  }
}

// ════════════════════════════════════════════════════════════════════
// § 运行
// ════════════════════════════════════════════════════════════════════
(async () => {
  staticGuard();
  try {
    await dynamicGuard();
  } catch (e) {
    ng("dynamicGuard(OAuth) crash", e.stack || e.message);
  }
  try {
    await dynamicGuardPool();
  } catch (e) {
    ng("dynamicGuardPool crash", e.stack || e.message);
  }

  console.log("\n" + "\u2550".repeat(60));
  console.log(" \u5370 130 \u603b: " + pass + " \u8fc7 / " + fail + " \u5931");
  console.log("\u2550".repeat(60));

  if (fail === 0) {
    console.log(
      "\n\u2713 \u5370 130 \u4e00\u7ebf\u5230\u5e95 \u00b7 OAuth Device-Flow + \u6c60\u63a5\u5165\u95ed\u73af \u00b7 \u53bb\u4e2d\u5fc3\u5316 \u00b7 \u9053\u6cd5\u81ea\u7136\n",
    );
    process.exit(0);
  } else {
    console.log("\n\u2717 \u5931\u9879:");
    for (const f of fails) console.log("  - " + f);
    process.exit(1);
  }
})();
