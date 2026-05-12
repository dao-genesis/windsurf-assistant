#!/usr/bin/env node
/**
 * _three_pure_smoke.cjs — 印 65 · 一气化三清 · 道并行而不悖
 * ════════════════════════════════════════════════════════════════════════
 *   帛书·四十二: 「道生一, 一生二, 二生三, 三生万物.」
 *   帛书·三十九: 「昔之得一者: 天得一以清 · 地得一以宁 · 神得一以灵 · 侯王得一以为天下正.」
 *
 *   守门: 防止任何一清被无意识地"弱化为 Optional"或从前端门面"剔除".
 *
 *   验:
 *     [A] README.md 道义
 *         - 含 "一气化三清" + "Three Pure" + "道并行而不悖"
 *         - 不含 "*Optional*" 邻近 wam/dao-proxy 的贬称
 *         - 不含 "Not required for the cloud-proxy flow"
 *         - 三清各自成段 (## I · 反代 API / ## II · 切号 WAM / ## III · 提示词反代)
 *         - 印 65 印记在尾
 *     [B] web/index.html 三清入口
 *         - 含 #card-three-pure 卡
 *         - link-pure-1 / link-pure-2 / link-pure-3 锚存
 *         - wam / dao-proxy-min / 切号 / 提示词 字眼俱在
 *         - switchTab 函数定义 + window.switchTab 暴露
 *     [C] packages/wam/README.md 三清导航
 *         - 含 "一气化三清"
 *         - 链 ../dao-core/README.md
 *         - 链 ../dao-proxy-min/README.md
 *         - 自标 "II · 切号 WAM · 本"
 *     [D] packages/dao-proxy-min/README.md 三清导航
 *         - 含 "一气化三清"
 *         - 链 ../dao-core/README.md
 *         - 链 ../wam/README.md
 *         - 自标 "III · 提示词反代 · 本"
 *     [E] scripts/devin-bootstrap.sh 三清头标
 *         - 头部含 "一气化三清"
 *         - 提示 devin-bootstrap-fleet.sh 多账号变体
 *     [F] scripts/devin-bootstrap-fleet.sh 多账号一 VM
 *         - 文件存
 *         - 含 "取之尽锱铢"
 *         - 含 DAO_ACCOUNTS env 解析
 *         - 含 N units · N tunnels · cleanup trap
 *         - bash -n syntax (若 bash 存)
 *
 *   零外部依赖 · 纯文件读
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
let pass = 0;
let fail = 0;

function ok(cond, label) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    console.error(`  ✗ ${label}`);
  }
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

function main() {
  console.log("═══ 三清守门 · 印 65 · 道并行而不悖 ═══\n");

  // ── [A] README.md 道义 ──────────────────────────────────────
  console.log("[A] README.md 道义");
  const readme = read("README.md");
  ok(readme.includes("一气化三清"), "含 '一气化三清'");
  ok(readme.includes("Three Pure"), "含 'Three Pure'");
  ok(readme.includes("道并行而不悖"), "含 '道并行而不悖'");
  ok(readme.includes("印 65"), "印 65 印记在");

  // 贬称防御 (印 63 时曾把 wam/dao-proxy 标为 'Optional · Not required')
  ok(
    !/\*Optional\*\s+Windsurf extension/i.test(readme),
    "无 '*Optional* Windsurf extension' 贬称",
  );
  ok(
    !/\*Optional\*\s+Cascade Connect-RPC/i.test(readme),
    "无 '*Optional* Cascade Connect-RPC' 贬称",
  );
  ok(
    !readme.includes("Not required for the cloud-proxy flow"),
    "无 'Not required for the cloud-proxy flow' 贬称",
  );

  // 三清各自成段
  ok(
    /##\s+I\s+&middot;\s+反代\s+API/.test(readme) ||
      /##\s+I\s+·\s+反代\s+API/.test(readme),
    "## I · 反代 API 成段",
  );
  ok(
    /##\s+II\s+&middot;\s+切号\s+WAM/.test(readme) ||
      /##\s+II\s+·\s+切号\s+WAM/.test(readme),
    "## II · 切号 WAM 成段",
  );
  ok(
    /##\s+III\s+&middot;\s+提示词反代\s+dao-proxy-min/.test(readme) ||
      /##\s+III\s+·\s+提示词反代\s+dao-proxy-min/.test(readme),
    "## III · 提示词反代 dao-proxy-min 成段",
  );

  // 三清场景表
  ok(
    readme.includes("any other client") && readme.includes("反代 API"),
    "场景 A (any OpenAI client → 反代 API)",
  );
  ok(
    readme.includes("multiple accounts") || readme.includes("multi-account"),
    "场景 B 含 multiple/multi-account",
  );
  ok(readme.includes("system prompt"), "场景 C 含 'system prompt'");

  // Devin VM 取之尽锱铢
  ok(readme.includes("取之尽锱铢"), "Devin VM 段含 '取之尽锱铢'");
  ok(
    readme.includes("devin-bootstrap-fleet.sh"),
    "提及 devin-bootstrap-fleet.sh",
  );

  // ── [B] web/index.html 三清入口 ──────────────────────────
  console.log("[B] web/index.html 三清入口");
  const web = read("web/index.html");
  ok(web.includes('id="card-three-pure"'), "#card-three-pure 卡在");
  ok(web.includes('id="link-pure-1"'), "link-pure-1 锚存");
  ok(web.includes('id="link-pure-2"'), "link-pure-2 锚存");
  ok(web.includes('id="link-pure-3"'), "link-pure-3 锚存");
  ok(web.includes("一气化三清"), "web 含 '一气化三清'");
  ok(web.includes("Three Pure"), "web 含 'Three Pure'");
  ok(web.includes("道并行而不悖"), "web 含 '道并行而不悖'");
  ok(web.includes("切号"), "web 含 '切号'");
  ok(web.includes("提示词"), "web 含 '提示词'");
  ok(web.includes("wam"), "web 含 'wam'");
  ok(web.includes("dao-proxy-min"), "web 含 'dao-proxy-min'");
  ok(/function\s+switchTab\s*\(/.test(web), "switchTab 函数定义");
  ok(/window\.switchTab\s*=\s*switchTab/.test(web), "window.switchTab 暴露");
  // link-pure-2/3 should be wired to packages/wam · releases/latest
  ok(
    web.includes("/tree/main/packages/wam") || web.includes("packages/wam"),
    "link-pure-2 指 packages/wam",
  );
  ok(web.includes("/releases/latest"), "link-pure-3 指 releases/latest");

  // ── [C] packages/wam/README.md 导航 ──────────────────────
  console.log("[C] packages/wam/README.md 三清导航");
  const wamRm = read("packages/wam/README.md");
  ok(wamRm.includes("一气化三清"), "wam README 含 '一气化三清'");
  ok(wamRm.includes("Three Pure"), "wam README 含 'Three Pure'");
  ok(
    wamRm.includes("../dao-core/README.md"),
    "wam README 链 ../dao-core/README.md",
  );
  ok(
    wamRm.includes("../dao-proxy-min/README.md"),
    "wam README 链 ../dao-proxy-min/README.md",
  );
  ok(
    /II\s*·\s*切号\s*WAM\s*·\s*本/.test(wamRm) ||
      /II\s+&middot;\s+切号\s+WAM\s+&middot;\s+本/.test(wamRm) ||
      wamRm.includes("II · 切号 WAM · 本"),
    "wam README 自标 II · 本",
  );

  // ── [D] packages/dao-proxy-min/README.md 导航 ───────────
  console.log("[D] packages/dao-proxy-min/README.md 三清导航");
  const dpmRm = read("packages/dao-proxy-min/README.md");
  ok(dpmRm.includes("一气化三清"), "dao-proxy-min README 含 '一气化三清'");
  ok(dpmRm.includes("Three Pure"), "dao-proxy-min README 含 'Three Pure'");
  ok(
    dpmRm.includes("../dao-core/README.md"),
    "dao-proxy-min README 链 ../dao-core/README.md",
  );
  ok(
    dpmRm.includes("../wam/README.md"),
    "dao-proxy-min README 链 ../wam/README.md",
  );
  ok(
    /III\s*·\s*提示词反代\s*·\s*本/.test(dpmRm) ||
      /III\s+&middot;\s+提示词反代\s+&middot;\s+本/.test(dpmRm) ||
      dpmRm.includes("III · 提示词反代 · 本"),
    "dao-proxy-min README 自标 III · 本",
  );

  // ── [E] scripts/devin-bootstrap.sh 三清头标 ──────────────
  console.log("[E] scripts/devin-bootstrap.sh 三清头标");
  const boot = read("scripts/devin-bootstrap.sh");
  ok(boot.includes("一气化三清"), "boot.sh 头部含 '一气化三清'");
  ok(boot.includes("devin-bootstrap-fleet.sh"), "boot.sh 提及 fleet 变体");
  ok(boot.includes("SINGLE-ACCOUNT"), "boot.sh 自标 SINGLE-ACCOUNT 模式");

  // ── [F] scripts/devin-bootstrap-fleet.sh 多账号 ──────────
  console.log("[F] scripts/devin-bootstrap-fleet.sh 多账号一 VM");
  ok(exists("scripts/devin-bootstrap-fleet.sh"), "fleet bootstrap 文件存");
  if (exists("scripts/devin-bootstrap-fleet.sh")) {
    const fleet = read("scripts/devin-bootstrap-fleet.sh");
    ok(fleet.includes("取之尽锱铢"), "fleet 含 '取之尽锱铢'");
    ok(fleet.includes("一气化三清"), "fleet 含 '一气化三清'");
    ok(fleet.includes("MULTI-ACCOUNT"), "fleet 自标 MULTI-ACCOUNT 模式");
    ok(/DAO_ACCOUNTS\b/.test(fleet), "fleet 解析 DAO_ACCOUNTS env");
    ok(/DAO_ACCOUNTS_FILE\b/.test(fleet), "fleet 解析 DAO_ACCOUNTS_FILE env");
    ok(fleet.includes("DAO_BASE_PORT"), "fleet 支持 DAO_BASE_PORT");
    ok(/trap\s+cleanup/.test(fleet), "fleet 含 cleanup trap");
    ok(
      fleet.includes("cloudflared tunnel") || fleet.includes("cloudflared"),
      "fleet 含 cloudflared tunnel logic",
    );
    ok(fleet.includes("fleet_vm_unit.js"), "fleet 调 fleet_vm_unit.js");
    ok(
      /UNIT_PIDS\b/.test(fleet) && /TUNNEL_PIDS\b/.test(fleet),
      "fleet 跟踪 UNIT_PIDS + TUNNEL_PIDS",
    );
    ok(/wait\s*$/m.test(fleet), "fleet 末 wait 阻塞 (信号 trap 在前)");

    // bash -n syntax (best effort · skip on Windows/WSL path mismatch · CI Linux 代验)
    //   Windows 下 bash 多为 WSL · 它不识 Windows 绝对路径 (E:\...) · 故跳过.
    //   CI 在 Ubuntu 上跑原生 bash · 可正验.
    if (process.platform === "win32") {
      console.log("  (Win32 · bash -n 由 CI Linux 代验 · 本地跳过)");
    } else {
      try {
        execSync("bash --version", { stdio: "pipe" });
        try {
          execSync(
            `bash -n "${path.join(ROOT, "scripts", "devin-bootstrap-fleet.sh")}"`,
            { stdio: "pipe" },
          );
          ok(true, "fleet bash -n syntax OK");
        } catch (e) {
          ok(false, `fleet bash -n FAILED: ${e.message?.slice(0, 200)}`);
        }
        try {
          execSync(
            `bash -n "${path.join(ROOT, "scripts", "devin-bootstrap.sh")}"`,
            { stdio: "pipe" },
          );
          ok(true, "boot bash -n syntax OK");
        } catch (e) {
          ok(false, `boot bash -n FAILED: ${e.message?.slice(0, 200)}`);
        }
      } catch {
        console.log("  (bash 不在 PATH · 跳过 syntax check · CI 将代验)");
      }
    }
  }

  // ── 总览 ──────────────────────────────────────────────────
  console.log(`\n═══ 三清守门完毕 · pass=${pass} fail=${fail} ═══`);
  if (fail === 0) {
    console.log("✓ 三清并行 · 道并行而不悖 · 印 65 安");
  } else {
    console.error("✗ 三清失衡 · 见上 · 修之于易");
  }
  process.exit(fail === 0 ? 0 : 1);
}

main();
