# dao-desktop 后续 Agent 交接基线（R158–R172 收官版）

## 本源需求（锚定不变）

- 插件安装到 VS Code 等**第三方 IDE**，对照官方 Devin Desktop IDE 实现 1:1 功能对位。
- 除对话框可有两个外，**其余一切复用官方资源**：官方 LS 二进制、官方 RPC、`credentials.toml`、`state.vscdb`、`mcp_config.json`、`~/.devin/rules`、`global_workflows`、`skills`、`memories`、云端 Cascade 轨迹。
- 同一电脑同时装官方 IDE 与本插件时，两边**同源同证**：文件存储、对话存储、配置信息完全同步，一边操作另一边可见。
- 一切走**后端路径**（CLI/RPC/文件/进程），不走 GUI-first。
- 先验证再声明；不生产水，只搬运官方资源；如实标注不可达边界。

## 当前基线

- 版本：v1.5.32；测试 106/106（`DAO_NO_LS_BOOT=1 node --test test/*.test.js`）；`node build.js` 构建通过。
- PR #91–#126（R158–R194）全部 CI 全绿并已合入 main（均经 GitHub API `merged: true` 权威确认）。
- 官方真源：`/home/ubuntu/devin-desktop/Devin`（LS 3.4.27，`resources/app/extensions/windsurf/bin/language_server_linux_x64`）。
- 全量差距与实证记录见 `GAP-ANALYSIS.md`（R158–R195 逐轮入档）。

## 已实机实证（同步语义三分野）

1. **Settings = 云端域并行即见**（R171）：A 侧 `SetUserSettings`（注意字段是 `userSettings`，不是 `settings`），B 侧 live 读全跟随。
2. **定制类/MCP = 文件真源 + Refresh 即见**（R165/R166/R170/R172）：
   - Rules/Workflows/Skills → `RefreshCustomization`；MCP → `RefreshMcpServers`。
   - `truth-watch.js` 自动守望官方落盘真源（去抖 1.5s），变更自动重读。
   - 双 LS 定制类双向 PASS（R170）；MCP 在插件自持 LS 侧刷新即见 PASS（R172）。
3. **会话轨迹 = pull-on-(re)start**（R160/R163/R168）：无跨端实时推送；由 `refreshSessions` 命令、`POST /api/cascade/refresh`、`dao.cascade.autoRefreshMinutes` 兜底承接。

其余已闭环：官方 LS 自持启动（随机端口文件 `^(\d+)`、CSRF header `x-codeium-csrf-token`、RPC 必带 `metadata{ideName,ideVersion,extensionName,extensionVersion,apiKey}`）；官方 64 命令/12 键覆盖审计 100%（covered 22 + na 11，pending 0）；Cascade Bar 六键；Lifeguard/ACP 官方读路径；诊断（`GetDebugDiagnostics`/`GetUserTrajectoryDebug`）；后端登录链（windsurf_auth 四步 → credentials.toml 同源落盘）。

## 未实现 / 如实边界（下一个 Agent 的主攻方向）

1. ~~跨端实时推送~~ **已收口（R195）**：官方 workbench/extension 两 bundle 调用点审计——`StreamCascadeReactiveUpdates`/`StreamUserTrajectoryReactiveUpdates`/`StreamCascadePanelReactiveUpdates` 均零调用点（仅 proto/service 定义），官方自身不消费跨端实时推送；插件 pull-on-refresh 即官方同态（插件把 PanelReactiveUpdates 用作变更信号系超官方增强）。
2. ~~MCP 双 LS 闭环~~ **已收口（R195）**：生产 ls-boot 路径（`--codeium_dir`/`--database_dir`/`--workspace_id` 全参 + AddTrackedWorkspace）后端实测哨兵 server `GetMcpServerStates` 即见 `states.len=1`——R172 的 A 侧 `{}` 确证为最小 harness 局限而非产品缺口，生产路径 MCP 面初始化闭环。
3. ~~Memories 创建~~ **已收口（R195）**：官方 bundle 反提——memory 面仅 `updateCascadeMemory`/`deleteCascadeMemory` 调用点，无任何创建路径（memory 由 Cascade 代理运行产生）；插件 update/delete 已同位（local-api /api/memories/*），官方等价面齐平。
4. **官方 UI 视觉 1:1**：GUI 层对照（双 IDE 并行全 UI 一致性）尚未做，需实机界面实测。
5. **官方不可达能力保持如实标注**：VS Code 原生标题栏重写、Tab supercomplete（官方 RPC 已 deprecated）、Lifeguard 检查面板原生渲染、完整 ACP 管理面板写操作。

## 工作流约定

- 每轮：实机验证 → 更新 `GAP-ANALYSIS.md` → `DAO_NO_LS_BOOT=1 node --test test/*.test.js` → `node build.js` → 独立 PR → CI 全绿 → automerge → GitHub API 确认 `merged: true` 后才可宣称合入。
- 每次代码变更后运行：

```bash
cd plugins/dao-desktop
node --check extension.js
DAO_NO_LS_BOOT=1 node --test test/*.test.js
node build.js
```

## 重要约束

- 不提交密码、PAT、API key、CSRF、session token 或认证附件；不打印 token。
- 不把 green CI/dao-auto 标签当作 merged 证据；必须查 GitHub API。
- 不伪造官方不存在的能力（实时推送、memory 创建等）；不把冷拉说成实时同步。
- 不修改测试掩盖真实失败；不用 GUI 假象替代后端实证。
- 不使用破坏性 git 命令，不 amend，不 `git add .`，不直接 push main/master，不跳过 hooks。
