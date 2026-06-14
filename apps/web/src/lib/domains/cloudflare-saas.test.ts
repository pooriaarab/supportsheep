import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let envValue: { CF_API_TOKEN?: string; CF_SAAS_ZONE_ID?: string };

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => ({ env: envValue }),
}));

import {
  CustomDomainsNotConfiguredError,
  createCustomHostname,
  deleteCustomHostname,
  getCustomHostname,
} from "./cloudflare-saas";
import type { CloudflareApiError } from "./cloudflare-saas";

const fetchMock = vi.fn();

function cfOk(result: unknown) {
  return {
    ok: true,
    json: async () => ({ success: true, result }),
  } as unknown as Response;
}

function cfErr(status: number, message: string) {
  return {
    ok: status < 400,
    status,
    json: async () => ({ success: false, errors: [{ message }] }),
  } as unknown as Response;
}

describe("cloudflare-saas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envValue = { CF_API_TOKEN: "secret-token", CF_SAAS_ZONE_ID: "blogbat.com" };
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("throws CustomDomainsNotConfiguredError when CF_API_TOKEN is unset", async () => {
    envValue = {};
    await expect(createCustomHostname("blog.example.com")).rejects.toBeInstanceOf(
      CustomDomainsNotConfiguredError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("creates a custom hostname and surfaces the CNAME target", async () => {
    fetchMock.mockResolvedValue(
      cfOk({
        id: "ch_123",
        hostname: "blog.example.com",
        status: "pending",
        ssl: { status: "pending_validation" },
      }),
    );

    const result = await createCustomHostname("blog.example.com");

    expect(result).toMatchObject({
      id: "ch_123",
      hostname: "blog.example.com",
      status: "pending",
      sslStatus: "pending_validation",
      dcvTarget: "blogbat.com",
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://api.cloudflare.com/client/v4/zones/blogbat.com/custom_hostnames",
    );
    expect(init.method).toBe("POST");
    expect(
      (init.headers as Record<string, string>).Authorization,
    ).toBe("Bearer secret-token");
    expect(JSON.parse(init.body)).toMatchObject({
      hostname: "blog.example.com",
      ssl: { method: "http", type: "dv", settings: { min_tls_version: "1.2" } },
    });
  });

  it("exposes an ownership-verification record when Cloudflare returns one", async () => {
    fetchMock.mockResolvedValue(
      cfOk({
        id: "ch_1",
        hostname: "blog.example.com",
        status: "pending",
        ownership_verification: {
          type: "txt",
          name: "_cf-custom-hostname.blog.example.com",
          value: "abc-123",
        },
      }),
    );

    const result = await getCustomHostname("ch_1");
    expect(result.ownershipVerification).toEqual({
      type: "txt",
      name: "_cf-custom-hostname.blog.example.com",
      value: "abc-123",
    });
  });

  it("throws CloudflareApiError with the API message on failure", async () => {
    fetchMock.mockResolvedValue(cfErr(400, "hostname already exists"));
    await expect(getCustomHostname("ch_x")).rejects.toMatchObject({
      name: "CloudflareApiError",
      message: expect.stringContaining("hostname already exists"),
    });
  });

  it("deletes a custom hostname by id", async () => {
    fetchMock.mockResolvedValue(cfOk({ id: "ch_123" }));
    await deleteCustomHostname("ch_123");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://api.cloudflare.com/client/v4/zones/blogbat.com/custom_hostnames/ch_123",
    );
    expect(init.method).toBe("DELETE");
  });

  it("never includes the token in a thrown error", async () => {
    fetchMock.mockResolvedValue(cfErr(403, "forbidden"));
    try {
      await getCustomHostname("ch_x");
      throw new Error("expected throw");
    } catch (err) {
      expect((err as CloudflareApiError).message).not.toContain("secret-token");
    }
  });
});
