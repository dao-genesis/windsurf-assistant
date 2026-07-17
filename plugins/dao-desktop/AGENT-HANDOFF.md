# dao-desktop 后续 Agent 交接基线

## 当前基线

- 主战场：VS Code 等第三方 IDE；官方 Devin Desktop 是行为与资源真源。
- PR：`#86`，分支 `devin/1784291390-p1-parity`。
- 当前状态：PR 仍为 open/clean，未宣称已合并。
- 已验证：官方 LS 共生发现；官方 IDE 关闭时插件自持同源 LS；`GetUserStatus` 返回同一账号与 Free 计划。
- 测试：`plugins/dao-desktop` 下 `node --test test/*.test.js`，当前 63/63 通过。

## 已落地范围

1. 账号菜单、Settings、Customizations、MCP 富卡片与工具启停。
2. 官方登录态复用：`credentials.toml` / `state.vscdb`。
3. 官方 MCP、Rules、Workflows、Skills、Memories、Cascade 轨迹 RPC。
4. LS 三级接入：发现运行中的官方 LS → host state → 自持启动官方二进制。
5. 自持 LS 使用真实 VS Code 工作区，注册 `AddTrackedWorkspace`，并清理临时端口目录。
6. 统一面板、Proxy Pro、Cloud/ACP、PCB、FreeCAD 等既有模块与本地 API。

## 后续 Agent 首要任务

1. 不走 GUI-first；优先 CLI、RPC、文件、`/proc`、扩展日志。
2. 在官方 IDE 关闭状态验证：
   - 自持 LS 的 workspace_id 与官方同构；
   - Cascade 轨迹、Steps、Transcript 跨宿主可见；
   - Settings/MCP/Rules/Skills/Workflows/Memories 读写双向同步。
3. 在官方 IDE 运行状态验证：
   - 插件只发现并复用官方 LS；
   - 不重复自持进程；
   - 同一配置、会话与账号不分叉。
4. 将每个可复现差异加入 `GAP-ANALYSIS.md`，配套 headless regression test。
5. 每次代码变更后运行：

```bash
cd plugins/dao-desktop
node --check dao-cascade/ls-boot.js
node --check extension.js
node --test test/*.test.js
npm run build
```

## 重要约束

- 不提交密码、PAT、API key、CSRF、session token 或认证附件。
- 不把 PR 的 green CI/dao-auto 标签当作 merged 证据；必须查 GitHub API。
- 不声称已经完成完整 1:1 parity；当前仍有双向同步与模块级对照缺口。
- 不使用破坏性 git 命令，不 amend，不直接 push main/master。
