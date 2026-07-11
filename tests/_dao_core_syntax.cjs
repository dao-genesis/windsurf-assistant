#!/usr/bin/env node
/**
 * _dao_core_syntax.cjs — 印 63 · dao-core 语法 + 模块导出验
 * ════════════════════════════════════════════════════════════════════════
 *   帛书·六十四: 「合抱之木 · 生于毫末」
 *
 *   不启动服务 · 只验:
 *     1. 五文件 require 不抛
 *     2. 关键导出符号在
 *     3. fleet_controller 状态 IO 工作 (无外部副作用)
 *
 *   零外部依赖
 */
"use strict";

const path = require("path");
const fs = require("fs");
const os = require("os");

// 隔离 fleet_controller 状态文件 · 防 CI/测试间副作用
process.env.DAO_FLEET_FILE = path.join(
  os.tmpdir(),
  `dao-fleet-test-${process.pid}-${Date.now()}.json`,
);
process.on("exit", () => {
  try {
    if (fs.existsSync(process.env.DAO_FLEET_FILE))
      fs.unlinkSync(process.env.DAO_FLEET_FILE);
  } catch {}
});

const CORE = path.join(__dirname, "..", "packages", "dao-core");
let pass = 0;
let fail = 0;

function ok(cond, label) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    console.error(`  ✗ ${label}`);
  }
}

function main() {
  console.log("═══ dao-core 语法 + 导出验 · 印 63 ═══\n");

  // ── [A] 文件存在 ──────────────────────────────────────
  console.log("[A] 文件");
  const files = [
    "cloud_engine.js",
    "fleet_vm_unit.js",
    "fleet_controller.js",
    "dao_accounts.js",
    "model_registry.js",
    "package.json",
    "README.md",
  ];
  for (const f of files) {
    ok(fs.existsSync(path.join(CORE, f)), f);
  }

  // ── [B] cloud_engine 加载 ────────────────────────────
  console.log("[B] cloud_engine 加载");
  let CE;
  try {
    CE = require(path.join(CORE, "cloud_engine"));
    ok(true, "require cloud_engine 不抛");
  } catch (e) {
    ok(false, `require cloud_engine 抛: ${e.message}`);
    return finish();
  }
  ok(typeof CE.CloudClient === "function", "export CloudClient (class)");
  ok(typeof CE.chatStream === "function", "export chatStream");
  ok(typeof CE.getPlanStatus === "function", "export getPlanStatus");
  ok(typeof CE.resolveModel === "function", "export resolveModel");
  ok(Array.isArray(CE.MODEL_CATALOG), "export MODEL_CATALOG (array)");
  ok(
    CE.MODEL_CATALOG.length > 30,
    `MODEL_CATALOG 长 ${CE.MODEL_CATALOG.length} > 30`,
  );

  // ── [C] fleet_controller 加载 + 状态 IO ─────────────
  console.log("[C] fleet_controller 加载");
  let FC;
  try {
    FC = require(path.join(CORE, "fleet_controller"));
    ok(true, "require fleet_controller 不抛");
  } catch (e) {
    ok(false, `require fleet_controller 抛: ${e.message}`);
    return finish();
  }
  const expected = [
    "load",
    "save",
    "ensureSecret",
    "verifySecret",
    "registerUnit",
    "heartbeat",
    "markRateLimited",
    "removeUnit",
    "reapDead",
    "getAvailableUnits",
    "pickUnit",
    "recordRequest",
    "gatewayProxy",
    "generateSpawnConfigs",
    "getStatus",
    "setGatewayMode",
    "setGatewayEnabled",
    "probeAllUnits",
  ];
  for (const fn of expected) {
    ok(typeof FC[fn] === "function", `export ${fn}`);
  }

  // ── [D] fleet_controller 基本逻辑 ──────────────────
  console.log("[D] fleet_controller 基本");
  const status0 = FC.getStatus();
  ok(typeof status0 === "object", "getStatus() 返 object");
  ok(typeof status0.gatewayEnabled === "boolean", "gatewayEnabled 是 bool");
  ok(typeof status0.gatewayMode === "string", "gatewayMode 是 string");

  const sec = FC.ensureSecret();
  ok(
    typeof sec === "string" && sec.startsWith("fleet-"),
    `secret 'fleet-...' (got ${sec.slice(0, 12)}...)`,
  );
  ok(FC.verifySecret(sec) === true, "verifySecret(true_secret) → true");
  ok(FC.verifySecret("fleet-WRONG") === false, "verifySecret(wrong) → false");

  // ── [E] fleet_vm_unit 语法 (不加载 · 因会启 server) ──
  console.log("[E] fleet_vm_unit 语法");
  const { execSync } = require("child_process");
  try {
    execSync(
      `"${process.execPath}" -c "${path.join(CORE, "fleet_vm_unit.js").replace(/\\/g, "\\\\")}"`,
      { stdio: "pipe" },
    );
    ok(true, "fleet_vm_unit.js 语法过");
  } catch (e) {
    ok(false, `fleet_vm_unit.js 语法错: ${e.message.slice(0, 200)}`);
  }

  // ── [F] dao_accounts 加载 ────────────────────────────
  console.log("[F] dao_accounts 加载");
  let DA;
  try {
    DA = require(path.join(CORE, "dao_accounts"));
    ok(true, "require dao_accounts 不抛");
    ok(typeof DA.listAccounts === "function", "export listAccounts");
  } catch (e) {
    ok(false, `require dao_accounts 抛: ${e.message}`);
  }

  // ── [G] model_registry 加载 ─────────────────────────
  console.log("[G] model_registry 加载");
  try {
    const MR = require(path.join(CORE, "model_registry"));
    ok(true, "require model_registry 不抛");
    ok(typeof MR === "object" && MR !== null, "module 是 object");
  } catch (e) {
    ok(false, `require model_registry 抛: ${e.message}`);
  }

  // ── [H] package.json 内容 ──────────────────────────
  console.log("[H] package.json");
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(CORE, "package.json"), "utf8"),
    );
    ok(pkg.name === "dao-core", `name=dao-core (got ${pkg.name})`);
    ok(
      !pkg.dependencies || Object.keys(pkg.dependencies).length === 0,
      "dependencies 空 (零依赖)",
    );
    ok(pkg.engines && pkg.engines.node, "engines.node 在");
  } catch (e) {
    ok(false, `package.json 解析: ${e.message}`);
  }

  finish();
}

function finish() {
  console.log(`\n═══ dao-core 语法验完毕 · pass=${pass} fail=${fail} ═══`);
  if (fail > 0) {
    console.error("✗ 有失败项");
    process.exit(1);
  }
  console.log("✓ 全通 · 大制无割 · 朴散为器");
  process.exit(0);
}

main();
