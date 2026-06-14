/**
 * AI Chat Config API
 *
 * GET /api/v1/ai/chat/config -- Read AI chat settings from D1
 * PUT /api/v1/ai/chat/config -- Save AI chat settings to D1
 *
 * Settings are stored in the ai_chat_settings D1 table (blog_id PK).
 * The AI chat endpoint reads these settings when processing messages.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createApiHandler } from "@/lib/create-api-handler";
import {
  getAiChatSettings,
  updateAiChatSettings,
} from "@/lib/ai/chat-settings-repository";

const aiChatConfigSchema = z.object({
  systemPrompt: z.string().max(5_000),
  model: z.string().min(1).max(100),
  temperature: z.number().min(0).max(1),
  maxTokens: z.number().int().min(64).max(4096),
});

/**
 * GET /api/v1/ai/chat/config
 * Read the AI chat configuration.
 */
export const GET = createApiHandler({
  auth: "user",
  handler: async ({ blogId }) => {
    const data = await getAiChatSettings(blogId);
    return NextResponse.json({ data });
  },
});

/**
 * PUT /api/v1/ai/chat/config
 * Save the AI chat configuration.
 */
export const PUT = createApiHandler({
  auth: "user",
  input: aiChatConfigSchema,
  audit: "settings_updated",
  handler: async ({ body, blogId }) => {
    const updated = await updateAiChatSettings(blogId, body);
    return NextResponse.json({ data: updated, updated: true });
  },
});
