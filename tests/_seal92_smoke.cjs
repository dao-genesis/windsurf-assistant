#!/usr/bin/env node
/**
 * _seal92_smoke.cjs · 印 92 守门 · 反者道之动 · 万物归焉而弗为主
 * ════════════════════════════════════════════════════════════════════════
 *
 *   帛书·三十四: 「道氾呵, 其可左右也. 成功遂事而弗名有也, 万物归焉而弗为主.」
 *   帛书·四十:   「反也者, 道之动也; 弱也者, 道之用也. 天下之物生于有, 有生于无.」
 *   帛书·七十八: 「天下莫柔弱于水, 而攻坚强者莫之能胜.」
 *
 *   印 92 三件:
 *     ① packages/dao-vm/    — 得鱼忘笙 · 1 ACU 换 24h Ubuntu VM
 *     ② devin_cloud_engine 升 — normalizeMessages + metrics + tools warn + session metrics
 *     ③ _findings/acp/      — ACP 真据真本 (probe + 30+ Devin 模型 UID + handshake jsonl)
 *
 *   0 网络 · 静态 audit + require + 函数级真测 · 全本机
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
let pass = 0;
let fail = 0;

function assert(cond, label) {
  if (cond) {
    console.log(`  ✓ ${label}`);
    pass++;
  } else {
    console.log(`  ✗ ${label}`);
    fail++;
  }
}

function readMaybe(p) {
  try {
    return fs.readFileSync(path.join(ROOT, p), "utf8");
  } catch {
    return null;
  }
}

function exists(p) {
  return fs.existsSync(path.join(ROOT, p));
}

function fileSize(p) {
  try {
    return fs.statSync(path.join(ROOT, p)).size;
  } catch {
    return 0;
  }
}

console.log("═══ _seal92_smoke · 印 92 · 万物归焉而弗为主 ═══\n");

// ════════════════════════════════════════════════════════════════
// [A] packages/dao-vm/ · 8 件齐
// ════════════════════════════════════════════════════════════════
console.log("[A] packages/dao-vm/ · 得鱼忘笙之家立");
const DAOVM = "packages/dao-vm";
const daoVmFiles = [
  ["vm_up.js", 20000, 35000],
  ["vm_status.js", 4000, 8000],
  ["vm_direct.js", 15000, 25000],
  ["vm_tunnel.js", 6000, 12000],
  ["vm_spec.md", 4000, 10000],
  ["vm_limits.md", 4000, 10000],
  ["README.md", 6000, 20000],
  ["package.json", 500, 2000],
];
for (const [name, lo, hi] of daoVmFiles) {
  const p = `${DAOVM}/${name}`;
  const sz = fileSize(p);
  assert(exists(p), `${p} 在`);
  assert(sz >= lo && sz <= hi, `${p} 大小 ${sz} (期望 ${lo}-${hi})`);
}

// ════════════════════════════════════════════════════════════════
// [B] vm_up.js · 真本源核心字
// ════════════════════════════════════════════════════════════════
console.log("\n[B] vm_up.js · 真本源核心字 (得鱼忘笙 · 反 Layer 6)");
const vmUp = readMaybe(`${DAOVM}/vm_up.js`);
assert(vmUp && vmUp.includes("WSS_BASE"), "WSS_BASE 常量");
assert(vmUp && vmUp.includes("wss://app.devin.ai/api/acp/live"), "WSS URL");
assert(vmUp && vmUp.includes("TOKEN_PREFIX"), "TOKEN_PREFIX 常量");
assert(vmUp && vmUp.includes("devin-session-token$"), "Devin token prefix");
assert(vmUp && vmUp.includes("buildPrompt"), "buildPrompt 函");
assert(vmUp && vmUp.includes("===URLS_BEGIN==="), "URLS_BEGIN marker");
assert(vmUp && vmUp.includes("===URLS_END==="), "URLS_END marker");
assert(vmUp && vmUp.includes("parseMarkers"), "parseMarkers 函");
assert(vmUp && vmUp.includes("cloudflared"), "cloudflared 隧道");
assert((vmUp && vmUp.includes("noVNC")) || vmUp.includes("novnc"), "noVNC");
assert((vmUp && vmUp.includes("wetty")) || vmUp.includes("WeTTY"), "WeTTY");
assert(
  (vmUp && vmUp.includes("filebrowser")) || vmUp.includes("Filebrowser"),
  "Filebrowser",
);
assert(vmUp && vmUp.includes("bore.pub"), "bore.pub SSH");
assert(vmUp && vmUp.includes("session/new"), "ACP session/new");
assert(vmUp && vmUp.includes("session/prompt"), "ACP session/prompt");
assert(
  (vmUp && vmUp.includes("set_config_option")) ||
    vmUp.includes("session/set_config_option"),
  "切模型",
);
assert(vmUp && vmUp.includes("devin-2-5"), "默 devin-2-5 (最省)");
assert(vmUp && vmUp.includes("MAX_ATTEMPTS"), "3 次重试 (反 Layer 6)");
assert(
  vmUp && (vmUp.match(/from my laptop|preview link|MacBook/) || []).length > 0,
  "极简自然 prompt 变体",
);
assert(vmUp && vmUp.includes("session/list"), "WS 保活 session/list");
assert(vmUp && vmUp.includes("KEEPALIVE_INTERVAL_MS"), "心跳间隔常量");
assert(
  (vmUp && vmUp.includes("_state/active.json")) || vmUp.includes("active.json"),
  "状态持久化",
);

// ════════════════════════════════════════════════════════════════
// [C] vm_status.js · 持有清单
// ════════════════════════════════════════════════════════════════
console.log("\n[C] vm_status.js · 持有清单 + 活性探测");
const vmSt = readMaybe(`${DAOVM}/vm_status.js`);
assert(vmSt && vmSt.includes("readState"), "readState 函");
assert(vmSt && vmSt.includes("ageMin"), "ageMin 人读时长");
assert(vmSt && vmSt.includes("head"), "HEAD 探测函");
assert(vmSt && vmSt.includes("--check"), "--check 选项");
assert(vmSt && vmSt.includes("--json"), "--json 输出");
assert(vmSt && vmSt.includes("24h TTL"), "24h TTL 提示");
assert(vmSt && vmSt.includes("AbortController"), "AbortController 超时");

// ════════════════════════════════════════════════════════════════
// [D] packages/dao-vm/README.md · 印 92 顶印
// ════════════════════════════════════════════════════════════════
console.log("\n[D] packages/dao-vm/README.md · 印 92 顶印");
const daoVmRd = readMaybe(`${DAOVM}/README.md`);
assert(daoVmRd && daoVmRd.includes("印 92"), "印 92 印在");
assert(daoVmRd && daoVmRd.includes("得鱼忘笙"), "得鱼忘笙");
assert(daoVmRd && daoVmRd.includes("反者道之动"), "反者道之动");
assert(daoVmRd && daoVmRd.includes("万物归焉而弗为主"), "万物归焉而弗为主");
assert(daoVmRd && daoVmRd.includes("1 ACU"), "1 ACU 一笔");
assert(daoVmRd && daoVmRd.includes("24h"), "24h TTL");
assert(daoVmRd && daoVmRd.includes("trycloudflare"), "trycloudflare 公网");
assert(
  daoVmRd && daoVmRd.includes("vm_up.js") && daoVmRd.includes("vm_status.js"),
  "件清单",
);
assert(daoVmRd && daoVmRd.includes("Layer 6"), "Layer 6 应对");
assert(daoVmRd && daoVmRd.includes("五态并立"), "五态并立 (去中心化图)");

// ════════════════════════════════════════════════════════════════
// [E] packages/dao-vm/package.json · 元真
// ════════════════════════════════════════════════════════════════
console.log("\n[E] packages/dao-vm/package.json · 0 deps + bin");
let pkg = null;
try {
  pkg = JSON.parse(readMaybe(`${DAOVM}/package.json`) || "{}");
} catch (e) {
  pkg = null;
}
assert(pkg !== null, "package.json 可 parse");
assert(
  pkg && pkg.name === "@dao/dao-vm",
  `name=@dao/dao-vm (got ${pkg && pkg.name})`,
);
assert(
  pkg && pkg.version && pkg.version.startsWith("0.92"),
  `version 印 92 系 (got ${pkg && pkg.version})`,
);
assert(pkg && pkg.bin && pkg.bin["dao-vm-up"], "bin.dao-vm-up");
assert(pkg && pkg.bin && pkg.bin["dao-vm-status"], "bin.dao-vm-status");
assert(
  pkg && pkg.dependencies && Object.keys(pkg.dependencies).length === 0,
  "0 deps",
);
assert(
  pkg && pkg.engines && pkg.engines.node && pkg.engines.node.includes("22"),
  "engines.node>=22",
);
assert(pkg && pkg._dao && pkg._dao.seal === "印 92", "_dao.seal 印 92");

// ════════════════════════════════════════════════════════════════
// [F] devin_cloud_engine.js 升 · 印 92 新公开
// ════════════════════════════════════════════════════════════════
console.log(
  "\n[F] devin_cloud_engine.js 升 · normalizeMessages + metrics + tools warn",
);
let dce;
try {
  dce = require(path.join(ROOT, "packages/dao-core/devin_cloud_engine.js"));
} catch (e) {
  dce = null;
  console.log("  ✗ require 失:", e.message);
}
assert(dce !== null, "可 require");
assert(
  dce && typeof dce.normalizeMessages === "function",
  "exports normalizeMessages 函",
);
assert(
  dce && typeof dce.checkToolsWarn === "function",
  "exports checkToolsWarn 函",
);
assert(dce && typeof dce.getMetrics === "function", "exports getMetrics 函");
assert(
  dce && typeof dce.sessionMetricsSnapshot === "function",
  "exports sessionMetricsSnapshot 函",
);
assert(
  dce && typeof dce._normalizeContent === "function",
  "exports _normalizeContent (内部测可见)",
);
assert(dce && typeof dce.chat === "function", "原有 exports chat 仍在");
assert(
  dce && typeof dce.healthCheck === "function",
  "原有 exports healthCheck 仍在",
);
assert(dce && typeof dce._buildWssUrl === "function", "原有 _buildWssUrl 仍在");

// ════════════════════════════════════════════════════════════════
// [G] normalizeMessages · 真测多种边角 (反 [object Object])
// ════════════════════════════════════════════════════════════════
if (dce) {
  console.log("\n[G] normalizeMessages 真测 · 防 [object Object]");
  const nm = dce.normalizeMessages;

  // G1: string content (原态)
  let r = nm([{ role: "user", content: "hi" }]);
  assert(r.length === 1 && r[0].content === "hi", "string content 直返");

  // G2: vision array (OpenAI 多模态)
  r = nm([
    {
      role: "user",
      content: [
        { type: "text", text: "describe this" },
        { type: "image_url", image_url: { url: "https://example.com/x.png" } },
      ],
    },
  ]);
  assert(r.length === 1, "vision array 1 件");
  assert(typeof r[0].content === "string", "vision array → string");
  assert(r[0].content.includes("describe this"), "text 部分留存");
  assert(r[0].content.includes("[image:"), "image_url 转 [image: ...]");
  assert(
    !JSON.stringify(r).includes("[object Object]"),
    "vision 无 [object Object] (印 85 续之缺已修)",
  );

  // G3: object content (Anthropic-style)
  r = nm([{ role: "assistant", content: { type: "text", text: "answer" } }]);
  assert(r.length === 1 && r[0].content === "answer", "object content → text");

  // G4: null/undefined content
  r = nm([
    { role: "user", content: null },
    { role: "user", content: undefined },
    { role: "user" },
  ]);
  assert(r.length === 3, "null/undefined content 不丢");
  assert(
    r.every((m) => m.content === ""),
    "null/undefined → 空 string",
  );

  // G5: 无 role 兜底为 user
  r = nm([{ content: "no role" }]);
  assert(r.length === 1 && r[0].role === "user", "缺 role 兜底为 user");

  // G6: input_audio
  r = nm([
    {
      role: "user",
      content: [{ type: "input_audio", audio: { data: "base64..." } }],
    },
  ]);
  assert(r[0].content === "[audio]", "input_audio → [audio]");

  // G7: 非数组输入兜底
  r = nm(null);
  assert(Array.isArray(r) && r.length === 0, "null 输入返 []");
  r = nm("not an array");
  assert(Array.isArray(r) && r.length === 0, "string 输入返 []");

  // ════════════════════════════════════════════════════════════════
  // [H] checkToolsWarn · 4 路 (tools / functions / tool_choice / function_call)
  // ════════════════════════════════════════════════════════════════
  console.log("\n[H] checkToolsWarn · 4 路 tools 检测");
  const ctw = dce.checkToolsWarn;
  assert(
    ctw({ tools: [{ name: "foo" }] }, "openai") === true,
    "tools array 命中",
  );
  assert(
    ctw({ functions: [{ name: "bar" }] }, "openai") === true,
    "functions array 命中",
  );
  assert(
    ctw({ tool_choice: "auto" }, "anthropic") === true,
    "tool_choice 命中",
  );
  assert(ctw({ function_call: "x" }, "gemini") === true, "function_call 命中");
  assert(ctw({}, "openai") === false, "空 body 不命中");
  assert(ctw(null, "openai") === false, "null body 不命中");
  assert(ctw({ tools: "not-array" }, "openai") === false, "tools 非数组不命中");

  // ════════════════════════════════════════════════════════════════
  // [I] getMetrics / sessionMetricsSnapshot · 结构验
  // ════════════════════════════════════════════════════════════════
  console.log("\n[I] getMetrics + sessionMetricsSnapshot 结构验");
  const M = dce.getMetrics();
  assert(typeof M.uptimeSec === "number", "uptimeSec 在");
  assert(
    M.requests && typeof M.requests.total === "number",
    "requests.total 在",
  );
  assert(
    M.requests && typeof M.requests.openai === "number",
    "requests.openai 在",
  );
  assert(
    M.requests && typeof M.requests.anthropic === "number",
    "requests.anthropic 在",
  );
  assert(
    M.requests && typeof M.requests.gemini === "number",
    "requests.gemini 在",
  );
  assert(
    M.successes && typeof M.successes.total === "number",
    "successes.total 在",
  );
  assert(M.errors && typeof M.errors.total === "number", "errors.total 在");
  assert(
    M.toolsHits && typeof M.toolsHits.openai === "number",
    "toolsHits.openai 在",
  );
  assert(M.latency && typeof M.latency.p50Ms === "number", "latency.p50Ms 在");
  assert(M.latency && typeof M.latency.p95Ms === "number", "latency.p95Ms 在");
  assert(M.latency && typeof M.latency.p99Ms === "number", "latency.p99Ms 在");
  assert(M.latency && typeof M.latency.avgMs === "number", "latency.avgMs 在");

  const SM = dce.sessionMetricsSnapshot();
  assert(typeof SM.created === "number", "session.created 在");
  assert(typeof SM.prompted === "number", "session.prompted 在 (★ ACU 消费点)");
  assert(typeof SM.concurrentPeak === "number", "session.concurrentPeak 在");
  assert(Array.isArray(SM.topModels), "session.topModels 数组");
  assert(Array.isArray(SM.topAccounts), "session.topAccounts 数组");

  // checkToolsWarn 之记录效 · 跑 4 笔后 toolsHits 应增 3 (openai 1 / anthropic 1 / gemini 1)
  const M2 = dce.getMetrics();
  assert(
    M2.toolsHits.openai >= 1,
    `toolsHits.openai 增 (now ${M2.toolsHits.openai})`,
  );
  assert(
    M2.toolsHits.anthropic >= 1,
    `toolsHits.anthropic 增 (now ${M2.toolsHits.anthropic})`,
  );
  assert(
    M2.toolsHits.gemini >= 1,
    `toolsHits.gemini 增 (now ${M2.toolsHits.gemini})`,
  );
}

// ════════════════════════════════════════════════════════════════
// [J] _findings/acp/ · ACP 真据真本
// ════════════════════════════════════════════════════════════════
console.log("\n[J] _findings/acp/ · ACP 真据真本 (底层之底层)");
const ACP = "_findings/acp";
const acpFiles = [
  ["04_ACP_protocol_evidence.md", 5000, 15000],
  ["devin_acp_handshake.jsonl", 20000, 50000],
  ["network_evidence.md", 3000, 12000],
  ["devin_models.json", 2000, 8000],
  ["_acp_probe.js", 2000, 5000],
];
for (const [name, lo, hi] of acpFiles) {
  const p = `${ACP}/${name}`;
  const sz = fileSize(p);
  assert(exists(p), `${p} 在`);
  assert(sz >= lo && sz <= hi, `${p} 大小 ${sz} (期望 ${lo}-${hi})`);
}

// ════════════════════════════════════════════════════════════════
// [K] ACP probe 内容真验
// ════════════════════════════════════════════════════════════════
console.log("\n[K] ACP probe 内容真验");
const acpMd = readMaybe(`${ACP}/04_ACP_protocol_evidence.md`);
assert(acpMd && acpMd.includes("agentInfo"), "ACP md 含 agentInfo");
assert(
  (acpMd && acpMd.includes("affogato")) || acpMd.includes("Affogato"),
  "Affogato Agent codename",
);
assert(acpMd && acpMd.includes("chisel_agent"), "chisel_agent crate");
assert(acpMd && acpMd.includes("jsonrpc"), "JSON-RPC 2.0");
assert(acpMd && acpMd.includes("authMethods"), "authMethods 探");
assert(
  acpMd && acpMd.includes("windsurf-api-key"),
  "windsurf-api-key methodId",
);
assert(acpMd && acpMd.includes("session/new"), "session/new 推");
assert(acpMd && acpMd.includes("session/prompt"), "session/prompt 推");

// devin_models.json · 30+ 真模型 UID
let dmJson = null;
try {
  dmJson = JSON.parse(readMaybe(`${ACP}/devin_models.json`) || "{}");
} catch {}
assert(dmJson !== null, "devin_models.json 可 parse");
// 真本源 schema · 模型 UID 在 model_uids_observed_in_bin 数组内
const uids =
  dmJson && Array.isArray(dmJson.model_uids_observed_in_bin)
    ? dmJson.model_uids_observed_in_bin
    : Array.isArray(dmJson)
      ? dmJson
      : [];
assert(uids.length >= 30, `Devin 模型 UID 数 ${uids.length} (期望 ≥30)`);
// 各家代表至少在
assert(
  uids.some((u) => /claude/i.test(u)),
  "含 Claude 系",
);
assert(
  uids.some((u) => /gpt/i.test(u)),
  "含 GPT 系",
);
assert(
  uids.some((u) => /gemini/i.test(u)),
  "含 Gemini 系",
);
assert(
  uids.some((u) => /swe/i.test(u)),
  "含 SWE 系 (Devin 自家)",
);

// handshake jsonl · 多 frames
const hs = readMaybe(`${ACP}/devin_acp_handshake.jsonl`);
const hsLines = hs
  ? hs
      .trim()
      .split("\n")
      .filter((l) => l.trim()).length
  : 0;
assert(hsLines >= 3, `handshake frames ${hsLines} (期望 ≥3)`);

// _acp_probe.js · stdio handshake 探针
const probeJs = readMaybe(`${ACP}/_acp_probe.js`);
assert(
  probeJs && (probeJs.includes("initialize") || probeJs.includes("acp")),
  "probe.js 含 ACP handshake",
);

// ════════════════════════════════════════════════════════════════
// [L] devin_cloud_engine.js · 印 92 段记号 (源头追溯)
// ════════════════════════════════════════════════════════════════
console.log("\n[L] devin_cloud_engine.js · 印 92 段标记");
const dceJs = readMaybe("packages/dao-core/devin_cloud_engine.js");
assert(dceJs && dceJs.includes("§2b"), "§2b metrics 段");
assert(dceJs && dceJs.includes("§2c"), "§2c normalizeMessages 段");
assert(dceJs && dceJs.includes("印 92"), "印 92 印");
assert(
  (dceJs && dceJs.includes("万物归焉而弗为主")) ||
    dceJs.includes("反者道之动") ||
    dceJs.includes("水之胜刚"),
  "帛书句在",
);
assert(dceJs && dceJs.includes("_metrics"), "_metrics 内部对象");
assert(dceJs && dceJs.includes("_sessionMetrics"), "_sessionMetrics 内部对象");
assert(dceJs && dceJs.includes("唯一 ACU 消费点"), "session/prompt ★ ACU 注释");
assert(dceJs && dceJs.includes("metricsRecordReq"), "metricsRecordReq 函");
assert(
  dceJs && dceJs.includes("metricsRecordSuccess"),
  "metricsRecordSuccess 函",
);
assert(dceJs && dceJs.includes("metricsRecordError"), "metricsRecordError 函");
assert(
  dceJs && dceJs.includes("sessionMetricsRecord"),
  "sessionMetricsRecord 函",
);
assert(dceJs && dceJs.includes("opts.proto"), "opts.proto 参数 (多协议识别)");
assert(dceJs && dceJs.includes("accountMasked"), "account mask (脱敏)");

// ════════════════════════════════════════════════════════════════
// 总览
// ════════════════════════════════════════════════════════════════
console.log("\n═══ _seal92_smoke 总览 ═══");
console.log(`  通: ${pass}`);
console.log(`  失: ${fail}`);
if (fail === 0) {
  console.log("\n✓ 印 92 守门全通 · 道氾呵 · 万物归焉而弗为主 · 道法自然");
  console.log("  帛书·三十四: 道氾呵 · 其可左右也 · 万物归焉而弗为主");
  console.log("  帛书·四十:   反者道之动 · 弱者道之用");
  console.log("  帛书·八十一: 圣人无积 · 既以为人己愈有 · 既以予人己愈多");
  process.exit(0);
} else {
  console.log("\n✗ 印 92 守门有败 · 须修");
  process.exit(1);
}
