#!/usr/bin/env node
/**
 * revproxy.js · 模型反代 (Model Reverse Proxy) · 反者道之动
 * ──────────────────────────────────────────────────────────────────────
 * 唯一职: 把「渠道配置 / 模型路由」里已接通的模型(免费 GLM / 官方家族映射 / 任意
 *         OpenAI·Anthropic 兼容渠道)反向暴露为**标准本地端点**, 脱离 Devin Desktop,
 *         供智能家居 / 本地脚本 / 其他设备直接以标准 SDK 调用。
 *
 *   入站(本地客户端)            内部                          出站(渠道配置之真上游)
 *   ─────────────────          ─────────────                 ──────────────────────
 *   POST /v1/chat/completions  → 归一 {messages,system,...} → openai-chat  /v1/chat/completions
 *   POST /v1/messages (Claude) → 经 模型路由 解析目标渠道   → anthropic    /v1/messages
 *   GET  /v1/models            → 列出可反代模型(routed)
 *
 *   道义: 四十章「反者道之动」· 官方反代是「入站→剥提示归本源→标准出站」的反向通道;
 *         与正向 source.js(Cascade→上游)同源同法, 仅方向相反。
 *
 * 鉴权: 本地客户端持 Bearer <apiKey> (或 x-api-key)。apiKey 空 → 仅 127.0.0.1 放行。
 * 配置: ~/.codeium/dao-byok/revproxy.json
 *   { enabled, apiKey, applyInvert, exposeLan, defaultMaxTokens }
 *
 * 本模块自包含(只依赖 node 内置 + 同目录 adapters.js), 由 source.js 在 /v1/* 与
 * /origin/revproxy/* 路径上委派调用。
 */
"use strict";

const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

let _adapters = null;
function _getAdapters() {
  if (_adapters) return _adapters;
  try {
    _adapters = require(path.join(__dirname, "adapters.js"));
  } catch (e) {
    _adapters = null;
  }
  return _adapters;
}

function _byokDir() {
  const home = os.homedir();
  return home ? path.join(home, ".codeium", "dao-byok") : null;
}
function _cfgPath() {
  const d = _byokDir();
  return d ? path.join(d, "revproxy.json") : null;
}

function defaultConfig() {
  return {
    enabled: false,
    // 本地客户端鉴权 key · 空串=仅 localhost 放行 · 生成一次落盘
    apiKey: "",
    // 是否对入站 system 施「本源观照」(invertSP·剥官方着相归本源) · 默认否(透传用户提示)
    applyInvert: false,
    // 是否允许局域网(0.0.0.0)其他设备访问 · 仅状态标记, 实际监听仍由 source.js 决定
    exposeLan: false,
    defaultMaxTokens: 4096,
    // 提示词隔离(回归模型本源): 官方直通复用捕获帧时, 剥净 Cascade/DAO 系统提示词,
    //   使反代出去的即上游模型最本源 API 形态("Kimi 即 Kimi"·不冒认 Cascade)。
    //   默认开·符合「反代=回归本源」之义; 关则透传捕获帧原 SP(旧行为)。
    isolatePrompt: true,
    // 模型外接选择(用户可择): 被排除(不对外反代)之模型 uid 列表。空=全部反代(默认)。
    //   道: 万物并育, 默认全通; 用户按需「去彼」某些模型不外接。
    disabledModels: [],
    // 反代档位热切换: familyUid → 当前活跃档 modelUid (空=按默认规则·免费档优先)
    tiers: {},
    // 双路互补(道并行而不相悖): 主路(官方直通/渠道)遇限流·配额且未出首字节时,
    //   自动切「另一路」(同族已配渠道 ↔ 同族官方直通)。默认开·根治「卡限流」。
    dualPath: true,
  };
}

function loadConfig() {
  const p = _cfgPath();
  let cfg = defaultConfig();
  try {
    if (p && fs.existsSync(p)) {
      const raw = JSON.parse(fs.readFileSync(p, "utf8"));
      cfg = Object.assign(cfg, raw || {});
    }
  } catch (_) {}
  // 首次无 key → 生成稳定本地 key 落盘 (dao-local-xxxx)
  if (!cfg.apiKey) {
    cfg.apiKey = "dao-local-" + crypto.randomBytes(12).toString("hex");
    saveConfig(cfg);
  }
  return cfg;
}

function saveConfig(cfg) {
  const d = _byokDir();
  const p = _cfgPath();
  if (!d || !p) return false;
  try {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    const tmp = p + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2), "utf8");
    fs.renameSync(tmp, p);
    return true;
  } catch (_) {
    return false;
  }
}

// ── 鉴权 ────────────────────────────────────────────────────────────────
// cloudflared/反代隧道在本机把公网流量转发到 127.0.0.1, 若仅凭 socket 地址判本机,
// 公网请求会被误判为本机而绕过鉴权 —— 内网穿透之下这是致命的越权口子。
// 故: 一旦携带 Cloudflare 边缘/转发头(cf-*, x-forwarded-*, forwarded, via),
// 即视为来自公网, 不再享「本机免 key」待遇。
function _isForwarded(req) {
  const h = req.headers || {};
  return !!(
    h["cf-connecting-ip"] ||
    h["cf-ray"] ||
    h["cf-ipcountry"] ||
    h["cf-visitor"] ||
    h["x-forwarded-for"] ||
    h["x-forwarded-host"] ||
    h["forwarded"] ||
    h["via"]
  );
}
function _isLocal(req) {
  if (_isForwarded(req)) return false;
  const a = (req.socket && req.socket.remoteAddress) || "";
  return a === "127.0.0.1" || a === "::1" || a === "::ffff:127.0.0.1";
}
function _authOk(req, cfg) {
  if (!cfg.apiKey) return _isLocal(req); // 无 key → 仅本机
  const h = req.headers || {};
  const bearer = (h["authorization"] || "").replace(/^Bearer\s+/i, "").trim();
  const xkey = (h["x-api-key"] || "").trim();
  const given = bearer || xkey;
  if (!given) return false;
  // 定长比较 · 防时序侧信道
  try {
    const a = Buffer.from(given);
    const b = Buffer.from(cfg.apiKey);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch (_) {
    return given === cfg.apiKey;
  }
}

// ── 模型枚举 ──────────────────────────────────────────────────────────────
// 全量呈现「一切可反代之模型」(道:万物并育而不相害):
//   ① 模型路由表每条 route(第三方渠道/builtin-stub)·② 渠道显式 models ·
//   ③ 官方全量模型目录(_full_model_catalog 108)·④ 运行时官方家族(账号当前可见)。
//   每个模型按「配额/费档」着色: 免费/有渠道=绿 · 配额耗尽=红 · 未探测=琥珀。
//   反代方式: channel(经第三方渠道) / official(官方直通) / stub(传输自验)。

// 官方 provider 枚举 → 人类可读
const _PROVIDER_LABEL = {
  MODEL_PROVIDER_ANTHROPIC: "Anthropic",
  MODEL_PROVIDER_OPENAI: "OpenAI",
  MODEL_PROVIDER_GOOGLE: "Google",
  MODEL_PROVIDER_XAI: "xAI",
  MODEL_PROVIDER_DEEPSEEK: "DeepSeek",
  MODEL_PROVIDER_FIREWORKS: "Fireworks",
  MODEL_PROVIDER_CODEIUM: "Windsurf",
  MODEL_PROVIDER_WINDSURF: "Windsurf",
  MODEL_PROVIDER_ZHIPU: "Zhipu/GLM",
};
function _provLabel(raw) {
  if (!raw) return "Official";
  if (_PROVIDER_LABEL[raw]) return _PROVIDER_LABEL[raw];
  return String(raw).replace(/^MODEL_PROVIDER_/, "");
}

// 官方免费档判定: costTier=FREE 或 creditMultiplier=0
function _isFreeTier(costTier, mult) {
  return (
    costTier === "MODEL_COST_TIER_FREE" ||
    mult === 0 ||
    mult === null ||
    mult === undefined
  );
}

// ── 家族·档位归一 (反代档位热切换 · 朴散则为器·大制无割) ─────────────────────
//   119 档本是「家族 + 档位」: 同族多档(none/low/medium/high/xhigh/max,+thinking/+fast)
//   各为独立 modelUid。此处按家族归组,保留各档 uid,供前端档位热切换 + 外部以
//   干净家族名(如 glm-5.1)调用「当前活跃档」。与 Devin Desktop 选档同一底层逻辑。
function _slug(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9.\-]/g, "");
}
// 整 label 去家族前缀 → 余下即档位名(Medium / Low Thinking / High Fast …)
function _tierFromLabel(label, famLabel) {
  let t = String(label || "");
  if (famLabel && t.indexOf(famLabel) === 0) t = t.slice(famLabel.length).trim();
  return t || "base";
}
// 档位强弱排序(供默认择档·中档兜底): none<minimal<low<medium<high<xhigh<max
const _TIER_RANK = {
  none: 0,
  "no thinking": 0,
  minimal: 1,
  low: 2,
  medium: 3,
  high: 4,
  xhigh: 5,
  "x-high": 5,
  max: 6,
};
function _tierRank(tier) {
  const t = String(tier || "").toLowerCase();
  for (const k of Object.keys(_TIER_RANK))
    if (t.indexOf(k) >= 0) return _TIER_RANK[k];
  return 3;
}
// 从官方目录构建家族索引: {byUid: uid→meta, families: familyUid→{members:[uid]}}
function buildFamilyIndex(deps) {
  const byUid = new Map();
  const families = new Map();
  let cat = [];
  try {
    cat = (deps && deps.getModelCatalog && deps.getModelCatalog()) || [];
  } catch (_) {}
  for (const m of cat) {
    if (!m || !m.modelUid) continue;
    const mi = m.modelInfo || {};
    const fmeta = m.modelFamilyMetadata || {};
    const famUid =
      mi.modelFamilyUid || fmeta.modelFamilyLabel || "__solo__" + m.modelUid;
    const famLabel = fmeta.modelFamilyLabel || m.label || m.modelUid;
    const tier = _tierFromLabel(m.label, famLabel);
    byUid.set(m.modelUid, {
      familyUid: famUid,
      familyLabel: famLabel,
      tier,
      tierRank: _tierRank(tier),
      isDefault: !!m.isDefaultModelInFamily,
      free: _isFreeTier(m.modelCostTier || m.costTier, m.creditMultiplier),
    });
    if (!families.has(famUid))
      families.set(famUid, {
        familyUid: famUid,
        familyLabel: famLabel,
        aliasSlug: _slug(famLabel),
        provider: _provLabel(m.provider),
        members: [],
      });
    families.get(famUid).members.push(m.modelUid);
  }
  return { byUid, families };
}
// 一族的「当前活跃档」: 已选(cfg.tiers)优先, 否则 免费档→家族默认档→中档→首档
//   ("免费即默认主力" 通用规则·GLM 等免费档自动成默认)
function _familyActiveUid(fam, idx, cfg) {
  const tiers = (cfg && cfg.tiers) || {};
  const set = tiers[fam.familyUid];
  if (set && fam.members.indexOf(set) >= 0) return set;
  let freeM = null,
    defM = null,
    midM = null;
  for (const uid of fam.members) {
    const info = idx.byUid.get(uid) || {};
    if (info.free && !freeM) freeM = uid;
    if (info.isDefault && !defM) defM = uid;
    if (info.tierRank === 3 && !midM) midM = uid;
  }
  return freeM || defM || midM || fam.members[0];
}
// 家族别名/familyUid → 当前活跃档 modelUid (对外干净名解析); 已是具体档 uid 则返 null
function _resolveFamilyAlias(model, deps) {
  if (!model) return null;
  try {
    const idx = buildFamilyIndex(deps);
    if (idx.byUid.has(model)) return null; // 已是精确档位 · 不改
    const want = String(model).toLowerCase();
    const cfg = (deps && deps.cfg) || loadConfig();
    for (const [fu, fam] of idx.families) {
      if (
        fam.aliasSlug === want ||
        String(fu).toLowerCase() === want ||
        _slug(fam.familyLabel) === want
      )
        return _familyActiveUid(fam, idx, cfg);
    }
  } catch (_) {}
  return null;
}
// 模型外接选择: 判某模型(对外名/uid/家族别名)是否被用户排除(不对外反代)。
//   命中原名或其家族别名解析出的活跃档 uid, 皆视为禁用。空列表=全通。
function _isModelDisabled(cfg, model, deps) {
  const dis = (cfg && cfg.disabledModels) || [];
  if (!dis.length || !model) return false;
  if (dis.indexOf(model) >= 0) return true;
  try {
    const aliased = _resolveFamilyAlias(model, deps);
    if (aliased && dis.indexOf(aliased) >= 0) return true;
  } catch (_) {}
  return false;
}

// 家族归组摘要(供状态面 + /v1/models 别名): 每族活跃档 + 各档色/免费态
function familySummary(deps, models) {
  const idx = buildFamilyIndex(deps);
  const cfg = (deps && deps.cfg) || loadConfig();
  const mById = new Map((models || []).map((m) => [m.id, m]));
  const out = [];
  for (const [fu, fam] of idx.families) {
    const members = fam.members
      .filter((u) => mById.has(u))
      .map((u) => {
        const m = mById.get(u);
        const info = idx.byUid.get(u) || {};
        return {
          id: u,
          tier: info.tier,
          label: m.label,
          color: m.color,
          free: !!m.free,
          note: m.note,
        };
      });
    if (!members.length) continue;
    let activeUid = _familyActiveUid(fam, idx, cfg);
    if (!members.some((x) => x.id === activeUid)) activeUid = members[0].id;
    out.push({
      familyUid: fu,
      familyLabel: fam.familyLabel,
      aliasSlug: fam.aliasSlug,
      provider: fam.provider,
      activeUid,
      multi: members.length > 1,
      members,
    });
  }
  return out;
}

// 模块级·官方付费配额观测态: "unknown" | "ok" | "exhausted"
//   实际官方反代调用命中配额错误 → exhausted; 成功 → ok; 供面板红/绿如实着色。
let _premiumQuota = "unknown";
function setPremiumQuota(s) {
  if (s === "ok" || s === "exhausted" || s === "unknown") _premiumQuota = s;
}
function getPremiumQuota() {
  return _premiumQuota;
}

// 给一个模型条目判定 {reverse, color, status, note}
function _classify(entry, deps) {
  // 显式 stub
  if (entry.reverse === "stub")
    return { color: "green", status: "stub", note: "传输自验" };
  // 已配第三方渠道(模型路由/provider) → 经渠道反代·不受官方配额限
  if (entry.routed)
    return {
      color: "green",
      status: "channel",
      note: "经渠道 " + (entry.provider || ""),
    };
  // 官方免费档 → 恒可反代
  if (entry.free)
    return { color: "green", status: "free", note: "免费 · 官方直通" };
  // 官方付费档 → 依配额观测
  const q =
    (deps && typeof deps.premiumQuota === "string"
      ? deps.premiumQuota
      : null) || _premiumQuota;
  if (q === "ok")
    return { color: "green", status: "premium", note: "有配额 · 官方直通" };
  if (q === "exhausted")
    return { color: "red", status: "exhausted", note: "配额耗尽 · 待重置" };
  return { color: "amber", status: "premium", note: "付费档 · 配额未探测" };
}

function listModels(deps) {
  deps = deps || {};
  const out = [];
  const byId = new Map();
  const cfg = (deps.getEaConfig && deps.getEaConfig()) || {};
  const routes = (cfg.daoRoutes && cfg.daoRoutes.routes) || {};
  const providers = cfg.providers || {};
  const add = (id, fields) => {
    if (!id) return null;
    let e = byId.get(id);
    if (e) {
      Object.assign(e, fields || {});
      return e;
    }
    e = Object.assign(
      { id, object: "model", created: 0, owned_by: "dao-revproxy" },
      fields || {},
    );
    byId.set(id, e);
    out.push(e);
    return e;
  };

  // ③ 官方全量目录(最广底·先铺) → 免费/付费档着色
  let catalog = [];
  try {
    catalog = (deps.getModelCatalog && deps.getModelCatalog()) || [];
  } catch (_) {}
  for (const m of catalog) {
    if (!m || !m.modelUid) continue;
    const mult = m.creditMultiplier;
    const costTier = m.modelCostTier || m.costTier || "";
    add(m.modelUid, {
      owned_by: _provLabel(m.provider),
      label: m.label || m.modelUid,
      provider: _provLabel(m.provider),
      providerRaw: m.provider || "",
      creditMultiplier: typeof mult === "number" ? mult : null,
      costTier,
      free: _isFreeTier(costTier, mult),
      official: true,
      reverse: "official",
      routed: false,
    });
  }

  // ④ 运行时官方家族(账号当前实见) → 标记 availableNow
  let fams = [];
  try {
    fams = (deps.getOfficialFamilies && deps.getOfficialFamilies()) || [];
  } catch (_) {}
  for (const f of fams) {
    const uid = f && (f.modelUid || f.uid || f.model);
    if (!uid) continue;
    const e = add(uid, {
      official: true,
      reverse: "official",
      availableNow: true,
    });
    if (e && !e.label && f.label) e.label = f.label;
    if (e) e.availableNow = true;
  }

  // ① 模型路由表(第三方渠道/stub) → 覆盖为 channel/stub·绿
  for (const [uid, r] of Object.entries(routes)) {
    const prov = (r && r.provider) || "routed";
    const isStub = prov === "builtin-stub";
    add(uid, {
      owned_by: prov,
      provider: prov,
      routed: !isStub,
      reverse: isStub ? "stub" : "channel",
      dao_route: { provider: prov, model: r && r.model },
    });
  }

  // ② provider 显式 models → channel·绿
  for (const [name, p] of Object.entries(providers)) {
    const ms = (p && p.models) || [];
    for (const m of ms)
      add(m, { owned_by: name, provider: name, routed: true, reverse: "channel" });
  }

  // 着色 + 计数 + 外接开关标记(exposed: 是否对外反代 · false=用户已排除)
  //   注: 此处 cfg 为 EaConfig(渠道/路由), 反代配置须取 deps.cfg / loadConfig()。
  const _rpCfg = (deps && deps.cfg) || loadConfig();
  const _cfgDis = (_rpCfg && _rpCfg.disabledModels) || [];
  for (const e of out) {
    const c = _classify(e, deps);
    e.color = c.color;
    e.status = c.status;
    e.note = c.note;
    e.exposed = _cfgDis.indexOf(e.id) < 0;
  }
  // 家族·档位标注 (供前端按家族归组 + 档位热切换 · 每档保留独立配额色)
  try {
    const idx = buildFamilyIndex(deps);
    const cfg = (deps && deps.cfg) || loadConfig();
    const active = {};
    for (const [fu, fam] of idx.families)
      active[fu] = _familyActiveUid(fam, idx, cfg);
    for (const e of out) {
      const info = idx.byUid.get(e.id);
      if (info) {
        e.familyUid = info.familyUid;
        e.familyLabel = info.familyLabel;
        e.tier = info.tier;
        e.activeTier = active[info.familyUid] === e.id;
      } else {
        // 渠道/路由独有 uid → 自成一族(单档)
        e.familyUid = "__solo__" + e.id;
        e.familyLabel = e.label || e.id;
        e.tier = "base";
        e.activeTier = true;
      }
    }
  } catch (_) {}
  return out;
}

function modelStats(models) {
  const s = { total: models.length, green: 0, red: 0, amber: 0, free: 0, channel: 0, official: 0, exposed: 0, disabled: 0 };
  for (const m of models) {
    if (m.color === "green") s.green++;
    else if (m.color === "red") s.red++;
    else if (m.color === "amber") s.amber++;
    if (m.status === "free") s.free++;
    if (m.reverse === "channel" || m.reverse === "stub") s.channel++;
    if (m.reverse === "official") s.official++;
    if (m.exposed === false) s.disabled++;
    else s.exposed++;
  }
  return s;
}

// ── 入站归一 ──────────────────────────────────────────────────────────────
// 把 OpenAI / Anthropic 请求体归一为内部统一结构。
function normalizeInbound(kind, body) {
  body = body || {};
  let system = "";
  let messages = [];
  if (kind === "anthropic") {
    if (typeof body.system === "string") system = body.system;
    else if (Array.isArray(body.system))
      system = body.system
        .map((b) => (b && typeof b.text === "string" ? b.text : ""))
        .join("");
    messages = (body.messages || []).map((m) => ({
      role: m.role,
      content: _flattenContent(m.content),
    }));
  } else {
    // openai-chat
    for (const m of body.messages || []) {
      if (m.role === "system") {
        system += (system ? "\n" : "") + _flattenContent(m.content);
      } else {
        messages.push({ role: m.role, content: _flattenContent(m.content) });
      }
    }
  }
  return {
    system,
    messages,
    model: body.model || "",
    stream: body.stream === true,
    tools: body.tools || null,
    maxTokens: body.max_tokens || body.maxOutputTokens || 0,
    temperature:
      typeof body.temperature === "number" ? body.temperature : undefined,
  };
}

function _flattenContent(c) {
  if (typeof c === "string") return c;
  if (Array.isArray(c))
    return c
      .map((b) => {
        if (typeof b === "string") return b;
        if (b && typeof b.text === "string") return b.text;
        return "";
      })
      .join("");
  return "";
}

// model 是否属官方目录/家族 → {free,label,provider} 或 null
function _officialInfo(model, deps) {
  if (!model || !deps) return null;
  try {
    const cat = (deps.getModelCatalog && deps.getModelCatalog()) || [];
    for (const m of cat) {
      if (m && m.modelUid === model)
        return {
          free: _isFreeTier(m.modelCostTier || m.costTier, m.creditMultiplier),
          label: m.label || model,
          provider: _provLabel(m.provider),
        };
    }
  } catch (_) {}
  try {
    const fams = (deps.getOfficialFamilies && deps.getOfficialFamilies()) || [];
    for (const f of fams) {
      const uid = f && (f.modelUid || f.uid || f.model);
      if (uid === model)
        return { free: !!f.free, label: f.label || model, provider: "Official" };
    }
  } catch (_) {}
  return null;
}

// ── 路由解析 ──────────────────────────────────────────────────────────────
// model(对外名/uid) → 真上游 {provName, provCfg, upstreamModel, proto}
function resolveTarget(model, deps) {
  const cfg = (deps.getEaConfig && deps.getEaConfig()) || {};
  const routes = (cfg.daoRoutes && cfg.daoRoutes.routes) || {};
  const providers = cfg.providers || {};
  // 家族别名(如 glm-5.1) / familyUid → 当前活跃档 modelUid (档位热切换之对外干净名)
  const aliased = _resolveFamilyAlias(model, deps);
  if (aliased) model = aliased;
  let route = routes[model];
  // 经 router.resolveRoute 解析同族档位(与正向推理同一张表)
  if (!route && deps.resolveRoute) {
    try {
      const r = deps.resolveRoute(model);
      if (r && r.route) route = r.route;
    } catch (_) {}
  }
  // 直接以 provider 名作 model 前缀: "providerName/realModel"
  if (!route && model.indexOf("/") > 0) {
    const [pn, ...rest] = model.split("/");
    if (providers[pn]) route = { provider: pn, model: rest.join("/") };
  }
  // 无第三方渠道 → 官方直通(若 model 属官方目录/家族): 复用上游官方推理链
  if (!route) {
    const info = _officialInfo(model, deps);
    if (info) {
      return {
        official: true,
        upstreamModel: model,
        free: info.free,
        label: info.label,
        provider: info.provider,
      };
    }
    return null;
  }
  const provName = route.provider;
  if (provName === "builtin-stub") {
    return { provName, builtin: true, route, upstreamModel: route.model };
  }
  const provCfg = providers[provName];
  if (!provCfg) return null;
  const proto =
    provCfg.protocol ||
    (provCfg.type === "anthropic" ? "anthropic" : "") ||
    (/\/v1\/messages/i.test(provCfg.completionPath || "") ? "anthropic" : "") ||
    (String(route.model || "")
      .toLowerCase()
      .startsWith("claude")
      ? "anthropic"
      : "") ||
    "openai-chat";
  return {
    provName,
    provCfg,
    proto,
    route,
    upstreamModel: route.model || model,
  };
}

// ── 双路互补 (道并行而不相悖·外接↔反代) ────────────────────────────────────
// 上游错误是否「限流/配额」类 → 可在未出首字节时切另一路(而非直接报错给客户端)。
function _isRetryableErr(msg) {
  return /rate.?limit|resets in|too many requests|\b429\b|\b402\b|quota|exhaust|配额|governor|insufficient_quota|precondition|overloaded|capacity/i.test(
    String(msg || ""),
  );
}
// 给主目标求「另一路」备援目标: 官方直通 ↔ 同族已配第三方渠道。无备路则 null。
function _altTarget(primary, model, deps) {
  try {
    if (!primary) return null;
    const idx = buildFamilyIndex(deps);
    const primUid = primary.upstreamModel || model;
    const pinfo = idx.byUid.get(primUid);
    const fam = pinfo && idx.families.get(pinfo.familyUid);
    if (primary.official) {
      // 官方直通遇限流 → 找同族已配渠道(外接)接手
      const cfg = (deps.getEaConfig && deps.getEaConfig()) || {};
      const routes = (cfg.daoRoutes && cfg.daoRoutes.routes) || {};
      const cands = [];
      if (fam) {
        for (const uid of fam.members) cands.push(uid);
        if (fam.aliasSlug) cands.push(fam.aliasSlug);
        if (fam.familyLabel) cands.push(fam.familyLabel);
      }
      cands.push(model);
      for (const key of cands) {
        if (key && routes[key]) {
          const t = resolveTarget(key, deps);
          if (t && !t.official && !t.builtin) return t;
        }
      }
      return null;
    }
    // 第三方渠道遇限流 → 若模型属官方目录/家族, 以同族官方直通接手(优先免费档)
    let offUid = null;
    if (fam) {
      for (const uid of fam.members) {
        const mi = idx.byUid.get(uid);
        if (mi && mi.free) {
          offUid = uid;
          break;
        }
      }
      if (!offUid)
        offUid = _familyActiveUid(fam, idx, (deps && deps.cfg) || loadConfig());
    } else if (_officialInfo(model, deps)) {
      offUid = model;
    }
    if (offUid) {
      const info = _officialInfo(offUid, deps);
      if (info)
        return {
          official: true,
          upstreamModel: offUid,
          free: info.free,
          label: info.label,
          provider: info.provider,
        };
    }
    return null;
  } catch (_) {
    return null;
  }
}
// 解析出「主路 + 备路」候选列表(双路开启时含备路)。
function resolveTargets(model, deps) {
  const primary = resolveTarget(model, deps);
  if (!primary) return [];
  const cfg = (deps && deps.cfg) || loadConfig();
  if (cfg.dualPath === false) return [primary];
  const alt = _altTarget(primary, model, deps);
  return alt ? [primary, alt] : [primary];
}

// ── 上游调用(流式) ─────────────────────────────────────────────────────────
// 以目标渠道真协议发请求, 边收边把 SSE 行解析成统一 delta, 回调 onDelta。
function callUpstream(target, norm, deps, handlers) {
  const { provCfg, proto, upstreamModel } = target;
  const isAnthropic = proto === "anthropic";
  const baseUrl = (provCfg.baseUrl || "").replace(/\/$/, "");
  const completionPath =
    provCfg.completionPath ||
    (isAnthropic ? "/v1/messages" : "/v1/chat/completions");
  let url;
  try {
    url = new URL(baseUrl + completionPath);
  } catch (e) {
    handlers.onError(new Error("bad provider baseUrl: " + baseUrl));
    return;
  }
  const isHttps = url.protocol === "https:";
  const mod = isHttps ? https : http;

  // 出站请求体 (本源观照: applyInvert 时对 system 施 invertSP)
  let sys = norm.system || "";
  if (deps.cfg && deps.cfg.applyInvert && sys && deps.invertSP) {
    try {
      sys = deps.invertSP(sys) || sys;
    } catch (_) {}
  }
  const maxTokens =
    norm.maxTokens || (deps.cfg && deps.cfg.defaultMaxTokens) || 4096;

  let payloadObj;
  if (isAnthropic) {
    payloadObj = {
      model: upstreamModel,
      max_tokens: maxTokens,
      messages: norm.messages.map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      })),
      stream: true,
    };
    if (sys) payloadObj.system = sys;
  } else {
    const oaMsgs = [];
    if (sys) oaMsgs.push({ role: "system", content: sys });
    for (const m of norm.messages) oaMsgs.push(m);
    payloadObj = {
      model: upstreamModel,
      messages: oaMsgs,
      max_tokens: maxTokens,
      stream: true,
    };
    if (typeof norm.temperature === "number")
      payloadObj.temperature = norm.temperature;
  }
  const payload = JSON.stringify(payloadObj);

  const headers = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
    "Content-Length": String(Buffer.byteLength(payload)),
  };
  if (provCfg.apiKey) {
    if (isAnthropic) {
      headers["x-api-key"] = provCfg.apiKey;
      headers["anthropic-version"] = "2023-06-01";
    } else {
      headers["Authorization"] = "Bearer " + provCfg.apiKey;
    }
  }
  const agent = deps.getProxyAgent ? deps.getProxyAgent(isHttps) : null;
  const adp = _getAdapters();
  const adapter = adp
    ? isAnthropic
      ? adp.AnthropicAdapter
      : adp.OpenAIChatAdapter
    : null;

  const reqOpts = {
    hostname: url.hostname,
    port: parseInt(url.port || (isHttps ? "443" : "80"), 10),
    path: url.pathname + (url.search || ""),
    method: "POST",
    headers,
    timeout: 120000,
    rejectUnauthorized: false,
  };
  if (agent) reqOpts.agent = agent;

  const upReq = mod.request(reqOpts, (upRes) => {
    if (upRes.statusCode >= 400) {
      let errBody = "";
      upRes.on("data", (c) => (errBody += c));
      upRes.on("end", () =>
        handlers.onError(
          new Error("upstream " + upRes.statusCode + ": " + errBody.slice(0, 400)),
          upRes.statusCode,
        ),
      );
      return;
    }
    handlers.onOpen && handlers.onOpen();
    let buf = "";
    upRes.setEncoding("utf8");
    upRes.on("data", (chunk) => {
      buf += chunk;
      let idx;
      while ((idx = buf.indexOf("\n")) >= 0) {
        let line = buf.slice(0, idx);
        buf = buf.slice(idx + 1);
        line = line.replace(/\r$/, "").trim();
        if (!line || !line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") continue;
        if (!adapter) continue;
        let parsed;
        try {
          parsed = adapter.parseSSELine(data);
        } catch (_) {
          continue;
        }
        if (!parsed) continue;
        if (parsed.type === "delta") handlers.onDelta(parsed);
        else if (parsed.usage) handlers.onDelta({ usage: parsed.usage });
      }
    });
    upRes.on("end", () => handlers.onDone());
    upRes.on("error", (e) => handlers.onError(e));
  });
  upReq.on("error", (e) => handlers.onError(e));
  upReq.on("timeout", () => {
    upReq.destroy();
    handlers.onError(new Error("upstream timeout (120s)"));
  });
  upReq.end(payload);
}

// ── 出站(回客户端)编码 ───────────────────────────────────────────────────
function _genId(prefix) {
  return (prefix || "chatcmpl") + "-" + crypto.randomBytes(12).toString("hex");
}

function _emitOpenAIStream(res, model, gen) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  const id = _genId("chatcmpl");
  const created = Math.floor(Date.now() / 1000);
  const base = { id, object: "chat.completion.chunk", created, model };
  const send = (delta, finish) => {
    res.write(
      "data: " +
        JSON.stringify(
          Object.assign({}, base, {
            choices: [
              { index: 0, delta: delta || {}, finish_reason: finish || null },
            ],
          }),
        ) +
        "\n\n",
    );
  };
  send({ role: "assistant", content: "" });
  let finishReason = "stop";
  gen({
    onText: (t) => send({ content: t }),
    onThinking: (t) => send({ reasoning_content: t }),
    onFinish: (fr) => {
      if (fr) finishReason = fr;
    },
    onEnd: () => {
      send({}, finishReason);
      res.write("data: [DONE]\n\n");
      res.end();
    },
    onError: (msg) => {
      // SSE 头已以 200 下发, 无法再改状态码 → 以「错误对象」如实下发,
      // 绝不再把上游错误伪装成 assistant content(否则客户端把报错当正文,
      // 即长链路下"对话突然中断却收到一段奇怪文字"的根因)。
      const c = _classifyUpstreamError(msg);
      const errObj = { message: String(msg), type: c.type, code: c.code };
      if (c.retryAfter) errObj.retry_after = c.retryAfter;
      res.write("data: " + JSON.stringify({ error: errObj }) + "\n\n");
      res.write("data: [DONE]\n\n");
      res.end();
    },
  });
}

function _emitOpenAIUnary(res, model, gen) {
  const id = _genId("chatcmpl");
  const created = Math.floor(Date.now() / 1000);
  let text = "";
  let reasoning = "";
  let finishReason = "stop";
  let usage = null;
  gen({
    onText: (t) => (text += t),
    onThinking: (t) => (reasoning += t),
    onFinish: (fr) => {
      if (fr) finishReason = fr;
    },
    onUsage: (u) => (usage = u),
    onEnd: () => {
      const msg = { role: "assistant", content: text };
      if (reasoning) msg.reasoning_content = reasoning;
      const body = {
        id,
        object: "chat.completion",
        created,
        model,
        choices: [{ index: 0, message: msg, finish_reason: finishReason }],
        usage: usage
          ? {
              prompt_tokens: usage.input || 0,
              completion_tokens: usage.output || 0,
              total_tokens: (usage.input || 0) + (usage.output || 0),
            }
          : undefined,
      };
      _json(res, 200, body);
    },
    onError: (msg) => {
      const c = _classifyUpstreamError(msg);
      _json(
        res,
        c.status,
        { error: { message: String(msg), type: c.type, code: c.code } },
        c.retryAfter ? { "Retry-After": String(c.retryAfter) } : undefined,
      );
    },
  });
}

function _emitAnthropicStream(res, model, gen) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  const id = _genId("msg");
  const ev = (type, obj) =>
    res.write("event: " + type + "\ndata: " + JSON.stringify(obj) + "\n\n");
  ev("message_start", {
    type: "message_start",
    message: {
      id,
      type: "message",
      role: "assistant",
      model,
      content: [],
      stop_reason: null,
      usage: { input_tokens: 0, output_tokens: 0 },
    },
  });
  ev("content_block_start", {
    type: "content_block_start",
    index: 0,
    content_block: { type: "text", text: "" },
  });
  gen({
    onText: (t) =>
      ev("content_block_delta", {
        type: "content_block_delta",
        index: 0,
        delta: { type: "text_delta", text: t },
      }),
    onThinking: () => {},
    onFinish: () => {},
    onEnd: () => {
      ev("content_block_stop", { type: "content_block_stop", index: 0 });
      ev("message_delta", {
        type: "message_delta",
        delta: { stop_reason: "end_turn", stop_sequence: null },
        usage: { output_tokens: 0 },
      });
      ev("message_stop", { type: "message_stop" });
      res.end();
    },
    onError: (msg) => {
      // Anthropic SSE 错误以 `event: error` 如实下发, 不混入 text_delta 正文。
      const c = _classifyUpstreamError(msg);
      ev("error", {
        type: "error",
        error: {
          type: c.status === 429 ? "rate_limit_error" : "api_error",
          message: String(msg),
        },
      });
      res.end();
    },
  });
}

function _emitAnthropicUnary(res, model, gen) {
  const id = _genId("msg");
  let text = "";
  let usage = null;
  gen({
    onText: (t) => (text += t),
    onThinking: () => {},
    onFinish: () => {},
    onUsage: (u) => (usage = u),
    onEnd: () => {
      _json(res, 200, {
        id,
        type: "message",
        role: "assistant",
        model,
        content: [{ type: "text", text }],
        stop_reason: "end_turn",
        stop_sequence: null,
        usage: {
          input_tokens: (usage && usage.input) || 0,
          output_tokens: (usage && usage.output) || 0,
        },
      });
    },
    onError: (msg) => {
      const c = _classifyUpstreamError(msg);
      _json(
        res,
        c.status,
        {
          type: "error",
          error: {
            type: c.status === 429 ? "rate_limit_error" : "api_error",
            message: String(msg),
          },
        },
        c.retryAfter ? { "Retry-After": String(c.retryAfter) } : undefined,
      );
    },
  });
}

function _json(res, code, obj, extraHeaders) {
  const s = JSON.stringify(obj);
  res.writeHead(
    code,
    Object.assign(
      {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": String(Buffer.byteLength(s)),
      },
      extraHeaders || {},
    ),
  );
  res.end(s);
}

// 上游错误归类: 把官方上游错误如实映射为正确的 HTTP 语义,
// 杜绝「速率限制/配额耗尽」被笼统当成 502(网关错误)误导客户端重试。
//   速率限制(官方按模型限频, 形如 "Reached message rate limit ... Resets in: 1h30m0s")
//     → 429 Too Many Requests + Retry-After(秒); 客户端据此退避而非狂重试。
//   配额耗尽 → 429 insufficient_quota。
//   其余上游故障 → 502 upstream_error。
function _classifyUpstreamError(msg) {
  const s = String(msg || "");
  const rateLimited = /rate limit|Resets in|too many requests|\b429\b/i.test(s);
  const quota = /quota|exhaust|governor|precondition|insufficient|Authentication Fails/i.test(
    s,
  );
  if (rateLimited || quota) {
    let retryAfter = 0;
    const m = s.match(/Resets in:\s*(?:(\d+)\s*h)?(?:(\d+)\s*m)?(?:(\d+)\s*s)?/i);
    if (m)
      retryAfter =
        parseInt(m[1] || 0, 10) * 3600 +
        parseInt(m[2] || 0, 10) * 60 +
        parseInt(m[3] || 0, 10);
    return {
      status: 429,
      type: "rate_limit_error",
      code: rateLimited ? "rate_limit_exceeded" : "insufficient_quota",
      retryAfter,
    };
  }
  return { status: 502, type: "upstream_error", code: "upstream_error", retryAfter: 0 };
}

function _html(res, code, html) {
  const s = String(html);
  res.writeHead(code, {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Length": String(Buffer.byteLength(s)),
    "Cache-Control": "no-cache",
  });
  res.end(s);
}

// ── 网页对话台 (web chat console) · 同源单页 ──────────────────────────────
//   反者道之动: 把「调用一切反代模型 + 管理(档位热切) + AI 测试验证」收束为一张
//   自包含网页, 与 /v1 同源。本机直开或经内网穿透远程任意环境浏览器皆可达 ——
//   页面静态零鉴权, 真正的模型调用仍由 /v1 的 Bearer key 把关。
let _consoleHtmlCache = null;
function consoleHtml() {
  if (_consoleHtmlCache != null) return _consoleHtmlCache;
  try {
    _consoleHtmlCache = fs.readFileSync(
      path.join(__dirname, "revproxy_console.html"),
      "utf8",
    );
  } catch (e) {
    _consoleHtmlCache =
      '<!DOCTYPE html><meta charset="utf-8"><title>dao 反代对话台</title>' +
      '<body style="font:14px sans-serif;background:#0e1116;color:#d6dde7;padding:24px">' +
      "网页对话台资源缺失 (revproxy_console.html 未随插件打包)。</body>";
  }
  return _consoleHtmlCache;
}

function _readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        const s = Buffer.concat(chunks).toString("utf8");
        resolve(s ? JSON.parse(s) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

// 单目标分派: 把一个 target 的上游流适配到 sink。
function _dispatch(target, norm, deps, sink) {
  if (target.builtin) {
    // builtin-stub: 固定返回 · 验证通路
    sink.onText &&
      sink.onText("道可道也 非恒道也 · 模型反代传输层得一 · stub 正常");
    sink.onUsage && sink.onUsage({ input: 10, output: 20 });
    sink.onEnd && sink.onEnd();
    return;
  }
  if (target.official) {
    // 官方直通: 复用宿主 source.js 官方推理链(捕帧复用 GetChatMessage)
    if (!deps.officialChat) {
      sink.onError &&
        sink.onError(
          "官方直通未就绪 · 需宿主提供 officialChat(预热一次官方对话以捕获帧)",
        );
      return;
    }
    Promise.resolve()
      .then(() => deps.officialChat(target, norm, sink))
      .then((r) => {
        // officialChat 自行调 sink.onText/onEnd; 若返回配额态则同步着色
        if (r && r.quota) setPremiumQuota(r.quota);
      })
      .catch((e) => {
        const msg = String((e && e.message) || e);
        if (/quota|exhaust|配额|governor|Authentication Fails/i.test(msg))
          setPremiumQuota("exhausted");
        sink.onError && sink.onError(msg);
      });
    return;
  }
  callUpstream(target, norm, deps, {
    onOpen: () => {},
    onDelta: (d) => {
      if (d.content && sink.onText) sink.onText(d.content);
      if (d.thinking && sink.onThinking) sink.onThinking(d.thinking);
      if (d.finishReason && sink.onFinish) sink.onFinish(d.finishReason);
      if (d.usage && sink.onUsage) sink.onUsage(d.usage);
    },
    onDone: () => sink.onEnd && sink.onEnd(),
    onError: (e) => sink.onError && sink.onError(String((e && e.message) || e)),
  });
}

// 把统一上游 delta 适配到客户端发射器的 generator。
// candidates: [主路, 备路?] — 主路遇限流/配额且「未出首字节」时自动切备路(双路互补)。
function _bridge(candidates, norm, deps) {
  const list = (Array.isArray(candidates) ? candidates : [candidates]).filter(
    Boolean,
  );
  const log = (deps && deps.log) || (() => {});
  return (sink) => {
    if (!list.length) {
      sink.onError && sink.onError("无可用反代目标");
      return;
    }
    let emitted = false; // 是否已向客户端下发内容(出首字节后不可再切路)
    const run = (i) => {
      const target = list[i];
      const hasNext = i + 1 < list.length;
      // 包装 sink: 记录是否出字节; 未出首字节遇限流/配额且有备路 → 切备路(不报错)
      _dispatch(target, norm, deps, {
        onOpen: sink.onOpen,
        onText: (t) => {
          emitted = true;
          sink.onText && sink.onText(t);
        },
        onThinking: (t) => {
          emitted = true;
          sink.onThinking && sink.onThinking(t);
        },
        onFinish: (f) => sink.onFinish && sink.onFinish(f),
        onUsage: (u) => sink.onUsage && sink.onUsage(u),
        onEnd: () => sink.onEnd && sink.onEnd(),
        onError: (e) => {
          const msg = String((e && e.message) || e);
          if (!emitted && hasNext && _isRetryableErr(msg)) {
            log(
              "[revproxy] 双路互补: 主路遇限流/配额 → 切备路 (" +
                msg.slice(0, 80) +
                ")",
            );
            run(i + 1);
            return;
          }
          sink.onError && sink.onError(msg);
        },
      });
    };
    run(0);
  };
}

// ── 主入口: 由 source.js 在 /v1/* 与 /origin/revproxy/* 委派 ──────────────────
// 返回 true 表示已处理。deps: { getEaConfig, getAvailableModels, resolveRoute,
//   invertSP, getProxyAgent, log, version }
async function handle(req, res, u, deps) {
  const p = u.pathname;
  if (!p.startsWith("/v1/") && !p.startsWith("/origin/revproxy")) return false;

  const cfg = loadConfig();
  deps = deps || {};
  deps.cfg = cfg;
  const log = deps.log || (() => {});

  // ── 网页对话台 (远程任意环境浏览器直开 · 同源单页·零鉴权) ──────────────
  if (
    req.method === "GET" &&
    (p === "/origin/revproxy/console" ||
      p === "/origin/revproxy/chat" ||
      p === "/origin/revproxy" ||
      p === "/origin/revproxy/")
  ) {
    _html(res, 200, consoleHtml());
    return true;
  }

  // ── 控制面 (webview 用·本机) ──────────────────────────────────
  if (p === "/origin/revproxy/status" && req.method === "GET") {
    const models = listModels(deps);
    _json(res, 200, {
      ok: true,
      version: deps.version || "",
      enabled: cfg.enabled,
      applyInvert: cfg.applyInvert,
      isolatePrompt: cfg.isolatePrompt !== false,
      disabledModels: cfg.disabledModels || [],
      exposeLan: cfg.exposeLan,
      dualPath: cfg.dualPath !== false,
      hasKey: !!cfg.apiKey,
      apiKey: _isLocal(req) ? cfg.apiKey : undefined,
      port: deps.port || 0,
      endpoint: deps.port ? "http://127.0.0.1:" + deps.port + "/v1" : "",
      premiumQuota:
        (deps && typeof deps.premiumQuota === "string"
          ? deps.premiumQuota
          : null) || _premiumQuota,
      model_count: models.length,
      stats: modelStats(models),
      models,
      families: familySummary(deps, models),
      tiers: cfg.tiers || {},
    });
    return true;
  }
  // 档位热切换: 设某家族当前活跃档 (热生效·无需重启) ──
  if (p === "/origin/revproxy/tier" && req.method === "POST") {
    // 远程管理: 本机直放行; 远程需持有效 Bearer key (与 /v1 同一把关)。
    if (!_isLocal(req) && !_authOk(req, cfg)) {
      _json(res, 403, {
        ok: false,
        error: "需本机或有效 Bearer key (远程管理)",
      });
      return true;
    }
    let body = {};
    try {
      body = await _readBody(req);
    } catch (_) {}
    const fu = body.familyUid;
    const mu = body.modelUid;
    if (!fu || !mu) {
      _json(res, 400, { ok: false, error: "familyUid + modelUid required" });
      return true;
    }
    const next = Object.assign(loadConfig(), {});
    next.tiers = Object.assign({}, next.tiers || {});
    next.tiers[fu] = mu;
    saveConfig(next);
    _json(res, 200, { ok: true, tiers: next.tiers });
    return true;
  }
  // 模型外接选择: 原子切换某(些)模型是否对外反代 (热生效·无需重启) ──
  //   body: {modelUid|modelUids:[...], exposed:bool} 精确开关 ·
  //         {setAll:"on"|"off"} 批量全选/全不选(off 时排除当前全部枚举模型)。
  if (p === "/origin/revproxy/models" && req.method === "POST") {
    if (!_isLocal(req) && !_authOk(req, cfg)) {
      _json(res, 403, { ok: false, error: "需本机或有效 Bearer key (远程管理)" });
      return true;
    }
    let body = {};
    try {
      body = await _readBody(req);
    } catch (_) {}
    const next = Object.assign(loadConfig(), {});
    let dis = Array.isArray(next.disabledModels)
      ? next.disabledModels.slice()
      : [];
    const disSet = new Set(dis);
    if (body.setAll === "on") {
      disSet.clear(); // 全选反代 · 万物并育
    } else if (body.setAll === "off") {
      for (const m of listModels(deps)) disSet.add(m.id); // 全不外接
    } else {
      const ids = Array.isArray(body.modelUids)
        ? body.modelUids
        : body.modelUid
          ? [body.modelUid]
          : [];
      const exposed = body.exposed !== false; // 缺省视为开启外接
      for (const id of ids) {
        if (!id || typeof id !== "string") continue;
        if (exposed) disSet.delete(id);
        else disSet.add(id);
      }
    }
    next.disabledModels = Array.from(disSet).slice(0, 2000);
    saveConfig(next);
    _json(res, 200, {
      ok: true,
      disabledModels: next.disabledModels,
      stats: modelStats(listModels(Object.assign({}, deps, { cfg: next }))),
    });
    return true;
  }
  if (p === "/origin/revproxy/config" && req.method === "POST") {
    if (!_isLocal(req)) {
      _json(res, 403, { ok: false, error: "localhost only" });
      return true;
    }
    let body = {};
    try {
      body = await _readBody(req);
    } catch (_) {}
    const next = Object.assign(loadConfig(), {});
    if (typeof body.enabled === "boolean") next.enabled = body.enabled;
    if (typeof body.applyInvert === "boolean")
      next.applyInvert = body.applyInvert;
    if (typeof body.isolatePrompt === "boolean")
      next.isolatePrompt = body.isolatePrompt;
    if (Array.isArray(body.disabledModels))
      next.disabledModels = body.disabledModels
        .filter((x) => typeof x === "string" && x)
        .slice(0, 2000);
    if (typeof body.exposeLan === "boolean") next.exposeLan = body.exposeLan;
    if (typeof body.defaultMaxTokens === "number")
      next.defaultMaxTokens = body.defaultMaxTokens;
    if (typeof body.dualPath === "boolean") next.dualPath = body.dualPath;
    if (body.tiers && typeof body.tiers === "object")
      next.tiers = Object.assign({}, next.tiers || {}, body.tiers);
    if (body.regenerateKey === true)
      next.apiKey = "dao-local-" + crypto.randomBytes(12).toString("hex");
    else if (typeof body.apiKey === "string") next.apiKey = body.apiKey;
    saveConfig(next);
    _json(res, 200, { ok: true, config: next });
    return true;
  }

  // ── 数据面 (标准 OpenAI / Anthropic) ──────────────────────────
  if (!cfg.enabled) {
    _json(res, 503, {
      error: {
        message: "模型反代未启用 · 请在「模型反代」面板开启",
        type: "revproxy_disabled",
      },
    });
    return true;
  }
  if (!_authOk(req, cfg)) {
    _json(res, 401, {
      error: { message: "未授权 · 缺少有效 Bearer key", type: "unauthorized" },
    });
    return true;
  }

  if (p === "/v1/models" && req.method === "GET") {
    const allModels = listModels(deps);
    // 模型外接选择: 对外仅呈现「已开启外接」之模型(用户排除者不列)。
    const models = allModels.filter((m) => m.exposed !== false);
    const data = models.slice();
    // 家族别名: 外部可用干净家族名(如 glm-5.1)调用「当前活跃档」· 一族一别名
    try {
      const fams = familySummary(deps, models);
      for (const f of fams) {
        if (!f.aliasSlug || f.aliasSlug === f.activeUid) continue;
        if (models.some((m) => m.id === f.aliasSlug)) continue;
        if (_isModelDisabled(cfg, f.activeUid, deps)) continue;
        const act = models.find((m) => m.id === f.activeUid) || {};
        data.push({
          id: f.aliasSlug,
          object: "model",
          created: 0,
          owned_by: "dao-revproxy",
          label: f.familyLabel,
          dao_family: true,
          dao_active_tier: f.activeUid,
          color: act.color,
          free: !!act.free,
        });
      }
    } catch (_) {}
    _json(res, 200, { object: "list", data });
    return true;
  }

  const isOpenAIChat = p === "/v1/chat/completions" && req.method === "POST";
  const isAnthropicMsg = p === "/v1/messages" && req.method === "POST";
  if (isOpenAIChat || isAnthropicMsg) {
    let body;
    try {
      body = await _readBody(req);
    } catch (e) {
      _json(res, 400, { error: { message: "invalid JSON body" } });
      return true;
    }
    const clientKind = isAnthropicMsg ? "anthropic" : "openai";
    const norm = normalizeInbound(clientKind, body);
    if (!norm.model) {
      _json(res, 400, { error: { message: "model required" } });
      return true;
    }
    // 模型外接选择: 用户已排除之模型拒绝对外反代(回归本源·各取所需)。
    if (_isModelDisabled(cfg, norm.model, deps)) {
      _json(res, 403, {
        error: {
          message:
            "模型 '" +
            norm.model +
            "' 未开放外接 · 已被用户在「模型反代」面板排除(可在面板重新勾选启用)",
          type: "model_not_exposed",
        },
      });
      return true;
    }
    const targets = resolveTargets(norm.model, deps);
    const target = targets[0];
    if (!target) {
      _json(res, 400, {
        error: {
          message:
            "模型 '" +
            norm.model +
            "' 未配置反代通道 · 请在「渠道配置 / 模型路由」为其指定渠道(或映射到已配置的免费渠道如 GLM)",
          type: "no_route",
        },
      });
      return true;
    }
    log(
      "[revproxy] " +
        clientKind +
        " model=" +
        norm.model +
        " → " +
        (target.official
          ? "official/" + (target.upstreamModel || "")
          : target.provName + "/" + (target.upstreamModel || "")) +
        (targets.length > 1
          ? " (+备路 " +
            (targets[1].official ? "official" : targets[1].provName) +
            ")"
          : "") +
        " stream=" +
        norm.stream,
    );
    const gen = _bridge(targets, norm, deps);
    if (clientKind === "anthropic") {
      if (norm.stream) _emitAnthropicStream(res, norm.model, gen);
      else _emitAnthropicUnary(res, norm.model, gen);
    } else {
      if (norm.stream) _emitOpenAIStream(res, norm.model, gen);
      else _emitOpenAIUnary(res, norm.model, gen);
    }
    return true;
  }

  // 兜底: /v1/* 未识别
  if (p.startsWith("/v1/")) {
    _json(res, 404, { error: { message: "unknown endpoint " + p } });
    return true;
  }
  return false;
}

module.exports = {
  handle,
  listModels,
  modelStats,
  loadConfig,
  saveConfig,
  defaultConfig,
  normalizeInbound,
  resolveTarget,
  resolveTargets,
  _altTarget,
  _isRetryableErr,
  setPremiumQuota,
  getPremiumQuota,
  _officialInfo,
  _isModelDisabled,
  _isFreeTier,
  buildFamilyIndex,
  familySummary,
  _familyActiveUid,
  _resolveFamilyAlias,
  _cfgPath,
  _isLocal,
  _isForwarded,
  _authOk,
  consoleHtml,
  _classifyUpstreamError,
  _emitOpenAIStream,
  _emitOpenAIUnary,
};
