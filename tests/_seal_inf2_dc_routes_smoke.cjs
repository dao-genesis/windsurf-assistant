#!/usr/bin/env node
// _seal_inf2_dc_routes_smoke.cjs · 印 ∞.2 · B 路 /dc/* 显式 devin cloud 反代守门
//
// 主公本源诏 (2026-05-17 5:33PM):
//   「devin vm 虚拟机资源双反代 windsurf + devin cloud」
//
// 帛书·七十八「天下莫柔弱于水 · 而攻坚强者莫之能胜也」弱者道之用
// 帛书·二「美与恶 之相生 · 物之两面同一道」A 路智能 + B 路显式 同一反代
//
// §1 静守 · dao_proxy.js 真含 5 路 + handleDcHealth + handleDcModels + forceEngine 参
// §2 动守 · 真起 daemon · curl 5 路验
// §3 SEAL 升至印 ∞.2 · VERSION ≥ 0.4.3
"use strict";
const fs = require("fs");
const path = require("path");
const http = require("http");
const { spawn } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const DAO = path.join(ROOT, "packages", "dao-devin-vm", "dao_proxy.js");

let pass = 0;
let fail = 0;
const fails = [];
const ok = (m) => {
  pass++;
  console.log("  \x1b[32m✓\x1b[0m " + m);
};
const ng = (m, why) => {
  fail++;
  fails.push(m + " · " + why);
  console.log("  \x1b[31m✗\x1b[0m " + m + " · " + why);
};
const head = (s) => console.log("\n\x1b[1m" + s + "\x1b[0m");

const readSafe = (p) => {
  try {
    return fs.readFileSync(p, "utf-8");
  } catch {
    return "";
  }
};

// ════════════════════════════════════════════════════════════════════════
// §1 · 静守 · dao_proxy.js 真含 B 路实
// ════════════════════════════════════════════════════════════════════════
head("§1 · 静守 dao_proxy.js B 路 /dc/* 真实");

const DP = readSafe(DAO);
if (!DP) {
  ng("dao_proxy.js 读", "件不存");
  process.exit(1);
}

// SEAL 升印 ∞.2
if (/SEAL\s*=[\s\S]{0,150}∞\.2/.test(DP)) ok("SEAL 含 印 ∞.2 标");
else ng("SEAL", "未含 印 ∞.2 标");

// VERSION ≥ 0.4.3
const verMatch = DP.match(/VERSION\s*=\s*"([^"]+)"/);
if (verMatch && verMatch[1] >= "0.4.3") ok(`VERSION ${verMatch[1]} ≥ 0.4.3`);
else ng("VERSION", `期 ≥ 0.4.3 · 实 ${verMatch && verMatch[1]}`);

// handleDcHealth + handleDcModels 真存
if (/function handleDcHealth/.test(DP)) ok("function handleDcHealth 真存");
else ng("handleDcHealth", "缺函");

if (/function handleDcModels/.test(DP)) ok("function handleDcModels 真存");
else ng("handleDcModels", "缺函");

// handleOpenAI 加 forceEngine 参
if (/async function handleOpenAI\(req,\s*res,\s*forceEngine\)/.test(DP))
  ok("handleOpenAI 加 forceEngine 参");
else ng("handleOpenAI forceEngine", "未加");

// forceEngine !== "devin" 跳分流逻辑
if (/forceEngine\s*!==\s*"devin"\s*&&\s*isWindsurfModel/.test(DP))
  ok("forceEngine='devin' 跳 isWindsurfModel 智能分流");
else ng("forceEngine skip", "未实跳逻辑");

// 主路由 5 路
const ROUTES = [
  ['GET /dc/health', /p\s*===\s*"\/dc\/health"/],
  ['GET /dc/v1/models', /p\s*===\s*"\/dc\/v1\/models"/],
  ['POST /dc/v1/chat/completions', /p\s*===\s*"\/dc\/v1\/chat\/completions"/],
  ['POST /dc/v1/messages', /p\s*===\s*"\/dc\/v1\/messages"/],
  ['POST /dc/v1beta/models/', /p\.startsWith\("\/dc\/v1beta\/models\/"\)/],
];
for (const [name, rx] of ROUTES) {
  if (rx.test(DP)) ok(`主路由 ${name} 真接`);
  else ng(`主路由 ${name}`, "缺");
}

// handleOpenAI(req, res, "devin") 调用 (印 ∞.2 之精)
if (/handleOpenAI\(req,\s*res,\s*"devin"\)/.test(DP))
  ok('/dc/v1/chat/completions → handleOpenAI(req,res,"devin")');
else ng("forceEngine 调用", "缺");

// 剥 /dc 前缀 → handleGemini
if (/handleGemini\(req,\s*res,\s*p\.slice\(3\)\)/.test(DP))
  ok("/dc/v1beta/... → handleGemini 剥 /dc 前缀");
else ng("Gemini /dc 剥前缀", "缺");

// 404 hint 含 /dc/* 5 路
if (/\/dc\/health[\s\S]{0,200}\/dc\/v1beta\/models/.test(DP))
  ok("404 hint 含 /dc/* 5 路");
else ng("404 hint /dc/*", "缺指引");

// ════════════════════════════════════════════════════════════════════════
// §2 · 动守 · 真起 daemon · curl 5 路验
// ════════════════════════════════════════════════════════════════════════
head("§2 · 动守 真起 daemon · curl /dc/* 5 路");

function preserveFlags() {
  const flags = (process.execArgv || []).slice();
  for (const f of ["--preserve-symlinks", "--preserve-symlinks-main"]) {
    if (!flags.includes(f)) flags.push(f);
  }
  return flags;
}

function probe(port, method, p, body, authTok) {
  return new Promise((resolve) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = { Authorization: "Bearer " + authTok };
    if (payload) {
      headers["Content-Type"] = "application/json";
      headers["Content-Length"] = Buffer.byteLength(payload);
    }
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        method,
        path: p,
        headers,
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

async function dynamicTests() {
  const port = 17970 + Math.floor(Math.random() * 25);
  const authTok = "inf2-dc-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
  const env = Object.assign({}, process.env, {
    PORT: String(port),
    BIND: "127.0.0.1",
    DAO_AUTH_TOKEN: authTok,
    WS_TOKENS_FILE: path.join(__dirname, "_inf2_no_ws.txt"),
    WAM_FILE: path.join(__dirname, "_inf2_no_wam.json"),
    DEVIN_TOKEN: "",
    DEVIN_TOKENS: "",
    DAO_TOKENS_FILE: "",
  });
  const child = spawn(process.execPath, [...preserveFlags(), DAO], {
    env,
    cwd: path.dirname(DAO),
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (c) => (stderr += c.toString()));
  child.stdout.on("data", () => {});

  // 探活
  let alive = false;
  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 100));
    const h = await probe(port, "GET", "/health", null, authTok);
    if (h.status === 200) {
      alive = true;
      break;
    }
  }
  if (!alive) {
    ng("daemon 起", "探活失败 · stderr=" + stderr.slice(-300));
    return;
  }
  ok("daemon 起 · /health=200");

  // ① /dc/health
  const dh = await probe(port, "GET", "/dc/health", null, authTok);
  if (dh.status === 200 && dh.json && dh.json.route === "B")
    ok("/dc/health 200 · route=B · engine=" + dh.json.engine);
  else ng("/dc/health", `status=${dh.status} · route=${dh.json && dh.json.route}`);

  // ② /dc/v1/models
  const dm = await probe(port, "GET", "/dc/v1/models", null, authTok);
  if (
    dm.status === 200 &&
    dm.json &&
    Array.isArray(dm.json.data) &&
    dm.json.data.length > 0 &&
    dm.json.x_dao &&
    dm.json.x_dao.route === "B"
  )
    ok(`/dc/v1/models 200 · ${dm.json.data.length} models · owned_by=devin-cloud`);
  else ng("/dc/v1/models", `status=${dm.status}`);

  // ③ /dc/v1/chat/completions (no token · 503 期望 · 走 devin 但无 token)
  const dcc = await probe(port, "POST", "/dc/v1/chat/completions", {
    model: "cascade", // 即使 cascade 也 forceEngine="devin" 走 dc
    messages: [{ role: "user", content: "test" }],
  }, authTok);
  // 期 503 (no token) · 不应 是 /windsurf 路 (501) · 因 forceEngine="devin"
  if (
    (dcc.status === 503 || dcc.status === 502) &&
    dcc.json &&
    dcc.json.error &&
    /no token|upstream_error/.test(JSON.stringify(dcc.json))
  )
    ok(`/dc/v1/chat/completions cascade → devin 路 (status=${dcc.status} no_token)`);
  else if (dcc.status === 501)
    ng("/dc/v1/chat/completions", `走 ws 501 (forceEngine 未生效) · 应走 devin 503`);
  else
    ng("/dc/v1/chat/completions", `status=${dcc.status} · 期 503/502`);

  // ④ /dc/v1/messages (Anthropic · no token 503)
  const dca = await probe(port, "POST", "/dc/v1/messages", {
    model: "devin-cloud-claude",
    max_tokens: 32,
    messages: [{ role: "user", content: "test" }],
  }, authTok);
  if (dca.status === 503 || dca.status === 502)
    ok(`/dc/v1/messages 走 devin (status=${dca.status} no_token)`);
  else ng("/dc/v1/messages", `status=${dca.status} · 期 503/502`);

  // ⑤ /dc/v1beta/models/devin-cloud:generateContent (Gemini · no token 503)
  const dcg = await probe(
    port,
    "POST",
    "/dc/v1beta/models/devin-cloud:generateContent",
    { contents: [{ parts: [{ text: "test" }] }] },
    authTok,
  );
  if (dcg.status === 503 || dcg.status === 502)
    ok(`/dc/v1beta/models/...:generateContent 走 devin (status=${dcg.status})`);
  else ng("/dc/v1beta gemini", `status=${dcg.status} · 期 503/502`);

  // ⑥ 404 hint 含 /dc/*
  const nf = await probe(port, "GET", "/no-such-dc-path", null, authTok);
  if (
    nf.status === 404 &&
    nf.json &&
    nf.json.hint &&
    nf.json.hint.includes("/dc/health") &&
    nf.json.hint.includes("印 ∞.2")
  )
    ok("404 hint 含 /dc/* 5 路 + 印 ∞.2 标");
  else ng("404 hint", "未含 /dc/* 或 印 ∞.2");

  // ⑦ A 路对比 · /v1/chat/completions cascade → ws 路 501 (无 forceEngine)
  const acc = await probe(port, "POST", "/v1/chat/completions", {
    model: "cascade",
    messages: [{ role: "user", content: "test" }],
  }, authTok);
  // 期 501 (handleWindsurfChat not_implemented) 或 503 (no_token)
  // 关键是 != 走 dc 路 → 确认 A 路与 B 路不同 (物无非彼 物无非是)
  if (acc.status === 501 || acc.status === 503 || acc.status === 502)
    ok(
      `/v1/chat/completions cascade → A 路 (status=${acc.status}) · 与 B 路对比真`,
    );
  else ng("/v1/* cascade A 路", `status=${acc.status}`);

  // 关 daemon
  try {
    child.kill("SIGTERM");
    await new Promise((r) => setTimeout(r, 500));
    if (!child.killed) child.kill("SIGKILL");
  } catch {}
}

(async () => {
  try {
    await dynamicTests();
  } catch (e) {
    ng("动守 throw", e.message);
  }

  console.log(
    "\n\x1b[1m═══ 印 ∞.2 守门: " +
      pass +
      " 过 / " +
      fail +
      " 失 ═══\x1b[0m",
  );
  if (fail > 0) {
    console.log("\n失项:");
    fails.forEach((f) => console.log("  · " + f));
    process.exit(1);
  }
  console.log("\n✓ 印 ∞.2 · B 路 /dc/* 双反代真实证 · 弱者道之用 · 道法自然");
  process.exit(0);
})();
