// 道 · Windows 分身面板核(headless·零 vscode 依赖) —— 统一多分身面板的数据真源。
// ─────────────────────────────────────────────────────────────────────────────
// 供 unified-panel「🪟 Windows 分身」板块调用：一次探活聚合
//   · MCP 注册态(windows-agent.js status)与本机检出
//   · Dao-Windows-Agent 桥(/api/health → apps/sessions)
//   · 桌面路由隧道(/input → 各分身输入租约持有者)
//   · 分身隔离矩阵(/api/clone.matrix → 每软件最低可行隔离档)
// 无 vscode 依赖，CI headless 可测。
"use strict";
const http = require("http");
const https = require("https");
const windowsAgent = require("./windows-agent");

const DEF_BRIDGE = "http://127.0.0.1:9930";
const DEF_TUNNEL = "http://127.0.0.1:4824";

function bridgeBase() { return String(process.env.DAO_WIN_BRIDGE_URL || DEF_BRIDGE).replace(/\/+$/, ""); }
function tunnelBase() { return String(process.env.DAO_WIN_TUNNEL_URL || DEF_TUNNEL).replace(/\/+$/, ""); }

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
        headers: data
          ? { "Content-Type": "application/json", "Content-Length": data.length }
          : {},
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

// 一次聚合探活。任一子源不可达不拖垮整体(逐源 ok/error)。
async function probe() {
  const out = {
    mcp: null, checkout: null,
    bridge: { url: bridgeBase(), ok: false, apps: [], sessions: [], error: "" },
    tunnel: { url: tunnelBase(), ok: false, holders: [], error: "" },
    matrix: null,
    probedAt: new Date().toISOString(),
  };
  try { out.mcp = windowsAgent.status(); } catch (e) { out.mcp = { registered: false, error: e.message }; }
  try { out.checkout = windowsAgent.findLocalCheckout(); } catch (_) {}
  try {
    const h = await _req("GET", out.bridge.url + "/api/health", null, 3000);
    out.bridge.ok = !!h.ok;
    out.bridge.apps = h.apps || [];
    out.bridge.sessions = h.sessions || [];
  } catch (e) { out.bridge.error = e.message; }
  try {
    const l = await _req("GET", out.tunnel.url + "/input", null, 3000);
    out.tunnel.ok = !!(l && l.ok);
    out.tunnel.holders = (l && l.holders) || [];
  } catch (e) { out.tunnel.error = e.message; }
  if (out.bridge.ok && out.bridge.apps.length) {
    try {
      const m = await _req("POST", out.bridge.url + "/api/clone.matrix", { app_ids: out.bridge.apps }, 5000);
      out.matrix = m.matrix || m;
    } catch (e) { out.matrix = { error: e.message }; }
  }
  return out;
}

// 释放某分身的输入租约(面板「释放」按钮)。
async function releaseLease(key, owner) {
  if (!key || !owner) return { ok: false, error: "需 key 与 owner" };
  const q = "/input?op=release&key=" + encodeURIComponent(key) + "&owner=" + encodeURIComponent(owner);
  try { return await _req("POST", tunnelBase() + q, null, 4000); }
  catch (e) { return { ok: false, error: e.message }; }
}

module.exports = { probe, releaseLease, bridgeBase, tunnelBase };
