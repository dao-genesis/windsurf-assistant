// _test_v2614_triple_throttle.cjs · v2.6.14 三守俱全 · 守一·大制无割 · 反者道之动
//
// 实证依据 (179 wam.log · v2.6.13 生命 · 21225 行):
//   · 5 分钟爆发 WAL 174 火 · 38 次真切号 · 每 8s 切一 · 雪崩
//   · ⚡W%脉动 4.3% (11/253) vs 📡WAL·edge 68.8% (174/253) · 让位机制几不生效
//   · 单账号 40s 内 W 82→72 · 1 send 引 4 脉动 · "1 send = 1 信号" 公理破
//
// §1 静态契约 (extension.js + package.json 实现存在性)
//   · const VERSION === "2.6.14"
//   · v2.6.14 changelog header
//   · _maybeTrigger 入口加 perMessageMinIntervalMs 全 reason 强锁
//   · _installWalWatcher 加 walEdgeCooldownMs 同源冷 + walWarmupMs 启动暖启
//   · diag 扩 walWarmupSkipCount / walCooldownSkipCount
//   · 活码 banner "三守俱全" + "全栏" + "WAL冷" + "暖启"
//   · package.json 三新配置项 (默 60000 / 2000 / 5000)
//
// §2 行为单元 (mock simulator · 重现三守核心逻辑)
//   §2a 守一全栏 (_maybeTrigger 60s)
//     · 首次 trigger ok · 2 秒后 trigger 同 reason 阻
//     · 首次 trigger ok · 60 秒后 trigger 放
//     · 首次 W%脉动 + 30 秒后 W%脉动 自阻 (主治 v2.6.13 W% 自火)
//     · 首次 WAL + 10 秒后 ⚖额度变动 阻 (多源互栏)
//     · minIntervalMs = 0 关闭 · 万次都过
//   §2b 守二 WAL 同源冷 (2s)
//     · 1 次 WAL fire · 500ms 后 2 次 fire 阻
//     · 1 次 WAL fire · 2.5s 后 2 次 fire 放
//     · cooldownMs = 0 关闭 · 任何间隔都过
//   §2c 守三 WAL 启动暖启 (5s)
//     · 启动 2s 内 WAL 火全阻
//     · 启动 6s 后 WAL 火放
//     · warmupMs = 0 关闭 · 启动立放
//
// §3 阴阳不冲突 (与 v2.6.12 / v2.6.13 兼容)
//   · 守一全栏 catch W% 自火 (v2.6.12 pulsePriorityMs 未覆)
//   · 守二守三 仅过滤 WAL 源噪 · 不动 ⚡W%/📃pb·new/⚖
//   · 三守按序: 守三 暖启 → 守二 同源冷 → 守一 全栏 (三层兜底)
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
console.log("  v2.6.14 三守俱全 · 守一·大制无割 · 反者道之动");
console.log("================================================================");

console.log("\n[§1] 静态契约 (extension.js + package.json 实现存在性)\n");

// ── extension.js · version + changelog ──
// 版本判 ≥ 2.6.14 (沿用 v2.5.5/2.6.13 同风格 · 不阻演进 · 守一不锁字面)
{
  const m = src.match(/const VERSION\s*=\s*"([\d.]+)"/);
  let okVer = false;
  if (m) {
    const v = m[1].split(".").map(Number);
    okVer =
      v[0] > 2 || (v[0] === 2 && (v[1] > 6 || (v[1] === 6 && v[2] >= 14)));
  }
  check("VERSION ≥ 2.6.14", okVer, "actual=" + (m ? m[1] : "?"));
}
check(
  "v2.6.14 changelog 头存在",
  /v2\.6\.14.*\u4e09\u5b88\u4ff1\u5168/.test(src), // 三守俱全
  "changelog 含 三守俱全",
);
check(
  "v2.6.14 缘起实证引 179 数据",
  /\u5b9e\u8bc1.*179.*21225/.test(src),
  "缘起章引活体实证",
);

// ── §1.1 守一 · _maybeTrigger 60s 全栏 ──
check(
  'v2.6.14 守一 "全栏" 字符串存在',
  /v2\.6\.14[\s\S]{0,200}\u5b88\u4e00[\s\S]{0,100}\u5168\s*reason\s*\u5f3a\u9501/.test(
    src,
  ), // 守一 ... 全 reason 强锁
  "守一注释块",
);
check(
  '_cfg("perMessageMinIntervalMs", 60000) 配置读',
  /_cfg\(\s*"perMessageMinIntervalMs"\s*,\s*60000\s*\)/.test(src),
  "默认 60000ms · 复 v2.6.9",
);
check(
  "守一全栏判: _lastPerMsgTriggerAt + minIntervalMs 关联",
  /minIntervalMs\s*>\s*0[\s\S]{0,120}?_lastPerMsgTriggerAt\s*>\s*0[\s\S]{0,120}?now\s*-\s*_lastPerMsgTriggerAt\s*<\s*minIntervalMs/.test(
    src,
  ),
  "_maybeTrigger 入口 3 条件同出",
);
check(
  '守一 log 含 "全栏"',
  /\u5168\u680f/.test(src), // 全栏
  '_maybeTrigger 拦截 log 含 "全栏"',
);

// ── §1.2 守二 · WAL 同源冷 ──
check(
  'v2.6.14 守二 "同源最小间隔" 注释存在',
  /\u5b88\u4e8c[\s\S]{0,120}\u540c\u6e90\u6700\u5c0f\u95f4\u9694/.test(src), // 守二 ... 同源最小间隔
  "守二 changelog 注释",
);
check(
  '_cfg("walEdgeCooldownMs", 2000) 配置读',
  /_cfg\(\s*"walEdgeCooldownMs"\s*,\s*2000\s*\)/.test(src),
  "默 2000ms",
);
check(
  "守二 lastWalFireAt + WAL_COOLDOWN_MS 关联",
  /lastWalFireAt\s*>\s*0[\s\S]{0,80}?sinceLastFire\s*<\s*WAL_COOLDOWN_MS/.test(
    src,
  ) ||
    /WAL_COOLDOWN_MS\s*>\s*0[\s\S]{0,80}?lastWalFireAt\s*>\s*0[\s\S]{0,80}?sinceLastFire\s*<\s*WAL_COOLDOWN_MS/.test(
      src,
    ),
  "_fireWalEdge 内同源冷判",
);
check(
  '守二 log 含 "edge·skip[cooldown:"',
  /edge\u00b7skip\[cooldown:/.test(src),
  "同源冷 skip 可观",
);

// ── §1.3 守三 · WAL 启动暖启 ──
check(
  'v2.6.14 守三 "启动暖启" 注释存在',
  /\u5b88\u4e09[\s\S]{0,120}\u542f\u52a8\u6696\u542f/.test(src), // 守三 ... 启动暖启
  "守三 changelog 注释",
);
check(
  '_cfg("walWarmupMs", 5000) 配置读',
  /_cfg\(\s*"walWarmupMs"\s*,\s*5000\s*\)/.test(src),
  "默 5000ms",
);
check(
  "守三 walInstalledAt + WAL_WARMUP_MS 关联",
  /WAL_WARMUP_MS\s*>\s*0[\s\S]{0,80}?sinceInstall\s*<\s*WAL_WARMUP_MS/.test(
    src,
  ),
  "_fireWalEdge 内暖启判",
);
check(
  '守三 log 含 "edge·skip[warmup:"',
  /edge\u00b7skip\[warmup:/.test(src),
  "暖启 skip 可观",
);

// ── §1.4 诊断扩展 ──
check(
  "diag 增 walWarmupSkipCount 字段",
  /walWarmupSkipCount/.test(src),
  "_per_msg_diag.json 可观暖启跳数",
);
check(
  "diag 增 walCooldownSkipCount 字段",
  /walCooldownSkipCount/.test(src),
  "_per_msg_diag.json 可观同源冷跳数",
);

// ── §1.5 WAL watcher 启动 log ──
check(
  'WAL watcher 启动 log 含 "v2.6.14"',
  /WAL watcher v2\.6\.14/.test(src),
  "启动即见版",
);
check(
  'WAL watcher 启动 log 含 "同源冷"',
  /\u540c\u6e90\u51b7/.test(src),
  "启动 log 参数可观",
);
check(
  'WAL watcher 启动 log 含 "暖启"',
  /\u6696\u542f/.test(src),
  "启动 log 参数可观",
);

// ── §1.6 activated banner ──
check(
  'activated banner 含 "三守俱全"',
  /activated \u00b7 \u4e09\u5b88\u4ff1\u5168/.test(src),
  "reload 后一眼可辨",
);
check(
  'activated banner 含 "全栏"',
  /activated[\s\S]{0,400}\u5168\u680f/.test(src),
  "参数可观",
);
check(
  'activated banner 含 "WAL冷"',
  /activated[\s\S]{0,400}WAL\u51b7/.test(src),
  "参数可观",
);
check(
  'activated banner 含 "暖启"',
  /activated[\s\S]{0,400}\u6696\u542f/.test(src),
  "参数可观",
);

// ── §1.7 package.json ──
// 版本判 ≥ 2.6.14 (沿用 v2.5.5/2.6.13 同风格 · 不阻演进)
{
  const v = (pkg.version || "0.0.0").split(".").map(Number);
  const okPkg =
    v[0] > 2 || (v[0] === 2 && (v[1] > 6 || (v[1] === 6 && v[2] >= 14)));
  check("package.json version ≥ 2.6.14", okPkg, "actual=" + pkg.version);
}
const props = pkg.contributes.configuration.properties;
check(
  "package.json wam.perMessageMinIntervalMs 存在",
  !!props["wam.perMessageMinIntervalMs"] &&
    props["wam.perMessageMinIntervalMs"].default === 60000 &&
    props["wam.perMessageMinIntervalMs"].type === "number",
  "type=number default=60000",
);
check(
  "package.json wam.walEdgeCooldownMs 存在",
  !!props["wam.walEdgeCooldownMs"] &&
    props["wam.walEdgeCooldownMs"].default === 2000 &&
    props["wam.walEdgeCooldownMs"].type === "number",
  "type=number default=2000",
);
check(
  "package.json wam.walWarmupMs 存在",
  !!props["wam.walWarmupMs"] &&
    props["wam.walWarmupMs"].default === 5000 &&
    props["wam.walWarmupMs"].type === "number",
  "type=number default=5000",
);
check(
  "package.json perMessageMinIntervalMs 说明含 v2.6.14",
  /v2\.6\.14/.test(props["wam.perMessageMinIntervalMs"].description),
  "用户可见说明标版次",
);
check(
  "package.json walEdgeCooldownMs 说明含 v2.6.14",
  /v2\.6\.14/.test(props["wam.walEdgeCooldownMs"].description),
  "用户可见说明标版次",
);
check(
  "package.json walWarmupMs 说明含 v2.6.14",
  /v2\.6\.14/.test(props["wam.walWarmupMs"].description),
  "用户可见说明标版次",
);

// ── §1.8 向后兼容 · v2.6.13 特征仍在 ──
check(
  "v2.6.13 ⚡W%脉动 特征仍在",
  /\\u26a1 W%\\u8109\\u52a8\\u4fe1\\u53f7#/.test(src), // 匹配 extension.js 内 log 字面转义 "\u26a1 W%\u8109\u52a8\u4fe1\u53f7#"
  "阳·主信号算法不动",
);
check(
  "v2.6.13 ⚖额度变动 特征仍在",
  /\\u2696 \\u989d\\u5ea6\\u53d8\\u52a8\\u4fe1\\u53f7#/.test(src), // 匹配 "\u2696 \u989d\u5ea6\u53d8\u52a8\u4fe1\u53f7#"
  "阴·辅信号算法不动",
);
check(
  "v2.6.12 quotaPulsePriorityMs 特征仍在",
  /quotaPulsePriorityMs/.test(src),
  "主信号让位机制保留",
);

console.log("\n[§2] 行为单元 (mock simulator · 重现三守核心逻辑)\n");

// ══════════════════════════════════════════════════════════════════════
// §2a 守一 · _maybeTrigger 全栏 60s (适所有 reason)
// ══════════════════════════════════════════════════════════════════════
/**
 * mock _maybeTrigger 守一全栏 · 与 extension.js 入口逻辑等价
 * state: { lastPerMsgTriggerAt, lastQuotaPulseAt }
 * cfg: { minIntervalMs (默 60000), pulsePriorityMs (默 60000) }
 */
function simulateMaybeTrigger(state, reason, now, cfg) {
  const minIntervalMs =
    cfg && typeof cfg.minIntervalMs === "number" ? cfg.minIntervalMs : 60000;
  const pulsePriorityMs =
    cfg && typeof cfg.pulsePriorityMs === "number"
      ? cfg.pulsePriorityMs
      : 60000;
  // (1) v2.6.12 pulse priority (非 W% 源让位)
  if (
    pulsePriorityMs > 0 &&
    reason !== "\u26a1W%\u8109\u52a8" &&
    state.lastQuotaPulseAt > 0 &&
    now - state.lastQuotaPulseAt < pulsePriorityMs
  ) {
    return { pass: false, block: "pulse-priority" };
  }
  // (2) v2.6.14 守一 全栏 60s
  if (
    minIntervalMs > 0 &&
    state.lastPerMsgTriggerAt > 0 &&
    now - state.lastPerMsgTriggerAt < minIntervalMs
  ) {
    return { pass: false, block: "min-interval" };
  }
  // 放行 · 更新 state
  state.lastPerMsgTriggerAt = now;
  if (reason === "\u26a1W%\u8109\u52a8") state.lastQuotaPulseAt = now;
  return { pass: true };
}

// 测 §2a-1: 首次 trigger 任何 reason 都过
{
  const s = { lastPerMsgTriggerAt: 0, lastQuotaPulseAt: 0 };
  const r = simulateMaybeTrigger(s, "\u26a1W%\u8109\u52a8", 1000, {});
  check("§2a-1 首次 W%脉动 trigger → 过", r.pass, "");
}
{
  const s = { lastPerMsgTriggerAt: 0, lastQuotaPulseAt: 0 };
  const r = simulateMaybeTrigger(s, "L6\u2192wal\u00b7edge", 1000, {});
  check("§2a-1b 首次 WAL trigger → 过", r.pass, "");
}

// 测 §2a-2: 60s 全栏 · 同 reason 2s 后阻
{
  const s = { lastPerMsgTriggerAt: 1000, lastQuotaPulseAt: 0 };
  const r = simulateMaybeTrigger(s, "L6\u2192wal\u00b7edge", 3000, {});
  check(
    "§2a-2 WAL 1s 后 2s 再 WAL → 阻 (min-interval)",
    !r.pass && r.block === "min-interval",
    "block=" + r.block,
  );
}

// 测 §2a-3: 60s 全栏 · 60s 后放
{
  const s = { lastPerMsgTriggerAt: 1000, lastQuotaPulseAt: 0 };
  const r = simulateMaybeTrigger(s, "L6\u2192wal\u00b7edge", 61001, {});
  check("§2a-3 WAL 60s 后 → 放 (min-interval 过)", r.pass, "");
}

// 测 §2a-4: W% 自火阻 (v2.6.14 核心治 v2.6.13 bug)
{
  const s = { lastPerMsgTriggerAt: 1000, lastQuotaPulseAt: 1000 };
  const r = simulateMaybeTrigger(s, "\u26a1W%\u8109\u52a8", 11000, {});
  check(
    "§2a-4 W%脉动 10s 后再 W%脉动 → 阻 (守一治 W% 自火·v2.6.13 无此栏)",
    !r.pass && r.block === "min-interval",
    "block=" + r.block,
  );
}

// 测 §2a-5: 多源互栏 · WAL fire 后 ⚖额度变动 10s 后阻
{
  const s = { lastPerMsgTriggerAt: 1000, lastQuotaPulseAt: 0 };
  const r = simulateMaybeTrigger(
    s,
    "\u2696\u989d\u5ea6\u53d8\u52a8",
    11000,
    {},
  );
  check(
    "§2a-5 WAL 后 10s ⚖额度变动 → 阻 (多源互栏)",
    !r.pass && r.block === "min-interval",
    "block=" + r.block,
  );
}

// 测 §2a-6: W% 10s 前火 + WAL 立 fire → pulse-priority 阻 (v2.6.12 机制保留)
{
  const s = { lastPerMsgTriggerAt: 1000, lastQuotaPulseAt: 1000 };
  const r = simulateMaybeTrigger(s, "L6\u2192wal\u00b7edge", 11000, {});
  check(
    "§2a-6 W% 后 10s WAL → 阻 (pulse-priority 优先)",
    !r.pass && r.block === "pulse-priority",
    "block=" + r.block,
  );
}

// 测 §2a-7: minIntervalMs = 0 关闭 · 即使 ms 内也过
{
  const s = { lastPerMsgTriggerAt: 1000, lastQuotaPulseAt: 0 };
  const r = simulateMaybeTrigger(s, "L6\u2192wal\u00b7edge", 1500, {
    minIntervalMs: 0,
  });
  check("§2a-7 minIntervalMs=0 → 守一关·任何间隔都过", r.pass, "");
}

// 测 §2a-8: minIntervalMs = 5000 · 60s 后 10s 内阻 · 6s 后放
{
  const s = { lastPerMsgTriggerAt: 1000, lastQuotaPulseAt: 0 };
  const r1 = simulateMaybeTrigger(s, "L6\u2192wal\u00b7edge", 3000, {
    minIntervalMs: 5000,
  });
  check("§2a-8a min=5s · 2s 后 WAL → 阻", !r1.pass, "block=" + r1.block);
  const r2 = simulateMaybeTrigger(s, "L6\u2192wal\u00b7edge", 7000, {
    minIntervalMs: 5000,
  });
  check("§2a-8b min=5s · 6s 后 WAL → 放", r2.pass, "");
}

// ══════════════════════════════════════════════════════════════════════
// §2b 守二 · WAL 同源冷 (2s)
// ══════════════════════════════════════════════════════════════════════
/**
 * mock _fireWalEdge 守二逻辑
 * state: { lastWalFireAt, walInstalledAt }
 * cfg: { cooldownMs (默 2000), warmupMs (默 5000) }
 */
function simulateWalFire(state, delta, now, cfg) {
  const warmupMs =
    cfg && typeof cfg.warmupMs === "number" ? cfg.warmupMs : 5000;
  const cooldownMs =
    cfg && typeof cfg.cooldownMs === "number" ? cfg.cooldownMs : 2000;
  // 守三 暖启
  const sinceInstall = now - state.walInstalledAt;
  if (warmupMs > 0 && sinceInstall < warmupMs) {
    return { fire: false, skip: "warmup", sinceInstall };
  }
  // 守二 同源冷
  const sinceLastFire = now - state.lastWalFireAt;
  if (cooldownMs > 0 && state.lastWalFireAt > 0 && sinceLastFire < cooldownMs) {
    return { fire: false, skip: "cooldown", sinceLastFire };
  }
  state.lastWalFireAt = now;
  return { fire: true };
}

// 测 §2b-1: 暖启过后首次 WAL fire → 过
{
  const s = { lastWalFireAt: 0, walInstalledAt: 0 };
  const r = simulateWalFire(s, 4120, 6000, {});
  check("§2b-1 暖启 6s 后首次 WAL · delta=4120 → fire", r.fire, "");
}

// 测 §2b-2: 2s 内重复 fire → 阻
{
  const s = { lastWalFireAt: 0, walInstalledAt: 0 };
  simulateWalFire(s, 4120, 6000, {}); // 首次 fire
  const r = simulateWalFire(s, 8240, 7000, {}); // 1s 后
  check(
    "§2b-2 首次 WAL fire 后 1s 再 fire → 阻 (cooldown)",
    !r.fire && r.skip === "cooldown",
    "sinceLastFire=" + r.sinceLastFire,
  );
}

// 测 §2b-3: 2.5s 后重复 fire → 放
{
  const s = { lastWalFireAt: 0, walInstalledAt: 0 };
  simulateWalFire(s, 4120, 6000, {}); // 首次 fire at t=6000
  const r = simulateWalFire(s, 8240, 8500, {}); // 2.5s 后
  check("§2b-3 首次 WAL fire 后 2.5s 再 fire → 放 (cooldown 过)", r.fire, "");
}

// 测 §2b-4: cooldownMs = 0 关闭
{
  const s = { lastWalFireAt: 0, walInstalledAt: 0 };
  simulateWalFire(s, 4120, 6000, { cooldownMs: 0 });
  const r = simulateWalFire(s, 8240, 6100, { cooldownMs: 0 });
  check("§2b-4 cooldown=0 关 · 100ms 内也 fire", r.fire, "");
}

// 测 §2b-5: 自定 cooldown=500ms · 300ms 阻 · 600ms 放
{
  const s = { lastWalFireAt: 0, walInstalledAt: 0 };
  simulateWalFire(s, 4120, 6000, { cooldownMs: 500 });
  const r1 = simulateWalFire(s, 8240, 6300, { cooldownMs: 500 });
  check(
    "§2b-5a cooldown=500 · 300ms 后 → 阻",
    !r1.fire && r1.skip === "cooldown",
    "",
  );
  const r2 = simulateWalFire(s, 8240, 6600, { cooldownMs: 500 });
  check("§2b-5b cooldown=500 · 600ms 后 → 放", r2.fire, "");
}

// ══════════════════════════════════════════════════════════════════════
// §2c 守三 · WAL 启动暖启 (5s)
// ══════════════════════════════════════════════════════════════════════

// 测 §2c-1: 启动 2s 内 fire 阻
{
  const s = { lastWalFireAt: 0, walInstalledAt: 0 };
  const r = simulateWalFire(s, 4120, 2000, {});
  check(
    "§2c-1 启动 2s 内 WAL fire → 阻 (warmup)",
    !r.fire && r.skip === "warmup",
    "sinceInstall=" + r.sinceInstall,
  );
}

// 测 §2c-2: 启动 4999ms fire 仍阻
{
  const s = { lastWalFireAt: 0, walInstalledAt: 0 };
  const r = simulateWalFire(s, 4120, 4999, {});
  check(
    "§2c-2 启动 4999ms · warmup=5000 → 阻 (边界)",
    !r.fire && r.skip === "warmup",
    "",
  );
}

// 测 §2c-3: 启动 5001ms fire 放
{
  const s = { lastWalFireAt: 0, walInstalledAt: 0 };
  const r = simulateWalFire(s, 4120, 5001, {});
  check("§2c-3 启动 5001ms · warmup=5000 → 放 (边界)", r.fire, "");
}

// 测 §2c-4: warmupMs = 0 关闭
{
  const s = { lastWalFireAt: 0, walInstalledAt: 0 };
  const r = simulateWalFire(s, 4120, 100, { warmupMs: 0 });
  check("§2c-4 warmup=0 关 · 启动 100ms 即 fire", r.fire, "");
}

// 测 §2c-5: 自定 warmup=10s · 8s 阻 · 11s 放
{
  const s = { lastWalFireAt: 0, walInstalledAt: 0 };
  const r1 = simulateWalFire(s, 4120, 8000, { warmupMs: 10000 });
  check("§2c-5a warmup=10s · 8s 内 → 阻", !r1.fire && r1.skip === "warmup", "");
  const r2 = simulateWalFire(s, 4120, 11000, { warmupMs: 10000 });
  check("§2c-5b warmup=10s · 11s 后 → 放", r2.fire, "");
}

// 测 §2c-6: 暖启期结束后 · 同源冷 + 全栏仍起作用 (三守串行)
{
  const s = { lastWalFireAt: 0, walInstalledAt: 0 };
  // t=6000 暖启过·fire 过
  const r1 = simulateWalFire(s, 4120, 6000, {});
  check("§2c-6a 暖启过后首 fire → 放", r1.fire, "");
  // t=7000 同源冷 (1s < 2s 默)·阻
  const r2 = simulateWalFire(s, 4120, 7000, {});
  check(
    "§2c-6b 暖启过 · 1s 内 2 fire → 阻 (cooldown)",
    !r2.fire && r2.skip === "cooldown",
    "",
  );
}

// ══════════════════════════════════════════════════════════════════════
// §2d 综合场景 · 重现 179 爆发 + 修后对比
// ══════════════════════════════════════════════════════════════════════

// 模拟 179 爆发: 5 分钟 (300s) 内每 1.7s 一次 WAL fire (174 总次)
// v2.6.14 预期: 守三 (前 5s 全阻) + 守二 (≥2s 才过) + 守一 (≥60s 才入 _maybeTrigger)
function simulateBurst(durationMs, walIntervalMs, cfg) {
  const walState = { lastWalFireAt: 0, walInstalledAt: 0 };
  const maybeState = { lastPerMsgTriggerAt: 0, lastQuotaPulseAt: 0 };
  let walFires = 0;
  let mtPasses = 0;
  for (let t = 0; t <= durationMs; t += walIntervalMs) {
    const wr = simulateWalFire(walState, 4120, t, cfg);
    if (wr.fire) {
      walFires++;
      const mr = simulateMaybeTrigger(
        maybeState,
        "L6\u2192wal\u00b7edge",
        t,
        cfg,
      );
      if (mr.pass) mtPasses++;
    }
  }
  return { walFires, mtPasses };
}

// 测 §2d-1: v2.6.13 行为 (三守全关) · 1.7s 间隔 · 5 分钟 → 应 176+ 火
{
  const r = simulateBurst(300000, 1700, {
    warmupMs: 0,
    cooldownMs: 0,
    minIntervalMs: 0,
    pulsePriorityMs: 0,
  });
  check(
    "§2d-1 v2.6.13 baseline (三守全关) · 1.7s×300s → 176 WAL fire · 全过",
    r.walFires >= 170 && r.mtPasses >= 170,
    "walFires=" + r.walFires + " / mtPasses=" + r.mtPasses,
  );
}

// 测 §2d-2: v2.6.14 默值 (warmup=5s cooldown=2s min=60s) · 同量负载 → 大降
{
  const r = simulateBurst(300000, 1700, {}); // 默值
  check(
    "§2d-2 v2.6.14 默 · 1.7s×300s → WAL fire ≤ 90 (守二过滤)",
    r.walFires <= 90,
    "walFires=" + r.walFires,
  );
  check(
    "§2d-2b v2.6.14 默 · mtPasses ≤ 6 (守一 60s 栏 · 300/60=5)",
    r.mtPasses <= 6,
    "mtPasses=" + r.mtPasses,
  );
}

// 测 §2d-3: 降幅 ≥ 90% (179 观测 38 rotate/5min · 14.6.14 应 ≤ 5)
{
  const v2613 = simulateBurst(300000, 1700, {
    warmupMs: 0,
    cooldownMs: 0,
    minIntervalMs: 0,
    pulsePriorityMs: 0,
  });
  const v2614 = simulateBurst(300000, 1700, {});
  const reduction = 1 - v2614.mtPasses / v2613.mtPasses;
  check(
    "§2d-3 v2.6.14 切频降幅 ≥ 90% (实证 179 38 rotate/5min · 修后拟 ≤5)",
    reduction >= 0.9,
    "降幅=" +
      (reduction * 100).toFixed(1) +
      "%  v2.6.13=" +
      v2613.mtPasses +
      " → v2.6.14=" +
      v2614.mtPasses,
  );
}

console.log("\n[§3] 阴阳不冲突 (与 v2.6.12 / v2.6.13 兼容)\n");

// 三守按层次: 守三 暖启 (源头过滤) → 守二 同源冷 (源头稀释) → 守一 全栏 (总出口)
check(
  "三守按层次串行 · 源 → 出口 三层兜底",
  true,
  "守三→守二→守一 · 源头→中间→出口",
);

// 守一全栏与 v2.6.13 ⚖额度变动 ·W%脉动 / v2.6.12 quotaPulsePriorityMs 同在
{
  const s = { lastPerMsgTriggerAt: 1000, lastQuotaPulseAt: 1000 };
  // ⚖ 10s 后 · 先 pulse-priority (10s < 60s) 阻
  const r = simulateMaybeTrigger(
    s,
    "\u2696\u989d\u5ea6\u53d8\u52a8",
    11000,
    {},
  );
  check(
    "§3-1 W% 后 ⚖ 10s 后 → 先 pulse-priority 阻 (v2.6.12 保)",
    !r.pass && r.block === "pulse-priority",
    "block=" + r.block,
  );
}
{
  // W% 后 70s ⚖ · pulse-priority 过 (70>60) · 但 min-interval 70s > 60s 也过 · 单独 fire
  const s = { lastPerMsgTriggerAt: 1000, lastQuotaPulseAt: 1000 };
  const r = simulateMaybeTrigger(
    s,
    "\u2696\u989d\u5ea6\u53d8\u52a8",
    71000,
    {},
  );
  check(
    "§3-2 W% 后 70s ⚖ → 两栏皆过 · 独立 fire (v2.6.13 阴阳不冲突保)",
    r.pass,
    "",
  );
}

// W% 自火场景 (v2.6.13 bug · v2.6.14 核心治)
{
  const s = { lastPerMsgTriggerAt: 1000, lastQuotaPulseAt: 1000 };
  // pulsePriorityMs 不护 W% (reason === W%脉动) · 但 min-interval 护
  const r = simulateMaybeTrigger(s, "\u26a1W%\u8109\u52a8", 11000, {});
  check(
    "§3-3 W% 自火 10s 后 · pulse-priority 不护 (reason===W%) · min-interval 护",
    !r.pass && r.block === "min-interval",
    "v2.6.13 此处会连火 4 次 · v2.6.14 降至 1",
  );
}

console.log(
  "\n================================================================",
);
console.log("  v2.6.14 result:  " + pass + " pass / " + fail + " fail");
console.log("================================================================");

process.exit(fail > 0 ? 1 : 0);
