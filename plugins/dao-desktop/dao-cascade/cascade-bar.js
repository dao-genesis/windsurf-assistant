// 道 · Cascade Bar 对位(R159) —— 官方编辑器 diff zone 操作条的第三方 IDE 还原。
// ─────────────────────────────────────────────────────────────────────────────
// 本源(官方 package.json 键位真源, 3.4.27 实测提取):
//   devin.prioritized.cascadeAcceptAllInFile    ctrl+enter
//   devin.prioritized.cascadeRejectAllInFile    shift+ctrl+backspace
//   devin.prioritized.cascadeFocusNextHunk      alt+j
//   devin.prioritized.cascadeFocusPreviousHunk  alt+k
//   devin.prioritized.cascadeAcceptFocusedHunk  alt+enter
//   devin.prioritized.cascadeRejectFocusedHunk  alt+shift+backspace
// 官方 Cascade Bar 是编辑器内浮动操作条(逐 hunk 导航+接受/拒绝)。diff zone 由官方本体
// 在编辑器内渲染 —— 官方本体在位时全部直通; 纯第三方 IDE 无官方本体时如实提示(不伪造)。
// 状态栏 Cascade Bar 段以官方真源数据常显(最近轨迹 diff 行数, GetAllCascadeTrajectories
// 的 diffLinesAdded/Removed), 点击开六键操作面板 —— 可发现性对位官方浮动条。
"use strict";
function V() { return require("vscode"); }

// 官方候选命令序列(devin.* 官方 IDE / windsurf.* Windsurf 系, 首个在位即直通)。
const OFFICIAL = {
  acceptAllInFile: ["devin.prioritized.cascadeAcceptAllInFile", "windsurf.prioritized.cascadeAcceptAllInFile"],
  rejectAllInFile: ["devin.prioritized.cascadeRejectAllInFile", "windsurf.prioritized.cascadeRejectAllInFile"],
  focusNextHunk: ["devin.prioritized.cascadeFocusNextHunk", "windsurf.prioritized.cascadeFocusNextHunk"],
  focusPreviousHunk: ["devin.prioritized.cascadeFocusPreviousHunk", "windsurf.prioritized.cascadeFocusPreviousHunk"],
  acceptFocusedHunk: ["devin.prioritized.cascadeAcceptFocusedHunk", "windsurf.prioritized.cascadeAcceptFocusedHunk"],
  rejectFocusedHunk: ["devin.prioritized.cascadeRejectFocusedHunk", "windsurf.prioritized.cascadeRejectFocusedHunk"],
};

async function tryOfficial(key) {
  const vscode = V();
  const cmds = await vscode.commands.getCommands(true).catch(() => []);
  for (const c of OFFICIAL[key] || []) {
    if (cmds.includes(c)) {
      try { await vscode.commands.executeCommand(c); return true; } catch (_) {}
    }
  }
  return false;
}

// 最近轨迹 diff 水位(官方真源 GetAllCascadeTrajectories.diffLinesAdded/Removed)。
async function diffStat() {
  try {
    const ls = require("./ls-bridge");
    if (!ls.ready()) return null;
    const r = await ls.call("GetAllCascadeTrajectories", {});
    const s = (r && r.trajectorySummaries) || {};
    const arr = Array.isArray(s) ? s : Object.keys(s).map((k) => Object.assign({ cascadeId: k }, s[k]));
    let add = 0, del = 0;
    for (const t of arr) { add += Number(t.diffLinesAdded || 0); del += Number(t.diffLinesRemoved || 0); }
    return { trajectories: arr.length, diffLinesAdded: add, diffLinesRemoved: del };
  } catch (_) { return null; }
}

const ITEMS = [
  { key: "focusNextHunk", label: "$(arrow-down) 下一个 hunk", desc: "Alt+J · 官方 cascadeFocusNextHunk" },
  { key: "focusPreviousHunk", label: "$(arrow-up) 上一个 hunk", desc: "Alt+K · 官方 cascadeFocusPreviousHunk" },
  { key: "acceptFocusedHunk", label: "$(check) 接受当前 hunk", desc: "Alt+Enter · 官方 cascadeAcceptFocusedHunk" },
  { key: "rejectFocusedHunk", label: "$(close) 拒绝当前 hunk", desc: "Alt+Shift+Backspace · 官方 cascadeRejectFocusedHunk" },
  { key: "acceptAllInFile", label: "$(check-all) 接受本文件全部", desc: "Ctrl+Enter · 官方 cascadeAcceptAllInFile" },
  { key: "rejectAllInFile", label: "$(clear-all) 拒绝本文件全部", desc: "Ctrl+Shift+Backspace · 官方 cascadeRejectAllInFile" },
];

function register(context, log) {
  const vscode = V();
  const l = (m) => { try { if (log) log("[cascade-bar] " + m); } catch (_) {} };

  // 高频键(如 Ctrl+Enter)未命中官方时只做瞬时状态栏提示, 不弹窗打断输入流。
  const run = (key) => async () => {
    if (await tryOfficial(key)) return void l(key + " → 官方直通");
    vscode.window.setStatusBarMessage("$(info) Cascade Bar · " + key + ": 官方 diff zone 不在位(改动在 Cascade 面板内接受/拒绝)", 2500);
    l(key + " → 官方 diff zone 不在位, 已提示");
  };

  // 操作面板(六键) + 状态栏常显段(官方浮动条的可发现性对位)。
  const open = async () => {
    const st = await diffStat();
    const head = st ? `轨迹 ${st.trajectories} · diff +${st.diffLinesAdded}/-${st.diffLinesRemoved}(官方真源)` : "官方 LS 未就绪(diff 水位不可读)";
    const pick = await vscode.window.showQuickPick(
      ITEMS.map((i) => ({ label: i.label, description: i.desc, key: i.key })),
      { placeHolder: "Cascade Bar · " + head }
    );
    if (pick) await run(pick.key)();
  };

  const bar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 96);
  bar.text = "$(diff) Cascade Bar";
  bar.tooltip = "官方 Cascade Bar 对位: hunk 导航/接受/拒绝(键位与官方一致); 点击开操作面板";
  bar.command = "dao.cascade.cascadeBar";
  bar.show();
  context.subscriptions.push(bar);

  context.subscriptions.push(
    vscode.commands.registerCommand("dao.cascade.cascadeBar", open),
    vscode.commands.registerCommand("dao.cascade.nextDiffHunk", run("focusNextHunk")),
    vscode.commands.registerCommand("dao.cascade.prevDiffHunk", run("focusPreviousHunk")),
    vscode.commands.registerCommand("dao.cascade.acceptFocusedHunk", run("acceptFocusedHunk")),
    vscode.commands.registerCommand("dao.cascade.rejectFocusedHunk", run("rejectFocusedHunk")),
    vscode.commands.registerCommand("dao.cascade.acceptAllInFile", run("acceptAllInFile")),
    vscode.commands.registerCommand("dao.cascade.rejectAllInFile", run("rejectAllInFile"))
  );
  l("Cascade Bar 就位(六键 + 状态栏段)");
}

module.exports = { register, OFFICIAL, tryOfficial, diffStat, ITEMS };
