import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseCliArgs, seedShareLink } from "./dev-interview-harness";

describe("parseCliArgs", () => {
  it("defaults to mode=transcript and scriptedTimeline=basic when no flags given", () => {
    expect(parseCliArgs([])).toEqual({
      mode: "transcript",
      tavusPersonaId: undefined,
      tavusReplicaId: undefined,
      scriptedTimeline: "basic",
    });
  });

  it("parses --mode=audio", () => {
    expect(parseCliArgs(["--mode=audio"]).mode).toBe("audio");
  });

  it("parses --mode=video with tavus IDs", () => {
    const opts = parseCliArgs([
      "--mode=video",
      "--tavus-persona-id=p1",
      "--tavus-replica-id=r1",
    ]);
    expect(opts).toEqual({
      mode: "video",
      tavusPersonaId: "p1",
      tavusReplicaId: "r1",
      scriptedTimeline: "basic",
    });
  });

  it("parses --scripted-timeline=comprehensive", () => {
    expect(parseCliArgs(["--scripted-timeline=comprehensive"]).scriptedTimeline).toBe(
      "comprehensive",
    );
  });

  it("throws on unknown --scripted-timeline value", () => {
    expect(() =>
      parseCliArgs(["--scripted-timeline=galactic"]),
    ).toThrow(/Invalid --scripted-timeline value/);
  });

  it("throws on unknown --mode value", () => {
    expect(() => parseCliArgs(["--mode=hologram"])).toThrow(
      /Invalid --mode value/,
    );
  });

  it("throws when --mode=video lacks tavus IDs", () => {
    expect(() => parseCliArgs(["--mode=video"])).toThrow(
      /--mode=video requires/,
    );
  });

  it("ignores unknown flags", () => {
    expect(parseCliArgs(["--mode=audio", "--future=flag"]).mode).toBe("audio");
  });
});

describe("seedShareLink", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("POSTs recordingConfig=audio when --mode=audio is parsed", async () => {
    const options = parseCliArgs(["--mode=audio"]);
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ token: "t", shareLinkId: "s" }),
    }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await seedShareLink("http://localhost:3000", options);
    expect(result).toEqual({ token: "t", shareLinkId: "s" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls[0] as unknown as [
      string,
      { body: string; method: string },
    ];
    const init = call[1];
    const body = JSON.parse(init.body) as Record<string, unknown>;
    expect(body.recordingConfig).toBe("audio");
    expect(body.visibility).toBe("link");
    expect(body.authMode).toBe("anonymous");
  });

  it("POSTs recordingConfig=video with tavus IDs", async () => {
    const options = parseCliArgs([
      "--mode=video",
      "--tavus-persona-id=p1",
      "--tavus-replica-id=r1",
    ]);
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ token: "t", shareLinkId: "s" }),
    }));
    global.fetch = fetchMock as unknown as typeof fetch;

    await seedShareLink("http://localhost:3000", options);

    const call = fetchMock.mock.calls[0] as unknown as [
      string,
      { body: string },
    ];
    const init = call[1];
    const body = JSON.parse(init.body) as Record<string, unknown>;
    expect(body.recordingConfig).toBe("video");
    expect(body.tavusPersonaId).toBe("p1");
    expect(body.tavusReplicaId).toBe("r1");
  });

  it("throws when the seed endpoint returns a non-OK response", async () => {
    const options = parseCliArgs([]);
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 400,
      text: async () => "bad request",
    })) as unknown as typeof fetch;

    await expect(
      seedShareLink("http://localhost:3000", options),
    ).rejects.toThrow(/seed-share-link failed/);
  });
});
