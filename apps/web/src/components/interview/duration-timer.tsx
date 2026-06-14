"use client";

import { useRef, useState } from "react";
import { useMountEffect } from "@/hooks/use-mount-effect";
import { createLogger } from "@/lib/logger";

const log = createLogger("components:duration-timer");

interface Props {
  maxDurationSeconds: number; // e.g. 300 for 5 minutes
  onWarning?: () => void;
  onCap?: () => void;
  /**
   * Fired once when exactly 60 seconds remain. Lets the consumer nudge the
   * AI to begin wrapping up the current topic so the call doesn't get
   * cut off mid-sentence at the cap. Only fires when the configured
   * duration is long enough for a 60s warning to be meaningful — i.e.
   * `maxDurationSeconds > 60`.
   */
  onOneMinuteWarning?: () => void;
  /**
   * Fired once when exactly 15 seconds remain. Lets the consumer push a
   * final wrap-up cue to the AI so it closes the conversation cleanly
   * instead of being yanked off air at zero. Only fires when the
   * configured duration is long enough — i.e. `maxDurationSeconds > 15`.
   */
  onFinalWarning?: () => void;
  className?: string;
}

export function DurationTimer({
  maxDurationSeconds,
  onWarning,
  onCap,
  onOneMinuteWarning,
  onFinalWarning,
  className,
}: Props) {
  const [elapsed, setElapsed] = useState(0);
  // Refs (not state) so callbacks fire from inside the interval — keeps the
  // setState updater pure (no side effects), which is required for React 18
  // Strict Mode + future concurrent renders where updaters may run twice.
  const warningTriggered = useRef(false);
  const capTriggered = useRef(false);
  const oneMinuteWarningTriggered = useRef(false);
  const finalWarningTriggered = useRef(false);

  useMountEffect(() => {
    log.info("Starting duration timer", { maxDurationSeconds });
    const warningThreshold = Math.floor(maxDurationSeconds * 0.9);
    // Threshold for the wrap-up nudge cues, expressed as elapsed seconds.
    // Skipping the cue entirely when the configured duration is too short
    // to make the warning meaningful — e.g. a 30s test session shouldn't
    // fire the 60s nudge at negative elapsed time.
    const oneMinuteThreshold = maxDurationSeconds - 60;
    const finalThreshold = maxDurationSeconds - 15;

    const intervalId = setInterval(() => {
      // Increment counter purely via state updater
      setElapsed((prev) => prev + 1);

      // Side effects belong in the interval callback, not the updater.
      // We re-read `elapsed` via a functional update on the NEXT tick wouldn't
      // work — use a local mutable counter instead, scoped to this interval.
    }, 1000);

    // Separate effect-tick that decides whether to fire callbacks.
    // The state value lags by one tick at most but the threshold check is
    // monotonic, so we use a parallel local counter to be precise.
    let localElapsed = 0;
    const sideEffectTick = setInterval(() => {
      localElapsed += 1;
      if (
        maxDurationSeconds > 60 &&
        localElapsed >= oneMinuteThreshold &&
        !oneMinuteWarningTriggered.current
      ) {
        oneMinuteWarningTriggered.current = true;
        log.info("Duration timer reached 60s-remaining wrap-up threshold");
        onOneMinuteWarning?.();
      }
      if (
        maxDurationSeconds > 15 &&
        localElapsed >= finalThreshold &&
        !finalWarningTriggered.current
      ) {
        finalWarningTriggered.current = true;
        log.info("Duration timer reached 15s-remaining wrap-up threshold");
        onFinalWarning?.();
      }
      if (localElapsed >= warningThreshold && !warningTriggered.current) {
        warningTriggered.current = true;
        log.warn("Duration timer reached 90% warning threshold");
        onWarning?.();
      }
      if (localElapsed >= maxDurationSeconds && !capTriggered.current) {
        capTriggered.current = true;
        log.error("Duration timer reached 100% cap");
        onCap?.();
      }
    }, 1000);

    return () => {
      log.info("Clearing duration timer");
      clearInterval(intervalId);
      clearInterval(sideEffectTick);
    };
  });

  const remaining = Math.max(0, maxDurationSeconds - elapsed);
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const formattedTime = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  const isLowTime = remaining <= Math.max(1, Math.floor(maxDurationSeconds * 0.1)); // 10% or less

  return (
    <div className={className}>
      <div
        className={`inline-flex items-center px-3 py-1 bg-muted/40 border text-xs font-semibold shadow-sm transition-all duration-300 rounded-full ${
          isLowTime
            ? "border-destructive/20 bg-destructive/10 text-destructive animate-pulse"
            : "border-border text-muted-foreground"
        }`}
        role="timer"
        aria-label={`Time remaining: ${formattedTime}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full mr-2 shrink-0 ${isLowTime ? "bg-destructive animate-ping" : "bg-success"}`} />
        <span className="tabular-nums">{formattedTime}</span>
      </div>
    </div>
  );
}
