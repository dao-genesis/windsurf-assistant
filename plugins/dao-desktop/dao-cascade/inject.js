// 道 · 插件自持反向注入(💉 全账号注入板块后端) —— 共享资源批量注入账号池, 插件自持真源。
// ─────────────────────────────────────────────────────────────────────────────
// 注入档案: ~/.dao/inject-profile.json (mode 600) —— { items:[{kind,name,spec,addedAt}] }。
//   kind ∈ mcp|secret|knowledge。secret 的 spec.value 绝不出后端视图(只回是否已设 + 尾4位)。
// 注入目标 = 切号板块账号池(account-pool)全体号 —— plan() 交叉出「每号 × 每档」的应注清单。
// MCP 档可即刻本机落地: applyMcp() 经 ls-bridge 写入 Cascade 的 mcp_config.json(本机全账号共享)。
// 与 dao-vsix「反向注入·全账号」同源(账号池同真源·幂等校正), 但为纯插件自持。
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");

function profilePath() { return process.env.DAO_INJECT_PROFILE_FILE || path.join(os.homedir(), ".dao", "inject-profile.json"); }

function load() {
  try { const j = JSON.parse(fs.readFileSync(profilePath(), "utf8")); return { items: Array.isArray(j.items) ? j.items : [] }; }
  catch (_) { return { items: [] }; }
}

function save(p) {
  fs.mkdirSync(path.dirname(profilePath()), { recursive: true });
  fs.writeFileSync(profilePath(), JSON.stringify({ items: p.items || [] }, null, 2), { mode: 0o600 });
}

const KINDS = new Set(["mcp", "secret", "knowledge"]);

// 添加/更新注入档(同 kind+name 覆盖)。spec 依 kind 而异:
//   mcp:{command,args}|{serverUrl}  secret:{value}  knowledge:{content}
function addItem(kind, name, spec) {
  kind = String(kind || "").trim();
  name = String(name || "").trim();
  if (!KINDS.has(kind)) throw new Error("未知注入类型: " + kind);
  if (!name) throw new Error("注入档名不可为空");
  if (!spec || typeof spec !== "object") throw new Error("spec 必须为对象");
  const p = load();
  const ex = p.items.find((x) => x.kind === kind && x.name === name);
  const rec = { kind, name, spec, addedAt: (ex && ex.addedAt) || new Date().toISOString(), updatedAt: new Date().toISOString() };
  if (ex) Object.assign(ex, rec); else p.items.push(rec);
  save(p);
  return { kind, name, count: p.items.length };
}

function removeItem(kind, name) {
  const p = load();
  const next = p.items.filter((x) => !(x.kind === kind && x.name === name));
  const removed = next.length !== p.items.length;
  p.items = next; save(p);
  return { removed };
}

// 注入计划: 账号池全体 × 注入档 → [{email, items:[{kind,name}]}] + 总量。
function plan(poolAccounts) {
  const items = load().items.map((x) => ({ kind: x.kind, name: x.name }));
  const accounts = (poolAccounts || []).map((a) => ({ email: a.email, items: items.slice() }));
  return { accounts, itemCount: items.length, targetCount: accounts.length, total: items.length * accounts.length };
}

// MCP 档即刻本机落地: 经 ls-bridge 写入 Cascade mcp_config.json(本机全账号共享)。
async function applyMcp(ls) {
  const p = load();
  const mcp = p.items.filter((x) => x.kind === "mcp");
  const out = [];
  for (const it of mcp) {
    try {
      await ls.call("SaveMcpServerToConfigFile", { serverId: it.name, templateJson: JSON.stringify(it.spec) });
      out.push({ name: it.name, ok: true });
    } catch (e) { out.push({ name: it.name, ok: false, error: e.message }); }
  }
  try { await ls.call("RefreshMcpServers", {}); } catch (_) {}
  return { applied: out.filter((x) => x.ok).length, total: mcp.length, results: out };
}

// 视图(脱敏: secret 值绝不出后端, 只回是否已设 + 尾4位)。
function listView() {
  return load().items.map((x) => {
    const v = { kind: x.kind, name: x.name, addedAt: x.addedAt || "", updatedAt: x.updatedAt || "" };
    if (x.kind === "secret") { const val = (x.spec || {}).value || ""; v.hasValue = !!val; v.valueTail = val ? String(val).slice(-4) : ""; }
    else if (x.kind === "mcp") { v.transport = (x.spec || {}).serverUrl ? "http" : "stdio"; v.summary = (x.spec || {}).serverUrl || (x.spec || {}).command || ""; }
    else if (x.kind === "knowledge") { const c = (x.spec || {}).content || ""; v.chars = c.length; }
    return v;
  });
}

module.exports = { profilePath, load, save, addItem, removeItem, plan, applyMcp, listView, KINDS };
