/**
 * Shared image-upload helper for the editor.
 *
 * Triggers a hidden file picker, uploads the selected file to /api/v1/media,
 * then inserts a Figure node into the editor. A toast surfaces any failure.
 */

import type { Editor } from "@tiptap/react";
import { toast } from "sonner";

interface UploadResponse {
  url: string;
  width?: number;
  height?: number;
}

async function uploadImage(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/v1/media", {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || "Upload failed");
  }
  return (await res.json()) as UploadResponse;
}

/**
 * Opens a file picker, uploads the chosen image, and inserts a Figure node.
 *
 * Fire-and-forget: the upload and insertion happen asynchronously after the
 * user picks a file. Errors are surfaced via a toast. The hidden input element
 * is removed from the DOM on file selection or on picker cancel.
 */
export function insertImageViaUpload(editor: Editor): void {
  if (typeof document === "undefined") return;

  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.style.display = "none";

  const cleanup = () => input.remove();

  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    cleanup();
    if (!file) return;

    try {
      const { url, width, height } = await uploadImage(file);
      const defaultAlt = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
      editor
        .chain()
        .focus()
        .insertFigure({
          src: url,
          alt: defaultAlt,
          width,
          height,
        })
        .run();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to upload image";
      toast.error(message);
    }
  });

  // `cancel` fires when the file picker is closed without a selection
  // (Chrome 113+, Firefox 91+, Safari 16.4+). Without this, the hidden
  // input would leak into the DOM every time the user cancels.
  input.addEventListener("cancel", cleanup);

  document.body.appendChild(input);
  input.click();
}
