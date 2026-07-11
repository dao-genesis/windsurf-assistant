// v2.5.2 回归 · expTag 4 态全显
//   未验 (!checked):       '?天' 灰
//   有效 (daysLeft>0):     'N天' + 阈值色
//   已过期 (planEnd>0):    '已过期' 红
//   永久 (planEnd=0 已验): '∞' 灰
//
// 思路: 直接打 _internals._buildExpTag (纯函数 · 不依赖 _store/_cfg)
"use strict";
const Module = require("node:module");
const path = require("node:path");

let pass = 0,
  fail = 0;
function expect(d, c) {
  if (c) {
    console.log("    ✓ " + d);
    pass++;
  } else {
    console.log("    ✗ " + d);
    fail++;
  }
}

const vs = {
  workspace: {
    getConfiguration: () => ({ get: (k, def) => def }),
    onDidChangeTextDocument: () => ({ dispose: () => {} }),
    workspaceFolders: [],
  },
  window: {
    createOutputChannel: () => ({
      appendLine: () => {},
      show: () => {},
      dispose: () => {},
    }),
    createStatusBarItem: () => ({
      show: () => {},
      hide: () => {},
      dispose: () => {},
    }),
    showInformationMessage: () => {},
    showWarningMessage: () => {},
    showErrorMessage: () => {},
    registerWebviewViewProvider: () => ({ dispose: () => {} }),
  },
  commands: { registerCommand: () => ({ dispose: () => {} }) },
  StatusBarAlignment: { Left: 1, Right: 2 },
  ConfigurationTarget: { Global: 1 },
  Uri: { file: (p) => ({ fsPath: p }) },
  EventEmitter: class {
    constructor() {
      this.event = () => ({ dispose: () => {} });
    }
    fire() {}
    dispose() {}
  },
};
const origLoad = Module._load;
Module._load = function (r, parent, ...rest) {
  if (r === "vscode") return vs;
  return origLoad.call(this, r, parent, ...rest);
};

const ext = require(path.join(__dirname, "extension.js"));
const { _buildExpTag, buildHtml } = ext._internals || {};
if (typeof _buildExpTag !== "function") {
  console.error("× _internals._buildExpTag 未导出");
  process.exit(1);
}

const now = Date.now();

console.log("[A] 4 态 expTag 纯函数 · 直打");

// 态 1: 未验 (!checked)
{
  console.log("  · 未验 (!checked)");
  const tag = _buildExpTag({ checked: false, daysLeft: 0, planEnd: 0 });
  expect("含 '?天'", tag.includes("?天"));
  expect("灰 #555", tag.includes("#555"));
  expect("tooltip 含 '未验'", tag.includes("未验"));
  expect("class='days'", tag.includes('class="days"'));

  // null/undefined 容错
  const tagNull = _buildExpTag(null);
  expect("null h · 仍返 ?天", tagNull.includes("?天"));
  const tagUndef = _buildExpTag(undefined);
  expect("undefined h · 仍返 ?天", tagUndef.includes("?天"));
}

// 态 2a: 有效 30 天 (绿)
{
  console.log("  · 有效 30 天 (绿)");
  const tag = _buildExpTag({
    checked: true,
    daysLeft: 30,
    planEnd: now + 30 * 86400000,
  });
  expect("含 '30天'", tag.includes("30天"));
  expect("绿 #4ec9b0", tag.includes("#4ec9b0"));
  expect("tooltip 含 'Plan 到期'", tag.includes("Plan 到期"));
  expect("tooltip 含 '剩 30 天'", tag.includes("剩 30 天"));
}

// 态 2b: 有效 5 天 (橙边界)
{
  console.log("  · 有效 5 天 (橙边界)");
  const tag = _buildExpTag({
    checked: true,
    daysLeft: 5,
    planEnd: now + 5 * 86400000,
  });
  expect("含 '5天'", tag.includes("5天"));
  expect("橙 #ce9178", tag.includes("#ce9178"));
}

// 态 2c: 有效 4 天 (橙)
{
  console.log("  · 有效 4 天 (橙)");
  const tag = _buildExpTag({
    checked: true,
    daysLeft: 4,
    planEnd: now + 4 * 86400000,
  });
  expect("含 '4天'", tag.includes("4天"));
  expect("橙 #ce9178", tag.includes("#ce9178"));
}

// 态 2d: 有效 2 天 (红边界)
{
  console.log("  · 有效 2 天 (红边界)");
  const tag = _buildExpTag({
    checked: true,
    daysLeft: 2,
    planEnd: now + 2 * 86400000,
  });
  expect("含 '2天'", tag.includes("2天"));
  expect("红 #f44", tag.includes("#f44"));
}

// 态 2e: 有效 1 天 (红 紧迫)
{
  console.log("  · 有效 1 天 (红)");
  const tag = _buildExpTag({
    checked: true,
    daysLeft: 1,
    planEnd: now + 1 * 86400000,
  });
  expect("含 '1天'", tag.includes("1天"));
  expect("红 #f44", tag.includes("#f44"));
}

// 态 3: 已过期 (planEnd>0 但 daysLeft<=0)
{
  console.log("  · 已过期 (planEnd 已往)");
  const tag = _buildExpTag({
    checked: true,
    daysLeft: 0,
    planEnd: now - 5 * 86400000,
  });
  expect("含 '已过期'", tag.includes("已过期"));
  expect("红 #f44", tag.includes("#f44"));
  expect("tooltip 含 'Trial 已过期'", tag.includes("Trial 已过期"));
}

// 态 验证 daysLeft<0 也走过期分支 (宽限期)
{
  console.log("  · daysLeft 负数 (宽限期)");
  const tag = _buildExpTag({
    checked: true,
    daysLeft: -2,
    planEnd: now - 2 * 86400000,
  });
  expect("含 '已过期'", tag.includes("已过期"));
}

// 态 4 (v2.5.3): Trial 脏数据 (plan=Trial + checked=true + planEnd=0)
{
  console.log("  · Trial 脏数据 (planEnd 缺)");
  const tag = _buildExpTag({
    checked: true,
    daysLeft: 0,
    planEnd: 0,
    plan: "Trial",
  });
  expect("Trial 脏: 含 'Trial?'", tag.includes("Trial?"));
  expect("Trial 脏: 黄 #d4c05a", tag.includes("#d4c05a"));
  expect("Trial 脏: tooltip 提示重验", tag.includes("重新验证"));
}

// 态 5 (v2.5.3): 永久 (Pro/Free · plan≠Trial)
{
  console.log("  · 永久 (Pro/Free · 无 planEnd 字段)");
  const tag = _buildExpTag({
    checked: true,
    daysLeft: 0,
    planEnd: 0,
    plan: "Pro",
  });
  expect("Pro: 含 '∞'", tag.includes("∞"));
  expect("Pro: 灰 #888", tag.includes("#888"));
  const tag2 = _buildExpTag({
    checked: true,
    daysLeft: 0,
    planEnd: 0,
    plan: "Free",
  });
  expect("Free: 含 '∞'", tag2.includes("∞"));
  const tag3 = _buildExpTag({ checked: true, daysLeft: 0, planEnd: 0 });
  expect("无 plan 字段: 含 '∞'", tag3.includes("∞"));
}

console.log("\n[B] CSS .days · 检 min-width 防错位 (buildHtml 全 HTML)");
// 简单验 CSS 字符串在 buildHtml 输出里 (不需要真 _store)
// 只看导出的 buildHtml 是否会引到 .days CSS · 因为它依赖 _store · 跳过深检 直接读 extension.js 源
const fs = require("node:fs");
const src = fs.readFileSync(path.join(__dirname, "extension.js"), "utf8");
expect(".days 含 min-width:32px", src.includes("min-width:32px"));
expect(".days 含 text-align:center", src.includes("text-align:center"));
expect(".days 含 flex-shrink:0", src.includes("flex-shrink:0"));
expect("display:inline-block", src.includes("display:inline-block"));

console.log("\n[C] _renderRow 调用了 _buildExpTag (源审)");
expect("_renderRow 用 _buildExpTag(h)", src.includes("_buildExpTag(h)"));
expect("_internals 暴露 _buildExpTag", src.includes("_buildExpTag, // v2.5.2"));

console.log("\n[D] v2.5.3 · _cleanseHealthOnLoad · Trial+planEnd=0 脏数据清洗");
{
  const { Store } = ext._internals;
  const os_ = require("node:os");
  const tmpDir = require("node:path").join(
    os_.tmpdir(),
    "wam-test-v253-" + Date.now(),
  );
  require("node:fs").mkdirSync(tmpDir, { recursive: true });
  const store = new Store(tmpDir);
  // 注入 3 类健康数据
  store.health["trial_dirty@t.com"] = {
    checked: true,
    plan: "Trial",
    daily: 100,
    weekly: 90,
    planEnd: 0,
    daysLeft: 0,
    lastChecked: Date.now(),
  };
  store.health["trial_good@t.com"] = {
    checked: true,
    plan: "Trial",
    daily: 80,
    weekly: 85,
    planEnd: Date.now() + 10 * 86400000,
    daysLeft: 10,
    lastChecked: Date.now(),
  };
  store.health["pro_good@t.com"] = {
    checked: true,
    plan: "Pro",
    daily: 100,
    weekly: 100,
    planEnd: 0,
    daysLeft: 0,
    lastChecked: Date.now(),
  };
  const report = store._cleanseHealthOnLoad();
  expect(
    "报告含 trialNoPlanEnd 字段",
    typeof report.trialNoPlanEnd === "number",
  );
  expect("trial_dirty 清了 1 个", report.trialNoPlanEnd === 1);
  expect(
    "trial_dirty.checked 被设 false",
    store.health["trial_dirty@t.com"].checked === false,
  );
  expect(
    "trial_dirty 带 _trialDirtyAt 标",
    !!store.health["trial_dirty@t.com"]._trialDirtyAt,
  );
  expect(
    "trial_good.checked 仍 true (planEnd>0)",
    store.health["trial_good@t.com"].checked === true,
  );
  expect(
    "pro_good.checked 仍 true (plan=Pro)",
    store.health["pro_good@t.com"].checked === true,
  );
  // 清理 tmp
  try {
    require("node:fs").rmSync(tmpDir, { recursive: true, force: true });
  } catch {}
}

console.log("\n[E] v2.5.4 · _isTrialLike 软判据 · 唯变所适");
{
  const { _isTrialLike } = ext._internals;
  if (typeof _isTrialLike !== "function") {
    console.error("× _internals._isTrialLike 未导出");
    process.exit(1);
  }
  // 真 trial 变体 (都应识别)
  const trialVariants = [
    "Trial",
    "trial",
    "TRIAL",
    "Team Trial",
    "Devin Trial",
    "Free Trial",
    "Pro Trial",
    "Enterprise Trial",
    "TEAMS_TIER_DEVIN_TRIAL", // 历史 tier 字符串 (未展开时)
  ];
  for (const p of trialVariants) {
    const ok = _isTrialLike({ plan: p });
    expect(`'${p}' 识为 trial`, ok === true);
  }
  // 非 trial (都不应识别)
  const nonTrial = [
    "Pro",
    "Free",
    "Max",
    "Enterprise",
    "Teams",
    "Pro Ultimate",
    "Teams Ultimate",
    "",
    "Unknown",
  ];
  for (const p of nonTrial) {
    const ok = _isTrialLike({ plan: p });
    expect(`'${p}' 不识为 trial`, ok === false);
  }
  // 容错: null / undefined / 非字符串
  expect("null · 不崩 返 false", _isTrialLike(null) === false);
  expect("undefined · 不崩 返 false", _isTrialLike(undefined) === false);
  expect("无 plan 字段 · 返 false", _isTrialLike({}) === false);
  expect("plan 为 number · 返 false", _isTrialLike({ plan: 42 }) === false);
  expect("plan 为 null · 返 false", _isTrialLike({ plan: null }) === false);
}

console.log("\n[F] v2.5.4 · _buildExpTag 用软判据 · 兼 trial 变体");
{
  // 原 v2.5.3 只识 plan==="Trial" · 现在应识 "Team Trial" 等变体
  const variants = ["Team Trial", "Devin Trial", "Free Trial", "trial"];
  for (const p of variants) {
    const tag = _buildExpTag({
      checked: true,
      daysLeft: 0,
      planEnd: 0,
      plan: p,
    });
    expect(`'${p}': 含 'Trial?'`, tag.includes("Trial?"));
  }
  // 反例: Pro + planEnd=0 应仍走 ∞
  const proTag = _buildExpTag({
    checked: true,
    daysLeft: 0,
    planEnd: 0,
    plan: "Pro",
  });
  expect(
    "Pro: 仍 '∞' 不走 Trial?",
    proTag.includes("∞") && !proTag.includes("Trial?"),
  );
}

console.log("\n[G] v2.5.4 · _cleanseHealthOnLoad 用软判据 · 兼 trial 变体");
{
  const { Store } = ext._internals;
  const os_ = require("node:os");
  const tmpDir = require("node:path").join(
    os_.tmpdir(),
    "wam-test-v254-" + Date.now(),
  );
  require("node:fs").mkdirSync(tmpDir, { recursive: true });
  const store = new Store(tmpDir);
  store.health["team_trial@t.com"] = {
    checked: true,
    plan: "Team Trial",
    daily: 80,
    weekly: 85,
    planEnd: 0,
    daysLeft: 0,
    lastChecked: Date.now(),
  };
  store.health["free_trial@t.com"] = {
    checked: true,
    plan: "Free Trial",
    daily: 60,
    weekly: 70,
    planEnd: 0,
    daysLeft: 0,
    lastChecked: Date.now(),
  };
  store.health["lowercase_trial@t.com"] = {
    checked: true,
    plan: "trial",
    daily: 50,
    weekly: 40,
    planEnd: 0,
    daysLeft: 0,
    lastChecked: Date.now(),
  };
  const report = store._cleanseHealthOnLoad();
  expect("Team Trial 被清", store.health["team_trial@t.com"].checked === false);
  expect("Free Trial 被清", store.health["free_trial@t.com"].checked === false);
  expect(
    "小写 trial 被清",
    store.health["lowercase_trial@t.com"].checked === false,
  );
  expect("trialNoPlanEnd 计 3", report.trialNoPlanEnd === 3);
  try {
    require("node:fs").rmSync(tmpDir, { recursive: true, force: true });
  } catch {}
}

console.log(`\n═══ 结果: ${pass} 过 / ${fail} 败 ═══`);
process.exit(fail > 0 ? 1 : 0);
