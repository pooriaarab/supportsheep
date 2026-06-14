/**
 * Client log ingestion endpoint.
 *
 * Accepts batched log entries from browser-side `createLogger()` callers
 * and re-emits them through the server logger so they land in Cloud
 * Logging (via the Netlify Function log stream).
 *
 * Each entry is tagged with `source: "client"` so the existing gcloud
 * query surface can filter for browser-origin logs:
 *
 *   gcloud logging read 'jsonPayload.source="client"'
 *
 * PII guard: any entry whose message or `data` tree contains the
 * substrings `bearer`, `token`, `cookie`, `password`, or `apiKey`
 * (case-insensitive) is redacted before re-emission.
 *
 * Auth: `none`. The endpoint is callable by any browser so anonymous
 * visitors can ship logs. The route is rate-limited per-IP and the
 * per-batch entry count is capped to bound the worst-case throughput.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createApiHandler } from "@/lib/create-api-handler";
import { createLogger, type Logger } from "@/lib/logger";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { redactLogEntry } from "@/lib/logger/redact-pii";

const LEVELS = ["debug", "info", "warn", "error"] as const;

const clientLogEntrySchema = z.object({
  level: z.enum(LEVELS),
  context: z.string().min(1).max(128),
  message: z.string().max(8000),
  data: z.record(z.string(), z.unknown()).optional(),
  correlationId: z.string().max(64).optional(),
  timestamp: z.string().max(64).optional(),
});

const clientLogsBodySchema = z.object({
  entries: z.array(clientLogEntrySchema).min(1).max(50),
});

type ClientLogEntry = z.infer<typeof clientLogEntrySchema>;

function emitEntry(entry: ClientLogEntry): void {
  const redacted = redactLogEntry(entry);
  const log: Logger = createLogger(`client:${redacted.context}`);
  const data = {
    ...(redacted.data ?? {}),
    source: "client",
    ...(redacted.correlationId
      ? { clientCorrelationId: redacted.correlationId }
      : {}),
    ...(redacted.timestamp ? { clientTimestamp: redacted.timestamp } : {}),
  };
  switch (redacted.level) {
    case "debug":
      log.debug(redacted.message, data);
      break;
    case "info":
      log.info(redacted.message, data);
      break;
    case "warn":
      log.warn(redacted.message, data);
      break;
    case "error":
      log.error(redacted.message, data);
      break;
  }
}

export const POST = createApiHandler({
  auth: "none",
  rateLimit: {
    key: "client-logs",
    maxPerMinute: RATE_LIMITS["client-logs"],
  },
  input: clientLogsBodySchema,
  handler: async ({ body }) => {
    for (const entry of body.entries) {
      emitEntry(entry);
    }
    return NextResponse.json({ accepted: body.entries.length });
  },
});
