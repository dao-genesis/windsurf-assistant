/**
 * popup.js · 印 88 · popup UI 控制
 * 「执一以为天下牧」(二十二章) ── 一窗管全标签 SP
 */
"use strict";

const $ = (id) => document.getElementById(id);

function send(msg) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(msg, (resp) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message });
        } else {
          resolve(resp || { ok: false });
        }
      });
    } catch (e) {
      resolve({ ok: false, error: String(e) });
    }
  });
}

function fmtTime(ms) {
  if (!ms) return "--";
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 5) return "刚刚";
  if (s < 60) return s + "s 前";
  if (s < 3600) return Math.round(s / 60) + "m 前";
  return Math.round(s / 3600) + "h 前";
}

function fmtBytes(n) {
  if (n == null) return "--";
  if (n < 1024) return n + "B";
  return (n / 1024).toFixed(1) + "K";
}

function updateSectionsByStrategy(strat) {
  $("sec-custom").style.display = strat === "custom" ? "block" : "none";
  $("sec-global").style.display =
    strat === "override" || strat === "prepend" || strat === "append"
      ? "block"
      : "none";
}

async function refresh() {
  const r = await send({ type: "dao-sp:get-cfg" });
  if (!r || !r.ok) {
    $("badge-state").textContent = "ERR";
    $("badge-state").className = "badge off";
    return;
  }
  const c = r.cfg;

  // header badge
  $("badge-state").textContent = c.enabled ? "ON" : "OFF";
  $("badge-state").className = "badge " + (c.enabled ? "on" : "off");

  // kv
  $("kv-daemon").textContent = c.daemonActive
    ? c.daemonActive.replace(/^https?:\/\//, "") +
      " · " +
      fmtTime(c.daemonLastSync)
    : "未通 (用本地配)";
  $("kv-silk").textContent = c.silkLoaded
    ? c.silkChars + " 字 ✓"
    : "未载 (dao 退 bypass)";

  // 等 page 答 state
  // 取活动标签 query
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    const t = tabs && tabs[0];
    if (!t || !t.url || !/devin\.ai/.test(t.url)) {
      $("kv-hooked").textContent = "非 devin.ai 标签";
      $("kv-injected").textContent = "--";
      return;
    }
    try {
      const resp = await new Promise((resolve) => {
        chrome.tabs.sendMessage(
          t.id,
          { type: "dao-sp:query" },
          { frameId: 0 },
          (r) => {
            void chrome.runtime.lastError;
            resolve(r);
          },
        );
      });
      if (resp && resp.state) {
        $("kv-hooked").textContent = resp.state.stats.hookedWsCount + " ws";
        $("kv-injected").textContent =
          resp.state.stats.injectedCount +
          " / " +
          resp.state.stats.interceptedCount;
      } else {
        $("kv-hooked").textContent = "未响应";
        $("kv-injected").textContent = "--";
      }
    } catch (e) {
      $("kv-hooked").textContent = "ERR";
    }
  });

  // strategy
  for (const r of document.querySelectorAll('input[name="strategy"]')) {
    r.checked = r.value === c.strategy;
  }
  updateSectionsByStrategy(c.strategy);

  // text
  $("ta-custom").value = c.customSp || "";
  $("ta-global").value = c.globalSp || "";

  // toggles
  $("cb-enabled").checked = !!c.enabled;
  $("cb-debug").checked = !!c.debug;

  // observe
  const ol = $("ol-observe");
  ol.innerHTML = "";
  const obs = (r.observe || []).slice(0, 5);
  if (obs.length === 0) {
    ol.innerHTML = '<li class="empty">无 · 未捕注入</li>';
  } else {
    for (const o of obs) {
      const li = document.createElement("li");
      const delta = (o.finalLen || 0) - (o.origLen || 0);
      li.innerHTML =
        '<span class="strat">' +
        (o.strategy || "?") +
        "</span>" +
        '<span class="delta">' +
        fmtBytes(o.origLen) +
        " → " +
        fmtBytes(o.finalLen) +
        " (+" +
        delta +
        "B · " +
        fmtTime(o.at) +
        ")</span>";
      ol.appendChild(li);
    }
  }
}

async function save() {
  const strat = (
    document.querySelector('input[name="strategy"]:checked') || {}
  ).value;
  const patch = {
    enabled: $("cb-enabled").checked,
    debug: $("cb-debug").checked,
    strategy: strat || "bypass",
    customSp: $("ta-custom").value,
    globalSp: $("ta-global").value,
  };
  const r = await send({ type: "dao-sp:set-cfg", patch });
  if (r && r.ok) {
    $("btn-save").textContent = "✓ 已保存";
    setTimeout(() => ($("btn-save").textContent = "保存 · 推全标签"), 1200);
  } else {
    $("btn-save").textContent = "✗ 失败";
  }
  setTimeout(refresh, 300);
}

async function syncNow() {
  $("btn-sync").textContent = "...同步中";
  await send({ type: "dao-sp:sync-now" });
  setTimeout(() => {
    $("btn-sync").textContent = "立即同步 daemon";
    refresh();
  }, 600);
}

document.addEventListener("DOMContentLoaded", () => {
  refresh();

  // strategy radio change → 即显/隐对应 textarea
  for (const r of document.querySelectorAll('input[name="strategy"]')) {
    r.addEventListener("change", () => {
      updateSectionsByStrategy(r.value);
    });
  }

  $("btn-save").addEventListener("click", save);
  $("btn-sync").addEventListener("click", syncNow);

  // 每 2s 自刷
  setInterval(refresh, 2000);
});
