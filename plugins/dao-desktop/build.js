#!/usr/bin/env node
// dao-desktop 构建: 官方本体折入 + VSIX 打包。
// ─────────────────────────────────────────────────────────────────────────────
// 用法:
//   node build.js                     # 仅打包(共生模式 VSIX: 无官方本体, 靠宿主/host-discover)
//   node build.js --core <vsix|dir>   # 把官方 codeium.windsurf VSIX(或已解包目录)折入
//                                     # engines/windsurf/ 后再打包(全量单一 VSIX)
//   DAO_CORE_VSIX=<path> node build.js  # 同 --core
//
// 官方本体获取: 从已装 Windsurf/Devin IDE 的扩展目录取
//   (如 ~/.vscode/extensions/… 或 IDE 安装目录 extensions/windsurf), 或官方渠道下载 VSIX。
// 本仓不入库官方本体(体积大且随官方更新), engines/ 为构建期产物。
"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const here = __dirname;
const args = process.argv.slice(2);
const coreIdx = args.indexOf("--core");
const coreSrc = coreIdx >= 0 ? args[coreIdx + 1] : process.env.DAO_CORE_VSIX || "";
const enginesDir = path.join(here, "engines", "windsurf");

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === ".git") continue;
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    e.isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
  }
}

// ① 官方本体折入(可选)。
if (coreSrc) {
  if (!fs.existsSync(coreSrc)) { console.error("✗ --core 路径不存在: " + coreSrc); process.exit(1); }
  fs.rmSync(path.join(here, "engines"), { recursive: true, force: true });
  if (fs.statSync(coreSrc).isDirectory()) {
    // 已解包目录: 兼容传 VSIX 解包根(含 extension/) 或直接传 extension/ 内容。
    const inner = fs.existsSync(path.join(coreSrc, "extension", "package.json"))
      ? path.join(coreSrc, "extension") : coreSrc;
    copyDir(inner, enginesDir);
  } else {
    const tmp = fs.mkdtempSync(path.join(require("os").tmpdir(), "dao-core-"));
    execSync(`unzip -q ${JSON.stringify(coreSrc)} -d ${JSON.stringify(tmp)}`);
    copyDir(path.join(tmp, "extension"), enginesDir);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  const dist = path.join(enginesDir, "dist", "extension.js");
  if (!fs.existsSync(dist)) { console.error("✗ 折入后缺 engines/windsurf/dist/extension.js"); process.exit(1); }
  console.log("✓ 官方本体折入 engines/windsurf/");
} else {
  console.log("· 未给 --core, 打共生模式 VSIX(装在带官方本体的 IDE 里即全功能)");
}

// ①′ 归一本体折入(拼积木·零重写): 从 devin-remote 原样装配 dao-one(二合一+Proxy Pro
//    +rt-flow+dao-bridge)进 vendor-one/ —— 不生产水, 只搬运。源本仍在 devin-remote,
//    此处仅调用其官方装配器(core/dao-one/build.js)再整目录拷入, 并把 dao-one 的
//    contributes 原样并入打包 manifest(重复 id 跳过)。无 devin-remote 时优雅跳过。
function findRemoteRoot() {
  const cands = [process.env.DAO_REMOTE_ROOT,
    path.join(here, "..", "..", "..", "devin-remote"),
    path.join(require("os").homedir(), "repos", "devin-remote")].filter(Boolean);
  for (const c of cands) if (fs.existsSync(path.join(c, "core", "dao-one", "build.js"))) return c;
  return null;
}
let oneContrib = null;
const remoteRoot = process.env.DAO_GUIYI === "0" ? null : findRemoteRoot();
if (remoteRoot) {
  const oneDir = path.join(remoteRoot, "core", "dao-one");
  try { require(path.join(oneDir, "node_modules", "sucrase", "package.json")); }
  catch (_) { execSync("npm i --no-save sucrase", { cwd: oneDir, stdio: "inherit" }); }
  execSync("node build.js", { cwd: oneDir, stdio: "inherit" });
  const dst = path.join(here, "vendor-one");
  fs.rmSync(dst, { recursive: true, force: true });
  fs.mkdirSync(dst, { recursive: true });
  fs.copyFileSync(path.join(oneDir, "extension.js"), path.join(dst, "extension.js"));
  for (const d of ["vendor-vsix", "vendor-proxy", "vendor-flow", "vendor-bridge", "media"]) {
    const s = path.join(oneDir, d);
    if (fs.existsSync(s)) copyDir(s, path.join(dst, d));
  }
  // vendor-vsix 运行期需 ws(dao-one 随包铁律) → 折入 vendor-one/node_modules/ws(Node 就近解析)。
  const wsSrc = path.join(oneDir, "node_modules", "ws");
  if (fs.existsSync(wsSrc)) copyDir(wsSrc, path.join(dst, "node_modules", "ws"));
  const onePkg = JSON.parse(fs.readFileSync(path.join(oneDir, "package.json"), "utf8"));
  oneContrib = onePkg.contributes || {};
  fs.writeFileSync(path.join(dst, "one-manifest.json"),
    JSON.stringify({ name: onePkg.name, version: onePkg.version, assembledAt: new Date().toISOString() }, null, 2));
  console.log("✓ 归一本体折入 vendor-one/ (dao-one@" + onePkg.version + " 原样装配)");
} else {
  console.log("· 未检出 devin-remote(DAO_GUIYI=0 或无仓) · 跳过归一折入(共生模式)");
}

// ② 图标兜底(缺则生成 1x1 占位, 正式图标放 media/icon.png)。
const icon = path.join(here, "media", "icon.png");
if (!fs.existsSync(icon)) {
  fs.mkdirSync(path.dirname(icon), { recursive: true });
  fs.writeFileSync(icon, Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64"));
  console.log("· 生成占位图标 media/icon.png");
}

// ③ 语法自检 + 打包。
for (const f of ["extension.js", "windsurf-shim.js",
  "dao-cascade/panel.js", "dao-cascade/acp-client.js", "dao-cascade/acp-wss.js",
  "dao-cascade/devin-provision.js", "dao-cascade/host-discover.js", "dao-cascade/ls-bridge.js",
  "dao-cascade/host-state.js", "dao-cascade/backup.js"]) {
  execSync(`node --check ${JSON.stringify(path.join(here, f))}`);
}
console.log("✓ 语法自检通过");

// ④ 打包: 折入归一时把 dao-one contributes 原样并入 manifest(打包期临时合并·重复 id 跳过·打完还原)。
const pkgPath = path.join(here, "package.json");
const pkgRaw = fs.readFileSync(pkgPath, "utf8");
const pkg = JSON.parse(pkgRaw);
const ver = pkg.version;
if (oneContrib) {
  const c = pkg.contributes = pkg.contributes || {};
  const mergeArr = (mine, theirs, idOf) => {
    const seen = new Set((mine || []).map(idOf));
    return (mine || []).concat((theirs || []).filter((x) => !seen.has(idOf(x))));
  };
  c.viewsContainers = c.viewsContainers || {};
  for (const k of Object.keys(oneContrib.viewsContainers || {}))
    c.viewsContainers[k] = mergeArr(c.viewsContainers[k], oneContrib.viewsContainers[k], (x) => x.id);
  c.views = c.views || {};
  for (const k of Object.keys(oneContrib.views || {}))
    c.views[k] = mergeArr(c.views[k], oneContrib.views[k], (x) => x.id);
  c.commands = mergeArr(c.commands, oneContrib.commands, (x) => x.command);
  c.keybindings = mergeArr(c.keybindings, oneContrib.keybindings, (x) => (x.command || "") + "|" + (x.key || ""));
  c.menus = c.menus || {};
  for (const k of Object.keys(oneContrib.menus || {}))
    c.menus[k] = mergeArr(c.menus[k], oneContrib.menus[k], (x) => JSON.stringify(x));
  if (oneContrib.configuration && oneContrib.configuration.properties) {
    c.configuration = c.configuration || { title: pkg.displayName || pkg.name, properties: {} };
    c.configuration.properties = Object.assign({}, oneContrib.configuration.properties, c.configuration.properties);
  }
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  console.log("✓ dao-one contributes 已并入打包 manifest(临时)");
}
const out = path.join(here, `dao-desktop-${ver}.vsix`);
try {
  execSync(`npx --yes @vscode/vsce package -o ${JSON.stringify(out)} ` +
    "--allow-missing-repository --skip-license --allow-star-activation --no-dependencies",
    { cwd: here, stdio: "inherit" });
} finally {
  if (oneContrib) { fs.writeFileSync(pkgPath, pkgRaw); console.log("✓ package.json 已还原(源洁)"); }
}
console.log("== 完成: " + out + " ==");
