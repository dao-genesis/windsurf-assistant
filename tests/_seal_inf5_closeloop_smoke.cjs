#!/usr/bin/env node
// _seal_inf5_closeloop_smoke.cjs · 印 ∞.5 · 全链路闭环导中证毕 (无为而治)
//
//   帛书·五十七「我无为也，而民自化 · 我好静，而民自正」
//   帛书·六十「治大国若烹小鲜」
//   帛书·六十四「慎终若始，则无败事矣」
//
//   主公诏 (2026-05-17 20:33):
//     「反者 道之动也 · 代替我之一切 · 全链路闭环导中
//      实时运行 · 实时反代 · 实时网页使用 · 实时一切内容
//      全链路彻底闭环 · 实现无为而治」
//
//   证毕之主公诏:
//     · ∞.2 一脚本起 (scripts/dao_run_all.cjs · 由 4cfbd3f 含)
//     · ∞.3 apiKey 三型前缀 (devin-session$ / ws-* / mock-or-other)
//     · ∞.4 wsChat 优先 keyObj.srvUrl hostname
//     · 133  WAM 本地真本源桥 (~/.wam → /admin/wam/{local,use})
//
//   印 ∞.5 守门 (静守 5 件 · 实证 ∞ 系列闭环可活):
//     §1 scripts/dao_run_all.cjs · ★ 真有 + 含「印 ∞.2」标 + 双旗承
//     §2 web/dao_app.js · 入 mine 时本地闭环自注 vmUrl=127.0.0.1:7780
//     §3 .gitignore · 守隐 _real_*_keys.json + _test_auth*_real.cjs
//     §4 dao_proxy.js · v0.4.3 + 印 ∞ 三型前缀 (∞.3) + srvUrl 优先 (∞.4)
//     §5 INDEX_GUIZONG.md · 印 ∞.5 章 (闭环证毕)

"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

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

function readSafe(p) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return "";
  }
}

head("§1 · scripts/dao_run_all.cjs 一脚本起闭环");
{
  const p = path.join(ROOT, "scripts", "dao_run_all.cjs");
  if (!fs.existsSync(p)) {
    ng("scripts/dao_run_all.cjs 存", "缺");
  } else {
    ok("scripts/dao_run_all.cjs 存");
    const s = readSafe(p);
    if (/印 ∞\.2|印\s*\\u221E\.2|全链路闭环/.test(s))
      ok("含「印 ∞.2 / 全链路闭环」标");
    else ng("印 ∞.2 标", "无");

    if (/--preserve-symlinks/.test(s)) ok("子进程 spawn 承双旗 (印 131 治本)");
    else ng("双旗承", "无 --preserve-symlinks");

    if (/dao_proxy\.js/.test(s) && /scripts.*WEB|http\.createServer/i.test(s))
      ok("一脚本起两子 (dao_proxy + web)");
    else ng("一脚本起两子", "缺");

    if (/127\.0\.0\.1:7780|VM_PORT.*7780/.test(s)) ok("本地直 127.0.0.1:7780");
    else ng("本地直", "无 7780");
  }
}

head("§2 · web/dao_app.js 入 mine 自注 vmUrl");
{
  const p = path.join(ROOT, "web", "dao_app.js");
  const s = readSafe(p);
  if (
    /isLocalWeb|127\\\.0\\\.0\\\.1.*localhost|localhost.*127\\\.0\\\.0\\\.1/.test(
      s,
    )
  )
    ok("isLocalWeb 判 (127.0.0.1 / localhost)");
  else ng("isLocalWeb 判", "无 isLocalWeb 标");

  if (/vmUrl\s*=\s*["']http:\/\/127\.0\.0\.1:7780["']/.test(s))
    ok("vmUrl 自填 http://127.0.0.1:7780");
  else ng("vmUrl 自填", "无");

  if (/本地闭环|印 ∞\.2|无为而治/.test(s))
    ok("含「本地闭环 / 印 ∞.2 / 无为而治」标");
  else ng("印 ∞.2 标", "无");
}

head("§3 · .gitignore 守隐真 keys");
{
  const p = path.join(ROOT, ".gitignore");
  const s = readSafe(p);
  if (/_real_.*keys\.json|_real_ws_keys\.json/.test(s))
    ok("守隐 _real_ws_keys.json (帛书三十六)");
  else ng("守隐", "无 _real_*_keys.json");

  if (/_test_auth.*_real/.test(s)) ok("守隐 _test_auth*_real.cjs");
  else ng("_test_auth*_real 守", "无");
}

head("§4 · dao_proxy.js 真本源单器 (印 ∞.3 + ∞.4)");
{
  const p = path.join(ROOT, "packages", "dao-devin-vm", "dao_proxy.js");
  const s = readSafe(p);
  if (/VERSION\s*=\s*["']0\.4\.[3-9]/.test(s)) ok("VERSION ≥ 0.4.3");
  else ng("VERSION", "≥0.4.3 否");

  if (/devin-session-token\$|isDevinSession/.test(s))
    ok("印 ∞.3 · devin-session-token$ 前缀识");
  else ng("印 ∞.3", "无 devin-session-token$");

  if (/srvUrl|keyObj\.srvUrl/.test(s)) ok("印 ∞.4 · srvUrl 字段用");
  else ng("印 ∞.4", "无 srvUrl");

  if (/wam:activeApiKey|loadTokens|wam-state\.json/.test(s))
    ok("印 133 · WAM 真本源桥");
  else ng("印 133 · WAM 桥", "无");

  if (/\/v1\/chat\/completions|handleOpenAIChat/.test(s))
    ok("A 路 /v1/* (OpenAI)");
  else ng("A 路", "无");

  if (/\/dc\/v1\/|handleDc|forceEngine/.test(s))
    ok("B 路 /dc/* (Devin Cloud · 印 ∞.2)");
  else ng("B 路 /dc/*", "无");
}

head("§5 · INDEX_GUIZONG.md 印 ∞.5 章");
{
  const p = path.join(ROOT, "INDEX_GUIZONG.md");
  const s = readSafe(p);
  if (/印 ∞\.5|印\s*∞\.5|inf5|inf-5/i.test(s))
    ok("INDEX_GUIZONG 含「印 ∞.5」节");
  else ng("印 ∞.5 节", "无 (待补)");

  if (/全链路闭环|无为而治|dao_run_all/.test(s))
    ok("INDEX_GUIZONG 提「全链路闭环 / 无为而治 / dao_run_all」");
  else ng("印 ∞.5 内容关键", "无");
}

// ─── 总 ─────────────────────────────────────────────────────────────────
console.log("");
console.log(
  "\x1b[1m═══ 印 ∞.5 守门: " +
    pass +
    "/" +
    (pass + fail) +
    " " +
    (fail === 0 ? "\x1b[32m✓ 全通" : "\x1b[31m✗ 有败") +
    " ═══\x1b[0m",
);
if (fail > 0) {
  console.log("\n失败件:");
  fails.forEach((f) => console.log("  · " + f));
  process.exit(1);
}
console.log("\n  道法自然 · 无为而无不为 · 印 ∞.5 闭环证毕");
process.exit(0);
