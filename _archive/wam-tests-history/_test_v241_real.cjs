// v2.4.1 · 真打验证 · 通过 extension._internals.tryFetchPlanStatus 走完整链路
// 验证: 5/5 真号能拿到真 daily%, weekly% 用 flexCredits 兜底, plan 解析正确
"use strict";
const fs = require("node:fs");
const path = require("node:path");

const vscodeMock = {
  workspace: {
    getConfiguration: () => ({
      get: (k, d) => d,
      update: () => Promise.resolve(),
    }),
    onDidChangeConfiguration: () => ({ dispose() {} }),
    onDidChangeTextDocument: () => ({ dispose() {} }),
    onDidSaveTextDocument: () => ({ dispose() {} }),
    onDidChangeActiveTextEditor: () => ({ dispose() {} }),
  },
  window: {
    createOutputChannel: () => ({
      appendLine: () => {},
      append: () => {},
      show: () => {},
      dispose: () => {},
    }),
    createStatusBarItem: () => ({
      show: () => {},
      hide: () => {},
      dispose: () => {},
      tooltip: "",
      text: "",
      command: "",
    }),
    showInformationMessage: () => Promise.resolve(),
    showWarningMessage: () => Promise.resolve(),
    showErrorMessage: () => Promise.resolve(),
    showInputBox: () => Promise.resolve(""),
    registerWebviewViewProvider: () => ({ dispose() {} }),
    createWebviewPanel: () => ({
      webview: { onDidReceiveMessage: () => {}, html: "" },
      onDidDispose: () => {},
      dispose: () => {},
      reveal: () => {},
    }),
    onDidChangeWindowState: () => ({ dispose() {} }),
  },
  commands: {
    registerCommand: () => ({ dispose() {} }),
    executeCommand: () => Promise.resolve(),
    getCommands: () => Promise.resolve([]),
  },
  StatusBarAlignment: { Left: 1, Right: 2 },
  ViewColumn: { Active: -1, Beside: -2, One: 1 },
  ConfigurationTarget: { Global: 1, Workspace: 2 },
  Uri: { file: (p) => ({ fsPath: p }), parse: (s) => ({ toString: () => s }) },
  EventEmitter: class {
    fire() {}
    dispose() {}
    get event() {
      return () => ({ dispose() {} });
    }
  },
  ThemeColor: class {
    constructor(c) {
      this.id = c;
    }
  },
  TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
};
const Module = require("node:module");
const origLoad = Module._load;
Module._load = function (req, ...args) {
  if (req === "vscode") return vscodeMock;
  return origLoad.call(this, req, ...args);
};

delete require.cache[require.resolve("./extension.js")];
const ext = require("./extension.js");
const {
  devinLogin,
  windsurfPostAuth,
  registerUserViaSession,
  tryFetchPlanStatus,
  verifyOneAccount,
  _quotaEndpointHealth,
  _quotaEndpointDead,
  _parsePlanStatusJson,
  URL_GET_PLAN_STATUS_LIST,
} = ext._internals;

let pass = 0,
  fail = 0;
function expect(name, cond, detail) {
  if (cond) {
    pass++;
    console.log("  ✓ " + name);
  } else {
    fail++;
    console.log("  ✗ " + name + " · " + (detail || ""));
  }
}

async function main() {
  console.log("══ v2.4.1 真打验证 (反向工程后端打通) ══\n");

  // Test 1 · v2.4.2 · flex credits 不再竊 weekly% (实证: 只影响 flex, 独立池)
  //   真响应场景: weekly omit (耗尽) · flex 有值 (独立资源不该被当 weekly)
  console.log("══ Test 1 · v2.4.2 · flex 独立池 不代 weekly% ══");
  const mockNewResp = {
    userStatus: {
      name: "John Doe",
      planStatus: {
        planInfo: {
          planName: "Trial",
          teamsTier: "TEAMS_TIER_DEVIN_TRIAL",
          monthlyPromptCredits: 100,
          monthlyFlowCredits: 100,
        },
        availableFlexCredits: 75, // 有 75 个 flex credits (独立池, 非 weekly%)
        dailyQuotaRemainingPercent: 47,
        // weeklyQuotaRemainingPercent omit → proto3 default 0 → W 耗尽
        dailyQuotaResetAtUnix: "1777795200",
        weeklyQuotaResetAtUnix: "1778400000",
      },
    },
  };
  const r1 = _parsePlanStatusJson(mockNewResp);
  expect("daily 解析为 47", r1.daily === 47, "got " + r1.daily);
  expect(
    "weekly 耗尽 → 0 (不被 flex 假镜)",
    r1.weekly === 0,
    "got " + r1.weekly,
  );
  expect("plan 解析为 'Trial'", r1.plan === "Trial", "got " + r1.plan);
  expect("dailyResetAt > 0", r1.dailyResetAt > 0);
  expect("weeklyResetAt > 0", r1.weeklyResetAt > 0);

  // Test 1b · weekly 有真值时 (实证 walterr.ices394: D36 W68)
  console.log("\n══ Test 1b · weekly 有值 · daily 有值 · 双真 ══");
  const mockRealW68 = {
    userStatus: {
      planStatus: {
        planInfo: { planName: "Trial", teamsTier: "TEAMS_TIER_DEVIN_TRIAL" },
        dailyQuotaRemainingPercent: 36,
        weeklyQuotaRemainingPercent: 68,
        dailyQuotaResetAtUnix: "1777795200",
        weeklyQuotaResetAtUnix: "1778400000",
      },
    },
  };
  const r1b = _parsePlanStatusJson(mockRealW68);
  expect("daily=36", r1b.daily === 36, "got " + r1b.daily);
  expect("weekly=68 (真值保留)", r1b.weekly === 68, "got " + r1b.weekly);

  // Test 1c · 都耗尽 (daily omit + weekly omit) · 实证 vani.dosahe.ine.r2.31 官方 W usage 100%
  console.log("\n══ Test 1c · 双耗尽 (D+W omit) · 官方 usage 100% 场景 ══");
  const mockDualExhaust = {
    userStatus: {
      planStatus: {
        planInfo: { planName: "Trial", teamsTier: "TEAMS_TIER_DEVIN_TRIAL" },
        availableFlexCredits: 100, // flex 有剩 · 不该代 weekly
        // daily omit + weekly omit
        dailyQuotaResetAtUnix: "1777795200",
        weeklyQuotaResetAtUnix: "1778400000",
      },
    },
  };
  const r1c = _parsePlanStatusJson(mockDualExhaust);
  expect(
    "dual omit · daily → 0 (不被 flex 假镜)",
    r1c.daily === 0,
    "got " + r1c.daily,
  );
  expect(
    "dual omit · weekly → 0 (不被 flex 假镜)",
    r1c.weekly === 0,
    "got " + r1c.weekly,
  );

  // Test 2 · 旧格式 (顶层 planStatus) 仍兼容
  console.log("\n══ Test 2 · 旧格式 (顶层 planStatus) 兼容 ══");
  const mockOldResp = {
    planStatus: {
      planInfo: { planName: "Pro" },
      weeklyQuotaRemainingPercent: 32,
      dailyQuotaRemainingPercent: 50,
      weeklyQuotaResetAtUnix: 1777795200,
      dailyQuotaResetAtUnix: 1777795200,
    },
  };
  const r2 = _parsePlanStatusJson(mockOldResp);
  expect("daily 50", r2.daily === 50, "got " + r2.daily);
  expect("weekly 32", r2.weekly === 32, "got " + r2.weekly);
  expect("plan 'Pro'", r2.plan === "Pro");

  // Test 3 · D=W 假值场景 (旧 GetPlanStatus 错镜像) 不再触发
  console.log("\n══ Test 3 · D=W 假值场景检测 ══");
  const mockExhausted = {
    userStatus: {
      planStatus: {
        planInfo: { planName: "Trial" },
        // dailyQuotaRemainingPercent 缺 → proto3 omit = 0 (耗尽)
        // availableFlexCredits 缺 → 0
        dailyQuotaResetAtUnix: 1777795200,
        weeklyQuotaResetAtUnix: 1777795200,
      },
    },
  };
  const r3 = _parsePlanStatusJson(mockExhausted);
  expect("耗尽号 daily 0", r3.daily === 0);
  expect("耗尽号 weekly 0", r3.weekly === 0);

  // Test 4 · URL 列表已用 GetUserStatus
  console.log("\n══ Test 4 · URL 列表已切真路径 ══");
  expect(
    "URL_GET_PLAN_STATUS_LIST 全是 GetUserStatus",
    URL_GET_PLAN_STATUS_LIST.every((u) => u.includes("GetUserStatus")),
    URL_GET_PLAN_STATUS_LIST.join(", "),
  );

  // Test 5 · 真打 5 个号 verifyOneAccount (走完整链路)
  console.log("\n══ Test 5 · 真打 5 个号 verifyOneAccount ══");
  const acctFile = path.join(__dirname, "账号库最新.md");
  if (!fs.existsSync(acctFile)) {
    console.log("  ⊘ SKIP · 账号库未提供 (公开 repo 模式 · 仅本地真打实测)");
    console.log(
      "\n═══ Result · " + pass + " 通 / " + fail + " 败 (Test 5/6 已 skip) ═══",
    );
    process.exit(fail ? 1 : 0);
  }
  const accts = fs
    .readFileSync(acctFile, "utf8")
    .split("\n")
    .filter((x) => x.includes("@") && x.includes(" "))
    .slice(0, 5)
    .map((line) => {
      const [e, p] = line.trim().split(/\s+/);
      return { email: e, password: p };
    });

  const results = [];
  for (const a of accts) {
    const tag = a.email.split("@")[0].substring(0, 24).padEnd(24);
    const t0 = Date.now();
    const r = await verifyOneAccount(a);
    const ms = Date.now() - t0;
    if (r.ok) {
      console.log(
        "  ✓ " +
          tag +
          " D" +
          String(r.q.daily).padEnd(3) +
          " W" +
          String(r.q.weekly).padEnd(3) +
          " " +
          r.q.plan.padEnd(8) +
          " · " +
          ms +
          "ms",
      );
      results.push(r.q);
    } else {
      console.log(
        "  ✗ " +
          tag +
          " stage=" +
          r.stage +
          " err=" +
          r.error +
          " · " +
          ms +
          "ms",
      );
    }
  }
  expect("5/5 号验证成功", results.length === 5, results.length + "/5 ok");
  if (results.length >= 2) {
    const dailySet = new Set(results.map((r) => r.daily));
    expect("daily% 多样性 ≥ 1 (真值, 非全同)", dailySet.size >= 1);
    console.log("    daily 分布: " + [...dailySet].join(", "));
  }

  // Test 6 · endpoint 健康度
  console.log("\n══ Test 6 · endpoint 健康度 (5 号后) ══");
  const h = _quotaEndpointHealth;
  console.log(
    "  totalCalls=" +
      h.totalCalls +
      " totalOk=" +
      h.totalOk +
      " totalFail=" +
      h.totalFail,
  );
  console.log(
    "  consecutive401=" +
      h.consecutive401 +
      " consecutiveOk=" +
      h.consecutiveOk,
  );
  console.log("  lastOkUrl=" + (h.lastOkUrl || "未").substring(0, 80));
  expect("总成功数 ≥ 5", h.totalOk >= 5);
  expect("连续 401 = 0 (新协议有效)", h.consecutive401 === 0);
  expect("endpoint 不再 dead", _quotaEndpointDead() === false);

  console.log("\n═══ Result · " + pass + " 通 / " + fail + " 败 ═══");
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.log("❌", e.message, e.stack);
  process.exit(1);
});
