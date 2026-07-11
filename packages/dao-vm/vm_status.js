#!/usr/bin/env node
/**
 * vm_status.js · 列本地持有的 VM session 与隧道
 *
 *   「知者弗言，言者弗知。塞其闷，闭其门，和其光，同其尘。」
 *
 *   读 _state/active.json · 显示最近 N 个 session + URL · 不发任何网络请求
 *   主公一笔即得当前持有清单 · 不耗 ACU
 *
 * 用法:
 *   node vm_status.js          # 列最近 5 个
 *   node vm_status.js --json   # 原始 JSON
 *   node vm_status.js --check  # 顺带 HEAD 一下每个 URL · 看是否仍存活
 *
 * 依赖: Node 18+ (内置 fetch)
 */
"use strict";

const fs = require("fs");
const path = require("path");

const STATE_FILE = path.join(__dirname, "_state", "active.json");
const args = process.argv.slice(2);
const AS_JSON = args.includes("--json");
const DO_CHECK = args.includes("--check");

const C = {
  G: (s) => `\x1b[32m${s}\x1b[0m`,
  Y: (s) => `\x1b[33m${s}\x1b[0m`,
  R: (s) => `\x1b[31m${s}\x1b[0m`,
  B: (s) => `\x1b[36m${s}\x1b[0m`,
  BO: (s) => `\x1b[1m${s}\x1b[0m`,
  GR: (s) => `\x1b[90m${s}\x1b[0m`,
};

function readState() {
  if (!fs.existsSync(STATE_FILE)) return [];
  try {
    const arr = JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function ageMin(ts) {
  if (!ts) return "?";
  const diff = (Date.now() - new Date(ts).getTime()) / 60000;
  if (!Number.isFinite(diff)) return "?";
  if (diff < 1) return "刚刚";
  if (diff < 60) return `${diff.toFixed(0)} 分钟前`;
  const h = diff / 60;
  if (h < 24) return `${h.toFixed(1)} 小时前`;
  return `${(h / 24).toFixed(1)} 天前 (已超 24h TTL)`;
}

async function head(url) {
  if (!url) return null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(url, { method: "HEAD", signal: ctrl.signal });
    clearTimeout(t);
    return res.status;
  } catch (e) {
    return e.name === "AbortError" ? "TIMEOUT" : "ERROR";
  }
}

function liveSymbol(code) {
  if (code === null || code === undefined) return C.GR("—");
  if (code === "TIMEOUT" || code === "ERROR") return C.R("✗ " + code);
  if (code >= 200 && code < 400) return C.G("✓ " + code);
  if (code === 403 || code === 401) return C.Y("⚠ " + code + " (需 token)");
  return C.Y("? " + code);
}

async function main() {
  const records = readState();

  if (AS_JSON) {
    console.log(JSON.stringify(records, null, 2));
    return;
  }

  console.error("");
  console.error(C.B("════════════════════════════════════════════════════════════"));
  console.error(C.BO(C.B("  VM 持有清单 · 本地状态")));
  console.error(C.B("════════════════════════════════════════════════════════════"));
  console.error("");

  if (records.length === 0) {
    console.error(C.Y("  当前无持有 session"));
    console.error("");
    console.error(C.GR("  先起一笔: node vm_up.js"));
    console.error("");
    return;
  }

  console.error(C.GR(`  状态文件: ${path.relative(process.cwd(), STATE_FILE)}`));
  console.error(C.GR(`  记录数:   ${records.length}`));
  console.error("");

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const idx = i === 0 ? C.BO(C.G(`[#${i + 1} · 最新]`)) : C.GR(`[#${i + 1}]`);
    console.error(`${idx} ${C.GR(r.timestamp || "?")}  ${C.Y(ageMin(r.timestamp))}`);
    console.error(`  Session: ${C.G(r.sessionId || "-")}`);
    console.error(`  Model:   ${C.GR(r.model || "-")}`);

    const u = r.urls || {};
    const lines = [];
    if (u.vscode) lines.push(["VS Code", u.vscode]);
    if (u.desktop) lines.push(["Desktop", u.desktop]);
    if (u.shell) lines.push(["Shell", u.shell]);
    if (u.files) lines.push(["Files", u.files]);
    if (u.extra) lines.push(["Extra", u.extra]);
    if (u.ssh) {
      const tag = u.ssh.bore
        ? `ssh -p ${u.ssh.bore.split(":")[1]} ubuntu@${u.ssh.bore.split(":")[0]}` +
          (u.ssh.pass ? `  (密码: ${u.ssh.pass})` : "")
        : "(SSH 信息残缺)";
      lines.push(["SSH", tag]);
    }

    if (lines.length === 0) {
      console.error(C.Y("  (此记录无 URL)"));
    } else {
      // 异步活性检查
      const checks = DO_CHECK
        ? await Promise.all(
            lines.map(([_, v]) =>
              v && v.startsWith("http") ? head(v) : Promise.resolve(null),
            ),
          )
        : lines.map(() => null);

      for (let j = 0; j < lines.length; j++) {
        const [name, val] = lines[j];
        const live = DO_CHECK ? "  " + liveSymbol(checks[j]) : "";
        console.error(`  ${name.padEnd(8)} ${C.B(val)}${live}`);
      }
    }
    console.error("");
  }

  console.error(C.B("────────────────────────────────────────────────────────────"));
  console.error(C.GR("  · node vm_status.js --check   # HEAD 探测每个 URL"));
  console.error(C.GR("  · node vm_status.js --json    # 原始 JSON 输出"));
  console.error(C.GR("  · node vm_up.js               # 起新一笔"));
  console.error("");
}

main().catch((e) => {
  console.error(C.R("vm_status 错误: " + e.message));
  process.exit(1);
});
