"use client";

import { useRef } from "react";
import {
  DailyProvider,
  DailyVideo,
  DailyAudio,
  useCallObject,
  useDaily,
  useDailyEvent,
  useMeetingState,
  useParticipantIds,
  useLocalSessionId,
} from "@daily-co/daily-react";
import type { DailyEventObject } from "@daily-co/daily-js";
import { useMountEffect } from "@/hooks/use-mount-effect";
import { Loader2, AlertCircle } from "lucide-react";
import { createLogger } from "@/lib/logger";

const log = createLogger("components:daily-video-call");

interface DailyVideoCallProps {
  /** Daily / Tavus room URL with embedded token. */
  tavusUrl: string;
  /**
   * Hides the local-participant thumbnail when true. The writer is focused on
   * the canvas; their own preview rarely needs to be visible.
   */
  hideLocalPreview?: boolean;
}

/**
 * Custom Daily.co video call surface that replaces the prebuilt iframe. The
 * Tavus replica's video tile takes the same focal slot the audio mode's
 * `VoiceOrb` occupies, so the in-call layout reads the same to the user
 * across modes.
 *
 * The Tavus room is a Daily room under the hood, so we join via the JS SDK
 * directly with the `tavusUrl` and skip Daily's prebuilt chrome entirely.
 */
export function DailyVideoCall(props: DailyVideoCallProps) {
  const callObject = useCallObject({
    options: { url: props.tavusUrl },
  });

  return (
    <DailyProvider callObject={callObject}>
      <DailyVideoCallInner {...props} />
    </DailyProvider>
  );
}

function DailyVideoCallInner({ tavusUrl, hideLocalPreview }: DailyVideoCallProps) {
  const callObject = useDaily();
  const meetingState = useMeetingState();
  const localSessionId = useLocalSessionId();
  const remoteIds = useParticipantIds({ filter: "remote" });
  const joinedRef = useRef(false);

  // Auto-join when the call object is ready. Camera/mic permissions were
  // already granted on the device picker page so no pre-call prompt is
  // needed here.
  useMountEffect(() => {
    if (!callObject || joinedRef.current) return;
    joinedRef.current = true;
    callObject
      .join({ url: tavusUrl, startAudioOff: true })
      .then(() => {
        log.info("daily.joined", { url: tavusUrl });
      })
      .catch((err: unknown) => {
        log.error("daily.join_failed", { err });
      });

    return () => {
      callObject.leave().catch((err: unknown) => {
        log.error("daily.leave_failed", { err });
      });
    };
  });

  useDailyEvent("joined-meeting", (ev: DailyEventObject<"joined-meeting">) => {
    log.info("daily.event.joined-meeting", { participants: Object.keys(ev.participants ?? {}).length });
  });
  useDailyEvent(
    "participant-joined",
    (ev: DailyEventObject<"participant-joined">) => {
      log.info("daily.event.participant-joined", { sessionId: ev.participant.session_id });
    },
  );
  useDailyEvent(
    "participant-left",
    (ev: DailyEventObject<"participant-left">) => {
      log.info("daily.event.participant-left", { sessionId: ev.participant.session_id });
    },
  );
  useDailyEvent("error", (ev: DailyEventObject<"error">) => {
    log.error("daily.event.error", { errorMsg: ev.errorMsg });
  });

  const replicaSessionId = remoteIds[0] ?? null;
  const isJoined = meetingState === "joined-meeting";
  const hasError = meetingState === "error";

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Tavus replica video tile — the focal element, mirroring the orb's slot. */}
      <div className="relative w-full max-w-[280px] aspect-square overflow-hidden rounded-2xl bg-muted border border-border shadow-lg">
        {isJoined && replicaSessionId ? (
          <DailyVideo
            sessionId={replicaSessionId}
            type="video"
            fit="cover"
            automirror={false}
            className="w-full h-full object-cover"
          />
        ) : hasError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-destructive p-4 text-center">
            <AlertCircle className="w-6 h-6" />
            <span className="text-xs font-medium">Video connection failed</span>
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-xs">Connecting to your interviewer…</span>
          </div>
        )}

        {/* Picture-in-picture local preview tucked into the corner. Hidden by
         * default — the writer focuses on the canvas, not on watching
         * themselves. */}
        {!hideLocalPreview && isJoined && localSessionId && (
          <div className="absolute bottom-2 right-2 w-16 h-16 rounded-lg overflow-hidden border border-border bg-background shadow-md">
            <DailyVideo
              sessionId={localSessionId}
              type="video"
              fit="cover"
              automirror
              className="w-full h-full object-cover"
            />
          </div>
        )}
      </div>

      {/* Mount a hidden DailyAudio surface so the Tavus replica's audio routes
       * through dedicated <audio> elements. The OpenAI Realtime pipeline owns
       * the AI conversation audio separately — DailyAudio only carries Tavus
       * lip-sync visuals' accompanying audio, which Tavus mutes by default
       * when a separate audio source is wired in upstream. */}
      <DailyAudio />
    </div>
  );
}
