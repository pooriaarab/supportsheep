"use client";

/**
 * Editor Toolbar — floating/sticky toolbar for the Tiptap rich text editor.
 *
 * Shows undo/redo always. Shows formatting actions (bold, italic, headings,
 * lists, etc.) when text is selected. Word count is shown at the right edge.
 *
 * Adapted for Supportsheep from an admin editor-toolbar pattern.
 */

import { useState, useEffect } from "react";
import type { Editor } from "@tiptap/react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Highlighter,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  Minus,
  Link,
  Table,
  ImageIcon,
  Undo2,
  Redo2,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from "lucide-react";
import { insertImageViaUpload } from "@/lib/tiptap/image-upload";
import { Button } from "@repo/ui/primitives/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@repo/ui/primitives/tooltip";
import { Separator } from "@repo/ui/primitives/separator";
import { cn } from "@/lib/utils";

interface EditorToolbarProps {
  editor: Editor | null;
}

interface ToolbarAction {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  action: (editor: Editor) => void;
  isActive?: (editor: Editor) => boolean;
  isDisabled?: (editor: Editor) => boolean;
}

function ToolbarButton({
  icon: Icon,
  label,
  active,
  disabled,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn("size-7 p-0", active && "bg-muted")}
          disabled={disabled}
          onClick={onClick}
          aria-label={label}
        >
          <Icon className="size-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

function ToolbarButtonGroup({
  actions,
  editor,
}: {
  actions: ToolbarAction[];
  editor: Editor;
}) {
  return actions.map((item) => (
    <ToolbarButton
      key={item.label}
      icon={item.icon}
      label={item.label}
      active={item.isActive?.(editor)}
      disabled={item.isDisabled?.(editor)}
      onClick={() => item.action(editor)}
    />
  ));
}

const undoRedoActions: ToolbarAction[] = [
  {
    icon: Undo2,
    label: "Undo",
    action: (e) => e.chain().focus().undo().run(),
    isDisabled: (e) => {
      const can = e.can();
      return typeof can.undo !== "function" || !can.undo();
    },
  },
  {
    icon: Redo2,
    label: "Redo",
    action: (e) => e.chain().focus().redo().run(),
    isDisabled: (e) => {
      const can = e.can();
      return typeof can.redo !== "function" || !can.redo();
    },
  },
];

const insertActions: ToolbarAction[] = [
  {
    icon: ImageIcon,
    label: "Insert Image",
    action: (e) => insertImageViaUpload(e),
  },
];

const textFormattingActions: ToolbarAction[] = [
  {
    icon: Bold,
    label: "Bold",
    action: (e) => e.chain().focus().toggleBold().run(),
    isActive: (e) => e.isActive("bold"),
  },
  {
    icon: Italic,
    label: "Italic",
    action: (e) => e.chain().focus().toggleItalic().run(),
    isActive: (e) => e.isActive("italic"),
  },
  {
    icon: Underline,
    label: "Underline",
    action: (e) => e.chain().focus().toggleUnderline().run(),
    isActive: (e) => e.isActive("underline"),
  },
  {
    icon: Strikethrough,
    label: "Strikethrough",
    action: (e) => e.chain().focus().toggleStrike().run(),
    isActive: (e) => e.isActive("strike"),
  },
  {
    icon: Code,
    label: "Code",
    action: (e) => e.chain().focus().toggleCode().run(),
    isActive: (e) => e.isActive("code"),
  },
  {
    icon: Highlighter,
    label: "Highlight",
    action: (e) => e.chain().focus().toggleHighlight().run(),
    isActive: (e) => e.isActive("highlight"),
  },
];

const headingActions: ToolbarAction[] = [
  {
    icon: Heading1,
    label: "Heading 1",
    action: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(),
    isActive: (e) => e.isActive("heading", { level: 1 }),
  },
  {
    icon: Heading2,
    label: "Heading 2",
    action: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
    isActive: (e) => e.isActive("heading", { level: 2 }),
  },
  {
    icon: Heading3,
    label: "Heading 3",
    action: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
    isActive: (e) => e.isActive("heading", { level: 3 }),
  },
];

const listActions: ToolbarAction[] = [
  {
    icon: List,
    label: "Bullet List",
    action: (e) => e.chain().focus().toggleBulletList().run(),
    isActive: (e) => e.isActive("bulletList"),
  },
  {
    icon: ListOrdered,
    label: "Ordered List",
    action: (e) => e.chain().focus().toggleOrderedList().run(),
    isActive: (e) => e.isActive("orderedList"),
  },
  {
    icon: ListChecks,
    label: "Task List",
    action: (e) => e.chain().focus().toggleTaskList().run(),
    isActive: (e) => e.isActive("taskList"),
  },
];

const blockActions: ToolbarAction[] = [
  {
    icon: Quote,
    label: "Blockquote",
    action: (e) => e.chain().focus().toggleBlockquote().run(),
    isActive: (e) => e.isActive("blockquote"),
  },
  {
    icon: Minus,
    label: "Horizontal Rule",
    action: (e) => e.chain().focus().setHorizontalRule().run(),
  },
  {
    icon: Link,
    label: "Link",
    action: (e) => {
      if (e.isActive("link")) {
        e.chain().focus().unsetLink().run();
        return;
      }
      const raw = window.prompt("Enter URL");
      if (raw) {
        let validUrl: string | null = null;
        try {
          const parsed = new URL(raw);
          if (["http:", "https:", "mailto:"].includes(parsed.protocol)) {
            validUrl = parsed.href;
          }
        } catch {
          try {
            const parsed = new URL(`https://${raw}`);
            validUrl = parsed.href;
          } catch {
            // invalid URL
          }
        }
        if (validUrl) {
          e.chain().focus().setLink({ href: validUrl }).run();
        }
      }
    },
    isActive: (e) => e.isActive("link"),
  },
  {
    icon: Table,
    label: "Table",
    action: (e) => {
      if (e.isActive("table")) {
        e.chain().focus().deleteTable().run();
      } else {
        e.chain()
          .focus()
          .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
          .run();
      }
    },
    isActive: (e) => e.isActive("table"),
  },
];

const alignmentActions: ToolbarAction[] = [
  {
    icon: AlignLeft,
    label: "Align Left",
    action: (e) => e.chain().focus().setTextAlign("left").run(),
    isActive: (e) => e.isActive({ textAlign: "left" }),
  },
  {
    icon: AlignCenter,
    label: "Align Center",
    action: (e) => e.chain().focus().setTextAlign("center").run(),
    isActive: (e) => e.isActive({ textAlign: "center" }),
  },
  {
    icon: AlignRight,
    label: "Align Right",
    action: (e) => e.chain().focus().setTextAlign("right").run(),
    isActive: (e) => e.isActive({ textAlign: "right" }),
  },
];

export function EditorToolbar({ editor }: EditorToolbarProps) {
  const [hasSelection, setHasSelection] = useState(false);

  // eslint-disable-next-line no-restricted-syntax
  useEffect(() => {
    if (!editor) return;

    const handleSelectionUpdate = () => {
      const { empty } = editor.state.selection;
      setHasSelection(!empty);
    };

    editor.on("selectionUpdate", handleSelectionUpdate);
    return () => {
      editor.off("selectionUpdate", handleSelectionUpdate);
    };
  }, [editor]);


  if (!editor) return null;

  return (
    <div className="flex items-center gap-0.5 overflow-x-auto border-b border-border px-2 py-1">
      {/* Always visible: undo/redo */}
      <div className="flex items-center gap-0.5">
        <ToolbarButtonGroup actions={undoRedoActions} editor={editor} />
      </div>

      {/* Always visible: insert image */}
      <Separator orientation="vertical" className="mx-1 h-5" />
      <div className="flex items-center gap-0.5">
        <ToolbarButtonGroup actions={insertActions} editor={editor} />
      </div>

      {/* Only visible when text is selected */}
      {hasSelection && (
        <>
          <Separator orientation="vertical" className="mx-1 h-5" />
          <div className="flex items-center gap-0.5">
            <ToolbarButtonGroup actions={textFormattingActions} editor={editor} />
          </div>
          <Separator orientation="vertical" className="mx-1 h-5" />
          <div className="flex items-center gap-0.5">
            <ToolbarButtonGroup actions={headingActions} editor={editor} />
          </div>
          <Separator orientation="vertical" className="mx-1 h-5" />
          <div className="flex items-center gap-0.5">
            <ToolbarButtonGroup actions={listActions} editor={editor} />
          </div>
          <Separator orientation="vertical" className="mx-1 h-5" />
          <div className="flex items-center gap-0.5">
            <ToolbarButtonGroup actions={blockActions} editor={editor} />
          </div>
          <Separator orientation="vertical" className="mx-1 h-5" />
          <div className="flex items-center gap-0.5">
            <ToolbarButtonGroup actions={alignmentActions} editor={editor} />
          </div>
        </>
      )}
    </div>
  );
}
