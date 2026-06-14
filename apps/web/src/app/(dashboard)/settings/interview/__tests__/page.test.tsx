/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { useQuery } from "@tanstack/react-query";
import InterviewSettingsPage from "../page";

// Mock react-query
vi.mock("@tanstack/react-query", () => {
  const mockQueryClient = {
    invalidateQueries: vi.fn(),
  };
  return {
    useQuery: vi.fn(),
    useMutation: vi.fn(() => ({
      mutate: vi.fn(),
      isPending: false,
    })),
    useQueryClient: vi.fn(() => mockQueryClient),
  };
});

// Mock router
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

// Mock PageHeader
vi.mock("@/components/ui/layout/page-header", () => ({
  PageHeader: ({ breadcrumbs }: any) => (
    <div data-testid="page-header">
      {breadcrumbs.map((b: any) => b.label).join(" > ")}
    </div>
  ),
}));

describe("InterviewSettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state", () => {
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as any);

    const html = renderToStaticMarkup(<InterviewSettingsPage />);
    expect(html).toContain("animate-spin");
  });

  it("renders full settings form with default configurations", () => {
    vi.mocked(useQuery).mockReturnValue({
      data: {
        interview: {
          defaultStyle: "smart",
          defaultDurationSec: 300,
          defaultRecording: "transcript",
          whoCanMintLinks: ["owner", "admin", "editor"],
          monthlyCostCapUsd: 500,
          retention: {
            audioDays: 90,
            transcriptDays: 365,
          },
        },
      },
      isLoading: false,
    } as any);

    const html = renderToStaticMarkup(<InterviewSettingsPage />);

    expect(html).toContain("Interview Workspace Settings");
    expect(html).toContain("Configure workspace-level defaults for AI-led interviews");
    expect(html).toContain("Default Style");
    expect(html).toContain("Default Duration");
    expect(html).toContain("Recording Mode");
    expect(html).toContain("Who Can Mint Share Links");
    expect(html).toContain("Monthly Cost Cap (USD)");
    expect(html).toContain("Retention Settings");
    expect(html).toContain("Audio Retention (Days)");
    expect(html).toContain("Transcript Retention (Days)");
    expect(html).toContain("Save Settings");
  });
});
