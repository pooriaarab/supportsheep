import { describe, expect, it, vi, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { InCallLayoutDesktop } from "../in-call-layout-desktop";
import { useInterviewSession } from "@/hooks/use-interview-session";

// Mock the hook to isolate layout testing
const mockSendMessage = vi.fn();
const mockMute = vi.fn();
const mockEnd = vi.fn();

const baseSession = {
  canvas: {
    title: "Test In-Call Article",
    sections: [],
    meta: { description: "SEO Desc", tags: ["tech"], suggestedCategory: "Tech" },
  },
  orbState: "listening" as const,
  audioLevel: 0.35,
  reconnecting: false,
  writerActivity: {
    isAppending: false,
    lastWriteSectionId: null,
    hasEmptyTrailingSection: false,
  },
  sessionLockState: "owned" as const,
  sessionLockHolder: null,
  recoveryState: "none" as const,
  sendUserEditCue: vi.fn(),
  sendTimeRemainingCue: vi.fn(),
  recentToolCalls: [] as Array<{
    key: string;
    name: string;
    label: string;
    status: "applied" | "failed";
    observedAt: number;
    errorMessage?: string | null;
  }>,
  chatTurns: [],
  requestTakeover: vi.fn(),
  sendMessage: mockSendMessage,
  mute: mockMute,
  end: mockEnd,
};

vi.mock("@/hooks/use-interview-session", () => ({
  useInterviewSession: vi.fn(),
}));

// Mock the Daily-SDK surface — the real component requires a browser runtime
// (WebRTC, MediaStream) we don't get under happy-dom SSR.
vi.mock("@/components/interview/video/daily-video-call", () => ({
  DailyVideoCall: (props: { tavusUrl: string }) => (
    <div data-testid="daily-video-call" data-tavus-url={props.tavusUrl}>
      Daily video call
    </div>
  ),
}));

const mockedUseInterviewSession = vi.mocked(useInterviewSession);

function mockSession(overrides: Partial<typeof baseSession> = {}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockedUseInterviewSession.mockReturnValue({ ...baseSession, ...overrides } as any);
}

describe("InCallLayoutDesktop", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders desktop layout header, timer, and controls", () => {
    mockSession();
    const html = renderToStaticMarkup(
      <InCallLayoutDesktop
        interviewId="int-abc"
        interviewToken="token-123"
        ephemeralOpenAiToken="token-oai"
        topic="SaaS Scaling Strategies"
        guestName="Jane Founder"
      />
    );

    // Header Logo and Titles — BlogBat wordmark SVG + "Interview" label.
    expect(html).toContain('alt="BlogBat"');
    expect(html).toContain("Interview");
    expect(html).toContain("SaaS Scaling Strategies");
    expect(html).toContain("Jane Founder");

    // Audio status & Controls — the single-line orb caption now surfaces
    // the most relevant state ("Listening to you" when the orb is listening
    // and no tool call is in flight). Replaces the prior two-line layout
    // ("AI is Listening" + tool sub-caption).
    expect(html).toContain("Listening to you");
    expect(html).not.toContain("AI is Listening");
    expect(html).toContain('data-testid="orb-caption"');
    expect(html).toContain("Mute microphone");
    expect(html).toContain("End Session");

    // Tightened header: topic uses text-sm font-medium and is truncated with a
    // max width so long topics don't push the timer / End Session offscreen.
    expect(html).toMatch(/truncate[^"]*max-w-md[^"]*text-sm[^"]*font-medium/);
    // Header row uses tightened spacing (gap-3) and responsive padding.
    expect(html).toMatch(/h-14[^"]*items-center[^"]*gap-3[^"]*px-4[^"]*sm:px-6/);
  });

  it("renders the canvas full-bleed with the floating orb cluster and persistent sidebar", () => {
    mockSession();
    const html = renderToStaticMarkup(
      <InCallLayoutDesktop
        interviewId="int-abc"
        interviewToken="token-123"
        ephemeralOpenAiToken="token-oai"
      />
    );

    // The "Guiding the Writer" chat panel and the standalone left-column
    // orb pane were removed — the orb now lives in a floating bottom-right
    // cluster (Loom-style webcam tile).
    expect(html).not.toContain("Guiding the Writer");
    expect(html).not.toContain("Send a quick note to steer the AI.");
    expect(html).not.toContain("Send a guide note to the AI writer...");
    expect(html).not.toContain("Verbatim capture details");

    // Canvas body renders through the collaborative TipTap editor; the
    // SSR pass only renders the wrapper since the editor mounts
    // client-side.
    expect(html).toContain("canvas-collaborative-editor");
    // The right sidebar (SEO / Image / EEAT) is mounted as a persistent
    // 2xl-only column; below 2xl it lives inside the Meta drawer trigger.
    expect(html).toContain("canvas-right-sidebar");

    // Floating orb cluster sits at the bottom-right, above the canvas.
    expect(html).toContain('data-testid="floating-orb-cluster"');
    expect(html).toContain('data-testid="floating-orb-card"');
    // The single-line dynamic orb caption (PR #340) lives inside the
    // floating cluster — see the "single-line orb caption" describe block
    // below for full priority-branch coverage.
    expect(html).toContain('data-testid="orb-caption"');
    expect(html).toMatch(/fixed[^"]*bottom-6[^"]*right-6/);
    // The orb card uses the rounded backdrop-blur surface.
    expect(html).toMatch(/rounded-2xl[^"]*bg-background\/60[^"]*backdrop-blur/);

    // Meta drawer trigger replaces the persistent sidebar below 2xl.
    expect(html).toContain('data-testid="meta-drawer-trigger"');
    expect(html).toContain('aria-label="Open SEO and metadata panel"');

    // Main grid uses single-column by default and adds the right sidebar
    // only at the 2xl breakpoint.
    expect(html).toMatch(/grid-cols-1[^"]*2xl:grid-cols-\[minmax\(0,1fr\)_320px\]/);
  });

  it("does not render the canvas-collapse toggle", () => {
    mockSession();
    const html = renderToStaticMarkup(
      <InCallLayoutDesktop
        interviewId="int-abc"
        interviewToken="token-123"
        ephemeralOpenAiToken="token-oai"
      />
    );
    // The collapse chevron and collapsed-state data attribute were removed
    // so the canvas always stays visible.
    expect(html).not.toContain("Collapse canvas");
    expect(html).not.toContain("Expand canvas");
    expect(html).not.toContain("data-canvas-collapsed");
    expect(html).toContain("canvas-collaborative-editor");
  });

  describe("single-line orb caption", () => {
    it("does not render the stacked ToolActivityFeed in the canvas pane", () => {
      mockSession({
        recentToolCalls: [
          {
            key: "k1",
            name: "insert_section",
            label: "Tips for Sustainable Growth",
            status: "applied",
            observedAt: Date.now(),
          },
          {
            key: "k2",
            name: "start_paragraph",
            label: "",
            status: "applied",
            observedAt: Date.now() - 1_000,
          },
        ],
      });
      const html = renderToStaticMarkup(
        <InCallLayoutDesktop
          interviewId="int-abc"
          interviewToken="token-123"
          ephemeralOpenAiToken="token-oai"
        />,
      );
      // The stacked feed used to live in the canvas pane (role="log",
      // aria-label="Recent AI tool activity"). It should no longer be
      // mounted at all so the canvas stays focused on the article draft.
      expect(html).not.toContain('aria-label="Recent AI tool activity"');
      // Also: only the newest tool name should appear — older entries from
      // the stack are no longer rendered.
      expect(html).not.toContain("start_paragraph");
    });

    it("surfaces the freshest tool call as the caption (tool > orb state)", () => {
      const now = Date.now();
      mockSession({
        orbState: "listening",
        recentToolCalls: [
          {
            key: "k1",
            name: "insert_section",
            label: "Tips for Sustainable Growth",
            status: "applied",
            observedAt: now,
          },
        ],
      });
      const html = renderToStaticMarkup(
        <InCallLayoutDesktop
          interviewId="int-abc"
          interviewToken="token-123"
          ephemeralOpenAiToken="token-oai"
        />,
      );
      // Single caption element, tagged with the newest tool name, using the
      // motion-safe fade-swap. Tool-call wins over the listening state.
      expect(html).toContain('data-testid="orb-caption"');
      expect(html).toContain('data-tool-name="insert_section"');
      expect(html).toContain("motion-safe:animate-orb-caption-fade");
      // Human-friendly label with trailing ellipsis denoting in-flight work.
      expect(html).toContain("Adding a section…");
      // The old two-line layout (status header above + tool indicator below)
      // is gone — there is no longer a "AI is Listening" header in the DOM.
      expect(html).not.toContain("AI is Listening");
      expect(html).not.toContain("animate-tool-indicator-fade");
    });

    it("falls back to 'Speaking' when the AI is speaking", () => {
      mockSession({ orbState: "speaking", recentToolCalls: [] });
      const html = renderToStaticMarkup(
        <InCallLayoutDesktop
          interviewId="int-abc"
          interviewToken="token-123"
          ephemeralOpenAiToken="token-oai"
        />,
      );
      expect(html).toContain('data-testid="orb-caption"');
      expect(html).toContain("Speaking");
      expect(html).not.toContain("AI is Speaking");
    });

    it("falls back to 'Thinking' when the AI is thinking", () => {
      mockSession({ orbState: "thinking", recentToolCalls: [] });
      const html = renderToStaticMarkup(
        <InCallLayoutDesktop
          interviewId="int-abc"
          interviewToken="token-123"
          ephemeralOpenAiToken="token-oai"
        />,
      );
      expect(html).toContain("Thinking");
      expect(html).not.toContain("AI is Thinking");
    });

    it("falls back to 'Listening to you' when the orb is listening", () => {
      mockSession({ orbState: "listening", recentToolCalls: [] });
      const html = renderToStaticMarkup(
        <InCallLayoutDesktop
          interviewId="int-abc"
          interviewToken="token-123"
          ephemeralOpenAiToken="token-oai"
        />,
      );
      expect(html).toContain("Listening to you");
    });

    it("renders no caption when idle", () => {
      mockSession({ orbState: "idle", recentToolCalls: [] });
      const html = renderToStaticMarkup(
        <InCallLayoutDesktop
          interviewId="int-abc"
          interviewToken="token-123"
          ephemeralOpenAiToken="token-oai"
        />,
      );
      // The orb caption element does not mount when the orb is idle and no
      // tool call is in flight — just the orb on the page.
      expect(html).not.toContain('data-testid="orb-caption"');
      expect(html).not.toContain("Standby");
    });
  });

  describe("video mode", () => {
    it("renders the Daily-SDK video tile in place of the orb when tavusUrl is set", () => {
      mockSession();
      const html = renderToStaticMarkup(
        <InCallLayoutDesktop
          interviewId="int-abc"
          ephemeralOpenAiToken="token-oai"
          tavusUrl="https://tavusapi.daily.co/room-abc?t=tok"
        />,
      );
      expect(html).toContain('data-testid="daily-video-call"');
      expect(html).toContain('data-tavus-url="https://tavusapi.daily.co/room-abc?t=tok"');
      // The voice-orb's defining SVG/canvas marker must not render in video
      // mode — the Tavus tile occupies its slot.
      expect(html).not.toContain('class="voice-orb"');
    });

    it("falls back to the VoiceOrb when no tavusUrl is provided", () => {
      mockSession();
      const html = renderToStaticMarkup(
        <InCallLayoutDesktop
          interviewId="int-abc"
          ephemeralOpenAiToken="token-oai"
        />,
      );
      expect(html).not.toContain('data-testid="daily-video-call"');
    });
  });
});
