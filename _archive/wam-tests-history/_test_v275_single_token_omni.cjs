// _test_v275_single_token_omni.cjs · v2.7.5 治「单独 token 无法添加登录」· 实证测套
//
// 主公诏 (15:09):
//   "继续推进 并解决单独token无法添加登录之问题
//    token登录后账号信息均可查询 用户无为 无感 适配万法之格式"
//   主公图1 五行 auth1_xxx (无 email 同行配对)
//
// 病诊 (v2.7.4 残漏):
//   parseAccountText 末段 · 孤儿 token → tokens.push(raw)
//   addBatch 拿 parsed.accounts (空) · 仅返 tokens 数组 · UI 显 "0 added"
//   用户图1 五行 auth1 token → 入库 0 号
//
// 治法 (v2.7.5 · 道恒无名·万物自宾):
//   §A parseAccountText 末段 · 孤儿 token → 占位 email 入 accounts
//   §B 立 _isPlaceholderEmail · UI/verify 路径快判
//   §C webview domainBadge 加 "tk" · 占位号视觉可识
//
// 本测套实证 7 节·30+ 测:
//   §1 静态契约 (banner / VERSION / parseAccountText 末段 / _isPlaceholderEmail / .dm.tk)
//   §2 _isPlaceholderEmail 严判 (5 kind × pos/neg)
//   §3 占位 email 形 通 _isValidEmail (合法 email 形)
//   §4 主公图1 端到端 · 5 行 auth1_xxx → accounts.length === 5
//   §5 多 kind 混粘 · auth1+session+jwt+refresh+raw 五形俱全
//   §6 幂等 · 同 token 反复粘 · 不重复
//   §7 不退化 (v2.7.0/v2.7.1.1/v2.7.4 兼容)
//
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
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
console.log("  v2.7.5 治「单独 token 无法添加登录」· 道恒无名·万物自宾");
console.log("================================================================");

// ─── §1 静态契约 ─────────────────────────────────────────────────────
console.log("\n[§1] 静态契约 · v2.7.5 治法关键标记");

check(
  "§1.A VERSION ≥ 2.7.5",
  /const\s+VERSION\s*=\s*"2\.7\.([5-9]|\d{2,})"/.test(src),
);

check(
  "§1.B 头注解含 单独 token / 道恒无名 / 万物自宾 / 占位 email",
  /单独\s*token/.test(src) &&
    /道恒无名/.test(src) &&
    /万物.*自宾/.test(src) &&
    /占位\s*email|占位号/.test(src),
);

check(
  "§1.C parseAccountText 末段含 孤儿 token → 占位 email 转 accounts 路径",
  /for\s*\(\s*const\s+tk\s+of\s+tokens\s*\)[\s\S]{0,800}placeholder[\s\S]{0,200}accounts\.push/.test(
    src,
  ),
  "tokens 循环 · placeholder 构建 · accounts.push",
);

check(
  "§1.D 占位 email 形含 sha256(token).slice(0,8) + @token.wam",
  /createHash\s*\(\s*["']sha256["']\s*\)[\s\S]{0,200}substring\s*\(\s*0\s*,\s*8\s*\)[\s\S]{0,200}@token\.wam/.test(
    src,
  ),
);

check(
  "§1.E _isPlaceholderEmail 函数声明 + 严判 regex",
  /function\s+_isPlaceholderEmail\s*\([\s\S]{0,300}auth1\|session\|jwt\|apikey\|refresh\|raw[\s\S]{0,200}@token\\\.wam/.test(
    src,
  ),
);

check(
  "§1.F webview domainBadge 加 'tk' · _isPlaceholderEmail(a.email) 判定",
  /isTokenOnly\s*=\s*_isPlaceholderEmail\s*\(\s*a\.email\s*\)[\s\S]{0,300}domainBadge\s*=\s*isTokenOnly\s*\?\s*["']tk["']/.test(
    src,
  ),
);

check(
  "§1.G CSS .dm.tk 配色 (金黄·token-only 美学)",
  /\.dm\.tk\s*\{\s*background\s*:\s*#5a3a14[\s\S]{0,100}color\s*:\s*#f0c674/.test(
    src,
  ),
);

check(
  "§1.H _isPlaceholderEmail 暴露在 _internals (供测/集成)",
  /_isPlaceholderEmail\s*,\s*\/\//.test(src) ||
    /_isPlaceholderEmail\s*:\s*_isPlaceholderEmail/.test(src) ||
    /_internals[\s\S]{0,2000}_isPlaceholderEmail/.test(src),
);

check(
  "§1.I banner 第二行含 '单独 token 占位号入 accounts'",
  /单独\s*token\s*占位号入\s*accounts/.test(src),
);

check(
  "§1.J tokens 数组清空 (孤儿尽转后 · 兼容 v2.7.1.1 返字段不破)",
  /tokens\.length\s*=\s*0/.test(src),
);

// ─── §2 抽函数到隔离 vm · 真验行为 ──────────────────────────────────
console.log("\n[§2] _isPlaceholderEmail 严判 (5 kind × pos/neg)");

// 用 regex 抽出函数源码 · 平衡花括号扫描 (复刻 v2.7.0 测套手法)
function extractFn(name) {
  const re = new RegExp("function\\s+" + name + "\\s*\\([^)]*\\)\\s*\\{", "m");
  const m = src.match(re);
  if (!m) return null;
  const start = m.index;
  let depth = 0;
  let i = src.indexOf("{", start);
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.substring(start, i + 1);
    }
  }
  return null;
}

const fnIsValidEmail = extractFn("_isValidEmail");
const fnStripWxHints = extractFn("_stripWxHints");
const fnIsNoiseLine = extractFn("_isNoiseLine");
const fnDetectTokenKind = extractFn("_detectTokenKind");
const fnIsPlaceholderEmail = extractFn("_isPlaceholderEmail");
const fnParseAccountText = extractFn("parseAccountText");

if (
  !fnIsValidEmail ||
  !fnStripWxHints ||
  !fnIsNoiseLine ||
  !fnDetectTokenKind ||
  !fnIsPlaceholderEmail ||
  !fnParseAccountText
) {
  console.log("× 函数抽离失败 · 终止");
  console.log(
    "  fnIsValidEmail=" +
      !!fnIsValidEmail +
      " fnIsPlaceholderEmail=" +
      !!fnIsPlaceholderEmail +
      " fnParseAccountText=" +
      !!fnParseAccountText,
  );
  process.exit(1);
}

// 注入 crypto (parseAccountText 末段用 createHash) · vm 隔离需显式 ctx 注入
const ctx = vm.createContext({ crypto });
vm.runInContext(fnIsValidEmail, ctx);
vm.runInContext(fnStripWxHints, ctx);
vm.runInContext(fnIsNoiseLine, ctx);
vm.runInContext(fnDetectTokenKind, ctx);
vm.runInContext(fnIsPlaceholderEmail, ctx);
vm.runInContext(fnParseAccountText, ctx);

const _isValidEmail = vm.runInContext("_isValidEmail", ctx);
const _isPlaceholderEmail = vm.runInContext("_isPlaceholderEmail", ctx);
const _detectTokenKind = vm.runInContext("_detectTokenKind", ctx);
const parseAccountText = vm.runInContext("parseAccountText", ctx);

const placeholderPos = [
  "auth1.abcd1234@token.wam",
  "session.deadbeef@token.wam",
  "jwt.cafebabe@token.wam",
  "refresh.feedface@token.wam",
  "apikey.0a1b2c3d@token.wam",
  "raw.99887766@token.wam",
  "AUTH1.ABCDEF12@TOKEN.WAM", // 大小写不敏感
];
for (const p of placeholderPos) {
  check(
    "§2.pos · " + p + " · _isPlaceholderEmail = true",
    _isPlaceholderEmail(p),
  );
}

const placeholderNeg = [
  "user@gmail.com",
  "auth1@token.wam", // 缺 sha8
  "auth1.abcd@token.wam", // sha 不足 8
  "auth1.abcd12345@token.wam", // sha 多于 8
  "auth1.zzzz1234@token.wam", // 非 hex
  "auth1.abcd1234@token.com", // domain 不对
  "fake.abcd1234@token.wam", // kind 不对
  "",
  null,
];
for (const n of placeholderNeg) {
  check(
    "§2.neg · " + JSON.stringify(n) + " · _isPlaceholderEmail = false",
    !_isPlaceholderEmail(n),
  );
}

// ─── §3 占位 email 形 通 _isValidEmail (合法 email · 全栈兼容) ─────────
console.log("\n[§3] 占位 email · 通 _isValidEmail (合法 email · 全栈兼容)");

for (const p of placeholderPos.slice(0, 6)) {
  check(
    "§3 · " + p + " · _isValidEmail = true (parseAccountText 重启读回需此)",
    _isValidEmail(p),
  );
}

// ─── §4 主公图1 端到端 · 5 行 auth1 token ─────────────────────────────
console.log("\n[§4] 主公图1 端到端 · 5 行 auth1 token → accounts.length === 5");

const SUITE_5_TOKENS = `auth1_3e3xrful4yilxulsqk6pjz5p3are35n2srijfwys6yjowecgkiuq
auth1_qtqwhyhjakr6m5e56is7b26hl65ohq6amainkaggllepw5qrepfq
auth1_d7hacx2jdgfuzuuxlqvolv3w5lflnb46zvxqsly225nixjvaobpq
auth1_xerar5ccoqggn5n4p6br7lusrxggjkkza6rxjw4kpy3ex6liqcaq
auth1_z2f63fxmeixlx622xngzsr7jhso7765gt3ycl5kwulnh3oiydacq`;

{
  const r = parseAccountText(SUITE_5_TOKENS);
  check(
    "§4.A 5 行 auth1 → accounts.length === 5",
    r.accounts.length === 5,
    "actual=" + r.accounts.length,
  );
  check(
    "§4.B 每号 password = 原 auth1 token (与原行字符匹配)",
    r.accounts.every((a, i) => {
      const expected = SUITE_5_TOKENS.split("\n")[i].trim();
      return a.password === expected;
    }),
    "passwords " +
      r.accounts.map((a) => a.password.substring(0, 12) + "..").join(", "),
  );
  check(
    "§4.C 每号 email 通 _isPlaceholderEmail (合法占位形)",
    r.accounts.every((a) => _isPlaceholderEmail(a.email)),
    "emails " + r.accounts.map((a) => a.email).join(", "),
  );
  check(
    "§4.D 每号 email 含 'auth1.' 前缀 (kind 标识)",
    r.accounts.every((a) => /^auth1\./.test(a.email)),
  );
  check(
    "§4.E sha8 来自 sha256(token).slice(0,8) (确定性·验首号)",
    r.accounts[0].email ===
      "auth1." +
        crypto
          .createHash("sha256")
          .update(SUITE_5_TOKENS.split("\n")[0].trim())
          .digest("hex")
          .substring(0, 8) +
        "@token.wam",
  );
  check(
    "§4.F tokens 数组已清空 (孤儿尽转 accounts · 兼容)",
    r.tokens.length === 0,
    "tokens.length=" + r.tokens.length,
  );
}

// ─── §5 多 kind 混粘 · _detectTokenKind 五分支俱全 ──────────────────────
console.log(
  "\n[§5] 多 kind 混粘 · auth1/session/jwt/apikey/raw 五形 (_detectTokenKind 直接分支)",
);

{
  // 凑 5 形 token (合 _detectTokenKind 五个直接分支 · 不依赖 _isPrefixedToken)
  const auth1Tk = "auth1_" + "a".repeat(52);
  const sessTk = "devin-session-token$" + "x".repeat(40);
  const jwtTk =
    "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0In0.AbCdEfGhIjKlMnOpQrStUvWxYzAbCdEfGhIjKlMnOpQ";
  const apikeyTk = "sk-" + "k".repeat(48); // _detectTokenKind: /^sk-[A-Za-z0-9_\-]{20,}$/ → apikey
  const rawTk =
    "0a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f9";

  // 单元先验: 各形 _detectTokenKind 分支匹配
  check("§5.0a auth1Tk 识 'auth1'", _detectTokenKind(auth1Tk) === "auth1");
  check("§5.0b sessTk 识 'session'", _detectTokenKind(sessTk) === "session");
  check("§5.0c jwtTk 识 'jwt'", _detectTokenKind(jwtTk) === "jwt");
  check("§5.0d apikeyTk 识 'apikey'", _detectTokenKind(apikeyTk) === "apikey");
  check("§5.0e rawTk 识 'raw'", _detectTokenKind(rawTk) === "raw");

  const text = [auth1Tk, sessTk, jwtTk, apikeyTk, rawTk].join("\n");
  const r = parseAccountText(text);
  check(
    "§5.A 5 形混粘 → accounts.length === 5 (各形各号)",
    r.accounts.length === 5,
    "actual=" +
      r.accounts.length +
      " emails=" +
      r.accounts.map((a) => a.email).join(","),
  );
  // 各 kind 前缀
  const expectedKinds = ["auth1", "session", "jwt", "apikey", "raw"];
  for (let i = 0; i < 5; i++) {
    if (i >= r.accounts.length) {
      check(
        "§5.B." + (i + 1) + " · " + expectedKinds[i] + " 前缀 (索引越界跳)",
        false,
        "accounts.length=" + r.accounts.length,
      );
      continue;
    }
    const got = r.accounts[i].email.split(".")[0].toLowerCase();
    check(
      "§5.B." +
        (i + 1) +
        " · 第 " +
        (i + 1) +
        " 号 email 前缀 = '" +
        expectedKinds[i] +
        "'",
      got === expectedKinds[i],
      "got=" + got + " full=" + r.accounts[i].email,
    );
  }
}

// ─── §6 幂等 · 同 token 反复粘 ────────────────────────────────────────
console.log("\n[§6] 幂等 · 同 token 反复粘 · 不重复");

{
  const tk = "auth1_" + "b".repeat(52);
  const text = tk + "\n" + tk + "\n" + tk; // 三行同 token
  const r = parseAccountText(text);
  check(
    "§6.A 三行同 token · accounts.length === 1 (sha8 决定 placeholder 唯一)",
    r.accounts.length === 1,
    "actual=" + r.accounts.length,
  );
}

// ─── §7 不退化 · v2.7.0/v2.7.1.1/v2.7.4 兼容 ──────────────────────────
console.log("\n[§7] 不退化 · v2.7.0/v2.7.1.1/v2.7.4 兼容");

{
  // v2.7.0 经典: email password
  const r1 = parseAccountText("user@gmail.com mypass123");
  check(
    "§7.A v2.7.0 经典 email+password · 1 号 (无占位 email 干扰)",
    r1.accounts.length === 1 &&
      r1.accounts[0].email === "user@gmail.com" &&
      r1.accounts[0].password === "mypass123",
  );
  check(
    "§7.A.1 v2.7.0 号不通过 _isPlaceholderEmail",
    !_isPlaceholderEmail(r1.accounts[0].email),
  );
}

{
  // v2.7.1 token-pair: email----auth1_xxx
  const r2 = parseAccountText("user2@gmail.com----auth1_" + "c".repeat(52));
  check(
    "§7.B v2.7.1 email----auth1 · 1 号 (token 入 password 槽 · 真 email 不变)",
    r2.accounts.length === 1 &&
      r2.accounts[0].email === "user2@gmail.com" &&
      /^auth1_/.test(r2.accounts[0].password),
  );
  check(
    "§7.B.1 v2.7.1 号不通过 _isPlaceholderEmail (真 email 形)",
    !_isPlaceholderEmail(r2.accounts[0].email),
  );
}

{
  // 混合: 1 真号 + 2 单独 token
  const text = [
    "real@yahoo.com pass1",
    "auth1_" + "d".repeat(52),
    "auth1_" + "e".repeat(52),
  ].join("\n");
  const r3 = parseAccountText(text);
  check(
    "§7.C 混合 1 真 + 2 单 token → accounts.length === 3",
    r3.accounts.length === 3,
    "actual=" + r3.accounts.length,
  );
  check(
    "§7.C.1 真号 email 不变",
    r3.accounts.find((a) => a.email === "real@yahoo.com") != null,
  );
  check(
    "§7.C.2 2 单 token 通过 _isPlaceholderEmail",
    r3.accounts.filter((a) => _isPlaceholderEmail(a.email)).length === 2,
  );
}

// ─── 结果 ─────────────────────────────────────────────────────────
console.log(
  "\n================================================================",
);
console.log(
  "  v2.7.5 治「单独 token 无法添加登录」· 测毕: " +
    pass +
    " 过 / " +
    fail +
    " 败",
);
console.log("  道恒无名·万物自宾·民莫之令而自均·适配万法之格式");
console.log("================================================================");
process.exit(fail > 0 ? 1 : 0);
