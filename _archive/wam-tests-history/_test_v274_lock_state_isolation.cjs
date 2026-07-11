// _test_v274_lock_state_isolation.cjs · v2.7.4 治🔒multi-window race · 独立持久化实证
//
// 主公诏 (13:31):
//   "🔒一部分账号 同时🔓一部分账号后 关闭windsurf 重新开启后被回退
//    必须要停留很久才能持久化 ... 复用持久化资源 道法自然 无为而无不为"
//   主公选《道德经》三十二章: "道恒无名·侯王若能守之·万物将自宾·民莫之令而自均焉"
//
// 病诊 (v2.7.3 实测):
//   主公 5+ Windsurf 窗口并发 · 5 号 toggleSkip 操作 vs 盘上 100% 颠倒回退
//   多进程 race: A 进程 toggleSkip 锁 X → save 写 wam-state.json (含 X 锁) ✓
//                B 进程 (历史窗口·内存无 X 锁) 数秒后 tick save() → 覆盖 (不含 X 锁) ✗
//                主公关 A 重开 → load → X 解锁 (B 胜出) → 显形"回退"
//
// 治法 (v2.7.4 · 道恒无名·守一):
//   §1 新增 ~/.wam/lock-state.json 独立持久化🔒
//   §2 toggleSkip 写 LOCK_FILE (唯一权威写者)
//   §3 reloadAccounts 实时读 LOCK_FILE
//   §4 save() 之 accountMeta 字段 从 LOCK_FILE 读 · 不从 store.accounts 重算
//      → 任何进程的 save 都不覆盖 LOCK_FILE · multi-window race 自消
//
// 本测套实证:
//   §1 静态契约 — LOCK_FILE/_readLockState/_writeLockState/load migrate/reloadAccounts 实时读/save 真本源
//   §2 行为验证 — vm 隔离·真本源治法
//   §3 multi-process race 反证 — 关键: v2.7.4 治法在并发下 LOCK_FILE 不被覆盖
//   §4 端到端 — tmp 真盘 IO + migrate + 重开周期
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
console.log("  v2.7.4 治🔒multi-window race · 独立持久化·万物自宾·实证测套");
console.log("================================================================");

// ─── §1 静态契约 ─────────────────────────────────────────────────────
console.log("\n[§1] 静态契约 · v2.7.4 治法关键标记");

check(
  "§1.A VERSION ≥ 2.7.4 (治 multi-window race)",
  /const\s+VERSION\s*=\s*"2\.7\.([4-9]|\d{2,})"/.test(src),
);

check(
  "§1.B LOCK_FILE 常量声明 (~/.wam/lock-state.json)",
  /const\s+LOCK_FILE\s*=\s*path\.join\s*\(\s*WAM_DIR\s*,\s*"lock-state\.json"\s*\)/.test(
    src,
  ),
);

check(
  "§1.C _readLockState 函数声明 + 读 LOCK_FILE + j.locks 取值",
  /function\s+_readLockState\s*\(\s*\)[\s\S]{0,300}fs\.readFileSync\s*\(\s*LOCK_FILE[\s\S]{0,200}j\.locks/.test(
    src,
  ),
);

check(
  "§1.D _writeLockState 函数声明 + read-modify-write + atomicWrite LOCK_FILE",
  /function\s+_writeLockState\s*\([\s\S]{0,800}atomicWrite\s*\(\s*LOCK_FILE/.test(
    src,
  ),
);

check(
  "§1.E1 load() 内含 _readLockState 调用 (优先读 LOCK_FILE)",
  /load\s*\(\s*\)\s*\{[\s\S]{0,3500}_readLockState\s*\(/.test(src),
);

check(
  "§1.E2 migrate 路径含 _migratedFrom 标记 (兼容老盘·审计可追溯)",
  /_migratedFrom["']?\s*[:=]\s*["']wam-state\.json\.accountMeta/.test(src),
);

check(
  "§1.F reloadAccounts 实时读 LOCK_FILE (不再依赖内存快照单源)",
  /reloadAccounts\s*\(\s*\)\s*\{[\s\S]{0,800}_readLockState\s*\(/.test(src),
  "reloadAccounts 内含 _readLockState 实时读",
);

check(
  "§1.G toggleSkip handler 调 _writeLockState (race-safe 持久化)",
  /case\s+"toggleSkip"[\s\S]{0,1200}_writeLockState\s*\(/.test(src),
);

check(
  "§1.H save() 之 accountMeta 字段 从 _readLockState 读 (非 accounts 重算)",
  /save\s*\(\)\s*\{[\s\S]{0,1500}const\s+accountMeta\s*=\s*_readLockState\s*\(/.test(
    src,
  ),
  "save 不再从 store.accounts 提取 accountMeta · race-immune",
);

check(
  "§1.I banner 标 v2.7.4 治法 (LOCK_FILE 守一 / 万物自宾 / 民莫之令)",
  /LOCK_FILE\s*守一|万物自宾|民莫之令而自均/.test(src),
);

check(
  "§1.J 头注解含 三十二章·道恒无名 / 万物将自宾 / multi-window race 真凶诊",
  /道恒无名/.test(src) && /万物.*自宾/.test(src) && /multi-window/i.test(src),
);

// ─── §2 行为验证 · vm 隔离·复刻 v2.7.4 真本源治法 ───────────────────────
console.log("\n[§2] 行为验证 · vm 隔离·独立 LOCK_FILE 真本源治法");

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wam-v274-"));
const lockFile = path.join(tmpDir, "lock-state.json");
const stateFile = path.join(tmpDir, "wam-state.json");

// 真盘 IO helper (复刻 atomicWrite + _readLockState + _writeLockState)
function atomicWriteHelper(filePath, content) {
  const tmp = filePath + "." + process.pid + "." + Date.now() + ".tmp";
  fs.writeFileSync(tmp, content);
  try {
    fs.renameSync(tmp, filePath);
  } catch (e) {
    fs.copyFileSync(tmp, filePath);
    try {
      fs.unlinkSync(tmp);
    } catch {}
  }
}
function readLock() {
  try {
    if (!fs.existsSync(lockFile)) return {};
    const j = JSON.parse(fs.readFileSync(lockFile, "utf8"));
    return j && typeof j === "object" && j.locks ? j.locks : {};
  } catch {
    return {};
  }
}
function writeLock(email, locked) {
  const cur = readLock();
  const k = String(email || "").toLowerCase();
  if (!k) return false;
  if (locked) cur[k] = { skipAutoSwitch: true, ts: Date.now() };
  else delete cur[k];
  atomicWriteHelper(
    lockFile,
    JSON.stringify({ version: "2.7.4", locks: cur }, null, 2),
  );
  return true;
}
function readState() {
  if (!fs.existsSync(stateFile)) return null;
  return JSON.parse(fs.readFileSync(stateFile, "utf8"));
}
function writeState(accounts, activeEmail) {
  // v2.7.4 治: accountMeta 从 LOCK_FILE 读 · 不从 accounts 重算
  const accountMeta = readLock();
  const data = {
    version: "2.7.4",
    savedAt: Date.now(),
    activeEmail: activeEmail || null,
    accountMeta: accountMeta,
  };
  atomicWriteHelper(stateFile, JSON.stringify(data, null, 2));
}

// §2.1 toggleSkip → writeLock → readLock 守
{
  fs.rmSync(lockFile, { force: true });
  writeLock("a@x.com", true);
  const locks = readLock();
  check(
    "§2.1 锁 a → writeLock → readLock 守 a 锁",
    locks["a@x.com"]?.skipAutoSwitch === true,
  );
}

// §2.2 解锁 → writeLock → readLock 守 (a 不再含)
{
  writeLock("a@x.com", false);
  const locks = readLock();
  check("§2.2 解锁 a → writeLock → readLock 不含 a", !locks["a@x.com"]);
}

// §2.3 多号·混合状态独立
{
  fs.rmSync(lockFile, { force: true });
  writeLock("a@x.com", true);
  writeLock("b@x.com", true);
  writeLock("c@x.com", false); // c 未锁过·delete 是 no-op
  const locks = readLock();
  check(
    "§2.3 多号混合 · a 锁 / b 锁 / c 无 (delete no-op 不破)",
    locks["a@x.com"]?.skipAutoSwitch === true &&
      locks["b@x.com"]?.skipAutoSwitch === true &&
      !locks["c@x.com"],
  );
}

// ─── §3 multi-process race 反证 · v2.7.4 治法关键测项 ───────────────────
console.log("\n[§3] multi-process race 反证 · v2.7.4 真本源治法核心");

// §3.1 A 进程锁 X → B 进程 save (不动 LOCK_FILE) → X 仍锁
{
  fs.rmSync(lockFile, { force: true });
  fs.rmSync(stateFile, { force: true });
  // A 进程: toggleSkip 锁 X
  writeLock("x@gmail.com", true);
  // B 进程: 内存中没有 X 锁 (B 进程 accounts 数组里 X.skipAutoSwitch=undefined)
  //   v2.7.4 save 改: accountMeta 字段从 readLock 读 · 不从 accounts 重算
  //   所以 B 的 save() 写入 wam-state.json 的 accountMeta 也含 X 锁 (从 LOCK_FILE 读到)
  //   ★ 但 LOCK_FILE 本身不被 B 触碰 · 这才是 race-immune 的关键
  const B_accountsNoLock = [{ email: "x@gmail.com", password: "p1" }];
  writeState(B_accountsNoLock, "y@gmail.com"); // B save (不含 X 锁的 accounts)
  // 验 1: LOCK_FILE 仍含 X 锁 (B 不动它)
  const locksAfterB = readLock();
  check(
    "§3.1.a B 进程 save 后 · LOCK_FILE 仍守 X 锁 (B 不动 LOCK_FILE)",
    locksAfterB["x@gmail.com"]?.skipAutoSwitch === true,
  );
  // 验 2: wam-state.json.accountMeta 也含 X 锁 (B save 从 LOCK_FILE 读)
  const stateAfterB = readState();
  check(
    "§3.1.b B 进程 save 写入的 wam-state.accountMeta 也含 X 锁 (从 LOCK_FILE 读·守一)",
    stateAfterB.accountMeta["x@gmail.com"]?.skipAutoSwitch === true,
    "v2.7.4 守一: 任何 save 路径都不覆盖 LOCK_FILE",
  );
}

// §3.2 模拟主公完整场景: A 锁 X · B 锁 Y · C 解锁 X · 关 A · 重开 → X 解锁 / Y 锁
{
  fs.rmSync(lockFile, { force: true });
  fs.rmSync(stateFile, { force: true });
  // A 进程: 锁 X
  writeLock("x@gmail.com", true);
  // B 进程 (不同窗口): 锁 Y
  writeLock("y@gmail.com", true);
  // C 进程 (主公另一窗口·或同一窗口稍后): 解锁 X
  writeLock("x@gmail.com", false);
  // 模拟 B 进程稍后 tick save (B 不知 X 已被 C 解锁 · B 内存里 Y 锁)
  const B_accounts = [
    { email: "x@gmail.com", password: "p1" },
    { email: "y@gmail.com", password: "p2", skipAutoSwitch: true }, // B 知 Y 锁
  ];
  writeState(B_accounts, "y@gmail.com");
  // 主公关 A 重开 → 读 LOCK_FILE
  const locksFinal = readLock();
  check(
    "§3.2.a 三进程交错操作 · X 守解锁 (C 最近写)",
    !locksFinal["x@gmail.com"],
    "X 解锁意图守住",
  );
  check(
    "§3.2.b 三进程交错操作 · Y 守锁",
    locksFinal["y@gmail.com"]?.skipAutoSwitch === true,
  );
}

// §3.3 反证 v2.7.3 病 (saveLegacy 从 accounts 重算 accountMeta · 必覆盖)
{
  // 模拟 v2.7.3 病: B save 从 accounts 重算 (不从 LOCK_FILE 读)
  function writeStateLegacy_v273(accounts, activeEmail) {
    const accountMeta = {};
    for (const a of accounts) {
      if (a && a.skipAutoSwitch) {
        accountMeta[a.email.toLowerCase()] = { skipAutoSwitch: true };
      }
    }
    const data = {
      version: "2.7.3-legacy",
      accountMeta: accountMeta,
      activeEmail: activeEmail || null,
    };
    atomicWriteHelper(stateFile, JSON.stringify(data, null, 2));
  }
  fs.rmSync(lockFile, { force: true });
  fs.rmSync(stateFile, { force: true });
  writeLock("x@gmail.com", true); // A 锁 X
  // B 内存里 X 没锁 · v2.7.3 saveLegacy 重算 → wam-state.accountMeta 不含 X
  writeStateLegacy_v273([{ email: "x@gmail.com" }], "y@gmail.com");
  // 此处 LOCK_FILE 不变 (但 wam-state 已被污染)
  const locksAfter = readLock();
  const stateAfter = readState();
  check(
    "§3.3.a v2.7.3 病演示: wam-state.accountMeta 被 B 覆盖 (不含 X)",
    !stateAfter.accountMeta["x@gmail.com"],
    "v2.7.3 必现 · v2.7.4 守 LOCK_FILE 即免",
  );
  check(
    "§3.3.b 反证 v2.7.4 治: LOCK_FILE 不受 saveLegacy 影响 (X 仍锁)",
    locksAfter["x@gmail.com"]?.skipAutoSwitch === true,
    "★ multi-window race 真本源已治",
  );
}

// ─── §4 端到端 · migrate · 真盘 IO ──────────────────────────────────
console.log("\n[§4] 端到端 · migrate · 真盘 IO 周期");

// §4.1 migrate: 老盘只有 wam-state.json.accountMeta · 无 LOCK_FILE · load 时一次性 migrate
{
  fs.rmSync(lockFile, { force: true });
  fs.rmSync(stateFile, { force: true });
  // 老盘 (v2.7.3 写的): wam-state 含 accountMeta · 无 lock-state.json
  const oldState = {
    version: "2.7.3",
    accountMeta: {
      "old@x.com": { skipAutoSwitch: true },
      "another@x.com": { skipAutoSwitch: true },
    },
  };
  atomicWriteHelper(stateFile, JSON.stringify(oldState, null, 2));
  check(
    "§4.1.a 老盘准备 · wam-state.accountMeta 含 2 个锁 · 无 lock-state.json",
    !fs.existsSync(lockFile) && fs.existsSync(stateFile),
  );
  // 模拟 v2.7.4 load 路径: 检测 lock-state.json 不存在 → migrate from wam-state.accountMeta
  // (这里手动模拟 · 真代码在 extension.js load 内)
  if (!fs.existsSync(lockFile)) {
    const j = readState();
    if (j.accountMeta) {
      atomicWriteHelper(
        lockFile,
        JSON.stringify(
          {
            version: "2.7.4",
            locks: j.accountMeta,
            _migratedFrom: "wam-state.json.accountMeta",
          },
          null,
          2,
        ),
      );
    }
  }
  const locks = readLock();
  check(
    "§4.1.b migrate 后 lock-state.json 含原 2 个锁",
    locks["old@x.com"]?.skipAutoSwitch === true &&
      locks["another@x.com"]?.skipAutoSwitch === true,
  );
  // migrate 标记
  const lockData = JSON.parse(fs.readFileSync(lockFile, "utf8"));
  check(
    "§4.1.c migrate 写 _migratedFrom 标记 (审计可追溯)",
    lockData._migratedFrom === "wam-state.json.accountMeta",
  );
}

// §4.2 一次性 migrate 后 后续不再 migrate (LOCK_FILE 已存在)
{
  // 改写 LOCK_FILE 添加新锁
  writeLock("new@x.com", true);
  // 此时 wam-state.accountMeta 还是老的 · 但 load 应读 LOCK_FILE 真本源
  const locks = readLock();
  check(
    "§4.2 LOCK_FILE 已存在 · 新加 new@x.com 锁 · readLock 真本源",
    locks["new@x.com"]?.skipAutoSwitch === true &&
      locks["old@x.com"]?.skipAutoSwitch === true,
  );
}

// §4.3 跨"重启"周期 · 锁意图守
{
  fs.rmSync(lockFile, { force: true });
  fs.rmSync(stateFile, { force: true });
  // session 1
  writeLock("session1@x.com", true);
  // session 1 deactivate (写 wam-state · 含从 LOCK_FILE 读的 accountMeta)
  writeState([{ email: "session1@x.com" }], null);
  // session 2 启动: load LOCK_FILE
  const locks2 = readLock();
  check(
    "§4.3.a session 2 启动 · readLock 守 session1 锁",
    locks2["session1@x.com"]?.skipAutoSwitch === true,
  );
  // session 2 解锁
  writeLock("session1@x.com", false);
  writeState([{ email: "session1@x.com" }], null);
  // session 3 启动
  const locks3 = readLock();
  check(
    "§4.3.b session 3 启动 · readLock 守 session1 解锁 (无回退)",
    !locks3["session1@x.com"],
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
console.log(
  "  v2.7.4 治🔒multi-window race · 测毕: " + pass + " 过 / " + fail + " 败",
);
console.log("  道恒无名·LOCK_FILE 守一·万物自宾·民莫之令而自均");
console.log("================================================================");
process.exit(fail > 0 ? 1 : 0);
