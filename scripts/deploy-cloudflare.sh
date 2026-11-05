#!/usr/bin/env bash
# Builds dist/_worker.js and deploys it to Cloudflare Pages (project "warder-demos" by default).
#
#   CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... scripts/deploy-cloudflare.sh [project]
#
# The token needs "Cloudflare Pages: Edit". The site is a single worker file, so there are no
# separate asset uploads that can go missing.
set -euo pipefail
cd "$(dirname "$0")/.."
PROJECT="${1:-warder-demos}"
: "${CLOUDFLARE_ACCOUNT_ID:?set CLOUDFLARE_ACCOUNT_ID}"
: "${CLOUDFLARE_API_TOKEN:?set CLOUDFLARE_API_TOKEN}"
API="https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/$PROJECT"
AUTH="Authorization: Bearer $CLOUDFLARE_API_TOKEN"

node scripts/build-worker.js

ID=$(curl -fsS -X POST "$API/deployments" -H "$AUTH" \
  -F 'manifest={}' -F 'branch=main' \
  -F "_worker.js=@dist/_worker.js;filename=_worker.js;type=application/javascript+module" \
  | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const j=JSON.parse(d);if(!j.success){console.error(JSON.stringify(j.errors));process.exit(1)}console.log(j.result.id)})')
echo "deployment $ID"

for _ in $(seq 1 30); do
  STAGE=$(curl -fsS "$API/deployments/$ID" -H "$AUTH" \
    | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const s=JSON.parse(d).result.latest_stage;console.log(s.name+" "+s.status)})')
  echo "  $STAGE"
  case "$STAGE" in "deploy success") echo "live: https://$PROJECT.pages.dev/"; exit 0;; *failure*) exit 1;; esac
  sleep 4
done
echo "timed out waiting for the deployment" >&2; exit 1
