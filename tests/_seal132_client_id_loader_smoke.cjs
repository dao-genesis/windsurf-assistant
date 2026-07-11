#!/usr/bin/env node
// _seal132_client_id_loader_smoke.cjs · 印 132 · client_id 智能加载链 · 守门
//
// 主公诏 (2026-05-17):
//   「我无为 · 你无不为 · 唯变所适」
//   「天下莫柔弱于水 · 而攻坚强者莫之能胜也 · 以其无以易之也
//    弱之胜强 · 柔之胜刚 · 天下莫不知 · 莫能行也」
//
// 帛书·七十八「弱者道之用」: 不强求主公必改代码 · 4 源链 · 任一处填即活
// 帛书·廿二「圣人执一」    : 终归一 CLIENT_ID · 高优先返之
// 帛书·四十「反者道之动」  : "加" 4 源是 "损" PAT 取 5 步之繁
//
// 4 源加载链 (高优先 → 低):
//   ① URL ?dao_oauth_client_id=Ov23li...    (一次性 · 分享调试)
//   ② localStorage 'dao_oauth_client_id'     (持久 · 一次为·万次用)
//   ③ window.__DAO_OAUTH_CLIENT_ID__        (代码硬编 · index.html <head>)
//   ④ DEFAULT_CLIENT_ID                     (placeholder)
//
// 守门策略:
//   静守 ─ 检 dao_oauth.js 含 4 源加载逻辑 + 4 公开 API +
//          index.html 含 admin UI · dao_app.js 含 bindOauthConfig
//   动守 ─ vm.runInContext 加载 dao_oauth.js (浏览器 shim) · 真测:
//          ① URL > localStorage > window > DEFAULT 优先级链
//          ② setClientId 入 localStorage + 立活 isConfigured() = true
//          ③ setClientId 拒短 / 拒 PLACEHLDR
//          ④ clearClientId 后回退
//          ⑤ whichSource() 返正 4 值
"use strict";

const path = require("path");
const fs = require("fs");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const DAO_OAUTH = path.join(ROOT, "web", "dao_oauth.js");
const DAO_APP = path.join(ROOT, "web", "dao_app.js");
const INDEX_HTML = path.join(ROOT, "web", "index.html");

let pass = 0,
  fail = 0;
const fails = [];
function ok(n) {
  console.log("  \x1b[32m\u2713\x1b[0m " + n);
  pass++;
}
function ng(n, w) {
  console.log("  \x1b[31m\u2717\x1b[0m " + n + " \u00b7 " + w);
  fail++;
  fails.push(n + ": " + w);
}

console.log("\u2550".repeat(60));
console.log(" \u5370 132 \u00b7 client_id \u667a\u80fd\u52a0\u8f7d\u94fe \u00b7 \u5f31\u8005\u9053\u4e4b\u7528");
console.log("\u2550".repeat(60));

// ════════════════════════════════════════════════════════════════════
// § 一 · 静守
// ════════════════════════════════════════════════════════════════════
function staticGuard() {
  console.log("\n\u2550\u2550\u2550 \u4e00 \u00b7 \u9759\u5b88 \u00b7 \u4ef6\u8bfb \u2550\u2550\u2550");

  const oauthSrc = fs.readFileSync(DAO_OAUTH, "utf8");
  const appSrc = fs.readFileSync(DAO_APP, "utf8");
  const htmlSrc = fs.readFileSync(INDEX_HTML, "utf8");

  // ─── dao_oauth.js · 4 源加载逻辑 + API ───
  const oauthChecks = [
    ["dao_oauth.js \u542b \u5370 132 \u6ce8", /\u5370\s*132/.test(oauthSrc)],
    ["dao_oauth.js \u5f15\u5e1b\u4e66 \u00b7 \u4e03\u5341\u516b (\u67d4\u5f31\u80dc\u521a)", /\u4e03\u5341\u516b|\u5f31\u4e4b\u80dc\u5f3a/.test(oauthSrc)],
    [
      "dao_oauth.js \u542b LS_KEY = 'dao_oauth_client_id'",
      /LS_KEY\s*=\s*["']dao_oauth_client_id["']/.test(oauthSrc),
    ],
    [
      "dao_oauth.js \u542b URL_PARAM = 'dao_oauth_client_id'",
      /URL_PARAM\s*=\s*["']dao_oauth_client_id["']/.test(oauthSrc),
    ],
    [
      "dao_oauth.js \u542b _readUrlParam (\u6e90\u4e00 \u00b7 URL)",
      /function\s+_readUrlParam/.test(oauthSrc),
    ],
    [
      "dao_oauth.js \u542b _readLocalStorage (\u6e90\u4e8c \u00b7 \u6301\u4e45)",
      /function\s+_readLocalStorage/.test(oauthSrc),
    ],
    [
      "dao_oauth.js \u542b _readWindowGlobal (\u6e90\u4e09 \u00b7 \u786c\u7f16)",
      /function\s+_readWindowGlobal/.test(oauthSrc),
    ],
    [
      "dao_oauth.js \u542b _resolveClientId (\u7efc\u5408 4 \u6e90)",
      /function\s+_resolveClientId/.test(oauthSrc),
    ],
    [
      "dao_oauth.js _resolveClientId \u6309 URL > LS > Window > DEFAULT \u4f18\u5148",
      /_readUrlParam[\s\S]{0,80}_readLocalStorage[\s\S]{0,80}_readWindowGlobal[\s\S]{0,80}DEFAULT_CLIENT_ID/.test(
        oauthSrc,
      ),
    ],
    [
      "dao_oauth.js \u542b function getClientId",
      /function\s+getClientId/.test(oauthSrc),
    ],
    [
      "dao_oauth.js \u542b function setClientId",
      /function\s+setClientId/.test(oauthSrc),
    ],
    [
      "dao_oauth.js \u542b function clearClientId",
      /function\s+clearClientId/.test(oauthSrc),
    ],
    [
      "dao_oauth.js \u542b function whichSource",
      /function\s+whichSource/.test(oauthSrc),
    ],
    [
      "dao_oauth.js setClientId \u62d2\u77ed (>= 8)",
      /\.length\s*<\s*8|length\s*<\s*8/.test(oauthSrc),
    ],
    [
      "dao_oauth.js setClientId \u62d2 PLACEHLDR",
      /PLACEHLDR[\s\S]{0,200}reject|reject[\s\S]{0,200}PLACEHLDR|throw[\s\S]{0,200}PLACEHLDR/i.test(
        oauthSrc,
      ),
    ],
    [
      "dao_oauth.js setClientId \u5165 localStorage",
      /localStorage\.setItem\s*\(\s*LS_KEY/.test(oauthSrc),
    ],
    [
      "dao_oauth.js clearClientId \u51fa localStorage",
      /localStorage\.removeItem\s*\(\s*LS_KEY/.test(oauthSrc),
    ],
    [
      "dao_oauth.js whichSource \u8fd4 4 \u503c (url_param/localStorage/window_global/default_placeholder)",
      /url_param[\s\S]{0,200}localStorage[\s\S]{0,200}window_global[\s\S]{0,200}default_placeholder/.test(
        oauthSrc,
      ),
    ],
    [
      "dao_oauth.js export getClientId/setClientId/clearClientId/whichSource",
      /getClientId\s*:\s*getClientId/.test(oauthSrc) &&
        /setClientId\s*:\s*setClientId/.test(oauthSrc) &&
        /clearClientId\s*:\s*clearClientId/.test(oauthSrc) &&
        /whichSource\s*:\s*whichSource/.test(oauthSrc),
    ],
  ];
  for (const [n, ok_] of oauthChecks) {
    if (ok_) ok(n);
    else ng(n, "\u7f3a\u5173\u952e\u7801");
  }

  // ─── dao_app.js · admin UI 绑定 ───
  const appChecks = [
    [
      "dao_app.js \u542b function bindOauthConfig",
      /function\s+bindOauthConfig/.test(appSrc),
    ],
    [
      "dao_app.js renderGate \u8c03 bindOauthConfig",
      /bindOauthConfig\s*\(\s*\)/.test(appSrc),
    ],
    [
      "dao_app.js \u542b gate-oauth-config-input \u5f15",
      /gate-oauth-config-input/.test(appSrc),
    ],
    [
      "dao_app.js \u542b gate-oauth-config-save \u5f15",
      /gate-oauth-config-save/.test(appSrc),
    ],
    [
      "dao_app.js \u542b gate-oauth-config-clear \u5f15",
      /gate-oauth-config-clear/.test(appSrc),
    ],
    [
      "dao_app.js \u542b gate-oauth-config-source \u5f15",
      /gate-oauth-config-source/.test(appSrc),
    ],
    [
      "dao_app.js \u8c03 daoOAuth.setClientId",
      /daoOAuth\.setClientId/.test(appSrc),
    ],
    [
      "dao_app.js \u8c03 daoOAuth.clearClientId",
      /daoOAuth\.clearClientId/.test(appSrc),
    ],
    [
      "dao_app.js \u8c03 daoOAuth.whichSource",
      /daoOAuth\.whichSource/.test(appSrc),
    ],
    ["dao_app.js \u542b \u5370 132 \u6ce8", /\u5370\s*132/.test(appSrc)],
  ];
  for (const [n, ok_] of appChecks) {
    if (ok_) ok(n);
    else ng(n, "\u7f3a\u5173\u952e\u7801");
  }

  // ─── index.html · admin UI ───
  const htmlChecks = [
    [
      "index.html \u542b id=gate-oauth-config-details",
      /id=["']gate-oauth-config-details["']/.test(htmlSrc),
    ],
    [
      "index.html \u542b id=gate-oauth-config-input",
      /id=["']gate-oauth-config-input["']/.test(htmlSrc),
    ],
    [
      "index.html \u542b id=gate-oauth-config-save",
      /id=["']gate-oauth-config-save["']/.test(htmlSrc),
    ],
    [
      "index.html \u542b id=gate-oauth-config-clear",
      /id=["']gate-oauth-config-clear["']/.test(htmlSrc),
    ],
    [
      "index.html \u542b id=gate-oauth-config-source",
      /id=["']gate-oauth-config-source["']/.test(htmlSrc),
    ],
    [
      "index.html admin UI \u542b\u4e3b\u516c\u8bcf (5 min \u5efa OAuth App)",
      /5\s*min[\s\S]{0,500}OAuth\s*App|OAuth\s*App[\s\S]{0,200}5\s*min|github\.com\/settings\/developers/i.test(
        htmlSrc,
      ),
    ],
    [
      "index.html admin UI \u63d0 URL \u53c2\u9014 (?dao_oauth_client_id=)",
      /\?dao_oauth_client_id=/.test(htmlSrc),
    ],
    [
      "index.html \u542b \u5370 132 \u6ce8",
      /\u5370\s*132/.test(htmlSrc),
    ],
  ];
  for (const [n, ok_] of htmlChecks) {
    if (ok_) ok(n);
    else ng(n, "\u7f3a\u5173\u952e\u7801");
  }
}

// ════════════════════════════════════════════════════════════════════
// § 二 · 动守 · vm.runInContext 加载 dao_oauth.js · 真测 4 源链
// ════════════════════════════════════════════════════════════════════
function makeFakeWindow(opts) {
  opts = opts || {};
  const lsBag = Object.assign({}, opts.localStorage || {});
  const win = {
    fetch: globalThis.fetch ? globalThis.fetch.bind(globalThis) : undefined,
    location: opts.location || null,
    localStorage: {
      getItem: function (k) {
        return Object.prototype.hasOwnProperty.call(lsBag, k) ? lsBag[k] : null;
      },
      setItem: function (k, v) {
        lsBag[k] = String(v);
      },
      removeItem: function (k) {
        delete lsBag[k];
      },
    },
    __DAO_OAUTH_CLIENT_ID__: opts.windowGlobal || undefined,
    daoSync: {
      setPat: () => {},
      hasPat: () => false,
      clearPat: () => {},
    },
    setTimeout: (cb, ms) => setTimeout(cb, Math.min(ms || 0, 50)),
    clearTimeout: clearTimeout,
  };
  win.window = win;
  return { win, lsBag };
}

function loadOauth(oauthSrc, opts) {
  const { win, lsBag } = makeFakeWindow(opts);
  const ctx = {
    window: win,
    setTimeout: win.setTimeout,
    clearTimeout: clearTimeout,
    fetch: win.fetch,
    URLSearchParams: globalThis.URLSearchParams,
    console: console,
  };
  vm.createContext(ctx);
  vm.runInContext(oauthSrc, ctx, { filename: "dao_oauth.js" });
  return { daoOAuth: ctx.window.daoOAuth, lsBag, win };
}

async function dynamicGuard() {
  console.log("\n\u2550\u2550\u2550 \u4e8c \u00b7 \u52a8\u5b88 \u00b7 vm runInContext \u00b7 4 \u6e90\u94fe\u9a8c \u2550\u2550\u2550");

  const oauthSrc = fs.readFileSync(DAO_OAUTH, "utf8");

  // ───── 实验一 · 默 placeholder 路径 ─────
  console.log("\n\u2500\u2500 \u5b9e\u9a8c\u4e00 \u00b7 \u9ed8\u8def\u5f84 (\u65e0 URL/LS/window) \u2500\u2500");
  {
    const { daoOAuth } = loadOauth(oauthSrc, {});
    if (daoOAuth.whichSource() === "default_placeholder") {
      ok("whichSource() === default_placeholder \u5f53\u65e0\u4f55\u6e90");
    } else {
      ng("whichSource default", "\u8fd4 " + daoOAuth.whichSource());
    }
    if (!daoOAuth.isConfigured()) {
      ok("isConfigured() === false \u5f53 default placeholder");
    } else {
      ng("isConfigured default", "\u671f false \u00b7 \u5b9e true");
    }
    if (/PLACEHLDR/i.test(daoOAuth.getClientId())) {
      ok("getClientId() \u8fd4 placeholder (\u542b PLACEHLDR)");
    } else {
      ng("getClientId default", daoOAuth.getClientId());
    }
  }

  // ───── 实验二 · 仅 window_global 源 ─────
  console.log("\n\u2500\u2500 \u5b9e\u9a8c\u4e8c \u00b7 \u4ec5 window.__DAO_OAUTH_CLIENT_ID__ \u2500\u2500");
  {
    const { daoOAuth } = loadOauth(oauthSrc, {
      windowGlobal: "Ov23liYIN132WINDOWMOCK",
    });
    if (daoOAuth.whichSource() === "window_global") {
      ok("whichSource() === window_global");
    } else {
      ng("whichSource window", "\u8fd4 " + daoOAuth.whichSource());
    }
    if (daoOAuth.getClientId() === "Ov23liYIN132WINDOWMOCK") {
      ok("getClientId() \u8fd4 window \u5168\u5c40\u503c");
    } else {
      ng("getClientId window", daoOAuth.getClientId());
    }
    if (daoOAuth.isConfigured()) {
      ok("isConfigured() === true \u5f53 window \u6709\u6709\u6548\u503c");
    } else {
      ng("isConfigured window", "\u671f true \u00b7 \u5b9e false");
    }
  }

  // ───── 实验三 · 仅 localStorage 源 ─────
  console.log(
    "\n\u2500\u2500 \u5b9e\u9a8c\u4e09 \u00b7 \u4ec5 localStorage \u2500\u2500",
  );
  {
    const { daoOAuth } = loadOauth(oauthSrc, {
      localStorage: { dao_oauth_client_id: "Ov23liYIN132LSMOCK" },
    });
    if (daoOAuth.whichSource() === "localStorage") {
      ok("whichSource() === localStorage");
    } else {
      ng("whichSource ls", "\u8fd4 " + daoOAuth.whichSource());
    }
    if (daoOAuth.getClientId() === "Ov23liYIN132LSMOCK") {
      ok("getClientId() \u8fd4 LS \u503c");
    } else {
      ng("getClientId ls", daoOAuth.getClientId());
    }
  }

  // ───── 实验四 · LS + window 共在 · LS 优先 ─────
  console.log(
    "\n\u2500\u2500 \u5b9e\u9a8c\u56db \u00b7 LS + window \u00b7 LS \u4f18\u5148 \u2500\u2500",
  );
  {
    const { daoOAuth } = loadOauth(oauthSrc, {
      localStorage: { dao_oauth_client_id: "Ov23liYIN132LSWIN" },
      windowGlobal: "Ov23liYIN132WINLOSE",
    });
    if (daoOAuth.whichSource() === "localStorage") {
      ok("whichSource() === localStorage \u5f53 LS \u4e0e window \u5747\u5728 (LS \u4f18\u5148)");
    } else {
      ng("LS > window", "\u8fd4 " + daoOAuth.whichSource());
    }
    if (daoOAuth.getClientId() === "Ov23liYIN132LSWIN") {
      ok("getClientId() === LS \u503c (window \u88ab\u8986)");
    } else {
      ng("LS value win", daoOAuth.getClientId());
    }
  }

  // ───── 实验五 · URL > LS > window 三者共在 · URL 顶 ─────
  console.log(
    "\n\u2500\u2500 \u5b9e\u9a8c\u4e94 \u00b7 URL + LS + window \u00b7 URL \u9876\u4f18\u5148 \u2500\u2500",
  );
  {
    const { daoOAuth } = loadOauth(oauthSrc, {
      location: { search: "?dao_oauth_client_id=Ov23liYIN132URLTOP&other=foo" },
      localStorage: { dao_oauth_client_id: "Ov23liYIN132LSLOSE" },
      windowGlobal: "Ov23liYIN132WINLOSE",
    });
    if (daoOAuth.whichSource() === "url_param") {
      ok("whichSource() === url_param \u5f53 URL \u4e0e LS+window \u5747\u5728 (URL \u9876\u4f18)");
    } else {
      ng("URL > LS > window", "\u8fd4 " + daoOAuth.whichSource());
    }
    if (daoOAuth.getClientId() === "Ov23liYIN132URLTOP") {
      ok("getClientId() === URL \u503c (LS \u4e0e window \u5747\u88ab\u8986)");
    } else {
      ng("URL value win", daoOAuth.getClientId());
    }
  }

  // ───── 实验六 · setClientId 真路 ─────
  console.log(
    "\n\u2500\u2500 \u5b9e\u9a8c\u516d \u00b7 setClientId \u771f\u8def \u2500\u2500",
  );
  {
    const { daoOAuth, lsBag } = loadOauth(oauthSrc, {});
    // 默 placeholder
    if (!daoOAuth.isConfigured()) ok("\u521d \u672a\u914d");
    else ng("初未配", "isConfigured()=true");

    // setClientId
    daoOAuth.setClientId("Ov23liYIN132SETMOCK99");
    if (daoOAuth.isConfigured()) {
      ok("setClientId \u540e isConfigured() === true (\u7acb\u6d3b)");
    } else {
      ng("setClientId 立活", "isConfigured 仍 false");
    }
    if (daoOAuth.getClientId() === "Ov23liYIN132SETMOCK99") {
      ok("setClientId \u540e getClientId() \u4e2d");
    } else {
      ng("setClientId 中", daoOAuth.getClientId());
    }
    if (lsBag.dao_oauth_client_id === "Ov23liYIN132SETMOCK99") {
      ok("setClientId \u5165 localStorage");
    } else {
      ng("入 LS", "lsBag=" + JSON.stringify(lsBag));
    }
    if (daoOAuth.whichSource() === "localStorage") {
      ok("whichSource \u8f6c localStorage");
    } else {
      ng("whichSource 转", daoOAuth.whichSource());
    }
  }

  // ───── 实验七 · setClientId 拒短/拒 PLACEHLDR ─────
  console.log(
    "\n\u2500\u2500 \u5b9e\u9a8c\u4e03 \u00b7 setClientId \u5b88\u95e8 \u2500\u2500",
  );
  {
    const { daoOAuth } = loadOauth(oauthSrc, {});
    let threwShort = false;
    try {
      daoOAuth.setClientId("abc");
    } catch (e) {
      threwShort = /\u592a\u77ed|too short|>=\s*8/.test(e.message);
    }
    if (threwShort) ok("setClientId('abc') \u62d2\u00b7\u592a\u77ed");
    else ng("setClientId 短", "应抛 · 实未抛或 msg 异");

    let threwPlaceholder = false;
    try {
      daoOAuth.setClientId("Ov23liYINDAO130PLACEHLDR");
    } catch (e) {
      threwPlaceholder = /PLACEHLDR/i.test(e.message);
    }
    if (threwPlaceholder)
      ok("setClientId(placeholder) \u62d2\u00b7\u542b PLACEHLDR");
    else ng("setClientId placeholder", "应抛 · 实未抛或 msg 异");
  }

  // ───── 实验八 · clearClientId ─────
  console.log(
    "\n\u2500\u2500 \u5b9e\u9a8c\u516b \u00b7 clearClientId \u56de\u9000 \u2500\u2500",
  );
  {
    const { daoOAuth, lsBag } = loadOauth(oauthSrc, {});
    daoOAuth.setClientId("Ov23liYIN132CLEARTEST");
    if (lsBag.dao_oauth_client_id) ok("setClientId \u5148\u5165 LS");
    else ng("setClientId 入 LS", "未入");

    daoOAuth.clearClientId();
    if (!lsBag.dao_oauth_client_id) {
      ok("clearClientId \u51fa LS");
    } else {
      ng("clearClientId 出 LS", "lsBag=" + JSON.stringify(lsBag));
    }
    if (daoOAuth.whichSource() === "default_placeholder") {
      ok("clear \u540e \u56de\u9000 default_placeholder");
    } else {
      ng("clear 后回退", daoOAuth.whichSource());
    }
    if (!daoOAuth.isConfigured()) {
      ok("clear \u540e isConfigured() === false");
    } else {
      ng("clear 后 isConfigured", "仍 true");
    }
  }

  // ───── 实验九 · clear 后 window 兜底 ─────
  console.log(
    "\n\u2500\u2500 \u5b9e\u9a8c\u4e5d \u00b7 clear \u540e window \u517c\u5e95 \u2500\u2500",
  );
  {
    const { daoOAuth } = loadOauth(oauthSrc, {
      localStorage: { dao_oauth_client_id: "Ov23liYIN132LSORIG" },
      windowGlobal: "Ov23liYIN132WINBACKUP",
    });
    if (daoOAuth.whichSource() === "localStorage") ok("\u521d\u4e0e LS");
    else ng("初是 LS", daoOAuth.whichSource());

    daoOAuth.clearClientId();
    if (daoOAuth.whichSource() === "window_global") {
      ok("clear \u540e \u56de window_global (LS \u6e05 \u00b7 window \u8865\u4f4d)");
    } else {
      ng("clear 回 window", daoOAuth.whichSource());
    }
    if (daoOAuth.getClientId() === "Ov23liYIN132WINBACKUP") {
      ok("getClientId \u8fd4 window \u503c");
    } else {
      ng("clear 后 getClientId", daoOAuth.getClientId());
    }
  }
}

// ════════════════════════════════════════════════════════════════════
(async () => {
  staticGuard();
  try {
    await dynamicGuard();
  } catch (e) {
    ng("dynamicGuard crash", e.stack || e.message);
  }

  console.log("\n" + "\u2550".repeat(60));
  console.log(
    " \u5370 132 \u603b: " + pass + " \u8fc7 / " + fail + " \u5931",
  );
  console.log("\u2550".repeat(60));

  if (fail === 0) {
    console.log(
      "\n\u2713 client_id 4 \u6e90\u94fe \u5168\u8fc7 \u00b7 \u4e00\u6b21\u4e3a\u00b7\u4e07\u6b21\u7528 \u00b7 \u67d4\u5f31\u80dc\u521a\n",
    );
    process.exit(0);
  } else {
    console.log("\n\u2717 \u5931\u9879:");
    for (const f of fails) console.log("  - " + f);
    process.exit(1);
  }
})();
