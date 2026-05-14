// ═══════════════════════════════════════════════════════════════════════
// dao_github_sync.js · 印 67 · 道独立体公网同步层 · 道并行而不悖
// ═══════════════════════════════════════════════════════════════════════
//
// 帛书·二十五:   独立而不垓 · 可以为天地母
// 帛书·七十八:   受邦之诟 · 是谓社稷之主 · 受邦之不祥 · 是谓天下之王
// 帛书·二十四:   炊者不立 · 自视不章 · 自见者不明 · 自伐者无功
//
// 用户视角:
//   公网入口页 (zhouyoukang.github.io/windsurf-assistant/) 仅一个 PAT 登入按钮.
//   登入后自动 fork → 启 Pages → 建私有 Gist → 跳专属页 (<user>.github.io/...).
//   所有数据 (VM URL · accounts · SP) 均落用户自有 GitHub 资源, zhouyoukang 不持任何字节.
//
// 道义:
//   一次"为" (粘 PAT), 之后皆"无为" — 这就是"最小化无为之感为锚".
//   每个 fork 部署点 = 用户自己的反代入口 + 自己的 Devin VM + 自己的 Windsurf 账号.
//   "原汤化原食" · 账号本身即一切.
//
// 零依赖 · 仅 fetch · 浏览器 Web Crypto · GitHub REST v3
// ═══════════════════════════════════════════════════════════════════════
(function () {
  "use strict";

  const API_BASE = "https://api.github.com";
  const UPSTREAM_OWNER = "zhouyoukang";
  const UPSTREAM_REPO = "windsurf-assistant";
  const GIST_DESC =
    "道独立体 · Windsurf Assistant · user data (private · do not edit by hand)";
  const GIST_FILE = "dao.json";

  // localStorage 键 (per-origin · fork 与 upstream 自然隔离)
  const LS = {
    PAT: "dao.pat", // GitHub PAT
    STATE: "dao.state.v1", // cached identity + onboarding state
    CACHE: "dao.cache.v1", // last Gist payload (offline first-paint)
  };

  // 默认 schema (新建 Gist 时落入)
  const DEFAULT_DAO_DATA = {
    _hint: "道独立体 · 用户云端数据 · 由 dao_github_sync.js 管理 · 勿手动编辑",
    _doc: "https://github.com/" + UPSTREAM_OWNER + "/" + UPSTREAM_REPO,
    schemaVersion: 1,
    createdAt: "",
    updatedAt: "",
    // 反代 VM
    vmUrl: "", // https://xxx.trycloudflare.com  (no trailing slash, no /v1)
    vmAuthKey: "", // sk-ws-proxy-* (gate key for /v1/*)
    // Windsurf 账号库 (一账号一 VM · 原汤化原食)
    accounts: [
      // { email, apiKey, label, vmUrl?, vmAuthKey?, addedAt, lastUsedAt, quotaD?, quotaW?, alive? }
    ],
    activeAccountEmail: "",
    // 反代提示词管理 (印 52 守一不离)
    sp: {
      mode: "passthrough", // passthrough | dao | custom
      custom: "",
      stripSideChannel: false,
      stripMemory: false,
      neutralizeOverride: false,
      injectKeeps: true,
      keeps: {
        tool_calling: true,
        mcp_servers: true,
        user_information: true,
        workspace_information: true,
      },
    },
    // 对话历史 (last 50)
    chatHistory: [],
    // 印 91 · 右栏 UI 态
    lastModel: "claude-sonnet-4-20250514", // 最近选 model (badge 用)
    useDevinIframe: false, // 右栏一笔切到 app.devin.ai iframe (配 dao-injector)
    // 印 95 · 真本源闭环 · 云端 daemon 池
    // 印 100 · 太极笙万物 · 一 PAT 即一切 · 闭环自举 (民莫之令而自均)
    //   帛书·四十:  「反者道之动」 · 帛书·廿五: 「独立而不垓」
    //   帛书·三十二: 「侯王若能守之 · 万物将自宾 · 天地相合 · 以降甘露」
    //   用户私 gist 存 token 池 · GH Actions 拉之起 daemon · 报 URL 回 gist · 本面拉之显
    //   一 GH 账号即一切 · 主公 PC 关亦活 · 主公自身亦可不在
    cloudPool: {
      gistId: "", // 用户私 gist ID (dao-pool.json) · 自找或手输 · 印 100 自创
      poolUrl: "", // 印 100 · gist html_url (UI 可点)
      daemons: [], // 缓存之 daemon 列 · 来自 gist /report-daemon-url 之累积
      poolTotal: 0, // 缓存之 token 池 total
      poolCandidates: 0, // 候选数 (W=0 · 未冻)
      fetchedAt: 0, // 上一次拉之时
      autoBootstrapped: false, // 印 100 · 是否由 oneShot 自举
      bootstrapAt: "", // 印 100 · 自举完成时
      yin: 0, // 印 100 标记
    },
    // UI 偏好
    ui: { theme: "dark", colWidths: null, lastTab: "chat" },
  };

  // ─── GitHub fetch wrapper ───
  function gh(path, opts) {
    opts = opts || {};
    const pat = localStorage.getItem(LS.PAT) || "";
    const headers = Object.assign(
      {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      opts.headers || {},
    );
    if (pat) headers["Authorization"] = "Bearer " + pat;
    return fetch(
      API_BASE + path,
      Object.assign({}, opts, { headers: headers }),
    );
  }

  async function ghJson(path, opts) {
    const r = await gh(path, opts);
    let body = null;
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

  // 等 fork ready (POST forks 异步 · 需 polling)
  async function waitForkReady(owner, repo, maxTries, intervalMs) {
    maxTries = maxTries || 30;
    intervalMs = intervalMs || 1000;
    for (let i = 0; i < maxTries; i++) {
      try {
        const j = await ghJson("/repos/" + owner + "/" + repo);
        return j;
      } catch (e) {
        if (e.status === 404) {
          // 尚未 ready · 继续
        } else throw e;
      }
      await new Promise((s) => setTimeout(s, intervalMs));
    }
    throw new Error(
      "fork ready timeout after " + (maxTries * intervalMs) / 1000 + "s",
    );
  }

  // ─── public API ───
  window.daoSync = {
    // 常量暴露 (UI 可读)
    UPSTREAM_OWNER: UPSTREAM_OWNER,
    UPSTREAM_REPO: UPSTREAM_REPO,
    GIST_DESC: GIST_DESC,
    GIST_FILE: GIST_FILE,

    // ─── PAT ─────────────────────────────────────────────────────────
    // 粘 PAT (fine-grained 推荐 · classic 也行 · 必含 repo + gist scope)
    setPat(pat) {
      if (typeof pat !== "string") throw new Error("PAT must be string");
      pat = pat.trim();
      if (!pat) throw new Error("PAT empty");
      // 简单格式校验 (不强制, GH 偶有变)
      const looksLikeGh =
        /^gh[pousr]_[A-Za-z0-9_]{20,}$/.test(pat) ||
        /^github_pat_[A-Za-z0-9_]{30,}$/.test(pat);
      if (!looksLikeGh) {
        console.warn(
          "[daoSync] PAT format not recognised (expect ghp_*, github_pat_*, gho_*, etc.) · 仍尝试",
        );
      }
      localStorage.setItem(LS.PAT, pat);
    },
    getPat() {
      return localStorage.getItem(LS.PAT) || "";
    },
    hasPat() {
      return !!this.getPat();
    },
    clearPat() {
      localStorage.removeItem(LS.PAT);
      localStorage.removeItem(LS.STATE);
      // 不删 LS.CACHE · 让用户保留 offline data
    },

    // ─── identity ────────────────────────────────────────────────────
    async whoami() {
      const j = await ghJson("/user");
      return {
        login: j.login,
        id: j.id,
        avatar: j.avatar_url,
        name: j.name || j.login,
        htmlUrl: j.html_url,
      };
    },

    // ─── fork ────────────────────────────────────────────────────────
    // 确保用户已 fork upstream · 若无则创建 · 等 ready · 返回 {owner, repo, htmlUrl, alreadyExisted}
    async ensureFork(me) {
      me = me || (await this.whoami());
      // 先看是否已存
      try {
        const j = await ghJson("/repos/" + me.login + "/" + UPSTREAM_REPO);
        // 校验是 fork (而非同名 repo)
        const isFork =
          !!j.fork &&
          j.parent &&
          j.parent.full_name === UPSTREAM_OWNER + "/" + UPSTREAM_REPO;
        return {
          owner: me.login,
          repo: UPSTREAM_REPO,
          htmlUrl: j.html_url,
          defaultBranch: j.default_branch,
          alreadyExisted: true,
          isFork: isFork,
        };
      } catch (e) {
        if (e.status !== 404) throw e;
      }
      // 创建 fork (异步)
      await gh("/repos/" + UPSTREAM_OWNER + "/" + UPSTREAM_REPO + "/forks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const j2 = await waitForkReady(me.login, UPSTREAM_REPO);
      return {
        owner: me.login,
        repo: UPSTREAM_REPO,
        htmlUrl: j2.html_url,
        defaultBranch: j2.default_branch,
        alreadyExisted: false,
        isFork: true,
      };
    },

    // ─── Pages ───────────────────────────────────────────────────────
    // 确保 fork Pages enabled · source=main:/web · 返 {url, alreadyEnabled}
    async ensurePages(owner, repo) {
      repo = repo || UPSTREAM_REPO;
      // 先查
      try {
        const j = await ghJson("/repos/" + owner + "/" + repo + "/pages");
        return {
          url: j.html_url,
          alreadyEnabled: true,
          status: j.status,
          cname: j.cname,
        };
      } catch (e) {
        if (e.status !== 404) throw e;
      }
      // 启用 · 默 main:/web
      const body = JSON.stringify({ source: { branch: "main", path: "/web" } });
      let createResp;
      try {
        createResp = await gh("/repos/" + owner + "/" + repo + "/pages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: body,
        });
      } catch (e) {
        throw new Error("启用 Pages 失败 · 网络: " + e.message);
      }
      if (!createResp.ok && createResp.status !== 201) {
        const txt = await createResp.text().catch(() => "");
        throw new Error(
          "启用 Pages 失败 · " + createResp.status + " · " + txt.slice(0, 200),
        );
      }
      // 短轮询拿 html_url
      for (let i = 0; i < 20; i++) {
        await new Promise((s) => setTimeout(s, 1500));
        try {
          const j = await ghJson("/repos/" + owner + "/" + repo + "/pages");
          if (j && j.html_url)
            return { url: j.html_url, alreadyEnabled: false, status: j.status };
        } catch (e) {
          /* 继续 */
        }
      }
      // 即便没拿到 (Pages 在 build 中), 也给出推断 URL
      return {
        url: "https://" + owner + ".github.io/" + repo + "/",
        alreadyEnabled: false,
        pending: true,
      };
    },

    // ─── Gist ────────────────────────────────────────────────────────
    // 查找/创建用户的私有 dao.json Gist · 返 {id, alreadyExisted, url, data}
    async findOrCreateGist() {
      // 翻最多 5 页 (500 个 gist) 找 description 匹配的
      for (let page = 1; page <= 5; page++) {
        let arr;
        try {
          arr = await ghJson("/gists?per_page=100&page=" + page);
        } catch (e) {
          throw e;
        }
        if (!Array.isArray(arr) || arr.length === 0) break;
        const found = arr.find((g) => g.description === GIST_DESC);
        if (found) {
          const data = await this.readGist(found.id);
          return {
            id: found.id,
            url: found.html_url,
            alreadyExisted: true,
            data: data,
          };
        }
        if (arr.length < 100) break;
      }
      // 创建
      const initial = Object.assign({}, DEFAULT_DAO_DATA, {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      const j = await ghJson("/gists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: GIST_DESC,
          public: false,
          files: { [GIST_FILE]: { content: JSON.stringify(initial, null, 2) } },
        }),
      });
      return {
        id: j.id,
        url: j.html_url,
        alreadyExisted: false,
        data: initial,
      };
    },

    async readGist(gistId) {
      const j = await ghJson("/gists/" + gistId);
      const f = j.files && j.files[GIST_FILE];
      if (!f) return Object.assign({}, DEFAULT_DAO_DATA);
      // truncated 大 Gist (>1MB) 时 f.truncated=true · 此时需 fetch raw_url
      if (f.truncated && f.raw_url) {
        const r = await fetch(f.raw_url);
        const txt = await r.text();
        try {
          return JSON.parse(txt);
        } catch {
          return Object.assign({}, DEFAULT_DAO_DATA);
        }
      }
      try {
        return JSON.parse(f.content);
      } catch {
        return Object.assign({}, DEFAULT_DAO_DATA);
      }
    },

    async writeGist(gistId, data) {
      const payload = Object.assign({}, data, {
        updatedAt: new Date().toISOString(),
      });
      const j = await ghJson("/gists/" + gistId, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: { [GIST_FILE]: { content: JSON.stringify(payload, null, 2) } },
        }),
      });
      // 同步缓存
      try {
        localStorage.setItem(LS.CACHE, JSON.stringify(payload));
      } catch {}
      return payload;
    },

    // ─── State (local cache) ─────────────────────────────────────────
    getState() {
      try {
        return JSON.parse(localStorage.getItem(LS.STATE) || "{}");
      } catch {
        return {};
      }
    },
    setState(patch) {
      const s = this.getState();
      const merged = Object.assign({}, s, patch);
      localStorage.setItem(LS.STATE, JSON.stringify(merged));
      return merged;
    },
    getCache() {
      try {
        return JSON.parse(localStorage.getItem(LS.CACHE) || "null");
      } catch {
        return null;
      }
    },
    setCache(data) {
      try {
        localStorage.setItem(LS.CACHE, JSON.stringify(data));
      } catch {}
    },

    // ─── Site detection ──────────────────────────────────────────────
    // 解出当前页是 upstream / 用户 fork / 本地 / 其他静态托管
    detectSite() {
      const host = window.location.host;
      const path = window.location.pathname;
      let owner = "";
      // github.io 域: <user>.github.io
      const mIo = host.match(/^([^.]+)\.github\.io$/);
      if (mIo) owner = mIo[1];
      // GitHub Codespaces / Spaces 等不识别 → owner 留空
      const isLocal =
        host === "localhost" ||
        host === "127.0.0.1" ||
        host.startsWith("localhost:") ||
        host.startsWith("127.0.0.1:") ||
        host.startsWith("192.168.") ||
        host.startsWith("10.") ||
        host === "" ||
        host.startsWith("file:");
      return {
        host: host,
        path: path,
        owner: owner,
        isUpstream: owner === UPSTREAM_OWNER,
        isUserFork: !!owner && owner !== UPSTREAM_OWNER,
        isLocal: isLocal,
        isUnknown: !owner && !isLocal,
      };
    },

    // 推用户专属页 URL (用户 fork 的 Pages)
    forkPagesUrl(login) {
      return "https://" + login + ".github.io/" + UPSTREAM_REPO + "/";
    },

    // 推 raw.githubusercontent.com URL (用户 fork)
    rawUrl(owner, branch, path) {
      branch = branch || "main";
      return (
        "https://raw.githubusercontent.com/" +
        owner +
        "/" +
        UPSTREAM_REPO +
        "/" +
        branch +
        "/" +
        path
      );
    },

    // ─── 默认 schema 暴露 (UI 初始化用) ─────────────────────────────
    defaultData() {
      return JSON.parse(JSON.stringify(DEFAULT_DAO_DATA));
    },
  };
})();
