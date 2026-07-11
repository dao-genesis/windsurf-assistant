// 道 · Devin 引擎自持层(provision + self-auth) — 彻底脱离 Devin Desktop 依赖
// ─────────────────────────────────────────────────────────────────────────────
// 反者道之动:不表层复制 UI,而是把底层引擎(`devin` ACP 二进制)接管进插件自身。
//   · 二进制解析优先级(自持 → 兜底):
//       env DAO_DEVIN_BIN → 插件内置 engine/<os-arch>/devin → globalStorage 缓存
//       → 本机既有安装(Devin Desktop / ~/.local/bin)
//   · 自持鉴权:`devin auth login --force-manual-token-flow` 由插件宿主编排,
//       凭据落标准路径(~/.local/share/devin/credentials.toml),不依赖宿主下发。
//     实测(印254):登录后 `devin acp` 直接可用,initialize/session/new/prompt 全通,
//     无需 ACP authenticate。
"use strict";

const { spawn, execFile } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

function exeName() { return process.platform === "win32" ? "devin.exe" : "devin"; }

// os-arch 标识,对应内置 engine/<tag>/ 子目录。
function platformTag() {
  const a = process.arch === "arm64" ? "arm64" : "x64";
  if (process.platform === "win32") return "win32-" + a;
  if (process.platform === "darwin") return "darwin-" + a;
  return "linux-" + a;
}

// 解析 devin 引擎二进制。extRoot=扩展根目录;storageDir=globalStorage 路径(可空)。
function resolveEngine(extRoot, storageDir) {
  const exe = exeName();
  const tag = platformTag();
  const cands = [];
  if (process.env.DAO_DEVIN_BIN) cands.push(process.env.DAO_DEVIN_BIN);
  if (extRoot) {
    cands.push(path.join(extRoot, "engine", tag, exe));
    cands.push(path.join(extRoot, "engine", exe));
  }
  if (storageDir) cands.push(path.join(storageDir, "engine", exe));
  const home = os.homedir();
  cands.push(
    "/home/ubuntu/devin-desktop/Devin/resources/app/extensions/windsurf/devin/bin/" + exe,
    path.join(home, ".local", "bin", exe),
    path.join(home, ".codeium", "windsurf", "devin", "bin", exe),
  );
  for (const c of cands) {
    try {
      if (c && fs.existsSync(c)) {
        const abs = path.resolve(c);
        try { if (process.platform !== "win32") fs.chmodSync(abs, 0o755); } catch (_) {}
        return abs;
      }
    } catch (_) {}
  }
  return null;
}

// `devin auth status` → { loggedIn, name, raw }
function authStatus(bin) {
  return new Promise((resolve) => {
    if (!bin) return resolve({ loggedIn: false, name: null, raw: "no-bin" });
    execFile(bin, ["auth", "status"], { timeout: 15000 }, (err, stdout, stderr) => {
      const raw = String(stdout || "") + String(stderr || "");
      const loggedIn = /Logged in/i.test(raw) && !/Not logged in/i.test(raw);
      const m = raw.match(/Name:\s*(.+)/);
      resolve({ loggedIn, name: m ? m[1].trim() : null, raw: raw.trim() });
    });
  });
}

// 编排 `devin auth login --force-manual-token-flow`(自持登录,不依赖宿主)。
//   参数 { onUrl(url), onDone({ok,message}) };同步返回 { submitCode(code), cancel() }。
//   实测:CLI 打印 "Visit <url> ... Code:" → 粘贴一次性 code → "Login successful!"。
function startLogin(bin, opts = {}) {
  const onUrl = opts.onUrl || (() => {});
  const onDone = opts.onDone || (() => {});
  if (!bin) { onDone({ ok: false, message: "no devin binary" }); return { submitCode() {}, cancel() {} }; }
  // CLI 的 code 输入是 raw-mode TUI,无 TTY 会立即退出;类 Unix 下借 script(1) 造伪终端。
  const args = ["auth", "login", "--force-manual-token-flow"];
  let child;
  if (process.platform === "linux") {
    child = spawn("script", ["-qefc", [bin].concat(args).map((s) => "'" + String(s).replace(/'/g, "'\\''") + "'").join(" "), "/dev/null"], { stdio: ["pipe", "pipe", "pipe"] });
  } else if (process.platform === "darwin") {
    child = spawn("script", ["-q", "/dev/null", bin].concat(args), { stdio: ["pipe", "pipe", "pipe"] });
  } else {
    child = spawn(bin, args, { stdio: ["pipe", "pipe", "pipe"] });
  }
  let out = "";
  let urlSent = false;
  let finished = false;
  const finish = (r) => { if (finished) return; finished = true; try { child.kill(); } catch (_) {} onDone(r); };
  const scan = (s) => {
    out += s;
    if (!urlSent) {
      const m = out.match(/https:\/\/\S+/);
      if (m) { urlSent = true; try { onUrl(m[0]); } catch (_) {} }
    }
    if (/Login successful/i.test(out)) finish({ ok: true, message: "Login successful" });
  };
  child.stdout.on("data", (d) => scan(String(d)));
  child.stderr.on("data", (d) => scan(String(d)));
  child.on("exit", (code) => {
    if (/Login successful/i.test(out)) finish({ ok: true, message: "Login successful" });
    else finish({ ok: false, message: out.trim() || ("exit " + code) });
  });
  child.on("error", (e) => finish({ ok: false, message: String(e && e.message || e) }));
  return {
    submitCode: (code) => { try { child.stdin.write(String(code).trim() + "\n"); } catch (_) {} },
    cancel: () => { try { child.kill(); } catch (_) {} },
  };
}

module.exports = { resolveEngine, authStatus, startLogin, exeName, platformTag };
