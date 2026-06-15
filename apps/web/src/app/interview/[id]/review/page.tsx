import { getInterview } from "@/lib/interviews/interviews-repository";
import { getArticleById } from "@/lib/articles/repository";
import { DEFAULT_blog_id, getMembershipByUser } from "@/lib/tenancy/repository";
import { verifySessionCached } from "@/lib/auth/session";
import { cookies } from "next/headers";
import { ReviewAdmin } from "@/components/interview/review/review-admin";
import { ReviewAuthor } from "@/components/interview/review/review-author";
import { ReviewGuest } from "@/components/interview/review/review-guest";
import { ReviewError } from "@/components/interview/review/review-error";
import { sanitizeArticleHtml } from "@/lib/sanitize/article-html";
import { coerceFirestoreTimestamps } from "@/lib/interviews/timestamp-utils";
import { createLogger } from "@/lib/logger";
import type { Article } from "@repo/types";

const log = createLogger("interviews:review");

interface PageProps {
  params: Promise<{ id: string }>;
}

type ResolvedArticle = Article & { id: string; status: string };

type ReviewView =
  | { kind: "error"; reason: "not_found" | "article_missing" | "pending" | "error" }
  | { kind: "admin"; interview: Record<string, unknown>; article: ResolvedArticle; interviewId: string }
  | { kind: "author"; interview: Record<string, unknown>; article: ResolvedArticle; interviewId: string }
  | { kind: "guest"; interview: Record<string, unknown>; article: ResolvedArticle };

/**
 * Resolve which review surface to render for a given interview id. All
 * Firestore IO + auth lookup + structured exit logging live here so the
 * component body can stay pure: it `await`s a view-model and renders the
 * corresponding component. Any exception is caught and reported as the
 * `error` view rather than bubbling into a 500 — the /review page is the
 * end-of-session landing for every guest, so a hard 500 here means the
 * guest sees a Netlify error code with a long ID instead of a friendly
 * empty/error state.
 */
async function resolveReviewView(id: string): Promise<ReviewView> {
  const startedAt = Date.now();
  let resolution: ReviewView;
  let logReason: string | undefined;

  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session");
    const session = sessionCookie ? await verifySessionCached(sessionCookie.value) : null;

    const rawInterview = await getInterview(DEFAULT_blog_id, id);
    if (!rawInterview) {
      logReason = "not_found";
      resolution = { kind: "error", reason: "not_found" };
    } else {
      // D1 dates are already epoch-ms / ISO strings, but `interview` still
      // crosses the RSC boundary into a `"use client"` component. The sweep
      // strips any residual `Date` instances (which the Next.js serializer
      // would reject *after* this function returns, where try/catch can't
      // catch it) into ISO strings, keeping the payload safe.
      const interview = coerceFirestoreTimestamps(rawInterview) as {
        articleId?: string;
        startedByUid?: string;
        startedByRole?: string;
        status?: string;
      };

      // Draft hasn't been compiled yet — show a friendly "still finalizing"
      // empty state rather than the destructive "missing" copy. The /end
      // endpoint can return a graceful pending response when saveDraft
      // fails; a guest who lands here while the article is still being
      // generated should see a refresh hint, not an error.
      if (!interview.articleId) {
        logReason = "article_pending";
        resolution = { kind: "error", reason: "pending" };
      } else {
        const articleRow = await getArticleById(
          DEFAULT_blog_id,
          interview.articleId,
        );
        if (!articleRow) {
          logReason = "article_missing";
          resolution = { kind: "error", reason: "article_missing" };
        } else {
          // Article also crosses the RSC boundary into client components;
          // sweep any residual Date instances the same way before the view.
          const rawArticle = coerceFirestoreTimestamps(
            articleRow,
          ) as ResolvedArticle;

          const article: ResolvedArticle = {
            ...rawArticle,
            body: rawArticle.body ? sanitizeArticleHtml(rawArticle.body) : rawArticle.body,
            draftBody: rawArticle.draftBody
              ? sanitizeArticleHtml(rawArticle.draftBody)
              : rawArticle.draftBody,
          };

          let role: string | undefined = undefined;
          if (session) {
            role = (await getMembershipByUser(session.uid))?.role ?? "guest";
          }

          const isAdminOrEditor = role !== undefined && ["owner", "admin", "editor"].includes(role);
          const isAuthor = session !== null && interview.startedByUid === session.uid;

          if (isAdminOrEditor) {
            resolution = { kind: "admin", interview, article, interviewId: id };
          } else if (isAuthor) {
            resolution = { kind: "author", interview, article, interviewId: id };
          } else {
            resolution = { kind: "guest", interview, article };
          }
        }
      }
    }

    log.info("/review rendered", {
      interviewId: id,
      status: resolution.kind === "error" ? "empty_state" : "rendered",
      audience: resolution.kind === "error" ? undefined : resolution.kind,
      reason: logReason,
      durationMs: Date.now() - startedAt,
    });
    return resolution;
  } catch (err: unknown) {
    log.error("/review crashed", {
      interviewId: id,
      status: "error",
      durationMs: Date.now() - startedAt,
      errorMessage: err instanceof Error ? err.message : String(err),
      errorKind: err instanceof Error ? err.name : "unknown",
      errorStack: err instanceof Error ? err.stack?.slice(0, 1500) : undefined,
    });
    return { kind: "error", reason: "error" };
  }
}

export default async function ReviewPage({ params }: PageProps) {
  const { id } = await params;
  const view = await resolveReviewView(id);

  if (view.kind === "error") {
    return <ReviewError reason={view.reason} />;
  }
  if (view.kind === "admin") {
    return <ReviewAdmin _interview={view.interview} article={view.article} interviewId={view.interviewId} />;
  }
  if (view.kind === "author") {
    return <ReviewAuthor _interview={view.interview} article={view.article} interviewId={view.interviewId} />;
  }
  return <ReviewGuest _interview={view.interview} article={view.article} />;
}
