#!/usr/bin/env node
/**
 * _web_static_audit.cjs — 印 63 · web/index.html 静态审计
 * ════════════════════════════════════════════════════════════════════════
 *   帛书·廿八: 「朴散则为器 · 圣人用则为官长 · 大制无割」
 *   帛书·廿四: 「自视不章, 自见者不明」 — 离尘绝外 · 一文件即一切
 *
 *   验证 web/index.html:
 *     [A] 文件存在 · 大小合理 · UTF-8 可读
 *     [B] 五 Tab 齐备 (setup/chat/api/deploy/docs)
 *     [C] 关键 DOM 元素就位 (cfg-endpoint, cfg-authkey, ex-curl, ...)
 *     [D] 软编码 owner/repo (location 探测函数 detectRepo 存在)
 *     [E] 反代凭据生成 (genAuthKey · genAuthKeyValue · sk-ws-proxy- 前缀)
 *     [F] chat 流附 Authorization (Bearer + cfg.authKey)
 *     [G] 零 CDN 依赖 · 无 <script src= 外部 / <link href= 外部 / @import
 *     [H] meta referrer=no-referrer (隐私 · 不泄密)
 *     [I] 道义印记 (帛书锚)
 *
 *   零 Node 依赖 · 仅 fs · 完全离线可跑
 */
"use strict";

const fs = require("fs");
const path = require("path");

const WEB = path.join(__dirname, "..", "web", "index.html");
let pass = 0;
let fail = 0;

function ok(cond, label) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    console.error(`  ✗ ${label}`);
  }
}

function main() {
  console.log("═══ web/index.html 静态审计 · 印 63 ═══\n");

  // ── [A] 文件 ────────────────────────────────────────────
  console.log("[A] 文件");
  ok(fs.existsSync(WEB), `存在: ${WEB}`);
  if (!fs.existsSync(WEB)) return finish();
  const html = fs.readFileSync(WEB, "utf8");
  ok(html.length > 5000, `大小 ${html.length}B > 5KB`);
  ok(html.length < 100000, `大小 ${html.length}B < 100KB (单文件克制)`);
  ok(html.startsWith("<!DOCTYPE html>"), "DOCTYPE 顶头");
  ok(/<html\s+lang="zh-CN"/.test(html), 'lang="zh-CN"');
  ok(/<meta\s+charset="UTF-8"/.test(html), "charset UTF-8");

  // ── [B] 五 Tab ──────────────────────────────────────────
  console.log("[B] 五 Tab 齐备");
  for (const tab of ["setup", "chat", "api", "deploy", "docs"]) {
    ok(
      new RegExp(`data-tab="${tab}"`).test(html),
      `tab[${tab}] · data-tab`,
    );
    ok(new RegExp(`id="sec-${tab}"`).test(html), `section[sec-${tab}]`);
  }

  // ── [C] 关键 DOM 元素 ───────────────────────────────────
  console.log("[C] 关键 DOM 元素");
  const ids = [
    "cfg-endpoint",
    "cfg-authkey",
    "cfg-apikey",
    "cfg-email",
    "cfg-owner",
    "cfg-repo",
    "cfg-branch",
    "chat-messages",
    "chat-input",
    "chat-model",
    "chat-system",
    "chat-temp",
    "chat-stream",
    "btn-send",
    "api-baseurl",
    "api-key",
    "api-models-list",
    "ex-curl",
    "ex-py",
    "ex-js",
    "oneline-script",
    "deploy-output",
    "manual-script",
    "host-info",
    "link-source",
  ];
  for (const id of ids) {
    ok(new RegExp(`id="${id}"`).test(html), `#${id}`);
  }

  // ── [D] 软编码 owner/repo ───────────────────────────────
  console.log("[D] 软编码 GitHub repo (location 探)");
  ok(/function\s+detectRepo\s*\(/.test(html), "detectRepo() 在");
  ok(/location\.hostname/.test(html), "读 location.hostname");
  ok(/location\.pathname/.test(html), "读 location.pathname");
  ok(
    /\.github\.io/i.test(html),
    "识 *.github.io 模式",
  );
  ok(
    /raw\.githubusercontent\.com/.test(html),
    "rawBase() 用 raw.githubusercontent.com",
  );

  // ── [E] 反代凭据生成 ────────────────────────────────────
  console.log("[E] 反代凭据 sk-ws-proxy-*");
  ok(/genAuthKey/.test(html), "genAuthKey 函数在");
  ok(/genAuthKeyValue/.test(html), "genAuthKeyValue 函数在");
  ok(/sk-ws-proxy-/.test(html), "前缀 sk-ws-proxy-");
  ok(/crypto\.getRandomValues/.test(html), "用 crypto.getRandomValues (强随机)");

  // ── [F] chat 附 Authorization ──────────────────────────
  console.log("[F] chat fetch 附 Authorization");
  ok(
    /['"]Authorization['"]\s*[:=]\s*['"]Bearer/.test(html) ||
      /['"]Authorization['"]\s*\]\s*=\s*['"]Bearer/.test(html),
    "Authorization: Bearer ... 在",
  );
  ok(/cfg\.authKey/.test(html), "用 cfg.authKey 注入");

  // ── [G] 零 CDN 依赖 ──────────────────────────────────
  console.log("[G] 零外部 CDN");
  // <script src="http..." 外部
  const externalScripts = [
    ...html.matchAll(/<script[^>]+src\s*=\s*["']([^"']+)["']/gi),
  ].filter((m) => /^https?:\/\//i.test(m[1]));
  ok(externalScripts.length === 0, `<script src=外部> 数=${externalScripts.length} (期 0)`);

  // <link href="http..." rel=stylesheet 外部
  const externalLinks = [
    ...html.matchAll(/<link[^>]+href\s*=\s*["']([^"']+)["']/gi),
  ].filter((m) => /^https?:\/\//i.test(m[1]) && /stylesheet|style/i.test(m[0]));
  ok(externalLinks.length === 0, `<link href=外部 stylesheet> 数=${externalLinks.length} (期 0)`);

  // CSS @import 外部
  const cssImports = [...html.matchAll(/@import\s+(?:url\()?["']?(https?:\/\/[^)"';\s]+)/gi)];
  ok(cssImports.length === 0, `@import 外部 数=${cssImports.length} (期 0)`);

  // <iframe src="http..." 外部
  const externalIframes = [
    ...html.matchAll(/<iframe[^>]+src\s*=\s*["']([^"']+)["']/gi),
  ].filter((m) => /^https?:\/\//i.test(m[1]));
  ok(externalIframes.length === 0, `<iframe src=外部> 数=${externalIframes.length} (期 0)`);

  // 不允 CDN host 链接
  const cdnHosts = [
    "cdn.jsdelivr.net",
    "unpkg.com",
    "cdnjs.cloudflare.com",
    "fonts.googleapis.com",
    "fonts.gstatic.com",
    "ajax.googleapis.com",
  ];
  for (const host of cdnHosts) {
    ok(!new RegExp(host.replace(/\./g, "\\.")).test(html), `不引 ${host}`);
  }

  // ── [H] meta referrer ────────────────────────────────
  console.log("[H] meta 隐私");
  ok(
    /<meta\s+name="referrer"[^>]+no-referrer/i.test(html),
    "meta referrer=no-referrer",
  );

  // ── [I] 道义 ────────────────────────────────────────
  console.log("[I] 道义印记");
  ok(/道法自然/.test(html), "锚 '道法自然'");
  ok(/无为而无不为/.test(html), "锚 '无为而无不为'");
  ok(/反者道之动/.test(html), "锚 '反者道之动'");

  // ── [J] 凭据三例 (curl / Python / JS) ───────────────
  console.log("[J] 凭据使用三例");
  ok(/curl\s+-N/.test(html) || /curl\s+-/.test(html), "curl 例在");
  ok(/from openai import OpenAI/.test(html), "Python OpenAI 例在");
  ok(/import OpenAI from "openai"/.test(html), "JS OpenAI 例在");

  // ── [K] 一令部署引用 raw.github URL 模板 ─────────────
  console.log("[K] 一令部署模板");
  ok(/devin-bootstrap\.sh/.test(html), "引 devin-bootstrap.sh");
  ok(/DAO_AUTH_KEY/.test(html), "环境变量 DAO_AUTH_KEY 在");
  ok(/DAO_API_KEY/.test(html), "环境变量 DAO_API_KEY 在");

  finish();
}

function finish() {
  console.log(`\n═══ web 静审完毕 · pass=${pass} fail=${fail} ═══`);
  if (fail > 0) {
    console.error("✗ 有失败项");
    process.exit(1);
  }
  console.log("✓ 全通 · 大制无割 · 一文件即一切");
  process.exit(0);
}

main();
