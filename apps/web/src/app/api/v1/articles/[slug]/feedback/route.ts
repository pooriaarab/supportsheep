import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { articles } from "@/db/schema/articles";
import { eq, and } from "drizzle-orm";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { getRequestBlogId } from "@/lib/tenancy/request-blog";

/**
 * POST /api/v1/articles/[slug]/feedback
 * 
 * Ingests user feedback. If the feedback is "unhelpful", it triggers an agentic
 * background loop using Claude to rewrite the article and append it to the `draftBody`.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = await request.json();
    const blogId = await getRequestBlogId();

    if (!body || !body.type) {
      return NextResponse.json({ error: "Missing feedback type" }, { status: 400 });
    }

    if (body.type === "unhelpful") {
      // Agentic Self-Healing Loop:
      // 1. Fetch current article content
      const db = getDb();
      const rows = await db
        .select()
        .from(articles)
        .where(and(eq(articles.slug, slug), eq(articles.blogId, blogId)))
        .limit(1);

      const articleRow = rows[0];
      if (articleRow) {
        const articleData = JSON.parse(articleRow.data);
        const apiKey = process.env.ANTHROPIC_API_KEY;

        if (apiKey) {
          const anthropic = createAnthropic({ apiKey });
          
          console.info(`[Agentic] Processing unhelpful feedback for article ${slug}`);
          
          // 2. Prompt Claude to rewrite it
          const { text: improvedContent } = await generateText({
            model: anthropic("claude-3-5-sonnet-20241022"),
            system: "You are an expert customer support engineer. A user just marked the following support article as 'Unhelpful'. Your job is to completely rewrite it to be clearer, step-by-step, and explicitly address potential confusion points. Return ONLY the new Markdown content.",
            prompt: `Here is the failing article:\n\n${articleData.markdownContent || articleData.content}`,
          });

          // 3. Save the improved draft
          articleData.draftBody = improvedContent;
          articleData.updatedAt = new Date().toISOString();
          
          await db
            .update(articles)
            .set({ 
              data: JSON.stringify(articleData),
              updatedAt: new Date().toISOString()
            })
            .where(eq(articles.slug, slug));
            
          console.info(`[Agentic] Saved improved draft for ${slug}`);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Feedback ingestion error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
