#!/usr/bin/env node
/**
 * meta_router.cjs · 印 122 · 道法自然 · 三池打通 · 多账号并行 (yin122 全审纳入)
 * ════════════════════════════════════════════════════════════════════════
 * 「**反者，道之动也；弱者，道之用也。天下之物生于有，有生于无。**」
 *  ──《老子》四十
 *
 * 「**江海所以能为百谷王者，以其善下之，是以能为百谷王。**」
 *  ──《老子》六十六
 *
 *  此件立于 dao_proxy 之上 · 跑同 VM 之 port 8081
 *  路:
 *    /v1/chat/completions  (OpenAI compat · 三池 fallback 链)
 *    /v1/messages          (Anthropic compat · 三池 fallback 链)
 *    /v1/models            (合 51 件: 16 dao + 35 github)
 *    /github/v1/chat/completions  (强制 GitHub Models BYOK 路 · 不 fallback)
 *    /devin/v1/chat/completions   (强制 dao_proxy 路 · 不 fallback)
 *    /backends/status      (三池 健康状)
 *    /health               (本身健康)
 *
 *  三池:
 *    (1) dao_proxy backend: http://127.0.0.1:7780  (内部 · windsurf+devin · 池 64+59)
 *    (2) GitHub Models BYOK: https://models.github.ai/inference  (35 模型 · 独立 quota)
 *    (3) [reserved] · 后扩 (anthropic / gemini · 主公自配)
 *
 *  fallback 链 (默 /v1/chat/completions 之顺):
 *    dao_proxy (devin) → dao_proxy (windsurf) → github · 任 1 200 即返
 *
 *  auth gate (双护):
 *    · X-Dao-Auth: <META_AUTH_TOKEN>     (本 router 之 auth)
 *    · 外层 Basic auth (omni-router-tunnel 自带)
 *
 *  ENV:
 *    META_PORT          (默 8081)
 *    META_AUTH_TOKEN    (默自动生成 64hex · 保 ~/dao_proxy_meta/.auth)
 *    GITHUB_TOKEN       (GitHub Models BYOK PAT · 主公一字便注)
 *    DAO_PROXY_URL      (默 http://127.0.0.1:7780)
 *    DAO_PROXY_AUTH     (默从 ~/dao_proxy/.auth 读)
 *    META_FALLBACK      (默 "dao,github" · 顺序)
 * ════════════════════════════════════════════════════════════════════════
 */
"use strict";

const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { URL } = require("url");

// ─── 配 ───
const META_PORT = parseInt(process.env.META_PORT || "8081", 10);
const META_DIR =
  process.env.META_DIR || path.join(os.homedir(), "dao_proxy_meta");
const META_AUTH_FILE = path.join(META_DIR, ".auth");
const DAO_PROXY_URL = process.env.DAO_PROXY_URL || "http://127.0.0.1:7780";
const DAO_AUTH_FILE = path.join(os.homedir(), "dao_proxy", ".auth");
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const GITHUB_BASE = process.env.GITHUB_BASE || "https://models.github.ai";
const FALLBACK_CHAIN = (process.env.META_FALLBACK || "dao,github")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const SEAL =
  "印 122 · 去彼取此 · 三池打通 · streaming + Bearer + OpenAI-spec · git tracked (yin122)";
const VERSION = "0.6.1";

// 立 META_DIR
if (!fs.existsSync(META_DIR)) fs.mkdirSync(META_DIR, { recursive: true });

// ─── auth token ───
let META_AUTH_TOKEN = process.env.META_AUTH_TOKEN || "";
if (!META_AUTH_TOKEN) {
  if (fs.existsSync(META_AUTH_FILE)) {
    META_AUTH_TOKEN = fs.readFileSync(META_AUTH_FILE, "utf-8").trim();
  } else {
    META_AUTH_TOKEN = crypto.randomBytes(32).toString("hex");
    fs.writeFileSync(META_AUTH_FILE, META_AUTH_TOKEN, { mode: 0o600 });
  }
}

// 读 dao_proxy 之 auth (用以转发)
let DAO_PROXY_AUTH = process.env.DAO_PROXY_AUTH || "";
if (!DAO_PROXY_AUTH && fs.existsSync(DAO_AUTH_FILE)) {
  DAO_PROXY_AUTH = fs.readFileSync(DAO_AUTH_FILE, "utf-8").trim();
}

// ─── log ───
const t0 = Date.now();
const metrics = {
  total: 0,
  by_backend: { dao: 0, github: 0 },
  by_status: {},
  errors: 0,
  startedAt: new Date().toISOString(),
};
function log(...args) {
  const ms = Date.now() - t0;
  console.log(`[${String(ms).padStart(7)}ms]`, ...args);
}

// ─── 35 件 GitHub Models 之 sample (实从 /github/v1/models proxy) ───
const GITHUB_MODELS_SAMPLE = [
  { id: "openai/gpt-4.1", owned_by: "openai" },
  { id: "openai/gpt-4.1-mini", owned_by: "openai" },
  { id: "openai/gpt-4.1-nano", owned_by: "openai" },
  { id: "openai/gpt-4o", owned_by: "openai" },
  { id: "openai/gpt-4o-mini", owned_by: "openai" },
  { id: "openai/o3-mini", owned_by: "openai" },
  { id: "openai/o1", owned_by: "openai" },
  { id: "openai/o1-mini", owned_by: "openai" },
  { id: "deepseek/DeepSeek-R1", owned_by: "deepseek" },
  { id: "deepseek/DeepSeek-V3", owned_by: "deepseek" },
  { id: "meta/Llama-3.3-70B-Instruct", owned_by: "meta" },
  { id: "meta/Llama-3.2-90B-Vision-Instruct", owned_by: "meta" },
  { id: "microsoft/phi-4", owned_by: "microsoft" },
  { id: "microsoft/Phi-3.5-mini-instruct", owned_by: "microsoft" },
  { id: "mistral-ai/Mistral-Large-2411", owned_by: "mistral-ai" },
  { id: "mistral-ai/Codestral-2501", owned_by: "mistral-ai" },
  { id: "ai21-labs/AI21-Jamba-1.5-Large", owned_by: "ai21-labs" },
  { id: "cohere/Cohere-command-r-08-2024", owned_by: "cohere" },
];

// ─── HTTP 转发 (buffered · 用于非 stream 路) ───
function httpRequest(method, urlStr, headers, body, timeoutMs = 90000) {
  return new Promise((resolve) => {
    const t1 = Date.now();
    const u = new URL(urlStr);
    const isHttps = u.protocol === "https:";
    const req = (isHttps ? https : http).request(
      {
        hostname: u.hostname,
        port: u.port || (isHttps ? 443 : 80),
        path: u.pathname + u.search,
        method,
        headers,
        timeout: timeoutMs,
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            ms: Date.now() - t1,
            buf: Buffer.concat(chunks),
            headers: res.headers,
          });
        });
      },
    );
    req.on("error", (e) =>
      resolve({ ok: false, status: 0, ms: Date.now() - t1, error: e.message }),
    );
    req.on("timeout", () => {
      req.destroy();
      resolve({ ok: false, status: 0, ms: Date.now() - t1, error: "timeout" });
    });
    if (body) req.write(body);
    req.end();
  });
}

// ─── HTTP 转发 (pipe · 真 streaming) ─────
// 印 121 · 修 P1 · chat 之 stream:true 直 pipe upstream 至 client · 不 buffer
// 返 promise resolve 于 (status, ms, ok, pipedBytes) · 但 res.write 是即时之
function httpPipeStream(
  method,
  urlStr,
  headers,
  body,
  clientRes,
  timeoutMs = 120000,
) {
  return new Promise((resolve) => {
    const t1 = Date.now();
    const u = new URL(urlStr);
    const isHttps = u.protocol === "https:";
    let pipedBytes = 0;
    let firstChunkAt = null;
    const req = (isHttps ? https : http).request(
      {
        hostname: u.hostname,
        port: u.port || (isHttps ? 443 : 80),
        path: u.pathname + u.search,
        method,
        headers,
        timeout: timeoutMs,
      },
      (res) => {
        // 写 client 之 status + headers (仅保 SSE 必需)
        const passHeaders = {};
        for (const k of [
          "content-type",
          "cache-control",
          "x-accel-buffering",
          "x-request-id",
        ]) {
          if (res.headers[k]) passHeaders[k] = res.headers[k];
        }
        // 强 SSE 不 buffer
        if (!passHeaders["content-type"])
          passHeaders["content-type"] = "text/event-stream; charset=utf-8";
        passHeaders["cache-control"] = "no-cache, no-transform";
        passHeaders["x-accel-buffering"] = "no";
        passHeaders["connection"] = "keep-alive";
        if (!clientRes.headersSent)
          clientRes.writeHead(res.statusCode, passHeaders);
        res.on("data", (chunk) => {
          if (!firstChunkAt) firstChunkAt = Date.now() - t1;
          pipedBytes += chunk.length;
          if (!clientRes.writableEnded) clientRes.write(chunk);
        });
        res.on("end", () => {
          if (!clientRes.writableEnded) clientRes.end();
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            ms: Date.now() - t1,
            firstChunkMs: firstChunkAt,
            pipedBytes,
          });
        });
        res.on("error", () => {
          if (!clientRes.writableEnded) clientRes.end();
          resolve({
            ok: false,
            status: res.statusCode || 0,
            ms: Date.now() - t1,
            error: "upstream-res-error",
            pipedBytes,
          });
        });
      },
    );
    req.on("error", (e) => {
      if (!clientRes.headersSent)
        clientRes.writeHead(502, { "content-type": "application/json" });
      if (!clientRes.writableEnded)
        clientRes.end(
          JSON.stringify(
            openaiErr(
              "upstream connect failed: " + e.message,
              "upstream_error",
            ),
          ),
        );
      resolve({
        ok: false,
        status: 0,
        ms: Date.now() - t1,
        error: e.message,
        pipedBytes,
      });
    });
    req.on("timeout", () => {
      req.destroy();
      if (!clientRes.headersSent)
        clientRes.writeHead(504, { "content-type": "application/json" });
      if (!clientRes.writableEnded)
        clientRes.end(JSON.stringify(openaiErr("upstream timeout", "timeout")));
      resolve({
        ok: false,
        status: 0,
        ms: Date.now() - t1,
        error: "timeout",
        pipedBytes,
      });
    });
    if (body) req.write(body);
    req.end();
  });
}

// ─── OpenAI-spec 错误包 (P3 修) ───
function openaiErr(message, type = "server_error", code = null, extra = {}) {
  return { error: { message, type, code, ...extra } };
}

// ─── 合 dao backend headers (全清 client 之 auth · 注 dao 自己之 auth) ───
function buildDaoHeaders(clientHeaders, body, extraAccept) {
  const h = { ...clientHeaders };
  delete h.host;
  delete h["content-length"];
  delete h["x-dao-auth"];
  delete h["X-Dao-Auth"];
  delete h.authorization;
  delete h.Authorization;
  delete h.connection;
  if (DAO_PROXY_AUTH) {
    h["x-dao-auth"] = DAO_PROXY_AUTH;
    h["authorization"] = `Bearer ${DAO_PROXY_AUTH}`;
  }
  if (extraAccept) h["accept"] = extraAccept;
  if (body) h["content-length"] = Buffer.byteLength(body);
  return h;
}

// ─── backend: dao_proxy (buffered) ───
async function callDao(reqPath, method, headers, body) {
  return httpRequest(
    method,
    DAO_PROXY_URL + reqPath,
    buildDaoHeaders(headers, body),
    body,
  );
}

// ─── backend: dao_proxy (真 stream pipe · P1 修) ───
async function streamDao(reqPath, method, headers, body, clientRes) {
  return httpPipeStream(
    method,
    DAO_PROXY_URL + reqPath,
    buildDaoHeaders(headers, body, "text/event-stream"),
    body,
    clientRes,
  );
}

// ─── backend: GitHub Models BYOK ───
async function callGithub(reqPath, method, headers, body) {
  if (!GITHUB_TOKEN) {
    return {
      ok: false,
      status: 503,
      ms: 0,
      buf: Buffer.from(
        JSON.stringify({
          error: {
            message:
              "GITHUB_TOKEN 未注入 · 主公一字便活: ENV GITHUB_TOKEN=<PAT> 重启 meta_router",
            type: "config_error",
          },
        }),
      ),
      headers: { "content-type": "application/json" },
    };
  }
  // /v1/chat/completions → /inference/chat/completions (GitHub Models 之 path)
  let ghPath = reqPath;
  if (
    reqPath === "/v1/chat/completions" ||
    reqPath === "/github/v1/chat/completions"
  ) {
    ghPath = "/inference/chat/completions";
  } else if (reqPath === "/v1/models" || reqPath === "/github/v1/models") {
    ghPath = "/catalog/models";
  } else if (reqPath.startsWith("/github/")) {
    ghPath = reqPath.replace("/github", "");
  }
  const url = GITHUB_BASE + ghPath;
  const fwdHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: "application/json",
    "User-Agent": "dao-meta-router/0.5.0",
  };
  if (body) fwdHeaders["Content-Length"] = Buffer.byteLength(body);
  return httpRequest(method, url, fwdHeaders, body);
}

// ─── backend: GitHub Models BYOK (真 stream pipe · P1 修) ───
async function streamGithub(reqPath, method, headers, body, clientRes) {
  if (!GITHUB_TOKEN) {
    if (!clientRes.headersSent)
      clientRes.writeHead(503, { "content-type": "application/json" });
    if (!clientRes.writableEnded)
      clientRes.end(
        JSON.stringify(
          openaiErr(
            "GITHUB_TOKEN 未注入 · 主公一字便活: ENV GITHUB_TOKEN=<PAT> 重启 meta_router",
            "config_error",
          ),
        ),
      );
    return { ok: false, status: 503, ms: 0, pipedBytes: 0 };
  }
  let ghPath = reqPath;
  if (
    reqPath === "/v1/chat/completions" ||
    reqPath === "/github/v1/chat/completions"
  )
    ghPath = "/inference/chat/completions";
  else if (reqPath.startsWith("/github/"))
    ghPath = reqPath.replace("/github", "");
  const url = GITHUB_BASE + ghPath;
  const ghHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: "text/event-stream",
    "User-Agent": "dao-meta-router/0.6.0",
  };
  if (body) ghHeaders["Content-Length"] = Buffer.byteLength(body);
  return httpPipeStream(method, url, ghHeaders, body, clientRes);
}

// ─── routes ───
async function handle(req, res) {
  metrics.total++;
  const reqPath = req.url.split("?")[0];

  // 公开路 (无 auth)
  if (reqPath === "/health" || reqPath === "/") {
    return jsonRes(res, 200, await healthSnapshot());
  }
  if (reqPath === "/backends/status") {
    return jsonRes(res, 200, await backendsStatus());
  }

  // auth gate (除公开) · P6: 同接 X-Dao-Auth + Authorization: Bearer + ?key= (SDK 全兼容)
  const urlObj = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const authHeader =
    req.headers["x-dao-auth"] || req.headers["authorization"] || "";
  const tokenFromQuery =
    urlObj.searchParams.get("key") || urlObj.searchParams.get("api_key") || "";
  const tokenFromHeader = authHeader.replace(/^Bearer\s+/i, "").trim();
  const token = tokenFromHeader || tokenFromQuery;
  if (META_AUTH_TOKEN && token !== META_AUTH_TOKEN) {
    return jsonRes(
      res,
      401,
      openaiErr(
        "Unauthorized · 需 Authorization: Bearer <token> OR X-Dao-Auth header OR ?key=<token>",
        "invalid_request_error",
        "unauthorized",
      ),
    );
  }

  // 收 body
  const body = await readBody(req);

  // ─── /v1/models (合 dao + github · P5 修: 真 PAT 时 fetch /catalog/models) ───
  if (reqPath === "/v1/models" && req.method === "GET") {
    const dao = await callDao("/v1/models", "GET", req.headers, null);
    let daoData = [];
    try {
      daoData = JSON.parse(dao.buf.toString("utf-8"))?.data || [];
    } catch (_) {}

    let githubData = [];
    let ghFetchStatus = null;
    if (GITHUB_TOKEN) {
      // 真 fetch /catalog/models (35+ 件 · P5 修)
      const ghRes = await httpRequest(
        "GET",
        GITHUB_BASE + "/catalog/models",
        {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: "application/json",
          "User-Agent": "dao-meta-router/0.6.0",
        },
        null,
        15000,
      );
      ghFetchStatus = ghRes.status;
      if (ghRes.ok) {
        try {
          const ghParsed = JSON.parse(ghRes.buf.toString("utf-8"));
          // GitHub catalog 返列 (可能是 array 或 {data:[]})
          const ghList = Array.isArray(ghParsed)
            ? ghParsed
            : ghParsed.data || ghParsed.models || [];
          githubData = ghList.map((m) => ({
            id: `github/${m.id || m.name || m.model_id}`,
            object: "model",
            owned_by: `github/${m.publisher || m.owned_by || "unknown"}`,
            created: Math.floor(Date.now() / 1000),
          }));
        } catch (e) {
          // fallback to sample
          githubData = GITHUB_MODELS_SAMPLE.map((m) => ({
            id: `github/${m.id}`,
            object: "model",
            owned_by: `github/${m.owned_by}`,
            created: Math.floor(Date.now() / 1000),
          }));
        }
      }
    } else {
      githubData = GITHUB_MODELS_SAMPLE.map((m) => ({
        id: `github/${m.id}`,
        object: "model",
        owned_by: `github/${m.owned_by}`,
        created: Math.floor(Date.now() / 1000),
      }));
    }

    return jsonRes(res, 200, {
      object: "list",
      data: [...daoData, ...githubData],
      meta: {
        seal: SEAL,
        version: VERSION,
        backends: {
          dao: { count: daoData.length, status: dao.status },
          github: {
            count: githubData.length,
            hasKey: !!GITHUB_TOKEN,
            source: GITHUB_TOKEN
              ? ghFetchStatus === 200
                ? "live-fetch"
                : "sample-fallback"
              : "sample-no-pat",
          },
        },
      },
    });
  }

  // ─── 检 stream 标 (应于下 3 路 · P1 修) ───
  let isStream = false;
  try {
    isStream = JSON.parse(body || "{}").stream === true;
  } catch (_) {}

  // ─── 强 /devin/* 路 ───
  if (reqPath.startsWith("/devin/")) {
    const innerPath = reqPath.replace("/devin", "");
    metrics.by_backend.dao++;
    if (isStream) {
      const r = await streamDao(innerPath, req.method, req.headers, body, res);
      metrics.by_status[r.status] = (metrics.by_status[r.status] || 0) + 1;
      return;
    }
    const r = await callDao(innerPath, req.method, req.headers, body);
    metrics.by_status[r.status] = (metrics.by_status[r.status] || 0) + 1;
    return rawRes(res, r);
  }
  // ─── 强 /github/* 路 ───
  if (reqPath.startsWith("/github/")) {
    metrics.by_backend.github++;
    if (isStream) {
      const r = await streamGithub(reqPath, req.method, req.headers, body, res);
      metrics.by_status[r.status] = (metrics.by_status[r.status] || 0) + 1;
      return;
    }
    const r = await callGithub(reqPath, req.method, req.headers, body);
    metrics.by_status[r.status] = (metrics.by_status[r.status] || 0) + 1;
    return rawRes(res, r);
  }

  // ─── 默 /v1/chat/completions · /v1/messages · fallback 链 ───
  if (reqPath === "/v1/chat/completions" || reqPath === "/v1/messages") {
    const tries = [];
    let model = "";
    try {
      model = JSON.parse(body || "{}").model || "";
    } catch (_) {}

    // model name 启发: github/ 前缀 → 强 github
    if (model.startsWith("github/")) {
      const newBody = body.replace(
        /"model"\s*:\s*"github\/([^"]+)"/,
        '"model":"$1"',
      );
      metrics.by_backend.github++;
      if (isStream) {
        const r = await streamGithub(
          reqPath,
          req.method,
          req.headers,
          newBody,
          res,
        );
        metrics.by_status[r.status] = (metrics.by_status[r.status] || 0) + 1;
        return;
      }
      const r = await callGithub(reqPath, req.method, req.headers, newBody);
      metrics.by_status[r.status] = (metrics.by_status[r.status] || 0) + 1;
      return rawRes(res, r);
    }

    // stream 在 fallback 链下之处理:
    // · 只能选 1 件 backend 即始 pipe (一旦开 stream 就不能 switch)
    // · 选首件能连之 backend (dao 优先 · connect 失则 github)
    if (isStream) {
      for (const backend of FALLBACK_CHAIN) {
        let r;
        if (backend === "dao") {
          metrics.by_backend.dao++;
          r = await streamDao(reqPath, req.method, req.headers, body, res);
        } else if (backend === "github") {
          metrics.by_backend.github++;
          r = await streamGithub(reqPath, req.method, req.headers, body, res);
        } else continue;
        metrics.by_status[r.status] = (metrics.by_status[r.status] || 0) + 1;
        // pipe 已开 · 不能再切 · 几 next backend (但 res 已 end)
        return;
      }
      return;
    }

    // 非 stream · 默 fallback 链
    for (const backend of FALLBACK_CHAIN) {
      let r;
      if (backend === "dao") {
        metrics.by_backend.dao++;
        r = await callDao(reqPath, req.method, req.headers, body);
      } else if (backend === "github") {
        metrics.by_backend.github++;
        r = await callGithub(reqPath, req.method, req.headers, body);
      } else continue;
      metrics.by_status[r.status] = (metrics.by_status[r.status] || 0) + 1;
      tries.push({ backend, status: r.status, ms: r.ms });
      if (r.ok) {
        if (r.headers) {
          r.headers["x-meta-backend"] = backend;
          r.headers["x-meta-tries"] = JSON.stringify(tries);
        }
        return rawRes(res, r);
      }
    }
    // 全失 · OpenAI-spec 错误格式 (P3 修)
    metrics.errors++;
    return jsonRes(
      res,
      502,
      openaiErr("All backends failed", "upstream_error", "all_failed", {
        tries,
        seal: SEAL,
      }),
    );
  }

  // ─── 默 dao 转 (其他路全转 dao_proxy) ───
  metrics.by_backend.dao++;
  const r = await callDao(reqPath, req.method, req.headers, body);
  metrics.by_status[r.status] = (metrics.by_status[r.status] || 0) + 1;
  return rawRes(res, r);
}

// ─── 助 ───
function jsonRes(res, status, body) {
  const buf = Buffer.from(JSON.stringify(body, null, 2));
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": buf.length,
  });
  res.end(buf);
}
function rawRes(res, r) {
  if (!r.headers) r.headers = {};
  if (!r.buf)
    r.buf = Buffer.from(JSON.stringify({ error: r.error || "no-body" }));
  res.writeHead(r.status || 502, r.headers);
  res.end(r.buf);
}
function readBody(req) {
  return new Promise((resolve) => {
    if (req.method === "GET" || req.method === "HEAD") return resolve("");
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
  });
}

async function healthSnapshot() {
  return {
    ok: true,
    seal: SEAL,
    version: VERSION,
    bind: `0.0.0.0:${META_PORT}`,
    backends: {
      dao: { url: DAO_PROXY_URL, hasAuth: !!DAO_PROXY_AUTH },
      github: { base: GITHUB_BASE, hasKey: !!GITHUB_TOKEN },
    },
    fallback_chain: FALLBACK_CHAIN,
    auth: {
      enabled: !!META_AUTH_TOKEN,
      tokenLength: META_AUTH_TOKEN.length,
      tokenPreview: META_AUTH_TOKEN
        ? META_AUTH_TOKEN.slice(0, 6) + "..." + META_AUTH_TOKEN.slice(-4)
        : null,
    },
    metrics,
    uptimeMs: Date.now() - t0,
    timestamp: Date.now(),
  };
}

async function backendsStatus() {
  const r = await Promise.all([
    callDao("/health", "GET", {}, null).then((r) => ({
      backend: "dao",
      status: r.status,
      ms: r.ms,
      ok: r.ok,
      preview: r.buf ? r.buf.toString("utf-8").slice(0, 200) : null,
    })),
    GITHUB_TOKEN
      ? callGithub("/catalog/models", "GET", {}, null).then((r) => ({
          backend: "github",
          status: r.status,
          ms: r.ms,
          ok: r.ok,
          preview: r.buf ? r.buf.toString("utf-8").slice(0, 200) : null,
        }))
      : Promise.resolve({
          backend: "github",
          status: 503,
          ms: 0,
          ok: false,
          preview: "GITHUB_TOKEN 未注",
        }),
  ]);
  return { backends: r, fallback_chain: FALLBACK_CHAIN, timestamp: Date.now() };
}

// ─── 起 ───
const server = http.createServer((req, res) => {
  handle(req, res).catch((e) => {
    metrics.errors++;
    log("✗ handler err:", e.message);
    if (!res.headersSent)
      jsonRes(res, 500, { error: { message: e.message, type: "internal" } });
  });
});
server.listen(META_PORT, "0.0.0.0", () => {
  log(`★ ${SEAL} v${VERSION}`);
  log(`★ meta-router 已起 · :${META_PORT}`);
  log(`  · DAO_PROXY_URL = ${DAO_PROXY_URL}  hasAuth=${!!DAO_PROXY_AUTH}`);
  log(
    `  · GITHUB_TOKEN  = ${GITHUB_TOKEN ? "✓ 已注 (" + GITHUB_TOKEN.length + " chars)" : "✗ 缺 · 主公一字便活"}`,
  );
  log(`  · fallback     = ${FALLBACK_CHAIN.join(" → ")}`);
  log(
    `  · auth         = X-Dao-Auth: ${META_AUTH_TOKEN.slice(0, 8)}...${META_AUTH_TOKEN.slice(-4)}`,
  );
});
