// 道 · FreeCAD 面板核(headless·零 vscode 依赖) —— 统一 FreeCAD 板块的数据真源。
// ─────────────────────────────────────────────────────────────────────────────
// 供 unified-panel「🧊 FreeCAD」板块调用：一次探活聚合
//   · MCP 注册态(fc-agent.js status)与本机检出
//   · 本机 FreeCAD 安装探测(纯文件系统)
//   · FreeCAD 桥(:18920 /status, 内核+GUI 会话态; /toolspec 全量工具面)
//   · 归一外壳(:9920 /api/health, 主页/整窗/工作台/Proxy Pro 平级板块)
//   · xpra 显示路由(:14500, 整窗 X11 指令级路由 HTML5 客户端)
// 无 vscode 依赖，CI headless 可测。
"use strict";
const http = require("http");
const https = require("https");
const { spawn } = require("child_process");
const fcAgent = require("./fc-agent");

const DEF_FC_BRIDGE = "http://127.0.0.1:18920";
const DEF_FC_SHELL = "http://127.0.0.1:9920";
const DEF_FC_XPRA = "http://127.0.0.1:14500";

function bridgeBase() { return String(process.env.DAO_FC_BRIDGE_URL || DEF_FC_BRIDGE).replace(/\/+$/, ""); }
function shellBase() { return String(process.env.DAO_FC_SHELL_URL || DEF_FC_SHELL).replace(/\/+$/, ""); }
function xpraBase() { return String(process.env.DAO_FC_XPRA_URL || DEF_FC_XPRA).replace(/\/+$/, ""); }

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
        headers: data ? { "Content-Type": "application/json", "Content-Length": data.length } : {},
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
// kind web: 归一外壳本机网页(主页/整窗/工作台/各 FreeCAD 工作台网页模块), iframe 直嵌
// (本机 127.0.0.1 同源直达, 多实例, 每开一次一个独立 tab);
// kind app: 本机原生 FreeCAD(独立进程实例)。
function modules() {
  const s = shellBase();
  return [
    { id: "fc-shell", kind: "web", icon: "☯", name: "归一外壳 · 总控(主页+整窗+工作台)", url: s + "/shell" },
    { id: "fc-window", kind: "web", icon: "🧊", name: "FreeCAD · 整窗归一(全 UI 单网页)", url: s + "/board/freecad" },
    { id: "fc-bench", kind: "web", icon: "⚙", name: "FreeCAD · 归一工作台(模型树/视口/控制台)", url: s + "/board/bench" },
    { id: "fc-part", kind: "web", icon: "🧩", name: "FreeCAD · 参数化零件", url: s + "/board/wb-part" },
    { id: "fc-sketch", kind: "web", icon: "✏️", name: "FreeCAD · 2D 草图", url: s + "/board/wb-sketch" },
    { id: "fc-asm", kind: "web", icon: "🔩", name: "FreeCAD · 装配", url: s + "/board/wb-asm" },
    { id: "fc-bim", kind: "web", icon: "🏗", name: "FreeCAD · BIM/结构", url: s + "/board/wb-bim" },
    { id: "fc-fem", kind: "web", icon: "🌡", name: "FreeCAD · FEM 仿真", url: s + "/board/wb-fem" },
    { id: "fc-draw", kind: "web", icon: "📐", name: "FreeCAD · 工程图", url: s + "/board/wb-draw" },
    { id: "fc-cam", kind: "web", icon: "🛠", name: "FreeCAD · CAM 加工", url: s + "/board/wb-cam" },
    { id: "fc-app", kind: "app", icon: "🖥", name: "FreeCAD · 本机客户端", exe: "freecad" },
  ];
}

// 一次聚合探活。任一子源不可达不拖垮整体(逐源 ok/error)。
async function probe() {
  const out = {
    mcp: null, checkout: null,
    installs: { freecad: null },
    bridge: { url: bridgeBase(), ok: false, version: "", workbench: "", documents: [], toolCount: 0, error: "" },
    shell: { url: shellBase(), ok: false, error: "" },
    xpra: { url: xpraBase(), ok: false, error: "" },
    modules: modules(),
    probedAt: new Date().toISOString(),
  };
  try { out.mcp = fcAgent.status(); } catch (e) { out.mcp = { registered: false, error: e.message }; }
  try { out.checkout = fcAgent.findLocalCheckout(); } catch (_) {}
  try { out.installs.freecad = fcAgent.detectFreecad(); } catch (e) { out.installs.freecad = { installed: false, error: e.message }; }
  try {
    const st = await _req("GET", out.bridge.url + "/status", null, 3000);
    out.bridge.ok = !!st.ok;
    out.bridge.version = Array.isArray(st.freecad_version) ? st.freecad_version.slice(0, 3).filter(Boolean).join(".") : "";
    out.bridge.workbench = st.active_workbench || "";
    out.bridge.documents = st.documents || [];
    try {
      const spec = await _req("GET", out.bridge.url + "/toolspec", null, 3000);
      out.bridge.toolCount = (spec && spec.ok && spec.count) || 0;
    } catch (_) {}
  } catch (e) { out.bridge.error = e.message; }
  try {
    const h = await _req("GET", out.shell.url + "/api/health", null, 3000);
    out.shell.ok = !!h.ok;
  } catch (e) { out.shell.error = e.message; }
  try {
    const r = await _req("GET", out.xpra.url + "/index.html", null, 3000);
    out.xpra.ok = !!r;
  } catch (e) { out.xpra.error = e.message; }
  return out;
}

// 主页速览(同步·纯文件系统, 供归一主页 FreeCAD 环境卡, 不做网络探活)。
function detectQuick() {
  let freecad = { installed: false }, mcp = { registered: false }, checkout = null;
  try { freecad = fcAgent.detectFreecad(); } catch (_) {}
  try { mcp = fcAgent.status(); } catch (_) {}
  try { checkout = fcAgent.findLocalCheckout(); } catch (_) {}
  return { freecad, mcp, checkout };
}

// 开本机原生 FreeCAD 实例(每次调用一个独立进程 = 多实例)。
function openApp(exeKey) {
  if (exeKey !== "freecad") return { ok: false, error: "未知 app 模块: " + exeKey };
  const f = fcAgent.detectFreecad();
  if (!f.installed) return { ok: false, error: "未检出 FreeCAD(装 FreeCAD 后刷新, 或用归一外壳内置运行时)" };
  spawn(f.exe, [], { detached: true, stdio: "ignore" }).unref();
  return { ok: true, exe: f.exe };
}

module.exports = { probe, detectQuick, modules, openApp, bridgeBase, shellBase, xpraBase };
