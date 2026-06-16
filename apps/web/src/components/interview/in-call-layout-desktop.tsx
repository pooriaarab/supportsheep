"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useInterviewSession } from "@/hooks/use-interview-session";
import { VoiceOrb } from "@/components/ui/composites/voice-orb";
import { InterviewCanvas } from "@/components/interview/interview-canvas";
import { CanvasRightSidebar } from "@/components/interview/canvas-right-sidebar";
import { DurationTimer } from "@/components/interview/duration-timer";
import { SessionTakeoverDialog } from "@/components/interview/session-takeover-dialog";
import { DailyVideoCall } from "@/components/interview/video/daily-video-call";
import { labelForTool } from "@/lib/interviews/tool-labels";
import { Button } from "@repo/ui/primitives/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@repo/ui/primitives/sheet";
import {
  Mic,
  MicOff,
  PhoneOff,
  RefreshCw,
  AlertCircle,
  Loader2,
  PanelRight,
} from "lucide-react";

interface Props {
  interviewId: string;
  ephemeralOpenAiToken: string;
  topic?: string;
  guestName?: string;
  maxDurationSeconds?: number;
  /** Selected microphone deviceId from the pre-call device picker. */
  audioInputDeviceId?: string;
  /**
   * Daily / Tavus room URL when the interview is in video mode. When set,
   * the Tavus replica's video tile replaces the `VoiceOrb` in the floating
   * bottom-right card. The OpenAI Realtime audio pipeline still drives
   * the AI conversation — Daily only carries the Tavus replica visuals.
   */
  tavusUrl?: string;
}

/**
 * In-Call Layout — Loom/Twitch screen-recording overlay vibe.
 *
 * The canvas takes center stage as a full-bleed prose column (the
 * `RichTextEditorShell` supplies its own `max-w-3xl mx-auto` width). The
 * voice orb (or Tavus replica tile in video mode) floats in the bottom-
 * right as a small rounded card with a backdrop blur — sitting *over*
 * the canvas like a streamer's webcam tile rather than competing for
 * column real estate. The mute toggle stacks above the orb in the same
 * floating cluster, and a single-line dynamic status caption sits
 * directly beneath the orb.
 *
 * The SEO / Image / EEAT sidebar from W19.BC stays visible on wide
 * (`2xl:` ≥1536px) screens. Below that breakpoint it collapses into a
 * "Meta" button in the header that opens a right-side `Sheet` drawer, so
 * the canvas keeps the full width on medium displays.
 */
export function InCallLayoutDesktop({
  interviewId,
  ephemeralOpenAiToken,
  topic = "Guest Interview",
  guestName,
  maxDurationSeconds = 600,
  audioInputDeviceId,
  tavusUrl,
}: Props) {
  const [isMuted, setIsMuted] = useState(false);
  const [callEnded, setCallEnded] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [endingError, setEndingError] = useState<string | null>(null);
  const [isTakingOver, setIsTakingOver] = useState(false);
  // Latches once the first end-request fires (button click OR AI
  // `end_interview` tool call) so a follow-on call cannot re-enter
  // handleEndCall while the first /end POST is still in flight. Without
  // this latch the model's "confirm then end" pattern could double-POST.
  const endInFlightRef = useRef(false);

  // The /end POST + navigation flow shared by the End Session button
  // and the AI `end_interview` tool path. Closes the WebRTC channel via
  // `endRealtime`; the AI path passes `undefined` because the hook has
  // already invoked `forceEnd` before calling us back.
  const runEndFlow = useCallback(
    async (endRealtime?: () => void) => {
      if (endInFlightRef.current) return;
      endInFlightRef.current = true;

      if (!callEnded) {
        endRealtime?.();
        setCallEnded(true);
      }
      setIsEnding(true);
      setEndingError(null);

      try {
        const res = await fetch(`/api/v1/interviews/${interviewId}/end`, {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!res.ok) {
          throw new Error(`Server returned status ${res.status}`);
        }

        // Successfully ended, redirect to the review page
        window.location.href = `/interview/${interviewId}/review`;
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : "An unexpected error occurred while ending the session";
        setEndingError(errorMsg);
        setIsEnding(false);
        // Allow the user to retry on failure — the latch only protects
        // the happy-path double-fire window, not the explicit retry
        // button.
        endInFlightRef.current = false;
      }
    },
    [callEnded, interviewId],
  );

  // The AI path: the hook has already torn down the realtime channel
  // (see `forceEnd` inside the end_interview branch of `onToolCall`), so
  // we only need to drive the /end POST + navigate.
  const handleAiRequestedEnd = useCallback(() => {
    void runEndFlow();
  }, [runEndFlow]);

  const session = useInterviewSession({
    interviewId,
    ephemeralOpenAiToken,
    audioInputDeviceId,
    onEndRequested: handleAiRequestedEnd,
  });

  // The button path: end the realtime channel from the consumer side
  // (the AI didn't trigger this) and then drive the same shared flow.
  const handleEndCall = useCallback(() => {
    void runEndFlow(session.end);
  }, [runEndFlow, session.end]);

  // Wrap-up nudges: the duration timer fires these once each as it
  // approaches the hard cap so the AI can finish its current thought
  // gracefully and call `end_interview` itself instead of being yanked
  // off air mid-sentence by the cap-driven End Session path. The cue
  // text is delivered to the realtime model as a [SYSTEM] marker — the
  // system prompt teaches the model to interpret these as wrap-up
  // directives, not literal user speech.
  const handleOneMinuteWarning = useCallback(() => {
    session.sendTimeRemainingCue(
      "[SYSTEM] One minute remaining. Wrap up the current topic naturally, then end the conversation cleanly.",
    );
  }, [session.sendTimeRemainingCue]);

  const handleFinalWarning = useCallback(() => {
    session.sendTimeRemainingCue(
      "[SYSTEM] 15 seconds left. Finish your current sentence, thank the user, and call end_interview now.",
    );
  }, [session.sendTimeRemainingCue]);

  // Single-line orb caption. Surfaces the most relevant state, with
  // strict priority:
  //   1. Newest tool call still inside the recent-tool TTL window
  //   2. AI speaking
  //   3. AI thinking
  //   4. User speaking (orb listening)
  //   5. Otherwise empty (idle / connecting fall through to null, muted
  //      and error each render their own subtle fallback)
  // `recentToolCalls` is most-recent-first and TTL-evicted by the hook,
  // so the freshest entry is always at index 0.
  const orbCaption = useMemo<{ text: string; key: string; toolName?: string } | null>(() => {
    const newestTool = session.recentToolCalls[0];
    if (newestTool) {
      return {
        text: `${labelForTool(newestTool.name)}…`,
        key: `tool-${newestTool.name}-${newestTool.observedAt}`,
        toolName: newestTool.name,
      };
    }
    if (session.orbState === "speaking") {
      return { text: "Speaking", key: "state-speaking" };
    }
    if (session.orbState === "thinking") {
      return { text: "Thinking", key: "state-thinking" };
    }
    if (session.orbState === "listening") {
      return { text: "Listening to you", key: "state-listening" };
    }
    if (session.orbState === "muted") {
      return { text: "Microphone muted", key: "state-muted" };
    }
    if (session.orbState === "error") {
      return { text: "Connection error", key: "state-error" };
    }
    return null;
  }, [session.recentToolCalls, session.orbState]);

  const handleTakeover = async () => {
    setIsTakingOver(true);
    try {
      await session.requestTakeover();
    } finally {
      setIsTakingOver(false);
    }
  };

  const handleMuteToggle = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    session.mute(nextMuted);
  };

  if (callEnded) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md space-y-6 p-8 bg-card border border-border rounded-xl shadow-xl">
          {isEnding ? (
            <div className="space-y-6 py-4">
              <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto" />
              <div className="space-y-2">
                <h1 className="text-xl font-bold text-foreground">Compiling & Polishing Your Draft...</h1>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Please hold on! The AI writer is finalizing, optimizing, and organizing your verbatim insights into a structured article draft.
                </p>
              </div>
            </div>
          ) : endingError ? (
            <div className="space-y-6">
              <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center text-destructive mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <h1 className="text-xl font-bold text-foreground">Failed to Finalize Session</h1>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {endingError}
                </p>
              </div>
              <div className="pt-2 flex flex-col gap-2">
                <Button onClick={handleEndCall} className="w-full text-xs font-semibold py-2">
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  Retry Finalizing
                </Button>
                <Button asChild variant="outline" className="w-full text-xs font-semibold py-2">
                  <a href={`/interview/${interviewId}/review`}>Return to Summary</a>
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="w-12 h-12 bg-success/10 rounded-full flex items-center justify-center text-success mx-auto">
                <PhoneOff className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <h1 className="text-xl font-bold text-foreground">Interview Session Completed</h1>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Thank you for sharing your expertise! Your verbatim insights have been captured.
                  The AI writer is now compiling, polishing, and optimizing your draft article.
                </p>
              </div>
              <div className="pt-2">
                <Button asChild className="w-full text-xs font-semibold py-2">
                  <a href={`/interview/${interviewId}/review`}>Go to Review Page</a>
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col text-foreground">
      <SessionTakeoverDialog
        open={session.sessionLockState === "blocked"}
        onTakeover={handleTakeover}
        currentHolder={session.sessionLockHolder}
        isTakingOver={isTakingOver}
      />
      {session.recoveryState === "restored" && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-3 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-3 py-1.5 bg-card border border-border rounded-full shadow-sm text-xs text-muted-foreground animate-pulse"
        >
          <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
          <span>Resuming previous session…</span>
        </div>
      )}

      {/* Sticky Header — keeps the height tight at h-14. */}
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
          {/* Left group: logo + topic title + guest name */}
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Image
              src="/supportsheep-header-logo.svg"
              alt="Supportsheep"
              width={72}
              height={20}
              priority
              className="h-5 w-auto shrink-0"
            />
            <span className="hidden sm:inline text-xs font-medium tracking-tight text-muted-foreground shrink-0">
              Interview
            </span>
            <div className="h-4 w-px bg-border shrink-0 mx-1" aria-hidden="true" />
            <div className="flex min-w-0 items-baseline gap-2">
              <p className="truncate max-w-md text-sm font-medium text-foreground">{topic}</p>
              {guestName && (
                <p className="hidden md:block shrink-0 text-xs text-muted-foreground truncate">
                  {guestName}
                </p>
              )}
            </div>
          </div>

          {/* Right group: timer + Meta drawer (sub-2xl) + End Session */}
          <div className="flex items-center gap-2 shrink-0">
            <DurationTimer
              maxDurationSeconds={maxDurationSeconds}
              onWarning={() => {}}
              onCap={handleEndCall}
              onOneMinuteWarning={handleOneMinuteWarning}
              onFinalWarning={handleFinalWarning}
              className="hidden sm:block shrink-0"
            />

            {/* Meta drawer trigger — only shown below the 2xl breakpoint
                where the persistent right sidebar is hidden. Opens the
                SEO/Image/EEAT panel in a slide-over Sheet so wide-canvas
                viewports still get one-click access to the metadata. */}
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-2.5 text-xs font-semibold gap-1.5 shrink-0 2xl:hidden"
                  aria-label="Open SEO and metadata panel"
                  data-testid="meta-drawer-trigger"
                >
                  <PanelRight className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Meta</span>
                </Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="w-full sm:max-w-md p-0 flex flex-col"
                data-testid="meta-drawer"
              >
                <SheetHeader className="border-b border-border">
                  <SheetTitle className="text-sm">SEO, Image &amp; EEAT</SheetTitle>
                </SheetHeader>
                <div className="flex-1 overflow-hidden">
                  <CanvasRightSidebar
                    canvas={session.canvas}
                    guestName={guestName}
                    className="w-full h-full border-l-0"
                  />
                </div>
              </SheetContent>
            </Sheet>

            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleEndCall}
              className="h-8 px-3 text-xs font-semibold gap-1.5 shrink-0"
            >
              <PhoneOff className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">End Session</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main area — canvas takes center stage, full-bleed. The right
          sidebar (SEO/Image/EEAT) only mounts as a permanent column on
          `2xl:` viewports; below that it lives in the drawer above. */}
      <main className="flex-1 grid grid-cols-1 gap-0 h-[calc(100vh-3.5rem)] overflow-hidden 2xl:grid-cols-[minmax(0,1fr)_320px]">
        {/* Canvas column — single full-bleed prose column. The shell
            (`RichTextEditorShell`) supplies its own `max-w-3xl mx-auto`
            inner column so the canvas matches the post editor at
            `/[postId]/edit`. */}
        <section
          className="h-full overflow-hidden flex flex-col px-4 sm:px-6 pt-4 pb-6"
          data-testid="in-call-canvas-column"
        >
          <InterviewCanvas
            canvas={session.canvas}
            topic={topic}
            writerActivity={session.writerActivity}
            onUserEdit={session.sendUserEditCue}
            guestName={guestName}
            className="flex-1 flex flex-col min-h-0"
          />
        </section>

        {/* Persistent SEO sidebar — only above 2xl (≥1536px). */}
        <aside className="hidden 2xl:flex h-full overflow-hidden border-l border-border bg-card">
          <CanvasRightSidebar
            canvas={session.canvas}
            guestName={guestName}
            className="w-full border-l-0 rounded-none border-0 bg-card"
          />
        </aside>
      </main>

      {/* Floating orb cluster (Loom-style webcam tile) — bottom-right.
          Sits above the canvas, below modals (z-30). The mute toggle is
          stacked directly above the orb; the orb caption (single-line
          dynamic status) hangs underneath. On `2xl:` viewports the
          cluster shifts left by the sidebar width (320px + 24px gutter)
          so it sits just left of the persistent sidebar edge instead
          of overlapping it. When `tavusUrl` is set the Tavus replica
          tile takes the orb's slot — the focal element changes but the
          cluster shape stays identical. */}
      <div
        className="fixed bottom-6 right-6 z-30 flex flex-col items-center gap-2 pointer-events-none 2xl:right-[344px]"
        data-testid="floating-orb-cluster"
      >
        {/* Mute toggle — stacked above the orb. */}
        <Button
          type="button"
          variant={isMuted ? "destructive" : "outline"}
          size="icon"
          onClick={handleMuteToggle}
          className="w-9 h-9 rounded-full shadow-md pointer-events-auto bg-background/80 backdrop-blur"
          aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
          data-testid="floating-mute-toggle"
        >
          {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </Button>

        {/* Orb (or Tavus replica) card — rounded backdrop-blur tile, the
            streamer's webcam. On narrow viewports the card shrinks and
            the orb size steps down from md (128px) to sm (64px). */}
        <div
          className="relative rounded-2xl border border-border bg-background/60 backdrop-blur shadow-lg pointer-events-auto p-3 flex flex-col items-center"
          data-testid="floating-orb-card"
        >
          {session.reconnecting && (
            <div className="absolute -top-2 -right-2 flex items-center gap-1 px-1.5 py-0.5 bg-accent/10 border border-accent/20 rounded-full text-[10px] font-semibold text-accent animate-pulse">
              <RefreshCw className="w-2.5 h-2.5 animate-spin" />
              <span className="hidden sm:inline">Reconnecting</span>
            </div>
          )}
          {tavusUrl ? (
            <DailyVideoCall tavusUrl={tavusUrl} hideLocalPreview />
          ) : (
            <>
              <div className="hidden sm:block">
                <VoiceOrb
                  state={session.orbState}
                  audioLevel={session.audioLevel}
                  size="md"
                />
              </div>
              <div className="sm:hidden">
                <VoiceOrb
                  state={session.orbState}
                  audioLevel={session.audioLevel}
                  size="sm"
                />
              </div>
            </>
          )}
        </div>

        {/* Single dynamic orb caption — replaces the previous two-line
            status. Remounts on `key` change so the motion-safe fade-swap
            (~200ms) replays on every state transition. */}
        {orbCaption && (
          <p
            key={orbCaption.key}
            role="status"
            aria-live="polite"
            data-testid="orb-caption"
            data-tool-name={orbCaption.toolName}
            className="text-[11px] text-muted-foreground tracking-tight truncate motion-safe:animate-orb-caption-fade rounded-full bg-background/70 backdrop-blur border border-border px-3 py-1 shadow-sm pointer-events-auto text-center max-w-[200px]"
          >
            {orbCaption.text}
          </p>
        )}

        {/* The previous W24.D floating-cluster "AI is reading your edits"
            badge has been replaced by an inline locational chip rendered
            as a ProseMirror widget decoration AT THE POSITION the user
            just typed at — same Figma / Notion / Google Docs pattern the
            AI and human collaborator cursors above use. See
            `AiSawItDecoration` wired into
            `canvas-collaborative-editor.tsx`. */}
      </div>
    </div>
  );
}
