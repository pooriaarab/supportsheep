import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// Capture mount effects so tests can fire them explicitly.
const pendingEffects: Array<() => void | (() => void)> = [];
vi.mock("@/hooks/use-mount-effect", () => ({
  useMountEffect: (effect: () => void | (() => void)) => {
    pendingEffects.push(effect);
  },
}));

const scanSpy = vi.fn();
vi.mock("react-scan", () => ({
  scan: scanSpy,
}));

async function runPendingEffectsAsync() {
  while (pendingEffects.length > 0) {
    const effect = pendingEffects.shift()!;
    effect();
  }
  // Allow dynamic import() microtasks to resolve.
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("ReactScanBoot", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    pendingEffects.length = 0;
    scanSpy.mockClear();
  });

  afterEach(() => {
    vi.stubEnv("NODE_ENV", originalNodeEnv ?? "test");
    vi.unstubAllEnvs();
  });

  it("renders nothing", async () => {
    const { ReactScanBoot } = await import("../react-scan-boot");
    const html = renderToStaticMarkup(<ReactScanBoot />);
    expect(html).toBe("");
  });

  it("does not invoke react-scan when NODE_ENV is production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { ReactScanBoot } = await import("../react-scan-boot");
    renderToStaticMarkup(<ReactScanBoot />);
    await runPendingEffectsAsync();
    expect(scanSpy).not.toHaveBeenCalled();
  });

  it("invokes react-scan when NODE_ENV is development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { ReactScanBoot } = await import("../react-scan-boot");
    renderToStaticMarkup(<ReactScanBoot />);
    // Fire the captured mount effect, which kicks off a dynamic import().
    while (pendingEffects.length > 0) {
      pendingEffects.shift()!();
    }
    // Wait for the async import().then(scan) chain to resolve rather than
    // draining a fixed number of ticks — the latter races the event loop and
    // flakes under a congested suite or a slow CI runner.
    await vi.waitFor(() =>
      expect(scanSpy).toHaveBeenCalledWith({ enabled: true, log: false }),
    );
  });
});
