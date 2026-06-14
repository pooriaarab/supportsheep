/**
 * Sidebar Homepage Layout
 *
 * Left sidebar with category list and post counts.
 * Main area with chronological post list and excerpts.
 */

import Link from "next/link";
import { ArticleCard } from "@/components/public/article-card";
import { PublicPagination } from "@/components/public/pagination";
import type { ResolvedPublicArticleTheme } from "@/lib/public-article-theme";
import type { Article, CategoryEntry } from "@repo/types";

interface CategoryWithSlug extends CategoryEntry {
  slug: string;
}

interface SidebarLayoutProps {
  articles: (Article & { id: string })[];
  categories: CategoryWithSlug[];
  page: number;
  hasMore: boolean;
  basePath?: string;
  heading: string;
  description?: string;
  articleTheme?: ResolvedPublicArticleTheme;
}

export function SidebarLayout({
  articles,
  categories,
  page,
  hasMore,
  basePath = "/",
  heading,
  description,
  articleTheme,
}: SidebarLayoutProps) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <header className="mb-10">
        <h1 className="font-[family:var(--font-plus-jakarta-sans)] text-3xl font-semibold text-foreground sm:text-4xl">
          {heading}
        </h1>
        {description ? (
          <p className="mt-3 max-w-2xl text-base leading-8 text-muted-foreground">
            {description}
          </p>
        ) : null}
      </header>
      <div className="flex flex-col gap-10 lg:flex-row">
        <aside className="w-full shrink-0 lg:w-72">
          <div className="sticky top-28 rounded-[1.75rem] border border-border bg-card p-6 shadow-[0_20px_50px_-44px_rgba(20,24,35,0.45)]">
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Categories
            </h3>
            <div className="space-y-2">
              <Link
                href="/"
                className="flex items-center justify-between rounded-full border border-border px-4 py-2 text-sm text-foreground transition-colors hover:border-primary/30 hover:text-primary"
              >
                <span>All Posts</span>
              </Link>
              {categories.map((cat) => (
                <Link
                  key={cat.slug}
                  href={`/category/${cat.slug}`}
                  className="flex items-center justify-between rounded-full border border-border px-4 py-2 text-sm text-foreground transition-colors hover:border-primary/30 hover:text-primary"
                >
                  <span>{cat.displayName}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {cat.postCount}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </aside>

        <div className="flex-1 min-w-0">
          <div className="space-y-6">
            {articles.map((article) => (
              <ArticleCard
                key={article.id}
                article={article}
                variant="list"
                articleTheme={articleTheme}
              />
            ))}
          </div>

          {articles.length === 0 && (
            <p className="text-center text-muted-foreground py-12">
              No articles published yet.
            </p>
          )}

          <PublicPagination page={page} hasMore={hasMore} basePath={basePath} />
        </div>
      </div>
    </div>
  );
}
