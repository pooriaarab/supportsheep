import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Public API Documentation",
  description: "Read-only JSON endpoints for published BlogBat articles.",
};

const listExample = `{
  "data": [
    {
      "title": "Low Cost SEO Packages",
      "slug": "low-cost-seo-packages",
      "url": "https://blogbat.com/low-cost-seo-packages",
      "excerpt": "A concise intro.",
      "category": "Website Tips",
      "tags": ["seo", "pricing"],
      "publishedAt": "2026-04-15T00:00:00.000Z",
      "updatedAt": "2026-04-16T00:00:00.000Z",
      "readingTime": 4
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "count": 1,
    "hasMore": false
  }
}`;

const detailExample = `{
  "data": {
    "title": "Low Cost SEO Packages",
    "slug": "low-cost-seo-packages",
    "url": "https://blogbat.com/low-cost-seo-packages",
    "excerpt": "A concise intro.",
    "body": "<p>Published article HTML...</p>",
    "category": "Website Tips",
    "tags": ["seo", "pricing"],
    "author": "BlogBat",
    "publishedAt": "2026-04-15T00:00:00.000Z",
    "updatedAt": "2026-04-16T00:00:00.000Z",
    "readingTime": 4,
    "metaTitle": "Low Cost SEO Packages for Small Businesses",
    "metaDescription": "How to evaluate SEO package pricing."
  }
}`;

export default function PublicApiDocsPage() {
  return (
    <main className="space-y-10 px-6 py-10 md:px-12">
      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Public Articles API
        </p>
        <h1 className="text-3xl font-semibold text-foreground">
          Read-only endpoints
        </h1>
        <p className="text-base text-muted-foreground">
          Agents and integrations can consume these JSON endpoints to discover
          and read published BlogBat posts. All responses include the standard
          rate-limit headers and cache controls to keep automated workflows
          predictable.
        </p>
      </div>

      <section className="space-y-3 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-foreground">
          GET /api/v1/public/articles
        </h2>
        <p className="text-sm text-muted-foreground">
          Returns paginated summaries sorted by{" "}
          <q className="font-semibold">publishedAt desc</q>. This endpoint is
          ideal for bulk synchronization jobs.
        </p>
        <pre className="rounded-lg bg-muted p-4 text-sm font-mono text-foreground">
          <code>{listExample}</code>
        </pre>
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-foreground">
          GET /api/v1/public/articles/:slug
        </h2>
        <p className="text-sm text-muted-foreground">
          Returns the full public payload for one published article. It is gated
          to published slugs only.
        </p>
        <pre className="rounded-lg bg-muted p-4 text-sm font-mono text-foreground">
          <code>{detailExample}</code>
        </pre>
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-foreground">
          Supported query parameters
        </h2>
        <ul className="grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
          <li>
            <p className="font-semibold">page</p>
            <p>1-indexed page number (default 1, max 100).</p>
          </li>
          <li>
            <p className="font-semibold">limit</p>
            <p>Page size (default 20, max 50).</p>
          </li>
          <li>
            <p className="font-semibold">category</p>
            <p>Optional category slug filter.</p>
          </li>
          <li>
            <p className="font-semibold">tag</p>
            <p>Optional tag filter (case-sensitive match).</p>
          </li>
        </ul>
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-foreground">
          Rate limits &amp; errors
        </h2>
        <p className="text-sm text-muted-foreground">
          List requests are limited to 60 per minute per IP and detail requests
          to 120 per minute per IP. Successful responses include{" "}
          <code className="rounded bg-muted px-2 py-1 text-xs font-semibold text-foreground">
            X-RateLimit-Limit
          </code>
          ,
          <code className="rounded bg-muted px-2 py-1 text-xs font-semibold text-foreground">
            X-RateLimit-Remaining
          </code>
          , and{" "}
          <code className="rounded bg-muted px-2 py-1 text-xs font-semibold text-foreground">
            X-RateLimit-Reset
          </code>
          .
        </p>
        <p className="text-sm text-muted-foreground">
          A <strong>404</strong> is returned when a slug is missing or
          unpublished. A <strong>429</strong> is returned when the rate limit is
          exceeded, along with a{" "}
          <code className="rounded bg-muted px-2 py-1 text-xs font-semibold text-foreground">
            Retry-After
          </code>{" "}
          header.
        </p>
      </section>
    </main>
  );
}
