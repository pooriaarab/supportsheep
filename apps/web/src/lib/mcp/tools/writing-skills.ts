/**
 * MCP Writing Skill Tools (D1-backed)
 *
 * Tools for managing and running the AI writing skills pipeline.
 */

import { z } from "zod/v3";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  createWritingSkill,
  deleteWritingSkill,
  getWritingSkill,
  listWritingSkills,
  reorderWritingSkills,
  seedBuiltinSkills,
  updateWritingSkill,
} from "@/lib/writing-skills/repository";
import { runSkillsPipeline } from "@/lib/generation/skills";
import { createLogger } from "@/lib/logger";
import { getErrorMessage } from "@/lib/error-utils";
import { textResult } from "./shared";
import type { McpToolContext } from "./context";

const log = createLogger("mcp:writing-skills");

const providerSchema = z.enum(["claude", "gpt", "gemini"]);

const writingSkillFields = {
  name: z.string().min(1).max(100),
  description: z.string().max(500).default(""),
  prompt: z.string().min(1).max(5000),
  provider: providerSchema.default("claude"),
  model: z.string().max(100).default(""),
  enabled: z.boolean().default(true),
};

export function registerWritingSkillTools(
  server: McpServer,
  { blogId }: McpToolContext,
) {
  server.tool("list_writing_skills", "List writing skills", {}, async () => {
    try {
      await seedBuiltinSkills(blogId);
      const skills = await listWritingSkills(blogId);
      return textResult({ count: skills.length, writingSkills: skills });
    } catch (error: unknown) {
      log.warn("Failed to list writing skills", {
        error: getErrorMessage(error),
      });
      return textResult({ count: 0, writingSkills: [] });
    }
  });

  server.tool(
    "get_writing_skill",
    "Get a writing skill by ID",
    { id: z.string().describe("Writing skill ID") },
    async ({ id }) => {
      const skill = await getWritingSkill(blogId, id);
      if (!skill) return textResult({ error: "Writing skill not found" });
      return textResult(skill);
    },
  );

  server.tool(
    "create_writing_skill",
    "Create a custom writing skill",
    writingSkillFields,
    async (input) => {
      const skill = await createWritingSkill(blogId, input);
      return textResult({ id: skill.id });
    },
  );

  server.tool(
    "update_writing_skill",
    "Update a writing skill",
    {
      id: z.string().describe("Writing skill ID"),
      name: writingSkillFields.name.optional(),
      description: writingSkillFields.description.optional(),
      prompt: writingSkillFields.prompt.optional(),
      provider: providerSchema.optional(),
      model: writingSkillFields.model.optional(),
      enabled: writingSkillFields.enabled.optional(),
    },
    async ({ id, ...updates }) => {
      const updated = await updateWritingSkill(blogId, id, updates);
      if (!updated) return textResult({ error: "Writing skill not found" });
      return textResult({ id });
    },
  );

  server.tool(
    "delete_writing_skill",
    "Delete a writing skill",
    { id: z.string().describe("Writing skill ID") },
    async ({ id }) => {
      const deleted = await deleteWritingSkill(blogId, id);
      if (!deleted) return textResult({ error: "Writing skill not found" });
      return textResult({ deleted: true, id });
    },
  );

  server.tool(
    "reorder_writing_skills",
    "Set writing skill order values",
    {
      order: z
        .record(z.string(), z.number().int().min(0))
        .describe("Map of writing skill ID to order index"),
    },
    async ({ order }) => {
      await reorderWritingSkills(blogId, order);
      return textResult({ success: true });
    },
  );

  server.tool(
    "run_writing_skills",
    "Run a writing skills pipeline against content",
    {
      content: z.string().min(1).max(100000),
      skillIds: z.array(z.string().min(1)).min(1).max(20),
    },
    async ({ content, skillIds }) => {
      const result = await runSkillsPipeline(content, skillIds, blogId);
      return textResult({ content: result });
    },
  );
}
