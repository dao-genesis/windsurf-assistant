/**
 * gist-pool.js · 印 95 · 真本源闭环 · token 池云端化
 * ════════════════════════════════════════════════════════════════════════
 *
 *   帛书·四十:  「反者道之动 · 弱者道之用 · 天下之物生于有 · 有生于无」
 *   帛书·六十六:「江海所以能为百谷王者 · 以其善下之」
 *   帛书·二十五:「独立而不垓 · 可以为天地母」
 *
 *   主公诏 (2026-05-14):
 *     「重新锚定本源 · 此核心所有均运行于云端 GitHub Actions
 *      综合管理一切 · 不依赖本地一切 · 不依赖设备
 *      一 GitHub 账号即一切 · 道法自然」
 *
 *   ─ 现态 (印 99): token 池在主公本机 ~/.wam/wam-state.json
 *                   主公 PC 关 → token + bundle 链断 → 不真去 PC 化
 *
 *   ─ 印 95 解: token 池入主公 GitHub 私 gist (PAT gist scope)
 *               一 GH 账号即一切 · 主公 PC 真可关机
 *               GH Actions 拉 gist → 立 ~/.dao/accounts.json → 起 daemon → 报 URL 回 gist
 *               Web UI 用 user 自家 PAT 读 gist · 见 daemon URL · 一键用
 *
 * ─ schema dao-pool.json (gist 内) ────────────────────────────────────
 *
 *   {
 *     "version": 1,
 *     "seal": "印 95 · 真本源闭环",
 *     "lastSync": "2026-05-14T00:00:00Z",
 *     "pool": {
 *       "total": 137,
 *       "accounts": [
 *         {
 *           "email": "user1@gmail.com",
 *           "apiKey": "devin-session-token$JWT" | "sk-ws-01-...",
 *           "type": "devin" | "sk-ws",
 *           "apiServerUrl": "https://server.self-serve.windsurf.com",
 *           "daily": 100,        // optional · 反映 D 余
 *           "weekly": 0,         // optional · 反映 W 余
 *           "lastUsedAt": null,
 *           "frozen": false
 *         }
 *       ]
 *     },
 *     "daemons": [
 *       {
 *         "host": "runnervmeorf1",
 *         "url": "https://xxxx.trycloudflare.com",
 *         "sessionId": "actions-25811469835",
 *         "daemonPort": 7862,
 *         "reportedAt": "2026-05-14T01:00:00Z",
 *         "ageSec": 60,
 *         "ok": true,
 *         "version": "0.3.0",
 *         "poolTotal": 137
 *       }
 *     ]
 *   }
 *
 * ─ 端 ─
 *
 *   GistPool.pull({ gistId, pat, fileName })       → { data, gistMeta }
 *   GistPool.push({ gistId, pat, fileName, data }) → { ok, gistMeta }
 *   GistPool.create({ pat, description, public, files }) → { id, url }
 *
 *   实例 (data-bound):
 *     pool = new GistPool({ data })
 *     pool.pickBest({ type: 'devin' | 'sk-ws' | 'any' }) → account 之一
 *     pool.toAccountsJson() → { version: 2, accounts, active, ... } · 写 ~/.dao/accounts.json
 *     pool.addDaemonUrl({ host, url, ... })
 *     pool.pruneStaleDaemons({ maxAgeMs })
 *     pool.fromWamState(wamRaw) · 主公本机 wam-state.json → pool data (一次性迁)
 *
 *   零外部依赖 · 仅 Node 内置 (https, fs, path, os, crypto)
 */
"use strict";

const https = require("https");
const fs = require("fs");
const path = require("path");
const os = require("os");

// ════════════════════════════════════════════════════════════════
// §1  HTTPS · GitHub API client (零依赖 · 仅 https.request)
// ════════════════════════════════════════════════════════════════

function ghRequest({ method, path: urlPath, pat, body, accept }) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: "api.github.com",
      port: 443,
      path: urlPath,
      method,
      headers: {
        "User-Agent": "dao-pool/1.0 (印 95 真本源闭环)",
        Accept: accept || "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        Authorization: `Bearer ${pat}`,
      },
    };
    if (data) {
      opts.headers["Content-Type"] = "application/json";
      opts.headers["Content-Length"] = Buffer.byteLength(data);
    }

    const req = https.request(opts, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const buf = Buffer.concat(chunks).toString("utf8");
        let parsed = null;
        try {
          parsed = buf ? JSON.parse(buf) : null;
        } catch {
          parsed = { raw: buf };
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ status: res.statusCode, body: parsed });
        } else {
          const err = new Error(
            `GitHub API ${method} ${urlPath} → ${res.statusCode}: ${
              parsed && parsed.message ? parsed.message : buf.slice(0, 200)
            }`,
          );
          err.status = res.statusCode;
          err.body = parsed;
          reject(err);
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(30000, () => {
      req.destroy(new Error("GitHub API 30s timeout"));
    });
    if (data) req.write(data);
    req.end();
  });
}

// ════════════════════════════════════════════════════════════════
// §2  static methods · 拉 / 推 / 创建 gist
// ════════════════════════════════════════════════════════════════

async function pull({ gistId, pat, fileName = "dao-pool.json" }) {
  if (!gistId) throw new Error("pull: gistId 必给");
  if (!pat) throw new Error("pull: pat 必给 (gist scope)");
  const r = await ghRequest({
    method: "GET",
    path: `/gists/${gistId}`,
    pat,
  });
  const file = r.body.files && r.body.files[fileName];
  if (!file) {
    throw new Error(
      `gist ${gistId} 内无 ${fileName} (有: ${Object.keys(
        r.body.files || {},
      ).join(", ")})`,
    );
  }
  let content = file.content;
  // truncated · 拉 raw_url
  if (file.truncated && file.raw_url) {
    content = await new Promise((resolve, reject) => {
      https
        .get(
          file.raw_url,
          {
            headers: {
              "User-Agent": "dao-pool/1.0",
              Authorization: `Bearer ${pat}`,
            },
          },
          (res) => {
            const chunks = [];
            res.on("data", (c) => chunks.push(c));
            res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
          },
        )
        .on("error", reject);
    });
  }
  let data;
  try {
    data = JSON.parse(content);
  } catch (e) {
    throw new Error(`${fileName} JSON 解失败: ${e.message}`);
  }
  return {
    data,
    gistMeta: {
      id: r.body.id,
      url: r.body.html_url,
      updated: r.body.updated_at,
      public: r.body.public,
      ownerLogin: r.body.owner && r.body.owner.login,
    },
  };
}

async function push({ gistId, pat, fileName = "dao-pool.json", data }) {
  if (!gistId) throw new Error("push: gistId 必给");
  if (!pat) throw new Error("push: pat 必给");
  if (!data || typeof data !== "object")
    throw new Error("push: data 必给 (object)");
  const r = await ghRequest({
    method: "PATCH",
    path: `/gists/${gistId}`,
    pat,
    body: {
      files: {
        [fileName]: { content: JSON.stringify(data, null, 2) },
      },
    },
  });
  return {
    ok: true,
    gistMeta: {
      id: r.body.id,
      url: r.body.html_url,
      updated: r.body.updated_at,
    },
  };
}

async function create({
  pat,
  description = "dao-pool · 印 95 真本源闭环 (token 池云端化)",
  public: isPublic = false,
  fileName = "dao-pool.json",
  data = null,
}) {
  if (!pat) throw new Error("create: pat 必给");
  const seed = data || {
    version: 1,
    seal: "印 95 · 真本源闭环 · 一 GH 账号即一切",
    createdAt: new Date().toISOString(),
    lastSync: null,
    pool: { total: 0, accounts: [] },
    daemons: [],
  };
  const r = await ghRequest({
    method: "POST",
    path: `/gists`,
    pat,
    body: {
      description,
      public: !!isPublic,
      files: {
        [fileName]: { content: JSON.stringify(seed, null, 2) },
      },
    },
  });
  return {
    id: r.body.id,
    url: r.body.html_url,
    public: r.body.public,
    fileName,
  };
}

// 反向: 取主公已存 gists · 找 dao-pool 之一
async function findExisting({ pat, fileName = "dao-pool.json" }) {
  if (!pat) throw new Error("findExisting: pat 必给");
  const r = await ghRequest({
    method: "GET",
    path: `/gists?per_page=100`,
    pat,
  });
  const list = (r.body || []).filter(
    (g) => g.files && g.files[fileName] && /dao-pool/i.test(g.description || ""),
  );
  return list.map((g) => ({
    id: g.id,
    description: g.description,
    public: g.public,
    updated: g.updated_at,
    url: g.html_url,
  }));
}

// ════════════════════════════════════════════════════════════════
// §3  GistPool 类 · data-bound · 选号 / 写 accounts / daemon URL
// ════════════════════════════════════════════════════════════════

class GistPool {
  constructor({ data }) {
    this.data = data || {
      version: 1,
      seal: "印 95",
      lastSync: null,
      pool: { total: 0, accounts: [] },
      daemons: [],
    };
    if (!this.data.pool) this.data.pool = { total: 0, accounts: [] };
    if (!Array.isArray(this.data.pool.accounts)) this.data.pool.accounts = [];
    if (!Array.isArray(this.data.daemons)) this.data.daemons = [];
  }

  // 选号: 优先 type 匹配 · W=0 · D 余多 · 未冻 · 未 frozen
  //   帛书·廿二「圣人执一·以为天下牧」
  pickBest({ type = "any" } = {}) {
    const accs = this.data.pool.accounts || [];
    const cands = accs.filter((a) => {
      if (a.frozen) return false;
      if (!a.apiKey) return false;
      if (type === "devin" && a.type !== "devin") return false;
      if (type === "sk-ws" && a.type !== "sk-ws") return false;
      return true;
    });
    if (cands.length === 0) return null;
    // sort: weekly asc → daily desc → 未用 first
    cands.sort((a, b) => {
      const wA = typeof a.weekly === "number" ? a.weekly : 0;
      const wB = typeof b.weekly === "number" ? b.weekly : 0;
      if (wA !== wB) return wA - wB;
      const dA = typeof a.daily === "number" ? a.daily : 100;
      const dB = typeof b.daily === "number" ? b.daily : 100;
      if (dA !== dB) return dB - dA;
      const tA = a.lastUsedAt ? new Date(a.lastUsedAt).getTime() : 0;
      const tB = b.lastUsedAt ? new Date(b.lastUsedAt).getTime() : 0;
      return tA - tB;
    });
    return cands[0];
  }

  // 反向: 选 N 个候选 · 一并写 accounts.json (主 + 备型)
  pickCandidates({ limit = 3 } = {}) {
    const sorted = [...(this.data.pool.accounts || [])]
      .filter((a) => !a.frozen && a.apiKey)
      .sort((a, b) => {
        const wA = typeof a.weekly === "number" ? a.weekly : 0;
        const wB = typeof b.weekly === "number" ? b.weekly : 0;
        if (wA !== wB) return wA - wB;
        const dA = typeof a.daily === "number" ? a.daily : 100;
        const dB = typeof b.daily === "number" ? b.daily : 100;
        return dB - dA;
      });
    return sorted.slice(0, limit);
  }

  // 转为 ~/.dao/accounts.json schema (fleet_vm_unit.js 之入)
  toAccountsJson({ activeEmail } = {}) {
    const cands = this.pickCandidates({ limit: 5 });
    if (cands.length === 0) {
      return {
        version: 2,
        accounts: [],
        active: null,
        rotateMode: "manual",
        lastRotateAt: 0,
        rotateCount: 0,
      };
    }
    const active = activeEmail
      ? cands.find((c) => c.email === activeEmail) || cands[0]
      : cands[0];
    return {
      version: 2,
      accounts: cands.map((c) => ({
        email: c.email,
        apiKey: c.apiKey,
        type: c.type,
        apiServerUrl:
          c.apiServerUrl || "https://server.self-serve.windsurf.com",
        added: c.added || new Date().toISOString(),
        lastUsed: c.lastUsedAt || null,
        useCount: 0,
        frozen: !!c.frozen,
      })),
      active: active.email,
      rotateMode: "manual",
      lastRotateAt: 0,
      rotateCount: 0,
      // 印 95 mark
      _seal: "印 95 · gist-pool 立",
      _gistSync: this.data.lastSync || null,
    };
  }

  // 写 accounts.json
  writeAccountsJsonTo(filePath, opts = {}) {
    const j = this.toAccountsJson(opts);
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(j, null, 2));
    return j;
  }

  // 加 daemon URL · 同 host 替 (印 97 之多节点 Map 法)
  addDaemonUrl({
    host,
    url,
    sessionId,
    daemonPort = 7862,
    version,
    poolTotal,
    ok = true,
  }) {
    if (!host || !url) throw new Error("addDaemonUrl: host + url 必给");
    const idx = this.data.daemons.findIndex((d) => d.host === host);
    const rec = {
      host,
      url,
      sessionId: sessionId || host,
      daemonPort,
      reportedAt: new Date().toISOString(),
      ageSec: 0,
      ok: !!ok,
      version: version || null,
      poolTotal: poolTotal || null,
    };
    if (idx >= 0) this.data.daemons[idx] = rec;
    else this.data.daemons.push(rec);
    return rec;
  }

  // 清过期 daemon · 默 15 分钟
  pruneStaleDaemons({ maxAgeMs = 15 * 60 * 1000 } = {}) {
    const now = Date.now();
    const fresh = [];
    const stale = [];
    for (const d of this.data.daemons) {
      const t = d.reportedAt ? new Date(d.reportedAt).getTime() : 0;
      const age = now - t;
      if (age <= maxAgeMs) {
        d.ageSec = Math.round(age / 1000);
        fresh.push(d);
      } else {
        stale.push(d);
      }
    }
    this.data.daemons = fresh;
    return { kept: fresh.length, removed: stale.length, stale };
  }

  // 一次性迁: 主公本机 ~/.wam/wam-state.json → gist pool
  //   wam schema (印 50): { activeEmail, activeApiKey, accountMeta: { email: { apiKey, type, ... } }, health: { email: { daily, weekly } } }
  fromWamState(wamRaw) {
    if (!wamRaw || typeof wamRaw !== "object") {
      throw new Error("fromWamState: wamRaw 非 object");
    }
    const accountMeta = wamRaw.accountMeta || {};
    const accounts = wamRaw.accounts || {};
    const health = wamRaw.health || {};
    const blacklist = wamRaw.blacklist || {};
    const out = [];
    // 主源: accountMeta (新版)
    for (const [email, meta] of Object.entries(accountMeta)) {
      if (!meta || !meta.apiKey) continue;
      const h = health[email] || {};
      out.push({
        email,
        apiKey: meta.apiKey,
        type:
          meta.type ||
          (meta.apiKey.startsWith("devin-session-token$")
            ? "devin"
            : meta.apiKey.startsWith("sk-ws-")
              ? "sk-ws"
              : "unknown"),
        apiServerUrl:
          meta.apiServerUrl || "https://server.self-serve.windsurf.com",
        daily: typeof h.daily === "number" ? h.daily : null,
        weekly: typeof h.weekly === "number" ? h.weekly : null,
        lastUsedAt: meta.lastUsedAt || null,
        added: meta.added || null,
        frozen: !!blacklist[email] || !!meta.frozen,
      });
    }
    // 兜底: accounts (旧版)
    if (out.length === 0) {
      for (const [email, a] of Object.entries(accounts)) {
        if (!a || !a.apiKey) continue;
        out.push({
          email,
          apiKey: a.apiKey,
          type: a.type || "sk-ws",
          apiServerUrl:
            a.apiServerUrl || "https://server.self-serve.windsurf.com",
          daily: null,
          weekly: null,
          lastUsedAt: null,
          frozen: false,
        });
      }
    }
    // active 提到首
    const activeEmail = wamRaw.activeEmail;
    if (activeEmail) {
      const idx = out.findIndex((a) => a.email === activeEmail);
      if (idx > 0) {
        const [active] = out.splice(idx, 1);
        out.unshift(active);
      }
    }
    this.data.pool = { total: out.length, accounts: out };
    this.data.lastSync = new Date().toISOString();
    return out.length;
  }

  // 反: pool → wam-state-shape (备份返本机用)
  toWamShape() {
    const accountMeta = {};
    const health = {};
    const accounts = this.data.pool.accounts || [];
    for (const a of accounts) {
      accountMeta[a.email] = {
        apiKey: a.apiKey,
        type: a.type,
        apiServerUrl: a.apiServerUrl,
        added: a.added,
        lastUsedAt: a.lastUsedAt,
      };
      if (typeof a.daily === "number" || typeof a.weekly === "number") {
        health[a.email] = {
          daily: typeof a.daily === "number" ? a.daily : null,
          weekly: typeof a.weekly === "number" ? a.weekly : null,
        };
      }
    }
    return {
      version: "2.7.0",
      activeEmail: accounts[0] ? accounts[0].email : null,
      activeApiKey: accounts[0] ? accounts[0].apiKey : null,
      activeApiServerUrl: accounts[0]
        ? accounts[0].apiServerUrl
        : "https://server.self-serve.windsurf.com",
      accountMeta,
      health,
      blacklist: Object.fromEntries(
        accounts.filter((a) => a.frozen).map((a) => [a.email, true]),
      ),
    };
  }

  // 简: 摘
  summary() {
    const accs = this.data.pool.accounts || [];
    const types = {};
    for (const a of accs) types[a.type] = (types[a.type] || 0) + 1;
    const candidates = accs.filter(
      (a) =>
        !a.frozen &&
        a.apiKey &&
        (typeof a.weekly !== "number" || a.weekly === 0),
    ).length;
    const daemonsAlive = (this.data.daemons || []).filter((d) => d.ok).length;
    return {
      total: accs.length,
      candidates,
      types,
      frozen: accs.filter((a) => a.frozen).length,
      daemonsTotal: (this.data.daemons || []).length,
      daemonsAlive,
      lastSync: this.data.lastSync,
    };
  }
}

// ════════════════════════════════════════════════════════════════
// §4  helpers · 简捷接口 (workflow 之 node -e 用)
// ════════════════════════════════════════════════════════════════

// 一笔: pull → write accounts.json
async function pullToAccountsJson({
  gistId,
  pat,
  fileName,
  accountsPath,
}) {
  const { data, gistMeta } = await pull({ gistId, pat, fileName });
  const pool = new GistPool({ data });
  const j = pool.writeAccountsJsonTo(
    accountsPath || path.join(os.homedir(), ".dao", "accounts.json"),
  );
  const sum = pool.summary();
  return { gistMeta, summary: sum, active: j.active, accountCount: j.accounts.length };
}

// 一笔: pull → addDaemonUrl → push (workflow URL 报回)
async function reportDaemonUrl({
  gistId,
  pat,
  fileName,
  host,
  url,
  sessionId,
  daemonPort,
  version,
  poolTotal,
}) {
  const { data } = await pull({ gistId, pat, fileName });
  const pool = new GistPool({ data });
  pool.pruneStaleDaemons({ maxAgeMs: 15 * 60 * 1000 });
  pool.addDaemonUrl({
    host,
    url,
    sessionId,
    daemonPort,
    version,
    poolTotal,
  });
  await push({ gistId, pat, fileName, data: pool.data });
  return { ok: true, daemonsTotal: pool.data.daemons.length };
}

module.exports = {
  // static
  pull,
  push,
  create,
  findExisting,
  // class
  GistPool,
  // helpers
  pullToAccountsJson,
  reportDaemonUrl,
  // raw
  ghRequest,
};
