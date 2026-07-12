// 道 · 插件自持浏览器搜索(🔎 搜索板块后端) —— 站内直出网页搜索, 插件自持真源。
// ─────────────────────────────────────────────────────────────────────────────
// 复刻 dao-vsix「站内代理搜索」: 经搜索引擎直取结果, 不弹外部系统浏览器。
// 默认走 DuckDuckGo 无 JS 版(html.duckduckgo.com/html), 解析出 {title,url,snippet} 列表。
// 搜索历史落 ~/.dao/web-search.json (mode 600), 只留最近若干条查询串(不含任何凭据)。
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const https = require("https");
const { URL } = require("url");

const ENGINES = {
  duckduckgo: { name: "DuckDuckGo", url: (q) => "https://html.duckduckgo.com/html/?q=" + encodeURIComponent(q), serp: (q) => "https://duckduckgo.com/?q=" + encodeURIComponent(q) },
  bing: { name: "Bing", url: (q) => "https://www.bing.com/search?q=" + encodeURIComponent(q), serp: (q) => "https://www.bing.com/search?q=" + encodeURIComponent(q) },
};

// 人类可读 SERP 地址(供「在浏览器打开」兜底 —— 反爬拦截时也总能直达真实结果页)。
function serpUrl(query, engine) { const e = ENGINES[engine] ? engine : "duckduckgo"; return ENGINES[e].serp(String(query || "")); }

function histPath() { return process.env.DAO_WEB_SEARCH_FILE || path.join(os.homedir(), ".dao", "web-search.json"); }

function loadHist() {
  try { const j = JSON.parse(fs.readFileSync(histPath(), "utf8")); return Array.isArray(j.history) ? j.history : []; }
  catch (_) { return []; }
}

function saveHist(list) {
  fs.mkdirSync(path.dirname(histPath()), { recursive: true });
  fs.writeFileSync(histPath(), JSON.stringify({ history: list.slice(0, 30) }, null, 2), { mode: 0o600 });
}

function httpGet(u) {
  return new Promise((resolve) => {
    let url;
    try { url = new URL(u); } catch (_) { return resolve({ code: -1, body: "" }); }
    const req = https.request({
      hostname: url.hostname, path: url.pathname + url.search, method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml", "Accept-Language": "en-US,en;q=0.9",
      },
    }, (r) => {
      // 跟随一层重定向(DDG 偶发 302)。
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) {
        const loc = r.headers.location.startsWith("http") ? r.headers.location : url.origin + r.headers.location;
        r.resume(); return httpGet(loc).then(resolve);
      }
      let b = ""; r.on("data", (c) => { b += c; });
      r.on("end", () => resolve({ code: r.statusCode || 0, body: b }));
    });
    req.on("error", () => resolve({ code: 0, body: "" }));
    req.setTimeout(15000, () => { req.destroy(); resolve({ code: 0, body: "" }); });
    req.end();
  });
}

function decodeEntities(s) {
  return String(s || "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}
function stripTags(s) { return decodeEntities(String(s || "").replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim(); }

// 解析 DuckDuckGo html 版结果(class result__a / result__snippet)。
function parseDuckDuckGo(html) {
  const out = [];
  const re = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = re.exec(html)) && out.length < 20) {
    let href = decodeEntities(m[1]);
    const um = href.match(/[?&]uddg=([^&]+)/);
    if (um) { try { href = decodeURIComponent(um[1]); } catch (_) {} }
    out.push({ title: stripTags(m[2]), url: href, snippet: "" });
  }
  const sre = /<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
  let i = 0, sm;
  while ((sm = sre.exec(html)) && i < out.length) { out[i].snippet = stripTags(sm[1]); i++; }
  return out;
}

// 解析 Bing 结果(li.b_algo → h2>a + p 摘要)。
function parseBing(html) {
  const out = [];
  const re = /<li class="b_algo"[\s\S]*?<h2>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h2>([\s\S]*?)<\/li>/g;
  let m;
  while ((m = re.exec(html)) && out.length < 20) {
    const url = decodeEntities(m[1]);
    if (!/^https?:/.test(url)) continue;
    const pm = m[3].match(/<p[^>]*>([\s\S]*?)<\/p>/);
    out.push({ title: stripTags(m[2]), url, snippet: pm ? stripTags(pm[1]) : "" });
  }
  return out;
}

function parseFor(engine, html) { return engine === "bing" ? parseBing(html) : parseDuckDuckGo(html); }

// 搜索 → { ok, engine, query, results:[{title,url,snippet}], error? }。
// 首选引擎被反爬(如 DDG 恒 202)时, 自动回退 Bing —— 柔弱胜刚强, 总取可达者。
async function search(query, engine) {
  query = String(query || "").trim();
  if (!query) throw new Error("查询串不可为空");
  const first = ENGINES[engine] ? engine : "duckduckgo";
  const order = first === "bing" ? ["bing", "duckduckgo"] : [first, "bing"];
  let used = first, code = 0, results = [];
  for (const eng of order) {
    const r = await httpGet(ENGINES[eng].url(query));
    used = eng; code = r.code;
    if (r.code === 200 && r.body) { results = parseFor(eng, r.body); if (results.length) break; }
  }
  // 记历史(仅查询串)。
  try { const h = loadHist().filter((x) => x.query !== query); h.unshift({ query, engine: used, at: new Date().toISOString(), n: results.length }); saveHist(h); } catch (_) {}
  return { ok: results.length > 0, engine: used, engineName: ENGINES[used].name, query, results, serp: serpUrl(query, first),
    error: results.length ? "" : (code === 200 ? "无结果(引擎可能改版或被限流)" : ("引擎不可达/被反爬(HTTP " + code + ")")) };
}

function historyView() { return loadHist(); }
function clearHistory() { saveHist([]); return { cleared: true }; }
function engineList() { return Object.keys(ENGINES).map((k) => ({ key: k, name: ENGINES[k].name })); }

module.exports = { histPath, search, historyView, clearHistory, engineList, serpUrl, parseDuckDuckGo, parseBing, stripTags, ENGINES };
