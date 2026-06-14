/**
 * Functions Dashboard API
 *
 * GET  /api/v1/functions -- List function status (last run, log count)
 * POST /api/v1/functions -- Request a manual trigger for a function
 */

import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/create-api-handler";
import {
  appendFunctionLog,
  listRecentFunctionLogs,
} from "@/lib/functions/function-logs-repository";
import { DEFAULT_BLOG_ID } from "@/lib/tenancy/repository";
import { z } from "zod";

/** Known Cloud Functions with their metadata */
const FUNCTIONS_REGISTRY = [
  {
    name: "scheduledPublisher",
    description: "Publishes scheduled posts",
    schedule: "every 1 minute",
  },
  {
    name: "contentPlanExecutor",
    description: "Generates planned content",
    schedule: "daily at 6:00 AM UTC",
  },
  {
    name: "seoMonitor",
    description: "Checks for SEO issues",
    schedule: "daily at midnight UTC",
  },
  {
    name: "scheduledCleanup",
    description: "Removes expired sessions and old audit logs",
    schedule: "daily at 2:00 AM UTC",
  },
] as const;

/**
 * GET /api/v1/functions
 * Returns function status with last run info from function_logs
 */
export const GET = createApiHandler({
  auth: "user",
  handler: async () => {
    const functions = await Promise.all(
      FUNCTIONS_REGISTRY.map(async (fn) => {
        // Get last 10 logs for this function
        const logs = await listRecentFunctionLogs(DEFAULT_BLOG_ID, fn.name, 10);

        const lastLog = logs[0] ?? null;

        return {
          ...fn,
          lastRunAt: lastLog ? lastLog.executedAt : null,
          lastStatus: lastLog ? lastLog.status : "never_run",
          recentLogs: logs,
        };
      }),
    );

    return NextResponse.json({ data: functions });
  },
});

const triggerFunctionSchema = z.object({
  functionName: z.string().min(1, "Function name is required"),
});

/**
 * POST /api/v1/functions
 * Request a manual trigger for a function (logs the request)
 */
export const POST = createApiHandler({
  auth: "user",
  input: triggerFunctionSchema,
  audit: "trigger_function",
  handler: async ({ body }) => {
    const fn = FUNCTIONS_REGISTRY.find((f) => f.name === body.functionName);
    if (!fn) {
      return NextResponse.json(
        { error: `Unknown function: ${body.functionName}` },
        { status: 400 },
      );
    }

    // Log the manual trigger request
    await appendFunctionLog(DEFAULT_BLOG_ID, {
      functionName: body.functionName,
      status: "manual_trigger_requested",
    });

    return NextResponse.json({
      message: `Manual trigger requested for ${body.functionName}`,
      function: fn.name,
    });
  },
});
