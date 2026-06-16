import type { Article } from "@repo/types";
import { listPublishedArticles } from "@/lib/articles/repository";
import { getBlogConfig } from "@/lib/blog-config";
import { getErrorMessage } from "@/lib/error-utils";
import { createLogger } from "@/lib/logger";
import { normalizePathname } from "@/lib/normalize-pathname";
import { getArticlePath, isReservedRootSlug } from "@/lib/permalinks";
import { resolvePublicSiteUrl } from "@/lib/public-site";
import {
  getPublicArticleBySlug,
  getPublicCategoryArticles,
  getPublicCategoryInfo,
  resolveCategorySlug,
} from "@/lib/public-route-resolution";
import { DEFAULT_blog_id } from "@/lib/tenancy/repository";

const log = createLogger("lib:markdown-for-agents");
const MAX_MARKDOWN_PAGE = 100;

export type MarkdownArticle = {
  title: string;
  url: string;
  excerpt?: string;
};

type MarkdownRoute =
  | { kind: "homepage"; pathname: "/" }
  | { kind: "blog-index"; pathname: "/blog" }
  | { kind: "docs"; pathname: "/docs" }
  | { kind: "category"; pathname: string; categorySegment: string }
  | { kind: "article"; pathname: string; slug: string }
  | { kind: "unsupported"; pathname: string };

export type MarkdownRenderResult = {
  status: number;
  markdown: string;
};

const DOCS_SECTIONS = [
  {
    title: "Getting Started",
    description:
      "Learn how to set up the project, configure your environment, and deploy your first app.",
  },
  {
    title: "API Reference",
    description:
      "Complete reference for all API endpoints including authentication, items, users, and tasks.",
  },
  {
    title: "Components",
    description:
      "Browse the full UI component library with usage examples, props, and design guidelines.",
  },
  {
    title: "Guides",
    description:
      "Step-by-step tutorials for common workflows like adding integrations, custom themes, and more.",
  },
] as const;

export function renderHomepageMarkdown(input: {
  siteName: string;
  siteDescription: string;
  articles: MarkdownArticle[];
}) {
  const lines = [`# ${input.siteName}`, "", input.siteDescription, ""];

  for (const article of input.articles) {
    lines.push(`## ${article.title}`);
    lines.push("");
    lines.push(article.url);
    lines.push("");
    if (article.excerpt) {
      lines.push(article.excerpt);
      lines.push("");
    }
  }

  return `${lines.join("\n").trim()}\n`;
}

export async function renderMarkdownForPath(
  pathname: string,
  searchParams: URLSearchParams,
  blogId: string = DEFAULT_blog_id,
): Promise<MarkdownRenderResult> {
  const route = resolveMarkdownRoute(pathname);

  if (route.kind === "unsupported") {
    return renderNotFoundMarkdown(route.pathname);
  }

  if (route.kind === "docs") {
    return {
      status: 200,
      markdown: renderDocsMarkdown(),
    };
  }

  if (route.kind === "article") {
    return renderArticleMarkdownBySlug(route.slug, blogId);
  }

  if (route.kind === "category") {
    return renderCategoryMarkdownBySlug(
      route.categorySegment,
      searchParams,
      blogId,
    );
  }

  const config = await getBlogConfig(blogId);
  const page = parsePageParam(searchParams);
  const perPage = Math.max(1, config.homepage.postsPerPage || 12);
  const siteUrl = resolvePublicSiteUrl();
  const articles = await fetchHomepageArticles(page, perPage, siteUrl, blogId);

  return {
    status: 200,
    markdown: renderHomepageMarkdown({
      siteName:
        route.kind === "homepage" ? config.siteName : `${config.siteName} Blog`,
      siteDescription: config.siteDescription,
      articles,
    }),
  };
}

export function resolveMarkdownRoute(pathname: string): MarkdownRoute {
  const normalizedPathname = normalizePathname(pathname);

  if (!normalizedPathname.startsWith("/")) {
    return {
      kind: "unsupported",
      pathname: normalizedPathname,
    };
  }

  if (normalizedPathname === "/") {
    return { kind: "homepage", pathname: "/" };
  }

  if (normalizedPathname === "/blog") {
    return { kind: "blog-index", pathname: "/blog" };
  }

  if (normalizedPathname === "/docs") {
    return { kind: "docs", pathname: "/docs" };
  }

  const segments = normalizedPathname.split("/").filter(Boolean);
  if (segments[0] === "category" && segments.length === 2 && segments[1]) {
    return {
      kind: "category",
      pathname: normalizedPathname,
      categorySegment: segments[1],
    };
  }

  if (segments.length === 1 && !isReservedRootSlug(segments[0])) {
    return {
      kind: "article",
      pathname: normalizedPathname,
      slug: segments[0],
    };
  }

  return {
    kind: "unsupported",
    pathname: normalizedPathname,
  };
}

function parsePageParam(searchParams: URLSearchParams): number {
  const rawValue = searchParams.get("page");
  const parsed = Number(rawValue);
  if (Number.isFinite(parsed) && parsed >= 1) {
    return Math.min(MAX_MARKDOWN_PAGE, Math.floor(parsed));
  }
  return 1;
}

async function fetchHomepageArticles(
  page: number,
  perPage: number,
  siteUrl: string,
  blogId: string,
): Promise<MarkdownArticle[]> {
  const offset = (page - 1) * perPage;

  try {
    const { articles } = await listPublishedArticles(blogId, {
      limit: perPage,
      offset,
    });

    return articles.map((article) => {
      const excerpt = article.excerpt?.trim();
      return {
        title: article.title,
        url: `${siteUrl}${getArticlePath(article)}`,
        excerpt: excerpt || undefined,
      };
    });
  } catch (error) {
    log.warn("Failed to fetch homepage markdown articles", {
      error: getErrorMessage(error),
      page,
      perPage,
    });
    return [];
  }
}

function renderNotFoundMarkdown(pathname: string): MarkdownRenderResult {
  return {
    status: 404,
    markdown: `# Not Found\n\nNo markdown representation is available for \`${pathname}\`.\n`,
  };
}

function renderDocsMarkdown(): string {
  const lines = [
    "# Documentation",
    "",
    "Everything you need to build with the platform.",
    "",
  ];

  for (const section of DOCS_SECTIONS) {
    lines.push(`## ${section.title}`);
    lines.push("");
    lines.push(section.description);
    lines.push("");
  }

  return `${lines.join("\n").trim()}\n`;
}

async function renderCategoryMarkdownBySlug(
  categorySegment: string,
  searchParams: URLSearchParams,
  blogId: string,
): Promise<MarkdownRenderResult> {
  const canonicalCategory = resolveCategorySlug(categorySegment);
  let info: Awaited<ReturnType<typeof getPublicCategoryInfo>> | null = null;

  try {
    info = await getPublicCategoryInfo(canonicalCategory, blogId);
  } catch (error) {
    log.warn("Failed to fetch category markdown metadata", {
      category: canonicalCategory,
      error: getErrorMessage(error),
    });
  }

  if (!info) {
    return renderNotFoundMarkdown(`/category/${canonicalCategory}`);
  }

  const page = parsePageParam(searchParams);
  const perPage = 12;
  const siteUrl = resolvePublicSiteUrl();
  let articles: Awaited<
    ReturnType<typeof getPublicCategoryArticles>
  >["articles"] = [];

  try {
    const result = await getPublicCategoryArticles(
      {
        slug: canonicalCategory,
        displayName: info.displayName,
      },
      page,
      perPage,
      blogId,
    );
    articles = result.articles;
  } catch (error) {
    log.warn("Failed to fetch category markdown articles", {
      category: info.displayName,
      page,
      perPage,
      error: getErrorMessage(error),
    });
  }

  const markdownArticles = articles.map((article) =>
    toMarkdownArticle(article, siteUrl),
  );

  const lines = [
    `# ${info.displayName}`,
    "",
    info.description || "",
    "",
    `${siteUrl}/category/${canonicalCategory}`,
    "",
  ];

  for (const article of markdownArticles) {
    lines.push(`## ${article.title}`);
    lines.push("");
    lines.push(article.url);
    lines.push("");
    if (article.excerpt) {
      lines.push(article.excerpt);
      lines.push("");
    }
  }

  return {
    status: 200,
    markdown: `${lines.join("\n").trim()}\n`,
  };
}

async function renderArticleMarkdownBySlug(
  slug: string,
  blogId: string,
): Promise<MarkdownRenderResult> {
  if (isReservedRootSlug(slug)) {
    return renderNotFoundMarkdown(`/${slug}`);
  }

  let article: Awaited<ReturnType<typeof getPublicArticleBySlug>> | null = null;

  try {
    article = await getPublicArticleBySlug(slug, blogId);
  } catch (error) {
    log.warn("Failed to fetch article markdown content", {
      slug,
      error: getErrorMessage(error),
    });
  }

  if (!article) {
    return renderNotFoundMarkdown(`/${slug}`);
  }

  const siteUrl = resolvePublicSiteUrl();
  const excerpt = article.excerpt?.trim();
  const body = stripHtml(article.body || "");
  const lines = [
    `# ${article.title}`,
    "",
    `${siteUrl}${getArticlePath(article)}`,
    "",
  ];

  if (article.category) {
    lines.push(`Category: ${article.category}`);
    lines.push("");
  }

  if (article.publishedAt) {
    lines.push(`Published: ${article.publishedAt}`);
    lines.push("");
  }

  if (excerpt) {
    lines.push(excerpt);
    lines.push("");
  }

  if (body) {
    lines.push(body);
    lines.push("");
  }

  return {
    status: 200,
    markdown: `${lines.join("\n").trim()}\n`,
  };
}

function toMarkdownArticle(
  article: Pick<
    Article,
    "title" | "excerpt" | "slug" | "category" | "canonicalPath"
  >,
  siteUrl: string,
): MarkdownArticle {
  return {
    title: article.title,
    url: `${siteUrl}${getArticlePath(article)}`,
    excerpt: article.excerpt?.trim() || undefined,
  };
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
