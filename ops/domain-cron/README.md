# Custom-domain poller cron workers

These are tiny **standalone** Cloudflare Workers that drive the custom-domain
status poller by POSTing the secret-gated refresh endpoint on a schedule.

| Env | Cron worker | App worker | Target endpoint | Cron |
|-----|-------------|------------|-----------------|------|
| staging | `supportsheep-domain-cron-staging` | `supportsheep-staging` | `https://staging.supportsheep.com/api/v1/internal/domains/refresh` | `*/5 * * * *` |
| production | `supportsheep-domain-cron` | `supportsheep-production` | `https://app.supportsheep.com/api/v1/internal/domains/refresh` | `*/5 * * * *` |

## Why a separate worker?

The main app worker is built by OpenNext (`@opennextjs/cloudflare`), whose
generated entry exports only a `fetch` handler — there is **no `scheduled()`
export**. A Cron Trigger declared on the app worker (see `apps/web/wrangler.jsonc`)
therefore has no handler to run. These standalone workers carry the
`scheduled()` handler instead and call the refresh endpoint over HTTP.

## How the secret works

The refresh route (`apps/web/src/app/api/v1/internal/domains/refresh/route.ts`)
reads `env.INTERNAL_CRON_SECRET` and compares it (constant-time) against the
incoming `x-internal-cron-secret` header. It fails closed (403) if the secret is
unset or mismatched. So the cron worker and the app worker **must share the same
`INTERNAL_CRON_SECRET` value**: the cron worker sends it, the app worker checks it.

The secret value is **never committed**. It is a Cloudflare Worker secret set
out-of-band (via `wrangler secret put` or the API).

> **Important — app-worker secret propagation:** the app worker reads the secret
> through OpenNext's `getCloudflareContext()`. A secret set on the app worker via
> the API/CLI only becomes live in that runtime context after the **next full app
> deploy** (`wrangler deploy` of `apps/web`). Until then the app worker keeps
> using the value baked in at its last deploy, so the `curl` verification below
> may still 403 with a freshly-rotated secret. This is expected.

## (Re)deploy

```bash
# Generate a fresh secret once (or reuse the existing one):
export INTERNAL_CRON_SECRET=$(openssl rand -hex 32)

# Staging:
ops/domain-cron/deploy.sh staging

# Production:
ops/domain-cron/deploy.sh production
```

`deploy.sh` deploys the standalone cron worker, sets its cron trigger (from the
`wrangler.<env>.jsonc`), and sets `INTERNAL_CRON_SECRET` on **both** the cron
worker and the matching app worker.

These standalone workers have **no routes**, so deploying them cannot wipe the
app worker's routes (the known prod-route-reconciliation gotcha applies only to
the OpenNext app worker's config, not here).

## Verify

```bash
# With the secret -> 200 (after the app worker has been (re)deployed)
curl -s -o /dev/null -w "%{http_code}\n" \
  -X POST https://staging.supportsheep.com/api/v1/internal/domains/refresh \
  -H "x-internal-cron-secret: $INTERNAL_CRON_SECRET"

# Without / wrong header -> 403
curl -s -o /dev/null -w "%{http_code}\n" \
  -X POST https://staging.supportsheep.com/api/v1/internal/domains/refresh
```
