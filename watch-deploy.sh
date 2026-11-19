#!/usr/bin/env bash
# Auto-deploy every time dist/index.html changes.
#   export VERCEL_TOKEN=...   # never store the token in a file
#   ./watch-deploy.sh
# The token is only ever read from the environment.
set -uo pipefail
: "${VERCEL_TOKEN:?export VERCEL_TOKEN first (https://vercel.com/account/tokens)}"
DIR="$(cd "$(dirname "$0")" && pwd)"
SRC="$DIR/dist/index.html"
last=""
echo "→ watching $SRC (poll 3s). Ctrl-C to stop."
while true; do
  cur=$(md5sum "$SRC" 2>/dev/null | cut -d' ' -f1)
  if [ -n "$cur" ] && [ "$cur" != "$last" ]; then
    if [ -n "$last" ]; then
      echo "→ change detected · deploying $(date +%T)"
      ( cd "$DIR" && VERCEL_TOKEN="$VERCEL_TOKEN" ./deploy.sh ) >/tmp/auto-deploy.log 2>&1 \
        && echo "✓ live: https://evorez.vercel.app  ($(date +%T))" \
        || { echo "✗ deploy failed, see /tmp/auto-deploy.log"; tail -5 /tmp/auto-deploy.log; }
      rm -rf "$DIR/dist/.vercel" "$DIR/dist/.env.local" "$DIR/dist/.gitignore"
    fi
    last="$cur"
  fi
  sleep 3
done
