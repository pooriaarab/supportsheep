import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { getArticlePath, getPrimaryCategory } from "@/lib/permalinks";
import type { ResolvedPublicArticleTheme } from "@/lib/public-article-theme";
import type { Article } from "@repo/types";

interface ArticleCardProps {
  article: Article & { id: string };
  variant?: "featured" | "grid" | "list";
  articleTheme?: ResolvedPublicArticleTheme;
}

function formatDate(value: unknown): string {
  if (!value) return "";
  // Handle Firestore Timestamp objects (duck-typing to avoid SDK import)
  if (typeof value === "object" && value !== null && "toDate" in value) {
    return (value as { toDate: () => Date })
      .toDate()
      .toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
  }
  if (typeof value === "string") {
    return new Date(value).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  return "";
}

function getCategoryLabel(category: string | undefined) {
  if (!category) {
    return null;
  }

  return category.replace(/-/g, " ");
}

export function ArticleCard({
  article,
  variant = "grid",
  articleTheme,
}: ArticleCardProps) {
  const href = getArticlePath(article);
  const date = formatDate(article.publishedAt ?? article.createdAt);
  const categoryLabel = getCategoryLabel(getPrimaryCategory(article));
  const featuredImageUrl = article.featuredImage?.url ?? "";
  const featuredImageAlt = article.featuredImage?.alt || article.title;
  const cardTheme = articleTheme?.cards;
  const typography = articleTheme?.typography;

  if (variant === "featured") {
    return (
      <Link href={href} className="group block">
        <article
          className={cn(
            "overflow-hidden border border-border bg-card transition-all duration-300",
            cardTheme?.containerClassName,
            cardTheme?.hoverClassName,
          )}
          style={cardTheme?.containerStyle}
        >
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1.05fr)_minmax(280px,0.95fr)]">
            <div className="flex flex-col justify-center p-8 sm:p-10">
              {categoryLabel ? (
                <span className="mb-4 inline-flex w-fit rounded-full bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                  {categoryLabel}
                </span>
              ) : null}
              <h2
                className={cn(
                  "max-w-2xl font-semibold leading-tight text-foreground transition-colors group-hover:text-primary",
                  typography?.headingFontClassName,
                  typography?.featuredCardTitleClassName,
                )}
              >
                {article.title}
              </h2>
              {article.excerpt ? (
                <p
                  className={cn(
                    "mt-4 max-w-2xl text-base text-muted-foreground",
                    typography?.bodyFontClassName,
                  )}
                  style={articleTheme?.readingLayout.bodyTextStyle}
                >
                  {article.excerpt}
                </p>
              ) : null}
              <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span>{article.author || "BlogBat"}</span>
                {date ? <span>{date}</span> : null}
                {article.readingTime > 0 ? (
                  <span>{article.readingTime} min read</span>
                ) : null}
              </div>
            </div>

            {featuredImageUrl ? (
              <div
                className={cn(
                  "relative aspect-[4/3] overflow-hidden bg-muted lg:aspect-auto lg:h-full",
                  cardTheme?.mediaClassName,
                )}
                style={cardTheme?.mediaStyle}
              >
                <Image
                  src={featuredImageUrl}
                  alt={featuredImageAlt}
                  fill
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
            ) : (
              <div className="hidden bg-gradient-to-br from-secondary via-card to-muted lg:block" />
            )}
          </div>
        </article>
      </Link>
    );
  }

  if (variant === "list") {
    return (
      <Link href={href} className="group block">
        <article
          className={cn(
            "grid gap-5 border border-border bg-card p-5 transition-all duration-300 sm:grid-cols-[minmax(0,1fr)_220px]",
            cardTheme?.containerClassName,
            cardTheme?.hoverClassName,
          )}
          style={cardTheme?.containerStyle}
        >
          <div className="min-w-0">
            {categoryLabel ? (
              <span className="mb-3 inline-flex rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                {categoryLabel}
              </span>
            ) : null}
            <h3
              className={cn(
                "font-semibold leading-tight text-foreground transition-colors group-hover:text-primary",
                typography?.headingFontClassName,
                typography?.listCardTitleClassName,
              )}
            >
              {article.title}
            </h3>
            {article.excerpt ? (
              <p
                className={cn(
                  "mt-3 line-clamp-3 text-sm text-muted-foreground",
                  typography?.bodyFontClassName,
                )}
                style={articleTheme?.readingLayout.bodyTextStyle}
              >
                {article.excerpt}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span>{article.author || "BlogBat"}</span>
              {date ? <span>{date}</span> : null}
              {article.readingTime > 0 ? (
                <span>{article.readingTime} min read</span>
              ) : null}
            </div>
          </div>

          {featuredImageUrl ? (
            <div
              className={cn(
                "relative aspect-[4/3] overflow-hidden bg-muted",
                cardTheme?.mediaClassName,
              )}
              style={cardTheme?.mediaStyle}
            >
              <Image
                src={featuredImageUrl}
                alt={featuredImageAlt}
                fill
                sizes="(min-width: 640px) 220px, 100vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </div>
          ) : null}
        </article>
      </Link>
    );
  }

  return (
    <Link href={href} className="group block">
      <article
        className={cn(
          "flex h-full flex-col overflow-hidden border border-border bg-card transition-all duration-300",
          cardTheme?.containerClassName,
          cardTheme?.hoverClassName,
        )}
        style={cardTheme?.containerStyle}
      >
        {featuredImageUrl && (
          <div
            className={cn(
              "relative aspect-[16/10] overflow-hidden bg-muted",
              cardTheme?.mediaClassName,
            )}
            style={cardTheme?.mediaStyle}
          >
            <Image
              src={featuredImageUrl}
              alt={featuredImageAlt}
              fill
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          </div>
        )}
        <div className="flex flex-1 flex-col p-5">
          {categoryLabel ? (
            <span className="mb-3 inline-flex w-fit rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
              {categoryLabel}
            </span>
          ) : null}
          <h3
            className={cn(
              "line-clamp-2 font-semibold leading-tight text-foreground transition-colors group-hover:text-primary",
              typography?.headingFontClassName,
              typography?.gridCardTitleClassName,
            )}
          >
            {article.title}
          </h3>
          {article.excerpt ? (
            <p
              className={cn(
                "mt-3 flex-1 text-sm text-muted-foreground",
                typography?.bodyFontClassName,
              )}
              style={articleTheme?.readingLayout.bodyTextStyle}
            >
              {article.excerpt}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>{article.author || "BlogBat"}</span>
            {date ? <span>{date}</span> : null}
            {article.readingTime > 0 ? (
              <span>{article.readingTime} min read</span>
            ) : null}
          </div>
        </div>
      </article>
    </Link>
  );
}
