/**
 * AI Chat Threads API
 *
 * GET    /api/v1/ai/chat/threads -- List chat threads for the current user
 * DELETE /api/v1/ai/chat/threads -- Delete a thread and its messages
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createApiHandler } from "@/lib/create-api-handler";
import {
  countMessages,
  deleteThread,
  getFirstUserMessage,
  listThreads,
} from "@/lib/ai/chat-repository";

const deleteThreadSchema = z.object({
  threadId: z.string().min(1, "Thread ID is required"),
});

/**
 * GET /api/v1/ai/chat/threads
 * List threads for the current user
 */
export const GET = createApiHandler({
  auth: "user",
  handler: async ({ session, blogId }) => {
    const rows = await listThreads(blogId, session.uid);

    const threads = await Promise.all(
      rows.map(async (thread) => {
        const messageCount = await countMessages(blogId, thread.id);

        const firstMsg = await getFirstUserMessage(blogId, thread.id);
        const preview = firstMsg?.content?.slice(0, 200) ?? thread.title ?? "Untitled";

        // Determine status: active if updated recently (last 30 min)
        const thirtyMinAgo = Date.now() - 30 * 60 * 1000;
        const status = thread.updatedAt > thirtyMinAgo ? "active" : "ended";

        return {
          id: thread.id,
          preview,
          messageCount,
          lastActive: new Date(thread.updatedAt).toISOString(),
          status,
        };
      }),
    );

    return NextResponse.json({ data: threads });
  },
});

/**
 * DELETE /api/v1/ai/chat/threads
 * Delete a thread and all its messages
 */
export const DELETE = createApiHandler({
  auth: "user",
  input: deleteThreadSchema,
  audit: "ai_chat_clear",
  handler: async ({ body, session, blogId }) => {
    const deleted = await deleteThread(blogId, session.uid, body.threadId);

    if (!deleted) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    return NextResponse.json({ deleted: true });
  },
});
