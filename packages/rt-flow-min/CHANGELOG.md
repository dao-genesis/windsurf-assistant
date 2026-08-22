# CHANGELOG · RT Flow Min

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
