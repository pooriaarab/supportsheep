"use client";

/**
 * Editor Figure Menu -- inline alt-text editor for body images.
 *
 * Renders a BubbleMenu that appears only when a `figure` node is selected in
 * the editor. Authors can edit the alt text without leaving the body, which
 * closes the accessibility gap of body-image alt text having no UI surface.
 *
 * The figcaption is edited in-place via the figure node's `content` hole, so
 * this menu focuses on the alt attribute (the only piece without an inline
 * editing surface).
 */

import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { NodeSelection } from "@tiptap/pm/state";
import { Sparkles } from "lucide-react";
import { Button } from "@repo/ui/primitives/button";
import { Input } from "@repo/ui/primitives/input";
import { Label } from "@repo/ui/primitives/label";
import { GenerateImageDialog } from "@/components/posts/editor/generate-image-dialog";

interface EditorFigureMenuProps {
  editor: Editor | null;
  articleSlug?: string;
  articleTitle?: string;
  articleExcerpt?: string;
}

function getFigureAlt(editor: Editor | null): string {
  if (!editor) return "";
  const { selection } = editor.state;
  if (selection instanceof NodeSelection && selection.node.type.name === "figure") {
    const alt = selection.node.attrs.alt;
    return typeof alt === "string" ? alt : "";
  }
  return "";
}

export function EditorFigureMenu({
  editor,
  articleSlug,
  articleTitle,
  articleExcerpt,
}: EditorFigureMenuProps) {
  const subscribe = useMemo(() => {
    return (onChange: () => void) => {
      if (!editor) return () => {};
      editor.on("selectionUpdate", onChange);
      editor.on("transaction", onChange);
      return () => {
        editor.off("selectionUpdate", onChange);
        editor.off("transaction", onChange);
      };
    };
  }, [editor]);

  const currentAlt = useSyncExternalStore(
    subscribe,
    () => getFigureAlt(editor),
    () => "",
  );

  // Local draft state so typing does not force a re-render of the editor on
  // every keystroke. We commit changes on blur or Enter.
  const [draft, setDraft] = useState(currentAlt);
  const [lastSyncedAlt, setLastSyncedAlt] = useState(currentAlt);

  // Re-sync the draft whenever the selection changes to a different figure
  // (detected via a change in the upstream alt value). This is derived state,
  // not an effect.
  if (currentAlt !== lastSyncedAlt) {
    setDraft(currentAlt);
    setLastSyncedAlt(currentAlt);
  }

  const commit = useCallback(() => {
    if (!editor) return;
    if (draft === currentAlt) return;
    // Do not call .focus() here — keeping focus in the alt input avoids a
    // jarring focus jump back into the editor on blur/Enter.
    editor.chain().setFigureAlt(draft).run();
  }, [editor, draft, currentAlt]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const dialogFigurePosRef = useRef<number | null>(null);

  const handleGenerate = useCallback(
    ({ url, alt }: { url: string; alt: string }) => {
      if (!editor) return;
      const pos = dialogFigurePosRef.current;
      if (pos == null) return;
      const node = editor.state.doc.nodeAt(pos);
      if (!node) return;
      const tr = editor.state.tr.setNodeMarkup(pos, undefined, {
        ...node.attrs,
        src: url,
        alt,
      });
      editor.view.dispatch(tr);
      dialogFigurePosRef.current = null;
    },
    [editor],
  );

  const shouldShow = useCallback(
    ({ editor: e }: { editor: Editor }) => {
      return e.isActive("figure");
    },
    [],
  );

  if (!editor) return null;

  return (
    <>
      <BubbleMenu
        editor={editor}
        shouldShow={shouldShow}
        options={{ placement: "bottom", offset: 8 }}
      >
        <div className="flex flex-col gap-1 rounded-lg border border-border bg-popover p-2 shadow-md w-64">
          <div className="flex items-center justify-between">
            <Label
              htmlFor="figure-alt-input"
              className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider"
            >
              Alt text
            </Label>
            <Button
              variant="ghost"
              size="sm"
              className="size-6 p-0 shrink-0"
              title="Generate with AI"
              type="button"
              onClick={() => {
                  const { selection } = editor.state;
                  if (selection instanceof NodeSelection) {
                    dialogFigurePosRef.current = selection.from;
                  }
                  setDialogOpen(true);
                }}
            >
              <Sparkles className="size-3" />
            </Button>
          </div>
          <Input
            id="figure-alt-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              }
            }}
            placeholder="Describe this image for screen readers"
            className="h-7 text-xs"
          />
          <p className="text-[10px] text-muted-foreground">
            Click the caption below the image to edit it.
          </p>
        </div>
      </BubbleMenu>
      <GenerateImageDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        slug={articleSlug}
        title={articleTitle}
        excerpt={articleExcerpt}
        purpose="inline"
        onComplete={handleGenerate}
      />
    </>
  );
}
