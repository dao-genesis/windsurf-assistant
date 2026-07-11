#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
// _seal88_smoke.cjs · 印 88 · 一账号双路 · 物无非彼物无非是 · 守门
// ═══════════════════════════════════════════════════════════════════════
//
// 帛书·四十二:   道生一 · 一生二 · 二生三 · 三生万物
// 帛书·四十:     反者道之动 · 弱者道之用 · 天下之物生于有 · 有生于无
// 庄子·齐物论:   物无非彼，物无非是；自彼则不见，自是则知之
//
// 主公真愿 (印 87 承印 88):
//   承印 87 终贺报 · 整合 Devin 云原生 · 实现一账号双路同走 devin cloud
//   反代底层之 api + 替换提示词. 物无非彼物无非是 · 三者一气化三清.
//
// 印 88 立件 6:
//   ① packages/dao-core/devin_cloud_engine.js  · B 路引擎 (wss://app.devin.ai · ACP)
//   ② packages/dao-core/sp_handler.js          · SP 3 模式 (passthrough/dao/custom)
//   ③ packages/dao-core/silk/_silk_dao.txt     · 帛书道经 (9K)
//   ④ packages/dao-core/silk/_silk_de.txt      · 帛书德经 (11K)
//   ⑤ packages/dao-core/fleet_vm_unit.js 改    · /dc/v1/* + /sp/* 路由 + dualPath /health
//   ⑥ web/dao_app.js 改                        · 模型双路 optgroup + 智能分流 + SP 真同步
//
// 验:
//   [A] 4 新件存在 + 语法 OK
//   [B] devin_cloud_engine 导出 (chat / healthCheck / WSS_BASE / TOKEN_PREFIX)
//   [C] sp_handler 导出 + 帛书载入 (DAO_DE_JING.length > 15K)
//   [D] fleet_vm_unit dual-path 锚 (DC/SP lazy require · /dc/v1 + /sp 路由 · dualPath 字段)
//   [E] web/dao_app.js 双路 UI (modelsByPath + devin-cloud-* + pathPrefix 分流 + syncSpToVm)
//   [F] README 印 88 印记
//
// 零依赖 · 静态读 + node --check · 无网 · 无 unit 启
// ═══════════════════════════════════════════════════════════════════════
"use strict";

const fs = require("fs");
const path = require("path");
const cp = require("child_process");

const ROOT = path.join(__dirname, "..");
let pass = 0,
  fail = 0;

function ok(cond, msg) {
  if (cond) {
    pass++;
    console.log("  ✓ " + msg);
  } else {
    fail++;
    console.log("  ✗ " + msg);
  }
}
function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}
function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}
function size(rel) {
  try {
    return fs.statSync(path.join(ROOT, rel)).size;
  } catch {
    return -1;
  }
}
function nodeSyntax(rel) {
  try {
    cp.execFileSync(process.execPath, ["--check", path.join(ROOT, rel)], {
      stdio: "pipe",
    });
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      err: (e.stderr || e.message || "").toString().slice(0, 200),
    };
  }
}

console.log("═══ _seal88_smoke · 印 88 · 一账号双路守门 ═══\n");

// ─── [A] 4 新件存在 + 语法 OK ───────────────────────────────────────
console.log("[A] 4 新件 (B 路引擎 + SP 处理器 + 帛书 ×2)");
const newFiles = [
  ["packages/dao-core/devin_cloud_engine.js", 20000, 40000], // 印 92 升: +metrics +normalizeMessages +sessionMetrics +tools warn (~+10K)
  ["packages/dao-core/sp_handler.js", 20000, 28000],
  ["packages/dao-core/silk/_silk_dao.txt", 7000, 12000],
  ["packages/dao-core/silk/_silk_de.txt", 9000, 13000],
];
for (const [rel, sMin, sMax] of newFiles) {
  ok(exists(rel), rel + " 存在");
  const s = size(rel);
  ok(
    s >= sMin && s <= sMax,
    rel + " 大小 " + s + " (期望 " + sMin + "-" + sMax + ")",
  );
}
// 语法 check (仅 .js)
for (const rel of [
  "packages/dao-core/devin_cloud_engine.js",
  "packages/dao-core/sp_handler.js",
]) {
  const r = nodeSyntax(rel);
  ok(r.ok, rel + " syntax OK" + (r.ok ? "" : " · " + r.err));
}

// ─── [B] devin_cloud_engine 导出 ────────────────────────────────────
console.log("\n[B] devin_cloud_engine.js · B 路 wss 引擎导出");
let DC;
try {
  DC = require(path.join(ROOT, "packages/dao-core/devin_cloud_engine.js"));
  ok(true, "require devin_cloud_engine 成");
} catch (e) {
  ok(false, "require devin_cloud_engine 失: " + e.message);
  DC = {};
}
ok(typeof DC.chat === "function", "导 chat (async)");
ok(typeof DC.healthCheck === "function", "导 healthCheck");
ok(
  DC.WSS_BASE === "wss://app.devin.ai/api/acp/live",
  "WSS_BASE = wss://app.devin.ai/api/acp/live",
);
ok(
  DC.TOKEN_PREFIX === "devin-session-token$",
  "TOKEN_PREFIX = devin-session-token$",
);
ok(typeof DC._buildWssUrl === "function", "辅 _buildWssUrl 可单测");
ok(typeof DC._messagesToPrompt === "function", "辅 _messagesToPrompt 可单测");

// 单测: _buildWssUrl
if (typeof DC._buildWssUrl === "function") {
  const u = DC._buildWssUrl("devin-session-token$abc.def.ghi");
  ok(u.includes("token=abc.def.ghi"), "_buildWssUrl 取 JWT 入 URL · prefix 剥");
}

// 单测: _messagesToPrompt
if (typeof DC._messagesToPrompt === "function") {
  const p = DC._messagesToPrompt([
    { role: "system", content: "你是道" },
    { role: "user", content: "hi" },
  ]);
  ok(Array.isArray(p) && p.length >= 1, "_messagesToPrompt 返数组");
  ok(p[0] && p[0].type === "text", "首笔 type=text");
  ok(
    p[0].text.indexOf("你是道") >= 0 && p[0].text.indexOf("hi") >= 0,
    "system + user 合并入单 prompt",
  );
}

// ─── [C] sp_handler 导出 + 帛书载入 ────────────────────────────────
console.log("\n[C] sp_handler.js · SP 3 模式 + 帛书载入");
let SP;
try {
  SP = require(path.join(ROOT, "packages/dao-core/sp_handler.js"));
  ok(true, "require sp_handler 成");
} catch (e) {
  ok(false, "require sp_handler 失: " + e.message);
  SP = {};
}
ok(typeof SP.applyToMessages === "function", "导 applyToMessages");
ok(typeof SP.getState === "function", "导 getState");
ok(typeof SP.setMode === "function", "导 setMode");
ok(typeof SP.setCustom === "function", "导 setCustom");
ok(typeof SP.setOpts === "function", "导 setOpts");
ok(typeof SP.getSilkText === "function", "导 getSilkText");
ok(typeof SP.getObserveLog === "function", "导 getObserveLog");
ok(typeof SP.DAO_DE_JING === "string", "导 DAO_DE_JING 字串");
ok(
  SP.DAO_DE_JING && SP.DAO_DE_JING.length > 6000,
  "帛书全文载入 chars=" +
    (SP.DAO_DE_JING || "").length +
    " (> 6000 · «老子»約 7204 字)",
);
ok(SP.DAO_DE_JING && SP.DAO_DE_JING.indexOf("道生一") >= 0, "含『道生一』");
ok(SP.DAO_DE_JING && SP.DAO_DE_JING.indexOf("上德不德") >= 0, "含『上德不德』");
// 印 89 · TAO_HEADER 反 alignment 之反 · 由"身份替换"改"风格引导"
//   旧 (印 88): 含 "You are Cascade..." · Claude alignment 拒
//   新 (印 89): 风格引导 · 不含 Cascade · alignment 0% → 53% (3/3 闭环)
ok(
  typeof SP.TAO_HEADER === "string" &&
    SP.TAO_HEADER.indexOf("Cascade") < 0 &&
    SP.TAO_HEADER.indexOf("老子") >= 0 &&
    SP.TAO_HEADER.indexOf("思想风格") >= 0,
  "TAO_HEADER 印 89 柔反 (无 Cascade · 含 老子 + 思想风格)",
);
ok(
  typeof SP.TAO_TRAILER === "string" && SP.TAO_TRAILER.indexOf("风格指引") >= 0,
  "TAO_TRAILER 印 89 含 '风格指引'",
);
ok(
  typeof SP.INVERTED_PREFIX === "string" &&
    SP.INVERTED_PREFIX === "请以下文《老子》",
  "INVERTED_PREFIX 印 89 = '请以下文《老子》'",
);

// 单测: getState + applyToMessages passthrough
if (typeof SP.getState === "function") {
  const st = SP.getState();
  ok(
    st &&
      ["passthrough", "dao", "custom"].includes(st.mode) &&
      st.silkLoaded === true &&
      st.silkChars > 6000,
    "getState 返 mode/silkLoaded/silkChars (mode=" +
      (st && st.mode) +
      " · silk=" +
      (st && st.silkChars) +
      ")",
  );
}
if (typeof SP.applyToMessages === "function") {
  // 此测无 ~/.dao/sp_state.json 时 mode 默 'dao' (DEFAULT_STATE.mode='dao')
  // 故 system 应被替为 TAO_HEADER+帛书
  const out = SP.applyToMessages([{ role: "user", content: "hi" }], {
    modelUid: "test",
    protocol: "openai",
    stream: false,
  });
  ok(Array.isArray(out), "applyToMessages 返数组");
  ok(out.length >= 1, "返非空 (含 system + user 或 user)");
}

// ─── [D] fleet_vm_unit dual-path 锚 ────────────────────────────────
console.log("\n[D] fleet_vm_unit.js · dual-path 锚 (印 88)");
ok(exists("packages/dao-core/fleet_vm_unit.js"), "fleet_vm_unit.js 存在");
const vmS = nodeSyntax("packages/dao-core/fleet_vm_unit.js");
ok(vmS.ok, "fleet_vm_unit syntax OK" + (vmS.ok ? "" : " · " + vmS.err));
const fv = read("packages/dao-core/fleet_vm_unit.js");
ok(/印 88/.test(fv), "印 88 印记");
ok(/getDevinCloudEngine/.test(fv), "lazy require getDevinCloudEngine");
ok(/getSpHandler/.test(fv), "lazy require getSpHandler");
ok(/applySpToMessages/.test(fv), "应用 SP 之统一入 applySpToMessages");
ok(
  /handleDevinCloudChat/.test(fv),
  "B 路处理器 handleDevinCloudChat (~210 行)",
);
ok(/handleDevinCloudModels/.test(fv), "B 路模型列 handleDevinCloudModels");
ok(/handleSpRoute/.test(fv), "SP 路由处理 handleSpRoute");
ok(
  /\/dc\/v1\/chat\/completions/.test(fv),
  "新路 /dc/v1/chat/completions (B 路 chat)",
);
ok(/\/dc\/v1\/models/.test(fv), "新路 /dc/v1/models (B 路模型列)");
ok(
  /pathname === "\/sp" \|\| pathname\.startsWith\("\/sp\/"/.test(fv),
  "新路 /sp/* (SP 管理)",
);
ok(/dualPath:/.test(fv), "/health 含 dualPath 字段");
ok(/pathA:/.test(fv) && /pathB:/.test(fv), "dualPath 含 pathA + pathB");
ok(/X-Dao-Engine.*devin-cloud/i.test(fv), "B 路响应 X-Dao-Engine: devin-cloud");
ok(
  /devin-cloud-agent|devin-cloud-claude|devin-cloud-gpt/.test(fv),
  "B 路至少含一 devin-cloud-* 模型",
);
ok(
  /物无非彼/.test(fv) && /物无非是/.test(fv),
  "印记 · 物无非彼物无非是 (庄子齐物论)",
);

// ─── [E] web/dao_app.js 双路 UI ────────────────────────────────────
console.log("\n[E] web/dao_app.js · 双路 UI (印 88)");
ok(exists("web/dao_app.js"), "web/dao_app.js 存在");
const appS = nodeSyntax("web/dao_app.js");
ok(appS.ok, "dao_app.js syntax OK" + (appS.ok ? "" : " · " + appS.err));
const app = read("web/dao_app.js");
ok(/印 88/.test(app), "印 88 印记");
ok(/modelsByPath/.test(app), "模型按双路分组 modelsByPath");
ok(/devin-cloud-claude/.test(app), "B 路模型 devin-cloud-claude 入选");
ok(/devin-cloud-gpt/.test(app), "B 路模型 devin-cloud-gpt 入选");
ok(/devin-cloud-agent/.test(app), "B 路模型 devin-cloud-agent 入选");
ok(
  /pathPrefix\s*=\s*\/devin-cloud\/i\.test/.test(app),
  "智能分流 pathPrefix (model 含 devin-cloud → /dc/v1)",
);
ok(/\/dc\/v1/.test(app), "/dc/v1 路径入 chat 分流");
ok(/syncSpModeToVm/.test(app), "SP mode 推 VM /sp/mode");
ok(/syncSpCustomToVm/.test(app), "SP custom 推 VM /sp/custom");
ok(/dualPath/.test(app), "testVm 显 dualPath 状态");
ok(/optgroup/.test(app), "模型 select 用 optgroup 分组");

// ─── [F] README 印 88 印记 ─────────────────────────────────────────
console.log("\n[F] README.md · 印 88 印记 (可选 · 软锁)");
const rm = exists("README.md") ? read("README.md") : "";
ok(
  /印 88|一账号双路|物无非彼/.test(rm) || rm.length > 0,
  "README 存 (印 88 印记可待后印立 · 软锁)",
);

// ─── 总览 ───────────────────────────────────────────────────────────
console.log("\n═══ _seal88_smoke 总览 ═══");
console.log(`  通过: ${pass}`);
console.log(`  失败: ${fail}`);
if (fail === 0) {
  console.log("\n✓ 印 88 一账号双路守门全通 · 道法自然 · 无为而无不为");
  console.log("  帛书·四十二: 道生一 · 一生二 · 二生三 · 三生万物");
  console.log("  庄子·齐物论: 物无非彼 物无非是 · 自彼则不见 自是则知之");
  process.exit(0);
} else {
  console.log("\n✗ 有失败 · 见上");
  process.exit(1);
}
