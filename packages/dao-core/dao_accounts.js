/**
 * dao_accounts.js — dao-native 账号管理 · 脱 wam-state.json 依
 * ════════════════════════════════════════════════════════════════════════
 *
 *   反者道之动 · 重新锚定本源 · 不依赖 windsurf.exe 之本体
 *
 *   ~/.dao/accounts.json   ← 此为本源 (取代 ~/.wam/wam-state.json)
 *
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │  用户 (任意主机, 无 Windsurf 装机)                              │
 *   │   │                                                              │
 *   │   ├─ node 道直连器.js --add-account email pwd                   │
 *   │   │   └─ Firebase 登录 → idToken → RegisterUser → sk-ws-*      │
 *   │   │      └─ 写 ~/.dao/accounts.json                             │
 *   │   │                                                              │
 *   │   ├─ node 道直连器.js --add-token <devin/sk-ws> [--email <e>]   │
 *   │   │   └─ 直接注入现成 token (从 wam-state 拷过来 / 反代得到)    │
 *   │   │                                                              │
 *   │   └─ node 道直连器.js                                           │
 *   │       └─ extractApiKey() 优先读 ~/.dao/accounts.json 之 active  │
 *   │           └─ 启 sub · 提供 :11440/v1 三协议 API                 │
 *   └─────────────────────────────────────────────────────────────────┘
 *
 *   schema:
 *     {
 *       "version": 2,
 *       "accounts": [
 *         {
 *           "email": "user@example.com",
 *           "apiKey": "devin-session-token$JWT" | "sk-ws-01-...",
 *           "type": "devin" | "sk-ws",
 *           "added": ISO,
 *           "lastUsed": ISO|null,
 *           "useCount": 0,
 *           "apiServerUrl": "https://server.self-serve.windsurf.com",
 *           "refreshToken": "..." (opt · sk-ws 路 Firebase 刷新用)
 *         }
 *       ],
 *       "active": "user@example.com",
 *       "rotateMode": "manual" | "round-robin" | "least-used" | "random",
 *       "lastRotateAt": 0,
 *       "rotateCount": 0
 *     }
 *
 *   零 npm 依赖 · 仅 Node 内置 (fs / path / os / crypto)
 */
"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");

// ── 路径与默 ────────────────────────────────────────────────────────────
const DAO_DIR = path.join(os.homedir(), ".dao");
const ACCOUNTS_FILE =
  process.env.DAO_ACCOUNTS_FILE || path.join(DAO_DIR, "accounts.json");

// ══ 印 60 · RPM 速率限制 (内存 · 不落盘) ═══════════════════════════════════
//   帛书·五十九 「治人事天莫若啬 · 重积德则无不克」
//   滑窗 60s · 每账号独立 · 超限则 rotate 跳号
const RPM_WINDOW_MS = 60 * 1000;
const RPM_LIMITS = { pro: 60, free: 10, unknown: 20, expired: 0, banned: 0 };
const _rpmHistory = {}; // email → [timestamp, timestamp, ...]

// ══ 印 60 · Ban 信号检测 ════════════════════════════════════════════════════
//   帛书·七十六 「坚强者死之徒 · 柔弱微细生之徒」
//   上游错误模式匹配 → 窗口内 2+ 命中 → 自动 freeze
const BAN_SIGNAL_WINDOW_MS = 5 * 60 * 1000; // 5min
const BAN_SIGNAL_THRESHOLD = 2; // 窗口内命中 N 次 → ban
const _banSignals = {}; // email → [{ts, msg}, ...]

const BAN_PATTERNS = [
  /\baccount\b[^.\n]{0,40}\b(?:suspended|disabled|banned|terminated|deactivated|blocked|closed)\b/i,
  /\buser\b[^.\n]{0,30}\b(?:banned|suspended|disabled|blocked)\b/i,
  /\b(?:access|account)\s+(?:has been|was)\s+(?:revoked|terminated|suspended)\b/i,
  /\btoken\b[^.\n]{0,30}\b(?:revoked|invalid|expired|blacklisted)\b/i,
  /\b(?:permanently|temporarily)\s+(?:banned|suspended|disabled)\b/i,
  /账号(?:已)?(?:停用|封禁|禁用|冻结|注销|关闭|封号)/,
  /用户(?:已)?(?:封禁|禁止|停用|注销)/,
  /\bforbidden\b.*\b(?:abuse|violation|policy)\b/i,
  /\bplan\s+(?:expired|cancelled|terminated)\b/i,
];

const DEFAULT_DB = {
  version: 2,
  accounts: [],
  active: null,
  rotateMode: "manual",
  lastRotateAt: 0,
  rotateCount: 0,
};

// ── 类型识 ──────────────────────────────────────────────────────────────
function detectTokenType(apiKey) {
  if (!apiKey || typeof apiKey !== "string") return "unknown";
  if (apiKey.startsWith("devin-session-token$")) return "devin";
  if (apiKey.startsWith("sk-ws-")) return "sk-ws";
  if (apiKey.length > 40 && /^[A-Za-z0-9_.-]+$/.test(apiKey)) return "raw-jwt";
  return "unknown";
}

// ── IO ──────────────────────────────────────────────────────────────────
function ensureDir() {
  try {
    fs.mkdirSync(DAO_DIR, { recursive: true });
  } catch {}
}

function load() {
  try {
    if (!fs.existsSync(ACCOUNTS_FILE)) return { ...DEFAULT_DB };
    const j = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, "utf8"));
    if (!j || typeof j !== "object" || !Array.isArray(j.accounts)) {
      return { ...DEFAULT_DB };
    }
    // 字段补齐
    return {
      version: j.version || 2,
      accounts: j.accounts || [],
      active: j.active || null,
      rotateMode: j.rotateMode || "manual",
      lastRotateAt: j.lastRotateAt || 0,
      rotateCount: j.rotateCount || 0,
    };
  } catch {
    return { ...DEFAULT_DB };
  }
}

function save(db) {
  ensureDir();
  const tmp = ACCOUNTS_FILE + ".tmp." + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), "utf8");
  try {
    if (fs.existsSync(ACCOUNTS_FILE)) fs.unlinkSync(ACCOUNTS_FILE);
  } catch {}
  fs.renameSync(tmp, ACCOUNTS_FILE);
  try {
    fs.chmodSync(ACCOUNTS_FILE, 0o600);
  } catch {}
}

// ── 增 / 删 / 改 ────────────────────────────────────────────────────────

/**
 * 加账号 · 若 email 已存则覆 (idempotent · 复读 update token)
 * @param {{email, apiKey, type?, apiServerUrl?, refreshToken?}} a
 * @returns {Object} 加之后的 account record
 */
function addAccount(a) {
  if (!a || !a.email || !a.apiKey) {
    throw new Error("addAccount: email + apiKey 必需");
  }
  const db = load();
  const type = a.type || detectTokenType(a.apiKey);
  const now = new Date().toISOString();
  const existing = db.accounts.find((x) => x.email === a.email);
  if (existing) {
    existing.apiKey = a.apiKey;
    existing.type = type;
    if (a.apiServerUrl) existing.apiServerUrl = a.apiServerUrl;
    if (a.refreshToken) existing.refreshToken = a.refreshToken;
    existing.updatedAt = now;
  } else {
    db.accounts.push({
      email: a.email,
      apiKey: a.apiKey,
      type,
      added: now,
      lastUsed: null,
      useCount: 0,
      apiServerUrl: a.apiServerUrl || "https://server.self-serve.windsurf.com",
      refreshToken: a.refreshToken || null,
      // 印 59 · 反者道之动 · frozen 字 · 锁则不入轮转 (帛书·廿五「独立而不垓」)
      frozen: false,
      frozenAt: null,
      frozenReason: null,
    });
  }
  if (!db.active) db.active = a.email;
  save(db);
  return db.accounts.find((x) => x.email === a.email);
}

function removeAccount(email) {
  const db = load();
  const idx = db.accounts.findIndex((x) => x.email === email);
  if (idx < 0) return false;
  db.accounts.splice(idx, 1);
  if (db.active === email) {
    db.active = db.accounts[0]?.email || null;
  }
  save(db);
  return true;
}

function setActive(email) {
  const db = load();
  if (!db.accounts.find((x) => x.email === email)) return false;
  db.active = email;
  save(db);
  return true;
}

function getActiveAccount() {
  const db = load();
  if (!db.accounts.length) return null;
  let acct = db.accounts.find((x) => x.email === db.active);
  if (!acct) acct = db.accounts[0];
  return acct;
}

function listAccounts() {
  return load().accounts;
}

function listAccountsMasked() {
  const db = load();
  return db.accounts.map((a) => ({
    email: a.email,
    type: a.type,
    keyPreview:
      typeof a.apiKey === "string"
        ? a.apiKey.length <= 24
          ? a.apiKey
          : a.apiKey.slice(0, 14) + "..." + a.apiKey.slice(-8)
        : "(none)",
    added: a.added,
    lastUsed: a.lastUsed,
    useCount: a.useCount || 0,
    active: a.email === db.active,
    // 印 59 · frozen 暴露 (web UI 显锁)
    frozen: !!a.frozen,
    frozenAt: a.frozenAt || null,
    frozenReason: a.frozenReason || null,
  }));
}

/** 标记某账号刚用 (lastUsed + useCount++) · 异步落盘不阻塞 */
function markUsed(email) {
  setImmediate(() => {
    try {
      const db = load();
      const a = db.accounts.find((x) => x.email === email);
      if (!a) return;
      a.lastUsed = new Date().toISOString();
      a.useCount = (a.useCount || 0) + 1;
      save(db);
    } catch {}
  });
}

/**
 * 切号 · 据 rotateMode 选下一个
 * @param {string} [mode] 若给则覆 db.rotateMode
 * @returns {Object|null} 新 active 之 account, 或 null 无账号
 */
function rotate(mode) {
  const db = load();
  if (db.accounts.length === 0) return null;
  // 印 59 · frozen 跳过 · 池中仅活号参与轮转
  const alive = db.accounts.filter((x) => !x.frozen);
  if (alive.length === 0) return null; // 全锁 · 给 null 让上游知
  if (alive.length === 1) return alive[0];
  const m = mode || db.rotateMode || "round-robin";
  const cur = db.active;
  let next = null;
  if (m === "round-robin") {
    // 在 alive 上做 round-robin · 若 cur 是 frozen 或不存 · 由头起
    const aliveIdx = alive.findIndex((x) => x.email === cur);
    next = aliveIdx >= 0 ? alive[(aliveIdx + 1) % alive.length] : alive[0];
  } else if (m === "least-used") {
    next = [...alive].sort((a, b) => (a.useCount || 0) - (b.useCount || 0))[0];
  } else if (m === "random") {
    const others = alive.filter((x) => x.email !== cur);
    next = others[Math.floor(Math.random() * others.length)] || alive[0];
  } else {
    // manual: 不切 · 但 cur 若 frozen, 顺势挑活之首 (不破 manual 语义, 仅救锁)
    const stay = db.accounts.find((x) => x.email === cur);
    if (stay && !stay.frozen) return stay;
    return alive[0]; // cur 锁 · manual 也得救一个
  }
  db.active = next.email;
  db.lastRotateAt = Date.now();
  db.rotateCount = (db.rotateCount || 0) + 1;
  save(db);
  return next;
}

/** 一次性从 ~/.wam/wam-state.json 导入 active 账号 (兼容旧 WAM 用户)
 *  @returns {boolean} 是否真导入了至少一个
 */
function importFromWam() {
  try {
    const wam = path.join(os.homedir(), ".wam", "wam-state.json");
    if (!fs.existsSync(wam)) return false;
    const j = JSON.parse(fs.readFileSync(wam, "utf8"));
    if (
      typeof j.activeApiKey !== "string" ||
      j.activeApiKey.length < 30 ||
      !j.activeApiKey.startsWith("devin-session-token$")
    ) {
      return false;
    }
    const email = j.activeEmail || `wam-${Date.now()}@imported.dao`;
    addAccount({
      email,
      apiKey: j.activeApiKey,
      type: "devin",
      apiServerUrl: j.activeApiServerUrl,
    });
    // 尝试从 wam.accounts (若有) 批量导
    let extra = 0;
    if (Array.isArray(j.accounts)) {
      for (const a of j.accounts) {
        if (
          a &&
          a.email &&
          typeof a.apiKey === "string" &&
          a.apiKey.length >= 30 &&
          a.email !== email
        ) {
          try {
            addAccount({
              email: a.email,
              apiKey: a.apiKey,
              apiServerUrl: a.apiServerUrl,
            });
            extra++;
          } catch {}
        }
      }
    }
    return { active: email, extra };
  } catch {
    return false;
  }
}

function getStats() {
  const db = load();
  // 印 59 · 反者道之动 · frozen/alive 聚合 (帛书六十三「为大于其细」)
  const total = db.accounts.length;
  const frozen = db.accounts.filter((x) => x.frozen).length;
  const alive = total - frozen;
  return {
    total,
    alive,
    frozen,
    active: db.active,
    rotateMode: db.rotateMode,
    rotateCount: db.rotateCount,
    lastRotateAt: db.lastRotateAt,
    lastRotateAgo: db.lastRotateAt
      ? _humanAgo(Date.now() - db.lastRotateAt)
      : null,
    byType: db.accounts.reduce((acc, a) => {
      acc[a.type || "unknown"] = (acc[a.type || "unknown"] || 0) + 1;
      return acc;
    }, {}),
  };
}

// 印 59 · 人读时长 (ms → "3m 12s" / "1h 5m")
function _humanAgo(ms) {
  if (!ms || ms < 0) return "0s";
  const s = Math.floor(ms / 1000);
  if (s < 60) return s + "s";
  const m = Math.floor(s / 60);
  if (m < 60) return m + "m" + (s % 60 ? " " + (s % 60) + "s" : "");
  const h = Math.floor(m / 60);
  return h + "h" + (m % 60 ? " " + (m % 60) + "m" : "");
}

// 印 59 · 锁 (frozen) · 与切号 rotate 协 · 排除轮转
//   帛书·二十八「知其雄·守其雌·复归于朴」· 主选不入则不耗
function freeze(email, reason) {
  const db = load();
  const a = db.accounts.find((x) => x.email === email);
  if (!a) return false;
  a.frozen = true;
  a.frozenAt = new Date().toISOString();
  a.frozenReason = typeof reason === "string" ? reason.slice(0, 200) : null;
  // 若 frozen 之号当为 active · 试切一个 alive (不强 · 留给上游决)
  save(db);
  return true;
}

function unfreeze(email) {
  const db = load();
  const a = db.accounts.find((x) => x.email === email);
  if (!a) return false;
  a.frozen = false;
  a.frozenAt = null;
  a.frozenReason = null;
  save(db);
  return true;
}

function isFrozen(email) {
  const db = load();
  const a = db.accounts.find((x) => x.email === email);
  return !!(a && a.frozen);
}

function setRotateMode(mode) {
  if (!["manual", "round-robin", "least-used", "random"].includes(mode)) {
    throw new Error("rotateMode 必为 manual|round-robin|least-used|random");
  }
  const db = load();
  db.rotateMode = mode;
  save(db);
}

// ══ 印 60 · RPM 速率限制 API ═══════════════════════════════════════════════
//   帛书·五十九 「夫惟啬 · 是以早服 · 早服是谓重积德」

/** 记录一次请求 (打时间戳) */
function rpmRecord(email) {
  if (!email) return;
  if (!_rpmHistory[email]) _rpmHistory[email] = [];
  _rpmHistory[email].push(Date.now());
  // 裁剪过期
  const cutoff = Date.now() - RPM_WINDOW_MS;
  _rpmHistory[email] = _rpmHistory[email].filter((t) => t > cutoff);
}

/** 当前 RPM 使用量 */
function rpmUsed(email) {
  if (!email || !_rpmHistory[email]) return 0;
  const cutoff = Date.now() - RPM_WINDOW_MS;
  _rpmHistory[email] = _rpmHistory[email].filter((t) => t > cutoff);
  return _rpmHistory[email].length;
}

/** 获取 RPM 上限 (按 tier) */
function rpmLimit(email, tier) {
  const t = tier || "unknown";
  return RPM_LIMITS[t] !== undefined ? RPM_LIMITS[t] : RPM_LIMITS.unknown;
}

/** 是否超限 */
function rpmExceeded(email, tier) {
  return rpmUsed(email) >= rpmLimit(email, tier);
}

/** RPM 信息 (供 /health /admin 端显) */
function rpmInfo(email, tier) {
  return {
    used: rpmUsed(email),
    limit: rpmLimit(email, tier),
    exceeded: rpmExceeded(email, tier),
    windowMs: RPM_WINDOW_MS,
  };
}

// ══ 印 60 · Ban 信号检测 API ═══════════════════════════════════════════════
//   帛书·七十六 「兵强则不胜 · 木强则恒」 — 强压不过 · 识信退避

/** 判上游错误是否含 ban 信号 */
function looksLikeBanSignal(msg) {
  if (!msg || typeof msg !== "string") return false;
  return BAN_PATTERNS.some((re) => re.test(msg));
}

/** 报告一次 ban 信号 · 累超阈则自动 freeze */
function reportBanSignal(email, msg) {
  if (!email) return { frozen: false };
  if (!_banSignals[email]) _banSignals[email] = [];
  _banSignals[email].push({ ts: Date.now(), msg: (msg || "").slice(0, 200) });
  // 裁剪窗口
  const cutoff = Date.now() - BAN_SIGNAL_WINDOW_MS;
  _banSignals[email] = _banSignals[email].filter((s) => s.ts > cutoff);
  // 超阈 → freeze
  if (_banSignals[email].length >= BAN_SIGNAL_THRESHOLD) {
    const reason = `ban_signal x${_banSignals[email].length} in ${BAN_SIGNAL_WINDOW_MS / 1000}s: ${(msg || "").slice(0, 80)}`;
    freeze(email, reason);
    _banSignals[email] = []; // 清 · 免重复触发
    return { frozen: true, reason };
  }
  return { frozen: false, count: _banSignals[email].length };
}

/** 清除 ban 信号 (成功调用时) */
function clearBanSignals(email) {
  if (email && _banSignals[email]) {
    _banSignals[email] = [];
  }
}

/** ban 信号摘要 (供 admin) */
function banSignalInfo(email) {
  if (!email || !_banSignals[email]) return { count: 0, signals: [] };
  const cutoff = Date.now() - BAN_SIGNAL_WINDOW_MS;
  _banSignals[email] = _banSignals[email].filter((s) => s.ts > cutoff);
  return {
    count: _banSignals[email].length,
    signals: _banSignals[email].slice(-5),
    threshold: BAN_SIGNAL_THRESHOLD,
    windowMs: BAN_SIGNAL_WINDOW_MS,
  };
}

// ── 路径暴露 (供 道直连器 之 health endpoint 显示) ──────────────────────
module.exports = {
  ACCOUNTS_FILE,
  DAO_DIR,
  detectTokenType,
  load,
  save,
  addAccount,
  removeAccount,
  setActive,
  getActiveAccount,
  listAccounts,
  listAccountsMasked,
  markUsed,
  rotate,
  importFromWam,
  getStats,
  setRotateMode,
  // 印 59
  freeze,
  unfreeze,
  isFrozen,
  // 印 60 · RPM 速率限制
  rpmRecord,
  rpmUsed,
  rpmLimit,
  rpmExceeded,
  rpmInfo,
  RPM_LIMITS,
  // 印 60 · Ban 信号检测
  looksLikeBanSignal,
  reportBanSignal,
  clearBanSignals,
  banSignalInfo,
};
