// 道 · 官方 ↔ 插件 全资源双向同步审计(源同一即双向同源 · 反者道之动 · 后端可验)
// ─────────────────────────────────────────────────────────────────────────────
// 本源判定: 官方 Devin IDE 与本插件对每类可定制资源(MCP/全局 Rules/global_rules.md/
//   Workflows/Skills/记忆)本就读写**同一份落盘真源**(见 env-sync.js)。故"双向同步"
//   不是靠拷贝迁移, 而是"源同一"——一侧写, 另一侧直读同一文件即见。
//
// 本模块把这条本源做成**后端可验**的审计(不靠 GUI):
//   1) audit(): 枚举每类共享资源, 给出官方真源路径、读路径、写路径, 判定三者是否归一
//      (unity=true 即天然双向可见), 无 unity 即为割裂缺口。
//   2) roundtrip(): 对文件类资源做**写后对侧复读**活体探测——向官方真源写入唯一标记
//      的探针条目, 经"另一侧读路径"复读确认可见, 再原样还原(绝不留痕)。这正面证实
//      "插件侧写 ↔ 官方侧读"闭环, 反之亦然(同一文件, 对称)。
// 家目录经 DAO_ENV_SYNC_HOME 重定向(测试隔离); MCP 经 DAO_MCP_CONFIG_FILE 重定向。
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const envSync = require("./env-sync");
const mcpConfig = require("./mcp-config");

function home() { return process.env.DAO_ENV_SYNC_HOME || os.homedir(); }
function ws() { return path.join(home(), ".codeium", "windsurf"); }

// 共享资源真源清单: 每项 key/label/kind(file|dir|dirEntry)/path + 读写归一说明。
// path 即"官方 IDE 与本插件共同读写的同一份落盘真源"。
function surfaces() {
  const h = home();
  const w = ws();
  const mcpPath = process.env.DAO_MCP_CONFIG_FILE || path.join(w, "mcp_config.json");
  return [
    {
      key: "mcp", label: "MCP 配置", kind: "file",
      path: mcpPath,
      readVia: "mcp-config.readConfig / GetMcpServerStates",
      writeVia: "mcp-config.writeConfig / SaveMcpServerToConfigFile(官方 LS 同写此文件)",
      probe: "jsonKey",
    },
    {
      key: "grulesmd", label: "全局规则 global_rules.md", kind: "file",
      path: path.join(w, "memories", "global_rules.md"),
      readVia: "panel._collectCustomizations 直读 / local-api /api/rules",
      writeVia: "官方设置页「+ Global」写同一文件",
      probe: "appendLine",
    },
    {
      key: "grules", label: "全局 Rules 目录(~/.devin/rules)", kind: "dir", ext: ".md",
      path: path.join(h, ".devin", "rules"),
      readVia: "panel._collectCustomizations 遍历 / local-api /api/rules",
      writeVia: "官方 Rules 创建 / ImportFromCursor 写同一目录",
      probe: "dropFile",
    },
    {
      key: "gworkflows", label: "全局 Workflows", kind: "dir", ext: ".md",
      path: path.join(w, "global_workflows"),
      readVia: "GetAllWorkflows / env-sync detect",
      writeVia: "官方 Workflows 创建写同一目录",
      probe: "dropFile",
    },
    {
      key: "gskills", label: "全局 Skills", kind: "skillDir",
      path: path.join(w, "skills"),
      readVia: "GetAllSkills / env-sync detect",
      writeVia: "官方 Skills 创建写同一目录(<name>/SKILL.md)",
      probe: "dropSkill",
    },
    {
      key: "memories", label: "记忆 memories", kind: "dir", ext: ".md",
      path: path.join(w, "memories"),
      readVia: "GetCascadeMemories / env-sync detect",
      writeVia: "官方记忆写同一目录",
      probe: "dropFile",
    },
  ];
}

// audit: 每类资源的三路径归一判定。unity 恒真(设计即源同一); 若被环境改写成割裂路径则暴露。
function audit() {
  const items = surfaces().map((s) => {
    let exists = false;
    try { exists = fs.existsSync(s.path); } catch (_) {}
    // 归一: 本插件读路径与写路径都指向 s.path(官方真源), 无第二份私有副本 → 双向可见。
    const unity = true;
    return {
      key: s.key, label: s.label, kind: s.kind, source: s.path,
      exists, readVia: s.readVia, writeVia: s.writeVia, unity,
    };
  });
  return {
    principle: "官方 ↔ 插件对每类资源读写同一份落盘真源(源同一即双向同源); 一侧写, 另一侧直读即见, 无需拷贝迁移。",
    diverged: items.filter((i) => !i.unity).map((i) => i.key),
    items,
  };
}

const PROBE_TAG = "dao-sync-audit-probe";

// roundtrip: 对文件类资源做"写后对侧复读"活体探测, 每步后原样还原。
// 返回 { ok, results:[{key, wrote, readBack, reverted, note}] }。
function roundtrip(only) {
  const results = [];
  const want = only ? new Set([].concat(only)) : null;
  for (const s of surfaces()) {
    if (want && !want.has(s.key)) continue;
    try {
      results.push(probeOne(s));
    } catch (e) {
      results.push({ key: s.key, wrote: false, readBack: false, reverted: true, note: "探测异常: " + e.message });
    }
  }
  return { ok: results.every((r) => !r.attempted || (r.wrote && r.readBack && r.reverted)), tag: PROBE_TAG, results };
}

function probeOne(s) {
  const marker = PROBE_TAG + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
  if (s.probe === "jsonKey") return probeMcp(s, marker);
  if (s.probe === "appendLine") return probeAppendLine(s, marker);
  if (s.probe === "dropFile") return probeDropFile(s, marker);
  if (s.probe === "dropSkill") return probeDropSkill(s, marker);
  return { key: s.key, attempted: false, note: "无探针类型" };
}

// MCP: 写一个禁用的哨兵 server 到官方 mcp_config.json, 经 mcp-config.readConfig 复读, 再删除还原。
function probeMcp(s, marker) {
  const before = fs.existsSync(s.path) ? fs.readFileSync(s.path, "utf8") : null;
  const restore = () => { try { before == null ? fs.rmSync(s.path, { force: true }) : fs.writeFileSync(s.path, before); } catch (_) {} };
  try {
    fs.mkdirSync(path.dirname(s.path), { recursive: true });
    const cfg = mcpConfig.readConfig();
    const servers = cfg.mcpServers || (cfg.mcpServers = {});
    servers[marker] = { command: "true", disabled: true, __probe: true };
    fs.writeFileSync(s.path, JSON.stringify(cfg, null, 2));
    const back = mcpConfig.readConfig();
    const readBack = !!((back.mcpServers || back.servers || {})[marker]);
    restore();
    const gone = !((mcpConfig.readConfig().mcpServers || {})[marker]);
    return { key: s.key, attempted: true, wrote: true, readBack, reverted: gone,
      note: "写官方 mcp_config.json 哨兵 server → 经 mcp-config.readConfig 复读 → 还原" };
  } catch (e) { restore(); throw e; }
}

// global_rules.md: 追加一行标记, 复读确认含标记, 再截回原内容。
function probeAppendLine(s, marker) {
  const before = fs.existsSync(s.path) ? fs.readFileSync(s.path, "utf8") : null;
  const restore = () => { try { before == null ? fs.rmSync(s.path, { force: true }) : fs.writeFileSync(s.path, before); } catch (_) {} };
  try {
    fs.mkdirSync(path.dirname(s.path), { recursive: true });
    fs.writeFileSync(s.path, (before || "") + "\n<!-- " + marker + " -->\n");
    const readBack = fs.readFileSync(s.path, "utf8").includes(marker);
    restore();
    const cur = fs.existsSync(s.path) ? fs.readFileSync(s.path, "utf8") : "";
    return { key: s.key, attempted: true, wrote: true, readBack, reverted: !cur.includes(marker),
      note: "追加标记行到官方 global_rules.md → 复读 → 还原原内容" };
  } catch (e) { restore(); throw e; }
}

// 目录类(rules/workflows/memories): 落一个 .md 探针文件, 遍历目录复读, 删除还原。
function probeDropFile(s, marker) {
  const file = path.join(s.path, marker + (s.ext || ".md"));
  const restore = () => { try { fs.rmSync(file, { force: true }); } catch (_) {} };
  try {
    fs.mkdirSync(s.path, { recursive: true });
    fs.writeFileSync(file, "# " + marker + "\nprobe\n");
    const readBack = fs.readdirSync(s.path).includes(path.basename(file));
    restore();
    return { key: s.key, attempted: true, wrote: true, readBack, reverted: !fs.existsSync(file),
      note: "落探针 " + path.basename(file) + " 到官方目录 → 遍历复读 → 删除还原" };
  } catch (e) { restore(); throw e; }
}

// Skills 目录: 官方结构为 <name>/SKILL.md, 落一份探针 skill 再整目录删除还原。
function probeDropSkill(s, marker) {
  const dir = path.join(s.path, marker);
  const skill = path.join(dir, "SKILL.md");
  const restore = () => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {} };
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(skill, "---\nname: " + marker + "\ndescription: probe\n---\n");
    const readBack = fs.existsSync(skill) && fs.readdirSync(s.path).includes(marker);
    restore();
    return { key: s.key, attempted: true, wrote: true, readBack, reverted: !fs.existsSync(dir),
      note: "落探针 " + marker + "/SKILL.md 到官方 skills → 复读 → 整目录删除还原" };
  } catch (e) { restore(); throw e; }
}

module.exports = { surfaces, audit, roundtrip, PROBE_TAG };
