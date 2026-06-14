/**
 * Generic Embed node for the TipTap editor.
 *
 * Renders as `<div class="embed embed--{kind}" data-embed-kind="{kind}" data-embed-src="{src}">…</div>`
 * containing a sandboxed `<iframe>`. A single generic node with a `kind`
 * discriminator (`youtube` / `tweet` / `iframe` / `codepen` / `gist` /
 * `loom`) keeps the TipTap surface small while still allowing the
 * realtime tools to differentiate behaviour per provider — the catalog
 * doc (`docs/plans/2026-05-21-realtime-tool-catalog-design.md`) flagged
 * 5 missing ProseMirror node defs and this is the compact alternative
 * to shipping 5 separate nodes.
 *
 * The native `@tiptap/extension-youtube` extension already ships with
 * the editor for its first-class authoring UX; this generic Embed node
 * exists to round-trip the **other** embed kinds (tweet, iframe,
 * codepen, gist, loom) without losing the discriminator. YouTube
 * embeds also flow through Embed when emitted by the realtime tool
 * path so the canvas can be uniformly serialized.
 *
 * Security: the rendered iframe carries `sandbox="allow-scripts
 * allow-same-origin"` and `referrerpolicy="no-referrer"` so the embed
 * cannot navigate the host page, open popups, submit forms, or leak
 * the parent's URL. The validation lives in the tool layer
 * (`apps/web/src/lib/interviews/tools/embeds/*`) where `src` is checked
 * against per-kind allowlists before this node is ever constructed.
 */

import { Node, mergeAttributes } from "@tiptap/core";

export type EmbedKind =
  | "youtube"
  | "tweet"
  | "iframe"
  | "codepen"
  | "gist"
  | "loom";

export const EMBED_KINDS: readonly EmbedKind[] = [
  "youtube",
  "tweet",
  "iframe",
  "codepen",
  "gist",
  "loom",
] as const;

export interface EmbedOptions {
  /** Extra HTML attributes merged into the rendered outer `<div>`. */
  HTMLAttributes: Record<string, unknown>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    embed: {
      /**
       * Insert an embed of the given kind. The host page must validate
       * `src` against the per-kind allowlist before calling this
       * command — this node performs no URL validation of its own.
       */
      insertEmbed: (attrs: {
        kind: EmbedKind;
        src: string;
        height?: number | null;
      }) => ReturnType;
    };
  }
}

function isEmbedKind(value: unknown): value is EmbedKind {
  return (
    typeof value === "string" &&
    (EMBED_KINDS as readonly string[]).includes(value)
  );
}

export const Embed = Node.create<EmbedOptions>({
  name: "embed",

  group: "block",

  atom: true,

  draggable: true,

  selectable: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      kind: {
        default: "iframe" as EmbedKind,
        parseHTML: (el) => {
          const value = el.getAttribute("data-embed-kind");
          return isEmbedKind(value) ? value : "iframe";
        },
        renderHTML: (attributes) => {
          const kind = isEmbedKind(attributes.kind) ? attributes.kind : "iframe";
          return { "data-embed-kind": kind };
        },
      },
      src: {
        default: "",
        parseHTML: (el) =>
          el.getAttribute("data-embed-src") ??
          el.querySelector("iframe")?.getAttribute("src") ??
          "",
        renderHTML: (attributes) => {
          const src = typeof attributes.src === "string" ? attributes.src : "";
          return { "data-embed-src": src };
        },
      },
      height: {
        default: null,
        parseHTML: (el) => {
          const raw =
            el.getAttribute("data-embed-height") ??
            el.querySelector("iframe")?.getAttribute("height");
          const parsed = raw ? parseInt(raw, 10) : NaN;
          return Number.isFinite(parsed) ? parsed : null;
        },
        renderHTML: (attributes) => {
          const height = attributes.height;
          if (typeof height === "number" && Number.isFinite(height)) {
            return { "data-embed-height": String(height) };
          }
          return {};
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-embed-kind]",
        getAttrs: (node) => {
          if (!(node instanceof HTMLElement)) return false;
          const kind = node.getAttribute("data-embed-kind");
          if (!isEmbedKind(kind)) return false;
          return {
            kind,
            src:
              node.getAttribute("data-embed-src") ??
              node.querySelector("iframe")?.getAttribute("src") ??
              "",
          };
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const kind = isEmbedKind(node.attrs.kind) ? node.attrs.kind : "iframe";
    const src =
      typeof node.attrs.src === "string" ? node.attrs.src : "";
    const height =
      typeof node.attrs.height === "number" && Number.isFinite(node.attrs.height)
        ? node.attrs.height
        : null;
    const iframeAttrs: Record<string, string> = {
      src,
      sandbox: "allow-scripts allow-same-origin",
      referrerpolicy: "no-referrer",
      loading: "lazy",
      title: `${kind} embed`,
    };
    if (height !== null) iframeAttrs.height = String(height);
    return [
      "div",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: `embed embed--${kind}`,
      }),
      ["iframe", iframeAttrs],
    ];
  },

  addCommands() {
    return {
      insertEmbed:
        (attrs) =>
        ({ chain }) =>
          chain()
            .focus()
            .insertContent({
              type: this.name,
              attrs: {
                kind: attrs.kind,
                src: attrs.src,
                height: attrs.height ?? null,
              },
            })
            .run(),
    };
  },
});
