import { describe, expect, it } from "vitest";
import { buildSeoStatDocId, parseGscRow } from "./seo-stats";

describe("parseGscRow", () => {
  it("returns a parsed row for well-formed input", () => {
    const result = parseGscRow(
      {
        keys: ["https://supportsheep.com/foo", "how to foo"],
        clicks: 5,
        impressions: 100,
        ctr: 0.05,
        position: 3.2,
      },
      "2026-04-21",
    );

    expect(result).toEqual({
      date: "2026-04-21",
      url: "https://supportsheep.com/foo",
      query: "how to foo",
      clicks: 5,
      impressions: 100,
      ctr: 0.05,
      position: 3.2,
    });
  });

  it("returns null when keys is missing", () => {
    const result = parseGscRow(
      {
        keys: undefined as unknown as string[],
        clicks: 1,
        impressions: 2,
        ctr: 0.5,
        position: 1,
      },
      "2026-04-21",
    );

    expect(result).toBeNull();
  });

  it("returns null when keys has fewer than two entries", () => {
    const result = parseGscRow(
      {
        keys: ["https://supportsheep.com/foo"],
        clicks: 1,
        impressions: 2,
        ctr: 0.5,
        position: 1,
      },
      "2026-04-21",
    );

    expect(result).toBeNull();
  });

  it("returns null when a key entry is not a string", () => {
    const result = parseGscRow(
      {
        keys: ["https://supportsheep.com/foo", undefined as unknown as string],
        clicks: 1,
        impressions: 2,
        ctr: 0.5,
        position: 1,
      },
      "2026-04-21",
    );

    expect(result).toBeNull();
  });
});

describe("buildSeoStatDocId", () => {
  it("encodes a simple URL path with date prefix", () => {
    expect(
      buildSeoStatDocId("2026-04-21", "https://supportsheep.com/foo/bar"),
    ).toBe("2026-04-21__foo__bar");
  });

  it("uses 'root' for the site root path", () => {
    expect(buildSeoStatDocId("2026-04-21", "https://supportsheep.com/")).toBe(
      "2026-04-21__root",
    );
  });
});
