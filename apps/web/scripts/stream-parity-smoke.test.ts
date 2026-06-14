import { describe, expect, it } from "vitest";
import {
  USAGE,
  parseParityCliArgs,
  createSseParser,
  eventIdentity,
  shouldIgnoreEvent,
  diffSequences,
} from "./stream-parity-smoke";

describe("parseParityCliArgs", () => {
  it("returns help when --help is passed", () => {
    const opts = parseParityCliArgs(["--help"]);
    expect(opts.help).toBe(true);
  });

  it("parses required flags with --key value form", () => {
    const opts = parseParityCliArgs([
      "--base-url",
      "https://example.com",
      "--interview-id",
      "abc",
    ]);
    expect(opts.baseUrl).toBe("https://example.com");
    expect(opts.interviewId).toBe("abc");
    expect(opts.durationSeconds).toBe(30);
    expect(opts.help).toBe(false);
  });

  it("parses required flags with --key=value form", () => {
    const opts = parseParityCliArgs([
      "--base-url=https://example.com",
      "--interview-id=abc",
    ]);
    expect(opts.baseUrl).toBe("https://example.com");
    expect(opts.interviewId).toBe("abc");
  });

  it("parses --duration as a number", () => {
    const opts = parseParityCliArgs([
      "--base-url=https://x",
      "--interview-id=y",
      "--duration=15",
    ]);
    expect(opts.durationSeconds).toBe(15);
  });

  it("throws on non-positive --duration", () => {
    expect(() =>
      parseParityCliArgs([
        "--base-url=https://x",
        "--interview-id=y",
        "--duration=0",
      ]),
    ).toThrow(/Invalid --duration/);
  });

  it("defaults ignoreKinds to writer_diff", () => {
    const opts = parseParityCliArgs([
      "--base-url=https://x",
      "--interview-id=y",
    ]);
    expect(opts.ignoreKinds.has("writer_diff")).toBe(true);
  });

  it("overrides ignoreKinds via CSV", () => {
    const opts = parseParityCliArgs([
      "--base-url=https://x",
      "--interview-id=y",
      "--ignore-kinds=writer_diff,canvas_edit",
    ]);
    expect(opts.ignoreKinds.has("writer_diff")).toBe(true);
    expect(opts.ignoreKinds.has("canvas_edit")).toBe(true);
    expect(opts.ignoreKinds.size).toBe(2);
  });

  it("throws when --base-url is missing", () => {
    expect(() => parseParityCliArgs(["--interview-id=y"])).toThrow(
      /--base-url is required/,
    );
  });

  it("throws when --interview-id is missing", () => {
    expect(() => parseParityCliArgs(["--base-url=https://x"])).toThrow(
      /--interview-id is required/,
    );
  });

  it("rejects --base-url with trailing slash", () => {
    expect(() =>
      parseParityCliArgs([
        "--base-url=https://x/",
        "--interview-id=y",
      ]),
    ).toThrow(/trailing slash/);
  });

  it("ignores unknown flags", () => {
    const opts = parseParityCliArgs([
      "--base-url=https://x",
      "--interview-id=y",
      "--future=flag",
    ]);
    expect(opts.baseUrl).toBe("https://x");
  });
});

describe("USAGE", () => {
  it("documents every flag the parser accepts", () => {
    for (const flag of [
      "--base-url",
      "--interview-id",
      "--duration",
      "--ignore-kinds",
      "--token",
      "--help",
      "DEV_LOGIN_SECRET",
    ]) {
      expect(USAGE).toContain(flag);
    }
  });

  it("documents exit codes", () => {
    for (const line of ["0", "1", "2", "3"]) {
      expect(USAGE).toContain(line);
    }
  });
});

describe("createSseParser", () => {
  it("parses a single complete frame", () => {
    const parser = createSseParser();
    const out = parser.feed(
      `event: hello\ndata: {"ok":true}\n\n`,
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({ event: "hello", data: { ok: true } });
  });

  it("parses across chunk boundaries", () => {
    const parser = createSseParser();
    expect(parser.feed("event: msg\ndata: {\"k\":")).toEqual([]);
    expect(parser.feed("\"x\"}\n\n")).toEqual([
      { event: "msg", data: { k: "x" } },
    ]);
  });

  it("ignores keepalive comments", () => {
    const parser = createSseParser();
    const out = parser.feed(`: keepalive\n\nevent: x\ndata: 1\n\n`);
    expect(out).toEqual([{ event: "x", data: 1 }]);
  });

  it("preserves non-JSON data as string", () => {
    const parser = createSseParser();
    const out = parser.feed(`event: raw\ndata: not-json\n\n`);
    expect(out[0]).toEqual({ event: "raw", data: "not-json" });
  });

  it("defaults event to 'message' when omitted", () => {
    const parser = createSseParser();
    const out = parser.feed(`data: {"k":1}\n\n`);
    expect(out[0].event).toBe("message");
  });
});

describe("eventIdentity", () => {
  it("combines event and kind when both present", () => {
    expect(
      eventIdentity({ event: "message", data: { kind: "canvas_update" } }),
    ).toBe("message:canvas_update");
  });

  it("falls back to event name when kind missing", () => {
    expect(eventIdentity({ event: "hello", data: {} })).toBe("hello");
  });

  it("handles string data without throwing", () => {
    expect(eventIdentity({ event: "raw", data: "x" })).toBe("raw");
  });
});

describe("shouldIgnoreEvent", () => {
  it("ignores hello and error frames unconditionally", () => {
    expect(
      shouldIgnoreEvent({ event: "hello", data: {} }, new Set()),
    ).toBe(true);
    expect(
      shouldIgnoreEvent({ event: "error", data: {} }, new Set()),
    ).toBe(true);
  });

  it("ignores configured kinds", () => {
    expect(
      shouldIgnoreEvent(
        { event: "message", data: { kind: "writer_diff" } },
        new Set(["writer_diff"]),
      ),
    ).toBe(true);
  });

  it("keeps unrelated kinds", () => {
    expect(
      shouldIgnoreEvent(
        { event: "message", data: { kind: "canvas_update" } },
        new Set(["writer_diff"]),
      ),
    ).toBe(false);
  });
});

describe("diffSequences", () => {
  it("returns ok=true for identical multisets regardless of order", () => {
    const r = diffSequences(["a", "b", "a"], ["b", "a", "a"]);
    expect(r.ok).toBe(true);
    expect(r.commonLength).toBe(3);
    expect(r.netlifyOnly).toEqual([]);
    expect(r.gcpOnly).toEqual([]);
  });

  it("reports netlify-only events", () => {
    const r = diffSequences(["a", "b"], ["a"]);
    expect(r.ok).toBe(false);
    expect(r.netlifyOnly).toEqual(["b"]);
    expect(r.gcpOnly).toEqual([]);
  });

  it("reports gcp-only events", () => {
    const r = diffSequences(["a"], ["a", "c"]);
    expect(r.ok).toBe(false);
    expect(r.gcpOnly).toEqual(["c"]);
    expect(r.netlifyOnly).toEqual([]);
  });

  it("reports both sides when both diverge", () => {
    const r = diffSequences(["a", "a", "b"], ["a", "b", "b"]);
    expect(r.ok).toBe(false);
    expect(r.netlifyOnly).toEqual(["a"]);
    expect(r.gcpOnly).toEqual(["b"]);
    expect(r.commonLength).toBe(2);
  });
});
