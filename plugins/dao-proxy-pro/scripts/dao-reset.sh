#!/usr/bin/env bash
# dao-proxy-pro · 卸载善后 · 系统级残留归零 (macOS / Linux · 不依赖扩展存活)
#   即便扩展已被 force-remove(deactivate 没跑), 本脚本也能把机器还到「官方直连」零态:
#     ① 跨所有 IDE settings.json 清除 dao 锚点/LS 外置重定向键 (写前 .bak 备份)
#     ② 还原/删除 ~/.codeium/_dao_ls_port.txt (被 dao 覆盖前的官方原值)
#     ③ 删除 ~/.codeium/dao-certs/
#     ④ 解信任区自签 MITM 证书 (login keychain · macOS)
#     ⑤ 删除 ~/.codeium/_dao_csrf_token.txt
#     ⑥ 还原 IDE 内置 windsurf 扩展被就地打补丁的死端口 (dist/extension.js · api/inference → 官方云端)
#   保留不动: ~/.codeium/dao-byok (主公 key) · ~/.codeium/dao (Cascade 记忆).
#   归零后请 Reload Window / 重启 IDE, 官方语言服务器将自连.
# 用法:  bash dao-reset.sh          实际归零
#        bash dao-reset.sh --dry    只报告不改动
#   额外: DAO_IDE_ROOT=/path/to/ide bash dao-reset.sh   (IDE 未装在常见位置时显式指定含 resources/app 的根)
set -u
DRY=0
[ "${1:-}" = "--dry" ] && DRY=1
CHANGED=0
ok()   { CHANGED=$((CHANGED+1)); if [ "$DRY" = "1" ]; then echo "  [DRY] $1"; else echo "  [OK ] $1"; fi; }
step() { echo "  - $1"; }

echo "dao-proxy-pro · 卸载归零 ($(uname -s))$([ "$DRY" = 1 ] && echo ' · DRY-RUN')"

KEYS=(
  "codeium.apiServerUrl"
  "codeium.inferenceApiServerUrl"
  "codeiumDev.externalLanguageServerAddress"
  "codeiumDev.externalLanguageServerLspPort"
  "dao.origin._backup_apiServerUrl"
  "dao.origin._backup_inferenceApiServerUrl"
)

case "$(uname -s)" in
  Darwin) CFG="$HOME/Library/Application Support" ;;
  *)      CFG="${XDG_CONFIG_HOME:-$HOME/.config}" ;;
esac

echo "[1/6] settings.json 锚点/LS 重定向清除"
for ide in devin Windsurf Code VSCodium; do
  SP="$CFG/$ide/User/settings.json"
  [ -f "$SP" ] || continue
  TMP="$(mktemp)"
  cp "$SP" "$TMP"
  for k in "${KEYS[@]}"; do
    ke="$(printf '%s' "$k" | sed 's/[.[\*^$]/\\&/g')"
    # 删除整行  "key": <string|number|bool>  (可带行尾逗号)
    sed -i.sedbak -E "/^[[:space:]]*\"$ke\"[[:space:]]*:[[:space:]]*(\"[^\"]*\"|[0-9]+|true|false)[[:space:]]*,?[[:space:]]*$/d" "$TMP" 2>/dev/null
    rm -f "$TMP.sedbak"
  done
  # 修悬空逗号  ...,\n}
  perl -0777 -pe 's/,(\s*[}\]])/$1/g' "$TMP" > "$TMP.2" 2>/dev/null && mv "$TMP.2" "$TMP"
  if ! cmp -s "$SP" "$TMP"; then
    if [ "$DRY" = "0" ]; then
      BAK="$(dirname "$SP")/.dao-settings-backups"
      mkdir -p "$BAK"
      cp "$SP" "$BAK/settings.json.$(date +%Y-%m-%dT%H-%M-%S).bak"
      cp "$TMP" "$SP"
    fi
    ok "清键 → $SP"
  else
    step "无残键 → $SP"
  fi
  rm -f "$TMP"
done

CODEIUM="$HOME/.codeium"

echo "[2/6] _dao_ls_port.txt 还原/删除"
PORT="$CODEIUM/_dao_ls_port.txt"; BAKF="$PORT.dao_backup"
if [ -f "$BAKF" ]; then
  V="$(cat "$BAKF")"
  if [ "$DRY" = "0" ]; then printf '%s' "$V" > "$PORT"; rm -f "$BAKF"; fi
  ok "还原 _dao_ls_port.txt → $V (删 .dao_backup)"
elif [ -f "$PORT" ]; then
  [ "$DRY" = "0" ] && rm -f "$PORT"
  ok "删除 _dao_ls_port.txt (无 backup)"
else
  step "_dao_ls_port.txt 不存在"
fi

echo "[3/6] dao-certs/ 目录删除"
if [ -d "$CODEIUM/dao-certs" ]; then
  [ "$DRY" = "0" ] && rm -rf "$CODEIUM/dao-certs"
  ok "删除 $CODEIUM/dao-certs"
else
  step "dao-certs/ 不存在"
fi

echo "[4/6] 信任区自签 MITM 证书解信任 (macOS login keychain)"
if [ "$(uname -s)" = "Darwin" ]; then
  KC="$HOME/Library/Keychains/login.keychain-db"
  for n in server.codeium.com inference.codeium.com; do
    if security find-certificate -c "$n" "$KC" >/dev/null 2>&1; then
      [ "$DRY" = "0" ] && security delete-certificate -c "$n" "$KC" >/dev/null 2>&1
      ok "解信任 $n"
    else
      step "无 $n 证书"
    fi
  done
else
  step "Linux · dao 证书多由扩展自管 · 跳过系统信任"
fi

echo "[5/6] _dao_csrf_token.txt 删除"
if [ -f "$CODEIUM/_dao_csrf_token.txt" ]; then
  [ "$DRY" = "0" ] && rm -f "$CODEIUM/_dao_csrf_token.txt"
  ok "删除 _dao_csrf_token.txt"
else
  step "_dao_csrf_token.txt 不存在"
fi

echo "[6/6] IDE 内置 windsurf 扩展补丁还原 (dist/extension.js · api/inference → 官方云端)"
# 本源: dao 把死本地端口硬编码进 IDE 自带的 dist/extension.js · 卸载扩展不碰此文件 → 重启后仍连死端口
SIG='restart\(A\)\{A="http://127\.0\.0\.1:[0-9]+"|getApiServerUrlFromContext=A=>\{return"http://127\.0\.0\.1:[0-9]+"\}|const i="http://127\.0\.0\.1:[0-9]+"'
revert_bundle() {
  local f="$1"
  [ -f "$f" ] || return
  if grep -Eq "$SIG" "$f" 2>/dev/null; then
    if [ "$DRY" = "0" ]; then
      [ -f "$f.dao_patched_backup" ] || cp "$f" "$f.dao_patched_backup"
      perl -0777 -i -pe 's/restart\(A\)\{A="http:\/\/127\.0\.0\.1:\d+",this\.apiServerUrl=A/restart(A){this.apiServerUrl=A/g; s/getApiServerUrlFromContext=A=>\{return"http:\/\/127\.0\.0\.1:\d+"\}/getApiServerUrlFromContext=A=>{return"https:\/\/server.codeium.com"}/g; s/const i="http:\/\/127\.0\.0\.1:\d+"/const i="https:\/\/inference.codeium.com"/g;' "$f"
    fi
    ok "还原内置扩展补丁 → $f"
  else
    step "无补丁(已净) → $f"
  fi
}
BUNDLES=""
add_bundle() { local p="$1/resources/app/extensions/windsurf/dist/extension.js"; [ -f "$p" ] && BUNDLES="$BUNDLES\n$p"; }
case "$(uname -s)" in
  Darwin)
    for app in /Applications/*.app "$HOME/Applications/"*.app; do
      p="$app/Contents/Resources/app/extensions/windsurf/dist/extension.js"
      [ -f "$p" ] && BUNDLES="$BUNDLES\n$p"
    done ;;
  *)
    for root in /usr/share/* /opt/* "$HOME/.local/share/"* /usr/lib/* ; do add_bundle "$root"; done ;;
esac
[ -n "${DAO_IDE_ROOT:-}" ] && add_bundle "$DAO_IDE_ROOT"
FOUND=0
for f in $(printf '%b' "$BUNDLES" | sort -u); do
  [ -n "$f" ] || continue
  FOUND=1
  revert_bundle "$f"
done
[ "$FOUND" = "0" ] && step '未发现 IDE 内置 windsurf 扩展 (可用 DAO_IDE_ROOT=... 指定安装根)'

echo ""
echo "保留不动: ~/.codeium/dao-byok (主公 key) · ~/.codeium/dao (Cascade 记忆)"
echo "归零完成 · 共 $CHANGED 项$([ "$DRY" = 1 ] && echo ' (DRY-RUN · 未实际改动)')"
echo "请 Reload Window / 重启 IDE → 官方语言服务器将自连 (无需本插件)"
