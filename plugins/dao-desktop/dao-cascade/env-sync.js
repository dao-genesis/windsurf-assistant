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

// 共享配置源全清单: 每项 { key,label,path,exists,count? } —— path 即官方同一路径。
function detect() {
  const h = home();
  const ws = path.join(h, ".codeium", "windsurf");
  const mcp = path.join(ws, "mcp_config.json");
  const acp = path.join(h, ".windsurf", "acp", "registry.json");
  const cred = path.join(h, ".local", "share", "devin", "credentials.toml");
  const gRules = path.join(h, ".devin", "rules");
  const gRulesMd = path.join(ws, "memories", "global_rules.md");
  const gWf = path.join(ws, "global_workflows");
  const gSk = path.join(ws, "skills");
  const sources = [
    { key: "mcp", label: "MCP 配置 mcp_config.json", path: mcp, exists: exists(mcp), count: countMcpServers(mcp) },
    { key: "grules", label: "全局 Rules(~/.devin/rules)", path: gRules, exists: exists(gRules), count: countMd(gRules) },
    { key: "grulesmd", label: "全局规则 global_rules.md", path: gRulesMd, exists: exists(gRulesMd) },
    { key: "gworkflows", label: "全局 Workflows", path: gWf, exists: exists(gWf), count: countMd(gWf) },
    { key: "gskills", label: "全局 Skills", path: gSk, exists: exists(gSk), count: countSkills(gSk) },
    { key: "acp", label: "ACP 本地注册表", path: acp, exists: exists(acp), count: countAcpAgents(acp) },
    { key: "cred", label: "登录凭据 credentials.toml", path: cred, exists: exists(cred) },
  ];
  return { ide: detectIde(), configRoot: ws, configRootExists: exists(ws), sources };
}

module.exports = { home, detect, detectIde, ideBinCandidates, countMcpServers, countAcpAgents, countMd, countSkills };
