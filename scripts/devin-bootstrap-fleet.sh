#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════
# Windsurf Assistant · Devin VM Bootstrap (FLEET MODE) · 道法自然
#   一气化三清 · I · 反代 API · 多账号一 VM 模式
#   取之尽锱铢, 用之如泥沙 —— 帛书《老子》
# ══════════════════════════════════════════════════════════════
#
# Mode: MULTI-ACCOUNT · 1 VM = N units = N accounts = N tunnels.
# For single account: scripts/devin-bootstrap.sh
#
# One-line deploy on any Linux VM (Devin Cloud / VPS / EC2):
#
#   curl -sL https://raw.githubusercontent.com/dao-genesis/windsurf-assistant/main/scripts/devin-bootstrap-fleet.sh | \
#     DAO_ACCOUNTS="a@b.com:sk-ws-01-A,c@d.com:sk-ws-01-B" \
#     DAO_AUTH_KEY="sk-ws-proxy-SHARED" \
#     bash
#
# Environment variables:
#   DAO_ACCOUNTS        (required) Comma-separated  email:apiKey,email:apiKey,...
#                                  OR set DAO_ACCOUNTS_FILE.
#   DAO_ACCOUNTS_FILE   (optional) Path to file with `email apiKey` per line
#                                  (whitespace-separated; '#' lines skipped).
#   DAO_AUTH_KEY        (recommended) Shared reverse-proxy gate key for ALL units.
#                                  Strongly advised when running with --public.
#   DAO_BASE_PORT       (optional) First unit port, default 7862. Successive
#                                  accounts get +1 each (7862, 7863, …).
#   DAO_BIND            (optional) Bind address, default 127.0.0.1.
#                                  Set to 0.0.0.0 when exposing without tunnel.
#   DAO_TUNNEL          (optional) "yes" (default) to spawn one cloudflared
#                                  tunnel per unit; "no" to skip.
#   DAO_REPO            (optional) Git repo URL, default upstream fork.
#   DAO_ALLOW_AUTH      (optional) "1" to enable /auth/* (印 64).  Default off.
#
# ──────────────────────────────────────────────────────────────
# 帛书·五: 「天地之间其犹橐钥与？虚而不淈, 踵而俞出.」
# A single橐钥(VM)可育多账号气, 不相伤.
# ──────────────────────────────────────────────────────────────

set -e

REPO="${DAO_REPO:-https://github.com/dao-genesis/windsurf-assistant.git}"
BASE_PORT="${DAO_BASE_PORT:-7862}"
BIND="${DAO_BIND:-127.0.0.1}"
WORK="$HOME/windsurf-assistant"
RUNTIME="$HOME/.dao/fleet-runtime"
mkdir -p "$RUNTIME"

echo "══════════════════════════════════════════════════════════════"
echo "  Windsurf Assistant · VM Fleet Bootstrap (MULTI-ACCOUNT)"
echo "  一气化三清 · 一 VM 育 N 气 · 取之尽锱铢"
echo "══════════════════════════════════════════════════════════════"
echo ""

# §1 Parse accounts ─────────────────────────────────────────────
ACCOUNTS=()   # array of "email:apiKey"
if [ -n "$DAO_ACCOUNTS_FILE" ]; then
  if [ ! -f "$DAO_ACCOUNTS_FILE" ]; then
    echo "  ERROR: DAO_ACCOUNTS_FILE not found: $DAO_ACCOUNTS_FILE"
    exit 1
  fi
  while IFS= read -r line; do
    # skip blanks + '#' comments
    case "$(echo "$line" | sed 's/^[[:space:]]*//')" in
      ''|'#'*) continue ;;
    esac
    email=$(echo "$line" | awk '{print $1}')
    key=$(echo "$line" | awk '{print $2}')
    if [ -n "$email" ] && [ -n "$key" ]; then
      ACCOUNTS+=("${email}:${key}")
    fi
  done < "$DAO_ACCOUNTS_FILE"
elif [ -n "$DAO_ACCOUNTS" ]; then
  IFS=',' read -ra ACCOUNTS <<< "$DAO_ACCOUNTS"
else
  echo "  ERROR: Set DAO_ACCOUNTS=email:key,email:key,... OR DAO_ACCOUNTS_FILE=/path"
  exit 1
fi

N=${#ACCOUNTS[@]}
if [ "$N" -lt 1 ]; then
  echo "  ERROR: No accounts parsed"
  exit 1
fi
echo "  Accounts parsed: $N"

# §2 Node.js check ───────────────────────────────────────────────
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

# §3 Clone repo ─────────────────────────────────────────────────
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
for f in cloud_engine.js fleet_vm_unit.js; do
  if [ ! -f "$f" ]; then
    echo "  ERROR: $f not found in packages/dao-core/"
    exit 3
  fi
done
echo "  Core files OK"

# §4 cloudflared install (once) ─────────────────────────────────
TUNNEL_ENABLED="${DAO_TUNNEL:-yes}"
if [ "$TUNNEL_ENABLED" = "yes" ]; then
  if ! command -v cloudflared >/dev/null 2>&1; then
    echo "  Installing cloudflared..."
    ARCH=$(uname -m)
    case "$ARCH" in
      x86_64|amd64) CF_ARCH="amd64" ;;
      aarch64|arm64) CF_ARCH="arm64" ;;
      *) CF_ARCH="amd64" ;;
    esac
    curl -sL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-$CF_ARCH" \
      -o /usr/local/bin/cloudflared 2>/dev/null || {
        mkdir -p "$HOME/.local/bin"
        curl -sL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-$CF_ARCH" \
          -o "$HOME/.local/bin/cloudflared"
        export PATH="$HOME/.local/bin:$PATH"
      }
    chmod +x "$(command -v cloudflared || echo /usr/local/bin/cloudflared)" 2>/dev/null || true
  fi
  command -v cloudflared >/dev/null 2>&1 || echo "  WARN: cloudflared install failed; will skip tunnels"
fi

# §5 Track all child PIDs · cleanup trap ────────────────────────
UNIT_PIDS=()
TUNNEL_PIDS=()
cleanup() {
  echo ""
  echo "  Shutting down fleet..."
  for pid in "${UNIT_PIDS[@]}" "${TUNNEL_PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  sleep 1
  for pid in "${UNIT_PIDS[@]}" "${TUNNEL_PIDS[@]}"; do
    kill -9 "$pid" 2>/dev/null || true
  done
  echo "  Fleet down · 反者道之动"
}
trap cleanup EXIT INT TERM

# §6 Spawn N units + N tunnels ──────────────────────────────────
UNIT_INFO=()  # "port|account|tunnel_url"
for i in "${!ACCOUNTS[@]}"; do
  spec="${ACCOUNTS[$i]}"
  email="${spec%%:*}"
  apikey="${spec#*:}"
  port=$((BASE_PORT + i))
  unit_log="$RUNTIME/unit-${port}.log"
  tunnel_log="$RUNTIME/tunnel-${port}.log"

  if [ -z "$email" ] || [ -z "$apikey" ] || [ "$email" = "$apikey" ]; then
    echo "  SKIP idx=$i · malformed entry (expected email:key)"
    continue
  fi

  # build unit args (each unit on its own port, independent state)
  UNIT_ARGS=( --port "$port" --bind "$BIND" --account "$email" --api-key "$apikey" )
  if [ "$BIND" = "0.0.0.0" ]; then
    UNIT_ARGS+=( --public )
  fi
  if [ -n "$DAO_AUTH_KEY" ]; then
    UNIT_ARGS+=( --auth-key "$DAO_AUTH_KEY" )
  fi
  if [ "${DAO_ALLOW_AUTH:-0}" = "1" ]; then
    UNIT_ARGS+=( --allow-auth )
  fi

  echo "  [$((i+1))/$N] Starting unit · :$port · account=$email"
  ( cd "$WORK/packages/dao-core" && node fleet_vm_unit.js "${UNIT_ARGS[@]}" >"$unit_log" 2>&1 ) &
  UNIT_PIDS+=($!)
  sleep 0.4

  tunnel_url=""
  if [ "$TUNNEL_ENABLED" = "yes" ] && command -v cloudflared >/dev/null 2>&1; then
    cloudflared tunnel --url "http://127.0.0.1:$port" --logfile "$tunnel_log" 2>/dev/null &
    TUNNEL_PIDS+=($!)
    # wait briefly for URL
    for wait_i in 1 2 3 4 5 6 7 8 9 10; do
      sleep 1
      if [ -f "$tunnel_log" ]; then
        tunnel_url=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$tunnel_log" 2>/dev/null | head -1 || true)
        if [ -n "$tunnel_url" ]; then break; fi
      fi
    done
  fi

  UNIT_INFO+=("${port}|${email}|${tunnel_url}")
done

# §7 Print final summary ────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════════════════"
echo "  FLEET READY · 一气化三清 · 取之尽锱铢"
echo "══════════════════════════════════════════════════════════════"
echo "  N accounts: $N · base_port=$BASE_PORT · bind=$BIND"
if [ -n "$DAO_AUTH_KEY" ]; then
  echo "  Shared Auth Key: $DAO_AUTH_KEY"
else
  echo "  Shared Auth Key: (NONE · 公网不安全)"
fi
echo ""
echo "  idx | port  | account                    | tunnel URL"
echo "  ----+-------+----------------------------+----------------------------------------------"
idx=1
for entry in "${UNIT_INFO[@]}"; do
  IFS='|' read -r p e u <<< "$entry"
  url_disp="${u:-http://${BIND}:${p}}"
  printf "  %3d | %5s | %-26s | %s\n" "$idx" "$p" "$e" "$url_disp"
  idx=$((idx+1))
done
echo "══════════════════════════════════════════════════════════════"
echo "  OpenAI client per account:"
echo "    base_url = <tunnel URL>/v1"
echo "    api_key  = ${DAO_AUTH_KEY:-<DAO_AUTH_KEY not set>}"
echo "══════════════════════════════════════════════════════════════"
echo ""
echo "  Logs: $RUNTIME/unit-<port>.log · $RUNTIME/tunnel-<port>.log"
echo "  Stop: Ctrl-C (clean shutdown · trap cleanup)"
echo ""
echo "  「天地之间其犹橐钥与? 虚而不淈, 踵而俞出.」"
echo ""

# §8 Block until killed ────────────────────────────────────────
# wait on first child; trap will kill rest on signal
wait
