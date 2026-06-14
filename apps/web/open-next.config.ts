import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Default in-memory incremental cache. TODO(M2): wire KV/D1/DO cache overrides — the
// KV populate step currently fails with "fetch failed" on Node 25 (works on CI Node 22),
// so it's deferred to keep the deploy unblocked.
const config = defineCloudflareConfig();
// firebase-admin's jwks-rsa pulls `jose`, whose `workerd` export points to a browser
// build esbuild can't resolve. Disable the workerd condition so such packages resolve
// via their node export and the worker bundle builds.
config.cloudflare = { ...config.cloudflare, useWorkerdCondition: false };
export default config;
