// 道 · 插件自持本地 HTTP API(桥接板块后端) —— 插件即本源, 对外暴露插件自持真源。
// ─────────────────────────────────────────────────────────────────────────────
// 二合一本源(dao-vsix)在 IDE 内起 9920 本地 API + 公网穿透; 本插件的等价物: 起一个
// 只绑 127.0.0.1 的本地 API, 把插件自持状态(账号/备份/MCP/LS 主机)以 JSON 暴露 ——
// 供本机脚本、诊断、以及后续经 dao-bridge 隧道的公网只读访问消费。零 IDE 宿主依赖。
//
// 安全: 仅绑 127.0.0.1; 除 /api/health 外全部需 `Authorization: Bearer <token>`;
// token 随进程随机生成、落盘 ~/.dao/local-api.json(mode 600)。不暴露任何 apiKey/凭据。
"use strict";
const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const hostStateMod = require("./host-state");
const backup = require("./backup");
const envSync = require("./env-sync");
const ls = require("./ls-bridge");
const { AcpWssClient } = require("./acp-wss");

function statePath() { return process.env.DAO_LOCAL_API_FILE || path.join(os.homedir(), ".dao", "local-api.json"); }

let _server = null;
let _token = "";
let _port = 0;

function token() { return _token; }
function port() { return _port; }
function running() { return !!_server && _port > 0; }

// 账号视图(脱敏: 绝不含 apiKey)
function accountView() {
  const hs = hostStateMod.loadPersisted() || hostStateMod.hostState();
  const a = (hs.fused || {}).account || {};
  return { name: a.name || "", email: a.email || "", plan: a.plan || "",
    dailyQuotaPct: a.dailyQuotaPct == null ? null : a.dailyQuotaPct,
    weeklyQuotaPct: a.weeklyQuotaPct == null ? null : a.weeklyQuotaPct,
    flexCredits: a.flexCredits == null ? null : a.flexCredits, updatedAt: a.updatedAt || "" };
}

function mcpView() {
  const hs = hostStateMod.loadPersisted() || hostStateMod.hostState();
  return ((hs.fused || {}).mcp || {}).servers || [];
}

function hostView() {
  const h = hostStateMod.resolveHost();
  return { ready: !!h, lsPort: h ? h.lsPort : 0 };
}

// 本机 Cascade(devin-local) 水位: 会话轨迹与记忆计数(fused 快照, 无会话内容/凭据)。
function cascadeView() {
  const hs = hostStateMod.loadPersisted() || hostStateMod.hostState();
  const f = hs.fused || {};
  return { sessions: f.cascadeLocal || null, memories: f.memories || null };
}

// 路由表(GET 只读): 路径 → 数据(可返 Promise)。绝不暴露凭据/token 本身。
function routes(reqUrl) {
  const u = reqUrl.split("?")[0];
  const q = new URLSearchParams(reqUrl.split("?")[1] || "");
  if (u === "/api/env") return envSync.detect();
  if (u === "/api/models") return ls.listModels();
  if (u === "/api/cascade/trajectories") return ls.call("GetAllCascadeTrajectories", {}).then((r) => r.trajectorySummaries || {});
  if (u === "/api/cascade/steps") {
    const cid = q.get("cascadeId") || "";
    if (!cid) throw new Error("cascadeId required");
    return ls.call("GetCascadeTrajectorySteps", { cascadeId: cid });
  }
  if (u === "/api/cloud/sessions") {
    return withCloud(async (c) => {
      const l = await c.listSessions();
      const ss = (l && l.sessions) || [];
      return ss.map((s) => ({ sessionId: s.sessionId || s.id, title: s.title || "" }));
    });
  }
  if (u === "/api/account") return accountView();
  if (u === "/api/mcp") return mcpView();
  if (u === "/api/host") return hostView();
  if (u === "/api/cascade") return cascadeView();
  if (u === "/api/backups") {
    const l = backup.listBackups();
    return { root: l.root, accounts: l.accounts.map((a) => ({ email: a.email, source: a.source, convCount: a.convCount })) };
  }
  if (u === "/api/overview") {
    const l = backup.listBackups();
    return { account: accountView(), host: hostView(), mcp: mcpView(), cascade: cascadeView(),
      backups: { accounts: l.accounts.length, conversations: l.accounts.reduce((s, x) => s + x.convCount, 0) } };
  }
  return null;
}

// Devin Cloud 一次性连接(官方 /acp/live 同源): 用完即断, 不常驻。
async function withCloud(fn) {
  const c = new AcpWssClient({ log: () => {}, onUpdate: () => {} });
  try {
    await c.connect();
    return await fn(c);
  } finally { try { c.stop(); } catch (_) {} }
}

// POST 路由(后端原生调度): AI/脚本可直接驱动 Cascade 会话, 与面板同源(ls-bridge 同一真源)。
async function postRoutes(u, body) {
  if (u === "/api/cascade/send") {
    const text = String((body || {}).text || "").trim();
    if (!text) throw new Error("text required");
    let cid = (body || {}).cascadeId || "";
    if (!cid) cid = (await ls.call("StartCascade", {})).cascadeId;
    let uid = (body || {}).modelUid || "";
    if (!uid) {
      const ms = await ls.listModels();
      const pick = ms.find((m) => m.recommended && !m.disabled) || ms.find((m) => !m.disabled) || ms[0];
      uid = pick && pick.uid;
    }
    const drive = ls.driveStream(cid, null);
    try {
      await ls.call("SendUserCascadeMessage", {
        cascadeId: cid, items: [{ text }],
        cascadeConfig: { plannerConfig: { requestedModelUid: uid, toolConfig: { askUserQuestion: { enabled: true } } } },
      });
    } finally { setTimeout(() => { try { drive.close(); } catch (_) {} }, 120000).unref(); }
    return { ok: true, cascadeId: cid, modelUid: uid };
  }
  if (u === "/api/cloud/send") {
    const text = String((body || {}).text || "").trim();
    if (!text) throw new Error("text required");
    return withCloud(async (c) => {
      let out = "";
      c._onUpdate = (u2) => {
        try {
          const s = u2.update || u2;
          if ((s.sessionUpdate || s.kind) === "agent_message_chunk") out += ((s.content || {}).text) || "";
        } catch (_) {}
      };
      if ((body || {}).sessionId) await c.loadSession(body.sessionId);
      else await c.newSession("/");
      const r = await c.prompt(text);
      return { ok: true, sessionId: c.sessionId, stopReason: (r || {}).stopReason || "", reply: out };
    });
  }
  if (u === "/api/backup/run") {
    return backup.backupAll(ls, body || {});
  }
  return null;
}

function loadPersistedToken() {
  try { const j = JSON.parse(fs.readFileSync(statePath(), "utf8")); return j.token || ""; } catch (_) { return ""; }
}

function persist() {
  try {
    fs.mkdirSync(path.dirname(statePath()), { recursive: true });
    fs.writeFileSync(statePath(), JSON.stringify({ token: _token, port: _port, updatedAt: new Date().toISOString() }), { mode: 0o600 });
  } catch (_) {}
}

// 启动本地 API(幂等: 已在跑则直接回状态)。preferredPort=0 → 系统分配。
function start(preferredPort) {
  return new Promise((resolve, reject) => {
    if (running()) return resolve({ port: _port, token: _token });
    _token = loadPersistedToken() || crypto.randomBytes(24).toString("hex");
    _server = http.createServer((req, res) => {
      const send = (code, obj) => {
        const b = Buffer.from(JSON.stringify(obj), "utf8");
        res.writeHead(code, { "Content-Type": "application/json", "Content-Length": b.length });
        res.end(b);
      };
      const u = (req.url || "").split("?")[0];
      if (u === "/api/health") return send(200, { ok: true, service: "dao-desktop-local-api", port: _port });
      const auth = req.headers["authorization"] || "";
      if (auth !== "Bearer " + _token) return send(401, { error: "unauthorized" });
      if (req.method === "POST") {
        let raw = "";
        req.on("data", (c) => { raw += c; if (raw.length > 1e6) req.destroy(); });
        req.on("end", () => {
          let body = {};
          try { body = raw ? JSON.parse(raw) : {}; } catch (_) { return send(400, { error: "invalid json" }); }
          Promise.resolve()
            .then(() => postRoutes(u, body))
            .then((d) => (d === null ? send(404, { error: "not found" }) : send(200, d)))
            .catch((e) => send(500, { error: e.message }));
        });
        return;
      }
      Promise.resolve()
        .then(() => routes(req.url || ""))
        .then((d) => (d === null || d === undefined ? send(404, { error: "not found" }) : send(200, d)))
        .catch((e) => send(500, { error: e.message }));
    });
    _server.on("error", (e) => { _server = null; reject(e); });
    _server.listen(preferredPort || 0, "127.0.0.1", () => {
      _port = _server.address().port;
      persist();
      resolve({ port: _port, token: _token });
    });
  });
}

function stop() {
  return new Promise((resolve) => {
    if (!_server) return resolve();
    _server.close(() => { _server = null; _port = 0; resolve(); });
  });
}

module.exports = { start, stop, running, token, port, statePath, accountView, mcpView, hostView, cascadeView, routes, postRoutes };
