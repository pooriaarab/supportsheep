"use client";

import { useCallback, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Loader2, Search } from "lucide-react";
import type { ResolvedPublicArticleTheme } from "@/lib/public-article-theme";
import { Input } from "@repo/ui/primitives/input";
import { trackAnalyticsEvent } from "@/lib/analytics/events";
import { getArticlePath } from "@/lib/permalinks";
import { cn } from "@/lib/utils";

interface SearchResult {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  publishedAt: string | null;
  author: string;
  readingTime: number;
  featuredImage: string;
  featuredImageAlt: string;
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "";
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface PublicSearchPageProps {
  articleTheme?: ResolvedPublicArticleTheme;
}

export function PublicSearchPage({ articleTheme }: PublicSearchPageProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = useCallback(async (nextQuery: string) => {
    setQuery(nextQuery);
    if (nextQuery.trim().length < 2) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(nextQuery.trim())}`,
      );
      if (res.ok) {
        const json = await res.json();
        const nextResults = json.data ?? [];
        setResults(nextResults);
        trackAnalyticsEvent("blog_search", {
          search_term: nextQuery.trim(),
          result_count: nextResults.length,
        });
      }
    } finally {
      setIsLoading(false);
      setHasSearched(true);
    }
  }, []);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="rounded-[2rem] border border-border bg-card px-6 py-8 shadow-[0_24px_80px_-52px_rgba(20,24,35,0.5)] sm:px-8">
        <h1 className="font-[family:var(--font-plus-jakarta-sans)] text-3xl font-semibold text-foreground sm:text-4xl">
          Search Articles
        </h1>
        <p className="mt-3 text-base leading-8 text-muted-foreground">
          Search published articles by title, category, tags, or body copy.
        </p>

        <div className="relative mt-8">
          <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by title, content, tags..."
            value={query}
            onChange={(event) => handleSearch(event.target.value)}
            className="h-12 rounded-full border-border bg-background pl-11 pr-11"
          />
          {isLoading ? (
            <Loader2 className="absolute right-4 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          ) : null}
        </div>
      </div>

      {hasSearched && results.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">
          No articles found for &ldquo;{query}&rdquo;.
        </p>
      ) : null}

      {results.length > 0 ? (
        <div className="mt-8 space-y-4">
          <p className="text-sm text-muted-foreground">
            {results.length} {results.length === 1 ? "result" : "results"} found
          </p>
          {results.map((result) => (
            <Link
              key={result.id}
              href={getArticlePath(result)}
              className={cn(
                "block border border-border bg-card p-5 transition-all duration-300",
                articleTheme?.cards.containerClassName,
                articleTheme?.cards.hoverClassName,
              )}
              style={articleTheme?.cards.containerStyle}
            >
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_160px] sm:items-start">
                <div className="min-w-0">
                  <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full bg-secondary px-3 py-1 font-semibold uppercase tracking-[0.16em] text-primary">
                      {result.category}
                    </span>
                    {result.publishedAt ? (
                      <span>{formatDate(result.publishedAt)}</span>
                    ) : null}
                    {result.readingTime > 0 ? (
                      <span>{result.readingTime} min read</span>
                    ) : null}
                  </div>
                  <h2
                    className={cn(
                      "font-semibold text-foreground",
                      articleTheme?.typography.headingFontClassName,
                      articleTheme?.typography.gridCardTitleClassName,
                    )}
                  >
                    {result.title}
                  </h2>
                  {result.excerpt ? (
                    <p
                      className={cn(
                        "mt-3 text-sm text-muted-foreground",
                        articleTheme?.typography.bodyFontClassName,
                      )}
                      style={articleTheme?.readingLayout.bodyTextStyle}
                    >
                      {result.excerpt}
                    </p>
                  ) : null}
                </div>

                {result.featuredImage ? (
                  <div
                    className={cn(
                      "relative aspect-[4/3] overflow-hidden border border-border bg-muted",
                      articleTheme?.cards.mediaClassName,
                    )}
                    style={articleTheme?.cards.mediaStyle}
                  >
                    <Image
                      src={result.featuredImage}
                      alt={result.featuredImageAlt || result.title}
                      fill
                      sizes="(min-width: 640px) 160px, 100vw"
                      className="object-cover"
                    />
                  </div>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
