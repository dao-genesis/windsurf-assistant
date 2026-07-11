#!/usr/bin/env node
// _seal_inf_yiqi_real_impl_smoke.cjs · 印 ∞ 道动测真实证 (印 ∞.3 + 印 ∞.4 + 印 133 闭环)
//
//   帛书廿五: 「大曰逝 · 逝曰远 · 远曰反」道之运动
//   帛书四十: 「反者道之动 · 弱者道之用」
//   帛书六十四: 「慎终若始 · 则无败事矣」
//
//   主公诏 (2026-05-17 20:08):
//     「重新解构最初本源提示词 · 解构所有底层需求
//      C:\Users\Administrator\.wam\accounts.md 带入用户一切」
//
//   守门覆 3 印:
//     1. 印 ∞.3 · handleAdminKeysAdd 兼 devin-session-token$ 前缀
//        - 真 windsurf register 返之 api_key 是 devin-session-token$<JWT> · 非 ws-*
//        - 13/13 真 auth1 → ②③ 链 → 全返 devin-session-token$ 前缀实证
//        - 治: prefix 字段返 'devin-session' · warn 仅 mock-or-other 时给
//     2. 印 ∞.4 · wsChat 优先用 keyObj.srvUrl 之 hostname (再回退 WS_CHAT_HOSTS)
//        - admin/keys/add 收 srvUrl 但 wsChat 旧用硬编码 [codeium, self-serve, web-backend]
//        - 真 register 返 api_server_url = server.self-serve.windsurf.com
//        - 治: 若 keyObj.srvUrl 解出 hostname · 优先加入 hostList 首位
//     3. 印 133 · /admin/wam/local 真解析 accounts.md (主公真号库)
//        - 已实证 179 件解析 + 13 auth1 类件全识

"use strict";
const http = require("http");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const SCRIPT = path.join(
  __dirname,
  "..",
  "packages",
  "dao-devin-vm",
  "dao_proxy.js",
);
const PORT = 17779; // 守门专用端 (避撞 daemon)
const HOST = "127.0.0.1";

function httpReq(method, p, body, hdrs) {
  return new Promise((resolve) => {
    const opts = {
      hostname: HOST,
      port: PORT,
      path: p,
      method,
      headers: Object.assign(
        { "Content-Type": "application/json" },
        hdrs || {},
      ),
    };
    const req = http.request(opts, (r) => {
      let d = "";
      r.on("data", (c) => (d += c));
      r.on("end", () => {
        let j = null;
        try {
          j = JSON.parse(d);
        } catch {}
        resolve({ status: r.statusCode, json: j, text: d });
      });
    });
    req.on("error", (e) => resolve({ status: 0, error: e.message }));
    if (body) req.write(typeof body === "string" ? body : JSON.stringify(body));
    req.end();
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitReady(maxMs = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const r = await httpReq("GET", "/health");
    if (r.status === 200) return true;
    await sleep(200);
  }
  return false;
}

(async () => {
  console.log("══════════════════════════════════════════════════════════════");
  console.log(" 印 ∞ · 道动测真实证 (∞.3 + ∞.4 + 133) · 大曰逝逝曰远远曰反");
  console.log("══════════════════════════════════════════════════════════════");

  // 起子 daemon (隔离端 17779)
  const env = Object.assign({}, process.env, {
    PORT: String(PORT),
    VERBOSE: "0",
    // 隔离: 不读真 wam-state (避污)
    WAM_FILE: path.join(__dirname, "_seal_inf_yiqi_mock_wam.json"),
  });
  // 写一个空 wam-state mock
  fs.writeFileSync(
    env.WAM_FILE,
    JSON.stringify({ version: "test", accounts: [] }),
  );
  const child = spawn(process.execPath, [SCRIPT], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let killed = false;
  const kill = () => {
    if (!killed) {
      killed = true;
      try {
        child.kill();
      } catch {}
    }
  };
  process.on("exit", kill);

  const ready = await waitReady();
  if (!ready) {
    console.error("✗ daemon 起失败 (8s 内 /health 未通)");
    kill();
    process.exit(1);
  }
  console.log("✓ daemon 起 · /health 通\n");

  let pass = 0;
  let fail = 0;
  const tests = [];

  // ════════════════════════════════════════════════════════════════════════
  // 印 ∞.3 · prefix 验
  // ════════════════════════════════════════════════════════════════════════
  console.log("─── 印 ∞.3 · apiKey 前缀真本源验 ───");

  // 1.1 · devin-session-token$ (主路 · 真 windsurf register 之果)
  let r = await httpReq("POST", "/admin/keys/add", {
    apiKey: "devin-session-token$mock.jwt.signature",
    srvUrl: "https://server.self-serve.windsurf.com",
    email: "test-devin-session@yin-inf.demo",
  });
  if (
    r.json &&
    r.json.ok &&
    r.json.prefix === "devin-session" &&
    r.json.warn === null
  ) {
    console.log("  ✓ devin-session-token$ · prefix=devin-session · warn=null");
    tests.push({ name: "yin∞.3.a · devin-session 主路", ok: true });
    pass++;
  } else {
    console.log(
      "  ✗ devin-session-token$ · 期 prefix=devin-session warn=null · 实: " +
        JSON.stringify(r.json),
    );
    tests.push({ name: "yin∞.3.a · devin-session 主路", ok: false });
    fail++;
  }

  // 1.2 · ws-* (旧 wam-bundle alias · 兼容)
  r = await httpReq("POST", "/admin/keys/add", {
    apiKey: "ws-mock-legacy-12345",
    email: "test-ws-legacy@yin-inf.demo",
  });
  if (r.json && r.json.ok && r.json.prefix === "ws-" && r.json.warn === null) {
    console.log("  ✓ ws-* · prefix=ws- · warn=null (兼容)");
    tests.push({ name: "yin∞.3.b · ws- 兼容", ok: true });
    pass++;
  } else {
    console.log(
      "  ✗ ws-* · 期 prefix=ws- warn=null · 实: " + JSON.stringify(r.json),
    );
    tests.push({ name: "yin∞.3.b · ws- 兼容", ok: false });
    fail++;
  }

  // 1.3 · mock/其他 · 应给 warn
  r = await httpReq("POST", "/admin/keys/add", {
    apiKey: "totally-random-mock-key-no-real-prefix",
    email: "mock@yin-inf.demo",
  });
  console.log("  · mock 反: " + JSON.stringify(r.json));
  if (
    r.json &&
    r.json.ok &&
    r.json.prefix === "mock-or-other" &&
    typeof r.json.warn === "string" &&
    r.json.warn.includes("not real")
  ) {
    console.log("  ✓ mock · prefix=mock-or-other · warn=非真前缀");
    tests.push({ name: "yin∞.3.c · mock warn", ok: true });
    pass++;
  } else {
    console.log("  ✗ mock · 期 prefix=mock-or-other warn=非真前缀");
    tests.push({ name: "yin∞.3.c · mock warn", ok: false });
    fail++;
  }

  // ════════════════════════════════════════════════════════════════════════
  // 印 ∞.4 · wsChat hostList 含 keyObj.srvUrl 首位 (静态验 · 看 list 之 srvUrl 留)
  // ════════════════════════════════════════════════════════════════════════
  console.log("\n─── 印 ∞.4 · keyObj.srvUrl 优先 (静态验 list) ───");
  const listR = await httpReq("GET", "/admin/keys/list");
  if (listR.json && Array.isArray(listR.json.keys)) {
    // mask 后 apiKey 形如 "devin-session…" (截短无 $)
    // 故按 email 找回 (test-devin-session@yin-inf.demo)
    const devSes = listR.json.keys.find(
      (k) => k.email === "test-devin-session@yin-inf.demo",
    );
    if (devSes && devSes.srvUrl === "https://server.self-serve.windsurf.com") {
      console.log(
        `  ✓ devin-session key · srvUrl=server.self-serve.windsurf.com 真留 · key=${devSes.apiKey}`,
      );
      tests.push({ name: "yin∞.4.a · srvUrl 留", ok: true });
      pass++;
    } else {
      console.log("  ✗ srvUrl 未留 · 实: " + JSON.stringify(devSes));
      tests.push({ name: "yin∞.4.a · srvUrl 留", ok: false });
      fail++;
    }
  } else {
    console.log("  ✗ list 返不对 · " + JSON.stringify(listR.json));
    tests.push({ name: "yin∞.4.a · srvUrl 留", ok: false });
    fail++;
  }

  // ════════════════════════════════════════════════════════════════════════
  // 印 133 · /admin/wam/local 真解析 accounts.md
  // ════════════════════════════════════════════════════════════════════════
  console.log("\n─── 印 133 · /admin/wam/local 解析 ───");
  // 立 fixture (mock accounts.md 含 token + email_password 各 1)
  // 注: 此 daemon 之 _wam133_paths() 默指 ~/.wam · 但子 daemon 之 env 未 override
  //   故 /admin/wam/local 仍读真 ~/.wam (这是 印 133 之 design · 守 localhost)
  //   守门此处仅验端点活性 + 返结构 · 不验内容 (因主公真号库私 · 不入 git)
  const wamR = await httpReq("GET", "/admin/wam/local");
  if (
    wamR.status === 200 &&
    wamR.json &&
    typeof wamR.json.available === "boolean" &&
    Array.isArray(wamR.json.items)
  ) {
    console.log(
      `  ✓ /admin/wam/local · available=${wamR.json.available} · items=${wamR.json.items.length}`,
    );
    tests.push({ name: "yin133.a · /admin/wam/local 端点活", ok: true });
    pass++;
  } else {
    console.log(
      "  ✗ /admin/wam/local 返不对 · " +
        JSON.stringify(wamR.json).slice(0, 200),
    );
    tests.push({ name: "yin133.a · /admin/wam/local 端点活", ok: false });
    fail++;
  }

  // ════════════════════════════════════════════════════════════════════════
  // 终: 总结 + 退
  // ════════════════════════════════════════════════════════════════════════
  console.log(
    "\n══════════════════════════════════════════════════════════════",
  );
  console.log(` 总: ${pass} 通 / ${fail} 败 / ${tests.length} 计`);
  console.log("══════════════════════════════════════════════════════════════");

  // 清 mock wam
  try {
    fs.unlinkSync(env.WAM_FILE);
  } catch {}

  kill();
  await sleep(100);
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => {
  console.error("守门内部异: " + (e && (e.stack || e.message)));
  process.exit(2);
});
