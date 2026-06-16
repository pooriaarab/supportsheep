import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, PATCH, POST } from "../route";

// ---------------------------------------------------------------------------
// Auth mock
// ---------------------------------------------------------------------------

const mockVerifyRequest = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/session", () => ({
  verifyRequest: mockVerifyRequest,
  AuthError: class AuthError extends Error {
    status: number;
    constructor(message: string, status = 401) {
      super(message);
      this.name = "AuthError";
      this.status = status;
    }
  },
}));

// ---------------------------------------------------------------------------
// D1 import repo mocks
// ---------------------------------------------------------------------------

const mockCreateImport = vi.hoisted(() => vi.fn());
const mockGetImport = vi.hoisted(() => vi.fn());
const mockListImports = vi.hoisted(() => vi.fn());
const mockUpdateImport = vi.hoisted(() => vi.fn());

vi.mock("@/lib/import/imports-repository", () => ({
  createImport: mockCreateImport,
  getImport: mockGetImport,
  listImports: mockListImports,
  updateImport: mockUpdateImport,
}));

// ---------------------------------------------------------------------------
// WordPress parser + worker mocks
// ---------------------------------------------------------------------------

const mockParseWordPressXml = vi.hoisted(() => vi.fn());
const mockImportWordPressPosts = vi.hoisted(() => vi.fn());

vi.mock("@/lib/import/wordpress", () => ({
  parseWordPressXml: mockParseWordPressXml,
  importWordPressPosts: mockImportWordPressPosts,
}));

// ---------------------------------------------------------------------------
// Tenancy mock
// ---------------------------------------------------------------------------

vi.mock("@/lib/tenancy/repository", () => ({
  DEFAULT_blog_id: "default",
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeJob(overrides = {}) {
  return {
    id: "job-1",
    blogId: "default",
    source: "wordpress",
    status: "running",
    totalPosts: 5,
    importedPosts: 0,
    rehostedImages: 0,
    failedPosts: [],
    createdBy: "user-1",
    startedAt: Date.now(),
    completedAt: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

function makeRequest(
  method: string,
  url: string,
  body?: object | FormData,
): NextRequest {
  if (body instanceof FormData) {
    return new NextRequest(url, { method, body });
  }
  return new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body && !(body instanceof FormData)
      ? { "content-type": "application/json" }
      : undefined,
  });
}

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

describe("GET /api/v1/import/wordpress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyRequest.mockResolvedValue({ uid: "user-1" });
  });

  it("lists imports when no id param", async () => {
    const jobs = [makeJob(), makeJob({ id: "job-2" })];
    mockListImports.mockResolvedValue(jobs);

    const req = makeRequest("GET", "http://localhost/api/v1/import/wordpress");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(2);
    expect(mockListImports).toHaveBeenCalledWith("default");
  });

  it("returns single import when id param present", async () => {
    const job = makeJob();
    mockGetImport.mockResolvedValue(job);

    const req = makeRequest(
      "GET",
      "http://localhost/api/v1/import/wordpress?id=job-1",
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.id).toBe("job-1");
    expect(mockGetImport).toHaveBeenCalledWith("default", "job-1");
  });

  it("returns 404 when import not found", async () => {
    mockGetImport.mockResolvedValue(null);

    const req = makeRequest(
      "GET",
      "http://localhost/api/v1/import/wordpress?id=unknown",
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("Import job not found");
  });
});

// ---------------------------------------------------------------------------
// PATCH
// ---------------------------------------------------------------------------

describe("PATCH /api/v1/import/wordpress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyRequest.mockResolvedValue({ uid: "user-1" });
  });

  it("returns 400 if id missing", async () => {
    const req = makeRequest("PATCH", "http://localhost/api/v1/import/wordpress", {
      status: "failed",
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 if status is not 'failed'", async () => {
    const req = makeRequest("PATCH", "http://localhost/api/v1/import/wordpress", {
      id: "job-1",
      status: "running",
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it("returns 404 when job not found", async () => {
    mockGetImport.mockResolvedValue(null);

    const req = makeRequest("PATCH", "http://localhost/api/v1/import/wordpress", {
      id: "unknown",
      status: "failed",
    });
    const res = await PATCH(req);
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Import job not found");
  });

  it("returns 400 when job is already completed", async () => {
    mockGetImport.mockResolvedValue(makeJob({ status: "completed" }));

    const req = makeRequest("PATCH", "http://localhost/api/v1/import/wordpress", {
      id: "job-1",
      status: "failed",
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Only running imports can be cancelled");
  });

  it("cancels a running import and returns updated entry", async () => {
    const job = makeJob();
    const updated = makeJob({ status: "failed", completedAt: Date.now() });
    mockGetImport.mockResolvedValue(job);
    mockUpdateImport.mockResolvedValue(updated);

    const req = makeRequest("PATCH", "http://localhost/api/v1/import/wordpress", {
      id: "job-1",
      status: "failed",
    });
    const res = await PATCH(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.status).toBe("failed");
    expect(mockUpdateImport).toHaveBeenCalledWith(
      "default",
      "job-1",
      expect.objectContaining({ status: "failed", completedAt: expect.any(Number) }),
    );
  });
});

// ---------------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------------

describe("POST /api/v1/import/wordpress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyRequest.mockResolvedValue({ uid: "user-1" });
    mockImportWordPressPosts.mockResolvedValue(undefined);
  });

  it("returns 400 when no file is uploaded", async () => {
    const formData = new FormData();
    const req = makeRequest("POST", "http://localhost/api/v1/import/wordpress", formData);
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when no posts found in XML", async () => {
    mockParseWordPressXml.mockReturnValue([]);

    const xmlFile = new File(["<rss></rss>"], "export.xml", { type: "text/xml" });
    const formData = new FormData();
    formData.append("file", xmlFile);
    const req = makeRequest("POST", "http://localhost/api/v1/import/wordpress", formData);
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/No posts found/);
  });

  it("creates a D1 import job and returns 201 with id and totalPosts", async () => {
    const posts = [
      { slug: "post-1", title: "Post 1" },
      { slug: "post-2", title: "Post 2" },
    ];
    mockParseWordPressXml.mockReturnValue(posts);
    const job = makeJob({ id: "new-job", totalPosts: 2 });
    mockCreateImport.mockResolvedValue(job);

    const xmlFile = new File(["<rss><channel><item/></channel></rss>"], "export.xml", {
      type: "text/xml",
    });
    const formData = new FormData();
    formData.append("file", xmlFile);
    const req = makeRequest("POST", "http://localhost/api/v1/import/wordpress", formData);
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.id).toBe("new-job");
    expect(body.totalPosts).toBe(2);
    expect(mockCreateImport).toHaveBeenCalledWith(
      "default",
      expect.objectContaining({ totalPosts: 2, createdBy: "user-1" }),
    );
  });

  it("kicks off importWordPressPosts in the background", async () => {
    const posts = [{ slug: "post-1" }];
    mockParseWordPressXml.mockReturnValue(posts);
    const job = makeJob({ id: "bg-job", totalPosts: 1 });
    mockCreateImport.mockResolvedValue(job);

    const xmlFile = new File(["<rss></rss>"], "export.xml", { type: "text/xml" });
    const formData = new FormData();
    formData.append("file", xmlFile);
    const req = makeRequest("POST", "http://localhost/api/v1/import/wordpress", formData);
    await POST(req);

    // Worker is started (non-blocking); may have been called synchronously
    expect(mockImportWordPressPosts).toHaveBeenCalledWith(
      posts,
      "bg-job",
      "default",
    );
  });

  it("marks job as failed when importWordPressPosts throws", async () => {
    const posts = [{ slug: "post-1" }];
    mockParseWordPressXml.mockReturnValue(posts);
    const job = makeJob({ id: "fail-job", totalPosts: 1 });
    mockCreateImport.mockResolvedValue(job);

    // Simulate background worker throwing
    mockImportWordPressPosts.mockRejectedValue(new Error("worker crashed"));

    const xmlFile = new File(["<rss></rss>"], "export.xml", { type: "text/xml" });
    const formData = new FormData();
    formData.append("file", xmlFile);
    const req = makeRequest("POST", "http://localhost/api/v1/import/wordpress", formData);
    await POST(req);

    // Allow the microtask to settle
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(mockUpdateImport).toHaveBeenCalledWith(
      "default",
      "fail-job",
      expect.objectContaining({ status: "failed" }),
    );
  });
});
