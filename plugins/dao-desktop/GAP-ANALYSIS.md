# 官方 Devin Desktop IDE ↔ dao-desktop 插件 · 全模块差距矩阵(R148)

> **本源基底(R151 纠正)**: 主战场是把本插件装进 VS Code 等**第三方 IDE**, 与官方 Devin Desktop
> 逐项 1:1 对照; 同机共存时全套复用官方资源(登录态 credentials.toml/state.vscdb、
> mcp_config.json、~/.devin/rules、global_rules.md、云端会话), 道并行而不相悖。
> 独立宿主三级 LS 接入链: 共生发现在跑官方 LS → 落盘宿主态复用 → **ls-boot 自持拉起**
> (官方二进制 + 同源登录态 + 同源 CSRF 注入, R151 后端实证: 官方 IDE 全关时 VS Code 内
> GetUserStatus 返回同一账号)。

> 方法: 反查官方 `windsurf` 扩展 bundle(3.4.27)——64 contributes 命令、5 个 gRPC 服务
> (LanguageServer/ExtensionServer/SeatManagement/Dev/ProductAnalytics)、122 个查询类 RPC,
> 与插件源码逐项对账; 云端 RPC 逐一**活体探测**定可达性(不臆测)。
> 状态: ✅ 已同步 · ◐ 部分 · ❌ 缺失 · ⛔ 平台不可达(实证)

| 模块 | 官方能力 | 插件状态 | 依据/说明 |
|---|---|---|---|
| Cascade 对话 | 三模式 composer/轨迹/队列/revert/分支/Arena/Worktree/slash/@/图片 | ✅ | R134/R143 实机 1:1 对照 |
| 会话管理 | 列表/重命名/归档/删除/跨 IDE 同步 | ✅ | panel + unified |
| MCP 管理 | installed+registry 归并、停用保留、工具/prompt 级开关 | ✅ | v1.3.4 归并视图(#65) |
| Rules/Workflows/Skills | GetAll*/Create/Delete/官方 RPC 同源 | ✅ | panel.js + local-api |
| Memories | 双源读写 | ✅ | 备份板块 |
| Code Maps | LoadCodeMap 等 | ✅ | 前轮 |
| ACP | registry.json/reloadAcpConnections/local agents | ✅ | 设置板块 |
| 设置开关 | GetUserSettings 读改写 | ◐ | openMostRecentChatConversation 已通; 其余开关按需扩 |
| 账号/配额 | GetUserStatus(套餐/配额/teamConfig) | ✅ | 设置板块活体 |
| 模型状态 | GetUserStatus.cascadeModelConfigData | ✅(R146) | 设置板块「模型状态」卡 |
| API key | devin.copyApiKey | ✅(R146) | 尾4位显示+复制 |
| Devin Session Token | getSelfDevinSessionToken(打通 Devin Cloud API) | ✅(R146) | ls-bridge.seatCall/devinSessionToken, 活体实证 200 |
| LS 运维 | restartLanguageServer / downloadDiagnostics | ✅(R146) | 官方命令直触 + GetDebugDiagnostics 落盘 |
| 导入 | importVSCodeSettings/Extensions、importRulesFromCursor | ✅(R146) | import-sync 纯核(并入不覆盖)+ ImportFromCursor RPC |
| Profile/Billing/Usage 页 | openProfile/openBillingPage/View Usage(皆开 webapp 外链) | ✅ | 官方同为外链; 设置板块直达 |
| 云端 Profile 数据 | SeatManagement GetProfileData/GetUserSubscription/GetUserNotifications/GetCurrentUser/GetEligibleDevinOrganizations | ⛔ | 活体实证: Devin 账号下 api-key/session-token 鉴权均 401/403(`API key requires token authentication`/`permission denied`)——服务端限官方 Windsurf 团队客户端, 不伪造 |
| GetCascadeModelConfigs | 独立 RPC | ⛔ | 服务端 `unimplemented; use GetUserStatus instead`(官方亦不可用) |
| 补全(GetCompletions) | Tab 补全 | ⛔ | LS 自身返回 deprecated(R138 判定) |
| 内置浏览器 | openBrowser(IDE 宿主) | ✅(R147) | web-embed 站内代理内嵌(剥 XFO/CSP + base/拦截注入) + 🌍 板块; P0×2 已修(#69) |
| 官方账号/Cascade 菜单 | Devin Settings/Sign Out/Changelog/Configure Rules·Skills·Workflows/MCP 配置 | ✅(R147) | _setCmd 白名单直通, devin.* 优先 windsurf.* 回退 |
| 团队/组织控制 | GetTeamOrganizationalControls(teamId/扩展模型/子代理默认模型) | ✅(R148) | 冷启动新 VM 活体实证 200; 设置板块卡呈现 |
| 语音录音 | StartAudioRecording(ExtensionServer 宿主) | ◐ | composer 🎙 走 Web Speech(R143), 宿主级录音不可达 |
| 登录/登出 | login/loginWithAuthToken/logout | ✅ | cascadeAuth + CLI 编排(R132/R138) |
| 提交信息 | generateCommitMessage | ✅ | GenerateCommitMessage → SCM 输入框 |
| Lifeguard/Dev 服务 | 内部 dev 工具 | ❌(不做) | 官方内部调试面, 非用户功能 |
| GetSystemPromptAndTools | 系统提示词/工具清单查看 | ⛔ | R148 活体实证: plannerConfig 各字段变体均报 "planner config not set", cascadeConfig 包裹变体致 LS panic(socket hang up) — 服务端请求面不可解, 判官方内部调试 RPC |
| SetPinnedContext/Guideline | 固定上下文/准则 | ⛔ | R148 复测仍 not implemented |
| GetUnleashData | feature flags | ❌(不做) | R148 活体 200, 但为官方实验开关面, 非用户功能 |
| Agent 模式看板 | 整窗云会话 Board/List/Spaces/筛选/搜索/New session | ✅(R149) | agent-board.js: Devin Cloud ACP session/list(活体实证, cognition.ai/* 元数据) + 本机轨迹双源 |
| Agent/Editor 顶部标签 | 模式标签切换 | ✅(R149) | Cascade 面板顶部标签条: Agent → 看板, ⚙ → Settings |
| Devin Settings 整页 | General/Plan/Plugins/Agents/Devin Local/Editor/Cascade/Advanced | ✅(R149) | settings-page.js: 8 节整页, 数据/写回全走既有真源(GetUserStatus/GetUserSettings/MCP/devin-provision/import-sync) |
| 状态栏 Upgrade/Settings 项 | Free-Upgrade Now / Devin-Settings | ✅(R149) | status-bar.js 补齐(升级项仅免费套餐显示) |

## R152 · 工作区归域与交接基线

| 项目 | 当前状态 | 依据 |
|---|---|---|
| 第三方 IDE 工作区注入 | ✅ | extension.js 将首个 VS Code workspace 注入 ls-boot |
| 自持 LS workspace_id | ✅ | 与官方 `file_<路径>` 归一规则一致 |
| 官方工作区注册 | ✅(已接线) | 自持成功后调用 `AddTrackedWorkspace` |
| 自持端口目录清理 | ✅ | deactivate/stop 清理临时端口目录 |
| 官方↔插件双向会话同步 | ◐ | 已实证插件创建轨迹可被同源官方 LS 读取；仍需真实 UI 双向写入矩阵 |
| 全资源双向同步 | ◐ | 读路径已同源；Settings/MCP/Rules/Skills/Workflows/Memories 仍需逐项写后对侧复读 |

## R153 · 全资源双向同步「写后对侧复读」后端可验(sync-audit)

> 本源: 官方 IDE 与本插件对每类可定制资源本就**读写同一份落盘真源**(env-sync 已列全清单)，
> 故"双向同步"= 源同一，一侧写另一侧直读即见，无需拷贝迁移。R153 把这条本源做成**后端可验**
> 的审计模块 `dao-cascade/sync-audit.js`(反者道之动·规避 GUI)：

| 项目 | 当前状态 | 依据 |
|---|---|---|
| 真源归一审计 `/api/sync/audit` | ✅ | 六类资源(MCP/全局 Rules/global_rules.md/Workflows/Skills/记忆)逐项给出官方真源路径+读路径+写路径, 判定归一(diverged=[]) |
| 写后对侧复读活体探测 `/api/sync/roundtrip` | ✅ | 向官方真源写唯一标记探针→经**另一侧读路径**复读确认→原样还原(探针不留痕); 六类全 wrote/readBack/reverted 通过 |
| 回归护栏 | ✅ | headless-core.test.js 新增 3 例: 审计无割裂 / 复读闭环+不留痕(临时家目录隔离) / 路由接线 |
| MCP server/tool 级开关 | ✅ | mcp-config 直写官方 mcp_config.json(官方 LS SaveMcpServerToConfigFile 同写此文件), 双端 RefreshMcpServers 同步生效 |

> 仍待: 真实运行官方 LS 下, Settings(GetUserSettings)/会话轨迹经 RPC 路径的写后对侧复读实机矩阵
> (sync-audit 已覆盖文件类真源; RPC 类需官方 LS 在跑活体串测)。

## R154 · 跨插件数据流通(共存·数据本源流通) coexist.dataFlow/roundtrip

> 共存场景(同机: 官方 IDE + dao-one + dao-desktop, 本 VM 实机并装实证)的数据互通归一:
> **官方引擎落盘真源(~/.codeium/windsurf + ~/.local/share/devin)本就是跨插件数据总线**——
> 凡复用官方 LS 引擎者(官方 IDE / dao-vsix / dao-one / dao-desktop)读写同一份, 一侧写全侧见;
> 各插件自持面(~/.dao/* 等)按文件名/命名空间隔离, 各写各真源不串写。

| 项目 | 当前状态 | 依据 |
|---|---|---|
| 数据流通矩阵 `/api/coexist/flow` | ✅ | 六类共享总线资源 × 四成员 + 13 项自持面隔离边界, 机器可读 |
| 流通活体验证 `/api/coexist/roundtrip` | ✅ | 共享总线复用 sync-audit 写后对侧复读 + 自持面隔离断言; 本 VM 实机(dao-one@2.25.6 并装)六类全 wrote/readBack/reverted, 隔离 13/13 |
| 兄弟安装探测 | ✅ | coexist.detect() 实机检出 dao.dao-one 并装 |
| 回归护栏 | ✅ | headless-core.test.js 新增 3 例(69/69) |

## R155 · RPC 层同步活体验证(官方 LS 运行态) sync-rpc + 后端登录链打通

> 承接项目自带基础设施(rt-flow 账号体系), **全后端零 GUI**打通官方登录态并做 RPC 面活体串测:
> 登录链 `password/login → auth1 → WindsurfPostAuth(sessionToken) → RegisterUser(api_key)`,
> 把 api_key(= windsurf_api_key)落 `~/.local/share/devin/credentials.toml`; 经 ls-boot 自持
> 拉起官方 language_server(同一二进制/登录态/codeium_dir), 做「写→复读→还原」RPC 往返。

| 项目 | 当前状态 | 依据(本 VM 实机) |
|---|---|---|
| 后端登录链(零 GUI) | ✅ | 新账号 4 步链全通; GetUserStatus 200 (plan/name 真回) |
| 官方 LS 自持拉起 | ✅ | ls-boot 拉起 language_server_linux_x64@3.4.27, 端口就绪, 登录态同源 |
| Settings RPC 往返 | ✅ | Get/SetUserSettings 写→复读→还原(proto3 缺省省略以 !! 归一, 不误判) |
| 定制类 RPC↔文件真源往返 | ✅ | CreateCustomizationFile 落官方 global_workflows 目录→GetAllWorkflows 列出→删文件复刷即失 |
| `/api/sync/rpc-roundtrip` | ✅ | LS 不可用时如实返回 available:false, 不伪称 |
| 回归护栏 | ✅ | headless-core.test.js 新增 3 例(桩 LS · 72/72) |

> 剩余(不伪称): 会话轨迹(Cascade Steps/Transcript)跨主机可见性的多机实证、
> 官方 GUI 图形态与本插件并跑的人眼端到端录屏(可经 testing_agent 追加)。

## R156 · 实机第三方 IDE 全链路跑通 + 本地 API 激活自启

> 核心主线实证: 真 VS Code 1.129.0 装入本插件(非官方 IDE), 激活即自启本地 API(修复此前
> 端点需面板手点才开的真缺口, `dao.localApi.autoStart` 默认开), 经开放端点跑通真对话。

| 项目 | 当前状态 | 依据(本 VM 实机) |
|---|---|---|
| 本地 API 激活自启 | ✅ | VS Code 激活即落 ~/.dao/local-api.json(600), /api/health 200 |
| 真对话全链路 | ✅ | /api/cascade/send 真发「道生」→ transcript 真回 → trajectories/steps 全可读 |
| 独立官方侧可见 | ✅ | 另起全新 LS(新端口/新 db)同账号 GetAllCascadeTrajectories 见同一会话/轨迹 |
| GUI 对照实证 | ✅ | testing_agent 录屏 4/4: VS Code 面板回放/新发消息真回, 官方 IDE Agent 看板见同一会话双向同步 |
| 回归护栏 | ✅ | 73/73 |

## R157 · 官方操作体系对位: Agent 模式互切 + 官方快捷命令组

> 用户实测暴露的割裂点: VS Code 内不知如何切 Agent 模式、官方快捷操作组缺席。
> 反者道之动: 从官方 workbench 二进制提取命令清单(workbench.action.toggleWindsurfAgentWindow /
> devin.cascade.toggleModelSelector 等)逐项对位。

| 项目 | 当前状态 | 依据 |
|---|---|---|
| Agent 模式 ↔ 编辑器模式一键互切 | ✅ | dao.cascade.toggleAgentWindow(官方 toggleWindsurfAgentWindow 对位) + 状态栏常显「Agent 模式」切换项(补官方顶栏切换的可发现性) |
| 官方快捷命令组 | ✅ | toggleModelSelector(Ctrl+/) · switchToNextModel(Ctrl+Shift+/) · toggleWriteChatMode(Ctrl+.) · openAgentPicker(Ctrl+Shift+.) 命令+键位与官方一致, 面板外亦可触发(聚焦后投递 ui-action) |
| 回归护栏 | ✅ | headless-core.test.js 新增对位护栏(74/74) |

## R158 · 编辑器内联键组对位 + 会话变更跨侧矩阵后端可验

> 承接 R157「剩余」深水区, 逐项对照官方编辑器内联操作面与会话变更矩阵(反者道之动·规避 GUI)。

| 项目 | 当前状态 | 依据 |
|---|---|---|
| 编辑器内联命令(Ctrl+I) | ✅ | dao.cascade.inlineCommand(官方 command.open 对位): 官方本体在位即直通(devin.* 优先/windsurf.* 回退); 纯第三方 IDE 无官方本体时回退把选区/光标处带入 Cascade composer 作「就地编辑」意图承接, 体感不割裂 |
| diff zone 接受/拒绝键组 | ◐ | acceptDiff/rejectDiff/acceptAllDiffs/rejectAllDiffs 命令+官方直通序列在位; 官方 diff zone 需宿主官方本体在跑, 纯第三方 IDE 下如实提示改在 Cascade 面板内接受(不伪造就地 diff) |
| Tab supercomplete 补全 | ⛔ | 官方 GetCompletions 已 deprecated(LS 自身返回 deprecated, R138 判定), 平台不可达 — 如实不伪造; 宿主内建官方本体时由其接管 |
| 会话 rename/archive/delete 跨侧变更矩阵 | ✅ | /api/cascade/{rename,archive,delete} 写官方真源已在位; R158 新增 `/api/cascade/matrix-roundtrip`(sync-rpc.sessionMatrixRoundtrip): rename/archive 写→经**另一读路径** GetAllCascadeTrajectories 复读→原样还原(delete 破坏性不入探针); 并入 /api/sync/rpc-roundtrip。**实机实证(真 LS+真账号)**: archive 翻转/还原同进程复读即见; delete 后列表即消; rename 写云端真源(CascadeTrajectorySummary.renamed_title), 同进程不即时回流、重启 LS(≈另一侧重拉)后 renamedTitle 可见 —— 探针短轮询不见时如实标 cloud-deferred |
| 回归护栏 | ✅ | headless-core.test.js 新增 4 例(内联键组接线 + 矩阵往返闭环/不留痕 + 无轨迹如实 skipped + 路由接线, 78/78) |
| 实机冷启动链路(本轮 VM) | ✅ | 官方 IDE 3.4.27 冷启动下载 + windsurf_auth 四步链后端登录(零 GUI) → credentials.toml 同源落盘 → ls-boot 自持拉起官方 LS → settings/customization/session-matrix 三往返实机全绿 |

## R159 · Cascade Bar / 顶栏级入口 / 跨主机可见性实证

| 项目 | 当前状态 | 依据 |
|---|---|---|
| Cascade Bar(diff zone 操作条) | ✅ | dao-cascade/cascade-bar.js: 六键(hunk 上/下导航 + 当前 hunk 接受/拒绝 + 本文件全收/全拒)与官方键位 1:1(Alt+J/K · Alt+Enter · Alt+Shift+Backspace · Ctrl+Enter · Ctrl+Shift+Backspace); 命令 ID 为官方 3.4.27 package.json 键位真源实测提取(devin.prioritized.cascade*); 官方本体在位即直通, 不在位如实瞬时提示(不伪造 diff zone); 状态栏常显段以官方真源 diff 水位(diffLinesAdded/Removed)常显 + 点击开六键面板; 键位可经 dao.cascadeBar.keys 退让 |
| 官方候选命令 ID 纠偏 | ✅ | R158 猜测 ID(devin.acceptDiff 等)全量替换为官方真源实测 ID(devin.prioritized.cascadeAcceptFocusedHunk/…AllInFile 等); inlineCommand 首候选 devin.prioritized.command.open 实测吻合 |
| 顶栏级入口对位 | ✅ | editor/title 挂 Cascade 开关($(comment-discussion))/Cascade Bar($(diff))/Agent 窗口切换($(layout-panel)) —— 官方顶栏可发现性在第三方 IDE 的原生等价位(VS Code 扩展 API 上限即 editor/title+状态栏, 如实不伪称改写标题栏) |
| 会话轨迹跨主机可见性 | ✅(实机实证) | 全新 database_dir + 全新 workspace_id(≈另一台机器同账号冷拉)启动第二个官方 LS: A 侧创建+改名的轨迹在 B 侧 GetAllCascadeTrajectories 立即可见且 renamedTitle=探针值 —— 云端真源跨主机同源同证 |
| Tab supercomplete | ⛔ | 官方以 devin.prioritized.supercompleteAccept(Tab)/supercompleteEscape(Esc) 由本体内部渲染; 平台 GetCompletions 已 deprecated, 第三方 IDE 无官方本体时不可达 — 如实不伪造; Tab/Esc 全局劫持风险高, 不做回退绑定 |
| 回归护栏 | ✅ | headless-core.test.js 新增 4 例(六键/键位/config 退让/接线 + 官方 ID 真源一致 + editor/title 顶栏入口 + diffStat 桩聚合与如实 null), 82/82 |
| 双 LS 同时运行实时互推 | ◐(实机实证边界) | 同账号双官方 LS 并行(独立 database_dir/workspace_id): A 侧新建+改名+归档, B 侧不重启轮询 GetAllCascadeTrajectories 60s 内不可见 —— 官方二进制无轨迹级 Refresh/Sync RPC(strings 实测仅 RefreshCustomization/RefreshMcpServers 等), 轨迹列表为**启动时拉取**语义; 重启/冷拉即见(上行已证)。如实标注: 跨侧同步为 pull-on-(re)start, 非实时推送 |

## R161 · 官方命令/键位 1:1 覆盖审计(真源为锚)

| 项目 | 当前状态 | 依据 |
|---|---|---|
| 覆盖审计模块 | ✅ | dao-cascade/official-parity.js: 官方 3.4.27 contributes.commands(64 条, devin.*/windsurf.* 成对)去偶 33 基名逐条归类(covered/na/pending, 如实不伪造) + 12 键 1:1 键位表; GET /api/parity/commands 后端可验 |
| importRulesFromCursor | ✅ | dao.cascade.importRulesFromCursor: 工作区 .cursorrules/.cursor/rules/*(mdc→md) → .windsurf/rules 后端复制(官方同源目录) |
| openBrowser | ✅ | dao.cascade.openBrowser: 官方在位直通 devin/windsurf.openBrowser; 否则宿主 simpleBrowser.show 同位承接(再回退 openExternal) |
| 回归护栏 | ✅ | headless-core.test.js 新增 1 例(清单完整性/归类如实/审计聚合/路由与接线), 83/83 |

## R162 · Lifeguard/ACP 官方对位(实机 RPC 已证)

| 项目 | 当前状态 | 依据 |
|---|---|---|
| lifeguard.checkCurrentChanges | ✅ | dao.cascade.lifeguardCheck(Ctrl+U 官方同键, config 可退让): 官方在位直通 devin/windsurf.lifeguard.checkCurrentChanges; 纯第三方回退读 GetLifeguardConfig 如实报告引擎态(实机: agent enabled, cognition-lifeguard v2), 不伪造检查面板 |
| reloadAcpConnections/openAcpLocalRegistry | ✅ | dao.cascade.acpRegistry: 官方在位直通; 回退 GetAllAcpRegistries(registryJson) quickpick 官方真源清单(实机: Devin CLI acp 等 bundled agents) |
| 后端读路径 | ✅ | GET /api/lifeguard/config、GET /api/acp/registries —— 官方 LS RPC 直取, 实机往返已证 |
| 回归护栏 | ✅ | headless-core.test.js 新增 1 例(直通候选/回退真源/命令/Ctrl+U 键位/路由), 84/84; v1.5.10 构建通过 |

## R163 · 跨端会话重拉(pull-on-restart 语义落地)

| 项目 | 当前状态 | 依据 |
|---|---|---|
| dao.cascade.refreshSessions | ✅ | 自持 LS 重启即重拉云端真源(R160 实证语义)→ 另一侧(官方 IDE/另一机)新建/改名/归档即见; 共生官方 LS 不代杀官方进程, 如实提示由官方侧自身重载刷新 |
| POST /api/cascade/refresh | ✅ | 后端同路径: selfhost-restart(重启+前后轨迹数)/symbiotic-or-none 两态如实分流; 实机 stop→boot→GetAllCascadeTrajectories 往返已证 |
| 回归护栏 | ✅ | headless-core.test.js 新增 1 例(命令/分流/路由/登记), 85/85; v1.5.11 构建通过 |
| 端到端实机实证(R164) | ✅ | A 侧独立官方 LS(全新 db/workspace)StartCascade+改名探针 → B 侧插件自持 LS 启动即见(pull-on-start), refresh 重启后仍见且 renamedTitle=探针值(probe-match: true) —— 跨端会话同步全链路实机闭环 |

## R165 · 定制类/MCP 轻量刷新(官方 Refresh RPC 实机已证)

| 项目 | 当前状态 | 依据 |
|---|---|---|
| dao.cascade.refreshCustomizations | ✅ | 官方 RefreshCustomization RPC(实机 OK {}): 不重启 LS 即重读 Rules/Workflows/Skills 文件真源 — 跨 IDE 改动即见 |
| dao.cascade.refreshMcp | ✅ | 官方 RefreshMcpServers RPC(实机 OK {}): 不重启 LS 即重读 mcp_config.json 真源并重连 MCP 服务 |
| 后端路径 | ✅ | POST /api/customizations/refresh、POST /api/mcp/refresh; openapi 登记 |
| 回归护栏 | ✅ | headless-core.test.js 新增 1 例(接线/路由/登记), 86/86; v1.5.12 构建通过 |

## R166 · 真源守望(跨 IDE 定制类改动自动即见 · 实机已证)

| 项目 | 当前状态 | 依据 |
|---|---|---|
| truth-watch.js | ✅ | fs.watch 官方落盘真源 5 点(mcp_config.json/memories/~/.devin/rules/global_workflows/skills) → 去抖 1.5s → 官方 Refresh RPC(RefreshMcpServers/RefreshCustomization)重读 —— "一侧改动另一侧即见"从手动升级为自动 |
| 实机实证 | ✅ | 真实官方 LS 运行态: 落探针 .md 到 ~/.devin/rules → `全局 Rules 变更 → RefreshCustomization 已重读真源`(RPC fired OK) |
| 如实边界 | ◐ | 启动时不存在的真源点不守望(不虚造目录); 会话轨迹为云端 pull-on-restart 语义(R160), 不入本模块 |
| 配置开关 | ✅ | dao.truthWatch.enabled(默认开), 变更即热起停 |
| 回归护栏 | ✅ | headless-core.test.js 新增 1 例(守望点/去抖活体桩/开关/接线), 87/87; v1.5.13 构建通过 |

## R167 · 诊断/轨迹调试对位(官方 RPC 实机已证)

| 项目 | 当前状态 | 依据 |
|---|---|---|
| dao.cascade.downloadDiagnostics | ✅ | 官方 devin/windsurf.downloadDiagnostics 在位直通; 否则 GetDebugDiagnostics RPC(实机 OK, languageServerDiagnostics.logs 真源)落 JSON 文件 |
| GET /api/diagnostics/ls | ✅ | 官方 GetDebugDiagnostics 直取 — 官方诊断包的后端读路径 |
| GET /api/trajectory/debug | ✅ | 官方 GetUserTrajectoryDebug 直取(实机 OK, mainline 轨迹元数据) |
| 回归护栏 | ✅ | headless-core.test.js 新增 1 例, 88/88; v1.5.14 构建通过 |

## R168 · 官方流式订阅 RPC 逆向实测(如实边界)

官方 LS 3.4.27 二进制内的 server-streaming 订阅面(strings 实测提取):
`StreamCascadeReactiveUpdates`(单会话生成流, 已在用) / `StreamCascadeSummariesReactiveUpdates` /
`StreamCascadePanelReactiveUpdates` / `StreamUserTrajectoryReactiveUpdates` / `StreamTerminalShellCommand`。

| 探测 | 结果 | 依据 |
|---|---|---|
| StreamCascadeSummariesReactiveUpdates 订阅 | ◐ | HTTP 200 connect+json, 建流即回初始空帧 {}; 订阅存活 |
| 本 LS 内 RPC 驱动 StartCascade+Rename → 推送 | ✗ | 12s/40s 观察窗零事件帧 — RPC 直写不经 panel 轨, 未触发 summaries 推送 |
| 跨 LS(A 侧独立官方 LS 写) → B 侧订阅推送 | ✗ | 20s 观察窗零事件帧 — 与 R160 结论一致: 跨端会话列表无实时云端推送, 仍为 pull-on-(re)start |
| 结论 | 如实 | 官方订阅流面向 IDE panel 内部反应式轨, 不承载 RPC 直写/跨端实时同步; R163 refreshSessions(重启重拉)仍是跨端即见的正道 — 不伪造实时推送 |
| dao.cascade.autoRefreshMinutes | ✅ | 如实兜底轮询: 自持 LS 周期性重启重拉(默认 0=关, 热起停); 共生官方 LS 不代杀 |

## R169 · 全链路实机体检(官方 LS 3.4.27 · 同账号云端真源)

一次性实机 sweep(自持官方 LS, 全后端零 GUI):

| 探测 | 结果 |
|---|---|
| GetStatus / GetUserStatus / GetLifeguardConfig / GetDebugDiagnostics / GetUserTrajectoryDebug | ✅ 全通 |
| GetAllCascadeTrajectories | ✅ 5 会话(云端真源, 历轮实验累积) |
| GetAllAcpRegistries | ✅ 40 agents |
| RefreshCustomization / RefreshMcpServers | ✅ |
| GetAllRules/Skills/Workflows/CascadeMemories/UserMemories | ✅ 5 RPC 全通 |
| 会话写矩阵 Start/Rename/Archive | ✅ |
| 自持重启重拉(pull-on-restart) | ✅ 重启后 6 会话(含本轮新建即见) |
| Settings 写→复读→还原 | ✅ sync-rpc.roundtrip: wrote/readBack/reverted 全 true(注: sweep 初测误用 {settings} 字段致 socket hang up, 正确形为 {userSettings} — 探针笔误, 非产品缺口) |
| 定制类 CreateCustomizationFile→GetAllWorkflows→还原 | ✅ 全 true |

结论: R158–R168 累积的官方对位面在真实官方 LS + 云端真源上全链路可用; 覆盖审计 100%(covered 22 + na 11 如实, pending 0)。

## R170 · 双 LS 并行一致性实机实证(定制类 · 不重启即见)

两个官方 LS **同时运行**(A=独立官方 LS 全新 db/workspace, B=插件自持 LS), 共享落盘真源 + RefreshCustomization:

| 探测 | 结果 |
|---|---|
| 共享真源写 workflow 文件 → 双侧各自 RefreshCustomization → 双侧 GetAllWorkflows | ✅ A: true, B: true — 并行同见 |
| B 侧 CreateCustomizationFile(返 file:// 路径, 内容由调用方落盘)+写文件 → A 侧 Refresh 后 GetAllWorkflows | ✅ B 写 A 见(true) — 反向并行同见 |
| 与会话轨迹对比 | 定制类(Rules/Workflows/Skills/MCP)为**文件真源+刷新 RPC**语义 → 双 IDE 并行运行时不重启即见(R166 守望自动化); 会话轨迹为云端 pull-on-restart(R160/R168) — 两种语义如实分野 |
| 探针还原 | ✅ 全部删除+再刷新, 不留痕 |

结论: 双 IDE 并行一致性在定制类数据面实机闭环 —— "两边任何操作一边, 对应一边也都会更新"对文件真源类资源已成立(自动化由 R166 truth-watch 承担); 会话列表类保持如实的重拉语义。

## R171 · Settings 存储域实证(双 LS 并行 · 全翻转跟随 PASS)

两个官方 LS 同时运行(A=独立 db, B=插件自持 LS 另一 db), A 侧 SetUserSettings 全翻转序列(false→读→true→读):

| 探测 | 结果 |
|---|---|
| A→false 后 B live 读 | ✅ false |
| A→true 后 B live 读 | ✅ true |
| 结论 | ✅ **并行即见** — GetUserSettings/SetUserSettings 为云端/共享域(非本地 db 域), 双 IDE 同时运行不重启即跟随; 排除 proto3 false 缺省歧义(双向翻转均跟随) |
| 探针还原 | ✅ 原设置写回 |

同步语义三分野(全部实机实证): ① Settings=云端域**并行即见**(R171); ② 定制类/MCP=文件真源+刷新 RPC, **刷新即见**(R170, truth-watch 自动化); ③ 会话轨迹=云端 **pull-on-restart**(R160/R164/R168, refreshSessions/autoRefresh 承接)。

## R172 · MCP/Memories 域实证(如实边界)

| 探测 | 结果 |
|---|---|
| 共享 mcp_config.json 写哨兵 server → B 侧(插件自持 LS 生产路径) RefreshMcpServers → GetMcpServerStates | ✅ 刷新即见(true), 还原不留痕 — MCP 与 R170 定制类同为文件真源+刷新语义 |
| 同哨兵 → A 侧(最小化独立 LS harness) GetMcpServerStates | ✗ 恒返 {} (重试 5 轮) — 该 harness 未初始化 MCP 面; **harness 局限而非产品缺口**(共享文件真源语义已由 B 侧+R170 证立), 如实标注不伪称双侧 |
| Memories 创建探针 | ✗ 官方无创建 RPC: UpdateCascadeMemory 仅改既存 id(实测 "memory does not exist"), memory 由 Cascade 代理运行产生 — 后端无法如实伪造探针, 跨端可见性按文件真源语义推定但不声称已证 |

> 剩余(不伪称): 官方标题栏原生改写(VS Code 扩展 API 无此上限, 以 editor/title+状态栏为等价位) —— 持续对照推进。

## R174 · 全新虚拟机冷启动复证 + 一键器落地(scripts/coldstart.js)

全新 VM(零残留)全链路复跑上一轮成果, 纯后端零 GUI:

| 探测 | 结果 |
|---|---|
| 官方 stable 通道下载解包 Devin Desktop 3.4.27 | ✅ |
| 后端登录(windsurf_auth auto, email/password → apiKey → credentials.toml) | ✅ 不经 GUI/浏览器 |
| 自持官方 LS → GetUserStatus | ✅ 账号/tier 正确(TEAMS_TIER_DEVIN_FREE) |
| 体检 sweep(轨迹清点/RefreshCustomization/RefreshMcpServers/Lifeguard/诊断/Settings 写→复读→还原) | ✅ 全 PASS |
| scripts/coldstart.js 一键器 | ✅ 幂等(已就位步骤 skip), --json 报告, 退出码供 CI 消费; login 路径实测(移除 credentials 后 DAO_EMAIL/DAO_PASSWORD 重登 PASS) |
| 官方对位快照重跑(sync-official) | ✅ 3.4.27 无漂移(新增 0/移除 0); 已接入计数修正 86→92(AddTrackedWorkspace 等历轮新接入档) |
| 测试工装修缮 | ✅ ls-boot 测试改为保存/恢复 DAO_NO_LS_BOOT(原先无条件删除, 在官方二进制+凭据齐备的机器上导致后续测试真拉起 LS 挂死 runner); 90/90 通过 |

## R175 · 宿主 UI 对照升级 · 官方主题真源随包(反者道之动)

| 项目 | 当前状态 | 依据 |
|---|---|---|
| Devin Dark/Light 主题 | ✅ | 官方 theme-windsurf 主题 JSON **逐字节**反提随包(product.json 默认即 Devin Dark); VS Code 宿主一键获得官方 Devin Desktop 视觉基调 |
| dao.cascade.applyOfficialTheme | ✅ | 一键切换 workbench.colorTheme → "Devin Dark"(官方默认同源) |
| 官方升级跟随 | ✅ | scripts/sync-official.js 增主题真源同步段: 重跑即逐字节对账/更新, 有漂移即报 |
| 回归护栏 | ✅ | headless-core.test.js 新增 1 例(登记/文件随包/完整配色非占位/命令接线/同步器承接), 91/91 |

## R176 · 双轨实机部署矩阵(真实 VS Code + 官方 IDE · 全后端 CLI)

全新 VM 双轨全链路实机部署(GUI 仅截屏辅助, 全程后端/CLI):

| 探测 | 结果 |
|---|---|
| 真实 VS Code 1.129.1 冷装(deb) → `code --install-extension` dao-desktop-1.5.17.vsix | ✅ 列表可见 dao-agi.dao-desktop@1.5.17 |
| 扩展实机激活 | ✅ exthost.log: `_doActivateExtension dao-agi.dao-desktop`(onStartupFinished), 无错误 |
| Devin Dark 主题应用(R175 真源) | ✅ settings.json 写入 → 实机深色工作台(截屏辅助佐证) |
| 官方 Devin Desktop IDE 侧: 归一(rt-flow 4.26.9)+ Proxy Pro(9.9.347)+ dao-desktop 1.5.17 经官方 CLI 安装 | ✅ `devin-desktop --install-extension` 三件全部成功, --list-extensions 可见 |
| verify-sync-matrix(两轨都部署后) | ✅ 判定通过: 安装顺序无关, 共享真源一致(credentials/memories/global_rules 单一真源三点同读) |

结论: "官方 IDE 内装归一/Proxy Pro" 与 "VS Code 内装 dao-desktop 插件版" 双轨并行实机成立, 道并行而不相悖 —— 共享家目录真源, 两轨互不割裂。

## R177 · 官方全表面对位(命令之外的一切 contributes 面 · 反者道之动)

| 面 | 官方(3.4.27) | 插件承接 |
|---|---|---|
| keybindings | 29 条 | 逐条审计入 KEYMAP_AUDIT: parity 18 + host 1(alt+\ 官方即绑宿主 inlineSuggest.trigger, 同键随包) + na 10(supercomplete/终端命令流/vim fork/麦克风/worktree/内部上报, 各给如实理由), pending 0; 新增 alt+\ 与 ctrl+'(toggleAgentSelector 官方同键别名) |
| jsonValidation | mcp_config/acp_registry schema | ✅ 官方 schema **逐字节**随包 + 同 fileMatch 校验; sync-official 增 schema 真源跟随 |
| languages | jsonc(mcp_config.json)/codemap | ✅ jsonc 对位随包; codemap 为引擎内部格式如实 na |
| themes | theme-windsurf | ✅ R175 已随包 |
| authentication | windsurf_auth | na: 官方本体在位由其提供; 插件登录走 credentials.toml 同一真源 |
| audit() | — | 新增 keymap/surfaces 汇总与全表, /api/parity 后端可验 |

## R178 · 双 IDE 并排实机对照 + 官方 GUI 登录回环打通(devin:// 深链)

双 IDE 同屏对照(左: VS Code + dao-desktop 1.5.18; 右: 官方 Devin Desktop 3.4.27 + 归一/Proxy Pro/dao-desktop):

| 发现 | 处置 |
|---|---|
| 官方 IDE 浏览器 OAuth 回跳 devin://codeium.windsurf 在 tar 包安装下落空(无 .desktop 注册) | ✅ coldstart.js 增 urlHandler 步: 落 x-scheme-handler/devin → devin-desktop --open-url, 幂等; 实机点通官方 GUI 登录全回环(app.devin.ai → 深链 → IDE 登录成功) |
| 两侧同账号同时在线 | ✅ 左 VS Code 插件面板 引擎✓已登录(lywh6h4frtftdv)·LS:38657; 右官方 IDE 登录同账号, Cascade/Board 就位 |
| 官方 IDE 内并存我方三件(归一 rt-flow + Proxy Pro + dao-desktop) | ✅ 官方 Cascade 面板与我方 Devin Desktop: Cascade 面板、道Agent Pro 侧栏并存不冲突(道并行而不相悖) |
| 官方 IDE 二实例(--open-url 唤起 <2>)瞬时报 windsurf client couldn't create connection | 如实记录: 二实例竞态, 单实例无此报; 与插件无关 |
| OS keyring 缺失提示(裸 X 桌面) | 如实记录: 选 weaker encryption 即过, 官方自身行为 |

## R179 · 双图对照 → Agent 看板官方同貌收敛

按双 IDE 截图逐项对照官方 Agent 模式看板, 收敛差距:

| 官方 | 此前插件版 | 收敛 |
|---|---|---|
| 筛选 chips: Time is Any time × / Archived is Excluded × / ＋ | 无 | ✅ 同貌 chips, 点击轮换 Any/24h/7d/30d 与 Excluded/Included/Only, × 复位, 筛选真实生效 |
| Display 下拉 | 无 | ✅ Display·按更新/创建/标题 |
| 状态泳道 Running/... | 中文「运行中/待处理/已完成」 | ✅ 官方词 Running/Blocked/Finished + 计数 |
| Agent 模式整窗接管 | 看板挤在编辑器列 | ✅ 打开即收侧栏, 看板独占; Editor 标签回编辑器 |
| 宿主观感 | VS Code 默认主题+Welcome 页 | ✅ 实机已应用 Devin Dark + startupEditor none(R175 命令即官方化) |

## R180 · 二轮截图对照: Agent 侧栏结构 + MCP 底栏

官方单实例干净态截图再对照, 收敛:

| 官方 | 收敛 |
|---|---|
| 侧栏顶「＋ New session」「💬 Sessions」 | ✅ 同结构落地 |
| Spaces 区头带 🔍/＋ 图标 | ✅ 同貌(＋ 为官方同位注记) |
| 侧栏近期会话(标题+相对时间) | ✅ 云端+本机合流前 8 条 |
| 底栏「0 MCP servers」 | ✅ 同源计数(~/.codeium/windsurf/mcp_config.json, 与官方同一份) |
| 官方二实例 LS 竞态报错 | 单实例重启后消失, 印证与插件无关 |

## R181 · 归一外壳单网页(/shell) — dao-vsix 本源同形态原生落地

对照 devin-remote 本源(AGENTS.md: dao-vsix 才是本源主体, /shell 归一网页 = 浏览器套浏览器,
每板块一张平级 iframe 标签; IDE 内能操作的, 任意浏览器打开 /shell 同样能操作):

| 本源(dao-vsix@3.58.11) | 插件版适配 |
|---|---|
| 主口 9920 起 /shell 归一网页 | ✅ 插件 local-api 同口直出 /shell(dao.cascade.openShell 一键浏览器打开) |
| 板块各一张平级 iframe 标签 | ✅ 八标签: 主页/切号/桥接/备份/注入/MCP/GitHub/Proxy Pro |
| 数据 = dao-vsix 自持真源 | ✅ 换源为插件自持真源: 板块页 fetch 同一套 /api/*(与 unified-panel 面板同真源, 一侧写全侧见) |
| iframe 无法带 header → token 走查询串 | ✅ ?t= 鉴权(/web 同法), 只绑 127.0.0.1, 错 token 401 |
| 公网穿透(dao-bridge) | 待续轮: 插件版隧道折入后 /shell 即公网可达(与本源同径) |

## R182 · 归一本体拼积木(方向归正) — 原样搬运 dao-one, 零重写

用户纠偏: 不自研任何外壳/UI/新设计, 与 Dao-Windows-Agent 同法 —— 直接把 devin-remote 的
归一插件本体(dao-vsix 二合一 + Proxy Pro, 即 dao-one)拿过来拼装整合:

| 拼积木法 | 落地 |
|---|---|
| 不重写逻辑, 仅装配 | ✅ build.js 直接调用 dao-one 官方装配器(core/dao-one/build.js), vendor-vsix/proxy/flow/bridge 整目录搬运进 vendor-one/ |
| 原装驱动器 | ✅ dao-one extension.js 逐字节拷入, subContext 锚 vendor-one 原样激活(测试断言字节级一致) |
| 前端零新造 | ✅ dao-one 全部 contributes(dao-one 容器/wam.panel/dao.cloudPanel/115 命令)打包期原样并入 manifest, 打完还原源 package.json |
| 道并行而不相悖 | ✅ 宿主已装 dao-one/dao-vsix/rt-flow 即跳过内置激活, 共用同一 ~/.dao 真源 |
| 实机验证 | ✅ VS Code 装 1.5.23 → 9920 起(dao-vsix@3.58.11), /shell 归一网页原生可用(主页·六合一, 账号在线, 浏览器套浏览器), 底栏 道Agent Pro/0号/Dao:9920/Cascade Bar 全在 |

## R183 · 对话板块细粒度同貌(截图对照收敛)

双 IDE 同屏截图对照官方 Cascade 面板, 逐项收敛静息态差异(功能零删减, 扩展件悬停/聚焦即现):
- 标题 `Cascade Code Ctrl .` 键帽 nowrap 不折行(与官方同行)。
- 修复既有 CSS 病灶: 增强钮(图/Arena/Worktree/token 计数)的悬停显形规则误写成只改边框色 → 拆分为 display 规则 + .on 高亮规则。
- 空态「启动时自动打开最近会话」勾选行: 官方无此行 → 静息隐去, 悬停 Recent 区即现。
- 底部目标行与官方一致只剩「Local」: 工作区/用量/引擎详情悬停即现。

## R184 · 切号/多实例插件版实操验证(全后端·反者道之动)

在 VS Code 内跑通 vendor-one 归一底层的账号全链路(零 GUI 依赖, curl 直证):
- `/api/devin/login` 账号密码登录取 auth1 ✓(lywh 账号 · org rogerssydney63)。
- 多实例钉号: `POST /devin-cloud/api/users/post-auth?dao_acct=<号>` 返**该号** org; 未知号返 Unauthenticated(宁空注入不冒名, 踩坑7 修法在位)✓。
- 同源反代 `/?dao_acct=<号>` 浏览器打开即自动登录整官方 Devin SPA(webapp_host 改写在位, 无回弹)✓ 实机截图。
- 统一外壳多实例开页 `_shellResolveOpen` 同源相对 URL 形态确认。
- 新增 CI 安全护栏测试: vendor-one 在位时断言多实例/钉号/反代源完整搬运(97/97)。

## R186 · 冷启动全复验(全新 VM) + 会话搜索浮层(Ctrl+F SearchConversation 同位)

全新 VM 全链路复验(全后端·零 GUI): IDE 3.4.27 下载解压 → windsurf_auth 四步登录(credentials.toml
同源落盘) → 官方 LS 自持 boot → GetUserStatus ✓ → vendor-one 装配(dao-one@2.26.8·上游 dao-vsix
已从 3.58.11 演进到 3.58.16, build 即自动跟随) → VS Code 装 vsix → 9920 /api/health ✓ /shell ✓
`/api/devin/login` auth1 ✓ 多实例钉号 post-auth 返本号 org·未知号 Unauthenticated ✓ `/?dao_acct=` 200 ✓。

对照收敛(反者道之动·官方 workbench 真源提取): 官方 chat-client 内部快捷键面(jd.*, 非 contributes
键位)含 SearchConversation=Ctrl+F(命令 devin.cascade.chat.searchConversation)——插件此前无此面。
- 面板 webview 同键同位落地会话搜索浮层: 匹配行高亮 + n/m 计数 + Enter/Shift+Enter 巡航 + Esc 关闭。
- official-parity 新增 CHAT_CLIENT_KEYS 审计表(chat-client 内部键位逐条归类, 与 29 条 contributes
  KEYMAP_AUDIT 分野不混)。
- 官方另有 Start With History 开关(setStartWithHistoryEnabled)与 CloseActiveCascadeTab 等
  chat-client 键位, 列为后续对位点(如实待办)。98/98 测试。

## R187 · Start With History 开关同位(官方真源逐字)

官方 workbench 真源: 组件 label "Start With History" + tooltip "When enabled, messages will
automatically include your recent coding history for better context awareness."; 状态
startWithHistoryEnabled 为 workbench 本地态(初值 false), LS 二进制实测无 start_with_history
专用 RPC/字段——即官方该开关亦为客户端态, 效果在消息侧注入。
插件同位落法: 空态页(官方新会话首页同位)加同名开关(官方 label/tooltip 逐字), 面板本地持久
(vscode.getState); 开启时新会话首条消息前置 <recent_coding_history> 摘要块, 数据同源
GetUserTrajectoryDescriptions(current)→GetUserTrajectory 末尾步骤(commit/user/viewed/intent)。
边界(如实): 官方注入的具体历史格式为 workbench 内部实现(压缩产物不可读), 本实现为同语义适配,
非逐字节同格式; Arena 首条暂不附带(后续可扩)。99/99 测试。

R187 实机验证补记: 本 VM 全新环境 GetUserTrajectoryDescriptions 返回空(无编码轨迹), 开关开启
后端到端实测消息未附块且模型回 SWH-NO——即空轨迹优雅降级为不附带, 与设计一致; 正路径以
stub-LS 单测覆盖(swhContext: 空轨迹/RPC 失败→空串, 有轨迹→结构化块)。100/100 测试。

## R188 · 官方 chat-client 键位全表对位(jd 枚举 21 动作逐条)

官方真源(3.4.27 workbench): jd 枚举 21 动作 + iPi 键位映射 + wtr 运行面归类
(DetectedAndRunByWindsurfIde/DetectedByWindsurfIdeRunByChatClient/DetectedAndRunByChatClient)
逐条提取。插件 CHAT_CLIENT_KEYS 全表审计: parity 12 条(Ctrl+F/Ctrl+L/Ctrl+Shift+L/Ctrl+N/
Ctrl+./Ctrl+'/Ctrl+Shift+./Ctrl+//Ctrl+Shift+//Ctrl+;/Ctrl+Shift+M/Ctrl+Alt+C 全部 webview
同键实装), no-surface 8 条(cascade 多标签组/步骤评审/plan 模式——插件单会话面无对应 UI, 如实
归类不伪装), host 1 行(宿主侧会话切换 3 动作)。101/101 测试。

## R189 · 未接入 77 RPC 逐项甄别 + Share conversation 实装

反提官方 3.4.27 LanguageServerService 全 169 方法, 对账插件已接入 92, 余 77 逐项甄别
(official-parity.js RPC_GAP_AUDIT): ux 12(候选) / ux-done 1 / telemetry 12 / completion 18
(宿主 IDE 补全域) / experiment 9 / internal 19 / removed 2(GetConversationTags 系后端实测
"feature has been removed") / deploy 4。首个 ux 实装: Share conversation——官方同参
CreateTrajectoryShare{cascadeId,shareStatus:TEAM}(后端实测返回 shareId), 链接同官方
{webappHost}/windsurf/conversation-shares/{shareId}, 🔗 按钮生成并复制。102/102 测试。

## R190 · 官方语音转写对位(GetTranscription)

官方真源: LanguageServerService.GetTranscription{metadata,audio_data(bytes)}→{transcribedText}。
后端实测: espeak 合成 wav base64 直发 → 返回 "Hello world, this is a test." ✓(tone 无语音→空)。
插件对位: micBtn 主路径改为 MediaRecorder 录音→base64→host GetTranscription→transcribedText
入 composer; getUserMedia/MediaRecorder 不可用回退原 Web Speech, 两者皆无则隐藏。103/103 测试。

## R191 · RPC 甄别后端实测再校准

对 R189 的 ux 候选逐一后端实测, 以官方 LS 真实回应校准归类:
- SetPinnedContext / SetPinnedGuideline → unimpl(LS 回 "not implemented", 官方自身未实现)
- GetCascadeModelConfigs → unimpl("use GetUserStatus instead", 插件已接 GetUserStatus)
- GetKnowledgeBaseItemsForTeam → removed("knowledge base feature has been deprecated")
- GetProfileData: 需 Devin session token 域鉴权(API key requires token authentication), 保留 ux
- GetSuggestedContextScopeItems: 需工作区文件追踪就绪("relative filepaths must not be empty"), 保留 ux

### R190 实测暴露缺陷与修复
实机测试暴露: 第三方 VS Code webview 权限策略禁麦克风(Permissions policy violation:
microphone is not allowed → getUserMedia NotAllowedError), MediaRecorder 路径在第三方宿主不可达。
修复(后端打动一切): getUserMedia 被拒时改由扩展宿主进程系统录音(ffmpeg pulse/avfoundation/dshow),
停止后同路 GetTranscription 转写入 composer; record-state 双向同步按钮态。104/104 测试。

## R192 · 官方 bug 报告对位(SubmitBugReport) + 甄别再校准

官方真源: SubmitBugReport{metadata,description,bug_type(ide|cascade),diagnostics_json,screenshot,tab_info,other}
→{messageLink}; 官方面板 bugType 选项 IDE/Cascade。后端实测: 返回真实 Slack messageLink。
插件对位: 会话 meta 行 🐞 按钮 → QuickPick 类型(Cascade/IDE) → InputBox 描述 → 官方同参提交 → toast 显示 messageLink。
再校准: GetGithubPullRequestSearchInfo → removed(deprecated); GetChatMessage/RawGetChatMessage → internal(HTTP 415 非 JSON 通道);
RecordChatFeedback 保留 ux(legacy chat 域, 插件回合反馈已走云端 RecordCortexFeedback)。105/105 测试。

## R194 · 官方头像对位(GetProfileData) + RPC 甄别审计收敛(ux 清零)

官方真源: extension.js 登录后 `getProfileData({apiKey})`→`profilePictureUrl`→prepareProfilePictureBase64
入状态栏账户面(try/catch+sentry 静默容错)。插件对位: 账户卡同路同参取头像, 宿主侧取回转 data URI
(webview CSP 放行 img-src data:), 失败静默不阻断账户卡(与官方同语义)。
边界(如实): 本 VM 免费账号域后端回 "API key requires token authentication"——官方自身在此域同样
静默失败, 头像不显示为官方同态。
甄别收敛(反提 3.4.27 调用点 + 后端实测): GetSuggestedContextScopeItems → internal(官方 workbench/
extension 均无调用点, 仅 proto 定义; suggestionSources 全枚举仍报 relative filepaths must not be empty);
RecordChatFeedback → internal(官方无调用点, legacy chat 域)。至此 169 方法审计 ux 候选清零。106/106 测试。

## R195 · 三大如实边界收口(全后端实证 + 官方 bundle 调用点审计)

| 边界(HANDOFF 主攻项) | 收口实证 |
|---|---|
| 跨端实时推送(R168 空帧) | 官方 3.4.27 workbench + extension 两 bundle 调用点审计: StreamCascadeReactiveUpdates / StreamUserTrajectoryReactiveUpdates / StreamCascadePanelReactiveUpdates 均零调用点(仅 proto/service 定义)——官方自身不消费跨端实时推送, 插件 pull-on-refresh 即官方同态; 插件把 PanelReactiveUpdates 用作变更信号系超官方增强 |
| MCP 双 LS 闭环(R172 PARTIAL) | 生产 ls-boot 全参路径(--codeium_dir/--database_dir/--workspace_id + AddTrackedWorkspace)哨兵 server 实测: RefreshMcpServers→GetMcpServerStates 即见 states.len=1(哨兵进程状态可见)——A 侧 {} 确证为最小 harness 局限而非产品缺口 |
| Memories 创建路径 | 官方 bundle 反提: memory 面仅 updateCascadeMemory(workbench 记忆编辑 UI)/deleteCascadeMemory 调用点, 无任何创建路径(memory 由 Cascade 代理运行产生); 插件 update/delete 已同位(local-api /api/memories/*), 官方等价面齐平 |

> 至此 HANDOFF 主攻项 1–3 全部收口; 剩余: 官方 UI 视觉 1:1 实机对照、官方不可达能力如实标注维持。

## R196 · 双 IDE 实机 UI 对照(官方 IDE 真机登录并排比对) + composer 微对位

冷启动官方 IDE 3.4.27 真机登录(反者道之动: 后端 auth1→show-auth-code 取一次性 code→GUI 仅粘贴,
Playwright/CDP 取 code 不经人工浏览器), Editor 模式 Cascade 面板与插件面板并排截屏比对。
已同位确认: W 空态卡(Cascade Code + Ctrl+. 徽记 + Try Devin Cloud)、Recent sessions、composer
(+/Code/模型/agent 切换/mic/send)、Local+workspace target 行、云端会话同源互见(官方 Agent 面板
即见插件侧创建的会话)。本轮微对位: composer 占位官方双态同文(失焦 Focus input (Ctrl+L)/聚焦
Ask anything, workbench 真源字串), target 行 emoji→SVG 图标(官方无 emoji)。107/107 测试, v1.5.33。

## R197 · 顶栏逐项对位: 工具行 SVG 图标化 + 官方头像圆片同位

官方顶栏(3.4.27 真机): Agent|Editor 切换居左、账号头像圆片(LY)居右。VS Code 宿主不可注入原生
标题栏(宿主如实边界), 插件面板首行同位承载: Agent|Editor 双钮已同位; 本轮把 🔗/🐞/📚/⚙ emoji
工具钮全部替换为官方风格 SVG 线性图标, 并新增右端账号首字母圆片(acctChip, 登录态即显 LY,
点击开账户卡, 与官方顶栏头像同语义)。实机验证: v1.5.34 装回 VS Code 后圆片/图标齐显。

## R198 · dao-one 归一插件装入官方 Devin IDE · 双向对照 + 数据同源实证

devin-remote/core/dao-one v2.26.12 vsce 打包 → ELECTRON_RUN_AS_NODE + out/cli.js 后端安装进官方
IDE(~/.devin/extensions), 重启即激活: 状态栏 道Agent Pro·道/0号/Dao:9924 齐显(9920 被 VS Code 侧
dao-desktop 占用, dao-one 自动让位 9924, 道并行而不相悖)。数据同源实证(全后端): 两端 /api/health
均 dao-vsix 3.58.20; 两端 /shell 均 200; 共用 ~/.dao 单一账号库(dao-accounts-auth.json 同一账号
两端互见)。即「VS Code 装 dao-desktop ↔ 官方 IDE 装 dao-one」双向等价、共享一套底层数据。

## R200 · Agent 整窗看板官方同文对位(实机截图闭环比对)

官方 Agent 模式真机截图逐块比对后收敛错位清单并全数修复: 第三泳道 Finished→**Ready**(官方同文,
含状态映射 finished→Ready); 全部界面文案英文化与官方一致(Search sessions... / Unread / Pinned /
Archived / Local / Recent / Loading… / No sessions / Session/Status/Updated 表头 / just now·m·h·d
ago 相对时间 / Display·Updated); 泳道头加官方样式状态图标(◌/⧖/✓); 卡片元行去状态 chip(列已表意,
官方卡即 标题+云标+时间)。109/109 测试, v1.5.35 实机装回复验(Ready 泳道/英文全量齐显)。

## R201 · 头像账号菜单官方同构(实机反提官方 GlobalActivity 菜单)

官方 IDE 实机点开顶栏头像菜单逐项反提(截图闭环): Devin Account(email - username)/Devin
Settings/Devin Usage/Sign Out ┃ Editor Settings/Open Keyboard Shortcuts/Extensions/Configure
Snippets/Tasks/Themes ┃ Check for Updates.../Docs/Join the Community/Changelog/Download
Diagnostics。插件头像圆片点击即弹同构菜单, 命令路由全走官方真源(反提官方 extension.js OPEN_*
registerCommand): Docs→docs.windsurf.com?referrer=extension、Community→windsurf.com/redirect/
windsurf/community、Changelog→windsurf.com/changelog、Usage→getDevinViewUsageUrl 同构
(auth/devin/start?redirect_uri=app.devin.ai/auth/windsurf/continue&prompt=none&intent=website);
编辑器组直通宿主原生命令(openSettings/openGlobalKeybindings/view.extensions/openSnippets/
tasks/selectTheme/checkForUpdates); Sign Out 走插件 logout; Diagnostics 走 status-info。
110/110 测试, v1.5.36 实机装回复验(菜单三段结构与官方逐项同文同序)。

## R202 · composer 占位官方真源纠偏(反者道之动·workbench 反提)

反提官方 3.4.27 workbench 真源: composer 输入框占位为**单一静态串**
`pe.placeholder ?? "Ask anything - use '@' to mention code blocks"`——官方**不做失焦/聚焦切换**。
R196 曾把 chat-client 快捷键提示项 `{id:"focus-input",text:"Focus input"}`(与 ask-anything/
new-chat/megaplan/conversation-mention 同属提示项枚举)误当作 placeholder, 造成插件失焦显
"Focus input (Ctrl+L)"、聚焦显 "Ask anything" 的双态错位。本轮纠偏: 占位统一为官方同文静态串,
去除 focus/blur 切换监听。110/110 测试, v1.5.37。

## R203 · 空态标题/副题官方四态同文(反提 workbench Ydr 真源)

官方空态(Ydr)按模式四态: **Cascade**(粗体) Code/Ask/Planning/Testing + 各态专属副题
(Code=Kick off a new project…; Ask=Ask questions. Get suggestions. Plan your next move.;
Planning=Plan changes before implementing.; Testing=Build and validate…end-to-end.)。
插件此前标题不加粗、副题恒为 Code 态。本轮: 标题 <b>Cascade</b> + 模式词(picker label
"Plan" 空态呈官方 "Planning"), 副题随模式官方同文切换。111/111 测试, v1.5.38。

## R204 · 云标官方 cloud-simple SVG 化(反提 workbench 真源)

官方 Try Devin Cloud 钮图标为 cloud-simple SVG(GDs 容器 viewBox 24 · path stroke:none
fillRule:evenodd fill:currentColor, lde 组件), 非 emoji。插件此前 tryCloud 钮/agent 选择器
云图标/Agent 看板卡片云标均为 ☁ emoji。本轮: 反提官方 path 全量落 CLOUD_SVG, 三处同源替换
(panel tryCloud/AGENT_ICONS + agent-board 卡片云标), 图标含 <svg 时走 innerHTML 渲染。
112/112 测试, v1.5.39。

## R205 · 模型选择器过滤行官方同源(反提 workbench 真源)

官方模型弹层顶部过滤行(wMs 组件): magnifying-glass 搜索图标(eA, viewBox 24 · stroke:none
fillRule:evenodd fill:currentColor) + 占位 "Search all models"。插件此前为无图标裸输入 +
中文占位"搜索模型…"。本轮: 反提官方 path 同源落位 modelFilterRow(图标+输入 flex 行),
占位官方同文。113/113 测试, v1.5.40。

## R206 · 模型行计价/推荐官方同源(反提 workbench 真源)

官方模型行计价标签: multiplier===0 → "Free"(tooltip "No credits used"); N →
`${parseFloat(N.toFixed(3))}x`(tooltip "Nx credits"); 默认排序 Recommended。插件此前把
" · Nx" 拼入名称再正则回提, 且用 ⭐/🔒/🖼 emoji 徽标(官方无)。本轮: credit 原值直通
webview, creditBadge 官方同式渲染 Free/Nx + 官方 tooltip, 推荐项官方默认排序前置,
emoji 徽标全去(门控走灰置+tooltip)。114/114 测试, v1.5.41。

## R207 · 检索/浏览步卡图标官方同源(反提 workbench 真源)

官方对话流检索/浏览步卡图标为 SVG 三源: folder-open(Analyzed) / magnifying-glass(Searched) /
file-text(Read), 均 viewBox 24 · stroke:none fillRule:evenodd fill:currentColor。插件此前用
🗀/🔍/📄 emoji(含展开明细目录项 🗀)。本轮: 官方三 path 逐字同源落 FOLDER_SVG/SEARCH_SVG/
FILE_SVG + BROWSE_ICONS 映射, 卡头与目录项全量 SVG 化。115/115 测试, v1.5.42。

## R208 · 变更卡 Accept/Reject 官方同文(反提 workbench 真源)

官方代码变更卡操作钮/回执标签为 "Accept"/"Reject"/"Accepted"/"Rejected" 英文同文。插件此前
用 ✓/✗ 符号钮 + 中文"已接受/已拒绝"标签。本轮: 三处官方同文替换(操作钮 Accept/Reject +
回执 Accepted/Rejected), tooltip 保留中文释义。116/116 测试, v1.5.43。

## R209 · 回合尾反馈钮官方同源(反提 workbench 真源)

官方回合尾 👍👎 反馈钮为 thumbs-up/thumbs-down SVG(viewBox 24 · stroke:none
fillRule:evenodd fill:currentColor), tooltip "Good response"/"Bad response"(插件已同文)。
插件此前用近似 lucide 描边路径(stroke-width:2 非官方)。本轮: 官方两 path 逐字同源替换
UP/DN 常量, 渲染属性与官方容器一致。117/117 测试, v1.5.44。

## R210 · Customizations 页头官方同文(反提 workbench 真源)

官方 Customizations 页头: title "Customizations" + description "Customize Cascade to get a
better, more personalized experience."。插件 QuickPick 此前 placeholder 为自撰中文混排。
本轮: QuickPick title/placeholder 官方同文。118/118 测试, v1.5.45。

## R211 · 模型弹层 Order by 排序菜单官方同源(反提 workbench + LS 真源)

官方 wMs 过滤行右端 settings-slider-ver 钮开排序菜单: "Order by" + clientModelSorts 选项
(默认项不列, 点选中项复位), 分隔线下官方同文 "All models draw from your Devin ACU balance"
(usesACUs 态)。数据真源: GetUserStatus → cascadeModelConfigData.clientModelSorts
(Recommended/Provider/Cost, groups 按 modelLabels 官方序)。本轮: ls-bridge 新增
listModelSorts(), host 直通 sorts 至 webview, 过滤行右端官方同源 slider 图标钮 + 排序菜单,
选中排序时按官方 groups 分组渲染。119/119 测试, v1.5.46。

## R212 · 官方全量本源反挖 + 官方图标库整合(反者道之动·先拿到底)

一次性全量反提官方 workbench 本源: 115 枚官方图标(ariaLabel→viewBox+paths+fillRule 逐字同源)
落 dao-cascade/official-icons.js(svg(name,size) 同构官方容器); 官方 UI 文案全量清单
(placeholder/tooltip/children/title/label/description 共 1800+ 串)与插件覆盖对账落
official-corpus/(strings.json/strings-ext.json/strings-coverage.tsv/icons-missing.txt/
doc-urls.txt/rpc-ext.txt/rpc-wb.txt)。首批接线: mtShare→share-os, mtCustom→book,
mtSettings→settings-gear-1, send→arrow-up, Local→macbook, folder→folder-1(全数官方同源
替换 lucide 近似图标)。120/120 测试, v1.5.47。

## R213 · 终端卡官方动作 + 官方 tooltip 批量同文(corpus 缺口首批消化)

按 R212 corpus 缺口清单批量整合: ①终端卡 ⌘ emoji → 官方 console-simple 图标, 新增官方同文
"Copy command"(剪贴板) 与 "Insert in terminal"(host 活动终端 sendText 不回车) 动作钮
(square-behind-square-2 / arrow-corner-down-left 官方同源图标); ②变更卡 Accept/Reject
tooltip → 官方同文 "Accept file"/"Reject file"; ③会话内查找钮 tooltip → 官方同文
"Previous (Shift+Enter)"/"Next (Enter)"/"Close (Escape)"。121/121 测试, v1.5.48。

## R214 · 空态/计数/发送钮官方同文批量(corpus 缺口消化二批)

①模型弹层空态 "无匹配模型" → 官方同文 "No results"(options.length===0 分支真源);
②会话查找计数 "N/M" → 官方 "`${E+1} of ${I}`" 格式即 "N of M", 零命中 "0/0" → 官方 "No results";
③发送/停止钮 tooltip → 官方同文 "Send"/"Cancel step"(workbench 真源 tooltip:"Cancel step",
title:qe(5515,"Send"))。122/122 测试, v1.5.49。

## R215 · 轨迹 timeline 宿主→webview 渲染断链修复

此前宿主 _handleTimelineList 已产出 type:"timeline"(GetUserTrajectory 步列 items{ts,icon,text}
+ branch), 且分发器认 "timeline-list", 但 webview 既无触发者也无渲染者(死链)。修复: 顶栏新增
mtTimeline 钮(官方 timeslot 同源图标, tooltip 官方同文 "Open trajectory dashboard") → 开
#tlPanel 面板并发 timeline-list; 新增 type:"timeline" 渲染器(branch 头 + 步行列表), 刷新钮
tooltip 官方同文 "Refresh trajectory list", 空态官方同文 "No trajectory steps available"。
123/123 测试, v1.5.50。

## R216 · 模型弹层 Beta/New/Fast 官方徽标同源

官方真源(反提 workbench): xMs/kMs/TMs 徽标配置 {label:"Beta"|"New"|"Fast",
className:"text-text-accent-primary"}; 语义 isBeta→Beta(betaWarningMessage 为 tooltip),
否则 isNew→New; fastStatus.isActive→Fast(fastStatus.tooltip)。ls-bridge listModels 直通
isBeta/betaWarningMessage/isNew/fastStatus 四源, host config-options 透传, webview mkIt
渲 .mbadge(accent 色)徽标, tooltip 同源。124/124 测试, v1.5.51。

## R217 · 命令审批官方同文(Command Awaiting Approval / Permission required)

官方真源(反提 workbench): 待审命令浮标 "Command Awaiting Approval", 审批钮 Run/Skip(sVs);
非命令类工具审批头 "Permission required"。宿主 permission 帧新增 header 字段: RUN_COMMAND
待审步 header="Command Awaiting Approval" + title=命令行; webview 头文案 "权限请求:" →
官方同文(header 缺省 "Permission required")。125/125 测试, v1.5.52。

## R218 · timeline 步列图标官方同源化(emoji 全清)

轨迹 timeline 步列 8 类 emoji(⎇💬✦📄🔍✎⚑⚠) → 官方图标键(commits/bubble-5/devin-logo/
file-text/magnifying-glass/pencil/flag-1/exclamation-triangle), 宿主发 icon 键, webview 经
OICONS(official-icons 全量库)渲官方 SVG, 未知键回退文本。126/126 测试, v1.5.53。

## R219 · 终端卡结果语义官方同文

官方 Ddr 真源: done→"Ran terminal command", error→"Error running terminal command"。终端卡
退出码徽标 tooltip 采官方同文; 空输出 "(无输出)" → 官方同文 "No output was captured."。
127/127 测试, v1.5.54。

## R220 · 模型排序菜单 Learn about models 官方同文链接

官方真源: 排序菜单尾部 usesACUs 态显 ACU 信息, 否则显 "Learn about models" 链接
(docs.windsurf.com/windsurf/models)。插件排序菜单尾补官方同文链接项, 经 store-open
(vscode.env.openExternal) 打开官方文档。128/128 测试, v1.5.55。

## R221 · Recent sessions 行内钮/DeepWiki 头图标官方同源化

Recent sessions 行内 ✎/⤓/🗑 emoji → 官方 pencil/arrow-inbox/trash-can-simple 同源 SVG;
DeepWiki 卡头 📖 → 官方 book 同源 SVG(均经 OICONS/official-icons 全量库)。129/129 测试, v1.5.56。

## R222 · composer 图像附件钮官方同源化

composer 🖼 emoji → 官方 images-1 逐字同源 SVG(official-icons)。麦克风钮官方 115 枚图标库
无 mic 同源项, 诚实保留现状待后续官方源定位。130/130 测试, v1.5.57。

## R223 · Auto-Run 策略官方四档语义(Off/Allowlist/Auto/Turbo)

官方真源: jUs={DISABLED:"Off",OFF:"Allowlist",AUTO:"Auto",EAGER:"Turbo"}, 设置项官方同名
cascadeAutoExecutionPolicy / cascadeAllowedCommands / cascadeDeniedCommands, 官方释义
"Cascade auto-runs allowlisted commands and asks before denylisted ones, with the deny
list taking precedence"。RUN_COMMAND 待审步先过策略: 拒绝清单优先; Turbo 全放行; Auto 依
LS shouldAutoRun; Allowlist 依允许清单命令头; 否则官方 Run/Skip 审批。新增
dao.cascade.autoRunPolicy / .allowlist 命令与账号菜单入口。131/131 测试, v1.5.58。

## R224 · Settings 页 General 区 Auto-Run 策略行

Settings 整页 General 区新增 Auto-Run 策略行: 现值徽标(cascadeAutoExecutionPolicy 官方同名
globalState) + 更改/Allow·Deny List 入口(直通 R223 命令)。载荷新增 autoRunPolicy 字段。
132/132 测试, v1.5.59。

## R225 · 运行占位官方同文 "Running..."

发送后等待首帧的 "…" 占位 → 官方同文 "Running..."(官方 workbench 运行态状态文), 呼吸脉冲
样式; 首个 thought-delta/assistant-delta 抵达即移除。133/133 测试, v1.5.60。

## R226 · 会话行内钮/模型选择器 tooltip 官方同文

corpus MISS 消化: 重命名会话 → "Rename conversation", 移除会话 → "Delete conversation",
模型 pill title "Model" → "Model Selector"(均官方 tooltip 逐字同文)。134/134 测试, v1.5.61。

## R227 · 历史会话 QuickPick 官方同文占位 "Search sessions..."

corpus MISS 消化: 历史会话 QuickPick 占位 "加载历史会话" → 官方同文 "Search sessions..."
(matchOnDescription 同启)。135/135 测试, v1.5.62。

## R228 · Share Conversation 官方同文大小写

corpus MISS 消化: 分享钮 tooltip "Share conversation · 生成团队分享链接并复制" → 官方逐字
同文 "Share Conversation"。136/136 测试, v1.5.63。

## R229 · corpus 覆盖对账刷新 + composer 钮官方同文 tooltip

strings-coverage.tsv 全量重扫对账(97 行状态修正, 消除 R226–R228 后的陈旧 MISS, 余 335);
composer 附加钮官方同文: 附加上下文 → "Add Context", 附加图片 → "Attachment"。
137/137 测试, v1.5.64。

## R230 · 用户消息悬停 Edit message 官方同文钮

corpus MISS 消化: 用户消息气泡悬停新增 ✎ 编辑钮(官方同文 tooltip "Edit message"),
点击回填 composer 并聚焦, 与回退/开分支钮同排。138/138 测试, v1.5.65。

## R231 · 步卡取消钮/Auto-Run 设置入口 tooltip 官方同文

corpus MISS 消化: 步卡取消钮 "取消此步骤(CancelCascadeSteps)" → 官方同文 "Cancel step";
Settings 页 Auto-Run 策略"更改"钮加官方同文 tooltip "Auto-run settings"(btn 支持 tip 参)。
139/139 测试, v1.5.66。

## R232 · LS 连接丢失横幅官方同文

心跳节拍(60s→15s)并入 probeAlive 探活, 状态翻转即推 webview: 丢失展示官方同文横幅
"Connection to language server lost. Reconnecting...", 恢复自动隐去。140/140 测试, v1.5.67。

## R233 · 终端卡运行中 Stop command 官方同文钮

corpus MISS 消化: RUN_COMMAND 步运行中(in_progress·无退出码)终端卡头新增停止钮(官方同文
tooltip "Stop command"), 直通 CancelCascadeSteps 单步取消; cmd-card 载荷带 stepIndex。
另: sync-official 对账重跑(官方 3.4.27 无漂移, 计数重写)。141/141 测试, v1.5.68。

## R234 · web 请求审批官方语义 Allow web request?

READ_URL_CONTENT 待确认步 → 官方同文审批卡 "Allow web request?" + 副文 "Cascade wants to
fetch this URL", 三档官方 action: Allow(ALLOW_ONCE) / Always allow origin(ALWAYS_ALLOW_ORIGIN)
/ Reject(REJECT), 经 HandleCascadeUserInteraction.readUrlContent 回传。会话行导出钮 tooltip
官方同文 "Export"。142/142 测试, v1.5.69。

## R235 · 全量反向审计 PARITY-PLAN 落库

反者道之动全面对账: RPC 169/96/73 分层(核心候选/遥测/补全域/平台)、步卡 86 官方步型
14 结构化 72 通用卡(P0/P1/P2 分级)、字符串 337 MISS 七域聚类、图标 100 缺口、设置页
分区对照、功能级模块缺口与 P0–P2 路线图, 全部落 PARITY-PLAN.md(活文档)。
143/143 测试, v1.5.70。

## R236 · P0: web 步卡 + 建议回复 chips

PARITY-PLAN P0 首批: SEARCH_WEB{query,webDocuments[],webSearchUrl} / READ_URL_CONTENT
{url,resolvedUrl,webDocument}(字段反提 CortexStep* proto 真源)→ globe 官方图标 web 步卡
(Searched web for … / Read <url> + 文档清单点击外开); SUGGESTED_RESPONSES.suggestions[]
→ 官方式点击即发 chips。144/144 测试, v1.5.71。

## R237 · P0: MCP 工具卡 + 待办清单卡

MCP_TOOL{serverName,toolCall{name,argumentsJson},resultString} → toolbox 官方图标 MCP
卡(server·tool + 展开参数/结果); TODO_LIST{todos[]{content,status 三态},isInitial
Creation} → checklist 官方图标待办卡(✓/◐/○ 行 + done/total 徽标)。字段均反提官方
CortexStep* proto 真源。145/145 测试, v1.5.72。

## R238 · P0: Accept all 批量清算(ResolveOutstandingSteps)

≥2 张待清算变更卡时展示官方同文 "Accept all" 批量钮, 直通 ResolveOutstandingSteps
{cascadeId}(官方 proto 真源: 仅 cascade_id 一字段), 回执后全部卡标记 Accepted 并收起
批量条。146/146 测试, v1.5.73。
