import { describe, expect, it } from "vitest";
import {
  AUDIO_UPLOAD_MAX_BYTES,
  checkContentLengthHeader,
  validateAudioBlob,
} from "./audio-upload-validation";

describe("checkContentLengthHeader", () => {
  it("returns null when the header is missing", () => {
    expect(checkContentLengthHeader(null)).toBeNull();
  });

  it("returns null when the declared length fits the cap", () => {
    expect(checkContentLengthHeader("1024")).toBeNull();
    expect(checkContentLengthHeader(String(AUDIO_UPLOAD_MAX_BYTES))).toBeNull();
  });

  it("returns null when the header is unparseable (no defensive 4xx)", () => {
    // We want fail-open behaviour on a malformed header — the blob check is
    // the authoritative gate.
    expect(checkContentLengthHeader("abc")).toBeNull();
    expect(checkContentLengthHeader("-1")).toBeNull();
  });

  it("flags too_large when the declared length exceeds the cap", () => {
    const err = checkContentLengthHeader(String(AUDIO_UPLOAD_MAX_BYTES + 1));
    expect(err?.kind).toBe("too_large");
  });
});

describe("validateAudioBlob", () => {
  it("accepts a normal webm blob", () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: "audio/webm" });
    expect(validateAudioBlob(blob)).toBeNull();
  });

  it("accepts a webm blob with codec hint in the MIME type", () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], {
      type: "audio/webm;codecs=opus",
    });
    expect(validateAudioBlob(blob)).toBeNull();
  });

  it("rejects an image masquerading as audio", () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" });
    const err = validateAudioBlob(blob);
    expect(err?.kind).toBe("invalid_mime_type");
  });

  it("rejects a blob that exceeds the size cap even when MIME is allowed", () => {
    const oversize = new Uint8Array(AUDIO_UPLOAD_MAX_BYTES + 1);
    const blob = new Blob([oversize], { type: "audio/webm" });
    const err = validateAudioBlob(blob);
    expect(err?.kind).toBe("too_large");
  });
});
