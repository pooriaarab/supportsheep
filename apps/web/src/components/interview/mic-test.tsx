"use client";

import { useState } from "react";
import { useMountEffect } from "@/hooks/use-mount-effect";
import { Button } from "@repo/ui/primitives/button";
import { Mic, CheckCircle, AlertTriangle } from "lucide-react";
import { createLogger } from "@/lib/logger";

const log = createLogger("components:mic-test");

interface Props {
  onContinue: () => void;
  className?: string;
}

export function MicTest({ onContinue, className }: Props) {
  const [level, setLevel] = useState(0); // 0..100
  const [permissionState, setPermissionState] = useState<"pending" | "granted" | "denied">("pending");

  useMountEffect(() => {
    let audioContext: AudioContext | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let analyser: AnalyserNode | null = null;
    let localStream: MediaStream | null = null;
    let animationFrameId: number | null = null;

    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        localStream = stream;
        setPermissionState("granted");

        try {
          audioContext = new AudioContext();
          source = audioContext.createMediaStreamSource(stream);
          analyser = audioContext.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);

          const dataArray = new Uint8Array(analyser.frequencyBinCount);

          const tick = () => {
            if (!analyser) return;
            analyser.getByteFrequencyData(dataArray);
            const sum = dataArray.reduce((a, b) => a + b, 0);
            const rawLevel = sum / dataArray.length / 255; // 0..1
            setLevel(Math.round(rawLevel * 100));
            animationFrameId = requestAnimationFrame(tick);
          };

          tick();
        } catch (err) {
          log.error("Web Audio API not supported or error setting up analyser", { error: err });
        }
      })
      .catch((err) => {
        log.error("Microphone access denied or error", { error: err });
        setPermissionState("denied");
      });

    return () => {
      log.info("Cleaning up MicTest media stream");
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
      if (audioContext) {
        audioContext.close().catch(() => {});
      }
      if (localStream) {
        for (const track of localStream.getTracks()) {
          track.stop();
        }
      }
    };
  });

  return (
    <div className={className}>
      <div className="space-y-5 max-w-sm mx-auto p-5 bg-card border border-border rounded-xl shadow-lg text-center">
        <div className="flex flex-col items-center gap-2.5">
          <div className="w-11 h-11 bg-primary/10 rounded-full flex items-center justify-center text-primary">
            <Mic className="w-5 h-5 animate-pulse" />
          </div>
          <div className="space-y-0.5">
            <h3 className="text-md font-bold text-foreground">Microphone Pre-flight Check</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">Test your vocal levels before starting the live interview.</p>
          </div>
        </div>

        {permissionState === "pending" && (
          <div className="space-y-2 py-4">
            <p className="text-xs text-muted-foreground animate-pulse">Requesting microphone access...</p>
          </div>
        )}

        {permissionState === "denied" && (
          <div className="space-y-4 py-1">
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2.5 text-left">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-destructive">Microphone Access Denied</p>
                <p className="text-[10px] text-muted-foreground leading-relaxed">Please grant microphone permissions in your browser bar.</p>
              </div>
            </div>
            <Button disabled className="w-full text-xs py-1.5 font-semibold">Continue</Button>
          </div>
        )}

        {permissionState === "granted" && (
          <div className="space-y-4 py-1">
            {/* VU Meter Bar */}
            <div className="space-y-1.5 text-left">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Vocal Level Indicator</span>
              <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden border border-border relative">
                <div
                  className="h-full bg-primary transition-all duration-75 ease-out"
                  style={{ width: `${level}%` }}
                />
              </div>
            </div>

            <div className="p-2.5 bg-success/10 border border-success/20 rounded-lg flex items-center gap-2 text-left">
              <CheckCircle className="w-4 h-4 text-success shrink-0" />
              <p className="text-[10px] text-success leading-relaxed">Vocal capture active and calibrated correctly.</p>
            </div>

            <Button onClick={onContinue} className="w-full text-xs py-1.5 font-semibold">
              Join Interview
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
