import "server-only";

import type { Article, BlogConfig } from "@repo/types";

type IndexNowSubmissionStatus = NonNullable<
  NonNullable<Article["submissionStatus"]>["indexNow"]
>;

interface SubmitIndexNowInput {
  apiKey: string;
  siteUrl: string;
  url: string;
}

interface ResolveIndexNowSubmissionStatusInput {
  config: Pick<BlogConfig, "seo">;
  siteUrl: string;
  url: string;
}

export function getDefaultIndexNowSubmissionStatus(): IndexNowSubmissionStatus {
  return {
    status: "not_configured",
    lastSubmittedAt: null,
    lastUrl: null,
    lastError: null,
  };
}

export async function submitIndexNowUrl({
  apiKey,
  siteUrl,
  url,
}: SubmitIndexNowInput): Promise<IndexNowSubmissionStatus> {
  try {
    const response = await fetch("https://api.indexnow.org/indexnow", {
      method: "Article",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        host: new URL(siteUrl).host,
        key: apiKey,
        keyLocation: `${siteUrl}/${apiKey}.txt`,
        urlList: [url],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      return {
        status: "failed",
        lastSubmittedAt: null,
        lastUrl: url,
        lastError: `IndexNow ${response.status}: ${body || "request failed"}`,
      };
    }

    return {
      status: "submitted",
      lastSubmittedAt: new Date().toISOString(),
      lastUrl: url,
      lastError: null,
    };
  } catch (error) {
    return {
      status: "failed",
      lastSubmittedAt: null,
      lastUrl: url,
      lastError:
        error instanceof Error ? error.message : "Unknown IndexNow error",
    };
  }
}

export async function resolveIndexNowSubmissionStatus({
  config,
  siteUrl,
  url,
}: ResolveIndexNowSubmissionStatusInput): Promise<IndexNowSubmissionStatus> {
  const indexNowConfig = config.seo.submissionProtocols?.indexNow;

  if (!indexNowConfig?.enabled || !indexNowConfig.apiKey) {
    return getDefaultIndexNowSubmissionStatus();
  }

  return submitIndexNowUrl({
    apiKey: indexNowConfig.apiKey,
    siteUrl,
    url,
  });
}
