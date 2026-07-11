// 道 · 最小 ACP（Agent Client Protocol）stdio 客户端
// ─────────────────────────────────────────────────────────────────────────────
// 实证(印254):Devin 三模式后端是 ACP(JSON-RPC 2.0),非 OpenAI /v1/chat/completions。
//   Devin Local → spawn `devin acp`(stdio)
//   Devin Cloud → wss://app.devin.ai/api/acp/live(远端 ACP,本客户端暂只走本地 stdio)
//   Cascade     → windsurf language_server(本地,另行接入)
// 本模块封装 initialize / authenticate / session/new / session/prompt,
// 并把 agent 侧 `session/update` 通知回吐给调用方(用于 webview 流式渲染)。
"use strict";

const fs = require("fs");
const { spawn } = require("child_process");
const { resolveEngine } = require("./devin-provision");

// `devin` 引擎二进制解析 —— 自持优先(插件内置 engine/ → 缓存 → 本机安装)。
function resolveDevinBin(extRoot, storageDir) {
  return resolveEngine(extRoot, storageDir);
}

// JSON-RPC over stdio:每帧一行 JSON(\n 分隔)。与实测 `devin acp` 行为一致。
class AcpClient {
  constructor(opts = {}) {
    this._bin = opts.bin || resolveDevinBin();
    this._cwd = opts.cwd || process.cwd();
    this._log = opts.log || (() => {});
    this._child = null;
    this._buf = "";
    this._nextId = 1;
    this._pending = new Map(); // id -> {resolve, reject}
    this._onUpdate = opts.onUpdate || (() => {}); // session/update 通知回调
    this._onPermission = opts.onPermission || null; // session/request_permission 回调(返回 Promise<optionId>)
    this._sessionId = null;
    this.agentInfo = null;
  }

  available() { return !!this._bin; }
  get bin() { return this._bin; }

  start() {
    if (!this._bin) throw new Error("未找到 devin 二进制(设置 DAO_DEVIN_BIN 指向 Devin Desktop 内置 devin)");
    this._child = spawn(this._bin, ["acp"], {
      cwd: this._cwd,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, RUST_LOG: process.env.RUST_LOG || "info" },
    });
    this._child.stdout.on("data", (d) => this._onStdout(d));
    this._child.stderr.on("data", (d) => this._log("[acp:stderr] " + String(d).trim()));
    this._child.on("exit", (code) => {
      this._log("[acp] devin acp 退出 code=" + code);
      for (const { reject } of this._pending.values()) reject(new Error("acp process exited"));
      this._pending.clear();
      this._child = null;
    });
  }

  stop() {
    if (this._child) { try { this._child.kill(); } catch (_) {} this._child = null; }
  }

  _onStdout(chunk) {
    this._buf += chunk.toString();
    let idx;
    while ((idx = this._buf.indexOf("\n")) >= 0) {
      const line = this._buf.slice(0, idx).trim();
      this._buf = this._buf.slice(idx + 1);
      if (!line) continue;
      let msg;
      try { msg = JSON.parse(line); } catch (_) { continue; }
      this._dispatch(msg);
    }
  }

  _dispatch(msg) {
    // 响应
    if (msg.id !== undefined && (msg.result !== undefined || msg.error !== undefined)) {
      const p = this._pending.get(msg.id);
      if (!p) return;
      this._pending.delete(msg.id);
      if (msg.error) p.reject(new Error(msg.error.message || JSON.stringify(msg.error)));
      else p.resolve(msg.result);
      return;
    }
    // 通知(agent → client):session/update 及 _cognition.ai/* 扩展通知。
    if (msg.method === "session/update") {
      try { this._onUpdate(msg.params); } catch (_) {}
      return;
    }
    if (msg.method && msg.id === undefined) {
      this._log("[acp] notif " + msg.method);
      return;
    }
    // agent 侧请求(fs / permission 等) —— 按 ACP 协议真实实现。
    if (msg.method && msg.id !== undefined) this._handleAgentRequest(msg);
  }

  async _handleAgentRequest(msg) {
    const reply = (result) => this._send({ jsonrpc: "2.0", id: msg.id, result });
    const fail = (code, message) => this._send({ jsonrpc: "2.0", id: msg.id, error: { code, message } });
    const p = msg.params || {};
    try {
      if (msg.method === "fs/read_text_file") {
        let text = fs.readFileSync(p.path, "utf8");
        if (p.line != null || p.limit != null) {
          const lines = text.split("\n");
          const start = p.line != null ? Math.max(0, p.line - 1) : 0;
          text = lines.slice(start, p.limit != null ? start + p.limit : undefined).join("\n");
        }
        return reply({ content: text });
      }
      if (msg.method === "fs/write_text_file") {
        fs.writeFileSync(p.path, p.content != null ? p.content : "");
        return reply(null);
      }
      if (msg.method === "session/request_permission") {
        const options = (p.options || []);
        let optionId = null;
        if (this._onPermission) {
          try { optionId = await this._onPermission(p); } catch (_) {}
        }
        if (!optionId) {
          const allow = options.find((o) => o.kind === "allow_once" || o.kind === "allow_always") || options[0];
          optionId = allow && allow.optionId;
        }
        if (!optionId) return reply({ outcome: { outcome: "cancelled" } });
        return reply({ outcome: { outcome: "selected", optionId } });
      }
      this._log("[acp] agent 请求 " + msg.method + " → 空应答");
      return reply({});
    } catch (e) {
      return fail(-32603, String(e && e.message || e));
    }
  }

  _send(obj) {
    if (!this._child) throw new Error("acp 未启动");
    this._child.stdin.write(JSON.stringify(obj) + "\n");
  }

  request(method, params, timeoutMs = 60000) {
    const id = this._nextId++;
    return new Promise((resolve, reject) => {
      this._pending.set(id, { resolve, reject });
      const t = setTimeout(() => {
        if (this._pending.has(id)) { this._pending.delete(id); reject(new Error("acp timeout: " + method)); }
      }, timeoutMs);
      const wrap = (fn) => (v) => { clearTimeout(t); fn(v); };
      this._pending.set(id, { resolve: wrap(resolve), reject: wrap(reject) });
      this._send({ jsonrpc: "2.0", id, method, params });
    });
  }

  async initialize() {
    const res = await this.request("initialize", {
      protocolVersion: 1,
      clientCapabilities: {
        fs: { readTextFile: true, writeTextFile: true },
        terminal: false,
      },
      clientInfo: { name: "dao-cascade", version: "2.19.6" },
    });
    this.agentInfo = res && res.agentInfo;
    this.agentCapabilities = res && res.agentCapabilities;
    return res;
  }

  // apiKey 可选:宿主持 windsurf-api-key 时经 authenticate meta 下发(实测 method_id)。
  async authenticate(methodId, apiKey) {
    const params = { methodId: methodId || "windsurf-api-key" };
    if (apiKey) params._meta = { apiKey };
    return this.request("authenticate", params);
  }

  // 实测返回: { sessionId, modes:{currentModeId, availableModes:[{id,name}…]}, configOptions }
  //   模式: accept-edits(Code) / ask(Ask) / plan(Plan) / bypass(Bypass Permissions)
  async newSession(cwd, mcpServers) {
    const res = await this.request("session/new", {
      cwd: cwd || this._cwd,
      mcpServers: mcpServers || [],
    });
    this._sessionId = res && (res.sessionId || res.id);
    this.modes = res && res.modes;
    return res;
  }

  async setMode(modeId) {
    if (!this._sessionId) throw new Error("无会话");
    return this.request("session/set_mode", { sessionId: this._sessionId, modeId });
  }

  // 会话配置(官方模型选择即 category=model 的 configOption)。
  async setConfigOption(configId, value) {
    if (!this._sessionId) throw new Error("无会话");
    return this.request("session/set_config_option", {
      sessionId: this._sessionId, configId, value,
    });
  }

  async listSessions() {
    return this.request("session/list", {});
  }

  // 历史会话回放:agent 以 session/update 重放历史帧后返回。
  async loadSession(sessionId, cwd) {
    const res = await this.request("session/load", {
      sessionId, cwd: cwd || this._cwd, mcpServers: [],
    }, 120000);
    this._sessionId = sessionId;
    if (res && res.modes) this.modes = res.modes;
    return res;
  }

  async cancel() {
    if (!this._sessionId) return;
    this._send({ jsonrpc: "2.0", method: "session/cancel", params: { sessionId: this._sessionId } });
  }

  get sessionId() { return this._sessionId; }

  // 发送一条用户消息;流式响应经 onUpdate(session/update) 回吐。
  async prompt(text) {
    if (!this._sessionId) throw new Error("无会话(先 newSession)");
    return this.request("session/prompt", {
      sessionId: this._sessionId,
      prompt: [{ type: "text", text }],
    }, 300000);
  }
}

module.exports = { AcpClient, resolveDevinBin };
