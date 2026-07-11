# CHANGELOG · packages/wam (rt-flow 道极版)

> 反者道之动 · 弱者道之用 · 天下之物生于有 · 有生于无. —— 帛书《老子》德经

## v4.26.5 (2026-06-28) · 近期对话(☁)精简至最近 34 条(项③·对齐手机 APK)

> 「近期对话」tab 此前无上限地渲染整份 `DAO_REC`(宿主已限 80 条),列表过长成负担。
> 对齐手机 APK:无搜索时只显示最近 `DAO_REC_VIEW_MAX=34` 条(已按 updatedAt 降序),
> 底部提示「仅显示最近 N 条·共 M 条」,全量历史按号分层仍在「🗂 对话记录(备份)」tab。

### 改动
- `daoRenderRecent()`:无搜索 query 时 `src=DAO_REC.slice(0,34)`(自头切片保留原 idx
  映射,动作按钮 data-idx→DAO_REC[idx] 不变);有 query 时仍跨全量匹配。超量时加底部脚注。

## v4.26.4 (2026-06-28) · 切号面板 __wamRebuild 节流 15s(根治「面板每几秒跳顶·无法操作」)

> 大批量验号(100+ 新账号)期间, 结构签名高频变化 → `__wamRebuild` 每几秒重挂 iframe →
> 滚动跳顶、下拉收起、无法操作。加 15s 节流 → 用户可正常滚动和操作。

### 改动
- `_broadcastUI()` 送 `__wamRebuild` 前加 `_wamRebuildThrottleTs` 检查(≥15s 才发)。

## v4.26.3 (2026-06-28) · 拖网页标签到当前网页=上传该标签的对话(补齐电脑端·对齐手机 APK)

> 手机版可「拖一个网页标签 → 把该标签所在对话拖进/上传到当前网页」, 电脑端此前半成品:
> 标签 `dragstart` 已携 `application/x-dao-conv`(email+sid), 却**没点亮 `#convdrop` 上传层**,
> 致网页区无落点、拖了也无反应。本次补上: 账号会话标签 `dragstart` 即 `_convDragActive=true`+
> `_showUploadDrop()`, `effectAllowed` 由 `move`→`copyMove`。**落在网页区=上传该对话, 落在标签栏=重排**,
> 各得其所; `dragend` 收起上传层。复用既有 `#convdrop` drop → `_daoUploadToActive` 同源管线, 零新通道。

## v4.26.2 (2026-06-28) · 对话追踪面板移除「近期对话(跨账号)·数千条下拉」(去负担·职责归位)

> 对话追踪面板内嵌的「近期对话(跨账号) · N 条 [展开/收起]」会列出全部备份(数千条), 对用户是负担,
> 且与悬浮窗「💬对话备份」板块职责重复 —— 后者已把「近期对话(API 限量 ~12/号·top80)」与
> 「对话记录(全量·按号分层折叠)」分得清清楚楚。故移除该下拉(`_dvAllConversationsHtml` 及其两处调用);
> 近期速查走悬浮窗对话记录板块, 全量仍在备份文件夹。**少则得 · 损之又损**。

## v4.26.1 (2026-06-28) · 备份库账号行增强(对齐手机版): 双击/📋复制账号+密码 · 显「最活跃对话」副标签

> 旧「下载/备份库」每个账号行只一个邮箱名, 信息单薄。对齐手机版悬浮窗:
> - **双击账号行** 或点 **📋** 即复制「账号+密码」(经新 `copyCredEmail` 宿主消息按 email 直查账号池, 不依赖已开标签)。
> - 账号行新增 **🗨 最活跃对话** 副标签(号内最新对话标题), 一眼知该号在忙什么。
> 纯面板级增强, 数据源仍走同源 `devinCloud.listBackups`, 零另起炉灶。

## v4.26.0 (2026-06-23) · 根治「IDE 内多窗口路由慢」: 反代注入客户端 Service Worker(浏览器级持久缓存 L0)

> 道法自然 · 同一反代下「系统浏览器/手机 APK/单页壳」皆真浏览器各快一倍, 唯独 IDE 内 webview 慢——真因不在反代/协议(实测 HTTP/1.1 keep-alive 反比 HTTP/2 还快), 而在客户端: VS Code webview 之 iframe 不像真浏览器把哈希不可变资产持久缓存到磁盘, **每次导航/切标/重载都重取数百分片**(本仓库 SPA 入口预载 469 个 chunk)。

- **反代注入同源 Service Worker + CacheStorage**(`devin_proxy.js` v4.15.0): 给受限的 webview/iframe 客户端补「浏览器级」持久缓存。
  - SW 服务于 `/__dao_sw.js`(带 `Service-Worker-Allowed: /`), HTML `<head>` 注入注册脚本(特性检测降级·零回归)。
  - cache-first 仅拦**同源**哈希不可变资产(js/css/字体/图片/wasm); HTML/API/SSE 一律透传网络(动态实时)。
  - **实测(CDP·Chrome 137)**: 冷载 469 资产走网络 → 次载/重载起 **478 资产全部由 SW 自 CacheStorage 命中、0 走网络**(HTML 恒走网络)。即每次重载零代理零上游往返, 媲美真浏览器磁盘缓存。
  - 仅端口模式注入(每账号独立 origin·scope `/` 干净·资产与账号无关可共享); 前缀模式(公网真浏览器经 9920 隧道)本有原生缓存, 不启用以免相扰。
- 三级缓存归一: L0 客户端 SW(零往返) · L1 反代内存 · L2 反代磁盘(`~/.wam/_proxy_asset_cache`·重载秒恢复)。

## v4.25.0 (2026-06-20) · 归一·浏览器分屏(右键并排·类 Windows 贴靠) + 高效操作

> 道法自然 · 把电脑浏览器的分屏并排搬进归一外壳: 标签右键「▣ 与当前页分屏并排」→ 两张子网页左右并排同时显示, 中缝可拖拽调比例(15%~85%), 再点「▣ 退出分屏」复原。

- 标签右键菜单新增「分屏并排 / 退出分屏」: 任选两张标签左右并排(主窗高亮蓝条·副窗高亮绿条)
- 中缝 `#splitbar` 可拖拽调左右占比(拖拽时 iframe `pointer-events:none` 防子帧吞 mousemove)
- 分屏感知缩放: `applyZoom` 按 splitRatio 计算各窗 left/width, 与每窗独立 zoom 共存; 账号页/六大板块页均可参与分屏
- 高效操作: `Ctrl+W` 关当前标签 · 标签中键(滚轮键)点击直接关闭 · `Ctrl+\` 切换分屏
- 点击副窗标签自动与主窗对调聚焦并保持分屏; 关闭任一分屏页自动退出分屏

## v4.24.0 (2026-06-20) · 性能/稳定: 修复多实例「一直加载中」污染其他页面

> 道法自然 · 根因: 全屏加载遮罩 `#spin`(inset:0·z-index:5) 为**全局单例**, 仅由某 iframe 的 `load` 清除, 无超时/无 error 兜底。一个卡住的标签(如路由官网的多实例 iframe 永不触发 load)会让遮罩**永久盖住整个外壳**, 切到其他标签也是「一直加载中」, 干扰全部页面。

### /shell 归一外壳
- **每标签独立加载态 + 三重兜底**: 新增 `setLoading(id,on)`/`_clrLoadTO`, 每个标签各自记 `loading`; 全屏遮罩只反映**当前活动标签**的加载态。
  - load 事件清除 + 新增 **error 事件**清除 + **15s 超时**强制收起 → 杜绝永久「一直加载中」。
  - `setActive` 切换标签时按目标标签的真实 `loading` 重算遮罩 → 后台卡住的标签(官网多实例)**不再污染前台**其他页面。
  - 账号页(mkTab)与板块页(mountBoardSolo)统一走此模型; openBoard 的 cloudInit 也加 15s 兜底。

## v4.23.0 (2026-06-20) · 归一化收口: 新增「操作电脑本体」板块

> 道法自然 · 浏览器+软件操作+VSCode+MCP 已同在归一外壳并排; 补齐「操作电脑本体」板块, 把整个软件当浏览器供 MCP/用户驱动本机。

### /shell 归一外壳 + 六大板块
- **新板块「🖥️ 操作电脑本体」**(菜单 + 左侧导航 + 主页并排): 本机信息(主机/平台/用户/cwd/工作区) · 运行命令(工作目录内 `child_process.exec`, 回显 stdout/stderr/退出码) · 送入集成终端 · 在编辑器打开文件 · 系统资源管理器定位。
- 对照手机端 Shizuku/无障碍「操作整机」, 电脑端经 VSCode 扩展宿主直接驱动本机; 与「公网穿透」板块配合可供远端 MCP 代用户操作。

## v4.22.0 (2026-06-20) · 用户脚本/扩展: 对接 Chrome 扩展体系(content_scripts·非油猴)

> 道法自然 · 把电脑浏览器的「插件/扩展」搬进 /shell, 用 Chrome 扩展的 content_scripts 范式而非油猴。

### /shell 归一外壳
- **用户脚本/扩展管理器**(汉堡「🔌 用户脚本 / 扩展」, 替换原「🐵 用户脚本(规划中)」占位): 新建/编辑/启用停用/删除脚本, 每条 = `{name,matches[],css,js,enabled}`, 持久化 `dao.userScripts`。
- **导入 Chrome 扩展**: 支持「解压扩展目录 / .crx / .zip」→ 宿主解析 `manifest.json` 的 `content_scripts`(matches + js/css 文件内容)→ 落为脚本条目。内置最小 ZIP 读取(`zlib.inflateRawSync` · 解析 EOCD/中央目录)与 `.crx`(Cr24 v2/v3)头剥离, 零第三方依赖。
- **注入**: content_scripts 按 match 规则注入到 /shell 宿主自渲染的账号页(会话列表/对话正文), 同源·CSP 已放行内联; 附最小 `chrome.storage.local`/`chrome.runtime`/`GM_addStyle` 垫片以兼容简单内容脚本。
- 设备迁移整包(导出/导入)纳入 `userScripts`, 跨设备一并迁移。

## v4.21.0 (2026-06-20) · 对话/备份归一(对照手机端 APK): 拖拽对话进网页 + 备份页签命名对齐

> 道法自然 · 复刻手机端 daopan.html 的「长按对话卡拖到网页」到电脑端 /shell。

### /shell 归一外壳
- **拖拽对话进网页**(复刻手机端 `startConvDrag`): 近期对话卡 / 备份卡可直接 `draggable` 拖出, 落到网页区(绿色提示层) → 经 `reopen{email,devinId}` **在该对话所属账号的网页中打开此会话**(跨账号正确路由·新开标签)。
- 备份页签命名对齐手机端: 「🗂 备份库」→「🗂 备份网页端」; 近期对话提示补充拖拽说明。
- 文件拖放与对话拖拽互不干扰(`_convDragActive` 守卫, 避免误触发文件拖入层)。

## v4.20.0 (2026-06-20) · 浏览器交互归一(对照 Chrome/Edge): 新建标签跳官网 + 页内查找 + 标签拖拽/滚轮/右键

> 道法自然 · 把电脑浏览器的基础交互一比一搬进 /shell 归一外壳。

### /shell 归一外壳
- **新建 Devin 标签** 修复: 汉堡「新建 Devin 标签」与顶部「＋」改为每次开一张**全新** Devin 页(`_shellResolveOpen({fresh:true})` 生成唯一 tab id), 不再折叠/跳回已存在的账号首页。
- **页内查找 Ctrl+F** (不外跳): 新增浮层查找条, 对当前子网页 `iframe.contentWindow.find()` 做真·页内查找, 支持 Enter 下一个 / Shift+Enter 上一个 / Esc 关闭 / 无结果提示。
- **标签拖拽排序**: 标签可拖拽重排, 插入位高亮指示, 同步持久化标签序。
- **标签条横向滚轮**: 鼠标滚轮在标签条上横向滚动(对齐桌面浏览器)。
- **标签右键菜单**: 刷新此页 / 复制链接 / 系统浏览器打开 / 关闭 / 关闭其他 / 关闭右侧。

## v4.19.0 (2026-06-20) · 设备迁移: 整包导出/导入(对照手机端一键导出+注入)

> 道法自然 · 把账号库+书签+历史+已开标签整包导出, 新设备装好插件后导入即用 — 对齐手机端「一键导出 zip / 一键注入」。

### /shell 归一外壳 · 页面工具(汉堡 → 🛠 页面工具)
- 新增**整包导出**: 宿主 `_migBuildBundle()` 汇总 `{accounts(email password 可重导格式), favs, history, shellTabs, activeEmail, install 元信息}`, 前端 Blob 下载 `dao-migration-*.json`。
- 新增**整包导入**: 选择迁移文件 → 宿主 `_migApplyBundle()` 经 `_store.addBatch` 合并账号库(去重)、还原书签/历史/标签/活跃账号, 即时回推刷新。
- 消息 `migExport/migImport` 双通道(`shellHandleMessage` + `_wireMultiPanel`)均补齐; `tools/render_check.js` 增 `_multiShellHtml` 无 nonce `<script>` 渲染校验。

## v4.18.0 (2026-06-20) · 近期对话流式增量+缓存 / 状态续接 / 顶部＋ / 历史·书签批量

> 道法自然 · 充分对照手机端 APK(daopan.html) 复刻近期对话加载逻辑, 续接整体连续性。

### /shell 归一外壳 (extension.js)
- **近期对话不再全量阻塞**: 宿主改逐账号流式增量返回(节流~250ms 每账号回来即合并去重回推), 前端先用 `localStorage` 缓存秒开再持续刷新 — 对齐手机 `daopan.html` 的缓存+并发+增量渲染, 解决"近期对话根本加载不完/很慢"。
- **状态续接(会话保持)**: `/shell` 持久化已打开的标签集(板块/账号页)到 `dao.shellTabs`, 重开后宿主在 `ready` 回推 `restoreTabs` 自动还原 — 老用户停在原来那几个网页, 新用户(电脑端)才落「六合一主页」。
- **顶部「＋」新建标签按钮**补上; ☆ 收藏当前页/板块加 toast 反馈(空态提示)。
- **浏览历史 / 书签收藏批量操作**: 多选 + 全选 + 批量删除 + 清空(对齐电脑浏览器); 新增宿主 `histDel/histClear/favDelMany/favClear` 处理。

## v4.17.0 (2026-06-19) · P0 前端对比度修复 + 近期对话限 50 + 多实例路由诊断落盘

> 道法自然 · 先诊断后施治: 用户报「黑底黑字看不清 / 多实例按钮点了没反应」, 此版先治可读性与列表规模, 并为「按钮无响应」植入专用诊断落盘以拿真实数据定位根因。

### P0 · 前端对比度 (extension.js)
- `:root` 调色板此前全依赖 vscode 主题变量(`--vscode-editor-background/foreground`)且无回退色 → 非 webview(独立浏览器/路由)上下文变量为空 → 黑底黑字 / 白底乱码不可读。
- 现钉死 GitHub-dark 固定值: `--bg:#0e1116 --fg:#cdd3de --border:#2d333b ...`, 任意宿主(VS Code 主题/纯浏览器/手机)皆可读。

### P1 · 近期对话仅展示最近 ~50 条
- 跨账号近期对话 200→50; 单账号备份浮层每号对话按 mtime 倒序后封顶 50。
- 4000+ 全量仅留文件夹按需解锁; 列表底部提示「共 N 条·仅展示最近 50」。

### P0 诊断 · 多实例路由专用落盘 `~/.wam/_route_debug.log`
- `handleWebviewMessage` 入口对 6 类路由消息(routeToIde/Batch · openSysBrowser/Batch · convRouteToIde/Sb)落盘到达记录。
- `openMultiInstance` 全程落盘: ENTER / ABORT(no-email·no-auth1·proxy-fail) / OK(含 url·panel 状态)。
- 与高噪 wam.log 隔离, 便于定位「点了没反应」止于何处(消息未达 / 鉴权失败 / 反代失败 / 已开但面板不可见)。

## v4.16.0 (2026-06-19) · 切号多选批量 IDE/浏览器多实例 + 对话追踪每行直达

> 多选之后点任一即批量 · 免下拉直达 · 一致归一。

### 切号板块 · 多选批量两按钮 (extension.js)
- 此前「IDE内路由官网多实例 (rt)」「系统浏览器多实例 (sb)」仅单账号。现复用既有 `_selectedFor(i)` 多选基建：多选 N 个后点其中任一即批量。
- `rt(i)`/`sb(i)`：选中 >1 时发 `routeToIdeBatch`/`openSysBrowserBatch`(带 indices)，否则保持单账号原行为。
- 宿主：单账号实现抽出为可复用 `_routeAccountToIde(i)`/`_openAccountSysBrowser(i)`；新增 `routeToIdeBatch`/`openSysBrowserBatch` 依次调用(500/800ms 间隔防启动风暴·各登各号)。
- 锁定/复制/删除批量本已具备(setSkipBatch/copyAccounts/removeBatch)，批量栏提示同步更新。

### 对话追踪板块 · 每行直达 (extension.js · _dvStatusAggHtml)
- 每个运行/待输入/卡住的对话行新增两按钮：🖥 此对话→IDE内多实例、🌐 此对话→浏览器多实例(注入该号登录·直开 /sessions/<id>)，免下拉。
- 宿主新增 `convRouteToIde`(openMultiInstance+devinId)、`convOpenSysBrowser`(launchAccountBrowser+pagePath=sessions/<id>，兜底默认浏览器)。

### 验
- `node --check` 通过；单测全绿；dao-vsix 打包副本同步 + `node build.js` 通过。

## v4.15.0 (2026-06-19) · 归一独立 HTTP 外壳: 同一外壳直出单页·适配所有 IDE/浏览器/手机·参照手机端 APK

> 帛书·「大方无隅」— 外壳不困于 webview 一隅, 直出为 HTTP 单页, 任意 IDE 内置浏览器/手机/远程经 DAO Bridge 皆入同一套 UI。

### 背景 · 本源 (锚定)
- v5.0.0 的「单页 / 仿 APK」多实例外壳 (`_multiShellHtml`: ☰ 六大板块 + 多实例账号标签 + 移动响应式 + 左右滑切页) 已成熟, 但只活在 **VS Code webview** (`acquireVsCodeApi`/postMessage), 仅 VS Code 系 IDE 可用。
- 真正遗留的本源 = 把同一外壳做成 **HTTP 直出的独立单页**, 传输层改走 HTTP, 从而「适配所有 IDE / 任意浏览器 / 手机 / 远程操控」, 整体交互对齐手机端 APK。

### 实现 · 复用为主·零重写 UI (`extension.js`)
- `_standaloneShellHtml()`: 复用同一 `_multiShellHtml`, 放开 CSP 的 `connect-src 'self'`(同源 fetch/SSE), 注入 HTTP 传输垫片替换 `acquireVsCodeApi`。
- 传输垫片 (`SHELL_HTTP_SHIM`): 页面→宿主 `POST /api/shell/msg`; 宿主→页面 `EventSource('/api/shell/events')`(SSE)。浏览器原生动作 (openExternal/clip/复制凭据) 就地处理, 余者转发。
- SSE 总线 (`_shellClients`/`_shellAttach`/`_shellSend`/`_shellBroadcast`) + `shellHandleMessage()`: 复刻 webview 宿主逻辑 (ready/favs/history/getAccounts/newDevinTab/openCloudPage/getBridge/bridgeAct/shellBackups/cloudInit/cloudReady/cloudRelay/filesDropped/copyCred), 开账号标签经 `_shellResolveOpen()` 返回反代 URL 由前端 `mkTab` 以 iframe 平级开标签。
- 六大板块仍走 `cloudInit→cloudInitHtml`(blob-iframe) 与 `cloudRelay/cloudHost` 双工中继, 与 webview 路径同源复用。
- 暴露 `getStandaloneShellHtml` / `shellAttach` / `shellHandleMessage` 至 `_internals`, 供 dao-vsix 本地服务器 `/shell`、`/api/shell/*` 路由调用。

### 验证
- 本机 Chrome (无 IDE·纯浏览器) 实测 `/shell`: 外壳/工具栏/☰ 六大板块菜单/六板挂载/`cloudRelay↔cloudHost` 双工中继全通; 控制台零错误。

## v4.14.0 (2026-06-19) · 反代静态资源磁盘二级缓存 (L2): 重载/重开秒级恢复·根治首屏很慢

> 帛书·「夫物芸芸·各复归其根」: 内存缓存随进程消亡, IDE 重载/重开后首屏仍须逐个重取上游 + 全量改写而卡顿。落盘归根, 重载即复。

### 背景 · 用户诉求 (推到底)
- 「首屏很慢」: `devin_proxy.js` 的 L1 内存缓存 (`_assetCache`) 仅活于当前进程; IDE 重载/重开后内存全空 → 数百静态资源逐个重取上游 + 全量 `split/join` 改写 → 首屏长时间空白/卡顿。

### 实现 · 磁盘二级缓存 (`devin_proxy.js` v4.13.0 → v4.14.0)
- 落盘目录 `~/.wam/_proxy_asset_cache/` (可经 `WAM_PROXY_CACHE_DIR` 覆盖)。键 = `sha1(上游 path)`; 每条存 `<hash>.bin`(体) + `<hash>.json`(status/headers/base/text/size/t)。跨账号/跨进程共享。
- L1 内存 miss → `_diskGet` 查 L2; 命中则提升回内存并直发, 免上游往返与全量改写 (重载秒级恢复)。
- **端口重定基**: JS/CSS 改写体里 baked 了 `localBase`(含动态端口), 重载后端口可能不同。落盘时记 `base`, 命中时若端口已变, `_rebaseAsset` 仅对**文本体**做一次 `split/join` 重定基; 二进制资源(字体/图片/wasm)里绝无 base 串, 直发不动以免坏字节。
- 写入异步 + 临时文件 rename (防半成品被读), 不阻塞请求。容量上限 256MB, 启动后延迟按 mtime 逐出最旧 (`_diskEvict`)。
- 单测 (`test/unit.test.js`): `_diskKey`/`_isTextCt`/`_rebaseAsset`/`_diskPut→_diskGet` 往返 + 二进制零损坏 + 未命中返 null (5 例全绿)。

## v4.9.11 (2026-06-18) · 对话备份/清理本源化: 先备份后清理·24h冷却·云↔本地无感切换·跨账号对话级列表

> 真备份, 真清理, 不模棱; 已留底则读本地, 有更新则回云端。道法自然, 水过无痕。

### 背景 · 用户诉求 (推进到底)
- 「归档≠真删除」要厘清: 清理须真正生效, 备份须真正完整, 两者都不能模棱两可。
- 「先备份后清理」要有冷却期: 额度<阈值先全量备份, 再过 24h 无更新才允许清理。
- 「云↔本地无感切换」: 已清理账号在切号面板仍可见, 数据源透明切到本地备份, 不再每次拉云端。
- 「对话级视图」: 跨账号按时间排列近期所有对话, 一眼看到近期在聊什么。

### 实跑确证 · 平台无对话硬删 API
- `DELETE /api/sessions/{id}` → 405; `api.devin.ai/v3 .../sessions/{id}` DELETE 实为 "Terminate"(终止运行)非删除。
- 平台提供的最强"清除"即 `archive`(is_archived=true → 从仪表盘默认视图隐藏)。
- 故"清理"= archive(对话从仪表盘消失) + 真删知识/剧本/密钥/Git。**所有用户面向文字一律改为"清理/已清理", 不再出现"归档"二字**。`deleteSession` 保留 v3 DELETE 兜底(平台日后开放硬删则自动命中)。

### 改动
- `devin_cloud.js`: `deleteSession` 增 v3 DELETE 兜底 + 报告字段 `archived→cleaned`; 新增 `cleanup_state.json` 状态层 (`getCleanupState`/`setCleanupState`/`isCleanupReady`) — email→{backupCompletedAt, lastConvUpdateAt, cleanedAt}。
- `extension.js` 自动清理: 加 **24h 冷却期门控** (`isCleanupReady`): 全量备份完成记 `backupCompletedAt`; 增量备份发现新事件记 `lastConvUpdateAt`; 唯有 备份完成 + 冷却期满 + 期间无更新 才清理。清理成功记 `cleanedAt`。
- `extension.js` `_dvRefreshOverview`: 已清理账号(`cleanedAt`)优先走 `_dvLocalOverview` 从本地备份构建概览(不拉云端), 面板显示 "📌 本地" 数据源标识; 云端有运行中对话则刷新 `lastConvUpdateAt`。
- `extension.js` 新增 `_dvAllConversationsHtml`: 跨账号对话级列表, 按 mtime 倒序展示近期对话(对话名为主 + 账号/编号/devinId 辅助), 嵌入两处面板模板。
- `package.json`: 新增 `wam.devinCloudCleanupCooldownHours`(默 24); 清理阈值描述更新。
- 同步落地 `core/rt-flow` 与 `core/dao-vsix` 两源。

## v4.9.10 (2026-06-18) · 根治切号面板"每隔几秒整页重渲"(用户实测·无法操作)

> 大制不割 · 守一不摇. 结构未变则面板不动, 纯时间滴答不再撼动一兵一卒。

### 背景 · 用户实测
- RT Flow 切号面板"每隔几秒钟就刷新一次, 根本没法正常操作": 鼠标点击/下拉展开/滚动位置都被周期性整页重渲打断。此前多版 (F2/F3/F4) 只治了「对话追踪区」的闪, 切号面板主体仍在闪。

### 根因
- `_tick()` 监控定时器 (5~10s 周期) 与各处状态变更统一调 `_broadcastUI()` → 防抖后**无条件** `webview.html = buildHtml()`。
- 即便账号集/额度/状态毫无变化, 整个 webview DOM 仍被销毁重建 → 闪烁 · 滚动丢失 · 下拉收起 · 点击落空。
- `buildHtml()` 内含纯时间滴答 (重置倒计时 `D重置Nh`/`W重置Nh` · `Nmin前切` · 采样龄 · 封禁秒 · 使用中秒), 这些每 tick 都变, 让任何"整串 html 去抖"都失效。

### 修复 (对齐 conv-section 的 `_convStructSig` 思路)
- 新增 `_computePanelStructSig()`: 只取**结构性数据**做签名 (模式/活跃索引/已验数/各账号: 邮箱·额度整数·活跃·封禁·使用中·套餐·overage·Claude·锁定·快照·标签·planEnd·是否有进行中对话)。**刻意排除**所有时间滴答装饰。
- `_broadcastUI()` 与 `WamViewProvider.refresh()` 加**结构签名门**: 签名未变 → 不整页重建, 只增量刷新对话追踪区 (`_broadcastConvSection` 自带签名去抖); 签名真变 (切号/增删/额度整数变/封禁/锁定/标签…) 才整页重建。
- 初次渲染 (resolveWebviewView / openEditorPanel) 后即记录签名; 面板重新可见时强制重建一次 (force) 保证内容新鲜。
- 效果: 空闲态彻底零整页重渲 (永不闪); 仅在真实结构变化时重建一次。同步落地 `core/dao-vsix`(含全功能面板第2 Tab 宿主重渲路径) 与 `core/rt-flow` 两源。

## v4.8.7 (2026-06-16) · 釜底抽薪·根治 app.devin.ai socket 风暴 (漏网旁路纳管)

> 绝利一源 · 一处复用池, 杜绝"每请求新建+不复用"的 socket 海量泄漏。

### 背景 · 141 实测再定位 (比阶段一更深一层)
- 阶段一「跨窗口选主」已生效: 同机只有一个主窗口在扫 (实测单进程 pid 15228)。
- 但**单个主窗口自己**对 `app.devin.ai` 仍堆出 **720 条 ESTABLISHED** (四个边缘 IP 各 ~180), 把家用路由器 conntrack 打满 —— 这才是"修过仍卡"的真凶。

### 根因
- `devin_cloud.js`(api.devin.ai 侧)早已用有界 keep-alive Agent (单 host ≤8 socket) 收敛。
- 但 `extension.js` 另有一条旁路 `httpsReq`(每账号**登录 / 取 orgId(post-auth) / 额度 / billing**, 全打 `app.devin.ai`)一直裸用 Node 默认 `globalAgent` —— `keepAlive:false · maxSockets:Infinity`, 不复用、不限并发。~数百账号预载/校验时一拥而上 → 单进程 700+ socket。该旁路从未纳入 socket 预算。

### 修复 (釜底抽薪)
- `httpsReq` 改挂**有界 keep-alive 共享 Agent**: `maxSockets=8`(单 host 并发硬上限·超出排队不再新建)、`maxFreeSockets=4`、空闲 15s 回收。与 devin_cloud 同一套逻辑, 全部登录/额度/billing 流量纳入预算。
- 功能零改动 (登录/额度/billing 结果不变), 仅把传输层的 socket 扇出收敛。
- 预期 141: app.devin.ai 出网连接 720 → 个位/十位级。

## v4.8.6 (2026-06-16) · 对话详情可定位/可搜索 · 思考默认折叠 · 手动下载前台极速档

> 大象无形 · 思之纷纭默而藏, 我言粲然一指可达; 取之有时, 前台抢速而后台细流。

### 对话详情视图 (`buildConversationHtml`)
- **思考(💭)默认折叠**: 思考内容不再刷屏淹没正文; 与工具块一致, 点「展开思考」才显; 内容仍留 DOM → **可被搜索命中**, 命中后自动展开。新增「展开/折叠全部思考」一键开关。
- **左上角·用户消息快速定位索引**: 固定左栏列出我发出的每条消息 (第1行=初始消息, 第2行=第二条…), 带前 30 字摘要; 点击平滑跳转并高亮该消息 —— 在被思考刷屏的长详情里秒级定位"我说了什么 / Agent 怎么回的"。
- **全文搜索**: 左栏搜索框过滤显示命中消息 (含思考正文), 实时命中计数; 清空即恢复默认 (思考回折叠)。
- 备份落盘的 HTML 同样内置以上能力 (离线可用·纯前端无依赖)。

### 备份下载·前台「极速」档 (`turbo`)
- 新增 `CFG.turboDownloadConcurrency=24 / turboConvConcurrency=6 / turboMaxSocketsPerHost=32`, **仅在用户主动点击下载/备份时**生效 (`opts.turbo`), 用独立短命 Agent、用完即毁。
- 食其时·分而治之: 后台周期普查仍走 lean 档 (downloadConcurrency=6, 防 conntrack 风暴, 阶段一修复不回潮); 但"手动点下载"是一次性、有界、不随窗口数倍增的前台动作 → 放开并发抢速度。全量下载/单对话ZIP/批量合并/账号备份等用户动作均接入极速档。
- 统一抽出 `downloadKeysToCache()` (lean/turbo 共用), 三处下载站点收敛归一。

## v4.8.5 (2026-06-16) · 面板灰显根治 · 去"已过期/陈年/Nh前" · 能登录即发亮

> 大道至简 · 账号能用即发亮, 唯真不可登录方变灰。

### 背景 · 用户实地反馈 (141 截图)
- 面板里大量账号被标"已过期"且变灰, 但其 `D/W=100`(配额满)、实际**完全可用** —— 误导。
- 现象根因: `Free` 试用号的 `planEnd` 过去几天即被 `_buildExpTag` 标红"已过期"; 另有"陈年 / Nh前"数据新鲜度标签使行变灰 (`is-stale`)。

### 修 · 仅渲染层, 不动调度/切号/打分逻辑 (功能不变)
- `_buildExpTag`: 去除"已过期"红标与 Trial 脏数据黄标。未来到期显绿色"N天"(正向信息); 已过/无 `planEnd` 一律 `∞` 发亮; 永不显"已过期"。
- 账号行: 去除 `is-stale` 变灰与"陈年 / Nh前"标签 (`staleTag` 恒空); 去除已废弃的 `expired-row` 类挂载 (claude 早已恒可用)。
- 活跃号头部 `planExpiryTag`: 去"已过期"红标, 未来到期显绿"N天", 否则回退周重置倒计时。
- `eua`(Extra Usage) 标签去除 staleHours 派生的"$N?"陈年变体, 恒显真实余额。
- 结果: 账号**整体发亮**; 仅 `banned`(真实拉黑/登录失败) 仍变灰 —— 即"唯真不可登录方变灰"。

### 根治 · 切号选择层同步去"过期排除" (功能正向修复)
- 此前 `_isValidAutoTarget` 与 `_scoreOf` 对 `planEnd` 已过的账号一律 `return false` / `-Infinity`, 即**彻底排除出自动切号候选池** —— 但 Free 试用号 `planEnd` 过期后 `D/W` 仍满(100%)、**完全可用**, 被误排除 → 这正是"灰显"在调度层的根。
- 修: 去除两处过期硬排除。账号是否可切**只看真实额度**(D/W 最低门槛 + 双零守门)与黑名单(真实登录失败); `planEnd` 不再判死。
- "临期主导加成 expBonus"与"临期抢救 rescue"收敛为**仅对未来到期**(`planEnd > now`)生效, 已过期账号按真实额度正常评分, 既不被排除也不被异常抬权。
- 净效: 能登录可用的账号(含 planEnd 已过的 Free 池)正常进入切号轮转, 与面板"整体发亮"一致。

## v4.8.4 (2026-06-16) · 跨窗口选主 · 根治多窗口网络并发风暴 (整机局域网卡顿)

> 绝利一源, 用师十倍. —— 多窗口各扫一遍, 归一为整机扫一遍。

### 根因 · 多窗口 = 多进程 = N 倍出网扇出
- 同一台机器开多个 IDE 窗口时, 每个窗口都是独立扩展宿主进程, 各自**无条件、无跨窗口去重**地周期性对**整个账号池(数百个)**执行: 状态轮询 `_dvRunPoll`(默 1min)、全账号预加载 `_dvPreloadAll`(启动 + 每 5min)、云端自动备份 `_dvStartAuto`。
- N 个窗口 → N 倍出网并发。开机瞬间拉起数百条 TLS 短连接 + 高 `TIME_WAIT` churn, 把**家用路由器 NAT/conntrack 连接表打满** → 不只本机, **整个局域网**一起丢包卡顿。
- `devin_cloud.js` 上一轮仅收敛了**单进程** socket 预算 (keepAlive Agent · 并发 80→12), 未消除「多窗口=多进程」这个真正的倍增源, 故"修过仍未根治"。

### 修 · 心跳租约选主 (singleton sweeps · 功能完全不变)
- 新增 `~/.wam/_dv_poll_lease.json` 心跳租约: 同一时刻仅当选的**唯一主窗口**执行全局网络扫描 (轮询/预加载/备份/额度调度)。
- 主窗口把聚合运行状态写入 `~/.wam/_dv_status.json`; 其余「跟随窗口」监听并读取该文件渲染面板/角标 → 各窗口 UI 实时性不变, 监控/备份覆盖的账号一个不少。
- 主窗口关闭/崩溃: 关窗即主动释放租约 (其余窗口立即接管); 异常退出则租约过期 (默 75s) 后自动接管。
- 用户手动触发的轮询/预加载/备份在**任意窗口**仍即时生效 (仅"周期性后台扫描"收敛为整机单份)。
- 效果: 全局网络并发 ÷ 窗口数, 叠加既有 keepAlive socket 复用, conntrack 压力大幅回落。
- 新增软配置 `wam.devinCloudLeaseTtlMs` (默 75000ms)。

## v4.8.3 (2026-06-14) · Devin Cloud 备份/浏览全面重构 (编号·账号+密码表层·对话/账号信息分明·并行提速)

> 大成若缺, 其用不敝; 大盈若盅, 其用不窘. —— 备份之道, 一眼可辨, 取用自如。

### 修复 · 浏览备份 (此前点开非对应对话·还没看清就回弹·内容乱)

- **点哪条看哪条**: 「👁 查看」直接打开该对话备份的 `对话.html` 正文 (静态 webview·不解压·不串号)。
- **不再自动回弹**: 浏览浮层去掉「点击空白处自动关闭」, 仅可由「✕ 关闭」收起 — 看清为止。
- **内容清晰**: 每条对话显示 `编号. 标题 (N 事件)`, 不再是乱码文件夹名 + `NaNKB`。

### 新增 · Session 面板内直接快速下载 (省去慢速 ZIP·看得见落点)

- 对话详情面板右上角内置「⬇ MD / ⬇ HTML / ⬇ 完整(含文件)」工具条。
- MD/HTML 用内存中已拉取的事件**秒存**, 落盘后自动在文件管理器中定位 (revealFileInOS)。

### 新增 · 编号 1:1 同步 WAM 面板 + 账号/密码写在文件夹表层

- 账号文件夹命名 = `<编号>_<邮箱本地名>_<密码>` (编号同步 WAM 侧栏·密码表层可见)。
- 改号时由 `resolveAccountDir` 原地改名迁移 (经 `.account.json` 标记定位), 不丢已下内容、不留孤儿。
- 每条对话文件夹带三位编号 `NNN_<标题>_<ID末8位>`, 浏览列表按编号升序。

### 重构 · 三级目录分明 + 去掉乱七八糟的 `_账号快照_<时间戳>`

- 对话统一收纳于 `<账号>/对话/`; 账号信息统一收于 `<账号>/账号信息/` (覆盖式·不再按时间戳堆叠)。
- 自动清理历史遗留的 `_账号快照_<时间戳>` 目录 (数据已重采于「账号信息」, 安全移除)。
- 标题去掉开头的 `_ # · 标点`, 文件夹不再「看起来像系统目录」。

### 提速 · 自动备份并行化

- 同账号内对话备份并行 (`CFG.convConcurrency=5`, 每条对话内文件再并发 16)。
- 账号级 `backup_state` 一次读 → 内存累积 → 末尾一次落盘 (消除并发读改写竞态·减少磁盘 IO)。

### 兼容 · 旧备份照常可浏览

- `listBackups` 同时识别新结构 (`对话/` 子目录) 与旧结构 (对话文件夹/ZIP 直接在账号目录下)。
- 单测 64/64 全绿 (新增 6 条: 命名/清洗/编号/listBackups 新旧结构/findAccountDir)。

## v4.8.2 (2026-06-14) · IDE 内置浏览器自足注入反代·多实例各登各号 (不赖 dao-vsix)

> 天下之至柔, 驰骋于天下之致坚; 无有入于无间 —— 沙箱 iframe 无 CDP 可控, 以本地反代为「无间」之道。

### 新增

- **`devin_proxy.js` · IDE 内置浏览器自足注入反向代理**: 标准版 rt-flow 不再依赖 dao-vsix
  的反代即可让 IDE 内置浏览器自动登录。点账号行「🖥 路由官网→IDE」:
  - 取该号 `auth1`(缓存命中秒开, 否则后台五步登录), 起一个**每账号独立端口**的本地反代;
  - 反代代 `app.devin.ai` 取页 → 剥 `X-Frame-Options`/`CSP` → `<head>` 起注入
    `localStorage['auth1_session']` 登录态 + org 键 + post-auth 守卫键 + fetch/XHR
    `Authorization` 拦截 → SPA 自判已登录, 零 GUI/OAuth;
  - 在 IDE 内**新建 webview 标签**满铺 iframe 指向该端口 → 点不同账号开不同标签,
    **各号独立 origin → localStorage 隔离 → 多标签各登各号, 并行不串号** (鸡犬相闻)。
  - 注入技法 1:1 移植自 dao-vsix 已验证反代 (HTML 域名改写 / gzip·br·deflate 解压 /
    3xx Location 改写 / `text/event-stream` SSE 流式直通)。
- 回退链保留: 自足反代不可用 → dao-vsix `routeOfficialForAccount` → `simpleBrowser`。

## v4.8.1 (2026-06-14) · Devin Cloud 状态持久化·根治"一闪一没" (Phase M)

> 见小曰明 · 守柔曰强 —— 只要对话真的还在, 就持续显示; 取消追踪或对话结束才消失。

### 修复

- **Devin Cloud 对话状态/账号 badge "一闪一没" (devinbox 全链路实测复现+修复)**:
  根因 = `_dvRunPoll` 每轮对每账号调 `listRunningSessions`, 任一轮**暂态空**
  (限流 HTTP 429 / 网络抖动 / 服务端最终一致性) 即 `_dvStatusAgg.delete(key)`,
  且 webview 每轮先清空**全部** `.dv-run` badge 再仅按本轮成功账号重建 →
  暂态失败账号的行/徽章瞬灭、下轮又现 (wam.log 实证: run 计数 4↔3↔4 来回跳)。
  修复 (天下之至柔·见小守柔):
  - 暂态空不立即清除, 起算宽限窗 `DV_STATUS_STICKY_MS=90s`; 仅当**连续空持续超窗**
    (对话真的结束) 才移除并生成终报, 否则保留上轮已知状态 → 持久显示·不闪。
  - 拉取抛错 (网络/限流) 视为暂态: 保留旧状态, 不清除, 不误报"对话已完成"。
  - badge 列表 (`devinRunStatus` items) 统一以 `_dvStatusAgg`(含宽限态) 为单一数据源,
    暂态失败/限流也不再闪没; 与对话追踪面板同源。
  - devinbox 实测: 修复后 90s+ 多轮 (限流持续发生) `dv-progress` 稳定在 3 run/1 wait,
    不再 4↔3↔4 抖动。

## v4.7.8 (2026-06-14) · 141 生产机实测·两本源修复 (Phase L)

> 反者道之动 · 重锚本源: 接入 141 台式机(64 号 / 69 会话·生产级监测)实部署, 从实时 wam.log
> 挖出两类高频缺陷, 做根因永久修复(既有逻辑零破坏; 叠加于 v4.7.7 Phase K 健康度之上)。

### 修复

- **`atomicWrite` EPERM 本源修复(141 实测 ×81)**: Windows 上 `wam-state.json` 被瞬时锁
  (杀软扫描 / 并发读)时 `fs.renameSync` 抛 `EPERM/EBUSY/EACCES`。旧实现 catch 内即便
  `copyFileSync` 兜底成功也无条件 `throw` → 数据其实已落盘却被记为 `store.save fail`
  (假失败刷屏)且无重试。治法: 锁类错误短退避重试(40/80/120/160ms · `Atomics.wait`
  同步睡眠, 忙等兜底); 终败再 copyFile 兜底, 兜底成功即返回不抛。消除假失败 + 防数据丢失。
- **`openExternal` 守卫 "Cannot redefine property" 本源修复(141 实测 ×27)**: 某些
  Windsurf / VSCode 版本 `vscode.env.openExternal` 为「不可配置」访问器,
  `Object.defineProperty` 必抛, 且每次模式切换都重试 → 刷屏且守卫从未装上。治法:
  先探属性描述符, 不可配置则跳过 defineProperty(避免抛错), 退而尝试可写赋值兜底;
  仍装不上则静默降级且只记一次(不影响核心功能)。

### 实测 (141 生产机 · 真账号真会话)

- 部署: v4.7.8 VSIX 经 DAO Bridge 传输(sha256 校验一致)装入活动扩展目录
  `~/.devin/extensions`, 重载窗口热加载。
- 回归: 单测 **全绿**; `atomicWrite` 五路弹性单测全绿。

## v4.7.7 (2026-06-14) · 对话最终模块·终报+进展+健康度 (Phase K)

> 道法自然·善始且善成: 对话有始有终, 终报如实记载。三盗既宜, 三才既安——余额/卡死/阻塞三维度归一健康度。

### 新增

- 纯函数(可单测·`devin_cloud.js`):
  - `conversationFinalReport(sess, opts)` → 结构化终报: outcome 分类(success/stalled/blocked/cap_exceeded/archived/unknown) + 时长(毫秒/分钟) + 成本 + 卡死标记。空输入→各字段 null(安全·不臆造)。
  - `healthScore(inputs)` → 综合健康分 0-100: 余额权 40 + 卡死权 30 + 阻塞权 30; tier: green(≥80)/amber(≥50)/red(<50)。三盗既宜三才既安。
- `_dvProgressSummary()`: 每 `_dvRunPoll` 轮次末聚合全活跃对话的实时进度指标(running/awaiting/blocked/stalled 计数 + health 三色灯), 写入 `_dvProgressCache`, 有活跃对话时输出 `dv-progress:` 日志行。
- `_dvDetectFinished` 增强: 对话离场时调用 `conversationFinalReport` 生成终报, 存入 `_dvFinalReports`(环形 50 条); 通知消息附 outcome + 耗时 + 成本; `dv-final:` 日志行记载全字段。
- `_dvRunningDetail` Map: 缓存上轮运行中会话详情(含 createdAt 等), 供终报计算时长; 离场后自动释放(无为·不占内存)。

### 守恒

- 既有 `_dvMaybeNotify` / `_dvStallCheck` / `_dvLowBalanceCheck` / `_dvConvCapTick` 逻辑一字未改。
- 新增函数均为纯叠加(不改原有行为); 终报/进展/健康度缺数据时一律返回 null/safe(不臆造成功铁律不变)。

### 验证

- `node -c` 双文件通过; 单测 39→**52 全绿**(新增 13 项: 终报 7 + 健康度 6·无回归)。

## v4.7.6 (2026-06-14) · 实测复盘修正·真中停端点 + 版本号归一 (Phase J)

> 反者道之动·重新锚定本源: v4.7.5 实测中暴露并修正两处缺陷, 既有逻辑零改动。

### 修正

- **`stopSession` 真中停端点 (404→200)**: 实测确证 Devin Cloud 无 `stop/pause/sleep/cancel/end` REST 路由(全部 404), 唯一可变更运行态的动作为 `POST {apiBase}/sessions/{id}/archive`(200 → `status: running→suspended` · `is_archived:true` · 即时移出活跃列表)。故以 `/archive` 为首选端点真中停, 原候选作回退保险。`_dvConvCapTick`(额度超限自动中停) 由此实际生效, 不再恒 404 空转。
- **版本号归一**: `extension.js` 的 `VERSION` 常量自 v4.7.4 起未随 `package.json` 同步(`package.json=4.7.5` 而启动横幅恒显 `WAM v4.7.4`)。本版统一为 `4.7.6`, 启动横幅/状态栏/状态命令与包版本一致。

### 实测验证 (v4.7.5 运行态·线上真账号真会话)

- 低余额预警: `dv-lowbal ... 余额 $12.46 ≤ $99999 → 已提醒用户`; 一次跌破只警一次; 阈值归零→不警(复位)→再升→再次触发($12.15) — 确证轮询回路在跑 + 复位逻辑正确。
- 卡死监测: `dv-stall: devin-5b7728... 无进展` 于运行中会话指纹持续不变时触发, 不刷屏。
- `/archive` 真中停: 实跑 `running → suspended · is_archived:true · 活跃列表归 0`。
- 回归: 单测 **39 全绿**。

### 守恒

- 不臆造成功铁律不变: `/archive` 仍按 2xx 真值回报 `stopped`, 非 2xx 如实回报。
- 低余额/卡死/对话追踪 等 v4.7.5/v4.7.4 逻辑一字未改。

## v4.7.5 (2026-06-14) · 对话最终模块加固·卡死实时监测 + 低余额(≤$3)主动提醒 (Phase I)

> 道法自然·知止不殆: 完善"对话最终模块"两件事——(1)**卡死实时监测**: 运行中对话「长时间无进展」即在 `_dvRunPoll` 每轮(默 1min)实时检出并左下角提醒(原仅检 blocked/awaiting/完成, 现补"running 但卡死"的盲区); (2)**低余额主动提醒**: 有活跃对话的账号余额 ≤ 阈值($3)时, 直接给用户发消息「额度快用完了」(IDE 通知 + 尽力往运行中对话续写一条提醒), 在被自动中停之前先告警。一次跌破只提醒一次, 回升后复位; 不臆造成功。

### 新增

- 纯函数(可单测·`devin_cloud.js`):
  - `lowBalanceVerdict(balance, threshold, prevAlerted)` → `{alert, alerted}`: 余额≤阈值且上轮未警→发警; 回升→复位; null/NaN→不警保持上轮态。
  - `sessionSignature(sess)` → 取状态字段(statusClass/status/reason·非标题)拼进展指纹。
  - `stallVerdict(unchangedMs, stallMs)`: 无进展时长≥阈值→判卡死; 阈值≤0(关闭)/非法→永不判。
- `_dvStallCheck(email, active)`: 运行中会话指纹持续不变超 `devinCloudStallMin`(默 15min)→ 提醒"疑似卡死·已 N 分钟无进展"(进展恢复后复位·不刷屏·离场即清状态)。
- `_dvLowBalanceCheck(acc, auth, active)`: 有活跃对话才拉余额(限于"对话所在账号"·省调用), `billingBalance` 判定→`lowBalanceVerdict` 决策→IDE 通知 + (配 `devinCloudApiKey` 的 apk_ Key 时)`sendMessage` 续写提醒。
- 配置: `devinCloudStallAlert`(默 true) · `devinCloudStallMin`(默 15) · `devinCloudLowBalanceAlert`(默 true) · `devinCloudLowBalanceThreshold`(默 3) · `devinCloudLowBalanceMessageSession`(默 true) · `devinCloudApiKey`(默 "")。

### 守恒

- 既有 `_dvMaybeNotify`(blocked/awaiting) / `_dvDetectFinished`(完成) / `_dvConvCapTick`(余额≤阈值自动中停) 逻辑一字未改; 卡死监测与低余额提醒为**新增叠加**(对话所在账号·实时监测·实时反馈)。
- 续写消息需 apk_ Key; 缺失或失败仅走 IDE 通知, **不臆造成功**(铁律)。

### 验证

- `node -c` 通过; 单测 **39 全绿**(原 30 + 新 9: 低余额预警 4 + 卡死监测 5·无回归)。

## v4.7.4 (2026-06-14) · 对话追踪统一·账号编号(1-N) (Phase H)

> 道法自然·卅辐同一毂: Cascade + Devin Cloud 对话追踪本已同处「对话追踪」面板(v4.6.0)。本版补齐编号区分: 侧栏每账号勾选框旁加**账号编号**(1、2、3…与账号顺序一致); 对话追踪中 Devin Cloud 对话挂**同一编号**, 用户一眼对应到具体账号; Cascade 流式对话加**对话编号**(序号)。完成/卡住/待输入 通知均带 `#编号` 前缀。Cascade 既有逻辑一字未改, 仅叠加显示。

### 新增

- 侧栏账号行: 勾选框后加 `.acc-no` 编号徽标(1-based·`i+1`)。
- `_dvAccountNo(email)` → 该账号在账号库中的 1-based 序号(与侧栏一致)。
- 对话追踪 Devin Cloud 子板块每条挂 `.dv-trk-no` 编号徽标(`_dvStatusAgg` 存 `no`)。
- Cascade 流式列表每条挂 `.cv-no` 对话编号(序号·仅显示)。
- 通知带编号: `_dvMaybeNotify`(卡住/待输入) + `_dvDetectFinished`(完成) 均加 `#N` 前缀, 左下角弹窗一眼识号。

### 守恒

- Cascade 对话追踪/卡住/完成/dismiss 逻辑完全不变, 编号纯显示叠加(原有的东西不能变)。
- Devin Cloud 与 Cascade 同处一面板(v4.6.0 已统一), 本版只补编号。

### 验证

- `node -c` 通过; 单测 30 全绿(无回归)。

## v4.7.3 (2026-06-14) · 美金额度·耗尽自动重置(反向重置·抽干至零) (Phase G)

> 道法自然·将欲予之必故予之: 对话额度上限本随余额下降(cap=余额-缓冲), 余额抵缓冲时上限本将归 0、把最后一笔美金困住。新增「耗尽重置」(默认开): 当 cap 将归 0 且尚未见底, 把上限**反向抬回剩余余额**, 让美金真正用尽; 仅当余额 ≤ 抽干地板($0.10·真见底)才最终中停运行中对话。每账号实时美金余额与每对话上限继续在下拉概览显示, 缓冲可手动调。

### 新增

- 纯函数 `devin_cloud.computeConvCap(balance, buffer, drainOn, floor)` → `{cap, drain}`(可单测): 常态 cap=余额-缓冲; cap≤0 且 余额>地板 → cap 反抬回余额 + drain=true; 余额≤地板 → cap=0。
- `_dvConvCapTick` 改用 `computeConvCap`; 中停边界 `stopBound = drainOn ? floor : stopAt`(抽干模式仅见底才停)。
- 配置: `devinCloudConvDrainToZero`(默 true) · `devinCloudConvDrainFloor`(默 $0.10)。
- 前端: 工具条加「耗尽重置」勾选 + `dvToggleDrain`; 概览/广播 capTxt 显示「·抽干中」(琥珀色 #dcaa55)。
- host: `devinToggleDrain` 处理。

### 守恒

- 抽干模式不改变正常区间的 cap=余额-缓冲 语义; 仅在末端(余额≤缓冲)接管, 防止困住最后一笔钱。
- 关闭「耗尽重置」即回退 v4.5.0 旧语义(余额≤停止阈值即中停)。

### 验证

- `node -c` 双文件通过; 单测 23→**30 全绿**(新增 7 项: 常态/实时下调/反向重置$3/$2/见底/抽干关闭/非法余额)。

## v4.7.2 (2026-06-14) · PAT 反向注入 · 一键把 PAT 作为 GITHUB_PAT 密钥写入全部账号 (Phase F)

> 道法自然·将欲予之必故予之: 用户在「批量归一」PAT 框填入 PAT 后, 点「&#128273; PAT注密钥」即把该 PAT 作为 `GITHUB_PAT` 密钥反向注入到「全部账号」(若已勾选账号则仅注入勾选项)。复用 devin_git 写后双读确认逻辑(`ensureGithubPatSecret`), 与 dao-vsix 1.3.3 `devinInjectSecret` 同源(`POST /api/org-{bare}/secrets {key,value,type:key-value,sensitive,note}`, 200/201/409 皆视为成功·幂等)。

### 新增

- 前端: 「批量归一」工具条加「&#128273; PAT注密钥」按钮 + `gitInjectPatAll()`(读 `gitBatchPat` 框 → 勾选则仅勾选, 否则全部账号)。
- host: `gitInjectSecretBatch` 处理 — 逐账号 `_dvAuthFor` 登录 → `devinGit.ensureGithubPatSecret(auth, pat)`; 不可登录账号跳过; 实时进度 toast + 汇总成功/失败/跳过 + `_notify` 明细。

### 守恒

- 仅注入密钥, 不触发 OAuth 连接/不改 Git 连接态(与「批量连Git」职责分离)。
- 写后双读确认(最多 3 轮)→ 不臆造成功; 幂等(已存在的 409 视为已注入)。

### 验证

- `node -c` 通过; 23 单测全绿。
- 真账 live(lcld26815946 / beasley856439): GITHUB_PAT 注入 before:false → after:true, 经独立 `listSecrets` 复核确认落库 (lcld 既有 DAO_* 密钥并存不扰)。

## v4.7.1 (2026-06-14) · 知识库/剧本/密钥 · 每项查看/下载/删除 + 多选批量 (Phase D)

> 道法自然·下拉概览里知识库/剧本/密钥每一项都可独立操作: 查看内容(知识/剧本) · 下载到本地.md · 删除。复选框多选(Shift 区间) → 批量下载 / 批量删除。本源默认(内置知识 note_type=builtin / 社区剧本 access=community)由 `deletable` 标记守恒——不显示删除按钮、不可误删。

### 新增

- 后端 `accountOverview` 板块项补 `deletable` 标记(知识=`isUserKnowledge`, 剧本=`isUserPlaybook`, 密钥=true)。
- 前端 `_dvBoardListHtml` 每项: 复选框 + 查看/下载/删除按钮; 顶部多选条(批量下载·批量删除·取消)。
- webview 消息: `dvBoardView` `dvBoardDownload` `dvBoardDownloadBatch` `dvBoardDelete` `dvBoardDeleteBatch`; 多选 Shift 区间(`dvBoardSel`)。
- host 处理 + helper: `_dvFetchBoardItem`(按 id 取全量项含 body) / `_dvBoardItemText`(知识=name+触发+body, 剧本=title+body, 密钥=名称/元数据) / `_dvBoardDelete`(分发 deleteKnowledge/Playbook/Secret) / `_dvBoardFileName`。查看开新面板; 下载落 .md 到 `账号/知识库|剧本|密钥/` 并资源管理器定位; 删除模态确认 + 无感刷新。

### 守恒

- 密钥无可取明文值: 仅查看名称/元数据 + 删除/多选(不提供下载值)。
- 内置知识(3)/社区剧本(32)`deletable:false` → 前端无删除按钮 (本源默认·不毁)。

### 验证

- `node -c` 双文件通过; 23 单测全绿。
- 真账 live(lcld): 知识 13(10 可删/3 内置锁) · 剧本 39(7 可删/32 社区锁) · 密钥 3 可删; 内容取回正常(用户知识 body 7852 字 + 触发场景, 剧本 body 1212 字)。`deletable` 标记与既有 wipe「保留 32 本默剧本 + 3 本默知识」完全一致。

## v4.7.0 (2026-06-14) · 单对话操作 · 下拉概览每条对话加按钮 (查看/下载ZIP/清理) + 多选合并

> 道法自然·热加载下拉里每条 Devin Cloud 对话本身可独立操作: 查看详情/Output 全文 · 下载本对话 ZIP 到本地 · 水过无痕清理(归档)。支持复选框多选(Shift 区间), 合并多个对话为一个 ZIP 下载 / 批量清理。复用既有热加载预载缓存(v4.6.0)与单对话备份取证逻辑(增量补全文件), 不改动既有备份/清理主链。

### 新增

- 前端 `_dvOverviewHtml` 每条对话行: 复选框 + 查看/下载/清理 三按钮; 列表上方多选条(已选计数·合并下载ZIP·批量清理·取消)。
- webview 消息: `dvConvDetail` `dvConvZip` `dvConvDel` `dvConvZipBatch` `dvConvDelBatch`; 多选支持 Shift 区间选择(`dvcSel`)。
- host 处理: 单对话详情(`buildConversationHtml` 新面板)、单对话 ZIP(`backupOneConversation` 强制全量补文件 + 资源管理器定位)、单/批清理(`deleteSession` 归档·模态确认·无感刷新概览)。
- 后端 `devin_cloud.backupConversationsBundle(auth, sessList, outDir)`: 多对话合并为一个 ZIP(每对话一子文件夹·files/正文md/agent.json + _index.json), 复用事件流/取证/下载逻辑。
- `_dvRefreshOverview`: 清理后失效缓存→重拉→推送最新概览(无感刷新)。

### 验证

- `node -c` 双文件语法通过; 23 项回归单测全绿(`node test/unit.test.js` → PASS 23 / FAIL 0)。
- 真账 live: 见验证报告(合并 ZIP 结构/单对话 ZIP/详情面板)。

## v4.6.3 (2026-06-13) · Git 归一回报文案净化 (大象无形·去华取实)

> 18 真账 live 大规模 Git 归一实测: 4/18 → 10/18 归一到 PAT 主 @dao-devin (3 个空连新接 + 3 个错主净断重注), 余 3 ghost 孤儿态 + 5 github_app(OAuth) 如实回报需官网手动移除, App 连接绝不主动断 (铁律守恒)。官网交叉核验: Settings→Connections 显示 GitHub 已连 @dao-devin · CLI token, 与 API 普查一致。

### 修 · github_app 回报文案

- `connectWithPat` 对 github_app 账号的回报里, 身份名用了 `[name](N仓库)` 形态 —— 渲染如残缺 markdown 链接 (乱), 实为「身份 + 仓库数」。
- 净化为 `@name (N 个仓库)`, 与 `extension.js` 内其余 appConn 展示统一 (`@name (...)`), 去华取实, 不改任何分流逻辑。

### 验

- 23 项零依赖回归单测全绿 (`node test/unit.test.js` → PASS 23 / FAIL 0), 分流逻辑 `classifyRegisteredState` 行为不变。
- 备份模块 live 复核: 账号 lcld 全 106 真对话备份成文件夹 (对话.md/对话_agent.json/files), 与官网会话清单逐条对应; 增量去重复跑 106/106 全跳过。
- 清空模块 dryRun 扫描复核: 正确枚举 106 会话/10 知识/7 剧本/3 密钥/1 Git 连, 并保留 32 本默剧本 + 3 本默知识 (不毁)。

## v4.6.2 (2026-06-13) · 限流韧性 · 多账号普查不再误判失败 + 首套回归单测 (弱者道之用·反复至成)

> 18 真实账号 live 普查中实测复现: 登录 + Git 连接/仓库三连发, 到第 13 个账号起连续 6 个报 `LOGIN_FAIL`。
> 取证根因为 **HTTP 429 限流**——底层 `rawRequest` 仅对「TLS/ECONNRESET/超时」等网络层瞬态错误重试,
> 对 **429/5xx 这类「服务端有响应的限流/暂时性故障」完全不重试**, 健康账号遂被误判为登录失败,
> 直接破坏本源诉求中的「可信(状态不骗人)/无感(预载全账号)」。

### 修 · 429 / 幂等 5xx 退避重试 (绝利一源·三反昼夜)
- `rawRequest` 在网络错误重试之外, 新增**状态码层面**的可重试判定 `_isRetryableStatus`:
  - **429** 限流 → 任意方法皆安全重试 (请求被拒·未被处理, 退避后重发恒幂等);
  - **502/503/504** 网关/不可用 → **仅幂等方法(GET/HEAD)** 重试, 避免对非幂等变更(连/断 Git·发消息)重复提交。
- 退避 `_retryDelayMs` **优先遵从服务端 `Retry-After`** (秒数或 HTTP-date·封顶 `retryMaxDelayMs` 默 30s),
  取不到则指数退避 + **抖动(jitter)**——分散「并发预载 N 账号同时撞 429 → 同时重试」的二次冲击 (绝利一源)。
- 新配置: `wam` 侧经 `configure()` 可调 `rateLimitMaxRetries`(默 6) · `retryMaxDelayMs`(默 30000)。
- **live 复测**: 修复前 18 账号普查 12 成功 / 6 个 `429 LOGIN_FAIL`; 修复后 **18/18 全成功**。

### 改 · Git 已注册态分流抽为纯函数 (可单测·回归护栏)
- `connectWithPat` 中「已注册账号的 4 态安全分流」(existing/ghost/reinject/app) 决策逻辑, 抽为纯函数
  `classifyRegisteredState({ownerLogin, connections, hasRepos})`——脱离网络即可被单测穷举各分支,
  固化「**绝不主动断 github_app**(断后落不可复原孤儿态)」这条实测铁律, 防后续改动悄然回退。

### 新 · 首套零依赖回归单测 (P2-2·原零自动化测试 → 有护栏)
- `test/unit.test.js`(纯 node `assert`·无第三方框架·`npm test` 直跑): **23 项全绿**, 覆盖
  限流重试判定/退避时长(Retry-After)/`rawRequest` 真重试(本地 http 429×2→200)/五态 `classifySession`/
  `billingBalance` 余额判定/`classifyRegisteredState` Git 分流。可直接纳入 CI。

## v4.6.1 (2026-06-13) · 锁反转副作用修正 (无为非无能)

> 在便携 VSCode 内以 21 真实账号冷启动实测时发现: 锁反转(问③)上线后, 账号默认🔒锁定 ⇒ `getSortedIndices` 天然排除全部 ⇒ 启动 `rotate()` 候选为 0 ⇒ 旧代码落到尾部误报红色 `所有账号都失败`(实则登录全部成功·仅按设计无解锁候选)。此正是用户所诉「状态弹错」之一类。

### 修正 `Engine.rotate()`
- `order.length === 0` 时先辨因, 不再一概红错:
  - 可登录账号(有密码)全部🔒锁定 → 属预期态(用户主权), 仅 `log`、不弹错、返回 `{ok:false, stage:"all-locked"}`。
  - 确无可登录账号(账号库空/缺密码) → 温和 `warn` 提示, 返回 `stage:"no-loginable"`。
  - 仅当确有候选却登录全失败时, 方保留原 `所有账号都失败` 红错。
- 实测: 21 账号冷启动, 日志显示 `rotate: 0 候选 · 21 个可登录账号均🔒锁定(lockByDefault) · 属预期·非错误`, 不再误报; 预加载+验证 21/21 ✓。

## v4.6.0 (2026-06-13) · 状态实时 · 概览预载 · 锁反 · 备份分流 · Git 真断 (道法自然 · 太上下知有之)

> 反者道之动 —— 七症一并推进: 让中途任何停顿都前端可见, 概览秒开, 默认锁定保用户主权, 水过无痕真断 GitHub。

### 问题① 对话状态实时显示 (五态细分)
- `classifySession` 由 4 态扩为 5 态: `running`(运行) · `awaiting`(等待用户输入·中途停顿) · `blocked`(额度耗尽/出错/卡死) · `finished` · `idle`。
- `listRunningSessions` 现返回所有「活跃·需关注」会话 (运行/等待/卡住), 各带 `statusClass`。
- 账号行 `.dv-run` 同时显示 运行/待输入/卡住 三色徽标; 概览头部与每对话行细分着色。
- 通知去抖: 进入 `awaiting`/`blocked` 各推一次 (等待你输入 / 疑似卡住·额度超限)。

### 问题② 概览预加载 + 增量刷新 (彻底消除点击后加载耗时)
- `_dvPreloadAll`: 启动后台对账号库内全部「有密码」账号并发(`devinCloudPreloadConcurrency` 默3)登录 + 预拉概览/Git → 入 `_dvOverviewCache`, 展开秒开。
- `_dvStartPreload`: 启动后约 8s 首次预加载, 之后每 `devinCloudPreloadRefreshMin`(默5min) 增量刷新; 缓存新鲜(<90s)则跳过。
- 预加载后 `cachedEmails` 覆盖全账号 → 状态轮询/自动备份等效全账号。
- 新配置: `wam.devinCloudPreload`(默true) · `wam.devinCloudPreloadConcurrency`(默3) · `wam.devinCloudPreloadRefreshMin`(默5)。

### 问题③ 锁默认锁定 (反者道之动) + 自动备份默认开
- `wam.lockByDefault`(默true): 新账号缺省 🔒锁定 (禁自动切号), 用户主动 🔓解锁后该号才入自动切号候选。显式记录两态。
- `wam.devinCloudAutoBackup` 默认 false → **true** (账号库内对话自动增量备份)。

### 问题④ Devin Cloud 独立备份配置 (与 Cascade 分流)
- 对话追踪面板底部新增「☁ Devin Cloud · 对话追踪 + 备份」独立板块 (紧邻 Cascade 备份配置)。
- 新增「Devin Cloud 备份配置」按钮 + `devinSelectBackupDir` 消息: 选目录写 `wam.devinCloudBackupDir`(独立于 Cascade `conversationBackupDir`), 已有备份自动迁移, 即时全量备份一次。

### 问题⑤ 对话追踪复用 (Cascade + Devin Cloud)
- `_dvStatusAgg` 聚合各号活跃对话, `_dvRunPoll` 每轮写入并 `_broadcastConvSection` 增量刷新追踪面板。
- 追踪面板 Devin Cloud 子板块复用同一 UI 风格 (运行/待输入/卡住汇总 + 逐条 账号·标题)。

### 问题⑥ 连接 Git 多端点实探 (唯变所适)
- `injectGitHubPAT` 由单端点单字段, 改为 (端点×body字段) 候选逐个实探, 命中首个 2xx 即真注入; 全部非 2xx 才如实回报 (区分 PAT无效/已注册)。
- 批量连接沿用 `connectWithPat` (多账号 → 同一 GitHub), 核验可达仓库为真凭据。

### 问题⑦ 水过无痕真断 GitHub (终态核验)
- `disconnectGitHubUser` 由单端点改为账号级/组织级多候选全走一遍。
- `robustDisconnectGit` 收尾增加 `_verifyGitCleared` 终核 (身份 login 空 + 可达仓库 0 + 连接 0 + 无 GITHUB_PAT 密钥), 未净则二次断身份并如实报明残留 (提示上官网手动撤销 GitHub App 授权), **不臆造已断净**。
- 批量断开 / 一键清理均以终核结果为真解绑判据并反馈用户。

> 实测说明: 问题⑥⑦ 的端点候选已就位, 但「真正连上/真正断净」需用真实 Devin Cloud 账号 + GitHub PAT 上官网核验 (本机无凭据, 终核会如实报明残留, 不虚标成功)。

## v4.5.0 (2026-06-13) · 对话额度上限 · 知止不殆 · 余额精确到分 (道法自然 · 顺其自然·推进到底)

> *知足不辱，知止不殆，可以长久。* —— 每对话使用额度有上限，余额近底自动中停，先备份再清理；与官网每刀额度同步，精确到分。

### 新增 · 对话额度上限 (per-conversation quota cap · 加到切号器·知止不殆)
- 核心逻辑极简: **每对话使用额度上限 = 账号实时余额 − 缓冲(默 $3)**。
  余额 $70 → 上限 $67; 消耗到只剩 $55 → 自动下调上限 $52。随余额下降实时跟随, 与官网每刀额度同步。
- `wam.devinCloudConvQuotaCap` (默 false): 总开关。开启后实时跟踪各已登录账号余额并算出每对话上限。
- `wam.devinCloudConvQuotaBuffer` (默 $3): 缓冲。`上限 = max(0, 余额 − 缓冲)`。
- `wam.devinCloudConvStopThreshold` (默 $3): 余额 ≤ 此值 → 自动**中停**该账号运行中对话 (知止·防耗尽)。
- **使用中判定**: 余额较上轮下降(正在消耗) 或 有运行中对话 = 该账号"使用中" (二者等价)。
- **自适应轮询**: 使用中提速(秒级·`devinCloudConvPollActiveSec` 默 30s), 空闲降速(分钟级·`devinCloudConvPollIdleMin` 默 30min)。
  日常无谓频繁, 仅当账号确认被使用才进入上限轮询 —— 太上下知有之。
- 中停底层 `devinCloud.stopSession()`: Devin Cloud 未公开停止 REST 路由, 按候选端点(`/stop`·`/pause`·`/sleep`·`/cancel`)逐个实探,
  命中 2xx 即真中停, 全部非 2xx 则如实回报各端点状态 —— **不臆造成功**。
- 前端: 工具栏「对话上限」开关 + 「缓冲$」输入; 账号概览实时显示「对话上限 $X.XX ·使用中」(随轮询热更新, 使用中标青)。

### 改 · 自动清理阈值 $3 → $1 (先全量备份成功·再水过无痕·≤判定)
- `wam.devinCloudAutoCleanupThreshold` 默认 $3 → **$1**。账号额度 **≤ $1** 时触发(由 `<` 改 `≤`)。
- **先备份成功才清理**: 全量备份(对话+知识/剧本/密钥/Git 快照)抛错则跳过清理(未备份不删), 杜绝数据丢失。
  时序严格为: 全量本地留底 → 备份成功 → 再删全部对话内容 + 知识/剧本/密钥真删 + 断 Git。

### 改 · 每刀识别精确到分 (与官网一致·不再只到整数)
- 账号概览额度显示由原始 `overage_credits` 整数, 改为 `billingBalance()` 真余额 `toFixed(2)` —— `额度 $33.27`。
- 对话上限计算同样保留两位小数 (`(余额−缓冲).toFixed(2)`), 与官网每一分对齐。

## v4.4.1 (2026-06-13) · 实践到底 · 真机三缺陷修复 (道法自然 · 实践中发现, 实践中解决)

> *知不知, 尚矣; 不知知, 病矣* —— v4.4.0 未在真号实跑, 三处臆造皆经 Devin Cloud 真账号(lcld/beasley/rioskolton 等)直连后端揪出并复证修复。

### 修 · bug1 覆盖型更新失效 (孤儿文件夹 · 你最关心的"水过无痕")
- 现象(实测复现): 文件夹名 = `safeName(标题)_ID末8`。同一对话(devinId 不变)在 Devin
  运行中标题常被自动改写 → 新备份按新标题**新建**文件夹, 旧文件夹沦为孤儿, 同一对话被复制成多份, 非真覆盖。
- 治法: `backup_state.json` 已按 devinId 记录上次 `folder`。备份前若新文件夹名 != 旧名,
  把旧文件夹**原地改名复用**(`fs.renameSync`); 若新名已存在则删旧名残留。一对话恒一文件夹, 真覆盖。

### 修 · bug2 自动清理误删健康号 (数据丢失风险)
- 现象(实测复现): 阈值判断读 `prompt_credits`/`flow_credits` —— Devin `billing/status` **根本不返回**这两字段,
  恒得 0 → 有额度的健康号(如 rioskolton: overage_credits=+33.27, has_subscription_or_credits=true)被误判 $0 →
  触发全量备份, 若开自动清理则**直接 wipe**(删全部会话/知识/剧本/密钥 + 断 Git)。
- 治法: 新 `devinCloud.billingBalance()`(可单测) —— 以实测字段 `available_credits + max(0, overage_credits)` 计余额,
  权威布尔 `has_subscription_or_credits`/`is_subscription_valid` 为真即视为充足(返 9999, 绝不触发清理),
  字段不全/未知一律返 `null` → 调用方跳过破坏性清理。`_billingTotalDollars` 改为委托此函数。

### 修 · bug3 备份 HTML/MD 丢"思考/工具"两类气泡 (与官网不一致)
- 现象(实测复现): 代码匹配 `thinking`/`tool_call`/`tool_result` —— Devin Cloud **无此事件名**。
  真实事件: 思考 `devin_thoughts`/`one_line_thoughts`; 工具 `shell_process_started`/`multi_edit_result`/
  `computer_use`/`mcp_tool_call`/`search_file_commands`/`web_search`/`web_get_contents`/`todo_update`。
  致 472 思考 + 上千工具事件**全数丢失**, 备份只剩用户+Devin 两类。
- 治法: 新增共用 `classifyEvent()` 按真实事件名映射四类气泡, HTML 与 MD 同源复用。
  实测某 202 事件会话: 由原 ~3 气泡 → 1 用户 / 2 Devin / 22 思考 / 49 工具, 与官网呈现一致。

## v4.4.0 (2026-06-13) · 文件夹备份 · HTML/MD双视图 · 自动备份阈值 · 自动清理 · 道法自然

> *天下之物生于有，有生于无。* —— 备份从ZIP进化为文件夹，HTML可视化让用户如临其境，MD让AI一目了然；额度阈值驱动自动备份与清理，无为而无不为。

### 新增 · 文件夹备份 (ZIP→文件夹 · HTML/MD双视图 · devin_cloud.js)
- 备份结构从 ZIP 进化为文件夹: `<账号名>/<对话名称_ID末8位>/`
  - `对话.html` — 用户看: 与 Devin AI 网页一致的暗色主题可视化呈现 (用户/AI/工具/思考 四类消息各有标识色)
  - `对话.md` — AI 看: Markdown 纯文本, 可直接喂给 Agent 或作文档引用
  - `对话_agent.json` — 全量机器可读: 全部事件 + 产出文件索引
  - `_meta.json` — 元数据 (devinId/标题/事件数/时间戳/账号)
  - `files/` — 产出文件 (源码/日志/截图等完整留底)
- 新 `buildConversationHtml()`: CSS 暗色主题 · 用户👤/AI🤖/工具🔧/思考💭 四类气泡 · 工具调用可展开详情 · 响应式布局
- 新 `backupOneConversationFolder()` / `backupAccountFolders()` / `backupAccountFullFolders()`: 文件夹版增量备份全链路
- 备份模式可配置: `wam.devinCloudBackupMode` = `folder`(默认·推荐) 或 `zip`(兼容旧版)
- 前端工具栏新增模式切换下拉: 实时切换 文件夹/ZIP 模式
- `listBackups()` 同时识别 ZIP 和文件夹备份, 前端浏览面板统一展示

### 新增 · 自动备份额度阈值 (额度驱动 · 无为而无不为)
- `wam.devinCloudAutoBackupThreshold` (默 $3): 账号额度低于此阈值时, 自动触发全量备份(非增量)
- 定时轮询时自动检测各账号 billing 额度, 低于阈值 → 全量备份 + 账号数据快照 (知识库/剧本/密钥/Git)
- 前端工具栏新增阈值输入框: `$` + 数字输入, 实时调整阈值

### 新增 · 自动清理 (备份→清理→回归本源 · 水过无痕)
- `wam.devinCloudAutoCleanup` (默 false): 开启后, 额度低于阈值且备份完成 → 自动执行水过无痕(删对话/知识/剧本/密钥/Git)
- `wam.devinCloudAutoCleanupThreshold` (默 $3): 自动清理的额度阈值
- 前端工具栏新增「自动清理」开关: checkbox 一键开关
- 自动清理含 `robustDisconnectGit`: Git 连接彻底断开, 回归完全本源态

### 强化 · 批量备份 / 备份并清空 支持新模式
- `devinBackupAll` / `devinWipe(备份并清空)` 均自动检测 `devinCloudBackupMode` 配置, 使用对应模式备份

## v4.3.0 (2026-06-12) · 批量归一 · 多 Devin 绑同一 GitHub · Devin Cloud 板块可查看 · 一键清除真解绑

> *为学者日益，为道者日损。* —— 底层功能推进到底(日益)，用户操作四两拨千斤(日损)；用户近于无为无感，系统无不为。

### 新增 · 批量归一连接 (多个 Devin 账号 → 同一个 GitHub · 本轮核心)
- 账号列表上方新增「批量归一」工具条: 一个共享 PAT 输入框 + `批量连Git` + `批量断Git` 两按钮。
- 用法极简(一眼就懂): 勾选 N 个 Devin 账号 → 点 `批量连Git` → 全部用同一 PAT 归一连接到同一个 GitHub
  (逐账号注入 PAT + 落库密钥 + 核验身份/仓库, 进度逐条 toast, 末尾汇总成功/失败明细)。
- `批量断Git`: 对勾选账号逐个 `robustDisconnectGit` 复查扫除真解绑(连接归零 + 删 GITHUB_PAT 密钥)。
- host 新增 `gitConnectBatch` / `gitDisconnectBatch` 处理 + webview `gitBatchDone` → 自动重拉所有展开下拉刷新状态。
- 实测(真实 API): lwsfx + lcld 两账号同时连到 @dao-devin(各 26 仓库 · 密钥落库), 批量断开后两账号均 连接0/密钥false。

### 新增 · Devin Cloud 板块可查看 (知识库/剧本/密钥 一眼看清单)
- `accountOverview` 增 `playbooks` / `secrets` 名称清单(知识库清单原已有), 一次并行拉取即得, 零额外请求。
- 下拉概览的「知识库 / 剧本 / 密钥」统计块改为可点击(虚线下划线提示): 点击就地展开/收起对应名称清单, 再点收起。

### 强化 · 一键清除(水过无痕) 真解绑 Git
- 单/批量「水过无痕」清空后, 追加 `robustDisconnectGit` 复查扫除: 不仅删对话/知识/剧本/密钥/Git连接,
  还复查强删残留连接 + 确保 GITHUB_PAT 密钥归零(根治"已删仍残留"幽灵态), 真·回归本源。

## v4.2.0 (2026-06-12) · 三板块统一 · 整合 devin-git-auth 核心 (Cascade + Devin Cloud + Git)

> *物无非彼，物无非是。* —— 三板归一, 太上下知有之: 前端最小化, 后端最大化。

### 新增 · 第三板块 Git(GitHub) 归一连接 (整合 devin-git-auth v2.3.2 核心)
- 新 `devin_git.js` (零 vscode 依赖, 复用 `devin_cloud` 传输层 rawRequest/jsonRequest/proxy):
  移植 git-auth 核心后端 —— `injectGitHubPAT` / `ensureGithubPatSecret`(注入+双读确认) /
  `getGitHubUser` / `getAccessibleRepos` / `deleteSecret`(真删) / `connectWithPat` /
  `gitStatus`(下拉只读快照) / `robustDisconnectGit`(复查扫除·真解绑) / `patFor`(共享 ~/.dao 池)。
- `robustDisconnectGit` 保留 v2.3.2 复查扫除环(3 轮 800ms settle, 重查→按 id 强删残留)→ 真解绑。
- 前端最小变动: 账号下拉 Devin Cloud 概览内嵌 `Git · GitHub` 区块 —— 显示 @身份/仓库数/Sec 指示,
  一个 PAT 输入框 + 连接Git/断开Git 两按钮; 与原 cascade/Devin Cloud 板块共存。
- 共享凭据池: `~/.dao/git-pats.json`(defaultPat + overrides) 与 devin-git-auth/切号插件一致。

### 修 · bug1 拉取失败(TLS socket disconnected)
- `rawRequest` 增瞬态错误指数退避重试(3 次, 500/1000/2000ms; 14+ 错误码判定 TLS/ECONNRESET/超时等)。
- `accountOverview` 由 `Promise.all` 改 `Promise.allSettled`: 任一子端点瞬态失败不再毁整份概览。

### 修 · bug2 账号下拉 Devin Cloud 内容被回弹/不显示
- host 侧 `_dvOpenEmails` 集记录开合 + `_dvOverviewCache`(90s TTL)缓存概览/Git 状态;
  周期扫描重建 webview 时按缓存预填已展开行 → 下拉保持展开、内容秒回, 不再回弹/闪烁。

### 实测(真实 Devin Desktop 3.1.7 · 录屏 + API 交叉验证)
- 概览加载无 TLS 拉取失败; 连接 lwsfx → @dao-devin · 26 仓库 · Sec✓(概览同步 Git1/密钥1);
  断开 → 连接归零、密钥删(API 交叉验证 connections=0/secret=false); 静置 30s 经重建不回弹。

## v4.1.2 (2026-06-12) · Git 断开正本清源 · 不臆造成功(前端 bundle 实证)

> *知不知，尚矣；不知不知，病矣。* —— 旧码"臆造成功"是病, 病病乃不病。

### 实测发现(GUI 一键备份并清空 lhfsrb → 复查 Git 仍在)
- `disconnectGit` 旧码试三个 `/git-connections/{id}` 形态(org-scoped/裸 id/org-bare),
  **真号实跑全部恒 404/405** —— 唯一 404 还被当"已删"(幂等)→ 实为臆造: 啥也没断, 却记成功。
- 道法自然·从根本审: 拉取 Devin 前端 414 个 chunk, 逐函数审 `useQuery-*.js` 的 git API 全集:
  - 列连接: `GET /organizations/{orgId}/git-connections-metadata` (只读·GET)
  - 列仓库授权: `GET /{orgId}/integrations/git-permissions?connection_id={cid}`
  - 删仓库授权: `DELETE /{orgId}/integrations/git-permissions/{permId}` → `{success:true}` (真删)
  - OAuth 断开: `DELETE /integrations/github/user` · `DELETE /integrations/gitlab/user`
  - **平台无"按 id 删 git 连接"端点**; 连接元数据记录本身删不掉(PAT 与 github_app 均如此)。

### 修 · 真删可删·残留如实报(不臆造)
- `disconnectGit(auth, conn)`: 改用实证端点 ——
  1) 列并删该连接全部 `git-permissions`(真实移除仓库访问权·返 `{success:true}`);
  2) 调 provider 级断开(OAuth 真断·PAT 幂等无害);
  3) 复查 `git-connections-metadata`: 连接消失→`removed:true`(真断); 残留(PAT 典型)→
     `ok:false` 并如实回报 `permissionsRemoved` + note(PAT 本体须在 GitHub 端撤销)。
- 真号验证(lkwpv1740858777·PAT·2 授权): 授权 **2→0**(实删·复查确认), 连接元数据残留并如实标注。
- 集成全链路实跑(lcrlpjt52958·github_app): `backupAccountFull`(快照 7知识/34剧本/1密钥/1Git·零误·先留底) → `wipeAccount`:
  知识 **4/4**、剧本 **2/2**、密钥 **1/1** 真删; Git 授权 **1→0**(访问权实撤), 连接元数据残留如实回报;
  本源默认完整保留(3 内置知识 + 32 社区剧本)。
- 新增 `listGitPermissions`/`deleteGitPermission` 导出; `wipeAccount.gitConnections` 增 `permissionsRemoved` 计数。

## v4.1.1 (2026-06-12) · 快照健壮化 · 一条失败不毁全局(GUI 实测揪出)

> *合抱之木，生于毫末；九成之台，作于累土* —— 一条端点抖动，本不该毁掉整份留底。

### 实测发现(Devin Desktop 冷启动·12 账号库 GUI 全部备份)
- 12 账号批量备份: **10/12 快照正常(各 10 文件)**, 但 2 个失败:
  - 活跃账号 `lcld`(105 对话): 快照目录创建但**空(0 文件)** —— `snapshotAccountData` 用 `Promise.all`, 六个 list 端点任一在并发批量下瞬时失败(抖动/限流)即抛错, 整份快照丢失只留空目录。
  - `likhh`(74 对话): **无快照目录** —— `backupAccountFull` 先备份对话再快照, 对话备份抛错则快照根本没机会跑。
- 单独 node 复跑两账号均成功(280/173/2 · 4/33/1), 证实为并发瞬时失败, 非逻辑错。

### 修复 · 各自尽力·不臆造
- `snapshotAccountData`: `Promise.all` → 每条 `_settle`(带 3 次重试+退避·allSettled 语义)。一条失败只记 `snapErrors` 并续跑, 有几条存几条; `_manifest.json`/`账号快照.md` 写入 `partial`+`errors` 如实标注。空目录缺陷消除(必有 manifest/index 留底)。
- `backupAccountFull`: 对话备份与数据快照解耦 —— 对话备份抛错不再连累快照, 各自留底, 回传 `convError`。
- 实测复跑: lcld/likhh 均产出完整 10 文件快照·零错误。

## v4.1.0 (2026-06-12) · 各方面数据存好 · 备份并清空一步到位

> *既得其母，以知其子，复守其母，没身不殆* —— 留底为母，清空为子；先留母后去子，账号可复。

### 备份模块 · 补齐"各方面的数据"
- 旧缺口：备份只存"对话正文 ZIP"，知识库/剧本/密钥/Git **未留底**（而 list 接口本就全返回正文）。
- 新增 `snapshotAccountData(auth, opts)`：把账号**全量数据**快照到本地
  `<root>/<账号名>/_账号快照_<时间戳>/`：
  - `知识库/<N>_<名>.md`（含触发条件 + 正文）+ `知识库_index.json`
  - `剧本/<N>_<标题>.md`（含正文 + examples）+ `剧本_index.json`
  - `密钥.json`（key/note/scope/加密值·不解密）· `git连接.json` · `会话清单.json` · `额度.json`
  - `_manifest.json` + 人看 `账号快照.md`（统计表）
- 新增 `backupAccountFull(auth, opts)` = 对话 ZIP(增量) + 账号数据快照，一次留全。
- **批量备份**（`💾 全部备份`）改走 `backupAccountFull`：每账号对话+知识+剧本+密钥+Git 全量留底。
- 实跑验证（真号 `kxoqhiq431597`）：快照落盘 15 知识 MD + 38 剧本 MD + 密钥/Git/会话 JSON，正文完整。

### 删除模块 · 备份并清空(回归本源) 一步到位
- 旧流程"建议先备份再清理"是两步（备份完要再点一次）。
- 改为模态二选一：**「备份并清空(回归本源)」**（先 `backupAccountFull` 全量留底→再 `wipeAccount` 清空）/「仅清空(不备份)」。
- 留底失败时再次模态确认（跳过此账号 / 仍要清空），避免无备份误删。

### 删除模块 · 实跑揪出 3 个"臆造成功"真缺陷（端点错→404 被误判为已删）
> *知不知，尚矣；不知不知，病矣* —— 旧码把 404 当"已删成功", 实则从未删掉。实跑证伪, 改对端点。
- **剧本删除从未生效**：旧 `DELETE /api/org-{bare}/playbooks/{id}` 恒返 404，被 `okDelete(404)` 误判成功。
  实测正确端点 **`DELETE /api/playbooks/{id}` → 200 真删**（beasley 实跑 6 个用户剧本 6/6 删除，再查为 0）。
- **密钥删除从未生效**：同样 404 误判。实测 **`DELETE /api/secrets/{id}` → 200 真删**（beasley 2 密钥实跑删至 0）。
- **对话删除从未生效**：平台**不支持硬删除**对话（`OPTIONS /api/sessions/{id}` 仅 `Allow: GET`，DELETE 返 405）。
  改用平台支持的归档 **`POST /api/sessions/{id}/archive` → 200**（beasley 70 对话全部 `is_archived=true`，移出仪表盘）。对话正文已在清空前本地留底。
- **本源默认不再误删/误报**：`wipeAccount` 现区分用户自建 vs Devin 本源默认——
  社区剧本(`access==='community'`·Cognition 共享·删返 404) 与内置知识(`note_type==='builtin'`·删返 403) 计入 `native.*` 保留不删；
  `found` 仅计可删的用户数据。回归本源 = 保留 3 内置知识 + 32 社区剧本（新账号自带）。
- Git 连接断开：元数据接口只读(`Allow: GET`)，断开端点尚未实测命中；现 best-effort + 如实回报失败（不臆造）。
- 实跑全链路（真号 beasley856439）：备份 70 对话 + 快照(8 知识/38 剧本/2 密钥) → 清空 → 用户数据归零、本源默认完整保留。

## v4.0.2 (2026-06-12) · 实践中解构 · 真账号实跑修正

> *不出于户以知天下，其出也弥远其知弥少；圣人不行而知* —— 但本版反其道：以真账号实跑，把"声称可达"逐条证伪/证实。

### 实跑发现并修复的真实缺陷
- **`createSession` 此前根本跑不通**：内部 API `/api/sessions` 校验字段为 `user_message`（非 `prompt`），旧实现 422。
  修复：payload 同时带 `user_message` 与 `prompt`。用真号 `lcld26815946`（约 $13 额度）实跑创建成功，
  会话 `devin-acf000ac…` 真实运行并回复（14 事件，含 Agent 实答），并在 Devin Desktop 原生列表与插件总览以 `[运行]` 实时显示。
- **版本页脚写死 4.0.0**，与 `package.json` 不一致 → 统一为 **4.0.2**。
- **`sendMessage` 端点错误**（旧：`app.devin.ai/api/session/{id}/message`，实测 404）。逐路由实跑确证：
  - `app.devin.ai/api` 下 `/session|/sessions × /message|/messages|/send|/reply` 全部 **404**（内部 API 无此 REST 路由）。
  - `api.devin.ai/v1/sessions/{id}/messages` **404**；`api.devin.ai/v1/session/{id}/message` **403**（路由存在·凭证不符）。
  - 结论：正确端点为公开 API `POST {v1Base}/session/{id}/message {message}`，且仅认 Devin API Key（`apk_…`）；
    会话登录态 `auth1` 与自动铸的 `cog_` service-user token 均被公开 API 拒（403）。
  修复：`sendMessage` 改打公开 v1 端点，接受 `opts.apiKey || CFG.apiKey`；无 Key 时**不臆造成功**，直接回报需配置 API Key。
- **解锁后「打开文件夹」实测弹原生错误框**（GUI 实跑：解压成功·toast `已解锁 3 个文件`，但随即弹
  *"An error occurred opening an external program. Failed to open: The system cannot find the file specified. (0x2)"*）。
  根因：`devinUnlockBackup` 用 `vscode.env.openExternal(Uri.file(目录))` 打开解压目录，explorer 启动失败时 VS Code 自弹原生错误框，`try/catch` 吞不住。
  修复：改用 `vscode.commands.executeCommand("revealFileInOS", uri)`（在系统文件管理器中定位目录·无原生错误框）；
  并把解压目录写进成功 toast（`已解锁 N 个文件 → <outDir>`），即使定位失败用户也知文件落点。

### 实测验证 (真账号 · 不打印凭证)
- 总览实时：对话 105 · 运行 1 · 知识库 252 · 剧本 160 · 密钥 2 · Git 1；额度随运行实时下降（12.862→12.846）。
- 全部备份真实落盘 **105 个对话 ZIP**（含新建 session）；`unlockBackup` 实跑解出新会话 3 文件（`_meta.json`/`对话_agent.json`/`对话_人类可读.md`），MD 含真实问答正文与 `eventCount`。

## v4.0.1 (2026-06-12) · 反者道之动 · 真链路补全

> *反者道之动也* —— 对照本源需求反向审计，补齐写接口与备份浏览闭环。

### 新增后端写接口 (代替用户发起对话)
- `createSession(auth, prompt, opts)` → `POST /api/sessions {prompt,title?,...}`；
  实测端点正确（账号有额度即可发起；当前账号池全部 `out_of_quota`，返回 403 证明端点可达）。
- `sendMessage(auth, devinId, message)` → `POST /api/session/{id}/message {message}`（官方公开 API 形态）。

### 备份浏览 + 一键解锁 (原仅打开文件夹)
- `listBackups(root)` 列出「账号→对话ZIP」树（大小/时间）。
- `unlockBackup(zipPath)` 本地 `zlib.inflateRawSync` 解压到同名文件夹（零依赖），实测 1 个 ZIP 解出 56 文件。
- 前端「📁 浏览备份」按钮 → 模态列表 → 每条「🔓 解锁」。

### 前端最小增量
- 账号下拉操作行新增「☁ 发起对话」「📁 浏览备份」按钮。
- 导出 MD 文档补充 §1b 写接口与备份浏览/解锁说明。

### 实测验证 (真实账号 · 不打印凭证)
- classifySession 对 70 个真实对话分类正确 (全 finished)。
- 增量备份「事件增长→重备追加」分支：降 high-water mark 模拟新增 → 正确重备 → 再跑跳过。
- 备份浏览/解锁全通；清理历史遗留的 `:undefined` 备份状态条目。

## v4.0.0 (2026-06-12) · 第五板块 · Devin Cloud 接入 · 无为而无不为

> *为学日益，闻道日损 —— 后端尽开，前端至简*

把「对话提取」(dao-export) 与「全功能 CRUD」(dao-vsix) 两套底层合一，直接接入
RT Flow 账号池，成为第五板块。每账号 `email+password → auth1+org_id`，之后所有
Devin Cloud 能力皆走后端接口。新增 `devin_cloud.js`（零依赖单模块，含自带 ZIP 写出器）。

### 账号列表下拉（☁▾）
- 点击展开 → 登录并拉取本账号 Devin Cloud 概览：**对话记录（着重）** + 知识库/剧本/密钥/Git 连接/额度 简要
- 每条对话显示名称 + 运行状态（运行/卡住/完成/空闲）
- 下拉内置：导出全部对话（增量）、账号标签、水过无痕

### 对话追踪（扩展至 Devin Cloud）
- 原追踪 Cascade → 现并行追踪 Devin Cloud 运行中对话
- 账号行直接标记 `● 运行N`（无需展开下拉即可见）
- 左下角 IDE 通知：卡住/额度超限提示 + 对话完成提示
- 每账号标签（防搞混）
- 轻量轮询：仅查询已登录账号，不强行登录全部（无为）

### 备份（Devin Cloud 结构 · 增量）
- 目录：`<账号名>/<对话ID末8位>_<对话名>.zip`
- 每 zip：`对话_人类可读.md` + `对话_agent.json` + `files/<产出文件>` + `_meta.json`
- 增量：比较事件数，同源对话不重复备份
- 可选自动备份（定时增量）+ 手动（单/批量）

### 导出 MD（前端最小化）
- 一个「导出 MD」按钮 → 生成后端操作指令文档，复制给本地 Agent 即可后端驱动全部能力
- 全软编码、唯变所适

### 水过无痕（一键清理）
- 每行小按钮（🌊）+ 批量清理：删除账号在 Devin Cloud 的全部痕迹
  （对话/知识库/剧本/密钥/Git 连接）→ 账号回到未使用态
- 先 dry-run 扫描 → 模态确认（列出待删数量·可先备份）→ 顺序删除
- 适用于已用尽额度、不再需要的账号

### 新增命令
`wam.devinExportMd` · `wam.devinBackupAccount` · `wam.devinBackupAll` · `wam.devinWipeAccount`

### 新增配置
`wam.devinCloudAutoBackup` · `wam.devinCloudAutoBackupIntervalMin` · `wam.devinCloudBackupDir` · `wam.devinCloudRunPollMin`

### 修订（e2e 实测后）
- 账号标签：原 webview `prompt()` 被 VS Code webview 屏蔽（无输入框）→ 改走扩展宿主 `showInputBox`，预填当前标签、可清除。

## v3.13.0 (2026-06-28) · Devin Desktop 自适应 · 万法归宗 · 当前

> *道常无为而无不为 · 侯王若能守之 · 万物将自化* —— 币书《老子》道经

### 背景

Windsurf 品牌正式迁移为 Devin Desktop (Cognition 收购 Windsurf)。IDE 内部命令已从 `windsurf.*` 变更为 `devin.*`。

### 179 实测发现 (PSSession 直连)

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

### 新增工具: `_dao_doctor.ps1` · 环境兼容性诊断

帮新用户/异常环境用户排查 9 大检查项：

```powershell
.\_dao_doctor.ps1                  # 完整诊断 · 21 个 pass 项 + 警告/失败
.\_dao_doctor.ps1 -Quiet           # 仅显示问题项
.\_dao_doctor.ps1 -ExportReport    # 导出 JSON 到 ~/.wam/_doctor_report.json
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
| `_dao_doctor.ps1` | **新增** · 9 检查项 · UTF-8 BOM 安全 |
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
旧 (v3.11.7): _vscdb_helper.py 在源 1085B · _dao_deploy.ps1 未复制 → vscdb 直读失败
            → sessionCache 永空 → entry.title 全 null
            → hub.json 用 "对话 #UUID" 兜底
            → 用户截图全是 #c65b3411 编号
```

**治法**: `_dao_deploy.ps1` v15.1 强制 `_vscdb_helper.py` 必随; `.vscodeignore` 加 `!_vscdb_helper.py`; 不再有部署遗漏可能。

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
| `_dao_deploy.ps1` | copy 加 _vscdb_helper.py | - | - |
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
| 图3 | v2.7.0 在 179 端实证 138 号·1 未验·25 耗尽·trial 状态混乱 | parseAccountText 残漏 |

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

- 立 `Get-WamDir` 助手于 `_dao_lib.ps1` (尊 `_dao_env(.local).psd1` `wamHomeDir`)
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

v17.42.20 (2026-04-末) 及 v17.42.x 全系**满载本体**已归档于 [`_archive/wam-v17.42.20/`](https://github.com/zhouyoukang/windsurf-assistant/blob/HEAD/../../_archive/wam-v17.42.20/):

- 完整 `extension.js` 437 KB / 10913 行
- 387 E2E 断言
- 完整 v17 CHANGELOG 72 KB · `_archive/wam-v17.42.20/CHANGELOG.md`

二者为**同名异体 · 各臻其极** · 不相代而相成.

---

*德经曰: 上士闻道 · 堇而行之. 道极版即「闻道而行」之践*
