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

## 卸载归零（彻底复原官方直连）

卸载本扩展后须**完全还到官方直连零态**，不留任何残留。两条路径：

1. **从 IDE 卸载（推荐）**：在扩展面板点卸载即可。`deactivate` 会**侦测到真卸载**（读 `<extensions-root>/.obsolete`），
   越过为「重载」防写风暴而设的 30s 智能保锚门限，**无条件清锚 + 系统级残留归零**：
   - 跨所有 IDE `settings.json` 清 `codeium.apiServerUrl` / `codeium.inferenceApiServerUrl` /
     `codeiumDev.externalLanguageServerAddress` / `externalLanguageServerLspPort`（写前自动 `.bak`）；
   - 还原 `~/.codeium/_dao_ls_port.txt`（被 dao 覆盖前的官方原值）、删 `~/.codeium/dao-certs/`；
   - 解信任区自签 MITM 证书、清 `CODEIUM_LANGUAGE_SERVER_BIN` / `VSCODE_DEV` 持久化环变。
2. **命令面板**：`道gent Pro: 复官直 (卸善/解 · 卡自)`（`dao.restoreOfficial`）——即便已卡死也能一键自救，
   等价于上述归零 + 停本地代理。

> 卸载后请 **Reload Window / 重启 IDE**，官方语言服务器即自连。保留不动：`~/.codeium/dao-byok`（你的 key）、
> `~/.codeium/dao`（Cascade 记忆/上下文）。

### 扩展已被 force-remove（`deactivate` 没跑）时的独立自救

若扩展目录已被直接删除、`deactivate` 来不及执行，用随扩展打包的独立脚本（**不依赖扩展存活**）一键归零：

```powershell
# Windows · 先预演看将清什么, 再实际归零
powershell -ExecutionPolicy Bypass -File scripts/dao-reset.ps1 -DryRun
powershell -ExecutionPolicy Bypass -File scripts/dao-reset.ps1
```

```bash
# macOS / Linux
bash scripts/dao-reset.sh --dry   # 预演
bash scripts/dao-reset.sh         # 实际归零
```

下载见仓库 [Releases](https://github.com/zhouyoukang1234-spec/devin-remote/releases)（tag 形如 `dao-proxy-pro-v<版本>`）。

> 去中心化：本模块独立发版，开发它才会刷新 `dao-proxy-pro-v*` Release，与其它插件互不干扰。
