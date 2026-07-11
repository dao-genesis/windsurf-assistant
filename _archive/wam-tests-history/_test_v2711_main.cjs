// _test_v2711_main.cjs · v2.7.1.1 主公三诏「token 看做账号密码 · 直接复用一切」实证测套
//
// *道生一，一生二，二生三，三生万物。万物负阴而抱阳，中气以为和*
//
// 缘起 (主公三诏 2026-05-14):
//   v2.7.1 治了 parseAccountText 的「email----auth1_xxx 错入 password」病
//   但 v2.7.1 改用 acc.auth1/sessionToken/refreshToken 三字段 · schema 日益
//   主公诏: 将 token 看做账号密码 · 直接复用 v2.7.0 经典链 · 顺其自然
//
// 治法 (v2.7.1.1 · 闻道者日损):
//   §α parseAccountText 复返 {accounts, tokens} 同 v2.7.0 · token 直入 accounts.password 槽
//   §β _persistAccountsToMd 单形落盘 "email password" 同 v2.7.0
//   §γ addBatch 返 {added, duplicate, tokens, addedEmails} 无 tokenPairs
//   §δ _normalizeAccCreds(acc) · 登录入口浅复制 + _detectTokenKind 自动分流
//   §ε webview/wam.injectToken/wam.addToken 三处 tokenPairs 中转死代码已弃
//
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const EXT = path.join(__dirname, "extension.js");
const src = fs.readFileSync(EXT, "utf8");

let pass = 0,
  fail = 0;
function check(name, ok, ctx) {
  if (ok) {
    console.log("  [OK] " + name + (ctx ? " | " + ctx : ""));
    pass++;
  } else {
    console.log("  [X ] " + name + (ctx ? " | " + ctx : ""));
    console.log("       !! FAIL: " + name);
    fail++;
  }
}

console.log("================================================================");
console.log("  v2.7.1.1 主公三诏「token 看做账号密码」最后一公里 · 实证测");
console.log("================================================================");

// ─── §1 静态契约 · 主公三诏关键标记 ─────────────────────────────────
console.log("\n[§1] 静态契约 · v2.7.1.1 治法五道");

check(
  "§1.A VERSION ≥ 2.7.2 (主公三诏 v2.7.1.1 内涵 + SemVer 合规·容 patch bumps)",
  /const\s+VERSION\s*=\s*"2\.7\.([2-9]|\d{2,})"/.test(src),
);
check(
  "§1.B _normalizeAccCreds 函数已立",
  /function\s+_normalizeAccCreds\s*\(/.test(src),
  "公器·登录入口分流",
);
check(
  "§1.C verifyOneAccount 调 _normalizeAccCreds",
  /verifyOneAccount[\s\S]{0,400}_normalizeAccCreds\s*\(\s*account/.test(src),
);
check(
  "§1.D loginAccount 调 _normalizeAccCreds",
  /loginAccount[\s\S]{0,400}_normalizeAccCreds\s*\(\s*store\.accounts/.test(
    src,
  ),
);
check(
  "§1.E parseAccountText 复 v2.7.0 形 (不返 tokenPairs)",
  /return\s*\{\s*accounts,\s*tokens\s*\};\s*\n\}\s*\nfunction\s+loadAccountsFromFs/.test(
    src,
  ),
  "末 return { accounts, tokens } 紧邻 loadAccountsFromFs",
);
check(
  "§1.F _persistAccountsToMd 单形落盘 (不输出 auth1:/session:/refresh: 前缀)",
  /_persistAccountsToMd\s*\(\)\s*\{[\s\S]{0,800}a\.password\s*\?\s*a\.email\s*\+\s*"\s+"\s*\+\s*a\.password\s*:\s*a\.email/.test(
    src,
  ),
);
check(
  "§1.G addBatch 仅返 addedEmails (无 tokenPairs/tokenUpdated 字段)",
  /addBatch\s*\(\s*text\s*\)\s*\{[\s\S]{0,1500}return\s*\{\s*added,\s*duplicate,\s*tokens,\s*addedEmails\s*\}/.test(
    src,
  ),
);
check(
  "§1.H webview addBatch handler 不再有 tokenPairs 中转",
  !/tps\s*=\s*r\.tokenPairs/.test(src),
);
check(
  "§1.I banner 标主公三诏 (v2.7.1.1 内涵)",
  /主公三诏[\s\S]{0,200}_normalizeAccCreds/.test(src),
);
check(
  "§1.J wam.addToken 走 addedEmails verifyOneAccount (不依 tokenPairs)",
  /wam\.addToken[\s\S]{0,800}verifyOneAccount/.test(src),
);

// ─── §2 vm 抽离 · 实证行为 ───────────────────────────────────
console.log("\n[§2] 函抽 · 实证 _normalizeAccCreds 与 parseAccountText 行为");

function extractFn(name) {
  const re = new RegExp("function\\s+" + name + "\\s*\\([^)]*\\)\\s*\\{", "m");
  const m = src.match(re);
  if (!m) return null;
  let d = 0,
    i = src.indexOf("{", m.index);
  for (; i < src.length; i++) {
    if (src[i] === "{") d++;
    else if (src[i] === "}") {
      d--;
      if (d === 0) return src.substring(m.index, i + 1);
    }
  }
  return null;
}

// v2.7.5 · parseAccountText 末段用 crypto.createHash · vm ctx 须注入
const ctx = vm.createContext({ crypto: require("node:crypto") });
for (const fn of [
  "_isValidEmail",
  "_stripWxHints",
  "_isNoiseLine",
  "_detectTokenKind",
  "_normalizeAccCreds",
  "parseAccountText",
]) {
  const c = extractFn(fn);
  if (!c) {
    console.log("✗ 函抽 FAIL: " + fn);
    process.exit(1);
  }
  vm.runInContext(c, ctx);
}
const nm = vm.runInContext("_normalizeAccCreds", ctx);
const pa = vm.runInContext("parseAccountText", ctx);
const dt = vm.runInContext("_detectTokenKind", ctx);

console.log("  ✓ vm 抽离 6 函数成");

// ─── §3 _normalizeAccCreds · 5 kind 映射 ──────────────────────
console.log("\n[§3] _normalizeAccCreds 智能分流 · 5 token kind");

{
  const r = nm({ email: "a@b.com", password: "auth1_" + "a".repeat(50) });
  check(
    "§3.1 auth1 形 → out.auth1 + 删 password",
    r.auth1 && r.auth1.startsWith("auth1_") && !r.password,
    "auth1=" +
      (r.auth1 || "").substring(0, 20) +
      "... pw=" +
      (r.password || "(空)"),
  );
}
{
  const r = nm({
    email: "a@b.com",
    password: "devin-session-token$" + "x".repeat(40),
  });
  check(
    "§3.2 session 形 → out.sessionToken + 删 password",
    r.sessionToken &&
      r.sessionToken.startsWith("devin-session-token$") &&
      !r.password,
  );
}
{
  const r = nm({
    email: "a@b.com",
    password:
      "eyJ" + "A".repeat(20) + "." + "B".repeat(20) + "." + "C".repeat(20),
  });
  check(
    "§3.3 JWT 形 → out.sessionToken (windsurf authProvider 同接)",
    r.sessionToken && r.sessionToken.startsWith("eyJ") && !r.password,
  );
}
{
  const r = nm({ email: "a@b.com", password: "sk-" + "k".repeat(30) });
  check(
    "§3.4 apikey 形 → out.sessionToken (透传 inject)",
    r.sessionToken && r.sessionToken.startsWith("sk-") && !r.password,
  );
}
{
  const r = nm({ email: "a@b.com", password: "Z".repeat(70) });
  check(
    "§3.5 raw 60+ 兜底 → out.sessionToken (宁错 inject 不错 devinLogin)",
    r.sessionToken && r.sessionToken.length === 70 && !r.password,
  );
}
{
  const r = nm({ email: "a@b.com", password: "mypassword123" });
  check(
    "§3.6 真密码 (kind=null) → out.password 不动",
    r.password === "mypassword123" && !r.auth1 && !r.sessionToken,
  );
}
{
  const r = nm({ email: "a@b.com" });
  check(
    "§3.7 无 password · 透传不变",
    r.email === "a@b.com" && !r.password && !r.auth1,
  );
}
{
  const r = nm(null);
  check("§3.8 null 入参 · 安返 null", r === null);
}

// ─── §4 显式字段优先 (向前兼容) ──────────────────────────────
console.log("\n[§4] 显式 acc.auth1/sessionToken 已存 · 不覆盖 (向前兼容)");

{
  const r = nm({
    email: "a@b.com",
    password: "auth1_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    auth1: "auth1_yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy",
  });
  check(
    "§4.1 acc.auth1 已存 · password 槽 token 不再映射 (显式优先)",
    r.auth1 && r.auth1.endsWith("yyyy") && r.password,
    "auth1=...yyyy · password 保留",
  );
}
{
  const r = nm({
    email: "a@b.com",
    password: "auth1_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    sessionToken: "devin-session-token$existing",
  });
  check(
    "§4.2 acc.sessionToken 已存 · 不映射 password",
    r.sessionToken === "devin-session-token$existing" && r.password,
  );
}
{
  const r = nm({
    email: "a@b.com",
    password: "auth1_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  });
  // 浅复制 · 修改 r 不污原
  r.auth1 = "modified";
  const r2 = nm({
    email: "a@b.com",
    password: "auth1_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  });
  check(
    "§4.3 浅复制 · 不污原对象 (再调返新对象)",
    r2.auth1 && r2.auth1.startsWith("auth1_b") && !r2.password,
  );
}

// ─── §5 parseAccountText 主公三诏 · token 直入 password 槽 ──────
console.log(
  "\n[§5] parseAccountText 主公三诏 · pair-token → accounts.password 槽",
);

{
  const r = pa("卡号: foo@gmail.com----auth1_" + "a".repeat(52));
  check(
    "§5.1 用户图2 email----auth1 · 入 accounts.password 槽",
    r.accounts.length === 1 &&
      r.accounts[0].email === "foo@gmail.com" &&
      r.accounts[0].password.startsWith("auth1_"),
  );
  check(
    "§5.2 _detectTokenKind 验回 kind=auth1",
    dt(r.accounts[0].password) === "auth1",
  );
}
{
  const r = pa(
    "卡号: a@b.com----auth1_" +
      "a".repeat(52) +
      "\n" +
      "卡号: c@d.com----auth1_" +
      "b".repeat(52),
  );
  check(
    "§5.3 两枚 email+auth1 · 双双入 password 槽",
    r.accounts.length === 2 &&
      r.accounts[0].password.startsWith("auth1_") &&
      r.accounts[1].password.startsWith("auth1_") &&
      r.accounts[0].password !== r.accounts[1].password,
  );
}
{
  const r = pa("foo@gmail.com\n" + "auth1_" + "a".repeat(52));
  check(
    "§5.4 多行配对 (email 先 token 后) · 入 password",
    r.accounts.length === 1 && r.accounts[0].password.startsWith("auth1_"),
  );
}
{
  const r = pa("auth1_" + "a".repeat(52) + "\n" + "foo@gmail.com");
  check(
    "§5.5 反序 (token 先 email 后) · 入 password · tokens 不留",
    r.accounts.length === 1 &&
      r.accounts[0].password.startsWith("auth1_") &&
      r.tokens.length === 0,
  );
}
{
  const r = pa("foo@gmail.com\ndevin-session-token$" + "x".repeat(40));
  check(
    "§5.6 session token 多行配对 · 入 password",
    r.accounts.length === 1 &&
      r.accounts[0].password.startsWith("devin-session-token$"),
  );
}
{
  const r = pa("foo@gmail.com mypassword123");
  check(
    "§5.7 真密码 (空格分隔) · 入 password · kind=null",
    r.accounts.length === 1 &&
      r.accounts[0].password === "mypassword123" &&
      dt(r.accounts[0].password) === null,
  );
}
{
  const r = pa(
    JSON.stringify({
      email: "foo@gmail.com",
      auth1_token: "auth1_" + "a".repeat(52),
    }),
  );
  check(
    "§5.8 JSON {email, auth1_token} · 入 password 槽",
    r.accounts.length === 1 && r.accounts[0].password.startsWith("auth1_"),
  );
}
{
  // v2.7.5 主公诏: 真孤儿 token (无 email) → 占位 email 入 accounts · tokens 清空
  // 旧契约 (v2.7.0-v2.7.4): tokens 数组留孤儿待显式反查 · 此契约已被 v2.7.5 主公诏正式更新
  const tk = "auth1_" + "a".repeat(52);
  const r = pa(tk);
  check(
    "§5.9 单孤儿 token (无 email) → 占位 email 入 accounts (v2.7.5·万物自宾)",
    r.accounts.length === 1 &&
      r.tokens.length === 0 &&
      /^auth1\.[a-f0-9]{8}@token\.wam$/i.test(r.accounts[0].email) &&
      r.accounts[0].password === tk,
    "accounts.length=" +
      r.accounts.length +
      " tokens.length=" +
      r.tokens.length +
      (r.accounts[0] ? " email=" + r.accounts[0].email : ""),
  );
}

// ─── §6 不返 tokenPairs (主公三诏·闻道者日损) ────────────────
console.log("\n[§6] parseAccountText 不返 tokenPairs (闻道者日损·schema 守一)");

{
  const r = pa("a@b.com----auth1_" + "x".repeat(52));
  check(
    "§6.1 返对象只有 accounts, tokens 二字段",
    Object.keys(r).sort().join(",") === "accounts,tokens",
  );
  check("§6.2 无 tokenPairs 字段", r.tokenPairs === undefined);
}

// ─── §7 端到端 · _normalizeAccCreds 接 parseAccountText 出果 ──
console.log("\n[§7] 端到端 · parseAccountText → _normalizeAccCreds (登录前)");

{
  const parsed = pa("卡号: foo@gmail.com----auth1_" + "a".repeat(52));
  const mapped = nm(parsed.accounts[0]);
  check(
    "§7.1 端到端: email----auth1 → accounts → _normalizeAccCreds → out.auth1",
    mapped.auth1 && mapped.auth1.startsWith("auth1_") && !mapped.password,
    "auth1=" + mapped.auth1.substring(0, 20) + "...",
  );
}
{
  const parsed = pa("foo@gmail.com\ndevin-session-token$" + "x".repeat(40));
  const mapped = nm(parsed.accounts[0]);
  check(
    "§7.2 端到端: email + session → _normalizeAccCreds → out.sessionToken",
    mapped.sessionToken &&
      mapped.sessionToken.startsWith("devin-session-token$") &&
      !mapped.password,
  );
}
{
  const parsed = pa("foo@gmail.com mypassword123");
  const mapped = nm(parsed.accounts[0]);
  check(
    "§7.3 端到端: email + 真密码 → _normalizeAccCreds → out.password (devinLogin 路)",
    mapped.password === "mypassword123" &&
      !mapped.auth1 &&
      !mapped.sessionToken,
  );
}

// ─── §8 不退化 · v2.7.0 经典形仍通 ──────────────────────────
console.log("\n[§8] 不退化 · v2.7.0/v2.6.x 经典形仍通");

{
  const r = pa("foo@gmail.com:bar@baz%qux");
  check(
    "§8.1 含 @ 密码 (v2.7.0 治) · 仍入 password 槽",
    r.accounts.length === 1 && r.accounts[0].password === "bar@baz%qux",
  );
}
{
  const r = pa("邮箱:foo@gmail.com\n密码:abc123");
  check(
    "§8.2 标签多行 (邮箱:/密码:) · v2.6.x 形仍通",
    r.accounts.length === 1 &&
      r.accounts[0].email === "foo@gmail.com" &&
      r.accounts[0].password === "abc123",
  );
}
{
  const r = pa(
    "自动发货 2026-05-14 13:21:49\n" +
      "账号:foo@gmail.com\n" +
      "密码:uuCO4@7hukcO\n" +
      "账号管理器:http://x.example.com",
  );
  check(
    "§8.3 微信发货原文 · 噪声跳·账密留",
    r.accounts.length === 1 &&
      r.accounts[0].email === "foo@gmail.com" &&
      r.accounts[0].password === "uuCO4@7hukcO",
  );
}

// ─── §9 综合极端 · 主公图2 + 真密码 + 反序 + JSON 同段 ────────
console.log("\n[§9] 综合 · 主公图2 + 真密码 + 反序 + JSON 多形混入");

{
  const r = pa(
    [
      // 用户图2 形
      "卡号: foo@gmail.com----auth1_" + "a".repeat(52),
      // 经典账密
      "bar@gmail.com mypassword123",
      // JSON 形
      JSON.stringify({
        email: "baz@gmail.com",
        sessionToken: "devin-session-token$" + "x".repeat(40),
      }),
      // 反序
      "auth1_" + "b".repeat(52),
      "qux@gmail.com",
    ].join("\n"),
  );
  check(
    "§9.1 综合 · 4 形混 · 出 4 accounts",
    r.accounts.length === 4,
    "actual=" + r.accounts.length,
  );
  const byEmail = {};
  for (const a of r.accounts) byEmail[a.email] = a.password;
  check(
    "§9.2 foo 走 auth1 形",
    (byEmail["foo@gmail.com"] || "").startsWith("auth1_"),
  );
  check(
    "§9.3 bar 走真密码 (kind=null)",
    byEmail["bar@gmail.com"] === "mypassword123" &&
      dt(byEmail["bar@gmail.com"]) === null,
  );
  check(
    "§9.4 baz 走 session",
    (byEmail["baz@gmail.com"] || "").startsWith("devin-session-token$"),
  );
  check(
    "§9.5 qux 走反序 auth1",
    (byEmail["qux@gmail.com"] || "").startsWith("auth1_"),
  );
  check("§9.6 tokens 空 (全配对)", r.tokens.length === 0);
}

// ─── §10 持久化形读回 (兼容 v2.7.1 形落盘的 4 形读) ──────────
console.log(
  "\n[§10] 兼容: v2.7.1 落盘 4 形 (auth1:/session:/refresh:) 仍能读回",
);

{
  // v2.7.1 落盘形 (前缀形) · v2.7.1.1 主公诏: 重读时仍能识 (parseAccountText 内 _isPrefixedToken)
  const r = pa("foo@gmail.com auth1:auth1_" + "a".repeat(52));
  check(
    "§10.1 'email auth1:auth1_xxx' 读回 · 入 password 槽",
    r.accounts.length === 1 &&
      r.accounts[0].password.startsWith("auth1_") &&
      dt(r.accounts[0].password) === "auth1",
  );
}
{
  const r = pa("foo@gmail.com session:devin-session-token$" + "x".repeat(40));
  check(
    "§10.2 'email session:xxx' 读回",
    r.accounts.length === 1 &&
      r.accounts[0].password.startsWith("devin-session-token$"),
  );
}

// ─── 总结 ──────────────────────────────────────────────────
console.log("");
console.log("================================================================");
console.log("  v2.7.1.1 主公三诏 · 测毕: " + pass + " 过 / " + fail + " 败");
console.log("================================================================");

process.exit(fail > 0 ? 1 : 0);
