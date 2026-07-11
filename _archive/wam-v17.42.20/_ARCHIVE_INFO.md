# 归档 · WAM v17.42.20 (满载)

> 大丈夫居其厚而不居其泊, 居其实而不居其华. 故去彼取此. —— 帛书《老子》德经

## 归档时点

- **2026-05-04** · 接续 v9.1.2-dao 后, 切号本体演化至 **v2.5.5 道极减法版**
- v17.42.20 (满载) **退役归档** · 完整定锚于此 · 历史可恢复

## 何以归档

| 维度 | v17.42.20 满载 (此处归档) | v2.5.5 道极版 (`packages/wam/`) |
|---|---|---|
| **体积** | 437 KB · 10913 行 | 168 KB · 4265 行 (-62%) |
| **触发** | Layer 1-5 网络钩 (cross-process 难) | Layer 6 file watcher on `state.vscdb` (跨进程稳) |
| **禁号** | 失败累计封禁 | **不禁号** · 失败转评分降权 |
| **代币池** | 多账号代币管理 | 删 (单文件本地 state) |
| **TurnTracker** | 一对话一 turn | 删 (Layer 6 watch 替代) |
| **AutoUpdate** | `_DEFAULT_PUBLIC_SOURCE` 远端更新 | 删 (用户自部署) |
| **测试** | 387 E2E 断言 | 236 回归 + ideVersion 根因测 |

**核心函数零重叠** · 此非 fork · 是**同名异体**两线代码:

- v17.42.20 有: `TurnTracker / _getAutoUpdateSource / _DEFAULT_PUBLIC_SOURCE`
- v2.5.5 有: `Layer 6 / tryFetchPlanStatus / _buildExpTag / _isTrialLike / _cleanseHealthOnLoad`

## 归档清单

```
_archive/wam-v17.42.20/
├── _ARCHIVE_INFO.md          (本文件 · 归档说明)
├── README.md                 (v17.42.18 原 README · 帛书甲本)
├── README.md.王弼版.bak        (王弼通行本备份)
├── CHANGELOG.md              (72 KB · v17 完整演化史 · 帛书甲本)
├── CHANGELOG.md.王弼版.bak     (王弼通行本备份)
├── extension.js              (437 KB · 10913 行 · 满载本体)
├── package.json              (v17.42.20 manifest)
├── _wam_e2e.js               (78 KB · 387 E2E 断言)
├── _migrate_to_new_name.ps1  (路径迁移脚本)
├── _update_version.ps1       (版本升脚本)
└── media/icon.png + icon.svg (图标)
```

## 历史定锚

- **git tag** `v17.42.20` · `v17.42.19` · `v17.42.18` · `v17.42.13` 永久定锚 commit
- **VSIX 发布**: GitHub Releases v17.42.x 系列存档

## 恢复方式

需用回 v17.42.20 · 任选其一:

```bash
# 方式 1: git checkout tag
git checkout v17.42.20 -- packages/wam/

# 方式 2: 从归档复制
cp _archive/wam-v17.42.20/*.* packages/wam/
cp -r _archive/wam-v17.42.20/media packages/wam/

# 方式 3: 下载 GitHub Release VSIX
gh release download v17.42.20
```

## 道之演化

> **反者道之动 · 弱者道之用 · 天下之物生于有 · 有生于无.** —— 帛书《老子》德经

满载者 (v17.42) 历经 **6 周精雕** · 5 层网络钩 · 387 E2E · 多组件互保. 然 cross-process isolation 终为不解之结.

道极者 (v2.5) **大减法** · Layer 6 文件 watch · 单点触发 · -62% 体积 · 0 cross-process 烦恼.

二者各臻其极 · 不相代而相成. **去彼取此** · 当下用极简 · 历史尊厚重.

---

*归档 by 周友康 · 2026-05-04 · 帛书甲本『马王堆汉墓出土』归源*
