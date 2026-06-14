import { beforeEach, describe, expect, it, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerMediaTools } from "./media";

const mockDeleteMedia = vi.hoisted(() => vi.fn());
const mockListMedia = vi.hoisted(() => vi.fn());
vi.mock("@/lib/media/repository", () => ({
  deleteMedia: mockDeleteMedia,
  getMedia: vi.fn(),
  listMedia: mockListMedia,
  updateMedia: vi.fn(),
}));

const mockBucketDelete = vi.hoisted(() => vi.fn());
vi.mock("@/lib/media/bucket", () => ({
  getMediaBucket: vi.fn(() => ({
    put: vi.fn(),
    get: vi.fn(),
    delete: mockBucketDelete,
  })),
}));

type ToolCallback = (args: Record<string, unknown>) => Promise<unknown>;

function captureTools(blogId = "default") {
  const tools = new Map<string, ToolCallback>();
  const server = {
    tool: (name: string, ..._rest: unknown[]) => {
      tools.set(name, _rest[_rest.length - 1] as ToolCallback);
    },
  } as unknown as McpServer;
  registerMediaTools(server, { blogId, ownerId: "user-1" });
  return tools;
}

describe("MCP media tenant scoping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListMedia.mockResolvedValue([]);
    mockDeleteMedia.mockResolvedValue(null);
  });

  it("scopes list_media to the key's blogId, not the default blog", async () => {
    const listMediaTool = captureTools("blog-B").get("list_media")!;

    await listMediaTool({ limit: 25 });

    expect(mockListMedia).toHaveBeenCalledWith(
      "blog-B",
      expect.objectContaining({ limit: 25 }),
    );
    expect(mockListMedia).not.toHaveBeenCalledWith(
      "default",
      expect.anything(),
    );
  });

  it("a second key bound to a different blog operates on its own blog", async () => {
    const listForB = captureTools("blog-B").get("list_media")!;
    const listForC = captureTools("blog-C").get("list_media")!;

    await listForB({ limit: 10 });
    await listForC({ limit: 10 });

    const blogIds = mockListMedia.mock.calls.map((c) => c[0]);
    expect(blogIds).toEqual(["blog-B", "blog-C"]);
  });

  it("scopes delete_media to the key's blogId", async () => {
    const deleteForB = captureTools("blog-B").get("delete_media")!;

    await deleteForB({ id: "media-1" });

    expect(mockDeleteMedia).toHaveBeenCalledWith("blog-B", "media-1");
  });
});

describe("MCP delete_media", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBucketDelete.mockResolvedValue(undefined);
  });

  it("deletes the R2 object via getMediaBucket using the row storagePath", async () => {
    mockDeleteMedia.mockResolvedValue({ storagePath: "media/123-pic.png" });
    const deleteMediaTool = captureTools().get("delete_media")!;

    await deleteMediaTool({ id: "abc" });

    expect(mockBucketDelete).toHaveBeenCalledWith("media/123-pic.png");
  });

  it("skips the R2 delete when the row is missing", async () => {
    mockDeleteMedia.mockResolvedValue(null);
    const deleteMediaTool = captureTools().get("delete_media")!;

    await deleteMediaTool({ id: "abc" });

    expect(mockBucketDelete).not.toHaveBeenCalled();
  });

  it("does not throw when the R2 delete fails (non-fatal)", async () => {
    mockDeleteMedia.mockResolvedValue({ storagePath: "media/123-pic.png" });
    mockBucketDelete.mockRejectedValue(new Error("boom"));
    const deleteMediaTool = captureTools().get("delete_media")!;

    await expect(deleteMediaTool({ id: "abc" })).resolves.toBeDefined();
  });
});
