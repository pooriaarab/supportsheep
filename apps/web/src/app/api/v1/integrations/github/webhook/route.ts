import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { articles } from "@/db/schema/articles";
import { nanoid } from "nanoid";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { createLogger } from "@/lib/logger";
import { timingSafeEqual, createHmac } from "node:crypto";

const log = createLogger("api:integrations:github:webhook");

async function verifyGitHubSignature(
  req: Request,
  body: string,
): Promise<boolean> {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) return false;

  const signature = req.headers.get("x-hub-signature-256");
  if (!signature) return false;

  const expected = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;

  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

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

  const rawBody = await req.text();

  const signatureValid = await verifyGitHubSignature(req, rawBody);
  if (!signatureValid) {
    log.warn("GitHub webhook signature verification failed");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = JSON.parse(rawBody);

    if (payload.action !== "closed" || !payload.pull_request?.merged) {
      return NextResponse.json({ message: "PR not merged" }, { status: 200 });
    }

    const pr = payload.pull_request;

    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      log.warn("ANTHROPIC_API_KEY not set — auto-docs generation skipped");
      return NextResponse.json({ error: "Missing API Key" }, { status: 500 });
    }

    const anthropic = createAnthropic({ apiKey });

    const { text: draftContent } = await generateText({
      model: anthropic("claude-sonnet-4-6"),
      system: "You are a senior technical writer for a SaaS company. Your job is to take raw GitHub Pull Request descriptions and turn them into user-facing support articles or changelog updates. The output should be strictly Markdown, professional but approachable, focusing on the value to the end user.",
      prompt: `Please write a support article for the following merged Pull Request.

PR Title: ${String(pr.title ?? "")}
PR Body: ${String(pr.body ?? "No description provided.")}
`,
    });

    const blogId = "default";

    const db = getDb();
    const articleId = nanoid();
    await db.insert(articles).values({
      id: articleId,
      blogId,
      slug: `pr-${String(pr.number)}-${Date.now()}`,
      status: "draft",
      data: JSON.stringify({
        id: articleId,
        title: `Update: ${String(pr.title ?? "")}`,
        description: `Auto-drafted support article for PR #${String(pr.number)}`,
        content: draftContent,
        markdownContent: draftContent,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    });

    return NextResponse.json({ success: true, message: "Draft generated via AI" }, { status: 201 });
  } catch (err) {
    log.error("GitHub webhook error", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
