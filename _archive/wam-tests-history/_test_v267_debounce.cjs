// v2.6.10 治人事天·莫若啬 · checkpoint 过滤 回归测试 (包含 v2.6.9 回归)
//
// 演化历史:
//   v2.6.6: settle (debounce trailing edge) 替 cooloff · reset 自夺防抖
//   v2.6.7: 删 settle 路径中的 reset (守一) · 会 saw 4s 防抖送多源收一道
//   v2.6.8: 实证仍雪崩 22s/次切号 · 根因是多 .pb 文件并发 + claim 锁失效
//   v2.6.9: 头损 settle 整段 + WAL 边沿首发 + 60s 全局强锁 (反者道之动) · 实证降幅 98.9%
//   v2.6.10: WAL 上限过滤 checkpoint (实证 840KB/708KB edge·fire 是 auto_checkpoint) · 治人事天·莫若啬
//
// 验证维度 (v2.6.10 接代 v2.6.9 · 全兼容):
//   §1 静态规约 (extension.js 文本分析)
//     - VERSION === "2.6.10"
//     - v2.6.9 尽纯 (settle 已删 · edge 已立 · 60s 强锁 · 纯 bucket)
//     - v2.6.10 新: _skipWalEdge 存 / walEdgeMaxBytes 配 / _edgeSkipCount 声 / skip log / diag 扩
//   §2 行为隔离 (v2.6.9 4s 防抖 + 60s 强锁 逻辑 仍需验)
//   §3 实战追演 (三代模型对比: v2.6.6 / v2.6.7 / v2.6.9)
//   §4 _per_msg_diag.json schema 兼容 (v2.6.10 新字段向后兼容)
//
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

let pass = 0;
let fail = 0;
function expect(name, cond, detail) {
  const tag = cond ? "OK" : "X ";
  console.log("  [" + tag + "] " + name + (detail ? " | " + detail : ""));
  if (cond) {
    pass++;
  } else {
    fail++;
    console.log("       !! FAIL: " + name);
  }
}

console.log(
  "\n================================================================",
);
console.log("  v2.6.10 zhi ren shi tian - mo ruo se - checkpoint guard");
console.log("================================================================");

// ════════════════════════════════════════════════════════════════
// §1 静态规约 (extension.js 文本分析)
// ════════════════════════════════════════════════════════════════
console.log("\n[§1] static contract analysis\n");

const extPath = path.join(__dirname, "extension.js");
const extSrc = fs.readFileSync(extPath, "utf8");
const lines = extSrc.split("\n");

// 1.1 VERSION === "2.6.10"
{
  const m = extSrc.match(/^const VERSION = "([0-9.]+)";/m);
  const v = m ? m[1] : "??";
  expect("VERSION === 2.6.10", v === "2.6.10", "actual=" + v);
}

// 1.2 v2.6.9: _firePbSettle 函数已删 (settle 信号源本错位 · 雪崩本源)
{
  expect(
    "v2.6.9 _firePbSettle 函数已删 (settle 信号错位)",
    !/function\s+_firePbSettle\s*\(/.test(extSrc),
    "损 settle 模型 · pb 增量=AI 流·不该切号",
  );
  expect(
    "v2.6.9 _maybeTrigger 'L6→pb·settle' 调用已删",
    !extSrc.includes('_maybeTrigger("L6→pb·settle"'),
    "settle 路径清除",
  );
}

// 1.3 v2.6.9: _fireWalSettle 已删 · _fireWalEdge 接代 (边沿首发)
{
  expect(
    "v2.6.9 _fireWalSettle 函数已删 (settle 对 WAL 实证 0 触发)",
    !/function\s+_fireWalSettle\s*\(/.test(extSrc),
    "实证: SQLite checkpoint 15s 内抢截·累积永不到阈值",
  );
  expect(
    "v2.6.9 _fireWalEdge 函数存在 (边沿首发接代)",
    /function\s+_fireWalEdge\s*\(/.test(extSrc),
    "单次 delta ≥ 阈值即 fire · 不累积不等 settle",
  );
  expect(
    "v2.6.9 _maybeTrigger 'L6→wal·settle' 已删",
    !extSrc.includes('_maybeTrigger("L6→wal·settle"'),
    "settle 路径清除",
  );
  expect(
    "v2.6.9 _maybeTrigger 'L6→wal·edge' 调用存在",
    extSrc.includes('_maybeTrigger("L6→wal·edge"'),
    "边沿首发 → _maybeTrigger",
  );
}

// 1.4 v2.6.9: pb·new 上方的 _lastPerMsgTriggerAt = 0 已删 (最后一处自夺防抖)
{
  let foundCall = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('_maybeTrigger("L6→pb·new"')) {
      foundCall = i;
      break;
    }
  }
  expect(
    "pb·new _maybeTrigger 调用存在 (保留唯一信号源)",
    foundCall >= 0,
    "line=" + (foundCall + 1),
  );

  if (foundCall >= 0) {
    // v2.6.9: 上方 5 行代码中不应有 _lastPerMsgTriggerAt = 0 (最后一处自夺已删)
    const ctxStart = Math.max(0, foundCall - 5);
    const codeLines = lines
      .slice(ctxStart, foundCall)
      .map((l) => l.split("//")[0]); // 剥行尾注释
    const codeOnly = codeLines.join("\n");
    expect(
      "v2.6.9 pb·new 上方代码无 _lastPerMsgTriggerAt = 0 (最后自夺损之)",
      !codeOnly.match(/_lastPerMsgTriggerAt\s*=\s*0/),
      "ctx 行 " + (ctxStart + 1) + "-" + foundCall,
    );
  }
}

// 1.4b v2.6.9: perMessageMinIntervalMs 默认 60000 (60s 全局强锁)
{
  expect(
    "v2.6.9 perMessageMinIntervalMs 默认 60000",
    /_cfg\("perMessageMinIntervalMs",\s*60000/.test(extSrc),
    "实证 v2.6.8 22s/次切号 · 60s 强锁后 ≥1:1 用户对话频率",
  );
}

// 1.4c v2.6.9: _maybeTrigger 内 minInterval-locked 日志路径
{
  expect(
    "v2.6.9 _maybeTrigger 包含 minInterval-locked 日志",
    extSrc.includes("minInterval-locked"),
    "诊断强锁拦截事件 · 可调",
  );
}

// 1.4d v2.6.9: WAL claim key = "wal." + bucket + ".edge" (纯 bucket · 多源合一)
{
  expect(
    'v2.6.9 WAL claim key = "wal." + bucket + ".edge" (纯 bucket)',
    /"wal\."\s*\+\s*bucket\s*\+\s*"\.edge"/.test(extSrc),
    "不带 prefix · 多 ext-host 实例派生收一道",
  );
}

// 1.5 _perMsgDebounced 状态变量声明
{
  expect(
    "_perMsgDebounced 全局状态变量声明",
    /_perMsgDebounced\s*=\s*0/.test(extSrc),
    "regex /_perMsgDebounced = 0/",
  );
}

// 1.6 _maybeTrigger 防抖分支含计数 + 诊断写入
{
  // 找 _maybeTrigger 函数体
  const fnStart = lines.findIndex((l) => l.match(/^function _maybeTrigger\(/));
  expect("_maybeTrigger 函数定义存在", fnStart >= 0, "line=" + (fnStart + 1));

  if (fnStart >= 0) {
    // 取函数前 60 行 (包含防抖分支)
    const fnBody = lines.slice(fnStart, fnStart + 60).join("\n");
    expect(
      "防抖分支含 _perMsgDebounced++",
      /_perMsgDebounced\+\+/.test(fnBody),
      "in _maybeTrigger first 60 lines",
    );
    expect(
      "防抖分支含 totalDebounced 写入",
      /prev\.totalDebounced\s*=\s*_perMsgDebounced/.test(fnBody),
      "in _maybeTrigger first 60 lines",
    );
    expect(
      "防抖分支含 atomicWrite 入 _per_msg_diag.json",
      /atomicWrite\(diagP/.test(fnBody) && /_per_msg_diag\.json/.test(fnBody),
      "in _maybeTrigger first 60 lines",
    );
  }
}

// ==================================================================
// 1.8 ~ 1.12 · v2.6.10 新增奇 (checkpoint 过滤 · 空间过滤 + 时间强锁 两道互补)
// ==================================================================

// 1.8 v2.6.10: _skipWalEdge 函数存在 (checkpoint 识别+跳过)
{
  expect(
    "v2.6.10 _skipWalEdge 函数存在 (checkpoint 过滤)",
    /function\s+_skipWalEdge\s*\(/.test(extSrc),
    "WAL_EDGE_MAX 超限 → skip 不 fire · 道法自然·莫若啬",
  );
}

// 1.9 v2.6.10: walEdgeMaxBytes 配置读取存在 (默 65536)
{
  expect(
    'v2.6.10 _cfg("walEdgeMaxBytes", 65536) 配置读取存在',
    /_cfg\("walEdgeMaxBytes",\s*65536/.test(extSrc),
    "64KB 上限 · user send 常 4-32KB · checkpoint 常 MB级",
  );
}

// 1.10 v2.6.10: _edgeSkipCount 全局声明
{
  expect(
    "v2.6.10 _edgeSkipCount 全局声明",
    /_edgeSkipCount\s*=\s*0/.test(extSrc),
    "诊断计数 · wal·edge·skip 总次",
  );
}

// 1.11 v2.6.10: wal·edge·skip[checkpoint: 日志模板
{
  expect(
    "v2.6.10 wal·edge·skip[checkpoint: log 模板存在",
    /edge·skip\[checkpoint:/.test(extSrc),
    "与 edge·fire 双轨可观 · 分而中之",
  );
}

// 1.12 v2.6.10: diag 新字段 (lastEdgeDelta / lastCheckpointDelta / edgeSkipCount)
{
  expect(
    "v2.6.10 diag 写入 lastEdgeDelta (user send 真信号分布)",
    /prev\.lastEdgeDelta\s*=\s*delta/.test(extSrc),
    "在 _fireWalEdge 写入 · 记录 user send 分布",
  );
  expect(
    "v2.6.10 diag 写入 lastCheckpointDelta",
    /prev\.lastCheckpointDelta\s*=\s*delta/.test(extSrc),
    "在 _skipWalEdge 写入 · checkpoint 分布",
  );
  expect(
    "v2.6.10 diag 写入 edgeSkipCount",
    /prev\.edgeSkipCount\s*=\s*_edgeSkipCount/.test(extSrc),
    "skip 总次",
  );
}

// 1.13 v2.6.10: 主 poll 循环含 WAL_EDGE_MAX 分支
{
  expect(
    "v2.6.10 主 poll 循环含 WAL_EDGE_MAX 上限分支",
    /WAL_EDGE_MAX\s*>\s*0\s*&&\s*delta\s*>\s*WAL_EDGE_MAX/.test(extSrc),
    "delta > MAX → _skipWalEdge · 不 fire · 不切号",
  );
}

// 1.14 v2.6.10: package.json 含 walEdgeMaxBytes 配置项
{
  const pkgPath = path.join(__dirname, "package.json");
  if (fs.existsSync(pkgPath)) {
    const pkgSrc = fs.readFileSync(pkgPath, "utf8");
    expect(
      "v2.6.10 package.json 含 wam.walEdgeMaxBytes",
      /"wam\.walEdgeMaxBytes"/.test(pkgSrc) &&
        /"default":\s*65536/.test(pkgSrc),
      "user 配置面暴露 · 默 64KB · 0=关上限",
    );
    expect(
      "v2.6.10 package.json version === 2.6.10",
      /"version":\s*"2\.6\.10"/.test(pkgSrc),
      "与 extension.js VERSION 同步",
    );
  } else {
    expect("v2.6.10 package.json 存在", false, pkgPath);
  }
}

// 1.7 v2.6.9 changelog 头部记录存在 (v2.6.9 注释 ~9.4KB · 窗口扩至 12000)
{
  const headBlock = extSrc.substring(0, 12000);
  expect(
    "head changelog 含 v2.6.9 道法自然",
    /v2\.6\.9.*道法自然/s.test(headBlock),
    "regex /v2.6.9.*道法自然/ in 0..12000",
  );
  // 保留 v2.6.7 历史设况检查 (作为演化锁定)
  expect(
    "head changelog 仍含 v2.6.7 守一 (演化史记录)",
    /v2\.6\.7.*守一/s.test(headBlock),
    "regex /v2.6.7.*守一/ in 0..12000",
  );
}

// ════════════════════════════════════════════════════════════════
// §2 行为隔离 (核心防抖逻辑独立验)
// ════════════════════════════════════════════════════════════════
console.log("\n[§2] behavior isolated test (debounce core logic)\n");

// 模拟 _maybeTrigger 防抖核心 (复刻 v2.6.7 逻辑)
// 注: 真实代码 _lastPerMsgTriggerAt = 0 但 now = Date.now() (~1.77e12)
//     差 > 4000 故首过. 测试用 -Infinity 模拟此初始化语义.
function makeDebouncer(debounceMs) {
  let lastFireAt = Number.NEGATIVE_INFINITY;
  let hits = 0;
  let debounced = 0;
  return {
    fire(now) {
      if (now - lastFireAt < debounceMs) {
        debounced++;
        return "debounced";
      }
      lastFireAt = now;
      hits++;
      return "hit";
    },
    get hits() {
      return hits;
    },
    get debounced() {
      return debounced;
    },
  };
}

{
  const d = makeDebouncer(4000);

  // T=0: 首 fire 必过
  expect("T=0 首 fire = hit", d.fire(0) === "hit", "hits=" + d.hits);

  // T=100: 4s 内, 必拦
  expect(
    "T=100ms 同窗口 = debounced",
    d.fire(100) === "debounced",
    "debounced=" + d.debounced,
  );

  // T=2000: 4s 内, 拦
  expect(
    "T=2000ms 同窗口 = debounced",
    d.fire(2000) === "debounced",
    "debounced=" + d.debounced,
  );

  // T=3999: 边界内, 拦
  expect(
    "T=3999ms 边界内 = debounced",
    d.fire(3999) === "debounced",
    "debounced=" + d.debounced,
  );

  // T=4001: 出窗口, 过
  expect("T=4001ms 出窗口 = hit", d.fire(4001) === "hit", "hits=" + d.hits);

  // 总计: 2 hits + 3 debounced
  expect(
    "总计 hits=2 + debounced=3",
    d.hits === 2 && d.debounced === 3,
    "hits=" + d.hits + " debounced=" + d.debounced,
  );
}

// ════════════════════════════════════════════════════════════════
// §3 实战追演 (实证根因样本)
// ════════════════════════════════════════════════════════════════
console.log("\n[§3] real-world scenario replay (4-min rate-limit avalanche)\n");

// 实证根因 4 分钟样本 (从 wam.log 抽取的真切号时刻):
// 11:25:05.730 pb·settle 2f3f16b2+26858  base
// 11:25:06.273 pb·settle bb141f7a+11037  +543ms  ← 应防抖
// 11:25:11.279 pb·new   0c3ec7c1
// 11:25:14.131 pb·settle b6a6e6a0+100258 +2852ms 自 new
// 11:26:00.405 pb·settle b6a6e6a0+86472  +46s   真新事件
// 11:26:21.955 pb·settle bb141f7a+10180  +21s   真新事件
// 11:26:22.857 pb·settle df3fc58b+107190 +902ms ← 应防抖
// 11:26:29.158 pb·settle 2f3f16b2+17754  +6.3s  > 4s 自然过
// 11:26:31.125 pb·settle b6a6e6a0+83736  +1.97s ← 应防抖

const samples = [
  { t: 0, label: "11:25:05.730 pb·settle 2f3f16b2" },
  { t: 543, label: "11:25:06.273 pb·settle bb141f7a (+543ms)" },
  { t: 5549, label: "11:25:11.279 pb·new   0c3ec7c1" },
  { t: 8401, label: "11:25:14.131 pb·settle b6a6e6a0" },
  { t: 54675, label: "11:26:00.405 pb·settle b6a6e6a0" },
  { t: 76225, label: "11:26:21.955 pb·settle bb141f7a" },
  { t: 77127, label: "11:26:22.857 pb·settle df3fc58b (+902ms)" },
  { t: 83428, label: "11:26:29.158 pb·settle 2f3f16b2 (+6.3s)" },
  { t: 85395, label: "11:26:31.125 pb·settle b6a6e6a0 (+1.97s)" },
];

const v266 = makeDebouncer(0); // v2.6.6 行为: 每 fire 前 reset → 0 防抖窗
const v267 = makeDebouncer(4000);

console.log("  样本 (实证 wam.log):\n");
for (const s of samples) {
  v266.fire(s.t);
  v267.fire(s.t);
}

console.log(
  "  v2.6.6 (reset 自夺) hits=" + v266.hits + " debounced=" + v266.debounced,
);
console.log(
  "  v2.6.7 (守一)       hits=" + v267.hits + " debounced=" + v267.debounced,
);

expect(
  "v2.6.6 模型: 9 fire 全过 (reset 自夺防抖)",
  v266.hits === 9 && v266.debounced === 0,
  "hits=" + v266.hits + " debounced=" + v266.debounced,
);

expect(
  "v2.6.7 模型: 5 hit + 4 debounced (多源派生收一道)",
  v267.hits === 5 && v267.debounced === 4,
  "hits=" + v267.hits + " debounced=" + v267.debounced,
);

const reduction = ((v266.hits - v267.hits) / v266.hits) * 100;
expect(
  "v2.6.7 切号率降 >= 40% (多源派生 settle 聚合)",
  reduction >= 40,
  "实降 " + reduction.toFixed(1) + "%",
);

// v2.6.9 模型追加对比: 60s 全局强锁 (60000ms debounce window)
const v269 = makeDebouncer(60000);
for (const s of samples) {
  v269.fire(s.t);
}
console.log(
  "  v2.6.9 (60s 强锁)   hits=" + v269.hits + " debounced=" + v269.debounced,
);
expect(
  "v2.6.9 模型: 60s 强锁 (原 9 样本 · 跨 60s+ 事件仅 11:26 一个)",
  v269.hits <= 2,
  "hits=" + v269.hits + " debounced=" + v269.debounced,
);
const reduction269 = ((v266.hits - v269.hits) / v266.hits) * 100;
expect(
  "v2.6.9 切号率降 >= 75% (边沿+强锁合道)",
  reduction269 >= 75,
  "实降 " + reduction269.toFixed(1) + "%",
);

// ════════════════════════════════════════════════════════════════
// §4 _per_msg_diag.json schema 兼容性 (totalDebounced 添加不破坏)
// ════════════════════════════════════════════════════════════════
console.log("\n[§4] _per_msg_diag.json schema compat\n");

const tmpDiag = path.join(
  os.tmpdir(),
  "wam-v267-test-" + process.pid + ".json",
);

// 模拟 v2.5.9 旧 diag 文件 (无 totalDebounced 字段)
fs.writeFileSync(
  tmpDiag,
  JSON.stringify({
    hits: [{ t: 1000, reason: "test", hint: "x" }],
    rotates: [],
    totalHits: 1,
    totalRotates: 0,
    lastHit: 1000,
  }),
);

// v2.6.7 防抖入路径模拟: 读旧 → 加 totalDebounced → 回写
{
  const prev = JSON.parse(fs.readFileSync(tmpDiag, "utf8"));
  prev.totalDebounced = 1;
  prev.lastDebounced = 2000;
  fs.writeFileSync(tmpDiag, JSON.stringify(prev, null, 2));

  const after = JSON.parse(fs.readFileSync(tmpDiag, "utf8"));
  expect(
    "旧字段保留: totalHits, hits[], totalRotates",
    after.totalHits === 1 &&
      Array.isArray(after.hits) &&
      after.hits.length === 1 &&
      after.totalRotates === 0,
    "totalHits=" + after.totalHits + " hits=" + after.hits.length,
  );
  expect(
    "新字段添: totalDebounced, lastDebounced",
    after.totalDebounced === 1 && after.lastDebounced === 2000,
    "totalDebounced=" + after.totalDebounced,
  );
}

// 清理
try {
  fs.unlinkSync(tmpDiag);
} catch {}

// ════════════════════════════════════════════════════════════════
// 总结
// ════════════════════════════════════════════════════════════════
console.log(
  "\n================================================================",
);
console.log(`  v2.6.10 result:  ${pass} pass / ${fail} fail`);
console.log("================================================================");
process.exit(fail > 0 ? 1 : 0);
