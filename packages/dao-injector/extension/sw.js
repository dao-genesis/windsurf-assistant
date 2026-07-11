/**
 * sw.js · 印 88 · service worker (background)
 * ════════════════════════════════════════════════════════════════════════
 *
 * 道义:
 *   「治大国若烹小鲜」(六十章) ── 后台轻活 · 不扰客行
 *   「圣人执一, 以为天下牧」(二十二章) ── 唯一真相 in chrome.storage
 *
 * 五职:
 *   1. 持久 SP 配置 (chrome.storage.local · 跨标签共享)
 *   2. 从 daemon :11441 拉 SP + 帛书 (5s 心跳)
 *   3. 推配置到所有 app.devin.ai 标签
 *   4. 收 observe ring · 缓存 (let popup 显)
 *   5. 收 popup/cs 之 setSP · 转写 daemon + 推全标签
 */
"use strict";

// ════════════════════════════════════════════════════════════════
// §0 配
// ════════════════════════════════════════════════════════════════
const DAEMON_BASES_DEFAULT = [
  "http://127.0.0.1:11441",
  "http://localhost:11441",
];
const DEVIN_ORIGIN_MATCH = /^https?:\/\/(app\.)?devin\.ai/;

const SYNC_INTERVAL_MS = 5000;

// 默认配 (无 daemon 时 fallback)
const DEFAULT_CFG = {
  enabled: true,
  strategy: "bypass",
  customSp: "",
  globalSp: "",
  silkText: "", // 帛书全文 · 从 daemon /v1/system/silk?full=1 拉
  debug: false,
  daemonBases: DAEMON_BASES_DEFAULT,
  daemonActive: null, // 当前活之 daemon base
  daemonLastSync: 0,
  daemonLastError: "",
};

// observe ring (跨 page 合并) · 最近 64 笔
let observeRing = [];
const OBSERVE_MAX = 64;

// ════════════════════════════════════════════════════════════════
// §1 配持久 (chrome.storage.local)
// ════════════════════════════════════════════════════════════════
async function loadCfg() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["dao_sp_cfg"], (r) => {
      const stored = r.dao_sp_cfg || {};
      resolve(Object.assign({}, DEFAULT_CFG, stored));
    });
  });
}

async function saveCfg(patch) {
  const cur = await loadCfg();
  const next = Object.assign({}, cur, patch || {});
  return new Promise((resolve) => {
    chrome.storage.local.set({ dao_sp_cfg: next }, () => resolve(next));
  });
}

// ════════════════════════════════════════════════════════════════
// §2 与 daemon :11441 同步 SP + 帛书
// ════════════════════════════════════════════════════════════════
async function fetchJson(url, opts) {
  const r = await fetch(
    url,
    Object.assign(
      {
        method: "GET",
        cache: "no-store",
        credentials: "omit",
      },
      opts || {},
    ),
  );
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.json();
}

async function probeDaemon(bases) {
  for (const base of bases || DAEMON_BASES_DEFAULT) {
    try {
      const h = await fetchJson(base + "/health");
      if (h && h.service === "devin-cloud-proxy") return base;
    } catch (e) {
      // 试下一个
    }
  }
  return null;
}

async function syncDaemon() {
  const cur = await loadCfg();
  const active = await probeDaemon(cur.daemonBases);
  if (!active) {
    await saveCfg({
      daemonActive: null,
      daemonLastError: "no daemon reachable",
    });
    return null;
  }

  try {
    // 并发拉 SP 全 + 帛书全文
    const [sp, silkResp] = await Promise.all([
      fetchJson(active + "/v1/system/prompt?full=1"),
      fetchJson(active + "/v1/system/silk?full=1"),
    ]);

    const patch = {
      strategy: sp.strategy || "bypass",
      customSp: sp.customSp || "",
      globalSp: sp.globalSp || "",
      silkText: silkResp.silkText || "",
      daemonActive: active,
      daemonLastSync: Date.now(),
      daemonLastError: "",
    };
    await saveCfg(patch);
    return patch;
  } catch (e) {
    await saveCfg({
      daemonActive: active,
      daemonLastError: String(e && e.message ? e.message : e),
    });
    return null;
  }
}

// ════════════════════════════════════════════════════════════════
// §3 推配置到所有 app.devin.ai 标签
// ════════════════════════════════════════════════════════════════
async function pushConfigToAllTabs() {
  const cfg = await loadCfg();
  const payload = {
    enabled: cfg.enabled,
    strategy: cfg.strategy,
    customSp: cfg.customSp,
    globalSp: cfg.globalSp,
    silkText: cfg.silkText,
    debug: cfg.debug,
  };
  try {
    chrome.tabs.query({ url: ["*://app.devin.ai/*", "*://*.devin.ai/*"] }, (tabs) => {
      for (const t of tabs || []) {
        try {
          chrome.tabs.sendMessage(
            t.id,
            { type: "dao-sp:config-push", payload },
            () => {
              // ignore lastError · 标签可能未注入或已关
              void chrome.runtime.lastError;
            },
          );
        } catch (e) {}
      }
    });
  } catch (e) {}
}

// ════════════════════════════════════════════════════════════════
// §4 心跳 sync + 推
// ════════════════════════════════════════════════════════════════
let syncTimer = null;
function startHeartbeat() {
  if (syncTimer) return;
  const tick = async () => {
    await syncDaemon();
    await pushConfigToAllTabs();
  };
  // 立即一次
  tick();
  syncTimer = setInterval(tick, SYNC_INTERVAL_MS);
}

// MV3 service worker 可被休眠 · 用 alarms 做长心跳
chrome.alarms.create("dao-sp-sync", { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === "dao-sp-sync") {
    syncDaemon().then(() => pushConfigToAllTabs());
  }
});

// 启动时立即起
startHeartbeat();

// ════════════════════════════════════════════════════════════════
// §5 与 cs / popup 通讯
// ════════════════════════════════════════════════════════════════
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.type) return;

  // 由 cs 转来的 page 消息
  if (msg.from === "page") {
    if (msg.type === "dao-sp:ready") {
      // 刚 ready · 答首批配置
      loadCfg().then((cfg) => {
        sendResponse({
          ok: true,
          config: {
            enabled: cfg.enabled,
            strategy: cfg.strategy,
            customSp: cfg.customSp,
            globalSp: cfg.globalSp,
            silkText: cfg.silkText,
            debug: cfg.debug,
          },
        });
      });
      return true; // async
    }
    if (msg.type === "dao-sp:observe") {
      // 收 observe · 缓存
      const rec = Object.assign({ tabId: sender.tab && sender.tab.id }, msg.payload || {});
      observeRing.unshift(rec);
      while (observeRing.length > OBSERVE_MAX) observeRing.pop();
      sendResponse({ ok: true });
      return false;
    }
    return;
  }

  // 由 popup / cs 主动发的
  if (msg.type === "dao-sp:get-cfg") {
    loadCfg().then((cfg) => {
      sendResponse({
        ok: true,
        cfg: {
          enabled: cfg.enabled,
          strategy: cfg.strategy,
          customSp: cfg.customSp,
          globalSp: cfg.globalSp,
          silkLoaded: !!cfg.silkText,
          silkChars: (cfg.silkText || "").length,
          debug: cfg.debug,
          daemonBases: cfg.daemonBases,
          daemonActive: cfg.daemonActive,
          daemonLastSync: cfg.daemonLastSync,
          daemonLastError: cfg.daemonLastError,
        },
        observe: observeRing.slice(0, 16),
      });
    });
    return true;
  }

  if (msg.type === "dao-sp:set-cfg") {
    const patch = msg.patch || {};
    (async () => {
      // 1. 先存本机
      const saved = await saveCfg(patch);

      // 2. 若 daemon 在 · 同步写
      if (saved.daemonActive) {
        try {
          const body = {};
          if (typeof patch.strategy === "string") body.strategy = patch.strategy;
          if (typeof patch.customSp === "string") body.customSp = patch.customSp;
          if (typeof patch.globalSp === "string") body.globalSp = patch.globalSp;
          if (Object.keys(body).length > 0) {
            await fetch(saved.daemonActive + "/v1/system/prompt", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            });
          }
        } catch (e) {
          await saveCfg({ daemonLastError: "set-cfg: " + e.message });
        }
      }

      // 3. 推全标签
      await pushConfigToAllTabs();
      sendResponse({ ok: true, cfg: saved });
    })();
    return true; // async
  }

  if (msg.type === "dao-sp:sync-now") {
    syncDaemon()
      .then((r) =>
        pushConfigToAllTabs().then(() => sendResponse({ ok: true, result: r })),
      )
      .catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }

  if (msg.type === "dao-sp:get-observe") {
    sendResponse({ ok: true, observe: observeRing.slice(0, 32) });
    return false;
  }
});

// 装/启时初始
chrome.runtime.onInstalled.addListener(() => startHeartbeat());
chrome.runtime.onStartup.addListener(() => startHeartbeat());
