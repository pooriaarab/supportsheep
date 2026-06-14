/**
 * Pre-validation for audio uploads to async-response and share-link question
 * routes (F-002). Both routes forward the uploaded blob to OpenAI Whisper
 * (billed per minute of audio) so we need to reject oversize / wrong-MIME
 * payloads before the round-trip, not after.
 *
 * Limits intentionally sit just under the Whisper 25 MB hard cap and cover
 * the set of MIME types Whisper accepts for inline upload. Defensive defaults:
 * a missing `Content-Length` falls back to inspecting the parsed blob size.
 */

/** Whisper hard limit is 25 MB; we cap at 10 MB to stay well under it. */
export const AUDIO_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

export const ALLOWED_AUDIO_MIME_TYPES: readonly string[] = [
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/ogg",
];

export type AudioUploadValidationError =
  | { kind: "too_large"; declaredBytes: number }
  | { kind: "invalid_mime_type"; type: string };

/**
 * Validate `Content-Length` (if present) before consuming the request body.
 * Returning early avoids buffering megabyte-scale payloads only to reject
 * them. Returns `null` when the header is missing or unparseable; callers
 * must fall back to inspecting the parsed Blob.size.
 */
export function checkContentLengthHeader(
  headerValue: string | null,
): AudioUploadValidationError | null {
  if (!headerValue) return null;
  const declaredBytes = Number(headerValue);
  if (!Number.isFinite(declaredBytes) || declaredBytes <= 0) return null;
  if (declaredBytes > AUDIO_UPLOAD_MAX_BYTES) {
    return { kind: "too_large", declaredBytes };
  }
  return null;
}

/**
 * Validate the parsed Blob after `request.formData()` has materialized it.
 * Checks both byte size (in case `Content-Length` was missing) and MIME type
 * against the allowlist. Returns an error descriptor or `null` if the blob
 * passes all checks.
 */
export function validateAudioBlob(
  blob: Blob,
): AudioUploadValidationError | null {
  if (blob.size > AUDIO_UPLOAD_MAX_BYTES) {
    return { kind: "too_large", declaredBytes: blob.size };
  }
  if (!isAllowedAudioMimeType(blob.type)) {
    return { kind: "invalid_mime_type", type: blob.type };
  }
  return null;
}

function isAllowedAudioMimeType(rawType: string): boolean {
  if (!rawType) return false;
  // `audio/webm;codecs=opus` etc. — strip the codec hint before matching.
  const baseType = rawType.split(";")[0].trim().toLowerCase();
  return ALLOWED_AUDIO_MIME_TYPES.includes(baseType);
}
