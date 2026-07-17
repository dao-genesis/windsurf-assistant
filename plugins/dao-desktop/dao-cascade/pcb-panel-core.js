// 道 · PCB 面板核(headless·零 vscode 依赖) —— 统一 PCB 板块的数据真源。
// ─────────────────────────────────────────────────────────────────────────────
// 供 unified-panel「⚡ PCB」板块调用：一次探活聚合
//   · MCP 注册态(pcb-agent.js status)与本机检出
//   · 本机 KiCad/嘉立创EDA 安装探测(纯文件系统)
//   · KiCad 桥(:9931 /api/health)与 LCEDA 桥(:9940 /api/health, 官方 EXTAPI 面)
//   · EasyEDA Pro CDP(:9222 /json/version, 本机客户端活性)
// 无 vscode 依赖，CI headless 可测。
"use strict";
const http = require("http");
const https = require("https");
const { spawn } = require("child_process");
const pcbAgent = require("./pcb-agent");

const DEF_KICAD_BRIDGE = "http://127.0.0.1:9931";
const DEF_LCEDA_BRIDGE = "http://127.0.0.1:9940";
const DEF_EDA_CDP = "http://127.0.0.1:9222";

function kicadBridgeBase() { return String(process.env.DAO_KICAD_BRIDGE_URL || DEF_KICAD_BRIDGE).replace(/\/+$/, ""); }
function lcedaBridgeBase() { return String(process.env.DAO_LCEDA_BRIDGE_URL || DEF_LCEDA_BRIDGE).replace(/\/+$/, ""); }
function edaCdpBase() { return String(process.env.DAO_EDA_CDP_URL || DEF_EDA_CDP).replace(/\/+$/, ""); }
function bridgeToken() { return process.env.DAO_PCB_TOKEN || "dao-pcb-lab"; }

function _req(method, url, body, timeoutMs) {
  return new Promise((resolve, reject) => {
    let u;
    try { u = new URL(url); } catch (e) { return reject(new Error("无效 URL: " + url)); }
    const mod = u.protocol === "https:" ? https : http;
    const data = body == null ? null : Buffer.from(JSON.stringify(body), "utf8");
    const req = mod.request(
      {
        method,
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        headers: Object.assign(
          { Authorization: "Bearer " + bridgeToken() },
          data ? { "Content-Type": "application/json", "Content-Length": data.length } : {}
        ),
        timeout: timeoutMs || 4000,
      },
      (res) => {
        let out = "";
        res.on("data", (c) => (out += c));
        res.on("end", () => {
          let parsed;
          try { parsed = JSON.parse(out); } catch (_) { parsed = { raw: out }; }
          if (res.statusCode >= 400) return reject(new Error("HTTP " + res.statusCode + ": " + out.slice(0, 200)));
          resolve(parsed);
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("超时 " + (timeoutMs || 4000) + "ms")));
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

// ── 板块模块目录(每模块 = 一个可多实例打开的页面) ──
// kind web: 官方网页, 经内置站内代理 iframe 内嵌(多实例, 每开一次一个独立 tab);
// kind app: 本机原生编辑器(KiCad 各分编辑器 exe / 嘉立创EDA 客户端), 每开一次一个独立进程实例。
function modules() {
  return [
    { id: "lceda-home", kind: "web", icon: "🏠", name: "嘉立创EDA · 工程主页", url: "https://pro.lceda.cn/" },
    { id: "lceda-editor", kind: "web", icon: "📐", name: "嘉立创EDA · 编辑器(原理图/PCB)", url: "https://pro.lceda.cn/editor" },
    { id: "easyeda-editor", kind: "web", icon: "🌐", name: "EasyEDA Pro · 国际版编辑器", url: "https://pro.easyeda.com/editor" },
    { id: "jlc-order", kind: "web", icon: "🏭", name: "嘉立创 · 下单/SMT", url: "https://www.jlc.com/" },
    { id: "lcsc", kind: "web", icon: "🔩", name: "立创商城 · 元器件选型", url: "https://so.szlcsc.com/" },
    { id: "eda-app", kind: "app", icon: "⚙", name: "嘉立创EDA · 本机客户端", exe: "easyeda" },
    { id: "kicad-main", kind: "app", icon: "🗂", name: "KiCad · 工程管理器", exe: "kicad" },
    { id: "kicad-sch", kind: "app", icon: "✏️", name: "KiCad · 原理图/符号编辑器", exe: "eeschema" },
    { id: "kicad-pcb", kind: "app", icon: "🟩", name: "KiCad · PCB 编辑器", exe: "pcbnew" },
    { id: "kicad-gerber", kind: "app", icon: "🎞", name: "KiCad · Gerber 查看器", exe: "gerbview" },
    { id: "kicad-calc", kind: "app", icon: "🧮", name: "KiCad · 计算器(阻抗/线宽)", exe: "pcb_calculator" },
  ];
}

// 一次聚合探活。任一子源不可达不拖垮整体(逐源 ok/error)。
async function probe() {
  const out = {
    mcp: null, checkout: null,
    installs: { kicad: null, easyeda: null },
    kicadBridge: { url: kicadBridgeBase(), ok: false, error: "" },
    lcedaBridge: { url: lcedaBridgeBase(), ok: false, namespaces: 0, verbs: 0, error: "" },
    cdp: { url: edaCdpBase(), ok: false, browser: "", error: "" },
    modules: modules(),
    probedAt: new Date().toISOString(),
  };
  try { out.mcp = pcbAgent.status(); } catch (e) { out.mcp = { registered: false, error: e.message }; }
  try { out.checkout = pcbAgent.findLocalCheckout(); } catch (_) {}
  try { out.installs.kicad = pcbAgent.detectKicad(); } catch (e) { out.installs.kicad = { installed: false, error: e.message }; }
  try { out.installs.easyeda = pcbAgent.detectEasyeda(); } catch (e) { out.installs.easyeda = { installed: false, error: e.message }; }
  try {
    const h = await _req("GET", out.kicadBridge.url + "/api/health", null, 3000);
    out.kicadBridge.ok = !!(h.ok || h.status === "ok");
    out.kicadBridge.detail = h;
  } catch (e) { out.kicadBridge.error = e.message; }
  try {
    const h = await _req("GET", out.lcedaBridge.url + "/api/health", null, 3000);
    out.lcedaBridge.ok = !!(h.ok || h.status === "ok");
    out.lcedaBridge.namespaces = h.namespaces || 0;
    out.lcedaBridge.verbs = h.verbs || 0;
    out.lcedaBridge.detail = h;
  } catch (e) { out.lcedaBridge.error = e.message; }
  try {
    const v = await _req("GET", out.cdp.url + "/json/version", null, 3000);
    out.cdp.ok = !!(v && (v.Browser || v.webSocketDebuggerUrl));
    out.cdp.browser = (v && v.Browser) || "";
  } catch (e) { out.cdp.error = e.message; }
  return out;
}

// 主页速览(同步·纯文件系统, 供归一主页 PCB 环境卡, 不做网络探活)。
function detectQuick() {
  let kicad = { installed: false }, easyeda = { installed: false }, mcp = { registered: false };
  try { kicad = pcbAgent.detectKicad(); } catch (_) {}
  try { easyeda = pcbAgent.detectEasyeda(); } catch (_) {}
  try { mcp = pcbAgent.status(); } catch (_) {}
  return { kicad, easyeda, mcp };
}

// 开本机原生编辑器实例(每次调用一个独立进程 = 多实例)。
function openApp(exeKey) {
  if (exeKey === "easyeda") {
    const e = pcbAgent.detectEasyeda();
    if (!e.installed) return { ok: false, error: "未检出嘉立创EDA/EasyEDA Pro 客户端" };
    spawn(e.exe, [], { detached: true, stdio: "ignore" }).unref();
    return { ok: true, exe: e.exe };
  }
  const k = pcbAgent.detectKicad();
  if (!k.installed) return { ok: false, error: "未检出 KiCad(可先装 KiCad 9)" };
  const path = require("path");
  const exe = path.join(k.binDir, exeKey + (process.platform === "win32" ? ".exe" : ""));
  if (!require("fs").existsSync(exe)) return { ok: false, error: "编辑器不存在: " + exe };
  spawn(exe, [], { detached: true, stdio: "ignore" }).unref();
  return { ok: true, exe };
}

module.exports = { probe, detectQuick, modules, openApp, kicadBridgeBase, lcedaBridgeBase, edaCdpBase };
