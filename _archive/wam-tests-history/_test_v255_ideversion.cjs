// v2.5.5 回归测 · 锁 ideVersion 默认值 ≥ 1.99.0 · 防退化 (后端能力协商根因)
// 实证: ideVersion="1.0.0" 时后端省 planEnd → 98 号 daysLeft=0 脏数据
"use strict";
const fs = require("node:fs");
const path = require("node:path");

let pass = 0,
  fail = 0;
function expect(name, cond) {
  if (cond) {
    pass++;
    console.log("  ✓ " + name);
  } else {
    fail++;
    console.error("  ✗ " + name);
  }
}

console.log("═══ v2.5.5 · ideVersion 根因回归测 ═══");

const src = fs.readFileSync(path.join(__dirname, "extension.js"), "utf8");

console.log("\n[A] tryFetchPlanStatus 默认 ideVersion");
{
  // 匹配形如 `ideVersion: o.ideVersion || "X.Y.Z"`
  const m = src.match(/ideVersion:\s*o\.ideVersion\s*\|\|\s*"([^"]+)"/);
  expect("找到 ideVersion 默认值", !!m);
  if (m) {
    const ver = m[1];
    console.log("    当前默认: " + ver);
    // 解析主版本号 (X.Y.Z → X)
    const major = parseInt(ver.split(".")[0], 10);
    const minor = parseInt(ver.split(".")[1] || "0", 10);
    expect(
      "ideVersion ≥ 1.99 (触发后端返 planEnd)",
      major > 1 || (major === 1 && minor >= 99),
    );
    expect("不是老 '1.0.0' (后端会省 planEnd)", ver !== "1.0.0");
  }
}

console.log("\n[B] extensionVersion 默认同步");
{
  const m = src.match(/extensionVersion:\s*o\.extensionVersion\s*\|\|\s*"([^"]+)"/);
  expect("找到 extensionVersion 默认值", !!m);
  if (m) {
    const ver = m[1];
    const major = parseInt(ver.split(".")[0], 10);
    const minor = parseInt(ver.split(".")[1] || "0", 10);
    expect(
      "extensionVersion ≥ 1.99",
      major > 1 || (major === 1 && minor >= 99),
    );
  }
}

console.log("\n[C] VERSION 字段存在且 ≥ 2.5.5");
{
  const m = src.match(/const VERSION = "([\d.]+)"/);
  expect("找到 VERSION", !!m);
  if (m) {
    const v = m[1].split(".").map(Number);
    expect(
      "VERSION ≥ 2.5.5",
      v[0] > 2 || (v[0] === 2 && (v[1] > 5 || (v[1] === 5 && v[2] >= 5))),
    );
  }
}

console.log("\n[D] changelog 提及 ideVersion 根因");
{
  expect(
    "changelog 含 'ideVersion'",
    src.includes("ideVersion") && src.includes("能力协商"),
  );
  expect("changelog 含 'v2.5.5'", src.includes("v2.5.5"));
}

console.log(`\n═══ 结果: ${pass} 过 / ${fail} 败 ═══`);
process.exit(fail > 0 ? 1 : 0);
