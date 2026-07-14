# Changelog · dao-proxy-pro

> 完整版本历史。详情页（README）保持精简，本文件单列于扩展的 Changelog 标签页。

v9.9.353 · 官方直通 502 根治·收官(stale 优先于配额·实证反代真通)
: 承接 v9.9.352——实机(Devin Desktop · 免费 SWE-1.6 Slow)复现暴露残缺: 官方以 Connect
  `code=failed_precondition` 回陈旧会话错, 而旧 `exhausted` 启发式含 `precondition` 关键字
  → 陈旧会话被**误吞为配额耗尽**(既不失效陈旧帧、又误置 `premiumQuota=exhausted`; stale 分支
  受 `!exhausted` 守卫从不执行) → 死锁重演。正法: 提取纯函数 `_classifyOfficialErr(txt)` 确立
  优先级契约「会话失活/版本过旧 > 配额耗尽」, HTTP≥400 与 Connect end-stream 两分支同序判定;
  stale 命中即失效陈旧帧 + 回明确重采指引(不误置配额)。新增 [20] 回归: precondition 编码的
  陈旧会话判 stale 不判 exhausted、真配额 precondition 仍判 exhausted 不误判 stale。
  实证闭环: 新鲜捕获帧下经反代调免费 `swe-1-6-slow` —— OpenAI unary 5/5 HTTP200、SSE 流式
  增量+`[DONE]`、Anthropic `/v1/messages` 200(官方反代真通); 帧陈旧(约 1min)即 424
  `stale_session` 自动失效重采。守正: 绝不伪造客户端版本号。
  安全收官(邦利器不可以视人): 实机审计发现 `GET /origin/{ea,revproxy}/handoff.md` 无鉴权、
  且文中内嵌本机 `apiKey` + 公网隧道 URL —— 隧道活时任何知公网 URL 者 GET 即读走 key、
  彻底架空 apiKey 防护(数据面 `/v1/*` 已正确 401, 唯交接文档漏防)。正法: 新增 `_handoffGuard`
  与数据面同鉴权模型—本机(loopback·无 cf/转发头)零配置可读, 公网(隧道转发)/非本机必须持
  有效 Bearer key(持钥者本已知 key·返回无害); 两文档端点同守。新增 [21] 回归 5 例:
  本机放行 / 公网无 key 被 401 且响应不含真 key / 公网持有效 key 放行 / 公网错 key 被 401。

v9.9.352 · 根治官方直通 502 · 陈旧会话/版本失配自愈(反者道之动·没身不殆)
: 承接实机 502 排查——经模型反代调官方直通(免费 SWE-1.6 等)时上游回
  `There was an error with your Cascade session, please update your editor`,
  旧实现把它当普通 `upstream_error` 502(暗示网关瞬时故障) → 客户端对同一**陈旧捕获帧**
  无限重试、盘存坏帧从不失效 → 回环永久卡死, 唯有用户手动再发一条 Cascade 对话才解。
  三十九章「其致之也·侯王毋已贵以高将恐蹶」: 帧之贵在其活, 死帧当弃。本版:
  ① `source.js` 增 `_isStaleSessionErr()` 精准识别「会话失活/客户端版本过旧」拒绝
     (regex 收紧·不误伤配额/普通故障);
  ② 增 `_invalidateStaleFrames()`: 命中即失效内存主/免费槽 + 删盘存帧文件
     (`chatframe(.free).bin/.json`) + 弃陈旧鉴权信封 → 下次 IDE 活跃(补全/对话)自然
     重采新鲜帧, 回环自愈(不再狂重试同一坏帧);
  ③ `_officialChatReplay` 两处错误分支(HTTP≥400 与 Connect end-stream)接入: 换主槽
     兜底重试仍败且判定陈旧 → 失效坏帧 + 回明确可执行指引(而非生吞上游原文);
  ④ `revproxy.js` `_classifyUpstreamError` 把会话失活/版本过旧归为 **424 Failed
     Dependency + `code=stale_session`**(先决条件缺失·非瞬时故障) → 客户端据此停重试
     并按指引重采, 而非盲目退避。
  守正不伪: 绝不伪造/篡改客户端版本号绕过官方版本门槛(欺骗且危账号)——只失效坏帧、
  引导以「当前真实运行的 IDE」重采真实鉴权信封。自检新增 [20] 覆盖归类与失效自愈。

v9.9.351 · 模型反代用量记账归一 · 反代调用亦入「用量与成本」
: 实机验证(DeepSeek/小米 Mimo 双渠道直连+路由+反代全链路)时发现: 经模型反代
  `/v1/chat/completions`(OpenAI 兼容)与 `/v1/messages`(Anthropic 兼容)调用第三方渠道,
  tokens 消耗**不入**面板「用量与成本」(`/origin/ea/usage` 恒空)——用量聚合仅覆盖 Cascade
  路由路径(`dao_router.route()` 内 `_recordUsage`), 反代路径旁路了记账。四十四章
  「知足不辱 知止不殆」: 知其所耗, 方知所止。本版:
  ① `dao_router.js` 导出 `recordUsage`(外部记账入口·与 Cascade 路径共用同一张
     `_usage` 表·同享缓存命中率/成本估算);
  ② `runtime.js` 增 `routerRecordUsage()` 透传;
  ③ `source.js` `_revproxyDeps()` 注入 `recordUsage` 依赖;
  ④ `revproxy.js` `_bridge()` 在 onUsage 处按渠道/模型记账(仅第三方渠道目标·
     builtin-stub/官方直通不计·流式与 unary 皆覆盖)。
  实测: 反代双协议调用后 `/origin/ea/usage` 正确出账(deepseek 与 xiaomi-mimo 各自
  calls/input/output/cached/hitRate 齐全)。

v9.9.350 · 根治「添加失败: runtime not loaded」· 健壮解析外接api目录 + ea/* 惰性自愈
: 承接用户端反馈「加渠道即报 runtime not loaded」——排查确认开发机运行时正常(路由就绪·25模型),
  故为**安装/环境特定失败**。根因: `source.js`/`extension.js` 硬编码中文目录名「外接api」(非 ASCII),
  在 VSIX(zip) 打包/解包时非 ASCII 目录名编码不稳, 部分用户机上目录名被搞坏(mojibake) →
  `fs.existsSync(...外接api/runtime.js)` 恒 false → `_eaRuntimeMod` 永为 null → 加渠道即
  「添加失败: runtime not loaded」。本版:
  ① **健壮目录解析**: 新增 `_resolveEaDir()`/`_eaRuntimePath()`/`_eaRouterPath()`(source.js)与
     `_resolveEaRuntimePath()`(extension.js) —— 先试规范中文名, 找不到即按内容扫描 vendor/ 下
     「含 runtime.js + core/dao_router.js」的子目录, **名字坏掉也能凭内容命中**。全部硬编码
     「外接api」路径(初载/热重载/缓存清理)改走解析器。
  ② **ea/* 惰性自愈**: 新增 `_ensureEaRuntimeMod()`, 任何 `/origin/ea/*` 请求进入前先试按需补载
     runtime(require 缓存命中即秒返), 不再一遇 null 就直接抛「runtime not loaded」· 反者道之动。


v9.9.351 · 发布包补齐全部运行时文件 · 「runtime not loaded」终章
: 实锤真源: 发布页 9.9.347 VSIX **不含 vendor/外接api/runtime.js** —— `runtime.js`/`cascade_wire.js`/
  `sp_core.js`/`resilience.js` 等 39 个运行时文件与 `vendor/bundled-origin/` 全套从未提交入仓,
  打出的安装包天生残缺, 装谁谁报「runtime not loaded」。本版: ① plugins/ 补齐 39 个缺失文件;
  ② packages/(CI 打包源)补齐 bundled-origin 全套 23 文件并字节对齐本源 devin-remote v9.9.350;
  ③ 干净克隆重打包并闭环实测: 解包直启 origin → 添加 DeepSeek/小米MiMo 真实渠道 ok → 模型自动
  发现 → 探活 200 真实补全。渠道配置存于 `~/.codeium/dao-byok/配置.json`, 升级/重装不丢。

v9.9.350 · 根治「添加失败: runtime not loaded」· 健壮解析外接api目录 + ea/* 惰性自愈
: 承接用户端反馈「加渠道即报 runtime not loaded」——排查确认开发机运行时正常(路由就绪·25模型),
  故为**安装/环境特定失败**。根因: `source.js`/`extension.js` 硬编码中文目录名「外接api」(非 ASCII),
  在 VSIX(zip) 打包/解包时非 ASCII 目录名编码不稳, 部分用户机上目录名被搞坏(mojibake) →
  `fs.existsSync(...外接api/runtime.js)` 恒 false → `_eaRuntimeMod` 永为 null → 加渠道即
  「添加失败: runtime not loaded」。本版:
  ① **健壮目录解析**: 新增 `_resolveEaDir()`/`_eaRuntimePath()`/`_eaRouterPath()`(source.js)与
     `_resolveEaRuntimePath()`(extension.js) —— 先试规范中文名, 找不到即按内容扫描 vendor/ 下
     「含 runtime.js + core/dao_router.js」的子目录, **名字坏掉也能凭内容命中**。全部硬编码
     「外接api」路径(初载/热重载/缓存清理)改走解析器。
  ② **ea/* 惰性自愈**: 新增 `_ensureEaRuntimeMod()`, 任何 `/origin/ea/*` 请求进入前先试按需补载
     runtime(require 缓存命中即秒返), 不再一遇 null 就直接抛「runtime not loaded」· 反者道之动。

v9.9.347 · 内网穿透对齐二合一本源 · 激活即自动连接 + 模型反代专属交接文档
: 承接用户实证「Proxy Pro 内网穿透整体没跑通·甚至没自动连接好」——本源(dao-vsix 二合一)的公网穿透
  是开机即自动打通的去中心化通道, 而 Proxy Pro 仅在用户已绑 CF API Token 时才自动拉起固定中继,
  **零账号快速隧道从不自动起**, 用户须手点「启动隧道」→ 表象即「没有自动连接好」。本版补齐:
  ① **激活自动连接(`_brgAutoConnect`)**: `server.on("listening")` 延迟 6s(待反代就绪)自动打通公网,
     优先级「善用者不弃物」= 已绑 workers.dev 固定中继(持久·永不轮换)> 已存命名隧道令牌(固定域名)
     > **零账号快速隧道(去中心化默认·无需任何账号)**; 缺 cloudflared 二进制后台 6 路镜像拉取, 就绪后
     watchdog 自起(不阻塞激活)。实测激活 <5s 即得 `*.trycloudflare.com` 公网URL。
  ② **手动停止即真停(`_BRG_USERSTOP` 旗·移植 dao-vsix `bridgeUserStopped`)**: 用户点「停止」落盘暂停旗,
     自动连接/自愈见旗即挂起(尊重用户意志); 任一手动「启动/重启」撤旗恢复常驻; 24h 安全自复防遗忘致
     公网端点永久断线。`_brgStartTunnel(named, manual)` / `_brgStopTunnel(manual)` 新增 manual 形参贯通。
  ③ **模型反代专属 Agent 交接文档 `GET /origin/revproxy/handoff.md`**: 与总交接文档 `/origin/ea/handoff.md`
     分工, 专注「模型反代 → 内网穿透 → 公网第三方无感直调」这一条链路的接管。实时含: 当前状态表
     (反代开关/可反带模型数/本地Base/Key/隧道状态/公网Base/持久中继)、公网直调 curl+Python 范例
     (换 Base 不换 Key)、三条开通/自愈路(零账号快速隧道 / 一个 CF API Token 零域名固定中继 / 命名隧道)、
     热管理 API、自愈要点。④「模型反代」面板底部新增「📄 Agent 交接文档 · 模型反代→公网直调」区
     (复制/下载/预览), 与②「渠道配置」面板底部的总交接文档并列。
  ④ endpoint.json 的 `revproxy` 段增 `handoff_url`; ⑤ 面板顶部文案标注「激活即自动连接·断线 15s 自愈·
     手动停止后点启动/重启恢复」。道义: 三十七章「道常无为而无不为」· 无为=用户零操作, 无不为=公网恒通。

v9.9.346 · 捆绑 ACP 代理 · 实证收口(DESKTOP-MASTER 现场日志驱动)
: 承 v9.9.345 把捆绑 ACP 代理(chisel)的 `WINDSURF_API_SERVER_URL` 锚向本地反代后, 现场实测
  (controlled spawn·`devin.exe acp` 注入 env)暴露两处收口点, 本版补齐:
  ① **`GetCliTeamSettings` 归 PASSTHROUGH(修 Connect 解码 `invalid tag value: 0`)**: 该 RPC 原
  命中 v9.9.344 的 `LOCAL_AUTH` 短路 → `_replyGrpcOk` 回的是 **gRPC 帧**(5 字节前缀·首字节 0x00
  压缩位)。LS 走 gRPC 只验 `grpc-status` 故无碍; 但 chisel 走 **Connect** 协议按 unary(裸
  protobuf·无帧前缀)解 payload → 首字节 0x00 被当作 field tag 0 →
  `Connect decode error: Protobuf decode error: invalid tag value: 0` → `Failed to fetch team
  settings`。解: 把 `GetCliTeamSettings` 并入 `SEATMGMT_PASSTHROUGH_METHODS`(与 `GetUserStatus`
  同), 由真端(self-serve)按客户端协议正确成帧回**真 TeamSettings** → chisel 解码必过; 官方不可达
  时 chisel 自有磁盘缓存兜底(实测 0ms `Team settings loaded from cache`)→ 仍不卡。
  ② **`dao-acp-stdio-proxy.js` 永久版·健康门控自注入**: v9.9.345 的 env 注入在 `extension.js`
  spawn-hook, 仅新装 ≥v9.9.345 生效; 用户机现装 **v9.9.334** 无此逻辑。故把「反代健康→锚定
  `WINDSURF_API_SERVER_URL`+`NO_PROXY`」下沉进 stdio 中间人: spawn 前探本地反代 `/origin/ping`,
  200 才注入(与 `_proxyHealthy` 同源门控·失败安全直连官方); stdin 探测期间缓冲保序回放。中间人
  每次 spawn 重读本文件 → **已装 v9.9.334 基座无需 reload/重装即刻生效**。若上游 spawn-hook 已锚则
  不覆写(分工不重)。实证: 注入后 `Model registry fetched from API in 906ms`(经反代出站)·team
  settings 不再 3s 超时·`authenticate` 正常受理·无「Connecting to server」。
  道义: 五十二章「天下有始 以为天下母 · 既得其母 以知其子」· 母=本地兜底 · 子=鉴权态。

v9.9.345 · 捆绑 ACP 代理(devin.exe/chisel)鉴权本地锚定 · 根治「Connecting to server」残余
: 病(根因·实证于 DESKTOP-MASTER exthost/ACP 日志): v9.9.344 已把 LS(language_server)的
  `--api_server_url`/`--inference_api_server_url` 反代至本地 8937, 但 IDE 另起的**捆绑 ACP 代理**
  (`devin.exe acp --agent-type summarizer`, 即 chisel · 自持 windsurf_api_client)**漏网**——它绕开
  8937, 经系统 VPN 直连 `WINDSURF_API_SERVER_URL`(默认 server.codeium.com)取 `GetCliTeamSettings`
  做启动鉴权。官方经系统代理偶发 >3s 即 `Team settings refresh timed out after 3000ms` →
  `Failed to authenticate bundled agent` → 前端永卡「Connecting to server」(与官方可达性强耦合·
  VPN 抖动即复发, 故 v9.9.344 后台式机仍偶现)。
  治(既得其母 以知其子): `installSpawnHook` 拦截 devin.exe(ACP)时, 反代健康即注入
  `WINDSURF_API_SERVER_URL=http://127.0.0.1:<反代口>`(经 stdio 中间人 `env:process.env` 透传至
  devin.exe), 并把 `127.0.0.1,localhost,::1` 纳入 `NO_PROXY`(本地反代走明文 h2c·须绕开系统 VPN 代理,
  否则 127.0.0.1 被兜转致连不上)。于是 `GetCliTeamSettings` 命中反代→即刻本地 gRPC OK(实测 ~75ms)·
  无 3s 超时·鉴权必过·与官方可达性彻底解耦; `GetUserStatus`/`GetCliModelConfigs` 经反代 PASSTHROUGH
  取真数据(官方可达时)。新增 `_acpEnvAnchorApi(env)` 复用于 spawn/spawnSync/execFile 三处。
  fail-safe: 仅 `_proxyHealthy` 时改写(与 `maybeRewriteLsArgs` 同源门控)·否则原样直连官方·
  "至少和没装插件一样能用"。道义: 五十二章「天下有始 以为天下母 · 既得其母 以知其子」。

v9.9.344 · 座席鉴权本地兜底 · 根治「Connecting to server」(釜底抽薪)
: 病(根因): LS 启动后周期调 SeatManagement/GetUser 座席鉴权 + Heartbeat 心跳。
  SeatManagement 非 API_SERVER/INFERENCE → 默认归 PASSTHROUGH 路由至 UPSTREAM_MGMT
  (server.self-serve.windsurf.com), 该端不实现此 RPC → 404/连接断; 同理 Heartbeat
  走 server.codeium.com。官方 H2/gRPC 长连一旦在本网络被切断(与 cloudflared/relay 同症),
  座席鉴权即不可达 → LS 判定「未鉴权」→ GetUserSettings 空 → 前端永卡「Connecting to server」。
  治(反者道之动·釜底抽薪): 新增 `LOCAL_AUTH` 分类 —— `LOCAL_AUTH_SERVICES`(SeatManagementService)
  与 `LOCAL_AUTH_METHODS`(Heartbeat)命中即本地直返空 gRPC OK(status=0), LS 只验 grpc-status
  即认「已连接」, 彻底解耦官方可达性。守真: `GetUserStatus` 仍走 PASSTHROUGH 经 proxyToCloud
  做真解锁改写(去 Pro 锁/补 field20); 模型目录仍由 GetUserSettings(MODEL_UNLOCK)注入;
  推理仍走 BYOK/INFER_STRIP → 本兜底不夺其真。新增 `_replyGrpcOk()` 本地 gRPC OK 应答器。

v9.9.343 · 根治 Windows 黑窗闪现(windowsHide 补齐)
: `_readSystemProxy()` 的 `reg query` execSync(经 cmd.exe)、独立版 `_brgProbeLocalProxy()`
  7 端口 `Test-NetConnection` spawnSync(一轮最多闪 7 个 powershell 窗)、`where cloudflared`
  execSync 均缺 `windowsHide:true` → 台式机经常性黑窗弹出。全部补齐并配 stdio 静默。

v9.9.342 · 内网穿透架构大修(移植 dao-bridge 核心) + ⑤ 面板归一折入复用共享隧道
: 独立版: 把 dao-bridge 底层完整移植入 source.js —— 代理检测(7 端口探活)+注入 cloudflared
  子进程、二进制 --version 验证、断点续传、CONNECT 代理隧道下载、多镜像回退(6 路)、看门狗
  (15s)、resetProxy API —— 使 Proxy Pro 单插件即可独立起隧道暴露反代端点公网, 且用独立
  命名空间(proxypro 8957 · cloudflared 独立)与 dao-vsix(9920)井水不犯河水。
  归一折入版(dao-one · foldBridge): ⑤ 内网穿透面板不再隐藏、五 tab 全出; 但公网穿透
  **复用**二合一本源「🌐 内网穿透 · DAO Bridge」的**同一条** cloudflared(道并行而不相悖·
  不重复造轮子)——`_brgReadSharedTunnel()` 读 dao-vsix 落盘连接文件(~/.dao/dao-conn-current.json
  等)取共享公网 URL; `_brgStatus(preferShared)` 于折入模式回显该 URL; `/origin/revproxy/tunnel`
  认 `?shared=1`。折入模式隐藏启停按钮(启停归顶部🌐板块)与 Cloudflare 命名隧道区, 只留「↻ 刷新」,
  下方状态/公网接入/自测实时映射共享隧道。

v9.9.341 · 视图 ID 归 daopp.* 命名空间(根治与归一内折 Proxy Pro 抢注视图)
: v9.9.340 并行修复只把命令归了 `daopp.*`，视图仍注册 `dao.essence`/`dao.router` —— 与
  dao-one 内折的 vendor-proxy 抢注同一视图, 后激活方直接 FATAL(`view already registered`),
  归一插件整体激活失败, 连带官方服务链路错位(连不上服务)。本版把视图 ID 一并归
  `daopp.essence`/`daopp.router`(package.json contributes 与 registerWebviewViewProvider 两处同步),
  独立版与归一内折版井水不犯河水。

v9.9.334 · 守真突破(活鉴权信封 · 脱「首次须用户发对话」之依赖 · 无为而无不为)
: v9.9.333 的会话鉴权保鲜仍以「最新捕获帧 `_lastChatFrame`」为唯一鉴权源, 而该帧只由
  CHAT_PROTO(GetChatMessage)捕获 → 持久帧 token 随会话轮换失活时, 仍须「用户再发一条
  Cascade 对话」铸新活 token(守真)。此即「首次/每次都要用户发消息」之限的根。
  正法(道法自然): 会话鉴权信封(顶层 field1·内含 `devin-session-token`)并非 chat 独有——
  IDE 一活跃(打开文件即触发的自动补全/上下文等 inference 请求)就向本 origin 发出携同一
  鉴权信封的请求。故新增 `_harvestAuthEnvelope(body)`: 从任一 inference 请求
  (CHAT_PROTO/CHAT_RAW/INFER_STRIP)采顶层 field1[+field16 cascadeId], 内容自证含会话标记
  (`session-token`/`devin-team$`/`devin-session`)才采信, 存 `_lastAuthEnvelope`(内存·随宿主生死·
  不落盘免持陈)。`_graftFreshSession` 改为在「活鉴权信封」与「最新捕获帧」间按 `at` 取更鲜者
  作鉴权源, 配合磁盘常驻骨架帧(形)嫁接 → 用户只需打开 Devin Desktop 正常用, 系统即自然
  采得活鉴权出包, 不待守真。`/origin/ping` 的 `authgraft.last_src` 标注本次嫁接鉴权源
  (`envelope`|`chatframe`)。宁稳勿崩: 非鉴权信封不动、全 try 兜底、序列化失败回退原体。

v9.9.333 · 会话鉴权保鲜(治「初始帧」失活 · 跨会话回放不再 unauthenticated)
: 用户实测反代免费模型恒返回「官方上游错误: an internal error occurred」。经把捕获帧原字节
  直发上游(server.codeium.com)复现, 得真错码 = `unauthenticated`(被上游掩码为
  "an internal error occurred")。根因: 鉴权令牌 `devin-session-token$<JWT{session_id}>`
  嵌于帧体顶层 field1(子消息 field1.3), 与 field16(cascadeId)为「会话钉定」的一对;
  捕获帧仅存该令牌、从不刷新。免费活水槽帧常捕于「上一会话」→其 token 随会话轮换失活,
  而主槽每轮皆被最新捕获帧覆盖(携当前活会话 token)。免费档回放取免费槽 → 带失活 token →
  上游 `unauthenticated`。此即上个对话遗留「初始帧」病之真因(非配额、非路由)。
- `source.js` 新增 `_graftFreshSession`(+ `_topFieldRaw`): 回放前, 若取用帧非最新捕获帧
  (如旧免费活水槽), 借「最新捕获帧」(`_lastChatFrame`·恒最鲜·携当前活会话)的 field1(鉴权
  子消息)+field16(cascadeId)整体嫁接到回放体 → 任一历史槽帧皆借最新活会话鉴权出包,
  跨会话回放不再失活。缺 field1 / 序列化失败则回退原体(宁稳勿崩)。
- 于 `_officialChatReplay` retarget 后、发包前施加; `/origin` 诊断新增 `authgraft`
  计数(rewrites>0 证嫁接生效·last_age_ms=所借最新帧新鲜度)。原汤化原食·活水恒足。

v9.9.332 · 反代提示词隔离(回归模型本源) + 模型外接选择
: 用户反馈反代端点回包错乱——上游模型自认 Cascade、回包混入插件语境。根因: 官方直通
  复用捕获帧时, 帧内仍携 Cascade 全量系统提示词(捕帧于注入前=原始官方 SP)。
- `source.js` 新增 `_isolateChatFrameSP`: 复用前剥净帧内 SP 载体(顶层裸文本字段 +
  数组内 role=0 条目两 schema 兼容·置空后不可解则回退原帧)。配置 `isolatePrompt`
  默认开(反代回包即模型本源·"Kimi 即 Kimi"), 关则透传旧行为。
- `revproxy.js` 模型外接选择: 新增 `disabledModels` 配置(默认空=全部反代);
  `/v1/models` 不列已排除模型、调用即 403 `model_not_exposed`;
  新增 `/origin/revproxy/models` 端点(单个/批量/setAll 热切·本机或持 key 远程可管)。
- `extension.js` 面板: 每模型/家族外接复选框 + 全选/全不外接 + 「提示词隔离」开关。
- 自检新增 [17] 提示词隔离 8 项 + [18] 模型外接选择 12 项(全过)·dao-test 328 回归全过。

v9.9.331 · 提示缓存从根修复(命中率≈0 → 真命中) + 面板缓存命中率观照
: 用户反馈外接 API 缓存命中率几乎为零。根因三重: ① Anthropic 仅 thinking 时才钉 system
  cache_control/发 prompt-caching beta 头,工具与对话历史从不钉断点 → 非 thinking 路径
  缓存归零、thinking 路径仅 system 小段可缓存; ② OpenAI 兼容流式请求不发
  `stream_options.include_usage` → 流式响应无 usage 块,DeepSeek 的 `prompt_cache_hit_tokens`
  字段亦未提取 → cached 永为 0(假零); ③ `_recordUsage` 只聚合 input/output,cached 丢弃,
  面板无从展示。
- `adapters.js` Anthropic: system 恒为 content-block 数组并钉 `cache_control:{type:"ephemeral"}`;
  末位工具钉断点(全部工具定义可缓存);新增 `_applyMessageCacheBreakpoint` 末条消息钉断点
  (下一轮整段历史成缓存前缀 · 逐轮递增命中);`anthropic-beta: prompt-caching-2024-07-31` 恒发。
  usage 增提 `cacheWrite`(cache_creation_input_tokens)。
- `adapters.js` OpenAI Chat: cached 提取兼容 DeepSeek `prompt_cache_hit_tokens`(流式+unary)。
- `dao_router.js`: 流式请求附 `stream_options:{include_usage:true}`(`provCfg.streamUsage=false` 可关);
  `_tokenCount`/`_recordUsage`/`usage()` 全链路聚合 cached+cacheWrite,按渠道/模型给出
  `hitRate`(%); unary 路径也回传 tokenCount(旧版 unary 用量从不记账)。
- `extension.js` 外接API面板: 渠道卡新增「◈ 缓存命中 x% · N tok · 写M」行,命中率绿/黄/红三色观照。
- 自检新增 L4.5「提示缓存」9 项断言(dao-test.js 全量 327 项全过)。

v9.9.330 · 治本 · 扩展↔LS 握手 wedge 自愈(从根解「连不上官方服务」反复复发)
: 真机根因定位:反代 :8937 健康、锚定亦在、预热帧已跨重启常驻(#937),但 Cascade 仍反复
卡「Connecting to server…」。真源**不是网络/配额/预热帧**,而是 codeium 扩展客户端的
**LS 状态机 wedge**——LS 进程 `exited before sending start data` 后管理器卡在
`Already waiting for language server start` 死循环、不再重启新 LS;旧看门狗只看
`/origin/ping` 健康 →「安心」早返,从不感知此 wedge,故复发不止。
- `source.js`:新增 **LS 心跳活性观照** `_lastLsReqAt`——仅在「真 LS→上游」请求(排除
  `/origin/*` 控制面与 `/v1/` 外接反代)时刷新;`/origin/ping` 暴露 `ls_last_req_at` +
  `ls_idle_s`。LS 活时每 ~5s 心跳、idle 恒低;wedge/死则 idle 持续增长 → 成 wedge 判据。
- `extension.js`:看门狗「安心」分支前置 `_maybeHealLsWedge(ping)`——`proxy 健康 + 锚定本口 +
  ls_idle_s≥90s` 即判扩展↔LS wedge → 执行 `windsurf.restartLanguageServer` 重置状态机
  (回落 kill LS 进程令其重生),带 90s 启动危窗 + 180s 冷却防风暴。**无为而无不为:机器自愈,
  无需人工重启语言服务器**。
- 新增自检 `_lswedge_selftest.js`(`npm run test:lswedge`):7 断言全过——控制面 ping 不算 LS
  心跳(idle 持续增长)、真 LS 流量刷新心跳戳(idle 归零)。

v9.9.326 · ④ 模型反代档位热切换(朴散则为器 · 家族归组 + 档位热切 + 别名直调)
: 把 Devin Desktop 的「选档」底层逻辑迁入 ④ 模型反代——同族多档(none/low/medium/high/xhigh/max,
+thinking/+fast)按**家族归组**呈现,行内一个**档位下拉**可热切该族「当前活跃档」,热生效无需重启。
- 后端 `revproxy.js` 新增家族·档位归一: `buildFamilyIndex`(从官方目录按 modelFamilyUid 归组)、
  `_familyActiveUid`(默认择档通用规则: **免费档优先** → 家族默认档 → 中档 → 首档·"免费即默认主力")、
  `familySummary`(每族活跃档 + 各档独立配额色)、`_resolveFamilyAlias`(干净家族名/familyUid → 当前活跃档)。
- 新增控制面 `POST /origin/revproxy/tier {familyUid,modelUid}` 热切档位落盘 `revproxy.json.tiers`;
  `/origin/revproxy/status` 回传 `families[]`+`tiers`;`/v1/models` 额外暴露**家族别名**(如 `gpt-5.4`)
  供外部以干净家族名调当前活跃档,显式档位 uid 仍精确直达不被改写。
- `resolveTarget` 前置家族别名解析: 外接客户端用 `glm-5.1` 即拿当前活跃档,`gpt-5-4-high` 仍精确指定。
- 前端 ④ 面板 `_rpRenderList` 重构为按家族归组: 多档族一行 family + 档位下拉(每档带 🟢/🔴/🟡 实时配额色),
  单档族保持原样;切档即 POST tier 热生效并刷新。图例增 `N族(M族多档可热切)`;一键自测下拉按家族 optgroup。
- 通用适配全部 16 个多档家族(GLM/GPT/Claude 各档),非仅 GLM;每档保留独立红绿配额色(非家族继承)。
- 自检 [13] 新增: 家族归组 + 默认择档 + 别名解析 + 热切生效 + 缺参 400,revproxy 自检扩至 45 断言全过。

v9.9.325 · 官方直通回包解码归一(配额信号真源 · Connect end-stream gzip 解)
: 修复 ④ 模型反代「官方直通」实测：捕获帧已能正确改写并真转上游(v9.9.324),但回包恒报
「官方回包解码为空」。真因：上游 Connect 流式回包的**收尾帧 = gzip 压缩的 end-stream 帧**
(flags bit0=compressed + bit1=end-stream, 载荷为 JSON `{}`/`{"error":{code,message}}`),旧解码把
gzip 字节直喂 `parseProto` 取串 → 必空;且 HTTP 200 也会在此帧内携带 quota 错误(**此处才是
配额信号真源**)。
- `_officialChatReplay` 回包处理重写：经 `parseFrames` 解 gzip 后,**按帧型分流**——end-stream
  帧(bit1)按 JSON 解析取 `error`;data 帧按 proto 收集助手增量文本。检出 `quota/exhaust/
  governor/precondition` → `_signalPremiumQuota("exhausted")` → 付费档实时转红、免费档恒绿。
- 实测(账号当日配额已尽)：付费 claude-sonnet 经反代真转上游 → 解出真·上游报文
  「Your daily usage quota has been exhausted…」→ premiumQuota 翻 exhausted → 119 模型即时
  **18 绿(8 免费+10 渠道) / 101 红 / 0 琥珀**,与渠道配置同源全量着色一致。
- 自检 [12] 扩充：end-stream gzip 帧解压 + JSON error 解析 + quota 正则命中,共 32 断言全过。

v9.9.324 · 官方直通捕获帧解析归一(反者道之动 · schema 自适应 · 逐字节保形)
: 修复 ④ 模型反代「官方直通」实测报「捕获帧解析失败」。真因：新版 Cascade GetChatMessage
wire 已将**消息数组从 field2 迁到 field3、正文从 sub-field2 迁到 sub-field3**，旧 `findMsgsField`
误把 field2(15883B 系统提示长串·`looksLikeUtf8Text` 命中)当消息数组、且 `_pbCloneSwapStrings`
仅换 <200B 纯 ASCII 短串、容不下多行长正文 → 解析必败。
- `_swapLastUserMsg` 重写为 **schema 自适应**：候选 [3,2,10,17] 里挑「末条目可解析且含字符串正文」
  者为消息数组，末条目内取「最长 UTF-8 子字段」为正文，经 `_pbRebuildField` 沿 path 逐字节重算
  长度前缀替换（只改末条、其余原样保形），不再依赖短串白名单。
- `_officialChatReplay` 摘除 `connect-content-encoding/grpc-encoding` 头（`buildFrame` 恒输出
  uncompressed，留 gzip 声明会被上游误解致 400）。
- 自检新增 [12] 捕获帧解析回归：新wire(field3)/老wire(field2)末条正文换入 + 首条保形 + 空帧不崩。
  revproxy 自检 29 断言全过。

v9.9.323 · 模型反代「全量呈现 + 配额着色 + 官方直通」(道法自然 · 万物并育而不相害)
: ④ 模型反代不再只列已接通的若干模型，而是像「② 渠道配置」一样**全量呈现一切可反代之模型**——
官方全量目录(108)+ 运行时官方家族 + 模型路由表 + 渠道显式 models，去重并育于一张列表。

① 配额着色(绿/红/琥珀) — 每个模型按「配额/费档」实时着色：免费档(swe-1-6 等 7 个 FREE)与已接通渠道
**恒绿**；官方付费档随付费配额观测态着色——有配额=绿、配额耗尽=**红**、未探测=琥珀。面板含图例统计
(🟢N 🔴N 🟡N · 免费N · 付费配额态) + 状态过滤(全部/可用/无配额/免费/渠道) + 关键词搜索。

② 官方直通(免费模型脱离配额) — `revproxy.js` 新增官方直通分支：未映射第三方渠道的官方模型经
`source.js` 捕获最近一帧真 GetChatMessage 请求、换入新 user turn 后真转云端官方推理链、解码回包
(`_officialChatReplay`)。免费档即便付费配额耗尽仍可反代出包。未预热时返回明确提示(非伪成功)。

③ 接口 — `/origin/revproxy/status` 与 `/v1/models` 现回传全量模型 + `color/status/note/free/costTier`
及 `stats`、`premiumQuota`；命令面板「查看模型反代」与 ④ 面板均按此着色。自检 revproxy 25 断言全过。

v9.9.322 · 新增第四面板「模型反代」(反者道之动 · 脱离 Devin Desktop · 标准本地端点)
: 在原三面板(①本源观照 ②渠道配置 ③模型路由)之上新增 **④ 模型反代**。把「②渠道配置/③模型路由」
里已接通的模型(免费 GLM、官方家族映射、任意 OpenAI·Anthropic 兼容渠道)**反向**暴露为标准本地端点，
脱离 Devin Desktop，供智能家居 / 本地脚本 / 其他设备以标准 SDK 直接调用。

① 本源(反者道之动) — 正向是 Cascade→上游(source.js)；反代是「入站标准请求→经渠道配置/模型路由→
标准格式回吐」的反向同源通道。新模块 `vendor/外接api/core/revproxy.js` 自包含(只依赖 node 内置 +
同目录 adapters.js)，由 source.js 在 `/v1/*` 与 `/origin/revproxy/*` 路径委派。

② 端点(标准·即插即用) —
  · `POST /v1/chat/completions`(OpenAI·流式+非流式) · `GET /v1/models`(枚举可反代模型)
  · `POST /v1/messages`(Anthropic·流式 event/非流式) · Header `Authorization: Bearer <本地Key>`
  · 上游协议自适应(openai-chat / anthropic)，复用 adapters.js 解析 SSE 再以客户端所需格式回吐。

③ 鉴权与配置 — 配置落 `~/.codeium/dao-byok/revproxy.json`：`{ enabled, apiKey, applyInvert,
exposeLan, defaultMaxTokens }`。`apiKey` 空 → 仅 127.0.0.1 放行；首次自动生成 `dao-local-*` 落盘。
`applyInvert` 默认关(透传用户自有提示)，开启则对入站 system 施「本源观照」(invertSP·剥官方着相归本源)。

④ 面板与命令 — ④面板含 启用开关 / 本源观照入站开关 / 端点+Key 一键复制+重置 / 可反代模型列表 /
一键自测(选模型→发标准 OpenAI 请求→验证全链路·适合 GLM 等免费模型)。新增命令
`dao.revproxy.toggle`、`dao.revproxy.status`。自检 `npm run test:revproxy`(mock 上游·零外发)全过。

v9.9.321 · 根治「过几小时环境一变又卡死·必须卸载才能用」(端口锚点漂移自愈·反者道之动)
: 根治本源级老问题——所有模块卡死在「Connecting to server…」中间态、必须完全卸载插件才能恢复。

① 本源(真机实证) — 多个 IDE 实例(Devin / Devin-i1 / Devin-i2 / Devin-123 …)各持独立
`%APPDATA%\<IDE>\User\settings.json`。FNV(os.userInfo().username) 同名同算同端口(如
Administrator→8937),但同刻仅一个进程能绑定它。启动竞态下落败的实例 `_ephemeralBind`
退避到 OS 空闲端口(8938/8939/9627…)并把它写进「自己的」settings.json。其属主 ext-host
一旦重载/退出,该临时端口随之死亡 → 该实例 language_server 永远 `--api_server_url
http://127.0.0.1:<死端口>` → 永「Connecting to server」。环境一变(重启/休眠/进程回收)
就触发,反复发作,只能卸载(卸载会还原官方直连)才恢复。

② 旧看门狗为何自愈不了 — watchdog 每 60s 只 ping「自算 FNV 端口 `_cachedPort`」(此刻
正被别的活窗占着,恰好健康)→「安心」早返,从不校验「本实例 settings.json 真正锚定的
那个端口」是否还活着 → 8937 活、8939 死的分裂态永不收敛。

③ 治法(损之又损·无为而无不为) — 看门狗改以「真实锚定端口」为准:
  · 新增 `_readAnchoredPort()` 从本实例 settings.json 读 `codeium.apiServerUrl` 的真实端口;
  · 每周期先 ping 该真实端口的 `/origin/ping`,死/非 dao 反代 → 触发收敛:重置健康标志、
    回 FNV 规范端口经 `proxyStart`(内含 `_reusePublishedProxy` 多窗口复用)收敛到单一活反代,
    `setAnchor` 改写 settings 并重启 LS;若全无可用反代 → `clearAnchor` fail-safe 还官方直连。
  · `setAnchor` 落锚前必当场 ping 确认端口真活(旧版仅凭启动时置一次、从不复核的 `_proxyHealthy`
    旗标即写,会把死端口写进 settings)。死则拒写、改 fail-safe 还官方,杜绝锚死端口。
幂等、20s 重启去抖、同值不写,不扰正常设备;活窗自动收敛,无须卸载。

v9.9.319 · 模型解锁根治(新架构+自愈+结果自检) + ③面板救生索(道法自然·反者道之动): 根治「新用户只剩 SWE-1.6 Slow / 其他全灰」以及「一重启 IDE 插件就没了」两大核心问题。

① 新架构解锁 — 新版 Windsurf/Devin GetUserStatus 已弃「Upgrade to Pro」徽标, 改用每模型 field20 可用标记(varint=1)控制: 免费层仅 SWE 系 4 个模型带 field20, 其余 65+ 个模型无 field20 → picker 全灰。旧徽标剥离在新架构下无锁可去(calls=0), 只剩 SWE 系可选。治法(利而不害·只增不改): 新增 proto 工具链(_pbReadVarint/_pbEncVarint/_pbTag/_pbHasField/_pbRebuildField), 沿 top.f1.f33.f1[] 为每个缺 field20 之真模型项(含 field22+field23)补 field20=1, 不删任何字段·不破坏原结构。老架构(有徽标)走原有剥离路径不变, 新架构(无徽标)走新分支 _pbEnsureModelsAvailable。离线验证: 真实抓包 33285→33480B, 69/69 全可用。

② 解锁自愈(ensureUnlockFlowing) — 根因: LS 由 IDE 开机即刻 spawn, 反代异步启动(≈8s 健康·≈15s 锚定); spawn hook 失败安全门「反代没就绪就不改写 LS 端口」→ LS 直连官方 → GetUserStatus 不经反代 → 全锁。LS 一旦直连就保持到下次重启。修复: activate 后 22s 核查 LS 是否真经反代(改写计数 + GetUserStatus 计数), 反代健康却两者皆 0 = LS 漏改写直连 → 一次性重启 LS, 重生即经反代解锁。幂等, 不连环杀·不扰正常设备。

③ ③面板 SWE-1.6 Slow 救生索(_ensureLifelineFamilies) — _getOfficialFamilies 返回的官方家族目录无 swe-1-6-slow 独立项 → ③左侧永不显示 → 用户无法连线第三方。修复: 在家族列表末恒补「SWE-1.6 Slow」(lifeline=true), 与 SWE-1.6 Fast 对称, 始终可见·始终可连第三方, 作最后兜底。

④ 结果级自检(可观测·零回归) — 以前解锁成功与否无人知(静默失败)。新增 _unlockStats 三字段: last_total(总模型数)·last_available(可用模型数)·schema(old-badge/new-field20), 每次 GetUserStatus 拦截后自动统计并暴露在 GET /origin/status real_unlock 里。一看即知「解锁了几个/总共几个/走的哪条路径」, 静默失败→可观测。

实证: xiaogao(老架构) GetUserStatus.calls=4, dropped_total=256(剥掉 256 处 Pro 锁), schema=old(badge), 全模型解锁; 1h8(新架构) 离线验证补 65 项 → 69/69 全可用, schema=new(field20)。familyTierExtend 保持默认关(道法自然·最小化操作)。

v9.9.318 · 根治「外接 API 的 ask_user_question 不弹窗」+「对话无征兆中断」两症(用户旨意·逆官方 Pro 路径到底层): 与官方模型完美并存、20 个快速选工具全可用之上，补齐两处外接 API 与官方路径的核心差异。

① ask_user_question 弹窗 — 逆向实证(zhoumac Pro 机 windsurf/dist/extension.js): 官方弹窗由 LSP 把 chat 层 ask_user_question 工具调用转为 cortex 层 RequestedInteraction{ask_user_question: CascadeAskUserQuestionInteractionSpec}(CortexStep field no:56 requested_interaction)→ 渲染阻塞式弹窗。官方模型问问题时*单发* ask_user_question 即停(终止性，问完等用户)；外接模型常把它与 multi_edit/read_file 等同轮打包发出(实证 _router_diag: "names=ask_user_question,multi_edit")→ LSP 把整批当普通工具执行，永不触发弹窗，对话无感继续。修复: 流式 `_flushTools` 与缓冲 `tool_calls` 两条发射路径均隔离——本轮一旦含 ask_user_question 且有兄弟工具，即只保留 ask_user_question、丢弃同轮兄弟(用户应答后模型自会重规划)，复刻官方「单发即停」形状 → 弹窗正常弹出。仅在 ask_user_question 与他者同轮时触发隔离，单发或无 ask 的批量工具不受影响 → 20 个快速选工具照常并发。

② 对话无征兆中断 — 逆向实证: 主流式 `_streamOaToCascade` 仅在收到上游数据时写帧。外接模型中途静默 >~10s(慢推理/token 间隙/网络抖动但 socket 未报错)时无帧可写，agRes 'error' 不触发，LSP 客户端约 10s 无新数据即 abort →「对话毫无征兆中断」。上游*报错*已由 agRes.on('error') 优雅 STOP_END 兜底；此处补的是上游*静默不报错*的缺口。修复: 与重试路径同法，主流式加空闲保活——`setInterval` 每 ~2s 检查(阈值半值，钳于 200~2000ms)，空闲达阈值(默认 5000ms，可经 `DAO_IDLE_KEEPALIVE_MS` 调)即补发一帧 DELTA_THINKING 保活，收到真实数据即复位，流结束/出错即 clearInterval；`.unref()` 不阻进程退出。道义: 五十二章「守柔曰强」· 守流不绝则不断。

线协议级回归测试: lsp_sim_run.js §5.5b(同轮打包→只剩 ask_user_question·不污染最终 stopReason/工具) + §5.5c(静默 stall 下保活启用/禁用对照·帧数与 thinking 变化·两遍工具结果一致)。全量绿: dao-test 318/0、lsp_sim 288/0。与 v9.9.317 官方聊天钉主机修复正交，三第三方路由/模型解锁/官方并存均不受影响。

v9.9.317 · 根治「装插件后官方免费模型报错·官方聊天被错路到 inference」(用户旨意): Pro 账号不装插件时语言服务器(LS)原生直连 server.codeium.com 一切正常；装插件(invert 拦截)后, 代理按方法名将官方聊天 GetChatMessage/GetChatMessageV2/RawGetChatMessage 路由到 UPSTREAM_INFER(inference.codeium.com), 而该账号在 inference 主机上对这些聊天方法确定性返回「third-party model provider unavailable」→ IDE 报 Model provider unreachable。故「不装插件正常·一装就报错」。实证(直连 replay·同一请求同字节): → server.codeium.com 得 HTTP 200 真实聊天流响应; → inference.codeium.com 得错误 JSON。修复: 官方 chat 方法的回传主机 UPSTREAM_INFER → UPSTREAM_API(server.codeium.com), 与 LS 原生 --api_server_url 一致; 被路由的第三方/BYOK 模型在更早的 _eaRouter.route()(按 kind 分流)即拦截转发, 不走此 host 选择, 故第三方路由/模型解锁不受影响。实证(VM·拦截全程开启): 装着插件连续 4 条免费 SWE-1.6 全部正确(56/81/42/12), 无 Model provider unreachable, 状态栏干净; 代理日志确认 GetChatMessage → server.codeium.com st=200(真实流帧)。

v9.9.316 · 根治「免费模型无法与 Proxy Pro 并存」(用户旨意): 有用户反馈 Pro 账号(premium 额度用尽·仅免费档可用)装上 Proxy Pro 后, 选免费 SWE-1.6 收到的是固定桩文本(「道可道也…stub响应正常」)而非官方真实回复, 免费模型无法与第三方路由并存。根因: `init()` 无条件将基础档 `MODEL_SWE_1_6` 播种到 `builtin-stub`(路由表`_routes`), 使 `shouldRoute(swe-1-6)=true` → 命中桩路由 → 官方透传被劫持。修复: 移除两处播种(默认模板 routes + 幂等补线块), 基础档不入路由表 → `shouldRoute(swe-1-6)=false` → 回落官方上游(免费原生)。仅 SWE 1.6 Fast 按用户配置路由(deepseek), 未填 apiKey 时亦回落官方。实证(VM): 修复后免费 SWE-1.6 发「Reply with exactly this and nothing else: COEXISTFREEOK」得官方真实回复「COEXISTFREEOK」(非桩文)。测试: dao-test.js L2.6 断言同步更新为修复后行为, 全量 npm test 307 通过 0 失败。

v9.9.315 · 根治「卸载后仍 Unable to connect」最深本源——IDE 自带扩展被就地打补丁的死端口 (用户旨意): v9.9.314 已把 settings.json 锚点/端口文件/证书/环变全部归零, 但用户实测卸载+重启后仍报「Unable to connect to Devin」。深挖发现真凶不在本扩展、也不在任何扩展状态里, 而在 **IDE 自带的内置 windsurf 扩展文件** `resources/app/extensions/windsurf/dist/extension.js` 被就地写入了 3 处死本地端口硬编码: `restart(A){A="http://127.0.0.1:3000",...}`、`getApiServerUrlFromContext=A=>{return"http://127.0.0.1:3000"}`、`const i="http://127.0.0.1:3001"`(inference)。实证: 官方 language_server 被以 `--api_server_url http://127.0.0.1:3000 --inference_api_server_url http://127.0.0.1:3001` 启动, 而这两个端口无人监听 → 卡死。因补丁写进了 IDE 程序本体, **卸载任何扩展都不碰此文件**, 故重启后仍连死端口。本版: ①新增 `_revertBundledExtensionPatch()`——卸载/复原时定位 IDE 内置 `windsurf/dist/extension.js`(多策略: `vscode.env.appRoot`/`VSCODE_APPROOT`/`execPath`/常见安装路径), 仅命中 dao 注入签名(端口任意)时才改, 改前备份 `.dao_patched_backup`, 还原为官方云端(`server.codeium.com` / `inference.codeium.com`); 接入 `_purgeDaoLsResidue()` → 卸载与 `cmdRestoreOfficial` 自动覆盖; ②独立 reset 脚本 `dao-reset.ps1`/`dao-reset.sh` 新增第⑦/⑥步同款还原(IDE 未运行时可用 `-IdeRoot`/`DAO_IDE_ROOT` 显式指定安装根); ③`dao-reset.ps1` 补 UTF-8 BOM, 修 PowerShell 5.1 在非 UTF-8 代码页下解析中文脚本报错。卸载即彻底归零, 含 IDE 本体补丁。

v9.9.314 · 根治「卸载+重启 IDE 仍卡 connection erroring · 无法整体清空归零」(用户旨意): v9.9.313 只清了 settings.json 的 LS 外置重定向键, 但用户实测卸载+重启后仍跳「Client windsurf: connection to server is erroring · Unable to connect」。两条更深的真因: ①**锚点未在卸载时无条件清除**——`deactivate` 的智能保锚 30s 门限是为「重载」防写风暴而设, 但「卸载」后扩展永逝、没有下一个 ext-host 来 auto-restore, 于是 `codeium.apiServerUrl=http://127.0.0.1:<死端口>` 被永久留下 → 重启后 Cascade 连死端口 → 卡死。`deactivate` 必须能区分「重载」(该保锚) 与「卸载」(必须清锚)。②**系统级残留卸载根本不碰**: `~/.codeium/_dao_ls_port.txt`(死端口 19999, 旁有 `.dao_backup` 官方原值) · `~/.codeium/dao-certs/` + 信任区自签 `CN=server.codeium.com` MITM 证书 · `CODEIUM_LANGUAGE_SERVER_BIN` 持久化环变。本版: ①**真卸载侦测** `_isSelfUninstalling()`——读 `<extensions-root>/.obsolete`(IDE 卸载流程在 deactivate 前先写入本目录), 多信号兜底(本目录/本族目录命中, 或本扩展已不在注册表); 侦测到卸载即越过 30s 门限**无条件清锚 + 复原官方直连**; ②**系统级残留归零** `_purgeDaoLsResidue()`——还原/删 `_dao_ls_port.txt`、删 `dao-certs/`、detached 子进程解信任自签 MITM 证书并清 `CODEIUM_LANGUAGE_SERVER_BIN`/`VSCODE_DEV` 持久化环变、删 `_dao_csrf_token.txt`; 保留不动 `dao-byok`(主公 key) 与 `dao/`(Cascade 记忆); ③`cmdRestoreOfficial` 一并执行系统级残留归零; ④新增**独立 reset 脚本** `scripts/dao-reset.ps1`(Windows) / `scripts/dao-reset.sh`(macOS/Linux)——不依赖扩展存活, 扩展被 force-remove(deactivate 没跑) 后亦可一键归零, 带 `-DryRun`/`--dry` 预演。卸载即彻底归零, 还官方直连。

v9.9.313 · 根治「原生卸载后官方服务器连不上·卡死中间态」+ 复原官方直连命令(用户旨意): 真因实证——卸载后 `settings.json` 残留 `codeiumDev.externalLanguageServerAddress: 127.0.0.1:19999`(把官方 Cascade 语言服务器重定向到本地外置端点), 代理/插件一去该端口即死, 官方 LSP 连不上 → 卡死中间态; 而原解锚仅清 `codeium.apiServerUrl` 系、从不碰这条 LS 外置重定向(此键由同族旧世代/残留写入, 本扩展走 Connect-RPC 层不写它)。本版: ①新增 `_restoreOfficialDirect()` 跨所有候选 IDE 的 `User/settings.json`(devin/Windsurf/Code/VSCodium + ctx 上溯本实例) 清除重定向键, 写前带轮转备份; ②`deactivate`(卸载/停用必经) **无条件**清除 `codeiumDev.externalLanguageServerAddress`/`externalLanguageServerLspPort`(本扩展从不写之 → 清之无写风暴 → 不受原 30s 门限约束), `codeium.apiServerUrl` 系仍按原防写风暴逻辑; ③新增命令「道Agent Pro: 复原官方直连 (卸载善后/解锚 · 卡死自救)」(`dao.restoreOfficial`): 完全清除重定向(含 apiServerUrl 与 LS 外置)+停本地代理+提示 Reload Window, 即便已卡死也能在命令面板一键自救。卸载后官方语言服务器自连, 不再卡中间态。

v9.9.312 · 根治「首次添加渠道探活失败·须重启+手点探测」+ 交接文档一键复制(用户旨意): 两处真因合治——①**自写抑制根除热重载竞态**: 每次热保存(加渠道/解模型)改写 `配置.json` 会触发 `fs.watch` → `init()` 全量重载 → `_providers` 被替换为新对象, 与正进行的「解模型→落 `cfg.models`→探活」内存改写打架, 致解出的模型不落、探活退化; 新增 `_lastSelfWriteData` 记录本进程写盘内容, 监听回调比对磁盘内容一致即判「自写·跳过热重载」, 仅外部手改方重载。②**探活前先解模型·绝不用渠道名当模型**: `probeAllProviders` 在 `_verifyProviderChat` 前若 `cfg.models` 空则先 `hotListProviderModels({refresh})` 拿真实模型再验; `_verifyProviderChat` 去掉 `|| name` 退化(旧法无模型时把渠道名当模型发 → 上游 400「you passed <渠道名>」误判失败), 无真实模型则明确返回「需先拉取模型」。合治后首次添加即解即探即绿、启动自动探活无需手点。③交接文档面板加「📋 复制最新状态」按钮: 一键取 `/origin/ea/handoff.md` 最新全文写入剪贴板(浏览器剪贴板不可用则经宿主 `vscode.env.clipboard` 兜底), 直接粘给本地任意 Agent 即可接管热配置一切。

v9.9.311 · 预设不重置已有体验、添加后自动识别道部模型(用户旨意): 预设 `_PRESETS` 去掉硬编码候选模型 m 字段，只给「显示名/协议/BaseURL/注册页」，选设后模型输入框留空(占位提示自动识别)，填 Key 添加后即按 `/v1/models` 全量拉取该渠道真实可用模型——既不覆盖已配渠道的现有体验，又对新建渠道做到只填 Key 即全识别，各家通治。

v9.9.310 · 端点发现档 + 接管手册(去中心交接): server listen 时随成落盘 `~/.codeium/dao-byok/endpoint.json`(随接力档刷新)，让任意远端 Agent 凭固定路径定位到运行中控制面板真实 base/port，即使临时端口轮换亦能连上；交接文档新增「接管手册」三段式：接入 + 扩展热配置 API(提示词经藏/自定义 SP/观照/用量/发现模型/热增渠道与路由)，使拿到档案的 Agent 可直接修改、管理插件与切换。

v9.9.309 · 渠道配置「打印配置JSON」按钮 + 模型路由采样度/Token 上限视图(用户旨意): ①渠道配置面板工具栏加按钮 → postMessage(openConfigJson)，宿主侧 `_resolveDaoConfigPath()`(同 runtime 序优先 `~/.codeium/dao-byok/配.json`·退 VSIX 内) + `_openConfigJson()` 在编辑器中打开配置件，便于查看/排错；②模型路由弹窗新增「Max Output Tokens」(单次回复上限)与「采样温度 Temperature(0~2·留空=默认)」字段，编辑时填写、保存随路由持久；`dao_router._callProvider` 读 `target.temperature`(仅有时)注入 bodyObj.temperature，留空不发、行为不变，max_tokens 既有逻辑不动。

v9.9.308 · 渠道适配指名相告 + 首条消息 TTFB 守护: ①渠道适配「指名相告」(参 cc-switch)——`classifyChannelResponse` 增 `_CHANNEL_HINTS`：模型未开通/Key 无效/余额不足/中转 503 上游不可用/限流/拒绝等，给可操作文案而非笼统「不可用」；`_NON_CHAT_RE` 补 t2v/i2v/t2i/seedance/seedream/seededit/video/sora/cogview/wanx/kolors/flux/mj 等，自动发现模型时剔除视频/图像生成模型(原已过滤 embedding/tts)，防其当对话模型被路由致失败，多模态对话模型(vision-pro)仍保留。②首条消息 TTFB 守护——长闲后第一条上游 200 但响应迟迟无字节(半冷 socket 静卡)致 Cascade 端死等、用户感首条被吞；`_tryRoute` 在上游 200 后先下发响应头并以 `_awaitFirstByte`(readable+read+unshift 探字不耗首字节)守首字节，超 `_TTFB_FIRSTBYTE_MS`(默 8s·可 `DAO_TTFB_MS` 调)内无首字节判卡，销毁本连并仅重试一次新接(限一次防双死回退·仅流式下头生效·用户无感)；mock 自测 307/307 全通。

v9.9.307 · 本源观照面板显示三个实时之文真游(观感不变·仅观通): 旧面板取 source.js 侧 devin body 之 SP after(经文部分)、且 tape limit=1 常取到末尾的 devin 子 RPC(summary/title/memory)之注入，非三实全文。本版 `dao_router._callProvider` 组装最终请求体后经 `global.__DAO_RECORD_UPSTREAM` 回传 {provider,model,messages,tools}；source.js 建 `_lastUpstream`(system+messages+tools 可全)暴露 `/origin/upstream`、`/origin/sig` 加 `upstream_last_at`；面板优先显真游全 all_fields(无则回退 tape)，host 推送不覆盖新真游。效果：路由第三方时每条消息即显三实之 system(官方+DAO 增量)+对话上文+工具清单全文，不再仅静态经文滞后子代理。

v9.9.306 · 经藏热切真效·注入前以持久化件为准: 根因——`hotReloadCanon()` 自 v9.9.94 定义但从未被调用(死代码)，外部改 `_origin_canon.txt` 而未走 setCanon 时，多窗口 watchdog 复制之 ext-host 实例从不重读 → 切经不动(恒为 laozi+yinfu 默认)。本版执于一源：sp_invert.js 的 `invertSP`/`invertAnySP` 注入前 `_maybeHotReloadCanon()`(节流 500ms·只读 11 字头·不变则不热载)→重读 `_origin_canon.txt`；dao_router `_getDaoEnhanceText` 注入前 `hotReloadCanon()`。复测：invertSP 恒 7921(laozi+yinfu)、yinfu→709 / laozi→7315 / laozi+yinfu→7921，三式随件入随变。

v9.9.305 · 加渠道即解析模型探测·修首次添加失败需重启: 旧探测 `_verifyProviderChat` 用 `cfg.models[0]` 当试探模型，但新渠道首次添加尚无模型，退用当前 model 发 chat → 被拒 → 探测失败，需重启后模型缓存才通。本版加渠道流程改为：先 GET `/models?refresh=1` 全量解析模型落 `cfg.models`，再 `_autoProbe`，使首次添加即有真实模型探测、无需重启窗口。

v9.9.304 · 修复添加渠道 URL 被吃掉字母 s 的回归: 9.9.303 在前端 webview 模板字符串里写的 `replace(/\s+/g,'')` 被面板转义成 `/s+/g`，导致保存渠道时 URL 里凡有字母 s 被吞(https→http、paas→paa、deepseek→deepeek)，全渠道探测失败；本版前端不做去空白(去空白由后端 `hotAddProvider` 正确处理 'http s://' 空格)。

v9.9.303 · 根治「本源观照面板：热切换经藏(单道德经/单阴符经/合一)在面板里完全无效、且只显经文而非实时注入到模型的全部文本」(实证根因·非 HTTP 层而在 webview 取数路): 痛根——webview `pull()` 取 `/origin/tape?fields=0` 之「最近一条」并渲染；外接 API 接通后，最近一条恒为 summary 子代理(英文)，且其 `after` 为捕获时定格、不随经藏热变；该 `pull()` 每 30s 及每次 sig 变即覆盖 `data`/`canonChanged` 通路已正确写入的「随经藏当场重算」之文本 → 面板遂「恒显英文/经文、切经无效」。v9.9.302 仅修了 `/origin/preview`(扩展侧状态栏取数)，未触及 webview 这条 `pull()` 取数路，故面板观感不变。本版三处归一：①`/origin/preview` 新增实时重建的 `all_fields`——取主 `chat` 槽全字段，SP 类(chat/summary/memory/ephemeral)以 `invertAnySP(原文)` 当场重算 → 切单道德经/单阴符经/合一即时反映；raw_text/user_msg/tool_def 等全字段皆返 = LLM 实收之一切文本。②webview `pull()` 改取 `/origin/preview`(主 chat 槽·随经藏重算)替代 `/origin/tape` 定格旧条 → 切经即变 + 全字段实时显，不再被 summary 子代理英文覆盖。③`data` 通路 SP 内容交由 `pull()` 的 all_fields 全文独主(仅同步 lastSP/按钮/经名/徽标)，`canonChanged` 即时触发 `pull()`，三写一源、无闪烁。结果(zhoumac 面板 UI 实证)：切单道德经/单阴符经/合一面板文本即时随变；面板显示当前实时注入到最上游 API 的全部文本(系统提示词+用户消息+工具定义+历史)，非仅静态经文。

v9.9.302 · 根治「外接渠道加了 DeepSeek/小米后完全不可用」(实证根因·载入即自愈): 旧版「添加渠道」分隔符正则退化（`/[\s,]+/` → `/[s,]+/`，把字母 s 误当分隔符），将 baseUrl/apiKey 按字母 s 切碎并持久化（如 `https://api.deepseek.com/v1` → endpoints=["http","://api.deep","eek.com/v1"]、baseUrl="http"），导致渠道指向无效主机、整套外接 API 形同虚设，且升级新版后脏数据不自愈。本版：①新增 `_reassembleSplitUrl` 载入即自愈——s 为唯一被吃分隔符（URL 无逗号/空白），顺序碎片以 "s" 重接即原样复原（`["http","://api.deep","eek.com/v1"].join("s")` = `https://api.deepseek.com/v1`），仅当 baseUrl 为裸协议碎片且重接为合法 URL 方施治，不误伤正常多端点；复原后按含/不含 /vN 重判 completionPath，清除旧的 `/v1/chat/completions` 错值防双重 /v1。②`_joinCompletionUrl` 增防双重版本段守卫：root 已以 /vN 结尾且 completionPath 又以 /vM/ 开头时去 path 版本段（deepseek/GLM 等通治）。注：被 s 吃掉的 API Key 字符已永久丢失，需在面板重粘一次（现版分隔符已正确，不再切坏）。③根治「本源观照实时提示词只显示子代理总结词、切单经/编写看似无效」(实证同一根因)：`/origin/preview` 旧逻辑取单槽 `_lastInject`——会被「summary 子代理」RPC 覆盖；且旧变换 `invertSP` 仅识主 Cascade、对 summary 返回 null → after 回退显示原始英文子代理总结词，遂令面板恒显那条英文、切单道德经/单阴符经/编写都「看似无效」(实为预览被占)。本版预览取槽归一：优先主 `_injectsByKind.chat`（缺则回退 `_lastInject`）、变换改用 `invertAnySP`（识 chat/summary/memory/ephemeral·即 LLM 实收文本，退 `invertSP` 再退 before）——面板恒显「当前实时注入到 Agent 的主提示词」，切经藏/单经/编写即时可见(实测 单道德经=7170 / 单阴符经=632 / 合一=7766 字·均道经化中文)。

v9.9.301 · 多Key/多端点加权负载均衡+故障转移·用量成本可见·配置原子写(用户旨意): ①P0-1渠道可配 apiKeys:[]/endpoints:[{url,weight}](渠道配置面板 URL/Key 逗号分隔即启用)·请求按权重选首选+遇可重试错误(429/5xx/401/403/网络异常)自动切下一候选·仅响应头未发出前转移(大制无割)·单key被限额/被封不致中断「全都能用」;②P1按渠道/模型聚合 token 用量(入/出/合计·调用次数)·新增 GET /origin/ea/usage·并注入 overview·渠道配置面板每渠道直显「▦ N次·Xk tok·≈$成本」(配 pricing:{inPer1k,outPer1k}时估算)·最小化前端·用户自查耗用;③P2-9 _hotSaveConfig 改原子写(临时文件+rename)+备份轮转(.config-backups 保留最近10份)·防写入中途被杀损坏配置.json · v9.9.300 · 渠道模型自动识别·适配一切底层(用户旨意): ②渠道配置「拉取全部模型」过去一律 Bearer + 仅探 /v1/models→Anthropic(需 x-api-key+anthropic-version)·Gemini 原生(需 x-goog-api-key + /v1beta/models)·GitHub Models(目录在 /catalog/models 而非 /inference/v1/models)等家族探测失败而回落到预设里仅有的两三个种子模型(故现象:DeepSeek/各家「只识别两个」);本版令 hotListProviderModels 按协议/家族择认证头(Bearer/x-api-key/x-goog-api-key·并尊重 authHeader/extraHeaders)·并在候选端点最前加入 GitHub Models 目录、Gemini 原生 /v1beta/models、Anthropic /v1/models?limit=1000·解析时去除 Gemini 「models/」前缀——用户只填 API Key 即自动全量解析该渠道所有可用模型(实测 GitHub Models 7→35 个);种子模型仅作离线兜底;③前端「加 Key 即自动全量识别」:已配/预设渠道在面板首载时自动后台热探一轮(_autoDiscoverAll·节流串行·失败不断流)·无需再手点「↻全部模型」——这正是为何旧版只见预设种子(如智谱只到 glm-4.6·缺 glm-5/5.1/5.2)·实测智谱自动解出 glm-4.5/air/4.6/4.7/5/5-turbo/5.1/5.2 共 8 个、xiaomi 5 个;注:DeepSeek 一方 API 实返仅 deepseek-v4-flash/pro 两个(官方如此·非漏识别)·万邦皆通·道法自然 · v9.9.299 · 三模块面板①本源观照「编」兜底稳态修复(用户旨意): 旧版点「编」无 custom_sp 时回退 /origin/preview·而 preview 依赖实时捕获的 lastInject·无对话/捕获过期时为空→textarea「跳有跳没」不稳;改为永以 /origin/custom_sp 的 default_sp 填充(随 _activeCanon 动态·帛书老子/道藏阴符经名实相符)·切经藏时若在编辑亦随经重填·归道后重拉本源;与侧栏 EssenceProvider(v9.7.6/v9.9.22 已修)同源行为·彻底消除不稳定 · v9.9.298 · 路由默认归正·道法自然唯变所适(用户旨意修订): 将 familyTierExtend 默认由「开」改回「关」(可显式 familyTierExtend:true 开)——默认行为归正为: swe-1-6(基档)=测试通道(builtin-stub)·swe-1-6-fast=用户添加首个第三方渠道后自动以其首模型路由(maybeAutoRoute/添加 provider 时自动建路由·已存在则不覆盖)·swe-1-6-slow=默认走官方原生直通(免费·不路由·之前所谓「unreachable」仅 VM 连不上官方所致·真机官方可达)·亦可由用户显式连线或置 familyTierExtend:true 后路由第三方;②渠道配置默认内置 DeepSeek 预设(主页填 key 即用)+27 家软编码预设(含智谱/阿里云百炼/字节豆包火山方舟/腾讯混元/小米 MiMo 等·一键填入+🌐跳官网拿 key);全程软编码·不硬编码任何用户隐私(APIKey/手机号等仅存运行时本地配置·绝不入插件代码) · v9.9.297 · 同族档位延伸默开(已被 v9.9.298 归正): dao_router 的 familyTierExtend 由「默关·需手动开」改为「默开·可显式 familyTierExtend:false 关」——真因(实机):Cascade「SWE-1.6 Slow」下发的 swe-1-6-slow 在 catalog 中无独立项(仅 swe-1-6/swe-1-6-fast)·UI 无从单独连线·而旧默认下其归一逻辑被 familyTierExtend 闸死→漏路→回落 VM 不可达官方上游→「Model provider unreachable」;改默开后·用户在 ③模型路由 连了 SWE-1.6 任一档(fast/base)·同族全部档位(含 slow)即归一其外接渠道(守常:仅延伸含真实非播种路由之族·纯桩族仍保官方直通);并 maybeAutoRoute 对所连族全部可见档位逐一建路由·与后端延伸互补 · v9.9.296 · 连家族即覆盖全档位(模型路由): ③模型路由 连一族时·maybeAutoRoute 对该族全部可见档位 uid(取自 _tierGroups·与双击解路读 data-uids 全断对称)逐一建路由 · v9.9.295 · 选预设干净slug命名根治: _presetSlug 改为取名中首个ASCII词(含括注内·如「字节 豆包 火山方舟 (Doubao/Ark)」→doubao)·根治原先「英文在括号内+括外全中文」类渠道(豆包/腾讯混元/阿里云百炼/智谱/硅基流动/讯飞/阶跃/百川…)被先剥括号→塌成空→统一回退成`provider`致同名覆盖的缺陷·27家预设零回退零重名实测验证 · v9.9.294 · 渠道预设大扩充(太上下知有之·最小化用户操作): ①cc-switch 预设库由12家扩至27家·国内尽收(DeepSeek/智谱GLM/Kimi/阿里云百炼通义/字节豆包火山方舟/腾讯混元/百度文心千帆/硅基流动/魔搭/MiniMax/讯飞星火/阶跃星辰/零一万物/百川)+国际(OpenAI/Anthropic/Gemini/xAI Grok/Groq/Mistral/Together/Fireworks/Perplexity)+聚合(OpenRouter/AiHubMix)+本地(Ollama) ②每条预设含官网/注册页 r 字段·新增「🌐 注册/官网」按钮一键跳转去拿APIKey(无账号即注册) ③选预设自动生成干净slug渠道名(去括注/中文/空格) ④用户三步即用:选渠道→去注册→填Key · v9.9.291 · 道法自然·对话不中断·根治(179实机实证): 输出前连接级重试(cc-switch风健壮)——upstream/代理在出首字节前断连(socket hang up / before secure TLS / socket disconnected)时·headersSent=false 安全幂等·退避重试至3次自愈;且 catch 路径补置_lastErr·重试耗尽即回传可读错误帧(不再静默死亡·对话突然中断) · v9.9.290 · 外接底层无懈(参 cc-switch): ①渠道地址归一(剥误含补全后缀·根治小米类 baseUrl 双重路径404→全不可用) ②模型全量自动解(cc-switch 多候选 /v1/models 顺序探测+↻全部模型刷新·不再只显2个) ③APIKey 保全(编辑渠道留空=保留原Key·脱敏/空不覆盖·根治Key保存后消失) ④对话不中断(上游断流/缺finish_reason 已有产出则优雅封口STOP_END·本轮可继续) · 用户只输APiK·任意渠道任意模型皆自适配 · v9.9.288 · 模型路由(面板③)前端三件套+去名补全+上游错误回传: ①连线实时稳定化(rAF+滚动跟随·不再一卡一卡) ②大板块/小模型拖拽排序(长按拖拽·localStorage持久) ③1:1对齐开关(已路由两侧重排成水平直线·可回退) · 去名补全: _deOfficialName 扩展至工具参数描述(run_command Blocking 述"Cascade")+系统提示尾(CascadeProjects)·根治真实流量残留 · 上游错误回传: GitHub Models免费层限输8000token·Cascade真实请求(25工具+万字SP)→413·代理原挂起→现把上游4xx/413转可读错误回传Cascade(不再对话死亡) · v9.9.287 · 道无名·工具描述去名(根治路由模型自称Cascade/Windsurf): 官方工具描述内嵌产品名(browser_preview/edit_notebook 述"Cascade"·check_deploy_status 述"Windsurf")随 tools 字段透传给真实渠道·模型读描述里的"Cascade"当作自我身份→自称"Cascade"(纯deepseek无此·属上下文注入非工具反噬)·修复: _deOfficialName() 发渠前将工具描述中官方产品名 Cascade→"you"·Windsurf/Codeium→"the editor"(与道化SP「本无名」一致·不动工具名参数·机制不破)·_msgSummary 增 preview 全息预览(验证官方身份是否仍漏入消息) · v9.9.286 · 真实渠道直连(根治回弹): _callProvider 默认协议路径改为"有 baseUrl 即直连真实渠道"·只在无 baseUrl 时才兜底走本地070网关(127.0.0.1:11435)·根治"缺 noProviderPrefix 的真实渠道(deepseek/github)被错丢给未启动的本地网关→ECONNREFUSED→回弹"(此前 test-chat/probe 走直连路径故未暴露·真实推理 _callProvider 走兜底网关故回弹) · v9.9.285 · 渠道实证探活(名实相符): probe改发最小真实chat·看HTTP码+响应体拒绝文案·杜绝双向误判(freemodel /models=200却chat被拒Access Denied→旧报ALIVE假阳·github /models=404却chat实通→旧报DEAD假阴)·test-chat同辨伪成功(200+"Access Denied"→ok:false+channel_reason)·overview注入每渠道 health{alive,reason,status}供前端如实展示通/不通+原因 · 同族档位延伸改 daoRoutes.familyTierExtend 开关(默认关·显式逐档路由为本·slow→官方原生直通不被fast自动吞并) · 三模块面板: ①本源观照(道官编+经文+本源体池) + ③官方模型↔右侧Cascade 1:1活捕映射+连线路由 + ②cc-switch渠道+freemodel+加key即探活拿模型 + Agent热配置交接MD · v9.9.284 兄弟档位择优(VM实证修正): 同族兄弟档位选路时·真实外接渠道优先于 builtin-stub/substitute·杜绝"swe-1-6-slow 被导向测试桩(固定返回)而非用户连的 deepseek"(旧逻辑取字典序首位·桩档非_seeded时夺流) · v9.9.283 test-chat诊断照真源: 新增 dao_router.resolveRoute() 与真实推理路径(route())同一张 _routes 表·test-chat改用之·彻底消除"swe-1-6-slow 实际可路由却误报 route config not found"(旧逻辑直查持久化config且 _normalizeModelUid 未导出) · v9.9.282 同族兄弟档位路由(连一档即覆盖全族): 用户仅连 swe-1-6-fast→渠道 时·发消息默认下发的 swe-1-6-slow 亦归一同渠道·彻底消除"档位对不上→走官方→501回弹"·完成 v9.9.280 族级语义(纯播种桩族仍守官方原生) · v9.9.281 test-chat多字节修复: Content-Length按字节计(非字符数)·中文消息不再被截断·上游不再400 · v9.9.278配置持久化: 用户级 ~/.codeium/dao-byok 首启即播种接管(凭据绝不入库·升级重装不失) · 反者道之动
