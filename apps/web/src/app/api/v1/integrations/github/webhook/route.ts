import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createApiHandler } from "@/lib/create-api-handler";
import { getDb } from "@/db";
import { articles } from "@/db/schema/articles";
import { nanoid } from "nanoid";
import { createLogger } from "@/lib/logger";
import { sanitizeArticleHtml } from "@/lib/sanitize/article-html";

const log = createLogger("api:integrations:github:webhook");

/**
 * POST /api/v1/integrations/github/webhook
 *
 * Handles incoming GitHub webhooks. When a PR is closed (merged),
 * it triggers an AI workflow to draft a new support article based on the PR diff.
 */
export const POST = createApiHandler({
  auth: "none",
  handler: async ({ request }) => {
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!secret) {
      log.error("GITHUB_WEBHOOK_SECRET not configured");
      return NextResponse.json(
        { error: "GitHub webhook integration not configured" },
        { status: 500 },
      );
    }

    const signature = request.headers.get("x-hub-signature-256");
    if (!signature) {
      return NextResponse.json(
        { error: "Missing signature" },
        { status: 401 },
      );
    }

    const bodyText = await request.text();
    const expected =
      "sha256=" + createHmac("sha256", secret).update(bodyText).digest("hex");

    if (
      signature.length !== expected.length ||
      !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    ) {
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 },
      );
    }

    const eventName = request.headers.get("x-github-event");
    if (eventName !== "pull_request") {
      return NextResponse.json({ message: "Ignored event type" });
    }

    const payload = JSON.parse(bodyText);

    if (payload.action !== "closed" || !payload.pull_request?.merged) {
      return NextResponse.json({ message: "PR not merged" });
    }

    const pr = payload.pull_request;

    // In a real implementation, we would:
    // 1. Fetch the full PR diff from GitHub API using the installation token.
    // 2. Call Anthropic API to generate a user-facing support article.
    // 3. Look up the correct blogId based on the repository installation mapping.

    const blogId = "default";
    const prBody = pr.body || "No description provided.";

    const draftMarkdown = [
      `# New Feature: ${pr.title}`,
      "",
      `*Auto-generated from PR #${pr.number}*`,
      "",
      "Our team just merged a new update!",
      "",
      "**Developer notes:**",
      prBody,
      "",
      "---",
      "*Supportsheep AI drafted this article based on code changes.*",
    ].join("\n");

    const rawHtml = `<h1>${escapeHtml(pr.title)}</h1><p>Auto-drafted support article for PR #${pr.number}</p>`;
    const htmlContent = sanitizeArticleHtml(rawHtml);

    const db = getDb();
    const articleId = nanoid();
    await db.insert(articles).values({
      id: articleId,
      blogId,
      slug: `pr-${pr.number}-${Date.now()}`,
      status: "draft",
      data: JSON.stringify({
        id: articleId,
        title: pr.title,
        description: `Auto-drafted support article for PR #${pr.number}`,
        content: draftMarkdown,
        htmlContent,
        markdownContent: draftMarkdown,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    });

    log.info(`Draft article created for PR #${pr.number}`);
    return NextResponse.json(
      { success: true, message: "Draft generated" },
      { status: 201 },
    );
  },
});

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
