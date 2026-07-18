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
const ROOT = path.join(__dirname, "..");

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
// (账号分身/桌面/模式/工具层); 另设独立「Windows 管理」板块(与主页同源 renderWinControl)。
test("unified-panel 主页即 Windows 总控 + 独立 Windows 管理板块", () => {
  const src = fs.readFileSync(path.join(CASCADE, "unified-panel.js"), "utf8");
  assert.ok(src.includes("主页 · Windows 总控"), "主页应为 Windows 总控");
  assert.ok(src.includes('["windows","🪟","Windows 管理"]'), "BOARDS 应含 🪟 Windows 管理板块");
  assert.ok(src.includes("renderWindows"), "Windows 管理板块应有独立渲染(同源 renderWinControl)");
  assert.ok(src.includes('case "windows": return this._winState()'), "windows 板块懒加载应直达 win-state");
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

// 模式融合 4×4=16: 提示词层(官方/道德经/阴符经/二经合 → /origin/mode × /origin/canon) ×
// 工具层(默认/Windows/FreeCAD/KiCad → /origin/tools + ModeManager 桥模式),
// 落盘隔离于临时目录, 工具层契约与 ~/.dao/mode.json 同形(mode 字段=桥模式 id)。
test("mode-fusion 4×4=16 矩阵与双层落盘契约", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dao-mf-"));
  process.env.DAO_MODE_FUSION_FILE = path.join(tmp, "mode-fusion.json");
  process.env.DAO_MODE_CONTRACT_FILE = path.join(tmp, "mode.json");
  try {
    delete require.cache[require.resolve(path.join(CASCADE, "mode-fusion.js"))];
    const mf = require(path.join(CASCADE, "mode-fusion.js"));
    assert.strictEqual(mf.PROMPT_MODES.length, 4);
    assert.strictEqual(mf.TOOL_MODES.length, 4);
    assert.strictEqual(mf.matrix().length, 16);
    assert.deepStrictEqual(mf.PROMPT_MODES.map((m) => m.id), ["official", "daodejing", "yinfujing", "daoyin"]);
    assert.deepStrictEqual(mf.TOOL_MODES.map((m) => m.id), ["default", "windows", "freecad", "kicad"]);
    // 提示词层各模式均映射本源引擎(/origin/mode × /origin/canon)
    assert.deepStrictEqual(mf.PROMPT_MODES.map((m) => m.origin.mode), ["passthrough", "invert", "invert", "invert"]);
    assert.deepStrictEqual(mf.PROMPT_MODES.slice(1).map((m) => m.origin.canon), ["laozi", "yinfu", "laozi+yinfu"]);
    // 工具层各模式均映射工具契约轴(/origin/tools) + 桥模式 id
    assert.deepStrictEqual(mf.TOOL_MODES.map((m) => m.tools), ["official", "windows", "freecad", "kicad"]);
    assert.deepStrictEqual(mf.TOOL_MODES.map((m) => m.bridge), ["primary", "windows", "domain:freecad", "domain:kicad"]);
    // 默认态: 本源 二经合 × 默认
    let st = mf.state();
    assert.strictEqual(st.combined, "daoyin+default");
    assert.strictEqual(st.total, 16);
    // 切提示词层
    st = mf.setPromptMode("official");
    assert.strictEqual(st.prompt, "official");
    st = mf.setPromptMode("yinfujing");
    assert.strictEqual(st.prompt, "yinfujing");
    // 切工具层 → 契约文件与 ModeManager 同形(mode 字段=桥模式 id)
    st = mf.setToolMode("windows");
    assert.strictEqual(st.tool, "windows");
    const contract = JSON.parse(fs.readFileSync(process.env.DAO_MODE_CONTRACT_FILE, "utf8"));
    assert.strictEqual(contract.mode, "windows");
    assert.strictEqual(contract.set_by, "dao-desktop");
    // 域模式写桥 domain: id
    st = mf.setToolMode("freecad");
    assert.strictEqual(st.tool, "freecad");
    assert.strictEqual(JSON.parse(fs.readFileSync(process.env.DAO_MODE_CONTRACT_FILE, "utf8")).mode, "domain:freecad");
    // merge 写: ModeManager 自持字段(overlay/tool_policy/replace_official)不可被覆没
    fs.writeFileSync(process.env.DAO_MODE_CONTRACT_FILE, JSON.stringify({
      mode: "primary", overlay: "o1", tool_policy: { p: 1 }, replace_official: true,
    }));
    st = mf.setToolMode("kicad");
    const merged = JSON.parse(fs.readFileSync(process.env.DAO_MODE_CONTRACT_FILE, "utf8"));
    assert.strictEqual(merged.mode, "domain:kicad");
    assert.strictEqual(merged.overlay, "o1");
    assert.deepStrictEqual(merged.tool_policy, { p: 1 });
    assert.strictEqual(merged.replace_official, true);
    // 旧态迁移: 旧提示词 id 与旧契约 mode 自动映射新轴
    fs.writeFileSync(process.env.DAO_MODE_FUSION_FILE, JSON.stringify({ prompt: "invert" }));
    fs.writeFileSync(process.env.DAO_MODE_CONTRACT_FILE, JSON.stringify({ mode: "coding" }));
    st = mf.state();
    assert.strictEqual(st.prompt, "daoyin");
    assert.strictEqual(st.tool, "default");
    fs.writeFileSync(process.env.DAO_MODE_FUSION_FILE, JSON.stringify({ prompt: "passthrough" }));
    fs.writeFileSync(process.env.DAO_MODE_CONTRACT_FILE, JSON.stringify({ mode: "domain:kicad" }));
    st = mf.state();
    assert.strictEqual(st.prompt, "official");
    assert.strictEqual(st.tool, "kicad");
    // 自定经文仍在(与四模式正交, 经 /origin/custom_sp 接管替换文本)
    assert.strictEqual(typeof mf.setCustomText, "function");
    assert.strictEqual(typeof mf.clearCustomText, "function");
    assert.strictEqual(typeof mf.syncOriginTools, "function");
    const mfSrc = fs.readFileSync(path.join(CASCADE, "mode-fusion.js"), "utf8");
    assert.ok(mfSrc.includes("/origin/canon"), "提示词层应热切反代经藏接口");
    assert.ok(mfSrc.includes("/origin/tools"), "工具层应热切反代工具契约接口");
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
test("proxy-pro 面板含 4×4 模式切换且 Cascade 不含", () => {
  const panel = fs.readFileSync(path.join(CASCADE, "proxy-pro-panel.js"), "utf8");
  assert.ok(panel.includes('require("./mode-fusion")'));
  assert.ok(panel.includes("mf-state") && panel.includes("mf-set"));
  assert.ok(panel.includes("4×4"), "面板应标示 4×4=16 模式矩阵");
  assert.ok(panel.includes("syncOriginTools"), "工具层切换应热切反代工具契约");
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

// R147 · 内置浏览器站内代理纯核: HTML 剥封锁头 + 注入 base/拦截 + token/URL 校验。
test("web-embed: 站内代理注入与校验契约", async () => {
  const we = require(path.join(CASCADE, "web-embed.js"));
  assert.strictEqual(typeof we.handle, "function");
  assert.strictEqual(we.isHttpUrl("https://x.y/z"), true);
  assert.strictEqual(we.isHttpUrl("javascript:alert(1)"), false);
  assert.strictEqual(we.isHttpUrl("ftp://a"), false);
  const s = we.interceptScript("/web?t=TT&u=");
  assert.ok(s.includes("/web?t=TT&u=") && s.includes("addEventListener"));
  // 起真服务器: 缺 token → 401, 坏 u → 400
  const http = require("http");
  const srv = http.createServer((req, res) => { if (!we.handle(req, res, "SEK")) { res.writeHead(404); res.end(); } });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const port = srv.address().port;
  const get = (p) => new Promise((rs) => http.get({ host: "127.0.0.1", port, path: p }, (r) => { r.resume(); rs(r.statusCode); }));
  assert.strictEqual(await get("/web?u=https%3A%2F%2Fx.y"), 401);
  assert.strictEqual(await get("/web?t=SEK&u=javascript:1"), 400);
  await new Promise((r) => srv.close(r));
});

// R147 · unified panel: 内置浏览器板块 + 官方菜单命令对等接线在位。
test("unified-panel: 浏览器板块与官方菜单命令对等在位", () => {
  const uni = fs.readFileSync(path.join(CASCADE, "unified-panel.js"), "utf8");
  assert.ok(uni.includes('"browser"') && uni.includes("web-state") && uni.includes("_webState"), "内置浏览器板块应接线");
  const lapi = fs.readFileSync(path.join(CASCADE, "local-api.js"), "utf8");
  assert.ok(lapi.includes("web-embed"), "local-api 应挂载 web-embed 站内代理");
  for (const k of ["set-cmd", "devin-settings", "sign-out", "open-cascade", "create-skill", "create-workflow", "mcp-config"]) {
    assert.ok(uni.includes(k), "官方菜单对等应含 " + k);
  }
  assert.ok(uni.includes("devin.openQuickSettingsPanel") && uni.includes("windsurf.openQuickSettingsPanel"), "命令应 devin.* 优先 windsurf.* 回退");
});

// R147 · 实机 P0 回归防护: webview 脚本经模板字面量下发, 求值后必须仍是合法 JS
// (曾因正则 \/ 在模板里被吃掉 → 下发脚本 SyntaxError → 面板永卡"加载中")。
test("unified-panel: webview 下发脚本求值后语法合法 + 浏览器板块与 state 解耦", () => {
  const src = fs.readFileSync(path.join(CASCADE, "unified-panel.js"), "utf8");
  const tplStart = src.indexOf("return `<!DOCTYPE");
  assert.ok(tplStart > 0, "应有 webview HTML 模板");
  const tpl = src.slice(tplStart + 8, src.lastIndexOf("`;"));
  // 按模板字面量语义求值(${n} 代入), 提取 <script> 体做真语法检查
  const html = new Function("n", "csp", "return `" + tpl.slice(1) + "`;")("NONCE", "CSP");
  const m = /<script[^>]*>([\s\S]*?)<\/script>/.exec(html);
  assert.ok(m, "应含内联脚本");
  assert.doesNotThrow(() => new Function(m[1]), "下发脚本必须语法合法(模板转义坑防护)");
  // 浏览器板块解耦: render() 对已建 iframe 必须短路, 不得整树重建
  assert.ok(m[1].includes("webFrame") && /board==='browser'[^\n]*webFrame[^\n]*\)return/.test(m[1]), "browser 板块应与 state 推送解耦(iframe 只建一次)");
});

// R149 · PCB 工具层官方同构注册: dao-pcb 与 dao-windows-agent 同一 mcp_config.json 真源,
// local(stdio pcb_mcp.py) / remote(serverUrl /mcp + Bearer) 双通道; status 脱敏不回 token;
// setDisabled 开关不删注册(关 = 工具仍在册, LS 不注入描述)。
test("pcb-agent: dao-pcb MCP 官方同构注册契约", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dao-pcb-"));
  process.env.DAO_MCP_CONFIG_FILE = path.join(tmp, "mcp_config.json");
  try {
    delete require.cache[require.resolve(path.join(CASCADE, "pcb-agent.js"))];
    delete require.cache[require.resolve(path.join(CASCADE, "mcp-config.js"))];
    const pa = require(path.join(CASCADE, "pcb-agent.js"));
    assert.strictEqual(pa.SERVER_NAME, "dao-pcb");
    // 未注册态
    assert.deepStrictEqual(pa.status(), { registered: false });
    // 显式目录无效 = 权威失败, 不回退猜测(误配须可见)
    assert.strictEqual(pa.findLocalCheckout(path.join(tmp, "nope")), null);
    // local: 伪造检出(pcb_brain/pcb_mcp.py)
    const co = path.join(tmp, "Dao-PCB-Design-Agent");
    fs.mkdirSync(path.join(co, "pcb_brain"), { recursive: true });
    fs.writeFileSync(path.join(co, "pcb_brain", "pcb_mcp.py"), "# mcp\n");
    let r = pa.registerLocal({ dir: co, token: "SECRET-T", kicadPort: "9931", lcedaPort: "9940" });
    assert.strictEqual(r.ok, true);
    const cfg = JSON.parse(fs.readFileSync(process.env.DAO_MCP_CONFIG_FILE, "utf8"));
    const spec = cfg.mcpServers["dao-pcb"];
    assert.ok(spec.args.join("/").includes("pcb_mcp.py"));
    assert.strictEqual(spec.cwd, co);
    assert.strictEqual(spec.env.DAO_KICAD_PORT, "9931");
    assert.strictEqual(spec.env.LCEDA_BRIDGE_PORT, "9940");
    // status 脱敏: 只报 hasAuth, 不回 token 值
    let st = pa.status();
    assert.strictEqual(st.registered, true);
    assert.strictEqual(st.transport, "local");
    assert.strictEqual(st.hasAuth, true);
    assert.ok(!JSON.stringify(st).includes("SECRET-T"));
    // 开关不删注册
    assert.strictEqual(pa.setDisabled(true).ok, true);
    st = pa.status();
    assert.strictEqual(st.registered, true);
    assert.strictEqual(st.disabled, true);
    assert.strictEqual(pa.setDisabled(false).ok, true);
    assert.strictEqual(pa.status().disabled, false);
    // remote: 自动补 /mcp + Bearer
    r = pa.registerRemote({ url: "https://relay.example.com/", token: "TK" });
    assert.strictEqual(r.ok, true);
    st = pa.status();
    assert.strictEqual(st.transport, "remote");
    assert.strictEqual(st.serverUrl, "https://relay.example.com/mcp");
    assert.strictEqual(st.hasAuth, true);
    assert.strictEqual(pa.registerRemote({ url: "ftp://bad" }).ok, false);
    // 注销
    assert.strictEqual(pa.unregister().removed, true);
    assert.deepStrictEqual(pa.status(), { registered: false });
    // modePrompt: 太上下知有之 —— 只述工具之有, 不教用法不强制流程
    const mp = pa.modePrompt();
    assert.ok(mp.includes("dao-pcb") && mp.includes("KiCad") && mp.includes("嘉立创EDA"));
    assert.ok(mp.includes("pcb_check") && mp.includes("pcb_design") && mp.includes("pcb_call"));
  } finally {
    delete process.env.DAO_MCP_CONFIG_FILE;
    delete require.cache[require.resolve(path.join(CASCADE, "pcb-agent.js"))];
    delete require.cache[require.resolve(path.join(CASCADE, "mcp-config.js"))];
  }
});

// R149 · pcb-panel-core headless: 模块目录(web 多实例路由 + app 原生编辑器)、
// 聚合探活字段与双桥/CDP 端点约定(9931/9940/9222, 环境变量可重定向)。
test("pcb-panel-core: 模块目录与探活契约", async () => {
  const pc = require(path.join(CASCADE, "pcb-panel-core.js"));
  const mods = pc.modules();
  assert.ok(mods.length >= 10);
  for (const m of mods) {
    assert.ok(m.id && m.name && (m.kind === "web" || m.kind === "app"));
    if (m.kind === "web") assert.ok(/^https:\/\//.test(m.url), m.id + " web 模块须为 https 官方页");
    else assert.ok(m.exe, m.id + " app 模块须有 exe 键");
  }
  // 官方各分编辑器齐备(原理图/符号/PCB/Gerber/计算器 + 嘉立创EDA)
  const ids = mods.map((m) => m.id);
  for (const k of ["kicad-main", "kicad-sch", "kicad-pcb", "kicad-gerber", "kicad-calc", "eda-app", "lceda-home", "lceda-editor"]) {
    assert.ok(ids.includes(k), "模块目录应含 " + k);
  }
  assert.strictEqual(pc.kicadBridgeBase(), "http://127.0.0.1:9931");
  assert.strictEqual(pc.lcedaBridgeBase(), "http://127.0.0.1:9940");
  assert.strictEqual(pc.edaCdpBase(), "http://127.0.0.1:9222");
  // probe: 任一子源不可达不拖垮整体(CI 无桥环境也得回完整快照)
  const out = await pc.probe();
  for (const k of ["mcp", "installs", "kicadBridge", "lcedaBridge", "cdp", "modules", "probedAt"]) {
    assert.ok(k in out, "probe 快照应含 " + k);
  }
  assert.ok("kicad" in out.installs && "easyeda" in out.installs);
});

// R149 · PCB 域开关正交于 3×4 模式矩阵: overlays 独立落盘, 默认全关(官方原貌);
// 开启后 overlayPrompt 并入 pcb-agent modePrompt; 矩阵与三/四模式全然不变。
test("mode-fusion: PCB 域叠加开关正交契约", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dao-mfo-"));
  process.env.DAO_MODE_FUSION_FILE = path.join(tmp, "mode-fusion.json");
  process.env.DAO_MODE_CONTRACT_FILE = path.join(tmp, "mode.json");
  try {
    delete require.cache[require.resolve(path.join(CASCADE, "mode-fusion.js"))];
    const mf = require(path.join(CASCADE, "mode-fusion.js"));
    // 矩阵不变: 域开关不是额外模式
    assert.strictEqual(mf.PROMPT_MODES.length, 4);
    assert.strictEqual(mf.TOOL_MODES.length, 4);
    assert.strictEqual(mf.matrix().length, 16);
    assert.ok(mf.DOMAIN_OVERLAYS.some((m) => m.id === "pcb"));
    // 默认关(官方原貌)
    assert.strictEqual(mf.overlayOn("pcb"), false);
    assert.strictEqual(mf.overlayPrompt(), "");
    // 开: overlayPrompt 即 pcb-agent modePrompt
    const st = mf.setOverlay("pcb", true);
    assert.strictEqual(mf.overlayOn("pcb"), true);
    assert.ok(st.overlays.find((o) => o.id === "pcb").on);
    assert.ok(mf.overlayPrompt().includes("dao-pcb"));
    // 与提示词模式正交: 切提示词模式不动开关
    mf.setPromptMode("official");
    assert.strictEqual(mf.overlayOn("pcb"), true);
    // 关: 回官方原貌
    mf.setOverlay("pcb", false);
    assert.strictEqual(mf.overlayOn("pcb"), false);
    assert.throws(() => mf.setOverlay("nope", true));
  } finally {
    delete process.env.DAO_MODE_FUSION_FILE;
    delete process.env.DAO_MODE_CONTRACT_FILE;
    delete require.cache[require.resolve(path.join(CASCADE, "mode-fusion.js"))];
  }
});

// R149 · 面板接线护栏: 归一面板主页 PCB 环境卡 + ⚡ PCB 板块 + 多实例路由;
// Proxy Pro 面板域叠加开关按钮; Cascade 面板 pcbAgent 快速命令; 开关真生效于 MCP disabled。
test("PCB 面板/板块/命令接线在位", () => {
  const uni = fs.readFileSync(path.join(CASCADE, "unified-panel.js"), "utf8");
  assert.ok(uni.includes('["pcb","⚡"'), "BOARDS 应含 ⚡ PCB 板块");
  assert.ok(uni.includes("renderPcbHomeCard"), "主页应含 PCB 环境卡");
  assert.ok(uni.includes("renderPcb") && uni.includes("pcb-state"), "PCB 板块应接线");
  for (const k of ["pcb-reg-local", "pcb-reg-remote", "pcb-unreg", "pcb-open", "pcb-overlay"]) {
    assert.ok(uni.includes(k), "unified-panel 应接线 " + k);
  }
  assert.ok(uni.includes('require("./pcb-panel-core")') && uni.includes('require("./pcb-agent")'));
  // web 模块多实例路由: 与内置浏览器同一站内代理(/web?t=&u=), 每开一次一个独立 webview
  assert.ok(uni.includes("dao.pcb.module"), "web 模块应开独立 webview 实例");
  const px = fs.readFileSync(path.join(CASCADE, "proxy-pro-panel.js"), "utf8");
  assert.ok(px.includes("mf-overlay") && px.includes("setOverlay"), "Proxy Pro 面板应有域叠加开关");
  assert.ok(px.includes("setDisabled"), "开关应真生效于 dao-pcb MCP disabled(官方注入路径)");
  const cas = fs.readFileSync(path.join(CASCADE, "panel.js"), "utf8");
  assert.ok(cas.includes(".pcbAgent"), "Cascade 应注册 pcbAgent 快速命令");
  assert.ok(!cas.includes("mf-set"), "Cascade 对话面板仍不得含模式管理入口");
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));
  assert.ok(pkg.contributes.commands.some((c) => c.command === "dao.cascade.pcbAgent"));
});

// R150 · FreeCAD 工具层官方同构注册: dao-freecad 与 dao-pcb/dao-windows-agent 同一
// mcp_config.json 真源, local(stdio cad_agent.mcp_server) / remote(serverUrl /mcp + Bearer)
// 双通道; status 脱敏; setDisabled 开关不删注册。
test("fc-agent: dao-freecad MCP 官方同构注册契约", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dao-fc-"));
  process.env.DAO_MCP_CONFIG_FILE = path.join(tmp, "mcp_config.json");
  try {
    delete require.cache[require.resolve(path.join(CASCADE, "fc-agent.js"))];
    delete require.cache[require.resolve(path.join(CASCADE, "mcp-config.js"))];
    const fa = require(path.join(CASCADE, "fc-agent.js"));
    assert.strictEqual(fa.SERVER_NAME, "dao-freecad");
    assert.deepStrictEqual(fa.status(), { registered: false });
    // 显式目录无效 = 权威失败, 不回退猜测(误配须可见)
    assert.strictEqual(fa.findLocalCheckout(path.join(tmp, "nope")), null);
    // local: 伪造检出(cad_agent/mcp_server.py)
    const co = path.join(tmp, "Dao-3D-Modeling-Agent");
    fs.mkdirSync(path.join(co, "cad_agent"), { recursive: true });
    fs.writeFileSync(path.join(co, "cad_agent", "mcp_server.py"), "# mcp\n");
    let r = fa.registerLocal({ dir: co, token: "SECRET-T", bridgePort: "18920" });
    assert.strictEqual(r.ok, true);
    const cfg = JSON.parse(fs.readFileSync(process.env.DAO_MCP_CONFIG_FILE, "utf8"));
    const spec = cfg.mcpServers["dao-freecad"];
    assert.deepStrictEqual(spec.args, ["-m", "cad_agent.mcp_server"]);
    assert.strictEqual(spec.cwd, co);
    assert.strictEqual(spec.env.PYTHONPATH, co);
    assert.strictEqual(spec.env.FC_REMOTE_PORT, "18920");
    // status 脱敏: 只报 hasAuth, 不回 token 值
    let st = fa.status();
    assert.strictEqual(st.registered, true);
    assert.strictEqual(st.transport, "local");
    assert.strictEqual(st.hasAuth, true);
    assert.ok(!JSON.stringify(st).includes("SECRET-T"));
    // 开关不删注册
    assert.strictEqual(fa.setDisabled(true).ok, true);
    st = fa.status();
    assert.strictEqual(st.registered, true);
    assert.strictEqual(st.disabled, true);
    assert.strictEqual(fa.setDisabled(false).ok, true);
    assert.strictEqual(fa.status().disabled, false);
    // remote: 自动补 /mcp + Bearer
    r = fa.registerRemote({ url: "https://relay.example.com/", token: "TK" });
    assert.strictEqual(r.ok, true);
    st = fa.status();
    assert.strictEqual(st.transport, "remote");
    assert.strictEqual(st.serverUrl, "https://relay.example.com/mcp");
    assert.strictEqual(st.hasAuth, true);
    assert.strictEqual(fa.registerRemote({ url: "ftp://bad" }).ok, false);
    // 注销
    assert.strictEqual(fa.unregister().removed, true);
    assert.deepStrictEqual(fa.status(), { registered: false });
    // modePrompt: 太上下知有之 —— 只述工具之有, 不教用法不强制流程
    const mp = fa.modePrompt();
    assert.ok(mp.includes("dao-freecad") && mp.includes("FreeCAD"));
    assert.ok(mp.includes("asm.") && mp.includes("percept.") && mp.includes("18920"));
  } finally {
    delete process.env.DAO_MCP_CONFIG_FILE;
    delete require.cache[require.resolve(path.join(CASCADE, "fc-agent.js"))];
    delete require.cache[require.resolve(path.join(CASCADE, "mcp-config.js"))];
  }
});

// R150 · fc-panel-core headless: 模块目录(归一外壳网页多实例 + 本机 FreeCAD)、
// 聚合探活字段与桥/外壳/xpra 端点约定(18920/9920/14500, 环境变量可重定向)。
test("fc-panel-core: 模块目录与探活契约", async () => {
  const fc = require(path.join(CASCADE, "fc-panel-core.js"));
  const mods = fc.modules();
  assert.ok(mods.length >= 10);
  for (const m of mods) {
    assert.ok(m.id && m.name && (m.kind === "web" || m.kind === "app"));
    if (m.kind === "web") assert.ok(/^http:\/\/127\.0\.0\.1/.test(m.url), m.id + " web 模块须为归一外壳本机页");
    else assert.ok(m.exe, m.id + " app 模块须有 exe 键");
  }
  // 归一外壳全板块齐备(总控/整窗/工作台 + 七大 FreeCAD 工作台网页模块 + 本机客户端)
  const ids = mods.map((m) => m.id);
  for (const k of ["fc-shell", "fc-window", "fc-bench", "fc-part", "fc-sketch", "fc-asm", "fc-bim", "fc-fem", "fc-draw", "fc-cam", "fc-app"]) {
    assert.ok(ids.includes(k), "模块目录应含 " + k);
  }
  assert.strictEqual(fc.bridgeBase(), "http://127.0.0.1:18920");
  assert.strictEqual(fc.shellBase(), "http://127.0.0.1:9920");
  assert.strictEqual(fc.xpraBase(), "http://127.0.0.1:14500");
  // probe: 任一子源不可达不拖垮整体(CI 无桥环境也得回完整快照)
  const out = await fc.probe();
  for (const k of ["mcp", "installs", "bridge", "shell", "xpra", "modules", "probedAt"]) {
    assert.ok(k in out, "probe 快照应含 " + k);
  }
  assert.ok("freecad" in out.installs);
});

// R150 · FreeCAD 域开关正交于 3×4 模式矩阵: 与 pcb 同一 overlays 落盘, 默认关(官方原貌);
// 开启后 overlayPrompt 并入 fc-agent modePrompt; 与 pcb 域互不干扰。
test("mode-fusion: FreeCAD 域叠加开关正交契约", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dao-mfo-fc-"));
  process.env.DAO_MODE_FUSION_FILE = path.join(tmp, "mode-fusion.json");
  process.env.DAO_MODE_CONTRACT_FILE = path.join(tmp, "mode.json");
  try {
    delete require.cache[require.resolve(path.join(CASCADE, "mode-fusion.js"))];
    const mf = require(path.join(CASCADE, "mode-fusion.js"));
    // 矩阵不变: 域开关不是额外模式
    assert.strictEqual(mf.PROMPT_MODES.length, 4);
    assert.strictEqual(mf.TOOL_MODES.length, 4);
    assert.strictEqual(mf.matrix().length, 16);
    assert.ok(mf.DOMAIN_OVERLAYS.some((m) => m.id === "freecad"));
    // 默认关(官方原貌)
    assert.strictEqual(mf.overlayOn("freecad"), false);
    assert.strictEqual(mf.overlayPrompt(), "");
    // 开: overlayPrompt 即 fc-agent modePrompt
    const st = mf.setOverlay("freecad", true);
    assert.strictEqual(mf.overlayOn("freecad"), true);
    assert.ok(st.overlays.find((o) => o.id === "freecad").on);
    assert.ok(mf.overlayPrompt().includes("dao-freecad"));
    // 与 pcb 域互不干扰
    assert.strictEqual(mf.overlayOn("pcb"), false);
    mf.setOverlay("pcb", true);
    assert.ok(mf.overlayPrompt().includes("dao-pcb") && mf.overlayPrompt().includes("dao-freecad"));
    mf.setOverlay("pcb", false);
    // 与提示词模式正交: 切提示词模式不动开关
    mf.setPromptMode("official");
    assert.strictEqual(mf.overlayOn("freecad"), true);
    // 关: 回官方原貌
    mf.setOverlay("freecad", false);
    assert.strictEqual(mf.overlayOn("freecad"), false);
  } finally {
    delete process.env.DAO_MODE_FUSION_FILE;
    delete process.env.DAO_MODE_CONTRACT_FILE;
    delete require.cache[require.resolve(path.join(CASCADE, "mode-fusion.js"))];
  }
});

// R150 · 面板接线护栏: 归一面板主页 FreeCAD 环境卡 + 🧊 FreeCAD 板块 + 多实例路由;
// Proxy Pro 面板域叠加真生效于 fc-agent; Cascade 面板 fcAgent 快速命令。
test("FreeCAD 面板/板块/命令接线在位", () => {
  const uni = fs.readFileSync(path.join(CASCADE, "unified-panel.js"), "utf8");
  assert.ok(uni.includes('["freecad","🧊"'), "BOARDS 应含 🧊 FreeCAD 板块");
  assert.ok(uni.includes("renderFcHomeCard"), "主页应含 FreeCAD 环境卡");
  assert.ok(uni.includes("renderFreecad") && uni.includes("fc-state"), "FreeCAD 板块应接线");
  for (const k of ["fc-reg-local", "fc-reg-remote", "fc-unreg", "fc-open", "fc-overlay"]) {
    assert.ok(uni.includes(k), "unified-panel 应接线 " + k);
  }
  assert.ok(uni.includes('require("./fc-panel-core")') && uni.includes('require("./fc-agent")'));
  assert.ok(uni.includes("dao.fc.module"), "web 模块应开独立 webview 实例");
  const px = fs.readFileSync(path.join(CASCADE, "proxy-pro-panel.js"), "utf8");
  assert.ok(px.includes("./fc-agent"), "Proxy Pro 域叠加应真生效于 dao-freecad MCP disabled");
  const cas = fs.readFileSync(path.join(CASCADE, "panel.js"), "utf8");
  assert.ok(cas.includes(".fcAgent"), "Cascade 应注册 fcAgent 快速命令");
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));
  assert.ok(pkg.contributes.commands.some((c) => c.command === "dao.cascade.fcAgent"));
});

// R148 · 设置板块「团队/组织控制」卡: GetTeamOrganizationalControls 活体接线(本 VM 实证可达)。
test("unified-panel: 团队/组织控制卡(GetTeamOrganizationalControls)接线在位", () => {
  const uni = fs.readFileSync(path.join(CASCADE, "unified-panel.js"), "utf8");
  assert.ok(uni.includes("GetTeamOrganizationalControls"), "宿主应活体拉取 GetTeamOrganizationalControls");
  assert.ok(uni.includes("orgControls"), "set-detail 应透出 orgControls");
  assert.ok(uni.includes("团队/组织控制"), "设置板块应渲染团队/组织控制卡");
  assert.ok(uni.includes("extensionModelLabels") && uni.includes("subagentDefaultModelUid"), "已知字段显式呈现, 未知字段兜底遍历");
});

// R151 · LS 自持启动(独立宿主兜底): 无官方 LS 在跑时 ls-boot 自持拉起同源 LS;
// host-discover 轮询与 ls-bridge.refreshAuth 均接线该兜底; deactivate 收尾杀子进程。
test("ls-boot: 独立宿主自持 LS 兜底接线在位", () => {
  const boot = fs.readFileSync(path.join(CASCADE, "ls-boot.js"), "utf8");
  assert.ok(boot.includes("--random_port_dir"), "端口经 random_port_dir 落盘回读");
  assert.ok(boot.includes("WINDSURF_CSRF_TOKEN"), "CSRF 经官方同源环境变量注入");
  assert.ok(boot.includes("apiKeyCandidates"), "登录态复用 ls-bridge 同一来源(credentials.toml/state.vscdb)");
  assert.ok(boot.includes("DAO_NO_LS_BOOT"), "应可经环境变量禁用");
  assert.ok(boot.includes("setWorkspaceDir") && boot.includes("AddTrackedWorkspace"), "自持 LS 绑定真实工作区并注册官方跟踪工作区");
  assert.ok(boot.includes("_portDir") && boot.includes("fs.rmdirSync"), "停止自持 LS 清理临时端口目录");
  const hd = fs.readFileSync(path.join(CASCADE, "host-discover.js"), "utf8");
  assert.ok(hd.includes('require("./ls-boot")'), "轮询发现应接自持兜底");
  const lb = fs.readFileSync(path.join(CASCADE, "ls-bridge.js"), "utf8");
  assert.ok(lb.includes('require("./ls-boot")'), "refreshAuth 应接自持兜底");
  const ext = fs.readFileSync(path.join(__dirname, "..", "extension.js"), "utf8");
  assert.ok(ext.includes('ls-boot").stop()'), "deactivate 应停自持子进程");
  const mod = require(path.join(CASCADE, "ls-boot.js"));
  const prev = process.env.DAO_NO_LS_BOOT;
  process.env.DAO_NO_LS_BOOT = "1";
  return mod.boot({}).then((r) => {
    if (prev === undefined) delete process.env.DAO_NO_LS_BOOT; else process.env.DAO_NO_LS_BOOT = prev;
    assert.equal(r, null, "禁用时返回 null");
  });
});

// R153 · 官方↔插件全资源双向同步: 源同一即双向同源。sync-audit 审计每类资源(MCP/
// 全局 Rules/global_rules.md/Workflows/Skills/记忆)读写同一份官方真源, 并以"写后对侧
// 复读"活体探测证实闭环(向官方真源写唯一标记探针→经另一侧读路径复读→原样还原不留痕)。
test("sync-audit: 全资源真源归一审计, 无割裂", () => {
  const home = os.homedir();
  const sa = require(path.join(CASCADE, "sync-audit.js"));
  const rep = sa.audit();
  assert.deepStrictEqual(rep.diverged, [], "无割裂: 每类资源读写归一到官方同一真源");
  const keys = rep.items.map((i) => i.key).sort();
  assert.deepStrictEqual(keys, ["grules", "grulesmd", "gskills", "gworkflows", "mcp", "memories"].sort(),
    "六类共享资源全覆盖");
  const ws = path.join(home, ".codeium", "windsurf");
  const byKey = Object.fromEntries(rep.items.map((i) => [i.key, i]));
  assert.ok(byKey.mcp.source.endsWith("mcp_config.json"), "MCP 真源=官方 mcp_config.json");
  assert.strictEqual(byKey.grulesmd.source, path.join(ws, "memories", "global_rules.md"));
  assert.strictEqual(byKey.grules.source, path.join(home, ".devin", "rules"));
  assert.strictEqual(byKey.gworkflows.source, path.join(ws, "global_workflows"));
  assert.strictEqual(byKey.gskills.source, path.join(ws, "skills"));
  assert.strictEqual(byKey.memories.source, path.join(ws, "memories"));
  for (const it of rep.items) assert.strictEqual(it.unity, true, it.key + " 应源同一");
});

test("sync-audit: 写后对侧复读活体探测闭环, 探针不留痕", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dao-sync-"));
  const prevHome = process.env.DAO_ENV_SYNC_HOME;
  const prevMcp = process.env.DAO_MCP_CONFIG_FILE;
  process.env.DAO_ENV_SYNC_HOME = tmp;
  process.env.DAO_MCP_CONFIG_FILE = path.join(tmp, ".codeium", "windsurf", "mcp_config.json");
  try {
    delete require.cache[require.resolve(path.join(CASCADE, "sync-audit.js"))];
    delete require.cache[require.resolve(path.join(CASCADE, "mcp-config.js"))];
    const sa = require(path.join(CASCADE, "sync-audit.js"));
    const rt = sa.roundtrip();
    assert.strictEqual(rt.ok, true, "全部资源写后对侧复读闭环成立");
    for (const r of rt.results) {
      assert.ok(r.wrote, r.key + " 应写入官方真源");
      assert.ok(r.readBack, r.key + " 应经另一侧读路径复读到探针");
      assert.ok(r.reverted, r.key + " 应原样还原");
    }
    // 不留痕: 探针标记不得残留在任一真源。
    const leftovers = [];
    const walk = (d) => { let e = []; try { e = fs.readdirSync(d, { withFileTypes: true }); } catch (_) { return; }
      for (const x of e) { const p = path.join(d, x.name);
        if (x.name.includes(sa.PROBE_TAG)) leftovers.push(p);
        if (x.isDirectory()) walk(p);
        else { try { if (fs.readFileSync(p, "utf8").includes(sa.PROBE_TAG)) leftovers.push(p); } catch (_) {} } } };
    walk(tmp);
    assert.deepStrictEqual(leftovers, [], "探测后无任何探针残留");
  } finally {
    prevHome == null ? delete process.env.DAO_ENV_SYNC_HOME : (process.env.DAO_ENV_SYNC_HOME = prevHome);
    prevMcp == null ? delete process.env.DAO_MCP_CONFIG_FILE : (process.env.DAO_MCP_CONFIG_FILE = prevMcp);
    delete require.cache[require.resolve(path.join(CASCADE, "sync-audit.js"))];
    delete require.cache[require.resolve(path.join(CASCADE, "mcp-config.js"))];
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
  }
});

test("local-api: sync-audit 路由接线在位", () => {
  const api = fs.readFileSync(path.join(CASCADE, "local-api.js"), "utf8");
  assert.ok(api.includes('require("./sync-audit")'), "应引入 sync-audit");
  assert.ok(api.includes('u === "/api/sync/audit"'), "应挂 GET /api/sync/audit");
  assert.ok(api.includes('u === "/api/sync/roundtrip"'), "应挂 POST /api/sync/roundtrip");
  const schema = fs.readFileSync(path.join(CASCADE, "api-schema.js"), "utf8");
  assert.ok(schema.includes("/api/sync/audit") && schema.includes("/api/sync/roundtrip"), "openapi 应登记两路由");
});

// R154 · 跨插件数据流通(共存·数据本源流通): 官方引擎落盘真源 = 跨插件数据总线(官方 IDE /
// dao-vsix / dao-one / dao-desktop 源同一即流通); 各插件自持面按文件名/命名空间隔离不串写。
test("coexist.dataFlow: 共享总线成员齐全 + 自持面全部隔离于总线", () => {
  const co = require(path.join(CASCADE, "coexist.js"));
  const flow = co.dataFlow();
  assert.deepStrictEqual(flow.bus.members, ["official-ide", "dao-desktop", "dao-vsix", "dao-one"]);
  assert.ok(flow.shared.length >= 6, "六类官方真源资源全在共享总线");
  for (const s of flow.shared) assert.deepStrictEqual(s.sharedWith, flow.bus.members, s.resource + " 应共享给全成员");
  assert.ok(flow.isolated.length >= 8, "自持面(dao-desktop/dao-vsix/proxy-pro/min)全列出");
  for (const i of flow.isolated) {
    assert.ok(!/\.codeium[\\/]windsurf|\.local[\\/]share[\\/]devin/.test(i.source),
      i.resource + " 自持面不得落官方引擎总线根(不串写): " + i.source);
  }
});

test("coexist.roundtrip: 共享总线写后对侧复读 + 隔离断言全通过", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dao-coflow-"));
  const prevHome = process.env.DAO_ENV_SYNC_HOME;
  const prevMcp = process.env.DAO_MCP_CONFIG_FILE;
  process.env.DAO_ENV_SYNC_HOME = tmp;
  process.env.DAO_MCP_CONFIG_FILE = path.join(tmp, ".codeium", "windsurf", "mcp_config.json");
  try {
    const co = require(path.join(CASCADE, "coexist.js"));
    const rt = co.roundtrip();
    assert.strictEqual(rt.ok, true, "共享面流通 + 自持面隔离均成立");
    assert.strictEqual(rt.sharedFlow.ok, true);
    for (const i of rt.isolation) assert.ok(i.isolatedFromBus, i.resource + " 应隔离于总线");
  } finally {
    prevHome == null ? delete process.env.DAO_ENV_SYNC_HOME : (process.env.DAO_ENV_SYNC_HOME = prevHome);
    prevMcp == null ? delete process.env.DAO_MCP_CONFIG_FILE : (process.env.DAO_MCP_CONFIG_FILE = prevMcp);
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
  }
});

test("local-api: coexist 流通路由接线在位", () => {
  const api = fs.readFileSync(path.join(CASCADE, "local-api.js"), "utf8");
  assert.ok(api.includes('u === "/api/coexist/flow"'), "应挂 GET /api/coexist/flow");
  assert.ok(api.includes('u === "/api/coexist/roundtrip"'), "应挂 POST /api/coexist/roundtrip");
  const schema = fs.readFileSync(path.join(CASCADE, "api-schema.js"), "utf8");
  assert.ok(schema.includes("/api/coexist/flow") && schema.includes("/api/coexist/roundtrip"), "openapi 应登记两路由");
});

// R155 · RPC 层同步活体验证(sync-rpc): 桩 LS 验证探测逻辑(含 proto3 缺省省略语义),
// 真 LS 串测见 GAP-ANALYSIS R155(本 VM 实机已通)。
test("sync-rpc.settingsRoundtrip: proto3 缺省省略下仍正确判定写入与还原", async () => {
  const rpc = require(path.join(CASCADE, "sync-rpc.js"));
  let store = { openMostRecentChatConversation: true };
  const stub = { call: async (m, b) => {
    if (m === "GetUserSettings") {
      const out = {}; // proto3: false 缺省被省略
      for (const [k, v] of Object.entries(store)) if (v) out[k] = v;
      return { userSettings: out };
    }
    if (m === "SetUserSettings") { store = Object.assign({}, (b || {}).userSettings); return { userSettings: {} }; }
    throw new Error("unexpected " + m);
  } };
  const r = await rpc.settingsRoundtrip(stub);
  assert.strictEqual(r.wrote, true, "翻转写入应被判定成功(false 被省略也不误判)");
  assert.strictEqual(r.reverted, true, "还原应被判定成功");
  assert.strictEqual(!!store.openMostRecentChatConversation, true, "桩内状态应还原");
});

test("sync-rpc.customizationRoundtrip: RPC 创建↔文件真源↔列表复读↔删除还原闭环", async () => {
  const rpc = require(path.join(CASCADE, "sync-rpc.js"));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dao-rpcwf-"));
  const files = new Set();
  const stub = { call: async (m, b) => {
    if (m === "CreateCustomizationFile") {
      const p = path.join(tmp, (b || {}).fileName || "x.md");
      fs.writeFileSync(p, ""); files.add(p);
      return { filePath: p };
    }
    if (m === "RefreshCustomization") return {};
    if (m === "GetAllWorkflows") {
      const names = [...files].filter((p) => fs.existsSync(p)).map((p) => path.basename(p));
      return { workflows: names.map((n) => ({ name: n })) };
    }
    throw new Error("unexpected " + m);
  } };
  try {
    const r = await rpc.customizationRoundtrip(stub);
    assert.strictEqual(r.wrote, true, "RPC 创建应落盘(文件真源)");
    assert.strictEqual(r.readBack, true, "刷新后列表应含探针");
    assert.strictEqual(r.reverted, true, "删文件后列表应即失(不留痕)");
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test("local-api: sync-rpc 路由接线在位", () => {
  const api = fs.readFileSync(path.join(CASCADE, "local-api.js"), "utf8");
  assert.ok(api.includes('u === "/api/sync/rpc-roundtrip"'), "应挂 POST /api/sync/rpc-roundtrip");
  const schema = fs.readFileSync(path.join(CASCADE, "api-schema.js"), "utf8");
  assert.ok(schema.includes("/api/sync/rpc-roundtrip"), "openapi 应登记");
});

// R156 · 本地 API 自启(后端打动一切): 激活即开放端点, 不依赖面板按钮手点。
test("extension: 本地 API 激活自启接线在位(dao.localApi.autoStart)", () => {
  const ext = fs.readFileSync(path.join(__dirname, "..", "extension.js"), "utf8");
  assert.ok(ext.includes('get("localApi.autoStart", true)'), "激活流程应读 dao.localApi.autoStart(默认开)");
  assert.ok(/localApi\.running\(\)\)\s*await localApi\.start\(0\)/.test(ext), "未跑则 start(0) 自启");
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));
  assert.ok(pkg.contributes.configuration.properties["dao.localApi.autoStart"], "配置项应登记");
  assert.strictEqual(pkg.contributes.configuration.properties["dao.localApi.autoStart"].default, true);
});

// R157 · 官方操作体系对位: Agent 模式一键互切 + 官方快捷命令组(模型/模式/agent 选择器)。
test("parity: Agent 窗口互切与官方快捷命令组接线在位", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));
  const cmds = pkg.contributes.commands.map((c) => c.command);
  for (const c of ["dao.cascade.toggleAgentWindow", "dao.cascade.toggleModelSelector",
    "dao.cascade.switchToNextModel", "dao.cascade.toggleWriteChatMode", "dao.cascade.openAgentPicker"])
    assert.ok(cmds.includes(c), c + " 应登记为命令");
  const kb = pkg.contributes.keybindings;
  const key = (cmd) => (kb.find((k) => k.command === cmd) || {}).key;
  assert.strictEqual(key("dao.cascade.toggleModelSelector"), "ctrl+/", "官方 Ctrl+/ 对位");
  assert.strictEqual(key("dao.cascade.switchToNextModel"), "ctrl+shift+/", "官方 Ctrl+Shift+/ 对位");
  assert.strictEqual(key("dao.cascade.toggleWriteChatMode"), "ctrl+.", "官方 Ctrl+. 对位");
  assert.strictEqual(key("dao.cascade.openAgentPicker"), "ctrl+shift+.", "官方 Ctrl+Shift+. 对位");
  const board = fs.readFileSync(path.join(CASCADE, "agent-board.js"), "utf8");
  assert.ok(board.includes('"dao.cascade.toggleAgentWindow"'), "看板应注册 toggleAgentWindow(开↔关互切)");
  const panel = fs.readFileSync(path.join(CASCADE, "panel.js"), "utf8");
  assert.ok(panel.includes('m.type==="ui-action"'), "webview 应消费 ui-action");
  assert.ok(panel.includes('".toggleModelSelector"'), "宿主应注册 toggleModelSelector");
  const sb = fs.readFileSync(path.join(CASCADE, "status-bar.js"), "utf8");
  assert.ok(sb.includes("dao.cascade.toggleAgentWindow"), "状态栏应有 Agent 模式一键互切项");
});

// R158 · 编辑器内联键组对位: 命令/键位登记 + 官方直通序列 + 接线在位。
test("parity: 编辑器内联键组(inlineCommand/diff accept·reject)登记与接线在位", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));
  const cmds = pkg.contributes.commands.map((c) => c.command);
  for (const c of ["dao.cascade.inlineCommand", "dao.cascade.acceptDiff", "dao.cascade.rejectDiff",
    "dao.cascade.acceptAllDiffs", "dao.cascade.rejectAllDiffs"])
    assert.ok(cmds.includes(c), c + " 应登记为命令");
  const kb = pkg.contributes.keybindings;
  const ic = kb.find((k) => k.command === "dao.cascade.inlineCommand") || {};
  assert.strictEqual(ic.key, "ctrl+i", "内联命令官方 Ctrl+I 对位");
  assert.strictEqual(ic.when, "editorTextFocus", "内联命令仅编辑器聚焦时触发");
  const mod = require(path.join(CASCADE, "inline-command.js"));
  // 官方候选序列: devin.* 优先于 windsurf.*(反者道之动·官方直通)。
  assert.ok(mod.OFFICIAL.inlineCommand[0].startsWith("devin."), "内联命令首候选应为 devin.*");
  assert.ok(mod.OFFICIAL.acceptDiff.some((c) => c.startsWith("windsurf.")), "acceptDiff 应含 windsurf.* 回退");
  assert.strictEqual(typeof mod.register, "function", "应导出 register");
  const ext = fs.readFileSync(path.join(__dirname, "..", "extension.js"), "utf8");
  assert.ok(ext.includes('require("./dao-cascade/inline-command").register'), "extension 应注册内联键组");
});

// R158 · 会话变更跨侧矩阵 RPC 往返: 桩 LS 验证 rename/archive 写→复读→还原闭环, 且不留痕。
test("sync-rpc.sessionMatrixRoundtrip: rename/archive 写→GetAllCascadeTrajectories 复读→原样还原", async () => {
  const rpc = require(path.join(CASCADE, "sync-rpc.js"));
  const store = { cid7: { cascadeId: "cid7", name: "原名", isArchived: false } };
  const calls = [];
  const stub = { call: async (m, b) => {
    calls.push(m);
    if (m === "GetAllCascadeTrajectories") return { trajectorySummaries: JSON.parse(JSON.stringify(store)) };
    if (m === "RenameCascadeTrajectory") { store[b.cascadeId].name = b.name; return {}; }
    if (m === "ArchiveCascadeTrajectory") { store[b.cascadeId].isArchived = b.isArchived; return {}; }
    throw new Error("unexpected " + m);
  } };
  const r = await rpc.sessionMatrixRoundtrip(stub);
  assert.strictEqual(r.wrote, true, "改名+归档探针应写入并复读到");
  assert.strictEqual(r.reverted, true, "两项均应原样还原");
  assert.ok(r.detail.renamed && r.detail.archived, "复读应见探针值");
  assert.strictEqual(store.cid7.name, "原名", "改名探针不留痕");
  assert.strictEqual(store.cid7.isArchived, false, "归档探针不留痕");
});

test("sync-rpc.sessionMatrixRoundtrip: 无轨迹时如实 skipped(不伪造)", async () => {
  const rpc = require(path.join(CASCADE, "sync-rpc.js"));
  const stub = { call: async (m) => (m === "GetAllCascadeTrajectories" ? { trajectorySummaries: {} } : {}) };
  const r = await rpc.sessionMatrixRoundtrip(stub);
  assert.strictEqual(r.skipped, true, "无轨迹应标注 skipped");
});

test("local-api: 会话变更矩阵路由接线在位", () => {
  const api = fs.readFileSync(path.join(CASCADE, "local-api.js"), "utf8");
  assert.ok(api.includes('u === "/api/cascade/matrix-roundtrip"'), "应挂 POST /api/cascade/matrix-roundtrip");
  const schema = fs.readFileSync(path.join(CASCADE, "api-schema.js"), "utf8");
  assert.ok(schema.includes("/api/cascade/matrix-roundtrip"), "openapi 应登记");
});

// R159 · Cascade Bar 对位: 官方 3.4.27 键位真源实测提取的命令 ID + 键位登记 + 接线在位。
test("cascade-bar: 六键命令/官方真源 ID/键位登记与接线在位", () => {
  const mod = require(path.join(CASCADE, "cascade-bar.js"));
  // 官方命令 ID 为 3.4.27 package.json 实测提取(非猜测)。
  assert.strictEqual(mod.OFFICIAL.acceptAllInFile[0], "devin.prioritized.cascadeAcceptAllInFile");
  assert.strictEqual(mod.OFFICIAL.focusNextHunk[0], "devin.prioritized.cascadeFocusNextHunk");
  assert.strictEqual(mod.OFFICIAL.rejectFocusedHunk[0], "devin.prioritized.cascadeRejectFocusedHunk");
  for (const k of Object.keys(mod.OFFICIAL))
    assert.ok(mod.OFFICIAL[k].some((c) => c.startsWith("windsurf.")), k + " 应含 windsurf.* 回退");
  assert.strictEqual(mod.ITEMS.length, 6, "操作面板应为六键");
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));
  const cmds = pkg.contributes.commands.map((c) => c.command);
  for (const c of ["dao.cascade.cascadeBar", "dao.cascade.nextDiffHunk", "dao.cascade.prevDiffHunk",
    "dao.cascade.acceptFocusedHunk", "dao.cascade.rejectFocusedHunk",
    "dao.cascade.acceptAllInFile", "dao.cascade.rejectAllInFile"])
    assert.ok(cmds.includes(c), c + " 应登记为命令");
  // 官方键位 1:1(Alt+J/K · Alt+Enter · Ctrl+Enter 等), 且可经 config 开关退让。
  const kb = pkg.contributes.keybindings;
  const key = (c) => (kb.find((k) => k.command === c) || {});
  assert.strictEqual(key("dao.cascade.nextDiffHunk").key, "alt+j");
  assert.strictEqual(key("dao.cascade.prevDiffHunk").key, "alt+k");
  assert.strictEqual(key("dao.cascade.acceptFocusedHunk").key, "alt+enter");
  assert.strictEqual(key("dao.cascade.acceptAllInFile").key, "ctrl+enter");
  assert.strictEqual(key("dao.cascade.rejectAllInFile").key, "shift+ctrl+backspace");
  for (const c of ["dao.cascade.nextDiffHunk", "dao.cascade.acceptAllInFile"])
    assert.ok(key(c).when.includes("config.dao.cascadeBar.keys"), c + " 键位应受 config 开关约束");
  assert.ok(pkg.contributes.configuration.properties["dao.cascadeBar.keys"], "应登记 dao.cascadeBar.keys 配置");
  const ext = fs.readFileSync(path.join(__dirname, "..", "extension.js"), "utf8");
  assert.ok(ext.includes('require("./dao-cascade/cascade-bar").register'), "extension 应注册 Cascade Bar");
});

// R159 · inline-command 官方候选 ID 应与官方键位真源一致(纠偏 R158 的猜测 ID)。
test("inline-command: 官方候选 ID 与 3.4.27 键位真源一致", () => {
  const mod = require(path.join(CASCADE, "inline-command.js"));
  assert.strictEqual(mod.OFFICIAL.inlineCommand[0], "devin.prioritized.command.open");
  assert.strictEqual(mod.OFFICIAL.acceptDiff[0], "devin.prioritized.cascadeAcceptFocusedHunk");
  assert.strictEqual(mod.OFFICIAL.acceptAllDiffs[0], "devin.prioritized.cascadeAcceptAllInFile");
  assert.strictEqual(mod.OFFICIAL.rejectAllDiffs[0], "devin.prioritized.cascadeRejectAllInFile");
});

// R159 · 顶栏级对位: editor/title 挂 Cascade 开关/Cascade Bar/Agent 窗口切换(官方顶栏可发现性)。
test("editor/title: 顶栏级入口(Cascade/Cascade Bar/Agent 窗口)登记在位", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));
  const et = (pkg.contributes.menus["editor/title"] || []).map((m) => m.command);
  for (const c of ["dao.cascade.open", "dao.cascade.cascadeBar", "dao.cascade.toggleAgentWindow"])
    assert.ok(et.includes(c), c + " 应挂 editor/title");
  const icon = (c) => (pkg.contributes.commands.find((x) => x.command === c) || {}).icon;
  assert.ok(icon("dao.cascade.open") && icon("dao.cascade.cascadeBar"), "顶栏入口应带 icon");
});

// R159 · 桩验证 cascade-bar.diffStat: 官方真源 diff 水位聚合(LS 未就绪时如实 null)。
test("cascade-bar.diffStat: 桩 ls-bridge 聚合 diff 行数/未就绪如实 null", async () => {
  const mod = require(path.join(CASCADE, "cascade-bar.js"));
  const lsPath = path.join(CASCADE, "ls-bridge.js");
  const real = require.cache[require.resolve(lsPath)];
  require.cache[require.resolve(lsPath)] = { exports: { ready: () => true, call: async () => ({
    trajectorySummaries: { a: { diffLinesAdded: 3, diffLinesRemoved: 1 }, b: { diffLinesAdded: 2 } } } ) } };
  try {
    const st = await mod.diffStat();
    assert.deepStrictEqual(st, { trajectories: 2, diffLinesAdded: 5, diffLinesRemoved: 1 });
    require.cache[require.resolve(lsPath)] = { exports: { ready: () => false } };
    assert.strictEqual(await mod.diffStat(), null, "LS 未就绪应如实 null");
  } finally {
    if (real) require.cache[require.resolve(lsPath)] = real; else delete require.cache[require.resolve(lsPath)];
  }
});

// R161 · 官方命令/键位 1:1 覆盖审计: 清单完整性 + 归类如实 + 路由/接线在位。
test("official-parity: 33 基名清单/归类/审计聚合与接线在位", () => {
  const mod = require(path.join(CASCADE, "official-parity.js"));
  assert.strictEqual(mod.MANIFEST.length, 33, "官方 64 命令去偶应为 33 基名");
  for (const m of mod.MANIFEST) {
    assert.ok(["covered", "passthrough", "na", "pending"].includes(m.cls), m.base + " 归类应合法");
    if (m.cls === "covered") assert.ok(m.equiv, m.base + " covered 应指明等价落点");
    else if (m.cls !== "passthrough") assert.ok(m.reason, m.base + " 应指明理由(如实)");
  }
  const a = mod.audit();
  assert.strictEqual(a.covered + a.passthrough + a.na + a.pending, 33, "归类应无遗漏");
  assert.ok(a.pending >= 0 && Array.isArray(a.pendingList), "pending 列表应如实可列(R162 后 ACP/Lifeguard 已承接)");
  assert.strictEqual(a.keyParity, 12, "12 键 1:1 键位表");
  assert.ok(a.coveragePct >= 80, "适用面覆盖率应 ≥80%(当前审计)");
  const api = fs.readFileSync(path.join(CASCADE, "local-api.js"), "utf8");
  assert.ok(api.includes('u === "/api/parity/commands"'), "应挂 GET /api/parity/commands");
  const schema = fs.readFileSync(path.join(CASCADE, "api-schema.js"), "utf8");
  assert.ok(schema.includes("/api/parity/commands"), "openapi 应登记");
  const ext = fs.readFileSync(path.join(__dirname, "..", "extension.js"), "utf8");
  assert.ok(ext.includes('require("./dao-cascade/official-parity").register'), "extension 应注册对位命令");
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));
  const cmds = pkg.contributes.commands.map((c) => c.command);
  for (const c of ["dao.cascade.importRulesFromCursor", "dao.cascade.openBrowser"])
    assert.ok(cmds.includes(c), c + " 应登记为命令");
});

// R162 · Lifeguard/ACP 官方对位: 命令/键位/后端读路径在位, 直通优先不伪造。
test("official-parity R162: lifeguardCheck/acpRegistry 命令+Ctrl+U 键位+API 路由在位", () => {
  const src = fs.readFileSync(path.join(CASCADE, "official-parity.js"), "utf8");
  assert.ok(src.includes('"devin.lifeguard.checkCurrentChanges"'), "lifeguard 官方直通候选");
  assert.ok(src.includes('"GetLifeguardConfig"'), "回退应读官方 GetLifeguardConfig 如实报告");
  assert.ok(src.includes('"devin.openAcpLocalRegistry"'), "ACP 官方直通候选");
  assert.ok(src.includes('"GetAllAcpRegistries"'), "ACP 回退应读官方注册表真源");
  const mod = require(path.join(CASCADE, "official-parity.js"));
  const cls = Object.fromEntries(mod.MANIFEST.map((m) => [m.base, m.cls]));
  assert.strictEqual(cls["lifeguard.checkCurrentChanges"], "covered");
  assert.strictEqual(cls["reloadAcpConnections"], "covered");
  assert.strictEqual(cls["openAcpLocalRegistry"], "covered");
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));
  const cmds = pkg.contributes.commands.map((c) => c.command);
  for (const c of ["dao.cascade.lifeguardCheck", "dao.cascade.acpRegistry"])
    assert.ok(cmds.includes(c), c + " 应登记为命令");
  const kb = pkg.contributes.keybindings.find((k) => k.command === "dao.cascade.lifeguardCheck");
  assert.ok(kb && kb.key === "ctrl+u" && /config\.dao\.cascadeBar\.keys/.test(kb.when), "Ctrl+U 官方同键且可配置退让");
  const api = fs.readFileSync(path.join(CASCADE, "local-api.js"), "utf8");
  assert.ok(api.includes('u === "/api/lifeguard/config"') && api.includes('u === "/api/acp/registries"'), "后端读路径应在位");
});

// R163 · 跨端会话重拉: pull-on-restart 语义落地为命令+API, 共生/自持如实分流。
test("official-parity R163: refreshSessions 命令 + /api/cascade/refresh 分流在位", () => {
  const src = fs.readFileSync(path.join(CASCADE, "official-parity.js"), "utf8");
  assert.ok(src.includes('"dao.cascade.refreshSessions"'), "命令应注册");
  assert.ok(src.includes("boot.alive()"), "应先辨自持/共生");
  const api = fs.readFileSync(path.join(CASCADE, "local-api.js"), "utf8");
  assert.ok(api.includes('u === "/api/cascade/refresh"'), "POST /api/cascade/refresh 应在位");
  assert.ok(api.includes('"symbiotic-or-none"') && api.includes('"selfhost-restart"'), "共生不代杀/自持重启两态应如实区分");
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));
  assert.ok(pkg.contributes.commands.some((c) => c.command === "dao.cascade.refreshSessions"), "package.json 应登记命令");
  const schema = fs.readFileSync(path.join(CASCADE, "api-schema.js"), "utf8");
  assert.ok(schema.includes("/api/cascade/refresh"), "openapi 应登记");
});

// R165 · 定制类/MCP 轻量刷新: 官方 RefreshCustomization/RefreshMcpServers RPC 接线在位。
test("official-parity R165: refreshCustomizations/refreshMcp 命令 + API 路由在位", () => {
  const src = fs.readFileSync(path.join(CASCADE, "official-parity.js"), "utf8");
  assert.ok(src.includes('refreshVia("RefreshCustomization"') && src.includes('refreshVia("RefreshMcpServers"'), "两 RPC 应经 refreshVia 接线");
  const api = fs.readFileSync(path.join(CASCADE, "local-api.js"), "utf8");
  assert.ok(api.includes('u === "/api/customizations/refresh"') && api.includes('u === "/api/mcp/refresh"'), "POST 路由应在位");
  assert.ok(api.includes('ls.call("RefreshCustomization", {})') && api.includes('ls.call("RefreshMcpServers", {})'), "路由应直呼官方 RPC");
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));
  const cmds = pkg.contributes.commands.map((c) => c.command);
  for (const c of ["dao.cascade.refreshCustomizations", "dao.cascade.refreshMcp"])
    assert.ok(cmds.includes(c), c + " 应登记为命令");
  const schema = fs.readFileSync(path.join(CASCADE, "api-schema.js"), "utf8");
  assert.ok(schema.includes("/api/customizations/refresh") && schema.includes("/api/mcp/refresh"), "openapi 应登记");
});

// R166 · 真源守望: 官方真源 fs.watch → Refresh RPC 去抖触发(headless 桩实测)。
test("truth-watch R166: 守望点/去抖触发/配置开关/extension 接线在位", async () => {
  const mod = require(path.join(CASCADE, "truth-watch.js"));
  const targets = mod.watchTargets();
  assert.strictEqual(targets.length, 5, "5 个守望点");
  const rpcs = new Set(targets.map((t) => t.rpc));
  assert.ok(rpcs.has("RefreshMcpServers") && rpcs.has("RefreshCustomization"), "两类官方 Refresh RPC");
  assert.ok(targets.some((t) => /mcp_config\.json$/.test(t.path)), "MCP 真源在列");
  assert.ok(targets.some((t) => /\.devin[\/\\]rules$/.test(t.path)), "全局 Rules 真源在列");
  // 活体: 隔离 home 下建真源目录, watch 后落探针文件 → 观察 start/stop 无异常(RPC 层 LS 未就绪时如实跳过)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dao-tw-"));
  process.env.DAO_ENV_SYNC_HOME = tmp;
  fs.mkdirSync(path.join(tmp, ".codeium", "windsurf", "memories"), { recursive: true });
  fs.mkdirSync(path.join(tmp, ".devin", "rules"), { recursive: true });
  const logs = [];
  const n = mod.start((m) => logs.push(m));
  assert.ok(n >= 2, "隔离 home 下应至少守望 2 个已存在真源点");
  // 确定性验证去抖链路: 直接触发 _fire(CI 上 fs.watch 事件时序不可控, 不作断言依据)
  mod._fire("RefreshCustomization", "全局 Rules", (m) => logs.push(m));
  await new Promise((r) => setTimeout(r, mod.DEBOUNCE_MS + 600));
  mod.stop();
  delete process.env.DAO_ENV_SYNC_HOME;
  fs.rmSync(tmp, { recursive: true, force: true });
  assert.ok(logs.some((m) => m.includes("守望")), "启动日志应报守望点数");
  assert.ok(logs.some((m) => m.includes("LS 未就绪") || m.includes("已重读真源") || m.includes("失败")), "去抖回调应触发(LS 未就绪时如实跳过)");
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));
  assert.ok(pkg.contributes.configuration.properties["dao.truthWatch.enabled"], "配置开关应登记");
  const ext = fs.readFileSync(path.join(__dirname, "..", "extension.js"), "utf8");
  assert.ok(ext.includes('require("./dao-cascade/truth-watch").register'), "extension 应接线");
});

// R167 · 诊断对位: downloadDiagnostics 命令 + GetDebugDiagnostics/GetUserTrajectoryDebug 读路径。
test("official-parity R167: downloadDiagnostics 命令 + 诊断/轨迹调试 API 路由在位", () => {
  const src = fs.readFileSync(path.join(CASCADE, "official-parity.js"), "utf8");
  assert.ok(src.includes('"dao.cascade.downloadDiagnostics"'), "命令应注册");
  assert.ok(src.includes('"devin.downloadDiagnostics"') && src.includes('ls.call("GetDebugDiagnostics", {})'), "官方直通优先 + RPC 回退");
  const api = fs.readFileSync(path.join(CASCADE, "local-api.js"), "utf8");
  assert.ok(api.includes('u === "/api/diagnostics/ls"') && api.includes('u === "/api/trajectory/debug"'), "GET 路由应在位");
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));
  assert.ok(pkg.contributes.commands.some((c) => c.command === "dao.cascade.downloadDiagnostics"), "package.json 应登记命令");
  const schema = fs.readFileSync(path.join(CASCADE, "api-schema.js"), "utf8");
  assert.ok(schema.includes("/api/diagnostics/ls") && schema.includes("/api/trajectory/debug"), "openapi 应登记");
});

// R168 · 定时重拉 + 流式订阅如实边界: autoRefresh 配置接线与 GAP 记录在位。
test("official-parity R168: autoRefreshMinutes 配置 + 定时重拉接线在位", () => {
  const src = fs.readFileSync(path.join(CASCADE, "official-parity.js"), "utf8");
  assert.ok(src.includes('"cascade.autoRefreshMinutes"'), "应读配置");
  assert.ok(src.includes("applyAutoRefresh") && src.includes("clearInterval"), "应可热起停");
  assert.ok(src.includes("boot.alive()") && src.includes("不代杀"), "仅自持 LS 生效, 共生不代杀(如实)");
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));
  assert.ok(pkg.contributes.configuration.properties["dao.cascade.autoRefreshMinutes"], "配置应登记");
  const gap = fs.readFileSync(path.join(__dirname, "..", "GAP-ANALYSIS.md"), "utf8");
  assert.ok(gap.includes("StreamCascadeSummariesReactiveUpdates"), "R168 流式订阅实测应入档");
});

// R174 · 冷启动一键器: 步骤规划纯函数 + 幂等跳过语义 + 凭据解析(不触网络)。
test("coldstart R174: 步骤规划/凭据解析/幂等跳过语义", () => {
  const cs = require(path.join(__dirname, "..", "scripts", "coldstart.js"));
  // 全新机: 全步 run
  const fresh = cs.plan({ officialRoot: null, hasKey: false, noDownload: false, hasUrlHandler: false });
  assert.deepStrictEqual(fresh.map((s) => s.run), [true, true, true, true, true], "全新机应全步执行");
  // 已就位: download/urlHandler/login 跳过, boot/sweep 恒跑
  const warm = cs.plan({ officialRoot: "/x", hasKey: true, noDownload: false, hasUrlHandler: true });
  assert.deepStrictEqual(warm.map((s) => s.run), [false, false, false, true, true], "已就位应跳过 download/urlHandler/login");
  // --no-download 且未安装: download 不跑(boot 阶段如实报错, 不静默下载)
  const nd = cs.plan({ officialRoot: null, hasKey: true, noDownload: true });
  assert.strictEqual(nd[0].run, false, "--no-download 应禁下载");
  // 凭据解析: 隔离文件往返
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dao-cs-"));
  const f = path.join(tmp, "credentials.toml");
  fs.writeFileSync(f, 'windsurf_api_key = "k-test-1234"\n');
  assert.strictEqual(cs.credKey(f), "k-test-1234", "应解析 key");
  assert.strictEqual(cs.credKey(path.join(tmp, "none.toml")), null, "缺文件应返 null 不抛");
  fs.rmSync(tmp, { recursive: true, force: true });
  // R178 · devin:// 深链处理器: tar 包无 .desktop 注册, 官方浏览器 OAuth 回跳依赖此处理器
  assert.ok(typeof cs.installUrlHandler === "function" && typeof cs.hasUrlHandler === "function", "深链处理器 API 在位");
  assert.ok(cs.urlHandlerPath().endsWith(path.join("applications", "devin-desktop.desktop")), "handler 落 XDG applications");
  const src = fs.readFileSync(path.join(__dirname, "..", "scripts", "coldstart.js"), "utf8");
  assert.ok(src.includes("x-scheme-handler/devin") && src.includes("--open-url"), "应注册 devin:// scheme 并经 --open-url 回环");
});

// R175 · 官方主题对位: theme-windsurf 真源逐字节随包 + Devin Dark/Light 登记 + 一键应用命令。
test("official-parity R175: 官方 Devin Dark/Light 主题随包 + applyOfficialTheme 命令在位", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));
  const themes = pkg.contributes.themes || [];
  assert.ok(themes.some((t) => t.id === "Devin Dark" && t.uiTheme === "vs-dark"), "Devin Dark 应登记");
  assert.ok(themes.some((t) => t.id === "Devin Light" && t.uiTheme === "vs"), "Devin Light 应登记");
  for (const t of themes) {
    const f = path.join(__dirname, "..", t.path);
    assert.ok(fs.existsSync(f), "主题文件应随包: " + t.path);
    const j = JSON.parse(fs.readFileSync(f, "utf8"));
    assert.ok(j.colors && Object.keys(j.colors).length > 50, "应为官方完整配色(非占位): " + t.path);
  }
  assert.ok(pkg.contributes.commands.some((c) => c.command === "dao.cascade.applyOfficialTheme"), "命令应登记");
  const src = fs.readFileSync(path.join(CASCADE, "official-parity.js"), "utf8");
  assert.ok(src.includes('"dao.cascade.applyOfficialTheme"') && src.includes('"Devin Dark"'), "应接线并指向官方默认主题");
  const sync = fs.readFileSync(path.join(__dirname, "..", "scripts", "sync-official.js"), "utf8");
  assert.ok(sync.includes("theme-windsurf"), "sync-official 应承接官方主题真源同步");
});

// R177 · 官方全表面对位: 29 键位逐条审计 + schemas/languages/jsonValidation 真源随包 + 新增同键绑定。
test("official-parity R177: 全键位审计表 + 官方 schema 随包 + jsonValidation/languages 对位", () => {
  const op = require(path.join(CASCADE, "official-parity.js"));
  assert.strictEqual(op.KEYMAP_AUDIT.length, 29, "官方 3.4.27 共 29 条键位, 逐条归类");
  for (const k of op.KEYMAP_AUDIT) {
    assert.ok(["parity", "host", "na", "pending"].includes(k.cls), "归类合法: " + k.official);
    if (k.cls === "na") assert.ok(k.reason, "na 必须给出如实理由: " + k.official);
    if (k.cls === "parity" || k.cls === "host") assert.ok(k.ours, "对位必须指明落点: " + k.official);
  }
  const a = op.audit();
  assert.strictEqual(a.keymap.total, 29);
  assert.strictEqual(a.keymap.pending, 0, "无 pending 键位(全部对位或如实 na)");
  assert.ok(a.surfaces.adopted >= 4, "themes/jsonValidation/languages/configuration 均已承接");
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));
  const jv = pkg.contributes.jsonValidation || [];
  assert.ok(jv.some((v) => v.fileMatch === "**/mcp_config.json"), "mcp_config 校验对位");
  assert.ok(jv.some((v) => v.fileMatch === "**/acp/registry.json"), "acp registry 校验对位");
  for (const v of jv) {
    const f = path.join(__dirname, "..", v.url);
    assert.ok(fs.existsSync(f), "schema 文件应随包: " + v.url);
    JSON.parse(fs.readFileSync(f, "utf8"));
  }
  assert.ok((pkg.contributes.languages || []).some((l) => l.id === "jsonc" && (l.filenames || []).includes("mcp_config.json")), "mcp_config.json jsonc 高亮对位");
  const kb = pkg.contributes.keybindings;
  assert.ok(kb.some((k) => k.key === "alt+\\" && k.command === "editor.action.inlineSuggest.trigger"), "alt+\\ 宿主原生同键");
  assert.ok(kb.some((k) => k.key === "ctrl+'" && k.command === "dao.cascade.openAgentPicker"), "ctrl+' 官方同键别名");
  const sync = fs.readFileSync(path.join(__dirname, "..", "scripts", "sync-official.js"), "utf8");
  assert.ok(sync.includes("schemas"), "sync-official 应承接官方 schema 真源同步");
});

// R179 · Agent 看板官方同貌: 筛选 chips(Time/Archived/＋) + Display + 官方状态泳道 + 整窗接管。
test("agent-board R179: 官方 Board 同貌(筛选 chips/Display/Running 泳道/整窗)", () => {
  const src = fs.readFileSync(path.join(CASCADE, "agent-board.js"), "utf8");
  assert.ok(src.includes("Time is") && src.includes("Archived is"), "官方筛选 chips 对位(Time/Archived)");
  assert.ok(src.includes('"chip add"'), "＋ 叠加筛选 chip 对位");
  assert.ok(src.includes('id="display"'), "Display 下拉对位");
  for (const lane of ['"Running"', '"Blocked"', '"Finished"'])
    assert.ok(src.includes(lane), "官方状态泳道: " + lane);
  assert.ok(src.includes("workbench.action.closeSidebar"), "Agent 模式整窗接管(收侧栏)");
  assert.ok(src.includes("TIME_OPTS") && src.includes("ARCH_OPTS"), "筛选语义落地(非纯装饰)");
});

// R180 · 官方 Agent 侧栏/底栏对照收敛: New session/Sessions/Spaces(🔍＋)/近期会话 + N MCP servers 底栏(同一份 mcp_config 真源)。
test("agent-board R180: 官方 Agent 侧栏结构 + MCP servers 底栏同源", () => {
  const src = fs.readFileSync(path.join(CASCADE, "agent-board.js"), "utf8");
  assert.ok(src.includes("＋ New session"), "侧栏 New session 对位");
  assert.ok(src.includes("Sessions</div>"), "侧栏 Sessions 项对位");
  assert.ok(src.includes('id="sp-search"'), "Spaces 头搜索图标对位");
  assert.ok(src.includes('id="recent"') && src.includes("renderRecent"), "近期会话列表对位");
  assert.ok(src.includes("MCP servers") && src.includes("mcp_config.json"), "底栏 N MCP servers 与官方同一份 mcp_config 真源");
});

// R181 · 归一外壳单网页(/shell): dao-vsix「单网页实现一切」插件本体原生对位。
test("shell-page R181: /shell 归一外壳 + 板块子网页 + token 鉴权(实起服务活体验证)", async () => {
  const sp = require(path.join(CASCADE, "shell-page.js"));
  assert.ok(sp.BOARDS.length >= 8, "八大板块标签(六大板块+github+proxy)");
  for (const k of ["overview", "switch", "bridge", "backups", "inject", "mcp", "github", "proxy"])
    assert.ok(sp.BOARDS.some((b) => b.key === k), "板块在位: " + k);
  assert.ok(sp.shellPage("tk").includes("iframe"), "浏览器套浏览器(iframe 平级标签)");
  assert.ok(sp.boardPage("mcp", "tk", 1).includes("/api/mcp"), "板块页 fetch 同一套 /api 真源");
  assert.strictEqual(sp.boardPage("nope", "tk", 1), null, "未知板块拒绝");
  // 活体: 实起 local-api, /shell 走 ?t= 鉴权, 错 token 401, 对 token 200 HTML
  const api = require(path.join(CASCADE, "local-api.js"));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dao-shell-"));
  process.env.DAO_LOCAL_API_FILE = path.join(tmp, "s.json");
  const { port, token } = await api.start(0);
  const get = (u) => new Promise((res) => require("http").get("http://127.0.0.1:" + port + u, (r) => {
    let b = ""; r.on("data", (c) => b += c); r.on("end", () => res({ code: r.statusCode, body: b }));
  }));
  const bad = await get("/shell?t=wrong");
  assert.strictEqual(bad.code, 401, "错 token 401");
  const ok = await get("/shell?t=" + encodeURIComponent(token));
  assert.strictEqual(ok.code, 200);
  assert.ok(ok.body.includes("归一"), "/shell 外壳直出");
  const bd = await get("/shell/board/overview?t=" + encodeURIComponent(token));
  assert.ok(bd.code === 200 && bd.body.includes("/api/account"), "板块子网页直出");
  await api.stop();
  delete process.env.DAO_LOCAL_API_FILE;
  fs.rmSync(tmp, { recursive: true, force: true });
});

// R182 · 归一本体拼积木: build.js 原样装配 devin-remote/dao-one → vendor-one, 原装驱动器激活, 零重写。
test("R182: 归一本体折入(vendor-one 装配 + 原装驱动 + 道并行护栏)", () => {
  const b = fs.readFileSync(path.join(ROOT, "build.js"), "utf8");
  assert.ok(b.includes("vendor-one"), "build.js 装配 vendor-one");
  assert.ok(b.includes('core", "dao-one", "build.js'), "调用 dao-one 官方装配器(不自造)");
  for (const d of ["vendor-vsix", "vendor-proxy", "vendor-flow", "vendor-bridge"])
    assert.ok(b.includes('"' + d + '"'), "原样搬运: " + d);
  assert.ok(b.includes("oneContrib") && b.includes("mergeArr"), "dao-one contributes 打包期并入(重复 id 跳过)");
  assert.ok(b.includes("fs.writeFileSync(pkgPath, pkgRaw)"), "打包后 package.json 还原(源洁)");
  const e = fs.readFileSync(path.join(ROOT, "extension.js"), "utf8");
  assert.ok(e.includes('vendor-one", "extension.js'), "原装 dao-one 驱动器入口");
  assert.ok(e.includes('subContext(context, "vendor-one")'), "子目录隔离 context 激活");
  assert.ok(e.includes("dao.dao-one") && e.includes("dao.dao-vsix"), "兄弟归一插件在装即跳过(道并行而不相悖)");
  // 本机装配产物在位时: 驱动器必须与 devin-remote 源字节级一致(零重写铁律)
  const vend = path.join(ROOT, "vendor-one", "extension.js");
  const src = path.join(os.homedir(), "repos", "devin-remote", "core", "dao-one", "extension.js");
  if (fs.existsSync(vend) && fs.existsSync(src))
    assert.strictEqual(fs.readFileSync(vend, "utf8"), fs.readFileSync(src, "utf8"), "驱动器与本源逐字节一致");
});

// R184 · 归一多实例/钉号底层随 vendor-one 折入(实机已验: /?dao_acct=<号> 同源反代注入 auth1 秒登官方 SPA)。
// CI 安全: 断言装配产物在位时携带原始多实例/反代/钉号源(非重造), 证明 dao-vsix 二合一底层完整搬运。
test("R184: vendor-one 携带归一多实例/钉号/反代底层(原样, 非重造)", () => {
  const v1 = path.join(ROOT, "vendor-one");
  if (!fs.existsSync(v1)) return; // 无 devin-remote 的 CI 环境跳过(共生模式)
  const flow = fs.readFileSync(path.join(v1, "vendor-flow", "extension.js"), "utf8");
  assert.ok(flow.includes("_shellResolveOpen"), "统一外壳多实例开页解析器在位");
  assert.ok(flow.includes("/?dao_acct"), "多实例同源钉号 URL(实机验证可用形态)在位");
  const vsix = fs.readFileSync(path.join(v1, "vendor-vsix", "out", "extension.js"), "utf8");
  assert.ok(/ensureAccountAuth|saveAccountAuthRecord/.test(vsix), "按号取 auth1/落盘不冒名(踩坑7 修法)在位");
  assert.ok(vsix.includes("webapp_host"), "反代规范主机改写(踩坑6 修法)在位");
});

// R186 · 官方 chat-client 内部快捷键 SearchConversation(Ctrl+F) 同位: 会话内搜索浮层。
// 官方真源(3.4.27 workbench): jd.SearchConversation = Ctrl+F(DetectedAndRunByChatClient),
// 命令 id devin.cascade.chat.searchConversation。插件 webview 同键同位承接。
test("R186: 会话搜索浮层(Ctrl+F SearchConversation 同位)在位", () => {
  const src = fs.readFileSync(path.join(ROOT, "dao-cascade", "panel.js"), "utf8");
  assert.ok(src.includes('id="convFind"'), "搜索浮层 DOM 在位");
  assert.ok(src.includes("cfOpen"), "Ctrl+F 开启逻辑在位");
  assert.ok(/e\.key==="f"\|\|e\.key==="F"/.test(src), "官方同键 Ctrl+F 绑定在位");
  assert.ok(src.includes("cfStep(e.shiftKey?-1:1)"), "Enter/Shift+Enter 巡航在位");
  const parity = require(path.join(ROOT, "dao-cascade", "official-parity.js"));
  const e = (parity.CHAT_CLIENT_KEYS || []).find((k) => k.key === "ctrl+f");
  assert.ok(e && e.cls === "parity", "chat-client 键位审计已录 ctrl+f parity");
});

// R187 · 官方 Start With History 同位: 官方 workbench 真源 label/tooltip 逐字,
// 开启后新会话首条消息附带最近编码轨迹(GetUserTrajectory 同源)。LS 二进制无
// start_with_history 专用 RPC(实测), 与官方同为客户端态——不伪造后端接口。
test("R187: Start With History 开关同位在位", () => {
  const src = fs.readFileSync(path.join(ROOT, "dao-cascade", "panel.js"), "utf8");
  assert.ok(src.includes(">Start With History</label>"), "官方同名开关在位");
  assert.ok(src.includes("include your recent coding history for better context awareness"), "官方 tooltip 逐字");
  assert.ok(src.includes("_swhContext"), "轨迹摘要构建器在位");
  assert.ok(src.includes("msg.startWithHistory && !this._cascadeLsId"), "仅新会话首条附带(官方语义)");
  assert.ok(src.includes("swhPrefix + msg.text"), "摘要前置进首条消息");
  assert.ok(src.includes("<recent_coding_history>"), "结构化历史块在位");
});

// R187b · swhContext 功能验证(stub LS): 有当前轨迹 → 摘要块; 无轨迹/RPC 失败 → 空串优雅降级。
test("R187: swhContext 摘要构建器功能(stub LS)", async () => {
  const vscodePath = "vscode";
  // panel.js 顶层 require("vscode") — 注入最小 stub 后加载
  const Module = require("module");
  const origResolve = Module._resolveFilename;
  Module._resolveFilename = function (req, ...a) {
    if (req === "vscode") return "vscode";
    return origResolve.call(this, req, ...a);
  };
  require.cache["vscode"] = { id: "vscode", filename: "vscode", loaded: true, exports: {
    Uri: { file: (p) => ({ fsPath: p }) }, window: {}, commands: {}, workspace: { workspaceFolders: [] },
    EventEmitter: function(){ this.event=()=>{}; this.fire=()=>{}; }, ViewColumn: {}, env: {},
  } };
  try {
    const { swhContext } = require(path.join(CASCADE, "panel.js"));
    // 无当前轨迹 → 空串
    assert.strictEqual(await swhContext({ call: async () => ({ trajectories: [] }) }), "");
    // RPC 失败 → 空串(优雅降级)
    assert.strictEqual(await swhContext({ call: async () => { throw new Error("boom"); } }), "");
    // 有当前轨迹 → 结构化摘要块
    const ls = { call: async (m) => m === "GetUserTrajectoryDescriptions"
      ? { trajectories: [{ trajectoryId: "t1", current: true }] }
      : { trajectory: { steps: [
          { type: "CORTEX_STEP_TYPE_GIT_COMMIT", gitCommit: { commitMessage: "fix: panel" } },
          { type: "CORTEX_STEP_TYPE_USER_INPUT", userInput: { userResponse: "add search" } },
          { type: "CORTEX_STEP_TYPE_VIEW_FILE", viewFile: { absolutePathUri: "file:///a/b/c.js" } },
          { type: "CORTEX_STEP_TYPE_CHECKPOINT", checkpoint: { userIntent: "search overlay" } },
        ] } } };
    const out = await swhContext(ls);
    assert.ok(out.startsWith("<recent_coding_history>\n"), "块头在位");
    assert.ok(out.includes("commit: fix: panel") && out.includes("user: add search"), "commit/user 行在位");
    assert.ok(out.includes("viewed: b/c.js") && out.includes("intent: search overlay"), "viewed/intent 行在位");
    assert.ok(out.endsWith("</recent_coding_history>\n\n"), "块尾在位");
  } finally {
    Module._resolveFilename = origResolve;
    delete require.cache["vscode"];
    delete require.cache[require.resolve(path.join(CASCADE, "panel.js"))];
  }
});

// R188 · 官方 chat-client 键位全表对位: 官方 jd 枚举 21 动作逐条审计(parity/no-surface/host),
// parity 项 webview 同键实装(Ctrl+L/Ctrl+Shift+L/Ctrl+N/Ctrl+Shift+./Ctrl+;/Ctrl+Shift+M/Ctrl+Alt+C)。
test("R188: chat-client 键位全表审计与实装在位", () => {
  const parity = require(path.join(ROOT, "dao-cascade", "official-parity.js"));
  const ks = parity.CHAT_CLIENT_KEYS;
  assert.strictEqual(ks.length, 21, "官方 jd 枚举全 21 动作逐条归类(宿主会话切换 3 动作合 1 行)");
  for (const k of ks) assert.ok(["parity", "no-surface", "host"].includes(k.cls), k.official + " 归类合法");
  const parityKeys = ks.filter((k) => k.cls === "parity").map((k) => k.key);
  for (const need of ["ctrl+f","ctrl+l","ctrl+shift+l","ctrl+n","ctrl+.","ctrl+'","ctrl+shift+.","ctrl+/","ctrl+shift+/","ctrl+;","ctrl+shift+m","ctrl+alt+c"])
    assert.ok(parityKeys.includes(need), need + " 已实装");
  const src = fs.readFileSync(path.join(ROOT, "dao-cascade", "panel.js"), "utf8");
  assert.ok(src.includes('type:"session-new"'), "Ctrl+Shift+L/Ctrl+N → session-new 在位");
  assert.ok(src.includes("inputEl.focus(); return;"), "Ctrl+L 聚焦在位");
  assert.ok(src.includes("micBtn.click()"), "Ctrl+Shift+M 语音在位");
  assert.ok(src.includes("wtBtn.click()"), "Ctrl+; worktree 在位");
});

// R189 · 官方 LanguageServerService 未接入 77 方法逐项甄别 + Share conversation 实装。
test("R189: RPC 甄别全表与 Share conversation 在位", () => {
  const parity = require(path.join(ROOT, "dao-cascade", "official-parity.js"));
  const g = parity.RPC_GAP_AUDIT;
  assert.strictEqual(Object.keys(g).length, 77, "官方未接入 77 方法逐项归类");
  const legal = new Set(["ux", "ux-done", "telemetry", "completion", "experiment", "internal", "removed", "unimpl", "deploy"]);
  for (const [k, v] of Object.entries(g)) assert.ok(legal.has(v), k + " 归类合法");
  assert.strictEqual(g.CreateTrajectoryShare, "ux-done", "分享链接已实装");
  assert.strictEqual(g.GetConversationTags, "removed", "后端实测 removed");
  const src = fs.readFileSync(path.join(ROOT, "dao-cascade", "panel.js"), "utf8");
  assert.ok(src.includes('"CreateTrajectoryShare"') && src.includes("TRAJECTORY_SHARE_STATUS_TEAM"), "官方同参调用在位");
  assert.ok(src.includes("/windsurf/conversation-shares/"), "官方同构分享链接在位");
  assert.ok(src.includes('id="mtShare"') && src.includes('type:"share-conversation"'), "分享按钮与桥接在位");
});

// R190 · 官方语音转写对位: GetTranscription{audioData}→transcribedText, 录音送 LS 转写入 composer。
test("R190: GetTranscription 语音转写链路在位", () => {
  const parity = require(path.join(ROOT, "dao-cascade", "official-parity.js"));
  assert.strictEqual(parity.RPC_GAP_AUDIT.GetTranscription, "ux-done", "已实装归类");
  const src = fs.readFileSync(path.join(ROOT, "dao-cascade", "panel.js"), "utf8");
  assert.ok(src.includes('"GetTranscription"') && src.includes("transcribedText"), "官方 RPC 调用在位");
  assert.ok(src.includes('type:"transcribe"') && src.includes('"transcribed"'), "webview↔host 桥接在位");
  assert.ok(src.includes("MediaRecorder"), "录音路径在位");
  assert.ok(src.includes("fallbackSR"), "Web Speech 回退在位");
});

// R191 · RPC 甄别后端实测再校准: unimpl/removed 以 LS 真实回应为准。
test("R191: RPC 甄别实测校准在位", () => {
  const g = require(path.join(ROOT, "dao-cascade", "official-parity.js")).RPC_GAP_AUDIT;
  assert.strictEqual(g.SetPinnedContext, "unimpl");
  assert.strictEqual(g.SetPinnedGuideline, "unimpl");
  assert.strictEqual(g.GetCascadeModelConfigs, "unimpl");
  assert.strictEqual(g.GetKnowledgeBaseItemsForTeam, "removed");
});
