"use client";

import type { FreeTool, FreeToolCategory } from "@repo/types";
import Link from "next/link";
import { useMemo, useState } from "react";

const CATEGORY_LABELS: Record<FreeToolCategory, string> = {
  seo: "SEO",
  writing: "Writing",
  social: "Social",
  schema: "Schema",
  utility: "Utility",
  business: "Business",
  aeo_geo: "AEO/GEO",
};

interface ToolIndexProps {
  tools: Array<
    Pick<
      FreeTool,
      "id" | "slug" | "title" | "metaDescription" | "templateId"
    > & {
      category: FreeToolCategory;
    }
  >;
}

export function ToolIndex({ tools }: ToolIndexProps) {
  const [search, setSearch] = useState("");
  const filteredTools = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) {
      return tools;
    }
    return tools.filter(
      (tool) =>
        tool.title.toLowerCase().includes(needle) ||
        tool.metaDescription.toLowerCase().includes(needle) ||
        tool.slug.toLowerCase().includes(needle),
    );
  }, [search, tools]);

  const groupedTools = useMemo(() => {
    return filteredTools.reduce<
      Partial<Record<FreeToolCategory, typeof filteredTools>>
    >((groups, tool) => {
      const next = groups[tool.category] ?? [];
      next.push(tool);
      groups[tool.category] = next;
      return groups;
    }, {});
  }, [filteredTools]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="max-w-3xl">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Free Tools
        </h1>
        <p className="mt-4 text-lg leading-8 text-muted-foreground">
          Practical SEO, writing, schema, and business utilities for improving
          pages before you publish.
        </p>
      </div>

      <div className="mt-8 max-w-xl">
        <label className="sr-only" htmlFor="free-tools-search">
          Search tools
        </label>
        <input
          id="free-tools-search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search tools"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background transition-shadow placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2"
        />
      </div>

      <div className="mt-10 space-y-10">
        {Object.entries(groupedTools).map(([category, categoryTools]) => (
          <section key={category} className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {CATEGORY_LABELS[category as FreeToolCategory]}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {categoryTools.map((tool) => (
                <Link
                  key={tool.id}
                  href={`/tools/${tool.slug}`}
                  className="block rounded-lg border border-border bg-card p-4 text-card-foreground no-underline transition-colors hover:bg-muted/50"
                >
                  <h3 className="text-base font-semibold">{tool.title}</h3>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">
                    {tool.metaDescription}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        ))}
        {filteredTools.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
            No tools match this search.
          </p>
        ) : null}
      </div>
    </div>
  );
}
