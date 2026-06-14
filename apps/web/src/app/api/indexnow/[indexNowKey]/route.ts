import { NextResponse } from "next/server";
import { getBlogConfig } from "@/lib/blog-config";

interface IndexNowRouteContext {
  params: Promise<Record<string, string | string[] | undefined>>;
}

export async function GET(
  _request: Request,
  { params }: IndexNowRouteContext,
) {
  const resolvedParams = await params;
  const indexNowKey =
    typeof resolvedParams.indexNowKey === "string"
      ? resolvedParams.indexNowKey
      : "";
  const config = await getBlogConfig();
  const apiKey = config.seo.submissionProtocols?.indexNow?.apiKey ?? "";

  if (!apiKey || indexNowKey !== apiKey) {
    return new NextResponse("Not Found", { status: 404 });
  }

  return new NextResponse(apiKey, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
