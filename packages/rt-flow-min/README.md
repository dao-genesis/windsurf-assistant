# RT Flow Min

## v3.16.2 · 道法自然 · 专一版

RT Flow 之专一版 · 双环境适配 (Windsurf + Devin Desktop) · 多账号轮转 / 对话追踪 / 标题实时 / 全量备份 / 卡住通知

## 安装

```bash
# 从 VSIX 安装
code --install-extension devaid.rt-flow-min-3.16.2.vsix
```

## 功能

- 多账号轮转：自动切号 / 额度验证 / 硬耗尽看门狗 / 预测切号 / 临期优先
- 对话追踪：卡住检测 / 陈旧 streaming 剔除 / 等待用户识别 / 单实例引擎守护
- 标题实时：vscdb 直读 / sessioninfo 扫描兜底 / 备份缓存
- 全量备份：对话全量+增量 / 解密导出 Markdown / 索引
- 通知：卡住/陈旧/等待用户 / 任务栏闪烁 / Toast
- 面板：Manager webview / 账号/对话/状态一览

## 三患根治 (v3.16.2-hotfix 2026-08-26)

1. **输入框冻结**：添加账号面板展开时跳过全量 HTML 重建
2. **全锁越权切号**：看门狗全锁退避 + 通知 60s 冷却
3. **对话追踪丢失**：.pb 消失 60s 宽限期
4. **weekly% 误判**：Pro/Max/Teams 配额制 omit → 镜像 daily
5. **网络代理**：直连优先 → 代理兜底（三态自愈）

## 数据目录

- `~/.wam/` — 状态/健康/锁/日志
- `~/.wam/conversation_backups/` — 对话备份

## 配置

见 package.json `contributes.configuration` · 全部软编码可调
