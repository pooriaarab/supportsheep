"use client";

import { useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { Button } from "@repo/ui/primitives/button";
import { useMountEffect } from "@/hooks/use-mount-effect";
import { useLatestRef } from "@/hooks/use-latest-ref";
import { createLogger } from "@/lib/logger";

const log = createLogger("interview:canvas-typing-sound");

const STORAGE_KEY = "interview:canvas-typing-sound-enabled";
/** Approx keystroke cadence — ~8 clicks/sec feels like a brisk typewriter. */
const CLICK_INTERVAL_MS = 120;
/** Very low amplitude so the click is felt, not heard, over the user's voice. */
const CLICK_GAIN = 0.04;

interface Props {
  /** True while the writer is actively appending content. Drives the audio
   *  loop on/off. */
  isAppending: boolean;
  className?: string;
}

/**
 * Optional typewriter-click feedback while the AI is appending to the canvas.
 *
 * Muted by default — the user opts in with the speaker icon and the choice
 * persists in `localStorage`. Sounds are synthesised on-the-fly with
 * `AudioContext` (short noise bursts shaped by a band-pass filter), so no
 * audio assets ship in the bundle.
 */
export function CanvasTypingSound({ isAppending, className }: Props) {
  const [enabled, setEnabled] = useState(false);
  const enabledRef = useLatestRef(enabled);
  const appendingRef = useLatestRef(isAppending);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useMountEffect(() => {
    try {
      const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
      if (stored === "1") {
        setEnabled(true);
        // useLatestRef syncs via insertion effect on the next render, but the
        // polling loop below starts immediately — prime the ref so the first
        // few ticks see the enabled flag without a one-render lag.
        enabledRef.current = true;
      }
    } catch (err) {
      log.warn("Failed to read typing-sound preference", { error: err });
    }

    // Single polling loop reads the latest enabled/appending refs and emits a
    // click each tick when both are true. This avoids re-creating intervals
    // when props change and keeps the cadence stable.
    timerRef.current = setInterval(() => {
      if (!enabledRef.current || !appendingRef.current) return;
      const ctx = ensureAudioContext(audioCtxRef, masterGainRef);
      if (!ctx) return;
      playClick(ctx, masterGainRef.current!);
    }, CLICK_INTERVAL_MS);

    return () => {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      audioCtxRef.current?.close().catch(() => undefined);
      audioCtxRef.current = null;
      masterGainRef.current = null;
    };
  });

  const handleToggle = () => {
    const next = !enabled;
    setEnabled(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch (err) {
      log.warn("Failed to persist typing-sound preference", { error: err });
    }
    log.info("User toggled canvas typing sound", { enabled: next });
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={handleToggle}
      aria-label={enabled ? "Mute writing sound" : "Unmute writing sound"}
      aria-pressed={enabled}
      className={["w-7 h-7 text-muted-foreground hover:text-foreground", className ?? ""].join(" ").trim()}
    >
      {enabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
    </Button>
  );
}

function ensureAudioContext(
  audioCtxRef: React.MutableRefObject<AudioContext | null>,
  masterGainRef: React.MutableRefObject<GainNode | null>,
): AudioContext | null {
  if (audioCtxRef.current) return audioCtxRef.current;
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) {
      log.warn("AudioContext not available; cannot play typing sound");
      return null;
    }
    const ctx = new Ctor();
    const gain = ctx.createGain();
    gain.gain.value = CLICK_GAIN;
    gain.connect(ctx.destination);
    audioCtxRef.current = ctx;
    masterGainRef.current = gain;
    void ctx.resume().catch(() => undefined);
    return ctx;
  } catch (err) {
    log.warn("Failed to initialise AudioContext", { error: err });
    return null;
  }
}

/** Synthesise a single short keystroke click (~12ms band-passed noise burst). */
function playClick(ctx: AudioContext, out: AudioNode): void {
  const sampleRate = ctx.sampleRate;
  const duration = 0.012;
  const frames = Math.max(1, Math.floor(sampleRate * duration));
  const buffer = ctx.createBuffer(1, frames, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i += 1) {
    // Decaying white noise gives a percussive "tick" with no tonal artefacts.
    const decay = 1 - i / frames;
    data[i] = (Math.random() * 2 - 1) * decay * decay;
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 2200;
  filter.Q.value = 1.4;
  src.connect(filter);
  filter.connect(out);
  src.start();
  src.stop(ctx.currentTime + duration + 0.005);
}
