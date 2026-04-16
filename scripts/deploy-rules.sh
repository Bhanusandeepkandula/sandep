#!/usr/bin/env bash
# One-command Firestore rules deploy.
#
# Why this script exists:
#   Split-bill settlements require a slave writing to a specific slot in the
#   master's `settlements` map. That cross-user write is gated by the rules
#   defined in firestore.rules. If the deployed rules on the Firebase project
#   are the defaults, every slave→master write fails with permission-denied
#   and the master never sees the payment reflected.
#
# Usage:
#   bash scripts/deploy-rules.sh              # deploys using firebase-tools
#   FIREBASE_TOKEN=xxx bash scripts/deploy-rules.sh   # headless / CI mode
#
# The first run will prompt you for Google auth if you haven't logged in.
# After that it just deploys.
set -euo pipefail

cd "$(dirname "$0")/.."

PROJECT_ID="sandeep-1fc6b"

echo "→ Deploying Firestore rules to project: ${PROJECT_ID}"
echo "  (rules file: firestore.rules)"

if [[ -n "${FIREBASE_TOKEN:-}" ]]; then
  npx --yes firebase-tools deploy \
    --only firestore:rules \
    --project "${PROJECT_ID}" \
    --token "${FIREBASE_TOKEN}" \
    --non-interactive
else
  # Interactive: will open a browser for login on first run
  if ! npx --yes firebase-tools projects:list --project "${PROJECT_ID}" >/dev/null 2>&1; then
    echo "→ Not logged in. Running 'firebase login --reauth'…"
    npx --yes firebase-tools login --reauth
  fi
  npx --yes firebase-tools deploy \
    --only firestore:rules \
    --project "${PROJECT_ID}"
fi

echo ""
echo "✓ Rules deployed. Split settlements will now auto-sync from slave to master."
echo "  If any settlements were queued while rules were stale they will flush"
echo "  automatically next time each client opens the app (or on window focus)."
