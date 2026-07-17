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

## R67 ACP 生命周期断言点（防 OOM 回归）
- 泄漏监控（任何面板测试全程跑）：`pgrep -af 'devin acp|dao-acp' | wc -l` + `free -m` 每 20s 采样。健康态 = 进程数恒定（proxy 对 + devin acp + summarizer ≈ 4）、内存无单调增长。若进程数持续攀升即 OOM 回归（修复前实测 5 分钟 660MB→7GB）。
- 退避实证：面板日志（"Devin Desktop" 输出通道 log 文件）应出现 `[acp] 启动失败(退避 Nms)` 且 N 指数增长（5s→…→300s 封顶），每次失败后紧跟 `devin acp 退出 code=null`（进程被杀净）。
- 已知功能缺口（截至 R67）：Devin Local 模式在 `devin acp` 未鉴权时不回复——ACP 要求先调 `authenticate`(meta.api_key)，面板尚未把已获取的 Devin Cloud Session Token 传给它。测 Local 模式前先确认此项是否已补，否则"无回复"不是回归。
- `2-道Agent.log` 可能出现 `[spawn-hook-acp]` 高频刷写（~18/s，疑官方 windsurf LS 重连循环触发）；若进程/内存稳定则非泄漏，但可作为后续排查线索。

## dao-one 折入验证（devin-remote 侧）
- dao-desktop 改动要进 dao-one：`cd devin-remote && node tools/sync-dao-desktop.js` → `cd core/dao-one && npm i && node build.js && npx @vscode/vsce package --allow-missing-repository --skip-license --allow-star-activation`（dao-vsix 需先 `npm ci`，否则报缺 sucrase/yazl）。
- 安装后验证折入生效：`grep -c _ensureAcp ~/devin-one-profile/../devin-one-ext/dao.dao-one-*/vendor-desktop/dao-cascade/panel.js`（或对应扩展目录）应 >0。
- dao-one 面板登录：面板头部若显示「未登录 — 插件自持登录」，点 登录 → 浏览器出 CLI code 页 → Copy code → 回面板粘贴到「粘贴一次性登录 code」输入框 → 提交，toast「Devin Cloud 认证成功 (Session Token)」即成。
- VS Code 对照侧：装 windsurf-assistant 的 dao-desktop VSIX 后，右侧 CHAT 区出现「DEVIN DESKTOP: CASCADE · 三模式」同构面板，登录态/LS 端口与 Devin Desktop 侧共享（状态栏 `引擎✓·已登录(<账号>)·LS:<port>`）。

## 冷启动安装与登录（全新机器）
- 下载安装：`curl -s https://windsurf-stable.codeium.com/api/update/linux-x64/stable/latest` 取 url，解压到 `~/devin-desktop/`。
- 登录走浏览器 OAuth：IDE 点 Log in → app.devin.ai 输邮箱/密码 → 成功页的 `devin://codeium.windsurf?devin_code=...` 深链在无 xdg 协议注册时不会自动回传；从成功页 HTML 抓该链接后执行 `devin-desktop --open-url "<devin://…>"` 手动回传，再在 IDE 弹窗点 Yes。
- Linux 无 OS keyring 时会弹 "OS keyring couldn't be identified" —— 选 "Use weaker encryption" 即可继续。
- 命令面板输入中文可能丢失（computer tool CJK 打字不稳），搜命令用英文前缀如 "Devin Desktop"。
- 深链另一法：登录成功页若弹 "Open xdg-open?" 且点击无效，从成功页 HTML 抓 `devin://codeium.windsurf?devin_code=...` 后 `devin-desktop --user-data-dir <同一profile> --open-url "<链接>"`（profile 参数必须与运行实例一致才会路由到该实例）。
- 隔离 profile 启动：`--user-data-dir ~/devin-one-profile --extensions-dir ~/devin-one-ext --disable-workspace-trust --password-store=basic`。

## R57 融合三件套断言点（备份/宿主态）
- 自动备份：打开面板历史列表(↺)触发 sessions-list → 1.5s 去抖后写 `~/.wam/conversation_backups/_index.json` + 转录 md（头含 `source: dao-desktop(Cascade 插件版)`）。
- 手动备份：命令「Devin Desktop: 备份全部 Cascade 对话」，toast 显示「新写 N / 共 M」；未变化轨迹按 lastModifiedTime 水位跳过（saved=0 即证明增量生效）。
- 宿主态归一：点面板底栏 LS/引擎区弹账户卡（触发 GetUserStatus）→ `~/.dao/windsurf-host.json` 应含 `fused.account`；首页链接行点 MCP → `fused.mcp`；备份后 → `fused.cascadeBackup`。
- 注意：账户卡入口是底栏右侧（引擎/LS 区），点最左 Local 无反应。

## v1.2.0+ 三视图架构断言点
- 三视图: `dao.cascade`(官方 1:1 对话, 零管理入口)、`dao.unified`(归一 /shell 图标栏)、`dao.proxyPro`(独立 Proxy Pro)。快速定位: 命令面板 "Devin Desktop: Focus on Proxy Pro View" / "Focus on 归一 · 插件本源 View"。
- Cascade 断言: 首页只有 composer/模式选择/Recent sessions+View all; 若出现 Agents/MCP/Memories 等管理行即回归(旧 xrow)。
- 归一断言: 左侧 48px 图标栏 🏠🔀🌐💬💉🧩🐙(+🪟🔎⚙)+底部⟳, 点击导航图标应高亮并渲染板块; 栏内不得有 Proxy Pro 项。
- Proxy Pro 断言: 独立视图含 添加渠道/配路由/刷新, 渠道存 `~/.dao/proxy-channels.json`; 与 dao-vsix 的 `~/.codeium/dao-byok` 路径互不写入。
- 对照法: 同装 dao-vsix + dao-proxy-pro(devin-remote 侧打包, dao-vsix vsce 打包需加 `--baseContentUrl/--baseImagesUrl` 否则 README 相对链接报错; 先 `npm install` 而非 `npm ci`——无 lockfile), 打开 "Dao: Open Unified Browser Shell" 对照 /shell 结构与共存。
- 打包坑: 直接 vsce package 可能报缺 `media/icon.png`; 用 `node build.js` 会自动生成占位图标并产出 `dao-desktop-<version>.vsix`。
- GUI 窗口最大化: `DISPLAY=:0 wmctrl -r "<窗口标题>" -b add,maximized_vert,maximized_horz`(注意别把激活焦点落在 Chrome 上)。
- git push 可能遇平台侧 403(git-manager 代理写权限故障, 读正常); 勿嵌 token 绕过, 上报并稍后重试。

## 官方 vs 插件同屏对照法（1:1 差异走查）
- 官方原生 Cascade 侧栏视图在「Agent」模式下可能整块空白；切到顶部「Editor」标签后，官方 Cascade 出现在右侧副侧栏，插件「Devin Desktop: Cascade」可折叠展开堆在其下方 → 同屏上下对照最省事。
- 登录回传：OAuth 成功页 HTML 抓 `devin://codeium.windsurf?devin_code=...`（browser 工具会把整页 HTML 存 /tmp/page_html_*.html，直接 grep），再 `devin-desktop --open-url "<链接>"`，IDE 弹窗点 Yes 即成，无需 CDP 脚本。
- 插件 composer 首次点击常不获焦（面板重渲染夺焦）：要精确点中输入文本行（placeholder 那一行），输入前务必截图核对文字已落。
- 插件模式(Code)与模型选择器是原生 `<select>`，在 X11 截图环境点击**看不到弹出层**（官方为自绘富菜单）——对照时这是已知差异点，勿误判为点击无效。
- 账号菜单对照：标题栏右上头像即官方原生菜单；插件账号信息入口只有面板底栏（点右侧引擎/LS 区弹中文配额卡）。

## Devin Secrets Needed
- Devin Desktop 登录账号/密码（outlook 账号）
- GitHub PAT（push / PR / 评论）

## 统一面板(dao.unified)设置板块测试要点 (v1.3.5+)
- 打开: 命令面板 `>Devin Desktop: 打开归一面板`，左侧图标轨点齿轮⚙进设置。面板默认很窄，先拖宽 sidebar 分隔条再截图。
- 图标轨易混淆：注射器=反向注入、拼图=MCP 管理、章鱼=GitHub 舰队，点错后直接点正确图标即可。
- 诊断与运维按钮 id: setCk(复制key)/setDt(token)/setRls(重启LS)/setDg(诊断)；导入用 data-setimport 属性。
- toast 长错误会截断：点 toast 右侧 ∧ 展开可读全文（如 RPC validation error）。
- Cursor 导入走官方同款流程: 先弹 InputBox 索取以 `.cursor/rules` 结尾的目录, 再 `ImportFromCursor{sourcePath}`; 测试时可先建临时 `.cursor/rules/x.mdc` 再填其路径。
- 本机通常无 ~/.config/Code/User/settings.json 和 ~/.vscode/extensions/extensions.json → VS Code 导入应报"未检出"明确错误。

## 统一面板 webview 排坑 (v1.3.6 实测教训)
- 面板卡死"加载中…"且所有板块不可用: 先开 workbench DevTools(命令面板 Open Webview Developer Tools 实际打开主窗 DevTools), Console 找 `SyntaxError ... document.write` —— 多半是 webview 内联脚本坏了。
- **模板字面量转义坑**: webview 脚本写在 unified-panel.js 的反引号模板里, 正则中 `\/` 会被求值成 `/`, `:\/\//` 变 `://` + 行注释, 整段脚本语法错误。凡在该模板里写正则须用 `\\/` 或避免斜杠正则。离线 `node --check` 抽出的原始源码验不出此坑(未经过模板求值), 要用"求值后的 HTML"验证。
- 面板高频重渲染: 扩展 ~3 次/秒推 `state` 消息, 每次 render() 整树 innerHTML 重建 → 板块里的 iframe 会反复重载、input 无法输入焦点被夺。验证法: 面板 frame 里挂 MutationObserver 数 #main 重建次数 + message 计数器。
- 二分定位法: 直接改 ~/.devin/extensions/dao-agi.dao-desktop-<ver>/ 下已安装副本 + Reload Window, 无需重打包; 先与上一版 unified-panel.js 整文件互换确认文件级归因, 再逐块回退。
- /web 站内代理可 curl 直测: token/port 在 ~/.dao/local-api.json, `curl "http://127.0.0.1:<port>/web?t=<token>&u=<encoded url>"`。
- 冷启桌面app: `DISPLAY=:0 setsid nohup ~/devin-desktop/Devin/devin-desktop --password-store=basic --disable-workspace-trust <repo> &`(DISPLAY 必须 :0, 用 wmctrl -a 聚焦)。
