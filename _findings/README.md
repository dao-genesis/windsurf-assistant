# `_findings/` · ACP 真据 · 印 92 守门据

> 帛书·二十一:「**其精甚真 · 其中有信**」
> 帛书·七十一:「知不知 · 尚矣」

此目存 **印 92 之 ACP 协议真据** · 由 `tests/_seal92_smoke.cjs` **硬依**。

## 现存 (主公 PR #13 cleanup-2026-05-16 · 析印 81 笔记至 `_archive/test_fix_yin81.md` 后)

```
_findings/
  └── acp/                                印 92 · ACP 真据 fixture
      ├── 04_ACP_protocol_evidence.md     ACP 协议探查记 (Affogato/chisel/JSON-RPC)
      ├── _acp_probe.js                   stdio handshake 探针 (initialize / authMethods)
      ├── devin_acp_handshake.jsonl       真 handshake frames (≥3 帧)
      ├── devin_models.json               30+ 真模型 UID (Claude/GPT/Gemini/SWE 系)
      └── _README.md                      子目内之说明
```

## 守门检 (来自 `tests/_seal92_smoke.cjs`)

```js
const ACP = "_findings/acp";
assert(uids.length >= 30, "Devin 模型 UID 数 ≥30");
assert(hsLines >= 3, "ACP handshake frames ≥3");
assert(probeJs.includes("initialize"), "probe.js 含 ACP handshake");
```

**损此目 → 印 92 守门红** · 慎之。

## 何不入 `tests/fixtures/`?

帛书·二十八:「**朴散则为器**」· 此 ACP 真据自有其位 · 不为器之具体 · 故立 `_findings/` 之家 · 与 fixture 性殊。

---

> 真据自在 · 不可须臾离 · 离即非道也
