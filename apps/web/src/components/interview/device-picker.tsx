"use client";

import { useRef, useState } from "react";
import { useMountEffect } from "@/hooks/use-mount-effect";
import { useLatestRef } from "@/hooks/use-latest-ref";
import {
  useMediaDevices,
  type MediaDeviceOption,
} from "@/hooks/use-media-devices";
import { Button } from "@repo/ui/primitives/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/primitives/select";
import { AlertTriangle, Loader2, Mic, Video } from "lucide-react";
import { createLogger } from "@/lib/logger";

const log = createLogger("components:device-picker");

const STORAGE_KEYS = {
  audioInput: "interview.devicePicker.audioInputDeviceId",
  audioOutput: "interview.devicePicker.audioOutputDeviceId",
  videoInput: "interview.devicePicker.videoInputDeviceId",
} as const;

export type DevicePickerMode = "audio" | "video" | "transcript";

export interface DevicePickerSelection {
  audioInputDeviceId: string | null;
  audioOutputDeviceId: string | null;
  videoInputDeviceId: string | null;
}

interface Props {
  /** Recording mode. `transcript` still shows mic test since OpenAI realtime
   * captures audio either way; only `video` exposes the camera dropdown. */
  mode: DevicePickerMode;
  /** Called once the user confirms. Selected device IDs propagate downstream
   * to the realtime client / Daily SDK call object. */
  onConfirm: (selection: DevicePickerSelection) => void;
  /** Optional override of the "Use these devices" CTA copy. */
  ctaLabel?: string;
}

function readStored(key: string): string | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string | null) {
  try {
    if (typeof window === "undefined") return;
    if (value === null) {
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(key, value);
  } catch {
    // Private mode or storage disabled — silently ignore.
  }
}

function findOption(
  list: MediaDeviceOption[],
  deviceId: string | null,
): MediaDeviceOption | undefined {
  if (!deviceId) return undefined;
  return list.find((o) => o.deviceId === deviceId);
}

export function DevicePicker({ mode, onConfirm, ctaLabel = "Use these devices" }: Props) {
  const enableVideo = mode === "video";
  const devices = useMediaDevices({ enableVideo });
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioLevelMeterRef = useRef<HTMLDivElement | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);

  // Keep a mutable ref so polling intervals inside useMountEffect always
  // see the latest hook return instead of a stale first-render closure.
  // `useLatestRef` updates the ref in `useInsertionEffect` so we never
  // write to refs during render (react-hooks/refs).
  const devicesRef = useLatestRef(devices);

  // Wire <video> srcObject manually — React props can't carry MediaStream.
  useMountEffect(() => {
    let mounted = true;
    const stopAudioMeter: { current: (() => void) | null } = { current: null };

    const id = window.setInterval(() => {
      if (!mounted) return;
      const stream = devicesRef.current.stream;
      if (videoRef.current && enableVideo) {
        if (videoRef.current.srcObject !== stream) {
          videoRef.current.srcObject = stream;
        }
      }
      // Hook up the audio meter once we have a stream.
      if (stream && !stopAudioMeter.current) {
        stopAudioMeter.current = startAudioMeter(stream, setAudioLevel);
      }
    }, 250);

    return () => {
      mounted = false;
      window.clearInterval(id);
      stopAudioMeter.current?.();
    };
  });

  // Restore last-used device IDs once the device lists arrive. Done as a
  // mount effect that polls — the lists arrive async and may not be present
  // until after permission resolves.
  useMountEffect(() => {
    let applied = false;
    let mounted = true;
    const id = window.setInterval(() => {
      if (!mounted || applied) return;
      const d = devicesRef.current;
      if (d.status !== "ready") return;

      const storedAudio = readStored(STORAGE_KEYS.audioInput);
      if (storedAudio && findOption(d.audioInputs, storedAudio)) {
        d.selectAudioInput(storedAudio);
      }
      const storedOutput = readStored(STORAGE_KEYS.audioOutput);
      if (storedOutput && findOption(d.audioOutputs, storedOutput)) {
        d.selectAudioOutput(storedOutput);
      }
      if (enableVideo) {
        const storedVideo = readStored(STORAGE_KEYS.videoInput);
        if (storedVideo && findOption(d.videoInputs, storedVideo)) {
          d.selectVideoInput(storedVideo);
        }
      }
      applied = true;
      window.clearInterval(id);
    }, 200);

    return () => {
      mounted = false;
      window.clearInterval(id);
    };
  });

  const handleConfirm = () => {
    writeStored(STORAGE_KEYS.audioInput, devices.selectedAudioInput);
    writeStored(STORAGE_KEYS.audioOutput, devices.selectedAudioOutput);
    if (enableVideo) {
      writeStored(STORAGE_KEYS.videoInput, devices.selectedVideoInput);
    }
    log.info("Device picker confirmed", {
      mode,
      audioInputDeviceId: devices.selectedAudioInput,
      audioOutputDeviceId: devices.selectedAudioOutput,
      videoInputDeviceId: enableVideo ? devices.selectedVideoInput : null,
    });
    onConfirm({
      audioInputDeviceId: devices.selectedAudioInput,
      audioOutputDeviceId: devices.selectedAudioOutput,
      videoInputDeviceId: enableVideo ? devices.selectedVideoInput : null,
    });
  };

  if (devices.status === "pending") {
    return (
      <div className="max-w-xl mx-auto mt-12 px-4">
        <div className="p-8 rounded-xl border border-border bg-card shadow-md flex flex-col items-center gap-3 text-center">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">
            Requesting access to your camera and microphone…
          </p>
        </div>
      </div>
    );
  }

  if (devices.status === "denied" || devices.status === "error") {
    return (
      <div className="max-w-xl mx-auto mt-12 px-4">
        <div className="p-6 rounded-xl border border-destructive/20 bg-destructive/5 shadow-md space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-foreground">
                Browser blocked camera/mic
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {devices.errorMessage ??
                  "Click the camera icon in the address bar → Always allow → reload."}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => window.location.reload()}
          >
            Reload to try again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto mt-12 px-4">
      <div className="p-8 rounded-xl border border-border bg-card shadow-md space-y-6">
        <div className="space-y-1">
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Set up your devices
          </h2>
          <p className="text-sm text-muted-foreground">
            Pick which microphone, speaker, and camera the interview will use.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Preview column */}
          <div className="space-y-3">
            {enableVideo ? (
              <div className="aspect-video w-full bg-muted rounded-lg overflow-hidden border border-border relative">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                  aria-label="Camera preview"
                />
              </div>
            ) : (
              <div className="aspect-video w-full bg-muted rounded-lg border border-border flex items-center justify-center text-muted-foreground">
                <Mic className="w-8 h-8" aria-hidden="true" />
              </div>
            )}

            <div className="space-y-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Microphone level
              </span>
              <div
                ref={audioLevelMeterRef}
                className="w-full h-2.5 bg-muted rounded-full overflow-hidden border border-border"
                role="meter"
                aria-label="Microphone level"
                aria-valuenow={audioLevel}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-full bg-primary transition-all duration-75 ease-out"
                  style={{ width: `${audioLevel}%` }}
                />
              </div>
            </div>
          </div>

          {/* Selectors column */}
          <div className="space-y-4">
            <DeviceSelect
              label="Microphone"
              icon={<Mic className="w-3.5 h-3.5" />}
              value={devices.selectedAudioInput ?? ""}
              options={devices.audioInputs}
              onChange={devices.selectAudioInput}
            />
            {devices.audioOutputs.length > 0 && (
              <DeviceSelect
                label="Speaker"
                icon={null}
                value={devices.selectedAudioOutput ?? ""}
                options={devices.audioOutputs}
                onChange={devices.selectAudioOutput}
              />
            )}
            {enableVideo && (
              <DeviceSelect
                label="Camera"
                icon={<Video className="w-3.5 h-3.5" />}
                value={devices.selectedVideoInput ?? ""}
                options={devices.videoInputs}
                onChange={devices.selectVideoInput}
              />
            )}
          </div>
        </div>

        <div className="pt-2">
          <Button
            onClick={handleConfirm}
            className="w-full text-sm font-semibold py-2"
            disabled={!devices.selectedAudioInput}
          >
            {ctaLabel} →
          </Button>
        </div>
      </div>
    </div>
  );
}

interface DeviceSelectProps {
  label: string;
  icon: React.ReactNode;
  value: string;
  options: MediaDeviceOption[];
  onChange: (deviceId: string) => void;
}

function DeviceSelect({ label, icon, value, options, onChange }: DeviceSelectProps) {
  return (
    <div className="space-y-1">
      <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={`Choose ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.deviceId} value={o.deviceId}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * Run an `AnalyserNode` on the given stream's audio track and call `onLevel`
 * with a 0..100 value at each animation frame. Returns a cleanup function
 * that releases the AudioContext.
 *
 * Exported so the device-picker test can drive the level meter against a
 * mocked AnalyserNode without going through the React component.
 */
export function startAudioMeter(
  stream: MediaStream,
  onLevel: (level: number) => void,
): () => void {
  let ctx: AudioContext | null = null;
  let raf: number | null = null;
  try {
    ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (const v of data) sum += v;
      const level = sum / data.length / 255;
      onLevel(Math.round(level * 100));
      raf = requestAnimationFrame(tick);
    };
    tick();
  } catch (err) {
    log.warn("AudioContext unavailable — meter disabled", { error: err });
  }
  return () => {
    if (raf !== null) cancelAnimationFrame(raf);
    ctx?.close().catch(() => {});
  };
}
