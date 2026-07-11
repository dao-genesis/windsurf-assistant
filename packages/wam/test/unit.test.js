"use strict";
// ═══════════════════════════════════════════════════════════════════════════
// rt-flow · 零依赖单测 (node test/unit.test.js) · 无网络 · 无 vscode
//
// 反者道之动: 把实测中揪出的高危逻辑(限流重试 / 五态分类 / 余额判定 / Git 已注册态分流)
// 固化为回归护栏, 防止后续改动悄然回退。纯 node assert, 不引第三方框架, 直接进 CI。
// ═══════════════════════════════════════════════════════════════════════════
const assert = require("assert");
const http = require("http");
const cloud = require("../devin_cloud.js");
const git = require("../devin_git.js");
const proxy = require("../devin_proxy.js");

let passed = 0;
let failed = 0;
let skipped = 0;
const failures = [];
// WA standalone 布局: 本仓无 packages/dao-vsix 副本 → dao-vsix 双副本/跨模块护栏退化为单源自检。
// (这些护栏属 devin-remote mega 布局; dao-vsix 存在时全量启用, 与上游行为一致。)
const HAS_VSIX = require("fs").existsSync(require("path").join(__dirname, "..", "..", "dao-vsix"));
const dualRels = (rels) => (HAS_VSIX ? rels : rels.filter((r) => !r.includes("dao-vsix")));
function _isVsixAbsent(e) {
  return !HAS_VSIX && e && e.code === "ENOENT" && String(e.path || "").includes("dao-vsix");
}
function test(name, fn) {
  try {
    const r = fn();
    if (r && typeof r.then === "function") {
      return r.then(
        () => { passed++; console.log("  ok   " + name); },
        (e) => {
          if (_isVsixAbsent(e)) { skipped++; console.log("  skip " + name + " (无 dao-vsix 副本)"); return; }
          failed++; failures.push([name, e]); console.log("  FAIL " + name + " — " + (e && e.message));
        },
      );
    }
    passed++; console.log("  ok   " + name);
  } catch (e) {
    if (_isVsixAbsent(e)) { skipped++; console.log("  skip " + name + " (无 dao-vsix 副本)"); return; }
    failed++; failures.push([name, e]); console.log("  FAIL " + name + " — " + (e && e.message));
  }
}

(async () => {
  // ── 1. 限流/暂时性故障 可重试判定 (_isRetryableStatus) ────────────────────
  console.log("\n[_isRetryableStatus]");
  test("429 任意方法皆可重试 (POST 登录被拒·未处理·安全)", () => {
    assert.strictEqual(cloud._isRetryableStatus(429, "POST"), true);
    assert.strictEqual(cloud._isRetryableStatus(429, "GET"), true);
  });
  test("502/503/504 仅幂等方法 (GET/HEAD) 可重试", () => {
    assert.strictEqual(cloud._isRetryableStatus(503, "GET"), true);
    assert.strictEqual(cloud._isRetryableStatus(502, "HEAD"), true);
    assert.strictEqual(cloud._isRetryableStatus(504, "POST"), false); // 非幂等不重试·防重复变更
    assert.strictEqual(cloud._isRetryableStatus(503, "DELETE"), false);
  });
  test("2xx/4xx(非429) 不重试", () => {
    [200, 201, 400, 401, 403, 404, 422].forEach((s) => {
      assert.strictEqual(cloud._isRetryableStatus(s, "GET"), false, "status " + s);
    });
  });

  // ── 2. 退避时长 (_retryDelayMs) · Retry-After 优先 ───────────────────────
  console.log("\n[_retryDelayMs]");
  test("遵从 Retry-After 秒数", () => {
    assert.strictEqual(cloud._retryDelayMs({ "retry-after": "2" }, 0), 2000);
  });
  test("Retry-After 过大被 retryMaxDelayMs 封顶", () => {
    const cap = cloud.CFG.retryMaxDelayMs;
    assert.strictEqual(cloud._retryDelayMs({ "retry-after": "99999" }, 0), cap);
  });
  test("无 Retry-After → 指数退避(随 attempt 增大) + 抖动不超基数", () => {
    const base = cloud.CFG.retryBaseMs;
    const d0 = cloud._retryDelayMs({}, 0);
    const d2 = cloud._retryDelayMs({}, 2);
    assert.ok(d0 >= base && d0 < base * 2, "attempt0 in [base, 2base): " + d0);
    // attempt2 基数 = base*4, 抖动 < base ⇒ 必 >= 4*base > attempt0
    assert.ok(d2 >= base * 4, "attempt2 >= 4*base: " + d2);
  });

  // ── 3. rawRequest 真重试 429 → 200 (本地 http 服务·无外网) ────────────────
  console.log("\n[rawRequest live retry on 429]");
  await test("429×2 后 200: rawRequest 自动退避重试至成功", async () => {
    const prev = { base: cloud.CFG.retryBaseMs, rl: cloud.CFG.rateLimitMaxRetries };
    cloud.configure({ retryBaseMs: 5, rateLimitMaxRetries: 6 }); // 快测
    let hits = 0;
    const server = http.createServer((req, res) => {
      hits++;
      if (hits <= 2) { res.statusCode = 429; res.setHeader("retry-after", "0"); res.end('{"detail":"Rate limit exceeded"}'); }
      else { res.statusCode = 200; res.end('{"ok":true}'); }
    });
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    const port = server.address().port;
    try {
      const resp = await cloud.rawRequest("GET", "http://127.0.0.1:" + port + "/", {}, null, 5000);
      assert.strictEqual(resp.status, 200, "final status 200");
      assert.strictEqual(hits, 3, "server hit 3 times (2×429 + 1×200), got " + hits);
    } finally {
      server.close();
      cloud.configure({ retryBaseMs: prev.base, rateLimitMaxRetries: prev.rl });
    }
  });

  // ── 4. classifySession 五态分类 ──────────────────────────────────────────
  console.log("\n[classifySession]");
  test("user_action_required 非空 → awaiting (最高优先·即便已挂起)", () => {
    assert.strictEqual(cloud.classifySession({ status: "suspended", latest_status_contents: { enum: "finished", user_action_required: { q: "?" } } }), "awaiting");
  });
  test("enum=finished / status=suspended → finished", () => {
    assert.strictEqual(cloud.classifySession({ latest_status_contents: { enum: "finished" } }), "finished");
    assert.strictEqual(cloud.classifySession({ status: "suspended" }), "finished");
  });
  test("非终态 + 额度耗尽 reason → blocked", () => {
    assert.strictEqual(cloud.classifySession({ status: "running", latest_status_contents: { reason: "out_of_quota" } }), "blocked");
    assert.strictEqual(cloud.classifySession({ activity_status: "usage_limit_exceeded" }), "blocked");
  });
  test("非终态 + 运行关键词 → running", () => {
    assert.strictEqual(cloud.classifySession({ activity_status: "coding" }), "running");
    assert.strictEqual(cloud.classifySession({ status: "running" }), "running");
  });
  test("空会话 → idle", () => {
    assert.strictEqual(cloud.classifySession({}), "idle");
  });
  test("标题含 error 不污染分类 (blob 只取状态字段·非 title)", () => {
    // 运行中、标题里有 'error' 字样的正常会话不应被误判 blocked
    assert.strictEqual(cloud.classifySession({ title: "fix error handling", activity_status: "coding" }), "running");
  });

  // ── 5. billingBalance ────────────────────────────────────────────────────
  console.log("\n[billingBalance]");
  test("has_subscription_or_credits=true → 充足 (>0 返真余额, =0 返 9999)", () => {
    assert.strictEqual(cloud.billingBalance({ has_subscription_or_credits: true, available_credits: 0, overage_credits: 0 }), 9999);
    assert.strictEqual(cloud.billingBalance({ is_subscription_valid: true, available_credits: 12.5 }), 12.5);
  });
  test("无订阅无额度 → 返真实余额(可触发清理)", () => {
    assert.strictEqual(cloud.billingBalance({ has_subscription_or_credits: false, available_credits: 0, overage_credits: 0 }), 0);
  });
  test("字段缺失 → null (安全·绝不当 0 误删)", () => {
    assert.strictEqual(cloud.billingBalance({}), null);
    assert.strictEqual(cloud.billingBalance(null), null);
  });
  test("overage 负值不减 avail (max(0,overage))", () => {
    assert.strictEqual(cloud.billingBalance({ available_credits: 10, overage_credits: -5 }), 10);
  });

  // ── 6. Git 已注册态分流 (classifyRegisteredState) ─────────────────────────
  console.log("\n[classifyRegisteredState]");
  test("已连本 PAT 主 + 有仓库 → existing (幂等·不动)", () => {
    assert.strictEqual(git.classifyRegisteredState({ ownerLogin: "dao-devin", connections: [{ name: "dao-devin", type: "github_individual_token" }], hasRepos: true }), "existing");
  });
  test("已注册但 0 连接 → ghost (平台孤儿·API 不可清)", () => {
    assert.strictEqual(git.classifyRegisteredState({ ownerLogin: "x", connections: [], hasRepos: false }), "ghost");
  });
  test("individual_token 连别身份 → reinject (可断净重注入)", () => {
    assert.strictEqual(git.classifyRegisteredState({ ownerLogin: "dao-devin", connections: [{ name: "someone-else", type: "github_individual_token" }], hasRepos: true }), "reinject");
  });
  test("individual_token 连本主但 0 仓库(陈旧) → reinject", () => {
    assert.strictEqual(git.classifyRegisteredState({ ownerLogin: "dao-devin", connections: [{ name: "dao-devin", type: "github_individual_token" }], hasRepos: false }), "reinject");
  });
  test("github_app(OAuth) 连接 → app (绝不主动断)", () => {
    assert.strictEqual(git.classifyRegisteredState({ ownerLogin: "dao-devin", connections: [{ name: "hdougle", type: "github_app" }], hasRepos: false }), "app");
  });
  test("混合含 app 连接 → app (保守·不断 app)", () => {
    assert.strictEqual(git.classifyRegisteredState({ ownerLogin: "z", connections: [{ name: "a", type: "github_individual_token" }, { name: "b", type: "github_app" }], hasRepos: false }), "app");
  });

  // ── 7. 对话上限 + 耗尽自动重置 (computeConvCap · v4.7.3) ────────────────────
  console.log("\n[computeConvCap]");
  test("常态: cap = 余额 - 缓冲 (余额$70 缓冲$3 → $67)", () => {
    const r = cloud.computeConvCap(70, 3, true, 0.1);
    assert.strictEqual(r.cap, 67); assert.strictEqual(r.drain, false);
  });
  test("随余额下降实时下调 (余额$55 缓冲$3 → $52)", () => {
    assert.strictEqual(cloud.computeConvCap(55, 3, true, 0.1).cap, 52);
  });
  test("反向重置: 余额抵缓冲(余额$3 缓冲$3 → cap本应0)→ 抽干抬回$3 让美金用尽", () => {
    const r = cloud.computeConvCap(3, 3, true, 0.1);
    assert.strictEqual(r.cap, 3); assert.strictEqual(r.drain, true);
  });
  test("反向重置: 余额低于缓冲(余额$2 缓冲$3)→ 抽干抬回$2", () => {
    const r = cloud.computeConvCap(2, 3, true, 0.1);
    assert.strictEqual(r.cap, 2); assert.strictEqual(r.drain, true);
  });
  test("见底(余额≤地板$0.1)→ cap=0 不抽干 (交由调用方中停)", () => {
    const r = cloud.computeConvCap(0.05, 3, true, 0.1);
    assert.strictEqual(r.cap, 0); assert.strictEqual(r.drain, false);
  });
  test("抽干关闭: 余额抵缓冲 → cap=0 (沿用旧中停语义·不抬回)", () => {
    const r = cloud.computeConvCap(3, 3, false, 0.1);
    assert.strictEqual(r.cap, 0); assert.strictEqual(r.drain, false);
  });
  test("非法余额(null/NaN)→ 安全回 {cap:0,drain:false}", () => {
    assert.deepStrictEqual(cloud.computeConvCap(null, 3, true, 0.1), { cap: 0, drain: false });
    assert.deepStrictEqual(cloud.computeConvCap(NaN, 3, true, 0.1), { cap: 0, drain: false });
  });

  // ── 7b. 消息额度上限归一 (messageLimitInt · 服务端要求整数≥1) ──────────────
  //   根因: 旧 setMessageLimit 发 +cap.toFixed(2)(浮点)→ 服务端 422(int_from_float);
  //   cap<1 → 400("must be at least 1")。实测 overage_credits=2.18 等真实余额必为浮点。
  console.log("\n[messageLimitInt]");
  test("浮点 cap 向下取整为整数 (2.18 → 2 · 防 422 int_from_float)", () => {
    assert.strictEqual(cloud.messageLimitInt(2.18), 2);
    assert.strictEqual(cloud.messageLimitInt(66.99), 66);
  });
  test("整数 cap 原样保留 (67 → 67)", () => {
    assert.strictEqual(cloud.messageLimitInt(67), 67);
  });
  test("cap<1 → null (服务端最小 1·不发请求避免 400)", () => {
    assert.strictEqual(cloud.messageLimitInt(0.9), null);
    assert.strictEqual(cloud.messageLimitInt(0), null);
    assert.strictEqual(cloud.messageLimitInt(-5), null);
  });
  test("非法值 → null", () => {
    assert.strictEqual(cloud.messageLimitInt(null), null);
    assert.strictEqual(cloud.messageLimitInt(NaN), null);
    assert.strictEqual(cloud.messageLimitInt(undefined), null);
  });

  // ── 8. 低余额预警 (lowBalanceVerdict · v4.7.5) ───────────────────────────
  console.log("\n[lowBalanceVerdict]");
  test("余额≤阈值且上轮未警 → 本轮发警·置已警", () => {
    assert.deepStrictEqual(cloud.lowBalanceVerdict(2.5, 3, false), { alert: true, alerted: true });
    assert.deepStrictEqual(cloud.lowBalanceVerdict(3, 3, false), { alert: true, alerted: true }); // 边界 = 阈值
  });
  test("余额≤阈值但上轮已警 → 不重复刷屏 (仍保持已警)", () => {
    assert.deepStrictEqual(cloud.lowBalanceVerdict(1, 3, true), { alert: false, alerted: true });
  });
  test("余额回升至阈值之上 → 复位已警 (下次跌破再警)", () => {
    assert.deepStrictEqual(cloud.lowBalanceVerdict(5, 3, true), { alert: false, alerted: false });
  });
  test("余额无法判定(null/NaN) → 不发警·保持上轮态", () => {
    assert.deepStrictEqual(cloud.lowBalanceVerdict(null, 3, true), { alert: false, alerted: true });
    assert.deepStrictEqual(cloud.lowBalanceVerdict(NaN, 3, false), { alert: false, alerted: false });
  });

  // ── 9. 卡死监测 (sessionSignature / stallVerdict · v4.7.5) ─────────────────
  console.log("\n[sessionSignature / stallVerdict]");
  test("签名取状态字段(非标题): 状态相同→指纹相同 (标题变不算进展)", () => {
    const a = cloud.sessionSignature({ statusClass: "running", status: "coding", reason: "", title: "X" });
    const b = cloud.sessionSignature({ statusClass: "running", status: "coding", reason: "", title: "Y 改名了" });
    assert.strictEqual(a, b);
  });
  test("状态推进 → 指纹不同 (有进展)", () => {
    const a = cloud.sessionSignature({ statusClass: "running", status: "coding" });
    const b = cloud.sessionSignature({ statusClass: "running", status: "testing" });
    assert.notStrictEqual(a, b);
  });
  test("无进展时长 ≥ 阈值 → 判卡死", () => {
    assert.strictEqual(cloud.stallVerdict(16 * 60000, 15 * 60000), true);
    assert.strictEqual(cloud.stallVerdict(15 * 60000, 15 * 60000), true); // 边界
  });
  test("无进展时长 < 阈值 → 不判卡死", () => {
    assert.strictEqual(cloud.stallVerdict(5 * 60000, 15 * 60000), false);
  });
  test("阈值≤0(关闭) 或 非法入参 → 永不判卡 (安全)", () => {
    assert.strictEqual(cloud.stallVerdict(99 * 60000, 0), false);
    assert.strictEqual(cloud.stallVerdict(NaN, 15 * 60000), false);
  });

  // ── 10. 对话最终报告 (conversationFinalReport · v4.7.7) ──────────────────────
  console.log("\n[conversationFinalReport]");
  test("finished 对话 → outcome=success + 时长计算正确", () => {
    const now = 1718400000000; // 固定时刻
    const created = new Date(now - 30 * 60000).toISOString(); // 30 分钟前
    const r = cloud.conversationFinalReport(
      { devinId: "dv-123", statusClass: "finished", title: "Fix bug", created_at: created },
      { now }
    );
    assert.strictEqual(r.outcome, "success");
    assert.strictEqual(r.durationMin, 30);
    assert.strictEqual(r.devinId, "dv-123");
    assert.strictEqual(r.title, "Fix bug");
    assert.strictEqual(r.stalled, false);
  });
  test("suspended 对话 → outcome=archived", () => {
    const r = cloud.conversationFinalReport({ statusClass: "suspended" }, {});
    assert.strictEqual(r.outcome, "archived");
  });
  test("blocked + usage reason → outcome=cap_exceeded", () => {
    const r = cloud.conversationFinalReport({ statusClass: "blocked", reason: "Usage limit reached" }, {});
    assert.strictEqual(r.outcome, "cap_exceeded");
  });
  test("blocked + 其他 reason → outcome=blocked", () => {
    const r = cloud.conversationFinalReport({ statusClass: "blocked", reason: "needs input" }, {});
    assert.strictEqual(r.outcome, "blocked");
  });
  test("running + opts.stalled=true → outcome=stalled", () => {
    const r = cloud.conversationFinalReport({ statusClass: "running" }, { stalled: true });
    assert.strictEqual(r.outcome, "stalled");
  });
  test("空输入 → outcome=unknown, 各字段 null (安全·不臆造)", () => {
    const r = cloud.conversationFinalReport(null, {});
    assert.strictEqual(r.outcome, "unknown");
    assert.strictEqual(r.devinId, null);
    assert.strictEqual(r.durationMs, null);
    assert.strictEqual(r.cost, null);
  });
  test("cost 优先级: opts.cost > session.total_cost > session.usage_credits", () => {
    assert.strictEqual(cloud.conversationFinalReport({ total_cost: 5 }, { cost: 3 }).cost, 3);
    assert.strictEqual(cloud.conversationFinalReport({ total_cost: 5, usage_credits: 8 }, {}).cost, 5);
    assert.strictEqual(cloud.conversationFinalReport({ usage_credits: 8 }, {}).cost, 8);
  });

  // ── 11. 综合健康度 (healthScore · v4.7.7) ────────────────────────────────────
  console.log("\n[healthScore]");
  test("全正常(充裕余额·无卡死·无阻塞) → score=100, tier=green", () => {
    const r = cloud.healthScore({ balance: 50, balanceThreshold: 3, stalledCount: 0, blockedCount: 0 });
    assert.strictEqual(r.score, 100);
    assert.strictEqual(r.tier, "green");
  });
  test("余额见底(余额=0) → 扣满余额权重 40", () => {
    const r = cloud.healthScore({ balance: 0, balanceThreshold: 3, stalledCount: 0, blockedCount: 0 });
    assert.strictEqual(r.score, 60);
    assert.strictEqual(r.tier, "amber");
  });
  test("一个卡死 → 扣 15, tier=green (score=85)", () => {
    const r = cloud.healthScore({ balance: 50, balanceThreshold: 3, stalledCount: 1, blockedCount: 0 });
    assert.strictEqual(r.score, 85);
    assert.strictEqual(r.tier, "green");
  });
  test("两个卡死 → 扣 30(封顶), tier=amber (score=70)", () => {
    const r = cloud.healthScore({ balance: 50, balanceThreshold: 3, stalledCount: 2, blockedCount: 0 });
    assert.strictEqual(r.score, 70);
    assert.strictEqual(r.tier, "amber");
  });
  test("阻塞+卡死+低余额 → 三维度叠加, tier=red", () => {
    const r = cloud.healthScore({ balance: 1, balanceThreshold: 3, stalledCount: 2, blockedCount: 2 });
    assert.ok(r.score < 50, "score should be < 50: " + r.score);
    assert.strictEqual(r.tier, "red");
  });
  test("空输入 → score=100 (无异常 = 安全)", () => {
    const r = cloud.healthScore({});
    assert.strictEqual(r.score, 100);
    assert.strictEqual(r.tier, "green");
  });

  // ── 11. devin_proxy · IDE 内置浏览器自足注入反代 (v4.8.2) ──────────────────
  console.log("\n[devin_proxy.buildAuthBridge]");
  const _bridge = proxy.buildAuthBridge("http://localhost:54321", {
    auth1: "auth1_abc123", userId: "user-xyz", orgId: "org-777", orgName: "Acme",
  });
  test("注入 auth1_session 真源登录态 (token+userId)", () => {
    assert.ok(_bridge.includes("setItem('auth1_session'"), "含 auth1_session 写入");
    assert.ok(_bridge.includes("auth1_abc123"), "含 token");
    assert.ok(_bridge.includes("user-xyz"), "含 userId");
  });
  test("注入 org 键 + post-auth 守卫键", () => {
    assert.ok(_bridge.includes("known-org-ids-"), "含 known-org-ids");
    assert.ok(_bridge.includes("last-internal-org-for-external-org-v1-null"), "含 last-internal-org");
    assert.ok(_bridge.includes("post-auth-v3-null-"), "含 post-auth 守卫键");
    assert.ok(_bridge.includes("org-777"), "含 orgId");
  });
  test("拦截 fetch/XHR 挂 Authorization Bearer", () => {
    assert.ok(_bridge.includes("window.fetch=function"), "覆写 fetch");
    assert.ok(_bridge.includes("XMLHttpRequest.prototype.open"), "覆写 XHR.open");
    assert.ok(_bridge.includes("'Bearer '+__a1"), "挂 Bearer 头");
  });
  test("注入值经 JSON 转义·防破坏脚本闭合", () => {
    const b = proxy.buildAuthBridge("http://localhost:1", {
      auth1: "a", userId: "u", orgId: "o", orgName: "x'</script><b>",
    });
    assert.ok(!b.includes("</script><b>"), "恶意 orgName 不得原样落入脚本体");
  });
  console.log("\n[devin_proxy.ensureProxyForAccount]");
  await test("无 auth1 → ok:false (不起反代)", async () => {
    const r = await proxy.ensureProxyForAccount("x@x.com", { auth1: "" });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, "no-auth1");
  });
  await test("持 auth1 → 起本地反代返回端口·同号复用·stop 收束", async () => {
    const a = { auth1: "auth1_t", userId: "user-1", orgId: "org-1", orgName: "O" };
    const r1 = await proxy.ensureProxyForAccount("dup@x.com", a);
    assert.strictEqual(r1.ok, true);
    assert.ok(r1.port > 0, "分得本地端口");
    const r2 = await proxy.ensureProxyForAccount("dup@x.com", a);
    assert.strictEqual(r2.port, r1.port, "同账号复用同端口 (origin 稳定)");
    proxy.stopProxy("dup@x.com");
    const r3 = await proxy.ensureProxyForAccount("dup@x.com", a);
    assert.ok(r3.ok, "收束后可重启");
    proxy.stopAll();
  });

  // ── 11a. 归一 · 公网同源前缀反代 (道并行而不相悖 · /shell 经隧道主口无感传输) ──
  console.log("\n[devin_proxy · 公网同源前缀模式 /i/<accKey>]");
  {
    const pb = proxy.buildAuthBridge("/i/aKEY123", {
      auth1: "auth1_p", userId: "user-p", orgId: "org-p", orgName: "P",
    });
    test("前缀模式: __pfx = /i/<accKey>, app.devin.ai 改指前缀 + 根绝对路径补前缀", () => {
      assert.ok(pb.includes('var __pfx="/i/aKEY123"'), "含 __pfx 前缀常量");
      assert.ok(pb.includes("u=u.split(__abs).join(__pfx)"), "app.devin.ai 绝对 URL 改指前缀");
      assert.ok(pb.includes("u.indexOf(__pfx+'/')!==0"), "SPA 自构造根绝对路径补前缀守卫");
    });
    test("前缀模式: 仍覆写 fetch/XHR/EventSource 补前缀+鉴权 (含 SSE 实时)", () => {
      assert.ok(pb.includes("window.fetch=function"), "覆写 fetch");
      assert.ok(pb.includes("XMLHttpRequest.prototype.open"), "覆写 XHR.open");
      assert.ok(pb.includes("window.EventSource=nES"), "覆写 EventSource(对话实时)");
      assert.ok(pb.includes("'Bearer '+__a1"), "挂 Bearer 头");
    });
    test("前缀模式: localStorage 按 accKey 命名空间隔离 (同源多实例不串号)", () => {
      assert.ok(pb.includes('var P="/i/aKEY123::"'), "命名空间前缀 = accKey::");
      assert.ok(pb.includes("L.getItem=function(k){return og(P+k);}"), "getItem 须加私有前缀");
      assert.ok(pb.includes("L.setItem=function(k,v){return os(P+k,v);}"), "setItem 须加私有前缀");
      assert.ok(/L\.clear=function\(\)\{/.test(pb), "clear 须只清本账号键空间");
    });
    const portB = proxy.buildAuthBridge("http://localhost:5", { auth1: "a", userId: "u", orgId: "o", orgName: "O" });
    test("端口模式向后兼容: __pfx 为空, 不补前缀, 不注入命名空间 shim (零回归)", () => {
      assert.ok(portB.includes('var __pfx=""'), "端口模式 __pfx 空");
      assert.ok(portB.includes("u.split(__abs).join(__pfx)"), "端口模式 app.devin.ai 剥成同源相对");
      assert.ok(!portB.includes("L.getItem=function"), "端口模式不注入 localStorage 命名空间(异 origin 本已隔离)");
    });
    test("devin_proxy.handleRequest 源级: rewriteBase/parseBase 双模 + 缓存按基址重定基", () => {
      const fs = require("fs");
      const src = fs.readFileSync(require("path").join(__dirname, "..", "devin_proxy.js"), "utf8");
      assert.ok(/const isPrefix = localBase\.charAt\(0\) === "\/"/.test(src), "须判前缀模式");
      assert.ok(/const parseBase = isPrefix \? "http:\/\/dao\.local" : localBase/.test(src), "前缀模式须用可解析的 parseBase");
      assert.ok(/hit\.base && hit\.base !== localBase/.test(src), "缓存命中须按当前改写基址重定基(跨端口/前缀复用)");
      assert.ok(/if \(isPrefix\) \{\s*html = html\.replace/.test(src), "前缀模式 index.html 根绝对引用须补前缀");
    });
    test("proxyPrefixed 导出为函数, 无 auth1 → 502 (不反代)", async () => {
      assert.strictEqual(typeof proxy.proxyPrefixed, "function", "proxyPrefixed 须导出");
      let _code = 0;
      const fakeRes = { headersSent: false, writeHead(c) { _code = c; this.headersSent = true; }, end() {} };
      await proxy.proxyPrefixed({ method: "GET", headers: {} }, fakeRes, { auth1: "" }, "/i/x", "/", null);
      assert.strictEqual(_code, 502, "无 auth1 须 502");
    });
  }
  console.log("\n[归一 · _shellResolveOpen 同源 URL + /i/ dao 自渲染 (源级·双副本)]");
  test("rt-flow extension.js: _shellResolveOpen 返回同源 /i/<accKey>/ + 账号注册表 + dao 自渲染入口", () => {
    const fs = require("fs");
    const src = fs.readFileSync(require("path").join(__dirname, "..", "extension.js"), "utf8");
    assert.ok(/const base = '\/i\/' \+ _shellAccKey\(email\)/.test(src), "_shellResolveOpen 须返回同源 /i/<accKey> 而非 localhost:端口");
    assert.ok(/createHmac\('sha256', _shellAccSalt\)/.test(src), "accKey 须 HMAC 不可枚举(防公网猜测)");
    assert.ok(/async function shellAccountProxy\(accKey, restPath, req, res\)/.test(src), "须有 /i/ 入口 shellAccountProxy");
    // 归一架构(用户确认): /i/ 不再反代官网 SPA(Auth0 已挡), 改由 dao 用 auth1 调内部 API 服务端自渲染原生页
    assert.ok(/devinCloud\.buildSessionsListHtml\(/.test(src), "shellAccountProxy 须 dao 自渲染对话列表(非内嵌 SPA)");
    assert.ok(/devinCloud\.buildConversationHtml\(/.test(src), "shellAccountProxy 须 dao 自渲染对话视图");
    assert.ok(/devinCloud\.createSession\(/.test(src), "shellAccountProxy 须支持新建对话(auth1·内部 API)");
    assert.ok(/_shellAccRoute, \/\//.test(src), "须经 _internals 导出 _shellAccRoute(供单测)");
    assert.ok(/shellAccountProxy, \/\//.test(src), "须经 _internals 导出 shellAccountProxy");
  });
  test("dao-vsix src/extension.ts: 9920 主口 /i/<accKey>/* 路由 (dao 自有·免 token·流式)", () => {
    const fs = require("fs");
    const p = require("path").join(__dirname, "..", "..", "dao-vsix", "src", "extension.js");
    const alt = require("path").join(__dirname, "..", "..", "dao-vsix", "src", "extension.ts");
    const src = fs.readFileSync(fs.existsSync(p) ? p : alt, "utf8");
    assert.ok(/route\.startsWith\('\/i\/'\) return false/.test(src) || /route\.startsWith\('\/i\/'\)\) return false/.test(src), "/i/ 须排除官网透传(dao 自有)");
    assert.ok(/&& !route\.startsWith\('\/i\/'\)/.test(src), "/i/ 须免 token (公网设备可直达账号 iframe)");
    assert.ok(/rtint2\.shellAccountProxy\(accKey, restUrl, req, res\)/.test(src), "须委托 rt-flow shellAccountProxy 流式反代");
    assert.ok(/return \{ _streamed: true \}/.test(src), "/i/ 须走流式直通 (HTML/JS/二进制/SSE)");
  });
  test("vendor 同步: dao-vsix/rtflow 含同源前缀传输新码 (源↔打包一致)", () => {
    const fs = require("fs");
    const ven = fs.readFileSync(require("path").join(__dirname, "..", "..", "dao-vsix", "rtflow", "extension.js"), "utf8");
    const venP = fs.readFileSync(require("path").join(__dirname, "..", "..", "dao-vsix", "rtflow", "devin_proxy.js"), "utf8");
    assert.ok(/async function shellAccountProxy\(/.test(ven), "打包副本须含 shellAccountProxy (vendor 未脱钩)");
    assert.ok(/const isPrefix = localBase\.charAt\(0\) === "\/"/.test(venP), "打包 devin_proxy 须含前缀模式");
  });

  // ── 11b. devin_proxy · 磁盘二级缓存 L2 (v4.14.0 · 重载秒恢复 · 跨端口重定基) ──
  console.log("\n[devin_proxy._diskCache · L2]");
  {
    const _fs = require("fs"), _os = require("os"), _path = require("path");
    const dc = proxy._diskCache;
    test("_diskKey 同路同键·异路异键 (sha1 稳定)", () => {
      assert.strictEqual(dc._diskKey("/a.js"), dc._diskKey("/a.js"));
      assert.notStrictEqual(dc._diskKey("/a.js"), dc._diskKey("/b.js"));
    });
    test("_isTextCt: js/css 为文本·字体/图片非文本", () => {
      assert.strictEqual(dc._isTextCt({ "Content-Type": "application/javascript" }), true);
      assert.strictEqual(dc._isTextCt({ "Content-Type": "text/css; charset=utf-8" }), true);
      assert.strictEqual(dc._isTextCt({ "Content-Type": "font/woff2" }), false);
      assert.strictEqual(dc._isTextCt({ "Content-Type": "image/png" }), false);
    });
    test("_rebaseAsset: 文本体端口变则重定基·二进制/同端口不动", () => {
      const from = "http://localhost:1111", to = "http://localhost:2222";
      const js = Buffer.from("fetch('" + from + "/api/x')", "utf8");
      assert.strictEqual(dc._rebaseAsset(js, from, to, true).toString("utf8"), "fetch('" + to + "/api/x')");
      assert.strictEqual(dc._rebaseAsset(js, from, from, true).toString("utf8"), js.toString("utf8"));
      const bin = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff]);
      assert.deepStrictEqual(dc._rebaseAsset(bin, from, to, false), bin);
    });
    await test("_diskPut → _diskGet 往返: status/headers/body/base/text 完整", async () => {
      const tmp = _fs.mkdtempSync(_path.join(_os.tmpdir(), "wamcache-"));
      process.env.WAM_PROXY_CACHE_DIR = tmp;
      assert.strictEqual(dc._diskCacheDir(), tmp);
      const headers = { "Content-Type": "application/javascript", "Cache-Control": "public, max-age=31536000, immutable" };
      const body = Buffer.from("console.log('http://localhost:1234/x')", "utf8");
      dc._diskPut("/assets/app.hash.js", { status: 200, headers, body }, "http://localhost:1234");
      let got = null;
      for (let i = 0; i < 50 && !got; i++) { got = await dc._diskGet("/assets/app.hash.js"); if (!got) await new Promise((r) => setTimeout(r, 20)); }
      assert.ok(got, "磁盘命中");
      assert.strictEqual(got.status, 200);
      assert.strictEqual(got.text, true, "js 标记为文本");
      assert.strictEqual(got.base, "http://localhost:1234");
      assert.strictEqual(got.headers["Content-Type"], "application/javascript");
      assert.strictEqual(got.body.toString("utf8"), body.toString("utf8"));
      const bin = Buffer.from([0, 1, 2, 253, 254, 255]);
      dc._diskPut("/f/font.woff2", { status: 200, headers: { "Content-Type": "font/woff2" }, body: bin }, "http://localhost:1234");
      let g2 = null;
      for (let i = 0; i < 50 && !g2; i++) { g2 = await dc._diskGet("/f/font.woff2"); if (!g2) await new Promise((r) => setTimeout(r, 20)); }
      assert.ok(g2, "二进制磁盘命中");
      assert.strictEqual(g2.text, false);
      assert.deepStrictEqual(g2.body, bin, "二进制字节零损坏");
      delete process.env.WAM_PROXY_CACHE_DIR;
      try { _fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
    });
    await test("_diskGet 未落盘的键 → null", async () => {
      const tmp = _fs.mkdtempSync(_path.join(_os.tmpdir(), "wamcache2-"));
      process.env.WAM_PROXY_CACHE_DIR = tmp;
      const got = await dc._diskGet("/never/written.js");
      assert.strictEqual(got, null);
      delete process.env.WAM_PROXY_CACHE_DIR;
      try { _fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
    });
  }

  // ── 11c. devin_proxy · Service Worker 客户端持久缓存 (根治 IDE 内置 webview 路由慢) ──
  //   真因: 同一反代下, 系统浏览器/手机/单页壳(真浏览器)各快一倍, 唯 IDE 内 webview 慢 —— webview
  //   iframe 不像真浏览器持久缓存哈希不可变资产, 每次导航/切标/重载重取数百分片。注入同源 SW +
  //   CacheStorage 补"浏览器级"缓存: 首载落 Cache, 之后跨导航/重载零代理零上游往返。
  console.log("\n[devin_proxy · Service Worker 客户端持久缓存]");
  {
    const _fs = require("fs"), _path = require("path");
    const src = _fs.readFileSync(_path.join(__dirname, "..", "devin_proxy.js"), "utf8");
    test("SW 脚本: cache-first + 哈希不可变白名单 + skipWaiting/claim + 同源守卫", () => {
      assert.ok(/const _swCode\s*=/.test(src), "须有 _swCode 常量");
      assert.ok(/self\.addEventListener\('install',function\(e\)\{self\.skipWaiting\(\);\}\)/.test(src), "install 须 skipWaiting (即时接管)");
      assert.ok(/self\.clients\.claim\(\)/.test(src), "activate 须 clients.claim (接管现存页)");
      assert.ok(/var IM=\/\\\\\.\(\?:js\|css\|woff2\?/.test(src), "须含哈希不可变资产白名单 IM");
      assert.ok(/if\(url\.origin!==self\.location\.origin\)return;/.test(src), "须只拦同源请求(不碰跨源)");
      assert.ok(/cache\.match\(req\)\.then\(function\(hit\)\{/.test(src) && /if\(hit\)return hit;/.test(src), "须 cache-first (命中直返)");
      assert.ok(/if\(resp&&resp\.status===200\)\{try\{cache\.put/.test(src), "未命中取网络且仅 200 落 Cache");
      assert.ok(/if\(req\.method!=='GET'\)return;/.test(src), "非 GET 不缓存 (动态)");
    });
    test("SW 仅端口模式: 服务 /__dao_sw.js 与 HTML 注册均守 !isPrefix (前缀模式不启用·零相扰)", () => {
      assert.ok(/const _SW_PATH = "\/__dao_sw\.js"/.test(src), "须有 _SW_PATH 常量");
      assert.ok(/if \(!isPrefix && reqUrl\.pathname === _SW_PATH\)/.test(src), "须端口模式就地服务 SW 脚本");
      assert.ok(/"Service-Worker-Allowed": "\/"/.test(src), "SW 脚本须带 Service-Worker-Allowed: / (允许根 scope)");
      assert.ok(/const _swReg\s*=[\s\S]*navigator\.serviceWorker\.register\(/.test(src), "须有 _swReg 注册脚本");
      assert.ok(/if \(!isPrefix\) \{\s*if \(\/<head/.test(src), "HTML 注册须守 !isPrefix (仅端口模式注入)");
    });
    test("SW 注册脚本: 特性检测降级 (无 serviceWorker 即跳过·零回归)", () => {
      assert.ok(/if\('serviceWorker' in navigator\)/.test(src), "须特性检测 navigator.serviceWorker");
      assert.ok(/\.catch\(function\(\)\{\}\)/.test(src), "注册失败须静默 (不阻断页面)");
    });
    test("vendor 同步: dao-vsix/rtflow/devin_proxy.js 含同款 SW (源↔打包一致)", () => {
      const venP = _fs.readFileSync(_path.join(__dirname, "..", "..", "dao-vsix", "rtflow", "devin_proxy.js"), "utf8");
      assert.ok(/const _swCode\s*=/.test(venP), "打包副本须含 _swCode");
      assert.ok(/if \(!isPrefix && reqUrl\.pathname === _SW_PATH\)/.test(venP), "打包副本须含端口模式 SW 服务");
    });
  }

  // ── 11d. dao-vsix · 全池反向注入闭环根治 (此前永不收敛: 144 账号全串行 ~90 分/轮 + inflight 永久死锁) ──
  //   真因经 live 桥实测 ~/.dao/dao-pool-reconcile.log 定位: devinBatchInject 全串行太慢, 久过窗口重启周期 → 永不 DONE;
  //   单进程内该期间一切触发恒 skip=inflight。三修: 有界并发 + 期望态签名快路 + inflight 看门狗(运行令牌)。
  console.log("\n[dao-vsix · 全池反向注入闭环根治]");
  if (HAS_VSIX) {
    const _fs = require("fs"), _path = require("path");
    const ext = _fs.readFileSync(_path.join(__dirname, "..", "..", "dao-vsix", "src", "extension.ts"), "utf8");
    test("有界并发: devinBatchInject 用并发池(worker+next++)取代全串行, 默认 6·可配 1~12", () => {
      assert.ok(/function getBatchInjectConcurrency\(\)/.test(ext), "须有 getBatchInjectConcurrency");
      assert.ok(/batchInjectConcurrency/.test(ext), "须读 dao.batchInjectConcurrency 配置");
      assert.ok(/Math\.min\(12,/.test(ext), "并发度须夹取上限 12");
      assert.ok(/const worker = async \(\): Promise<void> =>/.test(ext), "须有并发 worker");
      assert.ok(/const i = next\+\+;/.test(ext), "worker 须以 next\\+\\+ 取下一个账号(无锁队列)");
      assert.ok(/await Promise\.all\(Array\.from\(\{ length: concurrency \}/.test(ext), "须并发启动 concurrency 个 worker");
    });
    test("期望态签名快路: 已收敛账号经一次廉价 GET 验证后跳过全部上行写入", () => {
      assert.ok(/const INJECT_SIG_FILE = .*dao-inject-sig\.json/.test(ext), "须有 dao-inject-sig.json 缓存文件");
      assert.ok(/function computeOrgInjectSig\(/.test(ext), "须有 computeOrgInjectSig");
      assert.ok(/sigMap\[orgId\] === desiredSig/.test(ext), "须比对缓存 sig == 当前期望 sig");
      assert.ok(/res\.auth = 'skip-converged'/.test(ext), "命中即标 skip-converged 并跳过");
      assert.ok(/if \(res\.ok && orgId\) sigMap\[orgId\] = desiredSig;/.test(ext), "仅成功才落 sig(失败下轮重试)");
    });
    test("inflight 看门狗: 带运行令牌(start 时戳)的时限守卫, 超时新轮接管, 旧轮 finally 不误清", () => {
      assert.ok(/const POOL_RECONCILE_MAX_MS = 20 \* 60 \* 1000;/.test(ext), "须有 20 分看门狗上限");
      assert.ok(/let _poolReconcileStartMs = 0;/.test(ext), "须记录运行起始时戳");
      assert.ok(/if \(age < POOL_RECONCILE_MAX_MS\)/.test(ext), "未超时才 skip=inflight");
      assert.ok(/inflight-stale-reset/.test(ext), "超时须 stale-reset 让新轮接管");
      assert.ok(/const myStart = Date\.now\(\);/.test(ext) && /if \(_poolReconcileStartMs === myStart\) _poolReconcileInflight = false;/.test(ext), "finally 须以令牌守卫, 仅本轮清 inflight");
    });
    test("route-C 订阅半开死链看门狗(与手机版 signal.js v0.37.60 对称): ntfy HTTP 流静默失效不发 FIN/error → 须靠 >90s 无入站主动重连", () => {
      assert.ok(/const SIG_HALFOPEN_MS = 90000;/.test(ext), "须有 SIG_HALFOPEN_MS=90000 半开阈值");
      assert.ok(/const SIG_WATCHDOG_MS = \d+;/.test(ext), "须有 SIG_WATCHDOG_MS 巡检周期");
      assert.ok(/lastRx && Date\.now\(\) - lastRx > SIG_HALFOPEN_MS/.test(ext), "看门狗须 >SIG_HALFOPEN_MS 且 lastRx 非0(未连接不误杀)才判半开");
      assert.ok(/setInterval\(\(\) => \{[\s\S]*?req && req\.destroy\(\)[\s\S]*?\}, SIG_WATCHDOG_MS\)/.test(ext), "半开须 destroy req 触发重连");
      assert.ok(/clearInterval\(wd\)/.test(ext), "close 须清看门狗 timer(不泄漏)");
      const dataIdx = ext.indexOf("res.on('data'");
      assert.ok(dataIdx >= 0 && /lastRx = Date\.now\(\);/.test(ext.slice(dataIdx, dataIdx + 120)), "任何入站(含 keepalive)须刷新 lastRx");
    });
    test("拖拽上传桥契约: webview 面板对话备份 dragstart 亦发 application/x-dao-conv{email,sid} (对齐 /shell·可拖入代理网页上传)", () => {
      const m = ext.match(/function bkConvDragStart\([^)]*\)\{[\s\S]*?\n/);
      assert.ok(m, "须有 bkConvDragStart");
      const fn = m[0];
      assert.ok(/setData\('application\/x-dao-conv',JSON\.stringify\(\{email:[^}]*sid:did/.test(fn), "须发 x-dao-conv 且 sid=devinId(桥读 sid 取 convmd)");
    });
    test("genericWebProxy 套娃多层导航: 除 a[href]/GET表单, 亦拦 JS 整页跳转(location.assign/replace) 改经 /__web", () => {
      assert.ok(/function wrap\(h\)\{if\(typeof h==="string"&&h\.indexOf\(P\)===0\)return h;/.test(ext), "wrap 须防已代理 URL 二次套娃");
      assert.ok(/window\.location\.assign=function\(u\)\{return _asn\(wrap\(u\)\)\}/.test(ext), "须包裹 location.assign 经代理");
      assert.ok(/window\.location\.replace=function\(u\)\{return _rpl\(wrap\(u\)\)\}/.test(ext), "须包裹 location.replace 经代理");
      assert.ok(/var _asn=window\.location\.assign\.bind\(window\.location\);/.test(ext), "_nav 须用原始 assign(绕开自身改写防自陷)");
    });
    test("搜索结果跳转解包: genericWebProxy 入口命中 _unwrapSearchRedirect 即以真实目标递归(点结果不白屏)", () => {
      assert.ok(/function _unwrapSearchRedirect\(u\) \{/.test(ext), "须有 _unwrapSearchRedirect 解包器");
      assert.ok(/const _redir = _unwrapSearchRedirect\(u\);/.test(ext), "genericWebProxy 须调用解包器");
      assert.ok(/if \(_redir && _redir !== u\.href && _redir !== targetUrl\) return await genericWebProxy\(_redir, depth \+ 1\);/.test(ext), "命中须以真实目标递归(防自环)");
      assert.ok(/bing\\.com\$\/\.test\(host\) && \/\^\\\/ck\\\/a/.test(ext), "须解 Bing /ck/a 包装");
      assert.ok(/google\\\.\[a-z\.\]\+\$\/\.test\(host\) && \/\^\\\/url\$/.test(ext), "须解 Google /url 包装");
      assert.ok(/duckduckgo\\.com\$\/\.test\(host\) && \/\^\\\/l\\\/\?\$/.test(ext), "须解 DuckDuckGo /l/ 包装");
    });
    test("搜索结果跳转解包·功能实测: Bing /ck/a(u=a1<b64url>) 还原绝对/相对目标, Google/DDG 取 q/uddg", () => {
      const m = ext.match(/function _unwrapSearchRedirect\(u\) \{[\s\S]*?\n\}/);
      assert.ok(m, "须能抽取 _unwrapSearchRedirect 函数体");
      // eslint-disable-next-line no-eval
      const fn = eval("(" + m[0] + ")");
      const b64url = (s) => Buffer.from(s, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      // 绝对外站目标
      const ck1 = new URL("https://www.bing.com/ck/a?ptn=3&u=a1" + b64url("https://openai.com/news/") + "&ntb=1");
      assert.strictEqual(fn(ck1), "https://openai.com/news/", "Bing ck/a 须还原绝对外站目标");
      // 相对目标(图片标签) → 回落 bing 自身
      const ck2 = new URL("https://www.bing.com/ck/a?u=a1" + b64url("/images/search?q=x"));
      assert.strictEqual(fn(ck2), "https://www.bing.com/images/search?q=x", "Bing ck/a 相对目标须回落引擎自身");
      // Google /url?q=
      assert.strictEqual(fn(new URL("https://www.google.com/url?q=https://example.com/a&sa=U")), "https://example.com/a", "Google /url 须取 q");
      // DuckDuckGo /l/?uddg=
      assert.strictEqual(fn(new URL("https://duckduckgo.com/l/?uddg=" + encodeURIComponent("https://example.org/b"))), "https://example.org/b", "DDG /l/ 须取 uddg");
      // 非跳转页不动(普通站点返回 null)
      assert.strictEqual(fn(new URL("https://openai.com/news/")), null, "普通站点不解包");
      assert.strictEqual(fn(new URL("https://www.bing.com/search?q=x")), null, "Bing 搜索页本身不解包");
    });
  }

  // ── 11. 备份命名/结构 + listBackups (v4.8.3 编号·账号+密码表层·对话/账号信息分明) ──
  console.log("\n[备份命名/结构 · v4.8.3]");
  const fs = require("fs"), os = require("os"), path = require("path");
  test("accountFolderName = 编号_邮箱本地名_密码 (账号+密码写在表层)", () => {
    assert.strictEqual(cloud.accountFolderName({ email: "foo@bar.com" }, { accountNo: 7, password: "Pa ss/w" }), "07_foo_Pass_w");
    assert.strictEqual(cloud.accountFolderName({ email: "x@y.z" }, {}), "x"); // 无编号无密码
  });
  test("cleanTitle 去掉开头的下划线/井号/标点 (不再像系统目录)", () => {
    assert.strictEqual(cloud.cleanTitle("___# Summary"), "Summary");
    assert.strictEqual(cloud.cleanTitle("  ·, 标题"), "标题");
    assert.strictEqual(cloud.cleanTitle(""), "未命名");
  });
  test("convFolderName = NNN_标题_ID末8位 (带编号·三位补零)", () => {
    assert.strictEqual(cloud.convFolderName(3, "_hello_", "devin-abcd1234 effff"), "003_hello__abcd1234");
    assert.ok(cloud.convFolderName(0, "t", "devin-zzzzzzzz").startsWith("t_"));
  });
  test("listBackups 新结构: 读 对话/ + 账号信息 + .account.json 编号·按 convNo 排序", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "rtbk-"));
    const acc = path.join(root, "02_foo_pwd");
    const convDir = path.join(acc, "对话");
    fs.mkdirSync(convDir, { recursive: true });
    fs.writeFileSync(path.join(acc, ".account.json"), JSON.stringify({ email: "foo@bar.com", accountNo: 2 }));
    fs.mkdirSync(path.join(acc, "账号信息"), { recursive: true });
    // 两条对话, 故意乱序写盘, 期望按 convNo 升序
    const c2 = path.join(convDir, "002_b_id2"); fs.mkdirSync(c2);
    fs.writeFileSync(path.join(c2, "_meta.json"), JSON.stringify({ title: "B", eventCount: 5, convNo: 2 }));
    fs.writeFileSync(path.join(c2, "对话.html"), "<html></html>");
    const c1 = path.join(convDir, "001_a_id1"); fs.mkdirSync(c1);
    fs.writeFileSync(path.join(c1, "_meta.json"), JSON.stringify({ title: "A", eventCount: 3, convNo: 1 }));
    const tree = cloud.listBackups(root);
    assert.strictEqual(tree.accounts.length, 1);
    const a = tree.accounts[0];
    assert.strictEqual(a.email, "foo@bar.com");
    assert.strictEqual(a.accountNo, 2);
    assert.strictEqual(a.hasAccountInfo, true);
    assert.strictEqual(a.count, 2);
    assert.strictEqual(a.conversations[0].num, 1, "按 convNo 升序");
    assert.strictEqual(a.conversations[0].title, "A");
    assert.strictEqual(a.conversations[1].hasHtml, true, "B 有 对话.html");
    fs.rmSync(root, { recursive: true, force: true });
  });
  test("listBackups 兼容旧结构: 对话文件夹直接在账号目录下 (无 对话/ 子目录)", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "rtbk-"));
    const acc = path.join(root, "old@x.com");
    const c = path.join(acc, "旧标题_deadbeef"); fs.mkdirSync(c, { recursive: true });
    fs.writeFileSync(path.join(c, "_meta.json"), JSON.stringify({ title: "旧标题", eventCount: 9 }));
    const tree = cloud.listBackups(root);
    assert.strictEqual(tree.accounts.length, 1);
    assert.strictEqual(tree.accounts[0].count, 1);
    assert.strictEqual(tree.accounts[0].conversations[0].title, "旧标题");
    fs.rmSync(root, { recursive: true, force: true });
  });
  test("findAccountDir 经 .account.json 标记定位 (改号不丢已有目录)", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "rtbk-"));
    const acc = path.join(root, "05_who_pw"); fs.mkdirSync(acc, { recursive: true });
    fs.writeFileSync(path.join(acc, ".account.json"), JSON.stringify({ email: "who@a.com", accountNo: 5 }));
    assert.strictEqual(cloud.findAccountDir(root, "who@a.com"), acc);
    assert.strictEqual(cloud.findAccountDir(root, "nobody@a.com"), null);
    fs.rmSync(root, { recursive: true, force: true });
  });

  // ── 对话详情视图 · 思考折叠/可搜索 + 用户消息定位索引 (v4.8.6) ──────────────
  console.log("\n[buildConversationHtml · 详情视图]");
  const _convEvents = [
    { type: "initial_user_message", message: "User: 第一条问题ALPHA" },
    { type: "devin_thoughts", message: "我在思考SECRET方案" },
    { type: "devin_message", message: "这是回复BETA" },
    { type: "user_message", message: "User: 第二条追问GAMMA" },
    { type: "devin_message", message: "再次回复DELTA" },
  ];
  test("思考块默认折叠: CSS 隐藏 .msg-think .body, 点展开/搜索才显", () => {
    const html = cloud.buildConversationHtml("T", "devin-abc", _convEvents, {});
    assert.ok(html.includes(".msg-think .body{display:none}"), "思考默认折叠 CSS");
    assert.ok(html.includes("展开思考"), "有展开思考触发");
    assert.ok(html.includes("body.think-open .msg-think .body{display:block}"), "全局展开开关");
  });
  test("思考内容仍留 DOM (可被搜索命中)", () => {
    const html = cloud.buildConversationHtml("T", "devin-abc", _convEvents, {});
    assert.ok(html.includes("SECRET"), "思考正文在 HTML 中(折叠不删除→可搜索)");
    assert.ok(html.includes("__doSearch") || html.includes("__search"), "内置搜索脚本");
  });
  test("左上角用户消息定位索引: 每条用户消息一行+锚点", () => {
    const html = cloud.buildConversationHtml("T", "devin-abc", _convEvents, {});
    assert.ok(html.includes('id="u1"') && html.includes('id="u2"'), "用户消息锚点 u1/u2");
    assert.ok(html.includes("__jump(1)") && html.includes("__jump(2)"), "索引行可点击跳转");
    assert.ok(html.includes("ni-list"), "索引列表容器");
    assert.ok(!html.includes("__jump(3)"), "仅 2 条用户消息(不含 devin/think)");
  });
  test("摘要取自用户消息前若干字 (去 'User:' 前缀)", () => {
    const html = cloud.buildConversationHtml("T", "devin-abc", _convEvents, {});
    assert.ok(html.includes("第一条问题ALPHA"), "首条用户消息摘要");
    assert.ok(html.includes("第二条追问GAMMA"), "次条用户消息摘要");
  });
  test("富媒体渲染: 图片/视频/链接/裸URL 正确成标签(对齐手机 APK)", () => {
    const evs = [
      { type: "initial_user_message", message: "看图 ![截图](https://app.devin.ai/attachments/x/a.png) 和视频 https://ex.com/v.mp4" },
      { type: "devin_message", message: "文档见 [官网](https://devin.ai/docs) 或直接 https://devin.ai/go 谢谢。" },
      { type: "devin_message", message: "代码里的不该链接: `见 https://in.code/x` 与 ```\nhttps://in.block/y\n```" },
    ];
    const html = cloud.buildConversationHtml("T", "devin-abc", evs, {});
    assert.ok(/<img[^>]+src="https:\/\/app\.devin\.ai\/attachments\/x\/a\.png"/.test(html), "md 图片→<img>");
    assert.ok(/<video[^>]+src="https:\/\/ex\.com\/v\.mp4"/.test(html), "裸视频URL→<video>");
    assert.ok(/<a[^>]+href="https:\/\/devin\.ai\/docs"[^>]*>官网<\/a>/.test(html), "md 链接→<a>带文案");
    assert.ok(/<a[^>]+href="https:\/\/devin\.ai\/go"/.test(html), "裸URL→<a>");
    assert.ok(/结尾标点不吞|谢谢。/.test(html), "尾随中文标点保留(不并入URL)");
    assert.ok(!/<a[^>]+href="https:\/\/in\.code\/x"/.test(html), "行内代码内URL不链接化");
    assert.ok(!/<a[^>]+href="https:\/\/in\.block\/y"/.test(html), "代码块内URL不链接化");
    assert.ok(html.includes(".body .rm-img{"), "富媒体图片样式已注入");
  });
  test("opts.base 注入「返回对话列表」回链 (归一·iframe 内导航回列表)", () => {
    const noBase = cloud.buildConversationHtml("T", "devin-abc", _convEvents, {});
    assert.ok(!/class="back"/.test(noBase), "无 base 时不加回链(备份文件场景)");
    const withBase = cloud.buildConversationHtml("T", "devin-abc", _convEvents, { base: "/i/aKEY" });
    assert.ok(/<a class="back" href="\/i\/aKEY\/"/.test(withBase), "有 base 时回链到 <base>/");
  });

  // ── 归一 · 账号对话列表 (dao 自渲染·Auth0 免疫·手机+电脑一致) ──────────────
  console.log("\n[buildSessionsListHtml · 对话列表(dao 自渲染)]");
  const _sess = [
    { devin_id: "devin-aaa", title: "对话甲ALPHA", status: "running", created_at: 1700000000000 },
    { session_id: "devin-bbb", name: "对话乙BETA", status_enum: "finished" },
    { id: "devin-ccc" },
  ];
  test("每条对话卡片链到 <base>/sessions/<id> (同源相对前缀)", () => {
    const html = cloud.buildSessionsListHtml("u@x.com", _sess, { base: "/i/aKEY", orgName: "OrgZ" });
    assert.ok(html.includes('href="/i/aKEY/sessions/devin-aaa"'), "卡片1 链到 devin-aaa");
    assert.ok(html.includes('href="/i/aKEY/sessions/devin-bbb"'), "卡片2 链到 devin-bbb(session_id)");
    assert.ok(html.includes('href="/i/aKEY/sessions/devin-ccc"'), "卡片3 链到 devin-ccc(id 兜底)");
  });
  test("标题/账号/组织/计数 与状态点呈现", () => {
    const html = cloud.buildSessionsListHtml("u@x.com", _sess, { base: "/i/aKEY", orgName: "OrgZ" });
    assert.ok(html.includes("对话甲ALPHA") && html.includes("对话乙BETA"), "标题渲染");
    assert.ok(html.includes("u@x.com") && html.includes("OrgZ"), "账号+组织");
    assert.ok(html.includes("共 3 个对话"), "对话计数");
    assert.ok(html.includes("st running") && html.includes("st finished"), "状态点分类");
  });
  test("顶部「新建对话」POST 到 <base>/__dao/create (auth1 内部 API)", () => {
    const html = cloud.buildSessionsListHtml("u@x.com", _sess, { base: "/i/aKEY" });
    assert.ok(html.includes('base+"/__dao/create"'), "新建对话 POST 同源相对接口");
    assert.ok(html.includes("data-base=\"/i/aKEY\""), "base 经 data-base 下传脚本");
  });
  test("空列表 / 拉取失败 给出可读原生页(不空白)", () => {
    const empty = cloud.buildSessionsListHtml("u@x.com", [], { base: "/i/aKEY" });
    assert.ok(empty.includes("该账号暂无云端对话"), "空列表提示");
    const errHtml = cloud.buildSessionsListHtml("u@x.com", [], { base: "/i/aKEY", error: "HTTP 502" });
    assert.ok(errHtml.includes("拉取失败: HTTP 502"), "拉取失败提示");
  });
  test("HTML 转义防注入 (标题含 <script>)", () => {
    const html = cloud.buildSessionsListHtml("u@x.com", [{ devin_id: "devin-x", title: "<script>alert(1)</script>" }], { base: "/i/aKEY" });
    assert.ok(!html.includes("<script>alert(1)</script>"), "原样脚本不得进入 DOM");
    assert.ok(html.includes("&lt;script&gt;"), "已转义");
  });


  // ── 前台「极速」下载档 (v4.8.6) ───────────────────────────────────────────
  console.log("\n[turbo 前台极速下载档]");
  test("CFG 含 turbo 档且并发高于 lean 档", () => {
    assert.ok(cloud.CFG.turboDownloadConcurrency > cloud.CFG.downloadConcurrency, "turbo 下载并发 > lean");
    assert.ok(cloud.CFG.turboConvConcurrency > cloud.CFG.convConcurrency, "turbo 对话并发 > lean");
    assert.ok(cloud.CFG.turboMaxSocketsPerHost >= cloud.CFG.turboDownloadConcurrency, "turbo socket 上限覆盖并发");
  });
  test("configure 可调 turbo 档 (软配置)", () => {
    const before = cloud.CFG.turboDownloadConcurrency;
    cloud.configure({ turboDownloadConcurrency: 30 });
    assert.strictEqual(cloud.CFG.turboDownloadConcurrency, 30);
    cloud.configure({ turboDownloadConcurrency: before });
  });

  // ── app 侧 httpsReq 有界 Agent (釜底抽薪根治 conntrack 风暴 v4.8.7) ──
  console.log("\n[httpsReq 有界 Agent · 防 socket 风暴]");
  test("extension.js httpsReq 绑有界 keep-alive Agent (非 globalAgent)", () => {
    const fs = require("fs");
    const src = fs.readFileSync(require("path").join(__dirname, "..", "extension.js"), "utf8");
    assert.ok(/new https\.Agent\(/.test(src), "extension.js 必建有界 https.Agent");
    assert.ok(/maxSockets:\s*HTTP_MAX_SOCKETS_PER_HOST/.test(src), "Agent 必设单 host socket 上限");
    assert.ok(/keepAlive:\s*true/.test(src), "Agent 必 keepAlive 复用");
    assert.ok(/agent:\s*_httpsAgent/.test(src), "httpsReq 必把请求挂到有界 Agent");
  });

  // ── v4.9.0 · 归零移除 + 备份严格校验 (源级护栏 · 防破坏性误删回归) ──
  console.log("\n[v4.9.0 自动清理/归零移除护栏]");
  test("billingBalance: 无订阅且额度0 → 0 (允许归零判定); 有订阅 → 9999 (永不归零); 未知 → null", () => {
    assert.strictEqual(cloud.billingBalance({ has_subscription_or_credits: false, available_credits: 0, overage_credits: 0 }), 0);
    assert.strictEqual(cloud.billingBalance({ has_subscription_or_credits: true, available_credits: 0 }), 9999);
    assert.strictEqual(cloud.billingBalance({ unknown: 1 }), null);
    assert.ok(cloud.billingBalance({ has_subscription_or_credits: false, available_credits: 0, overage_credits: 5 }) > 0);
  });
  test("extension.js: 自动清理须先通过全量备份完整性校验 (未备份不删)", () => {
    const fs = require("fs");
    const src = fs.readFileSync(require("path").join(__dirname, "..", "extension.js"), "utf8");
    assert.ok(/function _dvBackupVerifiedFull\(/.test(src), "须有 _dvBackupVerifiedFull 严格校验");
    assert.ok(/backupOk = _dvBackupVerifiedFull\(backupRes\)/.test(src), "清理前 backupOk 须由校验函数赋值");
    // v4.10.2 先门控后备份: 清理三重闸拆为 外闸(autoCleanup+阈值) + 备份闸(else if (!backupOk) 跳过) — 语义不变
    // 7号板块·闲置触发: 外闸 = autoCleanup + (额度阈值 ∨ 24h 无活跃 idleTrigger)
    assert.ok(/if \(autoCleanup && \(_credits <= cleanupThreshold \|\| idleTrigger\)\)/.test(src), "清理外闸须同时满足 autoCleanup+(阈值∨闲置)");
    assert.ok(/\} else if \(!backupOk\) \{/.test(src), "清理前须有 backupOk 闸 (未全量备份不删)");
    assert.ok(/if \(res\.convError\) return false;/.test(src) && /\(c\.failed \|\| 0\) > 0\) return false/.test(src) && /if \(!s \|\| s\.partial\) return false;/.test(src), "校验须覆盖对话异常/失败/快照部分");
  });
  test("extension.js: 归零移除仅在权威归零+清理无残留时触发, 且循环外统一 removeBatch", () => {
    const fs = require("fs");
    const src = fs.readFileSync(require("path").join(__dirname, "..", "extension.js"), "utf8");
    // 7号板块·闲置触发: 出库阈值闸扩为 (归零阈值 ∨ 24h 无活跃 idleTrigger), 其余三重闸不变
    assert.ok(/if \(autoRemoveZero && wipeClean && !_addedRecently && \(_credits <= removeThreshold \|\| idleTrigger\)\)/.test(src), "移除须 autoRemoveZero+wipeClean+addedAt冷却+(归零阈值∨闲置)四重闸");
    assert.ok(/const wipeClean = .*rep\.sessions\.failed === 0 && rep\.knowledge\.failed === 0 && rep\.playbooks\.failed === 0 && rep\.secrets\.failed === 0/.test(src), "wipeClean 须确认四类痕迹全清无失败");
    assert.ok(/_store\.removeBatch\(idx\)/.test(src), "循环外兜底须走 removeBatch (单次IO+持久化)");
    // v4.26.6 · 即时出库: 条件满足当即 _store.remove 落盘 (中途断不丢), 循环末批处理仅兜底
    assert.ok(/_ei >= 0 && _store\.remove\(_ei\)/.test(src) && /_evictNow\(acc\.email/.test(src), "归零账号即时 _store.remove 落盘出库");
    assert.ok(/removeEmails\.push\(email\)/.test(src), "即时出库失败回落 removeEmails · 循环外兜底再删");
  });
  test("extension.js: 24h冷却锚点不得每周期重置 (v4.10.1 修复归零清理从不触发)", () => {
    const fs = require("fs");
    const src = fs.readFileSync(require("path").join(__dirname, "..", "extension.js"), "utf8");
    // 旧病灶: `if (backupOk) devinCloud.setCleanupState(acc.email, { backupCompletedAt: Date.now() });`
    //   每周期把锚点刷成 now → cooldown 门永不满足 → 归零清理从不触发。修复后禁止此无条件重置。
    assert.ok(!/if \(backupOk\) devinCloud\.setCleanupState\(acc\.email, \{ backupCompletedAt: Date\.now\(\) \}\);/.test(src),
      "禁止每周期无条件重置 backupCompletedAt (会令 24h 冷却永不满足)");
    // 修复后: 落锚点前必先读旧态, 且仅在「无锚点」或「上轮已清理(cleanedAt>=旧锚点)」时才落新锚点。
    assert.ok(/const _cs = devinCloud\.getCleanupState\(acc\.email\);/.test(src), "落锚点前须先读既有冷却态");
    assert.ok(/if \(!_cs \|\| !_cs\.backupCompletedAt \|\| \(_cs\.cleanedAt && _cs\.cleanedAt >= _cs\.backupCompletedAt\)\)/.test(src),
      "仅在无锚点或需开启新一轮时才落 backupCompletedAt");
  });
  test("devin_cloud.isCleanupReady: cooldown/recent_update/already_cleaned 三门语义", () => {
    const now = Date.now(), H = 3600000, cd = 24 * H;
    const em = "cleanupready.test." + now + "@example.invalid";
    try {
      // 无锚点 → no_backup
      assert.strictEqual(cloud.isCleanupReady(em, cd).reason, "no_backup");
      // 锚点在 now → cooldown 未满
      cloud.setCleanupState(em, { backupCompletedAt: now });
      assert.strictEqual(cloud.isCleanupReady(em, cd).ready, false);
      assert.strictEqual(cloud.isCleanupReady(em, cd).reason, "cooldown");
      // 锚点 >24h 前 + 无近更新 → ready
      cloud.setCleanupState(em, { backupCompletedAt: now - 25 * H });
      assert.strictEqual(cloud.isCleanupReady(em, cd).ready, true);
      // 近 24h 有对话更新 → recent_update 挡住
      cloud.setCleanupState(em, { lastConvUpdateAt: now - 1 * H });
      assert.strictEqual(cloud.isCleanupReady(em, cd).reason, "recent_update");
      // 上轮清理(cleanedAt>=锚点)且无新备份 → already_cleaned
      cloud.setCleanupState(em, { lastConvUpdateAt: now - 25 * H, cleanedAt: now - 24 * H });
      assert.strictEqual(cloud.isCleanupReady(em, cd).reason, "already_cleaned");
    } finally {
      // 清理测试残留, 不污染真库
      try {
        const p = require("path").join(require("os").homedir(), ".wam", "devin_cloud", "cleanup_state.json");
        const fs = require("fs");
        if (fs.existsSync(p)) { const all = JSON.parse(fs.readFileSync(p, "utf8")); delete all[em.toLowerCase()]; fs.writeFileSync(p, JSON.stringify(all, null, 2)); }
      } catch (e) {}
    }
  });
  test("devin_cloud.archiveSettledConvZips: 沉寂对话打 ZIP 归档 + 增量免重打; 未沉寂不打", () => {
    const fs = require("fs"), path = require("path"), os = require("os");
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dao-arc-"));
    try {
      const conv = path.join(dir, "对话", "001_测试_abcd1234");
      fs.mkdirSync(path.join(conv, "files"), { recursive: true });
      fs.writeFileSync(path.join(conv, "对话.md"), "# hi");
      fs.writeFileSync(path.join(conv, "files", "a.txt"), "data");
      fs.writeFileSync(path.join(conv, "_meta.json"), JSON.stringify({ devinId: "devin-abcd1234ffff", title: "测试", backedUpAt: new Date(Date.now() - 8 * 86400000).toISOString() }));
      // 沉寂(8天前) → 归档
      let r = cloud.archiveSettledConvZips(dir, {});
      assert.strictEqual(r.archived, 1, "沉寂对话应打 ZIP");
      const zipPath = path.join(dir, "对话", "_归档", "abcd1234_测试.zip");
      assert.ok(fs.existsSync(zipPath), "ZIP 应落在 对话/_归档/");
      // 再跑 → 增量免重打
      r = cloud.archiveSettledConvZips(dir, {});
      assert.strictEqual(r.archived, 0, "ZIP 未落后不应重打");
      assert.ok(r.skipped >= 1);
      // 未沉寂(刚备份) → 不打
      fs.writeFileSync(path.join(conv, "_meta.json"), JSON.stringify({ devinId: "devin-abcd1234ffff", title: "测试", backedUpAt: new Date().toISOString() }));
      const conv2 = path.join(dir, "对话", "002_新_ffff0000");
      fs.mkdirSync(conv2, { recursive: true });
      fs.writeFileSync(path.join(conv2, "_meta.json"), JSON.stringify({ devinId: "devin-ffff0000aaaa", title: "新", backedUpAt: new Date().toISOString() }));
      r = cloud.archiveSettledConvZips(dir, {});
      assert.strictEqual(r.archived, 0, "未沉寂对话不应归档");
    } finally {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
    }
  });
  test("package.json: 自动清理默认开; 归零移除默认开(v4.9.12 闭环)", () => {
    const fs = require("fs");
    const pkg = JSON.parse(fs.readFileSync(require("path").join(__dirname, "..", "package.json"), "utf8"));
    const props = pkg.contributes.configuration.properties;
    assert.strictEqual(props["wam.devinCloudAutoCleanup"].default, true, "自动清理默认开");
    // v4.9.12 · 用户要求: 归零移除默认开 — 闭合 备份→清理→出库 整套循环; 额度彻底归零的账号自动出库
    assert.strictEqual(props["wam.devinCloudAutoRemoveZeroQuota"].default, true, "归零移除默认开(闭环)");
    // v4.26.6 · 出库阈值默认对齐清理阈值(清理即出库·闭环): 残留 $0.x~$2 的耗尽号不再永久滞留仓库
    assert.strictEqual(props["wam.devinCloudAutoRemoveThreshold"].default, 3, "归零阈值默认3(对齐清理阈值·清理即出库)");
  });

  // ── 账号 1:1 同步 (dao-vsix 全能板以 RT Flow 活跃号为唯一权威源 · 源级护栏) ──
  console.log("\n[账号 1:1 同步护栏]");
  test("dao-vsix: 全能板以 RT Flow 活跃号(wam-state.activeEmail)为权威键, 而非 IDE vscdb", () => {
    const fs = require("fs");
    const p = require("path").join(__dirname, "..", "..", "dao-vsix", "src", "extension.js");
    const alt = require("path").join(__dirname, "..", "..", "dao-vsix", "src", "extension.ts");
    const src = fs.readFileSync(fs.existsSync(p) ? p : alt, "utf8");
    assert.ok(/function getRtFlowActiveEmail\(/.test(src), "须有 getRtFlowActiveEmail 读 wam-state.activeEmail");
    assert.ok(/wam-state\.json/.test(src) && /activeEmail/.test(src), "权威源须为 wam-state.activeEmail");
    assert.ok(/const rtEmail = getRtFlowActiveEmail\(\);[\s\S]{0,160}currentIdeEmail = rtEmail/.test(src), "devinAutoChain 须以 RT Flow 活跃号覆盖 IDE 邮箱(auto)");
    assert.ok(/onRtFlowAccountSwitch\(payload/.test(src), "切号广播须把 payload 透传给 onRtFlowAccountSwitch");
    assert.ok(/pEmail && pAuth1 && payload && payload\.orgId/.test(src), "切号须直采广播携带的真 auth1 (免 vscdb 竞态)");
  });
  test("dao-vsix: 1:1 同步守 manual 模式(用户单号粘贴不被 RT Flow 覆盖)", () => {
    const fs = require("fs");
    const p = require("path").join(__dirname, "..", "..", "dao-vsix", "src", "extension.js");
    const alt = require("path").join(__dirname, "..", "..", "dao-vsix", "src", "extension.ts");
    const src = fs.readFileSync(fs.existsSync(p) ? p : alt, "utf8");
    assert.ok(/getAccountSyncMode\(\) !== 'manual'[\s\S]{0,200}getRtFlowActiveEmail/.test(src), "auto 模式才以 RT Flow 活跃号覆盖; manual 保留用户自控");
  });

  // ── F1-F4 切号面板回归 (双副本 rt-flow + dao-vsix 同步) ──
  console.log("\n[F1-F4 切号面板回归]");
  test("F1: 取消追踪叉号 + dvUntrackConv 永久持久 + 过滤", () => {
    const fs = require("fs"), path = require("path");
    for (const rel of dualRels([["..", "extension.js"], ["..", "..", "dao-vsix", "rtflow", "extension.js"]])) {
      const src = fs.readFileSync(path.join(__dirname, ...rel), "utf8");
      assert.ok(/class="dv-trk-x"/.test(src), rel.join("/") + ": 须 dv-trk-x 叉号");
      assert.ok(/case "dvUntrackConv"/.test(src), rel.join("/") + ": 须 dvUntrackConv host 处理");
      assert.ok(/_untrackedConvUuids\.add/.test(src) && /_saveUntrackedToDisk\(\)/.test(src), rel.join("/") + ": 须入永久集+持久化");
      assert.ok(/_untrackedConvUuids\.has\(s\.devinId\)/.test(src), rel.join("/") + ": 活跃集须过滤永久取消的对话");
    }
  });
  test("F2/F3: 去抖签名 _lastRunKey + 易变装饰剔除签名 _convSig + 滚动保持", () => {
    const fs = require("fs"), path = require("path");
    for (const rel of dualRels([["..", "extension.js"], ["..", "..", "dao-vsix", "rtflow", "extension.js"]])) {
      const src = fs.readFileSync(path.join(__dirname, ...rel), "utf8");
      assert.ok(/_lastRunKey/.test(src) && /_lastConvSig/.test(src), rel.join("/") + ": 须去抖签名变量(状态+对话签名)");
      assert.ok(/if\(_rk===_lastRunKey\)return/.test(src), rel.join("/") + ": 状态未变须早返不动 DOM");
      // v4.9.9 真根因: html 串里"· 分隔符+陈旧图标"随 staleSec 0↔>0 出现/消失, 屏蔽数值仍每秒不同 →
      //   签名只取结构性数据(uuid集+硬状态+计数+灯色), 排除一切 staleSec/sizeKB/age/陈旧切换
      assert.ok(/let _convStructSig =/.test(src), rel.join("/") + ": 须结构签名模块变量");
      assert.ok(/_convStructSig = JSON\.stringify\(\{/.test(src), rel.join("/") + ": 须从结构性数据算签名");
      assert.ok(/sig: _convStructSig \|\| _convSig\(html\)/.test(src), rel.join("/") + ": convUpdate 须优先携带结构签名");
      assert.ok(/if\(_sig===_lastConvSig\)return/.test(src), rel.join("/") + ": 签名未变须早返·不换 DOM·根治每秒整段重建");
      // 结构签名 must NOT 含 staleSec/sizeKB/age (否则又被时间滴答击穿)
      const sigBlock = (src.match(/_convStructSig = JSON\.stringify\(\{[\s\S]*?\}\);/) || [""])[0];
      assert.ok(sigBlock && !/staleSec|sizeKB|\bage\b/.test(sigBlock), rel.join("/") + ": 结构签名严禁含 staleSec/sizeKB/age");
    }
  });
  test("F2 根因自证: _convSig 对仅时间/大小变动的对话区返回同签名", () => {
    // 直接验证签名算法本身: 同结构、仅 staleSec/sizeKB/age tooltip 不同 → 签名相等 (否则 DOM 会每秒重建)
    const _convSig = (html) => String(html)
      .replace(/title="[^"]*"/g, "")
      .replace(/\d+(?:\.\d+)?\s*KB/g, "#KB")
      .replace(/\d+\s*min前/g, "#T").replace(/\d+\s*s前/g, "#T")
      .replace(/<span class="cv-stale">[^<]*<\/span>/g, '<span class="cv-stale"></span>')
      .replace(/\s+/g, " ").trim();
    const a = '<div class="conv-section"><span class="cv-dot ok" title="引擎运行中 (pid 123)"></span><div class="cv-current"><b>修Bug</b> · 12KB · 3s前</div><div class="cv-stuck-item"><span class="cv-stale">5s</span></div></div>';
    const b = '<div class="conv-section"><span class="cv-dot ok" title="引擎运行中 (pid 123)"></span><div class="cv-current"><b>修Bug</b> · 48KB · 41s前</div><div class="cv-stuck-item"><span class="cv-stale">2min</span></div></div>';
    assert.strictEqual(_convSig(a), _convSig(b), "仅时间/大小变动 → 签名须相等(不重建)");
    const c = a.replace("修Bug", "改文档"); // 结构性变化(标题文本)
    assert.notStrictEqual(_convSig(a), _convSig(c), "标题文本变化 → 签名须不同(应更新)");
    const d = a.replace('cv-dot ok', 'cv-dot stuck'); // 状态灯变化
    assert.notStrictEqual(_convSig(a), _convSig(d), "状态变化 → 签名须不同(应更新)");
  });
  test("F4: 运行账号顶置 _wamDisplayOrder + 对齐分隔栏 run-sep", () => {
    const fs = require("fs"), path = require("path");
    for (const rel of dualRels([["..", "extension.js"], ["..", "..", "dao-vsix", "rtflow", "extension.js"]])) {
      const src = fs.readFileSync(path.join(__dirname, ...rel), "utf8");
      assert.ok(/function _wamDisplayOrder\(/.test(src) && /function _hasLiveConv\(/.test(src), rel.join("/") + ": 须顶置排序函数");
      assert.ok(/_oi === _liveCount && _liveCount > 0 && _liveCount < _dispOrder\.length/.test(src), rel.join("/") + ": 分隔栏须仅两组非空时插入边界");
      assert.ok(/\.run-sep\{/.test(src), rel.join("/") + ": 须 run-sep 对齐样式");
    }
  });

  test("v4.16.0: 切号多选批量 rt/sb + 对话追踪每行直达", () => {
    const fs = require("fs"), path = require("path");
    for (const rel of dualRels([["..", "extension.js"], ["..", "..", "dao-vsix", "rtflow", "extension.js"]])) {
      const src = fs.readFileSync(path.join(__dirname, ...rel), "utf8");
      const r = rel.join("/");
      // 前端: rt/sb 多选时发批量消息, 否则单账号
      assert.ok(/function rt\(i\)\{[\s\S]*?_selectedFor\(i\)[\s\S]*?routeToIdeBatch/.test(src) && /type:'routeToIde',index:i/.test(src), r + ": rt(i) 须多选发 routeToIdeBatch·单账号回退 routeToIde");
      assert.ok(/function sb\(i\)\{[\s\S]*?_selectedFor\(i\)[\s\S]*?openSysBrowserBatch/.test(src) && /type:'openSysBrowser',index:i/.test(src), r + ": sb(i) 须多选发 openSysBrowserBatch·单账号回退 openSysBrowser");
      // 宿主: 抽出可复用单账号实现 + 四个新 case
      assert.ok(/async function _routeAccountToIde\(i\)/.test(src), r + ": 须抽出 _routeAccountToIde");
      assert.ok(/async function _openAccountSysBrowser\(i\)/.test(src), r + ": 须抽出 _openAccountSysBrowser");
      assert.ok(/case "routeToIdeBatch":/.test(src) && /case "openSysBrowserBatch":/.test(src), r + ": 须有批量 case");
      assert.ok(/case "convRouteToIde":/.test(src) && /case "convOpenSysBrowser":/.test(src), r + ": 须有对话级直达 case");
      // 对话级浏览器须带 pagePath=sessions/<id>
      assert.ok(/pagePath = _sid \? \("sessions\/" \+ _sid\)/.test(src), r + ": convOpenSysBrowser 须导航至该对话 sessions/<id>");
      // 对话追踪每行两按钮
      assert.ok(/data-act="convRt"/.test(src) && /data-act="convSb"/.test(src) && /class="dv-trk-go"/.test(src), r + ": 对话追踪行须有 convRt/convSb 直达按钮");
      assert.ok(/\.dv-trk-go\{/.test(src), r + ": 须 dv-trk-go 样式");
    }
  });

  // ── 归一外壳 /shell 公网多用户隔离 (道并行而不相悖 · 双副本 rt-flow + dao-vsix) ──
  console.log("\n[/shell 多用户会话隔离]");
  test("/shell: 六大板块宿主回推按 sid 隔离, 不再无脑广播 (道并行而不相悖)", () => {
    const fs = require("fs"), path = require("path");
    for (const rel of dualRels([["..", "extension.js"], ["..", "..", "dao-vsix", "rtflow", "extension.js"]])) {
      const src = fs.readFileSync(path.join(__dirname, ...rel), "utf8");
      const r = rel.join("/");
      // 必备: 按会话路由的派发器 + 串行化执行器 + 活跃 sid 锁
      assert.ok(/function _shellCloudDispatch\(/.test(src), r + ": 须 _shellCloudDispatch 按 sid 派发");
      assert.ok(/function _shellCloudRun\(sid, fn\)/.test(src), r + ": 须 _shellCloudRun 串行化执行器");
      assert.ok(/_shellCloudActiveSid/.test(src), r + ": 须活跃 sid 锁");
      // 派发器: 有活跃 sid → 只发该 sid; 无 → 广播 (后台只读刷新)
      assert.ok(/if \(_shellCloudActiveSid\) _shellSend\(_shellCloudActiveSid, \{ type: 'cloudHost'/.test(src), r + ": 有活跃 sid 须仅 _shellSend 给该 sid");
      assert.ok(/else _shellBroadcast\(\{ type: 'cloudHost'/.test(src), r + ": 无活跃 sid(任务间)才广播");
      // cloudInit/cloudRelay/cloudReady 三入口须经 _shellCloudRun 路由
      assert.ok(/case 'cloudInit':[\s\S]{0,260}_shellCloudRun\(sid,/.test(src), r + ": cloudInit 须经 _shellCloudRun(sid,...)");
      assert.ok(/case 'cloudRelay':[\s\S]{0,160}_shellCloudRun\(sid,[\s\S]{0,120}_cloudProvider\.handleMessage/.test(src), r + ": cloudRelay 须经 _shellCloudRun(sid,...) await handleMessage");
      assert.ok(/case 'cloudReady':[\s\S]{0,140}_shellCloudRun\(sid,/.test(src), r + ": cloudReady 须经 _shellCloudRun(sid,...)");
      // 严禁旧病灶: cloudInit 内直接 setHostPost(()=>_shellBroadcast(cloudHost))
      assert.ok(!/setHostPost\(\(mm\) => \{ _shellBroadcast\(\{ type: 'cloudHost'/.test(src), r + ": 严禁 cloudInit 内直接广播式 setHostPost (旧病灶)");
    }
  });

  // ── 归一外壳 /shell 板块菜单与宿主 _solo 白名单一致 (六大板块·无残留死板块 · 双副本) ──
  // 病灶(已修): 7e8fc874 删除 dao-vsix「电脑本体」板块(移出 _solo 白名单/导航/渲染器),
  //   但 rt-flow /shell 的 PAGES/BOARD_META 仍残留 board:computer → 点「操作电脑本体」
  //   openBoard('computer') 发 cloudInit → 宿主 _solo 不含 computer → 静默回落整块全功能面板
  //   (标签叫「操作电脑」却渲染六合一) = 名实不符的死菜单。正法: 菜单板块键 ⊆ {home}∪六大板块。
  console.log("\n[/shell 板块菜单 · 六大板块无残留]");
  test("/shell: PAGES/BOARD_META 板块键 = {home}∪六大板块, 无死板块 computer (双副本)", () => {
    const fs = require("fs"), path = require("path");
    const SOLO = ["overview", "switch", "bridge", "backups", "inject", "mcp"]; // 宿主 _solo 白名单
    const ALLOWED = new Set(["home", ...SOLO]); // home = 六合一整块(非 solo, 合法回落)
    for (const rel of dualRels([["..", "extension.js"], ["..", "..", "dao-vsix", "rtflow", "extension.js"]])) {
      const src = fs.readFileSync(path.join(__dirname, ...rel), "utf8");
      const r = rel.join("/");
      // 严禁死板块 computer 残留在任一副本
      assert.ok(!/board:computer/.test(src), r + ": 严禁残留死菜单 board:computer (7e8fc874 已删该板块)");
      assert.ok(!/\bcomputer:\s*\[/.test(src), r + ": 严禁残留 BOARD_META.computer");
      // PAGES 里所有 board:<key> 必须落在允许集内
      const pageKeys = [...src.matchAll(/'board:([a-z]+)'/g)].map((m) => m[1]);
      assert.ok(pageKeys.length >= 6, r + ": PAGES 至少含六大板块入口");
      for (const k of pageKeys) assert.ok(ALLOWED.has(k), r + ": PAGES 出现非法板块键 board:" + k);
      // 菜单入口齐全: home(六合一·含 overview) + 其余五大 solo 板块各一入口
      // (overview 经 home 整块/面板左导航进入, 不单列菜单项)
      assert.ok(pageKeys.includes("home"), r + ": PAGES 缺六合一主页入口 board:home");
      for (const k of ["switch", "bridge", "backups", "inject", "mcp"]) assert.ok(pageKeys.includes(k), r + ": PAGES 缺板块入口 board:" + k);
    }
  });

  // ── 归一外壳 /shell 宿主→页面双通道 (SSE 快路 + 长轮询回退·过任意代理 · 双副本) ──
  // Cloudflare quick tunnel 等代理会整体缓冲 text/event-stream → 公网用户六板永卡"加载中…"。
  // 正法: SSE 失败/3s 无字节即转 /api/shell/poll 长轮询; 每条消息带 _q 序号跨通道去重。
  console.log("\n[/shell 宿主→页面双通道·长轮询回退]");
  test("/shell: SSE+长轮询双通道, 按 _q 序号去重, 过任意代理 (公网用户六板必达)", () => {
    const fs = require("fs"), path = require("path");
    for (const rel of dualRels([["..", "extension.js"], ["..", "..", "dao-vsix", "rtflow", "extension.js"]])) {
      const src = fs.readFileSync(path.join(__dirname, ...rel), "utf8");
      const r = rel.join("/");
      // 宿主侧: 按 sid 的队列 (带 seq) + 派发器 + 长轮询处理器
      assert.ok(/function _shellQ\(sid\)/.test(src), r + ": 须 _shellQ(sid) 每会话队列");
      assert.ok(/function _shellEmit\(sid, msg\)/.test(src), r + ": 须 _shellEmit(sid,msg) 入队+派发");
      assert.ok(/_q: seq/.test(src), r + ": 每条消息须带 _q 单调序号");
      assert.ok(/_SHELL_Q_MAX/.test(src), r + ": 须每会话队列上限 (回退补发窗口)");
      assert.ok(/function _shellPoll\(sid, after, res\)/.test(src), r + ": 须 _shellPoll(sid,after,res) 长轮询处理器");
      // 派发器须既写 SSE(若在线) 又唤醒长轮询 waiter
      assert.ok(/_shellClients\.get\(sid\)[\s\S]{0,160}res\.write\('data: '/.test(src), r + ": _shellEmit 须写 SSE (在线快路)");
      assert.ok(/q\.waiters\.splice\(0\)/.test(src), r + ": _shellEmit 须唤醒挂起的长轮询 waiter");
      // 客户端垫片: SSE 失败/无字节 → startPoll; pollLoop 打 /api/shell/poll; _q 去重
      assert.ok(/function pollLoop\(\)/.test(src) && /function startPoll\(\)/.test(src), r + ": 客户端须有 pollLoop/startPoll 回退");
      assert.ok(/\/api\/shell\/poll\?sid=/.test(src), r + ": 客户端须打 /api/shell/poll?sid=");
      assert.ok(/if\(m\._q<=lastSeq\)return;lastSeq=m\._q;/.test(src), r + ": 客户端须按 _q 跨通道去重");
      // 宿主重启 → _q 归零 → 客户端 lastSeq 远超 → 旧逻辑恒丢新消息致整页假死。
      // 正法: pollLoop 见服务端 j.last < lastSeq(序号回退=宿主重启) → lastSeq=0 重同步。
      assert.ok(/if\(typeof j\.last==='number'&&j\.last<lastSeq\)\{lastSeq=0;\}/.test(src), r + ": pollLoop 须检测序号回退(宿主重启)并重置 lastSeq=0 (防整页假死)");
      assert.ok(/if\(!gotAny\)startPoll\(\)/.test(src), r + ": SSE 无字节须自动转长轮询");
      // 导出: shellAttach (SSE) + shellPoll (长轮询)
      assert.ok(/shellPoll: _shellPoll/.test(src), r + ": 须导出 shellPoll");
    }
    // dao-vsix HTTP 路由: 须接 /api/shell/poll → rtint.shellPoll
    const ts = fs.readFileSync(path.join(__dirname, "..", "..", "dao-vsix", "src", "extension.ts"), "utf8");
    assert.ok(/route === '\/api\/shell\/poll'/.test(ts), "src/extension.ts: 须路由 /api/shell/poll");
    assert.ok(/rtint\.shellPoll\(sid, after, res\)/.test(ts), "src/extension.ts: /api/shell/poll 须调 rtint.shellPoll(sid,after,res)");
  });

  // ── 归一外壳 /shell 手机/电脑自动识别 + 手机版模式 (红保留·底层换电脑端数据 · 双副本) ──
  // UA 判手机→手机版布局(触控放大·菜单底部抽屉·首屏直开🔀切号), ?m=1/0 可手动覆盖切换;
  // 六板复用电脑端数据源(cloudInit), 红色(切号/对话备份/⬇下载📁备份)布局不变。
  console.log("\n[/shell 手机/电脑自动识别·手机版模式]");
  test("/shell: UA 自动识别手机/电脑 + 手机版模式 (双副本源级护栏)", () => {
    const fs = require("fs"), path = require("path");
    for (const rel of dualRels([["..", "extension.js"], ["..", "..", "dao-vsix", "rtflow", "extension.js"]])) {
      const src = fs.readFileSync(path.join(__dirname, ...rel), "utf8");
      const r = rel.join("/");
      assert.ok(/function _multiShellHtml\(opts\)/.test(src), r + ": _multiShellHtml 须收 opts");
      assert.ok(/var MOBILE=false;/.test(src), r + ": 须 MOBILE 开关默认 false");
      assert.ok(/html\.m #menu\{[^}]*bottom:0/.test(src), r + ": 手机版菜单须底部抽屉 (html.m #menu)");
      assert.ok(/if\(MOBILE\)\{try\{openBoard\('switch'\)/.test(src), r + ": 手机版冷启动须直开🔀切号板块");
      assert.ok(/_u\.searchParams\.set\('m',MOBILE\?'0':'1'\)/.test(src), r + ": 须「切换 电脑/手机版」toggle (改 ?m)");
      assert.ok(/'<!DOCTYPE html><html class="m">'/.test(src) && /'var MOBILE=true;'/.test(src), r + ": 手机版须注入 html.m + MOBILE=true");
      assert.ok(/_multiShellHtml\(\{ mobile: !!opts\.mobile \}\)/.test(src), r + ": _standaloneShellHtml 须透传 mobile");
    }
    // dao-vsix HTTP 路由: 须按 UA 判手机 + ?m 覆盖, 并把 mobile 传入 getStandaloneShellHtml
    const ts = fs.readFileSync(path.join(__dirname, "..", "..", "dao-vsix", "src", "extension.ts"), "utf8");
    assert.ok(/Android\|iPhone\|iPad/.test(ts), "src/extension.ts: 须按 User-Agent 判定移动端");
    assert.ok(/mOverride === '1' \? true : \(mOverride === '0' \? false : uaMobile\)/.test(ts), "src/extension.ts: 须 ?m=1/0 覆盖 UA");
    assert.ok(/getStandaloneShellHtml\(\{ token: ws\.token, port: ws\.port, mobile, alts: dedupeUrls\(shellAlts\) \}\)/.test(ts), "src/extension.ts: 须把 mobile + alts(双重兜底源) 传入 getStandaloneShellHtml");
  });

  // ── /shell 公网单页「双重兜底」失效转移 (参照手机 APK 多路失效转移·双副本源级护栏) ──
  // 病灶: 单页只绑一个公网源, CF 快速隧道轮换/Worker 挂掉 → 整页死链, 无法继续操作。
  // 正法: 宿主把全部公网源注入 DAO_ALTS + 链接携带 ?dao_alt=; 页面长轮询持续失败(≥6次且>15s)
  //   → 逐个 no-cors 探活备用源 /api/health → 探活成功即整页 location.replace 转移续用。
  console.log("\n[/shell 双重兜底失效转移]");
  test("/shell: DAO_ALTS 注入 + 失效转移垫片 + copyBridgeShell 双通道链接 (双副本源级护栏)", () => {
    const fs = require("fs"), path = require("path");
    for (const rel of dualRels([["..", "extension.js"], ["..", "..", "dao-vsix", "rtflow", "extension.js"]])) {
      const src = fs.readFileSync(path.join(__dirname, ...rel), "utf8");
      const r = rel.join("/");
      assert.ok(/window\.DAO_ALTS='\s*\+\s*JSON\.stringify\(alts\)/.test(src), r + ": _standaloneShellHtml 须注入 window.DAO_ALTS");
      assert.ok(/dao_alt/.test(src), r + ": 垫片须支持 ?dao_alt= 备用源");
      assert.ok(/_foFails>=6&&\(Date\.now\(\)-_foT\)>15000/.test(src), r + ": 须持续失败(≥6次且>15s)才触发转移(防抖·本地瞬断不转移)");
      assert.ok(/mode:'no-cors'/.test(src), r + ": 备用源探活须 no-cors fetch /api/health");
      assert.ok(/location\.replace\(base\+'\/shell\?dao_alt='/.test(src), r + ": 探活成功须整页转移到备用源 /shell 并回携原源");
      assert.ok(/connect-src \\'self\\' https:/.test(src), r + ": CSP connect-src 须放开 https:(供备用源探活)");
    }
    const ts = fs.readFileSync(path.join(__dirname, "..", "..", "dao-vsix", "src", "extension.ts"), "utf8");
    assert.ok(/const relay = getPersistentRelayUrl\(\);\s*\n\s*const c = readBridgeConn\(\);/.test(ts), "src/extension.ts: copyBridgeShell 须优先持久化 Worker 地址为主链接");
    assert.ok(/'\/shell' \+ \(alt \? \('\?dao_alt=' \+ encodeURIComponent\(alt\)\) : ''\)/.test(ts), "src/extension.ts: copyBridgeShell 须携带 ?dao_alt= 快速通道兜底");
  });

  // ── Worker 持久通道控制台「为学者日益·闻道者日损」按钮归一 (与快速通道同构) ──
  // 复制地址/复制Token/接入信息 三合一 → 复制接入信息; 重启/重建 二合一 → 重启 Worker(连不上自动升级重建)。
  console.log("\n[Worker 控制台按钮归一]");
  test("Worker 控制台: 三合一复制接入信息 + 重启自动升级重建 (源级护栏)", () => {
    const fs = require("fs"), path = require("path");
    const ts = fs.readFileSync(path.join(__dirname, "..", "..", "dao-vsix", "src", "extension.ts"), "utf8");
    const card = ts.match(/function rBridgeRelayCard\(r\)\{[\s\S]*?\n\}/);
    assert.ok(card, "src/extension.ts: 须有 rBridgeRelayCard");
    assert.ok(!/copyRelayUrl&#39;\)">/.test(card[0]), "Worker 卡片: 不得再有独立「复制地址」按钮");
    assert.ok(!/copyRelayToken/.test(card[0]), "Worker 卡片: 不得再有独立「复制 Token」按钮");
    assert.ok(!/relayRebuild/.test(card[0]), "Worker 卡片: 不得再有独立「重建 Worker」按钮(并入重启)");
    assert.ok(/copyRelayInfo/.test(card[0]) && /copyBridgeShell/.test(card[0]), "Worker 卡片: 须有 复制接入信息 + 复制公网单页网址");
    assert.ok(/自动升级为重建/.test(ts), "relayRestart: 重启失败须自动升级为重建(后端自愈)");
  });

  // ── 反向注入「道并行而不相悖」并发收口 (跨窗口/多IDE/多账号知识库不翻倍) ──
  // 病灶: 多窗口/多IDE 同号并发注入 → devinUpsertKnowledge 旧「list→删同名→建」非原子,
  //   两路各自删后各自建 = 同名知识/内穿MD 翻倍(实测3条→6条)。
  // 护栏: ① applyInjectProfileToOrg 须经 withOrgInjectLock(跨进程文件锁)+ in-flight 合流串行化;
  //       ② 收口点须下沉到 devinUpsertKnowledge 本体 — 任何路径(/api 手动单注·webview·档案整池·
  //          内穿自愈)并发 upsert 同一 org 均经 per-org 锁串行化(实测 /api/devin/knowledge/inject
  //          未收口时 6 路并发→6 条; 下沉后恒收敛单条);
  //       ③ Inner 须 PATCH 原地更新(devinUpdateKnowledge), 不再无脑删尽再建;
  //       ④ 已在锁内的嵌套调用须传 locked=true 旁路, 免 O_EXCL 同进程自死锁。
  console.log("\n[反向注入·道并行而不相悖·并发收口]");
  test("dao-vsix: 反向注入须经 per-org 锁 + upsert 收口下沉 + 幂等 PATCH (源级护栏·防翻倍)", () => {
    const fs = require("fs"), path = require("path");
    const ts = fs.readFileSync(path.join(__dirname, "..", "..", "dao-vsix", "src", "extension.ts"), "utf8");
    // ① per-org 并发收口: in-flight 合流 + 跨进程文件锁
    assert.ok(/const _orgInjectInflight = new Map/.test(ts), "extension.ts: 须有 _orgInjectInflight 进程内合流表");
    assert.ok(/async function withOrgInjectLock\(/.test(ts), "extension.ts: 须有 withOrgInjectLock 跨进程锁封装");
    assert.ok(/fs\.openSync\(lockPath, 'wx'\)/.test(ts), "extension.ts: 文件锁须用 O_EXCL('wx') 原子创建");
    assert.ok(/function applyInjectProfileToOrg\(orgId[^]*?withOrgInjectLock\(key, \(\) => applyInjectProfileToOrgInner/.test(ts),
      "extension.ts: applyInjectProfileToOrg 须经 withOrgInjectLock 包裹 Inner");
    // ② 收口点下沉: devinUpsertKnowledge 包装层须 locked 旁路 + 非锁路径经 withOrgInjectLock 串行化
    assert.ok(/async function devinUpsertKnowledge\(orgId[^]*?locked: boolean = false[^]*?withOrgInjectLock\(orgId, async/.test(ts),
      "extension.ts: devinUpsertKnowledge 须把并发收口下沉到本体(withOrgInjectLock 包裹 Inner, locked 旁路)");
    assert.ok(/async function devinUpsertPlaybook\(orgId[^]*?locked: boolean = false[^]*?withOrgInjectLock\(orgId, async/.test(ts),
      "extension.ts: devinUpsertPlaybook 同样须经 per-org 锁收口");
    // ③ Inner 须 PATCH 原地幂等, 不得退回到「删尽同名→直接新建」的非原子老路
    assert.ok(/async function devinUpsertKnowledgeInner\(orgId[^]*?devinUpdateKnowledge\(orgId, String\(sameName\[0\]\.id\)/.test(ts),
      "extension.ts: devinUpsertKnowledgeInner 须原地 PATCH(devinUpdateKnowledge)首条同名条目");
    // ④ 已在锁内的嵌套调用须 locked=true 旁路(防 O_EXCL 同进程自死锁)
    assert.ok(/devinUpsertKnowledge\(orgId, k\.name, kb, k\.trigger \|\| 'Always', auth1, true\)/.test(ts),
      "extension.ts: applyInjectProfileToOrgInner 内的 upsert 须传 locked=true 旁路");
  });

  // ── PAT 覆盖式更新 (问题④ · 源级护栏) ──
  // 病灶: secrets 端点对同 key 二次 POST 返回 409 且保留旧值 → 用户输入新 PAT 后,
  //   已有 GITHUB_PAT 的账号仍持陈旧 PAT; dao-vsix profile.secrets 同步也「不替换已有」。
  // 护栏: ① ensureGithubPatSecret 默认覆盖(先删旧再注新); ② profile.secrets 同步须以新值替换旧值。
  console.log("\n[PAT 覆盖式更新·源级护栏]");
  test("devin_git.js: ensureGithubPatSecret 默认覆盖 — 先删旧 GITHUB_PAT 再注新值 (双副本)", () => {
    const fs = require("fs"), path = require("path");
    for (const rel of dualRels([["..", "devin_git.js"], ["..", "..", "dao-vsix", "rtflow", "devin_git.js"]])) {
      const src = fs.readFileSync(path.join(__dirname, ...rel), "utf8");
      const r = rel.join("/");
      assert.ok(/async function ensureGithubPatSecret\(auth, pat, opts\)/.test(src), r + ": ensureGithubPatSecret 须收 opts(override)");
      assert.ok(/const override = !opts \|\| opts\.override !== false/.test(src), r + ": 须默认 override=true");
      assert.ok(/if \(override\) \{ try \{ await deleteSecret\(auth, "GITHUB_PAT"\); \} catch \(e\) \{\}/.test(src),
        r + ": 覆盖模式须先删旧 GITHUB_PAT 再注入(409 不改值·不删则新 PAT 永不生效)");
    }
  });
  test("dao-vsix: profile.secrets PAT 同步须覆盖旧值 (不得回退「不替换已有」)", () => {
    const fs = require("fs"), path = require("path");
    const ts = fs.readFileSync(path.join(__dirname, "..", "..", "dao-vsix", "src", "extension.ts"), "utf8");
    assert.ok(/if \(existing\) \{\s*\n\s*if \(existing\.value !== pat\) \{ existing\.value = pat; saveInjectProfile\(profile\); \}/.test(ts),
      "extension.ts: 已有 GITHUB_PAT 时须以新 PAT 覆盖旧值");
    assert.ok(!/不替换已有: 用户已有GITHUB_PAT则保留/.test(ts), "extension.ts: 不得残留「不替换已有」旧逻辑注释");
  });

  // ── 12. 拖拽·指针式收口(原生 HTML5 DnD 在 webview 跨 iframe 丢事件 → 三拖拽全失效) ──
  console.log("\n[webview 拖拽·指针式·道并行]");
  {
    const _fs = require("fs"), _path = require("path");
    const src = _fs.readFileSync(_path.join(__dirname, "..", "extension.js"), "utf8");
    test("拖拽改指针式: startPDrag 引擎 + 拖拽期子 iframe pointer-events:none", () => {
      assert.ok(/function startPDrag\(/.test(src), "须有 startPDrag 指针拖拽引擎");
      assert.ok(/function _pdFramesPE\(off\)/.test(src), "须有 _pdFramesPE(拖拽期子 iframe pointer-events 切换)");
      assert.ok(/style\.pointerEvents=off\?'none':''/.test(src), "拖拽期须把子 iframe pointer-events 置 none, 令父文档恒收 move/up");
    });
    test("三拖拽全改指针式 mousedown(不再依赖原生 draggable/dragstart)", () => {
      assert.ok(/_dEl\('daowin'\)\.addEventListener\('mousedown'/.test(src), "近期/备份卡片须经 mousedown 指针拖拽");
      assert.ok(/_dEl\('dlwin'\)\.addEventListener\('mousedown'/.test(src), "下载列表须经 mousedown 指针拖拽");
      assert.ok(/function enableTabDnD\(btn,id\)\{btn\.draggable=false/.test(src), "标签须 draggable=false 改指针拖拽(原生 DnD 不稳)");
      assert.ok(!/draggable="true" data-cdrag/.test(src) && !/draggable="true" data-dldrag/.test(src), "拖拽卡片不得再用原生 draggable=true(防回退)");
    });
    test("加载防跳伞: 流式增量节流重绘 + 渲染保留滚动位置", () => {
      assert.ok(/function _recRenderThrottled\(\)/.test(src), "须有 _recRenderThrottled 节流(防每包全量重绘跳伞)");
      assert.ok(/var _sc=box\?box\.scrollTop:0/.test(src), "daoRenderRecent 须捕获滚动位置");
      assert.ok(/box\.scrollTop=_sc/.test(src), "渲染后须还原滚动位置(防跳)");
    });
    test("vendor 同步: dao-vsix/rtflow 含指针拖拽收口(源↔打包一致)", () => {
      const ven = _fs.readFileSync(_path.join(__dirname, "..", "..", "dao-vsix", "rtflow", "extension.js"), "utf8");
      assert.ok(/function startPDrag\(/.test(ven), "打包副本须含 startPDrag(vendor 未脱钩)");
      assert.ok(/function _recRenderThrottled\(\)/.test(ven), "打包副本须含防跳伞节流");
    });
  }

  // ── N. fetchEventStreamDetailed · 守柔防误删 (硬拉取失败 ≠ 真空对话) ────────
  // 反者道之动: 备份→归零→出库 的破坏性链路, 唯有「事件流真拿到(200)」才算备齐;
  //   流+兜底皆非 200(403/5xx/限速) → ok:false → 上层计 failed → 校验不过 → 拒删原对话。
  //   真空对话(first-load 返 200 空数组) → ok:true → 可正常清理。本测以本地 http 服务模拟两路。
  console.log("\n[fetchEventStreamDetailed · 守柔防误删]");
  await test("流+兜底皆 403 → ok:false (硬失败·不可据此删原对话)", async () => {
    const prev = { base: cloud.CFG.apiBase, srd: cloud.CFG.streamRetryDelayMs };
    cloud.configure({ streamRetryDelayMs: 1 });
    const server = http.createServer((req, res) => { res.statusCode = 403; res.end("forbidden"); });
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    cloud.configure({ apiBase: "http://127.0.0.1:" + server.address().port });
    try {
      const r = await cloud.fetchEventStreamDetailed({ auth1: "x", orgId: "o", orgBare: "o" }, "abc123");
      assert.strictEqual(r.ok, false, "硬拉取失败须 ok:false");
      assert.deepStrictEqual(r.events, [], "失败时 events 空");
    } finally { server.close(); cloud.configure({ apiBase: prev.base, streamRetryDelayMs: prev.srd }); }
  });
  await test("流非 200 但 first-load 返 200 空数组 → ok:true (真空对话·可清理)", async () => {
    const prev = { base: cloud.CFG.apiBase, srd: cloud.CFG.streamRetryDelayMs };
    cloud.configure({ streamRetryDelayMs: 1 });
    const server = http.createServer((req, res) => {
      if (/\/events\/first-load\//.test(req.url)) { res.statusCode = 200; res.end('{"result":[]}'); }
      else { res.statusCode = 404; res.end("no stream"); }
    });
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    cloud.configure({ apiBase: "http://127.0.0.1:" + server.address().port });
    try {
      const r = await cloud.fetchEventStreamDetailed({ auth1: "x", orgId: "o", orgBare: "o" }, "abc123");
      assert.strictEqual(r.ok, true, "真空对话(first-load 200)须 ok:true");
      assert.deepStrictEqual(r.events, [], "真空对话 events 空");
    } finally { server.close(); cloud.configure({ apiBase: prev.base, streamRetryDelayMs: prev.srd }); }
  });
  await test("getEventStream 薄壳保持旧签名: 恒返数组", async () => {
    const prev = { base: cloud.CFG.apiBase, srd: cloud.CFG.streamRetryDelayMs };
    cloud.configure({ streamRetryDelayMs: 1 });
    const server = http.createServer((req, res) => { res.statusCode = 403; res.end("forbidden"); });
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    cloud.configure({ apiBase: "http://127.0.0.1:" + server.address().port });
    try {
      const ev = await cloud.getEventStream({ auth1: "x", orgId: "o", orgBare: "o" }, "abc123");
      assert.ok(Array.isArray(ev), "getEventStream 恒返数组(非 200 → 空数组·不上抛)");
    } finally { server.close(); cloud.configure({ apiBase: prev.base, streamRetryDelayMs: prev.srd }); }
  });

  // ── 切号激活决策 resolveSwitchActivation (注入降级 · 止 no-active 空转) ──────
  console.log("\n[resolveSwitchActivation]");
  test("注入成功 → 激活·不降级 (Windows 正常路径·行为不变)", () => {
    assert.deepStrictEqual(cloud.resolveSwitchActivation(true, true), { activate: true, degraded: false });
    // 注入成功即激活, tokenVerified 与否不改变结果
    assert.deepStrictEqual(cloud.resolveSwitchActivation(true, false), { activate: true, degraded: false });
  });
  test("注入失败但 token 有效 → 仍激活·降级 (headless/Linux · 止 _tick 空转)", () => {
    assert.deepStrictEqual(cloud.resolveSwitchActivation(false, true), { activate: true, degraded: true });
  });
  test("注入失败且 token 无效 → 不激活 (真失败·不误激活无效号)", () => {
    assert.deepStrictEqual(cloud.resolveSwitchActivation(false, false), { activate: false, degraded: false });
  });

  // ── 对话追踪首行幽灵 (Ask/ada 查询: status=finished 却被判 running · 且无 devin_id) ──
  console.log("\n[对话追踪 · Ask/ada 幽灵行修复]");
  test("classifySession: 顶层 status=finished (ada 查询) → finished 终态, 不再判 running", () => {
    assert.strictEqual(cloud.classifySession({ session_type: "ada", query_id: "-ask_x", status: "finished" }), "finished");
    assert.strictEqual(cloud.classifySession({ status: "done" }), "finished");
    assert.strictEqual(cloud.classifySession({ status: "completed" }), "finished");
  });
  test("devin_cloud.js: _extractDevinId 广谱候选须含 query_id (双副本源级护栏)", () => {
    const fs = require("fs"), path = require("path");
    for (const rel of dualRels([["..", "devin_cloud.js"], ["..", "..", "dao-vsix", "rtflow", "devin_cloud.js"]])) {
      const src = fs.readFileSync(path.join(__dirname, ...rel), "utf8");
      assert.ok(/function _extractDevinId\(/.test(src), rel.join("/") + " 须有 _extractDevinId 广谱提取");
      assert.ok(/s\.query_id/.test(src), rel.join("/") + " 候选字段须含 query_id (ada 查询无 devin_id)");
    }
  });

  // ── 整页翻译跨源自愈: 宿主选同源地址 (旧: 前端自拼 /__web?u= → 点译白屏) ──
  console.log("\n[整页翻译 · 跨源白屏修复]");
  test("extension.js: 翻译跨源重载须走宿主 trReroute, 前端不再自拼 /__web?u= (双副本源级护栏)", () => {
    const fs = require("fs"), path = require("path");
    for (const rel of dualRels([["..", "extension.js"], ["..", "..", "dao-vsix", "rtflow", "extension.js"]])) {
      const src = fs.readFileSync(path.join(__dirname, ...rel), "utf8");
      assert.ok(/type:'trReroute'/.test(src), rel.join("/") + " 前端跨源须 postMessage trReroute 问宿主");
      assert.ok(/trRerouteRes/.test(src), rel.join("/") + " 须处理宿主回包 trRerouteRes");
      assert.ok(/case 'trReroute':/.test(src), rel.join("/") + " /shell 宿主须有 trReroute 处理");
      assert.ok(!/t\.__trRerouted=ru;daoToast\('🌐 经站内代理重载后自动翻译…'\)/.test(src), rel.join("/") + " 旧病灶(前端自拼 /__web 重载)须已移除");
      // Devin 站优先同源反代相对路径(ES module CORS 之避), 其余 http(s) 才走 /__web
      assert.ok(/_shellDevinSameOrigin\(ru\)/.test(src), rel.join("/") + " 宿主须先试 Devin 同源反代路径");
    }
  });

  // ── 汇总 ──────────────────────────────────────────────────────────────────
  console.log("\n──────────────────────────────────────");
  console.log("PASS " + passed + "  FAIL " + failed + (skipped ? "  SKIP " + skipped + " (无 dao-vsix 副本)" : ""));
  if (failed) {
    failures.forEach(([n, e]) => console.log("  ✗ " + n + "\n     " + (e && e.stack || e)));
    process.exit(1);
  }
  console.log("ALL GREEN");
})();
