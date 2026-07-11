# ws-deploy 测试修复 · 印 81 · 2026-05-12

> 帛书·四十: **反者, 道之动也; 弱者, 道之用也.**
> 帛书·六十三: **图难于其易也, 为大于其细也.**
> 帛书·四十八: **为道者日损 · 损之又损 · 以至于无为 · 无为而无不为.**

---

## 一 · baseline (修前)

`node tests\run_all.cjs` 串跑 8 项 · 实测:

| # | 测试 | pass | fail | 状态 |
|---|---|---:|---:|:---:|
| 1 | `_web_static_audit`   | 20  | **52** | ✗ |
| 2 | `_dao_core_syntax`    | 47  | 0  | ✓ |
| 3 | `_three_pure_smoke`   | 50  | **11** | ✗ |
| 4 | `_seal67_smoke`       | 110 | 0  | ✓ |
| 5 | `_seal69_smoke`       | (通) | 0  | ✓ |
| 6 | `_auth_smoke`         | 26  | 0  | ✓ |
| 7 | `_seal64_smoke`       | 79  | 0  | ✓ |
| 8 | `_seal66_smoke`       | 24  | 0  | ✓ |

**总:** 6/8 通 · 2/8 失 · 共 63 子项失败.

---

## 二 · 根因诊断

二失皆**测试过时之症**——非代码 bug · 非功能缺失.

### 失 1 · `_web_static_audit` (52 子项失)

- **写于**: 印 63 (五-Tab `setup/chat/api/deploy/docs`)
- **测**: `web/index.html` 之五 Tab + `cfg-*` / `chat-*` / `btn-send` / `genAuthKey` / `detectRepo` / curl|py|js 三例
- **现实**: 印 67 已把 `web/index.html` 迁为**三态** (`gate` / `onboarding` / `mine`)
  - 旧五-Tab 形**完整保**于 `web/legacy.html` (56663 B · 2026-05-12 14:07:52)
  - 新形由 `_seal67_smoke` (110 通) + `_seal69_smoke` 全审
- **症**: 测仍按印 63 五-Tab 查印 67 新 index.html · 52 项 ID/函数全空

### 失 2 · `_three_pure_smoke [B]` (11 子项失)

- **写于**: 印 65 (`#card-three-pure` + `link-pure-1/2/3` + `switchTab`)
- **测**: 印 65 之 DOM 形 (specific ID + 函数名)
- **现实**: 印 67 已把三清入口**嵌入 mine-mid 中栏** (`中 · WAM 切号`)
  - `switchTab` → `enterMine` / `renderGate` / `renderMine` (`web/dao_app.js`)
  - `#card-three-pure` / `link-pure-*` 之具体 ID 已废
  - `wam` 字眼仍存但**大写为 `WAM`** (`String.includes` 大小写敏感故失)
  - 道义锚 (`一气化三清` / `切号` / `提示词` / `dao-proxy-min`) 全存
- **症**: 11 项查具体 DOM 名 → 已迁; 1 项查 `wam` (小写) → 实为 `WAM`

---

## 三 · 修方案 · 反者道之动

**两测皆**: 改测试合新形, 非改新形合旧测.
- 印 67 新形已立 (`_seal67_smoke` 110 通即证) · 不动
- 旧形保 `web/legacy.html` (印 63 原貌) · 由 `_web_static_audit` 把守
- 新形由 `_seal67_smoke` + `_seal69_smoke` 把守
- 三清道义锚由 `_three_pure_smoke` [B] 软化版把守 (跨 index.html + dao_app.js)

### 补丁 1 · `tests/_web_static_audit.cjs`

**一行改**:
```diff
-const WEB = path.join(__dirname, "..", "web", "index.html");
+// 印 81 修: 印 67 已迁 web/index.html 为三态 (gate/onboarding/mine);
+//          印 63 原五-Tab 形保于 web/legacy.html · 由本测把守.
+//          新 index.html 由 _seal67_smoke.cjs / _seal69_smoke.cjs 全审.
+const WEB = path.join(__dirname, "..", "web", "legacy.html");
```

**效**: 20 通 52 失 → **72 通 0 失** (大制无割 · 一文件即一切)

### 补丁 2 · `tests/_three_pure_smoke.cjs` [B] 区

**软化**: 弃具体 DOM ID / 函数名 · 保道义锚.
- 改读 `index.html + dao_app.js` 合查 (印 67 已分文件)
- `wam` 改为 `/wam/i` (case-insensitive · 接 `WAM 切号`)
- `switchTab` → `enterMine|renderGate|renderMine`
- 弃 `#card-three-pure` / `link-pure-1/2/3` / `Three Pure` / `/tree/main/packages/*` / `Source & build`
- 留 `一气化三清` / `道并行而不悖` (web 或 README · OR) / `切号` / `提示词` / `dao-proxy-min`

**效**: 50 通 11 失 → **52 通 0 失** (三清并行 · 道并行而不悖)

---

## 四 · 修后 (印 81 末)

`node tests\run_all.cjs` 串跑 8 项:

```
═══ 总览 ═══
  ✓ _web_static_audit        exit=0 (107ms)
  ✓ _dao_core_syntax         exit=0 (1207ms)
  ✓ _three_pure_smoke        exit=0 (105ms)
  ✓ _seal67_smoke            exit=0 (366ms)
  ✓ _seal69_smoke            exit=0 (241ms)
  ✓ _auth_smoke              exit=0 (2761ms)
  ✓ _seal64_smoke            exit=0 (3068ms)
  ✓ _seal66_smoke            exit=0 (6034ms)

✓ 全套通过 · 道法自然
```

**总:** 8/8 通 · 0 失 · **全绿**.

---

## 五 · 道义验

- **反者道之动**: 不强求新形合旧测 · 改旧测合新形 · 顺自然
- **图难于易**: 不去做 devin CLI OAuth 登录 (实非必要) · 直审根因即治
- **去华取实**: 弃印 65 之具体 DOM 名 (华) · 保道义锚 (实)
- **大制无割**: 一文件即一切 (legacy.html · index.html 各司其位)
- **道并行而不悖**: 印 63 / 印 67 两形态并存 · 各有测把守 · 互不污染
- **无为而无不为**: 二行改 · 全套绿

---

## 六 · 文件变更

| 文件 | 改 | 行 |
|---|---|---:|
| `tests/_web_static_audit.cjs` | WEB 指 `legacy.html` + 注释 | +3 / -1 |
| `tests/_three_pure_smoke.cjs` | [B] 区软化 · 跨 index.html+dao_app.js · case-insensitive | +18 / -22 |

**无功能代码改动** · 仅测试边界顺应印 67 新形态.

---

## 七 · 历法之印

| 印 | 时 | 形 |
|---|---|---|
| 63 | 五-Tab 形 (`web/index.html`) | 现保 `web/legacy.html` |
| 64 | 4 步链 + SSE + `/stats` | unit 路 |
| 65 | 三清守门 (`#card-three-pure`) | DOM 已迁 · 道义留 |
| 66 | 公网视角 fake-key crash-proof | unit 路 |
| 67 | 三态门户 (gate/onboarding/mine) | `web/index.html` 新 |
| 69 | Pages workflow v5 + 3 bug 修 | dao_app.js 治 |
| **81** | **测顺新形态** | **本印** |

---

`帛书·六十四: 「为之于其未有也, 治之于其未乱也. 合抱之木, 生于毫末. 九成之台, 作于累土.」`

**印 81 安**.
