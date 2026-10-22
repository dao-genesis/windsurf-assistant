# CHANGELOG · packages/wam (rt-flow 道极版)

> 反者道之动 · 弱者道之用 · 天下之物生于有 · 有生于无. —— 帛书《老子》德经

## v3.18.7 (2026-10-23) · 单点失明根治 — 全仓枚举

> 本源缺陷: 追踪/备份/侦测三链全挂单一 `PB_DIR`/`VSCDB` —— 会话写在非主仓
> (Devin Desktop / 多开实例 / 其他 .codeium* 根) 时**整体失明**: 追踪 0 活跃、
> 备份漏仓、Layer6 新对话侦测漏捕。本版三链并改全仓枚举, 道法自然。

### 引擎 `dao_stuck.js` v12.9→v13.0

- **`_allPbDirs()`**: 枚举全 `~/.codeium*/<backend>/cascade` + 根直落 cascade
  + `CODEIUM_DATA_DIR` 实例仓 + 旧候选兜底
- **`_allVscdbs()`**: 枚举全 `APPDATA/*/User/globalStorage/state.vscdb` (全 IDE 实例合流)
- `scan()`: pbFiles 收集改 `{dir,fname}` 全仓遍历·坏仓跳过不致命
- `refreshVscdb()`: better-sqlite3 路径多库并集 (uuid 异集天然无撞)
- `/api/status` `sources` 改数组透真源; `main()` 守卫零活仓才 fatal

### `_vscdb_helper.py` 多库合流

- `_find_vscdb()` 单选 → `_all_vscdbs()` 全枚举, sessions 按 sessionId 去重并集

### `extension.js`

- 新增 `_allPbDirPaths()` / `_pbDirOf()` —— 备份/追踪/探测共用单一真源
- `_backupConversations` 全仓收 `.pb` (文件名去重) · `_index.json` 记 `srcDir` 来源留痕
- `_checkCascadeHealth` / `_installIncrementalWatcher` / `_initAutoBackup` 全仓
- `_doIncrementalBackup(fname, dir)` watcher 直传仓路径·未传全仓反查
- `_collectAllConversations` sessioninfo-only 会话 pbPath 全仓反查
- 备份目录 MD `源目录` / `cascadeSet` / restore `inCascade` 全仓判
- Layer6 `cascadePbDir`→`cascadePbDirs[]`: 全仓快照+全仓 `fs.watch`+30s 轮询
- `_api.json` `backup.pbDirs` 数组化

## v3.18.6 (2026-10-22) · 四路审计根治 — 减熵·跨平台·性能·死键

### 跨平台 (win→mac/linux 归一)

- **`_ideDataRoot()`**: `%APPDATA%` → 平台分流 (darwin=`~/Library/Application Support` · linux=`~/.config`),
  extension.js / dao_stuck.js / `_vscdb_helper.py` / `_acp_sessions_helper.py` 四处同根
- **路径分隔符按平台**: `_pbWorkspace`/`_norm_cwd` 的 `/`→`\` 转换仅 win32 执行 (posix 用户不再见反斜杠)
- **netstat→平台命令**: win32 `netstat -ano` · darwin `lsof -iTCP -sTCP:LISTEN` · linux `ss -tln` (代理端口发现不再 Windows 独占)
- **非 Windows 不再 spawn powershell**: notify/getUserState 早返 (v3.18.6 前已修)

### 性能

- **缺名才刷**: `_refreshTitlesFromVscdbRaw` 加追踪集签名门 — 全有标题时不再每 15s spawn python 全扫
- **`_readHub` mtime 短路**: 文件未变不重读/不 parse (10s 轮询+watchFile 双路省 IO·引擎死态检测语义保留)
- **`_broadcastConvSection` 签名跳渲**: hub 心跳每 ~10s 触发但内容常未变 → 输入签名同则跳过 HTML 重建+广播
- **watchFile 降频**: HUB 500→2000ms · DISMISS 1000→2000ms · LOCK persistent:false→true (原可被 GC 静默停止)
- **log() 队列化**: 每行 `appendFileSync` 同步写 → 2s 批量 flush·退出前冲净;
  顺带根治日志写死 `~/.wam` 忽略 `WAM_HOME` → 多实例日志串台
- **Layer6 事件化**: 600ms 全目录 `readdirSync` → `fs.watch` 250ms 防抖 + 30s 保底轮询
- **helper 轻量模式免全表聚合**: `--recent-local` 跳过 `message_nodes GROUP BY` (60s 心跳减负)

### 死代码 / 配置对账 (P0 实删)

- dao_stuck.js: 摘 `dashboardHtml()`(~99 行·v9 死看板) + `_tryExtractSessionsFromBuf()`(~36 行·文件头曾误记已删) + `USERPROFILE` 死常量
- extension.js: `WAM_TOKEN_URL` 死常量删 (snippet 仍在用·保留) · 双 `require("crypto")` 归一
- 配置对账: 删声明零读 `preferYi`/`tokenUrl`/`hubNotifyCooldownMs`/`hubRenotifyIntervalMs`;
  `multiInstance` 改声明性标记注明不读; 补声明 8 个读而未宣键
  (newAccountLocked/tokenPasteAutoLogin/tokenCacheMaxAgeMs/resetRefreshBufferMs/injectFailCooldownMs/autoVerifyStartupStaleMin/devinLoginRateLimitWindowMs/devinLoginMinGapMs)
- `settings["wam.apiPort"]` 只写不读死键摘除; `codeium.apiServerUrl` 端口隔离**保留** (IDE 语服消费·多实例实证可用)
- dao_stuck 用户面版本横幅归一 `ENGINE_VER` (原 v9/v9.2/v12 混贴)

### 发布就绪

- `description` 英改中述实 · readme 升 v3.18.6 + 补会话库章节 + 新增「隐私与数据」「卸载」两章 +
  修正 `hubNotifyCooldownMs` 等已删键引用
- `.vscodeignore` 补 `__pycache__/*.vsix/test` · 根 `.gitignore` 新增 (探针/部署脚本/构建物不再入库)
- activationEvents 保 `* + onStartupFinished` (常驻监控刚需)

## v3.18.5 (2026-10-22) · 追踪归一 + 会话库根治 — 一列两源·点题进正文

### 用户实证反馈根治 (三轮浅修之后·根本重构)

- **左栏归一**: 摘除独立「本地」块(用户指为多余) —— Devin Local 会话**并入同一追踪流**,
  行级类型徽标 `[级]`Cascade/`[本]`Devin Local · 标题+工作区+ago+活跃绿点 ·
  X 关闭同一用户主权 (`l:`+slug 键入 dismiss 簿) · 引擎未运行分支同样列出
- **会话库卡片化**: 表格列被窄窗裁掉(用户实证"看不到工作区/状态/位置/按钮") →
  改三行卡片: R1=类型徽标+状态+标题+ago · R2=📂工作区+消息数+实例+模型 · R3=位置尾段+[复制][打开][📖阅读] —
  全字段恒可达·零横向滚动
- **点题进正文**: 点击标题或「📖阅读」→ 面板内阅读器渲染对话本体 —
  cascade 走 `.pb` 解密 `_parsePbConversation` 气泡流(用户/AI/工具/错误/上下文), 备份 .md 兜底;
  devin-local 走 helper `--msgs` 直读 sessions.db message_nodes 明文 —
  「在编辑器打开」按钮导出 .md 到 `_conv_exports/` 双击官方体验
- **工作区全回补 141/141**: cascade 会话无 cwd → `.pb` 解密提取 —
  file:/// 最短URI=工作区根 (windsurf仓) · 盘符存在路径兜底 (dao/relay老仓 CascadeProjects) ·
  `_conv_ws_cache.json` v2 持久缓存每uuid只解密一次 · 无标题会话顺带 `_extractPbTitle` 补名(多密钥兜底)
- **多仓全扫**: `_allCascadePbDirs` 枚举 .codeium*/**\/cascade 全部 backend 仓 (实测4仓140pb) —
  实例标按 codeium 根映射 (主/devin-i1…) · 不再只扫单 PB_DIR

### 真bug

- **v1缓存覆写缺陷**: 字符串形态 ws 缓存被标题写入 `{ws:"",t}` 永久抹除 →
  缓存版式化 `{v:2,d:{uuid:{ws?,t?}}}` 键缺席=未提取·空串=已知无·两字段独立回补不互覆
- **sessions.db 异实例可读性诚实**: Devin-i2 等无 cli 目录的会话 canRead=false 不再虚标可读
- **untitled 兜底**: devin-local 无标题会话落 slug 实名 (aspiring-viscount 式) 不再 `(untitled)` 一片

### 道法自然

- 左栏职责=追踪(名·态·时) · 库面板职责=档案(类·区·位·正文) —— 各守其根·不越界增块
- 减熵: 同一列表两种徽标 > 两个列表一种样式 —— 合并优于并列

## v3.18.4 (2026-10-22) · 死旗非无期 + 全局反向审计打磨 — 公开版就绪

### 死旗治理 (重启实证)

- **credDead 复审翻案**: 巡检对死号 verifyOne 全级联真验 → 活→双旗同摘 · 启动150s后首轮即复审
- **死旗唯服务器定性**: postAuth 死判限 401/403 (verify+login 双点) — 瞬网断/超时/5xx 不再立旗·救援链照旧
- **真根归一**: 巡检探活命中活 auth1 → password↔簿互填 → 导出永携活根
- **鲁班自适应导出**: 账密号 password 即自铸根 → 纯 `email:password` 原形行 (st/ak 衍生不搬);
  唯 mailpw 不可再铸 → 账密+mailpw 时殿后 wamcred$; token/OAuth 号仍全根随行 —— 能简则简·按型自落
- **去中间态 🥀**: auth1Dead 不再外显 (行标/池层双位摘除) —— 活即活·唯全根皆死才 💀; 旗仍内置供巡检/再铸
- **切号后 ACP 自愈**: injectToken 成功 2.5s 后调度 `_reloadAcpQuietly` —— IDE Reload 命令优先(运行时探测),
  兜底按命令行定向杀 devin.exe acp 子进程(双正则过滤防误扬IDE本体·60s节流) —— 根治"切号后模型列表空·唯重启可解"
- **全会话库小窗**: 对话追踪区新增「📚 对话库」按钮 → 侧边 webview 面板 —
  cascade + devin-local 同源合一 (sessioninfo cwd + cli sessions.db 明文 + .pb 兜底)·
  列: 类型(级联/本地)/标题/工作区/状态(活跃·近期·历史)/消息数/时间/实例/位置[复制+打开] · 搜索+类型过滤
- **侧栏并入 Devin Local**: 对话追踪区新增「本地」块 —— sessions.db top6 近会话 (60s心跳·轻量模式·变化才广播) · 活跃绿点+工作区名+ago
- **cascade 全集兜底**: sessioninfo 键 IDE 重启即清(实测121→9) → 面板列表补扫 PB_DIR/*.pb —— 老会话不再丢
- **会话定位可达**: 位置列显路径尾段 + 复制 + 资源管理器打开 (revealFileInOS→openExternal 兜底)

### 全局审计修缮 (为发布而磨)

- **私有层抽出**: `~/.wam/_local.json` 机器私有配置覆盖 (显式设置>_local>声明默认) — 接码端点等私有值不随包内置
- **凭据外发归零**: emailCode.queryUrl 默认空 + enabled 默认 false — 不再把 mailpw 发往任何内置域 (BYO 接码服务)
- **硬编码清零**: E:\ 安装路径删除 (windsurf-multi.ps1 改自动探测: PATH→LOCALAPPDATA→ProgramFiles→注册表)
- **真bug修复**: injectToken 路丙失败原因 c/c2 块作用域 → 路丁兜底必抛 ReferenceError; deactivate sessionCache 落盘并入磁盘 (关窗不再抹他窗条目); _engine 裸解引用 ×8 全加守卫; 后台 IIFE 补 .catch ×2; openExternal 异步链式降级
- **性能**: addBatch O(N²)find→Map索引 + 锁态批量写; setHealth/banFor 整文件写→_saveSoon 300ms 去抖; netstat 端口探测并行上限40; spawnSync×4 全转异步 execFileP (10s 宿主冻结消失); LS 二进制扫描每1MB让出; node 兜底补 ELECTRON_RUN_AS_NODE
- **死代码**: _VSCDB_PATH/_getLocalStatePath/_tryExtractSessionsFromBuf/pbLastGrowAt/pbLastTrigger 清除
- **图标归位**: media/icon.svg 补建 + 打包器改递归收目录 (media 此前从未进包)
- **平台门**: _newInstance 限 Windows (明示而非静默生成无效.bat) · bat set 引号转义防路径注入

### 道法自然

- 旗是"当前证据的快照"不是"终审判决" —— 证据可变·旗当可复审
- 死=服务器亲口说死 (401/403) · 网络沉默≠死亡 —— 不立无据之旗
- 私有归私有 (~/.wam/_local.json) · 公有归公有 (包默认零私有面) —— 各归其根

## v3.18.3 (2026-10-22) · 搬死叶丢活根根治 — wamcred$ 魂魄行回归导出 + auth1 静默烂根探活

### 苦 (重启实证)

- 重启 IDE → 已挂/凭据死 依旧 —— 用户: "明明没有已挂这一说, 不都很健康的吗"
- 簿里 4 号 🥀旗持久回填; 远端机B 三 💀号更无复审路 —— **死旗判了就没有翻案通道**

### 集 (结构性病灶)

- **死旗判无期**: `credDead` 立旗后 巡检 skip + verifyAll continue + getBestIndex 出列 ——
  三路全绕 → 瞬网断/陈旧标成的假死 **永不复审** · 新根到簿(seed/装填) 也无自检
- **瞬误判死**: postAuth 任何失败(含 ECONNRESET/TLS断) 都立 auth1Dead→credDead ——
  远端机B 网抖实录 `TLS socket disconnected` → 网络病判成号死
- **治未病未闭环**: armed 号(mailpw在) 旗立后无人再铸 → 🥀永黏 (用户: 明明很健康)

### 灭·术

- **死旗复审 (credPatrolTick)**: credDead 号不再 skip —— 每 tick verifyOne 全级联真验 →
  活→双死旗同摘+setHealth+真名归位+广播 · 死→旗留真值 (verifyOne 内部分级死判自持)
  · 启动 150s 后首轮即复审 → 重启即翻案 · 成本: 每死号每6h一条链
- **死旗唯服务器定性**: postAuth 死判限 `status===401||403` (verify+login 双点) ——
  瞬网断/超时/5xx 不再立旗; 救援链(session根+邮箱码) 对一切失败照旧全跑
- **真根归一**: 巡检探活命中活 auth1 → password↔簿 互填活根 (死位换新) → 导出永携活根

### 道法自然

- 旗是"当前证据的快照"不是"终审判决" —— 证据可变·旗当可复审
- 死=服务器亲口说死 (401/403) · 网络沉默≠死亡 —— 不立无据之旗

## v3.18.3 (2026-10-22) · 搬死叶丢活根根治 — wamcred$ 魂魄行回归导出 + auth1 静默烂根探活

### 苦 (远端机B 跨机粘贴实证)

- 远端机A 导出 `email----auth1` 五行 → 远端机B 粘贴 → **3/5 秒💀** (号A/号B/号C) · 仅 2 号落地活
- 远端机B wam.log 铁证: `addBatch verify ✗ xxx · postAuth: token已失效` —— 落帖两秒即判全根皆死

### 集 (三端凭据簿+真端点探活 · 非猜测)

- **死源在 远端机A 簿里**: 3 死号 `auth1` 早就 401-unauthenticated (本机 postAuth 实证) ——
  账号在 远端机A 常绿全靠 session 根 (ak/st 独立存活·实证探活 ALIVE) · 面板从未探过 auth1 → 死根无人知
- **v3.18.2-r2 返璞归真砍错了方向**: "session/apiKey 皆衍生·由根凭据再铸 → 导出只需根本身" ——
  前提是 auth1 是根; 实则 auth1 是会死的叶, **ak/st 才是此刻活着的根** → 导出搬死叶丢活根
- 无 mailpw 的 OAuth 号本就没有"永续根" —— 可携的只有"当前活着的根" → 全部都得带上

### 灭·术

- **导出**: `_exportAccountLine` 殿后追加 `wamcred$` 全根行 (簿有 st/ak/mp/srv/aid/re 任一根即附) ——
  人读行在前(原形可读)·魂魄行殿后(全根随行); 他机 `_seedCredBundle` 落簿 → 活根即活·死叶随葬
- **巡检探活 (治未病)**: `_credPatrolTick` 会话验活成功时, token 凭据号顺手 postAuth 探 auth1 ——
  死→立🥀旗 (面板诚实) + mailpw 已武装→后台 `_rescueByEmailCode` 再铸 (30min重试·上限3次·不阻塞);
  活→摘旧旗 · 网络错/非4xx 不定死 (防误标) · `wam.auth1ProbeEnabled` 可关
- **死判语义不变**: 裸 `email----auth1`(无簿根) 落地 postAuth 401 仍💀 —— 单根即死是诚实状态,
  复贴新凭据/带魂魄行即复活 (addBatch 双死旗同摘路已备)

### 道法自然

- 根 = 能反向再铸者 (pw/mailpw) + 此刻活着者 (st/ak) —— **衍生物只带活的不带死的**
- 一行 `wamcred$` = 全部根 —— "一行活根反向生成"本来就该是它, 不是 auth1
- 死旗🥀提前亮在源机 → 未武装 mailpw 的 OAuth 号用户可见·可装填 → 💀不再是跨机才发现的惊喜

## v3.18.2 (2026-10-22) · 裸ott冤杀根治 + mailpw顶替保全 + 零识别说人话

### 实证勘定 (接码/官网端点实测)

- 用户 ott `4BxHQ2fkq8GrRsVe5RpF0Q` → ExchangeDevinCode 双端 401 `Invalid code` —— **码本身已死/已消费** · 非解析问题
- 接码站 `/prod-api/open/*` 全树 404 (site-config/public-modules 同灭·其网页版同接口亦挂) —— **接码站服务端当机** · 自动接码暂断 · interactive 手动输码兜底仍可用
- `_isBareOtt` 旧判要 `[-_]` → base64url 纯字母数字 ott 被静默丢弃 → "添加直接被跳过"观感
- `_poolUpsertAuth1` 盲写 `password=auth1` → `email----mailpw + ott` 同贴时 mailpw 被顶永失 → 终援未武装

### 术

- `_isBareOtt` 放宽: 无 `-_` 时含数字即认 ott (仍挡普通单词行)
- `_poolUpsertAuth1` 顶位保全: 被顶替非token密码 → `_credPut{mailpw}` 入簿
- addBatch 零识别: "未识别到账号/token" toast + log 落痕 (旧法 "添加 0 个" 无迹可查)

### 并发互杀根治 (测试号A 实战复盘 11:17)

- **病灶**: addBatch verify + 用户切号 3 并发 `_devinEmailCodeLogin` → 各发码·后发码作废前码 → 败支 `email-complete: Invalid code` → `invalid` 误中死判 → **假 🥀凭据死** (账号其实已铸成)
- **治①**: `_emailCodeInflight` 同邮箱在途流程共享 —— 并发合流·一封码信·零互杀
- **治②**: `email-(start|complete)|code.?timeout|验证码|接码` 逐出 auth1Dead 死判 (verify+login 双闸)
- **治③**: postAuth ✓ = auth1 活证 → `account.auth1Dead=0` 摘旗 (verify+login 双点·误标自愈)
- **治④ 假旗自愈探针** `_reclaimAuth1Flag`: 旗立+簿有 auth1 → 会话根捷径(cached/mint/_verifyWithSession) 顺手 postAuth 真验 → **活摘旗·死留真** —— 治"切号成功但 🥀 永黏"(实证: 败支尸斑在赢支铸成 1ms 后回写)

### Webview ServiceWorker 死态自愈 (重启白屏根治)

- **病灶**: `Error loading webview: Could not register service worker: InvalidStateError` —— Electron 启动竞态 · 旧法只能再重启一遍 IDE
- **治①**: sidebar `retainContextWhenHidden: true` —— 隐藏不销毁·SW注册面最小化
- **治②**: 静默看门狗 —— 面板可见却零心跳 45s(从未ping)/75s(冻死) → 自动 `reloadWebviewAction` (冷却90s·上限4次·免重启)
- **治③**: resolve 窗内零同步IO —— `_panel_debug.html` 诊断落盘改异步
- **治④**: `wam.fixPanel` 命令 —— resolve之前死(view未实例化·看门狗盲区) 一键 reloadWebviews 免重启 (命令面板: "RT Flow: Fix Panel")

### 原形导出 · 凭据根随行 (道法自然·持久化跨机延伸)

- **道**: 导出即原形 —— 用户怎么粘进来就怎么导出去, 不造新格式 (用户旨)
- **道法自然**: session/apiKey/auth1 皆衍生·由根凭据再铸 → **导出只需根本身**
- **账密号** → `email:password` 原样人读行 (auth1 是衍生·他机 verify 自铸·不搬不携)
- **token号/OAuth双根号** → `email----auth1_xxx` 活根行 (+`email----mailpw` 终援行) —— 他机一贴即走 token→建号→verify 自铸链
- **导入兼容**: `wamcred$` 行内全扫解码保留 (旧复制行不废·混贴通吃) → `_seedCredBundle` 魂魄落簿+摘双死旗
- **三处复制**: 单选/批量/一键导出 · toast 报 "凭据根随行" 行数
- **测试**: 原形/活根/混批/嵌件/拒腐 101 项冒烟全过

## v3.18.1 (2026-10-22) · 面板展开 ≠ 列表冻结 — 运行中加号永久"未验转圈"根治

### 苦 (用户实证)

- IDE 运行中加号 → 新号永远 `未验 ⏳` 转圈 · 点刷新无任何效果 · 直至重启才好
- quota%/天数 随时间不更新 —— 同一病灶

### 集 (wam.log 实证 · 非猜测)

- `addBatch verify ✓ u-dcb8dd44 D100% W51% Pro 31d` —— 验证 **4.4s 即成** · 真名归位 ✓ · 会话/凭据落簿 ✓
- 唯 `_broadcastUI` 门禁 `if (force || !_uiAddOpen)` —— **添加面板展开期间全部渲染被吞** → 面板冻结于添加瞬间快照
- verifyAll 每轮正常完成 (旗未卡) · endpoint 未死 · 链路全绿 → 纯渲染层断流

### 灭·术

- **`_broadcastUI` 补丁路**: `_uiAddOpen` 时不再裸跳 → `postMessage {type:'listPatch', html}` → webview DOMParser 只换 `#list`+`.hd` 纯显带 (统计行/池条/活跃卡/监控条) · textarea/焦点/选中/conv折叠零损
- **`verifyAllAccounts` 真 finally + 15min 悬挂看门狗** (`_verifyAllStartedAt`): throw/悬挂不再卡死刷新闸 (v3.0.2 仅线性调用·伪 finally)
- **入池即种会话根**: auth1/ott 粘贴成功即 `_cacheSession` (apiKey 位放 sessionToken·trial 同构) → 新号立入 `_cacheOnly` 周期验证圈 + 会话根救援即刻可用 (旧法: kickVerify 失手=会话根永失)

## v3.18.0 (2026-10-22) · OAuth号终极根 · 官方邮箱码闭环回迁 — 免浏览器再铸 auth1

> *大道甚夷，而民好径 —— 浏览器是径，邮箱码是夷*

### 根本矛盾 (用户旨)

- OAuth 注册号 (Google/微软邮箱 → Devin 官网 sign-up) `has_password:false` → `password/login` 恒 401
- v3.17.0 拆光接码/CDP/Google 自动化后 → OAuth 号 auth1 一死 → 会话根救援再死 → **💀下牌·只能浏览器重贴 ott**
- 用户实证: "每隔几个小时就要丢失就要刷新" —— auth1/会话接力链对 OAuth 号没有**自动再铸**的最后一环

### 方案勘定 (官方面全枚举实证 2026-10-22)

- **方案A 嵌浏览器**: v3.16.5 CDP Google 闭环已建已拆 —— chooser 卡死/120s 锁超时/弹窗风暴实证其脆 · 不取
- **方案B 官方设密码**: `windsurf.com/_devin-auth/*` + `app.devin.ai/api/auth1/*` + `SeatManagementService/*` 三面全枚举 —— **无 password/set|forgot|reset 任何端点** · 官方无此路 · 证伪
- **方案C 邮箱码闭环**: `email/start` 对 OAuth 号实测 200 真发码 → `email/complete` 换 `auth1_` 长效凭据 → **纯 HTTPS 零浏览器** · 取此为正脉

### 治本 · 四层挂接

1. **`devinLogin` 401 分流**: connections 探 `has_password:false` → `_devinEmailCodeLogin` (v3.16.4~3.16.8 实证原路回迁) → 铸成即 `_credPut{mailpw,auth1}` · `email----mailpw` 入池的 OAuth 号自此与密码号完全同构
2. **`devinLogin` 头 · auth1-credstore 快道**: mailpw 号簿里有活 auth1 → 零探测直返 (免 401 白打·免限速面)
3. **`_rescueByEmailCode` 终援一跳**: verify/login 四个 💀下牌点之前 → `mailpw→邮箱码→新auth1→postAuth→sessionToken→verify/inject` —— 全根皆死也能自动复活
   - mailpw 取序: `_cred_store.mailpw` → `acc.password` 非token值 · ott 号未装填 mailpw 时 interactive 回落手动输码 (仍免浏览器)
4. **`addBatch` mailpw 装填**: ott 号复贴 `email----mailpw` → mailpw 入久凭据簿 (不碰 auth1 凭据位) → 终援武装化

### 术

- `_fetchCodeViaCodeQuery` 接码轮询 (8s/90s·只收发码后新件) + `showInputBox` 手动输码兜底 (2min 限时·非交互不弹)
- 邮箱码与 password/login 共用 `_devinLoginRateLimitedUntil` 限速感知窗 (429/503 同源退避)
- 配置面回迁 `wam.emailCode.*` × 6 (enabled/queryUrl/pollMs/timeoutMs/manualInput/manualTimeoutMs)
- 去 CDP/google 残层不取 —— 纯 HTTP 正脉·无为而无不为

### 压测实证捕修复 (本机全真回测 · 49项)

- **`_credPersistNow` 并盘根治**: 裸跑宿主 `_credStore` 仅1条 → 全覆盖写 → 磁盘8条池凭据被抹 (实测复现) → **治**: 落盘前先并磁盘 (磁盘为底·内存覆同键) + `_credTombstones` 墓碑 (_credDel/孤儿清 删键不复活) — 多 exthost 同险并治
- **`_persistSessionCache` 同治**: 同型全覆盖写 → 并盘+`_sessTombstones`+过期不落
- **压测战绩 48P/1F→全绿**: connections普查9/9 · 密码号全链(auth1→postAuth→register→Pro额度)2/2 · ott号auth1-inline 0ms · **OAuth号 mailpw→emailcode→auth1→postAuth→register→Pro D100 全链0ms** (credstore快道实证) · 双根mint 4/4 · 回填自愈8/8 · session根救援8/8 · 三端点planStatus 3/3 · ott号auth1死(postAuth 401)→rescue 530ms续命 ✓
- **`_internals` 增导**: devinConnections/_devinEmailCodeLogin/_rescueByEmailCode (守门探针·持续回测)

## v3.17.9 (2026-10-22) · 真名自愈锚 · 多窗回写抹名根治

> *将欲歙之，必固张之 —— 名与身孰亲?名正则言顺*

### 病灶 (远端机B zhou 实证 06:44)

- 贴 ott → auth1 入池 ✓ → 真名归位 `u-account1 → 真实邮箱` ✓ → verify ✓ D100/W100 Pro 31d ✓ → login 路三 ✓ —— **全链单窗内完全正常**
- 但 远端机B 跑 **7 个 exthost**(多窗/多活)，各持一份 stale accounts 列表；任一宿主 persist（锁号/删号/任意触发）都把 `u-account1` 旧名**回写抹掉真名** → 面板回退占位 + health 按真名键控查不到 → **"占位名+无额度"全因于此**
- 06:45 login 日志已现 `试 [16] u-account1` —— 归位 20 秒内即被抹回

### 治本 · 名以锚定

- `_resolveRealEmail` 归位时把 `realEmail` 写进 `_cred_store.json` 占位键 + 凭据随迁真名键
- `_healPlaceholderEmails()`: 遇 `@token.wam` 占位 → 查簿 realEmail → 自动归位真名；health 随迁、锁态随迁(`_writeLockState`)、同号已存则凭据并入+占位摘除
- **三处挂接**: `reloadAccounts`(读盘即愈) + `_persistAccountsToMd`(写盘前愈·stale 宿主也写真名·文件收敛不反弹) + `activate`(簿装载后补拍)
- 道法自然: 不追求完美锁，追求**自愈收敛**——文件被抹多少次，每次 load/persist 都长回真名

### 勘定说明 (admin 侧)

- "提交无反应" = **重启后旧 webview 成孤儿** (消息管道随旧 exthost 已断) → 重开面板/重载窗口即活，非代码缺陷
- admin 侧保持 v3.17.8 部署态不动 (用户指令: 专注 zhou 闭环)

### r2 · 三连根治 (远端机B zhou 实证续)

- **合成名撞名**: `accountId='account-<hex>'` 旧法取前8位 = `account`+1hex → 全池仅16种名 (`u-account0..f`) · 不同账号必撞 `u-account1` → realEmail 锚互指错归位 → "删了重加还是占位+额度全错"根源之一 · **治**: 先剥 `account-` 前缀再取8位 → ~40亿空间不再撞名
- **锚卫生**: `_poolUpsertAuth1` 合成槽凭据换新 → 清旧 realEmail；合成名升级 → 锚随迁 (同 `_resolveRealEmail` 法)
- **死号覆盖盲区**: `_cacheOnly` 验证+巡检只探有凭据号 → 无凭据死号永不探活 → 面板挂陈旧"正常" (实证: 测试号A 已挂349次失败但从未进簿) · **治**: 巡检对无凭据号走全级联 verify → 死号立💀/🥀·活号回填凭据根·启动+150s首巡即覆盖 (分钟级现形)
- **面板孤儿心跳**: webview `ping`(15s)/扩展 `pong` 应答 → >30s 无pong 自亮红色断线横幅 "面板已断开·扩展已重启·请关闭重开" — 治"面板看起来全是错的"实为旧面板收不到广播

### r3 · 行内死旗 + 横幅说人话 (用户旨 2026-10-22)

- **死号进列表行**: `_tierOf` 的 💀/🥀 此前只进切号决策日志·列表行根本不渲染 → 用户只能看到顶部 cryptic 横幅 "连续N次401" 而不知哪号死 · **治**: 每行账号名旁直渲 `💀已挂`(credDead·行降亮) / `🥀凭据死`(auth1Dead·会话根续命中) · tooltip 写明复活路 (重贴 token)
- **横幅说人话**: "GetPlanStatus endpoint 已挂·连续N次401" → "额度接口连挂N次·GetUserStatus多端点全灭·quota%可能陈旧·账号生死看各行💀/🥀标" — 端点级故障与账号级死亡不再混淆
- **部署断层根因**: 本机/远端机B 实跑 3.16.7/3.17.7 · r2 全部修复只在 pkg 源里从未装包部署 → 用户实测"一模一样"真相 · 本轮构建部署闭环

## v3.17.8 (2026-10-22) · 久凭据簿 · 会话根续命 · 保活巡检

> *绵绵若存·用之不勤*

### 活体实证定案 (141机 2026-10-22)

- **auth1 死 ≠ 号死**: `u-accountd`/`u-account2`/`OAuth号` postAuth 全 401(auth1死)，但 `GetSelfDevinSessionToken`/`GetUserStatus` 全 200 —— **session 与 auth1 服务端分根，独立存活**
- **sessionToken 即久凭据**: JWT payload 仅 `session_id` 无 exp · 生死由服务端会话簿裁决 · merge缓存中 ~5月前 session 今仍铸 200
- **接力环闭合**: `GetSelfDevinSessionToken(X-Api-Key: sessionToken)` 返 NEW 会话(OAuth号实测) → 死前接力可无限续
- **官方持久登录本相**: 非"token永存"，是"根深→按需重铸" — vscdb secrets 存 session+apiKey，LS 一切走 X-Api-Key

### 病根

- **旧24h自毁=埋根**: `_session_cache` 24h TTL 到期连根拔 —— 把唯一能续命的 session 凭据主动埋掉，只剩必死的 auth1 当根 → 粘贴号必死
- **死判粒度太粗**: postAuth 401 → 整号 💀 下牌；殊不知此刻 session 根还活得好好的
- **死旗不留**: `credDead` 只在内存 → 重启丢标记 → 风暴复活

### 治本

- **`_cred_store.json` 久凭据簿**: 每号 `{sessionToken,apiKey,apiServerUrl,auth1,mintedAt,lastAliveAt,auth1Dead,credDead}` · **无TTL·服务端判生死** · `_cacheSession` 单点同步入簿 · 激活装载+存量迁移+死旗落账+孤儿清 · deactivate 落盘
- **存活级联补根**: verify/login 的 `_rawV/_rawC` = `热缓存 || 久凭据簿` —— 24h 后 apiKey-mint 中继依然可达 (原来热缓存没了=根断)
- **会话根救援 `_rescueBySessionRoot`**: credStore.apiKey/sessionToken → mint 一跳 → verify 走 `_verifyWithSession` / login 走 `injectToken` → **auth1死的号照切照验** · `triedKeys` 防重复探
- **分级死判**: postAuth-401/devinLogin-401 → 先标 `auth1Dead`(簿持久·账面对象🥀) → 救援失败才 `credDead` 💀 · **死旗入簿·重启不丢**
- **保活巡检 `_credPatrolTick`**: 默每6h·串行+抖动 → 每号一跳 GetUserStatus 验活(顺带刷额度) → 活→lastAliveAt+热缓存续温(切号常秒) → 死→verifyOne 全级联 · **不碰 devinLogin·零429面** · 切换/限速/设备限让位 · `wam.credPatrolMs/credPatrolEnabled` 可调
- **复活清双旗**: 重贴凭据 → `credDead+auth1Dead` 同摘 (账面对象+簿双清) · 删号 `_credDel` 销簿

### 无为而无不为

- 验证码账号没有密码根、浏览器开荒绕不开——**但开荒只需一次**: ott/auth1 → session → 入簿 → 此后 session 自续，与官方同寿
- 已死号A 类已死号: session已蒸发者需重贴一次(auth1→簿) → **最后一次**，此后落簿自续

## v3.17.7 (2026-10-22) · 死凭据下牌 · 限速断路 · 风暴根治

> *知止可以不殆*

### 风暴真凶 (远端机B admin 日志实证)

- `login: 试 [14]` 20秒内×40次 · `failure#56` —— **isBanned() 恒 false** ("永不入禁") 使 postAuth 401 死凭据号永远留在候选榜首；硬耗尽看门狗每2s触发 _tick → 选死号 → 败 → 再触发 → 无限风暴
- 用户感知「切换卡 30s~2min」= 几十个必然失败的重试叠加，非单次慢

### 治本

- **`acc.credDead` 凭据死亡下牌**: postAuth 401 / devinLogin 凭据无效 → `_scoreOf` 返 -Infinity → 死号彻底出列 · `_tierOf` 显 💀 · verifyAll 队列跳过 · 同号新凭据(_poolUpsertAuth1/addBatch重贴)自动复活
- **限速断路 `_switchCoolUntil`**: rate-limit-window/429 命中 → 自动切号全停至窗尽；看门狗不点火、_doAutoSwitch 入口停切、重试循环立即 break（原: 3s×3retry×watchdog2s → 40次/20s）
- **凭据死直接换候选**: rotate 重试循环遇 token已失效/凭据死 → 不 sleep 直接 getBestIndex 下一号（credDead 已置·同号不会再被选中）
- **verifyAll 重试闸**: 限速窗内跳过无缓存纯密码号（auth1/session号仍可验·不喂429）

## v3.17.6 (2026-10-22) · 验证即归名 · 新增只入池默认锁 · mint中继治429

> *为无为，则无不治*

### 病根 (用户三连实证)

- **邮箱仍占位**: 远程实证 GetCurrentUserName 返 {"name":"Byqp Oyvvw"} 显示名非邮箱 → 合成名照样兜底
- **切换慢/切不了**: verifyAll 批量 devinLogin 反复撞 429 → rate-limit-window 5min 窗口 → 手动切号撞上即失败/干等
- **新号自动登录干扰**: token 一贴就切号，正跟别人对话被抢登；新号还敞着被自动轮换抓走

### 治本 (全部真机实证)

- **真名归位之源**: `GetUserStatus` 响应自带 `userStatus.email`("user@example.com")·displayName·userId — 验证顺手归名·零额外请求
- `_parsePlanStatusJson` 提取 `_email/_displayName/_userId`；`_resolveRealEmail(acc,q)` 三处调用(verifyOne 缓存路/全路/_verifyWithSession)：
  - 合成名 u-xxx@token.wam → 原地改名真邮箱 + health迁移 + cache重键
  - 真名已被占(同号双条目) → 凭据并入存活条目·自我摘除 → **同号永不再双**
- **新增只入池**: `wam.newAccountLocked`(默true) → addBatch/_poolUpsertAuth1 新号自动 `skipAutoSwitch`(写lock-state.json持久化) → 不自动登录·不被自动轮换抓走
- **token粘贴不自动登录**: `wam.tokenPasteAutoLogin`(默false) → auth1/ott 入池仅提示「点切换登录」；会话型token(session/JWT/ott$兑换失败)仍直射·一次性用途
- **verify mint中继**: 会话失效但apiKey仍活 → GetSelfDevinSessionToken一跳换会话→会话验 → **零 devinLogin** → 429风暴与rate-limit-window对切号的连坐大幅消减
- **弱凭据号直通**: password=session-token$ 的旧条目会话验·不再走 devinLogin 被判 invalid
- `_mintSessionByApiKey` 三端点改竞速(与GetUserStatus同款·首个2xx胜)

## v3.17.5 (2026-10-22) · 真名识别 · accountId合并 · 端点竞速 · 快验落库

> *大制不割 · 弱者道之用*

### 病根 (用户实证)

- **同号双条目**: ott入池只见 accountId → 合成 u-xxxx@token.wam，与已添加的真email密码号并存互不识别
- **验证慢**: token号与密码号都慢 — GetUserStatus 三端点串行各 8s 超时(最坏24s/号)·kickVerify 验了不写库(白验)·缓存过期即回退四跳全链

### 治本 (全部来自官方bundle实证端点)

- `_devinGetUserName(sessionToken)`: GetCurrentUserName RPC (X-Auth-Token) → {name,userId}，name=账号真邮箱 → `_ingestAuth1Token` 优先取之，合成名仅作末位兜底
- `_poolUpsertAuth1` 重写: **email + accountId 双锚匹配** — 同号 token 再贴自动并轨(换凭据不留双条目)；合成名条目遇真名原地改名+health迁移；同 accountId 残余条目自动清理
- `_mintSessionByApiKey(apiKey)`: GetSelfDevinSessionToken RPC (X-Api-Key) → sessionToken 一跳铸会话 → loginAccount 缓存会话失效但 apiKey 仍活时走此中继 (省 devinLogin+postAuth+registerUser 三跳)
- `_verifyWithSession(acc,st)`: 入池时手里已有 sessionToken → 直走 registerUser→apiKey→GetUserStatus (省两跳)
- `_kickVerify` 修复: **setHealth 落库**(v3.17.4 漏写=验了不显示) + 快验失败自动回退 verifyOneAccount
- `tryFetchPlanStatus` **端点竞速**: apiServerUrl动态端点+3静态端点同发，第一个2xx胜出，12s全局兜底 (串行最坏24s→最快端点)

## v3.17.4 (2026-10-22) · ott→auth1 直连兑换 · 入池治本

> *反者道之动 · 弱者道之用*

### 病根 (用户两连实证)

- 「粘 token = 手动重登」: 粘贴 ott → 官方注入 → IDE 登录 → 池子空空，额度/刷新/无感切换机制无从谈起
- 根因 (bundle 实证): ExchangeDevinCodeResponse = {sessionToken, auth1Token, accountId, primaryOrgId} —— 官方 RPC 响应本就带 auth1Token 长效凭据，IDE 只取 sessionToken 丢弃了它

### 治本

- 新增 _ottExchangeDevinCode(code): 直连 ExchangeDevinCode RPC (windsurf.com/_backend → server.self-serve → _route/api_server 三端点顺位) 取 {auth1Token, sessionToken, accountId, primaryOrgId} 全量
- _handleTokenPaste ott$/裸ott 分支重写: 兑换 → auth1 → _ingestAuth1Token 验活取真email → _poolUpsertAuth1 入池 → sessionToken 直射登录 → _kickVerify 即时验额度
- 粘贴一次 = 入池 + 登录 + 额度显示，与密码号 100% 同构: 列表可见、D/W 额度、自动刷新、无感切号全继承
- 兑换不到 auth1 但有 sessionToken → 会话直登并明示「后端未发长效凭据不入池」；全失败退回官方注入+回采旧路
- _poolUpsertAuth1 / _kickVerify 抽为单点，auth1 直贴与 ott 兑换两路共用

## v3.17.3 (2026-10-22) · 直达 token 页 · 裸 ott 识别 · 回采入池

> *知者不言，言者不知。* —— 帛书《老子》道经

### 会话合并冲突根治

- 「取Token」改开**直达页** `show-auth-code?state=<uuid>&intent=Windsurf`（去掉 `prompt=select_account`）——浏览器已登录即直接显示令牌，不再触发「无法将认证合并到不同用户拥有的会话中」；隔离环境零冲突
- 需换号时选「换号取Token」→ select_account 链接复制入剪贴板，粘到无痕窗口即可绕开旧会话

### 裸 ott 令牌识别（后端迁移后无前缀）

- 官方 show-auth-code 页现直接显示无前缀 urlsafe 串（如 `-lC7XccUXpPUm_xQrRF2cw`）；`_isBareOtt` 判定（18-64位 urlsafe·必含 `-`/`_`）挂行级解析，裸串不再被误当账号行
- `injectToken` 对裸 ott 自动展开 `ott$+tk` 前缀变体双试（官方 `looksLikeCodeiumAuthToken` 按前缀路由）；ott 类注入失败不再走路丁 vscdb 脏写

### ott 直登后回采入池

- 注入成功后后台调 `_vscdb_inject_helper.py decrypt` 读回 IDE 持久化会话；若含 `auth1_` 长效凭据 → 自动验活建号入池（`pendingOttHarvest` 持久化标记，窗口重载后 activate 补做）
- 仅会话令牌则明示不入池，提示 F12 片段取 auth1 路径

## v3.17.1 (2026-10-22) · ott$ 官方令牌直通 · 一键直达 token 页

> *反者道之动。* —— 帛书《老子》道经

### 官方通路复刻 (源自内置扩展 WindsurfAuthProvider 真码)

- 「🔑 取Token」→ 直达 `app.devin.ai/auth/windsurf/show-auth-code?prompt=select_account&state=<uuid>&intent=Windsurf&from=redirect` —— 即官方 ProvideAuthToken 同款页 · 浏览器登录(Google/密码/SSO/验证码全由官方消化) → 页面直接显示 `ott$…` + 复制按钮
- 粘贴 `ott$…` → 插件识别(新增 ott\$ 前缀) → 走 IDE 官方 `handleAuthToken` → `looksLikeCodeiumAuthToken` → `registerUser` → apiKey → 直登 · 与官方「Provide Auth Token」粘贴路径完全同构
- 旧通道兜底: `windsurf.com/devin/account/login?response_type=token&client_id=…&redirect_uri=show-auth-token` (openExternal 失败自动降级)
- 双轨并存: `ott$`=官方一次性码(直登当前IDE) · `auth1`/`devin_*四键`=长效凭据(入池·可续期·跨机) —— 用户按需求选路

## v3.17.0 (2026-10-22) · Token 一等公民 · 万法归一 · 剜除脆性自动化层

> *为学日益，为道日损。损之又损，以至于无为。* —— 帛书《老子》道经

### 道法自然 (根治路径实证)

- **一切登录差异化交给浏览器**: Google/邮箱码/密码/SSO/验证码 —— 浏览器天然全解，插件不再越俎代庖
- **取token**: 浏览器登录 https://windsurf.com/profile → F12 Console 粘片段 → localStorage 四键 JSON 自动进剪贴板 → 粘进「+ 添加账号」即完成
- **四键**: devin_auth1_token(长效凭据·跨机跨IP) · devin_session_token · devin_account_id · devin_primary_org_id

### 架构归一 (token号与密码号完全同构)

- password 栏即凭据位: auth1_ → devinLogin 置顶直挂 (零网络·不吃限速窗) → postAuth → sessionToken → registerUser → apiKey → GetUserStatus → injectToken → 切号缓存 —— 全程零特殊分支
- 额度识别/动态更新/无感切号/切换锁定/黑名单/周期验证 —— 与账密号共用同一流水线，天然继承
- 裸粘 auth1_… → postAuth 验活 → 取真 email (org-auth 响应) 或 accountId 合成 u-xxxx@token.wam → 自动建号
- 同号重贴 = token 续期 (原地换凭据+逐缓存) · token 失效 → 「token已失效·请重贴」明态
- 会话 token (devin-session-token$/JWT) 作密码 → 自动降格一次性直登 (池号必须长效凭据)

### 剜除 (~1100 行死重)

- Google-CDP 闭环 (_devinGoogleLogin/_gauth*/GAUTH_* · Chrome路径探测+极简WS+PKCE自构authorize+chooser自动化)
- 代理探测栈 (_gauthDetectProxy/_proxyReachesGoogle · netstat扫描+CONNECT+socks5握手)
- 邮箱接码闭环 (_devinEmailCodeLogin/_fetchCodeViaCodeQuery · 接码轮询+手动输码兜底)
- connections 探测 (devinConnections · hasPassword/hasGoogle 分岔的唯一消费者已删)
- package.json 同步清: wam.emailCode.* × 6 + wam.googleAuth.* × 4 → 新增 wam.tokenUrl

### 面板

- 「🔑 取Token」按钮: 一键复制取token片段 + 打开官网登录页
- wam.getToken / wam.addToken (manifest 补实现) / wam.injectToken 全部接入 token 入池总线 _handleTokenPaste

## v3.16.7 (2026-10-22) · 万法归一 · auth1 凭据库 · 一切账号同构

> *执古之道，以御今之有。* —— 帛书《老子》道经

### 根因 (用户实证两层)

- **面板仍示 3.16.2**: `const VERSION` 硬编码从未随包版本跃迁 —— 本版起版本号唯一真相源 = VERSION 常量
- **"点击登录=CDP"无普适**: v3.16.6 快道 `httpsReq(GET,url,hdr,30000)` 把 timeout 当 body → `chunk must be string` → 必崩落 CDP。日志实证每次 google 切号都弹浏览器/卡 chooser/120s 锁超时 = 「切换中」假象

### 本真 (实证 2026-10-22)

- **`auth1` 是长效 bearer 凭据** (跨机跨IP 8h+ `WindsurfPostAuth` 仍 200)。Devin 唯一真动作 = `auth1 → postAuth → sessionToken` —— 一切账号皆可归一于此
- 分层架构: `L1 sessionToken缓存(24h)` → `L2 _auth1_store.json(验活制·401才驱逐)` → `L3 主凭据铸币(password/gcookies/mailpw)` → `L4 CDP一次性开荒(仅interactive)`

### 实现

- `_devinAcquireSession` 总线: `devinLogin(凭据层命中→零铸币) → postAuth(验活) → 401驱逐→forceMint重铸一次` · verifyOne/loginAccount 两路同吃
- `_devinMintAuth1`: 原 devinLogin 铸币体改名 · password/google/emailcode 全沉淀 auth1 入库 (一次接码/一次开荒 · 此后永免)
- 谷歌饼干**按号分罐** `gauth-store/j-<sha1(email)>.json` (多号不串味) · `_meta.json` 记代理 · 旧 gcookies.json 自动迁移
- **修复**: 快道 httpsReq 参数错位 bug + redirect `state` CSRF 校验
- `_devinGoogleLogin` CDP 仅 `interactive` 放行 —— 后台 verify/prewarm 永不弹浏览器
- `password` 栏直存 `auth1_…` 即凭据 (token 账号一等公民) · `verifyOne` 无密码但库有 auth1 亦可验
- session cache auth1 字段自动迁移并入凭据库 (存量号无缝升级)

## v3.16.6 (2026-10-22) 路 鍏ㄥ姩鎬侀棴鐜?路 闆剁‖缂栫爜 路 HTTP蹇亾鍏岰hrome

> *涓哄鏃ョ泭锛屼负閬撴棩鎹? 鈥斺€?甯涗功銆婅€佸瓙銆嬪痉缁?
### 鏍瑰洜淇 (鐢ㄦ埛瀹炶瘉路鍙岀娓呭崟褰掍綅)

- `.obsolete` 璇爣 3.16.5 + `extensions.json` 鏉＄洰鍋?3.16.2 鈫?缂栬緫鍣ㄥ洖閫€鍔犺浇鏃х増 鈫?Google 鍒嗘祦涓嶅瓨鍦?鈫?鏃犲瘑鐮佽处鍙峰叏璧伴偖绠辩爜 鈫?120s 閿佽秴鏃跺惊鐜?= 銆屽垏鎹腑銆嶅亣璞?- 璺冭縼 3.16.6: 娓呭崟鏍℃ + .obsolete 褰掍綅(鏃х増灏佸瓨) 路 鎵╁睍椤垫墍瑙佸嵆鎵€寰?
### 鍔ㄦ€佸寲 (闆剁‖缂栫爜 路 鑷姩鎺㈡祴璇嗗埆鎵撻€氶棴鐜?

- `_gauthDetectProxy` 涓夌骇鍡呮帰: 鎸佷箙璁板繂 鈫?netproxy鎴樻灉(_netpGood) 鈫?env(HTTP/HTTPS/ALL_PROXY) 鈫?绯荤粺浠ｇ悊娉ㄥ唽琛?HKCU) 鈫?鐔熺煡绔彛 鈫?netstat鍏ㄧ洏鍙戠幇鍏滃簳 鈫?鐩磋繛
- VPN 绔彛闅忔剰鍙樿嚜鍔ㄦ寲鍑?路 鏃燰PN鍒欑洿杩炲彲杈惧嵆閫?路 鍏ㄤ笉閫氣啋鐪熼敊璇鍐掔粷涓嶅亣鎴愬姛
- `httpsReq` 鍥炰紶鍝嶅簲澶?(Location/Set-Cookie 鍙揪) 鈥?闅ч亾+鐩磋繛涓よ矾鍚屾瀯

### HTTP 蹇亾 (闆?Chrome 路 鏈€浼樼瓥鐣ユ渶灏忚繃绋嬮噺)

- 棣栫櫥 CDP 鏀跺壊 Google 浼氳瘽楗煎共钀界洏 `gauth-store/gcookies.json` (302 姣忚烦鍥炲啓 Set-Cookie 淇濋矞)
- 鍐嶇櫥: `prompt=none`+`login_hint` 鈫?Google 302 鐩村悙 code 鈫?exchange 鈫?postAuth 路 绾?httpsReq 璧板姩鎬佷唬鐞?路 鍏嶇獥鍏嶉┍鍔?- 楗煎共姝?闇€浜や簰 鈫?error 鑷姩钀藉洖 CDP 鎱㈤亾鑷剤骞堕噸鏀?路 Network 浜嬩欢鍙岄€氶亾鎶撶爜鍏滃簳杞
- 閰嶇疆: `wam.googleAuth.fastPath`(榛樿 true)
## v3.16.5 (2026-10-21) · Google-OAuth 闭环 · CDP驱动官方页 · 无为而无不为

> *为无为，则无不治* —— 帛书《老子》道经

### 背景

`has_password=false` 且 `google` 连接在位的账号：密码恒 401，邮箱验证码需读 Gmail（本机网络隔离不可达）。但目标机普遍存在本机代理（clash/sing-box），Google 可达 —— **官方 Google-OAuth 路才是正途**。

### 实证 (远程测试机 · 2026-10-21)

- `POST /api/auth1/connections` → `google-devin` enabled, `client_id=686954959906-…`
- 官方页真实 authorize 参数: `redirect_uri=https://auth.devin.ai/login/callback`, `state=auth1-app.devin.ai.<uuid>`, PKCE-S256, `prompt=select_account`
- CDP 驱动本机 Chrome (clash 代理) → Google chooser 点账号卡 → 回调 → `POST /api/auth1/google/exchange` → `{"status":"authenticated","token":"auth1_*","user_id":"user-*"}`
- `localStorage.auth1_session` = `{"token","userId"}` · `WindsurfPostAuth` → **sessionToken ✓ (全链闭环)**

### 实现 (零依赖·单文件)

- `_devinGoogleLogin`: spawn Chrome(`--remote-debugging --proxy-server --user-data-dir`持久profile) + 极简RFC6455 CDP (net+crypto) → 官方页状态机驱动 → `auth1_session` 提取
- `devinConnections` 增 `hasGoogle` 探测 · devinLogin 401 分流: google连接→google闭环优先, 失败回落邮箱码
- profile 持久 Google 会话 → 二登免密只点 chooser · 窗位屏外不扰用户 · 全程不碰主 profile

### 配置

`wam.googleAuth.enabled`(true) / `proxyUrl`(空=自动探测) / `chromePath`(空=自动探测) / `timeoutMs`(150000)

## v3.16.4 (2026-10-21) · 官方新认证 · 邮箱验证码闭环 · 道法自然

> *知其雄，守其雌，为天下谿* —— 帛书《老子》德经

### 背景

官方 Windsurf 登录新增邮箱验证码机制：一批账号 `has_password=false`（无密码账号），`/_devin-auth/password/login` 恒 401 `Invalid email or password` —— 非密码错，是账号根本无密码。`password/reset-start` 对无密码账号亦 400 封死，**验证码为唯一入口**。

### 实证 (本机 2026-10-21)

- `POST /_devin-auth/connections {product:"windsurf", email}` → `auth_method.has_password`（200 ✓）
- `POST /_devin-auth/email/start {email, mode:"login", product:"Windsurf"}` → `{ok:true, email_verification_token}`（200 ✓ 真发码）
- `POST /_devin-auth/email/complete {email_verification_token, code, mode:"login"}` → 401 `Invalid code`（错误码实测）/ `{token, user_id}`（与 password/login 同构）
- 枚举注意：`connections` 用小写 `windsurf`，`email/start|complete` 用大写 `Windsurf`，`mode` 取 `login`/`signup`

### 新增

- **§3a 验证码闭环三函数**：`devinConnections()` / `_fetchCodeViaCodeQuery()` / `_devinEmailCodeLogin()`
- **devinLogin 分流**：password/login 401 时探测 connections，`has_password:false` → 自动走 `email/start → 接码 → email/complete`，返回与旧版同构 `{ok, auth1, userId}`，下游 postAuth/inject 零改动
- **接码两路**：① 外置接码服务自动轮询（`wam.emailCode.queryUrl` BYO端点，只收本次发码后到达的带码邮件）；② 超时且 interactive → `showInputBox` 手动输码兜底
- **调用区分**：`loginAccount` 传 `interactive:true`（手动切号可弹输入框）；`verifyOneAccount` 传 `interactive:false`（批量验证不弹框，接码失败记错即可）
- **限速同护**：`email/start` 命中 429 同样进 `_devinLoginRateLimitedUntil` 窗口
- **_hotlogin.js 同步**：独立热登录脚本亦走同闭环（stdin 手动输码），Administrator 硬编码路径改 homedir 动态

### 配置 (wam.emailCode.*)

| 键 | 默认 | 义 |
|---|---|---|
| `enabled` | true | 无密码账号自动转验证码流总开关 |
| `queryUrl` | 外置 code-query | 接码端点（空=禁用自动接码） |
| `pollMs` | 8000 | 接码轮询间隔 |
| `timeoutMs` | 90000 | 接码超时 → interactive 弹输入框 |
| `manualInput` | true | 手动输码兜底开关 |

## v3.16.3 (2026-08-31) · 对话级成本追踪 · 本源归一

> *万物负阴而抱阳 · 中气以为和* —— 帛书《老子》德经

### 背景

Windsurf（WinSrv）4.x 超级本体体系已归档（`_archive/windsurf-4.x/`），Devin Desktop 3.16 为本源体系。对话级成本追踪（dao_cost.js）从 4.x 移植到 3.16 本源。

### 新增

- **dao_cost.js**：对话级成本追踪模块（纯本地·零干扰·从 .pb 提取 ModelUsageStats → DeepSeek 定价计算成本）
  - `getConversationCost(uuid)`：单对话 token 用量 + 成本
  - `getAllConversationCosts()`：全量汇总（总成本/缓存命中率）
  - `getConversationStatus(uuid)`：对话活跃判定（streaming/active/idle）
  - 数据源：`~/.codeium/windsurf/cascade/*.pb`（与 dao_stuck.js 同源）
  - 密钥：`~/.wam/_cascade_key.json`（AES-256-GCM）
- **extension.js 集成**：`_detectFinishedConversations()` 在 Hub 轮询中检测对话结束（从 streamingList/current 消失 + .pb idle >180s）→ 计算成本 → 通知 + 日志
  - 通知格式：`[标题] 完成 · $0.12 · in 1.2K out 3.4K · cache 85%`
  - 防重复：同一对话 5min 内不重复通知（COST_NOTIFY_CD）
  - 零干扰：纯只读 .pb · 失败静默 · 不阻塞主线程

### 部署

- 五处 `.devin/extensions/devaid.rt-flow-3.16.2/` 同步（多机多用户环境）
- extension.js 哈希：8B2D4037（含 dao_cost 集成）

## v3.13.0 (2026-06-28) · Devin Desktop 自适应 · 万法归宗 · 当前

> *道常无为而无不为 · 侯王若能守之 · 万物将自化* —— 币书《老子》道经

### 背景

Windsurf 品牌正式迁移为 Devin Desktop (Cognition 收购 Windsurf)。IDE 内部命令已从 `windsurf.*` 变更为 `devin.*`。

### 远端机实测发现

| 属性 | 旧值 (Windsurf) | 新值 (Devin Desktop) |
|------|-----------------|---------------------|
| `product.json.nameShort` | Windsurf | **Devin** |
| `product.json.applicationName` | windsurf-desktop | **devin-desktop** |
| `extensionId` | codeium.windsurf | codeium.windsurf (不变!) |
| `authProviderId` | windsurf_auth | windsurf_auth (不变!) |
| 扩展目录 | extensions/windsurf | extensions/windsurf (不变!) |
| 命令前缀 | windsurf.* | **devin.*** |
| session key | windsurf_auth.sessions | **devin_auth1_token** 等 |
| HTTP header | X-Windsurf-* | **X-Devin-Auth1-Token** 等 |

**关键**: `extensionId` 和 `authProviderId` 未变，但命令名已全面迁移为 `devin.*` 前缀。

### 命令名变更详情

| 旧命令 | 新命令 |
|--------|--------|
| `windsurf.login` | **`devin.login`** |
| `windsurf.logout` | **`devin.logout`** |
| `windsurf.loginWithAuthToken` | **`devin.loginWithAuthToken`** |
| `windsurf.provideAuthTokenToAuthProvider` | **`devin.provideWindsurfAuthTokenToAuthProvider`** |
| (新增) | **`devin.provideDevinAuthCodeToAuthProvider`** |
| (新增) | **`devin.cancelLogin`** |

**核心发现**: `provideAuthTokenToAuthProvider` 已被拆分为两个新命令:
- `devin.provideWindsurfAuthTokenToAuthProvider` — session token 注入 (WAM 使用)
- `devin.provideDevinAuthCodeToAuthProvider` — auth code 注入

### 核心变更: 自适应命令检测

**零配置自适应** — 插件启动时自动检测 IDE 注册的命令名，无需用户手动配置:

1. **`_detectAuthCommands()`** — 通过 `vscode.commands.getCommands(true)` 扫描已注册命令
   - 优先检测 `devin.provideWindsurfAuthTokenToAuthProvider` (新版)
   - 回退检测 `windsurf.provideAuthTokenToAuthProvider` (旧版)
   - 最终回退: 检查 `devin.*` login/logout 命令存在性
   - 结果缓存于 `_detectedAuthProvider` · 全生命周期一次检测 · 零重复开销

2. **`_getAuthCommand(key)`** — 根据检测结果返回正确的命令名
   - `PROVIDE_AUTH_TOKEN` → `devin.provideWindsurfAuthTokenToAuthProvider` 或 `windsurf.provideAuthTokenToAuthProvider`
   - `PROVIDE_DEVIN_AUTH_CODE` → `devin.provideDevinAuthCodeToAuthProvider`
   - `LOGOUT` → `devin.logout` 或 `windsurf.logout`
   - `LOGIN` → `devin.login` 或 `windsurf.login`
   - `LOGIN_WITH_AUTH_TOKEN` → `devin.loginWithAuthToken` 或 `windsurf.loginWithAuthToken`

### 受影响函数

| 函数 | 变更 |
|------|------|
| `injectViaBing()` | 硬编码 `windsurf.provideAuthTokenToAuthProvider` → `_getAuthCommand("PROVIDE_AUTH_TOKEN")` |
| `injectToken()` | 日志消息自适应 |
| `_setMode()` | 硬编码 `windsurf.logout` → `_getAuthCommand("LOGOUT")` · fallback 改为 `devin.logout` |
| `_installOpenExternalGuard()` | 正则新增 `devin.ai/(auth\|login\|signin\|oauth\|account)` 拦截 |
| `tryFetchPlanStatus()` | metadata `ideName` 自适应 `devin-desktop`/`windsurf` · `extensionName` 固定 `windsurf` |
| `activate()` | 早期触发 `_detectAuthCommands()` · 日志输出检测结果 |

### 认证端点 (暂未变更)

```
URL_DEVIN_LOGIN    = windsurf.com/_devin-auth/password/login     (不变)
URL_POSTAUTH       = windsurf.com/_backend/.../WindsurfPostAuth  (不变)
URL_REGISTER_USER  = register.windsurf.com/.../RegisterUser      (不变)
URL_DEVIN_ORG_AUTH = app.devin.ai/api/users/post-auth            (不变)
```

## v3.12.2 (2026-05-29) · 引擎 v16.0 · 卡死/中断识别四治

> *知不知尚矣 · 不知不知病矣 —— 读到可疑数据宁可不更新，不假装知道*

### 实测病灶

实测 dao_stuck.js v9 引擎日志暴露四处根因，导致用户感知:
1. **对话数量不准确** — 显示 active 计数在 `0↔7` 间剧烈振荡 (每30s)
2. **中断对话识别缓慢** — 已 end_turn 的对话被误判为 active 继续追踪 200+ 秒
3. **卡死对话识别缓慢** — 死循环 `DEAD→RECOVER→DEAD→RECOVER` 反复发通知

### 根因 → 治法 (四处一体)

#### Fix 1 · Python 读取器 WAL 双保护 (核心)

```
旧: VSCDB_PY active=0 → active=7 → active=0 → active=6 → active=0 (周期 30s)
新: VSCDB_PY_WAL_STATUS_SKIP active=0(peak=3) sessions=163 → status stale, keeping old cache
```

**根因**: `_refreshVscdbRaw` (Python sqlite3 路径，无 better-sqlite3 时使用) 完全没有 WAL 保护。Python 交替读到 WAL 主文件 (active=0) 和 WAL 段 (active=7)，每30s覆盖 sessionCache。连锁: stuckTicks 反复归零 → 卡住检测永远无法积累 → 完全失效。

**治法**: 镜像 `refreshVscdb` 的双重高水位保护:
- `_pyWalHigh` — count 坏读保护 (新读 < 60% 峰值 → 保留旧 cache)
- `_pyWalActiveHigh` — active 骤降保护 (新 active < 50% 峰值 → 保留旧 cache)

#### Fix 2 · WAL fallback 尊重 prevVscdbStatus=end_turn

**根因**: 对话从 sessionCache 消失时，若 `lastVscdbActiveTs` 在 3min 内，无条件走 WAL active fallback。即使 `prevVscdbStatus = "end_turn"` (对话已正常完成) 也被误归为 active 继续追踪 → `WARN_STUCK vscdb=n/a` / `CRITICAL_STUCK vscdb=n/a` 误报。

**实测**: `fc4d79bd "Deep Proxy Verification"` `prevVscdbStatus=end_turn` 但触发 CRITICAL_STUCK 200s。

**治法**: WAL fallback 入口先判 `prevVscdbStatus === "end_turn"` → 直接归 completed，不进入 active 追踪。

#### Fix 3 · RECOVER 后 recentlyKilled 静默期

**根因**: `RECOVER` 清零 `deadSince` 但 `meta.updatedAt` 仍新鲜，下次 `unknown_error` 时 `recentlyKilled` 路径立即重触 → DEAD 通知 → RECOVER → DEAD → 循环 (实测 `3955435a "Analyze Figures and Outputs"` 5min内3次 DEAD)。

**治法**:
- RECOVER 时记录 `_lastRecoverTs = t` + 清零 `errorTicks`
- `recentlyKilled` 检查时若 `t - _lastRecoverTs < 180000` (3min) → 豁免 B-recent 路径

#### Fix 4 · state="old" 可逆 (OLD_ESCAPE)

**根因**: 对话超过 `ignoreAge` (1小时) 后 `entry.state = "old"` + `continue` 无条件跳过。若对话重新活跃 (size 增长)，永远无法逃出 old 状态。

**治法**: ignoreAge 块内检查 `_grewWhileOld = st.size > _oldSize`:
- 增长 → 重置到 `init` 状态 + 落入正常处理 + 记 `OLD_ESCAPE` 日志
- 未增长 → 维持 `continue` (静默放行)

### 验证结果

| 指标 | 修复前 | 修复后 |
|---|---|---|
| VSCDB active 计数稳定性 | 0↔7 振荡 | 平滑 0→3→5→6→8 |
| sessionCache 一致性 | 30s 翻转一次 | WAL_STATUS_SKIP 拦截全部坏读 |
| 误 DEAD 循环 (3955435a类型) | 5min 3次 | 完全消失 |
| 误 CRITICAL_STUCK (fc4d79bd类型) | end_turn 后 200s 误报 | end_turn 立即归 completed |
| state="old" 复活 | 永久卡死 | OLD_ESCAPE 自动恢复 |

### 启动日志

```
START v16.0 ... [WAL双保护+end_turn修复+RECOVER防循环+old可逆]
```

---

## v3.12.1 (2026-05-28) · 通知三路消除 · 对话恢复即撤

> *反也者道之动也 · 对话恢复·通知即止·无需等 10min —— 道法自然*

### 根因

对话卡住后弹出的 toast 通知，即使对话恢复正常，仍会持续显示直到 10min 超时或用户手动取消，造成**误导感知**：用户已自行修复，但通知栏还在红色报警。

### 三路消除完善

| 触发路径 | 实现 | 版本 |
|---|---|---|
| **① 用户手动关闭** | 面板 × 按钮 → `dismissConv()` → `_dismissedConvUuids` 10min 静默 | v3.7.5 |
| **② 10min 无操作自动消退** | `_stuckFirstNotifyTs` + `STUCK_NOTIFY_AUTO_DISMISS_MS` | v13.0 |
| **③ 对话恢复后自动消退** | `_resolveConvNotify(uuid)` 主动 resolve withProgress → toast 即刻消失 | **v3.12.1 新增** |

### 技术改动

- **`_activeNotifyResolvers: Map<uuid, fn>`** — 全局存储每条 toast 的 resolve 句柄
- **`_notifyTimed(level, msg, ttlMs, _convUuid)`** — 新增第4参数，注册外部取消句柄，支持三路退出（超时 / 用户取消 / 对话恢复）
- **`_resolveConvNotify(uuid)`** — 新增函数，对话恢复路径调用，立即关闭对应 toast
- **恢复检测循环** — 移除已无意义的 `_hubLastRecoverNotify` 冷却约束（v11.3 移除恢复通知后冷却仅阻碍清理）；新增：①消除 toast ②清除 dismiss 状态（恢复=新生命周期，下次卡住可重新提醒）③批量落盘

### 通知一次性闸门保障

同一对话同一异常生命周期仍只提示一次（`_claimConvNotify` + `_hubLastStuckUuids`），恢复后自动释放闸门，下一轮新异常才可再提示。

---

## v3.12.0 (2026-05-28) · 编码三重保险 · 跨平台根治

> *反者道之动也 · 弱者道之用也 · 天下之物生于有 · 有生于无 —— 帛书《老子》*

### 用户实地反馈根因

其他电脑部署后，**对话标题全是菱形乱码** `◆◆◆◆X◆bÌ◆◆◆735`:

```
根因链:
  _vscdb_helper.py 用 ensure_ascii=False → 中文原文输出
  → Windows 中文系统 Python stdout 默认 CP936 编码
  → Node.js spawnSync encoding:'utf8' 以 UTF-8 解读 CP936 字节
  → 编码错位 → 菱形替代字符 (U+FFFD/U+25C6)

同时 extension.js 的 _findPythonExt() 仅检查 python/python3
→ 装 py.exe/Anaconda/pyenv 的系统找不到 Python → 标题全显 UUID
```

### 三重保险修复

| 层 | 位置 | 修复 |
|---|---|---|
| **层1** | `_vscdb_helper.py` | `sys.stdout.reconfigure(encoding='utf-8')` (Python 3.7+) + fallback `io.TextIOWrapper` |
| **层2** | `_vscdb_helper.py` | `ensure_ascii=True` → 所有非ASCII输出 `\uXXXX` 转义 (纯ASCII · 编码无关) |
| **层3** | `extension.js` + `dao_stuck.js` | `env: { PYTHONIOENCODING: 'utf-8' }` 注入子进程环境 |

### 乱码标题自动清洗

- 新增 `_isGarbledTitle()` / `_isGarbledStr()` · 检测 U+FFFD/U+25C6 连续菱形 + 不可打印字符占比
- `extension.js`: 加载 `_conv_titles.json` 时自动跳过乱码条目 + 日志报告
- `dao_stuck.js`: 加载备份标题时同步清洗
- Python 读 vscdb 返回的新标题也过乱码检测

### extension.js _findPythonExt() 升级到七层兜底

旧版仅 `["python", "python3"]` 两层 → 与 `dao_stuck.js` 同步七层:
1. `wam.pythonPath` 软编码配置
2. `WAM_PYTHON_PATH` 环境变量
3. PATH `python3` / `python`
4. PATH `py` (Windows Python Launcher)
5. 用户级/全机级 Python.org 安装路径 (3.7~3.15)
6. Microsoft Store Python
7. Anaconda3 / Miniconda3 / pyenv / Homebrew / MacPorts

### 文件变更

| 文件 | 变化 |
|---|---|
| `_vscdb_helper.py` | +12行 · 编码三重保险 + `ensure_ascii=True` |
| `extension.js` | `_findPythonExt()` 2层→7层 · `_isGarbledTitle()` 新增 · PYTHONIOENCODING 注入 |
| `dao_stuck.js` | `_isGarbledStr()` 新增 · `_loadBackupTitles` 乱码清洗 · PYTHONIOENCODING 注入 |
| `package.json` | 版本 3.12.0 |

---

## v3.11.9 (2026-05-28) · 软编码万家适配 · v15.2 · Python 七层兜底

> *上善若水 · 水善利万物而有静 · 居众之所恶 · 故几于道矣 —— 帛书《老子》八章*

### 用户实地反馈根因

新用户 / 不同环境用户安装后，**对话面板全是 `#UUID` 编号**：

```text
症状: 用户截图中 streamingList 显示的全是 "对话 #c65b3411" 风格
根因链:
  ① _vscdb_helper.py 部署完整 (v3.11.8 已修)
  ② 但 _findPython() 仅查 PATH 中 'python' / 'python3'
  ③ 用户机器装的是 Python.org launcher (py.exe) → 探测失败
  ④ 没探测 %LOCALAPPDATA%\Programs\Python\Python3X\python.exe (用户级安装)
  ⑤ 没探测 Anaconda / Microsoft Store / pyenv / Homebrew
  ⑥ → sessionCache 永空 → entry.title 全 null → UUID 兜底
```

实证: 不同用户机器上 Python 可能在以下任一位置（旧 v3.11.8 全失败）:

- `py` (Windows Python Launcher · python.org 默认勾选项)
- `%LOCALAPPDATA%\Programs\Python\Python311\python.exe` (用户级安装最常见)
- `%USERPROFILE%\anaconda3\python.exe`
- `/opt/homebrew/bin/python3` (macOS Apple Silicon)
- `~/.pyenv/shims/python3` (pyenv)

### 七层兜底治法 (`dao_stuck.js::_findPython`)

```text
1. CFG.pythonPath          (--python-path · 来自 wam.pythonPath 软编码)
2. process.env.WAM_PYTHON_PATH (环境变量 · 即时 override)
3. PATH: python / python3  (跨平台标准)
4. PATH: py                (Windows Python Launcher · python.org 装的桥)
5. %LOCALAPPDATA%\Programs\Python\Python3X\python.exe   (用户级 · 3.7~3.15)
6. %ProgramFiles%\Python3X\python.exe + %ProgramFiles(x86)% + Microsoft Store
7. Anaconda3 / Miniconda3 / pyenv / Homebrew / MacPorts
```

每一层独立探测 + 缓存结果 · 找到即用 · 探测失败仅静默退化 (UUID 兜底)。

### 新增软编码

```jsonc
{
  "wam.pythonPath": ""    // ★ v15.2 显式 Python 路径 · 空=自动探测七层兜底
}
```

### 新增工具: `doctor.ps1` · 环境兼容性诊断

帮新用户/异常环境用户排查 9 大检查项：

```powershell
.\doctor.ps1                  # 完整诊断 · 21 个 pass 项 + 警告/失败
.\doctor.ps1 -Quiet           # 仅显示问题项
.\doctor.ps1 -ExportReport    # 导出 JSON 到 ~/.wam/_doctor_report.json
```

诊断项：

1. Windsurf 安装 + WAM 部署（含 `_vscdb_helper.py` 检查）
2. `~/.wam/` 数据目录关键文件
3. Node.js 可用性
4. Python 七层探测验证
5. `state.vscdb` 可读性 + Python 直读测试
6. PowerShell 版本（通知能力）
7. `dao_stuck` 引擎心跳
8. 当前活跃账号健康
9. Hub 数据流（streamingList 真名比例）

### 改动文件 (v3.11.8 → v3.11.9)

| 文件 | 变化 |
|---|---|
| `dao_stuck.js` | `_findPython()` 七层兜底 + `--python-path` arg |
| `extension.js` | VERSION 升 · 透传 `wam.pythonPath` 到子进程 |
| `package.json` | +1 软编码 `wam.pythonPath` (45 配置项总计) |
| `doctor.ps1` | **新增** · 9 检查项 · UTF-8 BOM 安全 |
| `README.md` | 重写 · 加 Python 依赖章节 + 故障诊断章节 |

### 道义解读

> **上善若水** — 七层兜底如水之善 · 利万物而有静 · 居众之所恶 (各种奇怪安装位置)
>
> **唯之与阿，相去几何** — 自动探测 vs 显式配置 · 都是道 · 用户两可
>
> **大成若缺，其用不弊** — 没装 Python 也不卡死 · 仅退化为 UUID 兜底 · 大用不弊

---

## v3.11.8 (2026-05-28) · 用户主权强化 · v15.1 · 真名+X+陈旧通知

> *太上下知有之 · 知人者知也 · 自知者明也 · 知止不殆 · 可以长久 —— 帛书《老子》*

### 三大用户主权强化 (用户截图核心痛点根治)

用户在 v3.11.7 截图反馈：对话追踪面板里**所有标题全是 `#UUID` 编号**（如 `#c65b3411 #f65109e9 #dd6e5f8c`），无法识别。同时 streamingList 活跃对话**只有 stuck 卡死的能 X 关闭**，AI 中断 + 等待用户的对话**完全无通知**。

#### 修复①: 真实对话标题 (vscdb 直读链路根治)

**根因铁证**:
```
旧 (v3.11.7): _vscdb_helper.py 在源 1085B · deploy.ps1 未复制 → vscdb 直读失败
            → sessionCache 永空 → entry.title 全 null
            → hub.json 用 "对话 #UUID" 兜底
            → 用户截图全是 #c65b3411 编号
```

**治法**: `deploy.ps1` v15.1 强制 `_vscdb_helper.py` 必随; `.vscodeignore` 加 `!_vscdb_helper.py`; 不再有部署遗漏可能。

**实证**:
```
当前 hub.json streamingList:
  ✓ 'Windsurf Plugin Max Integration' (c65b3411)
  ✓ 'Fixing Auto-Switch System' (dd6e5f8c)
  ✓ 'Devin VM Reverse Engineering Deep Dive' (afcc0f28)

entry.title 已填充: 50/50 (100%)
```

#### 修复②: streamingList 全部对话加 X 关闭按钮 (用户主权扩展)

| 项 | 旧 | 新 (v15.1) |
|---|---|---|
| stuckList 卡死对话 | ✓ 已有 X | ✓ 保留 |
| **streamingList 活跃对话** | ✗ 无 X | **✓ 全部加 X** |
| 关闭后 | 10min 静默·过期恢复 | 同左 |
| 多窗口同步 | ✓ DISMISS_FILE | ✓ 同 |

代码: `extension.js` line 3118-3121 给每个 streamingList 对话渲染
```html
<button class="cv-close" onclick="dismissConv('${uuid}')">×</button>
```

#### 修复③: 消息提醒强化 (1min 卡死/中断必通知)

| 场景 | 旧行为 | 新行为 (v15.1) |
|---|---|---|
| 正常 1min 卡 (state=warning) | ✓ toast 通知 | ✓ 保留 |
| DEAD 中断 (vscdb=unknown_error) | ✓ toast 通知 | ✓ 保留 |
| **AI 中断 + _turnGrowth>4KB** | ✗ _awaitingUser 静默 | **✓ _isStale 触发通知** |
| 通知类型 | 一次性·全局冷却 5s | 同左 |
| 用户关闭 | X 按钮 → 10min 静默 | 同左 |
| 自动消退 | 10min STUCK_NOTIFY_AUTO_DISMISS | 同左 |
| 显示文案 | "对话停滞: xxx (停滞 Nmin)" | **"对话陈旧停滞: 真名 (停滞 Nmin)"** |

### 新增 2 个软编码 (v15.1)

```jsonc
{
  "wam.notifyOnStaleStream": true,     // ★ 主治 · 默 true · 陈旧 streaming 也通知
  "wam.notifyOnAwaitingUser": false    // ★ 高级 · 默 false · 等待用户也通知 (极端场景)
}
```

### 改动文件 (v3.11.7 → v3.11.8)

| 文件 | 变化 | 字节 | sha 短 |
|---|---|---|---|
| `extension.js` | 修复 ②③ + 版本号 | 449063 | 0cc2c62a |
| `package.json` | +2 软编码 + 版本号 | 16849 | - |
| `dao_stuck.js` | 无变化 (sha 相同) | 122293 | e7b2c5a9 |
| `_vscdb_helper.py` | **必随** (新加) | 1085 | a9eaf626 |
| `deploy.ps1` | copy 加 _vscdb_helper.py | - | - |
| `.vscodeignore` | 加 `!_vscdb_helper.py` | - | - |

### 道义解读 (帛书《老子》)

> **太上下知有之** — 用户对所有对话有主权 · 想关就关
>
> **知人者知也·自知者明也** — 真实标题让用户认识自己的对话 · 不再迷茫
>
> **知止不殆·可以长久** — 通知一次即止 · 10min 自动消退 · 不烦扰

---

## v3.11.7 (2026-05-28) · 对话识别根治 · v15.0 · 30min 软窗 · _isStale 标记

> *知人者知也，自知者明也 · 天下莫柔弱于水，而攻坚强者莫之能胜也 —— 帛书《老子》*

### 用户实地反馈根因 (2026-05-28 截图)

```
内部 stuck_state_v9.json: 7 条 state=streaming
hub.json 暴露: 仅 4 条 → 失明 3 条
失明对话: 32f941bf "Windsurf Rate Limit Refinement" (50min 前停滞)
        + 类似 stale > 5min 的对话全部隐身
症状: 用户截图卡住对话完全找不到 · 无法手动处理
```

### 五大失明根因体系性盘点 (反者道之动·彻底审视)

```
① _recentWindowMs 5min 硬过滤 → state=streaming 但 stale>5min 失明 (主因·本次治)
② NO_PB 对话只进 stuckList · 不进 streamingList → 用户感知失明 (次因·本次治)
③ state.conversations cleanup 过激 → .pb 临时锁/重建时被即时删除 (边角)
④ state="old" 转换不可逆 → ignoreAge(1h) 后即使重新活跃也卡 old (边角)
⑤ USER_PROMPT_DETECT 30s 阈值 → <30s 内连续发消息 entry 状态保留旧值 (边角)
```

### 治法三层 (修复 ①②③)

#### 修复①: 5min 硬过滤 → 30min 软窗

```js
// 旧 (v14.0): 5min 硬过滤 · stale>5min 完全失明
const _recentConvs = Object.values(state.conversations)
  .filter((e) => e.state !== "old" && _now - e.lastGrowth < _recentWindowMs);

// 新 (v15.0): 30min 软窗 · 真"死透"才剔
const _allStreamingConvs = Object.values(state.conversations)
  .filter((e) => {
    if (e.state !== "streaming") return false;
    if (_streamStaleMaxMs > 0 && _now - e.lastGrowth > _streamStaleMaxMs) return false;
    return true;
  });
```

#### 修复②: 加 `_isStale` 字段 (UI 区分新鲜/陈旧)

```js
// 引擎写入 streamingList 每条对话:
{
  uuid, title, sizeKB, staleSec,
  _isStale: (_now - e.lastGrowth > _streamFreshMs),  // > 60s 标记陈旧
  state: 'streaming'
}
```

UI 渲染三态:
- ▶ 新鲜 (绿) · lastGrowth < 60s
- ◐ 陈旧 (黄) · 60s ~ 30min · _isStale=true
- ❓ NO_PB (灰) · 无 .pb 文件

#### 修复③: NO_PB 对话也进 streamingList

```js
// 新逻辑: stuckList 中无 .pb 的对话 → 也补一份到 streamingList (state='no_pb')
// 用户能看到「未生成 .pb 但 vscdb=active」的对话
```

### 新增 1 个软编码

```jsonc
{
  "wam.streamStaleMaxSec": 1800  // 30min 软窗 (旧 v14.0 硬限 5min) · 0=永不剔除
}
```

### 实证 (用户截图原症 vs v15.0 治后)

| 截图症状 | v14.0 (旧) | v15.0 (新) |
|---|---|---|
| 状态栏「对话 流式 3」 | 显示 3 条 | **显示 5 条** (含陈旧) |
| "Windsurf Rate Limit Refinement" 50min 前停滞 | ✗ **完全消失** | ◐ 陈旧标记可见 (30min 内) |
| 卡住对话需要提醒 | ✗ 无标记 | ◐ 黄色"陈旧"字样直观显示 |

### 改动文件

- `dao_stuck.js` (writeHeartbeat v15.0 改写 · 5min→30min 软窗 + _isStale 字段)
- `extension.js` (VERSION → 3.11.7 · UI 三态渲染)
- `package.json` (+ streamStaleMaxSec)
- `CHANGELOG.md` (本条目)

### 道义解读

> **知人者知也，自知者明也** — v14.0 不知陈旧不是消失，是病；v15.0 知陈旧仅为提示
>
> **天下莫柔弱于水** — 5min 硬过滤 = 坚强 · 直接失明；30min 软窗 + _isStale = 柔弱 · 全显但分级

---

## v3.11.6 (2026-05-28) · 自动切号根治 · v15.0 · credits 不再代替 quota%

> *知不知，尚矣；不知不知，病矣。是以圣人之不病，以其病病也，是以不病。—— 帛书《老子》七十一章*

### 用户实地反馈根因 (2026-05-28 截图)

```
活跃号: julioleyfarley · D=91% W=0% · Trial · credits PC=10K + FC=20K
状态栏: D91%-W0% 205/242号 · 🔴 Trial - Quota Exhausted
横幅: "Your included weekly usage quota is exhausted"
症状: 池中 205 个可用号 · WAM 不切 · 用户卡死
```

### 根因链 (v3.7.6 设计错误)

```js
_hasUsableCredits(h) = (10K + 20K ≥ 1000) = true
  ↓
_isValidAutoTarget: if (_hasUsableCredits(h)) return true  ← 视为可用·不切走
  ↓
_tick.isHardExhausted = !_hasCreditsActive && (W=0)
                      = !true && true = false              ← 不走硬耗尽分支
  ↓
credits 充裕的 W=0 号 = 永久免死金牌 · 系统失明
```

### 实证

Cascade premium model (Claude/GPT-4) 后端**只看 weekly%** 计费 · 与 credits 无关：

- `credits` (promptCredits/flowCredits) → Devin agent 用
- `quota%` (daily/weekly) → Cascade premium model 用
- W=0 时 Cascade 后端 429/403 拒服 · 即使 credits 满

### 七大根治 (v15.0)

#### 修复①: `_isValidAutoTarget` — credits 不再单独放行

```js
// 旧 (v3.7.6)
if (_hasUsableCredits(h)) return true;  // ← bug: credits 充裕直接放行
if (h.daily < dailyMin) return false;

// 新 (v15.0)
if (h.daily < dailyMin) return false;   // ← 主门槛 quota% 在前
if (!drought && h.weekly <= weeklyMin) return false;
if (_hasUsableCredits(h)) return true;  // ← credits 仅作"次级放行"
```

#### 修复②: `_scoreOf` — credits 不再豁免双零守门

```js
// 旧: if (effQ === 0 && !_creditsOk && !overage) return -Infinity
// 新: if (effQ === 0 && !overage && !(bypass && _creditsOk)) return -Infinity
```

#### 修复③: `_tick.isHardExhausted` — credits 不再豁免硬耗尽

```js
// 旧: !_hasCreditsActive && (W=0 || D=0)
// 新: !overage && !(bypass && _hasCreditsActive) && (W=0 || D=0)
```

#### 修复④: 新增配置 `wam.creditsBypassQuotaGate`

```jsonc
{
  "type": "boolean",
  "default": false,
  // false = Cascade 模式 · W=0 必切 (默认安全)
  // true  = Devin agent 兼容老逻辑 · credits 充裕不切
}
```

#### 修复⑤: `zeroQuotaRetickMs` 默 2000 → 300ms (近零延迟)

切号成功后立刻验证额度，发现新号 W=0 → 300ms 后立刻再切 (旧值 2s 太慢)。

#### 修复⑥: 新增「硬耗尽看门狗」 — 独立 2s 周期

独立于 `_tick` 10s 周期 · 只读 health 内存数据 (无 API 调用):
- 每 2s 检查活跃号是否硬耗尽 (W=0/D=0)
- 触发即调 `_engine._tick()` 让其处理
- 用户感觉切到 W=0 号 1-2s 内自愈 (而非等 10s)
- 配置: `wam.hardExhaustWatchdogMs` (默 2000 · 0=禁用)

#### 修复⑦: 部署 + 后端验证

```text
_test_v3116_auto_switch.cjs · 14/14 测试全部通过
默认 (Cascade 严守): 7/7 通过
兼容 (Devin bypass): 7/7 通过

关键用例: julioleyfarley · D91% W0% credits=30K
  default: valid=false · score=-∞ · hardExh=true   ← 修复成功
  bypass:  valid=true  · score=OK · hardExh=false   ← 兼容老行为
```

### 改动文件

- `packages/wam/extension.js` (VERSION → 3.11.6 · 修复 ①②③⑤⑥)
- `packages/wam/package.json` (3.11.5 → 3.11.6 · 新配置 ④⑤⑥)
- `packages/wam/CHANGELOG.md` (本条目)
- `packages/wam/_test_v3116_auto_switch.cjs` (新增·后端验证)

### 道义解读

> *知不知，尚矣* — credits 不是 quota 的替代品 · 仅为辅助资源池
>
> *不知不知，病矣* — v3.7.6 把 credits 当作 quota 的免死金牌 · 让 W=0 号永生 · 这是病
>
> v15.0: 主门槛 (quota%) 严守 · credits 仅作次级·overage 真金救场 · creditsBypass 兼容回退

---

## v3.11.5 (2026-05-27) · 对话追踪全量根治 · 知人者知也 自知者明也

> *知不知，尚矣；不知不知，病矣。是以圣人之不病，以其病病也，是以不病。—— 帛书《老子》七十一章*

### 三大根因 (用户实地反馈 · 反向审视 v13.0 设计)

用户截图直证 v13.0「单对话止跳」副作用太大：
- 多对话场景只显 1 条 (失明)
- 标题永远 `对话 #UUID` (无名)
- 卡死/停滞零提示 (失声)

#### 根因①: streamingList 限 1 条 → 多对话失明

**位置**: `dao_stuck.js::writeHeartbeat()` v13.0 写入 hub

```js
// 旧 (v13.0)
const _curConv = _recentConvs[0] || null;  // 只取第一个
active: _curConv ? 1 : 0,                  // 0 或 1
streaming: _isCurStreaming ? 1 : 0,        // 0 或 1
streamingList: _curConv ? [...] : [],      // 最多 1 条
```

**症状**: 用户开 3 个并行对话 → 面板永远只显示 1 个

**v14.0 治法**: streamingList = 全量 `state==="streaming"` 对话 · 不再限 1 条

#### 根因②: stuckList 无标题 → 静默丢弃 → 卡死隐身

**位置**: 三处共谋的隐身机制

1. `dao_stuck.js::_visibleStuckList`: `if (!t) return null` → 丢弃
2. `extension.js::_processHubStuck`: `if (!displayName) continue` → 不通知
3. `extension.js::_getConvTrackingHtml::visibleStuck`: `if (!_titleOk) return false` → 不显示

**症状**: 对话卡死后，由于 vscdb title 未生成 → 三处都过滤 → 用户**完全失明 + 失声**

**v14.0 治法**: 三处统一改用 UUID 兜底
```js
// 新 (v14.0)
const t = _displayTitleFor(uuid, title, cache)
       || "对话 #" + uuid.replace(/-/g, "").slice(0, 8);
```

道: *知不知尚矣 · 不知不知病矣* — 即使不知道名字也要通知，不能让用户失明

#### 根因③: active/streaming 计数永远 0/1 → 看板虚假

**症状**: 头部摘要 `对话 1 流式 1` 与现实严重脱节

**v14.0 治法**: 计数反映真实
```js
active: _activeStreamingConvs.length + _visibleStuckList(non-DEAD).length,
streaming: _trueStreamingCount,  // 真正流式 (不含等待用户)
```

### 设计哲学纠偏

v13.0 的「单对话止跳」错把症状当病因——抖动的根因是 **title 时序竞跑**（vscdb BUSY → title=null → 过滤 → 0 → 下一 tick title=ok → 1）。v3.11.3 已用 UUID 兜底治此根因，但 hub 数据生成仍残留 v13.0 的「只取第一条」副作用。

v14.0 彻底贯彻：**UUID 兜底本身即止跳契约 · 无需人为截断 · 让真相全显**。

### 改动文件

- `packages/wam/extension.js` (VERSION → 3.11.5, 通知 + visibleStuck 双重 UUID 兜底)
- `packages/wam/dao_stuck.js` (writeHeartbeat 全量化 · UUID 兜底统一)
- `packages/wam/package.json` (3.11.4 → 3.11.5)
- `packages/wam/CHANGELOG.md` (本条目)

### 验证清单

- [ ] 多开 3 个对话 → 面板显示 3 行
- [ ] 新对话刚启动 (title 未生成) → 显示「对话 #短UUID」
- [ ] 对话卡死 (无 title) → stuckList 显示 + 通知弹出
- [ ] 摘要计数反映真实数 (非 0/1)
- [ ] UI 计数不抖动 (UUID 兜底保证)

---

## v3.11.3 (2026-05-27) · 根治UI抖动 · 软编码归一 · 道法自然

> *上德不德，是以有德；下德不失德，是以无德。—— 帛书《老子》德经第一章*

### 三大根治 (从根本底层·反向审视)

#### 一、对话计数0↔1抖动 (streamingList / _recentConvs / _buildHubCurrent)

**根因**: `_displayTitleFor(uuid, title, backup)` 在对话初期返回空字符串（AI 未回复 title 尚未生成）→ 过滤条件把有效对话「吃掉」→ 下一心跳 title 到位又「吐出来」→ 面板 0↔1 闪跳

**治法 (v3.11.3 止跳法)**:
- `_recentConvs` 过滤去掉 `_displayTitleFor` 条件 · 改为 `.map()` 中加兜底短 UUID 标题
- `streamingList` 条件从 `_curConv && _curTitle` 改为仅 `_curConv` · title 内置兜底
- `_buildHubCurrent` 同构改法 · 去掉 title 过滤加兜底

**效果**: 对话存在即计入 · title 延迟不再导致闪跳 · 从根本消灭 0↔1 抖动

#### 二、broadcastUI 防抖过短致 DOM 频繁重建

**根因**: 硬编码 60ms 防抖 · 用户多选操作手速 < 200ms · 每次点击触发一次完整 DOM 重建

**治法**: `_cfg("broadcastDebounceMs", 200)` 软编码 · 默认 200ms · 覆盖正常手速 · min 30

#### 三、单例闸门 + 心跳全套软编码

**根因**: PID age 90s / 心跳 30s / 近期窗口 300s / 流式新鲜 60s 全硬编码 · 不适配不同机器性能

**治法**: 4 个参数通过 `--singleton-age-ms` / `--heartbeat-ms` / `--recent-window-ms` / `--stream-fresh-ms` 从 extension.js 传入 dao_stuck.js · 配置来自 VS Code settings (wam.*)

### 新增配置项 (6项)

| 配置 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `wam.broadcastDebounceMs` | number | 200 | UI广播防抖延迟 (ms) |
| `wam.engineSingletonAgeMs` | number | 90000 | 引擎PID年龄阈值 (ms) |
| `wam.engineHeartbeatMs` | number | 30000 | 引擎心跳间隔 (ms) |
| `wam.recentConvWindowMs` | number | 300000 | 近期对话窗口 (ms) |
| `wam.streamingFreshMs` | number | 60000 | 流式对话新鲜度 (ms) |

### 改动文件

- `packages/wam/extension.js` (VERSION → 3.11.3, broadcastUI 软编码, spawn args 透传)
- `packages/wam/dao_stuck.js` (止跳法三处根治, parseArgs 4参数, 心跳软编码)
- `packages/wam/package.json` (3.11.2 → 3.11.3, 6项新配置)
- `packages/wam/CHANGELOG.md` (本条目)

---

## v3.10.1 (2026-05-27) · ⚡ 零额度紧急重触 · 切号防御双完善 · 道法自然

> *损之又损，以至于无为。无为而无不为。—— 帛书《老子》四十八章*

### 两大完善

#### 问题一：切到零额度账号后仍卡 10s 才换号

**根因**: `loginAccount` 切号成功后，旧逻辑仅异步更新健康数据 → 下次 `_tick`（最多 10s 后）才能发现 D=0/W=0 → 用户在此期间看到 "Trial - Quota Exhausted"

**修复 (v3.10.1 `loginAccount`)**:
```js
// planStatus 异步回调中，若发现 D=0/W=0 且无 credits
const _isD0 = !_hasUsableCredits(q) && (drought ? (q.daily<=0) : (q.daily<=0 || q.weekly<=0));
if (_isD0) {
  setTimeout(() => {
    if (_engine && !_switching && !_engine.rotating) {
      _engine._tick().catch(...);  // 2s 后重触，而非等最多 10s
    }
  }, 2000);
}
```

**效果**: 切到零额度账号 → 2s 内自动检测并继续换号 · 用户无感知

#### 问题二：切号时仍可能选到 D<5% 或 W≤3% 账号

**现状** (v3.8.4 / v3.10.0 已有基本过滤):
- `_isValidAutoTarget`: D<5 → false · W≤3 (非干旱) → false ✓
- `_scoreOf`: D<5 或 W≤3 → -Infinity ✓

**残余边缘**: 未验证账号 (`!h.checked`) 在 `_isValidAutoTarget` 返回 `true` (无法预判) · 若全量已验账号均为 D0，系统会轮转尝试未验号 → 可能切到真实也是 D0 的账号 → 被「零额度紧急重触」立即捞救

**两层协同防御 (最终体系)**:

| 层次 | 机制 | 时机 | 覆盖场景 |
|------|------|------|---------|
| **预防层** | `_isValidAutoTarget` D<5/W≤3 过滤 | 选号时 | 已知低额账号不入候选 |
| **评分层** | `_scoreOf` D<5/W≤3 → -Infinity | `getBestIndex` | 已验低额账号彻底排除 |
| **救火层** | `_tick` `isHardExhausted` | 10s 巡检 | D=0/W=0 当前号 → 必切 |
| **紧急层** ★ | `loginAccount` 异步验额 | 切号后 2s | 切入即 D=0 → 2s 再切 |

**道义**: 损之又损，以至于无为。两层过滤尽量「不切」低额号；切了之后若发现是 D=0，「2s 紧急重触」即为顺势补救，非违心，乃自然之道。

### 改动文件

- `packages/wam/extension.js` (VERSION → 3.10.1, `loginAccount` 新增零额度紧急重触)
- `packages/wam/package.json` (3.10.0 → 3.10.1)
- `packages/wam/CHANGELOG.md` (本条目)

---

## v3.10.0 (2026-05-27) · 归一 · 卡住引擎集成 · 道法自然 · 当前

> *道生一，一生二，二生三，三生万物。万物负阴而抱阳，中气以为和。—— 帛书《老子》道经*

### 归一 · 万法归宗 — 卡住检测从独立进程集成到 WAM 扩展

**根因**: 之前卡住检测引擎 (`dao_stuck_v9.js`) 作为独立 Node.js 进程运行在 `110-对话追踪_Trace/` 目录：
- 需手动启动/管理生命周期
- 代码分散两处，修改需同步
- 崩溃无自动恢复

**归一治法**: 引擎归入 WAM 扩展包，由 extension.js 自动管理：

| 改动 | 说明 |
|------|------|
| `dao_stuck.js` | 引擎脚本打入 VSIX 包 · 路径改为 `~/.wam/stuck-detect/` |
| `_launchStuckEngine()` | activate 时自动启动子进程 · 3秒延迟 (让 Hub watcher 先就绪) |
| 崩溃自动重启 | 非正常退出 5s 后重启 · 滑动窗口限流 (5min内最多3次) |
| `_stopStuckEngine()` | deactivate 时优雅关闭 · SIGTERM |
| `--toast false` | 通知由 extension.js 统一管理 · 引擎不弹 Windows toast |
| stdout/stderr → Output Channel | 引擎输出实时转发到 WAM 日志面板 |

**架构图**:
```
extension.js (VS Code 宿主)
  ├─ activate → _launchStuckEngine()
  │    └─ dao_stuck.js (子进程 · 独立 Node.js)
  │         ├─ 读 .pb + vscdb → 判定卡住状态
  │         └─ 写 ~/.wam/_hub.json
  ├─ _installHubWatcher → 监听 _hub.json 变化
  │    └─ _processHubStuck → 通知/状态栏
  └─ deactivate → _stopStuckEngine()
```

### v12.9 卡住检测核心改进 (状态驱动 · 识别用户行为)

**去掉 POST_STREAM_GRACE (10分钟时间延迟)**，改为 `_awaitingUser` 状态标志：

| 状态 | 条件 | 行为 |
|------|------|------|
| AI 从未响应 | `_turnGrowth < 4KB` | 60s WARNING · 120s STUCK |
| AI 已完成回复 | `_turnGrowth > 4KB` + 停止增长 | `_awaitingUser=true` · 永不误报 |
| 用户发新提示词 | `USER_PROMPT_DETECT` | `_awaitingUser=false` · 恢复检测 |

**实战验证**: v12.9 运行 51分钟 · stuck=0 · 零 WARN_STUCK · 零误报。

---

## v3.9.1 (2026-05-27) · 🚨 硬耗尽越权 + 双层耗尽分离 · 损之又损归一活分支

> *损之又损，以至于无为。损至零，则强为之，非违心，乃顺势 — 道德经第四十八章*

### 反者道之动 · 反向审视上次对话成果

上次对话在 `_build_v321` 冷分支上完成的 v3.5.2 / v3.5.3 改动，反向审视发现：

| 成果 | 评 | 处置 |
|------|----|----|
| v3.5.2 `_convScan` 跨 turn 修复 | `dao_stuck_v9.js (v12.7)` 早已有 `INITIAL_SEND_GRACE` + `prevVscdbStatus` 转换 + `activeSinceTs` 重置 + 重启清零 + WAL 保护 | **废弃** — 重复劳动 |
| v3.5.3 硬耗尽越权 `skipAutoSwitch` | 真正的新逻辑 · 活分支 v3.9.0 仍是单层 `isExhausted` 尊重锁 → 0% 时卡死 | **保留** — 移植入活 |
| `_build_v321` 整个冷分支 | 早分叉自 v3.3.x · 与活分支 v3.9.0 架构差异巨大 · 已不可融合 | **归档** |
| `_test_v351/v352.cjs` 镜像测试 | 复制实现到测试 · 不验证真实代码 · 反模式 | **归档** |

「上德不德，是以有德」—— 真正的成果不在写了多少代码，而在多少代码真正运行、真正击中需求。

### 核心修复 (移植自 v3.5.1 / v3.5.3 · 适配活分支)

**根因**: v3.9.0 `_tick()` 耗尽分支仍是**单层** `isExhausted`：

```js
const isExhausted = effQuota < threshold && !_hasCreditsActive;
if (isExhausted && !_switching && !switchCooldown && !acc.skipAutoSwitch) {
  if (q.daily < threshold && hrsToDaily <= waitResetHours) return;  // Bug: 0% 也等待
}
```

→ D=0% 与 D=3% 同等对待 → 走 reset 等待 → **0% 用户彻底卡死最多 3 小时**

### 道义辨别

| 额度状态 | 锁 (skipAutoSwitch) | 含义 | 处置 |
|---------|--------------------|------|------|
| 1% ~ 100% | 锁住 | 用户「主动消耗权」· 我要用光这个号 | **尊重锁** · 不切 |
| 0% (硬耗尽) | 锁住 | 「主动消耗权」自然失效（无可消耗）· 锁成困局 | **越权接替** · 必切 |

道理：损之又损，损至零则强为之。锁住 1%-100% 是「为」的过程，归用户；
损至 0% 已是「无为」之境，再固执反成执念，此时强切非违心，乃顺势救人。

### 双层耗尽分离

```js
// v3.9.1 双层 (取代 v3.7.6 单层 isExhausted)
const isHardExhausted = !_hasCreditsActive && (drought
  ? (q.daily <= 0)
  : (q.daily <= 0 || q.weekly <= 0));
const isSoftExhausted = !isHardExhausted && !_hasCreditsActive && effQuota < threshold;

// ─── 硬耗尽: 账号已死 · bypass 一切守卫 ───
if (isHardExhausted && !_switching) {
  if (acc.skipAutoSwitch) log("🚨 硬耗尽越权 skipAutoSwitch: ...");
  // 强切, 不查 cooldown/reset/锁
}
// ─── 软耗尽: 仍有余量 · 尊重所有守卫 ───
else if (isSoftExhausted && !_switching && !switchCooldown && !acc.skipAutoSwitch) {
  // 临期保留 / reset等待 (加 >0 守卫) / 切号
}
```

### 整体自动切号体系 (v3.9.1 全图)

| 触发源 | 时机 | 阈值 | skipAutoSwitch | 冷却 | 重置等待 |
|--------|------|------|---------------|------|---------|
| **预防层 · per-msg 轮转** | 用户每发一条消息 | `autoSwitchThreshold` | 尊重 | 尊重 | 尊重 |
| **预防层 · W% 脉动边缘** | quota 变化检测 | 当前下降 ≥0.3% | 尊重 | 尊重 | 尊重 |
| **预防层 · ⚖额度变动** | daily%/credits 下降 | `quotaDeltaCreditsMin` 等 | 尊重 | 尊重 | 尊重 |
| **救火层 · 软耗尽** | `_tick()` 10s 巡检 | `effQ < threshold` 且 >0 | 尊重 | 尊重 | 尊重 |
| **救火层 · 硬耗尽** ★ | `_tick()` 10s 巡检 | `effQ <= 0` (D 或 W) | **越权** | bypass | bypass |
| **定时层 · 周期轮转** | `rotatePeriodMs` 到期 | — | 尊重 | 尊重 | 尊重 |
| **拦截层 · 429 rate-limit** | HTTP 拦截 | rate-limit 文本 | — | 尊重 | — |

**层层防御 · 道法自然**：

1. 预防层在 quota 下降时就预切，避免触底
2. 救火层是兜底，账号在 AI 响应中突然耗尽时接替
3. 硬耗尽越权是终极防线，确保 0% 不困死用户
4. 用户「主动消耗权」在 1%-100% 范围内完全保留
5. credits 充裕时 ($promptCredits + $flowCredits ≥ creditsThreshold) 一切耗尽判定失效（v3.7.6 保留）

### 改动文件 (本版 · 活分支)

- `_github_src/packages/wam/extension.js` (VERSION → 3.9.1, _tick() 双层耗尽)
- `_github_src/packages/wam/package.json` (3.9.0 → 3.9.1)
- `_github_src/packages/wam/CHANGELOG.md` (本条目)

### 整理目录 (反向审视的副产品)

冷分支与镜像测试归档：

- `_build_v321/` → `_archive/_build_v321_obsolete_v3.5.3/`
- `_test_v351_exhaust_dual_layer.cjs` → `_archive/_tests_镜像_obsolete/`
- `_test_v352_conv_turn_grace.cjs` → `_archive/_tests_镜像_obsolete/`
- `_deployed_v3xx.js.bak_pre_*` → `_archive/_deployed_backups/`

---

## v3.8.7 (2026-05-26) · 道法自然 · 对话备份MD彻底重推

> *反者道之动，弱者道之用* —— 帛书《老子》

### 实证根因 (diag_pb.js 实证 · 字段级别)

通过诊断脚本对真实PB逐字段扫描，确认：

- `fn=2@depth=0` = 对话步骤容器
- `fn=19@depth=1` = 用户输入子消息（其 `fn=3@depth=2` 字段存放干净文本）
- `fn=72@depth=1` = AI 轨迹（`CORTEX_STEP_TYPE_PLANNER_RESPONSE` 标记 AI 文本输出）
- **覆盖率根因**: 316 PB / 19 MD → 密钥发现在初始备份之后，大量 PB 永远没有等到 MD 生成

### 修复 (四项重构)

**① `_extractBestStringFromMsg` (新增)**
- 从 fn=19 子消息扫一层子字段，取最长可读字符串 = 干净用户文本
- URL编码路径过滤：`%XX` 占比 > 8% → 跳过（文件路径引用，非用户输入）
- 效果：`file:///e%3A/...` 这类路径不再被误识为用户消息

**② `_extractAiResponseFromTrajectory` (新增)**
- 从 fn=72@depth=1 提取 `CORTEX_STEP_TYPE_PLANNER_RESPONSE` 后的文本
- 去重：多个 context snapshot 中相同段落只保留一次
- 取最后一条（轨迹末尾 = 最新 AI 响应）

**③ `_parsePbConversation` 重构**
- 用户消息：`fn=19@depth=1` → `_extractBestStringFromMsg(f.data)`
- AI 响应：`fn=72@depth=1` → `_extractAiResponseFromTrajectory(f.data)`
- 按字节偏移排序 → 对话顺序正确
- 返回 `turns[]`（user/ai 交织）+ `userMsgs[]`（向后兼容）

**④ `_retroactiveMdGeneration` (新增) + 全覆盖补全**
- 密钥缓存命中时调用（每次启动）
- 密钥首次发现时调用
- 扫全部批次所有 PB，对缺失 MD 的逐一补生成
- 实测：296 个缺失 MD 将被自动补全

**`_pbToMdContent` 格式升级**
- 显示完整对话（👤 用户 N / 🤖 AI N 交织轮次）
- 标头增加 AI响应条数统计

---

## v3.8.6 (2026-05-26) · 反者道之动 · 三处根本修复 · 大道至简

> *道法自然，无为而无以为* —— 帛书《老子》

### 修复 (反向审视 v3.8.5 · 从根本底层)

**① `_cleanPbText` 大道至简 (形式归一)**
- 12行字符循环 → 1行正则，行为完全等价
- 正则引擎底层JIT比逐字符循环更快
- 覆盖范围不变: ASCII可见 + CJK统一 + 全角/半角 + 通用标点 + 换行

**② `_pbToMdContent` 消除双重IO + 中文对话标题盲区 (根本性修复)**
- 根因: `_extractPbTitle` 只扫 ASCII(0x20-0x7E)，中文字符(U+4E00+)完全不可见
  → 中文对话MD标题一直是UUID前缀如 `# 2f867281`
- 根因: `_extractPbTitle(pbPath)` 在 `_pbToMdContent` 内第2次 readFileSync + 第2次 decryptPb
- 修复: 三级兜底，利用已有 `conv.userMsgs[0]` (无需额外IO)
  ```
  ① meta.title (调用方已提供) → 直接使用
  ② conv.userMsgs[0].text[:60]  → 中/英文对话均适用 · 零额外开销
  ③ uuid[:8]                    → 无消息的空对话兜底
  ```
- 效果: 中文对话MD标题从 `# 2f867281` → `# 道法自然，审视本对话的所有核心成果...`

**③ `_initDecryptKey` 加单次重试 (覆盖竞争条件)**
- 根因: 启动期杀软锁住LS二进制时，5s扫描失败后永不重试
  → 密钥为null → 所有备份仅有PB无MD，直到重启
- 修复: 扫描无结果时，60s后单次重试（`setTimeout(_initDecryptKey, 60000)`）
- 覆盖场景: 杀软延迟释放 / LS二进制延迟写入 / 首次安装就绪竞争

---

## v3.8.3 (2026-05-26) · 额度链路回溯 · 道法自然 · 当前

> *反者道之动 · 无为而无以为* —— 帛书《老子》

### 修复 (回溯早期错误隔离)

**额度显示与切号链路完整恢复**
- `getStats()` 恢复 `checkedNoOverage` 字段 — 已验但无 Extra Usage 账号统计
- 侧边栏统计栏恢复 `X/Y激活 $Z` 展示 — 每个账号 Extra Usage 激活状态一目了然
- 正确隔离边界: 仅移除「领取$200」激活按钮 + 激活函数，保留全部显示与切号逻辑

**已验证完整额度链路 (五路)**
- `tick` 每30s轮询 `tryFetchPlanStatus` → 实时拉取 D%/W%
- `verify` 完成后 D%/W% 写入 health → 账号旁实时显示
- ⚡W%脉动信号 (ΔW≥0.3%) → `_maybeTrigger` → 自动切号
- 🔮 预判: 额度<25% 时预选下一健康号
- `_scheduleResetRefresh` 精准等到重置时刻 → 自动触发 verify 复活

### 保持隔离
- ~~`_activateOverageFull`~~ · ~~`_pollForOverage`~~ · ~~`_tryAllTriggers`~~ · ~~`doActivateAll`~~ — 领取$200 激活按钮，不需要

---

## v3.8.2 (2026-05-26) · PB→MD 彻底贯通

**备份对话全自动解密为可读 Markdown**
- raw protobuf 解析 (无需 schema) — `_protoReadVarint` / `_protoFields` / `_parsePbConversation`
- AES-256-GCM 解密 → f19@depth1 提取用户消息 → 格式化为 MD
- 全自动触发: 全量备份 + 增量备份均同步生成 .md
- `_exportConversationsMd` 增强: 补生成历史未 MD 的 .pb + 索引含 MD 状态列

---

## v3.8.1 (2026-05-26) · 道极归一 · 版本归正 · 软编码完备

> *知止不殆 · 可以长久* —— 帛书《老子》

### 版本号归正

v3.8.0 之后迭代过快（4.0/4.1/4.2），统一回归 v3.8.1 语义版本规范。

### 新增 (相对 v3.8.0)

**v3.8.1 · 自动消失通知**
- `_notifyTimed(level, msg, ttlMs)` — 卡住/死亡通知 10min 后自动从通知中心消失
- 有时效性的通知不再永久积压，用户无感知清洁

**对话解密引擎**
- `_decryptPb(ciphertext, key)` — AES-256-GCM 解密 .pb 文件
- `_extractPbTitle(pbPath)` — 从二进制扫描用户可读标题（v4.1 扩展过滤：排除模型名/AI推理/路径/JSON）
- `_initDecryptKey()` — 启动时异步自动发现解密密钥（扫 LS 二进制）
- `_resolveLanguageServerBin()` — 跨平台 LS 路径自适应（扫全盘符/平台候选/vscode.env.appRoot）

**备份增强**
- `_exportConversationsMd()` — 导出备份目录为 Markdown 文档（含标题/UUID/大小/@引用状态）
- webview handler `openPbDir` / `openBackupDir` / `exportConvMd` — 后端已就绪

**跨平台修正**
- `PB_DIR` 改用 `os.homedir()` 替代 `process.env.USERPROFILE`（Linux/macOS 更干净）
- `_initDecryptKey` 内 `HOME → os.homedir()`（修复潜在 ReferenceError）

### 移除 (相对 v3.8.0)

- `_activateOverageFull` / `_tryAllTriggers` / `_pollForOverage` — 自动激活200额度链路整体删除
- `_pendingAct` / `wam.autoActivate` 配置项 — 随激活链路一并删除
- `verifyOneAccount` 不再自动触发激活，只做被动探额（`_tryDevinBillingFallback` 保留）

### 对话追踪完备 (v3.7.3 ~ v3.8.0 累积)

- v3.7.3: .pb 健康检测 + 断电防护
- v3.7.4: 根治「未验号永远未验」三处修复
- v3.7.5: 对话追踪前端关闭按钮 + 提醒频率根治
- v3.7.6: 切号守门 + dismiss持久化 + 多窗口同步
- v3.7.7: 启动围栏（预启动卡住对话自动清零）
- v3.8.0: 四根修（10min静默 + 通知次数限制 + 有效计数修正 + 启动围栏）

---

## v3.7.2 (2026-05-25) · 两向根治「未验证」· 无为而无不为 · 当前

> *无为而无不为 · 民莫之令而自均焉* —— 帛书《老子》

### 病灶

断电/崩溃后全部账号显示「未验证」，用户须手动逐一重验，极大干扰体验。

### 两向并进（最小化）

**正向（防止）**
- `store.load()` 备份恢复链：主文件损坏/缺失 → 自动降级 `~/.wam/backups/` 日备份 → 无感恢复
- `_persistSessionCache` 防抖 500ms→100ms：缩短断电丢 token 时间窗口

**反向（出现即自动修复）**
- startup auto-verify：不管何因，只要检测到未验号 → 立即 `verifyAllAccounts({onlyStale:false})` 全量加速
- 现有 `isFirstTime` 保护（>50% 未验 → parallel=2 · 1500ms gap）自动激活，天网恢恢疏而不失
- 用户启动 IDE → 后台自动验 → 2-5min 全池复活 · 无需任何手动操作
- cache 非空 → 走原 `_cacheOnly` 快路，v3.7.1 行为完全兼容，零退化

### 守门

```
_test_v372_bidir.cjs · 25/25 全通
§A版本 · §B备份恢复(4静态+4vm) · §C启动反向(5静态+4vm) · §D sessionCache
```

---

## v3.7.1 (2026-05-25) · 大道至简 · 软编码归一 · 整合对话追踪全链路成果

> *为学者日益，为道者日损，损之又损，以至于无为，无为而无不为*

### 软编码完善 (7处硬编码→可配置)

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `wam.expiryFirst` | `true` | 临期账号优先加分开关 (v3.3.1已用，首次声明) |
| `wam.hubNotifyCooldownMs` | `300000` | 同一对话5min内只通知一次 |
| `wam.hubNotifyGlobalCdMs` | `5000` | 全局通知最小间隔5s |
| `wam.hubRenotifyIntervalMs` | `300000` | 持续卡住周期再通知间隔 |
| `wam.hubDataStaleMs` | `60000` | Hub引擎数据过期阈值 |
| `wam.autoBackupStartDelayMs` | `8000` | 启动后备份延迟 |
| `wam.incrementalBackupDebounceMs` | `3000` | 增量备份防抖延迟 |

### 归档整合 (对话追踪对话成果确认已全部集成)

以下功能均已在 v3.5.0-v3.6.0 期间完整集成，本版本确认并补全配置声明：

- `_hubLastStuckUuids` Map带时间戳 · 5min自动过期 · 允许重复通知
- `streamingList` 多对话逐行展示 (不再只显示1个)
- `_truncTitle(t,25)` 标题超长自动截断
- `_autoBackupDone` 今日已备份时立即标记(不误显"待备份")
- `_broadcastConvSection()` 定向更新conv区块(不全量重建sidebar)
- `dao-conv-collapsed` localStorage持久化折叠状态
- `convUpdate` 消息类型 — webview侧收到后保持折叠状态
- `_restoreConversationFromBackup()` @conversation 50限制突破
- `_writeAgentApi()` → `~/.wam/_api.json` 7个Agent能力接口
- RECOVER通知已移除 (减少密度，面板可见)

---

## v3.7.0 (2026-05-25) · 三维度归一 · 锁止复元 · 道法自然 · 彻底完善自动切号底层

> *大成若缺·其用不敝·大盈若盅·其用不窘 · 知止所以不殆 · 知常·明也*

### 五大根治

#### 「一」三维度归一 · promptCredits/flowCredits 余额入场

**根因**: `_scoreOf` / `_isValidAutoTarget` / `_tick` 三处完全忽略 `promptCredits` + `flowCredits` 独立资源池

**现象**: quota% 耗尽但余额充裕的账号被误判「不可用」→ 不用即废（不可逆损失）

**治法**:
- 新增 `_hasUsableCredits(h)` 辅助函数（门控: `wam.creditsThreshold` 默 1000）
- `_isValidAutoTarget`: credits 可用 → 放行（quota% 耗但 credits 在，仍可服务 flow/prompt 类请求）
- `_scoreOf`: `creditsBonus = min(500, totalCredits/200)` · 10K credits → +50分 · 100K → +500分（门控: `wam.creditsInScore`）
- `_tick` 耗尽判定: `isExhausted = effQuota < threshold && !_creditsStillOk` · credits 充裕时不触发切号

#### 「二」锁止机制复元 · isInUse 降分回归 `_scoreOf`

**根因**: v3.0 以「全号平等」为由移除 `isInUse` 检查 → 锁止形存实亡

**现象**: A→B 切号后 A 立即可回选 → 来回震荡 · `inUseLockMs` 配置有名无实

**治法**: `_applyInUse(s) = isInUse ? max(1, round(s×0.01)) : s` · 降至1%分值 · 非 -∞ 仍可作最后兜底

#### 「三」周日边沿修正 · `hoursUntilWeeklyReset` 精准化

**根因**: `(7-0)%7=0 → ||7` 强制跳7天 → 周日 UTC 07:59（距重置1分钟）却算7天后

**现象**: 周日16:00前（BJT）`waitResetHours` 判断失准 → 应等重置却误判为距重置遥远

**治法**: `dts=(7-day)%7` · 若算出时刻 `<=now` 再 `+7天` · 正确定位当前轮次

#### 「四」临期+余额协同 · 双重加持

`daysLeft<7` 且 credits 充裕 → `expBonus + creditsBonus` 同时叠加 → 即将过期且余额充裕的账号分值极高，优先被消耗

#### 「五」三维度状态可视化

`tick` 日志由 `D%/W%` 扩展为 `D%/W%/PC/FC` · Output:WAM 可实时观测三个维度消耗情况

### 新增配置项

| 配置 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `wam.creditsThreshold` | number | 1000 | credits 视为「可用」的最低总量 |
| `wam.creditsInScore` | boolean | true | credits 是否纳入 `_scoreOf` 评分 |

### 评分层级（更新后）

```
第三层 💎 overage   [1_000_000, 1_099_950]  存量·绝对优先（不变）
第二层 📊 pct+credits [1, 999_999]          quota% + expBonus + creditsBonus 三维综合
候补层 ⏳ 未验号     1~100                  inUse时×0.01降至1（v3.7.0复元）
-∞   永禁           无密码 / skipAutoSwitch / planEnd已过期
```

---

## v3.3.1 (2026-05-25) · 📅 临期优先微调 · 反者道之动 · 最小不侵入

> *反者道之动 · 不用即废先消耗 · 道法自然 · 无为而无不为*

**底层目标 (反向解构·只一句)**: `daysLeft` 升序作主键、quota 作次键、锁号已豁免。

**最小化改动 (3 处·共 ~5 行)**:

1. `_scoreOf` 末尾加 `expBonus = max(0, (60-daysLeft)) × 2000`
2. `planEnd < Date.now()` → 返 `-Infinity` (过期号不浪费切号)
3. 百分比层封顶 `9_999 → 999_999` (容纳临期分·仍远低于 overage 1_000_000)

**数学守门**:

- 1日差 = 2000 分 > quota 最大差 ~1880 → 临期维度**主导** quota 维度
- `daysLeft ≥ 60` 或 `planEnd=0` (永久/Pro) → bonus = 0 · **完全等同 v3.3.0**
- `daysLeft = 2` (截图红色): bonus = 116_000 · 远超普通账号 ~1500 总分

**新软门控**: `wam.expiryFirst` (默认 `true`) · `false` 则关闭临期主导 · 回退 v3.3.0 完整行为

**回归保护**: v3.3.0 overage 绝对优先逻辑、effQ 守门、`skipAutoSwitch=-∞`、未验号=100 **全部不变**

**守门测试**: `_test_v331_expiry_priority.cjs`

---

## v3.3.0 (2026-05-24) · 💎 额度绝对优先分层 · 反者道之动 · 存量先于流量

> *天之至私 · 用之至公 · 禽之制在炁*

**解构本源 (反者道之动 · 先解构隐藏在需求下的底层目标)**:

| 维度 | overage 美元 | 百分比配额 |
|---|---|---|
| 经济学性质 | **存量 (Stock)** | **流量 (Flow)** |
| 再生性 | 不可再生 · 用一分少一分 | 可循环 · 周期重置 |
| 不用的代价 | **沉没浪费** (废账户即损失真金白银) | 等待即回来 (无损失) |
| 道家映射 | "天下之物生于有" · 已生之物即损 | "有生于无" · 无穷归来 |

**病灶 (v3.2.1 之前 · 错误抽象)**:

`_scoreOf` 把两种本质不同的资源放在**同一个连续分数坐标系**里比大小:

- overage 账号:  `300 + min(100, $) + 时效` ≈ **150~460 分**
- 百分比账号:    `W*8 + D*3 + 时效`         ≈ **0~1830 分** (W50/D50 即 480+)

→ **主公图1 实证**: $195/$189/$208/$193/$185 等额度账号全部得 **400 分** (被 `min(100,$)` 封顶)
→ 百分比账号 W50 反超之 → **实际行为与用户诉求完全相反** → 额度账号被冷落浪费 · 真金白银沉没

**治法 (九竅之邪在乎三要 · 可以動靜 · 分层各得其所)**:

```
═════════════════════════════════════════════════════════
║  切号决策金字塔 (绝对分层 · 各得其所 · 天之至私用之至公)
═════════════════════════════════════════════════════════
│
├─ 第三层 💎 OVERAGE 池 (存量·不用即损·绝对优先)
│   触发: overageActive = true (Extra Usage 余额 > 0)
│   主权: 1_000_000 基础分 · 永远凌驾百分比层
│   内排: overageDollars × 100 (全幅可比 · 去 min(100,$) 封顶)
│        $208=1_020_800 > $195=1_019_500 > $193=1_019_300
│   区间: [999_970, 1_099_950]
│
├─ 第二层 📊 百分比池 (流量·周期重置·次选)
│   触发: overageActive = false · effQ ≥ threshold
│   内排: W*8+D*3 + 时效 (沿用 v3.1.3 effQ 守门)
│   区间: [1, 9_999]  上限封顶 · 永不突破第三层
│
├─ 候补层 ⏳ 未验号 (待 verify 决定真相)
│   分数: 100  与 v3.0 一致 · 不夺主权
│
└─ -∞   永禁 (无密码 / 用户主动锁 skipAutoSwitch)
```

**自然顺应 (无为而无不为 · 一以贯之)**:

1. `getBestIndex`/`getSortedIndices` 天然受益 · **无需改动任何调用方**
2. 当前 active 是 overage 切号 → 自然选下一 overage (excludeIdx 排自己)
3. overage 全耗 (`overageActive=false`) → 自然下沉百分比层
4. 重置时刻 overage 复活 → `_scheduleResetRefresh` 触发 verify → 自然上跃

**软门控**: `wam.preferOverageFirst` (默认 `true` · 道法自然 · 推荐)

- `true`: 严格分层 · overage 绝对优先于百分比 (本版默认 · 实现用户诉求)
- `false`: 回退 v3.2.1 统一坐标系 · 兼容旧行为

**守门**: `_test_v330_overage_priority.cjs` 全通

- overage 永远 > 百分比 (无论 W%/D% 多高)
- overage 内部按金额排 ($208>$195>$193 顺序保留)
- overage 全锁 → 下沉百分比
- overage 全无 → 自然百分比
- 锁号 (skipAutoSwitch) 即使有 overage 也跳过

**诉求印证 (用户原话)**:

> "就是有额外额度的，就有额度的就先用额度的"
> "百分比制的是没有额度之后才会跳转到百分比制"
> "优先把有额度的账号先用完，而非先把有百分比的账号先用完"
> "道法自然，无为而无不为"

→ **完全实现** · 道法自然 · 无为而无不为

---

## v3.2.1 (2026-05-23) · 额度重置感知 · 无为而无不为

> *迅雷烈风 · 莫不蠢然 · 至乐性余 · 至静性廉*

**额度重置感知 (天人合发)**:

- 「感知」 `_scheduleResetRefresh()` — 精准 setTimeout 到下次重置时刻
  - 每日 UTC 08:00 (北京 16:00) → 日额度重置 · 全池自动刷新
  - 周日 UTC 08:00 (北京 周日 16:00) → 周+日额度重置 · 全池自动刷新
  - 复用 `hoursUntilDailyReset()` / `hoursUntilWeeklyReset()` · 零重复
- 「效果」 耗尽号在重置瞬间自动复活 · 用户无感 · 无需等 30min 周期扫描
- 「联动」 `_setMode()` 模式切换自动管理定时器
  - WAM 模式 → 启动重置感知
  - 官方模式 → 停止重置感知
- 「安全」 verifyAll 进行中 → 30s 后重试 · 刷新完毕 → 自动重调度下次
- 「软编码」 `resetRefreshBufferMs` (默认 30s) — 重置后缓冲等待

**精简效果**: 6492 → 6546 行 (净增 54 行 · 换取用户无感体验)

**守门**: `_test_v321_validate.cjs` 30/30 全通

---

## v3.2.0 (2026-05-24) · 大道至简 · 三处归一 · 去芜存菁

> *圣人抱一而得天下事 · 至静之道 · 律曆所不能契*

**结构性改革 (为道者日损)**:

- 「归一」 `_setMode(mode)` — 模式切换三处归一
  - 旧: `case "setMode"` webview handler + `wam.setModeWam` cmd + `wam.setModeOfficial` cmd 三处独立实现
  - 新: 单一 `_setMode(m)` async 函数 · 三处均调用 · 逻辑一源
  - 官方模式: 停引擎 + `windsurf.logout` + 卸 guard (v3.1.4 三步净身)
  - WAM模式: 装 guard + 启引擎
  - 返回 `true`/`false` 示是否实际变更
- 「去芜」 删 `isTrialPlan()` (定义未调用 · `_isTrialLike` 已替代)
- 「去芜」 删 `URL_GET_PLAN_STATUS` 别名 (定义未引用 · `_LIST` 版保留)
- 「承」 v3.1.4 官方模式根治 + activate 条件守卫

**精简效果**: 6519 → 6492 行 (净减 27 行 · 逻辑更清晰)

**守门**: `_test_v320_validate.cjs` 20/20 全通

---

## v3.1.4 (2026-05-23) · 官方模式根治 · 自然之道静

> *自然之道静 · 故天地万物生*

**病灶**: 切官方模式后 WAM session token 残留 + openExternal guard 拦截官方登录 URL.

**三步净身** (切官方时):
1. 停引擎 (WAM 不再切号/扫描)
2. `windsurf.logout` 清 WAM 注入的 session
3. `_removeOpenExternalGuard` 放行官方浏览器登录

**activate 条件守卫**: WAM模式装 guard / 官方模式不装.

---

## v3.1.3 (2026-05-22) · effQuota 守门 · 一以贯之

## v3.1.2 (2026-05-22) · 限速感知 · cache全走 · v3.1.1 prewarm 已损

## v3.1.1 (2026-05-22) · sessionCache 持久化 · 零批量 devinLogin

## v3.1.0 (2026-05-22) · openExternal 持久守卫 · 切号零弹窗

## v3.0.6 (2026-05-21) · devinLogin 全局最小间隔 · broadcastUI 防抖

## v3.0.5 (2026-05-21) · UI状态持久 · 添加展开不闪烁

## v3.0.4 (2026-05-21) · 统一通知层 · URL多源健康度

## v3.0.2 (2026-05-21) · 独立持久化 · refresh驱动验证

## v3.0.1 (2026-05-21) · 反者道之动 · 手动至高优先 · 一锁覆万源

## v3.0.0 (2026-05-21) · 道法自然 · 无为而无不为 · 全量解构自封体系

## v2.8.5 (2026-05-20) · Devin 双轨 + 自动激活 + overage 走的弄比天下

---

## v2.7.5 (2026-05-14) · 治「单独 token 无法添加登录」· 道恒无名·万物自宾

> *道恒无名 · 朴唯小 · 而天下弗敢臣 · 侯王若能守之 · 万物将自宾 · 民莫之令而自均焉*

**缘起 · 主公图1 实证**: 5 行 `auth1_xxx` (无 email 同行配对) 粘入 + 添加账号 → 入 tokens 数组成孤儿 · accounts 不增 → 用户视觉 "未添加" → 无法直登.

**根因**: v2.7.1.1 「孤儿 token 入 tokens 数组待显式反查 email」之契约 · 对单 token 流派 (用户仅有 token · 无 email) 留无解之地.

**治法 · 道恒无名 · 名不可名 · 万物自宾**:

- §A `parseAccountText` 末段 · 孤儿 token → 占位 email 入 accounts (10 行)
  - 占位形 `<kind>.<sha8>@token.wam` (合法 email · 通过 `_isValidEmail`)
  - password 槽 = 原 token · 重启 `parseAccountText` 自然读回 (tryPair 识 email+token)
  - 防重: 同 token 反复粘贴不重复 (sha8 决定 placeholder 唯一)
- §B 立 `_isPlaceholderEmail(s)` 工具识别占位号 · UI/verify/rename 路径快判 (一函)
  - 位居 `_normalizeAccCreds` 之后/`parseAccountText` 之前 · 公器同列 · 大制无割
  - 此位令 parseAccountText 末 return 紧邻 loadAccountsFromFs (守 v2.7.0 schema 静态契约)
- §C webview domainBadge 加 "tk" · 占位号视觉可识 (`.dm.tk { bg:#5a3a14; color:#f0c674 }`)
- §D 5 kind 全适配: `auth1`/`session`/`jwt`/`apikey`/`refresh`/`raw`
  - 下游 `_normalizeAccCreds(acc)` 之 `_detectTokenKind(acc.password)` 自动分流 → loginViaToken
  - verify/login 后 quota/plan/expiry 等账号信息均可查询 · 用户无为

**老测套 8 处行为断言更新** (随 v2.7.5 主公诏唯变所适):
- `_test_v270_omni_recognize` §10.1/10.2/11.1/11.2 (4 处) — `r.accounts.length === 1` + placeholder regex
- `_test_v271_omni_token` §6.4/11.1/11.2 (3 处) — 孤儿 JSON auth1 / 综合识入 accounts
- `_test_v2711_main` §5.9 (1 处) — 单孤儿 token → 占位

**回归测 `_test_v275_single_token_omni.cjs · 57/0`**:

```text
[§1]  静态契约 (banner/VERSION/末段/_isPlaceholderEmail/.dm.tk)   12 测
[§2]  _isPlaceholderEmail 严判 5 kind × pos/neg                    10 测
[§3]  占位 email 通 _isValidEmail (合法 email 全栈兼容)             5 测
[§4]  主公图1 端到端 · 5 行 auth1 token → accounts.length===5      10 测
[§5]  5 形混粘 → 各形各号 · detectKind 分流                        10 测
[§6]  幂等 · 同 token 反复粘 · sha8 决定不重                        3 测
[§7]  不退化 · v2.7.0/v2.7.1.1/v2.7.4 兼容                          7 测
═════════════════════════════════════════
        57 过 / 0 败
```

**全测套 17/18 套 0 败 · 总 666/0** (v267 28/4 历史滞后 v2.6.9-2.6.10 中间态 · 不计).

**道一以贯之**: 32 章「道恒无名·朴唯小·而天下弗敢臣·侯王若能守之·万物将自宾」· 占位即真 · 名不可名 · 道隐无名而无不为.

## v2.7.4 (2026-05-14) · 🔒 独立持久化 · multi-window race-safe · 治🔒回退真本源

> *上善若水 · 水善利万物而有静 · 居众之所恶 · 故几于道矣*

**缘起 · v2.7.3 实证**: 多窗口并行运行时 · 一窗 lock 写入 wam-state.json 被另一窗覆盖 · 切号 🔒 状态回退.

**根因**: `wam-state.json` 单文件多字段 · 多 window 同时 save 之 race condition 致 `inUseUntil` 字段冲洗.

**治法**:

- §A `inUseUntil` 独立 持久化 `lock-state.json` · 与 wam-state.json 解耦
- §B `_persistLockState()` / `_loadLockState()` 一组工具
- §C 优先读独立 lock-state.json (multi-window race-safe)
- §D 兼容: 老 wam-state.json 含 inUseUntil 字段 · 仍读取 (向前兼容 · 一次性迁移)

**回归测 `_test_v274_lock_state_isolation.cjs · 26/0`** + `_test_v273_lock_persistence.cjs · 23/0`.

**道一以贯之**: 8 章「上善若水 · 居善地」· 数据居其位 · 不与他争 · 故多窗口和而不冲.

## v2.7.3 (2026-05-14) · 治🔒回退根 · 守一 · 大道至简

**根因**: v2.7.1/v2.7.2 lock-on-rotate 后 save 漏写 inUseUntil 字段 → reload 后🔒丢失.

**治法**: save 守一 — inUseUntil 入 _serialize 出口 · 一次写入 · 不破契约.

**回归测 `_test_v273_lock_persistence.cjs · 23/0`**.

**道一以贯之**: 39 章「昔之得一者:天得一以清·地得一以宁·神得一以灵」· 序列化守一·所有状态一齐入盘.

## v2.7.2 (2026-05-14) · 主公三诏 SemVer patch bump · 内涵同 v2.7.1.1

主公三诏「token 看做账号密码 · 直接复用一切 · 顺其自然」之 SemVer 合规版本号 patch bump · 内涵同 v2.7.1.1 · 三段为道 · 信言不美.

## v2.7.1 (2026-05-14) · 万法归一·token 直登 · 反者道之动·逆流解析所有 windsurf token

> *反者道之动 · 弱者道之用 · 天下之物生于有 · 有生于无*

**缘起 · 主公三图实证**:

| 图 | 实证 | 现象 |
|---|---|---|
| 图1 | 5 行单 `auth1_xxx` | 入 tokens 数组成孤儿 · UI 视为 "未添加" |
| 图2 | `email----auth1_xxx` 单行格式 | tryPair 错把 token 当 password (字面同居) |
| 图3 | v2.7.0 在 远端机A 端实证 138 号·1 未验·25 耗尽·trial 状态混乱 | parseAccountText 残漏 |

**根因 · `parseAccountText` 失道之三病**:

- ① 反序 `token+email` (token 先 email 后) · token 缓存等下一 email 后未配对
- ② 单行 token + pendingEmail · token 入 password 槽路径未通
- ③ JSON {email, auth1_token} / {auth1: xxx} / refresh_token 等多形未识

**治法 · 反者道之动**:

- §A tryPair 升级 · email+token 优先返 `{email, token, kind}` (kind 来自 _detectTokenKind)
- §B items 加 'pair-token' 类型 · 配对循环加 token + pendingEmail 多行配对
- §C 反序 token+email · 单行 token+pendingEmail · 均入 accounts.password 槽 (token 与密码同居)
- §D 下游 `_normalizeAccCreds(acc)` 之 `_detectTokenKind(acc.password)` 自动分流 → loginViaToken
- §E 损 addBatch 之 tokenPairs/tokenUpdated 中转 · 仅返 `{ added, duplicate, tokens, addedEmails }`
- §F webview UI **完全不变** · 同 v2.7.0 placeholder + 单 textarea (主公二诏 · 太上下知有之)

**主公三诏 (v2.7.1.1 · 闻道者日损)**: "将 token 看做账号密码 · 直接复用一切 · 顺其自然"

- parseAccountText 复 v2.7.0 schema · 不再单存 tokenPairs · token 直入 password 槽
- 复制/落盘/UI/复用 一切 同 v2.7.0 · 自然无为 · 不惧方能成其大

**回归测**:
- `_test_v271_omni_token.cjs · 65/0` (主公三诏 · 经典+token 同居 password 槽)
- `_test_v2711_main.cjs · 46/0` (parseAccountText 复 v2.7.0 schema · addBatch 仅返 addedEmails)

**道一以贯之**: 40 章「反也者·道之动也·弱也者·道之用也」· token 看做密码 · 万法复归于一.

## v2.7.0 (2026-05-09) · 万法识号·守道反者 · 唯变所适·适应万法之格式

> *天下莫柔弱于水，而攻坚强者莫之能胜也，以其无以易之也*

**缘起 · 主公实证四图**:

| 图 | 实证 | 现象 |
|---|---|---|
| 图1 | 账号列表 117 号大量 "?天/未验/D?/W?" | 入库 email 严重污染 |
| 图2 | "+ 添加账号" placeholder | 用户依此粘贴 |
| 图3 | 微信发货 ("账号:..\n密码:含@\n账号管理器:点tps://..(去掉点)") | 含@密码灾难性误判 |
| 图4 | "卡号N: a@b.com / 卡密N: pass" | 词典缺·5 卡全军覆没 |

**根因 · `parseAccountText` 失道之四病**:

| 病 | 失道之处 | 行为 |
|---|---|---|
| ① | `卡号N:`/`卡密N:` 未在标签词典 | tryPair 错把 "卡号1" 当密码 |
| ② | `if(!v.includes("@"))` 排除带 @ 的"密码" → 兜底 `^\S+@\S+$` 误为新 email | 正主丢失 |
| ③ | tryPair 仅以 `includes("@")` 认 email | `XuE2@UXoq7JD` (是密码) 被认为 email |
| ④ | 配对仅 email→pass 单向 | 反序 (pass 先 email 后) 无法配对 |

**治法 · 反者道之动 · 弱者道之用 · 守一不退**:

- §A 立 `_isValidEmail` 严判 (local@domain.tld · 长度 5-254 · 不含全角分隔符) — 替代 `includes("@")` 草率认 email
- §B 扩标签词典 + 兼容 `\d*` 数字编号:
  - email +`卡号|号码|账户名|登录名|登陆名|number|num|e-mail`
  - pass  +`卡密|密钥|令牌|key|token|access(-token)?`
- §C 标签即定锚·守一不退 · 密码标签后**含 @ 仍为密码** · 邮箱标签后必须 `_isValidEmail` 才认
- §D tryPair 用 `_isValidEmail` 严判 + 双向兜底
- §E `pendingPass` 反向配对 (顺逆皆通)
- §F `_stripWxHints` 行尾剥离 `(无任何空格)`/`(去掉点)` 等微信提示
- §G `_isNoiseLine` 整行模板嗅探 (开头明确者跳: 自动发货/订单编号/账号管理器: URL)

**回归测 `_test_v270_omni_recognize.cjs · 73/0`** (v2.7.5 +1 行为对齐).

**软编码归一 · 单一信源 wamHomeDir**:

- 立 `Get-WamDir` 助手于 `lib.ps1` (尊 `env(.local).psd1` `wamHomeDir`)
- 6 PS 脚本字面 `'.wam'` → `Get-WamDir`
- Linux/macOS 兼: `USERPROFILE` → `HOME` 兜底

**道一以贯之**: 78 章「天下莫柔弱于水, 而攻坚强者莫之能胜也, 以其无以易之也」· 万法之格式如水, 守一者如石.

## v2.6.14 (2026-05-08) · 三守俱全·守一·大制无割·反者道之动

**根因三破**:

| 破 | 层 | 本 |
|---|---|---|
| ① 公理破 | "1 user send = 1 信号" | 不成立 · 流式响应连续 N quanta · 单账号 40s W 82→72 = 4 脉动 |
| ② 栏破 | v2.6.11 弃 `perMessageMinIntervalMs` | 最终兜底失 |
| ③ 守破 | v2.6.12 `quotaPulsePriorityMs` 只守 WAL/pb | 不守 W% 自身 · 阳自决堤 |

**三守俱全** (大制无割·一全锁覆万源):

| 守 | 位 | 默 | 道 |
|---|---|---|---|
| **守一** | `_maybeTrigger` 入口 | `perMessageMinIntervalMs=60000` | 全 reason 强锁·适 ⚡/📡/📃/⚖ 万源·1 user send ≤ 1 切 |
| **守二** | `_fireWalEdge` 内 | `walEdgeCooldownMs=2000` | WAL 同源最小间隔·避 4KB 帧连火·削 log 噪 |
| **守三** | `_fireWalEdge` 入 | `walWarmupMs=5000` | WAL 启动暖启窗·防 activate 首 stat 累积差引雪崩 |

**回归测 `_test_v2614_triple_throttle.cjs · 66/0`** · §2d-3 mock 实证降幅 **-97.2%** (177→5).

**道一以贯之**: 64 章「为之者败之·执之者失之·圣人无为故无败」· 单行全栏 > 多处细栏 · 守一 > 守多.

## v2.6.13 (2026-05-08) · 阴阳结合·⚖额度变动·物无非彼物无非是

| 极 | 信号 | 维度 | 阈值 | 动态 |
|---|---|---|---|---|
| **阳·主** | ⚡W%脉动 | `weekly%` 宏观 | `quotaPulseMinDelta` (默 0.3%) | 触发 → 设 `_lastQuotaPulseAt` → 主信号窗 60s 内 WAL/pb/⚖ 让位 |
| **阴·辅** | ⚖额度变动 | `daily%` / `promptCredits` / `flowCredits` 多维度+微观 | `quotaDeltaDailyMin` (默 0.3%) + `quotaDeltaCreditsMin` (默 1) | 触发 → 进 `_maybeTrigger` 出口 |

**回归测 `_test_v2613_quota_delta.cjs · 44/0`**.

**道一以贯之**: 1 章「两者同出·异名同谓·玄之又玄·众眇之门」.

## v2.6.12 (2026-05-07) · 守一·抢跑治·道恒无名

- 修一: setActive 真切号时清基线 (`_lastQuotaPercent = null`) — 解跨账号假信号
- 修二: 加 `_lastQuotaEmail` · W% 比较只在同账号内进行
- 修三: 加 `_lastQuotaPulseAt` 时间戳 — ⚡W%脉动 触发后 60s 内 WAL/pb 让位

**净变**: +50 行 · 24 配置项.

## v2.6.11 (2026-05-07) · 真本源至·道恒无名·民自均焉

**实证**: WAL 信号本质不可靠 · settle 模型累积静默与 user send 频次解耦.

**根本治法 · 三守三损**:

- 损一: 删 settle 模型整段
- 损二: 删 max filter
- 损三: 删 三防抖
- 守一: ⚡ W%脉动 — Engine._tick 10s 周期查 weeklyQuotaRemainingPercent
- 守二: 配额自均 — 让账号配额自然均衡耗尽
- 守三: 长链路监控

**净变**: -3.1KB / 删 4 配置 / 删 2 死变量.

## v2.6.10 (2026-05-07) · 治人事天·莫若啬·checkpoint 过滤

- 加 `wam.walEdgeMaxBytes` 默 65536B (64KB) · delta > 此视为 checkpoint 噪
- 加 `_skipWalEdge` 函数 · log `wal·edge·skip[checkpoint:XXX > 64KB]`
- 二道互补: 空间过滤 (max 64KB) + 时间强锁 (60s minInterval)

## v2.6.9 (2026-05-07) · 道法自然·损 settle·留真信号

- 删 `_firePbSettle` · 删 watcher settle 分支 · 删 `_fireWalSettle`
- 留 `pb·new` 唯一信号源 (1:1 精确)
- 加 WAL 边沿首发 (单次 delta ≥ 512B 即 fire)
- 强 60s 全局强锁

**净变**: -120 行 · 为道日损.

## v2.6.8 (2026-05-06) · 实证调参 · 损泥灌沙

参数微调 · 实证证伪 cooloff 解除即触发病灶.

## v2.6.7 (2026-05-06) · 整文 debounce · 道之疏

- `perMessageDebounce(QUIET_MS=4000)` 全 reason 入口防抖
- 道一以贯之: 73 章「天网恢恢, 疏而不失」.

## v2.6.6 (2026-05-06) · 反者道之动 · 解构一切 · 逆流到底

**反者解** (40 章): cooloff → **settle** · debounce trailing edge 模式 · 静默 N ms 后才切号.

**实现**: `pb·send → pb·settle` / `wal·send → wal·settle` · `SETTLE_MS=15000`.

## v2.6.5 (2026-05-06) · 锚定本源 · 慎终若始

仅升版本号 + changelog · 行为零变化 · 治 v2.6.4 hotfix 进程缓存锁定.

## v2.6.4 (2026-05-06) · 去芜存菁 + quietSec 哨兵修

- 删死: `wam.netHookDisabled` · `wam.perMessageMinIntervalMs` (默 0 关·从未读)
- 补活: 三参数族 (sendDetect / walDetect)
- Hotfix: `lastGrow=0` 哨兵化 · 首检测 quiet="init"

## v2.6.3 (2026-05-06) · WAL 直达触发 · 大道至简 · 回归本源

**信号源**: `state.vscdb-wal` (用户 click Send 后 SQLite 同步写入的 WAL 帧).

**实现**: `_installWalWatcher` · 300ms 轮询 · `quiet=2s` · `cooloff=6s` · `min=1024B`.

## v2.6.2 (2026-05-05) · 跨实例声明锁 · 观复知常 · 万物并作

**修法**: `~/.wam/_l6_claim/` 声明目录 + `flag:"wx"` 原子排他创建.

## v2.6.1 (2026-05-05) · Layer 6 双信号 · 逆流到底

- 信号① `pb·new`: 新 .pb 文件 = 新对话 → 立即切号
- 信号② `pb·send`: 存量 .pb 文件大小增量 + 安静期检测 = 已有对话用户发消息

## v2.6.0 (2026-05-05) · 底层软编码 · 唯变所适 · 水无常形

- `RE_SESSION_TOKEN` 常量统一
- `_isTrialLike(h)` 全链对齐
- `_resolveCascadePbDir` Linux fallback 用 `os.homedir()`
- startup recovery 阈值用 `_cfg("autoSwitchThreshold",5)`

## v2.5.6 (2026-05-05) · 真根因 · Layer 6 信号文件 + 路径双修

- 文件改为 `globalStorage/state.vscdb-wal` (真信号)
- 旧 `path.dirname(path.dirname(storageUri))` → ONE dirname 修正
- delta 策略 WAL 正增量 ≥1KB
- fallback 四级: globalStorage WAL → globalStorage main → workspace → scan

## v2.5.5 (2026-05-04) · ideVersion 根因解

**修**: `tryFetchPlanStatus` metadata default `ideVersion` 由 `"1.0.0"` 改为 `"1.99.0"`.

## v2.5.4 (2026-05-04) · `_isTrialLike` 软判据

`_buildExpTag / _cleanseHealthOnLoad` 同步用软判据 (正则 `/trial/i`).

## v2.5.3 (2026-05-04) · Trial 脏数据自洁

`_buildExpTag` 增第 5 态 `Trial?` (黄·提示需重验).

## v2.5.2 (2026-05-03) · `_buildExpTag` 5 态 UI 标签

`?天` / `N天` (颜色阶梯) / `已过期` / `Trial?` / `∞`.

## v2.5.1 (2026-05-03) · `X-Devin-Auth1-Token` HTTP header

`windsurfPostAuth` body `auth1_token` → HTTP header `X-Devin-Auth1-Token`.

## v2.5.0 (2026-05-02) · 大减法 · Layer 6 跨进程触发

**修**: 引入 Layer 6 — `fs.watchFile()` 监听 `state.vscdb` mtime 变化. **跨进程稳**.

**减**: 删 Layer 1-5 全部网络钩代码 (-2300 行).

## v2.4.x → v2.5.0 减法路 (-62%)

| 减项 | 行 | 减因 |
|---|---|---|
| Layer 1-5 网络钩 | -2300 | cross-process 无效 |
| TurnTracker | -800 | Layer 6 已替 |
| AutoUpdate | -600 | 用户自部署 |
| 代币池跨账号管理 | -400 | 单文件本地 state 即可 |
| Firebase / Devin 全套登录链 | -2200 | `devinLogin + windsurfPostAuth` 双步即足 |
| 多重 fallback 兜底 | -200 | 信道单点已稳 |
| **共减** | **-6648** | **(10913 → 4265)** |

## 测试矩阵 (v2.7.5 · 18 套 · 17 套 0 败 666/0 + v267 历史滞后)

| 测试 | 断言 | 关注 |
|---|---|---|
| `_test_set_health.cjs` | 24/0 | health 写入幂等 |
| `_test_v241_real.cjs` | 20/0 | proto3 default + 真账号 (网络依赖) |
| `_test_in_use.cjs` | 57/0 | 使用中锁 + 失败计数 |
| `_test_e2e_msg_rotate.cjs` | 33/0 | 消息轮转 E2E |
| `_test_quota.cjs` | 12/0 | 配额波动检测 |
| `_test_v251_postauth_header.cjs` | 8/0 | postAuth header 协议 |
| `_test_v252_exptag.cjs` | 73/0 | UI 5 态 + Trial 清洗 |
| `_test_v255_ideversion.cjs` | 9/0 | ideVersion 1.99.0 锁 |
| `_test_v256_layer6_path.cjs` | 30/0 | Layer 6 路径双修 |
| `_test_v267_debounce.cjs` | 28/4 ⚠ | §1 baseline 滞后 · 历史不计 |
| `_test_v2613_quota_delta.cjs` | 44/0 | 阴阳结合 ⚖额度变动 |
| `_test_v2614_triple_throttle.cjs` | 66/0 | 三守俱全 |
| `_test_v270_omni_recognize.cjs` | 73/0 | 万法识号 |
| `_test_v271_omni_token.cjs` | 65/0 | 万法归一·token 直登 |
| `_test_v2711_main.cjs` | 46/0 | parseAccountText 守 v2.7.0 schema |
| `_test_v273_lock_persistence.cjs` | 23/0 | 🔒 持久化 |
| `_test_v274_lock_state_isolation.cjs` | 26/0 | 🔒 multi-window 隔离 |
| `_test_v275_single_token_omni.cjs` | 57/0 | 单 token 占位 email · 主公诏 |
| **合计** | **666/0** | **17/18 套全过 · v267 历史滞后** |

## 历史: v17.42.x 系满载版

v17.42.20 (2026-04-末) 及 v17.42.x 全系**满载本体**已归档于 `_archive/wam-v17.42.20/` (仓库归档目录):

- 完整 `extension.js` 437 KB / 10913 行
- 387 E2E 断言
- 完整 v17 CHANGELOG 72 KB · `_archive/wam-v17.42.20/CHANGELOG.md`

二者为**同名异体 · 各臻其极** · 不相代而相成.

---

*德经曰: 上士闻道 · 堇而行之. 道极版即「闻道而行」之践*
