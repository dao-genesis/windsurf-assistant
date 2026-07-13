// v9.9.300 devtest · 官方路径工具描述去名 · proto 往返实证
// 验证: modifySPProto 对 field 10 工具定义去名 · 不碰用户消息/工具名/参数键 · 幂等 · proto 不损坏
"use strict";
const path = require("path");
const w = require("./cascade_wire");
const src = require(
  path.join(__dirname, "..", "..", "bundled-origin", "source.js"),
);

const { encodeString, encodeUint, buildFrame, parseGetChatMessageRequest } = w;

// ChatToolDefinition: 1=name 2=description 3=json_schema_string
function toolDef(name, desc, schemaObj) {
  return Buffer.concat([
    encodeString(1, name),
    encodeString(2, desc),
    encodeString(3, JSON.stringify(schemaObj)),
  ]);
}
// ChatMessagePrompt: 2=source(varint USER=1) 3=prompt
function userMsg(text) {
  return Buffer.concat([encodeUint(2, 1), encodeString(3, text)]);
}

const SP =
  "<communication_style>You are Cascade, built by Codeium.</communication_style>";
const USER_TEXT = "Please use Cascade to open the Windsurf workspace."; // 必须原样保留

const tool1 = toolDef(
  "view_file",
  "Cascade reads a file. Windsurf displays it. Codeium logs it.",
  {
    type: "object",
    properties: {
      AbsolutePath: { type: "string", description: "Path Cascade should read." },
    },
  },
);
const tool2 = toolDef("run_command", "Cascade blocks until done.", {
  type: "object",
  properties: { Command: { type: "string", description: "Plain command." } },
});
// 记忆模块工具 · 须被整条剔除 (模型不应知有记忆)
const tool3 = toolDef("create_memory", "Create memory", {
  type: "object",
  properties: { Content: { type: "string", description: "Memory content." } },
});

// 顶层: 2=prompt(SP) 3=messages 10=tools(repeated)
const payload = Buffer.concat([
  encodeString(2, SP),
  encodeString(3, userMsg(USER_TEXT)),
  encodeString(10, tool1),
  encodeString(10, tool3), // create_memory · 应被剔除
  encodeString(10, tool2),
]);
const reqFramed = buildFrame(0, payload);

// ── run ──
const out = src.modifySPProto(reqFramed);
const parsed = parseGetChatMessageRequest(out, false);

const fails = [];
const ok = (cond, msg) => {
  if (!cond) fails.push(msg);
};

// 0) proto 未损坏 + 记忆工具剔除: 喂入 3 工具(含 create_memory)→ 应剩 2
ok(parsed.tools.length === 2, `工具数=${parsed.tools.length} 应=2 (记忆工具未剔除/proto 损坏?)`);
ok(parsed.messages.length === 1, `消息数=${parsed.messages.length} 应=1`);

const byName = Object.fromEntries(parsed.tools.map((t) => [t.function.name, t]));
// 0b) 记忆模块工具整条剔除 · 模型不应知有记忆
ok(!byName["create_memory"], "create_memory 未被剔除 (模型仍能创建记忆!)");
ok(
  !parsed.tools.some((t) => /memor(?:y|ies)/i.test(t.function.name)),
  "仍有记忆类工具残留",
);
// 1) 非记忆工具名不变
ok(!!byName["view_file"], "工具名 view_file 丢失/被改");
ok(!!byName["run_command"], "工具名 run_command 丢失/被改");

// 2) description 去名 (无品牌词)
for (const t of parsed.tools) {
  const d = t.function.description || "";
  ok(
    !/Cascade|Windsurf|Codeium/.test(d),
    `工具[${t.function.name}] description 仍含品牌: ${JSON.stringify(d)}`,
  );
}
// 2b) 语法守: run_command "Cascade blocks"→"you block"(非 "you blocks")
const rc = byName["run_command"];
if (rc)
  ok(
    /\b[Yy]ou block\b/.test(rc.function.description),
    `主谓守失败: ${JSON.stringify(rc.function.description)}`,
  );

// 3) 参数 schema: 参数键(AbsolutePath/Command)保留 · description 去名
const vf = byName["view_file"];
if (vf) {
  const props = vf.function.parameters.properties || {};
  ok(!!props.AbsolutePath, "参数键 AbsolutePath 丢失");
  ok(
    !/Cascade|Windsurf|Codeium/.test(props.AbsolutePath?.description || ""),
    `参数 description 仍含品牌: ${JSON.stringify(props.AbsolutePath?.description)}`,
  );
}

// 4) 用户消息原样保留 (绝不去名)
const um = parsed.messages[0]?.content || "";
ok(
  um === USER_TEXT,
  `用户消息被改动! got=${JSON.stringify(um)} want=${JSON.stringify(USER_TEXT)}`,
);

// 5) 幂等: 二次 == 一次
const out2 = src.modifySPProto(out);
ok(
  Buffer.compare(out2, out) === 0,
  `非幂等: 二次输出 != 一次输出 (len ${out2.length} vs ${out.length})`,
);

if (fails.length) {
  console.log("FAIL (" + fails.length + "):");
  for (const f of fails) console.log("  ✗ " + f);
  process.exit(1);
}
console.log("PASS · 官方路径工具去名 · 6 维全过 (proto完整/工具名/描述去名/语法守/参数键+描述/用户消息/幂等)");
process.exit(0); // source.js 创建了 server 句柄(未 listen) · 显式退出防挂起
