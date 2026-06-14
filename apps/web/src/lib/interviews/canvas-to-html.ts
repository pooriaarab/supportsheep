/**
 * Client-side converter that turns a streaming interview canvas snapshot
 * into the same HTML the published-post page renders. Composes the
 * existing pure converter (`canvasToTiptap`) with TipTap's `generateHTML`
 * helper using the standard editor schema, so the in-call preview lands
 * on the exact ProseMirror serialisation the writer would persist if the
 * user hit "publish" right now.
 *
 * Runs in the browser only — TipTap's `generateHTML` needs a real DOM —
 * which is why this module is consumed exclusively by the `"use client"`
 * canvas renderer. Server-side rendering paths (e.g. the published-post
 * page) already have HTML and skip this step entirely.
 */
import { generateHTML } from "@tiptap/core";
import { getEditorExtensions } from "@/lib/tiptap";
import { canvasToTiptap } from "@/lib/interviews/canvas-to-tiptap";
import type { CanvasState } from "@/hooks/use-interview-session";

let cachedExtensions: ReturnType<typeof getEditorExtensions> | null = null;

function getCanvasExtensions() {
  // The extensions only differ by their `placeholder` text, which doesn't
  // affect HTML serialisation. Cache one instance so we don't reconstruct
  // the (heavy) extension list on every diff that lands on the canvas.
  if (!cachedExtensions) {
    cachedExtensions = getEditorExtensions({ placeholder: "" });
  }
  return cachedExtensions;
}

/**
 * Convert a {@link CanvasState} snapshot into HTML using the same TipTap
 * extension stack the post editor uses. Returns an empty string when the
 * canvas has no renderable content so callers can skip the body render.
 *
 * Guarded by a `typeof document` check because TipTap's `generateHTML`
 * relies on `document.implementation.createHTMLDocument()`. In non-DOM
 * environments (Node-side SSR, Vitest node env) we return an empty
 * string — those environments never display the canvas, so the
 * round-trip is a no-op there.
 */
export function canvasToHtml(canvas: CanvasState): string {
  const doc = canvasToTiptap(canvas);
  if (doc.content.length === 0) return "";
  if (typeof document === "undefined") return "";
  return generateHTML(doc, getCanvasExtensions());
}
