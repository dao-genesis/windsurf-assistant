// 道 · 插件自持 GitHub 舰队(GitHub 板块后端) —— 纯 GitHub 纵向, 与 Devin/Cascade 账号池完全分离。
// ─────────────────────────────────────────────────────────────────────────────
// 舰队文件: ~/.dao/github-fleet.json (mode 600) —— [{login,pat,role,addedAt,verify?}]。
// 首个默认管理者(admin), 其余成员(member); 断网守柔: GitHub 不可达且带 login 仍先入队
// (verify='pending' 待网络恢复再核), 绝不因断网拒收。视图脱敏: PAT 只出尾 4 位指纹。
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const https = require("https");

function fleetPath() { return process.env.DAO_GITHUB_FLEET_FILE || path.join(os.homedir(), ".dao", "github-fleet.json"); }

function loadFleet() {
  try { const j = JSON.parse(fs.readFileSync(fleetPath(), "utf8")); return Array.isArray(j) ? j : []; }
  catch (_) { return []; }
}

function saveFleet(list) {
  fs.mkdirSync(path.dirname(fleetPath()), { recursive: true });
  fs.writeFileSync(fleetPath(), JSON.stringify(list, null, 2), { mode: 0o600 });
}

// GET api.github.com(带 PAT) → { code, json } ; 网络失败 code=0。
function ghGet(pat, p) {
  return new Promise((resolve) => {
    const req = https.request({ host: "api.github.com", path: p, method: "GET", headers: {
      "Authorization": "Bearer " + pat, "User-Agent": "dao-desktop", "Accept": "application/vnd.github+json" } }, (r) => {
      let b = ""; r.on("data", (c) => { b += c; });
      r.on("end", () => { let j = null; try { j = JSON.parse(b); } catch (_) {} resolve({ code: r.statusCode || 0, json: j }); });
    });
    req.on("error", () => resolve({ code: 0, json: null }));
    req.setTimeout(10000, () => { req.destroy(); resolve({ code: 0, json: null }); });
    req.end();
  });
}

// 校验 PAT → { ok, login, netFail }。
async function verifyPat(pat) {
  const r = await ghGet(pat, "/user");
  if (r.code === 0) return { ok: false, netFail: true, login: "" };
  if (r.code === 200 && r.json && r.json.login) return { ok: true, login: r.json.login };
  return { ok: false, netFail: false, login: "" };
}

// 添加(login 可留空由 PAT 反查); 同 login 覆盖更新(PAT 轮换)。
async function addAccount(pat, loginHint, role) {
  pat = String(pat || "").trim();
  if (!pat) throw new Error("PAT 不可为空");
  const v = await verifyPat(pat);
  let login = v.login || String(loginHint || "").trim();
  if (!login) throw new Error(v.netFail ? "GitHub 不可达且未给 login(断网入队需带 login)" : "PAT 无效(GitHub 拒绝)");
  if (!v.ok && !v.netFail) throw new Error("PAT 无效(GitHub 拒绝): " + login);
  const list = loadFleet();
  const ex = list.find((a) => a.login.toLowerCase() === login.toLowerCase());
  const r = role === "admin" ? "admin" : "member";
  if (ex) { ex.pat = pat; if (v.netFail) ex.verify = "pending"; else delete ex.verify; }
  else list.push({ login, pat, role: list.length === 0 ? "admin" : r, addedAt: new Date().toISOString(), ...(v.netFail ? { verify: "pending" } : {}) });
  saveFleet(list);
  return { login, pending: !!v.netFail, count: list.length };
}

function remove(login) {
  const list = loadFleet();
  const next = list.filter((a) => a.login.toLowerCase() !== String(login).toLowerCase());
  if (next.length === list.length) return { removed: false };
  saveFleet(next);
  return { removed: true };
}

function setRole(login, role) {
  const list = loadFleet();
  const a = list.find((x) => x.login.toLowerCase() === String(login).toLowerCase());
  if (!a) throw new Error("舰队无此号: " + login);
  a.role = role === "admin" ? "admin" : "member";
  saveFleet(list);
  return { login: a.login, role: a.role };
}

// 在线核对全队(PAT 活性 + 名下仓库数); 断网标 pending 不删。
async function verifyAll() {
  const list = loadFleet();
  const out = [];
  for (const a of list) {
    const v = await verifyPat(a.pat);
    if (v.netFail) { a.verify = "pending"; out.push({ login: a.login, state: "pending" }); continue; }
    if (!v.ok) { a.verify = "bad"; out.push({ login: a.login, state: "bad" }); continue; }
    delete a.verify;
    const rp = await ghGet(a.pat, "/user/repos?per_page=1");
    a.lastVerifiedAt = new Date().toISOString();
    out.push({ login: a.login, state: "ok", repoProbe: rp.code === 200 });
  }
  saveFleet(list);
  return out;
}

// 视图(脱敏: 绝不含完整 PAT)。
function listView() {
  return loadFleet().map((a) => ({
    login: a.login, role: a.role || "member", addedAt: a.addedAt || "",
    hasPat: !!a.pat, patTail: a.pat ? a.pat.slice(-4) : "",
    verify: a.verify || "ok", lastVerifiedAt: a.lastVerifiedAt || "" }));
}

module.exports = { fleetPath, loadFleet, addAccount, remove, setRole, verifyAll, listView, verifyPat, ghGet };
