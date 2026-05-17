#!/usr/bin/env node
// _yin124_root_runtime_smoke.cjs · 印 124 · 反者道之动 · 根本底层真运守门
// 帛书·四十:「反者道之动 · 弱者道之用」 · 主公诏:「从根本底层继续验证使用完善」
// 印 100~123 守门皆"静"(件读·regex) · 印 124 立"动"(真起 daemon · 真探 · 真切)
"use strict";
const path = require("path");
const http = require("http");
const { spawn } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const DAO = path.join(ROOT, "packages", "dao-devin-vm", "dao_proxy.js");
const PORT = 17780, BIND = "127.0.0.1";
const AUTH = "yin124-test-7d4f8c9a-bc2e-4f1d-8a3c-9e5b6d7c8f0a";

let pass = 0, fail = 0;
const fails = [];
const ok = (n) => { console.log(`  \x1b[32m✓\x1b[0m ${n}`); pass++; };
const ng = (n, w) => { console.log(`  \x1b[31m✗\x1b[0m ${n} · ${w}`); fail++; fails.push(n + ": " + w); };

function probe(method, urlPath, headers, body) {
  return new Promise((resolve) => {
    const opts = { hostname: BIND, port: PORT, path: urlPath, method, headers: Object.assign({}, headers || {}), timeout: 4000 };
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
        let json = null; try { json = JSON.parse(text); } catch {}
        resolve({ status: res.statusCode, text, json });
      });
    });
    req.on("error", (e) => resolve({ err: e.message }));
    req.on("timeout", () => { try { req.destroy(); } catch {} resolve({ err: "timeout" }); });
    if (payload) req.write(payload);
    req.end();
  });
}

function spawnDaemon() {
  return new Promise((resolve, reject) => {
    const env = Object.assign({}, process.env, {
      PORT: String(PORT), BIND, DAO_AUTH_TOKEN: AUTH,
      WAM_FILE: path.join(__dirname, "_yin124_no_wam.json"),
      DEVIN_TOKEN: "", DEVIN_TOKENS: "", DAO_TOKENS_FILE: "",
      WS_TOKENS_FILE: path.join(__dirname, "_yin124_no_ws.txt"),
    });
    const child = spawn(process.execPath, [DAO], { env, cwd: path.dirname(DAO), stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "", resolved = false;
    const tmr = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      try { child.kill("SIGKILL"); } catch {}
      reject(new Error("daemon timeout · " + stderr.slice(-300)));
    }, 8000);
    child.stderr.on("data", (d) => {
      stderr += d.toString();
      if (!resolved && stderr.includes("起 · 道法自然")) {
        resolved = true; clearTimeout(tmr);
        setTimeout(() => resolve(child), 250);
      }
    });
    child.on("error", (e) => { if (!resolved) { resolved = true; clearTimeout(tmr); reject(e); } });
    child.on("exit", (code) => {
      if (!resolved) { resolved = true; clearTimeout(tmr); reject(new Error("daemon 早退 code=" + code + " · " + stderr.slice(-300))); }
    });
  });
}

function killDaemon(child) {
  return new Promise((resolve) => {
    if (!child || child.killed) return resolve();
    let done = false;
    const fin = () => { if (!done) { done = true; resolve(); } };
    child.once("exit", fin);
    try { child.kill(process.platform === "win32" ? "SIGTERM" : "SIGINT"); } catch {}
    setTimeout(() => { if (!done) { try { child.kill("SIGKILL"); } catch {} setTimeout(fin, 400); } }, 4500);
  });
}

async function main() {
  console.log("\n\x1b[1m═══ 印 124 · 反者道之动 · 根本底层真运守门 ═══\x1b[0m");
  console.log("\x1b[90m帛书·四十:「反者道之动·弱者道之用」 · 主公诏:「从根本底层继续验证使用完善」\x1b[0m\n");

  console.log("\x1b[1m[一] 真起 daemon (端 " + PORT + ")\x1b[0m");
  let child;
  try { child = await spawnDaemon(); ok(`daemon spawn pid=${child.pid}`); }
  catch (e) { ng("daemon spawn", e.message); console.log("\n\x1b[31m✗ 一气未起\x1b[0m"); process.exit(1); }

  try {
    console.log("\n\x1b[1m[二] 公开路 (无 auth)\x1b[0m");
    const h = await probe("GET", "/health");
    if (h.status === 200 && h.json?.ok === true) {
      ok("/health → 200 · seal=" + (h.json.seal || "").slice(0, 8));
      if (h.json.auth?.enabled === true) ok("/health auth.enabled=true");
      else ng("/health auth.enabled", "应 true");
      if (Array.isArray(h.json.auth?.accepts) && h.json.auth.accepts.length === 4) ok("/health auth.accepts 4 门");
      else ng("/health auth.accepts", "应 4 门");
      if (h.json.silk?.chars > 0) ok("/health silk " + h.json.silk.chars + "字 from " + h.json.silk.source);
      else ng("/health silk", "未载");
    } else ng("/health", "status=" + h.status + " err=" + (h.err || "-"));

    const root = await probe("GET", "/");
    if (root.status === 200 && /真本源单器/.test(root.text)) ok("GET / → 200 dashboard");
    else ng("GET /", "status=" + root.status);

    console.log("\n\x1b[1m[三] 守门 401/403\x1b[0m");
    const m401 = await probe("GET", "/v1/models");
    if (m401.status === 401) ok("/v1/models 无 auth → 401");
    else ng("/v1/models 无 auth", "应 401 实 " + m401.status);

    const bad = await probe("GET", "/v1/models", { Authorization: "Bearer wrong" });
    if (bad.status === 403) ok("/v1/models 错 token → 403");
    else ng("/v1/models 错 token", "应 403 实 " + bad.status);

    console.log("\n\x1b[1m[四] auth 4 门\x1b[0m");
    const m1 = await probe("GET", "/v1/models", { Authorization: "Bearer " + AUTH });
    if (m1.status === 200 && Array.isArray(m1.json?.data) && m1.json.data.length > 0)
      ok("门 1 Bearer → 200 · " + m1.json.data.length + " 模型");
    else ng("门 1 Bearer", "status=" + m1.status);

    const m2 = await probe("GET", "/v1/models", { "X-Dao-Auth": AUTH });
    if (m2.status === 200) ok("门 2 X-Dao-Auth → 200");
    else ng("门 2 X-Dao-Auth", "status=" + m2.status);

    const m3 = await probe("GET", "/v1/models", { "X-Api-Key": AUTH });
    if (m3.status === 200) ok("门 3 X-Api-Key → 200");
    else ng("门 3 X-Api-Key", "status=" + m3.status);

    const m4 = await probe("GET", "/v1/models?key=" + encodeURIComponent(AUTH));
    if (m4.status === 200) ok("门 4 ?key= → 200");
    else ng("门 4 ?key=", "status=" + m4.status);

    console.log("\n\x1b[1m[五] SP 七态真切真验\x1b[0m");
    const seven = ["bypass", "dao", "usernote", "prepend", "append", "override", "custom"];
    for (const s of seven) {
      const post = await probe("POST", "/v1/system/prompt", { Authorization: "Bearer " + AUTH }, { strategy: s });
      if (post.status !== 200 || post.json?.ok !== true) { ng(`SP POST ${s}`, "status=" + post.status); continue; }
      const get = await probe("GET", "/v1/system/prompt", { "X-Dao-Auth": AUTH });
      if (get.status === 200 && get.json?.strategy === s) ok(`SP "${s}" 切 → 验 strategy=${s}`);
      else ng(`SP "${s}" 验`, "期 " + s + " 实 " + get.json?.strategy);
    }
    const badStrat = await probe("POST", "/v1/system/prompt", { Authorization: "Bearer " + AUTH }, { strategy: "yin-fake" });
    if (badStrat.status === 400 && Array.isArray(badStrat.json?.allowed)) ok(`SP 非法态拒 400 allowed=${badStrat.json.allowed.length}`);
    else ng("SP 非法态拒", "应 400 实 " + badStrat.status);

    const setC = await probe("POST", "/v1/system/prompt", { Authorization: "Bearer " + AUTH },
      { strategy: "custom", customSp: "印 124 · 反者道之动 · 测试自定 SP" });
    if (setC.status === 200) {
      const getC = await probe("GET", "/v1/system/prompt", { Authorization: "Bearer " + AUTH });
      if (getC.json?.customSp?.preview?.includes("反者道之动")) ok("SP customSp 真转 · 含「反者道之动」");
      else ng("SP customSp 真转", "preview=" + getC.json?.customSp?.preview);
    } else ng("SP customSp 设", "status=" + setC.status);

    console.log("\n\x1b[1m[六] wss-observe 三端点 (印 122)\x1b[0m");
    const obs = await probe("GET", "/v1/system/wss-observe", { Authorization: "Bearer " + AUTH });
    if (obs.status === 200) ok("/v1/system/wss-observe → 200");
    else ng("wss-observe", "status=" + obs.status);

    const obsFull = await probe("GET", "/v1/system/wss-observe/full", { Authorization: "Bearer " + AUTH });
    if (obsFull.status === 200) ok("/v1/system/wss-observe/full → 200");
    else ng("wss-observe/full", "status=" + obsFull.status);

    const obsReset = await probe("POST", "/v1/system/wss-observe/reset", { Authorization: "Bearer " + AUTH });
    if (obsReset.status === 200) ok("/v1/system/wss-observe/reset → 200");
    else ng("wss-observe/reset", "status=" + obsReset.status);

    console.log("\n\x1b[1m[七] /v1/models 模型列\x1b[0m");
    const models = await probe("GET", "/v1/models", { Authorization: "Bearer " + AUTH });
    if (models.status === 200 && Array.isArray(models.json?.data) && models.json.data.length >= 10)
      ok("/v1/models · " + models.json.data.length + " 件 ≥ 10");
    else ng("/v1/models", "status=" + models.status + " count=" + (models.json?.data?.length || 0));
  } finally {
    console.log("\n\x1b[1m[八] 真关 daemon\x1b[0m");
    await killDaemon(child);
    ok("daemon 关停");
  }

  console.log("\n\x1b[1m═══ 印 124 总: \x1b[32m" + pass + " 过\x1b[0m\x1b[1m / \x1b[31m" + fail + " 失\x1b[0m\x1b[1m ═══\x1b[0m");
  if (fail > 0) {
    console.log("\n\x1b[31m失项:\x1b[0m");
    fails.forEach((f) => console.log("  · " + f));
    process.exit(1);
  } else {
    console.log("\n\x1b[32m✓ 一气化三清 · 真本源根本底层真运通 · 反者道之动 · 道法自然\x1b[0m");
    process.exit(0);
  }
}

main().catch((e) => { console.error("\x1b[31m✗ 主跑异:\x1b[0m", e.stack || e.message); process.exit(2); });
