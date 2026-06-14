import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { articles } from "@/db/schema/articles";
import { nanoid } from "nanoid";

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
    
    // In a real implementation, we would:
    // 1. Fetch the full PR diff from GitHub API using the installation token.
    // 2. Call Anthropic API to generate a user-facing support article.
    // 3. Look up the correct blogId based on the repository installation mapping.
    
    // For now, we simulate this by inserting a placeholder draft directly.
    const blogId = "default"; // Mocked tenant
    
    const draftContent = `
# New Feature: ${pr.title}

*Auto-generated from PR #${pr.number}*

Our team just merged a new update!

**Developer notes:**
${pr.body || "No description provided."}

---
*Supportsheep AI drafted this article based on code changes.*
    `.trim();

    const db = getDb();
    await db.insert(articles).values({
      id: nanoid(),
      blogId,
      slug: `pr-${pr.number}-${Date.now()}`,
      title: pr.title,
      description: `Auto-drafted support article for PR #${pr.number}`,
      content: draftContent,
      htmlContent: `<p>Auto-drafted support article for PR #${pr.number}</p>`,
      markdownContent: draftContent,
      status: "draft",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      publishedAt: null,
      authorId: null,
      categoryId: null,
      featuredImage: null,
      pillarClusterId: null,
    });

    return NextResponse.json({ success: true, message: "Draft generated" }, { status: 201 });
  } catch (err) {
    console.error("GitHub webhook error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}