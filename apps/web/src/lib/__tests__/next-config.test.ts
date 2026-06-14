import { afterEach, describe, expect, it, vi } from "vitest";

const originalSkipNextBuildTypecheck =
  process.env.SKIP_NEXT_BUILD_TYPECHECK;

afterEach(() => {
  if (originalSkipNextBuildTypecheck === undefined) {
    delete process.env.SKIP_NEXT_BUILD_TYPECHECK;
  } else {
    process.env.SKIP_NEXT_BUILD_TYPECHECK = originalSkipNextBuildTypecheck;
  }
  vi.resetModules();
});

async function loadNextConfig() {
  const nextConfigModule = await import("../../../next.config");
  return nextConfigModule.default;
}

describe("next config rewrites", () => {
  it("rewrites root indexnow verification files to the indexnow api route", async () => {
    const nextConfig = await loadNextConfig();
    const rewrites = await nextConfig.rewrites?.();

    expect(rewrites).toEqual(
      expect.objectContaining({
        afterFiles: expect.arrayContaining([
          expect.objectContaining({
            source: "/:indexNowKey.txt",
            destination: "/api/indexnow/:indexNowKey",
          }),
        ]),
      }),
    );
  });
});

describe("next config build validation", () => {
  it("keeps Next build type validation enabled by default", async () => {
    delete process.env.SKIP_NEXT_BUILD_TYPECHECK;
    vi.resetModules();

    const nextConfig = await loadNextConfig();

    expect(nextConfig.typescript).toBeUndefined();
  });

  it("skips duplicate Next build type validation when requested", async () => {
    process.env.SKIP_NEXT_BUILD_TYPECHECK = "true";
    vi.resetModules();

    const nextConfig = await loadNextConfig();

    expect(nextConfig.typescript).toEqual({ ignoreBuildErrors: true });
  });
});
