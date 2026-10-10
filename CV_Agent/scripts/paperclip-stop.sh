#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DATA_DIR="$ROOT_DIR/.runtime/paperclip"
PID_FILE="$DATA_DIR/server.pid"
PS_BIN="${PAPERCLIP_PS_BIN:-ps}"
KILL_BIN="${PAPERCLIP_KILL_BIN:-kill}"
SLEEP_BIN="${PAPERCLIP_SLEEP_BIN:-sleep}"
STOP_TIMEOUT="${PAPERCLIP_STOP_TIMEOUT_SECONDS:-10}"
CLI="$ROOT_DIR/.runtime/paperclip-cli/node_modules/paperclipai/dist/index.js"

is_workspace_process() {
  local pid="$1"
  local command
  command="$("$PS_BIN" -p "$pid" -o command= 2>/dev/null || true)"
  [[ "$command" == *"paperclipai/dist/index.js"* && "$command" == *"--data-dir $DATA_DIR"* ]]
}

if [[ ! -f "$PID_FILE" ]]; then
  echo "No workspace Paperclip PID file found"
  exit 0
fi

PID="$(cat "$PID_FILE")"
if ! "$KILL_BIN" -0 "$PID" 2>/dev/null; then
  echo "Paperclip process $PID is not running"
  rm -f "$PID_FILE"
  exit 0
fi

if ! is_workspace_process "$PID"; then
  echo "Refusing to stop PID $PID: process identity does not match this workspace" >&2
  exit 1
fi

"$KILL_BIN" "$PID"
echo "Stopping Paperclip process $PID"

for ((elapsed = 0; elapsed < STOP_TIMEOUT; elapsed++)); do
  if ! "$KILL_BIN" -0 "$PID" 2>/dev/null || ! is_workspace_process "$PID"; then
    rm -f "$PID_FILE"
    echo "Stopped Paperclip process $PID"
    exit 0
  fi
  "$SLEEP_BIN" 1
done

echo "Paperclip process $PID did not exit within ${STOP_TIMEOUT}s; refusing SIGKILL" >&2
exit 1
