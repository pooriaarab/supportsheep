/**
 * Notifications API
 *
 * GET    /api/v1/notifications -- List notifications
 * POST   /api/v1/notifications -- Create a notification
 * PATCH  /api/v1/notifications -- Mark notifications as read/unread
 * DELETE /api/v1/notifications -- Bulk delete notifications by IDs
 */

import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/create-api-handler";
import {
  createNotification,
  deleteNotifications,
  listNotifications,
  markNotificationsRead,
} from "@/lib/notifications/repository";
import {
  createNotificationSchema,
  markNotificationsReadSchema,
  deleteIdsSchema,
} from "@/lib/schemas";

/**
 * GET /api/v1/notifications
 * List notifications for the current user, ordered by newest first
 */
export const GET = createApiHandler({
  auth: "user",
  handler: async ({ request, session, blogId }) => {
    const url = new URL(request.url);
    const limit = Math.min(
      parseInt(url.searchParams.get("limit") || "50"),
      100,
    );
    const offset = parseInt(url.searchParams.get("offset") || "0");

    const data = await listNotifications(blogId, session.uid, { limit, offset });

    return NextResponse.json({
      data,
      pagination: { limit, offset, total: data.length },
    });
  },
});

/**
 * POST /api/v1/notifications
 * Create a new notification
 */
export const POST = createApiHandler({
  auth: "user",
  input: createNotificationSchema,
  audit: "create_notification",
  handler: async ({ body, session, blogId }) => {
    const result = await createNotification(blogId, {
      userId: session.uid,
      type: body.type,
      title: body.title,
      message: body.message,
      actionUrl: body.actionUrl,
      metadata: body.metadata as Record<string, unknown>,
    });

    return NextResponse.json(result, { status: 201 });
  },
});

/**
 * PATCH /api/v1/notifications
 * Mark notifications as read or unread
 */
export const PATCH = createApiHandler({
  auth: "user",
  input: markNotificationsReadSchema,
  audit: "update_notification",
  handler: async ({ body, session, blogId }) => {
    const updated = await markNotificationsRead(
      blogId,
      session.uid,
      body.ids,
      body.read,
    );

    return NextResponse.json({ updated, read: body.read });
  },
});

/**
 * DELETE /api/v1/notifications
 * Bulk delete notifications by IDs
 */
export const DELETE = createApiHandler({
  auth: "user",
  input: deleteIdsSchema,
  audit: "delete_notification",
  handler: async ({ body, session, blogId }) => {
    const deleted = await deleteNotifications(blogId, session.uid, body.ids);

    return NextResponse.json({ deleted });
  },
});
