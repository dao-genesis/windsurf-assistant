// 道 · 编辑器内联键组对位(R158) —— 官方 Devin/Windsurf 编辑器内联操作面的第三方 IDE 还原。
// ─────────────────────────────────────────────────────────────────────────────
// 本源: 官方在编辑器里给三类内联操作(不进 Cascade 面板, 就地作用于当前编辑器):
//   ① 内联命令(Cmd/Ctrl+I): 就地下达自然语言编辑指令(官方 command.open);
//   ② diff zone 接受/拒绝: 对 AI 生成的就地 diff 逐块/整篇 accept/reject;
//   ③ supercomplete / Tab 补全: LS 侧补全(GAP-ANALYSIS 判定官方 GetCompletions 已 deprecated,
//      LS 自身返回 deprecated, 平台不可达 — 此项如实不伪造, 只保留命令占位由宿主官方本体接管)。
//
// 反者道之动: 命令一律先走「官方直通」(devin.* 优先, windsurf.*/内建回退, 逐个尝试至成功),
// 宿主没有官方本体(纯第三方 IDE 且未共生官方 LS UI)时回退到本插件 Cascade 面板承接同一意图,
// 用户体感不割裂。所有命令面板可见、键位与官方一致。
"use strict";
// vscode 惰性获取: 模块可在无 vscode 的 headless 测试环境中加载(仅 register/命令执行期需要)。
function V() { return require("vscode"); }

// 官方候选命令序列(devin.* 优先, windsurf.* 回退)。逐个 executeCommand, 首个成功即止。
const OFFICIAL = {
  inlineCommand: ["devin.prioritized.command.open", "windsurf.prioritized.command.open", "devin.command", "windsurf.command"],
  acceptDiff: ["devin.acceptDiff", "windsurf.acceptDiff", "devin.diffApply", "windsurf.diffApply"],
  rejectDiff: ["devin.rejectDiff", "windsurf.rejectDiff", "devin.diffReject", "windsurf.diffReject"],
  acceptAllDiffs: ["devin.acceptAllDiffs", "windsurf.acceptAllDiffs"],
  rejectAllDiffs: ["devin.rejectAllDiffs", "windsurf.rejectAllDiffs"],
};

// 逐个尝试官方候选命令; 全不可用时返回 false(交由调用方回退)。
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

function register(context, log, opts) {
  const vscode = V();
  const ns = (opts && opts.ns) || "dao";
  const viewId = ns + ".cascade";
  const provider = opts && opts.cascade; // Cascade 面板 provider(承接就地编辑意图)
  const l = (m) => { try { if (log) log("[inline] " + m); } catch (_) {} };

  // 内联命令(Ctrl+I): 官方就地内联命令直通; 无官方本体时把当前选区/光标处带入 Cascade composer
  // 作为「就地编辑」意图承接(体感对位: 用户选中一段代码按 Ctrl+I 即下达改写指令)。
  const inlineCommand = async () => {
    if (await tryOfficial("inlineCommand")) return void l("inlineCommand → 官方直通");
    const ed = vscode.window.activeTextEditor;
    if (!ed) return void vscode.window.showInformationMessage("先在编辑器中打开文件, 再用内联命令 (Ctrl+I)");
    const prompt = await vscode.window.showInputBox({
      prompt: "内联命令 · 就地编辑指令(官方 Cmd/Ctrl+I 对位)",
      placeHolder: "例如: 把这段改成 async/await · 加类型注解 · 修复这个 bug",
    });
    if (prompt === undefined) return;
    const rel = vscode.workspace.asRelativePath(ed.document.uri);
    const sel = ed.selection;
    const has = !sel.isEmpty;
    const code = has ? ed.document.getText(sel).slice(0, 4000) : "";
    const loc = "@" + rel + ":" + (sel.start.line + 1) + (has ? "-" + (sel.end.line + 1) : "");
    let text = "就地编辑 " + loc + " — " + prompt;
    if (has) text += "\n```\n" + code + "\n```";
    await vscode.commands.executeCommand(viewId + ".focus").then(undefined, () => {});
    // 与 explainFix/addFile 同源: 经 Cascade 面板 provider 投递 insert-input 到 composer。
    if (provider && typeof provider._post === "function") provider._post({ type: "insert-input", text });
    l("inlineCommand → Cascade 承接(纯第三方 IDE 回退)");
  };

  const diff = (key, label) => async () => {
    if (await tryOfficial(key)) return void l(key + " → 官方直通");
    vscode.window.showInformationMessage(label + ": 未检出官方 diff zone(需宿主官方本体在跑); 纯第三方 IDE 下 diff 接受/拒绝在 Cascade 面板内进行。");
    l(key + " → 官方 diff zone 不在位, 已提示");
  };

  context.subscriptions.push(
    vscode.commands.registerCommand(viewId + ".inlineCommand", inlineCommand),
    vscode.commands.registerCommand(viewId + ".acceptDiff", diff("acceptDiff", "接受 diff")),
    vscode.commands.registerCommand(viewId + ".rejectDiff", diff("rejectDiff", "拒绝 diff")),
    vscode.commands.registerCommand(viewId + ".acceptAllDiffs", diff("acceptAllDiffs", "接受全部 diff")),
    vscode.commands.registerCommand(viewId + ".rejectAllDiffs", diff("rejectAllDiffs", "拒绝全部 diff"))
  );
  l("编辑器内联键组就位 (inlineCommand/accept·rejectDiff)");
}

module.exports = { register, OFFICIAL, tryOfficial };
