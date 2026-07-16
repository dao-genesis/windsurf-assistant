"use strict";
// 内置浏览器 · 站内代理(归一插件 /__web 同技术自持实现):
// GET /web?u=<绝对URL>&t=<token> → 服务端取回目标页, 剥 X-Frame-Options/CSP 后直出,
// HTML 注入 <base> 与链接/表单拦截脚本(绝对跳转续走本代理), 供 webview iframe 内嵌。
// 安全: 仅 127.0.0.1 消费; token 经 query 校验(iframe 无法带 header); 绝不回传本机凭据。
const http = require("http");
const https = require("https");

const MAX_REDIRECTS = 5;

function isHttpUrl(u) {
  try { const x = new URL(u); return x.protocol === "http:" || x.protocol === "https:"; } catch (_) { return false; }
}

// 注入脚本: 绝对 http(s) 链接/表单/location 跳转改写回 /web?u=(同 wam /__web 拦截语义)。
function interceptScript(prefix) {
  return "<script>(function(){var P=" + JSON.stringify(prefix) + ";" +
    "function w(u){try{var a=new URL(u,document.baseURI);if(a.protocol==='http:'||a.protocol==='https:')return P+encodeURIComponent(a.href);}catch(e){}return u;}" +
    "document.addEventListener('click',function(e){var a=e.target&&e.target.closest?e.target.closest('a[href]'):null;if(!a)return;var h=a.getAttribute('href')||'';if(/^(javascript:|#|mailto:)/i.test(h))return;e.preventDefault();location.href=w(a.href);},true);" +
    "document.addEventListener('submit',function(e){var f=e.target;if(f&&f.action&&(f.method||'get').toLowerCase()==='get'){e.preventDefault();var q=new URLSearchParams(new FormData(f)).toString();var u=f.action.split('?')[0]+'?'+q;location.href=w(u);}},true);" +
    "})();</script>";
}

// 取回目标(带重定向追踪), 回调 (err, {status, headers, body: Buffer, finalUrl})。
function fetchUrl(target, depth, cb) {
  if (depth > MAX_REDIRECTS) return cb(new Error("重定向过深"));
  let x; try { x = new URL(target); } catch (e) { return cb(e); }
  const mod = x.protocol === "https:" ? https : http;
  const req = mod.request(x, {
    method: "GET",
    headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) dao-desktop-web-embed", "Accept": "*/*", "Accept-Encoding": "identity" },
  }, (r) => {
    const loc = r.headers.location;
    if (r.statusCode >= 301 && r.statusCode <= 308 && loc) {
      r.resume();
      return fetchUrl(new URL(loc, x).href, depth + 1, cb);
    }
    const chunks = [];
    let n = 0;
    r.on("data", (c) => { n += c.length; if (n > 15e6) { req.destroy(); return; } chunks.push(c); });
    r.on("end", () => cb(null, { status: r.statusCode || 200, headers: r.headers, body: Buffer.concat(chunks), finalUrl: x.href }));
  });
  req.setTimeout(20000, () => req.destroy(new Error("目标超时")));
  req.on("error", cb);
  req.end();
}

// HTTP handler: 挂在 local-api server 上。返回 true=已处理。
function handle(req, res, expectedToken) {
  const full = new URL(req.url, "http://127.0.0.1");
  if (full.pathname !== "/web") return false;
  const bad = (code, msg) => { res.writeHead(code, { "Content-Type": "text/plain; charset=utf-8" }); res.end(msg); };
  if ((full.searchParams.get("t") || "") !== expectedToken) { bad(401, "unauthorized"); return true; }
  const target = full.searchParams.get("u") || "";
  if (!isHttpUrl(target)) { bad(400, "u 须为绝对 http(s) URL"); return true; }
  fetchUrl(target, 0, (err, r) => {
    if (err) return bad(502, "取回失败: " + err.message);
    const ct = String(r.headers["content-type"] || "application/octet-stream");
    // 剥内嵌封锁头; 其余按原样(不透传 set-cookie 到本机域, 避免 cookie 混染)
    const out = { "Content-Type": ct, "Cache-Control": "no-store" };
    if (/text\/html/i.test(ct)) {
      const prefix = "/web?t=" + encodeURIComponent(expectedToken) + "&u=";
      let html = r.body.toString("utf8");
      const inject = "<base href=\"" + r.finalUrl.replace(/"/g, "&quot;") + "\">" + interceptScript(prefix);
      html = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => m + inject) : inject + html;
      const b = Buffer.from(html, "utf8");
      out["Content-Length"] = b.length;
      res.writeHead(r.status, out);
      res.end(b);
    } else {
      out["Content-Length"] = r.body.length;
      res.writeHead(r.status, out);
      res.end(r.body);
    }
  });
  return true;
}

module.exports = { handle, isHttpUrl, interceptScript, fetchUrl };
