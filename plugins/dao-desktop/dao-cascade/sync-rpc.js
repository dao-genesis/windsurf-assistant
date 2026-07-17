// 道 · RPC 层同步活体验证(官方 LS 运行态写后复读) —— R155, 补 R153 文件类之外的 RPC 面。
// ─────────────────────────────────────────────────────────────────────────────
// R153 sync-audit 证的是「文件类真源归一」(直读直写同一份官方落盘); 本模块证 RPC 类:
// 经官方 LS 运行态(共生发现或 ls-boot 自持拉起, 与官方 IDE 同一二进制/登录态/codeium_dir)
// 做「写→复读→还原」活体串测, 且定制类同时核验 RPC 写与官方文件真源双向可见(RPC 创建
// 落官方目录、删文件后 RPC 列表即失), 即 RPC 面与文件面同一真源的实证。
// 实测契约(2026-07 · LS 3.4.27):
//   · GetUserSettings/SetUserSettings: proto3 JSON 省缺省值 —— bool false 被省略,
//     比对必须以 !!field 归一, 否则误判「未写入」。
//   · CreateCustomizationFile{fileName,fileType:CUSTOMIZATION_FILE_TYPE_GLOBAL_WORKFLOWS}
//     → filePath 落 ~/.codeium/windsurf/global_workflows/ (官方真源);
//     RefreshCustomization 后 GetAllWorkflows 即列出; 删文件+Refresh 即消失。
"use strict";
const fs = require("fs");

function _ls() { return require("./ls-bridge"); }

// Settings RPC 往返: 读→翻转 openMostRecentChatConversation→复读→还原→复读。
// proto3 缺省省略: 以 !! 归一比对。lsMod 可注入(测试桩)。
async function settingsRoundtrip(lsMod) {
  const ls = lsMod || _ls();
  const s0 = await ls.call("GetUserSettings", {});
  const cur = (s0 && s0.userSettings) || {};
  const before = !!cur.openMostRecentChatConversation;
  const flip = !before;
  await ls.call("SetUserSettings", { userSettings: Object.assign({}, cur, { openMostRecentChatConversation: flip }) });
  const s1 = await ls.call("GetUserSettings", {});
  const wrote = !!((s1 && s1.userSettings) || {}).openMostRecentChatConversation === flip;
  await ls.call("SetUserSettings", { userSettings: cur });
  const s2 = await ls.call("GetUserSettings", {});
  const reverted = !!((s2 && s2.userSettings) || {}).openMostRecentChatConversation === before;
  return { key: "settings", rpc: "GetUserSettings/SetUserSettings", wrote, readBack: wrote, reverted };
}

// 定制类 RPC↔文件真源双向往返: RPC 创建全局 workflow → 官方目录落盘可见 →
// RefreshCustomization 后 GetAllWorkflows 列出 → 删文件 → 复刷后列表即失(还原不留痕)。
async function customizationRoundtrip(lsMod, fsMod) {
  const ls = lsMod || _ls();
  const f = fsMod || fs;
  const probe = "dao-probe-rpc-" + Date.now();
  const cr = await ls.call("CreateCustomizationFile", { fileName: probe + ".md", fileType: "CUSTOMIZATION_FILE_TYPE_GLOBAL_WORKFLOWS" });
  const fp = ((cr && cr.filePath) || "").replace(/^file:\/\//, "");
  const onDisk = !!fp && f.existsSync(fp);
  let listed = false, gone = false;
  try {
    if (onDisk) f.writeFileSync(fp, "---\ndescription: probe\n---\nprobe\n");
    await ls.call("RefreshCustomization", {}).catch(() => ({}));
    const wf = await ls.call("GetAllWorkflows", {});
    listed = JSON.stringify(wf || {}).indexOf(probe) >= 0;
  } finally {
    try { if (onDisk) f.unlinkSync(fp); } catch (_) {}
    await ls.call("RefreshCustomization", {}).catch(() => ({}));
    const wf2 = await ls.call("GetAllWorkflows", {});
    gone = JSON.stringify(wf2 || {}).indexOf(probe) < 0;
  }
  return { key: "customization", rpc: "CreateCustomizationFile/GetAllWorkflows", filePath: fp,
    wrote: onDisk, readBack: listed, reverted: gone };
}

// 全量 RPC 往返(LS 不在跑时自持拉起同源 LS; 无登录态/无二进制则如实返回不可用, 不伪称)。
async function roundtrip(opts) {
  const o = opts || {};
  const ls = o.ls || _ls();
  if (!o.ls) {
    let ok = false;
    try { ok = !!ls.ready() && await ls.probeAlive(); } catch (_) { ok = false; }
    if (!ok) {
      const boot = require("./ls-boot");
      const b = await boot.boot({ log: o.log, workspaceDir: o.workspaceDir });
      if (!b) return { ok: false, available: false, note: "官方 LS 不可用(无登录态或无官方二进制), RPC 面未验证 — 如实标注, 不伪称" };
    }
  }
  const results = [];
  for (const fn of [settingsRoundtrip, customizationRoundtrip]) {
    try { results.push(await fn(o.ls)); }
    catch (e) { results.push({ key: fn.name, wrote: false, readBack: false, reverted: false, note: "探测异常: " + e.message }); }
  }
  return { ok: results.every((r) => r.wrote && r.readBack && r.reverted), available: true, results };
}

module.exports = { settingsRoundtrip, customizationRoundtrip, roundtrip };
