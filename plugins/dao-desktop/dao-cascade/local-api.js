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

// 路由表(全只读): 路径 → () => 数据。绝不暴露凭据/token 本身。
function routes(reqUrl) {
  const u = reqUrl.split("?")[0];
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
      let data;
      try { data = routes(req.url || ""); } catch (e) { return send(500, { error: e.message }); }
      if (data === null) return send(404, { error: "not found" });
      send(200, data);
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

module.exports = { start, stop, running, token, port, statePath, accountView, mcpView, hostView, cascadeView, routes };
