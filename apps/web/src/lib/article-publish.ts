import type { Article, BlogConfig } from "@repo/types";
import { sanitizeArticleHtml } from "@/lib/sanitize/article-html";
import { getArticlePath } from "@/lib/permalinks";
import { resolvePublicSiteUrl } from "@/lib/public-site";
import { resolveIndexNowSubmissionStatus } from "@/lib/seo/indexnow";

interface PreparePublishedArticleUpdateInput {
  article: Pick<
    Article,
    | "slug"
    | "category"
    | "canonicalPath"
    | "body"
    | "draftBody"
    | "submissionStatus"
  >;
  config: Pick<BlogConfig, "seo">;
  siteUrl?: string;
}

export async function preparePublishedArticleUpdate({
  article,
  config,
  siteUrl = resolvePublicSiteUrl(),
}: PreparePublishedArticleUpdateInput) {
  const rawPublishBody = article.draftBody || article.body;
  const publishBody = sanitizeArticleHtml(String(rawPublishBody || ""));
  const wordCount = publishBody.split(/\s+/).filter(Boolean).length;
  const articleUrl = `${siteUrl}${getArticlePath(article)}`;
  const indexNow = await resolveIndexNowSubmissionStatus({
    config,
    siteUrl,
    url: articleUrl,
  });

  return {
    body: publishBody,
    wordCount,
    readingTime: Math.max(1, Math.ceil(wordCount / 200)),
    submissionStatus: {
      ...(article.submissionStatus ?? {}),
      indexNow,
    },
  };
}
