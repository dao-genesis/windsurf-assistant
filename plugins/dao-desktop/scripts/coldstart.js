#!/usr/bin/env node
// 道 · 冷启动一键器(纯后端·零 GUI): 全新虚拟机 → 官方 IDE 就位 → 账号登录 → LS 自持 → 实机体检。
// ─────────────────────────────────────────────────────────────────────────────
// 步骤(幂等, 已就位的步骤自动跳过):
//   1) 官方 bundle: ~/devin-desktop/Devin 不在则从官方 stable 通道下载解包(--no-download 跳过);
//   2) 登录: credentials.toml 已有 key 则复用; 否则用 DAO_EMAIL/DAO_PASSWORD 环境变量
//      走 packages/dao-core/windsurf_auth.js 后端登录并落盘(与官方同一路径, 不经 GUI);
//   3) 自持官方 LS(ls-boot) → GetUserStatus 验账号;
//   4) 体检 sweep: 轨迹清点 / RefreshCustomization / RefreshMcpServers / Lifeguard /
//      诊断 / Settings 写→复读→还原(sync-rpc.roundtrip);
//   5) 输出 JSON 报告, 全部关键步 PASS = 退出码 0, 否则 1(供 CI/脚本消费)。
// 用法: [DAO_EMAIL=.. DAO_PASSWORD=..] node scripts/coldstart.js [--no-download] [--json]
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const PLUGIN = path.join(__dirname, "..");
const STABLE_API = "https://windsurf-stable.codeium.com/api/update/linux-x64/stable/latest";

function credPath() {
  return process.env.DAO_DEVIN_CRED_FILE || path.join(os.homedir(), ".local", "share", "devin", "credentials.toml");
}

function credKey(p) {
  try {
    const m = fs.readFileSync(p || credPath(), "utf8").match(/windsurf_api_key\s*=\s*"([^"]+)"/);
    return m ? m[1] : null;
  } catch (_) { return null; }
}

function officialRoot() {
  const c = process.env.DEVIN_DESKTOP_APP || path.join(os.homedir(), "devin-desktop", "Devin");
  return fs.existsSync(c) ? c : null;
}

function lsBinOf(root) {
  const p = path.join(root, "resources", "app", "extensions", "windsurf", "bin", "language_server_linux_x64");
  return fs.existsSync(p) ? p : null;
}

// 步骤规划(纯函数·可测): 依据现场状态决定各步 run/skip
function plan(state) {
  return [
    { step: "download", run: !state.officialRoot && !state.noDownload },
    { step: "login", run: !state.hasKey },
    { step: "boot", run: true },
    { step: "sweep", run: true },
  ];
}

async function download(log) {
  const home = path.join(os.homedir(), "devin-desktop");
  fs.mkdirSync(home, { recursive: true });
  const meta = JSON.parse(execFileSync("curl", ["-s", STABLE_API], { encoding: "utf8" }));
  log("官方 stable 通道: " + meta.url);
  const tgz = path.join(home, "devin.tar.gz");
  execFileSync("curl", ["-sL", meta.url, "-o", tgz], { stdio: "inherit" });
  execFileSync("tar", ["xzf", tgz, "-C", home]);
  return officialRoot();
}

function login(log) {
  const email = process.env.DAO_EMAIL, password = process.env.DAO_PASSWORD;
  if (!email || !password) throw new Error("credentials.toml 无 key 且未提供 DAO_EMAIL/DAO_PASSWORD");
  const auth = path.join(PLUGIN, "..", "..", "packages", "dao-core", "windsurf_auth.js");
  const out = execFileSync("node", [auth, "auto", "--email", email, "--password", password, "--json", "--no-quota"], { encoding: "utf8" });
  const m = out.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("后端登录未返回 JSON");
  const key = JSON.parse(m[0]).apiKey;
  if (!key) throw new Error("后端登录未返回 apiKey");
  const p = credPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, 'windsurf_api_key = "' + key + '"\n');
  log("后端登录落盘: " + p + " (…" + key.slice(-4) + ")");
  return true;
}

async function sweep(ls) {
  const r = {};
  const st = await ls.call("GetUserStatus", {});
  r.account = (st.userStatus || {}).email || null;
  const tr = await ls.call("GetAllCascadeTrajectories", {});
  const s = tr.trajectorySummaries || {};
  r.trajectories = Array.isArray(s) ? s.length : Object.keys(s).length;
  await ls.call("RefreshCustomization", {}); r.refreshCustomization = true;
  await ls.call("RefreshMcpServers", {}); r.refreshMcp = true;
  r.lifeguard = !!(await ls.call("GetLifeguardConfig", {}));
  r.diagnostics = !!(await ls.call("GetDebugDiagnostics", {}));
  const rt = await require(path.join(PLUGIN, "dao-cascade", "sync-rpc")).settingsRoundtrip();
  r.settingsRoundtrip = !!(rt && rt.wrote && rt.readBack && rt.reverted);
  return r;
}

async function main() {
  const asJson = process.argv.includes("--json");
  const log = asJson ? () => {} : (m) => console.log("[coldstart]", m);
  const report = { steps: {}, ok: false };
  try {
    let root = officialRoot();
    const steps = plan({ officialRoot: root, hasKey: !!credKey(), noDownload: process.argv.includes("--no-download") });
    for (const { step, run } of steps) {
      if (!run) { report.steps[step] = "skip"; log(step + ": 已就位, 跳过"); continue; }
      if (step === "download") { root = await download(log); report.steps.download = root ? "ok" : "fail"; }
      if (step === "login") { report.steps.login = login(log) ? "ok" : "fail"; }
      if (step === "boot") {
        if (!root) throw new Error("官方 bundle 不在位(--no-download 且未安装)");
        const bin = lsBinOf(root);
        if (!bin) throw new Error("官方 LS 二进制缺失: " + root);
        if (!process.env.DAO_LS_BIN) process.env.DAO_LS_BIN = bin;
        const boot = require(path.join(PLUGIN, "dao-cascade", "ls-boot"));
        boot.setWorkspaceDir(PLUGIN);
        await boot.boot({ log: () => {} });
        report.steps.boot = "ok";
        log("自持官方 LS 已起: " + bin);
      }
      if (step === "sweep") {
        const ls = require(path.join(PLUGIN, "dao-cascade", "ls-bridge"));
        report.sweep = await sweep(ls);
        report.steps.sweep = report.sweep.account ? "ok" : "fail";
        log("体检: " + JSON.stringify(report.sweep));
        require(path.join(PLUGIN, "dao-cascade", "ls-boot")).stop();
      }
    }
    report.ok = Object.values(report.steps).every((v) => v === "ok" || v === "skip");
  } catch (e) {
    report.error = e.message;
  }
  if (asJson) console.log(JSON.stringify(report, null, 1));
  else console.log("[coldstart] " + (report.ok ? "全链路 PASS" : "FAIL: " + (report.error || JSON.stringify(report.steps))));
  process.exit(report.ok ? 0 : 1);
}

if (require.main === module) main();
module.exports = { plan, credPath, credKey, officialRoot, lsBinOf };
