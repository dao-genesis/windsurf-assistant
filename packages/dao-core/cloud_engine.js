#!/usr/bin/env node
/**
 * cloud_engine.js — 万法归宗 · 独立云端引擎
 * =============================================
 * 道法自然 · 不依赖Windsurf · 不依赖LS · 不依赖任何本地环境
 * 直连Windsurf云端API · Connect-RPC over HTTPS · 真正流式
 *
 * 认证: apiKey直传 | email+password → Firebase → RegisterUser → apiKey
 * 推理: GetChatMessage (application/connect+proto, 流式Connect-RPC帧)
 * 配额: GetPlanStatus / CheckRateLimit
 *
 * 零外部依赖 — 仅用 Node.js 内置模块 (https, dns, crypto, fs, path)
 */

const https = require("https");
const dns = require("dns");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// ════════════════════════════════════════════════════════════════
// §1  常量
// ════════════════════════════════════════════════════════════════

const FIREBASE_KEYS = [
  "AIzaSyDsOl-1XpT5err0Tcnx8FFod1H8gVGIycY",
  "AIzaSyDKm6GGxMJfCbNf-k0kPytiGLaqFJpeSac",
];

const API_HOSTS = [
  "server.codeium.com",
  "server.self-serve.windsurf.com",
  "web-backend.windsurf.com",
];

// Chat/推理专用 host (exa.language_server_pb.LanguageServerService/GetChatMessage)
// 逆向自 Windsurf extension.js 默认 inferenceApiServerUrl
const INFERENCE_HOSTS = [
  "inference.codeium.com",
  "server.codeium.com",
  "server.self-serve.windsurf.com",
];

const REGISTER_HOSTS = [
  "register.windsurf.com",
  "server.self-serve.windsurf.com",
  "server.codeium.com",
];

const SVC_API = "/exa.api_server_pb.ApiServerService";
const SVC_SEAT = "/exa.seat_management_pb.SeatManagementService";
// 真实 chat service (Windsurf extension 实际使用, 源自 exa.language_server_pb)
const SVC_LANG = "/exa.language_server_pb.LanguageServerService";

// 软编码 · 唯变所适 · 启动时探测 Windsurf 真实版本
// 真实 ideVersion 源自 LSP 进程命令行参数 `--windsurf_version` (如 "2.0.44")
// 该字符串与 extension package.json / product.json 均不同
function discoverVersion() {
  const fs = require("fs");
  const path = require("path");
  const { spawnSync } = require("child_process");
  const out = {};

  // ── 1. 优先: 从 language_server 进程命令行抓 --windsurf_version ──
  if (process.platform === "win32") {
    try {
      const r = spawnSync(
        "wmic",
        [
          "process",
          "where",
          "name='language_server_windows_x64.exe'",
          "get",
          "CommandLine",
          "/format:list",
        ],
        { encoding: "utf8", windowsHide: true, timeout: 3000 },
      );
      if (r.stdout) {
        const m = /--windsurf_version\s+(\S+)/.exec(r.stdout);
        if (m) {
          out.ideVersion = m[1];
        }
      }
    } catch {}
    // 备用: PowerShell Get-CimInstance (wmic 在新系统可能缺席)
    if (!out.ideVersion) {
      try {
        const r2 = spawnSync(
          "powershell",
          [
            "-NoProfile",
            "-Command",
            "(Get-CimInstance Win32_Process -Filter \"Name='language_server_windows_x64.exe'\").CommandLine",
          ],
          { encoding: "utf8", windowsHide: true, timeout: 3000 },
        );
        if (r2.stdout) {
          const m = /--windsurf_version\s+(\S+)/.exec(r2.stdout);
          if (m) {
            out.ideVersion = m[1];
          }
        }
      } catch {}
    }
  }

  // ── 2. 备用: codeium.windsurf extension package.json → extensionVersion ──
  const extPaths = [
    "E:/Windsurf/resources/app/extensions/windsurf/package.json",
    path.join(
      process.env.LOCALAPPDATA || "",
      "Programs/Windsurf/resources/app/extensions/windsurf/package.json",
    ),
    "C:/Program Files/Windsurf/resources/app/extensions/windsurf/package.json",
    "/opt/Windsurf/resources/app/extensions/windsurf/package.json",
  ];
  for (const fp of extPaths) {
    try {
      if (fs.existsSync(fp)) {
        const j = JSON.parse(fs.readFileSync(fp, "utf8"));
        if (j.version) {
          out.extensionVersion = j.version;
          break;
        }
      }
    } catch {}
  }
  return out;
}

const CLIENT_META = Object.assign(
  {
    ideName: "windsurf",
    ideVersion: "2.0.44", // 默认 fallback (与当前 Windsurf LSP 对齐; 启动时优先自动发现)
    extensionVersion: "0.2.0",
    extensionName: "codeium.windsurf",
    locale: "en-US",
  },
  discoverVersion(),
);

// ════════════════════════════════════════════════════════════════
// §2  Protobuf 编解码 (零依赖, 手工实现)
// ════════════════════════════════════════════════════════════════

function encodeVarint(v) {
  const b = [];
  while (v > 127) {
    b.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  b.push(v & 0x7f);
  return Buffer.from(b);
}

function readVarint(data, pos) {
  let result = 0,
    shift = 0;
  while (pos < data.length) {
    const b = data[pos++];
    if (shift < 28) result |= (b & 0x7f) << shift;
    else result += (b & 0x7f) * 2 ** shift;
    if ((b & 0x80) === 0) break;
    shift += 7;
  }
  return { value: result, pos };
}

/** 编码 protobuf string/bytes 字段 */
function encodeField(fieldNum, wireType, payload) {
  const tag = encodeVarint((fieldNum << 3) | wireType);
  if (wireType === 2) {
    return Buffer.concat([tag, encodeVarint(payload.length), payload]);
  }
  if (wireType === 0) {
    return Buffer.concat([tag, encodeVarint(payload)]);
  }
  return Buffer.concat([tag, payload]);
}

function encodeString(fieldNum, str) {
  return encodeField(fieldNum, 2, Buffer.from(str, "utf8"));
}

function encodeMessage(fieldNum, parts) {
  const inner = Buffer.concat(parts);
  return encodeField(fieldNum, 2, inner);
}

function encodeVarintField(fieldNum, value) {
  return encodeField(fieldNum, 0, value);
}

/** 解析 protobuf 消息为字段映射 */
function parseProto(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const fields = {};
  let pos = 0;
  while (pos < bytes.length) {
    const t = readVarint(bytes, pos);
    pos = t.pos;
    const fieldNum = t.value >>> 3,
      wireType = t.value & 0x07;
    if (fieldNum === 0 || fieldNum > 5000 || pos > bytes.length) break;
    if (!fields[fieldNum]) fields[fieldNum] = [];
    switch (wireType) {
      case 0: {
        const r = readVarint(bytes, pos);
        fields[fieldNum].push({ wire: 0, value: r.value });
        pos = r.pos;
        break;
      }
      case 2: {
        const r = readVarint(bytes, pos);
        pos = r.pos;
        const len = r.value;
        if (len < 0 || len > 4194304 || pos + len > bytes.length) {
          pos = bytes.length;
          break;
        }
        fields[fieldNum].push({
          wire: 2,
          bytes: bytes.slice(pos, pos + len),
          len,
        });
        pos += len;
        break;
      }
      case 1: {
        if (pos + 8 > bytes.length) {
          pos = bytes.length;
          break;
        }
        fields[fieldNum].push({ wire: 1, bytes: bytes.slice(pos, pos + 8) });
        pos += 8;
        break;
      }
      case 5: {
        if (pos + 4 > bytes.length) {
          pos = bytes.length;
          break;
        }
        fields[fieldNum].push({ wire: 5, bytes: bytes.slice(pos, pos + 4) });
        pos += 4;
        break;
      }
      default:
        pos = bytes.length;
    }
  }
  return fields;
}

/** 从 protobuf 响应中提取 field 1 string */
function parseProtoString(buf, fieldNum = 1) {
  const fields = parseProto(buf);
  const f = fields[fieldNum];
  if (!f || !f[0] || f[0].wire !== 2) return null;
  return Buffer.from(f[0].bytes).toString("utf8");
}

// ════════════════════════════════════════════════════════════════
// §3  网络工具 — HTTPS 直连 + DNS 绕过
// ════════════════════════════════════════════════════════════════

const DNS_CACHE = {};

/** 使用 Google/Cloudflare DNS 解析, 绕过本地 hosts 文件 */
function resolveHost(hostname) {
  if (DNS_CACHE[hostname]) return Promise.resolve(DNS_CACHE[hostname]);
  return new Promise((resolve, reject) => {
    const resolver = new dns.Resolver();
    resolver.setServers(["8.8.8.8", "1.1.1.1"]);
    resolver.resolve4(hostname, (err, addrs) => {
      if (!err && addrs && addrs.length) {
        DNS_CACHE[hostname] = addrs[0];
        return resolve(addrs[0]);
      }
      // 回退系统 DNS
      dns.resolve4(hostname, (err2, addrs2) => {
        if (err2 || !addrs2?.length)
          return reject(err2 || new Error(`DNS failed: ${hostname}`));
        DNS_CACHE[hostname] = addrs2[0];
        resolve(addrs2[0]);
      });
    });
  });
}

/**
 * HTTPS POST 请求 — 返回完整响应体 (Buffer)
 * 使用 DNS 绕过, TLS SNI 正确, 不受本地 hosts/proxy 影响
 */
async function httpsPost(
  hostname,
  urlPath,
  body,
  headers = {},
  timeoutMs = 20000,
) {
  const ip = await resolveHost(hostname);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      req.destroy();
      reject(new Error(`timeout ${timeoutMs}ms`));
    }, timeoutMs);
    const req = https.request(
      {
        host: ip,
        port: 443,
        path: urlPath,
        method: "POST",
        servername: hostname,
        rejectUnauthorized: false,
        headers: {
          Host: hostname,
          ...headers,
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          clearTimeout(timer);
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks),
          });
        });
        res.on("error", (e) => {
          clearTimeout(timer);
          reject(e);
        });
      },
    );
    req.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    req.write(body);
    req.end();
  });
}

/**
 * HTTPS POST 流式请求 — 逐块回调 (用于 GetChatMessage streaming)
 * onChunk(buffer) 在每次收到数据时调用
 * 返回 Promise<void>
 */
async function httpsPostStream(
  hostname,
  urlPath,
  body,
  headers = {},
  onChunk,
  timeoutMs = 180000,
) {
  const ip = await resolveHost(hostname);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      req.destroy();
      reject(new Error(`stream timeout ${timeoutMs}ms`));
    }, timeoutMs);
    const req = https.request(
      {
        host: ip,
        port: 443,
        path: urlPath,
        method: "POST",
        servername: hostname,
        rejectUnauthorized: false,
        headers: {
          Host: hostname,
          ...headers,
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        if (res.statusCode !== 200) {
          const chunks = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => {
            clearTimeout(timer);
            const errBody = Buffer.concat(chunks);
            let errMsg = `HTTP ${res.statusCode}`;
            try {
              // Connect-RPC error trailer
              const trailer = JSON.parse(errBody.toString("utf8"));
              errMsg = trailer.error?.message || trailer.error?.code || errMsg;
            } catch {
              // 尝试 Connect-RPC 帧解析
              if (errBody.length > 5 && errBody[0] === 0x02) {
                try {
                  const len = errBody.readUInt32BE(1);
                  const payload = errBody.slice(5, 5 + len);
                  const trailer = JSON.parse(payload.toString("utf8"));
                  errMsg =
                    trailer.error?.message || trailer.error?.code || errMsg;
                } catch {}
              }
            }
            reject(new Error(errMsg));
          });
          return;
        }
        res.on("data", (c) => {
          try {
            onChunk(c);
          } catch {}
        });
        res.on("end", () => {
          clearTimeout(timer);
          resolve();
        });
        res.on("error", (e) => {
          clearTimeout(timer);
          reject(e);
        });
      },
    );
    req.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    req.write(body);
    req.end();
  });
}

/** JSON HTTPS POST (用于 Firebase) */
async function httpsJson(hostname, urlPath, jsonBody, timeoutMs = 15000) {
  const data = JSON.stringify(jsonBody);
  const resp = await httpsPost(
    hostname,
    urlPath,
    data,
    {
      "Content-Type": "application/json",
    },
    timeoutMs,
  );
  return { status: resp.status, data: JSON.parse(resp.body.toString("utf8")) };
}

/** Connect-RPC protobuf POST (用于 RegisterUser, GetPlanStatus, CheckRateLimit) */
async function connectRpc(hostname, svcPath, protobufBody, timeoutMs = 15000) {
  return httpsPost(
    hostname,
    svcPath,
    protobufBody,
    {
      "Content-Type": "application/proto",
      "connect-protocol-version": "1",
    },
    timeoutMs,
  );
}

/** Connect-RPC 帧封装 (server-streaming: 请求需要 envelope framing) */
function connectFrame(protobufBody, flags = 0x00) {
  const header = Buffer.alloc(5);
  header[0] = flags;
  header.writeUInt32BE(protobufBody.length, 1);
  return Buffer.concat([header, protobufBody]);
}

/** Connect-RPC 流式 POST (用于 GetChatMessage — server-streaming RPC) */
async function connectRpcStream(
  hostname,
  svcPath,
  protobufBody,
  onChunk,
  timeoutMs = 180000,
) {
  const framedBody = connectFrame(protobufBody);
  return httpsPostStream(
    hostname,
    svcPath,
    framedBody,
    {
      "Content-Type": "application/connect+proto",
      "connect-protocol-version": "1",
    },
    onChunk,
    timeoutMs,
  );
}

/** Connect-RPC 非流式 POST (unary mode — application/proto, 无帧封装) */
async function connectRpcUnary(
  hostname,
  svcPath,
  protobufBody,
  timeoutMs = 60000,
) {
  return httpsPost(
    hostname,
    svcPath,
    protobufBody,
    {
      "Content-Type": "application/proto",
      "connect-protocol-version": "1",
    },
    timeoutMs,
  );
}

// ════════════════════════════════════════════════════════════════
// §4  Firebase 认证
// ════════════════════════════════════════════════════════════════

async function firebaseLogin(email, password) {
  for (const key of FIREBASE_KEYS) {
    try {
      const r = await httpsJson(
        "identitytoolkit.googleapis.com",
        `/v1/accounts:signInWithPassword?key=${key}`,
        {
          email,
          password,
          returnSecureToken: true,
          clientType: "CLIENT_TYPE_WEB",
        },
      );
      if (r.status === 200 && r.data.idToken) {
        return {
          ok: true,
          idToken: r.data.idToken,
          refreshToken: r.data.refreshToken,
          email: r.data.email || email,
          localId: r.data.localId,
        };
      }
    } catch {}
  }
  return { ok: false };
}

async function firebaseRefresh(refreshToken) {
  for (const key of FIREBASE_KEYS) {
    try {
      const r = await httpsJson(
        "securetoken.googleapis.com",
        `/v1/token?key=${key}`,
        { grant_type: "refresh_token", refresh_token: refreshToken },
      );
      if (r.status === 200 && r.data.id_token) {
        return {
          ok: true,
          idToken: r.data.id_token,
          refreshToken: r.data.refresh_token || refreshToken,
        };
      }
    } catch {}
  }
  return { ok: false };
}

// ════════════════════════════════════════════════════════════════
// §5  Windsurf Cloud API
// ════════════════════════════════════════════════════════════════

/** RegisterUser: idToken → apiKey (sk-ws-01-...) */
async function registerUser(idToken) {
  const reqBuf = encodeString(1, idToken);
  for (const host of REGISTER_HOSTS) {
    try {
      const r = await connectRpc(host, `${SVC_SEAT}/RegisterUser`, reqBuf);
      if (r.status === 200 && r.body.length > 10) {
        const apiKey = parseProtoString(r.body, 1);
        if (apiKey && apiKey.startsWith("sk-ws-")) return { apiKey, host };
      }
    } catch {}
  }
  return null;
}

/** GetPlanStatus: apiKey → 配额信息 */
async function getPlanStatus(apiKey) {
  const reqBuf = encodeString(1, apiKey);
  let lastErr = null;
  for (const host of API_HOSTS) {
    try {
      const r = await connectRpc(host, `${SVC_SEAT}/GetPlanStatus`, reqBuf);
      if (r.status === 200 && r.body.length > 5) {
        const fields = parseProto(r.body);
        return {
          host,
          dailyPercent: fields[14]?.[0]?.value ?? -1,
          weeklyPercent: fields[15]?.[0]?.value ?? -1,
          planTier: fields[18]?.[0]?.value ?? -1,
          isDevin: fields[17]?.[0]?.value === 1,
          raw: fields,
        };
      }
      // Non-200: parse error
      try {
        lastErr =
          JSON.parse(r.body.toString("utf8")).message || `HTTP ${r.status}`;
      } catch {
        lastErr = `HTTP ${r.status}`;
      }
    } catch (e) {
      lastErr = e.message;
    }
  }
  return { error: lastErr };
}

/** CheckUserMessageRateLimit: apiKey + model → 速率桶状态 */
async function checkRateLimit(apiKey, modelUid) {
  const inner = encodeString(1, apiKey);
  const reqBuf = Buffer.concat([
    encodeMessage(1, [inner]),
    encodeString(3, modelUid),
  ]);
  let lastErr = null;
  for (const host of API_HOSTS) {
    try {
      const r = await connectRpc(
        host,
        `${SVC_API}/CheckUserMessageRateLimit`,
        reqBuf,
      );
      if (r.status === 200 && r.body.length > 0) {
        const f = parseProto(r.body);
        return {
          host,
          hasCapacity: f[1]?.[0]?.value !== 0,
          messagesRemaining: f[3]?.[0]?.value ?? -1,
          maxMessages: f[4]?.[0]?.value ?? -1,
          resetsInSeconds: f[5]?.[0]?.value ?? 0,
        };
      }
      try {
        lastErr =
          JSON.parse(r.body.toString("utf8")).message || `HTTP ${r.status}`;
      } catch {
        lastErr = `HTTP ${r.status}`;
      }
    } catch (e) {
      lastErr = e.message;
    }
  }
  return { error: lastErr };
}

// ════════════════════════════════════════════════════════════════
// §6  GetChatMessage — 核心推理 (真正流式)
// ════════════════════════════════════════════════════════════════

/**
 * 构建 GetChatMessage 请求 protobuf
 * messages: [{ role: 'system'|'user'|'assistant', content: string }]
 */
function buildChatRequest(apiKey, modelUid, messages) {
  // source enum (exa.chat_pb.ChatMessageSource)
  //   0=UNSPECIFIED  1=USER  2=ASSISTANT  3=SYSTEM (待验证)
  const SOURCE_MAP = { user: 1, assistant: 2, system: 3 };
  const crypto = require("crypto");

  // ── exa.chat_pb.GetChatMessageRequest (逆向自 Windsurf extension.js v2.0.44) ──
  // F1  metadata (exa.codeium_common_pb.Metadata 内嵌)
  // F3  chat_messages (repeated ChatMessage)
  // F14 chat_model_name (scalar string, model UID)
  //
  // 内层 Metadata 字段号:
  //   F1=ide_name  F2=extension_version  F3=api_key  F4=locale
  //   F7=ide_version  F12=extension_name
  const meta = encodeMessage(1, [
    encodeString(1, CLIENT_META.ideName),
    encodeString(2, CLIENT_META.extensionVersion),
    encodeString(3, apiKey),
    encodeString(4, CLIENT_META.locale),
    encodeString(7, CLIENT_META.ideVersion),
    encodeString(12, CLIENT_META.extensionName),
  ]);

  // ChatMessage (outer F3 repeated):
  //   F1 message_id (required, UUID)  F2 source (enum)
  //   F10 request (exa.chat_pb.ChatMessagePrompt)
  // ChatMessagePrompt:
  //   F1 message_id  F2 source  F3 prompt (the actual text!)
  const msgBufs = messages.map((m) => {
    const source = SOURCE_MAP[m.role] ?? 1;
    const mid = crypto.randomUUID();
    const prompt = encodeMessage(10, [
      encodeString(1, mid),
      encodeVarintField(2, source),
      encodeString(3, m.content || ""),
    ]);
    return encodeMessage(3, [
      encodeString(1, mid),
      encodeVarintField(2, source),
      prompt,
    ]);
  });

  // F14: chat_model_name
  const model = encodeString(14, modelUid);

  return Buffer.concat([meta, ...msgBufs, model]);
}

/**
 * 提取 cognition.ai/* 元数据 (v179 a65d6c4e+ · 100 keys 中的会话能力键)
 * 递归扫 obj · 收集所有形如 "cognition.ai/<key>": value 的项
 * 道法自然: 不破已有协议 · 仅顺势采集已暴露之数
 */
function extractCognitionAiMeta(obj, depth = 0, out = {}) {
  if (depth > 6 || obj === null || typeof obj !== "object") return out;
  if (Array.isArray(obj)) {
    for (const item of obj) extractCognitionAiMeta(item, depth + 1, out);
    return out;
  }
  for (const k of Object.keys(obj)) {
    if (k.startsWith("cognition.ai/")) {
      out[k] = obj[k];
    } else if (typeof obj[k] === "object" && obj[k] !== null) {
      extractCognitionAiMeta(obj[k], depth + 1, out);
    }
  }
  return out;
}

/**
 * Connect-RPC 帧解析器
 * 流式输入 buffer chunks → 输出解析后的帧
 */
class ConnectFrameParser {
  constructor() {
    this.buf = Buffer.alloc(0);
  }

  /** 输入新数据, 返回已解析的帧数组 [{flags, payload}] */
  push(chunk) {
    this.buf = Buffer.concat([this.buf, chunk]);
    const frames = [];
    while (this.buf.length >= 5) {
      const flags = this.buf[0];
      const len = this.buf.readUInt32BE(1);
      if (this.buf.length < 5 + len) break;
      frames.push({ flags, payload: this.buf.slice(5, 5 + len) });
      this.buf = this.buf.slice(5 + len);
    }
    return frames;
  }
}

/**
 * 流式 GetChatMessage — 直连云端, 逐 token 回调
 *
 * @param {string} apiKey
 * @param {string} modelUid
 * @param {Array} messages  - [{role, content}]
 * @param {Function} onDelta - (text: string) => void  每个文本增量
 * @param {Object} [opts]
 * @param {number} [opts.timeoutMs=180000]
 * @returns {Promise<{text: string, tokens: number, quotaCostBp: number, model: string, host: string, durationMs: number, cognitionMeta: Object}>}
 */
async function chatStream(apiKey, modelUid, messages, onDelta, opts = {}) {
  const reqBuf = buildChatRequest(apiKey, modelUid, messages);
  const timeoutMs = opts.timeoutMs || 180000;
  const t0 = Date.now();

  let fullText = "";
  let tokens = 0,
    quotaCostBp = 0,
    errorMsg = null;
  let usedHost = null;
  // v179 cognition.ai/* 元数据 (inputTokens/outputTokens/cachedReadTokens/cacheTtl 等)
  let cognitionMeta = {};

  const parser = new ConnectFrameParser();

  function processChunk(chunk) {
    const frames = parser.push(chunk);
    for (const frame of frames) {
      if (frame.flags === 0x00) {
        // Data frame — protobuf { F1: text_delta, F25: tokens, F30: quotaCost }
        const fields = parseProto(frame.payload);
        if (fields[1]) {
          for (const entry of fields[1]) {
            if (entry.wire === 2) {
              const text = Buffer.from(entry.bytes).toString("utf8");
              if (text) {
                fullText += text;
                if (onDelta) onDelta(text);
              }
            }
          }
        }
        if (fields[25]?.[0]?.value) tokens = fields[25][0].value;
        if (fields[30]?.[0]?.value) quotaCostBp = fields[30][0].value;
      } else if (frame.flags === 0x02) {
        // End-stream trailer (JSON)
        try {
          const trailer = JSON.parse(frame.payload.toString("utf8"));
          if (trailer.error) {
            errorMsg =
              trailer.error.message || trailer.error.code || "Unknown error";
          }
          // v179: cognition.ai/* 元数据 trailer 内深扫
          Object.assign(cognitionMeta, extractCognitionAiMeta(trailer));
        } catch {}
      }
    }
  }

  // 尝试多个 host — 先 streaming (connect+proto), 失败则 unary (proto)
  // chat 专用 host 列表 (INFERENCE_HOSTS) · 与 seat 的 API_HOSTS 区分
  let lastErr = null;
  let tried = 0;
  for (const host of INFERENCE_HOSTS) {
    tried++;
    // ── 方式1: 流式 (application/connect+proto, framed) ──
    try {
      usedHost = host;
      fullText = "";
      tokens = 0;
      quotaCostBp = 0;
      errorMsg = null;
      cognitionMeta = {};
      parser.buf = Buffer.alloc(0);
      await connectRpcStream(
        host,
        `${SVC_LANG}/GetChatMessage`,
        reqBuf,
        processChunk,
        timeoutMs,
      );
      if (errorMsg) throw new Error(errorMsg);
      if (fullText.length > 0) break; // 成功
    } catch (e) {
      lastErr = e;
      if (
        e.message.includes("resource_exhausted") ||
        e.message.includes("rate") ||
        e.message.includes("quota")
      ) {
        throw e; // 配额/限流错误不需要重试其他 host
      }
      // ── 方式2: 该host的流式失败, 尝试 unary 模式 (application/proto, 无帧) ──
      try {
        const r = await connectRpcUnary(
          host,
          `${SVC_LANG}/GetChatMessage`,
          reqBuf,
          timeoutMs,
        );
        if (r.status === 200 && r.body.length > 10) {
          usedHost = host;
          // Unary 响应: 可能是 raw protobuf 或 Connect-RPC 帧
          let respBuf = r.body;
          // 检查是否有 Connect-RPC 帧头
          if (
            respBuf.length > 5 &&
            (respBuf[0] === 0x00 || respBuf[0] === 0x02)
          ) {
            // 解析所有帧
            const fp = new ConnectFrameParser();
            const allFrames = fp.push(respBuf);
            for (const frame of allFrames) {
              if (frame.flags === 0x00) {
                const fields = parseProto(frame.payload);
                if (fields[1]) {
                  for (const entry of fields[1]) {
                    if (entry.wire === 2) {
                      const text = Buffer.from(entry.bytes).toString("utf8");
                      if (text) fullText += text;
                    }
                  }
                }
                if (fields[25]?.[0]?.value) tokens = fields[25][0].value;
                if (fields[30]?.[0]?.value) quotaCostBp = fields[30][0].value;
              }
            }
          } else {
            // Raw protobuf 响应
            const fields = parseProto(respBuf);
            if (fields[1]) {
              for (const entry of fields[1]) {
                if (entry.wire === 2) {
                  const text = Buffer.from(entry.bytes).toString("utf8");
                  if (text) fullText += text;
                }
              }
            }
            if (fields[25]?.[0]?.value) tokens = fields[25][0].value;
            if (fields[30]?.[0]?.value) quotaCostBp = fields[30][0].value;
          }
          if (fullText) {
            // Unary 成功 — 一次性回调
            if (onDelta && fullText) onDelta(fullText);
            break;
          }
        }
      } catch (e2) {
        lastErr = e2;
      }
      continue;
    }
  }

  if (!fullText && lastErr) throw lastErr;

  return {
    text: fullText,
    tokens,
    quotaCostBp,
    model: modelUid,
    host: usedHost,
    durationMs: Date.now() - t0,
    cognitionMeta, // v179: {cognition.ai/inputTokens, cognition.ai/outputTokens, cognition.ai/cachedReadTokens, ...}
  };
}

/**
 * 同步 GetChatMessage — 等待完整响应
 */
async function chatSync(apiKey, modelUid, messages, opts = {}) {
  return chatStream(apiKey, modelUid, messages, null, opts);
}

// ════════════════════════════════════════════════════════════════
// §7  模型目录 (截至 2026-04, 98+ 模型)
// ════════════════════════════════════════════════════════════════

const MODEL_CATALOG = [
  // ── Screenshot 中的模型 (用户当前可选) ──
  {
    uid: "claude-opus-4-6-thinking",
    name: "Claude Opus 4.6 Thinking",
    cost: 8,
    ctx: 200000,
    tier: "$$$",
  },
  {
    uid: "MODEL_SWE_1_5",
    name: "SWE-1.5 Fast",
    cost: 0.5,
    ctx: 128000,
    tier: "$",
  },
  { uid: "kimi-k2-5", name: "Kimi K2.5", cost: 1, ctx: 262144, tier: "Free" },
  {
    uid: "MODEL_SWE_1_5_SLOW",
    name: "SWE-1.5",
    cost: 0,
    ctx: 200000,
    tier: "Free",
  },
  {
    uid: "gpt-5-4-low",
    name: "GPT-5.4 Low Thinking",
    cost: 1.5,
    ctx: 272000,
    tier: "$$$",
  },
  {
    uid: "claude-sonnet-4-6-thinking",
    name: "Claude Sonnet 4.6 Thinking",
    cost: 6,
    ctx: 200000,
    tier: "$$$",
  },
  // ── Claude 系列 ──
  {
    uid: "claude-opus-4-6",
    name: "Claude Opus 4.6",
    cost: 6,
    ctx: 200000,
    tier: "$$$",
  },
  {
    uid: "claude-sonnet-4-6",
    name: "Claude Sonnet 4.6",
    cost: 4,
    ctx: 200000,
    tier: "$$$",
  },
  {
    uid: "claude-sonnet-4-6-1m",
    name: "Claude Sonnet 4.6 1M",
    cost: 12,
    ctx: 1000000,
    tier: "$$$",
  },
  {
    uid: "claude-sonnet-4-6-thinking-1m",
    name: "Claude Sonnet 4.6 Thinking 1M",
    cost: 16,
    ctx: 1000000,
    tier: "$$$",
  },
  {
    uid: "MODEL_CLAUDE_4_5_OPUS",
    name: "Claude Opus 4.5",
    cost: 4,
    ctx: 200000,
    tier: "$$$",
  },
  {
    uid: "MODEL_CLAUDE_4_5_OPUS_THINKING",
    name: "Claude Opus 4.5 Thinking",
    cost: 5,
    ctx: 200000,
    tier: "$$$",
  },
  {
    uid: "MODEL_PRIVATE_2",
    name: "Claude Sonnet 4.5",
    cost: 2,
    ctx: 200000,
    tier: "$$$",
  },
  {
    uid: "MODEL_PRIVATE_3",
    name: "Claude Sonnet 4.5 Thinking",
    cost: 3,
    ctx: 200000,
    tier: "$$$",
  },
  {
    uid: "MODEL_PRIVATE_25",
    name: "Claude Sonnet 4.5 1M",
    cost: 10,
    ctx: 1000000,
    tier: "$$$",
  },
  {
    uid: "MODEL_CLAUDE_4_SONNET",
    name: "Claude Sonnet 4",
    cost: 2,
    ctx: 200000,
    tier: "$$$",
  },
  {
    uid: "MODEL_CLAUDE_4_SONNET_THINKING",
    name: "Claude Sonnet 4 Thinking",
    cost: 3,
    ctx: 200000,
    tier: "$$$",
  },
  {
    uid: "MODEL_PRIVATE_11",
    name: "Claude Haiku 4.5",
    cost: 1,
    ctx: 200000,
    tier: "$$",
  },
  // ── GPT-5.4 系列 ──
  {
    uid: "gpt-5-4-none",
    name: "GPT-5.4 No Thinking",
    cost: 1.5,
    ctx: 272000,
    tier: "$$$",
  },
  {
    uid: "gpt-5-4-medium",
    name: "GPT-5.4 Medium Thinking",
    cost: 3,
    ctx: 272000,
    tier: "$$$",
  },
  {
    uid: "gpt-5-4-high",
    name: "GPT-5.4 High Thinking",
    cost: 4,
    ctx: 272000,
    tier: "$$$",
  },
  {
    uid: "gpt-5-4-xhigh",
    name: "GPT-5.4 XHigh Thinking",
    cost: 12,
    ctx: 272000,
    tier: "$$$",
  },
  {
    uid: "gpt-5-4-mini-low",
    name: "GPT-5.4 Mini Low Thinking",
    cost: 1.5,
    ctx: 400000,
    tier: "$",
  },
  {
    uid: "gpt-5-4-mini-medium",
    name: "GPT-5.4 Mini Medium Thinking",
    cost: 1.5,
    ctx: 400000,
    tier: "$",
  },
  // ── GPT-5.3-Codex ──
  {
    uid: "gpt-5-3-codex-low",
    name: "GPT-5.3-Codex Low",
    cost: 1.5,
    ctx: 400000,
    tier: "$$",
  },
  {
    uid: "gpt-5-3-codex-medium",
    name: "GPT-5.3-Codex Medium",
    cost: 2,
    ctx: 400000,
    tier: "$$",
  },
  {
    uid: "gpt-5-3-codex-high",
    name: "GPT-5.3-Codex High",
    cost: 2.5,
    ctx: 400000,
    tier: "$$",
  },
  // ── GPT-5.2 ──
  {
    uid: "MODEL_GPT_5_2_LOW",
    name: "GPT-5.2 Low Thinking",
    cost: 1,
    ctx: 384000,
    tier: "$$",
  },
  {
    uid: "MODEL_GPT_5_2_MEDIUM",
    name: "GPT-5.2 Medium Thinking",
    cost: 2,
    ctx: 384000,
    tier: "$$",
  },
  {
    uid: "MODEL_GPT_5_2_HIGH",
    name: "GPT-5.2 High Thinking",
    cost: 3,
    ctx: 384000,
    tier: "$$",
  },
  {
    uid: "MODEL_GPT_5_2_NONE",
    name: "GPT-5.2 No Thinking",
    cost: 1,
    ctx: 384000,
    tier: "$$",
  },
  // ── GPT-5.1 ──
  {
    uid: "MODEL_PRIVATE_12",
    name: "GPT-5.1 No Thinking",
    cost: 0.5,
    ctx: 384000,
    tier: "$$",
  },
  {
    uid: "MODEL_PRIVATE_13",
    name: "GPT-5.1 Low Thinking",
    cost: 0.5,
    ctx: 384000,
    tier: "$$",
  },
  {
    uid: "MODEL_PRIVATE_14",
    name: "GPT-5.1 Medium Thinking",
    cost: 1,
    ctx: 384000,
    tier: "$$",
  },
  // ── GPT-5 / Codex ──
  {
    uid: "MODEL_PRIVATE_6",
    name: "GPT-5 Low Thinking",
    cost: 0.5,
    ctx: 384000,
    tier: "$$",
  },
  {
    uid: "MODEL_CHAT_GPT_5_CODEX",
    name: "GPT-5-Codex",
    cost: 0.5,
    ctx: 400000,
    tier: "$$",
  },
  // ── GPT-4.1 / GPT-4o ──
  {
    uid: "MODEL_CHAT_GPT_4_1_2025_04_14",
    name: "GPT-4.1",
    cost: 1,
    ctx: 1047576,
    tier: "$$",
  },
  {
    uid: "MODEL_CHAT_GPT_4O_2024_08_06",
    name: "GPT-4o",
    cost: 1,
    ctx: 128000,
    tier: "$$",
  },
  // ── o3 ──
  { uid: "MODEL_CHAT_O3", name: "o3", cost: 1, ctx: 200000, tier: "$$" },
  {
    uid: "MODEL_CHAT_O3_HIGH",
    name: "o3 High Reasoning",
    cost: 1,
    ctx: 200000,
    tier: "$$",
  },
  // ── Google Gemini ──
  {
    uid: "MODEL_GOOGLE_GEMINI_2_5_PRO",
    name: "Gemini 2.5 Pro",
    cost: 1,
    ctx: 1048576,
    tier: "$$",
  },
  {
    uid: "gemini-3-1-pro-low",
    name: "Gemini 3.1 Pro Low Thinking",
    cost: 1,
    ctx: 1048576,
    tier: "$$$",
  },
  {
    uid: "gemini-3-1-pro-high",
    name: "Gemini 3.1 Pro High Thinking",
    cost: 2,
    ctx: 1048576,
    tier: "$$$",
  },
  {
    uid: "MODEL_GOOGLE_GEMINI_3_0_FLASH_LOW",
    name: "Gemini 3 Flash Low",
    cost: 1,
    ctx: 1048576,
    tier: "$",
  },
  {
    uid: "MODEL_GOOGLE_GEMINI_3_0_FLASH_MEDIUM",
    name: "Gemini 3 Flash Medium",
    cost: 1,
    ctx: 1048576,
    tier: "$",
  },
  // ── xAI ──
  {
    uid: "MODEL_XAI_GROK_3",
    name: "xAI Grok-3",
    cost: 1,
    ctx: 131072,
    tier: "$$$",
  },
  {
    uid: "MODEL_XAI_GROK_3_MINI_REASONING",
    name: "xAI Grok-3 Mini Thinking",
    cost: 0.125,
    ctx: 131072,
    tier: "$",
  },
  // ── Kimi ──
  { uid: "MODEL_KIMI_K2", name: "Kimi K2", cost: 0.5, ctx: 128000, tier: "$" },
  // ── 其他 ──
  {
    uid: "MODEL_PRIVATE_4",
    name: "Grok Code Fast 1",
    cost: 0.5,
    ctx: 256000,
    tier: "$",
  },
  { uid: "glm-5", name: "GLM-5", cost: 1.5, ctx: 128000, tier: "$" },
  { uid: "MODEL_GLM_4_7", name: "GLM 4.7", cost: 0.25, ctx: 200000, tier: "$" },
  {
    uid: "MODEL_MINIMAX_M2_1",
    name: "Minimax M2.1",
    cost: 0.5,
    ctx: 204800,
    tier: "$",
  },
  {
    uid: "minimax-m2-5",
    name: "Minimax M2.5",
    cost: 1,
    ctx: 204800,
    tier: "$",
  },
  {
    uid: "MODEL_CHAT_11121",
    name: "Windsurf Fast",
    cost: 0,
    ctx: 0,
    tier: "$",
  },
];

/** 友好别名 → 模型 UID 映射 */
const MODEL_ALIASES = {};
for (const m of MODEL_CATALOG) {
  const lower = m.name.toLowerCase().replace(/[\s-]+/g, "-");
  MODEL_ALIASES[lower] = m.uid;
  MODEL_ALIASES[m.uid.toLowerCase()] = m.uid;
  // 简短别名
  const short = m.name.toLowerCase().replace(/[\s]+/g, "-");
  MODEL_ALIASES[short] = m.uid;
}
// 手工常用别名
Object.assign(MODEL_ALIASES, {
  default: "claude-sonnet-4-6-thinking",
  "claude-opus": "claude-opus-4-6-thinking",
  "claude-opus-4.6": "claude-opus-4-6-thinking",
  opus: "claude-opus-4-6-thinking",
  sonnet: "claude-sonnet-4-6-thinking",
  "claude-sonnet": "claude-sonnet-4-6-thinking",
  "claude-sonnet-4.6": "claude-sonnet-4-6-thinking",
  swe: "MODEL_SWE_1_5",
  "swe-1.5": "MODEL_SWE_1_5",
  kimi: "kimi-k2-5",
  "kimi-k2.5": "kimi-k2-5",
  "gpt-5.4": "gpt-5-4-low",
  "gpt-5.4-low": "gpt-5-4-low",
  "gpt-4.1": "MODEL_CHAT_GPT_4_1_2025_04_14",
  "gpt-4o": "MODEL_CHAT_GPT_4O_2024_08_06",
  "gpt-5.2": "MODEL_GPT_5_2_LOW",
  "gpt-5.1": "MODEL_PRIVATE_12",
  gemini: "MODEL_GOOGLE_GEMINI_2_5_PRO",
  "gemini-2.5-pro": "MODEL_GOOGLE_GEMINI_2_5_PRO",
  grok: "MODEL_XAI_GROK_3",
  o3: "MODEL_CHAT_O3",
  haiku: "MODEL_PRIVATE_11",
  glm: "glm-5",
});

function resolveModel(name) {
  if (!name || name === "default") return MODEL_ALIASES["default"];
  // 直接匹配 UID
  const direct = MODEL_CATALOG.find((m) => m.uid === name);
  if (direct) return direct.uid;
  // 别名
  const lower = name.toLowerCase();
  if (MODEL_ALIASES[lower]) return MODEL_ALIASES[lower];
  // 模糊匹配
  const fuzzy = MODEL_CATALOG.find(
    (m) =>
      m.name.toLowerCase().includes(lower) ||
      m.uid.toLowerCase().includes(lower),
  );
  if (fuzzy) return fuzzy.uid;
  // 原样返回 (服务端验证)
  return name;
}

// ════════════════════════════════════════════════════════════════
// §8  CloudClient — 主客户端类
// ════════════════════════════════════════════════════════════════

class CloudClient {
  /**
   * @param {Object} config
   * @param {string} [config.apiKey]         - 直接提供 apiKey (sk-ws-01-...)
   * @param {string} [config.email]          - Firebase 邮箱 (需配合 password)
   * @param {string} [config.password]       - Firebase 密码
   * @param {string} [config.refreshToken]   - Firebase refreshToken (续命用)
   */
  constructor(config = {}) {
    this.apiKey = config.apiKey || null;
    this.email = config.email || null;
    this.password = config.password || null;
    this.refreshToken = config.refreshToken || null;
    this.idToken = null;
    this.plan = null;
    this.authenticated = false;
  }

  /** 认证 — 获取 apiKey */
  async authenticate() {
    // 方式1: apiKey 直传
    if (this.apiKey && this.apiKey.startsWith("sk-ws-")) {
      this.authenticated = true;
      return;
    }

    // 方式2: refreshToken → 新 idToken → RegisterUser → apiKey
    if (this.refreshToken && !this.idToken) {
      const refresh = await firebaseRefresh(this.refreshToken);
      if (refresh.ok) {
        this.idToken = refresh.idToken;
        this.refreshToken = refresh.refreshToken;
      }
    }

    // 方式3: email + password → Firebase login → idToken
    if (!this.idToken && this.email && this.password) {
      const login = await firebaseLogin(this.email, this.password);
      if (login.ok) {
        this.idToken = login.idToken;
        this.refreshToken = login.refreshToken;
        this.email = login.email;
      } else {
        throw new Error("Firebase login failed — check email/password");
      }
    }

    if (!this.idToken && !this.apiKey) {
      throw new Error(
        "No credentials — provide apiKey, or email+password, or refreshToken",
      );
    }

    // idToken → RegisterUser → apiKey
    if (this.idToken && !this.apiKey) {
      const reg = await registerUser(this.idToken);
      if (reg) {
        this.apiKey = reg.apiKey;
      } else {
        throw new Error("RegisterUser failed — idToken may be expired");
      }
    }

    this.authenticated = true;
  }

  /** 刷新认证 (refreshToken → 新 idToken → 新 apiKey) */
  async refresh() {
    if (!this.refreshToken) return false;
    const r = await firebaseRefresh(this.refreshToken);
    if (!r.ok) return false;
    this.idToken = r.idToken;
    this.refreshToken = r.refreshToken;
    const reg = await registerUser(this.idToken);
    if (reg) {
      this.apiKey = reg.apiKey;
      return true;
    }
    return false;
  }

  /** 获取账户配额状态 */
  async getUserStatus() {
    if (!this.apiKey) throw new Error("Not authenticated");
    const result = await getPlanStatus(this.apiKey);
    if (result && !result.error) this.plan = result;
    return result;
  }

  /** 检查模型速率限制 */
  async checkRateLimit(model) {
    if (!this.apiKey) throw new Error("Not authenticated");
    return checkRateLimit(this.apiKey, resolveModel(model));
  }

  /**
   * 流式对话 — 核心方法
   * @param {Array} messages  - [{role: 'system'|'user'|'assistant', content: string}]
   * @param {string} model    - 模型名称/UID/别名
   * @param {Object} [opts]
   * @param {Function} [opts.onDelta]    - (text: string) => void
   * @param {number}   [opts.timeoutMs]  - 超时 (默认 180s)
   * @returns {Promise<{text, tokens, quotaCostBp, model, host, durationMs}>}
   */
  async chat(messages, model, opts = {}) {
    if (!this.apiKey) await this.authenticate();
    const modelUid = resolveModel(model);
    try {
      return await chatStream(
        this.apiKey,
        modelUid,
        messages,
        opts.onDelta,
        opts,
      );
    } catch (e) {
      // 401/unauthenticated → 尝试刷新
      if (
        (e.message.includes("unauthenticated") || e.message.includes("401")) &&
        this.refreshToken
      ) {
        const ok = await this.refresh();
        if (ok)
          return chatStream(
            this.apiKey,
            modelUid,
            messages,
            opts.onDelta,
            opts,
          );
      }
      throw e;
    }
  }

  /** 同步对话 (等待完整响应) */
  async chatSync(messages, model, opts = {}) {
    return this.chat(messages, model, { ...opts, onDelta: null });
  }

  /** 获取模型列表 */
  getModels() {
    return MODEL_CATALOG.map((m) => ({
      id: m.uid,
      name: m.name,
      cost: m.cost,
      context: m.ctx,
      tier: m.tier,
    }));
  }

  close() {
    /* 无持久连接需要关闭 */
  }
}

// ════════════════════════════════════════════════════════════════
// §9  配置加载
// ════════════════════════════════════════════════════════════════

/** 从 secrets.env 或环境变量加载配置 */
function loadConfig(envFile) {
  const config = {};

  // 1. 尝试读 secrets.env
  const candidates = [
    envFile,
    path.join(__dirname, "..", "secrets.env"),
    path.join(__dirname, "..", ".env"),
  ].filter(Boolean);

  for (const f of candidates) {
    if (fs.existsSync(f)) {
      const lines = fs.readFileSync(f, "utf8").split("\n");
      for (const line of lines) {
        const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
        if (m) config[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
      break;
    }
  }

  // 2. 环境变量覆盖
  const env = process.env;
  return {
    apiKey: env.WINDSURF_API_KEY || config.WINDSURF_API_KEY || null,
    email: env.WINDSURF_EMAIL || config.WINDSURF_EMAIL || null,
    password: env.WINDSURF_PASSWORD || config.WINDSURF_PASSWORD || null,
    refreshToken:
      env.WINDSURF_REFRESH_TOKEN || config.WINDSURF_REFRESH_TOKEN || null,
  };
}

// ════════════════════════════════════════════════════════════════
// §10  PoolClient — 多Key轮转 + 自动续命 (反者道之动)
// ════════════════════════════════════════════════════════════════

/**
 * 多Key池化客户端 — 轮转多个 apiKey 以突破单账号速率限制
 *
 * @example
 *   const pool = new PoolClient([
 *     { apiKey: 'sk-ws-01-aaa...' },
 *     { apiKey: 'sk-ws-01-bbb...' },
 *   ]);
 *   const result = await pool.chat(messages, 'sonnet', { onDelta: t => process.stdout.write(t) });
 */
class PoolClient {
  /**
   * @param {Array<Object>} accounts - [{apiKey, email, password, refreshToken}]
   * @param {Object} [opts]
   * @param {number} [opts.cooldownMs=60000] — rate-limit cooldown per key
   * @param {boolean} [opts.autoRefresh=true] — auto-refresh expired keys
   */
  constructor(accounts = [], opts = {}) {
    this.cooldownMs = opts.cooldownMs || 60000;
    this.autoRefresh = opts.autoRefresh !== false;
    this.slots = accounts.map((a) => ({
      client: new CloudClient(a),
      blocked: false,
      blockedUntil: 0,
      requests: 0,
      errors: 0,
      lastUse: 0,
    }));
    this.idx = 0;
    this.authenticated = false;
  }

  /** Load from keypool.json / secrets.env array / env */
  static fromFile(filePath) {
    if (!fs.existsSync(filePath)) return null;
    try {
      const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
      const arr = Array.isArray(raw) ? raw : raw.keys || raw.pool || [];
      const accounts = arr
        .map((k) =>
          typeof k === "string"
            ? { apiKey: k }
            : {
                apiKey: k.api_key || k.apiKey || k.key,
                refreshToken: k.refreshToken,
              },
        )
        .filter((a) => a.apiKey && a.apiKey.startsWith("sk-"));
      if (!accounts.length) return null;
      return new PoolClient(accounts);
    } catch {
      return null;
    }
  }

  /** Authenticate all keys that need it */
  async authenticate() {
    const results = await Promise.allSettled(
      this.slots.map((s) => s.client.authenticate()),
    );
    const ok = results.filter((r) => r.status === "fulfilled").length;
    if (ok === 0)
      throw new Error("PoolClient: all keys failed to authenticate");
    this.authenticated = true;
    return ok;
  }

  /** Pick the next available slot (round-robin, skip blocked) */
  _pick() {
    const now = Date.now();
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[(this.idx + i) % this.slots.length];
      if (!slot.blocked || now >= slot.blockedUntil) {
        slot.blocked = false;
        this.idx = (this.idx + i + 1) % this.slots.length;
        return slot;
      }
    }
    // All blocked — find the one that unblocks soonest
    const earliest = this.slots.reduce((a, b) =>
      a.blockedUntil < b.blockedUntil ? a : b,
    );
    earliest.blocked = false;
    return earliest;
  }

  /** Mark a slot as rate-limited */
  _block(slot) {
    slot.blocked = true;
    slot.blockedUntil = Date.now() + this.cooldownMs;
    slot.errors++;
  }

  /** Chat with automatic key rotation on rate-limit */
  async chat(messages, model, opts = {}) {
    let lastErr = null;
    const tried = new Set();
    while (tried.size < this.slots.length) {
      const slot = this._pick();
      tried.add(slot);
      slot.requests++;
      slot.lastUse = Date.now();
      try {
        const r = await slot.client.chat(messages, model, opts);
        return r;
      } catch (e) {
        lastErr = e;
        if (
          e.message.includes("rate") ||
          e.message.includes("quota") ||
          e.message.includes("resource_exhausted")
        ) {
          this._block(slot);
          // Try auto-refresh if available
          if (this.autoRefresh && slot.client.refreshToken) {
            try {
              await slot.client.refresh();
            } catch {}
          }
          continue; // rotate to next key
        }
        if (
          e.message.includes("unauthenticated") ||
          e.message.includes("401")
        ) {
          if (slot.client.refreshToken) {
            try {
              await slot.client.refresh();
              return await slot.client.chat(messages, model, opts);
            } catch {}
          }
          this._block(slot);
          continue;
        }
        throw e; // non-recoverable error
      }
    }
    throw lastErr || new Error("PoolClient: all keys exhausted");
  }

  /** Sync chat (non-streaming) */
  async chatSync(messages, model, opts = {}) {
    return this.chat(messages, model, { ...opts, onDelta: null });
  }

  /** Get models from the first working client */
  getModels() {
    const slot = this.slots.find((s) => s.client.authenticated);
    return slot ? slot.client.getModels() : [];
  }

  /** Get combined status of all keys */
  async getPoolStatus() {
    const results = [];
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i];
      const keyPreview = s.client.apiKey
        ? s.client.apiKey.substring(0, 15) + "..."
        : "(none)";
      let plan = null;
      try {
        plan = await s.client.getUserStatus();
      } catch {}
      results.push({
        index: i,
        apiKey: keyPreview,
        blocked: s.blocked,
        requests: s.requests,
        errors: s.errors,
        daily: plan?.dailyPercent ?? -1,
        weekly: plan?.weeklyPercent ?? -1,
      });
    }
    return results;
  }

  get apiKey() {
    return this.slots[this.idx % this.slots.length]?.client.apiKey;
  }
  get plan() {
    return this.slots[this.idx % this.slots.length]?.client.plan;
  }
  async getUserStatus() {
    return this.slots[this.idx % this.slots.length]?.client.getUserStatus();
  }
  close() {
    this.slots.forEach((s) => s.client.close());
  }
}

// ════════════════════════════════════════════════════════════════
// §11  自测 (node cloud_engine.js --test)
// ════════════════════════════════════════════════════════════════

async function selfTest() {
  console.log("═══ 万法归宗 · 独立云端引擎 · 自测 ═══\n");

  const config = loadConfig();
  if (!config.apiKey && !config.email && !config.refreshToken) {
    console.error("[FATAL] 未找到凭据。创建 secrets.env 或设置环境变量:");
    console.error("  WINDSURF_API_KEY=sk-ws-01-...");
    console.error("  或 WINDSURF_EMAIL=... + WINDSURF_PASSWORD=...");
    process.exit(1);
  }

  const client = new CloudClient(config);

  // Step 1: 认证
  console.log("[1] 认证...");
  const t0 = Date.now();
  await client.authenticate();
  console.log(
    `  ✅ ${Date.now() - t0}ms — apiKey: ${client.apiKey.substring(0, 25)}...`,
  );

  // Step 2: 配额
  console.log("\n[2] 配额...");
  const t1 = Date.now();
  const plan = await client.getUserStatus();
  if (plan && !plan.error) {
    console.log(
      `  ✅ ${Date.now() - t1}ms — daily=${plan.dailyPercent}% weekly=${plan.weeklyPercent}% tier=${plan.planTier} (via ${plan.host})`,
    );
  } else {
    console.log(`  ⚠ 无法获取配额 — ${plan?.error || "unknown"}`);
  }

  // Step 3: 速率桶
  console.log("\n[3] CheckRateLimit (SWE-1.5)...");
  const t2 = Date.now();
  const rl = await client.checkRateLimit("swe");
  if (rl && !rl.error) {
    console.log(
      `  ✅ ${Date.now() - t2}ms — capacity=${rl.hasCapacity} remaining=${rl.messagesRemaining}/${rl.maxMessages}`,
    );
  } else {
    console.log(`  ⚠ 速率桶查询失败 — ${rl?.error || "unknown"}`);
  }

  // Step 4: 流式对话
  const model = process.argv[3] || "MODEL_SWE_1_5";
  const prompt = process.argv[4] || "Reply with exactly one word: hello";
  console.log(`\n[4] Chat (${model})...`);
  process.stdout.write("  ");
  const result = await client.chat([{ role: "user", content: prompt }], model, {
    onDelta: (t) => process.stdout.write(t),
  });
  console.log(
    `\n  ✅ ${result.durationMs}ms — ${result.text.length}ch, ${result.tokens}tok, ${result.quotaCostBp}bp (via ${result.host})`,
  );

  const pass = result.text.length > 0;
  console.log(
    `\n${pass ? "✅ PASS" : "❌ FAIL"} — 独立云端引擎${pass ? "正常" : "异常"}`,
  );
  process.exit(pass ? 0 : 1);
}

if (require.main === module && process.argv.includes("--test")) {
  selfTest().catch((e) => {
    console.error(`[FATAL] ${e.message}`);
    process.exit(1);
  });
}

// ════════════════════════════════════════════════════════════════
// §11  Exports
// ════════════════════════════════════════════════════════════════

module.exports = {
  CloudClient,
  PoolClient,
  loadConfig,
  resolveModel,
  MODEL_CATALOG,
  MODEL_ALIASES,
  // 底层 API (高级用途)
  firebaseLogin,
  firebaseRefresh,
  registerUser,
  getPlanStatus,
  checkRateLimit,
  chatStream,
  chatSync,
  buildChatRequest,
  ConnectFrameParser,
  parseProto,
  parseProtoString,
  encodeString,
  encodeMessage,
  encodeVarintField,
};
