import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { articles } from "@/db/schema/articles";
import { nanoid } from "nanoid";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";

/**
 * POST /api/v1/integrations/github/webhook
 * 
 * Handles incoming GitHub webhooks. When a PR is closed (merged),
 * it triggers an AI workflow to draft a new support article based on the PR diff.
 */
export async function POST(req: Request) {
  const eventName = req.headers.get("x-github-event");
  
  if (eventName !== "pull_request") {
    return NextResponse.json({ message: "Ignored event type" }, { status: 200 });
  }

  try {
    const payload = await req.json();
    
    // We only care about merged PRs
    if (payload.action !== "closed" || !payload.pull_request.merged) {
      return NextResponse.json({ message: "PR not merged" }, { status: 200 });
    }

    const pr = payload.pull_request;
    
    // Fallback environment variable for the agent. In a real system, look this up per-tenant
    const apiKey = process.env.ANTHROPIC_API_KEY;
    
    if (!apiKey) {
      console.warn("ANTHROPIC_API_KEY not set. Auto-Docs generation skipped.");
      return NextResponse.json({ error: "Missing API Key" }, { status: 500 });
    }

    const anthropic = createAnthropic({ apiKey });

    // Call Anthropic API to generate a user-facing support article.
    const { text: draftContent } = await generateText({
      model: anthropic("claude-3-5-sonnet-20241022"),
      system: "You are a senior technical writer for a SaaS company. Your job is to take raw GitHub Pull Request descriptions and turn them into user-facing support articles or changelog updates. The output should be strictly Markdown, professional but approachable, focusing on the value to the end user.",
      prompt: `Please write a support article for the following merged Pull Request.
      
PR Title: ${pr.title}
PR Body: ${pr.body || "No description provided."}
`,
    });

    const blogId = "default"; // Mocked tenant
    
    const db = getDb();
    const articleId = nanoid();
    await db.insert(articles).values({
      id: articleId,
      blogId,
      slug: `pr-${pr.number}-${Date.now()}`,
      status: "draft",
      data: JSON.stringify({
        id: articleId,
        title: `Update: ${pr.title}`,
        description: `Auto-drafted support article for PR #${pr.number}`,
        content: draftContent,
        htmlContent: `<div class="auto-doc-generated">${draftContent.replace(/\\n/g, '<br/>')}</div>`, // simplistic markdown->html fallback
        markdownContent: draftContent,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    });

    return NextResponse.json({ success: true, message: "Draft generated via AI" }, { status: 201 });
  } catch (err) {
    console.error("GitHub webhook error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}