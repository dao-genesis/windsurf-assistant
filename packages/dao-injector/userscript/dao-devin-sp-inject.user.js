// ==UserScript==
// @name         道·Devin 网页端 SP 注入器 (印88)
// @namespace    https://devin.ai/dao-sp
// @version      1.0.0
// @description  反者道之动 · 在 app.devin.ai 浏览器内 hook wss · 实现底层 system prompt 替换 (帛书《老子》/ 自定 / 6 策略)
// @author       道 · 印88
// @match        *://app.devin.ai/*
// @match        *://*.devin.ai/*
// @run-at       document-start
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      127.0.0.1
// @connect      localhost
// ==/UserScript==

/**
 * 道义:
 *   「反者道之动也; 弱者道之用也。」 (帛书四十)
 *   「无有入于无间。」 (帛书四十三)
 *
 * 三脉络:
 *   1. hook unsafeWindow.WebSocket · 仅 /api/acp/live
 *   2. 拦 session/prompt JSON-RPC · 改 params.prompt[0].text
 *   3. 配置 6 策略 (bypass/dao/override/prepend/append/custom)
 *      · GM_setValue 持久 · 默 dao 帛书
 *      · 可选连 daemon :11441 拉自定 SP + 帛书 (5s 心跳)
 *
 * 用 (主公一笔):
 *   1. 装 Tampermonkey / Violentmonkey (Chrome/Edge/Firefox 均可)
 *   2. 装本脚本 (raw 复制 / 拖入)
 *   3. 打开 https://app.devin.ai
 *   4. Tampermonkey 图标 → 道·Devin SP 菜单一笔切策略
 *   5. (可选) 起本机 daemon :11441 让脚本拉最新 SP/帛书
 */

(function () {
  "use strict";

  // ════════════════════════════════════════════════════════════════
  // §0 配
  // ════════════════════════════════════════════════════════════════
  const TAG = "[\u9053\u00b7SP]"; // [道·SP]
  // 印 89 · 反 alignment 之反 · 由"身份替换"改"风格引导"
  // 旧 (印 88): "You are Cascade..." → claude alignment 拒 (印 88续 真凭)
  // 新 (印 89): 风格引导 · claude 接受
  const TAO_HEADER =
    "请以下文《老子》(帛书本) 之思想风格、价值取向、表达方式回答下面的对话:\n" +
    "- 引用相应章句, 用古文/简洁风\n" +
    "- 体现「反者道之动」「无为而无不为」「柔弱胜刚强」「不争」「善下」之精神\n" +
    "- 自然展现即可, 不必声明身份转变\n\n" +
    "《老子》(帛书本) 全文:\n\n";
  const TAO_TRAILER = "\n\n──── 以上为风格指引 · 以下为我的问题 ────\n\n";
  const INVERTED_PREFIX = "请以下文《老子》";
  const DAEMON_BASES = ["http://127.0.0.1:11441", "http://localhost:11441"];
  const SYNC_INTERVAL_MS = 5000;

  // 配 (GM_setValue 持久)
  const KEYS = {
    ENABLED: "dao_sp_enabled",
    STRATEGY: "dao_sp_strategy",
    CUSTOM: "dao_sp_custom",
    GLOBAL: "dao_sp_global",
    SILK: "dao_sp_silk_text", // 帛书全文 · 由 daemon /v1/system/silk?full=1 拉
    DEBUG: "dao_sp_debug",
    DAEMON: "dao_sp_daemon_base",
  };

  function gget(k, def) {
    try {
      return GM_getValue(k, def);
    } catch (e) {
      return def;
    }
  }
  function gset(k, v) {
    try {
      GM_setValue(k, v);
    } catch (e) {}
  }

  const cfg = {
    enabled: gget(KEYS.ENABLED, true),
    strategy: gget(KEYS.STRATEGY, "bypass"), // 默 bypass · 主公自切到 dao
    customSp: gget(KEYS.CUSTOM, ""),
    globalSp: gget(KEYS.GLOBAL, ""),
    silkText: gget(KEYS.SILK, ""), // 帛书全文 · 用户首次起后从 daemon 拉
    debug: gget(KEYS.DEBUG, false),
    daemon: gget(KEYS.DAEMON, ""),
  };

  // 统计 + observe
  const stats = {
    hookedCount: 0,
    interceptedCount: 0,
    injectedCount: 0,
    startedAt: Date.now(),
  };
  const observeRing = [];
  const OBSERVE_MAX = 16;

  function dlog() {
    if (cfg.debug) {
      console.log.apply(
        console,
        ["%c" + TAG, "color:#0ff"].concat(Array.from(arguments)),
      );
    }
  }
  function logImportant() {
    console.log.apply(
      console,
      ["%c" + TAG, "color:#0ff;font-weight:bold"].concat(Array.from(arguments)),
    );
  }

  // ════════════════════════════════════════════════════════════════
  // §1 与 daemon 同步 (可选 · daemon 不通则用本地配)
  //   GM_xmlhttpRequest · 跨域 (Tampermonkey @connect 已声 127.0.0.1)
  // ════════════════════════════════════════════════════════════════
  function gmGet(url) {
    return new Promise((resolve, reject) => {
      try {
        GM_xmlhttpRequest({
          method: "GET",
          url: url,
          timeout: 3000,
          onload: (r) => {
            if (r.status >= 200 && r.status < 300) {
              try {
                resolve(JSON.parse(r.responseText));
              } catch (e) {
                reject(e);
              }
            } else {
              reject(new Error("HTTP " + r.status));
            }
          },
          onerror: () => reject(new Error("network")),
          ontimeout: () => reject(new Error("timeout")),
        });
      } catch (e) {
        reject(e);
      }
    });
  }
  function gmPost(url, body) {
    return new Promise((resolve, reject) => {
      try {
        GM_xmlhttpRequest({
          method: "POST",
          url: url,
          headers: { "Content-Type": "application/json" },
          data: JSON.stringify(body || {}),
          timeout: 5000,
          onload: (r) => {
            try {
              resolve(JSON.parse(r.responseText));
            } catch (e) {
              resolve({});
            }
          },
          onerror: () => reject(new Error("network")),
          ontimeout: () => reject(new Error("timeout")),
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  async function probeDaemon() {
    if (cfg.daemon) {
      try {
        const h = await gmGet(cfg.daemon + "/health");
        if (h && h.service === "devin-cloud-proxy") return cfg.daemon;
      } catch (e) {}
    }
    for (const b of DAEMON_BASES) {
      try {
        const h = await gmGet(b + "/health");
        if (h && h.service === "devin-cloud-proxy") {
          cfg.daemon = b;
          gset(KEYS.DAEMON, b);
          return b;
        }
      } catch (e) {}
    }
    return null;
  }

  async function syncDaemon() {
    const base = await probeDaemon();
    if (!base) {
      dlog("daemon 不通 · 用本地配");
      return false;
    }
    try {
      const [sp, silk] = await Promise.all([
        gmGet(base + "/v1/system/prompt?full=1"),
        gmGet(base + "/v1/system/silk?full=1"),
      ]);
      if (sp && sp.strategy) {
        cfg.strategy = sp.strategy;
        cfg.customSp = sp.customSp || "";
        cfg.globalSp = sp.globalSp || "";
        gset(KEYS.STRATEGY, cfg.strategy);
        gset(KEYS.CUSTOM, cfg.customSp);
        gset(KEYS.GLOBAL, cfg.globalSp);
      }
      if (silk && silk.silkText) {
        cfg.silkText = silk.silkText;
        gset(KEYS.SILK, cfg.silkText);
      }
      dlog("daemon synced", {
        strat: cfg.strategy,
        silkLen: cfg.silkText.length,
      });
      return true;
    } catch (e) {
      dlog("daemon sync 失", e.message);
      return false;
    }
  }

  // ════════════════════════════════════════════════════════════════
  // §2 SP 计算 · 同 sp_manager.js 6 策略
  // ════════════════════════════════════════════════════════════════
  function isAlreadyInverted(s) {
    return typeof s === "string" && s.startsWith(INVERTED_PREFIX);
  }

  function computeFinal(originalText) {
    if (!cfg.enabled) return originalText;
    if (typeof originalText !== "string") return originalText;
    if (isAlreadyInverted(originalText)) return originalText;

    switch (cfg.strategy) {
      case "dao":
        if (cfg.silkText && cfg.silkText.length > 0) {
          return TAO_HEADER + cfg.silkText + TAO_TRAILER + originalText;
        }
        return originalText;
      case "override":
        if (cfg.globalSp) return cfg.globalSp + TAO_TRAILER + originalText;
        return originalText;
      case "prepend":
        if (cfg.globalSp) return cfg.globalSp + "\n\n" + originalText;
        return originalText;
      case "append":
        if (cfg.globalSp) return originalText + "\n\n" + cfg.globalSp;
        return originalText;
      case "custom":
        if (cfg.customSp) return cfg.customSp + TAO_TRAILER + originalText;
        return originalText;
      case "bypass":
      default:
        return originalText;
    }
  }

  // ════════════════════════════════════════════════════════════════
  // §3 拦截 (同 inject.js)
  // ════════════════════════════════════════════════════════════════
  function interceptMessage(rawLine) {
    if (typeof rawLine !== "string" || !rawLine.length) return rawLine;
    let msg;
    try {
      msg = JSON.parse(rawLine);
    } catch (e) {
      return rawLine;
    }
    if (
      msg &&
      msg.method === "session/prompt" &&
      msg.params &&
      Array.isArray(msg.params.prompt) &&
      msg.params.prompt.length > 0
    ) {
      const block = msg.params.prompt[0];
      if (block && block.type === "text" && typeof block.text === "string") {
        const orig = block.text;
        const final = computeFinal(orig);
        if (final !== orig) {
          block.text = final;
          stats.injectedCount++;
          const rec = {
            at: Date.now(),
            sessionId: msg.params.sessionId || "?",
            strategy: cfg.strategy,
            origLen: orig.length,
            finalLen: final.length,
            origPreview: orig.slice(0, 120),
            finalPreview: final.slice(0, 120),
          };
          observeRing.unshift(rec);
          while (observeRing.length > OBSERVE_MAX) observeRing.pop();
          logImportant(
            "\u2605 \u6ce8\u5165 " + cfg.strategy, // ★ 注入
            orig.length + "B \u2192 " + final.length + "B",
          );
          return JSON.stringify(msg);
        }
      }
    }
    return rawLine;
  }

  function interceptOutgoing(rawData) {
    stats.interceptedCount++;
    if (typeof rawData !== "string") return rawData;
    const lines = rawData.split("\n");
    if (lines.length === 1) return interceptMessage(rawData);
    return lines.map((l) => (l.trim() ? interceptMessage(l) : l)).join("\n");
  }

  // ════════════════════════════════════════════════════════════════
  // §4 hook WebSocket · 在 unsafeWindow (page world)
  // ════════════════════════════════════════════════════════════════
  const W = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
  const OrigWS = W.WebSocket;
  if (!OrigWS) {
    console.warn(TAG, "本环境无 WebSocket · 留");
    return;
  }
  if (W.__DAO_SP_HOOKED__) {
    console.warn(TAG, "已 hook · 跳");
    return;
  }
  W.__DAO_SP_HOOKED__ = true;

  function isAcpUrl(u) {
    try {
      return typeof u === "string" && u.indexOf("/api/acp/live") >= 0;
    } catch (e) {
      return false;
    }
  }

  function PatchedWS(url, protocols) {
    const ws =
      protocols !== undefined ? new OrigWS(url, protocols) : new OrigWS(url);
    if (isAcpUrl(url)) {
      stats.hookedCount++;
      logImportant(
        "\u2605 ACP wss hooked",
        String(url).slice(0, 80),
        "(#" + stats.hookedCount + ")",
      );
      const origSend = ws.send.bind(ws);
      ws.send = function (data) {
        try {
          return origSend(interceptOutgoing(data));
        } catch (e) {
          console.warn(TAG, "intercept error", e.message);
          return origSend(data);
        }
      };
    }
    return ws;
  }
  PatchedWS.prototype = OrigWS.prototype;
  PatchedWS.CONNECTING = OrigWS.CONNECTING;
  PatchedWS.OPEN = OrigWS.OPEN;
  PatchedWS.CLOSING = OrigWS.CLOSING;
  PatchedWS.CLOSED = OrigWS.CLOSED;
  try {
    Object.defineProperty(PatchedWS, "name", { value: "WebSocket" });
  } catch (e) {}
  W.WebSocket = PatchedWS;

  // ════════════════════════════════════════════════════════════════
  // §5 Tampermonkey 菜单 · 一笔切策略
  // ════════════════════════════════════════════════════════════════
  function refreshMenu() {
    // Tampermonkey 不支持移除已注菜单 · 仅注一次
  }

  function registerMenu() {
    const strategies = [
      ["bypass", "○ bypass · 不动"],
      ["dao", "● dao · 帛书全文"],
      ["custom", "● custom · 自定 SP"],
      ["override", "● override · 覆盖"],
      ["prepend", "● prepend · 前置"],
      ["append", "● append · 后置"],
    ];
    for (const [s, lbl] of strategies) {
      try {
        GM_registerMenuCommand("策略 → " + lbl, () => {
          cfg.strategy = s;
          gset(KEYS.STRATEGY, s);
          // 若 daemon 在 · 同步上去
          if (cfg.daemon) {
            gmPost(cfg.daemon + "/v1/system/prompt", { strategy: s }).catch(
              () => {},
            );
          }
          logImportant("策略切到 " + s);
          alert("[道·SP] 策略 = " + s + "\n下一笔 prompt 即生");
        });
      } catch (e) {}
    }

    try {
      GM_registerMenuCommand("查 状态 · 观察", () => {
        const msg =
          "[道·SP 状态]\n" +
          "  enabled: " +
          cfg.enabled +
          "\n" +
          "  strategy: " +
          cfg.strategy +
          "\n" +
          "  daemon: " +
          (cfg.daemon || "未通") +
          "\n" +
          "  silkText: " +
          cfg.silkText.length +
          " 字\n" +
          "  customSp: " +
          cfg.customSp.length +
          " 字\n" +
          "  globalSp: " +
          cfg.globalSp.length +
          " 字\n" +
          "  hooked: " +
          stats.hookedCount +
          " ws · intercept: " +
          stats.interceptedCount +
          " · injected: " +
          stats.injectedCount +
          "\n" +
          "  observe 笔: " +
          observeRing.length +
          "\n\n" +
          "最近 3 笔注入:\n" +
          observeRing
            .slice(0, 3)
            .map(
              (o, i) =>
                "  [" +
                (i + 1) +
                "] " +
                o.strategy +
                " · " +
                o.origLen +
                "B → " +
                o.finalLen +
                "B · " +
                Math.round((Date.now() - o.at) / 1000) +
                "s 前",
            )
            .join("\n");
        alert(msg);
      });
    } catch (e) {}

    try {
      GM_registerMenuCommand("立即同步 daemon", async () => {
        const ok = await syncDaemon();
        alert("[道·SP] " + (ok ? "已同步 daemon" : "daemon 不通"));
      });
    } catch (e) {}

    try {
      GM_registerMenuCommand("切 enabled / debug", () => {
        cfg.enabled = !cfg.enabled;
        gset(KEYS.ENABLED, cfg.enabled);
        alert("[道·SP] enabled = " + cfg.enabled);
      });
    } catch (e) {}

    try {
      GM_registerMenuCommand("设 customSp", () => {
        const s = prompt("输入 customSp (清空恢复默):", cfg.customSp || "");
        if (s !== null) {
          cfg.customSp = s;
          gset(KEYS.CUSTOM, s);
          if (cfg.daemon) {
            gmPost(cfg.daemon + "/v1/system/prompt", { customSp: s }).catch(
              () => {},
            );
          }
          alert("[道·SP] customSp 设 (" + s.length + " 字)");
        }
      });
    } catch (e) {}
  }

  registerMenu();

  // ════════════════════════════════════════════════════════════════
  // §6 启 · 心跳 sync
  // ════════════════════════════════════════════════════════════════
  syncDaemon();
  setInterval(syncDaemon, SYNC_INTERVAL_MS);

  logImportant(
    "\u53cd\u8005\u9053\u4e4b\u52a8 \u00b7 \u7f51\u9875\u7aef SP \u6ce8\u5165\u5668\u5df2\u751f",
    "(\u811a\u672c\u7248)",
    // 反者道之动 · 网页端 SP 注入器已生 (脚本版)
  );
})();
