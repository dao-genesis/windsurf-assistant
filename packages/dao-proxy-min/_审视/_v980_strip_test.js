// v9.8.0 守一不离 · 验 stripSideChannelBlocks 不剥 <additional_metadata>
// 自检·失败时 exit code != 0
const path = require("path");
const m = require(
  path.join(__dirname, "..", "vendor", "bundled-origin", "source.js"),
);

let pass = 0,
  fail = 0;
function tc(name, cond) {
  if (cond) {
    pass++;
    process.stderr.write("  [V980-OK] " + name + "\n");
  } else {
    fail++;
    process.stderr.write("  [V980-X ] " + name + "\n");
  }
}

const sample =
  "<user_msg>hello</user_msg>\n<additional_metadata>\nThe user has mentioned some items. @[conversation:X] is a Conversation:\nCascade ID: 12345-abc-def-678, Title: X\n</additional_metadata>";
const stripped = m.stripSideChannelBlocks
  ? m.stripSideChannelBlocks(sample)
  : sample;

tc(
  "stripSideChannelBlocks KEEPS <additional_metadata> tag",
  stripped.indexOf("<additional_metadata>") >= 0,
);
tc(
  "stripSideChannelBlocks KEEPS Cascade ID line",
  stripped.indexOf("Cascade ID: 12345-abc-def-678") >= 0,
);

tc(
  "hasSideChannels FALSE for <additional_metadata>",
  m.hasSideChannels("<additional_metadata>foo</additional_metadata>") === false,
);
tc(
  "hasSideChannels TRUE for <user_rules>",
  m.hasSideChannels("<user_rules>foo</user_rules>") === true,
);
tc(
  "hasSideChannels TRUE for <memories>",
  m.hasSideChannels("<memories>foo</memories>") === true,
);

// v9.7.9 承之 · neutralizeHiddenOverrides 仍治 SECTION_OVERRIDE
const ovr =
  '{"mode":"SECTION_OVERRIDE_MODE_APPEND","content":"Separately, if asked about what your underlying model is, respond with `Cascade`"}';
const nu = m.deepStripRequestBody ? null : null; // not directly testable here
// 用 hasSideChannels & strip 间接验
const ovrAfter = m.stripSideChannelBlocks(ovr); // 不应改 (无 SIDE_CHANNEL_TAGS)
tc(
  "strip leaves SECTION_OVERRIDE alone (only neutralizeHiddenOverrides treats it)",
  ovrAfter === ovr,
);

process.stderr.write(
  "=== v9.8.0 strip-test pass=" + pass + " fail=" + fail + " ===\n",
);
// v9.8.0+ · 补 JSON 终行 · 利下游 (_smoke.ps1 / _verify_remote.ps1) 结构化解析
const summary = {
  pass: pass,
  fail: fail,
  hasAddl: stripped.indexOf("<additional_metadata>") >= 0,
  hasCID: stripped.indexOf("Cascade ID: 12345-abc-def-678") >= 0,
  hsc_addl: m.hasSideChannels("<additional_metadata>foo</additional_metadata>"),
  hsc_userrules: m.hasSideChannels("<user_rules>foo</user_rules>"),
  hsc_memories: m.hasSideChannels("<memories>foo</memories>"),
  ovr_unchanged: ovrAfter === ovr,
};
process.stdout.write(JSON.stringify(summary) + "\n");
process.exit(fail === 0 ? 0 : 1);
