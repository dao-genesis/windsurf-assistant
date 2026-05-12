#!/usr/bin/env node
/**
 * fleet_vm_unit.js — 印 62 · 底层之底层 · 一账号一虚拟机一反代
 * ════════════════════════════════════════════════════════════════════════
 *
 *   帛书·四十二: 「道生一，一生二，二生三，三生万物。」
 *   帛书·四十三: 「天下之至柔，驰骋于天下之致坚；无有入于无间。」
 *   庄子·齐物论: 「物无非彼，物无非是；自彼则不见，自是则知之。」
 *
 *   底层直连:
 *     本文件 = 一个完整的云反代微服务
 *     直接使用 Connect-RPC over HTTPS 与 Windsurf 云端通信
 *     暴露 OpenAI 兼容 /v1/chat/completions (SSE 流式)
 *     自注册到 Fleet 控制器 · 自心跳 · 自健康
 *
 *   部署:
 *     1. 完整仓库内: node fleet_vm_unit.js --port 7862
 *        (自动 require cloud_engine.js)
 *     2. 最小部署:   复制 cloud_engine.js + fleet_vm_unit.js 到 VM
 *        node fleet_vm_unit.js --api-key sk-ws-01-xxx --port 7862
 *     3. Devin VM:   由 fleet spawn-config 生成的脚本自动部署
 *
 *   环境变量:
 *     DAO_FLEET_API_KEY       · Windsurf apiKey (sk-ws-01-...)
 *     DAO_FLEET_ACCOUNT       · 账号 email (标识)
 *     DAO_FLEET_UNIT_ID       · unit ID (fleet 控制器分配)
 *     DAO_FLEET_SECRET        · fleet 注册 secret
 *     DAO_FLEET_CONTROLLER    · fleet 控制器 URL (含 /fleet/register)
 *     DAO_FLEET_PORT          · 监听端口 (默 7862)
 *     DAO_AUTH_KEY            · 反代守门 sk-* (单 key 或逗号分隔多 key)
 *                               设则 /v1/* /quota 强验 Authorization: Bearer
 *                               未设则全公开 (本地开发兼容)
 *
 *   公开端点 (无需 auth · 探活/识别用):
 *     GET /health · GET /fleet/info
 *
 *   闸口端点 (有 auth-key 时需 Authorization: Bearer):
 *     POST /v1/chat/completions · GET /v1/models · GET /quota
 *
 *   零外部依赖 · 仅 Node.js 内置 (http, https, crypto, fs, path, os, dns)
 */
"use strict";

const http = require("http");
const https = require("https");
const crypto = require("crypto");
const os = require("os");
const fs = require("fs");
const path = require("path");

// ════════════════════════════════════════════════════════════════
// §1  Cloud Engine · 底层协议加载
//     优先 require('./cloud_engine') (完整仓库)
//     失败则 require 同目录 (最小部署)
// ════════════════════════════════════════════════════════════════

let CE = null;
try {
  CE = require("./cloud_engine");
} catch {
  try {
    CE = require(path.join(__dirname, "cloud_engine"));
  } catch {
    console.error("[fatal] cloud_engine.js 不可加载 · 需与本文件同目录");
    console.error(
      "  最小部署: 复制 cloud_engine.js + fleet_vm_unit.js 到同目录",
    );
    process.exit(1);
  }
}

// ════════════════════════════════════════════════════════════════
// §2  参数解析
// ════════════════════════════════════════════════════════════════

const ARGS = process.argv.slice(2);
const argVal = (n) => {
  const i = ARGS.indexOf(n);
  return i >= 0 && i + 1 < ARGS.length ? ARGS[i + 1] : null;
};

const PORT = parseInt(
  argVal("--port") || process.env.DAO_FLEET_PORT || "7862",
  10,
);
const BIND =
  argVal("--bind") || (ARGS.includes("--public") ? "0.0.0.0" : "127.0.0.1");
const API_KEY = argVal("--api-key") || process.env.DAO_FLEET_API_KEY || null;
const ACCOUNT =
  argVal("--account") || process.env.DAO_FLEET_ACCOUNT || "unit@fleet.local";
const UNIT_ID =
  argVal("--unit-id") ||
  process.env.DAO_FLEET_UNIT_ID ||
  "unit-" +
    crypto
      .createHash("sha256")
      .update(ACCOUNT + Date.now())
      .digest("hex")
      .slice(0, 16);
const FLEET_SECRET =
  argVal("--fleet-secret") || process.env.DAO_FLEET_SECRET || null;
const FLEET_CONTROLLER =
  argVal("--fleet-controller") || process.env.DAO_FLEET_CONTROLLER || null;
const AUTH_KEY_RAW = argVal("--auth-key") || process.env.DAO_AUTH_KEY || "";
const AUTH_KEYS = AUTH_KEY_RAW.split(/[,\s]+/)
  .map((k) => k.trim())
  .filter(Boolean);
const AUTH_REQUIRED = AUTH_KEYS.length > 0;
const VERBOSE = ARGS.includes("-v") || ARGS.includes("--verbose");

// 从 ~/.dao/accounts.json 读取 (若无 --api-key)
function loadApiKeyFromAccounts() {
  if (API_KEY) return API_KEY;
  try {
    const accFile = path.join(os.homedir(), ".dao", "accounts.json");
    if (fs.existsSync(accFile)) {
      const j = JSON.parse(fs.readFileSync(accFile, "utf8"));
      if (j.accounts && j.accounts.length > 0) {
        const active =
          j.accounts.find((a) => a.email === j.active) || j.accounts[0];
        if (active && active.apiKey) return active.apiKey;
      }
    }
  } catch {}
  return null;
}

const RESOLVED_API_KEY = loadApiKeyFromAccounts();
if (!RESOLVED_API_KEY) {
  console.error(
    "[fatal] 无 apiKey · 用 --api-key sk-ws-01-... 或配置 ~/.dao/accounts.json",
  );
  process.exit(1);
}

// ════════════════════════════════════════════════════════════════
// §3  CloudClient 初始化
// ════════════════════════════════════════════════════════════════

const client = new CE.CloudClient({ apiKey: RESOLVED_API_KEY });
client.authenticated = true; // apiKey 直传 · 已认证

// 运行时统计
const STATS = {
  startedAt: new Date().toISOString(),
  requests: 0,
  errors: 0,
  tokens: 0,
  lastRequestAt: null,
  dPercent: -1,
  wPercent: -1,
  lastProbeAt: null,
};

// ════════════════════════════════════════════════════════════════
// §4  OpenAI 兼容 API · /v1/chat/completions
//     帛书·廿八: 「朴散则为器 · 圣人用则为官长 · 大制无割」
//     Connect-RPC protobuf ↔ OpenAI JSON SSE · 无缝转译
// ════════════════════════════════════════════════════════════════

/**
 * 处理 /v1/chat/completions 请求
 * 支持: stream=true (SSE) / stream=false (JSON)
 */
async function handleChatCompletions(req, res, body) {
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    return sendJson(res, 400, {
      error: { message: "invalid JSON body", type: "invalid_request_error" },
    });
  }

  const messages = parsed.messages || [];
  const model = parsed.model || "default";
  const stream = parsed.stream !== false;
  const requestId = "chatcmpl-" + crypto.randomBytes(12).toString("hex");

  if (!messages.length) {
    return sendJson(res, 400, {
      error: { message: "messages required", type: "invalid_request_error" },
    });
  }

  STATS.requests++;
  STATS.lastRequestAt = new Date().toISOString();

  const modelUid = CE.resolveModel(model);

  if (stream) {
    // ── SSE 流式 ─────────────────────────────────────────────
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-store",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "X-Dao-Fleet-Unit": UNIT_ID,
    });

    let tokenCount = 0;

    try {
      const result = await CE.chatStream(
        RESOLVED_API_KEY,
        modelUid,
        messages,
        (delta) => {
          tokenCount++;
          const chunk = {
            id: requestId,
            object: "chat.completion.chunk",
            created: Math.floor(Date.now() / 1000),
            model: modelUid,
            choices: [
              {
                index: 0,
                delta: { content: delta },
                finish_reason: null,
              },
            ],
          };
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        },
        { timeoutMs: 180000 },
      );

      // Final chunk
      const finalChunk = {
        id: requestId,
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: modelUid,
        choices: [
          {
            index: 0,
            delta: {},
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 0,
          completion_tokens: result.tokens || tokenCount,
          total_tokens: result.tokens || tokenCount,
        },
      };
      res.write(`data: ${JSON.stringify(finalChunk)}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();

      STATS.tokens += result.tokens || tokenCount;
    } catch (e) {
      STATS.errors++;
      const errChunk = {
        id: requestId,
        object: "chat.completion.chunk",
        error: { message: e.message, type: "server_error" },
      };
      try {
        res.write(`data: ${JSON.stringify(errChunk)}\n\n`);
        res.write("data: [DONE]\n\n");
        res.end();
      } catch {}
    }
  } else {
    // ── 非流式 ───────────────────────────────────────────────
    try {
      const result = await CE.chatStream(
        RESOLVED_API_KEY,
        modelUid,
        messages,
        null,
        {
          timeoutMs: 180000,
        },
      );

      STATS.tokens += result.tokens || 0;

      sendJson(res, 200, {
        id: requestId,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: modelUid,
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: result.text },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 0,
          completion_tokens: result.tokens || 0,
          total_tokens: result.tokens || 0,
        },
      });
    } catch (e) {
      STATS.errors++;
      // 限流检测
      if (
        e.message.includes("rate") ||
        e.message.includes("quota") ||
        e.message.includes("resource_exhausted")
      ) {
        sendJson(res, 429, {
          error: {
            message: e.message,
            type: "rate_limit_error",
            code: "rate_limit_exceeded",
          },
        });
      } else {
        sendJson(res, 502, {
          error: { message: e.message, type: "server_error" },
        });
      }
    }
  }
}

// ════════════════════════════════════════════════════════════════
// §5  /v1/models · 模型列表
// ════════════════════════════════════════════════════════════════

function handleModels(req, res) {
  const models = CE.MODEL_CATALOG.map((m) => ({
    id: m.uid,
    object: "model",
    created: 1700000000,
    owned_by: "windsurf",
    permission: [],
    root: m.uid,
    parent: null,
    // 扩展字段
    _name: m.name,
    _cost: m.cost,
    _context: m.ctx,
    _tier: m.tier,
  }));
  sendJson(res, 200, { object: "list", data: models });
}

// ════════════════════════════════════════════════════════════════
// §6  /health · 健康检查
// ════════════════════════════════════════════════════════════════

function handleHealth(req, res) {
  sendJson(res, 200, {
    ok: true,
    unit: UNIT_ID,
    account: ACCOUNT,
    port: PORT,
    uptime: process.uptime(),
    stats: STATS,
    apiKeyPreview: RESOLVED_API_KEY
      ? RESOLVED_API_KEY.slice(0, 14) + "..." + RESOLVED_API_KEY.slice(-6)
      : "(none)",
    authRequired: AUTH_REQUIRED,
    authKeysCount: AUTH_KEYS.length,
    hostname: os.hostname(),
    platform: os.platform(),
    nodeVersion: process.version,
    seal: "印 63 · 守门有度",
  });
}

// ════════════════════════════════════════════════════════════════
// §7  HTTP 工具
// ════════════════════════════════════════════════════════════════

function sendJson(res, code, obj) {
  const buf = Buffer.from(JSON.stringify(obj));
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": buf.length,
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store",
    "X-Dao-Fleet-Unit": UNIT_ID,
  });
  res.end(buf);
}

function readBody(req, max = 4 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > max) return reject(new Error("body too large"));
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

// ── Authorization 验 · 帛书·五十二: 「塞其闷, 闭其门, 终身不堇」 ──
// 抽 Authorization: Bearer xxx · X-Api-Key: xxx · ?api_key=xxx 三式
function extractBearer(req) {
  const h = req.headers || {};
  const auth = h.authorization || h.Authorization || "";
  const m = /^Bearer\s+(\S+)/i.exec(auth);
  if (m) return m[1].trim();
  const xkey = h["x-api-key"] || h["X-Api-Key"] || "";
  if (xkey) return String(xkey).trim();
  try {
    const u = new URL(req.url, `http://${h.host || "localhost"}`);
    const q = u.searchParams.get("api_key") || u.searchParams.get("key");
    if (q) return String(q).trim();
  } catch {}
  return "";
}

// 守门 · 返 true 则放行 · 返 false 已写 401 调用方 return
function gate(req, res) {
  if (!AUTH_REQUIRED) return true; // 无 key 设 · 全公开
  const got = extractBearer(req);
  if (got && AUTH_KEYS.includes(got)) return true;
  // 时序常量比 · 避旁道
  for (const k of AUTH_KEYS) {
    if (
      got.length === k.length &&
      crypto.timingSafeEqual(Buffer.from(got), Buffer.from(k))
    ) {
      return true;
    }
  }
  sendJson(res, 401, {
    error: {
      message: got ? "invalid api key" : "missing Authorization: Bearer <key>",
      type: "authentication_error",
      code: "invalid_api_key",
    },
  });
  return false;
}

// ════════════════════════════════════════════════════════════════
// §8  Fleet 集成 · 注册 + 心跳
//     帛书·六十三: 「天下之难作于易 · 天下之大作于细」
// ════════════════════════════════════════════════════════════════

let _tunnelUrl = null; // cloudflared 穿透 URL (启动后检测)

/** 检测 cloudflared 穿透 URL */
function detectTunnelUrl() {
  if (_tunnelUrl) return _tunnelUrl;
  // 尝试从 /tmp/tunnel.log 读取
  try {
    const logPaths = ["/tmp/tunnel.log", path.join(os.tmpdir(), "tunnel.log")];
    for (const p of logPaths) {
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, "utf8");
        const m = content.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
        if (m) {
          _tunnelUrl = m[0];
          return _tunnelUrl;
        }
      }
    }
  } catch {}
  // 尝试从环境变量
  if (process.env.TUNNEL_URL) {
    _tunnelUrl = process.env.TUNNEL_URL;
    return _tunnelUrl;
  }
  return null;
}

/** 向 fleet 控制器注册 */
function fleetRegister() {
  if (!FLEET_CONTROLLER) return;
  const tunnelUrl =
    detectTunnelUrl() ||
    `http://${BIND === "0.0.0.0" ? getLocalIp() : "127.0.0.1"}:${PORT}`;

  const payload = JSON.stringify({
    tunnelUrl,
    account: ACCOUNT,
    secret: FLEET_SECRET || undefined,
    vmIp: getLocalIp(),
    region: process.env.AWS_REGION || process.env.CLOUD_REGION || null,
  });

  const url = new URL("/fleet/register", FLEET_CONTROLLER);
  const transport = url.protocol === "https:" ? https : http;

  const req = transport.request(
    {
      hostname: url.hostname,
      port: url.port || (url.protocol === "https:" ? 443 : 80),
      path: url.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
      timeout: 10000,
    },
    (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          if (body.ok) {
            console.log(
              `  ✓ fleet 注册成功 · unit=${body.unit?.id || UNIT_ID}`,
            );
          } else {
            console.error(
              "  ✗ fleet 注册失败:",
              body.error?.message || "unknown",
            );
          }
        } catch {}
      });
    },
  );
  req.on("error", (e) => {
    if (VERBOSE) console.error("  ✗ fleet 注册连接失败:", e.message);
  });
  req.on("timeout", () => req.destroy());
  req.write(payload);
  req.end();
}

/** 向 fleet 控制器发送心跳 */
function fleetHeartbeat() {
  if (!FLEET_CONTROLLER) return;

  const payload = JSON.stringify({
    unitId: UNIT_ID,
    secret: FLEET_SECRET || undefined,
    dPercent: STATS.dPercent,
    wPercent: STATS.wPercent,
  });

  const url = new URL("/fleet/heartbeat", FLEET_CONTROLLER);
  const transport = url.protocol === "https:" ? https : http;

  const req = transport.request(
    {
      hostname: url.hostname,
      port: url.port || (url.protocol === "https:" ? 443 : 80),
      path: url.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
      timeout: 10000,
    },
    (res) => {
      res.resume(); // drain
    },
  );
  req.on("error", () => {});
  req.on("timeout", () => req.destroy());
  req.write(payload);
  req.end();
}

/** 定期探测配额 (自我健康) */
async function probeQuota() {
  try {
    const plan = await CE.getPlanStatus(RESOLVED_API_KEY);
    if (plan && !plan.error) {
      STATS.dPercent = plan.dailyPercent;
      STATS.wPercent = plan.weeklyPercent;
      STATS.lastProbeAt = new Date().toISOString();
    }
  } catch {}
}

function getLocalIp() {
  const ifs = os.networkInterfaces();
  for (const name of Object.keys(ifs)) {
    for (const i of ifs[name] || []) {
      if (i.family === "IPv4" && !i.internal) return i.address;
    }
  }
  return "127.0.0.1";
}

// ════════════════════════════════════════════════════════════════
// §9  HTTP Server
//     帛书·八: 「上善如水 · 水善利万物而有静」
// ════════════════════════════════════════════════════════════════

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = u.pathname;
  const method = req.method || "GET";

  // CORS
  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers":
        "Authorization, Content-Type, X-Api-Key, *",
      "Access-Control-Max-Age": "86400",
    });
    return res.end();
  }

  // ── /v1/chat/completions ──────────────────────────────────
  if (pathname === "/v1/chat/completions" && method === "POST") {
    if (!gate(req, res)) return;
    try {
      const body = await readBody(req);
      return handleChatCompletions(req, res, body);
    } catch (e) {
      return sendJson(res, 500, { error: { message: e.message } });
    }
  }

  // ── /v1/models ────────────────────────────────────────────
  if (pathname === "/v1/models" && method === "GET") {
    if (!gate(req, res)) return;
    return handleModels(req, res);
  }

  // ── /health (公开 · 探活) ─────────────────────────────────
  if (pathname === "/health") {
    return handleHealth(req, res);
  }

  // ── /quota ────────────────────────────────────────────────
  if (pathname === "/quota") {
    if (!gate(req, res)) return;
    try {
      const plan = await CE.getPlanStatus(RESOLVED_API_KEY);
      return sendJson(res, 200, { ok: true, ...plan });
    } catch (e) {
      return sendJson(res, 502, { error: { message: e.message } });
    }
  }

  // ── /fleet/info ───────────────────────────────────────────
  if (pathname === "/fleet/info") {
    return sendJson(res, 200, {
      unitId: UNIT_ID,
      account: ACCOUNT,
      port: PORT,
      tunnelUrl: detectTunnelUrl(),
      fleetController: FLEET_CONTROLLER,
      stats: STATS,
    });
  }

  // 404
  sendJson(res, 404, { error: { message: `not found: ${pathname}` } });
});

// ════════════════════════════════════════════════════════════════
// §10  启动
//     帛书·六十四: 「合抱之木，生于毫末。九成之台，作于累土。」
// ════════════════════════════════════════════════════════════════

server.listen(PORT, BIND, () => {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║  道 Fleet VM Unit · 底层之底层 · 印 62                    ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log("");
  console.log(`  Unit ID  : ${UNIT_ID}`);
  console.log(`  Account  : ${ACCOUNT}`);
  console.log(`  Listen   : ${BIND}:${PORT}`);
  console.log(
    `  API Key  : ${RESOLVED_API_KEY.slice(0, 14)}...${RESOLVED_API_KEY.slice(-6)}`,
  );
  console.log(`  Fleet    : ${FLEET_CONTROLLER || "(独立运行)"}`);
  if (AUTH_REQUIRED) {
    console.log(`  Auth     : ${AUTH_KEYS.length} key(s) · /v1/* /quota 闸守`);
  } else {
    console.log(`  Auth     : (空 · 全公开 · 公网部署强烈建议设 --auth-key)`);
  }
  console.log("");
  console.log("  端点:");
  console.log(`    POST /v1/chat/completions  · OpenAI 兼容 (SSE 流式)`);
  console.log(
    `    GET  /v1/models            · 模型列表 (${CE.MODEL_CATALOG.length} 个)`,
  );
  console.log(`    GET  /health               · 健康检查`);
  console.log(`    GET  /quota                · 配额探测`);
  console.log(`    GET  /fleet/info           · fleet 信息`);
  console.log("");

  // 初始配额探测
  probeQuota().then(() => {
    if (STATS.dPercent >= 0) {
      console.log(`  配额: D=${STATS.dPercent}% W=${STATS.wPercent}%`);
    } else {
      console.log("  配额: 探测中...");
    }
  });

  // Fleet 注册 (延迟 2s · 等 cloudflared 穿透就绪)
  if (FLEET_CONTROLLER) {
    setTimeout(() => {
      console.log(`  · fleet 注册: ${FLEET_CONTROLLER} ...`);
      fleetRegister();
    }, 2000);
  }

  // 心跳循环 (30s)
  setInterval(() => {
    probeQuota();
    fleetHeartbeat();
  }, 30000);

  console.log("  物无非彼 物无非是 · 自彼则不见 自是则知之");
  console.log("  道法自然 · 底层直连 · 无为而无不为");
});

server.on("error", (e) => {
  if (e.code === "EADDRINUSE") {
    console.error(`[fatal] :${PORT} 已占 · 用 --port 换`);
  } else {
    console.error("[fatal]", e.message);
  }
  process.exit(1);
});

// 优雅停
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    console.log(`\n  · ${sig} · 停 unit :${PORT}`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  });
}
