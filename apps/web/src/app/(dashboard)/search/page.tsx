"use client";

import { useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, FileText, Users, Settings } from "lucide-react";
import { PageHeader } from "@/components/ui/layout/page-header";
import { Input } from "@repo/ui/primitives/input";
import { EmptyState } from "@repo/ui/composites/empty-state";
import { useUsersQuery, type AppUser } from "@/hooks/use-users-query";
import { useQuery } from "@tanstack/react-query";
import { useMountEffect } from "@/hooks/use-mount-effect";

// ---------------------------------------------------------------------------
// Result group types
// ---------------------------------------------------------------------------

interface SearchResultGroup {
  type: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  results: SearchResult[];
}

interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  href: string;
}

// ---------------------------------------------------------------------------
// Search helpers
// ---------------------------------------------------------------------------

function matchesQuery(text: string | undefined, query: string): boolean {
  if (!text) return false;
  return text.toLowerCase().includes(query);
}

interface Article {
  id: string;
  slug: string;
  title: string;
  status: string;
  category: string;
}

async function fetchArticles(): Promise<Article[]> {
  const res = await fetch("/api/v1/articles?limit=100");
  if (!res.ok) return [];
  const json = await res.json();
  return json.data ?? [];
}

function searchArticles(articles: Article[], query: string): SearchResult[] {
  return articles
    .filter((article) => matchesQuery(article.title, query))
    .slice(0, 10)
    .map((article) => ({
      id: article.id,
      title: article.title,
      subtitle: `${article.status} - ${article.category || "uncategorized"}`,
      href: `/posts/${encodeURIComponent(article.slug)}`,
    }));
}

function searchUsers(users: AppUser[], query: string): SearchResult[] {
  return users
    .filter(
      (user) =>
        matchesQuery(user.name, query) ||
        matchesQuery(user.email, query) ||
        matchesQuery(user.role, query),
    )
    .slice(0, 10)
    .map((user) => ({
      id: user.id,
      title: user.name,
      subtitle: user.email,
      href: `/users/${encodeURIComponent(user.id)}`,
    }));
}

// Static pages that can be navigated to
const STATIC_PAGES: SearchResult[] = [
  { id: "dashboard", title: "Dashboard", href: "/dashboard" },
  {
    id: "Articles",
    title: "Articles",
    subtitle: "View all blog posts",
    href: "/posts",
  },
  {
    id: "categories",
    title: "Categories",
    subtitle: "Manage categories",
    href: "/categories",
  },
  { id: "media", title: "Media", subtitle: "Media library", href: "/media" },
  {
    id: "generate",
    title: "Generate",
    subtitle: "AI content generation",
    href: "/generate",
  },
  {
    id: "seo",
    title: "SEO Analytics",
    subtitle: "SEO scores and insights",
    href: "/seo/analytics",
  },
  {
    id: "settings",
    title: "Settings",
    subtitle: "App configuration",
    href: "/settings",
  },
];

function searchPages(query: string): SearchResult[] {
  return STATIC_PAGES.filter(
    (page) =>
      matchesQuery(page.title, query) || matchesQuery(page.subtitle, query),
  );
}

// ---------------------------------------------------------------------------
// SearchPage
// ---------------------------------------------------------------------------

export default function SearchPage() {
  const { push } = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");

  const { data: articles = [] } = useQuery({
    queryKey: ["search-articles"],
    queryFn: fetchArticles,
  });
  const { data: users = [] } = useUsersQuery();

  useMountEffect(() => {
    inputRef.current?.focus();
  });

  const groups = useMemo<SearchResultGroup[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const result: SearchResultGroup[] = [];

    const pageResults = searchPages(q);
    if (pageResults.length > 0) {
      result.push({
        type: "pages",
        label: "Pages",
        icon: Settings,
        results: pageResults,
      });
    }

    const articleResults = searchArticles(articles, q);
    if (articleResults.length > 0) {
      result.push({
        type: "articles",
        label: "Articles",
        icon: FileText,
        results: articleResults,
      });
    }

    const userResults = searchUsers(users, q);
    if (userResults.length > 0) {
      result.push({
        type: "users",
        label: "Users",
        icon: Users,
        results: userResults,
      });
    }

    return result;
  }, [query, articles, users]);

  const totalResults = groups.reduce((sum, g) => sum + g.results.length, 0);

  return (
    <div className="h-full flex flex-col">
      <PageHeader breadcrumbs={[{ label: "Search" }]} />

      <div className="border-b px-4 sm:px-6 py-4">
        <div className="relative max-w-2xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search across posts, users, and settings..."
            className="pl-10 h-10"
          />
        </div>
        {query.trim() && (
          <p className="mt-2 text-xs text-muted-foreground">
            {totalResults} result{totalResults !== 1 ? "s" : ""} found
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {!query.trim() ? (
          <div className="flex items-center justify-center py-16">
            <EmptyState
              icon={Search}
              title="Search everything"
              description="Type to search across posts, users, and settings. Use Cmd+K from anywhere to open the command palette."
            />
          </div>
        ) : groups.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <EmptyState
              icon={Search}
              title="No results"
              description={`No results found for "${query}". Try a different search term.`}
            />
          </div>
        ) : (
          <div className="max-w-2xl divide-y">
            {groups.map((group) => (
              <div key={group.type} className="py-4 px-4 sm:px-6">
                <div className="flex items-center gap-2 mb-2">
                  <group.icon className="size-4 text-muted-foreground" />
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {group.label}
                  </h3>
                  <span className="text-xs text-muted-foreground/60">
                    {group.results.length}
                  </span>
                </div>
                <div className="space-y-0.5">
                  {group.results.map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() => push(result.href)}
                      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-muted/50 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">
                          {result.title}
                        </div>
                        {result.subtitle && (
                          <div className="text-xs text-muted-foreground truncate">
                            {result.subtitle}
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
