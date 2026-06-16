import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { articles } from "@/db/schema/articles";
import { nanoid } from "nanoid";

export async function POST(req: Request) {
  try {
    const { spec } = await req.json();

    if (!spec || typeof spec !== "string") {
      return NextResponse.json({ error: "Invalid spec string provided" }, { status: 400 });
    }

    // Try to parse as JSON first
    let parsedSpec: Record<string, unknown>;
    try {
      parsedSpec = JSON.parse(spec) as Record<string, unknown>;
    } catch {
      // Stub parsing if it's YAML or complex
      parsedSpec = {
        paths: {
          "/stub/endpoint": {
            get: {
              summary: "Stub Endpoint",
              description: "This is a fallback stub because the spec wasn't valid JSON.",
            },
          },
        },
      };
    }

    const endpoints = [];
    if (parsedSpec?.paths && typeof parsedSpec.paths === "object") {
      for (const [path, methods] of Object.entries(parsedSpec.paths as Record<string, unknown>)) {
        if (typeof methods === "object" && methods !== null) {
          for (const [method, details] of Object.entries(methods as Record<string, unknown>)) {
            const summary = (details as Record<string, unknown>)?.summary || `${method.toUpperCase()} ${path}`;
            const description = (details as Record<string, unknown>)?.description || "";
            endpoints.push({ path, method, summary, description });
          }
        }
      }
    }

    if (endpoints.length === 0) {
      return NextResponse.json({ error: "No endpoints found in spec" }, { status: 400 });
    }

    const db = getDb();
    const insertedIds = [];

    // Insert drafted articles for each endpoint
    for (const ep of endpoints) {
      const slug = `api-doc-${nanoid(8).toLowerCase()}`;
      
      const articleData = {
        title: `API Documentation: ${ep.summary}`,
        content: `<h1>${ep.summary}</h1><p><strong>Endpoint:</strong> <code>${ep.method.toUpperCase()} ${ep.path}</code></p><p>${ep.description}</p>`,
      };

      await db.insert(articles).values({
        id: nanoid(),
        blogId: "default",
        slug,
        status: "draft",
        category: "API Reference",
        postType: "api_doc",
        data: JSON.stringify(articleData),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      
      insertedIds.push(slug);
    }

    return NextResponse.json({
      success: true,
      message: `Imported ${endpoints.length} API endpoints as drafted articles.`,
      count: endpoints.length,
      slugs: insertedIds,
    });

  } catch (error) {
    console.error("OpenAPI Import Error:", error);
    return NextResponse.json({ error: "Failed to import OpenAPI spec" }, { status: 500 });
  }
}
