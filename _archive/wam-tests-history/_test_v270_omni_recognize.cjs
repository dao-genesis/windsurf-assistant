// _test_v270_omni_recognize.cjs · v2.7.0 万法识号·守道反者 · 回归测
//
// 反者道之动 · 弱之胜强 柔之胜刚 · 唯变所适 · 适应万法之格式 · 无为而无不为
//
// 实证依据 (用户实景四图 · 2026-05-09):
//   图1 · 账号列表大量 "?天 / 未验 / D? / W?" → 入库账号被严重污染
//   图2 · "+ 添加账号" 输入区 placeholder · 用户依此粘贴
//   图3 · 微信自动发货消息 (含 "账号:..\n密码:..@..\n账号管理器:点tps://..(去掉点)")
//   图4 · 卡号/卡密带数字编号格式 (卡号1: a@b.com / 卡密1: XuE2@UXoq7JD)
//
// 病诊:
//   ① 「卡号N: / 卡密N:」未在标签词典 · 走 parseSingleLine → tryPair 错认
//   ② 「密码:uuCO4@7hukcO」(密码含 @) 现行 if(!v.includes("@")) 跳过 → 落入兜底误为新 email
//   ③ tryPair 仅以 includes("@") 认 email · 导致 "卡号1" 入库为密码 / token 入库为 email
//   ④ 反向配对 (pass 在前 email 在后) 缺失
//
// 治法 (v2.7.0):
//   §A 立 _isValidEmail 严判 · 替代 includes('@')
//   §B 扩标签词典 · 兼容 \d* 数字编号
//   §C 标签即定锚 · 守一不退 (密码标签后含@仍为密码 · 邮箱标签后必合法 email 才认)
//   §D pendingPass 反向配对
//   §E 噪声行嗅探: '账号管理器:' '点tps:' '(去掉点)' '订单编号' 等静默跳过
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
console.log("  v2.7.0 万法识号·守道反者 · 一切账号格式同源 · 回归测");
console.log("================================================================");

// ─── §1 静态契约 (源码存在性) ───────────────────────────────────────
console.log("\n[§1] 静态契约 · 治法五道入源");

check(
  "§1.A _isValidEmail 函数已立",
  /function\s+_isValidEmail\s*\(/.test(src),
  "严判 local@domain.tld",
);

check(
  "§1.B _isNoiseLine 噪声嗅探已立",
  /function\s+_isNoiseLine\s*\(/.test(src),
  "微信广告/订单/账号管理器 静默跳过",
);

check(
  "§1.C 标签词典含 '卡号'",
  /RE_LABEL_EMAIL\s*=[\s\S]{0,500}卡号/.test(src),
  "图4 卡号N: 入识号词典",
);

check(
  "§1.D 标签词典含 '卡密'",
  /RE_LABEL_PASS\s*=[\s\S]{0,500}卡密/.test(src),
  "图4 卡密N: 入识号词典",
);

check(
  "§1.E 标签后兼容 \\d* 数字编号",
  /RE_LABEL_EMAIL\s*=[\s\S]{0,500}\\s\*\\d\*\\s\*\[:：=＝\]/.test(src) ||
    /\\s\*\\d\*\\s\*\[:：=＝\][\s\S]{0,500}RE_LABEL_PASS/.test(src),
  "卡号1:/账号2:/Email3: 自动识号",
);

check(
  "§1.F tryPair 用 _isValidEmail",
  /function\s+tryPair[\s\S]{0,400}_isValidEmail/.test(src),
  "不再以 includes('@') 草率认 email",
);

check(
  "§1.G 双向配对 · pendingPass 已立",
  /pendingPass\s*=\s*null/.test(src) &&
    /pendingPass\s*=\s*it\.password/.test(src),
  "反序 (pass 先 email 后) 亦通",
);

check(
  "§1.H 密码标签守一: 不再以 'v.includes(\"@\")' 排除",
  !/passM[\s\S]{0,200}!v\.includes\("@"\)/.test(src),
  "uuCO4@7hukcO 等含@密码不再误为 email",
);

// ─── §2 抽离三函数到隔离 vm · 真验行为 ──────────────────────────────
console.log("\n[§2] 行为验证 · 移植 parseAccountText 至隔离上下文");

// 用 regex 抽出三个函数源码 · 注意 parseAccountText 含闭包 · 整体抠
function extractFn(name) {
  const re = new RegExp("function\\s+" + name + "\\s*\\([^)]*\\)\\s*\\{", "m");
  const m = src.match(re);
  if (!m) return null;
  const start = m.index;
  // 平衡花括号扫描
  let depth = 0;
  let i = src.indexOf("{", start);
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) {
        return src.substring(start, i + 1);
      }
    }
  }
  return null;
}

const fnIsValidEmail = extractFn("_isValidEmail");
const fnStripWxHints = extractFn("_stripWxHints");
const fnIsNoiseLine = extractFn("_isNoiseLine");
const fnParseAccountText = extractFn("parseAccountText");

check("§2.0a 抽出 _isValidEmail 源", !!fnIsValidEmail);
check("§2.0b 抽出 _stripWxHints 源", !!fnStripWxHints);
check("§2.0c 抽出 _isNoiseLine 源", !!fnIsNoiseLine);
check("§2.0d 抽出 parseAccountText 源", !!fnParseAccountText);

if (
  !fnIsValidEmail ||
  !fnStripWxHints ||
  !fnIsNoiseLine ||
  !fnParseAccountText
) {
  console.log("\n× 函数抽离失败 · 终止行为测");
  console.log(`\n═══ 结果: ${pass} 过 / ${fail} 败 ═══`);
  process.exit(1);
}

const ctx = vm.createContext({});
vm.runInContext(fnIsValidEmail, ctx);
vm.runInContext(fnStripWxHints, ctx);
vm.runInContext(fnIsNoiseLine, ctx);
vm.runInContext(fnParseAccountText, ctx);

const isValidEmail = vm.runInContext("_isValidEmail", ctx);
const parseAccountText = vm.runInContext("parseAccountText", ctx);

// ─── §3 _isValidEmail 单元测 ────────────────────────────────────────
console.log("\n[§3] _isValidEmail · 严判单元测");

check("§3.1 合法 gmail", isValidEmail("foo@gmail.com"));
check("§3.2 合法 大小写混", isValidEmail("F.O.MIna.D.a.ryAqNv.N.Q@gmail.com"));
check("§3.3 合法 +tag", isValidEmail("foo+tag@bar.co.jp"));
check("§3.4 合法 多点 local", isValidEmail("f.om.i.nADa.rYAq.nvNQ@gmail.com"));
check("§3.5 合法 短", isValidEmail("a@b.io"));

check(
  "§3.6 非法 仅含@",
  !isValidEmail("uuCO4@7hukcO"),
  "无 TLD · 视为非 email",
);
check(
  "§3.7 非法 仅token形",
  !isValidEmail("XuE2@UXoq7JD"),
  "卡密被错认 email 之根因",
);
check("§3.8 非法 含空格", !isValidEmail("foo @bar.com"));
check("§3.9 非法 含全角逗号", !isValidEmail("foo@bar，com"));
check("§3.10 非法 空", !isValidEmail(""));
check("§3.11 非法 null", !isValidEmail(null));
check("§3.12 非法 仅 @", !isValidEmail("@"));
check("§3.13 非法 无 TLD", !isValidEmail("foo@bar"));
check("§3.14 非法 TLD 一字母", !isValidEmail("foo@bar.c"));

// ─── §4 图3 微信自动发货格式 ────────────────────────────────────────
console.log("\n[§4] 图3 · 微信自动发货 · '密码含@' 不再误判");

const wxAuto = `自动发货 2026-05-09 13:21:49
您的订单编号为:5115053162084007107
账号:fo.min.a.daRy.a.qnv.nq@gmail.com   (无任何空格)
密码:uuCO4@7hukcO    (无任何空格)
账号管理器:ht点tps://wwbnm.lan点zoub.com/iAOHM3p1r11e(去掉点)`;

const r4 = parseAccountText(wxAuto);
check(
  "§4.1 识出 1 个账号",
  r4.accounts.length === 1,
  "actual=" + r4.accounts.length,
);
if (r4.accounts.length >= 1) {
  check(
    "§4.2 email 正确",
    r4.accounts[0].email === "fo.min.a.daRy.a.qnv.nq@gmail.com",
    "actual=" + r4.accounts[0].email,
  );
  check(
    "§4.3 密码 'uuCO4@7hukcO' 守一不退 (含@仍为密码)",
    r4.accounts[0].password === "uuCO4@7hukcO",
    "actual=" + r4.accounts[0].password,
  );
}
check("§4.4 无误识 token", r4.tokens.length === 0);
check(
  "§4.5 '账号管理器:' 噪声未误入",
  !r4.accounts.some((a) => a.email.includes("点")) &&
    !r4.accounts.some((a) => a.password && a.password.includes("点")),
);

// ─── §5 图4 卡号/卡密 带数字编号格式 ────────────────────────────────
console.log("\n[§5] 图4 · 卡号N:/卡密N: · 5 卡全识");

const cardFormat = `卡号1: f.om.i.nADa.rYAq.nvNQ@gmail.com
卡密1: XuE2@UXoq7JD
卡号2: F.O.MIna.D.a.ryAqNv.N.Q@gmail.com
卡密2: aY4@smD3i5hp
卡号3: fo.m.in.A.da.R.yaQnv.nQ@gmail.com
卡密3: 5Q1n@j5gIpx3
卡号4: f.omi.NAD.aryaq.N.vn.q@gmail.com
卡密4: uTkw@0BWVNn0
卡号5: f.O.M.i.N.ad.ar.Yaq.nvnq@gmail.com
卡密5: wi9Hv0X7R@lv`;

const r5 = parseAccountText(cardFormat);
check(
  "§5.1 识出 5 个账号",
  r5.accounts.length === 5,
  "actual=" + r5.accounts.length,
);
const expectedCards = [
  ["f.om.i.nADa.rYAq.nvNQ@gmail.com", "XuE2@UXoq7JD"],
  ["F.O.MIna.D.a.ryAqNv.N.Q@gmail.com", "aY4@smD3i5hp"],
  ["fo.m.in.A.da.R.yaQnv.nQ@gmail.com", "5Q1n@j5gIpx3"],
  ["f.omi.NAD.aryaq.N.vn.q@gmail.com", "uTkw@0BWVNn0"],
  ["f.O.M.i.N.ad.ar.Yaq.nvnq@gmail.com", "wi9Hv0X7R@lv"],
];
for (let i = 0; i < expectedCards.length; i++) {
  const [exEmail, exPass] = expectedCards[i];
  const acc = r5.accounts[i];
  if (acc) {
    check(
      `§5.2.${i + 1}a 卡${i + 1} email 正`,
      acc.email === exEmail,
      "expect=" + exEmail + " actual=" + acc.email,
    );
    check(
      `§5.2.${i + 1}b 卡${i + 1} pass 正`,
      acc.password === exPass,
      "expect=" + exPass + " actual=" + acc.password,
    );
  } else {
    check(`§5.2.${i + 1} 卡${i + 1} 未识`, false);
  }
}
check(
  "§5.3 大小写邮箱 (F.O.MIna...) 保留原貌",
  r5.accounts.some((a) => a.email === "F.O.MIna.D.a.ryAqNv.N.Q@gmail.com"),
);
check(
  "§5.4 卡密含@ (XuE2@UXoq7JD) 不被误为 email",
  !r5.accounts.some((a) => a.email === "XuE2@UXoq7JD"),
);

// ─── §6 标签数字编号兼容 ────────────────────────────────────────────
console.log("\n[§6] 标签数字编号 · 万法兼容");

const numLabel = `账号1: a@b.com
密码1: pass1
账号2: c@d.com
密码2: pass2@hard
Email3: e@f.com
Password3: pass3
邮箱: g@h.com
口令: pass4`;
const r6 = parseAccountText(numLabel);
check(
  "§6.1 4 账号全识",
  r6.accounts.length === 4,
  "actual=" + r6.accounts.length,
);
if (r6.accounts.length >= 4) {
  check(
    "§6.2 账号1=a@b.com pass1",
    r6.accounts[0].email === "a@b.com" && r6.accounts[0].password === "pass1",
  );
  check("§6.3 密码2 含 @ 不误判", r6.accounts[1].password === "pass2@hard");
  check(
    "§6.4 Email3/Password3 (英文带数字) 通",
    r6.accounts[2].email === "e@f.com" && r6.accounts[2].password === "pass3",
  );
  check(
    "§6.5 无数字标签亦通",
    r6.accounts[3].email === "g@h.com" && r6.accounts[3].password === "pass4",
  );
}

// ─── §7 经典格式不退化 ──────────────────────────────────────────────
console.log("\n[§7] 经典格式 · 不退化");

const classic = `foo@bar.com mypass
a@b.com:pass2
c@d.com|pass3
e@f.com,pass4
g@h.com;pass5
i@j.com\tpass6
k@l.com----pass7
{"email":"json@x.com","password":"jpass"}`;
const r7 = parseAccountText(classic);
check(
  "§7.1 8 经典格式全识",
  r7.accounts.length === 8,
  "actual=" + r7.accounts.length,
);
const classicExpect = [
  "foo@bar.com",
  "a@b.com",
  "c@d.com",
  "e@f.com",
  "g@h.com",
  "i@j.com",
  "k@l.com",
  "json@x.com",
];
for (let i = 0; i < classicExpect.length; i++) {
  if (r7.accounts[i]) {
    check(
      `§7.2.${i + 1} ${classicExpect[i]} 正识`,
      r7.accounts[i].email === classicExpect[i],
      "actual=" + r7.accounts[i].email,
    );
  }
}

// ─── §8 反序配对 (pass 先 email 后) ─────────────────────────────────
console.log("\n[§8] 反序配对 · 双向皆通");

const reverseOrder = `密码: secret123
邮箱: rev@order.com
卡密2: hardpass
卡号2: rev2@order.com`;
const r8 = parseAccountText(reverseOrder);
check(
  "§8.1 2 反序账号全识",
  r8.accounts.length === 2,
  "actual=" + r8.accounts.length,
);
if (r8.accounts.length >= 2) {
  check(
    "§8.2 反序1 配对正",
    r8.accounts[0].email === "rev@order.com" &&
      r8.accounts[0].password === "secret123",
  );
  check(
    "§8.3 反序2 配对正",
    r8.accounts[1].email === "rev2@order.com" &&
      r8.accounts[1].password === "hardpass",
  );
}

// ─── §9 噪声免疫 ────────────────────────────────────────────────────
console.log("\n[§9] 噪声免疫 · 微信广告/订单 · 静默跳过");

const noise = `zhou
您好,亲爱的客户
自动发货 2026-05-09 13:21:49
您的订单编号为:5115053162084007107
2026-05-09 13:21:49
账号管理器:https://wwbnm.lanzoub.com/iAOHM3p1r11e
官网: https://example.com
售后: 客服微信 xyz123
foo@bar.com mypass`;
const r9 = parseAccountText(noise);
check(
  "§9.1 噪声中唯识真账号",
  r9.accounts.length === 1 &&
    r9.accounts[0].email === "foo@bar.com" &&
    r9.accounts[0].password === "mypass",
  "actual count=" + r9.accounts.length,
);

// ─── §10 token 直登仍通 ─────────────────────────────────────────────
console.log("\n[§10] token 直登 · 不退化");

const tokenStr =
  "devin-session-token$abcdefghijklmnopqrstuvwxyz1234567890" + "X".repeat(40);
const r10 = parseAccountText(tokenStr);
check(
  "§10.1 devin-session-token$ 识为 token",
  r10.tokens.length === 1 && r10.accounts.length === 0,
);

const jwt =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4ifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
const r11 = parseAccountText(jwt);
check(
  "§10.2 JWT 识为 token",
  r11.tokens.length === 1 && r11.accounts.length === 0,
);

// ─── §11 综合极端: 一文混万法 ───────────────────────────────────────
console.log("\n[§11] 综合极端 · 一文混万法 · 唯变所适");

const omni = `# 注释跳过
// JS 注释跳过

# === 经典 ===
foo@bar.com pass1
a@b.com:pass2

# === 微信卡号卡密 ===
卡号1: card1@x.com
卡密1: cpass1@hard

# === 反序 ===
密码: revpass
邮箱: rev@x.com

# === 微信自动发货 (含噪声) ===
自动发货 2026-05-09 13:21:49
您的订单编号为:1234567890
账号:wx@auto.com   (无任何空格)
密码:wxp@ss   (无任何空格)
账号管理器:点tps://abc.com(去掉点)

# === JSON ===
{"email":"j@x.com","password":"jpass"}

# === Token ===
devin-session-token$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
`;

const r12 = parseAccountText(omni);
check(
  "§11.1 综合识 6 账号",
  r12.accounts.length === 6,
  "actual=" +
    r12.accounts.length +
    " emails=" +
    r12.accounts.map((a) => a.email).join(","),
);
check("§11.2 综合识 1 token", r12.tokens.length === 1);

const expectAll = [
  ["foo@bar.com", "pass1"],
  ["a@b.com", "pass2"],
  ["card1@x.com", "cpass1@hard"],
  ["rev@x.com", "revpass"],
  ["wx@auto.com", "wxp@ss"],
  ["j@x.com", "jpass"],
];
for (let i = 0; i < expectAll.length; i++) {
  const [eE, eP] = expectAll[i];
  if (r12.accounts[i]) {
    check(
      `§11.3.${i + 1} ${eE}|${eP}`,
      r12.accounts[i].email === eE && r12.accounts[i].password === eP,
      "actual=" + r12.accounts[i].email + "|" + r12.accounts[i].password,
    );
  }
}

// ─── 结果 ───────────────────────────────────────────────────────────
console.log(
  "\n================================================================",
);
console.log(`  v2.7.0 万法识号 · 测毕: ${pass} 过 / ${fail} 败`);
console.log("================================================================");
process.exit(fail > 0 ? 1 : 0);
