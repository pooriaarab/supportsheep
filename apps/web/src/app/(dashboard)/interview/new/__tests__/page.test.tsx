/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import NewInterviewPage from "../page";

// Mock router
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

// Mock PageShell
vi.mock("@/components/ui/layout/page-shell", () => ({
  PageShell: ({ children }: any) => <div data-testid="page-shell">{children}</div>,
}));

describe("NewInterviewPage", () => {
  it("renders with header, input, select, and start button", () => {
    const html = renderToStaticMarkup(<NewInterviewPage />);

    expect(html).toContain("Start an interview");
    expect(html).toContain("Define the topic and settings for your AI-led interview.");
    expect(html).toContain("Interview Topic");
    expect(html).toContain("Interview Style");
    expect(html).toContain("Max Duration");
    expect(html).toContain("Start Interview");
  });
});
