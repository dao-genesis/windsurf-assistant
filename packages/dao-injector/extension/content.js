/**
 * content.js · 印 88 · content script (isolated world)
 * ════════════════════════════════════════════════════════════════════════
 *
 * 道义:
 *   「江海所以能为百谷王者, 以其善下之」(六十六章)
 *   「上善如水。水善, 利万物而有静」(八章)
 *
 *   作为 isolated world 之水 ── 一边接 service worker 之配, 一边推 page world 之眼。
 *
 * 三职:
 *   1. 注 inject.js 入 page world (MAIN script world)
 *   2. 接 SW 之 SP 配置, 转推 inject.js (window.postMessage)
 *   3. 接 inject.js 之 observe 推, 转 SW 持久 + popup 实时
 */
(function () {
  "use strict";

  // ────────────────────────────────────────────────────────────────
  // §1 注入 inject.js 入 page world
  //   MV3 推荐法: chrome.runtime.getURL + <script src> · 让 page 见 inject.js
  // ────────────────────────────────────────────────────────────────
  function injectScript() {
    try {
      const s = document.createElement("script");
      s.src = chrome.runtime.getURL("inject.js");
      s.async = false;
      s.onload = function () {
        s.remove();
      };
      (document.head || document.documentElement).appendChild(s);
    } catch (e) {
      console.error("[dao-sp/cs] inject failed", e);
    }
  }
  injectScript();

  // ────────────────────────────────────────────────────────────────
  // §2 接 inject.js 之消息 (ready / observe / state) · 转 SW
  // ────────────────────────────────────────────────────────────────
  window.addEventListener("message", function (event) {
    if (event.source !== window || !event.data || !event.data.type) return;
    const t = event.data.type;
    if (
      t !== "dao-sp:ready" &&
      t !== "dao-sp:observe" &&
      t !== "dao-sp:state"
    )
      return;

    // 转 SW
    try {
      chrome.runtime.sendMessage(
        {
          from: "page",
          type: t,
          payload: event.data.payload || {},
        },
        function (resp) {
          // 若 sw 答 'send-config' · 则刚 ready · 推首批配置
          if (t === "dao-sp:ready" && resp && resp.config) {
            window.postMessage(
              {
                type: "dao-sp:config",
                payload: resp.config,
              },
              "*",
            );
          }
        },
      );
    } catch (e) {
      // 忽略 · extension context invalidated 之类
    }
  });

  // ────────────────────────────────────────────────────────────────
  // §3 接 SW 之消息 (config 更 / 查询 / 转 popup) · 转 page world
  // ────────────────────────────────────────────────────────────────
  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (!msg || !msg.type) return;
    if (msg.type === "dao-sp:config-push") {
      window.postMessage(
        {
          type: "dao-sp:config",
          payload: msg.payload || {},
        },
        "*",
      );
      sendResponse({ ok: true });
      return true;
    }
    if (msg.type === "dao-sp:query") {
      // 转 page world · 由 inject.js 答 state · 异步取回
      const reqId = Math.random().toString(36).slice(2);
      const listener = function (event) {
        if (
          event.source !== window ||
          !event.data ||
          event.data.type !== "dao-sp:state"
        )
          return;
        window.removeEventListener("message", listener);
        sendResponse({ ok: true, state: event.data.payload });
      };
      window.addEventListener("message", listener);
      window.postMessage({ type: "dao-sp:query", payload: { reqId } }, "*");
      // 1.5s 超时
      setTimeout(function () {
        window.removeEventListener("message", listener);
        try {
          sendResponse({ ok: false, error: "timeout" });
        } catch (e) {}
      }, 1500);
      return true; // async
    }
  });
})();
