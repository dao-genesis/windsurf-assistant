#!/usr/bin/env node
// Package each plugin under plugins/ into a .vsix in dist/ using @vscode/vsce.
// Usage:
//   node scripts/build-vsix.mjs            # build all plugins
//   node scripts/build-vsix.mjs rt-flow    # build a single plugin by folder name
import { execFileSync } from "node:child_process";
import { readdirSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pluginsDir = join(root, "plugins");
const distDir = join(root, "dist");
mkdirSync(distDir, { recursive: true });

const only = process.argv[2];
const plugins = readdirSync(pluginsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(pluginsDir, d.name, "package.json")))
  .map((d) => d.name)
  .filter((name) => !only || name === only);

if (plugins.length === 0) {
  console.error(only ? `no plugin named "${only}"` : "no plugins found");
  process.exit(1);
}

for (const name of plugins) {
  const dir = join(pluginsDir, name);
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf-8"));
  const out = join(distDir, `${pkg.name}-${pkg.version}.vsix`);
  console.log(`packaging ${pkg.name}@${pkg.version} -> ${out}`);
  execFileSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["--yes", "@vscode/vsce", "package", "--no-dependencies", "--allow-missing-repository", "-o", out],
    { cwd: dir, stdio: "inherit", shell: true }
  );
}
console.log("done");
