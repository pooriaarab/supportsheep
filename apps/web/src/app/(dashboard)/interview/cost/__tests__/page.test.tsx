/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import CostDashboardPage from "../page";

const mockUseAuth = vi.hoisted(() => vi.fn());
const mockUseUserQuery = vi.hoisted(() => vi.fn());
const mockUseInterviewCostSummary = vi.hoisted(() => vi.fn());

// Mock Auth Context
vi.mock("@/contexts/auth-context", () => ({
  useAuth: mockUseAuth,
}));

// Mock Hooks
vi.mock("@/hooks/use-users-query", () => ({
  useUserQuery: mockUseUserQuery,
}));

vi.mock("@/hooks/use-interview-cost-summary", () => ({
  useInterviewCostSummary: mockUseInterviewCostSummary,
}));

// Mock next/dynamic to render synchronously in tests
vi.mock("next/dynamic", () => ({
  default: () => {
    return function MockDynamicComponent() {
      return (
        <div data-testid="mock-charts">
          <h3>Daily Spend (Last 30 Days)</h3>
          <h3>Monthly Spend (Last 12 Months)</h3>
        </div>
      );
    };
  },
}));

// Mock PageShell
vi.mock("@/components/ui/layout/page-shell", () => ({
  PageShell: ({ breadcrumbs, children }: any) => (
    <div data-testid="page-shell">
      <div data-testid="breadcrumbs">
        {breadcrumbs.map((b: any) => b.label).join(" > ")}
      </div>
      {children}
    </div>
  ),
}));

describe("CostDashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: Authenticated user mock
    mockUseAuth.mockReturnValue({
      user: {
        uid: "test-user-123",
        email: "admin@example.com",
      },
    });

    // Default: User has admin role
    mockUseUserQuery.mockReturnValue({
      data: {
        role: "admin",
      },
      isLoading: false,
    });

    // Default: Summary metrics loaded
    mockUseInterviewCostSummary.mockReturnValue({
      data: {
        thisMonth: {
          totalUsd: 15.5,
          totalInterviews: 8,
          capUsd: 100,
          capUtilizationPct: 15.5,
        },
        byDay: [
          { date: "2026-05-19", costUsd: 5.5, interviews: 3 },
          { date: "2026-05-20", costUsd: 10.0, interviews: 5 },
        ],
        byMonth: [
          { month: "2026-04", costUsd: 25.0, interviews: 12 },
          { month: "2026-05", costUsd: 15.5, interviews: 8 },
        ],
      },
      isLoading: false,
    });
  });

  it("renders permission checking/loading state when profile is loading", () => {
    mockUseUserQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    const html = renderToStaticMarkup(<CostDashboardPage />);
    expect(html).toContain("Checking admin permissions");
  });

  it("renders forbidden message when user is not authorized", () => {
    mockUseUserQuery.mockReturnValue({
      data: {
        role: "member", // not admin/editor/owner
      },
      isLoading: false,
    });

    const html = renderToStaticMarkup(<CostDashboardPage />);
    expect(html).toContain("You are not authorized to view this page");
  });

  it("renders metrics loader when summary is loading", () => {
    mockUseInterviewCostSummary.mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    const html = renderToStaticMarkup(<CostDashboardPage />);
    expect(html).toContain("Loading summary");
  });

  it("renders full dashboard with headline metrics, progress bar, and charts when authorized", () => {
    const html = renderToStaticMarkup(<CostDashboardPage />);

    // Check header
    expect(html).toContain("Interview Spend &amp; Costs");

    // Check KPI metrics
    expect(html).toContain("$15.50"); // spend
    expect(html).toContain("8"); // ended interviews
    expect(html).toContain("$100"); // monthly cap

    // Check progress bar and utilization
    expect(html).toContain("15.5%");

    // Check charts sections
    expect(html).toContain("Daily Spend (Last 30 Days)");
    expect(html).toContain("Monthly Spend (Last 12 Months)");
  });
});
