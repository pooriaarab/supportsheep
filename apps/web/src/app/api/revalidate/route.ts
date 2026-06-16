/**
 * On-Demand Revalidation API
 *
 * POST /api/revalidate
 * Accepts slug and/or category, revalidates those paths using revalidatePath.
 * Protected by REVALIDATE_SECRET environment variable.
 */

import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET;
  const authHeader = request.headers.get("authorization");

  // Verify secret if configured
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { slug, category } = body as {
      slug?: string;
      category?: string;
    };

    const revalidated: string[] = [];

    // Revalidate specific article page
    if (slug) {
      revalidatePath(`/${slug}`);
      revalidated.push(`/${slug}`);
    }

    if (slug && category) {
      revalidatePath(`/blog/${category}/${slug}`);
      revalidated.push(`/blog/${category}/${slug}`);
    }

    // Revalidate category listing
    if (category) {
      revalidatePath(`/category/${category}`);
      revalidated.push(`/category/${category}`);

      revalidatePath(`/blog/${category}`);
      revalidated.push(`/blog/${category}`);
    }

    // Always revalidate the knowledge base homepage
    revalidatePath("/blog");
    revalidated.push("/blog");

    // Revalidate sitemap
    revalidatePath("/sitemap.xml");
    revalidated.push("/sitemap.xml");

    return NextResponse.json({
      revalidated: true,
      paths: revalidated,
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }
}
