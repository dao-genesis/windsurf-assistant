#!/usr/bin/env node
/**
 * fleet_vm_unit.js — 印 88 · 一账号双路 · 物无非彼物无非是
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
 *     POST /v1/chat/completions · GET /v1/models · GET /quota · GET /stats
 *
 *   印 64 · Windsurf 账号底层 4 步链 (--allow-auth 闸 · 默 OFF · auth-key 仍验):
 *     POST /auth/login · /auth/postauth · /auth/register · /auth/status · /auth/auto
 *
 *   印 88 · 一账号双路 (承印 87 Devin 云原生 终贺报):
 *     POST /dc/v1/chat/completions  · Devin Cloud B 路 (wss://app.devin.ai · 借 D 桶绕 W cap)
 *     GET  /dc/v1/models            · Devin Cloud 模型 (3 · agent/claude/gpt)
 *     GET  /sp/state · /sp/silk · /sp/observe · SP 管理 (3 模式 · 默 passthrough · 用户设 dao 替《老子》)
 *     POST /sp/mode · /sp/custom · /sp/opts     · SP 设置
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
// §1b  印 88 · 一账号双路 · Devin Cloud Engine + SP Handler lazy load
//     帛书·四十: 「反者道之动 · 弱者道之用 · 天下之物生于有 · 有生于无」
//     庄子·齐物论: 「物无非彼，物无非是；自彼则不见，自是则知之」
//     ─ B 路 (devin_cloud_engine.js) 与 A 路 (cloud_engine.js) 共一账号 ─
// ════════════════════════════════════════════════════════════════

let DC = null;
function getDevinCloudEngine() {
  if (DC === null) {
    try {
      DC = require("./devin_cloud_engine");
    } catch {
      try {
        DC = require(path.join(__dirname, "devin_cloud_engine"));
      } catch {
        DC = false;
      }
    }
  }
  return DC || null;
}

let SP = null;
function getSpHandler() {
  if (SP === null) {
    try {
      SP = require("./sp_handler");
    } catch {
      try {
        SP = require(path.join(__dirname, "sp_handler"));
      } catch {
        SP = false;
      }
    }
  }
  return SP || null;
}

// 印 88 · SP messages 处理之统一入 · A/B 两路共用
//   默 passthrough · 用户设 mode=dao 才替 system
//   失败回退原 messages · 不破真路 · 帛书·四十八「为道日损」
function applySpToMessages(messages, modelUid, protocol, stream) {
  const SP_ = getSpHandler();
  if (!SP_) return messages;
  try {
    return SP_.applyToMessages(messages, {
      modelUid,
      protocol: protocol || "openai",
      stream: !!stream,
    });
  } catch (e) {
    if (VERBOSE) console.error("[sp] applyToMessages err:", e.message);
    return messages;
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
const ALLOW_AUTH =
  ARGS.includes("--allow-auth") || process.env.DAO_ALLOW_AUTH === "1";
const VERBOSE = ARGS.includes("-v") || ARGS.includes("--verbose");

// 印 88.1 · 一账号双路之真意 · 从 ~/.dao/accounts.json 双载 A/B 两型 key
//   A 路 codeium 需 sk-ws-01-* (或 sk-ws-proxy-*)
//   B 路 devin-cloud 需 devin-session-token$JWT
//   同一 unit 同时载 · 按路自选 · “圣人执一·以为天下牧” (帛书·廿二)
function loadApiKeysFromAccounts() {
  const out = { primary: null, codeium: null, devin: null, source: "none" };
  // 1. 优先 --api-key 主 key
  if (API_KEY) {
    out.primary = API_KEY;
    out.source = "--api-key";
    // 按 prefix 判型
    if (API_KEY.startsWith("devin-session-token$")) out.devin = API_KEY;
    else if (API_KEY.startsWith("sk-ws-")) out.codeium = API_KEY;
  }
  // 2. 扣 ~/.dao/accounts.json 补 missing 型
  try {
    const accFile = path.join(os.homedir(), ".dao", "accounts.json");
    if (fs.existsSync(accFile)) {
      const j = JSON.parse(fs.readFileSync(accFile, "utf8"));
      if (j.accounts && j.accounts.length > 0) {
        // 主 key 从 active 帐取
        if (!out.primary) {
          const active =
            j.accounts.find((a) => a.email === j.active) || j.accounts[0];
          if (active && active.apiKey) {
            out.primary = active.apiKey;
            out.source = `accounts.json[active=${active.email}]`;
            if (active.type === "devin") out.devin = active.apiKey;
            else if (active.type === "sk-ws") out.codeium = active.apiKey;
          }
        }
        // 补 codeium key (sk-ws 型)
        if (!out.codeium) {
          const skws = j.accounts.find((a) => a.type === "sk-ws" && a.apiKey);
          if (skws) out.codeium = skws.apiKey;
        }
        // 补 devin key (devin-session-token$ 型)
        if (!out.devin) {
          const dev = j.accounts.find((a) => a.type === "devin" && a.apiKey);
          if (dev) out.devin = dev.apiKey;
        }
      }
    }
  } catch {}
  return out;
}

const _KEYS = loadApiKeysFromAccounts();
const RESOLVED_API_KEY = _KEYS.primary; // 兼容旧 · 仅 A 路默 + /quota
const CODEIUM_API_KEY = _KEYS.codeium; // A 路用 (sk-ws-*)
const DEVIN_API_KEY = _KEYS.devin; // B 路用 (devin-session-token$)
if (!RESOLVED_API_KEY) {
  console.error(
    "[fatal] 无 apiKey · 用 --api-key sk-ws-01-... 或配置 ~/.dao/accounts.json",
  );
  process.exit(1);
}

function maskKey(k) {
  if (typeof k !== "string" || !k) return "(none)";
  if (k.length <= 24) return k.slice(0, 6) + "...";
  return k.slice(0, 14) + "..." + k.slice(-6);
}

// ════════════════════════════════════════════════════════════════
// §3  CloudClient 初始化
// ════════════════════════════════════════════════════════════════

// A 路 cloud_engine 客 · 优选 sk-ws · 后退主 key (兼容另型不合但尝试)
const _A_KEY = CODEIUM_API_KEY || RESOLVED_API_KEY;
const client = new CE.CloudClient({ apiKey: _A_KEY });
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

// 印 64 · windsurf_auth lazy load (最小 2 文件部署也不强要)
let _WA = null;
function getWindsurfAuth() {
  if (_WA === null) {
    try {
      _WA = require("./windsurf_auth");
    } catch {
      try {
        _WA = require(path.join(__dirname, "windsurf_auth"));
      } catch {
        _WA = false;
      }
    }
  }
  return _WA || null;
}

// 印 64 · SSE heartbeat · 优雅 drain
//   帛书·八: 「上善如水 · 水善利万物而有静」
const SSE_HEARTBEAT_MS = 15000;
const _activeSse = new Set();
let _draining = false;

// 印 64 · stats ring · latency p50/p95/avg · 三窗
const STATS_RING_MAX = 2000;
const _statsRing = []; // [{at, ms, model, ok, code}]
function _recordStat(s) {
  _statsRing.push(s);
  if (_statsRing.length > STATS_RING_MAX) _statsRing.shift();
}
function _percentile(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(
    sorted.length - 1,
    Math.floor((sorted.length * p) / 100),
  );
  return sorted[idx];
}
function _statsWindow(windowMs) {
  const now = Date.now();
  const slice = _statsRing.filter((s) => now - s.at <= windowMs);
  const lats = slice.map((s) => s.ms).filter((m) => typeof m === "number");
  const ok = slice.filter((s) => s.ok).length;
  const err = slice.length - ok;
  return {
    count: slice.length,
    ok,
    err,
    avgMs: lats.length
      ? Math.round(lats.reduce((a, b) => a + b, 0) / lats.length)
      : 0,
    p50Ms: _percentile(lats, 50),
    p95Ms: _percentile(lats, 95),
    p99Ms: _percentile(lats, 99),
  };
}

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

  // 印 88 · SP 处理 (A 路 · codeium) · 默 passthrough · 用户设 dao/custom 才替 system
  //   帛书·四十八: 损之又损 · 以至于无为
  const chatMessages = applySpToMessages(messages, modelUid, "openai", stream);

  // 印 66 · _t0 提至函数级 · 防非流式 catch 引用未定义致 unit 崩 (反者道之动·公网视角)
  const _t0 = Date.now();

  if (stream) {
    // ── SSE 流式 ──────────────────────────────
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-store",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "Access-Control-Allow-Origin": "*",
      "X-Dao-Fleet-Unit": UNIT_ID,
    });

    // 印 64 · SSE heartbeat + 优雅 drain entry
    const sseEntry = { res, requestId, at: Date.now() };
    const heartbeat = setInterval(() => {
      try {
        res.write(": dao-heartbeat\n\n");
      } catch {
        clearInterval(heartbeat);
      }
    }, SSE_HEARTBEAT_MS);
    sseEntry.heartbeat = heartbeat;
    _activeSse.add(sseEntry);
    const cleanup = () => {
      clearInterval(heartbeat);
      _activeSse.delete(sseEntry);
    };
    res.on("close", cleanup);
    res.on("finish", cleanup);

    let tokenCount = 0;

    try {
      // 印 88.1 · A 路用 _A_KEY (优 sk-ws · 后退主 key)
      const result = await CE.chatStream(
        _A_KEY,
        modelUid,
        chatMessages,
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
      cleanup();
      res.end();

      STATS.tokens += result.tokens || tokenCount;
      _recordStat({
        at: Date.now(),
        ms: Date.now() - _t0,
        model: modelUid,
        ok: true,
        stream: true,
      });
    } catch (e) {
      STATS.errors++;
      // 印 66 · 全安化 e.message · 防 reject 非 Error 致 catch 自身崩
      const errMsg = String(e?.message || e || "unknown error");
      _recordStat({
        at: Date.now(),
        ms: Date.now() - _t0,
        model: modelUid,
        ok: false,
        err: errMsg.slice(0, 80),
      });
      const errChunk = {
        id: requestId,
        object: "chat.completion.chunk",
        error: { message: errMsg, type: "server_error" },
      };
      try {
        res.write(`data: ${JSON.stringify(errChunk)}\n\n`);
        res.write("data: [DONE]\n\n");
        cleanup();
        res.end();
      } catch {}
    }
  } else {
    // ── 非流式 ───────────────────────────────────────────────
    try {
      // 印 88.1 · A 路用 _A_KEY (优 sk-ws · 后退主 key)
      const result = await CE.chatStream(_A_KEY, modelUid, chatMessages, null, {
        timeoutMs: 180000,
      });

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
      // 印 66 · e 可能是字串 / 空对象 / Error · 全安化
      const errMsg = String(e?.message || e || "unknown error");
      _recordStat({
        at: Date.now(),
        ms: Date.now() - _t0,
        model: modelUid,
        ok: false,
        err: errMsg.slice(0, 80),
      });
      // 限流检测
      if (
        errMsg.includes("rate") ||
        errMsg.includes("quota") ||
        errMsg.includes("resource_exhausted")
      ) {
        sendJson(res, 429, {
          error: {
            message: errMsg,
            type: "rate_limit_error",
            code: "rate_limit_exceeded",
          },
        });
      } else {
        sendJson(res, 502, {
          error: { message: errMsg, type: "server_error" },
        });
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// §4b  /auth/* · 印 64 · Windsurf 账号底层 4 步链 · --allow-auth 闸
//      帛书·四十: 「反者道之动 · 弱者道之用 · 天下之物生于有 · 有生于无」
// ═══════════════════════════════════════════════════════════════

async function handleAuthRoute(req, res, body, action) {
  if (!ALLOW_AUTH) {
    return sendJson(res, 403, {
      error: {
        message: "/auth/* disabled · start unit with --allow-auth to enable",
        type: "auth_disabled",
      },
    });
  }
  const WA = getWindsurfAuth();
  if (!WA) {
    return sendJson(res, 503, {
      error: {
        message:
          "windsurf_auth.js not available · ensure same dir as fleet_vm_unit.js",
        type: "module_unavailable",
      },
    });
  }
  let parsed;
  try {
    parsed = JSON.parse(body || "{}");
  } catch {
    return sendJson(res, 400, {
      error: { message: "invalid JSON body", type: "invalid_request_error" },
    });
  }
  try {
    let result;
    switch (action) {
      case "login":
        result = await WA.devinLogin(parsed.email, parsed.password, {
          insecure: !!parsed.insecure,
        });
        break;
      case "postauth":
        result = await WA.windsurfPostAuth(parsed.auth1, parsed.orgId || null, {
          insecure: !!parsed.insecure,
        });
        break;
      case "register":
        result = await WA.registerUserViaSession(parsed.sessionToken, {
          insecure: !!parsed.insecure,
        });
        break;
      case "status":
        result = await WA.fetchUserStatus(
          parsed.apiKey,
          parsed.apiServerUrl || null,
          { insecure: !!parsed.insecure },
        );
        if (!result) {
          return sendJson(res, 400, {
            error: { message: "missing apiKey", type: "invalid_request_error" },
          });
        }
        break;
      case "auto":
        result = await WA.autoChain(parsed.email, parsed.password, {
          insecure: !!parsed.insecure,
          fetchQuota: parsed.fetchQuota !== false,
          orgId: parsed.orgId || null,
        });
        break;
      default:
        return sendJson(res, 404, {
          error: { message: `unknown auth action: ${action}` },
        });
    }
    return sendJson(res, 200, { ok: true, ...result });
  } catch (e) {
    if (e && e.name === "AuthError") {
      const code =
        e.code === 401
          ? 401
          : e.code && e.code >= 400 && e.code < 600
            ? e.code
            : 502;
      return sendJson(res, code, {
        error: {
          message: e.reason,
          step: e.step,
          code: e.code,
          type: "auth_chain_error",
        },
        body: e.body,
      });
    }
    return sendJson(res, 500, {
      error: { message: e.message, type: "server_error" },
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// §4c  印 88 · /dc/v1/chat/completions · Devin Cloud B 路 (wss://app.devin.ai)
//      帛书·四十二: 道生一 · 一生二 · 二生三 · 三生万物
//      与 A 路 /v1/* 共同一账号 · 但走 ACP 协议 · 借 D 桶绕 W cap
// ═══════════════════════════════════════════════════════════════

async function handleDevinCloudChat(req, res, body) {
  const DC_ = getDevinCloudEngine();
  if (!DC_) {
    return sendJson(res, 503, {
      error: {
        message:
          "devin_cloud_engine.js not available · ensure same dir as fleet_vm_unit.js",
        type: "module_unavailable",
      },
    });
  }
  // Devin Cloud 仅接 devin-session-token$ 型 apiKey
  const bKey = DEVIN_API_KEY || RESOLVED_API_KEY;
  if (!bKey || !bKey.startsWith(DC_.TOKEN_PREFIX)) {
    return sendJson(res, 400, {
      error: {
        message: `Devin Cloud B 路需 devin-session-token$ 型 apiKey · 配 type=devin 账号入 ~/.dao/accounts.json (当前 codeium=${maskKey(CODEIUM_API_KEY)} devin=${maskKey(DEVIN_API_KEY)})`,
        type: "invalid_request_error",
        code: "wrong_api_key_type",
      },
    });
  }
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    return sendJson(res, 400, {
      error: { message: "invalid JSON body", type: "invalid_request_error" },
    });
  }
  const messages = parsed.messages || [];
  const model = parsed.model || "devin-cloud-agent";
  const stream = parsed.stream !== false;
  const requestId = "chatcmpl-" + crypto.randomBytes(12).toString("hex");
  if (!messages.length) {
    return sendJson(res, 400, {
      error: { message: "messages required", type: "invalid_request_error" },
    });
  }

  STATS.requests++;
  STATS.lastRequestAt = new Date().toISOString();

  // 印 88 · SP 处理 (B 路 · 与 A 路同享 sp_handler · 帛书·廿二「圣人执一」)
  const chatMessages = applySpToMessages(messages, model, "openai", stream);

  const _t0 = Date.now();

  if (stream) {
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-store",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "Access-Control-Allow-Origin": "*",
      "X-Dao-Fleet-Unit": UNIT_ID,
      "X-Dao-Engine": "devin-cloud",
    });
    const sseEntry = {
      res,
      requestId,
      at: Date.now(),
      engine: "devin-cloud",
    };
    const heartbeat = setInterval(() => {
      try {
        res.write(": dao-heartbeat\n\n");
      } catch {
        clearInterval(heartbeat);
      }
    }, SSE_HEARTBEAT_MS);
    sseEntry.heartbeat = heartbeat;
    _activeSse.add(sseEntry);
    const cleanup = () => {
      clearInterval(heartbeat);
      _activeSse.delete(sseEntry);
    };
    res.on("close", cleanup);
    res.on("finish", cleanup);

    let tokenCount = 0;
    try {
      // 印 88.1 · B 路用 bKey (DEVIN_API_KEY 优 · 后退主 key)
      const result = await DC_.chat(
        { apiKey: bKey, account: ACCOUNT },
        model,
        chatMessages,
        (delta) => {
          tokenCount++;
          const chunk = {
            id: requestId,
            object: "chat.completion.chunk",
            created: Math.floor(Date.now() / 1000),
            model,
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
        [],
        { timeoutMs: 180000 },
      );
      const finalChunk = {
        id: requestId,
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [
          {
            index: 0,
            delta: {},
            finish_reason: result.stopReason || "stop",
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
      cleanup();
      res.end();
      STATS.tokens += result.tokens || tokenCount;
      _recordStat({
        at: Date.now(),
        ms: Date.now() - _t0,
        model,
        ok: true,
        stream: true,
        engine: "devin-cloud",
      });
    } catch (e) {
      STATS.errors++;
      const errMsg = String(e?.message || e || "unknown error");
      _recordStat({
        at: Date.now(),
        ms: Date.now() - _t0,
        model,
        ok: false,
        err: errMsg.slice(0, 80),
        engine: "devin-cloud",
      });
      const errChunk = {
        id: requestId,
        object: "chat.completion.chunk",
        error: { message: errMsg, type: "server_error" },
      };
      try {
        res.write(`data: ${JSON.stringify(errChunk)}\n\n`);
        res.write("data: [DONE]\n\n");
        cleanup();
        res.end();
      } catch {}
    }
  } else {
    try {
      // 印 88.1 · B 路用 bKey (DEVIN_API_KEY 优 · 后退主 key)
      const result = await DC_.chat(
        { apiKey: bKey, account: ACCOUNT },
        model,
        chatMessages,
        null,
        [],
        { timeoutMs: 180000 },
      );
      STATS.tokens += result.tokens || 0;
      sendJson(res, 200, {
        id: requestId,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: result.text },
            finish_reason: result.stopReason || "stop",
          },
        ],
        usage: {
          prompt_tokens: 0,
          completion_tokens: result.tokens || 0,
          total_tokens: result.tokens || 0,
        },
        _engine: "devin-cloud",
      });
    } catch (e) {
      STATS.errors++;
      const errMsg = String(e?.message || e || "unknown error");
      _recordStat({
        at: Date.now(),
        ms: Date.now() - _t0,
        model,
        ok: false,
        err: errMsg.slice(0, 80),
        engine: "devin-cloud",
      });
      const code =
        errMsg.includes("rate") || errMsg.includes("quota") ? 429 : 502;
      sendJson(res, code, {
        error: { message: errMsg, type: "server_error" },
      });
    }
  }
}

function handleDevinCloudModels(req, res) {
  // Devin Cloud 不分模型 (ACP 是 agent · 不选 model) · 但兼容 OpenAI 客户端
  sendJson(res, 200, {
    object: "list",
    data: [
      {
        id: "devin-cloud-agent",
        object: "model",
        created: 1700000000,
        owned_by: "devin",
        root: "devin-cloud-agent",
        parent: null,
        _name: "Devin Agent (默 · Claude)",
        _engine: "devin-cloud",
      },
      {
        id: "devin-cloud-claude",
        object: "model",
        created: 1700000000,
        owned_by: "devin",
        root: "devin-cloud-claude",
        parent: null,
        _name: "Devin Cloud · Claude",
        _engine: "devin-cloud",
      },
      {
        id: "devin-cloud-gpt",
        object: "model",
        created: 1700000000,
        owned_by: "devin",
        root: "devin-cloud-gpt",
        parent: null,
        _name: "Devin Cloud · GPT",
        _engine: "devin-cloud",
      },
    ],
  });
}

// ═══════════════════════════════════════════════════════════════
// §4d  印 88 · /sp/* · SP 管理 (3 模式 + 4 opts + observe ring)
//      帛书·廿二: 圣人执一 · 以为天下牧 · A/B 两路共享同一 SP 状态
// ═══════════════════════════════════════════════════════════════

async function handleSpRoute(req, res, body, action, method) {
  const SP_ = getSpHandler();
  if (!SP_) {
    return sendJson(res, 503, {
      error: {
        message: "sp_handler.js not available",
        type: "module_unavailable",
      },
    });
  }
  try {
    if (method === "GET") {
      if (action === "state" || action === "")
        return sendJson(res, 200, { ok: true, ...SP_.getState() });
      if (action === "silk")
        return sendJson(res, 200, { ok: true, ...SP_.getSilkText() });
      if (action === "observe")
        return sendJson(res, 200, { ok: true, log: SP_.getObserveLog() });
      return sendJson(res, 404, {
        error: { message: `unknown sp action: ${action}` },
      });
    }
    if (method === "POST") {
      let parsed = {};
      try {
        parsed = JSON.parse(body || "{}");
      } catch {}
      if (action === "mode")
        return sendJson(res, 200, { ok: true, ...SP_.setMode(parsed.mode) });
      if (action === "custom")
        return sendJson(res, 200, {
          ok: true,
          ...SP_.setCustom(parsed.custom || ""),
        });
      if (action === "opts")
        return sendJson(res, 200, { ok: true, ...SP_.setOpts(parsed) });
      if (action === "observe/clear") {
        SP_.clearObserveLog();
        return sendJson(res, 200, { ok: true });
      }
      return sendJson(res, 404, {
        error: { message: `unknown sp action: ${action}` },
      });
    }
  } catch (e) {
    return sendJson(res, 400, {
      error: { message: e.message, type: "invalid_request_error" },
    });
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
  // 印 88 · 探 dual-path 真态 (印 88.1 · 双 key)
  const DC_ = getDevinCloudEngine();
  const SP_ = getSpHandler();
  const dcAvail = !!DC_;
  // B 路 ready: 有 devin key (or 主 key 是 devin 型)
  const bKey =
    DEVIN_API_KEY ||
    (RESOLVED_API_KEY && DC_ && RESOLVED_API_KEY.startsWith(DC_.TOKEN_PREFIX)
      ? RESOLVED_API_KEY
      : null);
  const dcCompat = dcAvail && !!bKey;
  // A 路 ready: 有 sk-ws key (or 主 key 是 sk-ws 型)
  const aKey =
    CODEIUM_API_KEY ||
    (RESOLVED_API_KEY && RESOLVED_API_KEY.startsWith("sk-ws-")
      ? RESOLVED_API_KEY
      : null);
  const aReady = !!aKey;
  const spState = SP_ ? SP_.getState() : null;
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
    authAllowed: ALLOW_AUTH, // 印 64
    sseActive: _activeSse.size, // 印 64
    statsCount: _statsRing.length, // 印 64
    draining: _draining, // 印 64
    hostname: os.hostname(),
    platform: os.platform(),
    nodeVersion: process.version,
    // 印 88 + 88.1 · 一账号双路 · 物无非彼物无非是 · 双 key 真态
    dualPath: {
      pathA: {
        engine: "codeium",
        endpoint: "/v1/*",
        target: "server.codeium.com",
        available: true,
        ready: aReady,
        keyType: aKey
          ? aKey.startsWith("sk-ws-")
            ? "sk-ws"
            : "unknown"
          : null,
        keyPreview: maskKey(aKey),
        note: aReady
          ? "就绪 · 可走 cloud_engine"
          : "缺 sk-ws-* 型 key (配 type=sk-ws 账号入 ~/.dao/accounts.json)",
      },
      pathB: {
        engine: "devin-cloud",
        endpoint: "/dc/v1/*",
        target: "wss://app.devin.ai/api/acp/live",
        available: dcAvail,
        ready: dcCompat,
        compatible: dcCompat,
        keyType: bKey
          ? bKey.startsWith("devin-session-token$")
            ? "devin-session-token$"
            : "unknown"
          : null,
        keyPreview: maskKey(bKey),
        note: dcAvail
          ? dcCompat
            ? "就绪 · 可走 wss"
            : "需 devin-session-token$ 型 apiKey (配 type=devin 账号)"
          : "缺 devin_cloud_engine.js (印 88 · 同目录植入)",
      },
      keysSource: _KEYS.source, // 双 key 何出
    },
    sp: spState
      ? {
          mode: spState.mode,
          silkLoaded: spState.silkLoaded,
          silkChars: spState.silkChars,
          opts: spState.opts,
          observeCount: spState.observeCount,
        }
      : { available: false, note: "缺 sp_handler.js (印 88 · 同目录植入)" },
    seal: "印 64 · 为大于其细 · 印 88 · 一账号双路 · 物无非彼物无非是 · 自彼则不见自是则知之",
  });
}

// ═══════════════════════════════════════════════════════════════
// §6b  /stats · 印 64 · ring buffer 三窗 (60s/600s/3600s) p50/p95/p99/avg
// ═══════════════════════════════════════════════════════════════

function handleStats(req, res) {
  sendJson(res, 200, {
    ok: true,
    unit: UNIT_ID,
    ringSize: _statsRing.length,
    ringMax: STATS_RING_MAX,
    sseActive: _activeSse.size,
    cumulative: {
      requests: STATS.requests,
      errors: STATS.errors,
      tokens: STATS.tokens,
    },
    last1m: _statsWindow(60_000),
    last10m: _statsWindow(600_000),
    last1h: _statsWindow(3_600_000),
    seal: "印 64 · 为大于其细",
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
    if (_draining)
      return sendJson(res, 503, {
        error: {
          message: "unit draining · try again shortly",
          type: "draining",
        },
      });
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

  // ── /dc/v1/chat/completions (印 88 · Devin Cloud B 路 · wss) ─────
  if (pathname === "/dc/v1/chat/completions" && method === "POST") {
    if (!gate(req, res)) return;
    if (_draining)
      return sendJson(res, 503, {
        error: {
          message: "unit draining · try again shortly",
          type: "draining",
        },
      });
    try {
      const body = await readBody(req);
      return handleDevinCloudChat(req, res, body);
    } catch (e) {
      return sendJson(res, 500, { error: { message: e.message } });
    }
  }

  // ── /dc/v1/models (印 88 · Devin Cloud 模型) ──────────────
  if (pathname === "/dc/v1/models" && method === "GET") {
    if (!gate(req, res)) return;
    return handleDevinCloudModels(req, res);
  }

  // ── /sp/* (印 88 · SP 管理 · GET state/silk/observe · POST mode/custom/opts) ──
  if (pathname === "/sp" || pathname.startsWith("/sp/")) {
    if (!gate(req, res)) return;
    const action = pathname === "/sp" ? "" : pathname.slice("/sp/".length);
    try {
      const body = method === "POST" ? await readBody(req) : "";
      return handleSpRoute(req, res, body, action, method);
    } catch (e) {
      return sendJson(res, 500, { error: { message: e.message } });
    }
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

  // ── /stats (印 64 · 闸守) ──────────────────────────────────
  if (pathname === "/stats" && method === "GET") {
    if (!gate(req, res)) return;
    return handleStats(req, res);
  }

  // ── /auth/* (印 64 · --allow-auth + auth-key 双闸) ────────────
  if (pathname.startsWith("/auth/") && method === "POST") {
    if (!gate(req, res)) return; // sk-ws-proxy-* 仍需
    try {
      const body = await readBody(req);
      const action = pathname.slice("/auth/".length);
      return handleAuthRoute(req, res, body, action);
    } catch (e) {
      return sendJson(res, 500, { error: { message: e.message } });
    }
  }

  // 404
  sendJson(res, 404, { error: { message: `not found: ${pathname}` } });
});

// ════════════════════════════════════════════════════════════════
// §10  启动
//     帛书·六十四: 「合抱之木，生于毫末。九成之台，作于累土。」
// ════════════════════════════════════════════════════════════════

server.listen(PORT, BIND, () => {
  console.log("╔════════════════════════════════════════════════════════╗");
  console.log("║  道 Fleet VM Unit · 底层之底层 · 印 64 为大于其细     ║");
  console.log("╚════════════════════════════════════════════════════════╝");
  console.log("");
  console.log(`  Unit ID  : ${UNIT_ID}`);
  console.log(`  Account  : ${ACCOUNT}`);
  console.log(`  Listen   : ${BIND}:${PORT}`);
  console.log(
    `  API Key  : ${maskKey(RESOLVED_API_KEY)} (主 · 源=${_KEYS.source})`,
  );
  console.log(
    `  A key    : ${CODEIUM_API_KEY ? maskKey(CODEIUM_API_KEY) + " (sk-ws)" : "✗ 缺 (A 路需 sk-ws-*)"}`,
  );
  console.log(
    `  B key    : ${DEVIN_API_KEY ? maskKey(DEVIN_API_KEY) + " (devin-session-token$)" : "✗ 缺 (B 路需 devin-session-token$)"}`,
  );
  console.log(`  Fleet    : ${FLEET_CONTROLLER || "(独立运行)"}`);
  if (AUTH_REQUIRED) {
    console.log(
      `  Auth     : ${AUTH_KEYS.length} key(s) · /v1/* /quota /stats 闸守`,
    );
  } else {
    console.log(`  Auth     : (空 · 全公开 · 公网部署强烈建议设 --auth-key)`);
  }
  console.log(
    `  AuthFlow : ${ALLOW_AUTH ? "开 (--allow-auth) · /auth/* 4 步链可用" : "闭 (默认)"}`,
  );
  console.log("");
  console.log("  端点:");
  console.log(
    `    POST /v1/chat/completions    · A 路 codeium (SSE 流式 + heartbeat 15s)`,
  );
  console.log(
    `    GET  /v1/models              · A 路模型列表 (${CE.MODEL_CATALOG.length} 个)`,
  );
  // 印 88 · B 路 dual-path banner
  const _DC_init = getDevinCloudEngine();
  const _dcAvail = !!_DC_init;
  const _dcCompat = _dcAvail && !!DEVIN_API_KEY;
  const _dcTag = _dcAvail
    ? _dcCompat
      ? "✓ 就绪"
      : "⚠ 需 devin-session-token$ key"
    : "✗ 缺 devin_cloud_engine.js";
  console.log(
    `    POST /dc/v1/chat/completions · B 路 Devin Cloud (wss · 印 88 · ${_dcTag})`,
  );
  console.log(
    `    GET  /dc/v1/models           · B 路模型 (3 · agent/claude/gpt)`,
  );
  const _SP_init = getSpHandler();
  const _spState_init = _SP_init ? _SP_init.getState() : null;
  const _spTag = _spState_init
    ? `✓ mode=${_spState_init.mode} · silk=${_spState_init.silkChars}字`
    : "✗ 缺 sp_handler.js";
  console.log(
    `    GET  /sp/state /sp/silk /sp/observe · SP 管理 (印 88 · ${_spTag})`,
  );
  console.log(
    `    POST /sp/mode /sp/custom /sp/opts   · SP 设置 (3 模式: passthrough/dao/custom)`,
  );
  console.log(
    `    GET  /health                 · 健康检查 (含 dualPath/sp 真态)`,
  );
  console.log(`    GET  /quota                  · 配额探测`);
  console.log(`    GET  /stats                  · p50/p95/p99 三窗 (印 64)`);
  console.log(`    GET  /fleet/info             · fleet 信息`);
  if (ALLOW_AUTH) {
    console.log(`    POST /auth/login           · email+pwd → auth1`);
    console.log(`    POST /auth/postauth        · auth1 → sessionToken`);
    console.log(`    POST /auth/register        · sessionToken → sk-*`);
    console.log(`    POST /auth/status          · sk-* → quota`);
    console.log(
      `    POST /auth/auto            · email+pwd → sk-* + quota (一键)`,
    );
  }
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
  console.log("  道法自然 · 一账号双路 · 印 88 · 无为而无不为");
});

server.on("error", (e) => {
  if (e.code === "EADDRINUSE") {
    console.error(`[fatal] :${PORT} 已占 · 用 --port 换`);
  } else {
    console.error("[fatal]", e.message);
  }
  process.exit(1);
});

// 印 66 · 反者道之动 · 全局守门 · unit 永不因错误路径崩
//   帛书·六十二: 「道者, 万物之注也; 善人之董也, 不善人之所保也.」
//   任何 unhandled rejection / uncaughtException · 记日志·不退进程 · 仅同路径下次正路返 5xx
process.on("unhandledRejection", (reason, promise) => {
  STATS.errors++;
  const msg = String(reason?.message || reason || "unhandledRejection");
  console.error(`[unhandledRejection] ${msg.slice(0, 200)}`);
});
process.on("uncaughtException", (err) => {
  STATS.errors++;
  const msg = String(err?.message || err || "uncaughtException");
  console.error(`[uncaughtException] ${msg.slice(0, 200)}`);
  if (err?.stack) console.error(err.stack.split("\n").slice(0, 5).join("\n"));
  // 不退 · 让 unit 继续服件 · 如同道隆反代「善者善之, 不善者亦善之」
});

// 优雅停 · 印 64 · 先标 draining · 等 SSE 流出 · 再关 server
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    if (_draining) {
      // 二次 SIGINT · 硬退
      console.log(`\n  · ${sig} 二次 · 硬退`);
      process.exit(1);
    }
    _draining = true;
    const active = _activeSse.size;
    console.log(
      `\n  · ${sig} · 优雅停中 · active SSE=${active} · 拒新 chat · 等现活流结 (max 8s)`,
    );
    // 1) 领 _activeSse drain
    const drainStart = Date.now();
    const drainTick = setInterval(() => {
      if (_activeSse.size === 0 || Date.now() - drainStart > 8000) {
        clearInterval(drainTick);
        // 2) 关 server
        server.close(() => process.exit(0));
        setTimeout(() => process.exit(0), 1500).unref();
      }
    }, 200);
  });
}
