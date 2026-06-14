import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Capture the mount effect so the test can drive it manually — the hook
// relies entirely on `useMountEffect` for its async permission probe, and
// without invoking the callback here `useMediaDevices` would never start.
let mountCallback: (() => void | (() => void)) | null = null;
let mountCleanup: (() => void) | null = null;
vi.mock("@/hooks/use-mount-effect", () => ({
  useMountEffect: vi.fn((effect: () => void | (() => void)) => {
    mountCallback = effect;
  }),
}));

// React state hooks called by the hook under test — capture each setter so
// the test can assert state transitions.
const stateSetters: Array<(value: unknown) => void> = [];
const stateValues: unknown[] = [];
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    useState: vi.fn((init: unknown) => {
      const index = stateValues.length;
      stateValues.push(init);
      const setter = (next: unknown) => {
        stateValues[index] =
          typeof next === "function"
            ? (next as (prev: unknown) => unknown)(stateValues[index])
            : next;
      };
      stateSetters.push(setter);
      return [init, setter];
    }),
    useCallback: vi.fn((fn: unknown) => fn),
  };
});

import { useMediaDevices } from "../use-media-devices";

function resetCaptured() {
  mountCallback = null;
  mountCleanup = null;
  stateSetters.length = 0;
  stateValues.length = 0;
}

function mockEnumerateDevices(devices: Array<Partial<MediaDeviceInfo> & { kind: string }>) {
  return vi.fn().mockResolvedValue(devices);
}

function mockGetUserMediaResolving(audioId = "default-mic", videoId?: string) {
  const tracks: Array<{
    stop: ReturnType<typeof vi.fn>;
    getSettings: () => { deviceId: string };
    kind: string;
  }> = [
    {
      stop: vi.fn(),
      getSettings: () => ({ deviceId: audioId }),
      kind: "audio",
    },
  ];
  if (videoId) {
    tracks.push({
      stop: vi.fn(),
      getSettings: () => ({ deviceId: videoId }),
      kind: "video",
    });
  }
  const stream = {
    getTracks: () => tracks,
    getAudioTracks: () => tracks.filter((t) => t.kind === "audio"),
    getVideoTracks: () => tracks.filter((t) => t.kind === "video"),
  };
  return vi.fn().mockResolvedValue(stream);
}

describe("useMediaDevices", () => {
  beforeEach(() => {
    resetCaptured();
  });

  afterEach(() => {
    if (mountCleanup) mountCleanup();
  });

  it("populates audio/video device lists from enumerateDevices", async () => {
    const getUserMedia = mockGetUserMediaResolving("mic-default", "cam-default");
    const enumerateDevices = mockEnumerateDevices([
      { deviceId: "mic-default", kind: "audioinput", label: "Built-in Microphone" },
      { deviceId: "mic-headset", kind: "audioinput", label: "USB Headset" },
      { deviceId: "spk-default", kind: "audiooutput", label: "Default Speaker" },
      { deviceId: "cam-default", kind: "videoinput", label: "FaceTime HD" },
    ]);
    global.navigator.mediaDevices = {
      getUserMedia,
      enumerateDevices,
    } as unknown as MediaDevices;

    useMediaDevices({ enableVideo: true });
    expect(mountCallback).not.toBeNull();
    const cleanup = mountCallback!();
    if (typeof cleanup === "function") mountCleanup = cleanup;

    // Yield to the microtask queue so the async getUserMedia + enumerate
    // complete before we assert.
    await new Promise((r) => setImmediate(r));

    expect(getUserMedia).toHaveBeenCalledWith({ audio: true, video: true });
    expect(enumerateDevices).toHaveBeenCalled();

    // State setters are invoked in declaration order:
    //   [status, stream, audioInputId, audioOutputId, videoInputId,
    //    audioInputs, audioOutputs, videoInputs, errorMessage]
    // Find the audioInputs setter (index 5) and check the resolved value.
    // We assert against current state values rather than fragile indexes by
    // checking that *some* setter was called with an array containing the
    // mic devices.
    const arrayValues = stateValues.filter(Array.isArray) as unknown[][];
    const mics = arrayValues.find(
      (v) =>
        Array.isArray(v) &&
        v.some((d) => (d as { kind?: string }).kind === "audioinput"),
    );
    expect(mics).toBeDefined();
    expect((mics as Array<{ deviceId: string }>).map((m) => m.deviceId)).toEqual([
      "mic-default",
      "mic-headset",
    ]);

    const cams = arrayValues.find(
      (v) =>
        Array.isArray(v) &&
        v.some((d) => (d as { kind?: string }).kind === "videoinput"),
    );
    expect(cams).toBeDefined();
  });

  it("transitions to denied state on NotAllowedError", async () => {
    const err = Object.assign(new Error("Permission denied"), {
      name: "NotAllowedError",
    });
    const getUserMedia = vi.fn().mockRejectedValue(err);
    global.navigator.mediaDevices = {
      getUserMedia,
      enumerateDevices: vi.fn(),
    } as unknown as MediaDevices;

    useMediaDevices();
    const cleanup = mountCallback!();
    if (typeof cleanup === "function") mountCleanup = cleanup;

    await new Promise((r) => setImmediate(r));

    // First state slot is `status` — initial value "pending".
    expect(stateValues[0]).toBe("denied");
    // errorMessage slot holds the unblock hint.
    const errorMsg = stateValues.find(
      (v) => typeof v === "string" && v.includes("Browser blocked"),
    );
    expect(errorMsg).toBeDefined();
  });
});
