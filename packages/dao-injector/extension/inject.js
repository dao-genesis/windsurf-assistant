/**
 * inject.js · 印 88 · 网页端 SP 注入器之眼
 * ════════════════════════════════════════════════════════════════════════
 *
 * 道义:
 *   「反者道之动也; 弱者道之用也。天下之物生于有, 有生于无。」 (帛书四十)
 *   「无有入于无间。 吾是以知无为之益; 不言之教, 无为之益, 天下希能及之矣。」 (帛书四十三)
 *
 *   反代之极: 在浏览器内 hook WebSocket.prototype.send,
 *   不出户而知天下, 不窥牖而注道于客行之 wss 流。
 *
 * 道路 (page world · MAIN script world):
 *   user → app.devin.ai SPA → new WebSocket('wss://app.devin.ai/api/acp/live?token=...')
 *                                                            ↓
 *                                  ┌─────────────────────────────────────┐
 *                                  │  [此处] PatchedWS.send 拦截         │
 *                                  │   解 line-delimited JSON-RPC        │
 *                                  │   若 method === 'session/prompt'    │
 *                                  │     则改 params.prompt[0].text       │
 *                                  │     按 SP 策略前置帛书全文/自定 SP   │
 *                                  └─────────────────────────────────────┘
 *                                                            ↓
 *                                            wss://app.devin.ai/api/acp/live
 *
 * 通讯 (page world ↔ content script):
 *   window.postMessage({ type: 'dao-sp:config', payload: {...} })   // CS → 注入器
 *   window.postMessage({ type: 'dao-sp:observe', payload: {...} }) // 注入器 → CS
 *
 * 策略 (6 式 · 同 sp_manager.js):
 *   bypass / override / prepend / append / dao / custom
 *
 * 道义守:
 *   - 仅 hook /api/acp/live 之 wss · 不动其他 WebSocket
 *   - 不偷 token (token 在 URL 中 · 仅旁观 · 不外送)
 *   - 默关 console 日志 (避污浏览器控制台 · 仅 debug=true 时输)
 *   - 不污原 SPA 之 state · 仅劫 send · 不动 onmessage
 *   - 仅前置 SP · 不删用户原文 · 用户语句完整保留
 */
(function () {
  "use strict";

  // ════════════════════════════════════════════════════════════════
  // §0 配 · 默认状态 (由 content script 同步)
  // ════════════════════════════════════════════════════════════════
  const TAG = "[\u9053\u00b7SP\u6ce8\u5165\u5668]"; // [道·SP注入器]
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

  // 实时态 · 由 CS 推送
  let cfg = {
    enabled: true, // 总开关
    strategy: "bypass", // bypass | override | prepend | append | dao | custom
    customSp: "", // custom 策略之 SP
    globalSp: "", // override/prepend/append 之 SP
    silkText: "", // 帛书全文 (dao 策略用 · 由 CS 注入)
    debug: false, // console 日志
  };

  // 观察 ring · 最近 16 笔注入
  const observeRing = [];
  const OBSERVE_MAX = 16;

  // 计数器
  const stats = {
    hookedWsCount: 0,
    interceptedCount: 0,
    injectedCount: 0,
    startedAt: Date.now(),
  };

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
  function logWarn() {
    console.warn.apply(
      console,
      ["%c" + TAG, "color:#fa0"].concat(Array.from(arguments)),
    );
  }

  // ════════════════════════════════════════════════════════════════
  // §1 SP 计算 · 同 sp_manager.js 6 策略
  //   注: client 端 system 在 prompt[0].text 中 (Devin 拒识 [system] 标签)
  //       故所有策略直接作用于 prompt[0].text 整串
  // ════════════════════════════════════════════════════════════════
  function isAlreadyInverted(s) {
    return typeof s === "string" && s.startsWith(INVERTED_PREFIX);
  }

  function computeFinal(originalText) {
    if (!cfg.enabled) return originalText;
    if (typeof originalText !== "string") return originalText;
    if (isAlreadyInverted(originalText)) return originalText; // 已注入 · 不重注

    const original = originalText;
    let injected = "";

    switch (cfg.strategy) {
      case "dao":
        if (cfg.silkText && cfg.silkText.length > 0) {
          injected = TAO_HEADER + cfg.silkText + TAO_TRAILER + original;
        } else {
          return original; // 帛书未载 · 退 bypass
        }
        break;
      case "override":
        if (cfg.globalSp && cfg.globalSp.length > 0) {
          injected = cfg.globalSp + TAO_TRAILER + original;
        } else {
          return original;
        }
        break;
      case "prepend":
        if (cfg.globalSp && cfg.globalSp.length > 0) {
          injected = cfg.globalSp + "\n\n" + original;
        } else {
          return original;
        }
        break;
      case "append":
        if (cfg.globalSp && cfg.globalSp.length > 0) {
          injected = original + "\n\n" + cfg.globalSp;
        } else {
          return original;
        }
        break;
      case "custom":
        if (cfg.customSp && cfg.customSp.length > 0) {
          injected = cfg.customSp + TAO_TRAILER + original;
        } else {
          return original;
        }
        break;
      case "bypass":
      default:
        return original;
    }

    return injected;
  }

  // ════════════════════════════════════════════════════════════════
  // §2 拦截一笔 JSON-RPC 消息 · 返修后字符串 (或原样)
  //   仅改 method === 'session/prompt' 之 prompt[0].text
  // ════════════════════════════════════════════════════════════════
  function interceptMessage(rawLine) {
    if (typeof rawLine !== "string" || rawLine.length === 0) return rawLine;
    let msg;
    try {
      msg = JSON.parse(rawLine);
    } catch (e) {
      return rawLine; // 非 JSON · 原样
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
        const original = block.text;
        const final = computeFinal(original);
        if (final !== original) {
          block.text = final;
          stats.injectedCount++;
          const rec = {
            at: Date.now(),
            sessionId: msg.params.sessionId || "?",
            strategy: cfg.strategy,
            origLen: original.length,
            finalLen: final.length,
            origPreview: original.slice(0, 120),
            finalPreview: final.slice(0, 120),
          };
          observeRing.unshift(rec);
          while (observeRing.length > OBSERVE_MAX) observeRing.pop();
          logImportant(
            "\u2605 \u6ce8\u5165 " + cfg.strategy, // ★ 注入
            "orig=" + original.length + "B \u2192 final=" + final.length + "B", // →
          );
          // 推 CS · 让 popup/dashboard 可见
          try {
            window.postMessage(
              {
                type: "dao-sp:observe",
                payload: rec,
              },
              "*",
            );
          } catch (e) {}
          return JSON.stringify(msg);
        }
      }
    }
    return rawLine;
  }

  function interceptOutgoing(rawData) {
    stats.interceptedCount++;
    if (typeof rawData !== "string") {
      // ArrayBuffer / Blob: ACP 必走文本 · 不动
      return rawData;
    }
    const lines = rawData.split("\n");
    if (lines.length === 1) {
      return interceptMessage(rawData);
    }
    const out = [];
    for (const line of lines) {
      const t = line.trim();
      if (!t) {
        out.push(line);
        continue;
      }
      out.push(interceptMessage(line));
    }
    return out.join("\n");
  }

  // ════════════════════════════════════════════════════════════════
  // §3 hook WebSocket · 仅 hook /api/acp/live
  // ════════════════════════════════════════════════════════════════
  const OrigWebSocket = window.WebSocket;
  if (!OrigWebSocket) {
    logWarn("\u672c\u73af\u5883\u65e0 WebSocket \u00b7 \u7559"); // 本环境无 WebSocket · 留
    return;
  }

  // 标记防重 hook
  if (window.__DAO_SP_HOOKED__) {
    logWarn("\u5df2 hook \u00b7 \u8df3"); // 已 hook · 跳
    return;
  }
  window.__DAO_SP_HOOKED__ = true;

  const isAcpUrl = (u) => {
    try {
      return typeof u === "string" && u.indexOf("/api/acp/live") >= 0;
    } catch (e) {
      return false;
    }
  };

  function PatchedWS(url, protocols) {
    const ws =
      protocols !== undefined
        ? new OrigWebSocket(url, protocols)
        : new OrigWebSocket(url);

    if (isAcpUrl(url)) {
      stats.hookedWsCount++;
      logImportant(
        "\u2605 ACP wss hooked",
        "url=" + String(url).slice(0, 80) + "...",
        "(#" + stats.hookedWsCount + ")",
      );

      const origSend = ws.send.bind(ws);
      ws.send = function (data) {
        try {
          const modified = interceptOutgoing(data);
          return origSend(modified);
        } catch (e) {
          logWarn("intercept error · " + e.message);
          return origSend(data);
        }
      };
    }
    return ws;
  }
  // 继承静态字段 + 原型
  PatchedWS.prototype = OrigWebSocket.prototype;
  PatchedWS.CONNECTING = OrigWebSocket.CONNECTING;
  PatchedWS.OPEN = OrigWebSocket.OPEN;
  PatchedWS.CLOSING = OrigWebSocket.CLOSING;
  PatchedWS.CLOSED = OrigWebSocket.CLOSED;
  // 名 + length 仿
  try {
    Object.defineProperty(PatchedWS, "name", { value: "WebSocket" });
  } catch (e) {}

  window.WebSocket = PatchedWS;

  // ════════════════════════════════════════════════════════════════
  // §4 与 content script 通讯 · 接收 SP 配置推送
  // ════════════════════════════════════════════════════════════════
  window.addEventListener("message", function (event) {
    // 仅接 same-origin 之 dao-sp:* 消息
    if (event.source !== window || !event.data || !event.data.type) return;
    const t = event.data.type;
    const p = event.data.payload || {};

    if (t === "dao-sp:config") {
      // 全量 / 部分更
      if (typeof p.enabled === "boolean") cfg.enabled = p.enabled;
      if (typeof p.strategy === "string") cfg.strategy = p.strategy;
      if (typeof p.customSp === "string") cfg.customSp = p.customSp;
      if (typeof p.globalSp === "string") cfg.globalSp = p.globalSp;
      if (typeof p.silkText === "string") cfg.silkText = p.silkText;
      if (typeof p.debug === "boolean") cfg.debug = p.debug;
      dlog("config updated", {
        enabled: cfg.enabled,
        strategy: cfg.strategy,
        silkLen: cfg.silkText.length,
        customLen: cfg.customSp.length,
        globalLen: cfg.globalSp.length,
      });
    } else if (t === "dao-sp:query") {
      // CS / popup 查当前态
      try {
        window.postMessage(
          {
            type: "dao-sp:state",
            payload: {
              cfg: {
                enabled: cfg.enabled,
                strategy: cfg.strategy,
                hasCustom: cfg.customSp.length > 0,
                hasGlobal: cfg.globalSp.length > 0,
                silkLoaded: cfg.silkText.length > 0,
                silkChars: cfg.silkText.length,
                debug: cfg.debug,
              },
              stats: {
                hookedWsCount: stats.hookedWsCount,
                interceptedCount: stats.interceptedCount,
                injectedCount: stats.injectedCount,
                uptimeMs: Date.now() - stats.startedAt,
              },
              observe: observeRing.slice(0, 16),
            },
          },
          "*",
        );
      } catch (e) {}
    }
  });

  // 揭旗 · 通告 CS "我已起"
  try {
    window.postMessage(
      {
        type: "dao-sp:ready",
        payload: { at: Date.now(), version: "印88·v1" },
      },
      "*",
    );
  } catch (e) {}

  logImportant(
    "\u53cd\u8005\u9053\u4e4b\u52a8 \u00b7 \u7f51\u9875\u7aef SP \u6ce8\u5165\u5668\u5df2\u751f",
    // 反者道之动 · 网页端 SP 注入器已生
  );
})();
