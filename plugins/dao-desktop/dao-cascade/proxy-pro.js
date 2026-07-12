// 道 · 插件自持 Proxy Pro(🔌 模型路由板块后端) —— 第三方模型渠道 + 模型路由, 插件自持真源。
// ─────────────────────────────────────────────────────────────────────────────
// 配置文件: ~/.dao/proxy-channels.json (mode 600) —— { channels:[{name,type,baseURL,apiKey,models[]}],
//   routes:{<官方模型 UID>:{channel,model}} }。渠道 apiKey 绝不出后端视图(只回尾 4 位指纹)。
// 道法自然·无为而无不为: 用户只填 Key, fetchModels 经 GET {baseURL}/v1/models 全量自动识别该渠道模型。
// 与 dao-proxy-pro 三面板同源(本源观照/渠道配置/模型路由), 但为纯插件自持(不依赖 :8937 反代网关)。
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const https = require("https");
const { URL } = require("url");

// 预设渠道(与 dao-proxy-pro _PRESETS 同源): n=名 t=类型 u=base URL r=拿 Key 注册页。
const PRESETS = [
  { n: "OpenRouter (聚合)", t: "openai", u: "https://openrouter.ai/api/v1", r: "https://openrouter.ai/keys" },
  { n: "AiHubMix (聚合)", t: "openai", u: "https://aihubmix.com/v1", r: "https://aihubmix.com/token" },
  { n: "DeepSeek 深度求索", t: "openai", u: "https://api.deepseek.com/v1", r: "https://platform.deepseek.com/api_keys" },
  { n: "智谱 GLM (Zhipu)", t: "openai", u: "https://open.bigmodel.cn/api/paas/v4", r: "https://open.bigmodel.cn/usercenter/apikeys" },
  { n: "Kimi 月之暗面 (Moonshot)", t: "openai", u: "https://api.moonshot.cn/v1", r: "https://platform.moonshot.cn/console/api-keys" },
  { n: "阿里云百炼 通义千问 (Bailian)", t: "openai", u: "https://dashscope.aliyuncs.com/compatible-mode/v1", r: "https://bailian.console.aliyun.com/?apiKey=1" },
  { n: "硅基流动 (SiliconFlow)", t: "openai", u: "https://api.siliconflow.cn/v1", r: "https://cloud.siliconflow.cn/account/ak" },
  { n: "OpenAI", t: "openai", u: "https://api.openai.com/v1", r: "https://platform.openai.com/api-keys" },
  { n: "Anthropic Claude", t: "anthropic", u: "https://api.anthropic.com", r: "https://console.anthropic.com/settings/keys" },
  { n: "Google Gemini", t: "openai", u: "https://generativelanguage.googleapis.com/v1beta/openai", r: "https://aistudio.google.com/apikey" },
  { n: "xAI Grok", t: "openai", u: "https://api.x.ai/v1", r: "https://console.x.ai" },
  { n: "Groq (极速)", t: "openai", u: "https://api.groq.com/openai/v1", r: "https://console.groq.com/keys" },
  { n: "Ollama (本地)", t: "openai", u: "http://localhost:11434/v1", r: "https://ollama.com/download" },
];

function cfgPath() { return process.env.DAO_PROXY_CHANNELS_FILE || path.join(os.homedir(), ".dao", "proxy-channels.json"); }

function load() {
  try {
    const j = JSON.parse(fs.readFileSync(cfgPath(), "utf8"));
    return { channels: Array.isArray(j.channels) ? j.channels : [], routes: (j && typeof j.routes === "object" && j.routes) || {} };
  } catch (_) { return { channels: [], routes: {} }; }
}

function save(cfg) {
  fs.mkdirSync(path.dirname(cfgPath()), { recursive: true });
  fs.writeFileSync(cfgPath(), JSON.stringify({ channels: cfg.channels || [], routes: cfg.routes || {} }, null, 2), { mode: 0o600 });
}

function normBase(u) { return String(u || "").trim().replace(/\/+$/, ""); }

// GET {baseURL}/models(OpenAI 兼容) 带 Bearer key → { code, ids:[modelId] }; 网络失败 code=0。
function fetchModelsRaw(baseURL, apiKey) {
  return new Promise((resolve) => {
    let u;
    try { u = new URL(normBase(baseURL) + "/models"); } catch (_) { return resolve({ code: -1, ids: [] }); }
    const lib = u.protocol === "http:" ? http : https;
    const req = lib.request({
      protocol: u.protocol, hostname: u.hostname, port: u.port || (u.protocol === "http:" ? 80 : 443),
      path: u.pathname + u.search, method: "GET",
      headers: { "Authorization": "Bearer " + apiKey, "User-Agent": "dao-desktop", "Accept": "application/json" },
    }, (r) => {
      let b = ""; r.on("data", (c) => { b += c; });
      r.on("end", () => {
        let ids = [];
        try {
          const j = JSON.parse(b);
          const arr = Array.isArray(j.data) ? j.data : (Array.isArray(j.models) ? j.models : (Array.isArray(j) ? j : []));
          ids = arr.map((m) => (typeof m === "string" ? m : (m.id || m.name || m.model || ""))).filter(Boolean);
        } catch (_) {}
        resolve({ code: r.statusCode || 0, ids });
      });
    });
    req.on("error", () => resolve({ code: 0, ids: [] }));
    req.setTimeout(12000, () => { req.destroy(); resolve({ code: 0, ids: [] }); });
    req.end();
  });
}

// 添加/更新渠道(同名覆盖·Key 轮换; 留空 Key 保留原 Key); 若在线可达则顺带识别模型。
async function addChannel(name, type, baseURL, apiKey) {
  name = String(name || "").trim();
  baseURL = normBase(baseURL);
  if (!name) throw new Error("渠道名不可为空");
  if (!baseURL) throw new Error("base URL 不可为空");
  const cfg = load();
  const ex = cfg.channels.find((c) => c.name === name);
  const key = String(apiKey || "").trim() || (ex ? ex.apiKey : "");
  let models = ex ? ex.models || [] : [];
  let verify = "pending";
  if (key) {
    const r = await fetchModelsRaw(baseURL, key);
    if (r.code === 200) { models = r.ids; verify = "ok"; }
    else if (r.code === 0) verify = "pending";
    else verify = "bad";
  }
  const rec = { name, type: type === "anthropic" ? "anthropic" : "openai", baseURL, apiKey: key, models, verify, addedAt: (ex && ex.addedAt) || new Date().toISOString(), updatedAt: new Date().toISOString() };
  if (ex) Object.assign(ex, rec); else cfg.channels.push(rec);
  save(cfg);
  return { name, models: models.length, verify, count: cfg.channels.length };
}

function removeChannel(name) {
  const cfg = load();
  const next = cfg.channels.filter((c) => c.name !== name);
  const removed = next.length !== cfg.channels.length;
  // 连带清掉指向该渠道的路由。
  for (const uid of Object.keys(cfg.routes)) if (cfg.routes[uid] && cfg.routes[uid].channel === name) delete cfg.routes[uid];
  cfg.channels = next; save(cfg);
  return { removed };
}

// 在线刷新某渠道模型目录(GET /models)。
async function refreshModels(name) {
  const cfg = load();
  const c = cfg.channels.find((x) => x.name === name);
  if (!c) throw new Error("无此渠道: " + name);
  if (!c.apiKey) throw new Error("渠道未设 Key, 无法识别模型: " + name);
  const r = await fetchModelsRaw(c.baseURL, c.apiKey);
  if (r.code === 200) { c.models = r.ids; c.verify = "ok"; }
  else if (r.code === 0) c.verify = "pending";
  else { c.verify = "bad"; }
  c.updatedAt = new Date().toISOString();
  save(cfg);
  return { name, models: c.models.length, verify: c.verify };
}

// 模型路由: 把官方模型 UID 指到某渠道的某模型(空 channel 即解除路由)。
function setRoute(uid, channel, model) {
  uid = String(uid || "").trim();
  if (!uid) throw new Error("模型 UID 不可为空");
  const cfg = load();
  if (!channel) { delete cfg.routes[uid]; }
  else {
    if (!cfg.channels.find((c) => c.name === channel)) throw new Error("无此渠道: " + channel);
    cfg.routes[uid] = { channel, model: String(model || "").trim() };
  }
  save(cfg);
  return { uid, route: cfg.routes[uid] || null };
}

// 视图(脱敏: 绝不含完整 apiKey)。
function listView() {
  const cfg = load();
  return {
    channels: cfg.channels.map((c) => ({
      name: c.name, type: c.type || "openai", baseURL: c.baseURL,
      hasKey: !!c.apiKey, keyTail: c.apiKey ? String(c.apiKey).slice(-4) : "",
      modelCount: (c.models || []).length, models: c.models || [],
      verify: c.verify || "pending", updatedAt: c.updatedAt || c.addedAt || "" })),
    routes: Object.keys(cfg.routes).map((uid) => ({ uid, channel: cfg.routes[uid].channel, model: cfg.routes[uid].model })),
  };
}

module.exports = { cfgPath, load, save, addChannel, removeChannel, refreshModels, setRoute, listView, fetchModelsRaw, PRESETS };
