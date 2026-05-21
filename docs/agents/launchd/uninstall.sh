#!/usr/bin/env bash
# Stops and removes the Praxis agent-loop launchd job.
set -euo pipefail

PLIST_DST="$HOME/Library/LaunchAgents/com.tsrun.praxis.agent-loop.plist"

if [ -f "$PLIST_DST" ]; then
  launchctl unload "$PLIST_DST" 2>/dev/null || true
  rm -f "$PLIST_DST"
  echo "agent loop uninstalled."
else
  echo "no agent loop installed at $PLIST_DST — nothing to do."
fi
