"use client";

import { useCallback, useMemo, useState, type MouseEvent } from "react";
import { useMountEffect } from "@/hooks/use-mount-effect";
import { cn } from "@/lib/utils";
import type { ArticleHeading } from "@/lib/article-body";
import type { ResolvedPublicArticleTheme } from "@/lib/public-article-theme";

interface TableOfContentsProps {
  headings: ArticleHeading[];
  theme?: ResolvedPublicArticleTheme["tableOfContents"];
}

export function TableOfContents({ headings, theme }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string | null>(
    headings[0]?.id ?? null,
  );

  const ids = useMemo(() => headings.map((h) => h.id), [headings]);

  const handleAnchorClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>, id: string) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      if (typeof window === "undefined") {
        return;
      }
      const target = document.getElementById(id);
      if (!target) {
        return;
      }
      event.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      if (window.history?.replaceState) {
        window.history.replaceState(null, "", `#${id}`);
      }
      setActiveId(id);
    },
    [],
  );

  const observe = useCallback(() => {
    if (typeof window === "undefined" || ids.length === 0) {
      return () => {};
    }

    const elements = ids.flatMap((id) => {
      const element = document.getElementById(id);
      return element ? [element] : [];
    });

    if (elements.length === 0) {
      return () => {};
    }

    const visibility = new Map<string, number>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          visibility.set(entry.target.id, entry.intersectionRatio);
        }

        let bestId: string | null = null;
        let bestRatio = 0;
        for (const [id, ratio] of visibility.entries()) {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestId = id;
          }
        }

        if (bestId && bestRatio > 0) {
          setActiveId(bestId);
        }
      },
      {
        // Favor headings that enter the top third of the viewport.
        rootMargin: "-96px 0px -60% 0px",
        threshold: [0, 0.25, 0.5, 0.75, 1],
      },
    );

    for (const element of elements) {
      observer.observe(element);
    }

    return () => observer.disconnect();
  }, [ids]);

  useMountEffect(observe);

  if (headings.length === 0 || theme?.enabled === false) {
    return null;
  }

  return (
    <nav aria-label="Table of contents" className="hidden lg:block">
      <div
        className={cn(
          "max-h-[calc(100vh-8rem)] overflow-y-auto border border-border bg-card p-6",
          theme?.containerClassName,
        )}
        style={theme?.containerStyle}
      >
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          On this page
        </p>
        <ul className="space-y-2 text-sm">
          {headings.map((heading) => {
            const isActive = heading.id === activeId;
            return (
              <li
                key={heading.id}
                className={cn(
                  heading.level === 3 && "pl-3",
                  heading.level === 4 && "pl-6",
                )}
              >
                <a
                  href={`#${heading.id}`}
                  onClick={(event) => handleAnchorClick(event, heading.id)}
                  className={cn(
                    "block rounded-md border-l-2 py-1 pl-3 leading-snug transition-colors",
                    isActive
                      ? "border-primary font-medium text-foreground"
                      : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                  )}
                >
                  {heading.text}
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
