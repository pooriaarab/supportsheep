/**
 * WordPress Import API
 *
 * POST  /api/v1/import/wordpress -- Upload WXR XML file and start import
 * GET   /api/v1/import/wordpress?id=xxx -- Check import job status
 * PATCH /api/v1/import/wordpress -- Cancel a running import (body: { id, status })
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { verifyRequest } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api-utils";
import {
  createImport,
  getImport,
  listImports,
  updateImport,
} from "@/lib/import/imports-repository";
import {
  parseWordPressXml,
  importWordPressPosts,
} from "@/lib/import/wordpress";
import { DEFAULT_BLOG_ID } from "@/lib/tenancy/repository";
import { createLogger } from "@/lib/logger";

const log = createLogger("api:import:wordpress");

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * GET /api/v1/import/wordpress?id=xxx
 * Check the status of an import job
 */
export async function GET(request: NextRequest) {
  try {
    await verifyRequest();

    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      // List recent imports
      const imports = await listImports(DEFAULT_BLOG_ID);
      return NextResponse.json({ data: imports });
    }

    const entry = await getImport(DEFAULT_BLOG_ID, id);
    if (!entry) {
      return NextResponse.json(
        { error: "Import job not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: entry });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/v1/import/wordpress
 * Cancel a running import by setting its status to "failed"
 */
export async function PATCH(request: NextRequest) {
  try {
    await verifyRequest();

    const body = await request.json();
    const { id, status } = body as { id?: string; status?: string };

    if (!id || status !== "failed") {
      return NextResponse.json(
        { error: "Invalid request. Provide { id, status: 'failed' }." },
        { status: 400 },
      );
    }

    const entry = await getImport(DEFAULT_BLOG_ID, id);
    if (!entry) {
      return NextResponse.json(
        { error: "Import job not found" },
        { status: 404 },
      );
    }

    if (entry.status !== "running") {
      return NextResponse.json(
        { error: "Only running imports can be cancelled" },
        { status: 400 },
      );
    }

    const updated = await updateImport(DEFAULT_BLOG_ID, id, {
      status: "failed",
      completedAt: Date.now(),
    });

    log.info(`Import cancelled: ${id}`);

    return NextResponse.json({ data: updated });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}

/**
 * POST /api/v1/import/wordpress
 * Upload a WordPress WXR XML file and start the import process
 */
export async function POST(request: NextRequest) {
  try {
    const session = await verifyRequest();

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (err) {
      log.error("Failed to parse form data", {
        error: err instanceof Error ? err.message : String(err),
      });
      return NextResponse.json(
        {
          error:
            "Failed to read the uploaded file. The file may be too large or the upload was interrupted.",
        },
        { status: 413 },
      );
    }
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        {
          error:
            "No file uploaded. Please provide a WordPress XML export file.",
        },
        { status: 400 },
      );
    }

    if (!file.name.endsWith(".xml")) {
      return NextResponse.json(
        { error: "Invalid file type. Please upload a .xml file." },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 50MB." },
        { status: 400 },
      );
    }

    const xmlContent = await file.text();

    // Parse the WordPress XML
    const posts = parseWordPressXml(xmlContent);

    if (posts.length === 0) {
      return NextResponse.json(
        {
          error:
            "No posts found in the uploaded file. Ensure it is a valid WordPress export (WXR) file.",
        },
        { status: 400 },
      );
    }

    // Create the import job in D1
    const job = await createImport(DEFAULT_BLOG_ID, {
      totalPosts: posts.length,
      createdBy: session.uid,
    });

    log.info(`Starting WordPress import: ${job.id}`, {
      totalPosts: posts.length,
      fileName: file.name,
    });

    // Start import in the background (non-blocking)
    importWordPressPosts(posts, job.id, DEFAULT_BLOG_ID).catch((err) => {
      log.error("WordPress import failed", {
        importId: job.id,
        error: err instanceof Error ? err.message : String(err),
      });
      updateImport(DEFAULT_BLOG_ID, job.id, {
        status: "failed",
        completedAt: Date.now(),
      }).catch(() => {});
    });

    return NextResponse.json(
      {
        id: job.id,
        totalPosts: posts.length,
        message: `Import started. ${posts.length} post(s) detected.`,
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    return handleApiError(error);
  }
}
