/**
 * MCP Config Tools
 *
 * Tools for reading and updating blog configuration.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  getBlogConfig,
  getStoredBlogConfig,
  resolveBlogConfig,
  updateBlogConfig,
} from "@/lib/blog-config";
import {
  flattenBlogConfigPayload,
  applyFlatUpdates,
  getResolvedTopBannerValidationError,
  updateBlogConfigSchema,
} from "@/app/api/v1/config/route";
import type { BlogConfig } from "@repo/types";
import { textResult } from "./shared";
import type { McpToolContext } from "./context";

function stripSecrets(config: Record<string, unknown>) {
  const sanitized = { ...config };
  const ai = sanitized.ai as Record<string, unknown> | undefined;
  if (ai?.providers) {
    const providers = { ...(ai.providers as Record<string, unknown>) };
    for (const [key, val] of Object.entries(providers)) {
      if (val && typeof val === "object") {
        const provider = { ...(val as Record<string, unknown>) };
        if (provider.apiKey) {
          provider.apiKey = "***";
        }
        providers[key] = provider;
      }
    }
    sanitized.ai = { ...ai, providers };
  }

  return sanitized;
}

export function registerConfigTools(
  server: McpServer,
  { blogId }: McpToolContext,
) {
  server.tool(
    "get_blog_config",
    "Get blog configuration including site name, SEO defaults, and AI settings",
    {},
    async () => {
      const config = await getBlogConfig(blogId);
      return textResult(
        stripSecrets(config as unknown as Record<string, unknown>),
      );
    },
  );

  server.tool(
    "update_blog_config",
    "Update blog configuration, including site settings, theme, public shell, article styling, SEO, AI defaults, publishing, image providers, and permalinks",
    {
      config: updateBlogConfigSchema.describe(
        "Partial BlogConfig update using the same shape as PATCH /api/v1/config",
      ),
    },
    async ({ config }) => {
      const payload = config as Record<string, unknown>;
      const updateData = flattenBlogConfigPayload(payload);

      const existingStored = await getStoredBlogConfig(blogId);
      const newStored = applyFlatUpdates(
        existingStored as Record<string, unknown>,
        updateData,
      ) as Partial<BlogConfig>;

      const resolvedConfig = resolveBlogConfig(newStored);
      const validationError = getResolvedTopBannerValidationError(
        resolvedConfig.publicAppearance?.topBanner,
      );
      if (validationError) {
        return textResult({
          error: validationError.message,
          details: [validationError],
        });
      }

      await updateBlogConfig(blogId, newStored);

      const updated = await getBlogConfig(blogId);
      return textResult({
        updated: true,
        data: stripSecrets(updated as unknown as Record<string, unknown>),
      });
    },
  );
}
