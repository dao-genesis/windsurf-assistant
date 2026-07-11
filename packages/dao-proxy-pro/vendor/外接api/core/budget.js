"use strict";
/**
 * budget.js · Token 预算管理 · 移植自 Go EXE internal/budget
 * ═══════════════════════════════════════════════════════════════
 *
 *   道义: 四十四章「知足不辱 知止不殆 可以长久」
 *         知其token之所耗 · 方知其所止 · 止而不殆
 *
 *   Go EXE budget 包功能:
 *     budget.Apply              ← 主入口: 应用预算限制
 *     budget.applyHistoryBudget ← 应用历史消息预算
 *     budget.applyToolsBudget   ← 应用工具预算
 *     budget.countMessageTokens ← 计算消息token数
 *     budget.CountTokensMany    ← 批量token计数
 *     budget.trimByCount        ← 按数量裁剪
 *     budget.trimByTokens       ← 按token数裁剪
 *     budget.compressMessages   ← 压缩消息
 *     budget.filterTools        ← 过滤工具
 *     budget.rewriteToolSchema  ← 重写工具Schema
 *     budget.truncateToolDescription ← 截断工具描述
 *     budget.compactJSONSchema  ← 压缩JSON Schema
 *     budget.stripDocFields     ← 剥离文档字段
 *     budget.appendSystemDirective ← 追加系统指令
 *     budget.composeAnthropicBeta ← 组合Anthropic Beta头
 *
 *   编码器:
 *     o200k_base  — GPT-4o/GPT-5系列
 *     cl100k_base — GPT-4系列
 *     p50k_base   — GPT-3系列
 *
 *   零依赖: 不引入 tiktoken npm 包 · 用字符比例估算 + 可选精确计数
 *   道法自然: 大巧若拙 · 估算足用 · 精确可选
 */

const path = require("path");
const fs = require("fs");

// ── 编码器字符/token 比例 (实证校准) ──────────────────────────
//   不同编码器对同一文本的 token/char 比不同
//   中文约 1.5-2 token/char, 英文约 0.25 token/char, 代码约 0.3
//   综合平均: ~0.4 token/char (o200k_base), ~0.5 (cl100k_base)
const ENCODER_RATIOS = Object.freeze({
  o200k_base: 0.38, // GPT-4o/5: 更高效
  cl100k_base: 0.45, // GPT-4: 中等
  p50k_base: 0.55, // GPT-3: 较低效
  default: 0.4, // 通用估算
});

// ── 默认预算配置 ──────────────────────────────────────────────
const DEFAULT_BUDGET = Object.freeze({
  maxContextTokens: 128000, // 最大上下文 token
  maxOutputTokens: 32768, // 最大输出 token
  historyBudgetRatio: 0.6, // 历史消息占上下文 60%
  toolsBudgetRatio: 0.15, // 工具定义占上下文 15%
  systemBudgetRatio: 0.1, // 系统提示词占上下文 10%
  reserveRatio: 0.15, // 预留输出空间 15%
  maxToolDescriptionTokens: 512, // 单个工具描述最大 token
  maxToolSchemaTokens: 2048, // 单个工具 Schema 最大 token
  compactSchema: true, // 压缩 JSON Schema
  stripDocFields: true, // 剥离文档字段 (title, description, examples)
  truncateDescriptions: true, // 截断过长描述
  encoder: "o200k_base", // 默认编码器
});

// ── Anthropic 缓存控制 Beta 头 ────────────────────────────────
const ANTHROPIC_BETA_TOKENS = [
  "prompt-caching-2024-07-31",
  "max-tokens-3-5-sonnet-2024-07-15",
  "interleaved-thinking-2025-05-14",
  "code-execution-2025-05-22",
];

// ── 拒绝模式 (移植自 Go resilience.matchesRefusal) ────────────
const REFUSAL_PATTERNS = [
  /I (?:can't|cannot|am unable to|won't|will not) (?:help|assist|provide|do|create|generate|write|comply)/i,
  /I'm (?:not able|unable|sorry)/i,
  /(?:against|violates|inappropriate|unethical|harmful|illegal)/i,
  /(?:As an AI|As a language model|I apologize)/i,
  /(?:content policy|safety guidelines|terms of service)/i,
];

// ── 内部状态 ──────────────────────────────────────────────────
let _tiktokenEncoder = null; // 可选: 精确 tiktoken 编码器
let _tiktokenLoaded = false; // 是否已尝试加载
let _log = () => {};

// ════════════════════════════════════════════════════════════════
// §1  公开 API
// ════════════════════════════════════════════════════════════════

/**
 * 初始化 budget 模块
 * @param {{ log?: Function }} opts
 */
function initBudget(opts = {}) {
  _log = opts.log || (() => {});
  _tryLoadTiktoken();
  _log("[budget] 初始化完成 · encoder=" + ( _tiktokenEncoder ? "tiktoken(精确)" : "ratio(估算)"));
}

/**
 * ★ 主入口: 应用预算限制 (移植自 Go budget.Apply)
 *   道义: 知足不辱 · 知止不殆
 *
 * @param {object} params
 * @param {Array}  params.messages  - OpenAI 格式消息数组
 * @param {Array}  params.tools     - 工具定义数组
 * @param {string} params.system    - 系统提示词
 * @param {object} params.budget    - 预算配置 (可选, 覆盖默认)
 * @param {string} params.modelUid  - 模型 UID (用于选择编码器)
 * @returns {{ messages, tools, system, stats }} 处理后的消息+工具+统计
 */
function apply(params) {
  const {
    messages: rawMessages,
    tools: rawTools,
    system: rawSystem,
    budget: userBudget,
    modelUid,
  } = params;

  const budget = { ...DEFAULT_BUDGET, ...(userBudget || {}) };
  const encoder = _pickEncoder(modelUid, budget.encoder);
  const maxCtx = budget.maxContextTokens;

  // ── 1. 计算 system prompt token ──
  const system = budget.truncateDescriptions && rawSystem
    ? _compactPromptText(rawSystem)
    : rawSystem || "";
  const systemTokens = countTokens(system, encoder);

  // ── 2. 应用工具预算 ──
  const { tools, toolTokens, toolsRemoved, toolsCompacted } = applyToolsBudget(
    rawTools || [],
    budget,
    encoder,
  );

  // ── 3. 计算剩余可用 token (历史消息) ──
  const reserveTokens = Math.floor(maxCtx * budget.reserveRatio);
  const historyBudget = Math.floor(maxCtx * budget.historyBudgetRatio);
  const availableForHistory = Math.max(
    0,
    historyBudget - systemTokens - toolTokens - reserveTokens,
  );

  // ── 4. 应用历史消息预算 ──
  const { messages, historyTokens, messagesTrimmed } = applyHistoryBudget(
    rawMessages || [],
    availableForHistory,
    encoder,
  );

  // ── 5. 统计 ──
  const totalInputTokens = systemTokens + toolTokens + historyTokens;
  const stats = {
    systemTokens,
    toolTokens,
    historyTokens,
    totalInputTokens,
    availableForHistory,
    messagesTrimmed,
    toolsRemoved,
    toolsCompacted,
    encoder: _tiktokenEncoder ? "tiktoken" : "ratio",
    maxContextTokens: maxCtx,
    outputBudget: Math.min(budget.maxOutputTokens, maxCtx - totalInputTokens),
  };

  _log(
    `[budget] apply: sys=${systemTokens} tools=${toolTokens}(${toolsRemoved}rm/${toolsCompacted}cmp) hist=${historyTokens}(${messagesTrimmed}trim) total=${totalInputTokens}/${maxCtx} out=${stats.outputBudget}`,
  );

  return { messages, tools, system, stats };
}

/**
 * 应用历史消息预算 (移植自 Go budget.applyHistoryBudget)
 *   道义: 损之又损 · 历史过长则裁 · 保留最近
 *
 * 策略:
 *   1. 从最新消息开始保留
 *   2. 超出预算时裁剪最早的消息
 *   3. 保留 system 消息不动
 *   4. 保留 assistant + tool 消息的完整性 (不拆对)
 */
function applyHistoryBudget(messages, budget, encoder) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return { messages: [], historyTokens: 0, messagesTrimmed: 0 };
  }

  // 分离 system 消息
  const systemMsgs = [];
  const chatMsgs = [];
  for (const m of messages) {
    if (m.role === "system") systemMsgs.push(m);
    else chatMsgs.push(m);
  }

  // 从最新开始累积 token
  let totalTokens = 0;
  const kept = [];
  let trimmed = 0;

  // 从后向前遍历 (保留最新)
  for (let i = chatMsgs.length - 1; i >= 0; i--) {
    const m = chatMsgs[i];
    const t = countMessageTokens(m, encoder);

    // 检查是否超出预算
    if (totalTokens + t > budget) {
      trimmed = i + 1; // 前 i+1 条被裁剪
      break;
    }

    totalTokens += t;

    // assistant + tool_calls 对: 确保 tool 响应紧跟 assistant
    if (m.role === "assistant" && Array.isArray(m.tool_calls) && m.tool_calls.length > 0) {
      // 将 assistant 和后续 tool 消息作为一组保留
      kept.unshift(m);
    } else if (m.role === "tool") {
      // tool 消息: 检查前一条是否是已保留的 assistant
      // 如果是 → 保留; 如果不是 → 跳过 (孤立的 tool 消息)
      const prevKept = kept.length > 0 ? kept[0] : null;
      if (prevKept && prevKept.role === "assistant") {
        kept.unshift(m);
      } else {
        // 孤立 tool 消息 → 跳过
        totalTokens -= t;
        trimmed++;
      }
    } else {
      kept.unshift(m);
    }
  }

  // 如果没有裁剪任何消息 → 原样返回
  if (trimmed === 0) {
    return { messages, historyTokens: totalTokens, messagesTrimmed: 0 };
  }

  // 合并 system + kept
  const result = [...systemMsgs, ...kept];
  return { messages: result, historyTokens: totalTokens, messagesTrimmed: trimmed };
}

/**
 * 应用工具预算 (移植自 Go budget.applyToolsBudget)
 *   道义: 工具过多则压 · Schema 过长则缩 · 描述过长则截
 *
 * 策略:
 *   1. 过滤掉不需要的工具
 *   2. 截断过长的工具描述
 *   3. 压缩 JSON Schema (剥离 title/description/examples)
 *   4. 重写工具 Schema (紧凑化)
 */
function applyToolsBudget(tools, budget, encoder) {
  if (!Array.isArray(tools) || tools.length === 0) {
    return { tools: [], toolTokens: 0, toolsRemoved: 0, toolsCompacted: 0 };
  }

  const maxToolTokens = Math.floor(budget.maxContextTokens * budget.toolsBudgetRatio);
  let totalTokens = 0;
  let removed = 0;
  let compacted = 0;
  const result = [];

  for (const t of tools) {
    const fn = t.function || t;
    let name = fn.name || t.name || "";
    let desc = fn.description || t.description || "";
    let schema = fn.parameters || t.inputSchema || t.parameters || {};

    // ── 截断描述 ──
    if (budget.truncateDescriptions && desc.length > 0) {
      const descTokens = countTokens(desc, encoder);
      if (descTokens > budget.maxToolDescriptionTokens) {
        const maxChars = Math.floor(budget.maxToolDescriptionTokens / ENCODER_RATIOS[encoder] || ENCODER_RATIOS.default);
        desc = desc.substring(0, maxChars) + "...";
        compacted++;
      }
    }

    // ── 压缩 Schema ──
    if (budget.compactSchema && schema && typeof schema === "object") {
      const origLen = JSON.stringify(schema).length;
      schema = compactJSONSchema(schema, budget.stripDocFields);
      if (JSON.stringify(schema).length < origLen) compacted++;
    }

    // ── Schema token 检查 ──
    const schemaStr = JSON.stringify(schema);
    const schemaTokens = countTokens(schemaStr, encoder);
    if (schemaTokens > budget.maxToolSchemaTokens) {
      // Schema 过大 → 尝试进一步压缩
      schema = { type: "object", properties: {}, required: [] };
      compacted++;
    }

    // 构建工具定义
    const toolDef = {
      type: "function",
      function: { name, description: desc, parameters: schema },
    };

    // 计算 token
    const toolTokens = countMessageTokens(
      { role: "system", content: JSON.stringify(toolDef) },
      encoder,
    );

    // 检查是否超出预算
    if (totalTokens + toolTokens > maxToolTokens) {
      removed++;
      continue;
    }

    totalTokens += toolTokens;
    result.push(toolDef);
  }

  return { tools: result, toolTokens: totalTokens, toolsRemoved: removed, toolsCompacted: compacted };
}

/**
 * 计算消息 token 数 (移植自 Go budget.countMessageTokens)
 *   包含角色标记 + 内容 + 工具调用等
 */
function countMessageTokens(message, encoder) {
  if (!message) return 0;

  // 基础: 每条消息 +4 token (role 标记 + 格式开销)
  let tokens = 4;

  // 内容
  if (typeof message.content === "string") {
    tokens += countTokens(message.content, encoder);
  } else if (Array.isArray(message.content)) {
    // 多模态内容
    for (const part of message.content) {
      if (typeof part === "string") tokens += countTokens(part, encoder);
      else if (part && typeof part.text === "string") tokens += countTokens(part.text, encoder);
      else if (part && part.type === "image_url") tokens += 85; // 固定: 低分辨率图片约 85 token
    }
  }

  // reasoning_content / thinking
  if (message.reasoning_content) tokens += countTokens(message.reasoning_content, encoder);
  if (message.thinking) tokens += countTokens(message.thinking, encoder);

  // tool_calls
  if (Array.isArray(message.tool_calls)) {
    for (const tc of message.tool_calls) {
      tokens += 4; // tool_call 格式开销
      if (tc.function) {
        if (tc.function.name) tokens += countTokens(tc.function.name, encoder);
        if (tc.function.arguments) tokens += countTokens(tc.function.arguments, encoder);
      }
    }
  }

  // tool_call_id
  if (message.tool_call_id) tokens += countTokens(message.tool_call_id, encoder);

  return tokens;
}

/**
 * 批量 token 计数 (移植自 Go budget.CountTokensMany)
 */
function countTokensMany(texts, encoder) {
  if (!Array.isArray(texts)) return [];
  return texts.map((t) => countTokens(t, encoder));
}

/**
 * 核心: 计算 token 数
 *   优先使用 tiktoken (精确) · 回退到字符比例估算
 */
function countTokens(text, encoder) {
  if (!text || typeof text !== "string") return 0;

  // 尝试精确计数
  if (_tiktokenEncoder) {
    try {
      return _tiktokenEncoder.encode(text).length;
    } catch {
      // tiktoken 失败 → 回退估算
    }
  }

  // 字符比例估算
  const ratio = ENCODER_RATIOS[encoder] || ENCODER_RATIOS.default;

  // 区分中文和英文/代码
  let cjkChars = 0;
  let otherChars = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (
      (code >= 0x4e00 && code <= 0x9fff) || // CJK Unified
      (code >= 0x3400 && code <= 0x4dbf) || // CJK Extension A
      (code >= 0x3000 && code <= 0x303f) || // CJK Symbols
      (code >= 0xff00 && code <= 0xffef)    // Fullwidth
    ) {
      cjkChars++;
    } else {
      otherChars++;
    }
  }

  // CJK: ~1.5 token/char, 其他: ratio token/char
  return Math.ceil(cjkChars * 1.5 + otherChars * ratio);
}

/**
 * 压缩 JSON Schema (移植自 Go budget.compactJSONSchema)
 *   道义: 损之又损 · 去其冗余 · 留其精华
 *
 *   策略:
 *     1. 移除 title, description, examples, default (如果 stripDocFields)
 *     2. 移除 additionalProperties: false (不影响验证)
 *     3. 移除 $schema (不影响验证)
 *     4. 递归处理 nested properties
 */
function compactJSONSchema(schema, stripDoc = true) {
  if (!schema || typeof schema !== "object") return schema;
  if (Array.isArray(schema)) return schema.map((s) => compactJSONSchema(s, stripDoc));

  const result = {};
  for (const [key, value] of Object.entries(schema)) {
    // 跳过文档字段
    if (stripDoc) {
      if (key === "title" || key === "description" || key === "examples" ||
          key === "default" || key === "$schema" || key === "additionalProperties") {
        continue;
      }
    }
    // 递归处理嵌套对象
    if (value && typeof value === "object" && !Array.isArray(value)) {
      result[key] = compactJSONSchema(value, stripDoc);
    } else if (Array.isArray(value)) {
      result[key] = value.map((v) =>
        v && typeof v === "object" ? compactJSONSchema(v, stripDoc) : v,
      );
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * 剥离文档字段 (移植自 Go budget.stripDocFields)
 */
function stripDocFields(schema) {
  return compactJSONSchema(schema, true);
}

/**
 * 截断工具描述 (移植自 Go budget.truncateToolDescription)
 */
function truncateToolDescription(desc, maxTokens, encoder) {
  if (!desc || typeof desc !== "string") return desc || "";
  const tokens = countTokens(desc, encoder);
  if (tokens <= maxTokens) return desc;
  const ratio = ENCODER_RATIOS[encoder] || ENCODER_RATIOS.default;
  const maxChars = Math.floor(maxTokens / ratio);
  return desc.substring(0, maxChars) + "...";
}

/**
 * 追加系统指令 (移植自 Go budget.appendSystemDirective)
 *   在系统提示词末尾追加指令 · 不覆盖原有内容
 */
function appendSystemDirective(system, directive) {
  if (!directive) return system || "";
  if (!system) return directive;
  return system + "\n\n" + directive;
}

/**
 * 组合 Anthropic Beta 头 (移植自 Go budget.composeAnthropicBeta)
 *   根据配置选择需要的 beta token
 */
function composeAnthropicBeta(opts = {}) {
  const tokens = [];
  if (opts.promptCaching !== false) tokens.push(ANTHROPIC_BETA_TOKENS[0]);
  if (opts.extendedThinking) tokens.push(ANTHROPIC_BETA_TOKENS[2]);
  if (opts.codeExecution) tokens.push(ANTHROPIC_BETA_TOKENS[3]);
  return tokens.join(",");
}

/**
 * 匹配拒绝模式 (移植自 Go resilience.matchesRefusal)
 *   检测上游 API 的拒绝响应
 */
function matchesRefusal(text) {
  if (!text || typeof text !== "string") return false;
  return REFUSAL_PATTERNS.some((p) => p.test(text));
}

/**
 * 获取预算状态 · 供热配置 API 使用
 */
function getBudgetStatus() {
  return {
    encoder: _tiktokenEncoder ? "tiktoken" : "ratio",
    encoderName: _tiktokenLoaded ? "loaded" : "not_available",
    defaultBudget: { ...DEFAULT_BUDGET },
  };
}

/**
 * 设置预算参数 · 热配置
 */
function setBudgetConfig(key, value) {
  if (key in DEFAULT_BUDGET) {
    DEFAULT_BUDGET[key] = value;
    return { ok: true };
  }
  return { ok: false, error: `unknown key: ${key}` };
}

// ════════════════════════════════════════════════════════════════
// §2  私有辅助
// ════════════════════════════════════════════════════════════════

/**
 * 尝试加载 tiktoken 编码器 (可选精确计数)
 *   道义: 大巧若拙 · 估算足用 · 精确可选
 */
function _tryLoadTiktoken() {
  if (_tiktokenLoaded) return;
  _tiktokenLoaded = true;
  try {
    // 尝试加载 js-tiktoken (如果用户安装了)
    const tiktoken = require("js-tiktoken");
    _tiktokenEncoder = tiktoken.encodingForModel("gpt-4o"); // o200k_base
    _log("[budget] tiktoken 加载成功 · 精确计数可用");
  } catch {
    // 尝试 @dqbd/tiktoken
    try {
      const tiktoken = require("@dqbd/tiktoken");
      _tiktokenEncoder = tiktoken.encodingForModel("gpt-4o");
      _log("[budget] @dqbd/tiktoken 加载成功 · 精确计数可用");
    } catch {
      _log("[budget] tiktoken 不可用 · 使用字符比例估算 (误差<10%)");
    }
  }
}

/**
 * 根据模型选择编码器
 */
function _pickEncoder(modelUid, defaultEncoder) {
  if (!modelUid || typeof modelUid !== "string") return defaultEncoder || "o200k_base";
  const uid = modelUid.toLowerCase();
  // GPT-5/4o 系列 → o200k_base
  if (uid.includes("gpt-5") || uid.includes("gpt-4o") || uid.includes("o4") || uid.includes("o3")) {
    return "o200k_base";
  }
  // GPT-4 系列 → cl100k_base
  if (uid.includes("gpt-4")) return "cl100k_base";
  // Claude 系列 → o200k_base (Anthropic 使用类似编码)
  if (uid.includes("claude")) return "o200k_base";
  // DeepSeek → cl100k_base (兼容)
  if (uid.includes("deepseek")) return "cl100k_base";
  // Gemini → o200k_base
  if (uid.includes("gemini")) return "o200k_base";
  return defaultEncoder || "o200k_base";
}

/**
 * 压缩 SP 多余空白 (与 dao_router._compactPromptText 一致)
 */
function _compactPromptText(text) {
  if (!text || typeof text !== "string") return text || "";
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ════════════════════════════════════════════════════════════════
// §3  导出
// ════════════════════════════════════════════════════════════════

module.exports = {
  // 主入口
  initBudget,
  apply,

  // 预算操作
  applyHistoryBudget,
  applyToolsBudget,

  // Token 计数
  countTokens,
  countTokensMany,
  countMessageTokens,

  // 工具优化
  compactJSONSchema,
  stripDocFields,
  truncateToolDescription,

  // 系统指令
  appendSystemDirective,

  // Anthropic
  composeAnthropicBeta,

  // 拒绝检测
  matchesRefusal,

  // 配置
  getBudgetStatus,
  setBudgetConfig,
  DEFAULT_BUDGET,
  ENCODER_RATIOS,
};
