#!/usr/bin/env node
/**
 * vm_tunnel.js · 轻量版 · 对已有 session 补建隧道
 *
 * 「为无为，事无事，味无味。」
 *
 * 用法:
 *   node vm_tunnel.js --session devin-xxxx
 *   node vm_tunnel.js --session devin-xxxx --ports 3000,8000
 *
 * 场景: 你已通过 vm_direct.js 或 proxy 建了 session · 现在需要补建/重建隧道
 *
 * 依赖: Node 22+ (内置 WebSocket)
 */
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const WSS_BASE = "wss://app.devin.ai/api/acp/live";
const TOKEN_PREFIX = "devin-session-token$";
const WAM_STATE = path.join(os.homedir(), ".wam", "wam-state.json");
const TIMEOUT_MS = 180_000;

const args = process.argv.slice(2);
function getArg(name, def) {
  const i = args.indexOf(`--${name}`);
  if (i >= 0 && args[i + 1]) return args[i + 1];
  const eq = args.find((a) => a.startsWith(`--${name}=`));
  if (eq) return eq.split("=")[1];
  return def;
}

const SESSION_ID = getArg("session", "");
const PORTS = getArg("ports", "6789,5900,8080").split(",").map(Number);
const TOKEN = getArg("token", "");

if (!SESSION_ID) {
  console.error("用法: node vm_tunnel.js --session devin-xxxx [--ports 6789,5900]");
  console.error("  需指定已有 sessionId");
  process.exit(1);
}

const C = {
  G: (s) => `\x1b[32m${s}\x1b[0m`,
  Y: (s) => `\x1b[33m${s}\x1b[0m`,
  R: (s) => `\x1b[31m${s}\x1b[0m`,
  B: (s) => `\x1b[36m${s}\x1b[0m`,
  BO: (s) => `\x1b[1m${s}\x1b[0m`,
  GR: (s) => `\x1b[90m${s}\x1b[0m`,
};

function ts() { return new Date().toISOString().slice(11, 23); }
function log(msg) { console.error(`${C.GR(ts())} ${msg}`); }

function loadToken() {
  if (TOKEN) return TOKEN.startsWith(TOKEN_PREFIX) ? TOKEN.slice(TOKEN_PREFIX.length) : TOKEN;
  try {
    const raw = JSON.parse(fs.readFileSync(WAM_STATE, "utf-8"));
    const key = raw.activeApiKey || "";
    if (!key) throw new Error("WAM 无 activeApiKey");
    return key.startsWith(TOKEN_PREFIX) ? key.slice(TOKEN_PREFIX.length) : key;
  } catch (e) {
    console.error(C.R(`Token 加载失败: ${e.message}`));
    process.exit(1);
  }
}

function buildPrompt() {
  return `Execute this immediately. No explanation needed:

\`\`\`bash
#!/bin/bash
set -e

# Kill existing cloudflared tunnels
pkill cloudflared 2>/dev/null || true
sleep 1

# Install cloudflared if needed
if ! command -v cloudflared &>/dev/null; then
  curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /tmp/cloudflared
  chmod +x /tmp/cloudflared
  sudo mv /tmp/cloudflared /usr/local/bin/cloudflared
fi

# Start tunnels
${PORTS.map(
    (p) => `cloudflared tunnel --url http://localhost:${p} --no-autoupdate 2>/tmp/cf_${p}.log &`
  ).join("\n")}

sleep 8

echo "=== TUNNEL URLS ==="
${PORTS.map(
    (p) => `echo "Port ${p}: $(grep -oP 'https://[a-zA-Z0-9-]+\\.trycloudflare\\.com' /tmp/cf_${p}.log | head -1)"`
  ).join("\n")}
echo "==================="
\`\`\``;
}

async function run() {
  const jwt = loadToken();

  console.error("");
  log(`${C.B("vm_tunnel.js")} · 补建隧道 · session=${C.G(SESSION_ID)}`);
  log(`Ports: ${C.G(PORTS.join(", "))}`);
  console.error("");

  const u = new URL(WSS_BASE);
  u.searchParams.set("token", jwt);

  return new Promise((resolve, reject) => {
    let resolved = false;
    let nextId = 0;
    let fullText = "";
    let tunnelUrls = [];

    const ws = new WebSocket(u.toString());
    const killer = setTimeout(() => {
      if (!resolved) { resolved = true; ws.close(1000); reject(new Error("timeout")); }
    }, TIMEOUT_MS);

    const send = (method, params) => {
      const id = ++nextId;
      ws.send(JSON.stringify({ jsonrpc: "2.0", id, method, params }));
      log(`${C.GR("→")} ${method} ${C.GR("id=" + id)}`);
      return id;
    };

    const finish = () => {
      if (resolved) return;
      resolved = true;
      clearTimeout(killer);
      ws.close(1000);

      console.error("");
      if (tunnelUrls.length > 0) {
        console.error(C.G("★ 隧道 URL:"));
        for (const t of tunnelUrls) console.error(`  ${C.BO(t)}`);
      } else {
        console.error(C.Y("未检测到隧道 URL · 查看 agent 输出"));
      }
      console.error("");
      console.log(JSON.stringify({ sessionId: SESSION_ID, tunnelUrls, timestamp: new Date().toISOString() }, null, 2));
      resolve();
    };

    let initId, loadId, promptId;

    ws.onopen = () => {
      log(`${C.G("●")} WSS 连接`);
      initId = send("initialize", {
        protocolVersion: 1,
        clientCapabilities: { fs: { readTextFile: true }, terminal: true },
      });
    };

    ws.onerror = (ev) => {
      if (!resolved) { resolved = true; clearTimeout(killer); reject(new Error("wss error")); }
    };

    ws.onclose = () => { if (!resolved) finish(); };

    ws.onmessage = (ev) => {
      let raw = ev.data;
      if (raw instanceof ArrayBuffer) raw = Buffer.from(raw).toString("utf8");
      if (Buffer.isBuffer(raw)) raw = raw.toString("utf8");
      if (typeof raw !== "string") return;

      const lines = raw.split("\n").filter((x) => x.trim());
      for (const line of lines) {
        let m;
        try { m = JSON.parse(line); } catch { continue; }

        // agent→client 请求: 防卡死
        if (m.method === "session/request_permission") {
          if (m.id) ws.send(JSON.stringify({ jsonrpc: "2.0", id: m.id, result: { granted: true } }));
          continue;
        }
        if (m.method && (m.method.startsWith("fs/") || m.method.startsWith("terminal/"))) {
          if (m.id) ws.send(JSON.stringify({ jsonrpc: "2.0", id: m.id, error: { code: -32601, message: "N/A" } }));
          continue;
        }

        // session/update
        if (m.method === "session/update") {
          const u = m.params?.update;
          if (u?.content?.text) {
            fullText += u.content.text;
            process.stderr.write(u.content.text);
            const cf = u.content.text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/g);
            if (cf) for (const x of cf) if (!tunnelUrls.includes(x)) { tunnelUrls.push(x); log(`${C.G("★")} ${x}`); }
          }
          if (u?.rawOutput) {
            fullText += u.rawOutput;
            const cf = u.rawOutput.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/g);
            if (cf) for (const x of cf) if (!tunnelUrls.includes(x)) { tunnelUrls.push(x); log(`${C.G("★")} ${x}`); }
          }
          if (u?.stopReason) setTimeout(finish, 500);
          continue;
        }

        // RPC 响应
        if (m.id === 1 && m.result) {
          log(`${C.G("●")} Initialize OK`);
          loadId = send("session/load", { sessionId: SESSION_ID, cwd: "/home/ubuntu", mcpServers: [] });
        } else if (m.id === loadId && m.result) {
          log(`${C.G("●")} Session loaded`);
          promptId = send("session/prompt", {
            sessionId: SESSION_ID,
            prompt: [{ type: "text", text: buildPrompt() }],
          });
        } else if (m.id === loadId && m.error) {
          // load 失败 → session 可能已失效 · 尝试新建
          log(C.Y(`session/load 失败: ${m.error.message} · 转新建`));
          send("session/new", { cwd: "/home/ubuntu", mcpServers: [] });
        } else if (m.result?.sessionId && !promptId) {
          // session/new 成功
          const newSid = m.result.sessionId;
          log(`${C.G("●")} 新 Session: ${newSid}`);
          promptId = send("session/prompt", {
            sessionId: newSid,
            prompt: [{ type: "text", text: buildPrompt() }],
          });
        } else if (m.id === promptId && m.result !== undefined) {
          log(`${C.G("●")} Prompt 完成`);
          setTimeout(finish, 500);
        } else if (m.id === promptId && m.error) {
          log(C.R(`Prompt 失败: ${m.error.message}`));
          finish();
        }
      }
    };
  });
}

run().catch((e) => { log(C.R(`错误: ${e.message}`)); process.exit(1); });
