import "server-only";

// `googleapis` + `@google-analytics/data` pull in gRPC/heavy Node deps that fail
// to evaluate on the Cloudflare Workers runtime. Import them as TYPES only at
// module scope (erased at build) and lazy `await import()` the runtime values
// inside the functions that actually call Google APIs — otherwise this module
// (reached from PublicShell on every public page) 500s the whole public site.
import type { google as GoogleApis } from "googleapis";
import type { BetaAnalyticsDataClient } from "@google-analytics/data";
import {
  isGoogleIntegrationConfig,
  normalizeGoogleAnalyticsMeasurementId,
  type StoredGoogleIntegrationConfig,
} from "@/lib/integrations/google-integration";
import { listIntegrationsByTypeAndStatus } from "@/lib/integrations/repository";
import { DEFAULT_BLOG_ID } from "@/lib/tenancy/repository";

export interface GoogleAnalyticsSyncConfig {
  propertyId: string;
  measurementId?: string;
  client: BetaAnalyticsDataClient;
}

export interface GoogleSearchConsoleSyncConfig {
  siteUrl: string;
  auth: InstanceType<typeof GoogleApis.auth.OAuth2>;
}

async function getConnectedGoogleConfig(
  provider: StoredGoogleIntegrationConfig["provider"],
): Promise<StoredGoogleIntegrationConfig | null> {
  let rows;
  try {
    rows = await listIntegrationsByTypeAndStatus(
      DEFAULT_BLOG_ID,
      "oauth",
      "connected",
    );
  } catch {
    return null;
  }

  for (const row of rows) {
    const config = row.config;
    if (
      isGoogleIntegrationConfig(config) &&
      config.provider === provider &&
      config.oauth?.refreshToken
    ) {
      return config;
    }
  }

  return null;
}

export async function getConnectedGoogleAnalyticsMeasurementId(): Promise<
  string | null
> {
  const config = await getConnectedGoogleConfig("google_analytics");
  return normalizeGoogleAnalyticsMeasurementId(config?.measurementId);
}

export async function getGoogleAnalyticsSyncConfig(): Promise<GoogleAnalyticsSyncConfig | null> {
  const config = await getConnectedGoogleConfig("google_analytics");
  if (!config?.propertyId || !config.oauth?.refreshToken) {
    return null;
  }

  const { google } = await import("googleapis");
  const { BetaAnalyticsDataClient } = await import("@google-analytics/data");

  const authClient = new google.auth.OAuth2(
    config.oauthClientId,
    config.oauthClientSecret,
    config.redirectUri,
  );
  authClient.setCredentials({ refresh_token: config.oauth.refreshToken });

  return {
    propertyId: config.propertyId,
    measurementId:
      normalizeGoogleAnalyticsMeasurementId(config.measurementId) ?? undefined,
    client: new BetaAnalyticsDataClient({ authClient }),
  };
}

export async function getGoogleSearchConsoleSyncConfig(): Promise<GoogleSearchConsoleSyncConfig | null> {
  const config = await getConnectedGoogleConfig("google_search_console");
  if (!config?.siteUrl || !config.oauth?.refreshToken) {
    return null;
  }

  const { google } = await import("googleapis");

  const auth = new google.auth.OAuth2(
    config.oauthClientId,
    config.oauthClientSecret,
    config.redirectUri,
  );
  auth.setCredentials({ refresh_token: config.oauth.refreshToken });

  return {
    siteUrl: config.siteUrl,
    auth,
  };
}
