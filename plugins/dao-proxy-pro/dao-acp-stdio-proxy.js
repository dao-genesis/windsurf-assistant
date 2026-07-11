#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
// dao-acp-stdio-proxy.js · 道 · ACP stdio 中人理 (印22 · 方B)
// ───────────────────────────────────────────────────────────────────────
// 用法: node dao-acp-stdio-proxy.js <devin.exe 路> [原 args...]
//
// 道: 四章「反者道之动也」—— 旧 HTTP MITM 死(Chat 不走 HTTP),
//      故立 stdio 中人: 透传 扩宿 ↔ devin.exe 的 ndJSON ACP 流。
//
// 职责(柔胜强 · 最小不扰):
//   1. spawn 真 devin.exe(承原 args 与 env);
//   2. 双向透传 stdin/stdout/stderr —— ndJSON ACP 字节级不改;
//   3. devin.exe 承 env(含 spawn-hook 注入的 HTTPS_PROXY → dao 由),
//      其 inference 经 dao 由 → 第三方(如 swe-1-6-fast → DeepSeek);
//   4. 子退则父退(码/信号透传) · 父退则子退 —— 无僵尸、无悬挂。
//
// ★ v9.9.346 · 捆绑 ACP 代理 api_server 本地锚定(健康门控自注入) · 根治「Connecting to server」
//   病(实证于 DESKTOP-MASTER): 捆绑 devin.exe(chisel)自持 windsurf_api_client, 绕开 LS 反代
//     直连 WINDSURF_API_SERVER_URL 取 GetCliTeamSettings 鉴权; 官方经系统 VPN 偶发 >3s →
//     "Team settings refresh timed out after 3000ms" → "Failed to authenticate bundled agent"
//     → 前端永卡「Connecting to server」。
//   解: 本中人在 spawn 前探本地反代 /origin/ping, 活则注入 WINDSURF_API_SERVER_URL=本地反代
//     + 把 127.0.0.1 纳入 NO_PROXY(本地反代走明文 h2c·须绕开系统 VPN 代理)→ chisel 即刻本地
//     成帧回真 TeamSettings/ModelConfigs · 无 3s 官方超时 · 与官方可达性彻底解耦。
//   分工: 若上游 spawn-hook(extension.js ≥v9.9.345)已锚 WINDSURF_API_SERVER_URL 则不覆写;
//     本中人乃「已装 v9.9.334 基座免 reload」之兜底锚点(spawn 每次重读本文件即生效)。
//   fail-safe: 仅反代 /ping 200 才注入(与 extension.js _proxyHealthy 同源门控); 探测失败/超时
//     则原样直连官方(反代挂时 chisel→本地口即刻 ECONNREFUSED 亦快于 3s 官方超时·chisel 自有
//     team_settings 磁盘缓存兜底)。五十二章「既得其母 以知其子」· 母=本地兜底 · 子=鉴权态。
//
// 道法自然: 透传即无为,无为而无不为。
// ═══════════════════════════════════════════════════════════════════════
"use strict";

const cp = require("child_process");
const http = require("http");

const argv = process.argv.slice(2);
if (argv.length < 1) {
  process.stderr.write("[dao-acp-stdio-proxy] missing devin.exe path\n");
  process.exit(2);
}

const target = argv[0];
const targetArgs = argv.slice(1);

// devin.exe 承之 env(可被本中人健康门控锚定 api_server)
const childEnv = Object.assign({}, process.env);
// 软编码 · 默认本地反代 invert 口 8937(与 LS --api_server_url 同锚点)
const PROXY_URL = process.env.DAO_ACP_API_URL || "http://127.0.0.1:8937";

// ── spawn 前缓冲 stdin(保序·字节不改) · 待健康探测毕再落子并回放 ──
const _pre = [];
let _child = null;
let _flushed = false;
let _stdinEnded = false;
process.stdin.on("data", (chunk) => {
  if (_child && _flushed) {
    try {
      _child.stdin.write(chunk);
    } catch (_) {
      /* noop */
    }
  } else {
    _pre.push(chunk);
  }
});
process.stdin.on("end", () => {
  _stdinEnded = true;
  if (_child && _flushed) {
    try {
      _child.stdin.end();
    } catch (_) {
      /* noop */
    }
  }
});

function launch() {
  let child;
  try {
    child = cp.spawn(target, targetArgs, {
      stdio: ["pipe", "pipe", "pipe"],
      env: childEnv, // 承 spawn-hook 注入的 HTTPS_PROXY/ACP_BACKEND + 本中人锚定的 api_server
      windowsHide: true,
    });
  } catch (err) {
    process.stderr.write(
      "[dao-acp-stdio-proxy] spawn failed: " + (err && err.message) + "\n",
    );
    process.exit(1);
  }
  _child = child;

  // 回放 spawn 前缓冲的 stdin, 尔后转入直写(保序)
  for (let i = 0; i < _pre.length; i++) {
    try {
      child.stdin.write(_pre[i]);
    } catch (_) {
      /* noop */
    }
  }
  _pre.length = 0;
  _flushed = true;
  if (_stdinEnded) {
    try {
      child.stdin.end();
    } catch (_) {
      /* noop */
    }
  }

  // ── 出向透传(字节级 · 不改 ndJSON) ──
  child.stdout.pipe(process.stdout);
  child.stderr.pipe(process.stderr);

  // ── EPIPE/destroyed 静默(对端先关属常态) ──
  const _silence = (s) => {
    if (s && typeof s.on === "function") s.on("error", () => {});
  };
  _silence(process.stdin);
  _silence(process.stdout);
  _silence(process.stderr);
  _silence(child.stdin);
  _silence(child.stdout);
  _silence(child.stderr);

  // ── 生命周期 ──
  child.on("error", (err) => {
    process.stderr.write(
      "[dao-acp-stdio-proxy] child error: " + (err && err.message) + "\n",
    );
    process.exit(1);
  });
  child.on("exit", (code, signal) => {
    if (signal) {
      try {
        process.kill(process.pid, signal);
        return;
      } catch (_) {
        /* fallthrough */
      }
    }
    process.exit(code == null ? 0 : code);
  });
  const _killChild = () => {
    try {
      child.kill();
    } catch (_) {
      /* noop */
    }
  };
  process.on("SIGTERM", _killChild);
  process.on("SIGINT", _killChild);
  process.on("SIGHUP", _killChild);
  process.on("exit", _killChild);
}

// ── 健康门控自注入(仅反代活时锚定 · 失败安全直连官方) ──
function anchorApiEnv() {
  if (childEnv.WINDSURF_API_SERVER_URL) return; // 上游 spawn-hook 已锚 · 不覆写
  childEnv.WINDSURF_API_SERVER_URL = PROXY_URL;
  const _np = childEnv.NO_PROXY || childEnv.no_proxy || "";
  if (!/127\.0\.0\.1/.test(_np)) {
    const _merged = _np
      ? _np + ",127.0.0.1,localhost,::1"
      : "127.0.0.1,localhost,::1";
    childEnv.NO_PROXY = _merged;
    childEnv.no_proxy = _merged;
  }
}

function probeThenLaunch() {
  // 上游已锚则无需探测, 直接落子
  if (childEnv.WINDSURF_API_SERVER_URL) {
    launch();
    return;
  }
  let done = false;
  const finish = (healthy) => {
    if (done) return;
    done = true;
    if (healthy) anchorApiEnv();
    launch();
  };
  try {
    const req = http.get(PROXY_URL + "/origin/ping", { timeout: 300 }, (res) => {
      const ok = res.statusCode === 200;
      res.resume();
      res.on("end", () => finish(ok));
      res.on("error", () => finish(ok));
    });
    req.on("timeout", () => {
      try {
        req.destroy();
      } catch (_) {
        /* noop */
      }
      finish(false);
    });
    req.on("error", () => finish(false));
  } catch (_) {
    finish(false);
  }
}

probeThenLaunch();
