import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/create-api-handler";
import { getProviderApiKey } from "@/lib/ai/providers";
import { verifyInterviewToken } from "@/lib/interviews/interview-token";
import { resolveInterviewTokenFromRequest } from "@/lib/interviews/interview-token-request";
import {
  checkContentLengthHeader,
  validateAudioBlob,
} from "@/lib/interviews/audio-upload-validation";
import { getInterview, incrementResponsesCount } from "@/lib/interviews/interviews-repository";
import { upsertAsyncResponse } from "@/lib/interviews/async-responses-repository";
import { getMediaBucket } from "@/lib/media/bucket";
import { DEFAULT_blog_id } from "@/lib/tenancy/repository";
import { createLogger } from "@/lib/logger";
import { RATE_LIMITS } from "@/lib/rate-limit";

const log = createLogger("interviews:async-response");

export const POST = createApiHandler<unknown, { id: string }>({
  auth: "none",
  rateLimit: {
    key: "interview-async-response",
    maxPerMinute: RATE_LIMITS["interview-async-response"],
  },
  handler: async ({ request, params }) => {
    const interviewId = params?.id;
    if (!interviewId) {
      return NextResponse.json({ error: "Interview not found" }, { status: 404 });
    }

    // 1. Authorize via interview cookie set on /consent, or legacy
    //    `Authorization: Bearer` header for clients that have not yet
    //    migrated off the URL-token pathway.
    const resolved = resolveInterviewTokenFromRequest(request, interviewId);
    if (!resolved) {
      return NextResponse.json(
        { error: "Missing interview token" },
        { status: 401 }
      );
    }

    const tokenPayload = verifyInterviewToken(resolved.token);
    if (!tokenPayload) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    // 2. Cross-verify that the token interview ID matches params ID
    if (tokenPayload.interviewId !== interviewId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    // 2b. Reject oversize uploads via Content-Length (F-002) before
    //     buffering the body or paying for a Whisper round-trip.
    const lengthError = checkContentLengthHeader(
      request.headers.get("content-length"),
    );
    if (lengthError?.kind === "too_large") {
      return NextResponse.json({ error: "file_too_large" }, { status: 413 });
    }

    // 3. Fetch Interview from D1
    const blogId = DEFAULT_blog_id;
    const interview = await getInterview(blogId, interviewId);
    if (!interview) {
      return NextResponse.json({ error: "Interview not found" }, { status: 404 });
    }

    if (interview.mode !== "async") {
      return NextResponse.json({ error: "Interview is not in async mode" }, { status: 400 });
    }

    // 4. Extract file and questionId from Multipart Form Data
    let file: Blob | null = null;
    let questionId = "";
    try {
      const data = await request.formData();
      file = data.get("file") as Blob | null;
      questionId = (data.get("questionId") as string) || "";
    } catch {
      // Body parsing failed
    }

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Post-parse audio validation (F-002). Rejects non-audio MIME types
    // (e.g. a JPG renamed `.webm` that would still cost us a Whisper
    // round-trip) and over-cap files when no Content-Length was sent.
    const blobError = validateAudioBlob(file);
    if (blobError) {
      log.warn("async-response: rejected upload", {
        interviewId,
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

    if (!questionId || !/^[\w-]+$/.test(questionId)) {
      return NextResponse.json({ error: "Invalid or missing questionId" }, { status: 400 });
    }

    // 5. OpenAI Whisper Transcription
    let transcript = "";
    try {
      const apiKey = await getProviderApiKey("gpt");
      const whisperFormData = new FormData();
      whisperFormData.append("file", file, "response.webm");
      whisperFormData.append("model", "whisper-1");
      if (interview.language) {
        whisperFormData.append("language", interview.language);
      }

      const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: whisperFormData,
      });

      if (!whisperRes.ok) {
        const errorText = await whisperRes.text();
        log.error("async-response: Whisper transcription failed", {
          interviewId,
          status: whisperRes.status,
          // Truncated to avoid blowing up the log with megabyte-scale error bodies.
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
      log.error("async-response: transcription fetch threw", {
        interviewId,
        error: err instanceof Error ? err.message : String(err),
      });
      return NextResponse.json({ error: "transcription_failed" }, { status: 500 });
    }

    // 6. Upload audio bytes to R2. Only the path string is persisted in D1.
    //    Recordings contain guest PII (the key does not start with `media/`,
    //    so the public media route rejects them) and are served only via the
    //    authed recording-file route after re-verifying the caller.
    const storagePath = `interviews/${interviewId}/responses/${questionId}.webm`;
    try {
      await getMediaBucket().put(storagePath, await file.arrayBuffer(), {
        httpMetadata: { contentType: file.type || "audio/webm" },
      });
    } catch (err) {
      log.error("async-response: storage save failed", {
        interviewId,
        storagePath,
        error: err instanceof Error ? err.message : String(err),
      });
      return NextResponse.json({ error: "storage_error" }, { status: 500 });
    }

    // 7. Write Response to D1 (upsert — re-answering the same question
    //    overwrites the previous transcript and storage path).
    try {
      await upsertAsyncResponse(blogId, interviewId, {
        questionId,
        audioStoragePath: storagePath,
        transcript,
      });
    } catch (err) {
      log.error("async-response: D1 upsert failed", {
        interviewId,
        questionId,
        error: err instanceof Error ? err.message : String(err),
      });
      return NextResponse.json({ error: "storage_error" }, { status: 500 });
    }

    // 8. Atomically increment responsesCount on the interview row
    try {
      await incrementResponsesCount(blogId, interviewId);
    } catch (err) {
      log.error("async-response: interview increment failed", {
        interviewId,
        error: err instanceof Error ? err.message : String(err),
      });
      return NextResponse.json({ error: "storage_error" }, { status: 500 });
    }

    return NextResponse.json(
      { audioStoragePath: storagePath, transcript },
      { status: 201 },
    );
  },
});
