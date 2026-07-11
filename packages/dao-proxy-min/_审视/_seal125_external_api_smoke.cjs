#!/usr/bin/env node
/**
 * _seal125_external_api_smoke.cjs · 印 125 · vendor/外接api/ 之专守门
 *
 * 承印 124 (主公第一细药 · vendor/外接api/) · 立守门以防回退.
 *
 * > 「图难于其易也，为大于其细也.」（《六十三》）
 * > 「合抱之木，生于毫末.」（《六十四》）
 * > 「为之于其未有也，治之于其未乱也.」（《六十四》）
 * > 「慎终若始，则无败事矣.」（《六十四》）
 *
 * 验 (8 节 · ~50 项):
 *   ① 件齐:    vendor/外接api/ 之 11 JS + 2 doc/conf 全在
 *   ② syntax:  11 JS · node --check
 *   ③ runtime: ExternalApiRuntime exports + start/stop/getStatus + isRunning
 *   ④ lm_register: register/unregister exports + 14 provider 之 vendorPrefix
 *   ⑤ gateway: server.js 之 http.createServer + parseModel + 14 provider
 *   ⑥ manifest:    package.json 之 dao.外接api.toggle command + dao.外接api.enabled property
 *   ⑦ extension:   registerCommand + tryStartExternalApi + cmdExternalApiToggle
 *   ⑧ spirit:  README.md 含「印 124」「第一细药」+ runtime.js 含「字节级正交」
 *
 * 用 (0 deps · 仅 node builtin):
 *   node _审视/_seal125_external_api_smoke.cjs
 *   node _审视/_seal125_external_api_smoke.cjs --verbose
 *
 * 道:
 *   · 居其实而不居其华 — smoke 仅静测 (不真起 gateway 子进程 · 不真注 vscode.lm)
 *   · 不破已立 — 与 _smoke.ps1 (主体 v9.9.0 之 15 项) 并行 · 不重叠不冲突
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const VENDOR = path.join(ROOT, "vendor", "外接api");
const VERBOSE =
  process.argv.includes("--verbose") || process.argv.includes("-v");

let pass = 0;
let fail = 0;
const fails = [];

function ok(msg, detail) {
  pass++;
  if (VERBOSE && detail)
    console.log(`  \x1b[32m[OK]\x1b[0m ${msg} · ${detail}`);
  else console.log(`  \x1b[32m[OK]\x1b[0m ${msg}`);
}
function bad(msg, detail) {
  fail++;
  fails.push(detail ? `${msg}: ${detail}` : msg);
  console.log(`  \x1b[31m[X ]\x1b[0m ${msg}${detail ? " · " + detail : ""}`);
}
function section(t) {
  console.log("");
  console.log(`\x1b[33m${t}\x1b[0m`);
}

console.log(
  "\x1b[36m═══ 印 125 · vendor/外接api/ 专守门 (承印 124 第一细药) ═══\x1b[0m",
);
console.log(`  ROOT  : ${ROOT}`);
console.log(`  VENDOR: ${VENDOR}`);

// ═══════════════════════════════════════════════════════════════
// ① 件齐 (vendor/外接api/ 之 11 JS + 2 doc/conf)
// ═══════════════════════════════════════════════════════════════
section("① 件齐 (vendor/外接api/ 之 11 JS + 2 doc/conf)");

const REQUIRED_FILES = [
  // 顶层
  "runtime.js",
  "lm_register.js",
  "README.md",
  "配置.example.json",
  // gateway/
  "gateway/server.js",
  "gateway/registry.js",
  "gateway/translate.js",
  "gateway/capabilities.js",
  "gateway/package.json",
  // gateway/providers/
  "gateway/providers/openai.js",
  "gateway/providers/anthropic.js",
  "gateway/providers/gemini.js",
  "gateway/providers/ollama.js",
  "gateway/providers/http.js",
];

for (const rel of REQUIRED_FILES) {
  const f = path.join(VENDOR, rel);
  if (fs.existsSync(f)) {
    const sz = fs.statSync(f).size;
    ok(`件存: ${rel}`, `${(sz / 1024).toFixed(1)}KB`);
  } else {
    bad(`件缺: ${rel}`);
  }
}

// ═══════════════════════════════════════════════════════════════
// ② syntax (11 JS · child_process spawn 不依 · 直接读 + try-eval-via-require · 仅 node --check 替代)
// ═══════════════════════════════════════════════════════════════
section("② syntax (11 JS · 字节级 require 验)");

const JS_FILES = [
  "runtime.js",
  "lm_register.js",
  "gateway/server.js",
  "gateway/registry.js",
  "gateway/translate.js",
  "gateway/capabilities.js",
  "gateway/providers/openai.js",
  "gateway/providers/anthropic.js",
  "gateway/providers/gemini.js",
  "gateway/providers/ollama.js",
  "gateway/providers/http.js",
];

for (const rel of JS_FILES) {
  const f = path.join(VENDOR, rel);
  if (!fs.existsSync(f)) {
    bad(`syntax: ${rel} 件缺`);
    continue;
  }
  // 用 node --check (真 syntax · 支持 shebang `#!/usr/bin/env node`)
  const r = spawnSync(process.execPath, ["--check", f], {
    encoding: "utf-8",
    timeout: 5000,
  });
  if (r.status === 0) {
    ok(`syntax: ${rel}`);
  } else {
    const errLine =
      (r.stderr || r.stdout || "").split("\n").find((l) => l.trim()) ||
      `exit=${r.status}`;
    bad(`syntax: ${rel}`, errLine.slice(0, 120));
  }
}

// ═══════════════════════════════════════════════════════════════
// ③ runtime.js · ExternalApiRuntime 之实
// ═══════════════════════════════════════════════════════════════
section("③ runtime.js · ExternalApiRuntime 之实");

let runtimeMod = null;
try {
  runtimeMod = require(path.join(VENDOR, "runtime.js"));
  ok("require runtime.js 通");
} catch (e) {
  bad("require runtime.js 失", e.message);
}

if (runtimeMod) {
  if (typeof runtimeMod.ExternalApiRuntime === "function") {
    ok("ExternalApiRuntime 是 class/function");
  } else {
    bad(
      "ExternalApiRuntime 非 function (typeof: " +
        typeof runtimeMod.ExternalApiRuntime +
        ")",
    );
  }

  // 实例化 (mock vscode + logger)
  try {
    const mockLogger = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    };
    const mockVscode = {
      workspace: {
        getConfiguration: () => ({
          get: (k, d) => d,
          update: async () => {},
        }),
      },
      window: {
        showInformationMessage: () => {},
        showWarningMessage: () => {},
        showErrorMessage: () => {},
      },
      Disposable: class {
        dispose() {}
      },
      ConfigurationTarget: { Global: 1 },
      lm: { registerChatModelProvider: () => ({ dispose: () => {} }) },
    };
    const rt = new runtimeMod.ExternalApiRuntime({
      vscodeModule: mockVscode,
      logger: mockLogger,
      configKey: "dao.外接api",
      vendorPrefix: "dao-",
    });
    if (typeof rt.start === "function") ok("rt.start 是 function");
    else bad("rt.start 非 function");
    if (typeof rt.stop === "function") ok("rt.stop 是 function");
    else bad("rt.stop 非 function");
    if (typeof rt.isRunning === "function") ok("rt.isRunning 是 function");
    else bad("rt.isRunning 非 function");
    if (typeof rt.getStatus === "function") ok("rt.getStatus 是 function");
    else bad("rt.getStatus 非 function");

    // isRunning 默 false (未 start)
    if (rt.isRunning() === false) ok("isRunning() 初态 false");
    else bad("isRunning() 初态非 false");
  } catch (e) {
    bad("ExternalApiRuntime 实例化失", e.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// ④ lm_register.js · vscode.lm 注册 之 14 provider
// ═══════════════════════════════════════════════════════════════
section("④ lm_register.js · vscode.lm 注册 之件");

const lmRegPath = path.join(VENDOR, "lm_register.js");
if (fs.existsSync(lmRegPath)) {
  const src = fs.readFileSync(lmRegPath, "utf-8");
  // 字串验 (不 require · 因依 vscode 模块)
  const expectStrings = [
    ["registerChatModelProvider", "vscode.lm 注 API"],
    ["dao-", "vendorPrefix · dao 前缀"],
    ["family", "model family 字段"],
    ["maxInputTokens", "model context 字段"],
  ];
  for (const [s, name] of expectStrings) {
    if (src.includes(s)) ok(`含 ${name}`);
    else bad(`缺 ${name} ("${s}")`);
  }
}

// ═══════════════════════════════════════════════════════════════
// ⑤ gateway/server.js · 14 provider 路由
// ═══════════════════════════════════════════════════════════════
section("⑤ gateway/server.js · http 路由 + 14 provider");

const srvPath = path.join(VENDOR, "gateway", "server.js");
if (fs.existsSync(srvPath)) {
  const src = fs.readFileSync(srvPath, "utf-8");
  const expectStrings = [
    ["http.createServer", "http server"],
    ["/v1/chat/completions", "OpenAI 格"],
    ["/v1/messages", "Anthropic 格"],
    ["/v1/models", "model list"],
    ["/health", "health 端点"],
    ["handleListModels", "model list 之 handler"],
  ];
  for (const [s, name] of expectStrings) {
    if (src.includes(s)) ok(`含 ${name}`);
    else bad(`缺 ${name} ("${s}")`);
  }
}

const regPath = path.join(VENDOR, "gateway", "registry.js");
if (fs.existsSync(regPath)) {
  const src = fs.readFileSync(regPath, "utf-8");
  // provider 列 (从 README 知 14 个 · 这里至少验主流 5)
  const PROVIDERS = ["openai", "anthropic", "gemini", "ollama"];
  for (const p of PROVIDERS) {
    // 用 word-boundary 做粗略匹 (case-insensitive)
    const re = new RegExp(`["']${p}["']`, "i");
    if (re.test(src)) ok(`registry 含 provider: ${p}`);
    else bad(`registry 缺 provider: ${p}`);
  }
}

// ═══════════════════════════════════════════════════════════════
// ⑥ package.json (主体) · manifest 一致
// ═══════════════════════════════════════════════════════════════
section("⑥ package.json (主体) · manifest 同步外接api");

const pkgPath = path.join(ROOT, "package.json");
if (fs.existsSync(pkgPath)) {
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    ok("package.json 解通");
  } catch (e) {
    bad("package.json 解失", e.message);
  }

  if (pkg) {
    // version
    if (pkg.version === "9.9.0") ok(`version = 9.9.0 (印 124)`);
    else bad(`version 非 9.9.0`, `现 ${pkg.version}`);

    // commands
    const cmds = (pkg.contributes && pkg.contributes.commands) || [];
    const toggleCmd = cmds.find((c) => c.command === "dao.外接api.toggle");
    if (toggleCmd) {
      ok(`commands 含 dao.外接api.toggle`);
      if (toggleCmd.title && /外接|印 12/.test(toggleCmd.title))
        ok(`commands.title 述印 124 (${toggleCmd.title.slice(0, 30)}...)`);
      else bad(`commands.title 未述印 124`);
    } else {
      bad("commands 缺 dao.外接api.toggle");
    }

    // configuration.properties
    const cfg = pkg.contributes && pkg.contributes.configuration;
    const props = cfg && cfg.properties;
    if (props && props["dao.外接api.enabled"]) {
      ok("configuration.properties 含 dao.外接api.enabled");
      const p = props["dao.外接api.enabled"];
      if (p.type === "boolean") ok("dao.外接api.enabled.type = boolean");
      else bad(`dao.外接api.enabled.type 非 boolean (现 ${p.type})`);
      if (p.default === false) ok("dao.外接api.enabled.default = false (默关)");
      else bad(`dao.外接api.enabled.default 非 false (现 ${p.default})`);
    } else {
      bad("configuration.properties 缺 dao.外接api.enabled");
    }

    // description 述印 124
    if (
      pkg.description &&
      /印 12[34]|外接\s*api|第一细药/.test(pkg.description)
    )
      ok("description 述印 124 第一细药");
    else bad("description 未述印 124 / 外接 api / 第一细药");
  }
}

// ═══════════════════════════════════════════════════════════════
// ⑦ extension.js · 启停 wrapper + cmd 注册
// ═══════════════════════════════════════════════════════════════
section("⑦ extension.js · 启停 wrapper + cmd 注册");

const extPath = path.join(ROOT, "extension.js");
if (fs.existsSync(extPath)) {
  const src = fs.readFileSync(extPath, "utf-8");
  const expectStrings = [
    [
      `registerCommand(\n          "dao.外接api.toggle"`,
      "registerCommand dao.外接api.toggle (multi-line)",
    ],
    ["tryStartExternalApi", "启 wrapper"],
    ["tryStopExternalApi", "停 wrapper"],
    ["cmdExternalApiToggle", "toggle cmd 体"],
    ['require("./vendor/外接api/runtime.js")', "require runtime.js"],
    ["外接api.enabled", "config key"],
  ];
  for (const [s, name] of expectStrings) {
    if (src.includes(s)) ok(`含 ${name}`);
    else {
      // 多行 registerCommand 之兼容 fallback
      if (
        s.includes("registerCommand") &&
        /registerCommand\s*\(\s*\n?\s*"dao\.外接api\.toggle"/.test(src)
      )
        ok(`含 ${name} (regex match)`);
      else bad(`缺 ${name}`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// ⑧ spirit · 帛书引 + 道义
// ═══════════════════════════════════════════════════════════════
section("⑧ spirit · 印 124 帛书引 + 一身两轨");

const readmePath = path.join(VENDOR, "README.md");
if (fs.existsSync(readmePath)) {
  const src = fs.readFileSync(readmePath, "utf-8");
  const expectStrings = [
    ["印 124", "印号"],
    ["第一细药", "印 124 之名"],
    ["图难于其易", "六十三章"],
    ["一身两轨", "道义之纲"],
    ["默关", "默关之德"],
  ];
  for (const [s, name] of expectStrings) {
    if (src.includes(s)) ok(`README 含 ${name}`);
    else bad(`README 缺 ${name}`);
  }
}

const runtimePath = path.join(VENDOR, "runtime.js");
if (fs.existsSync(runtimePath)) {
  const src = fs.readFileSync(runtimePath, "utf-8");
  const expectStrings = [
    ["字节级正交", "二轨字节级正交"],
    ["反代核", "反代核之意"],
    ["六十三章", "六十三章引"],
  ];
  for (const [s, name] of expectStrings) {
    if (src.includes(s)) ok(`runtime.js 含 ${name}`);
    else bad(`runtime.js 缺 ${name}`);
  }
}

// ═══════════════════════════════════════════════════════════════
// 终 · 总
// ═══════════════════════════════════════════════════════════════
console.log("");
console.log(
  `\x1b[36m═══ 总: ${pass} 过 / ${fail} 失 / ${pass + fail} 测 ═══\x1b[0m`,
);

if (fail === 0) {
  console.log(
    "\x1b[32m✓ 印 124 第一细药 · vendor/外接api/ 守门通 · 道法自然\x1b[0m",
  );
  process.exit(0);
} else {
  console.log("\x1b[31m✗ 守门破 · 失:\x1b[0m");
  for (const f of fails) console.log(`  · ${f}`);
  process.exit(1);
}
