// 道 · LS 自持启动(独立宿主兜底) —— 第三方 IDE(VS Code 等)内官方 LS 不在跑时,
// 就地找官方 language_server 二进制自持拉起, 灌入 hostState, 与共生发现同构消费。
// ─────────────────────────────────────────────────────────────────────────────
// 同源三要素与共生模式完全一致:
//   · 二进制: 官方安装体(Devin Desktop / Windsurf)内的 bin/language_server_*;
//   · 登录态: credentials.toml / state.vscdb 的 windsurf_api_key(ls-bridge 同一来源);
//   · CSRF:  自生成并经 WINDSURF_CSRF_TOKEN 注入子进程(官方注入方式同源)。
// 端口经 --random_port_dir 落盘文件(<port>_<pid>)回读 —— 实测唯一可靠的免管道取端口法。
// 道并行而不相悖: 官方 IDE 在跑则共生发现优先, 本模块只在无 LS 可接时兜底; 官方
// 后启动亦不冲突(各自端口, 同一 codeium_dir/登录态/云端会话)。
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");

const { hostState, hostFire } = require("./host-state");

let _child = null;        // 自持子进程(单例)
let _booting = null;      // 进行中的 boot Promise(去重)

function _binName() {
  if (process.platform === "win32") return /language_server_windows/;
  if (process.platform === "darwin") return /language_server_macos/;
  return /language_server_linux/;
}

// 官方二进制候选(有序): 环境变量显式指定 → 各官方安装体常见落点 → IDE 扩展目录。
function binaryCandidates() {
  const out = [];
  const push = (p) => { try { if (p && fs.statSync(p).isFile() && out.indexOf(p) < 0) out.push(p); } catch (_) {} };
  if (process.env.DAO_LS_BIN) push(process.env.DAO_LS_BIN);
  const rx = _binName();
  const roots = [];
  const home = os.homedir();
  // 官方 IDE 安装体 app root(Linux 手装/系统装, macOS .app, Windows LocalPrograms)
  if (process.platform === "linux") {
    roots.push(path.join(home, "devin-desktop", "Devin", "resources", "app"));
    roots.push("/usr/share/devin/resources/app", "/opt/Devin/resources/app");
    roots.push("/usr/share/windsurf/resources/app", "/opt/Windsurf/resources/app");
  } else if (process.platform === "darwin") {
    roots.push("/Applications/Devin.app/Contents/Resources/app");
    roots.push("/Applications/Windsurf.app/Contents/Resources/app");
  } else {
    const lp = process.env.LOCALAPPDATA || path.join(home, "AppData", "Local");
    roots.push(path.join(lp, "Programs", "Devin", "resources", "app"));
    roots.push(path.join(lp, "Programs", "Windsurf", "resources", "app"));
  }
  for (const r of roots) {
    const bin = path.join(r, "extensions", "windsurf", "bin");
    try { for (const f of fs.readdirSync(bin)) if (rx.test(f)) push(path.join(bin, f)); } catch (_) {}
  }
  // 各 IDE 扩展目录内的官方 windsurf 扩展(若用户在第三方 IDE 装过官方插件)
  for (const extRoot of [path.join(home, ".devin", "extensions"), path.join(home, ".windsurf", "extensions"), path.join(home, ".vscode", "extensions")]) {
    try {
      for (const d of fs.readdirSync(extRoot)) {
        const bin = path.join(extRoot, d, "bin");
        try { for (const f of fs.readdirSync(bin)) if (rx.test(f)) push(path.join(bin, f)); } catch (_) {}
      }
    } catch (_) {}
  }
  return out;
}

// 从二进制路径推断官方版本号(product.json), 失败回退固定值(仅作 metadata 展示)。
function _versionNear(bin) {
  try {
    const appRoot = path.resolve(bin, "..", "..", "..", "..");
    const j = JSON.parse(fs.readFileSync(path.join(appRoot, "product.json"), "utf8"));
    if (j && j.windsurfVersion) return String(j.windsurfVersion);
    if (j && j.version) return String(j.version);
  } catch (_) {}
  return "3.4.27";
}

function _portFromDir(dir) {
  try {
    for (const f of fs.readdirSync(dir)) {
      const m = f.match(/^(\d+)_\d+$/);
      if (m) return Number(m[1]);
    }
  } catch (_) {}
  return 0;
}

function _probe(port, csrf, key) {
  const http = require("http");
  return new Promise((resolve) => {
    const payload = Buffer.from(JSON.stringify({
      metadata: { ideName: "windsurf", ideVersion: "1.127.0", extensionName: "windsurf", extensionVersion: "1.63.9250", apiKey: key },
    }), "utf8");
    const req = http.request({
      host: "127.0.0.1", port, path: "/exa.language_server_pb.LanguageServerService/GetUserStatus", method: "POST",
      headers: { "Content-Type": "application/json", "x-codeium-csrf-token": csrf, "Content-Length": payload.length },
    }, (r) => {
      let b = ""; r.on("data", (c) => { b += c; });
      r.on("end", () => { try { resolve(r.statusCode === 200 && !!JSON.parse(b).userStatus); } catch (_) { resolve(false); } });
    });
    req.setTimeout(4000, () => { req.destroy(); resolve(false); });
    req.on("error", () => resolve(false));
    req.end(payload);
  });
}

function alive() { return !!(_child && _child.exitCode === null && !_child.killed); }

// 自持拉起官方 LS 并灌入 hostState。返回 {lsPort,csrfToken} 或 null(不可用/被禁用/无登录态)。
// workspaceDir 用于 --workspace_id/--database_dir(与官方按工作区分库同构)。
async function boot(opts) {
  if (process.env.DAO_NO_LS_BOOT) return null;
  if (_booting) return _booting;
  _booting = _boot(opts || {}).finally(() => { _booting = null; });
  return _booting;
}

async function _boot({ log, workspaceDir }) {
  const say = (m) => { try { if (log) log("LS 自持: " + m); } catch (_) {} };
  if (alive()) {
    const h = hostState();
    if (h.lsPort && h.csrfToken) return { lsPort: h.lsPort, csrfToken: h.csrfToken };
  }
  let keys = [];
  try { keys = require("./ls-bridge").apiKeyCandidates(); } catch (_) {}
  if (!keys.length) { say("无登录态(credentials.toml/state.vscdb 均空), 不启动"); return null; }
  const bins = binaryCandidates();
  if (!bins.length) { say("未找到官方 language_server 二进制(需本机装有 Devin Desktop/Windsurf 或官方插件)"); return null; }
  const bin = bins[0];
  const csrf = crypto.randomUUID();
  const ws = workspaceDir || process.cwd();
  const wsId = ("file_" + ws).replace(/[^A-Za-z0-9]/g, "_");
  const dbDir = path.join(os.homedir(), ".codeium", "windsurf", "database",
    crypto.createHash("md5").update("dao-boot:" + ws).digest("hex"));
  const portDir = fs.mkdtempSync(path.join(os.tmpdir(), "dao-ls-port-"));
  fs.mkdirSync(dbDir, { recursive: true });
  const args = [
    "--run_child", "--enable_lsp", "--random_port", "--random_port_dir", portDir,
    "--api_server_url", "https://server.codeium.com",
    "--inference_api_server_url", "https://inference.codeium.com",
    "--ide_name", "windsurf", "--windsurf_version", _versionNear(bin),
    "--codeium_dir", ".codeium/windsurf",
    "--database_dir", dbDir,
    "--workspace_id", wsId,
    "--detect_proxy=false",
  ];
  say("拉起 " + bin);
  _child = spawn(bin, args, {
    env: Object.assign({}, process.env, { WINDSURF_CSRF_TOKEN: csrf }),
    stdio: "ignore", detached: false,
  });
  _child.on("exit", (code) => { say("子进程退出 code=" + code); });
  // 等端口文件(实测 ~1s 内落盘; 上限 30s)
  let port = 0;
  for (let i = 0; i < 60 && !port; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (!alive()) { say("子进程早退"); return null; }
    port = _portFromDir(portDir);
  }
  if (!port) { say("等端口超时"); stop(); return null; }
  // 逐候选 key 探测就绪(LS 启动后短暂 warmup)
  for (let i = 0; i < 20; i++) {
    for (const key of keys) {
      if (await _probe(port, csrf, key)) {
        const h = hostState();
        h.lsPort = port; h.csrfToken = csrf;
        try { require("./ls-bridge").setApiKey(key); } catch (_) {}
        hostFire();
        say("就绪(端口 " + port + ", CSRF ✓, 登录态同源)");
        return { lsPort: port, csrfToken: csrf };
      }
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  say("探测未就绪, 放弃");
  stop();
  return null;
}

function stop() {
  try { if (alive()) _child.kill(); } catch (_) {}
  _child = null;
}

module.exports = { boot, stop, alive, binaryCandidates };
