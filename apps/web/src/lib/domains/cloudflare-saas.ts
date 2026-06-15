import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";

import { createLogger } from "@/lib/logger";

const log = createLogger("lib:domains:cloudflare-saas");

/** Zone id for supportsheep.com (Cloudflare for SaaS lives on the apex zone). */
const DEFAULT_SAAS_ZONE_ID = "supportsheep.com";

const CF_API_BASE = "https://api.cloudflare.com/client/v4";

/**
 * Thrown when the Cloudflare for SaaS integration is not configured for this
 * environment (no `CF_API_TOKEN` secret). The dashboard surfaces this message
 * to the owner instead of 500-ing — custom domains simply aren't available yet.
 */
export class CustomDomainsNotConfiguredError extends Error {
  constructor() {
    super(
      "Custom domains are not configured for this environment. " +
        "An administrator must set the CF_API_TOKEN secret.",
    );
    this.name = "CustomDomainsNotConfiguredError";
  }
}

/** Thrown when the Cloudflare API returns an error response. */
export class CloudflareApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "CloudflareApiError";
    this.status = status;
  }
}

/** A single DNS record the owner must create to validate ownership / SSL. */
export interface DcvRecord {
  /** Record type, e.g. "cname" or "txt". */
  type: string;
  /** The record name (host) to create. */
  name: string;
  /** The record value/target. */
  value: string;
}

/** Normalized view of a Cloudflare custom hostname, used across the app. */
export interface CustomHostnameResult {
  /** Cloudflare `custom_hostname` id (for polling + deletion). */
  id: string;
  /** The hostname being provisioned. */
  hostname: string;
  /** Cloudflare hostname status: "pending" | "active" | "blocked" | etc. */
  status: string;
  /** SSL/certificate status, when present. */
  sslStatus: string | null;
  /**
   * SSL validation errors Cloudflare surfaces while issuing the certificate
   * (e.g. a `caa_error` message). Empty when there are none. The poller and the
   * guidance mapper inspect these to explain *why* a domain is stuck/failed.
   */
  sslValidationErrors: string[];
  /**
   * The verification errors Cloudflare reports at the hostname level (distinct
   * from SSL — e.g. a missing/incorrect DCV record). Empty when there are none.
   */
  verificationErrors: string[];
  /**
   * The CNAME target the owner must point their domain at. For Cloudflare for
   * SaaS this is the fallback origin / SaaS zone apex (the owner creates
   * `{hostname} CNAME {dcvTarget}`).
   */
  dcvTarget: string;
  /**
   * Ownership-verification record Cloudflare may require in addition to the
   * routing CNAME (HTTP/TXT DCV). Null when none is pending.
   */
  ownershipVerification: DcvRecord | null;
}

interface CloudflareEnvelope<T> {
  success: boolean;
  errors?: { code?: number; message?: string }[];
  result?: T;
}

interface CloudflareCustomHostname {
  id: string;
  hostname: string;
  status: string;
  ssl?: {
    status?: string;
    validation_errors?: { message?: string }[];
  };
  verification_errors?: string[];
  ownership_verification?: { type?: string; name?: string; value?: string };
  ownership_verification_http?: { http_url?: string; http_body?: string };
}

interface SaasConfig {
  token: string;
  zoneId: string;
}

/**
 * Read the Cloudflare for SaaS credentials from the worker env. Throws
 * {@link CustomDomainsNotConfiguredError} when `CF_API_TOKEN` is unset so
 * callers can surface a clear, non-500 message. The token is never logged.
 */
function getSaasConfig(): SaasConfig {
  const { env } = getCloudflareContext();
  const token = env.CF_API_TOKEN;
  if (!token) {
    throw new CustomDomainsNotConfiguredError();
  }
  return { token, zoneId: env.CF_SAAS_ZONE_ID || DEFAULT_SAAS_ZONE_ID };
}

async function cfFetch<T>(
  path: string,
  init: RequestInit,
  token: string,
): Promise<CloudflareEnvelope<T>> {
  let response: Response;
  try {
    response = await fetch(`${CF_API_BASE}${path}`, {
      ...init,
      headers: {
        // Never log the token — only attach it to the outbound request.
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
  } catch (error) {
    log.error("cloudflare request failed", {
      path,
      method: init.method ?? "GET",
    });
    throw new CloudflareApiError(
      `Could not reach Cloudflare: ${error instanceof Error ? error.message : "network error"}`,
      502,
    );
  }

  let body: CloudflareEnvelope<T> | null = null;
  try {
    body = (await response.json()) as CloudflareEnvelope<T>;
  } catch {
    body = null;
  }

  if (!response.ok || !body?.success) {
    const detail =
      body?.errors?.map((e) => e.message).filter(Boolean).join("; ") ||
      `HTTP ${response.status}`;
    log.error("cloudflare api error", {
      path,
      method: init.method ?? "GET",
      status: response.status,
    });
    throw new CloudflareApiError(`Cloudflare API error: ${detail}`, response.status);
  }

  return body;
}

/** The CNAME target owners point their domain at (the SaaS zone apex). */
function dcvTargetFor(zoneId: string): string {
  // When the zone id is the apex hostname (default), that IS the routing
  // target. For a real Cloudflare zone id, the fallback origin is the apex
  // hostname — callers should configure CF_SAAS_ZONE_ID accordingly.
  return zoneId.includes(".") ? zoneId : DEFAULT_SAAS_ZONE_ID;
}

function normalizeHostname(raw: CloudflareCustomHostname, zoneId: string): CustomHostnameResult {
  const ov = raw.ownership_verification;
  const ownershipVerification: DcvRecord | null =
    ov?.name && ov?.value
      ? { type: ov.type ?? "txt", name: ov.name, value: ov.value }
      : null;

  const sslValidationErrors = (raw.ssl?.validation_errors ?? [])
    .map((e) => e.message)
    .filter((m): m is string => !!m);
  const verificationErrors = (raw.verification_errors ?? []).filter(
    (m): m is string => !!m,
  );

  return {
    id: raw.id,
    hostname: raw.hostname,
    status: raw.status,
    sslStatus: raw.ssl?.status ?? null,
    sslValidationErrors,
    verificationErrors,
    dcvTarget: dcvTargetFor(zoneId),
    ownershipVerification,
  };
}

/**
 * Create a Cloudflare for SaaS custom hostname for `hostname`. Returns the
 * hostname id, its status, and the CNAME target the owner must create at their
 * DNS provider (`{hostname} CNAME {dcvTarget}`).
 */
export async function createCustomHostname(
  hostname: string,
): Promise<CustomHostnameResult> {
  const { token, zoneId } = getSaasConfig();
  const body = await cfFetch<CloudflareCustomHostname>(
    `/zones/${zoneId}/custom_hostnames`,
    {
      method: "Article",
      body: JSON.stringify({
        hostname,
        ssl: {
          method: "http",
          type: "dv",
          settings: { min_tls_version: "1.2" },
        },
      }),
    },
    token,
  );
  return normalizeHostname(body.result as CloudflareCustomHostname, zoneId);
}

/** Fetch the current status of a Cloudflare for SaaS custom hostname by id. */
export async function getCustomHostname(
  id: string,
): Promise<CustomHostnameResult> {
  const { token, zoneId } = getSaasConfig();
  const body = await cfFetch<CloudflareCustomHostname>(
    `/zones/${zoneId}/custom_hostnames/${id}`,
    { method: "GET" },
    token,
  );
  return normalizeHostname(body.result as CloudflareCustomHostname, zoneId);
}

/** Delete a Cloudflare for SaaS custom hostname by id. */
export async function deleteCustomHostname(id: string): Promise<void> {
  const { token, zoneId } = getSaasConfig();
  await cfFetch<{ id: string }>(
    `/zones/${zoneId}/custom_hostnames/${id}`,
    { method: "DELETE" },
    token,
  );
}
