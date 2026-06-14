/**
 * Audit Logs API
 *
 * GET /api/v1/audit-logs -- List audit logs (read-only, paginated)
 */

import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/create-api-handler";
import { listAuditLogs } from "@/lib/audit-log";

/**
 * GET /api/v1/audit-logs
 * List audit log entries with pagination
 */
export const GET = createApiHandler({
  auth: "user",
  handler: async ({ request }) => {
    const url = new URL(request.url);
    const limit = Math.min(
      parseInt(url.searchParams.get("limit") || "50"),
      200,
    );
    const offset = parseInt(url.searchParams.get("offset") || "0");

    const { logs, total } = await listAuditLogs({ limit, offset });

    return NextResponse.json({
      data: logs,
      pagination: { limit, offset, total },
    });
  },
});
