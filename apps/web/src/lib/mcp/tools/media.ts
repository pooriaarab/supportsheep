/**
 * MCP Media Tools
 *
 * Tools for listing, retrieving, updating, and deleting media files.
 * Metadata ops use D1 via the media repository.
 * File byte delete targets the R2 MEDIA bucket (non-fatal).
 */

import { z } from "zod/v3";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createLogger } from "@/lib/logger";
import { getErrorMessage } from "@/lib/error-utils";
import { getMediaBucket } from "@/lib/media/bucket";
import { textResult } from "./shared";
import type { McpToolContext } from "./context";
import {
  deleteMedia,
  getMedia,
  listMedia,
  updateMedia,
} from "@/lib/media/repository";

const log = createLogger("mcp:media");

export function registerMediaTools(
  server: McpServer,
  { blogId }: McpToolContext,
) {
  server.tool(
    "list_media",
    "List media files with optional type filter",
    {
      type: z
        .enum(["image", "video", "document", "other"])
        .optional()
        .describe("Filter by media type"),
      limit: z
        .number()
        .min(1)
        .max(100)
        .default(25)
        .describe("Number of items to return"),
    },
    async ({ type, limit }) => {
      // `type` maps to a mime_type family filter (image/* , video/* , etc.).
      const items = await listMedia(blogId, { limit, type });
      const result = items.map((m) => ({
        id: m.id,
        filename: m.filename,
        url: m.url,
        mimeType: m.mimeType,
        size: m.size,
        alt: m.alt,
      }));
      return textResult({ count: result.length, media: result });
    },
  );

  server.tool(
    "get_media",
    "Get a single media file by ID",
    { id: z.string().describe("Media document ID") },
    async ({ id }) => {
      const item = await getMedia(blogId, id);
      if (!item) {
        return textResult({ error: "Media not found" });
      }
      return textResult(item);
    },
  );

  server.tool(
    "update_media",
    "Update media metadata",
    {
      id: z.string().describe("Media document ID"),
      alt: z.string().max(500).optional().describe("Alt text"),
    },
    async ({ id, alt }) => {
      const updated = await updateMedia(blogId, id, { alt });
      if (!updated) {
        return textResult({ error: "Media not found" });
      }
      return textResult(updated);
    },
  );

  server.tool(
    "delete_media",
    "Delete media from storage and D1",
    { id: z.string().describe("Media document ID") },
    async ({ id }) => {
      const item = await deleteMedia(blogId, id);
      if (!item) {
        return textResult({ error: "Media not found" });
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

      return textResult({ deleted: true, id });
    },
  );
}
