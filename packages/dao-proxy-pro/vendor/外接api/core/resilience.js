"use strict";
/**
 * resilience.js · 弹性重试模块 · 移植自 Go EXE internal/resilience
 * ═══════════════════════════════════════════════════════════════
 *
 *   道义: 七十六章「人之生也柔弱 其死也坚强」
 *         柔弱者生之徒 · 弹性者流之徒 · 不绝则通
 *
 *   Go EXE resilience 包功能:
 *     resilience.Stream              ← 弹性流处理器 (主入口)
 *     resilience.shouldAutoContinue  ← 判断是否需要自动继续
 *     resilience.buildContinueRequest ← 构建继续请求
 *     resilience.matchesRefusal       ← 匹配拒绝模式
 *     resilience.downgradeThinkingRequest ← 降级思考请求
 *     resilience.isThinkingSignatureError ← 检测思考签名错误
 *     resilience.isContextErr         ← 检测上下文错误
 *     resilience.bufferToolCall       ← 缓冲工具调用
 *     resilience.emitBufferedToolCalls ← 发射缓冲的工具调用
 *     resilience.sleepBackoff         ← 指数退避
 *
 *   弹性策略:
 *     1. 自动继续: finish_reason=length → 自动追加 "继续" 重发
 *     2. 拒绝匹配: 检测 API 拒绝 → 降级/重试
 *     3. 思考降级: thinking 错误 → 自动降级为非 thinking 模式
 *     4. 退避重试: 429/500 → 指数退避重试
 *     5. 工具缓冲: 累积工具调用 → 一次性发射
 *
 *   零依赖 · 纯 Node.js · 与 dao_router.js + adapters.js 协同
 */

// ── 退避配置 ──────────────────────────────────────────────────
const BACKOFF = Object.freeze({
  baseMs: 1000,      // 基础退避 1s
  maxMs: 30000,      // 最大退避 30s
  maxRetries: 3,     // 最大重试次数
  jitterRatio: 0.1,  // 抖动比例 10%
});

// ── 上下文错误模式 (移植自 Go resilience.isContextErr) ────────
const CONTEXT_ERR_PATTERNS = [
  /context.window_exceeded/i,
  /context.length.exceeded/i,
  /maximum.context.length/i,
  /token.limit.exceeded/i,
  /too.many.tokens/i,
  /input.tokens.exceed/i,
  /context_length_exceeded/i,
  /reduce.the.length/i,
  /request.too.large/i,
  /input_length/i,
];

// ── 思考签名错误模式 (移植自 Go resilience.isThinkingSignatureError) ──
const THINKING_SIG_ERR_PATTERNS = [
  /thinking\.signature/i,
  /signature\.verification/i,
  /thinking_mode.*invalid/i,
  /extended.thinking.*error/i,
  /reasoning.*not.supported/i,
  /thinking.*not.enabled/i,
  /budget_tokens.*invalid/i,
];

// ── 拒绝模式 (与 budget.js 共享) ─────────────────────────────
const REFUSAL_PATTERNS = [
  /I (?:can't|cannot|am unable to|won't|will not) (?:help|assist|provide|do|create|generate|write|comply)/i,
  /I'm (?:not able|unable|sorry)/i,
  /(?:against|violates|inappropriate|unethical|harmful|illegal)/i,
  /(?:As an AI|As a language model|I apologize)/i,
  /(?:content policy|safety guidelines|terms of service)/i,
];

// ── 可重试的 HTTP 状态码 ──────────────────────────────────────
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

// ── 内部状态 ──────────────────────────────────────────────────
let _log = () => {};

// ════════════════════════════════════════════════════════════════
// §1  弹性流处理器 (移植自 Go resilience.Stream)
// ════════════════════════════════════════════════════════════════

/**
 * 创建弹性流处理器
 *   道义: 柔弱者生之徒 · 弹性不绝则通
 *
 * @param {object} opts
 * @param {Function} opts.callProvider  - 调用 provider 的函数
 * @param {object}   opts.adapter       - 协议适配器
 * @param {object}   opts.provCfg       - provider 配置
 * @param {object}   opts.target        - 路由目标配置
 * @param {object}   opts.callOpts      - 调用选项 (messages, tools, etc.)
 * @param {object}   opts.resilienceCfg - 弹性配置 (可选)
 * @returns {object} 弹性流处理器
 */
function createResilientStream(opts) {
  const {
    callProvider,
    adapter,
    provCfg,
    target,
    callOpts,
    resilienceCfg = {},
  } = opts;

  const cfg = {
    autoContinue: resilienceCfg.autoContinue !== false,
    maxAutoContinue: resilienceCfg.maxAutoContinue || 3,
    retryOnRefusal: resilienceCfg.retryOnRefusal !== false,
    maxRefusalRetries: resilienceCfg.maxRefusalRetries || 1,
    downgradeThinking: resilienceCfg.downgradeThinking !== false,
    retryOn429: resilienceCfg.retryOn429 !== false,
    max429Retries: resilienceCfg.max429Retries || 2,
    retryOnContextErr: resilienceCfg.retryOnContextErr !== false,
    maxContextRetries: resilienceCfg.maxContextRetries || 1,
    ...resilienceCfg,
  };

  return {
    cfg,
    callProvider,
    adapter,
    provCfg,
    target,
    callOpts,
    _autoContinueCount: 0,
    _refusalRetryCount: 0,
    _429RetryCount: 0,
    _contextRetryCount: 0,
    _thinkingDowngraded: false,
    _accumulatedText: "",
    _accumulatedThinking: "",
  };
}

// ════════════════════════════════════════════════════════════════
// §2  自动继续 (移植自 Go resilience.shouldAutoContinue)
// ════════════════════════════════════════════════════════════════

/**
 * 判断是否需要自动继续
 *   finish_reason=length → 输出被截断 → 自动追加 "继续"
 *   道义: 三十七章「道恒无为」· 不绝则通 · 自动续流
 */
function shouldAutoContinue(finishReason, autoContinueCount, maxAutoContinue) {
  return finishReason === "length" && autoContinueCount < (maxAutoContinue || 3);
}

/**
 * 构建继续请求 (移植自 Go resilience.buildContinueRequest)
 *   在消息末尾追加 assistant 已输出内容 + user "继续"
 */
function buildContinueRequest(originalMessages, accumulatedText, accumulatedThinking) {
  const messages = [...originalMessages];
  const assistantMsg = { role: "assistant", content: accumulatedText || "" };
  if (accumulatedThinking) assistantMsg.reasoning_content = accumulatedThinking;
  messages.push(assistantMsg);
  messages.push({ role: "user", content: "Continue." });
  return messages;
}

// ════════════════════════════════════════════════════════════════
// §3  拒绝匹配 (移植自 Go resilience.matchesRefusal)
// ════════════════════════════════════════════════════════════════

/**
 * 匹配拒绝模式
 *   道义: 三十六章「将欲弱之 必固强之」· 知其拒方知其通
 */
function matchesRefusal(text) {
  if (!text || typeof text !== "string") return false;
  return REFUSAL_PATTERNS.some((p) => p.test(text));
}

// ════════════════════════════════════════════════════════════════
// §4  思考降级 (移植自 Go resilience.downgradeThinkingRequest)
// ════════════════════════════════════════════════════════════════

/**
 * 检测思考签名错误
 */
function isThinkingSignatureError(errorMsg) {
  if (!errorMsg || typeof errorMsg !== "string") return false;
  return THINKING_SIG_ERR_PATTERNS.some((p) => p.test(errorMsg));
}

/**
 * 检测上下文错误
 */
function isContextErr(errorMsg) {
  if (!errorMsg || typeof errorMsg !== "string") return false;
  return CONTEXT_ERR_PATTERNS.some((p) => p.test(errorMsg));
}

/**
 * 降级思考请求 (移植自 Go resilience.downgradeThinkingRequest)
 *   道义: 损之又损 · 思考不通则损 · 损之又损以至于通
 */
function downgradeThinkingRequest(callOpts) {
  const downgraded = { ...callOpts };
  if (downgraded.thinkingEnabled) {
    downgraded.thinkingEnabled = false;
    _log("[resilience] 思考降级: thinkingEnabled → false");
  }
  if (downgraded.thinkingBudget) {
    downgraded.thinkingBudget = null;
  }
  if (downgraded.reasoningEffort) {
    downgraded.reasoningEffort = null;
  }
  return downgraded;
}

/**
 * 降级上下文请求 (裁剪消息以适应上下文)
 *   道义: 知止不殆 · 裁剪至止
 */
function downgradeContextRequest(messages, trimRatio = 0.7) {
  if (!Array.isArray(messages) || messages.length <= 2) return messages;
  const system = messages.filter((m) => m.role === "system");
  const chat = messages.filter((m) => m.role !== "system");
  const keepCount = Math.max(2, Math.floor(chat.length * trimRatio));
  const trimmed = chat.slice(-keepCount);
  _log(`[resilience] 上下文降级: ${chat.length} → ${trimmed.length} 消息`);
  return [...system, ...trimmed];
}

// ════════════════════════════════════════════════════════════════
// §5  退避重试 (移植自 Go resilience.sleepBackoff)
// ════════════════════════════════════════════════════════════════

/**
 * 计算指数退避延迟
 *   道义: 柔弱胜刚强 · 退而再进 · 进而不竭
 */
function calcBackoffMs(retryCount, opts = {}) {
  const base = opts.baseMs || BACKOFF.baseMs;
  const max = opts.maxMs || BACKOFF.maxMs;
  const jitter = opts.jitterRatio || BACKOFF.jitterRatio;
  const delay = Math.min(base * Math.pow(2, retryCount), max);
  const jitterMs = delay * jitter * Math.random();
  return Math.floor(delay + jitterMs);
}

/**
 * 睡眠指定毫秒
 */
function sleepBackoff(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 判断 HTTP 状态码是否可重试
 */
function isRetryableStatus(statusCode) {
  return RETRYABLE_STATUS.has(statusCode);
}

/**
 * 从 HTTP 响应中提取 Retry-After 延迟
 */
function getRetryAfterMs(headers) {
  const retryAfter = headers["retry-after"];
  if (!retryAfter) return null;
  const seconds = parseInt(retryAfter, 10);
  if (!isNaN(seconds)) return seconds * 1000;
  const date = new Date(retryAfter);
  if (!isNaN(date.getTime())) {
    return Math.max(0, date.getTime() - Date.now());
  }
  return null;
}

// ════════════════════════════════════════════════════════════════
// §6  工具调用缓冲 (移植自 Go resilience.bufferToolCall)
// ════════════════════════════════════════════════════════════════

/**
 * 工具调用缓冲器
 *   道义: 大制无割 · 累积而成 · 成而不割
 */
class ToolCallBuffer {
  constructor() {
    this._buf = new Map();
  }

  buffer(index, delta) {
    let rec = this._buf.get(index);
    if (!rec) {
      rec = { id: "", name: "", argsBuf: "" };
      this._buf.set(index, rec);
    }
    if (delta.id) rec.id = delta.id;
    if (delta.function) {
      if (delta.function.name) rec.name = delta.function.name;
      if (typeof delta.function.arguments === "string") {
        rec.argsBuf += delta.function.arguments;
      }
    }
  }

  bufferResponses(index, delta) {
    let rec = this._buf.get(index);
    if (!rec) {
      rec = { id: "", name: "", argsBuf: "" };
      this._buf.set(index, rec);
    }
    if (delta.callId) rec.id = delta.callId;
    if (delta.name) rec.name = delta.name;
    if (delta.partialJson) rec.argsBuf += delta.partialJson;
  }

  emit() {
    const calls = [];
    const indices = Array.from(this._buf.keys()).sort((a, b) => a - b);
    for (const idx of indices) {
      const rec = this._buf.get(idx);
      if (rec && rec.name) {
        calls.push({
          id: rec.id || `tc_${idx}`,
          name: rec.name,
          argumentsJson: rec.argsBuf || "{}",
        });
      }
    }
    return calls;
  }

  clear() {
    this._buf.clear();
  }

  get size() {
    return this._buf.size;
  }
}

// ════════════════════════════════════════════════════════════════
// §7  弹性重试执行器
// ════════════════════════════════════════════════════════════════

/**
 * 弹性重试执行器
 *   道义: 七十六章「柔弱处上」· 柔弱者处上 · 弹性者处通
 */
async function resilientExec(fn, opts = {}) {
  const maxRetries = opts.maxRetries || BACKOFF.maxRetries;
  let retries = 0;
  let downgraded = false;
  let lastError = null;

  while (retries <= maxRetries) {
    try {
      const result = await fn(retries);
      return { result, retries, downgraded };
    } catch (e) {
      lastError = e;
      const errMsg = e.message || String(e);
      const statusCode = e.statusCode || 0;

      if (isThinkingSignatureError(errMsg) && opts.downgradeThinking !== false) {
        _log(`[resilience] 思考签名错误 → 降级: ${errMsg.substring(0, 120)}`);
        downgraded = true;
        retries++;
        continue;
      }

      if (isContextErr(errMsg) && opts.retryOnContextErr !== false) {
        _log(`[resilience] 上下文错误 → 裁剪重试: ${errMsg.substring(0, 120)}`);
        retries++;
        continue;
      }

      if (isRetryableStatus(statusCode) && retries < maxRetries) {
        const backoffMs = getRetryAfterMs(e.headers || {}) || calcBackoffMs(retries);
        _log(`[resilience] HTTP ${statusCode} → 退避 ${backoffMs}ms 后重试 #${retries + 1}`);
        await sleepBackoff(backoffMs);
        retries++;
        continue;
      }

      throw e;
    }
  }

  throw lastError;
}

// ════════════════════════════════════════════════════════════════
// §8  初始化 + 状态
// ════════════════════════════════════════════════════════════════

function initResilience(opts = {}) {
  _log = opts.log || (() => {});
  _log("[resilience] 初始化完成 · autoContinue + refusalMatch + thinkingDowngrade + backoffRetry");
}

function getDefaultConfig() {
  return {
    autoContinue: true,
    maxAutoContinue: 3,
    retryOnRefusal: true,
    maxRefusalRetries: 1,
    downgradeThinking: true,
    retryOn429: true,
    max429Retries: 2,
    retryOnContextErr: true,
    maxContextRetries: 1,
    backoff: { ...BACKOFF },
  };
}

// ════════════════════════════════════════════════════════════════
// §9  导出
// ════════════════════════════════════════════════════════════════

module.exports = {
  createResilientStream,
  shouldAutoContinue,
  buildContinueRequest,
  matchesRefusal,
  isThinkingSignatureError,
  isContextErr,
  downgradeThinkingRequest,
  downgradeContextRequest,
  calcBackoffMs,
  sleepBackoff,
  isRetryableStatus,
  getRetryAfterMs,
  resilientExec,
  ToolCallBuffer,
  initResilience,
  getDefaultConfig,
  BACKOFF,
};
