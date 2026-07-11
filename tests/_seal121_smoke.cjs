#!/usr/bin/env node
/**
 * _seal121_smoke.cjs · 印 121 守门 · auth_chain 三口同源律
 * ════════════════════════════════════════════════════════════════════════
 *   帛书·廿二: 「圣人执一 · 以为天下牧」
 *   帛书·六十四: 「为之于其未有也 · 治之于其未乱也」· 「慎终若始 · 则无败事」
 *   帛书·四十: 「反也者 · 道之动也」
 *
 * 跑: node tests/_seal121_smoke.cjs
 *
 * 印 121 之三补 (Devin VM 反代核心 · auth_chain 真闭环):
 *   ① web/dao_bootstrap.js   · oneShot 生 sk-ws-proxy-* + 锡 inputs.auth_key
 *   ② .github/workflows/dao-fleet-devin-cloud.yml · step 三 末段 写 .dao_auth_token
 *   ③ packages/dao-devin-vm/deployer.js · 三泉读 (env > 盘 > null) + daemons[].auth_token 完整
 *
 * 此守门验三口同源 · auth-key 不漂不分 · web ↔ workflow ↔ daemon 一气贯通
 *
 * 立印: 印 121 (2026-05-16) · yin121-broken-chain-fix
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const YML = path.join(ROOT, ".github", "workflows", "dao-fleet-devin-cloud.yml");
const DEPLOYER = path.join(ROOT, "packages", "dao-devin-vm", "deployer.js");
const BOOTSTRAP = path.join(ROOT, "web", "dao_bootstrap.js");

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

function readSafe(fp) {
  if (!fs.existsSync(fp)) return null;
  return fs.readFileSync(fp, "utf8");
}

console.log("═══ 印 121 smoke · auth_chain 三口同源守门 ═══");
console.log("");
console.log("帛书·廿二:「圣人执一 · 以为天下牧」");
console.log("");

// ─── 1. yml inputs 6 项 (n / gist_id / pat / auth_key / auth_required / max_minutes) ───
console.log("[1] yml workflow_dispatch.inputs 全 6 项");
const yml = readSafe(YML);
if (!yml) {
  ng("yml", "缺 .github/workflows/dao-fleet-devin-cloud.yml");
} else {
  for (const k of [
    "n:",
    "gist_id:",
    "pat:",
    "auth_key:",
    "auth_required:",
    "max_minutes:",
  ]) {
    // yml inputs 节名以 indent + key + ":" 显
    if (yml.includes(`        ${k}`) || yml.includes(`      ${k}`)) {
      ok(`inputs.${k.slice(0, -1)} 立`);
    } else {
      ng("yml inputs", `缺 ${k}`);
    }
  }
}

// ─── 2. yml step 三 末段 · 写 .dao_auth_token (mkdir + printf + chmod 600) ───
console.log("");
console.log("[2] yml step 三 · 锡 auth_key · 写 .dao_auth_token");
if (yml) {
  for (const k of [
    "DAO_AUTH_KEY:",
    "packages/dao-devin-vm/.dao_auth_token",
    "chmod 600",
    "mkdir -p packages/dao-devin-vm",
    "印 121",
  ]) {
    if (yml.includes(k)) ok(`yml 含 "${k}"`);
    else ng("yml step 三", `缺 "${k}"`);
  }
}

// ─── 3. yml step 五 · max_minutes 守 (0..350) ───
console.log("");
console.log("[3] yml step 五 · max_minutes 守 (防 oneShot 传非数 / 超 350)");
if (yml) {
  for (const k of [
    "MAX_MIN_INPUT:",
    "max_minutes ||",
    "grep -E '^[0-9]+$'",
    '"$MAX_MIN" -gt 350',
    '"$MAX_MIN" -lt 1',
  ]) {
    if (yml.includes(k)) ok(`yml 守 "${k}"`);
    else ng("yml max_minutes 守", `缺 "${k}"`);
  }
}

// ─── 4. deployer.js · auth 三泉读 (env > 盘 > null · 优先序) ───
console.log("");
console.log("[4] deployer.js · auth token 三泉读 (env DAO_AUTH_TOKEN > .dao_auth_token > null)");
const dep = readSafe(DEPLOYER);
if (!dep) {
  ng("deployer", "缺 packages/dao-devin-vm/deployer.js");
} else {
  for (const k of [
    "process.env.DAO_AUTH_TOKEN",
    "fs.existsSync(AUTH_FILE)",
    "fs.readFileSync(AUTH_FILE",
    "印 121",
    "auth token 三泉",
  ]) {
    if (dep.includes(k)) ok(`deployer 三泉 "${k}"`);
    else ng("deployer", `缺 "${k}"`);
  }
}

// ─── 5. deployer.js · daemons[i].auth_token 完整 (非 prefix) + yin: 121 协议标识 ───
console.log("");
console.log("[5] deployer.js · daemons[].auth_token 完整 + yin: 121 协议标识");
if (dep) {
  for (const k of [
    "auth_token: authToken",
    "auth_token_hint:",
    "yin: 121",
    "X-Dao-Auth",
  ]) {
    if (dep.includes(k)) ok(`deployer 写 "${k}"`);
    else ng("deployer daemons[]", `缺 "${k}"`);
  }
}

// ─── 6. bootstrap.js · FLEET_WF_FILE 切至 dao-fleet-devin-cloud.yml ───
console.log("");
console.log("[6] bootstrap.js · FLEET_WF_FILE = dao-fleet-devin-cloud.yml + LEGACY 兼老");
const bs = readSafe(BOOTSTRAP);
if (!bs) {
  ng("bootstrap", "缺 web/dao_bootstrap.js");
} else {
  for (const k of [
    'FLEET_WF_FILE = "dao-fleet-devin-cloud.yml"',
    'FLEET_WF_FILE_LEGACY = "dao-fleet-cloud.yml"',
    "印 121",
  ]) {
    if (bs.includes(k)) ok(`bootstrap 切 "${k}"`);
    else ng("bootstrap FLEET_WF_FILE", `缺 "${k}"`);
  }
}

// ─── 7. bootstrap.js · dispatchCloudFleet 之 inputs (auth_key + auth_required + max_minutes) ───
console.log("");
console.log("[7] bootstrap.js · dispatchCloudFleet 之 inputs 三项");
if (bs) {
  for (const k of [
    "inputs.auth_key = opts.authKey",
    "inputs.auth_required",
    "inputs.max_minutes",
    "sk-ws-proxy",
  ]) {
    if (bs.includes(k)) ok(`bootstrap 锡 "${k}"`);
    else ng("bootstrap dispatchCloudFleet", `缺 "${k}"`);
  }
}

// ─── 8. JS 三件 syntax 全过 ───
console.log("");
console.log("[8] JS 三件 syntax (node -c)");
const { spawnSync } = require("child_process");
for (const fp of [DEPLOYER, BOOTSTRAP]) {
  const r = spawnSync("node", ["-c", fp], { encoding: "utf8" });
  if (r.status === 0) ok(`${path.basename(fp)} · syntax OK`);
  else ng(path.basename(fp), `node -c 失: ${(r.stderr || "").slice(0, 200)}`);
}

console.log("");
console.log(
  `═══ 总: \x1b[32m${pass} 过\x1b[0m / \x1b[31m${fail} 失\x1b[0m ═══`,
);
if (fail > 0) {
  console.log("");
  console.log("\x1b[31m失项:\x1b[0m");
  failures.forEach((f) => console.log(`  · ${f}`));
  console.log("");
  console.log(
    "\x1b[33m▸ 修法: 检 yin121 三补是否真落 · 详查 web/dao_bootstrap.js + deployer.js + dao-fleet-devin-cloud.yml\x1b[0m",
  );
  process.exit(1);
} else {
  console.log("");
  console.log(
    "\x1b[32m✓ auth_chain 三口同源律守 · 圣人执一 · web ↔ workflow ↔ daemon 一气贯通\x1b[0m",
  );
  process.exit(0);
}
