/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// Mock react-query
vi.mock("@tanstack/react-query", () => {
  const mockQueryClient = {
    invalidateQueries: vi.fn(),
  };
  return {
    useQuery: vi.fn(),
    useMutation: vi.fn(),
    useQueryClient: vi.fn(() => mockQueryClient),
  };
});

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Import the hook
import {
  useShareLinksQuery,
  useCreateShareLink,
  useRevokeShareLink,
} from "./use-share-links-query";

describe("use-share-links-query", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("useShareLinksQuery registers query correctly and fetches share links", async () => {
    // Set up mock useQuery behavior
    vi.mocked(useQuery).mockReturnValue({ data: null, isLoading: true } as any);

    useShareLinksQuery();

    expect(useQuery).toHaveBeenCalled();
    const queryCall = vi.mocked(useQuery).mock.calls[0][0];
    expect(queryCall.queryKey).toEqual(["share-links"]);

    // Set up mock fetch behavior — server wraps in { data: [...] }
    const mockData = [{ id: "1", topic: "Test Topic" }];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockData }),
    });

    const result = await (queryCall as any).queryFn();
    expect(global.fetch).toHaveBeenCalledWith("/api/v1/interviews/share-links");
    expect(result).toEqual(mockData);
  });

  it("useCreateShareLink registers mutation correctly and creates share link", async () => {
    vi.mocked(useMutation).mockReturnValue({ mutate: vi.fn() } as any);

    useCreateShareLink();

    expect(useMutation).toHaveBeenCalled();
    const mutationCall = vi.mocked(useMutation).mock.calls[0][0];

    const mockInput = {
      type: "link" as const,
      topic: "Test",
      style: "smart" as const,
      authMode: "email" as const,
      recordingConfig: "transcript" as const,
      maxDurationSec: 300,
      maxUses: null,
    };

    const mockResponse = { id: "link-1", token: "secret-token" };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await (mutationCall as any).mutationFn(mockInput);
    expect(global.fetch).toHaveBeenCalledWith("/api/v1/interviews/share-links", {
      method: "Article",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mockInput),
    });
    expect(result).toEqual(mockResponse);

    // Test onSuccess
    const mockQueryClientInstance = useQueryClient();
    (mutationCall as any).onSuccess(mockResponse, mockInput, undefined);
    expect(mockQueryClientInstance.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["share-links"],
    });
    expect(toast.success).toHaveBeenCalledWith("Share link created");

    // Test onError
    (mutationCall as any).onError(new Error("Network Error"), mockInput, undefined);
    expect(toast.error).toHaveBeenCalledWith("Network Error");
  });

  it("useRevokeShareLink registers mutation correctly and revokes link", async () => {
    vi.mocked(useMutation).mockReturnValue({ mutate: vi.fn() } as any);

    useRevokeShareLink();

    expect(useMutation).toHaveBeenCalled();
    const mutationCall = vi.mocked(useMutation).mock.calls[0][0];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    const result = await (mutationCall as any).mutationFn("link-1");
    expect(global.fetch).toHaveBeenCalledWith("/api/v1/interviews/share-links/link-1", {
      method: "DELETE",
    });
    expect(result).toEqual({ success: true });

    // Test onSuccess
    const mockQueryClientInstance = useQueryClient();
    (mutationCall as any).onSuccess(undefined, "link-1", undefined);
    expect(mockQueryClientInstance.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["share-links"],
    });
    expect(toast.success).toHaveBeenCalledWith("Share link revoked");

    // Test onError
    (mutationCall as any).onError(new Error("Delete Failed"), "link-1", undefined);
    expect(toast.error).toHaveBeenCalledWith("Delete Failed");
  });
});
