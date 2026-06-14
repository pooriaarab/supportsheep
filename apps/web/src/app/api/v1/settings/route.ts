/**
 * Settings API
 *
 * GET /api/v1/settings -- Get current application settings
 * PATCH /api/v1/settings -- Update application settings
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createApiHandler } from "@/lib/create-api-handler";
import { getBlogSettings, updateBlogSettings } from "@/lib/settings/repository";

const updateSettingsSchema = z.object({
  appName: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  theme: z.enum(["light", "dark", "system"]).optional(),
  notifications: z
    .object({
      email: z.boolean().optional(),
      push: z.boolean().optional(),
    })
    .optional(),
  security: z
    .object({
      allowedDomains: z.array(z.string()).optional(),
      mfaRequired: z.boolean().optional(),
      sessionTimeoutMinutes: z.number().int().positive().optional(),
    })
    .optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * GET /api/v1/settings
 * Get current application settings
 */
export const GET = createApiHandler({
  auth: "user",
  handler: async ({ blogId }) => {
    const settings = await getBlogSettings(blogId);
    return NextResponse.json({ data: settings });
  },
});

/**
 * PATCH /api/v1/settings
 * Update application settings (partial update)
 */
export const PATCH = createApiHandler({
  auth: "user",
  input: updateSettingsSchema,
  audit: "settings_updated",
  handler: async ({ body, blogId }) => {
    const updated = await updateBlogSettings(blogId, body as Record<string, unknown>);
    return NextResponse.json({ data: updated, updated: true });
  },
});
