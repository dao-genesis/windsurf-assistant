#!/usr/bin/env node
// Build VSIX for a package
// Usage: node scripts/build-vsix.js [package]
//   package: wam | dao-proxy-min (default: wam)
const { execSync } = require("child_process");
const path = require("path");

const pkg = process.argv[2] || "wam";
const pkgDir = path.resolve(__dirname, "..", "packages", pkg);

console.log(`build-vsix: ${pkg} → ${pkgDir}`);
try {
  const out = execSync(
    "npx @vscode/vsce package --no-dependencies --allow-missing-repository",
    { cwd: pkgDir, encoding: "utf8", stdio: "pipe" },
  );
  console.log(out);
} catch (e) {
  console.error(e.stderr || e.message);
  process.exit(1);
}
