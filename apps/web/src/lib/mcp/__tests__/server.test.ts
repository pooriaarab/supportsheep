import { describe, expect, it } from "vitest";
import { createMcpServer } from "@/lib/mcp/server";
import { updateArticleSchema } from "@/lib/schemas";

function getRegisteredToolNames() {
  const server = createMcpServer({
    blogId: "default",
    ownerId: "user-1",
  }) as unknown as {
    _registeredTools: Record<string, unknown>;
  };

  return Object.keys(server._registeredTools).sort();
}

describe("MCP server", () => {
  it("registers admin content tools beyond read-only article access", () => {
    expect(getRegisteredToolNames()).toEqual(
      expect.arrayContaining([
        "update_blog_config",
        "create_category",
        "reorder_categories",
        "generate_articles_bulk",
        "generate_content_plan",
        "create_context_tag",
        "update_context_tag",
        "create_writing_skill",
        "run_writing_skills",
        "update_media",
        "delete_media",
        "publish_article",
      ]),
    );
  });
});

describe("article update schema", () => {
  it("accepts explicit slug edits for update-meta requests", () => {
    expect(
      updateArticleSchema.safeParse({
        action: "update-meta",
        slug: "better-draft-slug",
      }).success,
    ).toBe(true);
  });

  it("rejects non-canonical slug edits", () => {
    expect(
      updateArticleSchema.safeParse({
        action: "update-meta",
        slug: "Bad Slug",
      }).success,
    ).toBe(false);
  });
});
