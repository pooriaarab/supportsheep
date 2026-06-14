import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/v1/integrations/route";

// Mock D1 repo
const createIntegrationWithIdMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/integrations/repository", () => ({
  listIntegrations: vi.fn().mockResolvedValue([]),
  createIntegration: vi.fn(),
  createIntegrationWithId: createIntegrationWithIdMock,
  deleteIntegrations: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  verifyRequest: vi.fn().mockResolvedValue({
    uid: "user-id",
    email: "user@example.com",
    authTime: Date.now(),
  }),
}));

vi.mock("@/lib/audit-log", () => ({
  getClientIp: vi.fn(() => "127.0.0.1"),
  logAuditEvent: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/lib/tenancy/repository", () => ({
  resolveTenantForUser: vi.fn().mockResolvedValue({ blogId: "default", role: "admin" }),
  DEFAULT_BLOG_ID: "default",
}));

describe("POST /api/v1/integrations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createIntegrationWithIdMock.mockResolvedValue({
      id: "integration-1",
      blogId: "default",
      name: "Google Analytics 4",
      type: "oauth",
      status: "disconnected",
      description: "",
      icon: "G",
      config: {},
      connectedAt: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  });

  it("stores GA4 config without undefined fields", async () => {
    const request = new NextRequest(
      "https://supportsheep.com/api/v1/integrations",
      {
        method: "POST",
        body: JSON.stringify({
          name: "Google Analytics 4",
          type: "oauth",
          config: {
            provider: "google_analytics",
            oauthClientId: "client-id.apps.googleusercontent.com",
            oauthClientSecret: "client-secret",
            measurementId: "G-YVQP53KVH9",
            propertyId: "536877107",
          },
        }),
      },
    );

    const response = await POST(request);

    expect(response.status).toBe(201);
    expect(createIntegrationWithIdMock).toHaveBeenCalledOnce();
    const storedConfig = createIntegrationWithIdMock.mock.calls[0][2].config;
    expect(storedConfig).toMatchObject({
      provider: "google_analytics",
      measurementId: "G-YVQP53KVH9",
      propertyId: "536877107",
    });
    expect(Object.hasOwn(storedConfig, "siteUrl")).toBe(false);
  });

  it("stores Search Console config without undefined fields", async () => {
    createIntegrationWithIdMock.mockResolvedValue({
      id: "integration-2",
      blogId: "default",
      name: "Google Search Console",
      type: "oauth",
      status: "disconnected",
      description: "",
      icon: "G",
      config: {},
      connectedAt: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const request = new NextRequest(
      "https://supportsheep.com/api/v1/integrations",
      {
        method: "POST",
        body: JSON.stringify({
          name: "Google Search Console",
          type: "oauth",
          config: {
            provider: "google_search_console",
            oauthClientId: "client-id.apps.googleusercontent.com",
            oauthClientSecret: "client-secret",
            siteUrl: "https://supportsheep.com/",
          },
        }),
      },
    );

    const response = await POST(request);

    expect(response.status).toBe(201);
    const storedConfig = createIntegrationWithIdMock.mock.calls[0][2].config;
    expect(storedConfig).toMatchObject({
      provider: "google_search_console",
      siteUrl: "https://supportsheep.com/",
    });
    expect(Object.hasOwn(storedConfig, "measurementId")).toBe(false);
    expect(Object.hasOwn(storedConfig, "propertyId")).toBe(false);
  });
});
