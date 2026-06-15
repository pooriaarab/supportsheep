// Standalone Cloudflare cron Worker that drives the custom-domain status
// poller for STAGING (staging.supportsheep.com).
//
// Why this exists: the main app worker (supportsheep-staging) is built by OpenNext
// (@opennextjs/cloudflare), whose entry exports only a `fetch` handler — there
// is no `scheduled()` export — so a Cron Trigger declared on that worker has no
// handler to run. This tiny standalone worker carries the `scheduled()` handler
// and POSTs the secret-gated refresh endpoint on a schedule instead.
//
// Deploy name: supportsheep-domain-cron-staging  (cron: */5 * * * *)
// Mirrors the production worker (supportsheep-domain-cron) byte-for-byte except for
// the target host. See ./README.md for how to (re)deploy.
export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      try {
        const res = await fetch("https://staging.supportsheep.com/api/v1/internal/domains/refresh", {
          method: "POST",
          headers: { "x-internal-cron-secret": env.INTERNAL_CRON_SECRET },
        });
        if (!res.ok) console.error(`domain-refresh failed: ${res.status}`);
      } catch (e) {
        console.error("domain-refresh error:", e);
      }
    })());
  },
};
