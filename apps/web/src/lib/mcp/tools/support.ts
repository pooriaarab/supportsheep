import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v3";
import { listArticles } from "@/lib/articles/repository";
import { textResult } from "./shared";
import type { McpToolContext } from "./context";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { createLogger } from "@/lib/logger";

const log = createLogger("mcp:support");

export function registerSupportTools(
  server: McpServer,
  { blogId }: McpToolContext,
) {
  server.tool(
    "troubleshoot_issue",
    "Acts as an agentic customer support tool. It searches the knowledge base for a solution to the provided query and synthesizes a step-by-step resolution.",
    {
      query: z
        .string()
        .describe("The customer's problem or question (e.g. 'How do I reset my password?')"),
    },
    async ({ query }) => {
      const { articles } = await listArticles(blogId, {
        limit: 5,
        search: query,
        status: "published",
      });

      if (articles.length === 0) {
        return textResult({
          resolution: "No relevant support articles found in the knowledge base.",
          articles_checked: [],
        });
      }

      const contentPool = articles
        .map((a) => `--- Title: ${a.title} ---\n\n${a.body || a.draftBody}`)
        .join("\n\n");

      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        log.warn("ANTHROPIC_API_KEY not set, returning raw search results");
        return textResult({
          resolution: "AI synthesis unavailable. Please review the attached articles.",
          articles_checked: articles.map((a) => a.slug),
        });
      }

      const anthropic = createAnthropic({ apiKey });
      const { text: resolution } = await generateText({
        model: anthropic("claude-sonnet-4-6"),
        system: "You are an expert customer support agent. Answer the user's troubleshooting query ONLY using the provided Knowledge Base context. Provide a clear, step-by-step resolution.",
        prompt: `Query: ${query}\n\nKnowledge Base Content:\n${contentPool}`,
      });

      return textResult({
        resolution,
        articles_checked: articles.map((a) => a.slug),
      });
    },
  );
}
