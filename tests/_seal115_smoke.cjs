#!/usr/bin/env node
/**
 * _seal115_smoke.cjs · 印 115 守门 · 件齐 + syntax + workflow yaml minimal valid
 *
 *   「图难于其易 · 为大于其细」(六十三)
 *   「合抱之木 · 生于毫末」(六十四)
 *
 * 跑: node tests/_seal115_smoke.cjs
 *
 * 验:
 *   1. packages/dao-devin-vm/ 6 件齐 · 大小合理范围
 *   2. 4 个 JS 件可 node -c (syntax pass)
 *   3. workflow yaml 含必要 keys (name / jobs / runs-on / steps)
 *   4. dao_proxy.js 含关键 endpoint (/v1/chat/completions · /v1/models · /health)
 *   5. deployer.js 之路径 fallback 含同包优先 (反者道之动 · 不依本机外资)
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const PKG = path.join(ROOT, "packages", "dao-devin-vm");
const WORKFLOW = path.join(
  ROOT,
  ".github",
  "workflows",
  "dao-fleet-devin-cloud.yml",
);

let pass = 0;
let fail = 0;
const failures = [];
function ok(name) {
  console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  pass++;
}
function ng(name, why) {
  console.log(`  \x1b[31m✗\x1b[0m ${name} · ${why}`);
  fail++;
  failures.push(`${name}: ${why}`);
}

console.log("═══ 印 115 smoke · dao-devin-vm 件齐守门 ═══");
console.log("");

// ─── 1. 6 件齐 ───
console.log("[1] 件齐 + 大小合理");
const expected = [
  { name: "deployer.js", minKB: 8, maxKB: 30 },
  { name: "dao_proxy.js", minKB: 50, maxKB: 200 },
  { name: "vm_omni.js", minKB: 30, maxKB: 80 },
  { name: "vm_proxy_deploy.js", minKB: 10, maxKB: 40 },
  { name: "package.json", minKB: 0, maxKB: 5 },
  { name: "README.md", minKB: 2, maxKB: 50 },
];
for (const f of expected) {
  const fp = path.join(PKG, f.name);
  if (!fs.existsSync(fp)) {
    ng(f.name, "缺");
    continue;
  }
  const kb = fs.statSync(fp).size / 1024;
  if (kb < f.minKB || kb > f.maxKB) {
    ng(f.name, `size=${kb.toFixed(1)}KB · 期 [${f.minKB}, ${f.maxKB}]`);
    continue;
  }
  ok(`${f.name} · ${kb.toFixed(1)}KB`);
}

// ─── 2. JS syntax (node -c) ───
console.log("");
console.log("[2] JS syntax (node -c)");
for (const js of [
  "deployer.js",
  "dao_proxy.js",
  "vm_omni.js",
  "vm_proxy_deploy.js",
]) {
  const fp = path.join(PKG, js);
  if (!fs.existsSync(fp)) {
    ng(js, "缺 (跳)");
    continue;
  }
  const r = spawnSync("node", ["-c", fp], { encoding: "utf8" });
  if (r.status === 0) ok(`${js} · syntax OK`);
  else ng(js, `node -c 失: ${(r.stderr || "").slice(0, 200)}`);
}

// ─── 3. workflow yaml ───
console.log("");
console.log("[3] workflow yaml 含必要 keys");
if (!fs.existsSync(WORKFLOW)) {
  ng("dao-fleet-devin-cloud.yml", "缺");
} else {
  const y = fs.readFileSync(WORKFLOW, "utf8");
  for (const k of [
    "name:",
    "on:",
    "workflow_dispatch:",
    "schedule:",
    "jobs:",
    "runs-on:",
    "steps:",
    "packages/dao-devin-vm",
    "node deployer.js",
  ]) {
    if (y.includes(k)) ok(`yaml 含 "${k}"`);
    else ng("yaml", `缺 "${k}"`);
  }
}

// ─── 4. dao_proxy.js 含关键 endpoint ───
console.log("");
console.log("[4] dao_proxy.js 含关键 endpoint");
const proxyFp = path.join(PKG, "dao_proxy.js");
if (fs.existsSync(proxyFp)) {
  const p = fs.readFileSync(proxyFp, "utf8");
  for (const ep of [
    "/v1/chat/completions",
    "/v1/models",
    "/health",
    "wss://app.devin.ai",
  ]) {
    if (p.includes(ep)) ok(`endpoint 含 "${ep}"`);
    else ng("dao_proxy", `缺 endpoint "${ep}"`);
  }
}

// ─── 5. deployer.js 之 fallback ───
console.log("");
console.log("[5] deployer.js 之路径 fallback (反者道之动)");
const depFp = path.join(PKG, "deployer.js");
if (fs.existsSync(depFp)) {
  const d = fs.readFileSync(depFp, "utf8");
  for (const k of [
    "DAO_OMNI_JS",
    "DAO_DEPLOY_JS",
    "DAO_POOL_JSON",
    "DAO_AUTH_FILE",
    "path.resolve(BASE",
  ]) {
    if (d.includes(k)) ok(`deployer 含 fallback "${k}"`);
    else ng("deployer", `缺 fallback "${k}"`);
  }
}

console.log("");
console.log(
  `═══ 总: \x1b[32m${pass} 过\x1b[0m / \x1b[31m${fail} 失\x1b[0m ═══`,
);
if (fail > 0) {
  console.log("");
  console.log("\x1b[31m失项:\x1b[0m");
  failures.forEach((f) => console.log(`  · ${f}`));
  process.exit(1);
} else {
  console.log("");
  console.log("\x1b[32m✓ 件齐 · 反者道之动 · 道法自然\x1b[0m");
  process.exit(0);
}
