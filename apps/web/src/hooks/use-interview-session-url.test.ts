import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Exercises the compile-time `NEXT_PUBLIC_INTERVIEW_STREAM_PROVIDER` switch
// added in PR #237 Phase 1. The hook itself is React-and-EventSource heavy
// to instantiate, so this suite only loads the pure URL builder.
import { buildInterviewStreamPath } from "./use-interview-session";

describe("buildInterviewStreamPath (NEXT_PUBLIC_INTERVIEW_STREAM_PROVIDER)", () => {
  const ORIGINAL = process.env.NEXT_PUBLIC_INTERVIEW_STREAM_PROVIDER;

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_INTERVIEW_STREAM_PROVIDER;
  });

  afterEach(() => {
    if (ORIGINAL === undefined) {
      delete process.env.NEXT_PUBLIC_INTERVIEW_STREAM_PROVIDER;
    } else {
      process.env.NEXT_PUBLIC_INTERVIEW_STREAM_PROVIDER = ORIGINAL;
    }
  });

  it("defaults to the Netlify route when the env flag is unset", () => {
    expect(buildInterviewStreamPath("abc")).toBe(
      "/api/v1/interviews/abc/stream",
    );
  });

  it("keeps the Netlify route when the flag is explicitly 'netlify'", () => {
    process.env.NEXT_PUBLIC_INTERVIEW_STREAM_PROVIDER = "netlify";
    expect(buildInterviewStreamPath("abc")).toBe(
      "/api/v1/interviews/abc/stream",
    );
  });

  it("points to the Cloud Function path when the flag is 'gcp'", () => {
    process.env.NEXT_PUBLIC_INTERVIEW_STREAM_PROVIDER = "gcp";
    expect(buildInterviewStreamPath("abc")).toBe(
      "/api/v1/interviews/abc/stream-gcp",
    );
  });

  it("ignores unknown flag values and keeps the safe Netlify default", () => {
    process.env.NEXT_PUBLIC_INTERVIEW_STREAM_PROVIDER = "bogus";
    expect(buildInterviewStreamPath("abc")).toBe(
      "/api/v1/interviews/abc/stream",
    );
  });
});
