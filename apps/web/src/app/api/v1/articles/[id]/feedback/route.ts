import { NextResponse } from "next/server";
import { z } from "zod";
import { createApiHandler } from "@/lib/create-api-handler";
import { getDb } from "@/db";
import { articles } from "@/db/schema/articles";
import { eq, and } from "drizzle-orm";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { createLogger } from "@/lib/logger";

const log = createLogger("api:article-feedback");

const feedbackSchema = z.object({
  type: z.enum(["helpful", "unhelpful"]),
});

export const POST = createApiHandler<
  z.infer<typeof feedbackSchema>,
  { id: string }
>({
  auth: "none",
  input: feedbackSchema,
  rateLimit: { key: "article-feedback", maxPerMinute: 10 },
  handler: async ({ body, params, blogId }) => {
    const { id } = params;

    if (body.type === "unhelpful") {
      const db = getDb();
      const rows = await db
        .select()
        .from(articles)
        .where(and(eq(articles.id, id), eq(articles.blogId, blogId)))
        .limit(1);

      const articleRow = rows[0];
      if (articleRow) {
        const articleData = JSON.parse(articleRow.data);
        const apiKey = process.env.ANTHROPIC_API_KEY;

        if (apiKey) {
          log.info("processing unhelpful feedback", { articleId: id });

          const anthropic = createAnthropic({ apiKey });
          const { text: improvedContent } = await generateText({
            model: anthropic("claude-sonnet-4-6"),
            system:
              "You are an expert customer support engineer. A user just marked the following support article as 'Unhelpful'. Your job is to completely rewrite it to be clearer, step-by-step, and explicitly address potential confusion points. Return ONLY the new Markdown content.",
            prompt: `Here is the failing article:\n\n${articleData.markdownContent || articleData.content}`,
          });

          articleData.draftBody = improvedContent;
          articleData.updatedAt = new Date().toISOString();

          await db
            .update(articles)
            .set({
              data: JSON.stringify(articleData),
              updatedAt: new Date().toISOString(),
            })
            .where(eq(articles.id, id));

          log.info("saved improved draft", { articleId: id });
        }
      }
    }

    return NextResponse.json({ success: true });
  },
});
