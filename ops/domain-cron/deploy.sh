#!/usr/bin/env bash
set -euo pipefail

# deploy.sh — (re)deploy a standalone custom-domain-poller cron worker.
#
# Usage:
#   ops/domain-cron/deploy.sh staging
#   ops/domain-cron/deploy.sh production
#
# What it does:
#   1. Deploys the standalone cron worker (blogbat-domain-cron[-staging]) from
#      ops/domain-cron/wrangler.<env>.jsonc. This worker has NO routes, so the
#      deploy cannot wipe the OpenNext app worker's routes.
#   2. Ensures INTERNAL_CRON_SECRET is set on BOTH the cron worker and the
#      matching app worker (they must share the same value — the cron worker
#      sends it, the app worker's /api/v1/internal/domains/refresh route checks
#      it with a constant-time compare and fails closed 403).
#
# Prereqs: wrangler authenticated (`wrangler login` or CLOUDFLARE_API_TOKEN).
# The secret is read from the env var INTERNAL_CRON_SECRET if set, otherwise you
# are prompted. NEVER commit the secret value.
#
# NOTE on the app worker (blogbat-staging / blogbat-production): its refresh
# route reads env.INTERNAL_CRON_SECRET via OpenNext's getCloudflareContext().
# A secret set via the API/CLI on the app worker only becomes live in the
# OpenNext runtime context after the NEXT full app deploy (wrangler deploy of
# apps/web). Setting it here is correct but takes effect on the next app deploy.

ENV="${1:-}"
case "$ENV" in
  staging)    CRON_WORKER="blogbat-domain-cron-staging"; APP_WORKER="blogbat-staging" ;;
  production) CRON_WORKER="blogbat-domain-cron";          APP_WORKER="blogbat-production" ;;
  *) echo "usage: $0 <staging|production>" >&2; exit 2 ;;
esac

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG="$DIR/wrangler.$ENV.jsonc"

# Resolve the secret (env var or interactive prompt).
SECRET="${INTERNAL_CRON_SECRET:-}"
if [ -z "$SECRET" ]; then
  read -rsp "INTERNAL_CRON_SECRET for $ENV (or generate with: openssl rand -hex 32): " SECRET
  echo
fi
if [ -z "$SECRET" ]; then
  echo "error: INTERNAL_CRON_SECRET is empty" >&2; exit 1
fi

echo "==> Deploying cron worker $CRON_WORKER (cron */5 * * * *, no routes)"
wrangler deploy --config "$CONFIG"

echo "==> Setting INTERNAL_CRON_SECRET on $CRON_WORKER"
printf '%s' "$SECRET" | wrangler secret put INTERNAL_CRON_SECRET --name "$CRON_WORKER"

echo "==> Setting INTERNAL_CRON_SECRET on app worker $APP_WORKER (takes effect on next app deploy)"
printf '%s' "$SECRET" | wrangler secret put INTERNAL_CRON_SECRET --name "$APP_WORKER"

echo "==> Done. Verify with:"
echo "    curl -s -o /dev/null -w '%{http_code}\\n' -X POST https://${ENV/production/app}.blogbat.com/api/v1/internal/domains/refresh -H \"x-internal-cron-secret: \$INTERNAL_CRON_SECRET\""
echo "    (expect 200 with the secret, 403 without — after the app worker has been redeployed)"
