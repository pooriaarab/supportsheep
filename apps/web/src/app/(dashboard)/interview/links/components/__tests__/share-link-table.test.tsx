/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

// Mock the query hooks
const mockRevokeMutateAsync = vi.fn().mockResolvedValue({ success: true });
vi.mock("@/hooks/use-share-links-query", () => {
  return {
    useShareLinksQuery: vi.fn(() => ({
      data: [],
      isLoading: false,
    })),
    useRevokeShareLink: vi.fn(() => ({
      mutateAsync: mockRevokeMutateAsync,
      isPending: false,
    })),
    useCreateShareLink: vi.fn(() => ({
      mutateAsync: vi.fn(),
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

// Mock auth context
vi.mock("@/contexts/auth-context", () => {
  return {
    useAuth: vi.fn(() => ({
      user: { uid: "user-123" },
      loading: false,
    })),
  };
});

// Mock user query hook
vi.mock("@/hooks/use-users-query", () => {
  return {
    useUserQuery: vi.fn(() => ({
      data: { role: "admin" },
      isLoading: false,
    })),
  };
});

// Mock display settings hook
vi.mock("@/hooks/use-display-settings", () => {
  return {
    useDisplaySettings: vi.fn((key, defaults) => [defaults, vi.fn()]),
  };
});

// Mock DataTable and and other components to render inline
vi.mock("@/components/ui/data-display/data-table", () => {
  return {
    DataTable: ({ data, emptyMessage }: any) => (
      <div data-testid="data-table">
        {data.length === 0 ? <div>{emptyMessage}</div> : null}
      </div>
    ),
  };
});

vi.mock("@repo/ui/composites/empty-state", () => {
  return {
    EmptyState: ({ title, description }: any) => (
      <div data-testid="empty-state">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    ),
  };
});

vi.mock("@repo/ui/composites/responsive-dialog", () => {
  return {
    ResponsiveDialog: ({ children, open }: any) => open ? <div data-testid="dialog">{children}</div> : null,
    ResponsiveDialogContent: ({ children }: any) => <div>{children}</div>,
    ResponsiveDialogHeader: ({ children }: any) => <div>{children}</div>,
    ResponsiveDialogTitle: ({ children }: any) => <h2>{children}</h2>,
    ResponsiveDialogDescription: ({ children }: any) => <p>{children}</p>,
    ResponsiveDialogFooter: ({ children }: any) => <footer>{children}</footer>,
  };
});

vi.mock("@repo/ui/composites/confirm-dialog", () => {
  return {
    ConfirmDialog: ({ open, title }: any) => open ? <div data-testid="confirm-dialog">{title}</div> : null,
  };
});

vi.mock("@repo/ui/composites/bottom-bulk-actions-bar", () => {
  return {
    BottomBulkActionsBar: ({ count }: any) => count > 0 ? <div data-testid="bulk-actions">Selected: {count}</div> : null,
  };
});

// Import component
import { ShareLinkTable } from "../share-link-table";

describe("ShareLinkTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the empty state when no share links exist", () => {
    const html = renderToStaticMarkup(<ShareLinkTable />);
    expect(html).toContain("No share links yet");
  });
});
