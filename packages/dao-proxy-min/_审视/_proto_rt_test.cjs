// proto 往返保真之证 · parseProto → serializeProto → 字节比对
// ★ v9.9.67 根药之证器 · 大 varint (毫秒时间戳/大 ID) + 全序 (乱序/重复) + 改 SP 后余字段保真
// 用: node _proto_rt_test.cjs  · 期望: 全 OK · 字节恒等
const path = require("path");
const DIR = __dirname + "/..";
const src = require(path.join(DIR, "vendor/bundled-origin/source.js"));

function encodeVarintCur(v) {
  const b = [];
  while (v > 127) {
    b.push((v & 0x7f) | 0x80);
    v = Math.floor(v / 128);
  }
  b.push(v & 0x7f);
  return Buffer.from(b);
}
function build(fields) {
  const parts = [];
  for (const [fn, w, v] of fields) {
    parts.push(src.encodeVarint((fn << 3) | w));
    if (w === 0) parts.push(encodeVarintCur(v));
    else if (w === 2) parts.push(src.encodeLen(Buffer.from(v)));
    else parts.push(Buffer.from(v));
  }
  return Buffer.concat(parts);
}

const MS_TS = 1793030000000; // 毫秒时间戳 (~2^40.7 · > 2^31)
const BIG_ID = 1099511627776; // 2^40 · > 2^31 · < 2^53
const NESTED = build([
  [1, 0, 1700000000], // 秒级时间戳 (31 bits · 边界)
  [2, 2, Buffer.from("nested text")],
]);

const orig = build([
  [1, 0, MS_TS],
  [2, 2, Buffer.from("You are Cascade, a powerful agentic AI coding assistant.")],
  [3, 0, BIG_ID],
  [4, 2, NESTED],
  [5, 1, Buffer.from("12345678", "latin1")], // fixed64
  [6, 5, Buffer.from("abcd", "latin1")], // fixed32
  [7, 0, 0], // 零值 varint
  [2, 2, Buffer.from("second field-2 entry")], // 重复 field 2 (乱序再现)
]);

let pass = 0,
  fail = 0;
function ok(name, cond, extra) {
  if (cond) {
    pass++;
    console.log("  ✓ " + name + (extra ? " · " + extra : ""));
  } else {
    fail++;
    console.log("  ✗ " + name + (extra ? " · " + extra : ""));
  }
}

console.log("═══ proto 往返保真之证 ═══");
const fields = src.parseProto(orig);
ok("ms_ts 读回精确", fields[1][0].v === MS_TS, String(fields[1][0].v));
ok("big_id 读回精确", fields[3][0].v === BIG_ID, String(fields[3][0].v));
const rt = src.serializeProto(fields);
ok("未触往返字节恒等", orig.equals(rt), orig.length + "B → " + rt.length + "B");

// 改 SP 后余字段保真
const f2 = src.parseProto(orig);
const spText = Buffer.from(f2[2][0].b).toString("utf8");
const inv = src.invertSP(spText);
ok("官方SP被反转", inv !== null);
if (inv) {
  f2[2][0] = { w: 2, b: Buffer.from(inv, "utf8") };
  const modified = src.serializeProto(f2);
  const mf = src.parseProto(modified);
  ok("改SP后 ms_ts 保真", mf[1][0].v === MS_TS);
  ok("改SP后 big_id 保真", mf[3][0].v === BIG_ID);
  ok(
    "改SP后嵌套文保真",
    Buffer.from(src.parseProto(Buffer.from(mf[4][0].b))[2][0].b).toString() ===
      "nested text",
  );
  ok("改SP后 fixed64/32 保真", mf[5][0].b.length === 8 && mf[6][0].b.length === 4);
  ok(
    "改SP后重复field2序保真",
    Buffer.from(mf[2][1].b).toString() === "second field-2 entry",
  );
}
console.log("═══ " + pass + " pass · " + fail + " fail ═══");
process.exit(fail > 0 ? 1 : 0);
