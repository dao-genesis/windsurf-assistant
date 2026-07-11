// _test_v2613_quota_delta.cjs · v2.6.13 阴阳结合 · ⚖额度变动信号回归测
//
// 物无非彼·物无非是·自彼则不见·自是则知之 — 庄子·齐物论
//
// §1 静态契约 (extension.js 实现存在性 · 字符串/regex 检验)
//   · const VERSION === "2.6.13"
//   · _quotaDeltaCount / _lastQuotaDaily / _lastQuotaPromptCredits / _lastQuotaFlowCredits 全局声明
//   · setActive 内 _lastQuotaDaily = -1 等清基线代码
//   · Engine._tick 内 _maybeTrigger("⚖额度变动", ...) 调用
//   · _cfg("quotaDeltaEnable", true) / quotaDeltaCreditsMin / quotaDeltaDailyMin 配置读
//   · package.json 含 wam.quotaDeltaEnable / wam.quotaDeltaCreditsMin / wam.quotaDeltaDailyMin
//
// §2 行为单元 (mock simulator · 重现 ⚖检测核心逻辑)
//   · 首次 tick 基线 -1 → 不 fire (建基线)
//   · 同账号 daily/PC/FC 全不变 → 不 fire
//   · 同账号 daily 下降 ≥0.3% → fire (D-x.xx%)
//   · 同账号 promptCredits 下降 ≥1 → fire (PC-N)
//   · 同账号 flowCredits 下降 ≥1 → fire (FC-N)
//   · 同账号 daily 上升 (回填) → 不 fire
//   · 跨账号变化 → 不 fire (需同账号)
//   · quotaDeltaEnable=false → 不 fire
//   · daily 下降 0.2% (<0.3%) → 不 fire
//   · 多维度同时下降 → 多 trigger 字段 (D + PC + FC)
//
// §3 阴阳互补不冲突 (与 W%脉动主信号窗静态规约)
//   · ⚖ reason !== "⚡W%脉动" · 主信号窗内 _maybeTrigger 让位 (skip)
//   · 60s 强锁仍护 (与 W% 同道)
//
"use strict";
const fs = require("node:fs");
const path = require("node:path");

const EXT = path.join(__dirname, "extension.js");
const PKG = path.join(__dirname, "package.json");
const src = fs.readFileSync(EXT, "utf8");
const pkg = JSON.parse(fs.readFileSync(PKG, "utf8"));

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
console.log("  v2.6.13 quota delta · 阴阳结合 · 反者道之动 · 物无非彼物无非是");
console.log("================================================================");

console.log("\n[§1] 静态契约 (extension.js + package.json 实现存在性)\n");

// ── extension.js ──
// v2.6.14+ 兼容 · ⚖阴阳结合 特性自 v2.6.13 起后续版本持续保持 (不降级)
check(
  "VERSION ≥ 2.6.13 (活体源版本 · 含 v2.6.14 接代)",
  /const VERSION\s*=\s*"2\.6\.(1[3-9]|[2-9]\d)"/.test(src) ||
    /const VERSION\s*=\s*"2\.[7-9]\.\d+(?:\.\d+)?"/.test(src) ||
    /const VERSION\s*=\s*"[3-9]\.\d+\.\d+(?:\.\d+)?"/.test(src),
  "活体源版本字面值",
);
check(
  "v2.6.13 changelog 头存在",
  /v2\.6\.13.*\u9634\u9633\u7ed3\u5408/.test(src), // 阴阳结合
  "changelog 含 阴阳结合",
);
check(
  "_quotaDeltaCount 全局声明",
  /_quotaDeltaCount\s*=\s*0/.test(src),
  "诊断累计",
);
check(
  "_lastQuotaDaily 全局声明",
  /_lastQuotaDaily\s*=\s*-1/.test(src),
  "上轮 daily% 基线",
);
check(
  "_lastQuotaPromptCredits 全局声明",
  /_lastQuotaPromptCredits\s*=\s*-1/.test(src),
  "上轮 promptCredits 基线",
);
check(
  "_lastQuotaFlowCredits 全局声明",
  /_lastQuotaFlowCredits\s*=\s*-1/.test(src),
  "上轮 flowCredits 基线",
);

// ── setActive 切号清基线 ──
const setActiveBlock = (() => {
  const m =
    /this\.switches\+\+;[\s\S]{0,800}?_lastQuotaFlowCredits\s*=\s*-1;/.exec(
      src,
    );
  return m ? m[0] : "";
})();
check(
  "setActive 真切号清 _lastQuotaDaily = -1",
  /_lastQuotaDaily\s*=\s*-1;/.test(setActiveBlock),
  "防跨账号假脉动·与 W% 同步",
);
check(
  "setActive 真切号清 _lastQuotaPromptCredits = -1",
  /_lastQuotaPromptCredits\s*=\s*-1;/.test(setActiveBlock),
  "PC 基线清 -1",
);
check(
  "setActive 真切号清 _lastQuotaFlowCredits = -1",
  /_lastQuotaFlowCredits\s*=\s*-1;/.test(setActiveBlock),
  "FC 基线清 -1",
);

// ── Engine._tick ⚖检测块 ──
check(
  '_cfg("quotaDeltaEnable", true) 配置读',
  /_cfg\(\s*"quotaDeltaEnable"\s*,\s*true\s*\)/.test(src),
  "默认 true",
);
check(
  '_cfg("quotaDeltaCreditsMin", 1) 配置读',
  /_cfg\(\s*"quotaDeltaCreditsMin"\s*,\s*1\s*\)/.test(src),
  "默认 1",
);
check(
  '_cfg("quotaDeltaDailyMin", 0.3) 配置读',
  /_cfg\(\s*"quotaDeltaDailyMin"\s*,\s*0\.3\s*\)/.test(src),
  "默认 0.3%",
);
check(
  "防跨账号判 _lastQuotaEmail === curEmail",
  /_lastQuotaEmail\s*===\s*curEmail/.test(src),
  "同 W% · 必同账号才比",
);
check(
  "_maybeTrigger 调用 ⚖额度变动 reason",
  /_maybeTrigger\s*\(\s*"\\u2696\\u989d\\u5ea6\\u53d8\\u52a8"/.test(src),
  '"⚖额度变动" reason 进 _maybeTrigger 出口',
);
check(
  "_quotaDeltaCount++ 累计",
  /_quotaDeltaCount\+\+/.test(src),
  "诊断计数累加",
);
check(
  "log 含 ⚖ 额度变动信号#",
  /\\u2696 \\u989d\\u5ea6\\u53d8\\u52a8\\u4fe1\\u53f7#/.test(src),
  "日志可观",
);

// ── 基线统一更新 (W% + ⚖ 同步) ──
const baselineBlock = (() => {
  const m =
    /\u57fa\u7ebf\u7edf\u4e00\u66f4\u65b0[\s\S]{0,500}?_lastQuotaFlowCredits\s*=/.exec(
      src,
    ); // "基线统一更新"
  return m ? m[0] : "";
})();
check(
  "基线统一更新块: _lastQuotaWeekly",
  /_lastQuotaWeekly\s*=/.test(baselineBlock),
  "W% 基线",
);
check(
  "基线统一更新块: _lastQuotaDaily (q.daily >= 0)",
  /_lastQuotaDaily\s*=[\s\S]*?q\.daily\s*>=\s*0/.test(baselineBlock),
  "daily 非负才更",
);
check(
  "基线统一更新块: _lastQuotaPromptCredits",
  /_lastQuotaPromptCredits\s*=/.test(baselineBlock),
  "PC 基线",
);
check(
  "基线统一更新块: _lastQuotaFlowCredits",
  /_lastQuotaFlowCredits\s*=/.test(baselineBlock),
  "FC 基线",
);

// ── package.json ──
check(
  "package.json version ≥ 2.6.13 (含 v2.6.14 接代)",
  /^2\.6\.(1[3-9]|[2-9]\d)$/.test(pkg.version) ||
    /^2\.[7-9]\.\d+(?:\.\d+)?$/.test(pkg.version) ||
    /^[3-9]\.\d+\.\d+(?:\.\d+)?$/.test(pkg.version),
  "actual=" + pkg.version,
);
const props = pkg.contributes.configuration.properties;
check(
  "package.json wam.quotaDeltaEnable 存在",
  !!props["wam.quotaDeltaEnable"] &&
    props["wam.quotaDeltaEnable"].default === true,
  "type=boolean default=true",
);
check(
  "package.json wam.quotaDeltaCreditsMin 存在",
  !!props["wam.quotaDeltaCreditsMin"] &&
    props["wam.quotaDeltaCreditsMin"].default === 1,
  "type=number default=1",
);
check(
  "package.json wam.quotaDeltaDailyMin 存在",
  !!props["wam.quotaDeltaDailyMin"] &&
    props["wam.quotaDeltaDailyMin"].default === 0.3,
  "type=number default=0.3",
);
check(
  "package.json 配置项 description 含 ⚖",
  /\u2696/.test(props["wam.quotaDeltaEnable"].description),
  "用户可见说明含 ⚖ 字符",
);

console.log("\n[§2] 行为单元 (mock simulator · 重现 ⚖检测核心逻辑)\n");

/**
 * mock ⚖额度变动检测器 · 与 extension.js Engine._tick 内 ⚖块逻辑等价
 * @param {object} prev - 上轮基线 { email, daily, promptCredits, flowCredits }
 * @param {object} q - 当轮 quota { daily, weekly, promptCredits, flowCredits }
 * @param {string} curEmail - 当前 active email
 * @param {object} cfg - 配置 { enable, creditsMin, dailyMin }
 * @returns {object} { fire: bool, triggers: [], count }
 */
function simulateQuotaDelta(prev, q, curEmail, cfg) {
  const enable = cfg && typeof cfg.enable === "boolean" ? cfg.enable : true;
  const creditsMin = Math.max(1, +(cfg && cfg.creditsMin) || 1);
  const dailyMin = Math.max(0.01, +(cfg && cfg.dailyMin) || 0.3);
  const triggers = [];
  if (!enable) return { fire: false, triggers, reason: "disabled" };
  if (!curEmail) return { fire: false, triggers, reason: "no curEmail" };
  if (prev.email !== curEmail)
    return { fire: false, triggers, reason: "cross-email" };
  const dDaily =
    prev.daily >= 0 && typeof q.daily === "number" && q.daily >= 0
      ? prev.daily - q.daily
      : 0;
  const dPC =
    prev.promptCredits >= 0 &&
    typeof q.promptCredits === "number" &&
    q.promptCredits >= 0
      ? prev.promptCredits - q.promptCredits
      : 0;
  const dFC =
    prev.flowCredits >= 0 &&
    typeof q.flowCredits === "number" &&
    q.flowCredits >= 0
      ? prev.flowCredits - q.flowCredits
      : 0;
  if (dDaily >= dailyMin) triggers.push("D-" + dDaily.toFixed(2) + "%");
  if (dPC >= creditsMin) triggers.push("PC-" + dPC);
  if (dFC >= creditsMin) triggers.push("FC-" + dFC);
  return { fire: triggers.length > 0, triggers };
}

const E = "alice@dao.local";
const E2 = "bob@dao.local";

// 测 1: 首次 tick · 基线 -1 → 不 fire
{
  const r = simulateQuotaDelta(
    { email: E, daily: -1, promptCredits: -1, flowCredits: -1 },
    { daily: 50, promptCredits: 9000, flowCredits: 18000 },
    E,
    {},
  );
  check(
    "首次 tick 基线 -1 → 不 fire (建基线)",
    !r.fire,
    "triggers=" + r.triggers.length,
  );
}

// 测 2: 同账号全不变 → 不 fire
{
  const r = simulateQuotaDelta(
    { email: E, daily: 50, promptCredits: 9000, flowCredits: 18000 },
    { daily: 50, promptCredits: 9000, flowCredits: 18000 },
    E,
    {},
  );
  check("同账号全不变 → 不 fire", !r.fire, "Δ=0");
}

// 测 3: 同账号 daily 下降 0.5% (>0.3%) → fire
{
  const r = simulateQuotaDelta(
    { email: E, daily: 50, promptCredits: 9000, flowCredits: 18000 },
    { daily: 49.5, promptCredits: 9000, flowCredits: 18000 },
    E,
    {},
  );
  check(
    "daily 下降 0.5% → fire D-0.50%",
    r.fire && r.triggers.includes("D-0.50%"),
    "triggers=" + r.triggers.join(","),
  );
}

// 测 4: 同账号 promptCredits 下降 1 → fire PC-1
{
  const r = simulateQuotaDelta(
    { email: E, daily: 50, promptCredits: 9000, flowCredits: 18000 },
    { daily: 50, promptCredits: 8999, flowCredits: 18000 },
    E,
    {},
  );
  check(
    "promptCredits 下降 1 → fire PC-1",
    r.fire && r.triggers.includes("PC-1"),
    "triggers=" + r.triggers.join(","),
  );
}

// 测 5: 同账号 flowCredits 下降 1 → fire FC-1
{
  const r = simulateQuotaDelta(
    { email: E, daily: 50, promptCredits: 9000, flowCredits: 18000 },
    { daily: 50, promptCredits: 9000, flowCredits: 17999 },
    E,
    {},
  );
  check(
    "flowCredits 下降 1 → fire FC-1",
    r.fire && r.triggers.includes("FC-1"),
    "triggers=" + r.triggers.join(","),
  );
}

// 测 6: 同账号 daily 上升 → 不 fire
{
  const r = simulateQuotaDelta(
    { email: E, daily: 50, promptCredits: 9000, flowCredits: 18000 },
    { daily: 60, promptCredits: 9000, flowCredits: 18000 },
    E,
    {},
  );
  check(
    "daily 上升 (回填) → 不 fire",
    !r.fire,
    "triggers=" + r.triggers.length,
  );
}

// 测 7: 跨账号变化 → 不 fire (防假脉动)
{
  const r = simulateQuotaDelta(
    { email: E, daily: 50, promptCredits: 9000, flowCredits: 18000 },
    { daily: 30, promptCredits: 5000, flowCredits: 10000 }, // 全跌
    E2, // 不同 email
    {},
  );
  check(
    "跨账号 daily 大跌 → 不 fire (防跨账号假脉动)",
    !r.fire,
    "reason=" + r.reason,
  );
}

// 测 8: quotaDeltaEnable=false → 不 fire (即使有变化)
{
  const r = simulateQuotaDelta(
    { email: E, daily: 50, promptCredits: 9000, flowCredits: 18000 },
    { daily: 49, promptCredits: 8000, flowCredits: 17000 },
    E,
    { enable: false },
  );
  check("quotaDeltaEnable=false → 不 fire", !r.fire, "reason=" + r.reason);
}

// 测 9: daily 下降 0.2% (<0.3% 阈值) → 不 fire
{
  const r = simulateQuotaDelta(
    { email: E, daily: 50, promptCredits: 9000, flowCredits: 18000 },
    { daily: 49.8, promptCredits: 9000, flowCredits: 18000 },
    E,
    {},
  );
  check("daily 下降 0.2% (<0.3%) → 不 fire", !r.fire, "Δ=0.2 < dailyMin=0.3");
}

// 测 10: 多维度同时下降 → 多 trigger
{
  const r = simulateQuotaDelta(
    { email: E, daily: 50, promptCredits: 9000, flowCredits: 18000 },
    { daily: 49, promptCredits: 8990, flowCredits: 17995 },
    E,
    {},
  );
  check(
    "多维度同时下降 → 3 trigger (D + PC + FC)",
    r.fire && r.triggers.length === 3,
    "triggers=" + r.triggers.join(","),
  );
}

// 测 11: 自定义阈值 creditsMin=10 · PC 下降 5 < 10 → 不 fire
{
  const r = simulateQuotaDelta(
    { email: E, daily: 50, promptCredits: 9000, flowCredits: 18000 },
    { daily: 50, promptCredits: 8995, flowCredits: 18000 },
    E,
    { creditsMin: 10 },
  );
  check(
    "creditsMin=10 · PC 下降 5 → 不 fire (< 阈值)",
    !r.fire,
    "Δ=5 < creditsMin=10",
  );
}

// 测 12: PC 仅有 prev 无 cur (字段缺失) → 不 fire (容错)
{
  const r = simulateQuotaDelta(
    { email: E, daily: 50, promptCredits: 9000, flowCredits: 18000 },
    { daily: 50, flowCredits: 18000 }, // promptCredits 缺
    E,
    {},
  );
  check("PC 字段缺失 → 不 fire (容错·不报噪)", !r.fire, "PC undefined");
}

// 测 13: 切号后基线 -1 → 第一次 tick 仍不 fire (重新建基)
{
  // 模拟 setActive 后状态
  const r1 = simulateQuotaDelta(
    { email: E, daily: -1, promptCredits: -1, flowCredits: -1 }, // setActive 已清
    { daily: 30, promptCredits: 4000, flowCredits: 8000 }, // 新号当前值
    E,
    {},
  );
  check("切号后第 1 tick (基线 -1) → 不 fire", !r1.fire, "建新基线");
  // 第 2 tick 真消耗才 fire
  const r2 = simulateQuotaDelta(
    { email: E, daily: 30, promptCredits: 4000, flowCredits: 8000 },
    { daily: 29.5, promptCredits: 4000, flowCredits: 8000 },
    E,
    {},
  );
  check(
    "切号后第 2 tick · daily 跌 0.5% → fire",
    r2.fire && r2.triggers[0] === "D-0.50%",
    "triggers=" + r2.triggers.join(","),
  );
}

// 测 14: 边界 · daily 跌正好 1% (== dailyMin · 整数精确 · 避 IEEE 754 浮点坑) → fire
{
  const r = simulateQuotaDelta(
    { email: E, daily: 50, promptCredits: 9000, flowCredits: 18000 },
    { daily: 49, promptCredits: 9000, flowCredits: 18000 },
    E,
    { dailyMin: 1 }, // 整数阈 · Δ=1.0 == dailyMin=1 精确
  );
  check(
    "边界 daily Δ=1.00% (== dailyMin=1 · 整数精确) → fire (>= 含等)",
    r.fire,
    "Δ=1.00 >= dailyMin=1 (整数 · IEEE 754 精确可达)",
  );
}

console.log("\n[§3] 阴阳互补不冲突 (静态规约 · _maybeTrigger 让位)\n");

// ⚖ reason 字符串确认存在 (不与 W% 主信号 reason 冲突)
const reasonW = "\u26a1W%\u8109\u52a8"; // ⚡W%脉动
const reasonE = "\u2696\u989d\u5ea6\u53d8\u52a8"; // ⚖额度变动
check(
  "⚡W%脉动 reason !== ⚖额度变动 reason",
  reasonW !== reasonE,
  "字符串可区分",
);
check(
  "extension.js _maybeTrigger 主信号窗判: reason !== W%脉动 才 skip",
  /reason\s*!==\s*"\\u26a1W%\\u8109\\u52a8"/.test(src),
  "W% 主自身不让位 · 其他信号 (含 ⚖) 在主信号窗内 skip",
);
check(
  "_maybeTrigger 内 _lastQuotaPulseAt 主信号窗保护",
  /_lastQuotaPulseAt\s*>\s*0/.test(src),
  "W% 设此戳 · ⚖ 不设 · 阴让阳",
);
check(
  "⚖ 不设 _lastQuotaPulseAt (不抢主信号)",
  !/_lastQuotaPulseAt\s*=\s*Date\.now\(\)[\s\S]{0,200}?\u2696\u989d\u5ea6\u53d8\u52a8/.test(
    src,
  ),
  "⚖ 处不设 PulseAt · 主信号专属",
);

console.log(
  "\n================================================================",
);
console.log("  v2.6.13 result:  " + pass + " pass / " + fail + " fail");
console.log("================================================================");

process.exit(fail > 0 ? 1 : 0);
