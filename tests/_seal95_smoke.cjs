#!/usr/bin/env node
/**
 * _seal95_smoke.cjs · 印 95 真本源闭环 · smoke 测 (无网络 · 仅本地)
 * ════════════════════════════════════════════════════════════════════════
 *
 * 帛书·二十二「圣人执一·以为天下牧」
 *
 *  ① require gist-pool · 验 exports
 *  ② GistPool 类 · pickBest / toAccountsJson / addDaemonUrl / pruneStaleDaemons
 *  ③ fromWamState · 主公 wam-state 真 schema 转 pool
 *  ④ writeAccountsJsonTo · 真写盘 · 验 schema (~/.dao 测路径)
 *  ⑤ cli.js 帮 · 看 syntax
 *  ⑥ gist-pool.js + cli.js syntax (node -c)
 *
 *  全离网 · 不调 GitHub API · 不写主公真 ~/.dao
 */
"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const PKG = path.join(ROOT, "packages", "dao-pool");

let pass = 0;
let fail = 0;
const fails = [];

function ok(name) {
  console.log(`  ✓ ${name}`);
  pass++;
}
function ng(name, msg) {
  console.log(`  ✗ ${name} · ${msg}`);
  fails.push(`${name}: ${msg}`);
  fail++;
}
function eq(a, b, name) {
  if (a === b) ok(name);
  else ng(name, `${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`);
}
function truthy(v, name) {
  if (v) ok(name);
  else ng(name, `expected truthy · got ${JSON.stringify(v)}`);
}

console.log("═══ 印 95 真本源闭环 · smoke 测 ═══");

// ─ § 1 · syntax ─────────────────────────────────────────────────────
try {
  execSync(`node -c "${path.join(PKG, "gist-pool.js")}"`, {
    stdio: "pipe",
  });
  ok("§1.1 gist-pool.js syntax");
} catch (e) {
  ng("§1.1 gist-pool.js syntax", e.message);
}
try {
  execSync(`node -c "${path.join(PKG, "cli.js")}"`, { stdio: "pipe" });
  ok("§1.2 cli.js syntax");
} catch (e) {
  ng("§1.2 cli.js syntax", e.message);
}

// ─ § 2 · require + exports ──────────────────────────────────────────
let G;
try {
  G = require(path.join(PKG, "gist-pool.js"));
  ok("§2.1 require gist-pool");
} catch (e) {
  ng("§2.1 require gist-pool", e.message);
  process.exit(1);
}
truthy(typeof G.pull === "function", "§2.2 pull fn");
truthy(typeof G.push === "function", "§2.3 push fn");
truthy(typeof G.create === "function", "§2.4 create fn");
truthy(typeof G.findExisting === "function", "§2.5 findExisting fn");
truthy(typeof G.GistPool === "function", "§2.6 GistPool class");
truthy(typeof G.pullToAccountsJson === "function", "§2.7 pullToAccountsJson");
truthy(typeof G.reportDaemonUrl === "function", "§2.8 reportDaemonUrl");

// ─ § 3 · GistPool · pickBest + toAccountsJson ───────────────────────
const fixData = {
  version: 1,
  pool: {
    total: 3,
    accounts: [
      {
        email: "best@a.com",
        apiKey: "devin-session-token$X",
        type: "devin",
        weekly: 0,
        daily: 100,
      },
      {
        email: "mid@a.com",
        apiKey: "sk-ws-01-Y",
        type: "sk-ws",
        weekly: 50,
        daily: 100,
      },
      {
        email: "frozen@a.com",
        apiKey: "sk-ws-01-Z",
        type: "sk-ws",
        weekly: 0,
        daily: 100,
        frozen: true,
      },
    ],
  },
  daemons: [],
};

const p = new G.GistPool({ data: JSON.parse(JSON.stringify(fixData)) });

const best = p.pickBest({});
truthy(best, "§3.1 pickBest 有返");
eq(best.email, "best@a.com", "§3.2 pickBest 选 W=0 优");

const bestSk = p.pickBest({ type: "sk-ws" });
eq(bestSk && bestSk.email, "mid@a.com", "§3.3 pickBest type=sk-ws 跳冻");

const cands = p.pickCandidates({ limit: 5 });
eq(cands.length, 2, "§3.4 pickCandidates 跳冻 · 留 2");

const j = p.toAccountsJson();
eq(j.version, 2, "§3.5 toAccountsJson schema=v2");
eq(j.active, "best@a.com", "§3.6 toAccountsJson active=best");
eq(j.accounts.length, 2, "§3.7 toAccountsJson accounts=2 (跳冻)");
truthy(j._seal && j._seal.includes("印 95"), "§3.8 toAccountsJson 印 95 mark");
eq(j.accounts[0].email, "best@a.com", "§3.9 toAccountsJson [0]=best");

// ─ § 4 · daemon URL · addDaemonUrl + prune ──────────────────────────
const p2 = new G.GistPool({ data: { daemons: [] } });
p2.addDaemonUrl({
  host: "h1",
  url: "https://x.com",
  version: "0.3.0",
  poolTotal: 137,
});
eq(p2.data.daemons.length, 1, "§4.1 addDaemonUrl 一");
p2.addDaemonUrl({ host: "h1", url: "https://y.com" });
eq(p2.data.daemons.length, 1, "§4.2 同 host 替 (不增)");
eq(p2.data.daemons[0].url, "https://y.com", "§4.3 同 host 之 url 已新");
p2.addDaemonUrl({ host: "h2", url: "https://z.com" });
eq(p2.data.daemons.length, 2, "§4.4 异 host 加");

// 模拟过期: 改 reportedAt 为 30min 前
p2.data.daemons[0].reportedAt = new Date(Date.now() - 30 * 60 * 1000).toISOString();
const r = p2.pruneStaleDaemons({ maxAgeMs: 15 * 60 * 1000 });
eq(r.removed, 1, "§4.5 prune 清 1 过期");
eq(r.kept, 1, "§4.6 prune 留 1 新");
eq(p2.data.daemons[0].host, "h2", "§4.7 prune 后留 h2");

// ─ § 5 · fromWamState · 真 wam-state 形态 ───────────────────────────
const wamFake = {
  version: "2.7.0",
  activeEmail: "wamX@gmail.com",
  activeApiKey: "devin-session-token$WAMX",
  activeApiServerUrl: "https://server.self-serve.windsurf.com",
  accountMeta: {
    "wamA@gmail.com": {
      apiKey: "sk-ws-01-A",
      type: "sk-ws",
      apiServerUrl: "https://server.self-serve.windsurf.com",
    },
    "wamX@gmail.com": {
      apiKey: "devin-session-token$WAMX",
      type: "devin",
      apiServerUrl: "https://app.devin.ai",
    },
    "wamFroz@gmail.com": {
      apiKey: "sk-ws-01-F",
      type: "sk-ws",
    },
  },
  health: {
    "wamA@gmail.com": { daily: 100, weekly: 50 },
    "wamX@gmail.com": { daily: 80, weekly: 0 },
  },
  blacklist: { "wamFroz@gmail.com": true },
};
const p3 = new G.GistPool({ data: null });
const cnt = p3.fromWamState(wamFake);
eq(cnt, 3, "§5.1 fromWamState 转 3 号");
const sum = p3.summary();
eq(sum.total, 3, "§5.2 summary total=3");
eq(sum.frozen, 1, "§5.3 summary frozen=1");
eq(sum.candidates, 1, "§5.4 summary candidates W=0 = 1 (wamX)");
eq(p3.data.pool.accounts[0].email, "wamX@gmail.com", "§5.5 active 提到首");

// ─ § 6 · writeAccountsJsonTo · 真写测 (临 ~/.dao 替) ───────────────
const TMP = path.join(os.tmpdir(), `dao-pool-test-${Date.now()}`);
fs.mkdirSync(TMP, { recursive: true });
try {
  const dst = path.join(TMP, "accounts.json");
  const written = p3.writeAccountsJsonTo(dst);
  truthy(fs.existsSync(dst), "§6.1 写盘成");
  const re = JSON.parse(fs.readFileSync(dst, "utf8"));
  eq(re.version, 2, "§6.2 写盘 schema=v2");
  truthy(Array.isArray(re.accounts), "§6.3 写盘 accounts=array");
  eq(re.active, "wamX@gmail.com", "§6.4 写盘 active=wamX");
  truthy(re._seal && re._seal.includes("印 95"), "§6.5 写盘 印 95 mark");
  fs.unlinkSync(dst);
  fs.rmdirSync(TMP);
} catch (e) {
  ng("§6 写盘", e.message);
}

// ─ § 7 · cli.js 帮印出 ──────────────────────────────────────────────
try {
  const out = execSync(`node "${path.join(PKG, "cli.js")}" help`, {
    stdio: "pipe",
    encoding: "utf8",
  });
  truthy(out.includes("dao-pool"), "§7.1 cli help 含 dao-pool");
  truthy(out.includes("init"), "§7.2 cli help 含 init");
  truthy(out.includes("pull"), "§7.3 cli help 含 pull");
  truthy(out.includes("report"), "§7.4 cli help 含 report");
  truthy(out.includes("印 95"), "§7.5 cli help 含 印 95");
} catch (e) {
  ng("§7 cli help", e.message);
}

// ─ § 8 · 帛书道义守 (代码骨内含) ─────────────────────────────────────
const gp = fs.readFileSync(path.join(PKG, "gist-pool.js"), "utf8");
truthy(gp.includes("反者道之动"), "§8.1 gist-pool.js 含 反者道之动");
truthy(gp.includes("圣人执一"), "§8.2 gist-pool.js 含 圣人执一");
truthy(gp.includes("印 95"), "§8.3 gist-pool.js 含 印 95");

// ─ 总览 ─────────────────────────────────────────────────────────────
console.log("");
console.log("═══ 印 95 smoke 总 ═══");
console.log(`  通 ${pass} · 退 ${fail}`);
if (fail > 0) {
  console.log("");
  console.log("✗ 退:");
  for (const f of fails) console.log("    " + f);
  process.exit(1);
}
console.log("");
console.log("✓ 印 95 smoke 全通 · 真本源闭环 · 道法自然");
console.log("  帛书·四十:  反者道之动 · 弱者道之用");
console.log("  帛书·廿二:  圣人执一 · 以为天下牧");
console.log("  帛书·二十五: 独立而不垓 · 可以为天地母");
process.exit(0);
