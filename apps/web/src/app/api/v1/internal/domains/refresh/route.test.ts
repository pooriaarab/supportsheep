import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The route resolves the secret from `process.env` first (how @opennextjs/
// cloudflare surfaces Worker *secrets*) and falls back to the Cloudflare
// context env (text vars). `cfEnv` models that fallback source.
let cfEnv: { INTERNAL_CRON_SECRET?: string };
const refreshAllMock = vi.fn();

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => ({ env: cfEnv }),
}));

vi.mock("@/db", () => ({
  getDb: () => ({}),
}));

vi.mock("@/lib/domains/refresh", () => ({
  refreshAllPendingDomains: (...args: unknown[]) => refreshAllMock(...args),
}));

import { POST } from "./route";

function postRequest(secretHeader?: string): Request {
  const headers: Record<string, string> = {};
  if (secretHeader !== undefined) {
    headers["x-internal-cron-secret"] = secretHeader;
  }
  return new Request("http://test.local/api/v1/internal/domains/refresh", {
    method: "Article",
    headers,
  });
}

describe("POST /api/v1/internal/domains/refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Primary path: the secret is exposed via process.env on the Worker.
    process.env.INTERNAL_CRON_SECRET = "top-secret";
    cfEnv = {};
    refreshAllMock.mockResolvedValue({
      scanned: 1,
      checked: 1,
      activated: 1,
      failed: 0,
    });
  });

  afterEach(() => {
    delete process.env.INTERNAL_CRON_SECRET;
  });

  it("refreshes when the secret matches (process.env)", async () => {
    const res = await POST(postRequest("top-secret") as never);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ activated: 1 });
    expect(refreshAllMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to the Cloudflare context env when process.env is unset", async () => {
    delete process.env.INTERNAL_CRON_SECRET;
    cfEnv = { INTERNAL_CRON_SECRET: "top-secret" };
    const res = await POST(postRequest("top-secret") as never);
    expect(res.status).toBe(200);
    expect(refreshAllMock).toHaveBeenCalledTimes(1);
  });

  it("rejects a wrong secret with 403", async () => {
    const res = await POST(postRequest("wrong") as never);
    expect(res.status).toBe(403);
    expect(refreshAllMock).not.toHaveBeenCalled();
  });

  it("rejects a missing secret header with 403", async () => {
    const res = await POST(postRequest() as never);
    expect(res.status).toBe(403);
  });

  it("fails closed when no secret is configured anywhere", async () => {
    delete process.env.INTERNAL_CRON_SECRET;
    cfEnv = {};
    const res = await POST(postRequest("anything") as never);
    expect(res.status).toBe(403);
    expect(refreshAllMock).not.toHaveBeenCalled();
  });

  it("rejects a secret that is a prefix of the expected value", async () => {
    const res = await POST(postRequest("top-secre") as never);
    expect(res.status).toBe(403);
  });
});
