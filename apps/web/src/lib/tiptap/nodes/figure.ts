/**
 * Figure node for the Tiptap editor.
 *
 * A block-level node that renders as:
 *
 *   <figure>
 *     <img src="..." alt="..." width="..." height="..." />
 *     <figcaption>...</figcaption>
 *   </figure>
 *
 * The figcaption content is editable inline (ProseMirror content hole).
 * The alt attribute is exposed via a `setFigureAlt` command so toolbars can
 * surface it.
 *
 * Replaces `@tiptap/extension-image` so that alt and caption round-trip
 * through HTML without data loss.
 */

import { Node, mergeAttributes } from "@tiptap/core";

export interface FigureOptions {
  /** Extra HTML attributes to merge onto the outer <figure> element. */
  HTMLAttributes: Record<string, string>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    figure: {
      /**
       * Insert a figure with an image at the current selection.
       */
      insertFigure: (attrs: {
        src: string;
        alt?: string;
        caption?: string;
        width?: number;
        height?: number;
      }) => ReturnType;
      /** Update the alt text of the currently selected figure. */
      setFigureAlt: (alt: string) => ReturnType;
    };
  }
}

export const Figure = Node.create<FigureOptions>({
  name: "figure",

  group: "block",

  content: "inline*",

  draggable: true,

  isolating: true,

  defining: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      src: {
        default: "",
        parseHTML: (el) => el.querySelector("img")?.getAttribute("src") ?? "",
      },
      alt: {
        default: "",
        parseHTML: (el) => el.querySelector("img")?.getAttribute("alt") ?? "",
      },
      width: {
        default: null,
        parseHTML: (el) => {
          const raw = el.querySelector("img")?.getAttribute("width");
          const parsed = raw ? parseInt(raw, 10) : NaN;
          return Number.isFinite(parsed) ? parsed : null;
        },
      },
      height: {
        default: null,
        parseHTML: (el) => {
          const raw = el.querySelector("img")?.getAttribute("height");
          const parsed = raw ? parseInt(raw, 10) : NaN;
          return Number.isFinite(parsed) ? parsed : null;
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        // Full <figure><img><figcaption></figcaption></figure>. The base
        // @tiptap/extension-image still handles bare <img> tags as inline
        // nodes, so legacy HTML without figures keeps working.
        tag: "figure",
        contentElement: (node) => {
          const el = node as HTMLElement;
          const caption = el.querySelector("figcaption");
          if (caption) return caption;
          return el.ownerDocument.createElement("figcaption");
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    const { src, alt, width, height } = node.attrs as {
      src: string;
      alt: string;
      width: number | null;
      height: number | null;
    };
    const imgAttrs: Record<string, string> = { src, alt };
    if (width) imgAttrs.width = String(width);
    if (height) imgAttrs.height = String(height);
    return [
      "figure",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      ["img", imgAttrs],
      ["figcaption", {}, 0],
    ];
  },

  addCommands() {
    return {
      insertFigure:
        (attrs) =>
        ({ chain }) => {
          const caption = attrs.caption ?? "";
          return chain()
            .focus()
            .insertContent({
              type: this.name,
              attrs: {
                src: attrs.src,
                alt: attrs.alt ?? "",
                width: attrs.width ?? null,
                height: attrs.height ?? null,
              },
              content: caption
                ? [{ type: "text", text: caption }]
                : [],
            })
            .run();
        },
      setFigureAlt:
        (alt) =>
        ({ commands }) => {
          return commands.updateAttributes(this.name, { alt });
        },
    };
  },
});
