"use strict";
/**
 * openai.js · OpenAI /v1/chat/completions 驱动
 * ─────────────────────────────────────────────
 * 覆盖: OpenAI / DeepSeek / Moonshot (Kimi) / DashScope (Qwen) / 智谱 (GLM) /
 *       OpenRouter / SiliconFlow / Groq / Mistral / LM Studio / vLLM / 任意 OpenAI-compat 端点
 *
 * 含模型感知的请求规整:
 *   · o1/o3/o4 + gpt-5 系列:  max_tokens → max_completion_tokens · 移除 temperature
 *   · 道法自然: 不让上层任何客户端关心模型代差, 网关替它操心.
 */

const { request } = require("./http");

// 哪些 model id 走 reasoning (新型) 端点契约
function isReasoningModel(modelId) {
  if (!modelId) return false;
  const id = String(modelId).toLowerCase();
  // 兼容 github/openai/o4-mini 这种带 vendor 前缀的形式
  const tail = id.split("/").pop();
  return /^(o1|o3|o4|gpt-5)([\-:].*)?$/.test(tail);
}

// 在请求出门前最后一次"裁衣": 按 model 修参数
function normalizeForModel(body) {
  const out = { ...body };
  if (isReasoningModel(out.model)) {
    // OpenAI o-series / gpt-5: max_tokens 已弃用, 必须 max_completion_tokens
    if (
      out.max_tokens !== undefined &&
      out.max_completion_tokens === undefined
    ) {
      out.max_completion_tokens = out.max_tokens;
    }
    delete out.max_tokens;
    // o-series 不再支持自定义 temperature/top_p 等采样参数 (上游会回 400)
    delete out.temperature;
    delete out.top_p;
    delete out.presence_penalty;
    delete out.frequency_penalty;
    // o-series 也不接受 system role · 必须并入 user (上层若已发, 这里转译)
    if (Array.isArray(out.messages)) {
      out.messages = out.messages.map((m) => {
        if (m.role === "system") {
          // 转成 developer role (新版 OpenAI 推荐) 或干脆并入第一条 user
          return { ...m, role: "developer" };
        }
        return m;
      });
    }
  }
  return out;
}

async function callOpenAI({ provider, body, stream, signal }) {
  // 使 baseUrl 既支持 .../v1 又支持 ... (不带 /v1)
  const base = provider.baseUrl.replace(/\/+$/, "");
  const path =
    base.endsWith("/v1") || base.endsWith("/openai")
      ? "/chat/completions"
      : "/v1/chat/completions";
  const url = `${base}${path}`;
  const headers = {
    "Content-Type": "application/json",
    Accept: stream ? "text/event-stream" : "application/json",
  };
  if (provider.apiKey) headers["Authorization"] = `Bearer ${provider.apiKey}`;
  // OpenRouter 需要 HTTP-Referer + X-Title
  if (provider.name === "openrouter") {
    headers["HTTP-Referer"] =
      provider.extra?.httpReferer || "https://windsurf.ai/dao-byok";
    headers["X-Title"] = provider.extra?.xTitle || "Dao BYOK Gateway";
  }
  // GitHub Models · 走 OpenAI 协议但接 https://models.github.ai/inference
  // 标准 Bearer 即可, 已由上方处理.
  // Groq · Mistral · 标准 Bearer 即可

  // 出门前按模型裁衣
  const finalBody = normalizeForModel(body);

  const payload = JSON.stringify(finalBody);
  return request({
    url,
    method: "POST",
    headers,
    body: payload,
    signal,
    timeout: 600000,
  });
}

// 可选的 /v1/models 查询 (用于 "auto" 模型列表发现)
async function listModels({ provider, signal }) {
  const base = provider.baseUrl.replace(/\/+$/, "");
  const path =
    base.endsWith("/v1") || base.endsWith("/openai") ? "/models" : "/v1/models";
  const headers = { Accept: "application/json" };
  if (provider.apiKey) headers["Authorization"] = `Bearer ${provider.apiKey}`;
  try {
    const resp = await request({
      url: base + path,
      method: "GET",
      headers,
      signal,
      timeout: 15000,
    });
    if (resp.status >= 400) return [];
    const data = await resp.json();
    return (data.data || []).map((m) => m.id).filter(Boolean);
  } catch {
    return [];
  }
}

module.exports = {
  callOpenAI,
  listModels,
  isReasoningModel,
  normalizeForModel,
};
