"use strict";
/**
 * windows_tools.js · Windows Agent 原生工具层 · 零依赖
 * ═══════════════════════════════════════════════════════════════
 * 把 Dao-Windows-Agent 桥(bridge/service.py /api/*)的能力做成与官方
 * 服务端工具同格的原生工具定义(JSON Schema draft 2020-12)，由 dao_router
 * 注入上游请求并在代理侧拦截执行(内部重试环)——LSP/Cascade 太上不知有之，
 * 模型原生调用，效果与官方工具一致，非 MCP 层。
 *
 * 启用之门(热生效):
 *   · 经藏 _origin_canon.txt === "windows-agent"，或
 *   · env DAO_WINDOWS_TOOLS=1
 *
 * 桥地址解析: env DAO_WIN_BRIDGE_URL → 127.0.0.1:9930 → 127.0.0.1:9920
 * 隧道地址(输入租约): env DAO_WIN_TUNNEL_URL → 127.0.0.1:4824
 * 鉴权: env DAO_WIN_TOKEN → Authorization: Bearer <token>(不落日志)
 *
 * 道义: 樸散則為器 · 新软件=桥侧薄 profile · 本层零改动即见新动词
 */

const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");

const TOOL_PREFIX = "windows_";
const _BUNDLED_DIR = path.resolve(__dirname, "..", "..", "bundled-origin");
const _CANON_FILE = path.join(_BUNDLED_DIR, "_origin_canon.txt");

// ── 启用之门(热读·500ms 节流) ─────────────────────────────
let _lastGateCheck = 0;
let _gateCached = false;
function enabled() {
  const now = Date.now();
  if (now - _lastGateCheck < 500) return _gateCached;
  _lastGateCheck = now;
  if (process.env.DAO_WINDOWS_TOOLS === "1") {
    _gateCached = true;
    return true;
  }
  try {
    if (fs.existsSync(_CANON_FILE)) {
      _gateCached = fs.readFileSync(_CANON_FILE, "utf8").trim() === "windows-agent";
      return _gateCached;
    }
  } catch {}
  _gateCached = false;
  return false;
}

// ── 桥地址/HTTP ───────────────────────────────────────────
const _PROBE_URLS = ["http://127.0.0.1:9930", "http://127.0.0.1:9920"];
let _resolvedBase = null;
let _resolvedAt = 0;

function _httpJson(method, base, p, body, timeoutMs) {
  return new Promise((resolve, reject) => {
    let u;
    try {
      u = new URL(base.replace(/\/+$/, "") + p);
    } catch (e) {
      return reject(e);
    }
    const mod = u.protocol === "https:" ? https : http;
    const payload = body != null ? JSON.stringify(body) : null;
    const headers = { Accept: "application/json" };
    if (payload) headers["Content-Type"] = "application/json";
    const tok = process.env.DAO_WIN_TOKEN;
    if (tok) headers["Authorization"] = "Bearer " + tok;
    const req = mod.request(
      { method, hostname: u.hostname, port: u.port, path: u.pathname + u.search, headers },
      (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => {
          if (res.statusCode >= 400) {
            return reject(new Error("HTTP " + res.statusCode + ": " + d.slice(0, 300)));
          }
          try {
            resolve(JSON.parse(d || "{}"));
          } catch {
            resolve({ raw: d });
          }
        });
      },
    );
    req.on("error", reject);
    req.setTimeout(timeoutMs || 15000, () => req.destroy(new Error("timeout")));
    if (payload) req.write(payload);
    req.end();
  });
}

async function _base() {
  const envUrl = (process.env.DAO_WIN_BRIDGE_URL || "").trim();
  if (envUrl) return envUrl;
  const now = Date.now();
  if (_resolvedBase && now - _resolvedAt < 60000) return _resolvedBase;
  for (const b of _PROBE_URLS) {
    try {
      await _httpJson("GET", b, "/api/health", null, 1500);
      _resolvedBase = b;
      _resolvedAt = now;
      return b;
    } catch {}
  }
  throw new Error(
    "Windows Agent bridge unreachable (set DAO_WIN_BRIDGE_URL or start bridge on 127.0.0.1:9930/9920)",
  );
}

// 桌面路由隧道(输入租约仲裁面)：与桥不同进程，默认本机 4824。
function _tunnelBase() {
  return (process.env.DAO_WIN_TUNNEL_URL || "http://127.0.0.1:4824").trim();
}

// ── 工具定义(与官方 _serverToolDefs 同格) ──────────────────
const _SCHEMA = "https://json-schema.org/draft/2020-12/schema";

function defs() {
  return [
    {
      name: "windows_list_apps",
      description:
        "List all Windows application profiles registered on the user's Windows machine (via the Windows Agent bridge). Each app exposes verbs that can be invoked. Call this first to discover what software (FreeCAD, KiCad, etc.) and capabilities are available. Do NOT guess verb names.",
      parameters: {
        $schema: _SCHEMA,
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "windows_search_verbs",
      description:
        "Semantic search over all verbs (capabilities) of all registered Windows application profiles. Use natural language, e.g. 'create a sketch in FreeCAD' or 'route a PCB trace'. Returns the best matching app_id/verb pairs to invoke with windows_session_invoke.",
      parameters: {
        $schema: _SCHEMA,
        type: "object",
        properties: {
          query: { type: "string", description: "Natural language capability query" },
          limit: { type: "integer", description: "Max hits to return (default 8)" },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
    {
      name: "windows_describe_app",
      description:
        "Describe one Windows application profile: its verbs, parameters and usage notes. Call after windows_list_apps/windows_search_verbs to learn exact verb signatures before invoking.",
      parameters: {
        $schema: _SCHEMA,
        type: "object",
        properties: {
          app_id: { type: "string", description: "The application profile id" },
        },
        required: ["app_id"],
        additionalProperties: false,
      },
    },
    {
      name: "windows_session_create",
      description:
        "Create a Windows Agent work session (an isolated workdir/context on the user's Windows machine) for subsequent app operations. Returns session_id.",
      parameters: {
        $schema: _SCHEMA,
        type: "object",
        properties: {
          session_id: { type: "string", description: "Optional explicit session id" },
        },
        additionalProperties: false,
      },
    },
    {
      name: "windows_session_open_app",
      description:
        "Open an application inside an existing Windows Agent session. Must be called before invoking verbs of that app in the session.",
      parameters: {
        $schema: _SCHEMA,
        type: "object",
        properties: {
          session_id: { type: "string" },
          app_id: { type: "string" },
        },
        required: ["session_id", "app_id"],
        additionalProperties: false,
      },
    },
    {
      name: "windows_session_invoke",
      description:
        "Invoke one verb of an opened application in a Windows Agent session. This is the primary way to operate Windows software (FreeCAD, KiCad, Explorer, etc.). Every result is visible in the user's IDE desktop panel — the user watches the same live desktop session. If the user takes over input (input lease preempted), stop and wait.",
      parameters: {
        $schema: _SCHEMA,
        type: "object",
        properties: {
          session_id: { type: "string" },
          app_id: { type: "string" },
          verb: { type: "string", description: "Verb name from windows_describe_app / windows_search_verbs" },
          params: { type: "object", description: "Verb parameters" },
        },
        required: ["session_id", "app_id", "verb"],
        additionalProperties: false,
      },
    },
    {
      name: "windows_session_destroy",
      description: "Destroy a Windows Agent session and release its resources.",
      parameters: {
        $schema: _SCHEMA,
        type: "object",
        properties: { session_id: { type: "string" } },
        required: ["session_id"],
        additionalProperties: false,
      },
    },
    {
      name: "windows_clone_plan",
      description:
        "Plan desktop-clone isolation for one application on the user's single Windows account. Different clones = independent RDP-like desktop sessions with independent input queues that never interfere. Honest tiering: packaged (AppX) / GPU-composited / global-mutex apps require at least SESSION tier (HDESK alone cannot isolate them).",
      parameters: {
        $schema: _SCHEMA,
        type: "object",
        properties: {
          app_id: { type: "string" },
          clone_id: { type: "string", description: "Logical clone identity, e.g. 'clone-1'" },
          tiers: {
            type: "array",
            items: { type: "string", enum: ["none", "appdata", "desktop", "session", "account"] },
            description: "Available isolation tiers (default: all)",
          },
          prefer_strongest: { type: "boolean" },
        },
        required: ["app_id", "clone_id"],
        additionalProperties: false,
      },
    },
    {
      name: "windows_input_acquire",
      description:
        "Acquire (or renew) the agent input lease for one desktop clone before operating it. Clone keys look like 'account:<name>#<slot>'. If granted=false the HUMAN currently holds the input — stop operating that clone and wait, the user always preempts you. Re-acquire periodically while operating (lease TTL ~4s).",
      parameters: {
        $schema: _SCHEMA,
        type: "object",
        properties: {
          clone_key: { type: "string", description: "Desktop clone lease key, e.g. 'account:dao#1'" },
          owner: { type: "string", description: "Stable agent owner id, e.g. 'agent:cascade'" },
          ttl_ms: { type: "integer", description: "Lease TTL in ms (default 4000)" },
        },
        required: ["clone_key", "owner"],
        additionalProperties: false,
      },
    },
    {
      name: "windows_input_release",
      description:
        "Release the agent input lease of a desktop clone when done operating it, returning input priority to the user immediately.",
      parameters: {
        $schema: _SCHEMA,
        type: "object",
        properties: {
          clone_key: { type: "string" },
          owner: { type: "string" },
        },
        required: ["clone_key", "owner"],
        additionalProperties: false,
      },
    },
    {
      name: "windows_clone_matrix",
      description:
        "Batch isolation planning for multiple applications at once. Returns per-app minimum viable isolation tier and the plan under the available tiers.",
      parameters: {
        $schema: _SCHEMA,
        type: "object",
        properties: {
          app_ids: { type: "array", items: { type: "string" } },
          tiers: {
            type: "array",
            items: { type: "string", enum: ["none", "appdata", "desktop", "session", "account"] },
          },
          prefer_strongest: { type: "boolean" },
        },
        required: ["app_ids"],
        additionalProperties: false,
      },
    },
  ];
}

const _NAMES = new Set(defs().map((t) => t.name));

function has(name) {
  return _NAMES.has(name);
}

// ── 执行(代理侧·异步·结果回内部重试环) ─────────────────────
async function execute(name, argsJson) {
  let args = {};
  try {
    args = JSON.parse(argsJson || "{}");
  } catch {}
  try {
    const base = name.startsWith("windows_input_") ? null : await _base();
    let out;
    switch (name) {
      case "windows_list_apps":
        out = await _httpJson("GET", base, "/api/apps", null);
        break;
      case "windows_search_verbs":
        out = await _httpJson("POST", base, "/api/search_verbs", {
          query: String(args.query || ""),
          limit: args.limit || 8,
        });
        break;
      case "windows_describe_app":
        out = await _httpJson("POST", base, "/api/describe_app", { app_id: args.app_id });
        break;
      case "windows_session_create":
        out = await _httpJson("POST", base, "/api/session.create", {
          session_id: args.session_id,
        });
        break;
      case "windows_session_open_app":
        out = await _httpJson("POST", base, "/api/session.open_app", {
          session_id: args.session_id,
          app_id: args.app_id,
        });
        break;
      case "windows_session_invoke":
        out = await _httpJson("POST", base, "/api/session.invoke", {
          session_id: args.session_id,
          app_id: args.app_id,
          verb: args.verb,
          params: args.params || {},
        });
        break;
      case "windows_session_destroy":
        out = await _httpJson("POST", base, "/api/session.destroy", {
          session_id: args.session_id,
        });
        break;
      case "windows_clone_plan":
        out = await _httpJson("POST", base, "/api/clone.plan", {
          app_id: args.app_id,
          clone_id: args.clone_id,
          tiers: args.tiers,
          prefer_strongest: !!args.prefer_strongest,
        });
        break;
      case "windows_input_acquire": {
        const q =
          "/input?op=acquire&key=" + encodeURIComponent(String(args.clone_key || "")) +
          "&owner=" + encodeURIComponent(String(args.owner || "agent")) +
          "&kind=agent" + (args.ttl_ms ? "&ttl=" + parseInt(args.ttl_ms, 10) : "");
        out = await _httpJson("POST", _tunnelBase(), q, null, 5000);
        break;
      }
      case "windows_input_release": {
        const q =
          "/input?op=release&key=" + encodeURIComponent(String(args.clone_key || "")) +
          "&owner=" + encodeURIComponent(String(args.owner || "agent"));
        out = await _httpJson("POST", _tunnelBase(), q, null, 5000);
        break;
      }
      case "windows_clone_matrix":
        out = await _httpJson("POST", base, "/api/clone.matrix", {
          app_ids: args.app_ids,
          tiers: args.tiers,
          prefer_strongest: !!args.prefer_strongest,
        });
        break;
      default:
        return JSON.stringify({ error: "Unknown windows tool: " + name, status: "error" });
    }
    return JSON.stringify(out);
  } catch (e) {
    return JSON.stringify({ error: String((e && e.message) || e), status: "error" });
  }
}

module.exports = { TOOL_PREFIX, enabled, defs, has, execute };
