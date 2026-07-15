// 道 · Proxy Pro 运行期反代(路由生效层) —— 把 proxy-pro 的 route 配置从「记账」变「生效」。
// ─────────────────────────────────────────────────────────────────────────────
// 本源: proxy-pro.setRoute() 只把 {官方模型 UID → 渠道/模型} 落盘, 无人消费即空转。
// 本层是唯一的路由消费者: 给定官方模型 UID, 解析出该走哪个第三方渠道/模型, 并真正发起
// OpenAI/Anthropic 兼容的 chat 请求, 返回模型输出。令「设了路由」= 请求目标真的改变。
//   · openai 类渠道 → POST {baseURL}/chat/completions (Authorization: Bearer)
//   · anthropic 类渠道 → POST {baseURL}/v1/messages (x-api-key + anthropic-version)
// apiKey 绝不出返回体(仅内部用于鉴权头)。未配路由则明确报错, 绝不伪造模型响应。
"use strict";
const http = require("http");
const https = require("https");
const { URL } = require("url");
const proxyPro = require("./proxy-pro");

// 解析官方模型 UID → { channel:<渠道记录>, model:<目标模型名> } | null(未配路由)。
function resolve(uid) {
  uid = String(uid || "").trim();
  if (!uid) return null;
  const cfg = proxyPro.load();
  const r = cfg.routes[uid];
  if (!r || !r.channel) return null;
  const ch = cfg.channels.find((c) => c.name === r.channel);
  if (!ch) return null;
  return { channel: ch, model: r.model || (ch.models || [])[0] || "" };
}

// 路由生效视图(脱敏): 每条路由能否真正投递(渠道存在+有 Key+目标模型已定)。
function routeStatus() {
  const cfg = proxyPro.load();
  return Object.keys(cfg.routes).map((uid) => {
    const r = cfg.routes[uid];
    const ch = cfg.channels.find((c) => c.name === r.channel);
    return {
      uid, channel: r.channel, model: r.model || "",
      channelExists: !!ch, hasKey: !!(ch && ch.apiKey),
      type: ch ? (ch.type || "openai") : "",
      effective: !!(ch && ch.apiKey && (r.model || (ch.models || []).length)),
    };
  });
}

function normBase(u) { return String(u || "").trim().replace(/\/+$/, ""); }

function postJson(urlStr, headers, bodyObj, timeoutMs) {
  return new Promise((resolve) => {
    let u;
    try { u = new URL(urlStr); } catch (_) { return resolve({ code: -1, json: null, text: "" }); }
    const lib = u.protocol === "http:" ? http : https;
    const data = Buffer.from(JSON.stringify(bodyObj), "utf8");
    const req = lib.request({
      protocol: u.protocol, hostname: u.hostname, port: u.port || (u.protocol === "http:" ? 80 : 443),
      path: u.pathname + u.search, method: "POST",
      headers: Object.assign({ "Content-Type": "application/json", "Content-Length": data.length, "User-Agent": "dao-desktop" }, headers),
    }, (r) => {
      let b = ""; r.on("data", (c) => { b += c; });
      r.on("end", () => { let j = null; try { j = JSON.parse(b); } catch (_) {} resolve({ code: r.statusCode || 0, json: j, text: b }); });
    });
    req.on("error", (e) => resolve({ code: 0, json: null, text: String(e.message || e) }));
    req.setTimeout(timeoutMs || 60000, () => { req.destroy(); resolve({ code: 0, json: null, text: "timeout" }); });
    req.write(data); req.end();
  });
}

// 抽取兼容响应正文文本(openai: choices[].message.content; anthropic: content[].text)。
function extractText(type, json) {
  if (!json) return "";
  if (type === "anthropic") {
    return ((json.content || []).map((b) => (b && b.text) || "").filter(Boolean).join("")) || "";
  }
  const ch = (json.choices || [])[0] || {};
  return (ch.message && ch.message.content) || ch.text || "";
}

// 真正发起路由: 给定官方模型 UID + messages, 经配置渠道投递到第三方模型。
// opts: { messages:[{role,content}], temperature?, maxTokens?, timeoutMs? }
// 返回 { ok, uid, channel, model, type, content, httpCode, error? } —— 绝不含 apiKey。
async function chat(uid, opts) {
  opts = opts || {};
  const route = resolve(uid);
  if (!route) throw new Error("模型 UID 未配置路由(先 /api/proxy/route 设定): " + uid);
  const ch = route.channel;
  if (!ch.apiKey) throw new Error("路由渠道未设 Key, 无法投递: " + ch.name);
  const model = route.model || (ch.models || [])[0];
  if (!model) throw new Error("路由未指定目标模型且渠道无已识别模型: " + ch.name);
  const messages = Array.isArray(opts.messages) ? opts.messages : [];
  if (!messages.length) throw new Error("messages 不可为空");
  const type = ch.type === "anthropic" ? "anthropic" : "openai";
  const base = normBase(ch.baseURL);
  let res;
  if (type === "anthropic") {
    const sys = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
    const conv = messages.filter((m) => m.role !== "system");
    const bodyObj = { model, max_tokens: opts.maxTokens || 1024, messages: conv };
    if (sys) bodyObj.system = sys;
    if (opts.temperature != null) bodyObj.temperature = opts.temperature;
    res = await postJson(base + "/v1/messages", { "x-api-key": ch.apiKey, "anthropic-version": "2023-06-01" }, bodyObj, opts.timeoutMs);
  } else {
    const bodyObj = { model, messages };
    if (opts.temperature != null) bodyObj.temperature = opts.temperature;
    if (opts.maxTokens != null) bodyObj.max_tokens = opts.maxTokens;
    res = await postJson(base + "/chat/completions", { "Authorization": "Bearer " + ch.apiKey }, bodyObj, opts.timeoutMs);
  }
  const content = extractText(type, res.json);
  const ok = res.code === 200 && !!content;
  return {
    ok, uid, channel: ch.name, model, type, httpCode: res.code, content,
    ...(ok ? {} : { error: (res.json && (res.json.error && (res.json.error.message || res.json.error)) ) || (res.code === 0 ? "渠道不可达/超时" : ("HTTP " + res.code)) }),
  };
}

module.exports = { resolve, routeStatus, chat, extractText, normBase };
