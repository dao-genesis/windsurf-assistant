"use strict";
/**
 * http.js · HTTP/HTTPS 请求底座
 * ─────────────────────────────────
 * 零依赖的 fetch 样式请求 + 流式响应迭代 + 429/503 自愈重试 (上游限流时透明退避).
 *
 * 道: 民之难治, 以其上之有为 · 网关替客户端扛住"短暂不可用", 客户端感觉不到抖动.
 */

const http = require("http");
const https = require("https");
const dns = require("dns");
const { URL } = require("url");

// 道 · 自有 dns lookup: 永远返单一 IPv4, 让 Node 走"单 IP TLS 路径".
// 走 OS getaddrinfo (尊重 hosts 文件) 而非 dns.resolve* (走 DNS server, 不读 hosts).
// 修 Node Happy Eyeballs 在多 A 记录 hosts pin 场景下 SNI 退化, 服务端回 github.com
// 默认证书引发 ERR_TLS_CERT_ALTNAME_INVALID 的疑难问题.
function pinnedLookup(hostname, options, callback) {
  const cb = typeof options === "function" ? options : callback;
  const family = (options && options.family) || 4;
  dns.lookup(hostname, { family, all: false }, (err, address, fam) => {
    if (err) return cb(err);
    // 即使上层要 all, 也强制返单一以避免 Happy Eyeballs 并发干扰 SNI.
    if (options && options.all) {
      return cb(null, [{ address, family: fam || family }]);
    }
    cb(null, address, fam || family);
  });
}

// 一次真正的 HTTP 调用 (不含重试)
function requestOnce({
  url,
  method = "POST",
  headers = {},
  body,
  timeout = 120000,
  signal,
} = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const mod = u.protocol === "https:" ? https : http;
    const opts = {
      method,
      hostname: u.hostname,
      port: u.port || (u.protocol === "https:" ? 443 : 80),
      path: u.pathname + u.search,
      headers: { ...headers },
      timeout,
    };
    // 道 · 显式发 SNI · 显式 lookup 返单一 IPv4 · family=4:
    // 当 hosts pin 改了 DNS, Node 默认 servername 在 Happy Eyeballs 多 IP 场景下退化,
    // 服务端会回默认证书 (如 github.com 主站) 导致 ERR_TLS_CERT_ALTNAME_INVALID.
    // 三件套合一才修: servername 强制 SNI · lookup 强制单 IP · family 锁 IPv4.
    if (u.protocol === "https:") {
      opts.servername = u.hostname;
      opts.lookup = pinnedLookup;
      opts.family = 4;
    }
    if (
      body &&
      !opts.headers["Content-Length"] &&
      !opts.headers["content-length"]
    ) {
      opts.headers["Content-Length"] = Buffer.byteLength(body);
    }
    const req = mod.request(opts, (res) => {
      resolve({
        status: res.statusCode,
        headers: res.headers,
        body: res, // Node Readable
        async text() {
          let s = "";
          for await (const c of res) s += c.toString();
          return s;
        },
        async json() {
          const t = await this.text();
          try {
            return JSON.parse(t);
          } catch (e) {
            throw new Error(`JSON parse error · raw: ${t.slice(0, 200)}`);
          }
        },
      });
    });
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy(new Error(`Request timeout after ${timeout}ms`));
    });
    if (signal) {
      signal.addEventListener?.("abort", () => {
        try {
          req.destroy(new Error("Aborted"));
        } catch {}
      });
    }
    if (body) req.write(body);
    req.end();
  });
}

// 解析 Retry-After 头 (秒 或 HTTP-date)
function parseRetryAfter(h) {
  if (!h) return 0;
  const n = Number(h);
  if (!isNaN(n)) return Math.max(0, Math.min(30, n)) * 1000; // 封顶 30s
  const t = Date.parse(h);
  if (!isNaN(t)) return Math.max(0, Math.min(30000, t - Date.now()));
  return 0;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * 对外暴露的 request 版本: 只有对"非流式 + 非 body-stream 读取" 场景才透明重试 429/503.
 * 因为重试一个已开始被外部 pipe 的流不安全 · 所以当调用方要读 body stream 时, 我们让首次响应直接回去.
 *
 * 触发重试的条件:
 *   · status = 429 or 503
 *   · 且调用方未禁用 (noRetry=true)
 *   · 已尝试次数 < maxRetries (默认 3)
 *
 * 退避: 优先用 Retry-After · 否则 base*2^n + jitter
 */
async function request(opts) {
  const { noRetry = false, maxRetries = 3, backoffBaseMs = 400 } = opts;
  let lastResp = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const resp = await requestOnce(opts);
    lastResp = resp;
    // 只有 429 / 503 (服务器自己说 "稍等重试")才重试
    const retryable = resp.status === 429 || resp.status === 503;
    if (noRetry || !retryable || attempt === maxRetries) {
      return resp;
    }
    // 必须把 body 读完 (以释放 socket)
    try {
      await resp.text();
    } catch {}
    // 计算等多久
    const ra = parseRetryAfter(resp.headers?.["retry-after"]);
    const jitter = Math.floor(Math.random() * 250);
    const wait = ra || backoffBaseMs * Math.pow(2, attempt) + jitter;
    await sleep(wait);
  }
  return lastResp;
}

module.exports = { request, requestOnce, parseRetryAfter };
