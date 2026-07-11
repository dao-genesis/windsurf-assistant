// ═══════════════════════════════════════════════════════════════════════
// _seal90_smoke · 印 90 · 网页端注入器守门
// ═══════════════════════════════════════════════════════════════════════
//
// 帛书·四十:   反者道之动 · 弱者道之用 · 天下之物生于有 · 有生于无
// 帛书·四十三: 天下之至柔 · 驰骋于天下之致坚 · 无有入于无间
// 帛书·七十八: 天下莫柔弱于水 · 而攻坚强者莫之能胜也 · 以其无以易之也
//
// 守:
//   A · 件存在 + 大小区间 (extension 8 件 + userscript 1 件 + icons 3 件)
//   B · manifest.json 合法 JSON · MV3 字段全 · permissions 合理
//   C · inject.js 印 89 TAO_HEADER (无 Cascade · 含 思想风格)
//   D · userscript TAO_HEADER 与 inject.js 同版本
//   E · inject.js + content.js + sw.js + popup.js syntax OK
//   F · README.md 存 + 含印 90 标
// ═══════════════════════════════════════════════════════════════════════
"use strict";

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const REPO = path.resolve(__dirname, "..");
let pass = 0,
  fail = 0;

function ok(cond, msg) {
  if (cond) {
    console.log("  ✓ " + msg);
    pass++;
  } else {
    console.log("  ✗ " + msg);
    fail++;
  }
}

function exists(rel) {
  return fs.existsSync(path.join(REPO, rel));
}
function size(rel) {
  return fs.statSync(path.join(REPO, rel)).size;
}
function read(rel) {
  return fs.readFileSync(path.join(REPO, rel), "utf-8");
}
function nodeSyntax(rel) {
  try {
    execFileSync(process.execPath, ["--check", path.join(REPO, rel)], {
      stdio: "pipe",
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, err: String(e && e.message) };
  }
}

console.log("═══ _seal90_smoke · 印 90 · 网页端注入器守门 ═══\n");

// ─── [A] 件存在 + 大小区间 ──────────────────────────────────────────
console.log("[A] 12+ 件 (extension 8 + userscript 1 + icons 3 + README)");

const EXT_FILES = [
  ["packages/dao-injector/extension/manifest.json", 1000, 2000],
  ["packages/dao-injector/extension/inject.js", 12000, 17000],
  ["packages/dao-injector/extension/content.js", 4000, 6500],
  ["packages/dao-injector/extension/sw.js", 8000, 13000],
  ["packages/dao-injector/extension/popup.html", 2000, 4000],
  ["packages/dao-injector/extension/popup.js", 4000, 7000],
  ["packages/dao-injector/extension/popup.css", 3000, 6000],
  ["packages/dao-injector/extension/icons/icon-16.png", 200, 1500],
  ["packages/dao-injector/extension/icons/icon-48.png", 800, 3000],
  ["packages/dao-injector/extension/icons/icon-128.png", 2000, 6000],
  [
    "packages/dao-injector/userscript/dao-devin-sp-inject.user.js",
    14000,
    21000,
  ],
  ["packages/dao-injector/README.md", 3000, 12000],
];

for (const [rel, min, max] of EXT_FILES) {
  ok(exists(rel), rel + " 存在");
  if (exists(rel)) {
    const sz = size(rel);
    ok(
      sz >= min && sz <= max,
      rel + " 大小 " + sz + " (期 " + min + "-" + max + ")",
    );
  }
}

// ─── [B] manifest.json 合法 JSON + MV3 字段 ─────────────────────────
console.log("\n[B] manifest.json · MV3 合法");

let manifest = null;
try {
  manifest = JSON.parse(read("packages/dao-injector/extension/manifest.json"));
  ok(true, "manifest.json 合法 JSON");
} catch (e) {
  ok(false, "manifest.json JSON 解析失败: " + e.message);
}

if (manifest) {
  ok(manifest.manifest_version === 3, "manifest_version=3 (MV3)");
  ok(
    typeof manifest.name === "string" && manifest.name.length > 0,
    "name 非空: " + manifest.name,
  );
  ok(typeof manifest.version === "string", "version 串");
  ok(Array.isArray(manifest.content_scripts), "content_scripts 数组");
  ok(
    manifest.content_scripts.some(
      (cs) =>
        Array.isArray(cs.matches) &&
        cs.matches.some((m) => /devin\.ai/i.test(m)),
    ),
    "content_scripts.matches 含 devin.ai",
  );
  ok(
    typeof manifest.background === "object" &&
      typeof manifest.background.service_worker === "string",
    "background.service_worker 在",
  );
  ok(
    Array.isArray(manifest.web_accessible_resources),
    "web_accessible_resources 数组",
  );
  ok(
    manifest.web_accessible_resources.some(
      (war) =>
        Array.isArray(war.resources) && war.resources.includes("inject.js"),
    ),
    "web_accessible_resources 含 inject.js (page world 注入用)",
  );
  ok(typeof manifest.action === "object", "action (popup) 在");
}

// ─── [C] inject.js 印 89 TAO_HEADER ────────────────────────────────
console.log("\n[C] inject.js · 印 89 反 alignment 之反");

const injectJs = read("packages/dao-injector/extension/inject.js");
ok(/印 89/.test(injectJs), "inject.js 含 '印 89' 印记");
ok(
  /TAO_HEADER\s*=\s*\n?\s*"请以下文《老子》/.test(injectJs) ||
    injectJs.includes('"请以下文《老子》(帛书本) 之思想风格'),
  "inject.js TAO_HEADER 印 89 新版 (请以下文《老子》之思想风格)",
);
ok(
  !/TAO_HEADER\s*=\s*"You are Cascade/.test(injectJs),
  "inject.js TAO_HEADER 不含 印 88 旧版 'You are Cascade'",
);
ok(/思想风格/.test(injectJs), "inject.js 含 '思想风格' (印 89 关键)");
ok(/INVERTED_PREFIX/.test(injectJs), "inject.js 含 INVERTED_PREFIX (重注防护)");
ok(
  /WebSocket\.prototype\.send/.test(injectJs),
  "inject.js hook WebSocket.prototype.send (印 90 核心)",
);
ok(/session\/prompt/.test(injectJs), "inject.js 拦 session/prompt JSON-RPC");

// ─── [D] userscript TAO_HEADER 与 inject.js 同版本 ──────────────────
console.log("\n[D] userscript · 与 extension 同版本");

const userJs = read(
  "packages/dao-injector/userscript/dao-devin-sp-inject.user.js",
);
ok(/思想风格/.test(userJs), "userscript 含 '思想风格' (印 89 同版)");
ok(
  !/TAO_HEADER\s*=\s*"You are Cascade/.test(userJs),
  "userscript 不含 'You are Cascade' (印 88 旧版被汰)",
);
ok(
  /INVERTED_PREFIX\s*=\s*"请以下文《老子》"/.test(userJs),
  "userscript INVERTED_PREFIX 印 89",
);
ok(
  /WebSocket\.prototype\.send/.test(userJs) ||
    /W\.WebSocket\s*=/.test(userJs) ||
    /extends\s+OrigWS/.test(userJs) ||
    /__DAO_SP_HOOKED__/.test(userJs),
  "userscript hook WebSocket (任一: prototype.send · W.WebSocket= · extends OrigWS · __DAO_SP_HOOKED__)",
);
ok(
  /UserScript/.test(userJs) || /==UserScript==/.test(userJs),
  "userscript 头部声明 ==UserScript==",
);

// ─── [E] syntax 检 ─────────────────────────────────────────────────
console.log("\n[E] 4 件 .js syntax OK");

for (const rel of [
  "packages/dao-injector/extension/inject.js",
  "packages/dao-injector/extension/content.js",
  "packages/dao-injector/extension/sw.js",
  "packages/dao-injector/extension/popup.js",
]) {
  const r = nodeSyntax(rel);
  ok(r.ok, rel + " syntax OK" + (r.ok ? "" : " · " + r.err));
}

// ─── [F] README 含印 90 + 印 89 ──────────────────────────────────
console.log("\n[F] README · 印 90 印记");

const readmeInjector = read("packages/dao-injector/README.md");
ok(/印 90/.test(readmeInjector), "README 含 '印 90' 印记");
ok(/印 89/.test(readmeInjector), "README 含 '印 89' 之承");
ok(/dao-injector/.test(readmeInjector), "README 含 'dao-injector' 名");
ok(/wss:\/\/app\.devin\.ai/.test(readmeInjector), "README 含 wss 真路");

// ─── 总览 ───────────────────────────────────────────────────────────
console.log("\n═══ _seal90_smoke 总览 ═══");
console.log("  通过: " + pass);
console.log("  失败: " + fail);
console.log("");
if (fail === 0) {
  console.log("✓ 印 90 网页端注入器守门全通 · 道法自然 · 无为而无不为");
  console.log(
    "  帛书·七十八: 天下莫柔弱于水 · 而攻坚强者莫之能胜也 · 以其无以易之也",
  );
  process.exit(0);
} else {
  console.log("✗ 印 90 守门有败 · 须修");
  process.exit(1);
}
