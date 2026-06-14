import "server-only";

import { eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";

import { getDb } from "@/db";
import type * as schema from "@/db/schema";
import { aiChatSettings } from "@/db/schema/ai-chat";

type DB = DrizzleD1Database<typeof schema>;

export interface AiChatSettings {
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
}

export const DEFAULT_AI_CHAT_SETTINGS: AiChatSettings = {
  model: "claude-sonnet-4-6",
  temperature: 0.7,
  maxTokens: 1024,
  systemPrompt:
    "You are a helpful AI assistant. Provide clear, concise, and well-structured responses.",
};

/**
 * Read AI chat settings for the blog.
 * Returns DEFAULT_AI_CHAT_SETTINGS when the row is absent.
 */
export async function getAiChatSettings(
  blogId: string,
  db: DB = getDb(),
): Promise<AiChatSettings> {
  const rows = await db
    .select()
    .from(aiChatSettings)
    .where(eq(aiChatSettings.blogId, blogId))
    .limit(1);
  if (rows.length === 0) return { ...DEFAULT_AI_CHAT_SETTINGS };
  return { ...DEFAULT_AI_CHAT_SETTINGS, ...(JSON.parse(rows[0].data) as Partial<AiChatSettings>) };
}

/**
 * Upsert AI chat settings for the blog.
 * Merges over existing stored values (patch semantics).
 */
export async function updateAiChatSettings(
  blogId: string,
  patch: Partial<AiChatSettings>,
  db: DB = getDb(),
): Promise<AiChatSettings> {
  const current = await getAiChatSettings(blogId, db);
  const merged: AiChatSettings = { ...current, ...patch };
  await db
    .insert(aiChatSettings)
    .values({
      blogId,
      data: JSON.stringify(merged),
      updatedAt: Date.now(),
    })
    .onConflictDoUpdate({
      target: aiChatSettings.blogId,
      set: {
        data: JSON.stringify(merged),
        updatedAt: Date.now(),
      },
    });
  return merged;
}
