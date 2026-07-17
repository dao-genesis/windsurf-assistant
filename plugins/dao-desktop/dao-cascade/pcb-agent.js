// 道 · PCB Agent 接入官方工具层(樸散則為器 · 官方的壳 + 自建的髓)。
// ─────────────────────────────────────────────────────────────────────────────
// 本源：把 Dao-PCB-Design-Agent 的 KiCad/嘉立创EDA 能力做成 Cascade **原生并列工具**。
// 官方 LS 的原生工具扩展面即 mcp_config.json(与 dao-windows-agent 同一真源同一路径)——
// 注册进去后 Cascade/Devin Local/Devin Cloud 三模式与官方工具同层调度调用。
// 两种通道：
//   · local  — 本机有 Dao-PCB-Design-Agent 检出：stdio 直起 `python pcb_brain/pcb_mcp.py`
//              (design_pcb/run_drc/export_gerber/search_footprint 等 16 工具;
//               本机 KiCad 桥 9931 / LCEDA 桥 9940 在跑即自动附着同一会话态)。
//   · remote — 经 DAO Bridge 内网穿透：serverUrl 指公网 `/mcp`(Bearer 鉴权)。
// 配置读写复用 mcp-config.js 真源(DAO_MCP_CONFIG_FILE 可重定向，测试隔离)。
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const mcpConfig = require("./mcp-config");

const SERVER_NAME = "dao-pcb";

// 定位本机 Dao-PCB-Design-Agent 检出。显式传入即为权威(无效不回退猜测，误配须可见)；
// 未显式传入才依次猜 DAO_PCB_AGENT_DIR / ~/repos / ~。
function _isCheckout(d) {
  try { return fs.existsSync(path.join(d, "pcb_brain", "pcb_mcp.py")); } catch (_) { return false; }
}

function findLocalCheckout(explicit) {
  if (explicit) return _isCheckout(explicit) ? explicit : null;
  const cands = [
    process.env.DAO_PCB_AGENT_DIR,
    path.join(os.homedir(), "repos", "Dao-PCB-Design-Agent"),
    path.join(os.homedir(), "Dao-PCB-Design-Agent"),
  ].filter(Boolean);
  for (const d of cands) if (_isCheckout(d)) return d;
  return null;
}

// ── 本机 EDA 安装探测(纯文件系统, headless 零副作用) ──
// KiCad: Windows 装于 C:\Program Files\KiCad\<主版本>\bin, 版本取目录名; *nix 探 PATH 常位。
function detectKicad() {
  if (process.platform === "win32") {
    const roots = [process.env.ProgramFiles || "C:\\Program Files", process.env["ProgramFiles(x86)"] || ""]
      .filter(Boolean).map((r) => path.join(r, "KiCad"));
    for (const root of roots) {
      let vers = [];
      try { vers = fs.readdirSync(root).filter((v) => /^\d/.test(v)).sort().reverse(); } catch (_) { continue; }
      for (const v of vers) {
        const cli = path.join(root, v, "bin", "kicad-cli.exe");
        if (fs.existsSync(cli)) return { installed: true, version: v, binDir: path.join(root, v, "bin"), cli };
      }
    }
    return { installed: false };
  }
  const cands = process.platform === "darwin"
    ? ["/Applications/KiCad/KiCad.app/Contents/MacOS/kicad-cli"]
    : ["/usr/bin/kicad-cli", "/usr/local/bin/kicad-cli"];
  for (const cli of cands) if (fs.existsSync(cli)) return { installed: true, version: "", binDir: path.dirname(cli), cli };
  return { installed: false };
}

// 嘉立创EDA: 国内客户端 lceda-pro, 国际版 easyeda-pro —— 取实际存在者(与 LCEDA 桥目录自适配同理)。
function detectEasyeda() {
  const names = [
    { dir: "lceda-pro", exe: "lceda-pro.exe", variant: "lceda" },
    { dir: "easyeda-pro", exe: "easyeda-pro.exe", variant: "easyeda" },
  ];
  if (process.platform === "win32") {
    const roots = [process.env.ProgramFiles || "C:\\Program Files", process.env.LOCALAPPDATA || ""].filter(Boolean);
    for (const root of roots) {
      for (const n of names) {
        const exe = path.join(root, n.dir, n.exe);
        if (fs.existsSync(exe)) return { installed: true, variant: n.variant, exe };
      }
    }
    return { installed: false };
  }
  // Linux 官方 install.sh 落在 /opt/apps/<dir>; 手装常见 /opt/<dir> —— 两根都探。
  for (const root of ["/opt", "/opt/apps"]) {
    for (const n of names) {
      const exe = root + "/" + n.dir + "/" + n.dir;
      if (fs.existsSync(exe)) return { installed: true, variant: n.variant, exe };
    }
  }
  return { installed: false };
}

// 注册 local 通道：stdio 优先起 pcb_brain/dao_core.py(闻道日损·9 个正交核心工具,
// 背后经 agent_tool_manifest 路由双软件 9009 全表面); 老检出无 dao_core 则回退 pcb_mcp.py。
// opts: { dir?, token?, kicadPort?, lcedaPort?, disabled? } → { ok, name, transport, configPath } | { ok:false, error }
function registerLocal(opts) {
  opts = opts || {};
  const dir = findLocalCheckout(opts.dir);
  if (!dir) return { ok: false, error: "未找到 Dao-PCB-Design-Agent 检出(可设 DAO_PCB_AGENT_DIR)" };
  const env = {};
  if (opts.token) env.DAO_PCB_TOKEN = String(opts.token);
  if (opts.kicadPort) env.DAO_KICAD_PORT = String(opts.kicadPort);
  if (opts.lcedaPort) env.LCEDA_BRIDGE_PORT = String(opts.lcedaPort);
  const entry = fs.existsSync(path.join(dir, "pcb_brain", "dao_core.py"))
    ? "dao_core.py" : "pcb_mcp.py";
  const spec = {
    command: process.platform === "win32" ? "python" : "python3",
    args: [path.join("pcb_brain", entry)],
    cwd: dir,
  };
  if (Object.keys(env).length) spec.env = env;
  if (opts.disabled) spec.disabled = true;
  return _write(spec, "local");
}

// 注册 remote 通道：serverUrl 指 DAO Bridge 穿透公网 /mcp(Bearer)。
// opts: { url, token, disabled? }。url 须为 http(s) 且以 /mcp 结尾(不合则自动补)。
function registerRemote(opts) {
  opts = opts || {};
  let url = String(opts.url || "").trim().replace(/\/+$/, "");
  if (!/^https?:\/\//.test(url)) return { ok: false, error: "url 须为 http(s) 公网穿透地址" };
  if (!/\/mcp$/.test(url)) url += "/mcp";
  const spec = { serverUrl: url };
  if (opts.token) spec.headers = { Authorization: "Bearer " + String(opts.token) };
  if (opts.disabled) spec.disabled = true;
  return _write(spec, "remote");
}

function _write(spec, transport) {
  const cfg = mcpConfig.readConfig();
  if (!cfg.mcpServers || typeof cfg.mcpServers !== "object") cfg.mcpServers = {};
  cfg.mcpServers[SERVER_NAME] = spec;
  const p = mcpConfig.writeConfig(cfg);
  return { ok: true, name: SERVER_NAME, transport, configPath: p };
}

// 开/关已注册服务(不删注册)：关 = disabled(工具仍在册, LS 不向模型注入描述); 开 = 官方同层可见。
function setDisabled(disabled) {
  const cfg = mcpConfig.readConfig();
  const spec = (cfg.mcpServers || {})[SERVER_NAME];
  if (!spec) return { ok: false, error: "尚未注册 " + SERVER_NAME };
  if (disabled) spec.disabled = true; else delete spec.disabled;
  const p = mcpConfig.writeConfig(cfg);
  return { ok: true, disabled: !!disabled, configPath: p };
}

function unregister() {
  const cfg = mcpConfig.readConfig();
  const servers = cfg.mcpServers || {};
  const had = !!servers[SERVER_NAME];
  delete servers[SERVER_NAME];
  mcpConfig.writeConfig(cfg);
  return { ok: true, removed: had };
}

// 视图(脱敏：headers 只报有无，不回 token)。
function status() {
  const cfg = mcpConfig.readConfig();
  const spec = (cfg.mcpServers || {})[SERVER_NAME];
  if (!spec) return { registered: false };
  return {
    registered: true,
    transport: spec.serverUrl ? "remote" : "local",
    serverUrl: spec.serverUrl || null,
    cwd: spec.cwd || null,
    hasAuth: !!(spec.headers && spec.headers.Authorization) || !!(spec.env && spec.env.DAO_PCB_TOKEN),
    disabled: !!spec.disabled,
  };
}

// ── proxy Pro · PCB 模式提示词(工具描述层) ──
// 太上下知有之：只述工具之有，不教其用、不强其行 —— AI 自知可用而自主择用。
// 域开关(mode-fusion overlays)开启时并入系统提示；关闭时官方原貌，工具仍注册在册。
const MODE_ID = "pcb-agent";

function modePrompt() {
  return [
    "# PCB 模式(道并行而不相悖)",
    "",
    "你已接入 PCB 设计的官方并列工具层(dao-pcb MCP·闻道日损后的 9 个正交核心工具)：",
    "",
    "- pcb_sense(环境五感) · pcb_search(搜一切: 模板/封装/符号/嘉立创器件/全表面工具)",
    "- pcb_design(KiCad DNA 模板 或 嘉立创 spec 端到端建板: 放置/绑网/布线/DRC 收敛)",
    "- pcb_check(DRC 两引擎归一) · pcb_read(读板) · pcb_open(嘉立创开工程/开文档)",
    "- pcb_export(gerber/bom/ibom/order) · pcb_pipeline(DNA→PCB→DRC→Gerber→iBoM→下单包)",
    "- pcb_call(玄牝之门: 按清单 id 直调双软件 9009 全操纵面任一工具——KiCad SWIG 7912 法/",
    "  kicad-cli 34 命令/嘉立创 EXTAPI 749 法; 先 pcb_search kind=tool 找 id)。",
    "- 背后皆为真实引擎(KiCad 9 与嘉立创EDA客户端), 非模拟。",
    "- 你的每步成果都落在用户 IDE 面板可见的 KiCad/嘉立创EDA 页面——用户随时观看、协助、纠偏。",
    "",
    "水善利万物而有静，唯变所适。",
  ].join("\n");
}

module.exports = {
  SERVER_NAME, MODE_ID,
  findLocalCheckout, detectKicad, detectEasyeda,
  registerLocal, registerRemote, setDisabled, unregister, status, modePrompt,
};
