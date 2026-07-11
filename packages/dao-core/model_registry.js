#!/usr/bin/env node
/**
 * model_registry.js · 万模型真本 · 印 53 · 道法自然
 * ════════════════════════════════════════════════════════════════════════
 *
 *   帛书·廿二章: "声人执一, 以为天下牧"
 *   帛书·廿八章: "朴散则为器, 圣人用则为官长; 夫大制无割"
 *
 *   职 (用):
 *     **一本** 描述所有厂商之所有常用模型
 *     family + effort + pricing 三体合一 · 复刻 Windsurf Cascade picker
 *
 *   structure:
 *     FAMILIES[familyId] = {
 *       familyId, displayName, vendor, route, byokProvider,
 *       contextWindow, efforts: [{id,label,uid,priceInput,priceCached,priceOutput,credit}],
 *       defaultEffort, supports:{stream,tool,vision,thinking,cache},
 *       tags:['new','recommended','adaptive','free','beta'],
 *       notes
 *     }
 *
 *   价目皆以 USD / 1M tokens 为单位 (与 Windsurf picker 同, 与 OpenAI/Anthropic docs 同).
 *   credit 字段为 Windsurf 信用积分倍率 (route=windsurf 时).
 *
 *   route 取值:
 *     'windsurf'     · 走 ~/.dao/accounts.json 之 devin/sk-ws 池 (cloud_engine + Cascade LSP)
 *     'byok-openai'  · 走 byok_router openai 协议
 *     'byok-anthropic' · byok_router anthropic
 *     'byok-gemini'  · byok_router gemini
 *     'byok-openrouter' · byok_router 聚合 (openrouter.ai)
 *     'byok-custom'  · 用户自定 base_url
 *
 *   模型 UID 规范:
 *     - Windsurf 原生: 照 cloud_engine.MODEL_CATALOG (如 'claude-opus-4-7-max')
 *     - BYOK 显式: '<provider>/<model>' (如 'openai/gpt-5-codex', 'anthropic/claude-opus-4-5')
 *     - 裸名自动识 (印 53 加): 'gpt-*' → openai, 'claude-*' → anthropic, 'gemini-*' → google
 *
 *   零 npm 依.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");

// ════════════════════════════════════════════════════════════════════════
// §1  model family 定义
// ════════════════════════════════════════════════════════════════════════

/** 所有模型 family (用 Object 方便 O(1) 查 · 顺序由 displayOrder 定) */
const FAMILIES = {};

/** 便捷注册助手 */
function _reg(f) {
  if (!f.familyId) throw new Error("family 缺 familyId");
  if (!Array.isArray(f.efforts) || f.efforts.length === 0)
    throw new Error(`family ${f.familyId} 缺 efforts`);
  f.defaultEffort =
    f.defaultEffort || f.efforts[f.efforts.length - 1]?.id || "default";
  f.tags = f.tags || [];
  f.supports = {
    stream: true,
    tool: false,
    vision: false,
    thinking: false,
    cache: false,
    ...(f.supports || {}),
  };
  f.displayOrder = f.displayOrder ?? 999;
  FAMILIES[f.familyId] = f;
  return f;
}

/** effort 层级规范 (复刻 Windsurf picker 五档) */
const EFFORT_LEVELS = ["low", "medium", "high", "xhigh", "max"];

/** 便捷 effort 行生成 · pricing 与 windsurf credit 对齐 */
function _ef(id, label, uid, priceInput, priceCached, priceOutput, credit) {
  return {
    id,
    label,
    uid,
    priceInput: priceInput ?? 0,
    priceCached: priceCached ?? (priceInput || 0) * 0.1,
    priceOutput: priceOutput ?? (priceInput || 0) * 5,
    credit: credit ?? 0,
  };
}

// ────────────────────────────────────────────────────────────────────────
// §1.1  Windsurf 原生 · 路由走 cloud_engine + Cascade LSP (devin/sk-ws 池)
// ────────────────────────────────────────────────────────────────────────

// Claude Opus 4.7 (五档 effort · picker 头牌 · 图中 Max 1M ctx)
_reg({
  familyId: "claude-opus-4-7",
  displayName: "Claude Opus 4.7",
  vendor: "anthropic",
  route: "windsurf",
  byokProvider: "anthropic",
  contextWindow: 1_000_000,
  defaultEffort: "max",
  efforts: [
    _ef("low", "Low", "claude-opus-4-7-low", 1, 0.1, 5, 2),
    _ef("medium", "Medium", "claude-opus-4-7-medium", 2, 0.2, 10, 4),
    _ef("high", "High", "claude-opus-4-7-high", 3, 0.3, 15, 6),
    _ef("xhigh", "XHigh", "claude-opus-4-7-xhigh", 4, 0.4, 20, 8),
    _ef("max", "Max", "claude-opus-4-7-max", 5, 0.5, 25, 10),
  ],
  supports: { stream: true, tool: true, vision: true, thinking: true, cache: true },
  tags: ["new", "recommended"],
  notes: "picker 头牌 · 1M ctx · 思维长 · 代理最强",
  displayOrder: 10,
});

// Claude Opus 4.6 Thinking (无 effort variants · 单档)
_reg({
  familyId: "claude-opus-4-6-thinking",
  displayName: "Claude Opus 4.6 Thinking",
  vendor: "anthropic",
  route: "windsurf",
  byokProvider: "anthropic",
  contextWindow: 200_000,
  efforts: [_ef("default", "Thinking", "claude-opus-4-6-thinking", 3, 0.3, 15, 8)],
  supports: { stream: true, tool: true, vision: true, thinking: true, cache: true },
  tags: [],
  displayOrder: 20,
});

// Claude Sonnet 4.6 (单档 · default)
_reg({
  familyId: "claude-sonnet-4-6",
  displayName: "Claude Sonnet 4.6",
  vendor: "anthropic",
  route: "windsurf",
  byokProvider: "anthropic",
  contextWindow: 200_000,
  efforts: [
    _ef("default", "Default", "claude-sonnet-4-6", 1.5, 0.15, 7.5, 4),
    _ef("thinking", "Thinking", "claude-sonnet-4-6-thinking", 2, 0.2, 10, 6),
  ],
  supports: { stream: true, tool: true, vision: true, thinking: true, cache: true },
  tags: ["recommended"],
  displayOrder: 25,
});

// Claude Sonnet 4.6 1M (1M ctx 变体)
_reg({
  familyId: "claude-sonnet-4-6-1m",
  displayName: "Claude Sonnet 4.6 1M",
  vendor: "anthropic",
  route: "windsurf",
  byokProvider: "anthropic",
  contextWindow: 1_000_000,
  efforts: [
    _ef("default", "Default", "claude-sonnet-4-6-1m", 3, 0.3, 15, 12),
    _ef("thinking", "Thinking", "claude-sonnet-4-6-thinking-1m", 4, 0.4, 20, 16),
  ],
  supports: { stream: true, tool: true, vision: true, thinking: true, cache: true },
  tags: [],
  displayOrder: 28,
});

// Claude Haiku 4.5 (速廉)
_reg({
  familyId: "claude-haiku-4-5",
  displayName: "Claude Haiku 4.5",
  vendor: "anthropic",
  route: "windsurf",
  byokProvider: "anthropic",
  contextWindow: 200_000,
  efforts: [_ef("default", "Default", "MODEL_PRIVATE_11", 0.8, 0.08, 4, 1)],
  supports: { stream: true, tool: true, vision: true, cache: true },
  tags: [],
  displayOrder: 30,
});

// SWE-1.6 Fast (Windsurf 自研 · 免费 · 速)
_reg({
  familyId: "swe-1-6-fast",
  displayName: "SWE-1.6 Fast",
  vendor: "windsurf",
  route: "windsurf",
  contextWindow: 128_000,
  efforts: [_ef("default", "Fast", "swe-1-6-fast", 0, 0, 0, 0)],
  supports: { stream: true, tool: true },
  tags: ["new", "free", "adaptive"],
  notes: "Windsurf 自研 · 免费 · 极速 · 最适 IDE agent",
  displayOrder: 5,
});

// SWE-1.5 (Windsurf 自研 稳)
_reg({
  familyId: "swe-1-5",
  displayName: "SWE-1.5",
  vendor: "windsurf",
  route: "windsurf",
  contextWindow: 200_000,
  efforts: [
    _ef("fast", "Fast", "MODEL_SWE_1_5", 0.5, 0.05, 2.5, 0.5),
    _ef("default", "Default", "MODEL_SWE_1_5_SLOW", 0, 0, 0, 0),
  ],
  supports: { stream: true, tool: true },
  tags: ["free"],
  displayOrder: 40,
});

// GPT-5.4 Thinking (五档 · picker 二把手)
_reg({
  familyId: "gpt-5-4",
  displayName: "GPT-5.4",
  vendor: "openai",
  route: "windsurf",
  byokProvider: "openai",
  contextWindow: 272_000,
  defaultEffort: "medium",
  efforts: [
    _ef("none", "No Thinking", "gpt-5-4-none", 1, 0.1, 5, 1.5),
    _ef("low", "Low", "gpt-5-4-low", 1.5, 0.15, 7.5, 1.5),
    _ef("medium", "Medium", "gpt-5-4-medium", 2.5, 0.25, 12.5, 3),
    _ef("high", "High", "gpt-5-4-high", 3.5, 0.35, 17.5, 4),
    _ef("xhigh", "XHigh", "gpt-5-4-xhigh", 10, 1, 50, 12),
  ],
  supports: { stream: true, tool: true, vision: true, thinking: true, cache: true },
  tags: ["recommended"],
  displayOrder: 45,
});

// GPT-5.4 Mini (速廉)
_reg({
  familyId: "gpt-5-4-mini",
  displayName: "GPT-5.4 Mini",
  vendor: "openai",
  route: "windsurf",
  byokProvider: "openai",
  contextWindow: 400_000,
  efforts: [
    _ef("low", "Low", "gpt-5-4-mini-low", 0.5, 0.05, 2.5, 1.5),
    _ef("medium", "Medium", "gpt-5-4-mini-medium", 0.8, 0.08, 4, 1.5),
  ],
  defaultEffort: "medium",
  supports: { stream: true, tool: true, vision: true, thinking: true, cache: true },
  tags: [],
  displayOrder: 50,
});

// GPT-5.3 Codex (编程专用 · 三档 · 图中有)
_reg({
  familyId: "gpt-5-3-codex",
  displayName: "GPT-5.3-Codex",
  vendor: "openai",
  route: "windsurf",
  byokProvider: "openai",
  contextWindow: 400_000,
  defaultEffort: "medium",
  efforts: [
    _ef("low", "Low", "gpt-5-3-codex-low", 1, 0.1, 5, 1.5),
    _ef("medium", "Medium", "gpt-5-3-codex-medium", 1.5, 0.15, 7.5, 2),
    _ef("high", "High", "gpt-5-3-codex-high", 2, 0.2, 10, 2.5),
  ],
  supports: { stream: true, tool: true, cache: true },
  tags: ["new", "recommended"],
  notes: "编程特化 · 400k ctx",
  displayOrder: 55,
});

// GPT-5.2 (四档)
_reg({
  familyId: "gpt-5-2",
  displayName: "GPT-5.2",
  vendor: "openai",
  route: "windsurf",
  byokProvider: "openai",
  contextWindow: 384_000,
  defaultEffort: "medium",
  efforts: [
    _ef("none", "No Thinking", "MODEL_GPT_5_2_NONE", 1, 0.1, 5, 1),
    _ef("low", "Low", "MODEL_GPT_5_2_LOW", 1, 0.1, 5, 1),
    _ef("medium", "Medium", "MODEL_GPT_5_2_MEDIUM", 1.5, 0.15, 7.5, 2),
    _ef("high", "High", "MODEL_GPT_5_2_HIGH", 2, 0.2, 10, 3),
  ],
  supports: { stream: true, tool: true, vision: true, thinking: true, cache: true },
  tags: [],
  displayOrder: 60,
});

// Gemini 3.1 Pro (图中有)
_reg({
  familyId: "gemini-3-1-pro",
  displayName: "Gemini 3.1 Pro",
  vendor: "google",
  route: "windsurf",
  byokProvider: "gemini",
  contextWindow: 1_048_576,
  defaultEffort: "high",
  efforts: [
    _ef("low", "Low", "gemini-3-1-pro-low", 0.5, 0.05, 2.5, 1),
    _ef("high", "High", "gemini-3-1-pro-high", 1.5, 0.15, 7.5, 2),
  ],
  supports: { stream: true, tool: true, vision: true, thinking: true, cache: true },
  tags: [],
  displayOrder: 70,
});

// Gemini 3 Flash (速廉)
_reg({
  familyId: "gemini-3-flash",
  displayName: "Gemini 3 Flash",
  vendor: "google",
  route: "windsurf",
  byokProvider: "gemini",
  contextWindow: 1_048_576,
  efforts: [
    _ef("low", "Low", "MODEL_GOOGLE_GEMINI_3_0_FLASH_LOW", 0.15, 0.015, 0.6, 1),
    _ef("medium", "Medium", "MODEL_GOOGLE_GEMINI_3_0_FLASH_MEDIUM", 0.3, 0.03, 1.2, 1),
  ],
  defaultEffort: "medium",
  supports: { stream: true, tool: true, vision: true, cache: true },
  tags: ["free"],
  displayOrder: 75,
});

// Gemini 2.5 Pro (稳)
_reg({
  familyId: "gemini-2-5-pro",
  displayName: "Gemini 2.5 Pro",
  vendor: "google",
  route: "windsurf",
  byokProvider: "gemini",
  contextWindow: 1_048_576,
  efforts: [_ef("default", "Default", "MODEL_GOOGLE_GEMINI_2_5_PRO", 1.25, 0.125, 5, 1)],
  supports: { stream: true, tool: true, vision: true, cache: true },
  tags: [],
  displayOrder: 80,
});

// xAI Grok 3
_reg({
  familyId: "xai-grok-3",
  displayName: "xAI Grok 3",
  vendor: "xai",
  route: "windsurf",
  byokProvider: "xai",
  contextWindow: 131_072,
  efforts: [
    _ef("default", "Default", "MODEL_XAI_GROK_3", 3, 0.3, 15, 1),
    _ef("mini", "Mini Thinking", "MODEL_XAI_GROK_3_MINI_REASONING", 0.3, 0.03, 1.5, 0.125),
  ],
  supports: { stream: true, tool: true, thinking: true },
  tags: [],
  displayOrder: 85,
});

// DeepSeek V4 (图中 "Recommended" 区 · 新)
_reg({
  familyId: "deepseek-v4",
  displayName: "DeepSeek V4",
  vendor: "deepseek",
  route: "windsurf",
  byokProvider: "deepseek",
  contextWindow: 128_000,
  efforts: [_ef("default", "Default", "deepseek-v4", 0.27, 0.07, 1.1, 1)],
  supports: { stream: true, tool: true, thinking: false, cache: true },
  tags: ["new", "recommended"],
  displayOrder: 90,
});

// GLM 5 / 4.7
_reg({
  familyId: "glm-5",
  displayName: "GLM-5",
  vendor: "zhipu",
  route: "windsurf",
  byokProvider: "zhipu",
  contextWindow: 128_000,
  efforts: [_ef("default", "Default", "glm-5", 0.5, 0.05, 2.5, 1.5)],
  supports: { stream: true, tool: true, vision: true },
  tags: [],
  displayOrder: 100,
});

_reg({
  familyId: "glm-4-7",
  displayName: "GLM 4.7",
  vendor: "zhipu",
  route: "windsurf",
  byokProvider: "zhipu",
  contextWindow: 200_000,
  efforts: [_ef("default", "Default", "MODEL_GLM_4_7", 0.1, 0.01, 0.5, 0.25)],
  supports: { stream: true, tool: true },
  tags: ["free"],
  displayOrder: 105,
});

// Kimi K2.5
_reg({
  familyId: "kimi-k2-5",
  displayName: "Kimi K2.5",
  vendor: "moonshot",
  route: "windsurf",
  byokProvider: "moonshot",
  contextWindow: 262_144,
  efforts: [_ef("default", "Default", "kimi-k2-5", 0.15, 0.015, 2, 1)],
  supports: { stream: true, tool: true },
  tags: ["free"],
  displayOrder: 110,
});

// Minimax M2.5
_reg({
  familyId: "minimax-m2-5",
  displayName: "Minimax M2.5",
  vendor: "minimax",
  route: "windsurf",
  contextWindow: 204_800,
  efforts: [_ef("default", "Default", "minimax-m2-5", 0.3, 0.03, 1.5, 1)],
  supports: { stream: true, tool: true },
  tags: [],
  displayOrder: 115,
});

// ────────────────────────────────────────────────────────────────────────
// §1.2  纯 BYOK · 走 byok_router 直透原厂 (不占 windsurf 池)
// ────────────────────────────────────────────────────────────────────────

// OpenAI 直路 · gpt-4o 系列 (不经 windsurf)
_reg({
  familyId: "openai-gpt-4o",
  displayName: "GPT-4o",
  vendor: "openai",
  route: "byok-openai",
  byokProvider: "openai",
  contextWindow: 128_000,
  efforts: [
    _ef("mini", "Mini", "openai/gpt-4o-mini", 0.15, 0.075, 0.6, 0),
    _ef("default", "Default", "openai/gpt-4o", 2.5, 1.25, 10, 0),
  ],
  defaultEffort: "mini",
  supports: { stream: true, tool: true, vision: true, cache: true },
  tags: [],
  displayOrder: 200,
});

// OpenAI o1 系列
_reg({
  familyId: "openai-o1",
  displayName: "OpenAI o1",
  vendor: "openai",
  route: "byok-openai",
  byokProvider: "openai",
  contextWindow: 200_000,
  efforts: [
    _ef("mini", "Mini", "openai/o1-mini", 3, 1.5, 12, 0),
    _ef("default", "Default", "openai/o1", 15, 7.5, 60, 0),
  ],
  defaultEffort: "mini",
  supports: { stream: true, thinking: true },
  tags: [],
  displayOrder: 210,
});

// Anthropic 直路 · Claude 3.5 Sonnet
_reg({
  familyId: "anthropic-claude-3-5-sonnet",
  displayName: "Claude 3.5 Sonnet (direct)",
  vendor: "anthropic",
  route: "byok-anthropic",
  byokProvider: "anthropic",
  contextWindow: 200_000,
  efforts: [_ef("default", "Default", "anthropic/claude-3-5-sonnet-20241022", 3, 0.3, 15, 0)],
  supports: { stream: true, tool: true, vision: true, cache: true },
  tags: [],
  displayOrder: 220,
});

// Anthropic 直路 · Claude 3.5 Haiku
_reg({
  familyId: "anthropic-claude-3-5-haiku",
  displayName: "Claude 3.5 Haiku (direct)",
  vendor: "anthropic",
  route: "byok-anthropic",
  byokProvider: "anthropic",
  contextWindow: 200_000,
  efforts: [_ef("default", "Default", "anthropic/claude-3-5-haiku-20241022", 1, 0.1, 5, 0)],
  supports: { stream: true, tool: true, vision: true, cache: true },
  tags: [],
  displayOrder: 225,
});

// Google 直路 · Gemini 2.0 Flash
_reg({
  familyId: "google-gemini-2-0-flash",
  displayName: "Gemini 2.0 Flash (direct)",
  vendor: "google",
  route: "byok-gemini",
  byokProvider: "gemini",
  contextWindow: 1_048_576,
  efforts: [_ef("default", "Default", "gemini/gemini-2.0-flash-exp", 0.1, 0.025, 0.4, 0)],
  supports: { stream: true, tool: true, vision: true },
  tags: [],
  displayOrder: 230,
});

// DeepSeek 直路
_reg({
  familyId: "deepseek-chat-direct",
  displayName: "DeepSeek Chat (direct)",
  vendor: "deepseek",
  route: "byok-openai",
  byokProvider: "deepseek",
  contextWindow: 128_000,
  efforts: [
    _ef("default", "Chat", "deepseek/deepseek-chat", 0.27, 0.07, 1.1, 0),
    _ef("reasoner", "Reasoner (R1)", "deepseek/deepseek-reasoner", 0.55, 0.14, 2.19, 0),
  ],
  supports: { stream: true, tool: true, thinking: true, cache: true },
  tags: [],
  displayOrder: 240,
});

// Groq 直路 (极速)
_reg({
  familyId: "groq-llama-3-3-70b",
  displayName: "Groq Llama 3.3 70B",
  vendor: "groq",
  route: "byok-openai",
  byokProvider: "groq",
  contextWindow: 131_072,
  efforts: [_ef("default", "Default", "groq/llama-3.3-70b-versatile", 0.59, 0, 0.79, 0)],
  supports: { stream: true, tool: true },
  tags: [],
  displayOrder: 250,
});

// OpenRouter 聚合路
_reg({
  familyId: "openrouter-auto",
  displayName: "OpenRouter (auto)",
  vendor: "openrouter",
  route: "byok-openai",
  byokProvider: "openrouter",
  contextWindow: 200_000,
  efforts: [_ef("default", "Default", "openrouter/auto", 0, 0, 0, 0)],
  supports: { stream: true, tool: true },
  tags: [],
  notes: "OpenRouter 自动选路 · 聚合数百模型 · 配 ~/.dao/byok.json openrouter.key",
  displayOrder: 260,
});

// Ollama 本地
_reg({
  familyId: "ollama-local",
  displayName: "Ollama (local)",
  vendor: "ollama",
  route: "byok-openai",
  byokProvider: "ollama",
  contextWindow: 128_000,
  efforts: [
    _ef("default", "Default", "ollama/llama3.3", 0, 0, 0, 0),
    _ef("qwen", "Qwen2.5 Coder", "ollama/qwen2.5-coder:32b", 0, 0, 0, 0),
  ],
  supports: { stream: true, tool: true },
  tags: ["free"],
  notes: "本机 Ollama · base_url 默 http://localhost:11434",
  displayOrder: 270,
});

// ════════════════════════════════════════════════════════════════════════
// §2  查询 API
// ════════════════════════════════════════════════════════════════════════

/** 获所有 family · 按 displayOrder 升序 */
function getAllFamilies() {
  return Object.values(FAMILIES).sort(
    (a, b) => (a.displayOrder || 999) - (b.displayOrder || 999),
  );
}

/** 按 familyId 查 · 返 null 若不存 */
function getFamily(familyId) {
  return FAMILIES[familyId] || null;
}

/** 按 UID 查 · 返 { family, effort } 或 null */
function findByUid(uid) {
  if (!uid) return null;
  for (const f of Object.values(FAMILIES)) {
    const ef = f.efforts.find((e) => e.uid === uid);
    if (ef) return { family: f, effort: ef };
  }
  return null;
}

/** 推荐列表 (有 'recommended' tag · 按 displayOrder) */
function getRecommended() {
  return getAllFamilies().filter((f) => (f.tags || []).includes("recommended"));
}

/** 新模型 (有 'new' tag) */
function getNew() {
  return getAllFamilies().filter((f) => (f.tags || []).includes("new"));
}

/** Adaptive 推 (兼 'adaptive' tag · 无则默 SWE fast) */
function getAdaptive() {
  const tagged = getAllFamilies().find((f) =>
    (f.tags || []).includes("adaptive"),
  );
  return tagged || FAMILIES["swe-1-6-fast"] || getAllFamilies()[0];
}

/** 按 vendor 聚类 */
function groupByVendor() {
  const out = {};
  for (const f of getAllFamilies()) {
    const v = f.vendor || "other";
    if (!out[v]) out[v] = [];
    out[v].push(f);
  }
  return out;
}

/** 按 route 聚类 · windsurf vs byok-* */
function groupByRoute() {
  const out = {};
  for (const f of getAllFamilies()) {
    const r = f.route || "other";
    if (!out[r]) out[r] = [];
    out[r].push(f);
  }
  return out;
}

// ════════════════════════════════════════════════════════════════════════
// §3  provider 自动探测 (裸名 → 前缀)
// ════════════════════════════════════════════════════════════════════════
//
// 入 'gpt-4o-mini' → 'openai/gpt-4o-mini'
// 入 'claude-3-5-sonnet' → 'anthropic/claude-3-5-sonnet-20241022'
// 入 'gemini-2.0-flash-exp' → 'gemini/gemini-2.0-flash-exp'
// 入 'deepseek-chat' → 'deepseek/deepseek-chat'
// 入 'windsurf 原生 uid' → 不变 (走 windsurf 池)
// 入 'openrouter/...' → 不变

/** 裸模型名 → BYOK 全名 · 返 null 若已是 windsurf uid 或已带前缀 */
function autoDetectByokPrefix(name) {
  if (!name || typeof name !== "string") return null;
  // 已带前缀
  if (/^[a-zA-Z][a-zA-Z0-9-_]*\//.test(name)) return null;
  // windsurf 原生 UID (registry 命中)
  if (findByUid(name)) return null;
  // 规则表
  const rules = [
    { pat: /^gpt-|^o[13]-|^o1$|^o3$|^chatgpt/i, prefix: "openai" },
    { pat: /^claude-/i, prefix: "anthropic" },
    { pat: /^gemini-/i, prefix: "gemini" },
    { pat: /^deepseek-/i, prefix: "deepseek" },
    { pat: /^grok-/i, prefix: "xai" },
    { pat: /^llama-|^mixtral-/i, prefix: "groq" },
    { pat: /^moonshot-|^kimi-/i, prefix: "moonshot" },
    { pat: /^glm-/i, prefix: "zhipu" },
    { pat: /^qwen-|^qwen2/i, prefix: "qwen" },
    { pat: /^mistral-|^mistral$|^ministral-/i, prefix: "mistral" },
    { pat: /^command-|^cohere-/i, prefix: "cohere" },
  ];
  for (const r of rules) {
    if (r.pat.test(name)) return `${r.prefix}/${name}`;
  }
  return null;
}

// ════════════════════════════════════════════════════════════════════════
// §4  Recently Used 追踪 (~/.dao/recent_models.json · 最多 10)
// ════════════════════════════════════════════════════════════════════════

const RECENT_FILE = path.join(os.homedir(), ".dao", "recent_models.json");
const RECENT_MAX = 10;

function _loadRecent() {
  try {
    if (fs.existsSync(RECENT_FILE)) {
      const j = JSON.parse(fs.readFileSync(RECENT_FILE, "utf8"));
      if (Array.isArray(j)) return j;
      if (Array.isArray(j.recent)) return j.recent;
    }
  } catch {}
  return [];
}

function _saveRecent(list) {
  try {
    fs.mkdirSync(path.dirname(RECENT_FILE), { recursive: true });
    fs.writeFileSync(RECENT_FILE, JSON.stringify({ recent: list }, null, 2));
  } catch {}
}

/** 记录一次使用 · uid 为真打 upstream 之模型 UID */
function trackUse(uid) {
  if (!uid) return getRecentUids();
  let list = _loadRecent();
  // 去重 + 头插
  list = [uid, ...list.filter((x) => x !== uid)];
  if (list.length > RECENT_MAX) list = list.slice(0, RECENT_MAX);
  _saveRecent(list);
  return list;
}

/** 返 recent uids */
function getRecentUids() {
  return _loadRecent();
}

/** 返 recent families (去重后按 recent uid 顺 · 每 family 只一次) */
function getRecentFamilies() {
  const uids = getRecentUids();
  const seen = new Set();
  const out = [];
  for (const uid of uids) {
    const hit = findByUid(uid);
    if (hit && !seen.has(hit.family.familyId)) {
      seen.add(hit.family.familyId);
      out.push({ family: hit.family, lastEffort: hit.effort.id });
    }
  }
  return out;
}

// ════════════════════════════════════════════════════════════════════════
// §5  导出
// ════════════════════════════════════════════════════════════════════════

module.exports = {
  // 数据
  FAMILIES,
  EFFORT_LEVELS,
  // 查
  getAllFamilies,
  getFamily,
  findByUid,
  getRecommended,
  getNew,
  getAdaptive,
  groupByVendor,
  groupByRoute,
  // provider 探
  autoDetectByokPrefix,
  // recent
  trackUse,
  getRecentUids,
  getRecentFamilies,
  RECENT_FILE,
};
