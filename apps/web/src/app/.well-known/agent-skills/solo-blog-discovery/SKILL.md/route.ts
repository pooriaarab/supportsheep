import { NextResponse } from "next/server";
import { getSupportsheepDiscoverySkillMarkdown } from "@/lib/agent-discovery";
import { resolvePublicSiteUrl } from "@/lib/public-site";

export async function GET() {
  return new NextResponse(
    getSupportsheepDiscoverySkillMarkdown(resolvePublicSiteUrl()),
    {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Cache-Control": "public, max-age=300, s-maxage=300",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    },
  );
}
