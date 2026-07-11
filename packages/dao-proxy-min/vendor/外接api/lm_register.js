// lm_register.js · vscode.lm 注册 · dao-proxy-min v9.9.0 · 印 124
//
// 帛书《老子》:
//   一章 · 道可道, 非常道. 名可名, 非常名.
//   六十四章 · 合抱之木, 生于毫末. 九成之台, 作于累土.
//
// 抽自 dao-proxy-max v1.0.8 extension.js L666-1018 · 字节级移植 + namespace 中性化:
//   原: vscode.workspace.getConfiguration("omni")
//   今: 全参数化 · 由 runtime.js 传入 · 不绑 namespace
//
// 三函数 · 标准 vscode.lm Provider API · 兼容 Continue / Cline / Copilot Chat 之路:
//   ① toOpenAIMessages(vscodeMessages)               · vscode → openai 格转
//   ② makeProvider(vendor, provider, gwUrl, opts)    · 单 provider 工厂
//   ③ registerProviders(opts)                        · 三别名 fallback 注 (兼新旧 vscode)

"use strict";

const http = require("node:http");
const https = require("node:https");

// ═══════════════════════════════════════════════════════════════════
// http 工具 (内嵌 · 不依赖 extension.js)
// ═══════════════════════════════════════════════════════════════════

function httpJSON(method, url, headers, body, timeoutMs) {
  if (timeoutMs === undefined) timeoutMs = 15000;
  return new Promise((resolve, reject) => {
    let u;
    try {
      u = new URL(url);
    } catch (e) {
      return reject(e);
    }
    const mod = u.protocol === "https:" ? https : http;
    const payload = body
      ? typeof body === "string"
        ? body
        : JSON.stringify(body)
      : null;
    const opts = {
      method,
      hostname: u.hostname,
      port: u.port || (u.protocol === "https:" ? 443 : 80),
      path: u.pathname + u.search,
      headers: Object.assign(
        { "Content-Type": "application/json", Accept: "application/json" },
        headers || {},
      ),
      timeout: timeoutMs,
    };
    if (payload) opts.headers["Content-Length"] = Buffer.byteLength(payload);
    const req = mod.request(opts, (res) => {
      let buf = "";
      res.on("data", (c) => {
        buf += c;
      });
      res.on("end", () => {
        let data = null;
        try {
          data = JSON.parse(buf);
        } catch {}
        resolve({ status: res.statusCode, data, raw: buf });
      });
    });
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy(new Error("timeout"));
    });
    if (payload) req.write(payload);
    req.end();
  });
}

function httpStream(method, url, headers, body) {
  return new Promise((resolve, reject) => {
    let u;
    try {
      u = new URL(url);
    } catch (e) {
      return reject(e);
    }
    const mod = u.protocol === "https:" ? https : http;
    const payload = body
      ? typeof body === "string"
        ? body
        : JSON.stringify(body)
      : null;
    const opts = {
      method,
      hostname: u.hostname,
      port: u.port || (u.protocol === "https:" ? 443 : 80),
      path: u.pathname + u.search,
      headers: Object.assign(
        { "Content-Type": "application/json", Accept: "text/event-stream" },
        headers || {},
      ),
      timeout: 600000,
    };
    if (payload) opts.headers["Content-Length"] = Buffer.byteLength(payload);
    const req = mod.request(opts, (res) => {
      if (res.statusCode >= 400) {
        let buf = "";
        res.on("data", (c) => {
          buf += c;
        });
        res.on("end", () =>
          reject(
            new Error("HTTP " + res.statusCode + ": " + buf.slice(0, 300)),
          ),
        );
        return;
      }
      resolve(res);
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ═══════════════════════════════════════════════════════════════════
// ① toOpenAIMessages · vscode → openai 格转 (max L666-771 · 字节级)
// ═══════════════════════════════════════════════════════════════════

function toOpenAIMessages(vscode, vscodeMessages) {
  const out = [];
  for (const m of vscodeMessages) {
    let role = "user";
    if (
      (m.role === vscode.LanguageModelChatMessageRole &&
        vscode.LanguageModelChatMessageRole.System) ||
      m.role === 0 ||
      m.role === "system"
    )
      role = "system";
    else if (
      m.role ===
        (vscode.LanguageModelChatMessageRole &&
          vscode.LanguageModelChatMessageRole.Assistant) ||
      m.role === 2 ||
      m.role === "assistant"
    )
      role = "assistant";
    else role = "user";

    const parts = Array.isArray(m.content) ? m.content : [m.content];
    const texts = [];
    const toolCalls = [];
    const toolResults = [];

    for (const p of parts) {
      if (typeof p === "string") {
        texts.push(p);
        continue;
      }
      if (!p) continue;
      if (p.value !== undefined && typeof p.value === "string") {
        texts.push(p.value);
        continue;
      }
      if (p.text !== undefined && typeof p.text === "string") {
        texts.push(p.text);
        continue;
      }
      if (p.callId && p.name) {
        toolCalls.push({
          id: p.callId,
          type: "function",
          function: {
            name: p.name,
            arguments: JSON.stringify(p.input || p.parameters || {}),
          },
        });
        continue;
      }
      if (p.callId && p.content !== undefined) {
        let content;
        if (Array.isArray(p.content)) {
          content = p.content
            .map((c) =>
              c && c.value !== undefined
                ? c.value
                : c && c.text !== undefined
                  ? c.text
                  : typeof c === "string"
                    ? c
                    : JSON.stringify(c),
            )
            .join("");
        } else {
          content =
            typeof p.content === "string"
              ? p.content
              : JSON.stringify(p.content);
        }
        toolResults.push({
          role: "tool",
          tool_call_id: p.callId,
          content,
        });
        continue;
      }
      try {
        texts.push(JSON.stringify(p));
      } catch {
        texts.push(String(p));
      }
    }

    for (const tr of toolResults) out.push(tr);

    const msg = { role };
    const joinedText = texts.join("");
    if (role === "assistant") {
      if (joinedText) msg.content = joinedText;
      if (toolCalls.length) msg.tool_calls = toolCalls;
      if (!msg.content && !msg.tool_calls) msg.content = "";
      out.push(msg);
    } else {
      if (joinedText) {
        msg.content = joinedText;
        out.push(msg);
      } else if (!toolResults.length) {
        msg.content = "";
        out.push(msg);
      }
    }
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════
// ② makeProvider · 单 provider 工厂 (max L777-934 · 字节级 + 参数化)
// ═══════════════════════════════════════════════════════════════════

function makeProvider(opts) {
  const {
    vscode,
    vendor,
    provider,
    gwUrl,
    authKey = "",
    maxInputTokens = 200000,
    maxOutputTokens = 8192,
    logger = console,
  } = opts;

  const makeModelInfo = (model) => ({
    id: vendor + "/" + model,
    name: model,
    vendor,
    family: provider.name || vendor,
    version: model,
    maxInputTokens,
    maxOutputTokens,
  });

  return {
    async provideLanguageModelChatInformation() {
      return provider.models.filter((m) => m !== "auto").map(makeModelInfo);
    },
    provideLanguageModelChatModels() {
      return provider.models.filter((m) => m !== "auto").map(makeModelInfo);
    },
    async *provideLanguageModelChatResponse(
      model,
      messages,
      options,
      progress,
      token,
    ) {
      const modelName =
        typeof model === "string"
          ? model
          : (model && model.version) ||
            (model && model.name) ||
            (model && model.id && model.id.split("/").slice(1).join("/")) ||
            provider.models[0];
      const body = {
        model: vendor + "/" + modelName,
        messages: toOpenAIMessages(vscode, messages),
        stream: true,
        max_tokens: (options && options.maxTokens) || maxOutputTokens,
      };
      if (options && options.temperature !== undefined)
        body.temperature = options.temperature;
      if (options && options.stopSequences) body.stop = options.stopSequences;
      if (options && Array.isArray(options.tools) && options.tools.length) {
        body.tools = options.tools.map((t) => ({
          type: "function",
          function: {
            name: t.name,
            description: t.description,
            parameters: t.inputSchema ||
              t.parameters || { type: "object", properties: {} },
          },
        }));
      }
      try {
        logger.info(
          "外接api-lm",
          "→ " +
            vendor +
            "/" +
            modelName +
            "  messages=" +
            body.messages.length +
            "  tools=" +
            ((body.tools && body.tools.length) || 0),
        );
      } catch {}

      const headers = {};
      if (authKey) headers["Authorization"] = "Bearer " + authKey;
      const res = await httpStream(
        "POST",
        gwUrl + "/v1/chat/completions",
        headers,
        body,
      );

      let buf = "";
      const toolBuf = new Map();
      res.on("data", () => {});

      for await (const chunk of res) {
        buf += chunk.toString();
        let idx;
        while ((idx = buf.indexOf("\n\n")) !== -1) {
          const block = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          for (const line of block.split("\n")) {
            if (!line.startsWith("data:")) continue;
            const raw = line.slice(5).trim();
            if (raw === "[DONE]") continue;
            let data;
            try {
              data = JSON.parse(raw);
            } catch {
              continue;
            }
            const choice = data.choices && data.choices[0];
            const delta = (choice && choice.delta) || {};
            if (typeof delta.content === "string" && delta.content.length) {
              if (vscode.LanguageModelTextPart) {
                yield new vscode.LanguageModelTextPart(delta.content);
              } else {
                yield delta.content;
              }
            }
            if (Array.isArray(delta.tool_calls)) {
              for (const tc of delta.tool_calls) {
                const key = tc.index !== undefined ? tc.index : tc.id || 0;
                let rec = toolBuf.get(key);
                if (!rec) {
                  rec = { id: tc.id, name: "", args: "" };
                  toolBuf.set(key, rec);
                }
                if (tc.id) rec.id = tc.id;
                if (tc.function && tc.function.name)
                  rec.name += tc.function.name;
                if (tc.function && tc.function.arguments)
                  rec.args += tc.function.arguments;
              }
            }
            if (
              choice &&
              (choice.finish_reason === "tool_calls" ||
                choice.finish_reason === "stop")
            ) {
              for (const rec of toolBuf.values()) {
                if (!rec.name) continue;
                let input = {};
                try {
                  input = JSON.parse(rec.args || "{}");
                } catch {}
                if (vscode.LanguageModelToolCallPart) {
                  yield new vscode.LanguageModelToolCallPart(
                    rec.id,
                    rec.name,
                    input,
                  );
                }
              }
              toolBuf.clear();
            }
          }
        }
        if (token && token.isCancellationRequested) {
          try {
            res.destroy();
          } catch {}
          return;
        }
      }
    },
    async provideTokenCount(model, text) {
      const s = typeof text === "string" ? text : JSON.stringify(text);
      return Math.ceil(s.length / 4);
    },
  };
}

// ═══════════════════════════════════════════════════════════════════
// ③ registerProviders · 主注册函数 (max L936-1018 · 字节级 + 参数化)
// ═══════════════════════════════════════════════════════════════════

async function registerProviders(opts) {
  const {
    vscodeModule,
    gatewayUrl,
    vendorPrefix = "dao-",
    authKey = "",
    version = "9.9.0",
    logger = console,
  } = opts;

  if (!vscodeModule || !vscodeModule.lm) {
    throw new Error("vscode.lm 不可用 · 此环境无 LM API");
  }

  // 从 gateway 拉 providers
  let providers = [];
  try {
    const r = await httpJSON("GET", gatewayUrl + "/__dao/providers");
    if (r.status === 200 && r.data && r.data.providers)
      providers = r.data.providers;
  } catch (e) {
    throw new Error("拉 /__dao/providers 失: " + e.message);
  }

  const registrations = [];
  const registeredProviders = [];

  // 三别名 fallback (兼新旧 vscode)
  const api =
    vscodeModule.lm.registerLanguageModelChatProvider ||
    vscodeModule.lm.registerChatModelProvider ||
    vscodeModule.lm.registerLanguageModelProvider;
  if (!api) {
    throw new Error(
      "vscode.lm.registerLanguageModelChatProvider 不存 · 此环境 LM API 缺",
    );
  }

  for (const p of providers) {
    if (!p.models || p.models.length === 0) continue;
    const vendor = vendorPrefix + p.name.toLowerCase();
    try {
      const provider = makeProvider({
        vscode: vscodeModule,
        vendor,
        provider: p,
        gwUrl: gatewayUrl,
        authKey,
        logger,
      });
      let disposable;
      try {
        disposable = api.call(vscodeModule.lm, vendor, provider, {
          vendor,
          name: p.label || p.name,
          family: p.name,
          version,
          maxInputTokens: 200000,
          maxOutputTokens: 8192,
        });
      } catch (e1) {
        try {
          disposable = api.call(vscodeModule.lm, vendor, provider);
        } catch (e2) {
          try {
            logger.warn(
              "外接api-lm",
              "注 " + vendor + " 失: " + e1.message + " / " + e2.message,
            );
          } catch {}
          continue;
        }
      }
      registrations.push(disposable);
      registeredProviders.push({
        vendor,
        provider: p.name,
        models: p.models,
        label: p.label,
      });
      try {
        logger.info(
          "外接api-lm",
          "✓ 注 " + vendor + "  (" + p.models.length + " 模)",
        );
      } catch {}
    } catch (e) {
      try {
        logger.warn("外接api-lm", "✗ " + vendor + ": " + e.message);
      } catch {}
    }
  }

  return { registrations, providers: registeredProviders };
}

module.exports = {
  toOpenAIMessages,
  makeProvider,
  registerProviders,
};
