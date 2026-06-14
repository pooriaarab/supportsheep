/**
 * Callout block node for the TipTap editor.
 *
 * Renders as `<aside class="callout callout--{variant}" data-variant="{variant}">…</aside>`
 * so the public article renderer (which outputs raw HTML via `dangerouslySetInnerHTML`)
 * can style each variant without JavaScript.
 *
 * Supports four visual treatments used for featured-snippet / AEO emphasis:
 *  - `tip`     — positive guidance (success tone)
 *  - `warning` — caution (warning tone)
 *  - `note`    — neutral callout (muted tone)
 *  - `info`    — informational (info tone)
 *
 * The node has block-level `content: "block+"`, so nested paragraphs, lists, and
 * other block content are allowed inside. The variant is stored as a node attribute.
 */

import { Node, mergeAttributes } from "@tiptap/core";

export type CalloutVariant = "tip" | "warning" | "note" | "info";

export const CALLOUT_VARIANTS: readonly CalloutVariant[] = [
  "tip",
  "warning",
  "note",
  "info",
] as const;

export interface CalloutOptions {
  /** Extra HTML attributes merged into the rendered `<aside>`. */
  HTMLAttributes: Record<string, unknown>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    callout: {
      /** Wrap the current block in a callout of the given variant. */
      setCallout: (variant: CalloutVariant) => ReturnType;
      /** Toggle a callout of the given variant on the current block. */
      toggleCallout: (variant: CalloutVariant) => ReturnType;
      /** Lift the current selection out of its containing callout. */
      unsetCallout: () => ReturnType;
    };
  }
}

function isCalloutVariant(value: unknown): value is CalloutVariant {
  return (
    typeof value === "string" &&
    (CALLOUT_VARIANTS as readonly string[]).includes(value)
  );
}

export const Callout = Node.create<CalloutOptions>({
  name: "callout",

  group: "block",

  content: "block+",

  defining: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      variant: {
        default: "note" as CalloutVariant,
        parseHTML: (element) => {
          const value = element.getAttribute("data-variant");
          return isCalloutVariant(value) ? value : "note";
        },
        renderHTML: (attributes) => {
          const variant = isCalloutVariant(attributes.variant)
            ? attributes.variant
            : "note";
          return { "data-variant": variant };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "aside.callout",
        getAttrs: (node) => {
          if (!(node instanceof HTMLElement)) return false;
          const variant = node.getAttribute("data-variant");
          return { variant: isCalloutVariant(variant) ? variant : "note" };
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const variant = isCalloutVariant(node.attrs.variant)
      ? node.attrs.variant
      : "note";
    return [
      "aside",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: `callout callout--${variant}`,
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setCallout:
        (variant) =>
        ({ commands }) =>
          commands.wrapIn(this.name, { variant }),
      toggleCallout:
        (variant) =>
        ({ commands }) =>
          commands.toggleWrap(this.name, { variant }),
      unsetCallout:
        () =>
        ({ commands }) =>
          commands.lift(this.name),
    };
  },
});
