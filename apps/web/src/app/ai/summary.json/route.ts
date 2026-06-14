import { NextResponse } from "next/server";
import { buildAiSummary } from "@/lib/ai-discovery";
import { resolvePublicSiteUrl } from "@/lib/public-site";

export const revalidate = 3600;

export async function GET() {
  return NextResponse.json(buildAiSummary(resolvePublicSiteUrl()), {
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
