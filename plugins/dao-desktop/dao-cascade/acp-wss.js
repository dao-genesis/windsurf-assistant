// 道 · Devin Cloud 轨 — 远端 ACP over WebSocket(与官方 CLI cloud_handoff 同源配方)。
// 实证(strings devin 二进制 · chisel-cloud-bridge/src/handoff/mod.rs):
//   端点: <devin_api_url>/acp/live?token=<windsurf_api_key>(wss)
//   握手: initialize → notifications/initialized → session/new
//        → session/set_config_option(org/repo) → session/prompt → 流式 session/update
// 凭据: ~/.local/share/devin/credentials.toml(devin auth login 落盘,与官方同一路径)。
// WebSocket: Electron 39 扩展宿主(Node ≥22)自带全局 WebSocket;老宿主降级报错。
const fs = require("fs");
const path = require("path");
const os = require("os");

function readCredentials() {
  const p = path.join(
    process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share"),
    "devin", "credentials.toml");
  if (!fs.existsSync(p)) return null;
  const t = fs.readFileSync(p, "utf8");
  const pick = (k) => { const m = t.match(new RegExp(k + '\\s*=\\s*"([^"]+)"')); return m ? m[1] : null; };
  return { apiKey: pick("windsurf_api_key"), apiUrl: pick("devin_api_url") || "https://api.devin.ai" };
}

class AcpWssClient {
  constructor(opts) {
    this._log = (opts && opts.log) || (() => {});
    this._onUpdate = (opts && opts.onUpdate) || (() => {});
    this._ws = null;
    this._id = 0;
    this._pending = new Map();
    this.sessionId = null;
  }

  async connect() {
    if (this._ws && this._ws.readyState === 1) return;
    if (typeof WebSocket === "undefined")
      throw new Error("扩展宿主无全局 WebSocket(需 Electron 28+/Node 22+)");
    const cred = readCredentials();
    if (!cred || !cred.apiKey) throw new Error("未找到 Devin 凭据,请先登录(credentials.toml)");
    const url = cred.apiUrl.replace(/^http/, "ws").replace(/\/$/, "") +
      "/acp/live?token=" + encodeURIComponent(cred.apiKey);
    this._log("[cloud] connecting " + url.replace(/token=[^&]+/, "token=***"));
    await new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      const t = setTimeout(() => { try { ws.close(); } catch (_) {} reject(new Error("Devin Cloud ACP 连接超时")); }, 15000);
      ws.onopen = () => { clearTimeout(t); this._ws = ws; resolve(); };
      ws.onerror = () => { clearTimeout(t);
        reject(new Error("Devin Cloud ACP 连接被拒(通常为组织未开通 devin_cloud_acp 或凭据无云端权限)")); };
      ws.onmessage = (e) => this._onMessage(String(e.data));
      ws.onclose = (e) => {
        this._ws = null; this.sessionId = null;
        for (const [, p] of this._pending) p.reject(new Error("WebSocket closed" + (e.reason ? ": " + e.reason : "")));
        this._pending.clear();
        this._log("[cloud] closed " + e.code + " " + (e.reason || ""));
      };
    });
    const init = await this._request("initialize", {
      protocolVersion: 1,
      clientCapabilities: { fs: { readTextFile: false, writeTextFile: false } },
      clientInfo: { name: "dao-desktop", version: "1.0.0" },
    });
    this._notify("notifications/initialized", {});
    return init;
  }

  _onMessage(data) {
    let m; try { m = JSON.parse(data); } catch (_) { return; }
    if (m.id !== undefined && (m.result !== undefined || m.error !== undefined)) {
      const p = this._pending.get(m.id);
      if (p) { this._pending.delete(m.id);
        m.error ? p.reject(new Error(m.error.message || "Unknown error")) : p.resolve(m.result); }
      return;
    }
    if (m.method === "session/update") {
      if (this._hook) { try { this._hook(m.params || {}); } catch (_) {} return; }
      this._onUpdate(m.params || {});
    }
  }

  _request(method, params, timeoutMs) {
    const id = ++this._id;
    this._ws.send(JSON.stringify({ jsonrpc: "2.0", id, method, params }));
    return new Promise((resolve, reject) => {
      this._pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (this._pending.has(id)) { this._pending.delete(id); reject(new Error(method + " 超时")); }
      }, timeoutMs || 60000);
    });
  }

  _notify(method, params) {
    if (this._ws) this._ws.send(JSON.stringify({ jsonrpc: "2.0", method, params }));
  }

  // 截流 session/update(备份回放期间接管帧); 传 null 复原。
  hookUpdates(fn) { this._hook = typeof fn === "function" ? fn : null; }

  async listSessions() { return this._request("session/list", {}); }

  // 历史会话回放: agent 以 session/update 重放历史帧后返回(与 stdio 客户端同约定)。
  async loadSession(sessionId, cwd) {
    const res = await this._request("session/load",
      { sessionId, cwd: cwd || "/", mcpServers: [] }, 120000);
    this.sessionId = sessionId;
    return res;
  }

  async newSession(cwd) {
    const res = await this._request("session/new", { cwd: cwd || "/", mcpServers: [] });
    this.sessionId = res && res.sessionId;
    return res;
  }

  setConfigOption(configId, value) {
    return this._request("session/set_config_option",
      { sessionId: this.sessionId, configId, value });
  }

  // 云端回合可长跑:prompt 请求不设短超时,流式经 session/update 推送。
  prompt(text) {
    return this._request("session/prompt", {
      sessionId: this.sessionId,
      prompt: [{ type: "text", text }],
    }, 30 * 60 * 1000);
  }

  cancel() { this._notify("session/cancel", { sessionId: this.sessionId }); }

  stop() { if (this._ws) { try { this._ws.close(); } catch (_) {} this._ws = null; } this.sessionId = null; }
}

module.exports = { AcpWssClient, readCredentials };
