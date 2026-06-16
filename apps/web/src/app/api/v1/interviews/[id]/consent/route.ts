import { NextResponse } from "next/server";
import { z } from "zod";
import { createApiHandler } from "@/lib/create-api-handler";
import { verifyRequest } from "@/lib/auth/session";
import { hashShareLinkToken } from "@/lib/interviews/share-link-token";
import {
  buildSystemPrompt,
} from "@/lib/interviews/system-prompts";
import {
  mintInterviewToken,
  buildInterviewTokenCookie,
} from "@/lib/interviews/interview-token";
import {
  mintRealtimeSession,
  CANVAS_TOOLS,
  RealtimeMintError,
} from "@/lib/interviews/openai-realtime";
import { mintTavusSession, TavusMintError } from "@/lib/interviews/tavus";
import { type InterviewStyle, type InterviewLanguage } from "@/lib/interviews/share-link-schema";
import { getBlogConfig } from "@/lib/blog-config";
import { timingSafeEqual } from "node:crypto";
import { createLogger } from "@/lib/logger";
import { RATE_LIMITS } from "@/lib/rate-limit";
import {
  getInterview,
  consentToLive,
  updateInterview,
} from "@/lib/interviews/interviews-repository";
import { getShareLink } from "@/lib/interviews/share-links-repository";
import { DEFAULT_blog_id } from "@/lib/tenancy/repository";

const log = createLogger("interviews:lifecycle");

interface InterviewRecord {
  status: string;
  startedByUid?: string | null;
  shareLinkId?: string | null;
  style: InterviewStyle;
  topic?: string | null;
  goal?: string | null;
  recordingConfig?: string | null;
  guestName?: string | null;
  maxDurationSec?: number;
  language?: InterviewLanguage;
  mode?: "live" | "async";
}

const consentInputSchema = z.object({
  confirmed: z.literal(true),
  shareLinkToken: z.string().min(32).optional(),
});

export const POST = createApiHandler({
  auth: "none",
  rateLimit: {
    key: "interview-consent",
    maxPerMinute: RATE_LIMITS["interview-consent"],
  },
  input: consentInputSchema,
  handler: async ({ body, params }) => {
    const { id } = params as { id: string };

    // 1. Load interview for authorization (auth fields are immutable after creation)
    const interview = await getInterview(DEFAULT_blog_id, id);
    if (!interview) {
      return NextResponse.json({ error: "Interview not found" }, { status: 404 });
    }

    const interviewData: InterviewRecord = interview;

    // 2. Authorization checks BEFORE any state transition
    if (interviewData.startedByUid) {
      let session;
      try {
        session = await verifyRequest();
      } catch (_err) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      if (session.uid !== interviewData.startedByUid) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      }
    } else if (interviewData.shareLinkId) {
      if (!body.shareLinkToken) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      }

      const shareLinkRow = await getShareLink(DEFAULT_blog_id, interviewData.shareLinkId);
      if (!shareLinkRow) {
        return NextResponse.json({ error: "Share-link not found" }, { status: 404 });
      }

      const hashedProvided = hashShareLinkToken(body.shareLinkToken);

      const providedBuf = Buffer.from(hashedProvided);
      const storedBuf = Buffer.from(shareLinkRow.tokenHash);
      if (providedBuf.length !== storedBuf.length || !timingSafeEqual(providedBuf, storedBuf)) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      }
    } else {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    // 3. Atomically check monthly cost cap AND transition status from consent to live.
    // The cost cap is checked before the conditional UPDATE. D1 doesn't expose
    // multi-statement user transactions, so we use a conditional UPDATE (WHERE
    // status = 'consent') which returns 0 rows if another concurrent request
    // already transitioned it, preserving idempotency.
    const config = await getBlogConfig();
    const monthlyCostCapUsd = config?.interview?.monthlyCostCapUsd ?? null;

    const result = await consentToLive(DEFAULT_blog_id, id, monthlyCostCapUsd);

    if (!result.ok) {
      if (result.reason === "not_found") {
        return NextResponse.json({ error: "Interview not found" }, { status: 404 });
      }
      if (result.reason === "conflict") {
        return NextResponse.json(
          { error: "Cannot consent to interview that is not in consent status" },
          { status: 409 },
        );
      }
      if (result.reason === "cost_cap_exceeded") {
        return NextResponse.json(
          { error: "Monthly cost cap exceeded for this workspace." },
          { status: 429 },
        );
      }
    }

    // For async mode, bypass OpenAI/Tavus sessions and return interview token directly
    if (interviewData.mode === "async") {
      const interviewToken = mintInterviewToken(id);
      const response = NextResponse.json({
        interviewToken,
        interviewId: id,
        mode: "async",
      });
      const cookie = buildInterviewTokenCookie(id, interviewToken);
      response.cookies.set(cookie.name, cookie.value, cookie.options);
      return response;
    }

    // If the recording configuration is video, route to Tavus session minting
    if (interviewData.recordingConfig === "video") {
      let tavusSession;
      try {
        tavusSession = await mintTavusSession({
          topic: interviewData.topic ?? undefined,
          guestName: interviewData.guestName ?? undefined,
          maxDurationSec: interviewData.maxDurationSec ?? 300,
        });
      } catch (err: unknown) {
        if (err instanceof TavusMintError) {
          log.error("Failed to mint Tavus session", {
            interviewId: id,
            tavusErrorKind: err.kind,
            tavusStatus: err.status,
            tavusRequestId: err.requestId,
            tavusResponseBody: err.responseBody.slice(0, 1000),
          });

          if (
            err.kind === "missing_api_key" ||
            err.kind === "missing_replica"
          ) {
            return NextResponse.json(
              { error: err.message, code: err.kind },
              { status: 503 },
            );
          }

          const friendly =
            err.status === 401
              ? "Tavus API key is invalid or unauthorized"
              : err.status === 402 || err.status === 429
                ? "Tavus quota exceeded or rate-limited"
                : err.status === 400
                  ? "Tavus rejected the request (check replica and persona IDs)"
                  : "Failed to initialize video session";

          return NextResponse.json(
            {
              error: friendly,
              code: err.kind,
              upstreamStatus: err.status,
            },
            { status: 502 },
          );
        }

        log.error("Failed to mint Tavus session (unexpected)", {
          interviewId: id,
          error: err instanceof Error ? err.message : String(err),
        });
        return NextResponse.json(
          { error: "Failed to initialize video session" },
          { status: 502 },
        );
      }

      try {
        await updateInterview(DEFAULT_blog_id, id, {
          videoProvider: "tavus",
          tavusConversationId: tavusSession.conversationId,
        });
      } catch (err: unknown) {
        log.error("Failed to update interview with Tavus metadata", {
          interviewId: id,
          error: err instanceof Error ? err.message : String(err),
        });
        return NextResponse.json(
          { error: "Failed to save video session info" },
          { status: 500 },
        );
      }

      const interviewToken = mintInterviewToken(id);

      const response = NextResponse.json({
        tavusConversationUrl: tavusSession.conversationUrl,
        interviewToken,
        interviewId: id,
        expiresAt: tavusSession.expiresAt,
      });
      const cookie = buildInterviewTokenCookie(id, interviewToken);
      response.cookies.set(cookie.name, cookie.value, cookie.options);
      return response;
    }

    // Short-circuit OpenAI Realtime mint when the dev harness is running
    // with LLM_PROVIDER=mock.
    if (
      process.env.NODE_ENV !== "production" &&
      process.env.LLM_PROVIDER === "mock"
    ) {
      const mode =
        process.env.INTERVIEW_MOCK_TIMELINE === "comprehensive"
          ? "comprehensive"
          : "basic";
      const interviewToken = mintInterviewToken(id);
      const expiresAt = Math.floor(Date.now() / 1000) + 600;
      const response = NextResponse.json({
        client_secret: {
          value: `mock-${id}:${mode}`,
          expires_at: expiresAt,
        },
        interviewToken,
        interviewId: id,
        expiresAt,
        mock: true,
      });
      const cookie = buildInterviewTokenCookie(id, interviewToken);
      response.cookies.set(cookie.name, cookie.value, cookie.options);
      return response;
    }

    // Build the style-specific system prompt
    const instructions = buildSystemPrompt({
      style: interviewData.style,
      topic: interviewData.topic,
      goal: interviewData.goal,
      language: interviewData.language,
    });

    // Mint the ephemeral session with OpenAI
    let realtimeSession;
    try {
      realtimeSession = await mintRealtimeSession({
        voice: "alloy",
        instructions,
        tools: [...CANVAS_TOOLS],
        language: interviewData.language,
      });
    } catch (err: unknown) {
      if (err instanceof RealtimeMintError) {
        log.error("Failed to mint OpenAI realtime session", {
          interviewId: id,
          openaiStatus: err.status,
          openaiRequestId: err.requestId,
          openaiResponseBody: err.responseBody.slice(0, 1000),
        });
      } else {
        log.error("Failed to mint OpenAI realtime session (unexpected)", {
          interviewId: id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
      return NextResponse.json(
        { error: "Failed to initialize interview stream" },
        { status: 502 },
      );
    }

    // Mint internal interview token
    const interviewToken = mintInterviewToken(id);

    const response = NextResponse.json({
      client_secret: realtimeSession.client_secret,
      interviewToken,
      interviewId: id,
      expiresAt: realtimeSession.client_secret.expires_at,
    });
    const cookie = buildInterviewTokenCookie(id, interviewToken);
    response.cookies.set(cookie.name, cookie.value, cookie.options);
    return response;
  },
});
