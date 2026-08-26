# CHANGELOG · RT Flow Min

## v3.16.2-hotfix (2026-08-26)

三患根治 + 网络代理补丁 · 全链路验证版

### 三患根治

- **输入框冻结根治**：添加账号面板展开时跳过全量 HTML 重建（保住 textarea 焦点/光标）· 面板关闭后立即补刷 · addBatch 后强制刷新
- **全锁越权切号根治**：硬耗尽看门狗检测全部账号锁定即退避（不触发 _tick）· 无可用账号通知 60s 冷却 · 全锁时仅记日志不弹窗
- **对话追踪丢失根治**：.pb 文件消失 60s 宽限期（_pbMissingSince 时间戳）· 防流式输出时文件临时锁定导致状态被删 · 卡死对话 10 分钟内保持可见

### weekly% 误判根治（三患共同根因）

- Pro/Max/Teams 配额制账号 API 恒不返回 weeklyQuotaRemainingPercent（不追踪周）
- 旧逻辑 omit→0 → 假硬耗尽 → 切号风暴 + 假提示 + 干旱横幅
- 修复：配额制 omit → 镜像 daily（唯一真实信号）；Free/Trial 保持 omit=0 语义
- 删除「全部账号额度已耗尽」假提示 + 「Weekly 干旱」横幅
- drought 判定保守化：checkedCount >= 2 才触发

### 网络代理补丁（直连优先 · 代理兜底）

- 直连（keep-alive 池）→ 瞬断换新 socket + IPv4 重试 → 探测本机代理端口（7890/10809/7891/1080 等）→ CONNECT 隧道兜底
- 任一路成功即记忆偏好（直连恢复自动回归）· 三态自愈
- 有界复用池 _httpsAgent（防无限 socket 打满 conntrack）
- 修复补丁版缺失 `require("node:tls")` 的运行时崩溃 bug

## v3.16.2 (2026-08-22)

首版 · 承 `devaid.rt-flow` v3.16.2 大部分功能 · 专一化发布

### 承 (大部分功能)

- 多账号轮转：自动切号 / 额度验证 / 硬耗尽看门狗 / 预测切号 / 临期优先
- 对话追踪：卡住检测 / 陈旧 streaming 剔除 / 等待用户识别 / 单实例引擎守护
- 标题实时：vscdb 直读 / sessioninfo 扫描兜底 (v3.16.1 根治) / 备份缓存
- 全量备份：对话全量+增量 / 解密导出 Markdown / 索引
- 通知：卡住/陈旧/等待用户 / 任务栏闪烁 / Toast / 自适应全屏勿扰
- 面板：Manager webview / 账号/对话/状态一览

### 专一化

- 双环境适配：Windsurf + Devin Desktop (helper 自动探测)
- 软编码：数据目录 os.homedir() / 扩展 ID 一处定义 / Python 七层探测
- 局部运行：不依赖外部服务 · 纯本地
- 打包脚本：_pack_vsix.ps1 / _verify_vsix.ps1

### 损 (相对 3.16.2 全量)

- 无多实例一键启动脚本 (windsurf-multi.ps1 移出 · 配置项保留)
- 无历史 .bak 备份文件 (仓库干净)
- 文档精简为专一版定位
