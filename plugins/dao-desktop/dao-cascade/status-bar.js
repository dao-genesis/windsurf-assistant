// 官方式底部状态栏 —— 与官方 Devin Desktop 右下角状态项 1:1 对齐。
// 官方把账号/套餐/引擎态放在 IDE 状态栏(插件之外的本体 UI); 插件版在此补齐,
// 使"插件内单面板 + 底部状态栏"与官方本体浑然一体。
//   · 主项:  ☯ Devin · <登录名>(未登录时提示登录) → 点击聚焦 Cascade 面板
//   · 模型项: 当前 Cascade 模型 + 规划模式(Write/Plan/…) → 点击聚焦面板换模型
// 数据源与面板同源: hostState(官方本体登录态) + GetUserStatus(套餐/配额)。
const vscode = require("vscode");

const MODE_LABELS = { write: "Write", plan: "Plan", chat: "Chat",
  readOnly: "Read-Only", explore: "Explore", noTool: "No-Tool" };

function createStatusBar(context, viewId) {
  const openCmd = viewId + ".open";

  const main = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 120);
  main.command = openCmd;
  const model = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 119);
  model.command = openCmd;
  context.subscriptions.push(main, model);

  const st = { user: null, plan: null, lsReady: false,
    modelLabel: null, mode: "write",
    dailyPct: null, weeklyPct: null };

  function render() {
    const icon = st.lsReady ? "$(comment-discussion)" : "$(sync~spin)";
    main.text = icon + " Devin" + (st.user ? " · " + st.user : "");
    const tip = new vscode.MarkdownString();
    tip.appendMarkdown("**Devin Desktop · Cascade**\n\n");
    tip.appendMarkdown(st.user ? "账户: " + st.user + "\n\n" : "未登录 —— 点击打开面板登录\n\n");
    if (st.plan) tip.appendMarkdown("套餐: " + st.plan + "\n\n");
    if (st.dailyPct != null) tip.appendMarkdown("当日配额剩余: " + st.dailyPct + "%\n\n");
    if (st.weeklyPct != null) tip.appendMarkdown("本周配额剩余: " + st.weeklyPct + "%\n\n");
    tip.appendMarkdown(st.lsReady ? "language_server: 已连接" : "language_server: 连接中…");
    main.tooltip = tip;
    main.show();

    if (st.modelLabel) {
      model.text = "$(sparkle) " + st.modelLabel +
        (st.mode && st.mode !== "write" ? " · " + (MODE_LABELS[st.mode] || st.mode) : "");
      model.tooltip = "Cascade 当前模型/模式 —— 点击打开面板切换";
      model.show();
    } else model.hide();
  }

  // 套餐/配额与官方账户卡同源(GetUserStatus); LS 就绪后拉一次, 之后低频刷新。
  async function pollPlan() {
    try {
      const ls = require("./ls-bridge");
      if (!ls.ready() || !ls.apiKey()) return;
      const r = await ls.call("GetUserStatus", {});
      const u = (r && r.userStatus) || {};
      const ps = u.planStatus || {};
      st.user = u.name || u.email || st.user;
      st.plan = ((ps.planInfo || {}).planName) || st.plan;
      const num = (x) => (x === undefined || x === null ? null : Math.round(Number(x)));
      st.dailyPct = num(ps.dailyQuotaRemainingPercent);
      st.weeklyPct = num(ps.weeklyQuotaRemainingPercent);
      render();
    } catch (_) {}
  }
  const planTimer = setInterval(pollPlan, 120000);
  context.subscriptions.push({ dispose: () => clearInterval(planTimer) });

  render();
  return {
    set(patch) {
      const hadLs = st.lsReady;
      Object.assign(st, patch);
      render();
      if (!hadLs && st.lsReady) pollPlan();
    },
  };
}

module.exports = { createStatusBar };
