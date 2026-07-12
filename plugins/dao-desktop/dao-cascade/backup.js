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

function indexPath(root) { return path.join(root, "_index.json"); }

function loadIndex(root) {
  try {
    const j = JSON.parse(fs.readFileSync(indexPath(root), "utf8"));
    return (j && j.entries) || {};
  } catch (_) { return {}; }
}

function safeName(s) {
  return String(s || "").replace(/[^\w.\-\u4e00-\u9fff]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80) || "untitled";
}

// 全量增量备份: 枚举全部 Cascade 轨迹 → 对水位有变化者导出转录 md + 写回 _index.json。
// ls: ls-bridge 模块(须已 ready); 返回 { ok, saved, skipped, total, root }。
async function backupAll(ls, opts) {
  const o = opts || {};
  const root = backupRoot(o.root);
  const log = typeof o.log === "function" ? o.log : () => {};
  if (!ls || !ls.ready() || !ls.apiKey()) return { ok: false, reason: "ls-not-ready", saved: 0, skipped: 0, total: 0, root };
  const r = await ls.call("GetAllCascadeTrajectories", {});
  const m = (r && r.trajectorySummaries) || {};
  fs.mkdirSync(root, { recursive: true });
  const idx = loadIndex(root);
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
    const file = safeName(title) + "_" + String(cid).slice(0, 8) + ".md";
    const head = "# " + title + "\n\n" +
      "- cascadeId: `" + cid + "`\n" +
      "- updatedAt: " + (s.lastModifiedTime || "") + "\n" +
      "- backedUpAt: " + new Date().toISOString() + "\n" +
      "- source: dao-desktop(Cascade 插件版)\n\n---\n\n";
    try {
      fs.writeFileSync(path.join(root, file), head + (transcript || "(空转录)"));
      idx[cid] = { title, file, lastModifiedTime: s.lastModifiedTime || "",
        backedUpAt: new Date().toISOString(), isArchived: !!s.isArchived };
      saved++;
    } catch (e) { log("[backup] 写入失败 " + file + ": " + e.message); }
  }
  try {
    fs.writeFileSync(indexPath(root), JSON.stringify({
      updatedAt: new Date().toISOString(), source: "dao-desktop", root, entries: idx }, null, 2));
  } catch (e) { log("[backup] 索引写入失败: " + e.message); }
  return { ok: true, saved, skipped, total: Object.keys(m).length, root };
}

module.exports = { backupRoot, backupAll, loadIndex, indexPath, safeName };
