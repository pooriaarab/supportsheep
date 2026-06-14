/**
 * Tiptap editor extensions configuration.
 *
 * Mirrors the admin editor setup: StarterKit + rich formatting extensions
 * (tables, task lists, highlights, typography, code blocks, text alignment).
 *
 * Slash commands are provided as a separate ProseMirror plugin via slash-commands.ts.
 */

import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { Figure } from "./nodes/figure";
import { AIImageBlock } from "./nodes/ai-image-block";
import Highlight from "@tiptap/extension-highlight";
import Typography from "@tiptap/extension-typography";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Youtube from "@tiptap/extension-youtube";
import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";
import { Callout } from "./nodes/callout";
import { Embed } from "./nodes/embed";
import { Faq, FaqItem, FaqQuestion, FaqAnswer } from "./nodes/faq";
import {
  HowTo,
  HowToStep,
  HowToStepName,
  HowToStepContent,
} from "./nodes/howto";
import { lowlight } from "./lowlight";
import { SlashCommands, type SlashCommandsOptions } from "./slash-commands";

export interface EditorExtensionsOptions {
  /** Placeholder text shown when the editor is empty */
  placeholder?: string;
  /** Slash command menu options */
  slashCommands?: SlashCommandsOptions;
}

/**
 * Returns the standard set of Tiptap extensions for the rich text editor.
 *
 * Includes: StarterKit (bold, italic, strike, code, headings, lists, blockquote, hr),
 * plus: task lists, images, links, highlights, typography, underline, text alignment,
 * tables, subscript, superscript, text style, color, syntax-highlighted code blocks,
 * and slash commands.
 */
export function getEditorExtensions(options?: EditorExtensionsOptions) {
  return [
    StarterKit.configure({
      codeBlock: false,
      link: false, // Configured separately with custom options
      underline: false, // Configured separately
    }),
    CodeBlockLowlight.configure({
      lowlight,
      defaultLanguage: null,
      HTMLAttributes: { class: "hljs" },
    }),
    Placeholder.configure({
      placeholder:
        options?.placeholder ?? 'Start writing or type "/" for commands...',
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    // Keep the base Image extension for inline images pasted or set via commands
    // (e.g., dragging into a paragraph). The Figure node takes precedence for
    // new block-level image insertions and preserves alt + caption round-trip.
    Image.configure({ inline: true }),
    Figure.configure({
      HTMLAttributes: { class: "my-6" },
    }),
    Link.configure({
      openOnClick: false,
      protocols: ["http", "https", "mailto"],
      validate: (url: string) => /^(https?:\/\/|mailto:)/.test(url),
      HTMLAttributes: { class: "text-primary underline cursor-pointer" },
    }),
    Highlight.configure({ multicolor: true }),
    Typography,
    Underline,
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    Table.configure({ resizable: true }),
    TableRow,
    TableCell,
    TableHeader,
    Subscript,
    Superscript,
    TextStyle,
    Color,
    Youtube.configure({
      // Responsive 16:9 embed; the extension wraps the iframe in a
      // div[data-youtube-video] whose aspect ratio is enforced via globals.css.
      // `modestBranding` was removed from the YouTube IFrame API in Jan 2023,
      // so we intentionally omit it here.
      nocookie: true,
      controls: true,
      HTMLAttributes: { class: "youtube-embed-iframe" },
    }),
    Callout,
    Embed,
    Faq,
    FaqItem,
    FaqQuestion,
    FaqAnswer,
    HowTo,
    HowToStep,
    HowToStepName,
    HowToStepContent,
    AIImageBlock,
    SlashCommands.configure({
      onStateChange: options?.slashCommands?.onStateChange,
    }),
  ];
}
