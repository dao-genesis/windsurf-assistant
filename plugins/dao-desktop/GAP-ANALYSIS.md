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
