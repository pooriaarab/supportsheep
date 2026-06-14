/**
 * MCP Generation Tools
 *
 * Tools for generating articles from keywords using AI.
 */

import { z } from "zod/v3";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { generateFromKeyword } from "@/lib/generation/pipeline";
import type { AIProvider } from "@/lib/ai/providers";
import { generateContent } from "@/lib/ai/generate";
import { POST_TYPES, type ContentPlanPost, type PostType } from "@repo/types";
import { VOICE_GUARDRAIL } from "@/lib/generation/templates";
import { createLogger } from "@/lib/logger";
import { textResult } from "./shared";
import {
  createContentPlan,
  getContentPlan,
  listContentPlans,
} from "@/lib/content-plans/repository";
import type { McpToolContext } from "./context";

const log = createLogger("mcp:generation");

const postTypeSchema = z.enum(POST_TYPES);

const providerSchema = z.enum(["claude", "gpt", "gemini"]);

export function registerGenerationTools(
  server: McpServer,
  { blogId }: McpToolContext,
) {
  server.tool(
    "generate_article",
    "Generate a full blog article from a keyword using AI",
    {
      keyword: z
        .string()
        .min(1)
        .max(200)
        .describe("Target keyword for the article"),
      postType: z
        .enum(POST_TYPES)
        .default("blog_post")
        .describe("Type of post to generate"),
      provider: providerSchema.default("claude").describe("AI provider to use"),
      contextTagId: z
        .string()
        .optional()
        .describe("Context tag ID for tone/style configuration"),
      scheduledAt: z
        .string()
        .datetime()
        .optional()
        .describe("Optional ISO scheduled publish datetime"),
    },
    async ({ keyword, postType, provider, contextTagId, scheduledAt }) => {
      const result = await generateFromKeyword({
        keyword,
        postType,
        contextTagId,
        provider: provider as AIProvider,
        scheduledAt,
        generatedBy: "keyword",
        blogId,
      });

      return textResult({
        slug: result.slug,
        title: result.title,
        articleId: result.articleId,
        status: "draft",
      });
    },
  );

  server.tool(
    "generate_articles_bulk",
    "Generate multiple articles from keywords sequentially",
    {
      items: z
        .array(
          z.object({
            keyword: z.string().min(1).max(200),
            postType: postTypeSchema.default("blog_post"),
            contextTagId: z.string().max(200).optional(),
          }),
        )
        .min(1)
        .max(50),
      provider: providerSchema.default("claude"),
    },
    async ({ items, provider }) => {
      const results: Array<{
        keyword: string;
        status: "success" | "failed";
        slug?: string;
        title?: string;
        articleId?: string;
        error?: string;
      }> = [];

      for (const item of items) {
        try {
          const result = await generateFromKeyword({
            keyword: item.keyword,
            postType: item.postType,
            contextTagId: item.contextTagId,
            provider: provider as AIProvider,
            generatedBy: "bulk",
            blogId,
          });
          results.push({
            keyword: item.keyword,
            status: "success",
            slug: result.slug,
            title: result.title,
            articleId: result.articleId,
          });
        } catch (error: unknown) {
          const message =
            error instanceof Error ? error.message : "Generation failed";
          log.error("Bulk generation failed for keyword", {
            keyword: item.keyword,
            error: message,
          });
          results.push({
            keyword: item.keyword,
            status: "failed",
            error: message,
          });
        }
      }

      const successCount = results.filter((r) => r.status === "success").length;
      return textResult({
        results,
        summary: {
          total: results.length,
          success: successCount,
          failed: results.length - successCount,
        },
      });
    },
  );

  server.tool(
    "list_content_plans",
    "List generated content plans",
    {},
    async () => {
      const plans = await listContentPlans(blogId);
      return textResult({ count: plans.length, plans });
    },
  );

  server.tool(
    "get_content_plan",
    "Get a content plan by ID",
    { id: z.string().describe("Content plan ID") },
    async ({ id }) => {
      const plan = await getContentPlan(blogId, id);
      if (!plan) return textResult({ error: "Content plan not found" });
      return textResult(plan);
    },
  );

  server.tool(
    "generate_content_plan",
    "Generate a keyword content calendar via AI",
    {
      niche: z.string().min(1).max(300),
      duration: z.enum(["7", "14", "30"]).default("30"),
      contextTagId: z.string().max(200).optional(),
      provider: providerSchema.default("claude"),
    },
    async ({ niche, duration, contextTagId, provider }) => {
      const days = parseInt(duration);
      const planJson = await generateContent({
        provider: provider as AIProvider,
        systemPrompt: `You are a content strategist. Generate a blog content calendar as a JSON array.
Each item MUST have:
- "keyword": a specific, searchable keyword phrase (3-6 words)
- "postType": one of: ${POST_TYPES.join(", ")}

Output ONLY valid JSON. No markdown fences, no explanation. Just the array.
Example: [{"keyword": "best project management tools 2026", "postType": "listicle"}]
${VOICE_GUARDRAIL}`,
        userPrompt: `Create a ${days}-day content plan for the niche: "${niche}".
Generate exactly ${days} entries - one per day. Mix post types for variety.
Focus on keywords with strong search intent.`,
        temperature: 0.8,
        maxTokens: 4096,
      });

      let planItems: Array<{ keyword: string; postType: string }>;
      try {
        const cleaned = planJson
          .replace(/```json\s*/g, "")
          .replace(/```\s*/g, "")
          .trim();
        planItems = JSON.parse(cleaned) as Array<{
          keyword: string;
          postType: string;
        }>;
      } catch {
        return textResult({ error: "AI returned invalid plan format" });
      }

      if (!Array.isArray(planItems) || planItems.length === 0) {
        return textResult({ error: "AI returned empty plan" });
      }

      const today = new Date();
      const posts: ContentPlanPost[] = planItems
        .slice(0, days)
        .map((item, i) => {
          const date = new Date(today);
          date.setDate(date.getDate() + i + 1);
          const validType = POST_TYPES.includes(item.postType as PostType)
            ? (item.postType as PostType)
            : "blog_post";

          return {
            keyword: item.keyword || `${niche} topic ${i + 1}`,
            postType: validType,
            scheduledDate: date.toISOString().split("T")[0],
            status: "pending",
            articleSlug: null,
            contextTagId: contextTagId ?? "",
          };
        });

      const name = `${niche} - ${days}-day plan`;
      const plan = await createContentPlan(blogId, {
        name,
        status: "active",
        posts,
        provider,
      });

      return textResult({ id: plan.id, name, postCount: posts.length });
    },
  );
}
