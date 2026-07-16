# 官方 Devin Desktop IDE ↔ dao-desktop 插件 · 全模块差距矩阵(R146)

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
| 内置浏览器 | openBrowser(IDE 宿主) | ❌ | Electron 宿主能力, VS Code 扩展面无法对等; 外链替代 |
| 语音录音 | StartAudioRecording(ExtensionServer 宿主) | ◐ | composer 🎙 走 Web Speech(R143), 宿主级录音不可达 |
| 登录/登出 | login/loginWithAuthToken/logout | ✅ | cascadeAuth + CLI 编排(R132/R138) |
| 提交信息 | generateCommitMessage | ✅ | GenerateCommitMessage → SCM 输入框 |
| Lifeguard/Dev 服务 | 内部 dev 工具 | ❌(不做) | 官方内部调试面, 非用户功能 |
