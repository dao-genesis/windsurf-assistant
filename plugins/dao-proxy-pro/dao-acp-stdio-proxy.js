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
// 道法自然: 透传即无为,无为而无不为。
// ═══════════════════════════════════════════════════════════════════════
"use strict";

const cp = require("child_process");

const argv = process.argv.slice(2);
if (argv.length < 1) {
  process.stderr.write("[dao-acp-stdio-proxy] missing devin.exe path\n");
  process.exit(2);
}

const target = argv[0];
const targetArgs = argv.slice(1);

let child;
try {
  child = cp.spawn(target, targetArgs, {
    stdio: ["pipe", "pipe", "pipe"],
    env: process.env, // 承 spawn-hook 注入的 HTTPS_PROXY/ACP_BACKEND
    windowsHide: true,
  });
} catch (err) {
  process.stderr.write(
    "[dao-acp-stdio-proxy] spawn failed: " + (err && err.message) + "\n",
  );
  process.exit(1);
}

// ── 双向透传(字节级 · 不改 ndJSON) ──
process.stdin.pipe(child.stdin);
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
