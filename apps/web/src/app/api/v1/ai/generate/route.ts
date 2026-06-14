/**
 * AI Generation API Endpoint
 *
 * POST /api/v1/ai/generate
 * Streams an AI-generated response using Anthropic Claude.
 * Reads model/temperature/system prompt from D1 AI chat config,
 * with fallbacks to request-level overrides and sensible defaults.
 *
 * Request body:
 * - prompt: string (required) -- the user's instruction
 * - context: string (optional) -- additional context for the AI
 * - systemPrompt: string (optional) -- custom system prompt override
 * - maxTokens: number (optional, default: from config or 1024) -- maximum response tokens
 *
 * Response: Server-Sent Events (SSE) stream
 * - data: {"type":"text","content":"chunk"}\n\n
 * - data: [DONE]\n\n
 */

import { z } from "zod";
import { verifyRequest } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api-utils";
import { createLogger } from "@/lib/logger";
import { getProviderApiKey } from "@/lib/ai/providers";
import { getAiChatSettings } from "@/lib/ai/chat-settings-repository";
import { DEFAULT_BLOG_ID } from "@/lib/tenancy/repository";

const log = createLogger("api:ai:generate");

const generateSchema = z.object({
  prompt: z.string().min(1, "Prompt is required").max(10_000),
  context: z.string().max(50_000).optional(),
  systemPrompt: z.string().max(5_000).optional(),
  maxTokens: z.number().int().min(1).max(4096).optional(),
});

export async function POST(request: Request): Promise<Response> {
  try {
    const session = await verifyRequest();

    const raw = await request.json();
    const result = generateSchema.safeParse(raw);
    if (!result.success) {
      return Response.json(
        { error: "Validation failed", details: result.error.issues },
        { status: 400 },
      );
    }

    const {
      prompt,
      context,
      systemPrompt: requestSystemPrompt,
      maxTokens: requestMaxTokens,
    } = result.data;

    const settings = await getAiChatSettings(DEFAULT_BLOG_ID);
    const model = settings.model;
    const temperature = settings.temperature;
    const maxTokens = requestMaxTokens ?? settings.maxTokens;
    const defaultSystemPrompt =
      settings.systemPrompt ||
      "You are a helpful AI assistant. Provide clear, concise, and well-structured responses. When generating content, match the tone and style of any provided context.";

    const systemMessage = requestSystemPrompt ?? defaultSystemPrompt;

    const userMessage = context
      ? `Context:\n${context}\n\n---\n\nInstruction: ${prompt}`
      : prompt;

    log.info("AI generation requested", {
      userId: session.uid,
      promptLength: prompt.length,
      hasContext: !!context,
      model,
    });

    let apiKey: string;
    try {
      apiKey = await getProviderApiKey("claude");
    } catch (err) {
      log.error("AI generate provider key missing", {
        error: err instanceof Error ? err.message : "Unknown",
      });
      return Response.json(
        {
          error:
            "AI service not configured. Add your Claude API key in Settings > AI Providers.",
        },
        { status: 503 },
      );
    }

    const anthropicResponse = await fetch(
      "https://api.anthropic.com/v1/messages",
      {
        cache: "no-store",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          temperature,
          system: systemMessage,
          stream: true,
          messages: [{ role: "user", content: userMessage }],
        }),
      },
    );

    if (!anthropicResponse.ok) {
      const errorBody = await anthropicResponse.text();
      log.error("Anthropic API error", {
        status: anthropicResponse.status,
        body: errorBody,
      });
      return Response.json({ error: "AI generation failed" }, { status: 502 });
    }

    if (!anthropicResponse.body) {
      return Response.json(
        { error: "No stream body from AI provider" },
        { status: 502 },
      );
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const transformStream = new TransformStream({
      async transform(chunk, controller) {
        const text = decoder.decode(chunk, { stream: true });
        const lines = text.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;

          const data = line.slice(6).trim();
          if (!data || data === "[DONE]") continue;

          try {
            const event = JSON.parse(data);

            if (
              event.type === "content_block_delta" &&
              event.delta?.type === "text_delta" &&
              event.delta.text
            ) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: "text", content: event.delta.text })}\n\n`,
                ),
              );
            }

            if (event.type === "message_stop") {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            }
          } catch {
            // Skip malformed JSON lines
          }
        }
      },
    });

    const stream = anthropicResponse.body.pipeThrough(transformStream);

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    log.error("AI generate error", { error });
    return handleApiError(error);
  }
}
