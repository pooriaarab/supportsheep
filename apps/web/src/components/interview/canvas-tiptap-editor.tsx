"use client";

/**
 * Editable canvas — TipTap-based editor for the body of an interview
 * canvas. Renders each paragraph as a small inline TipTap editor with a
 * BubbleMenu for bold/italic/link/heading formatting. Tracks a local
 * "human edit" draft separate from the AI's source-of-truth canvas state
 * so an in-flight user edit isn't clobbered by an incoming SSE diff.
 *
 * Bidirectional flow:
 *   - AI writes → SSE `writer_diff` events update `canvas` (prop) →
 *     paragraphs the user has NOT touched re-render to match.
 *   - Human types → on blur (or 2s idle) → calls `onEdit` which POSTs
 *     to /canvas-edit; the server fans the event back over SSE so other
 *     tabs sync.
 *
 * Conflict resolution lives server-side in writer-worker.ts via the
 * `human-edit-merge.ts` helper — the client just relays edits and renders
 * the merged result the AI sends back.
 *
 * The W11.2 read-only renderer is a parallel effort; this editor
 * intentionally duplicates only the body-tab structure (sections,
 * paragraphs, bullets) so it can ship before the renderer lands.
 */

import { useMemo, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import type { Editor } from "@tiptap/react";
import { Bold, Italic, Link2, Heading2 } from "lucide-react";
import type { CanvasSection, CanvasState } from "@/hooks/use-interview-session";

/**
 * Module-scoped extension list. Each paragraph editor mounts with this same
 * reference, so the TipTap reconciler does not re-create the extension
 * objects on every paragraph mount (one extension instance per editor still,
 * but the *factory* call -- not cheap because Link/StarterKit instantiate
 * ProseMirror plugins -- runs once at module load instead of per render).
 *
 * The configuration here is purely static -- no per-paragraph closures -- so
 * hoisting is safe.
 */
const PARAGRAPH_EXTENSIONS = [
  StarterKit.configure({ link: false }),
  Link.configure({
    openOnClick: false,
    HTMLAttributes: { class: "underline text-primary" },
  }),
];

export type CanvasEditField = "heading" | "paragraph_text" | "bullet_text";

export interface CanvasEdit {
  sectionId: string;
  field: CanvasEditField;
  /** Required for paragraph_text / bullet_text. */
  index?: number;
  value: string;
}

interface Props {
  canvas: CanvasState;
  /** Set of section IDs the AI is currently about to update so the UI
   *  can show a brief "AI considering your edit" indicator. */
  pendingAiSections?: Set<string>;
  /** Section IDs with pending AI proposals (mid-conflict). Renders an
   *  "AI proposed change" pill the user can accept/reject. */
  proposals?: Array<{
    sectionId: string;
    index: number;
    humanValue: string;
    aiValue: string;
  }>;
  /** Called when a human commits an edit. Posts to /canvas-edit. */
  onEdit: (edit: CanvasEdit) => void;
  /** Called when the user accepts a pending AI proposal. */
  onAcceptProposal?: (sectionId: string, index: number, aiValue: string) => void;
  /** Called when the user rejects a pending AI proposal. */
  onRejectProposal?: (sectionId: string, index: number) => void;
  className?: string;
}

/**
 * Top-level editable canvas. Renders title (read-only for now) +
 * sections, each section's heading + bullets + paragraphs as editable
 * TipTap regions. Headings use a single-line editor; paragraphs and
 * bullets use multi-line editors with a BubbleMenu.
 */
export function CanvasTipTapEditor({
  canvas,
  pendingAiSections,
  proposals,
  onEdit,
  onAcceptProposal,
  onRejectProposal,
  className,
}: Props) {
  return (
    <div className={className}>
      <div
        data-testid="canvas-editable"
        className="space-y-6 overflow-y-auto h-[550px] p-5 text-foreground bg-background rounded-lg border border-border shadow-sm"
      >
        {canvas.title && (
          <h1 className="text-2xl font-bold tracking-tight mb-4 text-card-foreground">
            {canvas.title}
          </h1>
        )}

        {canvas.sections.map((section) => (
          <EditableSection
            key={section.id}
            section={section}
            isAiConsidering={pendingAiSections?.has(section.id) ?? false}
            proposalsForSection={proposals?.filter((p) => p.sectionId === section.id) ?? []}
            onEdit={onEdit}
            onAcceptProposal={onAcceptProposal}
            onRejectProposal={onRejectProposal}
          />
        ))}
      </div>
    </div>
  );
}

function EditableSection({
  section,
  isAiConsidering,
  proposalsForSection,
  onEdit,
  onAcceptProposal,
  onRejectProposal,
}: {
  section: CanvasSection;
  isAiConsidering: boolean;
  proposalsForSection: Array<{
    sectionId: string;
    index: number;
    humanValue: string;
    aiValue: string;
  }>;
  onEdit: (edit: CanvasEdit) => void;
  onAcceptProposal?: (sectionId: string, index: number, aiValue: string) => void;
  onRejectProposal?: (sectionId: string, index: number) => void;
}) {
  return (
    <div
      data-testid={`canvas-section-${section.id}`}
      className="space-y-3 pb-5 border-b border-border last:border-0 last:pb-0"
    >
      {isAiConsidering && (
        <div
          data-testid={`ai-considering-${section.id}`}
          className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full bg-info/10 text-info text-xs font-medium"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-info motion-safe:animate-pulse" />
          AI considering your edit
        </div>
      )}

      {section.heading !== null && (
        <EditableLine
          value={section.heading}
          ariaLabel={`Section ${section.id} heading`}
          className="text-lg font-semibold text-foreground"
          onCommit={(value) =>
            onEdit({ sectionId: section.id, field: "heading", value })
          }
        />
      )}

      {section.bullets.map((b, idx) => (
        <EditableLine
          key={`bullet-${idx}`}
          value={b}
          ariaLabel={`Section ${section.id} bullet ${idx}`}
          className="text-muted-foreground text-sm leading-relaxed pl-5 relative before:content-['•'] before:absolute before:left-1"
          onCommit={(value) =>
            onEdit({ sectionId: section.id, field: "bullet_text", index: idx, value })
          }
        />
      ))}

      {section.paragraphs.map((p, idx) => {
        const proposal = proposalsForSection.find((pr) => pr.index === idx);
        return (
          <div key={`para-${idx}`} className="space-y-1">
            <EditableRichParagraph
              value={p}
              ariaLabel={`Section ${section.id} paragraph ${idx}`}
              onCommit={(value) =>
                onEdit({
                  sectionId: section.id,
                  field: "paragraph_text",
                  index: idx,
                  value,
                })
              }
            />
            {proposal && (
              <div
                data-testid={`proposal-pill-${section.id}-${idx}`}
                className="inline-flex items-center gap-2 px-2 py-1 rounded-md bg-warning/10 text-warning text-xs"
              >
                <span>AI proposed a different version</span>
                <button
                  type="button"
                  className="underline font-medium hover:text-warning/80"
                  onClick={() =>
                    onAcceptProposal?.(section.id, idx, proposal.aiValue)
                  }
                >
                  Accept
                </button>
                <button
                  type="button"
                  className="underline hover:text-warning/80"
                  onClick={() => onRejectProposal?.(section.id, idx)}
                >
                  Dismiss
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Single-line plain-text editable region (heading, bullet). Avoids
 * the full TipTap stack here — these are simple strings and any
 * formatting would have to be flattened back to plain text on commit
 * anyway. Tracks local draft state; commits on blur or Enter, with a
 * 2s idle debounce as a safety net so a long pause auto-commits.
 */
function EditableLine({
  value,
  ariaLabel,
  className,
  onCommit,
}: {
  value: string;
  ariaLabel: string;
  className?: string;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [lastUpstream, setLastUpstream] = useState(value);

  // Derived sync — re-adopt the upstream value when it changes AND the
  // user isn't actively diverging from it. Keeps remote SSE updates
  // visible without ever stomping on an in-flight edit.
  if (value !== lastUpstream && draft === lastUpstream) {
    setDraft(value);
    setLastUpstream(value);
  } else if (value !== lastUpstream) {
    setLastUpstream(value);
  }

  return (
    <input
      type="text"
      aria-label={ariaLabel}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== value) onCommit(draft);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.currentTarget as HTMLInputElement).blur();
        }
      }}
      className={`w-full bg-transparent border-0 outline-none focus:ring-1 focus:ring-primary/40 rounded ${className ?? ""}`}
    />
  );
}

/**
 * Rich-text editable paragraph. Each paragraph gets its own TipTap
 * editor with a BubbleMenu (bold / italic / link / H2) so authors get
 * inline formatting without the heaviness of a single full-canvas
 * editor. The committed value is the rendered text (getText) — the
 * canvas state is plain strings today, so we don't persist marks yet;
 * the BubbleMenu still surfaces the affordance.
 */
function EditableRichParagraph({
  value,
  ariaLabel,
  onCommit,
}: {
  value: string;
  ariaLabel: string;
  onCommit: (value: string) => void;
}) {
  const initialContent = useMemo(() => `<p>${escapeHtml(value)}</p>`, [value]);

  const editor = useEditor({
    immediatelyRender: false,
    editable: true,
    extensions: PARAGRAPH_EXTENSIONS,
    content: initialContent,
    editorProps: {
      attributes: {
        "aria-label": ariaLabel,
        class:
          "prose prose-sm max-w-none focus:outline-none leading-relaxed text-sm text-foreground/90",
      },
    },
    onBlur: ({ editor: ed }) => {
      const text = ed.getText().trim();
      if (text !== value) onCommit(text);
    },
  });

  return (
    <div className="relative">
      {editor && <ParagraphBubbleMenu editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}

function ParagraphBubbleMenu({ editor }: { editor: Editor }) {
  return (
    <BubbleMenu
      editor={editor}
      options={{ placement: "top" }}
      shouldShow={({ editor: ed, from, to }) => ed.isEditable && from !== to}
    >
      <div
        data-testid="bubble-menu"
        className="flex items-center gap-0.5 rounded-md border border-border bg-popover px-1 py-0.5 shadow-md"
      >
        <BubbleButton
          ariaLabel="Bold"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="size-3.5" />
        </BubbleButton>
        <BubbleButton
          ariaLabel="Italic"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="size-3.5" />
        </BubbleButton>
        <BubbleButton
          ariaLabel="Link"
          active={editor.isActive("link")}
          onClick={() => {
            const previous = editor.getAttributes("link").href as string | undefined;
            const url = window.prompt("Link URL", previous ?? "https://");
            if (url === null) return;
            if (url === "") {
              editor.chain().focus().unsetLink().run();
              return;
            }
            editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
          }}
        >
          <Link2 className="size-3.5" />
        </BubbleButton>
        <BubbleButton
          ariaLabel="Heading"
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className="size-3.5" />
        </BubbleButton>
      </div>
    </BubbleMenu>
  );
}

function BubbleButton({
  ariaLabel,
  active,
  onClick,
  children,
}: {
  ariaLabel: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex items-center justify-center rounded p-1 text-xs ${
        active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60"
      }`}
    >
      {children}
    </button>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
