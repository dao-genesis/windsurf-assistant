"use strict";
// ═══════════════════════════════════════════════════════════════════════════
// devin_git.js · RT Flow 第三板块 · Git(GitHub) 接入底层 (无 vscode 依赖 · 可单测)
//
// 帛书·「物无非彼，物无非是」: 把 devin-git-auth 的核心资源模块整合进 rt-flow,
// 与第五板块 Devin Cloud 共用同一底层传输(devin_cloud.rawRequest · 统一代理+TLS 重试),
// 共用同一账号池(~/.dao / ~/.wam)与登录态(auth1)。
//
// 一个 Devin 账号(email+password → auth1+orgId)即可:
//   · 用 GitHub PAT 归一连接到同一个 GitHub 账号与仓库 (injectGitHubPAT + ensureGithubPatSecret)
//   · 显示已绑定身份(@login)、可达仓库数、密钥落库状态 (gitStatus)
//   · 真解绑(连接数归零 + OAuth 用户断开 + 密钥真删) (robustDisconnectGit · 复查扫除)
//
// 软编码·唯变所适: 端点集中于 EP, 凭证只在内存与 ~/.dao 缓存, 绝不写入仓库。
// ═══════════════════════════════════════════════════════════════════════════
const fs = require("fs");
const path = require("path");
const os = require("os");
const cloud = require("./devin_cloud");

const API = cloud.CFG.apiBase; // https://app.devin.ai/api
const GH_API = "https://api.github.com";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function authHeaders(auth, extra) {
  return Object.assign(
    { Authorization: "Bearer " + auth.auth1, "x-cog-org-id": auth.orgId },
    extra || {},
  );
}
function bare(auth) {
  return auth.orgBare || String(auth.orgId || "").replace(/^org-/, "");
}

// ═══ 已注册态分流 (纯函数 · 可单测 · 不臆造·不强为) ══════════════════════════
// 当 injectGitHubPAT 回报 alreadyRegistered 时, 依据「PAT 主身份 / 现有连接 / 是否有可达仓库」
// 判定唯一安全动作。抽为纯函数, 使决策可脱离网络被单测穷举 (实测教训→回归护栏):
//   existing: 已归一到本 PAT 主且有仓库 → 幂等成功·不动;
//   ghost:    已注册却无任何连接 → 平台孤儿态·API 不可清·如实回报;
//   reinject: individual_token 连到别身份 / 或 0 仓库陈旧 → 可断净重注入复活 (实测安全);
//   app:      github_app(OAuth) 连接 → 绝不主动断 (断后标记不清·落孤儿态)·如实回报上官网移除。
function classifyRegisteredState({ ownerLogin, connections, hasRepos } = {}) {
  const list = Array.isArray(connections) ? connections : [];
  const first = list[0] || {};
  const curName = String(first.name || "").toLowerCase();
  const owner = String(ownerLogin || "").toLowerCase();
  const sameOwner = !!owner && !!curName && curName === owner;
  const allIndividual =
    list.length > 0 &&
    list.every((c) => /individual/.test(String((c && c.type) || "").toLowerCase()));
  if (hasRepos && sameOwner) return "existing";
  if (list.length === 0) return "ghost";
  if (allIndividual) return "reinject";
  return "app";
}
async function jGet(auth, url, timeoutMs) {
  return cloud.jsonRequest("GET", url, authHeaders(auth), null, timeoutMs);
}
async function jPost(auth, url, body, timeoutMs) {
  return cloud.jsonRequest("POST", url, authHeaders(auth), body || {}, timeoutMs);
}
async function jDelete(auth, url, timeoutMs) {
  return cloud.jsonRequest("DELETE", url, authHeaders(auth), null, timeoutMs);
}

// ═══ Git 连接 / 身份 / 仓库 (读) ════════════════════════════════════════════
async function checkGitConnections(auth) {
  const r = await jGet(auth, API + "/organizations/" + auth.orgId + "/git-connections-metadata");
  if (r.status === 200 && r.json) {
    const conns = Array.isArray(r.json) ? r.json : r.json.git_connections || r.json.connections || [];
    return { ok: true, connections: conns, count: conns.length };
  }
  return { ok: false, connections: [], count: 0, error: (r.text || "").slice(0, 120) };
}

// 已绑定 GitHub 身份 (PAT/OAuth 均会surface @login)
async function getGitHubUser(auth) {
  const r = await jGet(auth, API + "/integrations/github/user");
  if (r.status === 200 && r.json) {
    const d = r.json;
    const login = d.login || d.username || d.user || (d.user && d.user.login) || "";
    return { ok: true, login, data: d };
  }
  return { ok: false, login: "", data: null };
}

async function getGitHubIntegration(auth) {
  const r = await jGet(auth, API + "/org-" + bare(auth) + "/integrations/github");
  if (r.status === 200 && r.json) return { ok: true, data: r.json };
  return { ok: false, data: null };
}

// 仓库可达性核验 · 连接成功的真凭实据 = 该 org 能否列出目标 GitHub 仓库 (摊平 full_name)
async function getAccessibleRepos(auth) {
  const r = await jGet(auth, API + "/org-" + bare(auth) + "/integrations/github/repos");
  if (r.status !== 200 || !r.json) return { ok: false, repos: [], error: "status=" + r.status };
  const groups = Array.isArray(r.json) ? r.json : r.json.repos || r.json.repositories || [];
  const flat = [];
  groups.forEach((g) => {
    if (g && g.gh_repos) g.gh_repos.forEach((rp) => { if (rp && rp.full_name) flat.push(rp.full_name); });
    else if (g && (g.full_name || g.name)) flat.push(g.full_name || g.name);
  });
  return { ok: true, repos: flat };
}

// ═══ 密钥 GITHUB_PAT (写后复制延迟 · 双读确认落库) ═══════════════════════════
async function listSecrets(auth) {
  const r = await jGet(auth, API + "/org-" + bare(auth) + "/secrets");
  if (r.status !== 200 || !r.json) return [];
  return Array.isArray(r.json) ? r.json : r.json.secrets || [];
}
async function hasGithubPatSecret(auth) {
  const secrets = await listSecrets(auth);
  return !!secrets.find((s) => s.key === "GITHUB_PAT" || s.name === "GITHUB_PAT");
}
async function injectSecret(auth, name, value) {
  const r = await jPost(auth, API + "/org-" + bare(auth) + "/secrets", {
    key: name, value, type: "key-value", sensitive: true, note: name,
  });
  if (r.status === 200 || r.status === 201 || r.status === 409)
    return { ok: true, existed: r.status === 409 };
  return { ok: false, error: (r.text || "").slice(0, 120) };
}
// 注入并校验落库: settle 后「连续两次」读到才算稳态(排除尚未持久化的瞬态副本), 最多 3 轮。
// v4.27.0 · 覆盖式更新(问题④): Devin secrets 端点对同 key 二次 POST 返回 409 且**保留旧值**
//   (injectSecret 视 409 为 existed·不改值)。故用户输入新 PAT 时, 旧 GITHUB_PAT 会被静默保留,
//   后续对话/自动注入仍用陈旧 PAT。此处默认 override=true: 先删旧 GITHUB_PAT 再注新值, 令新 PAT 必生效。
//   (secrets API 不回吐明文·无法比对值, 故覆盖模式下无条件先删后注, 由外层双读确认落库。)
async function ensureGithubPatSecret(auth, pat, opts) {
  const override = !opts || opts.override !== false; // 默认覆盖: 新 PAT 以新值为准
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (override) { try { await deleteSecret(auth, "GITHUB_PAT"); } catch (e) {} await sleep(400); }
      await injectSecret(auth, "GITHUB_PAT", pat);
    } catch (e) {}
    await sleep(1200);
    try {
      if (await hasGithubPatSecret(auth)) { await sleep(600); if (await hasGithubPatSecret(auth)) return true; }
    } catch (e) {}
    await sleep(800);
  }
  return false;
}
// 删除组织 Secret · 彻底解绑(删后零关联): 正确端点 DELETE /api/secrets/{id} (id 全局唯一·路径不含 org)
async function deleteSecret(auth, name) {
  const secrets = await listSecrets(auth);
  const hit = secrets.find((s) => s.key === name || s.name === name);
  if (!hit) return { ok: true, missing: true };
  const sid = hit.id || hit.secret_id;
  if (!sid) return { ok: false, error: "no_secret_id" };
  const r = await jDelete(auth, API + "/secrets/" + encodeURIComponent(sid));
  if (r.status === 200 || r.status === 204 || r.status === 404) return { ok: true };
  return { ok: false, error: "status=" + r.status };
}

// ═══ PAT 注入 / OAuth ════════════════════════════════════════════════════════
// v4.6.0 · 问题⑥根因(对真实 org 取证·不臆造):
//   端点恒为 POST /{orgId}/integrations/github/pat (其 org-{bare} 写法与之同串;
//   /organizations/{orgId}/… 与无 org /integrations/… 均 404)。body 字段名必须为 `pat`
//   (实测其它字段名一律 422 {"loc":["body","pat"],"msg":"Field required"})。
//   连接成功的真凭实据 = 注入后 org 出现 github_individual_token 连接, 且可达仓库列出目标仓库
//   (实测注入后仓库异步落库, 约 2-5s 才 surface, 故 connectWithPat 轮询至 repos>0)。
async function injectGitHubPAT(auth, pat) {
  const url = API + "/" + auth.orgId + "/integrations/github/pat";
  let r;
  try { r = await jPost(auth, url, { pat }, 60000); }
  catch (e) { return { ok: false, error: (e && e.message) || "post err" }; }
  if (r.status === 200 || r.status === 201) return { ok: true, via: url };
  const t = (r.text || "").toLowerCase();
  if (r.status === 400 && t.includes("already registered"))
    return { ok: false, alreadyRegistered: true, error: "该组织已注册 GitHub 集成" };
  if ((r.status === 400 || r.status === 401 || r.status === 403) &&
      /(invalid|bad credentials|unauthorized|forbidden|expired|permission|scope)/.test(t))
    return { ok: false, invalidPat: true, error: "PAT 无效/过期/权限不足 (需 repo 权限): " + (r.text || "").slice(0, 120) };
  return { ok: false, error: (r.text || "").slice(0, 160) || "status=" + r.status };
}

// v4.6.0 · PAT 主身份 (归一判据): 直查 GitHub /user 取 login, 用于判断现有连接是否已是同一 PAT 主。
//   (实测: 不同账号可能连到了别的 GitHub 身份 jenna…/rchimiegos…, 须断净改连到本 PAT 主才算"归一同仓")。
const _patOwnerCache = {};
async function _patOwnerLogin(pat) {
  if (pat in _patOwnerCache) return _patOwnerCache[pat];
  let login = "";
  try {
    const r = await cloud.jsonRequest("GET", GH_API + "/user",
      { Authorization: "Bearer " + pat, "User-Agent": "rt-flow-git", Accept: "application/vnd.github+json" }, null, 20000);
    if (r.status === 200 && r.json) login = r.json.login || "";
  } catch (e) {}
  _patOwnerCache[pat] = login;
  return login;
}

// v4.6.0 · 真断该 org 现有全部 Git 连接 (按 name + connection_id 双删) → 返回删除前连接数。
//   用于"已注册但仓库为 0"的陈旧/僵尸连接复活: 先断净再重注入即可恢复(实测 repos 0→26)。
async function _disconnectAllConnections(auth) {
  const gc = await checkGitConnections(auth);
  const list = gc.connections || [];
  for (const c of list) {
    const nm = c.name || c.installation_name || "github";
    const cid = c.id || c.git_connection_id || c.connection_id;
    try { await disconnectGitHubConnection(auth, nm, c.host || "github.com"); } catch (e) {}
    if (cid) { try { await disconnectGitHubPAT(auth, cid); } catch (e) {} }
  }
  return list.length;
}

// ═══ 断开族 ════════════════════════════════════════════════════════════════
async function disconnectGitHubConnection(auth, connectionName, host) {
  const h = host || "github.com";
  const name = connectionName || "github";
  const q = "?name=" + encodeURIComponent(name) + "&host=" + encodeURIComponent(h);
  let r = await jDelete(auth, API + "/org-" + bare(auth) + "/integrations/github" + q);
  if (r.status === 200 || r.status === 204) return { ok: true };
  if (r.status === 404) {
    r = await jDelete(auth, API + "/" + auth.orgId + "/integrations/github" + q);
    if (r.status === 200 || r.status === 204) return { ok: true };
  }
  return { ok: false, status: r.status, error: (r.text || "").slice(0, 200) };
}
// v4.6.0 · 真断 GitHub 身份/OAuth (问题⑦: 水过无痕后仍残留可发消息 ⇒ 身份层未断)。
//   单端点不足以断净: GitHub 身份可能落在 账号级(/integrations/github/user) 或
//   组织级(/org-{bare}/integrations/github) 或 App 安装层。逐候选实探, 任一 2xx 即记成功,
//   并全部走一遍 (而非命中即停) 以确保各层都被尝试断开。
async function disconnectGitHubUser(auth) {
  const eps = [
    API + "/integrations/github/user",
    API + "/integrations/github",
    API + "/org-" + bare(auth) + "/integrations/github/user",
    API + "/org-" + bare(auth) + "/integrations/github",
    API + "/" + auth.orgId + "/integrations/github/user",
    API + "/" + auth.orgId + "/integrations/github",
  ];
  let any = false, lastStatus = 0, lastErr = "";
  for (const url of eps) {
    let r;
    try { r = await jDelete(auth, url); } catch (e) { lastErr = (e && e.message) || "del err"; continue; }
    lastStatus = r.status;
    if (r.status === 200 || r.status === 204) { any = true; continue; }
    if (r.status !== 404 && r.status !== 405) lastErr = (r.text || "").slice(0, 160) || "status=" + r.status;
  }
  return any ? { ok: true } : { ok: false, status: lastStatus, error: lastErr };
}
async function disconnectGitHubPAT(auth, connectionId) {
  const r = await jDelete(auth, API + "/" + auth.orgId + "/integrations/github/pat?connection_id=" + connectionId);
  if (r.status === 200 || r.status === 204) return { ok: true };
  return { ok: false, status: r.status, error: (r.text || "").slice(0, 200) };
}

// ═══ 健壮断开 · 真解绑须连接数归零(复查扫除·反复至成) ═══════════════════════
async function robustDisconnectGit(auth) {
  const logs = [];
  const gc = await checkGitConnections(auth);
  if (gc.ok && gc.count > 0) {
    for (let i = 0; i < gc.connections.length; i++) {
      const c = gc.connections[i];
      const cName = c.name || c.installation_name || "github";
      const cHost = c.host || "github.com";
      const cId = c.id || c.git_connection_id || c.connection_id || null;
      logs.push("连接[" + i + "]: " + cName + " @ " + cHost + " type=" + (c.type || "?"));
      const disR = await disconnectGitHubConnection(auth, cName, cHost);
      logs.push("断开name+host: " + (disR.ok ? "OK" : "FAIL " + (disR.error || "").slice(0, 60)));
      if (cId) {
        const patDisR = await disconnectGitHubPAT(auth, cId);
        logs.push("断开PAT连接: " + (patDisR.ok ? "OK" : "SKIP"));
      }
    }
  } else {
    logs.push("当前无Git连接, 尝试通用断开");
    const disR2 = await disconnectGitHubConnection(auth, "github", "github.com");
    logs.push("通用断开: " + (disR2.ok ? "OK" : "FAIL " + (disR2.error || "").slice(0, 60)));
  }
  const userDisR = await disconnectGitHubUser(auth);
  logs.push("断开OAuth用户: " + (userDisR.ok ? "OK" : "FAIL " + (userDisR.error || "").slice(0, 60)));
  const secDelR = await deleteSecret(auth, "GITHUB_PAT");
  logs.push("删除GITHUB_PAT密钥: " + (secDelR.ok ? (secDelR.missing ? "无需(不存在)" : "OK") : "FAIL " + (secDelR.error || "").slice(0, 60)));
  // 复查并扫除残留: 刚建连接首次断开可能尚未可删(瞬态), settle 后按 id 逐个强删, 最多 3 轮。
  for (let attempt = 0; attempt < 3; attempt++) {
    await sleep(800);
    const vc = await checkGitConnections(auth);
    if (!vc.ok) { logs.push("复查连接失败: " + (vc.error || "")); break; }
    if (vc.count === 0) { logs.push("复查: 连接已归零"); break; }
    logs.push("复查[轮" + (attempt + 1) + "]: 残留 " + vc.count + " 个, 强删");
    for (let j = 0; j < vc.connections.length; j++) {
      const rc = vc.connections[j];
      const rcName = rc.name || rc.installation_name || "github";
      const rcId = rc.id || rc.git_connection_id || rc.connection_id || null;
      try { await disconnectGitHubConnection(auth, rcName, rc.host || "github.com"); } catch (e) {}
      if (rcId) {
        const rr = await disconnectGitHubPAT(auth, rcId);
        logs.push("  强删 " + rcName + "(" + (rc.type || "?") + "): " + (rr.ok ? "OK" : "FAIL"));
      }
    }
  }
  // v4.6.0 · 终态核验 (问题⑦): 身份/仓库/密钥三者皆空才算真水过无痕。
  //   仍残留则二次断身份 + 报明残留, 不臆造"已断净"。
  try {
    await sleep(600);
    let fin = await _verifyGitCleared(auth);
    if (!fin.cleared) {
      logs.push("终核: 残留 " + fin.desc + " → 二次断身份");
      try { await disconnectGitHubUser(auth); } catch (e) {}
      await sleep(800);
      fin = await _verifyGitCleared(auth);
    }
    logs.push(fin.cleared ? "终核: 已真水过无痕(身份/仓库/连接/密钥皆空)" : "终核: 仍残留 " + fin.desc + " (需上官网手动撤销 GitHub App 授权)");
  } catch (e) { logs.push("终核异常: " + (e && e.message)); }
  return logs;
}
// v4.6.0 · 核验 GitHub 是否真断净: 身份 login 空 + 可达仓库 0 + 连接 0 + 无 PAT 密钥
async function _verifyGitCleared(auth) {
  const [user, repos, conns, sec] = await Promise.all([
    getGitHubUser(auth).catch(() => ({ ok: false, login: "" })),
    getAccessibleRepos(auth).catch(() => ({ ok: false, repos: [] })),
    checkGitConnections(auth).catch(() => ({ ok: false, count: 0 })),
    hasGithubPatSecret(auth).catch(() => false),
  ]);
  const login = user.login || "";
  const repoCount = (repos.repos || []).length;
  const connCount = conns.count || 0;
  const cleared = !login && repoCount === 0 && connCount === 0 && !sec;
  const parts = [];
  if (login) parts.push("身份@" + login);
  if (repoCount) parts.push(repoCount + "仓库");
  if (connCount) parts.push(connCount + "连接");
  if (sec) parts.push("GITHUB_PAT密钥");
  return { cleared, desc: parts.join("/") || "无", login, repoCount, connCount, secret: !!sec };
}

// 切换后清理残留 · 自由切换须干净(A→B 后不留 A), 只保留 keepName
async function cleanupStaleConnections(auth, keepName) {
  const logs = [];
  try {
    const gc = await checkGitConnections(auth);
    if (!gc.ok || !gc.connections) return logs;
    for (let i = 0; i < gc.connections.length; i++) {
      const c = gc.connections[i];
      const cName = c.name || c.installation_name || "";
      const cId = c.id || c.git_connection_id || c.connection_id || null;
      if (keepName && cName === keepName) continue;
      try { await disconnectGitHubConnection(auth, cName, c.host || "github.com"); } catch (e) {}
      if (cId) {
        const r = await disconnectGitHubPAT(auth, cId);
        logs.push("清理残留 " + cName + "(" + (c.type || "?") + "): " + (r.ok ? "OK" : "FAIL"));
      }
    }
  } catch (e) { logs.push("cleanup异常 " + (e && e.message)); }
  return logs;
}

// ═══ 高层组合 · 归一连接 / 状态 ═══════════════════════════════════════════════
// connectWithPat: 注入 PAT → (已注册且 0 仓库则先断净再重注入) → 落库密钥 → 轮询可达仓库 → 真凭实据
//   实测确证的连接成功标准: org 出现 github_individual_token 连接 且 getAccessibleRepos 列出 PAT 主的仓库。
async function connectWithPat(auth, pat) {
  if (!pat) return { ok: false, error: "无 PAT (请输入或在 ~/.dao/git-pats.json 配置)" };
  let inj = await injectGitHubPAT(auth, pat);
  let ghost = false;

  // 已注册: 安全分流 (实测教训·不臆造·不毁好连接) —
  //   实测确证: 只有 github_individual_token(本插件 PAT 所建)的连接可被 /pat?connection_id= 真断后重注入复活;
  //   github_app(OAuth)连接一旦断开, "已注册"标记并不随之清除 ⇒ 账号即落入不可经 API 复原的孤儿态。
  //   故对 github_app 连接「绝不主动断」, 只如实回报需上官网移除后再连 (无为·不强为)。
  let appConn = null;
  if (inj.alreadyRegistered) {
    const owner = await _patOwnerLogin(pat);
    const conns0 = await checkGitConnections(auth).catch(() => ({ connections: [] }));
    const repos0 = await getAccessibleRepos(auth).catch(() => ({ repos: [] }));
    const list0 = conns0.connections || [];
    const first = list0[0] || {};
    const hasRepos = (repos0.repos || []).length > 0;
    const action = classifyRegisteredState({ ownerLogin: owner, connections: list0, hasRepos });
    if (action === "existing") {
      inj = { ok: true, via: "existing" };                 // (a) 已归一到本 PAT 主且有仓库 → 幂等成功
    } else if (action === "ghost") {
      ghost = true;                                         // (d) 无连接却已注册 → 平台孤儿态, API 不可清
    } else if (action === "reinject") {
      // (b/c) individual_token: 连到别的身份 / 或 0 仓库陈旧 → 断净重注入 (实测安全可复活)
      await _disconnectAllConnections(auth);
      try { await disconnectGitHubUser(auth); } catch (e) {}
      await sleep(1500);
      const re = await injectGitHubPAT(auth, pat);
      inj = re;
    } else {
      // (e) github_app 连接(OAuth): 不主动断 (断后不可经 API 复原), 如实回报
      appConn = { name: first.name || "?", type: first.type || "github_app", repos: (repos0.repos || []).length };
      inj = { ok: false, appConn: true,
        error: "该账号经 GitHub App 连到身份 @" + appConn.name + " (" + appConn.repos + " 个仓库)。经 App 的连接断开后无法再用 PAT 重连(平台侧限制·会落入孤儿态)。如需归一到本 PAT 主, 请在 app.devin.ai 该组织 Settings→Integrations 手动移除该 GitHub App 后再连。" };
    }
  }

  const secOk = await ensureGithubPatSecret(auth, pat);
  // 仓库异步落库 (实测约 2-5s), 轮询至 repos>0 或超时 (~12s)
  let user = { login: "" }, repos = { repos: [] }, conns = { count: 0 };
  for (let i = 0; i < 6; i++) {
    await sleep(i === 0 ? 800 : 2200);
    [user, repos, conns] = await Promise.all([
      getGitHubUser(auth).catch(() => ({ ok: false, login: "" })),
      getAccessibleRepos(auth).catch(() => ({ ok: false, repos: [] })),
      checkGitConnections(auth).catch(() => ({ ok: false, count: 0 })),
    ]);
    if ((repos.repos || []).length > 0) break;
  }
  const repoCount = (repos.repos || []).length;
  const connCount = conns.count || 0;
  // PAT 连接下 /integrations/github/user 常空, 连接元数据的 name 即已绑 GitHub 身份, 作兜底。
  const connName = ((conns.connections || [])[0] || {});
  const login = user.login || connName.name || connName.installation_name || "";
  const ok = repoCount > 0 || connCount > 0 || inj.ok;
  return {
    ok,
    login,
    repoCount,
    repos: (repos.repos || []).slice(0, 50),
    connections: connCount,
    secret: secOk,
    alreadyRegistered: !!inj.alreadyRegistered,
    invalidPat: !!inj.invalidPat,
    ghost,
    appConn: appConn || null,
    error: ok ? "" : (ghost
      ? "平台侧孤儿注册(已注册但无连接·API 不可清) — 需在 app.devin.ai 该组织 Settings→Integrations 手动移除 GitHub 后重连"
      : (inj.error || "连接未生效(0 连接·0 仓库)")),
  };
}

// gitStatus: 当前账号的 Git 绑定快照 (下拉框/概览用) — 不写, 只读
async function gitStatus(auth) {
  const [user, conns, secret, repos] = await Promise.all([
    getGitHubUser(auth).catch(() => ({ ok: false, login: "" })),
    checkGitConnections(auth).catch(() => ({ ok: false, count: 0, connections: [] })),
    hasGithubPatSecret(auth).catch(() => false),
    getAccessibleRepos(auth).catch(() => ({ ok: false, repos: [] })),
  ]);
  const connNames = (conns.connections || []).map((c) => c.name || c.installation_name || c.type || "github");
  return {
    login: user.login || connNames[0] || "",
    connections: conns.count || 0,
    connNames,
    secret: !!secret,
    repoCount: (repos.repos || []).length,
  };
}

// ═══ PAT 账号池 (~/.dao/git-pats.json) · 与 devin-git-auth 同源 ════════════════
// 形态: { "default": "ghp_...", "overrides": { "email@x": "ghp_..." } }
//   或  { "email@x": "ghp_...", "_default": "ghp_..." }
function loadPatPool() {
  const out = { default: "", overrides: {} };
  try {
    const j = JSON.parse(fs.readFileSync(path.join(os.homedir(), ".dao", "git-pats.json"), "utf8"));
    if (j && typeof j === "object") {
      out.default = j.defaultPat || j.default || j._default || j.pat || "";
      const ov = j.overrides || {};
      for (const k of Object.keys(j)) {
        if (/@/.test(k)) out.overrides[k.toLowerCase()] = j[k];
      }
      for (const k of Object.keys(ov)) out.overrides[k.toLowerCase()] = ov[k];
    }
  } catch (e) {}
  return out;
}
function patFor(email) {
  const pool = loadPatPool();
  return (email && pool.overrides[String(email).toLowerCase()]) || pool.default || "";
}

module.exports = {
  API,
  GH_API,
  // reads
  checkGitConnections,
  getGitHubUser,
  getGitHubIntegration,
  getAccessibleRepos,
  hasGithubPatSecret,
  listSecrets,
  gitStatus,
  // writes
  injectGitHubPAT,
  injectSecret,
  ensureGithubPatSecret,
  deleteSecret,
  connectWithPat,
  classifyRegisteredState,
  // disconnect
  disconnectGitHubConnection,
  disconnectGitHubUser,
  disconnectGitHubPAT,
  robustDisconnectGit,
  _verifyGitCleared,
  cleanupStaleConnections,
  // pat pool
  loadPatPool,
  patFor,
};
