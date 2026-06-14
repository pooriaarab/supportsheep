/**
 * Grid Homepage Layout
 *
 * Featured post hero at top, 3-column responsive card grid below, pagination.
 */

import { ArticleCard } from "@/components/public/article-card";
import { PublicPagination } from "@/components/public/pagination";
import type { ResolvedPublicArticleTheme } from "@/lib/public-article-theme";
import type { Article } from "@repo/types";

interface GridLayoutProps {
  articles: (Article & { id: string })[];
  page: number;
  hasMore: boolean;
  basePath?: string;
  heading: string;
  description?: string;
  articleTheme?: ResolvedPublicArticleTheme;
}

export function GridLayout({
  articles,
  page,
  hasMore,
  basePath = "/",
  heading,
  description,
  articleTheme,
}: GridLayoutProps) {
  const featured = articles[0];
  const rest = articles.slice(1);

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
      {featured && (
        <section className="mb-10">
          <ArticleCard
            article={featured}
            variant="featured"
            articleTheme={articleTheme}
          />
        </section>
      )}

      {rest.length > 0 && (
        <section className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {rest.map((article) => (
            <ArticleCard
              key={article.id}
              article={article}
              articleTheme={articleTheme}
            />
          ))}
        </section>
      )}

      <PublicPagination page={page} hasMore={hasMore} basePath={basePath} />
    </div>
  );
}
