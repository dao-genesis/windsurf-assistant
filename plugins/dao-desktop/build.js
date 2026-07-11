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
  "dao-cascade/host-state.js"]) {
  execSync(`node --check ${JSON.stringify(path.join(here, f))}`);
}
console.log("✓ 语法自检通过");

const ver = JSON.parse(fs.readFileSync(path.join(here, "package.json"), "utf8")).version;
const out = path.join(here, `dao-desktop-${ver}.vsix`);
execSync(`npx --yes @vscode/vsce package -o ${JSON.stringify(out)} ` +
  "--allow-missing-repository --skip-license --allow-star-activation --no-dependencies",
  { cwd: here, stdio: "inherit" });
console.log("== 完成: " + out + " ==");
