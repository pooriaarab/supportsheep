import { normalizeGoogleAnalyticsMeasurementId } from "@/lib/integrations/google-integration";

/**
 * Decide which single GA4 Measurement ID (if any) to inject on a blog's public
 * pages.
 *
 * Inputs are the candidate IDs from two independent sources, in precedence
 * order:
 * - `blogConfigMeasurementId`: the owner's own GA4 Measurement ID stored on the
 *   HOST-RESOLVED blog config (`analytics.gaMeasurementId`). This is the
 *   per-blog client tag and is the reason a given tenant's pageviews land in
 *   that tenant owner's own Google Analytics — blog A's config yields blog A's
 *   ID and never blog B's. It takes precedence when set.
 * - `connectedIntegrationMeasurementId`: the GA4 ID from the optional Google
 *   OAuth analytics integration (server-side data sync), used as a fallback
 *   when the owner has not set a per-blog ID.
 *
 * Each candidate is validated/normalized to the canonical `G-[A-Z0-9]+` form
 * (trimmed, upper-cased) via {@link normalizeGoogleAnalyticsMeasurementId};
 * anything invalid or empty is dropped (treated as "disabled"). Returns the
 * first valid ID, or `null` when both are absent/invalid (no tag injected).
 *
 * Pure and deterministic: no I/O, no DOM, no host access — callers resolve the
 * inputs per-host and pass them in, which keeps the tenant-isolation decision
 * trivially testable.
 */
export function resolvePublicMeasurementId(
  blogConfigMeasurementId: string | null | undefined,
  connectedIntegrationMeasurementId: string | null | undefined,
): string | null {
  return (
    normalizeGoogleAnalyticsMeasurementId(blogConfigMeasurementId) ??
    normalizeGoogleAnalyticsMeasurementId(connectedIntegrationMeasurementId)
  );
}
