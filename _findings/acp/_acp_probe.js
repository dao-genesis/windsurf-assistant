#!/usr/bin/env node
/**
 * _acp_probe.js — Devin ACP stdio 实证探针 · 印 80
 *
 * 道义：仅静态 spawn `devin.exe acp` 并发标准 JSON-RPC initialize
 *       —— 不偷 token，不爬云，不修二进制
 *       —— 落 _findings/devin_acp_handshake.jsonl 供归一
 *
 * 触发：  node _acp_probe.js  [DEVIN_EXE_PATH]
 * 默认：  e:\Windsurf\resources\app\extensions\windsurf\devin\bin\devin.exe
 */
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const DEVIN =
  process.argv[2] ||
  "E:\\Windsurf\\resources\\app\\extensions\\windsurf\\devin\\bin\\devin.exe";

const OUT_DIR = path.join(__dirname, "..", "_findings");
try {
  fs.mkdirSync(OUT_DIR, { recursive: true });
} catch {}
const JSONL = path.join(OUT_DIR, "devin_acp_handshake.jsonl");
const log = (rec) =>
  fs.appendFileSync(JSONL, JSON.stringify(rec) + "\n", "utf8");

function send(p, obj) {
  const line = JSON.stringify(obj) + "\n";
  p.stdin.write(line);
  log({ t: Date.now(), dir: "->", line: obj });
}

// 清空旧 jsonl
try {
  fs.writeFileSync(JSONL, "");
} catch {}

console.error(`[acp-probe] spawn: ${DEVIN} acp`);
const p = spawn(DEVIN, ["acp"], { stdio: ["pipe", "pipe", "pipe"] });

let stdoutBuf = "";
let stderrBuf = "";

p.stdout.on("data", (b) => {
  const s = b.toString("utf8");
  stdoutBuf += s;
  // 行分隔与 LSP-style Content-Length 双尝试
  // 先 line-delimited
  let idx;
  while ((idx = stdoutBuf.indexOf("\n")) >= 0) {
    const line = stdoutBuf.slice(0, idx).trim();
    stdoutBuf = stdoutBuf.slice(idx + 1);
    if (!line) continue;
    let parsed = null;
    try {
      parsed = JSON.parse(line);
    } catch {}
    log({ t: Date.now(), dir: "<-", raw: line, parsed });
    if (parsed) console.error(`[acp-probe] <- method=${parsed.method || "(resp)"} id=${parsed.id}`);
  }
});

p.stderr.on("data", (b) => {
  const s = b.toString("utf8");
  stderrBuf += s;
  log({ t: Date.now(), dir: "stderr", raw: s });
});

p.on("close", (code) => {
  log({ t: Date.now(), dir: "exit", code, stderrFinal: stderrBuf.slice(-2000) });
  console.error(`[acp-probe] exited code=${code}`);
  console.error(`[acp-probe] 落: ${JSONL}`);
});

// initialize · ACP 标准（JSON-RPC 2.0）
send(p, {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: 1,
    clientCapabilities: {
      fs: { readTextFile: true, writeTextFile: true },
      terminal: true,
    },
  },
});

// 给 1.5s 让其响应，然后 authenticate 试探（不传真实 method 之意，仅探 error）
setTimeout(() => {
  send(p, { jsonrpc: "2.0", id: 2, method: "authenticate", params: {} });
}, 800);

// 再 1s 探一个不存在 method
setTimeout(() => {
  send(p, { jsonrpc: "2.0", id: 3, method: "_meta/list", params: {} });
}, 1600);

// 3.5s 后退出
setTimeout(() => {
  try {
    p.stdin.end();
  } catch {}
  try {
    p.kill();
  } catch {}
}, 3500);
