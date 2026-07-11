"use strict";
// ═══════════════════════════════════════════════════════════════════════════
// term-coexist.test.js — Proxy Pro · 终端兜底 HTTP 服务三插件共存单测
//   (node test/term-coexist.test.js)
//
// 根病(实证于本地三插件共存 exthost 日志):
//   standalone dao-proxy-pro 与 dao-one/vendor-proxy 会各自尝试起同一 per-user
//   term HTTP 兜底口(:12780+FNV偏置)。旧实现 server.on('error') 仅 L.warn 后留下一个
//   listen 失败的死 server(_DAO_TERM_HTTP 指向它),既不复用在位者也刷 WARN 噪声。
//
// 道义(四十:反者道之动·弱者道之用 / 七十六:兵强则不胜):
//   与代理口 :8985 同规 — EADDRINUSE 时 ping 在位者,确认是活的 dao term 服务即
//   柔弱让位/复用共享(termShared=true·不留死 server),仅端口被非-dao 进程占用才告警。
//
// 覆盖:
//   1. 端口空闲 → 正常 listen(termHttp!=null · termShared=false)· /term/ping 通
//   2. 端口已被「活的 dao term 服务」占用 → EADDRINUSE 柔弱让位(termShared=true · 不留死 server)
//   3. 端口被「非 dao 进程」占用(/term/ping 非法) → 不误判共享(termShared=false)
// ═══════════════════════════════════════════════════════════════════════════
const assert = require("assert");
const http = require("http");
const Module = require("module");

process.env.DAO_PP_SELFTEST = "1";

// ── vscode 桩: 递归 Proxy(仅供 module load 期解析) ──
function makeVscodeStub() {
  const handler = {
    get(_t, prop) {
      if (prop === Symbol.toPrimitive) return () => "";
      if (prop === Symbol.iterator) return function* () {};
      if (prop === "then") return undefined;
      if (prop === "workspaceFolders") return undefined;
      return proxy;
    },
    apply() { return proxy; },
    construct() { return proxy; },
  };
  const target = function () {};
  const proxy = new Proxy(target, handler);
  return proxy;
}
const _origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "vscode") return makeVscodeStub();
  return _origLoad.call(this, request, parent, isMain);
};

const ext = require("../extension.js");
const T = ext.__test;
assert.ok(T, "__test seam 未暴露 (DAO_PP_SELFTEST 未生效?)");

let passed = 0;
function ok(name) { console.log("  PASS  " + name); passed++; }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 起一个假的「活 dao term 服务」占口(仅答 /term/ping)
function startFakeTerm(port, body) {
  return new Promise((resolve, reject) => {
    const srv = http.createServer((req, res) => {
      res.setHeader("content-type", "application/json; charset=utf-8");
      if (req.method === "GET" && req.url === "/term/ping") {
        res.end(JSON.stringify(body));
        return;
      }
      res.statusCode = 404;
      res.end(JSON.stringify({ error: "not found" }));
    });
    srv.on("error", reject);
    srv.listen(port, "127.0.0.1", () => resolve(srv));
  });
}

(async () => {
  const PORT = T._termHttpPort();
  assert.ok(PORT >= 12780 && PORT <= 12829, `per-user 端口应在 12780..12829, 实得 ${PORT}`);

  // ── T1: 端口空闲 → 正常 listen ──
  T._reset();
  T._startDaoTermService({ subscriptions: [] });
  await sleep(150);
  assert.ok(T.termHttp, "端口空闲时应起自家 term server");
  assert.strictEqual(T.termShared, false, "端口空闲时 termShared 必为 false");
  const ping1 = await new Promise((resolve) => {
    http.get(`http://127.0.0.1:${PORT}/term/ping`, (res) => {
      let d = ""; res.on("data", (c) => (d += c));
      res.on("end", () => resolve(JSON.parse(d)));
    }).on("error", () => resolve(null));
  });
  assert.ok(ping1 && ping1.ok === true, "自家 /term/ping 应答 ok:true");
  assert.strictEqual(ping1.port, PORT, "ping 回报端口应一致");
  ok("T1 端口空闲 → 正常 listen · /term/ping 通 · termShared=false");
  T._reset();
  await sleep(50);

  // ── T2: 端口被「活 dao term 服务」占用 → 柔弱让位/复用共享 ──
  const fake = await startFakeTerm(PORT, { ok: true, version: "9.9.999-fake", port: PORT, sessions: 3 });
  T._reset(); // 清 T1 残留(注意: _reset 关的是自家 server, 不动 fake)
  T._startDaoTermService({ subscriptions: [] });
  await sleep(300); // 待 EADDRINUSE → ping → 判定
  assert.strictEqual(T.termShared, true, "在位者是活 dao term 服务时应复用共享(termShared=true)");
  assert.strictEqual(T.termHttp, null, "复用共享时不应留下死 server(termHttp=null)");
  ok("T2 端口被活 dao term 占用 → EADDRINUSE 柔弱让位·复用共享 · 无死 server");
  await new Promise((r) => fake.close(r));
  T._reset();
  await sleep(50);

  // ── T3: 端口被「非 dao 进程」占用 → 不误判共享 ──
  const alien = await startFakeTerm(PORT, { hello: "not-a-dao-term" }); // /term/ping 无 ok
  T._reset();
  T._startDaoTermService({ subscriptions: [] });
  await sleep(300);
  assert.strictEqual(T.termShared, false, "非 dao 进程占口时不得误判为共享");
  assert.strictEqual(T.termHttp, null, "占口失败时不应留下死 server");
  ok("T3 端口被非 dao 进程占用 → 不误判共享 · 让位告警");
  await new Promise((r) => alien.close(r));
  T._reset();

  console.log(`\n  term-coexist: ${passed}/3 PASS`);
  Module._load = _origLoad;
  process.exit(passed === 3 ? 0 : 1);
})().catch((e) => {
  console.error("  FAIL ", e && e.stack || e);
  process.exit(1);
});
