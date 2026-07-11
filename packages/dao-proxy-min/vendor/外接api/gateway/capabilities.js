"use strict";
/**
 * capabilities.js · 模型能力映射 (已知上游限制)
 * ────────────────────────────────────────────────────
 * 当 Windsurf Cascade 发给网关"我要这个模型 + 这些工具", 而上游 provider
 * 的 deployment 其实不支持, 我们在这里做"尽可能无感"的降级:
 *
 *   · 完全不支持 tools      → 把 tools 塞进 system prompt, 让模型用文本描述它想做什么
 *   · 只支持 1 个 tool      → 把 N 个 tool 合并为一个 "dispatch" 工具, 第一个参数 is name
 *   · 不支持 parallel calls → 加 system hint "Only call one tool per turn"
 *   · 不支持 system role   → 并入第一条 user
 *
 * 匹配顺序: 精确 id → 前缀匹配 → 默认 (full capabilities).
 * 道: 为无为, 则无不治. 不让下游客户端关心上游的臭毛病.
 */

// ─── 已知限制 (根据 2025 末 GitHub Models 实测) ────────────────────────
const KNOWN = [
  // phi-4 GitHub Models 部署: vLLM 后端, 没开 auto tool choice
  {
    pattern: /^github\/microsoft\/phi-4($|-)/i,
    toolSupport: "none",
    reason: "vLLM deployment on GitHub Models lacks --enable-auto-tool-choice",
  },
  // llama-3.3-70b GitHub 版本: 上游明说只支持 1 tool
  {
    pattern: /^github\/meta\/llama-3\.3-/i,
    toolSupport: "single", // 定义 + 使用都最多 1 个
    reason: "GitHub Models llama-3.3 deployment: max 1 tool",
  },
  // llama-3.2 vision 类, 一般也弱 tool 支持
  {
    pattern: /^github\/meta\/llama-3\.2-.+vision/i,
    toolSupport: "none",
    reason: "Vision models on GitHub Models typically have no tool calling",
  },
  // phi-4-mini / phi-4-multimodal 同类
  {
    pattern: /^github\/microsoft\/phi-4-(mini|multimodal)/i,
    toolSupport: "none",
    reason: "phi-4 variants on GitHub Models lack tool support",
  },
  // deepseek-r1 推理模型: 在 GitHub Models 部署下 tool_calls 返回不稳定 (finish_reason='tool_call' 但 tool_calls 为空)
  {
    pattern: /^github\/deepseek\/deepseek-r1/i,
    toolSupport: "none",
    reason:
      "DeepSeek-R1 on GitHub Models: reasoning model with unreliable tool_calls format",
  },
  // ollama 本地模型: 大多不可靠支持 tools, 降级为 none
  {
    pattern: /^ollama\//i,
    toolSupport: "none",
    reason: "local ollama models have no standardized tool support",
  },
];

// 默认能力 (full)
const DEFAULT_CAP = {
  toolSupport: "full", // full / single / none
  parallelTools: true,
  systemRole: true,
};

function capabilitiesFor(modelId) {
  if (!modelId) return { ...DEFAULT_CAP };
  for (const k of KNOWN) {
    if (k.pattern.test(modelId)) {
      return {
        ...DEFAULT_CAP,
        toolSupport: k.toolSupport || "full",
        parallelTools: k.parallelTools !== false && k.toolSupport === "full",
        systemRole: k.systemRole !== false,
        _reason: k.reason,
      };
    }
  }
  return { ...DEFAULT_CAP };
}

// ─── 降级器 ──────────────────────────────────────────────────────────
// 把 OpenAI 风格的请求按 capability 降级
function degradeOpenAIRequest(body, caps) {
  const out = { ...body };
  if (!caps) caps = { ...DEFAULT_CAP };

  // 1. 若模型不支持 tools: 把 tools 降级为 system prompt 提示, 并删除 tools 字段
  if (
    caps.toolSupport === "none" &&
    Array.isArray(out.tools) &&
    out.tools.length
  ) {
    const toolSummary = out.tools
      .map((t) => {
        const fn = t.function || t;
        const params = fn.parameters
          ? "(" + Object.keys(fn.parameters.properties || {}).join(", ") + ")"
          : "()";
        return `• ${fn.name}${params}: ${fn.description || "no description"}`;
      })
      .join("\n");
    const hint = `\n\n[System note] You have access to these tools but cannot invoke them directly in this environment. When you want to use one, describe your intent in plain text (e.g. "I would call read_file(path=...)") and the caller will handle the rest:\n${toolSummary}`;
    // 找第一条 system 或首条 user, 追加
    const msgs = [...(out.messages || [])];
    const sysIdx = msgs.findIndex((m) => m.role === "system");
    if (sysIdx >= 0) {
      msgs[sysIdx] = {
        ...msgs[sysIdx],
        content: String(msgs[sysIdx].content || "") + hint,
      };
    } else {
      msgs.unshift({
        role: "system",
        content: "You are a helpful assistant." + hint,
      });
    }
    out.messages = msgs;
    delete out.tools;
    delete out.tool_choice;
  }

  // 2. 若只支持 1 个 tool, 且请求里 tools 多于 1 个: 只保留第 1 个, 其余降级为 system 描述
  if (
    caps.toolSupport === "single" &&
    Array.isArray(out.tools) &&
    out.tools.length > 1
  ) {
    const first = out.tools[0];
    const rest = out.tools.slice(1);
    const restSummary = rest
      .map((t) => {
        const fn = t.function || t;
        return `• ${fn.name}: ${fn.description || "no description"}`;
      })
      .join("\n");
    const hint = `\n\n[System note] This model only supports one tool definition per call. Only '${(first.function || first).name}' is directly callable. The other tools are documented here; to use them, describe your intent in plain text:\n${restSummary}`;
    const msgs = [...(out.messages || [])];
    const sysIdx = msgs.findIndex((m) => m.role === "system");
    if (sysIdx >= 0) {
      msgs[sysIdx] = {
        ...msgs[sysIdx],
        content: String(msgs[sysIdx].content || "") + hint,
      };
    } else {
      msgs.unshift({ role: "system", content: hint.trimStart() });
    }
    out.messages = msgs;
    out.tools = [first];
  }

  // 3. 若不支持 parallelTools 且请求含 tools: 追加提示
  if (
    caps.parallelTools === false &&
    Array.isArray(out.tools) &&
    out.tools.length > 0
  ) {
    const msgs = [...(out.messages || [])];
    const sysIdx = msgs.findIndex((m) => m.role === "system");
    const hint =
      "\n\n[System note] Call only one tool per turn. If multiple actions are needed, do them sequentially.";
    if (sysIdx >= 0) {
      msgs[sysIdx] = {
        ...msgs[sysIdx],
        content: String(msgs[sysIdx].content || "") + hint,
      };
    } else {
      msgs.unshift({ role: "system", content: hint.trimStart() });
    }
    out.messages = msgs;
  }

  // 4. 若不支持 system role: 并入第一条 user
  if (caps.systemRole === false && Array.isArray(out.messages)) {
    const msgs = [];
    let pendingSystem = "";
    for (const m of out.messages) {
      if (m.role === "system") {
        pendingSystem +=
          (pendingSystem ? "\n\n" : "") +
          (typeof m.content === "string"
            ? m.content
            : JSON.stringify(m.content));
      } else if (m.role === "user" && pendingSystem) {
        msgs.push({
          ...m,
          content: `[System context]\n${pendingSystem}\n\n[User]\n${typeof m.content === "string" ? m.content : JSON.stringify(m.content)}`,
        });
        pendingSystem = "";
      } else {
        msgs.push(m);
      }
    }
    if (pendingSystem) msgs.unshift({ role: "user", content: pendingSystem });
    out.messages = msgs;
  }

  return out;
}

module.exports = { capabilitiesFor, degradeOpenAIRequest, DEFAULT_CAP, KNOWN };
