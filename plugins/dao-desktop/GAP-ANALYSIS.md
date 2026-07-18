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

> 剩余(不伪称): 官方标题栏原生改写(VS Code 扩展 API 无此上限, 以 editor/title+状态栏为等价位) —— 持续对照推进。
