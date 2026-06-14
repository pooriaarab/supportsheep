/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useQuery } from "@tanstack/react-query";

// Mock react-query
vi.mock("@tanstack/react-query", () => {
  return {
    useQuery: vi.fn(),
  };
});

// Import the hook
import { useBlogConfigQuery } from "./use-blog-config-query";

describe("use-blog-config-query", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("registers query correctly and fetches blog config", async () => {
    vi.mocked(useQuery).mockReturnValue({ data: null, isLoading: true } as any);

    useBlogConfigQuery();

    expect(useQuery).toHaveBeenCalled();
    const queryCall = vi.mocked(useQuery).mock.calls[0][0];
    expect(queryCall.queryKey).toEqual(["blogConfig", "settings"]);

    // Test the fetch function
    const mockData = { blogId: "default", siteName: "Test" };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockData }),
    });

    const result = await (queryCall.queryFn as any)();
    expect(global.fetch).toHaveBeenCalledWith("/api/v1/config");
    expect(result).toEqual(mockData);
  });
});
