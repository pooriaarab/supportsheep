/**
 * MCP Category Tools
 *
 * Tools for listing and managing blog categories.
 *
 * The Firestore model stored all categories in a single `config` doc
 * with an `order` map keyed by slug. The D1 repo (categories table) stores
 * each category as its own row with `sortOrder` (was `order`). The MCP
 * response shapes are identical — MCP clients see the same JSON.
 */

import { z } from "zod/v3";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
} from "@/lib/categories/repository";
import { textResult } from "./shared";
import type { McpToolContext } from "./context";

const categorySlugSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9-]+$/);

const isCategorySlug = (slug: string) =>
  categorySlugSchema.safeParse(slug).success;

export function registerCategoryTools(
  server: McpServer,
  { blogId }: McpToolContext,
) {
  server.tool(
    "list_categories",
    "List all blog categories with their display names and slugs",
    {},
    async () => {
      const categories = await listCategories(blogId);
      // Shape: { slug, displayName, order, icon, description, postCount }
      return textResult({ count: categories.length, categories });
    },
  );

  server.tool(
    "create_category",
    "Create a blog category",
    {
      slug: categorySlugSchema.describe("Lowercase category slug"),
      displayName: z.string().min(1).max(100),
      icon: z.string().max(50).default(""),
      description: z.string().max(500).default(""),
    },
    async ({ slug, displayName, icon, description }) => {
      const result = await createCategory(blogId, {
        slug,
        displayName,
        icon,
        description,
      });

      if (!result.ok) {
        return textResult({ error: "Category slug already exists" });
      }

      // Return { slug, displayName, order, icon, description, postCount }
      return textResult(result.entry);
    },
  );

  server.tool(
    "update_category",
    "Update a blog category",
    {
      slug: categorySlugSchema.describe("Category slug"),
      displayName: z.string().min(1).max(100).optional(),
      icon: z.string().max(50).optional(),
      description: z.string().max(500).optional(),
    },
    async ({ slug, displayName, icon, description }) => {
      const patch: { displayName?: string; icon?: string; description?: string } = {};
      if (displayName !== undefined) patch.displayName = displayName;
      if (icon !== undefined) patch.icon = icon;
      if (description !== undefined) patch.description = description;

      if (Object.keys(patch).length === 0) {
        return textResult({ error: "No fields to update" });
      }

      const entry = await updateCategory(blogId, slug, patch);
      if (!entry) return textResult({ error: "Category not found" });

      return textResult(entry);
    },
  );

  server.tool(
    "delete_category",
    "Delete a blog category",
    { slug: categorySlugSchema.describe("Category slug") },
    async ({ slug }) => {
      const deleted = await deleteCategory(blogId, slug);
      if (!deleted) return textResult({ error: "Category not found" });

      return textResult({ deleted: true, slug });
    },
  );

  server.tool(
    "reorder_categories",
    "Set category order values",
    {
      order: z
        .record(categorySlugSchema, z.number().int().min(0))
        .describe("Map of category slug to order index"),
    },
    async ({ order }) => {
      const slugs = Object.keys(order);
      const invalidSlugs = slugs.filter((slug) => !isCategorySlug(slug));
      if (invalidSlugs.length > 0) {
        return textResult({
          error: `Invalid category slugs: ${invalidSlugs.join(", ")}`,
        });
      }

      // Verify all slugs exist
      const existing = await listCategories(blogId);
      const existingSlugs = new Set(existing.map((c) => c.slug));
      const unknownSlugs = slugs.filter((slug) => !existingSlugs.has(slug));
      if (unknownSlugs.length > 0) {
        return textResult({
          error: `Unknown category slugs: ${unknownSlugs.join(", ")}`,
        });
      }

      await reorderCategories(blogId, order);
      return textResult({ reordered: slugs.length });
    },
  );
}
