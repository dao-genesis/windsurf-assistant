// 道 · 共生模式宿主发现 —— 宿主(Devin Desktop / Windsurf)已内建官方 language_server 运行时,
// 本插件不再自持本体, 而是就地发现宿主 LS 的 RPC 端口与 CSRF, 灌入 hostState 供面板 1:1 消费。
// ─────────────────────────────────────────────────────────────────────────────
// 发现三要素(与官方同源):
//   · RPC 端口: language_server 进程监听的随机端口(可能多个, 逐个探 GetUserStatus 命中者即是);
//   · CSRF:     language_server 进程环境变量 WINDSURF_CSRF_TOKEN(官方注入, 与 RPC 同源鉴权);
//   · apiKey:   ~/.local/share/devin/credentials.toml 的 windsurf_api_key(登录态真源)。
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync } = require("child_process");

// 宿主态中枢(零 IDE 依赖): 发现即灌入单例并落盘, 供进程内面板与跨进程 headless 核共享。
const { hostState, hostFire } = require("./host-state");

const SVC = "/exa.language_server_pb.LanguageServerService/";

// 登录态 apiKey 候选集: 与 ls-bridge 同源(credentials.toml 真源 + 各 IDE state.vscdb 登录态)。
// 返回有序去重数组 —— 逐个探测选中官方 LS 实际接受者(切号/多登录态不误判)。
function apiKeyCandidates() {
  try {
    const c = require("./ls-bridge").apiKeyCandidates();
    if (c && c.length) return c;
  } catch (_) {}
  try {
    const t = fs.readFileSync(path.join(os.homedir(), ".local", "share", "devin", "credentials.toml"), "utf8");
    const m = t.match(/windsurf_api_key\s*=\s*"([^"]+)"/);
    if (m) return [m[1]];
  } catch (_) {}
  return [];
}

// language_server 进程 PID(Linux: /proc 扫 cmdline; 其余平台: pgrep)。
function lsPids() {
  const pids = [];
  try {
    if (process.platform === "linux") {
      for (const d of fs.readdirSync("/proc")) {
        if (!/^\d+$/.test(d)) continue;
        try {
          const cmd = fs.readFileSync("/proc/" + d + "/cmdline", "utf8");
          if (cmd.includes("language_server") && cmd.includes("--enable_lsp")) pids.push(Number(d));
        } catch (_) {}
      }
    } else {
      const out = execSync("pgrep -f language_server", { encoding: "utf8" });
      out.split(/\s+/).filter(Boolean).forEach((p) => pids.push(Number(p)));
    }
  } catch (_) {}
  return pids;
}

function csrfOf(pid) {
  try {
    if (process.platform === "linux") {
      const env = fs.readFileSync("/proc/" + pid + "/environ", "utf8");
      const m = env.split("\0").find((kv) => kv.startsWith("WINDSURF_CSRF_TOKEN="));
      if (m) return m.slice("WINDSURF_CSRF_TOKEN=".length);
    }
  } catch (_) {}
  return "";
}

// 进程监听的本地 TCP 端口(Linux: /proc/net/tcp 按 inode 反查; 其余: lsof)。
function listenPortsOf(pid) {
  const ports = new Set();
  try {
    if (process.platform === "linux") {
      const inodes = new Set();
      for (const fd of fs.readdirSync("/proc/" + pid + "/fd")) {
        try {
          const l = fs.readlinkSync("/proc/" + pid + "/fd/" + fd);
          const m = l.match(/socket:\[(\d+)\]/);
          if (m) inodes.add(m[1]);
        } catch (_) {}
      }
      for (const f of ["/proc/net/tcp", "/proc/net/tcp6"]) {
        let txt = "";
        try { txt = fs.readFileSync(f, "utf8"); } catch (_) { continue; }
        for (const line of txt.split("\n").slice(1)) {
          const c = line.trim().split(/\s+/);
          if (c.length < 10) continue;
          if (c[3] !== "0A") continue; // 0A = LISTEN
          if (!inodes.has(c[9])) continue;
          const hexPort = c[1].split(":")[1];
          if (hexPort) ports.add(parseInt(hexPort, 16));
        }
      }
    } else {
      const out = execSync("lsof -nP -iTCP -sTCP:LISTEN -a -p " + pid, { encoding: "utf8" });
      for (const line of out.split("\n")) {
        const m = line.match(/:(\d+)\s+\(LISTEN\)/);
        if (m) ports.add(Number(m[1]));
      }
    }
  } catch (_) {}
  return [...ports];
}

function probe(port, csrf, key) {
  return new Promise((resolve) => {
    const payload = Buffer.from(JSON.stringify({
      metadata: { ideName: "windsurf", ideVersion: "1.127.0", extensionName: "windsurf", extensionVersion: "1.63.9250", apiKey: key },
    }), "utf8");
    const req = http.request({
      host: "127.0.0.1", port, path: SVC + "GetUserStatus", method: "POST",
      headers: { "Content-Type": "application/json", "x-codeium-csrf-token": csrf, "Content-Length": payload.length },
    }, (r) => {
      let b = ""; r.on("data", (c) => { b += c; });
      r.on("end", () => { try { resolve(r.statusCode === 200 && JSON.parse(b).userStatus ? true : false); } catch (_) { resolve(false); } });
    });
    req.setTimeout(4000, () => { req.destroy(); resolve(false); });
    req.on("error", () => resolve(false));
    req.end(payload);
  });
}

// 发现并灌入 hostState.lsPort/csrfToken。命中返回 {lsPort,csrfToken}; 未就绪返回 null。
// 逐个候选 key 探测: 命中即把该 key 回灌 ls-bridge 缓存(后续 RPC 用官方 LS 实际接受者)。
async function discover() {
  const keys = apiKeyCandidates();
  if (!keys.length) return null;
  for (const pid of lsPids()) {
    const csrf = csrfOf(pid);
    if (!csrf) continue;
    for (const port of listenPortsOf(pid)) {
      for (const key of keys) {
        if (await probe(port, csrf, key)) {
          const h = hostState();
          h.lsPort = port; h.csrfToken = csrf;
          try { require("./ls-bridge").setApiKey(key); } catch (_) {}
          hostFire(); // 广播监听者 + 落盘, 供跨进程 headless 核复用
          return { lsPort: port, csrfToken: csrf };
        }
      }
    }
  }
  return null;
}

// 轮询发现(冷启动时 LS 略迟于插件激活): 每 intervalMs 试一次, 命中即停; 返回停止句柄。
function startDiscovery(onFound, log, intervalMs) {
  let stopped = false; let timer = null;
  const tick = async () => {
    if (stopped) return;
    try {
      const found = await discover();
      if (found) { if (log) log("共生: 已发现宿主 LS(端口 " + found.lsPort + ", CSRF ✓)"); if (onFound) onFound(found); return; }
    } catch (_) {}
    if (!stopped) timer = setTimeout(tick, intervalMs || 3000);
  };
  tick();
  return { stop() { stopped = true; if (timer) clearTimeout(timer); } };
}

module.exports = { discover, startDiscovery, lsPids, csrfOf, listenPortsOf };
