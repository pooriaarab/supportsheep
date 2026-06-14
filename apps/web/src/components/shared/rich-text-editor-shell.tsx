"use client";

/**
 * Rich Text Editor Shell — shared chrome around a TipTap editor instance.
 *
 * Wraps the editor surface that both the article editor at `/posts/[slug]/edit`
 * (`EditorLayout`) and the in-call interview canvas (`CanvasCollaborativeEditor`)
 * use, so the two surfaces stay character-level identical: same toolbar layout,
 * same slash-command palette, same bubble menus, same prose width / padding /
 * focus ring. Lifting the chrome here is what keeps the canvas from drifting
 * away from the post editor over time.
 *
 * What's inside:
 *   - Sticky top toolbar (`EditorToolbar`) centred at `max-w-3xl`.
 *   - Centred prose column (`max-w-3xl mx-auto px-6 md:px-10`).
 *   - Optional inline title slot (passed via `topSlot`) for callers that
 *     need an inline `<input>` title above the editor.
 *   - `EditorContent` with the canonical prose classes (set on the
 *     editor's `editorProps.attributes.class`, not here).
 *   - `EditorSlashMenu` driven by a caller-owned `slashState`.
 *   - `EditorFigureMenu` for body-image alt editing.
 *   - `overlay` slot for callers that want to render absolutely-positioned
 *     UI on top of the editor (e.g. the AI collaborative cursor in the
 *     interview canvas).
 *
 * The shell intentionally does NOT own the TipTap editor instance, the
 * slash state, or any content — those stay with the caller so the
 * existing data-flow (autosave, AI cursor decoration, canvas diff bridge,
 * recentHumanEdit quiet window) keeps working unchanged.
 */

import type { Editor } from "@tiptap/react";
import { EditorContent } from "@tiptap/react";
import { EditorToolbar } from "@/components/shared/editor-toolbar";
import { EditorSlashMenu } from "@/components/shared/editor-slash-menu";
import { EditorFigureMenu } from "@/components/shared/editor-figure-menu";
import type { SlashCommandState } from "@/lib/tiptap";
import { cn } from "@/lib/utils";

interface RichTextEditorShellProps {
  /** TipTap editor instance, owned by the caller. */
  editor: Editor | null;
  /** Slash-command plugin state; pass-through when the slash palette is wired. */
  slashState?: SlashCommandState;
  /** Article slug — forwarded to the figure menu for AI image generation. */
  articleSlug?: string;
  /** Article title — forwarded to slash + figure menus for AI suggestions. */
  articleTitle?: string;
  /** Article excerpt — forwarded to slash + figure menus for AI suggestions. */
  articleExcerpt?: string;
  /** Renders above the editor content, inside the centred prose column.
   *  Used by the article editor for the inline title `<input>`. */
  topSlot?: React.ReactNode;
  /** Renders inside the scroll container as a positioned overlay (e.g. AI cursor). */
  overlay?: React.ReactNode;
  /** Optional extra class on the outer container. */
  className?: string;
  /** Test-id forwarded to the outer container. */
  "data-testid"?: string;
}

export function RichTextEditorShell({
  editor,
  slashState,
  articleSlug,
  articleTitle,
  articleExcerpt,
  topSlot,
  overlay,
  className,
  "data-testid": dataTestId,
}: RichTextEditorShellProps) {
  return (
    <div
      className={cn("flex flex-col min-w-0 h-full", className)}
      data-testid={dataTestId}
    >
      <div className="max-w-3xl mx-auto w-full">
        <EditorToolbar editor={editor} />
      </div>
      <div className="flex-1 overflow-y-auto relative">
        <div className="max-w-3xl mx-auto px-6 md:px-10">
          {topSlot}
          <EditorContent editor={editor} />
        </div>
        {overlay}
        {slashState ? (
          <EditorSlashMenu
            editor={editor}
            state={slashState}
            articleTitle={articleTitle}
            articleExcerpt={articleExcerpt}
          />
        ) : null}
        <EditorFigureMenu
          editor={editor}
          articleSlug={articleSlug}
          articleTitle={articleTitle}
          articleExcerpt={articleExcerpt}
        />
      </div>
    </div>
  );
}
