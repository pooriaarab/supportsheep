// @vitest-environment node

import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import AdminQuestionsPage from "../page";

// Mock React hooks to run in Node environment
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return {
    ...actual,
    use: vi.fn((_promise: unknown) => {
      return { id: "link-123" };
    }),
    useState: vi.fn((init) => [typeof init === "function" ? (init as () => unknown)() : init, vi.fn()]),
    useMemo: vi.fn((fn) => (fn as () => unknown)()),
    useRef: vi.fn((init) => ({ current: init })),
    useEffect: vi.fn(),
  };
});

const mockUseShareLinksQuery = vi.hoisted(() => vi.fn());
const mockUseAuth = vi.hoisted(() => vi.fn());
const mockUseUserQuery = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-share-links-query", () => ({
  useShareLinksQuery: mockUseShareLinksQuery,
}));

vi.mock("@/contexts/auth-context", () => ({
  useAuth: mockUseAuth,
}));

vi.mock("@/hooks/use-users-query", () => ({
  useUserQuery: mockUseUserQuery,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock("@/components/ui/layout/page-shell", () => ({
  PageShell: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="page-shell">{children}</div>
  ),
}));

describe("AdminQuestionsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { uid: "user-123" } });
    mockUseUserQuery.mockReturnValue({ data: { role: "admin" } });
  });

  it("renders Loading share link... when query is loading", async () => {
    mockUseShareLinksQuery.mockReturnValue({
      data: [],
      isLoading: true,
      refetch: vi.fn(),
    });

    const pageResult = await AdminQuestionsPage({
      params: Promise.resolve({ id: "link-123" }),
    });

    const html = renderToStaticMarkup(pageResult);
    expect(html).toContain("Loading share link...");
  });

  it("renders Warning if link is not in async mode", async () => {
    mockUseShareLinksQuery.mockReturnValue({
      data: [
        {
          id: "link-123",
          mode: "live", // not async!
          asyncQuestions: [],
        },
      ],
      isLoading: false,
      refetch: vi.fn(),
    });

    const pageResult = await AdminQuestionsPage({
      params: Promise.resolve({ id: "link-123" }),
    });

    const html = renderToStaticMarkup(pageResult);
    expect(html).toContain("Not an Async Link");
  });

  it("renders empty state and record panel if asyncQuestions is empty", async () => {
    mockUseShareLinksQuery.mockReturnValue({
      data: [
        {
          id: "link-123",
          mode: "async",
          asyncQuestions: [],
        },
      ],
      isLoading: false,
      refetch: vi.fn(),
    });

    const pageResult = await AdminQuestionsPage({
      params: Promise.resolve({ id: "link-123" }),
    });

    const html = renderToStaticMarkup(pageResult);
    expect(html).toContain("Recorded Questions (0)");
    expect(html).toContain("No questions recorded");
    expect(html).toContain("Record New Question");
  });

  it("renders questions list when asyncQuestions exist", async () => {
    mockUseShareLinksQuery.mockReturnValue({
      data: [
        {
          id: "link-123",
          mode: "async",
          asyncQuestions: [
            { id: "q1", text: "What is your favorite framework?", audioStoragePath: "path/to/q1.webm" },
          ],
        },
      ],
      isLoading: false,
      refetch: vi.fn(),
    });

    const pageResult = await AdminQuestionsPage({
      params: Promise.resolve({ id: "link-123" }),
    });

    const html = renderToStaticMarkup(pageResult);
    expect(html).toContain("Recorded Questions (1)");
    expect(html).toContain("What is your favorite framework?");
    // F-001: audio storage paths must NOT be rendered into the HTML. The
    // legacy implementation interpolated the GCS path into a public URL.
    expect(html).not.toContain("path/to/q1.webm");
    // The new playback flow exposes a "Load audio" button that fetches a
    // signed URL via the recording-url endpoint on click.
    expect(html).toContain("Load audio");
  });
});
