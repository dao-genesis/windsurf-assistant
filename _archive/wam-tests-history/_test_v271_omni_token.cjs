// _test_v271_omni_token.cjs · v2.7.1 万法归一·token 直登 · 回归测
//
// 反者道之动 · 逆流解析所有 windsurf 相关 token 登录机制
// 任意形式 token 也可直接登录管理 · 道法自然 · 无为而无不为
//
// 缘起 (用户实证 2026-05-14 · 用户图1+图2):
//   图1 "+ 添加账号" UI 草图 · 7 类: 智能识别/Devin账密/Devin邮件/Devin Session/Devin auth1/邮箱密码/Refresh Token
//   图2 微信发货 "卡号: email----auth1_<52字符>" 格式 · v2.7.0 误为 (email, password=auth1) 入库
//   图3 v2.7.0 138号 1未验 25耗尽 · 真本源是入库 auth1 被当 password · devinLogin 必失败
//
// 治法 (v2.7.1):
//   §A 立 _detectTokenKind(s) · 5 类 (auth1/session/jwt/apikey/raw) · 单一信源
//   §B tryPair 升级 · email+token 优先 (返 {email,token,kind})
//   §C JSON 路径扩 · auth1_token/refreshToken/devinSessionToken 等字段
//   §D 标签路径 (token: xxx) 内含 _detectTokenKind 决 type:'token' 带 kind
//   §E 持久化前缀形 "auth1:xxx" / "session:xxx" / "refresh:xxx" · _isPrefixedToken 识
//   §F items 加 'pair-token' · 配对循环 token 优先 pendingEmail
//   §G addBatch 返 tokenPairs · 入 accounts 加 auth1/sessionToken/refreshToken 字段
//   §H loginViaToken / resolveSessionTokenFromCreds 统一 token 登录入口
//   §I loginAccount/verifyOneAccount 三链择优 (auth1 > session > password)
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
console.log("  v2.7.1 万法归一·token 直登 · 反者道之动 · 回归测");
console.log("================================================================");

// ─── §1 静态契约 ──────────────────────────────────────────────────────
console.log("\n[§1] 静态契约 · v2.7.1 治法五道入源");

check(
  "§1.A _detectTokenKind 函数已立",
  /function\s+_detectTokenKind\s*\(/.test(src),
  "5 类 token 单一信源",
);
check(
  "§1.B _detectTokenKind 识 auth1",
  src.indexOf('return "auth1"') > 0 && src.indexOf("auth1_") > 0,
  "auth1_<40+字符>",
);
check(
  "§1.C _detectTokenKind 识 session",
  src.indexOf('return "session"') > 0 && src.indexOf("devin-session-token") > 0,
);
check(
  "§1.D _detectTokenKind 识 jwt",
  src.indexOf('return "jwt"') > 0 && src.indexOf("eyJ[") > 0,
);
check(
  "§1.E _detectTokenKind 识 apikey",
  src.indexOf('return "apikey"') > 0 && src.indexOf("sk-[") > 0,
);
check(
  "§1.F _detectTokenKind 兜底 raw",
  /return\s+"raw"/.test(src),
  "60+ chars · base64-ish",
);
check(
  "§1.G _isPrefixedToken 识持久化形",
  /function\s+_isPrefixedToken\s*\(/.test(src) &&
    /auth1\|session\|refresh\|jwt\|apikey/.test(src),
  '"auth1:xxx" / "session:xxx" / "refresh:xxx"',
);
check(
  "§1.H tryPair 返 token-pair (kind)",
  /token:\s*[ab],\s*kind:/.test(src) || /kind:\s*pT\.kind/.test(src),
  "(email, token, kind) 而非 (email, password)",
);
// v2.7.1.1 主公三诏: parseAccountText 复 v2.7.0 schema · 不返 tokenPairs (token 直入 password 槽)
check(
  "§1.I parseAccountText 复 v2.7.0 schema (主公三诏·闻道者日损)",
  /return\s*\{\s*accounts,\s*tokens\s*\};\s*\n\}\s*\nfunction\s+loadAccountsFromFs/.test(
    src,
  ),
);
check(
  "§1.J addBatch 仅返 addedEmails (v2.7.1.1 · token 入 password 槽·不再中转)",
  /addBatch\s*\(\s*text\s*\)\s*\{[\s\S]{0,1500}return\s*\{\s*added,\s*duplicate,\s*tokens,\s*addedEmails\s*\}/.test(
    src,
  ),
);
check(
  "§1.K resolveSessionTokenFromCreds 立",
  /async\s+function\s+resolveSessionTokenFromCreds/.test(src),
);
check("§1.L loginViaToken 立", /async\s+function\s+loginViaToken/.test(src));
check(
  "§1.M loginAccount 三链择优",
  /\u51ed\u636e\u62e9\u4f18/.test(src) &&
    /sourceUsed\s*=\s*"auth1"/.test(src) &&
    /sourceUsed\s*=\s*"session"/.test(src) &&
    /sourceUsed\s*=\s*"password"/.test(src),
);
check(
  "§1.N verifyOneAccount 三链择优",
  /verifyOneAccount[\s\S]{0,800}auth1[\s\S]{0,500}sessionToken[\s\S]{0,500}password/.test(
    src,
  ),
);
check(
  "§1.O _persistAccountsToMd v2.7.1.1 单形落盘 (同 v2.7.0·token 与密码同居 password)",
  /_persistAccountsToMd\s*\(\)\s*\{[\s\S]{0,800}a\.password\s*\?\s*a\.email\s*\+\s*"\s+"\s*\+\s*a\.password\s*:\s*a\.email/.test(
    src,
  ),
);

// ─── §2 函抽离 vm · 真验行为 ────────────────────────────────────────
console.log("\n[§2] 行为验证 · 移植关键函数至隔离 vm");

function extractFn(name) {
  const re = new RegExp("function\\s+" + name + "\\s*\\([^)]*\\)\\s*\\{", "m");
  const m = src.match(re);
  if (!m) return null;
  let depth = 0,
    i = src.indexOf("{", m.index);
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.substring(m.index, i + 1);
    }
  }
  return null;
}

const fnIsValidEmail = extractFn("_isValidEmail");
const fnStripWxHints = extractFn("_stripWxHints");
const fnIsNoiseLine = extractFn("_isNoiseLine");
const fnDetectTokenKind = extractFn("_detectTokenKind");
const fnParseAccountText = extractFn("parseAccountText");

check("§2.0a 抽出 _isValidEmail", !!fnIsValidEmail);
check("§2.0b 抽出 _stripWxHints", !!fnStripWxHints);
check("§2.0c 抽出 _isNoiseLine", !!fnIsNoiseLine);
check("§2.0d 抽出 _detectTokenKind", !!fnDetectTokenKind);
check("§2.0e 抽出 parseAccountText", !!fnParseAccountText);

if (
  !fnIsValidEmail ||
  !fnStripWxHints ||
  !fnIsNoiseLine ||
  !fnDetectTokenKind ||
  !fnParseAccountText
) {
  console.log("\n× 函数抽离失败 · 终止行为测");
  console.log(`\n═══ 结果: ${pass} 过 / ${fail} 败 ═══`);
  process.exit(1);
}

// v2.7.5 · parseAccountText 末段用 crypto.createHash · vm ctx 须注入
const ctx = vm.createContext({ crypto: require("node:crypto") });
vm.runInContext(fnIsValidEmail, ctx);
vm.runInContext(fnStripWxHints, ctx);
vm.runInContext(fnIsNoiseLine, ctx);
vm.runInContext(fnDetectTokenKind, ctx);
vm.runInContext(fnParseAccountText, ctx);
const detectKind = vm.runInContext("_detectTokenKind", ctx);
const parseAccountText = vm.runInContext("parseAccountText", ctx);

// ─── §3 _detectTokenKind 单元测 ──────────────────────────────────────
console.log("\n[§3] _detectTokenKind · 5 类 token 严判");

const auth1Sample =
  "auth1_bkkarcz7a5c5grafdekzuazk3w3vob6lm4xpg22j3i27wxrnmtfa"; // 用户图2 实证
const sessSample =
  "devin-session-token$abc123XYZ4567890abc123XYZ4567890abc123XYZ4567890XX";
const jwtSample =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4ifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
const apikeySample = "sk-abcdef1234567890ABCDEF1234567890XYZ";
const rawSample = "X".repeat(70);

check("§3.1 auth1 识别", detectKind(auth1Sample) === "auth1");
check("§3.2 session 识别", detectKind(sessSample) === "session");
check("§3.3 jwt 识别", detectKind(jwtSample) === "jwt");
check("§3.4 apikey 识别", detectKind(apikeySample) === "apikey");
check("§3.5 raw 兜底", detectKind(rawSample) === "raw");
check("§3.6 null 非 token", detectKind("password123") === null);
check("§3.7 null 含 @ 非 token", detectKind("foo@bar.com") === null);
check("§3.8 null 短 base64", detectKind("abc123") === null);
check("§3.9 auth1 短于 40 字符 不识", detectKind("auth1_short") === null);
check("§3.10 空 返 null", detectKind("") === null);
check("§3.11 null 输入", detectKind(null) === null);

// ─── §4 v2.7.0 核心病灶治理 · 用户图2 email----auth1 ──────────────────
console.log("\n[§4] 治用户图2 病灶 · email----auth1_token");

const wxToken = `卡号: richardjordan4393486748@gmail.com----auth1_bkkarcz7a5c5grafdekzuazk3w3vob6lm4xpg22j3i27wxrnmtfa
卡号: jacob003314897095@gmail.com----auth1_ntnnrlm7ocrrw5dipz7gsp473uxn47hxfvooepbpbzjjbtmam3ta`;

// v2.7.1.1 主公三诏: token 直入 accounts.password 槽 (与真密码同居·下游 _normalizeAccCreds 自动分流)
const r4 = parseAccountText(wxToken);
check(
  "§4.1 accounts 入 2 个 (token 与密码同居 password)",
  r4.accounts.length === 2,
);
check("§4.2 tokens 空 (同行配对完)", r4.tokens.length === 0);
if (r4.accounts.length === 2) {
  check(
    "§4.3 第一 email 正",
    r4.accounts[0].email === "richardjordan4393486748@gmail.com",
    "actual=" + r4.accounts[0].email,
  );
  check(
    "§4.4 第一 password 槽 kind=auth1",
    detectKind(r4.accounts[0].password) === "auth1",
  );
  check(
    "§4.5 第一 password 体正",
    r4.accounts[0].password ===
      "auth1_bkkarcz7a5c5grafdekzuazk3w3vob6lm4xpg22j3i27wxrnmtfa",
  );
  check(
    "§4.6 第二 email 正",
    r4.accounts[1].email === "jacob003314897095@gmail.com",
  );
  check(
    "§4.7 第二 password kind=auth1",
    detectKind(r4.accounts[1].password) === "auth1",
  );
}

// ─── §5 持久化形 "auth1:xxx" / "session:xxx" / "refresh:xxx" ───────────
console.log("\n[§5] 持久化前缀形 · _persistAccountsToMd 之果反加载");

const persist = `foo@gmail.com auth1:auth1_bkkarcz7a5c5grafdekzuazk3w3vob6lm4xpg22j3i27wxrnmtfa
bar@gmail.com session:devin-session-token$abc123XYZ4567890abc123XYZ4567890abc123XYZ4567890XX
baz@gmail.com refresh:eyJrZWZ0ZXNoUDplc3Rfb2theQ
classical@gmail.com password123`;

// v2.7.1.1 主公三诏: 4 形均入 accounts · token 与密码同居 password 槽 · 下游自识分流
const r5 = parseAccountText(persist);
check(
  "§5.1 4 形全入 accounts (主公三诏·token 与密码同居)",
  r5.accounts.length === 4,
  "count=" + r5.accounts.length,
);
if (r5.accounts.length === 4) {
  const byEmail = (em) => r5.accounts.find((a) => a.email === em);
  check(
    "§5.2 classical 走真密码 · kind=null",
    detectKind(byEmail("classical@gmail.com")?.password) === null,
  );
  check(
    "§5.3 foo password kind=auth1",
    detectKind(byEmail("foo@gmail.com")?.password) === "auth1",
  );
  check(
    "§5.4 foo password 体正",
    byEmail("foo@gmail.com")?.password ===
      "auth1_bkkarcz7a5c5grafdekzuazk3w3vob6lm4xpg22j3i27wxrnmtfa",
  );
  check(
    "§5.5 bar password kind=session",
    detectKind(byEmail("bar@gmail.com")?.password) === "session",
  );
  // refresh 形 主公三诏下 · 入 password 槽 · 但 _detectTokenKind 不识 "eyJ…" 短 JWT 样本为 refresh
  // _isPrefixedToken 路径中 · kind 从前缀推 · 完整 token 体入·但 _detectTokenKind 不一定能识回
  check(
    "§5.6 baz password 体正 (refresh 形 token 体入 password 槽)",
    byEmail("baz@gmail.com")?.password === "eyJrZWZ0ZXNoUDplc3Rfb2theQ",
  );
}

// ─── §6 JSON 形 ─────────────────────────────────────────────────────
console.log("\n[§6] JSON 形 · 4 token 字段");

// v2.7.1.1: JSON 任何 token 字段均入 accounts.password 槽 (同 v2.7.0 schema)
const jsonAuth1 =
  '{"email":"foo@x.com","auth1_token":"auth1_bkkarcz7a5c5grafdekzuazk3w3vob6lm4xpg22j3i27wxrnmtfa"}';
const r6a = parseAccountText(jsonAuth1);
check(
  "§6.1 JSON.auth1_token · 入 accounts.password 槽 · kind=auth1",
  r6a.accounts.length === 1 &&
    r6a.accounts[0].email === "foo@x.com" &&
    detectKind(r6a.accounts[0].password) === "auth1",
);

const jsonSess =
  '{"email":"bar@x.com","sessionToken":"devin-session-token$abc123XYZ4567890abc123XYZ4567890abc123XYZ4567890XX"}';
const r6b = parseAccountText(jsonSess);
check(
  "§6.2 JSON.sessionToken · 入 accounts.password 槽 · kind=session",
  r6b.accounts.length === 1 &&
    detectKind(r6b.accounts[0].password) === "session",
);

const jsonRefresh =
  '{"email":"baz@x.com","refresh_token":"eyJrZWZ0ZXNoUDplc3Rfb2theQ"}';
const r6c = parseAccountText(jsonRefresh);
check(
  "§6.3 JSON.refresh_token · 入 accounts.password 槽",
  r6c.accounts.length === 1 &&
    r6c.accounts[0].password === "eyJrZWZ0ZXNoUDplc3Rfb2theQ",
);

const jsonStandalone =
  '{"auth1":"auth1_bkkarcz7a5c5grafdekzuazk3w3vob6lm4xpg22j3i27wxrnmtfa"}';
const r6d = parseAccountText(jsonStandalone);
// v2.7.5 主公诏: 孤儿 auth1 (JSON 无 email) → 占位 email 入 accounts · password = 原 token
check(
  "§6.4 JSON.auth1 (无 email) → 占位 入 accounts (v2.7.5 主公诏·名不可名·万物自宾)",
  r6d.accounts.length === 1 &&
    r6d.tokens.length === 0 &&
    /^auth1\.[a-f0-9]{8}@token\.wam$/i.test(r6d.accounts[0].email) &&
    detectKind(r6d.accounts[0].password) === "auth1",
  "accounts.length=" +
    r6d.accounts.length +
    " tokens.length=" +
    r6d.tokens.length +
    (r6d.accounts[0] ? " email=" + r6d.accounts[0].email : ""),
);

// ─── §7 反序 token 先 email 后 ──────────────────────────────────────
console.log("\n[§7] 多行反序配对 · token 先 email 后");

const rev1 = `auth1_bkkarcz7a5c5grafdekzuazk3w3vob6lm4xpg22j3i27wxrnmtfa
foo@gmail.com`;
// v2.7.1.1 主公三诏: 反序 token · token 直入 accounts.password 槽 (与真密码同居)
const r7a = parseAccountText(rev1);
check(
  "§7.1 反序 token 配 email · 入 accounts.password 槽 · kind=auth1",
  r7a.accounts.length === 1 &&
    r7a.accounts[0].email === "foo@gmail.com" &&
    detectKind(r7a.accounts[0].password) === "auth1",
);
check("§7.2 反序场景 tokens 不重复直登", r7a.tokens.length === 0);

const rev2 = `邮箱: foo@gmail.com
auth1: auth1_bkkarcz7a5c5grafdekzuazk3w3vob6lm4xpg22j3i27wxrnmtfa`;
const r7b = parseAccountText(rev2);
check(
  "§7.3 标签多行 (邮箱+auth1) 配对 · 入 accounts.password 槽",
  r7b.accounts.length === 1 &&
    r7b.accounts[0].email === "foo@gmail.com" &&
    detectKind(r7b.accounts[0].password) === "auth1",
);

// ─── §8 多种分隔符 email+token 配对 ───────────────────────────────────
console.log("\n[§8] 多种分隔符 · email+token");

const seps = [
  `foo@x.com auth1_bkkarcz7a5c5grafdekzuazk3w3vob6lm4xpg22j3i27wxrnmtfa`, // 空白
  `foo@x.com:auth1_bkkarcz7a5c5grafdekzuazk3w3vob6lm4xpg22j3i27wxrnmtfa`, // 冒号
  `foo@x.com|auth1_bkkarcz7a5c5grafdekzuazk3w3vob6lm4xpg22j3i27wxrnmtfa`, // pipe
  `foo@x.com,auth1_bkkarcz7a5c5grafdekzuazk3w3vob6lm4xpg22j3i27wxrnmtfa`, // 逗号
  `foo@x.com\tauth1_bkkarcz7a5c5grafdekzuazk3w3vob6lm4xpg22j3i27wxrnmtfa`, // Tab
];
// v2.7.1.1: 主公三诏 · 任分隔符下均入 accounts.password 槽
for (let i = 0; i < seps.length; i++) {
  const r = parseAccountText(seps[i]);
  check(
    `§8.${i + 1} 分隔符${i + 1} · 入 accounts.password 槽 · kind=auth1`,
    r.accounts.length === 1 &&
      r.accounts[0].email === "foo@x.com" &&
      detectKind(r.accounts[0].password) === "auth1",
    "actual=" + JSON.stringify(r),
  );
}

// ─── §9 token kind 综合 (session/jwt/raw) ──────────────────────────────
console.log("\n[§9] 多 kind token-pair");

const sessLine =
  "foo@x.com----devin-session-token$abc123XYZ4567890abc123XYZ4567890abc123XYZ4567890XX";
// v2.7.1.1: 主公三诏 · session/JWT 均入 accounts.password 槽 · detectKind 验回
const r9a = parseAccountText(sessLine);
check(
  "§9.1 email----session-token · 入 password 槽 · kind=session",
  r9a.accounts.length === 1 &&
    detectKind(r9a.accounts[0].password) === "session",
);

const jwtLine =
  "foo@x.com\teyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
const r9b = parseAccountText(jwtLine);
check(
  "§9.2 email\\tJWT · 入 password 槽 · kind=jwt",
  r9b.accounts.length === 1 && detectKind(r9b.accounts[0].password) === "jwt",
  "actual=" + JSON.stringify(r9b),
);

// ─── §10 兼容 v2.7.0 经典格式不退化 ────────────────────────────────────
console.log("\n[§10] 兼容 v2.7.0 经典格式 · 不退化");

const classic = `foo@bar.com mypass
a@b.com:pass2
卡号1: card@x.com
卡密1: cardpass@hard
密码: secret
邮箱: rev@x.com
{"email":"j@x.com","password":"jpass"}`;
const r10 = parseAccountText(classic);
check(
  "§10.1 经典 5 accounts (空白/冒号/卡号-卡密/反序密码-邮箱/JSON)",
  r10.accounts.length === 5,
  "actual=" +
    r10.accounts.length +
    " emails=" +
    r10.accounts.map((a) => a.email).join(","),
);
check("§10.2 tokens 空 (无 token 形)", r10.tokens.length === 0);
check(
  "§10.3 tokenPairs 未定义 (v2.7.1.1 复 v2.7.0 schema)",
  r10.tokenPairs === undefined,
);

// ─── §11 综合极端 · 一文混万法 (含 v2.7.0 + v2.7.1) ────────────────────
console.log("\n[§11] 综合极端 · 一文混万法 · 唯变所适");

const omni = `# 注释
foo@bar.com pass1
a@b.com:pass2

# v2.7.1 token-pair
card1@x.com----auth1_bkkarcz7a5c5grafdekzuazk3w3vob6lm4xpg22j3i27wxrnmtfa
{"email":"json@x.com","auth1":"auth1_ntnnrlm7ocrrw5dipz7gsp473uxn47hxfvooepbpbzjjbtmam3ta"}

# 持久化形 (重启加载场景)
persist1@x.com auth1:auth1_zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz
persist2@x.com session:devin-session-token\$abcdef1234567890abcdef1234567890abcdef1234567890XX

# 反序
auth1_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
rev@x.com

# 单独 token (无 email)
auth1_solo0000000000000000000000000000000000000000000000

# 微信广告噪声
自动发货 2026-05-14 10:00:00
您的订单编号为:1234567890
账号管理器:点tps://abc.com(去掉点)
`;
// v2.7.1.1 主公三诏: 经典与 token 全入 accounts.password 槽 · detectKind 分流
// v2.7.5 主公诏补: 孤儿 token (无 email 同行配对) → 占位 email 入 accounts · tokens 清空
const r11 = parseAccountText(omni);
check(
  "§11.1 accounts 8 个 (7 真 + 1 占位 · v2.7.5 主公诏·孤儿 token 入 accounts)",
  r11.accounts.length === 8,
  "actual=" +
    r11.accounts.length +
    " emails=" +
    r11.accounts
      .map((a) => a.email + "/" + (detectKind(a.password) || "pw"))
      .join(","),
);
check(
  "§11.2 tokens 0 个 (v2.7.5: 孤儿尽转 accounts · tokens 清空)",
  r11.tokens.length === 0,
  "actual=" + r11.tokens.length,
);
check(
  "§11.3 噪声跳过 · accounts.length + tokens.length === 8 (总守 · v2.7.5 8+0=8)",
  r11.accounts.length + r11.tokens.length === 8,
);
check(
  "§11.4 tokenPairs 未定义 (主公三诏·闻道者日损)",
  r11.tokenPairs === undefined,
);

// ─── 结果 ───────────────────────────────────────────────────────────
console.log(
  "\n================================================================",
);
console.log(`  v2.7.1 万法归一·token 直登 · 测毕: ${pass} 过 / ${fail} 败`);
console.log("================================================================");
process.exit(fail > 0 ? 1 : 0);
