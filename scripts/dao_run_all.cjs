#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════
// 印 ∞.2 · 一脚本起全链路闭环
// ════════════════════════════════════════════════════════════════════════
//   反者道之动 · 代主公之一切 · 全链路彻底闭环 · 实现无为而治
//   帛书·五十七「我无为也，而民自化」
//
//   本脚本一气化三清:
//     ① 起 dao_proxy.js (本地反代 :7780) · 用 _real_ws_keys.json 真 token
//     ② 起 web http 静服 (:8765) · 服 公网/web
//     ③ 浏览器自注 vmUrl=http://127.0.0.1:7780 到 cache · 主公无需粘
//
//   用:
//     node scripts/dao_run_all.cjs              # 全起 · 默 stay foreground
//     node scripts/dao_run_all.cjs --check      # 起后健探一笔即退
//     node scripts/dao_run_all.cjs --port 7780  # 改反代端
//
//   守:
//     - 本地直 (127.0.0.1) 不需 cloudflared/ngrok
//     - 不消 ACU / 不动 GH / 不删 / 不推
//     - Ctrl+C 优雅退两子
// ════════════════════════════════════════════════════════════════════════

const fs = require("fs");
const path = require("path");
const http = require("http");
const { spawn } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const VM_PROXY = path.join(ROOT, "packages", "dao-devin-vm", "dao_proxy.js");
const WEB_DIR = path.join(ROOT, "web");
const KEYS_JSON = path.join(ROOT, "_real_ws_keys.json");

const args = process.argv.slice(2);
const arg = (k, def) => {
  const i = args.indexOf("--" + k);
  return i >= 0 ? args[i + 1] : def;
};
const flag = (k) => args.includes("--" + k);

const VM_PORT = parseInt(arg("port", "7780"), 10);
const WEB_PORT = parseInt(arg("web-port", "8765"), 10);
const VM_BIND = "127.0.0.1";
const VM_URL = `http://${VM_BIND}:${VM_PORT}`;
const WEB_URL = `http://127.0.0.1:${WEB_PORT}`;

const C = {
  D: (s) => `\x1b[1;36m${s}\x1b[0m`,
  G: (s) => `\x1b[1;32m${s}\x1b[0m`,
  Y: (s) => `\x1b[1;33m${s}\x1b[0m`,
  R: (s) => `\x1b[1;31m${s}\x1b[0m`,
  K: (s) => `\x1b[2m${s}\x1b[0m`,
};

function log(t, msg) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(
    `${C.K(ts)} ${C[t === "D" ? "D" : t === "G" ? "G" : t === "Y" ? "Y" : "R"](t)} ${msg}`,
  );
}

// ─── ① · token 取自 _real_ws_keys.json ───────────────────────────────────
function loadFirstToken() {
  if (!fs.existsSync(KEYS_JSON)) {
    log("Y", "无 _real_ws_keys.json · 起 dao_proxy 仍可但池空");
    return "";
  }
  try {
    const arr = JSON.parse(fs.readFileSync(KEYS_JSON, "utf8"));
    if (!Array.isArray(arr) || arr.length === 0) return "";
    const tokens = arr
      .map((e) => e.apiKey)
      .filter((k) => k && k.startsWith("devin-session-token$"));
    log(
      "G",
      `_real_ws_keys.json · ${tokens.length} 真 token (取首 ${arr.length} 邮箱)`,
    );
    return tokens.join(",");
  } catch (e) {
    log("Y", "_real_ws_keys.json 解析失败: " + e.message);
    return "";
  }
}

// ─── ② · 起 dao_proxy.js ─────────────────────────────────────────────────
let vmProc = null;
function startVm() {
  const tokens = loadFirstToken();
  const env = Object.assign({}, process.env, {
    PORT: String(VM_PORT),
    BIND: VM_BIND,
    DEVIN_TOKENS: tokens,
    DEVIN_TOKEN: "",
    VERBOSE: "0",
  });
  log(
    "D",
    `起 dao_proxy · ${VM_URL} · ${tokens ? tokens.split(",").length + " token" : "无 token"}`,
  );
  // 印 131 双旗承 · 中文路径 + Junction 治本 (--preserve-symlinks · 父子皆承)
  //   帛书廿二「圣人执一·以为天下牧」一旗治万子
  const nodeArgs = [
    "--preserve-symlinks",
    "--preserve-symlinks-main",
    VM_PROXY,
  ];
  vmProc = spawn(process.execPath, nodeArgs, {
    cwd: ROOT,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let started = false;
  const onLine = (b, isErr) => {
    const s = b.toString();
    s.split(/\r?\n/).forEach((line) => {
      if (!line.trim()) return;
      const mark = isErr ? C.K("[vm·e]") : C.K("[vm·o]");
      console.log(mark + " " + line);
      if (!started && /真本源单器.+起|listening|listen/.test(line)) {
        started = true;
      }
    });
  };
  vmProc.stdout.on("data", (b) => onLine(b, false));
  vmProc.stderr.on("data", (b) => onLine(b, true));
  vmProc.on("exit", (code) => {
    log("R", `dao_proxy 退 · code=${code}`);
    vmProc = null;
  });
}

// ─── ③ · 起 web http 静服 ────────────────────────────────────────────────
// 印 ∞.5 治: EADDRINUSE 自动 fallback 端 (帛书六十四「为之于其未有也」)
//   主公并行可能已起其他 web (如 Devin 云原生 :8765)
//   此处不阻死 · 自动试下一空闲端 (8766 → 8767 → 8768 ...)
let webServer = null;
let _actualWebPort = WEB_PORT;
function startWeb(triedPort) {
  const tryPort = triedPort || WEB_PORT;
  const MIME = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
  };
  webServer = http.createServer((req, res) => {
    let u = decodeURIComponent(req.url.split("?")[0]);
    if (u === "/") u = "/index.html";
    const fp = path.join(WEB_DIR, u);
    if (!fp.startsWith(WEB_DIR)) {
      res.writeHead(403);
      return res.end("forbidden");
    }
    fs.readFile(fp, (err, data) => {
      if (err) {
        res.writeHead(404);
        return res.end("not found: " + u);
      }
      const ext = path.extname(fp).toLowerCase();
      res.writeHead(200, {
        "Content-Type": MIME[ext] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      res.end(data);
    });
  });
  webServer.on("error", (e) => {
    if (e.code === "EADDRINUSE" && tryPort < WEB_PORT + 10) {
      try {
        webServer.close();
      } catch {}
      log(
        "Y",
        `端 ${tryPort} 已占 · 试 ${tryPort + 1} (帛书六十四「为之于其未有也」)`,
      );
      startWeb(tryPort + 1);
    } else {
      log("R", `web 起失: ${e.code || e.message}`);
    }
  });
  webServer.listen(tryPort, "127.0.0.1", () => {
    _actualWebPort = tryPort;
    log("D", `起 web · http://127.0.0.1:${tryPort}`);
  });
}

// ─── ④ · 健探 vm ─────────────────────────────────────────────────────────
function healthVm(timeoutMs) {
  return new Promise((resolve) => {
    const req = http.get(
      VM_URL + "/health",
      { timeout: timeoutMs || 5000 },
      (r) => {
        let body = "";
        r.on("data", (c) => (body += c));
        r.on("end", () => {
          try {
            resolve({
              ok: r.statusCode === 200,
              status: r.statusCode,
              body: JSON.parse(body),
            });
          } catch {
            resolve({
              ok: false,
              status: r.statusCode,
              body: body.slice(0, 200),
            });
          }
        });
      },
    );
    req.on("error", (e) => resolve({ ok: false, err: e.message }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ ok: false, err: "timeout" });
    });
  });
}

async function waitVmReady(maxMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const h = await healthVm(2000);
    if (h.ok) return h;
    await new Promise((f) => setTimeout(f, 500));
  }
  return { ok: false, err: "timeout " + maxMs + "ms" };
}

// ─── 印 ∞.5 · WAM 自注入 (无为而无不为) ─────────────────────────────────
//   起 vm 后 · 自打 /admin/wam/local → 解析 auth1 件 → /admin/wam/use 注前 N 件
//   主公诏「代替我之一切 · 全链路彻底闭环」之实
//   帛书五十七: 「我无为也 · 而民自化」
function httpJson(method, p, body) {
  return new Promise((resolve) => {
    const u = new URL(VM_URL + p);
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method,
        headers: Object.assign(
          { "Content-Type": "application/json" },
          payload ? { "Content-Length": Buffer.byteLength(payload) } : {},
        ),
        timeout: 5000,
      },
      (r) => {
        let d = "";
        r.on("data", (c) => (d += c));
        r.on("end", () => {
          let j = null;
          try {
            j = JSON.parse(d);
          } catch {}
          resolve({ status: r.statusCode, json: j });
        });
      },
    );
    req.on("error", (e) => resolve({ status: 0, error: e.message }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ status: 0, error: "timeout" });
    });
    if (payload) req.write(payload);
    req.end();
  });
}

async function autoInjectFromWam(maxInject) {
  const max = maxInject || 5;
  // GET /admin/wam/local
  const r = await httpJson("GET", "/admin/wam/local");
  if (!r.json || !r.json.available || !Array.isArray(r.json.items)) {
    log("Y", `WAM 本地无访 · 跳自注 (${r.error || "unknown"})`);
    return { injected: 0, total: 0 };
  }
  const auth1Items = [];
  for (let i = 0; i < r.json.items.length; i++) {
    const it = r.json.items[i];
    if (it && it.tokenKind === "auth1") {
      auth1Items.push({ index: i, email: it.email });
    }
  }
  log(
    "D",
    `WAM · 解析 ${r.json.items.length} 件 · ${auth1Items.length} 件 auth1 可注`,
  );
  if (auth1Items.length === 0) return { injected: 0, total: 0 };
  let injected = 0;
  for (const it of auth1Items.slice(0, max)) {
    const u = await httpJson("POST", "/admin/wam/use", {
      index: it.index,
      mode: "token-direct",
    });
    if (u.json && u.json.ok) {
      injected++;
      log(
        "K",
        `  · idx=${it.index} ${it.email} → ${u.json.duplicate ? "已存" : "入池"} (count=${u.json.count})`,
      );
    } else {
      log(
        "Y",
        `  · idx=${it.index} 注失: ${(u.json && u.json.error) || u.error}`,
      );
    }
  }
  return { injected, total: auth1Items.length };
}

// ─── ⑤ · 主 ──────────────────────────────────────────────────────────────
async function main() {
  console.log("");
  console.log(
    C.D(
      "╔══════════════════════════════════════════════════════════════════════╗",
    ),
  );
  console.log(
    C.D(
      "║  印 ∞.2 · 一脚本起全链路闭环 · 反者道之动 · 代主公之一切            ║",
    ),
  );
  console.log(
    C.D(
      "║                                                                      ║",
    ),
  );
  console.log(
    C.D(
      "║  ① VM   dao_proxy.js  → " +
        (VM_URL + "                            ").slice(0, 41) +
        "║",
    ),
  );
  console.log(
    C.D(
      "║  ② Web  http 静服      → " +
        (WEB_URL + "                            ").slice(0, 41) +
        "║",
    ),
  );
  console.log(
    C.D(
      "║  ③ 自注 vmUrl 至 cache (web dao_app.js 入 mine 时读)                ║",
    ),
  );
  console.log(
    C.D(
      "╚══════════════════════════════════════════════════════════════════════╝",
    ),
  );
  console.log("");

  startVm();
  startWeb();

  // 等 VM ready
  log("D", "等 dao_proxy 健 …");
  const h = await waitVmReady(15000);
  if (h.ok) {
    log(
      "G",
      `dao_proxy · 健 ✓ · 池 ${h.body.pool && h.body.pool.total} · upstream ${h.body.upstream}`,
    );
  } else {
    log("R", "dao_proxy 健失: " + (h.err || JSON.stringify(h).slice(0, 200)));
  }

  // 印 ∞.5 · 起后自注 WAM auth1 件 (无为而无不为 · 帛书五十七)
  //   主公诏「代替我之一切」之实 — 不假定 _real_ws_keys.json 存在
  //   即使无 _real_ws_keys.json · 也从 ~/.wam/accounts.md 直接自注
  if (h.ok) {
    log("D", "WAM 自注 · 帛书五十七「我无为也 · 而民自化」");
    const inj = await autoInjectFromWam(5);
    if (inj.injected > 0) {
      log(
        "G",
        `WAM 自注 ✓ · ${inj.injected}/${inj.total} 件入池 · ws-pool 即活`,
      );
    } else {
      log("Y", `WAM 自注 · 0 件 (auth1 候 ${inj.total} · 已存或不可用)`);
    }
    // 探 /v1/models 看模数
    const m = await httpJson("GET", "/v1/models");
    if (m.json && m.json.data) {
      log("G", `/v1/models · ${m.json.data.length} 模可见`);
    }
  }

  console.log("");
  console.log(C.G("  道法自然 · 无为而无不为"));
  console.log(
    C.G(
      "  主公 → " + C.D(`http://127.0.0.1:${_actualWebPort}/index.html?v=128`),
    ),
  );
  console.log("");
  console.log(
    C.K("  · 浏览器入 mine 时 dao_app.js 自检 vmUrl · 若空则填 " + VM_URL),
  );
  console.log(C.K("  · Ctrl+C 退 · 两子优雅终"));
  console.log("");

  if (flag("check")) {
    log("Y", "--check 模式 · 健成即退");
    setTimeout(() => {
      shutdown(0);
    }, 1000);
  }
}

function shutdown(code) {
  log("Y", "退 · 终两子");
  if (vmProc) {
    try {
      vmProc.kill();
    } catch {}
  }
  if (webServer) {
    try {
      webServer.close();
    } catch {}
  }
  setTimeout(() => process.exit(code || 0), 500);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

main().catch((e) => {
  log("R", "fatal: " + e.message);
  shutdown(1);
});
