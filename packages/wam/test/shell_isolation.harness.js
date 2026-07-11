// Standalone harness (NOT part of CI): runtime-verifies /shell per-session isolation
// (道并行而不相悖). Stubs `vscode`, injects a mock cloud provider that replies both
// synchronously and after an await, attaches two fake SSE clients, and asserts that
// host push-backs land only on the originating sid.
//
//   node core/rt-flow/test/shell_isolation.harness.js
const assert = require('assert');
const Module = require('module');

// ── stub `vscode` (provided by the IDE host in production) ──
const noop = () => {};
function deepProxy() {
  return new Proxy(function () {}, {
    get(_t, k) { if (k === 'then') return undefined; return deepProxy(); },
    apply() { return deepProxy(); },
    construct() { return deepProxy(); },
  });
}
const vscodeStub = new Proxy({
  commands: { executeCommand: async () => null, registerCommand: () => ({ dispose: noop }) },
  workspace: { getConfiguration: () => ({ get: () => undefined }), workspaceFolders: [] },
  window: { showInformationMessage: noop, showWarningMessage: noop, showErrorMessage: noop, createOutputChannel: () => ({ appendLine: noop, append: noop, show: noop, dispose: noop }) },
  env: { clipboard: { writeText: async () => {} } },
  Uri: { parse: (u) => ({ fsPath: u }), file: (p) => ({ fsPath: p }) },
  EventEmitter: class { constructor() { this.event = noop; } fire() {} dispose() {} },
  ViewColumn: { One: 1 },
}, { get(t, k) { return k in t ? t[k] : deepProxy(); } });

const _origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'vscode') return vscodeStub;
  return _origLoad.call(this, request, parent, isMain);
};

const ext = require('../extension.js');
const I = ext._internals;
assert.ok(I && typeof I.shellHandleMessage === 'function', 'shellHandleMessage missing');
assert.ok(typeof I.shellAttach === 'function', 'shellAttach missing');
assert.ok(typeof I.setCloudProvider === 'function', 'setCloudProvider missing');

// ── fake SSE client capturing pushed messages ──
function fakeClient() {
  const msgs = [];
  const res = {
    writeHead() {}, on() {},
    write(s) {
      const m = /^data: (.*)\n\n$/.exec(s);
      if (m) { try { msgs.push(JSON.parse(m[1])); } catch (e) {} }
    },
    end() {},
  };
  return { res, msgs };
}

// ── mock six-board cloud provider: a single shared host (matches dao-vsix reality) ──
//   handleMessage replies once synchronously and once after an await, via hostPost.
let _hostPost = null;
const mockProvider = {
  buildHtml(board) { return '<html><body data-board="' + (board || 'overview') + '"></body></html>'; },
  setHostPost(fn) { _hostPost = fn; },
  refresh() { if (_hostPost) _hostPost({ type: 'refresh' }); },
  async handleMessage(m) {
    if (_hostPost) _hostPost({ type: 'syncReply', tag: m.tag });          // synchronous push
    await new Promise((r) => setTimeout(r, m.delay || 0));
    if (_hostPost) _hostPost({ type: 'asyncReply', tag: m.tag });         // post-await push
  },
};
I.setCloudProvider(mockProvider);

(async () => {
  const A = fakeClient(), B = fakeClient();
  I.shellAttach('sidA', A.res);
  I.shellAttach('sidB', B.res);

  // T1: A makes a SLOW relay, B makes a FAST relay almost simultaneously.
  //     With per-sid serialized routing, every reply must land on its own sid.
  const pA = I.shellHandleMessage('sidA', { type: 'cloudRelay', msg: { command: 'slow', tag: 'A', delay: 60 } });
  const pB = I.shellHandleMessage('sidB', { type: 'cloudRelay', msg: { command: 'fast', tag: 'B', delay: 0 } });
  await Promise.all([pA, pB]);
  await new Promise((r) => setTimeout(r, 120));

  const tagsA = A.msgs.filter((m) => m.type === 'cloudHost').map((m) => m.msg.tag).sort();
  const tagsB = B.msgs.filter((m) => m.type === 'cloudHost').map((m) => m.msg.tag).sort();
  console.log('A received tags:', JSON.stringify(tagsA));
  console.log('B received tags:', JSON.stringify(tagsB));

  assert.deepStrictEqual(tagsA, ['A', 'A'], 'sidA must receive ONLY its own sync+async replies');
  assert.deepStrictEqual(tagsB, ['B', 'B'], 'sidB must receive ONLY its own sync+async replies');
  assert.ok(!tagsA.includes('B'), '道并行而不相悖: B must not leak into A');
  assert.ok(!tagsB.includes('A'), '道并行而不相悖: A must not leak into B');

  // T2: cloudInit reply (cloudInitHtml) goes only to requester.
  const C = fakeClient();
  I.shellAttach('sidC', C.res);
  await I.shellHandleMessage('sidC', { type: 'cloudInit', board: 'bridge' });
  const initOnC = C.msgs.some((m) => m.type === 'cloudInitHtml' && m.board === 'bridge');
  const initLeak = A.msgs.concat(B.msgs).some((m) => m.type === 'cloudInitHtml');
  assert.ok(initOnC, 'cloudInitHtml must reach the requesting sid');
  assert.ok(!initLeak, 'cloudInitHtml must NOT leak to other sids');

  // T3: between tasks (no active sid), proactive refresh broadcasts to all (shared data).
  A.msgs.length = 0; B.msgs.length = 0; C.msgs.length = 0;
  await new Promise((r) => setTimeout(r, 5));
  mockProvider.refresh();
  const refreshAll = [A, B, C].every((c) => c.msgs.some((m) => m.type === 'cloudHost' && m.msg.type === 'refresh'));
  assert.ok(refreshAll, 'proactive refresh between tasks should broadcast to all shell pages');

  console.log('\nALL ISOLATION CHECKS PASSED ✓ (道并行而不相悖 · 鸡犬相闻 · 老死不相往来)');
  process.exit(0);
})().catch((e) => { console.error('HARNESS FAIL:', e && e.message); process.exit(1); });
