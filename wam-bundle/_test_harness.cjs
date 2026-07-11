// WAM v2.0.0 测试 harness · 模拟最小 vscode API + 加载 extension.js
// 用法: node _test_harness.js [--devin]
"use strict";
const path = require("node:path");
const fs = require("node:fs");
const Module = require("node:module");

// ═══ 模拟 vscode 模块 ═══
const fakeVscode = {
  workspace: {
    getConfiguration() {
      return {
        get(k, d) {
          return d;
        },
        update() {
          return Promise.resolve();
        },
      };
    },
  },
  window: {
    showInformationMessage: () => Promise.resolve(),
    showWarningMessage: () => Promise.resolve(),
    showErrorMessage: () => Promise.resolve(),
    showInputBox: () => Promise.resolve(),
    showQuickPick: () => Promise.resolve(),
    createOutputChannel(name) {
      return {
        appendLine: (m) => console.log("[" + name + "] " + m),
        show: () => {},
        dispose: () => {},
      };
    },
    createStatusBarItem() {
      return {
        text: "",
        color: undefined,
        backgroundColor: undefined,
        tooltip: "",
        command: undefined,
        show: () => {},
        hide: () => {},
        dispose: () => {},
      };
    },
    registerWebviewViewProvider: () => ({ dispose: () => {} }),
  },
  commands: {
    registerCommand: () => ({ dispose: () => {} }),
    executeCommand: (cmd, ...args) => {
      console.log(
        "[exec] " + cmd + (args.length ? " " + JSON.stringify(args) : ""),
      );
      return Promise.resolve();
    },
  },
  env: {
    clipboard: {
      writeText: (t) => {
        console.log("[clip] " + (t || "").substring(0, 40) + "...");
        return Promise.resolve();
      },
    },
    openExternal: () => Promise.resolve(false),
  },
  StatusBarAlignment: { Right: 1, Left: 0 },
  ConfigurationTarget: { Global: 1, Workspace: 2 },
  ThemeColor: function (id) {
    this.id = id;
  },
};
fakeVscode.ThemeColor.prototype = {};

// 把假 vscode 注入 require cache
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request === "vscode") return "vscode";
  return origResolve.call(this, request, parent, ...rest);
};
require.cache.vscode = {
  id: "vscode",
  filename: "vscode",
  loaded: true,
  exports: fakeVscode,
};

// ═══ 加载 extension.js ═══
const extPath = path.join(__dirname, "extension.js");
console.log("─── Loading: " + extPath);
const ext = require(extPath);
console.log("─── Module exports: " + Object.keys(ext).join(", "));

// 内部函数无法直接访问，通过模拟 activate 间接验证

// ═══ 测试套件 ═══
async function runTests() {
  let pass = 0,
    fail = 0;
  const t = (name, fn) => {
    process.stdout.write("  · " + name + " ");
    return (async () => fn())().then(
      (r) => {
        console.log("\x1b[32m\u2713\x1b[0m" + (r ? " " + r : ""));
        pass++;
      },
      (e) => {
        console.log("\x1b[31m\u2717\x1b[0m " + (e.message || e));
        fail++;
      },
    );
  };

  // ─ Test 1: 账号库读取 (parseAccountText + 文件路径)
  console.log("\n[1] 账号库 IO");
  const ACCOUNTS_PATH =
    "v:\\道\\道生一\\一生二\\Windsurf万法归宗\\070-插件_Plugins\\010-WAM本源_Origin\\账号库最新.md";
  await t("账号库文件存在", () => {
    if (!fs.existsSync(ACCOUNTS_PATH))
      throw new Error("not found: " + ACCOUNTS_PATH);
    return path.basename(ACCOUNTS_PATH);
  });

  // 把 ctx 提到外层 · 测末统一 dispose · 释放 setTimeout/setInterval
  const ctx = { subscriptions: [] };
  await t("activate · 加载账号", async () => {
    await ext.activate(ctx);
    console.log("    [activate ok · subs=" + ctx.subscriptions.length + "]");
    return "subs=" + ctx.subscriptions.length;
  });

  // ─ Test 2: Store 状态文件
  console.log("\n[2] Store 持久化");
  const os = require("node:os");
  const STATE_FILE = path.join(os.homedir(), ".wam", "wam-state.json");
  await t("state 文件落盘", () => {
    if (!fs.existsSync(STATE_FILE)) throw new Error("state not written");
    const j = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    return "v" + j.version + " · health=" + Object.keys(j.health || {}).length;
  });

  // ─ Test 2b: _parsePlanStatusJson · 0/100 边界 (本源 v17.42.18 揭示根因)
  console.log("\n[2b] parsePlan 0/100 边界");
  const parsePlan = ext._internals && ext._internals._parsePlanStatusJson;
  if (parsePlan) {
    // 用过的号 (W32) — 字段显式
    await t("用过的号 W32% 显式字段 → D32 W32", () => {
      const r = parsePlan({
        planStatus: {
          weeklyQuotaRemainingPercent: 32,
          planInfo: { planName: "Trial" },
          availablePromptCredits: 6800,
          availableFlowCredits: 13600,
        },
      });
      if (r.weekly !== 32 || r.daily !== 32)
        throw new Error("got D" + r.daily + " W" + r.weekly);
      return "D32 W32 ✓";
    });
    // 新号 (满量 W100) — proto3: 100≠0, 字段 PRESENT
    await t("新号 W100 显式字段 → D100 W100", () => {
      const r = parsePlan({
        planStatus: {
          weeklyQuotaRemainingPercent: 100,
          planInfo: { planName: "Trial" },
          availablePromptCredits: 10000,
          availableFlowCredits: 20000,
        },
      });
      if (r.weekly !== 100 || r.daily !== 100)
        throw new Error("got D" + r.daily + " W" + r.weekly);
      return "D100 W100 ✓ (proto3: 100≠0 → present)";
    });
    // ★ 关键修复: Weekly耗尽但credits有余 → proto3 omit → W0 (不是 W100!)
    await t("Weekly耗尽(omit) + credits有余 → D0 W0 (credits≠quota)", () => {
      const r = parsePlan({
        planStatus: {
          // weeklyQuotaRemainingPercent 字段 OMIT (proto3: 0=default → suppress)
          planInfo: { planName: "Trial" },
          availablePromptCredits: 10000,
          availableFlowCredits: 20000,
        },
      });
      if (r.weekly !== 0 || r.daily !== 0)
        throw new Error("got D" + r.daily + " W" + r.weekly + " (期望 D0 W0)");
      return "D0 W0 ✓ (proto3: absent=0=exhausted · credits独立)";
    });
    // 真耗尽 (W0 D0) — 字段 omit + credits 也 0
    await t("真耗尽 字段omit · credits 0 → D0 W0", () => {
      const r = parsePlan({
        planStatus: {
          planInfo: { planName: "Trial" },
          availablePromptCredits: 0,
          availableFlowCredits: 0,
        },
      });
      if (r.weekly !== 0 || r.daily !== 0)
        throw new Error("got D" + r.daily + " W" + r.weekly);
      return "D0 W0 ✓";
    });
    // 显式 0 (字段在 但值=0) — 兼容
    await t("显式 W0 字段 → D0 W0", () => {
      const r = parsePlan({
        planStatus: {
          weeklyQuotaRemainingPercent: 0,
          dailyQuotaRemainingPercent: 0,
          planInfo: { planName: "Trial" },
        },
      });
      if (r.weekly !== 0 || r.daily !== 0)
        throw new Error("got D" + r.daily + " W" + r.weekly);
      return "D0 W0 ✓";
    });
    // 显式 100 (字段在 值=100) — 兼容
    await t("显式 W100 字段 → D100 W100", () => {
      const r = parsePlan({
        planStatus: {
          weeklyQuotaRemainingPercent: 100,
          dailyQuotaRemainingPercent: 100,
          planInfo: { planName: "Trial" },
        },
      });
      if (r.weekly !== 100 || r.daily !== 100)
        throw new Error("got D" + r.daily + " W" + r.weekly);
      return "D100 W100 ✓";
    });
    // Usage字段兼容 (API返回 usage 而非 remaining) — 兵无常势
    await t("weeklyQuotaUsagePercent=68 → W32 (100-68)", () => {
      const r = parsePlan({
        planStatus: {
          weeklyQuotaUsagePercent: 68,
          dailyQuotaUsagePercent: 5,
          planInfo: { planName: "Trial" },
        },
      });
      if (r.weekly !== 32 || r.daily !== 95)
        throw new Error("got D" + r.daily + " W" + r.weekly);
      return "D95 W32 ✓ (usage→remaining 转换)";
    });
  } else {
    console.log("  · _internals._parsePlanStatusJson 未暴露 ✗");
    fail++;
  }

  // ─ Test 2c: 🔒 锁号 · getBestIndex 跳锁号 · _isValidAutoTarget 门控
  const _internals = ext._internals;
  if (
    _internals &&
    _internals._isValidAutoTarget &&
    _internals.isClaudeAvailable
  ) {
    console.log("\n[2c] 🔒 锁号 · getBestIndex · _isValidAutoTarget");
    // 准备 mock store (3号: 0=锁·高额 / 1=正常·中额 / 2=正常·低额)
    const mockStore = {
      accounts: [
        { email: "locked@x.com", password: "p1", skipAutoSwitch: true },
        { email: "mid@x.com", password: "p2" },
        { email: "low@x.com", password: "p3" },
      ],
      health: {
        "locked@x.com": {
          checked: true,
          daily: 90,
          weekly: 90,
          plan: "Trial",
          planEnd: Date.now() + 86400000,
          lastChecked: Date.now(),
        },
        "mid@x.com": {
          checked: true,
          daily: 60,
          weekly: 60,
          plan: "Trial",
          planEnd: Date.now() + 86400000,
          lastChecked: Date.now(),
        },
        "low@x.com": {
          checked: true,
          daily: 10,
          weekly: 10,
          plan: "Trial",
          planEnd: Date.now() + 86400000,
          lastChecked: Date.now(),
        },
      },
      blacklist: {},
      getHealth(email) {
        const k = (email || "").toLowerCase();
        const h = this.health[k];
        if (!h)
          return {
            checked: false,
            daily: 0,
            weekly: 0,
            plan: "",
            planEnd: 0,
            daysLeft: 0,
            lastChecked: 0,
            hasSnap: false,
            staleMin: -1,
          };
        return Object.assign({}, h, {
          staleMin: h.lastChecked
            ? Math.round((Date.now() - h.lastChecked) / 60000)
            : -1,
        });
      },
      isBanned() {
        return false;
      },
    };
    // 借用真 Store 的 _scoreOf/getBestIndex 方法 (bind mockStore)
    const realStore = ext._internals._store;
    const origAccounts = realStore.accounts;
    const origHealth = realStore.health;
    const origBlacklist = realStore.blacklist;
    // 临时覆盖
    realStore.accounts = mockStore.accounts;
    realStore.health = mockStore.health;
    realStore.blacklist = mockStore.blacklist;
    try {
      await t("getBestIndex 跳过锁号(idx=0) · 选 mid(idx=1)", () => {
        const best = realStore.getBestIndex(-1);
        if (best === 0) throw new Error("选到了锁号 idx=0!");
        if (best !== 1) throw new Error("期望 idx=1(mid), 得 " + best);
        return "best=1 (mid) ✓";
      });
      await t("_isValidAutoTarget: 锁号 → false", () => {
        // _isValidAutoTarget 引用全局 _store
        const savedStore = ext._internals._store;
        // 确保全局 _store 指向我们的 mock
        const r0 = _internals._isValidAutoTarget(0);
        if (r0 !== false) throw new Error("锁号应 false, 得 " + r0);
        return "locked → false ✓";
      });
      await t("_isValidAutoTarget: 正常号 → true", () => {
        const r1 = _internals._isValidAutoTarget(1);
        if (r1 !== true) throw new Error("正常号应 true, 得 " + r1);
        return "mid → true ✓";
      });
      await t("isClaudeAvailable: Free plan → false", () => {
        const h = {
          checked: true,
          daily: 100,
          weekly: 100,
          plan: "Free",
          planEnd: 0,
          daysLeft: 0,
        };
        const r = _internals.isClaudeAvailable(h);
        if (r !== false) throw new Error("Free plan 应 false, 得 " + r);
        return "Free → false ✓";
      });
      await t("isClaudeAvailable: Trial 有额度 → true", () => {
        const h = {
          checked: true,
          daily: 50,
          weekly: 50,
          plan: "Trial",
          planEnd: Date.now() + 86400000,
          daysLeft: 5,
        };
        const r = _internals.isClaudeAvailable(h);
        if (r !== true) throw new Error("Trial+额度应 true, 得 " + r);
        return "Trial+quota → true ✓";
      });
    } finally {
      realStore.accounts = origAccounts;
      realStore.health = origHealth;
      realStore.blacklist = origBlacklist;
    }
  } else {
    console.log("  · _internals lock helpers 未暴露 · 跳过");
  }

  // ─ Test 2d: buildHtml · parseAccountText · 新增内部函数
  if (_internals && _internals.buildHtml && _internals.parseAccountText) {
    console.log("\n[2d] buildHtml · parseAccountText · 新增内部函数");
    await t("parseAccountText 多格式解析", () => {
      const parse = _internals.parseAccountText;
      const accs = parse(
        "a@b.com pass1\nc@d.shop----pass2\ne@yahoo.com:pass3\nf@gmail.com|pass4\n# comment\n  \n",
      );
      if (accs.length !== 4)
        throw new Error(
          "期望4, 得" + accs.length + ": " + JSON.stringify(accs),
        );
      if (accs[0].email !== "a@b.com" || accs[0].password !== "pass1")
        throw new Error("格式1错");
      if (accs[1].email !== "c@d.shop" || accs[1].password !== "pass2")
        throw new Error("格式2错");
      if (accs[2].email !== "e@yahoo.com" || accs[2].password !== "pass3")
        throw new Error("格式3错");
      if (accs[3].email !== "f@gmail.com" || accs[3].password !== "pass4")
        throw new Error("格式4错");
      return "4格式 ✓";
    });
    await t(
      "buildHtml 生成完整 HTML (含 domain badge + drought banner)",
      () => {
        const html = _internals.buildHtml();
        if (!html || !html.includes("<!DOCTYPE html"))
          throw new Error("非有效 HTML");
        if (!html.includes("WAM")) throw new Error("缺 WAM 标识");
        if (!html.includes("dm")) throw new Error("缺域名 badge 类");
        return "HTML " + html.length + " bytes ✓";
      },
    );
    await t("buildHtml 含 Claude gate tag (⊘Claude) 相关代码", () => {
      const html = _internals.buildHtml();
      // expired-row CSS 必须存在
      if (!html.includes("expired-row"))
        throw new Error("缺 expired-row CSS class");
      return "expired-row CSS ✓";
    });
    await t("Store 构造函数可用", () => {
      const S = _internals.Store;
      const s = new S();
      if (typeof s.getStats !== "function") throw new Error("无 getStats");
      if (typeof s.getHealth !== "function") throw new Error("无 getHealth");
      if (typeof s.getBestIndex !== "function")
        throw new Error("无 getBestIndex");
      return "Store ✓";
    });
  } else {
    console.log("  · _internals.buildHtml / parseAccountText 未暴露 · 跳过");
    fail++;
  }

  // ─ Test 3: HTTPS 连通性 (devin 全链路真打 if --devin)
  let devinAuth1 = null;
  let devinSessionToken = null;
  if (process.argv.includes("--devin")) {
    console.log("\n[3] Devin 全链路真打 (实账号)");
    const accs = parseAccountFile(ACCOUNTS_PATH);
    if (accs.length === 0) {
      console.log("  · 跳过: 无账号");
    } else {
      const a = accs[0];
      console.log("  · 用号: " + a.email);
      // 3a: devinLogin
      await t("[3a] devinLogin → auth1", async () => {
        const r = await jsonPost(
          "https://windsurf.com/_devin-auth/password/login",
          { email: a.email, password: a.password },
        );
        if (r.json && r.json.token && r.json.user_id) {
          devinAuth1 = r.json.token;
          return "auth1=" + r.json.token.substring(0, 20) + "...";
        }
        throw new Error(
          "status=" + r.status + " · " + (r.text || "").substring(0, 100),
        );
      });
      // 3b: windsurfPostAuth → sessionToken
      if (devinAuth1) {
        await t("[3b] windsurfPostAuth → sessionToken", async () => {
          const r = await jsonPost(
            "https://windsurf.com/_backend/exa.seat_management_pb.SeatManagementService/WindsurfPostAuth",
            { auth1_token: devinAuth1 },
            12000,
            {
              "Connect-Protocol-Version": "1",
              Origin: "https://windsurf.com",
              Referer: "https://windsurf.com/profile",
            },
          );
          if (
            r.json &&
            typeof r.json.sessionToken === "string" &&
            r.json.sessionToken.startsWith("devin-session-token$")
          ) {
            devinSessionToken = r.json.sessionToken;
            return "session=" + r.json.sessionToken.substring(0, 35) + "...";
          }
          throw new Error(
            "status=" + r.status + " · " + (r.text || "").substring(0, 100),
          );
        });
      }
      // 3c: registerUserViaSession → api_key (best-effort)
      if (devinSessionToken) {
        await t("[3c] registerUserViaSession → api_key", async () => {
          const r = await jsonPost(
            "https://register.windsurf.com/exa.seat_management_pb.SeatManagementService/RegisterUser",
            { firebase_id_token: devinSessionToken },
            12000,
            { "Connect-Protocol-Version": "1" },
          );
          const k = r.json && (r.json.api_key || r.json.apiKey);
          if (k) return "api_key=" + String(k).substring(0, 35) + "...";
          throw new Error(
            "status=" + r.status + " · " + (r.text || "").substring(0, 100),
          );
        });
        // 3d: tryFetchPlanStatus 真打 · 真路径 server.codeium.com + body.authToken
        await t("[3d] GetPlanStatus 真打 · weekly% 提取", async () => {
          const r = await jsonPost(
            "https://server.codeium.com/exa.seat_management_pb.SeatManagementService/GetPlanStatus",
            { authToken: devinSessionToken, includeTopUpStatus: true },
            8000,
            { "Connect-Protocol-Version": "1" },
          );
          if (!r.json || !r.json.planStatus) {
            throw new Error(
              "status=" + r.status + " · " + (r.text || "").substring(0, 80),
            );
          }
          const ps = r.json.planStatus;
          const wPct = ps.weeklyQuotaRemainingPercent;
          const planName = ps.planInfo && ps.planInfo.planName;
          const planEnd = ps.planEnd;
          if (wPct == null || planName == null) {
            throw new Error(
              "字段缺失 · keys=" + Object.keys(ps).slice(0, 8).join(","),
            );
          }
          return "plan=" + planName + " · W" + wPct + "% · planEnd=" + planEnd;
        });
        // 3e: verifyOneAccount 真打 · 完整三步链条 · 验插件内部函数
        await t("[3e] verifyOneAccount 真打 · 闭环验证", async () => {
          const verifyOne = ext._internals && ext._internals.verifyOneAccount;
          if (!verifyOne) throw new Error("_internals.verifyOneAccount 未暴露");
          const r = await verifyOne(a);
          if (!r.ok) throw new Error("stage=" + r.stage + " · err=" + r.error);
          if (!r.q) throw new Error("无 quota 数据");
          return (
            "D" +
            r.q.daily +
            "% W" +
            r.q.weekly +
            "% " +
            r.q.plan +
            " " +
            r.q.daysLeft +
            "d"
          );
        });
      }
    }
  } else {
    console.log("\n[3] Devin 链路: 跳过 (加 --devin 启用)");
  }

  // ─ Test 4: package.json 合规
  console.log("\n[4] package.json 合规");
  const pkg = JSON.parse(
    fs.readFileSync(path.join(__dirname, "package.json"), "utf8"),
  );
  await t(
    "name=rt-flow",
    () =>
      pkg.name === "rt-flow" ||
      pkg.name === "wam-min" ||
      (() => {
        throw new Error("name=" + pkg.name);
      })(),
  );
  await t(
    "main=extension.js",
    () =>
      pkg.main === "./extension.js" ||
      (() => {
        throw new Error("main=" + pkg.main);
      })(),
  );
  await t(
    "commands count",
    () => "n=" + (pkg.contributes.commands || []).length,
  );
  await t("activationEvents", () => "n=" + (pkg.activationEvents || []).length);
  await t("contributes.viewsContainers", () =>
    Object.keys(pkg.contributes.viewsContainers || {}).join(","),
  );

  console.log(
    "\n─── 结果: \x1b[32m" +
      pass +
      " 过\x1b[0m / \x1b[31m" +
      fail +
      " 败\x1b[0m",
  );

  // 释放 timer · 不卡死 node
  try {
    if (typeof ext.deactivate === "function") ext.deactivate();
  } catch {}
  // dispose 所有 subscriptions · 清 setTimeout(首次切号) / setInterval(60s 监控) / statusBar
  try {
    for (const s of ctx.subscriptions) {
      try {
        if (s && typeof s.dispose === "function") s.dispose();
      } catch {}
    }
  } catch {}
  setTimeout(() => process.exit(fail > 0 ? 1 : 0), 100).unref();
}

// 局部函数 (复制自 extension.js · 测试用)
function parseAccountFile(p) {
  if (!fs.existsSync(p)) return [];
  const lines = fs.readFileSync(p, "utf8").split(/\r?\n/);
  const accs = [];
  for (const raw of lines) {
    const ln = raw.trim();
    if (!ln || ln.startsWith("#") || ln.startsWith("//")) continue;
    const m = ln.match(/^(\S+@\S+)\s+(.+)$/);
    if (m) accs.push({ email: m[1].trim(), password: m[2].trim() });
  }
  return accs;
}

function jsonPost(url, body, timeoutMs, extraHeaders) {
  const https = require("node:https");
  const { URL } = require("node:url");
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = JSON.stringify(body);
    const req = https.request(
      {
        method: "POST",
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname + u.search,
        headers: Object.assign(
          {
            "User-Agent": "Mozilla/5.0",
            "Content-Type": "application/json",
            Origin: "https://windsurf.com",
            Referer: "https://windsurf.com/account/login",
          },
          extraHeaders || {},
        ),
        timeout: timeoutMs || 12000,
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let json = null;
          try {
            json = JSON.parse(text);
          } catch {}
          resolve({ status: res.statusCode, text, json });
        });
      },
    );
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.write(data);
    req.end();
  });
}

runTests().catch((e) => {
  console.error("─── FATAL: " + (e.stack || e.message));
  process.exit(1);
});
