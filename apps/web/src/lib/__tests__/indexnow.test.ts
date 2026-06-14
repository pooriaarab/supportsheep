import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getDefaultIndexNowSubmissionStatus,
  resolveIndexNowSubmissionStatus,
  submitIndexNowUrl,
} from "@/lib/seo/indexnow";

describe("indexnow submission helpers", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns a not-configured status when indexnow is disabled", async () => {
    await expect(
      resolveIndexNowSubmissionStatus({
        config: {
          seo: {
            submissionProtocols: {
              indexNow: {
                enabled: false,
                apiKey: "",
              },
            },
          },
        },
        siteUrl: "https://supportsheep.com",
        url: "https://supportsheep.com/my-post/",
      }),
    ).resolves.toEqual(getDefaultIndexNowSubmissionStatus());
  });

  it("returns submitted when the endpoint succeeds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => "",
      }),
    );

    await expect(
      submitIndexNowUrl({
        apiKey: "abc123",
        siteUrl: "https://supportsheep.com",
        url: "https://supportsheep.com/my-post/",
      }),
    ).resolves.toMatchObject({
      status: "submitted",
      lastError: null,
      lastUrl: "https://supportsheep.com/my-post/",
    });
  });

  it("returns failed with an error message when the endpoint fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => "bad request",
      }),
    );

    await expect(
      submitIndexNowUrl({
        apiKey: "abc123",
        siteUrl: "https://supportsheep.com",
        url: "https://supportsheep.com/my-post/",
      }),
    ).resolves.toMatchObject({
      status: "failed",
      lastError: expect.stringContaining("400"),
      lastUrl: "https://supportsheep.com/my-post/",
    });
  });
});
