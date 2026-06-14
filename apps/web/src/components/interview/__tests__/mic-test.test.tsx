import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MicTest } from "../mic-test";

let mockPermissionState = "pending";
let mockLevel = 0;

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    useState: vi.fn((init) => {
      if (init === "pending") {
        return [mockPermissionState, vi.fn()];
      }
      if (init === 0) {
        return [mockLevel, vi.fn()];
      }
      return [init, vi.fn()];
    }),
  };
});

describe("MicTest", () => {
  beforeEach(() => {
    mockPermissionState = "pending";
    mockLevel = 0;
  });

  it("renders pending state initially while requesting getUserMedia", () => {
    // Stub getUserMedia with a promise that never resolves
    global.navigator.mediaDevices = {
      getUserMedia: vi.fn().mockReturnValue(new Promise(() => {})),
    } as unknown as MediaDevices;

    const html = renderToStaticMarkup(<MicTest onContinue={vi.fn()} />);
    expect(html).toContain("Requesting microphone access...");
  });

  it("renders denied state if microphone permission is denied", () => {
    mockPermissionState = "denied";
    mockLevel = 0;

    const html = renderToStaticMarkup(<MicTest onContinue={vi.fn()} />);
    
    expect(html).toContain("Microphone Access Denied");
    expect(html).toContain("Continue");
  });

  it("renders granted state with VU meter and Join button", () => {
    mockPermissionState = "granted";
    mockLevel = 45;

    const html = renderToStaticMarkup(<MicTest onContinue={vi.fn()} />);

    expect(html).toContain("Vocal Level Indicator");
    expect(html).toContain("Join Interview");
    expect(html).toContain("width:45%");
  });
});
