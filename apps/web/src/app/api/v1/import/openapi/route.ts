import { NextResponse } from "next/server";
import { z } from "zod";
import { createApiHandler } from "@/lib/create-api-handler";
import { buildArticleCreateDocument } from "@/lib/articles/create-article-record";
import { createArticle, slugExists } from "@/lib/articles/repository";
import { sanitizeArticleHtml } from "@/lib/sanitize/article-html";

const inputSchema = z.object({
  spec: z.string().min(1, "Spec must not be empty"),
});

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface Endpoint {
  path: string;
  method: string;
  summary: string;
  description: string;
}

function extractEndpoints(spec: Record<string, unknown>): Endpoint[] {
  const endpoints: Endpoint[] = [];
  if (!spec?.paths || typeof spec.paths !== "object") return endpoints;

  for (const [path, methods] of Object.entries(spec.paths as Record<string, unknown>)) {
    if (typeof methods !== "object" || methods === null) continue;
    for (const [method, details] of Object.entries(methods as Record<string, unknown>)) {
      const summary = String((details as Record<string, unknown>)?.summary || `${method.toUpperCase()} ${path}`);
      const description = String((details as Record<string, unknown>)?.description || "");
      endpoints.push({ path, method, summary, description });
    }
  }
  return endpoints;
}

export const POST = createApiHandler({
  auth: "user",
  input: inputSchema,
  audit: "import_openapi",
  handler: async ({ body, blogId }) => {
    let parsedSpec: Record<string, unknown>;
    try {
      parsedSpec = JSON.parse(body.spec) as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { error: "Invalid spec: only JSON is currently supported" },
        { status: 400 },
      );
    }

    const endpoints = extractEndpoints(parsedSpec);

    if (endpoints.length === 0) {
      return NextResponse.json(
        { error: "No endpoints found in spec" },
        { status: 400 },
      );
    }

    const slugs: string[] = [];

    for (const ep of endpoints) {
      const htmlBody = sanitizeArticleHtml(
        `<h1>${escapeHtml(ep.summary)}</h1>` +
        `<p><strong>Endpoint:</strong> <code>${escapeHtml(ep.method.toUpperCase())} ${escapeHtml(ep.path)}</code></p>` +
        `<p>${escapeHtml(ep.description)}</p>`,
      );

      const article = await buildArticleCreateDocument(
        {
          title: `API Documentation: ${ep.summary}`,
          body: htmlBody,
          status: "draft",
          category: "API Reference",
          slugHint: `api-${ep.method}-${ep.path}`,
        },
        (slug) => slugExists(blogId, slug),
      );

      const result = await createArticle(blogId, { ...article, blogId });
      if (result.ok) {
        slugs.push(result.article.slug);
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: `Imported ${slugs.length} API endpoints as draft articles.`,
        count: slugs.length,
        slugs,
      },
      { status: 201 },
    );
  },
});
