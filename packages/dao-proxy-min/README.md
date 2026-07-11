# 道Agent · dao-proxy-min · **v9.9.53** · 首尾互文双锚 · 道法自然

> **反者, 道之动; 弱者, 道之用.** —《四十章》
> **损之又损, 以至于无为, 无为而无不为.** —《四十八章》
> **道法自然.** —《二十五章》

## v9.9.53 · 首尾互文双锚 · Turn Anchor 复归 (2026-05-27)

**承 v9.9.36 → v9.9.53 演化链** (source.js 侧 SP 注入精炼 · ext 侧降频/延迟锚定):

| 版 | 变 | 意义 |
|---|---|---|
| v9.9.53 | `TAO_TURN_ANCHOR` 末锚复归 · 首尾互文双锚 | 官方 SP 末段~1500字裸文本闭幕辞被全删→极小帛书风格末锚复归 · 四十七章「不出于户以知天下」 |
| v9.9.52 | 损 `CHECKPOINT_BLOCK_RE` / `CHECKPOINT_MARKER_RE` 死代码 | 两常量定义无引用 · 损之又损 |
| v9.9.51 | CHECKPOINT 不再剥除 · reload 后上下文桥完整 | 归根复命 · 知其真用 |
| v9.9.50 | INFER_STRIP 回退 `modifyAnyInferenceSP` · `trimUserInfo` 截断终端历史 | 反误治 · 用真柔 |
| v9.9.49 | 移除"及其后文本"冗余补丁 | 精准指向经典 |
| v9.9.47 | 书名号复归 · 动态经藏名 · 认知锚点 | 名可名也 非恒名也 |
| v9.9.45 | proto 损坏根治 · `nestedOk` 移出 if 块 | 柔弱者生之徒 |
| v9.9.42-44 | SCT 精炼 · `SECTION_OVERRIDE` 全删 · `session_context` 移出 | 真无为 |
| v9.9.38 | 去 `_cachedAnchored` 门控 · spawn hook 无条件重写 · TAO_HEADER 帧宽修正 | 太上下知有之 |
| v9.9.36 | activate 15s 延迟锚 · deactivate 智能保锚 · 降频减压 · **三窗口连环重载根治** | 从根本底层完善 |

**无感升级 (9935 → 9953)**:

```powershell
# Windows — 软编码自检测最新 vsix · 无需指定版本
.\install.ps1
# install.ps1 自动: sort -Descending dao-proxy-min-*.vsix → 取最新 → 旧版标 .obsolete → 装毕

# Mac/Linux
./install.sh
```

装毕重启 Windsurf → 命令面板「道Agent: 启 (invert)」→ `/origin/ping` 验:

```json
{"ok":true,"version":"v9.9.53",...}
```

---

## v9.9.29 · 终端会话池 · 七层污染一招治 · 印 160 (2026-05-19)

**主公诏 (5/19 03:11)**: 「**专注于最本源最核心的终端问题 · 反者道之动 · 不依赖任何第三方 · 推进到底 实现一切**」

**七层污染** (均源于「共享一 shell」之设):

| 层 | 病 |
|---|---|
| ① OS cwd | 进程单例 |
| ② OS env | 继承可变 |
| ③ PTY | 字节流交织 |
| ④ Shell `%ERRORLEVEL%`/`$?` | 会话单例 |
| ⑤ IDE 终端池 | 复用 |
| ⑥ Agent 调用无状态 + 终端有状态 | 错配 |
| ⑦ 多 agent race | 抢 |

**真治** (反者道之动 · 弱者道之用):

★ 每 agent 一独立 `cmd.exe`/`bash` 子进程 (`cp.spawn /k mode` · OS 进程级隔离) ★

| 关键技术 | 作用 |
|---|---|
| `cp.spawn` 子进程 | OS 进程级隔离 · 各自 cwd / env / ERRORLEVEL |
| stdin pipe 持续写 | 多次 exec 同 sid · shell 不死 · 状态保 |
| sentinel (RS+UUID) 包夹 | 流切片 · 不同 exec 输出绝不交织 |
| `ver>nul` 重置 ERRORLEVEL | 上次 errorlevel 不污下次 |

**零第三方** · 全 Node 内置 `child_process` · ~280 行新增 · `_test_v9929_term_pool.js` **15/15 PASS**.

### 三路调

| 路 | 用 | 端 |
|---|---|---|
| ① 命令面板 | 主公手控 · GUI | `dao.term.exec` / `dao.term.list` / `dao.term.close` |
| ② HTTP | agent 远调 · localhost only | `:12780~12829` (per-user FNV) `/term/exec` `/term/list` `/term/close` `/term/ping` |
| ③ ext.js 内调 | 本扩展自调 | `_ensureTermPool().exec(sid, cmd)` |

**昧 v9.9.28 三治不动**: 治一 source.js process.on · 治二 detached cleanup spawn · 治三 watchdog 四重去抖.

### 道义

- 四十「**反者道之动 · 弱者道之用**」— 反共享一终端 · 用 `child_process` 弱柔
- 六十一「**大邦下流 · 牝以靓胜牡**」— 每 sid 处下一 shell · 不争一终端
- 二十八「**朴散为器 · 圣人用则为官长**」— `spawn` 之朴 · 散为多 shell 之器
- 四十八「**损之又损**」— 零依赖 · 七层一招

---

## v9.9.28 · detached cleanup spawn · 根本底层卸自身本体 · 印 159 (2026-05-19)

**主公诏 (5/19 02:36)**: 「**无在乎一切路径 必须从根本底层首要解决点击卸载后能无论如何都能卸载插件本体**」

**真本源诊** (印 158 v9.9.27 zhou 实证漏): Windsurf 1.110.1 fork **启动协议不可信**:

- `.obsolete` 标了 9.9.22/23/24 → 启动协议**未清物理目录** ✗
- `extensions.json` 中 self 条目: fork uninstall API **漏删** ✗
- `:8981` utility 子进程: deactivate 时**未 kill** · 成孤儿反代 ✗

3 病合 → 主公视为「最底层根本没卸载插件本体」.

**治本一招** (反者道之动 · 自治 · 弱者道之用):

★ spawn detached child_process · **脱 ext-host / Windsurf 主父子链** ★

| 关键技术 | 作用 |
|---|---|
| `cp.spawn(process.execPath, [...], { detached:true, stdio:'ignore' })` | 脱父子链 · ext-host 死了它仍活 |
| `child.unref()` | 父进程不等子进程退 |
| `ELECTRON_RUN_AS_NODE=1` env | 让 Windsurf.exe (Electron) 跑普通 Node 脚本 (无需独立 Node 安装) |
| `_cleanup_spawn.js` (346 行 · 五招清残) | 独立小进程 · 自治完成所有清 (帛书八十「小邦寡民」) |

**`_cleanup_spawn.js` 五招清残**:

1. **sleep 2s** — 等 ext-host 真死 + Windows 文件 lock 释放
2. **rm 物理目录** — 扫 `<ext-dir>/<self-id>-*` → `fs.rmSync` (10 次重试 · 5s 总 · 治 .obsolete 启动协议漏清)
3. **patch extensions.json** — 删 `<self-id>` 条目 (兜底 fork uninstall API 漏写)
4. **patch .obsolete** — 删 `<self-id>-*` 死标 (清死标)
5. **kill :8889~:8988 LISTENING utility** — 三法查 cmdline (`Get-CimInstance` / `wmic` / `tasklist`) · 三招皆失则兜底直 kill (因端口范围内 listening 必反代)

**三路径全覆 + 幂等保** (`_detachedCleanupSpawned` 标 · 仅 spawn 一次):

| 路径 | 触发 | spawn 时机 |
|---|---|---|
| ① **cmdPurge** (命令面板「了事拂衣去」) | 主公点命令 | F 段后 · reloadWindow 前 |
| ② **watchdog** (`onDidChange`) | 扩展面板 [✘] · CLI uninstall · 编程卸 | self 不在 `extensions.all` → 立 spawn + reloadWindow (3s 后) |
| ③ **deactivate** (兜底任何路径) | ext-host shutdown | 仅 `vscode.extensions.getExtension(self) === undefined` 时 spawn |

**承 v9.9.27**: 软编码彻终 (`SELF_EXT_ID` / `SELF_EXT_DIR_REGEX`) + onDidChange watchdog · 不动.

**承 v9.9.26**: 三招 (deactivate ⑦ 强标 .obsolete + cmdPurge 末自动 reloadWindow + 三平台主进程退) · 不动.

**道义**:

- 四十「**反者，道之动；弱者，道之用**」— 反 fork API 不可信 · 独立 spawn 自治
- 六十四「**为之于其未乱也**」— spawn 先 · 后 reloadWindow · 治未乱
- 八十「**小邦寡民**」— 独立小进程 · 不与争 · 唯做己事
- 七十六「**天下莫柔弱于水, 而攻坚强者莫之能胜**」— 以独立 detached 之柔 · 攻 fork API 不可信之坚
- 三十三「**胜人者有力也; 自胜者强也**」— 自身卸自身 · 自胜者强

---

## v9.9.27 · 软编码彻终 · 印 158 (2026-05-19)

**主公诏**: 「**查看所有成果 · 检测所有成果 · 软编码一切 · 适配所有用户 · 所有用户均可用一切 · 推送发布最新之版本于 github 当前主账号 zhouyoukang 和子账号 zhouyoukang1234-spec 双同步推送一切**」

**治本一招** (二十八章「夫大制无割」):

承 v9.9.25 立 `SELF_EXT_ID` / `SELF_EXT_DIR_REGEX` 抽自 `package.json` 之朴 · 续治 `cmdPurge` step 7/9 + `deactivate` 兜底 5 处残硬写 · 全改用 `SELF_EXT_ID` / `SELF_EXT_DIR_REGEX` · 一处定义 · 全文一致 · **适所有 fork / 所有 publisher.name 改名之派生版**.

| 维 | 适法 |
|---|---|
| 扩展 ID | `SELF_EXT_ID` 抽自 `package.json.publisher + .name` |
| 目录前缀 | `SELF_EXT_DIR_REGEX` = `^${SELF_EXT_ID}-` |
| .obsolete 强标 (cmdPurge step 7) | 用 `SELF_EXT_DIR_REGEX` 扫物理目录全标 |
| uninstallExtension 调用 (cmdPurge step 9) | 用 `SELF_EXT_ID` |
| deactivate 兜底 identifier.id 比对 | 用 `SELF_EXT_ID` |

主公若 fork 此 repo · 改 `package.json` 之 `publisher` / `name` (e.g. `myorg.dao-mini`) → 不改一行 .js → 自身 .obsolete 标 / uninstallExtension 调 / deactivate 兜底 全部自适新 ID. 玄同 · 名实终一.

---

## v9.9.25 · 软编码归一 · 适所有用户 (2026-05-19 · 历史)

**主公命**: 「**软编码一切 · 适配所有用户 · 所有用户均可用一切**」

**治本两味** (反者道之动 · 损之又损):

| 改 | 损/守 | 道义 |
|---|---|---|
| 抽 `SELF_EXT_ID` 自 `package.json` (`publisher` + `name`) · 一处定义, 全文一致 (3 处 `dao-agi.dao-proxy-min` 字面散写归一) | -10 行硬写 / +20 行常量 | 二十八章「朴散为器·圣人用则为官长·夫大制无割」 · 主公若 fork/重命名/改 publisher · 改一处即净 |
| `cmdPurge` F 层主进程退三平台兜底 (Win=`wmic`+`taskkill` / Mac=`ps`+`kill -9 Windsurf.app/MacOS/Windsurf` / Linux=`ps`+`kill -9 windsurf`) | +60 行 (Mac/Linux 等价) | 二十五章「人法地, 地法天, 天法道, 道法自然」· 三平台一视同仁 · 不再 Win-only |

**v9.9.25 软编码全谱** (适所有用户实证):

| 维 | 适法 | 位 |
|---|---|---|
| 用户名 | `os.userInfo().username` 动态 | extension.js (`forceRestartLS` USERNAME 过滤) |
| home 目录 | `os.homedir()` 跨平台 | extension.js (settings 路径 / .obsolete 路径 / .windsurf/extensions 路径) |
| 配置基目录 | Win=`%APPDATA%` / Mac=`~/Library/Application Support` / Linux=`$XDG_CONFIG_HOME` 或 `~/.config` | extension.js `_settingsJsonPath()` |
| 端口分配 | `default: 0` · per-user **FNV-1a hash** · 8889..8988 · 多账号自然隔离 | package.json + extension.js |
| 平台 LS 杀 | Win=`taskkill /F /FI IMAGENAME` / Mac+Linux=`pkill -f` (含 `-u $uid`) | extension.js `forceRestartLS` |
| **平台主进程退 (v9.9.25 新)** | Win=`wmic`+`taskkill /F /PID` / Mac=`ps`+`kill -9 Windsurf.app/MacOS/Windsurf` / Linux=`ps`+`kill -9 windsurf` | extension.js `cmdPurge` F 层 |
| OS 限制 | `package.json.os = ""` · 不限平台 | package.json |
| 扩展 ID 自识 | `SELF_EXT_ID` 抽自 publisher+name | extension.js (v9.9.25 新) |
| 端口冲突避让 | EADDRINUSE 不抢 · 1 ping 验·活复用·死归直连 | extension.js `proxyStart` |

**装 v9.9.25 三步路径**:

```text
① 主公先关 Windsurf (确保旧 LS / 旧 proxy 已退)
② 主公启 Windsurf · UI 卸旧版 (若装) → 主公专用-彻底脱钩.ps1 兜清残锚 (可选)
③ 主公装 dao-proxy-min-9.9.25.vsix (拖入 Windsurf 或 命令面板 → Install from VSIX)
   activate 自动: proxyStart :8889..8988 (per-user FNV) + setAnchor + spawn-hook 挂
   主公开新对话 → invertSP 自动注帛书《老子》+ 道藏《阴符经》→「本源观照」面板三 dot 全亮
```

「**朴散为器, 圣人用则为官长, 夫大制无割.**」(二十八章) — v9.9.25 抽常量归一 · 一处定义, 万法承之.

---

## v9.9.16 · 归根复命 · 字符级复 9.9.13 之朴 (2026-05-16 · 历史)

> **致虚极也, 守静笃也. 万物并作, 吾以观其复也.**
> **夫物云云, 各复归于其根. 归根曰静, 静曰复命. 复命曰常, 知常曰明.** —《十六章》
> **生而弗有, 长而弗宰, 是谓玄德.** —《五十一章》

**主公命**: 「**道法自然 无为而无不为 · 致虚极也 守静笃也 · 万物并作 吾以观其复也 · 归根曰静 静曰复命 · 复命曰常 知常曰明**」

**史诊**:

- 主公诉 (5/16): 「**最近重新部署的版本 (v9.9.15) 完全没有任何效果**」
- 真因: v9.9.15 真药 O 之 standby 模式 (默不锚) → settings.json 不写 → LS spawn cmdline 仍朝官方 codeium URL → proxy :8889 端口空转 0 流量 → invertSP 全废
- 5/13 BOTTOM_LAYER 实证已表: 「卸后无法连官方」非 dao-proxy 罪 · 乃本机 byok 特殊性
- 真药 O 治非病, 反损"装即生效"之直觉 — 「**为者败之**」(六十四章)

**v9.9.16 之治** (字符级双复 + 字节级双守):

| 改 | 损/守 | 道义 |
|---|---|---|
| `extension.js` activate not-anchored 分支字符级复 9.9.13 (proxyStart + setAnchor + spawn-hook) | -30 行 (删真药 O autoInvert/standby) | 「**致虚极也**」: 不加 standby 之新概念 |
| `extension.js` deactivate 字符级复 9.9.13 (软切 passthrough → 断 hook → dispose → proxyStop) | -12 行 (删真药 M 自清锚) | 「**守静笃也**」: 不动 settings.json 于 deactivate |
| `cmdPurge` race 15s + 进度提示 (9.9.15 真药 P+) | 守 字节级 | 「**万物并作, 吾以观其复也**」: UX 治实病 · 不动 |
| dao.* 三键 Promise.allSettled (9.9.14 真药 N) | 守 字节级 | 「**复命曰常**」: 实证善 · 不动 |

**v9.9.16 后字节级守大常**:

- `source.js` 三版 SHA256 全等: `8BAC80DC950E29501CBF1E8E61E6662D` (v9.9.13 = v9.9.15 = v9.9.16)
- `_silk_dao.txt` + `_silk_de.txt` 三版字节级全保
- 反代核 / invertSP / spawn-hook / 帛书《老子》本源 — **全字节级不变**
- `taskkill = 0` / `pkill = 0` / `forceRestartLS = 不存在` (承 v9.9.2)
- 主动 `reloadWindow = 0` (承 v9.9.2)
- 软编码三大常 (端口自映 / settings 跨平台 / 持存相对) — 全字节级保 (承 v9.9.12)

**主公装 v9.9.16 三步路径**:

```text
① 主公先关闭 Windsurf (确保旧 LS / 旧 proxy 已退)
② 主公启 Windsurf · UI 卸 v9.9.15 (若装) → 主公专用-彻底脱钩.ps1 兜清残锚 (可选)
③ 主公装 dao-proxy-min-9.9.16.vsix (拖入 Windsurf 或 命令面板 → Install from VSIX)
   activate 自动: proxyStart :8889 + setAnchor + spawn-hook 挂
   主公开新对话 → invertSP 自动注帛书《老子》→「本源观照」面板 dot=三亮 → 道魂 ~7237 字
```

**主公自决之退路**:

- 装 v9.9.16 装即生效 → 期 ✓ · 「本源观照」三 dot 全亮
- 仍诉无效 → 检 settings.json 锚 → 走 `dao.purge` (race 15s) 净卸再装
- 欲回 v9.9.13 → 主目录之 `dao-proxy-min-9.9.13.vsix` 直装 (字符级与 9.9.16 之 activate/deactivate 同朴)
- 欲查 v9.9.14 / v9.9.15 → `_archive/pre_v916_purge/_vsix_old/` 内
- 欲查 5/16 之全实证 → `FINAL_TRUTH_2026-05-16_GUIGEN.md`

「**致虚极也, 守静笃也. 万物并作, 吾以观其复也. 归根曰静, 静曰复命. 复命曰常, 知常曰明.**」(十六章) — v9.9.16 复 9.9.13 之朴, 静止于本源, 知常即明.

---

## v9.9.4 · 弱者道之用 · 拔卸载卡死之根 (2026-05-09 · 历史)

**主公命**: 「参考早期 6.0/7.0 时代之卸载逻辑, 解决当前卸载仍容易卡死之问题, 解决一切, 道法自然.」

**史诊**:

- 主公见: 「净卸开始 → ✓ 透传 → ✓ spawn hook 已卸 → ✓ dao 设置已清 → → 不再杀 LS 自然 fallback → → 主公手动 Reload Window → [refresh] postMessage → **卡**」
- step 5-9 永不执行 · 卡点 = `cmdPurge step 5: await proxyStop()`
- 根因: v9.9.2 真药 I 之后 cmdPurge **不再杀 LS** · LS 仍连 proxy stream → `httpServer.close()` 等**所有 in-flight stream 完结** → **30s+ 卡**

**早期 6.0/7.0 之精髓** (`dao-agi/_uninstall_sentinel.js`):

- **detached 子进程**: `spawn detached` 离开 ext-host · 不在主线程 wait
- **setTimeout 延迟探察**: 让 deactivate 先完 · 再清理
- **race-timeout 兜底**: kill proxy 超时即放弃
- **selfDelete 自删**: 任务完即灭迹 (五十一章「生而弗有」)

**v9.9.4 真药 P** (purge-fast · 借早期精髓 · 极小损):

| 改 | 损 | 道义 |
|---|---|---|
| `proxyStop()` 加 `Promise.race([close, setTimeout(1500)])` | +4 行 | **四十章「弱者道之用」**: 不强力等 stream · 1.5s 即放弃 · `_proxyHandle` null · ext-host dispose 时自清 |
| `cmdPurge` step 9 `uninstallExtension` 加 `race(3000)` | +4 行 | 同上: 3s 即返回 · 「卸载已发起 · 后台完成」· 不空等 |
| `.vscodeignore` 加 `*.bak` / `*.v9.9.2-MN-bak` 排除 | +5 行 | **四十八章「为道日损」**: v9.9.3 损版备份不再入 vsix · 复归至简 |

**v9.9.4 后 ext-host 大常**:

- `taskkill = 0` / `pkill = 0` / `forceRestartLS 函数 = 不存在` (承 v9.9.2)
- 主动 `reloadWindow = 0` (承 v9.9.2)
- `source.js` 字节级 = v9.9.0 (111238 bytes · 承 v9.9.3 · 真药 A 还在)
- `proxyStop` / `uninstallExtension` 加 race-timeout (新)
- `invertSP` / `modifySPProto` / `modifyRawSP` / `modifyAnyInferenceSP` / `deepInvertProto` / `SIDE_CHANNEL_TAGS` / 照观体系 — **字符级不变**

## v9.9.3 · 复归于其根 · 删真药 M+N · 字节级回归 v9.9.0 (2026-05-08 · 承)

**主公苦之**:

- 装 v9.9.2 后新窗口对话即报「**Invalid argument: an internal error occurred**」
- proxy `:8890` `/origin/ping` 即报「**response ended prematurely**」
- LS PID 38644 占 **14 GB** 内存 · H2 stream 累积泄漏之实证

**史诊** (反者道之动 · 自检):

吾 v9.9.1 自加 **真药 M** (删 `req.close(!complete) → cancelUpstream`) + **真药 N** (`deepStripProtoSideChannels` 顺序倒置) — 二者皆「妄为之新变」, 违主公命「不引入新变化导致新问题」.

**真药 M 反向施药**: v9.2.0 之 **真药 A** 加 `req.close` listener 是为**防 H2 stream 泄漏** (HOL 阻塞之根). 吾 v9.9.1 删之 → upstream 不被 cancel → **累积泄漏** → 服务端协议层错 (`Invalid argument`) + node http server 损 (`response ended prematurely`) + LS 内存 14 GB 之果.

**v9.9.3 唯减不增** · `source.js` 字节级回归 v9.9.0:

| 真药 | 病 | 治 | 文 |
|---|---|---|---|
| **删 M** | 真药 M 反 v9.2.0 真药 A · H2 stream 泄漏 | `source.js` 字节级回归 v9.9.0 (111238 bytes · 真药 A 还在) | `vendor/bundled-origin/source.js` |
| **删 N** | 真药 N 改 proto 字节布局 · 风险妄为 | 同上 (一文复二药) | 同上 |
| **戒** | 永戒妄为之新变 | 损版备 `vendor/bundled-origin/source.js.v9.9.2-MN-bak` 为戒 | 备份 |

**保留** v9.9.2 之 `extension.js` 真药 **G+H+I+J+K** (kill 进程之拔本 · 实证有效).

**v9.9.3 后 ext-host 大常**:

- `taskkill` = **0** 处 / `pkill` = **0** 处 (承 v9.9.2)
- `forceRestartLS` 函数 = **不存在** (承 v9.9.2)
- 主动 `reloadWindow` = **0** 处 (承 v9.9.2)
- `source.js` 真药 M+N **已删** (回归 v9.9.0 字节)
- `invertSP` / `modifySPProto` / `modifyRawSP` / `modifyAnyInferenceSP` / `deepInvertProto` / `SIDE_CHANNEL_TAGS` / 照观体系 — **字符级不变**

## v9.9.2 · 拔本 · 完 v9.9.1 之未阙 (2026-05-08 · 承)

**主公命**: 「专门解决本源核心之终端 windsurf kill 进程之问题, 而不引入新变化导致新问题.」

**史诊** (`FINAL_TRUTH_2026-05-08.md` + `_审视/V991_PLAN_TRUE_MEDICINE_GHIJK.md`):

- v9.9.0 deactivate 真药 E 已不杀 LS (已证). 然 cmdPurge 内 `forceRestartLS` 用 Win `taskkill /FI "USERNAME eq <user>"`, **不限定本窗口** — 主公 18+ Windsurf 多窗一调即 **广域杀全部 LS**, 所有窗 Cascade 同断, 主公苦之久矣.
- v9.9.1 应继施 **I+J+K** 拔此余根. 吾误施 G+H+M+N 而漏 I+J+K, 半阙也.

**v9.9.2 唯减不增** · 字符级损 3 处 · 守 SP 替换大常**字符级不变**:

| 真药 | 病 | 治 | 文 |
|---|---|---|---|
| **I** (拔本) | `forceRestartLS` 用 `taskkill /FI USERNAME=user` 不限定本窗 · 多窗广域杀 LS · 主公苦之久矣 | **删函数全身** · 「生而弗有」不该用之物不该存 · 残锚指死端口 · LS retry 失败后自然 fallback 直连官方 | `extension.js:269-311 → 删` |
| **J** (不打断) | `cmdPurge` 末弹 modal「立即重载」→ `reloadWindow` 整窗重载断流 | 不弹 modal · 仅 `showInformationMessage` · 主公自决 Reload Window | `extension.js:1533-1545 → 简` |
| **K** (自净) | `taskkill` 残于代码 · 诱使将来重用 | 真药 I 已删 `forceRestartLS` (taskkill 仅在此一处) · 自然 0 处 | `extension.js: taskkill=0 (验)` |

**v9.9.2 后 ext-host 大常**:

- `taskkill` = **0** 处
- `pkill` = **0** 处
- `forceRestartLS` 函数 = **不存在**
- 主动 `reloadWindow` 调用 = **0** 处 (cmdInvert 已 v9.9.1 真药 H 移除, cmdPurge 此次真药 J 移除)
- 本插件从此 **绝对零杀路** · 上善若水

## v9.9.1 · 真正最小化 (2026-05-08 · 承)

**重审本源**: v9.9.0 deactivate 真药 E 干净 (LS 不杀已证) · 然 source.js 上游有 4 病灶未除, 致长对话中断未根治. v9.9.1 唯减不增 · 字符级损 4 处, 守 SP 替换大常**字符级不变**.

| 真药 | 病 | 治 | 文 |
|---|---|---|---|
| **M** (致命) | `req.close → !req.complete → _cancelUpstream` 误触 NGHTTP2_CANCEL · 长 SSE 之 `req.complete` 假阴 → LS stream reset | 删此监听 · 唯 `req.aborted` + `res.close` 双路守 | `vendor/bundled-origin/source.js:2160-2168` |
| **N** (渐损) | `deepStripProtoSideChannels` 先试 `parseProto` · UUID/JSON/token 等纯文本字段恰可解为畸形 proto · `serializeProto` 改字节布局 → 上游字节校验渐败 | 倒序 · 先 `looksLikeUtf8Text` · 否则才嵌套 proto | `vendor/bundled-origin/source.js:796-842` |
| **G** (资源压) | `watchdog 30s setInterval` · 持续 timer overhead · 重起触新 spawn | proxy 死则任之 · 主公自决 `dao.invert` 重锚 | `extension.js:2219-2226` |
| **H** (着相) | `cmdInvert` 弹 modal "立即重载" · 主公点 → reloadWindow → 整窗重载断流 | 不弹 modal · 仅消息 · 主公完全自决 | `extension.js:1309-1326` |

**继承**: v9.9.0 真药 E (deactivate 不杀 LS) · v9.8.0 守一不离 (setAnchor 同值不写) · v9.7.9 中性化 SECTION_OVERRIDE · v9.7.7 复归于朴.

**守大常**: `invertSP` / `modifySPProto` / `modifyRawSP` / `modifyAnyInferenceSP` / `deepInvertProto` / `SIDE_CHANNEL_TAGS` / 照观体系 — 字符级不变.

---

## v9.2.0 摘要 (历史 · 2026-05-03)

**去芜存菁 · 道法自然**: 于 v9.1.2 之上, 仅施四味真药, 净减码量, 不增功能, 不增状态. 与 v10.x 主源并行不悖.

| 真药 | 漏 | 药 | 道义 |
|---|---|---|---|
| **A** | `proxyToCloud` 无 `req.aborted` / `res.close` / `upStream.setTimeout`, H2 stream 泄漏致 HOL 阻塞 | `req.aborted` + `res.close` + `upStream.setTimeout(180s)` → `NGHTTP2_CANCEL` | 四十章·**弱者道之用** |
| **B** | `setAnchor` 每次 activate 必写 `settings.json`, file watcher 空转, ext-host 抖动 | API+文件双路同值不写 | 六十四章·**为者败之** |
| **C** | `proxyStart` EADDRINUSE 仅单次 ping, 假定远端永活, dead remote 成 phantom | 1 ping → 活则 remote handle, 死则返 null (本窗口直连, 不抢端口) | 八章·**上善若水** |
| **D** | `activate` 首装即 `forceRestartLS()` 广域杀, 多窗口连锁 ext-host crash | activate 仅装 hook + 锚 settings, 不主动杀 LS, 自然重启时挂钩 | 四十八章·**为道日损** |

**默认改动**: `dao.origin.banner` true → false (不言之教)

**向后兼容**: 命令 / SP 置换逻辑 / 端口计算 / 锚定格式 全无变.

## v9.1.3 之过 · 前车之鉴 · 损之未足复益

v9.1.3 试图修补但 **加六事**: PID 簿 / `_trackChild` 跟踪 / `forceRestartLS` 广窄分级 / EADDRINUSE 三验 / 8s 复查 / 60s 健康探针 / 离线 handle.

```text
为学者日益 (v9.1.3 走的路)  ←  反者道之动  →  闻道者日损 (v9.2.0 复归)
```

新增的 `_startRemoteHealthProbe()` (60s setInterval), `_spawnedLsPids` (Set), `_createOfflineHandle` (虚兜底), `三路验证 + setTimeout(8s)` — 此 6 处皆 **执** (六十四章: 执者失之). 净增 200+ 行码, 增分支, 增计时器, 增状态. 反伤本源.

v9.1.3 之 vsix 已留作 **前车之鉴** (`dao-proxy-min-9.1.3.vsix` 80.14 KB), 不再使用. v9.2.0 之 vsix 76.31 KB · 较 v9.1.3 净减 1.96 KB.

## 文件清单

```text
dao-proxy-min-9.1.x-改良/
├─ extension.js                              # ~2120 行 · 主体 (净于 9.1.3)
├─ package.json                              # version=9.2.0
├─ vendor/bundled-origin/
│  ├─ source.js                              # 真药 A 在此 (proxyToCloud · 行 ~2398)
│  └─ _dao_81.txt                            # 道德经八十一章
├─ media/                                    # icon
├─ _selftest.js                              # 离线自测 · 27 项 (T1-T8) · 道恒无名
├─ _pack_vsix.ps1                            # 打包脚本 · 自 package.json 取版本
├─ _install_gentle.ps1                       # 温和装 · 不杀 LS · 不重启
├─ _emergency_revert_to_origin.ps1           # 紧急回退至本源 (无插件无锚)
├─ _verify_install.ps1                       # 装后验证
├─ _verify_vsix.ps1                          # vsix 内容检
├─ _peek_ext_manifest.ps1                    # 看 extensions.json
├─ _probe_running_proxy.ps1                  # 探在跑反代
├─ dao-proxy-min-9.2.0.vsix                # 当前出品
├─ dao-proxy-min-9.1.3.vsix                  # 前车之鉴 (勿装)
├─ LICENSE.txt
└─ readme.md
```

## 自检 · 27/27 全过

```powershell
node _selftest.js
# T1 start · port=58937
# T2 ping · mode=passthrough
# T3 preview
# T4 setMode · invert ↔ passthrough
# T5 abort_cleanup · 20×abort 后 server 存活
# T6 invertSP · 含道
# T7 EADDRINUSE_raises
# T8/A1-A4 真药 A 在 (req.aborted/res.close/setTimeout/NGHTTP2_CANCEL)
# T8/B1-B2 真药 B 在 (同值不写)
# T8/C1-C2 真药 C 在 (1 ping fallthrough)
# T8/D1-D2 真药 D 在 (activate 不调 forceRestartLS, deactivate 仍调)
# T8/W1-W7 七味芜全去 (PID簿/track/offline/probe/timer/broad参 全无)
# T8/M1-M2 元数据 v9.2.0 + banner=false
```

## 装

```powershell
.\_pack_vsix.ps1            # 打 dao-proxy-min-9.2.0.vsix
.\_install_gentle.ps1       # 温和装 (不杀 LS, 等自然 reload 生效)
```

或:

```powershell
windsurf --install-extension dao-proxy-min-9.2.0.vsix --force
```

## 一句话

反代 Windsurf Cascade 之 Connect-RPC, 道德经八十一章直为 SP 起首, 彻底去除官方一切着相之名 (身份/风格/规训), **工具本身全保不动**, 三档 RPC 全覆盖. per-user 端口自然隔离, 二态零代价热切, SSE 实时推送, 一键净卸归本源.

## v9.2.0 较 v9.1.2 改动定位

| 文件 | 行 | 改动 |
|---|---|---|
| `vendor/bundled-origin/source.js` | ~2398-2476 (proxyToCloud) | 真药 A: 加 `req.aborted`/`res.close`/`upStream.setTimeout`/`NGHTTP2_CANCEL` |
| `extension.js` | ~415-470 (setAnchor) | 真药 B: 同值不写 (API+文件双路比对) |
| `extension.js` | ~285-336 (proxyStart) | 真药 C: EADDRINUSE 1 ping → 活则 remote, 死则 null |
| `extension.js` | ~2029-2081 (activate) | 真药 D: 不调 `forceRestartLS()`, 锚 settings 后等自然重启 |
| `package.json` | line 5 | version 9.1.2 → 9.2.0 |
| `package.json` | line 124 | `dao.origin.banner` default true → false |

七味芜不在 (相较 v9.1.3): `_spawnedLsPids` / `_trackChild` / `_createOfflineHandle` / `_startRemoteHealthProbe` / `_stopRemoteHealthProbe` / `_healthProbeTimer` / `forceRestartLS({broad})` 参数.

## 7 命令

| 命令 | 道义 |
|---|---|
| **道Agent: 启** (`wam.originInvert`) | 启代理 + 锚 settings + LS 重启 (用户显式触发, 不在 activate 自调) |
| **官方Agent: 启** (`wam.originPassthrough`) | 上善若水 · 透传观照 |
| **道Agent: 切换模式** | 二态热切 · 零代价翻转 · 下次对话生效 |
| **道Agent: 浏览器观真 SP** | 打开 `/origin/preview` |
| **全链路自检** (E2E) | 致虚守静 · L1+L2 报告 |
| **闭环自检** (L1+L2) | 同上 |
| **了事拂衣去** · 净卸 | 停反代 · 清设置 · 卸插件 · 归本源 |

## 控制面端点

```http
GET  /origin/ping           # 状态
GET  /origin/mode           # 当前模式
POST /origin/mode           # 切模式 {"mode":"invert"|"passthrough"}
GET  /origin/preview        # 实时全貌
GET  /origin/last           # 最近一次 SP 注入
GET  /origin/realprompt     # 捕获轨实 SP
GET  /origin/selftest       # 4 路径闭环自检
GET  /origin/paths          # 路径直方图
GET  /origin/stream         # SSE 推式
GET  /origin/custom_sp      # 读自定义 SP
POST /origin/custom_sp      # 写自定义 SP
DELETE /origin/custom_sp    # 清自定义 SP
```

## 配置

| key | 默认 | 说明 |
|---|---|---|
| `dao.origin.port` | `0` (自动) | 反代端口 · 0=per-user FNV-1a hash (8889..8988) · 非0覆盖 |
| `dao.origin.defaultMode` | `invert` | 首激默模 · `invert`/`passthrough` |
| `dao.origin.banner` | `false` | 启动时显道德经横幅 (默认 false · 不言之教) |

运行时自动锚定:

| key | 说明 |
|---|---|
| `codeium.apiServerUrl` | 道Agent 启时设 `http://127.0.0.1:{port}` · 净卸时清 |
| `codeium.inferenceApiServerUrl` | 同上 |

## per-user 端口隔离

多账号同机时, 每用户自动分配唯一端口 (FNV-1a hash → 8889..8988). 无需配置, 自然隔离.

## 道义记

> 大道甚夷, 民甚好解. —《五十三章》
>
> 大成若缺, 其用不敝; 大盈若盅, 其用不窘. —《四十五章》
>
> 上士闻道, 堇而行之; 中士闻道, 若存若亡; 下士闻道, 大笑之. —《四十一章》

v9.1.3 大笑而行, 益其名而损其本. v9.2.0 反之, 损其名而存其本. 此谓**反者道之动**.
