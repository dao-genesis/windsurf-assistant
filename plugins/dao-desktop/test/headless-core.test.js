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

// 私密落盘断言: POSIX 上严格 0o600; Windows 无 POSIX 权限位(仅只读位, mode 恒为 0o666),
// 改断存在性 —— 不弱化 POSIX 约束, 也不在 Windows 上断言平台无法表达的语义。
function assertOwnerOnly(p) {
  if (process.platform === "win32") { assert.ok(fs.existsSync(p)); return; }
  assert.strictEqual((fs.statSync(p).mode & 0o777), 0o600);
}

// R143 · UI 1:1 护栏: composer 模式三元组与官方实机菜单一致(Code/Ask/Plan + 官方文案),
// 空态含 Try Devin Cloud, 模式菜单含 Ctrl+. 提示, 发送钮具备空闲灰态。
test("panel.js UI 与官方 composer 1:1 护栏", () => {
  const src = fs.readFileSync(path.join(CASCADE, "panel.js"), "utf8");
  assert.ok(src.includes('{ value: "cx:write", name: "Code", description: "Can write and edit code" }'));
  assert.ok(src.includes('{ value: "cx:readOnly", name: "Ask", description: "Reads but won\'t edit" }'));
  assert.ok(src.includes('{ value: "cx:plan", name: "Plan", description: "Plan changes before implementing" }'));
  assert.ok(src.includes('id="tryCloud"'));
  assert.ok(src.includes("to switch modes"));
  assert.ok(src.includes("button.send.idle"));
  assert.ok(src.includes('id="micBtn"'));
});

// REARCH · 视图① Cascade 1:1 护栏: 对话面板零管理入口 —— 官方 Recent sessions 头行
// (标题+View all)保留, 九个管理入口(xrow)与其列表容器全数迁出(归一面板承载);
// 视图名与官方一致为 "Cascade"。
test("panel.js 官方 Cascade 1:1: 零管理入口", () => {
  const src = fs.readFileSync(path.join(CASCADE, "panel.js"), "utf8");
  assert.ok(src.includes('<div class="rhead"><span>Recent sessions</span><span class="va" id="viewAll">View all</span></div>'));
  assert.ok(!src.includes("xrow"), "管理入口行 xrow 应已迁出对话面板");
  for (const id of ["agBtn", "cmBtn", "cusBtn", "mcpBtn", "memsBtn", "olBtn", "plBtn", "stBtn", "tlBtn"]) {
    assert.ok(!src.includes(id), "管理入口 " + id + " 应已迁出对话面板");
  }
  for (const id of ["memList", "stList", "tlList", "olList", "plList", "mcpList", "cusList", "agList", "cmList"]) {
    assert.ok(!src.includes(id), "管理列表容器 " + id + " 应已迁出对话面板");
  }
  assert.ok(!src.includes("openHomeList"));
  const pkg = JSON.parse(fs.readFileSync(path.join(CASCADE, "..", "package.json"), "utf8"));
  const v = pkg.contributes.views["dao-cascade"].find((x) => x.id === "dao.cascade");
  assert.strictEqual(v.name, "Cascade");
});

// REARCH · 视图② 归一面板 /shell 同构护栏: 左侧图标栏(.sb/.ni) + 七大板块键与
// dao-vsix /shell 1:1(顺序含 github 纵向), 协议含 loadTabData/tabData 同构层。
test("unified-panel.js /shell 图标栏与七大板块同构", () => {
  const src = fs.readFileSync(path.join(CASCADE, "unified-panel.js"), "utf8");
  assert.ok(src.includes('<nav class="sb" id="nav"></nav>'), "应为 /shell 同构图标栏");
  assert.ok(src.includes(".sb .ni.active"), "应有激活板块高亮");
  for (const k of ["overview", "switch", "bridge", "backups", "inject", "mcp", "github"]) {
    assert.ok(src.includes('["' + k + '","'), "缺板块 " + k);
  }
  assert.ok(src.includes("loadTabData"), "应有 loadTabData 同构协议");
  assert.ok(src.includes("tabData"), "应有 tabData 同构协议");
  assert.ok(src.includes('title="Refresh">⟳'), "图标栏应有刷新钮");
  assert.ok(!src.includes("renderProxy"), "Proxy Pro 应已拆出归一面板");
});

// REARCH · 视图③ Proxy Pro 独立面板护栏: dao.proxyPro 独立视图注册,
// 插件自持命名空间 ~/.dao/proxy-channels.json(proxy-pro.js), 与 dao-vsix
// 的 ~/.codeium/dao-byok 完全隔离(互不覆盖)。
test("proxy-pro 独立视图与命名空间隔离", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(CASCADE, "..", "package.json"), "utf8"));
  const v = pkg.contributes.views["dao-cascade"].find((x) => x.id === "dao.proxyPro");
  assert.ok(v && v.type === "webview", "dao.proxyPro 应为独立 webview 视图");
  const panel = fs.readFileSync(path.join(CASCADE, "proxy-pro-panel.js"), "utf8");
  assert.ok(panel.includes('registerWebviewViewProvider("dao.proxyPro"'));
  const px = fs.readFileSync(path.join(CASCADE, "proxy-pro.js"), "utf8");
  assert.ok(px.includes("proxy-channels.json"), "插件自持渠道文件");
  assert.ok(px.includes('".dao"'), "命名空间应在 ~/.dao 下");
  assert.ok(!px.includes("dao-byok"), "不得触碰 dao-vsix 的 ~/.codeium/dao-byok 命名空间");
  assert.ok(!panel.includes('".codeium"'), "独立面板不得写 dao-vsix 命名空间");
});

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

test("令牌轮换自愈: RPC 遇鉴权错 → refreshAuth 重发现 key → 单次重试成功(跨 IDE 送信缺口修复)", async () => {
  const http = require("http");
  const lsPath = path.join(CASCADE, "ls-bridge.js");
  const discPath = path.join(CASCADE, "host-discover.js");
  const savedDisc = require.cache[require.resolve(discPath)];
  delete require.cache[require.resolve(lsPath)];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dao-heal-"));
  process.env.DAO_DEVIN_CRED_FILE = path.join(dir, "credentials.toml");
  fs.writeFileSync(process.env.DAO_DEVIN_CRED_FILE, 'windsurf_api_key = "stale-key"\n');

  // 首发返鉴权错(令牌轮换), refreshAuth 后返成功。
  let healed = false, hits = 0, discovered = 0;
  const srv = http.createServer((req, res) => {
    hits++;
    res.setHeader("Content-Type", "application/json");
    if (!healed) { res.statusCode = 401; res.end(JSON.stringify({ message: "failed to get primary API key: Invalid token" })); }
    else { res.statusCode = 200; res.end(JSON.stringify({ ok: true })); }
  });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const port = srv.address().port;

  // 宿主态单例指向测试服; mock host-discover.discover 模拟重发现最新 key。
  const g = globalThis;
  const savedHost = g.__daoWindsurfHost;
  g.__daoWindsurfHost = { lsPort: port, csrfToken: "csrf-x", auth: null, profileUrl: "", fused: {}, listeners: new Set(), _fusedSeeded: true };
  require.cache[require.resolve(discPath)] = {
    id: discPath, filename: discPath, loaded: true,
    exports: { discover: async () => { discovered++; healed = true; return { lsPort: port, csrfToken: "csrf-x" }; } },
  };
  try {
    const bridge = require(lsPath);
    assert.ok(bridge.isAuthError("failed to get primary API key: Invalid token"));
    assert.ok(bridge.isAuthError("SendUserCascadeMessage: Invalid token"));
    assert.ok(bridge.isAuthError("invalid api key (trace ID: 624b96aed7f15dd67833f7aa7d490305)"));
    assert.ok(!bridge.isAuthError("SendUserCascadeMessage: 超时"));
    assert.ok(bridge.isStaleEndpointError("connect ECONNREFUSED 127.0.0.1:43959"));
    assert.ok(!bridge.isStaleEndpointError("SendUserCascadeMessage: 超时"));
    const out = await bridge.call("SendUserCascadeMessage", {});
    assert.deepStrictEqual(out, { ok: true }, "自愈重试后应返成功体");
    assert.strictEqual(discovered, 1, "应恰好触发一次重发现");
    assert.strictEqual(hits, 2, "首发失败 + 重试成功 = 两次命中");
  } finally {
    srv.close();
    if (savedHost) g.__daoWindsurfHost = savedHost; else delete g.__daoWindsurfHost;
    if (savedDisc) require.cache[require.resolve(discPath)] = savedDisc; else delete require.cache[require.resolve(discPath)];
    delete require.cache[require.resolve(lsPath)];
    delete process.env.DAO_DEVIN_CRED_FILE;
  }
});

test("流式自愈: callStream 首发鉴权错(trailer)→重发现→单次重试收帧; driveStream 连拒→重连", async () => {
  const http = require("http");
  const lsPath = path.join(CASCADE, "ls-bridge.js");
  const discPath = path.join(CASCADE, "host-discover.js");
  const savedDisc = require.cache[require.resolve(discPath)];
  delete require.cache[require.resolve(lsPath)];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dao-heal-s-"));
  process.env.DAO_DEVIN_CRED_FILE = path.join(dir, "credentials.toml");
  fs.writeFileSync(process.env.DAO_DEVIN_CRED_FILE, 'windsurf_api_key = "stale-key"\n');

  // Connect envelope: flags(1B)+len(4B)+json
  const frame = (flags, obj) => {
    const j = Buffer.from(JSON.stringify(obj), "utf8");
    const env = Buffer.concat([Buffer.from([flags, 0, 0, 0, 0]), j]);
    env.writeUInt32BE(j.length, 1);
    return env;
  };
  let healed = false, streamHits = 0, driveHits = 0, discovered = 0;
  const srv = http.createServer((req, res) => {
    if (req.url.endsWith("StreamCascadeReactiveUpdates")) {
      driveHits++;
      res.statusCode = 200;
      res.write(frame(0, { note: "tick" }));
      res.end(frame(2, {}));
      return;
    }
    streamHits++;
    res.statusCode = 200;
    if (!healed) { res.end(frame(2, { error: { message: "invalid api key (trace ID: x)" } })); }
    else { res.write(frame(0, { chunk: "ok" })); res.end(frame(2, {})); }
  });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const port = srv.address().port;

  const g = globalThis;
  const savedHost = g.__daoWindsurfHost;
  g.__daoWindsurfHost = { lsPort: port, csrfToken: "csrf-x", auth: null, profileUrl: "", fused: {}, listeners: new Set(), _fusedSeeded: true };
  require.cache[require.resolve(discPath)] = {
    id: discPath, filename: discPath, loaded: true,
    exports: { discover: async () => { discovered++; healed = true; g.__daoWindsurfHost.lsPort = port; return { lsPort: port, csrfToken: "csrf-x" }; } },
  };
  try {
    const bridge = require(lsPath);
    // callStream: 首发 trailer 携鉴权错 → 自愈重试后收到数据帧
    const got = [];
    await bridge.callStream("GetDeepWiki", {}, (j) => got.push(j));
    assert.deepStrictEqual(got, [{ chunk: "ok" }], "自愈重试后应收到数据帧");
    assert.strictEqual(streamHits, 2, "首发失败 + 重试成功 = 两次命中");
    assert.strictEqual(discovered, 1, "应恰好触发一次重发现");
    // driveStream: 指向死端口 → 连拒自愈重连到活端口
    healed = false; discovered = 0;
    const dead = http.createServer(() => {});
    await new Promise((r) => dead.listen(0, "127.0.0.1", r));
    const deadPort = dead.address().port;
    await new Promise((r) => dead.close(r)); // 关掉 → 该端口连拒
    g.__daoWindsurfHost.lsPort = deadPort;
    let frames = 0;
    const d = bridge.driveStream("cid-1", () => { frames++; });
    await new Promise((r) => setTimeout(r, 400));
    d.close();
    assert.strictEqual(discovered, 1, "连拒应恰好触发一次重发现");
    assert.ok(driveHits >= 1 && frames >= 1, "重连后应收到反应帧");
  } finally {
    srv.close();
    if (savedHost) g.__daoWindsurfHost = savedHost; else delete g.__daoWindsurfHost;
    if (savedDisc) require.cache[require.resolve(discPath)] = savedDisc; else delete require.cache[require.resolve(discPath)];
    delete require.cache[require.resolve(lsPath)];
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
  assertOwnerOnly(process.env.DAO_LOCAL_API_FILE);
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
  assertOwnerOnly(process.env.DAO_GITHUB_FLEET_FILE);
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
  assertOwnerOnly(process.env.DAO_PROXY_CHANNELS_FILE);
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
  assertOwnerOnly(process.env.DAO_WEB_SEARCH_FILE);
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
  assertOwnerOnly(process.env.DAO_INJECT_PROFILE_FILE);
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

test("R128 本地 API 后端调度端点: /api/env 直取环境共生检测; POST 未知路由 404; send 缺 text 报错", async () => {
  const api = require(path.join(CASCADE, "local-api.js"));
  const h = fs.mkdtempSync(path.join(os.tmpdir(), "dao-api-env-"));
  process.env.DAO_ENV_SYNC_HOME = h;
  try {
    const env = api.routes("/api/env");
    assert.strictEqual(env.sources.length, 30);
    assert.ok(env.sources.every((s) => s.path.startsWith(h)));
    assert.strictEqual(await api.postRoutes("/api/nope", {}), null);
    await assert.rejects(() => api.postRoutes("/api/cascade/send", {}), /text required/);
    assert.throws(() => api.routes("/api/cascade/steps"), /cascadeId required/);
    await assert.rejects(() => api.postRoutes("/api/cloud/send", {}), /text required/);
  } finally { delete process.env.DAO_ENV_SYNC_HOME; }
});

test("R130 本地 API 会话管理/设置写侧参数校验: rename/archive/delete/cancel 缺 cascadeId; settings 缺 patch; memory 缺 id", async () => {
  const api = require(path.join(CASCADE, "local-api.js"));
  await assert.rejects(() => api.postRoutes("/api/cascade/rename", {}), /cascadeId and name required/);
  await assert.rejects(() => api.postRoutes("/api/cascade/archive", {}), /cascadeId required/);
  await assert.rejects(() => api.postRoutes("/api/cascade/delete", {}), /cascadeId required/);
  await assert.rejects(() => api.postRoutes("/api/cascade/cancel", {}), /cascadeId required/);
  await assert.rejects(() => api.postRoutes("/api/settings", {}), /patch required/);
  await assert.rejects(() => api.postRoutes("/api/memory/update", {}), /memoryId and content required/);
  await assert.rejects(() => api.postRoutes("/api/memory/delete", {}), /memoryId required/);
  assert.throws(() => api.routes("/api/cascade/transcript"), /cascadeId required/);
  await assert.rejects(() => api.postRoutes("/api/cascade/queue", {}), /cascadeId and text required/);
  await assert.rejects(() => api.postRoutes("/api/cascade/branch", {}), /cascadeId, stepIndex and text required/);
  await assert.rejects(() => api.postRoutes("/api/cascade/revert", {}), /cascadeId and stepIndex required/);
  await assert.rejects(() => api.postRoutes("/api/auth/code", {}), /code required/);
  await assert.rejects(() => api.postRoutes("/api/auth/code", { code: "x" }), /no pending login/);
  assert.deepStrictEqual(await api.postRoutes("/api/auth/cancel", {}), { ok: true });
  await assert.rejects(() => api.postRoutes("/api/cloud/cancel", {}), /sessionId required/);
  // R136 官方 configuration 生效视图: 默认值+用户覆写归一(官方清单缺失时也回同构空集)
  const conf = await api.routes("/api/config");
  assert.strictEqual(typeof conf.defaultCount, "number");
  assert.ok(conf.effective && typeof conf.effective === "object");
  assert.ok(conf.sources && typeof conf.sources === "object");
  // R136 Cloud 长连接: 未开启时状态/增量取均为离线同构结果(不抛)
  assert.deepStrictEqual(await api.routes("/api/cloud/live"), { on: false });
  assert.deepStrictEqual(await api.routes("/api/cloud/updates?since=0"), { on: false, updates: [], next: 0 });
  assert.deepStrictEqual(await api.postRoutes("/api/cloud/live", { on: false }), { on: false });
  // R135 统一任务视图: LS/Cloud 均不可达时也归一为空集同构结果(不抛)
  const tasks = await api.routes("/api/tasks");
  assert.ok(Array.isArray(tasks.tasks));
  assert.strictEqual(typeof tasks.localCount, "number");
  assert.strictEqual(typeof tasks.cloudCount, "number");
});

test("R129 Cloud token 官方同源去前缀: devin-session-token$ 前缀剥离后方可过 /acp/live(带前缀即403)", () => {
  const { acpToken } = require(path.join(CASCADE, "acp-wss.js"));
  assert.strictEqual(acpToken("devin-session-token$abc123"), "abc123");
  assert.strictEqual(acpToken("plain-key"), "plain-key");
});

test("R135 Cloud 客户端公开订阅面: onUpdate 多监听器分发(替代覆写私有 _onUpdate)", () => {
  const { AcpWssClient } = require(path.join(CASCADE, "acp-wss.js"));
  const seen = [];
  const c = new AcpWssClient({ onUpdate: (u) => seen.push(["ctor", u]) });
  c.onUpdate((u) => seen.push(["sub", u]));
  c.onUpdate(null); // 非函数忽略
  c._onUpdate({ kind: "x" });
  assert.deepStrictEqual(seen.map((s) => s[0]), ["ctor", "sub"]);
  assert.strictEqual(seen[0][1].kind, "x");
});

test("R137 onUpdate 返回幂等 unsubscribe(调用方免伸手进私有 _subs)", () => {
  const { AcpWssClient } = require(path.join(CASCADE, "acp-wss.js"));
  const seen = [];
  const c = new AcpWssClient({});
  const unsub = c.onUpdate((u) => seen.push(u));
  assert.strictEqual(typeof unsub, "function");
  assert.strictEqual(c._subs.length, 1);
  c._onUpdate({ n: 1 });
  unsub();
  assert.strictEqual(c._subs.length, 0);
  unsub(); // 幂等: 再调不抛、不误删他人
  c._onUpdate({ n: 2 }); // 已退订不再收
  assert.deepStrictEqual(seen, [{ n: 1 }]);
  // 非函数返回 no-op unsubscribe
  assert.strictEqual(typeof c.onUpdate(null), "function");
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
  // 归并视图: 停用的 server 不在 LS states 里也须保留在列表(可再启用) —— 官方管理页同构
  mc.toggleServer("github", true);
  const merged = mc.mergedServers([
    { spec: { serverName: "other", disabledTools: ["t2"] }, status: "MCP_SERVER_STATUS_READY",
      tools: [{ name: "t1" }, { name: "t2" }], prompts: [] },
  ]);
  const gh = merged.find((s) => s.name === "github");
  assert.ok(gh, "停用 server 仍在归并列表");
  assert.strictEqual(gh.disabled, true);
  assert.strictEqual(gh.status, "DISABLED");
  const ot = merged.find((s) => s.name === "other");
  assert.strictEqual(ot.status, "READY");
  assert.deepStrictEqual(ot.tools.map((t) => t.off), [false, true]);
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

test("authStatus 去抖: 单飞合并 + TTL 缓存 + force 绕过(根治子进程风暴)", async () => {
  const prov = require(path.join(CASCADE, "devin-provision.js"));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dao-auth-"));
  const cnt = path.join(dir, "cnt");
  fs.writeFileSync(cnt, "");
  const fake = process.platform === "win32" ? path.join(dir, "fake-devin.cmd") : path.join(dir, "fake-devin");
  if (process.platform === "win32") {
    fs.writeFileSync(fake, '@echo x>> "' + cnt + '"\r\n@echo Logged in\r\n@echo Name: dao\r\n');
  } else {
    fs.writeFileSync(fake, '#!/bin/sh\necho x >> "' + cnt + '"\necho "Logged in"\necho "Name: dao"\n');
    fs.chmodSync(fake, 0o755);
  }
  const calls = () => fs.readFileSync(cnt, "utf8").split("\n").filter(Boolean).length;
  // 1) 并发 5 连发 → 单飞合并为 1 次 spawn
  const rs = await Promise.all([1, 2, 3, 4, 5].map(() => prov.authStatus(fake)));
  assert.strictEqual(calls(), 1, "并发调用须单飞合并");
  for (const r of rs) { assert.strictEqual(r.loggedIn, true); assert.strictEqual(r.name, "dao"); }
  // 2) TTL 窗口内再调 → 命中缓存不再 spawn
  await prov.authStatus(fake);
  assert.strictEqual(calls(), 1, "TTL 内须命中缓存");
  // 3) force 绕过缓存 → 立即重新 spawn
  await prov.authStatus(fake, { force: true });
  assert.strictEqual(calls(), 2, "force 须绕过缓存");
  // 4) TTL 过期 → 重新 spawn
  await new Promise((r) => setTimeout(r, 10));
  await prov.authStatus(fake, { ttlMs: 1 });
  assert.strictEqual(calls(), 3, "TTL 过期须重新探测");
});

test("环境共生检测: 官方同一配置体系的源清单/条目数/IDE 痕迹(DAO_ENV_SYNC_HOME 隔离)", () => {
  const es = require(path.join(CASCADE, "env-sync.js"));
  const h = fs.mkdtempSync(path.join(os.tmpdir(), "dao-env-"));
  process.env.DAO_ENV_SYNC_HOME = h;
  try {
    // 1) 全空环境: 无 IDE、无痕迹、各源 exists=false
    let d = es.detect();
    assert.strictEqual(d.ide.installed, false);
    assert.strictEqual(d.ide.engineTraces, false);
    assert.strictEqual(d.configRootExists, false);
    assert.strictEqual(d.sources.length, 30, "官方落盘全清单(定制/引擎/IDE层/账户/插件)");
    for (const s of d.sources) { assert.strictEqual(s.exists, false); assert.ok(s.path.startsWith(h)); assert.ok(s.group); }
    // 2) 官方式落盘后: 条目数与官方文件结构一致
    const ws = path.join(h, ".codeium", "windsurf");
    fs.mkdirSync(path.join(ws, "global_workflows"), { recursive: true });
    fs.writeFileSync(path.join(ws, "global_workflows", "a.md"), "# a");
    fs.writeFileSync(path.join(ws, "global_workflows", "b.md"), "# b");
    fs.mkdirSync(path.join(ws, "skills", "s1"), { recursive: true });
    fs.writeFileSync(path.join(ws, "skills", "s1", "SKILL.md"), "x");
    fs.mkdirSync(path.join(ws, "skills", "no-skill"), { recursive: true }); // 无 SKILL.md 不计
    fs.writeFileSync(path.join(ws, "mcp_config.json"), JSON.stringify({ mcpServers: { gh: {}, fs: {} } }));
    fs.mkdirSync(path.join(h, ".windsurf", "acp"), { recursive: true });
    fs.writeFileSync(path.join(h, ".windsurf", "acp", "registry.json"), JSON.stringify({ version: "1.0.0", agents: [{ id: "x" }] }));
    fs.mkdirSync(path.join(h, ".devin", "rules"), { recursive: true });
    fs.writeFileSync(path.join(h, ".devin", "rules", "r.md"), "# r");
    d = es.detect();
    const by = Object.fromEntries(d.sources.map((s) => [s.key, s]));
    assert.strictEqual(by.mcp.count, 2);
    assert.strictEqual(by.gworkflows.count, 2);
    assert.strictEqual(by.gskills.count, 1, "无 SKILL.md 的目录不计入");
    assert.strictEqual(by.acp.count, 1);
    assert.strictEqual(by.grules.count, 1);
    assert.strictEqual(by.cred.exists, false);
    // 引擎/IDE层/插件新源
    fs.writeFileSync(path.join(ws, "user_settings.pb"), Buffer.alloc(2048));
    fs.mkdirSync(path.join(ws, "memories"), { recursive: true });
    fs.writeFileSync(path.join(ws, "memories", "global_rules.md"), "# g");
    fs.mkdirSync(path.join(h, ".config", "Devin", "User", "globalStorage"), { recursive: true });
    fs.writeFileSync(path.join(h, ".config", "Devin", "User", "settings.json"), "{}");
    fs.mkdirSync(path.join(h, ".devin", "extensions", "ext-a"), { recursive: true });
    fs.mkdirSync(path.join(h, ".wam", "conversation_backups", "x"), { recursive: true });
    fs.mkdirSync(path.join(h, ".config", "Devin", "User", "History", "h1"), { recursive: true });
    fs.mkdirSync(path.join(h, ".config", "Devin", "User", "workspaceStorage", "w1"), { recursive: true });
    fs.mkdirSync(path.join(h, ".config", "Devin", "Backups", "b1"), { recursive: true });
    fs.writeFileSync(path.join(h, ".config", "Devin", "User", "chatLanguageModels.json"), "[]");
    fs.mkdirSync(path.join(h, ".local", "share", "devin", "mcp", "m1"), { recursive: true });
    d = es.detect();
    const by2 = Object.fromEntries(d.sources.map((s) => [s.key, s]));
    if (process.platform === "linux") {
      assert.ok(d.ideUserDir.startsWith(h));
      assert.strictEqual(by2.idesettings.exists, true);
      assert.strictEqual(by2.idehistory.count, 1);
      assert.strictEqual(by2.idewsstorage.count, 1);
      assert.strictEqual(by2.idebackups.count, 1);
      assert.strictEqual(by2.idechatmodels.exists, true);
    }
    assert.strictEqual(by2.climcp.count, 1);
    assert.ok(by2.usersettings.sizeKb >= 2);
    assert.strictEqual(by2.memories.count, 1);
    assert.strictEqual(by2.grulesmd.exists, true);
    assert.strictEqual(by2.ideexts.count, 1);
    assert.strictEqual(by2.wam.count, 1);
    // 3) 配置根存在但无 IDE 二进制 → engineTraces
    assert.strictEqual(d.ide.installed, false);
    assert.strictEqual(d.ide.engineTraces, true);
    // 4) IDE 二进制检出
    const bin = path.join(h, "devin-desktop", "Devin", "bin", "devin-desktop");
    fs.mkdirSync(path.dirname(bin), { recursive: true });
    fs.writeFileSync(bin, "");
    d = es.detect();
    assert.strictEqual(d.ide.installed, true);
    assert.strictEqual(d.ide.binPath, bin);
  } finally { delete process.env.DAO_ENV_SYNC_HOME; }
});

test("R138 协议自描述: /api/openapi 路由清单与 local-api 源码路由字面量对账(漏登即红)", () => {
  const schema = require(path.join(CASCADE, "api-schema.js"));
  const src = fs.readFileSync(path.join(CASCADE, "local-api.js"), "utf8");
  const inSource = new Set((src.match(/"\/api\/[a-z/-]+"/g) || []).map((s) => s.slice(1, -1)));
  const inSchema = new Set(schema.ROUTES.map((r) => r.path));
  for (const p of inSource) assert.ok(inSchema.has(p), "源码路由未登记进 api-schema: " + p);
  for (const p of inSchema) assert.ok(inSource.has(p), "api-schema 幽灵路由(源码不存在): " + p);
  const doc = schema.openapi({ port: 1234 });
  assert.strictEqual(doc.openapi, "3.1.0");
  assert.ok(doc.paths["/api/cascade/send"].post.requestBody.content["application/json"].schema.required.includes("text"));
  assert.deepStrictEqual(doc.paths["/api/health"].get.security, []);
  assert.ok(doc.servers[0].url.endsWith(":1234"));
});

test("Windows Agent 接入官方工具层: local/remote 注册直写 mcp_config.json + 脱敏视图 + 模式提示词", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dao-winagent-"));
  process.env.DAO_MCP_CONFIG_FILE = path.join(dir, "mcp_config.json");
  const wa = require(path.join(CASCADE, "windows-agent.js"));
  try {
    // 未注册
    assert.deepStrictEqual(wa.status(), { registered: false });
    // local: 无检出必拒(可诊断)
    delete process.env.DAO_WINDOWS_AGENT_DIR;
    const miss = wa.registerLocal({ dir: path.join(dir, "nowhere") });
    assert.strictEqual(miss.ok, false);
    // local: 伪造检出(bridge/mcp.py 在即认)
    const co = path.join(dir, "Dao-Windows-Agent");
    fs.mkdirSync(path.join(co, "bridge"), { recursive: true });
    fs.writeFileSync(path.join(co, "bridge", "mcp.py"), "");
    const r1 = wa.registerLocal({ dir: co, bridgeUrl: "http://127.0.0.1:9930", token: "秘" });
    assert.strictEqual(r1.ok, true);
    assert.strictEqual(r1.transport, "local");
    const cfg1 = JSON.parse(fs.readFileSync(process.env.DAO_MCP_CONFIG_FILE, "utf8"));
    const spec1 = cfg1.mcpServers[wa.SERVER_NAME];
    assert.strictEqual(spec1.command, process.platform === "win32" ? "python" : "python3");
    assert.deepStrictEqual(spec1.args, ["-m", "bridge.mcp"]);
    assert.strictEqual(spec1.cwd, co);
    assert.strictEqual(spec1.env.DAO_WIN_BRIDGE_URL, "http://127.0.0.1:9930");
    const st1 = wa.status();
    assert.strictEqual(st1.transport, "local");
    assert.strictEqual(st1.hasAuth, true);
    assert.ok(!JSON.stringify(st1).includes("秘"), "视图必脱敏");
    // remote: 补 /mcp + Bearer 头；非 http(s) 必拒
    assert.strictEqual(wa.registerRemote({ url: "ws://x" }).ok, false);
    const r2 = wa.registerRemote({ url: "https://dao-relay.example.com/", token: "秘2" });
    assert.strictEqual(r2.ok, true);
    const spec2 = JSON.parse(fs.readFileSync(process.env.DAO_MCP_CONFIG_FILE, "utf8")).mcpServers[wa.SERVER_NAME];
    assert.strictEqual(spec2.serverUrl, "https://dao-relay.example.com/mcp");
    assert.strictEqual(spec2.headers.Authorization, "Bearer 秘2");
    const st2 = wa.status();
    assert.strictEqual(st2.transport, "remote");
    assert.ok(!JSON.stringify(st2).includes("秘2"), "视图必脱敏");
    // 与 mcp-config 开关同源: server 级 disabled 可翻转
    const mc = require(path.join(CASCADE, "mcp-config.js"));
    assert.strictEqual(mc.toggleServer(wa.SERVER_NAME).disabled, true);
    assert.strictEqual(wa.status().disabled, true);
    // 注销
    assert.deepStrictEqual(wa.unregister(), { ok: true, removed: true });
    assert.deepStrictEqual(wa.status(), { registered: false });
    // 模式提示词(经文+工具契约)
    const p = wa.modePrompt();
    assert.ok(p.includes("list_apps") && p.includes("clone_plan") && p.includes("道并行而不相悖"));
  } finally { delete process.env.DAO_MCP_CONFIG_FILE; }
});

test("R139 六大板块升进统一协议: local-api 直调 proxy/pool/inject/github/search/winagent(脱敏·同一真源)", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dao-6b-"));
  process.env.DAO_PROXY_CHANNELS_FILE = path.join(dir, "px.json");
  process.env.DAO_CASCADE_POOL_FILE = path.join(dir, "pool.json");
  process.env.DAO_INJECT_PROFILE_FILE = path.join(dir, "inj.json");
  process.env.DAO_GITHUB_FLEET_FILE = path.join(dir, "gh.json");
  process.env.DAO_MCP_CONFIG_FILE = path.join(dir, "mcp.json");
  const api = require(path.join(CASCADE, "local-api.js"));
  try {
    // Proxy Pro: 经协议加渠道(种池, 不打网)+ 视图脱敏 + 路由
    fs.writeFileSync(process.env.DAO_PROXY_CHANNELS_FILE, JSON.stringify({ channels: [
      { name: "DeepSeek", type: "openai", baseURL: "https://api.deepseek.com/v1", apiKey: "sk-secretZZZZ9999", models: ["deepseek-chat"], verify: "ok" },
    ], routes: {} }), { mode: 0o600 });
    const pv = api.routes("/api/proxy");
    assert.strictEqual(pv.channels.length, 1);
    assert.ok(!JSON.stringify(pv).includes("sk-secretZZZZ"), "proxy 视图脱敏");
    const rr = await api.postRoutes("/api/proxy/route", { uid: "windsurf-swe-1", channel: "DeepSeek", model: "deepseek-chat" });
    assert.ok(rr.ok);
    const rs = api.routes("/api/proxy/routes").routes;
    assert.strictEqual(rs[0].uid, "windsurf-swe-1");
    assert.strictEqual(rs[0].effective, true);
    assert.ok(!JSON.stringify(rs).match(/sk-secret/), "路由生效视图无 Key");
    await assert.rejects(() => api.postRoutes("/api/proxy/route", {}), /uid required/);
    // Proxy 运行期反代: 未配路由的 UID 必报错(绝不伪造)
    await assert.rejects(() => api.postRoutes("/api/proxy/chat", { uid: "no-route", text: "hi" }), /未配置路由/);
    await assert.rejects(() => api.postRoutes("/api/proxy/chat", {}), /uid required/);

    // 账号池: 视图脱敏 + 切换缺 email 报错
    fs.writeFileSync(process.env.DAO_CASCADE_POOL_FILE, JSON.stringify([
      { email: "a@x.y", name: "A", plan: "pro", apiKey: "key-secretAAAA1234", addedAt: "2026-07-12T00:00:00Z" },
    ]), { mode: 0o600 });
    const poolv = api.routes("/api/pool");
    assert.strictEqual(poolv.accounts.length, 1);
    assert.ok(!JSON.stringify(poolv).includes("key-secretAAAA"), "账号池视图脱敏");
    assert.strictEqual(poolv.accounts[0].keyTail, "1234");
    await assert.rejects(() => api.postRoutes("/api/pool/switch", {}), /email required/);
    await assert.rejects(() => api.postRoutes("/api/pool/switch", { email: "ghost@x.y" }), /账号池无此号/);

    // 反向注入: 经协议加档 + 视图脱敏 + 计划
    await api.postRoutes("/api/inject/add", { kind: "secret", name: "TOK", spec: { value: "v-secretBBBB5678" } });
    await api.postRoutes("/api/inject/add", { kind: "mcp", name: "gh", spec: { command: "npx" } });
    const iv = api.routes("/api/inject").items;
    assert.strictEqual(iv.length, 2);
    assert.ok(!JSON.stringify(iv).includes("v-secretBBBB"), "注入 secret 脱敏");
    const iplan = api.routes("/api/inject/plan");
    assert.strictEqual(iplan.total, 2 * 1); // 1 号 × 2 档
    await assert.rejects(() => api.postRoutes("/api/inject/remove", {}), /kind and name required/);

    // GitHub 舰队: 视图脱敏 + 移除缺 login 报错
    fs.writeFileSync(process.env.DAO_GITHUB_FLEET_FILE, JSON.stringify([
      { login: "alpha", pat: "ghp_secretCCCC0000", role: "admin", addedAt: "2026-07-12T00:00:00Z" },
    ]), { mode: 0o600 });
    const ghv = api.routes("/api/github");
    assert.strictEqual(ghv.accounts.length, 1);
    assert.ok(!JSON.stringify(ghv).includes("ghp_secretCCCC"), "GitHub 视图脱敏");
    await assert.rejects(() => api.postRoutes("/api/github/remove", {}), /login required/);

    // Web 搜索: 无 q 回引擎+历史; POST 缺 query 报错
    const sv = api.routes("/api/search");
    assert.ok(Array.isArray(sv.engines) && sv.engines.length >= 2);
    await assert.rejects(() => api.postRoutes("/api/search", {}), /query required/);

    // Windows Agent: 状态未注册 + remote 缺 url 报错
    assert.deepStrictEqual(api.routes("/api/winagent"), { registered: false });
    await assert.rejects(() => api.postRoutes("/api/winagent/remote", {}), /url required/);
    const wr = await api.postRoutes("/api/winagent/remote", { url: "https://dao-relay.example.com/", token: "秘X" });
    assert.strictEqual(wr.ok, true);
    assert.ok(!JSON.stringify(api.routes("/api/winagent")).includes("秘X"), "winagent 视图脱敏");
    await api.postRoutes("/api/winagent/unregister", {});

    // openapi 登记全覆盖(六板块+运行期路由)
    const spec = require(path.join(CASCADE, "api-schema.js")).openapi({ port: 1 });
    for (const p of ["/api/proxy", "/api/proxy/chat", "/api/proxy/routes", "/api/pool", "/api/pool/switch",
      "/api/inject", "/api/inject/apply-mcp", "/api/github", "/api/github/verify", "/api/search", "/api/winagent"]) {
      assert.ok(spec.paths[p], "openapi 应登记 " + p);
    }
  } finally {
    for (const k of ["DAO_PROXY_CHANNELS_FILE", "DAO_CASCADE_POOL_FILE", "DAO_INJECT_PROFILE_FILE", "DAO_GITHUB_FLEET_FILE", "DAO_MCP_CONFIG_FILE"]) delete process.env[k];
  }
});

test("R139 Proxy Pro 运行期反代真正生效: 路由消费 → 请求打到配置渠道(mock)且用映射模型(不伪造)", async () => {
  const http = require("http");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dao-pxrt-"));
  process.env.DAO_PROXY_CHANNELS_FILE = path.join(dir, "px.json");
  // 起一个 OpenAI 兼容 mock 渠道: 记录收到的 model + auth, 回定值内容
  let seen = null;
  const srv = http.createServer((req, res) => {
    let b = ""; req.on("data", (c) => { b += c; });
    req.on("end", () => {
      seen = { path: req.url, auth: req.headers["authorization"], body: JSON.parse(b || "{}") };
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: "道生一(来自第三方渠道)" } }] }));
    });
  });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const base = "http://127.0.0.1:" + srv.address().port + "/v1";
  try {
    const px = require(path.join(CASCADE, "proxy-pro.js"));
    const rt = require(path.join(CASCADE, "proxy-runtime.js"));
    px.save({ channels: [
      { name: "Mock", type: "openai", baseURL: base, apiKey: "sk-mockKEY4321", models: ["mock-large"], verify: "ok" },
    ], routes: { "windsurf-swe-1": { channel: "Mock", model: "mock-large" } } });
    // resolve 消费 routes → 指向 Mock/mock-large
    const rv = rt.resolve("windsurf-swe-1");
    assert.strictEqual(rv.channel.name, "Mock");
    assert.strictEqual(rv.model, "mock-large");
    assert.strictEqual(rt.resolve("unrouted"), null);
    // chat 真正投递到 mock: 目标 = 配置渠道, 模型 = 映射模型
    const r = await rt.chat("windsurf-swe-1", { messages: [{ role: "user", content: "你好" }] });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.channel, "Mock");
    assert.strictEqual(r.model, "mock-large");
    assert.strictEqual(r.content, "道生一(来自第三方渠道)");
    assert.strictEqual(seen.path, "/v1/chat/completions");
    assert.strictEqual(seen.body.model, "mock-large", "请求体用映射模型名(路由真生效)");
    assert.strictEqual(seen.auth, "Bearer sk-mockKEY4321");
    // 返回体绝不含 apiKey
    assert.ok(!JSON.stringify(r).includes("sk-mockKEY4321"), "返回体脱敏无 Key");
    // routeStatus 反映可投递
    assert.strictEqual(rt.routeStatus()[0].effective, true);
  } finally {
    srv.close();
    delete process.env.DAO_PROXY_CHANNELS_FILE;
  }
});

test("R140 推理模型响应: content 空则兜底 reasoning_content, finishReason 透出(实战 deepseek-v4/mimo 之真形)", async () => {
  const http = require("http");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dao-reason-"));
  process.env.DAO_PROXY_CHANNELS_FILE = path.join(dir, "px.json");
  const rt = require(path.join(CASCADE, "proxy-runtime.js"));
  // extractText: content 空 → 取 reasoning_content
  assert.strictEqual(
    rt.extractText("openai", { choices: [{ message: { content: "", reasoning_content: "只有思考正文" }, finish_reason: "length" }] }),
    "只有思考正文");
  assert.strictEqual(
    rt.extractText("openai", { choices: [{ message: { content: "正式答案" }, finish_reason: "stop" }] }),
    "正式答案", "content 非空优先");
  assert.strictEqual(rt.finishReason("openai", { choices: [{ finish_reason: "length" }] }), "length");
  assert.strictEqual(rt.finishReason("anthropic", { stop_reason: "end_turn" }), "end_turn");
  // chat: content 全空 + length 截断 → 明确报错(不伪造·不空跑)
  let mode = "empty";
  const srv = http.createServer((req, res) => {
    let b = ""; req.on("data", (c) => { b += c; });
    req.on("end", () => {
      res.writeHead(200, { "Content-Type": "application/json" });
      if (mode === "empty") res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: "" }, finish_reason: "length" }] }));
      else res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: "", reasoning_content: "推理兜底文" }, finish_reason: "stop" }] }));
    });
  });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  try {
    const px = require(path.join(CASCADE, "proxy-pro.js"));
    px.save({ channels: [{ name: "R", type: "openai", baseURL: "http://127.0.0.1:" + srv.address().port + "/v1", apiKey: "sk-r9999", models: ["r"], verify: "ok" }],
      routes: { "u": { channel: "R", model: "r" } } });
    const r1 = await rt.chat("u", { messages: [{ role: "user", content: "hi" }] });
    assert.strictEqual(r1.ok, false);
    assert.strictEqual(r1.finishReason, "length");
    assert.ok(/max_tokens|截断|推理/.test(r1.error), "空正文+length 应明确报错");
    mode = "reason";
    const r2 = await rt.chat("u", { messages: [{ role: "user", content: "hi" }] });
    assert.strictEqual(r2.ok, true);
    assert.strictEqual(r2.content, "推理兜底文", "content 空则兜底 reasoning_content");
  } finally {
    srv.close();
    delete process.env.DAO_PROXY_CHANNELS_FILE;
  }
});

test("Windows 分身面板核(headless): 桥+隧道+矩阵一次聚合探活, 逐源不可达不拖垮整体", async () => {
  const httpMod = require("http");
  const wc = require(path.join(CASCADE, "windows-panel-core.js"));
  // mock 桥: /api/health + /api/clone.matrix
  const br = httpMod.createServer((req, res) => {
    res.setHeader("content-type", "application/json");
    if (req.url === "/api/health") return res.end(JSON.stringify({ ok: true, apps: ["freecad", "kicad"], sessions: ["s1"] }));
    if (req.url === "/api/clone.matrix") return res.end(JSON.stringify({ matrix: { freecad: { tier: "appdata", min_tier: "appdata", isolated: true } } }));
    res.statusCode = 404; res.end("{}");
  });
  // mock 隧道: GET /input 列持有者; POST /input?op=release 释放
  let released = null;
  const tun = httpMod.createServer((req, res) => {
    res.setHeader("content-type", "application/json");
    const u = new URL(req.url, "http://x");
    if (u.pathname !== "/input") { res.statusCode = 404; return res.end("{}"); }
    if (req.method === "POST" && u.searchParams.get("op") === "release") {
      released = { key: u.searchParams.get("key"), owner: u.searchParams.get("owner") };
      return res.end(JSON.stringify({ ok: true, released: true }));
    }
    res.end(JSON.stringify({ ok: true, holders: [{ key: "account:dao#1", ownerId: "human:u", kind: "human", priority: 100, ttlLeft: 3000 }] }));
  });
  await new Promise((r) => br.listen(0, "127.0.0.1", r));
  await new Promise((r) => tun.listen(0, "127.0.0.1", r));
  process.env.DAO_WIN_BRIDGE_URL = "http://127.0.0.1:" + br.address().port;
  process.env.DAO_WIN_TUNNEL_URL = "http://127.0.0.1:" + tun.address().port;
  try {
    const d = await wc.probe();
    assert.strictEqual(d.bridge.ok, true);
    assert.deepStrictEqual(d.bridge.apps, ["freecad", "kicad"]);
    assert.strictEqual(d.bridge.sessions.length, 1);
    assert.strictEqual(d.tunnel.ok, true);
    assert.strictEqual(d.tunnel.holders[0].kind, "human");
    assert.strictEqual(d.matrix.freecad.isolated, true);
    // 释放租约
    const rl = await wc.releaseLease("account:dao#1", "human:u");
    assert.strictEqual(rl.released, true);
    assert.deepStrictEqual(released, { key: "account:dao#1", owner: "human:u" });
    assert.deepStrictEqual(await wc.releaseLease("", ""), { ok: false, error: "需 key 与 owner" });
    // 桥/隧道皆断 → 仍整体返回, 逐源 error
    br.close(); tun.close();
    process.env.DAO_WIN_BRIDGE_URL = "http://127.0.0.1:1";
    process.env.DAO_WIN_TUNNEL_URL = "http://127.0.0.1:1";
    const d2 = await wc.probe();
    assert.strictEqual(d2.bridge.ok, false);
    assert.ok(d2.bridge.error);
    assert.strictEqual(d2.tunnel.ok, false);
    assert.strictEqual(d2.matrix, null);
  } finally {
    try { br.close(); } catch (_) {}
    try { tun.close(); } catch (_) {}
    delete process.env.DAO_WIN_BRIDGE_URL;
    delete process.env.DAO_WIN_TUNNEL_URL;
  }
});

test("R141 同步/隔离边界: 切号可归还(credentials.toml.bak → restore) + 自有板块全落 ~/.dao 自持", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dao-bound-"));
  process.env.DAO_CASCADE_POOL_FILE = path.join(dir, "pool.json");
  process.env.DAO_DEVIN_CRED_FILE = path.join(dir, "credentials.toml");
  const pool = require(path.join(CASCADE, "account-pool.js"));
  try {
    // 未切号前归还 → 明确报错(官方登录态未被触碰)
    assert.throws(() => pool.restoreOriginal(), /未经本插件切号|无原始备份/);
    // 官方原态 → 收录两号 → 切号(首次自动备份原态)
    fs.writeFileSync(process.env.DAO_DEVIN_CRED_FILE, 'windsurf_api_key = "official-orig-key"\n');
    pool.captureCurrent("official-orig-key", { email: "a@x.com", name: "A" });
    pool.captureCurrent("second-key-9999", { email: "b@x.com", name: "B" });
    pool.switchTo("b@x.com");
    assert.strictEqual(pool.currentCredKey(), "second-key-9999", "切号后 credentials.toml 应为目标号 key");
    assert.ok(fs.readFileSync(process.env.DAO_DEVIN_CRED_FILE + ".bak", "utf8").includes("official-orig-key"), "首次切号应备份官方原态");
    // 归还 → 官方原登录态复原
    const r = pool.restoreOriginal();
    assert.strictEqual(r.restored, true);
    assert.strictEqual(pool.currentCredKey(), "official-orig-key", "归还后应回官方原 key");
    // 边界自描述: openapi 已登记 /api/boundary 与 /api/pool/restore
    const schema = require(path.join(CASCADE, "api-schema.js"));
    const paths = Object.keys(schema.openapi({ port: 0 }).paths);
    assert.ok(paths.includes("/api/boundary"), "openapi 应含 /api/boundary");
    assert.ok(paths.includes("/api/pool/restore"), "openapi 应含 /api/pool/restore");
  } finally {
    delete process.env.DAO_CASCADE_POOL_FILE;
    delete process.env.DAO_DEVIN_CRED_FILE;
  }
});

test("R142 共存场景边界: 探测同装独立插件 + 只读兄弟账号可见(不含凭据) + /api/coexist 已登记", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dao-coex-"));
  const daoDir = path.join(dir, ".dao");
  fs.mkdirSync(daoDir, { recursive: true });
  const extRoot = path.join(dir, ".devin", "extensions");
  fs.mkdirSync(path.join(extRoot, "dao.dao-vsix-3.54.3"), { recursive: true });
  fs.mkdirSync(path.join(extRoot, "dao-agi.dao-proxy-pro-9.9.353"), { recursive: true });
  // dao-vsix 账号库(对象: email→{auth1,...}) —— 含真凭据, 断言绝不外泄
  fs.writeFileSync(path.join(daoDir, "dao-accounts-auth.json"), JSON.stringify({
    "peer@x.com": { auth1: "SECRET-auth1-abc", orgName: "OrgX", orgId: "o1" },
    "peer2@x.com": { auth1: "SECRET-auth1-def", orgName: "" },
  }));
  process.env.DAO_COEXIST_HOME = dir;
  process.env.DAO_EXT_ROOTS = extRoot;
  try {
    delete require.cache[require.resolve(path.join(CASCADE, "coexist.js"))];
    const coexist = require(path.join(CASCADE, "coexist.js"));
    const rep = coexist.report();
    assert.strictEqual(rep.coexisting, true, "已装兄弟插件 → coexisting=true");
    const vsix = rep.siblings.find((s) => s.key === "dao-vsix");
    assert.ok(vsix && vsix.installed, "应探测到 dao-vsix 已装");
    const pro = rep.siblings.find((s) => s.key === "dao-proxy-pro");
    assert.ok(pro && pro.installed, "应探测到 dao-proxy-pro 已装");
    // 账号库文件应被识别为存在
    const authFile = vsix.data.find((d) => d.file.endsWith("dao-accounts-auth.json"));
    assert.ok(authFile && authFile.exists && authFile.verdict === "share-visibility");
    // 只读兄弟账号: 有邮箱, 但绝不含 auth1/凭据
    assert.strictEqual(rep.siblingAccounts.length, 2);
    assert.ok(rep.siblingAccounts.every((a) => a.source === "dao-vsix" && a.hasAuth === true));
    assert.ok(!JSON.stringify(rep).includes("SECRET-auth1"), "共存报告绝不外泄兄弟凭据 auth1");
    // proxy-pro 判定为异命名空间隔离
    assert.ok(pro.data.every((d) => d.verdict === "isolated-namespace"));
    // openapi 已登记 /api/coexist
    const schema = require(path.join(CASCADE, "api-schema.js"));
    assert.ok(Object.keys(schema.openapi({ port: 0 }).paths).includes("/api/coexist"), "openapi 应含 /api/coexist");
  } finally {
    delete process.env.DAO_COEXIST_HOME;
    delete process.env.DAO_EXT_ROOTS;
    delete require.cache[require.resolve(path.join(CASCADE, "coexist.js"))];
  }
});

test("路由生效于对话: Cascade 轨命中 Proxy Pro 路由即整轮改投第三方渠道(panel.js 源级护栏)", () => {
  const src = fs.readFileSync(path.join(CASCADE, "panel.js"), "utf8");
  assert.ok(src.includes('require("./proxy-runtime")'), "panel.js 应引入 proxy-runtime");
  assert.ok(src.includes("proxyRuntime.resolve(this._cascadeModel)"), "发送前应解析当前官方模型 UID 的路由");
  assert.ok(src.includes("_pxChatTurn"), "命中路由应改走 _pxChatTurn 投递第三方渠道");
  assert.ok(src.includes("proxyRuntime.chat(uid"), "_pxChatTurn 应真正调用 proxyRuntime.chat");
  // 多轮上下文与失败不伪造
  assert.ok(src.includes("_pxHistory"), "路由轨应维持面板内多轮上下文");
  assert.ok(src.includes("Proxy Pro 路由投递失败"), "失败必须如实报错, 绝不伪造模型响应");
});

// REARCH2 · 归一主页 = Windows 总控: overview 板块承载 Windows 统一管理
// (账号分身/桌面/模式/工具层), 独立 windows 板块并入主页(BOARDS 无 windows 项)。
test("unified-panel 主页即 Windows 总控", () => {
  const src = fs.readFileSync(path.join(CASCADE, "unified-panel.js"), "utf8");
  assert.ok(src.includes("主页 · Windows 总控"), "主页应为 Windows 总控");
  assert.ok(!src.includes('["windows","'), "独立 windows 板块应并入主页");
  assert.ok(src.includes("renderWinControl"), "主页应内嵌 Windows 总控渲染");
  assert.ok(src.includes("win-acct-create") && src.includes("win-acct-destroy"), "主页应有账号建/销");
  assert.ok(src.includes("win-open-desktop"), "主页应可开桌面(委派 dao-windows-agent)");
  assert.ok(src.includes("loadTabData") && src.includes("tabData"), "协议同构不变");
});

// REARCH2 · windows-panel-core 聚合探活扩展: 账号清单(隧道 /accounts)与
// 工具层模式(桥 /api/mode.get)进入同一 probe 快照, 账号建/销走桥同一真源。
test("windows-panel-core 账号/模式聚合", () => {
  const core = require(path.join(CASCADE, "windows-panel-core.js"));
  assert.strictEqual(typeof core.accountCreate, "function");
  assert.strictEqual(typeof core.accountDestroy, "function");
  const src = fs.readFileSync(path.join(CASCADE, "windows-panel-core.js"), "utf8");
  assert.ok(src.includes("/accounts"), "probe 应拉隧道账号清单");
  assert.ok(src.includes("/api/mode.get"), "probe 应拉桥模式态");
  assert.ok(src.includes("/api/account.create") && src.includes("/api/account.destroy"));
});

// REARCH2 · 模式融合 3×4=12: 提示词层(sp 契约同源 invert/passthrough/custom) ×
// 工具层(ModeManager 同源 primary/coding/windows/native), 矩阵恰 12 组合;
// 落盘隔离于临时目录, 工具层契约与 ~/.dao/mode.json 同形(mode 字段)。
test("mode-fusion 3×4=12 矩阵与双层落盘契约", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dao-mf-"));
  process.env.DAO_MODE_FUSION_FILE = path.join(tmp, "mode-fusion.json");
  process.env.DAO_MODE_CONTRACT_FILE = path.join(tmp, "mode.json");
  try {
    delete require.cache[require.resolve(path.join(CASCADE, "mode-fusion.js"))];
    const mf = require(path.join(CASCADE, "mode-fusion.js"));
    assert.strictEqual(mf.PROMPT_MODES.length, 3);
    assert.strictEqual(mf.TOOL_MODES.length, 4);
    assert.strictEqual(mf.matrix().length, 12);
    assert.deepStrictEqual(mf.PROMPT_MODES.map((m) => m.id), ["invert", "passthrough", "custom"]);
    assert.deepStrictEqual(mf.TOOL_MODES.map((m) => m.id), ["primary", "coding", "windows", "native"]);
    // 默认态: 本源 invert × primary
    let st = mf.state();
    assert.strictEqual(st.combined, "invert+primary");
    assert.strictEqual(st.total, 12);
    // 切提示词层
    st = mf.setPromptMode("passthrough");
    assert.strictEqual(st.prompt, "passthrough");
    // 切工具层 → 契约文件与 ModeManager 同形(mode 字段)
    st = mf.setToolMode("windows");
    assert.strictEqual(st.tool, "windows");
    const contract = JSON.parse(fs.readFileSync(process.env.DAO_MODE_CONTRACT_FILE, "utf8"));
    assert.strictEqual(contract.mode, "windows");
    assert.strictEqual(contract.set_by, "dao-desktop");
    // merge 写: ModeManager 自持字段(overlay/tool_policy/replace_official)不可被覆没
    fs.writeFileSync(process.env.DAO_MODE_CONTRACT_FILE, JSON.stringify({
      mode: "primary", overlay: "o1", tool_policy: { p: 1 }, replace_official: true,
    }));
    st = mf.setToolMode("coding");
    const merged = JSON.parse(fs.readFileSync(process.env.DAO_MODE_CONTRACT_FILE, "utf8"));
    assert.strictEqual(merged.mode, "coding");
    assert.strictEqual(merged.overlay, "o1");
    assert.deepStrictEqual(merged.tool_policy, { p: 1 });
    assert.strictEqual(merged.replace_official, true);
    // custom 运行时接线: syncOrigin 映射 custom→invert 路径; 自定经文经 /origin/custom_sp
    assert.strictEqual(typeof mf.setCustomText, "function");
    assert.strictEqual(typeof mf.clearCustomText, "function");
    const mfSrc = fs.readFileSync(path.join(CASCADE, "mode-fusion.js"), "utf8");
    assert.ok(mfSrc.includes('id === "custom" ? "invert"'), "custom 应以 invert 路径承载");
    assert.ok(mfSrc.includes("/origin/custom_sp"), "自定经文应写反代 custom_sp 接口");
    // 空自定经文拒绝(不打反代)
    const rEmpty = await mf.setCustomText("   ");
    assert.strictEqual(rEmpty.synced, false);
    // 非法模式拒绝
    assert.throws(() => mf.setPromptMode("nope"));
    assert.throws(() => mf.setToolMode("nope"));
  } finally {
    delete process.env.DAO_MODE_FUSION_FILE;
    delete process.env.DAO_MODE_CONTRACT_FILE;
    delete require.cache[require.resolve(path.join(CASCADE, "mode-fusion.js"))];
  }
});

// REARCH2 · Proxy Pro 面板模式区: mf-state/mf-set 双层切换入口在独立面板,
// 不进 Cascade 对话面板(对话面板零管理入口护栏不破)。
test("proxy-pro 面板含 3×4 模式切换且 Cascade 不含", () => {
  const panel = fs.readFileSync(path.join(CASCADE, "proxy-pro-panel.js"), "utf8");
  assert.ok(panel.includes('require("./mode-fusion")'));
  assert.ok(panel.includes("mf-state") && panel.includes("mf-set"));
  assert.ok(panel.includes("3×4"), "面板应标示 3×4=12 模式矩阵");
  const cascade = fs.readFileSync(path.join(CASCADE, "panel.js"), "utf8");
  assert.ok(!cascade.includes("mf-set"), "Cascade 对话面板不得含模式管理入口");
});

// v1.2.4 · LS 端口活性裁决护栏: 宿主 IDE 退出后落盘 host 态仍留旧端口/CSRF ——
// probeAlive TCP 探活为唯一「就绪」裁决, 三处消费(归一 engines/快照 lsReady/面板 env)皆经之。
test("LS 活性探测: 死端口不得呈「陈旧就绪」", async () => {
  const ls = require(path.join(CASCADE, "ls-bridge.js"));
  assert.strictEqual(typeof ls.probeAlive, "function");
  assert.strictEqual(typeof ls.aliveSync, "function");
  const uni = fs.readFileSync(path.join(CASCADE, "unified-panel.js"), "utf8");
  assert.ok(uni.includes("probeAlive"), "归一 engines 就绪应经探活裁决");
  assert.ok(uni.includes("aliveSync"), "快照 lsReady 应经探活裁决");
  const pan = fs.readFileSync(path.join(CASCADE, "panel.js"), "utf8");
  assert.ok(pan.includes("probeAlive"), "面板 env 就绪应经探活裁决");
  // 真探测: 起一个临时 TCP 服务 → 活; 关掉 → 死(经 DAO_WINDSURF_HOST_FILE 指向临时 host 态)
  const net = require("net");
  const os = require("os");
  const tmp = path.join(os.tmpdir(), "dao-alive-test-" + process.pid + ".json");
  const srv = net.createServer(() => {});
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const port = srv.address().port;
  fs.writeFileSync(tmp, JSON.stringify({ lsPort: port, csrfToken: "t", at: Date.now() }));
  const prev = process.env.DAO_WINDSURF_HOST_FILE;
  process.env.DAO_WINDSURF_HOST_FILE = tmp;
  const prevHost = globalThis.__daoWindsurfHost; // 全进程单例可能被前序测试污染, 暂换
  delete globalThis.__daoWindsurfHost;
  try {
    delete require.cache[require.resolve(path.join(CASCADE, "ls-bridge.js"))];
    delete require.cache[require.resolve(path.join(CASCADE, "host-state.js"))];
    const ls2 = require(path.join(CASCADE, "ls-bridge.js"));
    if (ls2.ready()) {
      assert.strictEqual(await ls2.probeAlive(), true, "活端口应判活");
      await new Promise((r) => srv.close(r));
      assert.strictEqual(await ls2.probeAlive(1000), true, "5s 短缓存内仍判活(设计如此)");
      await new Promise((r) => setTimeout(r, 5100));
      assert.strictEqual(await ls2.probeAlive(1000), false, "缓存过期后死端口必须判死");
    } else {
      await new Promise((r) => srv.close(r));
    }
  } finally {
    if (prev === undefined) delete process.env.DAO_WINDSURF_HOST_FILE; else process.env.DAO_WINDSURF_HOST_FILE = prev;
    if (prevHost === undefined) delete globalThis.__daoWindsurfHost; else globalThis.__daoWindsurfHost = prevHost;
    try { fs.unlinkSync(tmp); } catch (_) {}
    delete require.cache[require.resolve(path.join(CASCADE, "ls-bridge.js"))];
    delete require.cache[require.resolve(path.join(CASCADE, "host-state.js"))];
  }
});

// R146 · 导入同步纯核(官方 import 系列对等): JSONC 宽容解析 + 并入不覆盖 + 扩展清单过滤。
test("import-sync: mergeSettings 并入不覆盖 + vscodeExtensionIds 过滤内建", () => {
  const imp = require(path.join(CASCADE, "import-sync.js"));
  // JSONC: 注释与尾逗号
  const src = `{
    // 注释
    "editor.fontSize": 15,
    "a.b": true, /* 块注释 */
  }`;
  const { merged, added } = imp.mergeSettings(src, '{"editor.fontSize": 12}');
  assert.strictEqual(merged["editor.fontSize"], 12, "目标已有键不得被覆盖");
  assert.strictEqual(merged["a.b"], true);
  assert.deepStrictEqual(added, ["a.b"]);
  // 空目标全并入
  const r2 = imp.mergeSettings('{"x":1}', "");
  assert.deepStrictEqual(r2.merged, { x: 1 });
  // 扩展清单: 去重 + 排除 codeium/windsurf/devin 内建冲突
  const ids = imp.vscodeExtensionIds(JSON.stringify([
    { identifier: { id: "ms-python.python" } },
    { identifier: { id: "Codeium.codeium" } },
    { identifier: { id: "devin.dao-one" } },
    { identifier: { id: "ms-python.python" } },
    { identifier: { id: "esbenp.prettier-vscode" } },
  ]));
  assert.deepStrictEqual(ids, ["ms-python.python", "esbenp.prettier-vscode"]);
  // 坏输入不抛
  assert.deepStrictEqual(imp.vscodeExtensionIds("not json"), []);
});

// R146 · seat 桥契约: ls-bridge 暴露 seatCall/devinSessionToken(云端 SeatManagement 直连)。
test("ls-bridge: seatCall/devinSessionToken 契约在位", () => {
  const ls = require(path.join(CASCADE, "ls-bridge.js"));
  assert.strictEqual(typeof ls.seatCall, "function");
  assert.strictEqual(typeof ls.devinSessionToken, "function");
  const uni = fs.readFileSync(path.join(CASCADE, "unified-panel.js"), "utf8");
  for (const k of ["set-copy-key", "set-devin-token", "set-restart-ls", "set-diag", "set-import"]) {
    assert.ok(uni.includes('"' + k + '"'), "设置板块应挂载 " + k);
  }
  assert.ok(uni.includes("import-sync"), "导入应走 import-sync 纯核");
  assert.ok(uni.includes("sourcePath"), "ImportFromCursor 必须携带官方必填 sourcePath");
});
