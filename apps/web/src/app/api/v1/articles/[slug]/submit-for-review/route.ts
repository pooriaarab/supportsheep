import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/create-api-handler";
import {
  getArticleBySlug,
  updateArticleBySlug,
} from "@/lib/articles/repository";
import { createNotification } from "@/lib/notifications/repository";
import { listMemberUserIdsByRoles } from "@/lib/tenancy/repository";
import { createLogger } from "@/lib/logger";

const log = createLogger("api:articles:submit-for-review");

export const POST = createApiHandler<unknown, { slug: string }>({
  auth: "user",
  audit: "submit_for_review",
  handler: async ({ params, session, blogId, role }) => {
    const slug = params?.slug;
    if (!slug) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    const article = await getArticleBySlug(blogId, slug);

    if (!article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    // Authorization: the author or an editor+ may submit. Role comes from the
    // caller's blog membership (ctx), not a Firestore user lookup.
    const isAuthor = article.authorId === session.uid;
    const isAdmin = ["owner", "admin", "editor"].includes(role ?? "");

    if (!isAuthor && !isAdmin) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    if (article.status !== "draft") {
      return NextResponse.json(
        {
          error:
            "Cannot submit article that is already published or pending review",
        },
        { status: 409 },
      );
    }

    await updateArticleBySlug(blogId, slug, { status: "pending_review" });

    // Best-effort admin notification. Must never break the status transition.
    try {
      const adminUserIds = await listMemberUserIdsByRoles(blogId, [
        "owner",
        "admin",
        "editor",
      ]);

      const articleRecord = article as unknown as Record<string, unknown>;
      const notificationPayload = {
        type: "task" as const,
        title: "New interview draft submitted for review",
        message: `A new interview draft for "${article.title || "Untitled"}" has been submitted for review.`,
        actionUrl: `/posts/${article.slug || ""}/edit?fromInterview=${articleRecord.interviewId || ""}`,
        metadata: {
          articleId: article.id,
          interviewId: String(articleRecord.interviewId || ""),
        },
      };

      await Promise.all(
        adminUserIds.map((userId) =>
          createNotification(blogId, {
            userId,
            ...notificationPayload,
          }),
        ),
      );
    } catch (err) {
      log.warn("submit-for-review: admin notification skipped", {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    return NextResponse.json({ success: true });
  },
});
