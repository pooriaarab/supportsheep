export type GoogleIntegrationProvider =
  | "google_analytics"
  | "google_search_console";

export interface StoredGoogleOAuthTokens {
  refreshToken?: string;
  accessToken?: string;
  tokenType?: string;
  scope?: string;
  expiryDate?: number;
}

export interface StoredGoogleOAuthState {
  value: string;
  createdAt: number;
}

export interface StoredGoogleIntegrationConfig {
  provider: GoogleIntegrationProvider;
  oauthClientId: string;
  oauthClientSecret: string;
  redirectUri: string;
  scopes: string[];
  measurementId?: string;
  propertyId?: string;
  siteUrl?: string;
  oauth?: StoredGoogleOAuthTokens;
  oauthState?: StoredGoogleOAuthState;
}

export interface RedactedGoogleIntegrationConfig extends Omit<
  StoredGoogleIntegrationConfig,
  "oauthClientSecret" | "oauth" | "oauthState"
> {
  oauthClientSecretPreview: string;
  oauth?: {
    connected: boolean;
    tokenType?: string;
    scope?: string;
    expiryDate?: number;
  };
}

const GOOGLE_ANALYTICS_SCOPE =
  "https://www.googleapis.com/auth/analytics.readonly";
const GOOGLE_SEARCH_CONSOLE_SCOPE =
  "https://www.googleapis.com/auth/webmasters.readonly";
const GOOGLE_ANALYTICS_MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]{4,15}$/;
const GOOGLE_OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

export function getGoogleIntegrationScopes(
  provider: GoogleIntegrationProvider,
): string[] {
  if (provider === "google_analytics") {
    return [GOOGLE_ANALYTICS_SCOPE];
  }
  return [GOOGLE_SEARCH_CONSOLE_SCOPE];
}

export function normalizeGoogleAnalyticsMeasurementId(
  value: string | null | undefined,
): string | null {
  const normalized = value?.trim().toUpperCase();
  if (
    !normalized ||
    !GOOGLE_ANALYTICS_MEASUREMENT_ID_PATTERN.test(normalized)
  ) {
    return null;
  }

  return normalized;
}

export function serializeGoogleAnalyticsMeasurementIdForScript(
  measurementId: string,
): string {
  return JSON.stringify(measurementId).replace(/</g, "\\u003c");
}

function isProvider(value: unknown): value is GoogleIntegrationProvider {
  return value === "google_analytics" || value === "google_search_console";
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

export function isGoogleIntegrationConfig(
  value: unknown,
): value is StoredGoogleIntegrationConfig {
  if (!value || typeof value !== "object") {
    return false;
  }

  const config = value as Record<string, unknown>;
  return (
    isProvider(config.provider) &&
    typeof config.oauthClientId === "string" &&
    config.oauthClientId.trim().length > 0 &&
    typeof config.oauthClientSecret === "string" &&
    config.oauthClientSecret.trim().length > 0 &&
    typeof config.redirectUri === "string" &&
    config.redirectUri.trim().length > 0 &&
    isStringArray(config.scopes)
  );
}

function previewSecret(value: string): string {
  return `••••${value.slice(-4)}`;
}

export function redactGoogleIntegrationConfig(
  config: StoredGoogleIntegrationConfig,
): RedactedGoogleIntegrationConfig {
  const {
    oauthClientSecret: _oauthClientSecret,
    oauth,
    oauthState: _oauthState,
    ...rest
  } = config;

  return {
    ...rest,
    oauthClientSecretPreview: previewSecret(config.oauthClientSecret),
    oauth: oauth
      ? {
          connected: Boolean(oauth.refreshToken),
          tokenType: oauth.tokenType,
          scope: oauth.scope,
          expiryDate: oauth.expiryDate,
        }
      : undefined,
  };
}

export function buildGoogleOAuthState(
  integrationId: string,
  nonce: string,
): string {
  return `${integrationId}.${nonce}`;
}

export function parseGoogleOAuthState(
  state: string | null,
): { integrationId: string; nonce: string } | null {
  if (!state) {
    return null;
  }

  const separatorIndex = state.indexOf(".");
  if (separatorIndex <= 0 || separatorIndex === state.length - 1) {
    return null;
  }

  return {
    integrationId: state.slice(0, separatorIndex),
    nonce: state.slice(separatorIndex + 1),
  };
}

export function verifyGoogleOAuthState(
  state: string | null,
  integrationId: string,
  expectedNonce: string,
): boolean {
  const parsed = parseGoogleOAuthState(state);
  return (
    parsed?.integrationId === integrationId && parsed.nonce === expectedNonce
  );
}

export function isGoogleOAuthStateFresh(
  createdAt: number,
  now = Date.now(),
): boolean {
  return createdAt <= now && now - createdAt <= GOOGLE_OAUTH_STATE_TTL_MS;
}

export function buildGoogleRedirectUri(origin: string): string {
  return `${origin.replace(/\/+$/, "")}/api/v1/integrations/google/callback`;
}
