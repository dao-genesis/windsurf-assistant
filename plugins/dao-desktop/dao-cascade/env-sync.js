// 道 · 环境共生检测(与官方 Devin IDE 同一套配置体系 · 零 IDE 依赖)
// ─────────────────────────────────────────────────────────────────────────────
// 用户机器上若已有官方 Devin IDE(Devin Desktop / Windsurf), 其一切配置(MCP / 全局
// Rules / 全局 Workflows / 全局 Skills / 记忆 / ACP 注册表 / 登录凭据)都落在标准
// 家目录路径。本插件所有读写本就直取同一路径 —— 共生是体系性的, 无需拷贝迁移:
//   · 先装官方后装插件: 插件启动即自动看到官方全部配置;
//   · 先装插件后装官方: 官方启动即自动看到插件写下的全部配置。
// 本模块负责"检测 + 呈现": 扫描官方安装痕迹与各共享配置源的存在性/条目数,
// 供设置板块渲染"环境共生"一览。DAO_ENV_SYNC_HOME 可重定向家目录(测试隔离)。
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");

function home() { return process.env.DAO_ENV_SYNC_HOME || os.homedir(); }

function exists(p) { try { fs.statSync(p); return true; } catch (_) { return false; } }

function countMd(dir) {
  try { return fs.readdirSync(dir).filter((f) => f.endsWith(".md")).length; } catch (_) { return 0; }
}

function countSkills(dir) {
  try {
    return fs.readdirSync(dir).filter((d) => exists(path.join(dir, d, "SKILL.md"))).length;
  } catch (_) { return 0; }
}

function countMcpServers(p) {
  try {
    const cfg = JSON.parse(fs.readFileSync(p, "utf8")) || {};
    return Object.keys(cfg.mcpServers || cfg.servers || {}).length;
  } catch (_) { return 0; }
}

function countAcpAgents(p) {
  try {
    const reg = JSON.parse(fs.readFileSync(p, "utf8")) || {};
    return Array.isArray(reg.agents) ? reg.agents.length : 0;
  } catch (_) { return 0; }
}

function countEntries(dir) {
  try { return fs.readdirSync(dir).length; } catch (_) { return 0; }
}

function sizeKb(p) {
  try { return Math.max(1, Math.round(fs.statSync(p).size / 1024)); } catch (_) { return 0; }
}

// 官方 IDE(Electron/VS Code 层)用户配置目录: settings.json/keybindings/globalStorage 所在。
// Windows Agent 单账号多分身体系里, IDE 以 per-clone --user-data-dir 启动(dao-clone-open.ps1),
// 启动器同时注入 DAO_CLONE_USER_DATA_DIR —— IDE 层配置随分身走, 引擎层(~/.codeium)仍全分身共生。
function ideUserDir() {
  const cloneDir = process.env.DAO_CLONE_USER_DATA_DIR;
  if (cloneDir) return path.join(cloneDir, "User");
  const h = home();
  if (process.platform === "darwin") return path.join(h, "Library", "Application Support", "Devin", "User");
  if (process.platform === "win32") {
    // DAO_ENV_SYNC_HOME 重定向时须整树随行(隔离契约), 不得漏引真实 APPDATA
    const roaming = process.env.DAO_ENV_SYNC_HOME
      ? path.join(h, "AppData", "Roaming")
      : (process.env.APPDATA || path.join(h, "AppData", "Roaming"));
    return path.join(roaming, "Devin", "User");
  }
  return path.join(h, ".config", "Devin", "User");
}

// 官方 IDE 安装痕迹: 二进制候选(检出任一即视为已装)。
function ideBinCandidates() {
  const h = home();
  return [
    path.join(h, "devin-desktop", "Devin", "bin", "devin-desktop"),
    "/usr/share/devin-desktop/bin/devin-desktop",
    "/opt/Devin/bin/devin-desktop",
    "/Applications/Devin.app/Contents/MacOS/Electron",
    path.join(h, "AppData", "Local", "Programs", "Devin", "Devin.exe"),
    path.join(h, ".local", "share", "windsurf", "bin", "windsurf"),
    "/usr/share/windsurf/bin/windsurf",
  ];
}

function detectIde() {
  for (const p of ideBinCandidates()) if (exists(p)) return { installed: true, binPath: p };
  // 配置根已存在也说明官方引擎在本机运转过(如 CLI/引擎自持)
  const cfgRoot = path.join(home(), ".codeium", "windsurf");
  if (exists(cfgRoot)) return { installed: false, configRoot: cfgRoot, engineTraces: true };
  return { installed: false, engineTraces: false };
}

// 共享配置源全清单: 每项 { key,group,label,path,exists,count?|sizeKb? } —— path 即官方同一路径。
// 分组反向解构自官方落盘全貌:
//   定制: MCP / Rules / Workflows / Skills / 记忆
//   引擎: user_settings.pb(偏好·模型) / codemaps / implicit / brain / cascade / database /
//         code_tracker / context_state / installation_id
//   IDE 层: settings.json / keybindings.json / snippets / globalStorage(state.vscdb) / argv.json / 扩展 /
//           本地文件历史 History / 工作区状态 workspaceStorage / 热退出 Backups / 对话模型 chatLanguageModels.json
//   账户: ACP 注册表 / credentials / Devin CLI / CLI MCP 状态
//   插件: 对话备份(~/.wam)
// 注: Cascade 对话轨迹正文随账号云端同步(本地无 pb 正文), 本地仅缓存目录 —— 换机/重装
//     由登录态带回; 本插件的 ~/.wam 备份提供额外本地留存。
function detect() {
  const h = home();
  const ws = path.join(h, ".codeium", "windsurf");
  const userDir = ideUserDir();
  const mcp = path.join(ws, "mcp_config.json");
  const acp = path.join(h, ".windsurf", "acp", "registry.json");
  const cred = path.join(h, ".local", "share", "devin", "credentials.toml");
  const cli = path.join(h, ".local", "share", "devin", "cli");
  const gRules = path.join(h, ".devin", "rules");
  const gRulesMd = path.join(ws, "memories", "global_rules.md");
  const gWf = path.join(ws, "global_workflows");
  const gSk = path.join(ws, "skills");
  const memories = path.join(ws, "memories");
  const usp = path.join(ws, "user_settings.pb");
  const codemaps = path.join(ws, "codemaps");
  const implicit = path.join(ws, "implicit");
  const brain = path.join(ws, "brain");
  const cascade = path.join(ws, "cascade");
  const database = path.join(ws, "database");
  const tracker = path.join(ws, "code_tracker");
  const ctxState = path.join(ws, "context_state");
  const instId = path.join(ws, "installation_id");
  const ideRoot = path.dirname(userDir);
  const settings = path.join(userDir, "settings.json");
  const keybinds = path.join(userDir, "keybindings.json");
  const snippets = path.join(userDir, "snippets");
  const stateDb = path.join(userDir, "globalStorage", "state.vscdb");
  const argv = path.join(h, ".devin", "argv.json");
  const exts = path.join(h, ".devin", "extensions");
  const hist = path.join(userDir, "History");
  const wsStorage = path.join(userDir, "workspaceStorage");
  const backups = path.join(ideRoot, "Backups");
  const chatModels = path.join(userDir, "chatLanguageModels.json");
  const cliMcp = path.join(h, ".local", "share", "devin", "mcp");
  const wam = path.join(h, ".wam", "conversation_backups");
  const S = (key, group, label, p, count) => {
    const s = { key, group, label, path: p, exists: exists(p) };
    if (typeof count === "number") s.count = count;
    return s;
  };
  const sources = [
    S("mcp", "定制", "MCP 配置 mcp_config.json", mcp, countMcpServers(mcp)),
    S("grules", "定制", "全局 Rules(~/.devin/rules)", gRules, countMd(gRules)),
    S("grulesmd", "定制", "全局规则 global_rules.md", gRulesMd),
    S("gworkflows", "定制", "全局 Workflows", gWf, countMd(gWf)),
    S("gskills", "定制", "全局 Skills", gSk, countSkills(gSk)),
    S("memories", "定制", "记忆 memories", memories, countMd(memories)),
    Object.assign(S("usersettings", "引擎", "引擎偏好 user_settings.pb(模型/开关)", usp), { sizeKb: sizeKb(usp) }),
    S("codemaps", "引擎", "Code Maps", codemaps, countEntries(codemaps)),
    S("implicit", "引擎", "隐式上下文 implicit(.pb)", implicit, countEntries(implicit)),
    S("brain", "引擎", "Brain 缓存", brain, countEntries(brain)),
    S("cascadedir", "引擎", "Cascade 本地缓存(正文云端同步)", cascade, countEntries(cascade)),
    S("database", "引擎", "引擎数据库 database", database, countEntries(database)),
    S("codetracker", "引擎", "代码轨迹 code_tracker", tracker, countEntries(tracker)),
    S("ctxstate", "引擎", "上下文状态 context_state", ctxState, countEntries(ctxState)),
    S("instid", "引擎", "安装标识 installation_id", instId),
    S("idesettings", "IDE层", "用户设置 settings.json", settings),
    S("idekeys", "IDE层", "快捷键 keybindings.json", keybinds),
    S("idesnippets", "IDE层", "代码片段 snippets", snippets, countEntries(snippets)),
    S("idestate", "IDE层", "界面状态 state.vscdb", stateDb),
    S("ideargv", "IDE层", "启动参数 argv.json", argv),
    S("ideexts", "IDE层", "扩展 ~/.devin/extensions", exts, countEntries(exts)),
    S("idehistory", "IDE层", "本地文件历史 History", hist, countEntries(hist)),
    S("idewsstorage", "IDE层", "工作区状态 workspaceStorage", wsStorage, countEntries(wsStorage)),
    S("idebackups", "IDE层", "热退出未保存 Backups", backups, countEntries(backups)),
    S("idechatmodels", "IDE层", "对话模型 chatLanguageModels.json", chatModels),
    S("acp", "账户", "ACP 本地注册表", acp, countAcpAgents(acp)),
    S("cred", "账户", "登录凭据 credentials.toml", cred),
    S("cli", "账户", "Devin CLI 状态", cli, countEntries(cli)),
    S("climcp", "账户", "CLI MCP 状态(~/.local/share/devin/mcp)", cliMcp, countEntries(cliMcp)),
    S("wam", "插件", "对话备份(~/.wam)", wam, countEntries(wam)),
  ];
  return { ide: detectIde(), configRoot: ws, configRootExists: exists(ws), ideUserDir: userDir, sources };
}

module.exports = { home, detect, detectIde, ideBinCandidates, ideUserDir, countMcpServers, countAcpAgents, countMd, countSkills, countEntries, sizeKb };
