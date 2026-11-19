#!/usr/bin/env bash
# One-shot production deploy of the Evorez landing page to the `evorez` Vercel project.
# Usage:  VERCEL_TOKEN=xxxxx ./deploy.sh
set -euo pipefail
: "${VERCEL_TOKEN:?Set VERCEL_TOKEN first}"
VERCEL=/tmp/node_modules/.bin/vercel
cd "$(dirname "$0")/dist"
SCOPE="team_p7t5Mz1Y6gpMp41sQyUuKMpc"
echo "→ linking dist/ to project evorez"
"$VERCEL" link --yes --project evorez --scope "$SCOPE" --token "$VERCEL_TOKEN"
echo "→ deploying to production"
"$VERCEL" deploy --prod --yes --scope "$SCOPE" --token "$VERCEL_TOKEN"
