import { NextResponse } from "next/server";
import { z } from "zod";
import { createApiHandler } from "@/lib/create-api-handler";
import { resolvePublicFreeToolBySlug } from "@/lib/free-tools/repository";
import {
  executeFreeToolRun,
  FreeToolNotFoundError,
  FreeToolProviderConfigurationError,
  FreeToolQuotaExceededError,
  FreeToolUsageLimiterConfigurationError,
  FreeToolValidationError,
} from "@/lib/free-tools/run";

const publicRunSchema = z
  .object({
    input: z.record(z.string(), z.unknown()),
  })
  .strict();

export const POST = createApiHandler<
  z.infer<typeof publicRunSchema>,
  { slug: string }
>({
  auth: "none",
  input: publicRunSchema,
  handler: async ({ request, body, params }) => {
    const tool = await resolvePublicFreeToolBySlug(params.slug);
    if (!tool) {
      return NextResponse.json(
        { error: "Free tool not found" },
        { status: 404 },
      );
    }

    try {
      const data = await executeFreeToolRun({ tool, request, body });
      return NextResponse.json({ data });
    } catch (error) {
      if (error instanceof FreeToolNotFoundError) {
        return NextResponse.json(
          { error: "Free tool not found" },
          { status: 404 },
        );
      }
      if (error instanceof FreeToolQuotaExceededError) {
        return NextResponse.json(
          { error: "Free tool quota exceeded" },
          {
            status: 429,
            headers: {
              "Retry-After": String(error.retryAfterSeconds),
            },
          },
        );
      }
      if (error instanceof FreeToolValidationError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      if (error instanceof FreeToolProviderConfigurationError) {
        return NextResponse.json(
          { error: "AI provider is not configured" },
          { status: 503 },
        );
      }
      if (error instanceof FreeToolUsageLimiterConfigurationError) {
        return NextResponse.json(
          { error: "Free tool usage limiter is not configured" },
          { status: 503 },
        );
      }
      throw error;
    }
  },
});
