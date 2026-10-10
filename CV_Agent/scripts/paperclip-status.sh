#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DATA_DIR="$ROOT_DIR/.runtime/paperclip"
PID_FILE="$DATA_DIR/server.pid"
HEALTH_URL="http://127.0.0.1:3100/api/health"
NODE_BIN="${PAPERCLIP_NODE_BIN:-node}"
LSOF_BIN="${PAPERCLIP_LSOF_BIN:-lsof}"
CURL_BIN="${PAPERCLIP_CURL_BIN:-curl}"
PS_BIN="${PAPERCLIP_PS_BIN:-ps}"
KILL_BIN="${PAPERCLIP_KILL_BIN:-kill}"

is_valid_health() {
  "$NODE_BIN" -e '
    try {
      const body = JSON.parse(process.argv[1]);
      process.exit(body.status === "ok" && body.deploymentMode === "local_trusted" ? 0 : 1);
    } catch (_) {
      process.exit(1);
    }
  ' "$1"
}

is_workspace_process() {
  local pid="$1"
  local cli="$ROOT_DIR/.runtime/paperclip-cli/node_modules/paperclipai/dist/index.js"
  local command
  command="$("$PS_BIN" -p "$pid" -o command= 2>/dev/null || true)"
  [[ "$command" == *"paperclipai/dist/index.js"* && "$command" == *"--data-dir $DATA_DIR"* ]]
}

if [[ -f "$PID_FILE" ]] && "$KILL_BIN" -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  PID="$(cat "$PID_FILE")"
  if is_workspace_process "$PID"; then
    echo "process=$PID"
  else
    echo "process=pid-mismatch"
  fi
else
  LISTENER_PIDS="$("$LSOF_BIN" -nP -iTCP:3100 -sTCP:LISTEN -t 2>/dev/null || true)"
  FOUND_PID="${LISTENER_PIDS%%$'\n'*}"
  if [[ -n "$FOUND_PID" ]] && "$KILL_BIN" -0 "$FOUND_PID" 2>/dev/null && is_workspace_process "$FOUND_PID"; then
    printf '%s\n' "$FOUND_PID" > "$PID_FILE"
    echo "process=$FOUND_PID (repaired-pid-file)"
  else
    echo "process=not-running"
  fi
fi

HEALTH_BODY="$("$CURL_BIN" --fail --silent --show-error "$HEALTH_URL" 2>/dev/null || true)"
if is_valid_health "$HEALTH_BODY"; then
  echo "health=ok url=http://127.0.0.1:3100"
else
  echo "health=unavailable url=http://127.0.0.1:3100"
fi
