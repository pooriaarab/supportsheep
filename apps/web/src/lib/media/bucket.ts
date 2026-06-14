import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * The R2 bucket holding media bytes (uploads, generated images, interview
 * recordings). Keyed by each item's stored `storagePath`. Bytes are served
 * back to clients through authed/public Worker routes — we do not mint
 * GCS/S3-style signed URLs.
 *
 * Throws if the binding is absent (misconfigured env) so callers fail loud
 * rather than silently dropping uploads.
 */
export function getMediaBucket(): MediaR2Bucket {
  const { env } = getCloudflareContext();
  if (!env.MEDIA) {
    throw new Error("R2 MEDIA binding is not configured for this environment");
  }
  return env.MEDIA;
}
