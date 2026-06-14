import { describe, expect, it } from "vitest";
import {
  buildGoogleOAuthState,
  getGoogleIntegrationScopes,
  isGoogleIntegrationConfig,
  isGoogleOAuthStateFresh,
  normalizeGoogleAnalyticsMeasurementId,
  redactGoogleIntegrationConfig,
  serializeGoogleAnalyticsMeasurementIdForScript,
  verifyGoogleOAuthState,
} from "@/lib/integrations/google-integration";

describe("google integration config", () => {
  it("returns least-privilege scopes for each provider", () => {
    expect(getGoogleIntegrationScopes("google_analytics")).toEqual([
      "https://www.googleapis.com/auth/analytics.readonly",
    ]);
    expect(getGoogleIntegrationScopes("google_search_console")).toEqual([
      "https://www.googleapis.com/auth/webmasters.readonly",
    ]);
  });

  it("redacts OAuth client secrets, tokens, and state", () => {
    const redacted = redactGoogleIntegrationConfig({
      provider: "google_analytics",
      oauthClientId: "client-id",
      oauthClientSecret: "client-secret",
      redirectUri: "https://example.com/api/v1/integrations/google/callback",
      scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
      measurementId: "G-ABC123",
      propertyId: "123456",
      oauth: {
        refreshToken: "refresh-token",
        accessToken: "access-token",
        tokenType: "Bearer",
        scope: "scope",
        expiryDate: 123,
      },
      oauthState: {
        value: "state-secret",
        createdAt: 123,
      },
    });

    expect(redacted.oauthClientSecret).toBeUndefined();
    expect(redacted.oauthClientSecretPreview).toBe("••••cret");
    expect(redacted.oauth?.refreshToken).toBeUndefined();
    expect(redacted.oauth?.accessToken).toBeUndefined();
    expect(redacted.oauth?.connected).toBe(true);
    expect(redacted.oauthState).toBeUndefined();
  });

  it("builds and verifies OAuth state", () => {
    const state = buildGoogleOAuthState("integration-1", "nonce-1");

    expect(state).toBe("integration-1.nonce-1");
    expect(verifyGoogleOAuthState(state, "integration-1", "nonce-1")).toBe(
      true,
    );
    expect(verifyGoogleOAuthState(state, "integration-1", "nonce-2")).toBe(
      false,
    );
  });

  it("expires OAuth state after ten minutes", () => {
    const now = Date.UTC(2026, 3, 27, 1, 0, 0);

    expect(isGoogleOAuthStateFresh(now - 10 * 60 * 1000, now)).toBe(true);
    expect(isGoogleOAuthStateFresh(now - 10 * 60 * 1000 - 1, now)).toBe(
      false,
    );
    expect(isGoogleOAuthStateFresh(now + 1, now)).toBe(false);
  });

  it("recognizes stored Google integration config", () => {
    expect(
      isGoogleIntegrationConfig({
        provider: "google_search_console",
        oauthClientId: "client-id",
        oauthClientSecret: "client-secret",
        redirectUri: "https://example.com/api/v1/integrations/google/callback",
        scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
        siteUrl: "https://example.com/",
      }),
    ).toBe(true);
  });

  it("normalizes valid GA4 measurement IDs and rejects unsafe values", () => {
    expect(normalizeGoogleAnalyticsMeasurementId(" g-abc123 ")).toBe(
      "G-ABC123",
    );
    expect(normalizeGoogleAnalyticsMeasurementId("UA-123456-1")).toBeNull();
    expect(
      normalizeGoogleAnalyticsMeasurementId("</script><script>alert(1)"),
    ).toBeNull();
  });

  it("escapes GA4 measurement IDs for inline script context", () => {
    const output = serializeGoogleAnalyticsMeasurementIdForScript(
      "G-ABC</script><script>alert(1)</script>",
    );

    expect(output).not.toContain("</script>");
    expect(output).toContain("\\u003c/script>");
  });
});
