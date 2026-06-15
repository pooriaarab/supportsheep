"use client";

import { useState } from "react";
import { Card } from "@repo/ui/primitives/card";
import { Button } from "@repo/ui/primitives/button";
import {
  DevicePicker,
  type DevicePickerMode,
  type DevicePickerSelection,
} from "@/components/interview/device-picker";

interface ConsentFormProps {
  token: string;
  interviewId: string;
  recordingConfig: string;
  topic: string | null;
  maxDurationSec: number;
}

// Once /consent returns, we stage the user on the device picker (instead of
// jumping straight to /live) so they can confirm mic/speaker/camera before
// the realtime session opens. Async / transcript-only interviews skip this
// step because there's no live media capture to configure.
//
// The interview token is delivered via an HttpOnly cookie scoped to
// `/api/v1/interviews/<id>` by POST /consent (see
// `buildInterviewTokenCookie`). It is intentionally NOT carried through
// the staged device-picker state or appended to URLs — the browser
// attaches it to every subsequent same-origin API request automatically,
// and keeping it out of URLs eliminates leaks into history/Referer/server
// access logs.
type FlowStage =
  | { kind: "consent" }
  | {
      kind: "device-picker";
      mode: DevicePickerMode;
      ephemeral: string;
      tavusUrl: string;
    };

export function ConsentForm({
  token,
  interviewId,
  recordingConfig,
  topic,
  maxDurationSec,
}: ConsentFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<FlowStage>({ kind: "consent" });
  const durationMin = Math.round(maxDurationSec / 60);

  const buildLiveUrl = (
    mode: DevicePickerMode,
    ephemeral: string,
    tavusUrl: string,
    selection: DevicePickerSelection,
  ): string => {
    if (mode === "video") {
      const params = new URLSearchParams({
        interview: interviewId,
        tavusUrl,
        ephemeral,
      });
      if (selection.audioInputDeviceId) {
        params.set("mic", selection.audioInputDeviceId);
      }
      return `/i/${token}/live/video?${params.toString()}`;
    }
    const params = new URLSearchParams({
      interview: interviewId,
      ephemeral,
    });
    if (selection.audioInputDeviceId) {
      params.set("mic", selection.audioInputDeviceId);
    }
    return `/i/${token}/live?${params.toString()}`;
  };

  const onAccept = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/interviews/${interviewId}/consent`, {
        method: "Article",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmed: true,
          shareLinkToken: token,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to submit consent");
      }

      const data = await res.json();

      if (data.mode === "async") {
        window.location.href = `/i/${token}/async?interview=${encodeURIComponent(interviewId)}`;
        return;
      }

      const ephemeral = data.client_secret?.value || "";
      const tavusUrl = data.tavusConversationUrl || "";
      const mode: DevicePickerMode =
        recordingConfig === "video"
          ? "video"
          : recordingConfig === "audio"
            ? "audio"
            : "transcript";

      // Stage the device picker before navigating to /live so the user
      // grants camera/mic permission and pins the correct inputs while we
      // still own the page. Transcript-only mode skips it — no live capture
      // is configured beyond browser defaults.
      if (mode === "transcript") {
        window.location.href = buildLiveUrl(mode, ephemeral, tavusUrl, {
          audioInputDeviceId: null,
          audioOutputDeviceId: null,
          videoInputDeviceId: null,
        });
        return;
      }

      setStage({ kind: "device-picker", mode, ephemeral, tavusUrl });
      setLoading(false);
    } catch (err: unknown) {
      const errorWithMessage = err as { message?: string };
      setError(errorWithMessage.message || "An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  };

  const onDevicePickerConfirm = (selection: DevicePickerSelection) => {
    if (stage.kind !== "device-picker") return;
    window.location.href = buildLiveUrl(
      stage.mode,
      stage.ephemeral,
      stage.tavusUrl,
      selection,
    );
  };

  const onDecline = () => {
    // Redirect back to the landing page with a declined query param
    window.location.href = `/i/${token}?declined=1`;
  };

  if (stage.kind === "device-picker") {
    return (
      <DevicePicker
        mode={stage.mode}
        onConfirm={onDevicePickerConfirm}
        ctaLabel="Use these devices"
      />
    );
  }

  return (
    <div className="max-w-xl mx-auto mt-12 px-4">
      <Card className="p-8 shadow-md border border-border bg-card space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Consent and Privacy Agreement
          </h1>
          {topic && (
            <p className="text-muted-foreground text-sm">
              Interview Topic: <span className="font-semibold text-foreground">{topic}</span>
            </p>
          )}
        </div>

        <div className="prose prose-sm dark:prose-invert text-muted-foreground leading-relaxed space-y-4">
          <p>
            Before we begin the interview, we want to inform you about how your data will be
            handled. This conversation is led by an AI interviewer and will take approximately{" "}
            {durationMin} minutes.
          </p>

          {recordingConfig === "video" ? (
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 text-foreground text-sm space-y-2">
              <p className="font-semibold">Video & Transcript Recording</p>
              <p className="text-muted-foreground">
                By participating, you consent to the recording of your video and audio input and the
                generation of a text transcript. This video and transcript will be processed to
                generate summaries and case studies.
              </p>
            </div>
          ) : recordingConfig === "audio" ? (
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 text-foreground text-sm space-y-2">
              <p className="font-semibold">Audio & Transcript Recording</p>
              <p className="text-muted-foreground">
                By participating, you consent to the recording of your voice/audio input and the
                generation of a text transcript. This audio and transcript will be processed to
                generate summaries and case studies.
              </p>
            </div>
          ) : (
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 text-foreground text-sm space-y-2">
              <p className="font-semibold">Transcript Only</p>
              <p className="text-muted-foreground">
                By participating, you consent to the generation of a text transcript from your responses.
                No persistent audio recordings will be saved. Your text transcript will be processed to
                generate summaries and case studies.
              </p>
            </div>
          )}

          <p>
            Your responses and data will be private and managed securely in accordance with our
            privacy standards.
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm font-medium border border-destructive/20">
            {error}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Button
            onClick={onDecline}
            variant="outline"
            className="sm:flex-1"
            disabled={loading}
          >
            Decline
          </Button>
          <Button
            onClick={onAccept}
            className="sm:flex-1"
            disabled={loading}
          >
            {loading ? "Preparing..." : "Accept & Start"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
