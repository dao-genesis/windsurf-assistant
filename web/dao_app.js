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
  function show(id) {
    const e = $(id);
    if (e) e.style.display = "";
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
      if (e.status === 401) {
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
  function renderGate() {
    show("state-gate");
    hide("state-onboarding");
    hide("state-mine");
    setText("hdr-login", "(未登入)");
    setText("hdr-gist", "");

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
    if (lnk) {
      lnk.href = "legacy.html";
    }
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
  function renderOffline() {
    hide("state-gate");
    hide("state-onboarding");
    const cached = daoSync.getCache();
    const st = daoSync.getState();
    if (cached && st.gistId) {
      memo.data = cached;
      memo.gistId = st.gistId;
      setText("hdr-gist", "⚠ 离线 (cache)");
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

    renderLeft();
    renderMid();
    renderRight();
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

    // C · 反代提示词管理 (印 52 守一不离)
    const sp = D.sp;
    root.appendChild(
      el("div", { class: "pane" }, [
        el("div", { class: "pane-hd" }, [
          "反代提示词 · SP 三模 ",
          el("span", { class: "meta" }, [sp.mode]),
        ]),
        el("div", { class: "pane-bd" }, [
          el(
            "div",
            { class: "sp-mode-grp" },
            [
              ["passthrough", "透 · 不动 system"],
              ["dao", "道 · 帛书《老子》替"],
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
                    (daoSync.UPSTREAM_OWNER || "zhouyoukang") +
                    "/" +
                    (daoSync.UPSTREAM_REPO || "windsurf-assistant") +
                    "\n" +
                    "cd " +
                    (daoSync.UPSTREAM_REPO || "windsurf-assistant") +
                    "/packages/dao-pool\n" +
                    "node cli.js init --pat $(gh auth token)\n\n" +
                    "# 设 repo secrets (init 输出 gist id)\n" +
                    "gh secret set DAO_POOL_GIST_ID --body '<id>' -R " +
                    (daoSync.UPSTREAM_OWNER || "zhouyoukang") +
                    "/" +
                    (daoSync.UPSTREAM_REPO || "windsurf-assistant") +
                    "\n" +
                    "gh secret set DAO_POOL_PAT --body $(gh auth token) -R " +
                    (daoSync.UPSTREAM_OWNER || "zhouyoukang") +
                    "/" +
                    (daoSync.UPSTREAM_REPO || "windsurf-assistant") +
                    "\n" +
                    "gh secret set DAO_AUTH_KEY --body 'sk-ws-proxy-<rand>' -R " +
                    (daoSync.UPSTREAM_OWNER || "zhouyoukang") +
                    "/" +
                    (daoSync.UPSTREAM_REPO || "windsurf-assistant") +
                    "\n\n" +
                    "# 触新 run (或 cron 自起每 5h)\n" +
                    "gh workflow run dao-fleet-cloud.yml -R " +
                    (daoSync.UPSTREAM_OWNER || "zhouyoukang") +
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
  async function syncSpModeToVm(mode) {
    const D = memo.data;
    if (!D.vmUrl || !D.vmAuthKey) return; // 默静 · 未填则不推
    try {
      const r = await fetch(D.vmUrl + "/sp/mode", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + D.vmAuthKey,
        },
        body: JSON.stringify({ mode }),
      });
      if (r.ok) {
        const j = await r.json();
        toast(
          "SP · mode=" + (j.mode || mode) + " · silk=" + (j.silkChars || "-"),
          "ok",
        );
      }
    } catch (e) {
      // 静默 · VM 未启不报警
    }
  }

  // 印 88 · SP custom 推 VM /sp/custom
  async function syncSpCustomToVm(custom) {
    const D = memo.data;
    if (!D.vmUrl || !D.vmAuthKey) return;
    try {
      await fetch(D.vmUrl + "/sp/custom", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + D.vmAuthKey,
        },
        body: JSON.stringify({ custom }),
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
            "email + key 落用户私有 Gist · zhouyoukang 不见 · 各账号自属自己 Devin VM",
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
})();
