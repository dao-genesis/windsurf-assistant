// v2.5.1 回归 · windsurfPostAuth 必传 X-Devin-Auth1-Token header
//
// 根因背景 (2026-05-04): Windsurf 后端协议变
//   旧: body{auth1_token} → 401 "missing required header: X-Devin-Auth1-Token"
//   新: 必须传 header X-Devin-Auth1-Token · body 可空
//
// 本测: 桩 https 拦 POST /_backend/.../WindsurfPostAuth · 断言:
//   1. X-Devin-Auth1-Token header 存在且值 == auth1
//   2. body.auth1_token 仍保留 (向后兼容 · 后端回滚也 OK)
//   3. body.org_id 若传 orgId 则存在
//
"use strict";
const Module = require("node:module");
const path = require("node:path");
const http = require("node:http");

let pass = 0, fail = 0;
function expect(desc, cond) {
  if (cond) {
    console.log("    ✓ " + desc);
    pass++;
  } else {
    console.log("    ✗ " + desc);
    fail++;
  }
}

// 桩 vscode
const vscodeStub = {
  workspace: {
    getConfiguration: () => ({ get: (k, def) => def }),
    onDidChangeTextDocument: () => ({ dispose: () => {} }),
    workspaceFolders: [],
  },
  window: {
    createOutputChannel: () => ({
      appendLine: () => {},
      show: () => {},
      dispose: () => {},
    }),
    createStatusBarItem: () => ({
      show: () => {},
      hide: () => {},
      dispose: () => {},
    }),
    showInformationMessage: () => {},
    showWarningMessage: () => {},
    showErrorMessage: () => {},
    registerWebviewViewProvider: () => ({ dispose: () => {} }),
  },
  commands: { registerCommand: () => ({ dispose: () => {} }) },
  StatusBarAlignment: { Left: 1, Right: 2 },
  ConfigurationTarget: { Global: 1 },
  Uri: { file: (p) => ({ fsPath: p }) },
  EventEmitter: class { constructor() { this.event = () => ({ dispose: () => {} }); } fire() {} dispose() {} },
};

// 拦 require("vscode")
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (r, parent, ...rest) {
  if (r === "vscode") return require.resolve(path.join(__dirname, "package.json"));
  return origResolve.call(this, r, parent, ...rest);
};
const origLoad = Module._load;
Module._load = function (r, parent, ...rest) {
  if (r === "vscode") return vscodeStub;
  return origLoad.call(this, r, parent, ...rest);
};

// 桩本地 HTTP 服务假扮 windsurf.com (拦 https)
const origHttps = require("node:https");
const localReq = { ...origHttps };

let capturedReq = null;
const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    let parsed;
    try { parsed = JSON.parse(body); } catch { parsed = { _raw: body }; }
    capturedReq = {
      method: req.method,
      path: req.url,
      headers: req.headers,
      body: parsed,
    };
    // 模拟后端: X-Devin-Auth1-Token 必传才 200
    if (!req.headers["x-devin-auth1-token"]) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        code: "unauthenticated",
        message: "missing required header: X-Devin-Auth1-Token",
      }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      sessionToken: "devin-session-token$test-fake-jwt",
      accountId: "account-xxx",
      primaryOrgId: "org-yyy",
    }));
  });
});

(async () => {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;

  // 劫持 https.request · 改写 windsurf.com → localhost:port
  origHttps.request = function (optionsOrUrl, cb) {
    let opts = optionsOrUrl;
    if (typeof optionsOrUrl === "string") {
      const u = new URL(optionsOrUrl);
      opts = { hostname: u.hostname, port: 443, path: u.pathname + u.search, method: "GET" };
    }
    if (opts && (opts.hostname === "windsurf.com" || opts.hostname === "register.windsurf.com")) {
      opts = { ...opts, hostname: "127.0.0.1", port, protocol: "http:" };
      return http.request(opts, cb);
    }
    // 其它请求直放真 https (本测不用)
    return localReq.request.call(origHttps, optionsOrUrl, cb);
  };

  const ext = require(path.join(__dirname, "extension.js"));
  const { windsurfPostAuth } = ext._internals || {};
  if (typeof windsurfPostAuth !== "function") {
    console.error("× _internals.windsurfPostAuth 未导出");
    process.exit(1);
  }

  console.log("[A] windsurfPostAuth 传 X-Devin-Auth1-Token header (v2.5.1 新协议)");
  capturedReq = null;
  const r1 = await windsurfPostAuth("auth1_test_token_abc123", "");
  expect(
    "ok=true (后端 200 OK)",
    r1 && r1.ok === true,
  );
  expect(
    "header X-Devin-Auth1-Token 存在",
    capturedReq && capturedReq.headers["x-devin-auth1-token"] === "auth1_test_token_abc123",
  );
  expect(
    "body.auth1_token 兼容保留",
    capturedReq && capturedReq.body && capturedReq.body.auth1_token === "auth1_test_token_abc123",
  );
  expect(
    "返回 sessionToken 正确解析",
    r1 && r1.sessionToken === "devin-session-token$test-fake-jwt",
  );

  console.log("\n[B] 带 orgId · body.org_id 必存");
  capturedReq = null;
  const r2 = await windsurfPostAuth("auth1_test_token_xyz", "org-special");
  expect(
    "带 orgId 也 ok",
    r2 && r2.ok === true,
  );
  expect(
    "body.org_id 存在",
    capturedReq && capturedReq.body && capturedReq.body.org_id === "org-special",
  );

  // 破坏测: 若有人回退删 header · 必 401 (这是本测的存在意义 · 防再出现)
  console.log("\n[C] (防御) 模拟老 v2.5.0 无 header · 应 401");
  capturedReq = null;
  const raw = await new Promise((resolve) => {
    const r = http.request(
      { hostname: "127.0.0.1", port, path: "/_backend/exa.seat_management_pb.SeatManagementService/WindsurfPostAuth", method: "POST", headers: { "Content-Type": "application/json" } },
      (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => resolve({ status: res.statusCode, body: d }));
      },
    );
    r.end(JSON.stringify({ auth1_token: "only_in_body_like_v250" }));
  });
  expect("无 header 时 · 后端真返 401", raw.status === 401);
  expect("401 带 unauthenticated code", raw.body.includes("unauthenticated"));

  server.close();

  console.log(`\n═══ 结果: ${pass} 过 / ${fail} 败 ═══`);
  if (fail > 0) process.exit(1);
})();
