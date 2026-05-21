#!/usr/bin/env bash
# Installs the Praxis agent-loop launchd job. Idempotent — safe to re-run.
set -euo pipefail

PLIST_SRC="$(cd "$(dirname "$0")" && pwd)/com.tsrun.praxis.agent-loop.plist"
PLIST_DST="$HOME/Library/LaunchAgents/com.tsrun.praxis.agent-loop.plist"
LABEL="com.tsrun.praxis.agent-loop"

if [ ! -f "$PLIST_SRC" ]; then
  echo "missing plist: $PLIST_SRC" >&2
  exit 1
fi

if launchctl list | awk '{print $3}' | grep -qx "$LABEL"; then
  echo "agent loop already loaded — unloading first so we can refresh"
  launchctl unload "$PLIST_DST" 2>/dev/null || true
fi

cp "$PLIST_SRC" "$PLIST_DST"
launchctl load "$PLIST_DST"

echo
echo "agent loop installed."
echo "  schedule: every 3 hours at :07 (00:07, 03:07, ... 21:07)"
echo "  logs:     ~/Library/Logs/praxis-agent-loop.{log,err.log}"
echo "  status:   launchctl list | grep $LABEL"
echo "  disable:  bash $(dirname "$0")/uninstall.sh"
