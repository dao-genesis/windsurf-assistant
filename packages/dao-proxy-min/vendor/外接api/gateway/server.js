#!/usr/bin/env node
"use strict";
/**
 * server.js · 外接api 网关主入口
 * ────────────────────────────────────────────────────────────
 * 万法归宗 · 第三方 API 无感接入 Windsurf
 *
 * 端点 (双协议入口):
 *   POST /v1/messages             — Anthropic 原生格式 (推荐 · Cascade & Claude 系客户端)
 *   POST /v1/chat/completions     — OpenAI 格式 (VSIX / Cline / Continue / Copilot Chat 等)
 *   GET  /v1/models               — 模型目录 (OpenAI 格式)
 *   GET  /health                  — 健康检查 + 能力探测
 *   GET  /__dao/providers         — provider 诊断 (不泄露 apiKey)
 *
 * 模型 ID 标准形态: `<provider>/<model>`
 *   deepseek/deepseek-chat   · moonshot/kimi-k2-0711-preview
 *   qwen/qwen3-max           · zhipu/glm-4.6   · gemini/gemini-2.5-pro
 *   openrouter/anthropic/claude-opus-4.5      (provider 名/模型全名可多级)
 *
 * 零外部依赖 · 仅用 Node.js 内置
 *
 * 启动:
 *   node server.js                     # 默认配置.json · :11435
 *   node server.js --port 11435
 *   node server.js --config 配置.json
 *   node server.js --test              # 自测
 */

const http = require("http");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { URL } = require("url");

const { Registry, loadConfig } = require("./registry");
const T = require("./translate");
const { callAnthropic } = require("./providers/anthropic");
const { callOpenAI, listModels: listOAModels } = require("./providers/openai");
const { callGemini, listModels: listGemModels } = require("./providers/gemini");
const { capabilitiesFor, degradeOpenAIRequest } = require("./capabilities");
const {
  callOllama,
  listModels: listOllamaModels,
} = require("./providers/ollama");

// ── 参数解析 ───────────────────────────────────────────────
const argv = process.argv.slice(2);
function arg(name, def) {
  const i = argv.findIndex(
    (a) => a === `--${name}` || a.startsWith(`--${name}=`),
  );
  if (i < 0) return def;
  const cur = argv[i];
  if (cur.includes("=")) return cur.split("=").slice(1).join("=");
  return argv[i + 1];
}
const CLI_PORT = parseInt(arg("port", "0")) || 0;
const CLI_CONFIG = arg("config", null);
const CLI_LOG = arg("log-level", "info");
const RUN_TEST = argv.includes("--test");

// ── 初始化 ────────────────────────────────────────────────
// 真实磁盘配置路径 (可被 _reload + 写入复用)
//
// 查找顺序 (前者优先):
//   1. CLI: --config <path>
//   2. 环境变量: $DAO_BYOK_CONFIG
//   3. 用户级: ~/.codeium/dao-byok/配置.json     ← 跨 VSIX install 持久
//   4. 用户级: ~/.codeium/dao-byok/config.json
//   5. 仓库 dev: <gateway>/../配置.json
//   6. 仓库 dev: <gateway>/../config.json
//   7. 兜底: <gateway>/../配置.example.json (无 key, 仅默认 provider)
//
// 道法自然: 用户级位置不被 VSIX 升级覆盖, 也不被 .gitignore 屏蔽; 真正一次配置, 处处生效.
function resolveConfigPath(p) {
  if (p && fs.existsSync(p)) return path.resolve(p);
  if (
    process.env.DAO_BYOK_CONFIG &&
    fs.existsSync(process.env.DAO_BYOK_CONFIG)
  ) {
    return path.resolve(process.env.DAO_BYOK_CONFIG);
  }
  const userDir = path.join(os.homedir(), ".codeium", "dao-byok");
  const candidates = [
    path.join(userDir, "配置.json"),
    path.join(userDir, "config.json"),
    path.join(__dirname, "..", "配置.json"),
    path.join(__dirname, "..", "config.json"),
    path.join(__dirname, "..", "配置.example.json"),
  ];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  return path.join(__dirname, "..", "配置.json");
}
const CONFIG_PATH = resolveConfigPath(CLI_CONFIG);
let cfg = loadConfig(CONFIG_PATH);
const gatewayCfg = cfg.gateway || {};
const PORT = CLI_PORT || parseInt(gatewayCfg.port) || 11435;
const HOST = gatewayCfg.host || "127.0.0.1";
const AUTH_KEY = gatewayCfg.authKey || "";
const LOG_LEVEL = CLI_LOG || gatewayCfg.logLevel || "info";

let registry = new Registry(cfg);

// ── 日志环形缓冲 (供 /__dao/logs 与面板使用) ───────────────
const LOG_RING_MAX = 600;
const logRing = [];
function logPush(level, line) {
  logRing.push({ ts: Date.now(), level, line });
  if (logRing.length > LOG_RING_MAX)
    logRing.splice(0, logRing.length - LOG_RING_MAX);
}

function log(level, ...args) {
  const levels = { debug: 0, info: 1, warn: 2, error: 3 };
  const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
  const line = args
    .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
    .join(" ");
  // 始终入环 (即使被级别过滤掉, 至少 info+ 会进; debug 过滤更严)
  if ((levels[level] ?? 1) >= 1) logPush(level, line);
  if (levels[level] < levels[LOG_LEVEL]) return;
  console.log(`[${ts}] [${level.toUpperCase()}]`, line);
}

// ── 身份校验 (可选) ────────────────────────────────────────
function checkAuth(req) {
  if (!AUTH_KEY) return true;
  const hdr = req.headers["authorization"] || "";
  const xapi = req.headers["x-api-key"] || "";
  if (hdr.startsWith("Bearer ")) {
    if (hdr.slice(7).trim() === AUTH_KEY) return true;
  }
  if (xapi && xapi === AUTH_KEY) return true;
  return false;
}

// ── 响应辅助 ───────────────────────────────────────────────
function json(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Access-Control-Allow-Origin": "*",
  });
  res.end(body);
}

function errorBody(status, message, type = "invalid_request_error") {
  return { type: "error", error: { type, message }, _status: status };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function setSSE(res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
    "Access-Control-Allow-Origin": "*",
  });
}

// ══════════════════════════════════════════════════════════
// 核心: 以 Anthropic 格式输入 · 按 driver 路由 · 以 Anthropic 格式输出
// ══════════════════════════════════════════════════════════
async function handleAnthropicMessages(req, res) {
  const raw = await readBody(req);
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return json(res, 400, errorBody(400, "Invalid JSON body"));
  }

  const inModel = body.model || "";
  const target = registry.resolve(inModel);
  if (!target) {
    return json(
      res,
      404,
      errorBody(
        404,
        `Model not found: "${inModel}". Available: ${registry
          .listModels()
          .map((m) => m.id)
          .slice(0, 20)
          .join(", ")}...`,
        "not_found_error",
      ),
    );
  }
  const provider = registry.getProvider(target.provider);
  const stream = !!body.stream;

  log(
    "info",
    `→ ${target.provider}/${target.model}  stream=${stream}  driver=${target.driver}`,
  );

  // 重写 model 到真实 provider 名称
  const sendBody = { ...body, model: target.model };

  try {
    if (target.driver === "anthropic") {
      const upstream = await callAnthropic({
        provider,
        body: sendBody,
        stream,
      });
      return pipeAnthropicUpstream(upstream, res, stream);
    }
    if (target.driver === "openai") {
      let oaReq = T.anthropicReqToOpenAI(sendBody);
      // 按模型能力降级
      const caps = capabilitiesFor(
        target.id || `${target.provider}/${target.model}`,
      );
      if (caps.toolSupport !== "full" || caps.parallelTools === false) {
        oaReq = degradeOpenAIRequest(oaReq, caps);
        log(
          "info",
          `  cap-degrade: ${target.id || target.model} (${caps._reason || caps.toolSupport})`,
        );
      }
      const upstream = await callOpenAI({ provider, body: oaReq, stream });
      return pipeOpenAIUpstream(upstream, res, stream, target.model);
    }
    if (target.driver === "gemini") {
      const gemReq = T.anthropicReqToGemini(sendBody);
      const upstream = await callGemini({
        provider,
        body: gemReq,
        model: target.model,
        stream,
      });
      return pipeGeminiUpstream(upstream, res, stream, target.model);
    }
    if (target.driver === "ollama") {
      const olReq = T.anthropicReqToOllama(sendBody);
      const upstream = await callOllama({ provider, body: olReq, stream });
      return pipeOllamaUpstream(upstream, res, stream, target.model);
    }
    return json(res, 500, errorBody(500, `Unknown driver: ${target.driver}`));
  } catch (e) {
    log("error", `upstream failure: ${e.message}`);
    if (res.headersSent) {
      try {
        res.end();
      } catch {}
      return;
    }
    return json(
      res,
      502,
      errorBody(502, `Upstream error: ${e.message}`, "api_error"),
    );
  }
}

// ── Anthropic upstream 透传 ────────────────────────────────
async function pipeAnthropicUpstream(upstream, res, stream) {
  if (upstream.status >= 400) {
    const text = await upstream.text();
    let err;
    try {
      err = JSON.parse(text);
    } catch {
      err = { error: { message: text } };
    }
    return json(res, upstream.status, err);
  }
  if (stream) {
    setSSE(res);
    upstream.body.on("data", (c) => res.write(c));
    upstream.body.on("end", () => res.end());
    upstream.body.on("error", () => {
      try {
        res.end();
      } catch {}
    });
  } else {
    res.writeHead(upstream.status, {
      "Content-Type": "application/json; charset=utf-8",
    });
    upstream.body.on("data", (c) => res.write(c));
    upstream.body.on("end", () => res.end());
  }
}

// ── OpenAI upstream → Anthropic 输出 ───────────────────────
async function pipeOpenAIUpstream(upstream, res, stream, model) {
  if (upstream.status >= 400) {
    const text = await upstream.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { error: { message: text } };
    }
    return json(res, upstream.status, {
      type: "error",
      error: { type: "api_error", message: parsed.error?.message || text },
    });
  }
  if (!stream) {
    const oaResp = await upstream.json();
    const anth = T.openAIRespToAnthropic(oaResp, model);
    return json(res, 200, anth);
  }
  setSSE(res);
  const conv = new T.OpenAIToAnthropicStream(model);
  const parser = T.createSSEParser((event, data, done) => {
    if (done) return;
    if (!data) return;
    for (const evt of conv.handleOA(data)) res.write(evt);
  });
  upstream.body.on("data", (c) => parser.feed(c));
  upstream.body.on("end", () => {
    parser.flush();
    for (const evt of conv.finalize()) res.write(evt);
    res.end();
  });
  upstream.body.on("error", () => {
    try {
      for (const evt of conv.finalize()) res.write(evt);
    } catch {}
    try {
      res.end();
    } catch {}
  });
}

// ── Gemini upstream → Anthropic 输出 ───────────────────────
async function pipeGeminiUpstream(upstream, res, stream, model) {
  if (upstream.status >= 400) {
    const text = await upstream.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { error: { message: text } };
    }
    return json(res, upstream.status, {
      type: "error",
      error: { type: "api_error", message: parsed.error?.message || text },
    });
  }
  if (!stream) {
    const gr = await upstream.json();
    const anth = T.geminiRespToAnthropic(gr, model);
    return json(res, 200, anth);
  }
  setSSE(res);
  const conv = new T.GeminiToAnthropicStream(model);
  const parser = T.createSSEParser((event, data, done) => {
    if (done || !data) return;
    for (const evt of conv.handleGem(data)) res.write(evt);
  });
  upstream.body.on("data", (c) => parser.feed(c));
  upstream.body.on("end", () => {
    parser.flush();
    for (const evt of conv.finalize()) res.write(evt);
    res.end();
  });
  upstream.body.on("error", () => {
    try {
      for (const evt of conv.finalize()) res.write(evt);
    } catch {}
    try {
      res.end();
    } catch {}
  });
}

// ── Ollama upstream → Anthropic 输出 ───────────────────────
async function pipeOllamaUpstream(upstream, res, stream, model) {
  if (upstream.status >= 400) {
    const text = await upstream.text();
    return json(res, upstream.status, {
      type: "error",
      error: { type: "api_error", message: text },
    });
  }
  if (!stream) {
    const or = await upstream.json();
    const anth = T.ollamaRespToAnthropic(or, model);
    return json(res, 200, anth);
  }
  setSSE(res);
  const conv = new T.OllamaToAnthropicStream(model);
  const parser = T.createNDJSONParser((obj) => {
    for (const evt of conv.handleOllama(obj)) res.write(evt);
  });
  upstream.body.on("data", (c) => parser.feed(c));
  upstream.body.on("end", () => {
    parser.flush();
    for (const evt of conv.finalize()) res.write(evt);
    res.end();
  });
  upstream.body.on("error", () => {
    try {
      for (const evt of conv.finalize()) res.write(evt);
    } catch {}
    try {
      res.end();
    } catch {}
  });
}

// ══════════════════════════════════════════════════════════
// OpenAI 入口 · 接 OpenAI 请求 → 内部转 Anthropic → 处理 → 再转回 OpenAI
// ══════════════════════════════════════════════════════════
async function handleOpenAIChatCompletions(req, res) {
  const raw = await readBody(req);
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return json(res, 400, { error: { message: "Invalid JSON body" } });
  }

  const inModel = body.model || "";
  const target = registry.resolve(inModel);
  if (!target) {
    return json(res, 404, {
      error: { message: `Model not found: "${inModel}"`, type: "not_found" },
    });
  }
  const provider = registry.getProvider(target.provider);
  const stream = !!body.stream;
  log("info", `OpenAI→${target.provider}/${target.model}  stream=${stream}`);

  try {
    // 对 openai-driver 的 provider, 直接透传 (最快路径)
    if (target.driver === "openai") {
      // 按模型能力降级 (phi-4 无 tools / llama-3.3 单 tool 等)
      const caps = capabilitiesFor(
        target.id || `${target.provider}/${target.model}`,
      );
      let sendBody = { ...body, model: target.model };
      if (caps.toolSupport !== "full" || caps.parallelTools === false) {
        sendBody = degradeOpenAIRequest(sendBody, caps);
      }
      const upstream = await callOpenAI({ provider, body: sendBody, stream });
      return pipeOpenAIDirect(upstream, res, stream);
    }

    // 其他 driver · 经由 Anthropic 中间形态转换
    const anthReq = openaiBodyToAnthropic(body);
    anthReq.model = target.model;
    anthReq.stream = stream;

    if (target.driver === "anthropic") {
      const upstream = await callAnthropic({ provider, body: anthReq, stream });
      return pipeAnthToOpenAI(upstream, res, stream, target.model);
    }
    if (target.driver === "gemini") {
      const gemReq = T.anthropicReqToGemini(anthReq);
      const upstream = await callGemini({
        provider,
        body: gemReq,
        model: target.model,
        stream,
      });
      return pipeGemToOpenAI(upstream, res, stream, target.model);
    }
    if (target.driver === "ollama") {
      const olReq = T.anthropicReqToOllama(anthReq);
      const upstream = await callOllama({ provider, body: olReq, stream });
      return pipeOllamaToOpenAI(upstream, res, stream, target.model);
    }
    return json(res, 500, {
      error: { message: `Unknown driver: ${target.driver}` },
    });
  } catch (e) {
    log("error", `upstream failure: ${e.message}`);
    if (res.headersSent) {
      try {
        res.end();
      } catch {}
      return;
    }
    return json(res, 502, {
      error: { message: `Upstream error: ${e.message}`, type: "api_error" },
    });
  }
}

function openaiBodyToAnthropic(body) {
  // 从 OpenAI 格式构造 Anthropic 等价请求 (用于中间形态)
  let system = "";
  const messages = [];
  for (const m of body.messages || []) {
    if (m.role === "system") {
      system +=
        (system ? "\n" : "") +
        (typeof m.content === "string" ? m.content : JSON.stringify(m.content));
      continue;
    }
    if (m.role === "tool") {
      // 将 tool 消息嵌入为上一条 user 的 tool_result
      // Anthropic 要求 tool_result 在 user 消息内
      const toolResult = {
        type: "tool_result",
        tool_use_id: m.tool_call_id,
        content: [
          {
            type: "text",
            text:
              typeof m.content === "string"
                ? m.content
                : JSON.stringify(m.content),
          },
        ],
      };
      messages.push({ role: "user", content: [toolResult] });
      continue;
    }
    const role = m.role === "assistant" ? "assistant" : "user";
    const content = [];
    if (typeof m.content === "string") {
      if (m.content) content.push({ type: "text", text: m.content });
    } else if (Array.isArray(m.content)) {
      for (const p of m.content) {
        if (p.type === "text") content.push({ type: "text", text: p.text });
        else if (p.type === "image_url") {
          const u = p.image_url?.url || "";
          const match = u.match(/^data:([^;]+);base64,(.+)$/);
          if (match) {
            content.push({
              type: "image",
              source: { type: "base64", media_type: match[1], data: match[2] },
            });
          } else {
            content.push({ type: "image", source: { type: "url", url: u } });
          }
        }
      }
    }
    if (Array.isArray(m.tool_calls)) {
      for (const tc of m.tool_calls) {
        let input = {};
        try {
          input = JSON.parse(tc.function?.arguments || "{}");
        } catch {}
        content.push({
          type: "tool_use",
          id: tc.id,
          name: tc.function?.name,
          input,
        });
      }
    }
    if (!content.length) content.push({ type: "text", text: "" });
    messages.push({ role, content });
  }
  const out = {
    messages,
    max_tokens: body.max_tokens || body.max_completion_tokens || 4096,
  };
  if (system) out.system = system;
  if (body.temperature !== undefined) out.temperature = body.temperature;
  if (body.top_p !== undefined) out.top_p = body.top_p;
  if (body.stop)
    out.stop_sequences = Array.isArray(body.stop) ? body.stop : [body.stop];
  if (Array.isArray(body.tools) && body.tools.length) {
    out.tools = body.tools.map((t) => ({
      name: t.function.name,
      description: t.function.description,
      input_schema: t.function.parameters || { type: "object", properties: {} },
    }));
    if (body.tool_choice === "required") out.tool_choice = { type: "any" };
    else if (body.tool_choice === "auto") out.tool_choice = { type: "auto" };
    else if (body.tool_choice?.type === "function")
      out.tool_choice = { type: "tool", name: body.tool_choice.function.name };
  }
  return out;
}

// openai upstream → openai out (透传 · 最快)
async function pipeOpenAIDirect(upstream, res, stream) {
  if (upstream.status >= 400) {
    const text = await upstream.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { error: { message: text } };
    }
    return json(res, upstream.status, parsed);
  }
  if (stream) {
    setSSE(res);
    upstream.body.on("data", (c) => res.write(c));
    upstream.body.on("end", () => res.end());
    upstream.body.on("error", () => {
      try {
        res.end();
      } catch {}
    });
  } else {
    res.writeHead(upstream.status, {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
    });
    upstream.body.on("data", (c) => res.write(c));
    upstream.body.on("end", () => res.end());
  }
}

// anthropic upstream → openai out
async function pipeAnthToOpenAI(upstream, res, stream, model) {
  if (upstream.status >= 400) {
    const text = await upstream.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { error: { message: text } };
    }
    return json(res, upstream.status, {
      error: { message: parsed.error?.message || text },
    });
  }
  if (!stream) {
    const ar = await upstream.json();
    return json(res, 200, T.anthropicRespToOpenAI(ar, model));
  }
  setSSE(res);
  const conv = new T.AnthropicToOpenAIStream(model);
  const parser = T.createSSEParser((event, data, done) => {
    if (done || !data) return;
    for (const chunk of conv.handleAnth(data)) res.write(chunk);
  });
  upstream.body.on("data", (c) => parser.feed(c));
  upstream.body.on("end", () => {
    parser.flush();
    for (const chunk of conv.finalize()) res.write(chunk);
    res.end();
  });
  upstream.body.on("error", () => {
    try {
      res.end();
    } catch {}
  });
}

// gemini upstream → openai out (经 Anthropic 中转)
async function pipeGemToOpenAI(upstream, res, stream, model) {
  if (upstream.status >= 400) {
    const text = await upstream.text();
    return json(res, upstream.status, { error: { message: text } });
  }
  if (!stream) {
    const gr = await upstream.json();
    const ar = T.geminiRespToAnthropic(gr, model);
    return json(res, 200, T.anthropicRespToOpenAI(ar, model));
  }
  setSSE(res);
  const gemConv = new T.GeminiToAnthropicStream(model);
  const oaConv = new T.AnthropicToOpenAIStream(model);
  const parser = T.createSSEParser((event, data, done) => {
    if (done || !data) return;
    for (const anthEvt of gemConv.handleGem(data)) {
      // anthEvt 是 SSE 字符串, 需反解为对象再进 oaConv
      const parsed = parseSSEString(anthEvt);
      if (parsed)
        for (const oaChunk of oaConv.handleAnth(parsed)) res.write(oaChunk);
    }
  });
  upstream.body.on("data", (c) => parser.feed(c));
  upstream.body.on("end", () => {
    parser.flush();
    for (const anthEvt of gemConv.finalize()) {
      const parsed = parseSSEString(anthEvt);
      if (parsed)
        for (const oaChunk of oaConv.handleAnth(parsed)) res.write(oaChunk);
    }
    for (const chunk of oaConv.finalize()) res.write(chunk);
    res.end();
  });
  upstream.body.on("error", () => {
    try {
      res.end();
    } catch {}
  });
}

async function pipeOllamaToOpenAI(upstream, res, stream, model) {
  if (upstream.status >= 400) {
    const text = await upstream.text();
    return json(res, upstream.status, { error: { message: text } });
  }
  if (!stream) {
    const or = await upstream.json();
    const ar = T.ollamaRespToAnthropic(or, model);
    return json(res, 200, T.anthropicRespToOpenAI(ar, model));
  }
  setSSE(res);
  const olConv = new T.OllamaToAnthropicStream(model);
  const oaConv = new T.AnthropicToOpenAIStream(model);
  const parser = T.createNDJSONParser((obj) => {
    for (const anthEvt of olConv.handleOllama(obj)) {
      const parsed = parseSSEString(anthEvt);
      if (parsed)
        for (const oaChunk of oaConv.handleAnth(parsed)) res.write(oaChunk);
    }
  });
  upstream.body.on("data", (c) => parser.feed(c));
  upstream.body.on("end", () => {
    parser.flush();
    for (const anthEvt of olConv.finalize()) {
      const parsed = parseSSEString(anthEvt);
      if (parsed)
        for (const oaChunk of oaConv.handleAnth(parsed)) res.write(oaChunk);
    }
    for (const chunk of oaConv.finalize()) res.write(chunk);
    res.end();
  });
  upstream.body.on("error", () => {
    try {
      res.end();
    } catch {}
  });
}

// 辅助: 从 SSE 字符串反解数据对象
function parseSSEString(sse) {
  const match = sse.match(/data: (\{[\s\S]*?\})\n\n/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

// ══════════════════════════════════════════════════════════
// /v1/models · /health · /__dao/providers
// ══════════════════════════════════════════════════════════
function handleListModels(req, res) {
  const models = registry.listModels();
  const data = models.map((m) => ({
    id: m.id,
    object: "model",
    created: 1700000000,
    owned_by: m.provider,
    root: m.model,
  }));
  return json(res, 200, { object: "list", data });
}

function handleHealth(req, res) {
  return json(res, 200, {
    status: "ok",
    service: "道 · 外接api 网关",
    version: "1.0.0",
    providers: registry.listProviders().map((p) => ({
      name: p.name,
      label: p.label,
      driver: p.driver,
      hasKey: p.hasKey,
      ready: p.ready,
      models: p.models.length,
      baseUrl: p.baseUrl,
    })),
    modelCount: registry.listModels().length,
    endpoints: {
      anthropic: `/v1/messages`,
      openai: `/v1/chat/completions`,
      models: `/v1/models`,
    },
  });
}

function handleProviders(req, res) {
  // 为每个 model 附加能力 (供面板展示"此模型不支持 tools"等)
  const modelsWithCaps = registry.listModels().map((m) => {
    const caps = capabilitiesFor(m.id);
    return {
      ...m,
      capabilities: {
        toolSupport: caps.toolSupport,
        parallelTools: caps.parallelTools,
        systemRole: caps.systemRole,
        note: caps._reason || null,
      },
    };
  });
  return json(res, 200, {
    providers: registry.listProviders(),
    models: modelsWithCaps,
    aliases: Object.fromEntries(registry.aliases),
  });
}

async function handleAutoDiscover(req, res) {
  const out = {};
  for (const p of registry.listProviders()) {
    const prov = registry.getProvider(p.name);
    try {
      let models = [];
      if (p.driver === "openai")
        models = await listOAModels({ provider: prov });
      else if (p.driver === "gemini")
        models = await listGemModels({ provider: prov });
      else if (p.driver === "ollama")
        models = await listOllamaModels({ provider: prov });
      out[p.name] = { ok: true, models };
    } catch (e) {
      out[p.name] = { ok: false, error: e.message };
    }
  }
  return json(res, 200, out);
}

// ══════════════════════════════════════════════════════════
// /__dao/config · /__dao/probe · /__dao/logs · /__dao/diag
// 面板专用 — 让 VSIX webview 完成用户全部需求
// ══════════════════════════════════════════════════════════

// 屏蔽 apiKey · 仅返回前缀+长度
function maskKey(k) {
  if (!k) return "";
  if (typeof k !== "string") return "***";
  if (k.length <= 8) return "*".repeat(k.length);
  return k.slice(0, 4) + "***" + k.slice(-2) + ` (len=${k.length})`;
}

function maskedConfig(c) {
  // 深拷贝 + 屏蔽 apiKey · 不动其它字段
  const out = JSON.parse(JSON.stringify(c || {}));
  if (out.providers) {
    for (const k of Object.keys(out.providers)) {
      const p = out.providers[k];
      if (p && typeof p === "object" && p.apiKey) {
        p._apiKeyMasked = maskKey(p.apiKey);
        p.apiKey = "";
      }
    }
  }
  if (out.gateway && out.gateway.authKey) {
    out.gateway._authKeyMasked = maskKey(out.gateway.authKey);
    out.gateway.authKey = "";
  }
  return out;
}

function handleConfigGet(req, res) {
  const u = new URL(req.url, `http://${req.headers.host}`);
  const reveal = u.searchParams.get("reveal") === "1";
  // reveal 仅在带 authKey 鉴权时允许 (router 已保证此分支需鉴权)
  const data = reveal ? cfg : maskedConfig(cfg);
  return json(res, 200, {
    path: CONFIG_PATH,
    config: data,
    masked: !reveal,
    mtime: fs.existsSync(CONFIG_PATH) ? fs.statSync(CONFIG_PATH).mtimeMs : 0,
  });
}

// 写回磁盘 + 重建 registry · 不丢已有 apiKey (空字符串保留旧值)
async function handleConfigPost(req, res) {
  const raw = await readBody(req);
  let body;
  try {
    body = JSON.parse(raw);
  } catch (e) {
    return json(res, 400, errorBody(400, `Invalid JSON: ${e.message}`));
  }
  const incoming = body.config;
  if (!incoming || typeof incoming !== "object") {
    return json(res, 400, errorBody(400, "Missing config object"));
  }
  // 合并: 若新 apiKey 为空字符串, 保留旧值 (面板默认不回显 apiKey)
  const merged = JSON.parse(JSON.stringify(incoming));
  if (merged.providers && cfg.providers) {
    for (const [name, p] of Object.entries(merged.providers)) {
      if (!p || typeof p !== "object") continue;
      delete p._apiKeyMasked;
      const old = cfg.providers[name];
      if (old && (p.apiKey === "" || p.apiKey === undefined) && old.apiKey) {
        p.apiKey = old.apiKey;
      }
    }
  }
  if (merged.gateway) {
    delete merged.gateway._authKeyMasked;
    if (
      cfg.gateway &&
      (merged.gateway.authKey === "" || merged.gateway.authKey === undefined) &&
      cfg.gateway.authKey
    ) {
      merged.gateway.authKey = cfg.gateway.authKey;
    }
  }
  // 原子写: 先写 .tmp · rename
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      try {
        fs.copyFileSync(CONFIG_PATH, CONFIG_PATH + ".bak");
      } catch {}
    }
    const tmp = CONFIG_PATH + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(merged, null, 2), "utf8");
    fs.renameSync(tmp, CONFIG_PATH);
    cfg = merged;
    registry = new Registry(cfg);
    log(
      "info",
      `配置已更新 · ${registry.listProviders().length} providers · ${registry.listModels().length} models`,
    );
    return json(res, 200, {
      ok: true,
      path: CONFIG_PATH,
      providers: registry.listProviders().length,
      models: registry.listModels().length,
    });
  } catch (e) {
    log("error", `写配置失败: ${e.message}`);
    return json(res, 500, errorBody(500, `写配置失败: ${e.message}`));
  }
}

async function handleConfigReload(req, res) {
  // 先保留旧实例, reload 任一步失败时回滚, 保证 cfg/registry 始终一致.
  // 此修复源于 dev_task_demo · gpt-4.1-mini 的代码审查建议: 防止半更新状态.
  const prevCfg = cfg;
  const prevRegistry = registry;
  let resolvedNow = null;
  try {
    // 每次 reload 都重新解析路径 — 让用户可以在更高优先级位置 (用户级目录)
    // 投放新配置而无需重启网关. 道法自然 · 善建者不拔.
    resolvedNow = resolveConfigPath(CLI_CONFIG);
    const nextCfg = loadConfig(resolvedNow);
    const nextRegistry = new Registry(nextCfg);
    // 全部构造成功才原子替换
    cfg = nextCfg;
    registry = nextRegistry;
    log(
      "info",
      `重载配置 · path=${resolvedNow} · ${registry.listProviders().length} providers · ${registry.listModels().length} models`,
    );
    return json(res, 200, {
      ok: true,
      path: resolvedNow,
      providers: registry.listProviders().length,
      models: registry.listModels().length,
    });
  } catch (e) {
    // 失败回滚: 旧值未受影响, 无需恢复 (因尚未替换)
    cfg = prevCfg;
    registry = prevRegistry;
    log(
      "error",
      `重载失败 · path=${resolvedNow || "(unresolved)"} · err=${e.message} · 已保持旧状态`,
    );
    return json(
      res,
      500,
      errorBody(500, `重载失败: ${e.message} (已回滚到旧配置)`),
    );
  }
}

// /__dao/probe — 单模型探针 · 立即真发请求, 返回首段输出 + 延迟
async function handleProbe(req, res) {
  const raw = await readBody(req);
  let body = {};
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    return json(res, 400, errorBody(400, "Invalid JSON"));
  }
  const modelId = body.model || "";
  const prompt = body.prompt || "回一字: 道";
  const maxTokens = body.max_tokens || 16;
  const target = registry.resolve(modelId);
  if (!target) {
    return json(res, 404, errorBody(404, `Model not found: ${modelId}`));
  }
  const provider = registry.getProvider(target.provider);
  const t0 = Date.now();
  try {
    const sendBody = {
      model: target.model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: maxTokens,
      stream: false,
    };
    let textOut = "";
    let upstreamStatus = 200;
    let usage = null;
    if (target.driver === "openai") {
      const r = await callOpenAI({ provider, body: sendBody, stream: false });
      upstreamStatus = r.status;
      if (r.status >= 400) {
        const text = await r.text();
        return json(res, 200, {
          ok: false,
          model: target.id,
          driver: target.driver,
          ms: Date.now() - t0,
          status: r.status,
          error: text.slice(0, 400),
        });
      }
      const data = await r.json();
      textOut = data?.choices?.[0]?.message?.content || "";
      usage = data?.usage || null;
    } else if (target.driver === "anthropic") {
      const anthReq = {
        messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
        max_tokens: maxTokens,
        model: target.model,
      };
      const r = await callAnthropic({
        provider,
        body: anthReq,
        stream: false,
      });
      upstreamStatus = r.status;
      if (r.status >= 400) {
        const text = await r.text();
        return json(res, 200, {
          ok: false,
          model: target.id,
          driver: target.driver,
          ms: Date.now() - t0,
          status: r.status,
          error: text.slice(0, 400),
        });
      }
      const data = await r.json();
      textOut = (data?.content || [])
        .filter((c) => c.type === "text")
        .map((c) => c.text)
        .join("");
      usage = data?.usage || null;
    } else if (target.driver === "gemini") {
      const gemReq = T.anthropicReqToGemini({
        messages: [{ role: "user", content: prompt }],
        max_tokens: maxTokens,
      });
      const r = await callGemini({
        provider,
        body: gemReq,
        model: target.model,
        stream: false,
      });
      upstreamStatus = r.status;
      if (r.status >= 400) {
        const text = await r.text();
        return json(res, 200, {
          ok: false,
          model: target.id,
          driver: target.driver,
          ms: Date.now() - t0,
          status: r.status,
          error: text.slice(0, 400),
        });
      }
      const data = await r.json();
      const ar = T.geminiRespToAnthropic(data, target.model);
      textOut = (ar.content || [])
        .filter((c) => c.type === "text")
        .map((c) => c.text)
        .join("");
    } else if (target.driver === "ollama") {
      const olReq = T.anthropicReqToOllama({
        messages: [{ role: "user", content: prompt }],
        max_tokens: maxTokens,
        model: target.model,
      });
      const r = await callOllama({ provider, body: olReq, stream: false });
      upstreamStatus = r.status;
      if (r.status >= 400) {
        const text = await r.text();
        return json(res, 200, {
          ok: false,
          model: target.id,
          driver: target.driver,
          ms: Date.now() - t0,
          status: r.status,
          error: text.slice(0, 400),
        });
      }
      const data = await r.json();
      textOut = data?.message?.content || "";
    } else {
      return json(res, 500, errorBody(500, `Unknown driver: ${target.driver}`));
    }
    return json(res, 200, {
      ok: true,
      model: target.id,
      driver: target.driver,
      ms: Date.now() - t0,
      status: upstreamStatus,
      text: textOut.slice(0, 500),
      usage,
    });
  } catch (e) {
    log("warn", `probe ${target.id} 失败: ${e.message}`);
    return json(res, 200, {
      ok: false,
      model: target.id,
      driver: target.driver,
      ms: Date.now() - t0,
      error: e.message,
    });
  }
}

function handleLogs(req, res) {
  const u = new URL(req.url, `http://${req.headers.host}`);
  const n = Math.max(
    1,
    Math.min(LOG_RING_MAX, parseInt(u.searchParams.get("n") || "200")),
  );
  const since = parseInt(u.searchParams.get("since") || "0") || 0;
  const lvl = u.searchParams.get("level") || "";
  let arr = logRing.slice(-n);
  if (since) arr = arr.filter((x) => x.ts > since);
  if (lvl) arr = arr.filter((x) => x.level === lvl);
  return json(res, 200, {
    count: arr.length,
    total: logRing.length,
    items: arr,
    serverTime: Date.now(),
  });
}

async function handleDiag(req, res) {
  const out = {
    ok: true,
    serverTime: Date.now(),
    nodeVersion: process.version,
    pid: process.pid,
    platform: process.platform,
    configPath: CONFIG_PATH,
    configExists: fs.existsSync(CONFIG_PATH),
    listening: { host: HOST, port: PORT },
    auth: AUTH_KEY ? "enabled" : "disabled",
    providers: registry.listProviders(),
    modelCount: registry.listModels().length,
    aliases: Object.fromEntries(registry.aliases),
    cascadeInjection: {
      enabled: !!cfg.cascadeInjection?.enabled,
      modelCount: Array.isArray(cfg.cascadeInjection?.injectModels)
        ? cfg.cascadeInjection.injectModels.length
        : 0,
    },
    logs: { ringSize: logRing.length, max: LOG_RING_MAX },
  };
  return json(res, 200, out);
}

// ══════════════════════════════════════════════════════════
// HTTP 路由
// ══════════════════════════════════════════════════════════
async function router(req, res) {
  // CORS
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "*",
    });
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = url.pathname.replace(/\/+$/, "") || "/";
  log("debug", `${req.method} ${p}`);

  // 公开端点 (面板 + 探针 · 不泄露 apiKey)
  if (p === "/" || p === "/health") return handleHealth(req, res);
  if (p === "/__dao/providers") return handleProviders(req, res);
  if (p === "/__dao/discover") return handleAutoDiscover(req, res);
  if (p === "/__dao/config" && req.method === "GET")
    return handleConfigGet(req, res);
  if (p === "/__dao/logs" && req.method === "GET") return handleLogs(req, res);
  if (p === "/__dao/diag" && req.method === "GET") return handleDiag(req, res);
  if (p === "/v1/models" && req.method === "GET")
    return handleListModels(req, res);

  // 需鉴权的端点
  if (!checkAuth(req)) {
    return json(
      res,
      401,
      errorBody(401, "Missing or invalid API key", "authentication_error"),
    );
  }

  if (p === "/v1/messages" && req.method === "POST")
    return handleAnthropicMessages(req, res);
  if (p === "/v1/chat/completions" && req.method === "POST")
    return handleOpenAIChatCompletions(req, res);
  if (p === "/__dao/config" && req.method === "POST")
    return handleConfigPost(req, res);
  if (p === "/__dao/config/reload" && req.method === "POST")
    return handleConfigReload(req, res);
  if (p === "/__dao/probe" && req.method === "POST")
    return handleProbe(req, res);

  return json(res, 404, errorBody(404, `Not found: ${p}`, "not_found_error"));
}

// ══════════════════════════════════════════════════════════
// 自测
// ══════════════════════════════════════════════════════════
async function runTest() {
  console.log("\n=== 外接api 网关 · 自测 ===\n");
  let pass = 0,
    fail = 0;
  const t = (name, cond) => {
    if (cond) {
      console.log(`  [PASS] ${name}`);
      pass++;
    } else {
      console.log(`  [FAIL] ${name}`);
      fail++;
    }
  };

  // translate.js: anthropic → openai
  const a2o = T.anthropicReqToOpenAI({
    model: "m",
    max_tokens: 100,
    system: "you are helpful",
    messages: [
      { role: "user", content: "hi" },
      {
        role: "assistant",
        content: [
          { type: "text", text: "hello" },
          { type: "tool_use", id: "t1", name: "calc", input: { x: 1 } },
        ],
      },
      {
        role: "user",
        content: [
          { type: "tool_result", tool_use_id: "t1", content: "42" },
          { type: "text", text: "thanks" },
        ],
      },
    ],
    tools: [
      {
        name: "calc",
        description: "calculate",
        input_schema: { type: "object" },
      },
    ],
  });
  t(
    "anthropic→openai: system 抽出",
    a2o.messages[0].role === "system" &&
      a2o.messages[0].content === "you are helpful",
  );
  t("anthropic→openai: user 文本直通", a2o.messages[1].content === "hi");
  t(
    "anthropic→openai: assistant 带 tool_calls",
    a2o.messages[2].role === "assistant" &&
      a2o.messages[2].tool_calls?.length === 1 &&
      a2o.messages[2].tool_calls[0].function.name === "calc",
  );
  t(
    "anthropic→openai: tool_result → tool msg",
    a2o.messages[3].role === "tool" &&
      a2o.messages[3].tool_call_id === "t1" &&
      a2o.messages[3].content === "42",
  );
  t(
    "anthropic→openai: tools 翻译",
    a2o.tools?.length === 1 && a2o.tools[0].function.name === "calc",
  );

  // openai → anthropic 响应
  const oa2a = T.openAIRespToAnthropic(
    {
      id: "x",
      model: "m",
      choices: [
        {
          index: 0,
          finish_reason: "stop",
          message: { role: "assistant", content: "hello world" },
        },
      ],
      usage: { prompt_tokens: 5, completion_tokens: 2 },
    },
    "m",
  );
  t(
    "openai→anthropic resp: text block",
    oa2a.content[0].type === "text" && oa2a.content[0].text === "hello world",
  );
  t(
    "openai→anthropic resp: usage",
    oa2a.usage.input_tokens === 5 && oa2a.usage.output_tokens === 2,
  );
  t("openai→anthropic resp: stop_reason", oa2a.stop_reason === "end_turn");

  // openai SSE → anthropic SSE (状态机)
  const stream = new T.OpenAIToAnthropicStream("m");
  const events = [];
  for (const e of stream.handleOA({ choices: [{ delta: { content: "Hel" } }] }))
    events.push(e);
  for (const e of stream.handleOA({ choices: [{ delta: { content: "lo" } }] }))
    events.push(e);
  for (const e of stream.handleOA({
    choices: [{ delta: {}, finish_reason: "stop" }],
  }))
    events.push(e);
  for (const e of stream.finalize()) events.push(e);
  const joined = events.join("");
  t("openai→anthropic SSE: message_start", joined.includes("message_start"));
  t(
    "openai→anthropic SSE: content_block_start text",
    joined.includes('"type":"text"'),
  );
  t("openai→anthropic SSE: text_delta Hel", joined.includes('"text":"Hel"'));
  t("openai→anthropic SSE: message_stop", joined.includes("message_stop"));

  // Gemini 请求翻译
  const g = T.anthropicReqToGemini({
    model: "m",
    max_tokens: 100,
    system: "sys",
    messages: [{ role: "user", content: "hi" }],
  });
  t(
    "anthropic→gemini: systemInstruction",
    g.systemInstruction?.parts[0]?.text === "sys",
  );
  t(
    "anthropic→gemini: contents user",
    g.contents[0].role === "user" && g.contents[0].parts[0].text === "hi",
  );
  t(
    "anthropic→gemini: generationConfig",
    g.generationConfig?.maxOutputTokens === 100,
  );

  // Ollama 请求翻译
  const ol = T.anthropicReqToOllama({
    model: "llama3",
    max_tokens: 100,
    temperature: 0.7,
    system: "sys",
    messages: [{ role: "user", content: "hi" }],
  });
  t(
    "anthropic→ollama: 消息",
    ol.messages[0].role === "system" && ol.messages[1].content === "hi",
  );
  t("anthropic→ollama: options.num_predict", ol.options?.num_predict === 100);

  // Registry
  const r = new Registry({
    providers: {
      deepseek: { enabled: true, apiKey: "x", models: ["deepseek-chat"] },
      openrouter: {
        enabled: true,
        apiKey: "y",
        models: ["anthropic/claude-opus-4.5"],
      },
      gemini: { enabled: true, apiKey: "z", models: ["gemini-2.5-pro"] },
      ollama: { enabled: true, models: [] },
    },
    aliases: { "my-fast": "deepseek/deepseek-chat" },
  });
  t(
    "Registry: 严格解析",
    r.resolve("deepseek/deepseek-chat")?.provider === "deepseek",
  );
  t(
    "Registry: 裸名解析",
    r.resolve("deepseek-chat")?.model === "deepseek-chat",
  );
  t("Registry: alias 解析", r.resolve("my-fast")?.model === "deepseek-chat");
  t("Registry: 前缀启发", r.resolve("gemini-2.5-pro")?.provider === "gemini");
  t(
    "Registry: openrouter 多级",
    r.resolve("openrouter/anthropic/claude-opus-4.5")?.model ===
      "anthropic/claude-opus-4.5",
  );

  // 反向: Anthropic → OpenAI SSE
  const back = new T.AnthropicToOpenAIStream("m");
  const backEvents = [];
  for (const e of back.handleAnth({
    type: "content_block_start",
    index: 0,
    content_block: { type: "text", text: "" },
  }))
    backEvents.push(e);
  for (const e of back.handleAnth({
    type: "content_block_delta",
    index: 0,
    delta: { type: "text_delta", text: "hey" },
  }))
    backEvents.push(e);
  for (const e of back.handleAnth({
    type: "message_delta",
    delta: { stop_reason: "end_turn" },
  }))
    backEvents.push(e);
  for (const e of back.finalize()) backEvents.push(e);
  t(
    "anthropic→openai SSE: content delta hey",
    backEvents.join("").includes('"content":"hey"'),
  );
  t("anthropic→openai SSE: [DONE]", backEvents.join("").includes("[DONE]"));

  // ── OpenAI driver: 模型感知规整 (o-series / gpt-5) ──
  const { isReasoningModel, normalizeForModel } = require("./providers/openai");
  t("isReasoningModel(gpt-4)", !isReasoningModel("gpt-4"));
  t("isReasoningModel(gpt-4o-mini)", !isReasoningModel("gpt-4o-mini"));
  t("isReasoningModel(o4-mini)", isReasoningModel("o4-mini"));
  t(
    "isReasoningModel(github/openai/o4-mini)",
    isReasoningModel("github/openai/o4-mini"),
  );
  t("isReasoningModel(gpt-5)", isReasoningModel("gpt-5"));
  t("isReasoningModel(gpt-5-mini)", isReasoningModel("gpt-5-mini"));
  t("isReasoningModel(o1-preview)", isReasoningModel("o1-preview"));

  const norm1 = normalizeForModel({
    model: "github/openai/gpt-5-mini",
    max_tokens: 256,
    temperature: 0.7,
    top_p: 0.9,
    messages: [
      { role: "system", content: "you are helpful" },
      { role: "user", content: "hi" },
    ],
  });
  t("normalize gpt-5-mini: max_tokens deleted", norm1.max_tokens === undefined);
  t(
    "normalize gpt-5-mini: max_completion_tokens=256",
    norm1.max_completion_tokens === 256,
  );
  t(
    "normalize gpt-5-mini: temperature deleted",
    norm1.temperature === undefined,
  );
  t("normalize gpt-5-mini: top_p deleted", norm1.top_p === undefined);
  t(
    "normalize gpt-5-mini: system → developer role",
    norm1.messages[0].role === "developer",
  );

  const norm2 = normalizeForModel({
    model: "gpt-4o",
    max_tokens: 256,
    temperature: 0.7,
    messages: [
      { role: "system", content: "x" },
      { role: "user", content: "hi" },
    ],
  });
  t("normalize gpt-4o: max_tokens preserved", norm2.max_tokens === 256);
  t("normalize gpt-4o: temperature preserved", norm2.temperature === 0.7);
  t(
    "normalize gpt-4o: system role preserved",
    norm2.messages[0].role === "system",
  );

  // ── http.js: Retry-After 解析 ──
  const { parseRetryAfter, request: httpReq } = require("./providers/http");
  t("parseRetryAfter(5)", parseRetryAfter("5") === 5000);
  t("parseRetryAfter(0)", parseRetryAfter("0") === 0);
  t("parseRetryAfter(undefined)", parseRetryAfter(undefined) === 0);
  t("parseRetryAfter caps at 30s", parseRetryAfter("9999") === 30000);

  // ── http.js: 429 → 200 透明重试 (起个临时 http 服务, 前 2 次回 429, 第 3 次回 200) ──
  await new Promise((resolve) => {
    let hit = 0;
    const srv = require("http").createServer((req, res) => {
      hit++;
      if (hit <= 2) {
        res.writeHead(429, {
          "Content-Type": "application/json",
          "Retry-After": "0",
        });
        res.end(JSON.stringify({ error: "rate limited" }));
      } else {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, attempt: hit }));
      }
    });
    srv.listen(0, "127.0.0.1", async () => {
      const port = srv.address().port;
      const resp = await httpReq({
        url: `http://127.0.0.1:${port}/`,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
        backoffBaseMs: 1,
      });
      t("http retry: final status 200", resp.status === 200);
      const j = await resp.json();
      t("http retry: 3 attempts (2x429 + 1x200)", j.attempt === 3 && hit === 3);
      srv.close();
      resolve();
    });
  });

  // ── capabilities.js: 已知模型限制 ──
  const { capabilitiesFor, degradeOpenAIRequest } = require("./capabilities");
  t(
    "capabilitiesFor(github/microsoft/phi-4): toolSupport=none",
    capabilitiesFor("github/microsoft/phi-4").toolSupport === "none",
  );
  t(
    "capabilitiesFor(github/meta/llama-3.3-70b-instruct): toolSupport=single",
    capabilitiesFor("github/meta/llama-3.3-70b-instruct").toolSupport ===
      "single",
  );
  t(
    "capabilitiesFor(ollama/qwen2.5:0.5b): toolSupport=none",
    capabilitiesFor("ollama/qwen2.5:0.5b").toolSupport === "none",
  );
  t(
    "capabilitiesFor(github/openai/gpt-4.1-mini): full",
    capabilitiesFor("github/openai/gpt-4.1-mini").toolSupport === "full",
  );
  t(
    "capabilitiesFor(github/deepseek/deepseek-r1-0528): toolSupport=none",
    capabilitiesFor("github/deepseek/deepseek-r1-0528").toolSupport === "none",
  );

  // 降级器: toolSupport=none → tools 字段被移除, system 追加提示
  const deg1 = degradeOpenAIRequest(
    {
      model: "github/microsoft/phi-4",
      messages: [
        { role: "system", content: "hi" },
        { role: "user", content: "q" },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "get_weather",
            description: "gets weather",
            parameters: {
              type: "object",
              properties: { city: { type: "string" } },
            },
          },
        },
      ],
      tool_choice: "auto",
    },
    { toolSupport: "none", parallelTools: true, systemRole: true },
  );
  t("degrade(none): tools removed", deg1.tools === undefined);
  t("degrade(none): tool_choice removed", deg1.tool_choice === undefined);
  t(
    "degrade(none): system annotated with tool descriptions",
    /get_weather/.test(deg1.messages[0].content) &&
      /System note/i.test(deg1.messages[0].content),
  );

  // 降级器: single → 保留 1 tool, 其余折叠
  const deg2 = degradeOpenAIRequest(
    {
      model: "github/meta/llama-3.3-70b-instruct",
      messages: [
        { role: "system", content: "sys" },
        { role: "user", content: "q" },
      ],
      tools: [
        { type: "function", function: { name: "read_file", description: "r" } },
        { type: "function", function: { name: "edit_file", description: "e" } },
      ],
    },
    { toolSupport: "single", parallelTools: true, systemRole: true },
  );
  t("degrade(single): keeps only 1 tool", deg2.tools.length === 1);
  t(
    "degrade(single): kept first tool name",
    deg2.tools[0].function.name === "read_file",
  );
  t(
    "degrade(single): system mentions dropped tool",
    /edit_file/.test(deg2.messages[0].content),
  );

  // full capabilities · 不变
  const deg3 = degradeOpenAIRequest(
    {
      model: "github/openai/gpt-4.1-mini",
      messages: [{ role: "user", content: "q" }],
      tools: [{ type: "function", function: { name: "f", description: "d" } }],
    },
    { toolSupport: "full", parallelTools: true, systemRole: true },
  );
  t("degrade(full): tools preserved", deg3.tools.length === 1);

  // ── http.js: noRetry 下 429 立即返回 ──
  await new Promise((resolve) => {
    let hit = 0;
    const srv = require("http").createServer((req, res) => {
      hit++;
      res.writeHead(429, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "rl" }));
    });
    srv.listen(0, "127.0.0.1", async () => {
      const port = srv.address().port;
      const resp = await httpReq({
        url: `http://127.0.0.1:${port}/`,
        method: "POST",
        body: "{}",
        noRetry: true,
      });
      t("http noRetry: immediate 429", resp.status === 429 && hit === 1);
      srv.close();
      resolve();
    });
  });

  console.log(`\n${pass} passed · ${fail} failed\n`);
  process.exit(fail === 0 ? 0 : 1);
}

// ══════════════════════════════════════════════════════════
// 启动
// ══════════════════════════════════════════════════════════
if (RUN_TEST) {
  runTest().catch((e) => {
    console.error(e);
    process.exit(1);
  });
} else {
  const server = http.createServer(async (req, res) => {
    try {
      await router(req, res);
    } catch (e) {
      log("error", `unhandled: ${e.message}`);
      if (!res.headersSent) {
        json(
          res,
          500,
          errorBody(500, `Internal: ${e.message}`, "internal_error"),
        );
      } else {
        try {
          res.end();
        } catch {}
      }
    }
  });
  server.listen(PORT, HOST, () => {
    const providers = registry.listProviders();
    const models = registry.listModels();
    console.log();
    console.log("╔════════════════════════════════════════════════════════╗");
    console.log("║  外接api 网关 · 第三方 API 无感接入 Windsurf         ║");
    console.log("║  道法自然 · 万法归宗                                   ║");
    console.log("╚════════════════════════════════════════════════════════╝");
    console.log();
    console.log(`  监听:      http://${HOST}:${PORT}`);
    console.log(`  Anthropic: http://${HOST}:${PORT}/v1/messages`);
    console.log(`  OpenAI:    http://${HOST}:${PORT}/v1/chat/completions`);
    console.log(`  模型目录:  http://${HOST}:${PORT}/v1/models`);
    console.log(`  健康探测:  http://${HOST}:${PORT}/health`);
    console.log(
      `  鉴权:      ${AUTH_KEY ? "Bearer " + AUTH_KEY.slice(0, 4) + "***" : "(未启用)"}`,
    );
    console.log();
    console.log(`  ${providers.length} providers · ${models.length} models`);
    for (const p of providers) {
      const tag = p.hasKey ? "✓ key" : p.ready ? "(本地·无需 key)" : "✗ no key";
      console.log(
        `    · ${p.name.padEnd(16)} [${p.driver}]  ${p.models.length} models  ${tag}`,
      );
    }
    console.log();
  });
  server.on("error", (e) => {
    console.error("[FATAL]", e.message);
    process.exit(1);
  });
  process.on("SIGINT", () => {
    console.log("\n[STOP]");
    server.close(() => process.exit(0));
  });
}
