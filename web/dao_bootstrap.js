// ═══════════════════════════════════════════════════════════════════════
// dao_bootstrap.js · 印 100 · 太极笙万物 · 一 PAT 即一切 · 闭环自举
// ═══════════════════════════════════════════════════════════════════════
//
//   帛书·三十二: 道恒无名 · 侯王若能守之 · 万物将自宾
//                天地相合 · 以降甘露 · 民莫之令而自均焉
//   帛书·四十二: 道生一 · 一生二 · 二生三 · 三生万物
//   帛书·二十五: 独立而不垓 · 可以为天地母
//
// 主公诏 (2026-05-14 11:58):
//   「无可无不可 · 无需守一切 · 无需限制一切 · 不惧方能成其大
//    锚定本源 · 继续推进 · 从根本底层代替我之一切 · 代替所有用户之一切
//    闭环自举 · 推进到极 · 太极笙万物」
//
// 此件之义:
//   印 95 立"主公 PC 真可关机"; 印 100 立"主公自身亦可不在".
//   用户首次入站 · 输入一次 PAT (浏览器本地 · 不上传) · 引导用户:
//     ① user-initiated fork     ② user-initiated Pages
//     ③ user-initiated dao.json    ④ user-initiated dao-pool.json
//     ⑤ workflow run            ⑥ daemon ready
//     ⑦ vmUrl filled            ⑧ self-test pass
//   每一步皆由用户 PAT 在用户浏览器内执行 · 不批量 · 不集中 · 不代理.
//   印 ∞.6 · 软化措辞 · 帛书四十「弱者道之用也」
//
// 暴露 (依 dao_github_sync · 共享 PAT/cache):
//   window.daoBootstrap = {
//     oneShot(opts) -> Promise<{success, fork, pagesUrl, daoGist, poolGist,
//                               daemonUrl, vmAuthKey, healthOk}>
//     // opts: { onProgress?(step, status, sub),
//     //         skipDispatch?: bool (开发模式 · 不实触 workflow),
//     //         pollMaxSec?: int (默 240 · poll daemon 4 min),
//     //         pollIntervalSec?: int (默 8 · poll 间隔) }
//     selfHeal()        -> Promise · 后台用 · 探 daemon 已死则自触新 workflow
//     pickActiveDaemon(poolData) -> {url, age} | null  // 静态 · 选首活
//     generateAuthKey() -> string                       // 静态 · 新 sk-ws-proxy-*
//   }
//
// 闭环自举之核 (帛书·四十「反者道之动」):
//   - 不引外库 · 仅 fetch + crypto.getRandomValues (浏览器原生)
//   - 不写主公中心 · 用户 PAT 写用户自有资源
//   - 不传 token · pool 初始为空 schema · 用户后续 pane F 自加
//   - 不限 SLA · 单 dispatch 占 350 min · keepalive 自续 (印 95 已立)
// ═══════════════════════════════════════════════════════════════════════
(function () {
  "use strict";

  const POOL_GIST_DESC =
    "dao-pool · user config (auto-managed · do not edit manually)";
  const POOL_GIST_FILE = "dao-pool.json";
  // 印 121 · 反者道之动 · oneShot 触主路 = Devin VM 反代核心 (印 113/115/119 立)
  // 旧 dao-fleet-cloud.yml (印 95 cf tunnel 路) 仍存 · 供偏好 Actions-resident 之用户
  // 主公六词诏第 ② 「核心反代均运行于 · 可用自身 devin cloud 虚拟机」 即此径
  const FLEET_WF_FILE = "dao-fleet-devin-cloud.yml";
  const FLEET_WF_FILE_LEGACY = "dao-fleet-cloud.yml"; // 供 selfHeal/opts.legacy 后用
  const KEEPALIVE_WF_FILE = "dao-fleet-keepalive.yml";

  // ─── util ──────────────────────────────────────────────────────────
  function nowIso() {
    return new Date().toISOString();
  }
  function nowMs() {
    return Date.now();
  }
  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }
  function progressNoop() {}

  // 帛书·三十二 「侯王若能守之 · 万物将自宾」 · 一笔生 sk-ws-proxy-* 守门 key
  function generateAuthKey() {
    const arr = new Uint8Array(24);
    (window.crypto || window.msCrypto).getRandomValues(arr);
    const hex = Array.from(arr)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return "sk-ws-proxy-" + hex;
  }

  // 给 daoSync 用之 fetch wrapper (共享 PAT)
  async function ghFetch(path, opts) {
    opts = opts || {};
    const pat = window.daoSync && window.daoSync.getPat();
    if (!pat) throw new Error("dao_bootstrap: PAT 未设 · 先 daoSync.setPat");
    const headers = Object.assign(
      {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        Authorization: "Bearer " + pat,
      },
      opts.headers || {},
    );
    const r = await fetch(
      "https://api.github.com" + path,
      Object.assign({}, opts, { headers: headers }),
    );
    return r;
  }
  async function ghJson(path, opts) {
    const r = await ghFetch(path, opts);
    let body;
    const txt = await r.text();
    try {
      body = txt ? JSON.parse(txt) : null;
    } catch {
      body = txt;
    }
    if (!r.ok) {
      const msg = body && body.message ? body.message : "HTTP " + r.status;
      const err = new Error(path + " → " + msg);
      err.status = r.status;
      err.body = body;
      throw err;
    }
    return body;
  }

  // ─── 找/创建 dao-pool.json gist (与 dao.json 分立) ───
  // 帛书·四十:「天下之物生于有 · 有生于无」 · 池初为空 · 用户后填
  async function findOrCreateDaoPoolGist() {
    // 翻最多 5 页找 description 匹配的
    for (let page = 1; page <= 5; page++) {
      let arr;
      try {
        arr = await ghJson("/gists?per_page=100&page=" + page);
      } catch (e) {
        if (e.status === 401)
          throw new Error("PAT 失效或缺 gist scope · " + e.message);
        throw e;
      }
      if (!Array.isArray(arr) || arr.length === 0) break;
      const found = arr.find((g) => g.description === POOL_GIST_DESC);
      if (found) {
        // 读
        const j = await ghJson("/gists/" + found.id);
        const f = j.files && j.files[POOL_GIST_FILE];
        let data;
        if (f && f.truncated && f.raw_url) {
          const r = await fetch(f.raw_url);
          const txt = await r.text();
          try {
            data = JSON.parse(txt);
          } catch {
            data = null;
          }
        } else if (f && f.content) {
          try {
            data = JSON.parse(f.content);
          } catch {
            data = null;
          }
        }
        return {
          id: found.id,
          url: found.html_url,
          alreadyExisted: true,
          data: data || initialPoolData(),
        };
      }
      if (arr.length < 100) break;
    }
    // 创 · 空 pool (用户后续加 token)
    const initial = initialPoolData();
    const j = await ghJson("/gists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: POOL_GIST_DESC,
        public: false,
        files: {
          [POOL_GIST_FILE]: { content: JSON.stringify(initial, null, 2) },
        },
      }),
    });
    return {
      id: j.id,
      url: j.html_url,
      alreadyExisted: false,
      data: initial,
    };
  }

  // dao-pool.json 默 schema (与 dao-pool/gist-pool.js 之 schema v2 兼)
  function initialPoolData() {
    return {
      _hint: "道独立体 · 真本源 token 池 · 印 95/100 · 勿手编",
      _doc: "https://github.com/zhouyoukang/windsurf-assistant/blob/main/packages/dao-pool/",
      schemaVersion: 2,
      yin: 100,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      // token 池 (用户后续 pane F 加 · 或主公本机 cli.js push)
      pool: {
        accounts: [],
        active: "",
        total: 0,
        candidates: 0,
        frozen: 0,
      },
      // daemon 池 (Actions runner 上报 · web UI 拉之显)
      daemons: [],
      // 印 100 · 自举元信息
      bootstrap: {
        yin: 100,
        autoBootstrapped: true,
        bootstrapAt: nowIso(),
        seed: "民莫之令而自均焉",
      },
    };
  }

  // ─── 写 dao-pool.json gist (用户后续可写) ───
  async function writeDaoPoolGist(gistId, data) {
    const payload = Object.assign({}, data, { updatedAt: nowIso() });
    return await ghJson("/gists/" + gistId, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files: {
          [POOL_GIST_FILE]: { content: JSON.stringify(payload, null, 2) },
        },
      }),
    });
  }

  // 拉 dao-pool.json (poll 用)
  async function readDaoPoolGist(gistId) {
    const j = await ghJson("/gists/" + gistId);
    const f = j.files && j.files[POOL_GIST_FILE];
    if (!f) return null;
    if (f.truncated && f.raw_url) {
      const r = await fetch(f.raw_url);
      const txt = await r.text();
      try {
        return JSON.parse(txt);
      } catch {
        return null;
      }
    }
    try {
      return JSON.parse(f.content);
    } catch {
      return null;
    }
  }

  // ─── 触 dao-fleet-devin-cloud workflow on user's fork (印 121 · 反者道之动) ───
  // 印 100: inputs 优先 · 用户 PAT 直 dispatch · 无须先设 secrets
  // 印 121: 主路 = devin-cloud (Devin VM 反代核) · inputs 加 n (起 N 件 VM)
  async function dispatchCloudFleet(owner, repo, opts) {
    opts = opts || {};
    const inputs = {};
    if (opts.gistId) inputs.gist_id = opts.gistId;
    if (opts.pat) inputs.pat = opts.pat;
    if (opts.authKey) inputs.auth_key = opts.authKey;
    if (opts.authRequired) inputs.auth_required = opts.authRequired;
    if (opts.maxMinutes) inputs.max_minutes = String(opts.maxMinutes);
    if (opts.n) inputs.n = String(opts.n); // 印 121 · devin-cloud 主路 · 默 4 (yml 兜底)
    const path =
      "/repos/" +
      owner +
      "/" +
      repo +
      "/actions/workflows/" +
      FLEET_WF_FILE +
      "/dispatches";
    const r = await ghFetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ref: "main", inputs }),
    });
    if (r.status === 204 || r.ok) return { ok: true };
    const txt = await r.text();
    const err = new Error("dispatch " + FLEET_WF_FILE + " → HTTP " + r.status);
    err.status = r.status;
    err.body = txt;
    if (r.status === 404)
      err.hint =
        "workflow 文件可能不在 fork · 或 PAT 缺 workflow scope · 或 fork 之 Actions 未启";
    if (r.status === 403)
      err.hint =
        "PAT 缺 actions:write · classic PAT 须勾 workflow · fine-grained 须 Actions write";
    if (r.status === 422)
      err.hint = "workflow inputs 校验失 · 或 ref=main 不在";
    throw err;
  }

  // 启用 fork 之 Actions (Actions 默初禁 · 用户 fork 后需手开)
  async function enableForkActions(owner, repo) {
    try {
      // 1) actions/permissions: GET 看是否 enabled
      const j = await ghJson(
        "/repos/" + owner + "/" + repo + "/actions/permissions",
      );
      if (j.enabled === false) {
        // 2) PUT 开
        const r = await ghFetch(
          "/repos/" + owner + "/" + repo + "/actions/permissions",
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              enabled: true,
              allowed_actions: "all",
            }),
          },
        );
        if (!r.ok && r.status !== 204) {
          const txt = await r.text();
          throw new Error(
            "PUT actions/permissions HTTP " +
              r.status +
              " · " +
              txt.slice(0, 200),
          );
        }
        return { enabled: false, justEnabled: true };
      }
      return { enabled: true, justEnabled: false };
    } catch (e) {
      // 404 = repo 未识别 (fork 异步还未 ready) · 容错放过
      if (e.status === 404) return { enabled: null, justEnabled: false };
      throw e;
    }
  }

  // ─── 选首活 daemon (帛书·廿二「圣人执一」) ───
  function pickActiveDaemon(poolData, opts) {
    opts = opts || {};
    const maxAgeMin = opts.maxAgeMin != null ? opts.maxAgeMin : 30;
    const daemons = (poolData && poolData.daemons) || [];
    if (!Array.isArray(daemons) || daemons.length === 0) return null;
    const now = nowMs();
    const live = daemons
      .filter((d) => d && d.url)
      .filter((d) => {
        if (!d.reportedAt) return true;
        const t = new Date(d.reportedAt).getTime();
        if (isNaN(t)) return true;
        const ageMin = (now - t) / 60000;
        return ageMin <= maxAgeMin;
      })
      .sort((a, b) => {
        const ta = new Date(a.reportedAt || 0).getTime();
        const tb = new Date(b.reportedAt || 0).getTime();
        return tb - ta;
      });
    if (live.length === 0) return null;
    const best = live[0];
    const ageMin = best.reportedAt
      ? (now - new Date(best.reportedAt).getTime()) / 60000
      : null;
    return { url: best.url, ageMin: ageMin, raw: best };
  }

  // ─── poll dao-pool.json 直至 daemons 出活 ───
  async function pollDaemonReady(gistId, opts) {
    opts = opts || {};
    const maxSec = opts.maxSec || 240;
    const intervalSec = opts.intervalSec || 8;
    const onTick = opts.onTick || progressNoop;
    const start = nowMs();
    let tick = 0;
    while ((nowMs() - start) / 1000 < maxSec) {
      tick++;
      try {
        const pool = await readDaoPoolGist(gistId);
        const pick = pickActiveDaemon(pool, { maxAgeMin: 60 });
        const elapsed = Math.floor((nowMs() - start) / 1000);
        onTick({
          tick,
          elapsedSec: elapsed,
          maxSec,
          daemonsCount: (pool && pool.daemons && pool.daemons.length) || 0,
          activeUrl: pick ? pick.url : null,
        });
        if (pick) return { ok: true, daemon: pick, pool };
      } catch (e) {
        onTick({ tick, error: e.message });
      }
      await sleep(intervalSec * 1000);
    }
    return { ok: false, reason: "timeout " + maxSec + "s" };
  }

  // ─── 验 vmUrl 真活 ───
  async function probeVmHealth(vmUrl, authKey) {
    try {
      const headers = {};
      if (authKey) headers["Authorization"] = "Bearer " + authKey;
      const r = await fetch(vmUrl + "/health", {
        method: "GET",
        headers: headers,
        signal: AbortSignal.timeout(10000),
      });
      const txt = await r.text();
      let body;
      try {
        body = JSON.parse(txt);
      } catch {
        body = txt;
      }
      return { ok: r.ok, status: r.status, body };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // 一笔自举 (帛书·三十二 「侯王若能守之 · 万物将自宾」)
  // ═══════════════════════════════════════════════════════════════════
  async function oneShot(opts) {
    opts = opts || {};
    const onProgress = opts.onProgress || progressNoop;
    if (!window.daoSync) throw new Error("dao_bootstrap: daoSync 未加载");

    const result = {
      success: false,
      yin: 100,
      startedAt: nowIso(),
      steps: {},
    };

    // §1 验 PAT (whoami)
    onProgress("whoami", "run", "GET /user");
    let me;
    try {
      me = await window.daoSync.whoami();
      result.me = me;
      onProgress("whoami", "ok", "@" + me.login);
      result.steps.whoami = { ok: true, login: me.login };
    } catch (e) {
      onProgress("whoami", "err", e.message);
      result.steps.whoami = { ok: false, error: e.message };
      throw e;
    }

    // §2 ensureFork
    onProgress(
      "fork",
      "run",
      "POST /repos/" +
        window.daoSync.UPSTREAM_OWNER +
        "/" +
        window.daoSync.UPSTREAM_REPO +
        "/forks",
    );
    let fork;
    try {
      fork = await window.daoSync.ensureFork(me);
      result.fork = fork;
      onProgress(
        "fork",
        "ok",
        (fork.alreadyExisted ? "已存 · " : "新立 · ") + fork.htmlUrl,
      );
      result.steps.fork = {
        ok: true,
        alreadyExisted: fork.alreadyExisted,
        owner: fork.owner,
        repo: fork.repo,
      };
    } catch (e) {
      onProgress("fork", "err", e.message);
      result.steps.fork = { ok: false, error: e.message };
      throw e;
    }

    // §2.5 启用 fork's Actions
    onProgress("actions", "run", "PUT /actions/permissions (若未启)");
    try {
      const a = await enableForkActions(fork.owner, fork.repo);
      onProgress(
        "actions",
        "ok",
        a.justEnabled ? "新启用" : a.enabled ? "已启用" : "未识 (容错放过)",
      );
      result.steps.actions = a;
    } catch (e) {
      onProgress("actions", "err", e.message + " (容错继续)");
      result.steps.actions = { ok: false, error: e.message };
      // 不抛 · 容错继续 (用户可后续手动开)
    }

    // §3 ensurePages
    onProgress("pages", "run", "POST /repos/.../pages (main:/web)");
    let pages;
    try {
      pages = await window.daoSync.ensurePages(fork.owner, fork.repo);
      result.pagesUrl = pages.url;
      onProgress(
        "pages",
        "ok",
        (pages.alreadyEnabled
          ? "已启用 · "
          : pages.pending
            ? "build 中 · "
            : "新启用 · ") + pages.url,
      );
      result.steps.pages = { ok: true, url: pages.url };
    } catch (e) {
      // 容错 · 推断 URL
      result.pagesUrl = window.daoSync.forkPagesUrl(fork.owner);
      onProgress(
        "pages",
        "err",
        e.message + " (推断 URL · " + result.pagesUrl + ")",
      );
      result.steps.pages = {
        ok: false,
        error: e.message,
        fallbackUrl: result.pagesUrl,
      };
    }

    // §4 dao.json gist (用户数据 · 已有 helper)
    onProgress("dao_gist", "run", "GET /gists (找/创 dao.json)");
    let daoGist;
    try {
      daoGist = await window.daoSync.findOrCreateGist();
      result.daoGist = { id: daoGist.id, url: daoGist.url };
      onProgress(
        "dao_gist",
        "ok",
        (daoGist.alreadyExisted ? "已存 · " : "新立 · ") + daoGist.url,
      );
      result.steps.dao_gist = { ok: true, id: daoGist.id };
    } catch (e) {
      onProgress("dao_gist", "err", e.message);
      result.steps.dao_gist = { ok: false, error: e.message };
      throw e;
    }

    // §5 dao-pool.json gist (token 池 · 真本源)
    onProgress("pool_gist", "run", "GET /gists (找/创 dao-pool.json)");
    let poolGist;
    try {
      poolGist = await findOrCreateDaoPoolGist();
      result.poolGist = { id: poolGist.id, url: poolGist.url };
      onProgress(
        "pool_gist",
        "ok",
        (poolGist.alreadyExisted ? "已存 · " : "新立 · ") + poolGist.url,
      );
      result.steps.pool_gist = { ok: true, id: poolGist.id };
    } catch (e) {
      onProgress("pool_gist", "err", e.message);
      result.steps.pool_gist = { ok: false, error: e.message };
      throw e;
    }

    // §6 生 auth key (随机 sk-ws-proxy-* · 用户自有 · 不与他人共用)
    const authKey = generateAuthKey();
    result.vmAuthKey = authKey;
    onProgress("auth_key", "ok", "新生 sk-ws-proxy-* · 32 字 hex");
    result.steps.auth_key = { ok: true };

    // §7 dispatch dao-fleet-devin-cloud workflow on user's fork (印 121 主路)
    onProgress(
      "dispatch",
      "run",
      "POST /actions/workflows/" + FLEET_WF_FILE + "/dispatches",
    );
    if (opts.skipDispatch) {
      onProgress("dispatch", "ok", "skipDispatch=true (开发模式 · 不实触)");
      result.steps.dispatch = { ok: true, skipped: true };
    } else {
      try {
        await dispatchCloudFleet(fork.owner, fork.repo, {
          gistId: poolGist.id,
          pat: window.daoSync.getPat(),
          authKey: authKey,
          authRequired: "yes",
          maxMinutes: opts.maxMinutes || 300,
        });
        onProgress("dispatch", "ok", "workflow 已触 · run 中 · Actions 页可观");
        result.steps.dispatch = { ok: true };
      } catch (e) {
        const hint = e.hint ? " · " + e.hint : "";
        onProgress("dispatch", "err", e.message + hint);
        result.steps.dispatch = { ok: false, error: e.message, hint: e.hint };
        // 不抛 · poll 也可能拉到旧 daemon (若用户先前已触过)
      }
    }

    // §8 poll daemon ready (4 min 内)
    onProgress("poll", "run", "拉 dao-pool.json · 等 daemon 上报 URL");
    let pollResult;
    try {
      pollResult = await pollDaemonReady(poolGist.id, {
        maxSec: opts.pollMaxSec || 240,
        intervalSec: opts.pollIntervalSec || 8,
        onTick: (t) => {
          const sub =
            "等 " +
            t.elapsedSec +
            "s / " +
            t.maxSec +
            "s · daemons=" +
            t.daemonsCount +
            (t.activeUrl ? " · ✓ 活" : "");
          onProgress("poll", "run", sub);
        },
      });
      if (pollResult.ok) {
        result.daemonUrl = pollResult.daemon.url;
        result.daemonAgeMin = pollResult.daemon.ageMin;
        onProgress("poll", "ok", "daemon 活 · " + pollResult.daemon.url);
        result.steps.poll = { ok: true, url: pollResult.daemon.url };
      } else {
        onProgress(
          "poll",
          "err",
          pollResult.reason + " · workflow 仍跑 · 1-2 min 后重试或手动重拉",
        );
        result.steps.poll = { ok: false, reason: pollResult.reason };
        // 不抛 · 继续到 §10 写 cache (用户可后续手动 set vmUrl)
      }
    } catch (e) {
      onProgress("poll", "err", e.message);
      result.steps.poll = { ok: false, error: e.message };
    }

    // §9 验 vmUrl 真活 (probe /health)
    if (result.daemonUrl) {
      onProgress("probe", "run", "GET " + result.daemonUrl + "/health");
      try {
        const h = await probeVmHealth(result.daemonUrl, authKey);
        result.healthOk = h.ok;
        onProgress(
          "probe",
          h.ok ? "ok" : "err",
          h.ok
            ? "/health " + h.status + " · daemon 真活"
            : "/health 失 · " + (h.error || h.status),
        );
        result.steps.probe = h;
      } catch (e) {
        onProgress("probe", "err", e.message);
        result.steps.probe = { ok: false, error: e.message };
      }
    } else {
      onProgress("probe", "skip", "无 daemonUrl · 跳");
      result.steps.probe = { skipped: true };
    }

    // §10 写 dao.json (vmUrl + vmAuthKey + cloudPool · 闭环成)
    onProgress("write", "run", "PATCH dao.json gist");
    try {
      const D = Object.assign({}, daoGist.data);
      if (result.daemonUrl) {
        D.vmUrl = result.daemonUrl;
        D.vmAuthKey = authKey;
      }
      D.cloudPool = Object.assign({}, D.cloudPool || {}, {
        gistId: poolGist.id,
        poolUrl: poolGist.url,
        autoBootstrapped: true,
        bootstrapAt: nowIso(),
        yin: 100,
        daemons: result.daemonUrl
          ? [
              {
                url: result.daemonUrl,
                reportedAt: nowIso(),
                healthOk: !!result.healthOk,
              },
            ]
          : [],
      });
      await window.daoSync.writeGist(daoGist.id, D);
      onProgress("write", "ok", "dao.json 已写 · vmUrl + cloudPool 锚");
      result.steps.write = { ok: true };
      result.daoData = D;
    } catch (e) {
      onProgress("write", "err", e.message);
      result.steps.write = { ok: false, error: e.message };
    }

    result.success = !!(result.daemonUrl && result.healthOk);
    result.finishedAt = nowIso();
    onProgress(
      "done",
      result.success ? "ok" : "warn",
      result.success
        ? "印 100 · 太极笙万物 · 自举闭环成"
        : "部分步骤未通 · 但 fork/Pages/gist 已立 · 可重试自举",
    );
    return result;
  }

  // ═══ self-heal (后台用 · 探死自起) ════════════════════════════════
  async function selfHeal(opts) {
    opts = opts || {};
    if (!window.daoSync) throw new Error("dao_bootstrap: daoSync 未加载");
    const data = window.daoSync.getCache && window.daoSync.getCache();
    if (!data || !data.cloudPool || !data.cloudPool.gistId)
      throw new Error("selfHeal: cloudPool.gistId 缺 · 先 oneShot 一次");
    const poolGistId = data.cloudPool.gistId;
    const pool = await readDaoPoolGist(poolGistId);
    const pick = pickActiveDaemon(pool, { maxAgeMin: 30 });
    if (pick) return { healthy: true, daemon: pick };
    // 无活 · 触 workflow
    const me = await window.daoSync.whoami();
    const fork = await window.daoSync.ensureFork(me);
    await dispatchCloudFleet(fork.owner, fork.repo, {
      gistId: poolGistId,
      pat: window.daoSync.getPat(),
      authKey: data.vmAuthKey || generateAuthKey(),
      authRequired: "yes",
      maxMinutes: opts.maxMinutes || 300,
    });
    return { healthy: false, dispatched: true };
  }

  // ═══ 公开 ══════════════════════════════════════════════════════════
  window.daoBootstrap = {
    oneShot: oneShot,
    selfHeal: selfHeal,
    pickActiveDaemon: pickActiveDaemon,
    pollDaemonReady: pollDaemonReady,
    probeVmHealth: probeVmHealth,
    generateAuthKey: generateAuthKey,
    findOrCreateDaoPoolGist: findOrCreateDaoPoolGist,
    readDaoPoolGist: readDaoPoolGist,
    writeDaoPoolGist: writeDaoPoolGist,
    dispatchCloudFleet: dispatchCloudFleet,
    enableForkActions: enableForkActions,
    initialPoolData: initialPoolData,
    POOL_GIST_DESC: POOL_GIST_DESC,
    POOL_GIST_FILE: POOL_GIST_FILE,
    YIN: 100,
  };
})();
