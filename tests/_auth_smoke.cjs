#!/usr/bin/env node
/**
 * _auth_smoke.cjs — 印 63 · 反代守门验
 * ════════════════════════════════════════════════════════════════════════
 *   帛书·五十二: 「塞其闷, 闭其门, 终身不堇」
 *
 *   验证 fleet_vm_unit 的 --auth-key 闸守逻辑:
 *     1. 启 unit · 设双 key (sk-test-A, sk-test-B)
 *     2. /health  公开 · 不需 auth · authRequired=true
 *     3. /v1/models  无 auth → 401
 *     4. /v1/models  Authorization: Bearer sk-test-A → 200
 *     5. /v1/models  X-Api-Key: sk-test-B → 200
 *     6. /v1/models  ?api_key=sk-test-A → 200
 *     7. /v1/models  错 key → 401
 *     8. /quota  无 auth → 401
 *     9. /v1/chat/completions  无 auth → 401
 *    10. /fleet/info  公开 → 200
 *    11. 停 unit · 重启不带 auth-key (open mode)
 *    12. /v1/models  无 auth → 200 (向后兼容)
 *
 *   零外部依赖 · 仅 Node.js 内置 + 真 fleet_vm_unit
 */
"use strict";

const http = require("http");
const path = require("path");
const { spawn } = require("child_process");

const UNIT_PORT = 7888; // 不冲突 7861 / 7862 / 7870 / 7899
const KEY_A = "sk-test-A-1234567890";
const KEY_B = "sk-test-B-abcdefghij";
const KEY_BAD = "sk-test-WRONG-key";
const FAKE_API_KEY = "sk-ws-01-FAKE_FOR_AUTH_SMOKE";

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

function get(path, headers = {}) {
  return httpReq({
    hostname: "127.0.0.1",
    port: UNIT_PORT,
    path,
    method: "GET",
    headers,
    timeout: 5000,
  });
}

function post(path, body, headers = {}) {
  return httpReq(
    {
      hostname: "127.0.0.1",
      port: UNIT_PORT,
      path,
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      timeout: 5000,
    },
    body,
  );
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function startUnit(extraArgs = []) {
  return new Promise((resolve, reject) => {
    const unitScript = path.join(__dirname, "..", "packages", "dao-core", "fleet_vm_unit.js");
    const args = [
      unitScript,
      "--port",
      String(UNIT_PORT),
      "--bind",
      "127.0.0.1",
      "--api-key",
      FAKE_API_KEY,
      "--account",
      "auth-smoke@test.local",
      "--unit-id",
      "unit-auth-smoke",
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
      if (code !== 0 && code !== null) reject(new Error(`unit exited ${code}: ${stderr}`));
    });
    // wait for ready
    setTimeout(async () => {
      for (let i = 0; i < 20; i++) {
        try {
          const r = await get("/health");
          if (r.status === 200 && r.body.ok) return resolve();
        } catch {}
        await sleep(200);
      }
      reject(new Error(`unit not responsive on :${UNIT_PORT} after 4s\n${stderr}`));
    }, 800);
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
  console.log("═══ 反代守门烟测 · 印 63 ═══\n");

  // ── Phase 1: 启 unit · 双 key ──────────────────────────────
  console.log("[A] 启动 unit · auth-key=sk-test-A,sk-test-B");
  try {
    await startUnit(["--auth-key", `${KEY_A},${KEY_B}`]);
    ok(true, "unit 启动 · 双 key 模式");
  } catch (e) {
    ok(false, `unit 启动失败: ${e.message}`);
    process.exit(2);
  }

  // ── [B] /health 公开 ────────────────────────────────────
  console.log("[B] /health (公开 · 不验)");
  {
    const r = await get("/health");
    ok(r.status === 200, "/health → 200");
    ok(r.body.ok === true, "ok=true");
    ok(r.body.authRequired === true, "authRequired=true (有 auth-key)");
    ok(r.body.authKeysCount === 2, `authKeysCount=2 (got ${r.body.authKeysCount})`);
    ok(r.body.unit === "unit-auth-smoke", "unit ID 正");
  }

  // ── [C] /v1/models 闸守 ────────────────────────────────
  console.log("[C] /v1/models 闸守");
  {
    const r0 = await get("/v1/models");
    ok(r0.status === 401, `无 auth → 401 (got ${r0.status})`);
    ok(r0.body.error?.code === "invalid_api_key", "错码 invalid_api_key");

    const r1 = await get("/v1/models", { Authorization: `Bearer ${KEY_A}` });
    ok(r1.status === 200, `Authorization: Bearer KEY_A → 200 (got ${r1.status})`);
    ok(Array.isArray(r1.body.data) && r1.body.data.length > 10, "返 >10 模型");

    const r2 = await get("/v1/models", { "X-Api-Key": KEY_B });
    ok(r2.status === 200, `X-Api-Key: KEY_B → 200 (got ${r2.status})`);

    const r3 = await get(`/v1/models?api_key=${encodeURIComponent(KEY_A)}`);
    ok(r3.status === 200, `?api_key=KEY_A → 200 (got ${r3.status})`);

    const r4 = await get("/v1/models", { Authorization: `Bearer ${KEY_BAD}` });
    ok(r4.status === 401, `错 key → 401 (got ${r4.status})`);

    const r5 = await get("/v1/models", { Authorization: "NotBearer" });
    ok(r5.status === 401, "格式错 (无 Bearer 前缀) → 401");
  }

  // ── [D] /quota 闸守 ────────────────────────────────────
  console.log("[D] /quota 闸守");
  {
    const r = await get("/quota");
    ok(r.status === 401, `无 auth → 401 (got ${r.status})`);
  }

  // ── [E] /v1/chat/completions 闸守 ──────────────────────
  console.log("[E] /v1/chat/completions 闸守 (gate 在 cloud 调用前)");
  {
    const r = await post(
      "/v1/chat/completions",
      { model: "default", messages: [{ role: "user", content: "x" }] },
      {},
    );
    ok(r.status === 401, `无 auth → 401 (got ${r.status} · cloud 未被调用)`);
  }

  // ── [F] /fleet/info 公开 ──────────────────────────────
  console.log("[F] /fleet/info (公开 · 识别用)");
  {
    const r = await get("/fleet/info");
    ok(r.status === 200, `→ 200 (got ${r.status})`);
    ok(r.body.unitId === "unit-auth-smoke", "unitId 正");
  }

  // ── [G] CORS preflight ─────────────────────────────────
  console.log("[G] CORS preflight (OPTIONS)");
  {
    const r = await httpReq({
      hostname: "127.0.0.1",
      port: UNIT_PORT,
      path: "/v1/chat/completions",
      method: "OPTIONS",
      headers: {
        Origin: "https://example.github.io",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Authorization, Content-Type",
      },
      timeout: 5000,
    });
    ok(r.status === 204, `OPTIONS → 204 (got ${r.status})`);
    const acah = r.headers["access-control-allow-headers"] || "";
    ok(/Authorization/i.test(acah), `Allow-Headers 含 Authorization (${acah})`);
    ok(r.headers["access-control-allow-origin"] === "*", "Allow-Origin = *");
  }

  // ── 停止双 key 模式 unit ────────────────────────────────
  stopUnit();
  await sleep(500);

  // ── Phase 2: 无 auth-key 启 (open mode) ────────────────
  console.log("[H] 重启 unit · 无 auth-key (open mode 向后兼容)");
  try {
    await startUnit([]); // 无 --auth-key
    ok(true, "unit 重启 · open mode");
  } catch (e) {
    ok(false, `unit 重启失败: ${e.message}`);
    stopUnit();
    finish();
    return;
  }

  console.log("[I] open mode · /v1/models 无 auth 直通");
  {
    const r = await get("/v1/models");
    ok(r.status === 200, `无 auth → 200 (向后兼容 · got ${r.status})`);

    const h = await get("/health");
    ok(h.body.authRequired === false, "/health authRequired=false");
    ok(h.body.authKeysCount === 0, "authKeysCount=0");
  }

  console.log("[J] open mode · 任意 Bearer 也通");
  {
    const r = await get("/v1/models", { Authorization: "Bearer anything" });
    ok(r.status === 200, "Bearer anything → 200 (open mode 不验)");
  }

  finish();
}

function finish() {
  stopUnit();
  console.log(`\n═══ 守门烟测完毕 · pass=${pass} fail=${fail} ═══`);
  if (fail > 0) {
    console.error("✗ 有失败项");
    process.exit(1);
  }
  console.log("✓ 全通 · 反代守门 · 公网无忧");
  process.exit(0);
}

process.on("SIGINT", () => {
  stopUnit();
  process.exit(2);
});
process.on("SIGTERM", () => {
  stopUnit();
  process.exit(2);
});

main().catch((e) => {
  console.error("FATAL:", e);
  stopUnit();
  process.exit(3);
});
