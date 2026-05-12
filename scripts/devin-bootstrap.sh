#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════
# Windsurf Assistant · Devin VM Bootstrap · 道法自然
#   一气化三清 · I · 反代 API (本 脚本部 dao-core 本清)
#   II · 切号 WAM           → IDE 扩展 packages/wam/
#   III · 提示词反代 dao-proxy-min → IDE 扩展 packages/dao-proxy-min/
# ══════════════════════════════════════════════════════════════
#
# Mode: SINGLE-ACCOUNT · 1 VM = 1 unit = 1 account = 1 tunnel.
# For MULTI-ACCOUNT on a single VM (取之尽锱铢) see:
#   scripts/devin-bootstrap-fleet.sh   (N accounts, N ports, N tunnels)
#
# One-line deploy on any Linux VM (Devin Cloud / VPS / EC2):
#
#   curl -sL https://raw.githubusercontent.com/zhouyoukang/windsurf-assistant/main/scripts/devin-bootstrap.sh | \
#     DAO_API_KEY="sk-ws-01-..." DAO_PORT=7862 bash
#
# Environment variables:
#   DAO_API_KEY       (required) Windsurf API key (sk-ws-01-...)
#   DAO_ACCOUNT       (optional) Account email, default: auto@fleet.local
#   DAO_PORT          (optional) Listen port, default: 7862
#   DAO_AUTH_KEY      (optional) Reverse-proxy gate key (sk-ws-proxy-...).
#                                If empty, all /v1/* are public (local only).
#                                For public tunnel, MUST be set.
#   DAO_CONTROLLER    (optional) Fleet controller URL
#   DAO_FLEET_SECRET  (optional) Fleet secret
#   DAO_TUNNEL        (optional) "yes" to auto-start cloudflared tunnel
#   DAO_REPO          (optional) Git repo URL, default upstream zhouyoukang fork
#
set -e

REPO="${DAO_REPO:-https://github.com/zhouyoukang/windsurf-assistant.git}"
PORT="${DAO_PORT:-7862}"
ACCOUNT="${DAO_ACCOUNT:-auto@fleet.local}"
WORK="$HOME/windsurf-assistant"

echo "══════════════════════════════════════════════════════════════"
echo "  Windsurf Assistant · VM Bootstrap"
echo "  道法自然 · 无为而无不为"
echo "══════════════════════════════════════════════════════════════"
echo ""

# §1 Validate
if [ -z "$DAO_API_KEY" ]; then
  echo "  ERROR: DAO_API_KEY is required"
  echo "  Usage: DAO_API_KEY='sk-ws-01-...' bash $0"
  exit 1
fi

# §2 Node.js check
if ! command -v node >/dev/null 2>&1; then
  echo "  Installing Node.js..."
  if command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update -qq && sudo apt-get install -y -qq nodejs npm 2>/dev/null || {
      curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
      sudo apt-get install -y nodejs
    }
  elif command -v yum >/dev/null 2>&1; then
    curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
    sudo yum install -y nodejs
  elif command -v apk >/dev/null 2>&1; then
    apk add --no-cache nodejs npm
  else
    echo "  ERROR: Cannot install Node.js automatically. Please install Node.js >= 18."
    exit 2
  fi
fi
echo "  Node.js: $(node --version)"

# §3 Clone repo
if [ -d "$WORK/.git" ]; then
  echo "  Updating repo..."
  cd "$WORK" && git pull --ff-only 2>/dev/null || true
else
  echo "  Cloning repo..."
  git clone --depth 1 "$REPO" "$WORK" 2>/dev/null || {
    echo "  WARN: git clone failed, trying without depth..."
    rm -rf "$WORK"
    git clone "$REPO" "$WORK"
  }
fi
cd "$WORK/packages/dao-core"

# §4 Verify core files
for f in cloud_engine.js fleet_vm_unit.js; do
  if [ ! -f "$f" ]; then
    echo "  ERROR: $f not found in packages/dao-core/"
    exit 3
  fi
done
echo "  Core files OK"

# §5 Setup accounts.json
mkdir -p ~/.dao
cat > ~/.dao/accounts.json << ACCOUNTS
{
  "version": 2,
  "accounts": [{
    "email": "$ACCOUNT",
    "apiKey": "$DAO_API_KEY",
    "type": "api-key",
    "added": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "lastUsed": null,
    "useCount": 0,
    "apiServerUrl": "https://server.self-serve.windsurf.com",
    "refreshToken": null,
    "frozen": false
  }],
  "active": "$ACCOUNT",
  "rotateMode": "manual"
}
ACCOUNTS
echo "  accounts.json written"

# §6 Cloudflared tunnel (optional)
TUNNEL_URL=""
if [ "${DAO_TUNNEL:-yes}" = "yes" ]; then
  if ! command -v cloudflared >/dev/null 2>&1; then
    echo "  Installing cloudflared..."
    ARCH=$(uname -m)
    case "$ARCH" in
      x86_64|amd64) CF_ARCH="amd64" ;;
      aarch64|arm64) CF_ARCH="arm64" ;;
      *) CF_ARCH="amd64" ;;
    esac
    curl -sL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-$CF_ARCH" \
      -o /usr/local/bin/cloudflared 2>/dev/null || \
    curl -sL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-$CF_ARCH" \
      -o "$HOME/.local/bin/cloudflared" && export PATH="$HOME/.local/bin:$PATH"
    chmod +x "$(command -v cloudflared || echo /usr/local/bin/cloudflared)" 2>/dev/null || true
  fi

  if command -v cloudflared >/dev/null 2>&1; then
    echo "  Starting cloudflared tunnel..."
    cloudflared tunnel --url "http://localhost:$PORT" --logfile /tmp/tunnel.log 2>/dev/null &
    TUNNEL_PID=$!
    sleep 4
    TUNNEL_URL=$(grep -oP 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/tunnel.log 2>/dev/null | head -1 || true)
    if [ -n "$TUNNEL_URL" ]; then
      echo "  Tunnel: $TUNNEL_URL"
      export TUNNEL_URL
    else
      echo "  WARN: Tunnel URL not detected yet (may appear later)"
    fi
  else
    echo "  WARN: cloudflared not available, skipping tunnel"
  fi
fi

# §7 Print final summary BEFORE exec'ing into the unit
#    (so Devin / user can capture the tunnel URL + auth key from logs)
echo ""
echo "══════════════════════════════════════════════════════════════"
echo "  REVERSE-PROXY READY · 反者道之动"
echo "══════════════════════════════════════════════════════════════"
echo "  Public URL : ${TUNNEL_URL:-http://$(hostname -I 2>/dev/null | awk '{print $1}'):$PORT}"
echo "  Local URL  : http://localhost:$PORT"
if [ -n "$DAO_AUTH_KEY" ]; then
  echo "  Auth Key   : $DAO_AUTH_KEY"
  echo "  OpenAI cli : base_url=${TUNNEL_URL:-http://localhost:$PORT}/v1  api_key=$DAO_AUTH_KEY"
else
  echo "  Auth Key   : (none · 公网不安全 · 请设 DAO_AUTH_KEY)"
fi
echo "══════════════════════════════════════════════════════════════"
echo "  一气化三清 · 本 VM 起 [I · 反代 API]; IDE 另装 [II · 切号 WAM] / [III · 提示词反代 dao-proxy-min] 可独行可并行"
echo "  Multi-account?  See: scripts/devin-bootstrap-fleet.sh (一 VM N 账号)"
echo "══════════════════════════════════════════════════════════════"
echo ""

# §8 Build args & launch
UNIT_ARGS="--port $PORT --public --account $ACCOUNT"
if [ -n "$DAO_CONTROLLER" ]; then
  UNIT_ARGS="$UNIT_ARGS --fleet-controller $DAO_CONTROLLER"
fi
if [ -n "$DAO_FLEET_SECRET" ]; then
  UNIT_ARGS="$UNIT_ARGS --fleet-secret $DAO_FLEET_SECRET"
fi
if [ -n "$DAO_AUTH_KEY" ]; then
  UNIT_ARGS="$UNIT_ARGS --auth-key $DAO_AUTH_KEY"
fi

echo "  Starting fleet_vm_unit on :$PORT ..."
echo ""
exec node fleet_vm_unit.js $UNIT_ARGS
