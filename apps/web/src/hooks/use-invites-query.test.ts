/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useMutation, useQueryClient } from "@tanstack/react-query";

// Mock react-query
vi.mock("@tanstack/react-query", () => {
  const mockQueryClient = {
    invalidateQueries: vi.fn(),
  };
  return {
    useMutation: vi.fn(),
    useQueryClient: vi.fn(() => mockQueryClient),
  };
});

import { useCreateInviteMutation } from "./use-invites-query";

describe("use-invites-query", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("posts the invite to the knowledge base-scoped endpoint with email and role", async () => {
    vi.mocked(useMutation).mockReturnValue({ mutate: vi.fn() } as any);

    useCreateInviteMutation();

    expect(useMutation).toHaveBeenCalled();
    const mutationCall = vi.mocked(useMutation).mock.calls[0][0];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ invited: true }),
    });

    const result = await (mutationCall as any).mutationFn({
      blogId: "blog-1",
      email: "person@example.com",
      role: "editor",
    });

    expect(global.fetch).toHaveBeenCalledWith("/api/v1/blogs/blog-1/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "person@example.com", role: "editor" }),
    });
    expect(result).toEqual({ invited: true });

    // onSuccess refreshes the members list so an added existing user appears.
    const mockQueryClientInstance = useQueryClient();
    (mutationCall as any).onSuccess({ invited: true }, {}, undefined);
    expect(mockQueryClientInstance.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["users"],
    });
  });

  it("url-encodes the knowledge baseId path segment", async () => {
    vi.mocked(useMutation).mockReturnValue({ mutate: vi.fn() } as any);
    useCreateInviteMutation();
    const mutationCall = vi.mocked(useMutation).mock.calls[0][0];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ added: true }),
    });

    await (mutationCall as any).mutationFn({
      blogId: "blog/with space",
      email: "a@b.com",
      role: "viewer",
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/v1/blogs/blog%2Fwith%20space/invites",
      expect.anything(),
    );
  });

  it("surfaces the server error code so the dialog can map it to a message", async () => {
    vi.mocked(useMutation).mockReturnValue({ mutate: vi.fn() } as any);
    useCreateInviteMutation();
    const mutationCall = vi.mocked(useMutation).mock.calls[0][0];

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "already_member" }),
    });

    await expect(
      (mutationCall as any).mutationFn({
        blogId: "blog-1",
        email: "dup@example.com",
        role: "author",
      }),
    ).rejects.toThrow("already_member");
  });
});
