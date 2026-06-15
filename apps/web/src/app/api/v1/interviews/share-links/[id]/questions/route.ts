import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/create-api-handler";
import { getProviderApiKey } from "@/lib/ai/providers";
import {
  canMintShareLink,
  canRevokeAnyShareLink,
} from "@/lib/interviews/share-link-permissions";
import { getBlogConfigEffectiveMinters } from "@/lib/interviews/effective-minters";
import {
  checkContentLengthHeader,
  validateAudioBlob,
} from "@/lib/interviews/audio-upload-validation";
import { createLogger } from "@/lib/logger";
import { getMediaBucket } from "@/lib/media/bucket";
import { RATE_LIMITS } from "@/lib/rate-limit";
import type { UserRole } from "@repo/types";
import {
  getShareLink,
  appendAsyncQuestion,
} from "@/lib/interviews/share-links-repository";
import { DEFAULT_blog_id } from "@/lib/tenancy/repository";

const log = createLogger("interviews:share-link-questions");

export const POST = createApiHandler<unknown, { id: string }>({
  auth: "user",
  audit: "upload_async_question",
  rateLimit: {
    key: "interview-async-question",
    maxPerMinute: RATE_LIMITS["interview-async-question"],
  },
  handler: async ({ request, session, params, role: ctxRole }) => {
    const shareLinkId = params?.id;
    if (!shareLinkId) {
      return NextResponse.json({ error: "share link not found" }, { status: 404 });
    }

    // 1. Role check, narrowed by the workspace `whoCanMintLinks` config (F-004).
    const role = (ctxRole ?? "guest") as UserRole;

    const effectiveMinters = await getBlogConfigEffectiveMinters();
    if (!canMintShareLink(role, effectiveMinters)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    // 1b. Reject oversize uploads via Content-Length up-front (F-002).
    const lengthError = checkContentLengthHeader(
      request.headers.get("content-length"),
    );
    if (lengthError?.kind === "too_large") {
      return NextResponse.json({ error: "file_too_large" }, { status: 413 });
    }

    // 2. Fetch Share Link
    const shareLink = await getShareLink(DEFAULT_blog_id, shareLinkId);
    if (!shareLink) {
      return NextResponse.json({ error: "share link not found" }, { status: 404 });
    }

    // 2b. Ownership check (F-012). Without this any editor in the workspace
    //     could append questions to another user's share-link campaign.
    if (
      shareLink.createdBy !== session.uid &&
      !canRevokeAnyShareLink(role)
    ) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    // 3. Extract File from Multipart Form Data
    let file: Blob | null = null;
    try {
      const data = await request.formData();
      file = data.get("file") as Blob | null;
    } catch {
      // Body parsing failed or not form-data
    }

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // 3b. Post-parse audio validation — MIME allowlist + size cap (F-002).
    const blobError = validateAudioBlob(file);
    if (blobError) {
      log.warn("share-link-questions: rejected upload", {
        shareLinkId,
        kind: blobError.kind,
        type: blobError.kind === "invalid_mime_type" ? blobError.type : undefined,
        bytes: blobError.kind === "too_large" ? blobError.declaredBytes : undefined,
      });
      const status = blobError.kind === "too_large" ? 413 : 415;
      return NextResponse.json(
        { error: blobError.kind === "too_large" ? "file_too_large" : "invalid_audio_type" },
        { status },
      );
    }

    const questionId = crypto.randomUUID();

    // 4. OpenAI Whisper Transcription
    let transcript = "";
    try {
      const apiKey = await getProviderApiKey("gpt");
      const whisperFormData = new FormData();
      whisperFormData.append("file", file, "question.webm");
      whisperFormData.append("model", "whisper-1");
      if (shareLink.language) {
        whisperFormData.append("language", shareLink.language);
      }

      const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "Article",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: whisperFormData,
      });

      if (!whisperRes.ok) {
        const errorText = await whisperRes.text();
        log.error("share-link-questions: Whisper transcription failed", {
          shareLinkId,
          status: whisperRes.status,
          body: errorText.slice(0, 500),
        });
        return NextResponse.json(
          { error: "transcription_failed" },
          { status: 502 },
        );
      }

      const whisperData = (await whisperRes.json()) as { text: string };
      transcript = whisperData.text || "";
    } catch (err) {
      log.error("share-link-questions: transcription fetch threw", {
        shareLinkId,
        error: err instanceof Error ? err.message : String(err),
      });
      return NextResponse.json({ error: "transcription_failed" }, { status: 500 });
    }

    // 5. Upload audio bytes to R2. Question recordings stay workspace-private
    //    (the key does not start with `media/`, so the public media route
    //    rejects them) and are served only via the authed recording-file route
    //    after re-verifying the caller.
    const storagePath = `share-links/${shareLinkId}/questions/${questionId}.webm`;
    try {
      await getMediaBucket().put(storagePath, await file.arrayBuffer(), {
        httpMetadata: { contentType: file.type || "audio/webm" },
      });
    } catch (err) {
      log.error("share-link-questions: storage save failed", {
        shareLinkId,
        storagePath,
        error: err instanceof Error ? err.message : String(err),
      });
      return NextResponse.json({ error: "storage_error" }, { status: 500 });
    }

    // 6. Append question to share link's asyncQuestions array in D1
    const questionObj = {
      id: questionId,
      text: transcript,
      audioStoragePath: storagePath,
    };

    try {
      await appendAsyncQuestion(DEFAULT_blog_id, shareLinkId, questionObj);
    } catch (err) {
      log.error("share-link-questions: share-link update failed", {
        shareLinkId,
        error: err instanceof Error ? err.message : String(err),
      });
      return NextResponse.json({ error: "storage_error" }, { status: 500 });
    }

    return NextResponse.json(questionObj, { status: 201 });
  },
});
