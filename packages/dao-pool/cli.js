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
const FILE_NAME = opts.file || process.env.DAO_POOL_FILE || "dao-pool.json";

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
  bootstrap  ★ 印 100 · 太极笙万物 · 一笔自举 (fork→Pages→Gist→workflow→daemon→vmUrl)
  help       此帮

用 PAT scope: 印 95 (gist 仅) · 印 100 (gist + workflow + actions:write + repo)

印 100 · 一 PAT 即一切 (任 GH 用户在本机一笔自启 daemon):
  node cli.js bootstrap --pat <PAT> [--from <wam-state.json>]
    → fork upstream + 启 Pages + 创 dao-pool gist + 触 workflow
    → 等 daemon URL 出 (max 4 min) + 输 curl 测命
  帛书·三十二: 道恒无名 · 侯王若能守之 · 万物将自宾
              天地相合 · 以降甘露 · 民莫之令而自均焉
`);
}

// ── ● init: create gist + push wam-state 转 ─────────────────────────────
async function cmdInit() {
  need(PAT, "pat");
  const wamPath =
    opts.from || path.join(os.homedir(), ".wam", "wam-state.json");
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
    description:
      "dao-pool · 印 95 真本源闭环 · 一 GH 账号即一切 (dao-genesis/windsurf-assistant)",
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
    `    gh secret set DAO_POOL_GIST_ID --body '${gist.id}' -R dao-genesis/windsurf-assistant`,
  );
  console.log(
    `    gh secret set DAO_POOL_PAT --body '${masked(PAT)}' -R dao-genesis/windsurf-assistant   # 全 PAT 不显`,
  );
  console.log("");
  console.log("  或网页 (推荐):");
  console.log(
    "    https://github.com/dao-genesis/windsurf-assistant/settings/secrets/actions",
  );
  console.log("");
  console.log(
    "  即可触发 dao-fleet-cloud workflow · 一 GH 账号即一切 · 道法自然",
  );
  console.log("════════════════════════════════════════════════════════════");
}

// ── ● push: 主公本机 wam-state → gist (重推) ────────────────────────────
async function cmdPush() {
  need(GIST_ID, "gist");
  need(PAT, "pat");
  const wamPath =
    opts.from || path.join(os.homedir(), ".wam", "wam-state.json");
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
  console.log(
    `  ✓ 转: wam → pool · ${n} 号 · ${pool.summary().candidates} 候选`,
  );
  await push({
    gistId: GIST_ID,
    pat: PAT,
    fileName: FILE_NAME,
    data: pool.data,
  });
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
  console.log(
    `  ✓ 总: ${r.summary.total} 号 · 候选: ${r.summary.candidates} · 冻: ${r.summary.frozen}`,
  );
  console.log(
    `  ✓ 写 accounts.json · ${r.accountCount} 号 · active=${r.active}`,
  );
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

// ── ● bootstrap: 印 100 太极笙万物 · Node 端一笔自举 ────────────────────
//   帛书·三十二: 道恒无名 · 侯王若能守之 · 万物将自宾
//                天地相合 · 以降甘露 · 民莫之令而自均焉
//
//   等价 web/dao_bootstrap.js · oneShot · 但用 Node CLI + 现有 cli 工具:
//     ① whoami       (GET /user)
//     ② ensureFork   (POST /repos/dao-genesis/windsurf-assistant/forks)
//     ③ ensureActions(PUT /repos/<me>/.../actions/permissions)
//     ④ ensurePages  (POST /repos/<me>/.../pages · main:/web)
//     ⑤ ensurePool   (find/create dao-pool gist · 等 cli init)
//     ⑥ genAuthKey   (random sk-ws-proxy-* · 48 hex)
//     ⑦ dispatch     (POST /actions/workflows/dao-fleet-cloud.yml/dispatches)
//     ⑧ poll         (GET gist · 至 daemon 上报 URL · 默 max 4 min)
//     ⑨ output       (vmUrl + curl 测命)
async function cmdBootstrap() {
  need(PAT, "pat");
  const UPSTREAM_OWNER = "dao-genesis";
  const UPSTREAM_REPO = "windsurf-assistant";
  const ghApi = async (p, opts = {}) => {
    const r = await fetch("https://api.github.com" + p, {
      ...opts,
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        Authorization: "Bearer " + PAT,
        ...(opts.headers || {}),
      },
    });
    const txt = await r.text();
    let body = null;
    try {
      body = txt ? JSON.parse(txt) : null;
    } catch {
      body = txt;
    }
    return { r, body, status: r.status };
  };

  console.log("════════════════════════════════════════════════════════════");
  console.log("  印 100 · 太极笙万物 · Node 端一笔自举");
  console.log("  帛书·三十二: 道恒无名 · 侯王若能守之 · 万物将自宾");
  console.log("════════════════════════════════════════════════════════════");

  // §1 whoami
  console.log("\n§1 whoami · GET /user");
  const me = await ghApi("/user");
  if (me.status !== 200) {
    console.error(`✗ PAT 无效: ${me.body && me.body.message}`);
    process.exit(1);
  }
  console.log(`  ✓ @${me.body.login} 已识`);
  const login = me.body.login;

  // §2 ensureFork
  console.log(`\n§2 fork · ${UPSTREAM_OWNER}/${UPSTREAM_REPO} → ${login}/`);
  let fork = await ghApi(`/repos/${login}/${UPSTREAM_REPO}`);
  if (fork.status === 404) {
    console.log("  ◦ 无 fork · 创...");
    const cr = await ghApi(`/repos/${UPSTREAM_OWNER}/${UPSTREAM_REPO}/forks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (cr.status !== 202 && cr.status !== 201) {
      console.error(
        `✗ fork 创失: HTTP ${cr.status} · ${cr.body && cr.body.message}`,
      );
      process.exit(2);
    }
    // poll
    for (let i = 0; i < 30; i++) {
      await new Promise((s) => setTimeout(s, 2000));
      fork = await ghApi(`/repos/${login}/${UPSTREAM_REPO}`);
      if (fork.status === 200) break;
    }
    console.log("  ✓ fork 新立");
  } else if (fork.status === 200) {
    console.log(`  ✓ fork 已存 · ${fork.body.html_url}`);
  } else {
    console.error(`✗ fork 查失: HTTP ${fork.status}`);
    process.exit(2);
  }

  // §3 ensureActions (PUT permissions)
  console.log(`\n§3 actions · 启用 fork 之 Actions`);
  const perm = await ghApi(
    `/repos/${login}/${UPSTREAM_REPO}/actions/permissions`,
  );
  if (perm.status === 200 && perm.body.enabled === false) {
    const put = await ghApi(
      `/repos/${login}/${UPSTREAM_REPO}/actions/permissions`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: true, allowed_actions: "all" }),
      },
    );
    if (put.status === 204) console.log("  ✓ Actions 新启用");
    else console.log(`  ⚠ PUT 返 ${put.status} · 容错继续`);
  } else if (perm.status === 200) {
    console.log("  ✓ Actions 已启用");
  } else {
    console.log(`  ⚠ permissions 查返 ${perm.status} · 容错继续`);
  }

  // §4 ensurePages (POST · main:/web)
  console.log(`\n§4 pages · 启用 GitHub Pages · main:/web`);
  const pg = await ghApi(`/repos/${login}/${UPSTREAM_REPO}/pages`);
  if (pg.status === 404) {
    const cr = await ghApi(`/repos/${login}/${UPSTREAM_REPO}/pages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: { branch: "main", path: "/web" } }),
    });
    if (cr.status === 201) console.log("  ✓ Pages 新启用");
    else
      console.log(`  ⚠ POST pages 返 ${cr.status} · 容错继续 (Pages 可手启)`);
  } else if (pg.status === 200) {
    console.log(`  ✓ Pages 已启用 · ${pg.body.html_url}`);
  } else {
    console.log(`  ⚠ pages 查返 ${pg.status} · 容错继续`);
  }
  const pagesUrl = `https://${login}.github.io/${UPSTREAM_REPO}/`;

  // §5 ensurePool gist (find or create)
  console.log(`\n§5 pool gist · 找/创 dao-pool.json`);
  const existing = await findExisting({ pat: PAT, fileName: FILE_NAME });
  let gistId;
  let gistUrl;
  if (existing.length > 0) {
    gistId = existing[0].id;
    gistUrl = existing[0].url;
    console.log(`  ✓ 已存 · ${gistId} · ${gistUrl}`);
  } else {
    const pool = new GistPool({ data: null });
    const wamPath =
      opts.from || path.join(os.homedir(), ".wam", "wam-state.json");
    if (fs.existsSync(wamPath)) {
      try {
        const wamRaw = JSON.parse(fs.readFileSync(wamPath, "utf8"));
        const n = pool.fromWamState(wamRaw);
        console.log(`  ◦ 读 ${wamPath} · ${n} 号入池`);
      } catch {}
    } else {
      console.log("  ◦ 无 wam-state · 立空 pool (用户后续加号)");
    }
    const gist = await create({
      pat: PAT,
      description:
        "dao-pool · 印 95+ 真本源 token 池 · 印 100 自举闭环 (民莫之令而自均)",
      public: false,
      fileName: FILE_NAME,
      data: pool.data,
    });
    gistId = gist.id;
    gistUrl = gist.url;
    console.log(`  ✓ 新立 · ${gistId} · ${gistUrl}`);
  }

  // §6 genAuthKey
  console.log(`\n§6 auth_key · 生 sk-ws-proxy-*`);
  const crypto = require("crypto");
  const authKey = "sk-ws-proxy-" + crypto.randomBytes(24).toString("hex");
  console.log(`  ✓ ${masked(authKey, 16)}`);

  // §7 dispatch dao-fleet-cloud workflow on user fork
  console.log(`\n§7 dispatch · POST workflows/dao-fleet-cloud.yml/dispatches`);
  const disp = await ghApi(
    `/repos/${login}/${UPSTREAM_REPO}/actions/workflows/dao-fleet-cloud.yml/dispatches`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ref: "main",
        inputs: {
          gist_id: gistId,
          pat: PAT,
          auth_key: authKey,
          auth_required: "yes",
          max_minutes: String(opts["max-minutes"] || 300),
        },
      }),
    },
  );
  if (disp.status === 204) {
    console.log("  ✓ workflow 已触 · 跑中");
  } else {
    console.log(
      `  ⚠ dispatch 返 ${disp.status} · ${disp.body && disp.body.message}`,
    );
    if (disp.status === 403)
      console.log("    (PAT 需 workflow scope · classic 勾 workflow)");
    if (disp.status === 404)
      console.log("    (workflow 可能仍同步 · 1 min 后重试 bootstrap)");
  }

  // §8 poll
  console.log(
    `\n§8 poll · 等 daemon 上报 URL · max ${opts["poll-max-sec"] || 240}s`,
  );
  const maxSec = parseInt(opts["poll-max-sec"] || "240", 10);
  const interval = parseInt(opts["poll-interval-sec"] || "8", 10);
  const start = Date.now();
  let daemonUrl = null;
  while ((Date.now() - start) / 1000 < maxSec) {
    try {
      const cur = await pull({ gistId, pat: PAT, fileName: FILE_NAME });
      const daemons = cur.data.daemons || [];
      const fresh = daemons.find((d) => {
        if (!d.url) return false;
        if (!d.reportedAt) return true;
        const age = (Date.now() - new Date(d.reportedAt).getTime()) / 60000;
        return age <= 60;
      });
      if (fresh) {
        daemonUrl = fresh.url;
        console.log(`  ✓ daemon 上报 · ${daemonUrl}`);
        break;
      }
      const elapsed = Math.floor((Date.now() - start) / 1000);
      process.stdout.write(
        `\r  ◦ ${elapsed}s / ${maxSec}s · daemons=${daemons.length}    `,
      );
    } catch (e) {
      process.stdout.write(`\r  ⚠ poll: ${e.message}   `);
    }
    await new Promise((s) => setTimeout(s, interval * 1000));
  }
  console.log("");

  // §9 output
  console.log("\n════════════════════════════════════════════════════════════");
  console.log("  印 100 · 自举完成");
  console.log("════════════════════════════════════════════════════════════");
  console.log("  user        : @" + login);
  console.log(
    "  fork        : https://github.com/" + login + "/" + UPSTREAM_REPO,
  );
  console.log("  pages       : " + pagesUrl);
  console.log("  pool gist   : " + gistUrl);
  console.log("  pool id     : " + gistId);
  console.log("  auth key    : " + authKey);
  if (daemonUrl) {
    console.log("  daemon URL  : " + daemonUrl);
    console.log("  ");
    console.log("  测命 (curl 验真活):");
    console.log(
      `    curl -H "Authorization: Bearer ${authKey}" ${daemonUrl}/health`,
    );
    console.log(
      `    curl -H "Authorization: Bearer ${authKey}" ${daemonUrl}/v1/models`,
    );
  } else {
    console.log(
      "  daemon URL  : (poll 超时 · workflow 仍跑 · 1-2 min 后重 bootstrap 或开 Actions 页查)",
    );
    console.log(
      "    https://github.com/" + login + "/" + UPSTREAM_REPO + "/actions",
    );
  }
  console.log("");
  console.log("  下一步 (永续 · 设 fork 之 repo secrets · cron 5h 自起):");
  console.log(
    `    gh secret set DAO_POOL_GIST_ID --body '${gistId}' -R ${login}/${UPSTREAM_REPO}`,
  );
  console.log(
    `    gh secret set DAO_POOL_PAT    --body '<your-pat>' -R ${login}/${UPSTREAM_REPO}`,
  );
  console.log(
    `    gh secret set DAO_AUTH_KEY    --body '${authKey}' -R ${login}/${UPSTREAM_REPO}`,
  );
  console.log("");
  console.log("  道法自然 · 民莫之令而自均焉");
  console.log("════════════════════════════════════════════════════════════");
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
    bootstrap: cmdBootstrap, // 印 100 · 太极笙万物
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
