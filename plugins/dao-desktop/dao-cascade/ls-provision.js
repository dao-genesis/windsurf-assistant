// 道 · LS 自持层(R149) —— 纯 VS Code 宿主(无 Devin Desktop/Windsurf 运行)时,
// 插件自起官方 language_server, 令全部 LS 直连面(会话/MCP/设置/账号/浏览器数据)零宿主可用。
// ─────────────────────────────────────────────────────────────────────────────
// 反者道之动: 不复刻 LS, 而是把官方二进制接管进插件自身生命周期。
//   · 二进制解析: env DAO_LS_BIN → 本机官方安装(Devin Desktop/Windsurf 各布局) → globalStorage 缓存
//   · 极简 extension-server: 本模块起 HTTP 端点应答 ExtensionServerService(LS 启动即回连),
//     全部方法回 {}(JSON) —— 实测 LS 容忍并继续服务(NotifyMcpStateChanged/GetNativeValues/
//     LanguageServerStarted/UpdateCascadeTrajectorySummaries 均如此)。
//   · 端口发现: 不解 proto 回调, 直接扫自持子进程监听端口逐个探活(与 host-discover 同思想)。
//   · CSRF: 自生成 UUID 经 env WINDSURF_CSRF_TOKEN 注入子进程(与官方注入方式同源)。
//   · 实测(本 VM headless): spawn → 5s 内出端口 → GetUserStatus 200。
"use strict";

const http = require("http");
const { spawn, execSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

function exeName() { return process.platform === "win32" ? "language_server_windows_x64.exe" : (process.platform === "darwin" ? (process.arch === "arm64" ? "language_server_macos_arm" : "language_server_macos_x64") : "language_server_linux_x64"); }

// 官方安装布局候选(Devin Desktop / Windsurf, Linux tar/deb · macOS app · Windows)。
function resolveBin(storageDir) {
  const cands = [];
  if (process.env.DAO_LS_BIN) cands.push(process.env.DAO_LS_BIN);
  const home = os.homedir();
  const exe = exeName();
  const suf = path.join("resources", "app", "extensions", "windsurf", "bin", exe);
  cands.push(
    path.join(home, "devin-desktop", "Devin", suf),
    path.join(home, ".local", "share", "devin", suf),
    "/opt/Devin/" + suf, "/opt/Windsurf/" + suf,
    "/usr/share/devin/" + suf, "/usr/share/windsurf/" + suf,
    path.join(home, "AppData", "Local", "Programs", "Devin", suf),
    path.join(home, "AppData", "Local", "Programs", "Windsurf", suf),
    "/Applications/Devin.app/Contents/Resources/app/extensions/windsurf/bin/" + exe,
    "/Applications/Windsurf.app/Contents/Resources/app/extensions/windsurf/bin/" + exe,
  );
  if (storageDir) cands.push(path.join(storageDir, "ls-bin", exe));
  for (const c of cands) { try { if (c && fs.existsSync(c)) return path.resolve(c); } catch (_) {} }
  return null;
}

// 极简 extension-server: LS 回连的全部 ExtensionServerService 方法一律回 {}。
function startStubExtServer() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      req.on("data", () => {});
      req.on("end", () => { res.setHeader("content-type", "application/json"); res.end("{}"); });
    });
    srv.listen(0, "127.0.0.1", () => resolve(srv));
  });
}

// 子进程监听端口(Linux: /proc/net/tcp 反查 inode; 兜底 ss)。
function listenPortsOf(pid) {
  try {
    const out = execSync("ss -ltnp 2>/dev/null | grep 'pid=" + pid + ",' | grep -oE '127.0.0.1:[0-9]+' | cut -d: -f2", { encoding: "utf8" });
    return out.split(/\s+/).filter(Boolean).map(Number);
  } catch (_) { return []; }
}

function probePort(port, csrf, apiKey) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ metadata: { ideName: "windsurf", ideVersion: "1.0.0", extensionName: "windsurf", extensionVersion: "1.0.0", apiKey: apiKey || "" } });
    const rq = http.request({ host: "127.0.0.1", port, path: "/exa.language_server_pb.LanguageServerService/GetUserStatus", method: "POST", timeout: 4000, headers: { "content-type": "application/json", "x-codeium-csrf-token": csrf } }, (rs) => {
      let d = ""; rs.on("data", (c) => (d += c));
      rs.on("end", () => resolve(rs.statusCode === 200 ? { ok: true, data: d } : { ok: false, code: rs.statusCode }));
    });
    rq.on("error", () => resolve({ ok: false }));
    rq.on("timeout", () => { rq.destroy(); resolve({ ok: false }); });
    rq.end(body);
  });
}

let _current = null; // { child, extSrv, port, csrf, bin }

function running() { return _current && _current.child && _current.child.exitCode === null ? _current : null; }

// 自起 LS 并等待可用: 返回 { port, csrf, bin, pid }。幂等: 已在跑直接复用。
async function provision(opts) {
  opts = opts || {};
  if (process.env.DAO_NO_LS_PROVISION) throw new Error("LS 自持已禁用(DAO_NO_LS_PROVISION)");
  const cur = running();
  if (cur) return { port: cur.port, csrf: cur.csrf, bin: cur.bin, pid: cur.child.pid };
  const bin = resolveBin(opts.storageDir);
  if (!bin) throw new Error("未找到官方 language_server 二进制(可设 DAO_LS_BIN 指定)");
  const csrf = crypto.randomUUID();
  const extSrv = await startStubExtServer();
  const esPort = extSrv.address().port;
  const dbDir = path.join(os.homedir(), ".codeium", "windsurf", "database", "dao-selfhost");
  try { fs.mkdirSync(dbDir, { recursive: true }); } catch (_) {}
  const args = [
    "--api_server_url", "https://server.codeium.com",
    "--run_child",
    "--enable_lsp",
    "--extension_server_port", String(esPort),
    "--ide_name", "windsurf",
    "--random_port",
    "--inference_api_server_url", "https://inference.codeium.com",
    "--database_dir", dbDir,
    "--enable_local_search",
    "--codeium_dir", ".codeium/windsurf",
    "--sentry_environment", "stable",
  ];
  const child = spawn(bin, args, { env: Object.assign({}, process.env, { WINDSURF_CSRF_TOKEN: csrf }), stdio: ["ignore", "ignore", "ignore"], detached: false });
  child.unref(); // 不阻塞宿主退出(插件 deactivate 时 stop() 显式回收)
  extSrv.unref();
  _current = { child, extSrv, port: null, csrf, bin };
  child.on("exit", () => { try { extSrv.close(); } catch (_) {} if (_current && _current.child === child) _current = null; });

  const apiKey = (opts.apiKeyCandidates && opts.apiKeyCandidates[0]) || firstApiKey();
  const t0 = Date.now();
  const timeoutMs = opts.timeoutMs || 30000;
  while (Date.now() - t0 < timeoutMs) {
    await new Promise((r) => setTimeout(r, 1200));
    if (child.exitCode !== null) throw new Error("language_server 进程退出: " + child.exitCode);
    for (const p of listenPortsOf(child.pid)) {
      if (p === esPort) continue;
      const r = await probePort(p, csrf, apiKey);
      if (r.ok || r.code === 400 || r.code === 401) { _current.port = p; return { port: p, csrf, bin, pid: child.pid }; }
    }
  }
  try { child.kill(); } catch (_) {}
  throw new Error("自持 LS 启动超时(" + timeoutMs + "ms 内未出可探活端口)");
}

function firstApiKey() {
  try { const c = require("./ls-bridge").apiKeyCandidates(); if (c && c.length) return c[0]; } catch (_) {}
  try {
    const t = fs.readFileSync(path.join(os.homedir(), ".codeium", "windsurf", "credentials.toml"), "utf8");
    const m = t.match(/windsurf_api_key\s*=\s*"([^"]+)"/); if (m) return m[1];
  } catch (_) {}
  try {
    const t = fs.readFileSync(path.join(os.homedir(), ".local", "share", "devin", "credentials.toml"), "utf8");
    const m = t.match(/windsurf_api_key\s*=\s*"([^"]+)"/); if (m) return m[1];
  } catch (_) {}
  return "";
}

function stop() {
  const cur = running();
  if (cur) { try { cur.child.kill(); } catch (_) {} try { cur.extSrv.close(); } catch (_) {} }
  _current = null;
}

module.exports = { resolveBin, provision, running, stop, listenPortsOf, probePort, firstApiKey, startStubExtServer };
