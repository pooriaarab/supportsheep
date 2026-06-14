import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DevicePicker, startAudioMeter } from "../device-picker";

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

interface MockState {
  status: "pending" | "ready" | "denied" | "error";
  audioInputs: Array<{ deviceId: string; label: string; kind: "audioinput" }>;
  audioOutputs: Array<{ deviceId: string; label: string; kind: "audiooutput" }>;
  videoInputs: Array<{ deviceId: string; label: string; kind: "videoinput" }>;
  selectedAudioInput: string | null;
  selectedAudioOutput: string | null;
  selectedVideoInput: string | null;
  errorMessage: string | null;
}

const mockState: MockState = {
  status: "pending",
  audioInputs: [],
  audioOutputs: [],
  videoInputs: [],
  selectedAudioInput: null,
  selectedAudioOutput: null,
  selectedVideoInput: null,
  errorMessage: null,
};

vi.mock("@/hooks/use-media-devices", () => ({
  useMediaDevices: () => ({
    ...mockState,
    stream: null,
    selectAudioInput: vi.fn(),
    selectAudioOutput: vi.fn(),
    selectVideoInput: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-mount-effect", () => ({
  useMountEffect: vi.fn(),
}));

function resetMockState() {
  mockState.status = "pending";
  mockState.audioInputs = [];
  mockState.audioOutputs = [];
  mockState.videoInputs = [];
  mockState.selectedAudioInput = null;
  mockState.selectedAudioOutput = null;
  mockState.selectedVideoInput = null;
  mockState.errorMessage = null;
}

describe("DevicePicker", () => {
  beforeEach(() => {
    resetMockState();
  });

  it("renders pending state while permission is still being requested", () => {
    mockState.status = "pending";

    const html = renderToStaticMarkup(
      <DevicePicker mode="audio" onConfirm={vi.fn()} />,
    );
    expect(html).toContain("Requesting access to your camera and microphone");
  });

  it("renders unblock instructions when getUserMedia is denied", () => {
    mockState.status = "denied";
    mockState.errorMessage =
      "Browser blocked camera/mic. Click the camera icon in the address bar → Always allow → reload.";

    const html = renderToStaticMarkup(
      <DevicePicker mode="audio" onConfirm={vi.fn()} />,
    );
    expect(html).toContain("Browser blocked camera/mic");
    expect(html).toContain("camera icon in the address bar");
    expect(html).toContain("Reload to try again");
  });

  it("renders mic + speaker selects (no camera) in audio mode", () => {
    mockState.status = "ready";
    mockState.audioInputs = [
      { deviceId: "mic-1", label: "Built-in Microphone", kind: "audioinput" },
      { deviceId: "mic-2", label: "USB Headset", kind: "audioinput" },
    ];
    mockState.audioOutputs = [
      { deviceId: "spk-1", label: "Default Speaker", kind: "audiooutput" },
    ];
    mockState.selectedAudioInput = "mic-1";
    mockState.selectedAudioOutput = "spk-1";

    const html = renderToStaticMarkup(
      <DevicePicker mode="audio" onConfirm={vi.fn()} />,
    );
    expect(html).toContain("Set up your devices");
    expect(html).toContain("Microphone");
    expect(html).toContain("Speaker");
    // Camera dropdown is hidden in audio-only mode.
    expect(html).not.toContain("Camera</label>");
    expect(html).toContain("Use these devices");
  });

  it("renders camera dropdown plus preview <video> in video mode", () => {
    mockState.status = "ready";
    mockState.audioInputs = [
      { deviceId: "mic-1", label: "Built-in Microphone", kind: "audioinput" },
    ];
    mockState.videoInputs = [
      { deviceId: "cam-1", label: "FaceTime HD Camera", kind: "videoinput" },
    ];
    mockState.selectedAudioInput = "mic-1";
    mockState.selectedVideoInput = "cam-1";

    const html = renderToStaticMarkup(
      <DevicePicker mode="video" onConfirm={vi.fn()} />,
    );
    expect(html).toContain("Camera preview");
    expect(html).toContain("Camera");
  });

  it("renders an aria-valuenow=0 microphone meter initially", () => {
    mockState.status = "ready";
    mockState.audioInputs = [
      { deviceId: "mic-1", label: "Built-in Microphone", kind: "audioinput" },
    ];
    mockState.selectedAudioInput = "mic-1";

    const html = renderToStaticMarkup(
      <DevicePicker mode="audio" onConfirm={vi.fn()} />,
    );
    expect(html).toContain('role="meter"');
    expect(html).toContain('aria-valuenow="0"');
  });
});

describe("startAudioMeter", () => {
  it("consumes AnalyserNode.getByteFrequencyData and emits a 0..100 level", () => {
    const rafCallbacks: FrameRequestCallback[] = [];
    const originalRAF = global.requestAnimationFrame;
    const originalCAF = global.cancelAnimationFrame;
    global.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    }) as unknown as typeof requestAnimationFrame;
    global.cancelAnimationFrame = vi.fn() as unknown as typeof cancelAnimationFrame;

    const getByteFrequencyData = vi.fn((buf: Uint8Array) => {
      // 128 bins * value 128 = average 128 -> 50% level
      buf.fill(128);
    });
    const analyser = {
      fftSize: 256,
      frequencyBinCount: 128,
      getByteFrequencyData,
      connect: vi.fn(),
    };
    const mediaStreamSource = { connect: vi.fn() };
    const close = vi.fn().mockResolvedValue(undefined);

    global.AudioContext = vi.fn().mockImplementation(() => ({
      createMediaStreamSource: vi.fn(() => mediaStreamSource),
      createAnalyser: vi.fn(() => analyser),
      close,
    })) as unknown as typeof AudioContext;

    const onLevel = vi.fn();
    const cleanup = startAudioMeter({} as MediaStream, onLevel);

    expect(getByteFrequencyData).toHaveBeenCalledTimes(1);
    // 128/255 ≈ 0.502 → round to 50
    expect(onLevel).toHaveBeenCalledWith(50);

    cleanup();
    expect(close).toHaveBeenCalled();

    global.requestAnimationFrame = originalRAF;
    global.cancelAnimationFrame = originalCAF;
  });
});
