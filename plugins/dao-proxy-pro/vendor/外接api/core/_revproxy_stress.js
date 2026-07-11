#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// _revproxy_stress.js · 反代免费模型长程压测台 (实践审视本源)
//
// 道义: 反者道之动 —— 以长时间、复杂、并发的真实调用反向揭露本源异常。
// 专抓用户反馈的三类病灶:
//   1) 对话中途中断 (stream 首帧后断流 / finish_reason 缺失 / 内容被截)
//   2) 初始化/首帧提交失败 (init: 连接建立或首字节迟迟不到 / HTTP 非 200)
//   3) 工具调用失败 (tool_calls 请求返回空 / 报错 / 退化为纯文本)
// 另含一条回归护栏: 旧解码 bug 的"乱码签名"(混入 x-request-id / 响应统计标签)。
//
// 用法:
//   REVPROXY_BASE=http://localhost:9920 \
//   REVPROXY_TOKEN=dao-vsix-xxxx \
//   STRESS_DURATION_MS=300000 STRESS_CONCURRENCY=5 \
//   node _revproxy_stress.js
//
// 输出: 结构化 JSONL → STRESS_OUT (默认 /tmp/revproxy-stress-<ts>.jsonl)
//       + 收尾汇总 (按异常类型计数 + 模型维度)。
// ─────────────────────────────────────────────────────────────────────────────
"use strict";
const http = require("http");
const https = require("https");
const fs = require("fs");
const { URL } = require("url");

const BASE = process.env.REVPROXY_BASE || "http://localhost:9920";
const TOKEN = process.env.REVPROXY_TOKEN || "";
const DURATION_MS = parseInt(process.env.STRESS_DURATION_MS || "120000", 10);
const CONCURRENCY = parseInt(process.env.STRESS_CONCURRENCY || "4", 10);
const REQ_TIMEOUT_MS = parseInt(process.env.STRESS_REQ_TIMEOUT_MS || "120000", 10);
const MODELS = (process.env.STRESS_MODELS || "glm-5-2,kimi-k2-7,swe-1-6").split(",").map((s) => s.trim()).filter(Boolean);
const OUT = process.env.STRESS_OUT || `/tmp/revproxy-stress-${Date.now()}.jsonl`;

const out = fs.createWriteStream(OUT, { flags: "a" });
function logRec(rec) {
  out.write(JSON.stringify(rec) + "\n");
}

// ── 乱码签名: 旧解码 bug 会把这些元数据/统计串混进 content ──
const GARBLE_SIGNS = [
  /chatcmpl-[0-9a-f]{8,}chatcmpl-/i, // 重复 id
  /Response Statistics/i,
  /Token Usage/i,
  /output_tokens/i,
  /cached_input_tokens/i,
  /x-request-id/i,
];
function detectGarble(text) {
  if (!text) return null;
  for (const re of GARBLE_SIGNS) if (re.test(text)) return re.source;
  return null;
}

// ── 复杂请求生成器 ──
const LONG_CTX = "本源认知: dao-vsix 是主体, dao-one 是三合一. ".repeat(60); // ~3KB 中文长上下文
function buildBody(model, kind, turn) {
  const tag = `${kind}-${turn}-${Math.random().toString(36).slice(2, 8)}`;
  if (kind === "longctx") {
    return {
      model,
      messages: [
        { role: "system", content: LONG_CTX },
        { role: "user", content: `基于以上长上下文, 仅回复这串校验码: ${tag}` },
      ],
      max_tokens: 128,
      stream: turn % 2 === 0,
      _expect: tag,
    };
  }
  if (kind === "multiturn") {
    const msgs = [{ role: "system", content: "你是回声助手, 严格只回复用户要求的字符串。" }];
    for (let i = 0; i < 6; i++) {
      msgs.push({ role: "user", content: `Reply with exactly: TURN-${i}-${tag}` });
      msgs.push({ role: "assistant", content: `TURN-${i}-${tag}` });
    }
    msgs.push({ role: "user", content: `Reply with exactly: FINAL-${tag}` });
    return { model, messages: msgs, max_tokens: 128, stream: turn % 2 === 1, _expect: `FINAL-${tag}` };
  }
  if (kind === "toolcall") {
    return {
      model,
      messages: [
        { role: "user", content: `What is the weather in Tokyo? Use the get_weather tool. (tag ${tag})` },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "get_weather",
            description: "Get current weather for a city",
            parameters: {
              type: "object",
              properties: { city: { type: "string" } },
              required: ["city"],
            },
          },
        },
      ],
      tool_choice: "auto",
      max_tokens: 128,
      stream: false,
      _kind: "toolcall",
    };
  }
  // default: short echo
  return {
    model,
    messages: [{ role: "user", content: `Reply with exactly: ${tag}` }],
    max_tokens: 64,
    stream: turn % 2 === 0,
    _expect: tag,
  };
}

function postChat(body) {
  return new Promise((resolve) => {
    const u = new URL(BASE + "/v1/chat/completions");
    const lib = u.protocol === "https:" ? https : http;
    const payload = Buffer.from(JSON.stringify(body));
    const t0 = Date.now();
    let firstByteAt = 0;
    let chunkCount = 0;
    let raw = "";
    const req = lib.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + TOKEN,
          "Content-Length": payload.length,
        },
      },
      (res) => {
        res.on("data", (d) => {
          if (!firstByteAt) firstByteAt = Date.now();
          chunkCount++;
          raw += d.toString("utf8");
        });
        res.on("end", () => {
          resolve({
            status: res.statusCode,
            ttfb: firstByteAt ? firstByteAt - t0 : -1,
            latency: Date.now() - t0,
            chunkCount,
            raw,
          });
        });
      },
    );
    req.on("error", (e) => resolve({ status: 0, latency: Date.now() - t0, ttfb: -1, chunkCount, raw, error: e.message }));
    req.setTimeout(REQ_TIMEOUT_MS, () => {
      req.destroy();
      resolve({ status: 0, latency: Date.now() - t0, ttfb: firstByteAt ? firstByteAt - t0 : -1, chunkCount, raw, error: "timeout" });
    });
    req.write(payload);
    req.end();
  });
}

// 解析回包(非流/流)成 {content, finishReason, toolCalls}
function parseResp(body, raw) {
  let content = "";
  let finishReason = null;
  let toolCalls = null;
  if (body.stream) {
    for (const line of raw.split("\n")) {
      const s = line.trim();
      if (!s.startsWith("data:")) continue;
      const j = s.slice(5).trim();
      if (j === "[DONE]") continue;
      try {
        const o = JSON.parse(j);
        const d = o.choices && o.choices[0] && o.choices[0].delta;
        if (d && d.content) content += d.content;
        if (d && d.tool_calls) toolCalls = (toolCalls || []).concat(d.tool_calls);
        const fr = o.choices && o.choices[0] && o.choices[0].finish_reason;
        if (fr) finishReason = fr;
      } catch (_) {}
    }
  } else {
    try {
      const o = JSON.parse(raw);
      const m = o.choices && o.choices[0] && o.choices[0].message;
      if (m && m.content) content = m.content;
      if (m && m.tool_calls) toolCalls = m.tool_calls;
      finishReason = o.choices && o.choices[0] && o.choices[0].finish_reason;
    } catch (_) {}
  }
  return { content, finishReason, toolCalls };
}

const stats = {
  total: 0,
  ok: 0,
  anomalies: {},
  byModel: {},
};
function bump(obj, k) {
  obj[k] = (obj[k] || 0) + 1;
}

function classify(body, r) {
  const anomalies = [];
  if (r.error === "timeout") anomalies.push("timeout");
  else if (r.status === 0) anomalies.push("conn_error");
  else if (r.status !== 200) anomalies.push("http_" + r.status);

  if (r.status === 200) {
    const { content, finishReason, toolCalls } = parseResp(body, r.raw);
    // init failure: 200 但首字节极慢(>30s)或流模式 0 chunk
    if (body.stream && r.chunkCount === 0) anomalies.push("init_no_chunk");
    // tool-call 期望
    if (body._kind === "toolcall") {
      if (!toolCalls || !toolCalls.length) anomalies.push("toolcall_missing");
    } else {
      // 文本期望
      const g = detectGarble(content);
      if (g) anomalies.push("garble");
      if (!content || !content.trim()) anomalies.push("empty_content");
      else {
        // 中断: 非流给了内容但 finish_reason 缺失; 或期望串未出现(被截)
        if (!body.stream && !finishReason) anomalies.push("no_finish_reason");
        if (body._expect && !content.includes(body._expect)) anomalies.push("expect_mismatch");
      }
    }
    return { anomalies, content: content.slice(0, 120), finishReason, hasTool: !!(toolCalls && toolCalls.length) };
  }
  return { anomalies, content: (r.raw || "").slice(0, 200) };
}

const KINDS = ["short", "longctx", "multiturn", "toolcall"];
let turn = 0;
async function worker(id) {
  const deadline = Date.now() + DURATION_MS;
  while (Date.now() < deadline) {
    const model = MODELS[turn % MODELS.length];
    const kind = KINDS[turn % KINDS.length];
    const myturn = turn++;
    const body = buildBody(model, kind, myturn);
    const r = await postChat(body);
    const c = classify(body, r);
    stats.total++;
    stats.byModel[model] = stats.byModel[model] || { total: 0, anomaly: 0 };
    stats.byModel[model].total++;
    if (c.anomalies.length) {
      stats.byModel[model].anomaly++;
      for (const a of c.anomalies) bump(stats.anomalies, a);
    } else stats.ok++;
    logRec({
      ts: new Date().toISOString(),
      worker: id,
      turn: myturn,
      model,
      kind,
      stream: !!body.stream,
      status: r.status,
      ttfb_ms: r.ttfb,
      latency_ms: r.latency,
      chunks: r.chunkCount,
      anomalies: c.anomalies,
      finish_reason: c.finishReason || null,
      has_tool: c.hasTool || false,
      sample: c.content || null,
      error: r.error || null,
    });
    if (stats.total % 20 === 0) {
      process.stdout.write(
        `\r[${new Date().toISOString().slice(11, 19)}] total=${stats.total} ok=${stats.ok} anomalies=${JSON.stringify(stats.anomalies)}   `,
      );
    }
    // 变长间隔(模拟真实调度): 0 / 0.5s / 2s 轮转
    const gap = [0, 500, 2000][myturn % 3];
    if (gap) await new Promise((res) => setTimeout(res, gap));
  }
}

(async () => {
  console.log(`[stress] BASE=${BASE} models=${MODELS.join(",")} conc=${CONCURRENCY} dur=${DURATION_MS}ms out=${OUT}`);
  const workers = [];
  for (let i = 0; i < CONCURRENCY; i++) workers.push(worker(i));
  await Promise.all(workers);
  out.end();
  console.log("\n──────── STRESS SUMMARY ────────");
  console.log("total:", stats.total, "ok:", stats.ok, "anomaly_rate:", ((1 - stats.ok / stats.total) * 100).toFixed(2) + "%");
  console.log("anomalies by type:", JSON.stringify(stats.anomalies, null, 2));
  console.log("by model:", JSON.stringify(stats.byModel, null, 2));
  console.log("jsonl:", OUT);
})();
