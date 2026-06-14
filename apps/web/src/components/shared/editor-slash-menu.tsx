"use client";

/**
 * Slash Command Menu — floating menu for the Tiptap editor.
 *
 * Renders a positioned menu of block-type commands when the slash command
 * ProseMirror plugin is active. Supports keyboard navigation (ArrowUp/Down/Enter)
 * and mouse selection.
 *
 * Adapted for Supportsheep from an admin slash-command-menu pattern.
 */

import { useMemo, useRef, useState, useCallback } from "react";
import type { Editor } from "@tiptap/react";
import {
  type SlashCommandState,
  slashCommandPluginKey,
} from "@/lib/tiptap/slash-commands";
import { useLatestRef } from "@/hooks/use-latest-ref";
import { useMountEffect } from "@/hooks/use-mount-effect";
import { insertImageViaUpload } from "@/lib/tiptap/image-upload";
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListChecks,
  Code,
  Table,
  Quote,
  Minus,
  Youtube,
  Lightbulb,
  AlertTriangle,
  StickyNote,
  Info,
  HelpCircle,
  ImageIcon,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

interface SlashCommandItem {
  label: string;
  description: string;
  icon: LucideIcon;
  keywords: string[];
  command: (ctx: { editor: Editor }) => void;
}

const STATIC_SLASH_COMMANDS: Omit<SlashCommandItem, never>[] = [
  {
    label: "Heading 1",
    description: "Large section heading",
    icon: Heading1,
    keywords: ["h1", "heading", "title", "large"],
    command: ({ editor }) => {
      editor.chain().focus().toggleHeading({ level: 1 }).run();
    },
  },
  {
    label: "Heading 2",
    description: "Medium section heading",
    icon: Heading2,
    keywords: ["h2", "heading", "subtitle", "medium"],
    command: ({ editor }) => {
      editor.chain().focus().toggleHeading({ level: 2 }).run();
    },
  },
  {
    label: "Heading 3",
    description: "Small section heading",
    icon: Heading3,
    keywords: ["h3", "heading", "small"],
    command: ({ editor }) => {
      editor.chain().focus().toggleHeading({ level: 3 }).run();
    },
  },
  {
    label: "Bullet List",
    description: "Unordered list",
    icon: List,
    keywords: ["bullet", "unordered", "list", "ul"],
    command: ({ editor }) => {
      editor.chain().focus().toggleBulletList().run();
    },
  },
  {
    label: "Ordered List",
    description: "Numbered list",
    icon: ListOrdered,
    keywords: ["ordered", "numbered", "list", "ol"],
    command: ({ editor }) => {
      editor.chain().focus().toggleOrderedList().run();
    },
  },
  {
    label: "Task List",
    description: "Checklist with checkboxes",
    icon: ListChecks,
    keywords: ["task", "todo", "checklist", "checkbox"],
    command: ({ editor }) => {
      editor.chain().focus().toggleTaskList().run();
    },
  },
  {
    label: "Code Block",
    description: "Syntax-highlighted code",
    icon: Code,
    keywords: ["code", "pre", "syntax", "block"],
    command: ({ editor }) => {
      editor.chain().focus().toggleCodeBlock().run();
    },
  },
  {
    label: "Table",
    description: "3x3 table with header row",
    icon: Table,
    keywords: ["table", "grid", "rows", "columns"],
    command: ({ editor }) => {
      editor
        .chain()
        .focus()
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run();
    },
  },
  {
    label: "Image",
    description: "Upload an image with caption",
    icon: ImageIcon,
    keywords: ["image", "img", "photo", "picture", "figure", "upload"],
    command: ({ editor }) => {
      insertImageViaUpload(editor);
    },
  },
  {
    label: "Blockquote",
    description: "Quoted text block",
    icon: Quote,
    keywords: ["blockquote", "quote", "citation"],
    command: ({ editor }) => {
      editor.chain().focus().toggleBlockquote().run();
    },
  },
  {
    label: "Horizontal Rule",
    description: "Visual divider line",
    icon: Minus,
    keywords: ["horizontal", "rule", "divider", "hr", "line"],
    command: ({ editor }) => {
      editor.chain().focus().setHorizontalRule().run();
    },
  },
  {
    label: "YouTube",
    description: "Embed a YouTube video",
    icon: Youtube,
    keywords: ["youtube", "video", "embed", "yt"],
    command: ({ editor }) => {
      const raw = window.prompt("YouTube URL");
      if (!raw) return;
      const trimmed = raw.trim();
      if (!trimmed) return;
      const inserted = editor
        .chain()
        .focus()
        .setYoutubeVideo({ src: trimmed })
        .run();
      if (!inserted) {
        window.alert(
          "Please provide a valid YouTube URL (youtube.com or youtu.be).",
        );
      }
    },
  },
  {
    label: "Tip Callout",
    description: "Highlighted tip or recommendation",
    icon: Lightbulb,
    keywords: ["tip", "callout", "recommend", "advice", "aside"],
    command: ({ editor }) => {
      editor.chain().focus().setCallout("tip").run();
    },
  },
  {
    label: "Warning Callout",
    description: "Cautionary callout",
    icon: AlertTriangle,
    keywords: ["warning", "caution", "alert", "callout", "aside"],
    command: ({ editor }) => {
      editor.chain().focus().setCallout("warning").run();
    },
  },
  {
    label: "Note Callout",
    description: "Neutral callout for asides",
    icon: StickyNote,
    keywords: ["note", "callout", "aside", "sidenote"],
    command: ({ editor }) => {
      editor.chain().focus().setCallout("note").run();
    },
  },
  {
    label: "Info Callout",
    description: "Informational callout",
    icon: Info,
    keywords: ["info", "information", "callout", "aside"],
    command: ({ editor }) => {
      editor.chain().focus().setCallout("info").run();
    },
  },
  {
    label: "FAQ",
    description: "Question & answer block (FAQPage JSON-LD)",
    icon: HelpCircle,
    keywords: ["faq", "question", "answer", "q&a", "qa", "schema", "aeo"],
    command: ({ editor }) => {
      editor.chain().focus().insertFaq().run();
    },
  },
  {
    label: "HowTo",
    description: "Step-by-step guide (HowTo JSON-LD)",
    icon: ListOrdered,
    keywords: [
      "howto",
      "how-to",
      "how to",
      "steps",
      "guide",
      "tutorial",
      "schema",
      "aeo",
    ],
    command: ({ editor }) => {
      editor.chain().focus().setHowTo().run();
    },
  },
];

function buildSlashCommands(
  articleTitle?: string,
  articleExcerpt?: string,
): SlashCommandItem[] {
  const generateImageCommand: SlashCommandItem = {
    label: "Generate Image",
    description: "Generate an image with AI",
    icon: Sparkles,
    keywords: ["ai", "generate", "image", "sparkles", "gpt"],
    command: ({ editor }) => {
      editor
        .chain()
        .focus()
        .insertContent({
          type: "aiImageBlock",
          attrs: { articleTitle: articleTitle ?? null, articleExcerpt: articleExcerpt ?? null },
        })
        .run();
    },
  };

  // Insert "Generate Image" after the "Image" upload command (index 8)
  return [
    ...STATIC_SLASH_COMMANDS.slice(0, 9),
    generateImageCommand,
    ...STATIC_SLASH_COMMANDS.slice(9),
  ];
}

function filterItems(
  query: string,
  commands: SlashCommandItem[],
): SlashCommandItem[] {
  if (!query) return commands;

  const lower = query.toLowerCase();
  return commands.filter(
    (item) =>
      item.label.toLowerCase().includes(lower) ||
      item.keywords.some((kw) => kw.includes(lower)),
  );
}

interface EditorSlashMenuProps {
  editor: Editor | null;
  state: SlashCommandState;
  articleTitle?: string;
  articleExcerpt?: string;
}

export function EditorSlashMenu({ editor, state, articleTitle, articleExcerpt }: EditorSlashMenuProps) {
  const [selection, setSelection] = useState({ query: "", index: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const allCommands = useMemo(
    () => buildSlashCommands(articleTitle, articleExcerpt),
    [articleTitle, articleExcerpt],
  );
  const items = filterItems(state.query, allCommands);

  const selectedIndex = selection.query === state.query ? selection.index : 0;

  const setSelectedIndex = useCallback(
    (indexOrFn: number | ((prev: number) => number)) => {
      setSelection((prev) => {
        const newIndex =
          typeof indexOrFn === "function" ? indexOrFn(prev.index) : indexOrFn;
        return { query: state.query, index: newIndex };
      });
    },
    [state.query],
  );

  // Execute the selected command
  const executeItem = useCallback(
    (item: SlashCommandItem) => {
      if (!editor) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const exec = (editor as any)._slashCommandExecute;

      if (exec) {
        exec(
          editor.view,
          state.slashPos,
          editor.state.selection.from,
          item.command,
        );
      }
    },
    [editor, state.slashPos],
  );

  // Bundle the dynamic values the listeners need into refs so the listeners
  // can be installed once on mount instead of re-binding on every render.
  // This avoids attaching/detaching DOM listeners on each items/selection
  // update — important because the slash menu re-renders on every keystroke.
  const activeRef = useLatestRef(state.active);
  const editorRef = useLatestRef(editor);
  const itemsRef = useLatestRef(items);
  const selectedIndexRef = useLatestRef(selectedIndex);
  const executeItemRef = useLatestRef(executeItem);
  const setSelectedIndexRef = useLatestRef(setSelectedIndex);

  // Listen for keyboard events dispatched by the ProseMirror plugin.
  // Mount-only so the listener identity stays stable across renders.
  useMountEffect(() => {
    const handleKeyDown = (e: Event) => {
      if (!activeRef.current) return;
      const detail = (e as CustomEvent<{ key: string }>).detail;
      if (!detail) return;

      const len = itemsRef.current.length;
      if (detail.key === "ArrowDown") {
        setSelectedIndexRef.current((prev) => (prev + 1) % Math.max(1, len));
      } else if (detail.key === "ArrowUp") {
        setSelectedIndexRef.current(
          (prev) => (prev - 1 + Math.max(1, len)) % Math.max(1, len),
        );
      } else if (detail.key === "Enter") {
        const item = itemsRef.current[selectedIndexRef.current];
        if (item) executeItemRef.current(item);
      }
    };

    document.addEventListener("slash-command-keydown", handleKeyDown);
    return () =>
      document.removeEventListener("slash-command-keydown", handleKeyDown);
  });

  // Scroll the freshly selected item into view via a ref callback. This
  // replaces a reactive useEffect on [selectedIndex] — the DOM side-effect
  // runs only when the selected button identity changes.
  const setSelectedButtonRef = useCallback((node: HTMLButtonElement | null) => {
    node?.scrollIntoView({ block: "nearest" });
  }, []);

  // Close on click outside. Mount-only listener that reads the latest
  // active/editor via refs and is a no-op when the menu is inactive.
  useMountEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const ed = editorRef.current;
      if (!activeRef.current || !ed) return;
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        ed.view.dispatch(
          ed.state.tr.setMeta(slashCommandPluginKey, {
            active: false,
            query: "",
            slashPos: 0,
            coords: null,
          }),
        );
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  });

  if (!state.active || !state.coords || items.length === 0) return null;

  const style: React.CSSProperties = {
    position: "fixed",
    top: state.coords.top + 4,
    left: state.coords.left,
    zIndex: 50,
  };

  return (
    <div
      ref={menuRef}
      style={style}
      className="w-64 max-h-72 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg"
    >
      <div className="p-1">
        {items.map((item, index) => {
          const Icon = item.icon;
          const isSelected = index === selectedIndex;

          return (
            <button
              key={item.label}
              ref={isSelected ? setSelectedButtonRef : undefined}
              data-selected={isSelected}
              className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors ${
                isSelected
                  ? "bg-accent text-accent-foreground"
                  : "text-foreground hover:bg-accent/50"
              }`}
              onClick={() => executeItem(item)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-background">
                <Icon className="size-3.5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <div className="truncate font-medium text-xs">{item.label}</div>
                <div className="truncate text-[10px] text-muted-foreground">
                  {item.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
