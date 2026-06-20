"use strict";
/**
 * adapters.js · 多协议适配器 · 移植自 Go EXE internal/upstream
 * ═══════════════════════════════════════════════════════════════
 *
 *   道义: 二十八章「知其白 守其辱 为天下式」
 *         知各协议之白 · 守其转换之辱 · 为天下适配之式
 *
 *   Go EXE upstream 包功能:
 *     upstream.AnthropicAdapter       ← Anthropic Messages API (/v1/messages)
 *     upstream.OpenAIChatAdapter      ← OpenAI Chat Completions (/v1/chat/completions)
 *     upstream.OpenAIResponsesAdapter ← OpenAI Responses API (/v1/responses) [NEW!]
 *     upstream.AdapterFor             ← 根据协议类型选择适配器
 *     upstream.buildAnthropicRequest ← 构建 Anthropic 格式请求
 *     upstream.buildResponsesRequest ← 构建 Responses API 格式请求
 *     upstream.readAnthropicSSE       ← 读取 Anthropic SSE 格式
 *     upstream.readOpenAIResponsesSSE ← 读取 Responses API SSE 格式
 *     upstream.applyAuthHeaders       ← 应用认证头
 *     upstream.normalizeBaseURL       ← 规范化基础 URL
 *     upstream.normalizeReasoningEffort ← 规范化推理力度
 *     upstream.pickContextLength      ← 选择上下文长度
 *     upstream.modelinfo_cache        ← 模型信息缓存
 *
 *   三种协议:
 *     openai-chat     — /v1/chat/completions (当前唯一支持)
 *     anthropic       — /v1/messages (Claude 系列)
 *     openai-responses — /v1/responses (GPT-5/o3 系列 · 新格式)
 *
 *   零依赖 · 纯 Node.js · 与 dao_router.js 协同
 */

const http = require("http");
const https = require("https");
const path = require("path");

// ── 协议类型枚举 ──────────────────────────────────────────────
const PROTOCOL = Object.freeze({
  OPENAI_CHAT: "openai-chat",
  ANTHROPIC: "anthropic",
  OPENAI_RESPONSES: "openai-responses",
});

// ── 模型信息缓存 (移植自 Go upstream.modelinfo_cache) ─────────
const _modelInfoCache = new Map();

// ── Anthropic 模型上下文长度 ──────────────────────────────────
const ANTHROPIC_CONTEXT = Object.freeze({
  "claude-opus-4": 200000,
  "claude-opus-4-6": 200000,
  "claude-sonnet-4": 200000,
  "claude-sonnet-4-6": 200000,
  "claude-sonnet-4-5": 200000,
  "claude-3-5-sonnet": 200000,
  "claude-3-5-haiku": 200000,
  "claude-3-opus": 200000,
  "claude-3-haiku": 200000,
  default: 200000,
});

// ── OpenAI 模型上下文长度 ─────────────────────────────────────
const OPENAI_CONTEXT = Object.freeze({
  "gpt-5-4": 256000,
  "gpt-5-4-low": 256000,
  "gpt-5-4-high": 256000,
  "gpt-5-4-xhigh": 256000,
  "gpt-5-4-xhigh-priority": 256000,
  "gpt-4o": 128000,
  "gpt-4o-mini": 128000,
  "o4-mini": 200000,
  o3: 200000,
  "o3-mini": 200000,
  default: 128000,
});

// ── DeepSeek 模型上下文长度 ───────────────────────────────────
const DEEPSEEK_CONTEXT = Object.freeze({
  "deepseek-chat": 65536,
  "deepseek-reasoner": 65536,
  "deepseek-v3": 131072,
  "deepseek-r1": 131072,
  default: 65536,
});

// ── Gemini 模型上下文长度 ─────────────────────────────────────
const GEMINI_CONTEXT = Object.freeze({
  "gemini-2.5-pro": 1048576,
  "gemini-2.5-flash": 1048576,
  "gemini-2.0-flash": 1048576,
  "gemini-3-1-pro": 1048576,
  default: 1048576,
});

// ── 推理力度映射 ──────────────────────────────────────────────
const REASONING_EFFORT = Object.freeze({
  low: "low",
  medium: "medium",
  high: "high",
  // Go EXE 模型后缀映射
  "-low": "low",
  "-med": "medium",
  "-high": "high",
  "-xhigh": "high",
});

// ── 内部状态 ──────────────────────────────────────────────────
let _log = () => {};

// ════════════════════════════════════════════════════════════════
// §1  适配器选择 (移植自 Go upstream.AdapterFor)
// ════════════════════════════════════════════════════════════════

/**
 * 根据协议类型选择适配器
 * @param {string} protocol - 协议类型 (PROTOCOL 枚举)
 * @returns {object} 适配器对象
 */
function adapterFor(protocol) {
  switch (protocol) {
    case PROTOCOL.ANTHROPIC:
      return AnthropicAdapter;
    case PROTOCOL.OPENAI_RESPONSES:
      return OpenAIResponsesAdapter;
    case PROTOCOL.OPENAI_CHAT:
    default:
      return OpenAIChatAdapter;
  }
}

/**
 * 自动检测协议类型 (根据 provider 配置 + model 名称)
 *   道义: 道法自然 · 自动识别 · 无需手动指定
 */
function detectProtocol(provCfg, model) {
  // 1. 显式指定
  if (provCfg.protocol) return provCfg.protocol;

  // 2. 根据 type 字段
  if (provCfg.type === "anthropic") return PROTOCOL.ANTHROPIC;
  if (provCfg.type === "openai-responses") return PROTOCOL.OPENAI_RESPONSES;

  // 3. 根据 baseUrl 推断
  const url = (provCfg.baseUrl || "").toLowerCase();
  if (url.includes("anthropic") || url.includes("claude"))
    return PROTOCOL.ANTHROPIC;

  // 4. 根据 completionPath 推断
  const cp = (provCfg.completionPath || "").toLowerCase();
  if (cp.includes("/v1/messages")) return PROTOCOL.ANTHROPIC;
  if (cp.includes("/v1/responses")) return PROTOCOL.OPENAI_RESPONSES;

  // 5. 根据 model 名称推断
  const m = (model || "").toLowerCase();
  if (m.startsWith("claude")) return PROTOCOL.ANTHROPIC;
  if (m.startsWith("gpt-5") || m.startsWith("o3") || m.startsWith("o4")) {
    // GPT-5/o3/o4 支持 Responses API, 但默认用 Chat (更兼容)
    // 如果 provider 配置了 responses 路径 → 用 Responses
    if (cp.includes("responses")) return PROTOCOL.OPENAI_RESPONSES;
  }

  // 默认: OpenAI Chat
  return PROTOCOL.OPENAI_CHAT;
}

// ════════════════════════════════════════════════════════════════
// §2  OpenAI Chat 适配器 (移植自 Go upstream.OpenAIChatAdapter)
// ════════════════════════════════════════════════════════════════

const OpenAIChatAdapter = {
  protocol: PROTOCOL.OPENAI_CHAT,

  /**
   * 构建 OpenAI Chat 请求体
   */
  buildRequest(opts) {
    const {
      messages,
      tools,
      toolChoice,
      maxOutputTokens,
      model,
      stream = true,
      thinkingEnabled = false,
      thinkingBudget = null,
      reasoningEffort = null,
    } = opts;

    const body = { model, messages, stream };

    // 工具
    if (tools && tools.length > 0) {
      body.tools = tools;
      if (toolChoice && !thinkingEnabled) {
        body.tool_choice = toolChoice;
      }
    }

    // 输出 token 限制
    if (maxOutputTokens) body.max_tokens = maxOutputTokens;

    // 思考模式 (DeepSeek V3.2)
    if (thinkingEnabled) {
      body.thinking = { type: "enabled" };
      if (thinkingBudget) body.thinking.budget_tokens = thinkingBudget;
    }

    // 推理力度 (o3/o4 系列)
    if (reasoningEffort) {
      body.reasoning_effort = normalizeReasoningEffort(reasoningEffort);
    }

    return body;
  },

  /**
   * 构建 HTTP 请求选项
   */
  buildRequestOpts(provCfg, body, targetUrl) {
    const headers = {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    };
    applyAuthHeaders(headers, provCfg);
    return { headers };
  },

  /**
   * 解析 SSE 数据行
   *   返回统一格式: { type, content, thinking, toolCalls, finishReason, usage }
   */
  parseSSELine(data) {
    if (!data || data === "[DONE]") return { type: "done" };

    let obj;
    try {
      obj = JSON.parse(data);
    } catch {
      return { type: "skip" };
    }

    const choice = obj.choices && obj.choices[0];
    if (!choice) return { type: "skip" };

    const delta = choice.delta || {};
    const result = { type: "delta" };

    // 文本
    if (typeof delta.content === "string" && delta.content.length > 0) {
      result.content = delta.content;
    }

    // 思考 (DeepSeek reasoning_content / Anthropic thinking)
    if (
      typeof delta.reasoning_content === "string" &&
      delta.reasoning_content.length > 0
    ) {
      result.thinking = delta.reasoning_content;
    } else if (
      typeof delta.thinking === "string" &&
      delta.thinking.length > 0
    ) {
      result.thinking = delta.thinking;
    } else if (
      typeof delta.reasoning === "string" &&
      delta.reasoning.length > 0
    ) {
      result.thinking = delta.reasoning;
    }

    // 工具调用 (累进式)
    if (Array.isArray(delta.tool_calls)) {
      result.toolCalls = delta.tool_calls;
    }

    // 结束原因
    if (choice.finish_reason) {
      result.finishReason = choice.finish_reason;
    }

    // Token 使用
    if (obj.usage) {
      result.usage = {
        input: obj.usage.prompt_tokens || 0,
        output: obj.usage.completion_tokens || obj.usage.output_tokens || 0,
        cached: obj.usage.prompt_tokens_details?.cached_tokens || 0,
      };
    }

    return result;
  },

  /**
   * 解析非流式 (unary) 响应
   */
  parseUnaryResponse(body) {
    let obj;
    try {
      obj = JSON.parse(body);
    } catch {
      return null;
    }

    const choice = obj.choices && obj.choices[0];
    if (!choice) return null;
    const msg = choice.message || {};

    return {
      content: msg.content || "",
      thinking: msg.reasoning_content || msg.thinking || "",
      toolCalls: msg.tool_calls || [],
      finishReason: choice.finish_reason || "stop",
      usage: obj.usage
        ? {
            input: obj.usage.prompt_tokens || 0,
            output: obj.usage.completion_tokens || obj.usage.output_tokens || 0,
            cached: obj.usage.prompt_tokens_details?.cached_tokens || 0,
          }
        : null,
    };
  },

  /**
   * 获取完成路径
   */
  getCompletionPath(provCfg) {
    return provCfg.completionPath || "/v1/chat/completions";
  },
};

// ════════════════════════════════════════════════════════════════
// §3  Anthropic 适配器 (移植自 Go upstream.AnthropicAdapter)
// ════════════════════════════════════════════════════════════════

const AnthropicAdapter = {
  protocol: PROTOCOL.ANTHROPIC,

  /**
   * 构建 Anthropic Messages API 请求体
   *   道义: 三十九章「得一」· 得 Anthropic 格式方能通
   *
   *   关键差异 (vs OpenAI Chat):
   *     - system 独立字段 (不在 messages 中)
   *     - tool_choice 格式不同: { type: "auto" } vs "auto"
   *     - thinking 通过 anthropic-beta 头启用
   *     - 图片格式: { type: "image", source: { type: "base64", ... } }
   */
  buildRequest(opts) {
    const {
      messages: rawMessages,
      tools,
      toolChoice,
      maxOutputTokens,
      model,
      stream = true,
      thinkingEnabled = false,
      thinkingBudget = null,
      system = "",
    } = opts;

    // 分离 system 消息
    const systemContent = system || _extractSystemFromMessages(rawMessages);
    // ★ v10.0 · 修法⑫ · 消息格式转换: OpenAI → Anthropic
    //   tool 角色消息 → user + tool_result content block
    //   assistant tool_calls → content blocks (text + tool_use)
    //   reasoning_content → thinking block
    //   道义: 二十八章「知其白守其辱」· 知 OpenAI 格式 · 守 Anthropic 格式
    const messages = _convertMessagesToAnthropicFormat(
      _removeSystemFromMessages(rawMessages),
    );

    const body = {
      model,
      messages,
      stream,
      max_tokens: maxOutputTokens || 8192,
    };

    // System prompt (Anthropic 独立字段)
    if (systemContent) {
      body.system = thinkingEnabled
        ? [
            {
              type: "text",
              text: systemContent,
              cache_control: { type: "ephemeral" },
            },
          ]
        : systemContent;
    }

    // 思考模式 (Anthropic extended thinking)
    //   道义: 道生一 · thinking=budget_tokens 为一 · 启用后思维链可见
    if (thinkingEnabled) {
      body.thinking = {
        type: "enabled",
        budget_tokens: thinkingBudget || 10000,
      };
      // thinking启用时 max_tokens 必须小于 budget_tokens + max_tokens 总和
      // Anthropic要求: max_tokens < budget_tokens + max_tokens (即总输出限制)
    }

    // 工具
    if (tools && tools.length > 0) {
      body.tools = tools.map((t) => _convertToolToAnthropic(t));
      if (toolChoice) {
        body.tool_choice = _convertToolChoiceToAnthropic(toolChoice);
      }
    }

    return body;
  },

  /**
   * 构建 HTTP 请求选项 (Anthropic 专用头)
   */
  buildRequestOpts(provCfg, body, targetUrl) {
    const headers = {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      "anthropic-version": "2023-06-01",
    };

    // 认证
    if (provCfg.apiKey) {
      headers["x-api-key"] = provCfg.apiKey;
    } else if (provCfg.authHeader) {
      const [k, v] = provCfg.authHeader.split(":");
      if (k && v) headers[k.trim()] = v.trim();
    }

    // 思考模式 Beta 头
    if (body.thinking || provCfg.thinkingEnabled) {
      headers["anthropic-beta"] = _composeAnthropicBetaHeader(provCfg);
    }

    return { headers };
  },

  /**
   * 解析 Anthropic SSE 数据行
   *   事件类型: message_start, content_block_start, content_block_delta,
   *             content_block_stop, message_delta, message_stop
   */
  parseSSELine(data, eventType) {
    if (!data) return { type: "skip" };

    let obj;
    try {
      obj = JSON.parse(data);
    } catch {
      return { type: "skip" };
    }

    const type = obj.type || eventType || "";

    // message_start: 包含 model, usage 等
    if (type === "message_start") {
      const msg = obj.message || {};
      return {
        type: "delta",
        usage: msg.usage
          ? {
              input: msg.usage.input_tokens || 0,
              output: 0,
              cached: msg.usage.cache_read_input_tokens || 0,
            }
          : null,
      };
    }

    // content_block_start: 新内容块
    if (type === "content_block_start") {
      const block = obj.content_block || {};
      if (block.type === "tool_use") {
        return {
          type: "delta",
          toolCallStart: {
            index: obj.index || 0,
            id: block.id || "",
            name: block.name || "",
          },
        };
      }
      // ★ v10.0 · 修法⑰ · thinking 块起始可能含 block.thinking
      //   Anthropic extended thinking: content_block_start 含 thinking 文本
      //   道义: 二十八章「大制无割」· 不割则全
      if (block.type === "thinking" && block.thinking) {
        return { type: "delta", thinking: block.thinking };
      }
      // text 块起始无内容 (内容在 content_block_delta 中)
      return { type: "skip" };
    }

    // content_block_delta: 内容增量
    if (type === "content_block_delta") {
      const delta = obj.delta || {};
      const idx = obj.index || 0;

      if (delta.type === "text_delta") {
        return { type: "delta", content: delta.text || "" };
      }
      if (delta.type === "thinking_delta") {
        return { type: "delta", thinking: delta.thinking || "" };
      }
      if (delta.type === "input_json_delta") {
        return {
          type: "delta",
          toolCallDelta: {
            index: idx,
            partialJson: delta.partial_json || "",
          },
        };
      }
      return { type: "skip" };
    }

    // ★ v10.0 · content_block_stop: 内容块结束
    //   Go EXE 在此事件时立即 emitToolCall (工具调用完成)
    //   旧版缺失 → Anthropic 工具调用需等 message_delta finishReason 才冲出
    //   道义: 九章「持而盈之不如其已」· 已则成 · 成则通
    if (type === "content_block_stop") {
      const idx = obj.index || 0;
      // ★ 返回 toolCallBlockDone 信号 → _streamOaToCascade 可在此时冲出该工具
      return { type: "delta", toolCallBlockDone: { index: idx } };
    }

    // message_delta: 结束信息
    if (type === "message_delta") {
      const delta = obj.delta || {};
      const usage = obj.usage || {};
      const result = { type: "delta" };

      if (delta.stop_reason) {
        result.finishReason = _anthropicStopReason(delta.stop_reason);
      }

      if (usage.output_tokens) {
        result.usage = { input: 0, output: usage.output_tokens || 0 };
      }

      return result;
    }

    // message_stop: 流结束
    if (type === "message_stop") {
      return { type: "done" };
    }

    return { type: "skip" };
  },

  /**
   * 解析非流式 (unary) 响应
   */
  parseUnaryResponse(body) {
    let obj;
    try {
      obj = JSON.parse(body);
    } catch {
      return null;
    }

    if (obj.type !== "message") return null;

    const content = obj.content || [];
    let text = "";
    let thinking = "";
    const toolCalls = [];

    for (const block of content) {
      if (block.type === "text") text += block.text || "";
      else if (block.type === "thinking") thinking += block.thinking || "";
      else if (block.type === "tool_use") {
        toolCalls.push({
          id: block.id || "",
          type: "function",
          function: {
            name: block.name || "",
            arguments:
              typeof block.input === "object"
                ? JSON.stringify(block.input)
                : "{}",
          },
        });
      }
    }

    return {
      content: text,
      thinking,
      toolCalls,
      finishReason: _anthropicStopReason(obj.stop_reason || "end_turn"),
      usage: obj.usage
        ? {
            input: obj.usage.input_tokens || 0,
            output: obj.usage.output_tokens || 0,
            cached: obj.usage.cache_read_input_tokens || 0,
          }
        : null,
    };
  },

  /**
   * 获取完成路径
   */
  getCompletionPath(provCfg) {
    return provCfg.completionPath || "/v1/messages";
  },
};

// ════════════════════════════════════════════════════════════════
// §4  OpenAI Responses 适配器 (移植自 Go upstream.OpenAIResponsesAdapter)
// ════════════════════════════════════════════════════════════════
//   ★ NEW! Go EXE 独有 · 支持 /v1/responses 格式
//   用于 GPT-5/o3/o4 系列的 Responses API
//   与 Chat Completions 的关键差异:
//     - input 而非 messages (支持多模态)
//     - output 而非 choices (支持多种输出类型)
//     - reasoning 参数 (thinking/reasoning)
//     - 内置工具 (web_search, file_search, code_interpreter)

const OpenAIResponsesAdapter = {
  protocol: PROTOCOL.OPENAI_RESPONSES,

  /**
   * 构建 OpenAI Responses API 请求体
   *   道义: 四十一章「大方无隅 大器晚成」
   *         新格式无隅 · 大器晚成 · Responses API 方能通
   */
  buildRequest(opts) {
    const {
      messages,
      tools,
      toolChoice,
      maxOutputTokens,
      model,
      stream = true,
      thinkingEnabled = false,
      thinkingBudget = null,
      reasoningEffort = null,
      system = "",
    } = opts;

    // 转换 messages → input 格式
    const input = _convertMessagesToResponsesInput(messages, system);

    const body = {
      model,
      input,
      stream,
    };

    // 工具 (Responses API 格式)
    if (tools && tools.length > 0) {
      body.tools = tools.map((t) => _convertToolToResponses(t));
      if (toolChoice) {
        body.tool_choice = _convertToolChoiceToResponses(toolChoice);
      }
    }

    // 输出 token 限制
    if (maxOutputTokens) body.max_output_tokens = maxOutputTokens;

    // Reasoning (Responses API 专用)
    if (thinkingEnabled || reasoningEffort) {
      body.reasoning = {};
      if (thinkingEnabled) {
        body.reasoning.generate_summary = "auto";
        if (thinkingBudget) body.reasoning.budget_tokens = thinkingBudget;
      }
      if (reasoningEffort) {
        body.reasoning.effort = normalizeReasoningEffort(reasoningEffort);
      }
    }

    return body;
  },

  /**
   * 构建 HTTP 请求选项
   */
  buildRequestOpts(provCfg, body, targetUrl) {
    const headers = {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    };
    applyAuthHeaders(headers, provCfg);
    return { headers };
  },

  /**
   * 解析 Responses API SSE 数据行
   *   事件类型: response.created, response.output_item.added,
   *             response.content_part.added, response.output_text.delta,
   *             response.reasoning_summary_text.delta,
   *             response.function_call_arguments.delta,
   *             response.output_item.done, response.completed
   */
  parseSSELine(data, eventType) {
    if (!data) return { type: "skip" };

    let obj;
    try {
      obj = JSON.parse(data);
    } catch {
      return { type: "skip" };
    }

    const type = obj.type || eventType || "";

    // response.output_text.delta: 文本增量
    if (type === "response.output_text.delta") {
      return { type: "delta", content: obj.delta || "" };
    }

    // response.reasoning_summary_text.delta: 思考增量
    if (type === "response.reasoning_summary_text.delta") {
      return { type: "delta", thinking: obj.delta || "" };
    }

    // response.function_call_arguments.delta: 工具调用参数增量
    if (type === "response.function_call_arguments.delta") {
      return {
        type: "delta",
        toolCallDelta: {
          index: obj.output_index ?? 0,
          callId: obj.call_id || "",
          partialJson: obj.delta || "",
        },
      };
    }

    // response.output_item.added: 新输出项 (含工具调用开始)
    if (type === "response.output_item.added") {
      const item = obj.item || {};
      if (item.type === "function_call") {
        return {
          type: "delta",
          toolCallStart: {
            index: obj.output_index ?? 0,
            id: item.call_id || item.id || "",
            name: item.name || "",
          },
        };
      }
      return { type: "skip" };
    }

    // response.output_item.done: 输出项完成
    if (type === "response.output_item.done") {
      const item = obj.item || {};
      if (item.type === "function_call") {
        return {
          type: "delta",
          toolCallComplete: {
            index: obj.output_index ?? 0,
            id: item.call_id || item.id || "",
            name: item.name || "",
            arguments: item.arguments || "{}",
          },
        };
      }
      return { type: "skip" };
    }

    // response.completed: 响应完成
    if (type === "response.completed") {
      const response = obj.response || {};
      const result = { type: "delta" };

      // ★ v10.0 · 修法⑭补 · 完整 status 映射 (与 parseUnaryResponse 对齐)
      if (response.status === "completed") {
        result.finishReason = "stop";
      } else if (response.status === "incomplete") {
        result.finishReason = "length";
      } else if (response.status === "failed") {
        result.finishReason = "content_filter";
      } else if (response.status === "incomplete_tool_calls") {
        result.finishReason = "tool_calls";
      }

      if (response.usage) {
        result.usage = {
          input: response.usage.input_tokens || 0,
          output: response.usage.output_tokens || 0,
          cached: response.usage.input_tokens_details?.cached_tokens || 0,
        };
      }

      return result;
    }

    // response.created / response.in_progress: 跳过
    if (type === "response.created" || type === "response.in_progress") {
      return { type: "skip" };
    }

    return { type: "skip" };
  },

  /**
   * 解析非流式 (unary) 响应
   */
  parseUnaryResponse(body) {
    let obj;
    try {
      obj = JSON.parse(body);
    } catch {
      return null;
    }

    if (obj.type !== "response" && obj.object !== "response") return null;

    const output = obj.output || [];
    let text = "";
    let thinking = "";
    const toolCalls = [];

    for (const item of output) {
      if (item.type === "message") {
        for (const part of item.content || []) {
          if (part.type === "output_text") text += part.text || "";
        }
      } else if (item.type === "function_call") {
        toolCalls.push({
          id: item.call_id || item.id || "",
          type: "function",
          function: {
            name: item.name || "",
            arguments: item.arguments || "{}",
          },
        });
      }
    }

    // ★ v10.0 · 修法⑭ · Responses API finishReason 完整映射
    //   completed → stop | incomplete → length | failed → content_filter
    //   incomplete_tool_calls → tool_calls (有工具调用但未完成)
    let _finishReason = "stop";
    if (obj.status === "completed") _finishReason = "stop";
    else if (obj.status === "incomplete") _finishReason = "length";
    else if (obj.status === "failed") _finishReason = "content_filter";
    else if (obj.status === "incomplete_tool_calls")
      _finishReason = "tool_calls";

    return {
      content: text,
      thinking,
      toolCalls,
      finishReason: _finishReason,
      usage: obj.usage
        ? {
            input: obj.usage.input_tokens || 0,
            output: obj.usage.output_tokens || 0,
            cached: obj.usage.input_tokens_details?.cached_tokens || 0,
          }
        : null,
    };
  },

  /**
   * 获取完成路径
   */
  getCompletionPath(provCfg) {
    return provCfg.completionPath || "/v1/responses";
  },
};

// ════════════════════════════════════════════════════════════════
// §5  公共工具函数
// ════════════════════════════════════════════════════════════════

/**
 * 应用认证头 (移植自 Go upstream.applyAuthHeaders)
 *   不同协议使用不同的认证方式
 */
function applyAuthHeaders(headers, provCfg) {
  if (!provCfg) return;

  if (provCfg.apiKey) {
    // Anthropic 使用 x-api-key, 其他使用 Bearer
    const protocol = provCfg.protocol || detectProtocol(provCfg, provCfg.model);
    if (protocol === PROTOCOL.ANTHROPIC) {
      headers["x-api-key"] = provCfg.apiKey;
    } else {
      headers["Authorization"] = `Bearer ${provCfg.apiKey}`;
    }
  }

  // 自定义认证头
  if (provCfg.authHeader) {
    const [k, v] = provCfg.authHeader.split(":");
    if (k && v) headers[k.trim()] = v.trim();
  }

  // 额外头
  if (provCfg.extraHeaders && typeof provCfg.extraHeaders === "object") {
    Object.assign(headers, provCfg.extraHeaders);
  }
}

/**
 * 规范化基础 URL (移植自 Go upstream.normalizeBaseURL)
 */
function normalizeBaseURL(url) {
  if (!url) return "";
  return url.replace(/\/+$/, ""); // 移除末尾斜杠
}

/**
 * 规范化推理力度 (移植自 Go upstream.normalizeReasoningEffort)
 */
function normalizeReasoningEffort(effort) {
  if (!effort) return null;
  const e = String(effort).toLowerCase();
  if (REASONING_EFFORT[e]) return REASONING_EFFORT[e];
  // 模型后缀推断: gpt-5-4-low → low
  for (const [suffix, value] of Object.entries(REASONING_EFFORT)) {
    if (e.endsWith(suffix)) return value;
  }
  return "medium"; // 默认
}

/**
 * 选择上下文长度 (移植自 Go upstream.pickContextLength)
 */
function pickContextLength(model) {
  if (!model) return 128000;
  const m = model.toLowerCase();

  // 缓存检查
  if (_modelInfoCache.has(m)) return _modelInfoCache.get(m).contextLength;

  // Anthropic
  if (m.startsWith("claude")) {
    for (const [prefix, ctx] of Object.entries(ANTHROPIC_CONTEXT)) {
      if (prefix !== "default" && m.startsWith(prefix)) {
        _modelInfoCache.set(m, { contextLength: ctx });
        return ctx;
      }
    }
    return ANTHROPIC_CONTEXT.default;
  }

  // OpenAI
  if (m.startsWith("gpt") || m.startsWith("o3") || m.startsWith("o4")) {
    for (const [prefix, ctx] of Object.entries(OPENAI_CONTEXT)) {
      if (prefix !== "default" && m.startsWith(prefix)) {
        _modelInfoCache.set(m, { contextLength: ctx });
        return ctx;
      }
    }
    return OPENAI_CONTEXT.default;
  }

  // DeepSeek
  if (m.startsWith("deepseek")) {
    for (const [prefix, ctx] of Object.entries(DEEPSEEK_CONTEXT)) {
      if (prefix !== "default" && m.startsWith(prefix)) {
        _modelInfoCache.set(m, { contextLength: ctx });
        return ctx;
      }
    }
    return DEEPSEEK_CONTEXT.default;
  }

  // Gemini
  if (m.startsWith("gemini")) {
    for (const [prefix, ctx] of Object.entries(GEMINI_CONTEXT)) {
      if (prefix !== "default" && m.startsWith(prefix)) {
        _modelInfoCache.set(m, { contextLength: ctx });
        return ctx;
      }
    }
    return GEMINI_CONTEXT.default;
  }

  return 128000; // 通用默认
}

/**
 * 初始化适配器模块
 */
function initAdapters(opts = {}) {
  _log = opts.log || (() => {});
  _log(
    "[adapters] 初始化完成 · 支持 openai-chat + anthropic + openai-responses",
  );
}

/**
 * 获取所有支持的协议
 */
function getSupportedProtocols() {
  return Object.values(PROTOCOL);
}

/**
 * 获取模型信息缓存
 */
function getModelInfoCache() {
  return new Map(_modelInfoCache);
}

// ════════════════════════════════════════════════════════════════
// §6  私有辅助
// ════════════════════════════════════════════════════════════════

/**
 * 从 messages 中提取 system prompt (Anthropic 需要)
 */
function _extractSystemFromMessages(messages) {
  if (!Array.isArray(messages)) return "";
  for (const m of messages) {
    if (m.role === "system" && m.content) {
      return typeof m.content === "string" ? m.content : "";
    }
  }
  return "";
}

/**
 * 从 messages 中移除 system prompt
 */
function _removeSystemFromMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages.filter((m) => m.role !== "system");
}

/**
 * 转换 OpenAI 工具定义为 Anthropic 格式
 *   OpenAI:  { type: "function", function: { name, description, parameters } }
 *   Anthropic: { name, description, input_schema }
 */
function _convertToolToAnthropic(tool) {
  const fn = tool.function || tool;
  return {
    name: fn.name || tool.name || "",
    description: fn.description || tool.description || "",
    input_schema: fn.parameters ||
      tool.inputSchema ||
      tool.parameters || { type: "object", properties: {} },
  };
}

/**
 * 转换 OpenAI tool_choice 为 Anthropic 格式
 *   OpenAI:  "auto" | "none" | { type: "function", function: { name } }
 *   Anthropic: { type: "auto" } | { type: "any" } | { type: "tool", name: "xxx" }
 */
function _convertToolChoiceToAnthropic(toolChoice) {
  if (!toolChoice) return undefined;
  if (typeof toolChoice === "string") {
    if (toolChoice === "auto") return { type: "auto" };
    if (toolChoice === "none") return { type: "none" };
    if (toolChoice === "required") return { type: "any" };
    return { type: "auto" };
  }
  if (toolChoice.type === "function" && toolChoice.function) {
    return { type: "tool", name: toolChoice.function.name };
  }
  return { type: "auto" };
}

/**
 * 转换 OpenAI 工具定义为 Responses API 格式
 *   Responses API: { type: "function", name, description, parameters }
 */
function _convertToolToResponses(tool) {
  const fn = tool.function || tool;
  return {
    type: "function",
    name: fn.name || tool.name || "",
    description: fn.description || tool.description || "",
    parameters: fn.parameters ||
      tool.inputSchema ||
      tool.parameters || { type: "object", properties: {} },
  };
}

/**
 * 转换 tool_choice 为 Responses API 格式
 */
function _convertToolChoiceToResponses(toolChoice) {
  if (!toolChoice) return undefined;
  if (typeof toolChoice === "string") {
    if (toolChoice === "auto") return "auto";
    if (toolChoice === "none") return "none";
    if (toolChoice === "required") return "required";
    return "auto";
  }
  if (toolChoice.type === "function" && toolChoice.function) {
    return { type: "function", name: toolChoice.function.name };
  }
  return "auto";
}

/**
 * 转换 OpenAI messages 为 Responses API input 格式
 *   道义: 二十八章「知其白 守其辱」· 知 OpenAI 格式 · 守 Responses 格式
 *
 *   OpenAI:  { role, content, tool_calls, tool_call_id, reasoning_content }
 *   Responses: { role, content } (简化) + function_call_output
 */
function _convertMessagesToResponsesInput(messages, system) {
  const input = [];

  // System → 指令
  if (system) {
    input.push({ role: "system", content: system });
  }

  for (const m of messages || []) {
    if (m.role === "system") continue; // 已处理

    if (m.role === "assistant") {
      const item = { role: "assistant" };
      // 文本内容
      if (m.content) item.content = m.content;
      // 工具调用
      if (Array.isArray(m.tool_calls) && m.tool_calls.length > 0) {
        item.content = m.content || "";
        item.function_calls = m.tool_calls.map((tc) => ({
          call_id: tc.id || "",
          name: tc.function?.name || "",
          arguments: tc.function?.arguments || "{}",
        }));
      }
      input.push(item);
    } else if (m.role === "tool") {
      // Tool result → function_call_output
      input.push({
        type: "function_call_output",
        call_id: m.tool_call_id || "",
        output: m.content || "",
      });
    } else {
      // User
      input.push({ role: m.role || "user", content: m.content || "" });
    }
  }

  return input;
}

/**
 * 转换 OpenAI 格式消息为 Anthropic 格式
 *   道义: 二十八章「知其白 守其辱」· 知 OpenAI 格式 · 守 Anthropic 格式
 *
 *   OpenAI:  { role: "tool", tool_call_id, content }
 *   Anthropic: { role: "user", content: [{ type: "tool_result", tool_use_id, content }] }
 *
 *   OpenAI:  { role: "assistant", tool_calls: [{ id, function: { name, arguments } }] }
 *   Anthropic: { role: "assistant", content: [{ type: "text", text }, { type: "tool_use", id, name, input }] }
 *
 *   OpenAI:  { role: "assistant", reasoning_content: "..." }
 *   Anthropic: { role: "assistant", content: [{ type: "thinking", thinking }] }
 */
function _convertMessagesToAnthropicFormat(messages) {
  const result = [];

  for (const m of messages || []) {
    if (m.role === "system") continue; // system 由 buildRequest 独立处理

    if (m.role === "assistant") {
      const content = [];
      // 思考内容 → thinking block
      if (m.reasoning_content || m.thinking) {
        content.push({
          type: "thinking",
          thinking: m.reasoning_content || m.thinking || "",
        });
      }
      // 文本内容 → text block
      const textContent = typeof m.content === "string" ? m.content : "";
      if (textContent) {
        content.push({ type: "text", text: textContent });
      }
      // 工具调用 → tool_use blocks
      if (Array.isArray(m.tool_calls) && m.tool_calls.length > 0) {
        for (const tc of m.tool_calls) {
          let input = {};
          if (tc.function && tc.function.arguments) {
            try {
              input = JSON.parse(tc.function.arguments);
            } catch {
              input = {};
            }
          }
          content.push({
            type: "tool_use",
            id: tc.id || "",
            name: (tc.function && tc.function.name) || tc.name || "",
            input,
          });
        }
      }
      // 无内容时补空 text block (Anthropic 要求 assistant 至少一个 content block)
      if (content.length === 0) {
        content.push({ type: "text", text: "" });
      }
      result.push({ role: "assistant", content });
    } else if (m.role === "tool") {
      // Tool result → user + tool_result content block
      // ★ v10.0 · 修法⑫补2 · 连续 tool 消息合并为一个 user 消息
      //   Anthropic 要求: 同一 assistant tool_calls 的所有 tool_result
      //   必须在同一个 user 消息的 content 数组中
      //   道义: 二十八章「大制无割」· 完整方能通
      const toolResultBlock = {
        type: "tool_result",
        tool_use_id: m.tool_call_id || "",
        content: m.content || "",
      };
      if (
        m.tool_result_is_error ||
        (typeof m.content === "string" && m.content.startsWith("[ERROR]"))
      ) {
        toolResultBlock.is_error = true;
      }
      // 检查前一条是否也是 tool → 合并到同一个 user 消息
      const lastResult = result[result.length - 1];
      if (
        lastResult &&
        lastResult.role === "user" &&
        Array.isArray(lastResult.content) &&
        lastResult.content.some((b) => b.type === "tool_result")
      ) {
        lastResult.content.push(toolResultBlock);
      } else {
        result.push({
          role: "user",
          content: [toolResultBlock],
        });
      }
    } else {
      // User / 其他
      // ★ v10.0 · 修法⑱ · content 可能是数组 (多模态: text + image)
      //   Anthropic user content: string | [{type:"text",text:"..."}, {type:"image",...}]
      //   道义: 二十八章「大制无割」· 不割则全
      let _content;
      if (typeof m.content === "string") {
        _content = m.content;
      } else if (Array.isArray(m.content)) {
        // 转换 OpenAI 多模态格式 → Anthropic 格式
        _content = m.content.map((part) => {
          if (part.type === "text")
            return { type: "text", text: part.text || "" };
          if (part.type === "image_url" && part.image_url) {
            const url = part.image_url.url || "";
            if (url.startsWith("data:")) {
              const match = url.match(/^data:([^;]+);base64,(.+)$/);
              if (match) {
                return {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: match[1],
                    data: match[2],
                  },
                };
              }
            }
            return { type: "text", text: `[image: ${url.substring(0, 50)}]` };
          }
          if (part.type === "image" && part.source) return part; // 已是 Anthropic 格式
          return { type: "text", text: JSON.stringify(part) };
        });
      } else {
        _content = "";
      }
      result.push({ role: m.role || "user", content: _content });
    }
  }

  // ★ v10.0 · 修法⑲ · 合并连续 user 消息 (Anthropic 要求交替)
  //   连续 user 消息可能来自: 原始 user + tool_result 转换后的 user
  //   合并方式: 将后者的 content 拼接到前者的 content 数组
  //   道义: 四章「和其光同其尘」· 同角色者合之
  const merged = [];
  for (const msg of result) {
    const last = merged[merged.length - 1];
    if (last && last.role === "user" && msg.role === "user") {
      // 合并: 将 msg.content 追加到 last.content
      const lastContent = Array.isArray(last.content)
        ? last.content
        : [{ type: "text", text: last.content || "" }];
      const msgContent = Array.isArray(msg.content)
        ? msg.content
        : [{ type: "text", text: msg.content || "" }];
      last.content = [...lastContent, ...msgContent];
    } else {
      merged.push(msg);
    }
  }

  return merged;
}

/**
 * 转换 Anthropic stop_reason 为 OpenAI finish_reason
 */
function _anthropicStopReason(reason) {
  switch (reason) {
    case "end_turn":
      return "stop";
    case "tool_use":
      return "tool_calls";
    case "max_tokens":
      return "length";
    case "stop_sequence":
      return "stop";
    case "content_filter":
      return "content_filter"; // ★ v10.0 · 修法⑩补2 · 透传 content_filter
    default:
      return "stop";
  }
}

/**
 * 组合 Anthropic Beta 头
 */
function _composeAnthropicBetaHeader(provCfg) {
  const tokens = ["prompt-caching-2024-07-31"];
  if (provCfg.thinkingEnabled) tokens.push("interleaved-thinking-2025-05-14");
  return tokens.join(",");
}

// ════════════════════════════════════════════════════════════════
// §7  导出
// ════════════════════════════════════════════════════════════════

module.exports = {
  // 协议枚举
  PROTOCOL,

  // 适配器选择
  adapterFor,
  detectProtocol,

  // 三个适配器
  OpenAIChatAdapter,
  AnthropicAdapter,
  OpenAIResponsesAdapter,

  // 公共工具
  applyAuthHeaders,
  normalizeBaseURL,
  normalizeReasoningEffort,
  pickContextLength,

  // 初始化 + 状态
  initAdapters,
  getSupportedProtocols,
  getModelInfoCache,
};
