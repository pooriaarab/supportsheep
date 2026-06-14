import type { AnyD1Database } from "drizzle-orm/d1";

// Augment the OpenNext `CloudflareEnv` (from getCloudflareContext().env) with the
// bindings declared in wrangler.jsonc that app code uses. AnyD1Database comes from
// drizzle and is self-contained, so we avoid pulling the full (huge) Cloudflare
// runtime types — `wrangler types` generates a 12k-line file that OOMs tsc.
declare global {
  interface CloudflareEnv {
    DB: AnyD1Database;
    NEXT_INC_CACHE_KV?: unknown;
    /** Cloudflare Email Service binding (send_email). Optional until supportsheep.com
     * is onboarded in the dashboard's Email Sending section. */
    EMAIL?: {
      send: (message: {
        to: string;
        from: string;
        subject: string;
        text: string;
        html: string;
      }) => Promise<{ messageId: string }>;
    };
    /** R2 bucket for media bytes (uploads, generated images, interview recordings).
     * Minimal surface — full @cloudflare/workers-types is intentionally avoided
     * (see note above). Optional until the binding is present at runtime. */
    MEDIA?: MediaR2Bucket;
    /** Cloudflare API token (SSL + custom-hostname edit) for the Cloudflare for
     * SaaS custom-domain flow. Set via `wrangler secret put CF_API_TOKEN`.
     * Optional — when unset, custom domains degrade to a clear "not configured"
     * error rather than 500-ing the dashboard. Never logged. */
    CF_API_TOKEN?: string;
    /** Zone id (or apex hostname) hosting Cloudflare for SaaS custom hostnames.
     * Defaults to the supportsheep.com zone when unset. */
    CF_SAAS_ZONE_ID?: string;
    /** Shared secret gating the internal domain-status refresh endpoint
     * (`POST /api/v1/internal/domains/refresh`), called by the Cron Trigger.
     * Compared in constant time against the `x-internal-cron-secret` header.
     * Set via `wrangler secret put INTERNAL_CRON_SECRET`. When unset the
     * endpoint refuses all callers (fail-closed). Never logged. */
    INTERNAL_CRON_SECRET?: string;
  }

  /** Subset of Cloudflare's R2Bucket we use. */
  interface MediaR2Bucket {
    put(
      key: string,
      value: ArrayBuffer | ReadableStream | string | Blob,
      options?: { httpMetadata?: { contentType?: string } },
    ): Promise<unknown>;
    get(key: string): Promise<MediaR2Object | null>;
    delete(key: string | string[]): Promise<void>;
  }

  interface MediaR2Object {
    body: ReadableStream;
    size: number;
    httpMetadata?: { contentType?: string };
    writeHttpMetadata(headers: Headers): void;
  }
}

export {};
