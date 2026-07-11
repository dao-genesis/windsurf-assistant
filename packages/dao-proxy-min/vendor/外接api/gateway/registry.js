"use strict";
/**
 * registry.js · 模型注册表 + 路由解析
 * ─────────────────────────────────────
 * 道生一: 一张全模型路由表, 一个查询入口
 *
 * 模型 ID 标准形态: `<provider>/<modelName>`  例: `deepseek/deepseek-chat`
 * 也支持裸 modelName (按 alias 或首命中 provider 解析)
 */

const path = require("path");
const fs = require("fs");

// ── 默认 baseUrl 表 ────────────────────────────────────────
const DEFAULT_BASE_URLS = {
  anthropic: "https://api.anthropic.com",
  anthropicCompat: "https://rsxermu666.cn",
  openai: "https://api.openai.com/v1",
  openaiCompat: "",
  deepseek: "https://api.deepseek.com/v1",
  moonshot: "https://api.moonshot.cn/v1",
  qwen: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  zhipu: "https://open.bigmodel.cn/api/paas/v4",
  gemini: "https://generativelanguage.googleapis.com/v1beta",
  openrouter: "https://openrouter.ai/api/v1",
  siliconflow: "https://api.siliconflow.cn/v1",
  groq: "https://api.groq.com/openai/v1",
  mistral: "https://api.mistral.ai/v1",
  ollama: "http://127.0.0.1:11434",
  lmstudio: "http://127.0.0.1:1234/v1",
  vllm: "http://127.0.0.1:8000/v1",
  // LG-Code · new-api 聚合中转 (lgcode.lgtc.top) · OpenAI 兼容 + Anthropic 兼容
  // 用户在 https://lgcode.lgtc.top 注册 → 后台领 sk- token → 配 apiKey 即生
  lgcode: "https://lgcode.lgtc.top/v1",
  lgcodeAnthropic: "https://lgcode.lgtc.top",
};

// 各 provider 使用的底层协议驱动
const PROTOCOL_DRIVER = {
  anthropic: "anthropic",
  anthropicCompat: "anthropic",
  openai: "openai",
  openaiCompat: "openai",
  deepseek: "openai",
  moonshot: "openai",
  qwen: "openai",
  zhipu: "openai",
  openrouter: "openai",
  siliconflow: "openai",
  groq: "openai",
  mistral: "openai",
  lmstudio: "openai",
  vllm: "openai",
  gemini: "gemini",
  ollama: "ollama",
  lgcode: "openai", // OpenAI /v1/chat/completions 兼容
  lgcodeAnthropic: "anthropic", // 同站 /v1/messages Anthropic 兼容
};

// 无 API Key 即可服务的本地 / 无鉴权驱动
// (ollama / lmstudio / vllm 皆走 localhost; 用户显式配 noAuth=true 也算)
const NO_KEY_DRIVERS = new Set(["ollama"]);
const NO_KEY_PROVIDERS = new Set(["ollama", "lmstudio", "vllm"]);
// 本地 baseUrl: 用户指向 localhost 即隐含"自备鉴权, 无需 key"
const LOCAL_HOST_RE =
  /^https?:\/\/(127\.0\.0\.1|localhost|\[?::1\]?|0\.0\.0\.0)(:|\/|$)/i;

// 给各 provider 的人类可读标签
const PROVIDER_LABEL = {
  anthropic: "Anthropic",
  anthropicCompat: "Anthropic-Compat",
  openai: "OpenAI",
  openaiCompat: "OpenAI-Compat",
  deepseek: "DeepSeek",
  moonshot: "Kimi",
  qwen: "Qwen",
  zhipu: "GLM",
  gemini: "Gemini",
  openrouter: "OpenRouter",
  siliconflow: "SiliconFlow",
  groq: "Groq",
  mistral: "Mistral",
  ollama: "Ollama",
  lmstudio: "LM Studio",
  vllm: "vLLM",
  lgcode: "LG-Code",
  lgcodeAnthropic: "LG-Code (Claude)",
};

class Registry {
  constructor(config) {
    this.config = config || {};
    this.providers = new Map();
    this.models = [];
    this.modelIndex = new Map();
    this.aliases = new Map(Object.entries(config.aliases || {}));
    this._build();
  }

  _build() {
    const providers = this.config.providers || {};
    for (const [name, cfg] of Object.entries(providers)) {
      if (!cfg || cfg.enabled === false) continue;
      // OpenAI-compat / custom 需要 baseUrl
      const needsBaseUrl = name === "openaiCompat";
      if (needsBaseUrl && !cfg.baseUrl) continue;
      const resolved = {
        name,
        label: cfg.label || PROVIDER_LABEL[name] || name,
        driver: cfg.driver || PROTOCOL_DRIVER[name] || "openai",
        baseUrl: (cfg.baseUrl || DEFAULT_BASE_URLS[name] || "").replace(
          /\/+$/,
          "",
        ),
        apiKey: cfg.apiKey || "",
        models: Array.isArray(cfg.models) ? cfg.models.filter(Boolean) : [],
        extra: cfg,
      };
      this.providers.set(name, resolved);
      for (const modelName of resolved.models) {
        if (modelName === "auto") continue;
        const id = `${name}/${modelName}`;
        const entry = {
          id,
          provider: name,
          model: modelName,
          label: `${resolved.label} · ${modelName}`,
          driver: resolved.driver,
        };
        this.models.push(entry);
        this.modelIndex.set(id, entry);
        // 若裸名未冲突, 允许直接命中
        if (!this.modelIndex.has(modelName))
          this.modelIndex.set(modelName, entry);
      }
    }
  }

  listProviders() {
    return Array.from(this.providers.values()).map((p) => {
      const hasKey = !!p.apiKey;
      // ready = 真能服务:
      //   - 有 key 的  (含官方云厂)
      //   - 走本地驱动 (ollama)
      //   - 预置本地名 (lmstudio/vllm)
      //   - baseUrl 指向 localhost (用户自建中继, 例 claudeRelayLocal)
      //   - 用户显式配 noAuth: true
      const noKeyNeeded =
        NO_KEY_DRIVERS.has(p.driver) ||
        NO_KEY_PROVIDERS.has(p.name) ||
        LOCAL_HOST_RE.test(p.baseUrl || "") ||
        p.extra?.noAuth === true;
      return {
        name: p.name,
        label: p.label,
        driver: p.driver,
        baseUrl: p.baseUrl,
        hasKey,
        ready: hasKey || noKeyNeeded,
        models: p.models,
      };
    });
  }

  listModels() {
    return this.models.slice();
  }

  /**
   * 解析模型名到路由目标
   * 接受:
   *   "deepseek/deepseek-chat"  → 严格匹配
   *   "deepseek-chat"           → 裸名 (首命中)
   *   "claude-opus-4-5"         → alias → 递归解析
   */
  resolve(modelName) {
    if (!modelName) return null;
    // dao_inject 注入器格式: "<provider>::<originalModel>" — 当 Cascade 走原生选择
    // 器把这个 model_name 传过来时, 我们直接用前缀的 provider 名做严格路由,
    // 把后半段作为真正发给上游的 model.
    if (modelName.includes("::")) {
      const sep = modelName.indexOf("::");
      const prov = modelName.slice(0, sep);
      const model = modelName.slice(sep + 2);
      const provider = this.providers.get(prov);
      if (provider) {
        return {
          id: `${prov}/${model}`,
          provider: prov,
          model,
          label: `${provider.label} · ${model}`,
          driver: provider.driver,
        };
      }
    }
    if (this.aliases.has(modelName)) {
      const target = this.aliases.get(modelName);
      if (target !== modelName) {
        const r = this.resolve(target);
        if (r) return r;
      }
    }
    // provider/model 形式
    if (modelName.includes("/")) {
      const exact = this.modelIndex.get(modelName);
      if (exact) return exact;
      const [prov, ...rest] = modelName.split("/");
      const model = rest.join("/");
      const provider = this.providers.get(prov);
      if (provider) {
        return {
          id: modelName,
          provider: prov,
          model,
          label: `${provider.label} · ${model}`,
          driver: provider.driver,
        };
      }
    }
    // 裸名
    if (this.modelIndex.has(modelName)) return this.modelIndex.get(modelName);
    // 前缀启发
    const guess = this._guess(modelName);
    if (guess) return guess;
    return null;
  }

  _guess(modelName) {
    const name = modelName.toLowerCase();
    const has = (n) => this.providers.has(n);
    if (name.startsWith("claude-")) {
      if (has("anthropic")) return this._syn("anthropic", modelName);
      if (has("lgcodeAnthropic"))
        return this._syn("lgcodeAnthropic", modelName);
      if (has("anthropicCompat"))
        return this._syn("anthropicCompat", modelName);
      if (has("lgcode")) return this._syn("lgcode", modelName);
      if (has("openrouter"))
        return this._syn("openrouter", `anthropic/${modelName}`);
    }
    if (
      name.startsWith("gpt-") ||
      name.startsWith("o1") ||
      name.startsWith("o3") ||
      name.startsWith("o4")
    ) {
      if (has("openai")) return this._syn("openai", modelName);
      if (has("lgcode")) return this._syn("lgcode", modelName);
      if (has("openrouter"))
        return this._syn("openrouter", `openai/${modelName}`);
    }
    if (name.startsWith("gemini-")) {
      if (has("gemini")) return this._syn("gemini", modelName);
    }
    if (name.startsWith("deepseek")) {
      if (has("deepseek")) return this._syn("deepseek", modelName);
      if (has("siliconflow")) return this._syn("siliconflow", modelName);
    }
    if (name.startsWith("kimi") || name.startsWith("moonshot")) {
      if (has("moonshot")) return this._syn("moonshot", modelName);
    }
    if (name.startsWith("qwen")) {
      if (has("qwen")) return this._syn("qwen", modelName);
    }
    if (name.startsWith("glm-")) {
      if (has("zhipu")) return this._syn("zhipu", modelName);
    }
    if (name.startsWith("llama")) {
      if (has("groq")) return this._syn("groq", modelName);
      if (has("ollama")) return this._syn("ollama", modelName);
    }
    if (name.startsWith("mistral") || name.startsWith("codestral")) {
      if (has("mistral")) return this._syn("mistral", modelName);
    }
    return null;
  }

  _syn(provider, model) {
    const p = this.providers.get(provider);
    if (!p) return null;
    return {
      id: `${provider}/${model}`,
      provider,
      model,
      label: `${p.label} · ${model}`,
      driver: p.driver,
    };
  }

  getProvider(name) {
    return this.providers.get(name);
  }
}

function loadConfig(configPath) {
  if (!configPath) {
    const candidates = [
      path.join(__dirname, "..", "配置.json"),
      path.join(__dirname, "..", "config.json"),
      path.join(__dirname, "..", "配置.example.json"),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        configPath = p;
        break;
      }
    }
  }
  if (!configPath || !fs.existsSync(configPath)) {
    return { gateway: {}, providers: {}, aliases: {} };
  }
  const raw = fs.readFileSync(configPath, "utf8");
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error(`配置 JSON 解析失败 (${configPath}): ${e.message}`);
  }
}

module.exports = {
  Registry,
  loadConfig,
  DEFAULT_BASE_URLS,
  PROTOCOL_DRIVER,
  PROVIDER_LABEL,
};
