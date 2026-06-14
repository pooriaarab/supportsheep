/**
 * Health check endpoint
 *
 * GET /api/v1/health
 * Returns service status. No auth required.
 */

import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/create-api-handler";

export const GET = createApiHandler({
  auth: "none",
  handler: async () => {
    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      version: process.env.NEXT_PUBLIC_APP_VERSION || "0.0.0",
      environment: process.env.NODE_ENV,
    });
  },
});
