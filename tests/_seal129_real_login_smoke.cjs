#!/usr/bin/env node
// _seal129_real_login_smoke.cjs · 印 129 · 真本源切号守门 · 反者道之动
//
// 主公诏 (2026-05-17 16:11):
//   「反者 道之动也 · 不作茧自缚 · 不限制 · 不惧 方能成其大」
//   「此登录为核心切号本源 · 凡无法替我之一切」
//   「不着相 · 直接推进道极 · 无为而无不为」
//
// 守门策略:
//   静守 ─ 检 dao_proxy.js / dao_app.js 含关键码 (函数 · URL · 端点 · 钮)
//   动守 ─ 起 3 mock server (windsurf.com / register.windsurf.com) ·
//          起 dao_proxy with env override · POST /admin/signin/windsurf ·
//          验真本源 3-step 链 (success + 3 失败路径)
"use strict";
const path = require("path");
const http = require("http");
const fs = require("fs");
const { spawn } = require("child_process");

// 印 131 · 反者道之动 · 中文路径 + Node v24 + Junction · 子进程承双旗
//   帛书·廿二「圣人执一以为天下牧」: 一处 spawn 承旗 · 万次起 daemon 安
//   __preserveFlags() 取父进程 execArgv + 补 --preserve-symlinks · --preserve-symlinks-main
//   即便父未带 (单跑守门), 自补; 父已带 (run_all 起), 透传不重
function __preserveFlags() {
  const flags = (process.execArgv || []).slice();
  for (const f of ["--preserve-symlinks", "--preserve-symlinks-main"]) {
    if (!flags.includes(f)) flags.push(f);
  }
  return flags;
}

const ROOT = path.resolve(__dirname, "..");
const DAO_PROXY = path.join(ROOT, "packages", "dao-devin-vm", "dao_proxy.js");
const DAO_APP = path.join(ROOT, "web", "dao_app.js");
const PORT = 17829,
  BIND = "127.0.0.1";
const AUTH = "seal129-test-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

let pass = 0,
  fail = 0;
const fails = [];
const ok = (n) => {
  console.log(`  \x1b[32m✓\x1b[0m ${n}`);
  pass++;
};
const ng = (n, w) => {
  console.log(`  \x1b[31m✗\x1b[0m ${n} · ${w}`);
  fail++;
  fails.push(n + ": " + w);
};

// ════════════════════════════════════════════════════════════════════
// § 一 · 静守 · 件读 · 含关键码
// ════════════════════════════════════════════════════════════════════
function staticGuard() {
  console.log("\n═══ 一 · 静守 · 件读 ═══");
  const proxyText = fs.readFileSync(DAO_PROXY, "utf8");
  const appText = fs.readFileSync(DAO_APP, "utf8");
  // dao_proxy.js
  const checks = [
    ["dao_proxy 含 §印 129 节", proxyText.includes("§ 印 129 · 真本源切号链")],
    [
      "dao_proxy 含 WS_SIGNIN_URL_LOGIN",
      proxyText.includes("WS_SIGNIN_URL_LOGIN"),
    ],
    [
      "dao_proxy 含 WS_SIGNIN_URL_POSTAUTH",
      proxyText.includes("WS_SIGNIN_URL_POSTAUTH"),
    ],
    [
      "dao_proxy 含 WS_SIGNIN_URL_REGISTER",
      proxyText.includes("WS_SIGNIN_URL_REGISTER"),
    ],
    [
      "dao_proxy 含 _signin_devinLogin",
      proxyText.includes("_signin_devinLogin"),
    ],
    ["dao_proxy 含 _signin_postAuth", proxyText.includes("_signin_postAuth")],
    ["dao_proxy 含 _signin_register", proxyText.includes("_signin_register")],
    [
      "dao_proxy 含 _signin_orchestrate",
      proxyText.includes("_signin_orchestrate"),
    ],
    ["dao_proxy 含 handleAdminSignin", proxyText.includes("handleAdminSignin")],
    [
      "dao_proxy 含 httpsPostJson helper",
      proxyText.includes("function httpsPostJson"),
    ],
    [
      "dao_proxy 路由含 /admin/signin/windsurf",
      proxyText.includes('p === "/admin/signin/windsurf"'),
    ],
    [
      "dao_proxy 含 env override (WS_SIGNIN_LOGIN_OVERRIDE)",
      proxyText.includes("WS_SIGNIN_LOGIN_OVERRIDE"),
    ],
    [
      "dao_proxy 含 env override (POSTAUTH)",
      proxyText.includes("WS_SIGNIN_POSTAUTH_OVERRIDE"),
    ],
    [
      "dao_proxy 含 env override (REGISTER)",
      proxyText.includes("WS_SIGNIN_REGISTER_OVERRIDE"),
    ],
    [
      "dao_proxy 真本源链注 (windsurf.com/_devin-auth/password/login)",
      proxyText.includes("/_devin-auth/password/login"),
    ],
    [
      "dao_proxy 含 WindsurfPostAuth 端点",
      proxyText.includes("WindsurfPostAuth"),
    ],
    ["dao_proxy 含 RegisterUser 端点", proxyText.includes("RegisterUser")],
    ["dao_proxy 守隐 (不日志密码)", proxyText.includes("不日志密码")],
    // dao_app.js
    [
      "dao_app 含 autoSigninWindsurf 函数",
      appText.includes("async function autoSigninWindsurf"),
    ],
    ["dao_app 含 '🔑 自动登' 钮", appText.includes("🔑 自动登")],
    ["dao_app 中栏 acct 节加 印 129", appText.includes("印 129 · 真本源")],
    [
      "dao_app 调 vmUrl + /admin/signin/windsurf",
      appText.includes("/admin/signin/windsurf"),
    ],
    ["dao_app 含 in-signin-email 入框", appText.includes("in-signin-email")],
    ["dao_app 含 in-signin-pw 入框", appText.includes("in-signin-pw")],
    [
      "dao_app 含 viaSignin 标 (区别手输 vs 自动)",
      appText.includes("viaSignin"),
    ],
    ["dao_app 含 signin-status 反馈条", appText.includes("signin-status")],
    [
      "dao_app 主公诏引 (此登录为核心切号本源)",
      appText.includes("此登录为核心切号本源"),
    ],
  ];
  for (const [name, cond] of checks) {
    if (cond) ok(name);
    else ng(name, "缺");
  }
}

// ════════════════════════════════════════════════════════════════════
// § 二 · 动守 · 起 mock + spawn dao_proxy · 走真本源 3-step
// ════════════════════════════════════════════════════════════════════

// mock state · 控 mock 行为 (走 success or 走 fail at stage X)
let __MOCK_MODE = "success"; // success | fail_login | fail_postauth | fail_register

function makeMockServer(port, role) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        let j = null;
        try {
          j = JSON.parse(body);
        } catch {}
        res.setHeader("Content-Type", "application/json");
        // 步 ① /devin-auth/password/login
        if (role === "login") {
          if (__MOCK_MODE === "fail_login") {
            res.statusCode = 401;
            return res.end(JSON.stringify({ detail: "wrong_password" }));
          }
          res.statusCode = 200;
          return res.end(
            JSON.stringify({
              token: "mock-auth1-token-xyz",
              user_id: "mock-user-001",
            }),
          );
        }
        // 步 ② /WindsurfPostAuth
        if (role === "postauth") {
          if (__MOCK_MODE === "fail_postauth") {
            res.statusCode = 401;
            return res.end(
              JSON.stringify({
                code: "unauthenticated",
                message: "auth1 expired",
              }),
            );
          }
          res.statusCode = 200;
          return res.end(
            JSON.stringify({
              sessionToken: "devin-session-token$mock-session-abc123",
              accountId: "mock-acct-id-42",
              primaryOrgId: "mock-org-id-1",
            }),
          );
        }
        // 步 ③ /RegisterUser
        if (role === "register") {
          if (__MOCK_MODE === "fail_register") {
            res.statusCode = 500;
            return res.end(
              JSON.stringify({ code: "internal", message: "db down" }),
            );
          }
          res.statusCode = 200;
          return res.end(
            JSON.stringify({
              api_key: "ws-mock-real-source-key-7890abcd",
              api_server_url: "https://mock-server.codeium.com",
              name: "Mock User",
            }),
          );
        }
        res.statusCode = 404;
        res.end("{}");
      });
    });
    srv.listen(port, BIND, () => resolve(srv));
  });
}

function probe(method, urlPath, headers, body) {
  return new Promise((resolve) => {
    const opts = {
      hostname: BIND,
      port: PORT,
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

function waitHealth(maxMs) {
  // 印 129 · 用 /health 探活 · 替 stdout regex (更可靠 · 不挑日志格)
  const deadline = Date.now() + (maxMs || 8000);
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (Date.now() > deadline) return reject(new Error("/health 探活超时"));
      probe("GET", "/health", { Authorization: "Bearer " + AUTH })
        .then((r) => {
          if (r.status === 200) return resolve();
          setTimeout(tick, 100);
        })
        .catch(() => setTimeout(tick, 100));
    };
    setTimeout(tick, 200);
  });
}

// 印 129 修 · 圣人执一 · 同 _yin124 真本源 · graceful + force fallback + 等真 exit
// 治: Windows daemon.kill("SIGKILL") 不等 exit · 致 spawnSync 父退后 child 孤儿占端口
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

function spawnDaemon(mockPorts) {
  return new Promise((resolve, reject) => {
    const env = Object.assign({}, process.env, {
      PORT: String(PORT),
      BIND,
      DAO_AUTH_TOKEN: AUTH,
      WAM_FILE: path.join(__dirname, "_seal129_no_wam.json"),
      DEVIN_TOKEN: "",
      DEVIN_TOKENS: "",
      DAO_TOKENS_FILE: "",
      WS_TOKENS_FILE: path.join(__dirname, "_seal129_no_ws.txt"),
      WS_SIGNIN_LOGIN_OVERRIDE: `http://${BIND}:${mockPorts.login}/login`,
      WS_SIGNIN_POSTAUTH_OVERRIDE: `http://${BIND}:${mockPorts.postauth}/postauth`,
      WS_SIGNIN_REGISTER_OVERRIDE: `http://${BIND}:${mockPorts.register}/register`,
    });
    const child = spawn(process.execPath, [...__preserveFlags(), DAO_PROXY], {
      env,
      cwd: path.dirname(DAO_PROXY),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (c) => (stderr += c.toString()));
    child.stdout.on("data", () => {}); // 收 · 弃 (不挑日志格)
    // 用 /health polling 探活 · 替 stdout regex
    waitHealth(8000)
      .then(() => resolve(child))
      .catch((e) => {
        try {
          child.kill("SIGKILL");
        } catch {}
        reject(new Error(e.message + " · stderr=" + stderr.slice(-200)));
      });
  });
}

async function dynamicGuard() {
  console.log("\n═══ 二 · 动守 · 起 mock + spawn dao_proxy ═══");
  let logSrv, paSrv, regSrv, daemon;
  try {
    logSrv = await makeMockServer(0, "login");
    paSrv = await makeMockServer(0, "postauth");
    regSrv = await makeMockServer(0, "register");
    const ports = {
      login: logSrv.address().port,
      postauth: paSrv.address().port,
      register: regSrv.address().port,
    };
    ok(
      `mock 起 [login=${ports.login} postauth=${ports.postauth} register=${ports.register}]`,
    );

    daemon = await spawnDaemon(ports);
    ok("dao_proxy daemon 起 (with mock env)");

    // 1. health 探
    let h = await probe("GET", "/health", { Authorization: "Bearer " + AUTH });
    if (h.status === 200) ok("/health 真活 · 200");
    else ng("/health 真活", "status=" + (h.status || h.err));

    // 2. 成功链路
    __MOCK_MODE = "success";
    let r = await probe(
      "POST",
      "/admin/signin/windsurf",
      { Authorization: "Bearer " + AUTH },
      { email: "alice@example.com", password: "secret123" },
    );
    if (r.status === 200 && r.json && r.json.ok) ok("成功链 · 200 · ok=true");
    else
      ng(
        "成功链 · 200",
        "status=" + (r.status || r.err) + " json=" + JSON.stringify(r.json),
      );
    if (r.json && r.json.apiKey === "ws-mock-real-source-key-7890abcd")
      ok("成功链 · apiKey 真本源出");
    else ng("成功链 · apiKey 真本源出", "apiKey=" + (r.json && r.json.apiKey));
    if (
      r.json &&
      r.json.sessionToken &&
      r.json.sessionToken.startsWith("devin-session-token$")
    )
      ok("成功链 · sessionToken 格对 (devin-session-token$)");
    else
      ng(
        "成功链 · sessionToken 格对",
        "sessionToken=" + (r.json && r.json.sessionToken),
      );
    if (r.json && r.json.apiServerUrl === "https://mock-server.codeium.com")
      ok("成功链 · apiServerUrl 真出");
    else
      ng(
        "成功链 · apiServerUrl 真出",
        "apiServerUrl=" + (r.json && r.json.apiServerUrl),
      );
    if (r.json && r.json.accountId === "mock-acct-id-42")
      ok("成功链 · accountId 透传");
    else
      ng(
        "成功链 · accountId 透传",
        "accountId=" + (r.json && r.json.accountId),
      );
    if (r.json && r.json.email === "alice@example.com")
      ok("成功链 · email 回填");
    else ng("成功链 · email 回填", "email=" + (r.json && r.json.email));
    if (r.json && typeof r.json.ms === "number" && r.json.ms >= 0)
      ok("成功链 · ms 耗时返");
    else ng("成功链 · ms 耗时返", "ms=" + (r.json && r.json.ms));

    // 3. 失败 stage=devinLogin
    __MOCK_MODE = "fail_login";
    r = await probe(
      "POST",
      "/admin/signin/windsurf",
      { Authorization: "Bearer " + AUTH },
      { email: "bob@example.com", password: "wrong" },
    );
    if (
      r.status === 401 &&
      r.json &&
      r.json.ok === false &&
      r.json.stage === "devinLogin"
    )
      ok("失败链 · stage=devinLogin · 401 返");
    else
      ng(
        "失败链 · stage=devinLogin",
        "status=" + r.status + " stage=" + (r.json && r.json.stage),
      );

    // 4. 失败 stage=windsurfPostAuth
    __MOCK_MODE = "fail_postauth";
    r = await probe(
      "POST",
      "/admin/signin/windsurf",
      { Authorization: "Bearer " + AUTH },
      { email: "carol@example.com", password: "valid" },
    );
    if (r.status === 401 && r.json && r.json.stage === "windsurfPostAuth")
      ok("失败链 · stage=windsurfPostAuth · 401 返");
    else
      ng(
        "失败链 · stage=windsurfPostAuth",
        "status=" + r.status + " stage=" + (r.json && r.json.stage),
      );

    // 5. 失败 stage=registerUser
    __MOCK_MODE = "fail_register";
    r = await probe(
      "POST",
      "/admin/signin/windsurf",
      { Authorization: "Bearer " + AUTH },
      { email: "dave@example.com", password: "valid" },
    );
    if (r.status === 401 && r.json && r.json.stage === "registerUser")
      ok("失败链 · stage=registerUser · 401 返");
    else
      ng(
        "失败链 · stage=registerUser",
        "status=" + r.status + " stage=" + (r.json && r.json.stage),
      );

    // 6. 入参缺
    r = await probe(
      "POST",
      "/admin/signin/windsurf",
      { Authorization: "Bearer " + AUTH },
      { email: "", password: "" },
    );
    if (
      r.status === 400 &&
      r.json &&
      r.json.error === "email_and_password_required"
    )
      ok("入参缺 · 400 + email_and_password_required");
    else
      ng("入参缺", "status=" + r.status + " err=" + (r.json && r.json.error));

    // 7. 路径暴露在 404 hint
    r = await probe("GET", "/nonexistent", { Authorization: "Bearer " + AUTH });
    if (
      r.status === 404 &&
      r.json &&
      r.json.hint &&
      r.json.hint.includes("/admin/signin/windsurf")
    )
      ok("404 hint 含 /admin/signin/windsurf");
    else ng("404 hint", "hint=" + (r.json && (r.json.hint || "").slice(0, 80)));
  } catch (e) {
    ng("dynamic guard 整链", e.message);
  } finally {
    // 印 129 修 · 真本源 killDaemon · 等真 exit · 不留孤儿占 17829
    if (daemon) {
      await killDaemon(daemon);
    }
    if (logSrv) {
      try {
        logSrv.close();
      } catch {}
    }
    if (paSrv) {
      try {
        paSrv.close();
      } catch {}
    }
    if (regSrv) {
      try {
        regSrv.close();
      } catch {}
    }
  }
}

(async () => {
  console.log("═══════════════════════════════════════════════════");
  console.log(" 印 129 · 真本源切号守门 · 反者道之动");
  console.log("═══════════════════════════════════════════════════");
  staticGuard();
  await dynamicGuard();
  console.log(`\n═══ 印 129 总: ${pass} 过 / ${fail} 失 ═══`);
  if (fail > 0) {
    console.log("\n失:");
    fails.forEach((f) => console.log("  · " + f));
    process.exit(1);
  } else {
    console.log(
      "\n✓ 真本源切号链通 · 代主公登 windsurf · 反者道之动 · 道法自然",
    );
    process.exit(0);
  }
})();
