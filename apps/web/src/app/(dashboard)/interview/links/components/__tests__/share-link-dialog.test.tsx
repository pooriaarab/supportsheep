/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

// Mock the TanStack Query hooks
vi.mock("@/hooks/use-share-links-query", () => {
  return {
    useCreateShareLink: vi.fn(() => ({
      mutateAsync: vi.fn().mockResolvedValue({ id: "link-1", token: "token-1" }),
      isPending: false,
    })),
  };
});

vi.mock("@/hooks/use-blog-config-query", () => {
  return {
    useBlogConfigQuery: vi.fn(() => ({
      data: {
        interview: {
          defaultStyle: "smart",
          defaultDurationSec: 300,
          defaultRecording: "transcript",
        },
      },
      isLoading: false,
    })),
  };
});

// Mock ResponsiveDialog components to render inline for static markup rendering
vi.mock("@repo/ui/composites/responsive-dialog", () => {
  return {
    ResponsiveDialog: ({ children, open }: any) => open ? <div data-testid="dialog">{children}</div> : null,
    ResponsiveDialogContent: ({ children }: any) => <div data-testid="dialog-content">{children}</div>,
    ResponsiveDialogHeader: ({ children }: any) => <div data-testid="dialog-header">{children}</div>,
    ResponsiveDialogTitle: ({ children }: any) => <h2>{children}</h2>,
    ResponsiveDialogDescription: ({ children }: any) => <p>{children}</p>,
    ResponsiveDialogFooter: ({ children }: any) => <footer>{children}</footer>,
  };
});

// Import component (fails in RED phase)
import { ShareLinkDialog } from "../share-link-dialog";

describe("ShareLinkDialog", () => {
  it("renders with all sections when open and handles visibility-based gating", () => {
    const onOpenChange = vi.fn();

    // Render with visibility = 'link' (should show gate/auth section)
    const htmlLink = renderToStaticMarkup(
      <ShareLinkDialog
        open={true}
        onOpenChange={onOpenChange}
        initialTopic="Test topic"
      />
    );

    expect(htmlLink).toContain("Create share link");
    expect(htmlLink).toContain("Who can join");
    expect(htmlLink).toContain("Gate (Link only)"); // Auth section shown
    expect(htmlLink).toContain("What it&#x27;s about");
    expect(htmlLink).toContain("Interview style");
    expect(htmlLink).toContain("What we capture");
    expect(htmlLink).toContain("Duration");
    expect(htmlLink).toContain("Validity");
    expect(htmlLink).toContain("Schedule Interview");
  });
});
