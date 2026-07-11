---
name: testing-dao-desktop-cascade
description: 在 Devin Desktop 实机测试 dao-desktop 插件 Cascade 面板（卡片渲染/交互）的流程与排坑。适用于验证 Cascade 轨迹步卡片、面板 UI 变更。
---

# dao-desktop Cascade 面板实机测试

## 环境准备
1. Devin Desktop 二进制：`~/devin-desktop/Devin/bin/devin-desktop`（若无，从用户提供的 zip 安装）。
2. 打包安装插件：
   `cd plugins/dao-desktop && npx @vscode/vsce package -o /tmp/dao.vsix --allow-missing-repository --skip-license --allow-star-activation && ~/devin-desktop/Devin/bin/devin-desktop --install-extension /tmp/dao.vsix --force`
3. 安装后必须在 Devin Desktop 里 `Ctrl+Shift+P → Reload Window` 才会加载新版扩展代码。
4. 面板：侧栏「Cascade · 三模式」；底部状态栏应显示 已登录 + LS 端口 ✓。登录账号见 Devin Secrets。

## 触发轨迹步
- 在面板输入框发英文只读指令即可触发 browse 类步，例如：
  "List the files in X directory, grep for Y in file Z, read the first 10 lines of W. Read-only."
- Cascade 完成一般 10-20s。上游模型（SWE-1.6 Slow）偶发 "The model produced an invalid tool call." —— 这是后端问题，不是插件 bug；重发一条新消息继续即可。
- computer tool 打字偶发丢字符（如 README→EADME），发送前截图核对输入内容。

## 排查技巧
- 扩展日志：`~/.config/Devin/logs/*/window*/exthost/output_logging_*/1-Devin Desktop.log`（panel.js 里 `_log` 输出到 "Devin Desktop" 输出通道）。
- Webview DOM 排查：`Ctrl+Shift+P → Developer: Open Webview Developer Tools`，Console 上下文切到 active-frame，可 querySelector 检查卡片。
- 经典坑：`#log` 是 flex 列容器；子卡片若带 `overflow:hidden` 且无 `flex-shrink:0`，内容溢出时会被压成 ~2px 细线（DOM 内容完好但不可见）。已在 25.1 修复（`#log > * { flex-shrink:0; }`），若再现类似"卡片消失/变细线"，优先查 flex-shrink。
- "卡片没渲染"先看日志里是否有对应 step 类型输出，再查 webview DOM 是否存在 `[data-tc=...]` 节点，区分扩展侧/渲染侧问题。

## 断言要点（browse 卡）
- list: 「🗀 Analyzed <dir>」+ N 项徽标；展开列目录条目。
- grep: 「🔍 Searched <query> in <file>」+ N 处徽标；展开显示匹配行。
- view: 「📄 Read <file> L<a>-<b>」；点击标题在编辑器打开文件。
- 已知瑕疵：list 卡标题点击会按文件方式打开目录并弹二进制警告。

## Code Maps(Maps 页)测试要点
- 夹具优先用真实生成的地图：直连 LS 发 `GenerateCodeMap{metadata,prompt}`(Connect server-streaming, ~2-3min)。手工构造的最小 .codemap JSON 可能不被 `GetCodeMapsForRepos` 返回(缺 traces/repo 元数据)——只用于归档区兜底显示测试。
- 元数据真源是 `~/.codeium/windsurf/codemaps/codemapindex.json`(starred/archived/fileName)，每步 UI 操作后可 shell 读该文件断言持久化。
- **LS 语义坑**：`UpdateCodeMapMetadata` 是整字段写(未发送字段被重置为 false)，且 `archived:true` 会强制清 starred(即使显式发 `starred:true`)——"归档往返丢星标"是官方行为，勿当插件 bug 修。
- 直连 LS 调试：CSRF 取自 LS 进程环境 `tr '\0' '\n' < /proc/$(pgrep -f language_server|head -1)/environ | grep CSRF`；端口在 Reload Window 后会变化(状态栏 LS:xxxxx 或 /proc 扫描)。
- 面板首页链接行(Agents/Maps/Rules…)与最近会话条目距离很近，点击易误入会话视图；误入后点面板头部 ↺/+ 回首页再点 Maps。
- 共享地图导入(⇘)：codeMapId = 分享链接末段(`uuid-hash` 复合 ID)；`GetSharedCodeMap`/`SaveCodeMapFromJson` 直连时须补完整 `metadata{ideName,…,apiKey}`(缺任一字段 400)；导入后 LS 自动重发号 id(新时间戳后缀)。
- Suggested maps 需活动 Cascade 上下文，无会话时 `GetCodeMapSuggestions` 直接 500("no context available")——× 忽略钮(DismissCodeMapSuggestion)只能在有建议+有会话时实测。

## Devin Secrets Needed
- Devin Desktop 登录账号/密码（outlook 账号）
- GitHub PAT（push / PR / 评论）
