import { toNextJsHandler } from "better-auth/next-js";

import { getAuth } from "@/lib/auth/better-auth";

// Better Auth handler, mounted at /api/auth/*. Coexists with the existing Firebase
// routes under /api/v1/auth/* — no cutover (B1). force-dynamic + the lazy getAuth()
// keep getCloudflareContext() out of build-time page-data collection.
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return toNextJsHandler(getAuth()).GET(request);
}

export async function POST(request: Request): Promise<Response> {
  return toNextJsHandler(getAuth()).POST(request);
}
