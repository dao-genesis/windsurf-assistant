// 道 · FreeCAD Agent 接入官方工具层(樸散則為器 · 官方的壳 + 自建的髓)。
// ─────────────────────────────────────────────────────────────────────────────
// 本源：把 Dao-3D-Modeling-Agent 的 FreeCAD 全量建模能力(cad_agent)做成 Cascade
// **原生并列工具**。官方 LS 的原生工具扩展面即 mcp_config.json(与 dao-windows-agent /
// dao-pcb 同一真源同一路径)——注册进去后与官方工具同层调度调用。
// 两种通道：
//   · local  — 本机有 Dao-3D-Modeling-Agent 检出：stdio 直起 `python -m cad_agent.mcp_server`
//              (solid/sketch/param/asm/measure/percept/mesh/fem/view 等全量 op;
//               本机 FreeCAD 桥 18920 在跑即自动附着同一 GUI 会话态)。
//   · remote — 经 DAO Bridge 内网穿透：serverUrl 指公网 `/mcp`(Bearer 鉴权)。
// 配置读写复用 mcp-config.js 真源(DAO_MCP_CONFIG_FILE 可重定向，测试隔离)。
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const mcpConfig = require("./mcp-config");

const SERVER_NAME = "dao-freecad";

// 定位本机 Dao-3D-Modeling-Agent 检出。显式传入即为权威(无效不回退猜测，误配须可见)；
// 未显式传入才依次猜 DAO_FC_AGENT_DIR / ~/repos / ~。
function _isCheckout(d) {
  try { return fs.existsSync(path.join(d, "cad_agent", "mcp_server.py")); } catch (_) { return false; }
}

function findLocalCheckout(explicit) {
  if (explicit) return _isCheckout(explicit) ? explicit : null;
  const cands = [
    process.env.DAO_FC_AGENT_DIR,
    path.join(os.homedir(), "repos", "Dao-3D-Modeling-Agent"),
    path.join(os.homedir(), "Dao-3D-Modeling-Agent"),
  ].filter(Boolean);
  for (const d of cands) if (_isCheckout(d)) return d;
  return null;
}

// ── 本机 FreeCAD 安装探测(纯文件系统, headless 零副作用) ──
// Windows 扫 Program Files / LOCALAPPDATA 下 FreeCAD* 任意版本目录;
// *nix 探常位(apt/snap/flatpak/AppImage squashfs); mac 探 /Applications。
function detectFreecad() {
  if (process.platform === "win32") {
    const roots = [
      process.env.ProgramFiles || "C:\\Program Files",
      process.env["ProgramFiles(x86)"] || "",
      process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "Programs") : "",
    ].filter(Boolean);
    for (const root of roots) {
      let names = [];
      try { names = fs.readdirSync(root).filter((n) => /^freecad/i.test(n)).sort().reverse(); } catch (_) { continue; }
      for (const n of names) {
        for (const rel of ["bin\\FreeCAD.exe", "bin\\freecad.exe"]) {
          const exe = path.join(root, n, rel);
          if (fs.existsSync(exe)) return { installed: true, version: (n.match(/[\d.]+/) || [""])[0], exe };
        }
      }
    }
    return { installed: false };
  }
  if (process.platform === "darwin") {
    const exe = "/Applications/FreeCAD.app/Contents/MacOS/FreeCAD";
    return fs.existsSync(exe) ? { installed: true, version: "", exe } : { installed: false };
  }
  const cands = [
    "/usr/bin/freecad", "/usr/local/bin/freecad", "/snap/bin/freecad", "/usr/bin/FreeCAD",
    "/var/lib/flatpak/exports/bin/org.freecad.FreeCAD",
    path.join(os.homedir(), "squashfs-root/usr/bin/freecad"),
  ];
  for (const exe of cands) if (fs.existsSync(exe)) return { installed: true, version: "", exe };
  return { installed: false };
}

// 注册 local 通道：stdio 起 cad_agent.mcp_server(solid/asm/measure/percept 等全量 op)。
// opts: { dir?, token?, bridgePort?, disabled? } → { ok, name, transport, configPath } | { ok:false, error }
function registerLocal(opts) {
  opts = opts || {};
  const dir = findLocalCheckout(opts.dir);
  if (!dir) return { ok: false, error: "未找到 Dao-3D-Modeling-Agent 检出(可设 DAO_FC_AGENT_DIR)" };
  const env = { PYTHONPATH: dir };
  if (opts.token) env.DAO_FC_TOKEN = String(opts.token);
  if (opts.bridgePort) env.FC_REMOTE_PORT = String(opts.bridgePort);
  const spec = {
    command: process.platform === "win32" ? "python" : "python3",
    args: ["-m", "cad_agent.mcp_server"],
    cwd: dir,
    env,
  };
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
    hasAuth: !!(spec.headers && spec.headers.Authorization) || !!(spec.env && spec.env.DAO_FC_TOKEN),
    disabled: !!spec.disabled,
  };
}

// ── proxy Pro · FreeCAD 模式提示词(工具描述层) ──
// 太上下知有之：只述工具之有，不教其用、不强其行 —— AI 自知可用而自主择用。
// 域开关(mode-fusion overlays)开启时并入系统提示；关闭时官方原貌，工具仍注册在册。
const MODE_ID = "freecad-agent";

function modePrompt() {
  return [
    "# FreeCAD 模式(道并行而不相悖)",
    "",
    "你已接入 FreeCAD 3D 建模的官方并列工具层(dao-freecad MCP)。除写代码外，你还可用这些工具：",
    "",
    "- 建模: solid.box/cylinder/…(体素)、sketch.*(2D 草图)、param.*(参数化改参重放)、",
    "  boolean/fillet/chamfer 等全量特征 op —— 皆为真实 FreeCAD 内核，非模拟。",
    "- 装配: asm.place/mate/dof(接地链/过约束诊断)、asm.interference(干涉检查)。",
    "- 感知与验证: percept.*(模型树/视口现状)、measure.*(尺寸/质心/质量属性)、view.render(出图)。",
    "- 网格与仿真: mesh.*(四面体网格/水密分析)、fem.*(gmsh+ccx 结构仿真)、工程图/CAM 后处理。",
    "- 桥接直达: 本机 FreeCAD 桥(默认 :18920) POST /tool {op,args} 或自由脚本 POST /exec",
    "  {code}(FreeCAD Python, GUI 实时可见); GET /toolspec 实时枚举全量工具目录。",
    "- 你的每步成果都落在用户 IDE 面板可见的 FreeCAD 页面(整窗归一/归一工作台/各工作台",
    "  网页模块)——用户随时观看、协助、纠偏。",
    "",
    "水善利万物而有静，唯变所适。",
  ].join("\n");
}

module.exports = {
  SERVER_NAME, MODE_ID,
  findLocalCheckout, detectFreecad,
  registerLocal, registerRemote, setDisabled, unregister, status, modePrompt,
};
