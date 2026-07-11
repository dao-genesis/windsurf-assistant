#!/usr/bin/env node
/**
 * windsurf_auth.js — 印 64 · 反者道之动 · Windsurf 账号 4 步链 (Node 端口)
 * ════════════════════════════════════════════════════════════════════════
 *
 *   帛书·四十:  反者, 道之动也; 弱者, 道之用也.
 *               天下之物生于有, 有生于无.
 *
 *   源:    Devin云原生/windsurf_auth.py (印 63 · v∞.20 · 2026-05-XX)
 *   端口: 0 npm · 仅 node:https / node:crypto / node:url
 *
 *   四步链 · email+password → sk-ws-* + 配额:
 *
 *     Step 1: POST https://windsurf.com/_devin-auth/password/login
 *               body: {email, password}
 *               → {token=<auth1>, user_id}
 *
 *     Step 2: POST https://windsurf.com/_backend/.../WindsurfPostAuth
 *               headers: { X-Devin-Auth1-Token: <auth1> }
 *               body: {auth1_token, org_id?}
 *               → {sessionToken="devin-session-token$..."} ★ wss opaque
 *
 *     Step 3: POST https://register.windsurf.com/.../RegisterUser
 *               body: {firebase_id_token: <sessionToken>}
 *               → {api_key=<sk-*>, api_server_url, name} ★ X-Api-Key
 *
 *     Step 4 (可选): POST {api_server_url}/.../GetUserStatus
 *               headers: { X-Api-Key }
 *               body: {metadata: {ideName, sessionId, ...}}
 *               → {planInfo, weeklyQuotaRemainingPercent, planEnd, ...}
 *
 *   一切皆"同一 Cognition 身份"之衍生:  auth1 → sessionToken → apiKey → 配额
 *
 *   API:
 *     const a = require('./windsurf_auth');
 *     const r = await a.autoChain(email, password);  // → {apiKey, sessionToken, quota, timing}
 *     await a.devinLogin(email, password);
 *     await a.windsurfPostAuth(auth1, orgId);
 *     await a.registerUserViaSession(sessionToken);
 *     await a.fetchUserStatus(apiKey, apiServerUrl);
 *
 *   CLI: node windsurf_auth.js auto --email a@b.com --password xxx [--no-quota] [--json]
 */
"use strict";

const https = require("https");
const crypto = require("crypto");
const { URL } = require("url");

// ── 真本源常量 (extension.js v2.7.0 实证 · 与 Python 端一致) ──
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36";
const WINDSURF = "https://windsurf.com";
const REGISTER_BASE = "https://register.windsurf.com";
const URL_DEVIN_LOGIN = WINDSURF + "/_devin-auth/password/login";
const URL_POSTAUTH =
  WINDSURF +
  "/_backend/exa.seat_management_pb.SeatManagementService/WindsurfPostAuth";
const URL_REGISTER_USER =
  REGISTER_BASE +
  "/exa.seat_management_pb.SeatManagementService/RegisterUser";
const URL_GET_USER_STATUS_LIST = [
  "https://server.codeium.com/exa.seat_management_pb.SeatManagementService/GetUserStatus",
  "https://server.self-serve.windsurf.com/exa.seat_management_pb.SeatManagementService/GetUserStatus",
  "https://windsurf.com/_route/api_server/exa.seat_management_pb.SeatManagementService/GetUserStatus",
];
const HTTP_TIMEOUT_MS = 12000;
const RE_SESSION_TOKEN_PREFIX = "devin-session-token$";

// ════════════════════════════════════════════════════════════════
// §1 · AuthError + jsonPost
// ════════════════════════════════════════════════════════════════

class AuthError extends Error {
  constructor(step, code, reason, body) {
    super(`[${step}] ${reason}${code ? ` code=${code}` : ""}`);
    this.name = "AuthError";
    this.step = step;
    this.code = code || null;
    this.reason = reason;
    this.body = (body || "").slice(0, 300);
  }
}

/**
 * 极简 JSON POST · 返 {status, json|null, text}
 */
function jsonPost(targetUrl, headers, body, opts = {}) {
  const timeout = opts.timeoutMs || HTTP_TIMEOUT_MS;
  const insecure = !!opts.insecure;
  return new Promise((resolve) => {
    let u;
    try {
      u = new URL(targetUrl);
    } catch (e) {
      return resolve({ status: 0, json: null, text: `bad url: ${e.message}` });
    }
    const data = Buffer.from(JSON.stringify(body || {}), "utf8");
    const reqHeaders = {
      "Content-Type": "application/json",
      Accept: "application/json, text/plain, */*",
      "User-Agent": UA,
      "Content-Length": data.length,
      ...(headers || {}),
    };
    const req = https.request(
      {
        method: "POST",
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname + u.search,
        headers: reqHeaders,
        timeout,
        rejectUnauthorized: !insecure,
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let j = null;
          try {
            j = text ? JSON.parse(text) : null;
          } catch {}
          resolve({ status: res.statusCode || 0, json: j, text });
        });
      },
    );
    req.on("error", (e) =>
      resolve({ status: 0, json: null, text: `err: ${e.message}` }),
    );
    req.on("timeout", () => {
      req.destroy();
      resolve({ status: 0, json: null, text: "timeout" });
    });
    req.write(data);
    req.end();
  });
}

// ════════════════════════════════════════════════════════════════
// §2 · 四步链 · 一一映射 Python 源
// ════════════════════════════════════════════════════════════════

/**
 * Step 1: email+password → {auth1, userId}
 */
async function devinLogin(email, password, opts = {}) {
  if (!email || !password)
    throw new AuthError("login", null, "missing email or password");
  const r = await jsonPost(
    URL_DEVIN_LOGIN,
    {
      Origin: WINDSURF,
      Referer: WINDSURF + "/account/login",
    },
    { email, password },
    opts,
  );
  const j = r.json || {};
  if (j.token && j.user_id) {
    return { auth1: j.token, userId: j.user_id, raw: j };
  }
  const err = j.detail || j.error || j.message || "no_token";
  throw new AuthError("login", r.status, String(err), r.text);
}

/**
 * Step 2: auth1 → {sessionToken, accountId, primaryOrgId}
 */
async function windsurfPostAuth(auth1, orgId, opts = {}) {
  if (!auth1) throw new AuthError("postauth", null, "missing auth1");
  const body = { auth1_token: auth1 };
  if (orgId) body.org_id = orgId;
  const r = await jsonPost(
    URL_POSTAUTH,
    {
      Origin: WINDSURF,
      Referer: WINDSURF + "/profile",
      "Connect-Protocol-Version": "1",
      "X-Devin-Auth1-Token": auth1,
    },
    body,
    opts,
  );
  const j = r.json || {};
  const st = j.sessionToken || "";
  if (typeof st === "string" && st.startsWith(RE_SESSION_TOKEN_PREFIX)) {
    return {
      sessionToken: st,
      accountId: j.accountId || "",
      primaryOrgId: j.primaryOrgId || "",
      raw: j,
    };
  }
  const err = j.error || j.code || j.message || "no_session";
  throw new AuthError("postauth", r.status, String(err), r.text);
}

/**
 * Step 3: sessionToken → {apiKey, apiServerUrl, name}
 */
async function registerUserViaSession(sessionToken, opts = {}) {
  if (!sessionToken)
    throw new AuthError("register", null, "missing sessionToken");
  const r = await jsonPost(
    URL_REGISTER_USER,
    { "Connect-Protocol-Version": "1" },
    { firebase_id_token: sessionToken },
    opts,
  );
  const j = r.json || {};
  const apiKey = j.api_key || j.apiKey;
  if (apiKey) {
    return {
      apiKey,
      name: j.name || "",
      apiServerUrl: j.api_server_url || j.apiServerUrl || "",
      raw: j,
    };
  }
  const err = j.code || j.message || j.error || "no_api_key";
  throw new AuthError("register", r.status, String(err), r.text);
}

/**
 * Step 4: apiKey → 配额 dict | {_failed: true, ...}
 */
async function fetchUserStatus(apiKey, apiServerUrl, opts = {}) {
  if (!apiKey) return null;
  const tries = [];
  if (apiServerUrl) {
    tries.push(
      apiServerUrl.replace(/\/+$/, "") +
        "/exa.seat_management_pb.SeatManagementService/GetUserStatus",
    );
  }
  for (const u of URL_GET_USER_STATUS_LIST)
    if (!tries.includes(u)) tries.push(u);

  const sessionId = opts.sessionId || crypto.randomUUID();
  const ideVersion = opts.ideVersion || "1.99.0";
  const metadata = {
    ideName: "windsurf",
    ideVersion,
    extensionName: "windsurf",
    extensionVersion: ideVersion,
    apiKey,
    sessionId,
    requestId: "1",
    locale: "en",
    os: "windows",
  };
  let lastStatus = null;
  let lastText = "";
  for (const url of tries) {
    try {
      const r = await jsonPost(
        url,
        {
          "Connect-Protocol-Version": "1",
          "X-Api-Key": apiKey,
        },
        { metadata },
        { timeoutMs: 8000, insecure: opts.insecure },
      );
      lastStatus = r.status;
      lastText = (r.text || "").slice(0, 200);
      if (r.status >= 200 && r.status < 300 && r.json) {
        const parsed = parsePlanStatusJson(r.json);
        parsed._ok_url = url;
        return parsed;
      }
      if (r.status === 401) break; // auth 拒 · 换 endpoint 无救
    } catch (e) {
      lastText = `err: ${e.message}`;
    }
  }
  return { _failed: true, _last_status: lastStatus, _last_text: lastText, tries };
}

/**
 * extension.js _parsePlanStatusJson 之 JS 镜像
 * proto3 语义: 缺字段 = 0 = 耗尽
 */
function parsePlanStatusJson(j) {
  const userStatus = j.userStatus || j.user_status || {};
  const ps =
    userStatus.planStatus ||
    userStatus.plan_status ||
    j.planStatus ||
    j.plan_status ||
    j;
  const planInfo =
    ps.planInfo ||
    ps.plan_info ||
    userStatus.planInfo ||
    userStatus.plan_info ||
    {};

  const gi = (d, ...keys) => {
    for (const k of keys) {
      const v = d?.[k];
      if (v !== null && v !== undefined) {
        const n = parseInt(v, 10);
        if (!isNaN(n)) return n;
      }
    }
    return 0;
  };
  const gs = (d, ...keys) => {
    for (const k of keys) {
      const v = d?.[k];
      if (v !== null && v !== undefined) return String(v);
    }
    return "";
  };

  const weekly = gi(
    ps,
    "weeklyQuotaRemainingPercent",
    "weekly_quota_remaining_percent",
  );
  // Trial 无 daily 字段时 daily 镜像 weekly
  let daily = gi(ps, "dailyQuotaRemainingPercent", "daily_quota_remaining_percent");
  if (
    !ps.dailyQuotaRemainingPercent &&
    !ps.daily_quota_remaining_percent &&
    weekly > 0
  ) {
    daily = weekly;
  }
  return {
    planName: gs(planInfo, "planName", "plan_name"),
    teamsTier: gs(planInfo, "teamsTier", "teams_tier"),
    planStart: gs(ps, "planStart", "plan_start"),
    planEnd: gs(ps, "planEnd", "plan_end"),
    weeklyQuotaRemainingPercent: weekly,
    dailyQuotaRemainingPercent: daily,
    availablePromptCredits: gi(
      ps,
      "availablePromptCredits",
      "available_prompt_credits",
    ),
    availableFlowCredits: gi(
      ps,
      "availableFlowCredits",
      "available_flow_credits",
    ),
    availableFlexCredits: gi(
      ps,
      "availableFlexCredits",
      "available_flex_credits",
    ),
    raw: j,
  };
}

// ════════════════════════════════════════════════════════════════
// §3 · autoChain · 一键全链
// ════════════════════════════════════════════════════════════════

/**
 * email+password → 全链 → {ok, sessionToken, apiKey, apiServerUrl, quota?, timing, ...}
 */
async function autoChain(email, password, opts = {}) {
  const fetchQuota = opts.fetchQuota !== false;
  const t0 = Date.now();
  const step1 = await devinLogin(email, password, opts);
  const t1 = Date.now();
  const step2 = await windsurfPostAuth(step1.auth1, opts.orgId, opts);
  const t2 = Date.now();
  const step3 = await registerUserViaSession(step2.sessionToken, opts);
  const t3 = Date.now();
  const result = {
    ok: true,
    email,
    userId: step1.userId,
    accountId: step2.accountId,
    primaryOrgId: step2.primaryOrgId,
    sessionToken: step2.sessionToken,
    apiKey: step3.apiKey,
    name: step3.name,
    apiServerUrl: step3.apiServerUrl,
    timing: {
      login_ms: t1 - t0,
      postauth_ms: t2 - t1,
      register_ms: t3 - t2,
    },
  };
  if (fetchQuota) {
    const q = await fetchUserStatus(step3.apiKey, step3.apiServerUrl, opts);
    result.quota = q;
    result.timing.status_ms = Date.now() - t3;
  }
  return result;
}

// ════════════════════════════════════════════════════════════════
// §4 · CLI
// ════════════════════════════════════════════════════════════════

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const k = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        out[k] = next;
        i++;
      } else {
        out[k] = true;
      }
    } else {
      out._.push(a);
    }
  }
  return out;
}

async function cli() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  const args = parseArgs(argv.slice(1));
  const insecure = !!args.insecure;
  const opts = { insecure };

  try {
    switch (cmd) {
      case "login": {
        const r = await devinLogin(args.email, args.password, opts);
        console.log("✓ auth1: " + r.auth1.slice(0, 24) + "...");
        console.log("  userId: " + r.userId);
        return 0;
      }
      case "auto": {
        const r = await autoChain(args.email, args.password, {
          ...opts,
          fetchQuota: !args["no-quota"],
        });
        const t = r.timing;
        console.log(`✓ Step 1 login    (${t.login_ms}ms)`);
        console.log(`✓ Step 2 postAuth (${t.postauth_ms}ms)`);
        console.log(`✓ Step 3 register (${t.register_ms}ms)`);
        if (t.status_ms !== undefined)
          console.log(`✓ Step 4 status   (${t.status_ms}ms)`);
        console.log("");
        console.log(
          "  sessionToken: " +
            r.sessionToken.slice(0, 36) +
            "..." +
            r.sessionToken.slice(-6),
        );
        console.log(
          "  apiKey      : " + r.apiKey.slice(0, 14) + "..." + r.apiKey.slice(-4),
        );
        console.log("  apiServerUrl: " + (r.apiServerUrl || "(default)"));
        if (r.quota && !r.quota._failed) {
          console.log("");
          console.log(
            `  plan: ${r.quota.planName || "(?)"}  D ${r.quota.dailyQuotaRemainingPercent}%  W ${r.quota.weeklyQuotaRemainingPercent}%`,
          );
        }
        if (args.json) {
          const out = { ...r };
          if (!args["with-quota"]) delete out.quota;
          process.stdout.write("\n" + JSON.stringify(out) + "\n");
        }
        return 0;
      }
      case "status": {
        const apiKey =
          args["api-key"] ||
          process.env.DAO_FLEET_API_KEY ||
          process.env.WINDSURF_API_KEY ||
          process.env.DEVIN_API_KEY;
        if (!apiKey) {
          console.error("✗ missing --api-key or env DAO_FLEET_API_KEY/WINDSURF_API_KEY/DEVIN_API_KEY");
          return 2;
        }
        const q = await fetchUserStatus(apiKey, args["api-server"] || null, opts);
        if (!q || q._failed) {
          console.error(
            `✗ status fetch failed · last=${q?._last_status} · ${q?._last_text || "no response"}`,
          );
          return 1;
        }
        console.log(
          `✓ ${q.planName || "(?)"}  end=${q.planEnd?.slice(0, 10) || "-"}  D ${q.dailyQuotaRemainingPercent}%  W ${q.weeklyQuotaRemainingPercent}%  prompt=${q.availablePromptCredits} flow=${q.availableFlowCredits}`,
        );
        return 0;
      }
      default:
        console.error(
          "usage: node windsurf_auth.js {login|auto|status} [--email] [--password] [--api-key] [--no-quota] [--json] [--insecure]",
        );
        return 2;
    }
  } catch (e) {
    if (e instanceof AuthError) {
      console.error(`✗ ${e.step}: ${e.reason} (code=${e.code})`);
      if (e.body) console.error(`  body: ${e.body.slice(0, 200)}`);
    } else {
      console.error("✗ fatal:", e.message);
    }
    return 1;
  }
}

if (require.main === module) {
  cli().then((code) => process.exit(code || 0));
}

module.exports = {
  AuthError,
  devinLogin,
  windsurfPostAuth,
  registerUserViaSession,
  fetchUserStatus,
  parsePlanStatusJson,
  autoChain,
  // for tests
  _internal: {
    URL_DEVIN_LOGIN,
    URL_POSTAUTH,
    URL_REGISTER_USER,
    URL_GET_USER_STATUS_LIST,
    UA,
    RE_SESSION_TOKEN_PREFIX,
  },
};
