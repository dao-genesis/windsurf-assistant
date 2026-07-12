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

module.exports = { backupRoot, backupAll, loadIndex, indexPath, safeName, accountDirName };
