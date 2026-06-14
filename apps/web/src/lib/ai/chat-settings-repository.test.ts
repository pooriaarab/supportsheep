import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { beforeEach, describe, expect, it } from "vitest";

import * as schema from "@/db/schema";

import { DEFAULT_AI_CHAT_SETTINGS, getAiChatSettings, updateAiChatSettings } from "./chat-settings-repository";

type TestDb = NonNullable<Parameters<typeof getAiChatSettings>[1]>;

async function makeDb(): Promise<TestDb> {
  const client = createClient({ url: ":memory:" });
  await client.execute(`
    CREATE TABLE ai_chat_settings (
      blog_id text PRIMARY KEY NOT NULL,
      data text NOT NULL,
      updated_at integer NOT NULL
    );
  `);
  return drizzle(client, { schema }) as unknown as TestDb;
}

describe("chat-settings-repository", () => {
  let db!: TestDb;
  beforeEach(async () => {
    db = await makeDb();
  });

  it("returns code defaults when no row exists", async () => {
    const settings = await getAiChatSettings("blog-1", db);
    expect(settings).toEqual(DEFAULT_AI_CHAT_SETTINGS);
  });

  it("update round-trip: persists and reads back", async () => {
    await updateAiChatSettings("blog-1", { model: "claude-opus-4-5", temperature: 0.5 }, db);
    const settings = await getAiChatSettings("blog-1", db);
    expect(settings.model).toBe("claude-opus-4-5");
    expect(settings.temperature).toBe(0.5);
    // Unchanged fields stay as defaults
    expect(settings.maxTokens).toBe(DEFAULT_AI_CHAT_SETTINGS.maxTokens);
    expect(settings.systemPrompt).toBe(DEFAULT_AI_CHAT_SETTINGS.systemPrompt);
  });

  it("subsequent updates merge correctly (patch semantics)", async () => {
    await updateAiChatSettings("blog-1", { model: "claude-opus-4-5" }, db);
    await updateAiChatSettings("blog-1", { temperature: 0.3 }, db);
    const settings = await getAiChatSettings("blog-1", db);
    expect(settings.model).toBe("claude-opus-4-5");
    expect(settings.temperature).toBe(0.3);
  });

  it("blog isolation: blog-a settings do not affect blog-b", async () => {
    await updateAiChatSettings("blog-a", { model: "custom-model" }, db);
    const blogBSettings = await getAiChatSettings("blog-b", db);
    expect(blogBSettings).toEqual(DEFAULT_AI_CHAT_SETTINGS);
  });

  it("updateAiChatSettings returns the merged settings", async () => {
    const result = await updateAiChatSettings("blog-1", { maxTokens: 2048 }, db);
    expect(result.maxTokens).toBe(2048);
    expect(result.model).toBe(DEFAULT_AI_CHAT_SETTINGS.model);
  });
});
