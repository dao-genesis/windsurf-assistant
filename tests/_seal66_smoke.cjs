#!/usr/bin/env node
/**
 * _seal66_smoke.cjs — 印 66 · 反者道之动 · 公网用户视角端到端验
 * ════════════════════════════════════════════════════════════════════════
 *   帛书·四十:   反者, 道之动也; 弱者, 道之用也.
 *   帛书·六十二: 道者, 万物之注也; 善人之董也, 不善人之所保也.
 *
 *   公网用户视角防 unit 崩 · 任错路径 · unit 当不退
 *
 *   验:
 *     [A] /v1/chat/completions stream:false + fake key
 *         → 期 502 server_error · 不杀 unit (印 66 _t0 修)
 *     [B] /v1/chat/completions stream:true + fake key
 *         → 期 SSE error chunk + [DONE] · 不杀 unit
 *     [C] /v1/models 在 chat 错路后仍 200 (unit 健全实证)
 *     [D] CORS preflight Allow-Headers 含 Authorization (浏览器跨域必需)
 *     [E] /unknown → 404 (route fallback OK)
 *     [F] /stats ring 记 cumulative.errors >= 2 · last1m.err >= 2
 *     [G] 全局 unhandledRejection / uncaughtException 守门符号在源
 *     [H] handleChatCompletions catch 路径 errMsg = String(...) 安全化
 *
 *   零外部依赖
 */
"use strict";

const http = require("http");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

const UNIT_PORT = 7891; // 不冲 7888 / 7889
const KEY = "sk-ws-proxy-seal66";
const FAKE_API_KEY = "sk-ws-01-FAKE_FOR_SEAL66";

let pass = 0;
let fail = 0;
let unitProc = null;

function ok(cond, label) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    console.error(`  ✗ ${label}`);
  }
}

function httpReq(opts, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(opts, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const raw = Buffer.concat(chunks).toString();
        let parsed = raw;
        try {
          parsed = JSON.parse(raw);
        } catch {}
        resolve({ status: res.statusCode, body: parsed, raw, headers: res.headers });
      });
    });
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("timeout"));
    });
    if (body) req.write(typeof body === "string" ? body : JSON.stringify(body));
    req.end();
  });
}

const get = (p, h = {}) =>
  httpReq({
    hostname: "127.0.0.1",
    port: UNIT_PORT,
    path: p,
    method: "GET",
    headers: h,
    timeout: 5000,
  });
const post = (p, body, h = {}) =>
  httpReq(
    {
      hostname: "127.0.0.1",
      port: UNIT_PORT,
      path: p,
      method: "POST",
      headers: { "Content-Type": "application/json", ...h },
      timeout: 15000, // chat completion may try cloud · 长 timeout
    },
    body,
  );
const opt = (p, h = {}) =>
  httpReq({
    hostname: "127.0.0.1",
    port: UNIT_PORT,
    path: p,
    method: "OPTIONS",
    headers: h,
    timeout: 5000,
  });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function startUnit() {
  return new Promise((resolve, reject) => {
    const unitScript = path.join(
      __dirname,
      "..",
      "packages",
      "dao-core",
      "fleet_vm_unit.js",
    );
    unitProc = spawn(
      "node",
      [
        unitScript,
        "--port",
        String(UNIT_PORT),
        "--bind",
        "127.0.0.1",
        "--account",
        "seal66@test.local",
        "--unit-id",
        "unit-seal66",
        "--api-key",
        FAKE_API_KEY,
        "--auth-key",
        KEY,
      ],
      {
        cwd: path.join(__dirname, "..", "packages", "dao-core"),
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env },
      },
    );
    let stderr = "";
    unitProc.stderr.on("data", (d) => (stderr += d.toString()));
    unitProc.on("error", reject);
    unitProc.on("exit", (code) => {
      if (code !== 0 && code !== null) {
        // 印 66 · unit 不应在 chat 错路后退 · exit code 非 0 = 失败
        // 只在 setup 阶段 exit 才报错
      }
    });
    setTimeout(async () => {
      for (let i = 0; i < 30; i++) {
        try {
          const r = await get("/health");
          if (r.status === 200 && r.body.ok) return resolve();
        } catch {}
        await sleep(200);
      }
      reject(new Error(`unit not ready on :${UNIT_PORT} after 6s\n${stderr}`));
    }, 600);
  });
}

function stopUnit() {
  if (unitProc) {
    try {
      unitProc.kill("SIGTERM");
    } catch {}
    unitProc = null;
  }
}

function isAlive() {
  return unitProc && !unitProc.killed && unitProc.exitCode === null;
}

async function main() {
  console.log("═══ 印 66 · 反者道之动 · 公网视角端到端 ═══\n");

  // ── [G] 全局守门源符号 (静读) ────────────────────────────
  console.log("[G] 全局守门源符号 (静读 fleet_vm_unit.js)");
  const unitSrc = fs.readFileSync(
    path.join(__dirname, "..", "packages", "dao-core", "fleet_vm_unit.js"),
    "utf8",
  );
  ok(
    /process\.on\(\s*["']unhandledRejection["']/.test(unitSrc),
    "process.on('unhandledRejection') 守门在",
  );
  ok(
    /process\.on\(\s*["']uncaughtException["']/.test(unitSrc),
    "process.on('uncaughtException') 守门在",
  );

  // ── [H] handleChatCompletions catch errMsg 安全化 ───────
  console.log("[H] handleChatCompletions catch errMsg 安全化");
  const errMsgSafePat = /const\s+errMsg\s*=\s*String\(\s*e\?\.message/;
  // 应在两个 catch 块中各出现一次 · 流式 + 非流式
  const allMatches = unitSrc.match(/const\s+errMsg\s*=\s*String\(\s*e\?\.message[^)]+\)/g);
  ok(
    allMatches && allMatches.length >= 2,
    `errMsg = String(e?.message...) 出现 ${allMatches?.length || 0} 次 (期 ≥ 2 · 流+非流)`,
  );
  ok(
    /\/\/.*印\s*66.*_t0\s*提至函数级/.test(unitSrc),
    "_t0 提至函数级 (印 66 fix 注释在)",
  );

  // ── 启 unit ─────────────────────────────────────────────
  console.log("启 unit · :7891 · auth-key=" + KEY);
  await startUnit();
  console.log("  ✓ unit alive · pid=" + unitProc.pid);

  // ── [D] CORS preflight ───────────────────────────────
  console.log("[D] CORS preflight (浏览器跨域必需)");
  const preflight = await opt("/v1/chat/completions", {
    Origin: "https://example.github.io",
    "Access-Control-Request-Method": "POST",
    "Access-Control-Request-Headers": "authorization,content-type",
  });
  ok(
    preflight.status === 204 || preflight.status === 200,
    `OPTIONS → ${preflight.status} (期 204/200)`,
  );
  const allowOrigin = preflight.headers["access-control-allow-origin"];
  const allowMethods = preflight.headers["access-control-allow-methods"] || "";
  const allowHeaders = preflight.headers["access-control-allow-headers"] || "";
  ok(allowOrigin === "*", `Allow-Origin: ${allowOrigin}`);
  ok(/POST/.test(allowMethods), `Allow-Methods 含 POST: ${allowMethods}`);
  ok(
    /authorization/i.test(allowHeaders),
    `Allow-Headers 含 Authorization: ${allowHeaders}`,
  );
  ok(
    /content-type/i.test(allowHeaders),
    `Allow-Headers 含 Content-Type`,
  );

  // ── [A] 非流式 chat + fake key → 期 502 不崩 ─────────
  console.log("[A] /v1/chat/completions stream:false + fake key (印 66 _t0 修验)");
  const r1 = await post(
    "/v1/chat/completions",
    {
      model: "claude-sonnet-4-20250514",
      messages: [{ role: "user", content: "hi" }],
      stream: false,
    },
    { Authorization: `Bearer ${KEY}` },
  );
  ok(
    r1.status === 502 || r1.status === 429,
    `非流式 fake key → ${r1.status} (期 502/429 · gate 通 cloud 错)`,
  );
  ok(
    typeof r1.body === "object" && r1.body.error,
    "返 JSON 含 .error 对象",
  );
  ok(
    typeof r1.body?.error?.message === "string",
    `error.message 为字串: ${String(r1.body?.error?.message).slice(0, 60)}`,
  );
  await sleep(200);
  ok(isAlive(), "unit 在非流式错路后仍活 (印 66 不崩验)");

  // ── [B] 流式 chat + fake key → 期 SSE 错 chunk 不崩 ───
  console.log("[B] /v1/chat/completions stream:true + fake key");
  const r2 = await post(
    "/v1/chat/completions",
    {
      model: "claude-sonnet-4-20250514",
      messages: [{ role: "user", content: "hi" }],
      stream: true,
    },
    { Authorization: `Bearer ${KEY}` },
  );
  ok(r2.status === 200, `SSE → 200 (got ${r2.status})`);
  const sseRaw = typeof r2.body === "string" ? r2.body : r2.raw;
  ok(/server_error|error/i.test(sseRaw), "SSE 返 error chunk");
  ok(/data: \[DONE\]/.test(sseRaw), "SSE 含 [DONE] 终止");
  await sleep(200);
  ok(isAlive(), "unit 在流式错路后仍活");

  // ── [C] /v1/models 仍工作 ──────────────────────────────
  console.log("[C] /v1/models 在 chat 错路后仍 200");
  const r3 = await get("/v1/models", { Authorization: `Bearer ${KEY}` });
  ok(r3.status === 200, `→ ${r3.status}`);
  ok(
    Array.isArray(r3.body?.data) && r3.body.data.length >= 30,
    `models count = ${r3.body?.data?.length} (≥ 30)`,
  );

  // ── [E] /unknown 404 ───────────────────────────────────
  console.log("[E] /unknown 404");
  const r4 = await get("/unknown");
  ok(r4.status === 404, `→ ${r4.status}`);

  // ── [F] /stats ring 计错 ───────────────────────────────
  console.log("[F] /stats ring 错记");
  const r5 = await get("/stats", { Authorization: `Bearer ${KEY}` });
  ok(r5.status === 200, `/stats → ${r5.status}`);
  ok(r5.body?.cumulative?.errors >= 2, `cumulative.errors=${r5.body?.cumulative?.errors} (≥ 2)`);
  ok(r5.body?.last1m?.err >= 2, `last1m.err=${r5.body?.last1m?.err} (≥ 2)`);
  ok(r5.body?.ringSize >= 2, `ringSize=${r5.body?.ringSize} (≥ 2)`);

  // ── 收 ─────────────────────────────────────────────────
  stopUnit();
  console.log(
    `\n═══ 印 66 · 公网视角验完毕 · pass=${pass} fail=${fail} ═══`,
  );
  if (fail === 0) {
    console.log("✓ 全通 · 反者道之动 · 善者善之·不善者亦善之");
  } else {
    console.error("✗ 见上 · 慎终若始");
  }
  process.exit(fail === 0 ? 0 : 1);
}

process.on("SIGINT", () => {
  stopUnit();
  process.exit(130);
});

main().catch((e) => {
  console.error("fatal:", e);
  stopUnit();
  process.exit(1);
});
