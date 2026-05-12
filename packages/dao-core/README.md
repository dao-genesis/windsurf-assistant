# dao-core

> 天下之至柔，驰骋于天下之致坚；无有入于无间。

**Zero-dependency** Windsurf cloud reverse proxy core. Directly communicates with Windsurf Cloud via Connect-RPC over HTTPS, exposes an OpenAI-compatible API.

## Quick Start

```bash
# Local dev (no auth)
node fleet_vm_unit.js --api-key sk-ws-01-YOUR_KEY --port 7862 --public

# Public deployment (REQUIRED: --auth-key)
node fleet_vm_unit.js \
  --api-key sk-ws-01-YOUR_KEY \
  --auth-key sk-ws-proxy-RANDOM_LONG_SECRET \
  --port 7862 --public

# Test (gated endpoints need Authorization)
curl http://localhost:7862/health
curl -H 'Authorization: Bearer sk-ws-proxy-RANDOM_LONG_SECRET' \
     http://localhost:7862/v1/models
curl http://localhost:7862/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer sk-ws-proxy-RANDOM_LONG_SECRET' \
  -d '{"model":"claude-sonnet-4-20250514","messages":[{"role":"user","content":"hello"}]}'
```

## One-Line VM Deploy

```bash
curl -sL https://raw.githubusercontent.com/zhouyoukang/windsurf-assistant/main/scripts/devin-bootstrap.sh | \
  DAO_API_KEY="sk-ws-01-..." \
  DAO_AUTH_KEY="sk-ws-proxy-..." \
  DAO_TUNNEL=yes \
  bash
```

## Files

| File | Purpose |
|------|---------|
| `cloud_engine.js` | Zero-dep Connect-RPC protocol · protobuf · auth · inference |
| `fleet_vm_unit.js` | Self-contained proxy microservice · OpenAI SSE · fleet integration |
| `fleet_controller.js` | Fleet management · registration · heartbeat · gateway with retry/failover |
| `dao_accounts.js` | Account pool management |
| `model_registry.js` | Model catalog and resolution |

## API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/v1/chat/completions` | POST | gated | OpenAI-compatible chat (SSE streaming + JSON) |
| `/v1/models` | GET | gated | Model list (54+ models) |
| `/quota` | GET | gated | Real-time quota (daily%/weekly%) |
| `/health` | GET | public | Health + `authRequired` + stats |
| `/fleet/info` | GET | public | Unit metadata |

When `--auth-key` (or `DAO_AUTH_KEY`) is set, **gated** endpoints require `Authorization: Bearer <key>`. `/health` & `/fleet/info` always stay public so probes / load-balancers can monitor without secrets. When auth-key is empty, the unit runs in *open mode* (local dev only).

## Environment Variables / CLI flags

| Variable | CLI flag | Description | Default |
|----------|----------|-------------|---------|
| `DAO_FLEET_API_KEY` | `--api-key` | Windsurf API key (sk-ws-01-...) | (required) |
| `DAO_AUTH_KEY` | `--auth-key` | Reverse-proxy gate key(s) (sk-ws-proxy-... · comma-separated for multiple) | (empty = open) |
| `DAO_FLEET_ACCOUNT` | `--account` | Account email identifier | `unit@fleet.local` |
| `DAO_FLEET_PORT` | `--port` | Listen port | `7862` |
| -- | `--bind` / `--public` | Listen address (`--public` = `0.0.0.0`) | `127.0.0.1` |
| `DAO_FLEET_CONTROLLER` | `--fleet-controller` | Fleet controller URL | (standalone) |
| `DAO_FLEET_SECRET` | `--fleet-secret` | Fleet registration secret | (none) |
| `TUNNEL_URL` | -- | Cloudflare tunnel URL hint | (auto-detect from /tmp/tunnel.log) |

## Architecture

```
Browser/Client
  └─→ fleet_vm_unit.js [:7862]
      ├─ /v1/chat/completions → cloud_engine.chatStream()
      │   → Connect-RPC (protobuf) → Windsurf Cloud
      │     ├─ inference.codeium.com
      │     ├─ server.self-serve.windsurf.com
      │     └─ server.codeium.com
      ├─ /health → self-check
      └─ → fleet_controller (register + heartbeat)
```

## Zero Dependencies

This entire package uses **only Node.js built-in modules**: `http`, `https`, `crypto`, `fs`, `path`, `os`, `dns`. No npm install needed.

---

*道法自然 · 无为而无不为*
