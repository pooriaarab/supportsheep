import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { createHmac } from "node:crypto";
import { POST } from "./route";

// Mock getBlogConfig
vi.mock("@/lib/blog-config", () => ({
  getBlogConfig: vi.fn(async () => ({
    ai: { providers: { tavus: { apiKey: "test-tavus-key" } } },
  })),
}));

// D1 interviews repository mocks — interview lookup + update now run on D1.
const mockGetByTavus = vi.fn();
const mockUpdateInterview = vi.fn();

// R2 media bucket mock — the recording bytes go to R2.
const mockBucketPut = vi.fn();

vi.mock("@/lib/media/bucket", () => ({
  getMediaBucket: () => ({ put: mockBucketPut }),
}));

vi.mock("@/lib/interviews/interviews-repository", () => ({
  getInterviewByTavusConversationId: (...args: unknown[]) =>
    mockGetByTavus(...args),
  updateInterview: (...args: unknown[]) => mockUpdateInterview(...args),
}));


describe("POST /api/v1/integrations/webhooks/tavus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const generateSignature = (body: string, key: string) => {
    return createHmac("sha256", key).update(body).digest("hex");
  };

  it("should return 401 when signature is missing", async () => {
    const req = new NextRequest("http://localhost/api/v1/integrations/webhooks/tavus", {
      method: "Article",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_type: "system.replica_joined" }),
    });

    const res = await POST(req, {} as never);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Missing signature");
  });

  it("should return 401 when signature is invalid", async () => {
    const body = JSON.stringify({ event_type: "system.replica_joined" });
    const req = new NextRequest("http://localhost/api/v1/integrations/webhooks/tavus", {
      method: "Article",
      headers: {
        "Content-Type": "application/json",
        "x-tavus-signature": "invalid-signature",
      },
      body,
    });

    const res = await POST(req, {} as never);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Invalid signature");
  });

  it("should return 200 with received: true for non-recording callbacks", async () => {
    const body = JSON.stringify({ event_type: "system.replica_joined", conversation_id: "c-123" });
    const signature = generateSignature(body, "test-tavus-key");

    const req = new NextRequest("http://localhost/api/v1/integrations/webhooks/tavus", {
      method: "Article",
      headers: {
        "Content-Type": "application/json",
        "x-tavus-signature": signature,
      },
      body,
    });

    const res = await POST(req, {} as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.received).toBe(true);
    expect(mockGetByTavus).not.toHaveBeenCalled();
  });

  it("should download video and upload to storage on happy path application.recording_ready", async () => {
    const body = JSON.stringify({
      event_type: "application.recording_ready",
      conversation_id: "tavus-conv-999",
      properties: {
        recording_url: "https://recordings.tavusapi.com/recordings/video-999.webm",
      },
    });
    const signature = generateSignature(body, "test-tavus-key");

    // Mock interview lookup (D1)
    mockGetByTavus.mockResolvedValueOnce({
      id: "interview-777",
      tavusConversationId: "tavus-conv-999",
    });
    mockUpdateInterview.mockResolvedValueOnce(undefined);

    // Mock fetch for video download
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
    } as Response);

    const req = new NextRequest("http://localhost/api/v1/integrations/webhooks/tavus", {
      method: "Article",
      headers: {
        "Content-Type": "application/json",
        "x-tavus-signature": signature,
      },
      body,
    });

    const res = await POST(req, {} as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    // Minimal response — does NOT include interviewId or storagePath
    expect(json.interviewId).toBeUndefined();
    expect(json.storagePath).toBeUndefined();

    // Verify interview look up happened
    expect(mockGetByTavus).toHaveBeenCalledWith(
      expect.any(String),
      "tavus-conv-999",
    );

    // Verify video was downloaded from the correct URL
    expect(fetchSpy).toHaveBeenCalledWith("https://recordings.tavusapi.com/recordings/video-999.webm");

    // Verify the recording was stored in R2 under the private interview key.
    expect(mockBucketPut).toHaveBeenCalledTimes(1);
    expect(mockBucketPut.mock.calls[0][0]).toBe("interviews/interview-777/video.webm");
    expect(mockBucketPut.mock.calls[0][2]).toEqual({
      httpMetadata: { contentType: "video/webm" },
    });

    // Verify interview record was updated in D1 with the R2 key.
    expect(mockUpdateInterview).toHaveBeenCalledWith(
      expect.any(String),
      "interview-777",
      { videoStoragePath: "interviews/interview-777/video.webm" },
    );
  });

  it("should reject recording_url that's not on an allowed Tavus host", async () => {
    const body = JSON.stringify({
      event_type: "application.recording_ready",
      conversation_id: "tavus-conv-evil",
      properties: {
        recording_url: "https://attacker.example.com/exfil.webm",
      },
    });
    const signature = generateSignature(body, "test-tavus-key");

    const req = new NextRequest("http://localhost/api/v1/integrations/webhooks/tavus", {
      method: "Article",
      headers: {
        "Content-Type": "application/json",
        "x-tavus-signature": signature,
      },
      body,
    });
    const res = await POST(req, {} as never);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/Invalid recording URL/);
  });

  it("should reject non-HTTPS recording_url", async () => {
    const body = JSON.stringify({
      event_type: "application.recording_ready",
      conversation_id: "tavus-conv-http",
      properties: {
        recording_url: "http://recordings.tavusapi.com/video.webm",
      },
    });
    const signature = generateSignature(body, "test-tavus-key");

    const req = new NextRequest("http://localhost/api/v1/integrations/webhooks/tavus", {
      method: "Article",
      headers: {
        "Content-Type": "application/json",
        "x-tavus-signature": signature,
      },
      body,
    });
    const res = await POST(req, {} as never);
    expect(res.status).toBe(400);
  });
});
