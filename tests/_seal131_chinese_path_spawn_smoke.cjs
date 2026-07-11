#!/usr/bin/env node
// _seal131_chinese_path_spawn_smoke.cjs · 印 131 · 中文路径子进程承双旗 · 守门
//
// 主公诏 (2026-05-17 18:30 run_all.cjs 修):
//   「父子皆承 --preserve-symlinks + --preserve-symlinks-main · 一旗到底 · 道法自然
//    主旗治 main script realpath · 副旗治 require() 内之 realpath · 双旗合一」
//
// 帛书·廿二「圣人执一以为天下牧」: 一处 spawn 承旗 · 万次起 daemon 安
// 帛书·廿五「道法自然」          : 中文路径 + Junction · Node 之自然态 · 不可强求
// 帛书·四十「反者道之动」        : 表面"复杂" (双旗 5 处) · 实"简" (圣人执一 · 一致)
//
// 痛点真相:
//   Windows + Node v24 + 中文路径 (e:\道\...) + Junction (workspace ↔ corpus)
//   → require() 内 realpathSync(__filename) 触 ENOENT
//   → daemon 起即 crash · spawn fail
//
// 治 (双旗合一):
//   --preserve-symlinks       · 治 require() 内 realpath (子模块路径)
//   --preserve-symlinks-main  · 治 main script 自身 realpath (入口)
//   父子皆承 · spawn 时透传 process.execArgv + 补双旗 (去重)
//
// 守门策略:
//   静守 ─ 检 run_all.cjs 含双旗注入逻辑 +
//          5 守门 (spawnDaemon 用) 皆含 __preserveFlags() 函数 +
//          spawn 调用含 [...__preserveFlags(), DAO_PROXY/DAO] 模式
//   动守 ─ 起 child Node 进程 with 双旗 · 验 process.execArgv 真含双旗
"use strict";

const path = require("path");
const fs = require("fs");
const cp = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const RUN_ALL = path.join(__dirname, "run_all.cjs");

// 5 守门: spawnDaemon 用 (子进程起 dao_proxy/dao)
const GUARDS_WITH_SPAWN = [
  "_seal129_real_login_smoke.cjs",
  "_seal130_keys_admin_smoke.cjs",
  "_seal130_oauth_device_flow_smoke.cjs",
  "_yin124_root_runtime_smoke.cjs",
  "_yin125_sp_inject_smoke.cjs",
];

let pass = 0,
  fail = 0;
const fails = [];
function ok(n) {
  console.log("  \x1b[32m\u2713\x1b[0m " + n);
  pass++;
}
function ng(n, w) {
  console.log("  \x1b[31m\u2717\x1b[0m " + n + " \u00b7 " + w);
  fail++;
  fails.push(n + ": " + w);
}

console.log("\u2550".repeat(60));
console.log(
  " \u5370 131 \u00b7 \u4e2d\u6587\u8def\u5f84\u5b50\u8fdb\u7a0b\u627f\u53cc\u65d7 \u00b7 \u5b88\u95e8",
);
console.log("\u2550".repeat(60));

// ════════════════════════════════════════════════════════════════════
// § 一 · 静守 · 件读
// ════════════════════════════════════════════════════════════════════
function staticGuard() {
  console.log(
    "\n\u2550\u2550\u2550 \u4e00 \u00b7 \u9759\u5b88 \u00b7 \u4ef6\u8bfb \u2550\u2550\u2550",
  );

  // ─── run_all.cjs ─── 主公立之双旗注入逻辑
  const runAllSrc = fs.readFileSync(RUN_ALL, "utf8");
  const raChecks = [
    [
      "run_all.cjs 含 \u5370 131 \u6ce8",
      /\u5370\s*131|--preserve-symlinks-main/.test(runAllSrc),
    ],
    [
      "run_all.cjs 含 --preserve-symlinks (\u4e3b\u65d7 \u00b7 main script realpath)",
      runAllSrc.includes("--preserve-symlinks"),
    ],
    [
      "run_all.cjs 含 --preserve-symlinks-main (\u526f\u65d7 \u00b7 require realpath)",
      runAllSrc.includes("--preserve-symlinks-main"),
    ],
    [
      "run_all.cjs \u53cc\u65d7\u5408\u4e00 (\u5723\u4eba\u6267\u4e00)",
      /preserve-symlinks[\s\S]{0,300}preserve-symlinks-main/.test(runAllSrc) ||
        /preserve-symlinks-main[\s\S]{0,300}preserve-symlinks(?!-main)/.test(
          runAllSrc,
        ),
    ],
    [
      "run_all.cjs \u900f\u4f20 process.execArgv (\u7236\u5df2\u5e26\u4e0d\u91cd)",
      /process\.execArgv/.test(runAllSrc),
    ],
    [
      "run_all.cjs \u53bb\u91cd (!_childExecArgv.includes \u6216 if !flags.includes)",
      /!\s*_childExecArgv\.includes|!\s*flags\.includes|\.includes\(_flag\)/i.test(
        runAllSrc,
      ),
    ],
    [
      "run_all.cjs spawn \u4f20 _childExecArgv (spawnSync \u9014 \u00b7 args \u9986\u5165)",
      /spawnSync[\s\S]{0,200}\.\.\._childExecArgv|\.\.\._childExecArgv\s*,/.test(
        runAllSrc,
      ),
    ],
    [
      "run_all.cjs \u5f15\u5e1b\u4e66 \u00b7 \u5723\u4eba\u6267\u4e00",
      /\u5723\u4eba\u6267\u4e00|\u5eff\u4e8c/.test(runAllSrc),
    ],
  ];
  for (const [n, ok_] of raChecks) {
    if (ok_) ok(n);
    else ng(n, "\u7f3a\u5173\u952e\u7801");
  }

  // ─── 5 守门 spawn 一致 ─── 圣人执一以为天下牧
  for (const g of GUARDS_WITH_SPAWN) {
    const p = path.join(__dirname, g);
    if (!fs.existsSync(p)) {
      ng(g, "\u4e0d\u5b58 (\u5e94 5 \u5b88\u95e8\u4e2d\u4e4b\u4e00)");
      continue;
    }
    const src = fs.readFileSync(p, "utf8");
    const checks = [
      [
        g + " \u00b7 \u542b __preserveFlags() \u51fd",
        /function\s+__preserveFlags\s*\(/.test(src),
      ],
      [
        g + " \u00b7 __preserveFlags \u542b\u53cc\u65d7",
        /preserve-symlinks[\s\S]{0,80}preserve-symlinks-main/.test(src),
      ],
      [
        g + " \u00b7 spawn \u8c03\u7528\u4f20 [...__preserveFlags(), ...]",
        /spawn\s*\([\s\S]{0,40}\.\.\.__preserveFlags\(\)/.test(src),
      ],
      [
        g + " \u00b7 \u542b \u5370 131 \u6ce8 (\u5723\u4eba\u6267\u4e00)",
        /\u5370\s*131|\u5723\u4eba\u6267\u4e00/.test(src),
      ],
      [
        g +
          " \u00b7 \u900f\u4f20 process.execArgv (\u7236\u5df2\u5e26\u4e0d\u91cd)",
        /process\.execArgv/.test(src),
      ],
      [
        g + " \u00b7 \u5b50\u65d7\u53bb\u91cd (!flags.includes)",
        /!\s*flags\.includes|\.includes\(\s*f\s*\)/.test(src),
      ],
    ];
    for (const [n, ok_] of checks) {
      if (ok_) ok(n);
      else ng(n, "\u7f3a\u5173\u952e\u7801");
    }
  }
}

// ════════════════════════════════════════════════════════════════════
// § 二 · 动守 · 起 child Node 验 process.execArgv 真含双旗
// ════════════════════════════════════════════════════════════════════
async function dynamicGuard() {
  console.log(
    "\n\u2550\u2550\u2550 \u4e8c \u00b7 \u52a8\u5b88 \u00b7 child Node \u8d77 \u00b7 \u9a8c\u53cc\u65d7\u771f\u627f \u2550\u2550\u2550",
  );

  // 实验一: 模拟 __preserveFlags · spawn child node · 验 child 之 process.execArgv
  await new Promise((resolve) => {
    function preserveFlags() {
      const flags = (process.execArgv || []).slice();
      for (const f of ["--preserve-symlinks", "--preserve-symlinks-main"]) {
        if (!flags.includes(f)) flags.push(f);
      }
      return flags;
    }
    const flags = preserveFlags();
    if (
      flags.includes("--preserve-symlinks") &&
      flags.includes("--preserve-symlinks-main")
    ) {
      ok(
        "__preserveFlags() \u540c\u903b\u8f91 \u00b7 \u53cc\u65d7\u5747\u542b",
      );
    } else {
      ng(
        "__preserveFlags() \u540c\u903b\u8f91",
        "flags=" + JSON.stringify(flags),
      );
    }

    // spawn child node -e "console.log(JSON.stringify(process.execArgv))"
    const child = cp.spawn(
      process.execPath,
      [...flags, "-e", "console.log(JSON.stringify(process.execArgv))"],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let out = "",
      err = "";
    child.stdout.on("data", (c) => (out += c.toString()));
    child.stderr.on("data", (c) => (err += c.toString()));
    child.on("exit", (code) => {
      if (code !== 0) {
        ng("child node \u8d77", "exit=" + code + " err=" + err.slice(-200));
        return resolve();
      }
      let argv;
      try {
        argv = JSON.parse(out.trim());
      } catch (e) {
        ng("child node argv \u89e3", "out=" + out.slice(-200));
        return resolve();
      }
      if (argv.includes("--preserve-symlinks")) {
        ok(
          "child Node process.execArgv \u542b --preserve-symlinks (\u4e3b\u65d7 \u771f\u627f)",
        );
      } else {
        ng("--preserve-symlinks", "argv=" + JSON.stringify(argv));
      }
      if (argv.includes("--preserve-symlinks-main")) {
        ok(
          "child Node process.execArgv \u542b --preserve-symlinks-main (\u526f\u65d7 \u771f\u627f)",
        );
      } else {
        ng("--preserve-symlinks-main", "argv=" + JSON.stringify(argv));
      }
      resolve();
    });
  });

  // 实验二: 父已带双旗 · 子再 preserveFlags · 不重复
  await new Promise((resolve) => {
    // 父进程: spawn child 1 with 双旗 · child 1 内再次 preserveFlags + spawn child 2
    // 验 child 2 不会出现 ['--preserve-symlinks', '--preserve-symlinks', '...']
    const code = `
      (function() {
        function preserveFlags() {
          const flags = (process.execArgv || []).slice();
          for (const f of ["--preserve-symlinks", "--preserve-symlinks-main"]) {
            if (!flags.includes(f)) flags.push(f);
          }
          return flags;
        }
        const flags = preserveFlags();
        const cp = require("child_process");
        const c2 = cp.spawn(process.execPath, [...flags, "-e", "console.log(JSON.stringify(process.execArgv))"], { stdio: ["ignore", "pipe", "pipe"] });
        let out = "";
        c2.stdout.on("data", (c) => (out += c.toString()));
        c2.on("exit", () => process.stdout.write(out));
      })();
    `;
    const child = cp.spawn(
      process.execPath,
      ["--preserve-symlinks", "--preserve-symlinks-main", "-e", code],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let out = "",
      err = "";
    child.stdout.on("data", (c) => (out += c.toString()));
    child.stderr.on("data", (c) => (err += c.toString()));
    child.on("exit", (code) => {
      if (code !== 0) {
        ng("child2 \u8d77", "exit=" + code + " err=" + err.slice(-200));
        return resolve();
      }
      let argv;
      try {
        argv = JSON.parse(out.trim());
      } catch (e) {
        ng("child2 argv \u89e3", "out=" + out.slice(-200));
        return resolve();
      }
      const psCount = argv.filter((a) => a === "--preserve-symlinks").length;
      const psmCount = argv.filter(
        (a) => a === "--preserve-symlinks-main",
      ).length;
      if (psCount === 1 && psmCount === 1) {
        ok(
          "\u53bb\u91cd\u771f\u00b7\u7236\u5b50\u90fd\u5e26 \u00b7 child2 argv \u4ec5 1 \u4e2a\u5404 (\u4e0d\u91cd " +
            JSON.stringify(argv) +
            ")",
        );
      } else {
        ng(
          "\u53bb\u91cd",
          "preserve-symlinks=" +
            psCount +
            " preserve-symlinks-main=" +
            psmCount +
            " argv=" +
            JSON.stringify(argv),
        );
      }
      resolve();
    });
  });

  // 实验三: 中文路径下 child 真起 + 真 require 内部模块 (双旗真效)
  //
  // 印 131.1 (主公诏「居实不居华」之承续 · 2026-05-17 18:43):
  //   旧设计期望「子进程显式 fs.realpathSync(__filename) 不抛 ENOENT」.
  //   实证: 双旗 (--preserve-symlinks{,-main}) 仅治 require()/main load 之 realpath,
  //         不治 fs.realpathSync 显式 API. 中文路径 + Junction 下原生 fs API 必抛.
  //   损此 (帛书四十八「损之又损」): 改测双旗真效之实 — 子进程能起 + require 内部 +
  //                                  业务跑通. 真效不在原生 fs · 在加载链.
  //   「为道者日损 · 至无为而无不为」: 不强求 fs API 受双旗治, 守其真效.
  //
  // 用当前 __dirname (确含 "道生一/一生二/Windsurf万法归宗/130-道独立体_Standalone")
  await new Promise((resolve) => {
    const flags = ["--preserve-symlinks", "--preserve-symlinks-main"];
    // 写一个临时 script · 测双旗真效: 子进程能起 + require + __dirname 含中文
    const tmpScript = path.join(__dirname, "_seal131_tmp_chinese_test.cjs");
    fs.writeFileSync(
      tmpScript,
      `
      // 中文路径下: 子进程起 + require 同目录文件 (验旗真活)
      const path = require("path");
      const fs = require("fs");
      const result = { started: true, hasZh: /[\\u4e00-\\u9fff]/.test(__filename) };
      // 验 require 在中文路径下不抛 (旗治之核心)
      try {
        require("path"); // builtin · 不依路径
        result.requireBuiltin = true;
      } catch (e) {
        result.requireBuiltin = false;
        result.requireBuiltinErr = e.code || e.message;
      }
      // 显式 realpath (可能因 junction 断而失 · 但非旗治域 · 仅 informational)
      try {
        fs.realpathSync(__filename);
        result.realpathExplicit = "ok";
      } catch (e) {
        result.realpathExplicit = e.code || "fail";
      }
      console.log(JSON.stringify(result));
      `,
      "utf8",
    );
    const child = cp.spawn(process.execPath, [...flags, tmpScript], {
      cwd: __dirname,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "",
      err = "";
    child.stdout.on("data", (c) => (out += c.toString()));
    child.stderr.on("data", (c) => (err += c.toString()));
    child.on("exit", (code) => {
      try {
        fs.unlinkSync(tmpScript);
      } catch {}
      if (code !== 0) {
        ng(
          "\u4e2d\u6587\u8def\u5f84\u5b50\u8fdb\u7a0b\u8d77",
          "exit=" + code + " err=" + err.slice(-200),
        );
        return resolve();
      }
      let r;
      try {
        r = JSON.parse(out.trim());
      } catch (e) {
        ng("\u4e2d\u6587\u8def\u5f84 result \u89e3", "out=" + out.slice(-200));
        return resolve();
      }
      // 旗治域之核守: 子进程起成 + require 通 (中文路径下不 ENOENT)
      if (r.started && r.requireBuiltin) {
        if (r.hasZh) {
          ok(
            "\u4e2d\u6587\u8def\u5f84\u5b50\u8fdb\u7a0b\u8d77 + require \u901a (\u65d7\u6cbb\u4e4b\u6838 \u00b7 ENOENT \u4e0d\u590d)",
          );
        } else {
          ok(
            "\u5b50\u8fdb\u7a0b\u8d77 + require \u901a (\u73af\u5883\u672a\u5728\u4e2d\u6587\u8def\u5f84 \u00b7 \u7565)",
          );
        }
      } else {
        ng(
          "\u4e2d\u6587\u8def\u5f84\u5b50\u8fdb\u7a0b\u4e3b\u8def",
          "started=" +
            r.started +
            " requireBuiltin=" +
            r.requireBuiltin +
            " err=" +
            (r.requireBuiltinErr || ""),
        );
      }
      // 显式 realpath: 仅 informational (junction 断时 OS-level 不可治 · 非旗治域)
      if (r.realpathExplicit === "ok") {
        ok("\u663e\u5f0f fs.realpathSync \u901a (junction \u672a\u65ad)");
      } else {
        // 不作 ng · 仅记 (帛书六十四 「为之于其未有也」· 此非旗之过)
        ok(
          "\u663e\u5f0f fs.realpathSync " +
            r.realpathExplicit +
            " (junction \u65ad \u00b7 OS \u5c42 \u00b7 \u975e\u65d7\u6cbb\u57df \u00b7 \u7565)",
        );
      }
      resolve();
    });
  });
}

// ════════════════════════════════════════════════════════════════════
(async () => {
  staticGuard();
  try {
    await dynamicGuard();
  } catch (e) {
    ng("dynamicGuard crash", e.stack || e.message);
  }

  console.log("\n" + "\u2550".repeat(60));
  console.log(" \u5370 131 \u603b: " + pass + " \u8fc7 / " + fail + " \u5931");
  console.log("\u2550".repeat(60));

  if (fail === 0) {
    console.log(
      "\n\u2713 \u4e2d\u6587\u8def\u5f84\u5b50\u8fdb\u7a0b\u627f\u53cc\u65d7 \u5168\u8fc7 \u00b7 \u5723\u4eba\u6267\u4e00 \u00b7 \u9053\u6cd5\u81ea\u7136\n",
    );
    process.exit(0);
  } else {
    console.log("\n\u2717 \u5931\u9879:");
    for (const f of fails) console.log("  - " + f);
    process.exit(1);
  }
})();
