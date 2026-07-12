// 道 · 插件自持 Cascade 账号池(切号板块后端) —— 插件即本源, 不依赖 IDE 宿主账号态。
// ─────────────────────────────────────────────────────────────────────────────
// 池文件: ~/.dao/cascade-pool.json (mode 600) —— [{email,name,plan,apiKey,addedAt}]。
// 切换 = 把该号 windsurf_api_key 写入 ~/.local/share/devin/credentials.toml
// (ls-bridge.apiKey() 的第一真源), 使本插件全部 LS 调用(备份/MCP/账号)即刻走该号;
// 严禁回退: 目标号无缓存 key 即报错, 绝不冒用当前活动号(账号隔离铁律)。
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");

function poolPath() { return process.env.DAO_CASCADE_POOL_FILE || path.join(os.homedir(), ".dao", "cascade-pool.json"); }
function credPath() { return process.env.DAO_DEVIN_CRED_FILE || path.join(os.homedir(), ".local", "share", "devin", "credentials.toml"); }

function loadPool() {
  try { const j = JSON.parse(fs.readFileSync(poolPath(), "utf8")); return Array.isArray(j) ? j : []; }
  catch (_) { return []; }
}

function savePool(list) {
  fs.mkdirSync(path.dirname(poolPath()), { recursive: true });
  fs.writeFileSync(poolPath(), JSON.stringify(list, null, 2), { mode: 0o600 });
}

// 当前 credentials.toml 里的 key(可能为空: 弱加密登录只落 state.vscdb)
function currentCredKey() {
  try {
    const m = fs.readFileSync(credPath(), "utf8").match(/windsurf_api_key\s*=\s*"([^"]+)"/);
    return m ? m[1] : "";
  } catch (_) { return ""; }
}

// 收录当前号: apiKey 取自 ls-bridge(credentials.toml/state.vscdb), 身份取自 fused.account。
// 同邮箱覆盖更新(key 轮换时保持最新)。
function captureCurrent(apiKey, account) {
  const email = String((account || {}).email || "").trim();
  if (!apiKey) throw new Error("未捕获到当前登录 apiKey");
  if (!email) throw new Error("未获取到当前账号邮箱(等 fused.account 同步后再试)");
  const list = loadPool().filter((a) => a.email !== email);
  list.push({ email, name: (account || {}).name || "", plan: (account || {}).plan || "",
    apiKey, addedAt: new Date().toISOString() });
  savePool(list);
  return { email, count: list.length };
}

// 切换: 只用该号池内 key, 无则报错(绝不回退全局活动号)。
// 写 credentials.toml 前备份既有内容到 credentials.toml.bak(仅首次)。
function switchTo(email) {
  const a = loadPool().find((x) => x.email === email);
  if (!a || !a.apiKey) throw new Error("账号池无此号的 apiKey: " + email + "(先在该号登录态下「收录当前号」)");
  const p = credPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  let old = "";
  try { old = fs.readFileSync(p, "utf8"); } catch (_) {}
  if (old && !fs.existsSync(p + ".bak")) fs.writeFileSync(p + ".bak", old, { mode: 0o600 });
  let out;
  if (old && /windsurf_api_key\s*=/.test(old)) {
    out = old.replace(/windsurf_api_key\s*=\s*"[^"]*"/, 'windsurf_api_key = "' + a.apiKey + '"');
  } else {
    out = (old ? old.replace(/\s*$/, "\n") : "") + 'windsurf_api_key = "' + a.apiKey + '"\n';
  }
  fs.writeFileSync(p, out, { mode: 0o600 });
  return { email: a.email };
}

function remove(email) {
  const list = loadPool();
  const next = list.filter((a) => a.email !== email);
  if (next.length === list.length) return { removed: false };
  savePool(next);
  return { removed: true };
}

// 面板视图数据(key 永不出后端: 只回显是否有 key + 尾 4 位指纹)
function listView(activeKey) {
  const cred = currentCredKey();
  return loadPool().map((a) => ({
    email: a.email, name: a.name || "", plan: a.plan || "", addedAt: a.addedAt || "",
    hasKey: !!a.apiKey,
    keyTail: a.apiKey ? a.apiKey.slice(-4) : "",
    active: !!a.apiKey && (a.apiKey === activeKey || a.apiKey === cred),
  }));
}

module.exports = { poolPath, credPath, loadPool, captureCurrent, switchTo, remove, listView, currentCredKey };
