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
const provision = require("./devin-provision");
const { execFile } = require("child_process");
// 六大板块后端(归一入协议): Proxy Pro / 账号池切号 / 反向注入 / GitHub 舰队 / Web 搜索 / Windows Agent。
// 与 unified-panel 同一真源(各自 ~/.dao/*.json), 令 AI/脚本经 HTTP 零 GUI 调度全部板块。
const proxyPro = require("./proxy-pro");
const proxyRuntime = require("./proxy-runtime");
const accountPool = require("./account-pool");
const inject = require("./inject");
const githubFleet = require("./github-fleet");
const webSearch = require("./web-search");
const winAgent = require("./windows-agent");
const coexist = require("./coexist");
const syncAudit = require("./sync-audit");

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

// 官方 configuration 生效视图: 官方扩展清单 52 项默认值 + 各 IDE 用户 settings.json 覆写归一。
// 单一真源直接读官方持久层, 插件不复制第二份配置模型。
function configView() {
  const home = os.homedir();
  const manifests = [
    path.join(home, "devin-desktop", "Devin", "resources", "app", "extensions", "windsurf", "package.json"),
    "/usr/share/windsurf/resources/app/extensions/windsurf/package.json",
  ];
  const defaults = {};
  for (const m of manifests) {
    try {
      const pj = JSON.parse(fs.readFileSync(m, "utf8"));
      let conf = ((pj.contributes || {}).configuration) || [];
      if (!Array.isArray(conf)) conf = [conf];
      for (const c of conf) for (const [k, v] of Object.entries(c.properties || {})) {
        defaults[k] = v.default === undefined ? null : v.default;
      }
      if (Object.keys(defaults).length) break;
    } catch (_) {}
  }
  const userFiles = [
    ["devin-desktop", path.join(home, ".config", "Devin", "User", "settings.json")],
    ["vscode", path.join(home, ".config", "Code", "User", "settings.json")],
    ["windsurf", path.join(home, ".config", "Windsurf", "User", "settings.json")],
  ];
  const effective = {}; const sources = {};
  for (const [k, v] of Object.entries(defaults)) { effective[k] = v; sources[k] = "default"; }
  const overrides = {};
  for (const [name, f] of userFiles) {
    try {
      const j = JSON.parse(fs.readFileSync(f, "utf8").replace(/\/\/[^\n"]*$/gm, ""));
      overrides[name] = {};
      for (const [k, v] of Object.entries(j)) {
        if (k.startsWith("windsurf.") || k.startsWith("devin.") || k.startsWith("dao.")) {
          overrides[name][k] = v;
          effective[k] = v; sources[k] = name;
        }
      }
    } catch (_) {}
  }
  return { defaultCount: Object.keys(defaults).length, effective, sources, overrides };
}

// 路由表(GET 只读): 路径 → 数据(可返 Promise)。绝不暴露凭据/token 本身。
function routes(reqUrl) {
  const u = reqUrl.split("?")[0];
  const q = new URLSearchParams(reqUrl.split("?")[1] || "");
  if (u === "/api/openapi") return require("./api-schema").openapi({ port: _port });
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
  if (u === "/api/config") return configView();
  if (u === "/api/cloud/live") return liveState();
  if (u === "/api/cloud/updates") {
    if (!_live) return { on: false, updates: [], next: 0 };
    const since = Number(q.get("since") || 0);
    const updates = _live.buf.filter((x) => x.seq > since);
    return { on: true, updates, next: _live.seq };
  }
  if (u === "/api/tasks") return (async () => {
    // 统一任务视图: 本地 Cascade 轨迹 + Devin Cloud 会话归一为同构条目(云端不可达时仅回本地)
    const local = await ls.call("GetAllCascadeTrajectories", {}).then((r) =>
      Object.entries(r.trajectorySummaries || {}).map(([id, s]) => ({
        id, kind: "local", title: s.summary || "", status: s.status || "",
        stepCount: s.stepCount || 0, updatedAt: s.lastModifiedTime || "",
      }))).catch(() => []);
    const cloud = await withCloud(async (c) => {
      const l = await c.listSessions();
      return ((l && l.sessions) || []).map((s) => ({
        id: s.sessionId || s.id, kind: "cloud", title: s.title || "", status: s.status || "", updatedAt: s.updatedAt || "",
      }));
    }).catch(() => []);
    return { tasks: local.concat(cloud), localCount: local.length, cloudCount: cloud.length };
  })();
  if (u === "/api/status") {
    return ls.call("GetUserStatus", {}).then((r) => {
      const s = (r && r.userStatus) || r || {};
      return { name: s.name || "", email: s.email || "", plan: (s.planStatus || {}).planName || s.plan || "", loggedIn: !!(s.email || s.name) };
    });
  }
  if (u === "/api/rules") {
    // 与面板同源: GetAllRules 只返工作区规则, 直读补显全局规则(~/.devin/rules + 官方设置页 global_rules.md)
    return ls.call("GetAllRules", {}).catch(() => ({})).then((r) => {
      const fromUri = (x) => (x || "").replace(/^file:\/\//, "");
      const rules = (r.memories || []).map((m) => {
        const ps = (m.scope && m.scope.projectScope) || {};
        return { name: m.title || m.memoryId || "", trigger: (ps.trigger || "").replace("CORTEX_MEMORY_TRIGGER_", "").toLowerCase(), path: fromUri(ps.absoluteFilePath) };
      });
      const seen = new Set(rules.map((x) => x.path));
      try {
        const gdir = path.join(os.homedir(), ".devin", "rules");
        for (const f of fs.readdirSync(gdir)) {
          if (!f.endsWith(".md")) continue;
          const p = path.join(gdir, f);
          if (!seen.has(p)) rules.push({ name: f.replace(/\.md$/, ""), trigger: "global", path: p });
        }
      } catch (_) {}
      try {
        const gp = path.join(os.homedir(), ".codeium", "windsurf", "memories", "global_rules.md");
        if (!seen.has(gp) && fs.statSync(gp).size > 0) rules.push({ name: "global_rules.md", trigger: "global", path: gp });
      } catch (_) {}
      return { rules };
    });
  }
  if (u === "/api/skills") return ls.call("GetAllSkills", {});
  if (u === "/api/workflows") return ls.call("GetAllWorkflows", {});
  if (u === "/api/memories") return ls.call("GetCascadeMemories", {});
  if (u === "/api/settings") return ls.call("GetUserSettings", {}).then((r) => r.userSettings || {});
  if (u === "/api/mcp/states") return ls.call("GetMcpServerStates", {});
  if (u === "/api/cascade/transcript") {
    const cid = q.get("cascadeId") || "";
    if (!cid) throw new Error("cascadeId required");
    return ls.call("GetCascadeTranscriptForTrajectoryId", { cascadeId: cid });
  }
  if (u === "/api/auth") {
    const bin = provision.resolveEngine(null, null);
    return provision.authStatus(bin, { force: q.get("force") === "1" }).then((r) => ({ loggedIn: r.loggedIn, name: r.name || "", login: _login ? { pending: true, url: _login.url || "" } : null }));
  }
  if (u === "/api/workspaces") return ls.call("GetWorkspaceInfos", {});
  if (u === "/api/workspace/edit-state") return ls.call("GetWorkspaceEditState", {});
  if (u === "/api/models/statuses") return ls.call("GetModelStatuses", {});
  if (u === "/api/processes") return ls.call("GetProcesses", {});
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
  // 六大板块只读视图(与 unified-panel 同一真源)
  if (u === "/api/proxy") { const v = proxyPro.listView(); return { channels: v.channels, routes: v.routes, file: proxyPro.cfgPath() }; }
  if (u === "/api/proxy/routes") { return { routes: proxyRuntime.routeStatus() }; }
  if (u === "/api/pool") { return { accounts: accountPool.listView(safeApiKey()), file: accountPool.poolPath(), siblings: coexist.siblingAccounts() }; }
  if (u === "/api/inject") { return { items: inject.listView(), file: inject.profilePath() }; }
  if (u === "/api/inject/plan") { return inject.plan(accountPool.loadPool()); }
  if (u === "/api/github") { return { accounts: githubFleet.listView(), file: githubFleet.fleetPath() }; }
  if (u === "/api/search") {
    const query = q.get("q") || "";
    if (!query) return { engines: webSearch.engineList(), history: webSearch.historyView() };
    return webSearch.search(query, q.get("engine") || "");
  }
  if (u === "/api/search/history") { return { history: webSearch.historyView() }; }
  if (u === "/api/winagent") { return winAgent.status(); }
  if (u === "/api/boundary") { return boundaryView(); }
  if (u === "/api/coexist") { return coexist.report(); }
  if (u === "/api/sync/audit") { return syncAudit.audit(); }
  if (u === "/api/coexist/flow") { return coexist.dataFlow(); }
  return null;
}

// 同步/隔离边界自描述(道并行而不相悖): 插件自持面(~/.dao/*)与官方共享面(IDE 数据 1:1)的机器可读矩阵。
function boundaryView() {
  return {
    principle: "IDE 数据面(对话/设置/MCP/规则/记忆/登录态)与官方 1:1 同步; 插件自有板块(Proxy Pro/账号池/注入/GitHub 舰队/搜索/WinAgent)全部自持于 ~/.dao/*(mode 600), 与官方零交叉; 官方面仅经显式动作触碰且可归还",
    isolated: [
      { module: "proxy-pro", file: proxyPro.cfgPath(), touchOfficial: "never", note: "第三方渠道/路由/反代与官方模型请求面零交叉; 路由消费点=Cascade 面板对话轨(命中即整轮改投)与 POST /api/proxy/chat" },
      { module: "account-pool", file: accountPool.poolPath(), touchOfficial: "explicit", note: "池本体自持; 仅 POST /api/pool/switch 写 credentials.toml(首次自动备份 .bak), POST /api/pool/restore 一键归还官方原登录态" },
      { module: "inject", file: inject.profilePath(), touchOfficial: "explicit", note: "注入档自持; 仅 POST /api/inject/apply-mcp 显式落地官方 mcp_config.json" },
      { module: "github-fleet", file: githubFleet.fleetPath(), touchOfficial: "never", note: "GitHub 纵向, 与 Devin/Cascade 账号池完全分离" },
      { module: "web-search", file: webSearch.histPath(), touchOfficial: "never", note: "仅存查询串" },
      { module: "local-api", file: statePath(), touchOfficial: "never", note: "Bearer token 自持" },
    ],
    shared: [
      { surface: "credentials.toml", policy: "写仅经显式 /api/pool/switch(自动备份+/api/pool/restore 可归还); 读为登录态判据" },
      { surface: "settings/rules/memories/对话/MCP(官方 IDE 数据面)", policy: "1:1 同步镜像(env-sync/backup 只读采集); MCP 写仅经显式 /api/inject/apply-mcp" },
    ],
    coexistence: { ref: "/api/coexist", note: "与独立同类插件(dao-vsix/dao-one/proxy-pro/min)共存时的共享/隔离判定与只读兄弟账号可见性" },
    syncAudit: { ref: "/api/sync/audit", roundtrip: "POST /api/sync/roundtrip", note: "官方↔插件全资源真源归一审计与写后对侧复读活体探测(探针写后原样还原)" },
  };
}

// 当前活动号 apiKey(用于账号池「活动」判据); LS 未就绪时安全回空串, 不抛。
function safeApiKey() { try { return ls.apiKey() || ""; } catch (_) { return ""; } }

// 登录体感后端流: 官方 CLI manual-token 登录由插件编排(devin-provision 同源), 状态单飞。
let _login = null; // { url, ctl, done }

// Devin Cloud 一次性连接(官方 /acp/live 同源): 用完即断, 不常驻。
async function withCloud(fn) {
  const c = new AcpWssClient({ log: () => {}, onUpdate: () => {} });
  try {
    await c.connect();
    return await fn(c);
  } finally { try { c.stop(); } catch (_) {} }
}

// Devin Cloud 常驻长连接: /api/cloud/live 开关, 实时更新入环形缓冲(/api/cloud/updates 增量取)。
let _live = null; // { client, seq, buf: [{seq,ts,update}] }
const LIVE_BUF_MAX = 500;
function liveState() {
  if (!_live) return { on: false };
  const ws = _live.client && _live.client._ws;
  return { on: true, connected: !!(ws && ws.readyState === 1), buffered: _live.buf.length, seq: _live.seq };
}
async function liveOn() {
  if (_live && _live.client._ws && _live.client._ws.readyState === 1) return liveState();
  if (_live) { try { _live.client.stop(); } catch (_) {} }
  const st = { client: null, seq: 0, buf: _live ? _live.buf : [] };
  st.client = new AcpWssClient({ log: () => {}, onUpdate: (u) => {
    st.seq += 1;
    st.buf.push({ seq: st.seq, ts: new Date().toISOString(), update: u });
    if (st.buf.length > LIVE_BUF_MAX) st.buf.splice(0, st.buf.length - LIVE_BUF_MAX);
  } });
  _live = st;
  await st.client.connect();
  return liveState();
}
function liveOff() {
  if (_live) { try { _live.client.stop(); } catch (_) {} _live = null; }
  return { on: false };
}

// POST 路由(后端原生调度): AI/脚本可直接驱动 Cascade 会话, 与面板同源(ls-bridge 同一真源)。
async function postRoutes(u, body) {
  if (u === "/api/cloud/live") {
    return (body || {}).on === false ? liveOff() : liveOn();
  }
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
    const wait = !!(body || {}).wait;
    const drive = ls.driveStream(cid, null);
    try {
      await ls.call("SendUserCascadeMessage", {
        cascadeId: cid, items: [{ text }],
        cascadeConfig: { plannerConfig: { requestedModelUid: uid, toolConfig: { askUserQuestion: { enabled: true } } } },
      });
      if (wait) {
        // wait:true 与 /api/cloud/send 对等: 轮询至运行态归 IDLE, 拿回本轮回复正文
        const timeoutMs = Math.min(Number((body || {}).timeoutMs) || 120000, 300000);
        const t0 = Date.now();
        let reply = "", idleSeen = 0;
        while (Date.now() - t0 < timeoutMs) {
          await new Promise((r) => setTimeout(r, 1500));
          const [tr, st] = await Promise.all([
            ls.call("GetAllCascadeTrajectories", {}),
            ls.call("GetCascadeTrajectorySteps", { cascadeId: cid }),
          ]);
          const sum = ((tr || {}).trajectorySummaries || {})[cid] || {};
          reply = (st.steps || [])
            .map((s) => (s.plannerResponse && s.plannerResponse.response) || "")
            .filter(Boolean).pop() || "";
          if (sum.status === "CASCADE_RUN_STATUS_IDLE" && ++idleSeen >= 2 && reply) break;
        }
        return { ok: true, cascadeId: cid, modelUid: uid, reply };
      }
    } finally { setTimeout(() => { try { drive.close(); } catch (_) {} }, 120000).unref(); }
    return { ok: true, cascadeId: cid, modelUid: uid };
  }
  if (u === "/api/cloud/send") {
    const text = String((body || {}).text || "").trim();
    if (!text) throw new Error("text required");
    // 长连接在线时直接复用常驻客户端(更新同时入 live 缓冲), 否则一次性连接
    if (_live && _live.client._ws && _live.client._ws.readyState === 1) {
      const c = _live.client;
      let out = "";
      const tap = (u2) => {
        try {
          const s = u2.update || u2;
          if ((s.sessionUpdate || s.kind) === "agent_message_chunk") out += ((s.content || {}).text) || "";
        } catch (_) {}
      };
      const unsub = c.onUpdate(tap);
      try {
        if ((body || {}).sessionId) await c.loadSession(body.sessionId);
        else if (!c.sessionId) await c.newSession("/");
        const r = await c.prompt(text);
        return { ok: true, live: true, sessionId: c.sessionId, stopReason: (r || {}).stopReason || "", reply: out };
      } finally { unsub(); }
    }
    return withCloud(async (c) => {
      let out = "";
      c.onUpdate((u2) => {
        try {
          const s = u2.update || u2;
          if ((s.sessionUpdate || s.kind) === "agent_message_chunk") out += ((s.content || {}).text) || "";
        } catch (_) {}
      });
      if ((body || {}).sessionId) await c.loadSession(body.sessionId);
      else await c.newSession("/");
      const r = await c.prompt(text);
      return { ok: true, sessionId: c.sessionId, stopReason: (r || {}).stopReason || "", reply: out };
    });
  }
  if (u === "/api/cloud/cancel") {
    const sid = String((body || {}).sessionId || "");
    if (!sid) throw new Error("sessionId required");
    return withCloud(async (c) => {
      await c.loadSession(sid);
      await c.cancel();
      return { ok: true, sessionId: sid };
    });
  }
  if (u === "/api/backup/run") {
    return backup.backupAll(ls, body || {});
  }
  if (u === "/api/sync/roundtrip") {
    return syncAudit.roundtrip((body || {}).only || null);
  }
  if (u === "/api/coexist/roundtrip") {
    return coexist.roundtrip((body || {}).only || null);
  }
  if (u === "/api/sync/rpc-roundtrip") {
    return require("./sync-rpc").roundtrip({});
  }
  if (u === "/api/cascade/matrix-roundtrip") {
    // 会话变更跨侧矩阵(R158): rename/archive 写官方真源→GetAllCascadeTrajectories 复读→还原。
    if (!ls.ready()) return { ok: false, available: false, note: "官方 LS 不可用, 矩阵未验证 — 如实标注, 不伪称" };
    return require("./sync-rpc").sessionMatrixRoundtrip(null);
  }
  if (u === "/api/auth/login") {
    if (_login) return { ok: true, pending: true, url: _login.url || "" };
    const bin = provision.resolveEngine(null, null);
    if (!bin) throw new Error("devin binary not found");
    return new Promise((resolve, reject) => {
      const st = { url: "", ctl: null, done: null };
      _login = st;
      const t = setTimeout(() => { if (!st.url) { _login = null; try { st.ctl.cancel(); } catch (_) {} reject(new Error("login url timeout")); } }, 30000);
      // 全程兼平: 领 URL 后若 10 分钟内未完成(未提交 code), 自动收尾释放单飞锁, 避免永久 pending
      setTimeout(() => { if (_login === st && !st.done) { try { st.ctl.cancel(); } catch (_) {} _login = null; } }, 600000).unref();
      st.ctl = provision.startLogin(bin, {
        onUrl: (url) => { st.url = url; clearTimeout(t); resolve({ ok: true, pending: true, url }); },
        onDone: (r) => { st.done = r; _login = null; if (!st.url) { clearTimeout(t); (r.ok ? resolve({ ok: true, pending: false }) : reject(new Error(r.message || "login failed"))); } },
      });
    });
  }
  if (u === "/api/auth/code") {
    const code = String((body || {}).code || "").trim();
    if (!code) throw new Error("code required");
    if (!_login) throw new Error("no pending login");
    const st = _login;
    st.ctl.submitCode(code);
    for (let i = 0; i < 60; i++) {
      if (st.done) return { ok: !!st.done.ok, message: st.done.ok ? "Login successful" : (st.done.message || "").slice(0, 200) };
      await new Promise((r) => setTimeout(r, 1000));
    }
    throw new Error("login result timeout");
  }
  if (u === "/api/auth/cancel") {
    if (_login) { try { _login.ctl.cancel(); } catch (_) {} _login = null; }
    return { ok: true };
  }
  if (u === "/api/auth/logout") {
    const bin = provision.resolveEngine(null, null);
    if (!bin) throw new Error("devin binary not found");
    return new Promise((resolve) => {
      execFile(bin, ["auth", "logout"], { timeout: 20000 }, (err, so, se) => {
        resolve({ ok: !err, message: String(so || se || "").trim().slice(0, 200) });
      });
    });
  }
  const cid = String((body || {}).cascadeId || "");
  if (u === "/api/cascade/rename") {
    const name = String((body || {}).name || "").trim();
    if (!cid || !name) throw new Error("cascadeId and name required");
    await ls.call("RenameCascadeTrajectory", { cascadeId: cid, name });
    return { ok: true, cascadeId: cid, name };
  }
  if (u === "/api/cascade/archive") {
    if (!cid) throw new Error("cascadeId required");
    await ls.call("ArchiveCascadeTrajectory", { cascadeId: cid, isArchived: (body || {}).isArchived !== false });
    return { ok: true, cascadeId: cid };
  }
  if (u === "/api/cascade/delete") {
    if (!cid) throw new Error("cascadeId required");
    await ls.call("DeleteCascadeTrajectory", { cascadeId: cid });
    return { ok: true, cascadeId: cid };
  }
  if (u === "/api/cascade/cancel") {
    if (!cid) throw new Error("cascadeId required");
    await ls.call("CancelCascadeInvocationAndWait", { cascadeId: cid })
      .catch(() => ls.call("CancelCascadeInvocation", { cascadeId: cid }));
    return { ok: true, cascadeId: cid };
  }
  if (u === "/api/settings") {
    const patch = (body || {}).patch;
    if (!patch || typeof patch !== "object") throw new Error("patch required");
    const s = (await ls.call("GetUserSettings", {})).userSettings || {};
    await ls.call("SetUserSettings", { userSettings: Object.assign(s, patch) });
    return { ok: true, keys: Object.keys(patch) };
  }
  if (u === "/api/memory/update") {
    const id = String((body || {}).memoryId || "");
    const content = String((body || {}).content || "");
    if (!id || !content) throw new Error("memoryId and content required");
    await ls.call("UpdateCascadeMemory", { memoryId: id, title: (body || {}).title || "", content, tags: (body || {}).tags || [] });
    return { ok: true, memoryId: id };
  }
  if (u === "/api/cascade/queue") {
    const text = String((body || {}).text || "").trim();
    if (!cid || !text) throw new Error("cascadeId and text required");
    const r = await ls.call("QueueCascadeMessage", { cascadeId: cid, items: [{ text }] });
    return { ok: true, cascadeId: cid, queueId: (r || {}).queueId || "" };
  }
  if (u === "/api/cascade/branch") {
    const text = String((body || {}).text || "").trim();
    const si = (body || {}).stepIndex;
    if (!cid || !text || typeof si !== "number") throw new Error("cascadeId, stepIndex and text required");
    let uid = (body || {}).modelUid || "";
    if (!uid) {
      const ms = await ls.listModels();
      const pick = ms.find((m) => m.recommended && !m.disabled) || ms.find((m) => !m.disabled) || ms[0];
      uid = pick && pick.uid;
    }
    const r = await ls.call("BranchCascade", { baseCascadeId: cid, branchFromStepIndex: si, items: [{ text }],
      cascadeConfig: { plannerConfig: { requestedModelUid: uid } } });
    return { ok: true, baseCascadeId: cid, newCascadeId: (r || {}).newCascadeId || (r || {}).cascadeId || "" };
  }
  if (u === "/api/cascade/revert") {
    const si = (body || {}).stepIndex;
    if (!cid || typeof si !== "number") throw new Error("cascadeId and stepIndex required");
    const pv = await ls.call("GetRevertPreview", { cascadeId: cid, stepIndex: si }).catch(() => ({}));
    if ((body || {}).previewOnly) return { ok: true, cascadeId: cid, preview: (pv || {}).codeEditPreviews || [] };
    await ls.call("RevertToCascadeStep", { cascadeId: cid, stepIndex: si });
    return { ok: true, cascadeId: cid, stepIndex: si, reverted: ((pv || {}).codeEditPreviews || []).length };
  }
  if (u === "/api/memory/delete") {
    const id = String((body || {}).memoryId || "");
    if (!id) throw new Error("memoryId required");
    await ls.call("DeleteCascadeMemory", { memoryId: id });
    return { ok: true, memoryId: id };
  }
  // 官方 RPC 补齐(选择性·本源价值): 工作区动态纳管 / 补全配置写回 / 补全能力
  if (u === "/api/workspaces/add") {
    const ws = String((body || {}).workspace || "").trim();
    if (!ws) throw new Error("workspace required");
    const uri = /^[a-z]+:\/\//i.test(ws) ? ws : "file://" + ws; // 官方要 file:// URI
    await ls.call("AddTrackedWorkspace", { workspace: uri });
    return { ok: true, workspace: uri };
  }
  if (u === "/api/workspaces/remove") {
    const ws = String((body || {}).workspace || "").trim();
    if (!ws) throw new Error("workspace required");
    const uri = /^[a-z]+:\/\//i.test(ws) ? ws : "file://" + ws;
    await ls.call("RemoveTrackedWorkspace", { workspace: uri });
    return { ok: true, workspace: uri };
  }
  if (u === "/api/config/edit") {
    const cfg = (body || {}).completionConfiguration;
    if (!cfg || typeof cfg !== "object") throw new Error("completionConfiguration required");
    await ls.call("EditConfiguration", { completionConfiguration: cfg });
    return { ok: true, keys: Object.keys(cfg) };
  }
  if (u === "/api/completions") {
    const doc = (body || {}).document;
    if (!doc || typeof doc !== "object") throw new Error("document required(需含 text/editorLanguage/cursorOffset 等官方字段)");
    const req = { document: doc, editorOptions: (body || {}).editorOptions || { tabSize: 4, insertSpaces: true } };
    if ((body || {}).modelName) req.modelName = (body || {}).modelName;
    const r = await ls.call("GetCompletions", req);
    const items = (r && (r.completionItems || r.completions)) || [];
    return { ok: true, count: items.length, completionItems: items };
  }
  // ── 六大板块写操作(零 GUI 调度; 凭据只入私有存储, 视图恒脱敏) ──
  // Proxy Pro: 渠道存取 / 识别模型 / 模型路由(路由生效由 ls-bridge 请求期消费)
  if (u === "/api/proxy/channel/add") {
    const b = body || {};
    const name = String(b.name || "").trim();
    if (!name) throw new Error("name required");
    const r = await proxyPro.addChannel(name, b.type || "openai", b.baseURL || "", b.apiKey || "");
    return { ok: true, channel: r };
  }
  if (u === "/api/proxy/channel/remove") {
    const name = String((body || {}).name || "").trim();
    if (!name) throw new Error("name required");
    return { ok: true, removed: proxyPro.removeChannel(name) };
  }
  if (u === "/api/proxy/channel/refresh") {
    const name = String((body || {}).name || "").trim();
    if (!name) throw new Error("name required");
    return { ok: true, result: await proxyPro.refreshModels(name) };
  }
  if (u === "/api/proxy/route") {
    const uid = String((body || {}).uid || "").trim();
    if (!uid) throw new Error("uid required");
    return { ok: true, result: proxyPro.setRoute(uid, (body || {}).channel || "", (body || {}).model || "") };
  }
  if (u === "/api/proxy/chat") {
    // 路由生效层: 给定官方模型 UID, 真正投递到其路由的第三方渠道/模型(消费 cfg.routes)。
    const b = body || {};
    const uid = String(b.uid || "").trim();
    if (!uid) throw new Error("uid required");
    let messages = b.messages;
    if (!Array.isArray(messages)) {
      const text = String(b.text || "").trim();
      if (!text) throw new Error("messages(数组) 或 text required");
      messages = [{ role: "user", content: text }];
    }
    return proxyRuntime.chat(uid, { messages, temperature: b.temperature, maxTokens: b.maxTokens, timeoutMs: b.timeoutMs });
  }
  // 账号池切号: 收录当前号 / 切换 / 移除(严禁回退, 无 key 报错)
  if (u === "/api/pool/capture") {
    const acct = (body || {}).account || accountView();
    return { ok: true, result: accountPool.captureCurrent(safeApiKey(), acct) };
  }
  if (u === "/api/pool/switch") {
    const email = String((body || {}).email || "").trim();
    if (!email) throw new Error("email required");
    return { ok: true, result: accountPool.switchTo(email) };
  }
  if (u === "/api/pool/restore") {
    return { ok: true, result: accountPool.restoreOriginal() };
  }
  if (u === "/api/pool/remove") {
    const email = String((body || {}).email || "").trim();
    if (!email) throw new Error("email required");
    return { ok: true, result: accountPool.remove(email) };
  }
  // 反向注入: 增删注入档 / MCP 即刻本机落地(secret 值绝不出后端)
  if (u === "/api/inject/add") {
    const b = body || {};
    return { ok: true, result: inject.addItem(b.kind, b.name, b.spec) };
  }
  if (u === "/api/inject/remove") {
    const b = body || {};
    if (!b.kind || !b.name) throw new Error("kind and name required");
    return { ok: true, result: inject.removeItem(b.kind, b.name) };
  }
  if (u === "/api/inject/apply-mcp") {
    return { ok: true, result: await inject.applyMcp(ls) };
  }
  // GitHub 舰队(纯 GitHub 纵向, 与 Devin 账号池分离): 增删 / 定角 / 核队
  if (u === "/api/github/add") {
    const b = body || {};
    return { ok: true, result: await githubFleet.addAccount(b.pat, b.login || "", b.role || "member") };
  }
  if (u === "/api/github/remove") {
    const login = String((body || {}).login || "").trim();
    if (!login) throw new Error("login required");
    return { ok: true, result: githubFleet.remove(login) };
  }
  if (u === "/api/github/role") {
    const b = body || {};
    if (!b.login) throw new Error("login required");
    return { ok: true, result: githubFleet.setRole(b.login, b.role) };
  }
  if (u === "/api/github/verify") {
    return { ok: true, results: await githubFleet.verifyAll() };
  }
  // Web 搜索: 站内直出 + 历史清理
  if (u === "/api/search") {
    const query = String((body || {}).query || (body || {}).q || "").trim();
    if (!query) throw new Error("query required");
    return webSearch.search(query, (body || {}).engine || "");
  }
  if (u === "/api/search/clear") {
    return { ok: true, result: webSearch.clearHistory() };
  }
  // Windows Agent: 注册 local/remote 通道 / 注销(接入官方 MCP 工具层)
  if (u === "/api/winagent/local") {
    const b = body || {};
    return winAgent.registerLocal({ dir: b.dir, bridgeUrl: b.bridgeUrl, token: b.token, disabled: b.disabled });
  }
  if (u === "/api/winagent/remote") {
    const b = body || {};
    if (!b.url) throw new Error("url required");
    return winAgent.registerRemote({ url: b.url, token: b.token, disabled: b.disabled });
  }
  if (u === "/api/winagent/unregister") {
    return winAgent.unregister();
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
      // 内置浏览器站内代理(iframe 无法带 header, token 走 query 校验)
      if (u === "/web") { try { if (require("./web-embed").handle(req, res, _token)) return; } catch (e) { return send(500, { error: e.message }); } }
      if (u === "/api/health") return send(200, { ok: true, service: "dao-desktop-local-api", port: _port });
      // 协议自描述免鉴权: 任意 AI/Agent 先自发现协议, 再持 token 调用(文档本身不含凭据)
      if (u === "/api/openapi" && req.method !== "POST") return send(200, require("./api-schema").openapi({ port: _port }));
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
