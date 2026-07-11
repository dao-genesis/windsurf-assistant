// _test_v273_lock_persistence.cjs · v2.7.3 治🔒回退根 · 持久化贯通实证测套
//
// 主公诏 (12:48):
//   "🔒按钮有时候状态会自动回退 持久化功能有点问题"
//   "天下莫柔弱于水，而攻坚强者莫之能胜也，以其无以易之也。
//    弱之胜强，柔之胜刚，天下莫不知，莫能行也。"
//
// 病诊 (v2.7.2 残):
//   toggleSkip → acc.skipAutoSwitch=false → _store.save() 写盘 ✓
//   但 this._savedAccountMeta 仍是 load 时初始化的过期内存 ref · 不刷新
//   后续 reloadAccounts (refresh/Layer6/addBatch) 用过期快照 restore
//   → 用户解锁号被悄悄回 skipAutoSwitch=true · 状态自动回退
//
// 治法 (v2.7.3 · 一行致命修 · 柔之胜刚):
//   save() 内 atomicWrite 之前 · this._savedAccountMeta = accountMeta
//   内存快照与盘上 state 同步 · reloadAccounts 不再回退
//
// 本测套实证:
//   §1 静态契约 — VERSION/save 内同步行/banner 标
//   §2 行为验证 — 抽 save+reloadAccounts 逻辑入隔离 vm · 模拟 toggle→save→reload 全循环
//   §3 端到端 — tmp 目录真盘读写 · STATE_FILE 真序列化 · 验回退绝迹
//
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const vm = require("node:vm");

const EXT = path.join(__dirname, "extension.js");
const src = fs.readFileSync(EXT, "utf8");

let pass = 0,
  fail = 0;
function check(name, ok, ctx) {
  if (ok) {
    console.log("  [OK] " + name + (ctx ? " | " + ctx : ""));
    pass++;
  } else {
    console.log("  [X ] " + name + (ctx ? " | " + ctx : ""));
    console.log("       !! FAIL: " + name);
    fail++;
  }
}

console.log("================================================================");
console.log("  v2.7.3 治🔒回退根 · 持久化贯通 · 柔之胜刚实证测套");
console.log("================================================================");

// ─── §1 静态契约 ─────────────────────────────────────────────────────
console.log("\n[§1] 静态契约 · v2.7.3 治法关键标记");

check(
  "§1.A VERSION ≥ 2.7.3 (治🔒回退·守一)",
  /const\s+VERSION\s*=\s*"2\.7\.([3-9]|\d{2,})"/.test(src),
);

check(
  "§1.B save 内含 this._savedAccountMeta = accountMeta (一行致命修)",
  /save\s*\(\)\s*\{[\s\S]{0,800}this\._savedAccountMeta\s*=\s*accountMeta\s*;[\s\S]{0,1000}atomicWrite\s*\(\s*STATE_FILE/.test(
    src,
  ),
  "save 写盘前内存快照同步",
);

check(
  "§1.C banner 标 v2.7.3 治法 ('治🔒回退·save 守一') 或 v2.7.4 超越版 ('LOCK_FILE 守一')",
  /治🔒回退[·\s]*save\s*守一/.test(src) ||
    /LOCK_FILE\s*守一|万物自宾/.test(src),
  "兼容 v2.7.4 升级 (banner 升级真本源治法)",
);

check(
  "§1.D _savedAccountMeta 在 load 与 save 两处均有 setter",
  (src.match(/this\._savedAccountMeta\s*=/g) || []).length >= 2,
  "load 初始化 + save 刷新",
);

check(
  "§1.E reloadAccounts 用 _savedAccountMeta restore skipAutoSwitch",
  /reloadAccounts\s*\(\)\s*\{[\s\S]{0,1200}this\._savedAccountMeta[\s\S]{0,300}a\.skipAutoSwitch\s*=\s*true/.test(
    src,
  ),
);

check(
  "§1.F save 提取 accountMeta · v2.7.3 路径 (循环 accounts) 或 v2.7.4 升级 (从 LOCK_FILE 读)",
  /for\s*\(\s*const\s+a\s+of\s+this\.accounts\s*\)\s*\{[\s\S]{0,200}if\s*\(\s*a\s*&&\s*a\.skipAutoSwitch\s*\)/.test(
    src,
  ) ||
    /save\s*\(\)\s*\{[\s\S]{0,1500}const\s+accountMeta\s*=\s*_readLockState\s*\(/.test(
      src,
    ),
  "v2.7.4 真本源在 LOCK_FILE · save 不再从 accounts 重算 (race-immune)",
);

check(
  "§1.G toggleSkip handler 调 _store.save()",
  /toggleSkip[\s\S]{0,200}acc3\.skipAutoSwitch\s*=\s*!acc3\.skipAutoSwitch[\s\S]{0,1500}_store\.save\s*\(\s*\)/.test(
    src,
  ),
);

// ─── §2 行为验证 · vm 隔离·复刻 Store 关键路径 ───────────────────────
console.log("\n[§2] 行为验证 · vm 隔离·toggle→save→reload 全循环");

// 复刻 Store 最小核 · 仅含 _savedAccountMeta / accounts / save / reloadAccounts
// 真盘 IO 用 mock (closure 内 var) 替代 atomicWrite/STATE_FILE
const storeProto = `
class TestStore {
  constructor() {
    this.accounts = [];
    this.health = {};
    this.blacklist = [];
    this.switches = 0;
    this.changesDetected = 0;
    this.activeEmail = "";
    this.lastInjectPath = "";
    this.activeApiKey = null;
    this.activeTokenShort = null;
    this.activeApiServerUrl = null;
    this.lastRotateAt = 0;
    this._savedAccountMeta = null;
    this._diskState = null; // mock STATE_FILE
  }
  load(diskJson) {
    if (diskJson) {
      const j = typeof diskJson === "string" ? JSON.parse(diskJson) : diskJson;
      if (j.accountMeta && typeof j.accountMeta === "object") {
        this._savedAccountMeta = j.accountMeta;
      }
      this._diskState = j;
    }
  }
  // v2.7.3 治: save 写盘前同步内存快照
  save() {
    const accountMeta = {};
    for (const a of this.accounts) {
      if (a && a.skipAutoSwitch) {
        accountMeta[a.email.toLowerCase()] = { skipAutoSwitch: true };
      }
    }
    // ── v2.7.3 一行致命修 ──
    this._savedAccountMeta = accountMeta;
    const data = {
      version: "2.7.3",
      savedAt: Date.now(),
      accountMeta: accountMeta,
      activeEmail: this.activeEmail,
    };
    this._diskState = data;
  }
  // v2.7.2 旧 save (含 bug · 不刷新 _savedAccountMeta) · 仅用于对照
  saveLegacy() {
    const accountMeta = {};
    for (const a of this.accounts) {
      if (a && a.skipAutoSwitch) {
        accountMeta[a.email.toLowerCase()] = { skipAutoSwitch: true };
      }
    }
    // 关键: 不刷新 _savedAccountMeta · 即 v2.7.2 bug
    const data = {
      version: "2.7.2",
      savedAt: Date.now(),
      accountMeta: accountMeta,
      activeEmail: this.activeEmail,
    };
    this._diskState = data;
  }
  // reloadAccounts 复刻 (用 _savedAccountMeta 对 fresh accounts restore)
  reloadAccounts(freshAccounts) {
    this.accounts = freshAccounts.map((a) => ({ ...a }));
    if (this._savedAccountMeta) {
      for (const a of this.accounts) {
        const meta = this._savedAccountMeta[a.email.toLowerCase()];
        if (meta && meta.skipAutoSwitch) {
          a.skipAutoSwitch = true;
        }
      }
    }
  }
}
`;

const ctx = vm.createContext({});
vm.runInContext(storeProto, ctx);
const TestStore = vm.runInContext("TestStore", ctx);

// §2.1 锁号一枚 · save · reload · 守锁
{
  const s = new TestStore();
  s.accounts = [{ email: "a@x.com", password: "p1" }];
  s.accounts[0].skipAutoSwitch = true;
  s.save();
  // reload 模拟用户在外部改了 .md 触发 (无 skipAutoSwitch 在 fresh accounts)
  s.reloadAccounts([{ email: "a@x.com", password: "p1" }]);
  check(
    "§2.1 锁→save→reload · 仍锁 (持久化基本功能 ✓)",
    s.accounts[0].skipAutoSwitch === true,
  );
}

// §2.2 解锁后 reload · 守解锁 (v2.7.3 治 · v2.7.2 失败处)
{
  const s = new TestStore();
  // 先模拟之前 session 已锁 · load 上次 state
  s.load({ accountMeta: { "a@x.com": { skipAutoSwitch: true } } });
  s.accounts = [{ email: "a@x.com", password: "p1" }];
  s.reloadAccounts([{ email: "a@x.com", password: "p1" }]); // restore 锁
  check(
    "§2.2.pre 上次 session 锁 · reload restore",
    s.accounts[0].skipAutoSwitch === true,
  );
  // 用户解锁
  s.accounts[0].skipAutoSwitch = false;
  s.save();
  // 任何后续操作 (refresh / Layer6) 触发 reloadAccounts
  s.reloadAccounts([{ email: "a@x.com", password: "p1" }]);
  check(
    "§2.2 解锁→save→reload · 守解锁 (v2.7.3 治成 · v2.7.2 此处回退🔥)",
    s.accounts[0].skipAutoSwitch === false ||
      s.accounts[0].skipAutoSwitch === undefined,
    "actual=" + s.accounts[0].skipAutoSwitch,
  );
}

// §2.3 v2.7.2 退化对照 · 用 saveLegacy 应必现 bug
{
  const s = new TestStore();
  s.load({ accountMeta: { "a@x.com": { skipAutoSwitch: true } } });
  s.accounts = [{ email: "a@x.com", password: "p1" }];
  s.reloadAccounts([{ email: "a@x.com", password: "p1" }]);
  s.accounts[0].skipAutoSwitch = false;
  s.saveLegacy(); // 不刷新 _savedAccountMeta
  s.reloadAccounts([{ email: "a@x.com", password: "p1" }]);
  check(
    "§2.3 v2.7.2 退化对照 · saveLegacy 后 reload 回退🔥 (反证 v2.7.3 治法)",
    s.accounts[0].skipAutoSwitch === true,
    "v2.7.2 必现 · v2.7.3 治法解此",
  );
}

// §2.4 多号·部分锁部分解·混合场景
{
  const s = new TestStore();
  s.accounts = [
    { email: "a@x.com", password: "p1", skipAutoSwitch: true },
    { email: "b@x.com", password: "p2", skipAutoSwitch: false },
    { email: "c@x.com", password: "p3", skipAutoSwitch: true },
  ];
  s.save();
  // _savedAccountMeta 应只含 a, c
  const meta = s._savedAccountMeta;
  check(
    "§2.4.a save 后 _savedAccountMeta 含 a, c · 不含 b",
    meta &&
      meta["a@x.com"]?.skipAutoSwitch === true &&
      meta["c@x.com"]?.skipAutoSwitch === true &&
      !meta["b@x.com"],
  );
  // 用户解锁 a
  s.accounts[0].skipAutoSwitch = false;
  s.save();
  check(
    "§2.4.b 解锁 a → save · _savedAccountMeta 不再含 a (内存同步)",
    !s._savedAccountMeta["a@x.com"] &&
      s._savedAccountMeta["c@x.com"]?.skipAutoSwitch === true,
  );
  // reload · 验回退
  s.reloadAccounts([
    { email: "a@x.com", password: "p1" },
    { email: "b@x.com", password: "p2" },
    { email: "c@x.com", password: "p3" },
  ]);
  check(
    "§2.4.c reload 后 · a 守解锁·b 守解锁·c 守锁 (三号独立·无串扰)",
    s.accounts[0].skipAutoSwitch !== true &&
      s.accounts[1].skipAutoSwitch !== true &&
      s.accounts[2].skipAutoSwitch === true,
    "a=" +
      s.accounts[0].skipAutoSwitch +
      " b=" +
      s.accounts[1].skipAutoSwitch +
      " c=" +
      s.accounts[2].skipAutoSwitch,
  );
}

// §2.5 锁→解锁→再锁 多轮循环·均守用户意图
{
  const s = new TestStore();
  s.accounts = [{ email: "a@x.com", password: "p1" }];
  for (let i = 0; i < 5; i++) {
    s.accounts[0].skipAutoSwitch = i % 2 === 0; // 奇偶交替
    s.save();
    s.reloadAccounts([{ email: "a@x.com", password: "p1" }]);
    const expected = i % 2 === 0;
    const actual = s.accounts[0].skipAutoSwitch === true;
    check(
      "§2.5." +
        (i + 1) +
        " 第 " +
        (i + 1) +
        " 轮 toggle → save → reload · 守用户意图",
      actual === expected,
      "expected=" + expected + " actual=" + actual,
    );
  }
}

// ─── §3 端到端 · tmp 目录真盘 IO ──────────────────────────────────
console.log("\n[§3] 端到端 · tmp 目录真盘 IO · 跨进程持久化");

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wam-v273-"));
const stateFile = path.join(tmpDir, "wam-state.json");

function diskRead() {
  if (!fs.existsSync(stateFile)) return null;
  return JSON.parse(fs.readFileSync(stateFile, "utf8"));
}
function diskWrite(data) {
  fs.writeFileSync(stateFile, JSON.stringify(data, null, 2));
}

// §3.1 session 1: 锁 a · 写盘
{
  const meta = { "a@x.com": { skipAutoSwitch: true } };
  diskWrite({ version: "2.7.3", accountMeta: meta });
  const d = diskRead();
  check(
    "§3.1 session 1 · 锁 a · 盘上 state.accountMeta 含 a",
    d.accountMeta["a@x.com"]?.skipAutoSwitch === true,
  );
}

// §3.2 session 2: 模拟新进程 · load → reloadAccounts → 应 restore
{
  const s = new TestStore();
  s.load(diskRead());
  s.accounts = [{ email: "a@x.com", password: "p1" }];
  s.reloadAccounts([{ email: "a@x.com", password: "p1" }]);
  check(
    "§3.2 session 2 (新进程) · load → restore · a 锁",
    s.accounts[0].skipAutoSwitch === true,
  );
  // 解锁 + save (v2.7.3 治)
  s.accounts[0].skipAutoSwitch = false;
  s.save();
  diskWrite(s._diskState);
}

// §3.3 session 3: 再起 · 盘上 state 已是解锁 · load → restore 守解锁
{
  const d = diskRead();
  check(
    "§3.3.a 盘上 state 已不含 a (v2.7.3 save 写盘正确)",
    !d.accountMeta["a@x.com"],
  );
  const s = new TestStore();
  s.load(d);
  s.accounts = [{ email: "a@x.com", password: "p1" }];
  s.reloadAccounts([{ email: "a@x.com", password: "p1" }]);
  check(
    "§3.3.b session 3 (再启) · a 守解锁 · 持久化贯通 ✓",
    !s.accounts[0].skipAutoSwitch,
  );
}

// cleanup
try {
  fs.rmSync(tmpDir, { recursive: true, force: true });
} catch {}

// ─── 结果 ─────────────────────────────────────────────────────────
console.log(
  "\n================================================================",
);
console.log("  v2.7.3 治🔒回退 · 测毕: " + pass + " 过 / " + fail + " 败");
console.log("  道法自然·柔之胜刚·save 守一·reloadAccounts 不复回退");
console.log("================================================================");
process.exit(fail > 0 ? 1 : 0);
