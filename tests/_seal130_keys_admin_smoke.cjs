#!/usr/bin/env node
// _seal130_keys_admin_smoke.cjs · 印 130 · 真本源接入闭环守门 · 反者道之动
//
// 主公诏 (2026-05-17 16:11):
//   「反者 道之动也 · 不作茧自缚 · 不限制 · 不惧 方能成其大」
//   「继续验证使用完善反代底层 · 一气化三清」
//   「无为而无不为 · 道法自然」
//
// 印 130 之核 (承印 129):
//   印 129 立真本源切号链 (代主公登 windsurf 出 ws-* key)
//   印 130 立真本源接入池 (key → POST /admin/keys/add → WS_POOL_STATE.keys.push)
//   登→入池→用 一线到底 · 三清归一
//
// 守门策略:
//   静守 ─ dao_proxy.js / dao_app.js 含 §印 130 + handler + 路由 + web 自接入
//   动守 ─ spawn dao_proxy · curl /admin/keys/{add,list,remove} · auth/去重/守隐验
"use strict";
const path = require("path");
const http = require("http");
const fs = require("fs");
const { spawn } = require("child_process");

// 印 131 · 中文路径 · 子进程承双旗 (圣人执一)
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
const PORT = 17830,
  BIND = "127.0.0.1";
const AUTH = "seal130-test-aaaaaaaa-bbbb-cccc-dddd-ffffffffffff";

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
  // dao_proxy.js · §印 130 节
  const checks = [
    [
      "dao_proxy 含 §印 130 节",
      proxyText.includes("§ 印 130 · 真本源接入闭环"),
    ],
    [
      "dao_proxy 含 handleAdminKeysAdd",
      proxyText.includes("handleAdminKeysAdd"),
    ],
    [
      "dao_proxy 含 handleAdminKeysList",
      proxyText.includes("handleAdminKeysList"),
    ],
    [
      "dao_proxy 含 handleAdminKeysRemove",
      proxyText.includes("handleAdminKeysRemove"),
    ],
    ["dao_proxy 含 _maskKey helper", proxyText.includes("function _maskKey(")],
    [
      "dao_proxy 路由含 /admin/keys/add",
      proxyText.includes('p === "/admin/keys/add"'),
    ],
    [
      "dao_proxy 路由含 /admin/keys/list",
      proxyText.includes('p === "/admin/keys/list"'),
    ],
    [
      "dao_proxy 路由含 /admin/keys/remove",
      proxyText.includes('p === "/admin/keys/remove"'),
    ],
    [
      "dao_proxy 推 WS_POOL_STATE.keys",
      /WS_POOL_STATE\.keys\.push\(/.test(proxyText),
    ],
    [
      "dao_proxy 守隐 _maskKey 切前 12 字",
      /\.slice\(0,\s*12\)\s*\+\s*"…"/.test(proxyText),
    ],
    ["dao_proxy 含 duplicate 幂等返", proxyText.includes("duplicate: true")],
    [
      "dao_proxy 守 cursor 不溢 (帛书三十二)",
      /cursor\s*>=?\s*WS_POOL_STATE\.keys\.length/.test(proxyText),
    ],
    [
      "dao_proxy 404 hint 含印 130 三路",
      /POST \/admin\/keys\/add[\s\S]{0,80}\/admin\/keys\/list[\s\S]{0,80}\/admin\/keys\/remove/.test(
        proxyText,
      ),
    ],
    // web/dao_app.js · 印 130 自接入
    [
      "dao_app 含 印 130 · 真本源接入闭环 注",
      appText.includes("印 130 · 真本源接入闭环"),
    ],
    [
      "dao_app autoSigninWindsurf 末调 /admin/keys/add",
      /autoSigninWindsurf[\s\S]{0,3000}\/admin\/keys\/add/.test(appText),
    ],
    [
      "dao_app 自接入送 apiKey + srvUrl + email",
      /apiKey:\s*j\.apiKey[\s\S]{0,200}srvUrl:[\s\S]{0,100}email:/.test(
        appText,
      ),
    ],
    [
      "dao_app 接入失败不阻 (锦上添花 · 帛书四)",
      appText.includes("锦上添花") || appText.includes("失败不阻"),
    ],
    ["dao_app 显池 count 反馈", /池\+1|count=/.test(appText)],
    [
      "dao_app 调 vmAuthKey 守 (印 106)",
      /\/admin\/keys\/add[\s\S]{0,500}vmAuthKey[\s\S]{0,200}Bearer/.test(
        appText,
      ),
    ],
    // 帛书引 · 道义
    [
      "印 130 引帛书 廿二 圣人执一",
      proxyText.includes("「圣人执一 · 以为天下牧」"),
    ],
    [
      "印 130 引帛书 四十八 损之又损",
      proxyText.includes("「为道者日损 · 损之又损"),
    ],
    ["印 130 引庄子 物无非彼", proxyText.includes("物无非彼")],
  ];
  for (const [name, c] of checks) (c ? ok : ng)(name, "缺");
}

// ════════════════════════════════════════════════════════════════════
// § 二 · 动守 · spawn dao_proxy · 真路验
// ════════════════════════════════════════════════════════════════════
function probe(method, path, headers, body) {
  return new Promise((resolve) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        host: BIND,
        port: PORT,
        method,
        path,
        headers: Object.assign(
          { "Content-Type": "application/json" },
          payload ? { "Content-Length": Buffer.byteLength(payload) } : {},
          headers || {},
        ),
        timeout: 4000,
      },
      (res) => {
        let buf = "";
        res.on("data", (c) => (buf += c));
        res.on("end", () => {
          let json = null;
          try {
            json = JSON.parse(buf);
          } catch {}
          resolve({ status: res.statusCode, json, raw: buf });
        });
      },
    );
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

// 同 _seal129 · graceful + force fallback · 治 Win 孤儿端口
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

function spawnDaemon() {
  return new Promise((resolve, reject) => {
    const env = Object.assign({}, process.env, {
      PORT: String(PORT),
      BIND,
      DAO_AUTH_TOKEN: AUTH,
      WAM_FILE: path.join(__dirname, "_seal130_no_wam.json"),
      DEVIN_TOKEN: "",
      DEVIN_TOKENS: "",
      DAO_TOKENS_FILE: "",
      // 印 130 关键: WS_TOKENS_FILE 不存在 · 池启动空 · 测 admin/keys/add 真注入
      WS_TOKENS_FILE: path.join(__dirname, "_seal130_no_ws.txt"),
    });
    const child = spawn(process.execPath, [...__preserveFlags(), DAO_PROXY], {
      env,
      cwd: path.dirname(DAO_PROXY),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (c) => (stderr += c.toString()));
    child.stdout.on("data", () => {});
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
  console.log("\n═══ 二 · 动守 · spawn dao_proxy · 真路验 ═══");
  let daemon;
  try {
    daemon = await spawnDaemon();
    ok("dao_proxy daemon 起 (无 ws tokens · 池启动空)");

    const H = { Authorization: "Bearer " + AUTH };

    // T1 · 池启动空 (WS_TOKENS_FILE 不存在)
    {
      const r = await probe("GET", "/admin/keys/list", H);
      if (r.status === 200 && r.json && r.json.ok && r.json.count === 0) {
        ok("T1 · /admin/keys/list 启动空 · count=0");
      } else {
        ng(
          "T1 · /admin/keys/list 启动空",
          `status=${r.status} json=${JSON.stringify(r.json).slice(0, 80)}`,
        );
      }
    }

    // T2 · 加 ws-* key (印 129 真本源链路出之 key 模拟)
    const fakeKey1 = "ws-test-130-AAAAAAAAAAAAAAAAAAAAAAAAAA1";
    {
      const r = await probe("POST", "/admin/keys/add", H, {
        apiKey: fakeKey1,
        srvUrl: "https://server.codeium.com",
        email: "alice@windsurf.com",
      });
      if (r.status === 200 && r.json && r.json.ok && r.json.count === 1) {
        ok("T2 · /admin/keys/add 加 ws-* · count=1");
      } else {
        ng(
          "T2 · /admin/keys/add 加 ws-*",
          `status=${r.status} json=${JSON.stringify(r.json).slice(0, 80)}`,
        );
      }
      // 守隐 · apiKey 仅前 12 字 + …
      if (
        r.json &&
        typeof r.json.apiKey === "string" &&
        r.json.apiKey.endsWith("…") &&
        !r.json.apiKey.includes(fakeKey1.slice(15))
      ) {
        ok("T2 · 守隐 · apiKey 仅前 12 字 (脱敏)");
      } else {
        ng("T2 · 守隐", `apiKey=${r.json && r.json.apiKey}`);
      }
    }

    // T3 · 加 第二 key
    const fakeKey2 = "ws-test-130-BBBBBBBBBBBBBBBBBBBBBBBBBB2";
    {
      const r = await probe("POST", "/admin/keys/add", H, {
        apiKey: fakeKey2,
        email: "bob@windsurf.com",
      });
      if (r.status === 200 && r.json && r.json.ok && r.json.count === 2) {
        ok("T3 · 加第二 ws-* · count=2");
      } else {
        ng("T3 · 加第二", `status=${r.status} count=${r.json && r.json.count}`);
      }
    }

    // T4 · 列池态 (验 2 keys + 守隐 + email)
    {
      const r = await probe("GET", "/admin/keys/list", H);
      if (r.status === 200 && r.json && r.json.count === 2) {
        ok("T4 · /admin/keys/list count=2");
      } else {
        ng("T4 · /list count", `count=${r.json && r.json.count}`);
      }
      const keys = (r.json && r.json.keys) || [];
      // 验所有 apiKey 脱敏
      const allMasked = keys.every(
        (k) => typeof k.apiKey === "string" && k.apiKey.endsWith("…"),
      );
      if (allMasked) ok("T4 · 列时所有 apiKey 脱敏");
      else ng("T4 · 列时脱敏", "有未脱敏 key");
      // 验 email 透传
      const hasEmails = keys.some((k) => k.email === "alice@windsurf.com");
      if (hasEmails) ok("T4 · email 透传 (alice@windsurf.com)");
      else ng("T4 · email", "未透传");
      // 验 srvUrl
      const hasSrv = keys.some(
        (k) => k.srvUrl === "https://server.codeium.com",
      );
      if (hasSrv) ok("T4 · srvUrl 透传");
      else ng("T4 · srvUrl", "未透传");
    }

    // T5 · 去重幂等 (再加 fakeKey1 · 应返 duplicate=true · 200)
    {
      const r = await probe("POST", "/admin/keys/add", H, {
        apiKey: fakeKey1,
      });
      if (
        r.status === 200 &&
        r.json &&
        r.json.ok &&
        r.json.duplicate === true &&
        r.json.count === 2
      ) {
        ok("T5 · 去重幂等 · duplicate=true · count 不增");
      } else {
        ng(
          "T5 · 去重幂等",
          `status=${r.status} dup=${r.json && r.json.duplicate} count=${r.json && r.json.count}`,
        );
      }
    }

    // T6 · 加非 ws- key · warn 不阻
    {
      const r = await probe("POST", "/admin/keys/add", H, {
        apiKey: "mock-key-xyz-999",
      });
      if (
        r.status === 200 &&
        r.json &&
        r.json.ok &&
        r.json.count === 3 &&
        r.json.warn
      ) {
        ok("T6 · 非 ws- 前缀 · warn 但加 (不强 · count=3)");
      } else {
        ng(
          "T6 · 非 ws- 前缀",
          `status=${r.status} warn=${r.json && r.json.warn}`,
        );
      }
    }

    // T7 · 入参缺 · 400
    {
      const r = await probe("POST", "/admin/keys/add", H, {});
      if (r.status === 400 && r.json && r.json.error === "api_key_required") {
        ok("T7 · 缺 apiKey · 400 + api_key_required");
      } else {
        ng("T7 · 缺 apiKey 验", `status=${r.status}`);
      }
    }

    // T8 · 移除 fakeKey1
    {
      const r = await probe("POST", "/admin/keys/remove", H, {
        apiKey: fakeKey1,
      });
      if (r.status === 200 && r.json && r.json.ok && r.json.removed === 1) {
        ok("T8 · /admin/keys/remove · removed=1");
      } else {
        ng(
          "T8 · remove",
          `status=${r.status} removed=${r.json && r.json.removed}`,
        );
      }
    }

    // T9 · 移除不存在 · 404
    {
      const r = await probe("POST", "/admin/keys/remove", H, {
        apiKey: "ws-no-such-key",
      });
      if (r.status === 404 && r.json && r.json.removed === 0) {
        ok("T9 · 移除不存在 · 404 + removed=0");
      } else {
        ng(
          "T9 · 移除不存在",
          `status=${r.status} removed=${r.json && r.json.removed}`,
        );
      }
    }

    // T10 · 列池验 count=2 (移 1 后)
    {
      const r = await probe("GET", "/admin/keys/list", H);
      if (r.status === 200 && r.json && r.json.count === 2) {
        ok("T10 · 移除后 count=2");
      } else {
        ng("T10 · 移除后 count", `count=${r.json && r.json.count}`);
      }
    }

    // T11 · auth 守门 (无 token · 401)
    {
      const r = await probe("POST", "/admin/keys/add", null, {
        apiKey: "ws-noauth-test",
      });
      if (r.status === 401) {
        ok("T11 · 无 auth · 401 (印 106 守门 + 印 130 自承)");
      } else {
        ng("T11 · auth 守门", `status=${r.status}`);
      }
    }

    // T12 · 错 token · 403
    {
      const r = await probe(
        "POST",
        "/admin/keys/add",
        { Authorization: "Bearer wrong-token" },
        {
          apiKey: "ws-wrongauth-test",
        },
      );
      if (r.status === 403) {
        ok("T12 · 错 token · 403");
      } else {
        ng("T12 · 错 token", `status=${r.status}`);
      }
    }

    // T13 · 404 hint 含印 130 三路
    {
      const r = await probe("GET", "/no-such-path", H);
      if (
        r.status === 404 &&
        r.json &&
        r.json.hint &&
        r.json.hint.includes("/admin/keys/add") &&
        r.json.hint.includes("/admin/keys/list") &&
        r.json.hint.includes("/admin/keys/remove")
      ) {
        ok("T13 · 404 hint 含印 130 三路");
      } else {
        ng("T13 · 404 hint", "缺印 130 三路");
      }
    }
  } catch (e) {
    ng("dynamic guard 整链", e.message);
  } finally {
    if (daemon) {
      await killDaemon(daemon);
    }
  }
}

// ════════════════════════════════════════════════════════════════════
// § 三 · 总
// ════════════════════════════════════════════════════════════════════
async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log(" 印 130 · 真本源接入闭环守门 · 反者道之动");
  console.log("═══════════════════════════════════════════════════");
  staticGuard();
  await dynamicGuard();
  console.log(`\n═══ 印 130 总: ${pass} 过 / ${fail} 失 ═══`);
  if (fail > 0) {
    console.log("\n失:");
    fails.forEach((f) => console.log("  - " + f));
    process.exit(1);
  } else {
    console.log("\n✓ 真本源接入闭环通 · 登→入池→用 一线到底 · 道法自然");
  }
}

main().catch((e) => {
  console.error("守门崩:", e);
  process.exit(2);
});
