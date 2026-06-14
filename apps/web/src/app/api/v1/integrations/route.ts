/**
 * Integrations API
 *
 * GET    /api/v1/integrations -- List all integrations
 * POST   /api/v1/integrations -- Create/connect an integration
 * DELETE /api/v1/integrations -- Bulk delete integrations
 */

import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createApiHandler } from "@/lib/create-api-handler";
import { resolvePublicSiteUrl } from "@/lib/public-site";
import {
  buildWebhookIntegrationConfig,
  isWebhookIntegrationConfig,
  redactWebhookIntegrationConfig,
} from "@/lib/integrations/webhook-integration";
import {
  buildGoogleRedirectUri,
  getGoogleIntegrationScopes,
  isGoogleIntegrationConfig,
  type GoogleIntegrationProvider,
  normalizeGoogleAnalyticsMeasurementId,
  redactGoogleIntegrationConfig,
  type StoredGoogleIntegrationConfig,
} from "@/lib/integrations/google-integration";
import {
  createIntegrationWithId,
  deleteIntegrations,
  listIntegrations,
  type IntegrationRow,
} from "@/lib/integrations/repository";

const createIntegrationSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  type: z.enum(["oauth", "api_key", "webhook"]),
  description: z.string().max(500).optional().default(""),
  icon: z.string().max(10).optional(),
  config: z.record(z.string(), z.string()).optional(),
});

const bulkDeleteSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, "At least one ID is required"),
});

function serializeIntegration(row: IntegrationRow) {
  let config: unknown = row.config;
  if (isWebhookIntegrationConfig(row.config)) {
    config = redactWebhookIntegrationConfig(row.config);
  } else if (isGoogleIntegrationConfig(row.config)) {
    config = redactGoogleIntegrationConfig(row.config);
  }

  return {
    id: row.id,
    name: row.name,
    type: row.type,
    status: row.status,
    description: row.description,
    icon: row.icon,
    config,
    connectedAt: row.connectedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function isGoogleProvider(value: unknown): value is GoogleIntegrationProvider {
  return value === "google_analytics" || value === "google_search_console";
}

function buildGoogleConfig(
  config: Record<string, string | undefined>,
  redirectUri: string,
): StoredGoogleIntegrationConfig | null {
  if (!isGoogleProvider(config.provider)) {
    return null;
  }

  const oauthClientId = config.oauthClientId?.trim();
  const oauthClientSecret = config.oauthClientSecret?.trim();
  if (!oauthClientId || !oauthClientSecret) {
    return null;
  }

  const measurementId =
    config.provider === "google_analytics"
      ? normalizeGoogleAnalyticsMeasurementId(config.measurementId)
      : undefined;
  const propertyId = config.propertyId?.trim();
  const siteUrl = config.siteUrl?.trim();

  if (
    config.provider === "google_analytics" &&
    (!measurementId || !propertyId)
  ) {
    return null;
  }

  if (config.provider === "google_search_console" && !siteUrl) {
    return null;
  }

  const googleConfig: StoredGoogleIntegrationConfig = {
    provider: config.provider,
    oauthClientId,
    oauthClientSecret,
    redirectUri,
    scopes: getGoogleIntegrationScopes(config.provider),
  };

  if (measurementId) {
    googleConfig.measurementId = measurementId;
  }
  if (propertyId) {
    googleConfig.propertyId = propertyId;
  }
  if (siteUrl) {
    googleConfig.siteUrl = siteUrl;
  }

  return googleConfig;
}

/**
 * GET /api/v1/integrations
 * List all integrations
 */
export const GET = createApiHandler({
  auth: "user",
  handler: async ({ blogId }) => {
    const rows = await listIntegrations(blogId);
    return NextResponse.json({ data: rows.map(serializeIntegration) });
  },
});

/**
 * POST /api/v1/integrations
 * Create/connect an integration
 *
 * Pre-allocates the id before insertion so that webhook integrations can embed
 * the integration id in the endpoint path (mirrors old Firestore .doc() pattern).
 */
export const POST = createApiHandler({
  auth: "user",
  input: createIntegrationSchema,
  audit: "create_integration",
  handler: async ({ body, blogId, request }) => {
    const integrationId = nanoid();

    const webhookConfig =
      body.type === "webhook"
        ? buildWebhookIntegrationConfig({
            integrationId,
            siteUrl: resolvePublicSiteUrl(),
            providerHint: body.name.toLowerCase().includes("outrank")
              ? "outrank"
              : "generic",
          })
        : null;
    const googleConfig =
      body.type === "oauth" && body.config
        ? buildGoogleConfig(
            body.config,
            buildGoogleRedirectUri(request.nextUrl.origin),
          )
        : null;

    if (body.type === "oauth" && body.config?.provider && !googleConfig) {
      return NextResponse.json(
        { error: "Valid Google OAuth client settings are required" },
        { status: 400 },
      );
    }

    const storedConfig: Record<string, unknown> =
      (webhookConfig as Record<string, unknown> | null) ??
      (googleConfig as Record<string, unknown> | null) ??
      (body.config as Record<string, unknown> | undefined) ??
      {};
    const status = googleConfig ? "disconnected" : "connected";

    await createIntegrationWithId(blogId, integrationId, {
      name: body.name,
      type: body.type,
      status,
      description: body.description,
      icon: body.icon ?? body.name.charAt(0).toUpperCase(),
      config: storedConfig,
      connectedAt: googleConfig ? null : Date.now(),
    });

    return NextResponse.json(
      {
        id: integrationId,
        name: body.name,
        type: body.type,
        description: body.description,
        icon: body.icon ?? body.name.charAt(0).toUpperCase(),
        status,
        config: isGoogleIntegrationConfig(storedConfig)
          ? redactGoogleIntegrationConfig(storedConfig)
          : storedConfig,
      },
      { status: 201 },
    );
  },
});

/**
 * DELETE /api/v1/integrations
 * Bulk delete integrations
 */
export const DELETE = createApiHandler({
  auth: "user",
  input: bulkDeleteSchema,
  audit: "delete_integrations",
  handler: async ({ body, blogId }) => {
    await deleteIntegrations(blogId, body.ids);
    return NextResponse.json({ deleted: body.ids.length });
  },
});
