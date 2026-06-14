/**
 * API Keys API
 *
 * GET    /api/v1/api-keys -- List API keys for the current user
 * POST   /api/v1/api-keys -- Create a new API key
 * DELETE /api/v1/api-keys -- Bulk revoke/delete API keys
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { createApiHandler } from "@/lib/create-api-handler";
import {
  createApiKey,
  deleteApiKeys,
  listApiKeys,
} from "@/lib/api-keys/repository";

const createApiKeySchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  scopes: z
    .array(z.enum(["read", "write", "admin"]))
    .min(1, "At least one scope is required")
    .default(["read"]),
});

const bulkDeleteSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, "At least one ID is required"),
});

/**
 * GET /api/v1/api-keys
 * List API keys for the current user
 */
export const GET = createApiHandler({
  auth: "user",
  handler: async ({ session }) => {
    const data = await listApiKeys(session.uid);
    return NextResponse.json({ data });
  },
});

/**
 * POST /api/v1/api-keys
 * Create a new API key. The full key is returned ONLY in this response.
 */
export const POST = createApiHandler({
  auth: "user",
  input: createApiKeySchema,
  audit: "create_api_key",
  handler: async ({ body, session, blogId }) => {
    const result = await createApiKey(session.uid, blogId, {
      name: body.name,
      scopes: body.scopes,
    });
    return NextResponse.json(result, { status: 201 });
  },
});

/**
 * DELETE /api/v1/api-keys
 * Bulk revoke/delete API keys
 */
export const DELETE = createApiHandler({
  auth: "user",
  input: bulkDeleteSchema,
  audit: "delete_api_keys",
  handler: async ({ body, session }) => {
    const deleted = await deleteApiKeys(session.uid, body.ids);
    return NextResponse.json({ deleted });
  },
});
