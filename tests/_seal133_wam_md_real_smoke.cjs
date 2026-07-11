#!/usr/bin/env node
// _seal133_wam_md_real_smoke.cjs · 印 133 · 反者道之动 · WAM 本地真本源桥守门
//
// 主公诏 (2026-05-17 20:08 · UTC+08):
//   「大曰逝 · 逝曰远 · 远曰反 · 重新解构最初本源提示词 · 解构所有底层需求
//    C:\Users\Administrator\.wam\accounts.md 带入用户一切 ·
//    测试使用一切 · 利用所有之资 · 推进到底 · 实践到底」
//
// 帛书引 (此守门所承之道):
//   廿五:    「道大 · 大曰逝 · 逝曰远 · 远曰反」     · 反归最初本源
//   四十:    「反者 · 道之动也 · 弱者 · 道之用也」   · 本印之根
//   三十六:  「邦利器不可以视人」                    · token 不离本机
//   五十六:  「塞其闷 · 闭其门」                     · 脱密
//   廿八:    「为天下式 · 恒德不贰」                  · env WAM_LOCAL_PATH 双源
//
// 守门策略 · 三节 (复 _seal130 之骨):
//   一 · 静守: dao_proxy.js 含 § 印 133 节 + 10 函数 + 路由 + hint
//   二 · 动守: spawn dao_proxy + WAM_LOCAL_PATH=fixture · 验全链路
//   三 · 隐守: 验脱密 / localhost-only / 不返完整 password/token
"use strict";
const path = require("path");
const http = require("http");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");
const { spawn } = require("child_process");

// 印 131 · 中文路径 · 子进程承双旗 (圣人执一)
function __preserveFlags() {
  const flags = (process.execArgv || []).slice();
  for (const f of ["--preserve-symlinks", "--preserve-symlinks-main"]) {
    if (!flags.includes(f)) flags.push(f);
  }
  return flags;
}

const ROOT = path.resolve(__dirname, "..");
const DAO_PROXY = path.join(ROOT, "packages", "dao-devin-vm", "dao_proxy.js");
const PORT = 17833;
const BIND = "127.0.0.1";
const AUTH = "seal133-test-aaaaaaaa-bbbb-cccc-dddd-ffffffffff33";

// fixture dir (临时 · 测后清)
const FIX_DIR = path.join(os.tmpdir(), "_seal133_wam_fix_" + Date.now());
const FIX_MD = path.join(FIX_DIR, "accounts.md");
const FIX_STATE = path.join(FIX_DIR, "wam-state.json");

let pass = 0,
  fail = 0;
const fails = [];
const ok = (n) => {
  console.log(`  \x1b[32m✓\x1b[0m ${n}`);
  pass++;
};
const ng = (n, w) => {
  console.log(`  \x1b[31m✗\x1b[0m ${n} · ${w}`);
  fail++;
  fails.push(n + ": " + w);
};

// ════════════════════════════════════════════════════════════════════
// § fixture · 准
// ════════════════════════════════════════════════════════════════════
const FIX_AUTH1 = "auth1_abcdefghijklmnopqrstuvwxyzabcdefghij"; // 40 字 · 单 token
const FIX_AUTH1_EMAIL = "auth1.test001@token.wam"; // 邮+token 之 邮
const FIX_AUTH1_EMAIL_TOK = "auth1_zyxwvutsrqponmlkjihgfedcba0123456789ab"; // 邮+token 之 token
const FIX_EMAIL = "alice.test@example.com";
const FIX_PASSWORD = "secretPw123!";
const FIX_SK_WS = "sk-ws-test-aaabbbcccdddeeefff123456789012345";
const FIX_OPAQUE = "x".repeat(72); // 长 72 字 · 仅 a-z · 落 opaque 类
const FIX_IGNORED = "not_email_or_token_just_text"; // ignored

const FIX_MD_CONTENT = [
  "# fixture for _seal133",
  "// 注释行 (亦忽)",
  "",
  FIX_AUTH1, // line 4 · kind=token (auth1)
  FIX_EMAIL + " " + FIX_PASSWORD, // line 5 · kind=email_password
  FIX_AUTH1_EMAIL + " " + FIX_AUTH1_EMAIL_TOK, // line 6 · kind=email_token (auth1)
  "bob.test@example.com\tplain_pass_xyz", // line 7 · email_password (\t)
  "carol.test@example.com:colonpass456", // line 8 · email_password (:)
  FIX_SK_WS, // line 9 · token (sk-ws)
  FIX_OPAQUE, // line 10 · token (opaque · 单 a-z 72 字)
  FIX_IGNORED, // line 11 · ignored
  "", // line 12 · 空
].join("\n");

const FIX_STATE_CONTENT = JSON.stringify(
  {
    version: "seal133-test",
    savedAt: Date.now(),
    activeEmail: FIX_EMAIL,
    switches: 7,
    health: {
      [FIX_EMAIL.toLowerCase()]: {
        plan: "Trial",
        daily: 80,
        weekly: 90,
        daysLeft: 5,
        planEnd: Date.now() + 5 * 86400 * 1000,
        checked: true,
        lastChecked: Date.now() - 1000,
      },
      "bob.test@example.com": {
        plan: "Free",
        daily: 0,
        weekly: 0,
        daysLeft: 0,
        planEnd: Date.now() - 86400 * 1000, // 已过
        checked: true,
      },
    },
  },
  null,
  2,
);

function prepareFixture() {
  fs.mkdirSync(FIX_DIR, { recursive: true });
  fs.writeFileSync(FIX_MD, FIX_MD_CONTENT, "utf8");
  fs.writeFileSync(FIX_STATE, FIX_STATE_CONTENT, "utf8");
}

function cleanupFixture() {
  try {
    fs.unlinkSync(FIX_MD);
  } catch {}
  try {
    fs.unlinkSync(FIX_STATE);
  } catch {}
  try {
    fs.rmdirSync(FIX_DIR);
  } catch {}
}

function _fp(s) {
  return crypto
    .createHash("sha256")
    .update(s, "utf8")
    .digest("hex")
    .slice(0, 12);
}

// ════════════════════════════════════════════════════════════════════
// § 一 · 静守 · 件读 + 关键码
// ════════════════════════════════════════════════════════════════════
function staticGuard() {
  console.log("\n═══ 一 · 静守 · dao_proxy.js 印 133 件读 ═══");
  const t = fs.readFileSync(DAO_PROXY, "utf8");
  const checks = [
    // 节
    ["含 § 印 133 节", t.includes("§ 印 133 · 反者道之动 · WAM 本地真本源桥")],
    ["含 大曰逝逝曰远远曰反 (廿五)", t.includes("大曰逝逝曰远远曰反")],
    ["头注释引印 133", /末改[\s\S]{0,500}印 133/.test(t)],
    // helpers (10 件)
    ["含 _WAM133_HOME 常量", t.includes("_WAM133_HOME")],
    ["含 env WAM_LOCAL_PATH 覆", t.includes("process.env.WAM_LOCAL_PATH")],
    [
      "含 __WAM133_OVERRIDE / __setWam133Override",
      t.includes("__setWam133Override"),
    ],
    ["含 _wam133_paths()", /function\s+_wam133_paths\s*\(/.test(t)],
    ["含 _wam133_isEmail()", /function\s+_wam133_isEmail\s*\(/.test(t)],
    [
      "含 _wam133_tokenKind() + 5 regex",
      /function\s+_wam133_tokenKind\s*\(/.test(t) &&
        t.includes("_WAM133_RE_AUTH1") &&
        t.includes("_WAM133_RE_JWT") &&
        t.includes("_WAM133_RE_DEVIN_SESSION") &&
        t.includes("_WAM133_RE_SK_WS"),
    ],
    [
      "含 _wam133_fp() (sha256 12 hex)",
      /function\s+_wam133_fp\s*\([\s\S]{0,200}sha256/.test(t),
    ],
    ["含 _wam133_maskEmail()", /function\s+_wam133_maskEmail\s*\(/.test(t)],
    ["含 _wam133_maskToken()", /function\s+_wam133_maskToken\s*\(/.test(t)],
    [
      "含 _wam133_parseAccountsMd()",
      /function\s+_wam133_parseAccountsMd\s*\(/.test(t),
    ],
    [
      "含 _wam133_attachHealth()",
      /function\s+_wam133_attachHealth\s*\(/.test(t),
    ],
    // handlers
    [
      "含 handleAdminWamLocal()",
      /async\s+function\s+handleAdminWamLocal\s*\(/.test(t),
    ],
    [
      "含 handleAdminWamUse()",
      /async\s+function\s+handleAdminWamUse\s*\(/.test(t),
    ],
    // 路由
    ["路由含 GET /admin/wam/local", t.includes('p === "/admin/wam/local"')],
    ["路由含 POST /admin/wam/use", t.includes('p === "/admin/wam/use"')],
    // 404 hint
    [
      "404 hint 含 印 133 二路",
      /\/admin\/wam\/local[\s\S]{0,80}\/admin\/wam\/use[\s\S]{0,80}印 133/.test(
        t,
      ),
    ],
    // 多分隔符 (复 wam_bridge.parseAccountText 精)
    ["parseAccountsMd 含 \\t 分隔", t.includes('ln.includes("\\t")')],
    ["parseAccountsMd 含 :|：=＝ 分隔", /\[:：=＝\]/.test(t)],
    ["parseAccountsMd 含 | 分隔", t.includes('ln.includes("|")')],
    ["parseAccountsMd 含 ---- 分隔", /----\+?/.test(t)],
    // 守隐
    [
      "handleAdminWamLocal raw=1 localhost-only",
      /raw_only_localhost[\s\S]{0,200}127\\\./.test(t) ||
        /includeRaw[\s\S]{0,200}isLocal/.test(t),
    ],
    ["handleAdminWamUse localhost-only", t.includes("wam_use_localhost_only")],
    [
      "token-direct 路 复 _maskKey 脱密",
      /token-direct[\s\S]{0,800}_maskKey\(rawTok\)/.test(t),
    ],
    [
      "email-login 路 调 _signin_orchestrate (印 129)",
      /email-login[\s\S]{0,1500}_signin_orchestrate/.test(t),
    ],
    // 帛书引
    ["引帛书廿五 道大", t.includes("「道大 · 大曰逝 · 逝曰远 · 远曰反」")],
    ["引帛书四十 反者道之动", /反者[\s\S]{0,30}道之动/.test(t)],
    ["引帛书三十六 邦利器", t.includes("邦利器不可以视人")],
    ["引帛书五十六 塞其闷", t.includes("「塞其闷 · 闭其门」")],
    ["引帛书廿八 为天下式", t.includes("「为天下式 · 恒德不贰」")],
  ];
  for (const [n, c] of checks) (c ? ok : ng)(n, "缺");
}

// ════════════════════════════════════════════════════════════════════
// § 二 · 动守 · spawn dao_proxy · WAM_LOCAL_PATH=fixture · 验真路
// ════════════════════════════════════════════════════════════════════
function probe(method, urlPath, headers, body) {
  return new Promise((resolve) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        host: BIND,
        port: PORT,
        method,
        path: urlPath,
        headers: Object.assign(
          { "Content-Type": "application/json" },
          payload ? { "Content-Length": Buffer.byteLength(payload) } : {},
          headers || {},
        ),
        timeout: 6000,
      },
      (res) => {
        let buf = "";
        res.on("data", (c) => (buf += c));
        res.on("end", () => {
          let json = null;
          try {
            json = JSON.parse(buf);
          } catch {}
          resolve({ status: res.statusCode, json, raw: buf });
        });
      },
    );
    req.on("error", (e) => resolve({ err: e.message }));
    req.on("timeout", () => {
      try {
        req.destroy();
      } catch {}
      resolve({ err: "timeout" });
    });
    if (payload) req.write(payload);
    req.end();
  });
}

function waitHealth(maxMs) {
  const deadline = Date.now() + (maxMs || 8000);
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (Date.now() > deadline) return reject(new Error("/health 探活超时"));
      probe("GET", "/health", { Authorization: "Bearer " + AUTH })
        .then((r) => {
          if (r.status === 200) return resolve();
          setTimeout(tick, 100);
        })
        .catch(() => setTimeout(tick, 100));
    };
    setTimeout(tick, 200);
  });
}

// 同 _seal129/130 · graceful + force fallback · 治 Win 孤儿端口
function killDaemon(child) {
  return new Promise((resolve) => {
    if (!child || child.killed) return resolve();
    let done = false;
    const fin = () => {
      if (!done) {
        done = true;
        resolve();
      }
    };
    child.once("exit", fin);
    try {
      child.kill(process.platform === "win32" ? "SIGTERM" : "SIGINT");
    } catch {}
    setTimeout(() => {
      if (!done) {
        try {
          child.kill("SIGKILL");
        } catch {}
        setTimeout(fin, 400);
      }
    }, 4500);
  });
}

function spawnDaemon(wamPath) {
  return new Promise((resolve, reject) => {
    const env = Object.assign({}, process.env, {
      PORT: String(PORT),
      BIND,
      DAO_AUTH_TOKEN: AUTH,
      WAM_LOCAL_PATH: wamPath || "", // 印 133 注入 fixture
      WAM_FILE: path.join(__dirname, "_seal133_no_wam.json"),
      DEVIN_TOKEN: "",
      DEVIN_TOKENS: "",
      DAO_TOKENS_FILE: "",
      WS_TOKENS_FILE: path.join(__dirname, "_seal133_no_ws.txt"),
    });
    const child = spawn(process.execPath, [...__preserveFlags(), DAO_PROXY], {
      env,
      cwd: path.dirname(DAO_PROXY),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (c) => (stderr += c.toString()));
    child.stdout.on("data", () => {});
    waitHealth(8000)
      .then(() => resolve(child))
      .catch((e) => {
        try {
          child.kill("SIGKILL");
        } catch {}
        reject(new Error(e.message + " · stderr=" + stderr.slice(-300)));
      });
  });
}

async function dynamicGuard() {
  console.log("\n═══ 二 · 动守 · spawn dao_proxy + WAM_LOCAL_PATH=fixture ═══");
  let daemon;
  try {
    daemon = await spawnDaemon(FIX_DIR);
    ok("dao_proxy daemon 起 · WAM_LOCAL_PATH=" + FIX_DIR);
    const H = { Authorization: "Bearer " + AUTH };

    // ─── A · GET /admin/wam/local 真本源探 ───
    let lastLocal = null;
    {
      const r = await probe("GET", "/admin/wam/local", H);
      lastLocal = r.json;
      if (r.status === 200 && r.json && r.json.ok && r.json.available) {
        ok("A1 · GET /admin/wam/local · available=true");
      } else {
        ng(
          "A1 · GET /admin/wam/local",
          `status=${r.status} avail=${r.json && r.json.available}`,
        );
      }
    }
    if (!lastLocal) {
      ng("A · 后续验缺 lastLocal", "上行失败 · 跳后续 A 段");
    } else {
      const items = lastLocal.items || [];
      const counts = lastLocal.counts || {};
      // 期望 (按 fixture):
      //   1 个 # 注释 + 1 个 // 注释 + 1 空行 → 全跳
      //   3 个 token (auth1, sk-ws, opaque)
      //   3 个 email_password (alice, bob \t, carol :)
      //   1 个 email_token (auth1.test001 + auth1_zyx)
      //   1 个 ignored
      //   = 8 items
      if (items.length === 8) ok(`A2 · items 长 8 · 实=${items.length}`);
      else ng(`A2 · items 长`, `期 8 · 实 ${items.length}`);

      if (counts.tokenOnly === 3) ok(`A3 · counts.tokenOnly === 3`);
      else
        ng(
          `A3 · counts.tokenOnly`,
          `期 3 · 实 ${counts.tokenOnly} (auth1+sk-ws+opaque)`,
        );

      if (counts.emailPassword === 3) ok(`A4 · counts.emailPassword === 3`);
      else ng(`A4 · counts.emailPassword`, `期 3 · 实 ${counts.emailPassword}`);

      if (counts.emailToken === 1) ok(`A5 · counts.emailToken === 1`);
      else ng(`A5 · counts.emailToken`, `期 1 · 实 ${counts.emailToken}`);

      if (counts.ignored === 1) ok(`A6 · counts.ignored === 1`);
      else ng(`A6 · counts.ignored`, `期 1 · 实 ${counts.ignored}`);

      // counts.auth1 应 2 (单 token 1 + email_token 1)
      if (counts.auth1 === 2) ok(`A7 · counts.auth1 === 2 (单 + 邮+token)`);
      else ng(`A7 · counts.auth1`, `期 2 · 实 ${counts.auth1}`);

      // counts.directUsable 应 4 (3 token + 1 email_token)
      if (counts.directUsable === 4)
        ok(`A8 · counts.directUsable === 4 (token+email_token)`);
      else ng(`A8 · counts.directUsable`, `期 4 · 实 ${counts.directUsable}`);

      // state 注入
      if (
        lastLocal.stateAvailable &&
        lastLocal.state &&
        lastLocal.state.healthCount >= 2
      )
        ok("A9 · wam-state 健康注入 (healthCount >= 2)");
      else
        ng(
          "A9 · 健康注入",
          `stateAvailable=${lastLocal.stateAvailable} hc=${lastLocal.state && lastLocal.state.healthCount}`,
        );

      // alice 健康可用 (Trial · daily=80)
      const aliceItem = items.find((it) => it.email === FIX_EMAIL);
      if (
        aliceItem &&
        aliceItem.health &&
        aliceItem.health.daily === 80 &&
        aliceItem.usable === true
      )
        ok(`A10 · ${FIX_EMAIL} health 注入 (daily=80 · usable=true)`);
      else
        ng(
          `A10 · alice health`,
          `daily=${aliceItem && aliceItem.health && aliceItem.health.daily} usable=${aliceItem && aliceItem.usable}`,
        );

      // bob 已过 trial · usable=false
      const bobItem = items.find((it) => it.email === "bob.test@example.com");
      if (bobItem && bobItem.usable === false)
        ok("A11 · bob.test@example.com Trial 过期 · usable=false");
      else
        ng(
          "A11 · bob usable",
          `usable=${bobItem && bobItem.usable} h=${JSON.stringify((bobItem && bobItem.health) || {})}`,
        );
    }

    // ─── B · 守隐 · 不返完整 password / token ───
    if (lastLocal) {
      const items = lastLocal.items || [];
      const raw = JSON.stringify(lastLocal);
      // 不应含完整密
      if (!raw.includes(FIX_PASSWORD))
        ok("B1 · response 不含完整 password (脱密)");
      else ng("B1 · 守隐 password", "response 含 FIX_PASSWORD");
      if (!raw.includes("plain_pass_xyz"))
        ok("B2 · response 不含完整 plain_pass_xyz");
      else ng("B2 · 守隐 plain_pass_xyz", "含");
      if (!raw.includes("colonpass456"))
        ok("B3 · response 不含完整 colonpass456");
      else ng("B3 · 守隐 colonpass456", "含");
      // 不应含完整 token
      if (!raw.includes(FIX_AUTH1))
        ok("B4 · response 不含完整 FIX_AUTH1 token");
      else ng("B4 · 守隐 AUTH1 token", "含");
      if (!raw.includes(FIX_AUTH1_EMAIL_TOK))
        ok("B5 · response 不含完整 email_token AUTH1");
      else ng("B5 · 守隐 email_token AUTH1", "含");
      // 应含 fingerprint (12 hex)
      const aliceItem = items.find((it) => it.email === FIX_EMAIL);
      if (aliceItem && aliceItem.passwordFp === _fp(FIX_PASSWORD))
        ok("B6 · passwordFp 等于本地 sha256[0:12]");
      else
        ng(
          "B6 · passwordFp",
          `${aliceItem && aliceItem.passwordFp} 期 ${_fp(FIX_PASSWORD)}`,
        );
      // emailMasked 形 a***t@example.com (alice.test 之首 'a' + 末 't')
      if (
        aliceItem &&
        /^[a-z]\*\*\*[a-z]@example\.com$/i.test(aliceItem.emailMasked) &&
        aliceItem.emailMasked.startsWith(FIX_EMAIL[0]) &&
        aliceItem.emailMasked.includes(
          FIX_EMAIL[FIX_EMAIL.indexOf("@") - 1] + "@",
        )
      )
        ok(
          `B7 · emailMasked 形 X***Y@example.com (实 ${aliceItem.emailMasked})`,
        );
      else ng("B7 · emailMasked", aliceItem && aliceItem.emailMasked);
      // tokenMasked 形 前 12 + … + 后 4
      const auth1Item = items.find(
        (it) => it.kind === "token" && it.tokenKind === "auth1",
      );
      if (
        auth1Item &&
        typeof auth1Item.tokenMasked === "string" &&
        auth1Item.tokenMasked.startsWith(FIX_AUTH1.slice(0, 12)) &&
        auth1Item.tokenMasked.endsWith(FIX_AUTH1.slice(-4))
      )
        ok("B8 · auth1 tokenMasked 形 前12+…+后4");
      else ng("B8 · tokenMasked", auth1Item && auth1Item.tokenMasked);
    }

    // ─── C · POST /admin/wam/use · 单件入池 ───
    // C1 · index 缺 · 400
    {
      const r = await probe("POST", "/admin/wam/use", H, {});
      if (r.status === 400 && r.json && r.json.error === "index_required")
        ok("C1 · POST /admin/wam/use 缺 index · 400");
      else ng("C1 · use 缺 index", `status=${r.status}`);
    }
    // C2 · index 越界 · 404
    {
      const r = await probe("POST", "/admin/wam/use", H, { index: 999 });
      if (r.status === 404 && r.json && r.json.error === "index_out_of_range")
        ok("C2 · index 越界 · 404");
      else ng("C2 · 越界", `status=${r.status}`);
    }
    // C3 · index=auth1 单 token (第 0 项 line 4 之 token) · auto → token-direct → 入池
    let auth1Idx = -1;
    if (lastLocal) {
      auth1Idx = lastLocal.items.findIndex(
        (it) => it.kind === "token" && it.tokenKind === "auth1",
      );
    }
    if (auth1Idx < 0) {
      ng("C3-prep · 找 auth1 单 token 之 idx", "未找到 (lastLocal 缺?)");
    } else {
      const r = await probe("POST", "/admin/wam/use", H, { index: auth1Idx });
      if (
        r.status === 200 &&
        r.json &&
        r.json.ok &&
        r.json.mode === "token-direct" &&
        r.json.action === "pool.push" &&
        r.json.count === 1
      )
        ok(
          `C3 · index=${auth1Idx} (auth1 单) · auto → token-direct · pool.push count=1`,
        );
      else
        ng(
          "C3 · auto token-direct",
          `status=${r.status} mode=${r.json && r.json.mode} count=${r.json && r.json.count}`,
        );
    }
    // C4 · 重复同 index · duplicate=true · count 不增
    if (auth1Idx >= 0) {
      const r = await probe("POST", "/admin/wam/use", H, { index: auth1Idx });
      if (
        r.status === 200 &&
        r.json &&
        r.json.ok &&
        r.json.duplicate === true &&
        r.json.count === 1
      )
        ok("C4 · 重复 use · duplicate=true · count=1");
      else
        ng(
          "C4 · 去重",
          `dup=${r.json && r.json.duplicate} count=${r.json && r.json.count}`,
        );
    }
    // C5 · index=email_token (auth1.test001) · auto → token-direct
    let emailTokenIdx = -1;
    if (lastLocal) {
      emailTokenIdx = lastLocal.items.findIndex(
        (it) => it.kind === "email_token",
      );
    }
    if (emailTokenIdx < 0) {
      ng("C5-prep · 找 email_token idx", "未找到");
    } else {
      const r = await probe("POST", "/admin/wam/use", H, {
        index: emailTokenIdx,
      });
      if (
        r.status === 200 &&
        r.json &&
        r.json.ok &&
        r.json.mode === "token-direct" &&
        r.json.email === FIX_AUTH1_EMAIL &&
        r.json.count === 2
      )
        ok(
          `C5 · index=${emailTokenIdx} (email_token) · email=${FIX_AUTH1_EMAIL} count=2`,
        );
      else
        ng(
          "C5 · email_token",
          `status=${r.status} email=${r.json && r.json.email} count=${r.json && r.json.count}`,
        );
    }
    // C6 · index=ignored · 400 not_usable
    let ignoredIdx = -1;
    if (lastLocal) {
      ignoredIdx = lastLocal.items.findIndex((it) => it.kind === "ignored");
    }
    if (ignoredIdx >= 0) {
      const r = await probe("POST", "/admin/wam/use", H, {
        index: ignoredIdx,
      });
      if (r.status === 400 && r.json && r.json.error === "item_not_usable")
        ok("C6 · ignored 项 · 400 not_usable");
      else ng("C6 · ignored", `status=${r.status}`);
    } else {
      ng("C6 · 找 ignored idx", "未找到");
    }
    // C7 · mode='token-direct' 显式 · 但 index 是 email_password (无 token) · 400 token_not_resolvable
    let emailPwIdx = -1;
    if (lastLocal) {
      emailPwIdx = lastLocal.items.findIndex(
        (it) => it.kind === "email_password",
      );
    }
    if (emailPwIdx >= 0) {
      const r = await probe("POST", "/admin/wam/use", H, {
        index: emailPwIdx,
        mode: "token-direct",
      });
      if (r.status === 400 && r.json && r.json.error === "token_not_resolvable")
        ok("C7 · email_pw + token-direct mode · 400 token_not_resolvable");
      else
        ng(
          "C7 · email_pw + token-direct",
          `status=${r.status} err=${r.json && r.json.error}`,
        );
    } else {
      ng("C7 · 找 email_password idx", "未找到");
    }

    // ─── D · auth 守门 (印 106 + 印 133 自承) ───
    // D1 · 无 token · 401
    {
      const r = await probe("GET", "/admin/wam/local", null, null);
      if (r.status === 401) ok("D1 · 无 auth · 401");
      else ng("D1 · 无 auth", `status=${r.status}`);
    }
    // D2 · 错 token · 403
    {
      const r = await probe(
        "POST",
        "/admin/wam/use",
        { Authorization: "Bearer wrong-seal133-token" },
        { index: 0 },
      );
      if (r.status === 403) ok("D2 · 错 token · 403");
      else ng("D2 · 错 token", `status=${r.status}`);
    }

    // ─── E · 404 hint 含印 133 ───
    {
      const r = await probe("GET", "/no-such-print133-path", H);
      if (
        r.status === 404 &&
        r.json &&
        r.json.hint &&
        r.json.hint.includes("/admin/wam/local") &&
        r.json.hint.includes("/admin/wam/use") &&
        r.json.hint.includes("印 133")
      )
        ok("E1 · 404 hint 含印 133 二路");
      else ng("E1 · 404 hint", "缺印 133 二路");
    }
  } catch (e) {
    ng("dynamic guard 整链", e.message);
  } finally {
    if (daemon) await killDaemon(daemon);
  }
}

// ════════════════════════════════════════════════════════════════════
// § 三 · 透返 · 无 .wam 时 available=false (Devin VM 端兼容)
// ════════════════════════════════════════════════════════════════════
async function passthroughGuard() {
  console.log("\n═══ 三 · 透返 · 无 ~/.wam 时 available=false ═══");
  // 用一个绝对不存的临时 dir
  const NOWHERE = path.join(os.tmpdir(), "_seal133_nowhere_" + Date.now());
  let daemon;
  try {
    daemon = await spawnDaemon(NOWHERE);
    ok("dao_proxy daemon 起 · WAM_LOCAL_PATH=" + NOWHERE);
    const H = { Authorization: "Bearer " + AUTH };
    const r = await probe("GET", "/admin/wam/local", H);
    if (
      r.status === 200 &&
      r.json &&
      r.json.ok === true &&
      r.json.available === false
    )
      ok("F1 · /admin/wam/local · available=false (Devin VM 端透返)");
    else
      ng("F1 · 透返", `status=${r.status} avail=${r.json && r.json.available}`);
    // /admin/wam/use 应 404 wam_md_not_found
    const r2 = await probe("POST", "/admin/wam/use", H, { index: 0 });
    if (r2.status === 404 && r2.json && r2.json.error === "wam_md_not_found")
      ok("F2 · /admin/wam/use 无 accounts.md · 404 wam_md_not_found");
    else
      ng(
        "F2 · 透返 use",
        `status=${r2.status} err=${r2.json && r2.json.error}`,
      );
  } catch (e) {
    ng("passthroughGuard 整链", e.message);
  } finally {
    if (daemon) await killDaemon(daemon);
  }
}

// ════════════════════════════════════════════════════════════════════
// § 四 · 总
// ════════════════════════════════════════════════════════════════════
async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log(" 印 133 · 反者道之动 · WAM 本地真本源桥守门");
  console.log("═══════════════════════════════════════════════════");
  prepareFixture();
  try {
    staticGuard();
    await dynamicGuard();
    await passthroughGuard();
  } finally {
    cleanupFixture();
  }
  console.log(`\n═══ 印 133 总: ${pass} 过 / ${fail} 失 ═══`);
  if (fail > 0) {
    console.log("\n失:");
    fails.forEach((f) => console.log("  - " + f));
    process.exit(1);
  } else {
    console.log(
      "\n✓ WAM 本地真本源桥通 · ~/.wam → /admin/wam/{local,use} · 反者道之动",
    );
    process.exit(0);
  }
}

main().catch((e) => {
  console.error("crash:", e.stack || e.message);
  process.exit(1);
});
