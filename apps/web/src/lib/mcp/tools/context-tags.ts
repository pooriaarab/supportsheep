/**
 * MCP Context Tag Tools
 *
 * Tools for managing AI generation context and tone presets.
 */

import { z } from "zod/v3";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  listContextTags,
  getContextTag,
  createContextTag,
  updateContextTag,
  deleteContextTag,
} from "@/lib/context-tags/repository";
import { createLogger } from "@/lib/logger";
import { getErrorMessage } from "@/lib/error-utils";
import { textResult } from "./shared";
import type { McpToolContext } from "./context";

const log = createLogger("mcp:context-tags");

const articleLengthSchema = z.object({
  min: z.number().int().min(100).max(10000).default(1000),
  max: z.number().int().min(100).max(10000).default(2000),
});

const ctaSchema = z.object({
  text: z.string().max(200).default(""),
  url: z.string().max(2000).default(""),
});

const imageSettingsSchema = z.object({
  style: z.string().max(100).default("realistic"),
  colorScheme: z.string().max(100).default(""),
  count: z.number().int().min(0).max(20).default(3),
  aspectRatio: z.string().max(20).default("16:9"),
});

const contextTagFields = {
  name: z.string().min(1).max(100),
  targetAudience: z.string().max(500).default(""),
  tone: z.string().max(100).default("professional"),
  style: z.string().max(100).default("informative"),
  language: z.string().max(50).default("English"),
  articleLength: articleLengthSchema.default({ min: 1000, max: 2000 }),
  cta: ctaSchema.default({ text: "", url: "" }),
  customPrompt: z.string().max(2000).default(""),
  imageSettings: imageSettingsSchema.default({
    style: "realistic",
    colorScheme: "",
    count: 3,
    aspectRatio: "16:9",
  }),
};

export function registerContextTagTools(
  server: McpServer,
  { blogId }: McpToolContext,
) {
  server.tool("list_context_tags", "List context tags", {}, async () => {
    try {
      const tags = await listContextTags(blogId);
      return textResult({ count: tags.length, contextTags: tags });
    } catch (error: unknown) {
      log.warn("Failed to list context tags", {
        error: getErrorMessage(error),
      });
      return textResult({ count: 0, contextTags: [] });
    }
  });

  server.tool(
    "get_context_tag",
    "Get a context tag by ID",
    { id: z.string().describe("Context tag ID") },
    async ({ id }) => {
      const tag = await getContextTag(blogId, id);
      if (!tag) return textResult({ error: "Context tag not found" });
      return textResult(tag);
    },
  );

  server.tool(
    "create_context_tag",
    "Create a context tag",
    contextTagFields,
    async (input) => {
      const result = await createContextTag(blogId, input);
      return textResult({ id: result.id });
    },
  );

  server.tool(
    "update_context_tag",
    "Update a context tag",
    {
      id: z.string().describe("Context tag ID"),
      name: contextTagFields.name.optional(),
      targetAudience: contextTagFields.targetAudience.optional(),
      tone: contextTagFields.tone.optional(),
      style: contextTagFields.style.optional(),
      language: contextTagFields.language.optional(),
      articleLength: articleLengthSchema.optional(),
      cta: ctaSchema.optional(),
      customPrompt: contextTagFields.customPrompt.optional(),
      imageSettings: imageSettingsSchema.optional(),
    },
    async ({ id, ...updates }) => {
      const existing = await getContextTag(blogId, id);
      if (!existing) return textResult({ error: "Context tag not found" });

      const updated = await updateContextTag(blogId, id, updates);
      if (!updated) return textResult({ error: "Context tag not found" });

      return textResult({ id });
    },
  );

  server.tool(
    "delete_context_tag",
    "Delete a context tag",
    { id: z.string().describe("Context tag ID") },
    async ({ id }) => {
      const deleted = await deleteContextTag(blogId, id);
      if (!deleted) return textResult({ error: "Context tag not found" });

      return textResult({ deleted: true, id });
    },
  );
}
