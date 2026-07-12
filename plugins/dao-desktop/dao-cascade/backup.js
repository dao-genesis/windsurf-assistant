// 道 · Cascade 对话备份引擎(通用底层 · 零 IDE 依赖) —— 插件版对话备份, 与 dao-one/rt-flow
// 的 Devin Cloud 备份同构: Devin Cloud 侧备份云端会话, 本模块备份本机 Cascade 轨迹。
// ─────────────────────────────────────────────────────────────────────────────
// 备份根目录与 rt-flow Cascade 追踪同源(~/.wam/conversation_backups), dao-one 全功能面板
// 「💬 对话备份」板块可直接消费 _index.json + 各轨迹 md, 实现两侧(Devin Cloud / Cascade)
// 统一查看。可经 DAO_CASCADE_BACKUP_DIR 或设置 dao.cascade.backupDir 重定向。
// 增量语义: 以轨迹 lastModifiedTime 为水位, 未变化的轨迹不重复导出。
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");

function backupRoot(override) {
  return String(override || process.env.DAO_CASCADE_BACKUP_DIR
    || path.join(os.homedir(), ".wam", "conversation_backups"));
}

// Cascade 备份落盘为 dao-one「💬 对话备份」板块同构树(与 Devin Cloud 账号平级并列):
//   <root>/Cascade·<账号>/.account.json
//   <root>/Cascade·<账号>/对话/<NNN_标题_id8>/{对话.md, _meta.json}
// 板块扫描器(listBackups/_scanConvEntries)即原样列出 Cascade 账号与对话, 无需前端改造。
function accountDirName(email) {
  return "Cascade·" + (String(email || "").trim() || os.hostname() || "local");
}

function indexPath(accDir) { return path.join(accDir, "_index.json"); }

function loadIndex(accDir) {
  try {
    const j = JSON.parse(fs.readFileSync(indexPath(accDir), "utf8"));
    return (j && j.entries) || {};
  } catch (_) { return {}; }
}

function safeName(s) {
  return String(s || "").replace(/[^\w.\-\u4e00-\u9fff]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80) || "untitled";
}

// 全量增量备份: 枚举全部 Cascade 轨迹 → 对水位有变化者导出转录 md + 写回 _index.json。
// ls: ls-bridge 模块(须已 ready); opts.email: Cascade 登录账号(账号目录名)。
// 返回 { ok, saved, skipped, total, root, accDir }。
async function backupAll(ls, opts) {
  const o = opts || {};
  const root = backupRoot(o.root);
  const log = typeof o.log === "function" ? o.log : () => {};
  if (!ls || !ls.ready() || !ls.apiKey()) return { ok: false, reason: "ls-not-ready", saved: 0, skipped: 0, total: 0, root };
  const r = await ls.call("GetAllCascadeTrajectories", {});
  const m = (r && r.trajectorySummaries) || {};
  const accDir = path.join(root, accountDirName(o.email));
  const convDir = path.join(accDir, "对话");
  fs.mkdirSync(convDir, { recursive: true });
  try {
    fs.writeFileSync(path.join(accDir, ".account.json"), JSON.stringify({
      email: String(o.email || ""), source: "dao-desktop(Cascade 插件版)", accountNo: 0 }, null, 2));
  } catch (_) {}
  const idx = loadIndex(accDir);
  let nextNo = 1;
  for (const k of Object.keys(idx)) { const n = idx[k] && idx[k].convNo; if (n >= nextNo) nextNo = n + 1; }
  let saved = 0, skipped = 0;
  for (const cid of Object.keys(m)) {
    const s = m[cid] || {};
    const prev = idx[cid];
    if (prev && prev.lastModifiedTime === (s.lastModifiedTime || "")) { skipped++; continue; }
    let transcript = "";
    try {
      const t = await ls.call("GetCascadeTranscriptForTrajectoryId", { cascadeId: cid });
      transcript = (t && t.transcript) || "";
    } catch (e) { log("[backup] " + cid + ": " + e.message); continue; }
    const title = s.summary || cid;
    const convNo = (prev && prev.convNo) || nextNo++;
    const folder = String(convNo).padStart(3, "0") + "_" + safeName(title) + "_" + String(cid).slice(0, 8);
    const dir = path.join(convDir, folder);
    const head = "# " + title + "\n\n" +
      "- cascadeId: `" + cid + "`\n" +
      "- updatedAt: " + (s.lastModifiedTime || "") + "\n" +
      "- backedUpAt: " + new Date().toISOString() + "\n" +
      "- source: dao-desktop(Cascade 插件版)\n\n---\n\n";
    try {
      // 标题变化时旧目录改名跟随(同 convNo+cid 后缀), 避免同一轨迹双目录。
      if (prev && prev.folder && prev.folder !== folder) {
        try { fs.renameSync(path.join(convDir, prev.folder), dir); } catch (_) {}
      }
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, "对话.md"), head + (transcript || "(空转录)"));
      fs.writeFileSync(path.join(dir, "_meta.json"), JSON.stringify({
        title, convNo, cascadeId: cid, source: "cascade",
        lastModifiedTime: s.lastModifiedTime || "", isArchived: !!s.isArchived,
        backedUpAt: new Date().toISOString() }, null, 2));
      idx[cid] = { title, folder, convNo, lastModifiedTime: s.lastModifiedTime || "",
        backedUpAt: new Date().toISOString(), isArchived: !!s.isArchived };
      saved++;
    } catch (e) { log("[backup] 写入失败 " + folder + ": " + e.message); }
  }
  try {
    fs.writeFileSync(indexPath(accDir), JSON.stringify({
      updatedAt: new Date().toISOString(), source: "dao-desktop", root, entries: idx }, null, 2));
  } catch (e) { log("[backup] 索引写入失败: " + e.message); }
  return { ok: true, saved, skipped, total: Object.keys(m).length, root, accDir };
}

// ─────────────────────────────────────────────────────────────────────────────
// 归一面板「💬 对话备份」板块数据层(插件自持真源): 扫描备份根下**全部**账号树,
// Cascade 账号(Cascade·<邮箱>)与 Devin Cloud 账号(rt-flow 落盘者)同结构、同列并出,
// 实现用户所述「两侧对话在同一备份板块统一列表/查看」。零 IDE 依赖、纯 fs。
//   <root>/<账号目录>/.account.json                         (可选: email/source)
//   <root>/<账号目录>/对话/<会话目录>/{对话.md, _meta.json}
function _readJson(p) { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch (_) { return null; } }

// 列出某账号目录下的全部会话(按 convNo→backedUpAt→目录名 排序)。
function listConversations(accPath) {
  const convRoot = path.join(accPath, "对话");
  let names = [];
  try { names = fs.readdirSync(convRoot, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name); }
  catch (_) { return []; }
  const convs = names.map((folder) => {
    const meta = _readJson(path.join(convRoot, folder, "_meta.json")) || {};
    let hasMd = false;
    try { hasMd = fs.statSync(path.join(convRoot, folder, "对话.md")).isFile(); } catch (_) {}
    return {
      folder,
      title: meta.title || folder.replace(/^\d{3}_/, "").replace(/_[0-9a-f]{6,}$/i, ""),
      convNo: meta.convNo || 0,
      source: meta.source || "",
      cascadeId: meta.cascadeId || "",
      lastModifiedTime: meta.lastModifiedTime || "",
      isArchived: !!meta.isArchived,
      backedUpAt: meta.backedUpAt || "",
      hasMd,
    };
  });
  convs.sort((a, b) => (a.convNo - b.convNo) || String(a.backedUpAt).localeCompare(String(b.backedUpAt)) || a.folder.localeCompare(b.folder));
  return convs;
}

// 扫描备份根 → 全部账号(含各账号会话数/来源标签)。source 归一: cascade / cloud / mixed。
function listBackups(rootOverride) {
  const root = backupRoot(rootOverride);
  let dirs = [];
  try { dirs = fs.readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name); }
  catch (_) { return { root, accounts: [] }; }
  const accounts = dirs.map((name) => {
    const accPath = path.join(root, name);
    const acct = _readJson(path.join(accPath, ".account.json")) || {};
    const convs = listConversations(accPath);
    const isCascade = /^Cascade[·:]/.test(name) || String(acct.source || "").indexOf("Cascade") >= 0 || convs.some((c) => c.source === "cascade");
    const source = isCascade
      ? (convs.some((c) => c.source && c.source !== "cascade") ? "mixed" : "cascade")
      : "cloud";
    return {
      dir: name,
      email: acct.email || (name.replace(/^Cascade[·:]/, "") || name),
      source,
      isCascade,
      convCount: convs.length,
      conversations: convs,
    };
  }).filter((a) => a.convCount > 0 || a.email);
  // Cascade 账号在前(本源优先), 其余按目录名。
  accounts.sort((a, b) => (Number(b.isCascade) - Number(a.isCascade)) || a.dir.localeCompare(b.dir));
  return { root, accounts };
}

// 读取某会话的转录正文(对话.md)+ 元数据, 供面板详情视图渲染。
function readConversation(rootOverride, accDir, folder) {
  const root = backupRoot(rootOverride);
  const convPath = path.join(root, accDir, "对话", folder);
  let md = "";
  try { md = fs.readFileSync(path.join(convPath, "对话.md"), "utf8"); } catch (e) { md = "(无法读取转录: " + e.message + ")"; }
  return { meta: _readJson(path.join(convPath, "_meta.json")) || {}, md, path: convPath };
}

module.exports = { backupRoot, backupAll, loadIndex, indexPath, safeName, accountDirName, listBackups, listConversations, readConversation };
