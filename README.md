# Windsurf Assistant

两个 VS Code / Windsurf 插件。安装包见 [Releases](https://github.com/zhouyoukang1234-spec/windsurf-assistant/releases)。

| 插件 | 作用 | 最新版 | 下载 |
| --- | --- | --- | --- |
| **rt-flow**（WAM 切号插件） | 多账号管理与一键切换：添加账号 / 注入 token / 健康检查 / panic 切换 | `3.16.0` | [rt-flow-3.16.0.vsix](https://github.com/zhouyoukang1234-spec/windsurf-assistant/releases/download/v3.16.0/rt-flow-3.16.0.vsix) |
| **dao-proxy-min**（反代替换提示词插件） | 反向代理 Windsurf / Devin，origin 反转与系统提示词替换、预览与自检 | `9.9.64` | [dao-proxy-min-9.9.64.vsix](https://github.com/zhouyoukang1234-spec/windsurf-assistant/releases/download/v9.9.64/dao-proxy-min-9.9.64.vsix) |

## 仓库结构

```
plugins/
  rt-flow/          # 切号插件源码 (publisher: devaid)
  dao-proxy-min/    # 反代替换提示词插件源码 (publisher: dao-agi)
                    #   vendor/bundled-origin/ 为内置提示词本源文本
scripts/
  build-vsix.mjs    # 一键把两个插件打包为 .vsix
```

## 安装

VS Code / Windsurf 中 `Extensions: Install from VSIX...`，选择对应 `.vsix`。

## 从源码构建

需 Node ≥ 18。

```bash
node scripts/build-vsix.mjs          # 打包全部插件到 dist/
node scripts/build-vsix.mjs rt-flow  # 只打包指定插件
```

脚本通过 `npx @vscode/vsce package` 在各插件目录生成 `.vsix`。

## 插件命令速览

- **rt-flow**：`wam.openEditor` `wam.switchAccount` `wam.panicSwitch` `wam.addAccount` `wam.injectToken` `wam.verifyAll` `wam.healthCheck` …
- **dao-proxy-min**：`wam.originInvert` `wam.originPassthrough` `dao.toggleMode` `dao.openPreview` `wam.verifyEndToEnd` `wam.selftest` …

## 许可

各插件许可见其目录内 `LICENSE.txt`（rt-flow: MIT，dao-proxy-min: Apache-2.0）；仓库整体见根 [`LICENSE`](LICENSE)。
