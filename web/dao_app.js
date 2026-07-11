// ═══════════════════════════════════════════════════════════════════════
// dao_app.js · 印 67 → 印 69 · 道独立体公网交互层 · 道法自然
// 印 69 修: el() boolean prop · messages 双filter合一 · catch 不篡 role='error'
// ═══════════════════════════════════════════════════════════════════════
//
// 帛书·二十二:   圣人执一 · 以为天下牧
// 帛书·二十五:   独立而不垓 · 可以为天地母
// 帛书·四十八:   为道者日损 · 损之又损 · 以至于无为 · 无为而无不为
//
// 三态:
//   gate       通用入口 (在 upstream · 无 PAT 或 PAT 失效) → 显示登入门
//   onboarding 在 upstream · 已识 PAT → 跑 fork → Pages → Gist → 跳专属页
//   mine       在用户 fork · 三栏 (左 API+SP / 中 WAM 切号 / 右 chat)
//
// 一气化三清 (web 是二清 · 接 dao-core / wam / dao-proxy-min 三清后端):
//   I · dao-core      → 反代 API 真本 (此 web 调 vmUrl/v1/messages)
//   II · wam          → 切号引擎 (此 web 中栏 WAM 池管 + 印 129 自动登)
//   III · dao-proxy-min → 提示词反代 (此 web 左栏 SP 7 态)
//
// 数据流:
//   gist (云) ─── readGist ───→ memo ──[user edit + debounce 1.5s]→ writeGist
//   memo · 单一真相 · 修一处万法响应
//
// 0 依赖 · 纯浏览器 · 仅 fetch + Web Crypto · GitHub REST v3
// ═══════════════════════════════════════════════════════════════════════
(function () {
  "use strict";

  // ─── DOM helpers ────────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);
  const $$ = (sel, root) =>
    Array.from((root || document).querySelectorAll(sel));
  function el(tag, attrs, children) {
    const e = document.createElement(tag);
    if (attrs)
      for (const k in attrs) {
        if (k === "class") e.className = attrs[k];
        else if (k === "style" && typeof attrs[k] === "object")
          Object.assign(e.style, attrs[k]);
        else if (k.startsWith("on") && typeof attrs[k] === "function")
          e.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
        // 印 69 修[1]: boolean DOM property 直接 prop 赋值 · 不走 setAttribute (后者只设 attr 层不可靠)
        else if (
          k === "checked" ||
          k === "disabled" ||
          k === "readOnly" ||
          k === "selected" ||
          k === "autofocus"
        ) {
          if (attrs[k]) e[k] = true;
        } else if (attrs[k] != null) e.setAttribute(k, attrs[k]);
      }
    (Array.isArray(children) ? children : [children]).forEach((c) => {
      if (c == null) return;
      if (typeof c === "string" || typeof c === "number")
        e.appendChild(document.createTextNode(String(c)));
      else if (c instanceof Node) e.appendChild(c);
    });
    return e;
  }
  // 印 132 · 反者道之动 · show 真显 (state-mine/state-onboarding CSS 默 display:none 防 FOUC · 清 inline 后仍 none)
  //   (注: 主公印 129 是 Windsurf 真登录链 · 此印 132 避号位冲突 · playwright 真测发现治之)
  //   show() 仅用于 state-* 三处 (state-gate/state-onboarding/state-mine · 全 flex layout)
  //   旧: e.style.display = "" · 清 inline → 回 CSS · gate 默 flex 通 · mine/onboarding 默 none 仍隐 (真 bug)
  //   治: 明 set "flex" 让 inline override CSS · state-* 全显 · 不影响 hide(inline=none)
  function show(id) {
    const e = $(id);
    if (e) e.style.display = "flex";
  }
  function hide(id) {
    const e = $(id);
    if (e) e.style.display = "none";
  }
  function setText(id, t) {
    const e = $(id);
    if (e) e.textContent = t;
  }

  // ─── toast ──────────────────────────────────────────────────────────
  function toast(msg, kind) {
    kind = kind || "info";
    const tEl = $("toast");
    if (!tEl) {
      console.log("[toast] " + msg);
      return;
    }
    const item = el("div", { class: "toast-item toast-" + kind }, msg);
    tEl.appendChild(item);
    setTimeout(() => {
      item.style.opacity = "0";
      setTimeout(() => item.remove(), 350);
    }, 3000);
  }

  // ─── memo (single source of truth) ──────────────────────────────────
  const memo = {
    data: null, // dao.json payload (from Gist or cache or default)
    gistId: null,
    me: null, // GitHub user (login/avatar/...)
    fork: null, // {owner, repo, htmlUrl, ...}
    site: null, // detectSite() output
    pagesUrl: null,
    dirty: false,
    saveTimer: null,
    syncing: false,
  };

  // debounced save to Gist (1.5s)
  function markDirty() {
    memo.dirty = true;
    setText("hdr-gist", "○ 待同步…");
    if (memo.saveTimer) clearTimeout(memo.saveTimer);
    memo.saveTimer = setTimeout(() => {
      saveNow().catch((e) => toast("同步失败: " + e.message, "err"));
    }, 1500);
  }
  async function saveNow() {
    if (!memo.gistId || !memo.data) return;
    if (memo.syncing) return;
    memo.syncing = true;
    setText("hdr-gist", "↻ 同步中…");
    try {
      await daoSync.writeGist(memo.gistId, memo.data);
      memo.dirty = false;
      setText("hdr-gist", "✓ Gist 同步");
    } finally {
      memo.syncing = false;
    }
  }

  // ─── 启动 ───────────────────────────────────────────────────────────
  async function boot() {
    memo.site = daoSync.detectSite();
    // 顶栏 host 显示
    setText("hdr-host", memo.site.host || "local");

    // 无 PAT → gate
    if (!daoSync.hasPat()) {
      return renderGate();
    }
    // 有 PAT → 验
    try {
      memo.me = await daoSync.whoami();
      setText("hdr-login", "@" + memo.me.login);
    } catch (e) {
      // 印 ∞.1 (2026-05-17 道动测后修): 401 时宽容
      //   帛书·六十七「我恒有三葆之：一曰兹，二曰俭，三曰不敢为天下先」
      //   GitHub 网偶通偶断 · 401 偶现 (Bad credentials/Rate limit)
      //   若 cache 存 · 用 cache (不轻清宝物) · 联网 OK 后用户可重粘
      //   仅 cache 不存时才清 (真无据可用)
      if (e.status === 401) {
        const cache = daoSync.getCache();
        if (cache) {
          toast("PAT 401 · 暂用 cache · 联网 OK 后可重粘新 PAT", "warn");
          return renderOffline();
        }
        daoSync.clearPat();
        toast("PAT 失效 · 请重粘", "err");
        return renderGate();
      }
      toast("GitHub 不通: " + e.message + " · 离线态", "warn");
      return renderOffline();
    }

    // 已在用户 fork 且 owner === me → 直接 mine
    if (memo.site.isUserFork && memo.site.owner === memo.me.login) {
      return enterMine();
    }
    // 在 upstream (或本地/其他) 且已识 → onboarding
    return renderOnboarding();
  }

  // ═══ Gate · 入口减法 (帛书·四十八: 为道者日损) ════════════════════════
  //   印 130 · 反者道之动 · OAuth Device-Flow 一钮登 (主推荐 · 去中心化)
  //         · 兜底 PAT 入口 (隐私洁癖 / 主公 OAuth App 未建)
  function renderGate() {
    show("state-gate");
    hide("state-onboarding");
    hide("state-mine");
    setText("hdr-login", "(未登入)");
    setText("hdr-gist", "");

    // ─── PAT 兜底入口 (印 100 之承) ─────────────────────────────────────
    const inp = $("gate-pat");
    const btn = $("gate-btn-login");
    const lnk = $("gate-link-legacy");
    if (inp && !inp.__bound) {
      inp.__bound = true;
      inp.addEventListener("keydown", (e) => {
        if (e.key === "Enter") btn.click();
      });
    }
    if (btn && !btn.__bound) {
      btn.__bound = true;
      btn.addEventListener("click", async () => {
        const pat = (inp.value || "").trim();
        if (!pat) {
          toast("请粘 PAT", "warn");
          inp.focus();
          return;
        }
        try {
          daoSync.setPat(pat);
        } catch (e) {
          toast("PAT 格式异: " + e.message, "err");
          return;
        }
        btn.disabled = true;
        btn.textContent = "验证中…";
        try {
          memo.me = await daoSync.whoami();
        } catch (e) {
          daoSync.clearPat();
          toast("PAT 无效: " + e.message, "err");
          btn.disabled = false;
          btn.textContent = "以 PAT 登入 →";
          return;
        }
        btn.textContent = "✓ @" + memo.me.login + " 已识";
        setText("hdr-login", "@" + memo.me.login);
        // 若当前已在 fork → 直跳 mine
        if (memo.site.isUserFork && memo.site.owner === memo.me.login) {
          enterMine();
        } else {
          renderOnboarding();
        }
      });
    }
    // (cleanup-2026-05-16 · legacy.html 旁支损 · gate-link-legacy 锚同损)
    if (lnk) {
      lnk.style.display = "none";
    }

    // ─── 印 130 · OAuth Device-Flow (主推荐) ───────────────────────────
    bindOauthFlow();
    // ─── 印 132 · client_id 智能配 (弱者道之用) ──────────────────
    bindOauthConfig();
  }

  // ═══════════════════════════════════════════════════════════════════
  // 印 132 · OAuth client_id 智能配 · 弱者道之用 · 一次为·万次用
  // ═══════════════════════════════════════════════════════════════════
  // 帛书·七十八「天下莫柔弱于水 · 而攻坚强者莫之能胜也 · 以其无以易之也」
  //
  // 主公诏 (2026-05-17): 「我无为 · 你无不为 · 唯变所适」
  //
  // 印 130 立 OAuth Device-Flow · 但 client_id 仅 2 源 (window 全局 + DEFAULT)
  // 印 132 扩为 4 源链 · 任一处填即活 (弱者道之用):
  //   ① URL ?dao_oauth_client_id=Ov23li...   (一次性 · 高优 · 分享调试)
  //   ② localStorage 'dao_oauth_client_id'    (持久 · 零代码改)
  //   ③ window.__DAO_OAUTH_CLIENT_ID__       (代码硬编 · index.html <head>)
  //   ④ DEFAULT_CLIENT_ID                    (placeholder)
  //
  // 此 admin UI: 让主公在 gate 页输 client_id → 持久 localStorage → 万次用
  //   · 不需改代码 (帛书四十八 损之又损)
  //   · 不需提交 commit (帛书廿五 道法自然)
  //   · 不需重启 (帛书四十 反者道之动 · 立刻 isConfigured()=true)
  function bindOauthConfig() {
    const det = $("gate-oauth-config-details");
    const inp = $("gate-oauth-config-input");
    const btnSave = $("gate-oauth-config-save");
    const btnClear = $("gate-oauth-config-clear");
    const srcEl = $("gate-oauth-config-source");
    const stEl = $("gate-oauth-config-status");
    if (!btnSave || !window.daoOAuth) return;

    const SRC_ZH = {
      url_param: "URL 参 · 一次",
      localStorage: "已存 (持久)",
      window_global: "代码硬编",
      default_placeholder: "未配 · 用 placeholder",
    };
    function refresh() {
      try {
        const src = window.daoOAuth.whichSource();
        if (srcEl) {
          srcEl.textContent = SRC_ZH[src] || src;
          srcEl.style.color =
            src === "default_placeholder"
              ? "#e07070"
              : src === "url_param"
                ? "#7ec8e0"
                : "#7eb87e";
        }
        // pre-fill input 当 localStorage 有值 (脱敏: 仅前 8 字 + …)
        const cur = window.daoOAuth.getClientId();
        if (
          inp &&
          src === "localStorage" &&
          cur &&
          !/PLACEHLDR/i.test(cur) &&
          !inp.value
        ) {
          inp.placeholder = cur.slice(0, 8) + "…(已存 · 输新值改)";
        }
      } catch (e) {
        console.warn("[oauth-config refresh]", e);
      }
    }
    refresh();

    if (btnSave && !btnSave.__bound) {
      btnSave.__bound = true;
      btnSave.addEventListener("click", () => {
        const v = ((inp && inp.value) || "").trim();
        if (!v) {
          if (stEl) {
            stEl.textContent = "请粘 client_id";
            stEl.style.color = "#e07070";
          }
          if (inp) inp.focus();
          return;
        }
        try {
          window.daoOAuth.setClientId(v);
          if (stEl) {
            stEl.textContent = "✓ 存 · 立活";
            stEl.style.color = "#7eb87e";
          }
          if (inp) inp.value = "";
          // 更新 source 显示 + isConfigured 立检
          refresh();
          toast("✓ client_id 已存 · 一次为·万次用 · 帛书四十八 损之又损", "ok");
        } catch (e) {
          if (stEl) {
            stEl.textContent = "✗ " + e.message;
            stEl.style.color = "#e07070";
          }
        }
      });
    }
    if (btnClear && !btnClear.__bound) {
      btnClear.__bound = true;
      btnClear.addEventListener("click", () => {
        try {
          window.daoOAuth.clearClientId();
          refresh();
          if (stEl) {
            stEl.textContent = "✓ 清 · 回退";
            stEl.style.color = "var(--dim, #888)";
          }
          if (inp) {
            inp.value = "";
            inp.placeholder = "Ov23li... 或 Iv1... (主公 OAuth App Client ID)";
          }
          toast("✓ client_id 清 · 回退默 (URL > window > placeholder)", "info");
        } catch (e) {
          if (stEl) {
            stEl.textContent = "✗ " + e.message;
            stEl.style.color = "#e07070";
          }
        }
      });
    }
    if (inp && !inp.__bound) {
      inp.__bound = true;
      inp.addEventListener("keydown", (e) => {
        if (e.key === "Enter") btnSave && btnSave.click();
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // 印 130 · GitHub OAuth Device-Flow · 反者道之动 · 一钮代 PAT 之繁
  // ═══════════════════════════════════════════════════════════════════
  // 主公诏 (2026-05-17):
  //   「从用户公网登录 github 账号后 后端连接操作同步一切底层 · 去中心化」
  //
  // 帛书·四十八「为道者日损」: PAT 取 (settings/tokens · 选 scope · 拷贝) → 损
  // 帛书·廿二「圣人执一」    : OAuth token == PAT API 等价 · 一处入 · 万处用
  // 帛书·廿五「道法自然」    : 浏览器直走 GH 标准 endpoint · 无后端中转
  //
  // 流:
  //   ① 用户点 "🔑 一键登 GitHub" 钮
  //   ② daoOAuth.start() → POST /login/device/code → 拿 user_code (8 位) + verification_uri
  //   ③ UI 显 user_code · 自动 window.open(verification_uri) 新窗
  //   ④ 用户在 GH 页输 8 位 code · 选授权范围 · 确认
  //   ⑤ App 轮询 /login/oauth/access_token (5s 一次 · 15 min 限)
  //   ⑥ 拿到 access_token → daoSync.setPat(token) (复用 oneShot 全链路 · 帛书廿二)
  //   ⑦ 调 whoami() → 同 PAT 路径 → enterMine 或 renderOnboarding
  // ═══════════════════════════════════════════════════════════════════
  function bindOauthFlow() {
    const obtn = $("gate-btn-oauth");
    if (!obtn || obtn.__bound) return;
    obtn.__bound = true;

    const stateBox = $("gate-oauth-state");
    const stepEl = $("gate-oauth-step");
    const codeRow = $("gate-oauth-code-row");
    const codeEl = $("gate-oauth-code");
    const linkEl = $("gate-oauth-link");
    const copyBtn = $("gate-oauth-copy");
    const cancelBtn = $("gate-oauth-cancel");

    let currentFlow = null; // { cancel() }
    let currentCode = "";

    function setStep(txt, color) {
      if (stepEl) {
        stepEl.textContent = txt;
        if (color) stepEl.style.color = color;
      }
    }
    function showCode(code, uri) {
      currentCode = code;
      if (codeRow) codeRow.style.display = "";
      if (codeEl) codeEl.textContent = code;
      if (linkEl) {
        linkEl.href = uri;
        linkEl.textContent = uri.replace(/^https?:\/\//, "");
      }
    }
    function hideState() {
      if (stateBox) stateBox.style.display = "none";
      if (codeRow) codeRow.style.display = "none";
      currentCode = "";
    }
    function unlockBtn() {
      obtn.disabled = false;
      obtn.textContent = "🔑 一键登 GitHub (Device-Flow) →";
    }

    // 复制 code
    if (copyBtn && !copyBtn.__bound) {
      copyBtn.__bound = true;
      copyBtn.addEventListener("click", async () => {
        if (!currentCode) return;
        try {
          await navigator.clipboard.writeText(currentCode);
          copyBtn.textContent = "✓ 已复";
          setTimeout(() => (copyBtn.textContent = "⧉ 复制 code"), 1500);
        } catch {
          toast("复制失败 · 请手抄", "warn");
        }
      });
    }
    // 取消
    if (cancelBtn && !cancelBtn.__bound) {
      cancelBtn.__bound = true;
      cancelBtn.addEventListener("click", () => {
        if (currentFlow && typeof currentFlow.cancel === "function") {
          currentFlow.cancel();
          currentFlow = null;
        }
        hideState();
        unlockBtn();
        toast("已取消 OAuth 登录", "info");
      });
    }

    // 主按钮
    obtn.addEventListener("click", async () => {
      if (!window.daoOAuth) {
        toast("印 130 OAuth 模块未加载 · 检查 dao_oauth.js", "err");
        return;
      }
      // 先 check 是否已 PAT
      if (window.daoSync && window.daoSync.hasPat()) {
        toast("已有 token · 走 PAT 流 · 或先退出再登", "warn");
        return;
      }
      // 显示状态区
      if (stateBox) stateBox.style.display = "";
      obtn.disabled = true;
      obtn.textContent = "⌛ device-flow 中…";
      setStep("⌛ 起 device-flow…", "var(--gold, #d4a850)");

      currentFlow = window.daoOAuth.start({
        scope: "repo gist workflow",
        onCode: (info) => {
          // 显 user_code · 开 verification_uri 新窗
          showCode(info.user_code, info.verification_uri);
          setStep(
            "✓ 已起 · 请在新窗 GitHub 页输上方 8 位 code · 15 min 内有效",
            "var(--gold, #d4a850)",
          );
          // 自动开新窗 (用户可关 · 不强求)
          try {
            window.open(info.verification_uri, "_blank", "noopener,noreferrer");
          } catch {}
        },
        onPoll: (info) => {
          setStep(
            "⌛ 等用户授权… (轮询 " +
              info.polls +
              " 次 · 剩 " +
              info.remaining_s +
              "s)",
            "var(--dim, #888)",
          );
        },
        onSuccess: async (info) => {
          setStep("✓ 授权成功 · token 已入 localStorage · 验中…", "#7eb87e");
          currentFlow = null;
          // 调 whoami → 走 PAT 同路径
          try {
            memo.me = await daoSync.whoami();
          } catch (e) {
            daoSync.clearPat();
            setStep("✗ whoami 失败: " + e.message, "#e07070");
            unlockBtn();
            return;
          }
          setStep("✓ @" + memo.me.login + " 已识 · 跳转中…", "#7eb87e");
          setText("hdr-login", "@" + memo.me.login);
          // 走与 PAT 同路径
          if (memo.site.isUserFork && memo.site.owner === memo.me.login) {
            enterMine();
          } else {
            renderOnboarding();
          }
        },
        onError: (err) => {
          currentFlow = null;
          // client_id 未配 → 给主公明示 + 滚到 PAT 兜底
          if (
            err.message &&
            /client_id_invalid|OAuth App 未建/.test(err.message)
          ) {
            setStep(
              "✗ 主公 OAuth App 未建 · 见 docs/印130 · 或下展 ▸ 用 PAT 兜底",
              "#e07070",
            );
          } else {
            setStep("✗ " + err.stage + ": " + err.message, "#e07070");
          }
          unlockBtn();
        },
      });
    });
  }

  // ═══ Onboarding · 印 100 太极笙万物 (一笔 oneShot 自举闭环) ════════════
  //   帛书·三十二: 道恒无名 · 侯王若能守之 · 万物将自宾
  //                天地相合 · 以降甘露 · 民莫之令而自均焉
  //   九步: fork → actions → pages → gist → pool-gist → dispatch
  //         → poll → probe → write → redirect (jump)
  async function renderOnboarding() {
    hide("state-gate");
    show("state-onboarding");
    hide("state-mine");
    setText("onboard-login", "@" + ((memo.me && memo.me.login) || "?"));

    const setStep = (id, status, sub) => {
      const e = $(id);
      if (!e) return;
      const icon =
        status === "ok"
          ? "✓"
          : status === "run"
            ? "↻"
            : status === "err"
              ? "✗"
              : status === "skip"
                ? "·"
                : "○";
      const klass =
        "onboard-step onboard-" + (status === "skip" ? "ok" : status);
      e.className = klass;
      e.querySelector(".icon").textContent = icon;
      if (sub != null) e.querySelector(".sub").textContent = sub;
    };

    // bootstrap step name → onboarding step id
    const stepIdMap = {
      whoami: null, // 不显 · 已识
      fork: "step-fork",
      actions: "step-actions",
      pages: "step-pages",
      dao_gist: "step-gist",
      pool_gist: "step-pool-gist",
      auth_key: null, // 内部 · 不显
      dispatch: "step-dispatch",
      poll: "step-poll",
      probe: "step-probe",
      write: "step-write",
      done: null, // 之后做 redirect
    };

    if (!window.daoBootstrap) {
      setStep("step-fork", "err", "daoBootstrap 未加载 · 检查 script tag");
      toast("印 100 自举模块未加载", "err");
      return;
    }

    let result;
    try {
      result = await window.daoBootstrap.oneShot({
        onProgress: (step, status, sub) => {
          const sid = stepIdMap[step];
          if (sid) setStep(sid, status, sub);
        },
        pollMaxSec: 240, // 4 min
        pollIntervalSec: 8,
      });
    } catch (e) {
      console.error("[oneShot]", e);
      toast("自举失: " + e.message + " · 1-2 min 后可重载页", "err");
      return;
    }

    // 写 memo
    memo.fork = result.fork;
    memo.pagesUrl = result.pagesUrl;
    memo.gistId = result.daoGist && result.daoGist.id;
    memo.data = result.daoData;
    memo.poolGistId = result.poolGist && result.poolGist.id;
    memo.daemonUrl = result.daemonUrl;
    memo.vmAuthKey = result.vmAuthKey;

    daoSync.setState({
      fork: result.fork,
      gistId: memo.gistId,
      poolGistId: memo.poolGistId,
      pagesUrl: result.pagesUrl,
      onboardedAt: result.startedAt,
      bootstrappedAt: result.finishedAt,
      yin: 100,
      daemonUrl: result.daemonUrl || "",
      vmAuthKey: result.vmAuthKey || "",
    });

    // §9 跳专属页
    setStep("step-redirect", "run", "即将跳转 " + result.pagesUrl);
    const linkA = $("onboard-link");
    if (linkA) {
      linkA.href = result.pagesUrl;
      linkA.style.display = "";
      linkA.textContent =
        "→ 进入专属页面 (" +
        result.pagesUrl +
        (result.daemonUrl ? " · daemon 活" : " · daemon 仍 build 中") +
        ")";
    }
    let n = 6;
    setStep(
      "step-redirect",
      "ok",
      (result.success ? "✓ 全闭环 · " : "部分完 · ") + n + "s 后自动跳转",
    );
    const timer = setInterval(() => {
      n--;
      setStep(
        "step-redirect",
        "ok",
        (result.success ? "✓ 全闭环 · " : "部分完 · ") + n + "s 后自动跳转",
      );
      if (n <= 0) {
        clearInterval(timer);
        window.location.href = result.pagesUrl;
      }
    }, 1000);
  }

  // ═══ Offline 态 (网不通 · 用 cache) ════════════════════════════════════
  // 印 ∞.1 (2026-05-17 道动测): BUG 修 · 不再苛求 gistId
  //   帛书·七十六「坚强者死之徒·柔弱微细生之徒」苛求即坚·宽容即柔
  //   旧: 必需 cache && st.gistId 才入 mine — 测试/首装离线时卡 gate
  //   新: 有 cache 即入 mine (无 gistId 仅不能同步·但可看可改 · 网恢复自然 fallback)
  //   此符主公诏「弱者道之用」「无为而无不为」
  function renderOffline() {
    hide("state-gate");
    hide("state-onboarding");
    const cached = daoSync.getCache();
    const st = daoSync.getState();
    if (cached) {
      memo.data = cached;
      memo.gistId = st.gistId || ""; // 无 gistId 亦容 · 仅不同步
      // 印 ∞.1 · 离线时仍以 cache 中 state.me 显号 (修 BUG #3)
      if (st.me && st.me.login) {
        memo.me = st.me;
        setText("hdr-login", "@" + st.me.login + " (离线)");
      }
      setText(
        "hdr-gist",
        st.gistId ? "⚠ 离线 (cache)" : "⚠ 离线 (仅 cache · 无 Gist)",
      );
      return enterMine(true);
    }
    // 无 cache → 仍显 gate 但带 hint
    toast("GitHub 不通 · 离线无 cache · 请联网重试", "err");
    renderGate();
  }

  // ═══ Mine · 三栏归一 · 用户专属态 ════════════════════════════════════
  async function enterMine(offline) {
    hide("state-gate");
    hide("state-onboarding");
    show("state-mine");

    // 若还没拿 data (从 gate 跳过来的) → 读
    if (!memo.data || !memo.gistId) {
      setText("hdr-gist", "↻ 读 Gist…");
      try {
        const st = daoSync.getState();
        let gid = st.gistId;
        if (!gid) {
          // onboarding 未走过 (用户直接进 fork URL) · 现场补
          const g = await daoSync.findOrCreateGist();
          gid = g.id;
          memo.data = g.data;
          daoSync.setState({ gistId: gid });
        } else {
          memo.data = await daoSync.readGist(gid);
        }
        memo.gistId = gid;
        daoSync.setCache(memo.data);
        setText("hdr-gist", "✓ Gist 同步");
      } catch (e) {
        // 落 cache
        const cached = daoSync.getCache();
        if (cached) {
          memo.data = cached;
          setText("hdr-gist", "⚠ 离线 (cache)");
          toast("Gist 不通 · 用 cache: " + e.message, "warn");
        } else {
          toast("Gist 读失败: " + e.message, "err");
          return;
        }
      }
    }

    if (offline) setText("hdr-gist", "⚠ 离线 (cache)");

    // schema 补全 (兼容老 Gist)
    const def = daoSync.defaultData();
    for (const k in def) if (memo.data[k] == null) memo.data[k] = def[k];
    if (!memo.data.sp) memo.data.sp = def.sp;
    for (const k in def.sp)
      if (memo.data.sp[k] == null) memo.data.sp[k] = def.sp[k];

    // ─── 印 ∞.2 · 全链路闭环导中 (本地闭环 · 主公无需粘 vmUrl) ───────────
    //   帛书·五十七「我无为也，而民自化」
    //   若本机起 `node scripts/dao_run_all.cjs` (web :8765 · vm :7780)
    //   且 cache.vmUrl 为空 → 自填 http://127.0.0.1:7780 (本地直)
    //   主公浏览器一打开即可用 · 不需粘 · 不需 cloudflared / ngrok
    try {
      const isLocalWeb = /^(127\.0\.0\.1|localhost)$/.test(location.hostname);
      if (isLocalWeb && !memo.data.vmUrl) {
        memo.data.vmUrl = "http://127.0.0.1:7780";
        daoSync.setCache(memo.data);
        toast("★ 本地闭环 · vmUrl 自填 127.0.0.1:7780 (印 ∞.2)", "ok");
      }
    } catch (e) {}

    // 印 128 · 一气化三清 · IDE 三栏并行 (默) · 物无非彼 物无非是
    //   帛书·二: 「物无非彼 物无非是」 (按庄子·齐物论)
    //   帛书·四十八: 「为道者日损 · 损之又损 · 以至于无为」
    //   ?v=128 (默) → 一气化三清 三栏并行常驻
    //   ?v=101 → 万法归宗 use + drawer (印 101)
    //   ?v=100 → 旧三栏 fallback (印 67-100)
    const params = new URLSearchParams(location.search);
    const v = params.get("v") || "128";
    if (v === "100") {
      // 旧三栏 (印 67-100)
      renderLeft();
      renderMid();
      renderRight();
    } else if (v === "101") {
      // 印 101 万法归宗 (use + drawer)
      renderMineV101();
    } else {
      // 印 128 一气化三清 (三栏并行常驻 · 默)
      renderMineV128();
    }
  }

  // ─── 左栏 · API 接口管理 + 反代提示词管理 ────────────────────────────
  function renderLeft() {
    const root = $("mine-left");
    if (!root) return;
    root.innerHTML = "";
    const D = memo.data;

    // A · VM 端点
    root.appendChild(
      el("div", { class: "pane" }, [
        el("div", { class: "pane-hd" }, ["反代 VM 端点"]),
        el("div", { class: "pane-bd" }, [
          el("label", null, ["VM URL (cloudflared tunnel)"]),
          el("input", {
            type: "text",
            id: "in-vm-url",
            class: "inp",
            placeholder: "https://xxxx.trycloudflare.com",
            value: D.vmUrl || "",
          }),
          el("label", null, ["Auth Key (sk-ws-proxy-*)"]),
          el("div", { class: "row" }, [
            el("input", {
              type: "password",
              id: "in-vm-authkey",
              class: "inp grow",
              placeholder: "sk-ws-proxy-...",
              value: D.vmAuthKey || "",
            }),
            el(
              "button",
              {
                class: "btn tiny",
                onclick: () => {
                  const k =
                    "sk-ws-proxy-" +
                    Array.from(crypto.getRandomValues(new Uint8Array(24)))
                      .map(
                        (b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36],
                      )
                      .join("");
                  $("in-vm-authkey").value = k;
                  D.vmAuthKey = k;
                  markDirty();
                },
              },
              ["生成"],
            ),
            el(
              "button",
              {
                class: "btn tiny ghost",
                onclick: () => {
                  const i = $("in-vm-authkey");
                  i.type = i.type === "password" ? "text" : "password";
                },
              },
              ["👁"],
            ),
          ]),
          el("div", { class: "row gap" }, [
            el("button", { class: "btn", onclick: testVm }, ["测试连接"]),
            el(
              "button",
              {
                class: "btn ghost",
                onclick: () => {
                  const url = D.vmUrl;
                  if (!url) {
                    toast("先设 VM URL", "warn");
                    return;
                  }
                  navigator.clipboard.writeText(url + "/v1");
                  toast("Base URL → " + url + "/v1 已复制", "ok");
                },
              },
              ["复 Base URL"],
            ),
            el(
              "button",
              {
                class: "btn ghost",
                onclick: () => {
                  if (!D.vmAuthKey) {
                    toast("无 auth key", "warn");
                    return;
                  }
                  navigator.clipboard.writeText(D.vmAuthKey);
                  toast("Auth Key 已复制", "ok");
                },
              },
              ["复 Key"],
            ),
          ]),
          el("div", { id: "vm-status", class: "status-line" }, ["—"]),
        ]),
      ]),
    );

    $("in-vm-url").addEventListener("input", (e) => {
      D.vmUrl = e.target.value.trim().replace(/\/+$/, "");
      markDirty();
    });
    $("in-vm-authkey").addEventListener("input", (e) => {
      D.vmAuthKey = e.target.value.trim();
      markDirty();
    });

    // B · Devin Bootstrap 一键
    root.appendChild(
      el("div", { class: "pane" }, [
        el("div", { class: "pane-hd" }, ["起 Devin VM · 一键令"]),
        el("div", { class: "pane-bd" }, [
          el("div", { class: "hint" }, [
            "粘到 Devin Chat · 一行起 unit + tunnel · 返你 URL → 粘上方 VM URL",
          ]),
          el("div", { class: "code-wrap" }, [
            el("pre", { id: "devin-cmd", class: "code" }, [genDevinCmd()]),
            el(
              "button",
              {
                class: "btn tiny copy-btn",
                onclick: () => {
                  navigator.clipboard.writeText($("devin-cmd").textContent);
                  toast("Devin 命令已复制", "ok");
                },
              },
              ["复"],
            ),
          ]),
          el("div", { class: "row gap", style: { marginTop: "8px" } }, [
            el(
              "button",
              {
                class: "btn ghost",
                onclick: () => {
                  $("devin-cmd").textContent = genDevinCmd();
                  toast("已用最新 Auth Key 重生", "ok");
                },
              },
              ["↻ 重生命令"],
            ),
            el(
              "a",
              {
                class: "btn ghost",
                href: "https://app.devin.ai/",
                target: "_blank",
              },
              ["开 Devin →"],
            ),
          ]),
        ]),
      ]),
    );

    // C · 反代提示词管理 (印 52 守一不离 · 印 123 升 7 态对齐 dao_proxy)
    const sp = D.sp;
    root.appendChild(
      el("div", { class: "pane" }, [
        el("div", { class: "pane-hd" }, [
          "反代提示词 · SP 七态 ",
          el("span", { class: "meta" }, [sp.mode]),
        ]),
        el("div", { class: "pane-bd" }, [
          el(
            "div",
            { class: "sp-mode-grp" },
            [
              // 印 123 · 七态对齐 dao_proxy /v1/system/prompt allowed (passthrough 兼老 alias bypass)
              ["passthrough", "透 · 不动 (=bypass)"],
              ["dao", "★ 道 · 帛书《老子》全替"],
              ["usernote", "★ usernote · §3.17 合法槽"],
              ["prepend", "前 · 道+原"],
              ["append", "后 · 原+道"],
              ["override", "盖 · ∗thinking-loop"],
              ["custom", "自定 · 用户 SP 替"],
            ].map(([m, label]) =>
              el(
                "button",
                {
                  class: "sp-mode-btn" + (sp.mode === m ? " active" : ""),
                  "data-mode": m,
                  onclick: () => {
                    sp.mode = m;
                    markDirty();
                    renderLeft();
                    // 印 88 · 同步 mode 到 VM /sp/mode · 道之三清合一
                    syncSpModeToVm(m);
                  },
                },
                [label],
              ),
            ),
          ),
          el("details", { open: sp.mode === "custom" }, [
            el("summary", null, ["自定 SP 文本"]),
            el(
              "textarea",
              {
                id: "in-sp-custom",
                class: "inp",
                rows: "4",
                placeholder: "自定 SP (空 → custom 退化为 passthrough)",
              },
              [sp.custom || ""],
            ),
          ]),
          el("details", null, [
            el("summary", null, ["隔离强度 (剥侧道·中性化)"]),
            spCheckbox(
              "sp-strip-side",
              "剥 SIDE_CHANNEL · 32 项",
              sp.stripSideChannel,
              (v) => {
                sp.stripSideChannel = v;
                markDirty();
              },
            ),
            spCheckbox(
              "sp-strip-memory",
              "剥 MEMORY 块",
              sp.stripMemory,
              (v) => {
                sp.stripMemory = v;
                markDirty();
              },
            ),
            spCheckbox(
              "sp-neutralize",
              "中性化 SECTION_OVERRIDE",
              sp.neutralizeOverride,
              (v) => {
                sp.neutralizeOverride = v;
                markDirty();
              },
            ),
            spCheckbox(
              "sp-inject-keeps",
              "注入 keep_blocks (整体)",
              sp.injectKeeps,
              (v) => {
                sp.injectKeeps = v;
                markDirty();
              },
            ),
          ]),
          el("details", null, [
            el("summary", null, ["保留接口 (dao/custom 时保哪些块)"]),
            spCheckbox(
              "keep-tool",
              "tool_calling · 工具调用",
              sp.keeps.tool_calling,
              (v) => {
                sp.keeps.tool_calling = v;
                markDirty();
              },
            ),
            spCheckbox(
              "keep-mcp",
              "mcp_servers · MCP 单",
              sp.keeps.mcp_servers,
              (v) => {
                sp.keeps.mcp_servers = v;
                markDirty();
              },
            ),
            spCheckbox(
              "keep-user",
              "user_information · 用户元",
              sp.keeps.user_information,
              (v) => {
                sp.keeps.user_information = v;
                markDirty();
              },
            ),
            spCheckbox(
              "keep-ws",
              "workspace_information · 工作区",
              sp.keeps.workspace_information,
              (v) => {
                sp.keeps.workspace_information = v;
                markDirty();
              },
            ),
          ]),
        ]),
      ]),
    );
    const taC = $("in-sp-custom");
    if (taC) {
      let _spCustomTimer = null;
      taC.addEventListener("input", (e) => {
        sp.custom = e.target.value;
        markDirty();
        // 印 88 · debounce 800ms 推 VM /sp/custom
        if (_spCustomTimer) clearTimeout(_spCustomTimer);
        _spCustomTimer = setTimeout(() => syncSpCustomToVm(sp.custom), 800);
      });
    }

    // D · 印 90 · 网页端 SP 注入器 (浏览器内直注 · 无需 VM)
    //   帛书·四十:   反者道之动 · 弱者道之用
    //   帛书·七十八: 天下莫柔弱于水 · 而攻坚强者莫之能胜也
    //   于 app.devin.ai 用户态浏览器内 hook WebSocket · 字面替换 system prompt
    const ownerForRaw =
      (memo.site && memo.site.owner) ||
      (memo.me && memo.me.login) ||
      daoSync.UPSTREAM_OWNER;
    const repoForRaw = (memo.site && memo.site.repo) || daoSync.UPSTREAM_REPO;
    const branchForRaw = "main";
    const injectorBase =
      "https://github.com/" +
      ownerForRaw +
      "/" +
      repoForRaw +
      "/tree/" +
      branchForRaw +
      "/packages/dao-injector";
    const userscriptRaw =
      "https://raw.githubusercontent.com/" +
      ownerForRaw +
      "/" +
      repoForRaw +
      "/" +
      branchForRaw +
      "/packages/dao-injector/userscript/dao-devin-sp-inject.user.js";
    root.appendChild(
      el("div", { class: "pane" }, [
        el("div", { class: "pane-hd" }, [
          "网页端 SP 注入器 · 印 90 ",
          el("span", { class: "meta" }, ["dao-injector"]),
        ]),
        el("div", { class: "pane-bd" }, [
          el("div", { class: "hint" }, [
            "印 89 反 alignment 之反 + 印 90 浏览器内 wss hook · 于 app.devin.ai 真站直注帛书风格 (无需 VM)",
          ]),
          el("div", { class: "row gap", style: { marginTop: "8px" } }, [
            el(
              "a",
              {
                class: "btn",
                href: injectorBase,
                target: "_blank",
              },
              ["扩展件 ↗"],
            ),
            el(
              "a",
              {
                class: "btn ghost",
                href: userscriptRaw,
                target: "_blank",
              },
              ["Tampermonkey 装 ↗"],
            ),
            el(
              "a",
              {
                class: "btn ghost",
                href: "https://app.devin.ai/",
                target: "_blank",
              },
              ["开 Devin →"],
            ),
          ]),
          el(
            "div",
            { class: "hint", style: { marginTop: "8px", fontSize: "11px" } },
            [
              "装法 A · Chrome/Edge: 装扩 → chrome://extensions → 加载已解压 → 选 packages/dao-injector/extension/",
            ],
          ),
          el("div", { class: "hint", style: { fontSize: "11px" } }, [
            "装法 B · 直拖 userscript 入 Tampermonkey 即得 (备路 · 免装扩展)",
          ]),
        ]),
      ]),
    );

    // E · 印 93/94 · Devin 中枢 + 万法归一笔 C 道身桥
    //   帛书·廿二: 圣人执一 · 以为天下牧
    //   帛书·四十二: 道生一 · 一生二 · 二生三 · 三生万物
    //   印 94 (cascade 升) · 承印 93 + Devin 印 100 unified_dao_daemon (主公已立 · cascade 修 syntax)
    //   一处探五本机服 · 道并行不悖 · 各得其用
    root.appendChild(
      el("div", { class: "pane" }, [
        el("div", { class: "pane-hd" }, [
          "本机·万法归一笔 · 印 93/94 ",
          el("span", { class: "meta" }, ["五服一探 · 独立体"]),
        ]),
        el("div", { class: "pane-bd" }, [
          el("div", { class: "hint" }, [
            "本机 unified daemon :11440 (印 100 · 双反代统一 thin layer · 合 :11441 Devin + :8878 Windsurf) + 印 91 中枢 + 印 92 pilot · 与上方公网 VM 道并行不悖",
          ]),
          el("div", { class: "row gap wrap", style: { marginTop: "8px" } }, [
            el(
              "a",
              {
                class: "btn",
                href: "http://127.0.0.1:11440",
                target: "_blank",
                title: "印 100 · 统一笔 · 双反代合点",
              },
              ["★ 统一 :11440 ↗"],
            ),
            el(
              "a",
              {
                class: "btn ghost",
                href: "http://127.0.0.1:11441",
                target: "_blank",
              },
              ["Devin :11441 ↗"],
            ),
            el(
              "a",
              {
                class: "btn ghost",
                href: "http://127.0.0.1:8878",
                target: "_blank",
              },
              ["WS :8878 ↗"],
            ),
            el(
              "a",
              {
                class: "btn ghost",
                href: "http://127.0.0.1:11445",
                target: "_blank",
              },
              ["中枢 :11445 ↗"],
            ),
            el(
              "a",
              {
                class: "btn ghost",
                href: "http://127.0.0.1:11446",
                target: "_blank",
              },
              ["Pilot :11446 ↗"],
            ),
            el(
              "button",
              {
                class: "btn",
                onclick: probeDevinHub,
              },
              ["⚡ 探五服"],
            ),
          ]),
          el(
            "div",
            {
              id: "devin-hub-status",
              class: "status-line",
              style: { marginTop: "6px", whiteSpace: "pre-wrap" },
            },
            ["(点 ⚡ 探五服 · 或见折叠之一键启)"],
          ),
          el("details", { style: { marginTop: "8px" } }, [
            el(
              "summary",
              {
                class: "hint",
                style: { cursor: "pointer", fontSize: "11px" },
              },
              ["▸ 一键启 · 本机 五服全栈 (印 91/92/100)"],
            ),
            el(
              "pre",
              {
                class: "code",
                style: {
                  fontSize: "10px",
                  marginTop: "4px",
                  whiteSpace: "pre-wrap",
                },
              },
              [
                "# A · 起印 100 unified daemon (★ 双反代合点 · :11440)\n" +
                  "cd Devin云原生\\虚拟机反代\n" +
                  ".\\起统一daemon.ps1   # 或 node unified_dao_daemon.js --port 11440\n\n" +
                  "# B · 起 Devin 反代 :11441 + Windsurf 反代 :8878 (一笔全启)\n" +
                  "cd Devin云原生\\虚拟机反代 ; .\\一笔全启.cmd\n\n" +
                  "# C · 起印 91/92 中枢与 pilot (可选)\n" +
                  "cd Devin云原生\\PC端\\本源\n" +
                  "node 印91_万法归宗中枢\\server.js\n" +
                  "node 印92_太上_pilot\\pilot.js\n\n" +
                  "# D · (可选) 公网入口\n" +
                  ".\\起公网入口.ps1",
              ],
            ),
          ]),
        ]),
      ]),
    );

    // F · 印 95 · 真本源闭环 · 云端 daemon 池 (★ 主路 · 主公 PC 关亦活)
    //   帛书·四十:   反者道之动 · 弱者道之用 · 天下之物生于有 · 有生于无
    //   帛书·廿五:   独立而不垓 · 可以为天地母
    //   帛书·七十三: 天网恢恢 · 疏而不失
    //
    //   主公诏 (2026-05-14):
    //     "重新锚定本源 · 此核心所有均运行于云端 GitHub Actions
    //      不依赖本地一切 · 不依赖设备 · 一 GitHub 账号即一切"
    //
    //   印 95 之解:
    //     ① token 池入主公私 gist (PAT gist scope)
    //     ② GH Actions cron 5h 自起 · 拉 gist → 立 ~/.dao/accounts.json → 起 fleet → cf tunnel → 报 URL 回 gist
    //     ③ 此 pane 用用户 PAT (已存 localStorage) · GH API 读 gist · 显 daemon 池 · 一笔触新 run
    //     ④ 自动设 vmUrl = 首活 daemon URL · 即可与 dao-fleet-cloud workflow 之 fleet_vm_unit 直连
    //
    //   主公一笔起: cd packages/dao-pool && node cli.js init --pat <PAT>
    //   见 packages/dao-pool/README.md
    {
      const cp = D.cloudPool || (D.cloudPool = { gistId: "", daemons: [] });
      const cpStatus =
        cp.daemons && cp.daemons.length > 0
          ? cp.daemons.filter((d) => d.ok !== false).length +
            "/" +
            cp.daemons.length +
            " 活"
          : "未拉";
      root.appendChild(
        el("div", { class: "pane" }, [
          el("div", { class: "pane-hd" }, [
            "★ 云端 daemon 池 · 印 95 ",
            el("span", { class: "meta" }, [
              "真本源闭环 · " + cpStatus + " · 主公 PC 关亦活",
            ]),
          ]),
          el("div", { class: "pane-bd" }, [
            el("div", { class: "hint" }, [
              "一 GH 账号即一切 · token 池在你的私 gist · daemon 在 GH Actions cron 5h 自起 · 主公本机不必开机",
            ]),
            // Gist ID 配
            el("div", { class: "row gap", style: { marginTop: "8px" } }, [
              el(
                "label",
                {
                  class: "hint",
                  style: { fontSize: "11px", minWidth: "70px" },
                },
                ["dao-pool gist:"],
              ),
              el("input", {
                type: "text",
                id: "in-cloud-gist",
                class: "inp grow",
                placeholder: "gist id (点 🔍 自找 或手输)",
                value: cp.gistId || "",
              }),
              el(
                "button",
                {
                  class: "btn tiny ghost",
                  onclick: autoFindCloudPoolGist,
                  title: "搜你 GitHub 之 dao-pool gist (描含 dao-pool)",
                },
                ["🔍 自找"],
              ),
            ]),
            // 操作
            el("div", { class: "row gap", style: { marginTop: "8px" } }, [
              el("button", { class: "btn", onclick: probeCloudFleet }, [
                "↻ 拉 daemon 池",
              ]),
              el(
                "button",
                {
                  class: "btn ghost",
                  onclick: triggerCloudFleet,
                  title:
                    "POST /actions/workflows/dao-fleet-cloud.yml/dispatches",
                },
                ["▶ 触新 run"],
              ),
              el(
                "button",
                {
                  class: "btn ghost",
                  onclick: openCloudActions,
                  title: "GitHub Actions · dao-fleet-cloud workflow 网页",
                },
                ["Actions ↗"],
              ),
              el(
                "button",
                {
                  class: "btn tiny ghost",
                  onclick: useFirstCloudDaemonAsVm,
                  title: "把首活 daemon URL 设为左栏 VM URL · 一笔接客",
                },
                ["→ 设左栏 VM"],
              ),
            ]),
            // 状态
            el(
              "div",
              {
                id: "cloud-fleet-status",
                class: "status-line",
                style: {
                  marginTop: "6px",
                  whiteSpace: "pre-wrap",
                  fontFamily: "monospace",
                  fontSize: "11px",
                },
              },
              [
                cp.daemons && cp.daemons.length > 0
                  ? renderCloudDaemons(cp.daemons)
                  : "(点 🔍 自找 → ↻ 拉 daemon 池 · 或见折叠之 主公一笔起 init)",
              ],
            ),
            // 折叠 · 主公一笔起 init
            el("details", { style: { marginTop: "8px" } }, [
              el(
                "summary",
                {
                  class: "hint",
                  style: { cursor: "pointer", fontSize: "11px" },
                },
                ["▸ 主公一笔起 init (无 dao-pool gist 时)"],
              ),
              el(
                "pre",
                {
                  class: "code",
                  style: {
                    fontSize: "10px",
                    marginTop: "4px",
                    whiteSpace: "pre-wrap",
                  },
                },
                [
                  "# 一次性 · 主公本机 · 立私 gist + 推 token 池\n" +
                    "git clone https://github.com/" +
                    (daoSync.UPSTREAM_OWNER || "dao-genesis") +
                    "/" +
                    (daoSync.UPSTREAM_REPO || "windsurf-assistant") +
                    "\n" +
                    "cd " +
                    (daoSync.UPSTREAM_REPO || "windsurf-assistant") +
                    "/packages/dao-pool\n" +
                    "node cli.js init --pat $(gh auth token)\n\n" +
                    "# 设 repo secrets (init 输出 gist id)\n" +
                    "gh secret set DAO_POOL_GIST_ID --body '<id>' -R " +
                    (daoSync.UPSTREAM_OWNER || "dao-genesis") +
                    "/" +
                    (daoSync.UPSTREAM_REPO || "windsurf-assistant") +
                    "\n" +
                    "gh secret set DAO_POOL_PAT --body $(gh auth token) -R " +
                    (daoSync.UPSTREAM_OWNER || "dao-genesis") +
                    "/" +
                    (daoSync.UPSTREAM_REPO || "windsurf-assistant") +
                    "\n" +
                    "gh secret set DAO_AUTH_KEY --body 'sk-ws-proxy-<rand>' -R " +
                    (daoSync.UPSTREAM_OWNER || "dao-genesis") +
                    "/" +
                    (daoSync.UPSTREAM_REPO || "windsurf-assistant") +
                    "\n\n" +
                    "# 触新 run (或 cron 自起每 5h)\n" +
                    "gh workflow run dao-fleet-cloud.yml -R " +
                    (daoSync.UPSTREAM_OWNER || "dao-genesis") +
                    "/" +
                    (daoSync.UPSTREAM_REPO || "windsurf-assistant") +
                    "\n\n" +
                    "# (此 pane 自动 1-2 min 后拉 · 或点 ↻ 重拉)",
                ],
              ),
            ]),
          ]),
        ]),
      );
      // 输 gist id 改即记
      const inGid = $("in-cloud-gist");
      if (inGid && !inGid.__bound) {
        inGid.__bound = true;
        inGid.addEventListener("input", (e) => {
          const D2 = memo.data;
          const v = e.target.value.trim();
          if (!D2.cloudPool) D2.cloudPool = {};
          if (D2.cloudPool.gistId !== v) {
            D2.cloudPool.gistId = v;
            markDirty();
          }
        });
      }
    }
  }

  // 印 94 (cascade) · 探本机五服 (unified :11440 ★ + devin :11441 + ws :8878 + 中枢 :11445 + pilot :11446)
  //   承印 93 单探升五服并探 · 道法自然 · 不通则静 · 不强连
  //   主公印 100 已立 unified_dao_daemon · cascade 修 syntax bug · 真活验之
  async function probeDevinHub() {
    const stEl = $("devin-hub-status");
    if (!stEl) return;
    stEl.textContent = "↻ 并探五本机服 ...";
    const services = [
      { name: "★统一", port: 11440, isUnified: true },
      { name: "Devin", port: 11441 },
      { name: "WS", port: 8878 },
      { name: "中枢", port: 11445 },
      { name: "Pilot", port: 11446 },
    ];
    const results = await Promise.all(
      services.map(async (s) => {
        try {
          const r = await fetch(`http://127.0.0.1:${s.port}/health`, {
            cache: "no-store",
            signal: AbortSignal.timeout ? AbortSignal.timeout(3000) : undefined,
          });
          if (!r.ok) return { ...s, ok: false, msg: "HTTP " + r.status };
          let extra = "";
          try {
            const j = await r.json();
            const b = j.data || j;
            if (s.isUnified) {
              // unified :11440 · 显 upstreams 真态
              const ups = j.upstreams || {};
              const dOk = ups.devin && ups.devin.ok;
              const wOk = ups.windsurf && ups.windsurf.ok;
              const ver = j.version || "?";
              extra = ` v${ver} · D${dOk ? "✓" : "✗"}W${wOk ? "✓" : "✗"}`;
            } else if (b.pool && b.pool.total) {
              extra = ` · pool ${b.pool.total}`;
            } else if (b.models) {
              extra = ` · ${b.models} models`;
            } else if (b.version || b.ver) {
              extra = ` v${b.version || b.ver}`;
            }
          } catch {}
          return { ...s, ok: true, msg: "✓" + extra };
        } catch (e) {
          return { ...s, ok: false, msg: "✗ 未起" };
        }
      }),
    );
    const lines = results
      .map(
        (r) =>
          (r.ok ? "✓ " : "✗ ") +
          r.name +
          " :" +
          r.port +
          (r.ok ? " " + (r.msg.replace(/^✓\s?/, "") || "") : " " + r.msg),
      )
      .join("\n");
    stEl.textContent = lines;
    const unified = results.find((r) => r.isUnified);
    if (unified && unified.ok) {
      toast("★ 统一 :11440 ✓ · 万法归一笔 · 双反代真合", "ok");
    } else {
      const liveCount = results.filter((r) => r.ok).length;
      if (liveCount > 0) {
        toast(`本机 ${liveCount}/5 服活 · 道并行不悖`, "info");
      } else {
        toast("本机五服皆未起 · 见折叠之一键启", "warn");
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  印 95 · 真本源闭环 · 云端 daemon 池 (★ 主路 · 主公 PC 关亦活)
  //  帛书·四十:「反者道之动 · 弱者道之用」
  //  帛书·廿五:「独立而不垓 · 可以为天地母」
  //
  //  pane F 之实 · 6 函数 · 全用用户已存 PAT (localStorage 'dao.pat')
  // ═══════════════════════════════════════════════════════════════════

  // 〇 · 帮: 取用户已存 PAT
  function getCloudPat() {
    return localStorage.getItem("dao.pat") || "";
  }

  // 一 · 自找用户 GitHub 之 dao-pool gist (描含 dao-pool · 文件 dao-pool.json)
  async function autoFindCloudPoolGist() {
    const stEl = $("cloud-fleet-status");
    const pat = getCloudPat();
    if (!pat) {
      if (stEl) stEl.textContent = "✗ 未登录 PAT · 请先 gate 态登入";
      return;
    }
    if (stEl) stEl.textContent = "↻ 找你 GitHub 之 dao-pool gist...";
    try {
      const r = await fetch("https://api.github.com/gists?per_page=100", {
        headers: {
          Authorization: "Bearer " + pat,
          Accept: "application/vnd.github+json",
        },
      });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const list = await r.json();
      const found = (list || []).filter(
        (g) =>
          g.files &&
          g.files["dao-pool.json"] &&
          /dao-pool/i.test(g.description || ""),
      );
      if (found.length === 0) {
        if (stEl)
          stEl.textContent = "✗ 未找 dao-pool gist · 见折叠之 主公一笔起 init";
        toast("未找 dao-pool gist · 见折叠之 init 步骤", "warn");
        return;
      }
      const D = memo.data;
      if (!D.cloudPool) D.cloudPool = {};
      D.cloudPool.gistId = found[0].id;
      markDirty();
      if ($("in-cloud-gist")) $("in-cloud-gist").value = D.cloudPool.gistId;
      if (stEl)
        stEl.textContent = "✓ 找 " + found.length + " 个 · 用 " + found[0].id;
      if (found.length > 1)
        toast("有 " + found.length + " 个 dao-pool · 用首个", "info");
      // 自动拉
      return await probeCloudFleet();
    } catch (e) {
      if (stEl) stEl.textContent = "✗ 自找失: " + e.message;
      toast("自找 gist 失: " + e.message, "err");
    }
  }

  // 二 · 拉 gist · 解 daemon 池 · 渲染 + 自动设 vmUrl
  async function probeCloudFleet() {
    const D = memo.data;
    const cp = D.cloudPool || (D.cloudPool = {});
    const stEl = $("cloud-fleet-status");
    // 取 input 之 ID 优 (用户可手改)
    const inGid = $("in-cloud-gist") && $("in-cloud-gist").value.trim();
    if (inGid && inGid !== cp.gistId) {
      cp.gistId = inGid;
      markDirty();
    }
    const pat = getCloudPat();
    if (!pat) {
      if (stEl) stEl.textContent = "✗ 未登录 PAT";
      return;
    }
    if (!cp.gistId) {
      if (stEl) stEl.textContent = "✗ 未设 gist · 点 🔍 自找 或手输";
      return;
    }
    if (stEl) stEl.textContent = "↻ 拉 gist " + cp.gistId.slice(0, 8) + "...";
    try {
      const r = await fetch(
        "https://api.github.com/gists/" + encodeURIComponent(cp.gistId),
        {
          headers: {
            Authorization: "Bearer " + pat,
            Accept: "application/vnd.github+json",
          },
        },
      );
      if (!r.ok) throw new Error("HTTP " + r.status);
      const g = await r.json();
      const file = g.files && g.files["dao-pool.json"];
      if (!file) throw new Error("gist 内无 dao-pool.json");
      const data = JSON.parse(file.content);
      const daemons = (data.daemons || []).filter((d) => d.url);
      // age 算 (新 · 不信 gist 之旧 ageSec)
      const now = Date.now();
      daemons.forEach((d) => {
        const t = d.reportedAt ? new Date(d.reportedAt).getTime() : 0;
        d.ageSec = Math.round((now - t) / 1000);
        // > 15 min 标 stale
        if (d.ageSec > 15 * 60) d.ok = false;
      });
      cp.daemons = daemons;
      cp.fetchedAt = now;
      cp.poolTotal = (data.pool && data.pool.total) || 0;
      cp.poolCandidates = data.pool
        ? (data.pool.accounts || []).filter(
            (a) =>
              !a.frozen && (typeof a.weekly !== "number" || a.weekly === 0),
          ).length
        : 0;
      markDirty();
      if (stEl) stEl.textContent = renderCloudDaemons(daemons);
      // 重渲染 pane (更新 meta 之 N 活)
      if (typeof renderLeft === "function") {
        // pane F 在 left · 但避免无穷递归 · 仅更新 hd
      }
      if (daemons.length === 0) {
        toast(
          "gist pool=" + cp.poolTotal + " · 无活 daemon · 点 ▶ 触新 run",
          "warn",
        );
      } else {
        const live = daemons.filter((d) => d.ok !== false).length;
        toast(
          "★ pool=" +
            cp.poolTotal +
            " · daemon " +
            live +
            "/" +
            daemons.length +
            " 活",
          live > 0 ? "ok" : "warn",
        );
      }
    } catch (e) {
      if (stEl) stEl.textContent = "✗ 拉失: " + e.message;
      toast("拉 daemon 池失: " + e.message, "err");
    }
  }

  // 三 · 渲染 daemon 表 (monospace · 紧凑)
  function renderCloudDaemons(daemons) {
    if (!daemons || daemons.length === 0)
      return "(无活 daemon · 点 ▶ 触新 run · 等 1-2 min 后 ↻ 重拉)";
    const fmtAge = (s) => {
      if (s == null) return "?";
      if (s < 60) return s + "s";
      if (s < 3600) return Math.round(s / 60) + "m";
      return Math.round(s / 3600) + "h";
    };
    return daemons
      .map((d) => {
        const ok = d.ok === false ? "⚠" : "✓";
        const host = (d.host || "?").slice(0, 24);
        const ver = d.version ? "v" + d.version : "v?";
        const pool = d.poolTotal != null ? "p" + d.poolTotal : "p?";
        const age = fmtAge(d.ageSec);
        return (
          ok +
          " " +
          host.padEnd(24) +
          " " +
          ver.padEnd(8) +
          " " +
          pool.padEnd(7) +
          " " +
          age.padStart(4) +
          "\n  " +
          d.url
        );
      })
      .join("\n");
  }

  // 四 · 触 dao-fleet-cloud workflow (POST /actions/workflows/.../dispatches)
  async function triggerCloudFleet() {
    const owner =
      (memo.fork && memo.fork.owner) ||
      (memo.site && memo.site.owner) ||
      daoSync.UPSTREAM_OWNER;
    const repo = (memo.site && memo.site.repo) || daoSync.UPSTREAM_REPO;
    const stEl = $("cloud-fleet-status");
    const pat = getCloudPat();
    if (!pat) {
      toast("未登录 PAT", "err");
      return;
    }
    if (stEl)
      stEl.textContent =
        "↻ 触 dao-fleet-cloud workflow on " + owner + "/" + repo + "...";
    try {
      const r = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/actions/workflows/dao-fleet-cloud.yml/dispatches`,
        {
          method: "POST",
          headers: {
            Authorization: "Bearer " + pat,
            Accept: "application/vnd.github+json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ref: "main",
            inputs: { max_minutes: "300", auth_required: "yes" },
          }),
        },
      );
      if (r.status === 204 || r.ok) {
        toast("✓ workflow 已触 · 等 1-2 min · 自动重拉", "ok");
        if (stEl)
          stEl.textContent =
            "↻ workflow 触发成 · 等 daemon 起 (1-2 min) · 自动 90s 后重拉\n  → " +
            `https://github.com/${owner}/${repo}/actions`;
        setTimeout(
          () =>
            probeCloudFleet().catch((e) =>
              console.warn("auto re-pull err:", e),
            ),
          90000,
        );
      } else {
        const txt = await r.text();
        let hint = "";
        if (r.status === 404)
          hint = "\n  (workflow 可能未在 fork 内 · 或 PAT 缺 workflow scope)";
        if (r.status === 403)
          hint =
            "\n  (PAT 缺 actions:write 权限 · classic PAT 需勾 workflow scope)";
        throw new Error("HTTP " + r.status + " · " + txt.slice(0, 100) + hint);
      }
    } catch (e) {
      if (stEl) stEl.textContent = "✗ 触失: " + e.message;
      toast("触 workflow 失 · " + e.message, "err");
    }
  }

  // 五 · 开 GitHub Actions 网页
  function openCloudActions() {
    const owner =
      (memo.fork && memo.fork.owner) ||
      (memo.site && memo.site.owner) ||
      daoSync.UPSTREAM_OWNER;
    const repo = (memo.site && memo.site.repo) || daoSync.UPSTREAM_REPO;
    window.open(
      `https://github.com/${owner}/${repo}/actions/workflows/dao-fleet-cloud.yml`,
      "_blank",
    );
  }

  // 六 · 一笔: 把首活 daemon URL 设为左栏 VM URL · 即可与 dao-fleet-cloud 直接接客
  function useFirstCloudDaemonAsVm() {
    const D = memo.data;
    const cp = D.cloudPool || {};
    const live = (cp.daemons || []).filter((d) => d.ok !== false && d.url);
    if (live.length === 0) {
      toast("无活 daemon · 先 ↻ 拉 或 ▶ 触新 run", "warn");
      return;
    }
    const url = live[0].url.replace(/\/+$/, "");
    D.vmUrl = url;
    markDirty();
    if (typeof renderLeft === "function") renderLeft();
    toast("★ 左栏 VM URL = " + url + " · 一笔接客", "ok");
  }

  function spCheckbox(id, label, checked, onChange) {
    const cb = el("input", { type: "checkbox", id });
    cb.checked = !!checked;
    cb.addEventListener("change", (e) => onChange(e.target.checked));
    return el("label", { class: "cb" }, [cb, el("span", null, [label])]);
  }

  function genDevinCmd() {
    const D = memo.data;
    const fork =
      memo.fork && memo.fork.owner
        ? memo.fork.owner
        : (memo.site && memo.site.owner) || daoSync.UPSTREAM_OWNER;
    const repoUrl =
      "https://github.com/" + fork + "/" + daoSync.UPSTREAM_REPO + ".git";
    const auth = D.vmAuthKey || "sk-ws-proxy-CHANGE_ME";
    const acct =
      memo.data.activeAccountEmail ||
      (memo.data.accounts &&
        memo.data.accounts[0] &&
        memo.data.accounts[0].email) ||
      "you@windsurf.com";
    const apik =
      ((memo.data.accounts || []).find((a) => a.email === acct) || {}).apiKey ||
      "sk-ws-01-CHANGE_ME";
    return [
      "curl -sL https://raw.githubusercontent.com/" +
        fork +
        "/" +
        daoSync.UPSTREAM_REPO +
        "/main/scripts/devin-bootstrap.sh | \\",
      '  DAO_API_KEY="' + apik + '" \\',
      '  DAO_AUTH_KEY="' + auth + '" \\',
      '  DAO_ACCOUNT="' + acct + '" \\',
      '  DAO_REPO="' + repoUrl + '" \\',
      "  DAO_TUNNEL=yes \\",
      "  bash",
    ].join("\n");
  }

  // 测 VM /health·显示 dual-path (A/B 路) + sp 状态
  async function testVm() {
    const D = memo.data;
    if (!D.vmUrl) {
      toast("先填 VM URL", "warn");
      return;
    }
    setText("vm-status", "↻ 测试中…");
    try {
      const r = await fetch(D.vmUrl + "/health", { cache: "no-store" });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const j = await r.json();
      const ok = j.ok !== false;
      // 印 88 · 显 dualPath + sp 状态
      const dp = j.dualPath;
      const spInfo = j.sp;
      const aTag = dp && dp.pathA ? "A✓" : "A?";
      const bTag = dp && dp.pathB ? (dp.pathB.ready ? "B✓" : "B⚠") : "B?";
      const spTag = spInfo && spInfo.mode ? "SP=" + spInfo.mode : "SP?";
      const silkTag =
        spInfo && spInfo.silkChars ? " silk=" + spInfo.silkChars : "";
      setText(
        "vm-status",
        (ok ? "✓ " : "⚠ ") +
          "unit" +
          " · up " +
          ((j.uptime || j.uptimeSec || 0) | 0) +
          "s" +
          " · auth=" +
          (j.authRequired ? "on" : "off") +
          " · sse=" +
          (j.sseActive || 0) +
          " · " +
          aTag +
          " " +
          bTag +
          " · " +
          spTag +
          silkTag,
      );
      // B 路不就绪提醒
      if (dp && dp.pathB && !dp.pathB.ready) {
        toast("B 路 (Devin Cloud) 未就绪: " + (dp.pathB.note || ""), "warn");
      }
    } catch (e) {
      setText("vm-status", "✗ " + e.message);
    }
  }

  // 印 88 · SP mode 推送 VM /sp/mode · 道随修者得之
  //   帛书·二十二: 「圣人执一」—— 三者合一 · web 为外·VM 为内
  // 印 122 升: /sp/mode → /v1/system/prompt {strategy} · 7 态对齐 dao_proxy
  // 印 123: passthrough 兼老 alias bypass (def.sp.mode 默 passthrough 不动 · 道法自然)
  async function syncSpModeToVm(mode) {
    const D = memo.data;
    if (!D.vmUrl || !D.vmAuthKey) return; // 默静 · 未填则不推
    // 印 123 · passthrough 兼老 alias bypass · 字串对齐 dao_proxy 七态
    const strategy = mode === "passthrough" ? "bypass" : mode;
    try {
      const r = await fetch(D.vmUrl + "/v1/system/prompt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + D.vmAuthKey,
        },
        body: JSON.stringify({ strategy }),
      });
      if (r.ok) {
        const j = await r.json();
        toast(
          "SP · " +
            (j.strategy || strategy) +
            " · updatedAt=" +
            (j.updatedAt || "-"),
          "ok",
        );
      }
    } catch (e) {
      // 静默 · VM 未启不报警
    }
  }

  // 印 88 · SP custom 推 VM /sp/custom
  // 印 122 升: /sp/custom → /v1/system/prompt {customSp}
  async function syncSpCustomToVm(custom) {
    const D = memo.data;
    if (!D.vmUrl || !D.vmAuthKey) return;
    try {
      await fetch(D.vmUrl + "/v1/system/prompt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + D.vmAuthKey,
        },
        body: JSON.stringify({ customSp: custom }),
      });
    } catch {}
  }

  // ─── 中栏 · WAM 切号 ────────────────────────────────────────────────
  function renderMid() {
    const root = $("mine-mid");
    if (!root) return;
    root.innerHTML = "";
    const D = memo.data;

    // A · 加号表单
    root.appendChild(
      el("div", { class: "pane" }, [
        el("div", { class: "pane-hd" }, ["+ 加 Windsurf 账号"]),
        el("div", { class: "pane-bd" }, [
          el("div", { class: "row gap" }, [
            el("input", {
              id: "in-acct-email",
              class: "inp grow",
              placeholder: "email · you@windsurf.com",
            }),
            el("input", {
              id: "in-acct-key",
              type: "password",
              class: "inp grow",
              placeholder: "API Key · sk-ws-01-...",
            }),
            el("button", { class: "btn", onclick: addAccount }, ["加"]),
          ]),
          el("div", { class: "hint" }, [
            "email + key 落用户私有 Gist · dao-genesis 不见 · 各账号自属自己 Devin VM",
          ]),
        ]),
      ]),
    );

    // B · 账号表
    const tbl = el("div", { class: "acct-table" });
    if (!D.accounts || D.accounts.length === 0) {
      tbl.appendChild(el("div", { class: "empty" }, ["(无账号 · 上方加之)"]));
    } else {
      D.accounts.forEach((a, i) => {
        const isActive = a.email === D.activeAccountEmail;
        tbl.appendChild(
          el("div", { class: "acct-row" + (isActive ? " active" : "") }, [
            el(
              "span",
              { class: "dot " + (a.alive === false ? "off" : "on") },
              [],
            ),
            el("span", { class: "acct-mail", title: a.email }, [a.email]),
            el("span", { class: "acct-quota" }, [
              a.quotaD != null
                ? "D" + a.quotaD + " / W" + (a.quotaW != null ? a.quotaW : "?")
                : "—",
            ]),
            el("span", { class: "acct-time" }, [
              a.lastUsedAt ? new Date(a.lastUsedAt).toLocaleString() : "—",
            ]),
            el(
              "button",
              {
                class: "btn tiny" + (isActive ? " active" : ""),
                onclick: () => {
                  D.activeAccountEmail = a.email;
                  markDirty();
                  renderMid();
                  renderLeft();
                },
              },
              [isActive ? "★ active" : "设 active"],
            ),
            el(
              "button",
              { class: "btn tiny ghost", onclick: () => probeAccount(i) },
              ["探"],
            ),
            el(
              "button",
              {
                class: "btn tiny danger",
                onclick: () => {
                  if (confirm("删 " + a.email + " ?")) {
                    D.accounts.splice(i, 1);
                    if (a.email === D.activeAccountEmail)
                      D.activeAccountEmail = "";
                    markDirty();
                    renderMid();
                  }
                },
              },
              ["×"],
            ),
          ]),
        );
      });
    }
    root.appendChild(
      el("div", { class: "pane" }, [
        el("div", { class: "pane-hd" }, [
          "账号库 ",
          el("span", { class: "meta" }, [
            (D.accounts || []).length +
              " 号 · active: " +
              (D.activeAccountEmail || "—"),
          ]),
        ]),
        el("div", { class: "pane-bd" }, [tbl]),
      ]),
    );

    // C · 一键探所有
    root.appendChild(
      el("div", { class: "pane" }, [
        el("div", { class: "pane-bd row gap" }, [
          el("button", { class: "btn", onclick: probeAll }, [
            "⚡ 探针全部 (调 VM /quota)",
          ]),
          el("button", { class: "btn ghost", onclick: rotateActive }, [
            "↻ 轮换 active (quota-aware)",
          ]),
          el("span", { class: "grow" }, []),
          el("span", { class: "hint" }, [
            "探针需 VM URL 设妥 · /quota 借 active 账号查",
          ]),
        ]),
      ]),
    );
  }

  function addAccount() {
    const D = memo.data;
    const email = ($("in-acct-email").value || "").trim();
    const key = ($("in-acct-key").value || "").trim();
    if (!email || !key) {
      toast("email + key 必填", "warn");
      return;
    }
    if (D.accounts.find((a) => a.email === email)) {
      toast("账号已存", "warn");
      return;
    }
    D.accounts.push({
      email,
      apiKey: key,
      addedAt: new Date().toISOString(),
      alive: null,
    });
    if (!D.activeAccountEmail) D.activeAccountEmail = email;
    markDirty();
    $("in-acct-email").value = "";
    $("in-acct-key").value = "";
    renderMid();
  }

  // ═══════════════════════════════════════════════════════════════════
  // 印 129 · 真本源切号 · 自动登 Windsurf
  //   主公诏 (2026-05-17 16:11):
  //     「反者道之动也 · 不作茧自缚 · 不限制 · 不惧 方能成其大」
  //     「此登录为核心切号本源 · 凡无法替我之一切」
  //     「登录 windsurf 于 devin.ai 网页 必然无法后续实现切号等所有功能」
  //     「不着相 · 直接推进道极 · 无为而无不为」
  //
  //   入: email + password (用户在 web 中栏输)
  //   传: vmUrl/admin/signin/windsurf (VM 代登 windsurf.com 3-step)
  //   出: { apiKey, apiServerUrl, sessionToken } (真本源 ws-* key)
  //   果: 自动入 D.accounts 池 · 走反代 /v1/messages
  //
  //   走后端 (Devin VM) 不走浏览器 · 因 windsurf.com 无 CORS
  //   密码不存盘 (仅 process · 一次性传 VM)
  // ═══════════════════════════════════════════════════════════════════
  async function autoSigninWindsurf() {
    const D = memo.data;
    const emailEl = $("in-signin-email");
    const pwEl = $("in-signin-pw");
    const statusEl = $("signin-status");
    const email = (emailEl ? emailEl.value : "").trim();
    const password = pwEl ? pwEl.value : "";
    if (!email || !password) {
      toast("email + password 必填", "warn");
      return;
    }
    if (!D.vmUrl) {
      toast("先设 VM URL (左栏端点)", "warn");
      return;
    }
    if (D.accounts.find((a) => a.email === email)) {
      toast("账号已存 · 请先删旧再登", "warn");
      return;
    }
    if (statusEl) statusEl.textContent = "⌛ VM 代登 windsurf.com 3-step …";
    try {
      const r = await fetch(D.vmUrl + "/admin/signin/windsurf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(D.vmAuthKey ? { Authorization: "Bearer " + D.vmAuthKey } : {}),
        },
        body: JSON.stringify({ email, password }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) {
        const stage = j.stage || "unknown";
        const err = j.error || "HTTP " + r.status;
        if (statusEl) statusEl.textContent = "✗ [" + stage + "] " + err;
        toast("登失败 [" + stage + "]: " + err, "err");
        return;
      }
      // 真本源成 · 入号库
      D.accounts.push({
        email: j.email || email,
        apiKey: j.apiKey,
        apiServerUrl: j.apiServerUrl || "",
        accountId: j.accountId || "",
        addedAt: new Date().toISOString(),
        signinAt: new Date().toISOString(),
        viaSignin: true, // 印 129 标 · 区别手输 vs 自动登
        alive: true,
      });
      if (!D.activeAccountEmail) D.activeAccountEmail = email;
      markDirty();
      // 清入
      if (emailEl) emailEl.value = "";
      if (pwEl) pwEl.value = "";
      if (statusEl)
        statusEl.textContent =
          "✓ 登成 · apiKey=" +
          (j.apiKey || "").slice(0, 12) +
          "… · " +
          (j.ms || "?") +
          "ms";
      toast("✓ 登成: " + email, "ok");
      // 印 130 · 真本源接入闭环 (登→入池→用 一线到底)
      //   将真登出之 ws-* key 立即注入 VM dao_proxy 反代池 (WS_POOL_STATE)
      //   失败不阻 · 因登已成 (key 已入号库) · 池接入是「锦上添花」
      try {
        const addR = await fetch(D.vmUrl + "/admin/keys/add", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(D.vmAuthKey ? { Authorization: "Bearer " + D.vmAuthKey } : {}),
          },
          body: JSON.stringify({
            apiKey: j.apiKey,
            srvUrl: j.apiServerUrl || "",
            email: email,
          }),
        });
        const addJ = await addR.json().catch(() => ({}));
        if (addR.ok && addJ.ok) {
          if (statusEl)
            statusEl.textContent +=
              " · 池+1 (count=" + (addJ.count || "?") + ")";
          toast("✓ 接入反代池 (count=" + (addJ.count || "?") + ")", "ok");
        } else if (statusEl) {
          statusEl.textContent += " · 池接入失败";
        }
      } catch (e) {
        // 网错不阻 · 主公可后续手动调 /admin/keys/add 补
        if (statusEl) statusEl.textContent += " · 池接入网错";
      }
      // 重渲号库
      renderMid();
    } catch (e) {
      if (statusEl) statusEl.textContent = "✗ 网错: " + e.message;
      toast("网错: " + e.message, "err");
    }
  }

  async function probeAccount(i) {
    const D = memo.data;
    const a = D.accounts[i];
    if (!a) return;
    if (!D.vmUrl) {
      toast("先设 VM URL · 探针借 VM /auth/status", "warn");
      return;
    }
    toast("探 " + a.email + " …", "info");
    try {
      const r = await fetch(D.vmUrl + "/auth/status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(D.vmAuthKey ? { Authorization: "Bearer " + D.vmAuthKey } : {}),
        },
        body: JSON.stringify({ api_key: a.apiKey }),
      });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const j = await r.json();
      a.alive = !!j.ok;
      a.quotaD =
        j.dailyRemaining != null ? j.dailyRemaining : j.quota && j.quota.daily;
      a.quotaW =
        j.weeklyRemaining != null
          ? j.weeklyRemaining
          : j.quota && j.quota.weekly;
      a.lastUsedAt = new Date().toISOString();
      markDirty();
      renderMid();
      toast(
        "探 " + a.email + " · D" + a.quotaD + " W" + a.quotaW,
        a.alive ? "ok" : "warn",
      );
    } catch (e) {
      a.alive = false;
      markDirty();
      renderMid();
      toast("探失败: " + e.message, "err");
    }
  }

  async function probeAll() {
    const D = memo.data;
    if (!D.accounts || !D.accounts.length) {
      toast("无账号", "warn");
      return;
    }
    for (let i = 0; i < D.accounts.length; i++) {
      await probeAccount(i);
    }
  }

  function rotateActive() {
    const D = memo.data;
    if (!D.accounts || !D.accounts.length) {
      toast("无账号", "warn");
      return;
    }
    // quota-aware: 选 quotaD 最大者 · 否则 round-robin
    const sorted = D.accounts
      .slice()
      .sort((a, b) => (b.quotaD || 0) - (a.quotaD || 0));
    const next = sorted[0];
    if (next && next.email !== D.activeAccountEmail) {
      D.activeAccountEmail = next.email;
      markDirty();
      renderMid();
      renderLeft();
      toast(
        "active → " + next.email + " (quota D" + (next.quotaD || "?") + ")",
        "ok",
      );
    } else {
      toast("已是最优 active", "info");
    }
  }

  // ─── 右栏 · Chat (Cascade-like) ─────────────────────────────────────
  let chatAbort = null;

  function renderRight() {
    const root = $("mine-right");
    if (!root) return;
    root.innerHTML = "";
    const D = memo.data;

    // 印 88 · 模型双路 · A 路 codeium + B 路 devin-cloud (wss://app.devin.ai)
    //   庄子·齐物论: 「物无非彼，物无非是」
    //   选 devin-cloud-* 自动走 B 路 (D 桶绕 W cap)
    const modelsByPath = [
      {
        label: "── A 路 · codeium (/v1/*) ──",
        items: [
          "claude-sonnet-4-20250514",
          "claude-haiku-4-20250514",
          "gpt-4o",
          "gpt-4o-mini",
          "o1",
          "o1-mini",
          "gemini-2.0-flash-exp",
          "deepseek-v3",
          "qwen-coder-32b-instruct",
        ],
      },
      {
        label: "── B 路 · devin-cloud (/dc/v1/* · wss) ──",
        items: ["devin-cloud-claude", "devin-cloud-gpt", "devin-cloud-agent"],
      },
    ];
    // 平展供默选
    const models = modelsByPath.flatMap((g) => g.items);

    // 印 91 · 右栏顶 engine badge bar · 显当前 A/B 路 + SP mode + iframe 切
    //   帛书·二十二: 「圣人执一 · 以为天下牧」—— 一目知三态
    const curModel = (D.lastModel || models[0]).toString();
    const curEngine = /devin-cloud/i.test(curModel) ? "B" : "A";
    const curSpMode = (D.sp && D.sp.mode) || "dao";
    const useIframe = !!D.useDevinIframe;
    const badgeBar = el(
      "div",
      { class: "engine-badge-bar", id: "engine-badge-bar" },
      [
        el(
          "span",
          {
            class: "engine-badge engine-" + curEngine,
            id: "engine-badge-path",
          },
          [curEngine === "B" ? "B 路 · devin-cloud" : "A 路 · codeium"],
        ),
        el(
          "span",
          {
            class: "engine-badge sp-mode-" + curSpMode,
            id: "engine-badge-sp",
            title: "SP mode (左栏改)",
          },
          ["SP · " + curSpMode],
        ),
        el(
          "span",
          { class: "engine-badge engine-info", title: "印 91 · 一目三态" },
          ["印 91"],
        ),
        el("span", { class: "grow" }, []),
        el(
          "label",
          {
            class: "iframe-toggle",
            title: "右栏一笔切到 app.devin.ai 真站 (配 dao-injector 自动注 SP)",
          },
          [
            (function () {
              const cb = el("input", {
                type: "checkbox",
                id: "in-iframe-mode",
              });
              cb.checked = useIframe;
              cb.addEventListener("change", (e) => {
                D.useDevinIframe = !!e.target.checked;
                markDirty();
                renderRight();
              });
              return cb;
            })(),
            el("span", null, ["嵌 app.devin.ai"]),
          ],
        ),
      ],
    );
    root.appendChild(badgeBar);

    // 印 91 · iframe 模式 · 右栏即 app.devin.ai 真站
    //   帛书·四十八: 「为道者日损 · 损之又损 · 以至于无为」
    //   配 dao-injector 已装 (Chrome 扩展或 Tampermonkey) · 浏览器内 wss hook 自动注帛书
    //   未装则提示用户去左栏 'D · 网页端 SP 注入器' 段装
    if (useIframe) {
      const ifr = el("iframe", {
        id: "devin-iframe",
        src: "https://app.devin.ai/",
        class: "devin-iframe",
        sandbox:
          "allow-same-origin allow-scripts allow-forms allow-popups allow-top-navigation-by-user-activation",
        allow: "clipboard-read; clipboard-write",
        style: {
          width: "100%",
          flex: "1",
          border: "1px solid #2a2a2a",
          borderRadius: "6px",
          minHeight: "400px",
          background: "#0a0a0a",
        },
      });
      const hint = el(
        "div",
        { class: "hint", style: { marginTop: "8px", fontSize: "11px" } },
        [
          "★ 装 dao-injector 后此 iframe 内每笔自动注帛书 (印 89 风格引导 · 印 90 wss hook) · 未装则原态使用 app.devin.ai",
        ],
      );
      root.appendChild(ifr);
      root.appendChild(hint);
      return; // iframe 模式 · 不再渲染 chat 历史与输入区
    }

    // 顶 · 模型选 (分组 optgroup) + 高级 + 清
    const head = el("div", { class: "chat-head" }, [
      el(
        "select",
        {
          id: "in-chat-model",
          class: "inp small",
          // 印 91 · model 改时实时更新 engine badge + 持 lastModel
          onchange: (e) => {
            const m = e.target.value;
            D.lastModel = m;
            markDirty();
            const isB = /devin-cloud/i.test(m);
            const bp = $("engine-badge-path");
            if (bp) {
              bp.textContent = isB ? "B 路 · devin-cloud" : "A 路 · codeium";
              bp.className = "engine-badge engine-" + (isB ? "B" : "A");
            }
          },
        },
        modelsByPath.map((g) =>
          el(
            "optgroup",
            { label: g.label },
            g.items.map((m) => el("option", { value: m }, [m])),
          ),
        ),
      ),
      el(
        "button",
        {
          class: "btn tiny ghost",
          onclick: () =>
            ($("chat-adv").style.display =
              $("chat-adv").style.display === "none" ? "" : "none"),
          title: "高级",
        },
        ["⚙"],
      ),
      el(
        "button",
        {
          class: "btn tiny ghost",
          onclick: () => {
            D.chatHistory = [];
            markDirty();
            renderRight();
          },
        },
        ["✕ 清"],
      ),
    ]);
    root.appendChild(head);

    // 印 91 · select 初值设 lastModel (el() 不支 selected 属性)
    const _selModel = $("in-chat-model");
    if (_selModel && D.lastModel) _selModel.value = D.lastModel;

    // 高级 (默隐)
    const adv = el(
      "div",
      { id: "chat-adv", class: "pane", style: { display: "none" } },
      [
        el("div", { class: "pane-bd" }, [
          el("label", null, ["stream"]),
          el("input", {
            type: "checkbox",
            id: "in-chat-stream",
            checked: true,
          }),
          el("label", null, ["max_tokens"]),
          el("input", {
            type: "number",
            id: "in-chat-max",
            class: "inp small",
            value: "2048",
            min: "16",
            max: "32768",
          }),
          el("label", null, ["temperature"]),
          el("input", {
            type: "number",
            id: "in-chat-temp",
            class: "inp small",
            value: "0.7",
            min: "0",
            max: "2",
            step: "0.1",
          }),
        ]),
      ],
    );
    root.appendChild(adv);
    // 印 69: setTimeout trick 已废 · 修[1] 之 el() 直接 prop 赋值已正

    // 历史
    const hist = el("div", { id: "chat-history", class: "chat-history" });
    if (!D.chatHistory || D.chatHistory.length === 0) {
      hist.appendChild(
        el("div", { class: "chat-empty" }, [
          el("div", { class: "dao" }, ["道"]),
          el("div", { class: "dao-line" }, ["道可道 · 非恒道"]),
          el("div", { class: "hint" }, ["⏎ 发 · shift+⏎ 换行"]),
        ]),
      );
    } else {
      D.chatHistory.forEach((m, idx) => hist.appendChild(renderMsg(m, idx)));
    }
    root.appendChild(hist);

    // 输入区
    const inp = el("textarea", {
      id: "in-chat-input",
      class: "chat-input",
      rows: "3",
      placeholder: "Ask 道 · 言之",
    });
    const sendBtn = el(
      "button",
      {
        id: "btn-chat-send",
        class: "btn chat-send",
        onclick: () => sendChat(),
      },
      ["↑"],
    );
    const stopBtn = el(
      "button",
      {
        id: "btn-chat-stop",
        class: "btn chat-send danger",
        style: { display: "none" },
        onclick: () => {
          if (chatAbort) chatAbort.abort();
        },
      },
      ["⏹"],
    );
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendChat();
      }
    });
    root.appendChild(
      el("div", { class: "chat-input-area" }, [inp, sendBtn, stopBtn]),
    );
  }

  function renderMsg(m, idx) {
    // 印 69 修[4]: m.error 时 class 用 msg-error · 配合 修[3] 视觉标识保留
    const wrap = el("div", {
      class: "msg msg-" + (m.error ? "error" : m.role),
    });
    wrap.appendChild(el("div", { class: "role" }, [m.role]));
    wrap.appendChild(el("div", { class: "content" }, [m.content || ""]));
    if (m.role !== "system") {
      wrap.appendChild(
        el(
          "button",
          {
            class: "btn tiny ghost del-btn",
            onclick: () => {
              memo.data.chatHistory.splice(idx, 1);
              markDirty();
              renderRight();
            },
          },
          ["×"],
        ),
      );
    }
    return wrap;
  }

  async function sendChat() {
    const D = memo.data;
    if (!D.vmUrl) {
      toast("先设左栏 VM URL", "warn");
      return;
    }
    const inp = $("in-chat-input");
    const userText = (inp.value || "").trim();
    if (!userText) return;

    D.chatHistory.push({ role: "user", content: userText, ts: Date.now() });
    inp.value = "";
    renderRight();

    // 准备 assistant 占位
    D.chatHistory.push({
      role: "assistant",
      content: "",
      ts: Date.now(),
      streaming: true,
    });
    renderRight();
    const histDom = $("chat-history");
    if (histDom) histDom.scrollTop = histDom.scrollHeight;

    const model =
      ($("in-chat-model") && $("in-chat-model").value) ||
      "claude-sonnet-4-20250514";
    // 印 88 · 模型名含 devin-cloud 则走 B 路 /dc/v1/* · 否则走 A 路 /v1/*
    //   帛书·四十二: 道生一 · 一生二 · 二生三 · 三生万物
    const pathPrefix = /devin-cloud/i.test(model) ? "/dc/v1" : "/v1";
    const engineTag = pathPrefix === "/dc/v1" ? "devin-cloud" : "codeium";
    const stream = !!($("in-chat-stream") && $("in-chat-stream").checked);
    const maxT = parseInt(
      ($("in-chat-max") && $("in-chat-max").value) || "2048",
      10,
    );
    const temp = parseFloat(
      ($("in-chat-temp") && $("in-chat-temp").value) || "0.7",
    );

    // 印 69 修[2]: 双 filter 合一 · 排除 streaming 占位 + error 行 (后者非合法 OpenAI role)
    const messages = D.chatHistory
      .filter((m) => !m.streaming && !m.error)
      .map((m) => ({ role: m.role, content: m.content }));

    // 印 88 · SP 注入 · 不再仅占位 — 真正替在 VM 端 sp_handler 做 (主考 ~/.dao/sp_state.json)
    //   前端仅需推 mode 到 VM · /sp/mode (默随修道着推·不推则 VM 保原 mode)
    //   帛书·二十二: 「圣人执一 · 以为天下牧」—— SP 不在两处·唯在 VM 一处
    //   须设 custom SP 才补 system (VM 未接 custom 文本 · web 正是推入途径)
    if (D.sp.mode === "custom" && D.sp.custom) {
      messages.unshift({ role: "system", content: D.sp.custom });
    }
    // mode=dao 则什么也不加 — VM /sp 路已有帛书《老子》全文 (silk=17K字)
    // mode=passthrough 亦空 — 原原本本送入 VM

    chatAbort = new AbortController();
    $("btn-chat-send").style.display = "none";
    $("btn-chat-stop").style.display = "";

    const last = D.chatHistory[D.chatHistory.length - 1];

    try {
      // 印 88 · 智能分流 · /v1/chat/completions vs /dc/v1/chat/completions
      const resp = await fetch(D.vmUrl + pathPrefix + "/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Dao-Engine": engineTag,
          ...(D.vmAuthKey ? { Authorization: "Bearer " + D.vmAuthKey } : {}),
        },
        body: JSON.stringify({
          model,
          messages,
          stream,
          max_tokens: maxT,
          temperature: temp,
        }),
        signal: chatAbort.signal,
      });
      if (!resp.ok) {
        const t = await resp.text().catch(() => "");
        throw new Error("HTTP " + resp.status + " · " + t.slice(0, 200));
      }

      if (stream && resp.body) {
        const reader = resp.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() || "";
          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            const data = line.slice(5).trim();
            if (data === "[DONE]") {
              break;
            }
            try {
              const obj = JSON.parse(data);
              const delta =
                obj.choices && obj.choices[0] && obj.choices[0].delta;
              const txt = delta && delta.content;
              if (txt) {
                last.content += txt;
                // 增量更新 (避免重渲染) · 用 textContent 替最后一条 .content
                const histChildren = $("chat-history").children;
                const lastMsgDom = histChildren[histChildren.length - 1];
                if (lastMsgDom) {
                  const c = lastMsgDom.querySelector(".content");
                  if (c) c.textContent = last.content;
                }
                if (histDom) histDom.scrollTop = histDom.scrollHeight;
              }
            } catch {}
          }
        }
      } else {
        const j = await resp.json();
        const txt =
          j.choices &&
          j.choices[0] &&
          j.choices[0].message &&
          j.choices[0].message.content;
        last.content = txt || "(empty)";
        renderRight();
      }

      last.streaming = false;
      markDirty();
    } catch (e) {
      last.content =
        (last.content || "") +
        "\n\n✗ " +
        (e.name === "AbortError" ? "中止" : e.message);
      last.streaming = false;
      // 印 69 修[3]: 不再篡 role='error' (非合法 OpenAI role · 致下次 chat 死循环)
      // 保 role='assistant' · 加 error flag · UI 检 .error 加 .msg-error class · API 端过滤
      last.error = true;
      markDirty();
      renderRight();
    } finally {
      $("btn-chat-send").style.display = "";
      $("btn-chat-stop").style.display = "none";
      chatAbort = null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 印 101 · 万法归宗 · 大道至简 · 用 + 管 二字
  // ═══════════════════════════════════════════════════════════════════════
  //
  //   主公诏 (2026-05-14):
  //     「反者道之动 · 代替用户之一切 · 测试使用验证一切 · 推进到极」
  //     「专注于用户最终管理使用页面 · 万法归宗 · 大道至简 · 彻底整合」
  //     「反代 windsurf+devin · 提示词综合管理 · 反代 api 管理 ·
  //      wam 切号管理 · agent 交互页面测试使用」
  //     「为学者日益 · 为道者日损 · 从根本底层需求出发 · 大道至简」
  //
  //   解此诏:
  //     旧 (印 67-100):  6 left pane + 1 mid + 1 right = 8 pane 杂烩, 印记叠
  //     新 (印 101):    主面「用」(chat/iframe/批跑) + 抽屉「管」(切号/SP/端点/测试)
  //
  //   道义守:
  //     · 损: 8 pane → 主面 3 tab + 抽屉 4 节
  //     · 一: 五大功能并行不悖, 共一页一面一抽屉
  //     · 反: 旧 80% 屏给「管」 → 新 80% 屏给「用」
  //     · 自然: 用户进来默见 chat 框 (最高频) · 管在 ⚙ 抽屉 (低频)
  //
  //   帛书:
  //     四十八: 「为道者日损 · 损之又损 · 以至于无为 · 无为而无不为」
  //     三十二: 「侯王若能守之 · 万物将自宾 · 民莫之令而自均焉」
  //     六十四: 「图难于其易 · 为大于其细 · 圣人终不为大 · 故能成其大」

  // 用区 tab 状态 (全局)
  // 印 ∞ (2026-05-17) · 默 "parallel" · 上下分屏 iframe 真站 + mini chat 反代
  //   帛书·二: 物无非彼 · 物无非是 · 自彼则不见 · 自是则知之 (按庄子·齐物论)
  //   主公诏: 「右栏对照 devin.ai 网页 · 实时交互 · 测试反代 API · 无感使用」
  //   parallel tab = chat 与 iframe 之合 · 物之两面同一道 · 一目尽显
  let __useTab = "parallel"; // 'parallel' | 'chat' | 'iframe' | 'batch'
  // 抽屉打开节 (null = 关)
  let __drawerOpen = null; // 'acct' | 'sp' | 'endpt' | 'test' | null

  function renderMineV101() {
    const root = $("mine-v101");
    if (!root) return;
    root.innerHTML = "";
    root.style.display = "flex";
    // 隐 老三栏容器 + v128 (若存在)
    const oldCols = document.querySelector(".mine-cols");
    if (oldCols) oldCols.style.display = "none";
    const v128 = $("mine-v128");
    if (v128) v128.style.display = "none";

    root.appendChild(renderTopBar());
    root.appendChild(renderUseArea());
    root.appendChild(renderDrawer());
  }

  // ═══════════════════════════════════════════════════════════════════
  // 印 128 · 一气化三清 · IDE 三栏并行常驻 (默) · 物无非彼 物无非是
  // ═══════════════════════════════════════════════════════════════════
  // 帛书·二:   「物无非彼 · 物无非是 · 自彼则不见 · 自是则知之」(按庄子·齐物论)
  // 帛书·廿二: 「圣人执一 · 以为天下牧」
  // 帛书·四十八: 「为道者日损 · 损之又损 · 以至于无为 · 无为而无不为」
  //
  // 三栏并行而不悖:
  //   左 (360px)  · 反代端点 + SP 七态 (Devin VM → Windsurf API + Devin Cloud · 提示词隔离注入)
  //   中 (1fr)    · WAM 切号 + 账号库 (本机 + 云 daemon 池一表)
  //   右 (460px)  · devin.ai iframe + chat 测反代 + batch + /v1 实测
  //
  // 复用 v101 之 renderDrawer_endpt / renderDrawer_sp / renderDrawer_acct / renderUseArea / renderDrawer_test
  // 单一真相 (memo.data) 三栏共享 · 一处改万法响应
  // ═══════════════════════════════════════════════════════════════════
  function renderMineV128() {
    const root = $("mine-v128");
    if (!root) return;
    root.innerHTML = "";
    root.style.display = "flex";
    // 隐 v101 + 老三栏容器 (若存在)
    const v101 = $("mine-v101");
    if (v101) v101.style.display = "none";
    const oldCols = document.querySelector(".mine-cols");
    if (oldCols) oldCols.style.display = "none";

    // 顶栏 (复用 v101 之 topBar)
    root.appendChild(renderTopBar());

    // 三栏容器
    const cols = el("div", { class: "v128-cols" }, []);

    // ────────── 左栏 · 反代 + SP 七态 ──────────
    const colLeft = el("aside", { class: "v128-col v128-left" }, [
      el("div", { class: "v128-col-hd" }, [
        el("span", { class: "v128-col-icon" }, ["\u26A1"]),
        "\u5DE6 \u00B7 \u53CD\u4EE3 \u00B7 \u63D0\u793A\u8BCD",
        el("span", { class: "v128-col-sub" }, [
          "Devin VM \u2192 Windsurf API + Devin Cloud",
        ]),
      ]),
    ]);
    const leftBody = el(
      "div",
      { class: "v128-col-bd", id: "v128-left-bd" },
      [],
    );
    // 端点 (vmUrl + authKey + 模型 + daemon 池)
    renderDrawer_endpt(leftBody);
    // SP 七态 + 提示词隔离注入
    leftBody.appendChild(
      el("div", { class: "v128-sect-hd", style: { marginTop: "14px" } }, [
        "\u2500 \u63D0\u793A\u8BCD\u9694\u79BB\u6CE8\u5165 (SP \u4E03\u6001) \u2500",
      ]),
    );
    renderDrawer_sp(leftBody);
    colLeft.appendChild(leftBody);
    cols.appendChild(colLeft);

    // ────────── 中栏 · WAM 切号 + 账号库 ──────────
    const colMid = el("section", { class: "v128-col v128-mid" }, [
      el("div", { class: "v128-col-hd" }, [
        el("span", { class: "v128-col-icon" }, ["\u263F"]),
        "\u4E2D \u00B7 WAM \u5207\u53F7 \u00B7 \u8D26\u53F7\u5E93",
        el("span", { class: "v128-col-sub" }, [
          "Windsurf \u8D26\u53F7 \u00B7 \u4E00\u7B14\u5207 \u00B7 \u672C\u673A+\u4E91 daemon \u6C60",
        ]),
      ]),
    ]);
    const midBody = el("div", { class: "v128-col-bd", id: "v128-mid-bd" }, []);
    renderDrawer_acct(midBody);
    colMid.appendChild(midBody);
    cols.appendChild(colMid);

    // ────────── 右栏 · 实证 (devin.ai iframe + chat + batch + test) ──────────
    const colRight = el("aside", { class: "v128-col v128-right" }, [
      el("div", { class: "v128-col-hd" }, [
        el("span", { class: "v128-col-icon" }, ["\u2299"]),
        "\u53F3 \u00B7 \u5B9E\u8BC1 \u00B7 \u9053\u5E76\u884C",
        el("span", { class: "v128-col-sub" }, [
          "devin.ai \u5BF9\u7167 + chat \u6D4B\u53CD\u4EE3 + batch + /v1 \u5B9E\u6D4B",
        ]),
      ]),
    ]);
    const rightBody = el(
      "div",
      { class: "v128-col-bd", id: "v128-right-bd" },
      [],
    );
    // 复用 v101 之 useArea (chat + iframe + batch 子tab 系)
    rightBody.appendChild(renderUseArea());
    // 加 /v1 实测节 (复用 renderDrawer_test)
    const testSect = el(
      "div",
      { class: "v128-sect", style: { marginTop: "14px" } },
      [],
    );
    testSect.appendChild(
      el("div", { class: "v128-sect-hd" }, [
        "\u2500 /v1 \u5B9E\u6D4B (\u771F\u53D1 health + models + chat) \u2500",
      ]),
    );
    renderDrawer_test(testSect);
    rightBody.appendChild(testSect);
    colRight.appendChild(rightBody);
    cols.appendChild(colRight);

    root.appendChild(cols);
  }

  // ─── 顶栏 · 一行三态 + 浮按 ────────────────────────────────────────────
  // 帛书廿二: 「圣人执一 · 以为天下牧」—— 一目知三态
  function renderTopBar() {
    const D = memo.data;
    const bar = el("div", { class: "v101-topbar", id: "v101-topbar" }, []);

    // ① 反代活否
    const reverseOk = !!(D.vmUrl && /^https?:\/\//.test(D.vmUrl));
    const reverseDot = el(
      "span",
      {
        class: "v101-dot " + (reverseOk ? "ok" : "off"),
        title: reverseOk ? "反代 vmUrl 已设" : "反代未设 · 去 ⚙ → 端点",
      },
      [reverseOk ? "●" : "○"],
    );
    const reverseTxt = el("span", { class: "v101-meta" }, [
      reverseOk ? "反代活" : "反代未设",
    ]);

    // ② 当前号
    // 印 131 · 反者道之动 · defensive guard (fake/legacy 数据 email 缺时 · 不挂 renderTopBar)
    //   (注: 主公印 129 是 Windsurf 真登录链 · 此印 131 避号位冲突 · playwright 真测发现治之)
    //   原: find((a) => a.email === D.activeEmail) · 当 a.email + D.activeEmail 皆 undefined → 误匹配 → activeAcct.email.length 挂
    //   治: 要求 a.email truthy · 失配则 fallback "未选号 (N 候)" 或 "无号"
    const accts = D.accounts || [];
    const activeAcct = accts.find((a) => a.email && a.email === D.activeEmail);
    const acctLabel = activeAcct
      ? activeAcct.email.length > 22
        ? activeAcct.email.slice(0, 20) + "…"
        : activeAcct.email
      : accts.length
        ? "未选号 (" + accts.length + " 候)"
        : "无号";
    const acctChip = el(
      "button",
      {
        class: "v101-chip",
        title: "号库: " + accts.length + " 条 · 点开 ⚙ → 切号",
        onclick: () => openDrawer("acct"),
      },
      ["号: " + acctLabel],
    );

    // ③ 当前模型
    const curModel = D.lastModel || "claude-sonnet-4-20250514";
    const isB = /devin-cloud/i.test(curModel);
    const modelShort = curModel
      .replace(/^claude-/, "")
      .replace(/^devin-cloud-/, "dc-");
    const modelChip = el(
      "span",
      {
        class: "v101-chip " + (isB ? "model-b" : "model-a"),
        title: "当前模型 · 用区 chat 头可改",
      },
      [
        (isB ? "B " : "A ") +
          (modelShort.length > 18 ? modelShort.slice(0, 16) + "…" : modelShort),
      ],
    );

    // 浮按区
    const copyBaseBtn = el(
      "button",
      {
        class: "v101-btn small",
        title: "复 Base URL 到剪贴板 (OpenAI 兼客直用)",
        onclick: () => {
          if (!D.vmUrl) {
            toast("反代 vmUrl 未设 · 去 ⚙ → 端点", "warn");
            openDrawer("endpt");
            return;
          }
          navigator.clipboard.writeText(D.vmUrl + "/v1");
          toast("Base URL → " + D.vmUrl + "/v1 已复制", "ok");
        },
      },
      ["复 Base URL"],
    );
    const copyKeyBtn = el(
      "button",
      {
        class: "v101-btn small ghost",
        title: "复 Auth Key 到剪贴板",
        onclick: () => {
          if (!D.vmAuthKey) {
            toast("auth key 未设 · 去 ⚙ → 端点", "warn");
            openDrawer("endpt");
            return;
          }
          navigator.clipboard.writeText(D.vmAuthKey);
          toast("Auth Key 已复制", "ok");
        },
      },
      ["复 Key"],
    );
    const drawerBtn = el(
      "button",
      {
        class: "v101-btn small ghost",
        title: "管 (切号 / SP / 端点 / 测试)",
        onclick: () => toggleDrawer("acct"),
      },
      ["⚙ 管"],
    );

    bar.appendChild(
      el("div", { class: "v101-topbar-l" }, [
        reverseDot,
        reverseTxt,
        el("span", { class: "v101-sep" }, ["·"]),
        acctChip,
        el("span", { class: "v101-sep" }, ["·"]),
        modelChip,
      ]),
    );
    bar.appendChild(
      el("div", { class: "v101-topbar-r" }, [
        copyBaseBtn,
        copyKeyBtn,
        drawerBtn,
      ]),
    );
    return bar;
  }

  // ─── 用区 · 三 tab (chat / iframe / 批跑) ──────────────────────────────
  // 帛书四十八: 「损之又损 · 以至于无为」—— 用户进来默见 chat (最高频)
  function renderUseArea() {
    const D = memo.data;
    const area = el("div", { class: "v101-use", id: "v101-use" }, []);

    // tab bar · 印 ∞ · "★ 对照" 第一位 · 默 tab · 物无非彼 物无非是
    const tabs = el("div", { class: "v101-use-tabs" }, [
      makeUseTab(
        "parallel",
        "★ 对照",
        "印 ∞ · 上 iframe 真站 + 下 chat 反代 · 同问验之 · 物之两面同一道",
      ),
      makeUseTab("chat", "对话", "Cascade 风 · 走反代 vmUrl · 大屏 chat"),
      makeUseTab("iframe", "嵌真站", "iframe app.devin.ai (印 91) · 大屏真站"),
      makeUseTab("batch", "批跑测", "题集 · A/B 路对比 · 通过率"),
    ]);
    area.appendChild(tabs);

    // tab 内容
    const content = el(
      "div",
      { class: "v101-use-content", id: "v101-use-content" },
      [],
    );
    area.appendChild(content);
    renderUseTabContent(content);
    return area;
  }

  function makeUseTab(id, label, title) {
    const active = __useTab === id;
    return el(
      "button",
      {
        class: "v101-tab" + (active ? " active" : ""),
        title: title,
        onclick: () => {
          __useTab = id;
          const c = $("v101-use-content");
          if (c) renderUseTabContent(c);
          // 重渲 tab bar (active 切)
          const tabsBar = document.querySelector(".v101-use-tabs");
          if (tabsBar) {
            tabsBar.innerHTML = "";
            // 印 ∞ · "★ 对照" tab 第一位 · 默 tab
            tabsBar.appendChild(
              makeUseTab(
                "parallel",
                "★ 对照",
                "印 ∞ · 上 iframe 真站 + 下 chat 反代 · 同问验之",
              ),
            );
            tabsBar.appendChild(
              makeUseTab(
                "chat",
                "对话",
                "Cascade 风 · 走反代 vmUrl · 大屏 chat",
              ),
            );
            tabsBar.appendChild(
              makeUseTab(
                "iframe",
                "嵌真站",
                "iframe app.devin.ai (印 91) · 大屏真站",
              ),
            );
            tabsBar.appendChild(
              makeUseTab("batch", "批跑测", "题集 · A/B 路对比 · 通过率"),
            );
          }
        },
      },
      [label],
    );
  }

  function renderUseTabContent(container) {
    container.innerHTML = "";
    // 印 ∞ · parallel tab · 上 iframe + 下 chat · 默 tab · 物无非彼 物无非是
    if (__useTab === "parallel") renderUseTab_parallel(container);
    else if (__useTab === "chat") renderUseTab_chat(container);
    else if (__useTab === "iframe") renderUseTab_iframe(container);
    else if (__useTab === "batch") renderUseTab_batch(container);
  }

  // ═══════════════════════════════════════════════════════════════════
  // 印 ∞ (2026-05-17) · 对照 tab · 上 iframe 真站 + 下 mini chat 反代
  // ═══════════════════════════════════════════════════════════════════
  //   帛书·二:   「物无非彼 · 物无非是 · 自彼则不见 · 自是则知之」(按庄子·齐物论)
  //   帛书·廿二: 「圣人执一 · 以为天下牧」—— 一框两面同一道
  //   帛书·四十二:「道生一 · 一生二 · 二生三 · 三生万物」—— 一即二
  //
  //   主公诏 (2026-05-17 18:07):
  //     「右侧对照 devin.ai 网页 · 实时交互 · 测试反代出的 API 成果 · 无感使用」
  //     「彻底实现物无非彼 物无非是 · 自彼则不见 · 自是则知之」
  //
  //   复用 chat tab 之全 DOM id (in-chat-input/chat-history/in-chat-model/
  //     btn-chat-send/btn-chat-stop) · sendChat() 直命中 · 一处改万法响应
  //   复用 iframe tab 之 D.iframeSite · 切站记忆
  //   复用 chat tab 之 D.chatHistory · 历史无损切 tab
  // ═══════════════════════════════════════════════════════════════════
  function renderUseTab_parallel(container) {
    const D = memo.data;
    const site = D.iframeSite || "devin";
    const url =
      site === "windsurf"
        ? "https://chat.windsurf.ai/"
        : "https://app.devin.ai/";
    const wrap = el("div", { class: "v101-parallel", id: "v101-parallel" }, []);
    // ─── 上 · iframe head (站切) ───
    const ifrHead = el(
      "div",
      { class: "v101-iframe-head v101-parallel-ifr-head" },
      [
        el("span", { class: "hint" }, ["真站 · 对照参验"]),
        el("span", { class: "grow" }, []),
        el(
          "button",
          {
            class: "v101-btn small" + (site === "devin" ? " active" : " ghost"),
            onclick: () => {
              D.iframeSite = "devin";
              markDirty();
              const c = $("v101-use-content");
              if (c) renderUseTabContent(c);
            },
          },
          ["app.devin.ai"],
        ),
        el(
          "button",
          {
            class:
              "v101-btn small" + (site === "windsurf" ? " active" : " ghost"),
            onclick: () => {
              D.iframeSite = "windsurf";
              markDirty();
              const c = $("v101-use-content");
              if (c) renderUseTabContent(c);
            },
          },
          ["chat.windsurf.ai"],
        ),
        el(
          "button",
          {
            class: "v101-btn small ghost",
            title: "新窗打开真站",
            onclick: () => window.open(url, "_blank", "noopener"),
          },
          ["↗"],
        ),
      ],
    );
    wrap.appendChild(ifrHead);
    // ─── 印 ∞.1 (2026-05-17 道动测后修): 永显 CSP hint bar · 不探测不判 ───
    //   帛书·四十八「为道者日损 · 损之又损 · 以至于无为」
    //   探测难且不稳 (跨源 contentDocument 总 null · clientHeight 不定)
    //   故: 永显一行 hint bar 在 iframe 上 · 不动态判 · 无为而无不为
    //   主公诏: 「无感使用」· 永远显说明 = 用户秒知 = 真无感
    const ifr = el("iframe", {
      src: url,
      class: "v101-parallel-iframe",
      sandbox:
        "allow-same-origin allow-scripts allow-forms allow-popups allow-top-navigation-by-user-activation",
      allow: "clipboard-read; clipboard-write",
    });
    wrap.appendChild(ifr);
    // 永显 CSP 说明 bar (不挡 iframe · 仅 1 行 hint + ↗ 新窗按钮)
    wrap.appendChild(
      el("div", { class: "v101-parallel-csp-bar" }, [
        el("span", { class: "v101-parallel-csp-bar-icon" }, ["🛡"]),
        el("span", { class: "v101-parallel-csp-bar-text" }, [
          "真站设 frame-ancestors CSP · 若白屏 →",
        ]),
        el(
          "button",
          {
            class: "btn tiny",
            onclick: () => window.open(url, "_blank", "noopener"),
          },
          ["↗ 新窗开"],
        ),
        el(
          "button",
          {
            class: "btn tiny ghost",
            onclick: () => {
              D.iframeSite = site === "devin" ? "windsurf" : "devin";
              markDirty();
              const c = $("v101-use-content");
              if (c) renderUseTabContent(c);
            },
          },
          ["⇄ 切站"],
        ),
        el("span", { class: "v101-parallel-csp-bar-tail" }, [
          "或下方 chat 反代实证 (物无非彼物无非是)",
        ]),
      ]),
    );
    // ─── 中 · 道线 hint (物无非彼 物无非是) ───
    wrap.appendChild(
      el("div", { class: "v101-parallel-hint" }, [
        "─── 同问发两边 · 见反代真等价于真站 · 物之两面同一道 ───",
      ]),
    );
    // ─── 下 · mini chat (复用 chat tab 之 DOM id) ───
    const modelsByPath = [
      {
        label: "── A 路 · codeium (/v1/*) ──",
        items: [
          "claude-sonnet-4-20250514",
          "claude-haiku-4-20250514",
          "gpt-4o",
          "gpt-4o-mini",
          "o1",
          "o1-mini",
          "gemini-2.0-flash-exp",
          "deepseek-v3",
          "qwen-coder-32b-instruct",
        ],
      },
      {
        label: "── B 路 · devin-cloud (/dc/v1/* · wss) ──",
        items: ["devin-cloud-claude", "devin-cloud-gpt", "devin-cloud-agent"],
      },
    ];
    const chatHead = el(
      "div",
      { class: "v101-chat-head v101-parallel-chat-head" },
      [
        el(
          "select",
          {
            id: "in-chat-model",
            class: "inp small",
            onchange: (e) => {
              D.lastModel = e.target.value;
              markDirty();
              const top = $("v101-topbar");
              if (top && top.parentNode) {
                const newTop = renderTopBar();
                top.parentNode.replaceChild(newTop, top);
              }
            },
          },
          modelsByPath.map((g) =>
            el(
              "optgroup",
              { label: g.label },
              g.items.map((m) => el("option", { value: m }, [m])),
            ),
          ),
        ),
        el(
          "button",
          {
            class: "btn tiny ghost",
            onclick: () => {
              D.chatHistory = [];
              markDirty();
              const c = $("v101-use-content");
              if (c) renderUseTabContent(c);
            },
          },
          ["✕ 清"],
        ),
      ],
    );
    wrap.appendChild(chatHead);
    const _sel = $("in-chat-model");
    if (_sel && D.lastModel) _sel.value = D.lastModel;
    // chat 历史
    const hist = el("div", {
      id: "chat-history",
      class: "chat-history v101-parallel-hist",
    });
    if (!D.chatHistory || D.chatHistory.length === 0) {
      hist.appendChild(
        el("div", { class: "chat-empty" }, [
          el("div", { class: "dao" }, ["道"]),
          el("div", { class: "dao-line" }, [
            "对照真站 · 同问验之 · 反代等价真站",
          ]),
          el("div", { class: "hint" }, ["⏎ 发 · shift+⏎ 换行"]),
        ]),
      );
    } else {
      D.chatHistory.forEach((m, idx) => hist.appendChild(renderMsg(m, idx)));
    }
    wrap.appendChild(hist);
    // chat 输入
    const inp = el("textarea", {
      id: "in-chat-input",
      class: "chat-input",
      rows: "2",
      placeholder: "Ask 道 · 走反代 · 同时手粘到上方真站可参照验",
    });
    const sendBtn = el(
      "button",
      {
        id: "btn-chat-send",
        class: "btn chat-send",
        onclick: () => sendChatV101(),
      },
      ["↑"],
    );
    const stopBtn = el(
      "button",
      {
        id: "btn-chat-stop",
        class: "btn chat-send danger",
        style: { display: "none" },
        onclick: () => {
          if (chatAbort) chatAbort.abort();
        },
      },
      ["⏹"],
    );
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendChatV101();
      }
    });
    wrap.appendChild(
      el("div", { class: "chat-input-area v101-parallel-input" }, [
        inp,
        sendBtn,
        stopBtn,
      ]),
    );
    container.appendChild(wrap);
  }

  // 用区 · chat tab (移自旧 renderRight · 简化)
  function renderUseTab_chat(container) {
    const D = memo.data;
    const modelsByPath = [
      {
        label: "── A 路 · codeium (/v1/*) ──",
        items: [
          "claude-sonnet-4-20250514",
          "claude-haiku-4-20250514",
          "gpt-4o",
          "gpt-4o-mini",
          "o1",
          "o1-mini",
          "gemini-2.0-flash-exp",
          "deepseek-v3",
          "qwen-coder-32b-instruct",
        ],
      },
      {
        label: "── B 路 · devin-cloud (/dc/v1/* · wss) ──",
        items: ["devin-cloud-claude", "devin-cloud-gpt", "devin-cloud-agent"],
      },
    ];
    const models = modelsByPath.flatMap((g) => g.items);
    const head = el("div", { class: "v101-chat-head" }, [
      el(
        "select",
        {
          id: "in-chat-model",
          class: "inp small",
          onchange: (e) => {
            D.lastModel = e.target.value;
            markDirty();
            // 重渲顶栏以更新 model chip
            const top = $("v101-topbar");
            if (top && top.parentNode) {
              const newTop = renderTopBar();
              top.parentNode.replaceChild(newTop, top);
            }
          },
        },
        modelsByPath.map((g) =>
          el(
            "optgroup",
            { label: g.label },
            g.items.map((m) => el("option", { value: m }, [m])),
          ),
        ),
      ),
      el(
        "button",
        {
          class: "btn tiny ghost",
          onclick: () => {
            D.chatHistory = [];
            markDirty();
            const c = $("v101-use-content");
            if (c) renderUseTabContent(c);
          },
        },
        ["✕ 清"],
      ),
    ]);
    container.appendChild(head);
    const _sel = $("in-chat-model");
    if (_sel && D.lastModel) _sel.value = D.lastModel;

    // 历史 + 输入区
    const hist = el("div", { id: "chat-history", class: "chat-history" });
    if (!D.chatHistory || D.chatHistory.length === 0) {
      hist.appendChild(
        el("div", { class: "chat-empty" }, [
          el("div", { class: "dao" }, ["道"]),
          el("div", { class: "dao-line" }, ["道可道 · 非恒道"]),
          el("div", { class: "hint" }, ["⏎ 发 · shift+⏎ 换行"]),
        ]),
      );
    } else {
      D.chatHistory.forEach((m, idx) => hist.appendChild(renderMsg(m, idx)));
    }
    container.appendChild(hist);

    const inp = el("textarea", {
      id: "in-chat-input",
      class: "chat-input",
      rows: "3",
      placeholder: "Ask 道 · 言之",
    });
    const sendBtn = el(
      "button",
      {
        id: "btn-chat-send",
        class: "btn chat-send",
        onclick: () => sendChatV101(),
      },
      ["↑"],
    );
    const stopBtn = el(
      "button",
      {
        id: "btn-chat-stop",
        class: "btn chat-send danger",
        style: { display: "none" },
        onclick: () => {
          if (chatAbort) chatAbort.abort();
        },
      },
      ["⏹"],
    );
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendChatV101();
      }
    });
    container.appendChild(
      el("div", { class: "chat-input-area" }, [inp, sendBtn, stopBtn]),
    );
  }

  // v101 chat 发 (沿用 sendChat 但重渲 v101 内容)
  // 印 ∞.1 (2026-05-17 道动测后修): parallel tab 亦重渲
  //   原仅 __useTab === "chat" 时重渲 · parallel 时漏 · 印 ∞ 之实漏
  //   主公诏「无为而无不为」— 一函数透两 tab (chat 大屏 + parallel 下半)
  async function sendChatV101() {
    await sendChat();
    const c = $("v101-use-content");
    if (c && (__useTab === "chat" || __useTab === "parallel")) {
      renderUseTabContent(c);
    }
  }

  // 用区 · iframe tab (移自旧 renderRight 之 iframe 段)
  function renderUseTab_iframe(container) {
    const D = memo.data;
    // 切站: app.devin.ai / chat.windsurf.ai (默 devin)
    const site = D.iframeSite || "devin";
    const url =
      site === "windsurf"
        ? "https://chat.windsurf.ai/"
        : "https://app.devin.ai/";
    const head = el("div", { class: "v101-iframe-head" }, [
      el("span", { class: "hint" }, [
        "真站反代 · 浏览器内 wss hook (印 90 dao-injector)",
      ]),
      el("span", { class: "grow" }, []),
      el(
        "button",
        {
          class: "v101-btn small" + (site === "devin" ? " active" : " ghost"),
          onclick: () => {
            D.iframeSite = "devin";
            markDirty();
            const c = $("v101-use-content");
            if (c) renderUseTabContent(c);
          },
        },
        ["app.devin.ai"],
      ),
      el(
        "button",
        {
          class:
            "v101-btn small" + (site === "windsurf" ? " active" : " ghost"),
          onclick: () => {
            D.iframeSite = "windsurf";
            markDirty();
            const c = $("v101-use-content");
            if (c) renderUseTabContent(c);
          },
        },
        ["chat.windsurf.ai"],
      ),
    ]);
    container.appendChild(head);

    const ifr = el("iframe", {
      src: url,
      class: "v101-iframe",
      sandbox:
        "allow-same-origin allow-scripts allow-forms allow-popups allow-top-navigation-by-user-activation",
      allow: "clipboard-read; clipboard-write",
    });
    container.appendChild(ifr);
    container.appendChild(
      el("div", { class: "hint v101-iframe-foot" }, [
        "★ 装 dao-injector (左下 ⚙ → SP) 后 · iframe 内每笔自动注帛书 SP",
      ]),
    );
  }

  // 用区 · 批跑 tab (新功能 · agent 测试)
  // 帛书六十四「图难于其易」—— 测试从最易开始: 固定题集 · 单笔遍跑 · 表对比
  function renderUseTab_batch(container) {
    const D = memo.data;
    if (!D.batch) {
      D.batch = {
        prompts: [
          "用一句话解释什么是道",
          "写一个 Python 函数计算斐波那契数列前 10 项",
          "What is the time complexity of quicksort?",
        ],
        results: [],
      };
    }
    container.appendChild(
      el("div", { class: "v101-batch-head" }, [
        el("span", { class: "hint" }, [
          "批跑测 · 一组 prompt 顺序跑 · A/B 路对比 · 通过率统计 · 道义守: 走当前 vmUrl 不破 SLA",
        ]),
      ]),
    );

    // prompts 编辑区
    const promptsArea = el("textarea", {
      id: "v101-batch-prompts",
      class: "inp",
      rows: "5",
      placeholder: "一行一题 (UTF-8)",
    });
    promptsArea.value = (D.batch.prompts || []).join("\n");
    promptsArea.addEventListener("input", (e) => {
      D.batch.prompts = e.target.value.split("\n").filter((l) => l.trim());
      markDirty();
    });
    container.appendChild(
      el("div", { class: "v101-batch-prompts" }, [
        el("div", { class: "label" }, ["题集 (一行一题):"]),
        promptsArea,
      ]),
    );

    // 跑控
    const runBtn = el(
      "button",
      {
        class: "btn",
        onclick: () => runBatch(),
      },
      ["▶ 批跑"],
    );
    const clearBtn = el(
      "button",
      {
        class: "btn ghost",
        onclick: () => {
          D.batch.results = [];
          markDirty();
          const c = $("v101-use-content");
          if (c) renderUseTabContent(c);
        },
      },
      ["✕ 清结果"],
    );
    container.appendChild(
      el("div", { class: "row gap", style: { marginTop: "8px" } }, [
        runBtn,
        clearBtn,
      ]),
    );

    // 结果表
    const results = D.batch.results || [];
    const total = results.length;
    const okCount = results.filter((r) => r.ok).length;
    const stats = el("div", { class: "v101-batch-stats" }, [
      total === 0
        ? "(未跑 · 点 ▶ 批跑)"
        : "通过率: " +
          okCount +
          "/" +
          total +
          " · " +
          Math.round((okCount / total) * 100) +
          "%",
    ]);
    container.appendChild(stats);

    const tbl = el("table", { class: "v101-batch-table" }, []);
    const thead = el("thead", null, [
      el("tr", null, [
        el("th", null, ["#"]),
        el("th", null, ["prompt"]),
        el("th", null, ["model"]),
        el("th", null, ["状态"]),
        el("th", null, ["响应 / 错"]),
      ]),
    ]);
    tbl.appendChild(thead);
    const tbody = el("tbody", null, []);
    results.forEach((r, i) => {
      tbody.appendChild(
        el("tr", { class: r.ok ? "ok" : "err" }, [
          el("td", null, [String(i + 1)]),
          el("td", null, [(r.prompt || "").slice(0, 40)]),
          el("td", null, [(r.model || "").slice(0, 20)]),
          el("td", null, [r.ok ? "✓" : "✗"]),
          el("td", null, [((r.ok ? r.content : r.error) || "").slice(0, 100)]),
        ]),
      );
    });
    tbl.appendChild(tbody);
    container.appendChild(tbl);
  }

  async function runBatch() {
    const D = memo.data;
    if (!D.vmUrl) {
      toast("反代 vmUrl 未设 · 去 ⚙ → 端点", "warn");
      openDrawer("endpt");
      return;
    }
    const prompts = (D.batch && D.batch.prompts) || [];
    if (!prompts.length) {
      toast("题集为空", "warn");
      return;
    }
    D.batch.results = [];
    const model = D.lastModel || "claude-sonnet-4-20250514";
    for (let i = 0; i < prompts.length; i++) {
      const p = prompts[i];
      try {
        const r = await fetch(D.vmUrl + "/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(D.vmAuthKey ? { Authorization: "Bearer " + D.vmAuthKey } : {}),
          },
          body: JSON.stringify({
            model: model,
            messages: [{ role: "user", content: p }],
            stream: false,
            max_tokens: 256,
          }),
          signal: AbortSignal.timeout(60000),
        });
        const j = await r.json();
        const content =
          j.choices &&
          j.choices[0] &&
          j.choices[0].message &&
          j.choices[0].message.content;
        D.batch.results.push({
          prompt: p,
          model: model,
          ok: r.ok && !!content,
          content: content || "",
          error: r.ok ? "" : "HTTP " + r.status,
        });
      } catch (e) {
        D.batch.results.push({
          prompt: p,
          model: model,
          ok: false,
          content: "",
          error: e.message || "网络错",
        });
      }
      // 实时重渲 (用户可看进度)
      markDirty();
      const c = $("v101-use-content");
      if (c && __useTab === "batch") renderUseTabContent(c);
    }
    toast(
      "批跑完 · " +
        D.batch.results.filter((r) => r.ok).length +
        "/" +
        prompts.length,
      "ok",
    );
  }

  // ─── 抽屉 · 四节 (切号 / SP / 端点 / 测试) ─────────────────────────────
  function renderDrawer() {
    const drawer = el("div", { class: "v101-drawer", id: "v101-drawer" }, []);
    // tab bar
    const tabs = el("div", { class: "v101-drawer-tabs" }, [
      makeDrawerTab("acct", "切号", "本机 + 云一表 · 一笔切"),
      makeDrawerTab("sp", "提示词", "SP 库 + 三模 + 历史"),
      makeDrawerTab("endpt", "端点", "vmUrl + auth-key + daemon 池"),
      makeDrawerTab("test", "测试", "/health · /v1/models · 烟测"),
      el("span", { class: "grow" }, []),
      el(
        "button",
        {
          class: "v101-btn small ghost",
          title: "关抽屉",
          onclick: () => closeDrawer(),
        },
        ["✕"],
      ),
    ]);
    drawer.appendChild(tabs);
    const content = el(
      "div",
      { class: "v101-drawer-content", id: "v101-drawer-content" },
      [],
    );
    drawer.appendChild(content);
    // 默 collapsed
    if (__drawerOpen) {
      drawer.classList.add("open");
      renderDrawerContent(content, __drawerOpen);
    }
    return drawer;
  }

  function makeDrawerTab(id, label, title) {
    const active = __drawerOpen === id;
    return el(
      "button",
      {
        class: "v101-tab" + (active ? " active" : ""),
        title: title,
        onclick: () => toggleDrawer(id),
      },
      [label],
    );
  }

  function openDrawer(id) {
    __drawerOpen = id;
    const drawer = $("v101-drawer");
    const content = $("v101-drawer-content");
    if (drawer) drawer.classList.add("open");
    if (content) renderDrawerContent(content, id);
    // 重渲抽屉 tab bar 以更新 active
    refreshDrawerTabs();
    // ─── 印 ∞.1 (2026-05-17 道动测后修): v128 模式兜底 ───
    //   帛书·廿二「圣人执一·以为天下牧」— 一函数透 v128 三栏 + v101 抽屉
    //   v128 无 v101-drawer 元素 (三栏永显·无需抽屉) · openDrawer 此前空转
    //   故 onclick → markDirty + openDrawer(...) 之 state 改后 UI 不刷
    //   修: v128 模式下重渲对应栏 (acct/sp → 左+中 · endpt → 左 · test → 右)
    if (!drawer) {
      const mineV128 = $("mine-v128");
      if (mineV128 && mineV128.style.display !== "none") {
        // 全栏重渲 (简 · 因 state 改可能跨栏 · markDirty 已记 · 重渲不致重发请求)
        if (typeof renderMineV128 === "function") renderMineV128();
      }
    }
  }

  function closeDrawer() {
    __drawerOpen = null;
    const drawer = $("v101-drawer");
    if (drawer) drawer.classList.remove("open");
    refreshDrawerTabs();
  }

  function toggleDrawer(id) {
    if (__drawerOpen === id) closeDrawer();
    else openDrawer(id);
  }

  function refreshDrawerTabs() {
    const tabs = document.querySelector(".v101-drawer-tabs");
    if (!tabs) return;
    tabs.innerHTML = "";
    tabs.appendChild(makeDrawerTab("acct", "切号", "本机 + 云一表 · 一笔切"));
    tabs.appendChild(makeDrawerTab("sp", "提示词", "SP 库 + 三模 + 历史"));
    tabs.appendChild(
      makeDrawerTab("endpt", "端点", "vmUrl + auth-key + daemon 池"),
    );
    tabs.appendChild(
      makeDrawerTab("test", "测试", "/health · /v1/models · 烟测"),
    );
    tabs.appendChild(el("span", { class: "grow" }, []));
    tabs.appendChild(
      el(
        "button",
        {
          class: "v101-btn small ghost",
          title: "关抽屉",
          onclick: () => closeDrawer(),
        },
        ["✕"],
      ),
    );
  }

  function renderDrawerContent(container, id) {
    container.innerHTML = "";
    if (id === "acct") renderDrawer_acct(container);
    else if (id === "sp") renderDrawer_sp(container);
    else if (id === "endpt") renderDrawer_endpt(container);
    else if (id === "test") renderDrawer_test(container);
  }

  // 抽屉 · 切号节 (本机 + 云端 daemon 池 统一)
  function renderDrawer_acct(container) {
    const D = memo.data;
    const accts = D.accounts || [];

    // ① 加号 (手输 apiKey · 旧路)
    container.appendChild(
      el("div", { class: "v101-drawer-section" }, [
        el("div", { class: "v101-drawer-section-title" }, [
          "+ 加 Windsurf 账号 (手输 apiKey)",
        ]),
        el("div", { class: "row gap" }, [
          el("input", {
            type: "text",
            id: "in-acct-email",
            class: "inp",
            placeholder: "email (备注)",
            style: { flex: "1" },
          }),
        ]),
        el("div", { class: "row gap", style: { marginTop: "4px" } }, [
          el("input", {
            type: "password",
            id: "in-acct-key",
            class: "inp",
            placeholder: "API key (windsurf ws-* / codeium-*)",
            style: { flex: "1" },
          }),
          el(
            "button",
            {
              class: "btn",
              onclick: () => {
                addAccount();
                openDrawer("acct");
              },
            },
            ["+ 加"],
          ),
        ]),
      ]),
    );

    // ①' 印 129 · 真本源切号 · 自动登 (主公诏「此登录为核心切号本源」)
    //   email + password → vmUrl/admin/signin/windsurf (VM 代登 3-step) → 自动入号库
    //   不需手输 apiKey · VM 代登后真本源 ws-* key 直接出
    container.appendChild(
      el("div", { class: "v101-drawer-section" }, [
        el("div", { class: "v101-drawer-section-title" }, [
          "🔑 自动登 Windsurf (印 129 · 真本源)",
        ]),
        el(
          "div",
          {
            class: "hint",
            style: {
              fontSize: "10px",
              marginBottom: "4px",
              color: "var(--dim)",
            },
          },
          ["VM 代登 windsurf.com 3-step · 密码不外泄 · 走 self-host trust"],
        ),
        el("div", { class: "row gap" }, [
          el("input", {
            type: "text",
            id: "in-signin-email",
            class: "inp",
            placeholder: "email",
            style: { flex: "1" },
          }),
        ]),
        el("div", { class: "row gap", style: { marginTop: "4px" } }, [
          el("input", {
            type: "password",
            id: "in-signin-pw",
            class: "inp",
            placeholder: "password (传 VM · 不存盘)",
            style: { flex: "1" },
          }),
          el(
            "button",
            {
              class: "btn",
              style: { background: "#d4a850", color: "#0a0a0f" },
              onclick: () => autoSigninWindsurf(),
            },
            ["🔑 自动登"],
          ),
        ]),
        el(
          "div",
          {
            id: "signin-status",
            class: "hint",
            style: { fontSize: "11px", marginTop: "4px" },
          },
          [],
        ),
      ]),
    );

    // ② 号库
    const listSec = el("div", { class: "v101-drawer-section" }, [
      el("div", { class: "v101-drawer-section-title" }, [
        "号库 ",
        el("span", { class: "meta" }, [accts.length + " 条"]),
        el("span", { class: "grow" }, []),
        el("button", { class: "btn tiny ghost", onclick: () => probeAll() }, [
          "↻ 全探",
        ]),
      ]),
    ]);
    if (accts.length === 0) {
      listSec.appendChild(el("div", { class: "hint" }, ["(无号 · 上方加)"]));
    } else {
      const tbl = el("table", { class: "v101-acct-table" }, []);
      tbl.appendChild(
        el("thead", null, [
          el("tr", null, [
            el("th", null, ["active"]),
            el("th", null, ["email"]),
            el("th", null, ["key prefix"]),
            el("th", null, ["状态"]),
            el("th", null, [""]),
          ]),
        ]),
      );
      const tbody = el("tbody", null, []);
      accts.forEach((a, i) => {
        const isActive = a.email === D.activeEmail;
        tbody.appendChild(
          el("tr", { class: isActive ? "active" : "" }, [
            el("td", null, [
              el(
                "input",
                {
                  type: "radio",
                  name: "v101-active-acct",
                  checked: isActive,
                  onchange: () => {
                    D.activeEmail = a.email;
                    markDirty();
                    // 印 ∞ · WAM 无感切号 · 软推 VM (失静)
                    syncActiveToVm(a.email, a.key).catch(() => {});
                    openDrawer("acct");
                  },
                },
                [],
              ),
            ]),
            el("td", null, [a.email || "?"]),
            el("td", null, [(a.key || "").slice(0, 12) + "…"]),
            el("td", null, [
              a.lastProbe ? (a.lastProbe.ok ? "✓ " : "✗ ") : "○",
              a.lastProbe ? a.lastProbe.note || "" : "",
            ]),
            el("td", null, [
              el(
                "button",
                {
                  class: "btn tiny ghost",
                  onclick: () => probeAccount(i).then(() => openDrawer("acct")),
                },
                ["↻"],
              ),
              el(
                "button",
                {
                  class: "btn tiny danger",
                  onclick: () => {
                    if (!confirm("删 " + a.email + " ?")) return;
                    accts.splice(i, 1);
                    if (D.activeEmail === a.email) D.activeEmail = "";
                    markDirty();
                    openDrawer("acct");
                  },
                },
                ["×"],
              ),
            ]),
          ]),
        );
      });
      tbl.appendChild(tbody);
      listSec.appendChild(tbl);
    }
    container.appendChild(listSec);

    // ③ 云端 daemon 池 (印 95/100 · 入此节统一)
    container.appendChild(
      el("div", { class: "v101-drawer-section" }, [
        el("div", { class: "v101-drawer-section-title" }, [
          "☁ 云端 daemon 池 (印 95/100)",
          el("span", { class: "grow" }, []),
          el(
            "button",
            { class: "btn tiny ghost", onclick: () => probeCloudFleet() },
            ["↻ 拉"],
          ),
          el(
            "button",
            {
              class: "btn tiny",
              onclick: () => triggerCloudFleet(),
              title: "触一个新 workflow run · 起新 daemon",
            },
            ["▶ 触新"],
          ),
        ]),
        el("div", { id: "v101-cloud-daemons", class: "hint" }, [
          "(↻ 拉之 · 看活 daemon)",
        ]),
      ]),
    );
  }

  // 抽屉 · SP 节 (提示词综合管理 · 印 101 立 · 印 123 升 7 态对齐 dao_proxy)
  function renderDrawer_sp(container) {
    const D = memo.data;
    if (!D.sp) D.sp = { mode: "dao", custom: "" };
    if (!D.spLibrary) D.spLibrary = [];

    // 印 123 · 七态切 (passthrough 兼老 alias bypass · syncSpModeToVm 之时翻字)
    const SP_MODES = [
      ["passthrough", "原透"],
      ["dao", "★ 道"],
      ["usernote", "★ usernote"],
      ["prepend", "前"],
      ["append", "后"],
      ["override", "盖"],
      ["custom", "自定"],
    ];
    const modeBtnGrp = el(
      "div",
      { class: "sp-mode-grp" },
      SP_MODES.map(([m, label]) =>
        el(
          "button",
          {
            class: "sp-mode-btn" + (D.sp.mode === m ? " active" : ""),
            onclick: () => {
              D.sp.mode = m;
              markDirty();
              syncSpModeToVm(m).catch(() => {});
              openDrawer("sp");
            },
          },
          [label],
        ),
      ),
    );
    const SP_HINTS = {
      passthrough: "原透: 不注 SP · 让客户端自带 (= bypass · 默)",
      dao: "道: 注入帛书《老子》全文 (5000+ 字 · 双源 silk 真合)",
      usernote: "usernote: §3.17 合法槽 (note name=dao-priority author=user)",
      prepend: "前: 道+原 · 帛书在前 · 原 SP 在后",
      append: "后: 原+道 · 原 SP 在前 · 帛书在后",
      override: "盖: ∗thinking-loop · 强抗 persona (慎用)",
      custom: "自定: 注入下方 textarea 之 SP",
    };
    container.appendChild(
      el("div", { class: "v101-drawer-section" }, [
        el("div", { class: "v101-drawer-section-title" }, [
          "SP 七态 (当前: " + D.sp.mode + ")",
        ]),
        modeBtnGrp,
        el("div", { class: "hint" }, [
          SP_HINTS[D.sp.mode] || "未知 mode (清二治为 7 态 · 老值兼)",
        ]),
      ]),
    );

    // custom 编辑
    if (D.sp.mode === "custom") {
      container.appendChild(
        el("div", { class: "v101-drawer-section" }, [
          el("div", { class: "v101-drawer-section-title" }, ["自定义 SP"]),
          el("textarea", {
            class: "inp",
            id: "v101-sp-custom",
            rows: "8",
            placeholder: "你的 system prompt...",
            value: D.sp.custom || "",
            oninput: (e) => {
              D.sp.custom = e.target.value;
              markDirty();
            },
          }),
          el("div", { class: "row gap", style: { marginTop: "4px" } }, [
            el(
              "button",
              {
                class: "btn small",
                onclick: () =>
                  syncSpCustomToVm(D.sp.custom).then(() =>
                    toast("已同步到 VM", "ok"),
                  ),
              },
              ["同步到 VM"],
            ),
            el(
              "button",
              {
                class: "btn small ghost",
                onclick: () => {
                  const name = prompt("存为模板 · 取名:");
                  if (!name) return;
                  D.spLibrary.push({
                    name: name,
                    content: D.sp.custom,
                    savedAt: new Date().toISOString(),
                  });
                  markDirty();
                  openDrawer("sp");
                },
              },
              ["+ 存为模板"],
            ),
          ]),
        ]),
      );
    }

    // SP 库 (用户自存模板 · 印 101 新)
    const libSec = el("div", { class: "v101-drawer-section" }, [
      el("div", { class: "v101-drawer-section-title" }, [
        "SP 库 ",
        el("span", { class: "meta" }, [(D.spLibrary || []).length + " 模板"]),
      ]),
    ]);
    if (!D.spLibrary || D.spLibrary.length === 0) {
      libSec.appendChild(
        el("div", { class: "hint" }, [
          "(库空 · 切到 自定义 模式 · 编辑后点 + 存为模板)",
        ]),
      );
    } else {
      D.spLibrary.forEach((sp, i) => {
        libSec.appendChild(
          el("div", { class: "v101-sp-row" }, [
            el("div", { class: "v101-sp-name" }, [sp.name]),
            el("div", { class: "v101-sp-preview" }, [
              (sp.content || "").slice(0, 80) + "…",
            ]),
            el("div", { class: "row gap" }, [
              el(
                "button",
                {
                  class: "btn tiny",
                  onclick: () => {
                    D.sp.mode = "custom";
                    D.sp.custom = sp.content;
                    markDirty();
                    syncSpCustomToVm(sp.content).catch(() => {});
                    openDrawer("sp");
                    toast("已套用 " + sp.name, "ok");
                  },
                },
                ["套用"],
              ),
              el(
                "button",
                {
                  class: "btn tiny danger",
                  onclick: () => {
                    if (!confirm("删模板 " + sp.name + " ?")) return;
                    D.spLibrary.splice(i, 1);
                    markDirty();
                    openDrawer("sp");
                  },
                },
                ["×"],
              ),
            ]),
          ]),
        );
      });
    }
    container.appendChild(libSec);
  }

  // 抽屉 · 端点节 (vmUrl + auth + daemon 池)
  // 印 ∞ · 顶加 A/B 双路状态卡 · 主公诏「接收 devin cloud vm 反代出的 windsurf api 和 devin cloud」
  function renderDrawer_endpt(container) {
    const D = memo.data;

    // ─── 印 ∞ · A/B 双路状态卡 (Devin VM 反代之两路) ───────────────
    //   帛书·四十二: 道生一 · 一生二 · 二生三 · 三生万物 — A路+B路即"二"
    //   A 路: /v1/* (Windsurf codeium · OpenAI 兼)
    //   B 路: /dc/v1/* (Devin Cloud · wss 桥)
    const routeCard = el("div", { class: "v128-route-card" }, [
      el("div", { class: "v128-route-card-title" }, [
        "★ 反代双路 (印 ∞)",
        el("span", { class: "grow" }, []),
        el(
          "button",
          {
            class: "btn tiny ghost",
            title: "测双路 · /v1/models + /dc/v1/models",
            onclick: () => probeABRoutes(),
          },
          ["↻ 测"],
        ),
      ]),
      el("div", { class: "v128-route-row", id: "v128-route-a" }, [
        el("span", { class: "v128-route-tag a" }, ["A"]),
        el("span", { class: "v128-route-path" }, ["/v1/* · Windsurf codeium"]),
        el(
          "span",
          { class: "v128-route-state idle", id: "v128-route-a-state" },
          ["○ 未测"],
        ),
      ]),
      el("div", { class: "v128-route-row", id: "v128-route-b" }, [
        el("span", { class: "v128-route-tag b" }, ["B"]),
        el("span", { class: "v128-route-path" }, ["/dc/v1/* · Devin Cloud"]),
        el(
          "span",
          { class: "v128-route-state idle", id: "v128-route-b-state" },
          ["○ 未测"],
        ),
      ]),
    ]);
    container.appendChild(routeCard);

    container.appendChild(
      el("div", { class: "v101-drawer-section" }, [
        el("div", { class: "v101-drawer-section-title" }, ["反代 VM 端点"]),
        el("label", null, ["VM URL (cloudflared tunnel)"]),
        el("input", {
          type: "text",
          id: "in-vm-url",
          class: "inp",
          placeholder: "https://xxxx.trycloudflare.com",
          value: D.vmUrl || "",
          oninput: (e) => {
            D.vmUrl = e.target.value.trim();
            markDirty();
          },
        }),
        el("label", null, ["Auth Key (sk-ws-proxy-*)"]),
        el("div", { class: "row gap" }, [
          el("input", {
            type: "password",
            id: "in-vm-authkey",
            class: "inp",
            placeholder: "sk-ws-proxy-...",
            value: D.vmAuthKey || "",
            style: { flex: "1" },
            oninput: (e) => {
              D.vmAuthKey = e.target.value.trim();
              markDirty();
            },
          }),
          el(
            "button",
            {
              class: "btn tiny",
              onclick: () => {
                const k =
                  "sk-ws-proxy-" +
                  Array.from(crypto.getRandomValues(new Uint8Array(24)))
                    .map((b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36])
                    .join("");
                D.vmAuthKey = k;
                markDirty();
                openDrawer("endpt");
              },
            },
            ["生"],
          ),
        ]),
        el("div", { class: "row gap", style: { marginTop: "8px" } }, [
          el("button", { class: "btn", onclick: () => testVm() }, ["测连"]),
          el(
            "button",
            {
              class: "btn ghost",
              onclick: () => {
                if (!D.vmUrl) {
                  toast("先设 VM URL", "warn");
                  return;
                }
                navigator.clipboard.writeText(D.vmUrl + "/v1");
                toast("Base URL 已复制", "ok");
              },
            },
            ["复 Base URL"],
          ),
        ]),
        // 印 115 · 反者道之动 · 触 Devin VM 反代 fleet workflow (鸡犬相闻)
        el("div", { class: "row gap", style: { marginTop: "8px" } }, [
          el(
            "button",
            {
              class: "btn ghost small",
              onclick: () => triggerDevinFleet_yin115(2),
            },
            ["★ 起 N=2 Devin VM (印 115)"],
          ),
          el(
            "button",
            {
              class: "btn ghost small",
              onclick: () => {
                if (typeof autoFindCloudPoolGist === "function")
                  autoFindCloudPoolGist();
              },
            },
            ["刷池"],
          ),
        ]),
      ]),
    );
  }

  // 抽屉 · 测试节
  function renderDrawer_test(container) {
    const D = memo.data;
    container.appendChild(
      el("div", { class: "v101-drawer-section" }, [
        el("div", { class: "v101-drawer-section-title" }, ["反代端点烟测"]),
        el("div", { class: "hint" }, [
          "走当前 vmUrl 探: /health · /v1/models · 一笔 chat 烟测",
        ]),
        el("div", { class: "row gap", style: { marginTop: "8px" } }, [
          el(
            "button",
            {
              class: "btn",
              onclick: async () => {
                if (!D.vmUrl) {
                  toast("vmUrl 未设", "warn");
                  return;
                }
                const out = $("v101-test-out");
                if (out) out.textContent = "测中...";
                const results = [];
                // /health
                try {
                  const r = await fetch(D.vmUrl + "/health", {
                    signal: AbortSignal.timeout(5000),
                  });
                  results.push(
                    "/health: " + r.status + " " + (r.ok ? "✓" : "✗"),
                  );
                } catch (e) {
                  results.push("/health: ✗ " + e.message);
                }
                // /v1/models
                try {
                  const r = await fetch(D.vmUrl + "/v1/models", {
                    headers: D.vmAuthKey
                      ? { Authorization: "Bearer " + D.vmAuthKey }
                      : {},
                    signal: AbortSignal.timeout(5000),
                  });
                  const j = await r.json().catch(() => ({}));
                  const count = (j.data && j.data.length) || 0;
                  results.push(
                    "/v1/models: " +
                      r.status +
                      " " +
                      (r.ok ? "✓ " + count + " 模" : "✗"),
                  );
                } catch (e) {
                  results.push("/v1/models: ✗ " + e.message);
                }
                if (out) out.textContent = results.join("\n");
              },
            },
            ["▶ 测"],
          ),
        ]),
        el("pre", { id: "v101-test-out", class: "v101-test-out" }, ["(未测)"]),
      ]),
    );
    container.appendChild(
      el("div", { class: "v101-drawer-section" }, [
        el("div", { class: "v101-drawer-section-title" }, [
          "agent 批跑 (用区 → 批跑测 tab)",
        ]),
        el("div", { class: "hint" }, [
          "完整批跑 · 题集 · A/B 路对比 · 通过率: 切到顶 [批跑测] tab",
        ]),
        el(
          "button",
          {
            class: "btn small",
            onclick: () => {
              __useTab = "batch";
              closeDrawer();
              renderMineV101();
            },
          },
          ["→ 去批跑测 tab"],
        ),
      ]),
    );
  }

  // ═══ 顶栏 (常驻) · 退出 / 同步状态 ════════════════════════════════════
  function bindHeaderActions() {
    const logout = $("hdr-logout");
    if (logout && !logout.__bound) {
      logout.__bound = true;
      logout.addEventListener("click", () => {
        if (
          !confirm(
            "清 PAT + 本地缓存 ?\n(Gist 数据仍在你的 GitHub · 重登可恢复)",
          )
        )
          return;
        daoSync.clearPat();
        window.location.reload();
      });
    }
    const lk = $("hdr-link-upstream");
    if (lk)
      lk.href =
        "https://github.com/" +
        daoSync.UPSTREAM_OWNER +
        "/" +
        daoSync.UPSTREAM_REPO;
  }

  // ═══ 主入口 ════════════════════════════════════════════════════════
  document.addEventListener("DOMContentLoaded", () => {
    bindHeaderActions();
    boot().catch((e) => {
      console.error(e);
      toast("启动失败: " + e.message, "err");
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 印 ∞ · A/B 双路探活 (帛书·二: 物无非彼 物无非是 · 两路两面同一道)
  // ═══════════════════════════════════════════════════════════════════
  //   A 路: GET vmUrl + /v1/models  (Windsurf codeium)
  //   B 路: GET vmUrl + /dc/v1/models (Devin Cloud · 失败兜底返 dc/health)
  //   状态: ○ 未测 · ↻ 测中 · ✓ N 模 · ✗ 失/HTTP
  //   不挡 chat · 仅显: 主公诏「无感使用」· 弱者道之用
  async function probeABRoutes() {
    const D = memo.data;
    if (!D.vmUrl) {
      toast("先设 VM URL", "warn");
      return;
    }
    const setState = (which, txt, cls) => {
      const e = $("v128-route-" + which + "-state");
      if (e) {
        e.textContent = txt;
        e.className = "v128-route-state " + cls;
      }
    };
    setState("a", "↻ 测中", "idle");
    setState("b", "↻ 测中", "idle");
    const hdrs = D.vmAuthKey ? { Authorization: "Bearer " + D.vmAuthKey } : {};
    // A 路 · /v1/models
    try {
      const r = await fetch(D.vmUrl + "/v1/models", {
        headers: hdrs,
        signal: AbortSignal.timeout(5000),
      });
      if (r.ok) {
        const j = await r.json().catch(() => ({}));
        const n = (j.data && j.data.length) || 0;
        setState("a", "✓ " + n + " 模", "ok");
      } else {
        setState("a", "✗ HTTP " + r.status, "err");
      }
    } catch (e) {
      setState("a", "✗ " + (e.name === "AbortError" ? "timeout" : "断"), "err");
    }
    // B 路 · /dc/v1/models · 兜底 /dc/health
    try {
      let r = await fetch(D.vmUrl + "/dc/v1/models", {
        headers: hdrs,
        signal: AbortSignal.timeout(5000),
      });
      if (r.ok) {
        const j = await r.json().catch(() => ({}));
        const n = (j.data && j.data.length) || 0;
        setState("b", "✓ " + n + " 模", "ok");
      } else if (r.status === 404 || r.status === 401) {
        const rh = await fetch(D.vmUrl + "/dc/health", {
          signal: AbortSignal.timeout(3000),
        }).catch(() => null);
        if (rh && rh.ok) setState("b", "✓ 活 (无 /v1/models)", "ok");
        else setState("b", "✗ HTTP " + r.status, "err");
      } else {
        setState("b", "✗ HTTP " + r.status, "err");
      }
    } catch (e) {
      setState("b", "✗ " + (e.name === "AbortError" ? "timeout" : "断"), "err");
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // 印 ∞ · WAM 无感切号 (切 active radio 即推 VM · 软推 · 失静)
  // ═══════════════════════════════════════════════════════════════════
  //   主公诏: 「复用 wam 无感切号之一切 · 管理 windsurf 之账号」
  //   推送目标: POST vmUrl + /admin/accounts/active {email, key}
  //   兜底:     POST vmUrl + /admin/active {email, key}
  //   失败不挡 · silent · 因 VM /admin/active 可能未启
  async function syncActiveToVm(email, key) {
    const D = memo.data;
    if (!D.vmUrl) return;
    const body = JSON.stringify({ email: email, key: key });
    const hdrs = {
      "Content-Type": "application/json",
      ...(D.vmAuthKey ? { Authorization: "Bearer " + D.vmAuthKey } : {}),
    };
    const tryPost = async (path) => {
      try {
        const r = await fetch(D.vmUrl + path, {
          method: "POST",
          headers: hdrs,
          body: body,
          signal: AbortSignal.timeout(3000),
        });
        return r.ok;
      } catch {
        return false;
      }
    };
    let ok = await tryPost("/admin/accounts/active");
    if (!ok) ok = await tryPost("/admin/active");
    if (ok) toast("✓ active 已推 VM · " + (email || ""), "ok");
  }

  // ═══ 印 115 · 反者道之动 · GH Actions workflow 触发 (帛书 80 鸡犬相闻) ═══
  async function triggerDevinFleet_yin115(n) {
    n = n || 2;
    const pat =
      typeof daoSync !== "undefined" && daoSync.getPat
        ? daoSync.getPat()
        : localStorage.getItem("dao_pat");
    if (!pat) {
      toast("无 PAT · 请先登入", "warn");
      return;
    }
    const owner =
      (typeof daoSync !== "undefined" && daoSync.user && daoSync.user.login) ||
      "";
    if (!owner) {
      toast("未识 owner · 重登", "warn");
      return;
    }
    const repo = "windsurf-assistant";
    try {
      const r = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/actions/workflows/dao-fleet-devin-cloud.yml/dispatches`,
        {
          method: "POST",
          headers: {
            Authorization: `token ${pat}`,
            Accept: "application/vnd.github+json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ref: "main", inputs: { n: String(n) } }),
        },
      );
      if (r.status === 204) {
        toast(`★ 印 115 workflow 触发 · 起 ${n} Devin VM · ~120s`, "ok");
        setTimeout(() => {
          if (typeof autoFindCloudPoolGist === "function")
            autoFindCloudPoolGist();
        }, 90000);
      } else {
        const t = await r.text();
        toast(`触发失: ${t.slice(0, 100)}`, "err");
      }
    } catch (e) {
      toast(`错: ${e.message}`, "err");
    }
  }
})();
