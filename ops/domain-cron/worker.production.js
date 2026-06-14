// Standalone Cloudflare cron Worker that drives the custom-domain status
// poller for PRODUCTION (app.blogbat.com).
//
// Why this exists: the main app worker (blogbat-production) is built by OpenNext
// (@opennextjs/cloudflare), whose entry exports only a `fetch` handler — there
// is no `scheduled()` export — so a Cron Trigger declared on that worker has no
// handler to run. This tiny standalone worker carries the `scheduled()` handler
// and POSTs the secret-gated refresh endpoint on a schedule instead.
//
// Deploy name: blogbat-domain-cron  (cron: */5 * * * *)
// This is the source of record for the already-deployed production worker.
// See ./README.md for how to (re)deploy.
export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      try {
        const res = await fetch("https://app.blogbat.com/api/v1/internal/domains/refresh", {
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
