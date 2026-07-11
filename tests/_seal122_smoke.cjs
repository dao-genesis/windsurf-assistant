#!/usr/bin/env node
/**
 * _seal122_smoke.cjs · 印 122 守门 · yin122 全审纳入律
 * ════════════════════════════════════════════════════════════════════════
 *   帛书·廿二: 「圣人执一 · 以为天下牧」
 *   帛书·六十四: 「为之于其未有也 · 治之于其未乱也」· 「慎终若始 · 则无败事」
 *   帛书·四十: 「反也者 · 道之动也」
 *
 * 跑: node tests/_seal122_smoke.cjs
 *
 * 印 122 之四补 (yin122 · 主公诏「专注于底层 · 推进到底 · 发现所有问题 · 解决一切」):
 *   ① 3 件 untracked → git tracked (sp_observe_patch / meta_router / vm_meta_deploy)
 *   ② 印号统一升 印 122 (sp_observe 120→122 · meta_router 121→122 · vm_meta_deploy 120→122 · dao_proxy SEAL 106→122)
 *   ③ vm_proxy_deploy.js silk 双源传 (silk/_silk_de.txt + silk/_silk_dao.txt) · 治真本源大断
 *   ④ dao_proxy.js §0.1 sp_observe_patch 软接入 + wss-observe 三端点接主路由
 *
 * 立印: 印 122 (2026-05-17) · yin122 全审纳入
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const PKG = path.join(ROOT, "packages", "dao-devin-vm");
const DAO_PROXY = path.join(PKG, "dao_proxy.js");
const SP_OBSERVE = path.join(PKG, "sp_observe_patch.js");
const META_ROUTER = path.join(PKG, "meta_router.cjs");
const VM_META_DEPLOY = path.join(PKG, "vm_meta_deploy.js");
const VM_PROXY_DEPLOY = path.join(PKG, "vm_proxy_deploy.js");
const SILK_DAO = path.join(PKG, "silk", "_silk_dao.txt");
const SILK_DE = path.join(PKG, "silk", "_silk_de.txt");

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

console.log("═══ 印 122 smoke · yin122 全审纳入守门 ═══");
console.log("");
console.log("帛书·廿二:「圣人执一 · 以为天下牧」+ 六十四:「治之于其未乱也」");
console.log("");

// ─── 1. 3 件 untracked → 现存 (大小合理) ───
console.log("[1] 3 件 yin122 真本源补存 + 大小合理");
const trio = [
  { fp: SP_OBSERVE, name: "sp_observe_patch.js", minKB: 5, maxKB: 15 },
  { fp: META_ROUTER, name: "meta_router.cjs", minKB: 15, maxKB: 40 },
  { fp: VM_META_DEPLOY, name: "vm_meta_deploy.js", minKB: 10, maxKB: 25 },
];
for (const f of trio) {
  if (!fs.existsSync(f.fp)) {
    ng(f.name, "件不存");
    continue;
  }
  const kb = fs.statSync(f.fp).size / 1024;
  if (kb < f.minKB || kb > f.maxKB) {
    ng(f.name, `size=${kb.toFixed(1)}KB · 期 [${f.minKB}, ${f.maxKB}]`);
    continue;
  }
  ok(`${f.name} · ${kb.toFixed(1)}KB`);
}

// ─── 2. 印号统一升 印 122 (4 件 SEAL/header) ───
console.log("");
console.log("[2] 印号统一升 印 122");
const sealChecks = [
  { fp: SP_OBSERVE, name: "sp_observe_patch", expect: '"印 122' },
  { fp: META_ROUTER, name: "meta_router", expect: '"印 122' },
  { fp: VM_META_DEPLOY, name: "vm_meta_deploy 头", expect: "印 122" },
  { fp: DAO_PROXY, name: "dao_proxy SEAL", expect: '"印 122' },
];
for (const s of sealChecks) {
  const c = readSafe(s.fp);
  if (!c) {
    ng(s.name, "件不存");
    continue;
  }
  if (c.includes(s.expect)) ok(`${s.name} 含 "${s.expect}"`);
  else ng(s.name, `缺 "${s.expect}"`);
}

// ─── 3. dao_proxy.js §0.1 sp_observe_patch 软接入 + wss-observe 三端点接主路由 ───
console.log("");
console.log("[3] dao_proxy.js §0.1 软接入 + wss-observe 三端点");
const dp = readSafe(DAO_PROXY);
if (!dp) {
  ng("dao_proxy.js", "缺");
} else {
  for (const k of [
    "§ 0.1 · 印 122 · sp_observe_patch 软接入",
    'require("./sp_observe_patch")',
    "__spObserve.capture(data)",
    "__spObserve.makeHttpHandlers()",
    "/v1/system/wss-observe",
    "/v1/system/wss-observe/full",
    "/v1/system/wss-observe/reset",
  ]) {
    if (dp.includes(k)) ok(`dao_proxy 含 "${k}"`);
    else ng("dao_proxy §0.1/路由", `缺 "${k}"`);
  }
}

// ─── 4. vm_proxy_deploy.js silk 双源传送 (治真本源大断) ───
console.log("");
console.log("[4] vm_proxy_deploy.js silk 双源传送");
const vpd = readSafe(VM_PROXY_DEPLOY);
if (!vpd) {
  ng("vm_proxy_deploy.js", "缺");
} else {
  for (const k of [
    "印 122 · 真本源 silk 双源传",
    'silk", "_silk_dao.txt"',
    'silk", "_silk_de.txt"',
    "/silk/_silk_dao.txt",
    "/silk/_silk_de.txt",
    "印 122 · sp_observe_patch.js 软伴",
  ]) {
    if (vpd.includes(k)) ok(`vm_proxy_deploy 含 "${k}"`);
    else ng("vm_proxy_deploy", `缺 "${k}"`);
  }
}

// ─── 5. silk 双源真存 + 大小合理 ───
console.log("");
console.log("[5] silk 双源真本源 (帛书《老子》道+德篇)");
for (const s of [
  { fp: SILK_DAO, name: "_silk_dao.txt (道篇)", minB: 8000, maxB: 11000 },
  { fp: SILK_DE, name: "_silk_de.txt (德篇)", minB: 10000, maxB: 13000 },
]) {
  if (!fs.existsSync(s.fp)) {
    ng(s.name, "缺");
    continue;
  }
  const b = fs.statSync(s.fp).size;
  if (b < s.minB || b > s.maxB) {
    ng(s.name, `size=${b}B · 期 [${s.minB}, ${s.maxB}]`);
    continue;
  }
  ok(`${s.name} · ${b}B`);
}

// ─── 6. dao_proxy.js loadSilk 双源逻辑 (line 244-247) ───
console.log("");
console.log("[6] dao_proxy.js loadSilk 双源加载逻辑");
if (dp) {
  for (const k of [
    "_silk_de.txt",
    "_silk_dao.txt",
    'de + "\\n\\n" + dao',
    "INLINE_SILK",
  ]) {
    if (dp.includes(k)) ok(`loadSilk 含 "${k}"`);
    else ng("loadSilk", `缺 "${k}"`);
  }
}

// ─── 7. SP 七态 allowed (line ~2127) ───
console.log("");
console.log("[7] SP 七态隔离管理 (主公诏②)");
if (dp) {
  for (const s of [
    "bypass",
    "override",
    "prepend",
    "append",
    "dao",
    "custom",
    "usernote",
  ]) {
    // 验 allowed = ["bypass", ...] 之内
    const inAllowed = new RegExp(`"${s}"`).test(dp);
    if (inAllowed) ok(`SP 态 "${s}" 在 allowed`);
    else ng("SP 七态", `缺 "${s}"`);
  }
}

// ─── 8. 双池路由 (一 Windsurf 账号 + Devin Cloud 双底层 · 主公诏①) ───
console.log("");
console.log("[8] 双池路由 (主公诏① · 一账号双底层反代)");
if (dp) {
  for (const k of [
    "function isWindsurfModel(",
    "function pickWsKey(",
    "function wsChat(",
    "function pickToken(",
    "function chatViaWss(",
    "WS_MODEL_PREFIXES",
    "WS_MODEL_KEYWORDS",
    "MODELS = [",
    '"windsurf-swe-1.5"',
    '"devin-cloud"',
  ]) {
    if (dp.includes(k)) ok(`双池路由含 "${k}"`);
    else ng("双池路由", `缺 "${k}"`);
  }
}

// ─── 9. auth 4 门 (公网无感 · 主公诏③) ───
console.log("");
console.log("[9] auth 4 门 + handleHealth 显 (主公诏③ · 公网无感)");
if (dp) {
  for (const k of [
    "Authorization: Bearer",
    "X-Dao-Auth",
    "X-Api-Key",
    '"?key="',
  ]) {
    if (dp.includes(k)) ok(`auth 门含 "${k}"`);
    else ng("auth 4 门", `缺 "${k}"`);
  }
}

// ─── 10. 三协议适配器 (OpenAI · Anthropic · Gemini) ───
console.log("");
console.log("[10] 三协议适配器 (OpenAI + Anthropic + Gemini)");
if (dp) {
  for (const k of [
    "function handleOpenAI(",
    "function handleAnthropic(",
    "function handleGemini(",
    "/v1/chat/completions",
    "/v1/messages",
    "/v1beta/models/",
    ":generateContent",
  ]) {
    if (dp.includes(k)) ok(`三协议含 "${k}"`);
    else ng("三协议", `缺 "${k}"`);
  }
}

// ─── 11. JS 5 件 syntax (node -c) ───
console.log("");
console.log("[11] JS 5 件 syntax (node -c)");
for (const fp of [
  DAO_PROXY,
  SP_OBSERVE,
  META_ROUTER,
  VM_META_DEPLOY,
  VM_PROXY_DEPLOY,
]) {
  if (!fs.existsSync(fp)) {
    ng(path.basename(fp), "缺");
    continue;
  }
  const r = spawnSync("node", ["-c", fp], { encoding: "utf8" });
  if (r.status === 0) ok(`${path.basename(fp)} · syntax OK`);
  else ng(path.basename(fp), `node -c 失: ${(r.stderr || "").slice(0, 200)}`);
}

// ─── §12 印 123 · 清二治 · web SP 7 态对齐 dao_proxy ─────────────────
console.log("\n[12] 印 123 · 清二治 · web SP 7 态对齐 (dao_app.js)");
const daoAppPath = path.resolve(__dirname, "..", "web", "dao_app.js");
if (fs.existsSync(daoAppPath)) {
  const src = fs.readFileSync(daoAppPath, "utf8");
  // 验 7 态字串全在
  const sevenStates = [
    "bypass",
    "dao",
    "usernote",
    "prepend",
    "append",
    "override",
    "custom",
  ];
  // 注: web 端 passthrough 兼老 alias bypass · 字串映射在 syncSpModeToVm
  const webModes = [
    "passthrough",
    "dao",
    "usernote",
    "prepend",
    "append",
    "override",
    "custom",
  ];
  for (const m of webModes) {
    if (src.includes(`"${m}"`)) ok(`web 态 "${m}" 立`);
    else ng(`web SP 态 "${m}" 缺 (dao_app.js)`, "印 123 升 7 态");
  }
  // 验 endpoint 升 /v1/system/prompt (印 122 现接口)
  if (src.includes("/v1/system/prompt"))
    ok("endpoint /v1/system/prompt 接齐 (印 122)");
  else
    ng(
      "endpoint /v1/system/prompt 缺 (dao_app.js syncSpModeToVm)",
      "印 123 治断",
    );
  // 验 passthrough → bypass 翻字 (兼老)
  if (
    src.match(/passthrough[^"]*\?\s*"bypass"/) ||
    src.includes('mode === "passthrough" ? "bypass"')
  ) {
    ok("passthrough → bypass 翻字立 (兼老)");
  } else
    ng(
      "passthrough → bypass 翻字缺 (dao_app.js syncSpModeToVm)",
      "印 123 兼老",
    );
  // 验 body strategy 字段 (印 122 接口)
  if (
    src.includes("strategy }") ||
    src.includes("strategy:") ||
    src.match(/JSON\.stringify\(\{\s*strategy\s*\}/)
  ) {
    ok("body strategy 字段立 (印 122)");
  } else ng("body strategy 字段缺", "应 POST { strategy }");
  // 验 customSp 字段 (印 122 接口)
  if (src.includes("customSp")) ok("body customSp 字段立 (印 122)");
  else ng("body customSp 字段缺", "应 POST { customSp }");
  // 验 SP 七态文案
  if (src.includes("SP 七态") || src.includes("七态"))
    ok("SP 七态 标题升 (印 123)");
  else ng("SP 七态 标题缺", "应升「SP 七态」");
} else {
  ng("dao_app.js 不存", daoAppPath);
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
    "\x1b[33m▸ 修法: 检 yin122 四补真落 (3 件 git track + 印号 122 + silk 双源传 + §0.1 软接入)\x1b[0m",
  );
  process.exit(1);
} else {
  console.log("");
  console.log(
    "\x1b[32m✓ yin122 全审纳入律守 · 圣人执一 · 反者道之动 · 道法自然\x1b[0m",
  );
  process.exit(0);
}
