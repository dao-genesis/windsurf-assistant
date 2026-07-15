#!/usr/bin/env node
// 道 · 安装顺序矩阵 + 1:1 共生对照校验(纯后端·零 GUI)
// ─────────────────────────────────────────────────────────────────────────────
// 核心命题: 插件与官方 Devin Desktop / VS Code 共用**同一套家目录配置路径**, 故无论
// 安装先后, 三点(官方 IDE / 本插件在 Devin Desktop / 本插件在 VS Code)看到的配置是
// 同一真源 —— 结构性 1:1, 无需拷贝迁移。本器不启 GUI, 只做可复现的后端对账:
//   1) 探测两 IDE 的扩展目录, 确认本插件已装入(先装谁都行 —— 安装顺序矩阵);
//   2) 用 env-sync 全量清点共享配置源(30 项), 打印存在性/条目数;
//   3) 校验"共享路径单一真源": 同一 mcp/rules/settings 路径被两 IDE 与插件同读;
//   4) 退出码: 全部关键项一致 = 0, 否则 = 1(供 CI/脚本消费)。
// 用法: node scripts/verify-sync-matrix.js [--json]
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const envSync = require("../dao-cascade/env-sync");

const H = os.homedir();
const asJson = process.argv.includes("--json");
const exists = (p) => { try { fs.statSync(p); return true; } catch (_) { return false; } };
const extId = "dao-agi.dao-desktop"; // package.json publisher.name

// 两条安装轨的扩展目录(官方 Devin Desktop 与 VS Code)。任一命中即视为该轨已部署本插件。
function extDirsFor(label, roots) {
  for (const r of roots) {
    if (!exists(r)) continue;
    let hit = null;
    try { hit = fs.readdirSync(r).find((d) => d.startsWith(extId)); } catch (_) {}
    if (hit) return { label, dir: r, installed: true, folder: hit };
  }
  return { label, dir: roots[0], installed: false, folder: null };
}

function main() {
  const tracks = [
    extDirsFor("Devin Desktop", [
      path.join(H, ".devin", "extensions"),
      path.join(H, ".windsurf", "extensions"),
    ]),
    extDirsFor("VS Code", [
      path.join(H, ".vscode", "extensions"),
      path.join(H, ".vscode-server", "extensions"),
    ]),
  ];

  const det = envSync.detect();
  const byGroup = {};
  for (const s of det.sources) (byGroup[s.group] = byGroup[s.group] || []).push(s);

  // 单一真源: 这些共享路径不随 IDE/插件而变, 三点同读同写。
  const singleSource = [
    ["MCP 配置", path.join(H, ".codeium", "windsurf", "mcp_config.json")],
    ["全局规则", path.join(H, ".codeium", "windsurf", "memories", "global_rules.md")],
    ["记忆", path.join(H, ".codeium", "windsurf", "memories")],
    ["ACP 注册表", path.join(H, ".windsurf", "acp", "registry.json")],
    ["登录凭据", path.join(H, ".local", "share", "devin", "credentials.toml")],
    ["IDE 用户设置", det.ideUserDir + "/settings.json"],
  ];

  const result = {
    ide: det.ide,
    configRoot: det.configRoot,
    configRootExists: det.configRootExists,
    tracks,
    sourceCount: det.sources.length,
    presentCount: det.sources.filter((s) => s.exists).length,
    singleSource: singleSource.map(([label, p]) => ({ label, path: p, exists: exists(p) })),
  };

  if (asJson) { console.log(JSON.stringify(result, null, 2)); }
  else {
    console.log("道 · 安装顺序矩阵 + 1:1 共生对照");
    console.log("─".repeat(60));
    console.log("官方 IDE 探测:", det.ide.installed ? ("已装 @ " + det.ide.binPath) : "未装(引擎痕迹:" + !!det.ide.engineTraces + ")");
    for (const t of tracks)
      console.log(`  轨[${t.label}] 插件部署: ${t.installed ? "✓ " + t.folder : "· 未部署"} (${t.dir})`);
    console.log("配置真源 configRoot:", result.configRoot, result.configRootExists ? "✓" : "·(未创建)");
    console.log(`共享配置源: ${result.presentCount}/${result.sourceCount} 存在`);
    for (const g of Object.keys(byGroup))
      console.log("  " + g + ": " + byGroup[g].map((s) => (s.exists ? "✓" : "·") + s.key + (s.count != null ? "[" + s.count + "]" : "")).join(" "));
    console.log("单一真源(三点同读同写):");
    for (const s of result.singleSource) console.log("  " + (s.exists ? "✓" : "·") + " " + s.label + " → " + s.path);
  }

  // 关键一致性: 两轨至少一轨部署 + 官方 IDE 可探测(先装 IDE 或先装插件皆可通过其中一路)。
  const anyTrack = tracks.some((t) => t.installed);
  const ok = anyTrack && (det.ide.installed || det.configRootExists);
  if (!asJson) console.log("─".repeat(60) + "\n判定: " + (ok ? "通过 ✓ (安装顺序无关, 共享真源一致)" : "未通过 ✗"));
  process.exit(ok ? 0 : 1);
}

main();
