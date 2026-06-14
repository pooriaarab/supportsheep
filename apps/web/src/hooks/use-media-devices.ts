"use client";

import { useCallback, useState } from "react";
import { useMountEffect } from "@/hooks/use-mount-effect";
import { createLogger } from "@/lib/logger";

const log = createLogger("hooks:use-media-devices");

export type MediaDeviceKind = "audioinput" | "audiooutput" | "videoinput";

export interface MediaDeviceOption {
  deviceId: string;
  label: string;
  kind: MediaDeviceKind;
}

export interface UseMediaDevicesState {
  /** Permission probe + enumeration status. */
  status: "pending" | "ready" | "denied" | "error";
  /** Live `MediaStream` from the currently selected mic + (optionally) camera. */
  stream: MediaStream | null;
  /** Microphone deviceId currently in use. */
  selectedAudioInput: string | null;
  /** Camera deviceId currently in use (only in video mode). */
  selectedVideoInput: string | null;
  /** Speaker / audio-output deviceId currently selected. Note: not all
   * browsers honor `setSinkId`, so the value is informational on those. */
  selectedAudioOutput: string | null;
  audioInputs: MediaDeviceOption[];
  audioOutputs: MediaDeviceOption[];
  videoInputs: MediaDeviceOption[];
  /** Human-readable error string when status === "denied" or "error". */
  errorMessage: string | null;
}

export interface UseMediaDevicesOptions {
  /** When true, the hook requests `video: true` alongside `audio` so the
   * picker can preview the camera. Defaults to false for audio-only flows. */
  enableVideo?: boolean;
}

export interface UseMediaDevicesActions {
  selectAudioInput: (deviceId: string) => void;
  selectAudioOutput: (deviceId: string) => void;
  selectVideoInput: (deviceId: string) => void;
}

/**
 * Probes `navigator.mediaDevices` for available audio (and optionally video)
 * devices, requests a single `getUserMedia` permission grant up front, and
 * exposes the live stream so callers can render a preview + audio meter.
 *
 * - Device labels are empty strings until permission is granted, so the hook
 *   first calls `getUserMedia` with permissive constraints, then enumerates.
 * - Switching the selected mic/camera tears down the existing stream tracks
 *   and acquires a new one pinned to the chosen deviceId.
 * - The live stream is cleaned up on unmount so a user navigating away does
 *   not leave a mic indicator stuck on in the browser tab.
 */
export function useMediaDevices(
  options: UseMediaDevicesOptions = {},
): UseMediaDevicesState & UseMediaDevicesActions {
  const { enableVideo = false } = options;

  const [status, setStatus] = useState<UseMediaDevicesState["status"]>("pending");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [selectedAudioInput, setSelectedAudioInput] = useState<string | null>(null);
  const [selectedAudioOutput, setSelectedAudioOutput] = useState<string | null>(null);
  const [selectedVideoInput, setSelectedVideoInput] = useState<string | null>(null);
  const [audioInputs, setAudioInputs] = useState<MediaDeviceOption[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceOption[]>([]);
  const [videoInputs, setVideoInputs] = useState<MediaDeviceOption[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const acquireStream = useCallback(
    async (audioId: string | null, videoId: string | null): Promise<MediaStream> => {
      const audioConstraint: MediaTrackConstraints | true = audioId
        ? { deviceId: { exact: audioId } }
        : true;
      const videoConstraint: MediaTrackConstraints | boolean = enableVideo
        ? videoId
          ? { deviceId: { exact: videoId } }
          : true
        : false;
      return navigator.mediaDevices.getUserMedia({
        audio: audioConstraint,
        video: videoConstraint,
      });
    },
    [enableVideo],
  );

  const stopStream = useCallback((s: MediaStream | null) => {
    if (!s) return;
    for (const track of s.getTracks()) {
      track.stop();
    }
  }, []);

  const enumerate = useCallback(async (): Promise<{
    audioInputs: MediaDeviceOption[];
    audioOutputs: MediaDeviceOption[];
    videoInputs: MediaDeviceOption[];
  }> => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputsList: MediaDeviceOption[] = [];
    const audioOutputsList: MediaDeviceOption[] = [];
    const videoInputsList: MediaDeviceOption[] = [];
    for (const d of devices) {
      const option: MediaDeviceOption = {
        deviceId: d.deviceId,
        label: d.label || `${d.kind} (${d.deviceId.slice(0, 6) || "default"})`,
        kind: d.kind as MediaDeviceKind,
      };
      if (d.kind === "audioinput") audioInputsList.push(option);
      else if (d.kind === "audiooutput") audioOutputsList.push(option);
      else if (d.kind === "videoinput") videoInputsList.push(option);
    }
    return {
      audioInputs: audioInputsList,
      audioOutputs: audioOutputsList,
      videoInputs: videoInputsList,
    };
  }, []);

  useMountEffect(() => {
    let cleanupStream: MediaStream | null = null;
    let cancelled = false;

    (async () => {
      try {
        // Initial permission probe — gives us labeled devices.
        const initialStream = await acquireStream(null, null);
        if (cancelled) {
          stopStream(initialStream);
          return;
        }
        cleanupStream = initialStream;

        const audioTrack = initialStream.getAudioTracks()[0];
        const videoTrack = initialStream.getVideoTracks()[0];
        const initialAudioId = audioTrack?.getSettings().deviceId ?? null;
        const initialVideoId = videoTrack?.getSettings().deviceId ?? null;

        const { audioInputs: ai, audioOutputs: ao, videoInputs: vi } = await enumerate();
        if (cancelled) {
          stopStream(initialStream);
          return;
        }

        setAudioInputs(ai);
        setAudioOutputs(ao);
        setVideoInputs(vi);
        setSelectedAudioInput(initialAudioId ?? ai[0]?.deviceId ?? null);
        setSelectedVideoInput(
          enableVideo ? initialVideoId ?? vi[0]?.deviceId ?? null : null,
        );
        setSelectedAudioOutput(ao[0]?.deviceId ?? null);
        setStream(initialStream);
        setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        const name = err instanceof Error ? err.name : "UnknownError";
        log.warn("Failed to acquire media devices", { error: err });
        if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") {
          setStatus("denied");
          setErrorMessage(
            "Browser blocked camera/mic. Click the camera icon in the address bar → Always allow → reload.",
          );
        } else {
          setStatus("error");
          setErrorMessage(
            err instanceof Error ? err.message : "Unable to access media devices.",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      stopStream(cleanupStream);
    };
  });

  const switchInput = useCallback(
    async (audioId: string | null, videoId: string | null) => {
      try {
        const next = await acquireStream(audioId, videoId);
        // Stop the previous stream BEFORE swapping so the camera light goes
        // off immediately rather than waiting for GC.
        setStream((prev) => {
          stopStream(prev);
          return next;
        });
      } catch (err) {
        log.error("Failed to switch media device", { error: err });
        setErrorMessage(
          err instanceof Error ? err.message : "Unable to switch media device.",
        );
      }
    },
    [acquireStream, stopStream],
  );

  const selectAudioInput = useCallback(
    (deviceId: string) => {
      setSelectedAudioInput(deviceId);
      void switchInput(deviceId, selectedVideoInput);
    },
    [selectedVideoInput, switchInput],
  );

  const selectVideoInput = useCallback(
    (deviceId: string) => {
      setSelectedVideoInput(deviceId);
      void switchInput(selectedAudioInput, deviceId);
    },
    [selectedAudioInput, switchInput],
  );

  const selectAudioOutput = useCallback((deviceId: string) => {
    setSelectedAudioOutput(deviceId);
  }, []);

  return {
    status,
    stream,
    selectedAudioInput,
    selectedAudioOutput,
    selectedVideoInput,
    audioInputs,
    audioOutputs,
    videoInputs,
    errorMessage,
    selectAudioInput,
    selectAudioOutput,
    selectVideoInput,
  };
}
