/**
 * Single Media API
 *
 * GET /api/v1/media/:id -- Get single media item
 * PATCH /api/v1/media/:id -- Update media metadata (alt text)
 * DELETE /api/v1/media/:id -- Delete metadata from D1 + attempt byte delete from R2
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createApiHandler } from "@/lib/create-api-handler";
import { createLogger } from "@/lib/logger";
import { getErrorMessage } from "@/lib/error-utils";
import { getMediaBucket } from "@/lib/media/bucket";
import { deleteMedia, getMedia, updateMedia } from "@/lib/media/repository";

const log = createLogger("api:media:single");

const updateMediaSchema = z.object({
  alt: z.string().max(500).optional(),
});

/**
 * GET /api/v1/media/:id
 */
export const GET = createApiHandler<unknown, { id: string }>({
  auth: "user",
  handler: async ({ params, blogId }) => {
    const item = await getMedia(blogId, params.id);

    if (!item) {
      return NextResponse.json({ error: "Media not found" }, { status: 404 });
    }

    return NextResponse.json(item);
  },
});

/**
 * PATCH /api/v1/media/:id
 * Update alt text
 */
export const PATCH = createApiHandler<
  z.infer<typeof updateMediaSchema>,
  { id: string }
>({
  auth: "user",
  input: updateMediaSchema,
  handler: async ({ body, params, blogId }) => {
    const updated = await updateMedia(blogId, params.id, { alt: body.alt });

    if (!updated) {
      return NextResponse.json({ error: "Media not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  },
});

/**
 * DELETE /api/v1/media/:id
 * Remove metadata from D1; attempt byte delete from the R2 MEDIA bucket.
 *
 * The D1 row is deleted first — metadata is authoritative. The byte delete is
 * best-effort (non-fatal). The storagePath from the row drives the byte delete.
 */
export const DELETE = createApiHandler<unknown, { id: string }>({
  auth: "user",
  audit: "delete_media",
  handler: async ({ params, blogId }) => {
    const item = await deleteMedia(blogId, params.id);

    if (!item) {
      return NextResponse.json({ error: "Media not found" }, { status: 404 });
    }

    if (item.storagePath) {
      try {
        await getMediaBucket().delete(item.storagePath);
      } catch (error: unknown) {
        log.warn("Failed to delete file bytes from storage", {
          error: getErrorMessage(error),
        });
      }
    }

    return NextResponse.json({ deleted: true });
  },
});
