/**
 * Single Integration API
 *
 * GET    /api/v1/integrations/:id -- Get integration details
 * PATCH  /api/v1/integrations/:id -- Update integration (status, config)
 * DELETE /api/v1/integrations/:id -- Delete integration
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createApiHandler } from "@/lib/create-api-handler";
import {
  isWebhookIntegrationConfig,
  mergeWebhookIntegrationConfigPatch,
  redactWebhookIntegrationConfig,
} from "@/lib/integrations/webhook-integration";
import {
  isGoogleIntegrationConfig,
  redactGoogleIntegrationConfig,
} from "@/lib/integrations/google-integration";
import {
  deleteIntegration,
  getIntegration,
  updateIntegration,
  type IntegrationRow,
} from "@/lib/integrations/repository";

type RouteParams = { id: string };

const updateIntegrationSchema = z.object({
  status: z.enum(["connected", "disconnected", "error"]).optional(),
  config: z.record(z.string(), z.string()).optional(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
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

/**
 * GET /api/v1/integrations/:id
 */
export const GET = createApiHandler<unknown, RouteParams>({
  auth: "user",
  handler: async ({ params, blogId }) => {
    const row = await getIntegration(blogId, params.id);
    if (!row) {
      return NextResponse.json(
        { error: "Integration not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: serializeIntegration(row) });
  },
});

/**
 * PATCH /api/v1/integrations/:id
 * Update integration status or config
 */
export const PATCH = createApiHandler<
  z.infer<typeof updateIntegrationSchema>,
  RouteParams
>({
  auth: "user",
  input: updateIntegrationSchema,
  audit: "update_integration",
  handler: async ({ body, params, blogId }) => {
    const existing = await getIntegration(blogId, params.id);
    if (!existing) {
      return NextResponse.json(
        { error: "Integration not found" },
        { status: 404 },
      );
    }

    if (body.config && "token" in body.config) {
      return NextResponse.json(
        { error: "Webhook tokens cannot be patched directly" },
        { status: 400 },
      );
    }

    // Build the merged config for webhook integrations
    let newConfig: Record<string, unknown> | undefined;
    if (body.config) {
      if (isWebhookIntegrationConfig(existing.config)) {
        newConfig = mergeWebhookIntegrationConfigPatch(
          existing.config,
          body.config as Parameters<typeof mergeWebhookIntegrationConfigPatch>[1],
        ) as Record<string, unknown>;
      } else {
        newConfig = body.config as Record<string, unknown>;
      }
    }

    // Track connect/disconnect timestamps
    const connectedAt =
      body.status === "connected" ? Date.now() : undefined;

    const updated = await updateIntegration(blogId, params.id, {
      name: body.name,
      status: body.status,
      description: body.description,
      config: newConfig,
      ...(connectedAt !== undefined ? { connectedAt } : {}),
    });

    if (!updated) {
      return NextResponse.json(
        { error: "Integration not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: serializeIntegration(updated) });
  },
});

/**
 * DELETE /api/v1/integrations/:id
 */
export const DELETE = createApiHandler<unknown, RouteParams>({
  auth: "user",
  audit: "delete_integrations",
  handler: async ({ params, blogId }) => {
    const deleted = await deleteIntegration(blogId, params.id);
    if (!deleted) {
      return NextResponse.json(
        { error: "Integration not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ deleted: true });
  },
});
