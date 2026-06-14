/**
 * Media API
 *
 * GET /api/v1/media -- List media items
 * POST /api/v1/media -- Upload a media file
 */

import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/create-api-handler";
import { nanoid } from "nanoid";
import { createLogger } from "@/lib/logger";
import { getErrorMessage } from "@/lib/error-utils";
import { getMediaBucket } from "@/lib/media/bucket";
import { createMedia, listMedia } from "@/lib/media/repository";

const log = createLogger("api:media");

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/avif",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

/**
 * GET /api/v1/media
 * List uploaded media with pagination
 */
export const GET = createApiHandler({
  auth: "user",
  handler: async ({ request, blogId }) => {
    const url = new URL(request.url);
    const limit = Math.min(
      parseInt(url.searchParams.get("limit") || "50"),
      100,
    );
    // offset-based pagination (replaces Firestore cursor/startAfter)
    const offset = parseInt(url.searchParams.get("offset") || "0");

    const items = await listMedia(blogId, { limit, offset });

    return NextResponse.json({
      data: items,
      pagination: {
        limit,
        count: items.length,
        hasMore: items.length === limit,
      },
    });
  },
});

/**
 * POST /api/v1/media
 * Upload a file via multipart form data.
 *
 * Metadata is written to D1 immediately.
 * File bytes are uploaded to the R2 MEDIA bucket under the `media/` prefix and
 * served back publicly through GET /api/v1/media/file/[...path].
 */
export const POST = createApiHandler({
  auth: "user",
  audit: "upload_media",
  handler: async ({ request, blogId, session }) => {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const alt = (formData.get("alt") as string) || "";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}` },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File exceeds 10 MB limit" },
        { status: 400 },
      );
    }

    const sanitizedName = file.name
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(0, 200);
    // The `media/` prefix is load-bearing: the public serve route only streams
    // keys under it, keeping private buckets (e.g. interview recordings) out.
    const storagePath = `media/${Date.now()}-${sanitizedName}`;

    try {
      await getMediaBucket().put(storagePath, await file.arrayBuffer(), {
        httpMetadata: { contentType: file.type },
      });
    } catch (error: unknown) {
      log.error("Failed to upload media bytes", {
        error: getErrorMessage(error),
      });
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }

    const url = `/api/v1/media/file/${storagePath}`;

    const id = nanoid();
    const entry = await createMedia(blogId, {
      id,
      filename: sanitizedName,
      url,
      storagePath,
      mimeType: file.type,
      size: file.size,
      width: 0,
      height: 0,
      alt,
      uploadedBy: session.uid,
    });

    return NextResponse.json(
      { id: entry.id, url: entry.url, filename: entry.filename },
      { status: 201 },
    );
  },
});
