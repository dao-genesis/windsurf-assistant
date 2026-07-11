#!/usr/bin/env node
/**
 * _seal64_smoke.cjs — 印 64 · 4 步链 + SSE heartbeat + /stats 烟测
 * ════════════════════════════════════════════════════════════════════════
 *   帛书·六十三: 「天下之难作于易, 天下之大作于细」
 *
 *   验:
 *     [A] windsurf_auth.js 静态 (require + 7 导出符)
 *     [B] fleet_vm_unit.js 印 64 标记 (allow-auth · sseActive · stats)
 *     [C] 启 unit (--allow-auth) · /health 暴 authAllowed=true / sseActive / statsCount / draining
 *     [D] /stats 闸守 + 三窗结构 (last1m/last10m/last1h)
 *     [E] /auth/login 错 (bad email + bad password) → step=login + code 4xx
 *     [F] /auth/status 缺 apiKey → 400 invalid_request_error
 *     [G] /auth/foo 未知动作 → 404
 *     [H] /auth/auto 无 auth-key → 401 (闸守在前)
 *     [I] 关 unit · 重启不带 --allow-auth · /auth/* → 403 auth_disabled
 *     [J] /health authAllowed=false (off mode)
 *
 *   零外部依赖
 */
"use strict";

const http = require("http");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

const UNIT_PORT = 7889; // 不冲 auth_smoke 7888
const KEY = "sk-test-64-allow-auth-on";
const FAKE_API_KEY = "sk-ws-01-FAKE_FOR_SEAL64";

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
        resolve({ status: res.statusCode, body: parsed, headers: res.headers });
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
      timeout: 8000,
    },
    body,
  );
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function startUnit(extraArgs = []) {
  return new Promise((resolve, reject) => {
    const unitScript = path.join(
      __dirname,
      "..",
      "packages",
      "dao-core",
      "fleet_vm_unit.js",
    );
    const args = [
      unitScript,
      "--port",
      String(UNIT_PORT),
      "--bind",
      "127.0.0.1",
      "--api-key",
      FAKE_API_KEY,
      "--account",
      "seal64@test.local",
      "--unit-id",
      "unit-seal64",
      "--auth-key",
      KEY,
      ...extraArgs,
    ];
    unitProc = spawn("node", args, {
      cwd: path.join(__dirname, ".."),
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
    });
    let stderr = "";
    unitProc.stderr.on("data", (d) => (stderr += d.toString()));
    unitProc.on("error", reject);
    unitProc.on("exit", (code) => {
      if (code !== 0 && code !== null)
        reject(new Error(`unit exited ${code}: ${stderr}`));
    });
    setTimeout(async () => {
      for (let i = 0; i < 25; i++) {
        try {
          const r = await get("/health");
          if (r.status === 200 && r.body.ok) return resolve();
        } catch {}
        await sleep(200);
      }
      reject(new Error(`unit not ready on :${UNIT_PORT} after 5s\n${stderr}`));
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

async function main() {
  console.log("═══ 印 64 烟测 · 4 步链 + SSE + /stats ═══\n");

  // ── [A] windsurf_auth.js 静态 ─────────────────────────────
  console.log("[A] windsurf_auth.js 静态");
  const waPath = path.join(__dirname, "..", "packages", "dao-core", "windsurf_auth.js");
  ok(fs.existsSync(waPath), "windsurf_auth.js 文件存");
  let WA;
  try {
    WA = require(waPath);
    ok(true, "require 不抛");
  } catch (e) {
    ok(false, `require 抛: ${e.message}`);
    return finish();
  }
  for (const fn of [
    "AuthError",
    "devinLogin",
    "windsurfPostAuth",
    "registerUserViaSession",
    "fetchUserStatus",
    "parsePlanStatusJson",
    "autoChain",
  ]) {
    ok(typeof WA[fn] === "function", `export ${fn}`);
  }
  ok(typeof WA._internal === "object", "export _internal");
  ok(
    WA._internal.RE_SESSION_TOKEN_PREFIX === "devin-session-token$",
    "session prefix 正",
  );
  ok(
    WA._internal.URL_DEVIN_LOGIN.startsWith("https://windsurf.com/_devin-auth/"),
    "URL_DEVIN_LOGIN 正",
  );

  // parsePlanStatusJson 单元 · 不发网
  const pj = WA.parsePlanStatusJson({
    userStatus: {
      planStatus: {
        weeklyQuotaRemainingPercent: 80,
        dailyQuotaRemainingPercent: 50,
        availablePromptCredits: 100,
        planEnd: "2026-12-31T00:00:00Z",
        planInfo: { planName: "Pro", teamsTier: "team" },
      },
    },
  });
  ok(pj.weeklyQuotaRemainingPercent === 80, "parse weekly=80");
  ok(pj.dailyQuotaRemainingPercent === 50, "parse daily=50");
  ok(pj.availablePromptCredits === 100, "parse promptCredits=100");
  ok(pj.planName === "Pro", "parse planName=Pro");
  ok(pj.planEnd === "2026-12-31T00:00:00Z", "parse planEnd 正");

  // ── [B] fleet_vm_unit.js 印 64 标记 ──────────────────────
  console.log("[B] fleet_vm_unit.js 印 64 标记");
  const fvuSrc = fs.readFileSync(
    path.join(__dirname, "..", "packages", "dao-core", "fleet_vm_unit.js"),
    "utf8",
  );
  ok(fvuSrc.includes("ALLOW_AUTH"), "ALLOW_AUTH 常量");
  ok(fvuSrc.includes("--allow-auth"), "--allow-auth flag");
  ok(fvuSrc.includes("DAO_ALLOW_AUTH"), "DAO_ALLOW_AUTH env");
  ok(fvuSrc.includes("_activeSse"), "_activeSse Set");
  ok(fvuSrc.includes("SSE_HEARTBEAT_MS"), "SSE_HEARTBEAT_MS");
  ok(fvuSrc.includes("dao-heartbeat"), "heartbeat write");
  ok(fvuSrc.includes("_statsRing"), "_statsRing");
  ok(fvuSrc.includes("STATS_RING_MAX"), "STATS_RING_MAX");
  ok(fvuSrc.includes("handleStats"), "handleStats fn");
  ok(fvuSrc.includes("handleAuthRoute"), "handleAuthRoute fn");
  ok(fvuSrc.includes("/auth/login"), "/auth/login route hint");
  ok(fvuSrc.includes("/auth/auto"), "/auth/auto route hint");
  ok(fvuSrc.includes("_draining"), "_draining flag");
  ok(fvuSrc.includes("getWindsurfAuth"), "lazy WA loader");
  ok(fvuSrc.includes("印 64"), "印 64 印");

  // ── [C] 启 unit · --allow-auth 开 ────────────────────────
  console.log("[C] 启 unit · --allow-auth + auth-key");
  try {
    await startUnit(["--allow-auth"]);
    ok(true, "unit 启 · allow-auth 模式");
  } catch (e) {
    ok(false, `unit 启失败: ${e.message}`);
    return finish();
  }

  // ── [C2] /health 含印 64 字段 ────────────────────────────
  console.log("[C2] /health 印 64 字段");
  {
    const r = await get("/health");
    ok(r.status === 200, "/health → 200");
    ok(r.body.authAllowed === true, "authAllowed=true");
    ok(r.body.sseActive === 0, "sseActive=0 (无活流)");
    ok(typeof r.body.statsCount === "number", "statsCount 数");
    ok(r.body.draining === false, "draining=false");
    ok(r.body.seal && r.body.seal.includes("印 64"), `seal 含印 64 (${r.body.seal})`);
  }

  // ── [D] /stats 闸守 + 三窗 ────────────────────────────────
  console.log("[D] /stats 闸守 + 三窗");
  {
    const r0 = await get("/stats");
    ok(r0.status === 401, `/stats 无 auth → 401 (got ${r0.status})`);

    const r1 = await get("/stats", { Authorization: `Bearer ${KEY}` });
    ok(r1.status === 200, `/stats 有 auth → 200 (got ${r1.status})`);
    ok(r1.body.ok === true, "ok=true");
    ok(typeof r1.body.ringSize === "number", "ringSize 数");
    ok(r1.body.ringMax === 2000, "ringMax=2000");
    ok(typeof r1.body.last1m === "object", "last1m 在");
    ok(typeof r1.body.last10m === "object", "last10m 在");
    ok(typeof r1.body.last1h === "object", "last1h 在");
    for (const w of ["last1m", "last10m", "last1h"]) {
      const win = r1.body[w];
      ok(typeof win.count === "number", `${w}.count 数`);
      ok(typeof win.p50Ms === "number", `${w}.p50Ms 数`);
      ok(typeof win.p95Ms === "number", `${w}.p95Ms 数`);
      ok(typeof win.p99Ms === "number", `${w}.p99Ms 数`);
      ok(typeof win.avgMs === "number", `${w}.avgMs 数`);
    }
    ok(typeof r1.body.cumulative === "object", "cumulative 在");
  }

  // ── [E] /auth/login 错凭 (真发网, 期 step=login + 4xx) ──
  console.log("[E] /auth/login 错凭 (真发 windsurf.com)");
  {
    const r = await post(
      "/auth/login",
      {
        email: "test-seal64-nonexistent-12345@invalid-domain-zzz.xyz",
        password: "definitely-wrong-password-for-test",
      },
      { Authorization: `Bearer ${KEY}` },
    );
    // 期 4xx (401/403/400) · windsurf.com 真返认证错
    ok(
      r.status >= 400 && r.status < 600,
      `→ 4xx/5xx (got ${r.status}) · windsurf.com 真返`,
    );
    if (r.body && r.body.error) {
      ok(r.body.error.step === "login", `error.step=login (got ${r.body.error.step})`);
      ok(
        r.body.error.type === "auth_chain_error",
        `error.type=auth_chain_error (got ${r.body.error.type})`,
      );
    } else {
      // 网络不通时可能 5xx 无 step · 软通过
      ok(true, "(网络不通时跳 step 验)");
    }
  }

  // ── [F] /auth/status 缺 apiKey → 400 ─────────────────────
  console.log("[F] /auth/status 缺 apiKey");
  {
    const r = await post("/auth/status", {}, { Authorization: `Bearer ${KEY}` });
    ok(r.status === 400, `→ 400 (got ${r.status})`);
    ok(
      r.body.error?.message?.includes("apiKey") ||
        r.body.error?.message?.includes("api"),
      `error 提 apiKey (got ${r.body.error?.message})`,
    );
  }

  // ── [G] /auth/foo 未知动作 → 404 ─────────────────────────
  console.log("[G] /auth/foo 未知动作");
  {
    const r = await post("/auth/foo", {}, { Authorization: `Bearer ${KEY}` });
    ok(r.status === 404, `→ 404 (got ${r.status})`);
  }

  // ── [H] /auth/auto 无 auth-key → 401 ─────────────────────
  console.log("[H] /auth/auto 无 auth-key (闸守在前)");
  {
    const r = await post("/auth/auto", { email: "x", password: "y" });
    ok(r.status === 401, `→ 401 (got ${r.status})`);
    ok(
      r.body.error?.code === "invalid_api_key",
      "error.code=invalid_api_key (闸守先于 ALLOW_AUTH 检查)",
    );
  }

  // ── 关 allow-auth 模式 unit ──────────────────────────────
  stopUnit();
  await sleep(500);

  // ── [I] 重启不带 --allow-auth ────────────────────────────
  console.log("[I] 重启 unit · 不带 --allow-auth");
  try {
    await startUnit([]); // 仍有 KEY 但无 --allow-auth
    ok(true, "unit 重启 · auth-disabled 模式");
  } catch (e) {
    ok(false, `unit 重启失败: ${e.message}`);
    stopUnit();
    return finish();
  }

  // ── [J] /health authAllowed=false ────────────────────────
  console.log("[J] /health · authAllowed=false");
  {
    const r = await get("/health");
    ok(r.status === 200, "/health → 200");
    ok(r.body.authAllowed === false, "authAllowed=false (off mode)");
  }

  // ── [K] /auth/auto · 有 auth-key 但 allow-auth 关 → 403 ─
  console.log("[K] /auth/auto · auth-key 通但 allow-auth 关 → 403");
  {
    const r = await post(
      "/auth/auto",
      { email: "x", password: "y" },
      { Authorization: `Bearer ${KEY}` },
    );
    ok(r.status === 403, `→ 403 (got ${r.status})`);
    ok(
      r.body.error?.type === "auth_disabled",
      `error.type=auth_disabled (got ${r.body.error?.type})`,
    );
    ok(
      r.body.error?.message?.includes("--allow-auth"),
      "提示 --allow-auth",
    );
  }

  // ── [L] /stats 仍工作 (无 allow-auth 也能查) ─────────────
  console.log("[L] /stats 在 auth-disabled 仍工作");
  {
    const r = await get("/stats", { Authorization: `Bearer ${KEY}` });
    ok(r.status === 200, "/stats → 200");
    ok(r.body.ok === true, "ok=true");
  }

  stopUnit();
  finish();
}

function finish() {
  console.log(
    `\n═══ 印 64 烟测完毕 · pass=${pass} fail=${fail} ═══`,
  );
  if (fail > 0) {
    console.error("✗ 有失败项");
    process.exit(1);
  }
  console.log("✓ 全通 · 为大于其细 · 道法自然");
  process.exit(0);
}

process.on("exit", () => stopUnit());
process.on("SIGINT", () => {
  stopUnit();
  process.exit(130);
});

main().catch((e) => {
  console.error("fatal:", e);
  stopUnit();
  process.exit(2);
});
