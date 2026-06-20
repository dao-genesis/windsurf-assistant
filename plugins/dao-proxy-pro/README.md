# dao-proxy-pro · 提示词隔离 + 外接路由

> 底层提示词隔离替换 + 外接第三方模型路由。活动栏三面板：**①本源观照 ②渠道配置 ③模型路由**。

- **扩展 id**：`dao-agi.dao-proxy-pro`
- **类型**：核心 · 反代/路由引擎

## 三面板

1. **本源观照**：帛书 System Prompt 注入字数、模式/路由切换状态。
2. **渠道配置**：第三方模型渠道（base URL / key / 模型）管理。
3. **模型路由**：数据源 `http://127.0.0.1:8937/origin/ea/overview`（家族归一 + builtin-stub 测试通道置首）。

> 作为 `dao-one` 大 one 的子模块嵌入时，三面板经父帧 VS Code 主题变量注入修复，文字浅色可读可操作（非黑字）。

## 构建

```bash
node tools/pack-vsix.js core/dao-proxy-pro     # 纯 JS，免转译
```

## 安装

```bash
devin-desktop --install-extension dao-proxy-pro-<ver>.vsix --force   # 或 code --install-extension ...
```

下载见仓库 [Releases](https://github.com/zhouyoukang1234-spec/devin-remote/releases)（tag 形如 `dao-proxy-pro-v<版本>`）。

> 去中心化：本模块独立发版，开发它才会刷新 `dao-proxy-pro-v*` Release，与其它插件互不干扰。
