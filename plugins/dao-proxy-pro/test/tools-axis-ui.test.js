"use strict";
// 工具模式轴 UI · 与经藏轴正交（提示换提示的·工具换工具的·两轴相乘）
// 侧栏 + Proxy Pro 浮动面板 双入口 · /origin/tools 真源 · ping 同步选中态
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const EXT = fs.readFileSync(path.join(ROOT, "extension.js"), "utf8");
const SRC = fs.readFileSync(
  path.join(ROOT, "vendor", "bundled-origin", "source.js"),
  "utf8",
);
const spInvert = require(
  path.join(ROOT, "vendor", "外接api", "core", "sp_invert.js"),
);

test("sp_invert 工具模式轴真源: 4 模式 · 官方默认 · 非法拒绝", () => {
  assert.deepStrictEqual(Object.keys(spInvert.TOOLMODE_MAP), [
    "official",
    "windows",
    "freecad",
    "kicad",
  ]);
  assert.strictEqual(spInvert.setToolMode("bogus"), false);
  assert.strictEqual(typeof spInvert.getToolMode(), "string");
});

test("侧栏本源观照: toolsSelect 下拉 + setTools 消息 + ping 同步", () => {
  assert.ok(EXT.includes('id="toolsSelect"'), "侧栏应有工具模式下拉");
  assert.ok(EXT.includes("command: 'setTools'"), "切换应发 setTools 消息");
  assert.ok(EXT.includes("_handleSetTools"), "extension 应有 setTools 处理器");
  assert.ok(
    EXT.includes("p.tools && $toolsSelect"),
    "ping 应同步工具模式选中态",
  );
});

test("Proxy Pro 浮动面板: e1Tools 下拉 + /origin/tools 直连", () => {
  assert.ok(EXT.includes('id="e1Tools"'), "浮动面板应有 e1Tools 下拉");
  assert.ok(
    EXT.includes("fPost('/origin/tools'"),
    "切换应 POST /origin/tools",
  );
  assert.ok(
    EXT.includes("fJson('/origin/tools')"),
    "加载态应 GET /origin/tools",
  );
});

test("source.js: /origin/tools 端点 + ping 含 tools/tools_name", () => {
  assert.ok(SRC.includes('"/origin/tools"'), "代理应有 /origin/tools 端点");
  const pingIdx = SRC.indexOf('"/origin/ping"');
  const pingBlock = SRC.slice(pingIdx, pingIdx + 3000);
  assert.ok(pingBlock.includes("tools:"), "ping 应含 tools 字段");
  assert.ok(pingBlock.includes("tools_name:"), "ping 应含 tools_name 字段");
});

test("正交相乘: 经藏 4 × 工具 4 = 16 组合 · 两轴独立", () => {
  const canonOpts = ["laozi+yinfu", "laozi", "yinfu", "windows-agent"];
  const toolOpts = Object.keys(spInvert.TOOLMODE_MAP);
  for (const c of canonOpts)
    assert.ok(EXT.includes('value="' + c + '"'), "经藏轴应含 " + c);
  for (const t of toolOpts)
    assert.ok(EXT.includes('value="' + t + '"'), "工具轴应含 " + t);
  assert.strictEqual(canonOpts.length * toolOpts.length, 16);
});
