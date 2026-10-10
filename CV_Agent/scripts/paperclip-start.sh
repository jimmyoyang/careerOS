#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DATA_DIR="$ROOT_DIR/.runtime/paperclip"
LOG_FILE="$ROOT_DIR/outputs/paperclip-server.log"
CLI="$ROOT_DIR/.runtime/paperclip-cli/node_modules/paperclipai/dist/index.js"
NODE_BIN="${PAPERCLIP_NODE_BIN:-node}"
LSOF_BIN="${PAPERCLIP_LSOF_BIN:-lsof}"
CURL_BIN="${PAPERCLIP_CURL_BIN:-curl}"
PS_BIN="${PAPERCLIP_PS_BIN:-ps}"
KILL_BIN="${PAPERCLIP_KILL_BIN:-kill}"
SLEEP_BIN="${PAPERCLIP_SLEEP_BIN:-sleep}"
HEALTH_URL="http://127.0.0.1:3100/api/health"

mkdir -p "$DATA_DIR" "$ROOT_DIR/outputs"
export DO_NOT_TRACK=1
export PAPERCLIP_TELEMETRY_DISABLED=1

if [[ ! -f "$CLI" ]]; then
  echo "Paperclip CLI is not installed at $CLI" >&2
  exit 1
fi

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
  local command
  command="$("$PS_BIN" -p "$pid" -o command= 2>/dev/null || true)"
  [[ "$command" == *"paperclipai/dist/index.js"* && "$command" == *"--data-dir $DATA_DIR"* ]]
}

LISTENER_PIDS="$("$LSOF_BIN" -nP -iTCP:3100 -sTCP:LISTEN -t 2>/dev/null || true)"
if [[ -n "$LISTENER_PIDS" ]]; then
  LISTENER_PID="${LISTENER_PIDS%%$'\n'*}"
  HEALTH_BODY="$("$CURL_BIN" --fail --silent --show-error "$HEALTH_URL" 2>/dev/null || true)"
  if is_valid_health "$HEALTH_BODY" && is_workspace_process "$LISTENER_PID"; then
    printf '%s\n' "$LISTENER_PID" > "$DATA_DIR/server.pid"
    echo "Paperclip is already listening on http://127.0.0.1:3100 (pid=$LISTENER_PID)"
    exit 0
  fi
  echo "Port 3100 is occupied by an unverified process; refusing to start Paperclip" >&2
  exit 1
fi

ARGS=(run --data-dir "$DATA_DIR" --bind loopback)
if [[ -f "$DATA_DIR/instances/default/config.json" && -f "$DATA_DIR/instances/default/runtime-info.json" ]]; then
  ARGS+=(--no-repair)
fi

nohup "$NODE_BIN" "$CLI" "${ARGS[@]}" >"$LOG_FILE" 2>&1 </dev/null &
SERVER_PID=$!
echo "$SERVER_PID" > "$DATA_DIR/server.pid"
disown "$SERVER_PID" 2>/dev/null || true
echo "Starting Paperclip on http://127.0.0.1:3100"

for _ in {1..30}; do
  HEALTH_BODY="$("$CURL_BIN" --fail --silent --show-error "$HEALTH_URL" 2>/dev/null || true)"
  if is_valid_health "$HEALTH_BODY"; then
    echo "Paperclip health=ok pid=$SERVER_PID"
    exit 0
  fi
  if ! "$KILL_BIN" -0 "$SERVER_PID" 2>/dev/null; then
    echo "Paperclip exited during startup; see $LOG_FILE" >&2
    exit 1
  fi
  "$SLEEP_BIN" 1
done

echo "Paperclip did not become healthy within 30 seconds; see $LOG_FILE" >&2
exit 1
