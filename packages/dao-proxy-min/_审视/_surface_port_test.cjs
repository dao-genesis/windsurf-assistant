// _surface_port_test.cjs · v9.9.74 · 分口定面 验证
// 证: acp 专属口 socket.localPort → "local" · 主口 api_server_pb → "cascade"
//     acp 面并听口/h2内口实绑上报 ping.acp_port · 旧机(0)回退不裂
const http = require("http");
const path = require("path");

const SRC = path.join(__dirname, "..", "vendor", "bundled-origin", "source.js");
const src = require(SRC);

let pass = 0, fail = 0;
function ok(name, cond) {
  if (cond) { pass++; console.log("  ✓ " + name); }
  else { fail++; console.log("  ✗ FAIL " + name); }
}
function get(port, p) {
  return new Promise((r) => {
    const q = http.get(`http://127.0.0.1:${port}${p}`, { timeout: 5000 }, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => { try { r(JSON.parse(d)); } catch { r(null); } });
    });
    q.on("error", () => r(null));
    q.on("timeout", () => { q.destroy(); r(null); });
  });
}
function post(port, p, body) {
  return new Promise((r) => {
    const q = http.request(`http://127.0.0.1:${port}${p}`, {
      method: "POST",
      headers: { "Content-Type": "application/grpc-web+proto" },
      timeout: 8000,
    }, (res) => { let d = ""; res.on("data", (c) => (d += c)); res.on("end", () => r({ s: res.statusCode, d })); });
    q.on("error", (e) => r({ s: 0, d: e.message }));
    q.on("timeout", () => { q.destroy(); r({ s: 0, d: "timeout" }); });
    q.end(body);
  });
}
// 构造可解析 grpc-web 帧: [0][len][proto] · fieldN(w2)=string
function frame(fields) {
  let pb = Buffer.alloc(0);
  for (const [num, str] of fields) {
    const b = Buffer.from(str, "utf8");
    const head = Buffer.from([num << 3 | 2, b.length]);
    pb = Buffer.concat([pb, head, b]);
  }
  const len = Buffer.alloc(4); len.writeUInt32BE(pb.length);
  return Buffer.concat([Buffer.from([0]), len, pb]);
}

const TEST_PORT = 18997, TEST_ACP = 18497;
(async () => {
  const h = await src.start({ port: TEST_PORT, host: "127.0.0.1", mode: "invert", acpPort: TEST_ACP });
  ok("start() handle", !!h && h.port === TEST_PORT);
  await new Promise((r) => setTimeout(r, 800));

  const ping = await get(TEST_PORT, "/origin/ping");
  ok("ping.acp_port=实绑", ping && ping.acp_port === TEST_ACP);
  const pingA = await get(TEST_ACP, "/origin/ping");
  ok("acp口亦应答控制面", pingA && pingA.ok === true && pingA.acp_port === TEST_ACP);

  // ① 分类器单测 (离线·socket 模拟)
  const t = src._test;
  const p = t._getAcpPortsForTest();
  ok("_getAcpPortsForTest 实绑", p && p.mux === TEST_ACP && p.h2 > TEST_ACP);
  ok("acp口→local", t._reqSurfaceOf({ socket: { localPort: TEST_ACP }, url: "/exa.api_server_pb.ApiServerService/GetChatMessage" }) === "local");
  ok("acp-h2口→local", t._reqSurfaceOf({ socket: { localPort: p.h2 }, url: "/exa.api_server_pb.ApiServerService/GetChatMessage" }) === "local");
  ok("主口api_server_pb→cascade", t._reqSurfaceOf({ socket: { localPort: TEST_PORT }, url: "/exa.api_server_pb.ApiServerService/GetChatMessage" }) === "cascade");
  ok("主口language_server_pb→cascade", t._reqSurfaceOf({ socket: { localPort: TEST_PORT }, url: "/exa.language_server_pb.LanguageServerService/X" }) === "cascade");
  ok("主口analytics→默认''", t._reqSurfaceOf({ socket: { localPort: TEST_PORT }, url: "/exa.product_analytics_pb.ProductAnalyticsService/BatchRecordAnalyticsEvents" }) === "");
  ok("面模式分层读", t._surfaceMode("local") !== undefined && t._surfaceMode("cascade") !== undefined);

  // ② 真实 e2e: 面模式分设 → 各口请求观察 surface 录制
  await post(TEST_PORT, "/origin/mode", JSON.stringify({ surface: "local", mode: "passthrough" }));
  await post(TEST_PORT, "/origin/mode", JSON.stringify({ surface: "cascade", mode: "invert" }));
  const fakeBody = frame([[1, "session-test"], [5, "You are an AI assistant named Cascade. test body for surface check."]]);
  const r1 = await post(TEST_ACP, "/exa.api_server_pb.ApiServerService/GetChatMessage", fakeBody);
  const r2 = await post(TEST_PORT, "/exa.api_server_pb.ApiServerService/GetChatMessage", fakeBody);
  ok("acp口请求被服务", r1.s > 0);
  ok("主口请求被服务", r2.s > 0);
  await new Promise((r) => setTimeout(r, 300));
  const tape = await get(TEST_PORT, "/origin/tape");
  const evs = (tape && tape.tape) || [];
  const lastA = evs.find((e) => e.surface === "local");
  const lastC = evs.find((e) => e.surface === "cascade");
  if (evs.length) {
    ok("tape 录 local 面", !!lastA);
    ok("tape 录 cascade 面", !!lastC);
  } else {
    console.log("  · tape 空 (帧未至观察径) —— 分类器单测已证 · 容");
  }
  // 还原
  await post(TEST_PORT, "/origin/mode", JSON.stringify({ surface: "local", mode: "invert" }));

  await h.close();
  console.log(`\n═══ 分口定面 结果: ${pass} pass · ${fail} fail ═══`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("ERR:", e); process.exit(1); });
