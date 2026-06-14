import Link from "next/link";
import { Search } from "lucide-react";
import { cn } from "@repo/ui/utils";
import type { CategoryEntry } from "@repo/types";

interface CategoryWithSlug extends CategoryEntry {
  slug: string;
}

interface PublicBlogNavProps {
  categories: CategoryWithSlug[];
  activeCategory?: string | null;
}

export function PublicBlogNav({
  categories,
  activeCategory,
}: PublicBlogNavProps) {
  return (
    <section className="border-b border-border bg-background/95">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <nav className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pb-1">
          <Link
            href="/"
            className={cn(
              "inline-flex shrink-0 items-center rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
              !activeCategory
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-primary",
            )}
          >
            All Posts
          </Link>
          {categories.map((category) => {
            const isActive = activeCategory === category.slug;
            return (
              <Link
                key={category.slug}
                href={`/category/${category.slug}`}
                className={cn(
                  "inline-flex shrink-0 items-center rounded-full border px-3 py-1.5 text-sm transition-colors",
                  isActive
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-primary",
                )}
              >
                {category.displayName}
              </Link>
            );
          })}
        </nav>

        <Link
          href="/blog/search"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary"
          aria-label="Search articles"
        >
          <Search className="size-4" />
        </Link>
      </div>
    </section>
  );
}
