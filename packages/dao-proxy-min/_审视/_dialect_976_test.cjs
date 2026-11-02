// v9.9.76 方言镜像自检 —— Connect(gRPC) 方言不协即崩之根治验证
//   L1 mock 层: _replyGrpcOk/_replyDialectUnavailable/_replyAuthResilient 直测
//   L2 活口层: 真起服务·四族 content-type 过闸 SeatManagement(LOCAL_AUTH 无条件本地答)
const path = require("path");
const http = require("http");
const { spawn } = require("child_process");

const DIR = path.join(__dirname, "..", "vendor", "bundled-origin");
const mod = require(path.join(DIR, "source.js"));
const T = mod._test || mod; // _test 导出块
const fns = {
  _wireDialect: T._wireDialect,
  _wireFamily: T._wireFamily,
  _replyGrpcOk: T._replyGrpcOk,
  _replyDialectUnavailable: T._replyDialectUnavailable,
  _replyAuthResilient: T._replyAuthResilient,
  _isCredentialRpc: T._isCredentialRpc,
  _connectEndFrame: T._connectEndFrame,
  _setLastGoodUserStatusForTest: T._setLastGoodUserStatusForTest,
};

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log("  PASS " + name + (extra ? " · " + extra : "")); }
  else { fail++; console.log("  FAIL " + name + (extra ? " · " + extra : "")); }
}
function mkReq(ct, url) {
  return { headers: { "content-type": ct }, url: url || "/exa.seat_management_pb.SeatManagementService/GetUser", method: "POST", resume() {} };
}
function mkRes() {
  const r = { status: 0, headers: {}, body: [], trailers: {}, headersSent: false,
    writeHead(s, h) { this.status = s; Object.assign(this.headers, h || {}); this.headersSent = true; },
    write(b) { this.body.push(Buffer.isBuffer(b) ? b : Buffer.from(b)); },
    addTrailers(t) { Object.assign(this.trailers, t || {}); },
    end(b) { if (b) this.write(b); this.ended = true; },
    get bodyBuf() { return Buffer.concat(this.body); } };
  return r;
}

console.log("== L1 · _wireDialect 识言 ==");
ok("proto→connect-proto", fns._wireDialect(mkReq("application/proto")) === "connect-proto");
ok("json→connect-json", fns._wireDialect(mkReq("application/json")) === "connect-json");
ok("connect+proto→connect-stream", fns._wireDialect(mkReq("application/connect+proto")) === "connect-stream");
ok("grpc→grpc", fns._wireDialect(mkReq("application/grpc")) === "grpc");
ok("grpc-web→grpc", fns._wireDialect(mkReq("application/grpc-web+proto")) === "grpc");
ok("无ct→grpc守旧", fns._wireDialect(mkReq(undefined)) === "grpc");

console.log("== L1 · _replyGrpcOk 方言镜像 ==");
{
  const r = mkRes(); fns._replyGrpcOk(mkReq("application/proto"), r, 1, "GetUser");
  ok("proto→ct=application/proto", r.headers["content-type"] === "application/proto");
  ok("proto→空体(裸空proto)", r.bodyBuf.length === 0, r.bodyBuf.length + "B");
}
{
  const r = mkRes(); fns._replyGrpcOk(mkReq("application/json"), r, 2, "GetUser");
  ok("json→ct=application/json", r.headers["content-type"] === "application/json");
  ok("json→{}", r.bodyBuf.toString() === "{}");
}
{
  const r = mkRes(); fns._replyGrpcOk(mkReq("application/connect+proto"), r, 3, "GetUser");
  ok("connect-stream→ct=connect+proto", r.headers["content-type"] === "application/connect+proto");
  const b = r.bodyBuf;
  ok("connect-stream→终帧flag=0x02", b[0] === 0x02 && b.readUInt32BE(1) === b.length - 5, JSON.stringify(b.slice(5).toString()));
}
{
  const r = mkRes(); fns._replyGrpcOk(mkReq("application/grpc"), r, 4, "GetUser");
  ok("grpc→ct=application/grpc", r.headers["content-type"] === "application/grpc");
  ok("grpc→5字节空帧", r.bodyBuf.length === 5 && r.bodyBuf.equals(Buffer.from([0,0,0,0,0])));
  ok("grpc→trailers status=0", r.trailers["grpc-status"] === "0");
}
{
  const r = mkRes(); fns._replyGrpcOk(mkReq("application/grpc-web"), r, 41, "GetUser");
  ok("grpc-web→ct镜像grpc-web", r.headers["content-type"] === "application/grpc-web");
}
{
  const r = mkRes(); fns._replyGrpcOk(mkReq("application/connect+json"), r, 42, "GetUser");
  ok("connect+json→ct镜像connect+json", r.headers["content-type"] === "application/connect+json");
}

console.log("== L1 · _isCredentialRpc 铸令甄别 ==");
ok("Login→credential", fns._isCredentialRpc("/x.pb.Svc/Login") === true);
ok("GetUserJwt→credential", fns._isCredentialRpc("/x.pb.Svc/GetUserJwt") === true);
ok("RegisterUser→credential", fns._isCredentialRpc("/x.pb.Svc/RegisterUser") === true);
ok("GetAuthToken→credential", fns._isCredentialRpc("/x.pb.Svc/GetAuthToken") === true);
ok("GetUserStatus→非credential", fns._isCredentialRpc("/exa.seat_management_pb.SeatManagementService/GetUserStatus") === false);
ok("Heartbeat→非credential", fns._isCredentialRpc("/x.pb.Svc/Heartbeat") === false);

console.log("== L1 · _replyAuthResilient 铸令诚实 + 状态镜像 ==");
{
  const r = mkRes();
  fns._replyAuthResilient(mkReq("application/proto", "/x.pb.Svc/Login"), r, 5);
  ok("Login(proto)→503 json", r.status === 503 && r.headers["content-type"] === "application/json");
  const j = JSON.parse(r.bodyBuf.toString() || "{}");
  ok("Login(proto)→code=unavailable", j.code === "unavailable");
}
{
  const r = mkRes();
  fns._replyAuthResilient(mkReq("application/proto", "/x.pb.Svc/GetUserJwt"), r, 6);
  ok("GetUserJwt(proto)→503非伪OK", r.status === 503);
}
{
  const r = mkRes();
  fns._replyAuthResilient(mkReq("application/grpc", "/x.pb.Svc/Login"), r, 7);
  ok("Login(grpc)→grpc+status14", r.headers["content-type"] === "application/grpc" && r.trailers["grpc-status"] === "14");
}
{
  // 状态类 + 无 last-good → 方言镜像空 OK
  if (fns._setLastGoodUserStatusForTest) fns._setLastGoodUserStatusForTest(null);
  const r = mkRes();
  fns._replyAuthResilient(mkReq("application/proto", "/exa.seat_management_pb.SeatManagementService/GetUserStatus"), r, 8);
  ok("GetUserStatus(proto)→application/proto空体", r.headers["content-type"] === "application/proto" && r.bodyBuf.length === 0);
}
{
  // last-good 线族守卫: grpc录答不喂connect客
  if (fns._setLastGoodUserStatusForTest)
    fns._setLastGoodUserStatusForTest({ buf: Buffer.from("GRPCBYTES"), ct: "application/grpc", ce: "", at: Date.now(), rpc: "GetUserStatus" });
  const r = mkRes();
  fns._replyAuthResilient(mkReq("application/proto", "/x.pb.Svc/GetUserStatus"), r, 9);
  ok("异族录答不回放→proto空OK", r.headers["content-type"] === "application/proto" && r.bodyBuf.length === 0, "body=" + r.bodyBuf.toString());
}
{
  // 同族回放: connect录答喂connect客
  if (fns._setLastGoodUserStatusForTest)
    fns._setLastGoodUserStatusForTest({ buf: Buffer.from("REALPROTO"), ct: "application/proto", ce: "", at: Date.now(), rpc: "GetUserStatus" });
  const r = mkRes();
  fns._replyAuthResilient(mkReq("application/proto", "/x.pb.Svc/GetUserStatus"), r, 10);
  ok("同族回放真值", r.bodyBuf.toString() === "REALPROTO" && r.headers["content-type"] === "application/proto");
  if (fns._setLastGoodUserStatusForTest) fns._setLastGoodUserStatusForTest(null);
}

// ── L2 · 活口: 真起服务, 四族 content-type 过 LOCAL_AUTH ──
const TEST_PORT = 18976;
function live(port, p, ct) {
  return new Promise((resolve) => {
    const req = http.request({ hostname: "127.0.0.1", port, path: p, method: "POST",
      headers: { "content-type": ct, "content-length": 0 }, timeout: 4000, agent: false }, (res) => {
      let chunks = []; res.on("data", (c) => chunks.push(c)); res.on("end", () =>
        resolve({ status: res.statusCode, ct: res.headers["content-type"], trailers: res.trailers, body: Buffer.concat(chunks) }));
    });
    req.on("error", () => resolve(null)); req.on("timeout", () => { req.destroy(); resolve(null); });
    req.end();
  });
}
(async () => {
  console.log("== L2 · 活口过闸 (LOCAL_AUTH SeatManagement/GetUser) ==");
  const srv = spawn(process.execPath, [path.join(DIR, "source.js")], {
    env: { ...process.env, ORIGIN_PORT: String(TEST_PORT) }, stdio: ["ignore", "pipe", "pipe"] });
  srv.stdout.on("data", () => {}); srv.stderr.on("data", (d) => process.stderr.write(d));
  // 轮询就绪 · 网盘起服时延不定 (道法自然·不赌定数)
  const ping = () => new Promise((resolve) => {
    const q = http.get({ hostname: "127.0.0.1", port: TEST_PORT, path: "/origin/ping", timeout: 2000, agent: false }, (res) => { res.resume(); resolve(res.statusCode === 200); });
    q.on("error", () => resolve(false)); q.on("timeout", () => { q.destroy(); resolve(false); });
  });
  let _ready = false;
  for (let i = 0; i < 40 && !_ready; i++) {
    await new Promise((r) => setTimeout(r, 250));
    _ready = await ping();
  }
  console.log("  (server ready=" + _ready + ")");
  const P = "/exa.seat_management_pb.SeatManagementService/GetUser";
  let r = await live(TEST_PORT, P, "application/proto");
  ok("活口 proto→application/proto 空体", r && r.ct === "application/proto" && r.body.length === 0, r && r.ct);
  r = await live(TEST_PORT, P, "application/json");
  ok("活口 json→application/json {}", r && r.ct === "application/json" && r.body.toString() === "{}", r && r.ct);
  r = await live(TEST_PORT, P, "application/grpc");
  ok("活口 grpc→application/grpc 5B帧", r && r.ct === "application/grpc" && r.body.length === 5, r && r.ct);
  r = await live(TEST_PORT, P, "application/connect+proto");
  ok("活口 connect+proto→终帧", r && r.ct === "application/connect+proto" && r.body[0] === 0x02, r && r.ct);
  // Heartbeat (API_SERVER_SERVICES 内 LOCAL_AUTH_METHODS)
  r = await live(TEST_PORT, "/exa.api_server_pb.ApiServerService/Heartbeat", "application/proto");
  ok("活口 Heartbeat(proto)→proto", r && r.ct === "application/proto", r && r.ct);
  try { srv.kill(); } catch {}
  console.log(`\n结果: ${pass} pass · ${fail} fail`);
  process.exit(fail ? 1 : 0);
})();
