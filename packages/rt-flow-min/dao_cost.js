// ═══════════════════════════════════════════════════════════════════════════════
// 道 · dao_cost.js — 对话级成本追踪 v1.0 (归一 · 纯本地 · 零干扰 · 道法自然)
// ★ v4.33.0: 从独立脚本归入 RTflow 插件包 · 由 extension.js 直接 require 使用
// ★ 功能: 从 .pb 对话文件提取 ModelUsageStats → 计算 per-conversation 成本
// ★ 数据源: ~/.codeium/windsurf/cascade/*.pb (与 dao_stuck.js 同源)
// ★ 密钥: ~/.wam/_cascade_key.json (AES-256-GCM)
// ★ 定价: DeepSeek 官方 (Devin Pro overage 计费)
// ═══════════════════════════════════════════════════════════════════════════════
//
// 万物负阴而抱阳，中气以为和:
//   对话追踪者，阳也——动态之观测，活跃之判定，如天之行健。
//   Token 提取者，阴也——静态之计量，精确之解析，如地之厚载。
//   成本计算者，中气也——阴阳和合，以定价为桥，化 token 为金额。
//
// 图难于其易，为大于其细:
//   从最细粒度(每对话每次请求之 token)入手，
//   聚合为全局视图(总消耗/增速/账号验证)，以实证为准。
//
// 零干扰设计:
//   纯只读(只读 .pb 文件) · 纯本地(不依赖网络) · 纯后台(不阻塞主线程)
//   不修改任何文件 · 不干扰日常运行 · 热推进(require 即用)
'use strict';
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

// ── 路径 (与 dao_stuck.js 同源自适应) ────────────────────────────────────────
// 支持 DAO_COST_PB_DIR 环境变量覆盖 (测试/多环境); 默认自适应 os.homedir()
function _findPbDir() {
  if (process.env.DAO_COST_PB_DIR) return process.env.DAO_COST_PB_DIR;
  const home = os.homedir();
  const candidates = [
    path.join(home, '.codeium', 'devin', 'cascade'),
    path.join(home, '.codeium', 'Devin', 'cascade'),
    path.join(home, '.codeium', 'windsurf', 'cascade'),
    path.join(home, '.codeium', 'windsurf-nightly', 'cascade'),
    path.join(home, 'AppData', 'Local', 'codeium', 'devin', 'cascade'),
    path.join(home, 'AppData', 'Local', 'codeium', 'windsurf', 'cascade'),
  ];
  for (const p of candidates) {
    try {
      if (fs.statSync(p).isDirectory()) return p;
    } catch (_) {}
  }
  return path.join(home, '.codeium', 'windsurf', 'cascade'); // fallback
}

const PB_DIR = _findPbDir();
const KEY_FILE = process.env.DAO_COST_KEY_FILE || path.join(os.homedir(), '.wam', '_cascade_key.json');
const TITLES_FILE = process.env.DAO_COST_TITLES_FILE || path.join(os.homedir(), '.wam', '_conv_titles.json');

// ── DeepSeek 官方定价 (Devin Pro overage 计费) ──────────────────────────────
const PRICE = {
  input: 0.14,       // $/M tokens (未命中缓存)
  cacheHit: 0.03,    // $/M tokens (缓存命中)
  output: 0.28,      // $/M tokens
  cacheWrite: 0.03,  // 缓存写入 (与命中同价, DeepSeek 不额外收费写入)
};

// ── 密钥加载 (懒加载·失败不致命) ─────────────────────────────────────────────
let _KEY = null;
let _keyLoaded = false;
function _getKey() {
  if (_keyLoaded) return _KEY;
  _keyLoaded = true;
  try {
    _KEY = JSON.parse(fs.readFileSync(KEY_FILE, 'utf8')).key;
  } catch (_) {
    _KEY = null;
  }
  return _KEY;
}

// ── 标题缓存 (懒加载) ────────────────────────────────────────────────────────
let _titles = null;
function _getTitles() {
  if (_titles === null) {
    _titles = {};
    try { _titles = JSON.parse(fs.readFileSync(TITLES_FILE, 'utf8')); } catch (_) {}
  }
  return _titles;
}

// ── AES-256-GCM 解密 ────────────────────────────────────────────────────────
function _decryptPb(ct) {
  const KEY = _getKey();
  if (!KEY) return null;
  try {
    const nonce = ct.slice(0, 12);
    const ctTag = ct.slice(12);
    const tag = ctTag.slice(ctTag.length - 16);
    const body = ctTag.slice(0, ctTag.length - 16);
    const d = crypto.createDecipheriv('aes-256-gcm', Buffer.from(KEY), nonce);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(body), d.final()]);
  } catch (_) {
    return null;
  }
}

// ── Protobuf 解析 (与 dao-billing-extract.js 同源) ──────────────────────────
function _readVarint(buf, pos) {
  let v = 0, s = 0;
  while (pos < buf.length) {
    const b = buf[pos++];
    v += (b & 0x7f) * Math.pow(2, s);
    if (!(b & 0x80)) break;
    s += 7;
    if (s > 49) break;
  }
  return { v: Math.floor(v), pos };
}

const MODEL_RE = /^(deepseek|MODEL_|gpt|claude|gemini|o[0-9]|kimi|glm|qwen|minimax|mimo|swe|opus|sonnet|haiku|llama|mistral|grok|hybrid|cascade|stub|unknown)/i;

// 严格解析 ModelUsageStats
function _tryParseUsage(buf) {
  if (buf.length < 10 || buf.length > 3000) return null;
  let pos = 0;
  const u = { input: null, output: null, cacheWrite: null, cacheRead: null, billingModel: null, modelUid: null, requestedModel: null };
  let hasInput = false;
  while (pos < buf.length) {
    const start = pos;
    const tag = _readVarint(buf, pos);
    pos = tag.pos;
    const field = tag.v >>> 3;
    const wire = tag.v & 7;
    if (field === 0) break;
    if (wire === 0) {
      const r = _readVarint(buf, pos);
      pos = r.pos;
      if (field === 2) { u.input = r.v; hasInput = true; }
      else if (field === 3) u.output = r.v;
      else if (field === 4) u.cacheWrite = r.v;
      else if (field === 5) u.cacheRead = r.v;
    } else if (wire === 2) {
      const len = _readVarint(buf, pos);
      pos = len.pos;
      if (len.v > buf.length - pos) break;
      if (len.v < 200) {
        const s = buf.slice(pos, pos + len.v).toString('utf8');
        if (field === 9) u.modelUid = s;
        else if (field === 10) u.billingModel = s;
        else if (field === 11) u.requestedModel = s;
      }
      pos += len.v;
    } else break;
    if (pos <= start) break;
  }
  if (!hasInput || u.input === null || u.input > 100000000) return null;
  if (u.output === null || u.output > 10000000) return null;
  const model = u.billingModel || u.modelUid || '';
  if (!model || !MODEL_RE.test(model)) return null;
  return u;
}

// 递归扫描 protobuf 寻找 ModelUsageStats
function _scanForUsage(buf, depth, maxDepth, results) {
  if (depth > maxDepth) return;
  let pos = 0;
  while (pos < buf.length) {
    const start = pos;
    const tag = _readVarint(buf, pos);
    pos = tag.pos;
    const field = tag.v >>> 3;
    const wire = tag.v & 7;
    if (field === 0) break;
    if (wire === 2) {
      const len = _readVarint(buf, pos);
      pos = len.pos;
      if (len.v > buf.length - pos) break;
      const sub = buf.slice(pos, pos + len.v);
      pos += len.v;
      const usage = _tryParseUsage(sub);
      if (usage) results.push(usage);
      if (depth < maxDepth) _scanForUsage(sub, depth + 1, maxDepth, results);
    } else if (wire === 0) {
      const r = _readVarint(buf, pos);
      pos = r.pos;
    } else if (wire === 1) {
      pos += 8;
    } else if (wire === 5) {
      pos += 4;
    } else break;
    if (pos <= start) break;
  }
}

// ── 成本计算 (DeepSeek 定价) ────────────────────────────────────────────────
// 实证: input 字段 = 未缓存输入(新增 token) → $0.14/M
//       cacheRead 字段 = 缓存命中(从缓存读取) → $0.03/M
//       总输入 = input + cacheRead
function calcCost(tokens) {
  const input = tokens.input || 0;         // 未缓存输入 (新增 token)
  const output = tokens.output || 0;       // 输出 token
  const cacheRead = tokens.cacheRead || 0; // 缓存命中
  const cacheWrite = tokens.cacheWrite || 0; // 缓存写入

  const inputCost = input / 1e6 * PRICE.input;
  const cacheCost = cacheRead / 1e6 * PRICE.cacheHit;
  const cacheWriteCost = cacheWrite / 1e6 * PRICE.cacheWrite;
  const outputCost = output / 1e6 * PRICE.output;
  const total = inputCost + cacheCost + outputCost;

  const totalInput = input + cacheRead;
  const cacheHitRate = totalInput > 0 ? cacheRead / totalInput * 100 : 0;

  return {
    inputCost,
    cacheCost,
    cacheWriteCost,
    outputCost,
    total,
    cacheHitRate,
    totalInput,
  };
}

// ── 核心 API ────────────────────────────────────────────────────────────────

// 提取单个对话的 token 用量 + 成本
// uuid: 对话 UUID (不含 .pb 后缀)
// 返回: { ok, tokens, cost, msgCount, models, title, sizeBytes, mtimeMs } 或 { ok:false, error }
function getConversationCost(uuid) {
  if (!uuid) return { ok: false, error: 'no-uuid' };
  const pbPath = path.join(PB_DIR, uuid + '.pb');
  try {
    if (!fs.existsSync(pbPath)) return { ok: false, error: 'not-found' };
    const st = fs.statSync(pbPath);
    const ct = fs.readFileSync(pbPath);
    if (ct.length < 28) return { ok: false, error: 'too-small' };

    const pt = _decryptPb(ct);
    if (!pt) return { ok: false, error: 'decrypt-fail' };

    const usages = [];
    _scanForUsage(pt, 0, 6, usages);
    if (!usages.length) return { ok: false, error: 'no-usage' };

    // 聚合
    let totIn = 0, totOut = 0, totCW = 0, totCR = 0;
    const modelMap = {};
    for (const u of usages) {
      totIn += u.input || 0;
      totOut += u.output || 0;
      totCW += u.cacheWrite || 0;
      totCR += u.cacheRead || 0;
      const m = u.billingModel || u.modelUid || 'unknown';
      modelMap[m] = (modelMap[m] || 0) + 1;
    }

    const tokens = { input: totIn, output: totOut, cacheWrite: totCW, cacheRead: totCR };
    const cost = calcCost(tokens);
    const titles = _getTitles();

    return {
      ok: true,
      uuid,
      title: titles[uuid] || titles[uuid + '.pb'] || null,
      msgCount: usages.length,
      tokens,
      cost,
      models: modelMap,
      sizeBytes: st.size,
      mtimeMs: st.mtimeMs,
    };
  } catch (e) {
    return { ok: false, error: (e && e.message) || 'unknown' };
  }
}

// 批量提取多个对话
function getConversationCosts(uuids) {
  const out = {};
  for (const u of uuids || []) {
    out[u] = getConversationCost(u);
  }
  return out;
}

// 扫描全部 .pb 对话 → 汇总 (轻量·不阻塞)
// 返回: { total: N, totalCost, totalInput, totalOutput, totalCacheRead, cacheHitRate, convs: [...] }
function getAllConversationCosts(opts) {
  opts = opts || {};
  const maxConvs = opts.maxConvs || 200;
  let files = [];
  try {
    files = fs.readdirSync(PB_DIR).filter((f) => f.endsWith('.pb'));
  } catch (_) {
    return { ok: false, error: 'pb-dir-unavailable', total: 0, totalCost: 0, convs: [] };
  }

  const convs = [];
  let totalCost = 0, totalInput = 0, totalOutput = 0, totalCacheRead = 0;
  for (const f of files.slice(0, maxConvs)) {
    const uuid = f.replace(/\.pb$/, '');
    const r = getConversationCost(uuid);
    if (!r.ok) continue;
    convs.push(r);
    totalCost += r.cost.total;
    totalInput += r.tokens.input;
    totalOutput += r.tokens.output;
    totalCacheRead += r.tokens.cacheRead;
  }

  const totalInputAll = totalInput + totalCacheRead;
  const cacheHitRate = totalInputAll > 0 ? totalCacheRead / totalInputAll * 100 : 0;

  return {
    ok: true,
    total: convs.length,
    totalCost,
    totalInput,
    totalOutput,
    totalCacheRead,
    totalInputAll,
    cacheHitRate,
    convs,
  };
}

// 对话活跃判定 (与 dao_stuck.js 同源)
// streaming: 30s 内 mtime 更新 · active: 180s 内 · idle: 更久
function getConversationStatus(uuid) {
  const pbPath = path.join(PB_DIR, uuid + '.pb');
  try {
    const st = fs.statSync(pbPath);
    const ageMs = Date.now() - st.mtimeMs;
    let status = 'idle';
    if (ageMs < 30000) status = 'streaming';
    else if (ageMs < 180000) status = 'active';
    return { ok: true, uuid, status, ageMs, sizeBytes: st.size, mtimeMs: st.mtimeMs };
  } catch (_) {
    return { ok: false, error: 'not-found' };
  }
}

// 格式化工具 (供面板/日志使用)
function fmtTokens(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}
function fmtCost(n) {
  if (n === null || n === undefined) return 'n/a';
  if (n < 0.01) return '$' + n.toFixed(4);
  return '$' + n.toFixed(2);
}

// 生成对话成本摘要文本 (供终报/通知使用)
function summarizeCost(r) {
  if (!r || !r.ok) return null;
  const c = r.cost;
  return {
    cost: c.total,
    costTxt: fmtCost(c.total),
    inputTxt: fmtTokens(r.tokens.input),
    outputTxt: fmtTokens(r.tokens.output),
    cacheReadTxt: fmtTokens(r.tokens.cacheRead),
    cacheHitRate: c.cacheHitRate,
    msgCount: r.msgCount,
    title: r.title,
  };
}

module.exports = {
  PRICE,
  PB_DIR,
  KEY_FILE,
  getConversationCost,
  getConversationCosts,
  getAllConversationCosts,
  getConversationStatus,
  calcCost,
  summarizeCost,
  fmtTokens,
  fmtCost,
};
