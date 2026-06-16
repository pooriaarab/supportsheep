/**
 * AI Chat API
 *
 * POST /api/v1/ai/chat -- Send a message and stream an AI response
 * GET  /api/v1/ai/chat -- Load messages for a conversation thread
 *
 * Messages are persisted to D1 ai_chat_messages, grouped by threadId.
 * Thread metadata is stored in D1 ai_chat_threads for listing user conversations.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createApiHandler } from "@/lib/create-api-handler";
import { createLogger } from "@/lib/logger";
import { getProviderApiKey } from "@/lib/ai/providers";
import {
  addMessage,
  createThread,
  getThread,
  listMessages,
  listRecentMessages,
  touchThread,
} from "@/lib/ai/chat-repository";
import { getAiChatSettings } from "@/lib/ai/chat-settings-repository";

const log = createLogger("api:ai:chat");

const sendMessageSchema = z.object({
  threadId: z.string().min(1).max(128),
  content: z.string().min(1, "Message content is required").max(10_000),
});

/**
 * GET /api/v1/ai/chat?threadId=xxx
 * Load messages for a conversation thread, ordered by creation time.
 */
export const GET = createApiHandler({
  auth: "user",
  handler: async ({ request, session, blogId }) => {
    const url = new URL(request.url);
    const threadId = url.searchParams.get("threadId");

    if (!threadId) {
      return NextResponse.json(
        { error: "threadId query parameter is required" },
        { status: 400 },
      );
    }

    const thread = await getThread(blogId, session.uid, threadId);
    if (!thread) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const messages = await listMessages(blogId, threadId);

    return NextResponse.json({ data: messages });
  },
});

/**
 * POST /api/v1/ai/chat
 * Save the user message, load AI config from D1, stream an AI response,
 * and persist the assistant message once complete.
 */
export const POST = createApiHandler({
  auth: "user",
  input: sendMessageSchema,
  audit: "ai_chat_message",
  handler: async ({ body, session, blogId }) => {
    const { threadId, content } = body;

    const existing = await getThread(blogId, session.uid, threadId);

    if (!existing) {
      // Honor the client-supplied threadId so the thread row id matches the
      // id its messages are stored under (the client treats it as canonical).
      await createThread(blogId, session.uid, {
        id: threadId,
        title: content.slice(0, 100),
      });
    } else {
      await touchThread(blogId, session.uid, threadId);
    }

    await addMessage(blogId, {
      threadId,
      role: "user",
      content,
      userId: session.uid,
    });

    const recentMessages = await listRecentMessages(blogId, threadId, 20);
    const conversationHistory = recentMessages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    const settings = await getAiChatSettings(blogId);
    const { model, temperature, maxTokens, systemPrompt } = settings;

    let apiKey: string;
    try {
      apiKey = await getProviderApiKey("claude");
    } catch (err) {
      log.error("AI chat provider key missing", {
        error: err instanceof Error ? err.message : "Unknown",
      });
      return NextResponse.json(
        {
          error:
            "AI service not configured. Add your Claude API key in Settings > AI Providers.",
        },
        { status: 503 },
      );
    }

    log.info("AI chat message", {
      userId: session.uid,
      threadId,
      model,
      messageCount: conversationHistory.length,
    });

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
          system: systemPrompt,
          stream: true,
          messages: conversationHistory,
        }),
      },
    );

    if (!anthropicResponse.ok) {
      const errorBody = await anthropicResponse.text();
      log.error("Anthropic API error", {
        status: anthropicResponse.status,
        body: errorBody,
      });
      return NextResponse.json(
        { error: "AI generation failed" },
        { status: 502 },
      );
    }

    if (!anthropicResponse.body) {
      return NextResponse.json(
        { error: "No stream body from AI provider" },
        { status: 502 },
      );
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    let fullResponse = "";

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
            const delta = event.delta;

            if (
              event.type === "content_block_delta" &&
              delta?.type === "text_delta" &&
              delta.text
            ) {
              fullResponse += delta.text;
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: "text", content: delta.text })}\n\n`,
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
      async flush() {
        if (fullResponse) {
          try {
            await addMessage(blogId, {
              threadId,
              role: "assistant",
              content: fullResponse,
              userId: session.uid,
            });
            await touchThread(blogId, session.uid, threadId);
          } catch (err) {
            log.error("Failed to persist assistant message", {
              threadId,
              error: err instanceof Error ? err.message : "Unknown",
            });
          }
        }
      },
    });

    const stream = anthropicResponse.body.pipeThrough(transformStream);

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  },
});
