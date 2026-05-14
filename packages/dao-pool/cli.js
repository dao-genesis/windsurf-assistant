#!/usr/bin/env node
/**
 * dao-pool · CLI · 印 95 真本源闭环 · 一 GH 账号即一切
 * ════════════════════════════════════════════════════════════════════════
 *
 *   用法 (主公本机一次性 init):
 *     ① init 立 gist + 推 token 池 (从 ~/.wam/wam-state.json):
 *       node cli.js init --pat <gist-scope-PAT>
 *
 *     ② 推: 主公本机 wam-state 改后 · 重推 gist:
 *       node cli.js push --gist <id> --pat <pat>
 *
 *     ③ 拉 (workflow 用): gist → ~/.dao/accounts.json
 *       node cli.js pull --gist <id> --pat <pat>
 *
 *     ④ 报 daemon URL (workflow 用):
 *       node cli.js report --gist <id> --pat <pat> --host <h> --url <u>
 *
 *     ⑤ 列: 看 pool 状态 + daemon 池
 *       node cli.js list --gist <id> --pat <pat>
 *
 *     ⑥ 找: 已存 dao-pool gist (无 ID 时):
 *       node cli.js find --pat <pat>
 *
 *   环境变量 (与 --flag 同等 · workflow 用):
 *     DAO_POOL_GIST_ID  · gist id
 *     DAO_POOL_PAT      · GitHub PAT (gist scope)
 *     DAO_POOL_FILE     · 文件名 (默 dao-pool.json)
 *
 *   零依赖 · 仅 Node 内置
 */
"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const {
  pull,
  push,
  create,
  findExisting,
  GistPool,
  pullToAccountsJson,
  reportDaemonUrl,
} = require("./gist-pool");

// ── arg parse ─────────────────────────────────────────────────────────
function parseArgs(argv) {
  const cmd = argv[2];
  const opts = {};
  for (let i = 3; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const k = a.slice(2);
      const v = argv[i + 1];
      if (!v || v.startsWith("--")) {
        opts[k] = true;
      } else {
        opts[k] = v;
        i++;
      }
    }
  }
  return { cmd, opts };
}

const { cmd, opts } = parseArgs(process.argv);

const PAT = opts.pat || process.env.DAO_POOL_PAT || process.env.GH_PAT || "";
const GIST_ID = opts.gist || process.env.DAO_POOL_GIST_ID || "";
const FILE_NAME =
  opts.file || process.env.DAO_POOL_FILE || "dao-pool.json";

function need(val, name) {
  if (!val) {
    console.error(`✗ 缺 ${name} · 用 --${name.toLowerCase()} <val> 或 env`);
    process.exit(1);
  }
  return val;
}

function masked(s, n = 8) {
  if (!s) return "(none)";
  if (s.length <= n + n) return s;
  return s.slice(0, n) + "..." + s.slice(-n);
}

// ── help ──────────────────────────────────────────────────────────────
function printHelp() {
  console.log(`dao-pool · 印 95 真本源闭环 · CLI

帛书·四十:「反者道之动 · 弱者道之用 · 天下之物生于有 · 有生于无」
帛书·廿二:「圣人执一 · 以为天下牧」

主公一笔之路:

  # 一次性 (主公本机 · 创私 gist 推 token 池)
  node cli.js init --pat <gist-scope-PAT>

  # workflow 内 (Actions runner · 拉 token → 立 accounts.json)
  node cli.js pull  --gist <id> --pat <pat>

  # workflow 内 (报 daemon URL 回 gist)
  node cli.js report --gist <id> --pat <pat> --host <h> --url <u>

  # 看现态
  node cli.js list  --gist <id> --pat <pat>

子命:
  init       立新 gist · 从 ~/.wam/wam-state.json 推 token 池
  push       从本地 wam-state 重推 gist (主公更号后)
  pull       gist → ~/.dao/accounts.json (workflow 之入)
  report     报 daemon URL 回 gist (host + url)
  list       列 pool 摘要 + daemon 表
  find       搜主公已存 dao-pool gist
  daemons    列 daemon URL (供 web UI / curl)
  prune      清过期 daemon (默 15min)
  help       此帮

用 PAT scope: gist · 仅. (单 GH 账号即一切)
`);
}

// ── ● init: create gist + push wam-state 转 ─────────────────────────────
async function cmdInit() {
  need(PAT, "pat");
  const wamPath = opts.from || path.join(os.homedir(), ".wam", "wam-state.json");
  let wamRaw = null;
  if (fs.existsSync(wamPath)) {
    try {
      wamRaw = JSON.parse(fs.readFileSync(wamPath, "utf8"));
      console.log(
        `  ✓ 读本机 wam-state · ${wamPath} · ${(fs.statSync(wamPath).size / 1024).toFixed(1)}KB`,
      );
    } catch (e) {
      console.warn(`  ⚠ wam-state 解失败 · 立空 pool: ${e.message}`);
    }
  } else {
    console.log(`  ⚠ wam-state 不存 (${wamPath}) · 立空 pool · 后续 push 加号`);
  }
  // 检已存 dao-pool gist
  const existing = await findExisting({ pat: PAT, fileName: FILE_NAME });
  if (existing.length > 0 && !opts.force) {
    console.log(`  ⚠ 已存 dao-pool gist (${existing.length} 个):`);
    for (const g of existing) {
      console.log(
        `     · ${g.id} · ${g.public ? "公" : "私"} · ${g.updated} · ${g.url}`,
      );
    }
    console.log(`  → 用 --force 强建新 · 或 --gist <id> 直推已存`);
    return;
  }
  // 准备 pool 数据
  const pool = new GistPool({ data: null });
  if (wamRaw) {
    const n = pool.fromWamState(wamRaw);
    console.log(`  ✓ 转: wam → pool · ${n} 号`);
  }
  // create
  const gist = await create({
    pat: PAT,
    description: "dao-pool · 印 95 真本源闭环 · 一 GH 账号即一切 (zhouyoukang/windsurf-assistant)",
    public: !!opts.public, // 默 私 gist
    fileName: FILE_NAME,
    data: pool.data,
  });
  console.log("");
  console.log("════════════════════════════════════════════════════════════");
  console.log("  ✓ gist 立成");
  console.log("════════════════════════════════════════════════════════════");
  console.log("  id      : " + gist.id);
  console.log("  url     : " + gist.url);
  console.log("  public  : " + gist.public);
  console.log("  file    : " + gist.fileName);
  console.log("  pool    : " + pool.summary().total + " 号");
  console.log("");
  console.log("  下一步 (设 GitHub repo secret · 让 Actions 用):");
  console.log("");
  console.log(
    `    gh secret set DAO_POOL_GIST_ID --body '${gist.id}' -R zhouyoukang/windsurf-assistant`,
  );
  console.log(
    `    gh secret set DAO_POOL_PAT --body '${masked(PAT)}' -R zhouyoukang/windsurf-assistant   # 全 PAT 不显`,
  );
  console.log("");
  console.log("  或网页 (推荐):");
  console.log(
    "    https://github.com/zhouyoukang/windsurf-assistant/settings/secrets/actions",
  );
  console.log("");
  console.log("  即可触发 dao-fleet-cloud workflow · 一 GH 账号即一切 · 道法自然");
  console.log("════════════════════════════════════════════════════════════");
}

// ── ● push: 主公本机 wam-state → gist (重推) ────────────────────────────
async function cmdPush() {
  need(GIST_ID, "gist");
  need(PAT, "pat");
  const wamPath = opts.from || path.join(os.homedir(), ".wam", "wam-state.json");
  if (!fs.existsSync(wamPath)) {
    console.error(`✗ wam-state 不存: ${wamPath}`);
    process.exit(1);
  }
  const wamRaw = JSON.parse(fs.readFileSync(wamPath, "utf8"));
  // 拉现 gist · 保 daemon (不覆其报)
  let existingDaemons = [];
  try {
    const cur = await pull({ gistId: GIST_ID, pat: PAT, fileName: FILE_NAME });
    existingDaemons = cur.data.daemons || [];
    console.log(`  ✓ 拉现 gist · ${existingDaemons.length} daemon 保`);
  } catch (e) {
    console.warn(`  ⚠ 拉现 gist 失败: ${e.message} · 全新写`);
  }
  const pool = new GistPool({ data: { daemons: existingDaemons } });
  const n = pool.fromWamState(wamRaw);
  console.log(`  ✓ 转: wam → pool · ${n} 号 · ${pool.summary().candidates} 候选`);
  await push({ gistId: GIST_ID, pat: PAT, fileName: FILE_NAME, data: pool.data });
  console.log(`  ✓ 推 gist 成 · https://gist.github.com/${GIST_ID}`);
}

// ── ● pull: gist → ~/.dao/accounts.json ─────────────────────────────────
async function cmdPull() {
  need(GIST_ID, "gist");
  need(PAT, "pat");
  const accountsPath =
    opts.out ||
    process.env.DAO_ACCOUNTS_FILE ||
    path.join(os.homedir(), ".dao", "accounts.json");
  const r = await pullToAccountsJson({
    gistId: GIST_ID,
    pat: PAT,
    fileName: FILE_NAME,
    accountsPath,
  });
  console.log(`  ✓ 拉 gist · ${GIST_ID}`);
  console.log(`  ✓ 总: ${r.summary.total} 号 · 候选: ${r.summary.candidates} · 冻: ${r.summary.frozen}`);
  console.log(`  ✓ 写 accounts.json · ${r.accountCount} 号 · active=${r.active}`);
  console.log(`  ✓ 路径: ${accountsPath}`);
  if (r.summary.daemonsAlive != null) {
    console.log(
      `  ◦ daemons (already known): ${r.summary.daemonsTotal} · alive=${r.summary.daemonsAlive}`,
    );
  }
}

// ── ● report: 报 daemon URL 回 gist ─────────────────────────────────────
async function cmdReport() {
  need(GIST_ID, "gist");
  need(PAT, "pat");
  need(opts.url, "url");
  const host =
    opts.host ||
    process.env.GITHUB_RUN_ID ||
    require("os").hostname() ||
    "unknown";
  const sessionId = opts["session-id"] || opts.session || `actions-${host}`;
  const port = parseInt(opts.port || "7862", 10);
  const r = await reportDaemonUrl({
    gistId: GIST_ID,
    pat: PAT,
    fileName: FILE_NAME,
    host,
    url: opts.url,
    sessionId,
    daemonPort: port,
    version: opts.version || null,
    poolTotal: opts["pool-total"] ? parseInt(opts["pool-total"], 10) : null,
  });
  console.log(`  ✓ daemon 报回 gist · ${host} → ${opts.url}`);
  console.log(`  ✓ daemons 池总: ${r.daemonsTotal}`);
}

// ── ● list: 摘 pool + daemon 池 ─────────────────────────────────────────
async function cmdList() {
  need(GIST_ID, "gist");
  need(PAT, "pat");
  const { data, gistMeta } = await pull({
    gistId: GIST_ID,
    pat: PAT,
    fileName: FILE_NAME,
  });
  const pool = new GistPool({ data });
  pool.pruneStaleDaemons({ maxAgeMs: 15 * 60 * 1000 }); // 仅显
  const sum = pool.summary();
  console.log("════════════════════════════════════════════════════════════");
  console.log("  dao-pool · 印 95 现态 · " + new Date().toISOString());
  console.log("════════════════════════════════════════════════════════════");
  console.log("  gist        : " + gistMeta.url);
  console.log("  updated     : " + gistMeta.updated);
  console.log("  public      : " + gistMeta.public);
  console.log("  lastSync    : " + (data.lastSync || "(无)"));
  console.log("");
  console.log("  pool        :");
  console.log("    total     : " + sum.total);
  console.log("    candidates: " + sum.candidates + " (W=0)");
  console.log("    types     : " + JSON.stringify(sum.types));
  console.log("    frozen    : " + sum.frozen);
  console.log("");
  console.log("  daemons     :");
  console.log("    total     : " + sum.daemonsTotal);
  console.log("    alive     : " + sum.daemonsAlive);
  if ((data.daemons || []).length > 0) {
    console.log("");
    console.log(
      "    " +
        "host".padEnd(20) +
        "ver".padEnd(8) +
        "pool".padEnd(7) +
        "age".padEnd(6) +
        "url",
    );
    for (const d of data.daemons) {
      console.log(
        "    " +
          (d.host || "?").padEnd(20) +
          (d.version || "?").padEnd(8) +
          (d.poolTotal != null ? String(d.poolTotal) : "?").padEnd(7) +
          (d.ageSec != null ? d.ageSec + "s" : "?").padEnd(6) +
          (d.url || ""),
      );
    }
  }
  console.log("════════════════════════════════════════════════════════════");
}

// ── ● find: 主公找已存 dao-pool gist ────────────────────────────────────
async function cmdFind() {
  need(PAT, "pat");
  const list = await findExisting({ pat: PAT, fileName: FILE_NAME });
  if (list.length === 0) {
    console.log(`  ◦ 未找 dao-pool gist · 用 init 立`);
    return;
  }
  console.log(`  ✓ 找 ${list.length} 个 dao-pool gist:`);
  for (const g of list) {
    console.log(
      `    · ${g.id}  ${g.public ? "公" : "私"}  ${g.updated}  ${g.url}`,
    );
  }
}

// ── ● daemons: 仅 daemon 池 (web UI / curl 用) ──────────────────────────
async function cmdDaemons() {
  need(GIST_ID, "gist");
  need(PAT, "pat");
  const { data } = await pull({
    gistId: GIST_ID,
    pat: PAT,
    fileName: FILE_NAME,
  });
  const pool = new GistPool({ data });
  pool.pruneStaleDaemons({ maxAgeMs: 15 * 60 * 1000 });
  const out = pool.data.daemons || [];
  if (opts.json) {
    console.log(JSON.stringify(out, null, 2));
  } else {
    if (out.length === 0) {
      console.log("(无活 daemon · 触 dao-fleet-cloud workflow 起新)");
      return;
    }
    for (const d of out) {
      console.log(`${d.url}\t${d.host}\t${d.version || "?"}\t${d.ageSec}s`);
    }
  }
}

// ── ● prune: 清过期 daemon ──────────────────────────────────────────────
async function cmdPrune() {
  need(GIST_ID, "gist");
  need(PAT, "pat");
  const { data } = await pull({
    gistId: GIST_ID,
    pat: PAT,
    fileName: FILE_NAME,
  });
  const pool = new GistPool({ data });
  const max = opts.max ? parseInt(opts.max, 10) * 60 * 1000 : 15 * 60 * 1000;
  const r = pool.pruneStaleDaemons({ maxAgeMs: max });
  if (r.removed > 0) {
    await push({
      gistId: GIST_ID,
      pat: PAT,
      fileName: FILE_NAME,
      data: pool.data,
    });
    console.log(`  ✓ 清 ${r.removed} 过期 daemon · 留 ${r.kept}`);
    for (const s of r.stale) {
      console.log(`    × ${s.host} · ${s.url}`);
    }
  } else {
    console.log(`  ◦ 无过期 · 留 ${r.kept}`);
  }
}

// ── main ──────────────────────────────────────────────────────────────
async function main() {
  const handlers = {
    init: cmdInit,
    push: cmdPush,
    pull: cmdPull,
    report: cmdReport,
    list: cmdList,
    find: cmdFind,
    daemons: cmdDaemons,
    prune: cmdPrune,
    help: printHelp,
  };
  const fn = handlers[cmd];
  if (!fn) {
    if (cmd) console.error(`✗ 未知子命: ${cmd}`);
    printHelp();
    process.exit(cmd ? 2 : 0);
  }
  try {
    await fn();
  } catch (e) {
    console.error(`✗ ${cmd} 失败: ${e.message}`);
    if (e.body && process.env.DAO_DEBUG) {
      console.error("  body:", JSON.stringify(e.body, null, 2).slice(0, 500));
    }
    process.exit(1);
  }
}

main();
