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
import { QuickCreateDialog } from "../quick-create-dialog";

describe("QuickCreateDialog", () => {
  it("renders with header, input, and options when open", () => {
    const onOpenChange = vi.fn();
    const onMoreOptions = vi.fn();

    const html = renderToStaticMarkup(
      <QuickCreateDialog
        open={true}
        onOpenChange={onOpenChange}
        onMoreOptions={onMoreOptions}
      />
    );

    expect(html).toContain("Quick create share link");
    expect(html).toContain("Topic");
    expect(html).toContain("More options");
    expect(html).toMatch(/type="submit"[^>]*>Create</);
  });
});
