import { NextResponse } from "next/server";
import { buildAgentSkillsIndex } from "@/lib/agent-discovery";
import { resolvePublicSiteUrl } from "@/lib/public-site";

export async function GET() {
  return NextResponse.json(buildAgentSkillsIndex(resolvePublicSiteUrl()), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
