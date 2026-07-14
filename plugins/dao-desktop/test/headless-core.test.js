// 通用底层 headless 契约: 证明 Cascade RPC 核(host-state + ls-bridge + host-discover)
// 在**无 vscode**(非 IDE)环境可载入且宿主态可经落盘文件跨进程解析 —— 彻底脱离 IDE 依赖。
// CI(ubuntu, 无 vscode 模块)运行本测即为「零 IDE 依赖」的活证据。
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const CASCADE = path.join(__dirname, "..", "dao-cascade");

// 隔离落盘路径, 不碰真机 ~/.dao/windsurf-host.json
const HOST_FILE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "dao-hs-")), "windsurf-host.json");
process.env.DAO_WINDSURF_HOST_FILE = HOST_FILE;

test("无 vscode 环境下核心模块可载入(不拖入 IDE 依赖)", () => {
  assert.throws(() => require("vscode"), "前提: 本环境确无 vscode 模块");
  const hostState = require(path.join(CASCADE, "host-state.js"));
  const bridge = require(path.join(CASCADE, "ls-bridge.js"));
  const disc = require(path.join(CASCADE, "host-discover.js"));
  for (const fn of ["hostState", "hostFire", "loadPersisted", "resolveHost", "subscribe", "hostFilePath"]) {
    assert.strictEqual(typeof hostState[fn], "function", "host-state 缺 " + fn);
  }
  for (const fn of ["call", "callStream", "ready", "driveStream", "listModels", "apiKey"]) {
    assert.strictEqual(typeof bridge[fn], "function", "ls-bridge 缺 " + fn);
  }
  for (const fn of ["discover", "startDiscovery", "lsPids"]) {
    assert.strictEqual(typeof disc[fn], "function", "host-discover 缺 " + fn);
  }
});

test("未就绪时 ready()/resolveHost() 返回 null(不误判)", () => {
  const hostState = require(path.join(CASCADE, "host-state.js"));
  const bridge = require(path.join(CASCADE, "ls-bridge.js"));
  // 清空进程内单例与落盘文件
  delete globalThis.__daoWindsurfHost;
  try { fs.unlinkSync(HOST_FILE); } catch (_) {}
  assert.strictEqual(hostState.resolveHost(), null);
  assert.strictEqual(bridge.ready(), null);
});

test("落盘 host 文件后 headless 核跨进程解析出端口/CSRF", () => {
  const hostState = require(path.join(CASCADE, "host-state.js"));
  const bridge = require(path.join(CASCADE, "ls-bridge.js"));
  delete globalThis.__daoWindsurfHost; // 模拟全新进程(仅有落盘文件, 无进程内共生单例)
  fs.mkdirSync(path.dirname(HOST_FILE), { recursive: true });
  fs.writeFileSync(HOST_FILE, JSON.stringify({ lsPort: 54321, csrfToken: "csrf-xyz", updatedAt: new Date().toISOString() }));
  const h = bridge.ready();
  assert.ok(h && h.lsPort === 54321 && h.csrfToken === "csrf-xyz", "应从落盘文件解析出宿主态");
  assert.strictEqual(hostState.resolveHost().lsPort, 54321);
});

test("进程内单例优先于落盘文件", () => {
  const hostState = require(path.join(CASCADE, "host-state.js"));
  delete globalThis.__daoWindsurfHost;
  const s = hostState.hostState();
  s.lsPort = 9999; s.csrfToken = "live";
  fs.writeFileSync(HOST_FILE, JSON.stringify({ lsPort: 54321, csrfToken: "stale" }));
  assert.strictEqual(hostState.resolveHost().lsPort, 9999, "共生单例应压过落盘旧值");
});

test("归一发布 publishFused: 融合态并入宿主态并落盘(dao-one 面板可消费)", () => {
  const hostState = require(path.join(CASCADE, "host-state.js"));
  delete globalThis.__daoWindsurfHost;
  const s = hostState.hostState();
  s.lsPort = 1234; s.csrfToken = "c";
  hostState.publishFused("account", { email: "a@b.c", plan: "Free" });
  hostState.publishFused("mcp", { servers: [{ name: "github", status: "RUNNING", toolCount: 3 }] });
  const j = JSON.parse(fs.readFileSync(HOST_FILE, "utf8"));
  assert.strictEqual(j.fused.account.email, "a@b.c");
  assert.strictEqual(j.fused.mcp.servers[0].name, "github");
  assert.ok(j.fused.account.updatedAt, "发布应带时间戳");
  // 跨进程回补
  delete globalThis.__daoWindsurfHost;
  const h = hostState.loadPersisted();
  assert.strictEqual((h.fused.account || {}).plan, "Free");
});

test("Cascade 对话备份: 增量导出转录 + _index.json 水位(未变化不重写)", async () => {
  const backup = require(path.join(CASCADE, "backup.js"));
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dao-bk-"));
  const summaries = {
    cid1: { summary: "修复登录", lastModifiedTime: "2026-07-12T00:00:00Z" },
    cid2: { summary: "重构 面板/UI", lastModifiedTime: "2026-07-12T01:00:00Z", isArchived: true },
  };
  let transcriptCalls = 0;
  const fakeLs = {
    ready: () => ({ lsPort: 1, csrfToken: "c" }),
    apiKey: () => "k",
    call: async (m, req) => {
      if (m === "GetAllCascadeTrajectories") return { trajectorySummaries: summaries };
      if (m === "GetCascadeTranscriptForTrajectoryId") { transcriptCalls++; return { transcript: "MESSAGE 1 - User\nhi " + req.cascadeId }; }
      throw new Error("unexpected " + m);
    },
  };
  const r1 = await backup.backupAll(fakeLs, { root, email: "a@b.c" });
  assert.ok(r1.ok && r1.saved === 2 && r1.total === 2, "首轮应全量导出");
  // dao-one 备份板块同构树: <root>/Cascade·<账号>/对话/<NNN_标题_id8>/{对话.md,_meta.json}
  const accDir = path.join(root, backup.accountDirName("a@b.c"));
  assert.strictEqual(r1.accDir, accDir);
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(accDir, ".account.json"), "utf8")).email, "a@b.c");
  const idx = JSON.parse(fs.readFileSync(path.join(accDir, "_index.json"), "utf8"));
  assert.strictEqual(Object.keys(idx.entries).length, 2);
  const convDir1 = path.join(accDir, "对话", idx.entries.cid1.folder);
  assert.ok(/^\d{3}_/.test(idx.entries.cid1.folder), "目录名应带 NNN 编号");
  assert.ok(fs.existsSync(path.join(convDir1, "对话.md")), "转录 对话.md 应落盘");
  assert.ok(fs.readFileSync(path.join(convDir1, "对话.md"), "utf8").includes("hi cid1"));
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(convDir1, "_meta.json"), "utf8")).source, "cascade");
  assert.strictEqual(idx.entries.cid2.isArchived, true, "归档态入索引");
  // 二轮: 水位未变 → 全跳过; cid1 变更 → 只重写 cid1
  const r2 = await backup.backupAll(fakeLs, { root, email: "a@b.c" });
  assert.ok(r2.saved === 0 && r2.skipped === 2, "水位未变不重写");
  summaries.cid1.lastModifiedTime = "2026-07-12T02:00:00Z";
  const r3 = await backup.backupAll(fakeLs, { root, email: "a@b.c" });
  assert.ok(r3.saved === 1 && r3.skipped === 1, "仅变更轨迹增量导出");
  assert.strictEqual(transcriptCalls, 3);
  // 未就绪不误写
  const r4 = await backup.backupAll({ ready: () => null, apiKey: () => "" }, { root });
  assert.strictEqual(r4.ok, false);
});

test("归一面板数据层 listBackups: Cascade 与 Devin Cloud 账号同列双源统一", async () => {
  const backup = require(path.join(CASCADE, "backup.js"));
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dao-uni-"));
  // ① Cascade 侧: 走真实 backupAll 落盘
  const summaries = { cidA: { summary: "归一面板联调", lastModifiedTime: "2026-07-12T03:00:00Z" } };
  const fakeLs = {
    ready: () => ({ lsPort: 1, csrfToken: "c" }),
    apiKey: () => "k",
    call: async (m, req) => {
      if (m === "GetAllCascadeTrajectories") return { trajectorySummaries: summaries };
      if (m === "GetCascadeTranscriptForTrajectoryId") return { transcript: "hello " + req.cascadeId };
      throw new Error("unexpected " + m);
    },
  };
  await backup.backupAll(fakeLs, { root, email: "cas@x.y" });
  // ② Cloud 侧: 模拟 rt-flow 落盘的同构账号树
  const cloudAcc = path.join(root, "cloud-user@x.y");
  fs.mkdirSync(path.join(cloudAcc, "对话", "001_云端会话_deadbeef"), { recursive: true });
  fs.writeFileSync(path.join(cloudAcc, ".account.json"), JSON.stringify({ email: "cloud-user@x.y", source: "rt-flow" }));
  fs.writeFileSync(path.join(cloudAcc, "对话", "001_云端会话_deadbeef", "对话.md"), "# 云端会话\n\ncloud body");
  fs.writeFileSync(path.join(cloudAcc, "对话", "001_云端会话_deadbeef", "_meta.json"),
    JSON.stringify({ title: "云端会话", convNo: 1, source: "cloud", lastModifiedTime: "2026-07-11T00:00:00Z" }));
  // ③ 双源同列: Cascade 在前, Cloud 在后, 来源标签正确
  const l = backup.listBackups(root);
  assert.strictEqual(l.accounts.length, 2, "两账号同列");
  assert.strictEqual(l.accounts[0].source, "cascade");
  assert.strictEqual(l.accounts[0].email, "cas@x.y");
  assert.strictEqual(l.accounts[1].source, "cloud");
  assert.strictEqual(l.accounts[1].email, "cloud-user@x.y");
  assert.strictEqual(l.accounts[0].convCount, 1);
  const conv = l.accounts[0].conversations[0];
  assert.strictEqual(conv.title, "归一面板联调");
  assert.ok(conv.hasMd, "转录存在");
  // ④ readConversation: 双源皆可读转录正文
  const c1 = backup.readConversation(root, l.accounts[0].dir, conv.folder);
  assert.ok(c1.md.includes("hello cidA"));
  assert.strictEqual(c1.meta.source, "cascade");
  const c2 = backup.readConversation(root, "cloud-user@x.y", "001_云端会话_deadbeef");
  assert.ok(c2.md.includes("cloud body"));
  assert.strictEqual(c2.meta.source, "cloud");
  // ⑤ 空根不炸
  assert.deepStrictEqual(backup.listBackups(path.join(root, "nope")).accounts, []);
  // ⑥ readConversation 路径穿越防护
  assert.throws(() => backup.readConversation(root, "..", ".."), /非法会话路径/);
  assert.throws(() => backup.readConversation(root, "../..", "x"), /非法会话路径/);
});

test("融合态跨重启保鲜: 新进程首次 hostFire 不抹掉磁盘上已发布的 fused 分片", () => {
  const hostState = require(path.join(CASCADE, "host-state.js"));
  // 上个进程发布过 account/mcp
  delete globalThis.__daoWindsurfHost;
  const s0 = hostState.hostState();
  s0.lsPort = 1; s0.csrfToken = "c";
  hostState.publishFused("account", { email: "keep@x.y", plan: "Pro" });
  hostState.publishFused("mcp", { servers: [{ name: "gh" }] });
  // 模拟重启: 全新单例(fused 为空), shim 灌入端口后首次 hostFire
  delete globalThis.__daoWindsurfHost;
  const s1 = hostState.hostState();
  s1.lsPort = 2; s1.csrfToken = "c2";
  hostState.hostFire();
  const j = JSON.parse(fs.readFileSync(HOST_FILE, "utf8"));
  assert.strictEqual(j.fused.account.email, "keep@x.y", "重启后 fused.account 应保留");
  assert.strictEqual(j.fused.mcp.servers[0].name, "gh", "重启后 fused.mcp 应保留");
  // 新发布覆盖同键
  hostState.publishFused("account", { email: "new@x.y" });
  const j2 = JSON.parse(fs.readFileSync(HOST_FILE, "utf8"));
  assert.strictEqual(j2.fused.account.email, "new@x.y");
  assert.strictEqual(j2.fused.mcp.servers[0].name, "gh");
});

test("插件自持账号池: 收录/视图脱敏/切换写 credentials.toml/无 key 绝不回退", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dao-pool-"));
  process.env.DAO_CASCADE_POOL_FILE = path.join(dir, "pool.json");
  process.env.DAO_DEVIN_CRED_FILE = path.join(dir, "credentials.toml");
  const pool = require(path.join(CASCADE, "account-pool.js"));
  // 收录两号
  pool.captureCurrent("key-AAAA1111", { email: "a@x.y", name: "A", plan: "Free" });
  pool.captureCurrent("key-BBBB2222", { email: "b@x.y", name: "B", plan: "Pro" });
  // 视图脱敏: 不含完整 key, 只有尾4位
  const v = pool.listView("key-AAAA1111");
  assert.strictEqual(v.length, 2);
  assert.ok(!JSON.stringify(v).includes("key-AAAA1111"), "完整 key 不得出后端");
  assert.strictEqual(v.find((x) => x.email === "a@x.y").keyTail, "1111");
  assert.strictEqual(v.find((x) => x.email === "a@x.y").active, true);
  assert.strictEqual(v.find((x) => x.email === "b@x.y").active, false);
  // 切换: 写入 credentials.toml 且只用目标号 key
  pool.switchTo("b@x.y");
  const cred = fs.readFileSync(process.env.DAO_DEVIN_CRED_FILE, "utf8");
  assert.ok(cred.includes('windsurf_api_key = "key-BBBB2222"'));
  assert.strictEqual(pool.currentCredKey(), "key-BBBB2222");
  // 同邮箱覆盖更新(key 轮换)
  pool.captureCurrent("key-BBBBnew9", { email: "b@x.y", name: "B", plan: "Pro" });
  assert.strictEqual(pool.loadPool().filter((a) => a.email === "b@x.y").length, 1);
  // 无 key 号绝不回退: 未收录邮箱切换必抛
  assert.throws(() => pool.switchTo("ghost@x.y"), /apiKey/);
  // 移除
  assert.strictEqual(pool.remove("a@x.y").removed, true);
  assert.strictEqual(pool.loadPool().length, 1);
  delete process.env.DAO_CASCADE_POOL_FILE;
  delete process.env.DAO_DEVIN_CRED_FILE;
});

test("Devin Cloud 凭据链: credentials.toml 真源 → 缺失回退 ls-bridge.apiKey()", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dao-wss-"));
  process.env.DAO_DEVIN_CRED_FILE = path.join(dir, "credentials.toml");
  const wssPath = path.join(CASCADE, "acp-wss.js");
  const lsPath = path.join(CASCADE, "ls-bridge.js");
  const savedLs = require.cache[require.resolve(lsPath)];
  delete require.cache[require.resolve(wssPath)];
  require.cache[require.resolve(lsPath)] = {
    id: lsPath, filename: lsPath, loaded: true,
    exports: { apiKey: () => "key-FALLBACK99" },
  };
  try {
    const { readCredentials } = require(wssPath);
    // 无 credentials.toml → 回退 ls-bridge
    let c = readCredentials();
    assert.strictEqual(c.apiKey, "key-FALLBACK99");
    assert.strictEqual(c.apiUrl, "https://api.devin.ai");
    // credentials.toml 落盘后为真源
    fs.writeFileSync(process.env.DAO_DEVIN_CRED_FILE,
      'windsurf_api_key = "key-TOML0001"\ndevin_api_url = "https://api.example.dev"\n');
    c = readCredentials();
    assert.strictEqual(c.apiKey, "key-TOML0001");
    assert.strictEqual(c.apiUrl, "https://api.example.dev");
  } finally {
    if (savedLs) require.cache[require.resolve(lsPath)] = savedLs;
    else delete require.cache[require.resolve(lsPath)];
    delete require.cache[require.resolve(wssPath)];
    delete process.env.DAO_DEVIN_CRED_FILE;
  }
});

test("插件自持本地 API: 健康免鉴权/无 token 401/带 token 读插件真源(脱敏)", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dao-api-"));
  process.env.DAO_LOCAL_API_FILE = path.join(dir, "local-api.json");
  const api = require(path.join(CASCADE, "local-api.js"));
  const { port, token } = await api.start(0);
  assert.ok(port > 0 && token.length >= 32);
  const get = (p, hdrs) => new Promise((resolve, reject) => {
    require("http").get({ host: "127.0.0.1", port, path: p, headers: hdrs || {} }, (r) => {
      let b = ""; r.on("data", (c) => { b += c; });
      r.on("end", () => resolve({ code: r.statusCode, body: JSON.parse(b) }));
    }).on("error", reject);
  });
  const h = await get("/api/health");
  assert.strictEqual(h.code, 200); assert.strictEqual(h.body.ok, true);
  const noAuth = await get("/api/overview");
  assert.strictEqual(noAuth.code, 401);
  const ov = await get("/api/overview", { Authorization: "Bearer " + token });
  assert.strictEqual(ov.code, 200);
  assert.ok("account" in ov.body && "backups" in ov.body && "mcp" in ov.body);
  assert.ok(!JSON.stringify(ov.body).includes(token), "响应绝不含 token");
  assert.ok(!("apiKey" in ov.body.account), "账号视图脱敏无 apiKey");
  const nf = await get("/api/nope", { Authorization: "Bearer " + token });
  assert.strictEqual(nf.code, 404);
  // 状态文件 600
  assert.strictEqual((fs.statSync(process.env.DAO_LOCAL_API_FILE).mode & 0o777), 0o600);
  await api.stop();
  assert.strictEqual(api.running(), false);
  delete process.env.DAO_LOCAL_API_FILE;
});

test("插件自持 GitHub 舰队: 池文件 600/视图脱敏/首号 admin/角色互转/移出", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dao-gh-"));
  process.env.DAO_GITHUB_FLEET_FILE = path.join(dir, "fleet.json");
  const gh = require(path.join(CASCADE, "github-fleet.js"));
  // 直接种池(不打网): 首号 admin、次号 member 语义由 addAccount 保证, 这里验证视图/角色/移除
  fs.writeFileSync(process.env.DAO_GITHUB_FLEET_FILE, JSON.stringify([
    { login: "alpha", pat: "ghp_secretAAAA1111", role: "admin", addedAt: "2026-07-12T00:00:00Z" },
    { login: "beta", pat: "ghp_secretBBBB2222", role: "member", addedAt: "2026-07-12T00:00:00Z", verify: "pending" },
  ]), { mode: 0o600 });
  const v = gh.listView();
  assert.strictEqual(v.length, 2);
  assert.ok(!JSON.stringify(v).includes("ghp_secret"), "完整 PAT 不得出视图");
  assert.strictEqual(v[0].patTail, "1111");
  assert.strictEqual(v[0].role, "admin");
  assert.strictEqual(v[1].verify, "pending");
  // 角色互转
  assert.strictEqual(gh.setRole("beta", "admin").role, "admin");
  assert.throws(() => gh.setRole("ghost", "admin"), /舰队无此号/);
  // 移出
  assert.strictEqual(gh.remove("alpha").removed, true);
  assert.strictEqual(gh.remove("alpha").removed, false);
  assert.strictEqual(gh.loadFleet().length, 1);
  // 落盘权限
  gh.setRole("beta", "member");
  assert.strictEqual((fs.statSync(process.env.DAO_GITHUB_FLEET_FILE).mode & 0o777), 0o600);
  delete process.env.DAO_GITHUB_FLEET_FILE;
});

test("插件自持 Proxy Pro: 渠道文件 600/视图脱敏 apiKey/路由增删/删渠道连带清路由", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dao-px-"));
  process.env.DAO_PROXY_CHANNELS_FILE = path.join(dir, "px.json");
  const px = require(path.join(CASCADE, "proxy-pro.js"));
  // 直接种池(不打网): 渠道带 Key + 已识别模型
  px.save({ channels: [
    { name: "DeepSeek", type: "openai", baseURL: "https://api.deepseek.com/v1", apiKey: "sk-secretAAAA1111", models: ["deepseek-chat", "deepseek-reasoner"], verify: "ok" },
  ], routes: {} });
  const v = px.listView();
  assert.strictEqual(v.channels.length, 1);
  assert.ok(!JSON.stringify(v).includes("sk-secretAAAA"), "完整 apiKey 不得出视图");
  assert.strictEqual(v.channels[0].keyTail, "1111");
  assert.strictEqual(v.channels[0].modelCount, 2);
  // 路由增删
  px.setRoute("windsurf-swe-1", "DeepSeek", "deepseek-chat");
  assert.strictEqual(px.listView().routes.length, 1);
  assert.throws(() => px.setRoute("x", "NoSuch", "m"), /无此渠道/);
  // 删渠道连带清指向它的路由
  assert.strictEqual(px.removeChannel("DeepSeek").removed, true);
  assert.strictEqual(px.listView().routes.length, 0);
  // 落盘 600
  assert.strictEqual((fs.statSync(process.env.DAO_PROXY_CHANNELS_FILE).mode & 0o777), 0o600);
  assert.ok(Array.isArray(px.PRESETS) && px.PRESETS.length > 5, "内置预设渠道");
  delete process.env.DAO_PROXY_CHANNELS_FILE;
});

test("插件自持浏览器搜索: DDG 结果解析 + 历史落盘 600(仅查询串)", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dao-ws-"));
  process.env.DAO_WEB_SEARCH_FILE = path.join(dir, "ws.json");
  const ws = require(path.join(CASCADE, "web-search.js"));
  const html = '<a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fa&rut=x">Ex&amp;ample Title</a>' +
    '<a class="result__snippet" href="#">A <b>snippet</b> here.</a>';
  const r = ws.parseDuckDuckGo(html);
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].url, "https://example.com/a");
  assert.strictEqual(r[0].title, "Ex&ample Title");
  assert.strictEqual(r[0].snippet, "A snippet here.");
  assert.ok(ws.engineList().length >= 2);
  // 历史(仅查询串)落盘 600
  const fsmod = require("fs");
  fsmod.mkdirSync(path.dirname(process.env.DAO_WEB_SEARCH_FILE), { recursive: true });
  fsmod.writeFileSync(process.env.DAO_WEB_SEARCH_FILE, JSON.stringify({ history: [{ query: "hello", engine: "duckduckgo", at: "2026-07-12T00:00:00Z", n: 3 }] }), { mode: 0o600 });
  assert.strictEqual(ws.historyView()[0].query, "hello");
  assert.strictEqual((fsmod.statSync(process.env.DAO_WEB_SEARCH_FILE).mode & 0o777), 0o600);
  ws.clearHistory();
  assert.strictEqual(ws.historyView().length, 0);
  delete process.env.DAO_WEB_SEARCH_FILE;
});

test("插件自持反向注入: 档案 600/secret 脱敏/计划=池×档 交叉", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dao-inj-"));
  process.env.DAO_INJECT_PROFILE_FILE = path.join(dir, "inj.json");
  const inj = require(path.join(CASCADE, "inject.js"));
  inj.addItem("mcp", "github", { command: "npx", args: ["-y", "@modelcontextprotocol/server-github"] });
  inj.addItem("secret", "GH_PAT", { value: "ghp_secretBBBB2222" });
  inj.addItem("knowledge", "readme", { content: "hello world" });
  assert.throws(() => inj.addItem("nope", "x", {}), /未知注入类型/);
  const v = inj.listView();
  assert.strictEqual(v.length, 3);
  assert.ok(!JSON.stringify(v).includes("ghp_secretBBBB"), "secret 值不得出视图");
  const sec = v.find((x) => x.kind === "secret");
  assert.strictEqual(sec.hasValue, true); assert.strictEqual(sec.valueTail, "2222");
  assert.strictEqual(v.find((x) => x.kind === "mcp").transport, "stdio");
  // 计划: 2 号 × 3 档 = 6
  const plan = inj.plan([{ email: "a@x.y" }, { email: "b@x.y" }]);
  assert.strictEqual(plan.itemCount, 3);
  assert.strictEqual(plan.targetCount, 2);
  assert.strictEqual(plan.total, 6);
  // 移除
  assert.strictEqual(inj.removeItem("secret", "GH_PAT").removed, true);
  assert.strictEqual(inj.listView().length, 2);
  assert.strictEqual((fs.statSync(process.env.DAO_INJECT_PROFILE_FILE).mode & 0o777), 0o600);
  delete process.env.DAO_INJECT_PROFILE_FILE;
});

test("R65 桥接 /api/cascade: 本机会话·记忆水位可经本地 API 暴露(无内容/无凭据)", () => {
  const hostState = require(path.join(CASCADE, "host-state.js"));
  const api = require(path.join(CASCADE, "local-api.js"));
  hostState.publishFused("cascadeLocal", { total: 3, live: 2, archived: 1 });
  hostState.publishFused("memories", { total: 5 });
  const c = api.routes("/api/cascade");
  assert.strictEqual(c.sessions.total, 3);
  assert.strictEqual(c.sessions.live, 2);
  assert.strictEqual(c.sessions.archived, 1);
  assert.strictEqual(c.memories.total, 5);
  const o = api.routes("/api/overview");
  assert.strictEqual(o.cascade.sessions.total, 3);
  assert.ok(!JSON.stringify(c).match(/apiKey|token|pat/i), "水位视图不得含凭据字段");
});

test("R65 GitHub→注入档打通: 舰队 PAT 入 secret 档且全程脱敏", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dao-ghi-"));
  process.env.DAO_GITHUB_FLEET_FILE = path.join(dir, "fleet.json");
  process.env.DAO_INJECT_PROFILE_FILE = path.join(dir, "inj.json");
  const fleet = require(path.join(CASCADE, "github-fleet.js"));
  const inj = require(path.join(CASCADE, "inject.js"));
  // 直接写舰队文件(等价断网入队后的态), 不出网
  fs.writeFileSync(process.env.DAO_GITHUB_FLEET_FILE,
    JSON.stringify([{ login: "octo", pat: "ghp_bridgeTest9Z9Z", role: "admin", addedAt: new Date().toISOString() }]), { mode: 0o600 });
  // _ghInject 同构管道: loadFleet → inject.addItem(secret)
  const a = fleet.loadFleet().find((x) => x.login === "octo");
  const r = inj.addItem("secret", "github-pat-" + a.login, { value: a.pat });
  assert.strictEqual(r.kind, "secret");
  const v = inj.listView().find((x) => x.name === "github-pat-octo");
  assert.strictEqual(v.hasValue, true);
  assert.strictEqual(v.valueTail, "9Z9Z");
  assert.ok(!JSON.stringify(inj.listView()).includes("ghp_bridgeTest"), "PAT 不得出注入档视图");
  delete process.env.DAO_GITHUB_FLEET_FILE;
  delete process.env.DAO_INJECT_PROFILE_FILE;
});

test("Cascade 轨迹管理: 归档/取消归档/重命名/删除 走官方 RPC 并同步本地备份树", async () => {
  const backup = require(path.join(CASCADE, "backup.js"));
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dao-mg-"));
  const summaries = { cidM: { summary: "待管理会话", lastModifiedTime: "2026-07-12T00:00:00Z" } };
  const calls = [];
  const fakeLs = {
    ready: () => ({ lsPort: 1, csrfToken: "c" }),
    apiKey: () => "k",
    call: async (m, req) => {
      calls.push([m, req]);
      if (m === "GetAllCascadeTrajectories") return { trajectorySummaries: summaries };
      if (m === "GetCascadeTranscriptForTrajectoryId") return { transcript: "body" };
      return {};
    },
  };
  await backup.backupAll(fakeLs, { root, email: "m@x.y" });
  const accDir = backup.accountDirName("m@x.y");
  const idx0 = JSON.parse(fs.readFileSync(path.join(root, accDir, "_index.json"), "utf8"));
  const folder = idx0.entries.cidM.folder;
  const base = { root, accDir, folder, cascadeId: "cidM" };
  // 归档: RPC + 本地 meta/index 同步
  const r1 = await backup.manageTrajectory(fakeLs, Object.assign({ op: "archive" }, base));
  assert.ok(r1.ok);
  assert.deepStrictEqual(calls[calls.length - 1], ["ArchiveCascadeTrajectory", { cascadeId: "cidM", isArchived: true }]);
  const metaP = path.join(root, accDir, "对话", folder, "_meta.json");
  assert.strictEqual(JSON.parse(fs.readFileSync(metaP, "utf8")).isArchived, true);
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(root, accDir, "_index.json"), "utf8")).entries.cidM.isArchived, true);
  // 取消归档
  const r2 = await backup.manageTrajectory(fakeLs, Object.assign({ op: "unarchive" }, base));
  assert.ok(r2.ok);
  assert.strictEqual(JSON.parse(fs.readFileSync(metaP, "utf8")).isArchived, false);
  // 重命名: RPC + 本地标题跟随
  const r3 = await backup.manageTrajectory(fakeLs, Object.assign({ op: "rename", name: "新名字" }, base));
  assert.ok(r3.ok);
  assert.deepStrictEqual(calls[calls.length - 1], ["RenameCascadeTrajectory", { cascadeId: "cidM", name: "新名字" }]);
  assert.strictEqual(JSON.parse(fs.readFileSync(metaP, "utf8")).title, "新名字");
  assert.strictEqual((await backup.manageTrajectory(fakeLs, Object.assign({ op: "rename" }, base))).ok, false, "缺名必拒");
  // 路径穿越防护
  const bad = await backup.manageTrajectory(fakeLs, { root, accDir: "..", folder: "..", cascadeId: "cidM", op: "delete" });
  assert.strictEqual(bad.ok, false);
  assert.match(bad.error, /非法会话路径/);
  // 删除: RPC + 本地目录与索引项移除
  const r4 = await backup.manageTrajectory(fakeLs, Object.assign({ op: "delete" }, base));
  assert.ok(r4.ok);
  assert.deepStrictEqual(calls[calls.length - 1], ["DeleteCascadeTrajectory", { cascadeId: "cidM" }]);
  assert.ok(!fs.existsSync(path.join(root, accDir, "对话", folder)), "本地会话目录应移除");
  assert.ok(!JSON.parse(fs.readFileSync(path.join(root, accDir, "_index.json"), "utf8")).entries.cidM, "索引项应移除");
  // 缺 cascadeId / 未知操作
  assert.strictEqual((await backup.manageTrajectory(fakeLs, { op: "archive" })).ok, false);
  assert.strictEqual((await backup.manageTrajectory(fakeLs, Object.assign({ op: "nope" }, base))).ok, false);
  // LS 未就绪: 不打 RPC, 本地同步照常(离线管理备份树)
  const off = { ready: () => null, apiKey: () => "" };
  const r5 = await backup.manageTrajectory(off, Object.assign({ op: "archive" }, base));
  assert.ok(r5.ok, "离线仅本地同步亦可");
});

test("MCP 配置真源开关: server 级 disabled 位 + 工具级 disabledTools 直写 mcp_config.json", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dao-mcpc-"));
  process.env.DAO_MCP_CONFIG_FILE = path.join(dir, "mcp_config.json");
  const mc = require(path.join(CASCADE, "mcp-config.js"));
  fs.writeFileSync(process.env.DAO_MCP_CONFIG_FILE, JSON.stringify({
    mcpServers: { github: { command: "npx", args: ["-y", "@modelcontextprotocol/server-github"] } },
  }));
  // server 级: 翻转 → disabled:true, 再翻转 → false
  assert.deepStrictEqual(mc.toggleServer("github"), { ok: true, name: "github", disabled: true });
  assert.strictEqual(mc.readConfig().mcpServers.github.disabled, true);
  assert.strictEqual(mc.toggleServer("github").disabled, false);
  // force 指定
  assert.strictEqual(mc.toggleServer("github", true).disabled, true);
  // 无此 server 必拒
  assert.strictEqual(mc.toggleServer("ghost").ok, false);
  assert.strictEqual(mc.toggleServer("").ok, false);
  // 工具级: disabledTools 增删
  assert.strictEqual(mc.toggleTool("github", "create_issue").off, true);
  assert.deepStrictEqual(mc.readConfig().mcpServers.github.disabledTools, ["create_issue"]);
  assert.strictEqual(mc.toggleTool("github", "create_issue").off, false);
  assert.deepStrictEqual(mc.readConfig().mcpServers.github.disabledTools, []);
  assert.strictEqual(mc.toggleTool("ghost", "x").ok, false);
  delete process.env.DAO_MCP_CONFIG_FILE;
});


test("Devin(ACP) 会话备份: session/list+load 历史回放拼转录 + 增量水位 + 会话本地管理", async () => {
  const backup = require(path.join(CASCADE, "backup.js"));
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dao-acpbk-"));
  // 假 ACP 客户端: hookUpdates 截流 + loadSession 重放帧(与 acp-client 同约定)。
  let hook = null;
  const frames = {
    s1: [
      { sessionId: "s1", update: { sessionUpdate: "user_message_chunk", content: { text: "列出文件" } } },
      { sessionId: "s1", update: { sessionUpdate: "agent_thought_chunk", content: { text: "(思考不入转录)" } } },
      { sessionId: "s1", update: { sessionUpdate: "tool_call", title: "ls -la", toolCallId: "t1" } },
      { sessionId: "s1", update: { sessionUpdate: "agent_message_chunk", content: { text: "共 3 个文件" } } },
      { sessionId: "other", update: { sessionUpdate: "agent_message_chunk", content: { text: "串台帧须被过滤" } } },
    ],
  };
  const acp = {
    listSessions: async () => ({ sessions: [{ sessionId: "s1", title: "文件巡览", updatedAt: "2026-07-12T01:00:00Z" }] }),
    hookUpdates: (fn) => { hook = fn; },
    loadSession: async (sid) => { for (const f of frames[sid] || []) hook && hook(f); return {}; },
  };
  const r1 = await backup.backupAcp(acp, { root, email: "u@x.y" });
  assert.strictEqual(r1.ok, true); assert.strictEqual(r1.saved, 1); assert.strictEqual(r1.total, 1);
  const accDir = path.join(root, "Devin·u@x.y");
  const convs = backup.listConversations(accDir);
  assert.strictEqual(convs.length, 1);
  assert.strictEqual(convs[0].source, "devin-acp");
  const md = fs.readFileSync(path.join(accDir, "对话", convs[0].folder, "对话.md"), "utf8");
  assert.ok(md.includes("## 🧑 用户"), "用户回合入转录");
  assert.ok(md.includes("列出文件") && md.includes("共 3 个文件") && md.includes("🔧 ls -la"));
  assert.ok(!md.includes("思考不入转录") && !md.includes("串台帧"), "思考帧与他会话帧不入转录");
  // 水位未变 → 跳过
  const r2 = await backup.backupAcp(acp, { root, email: "u@x.y" });
  assert.strictEqual(r2.saved, 0); assert.strictEqual(r2.skipped, 1);
  // 三源统一: listBackups 中 Devin(ACP) 账号并出, source=devin
  const all = backup.listBackups(root);
  assert.strictEqual(all.accounts.length, 1);
  assert.strictEqual(all.accounts[0].isCascade, false);
  assert.strictEqual(all.accounts[0].source, "devin");
  // ACP 会话管理 = 本地树同步, 绝不触 LS(传入会爆炸的假 ls 验证不被调用)
  const bomb = { ready: () => true, apiKey: () => "k", call: async () => { throw new Error("不应调用 LS"); } };
  const rr = await backup.manageTrajectory(bomb, { root, accDir: "Devin·u@x.y", folder: convs[0].folder, cascadeId: "s1", op: "rename", name: "新名", source: "devin-acp" });
  assert.strictEqual(rr.ok, true);
  assert.strictEqual(backup.listConversations(accDir)[0].title, "新名");
  const rd = await backup.manageTrajectory(bomb, { root, accDir: "Devin·u@x.y", folder: convs[0].folder, cascadeId: "s1", op: "delete", source: "devin-acp" });
  assert.strictEqual(rd.ok, true);
  assert.strictEqual(backup.listConversations(accDir).length, 0);
});

test("ACP 客户端生命周期: stop 杀净子进程 + onExit 复位钩子 + spawn 失败不悬挂", async () => {
  const { AcpClient } = require(path.join(CASCADE, "acp-client.js"));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dao-acp-"));
  const fake = path.join(dir, "fake-devin");
  fs.writeFileSync(fake, "#!/bin/sh\nsleep 300\n"); fs.chmodSync(fake, 0o755);
  // 1) stop() 杀净子进程并触发 onExit(泄漏根因回归: 不留孤儿)
  let exited = 0;
  const c = new AcpClient({ bin: fake, onExit: () => { exited++; } });
  c.start();
  const pid = c._child.pid;
  c.stop();
  await new Promise((r) => setTimeout(r, 500));
  assert.strictEqual(exited, 1, "stop 后 onExit 必须触发");
  assert.throws(() => process.kill(pid, 0), "子进程须已被杀净");
  // 2) 二进制不存在: spawn error 不悬挂、onExit 兜底触发
  let exited2 = 0;
  const c2 = new AcpClient({ bin: path.join(dir, "no-such-bin"), onExit: () => { exited2++; } });
  c2.start();
  await new Promise((r) => setTimeout(r, 500));
  assert.strictEqual(exited2, 1, "spawn 失败也须触发 onExit");
  assert.strictEqual(c2._child, null);
});
