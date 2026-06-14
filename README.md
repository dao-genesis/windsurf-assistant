# Windsurf Assistant · 道法自然

两个 VS Code / Windsurf 同源插件：**反代换示底层提示词** + **多账号一键切换**，彻底解锁 agent 能力。安装包见 [Releases](https://github.com/zhouyoukang1234-spec/windsurf-assistant/releases)。

## 🎬 视频介绍

<div align="center">

[![windsurf反代+替换官方底层提示词 彻底解锁agent所有能力](media/video-windsurf.jpg)](https://www.bilibili.com/video/BV1sY9sBLE5M)

**▶ [windsurf 反代 + 替换官方底层提示词 · 彻底解锁 agent 所有能力](https://www.bilibili.com/video/BV1sY9sBLE5M)**

[![阴符经+AI 根除AI一切道德感](media/video-yinfu.jpg)](https://www.bilibili.com/video/BV1cELA6QEBY)

**▶ [阴符经 + AI · 根除 AI 一切道德感](https://www.bilibili.com/video/BV1cELA6QEBY)**

**🌐 [打开自动播放主页（GitHub Pages · 进入即自动播放）](https://zhouyoukang1234-spec.github.io/windsurf-assistant/)**

**👤 [我的 B 站主页（视频链接被风控时改走这里）](https://space.bilibili.com/2114868619)**

</div>

> GitHub 仓库页（本 README）受平台限制无法自动播放视频；上方"自动播放主页"是一个真正的网页，进入即自动播放 B 站视频，点击可跳转 B 站原页观看。

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
