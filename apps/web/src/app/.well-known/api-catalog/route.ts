import { NextResponse } from "next/server";
import { buildApiCatalog } from "@/lib/api-catalog";
import { resolvePublicSiteUrl } from "@/lib/public-site";

export async function GET() {
  const payload = buildApiCatalog(resolvePublicSiteUrl());
  return NextResponse.json(payload, {
    headers: {
      "Content-Type": "application/linkset+json; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
