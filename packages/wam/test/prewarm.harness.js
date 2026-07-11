// Standalone harness (NOT part of CI): runtime-verifies v3.51.0 throttled auth1
// prewarm (多实例首开提速 · 反者道之动). Stubs `vscode` (config returns defaults)
// and monkeypatches devin_cloud.getCachedAuth to drive the filter/bound paths.
//
//   node core/rt-flow/test/prewarm.harness.js
"use strict";
const assert = require("assert");
const Module = require("module");

// ── stub `vscode`: getConfiguration().get(k, d) must return the default d ──
const noop = () => {};
function deepProxy() {
  return new Proxy(function () {}, {
    get(_t, k) { if (k === "then") return undefined; return deepProxy(); },
    apply() { return deepProxy(); },
    construct() { return deepProxy(); },
  });
}
// mutable config overrides for testing prewarm.* gates
const CFG = {};
const vscodeStub = new Proxy({
  commands: { executeCommand: async () => null, registerCommand: () => ({ dispose: noop }) },
  workspace: {
    getConfiguration: () => ({ get: (k, d) => (k in CFG ? CFG[k] : d) }),
    workspaceFolders: [],
  },
  window: { showInformationMessage: noop, showWarningMessage: noop, showErrorMessage: noop, createOutputChannel: () => ({ appendLine: noop, append: noop, show: noop, dispose: noop }) },
  env: { clipboard: { writeText: async () => {} } },
  Uri: { parse: (u) => ({ fsPath: u }), file: (p) => ({ fsPath: p }) },
  EventEmitter: class { constructor() { this.event = noop; } fire() {} dispose() {} },
  ViewColumn: { One: 1, Active: -1 },
}, { get(t, k) { return k in t ? t[k] : deepProxy(); } });

const _origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "vscode") return vscodeStub;
  return _origLoad.call(this, request, parent, isMain);
};

const cloud = require("../devin_cloud.js");
const ext = require("../extension.js");
const I = ext._internals;
assert.ok(I && typeof I._prewarmAuthThrottled === "function", "_prewarmAuthThrottled missing");

let passed = 0, failed = 0;
const failures = [];
async function test(name, fn) {
  try { await fn(); passed++; console.log("  ok   " + name); }
  catch (e) { failed++; failures.push([name, e]); console.log("  FAIL " + name + " — " + (e && e.message)); }
}

(async () => {
  console.log("\n[v3.51.0 throttled prewarm · 守门]");

  // §A 配置关闭 → 立即返回 disabled · 零探测
  await test("§A wam.prewarm.enabled=false → {disabled} · 不探测缓存", async () => {
    CFG["prewarm.enabled"] = false;
    let probed = 0; cloud.getCachedAuth = () => { probed++; return null; };
    const r = await I._prewarmAuthThrottled(["a@x.com", "b@x.com"]);
    assert.strictEqual(r.disabled, true, "should be disabled");
    assert.strictEqual(probed, 0, "must not probe when disabled");
    delete CFG["prewarm.enabled"];
  });

  // §B 限速窗口内 → 整体让位 (rateLimited) · 零探测
  await test("§B 限速窗口内 → {rateLimited} · 零网络", async () => {
    let probed = 0; cloud.getCachedAuth = () => { probed++; return null; };
    I._setDevinLoginRateLimitedUntil(Date.now() + 60000);
    const r = await I._prewarmAuthThrottled(["a@x.com"]);
    assert.strictEqual(r.rateLimited, true, "should yield under rate-limit window");
    assert.strictEqual(probed, 0, "must not probe under rate-limit window");
    I._setDevinLoginRateLimitedUntil(0);
  });

  // §C 命中缓存全跳 → warmed 0 · getAuth 永不触发
  await test("§C 已缓存(有 auth1)全跳过 → warmed 0 · 不登录", async () => {
    cloud.getCachedAuth = () => ({ auth1: "X", userId: "u" });
    cloud.getAuth = async () => { throw new Error("getAuth must NOT be called for cached accounts"); };
    const r = await I._prewarmAuthThrottled(["a@x.com", "b@x.com", "a@x.com"]);
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.warmed, 0, "cached → nothing to warm");
    assert.strictEqual(I._prewarmInProgress, false, "flag reset after run");
  });

  // §D 去重 + maxCount 限量: 20 个未缓存号 · 默认上限 8 → 仅尝试 8 次
  await test("§D 去重+限量: 20 号未缓存 → 仅 maxCount(8) 个进队尝试", async () => {
    // 未缓存 → 无 _store/password → _resolveAuthForEmail 返回未授权 → 计入 failed
    cloud.getCachedAuth = () => null;
    cloud.getAuth = async () => ({ ok: false });
    const emails = [];
    for (let i = 0; i < 20; i++) emails.push("u" + i + "@x.com");
    emails.push("u0@x.com"); // 重复 → 应被去重
    const r = await I._prewarmAuthThrottled(emails);
    assert.strictEqual(r.ok, true);
    assert.strictEqual((r.warmed || 0) + (r.failed || 0), 8, "bounded to maxCount=8 attempts");
    assert.strictEqual(r.warmed, 0, "no password/store → none actually warmed");
  });

  // §E 显式 opts 覆盖 maxCount=3
  await test("§E opts.maxCount=3 覆盖 → 仅 3 个尝试", async () => {
    cloud.getCachedAuth = () => null;
    cloud.getAuth = async () => ({ ok: false });
    const emails = [];
    for (let i = 0; i < 10; i++) emails.push("v" + i + "@x.com");
    const r = await I._prewarmAuthThrottled(emails, { maxCount: 3, gapMs: 0 });
    assert.strictEqual((r.warmed || 0) + (r.failed || 0), 3, "bounded to opts.maxCount=3");
  });

  // §F 单飞: 并发两次 → 第二次 busy
  await test("§F 重叠并发 → 第二次 {busy} (单飞防重叠)", async () => {
    let resolveGate; const gate = new Promise((res) => { resolveGate = res; });
    cloud.getCachedAuth = () => null;
    cloud.getAuth = async () => { await gate; return { ok: false }; };
    // 注: _resolveAuthForEmail 无 _store/password 时不会真调 getAuth, 故用 gapMs 拉长占用窗口
    const p1 = I._prewarmAuthThrottled(["w0@x.com", "w1@x.com", "w2@x.com"], { gapMs: 50, concurrency: 1 });
    // p1 进行中 (gapMs 间隔占用) → 立即第二次应 busy
    await new Promise((r) => setTimeout(r, 10));
    const r2 = await I._prewarmAuthThrottled(["z@x.com"]);
    resolveGate();
    await p1;
    assert.strictEqual(r2.busy, true, "second concurrent call must be busy");
    assert.strictEqual(I._prewarmInProgress, false, "flag reset after p1 done");
  });

  console.log("\n" + (failed ? "FAILED " : "PASSED ") + passed + " passed, " + failed + " failed");
  if (failed) { for (const [n, e] of failures) console.log("  ✗ " + n + ": " + (e && e.stack || e)); process.exit(1); }
})();
