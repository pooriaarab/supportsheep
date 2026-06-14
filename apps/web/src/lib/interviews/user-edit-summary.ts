/**
 * Summarize a user's canvas edit as a short, human-readable sentence the
 * AI interviewer can consume as a narration cue.
 *
 * The realtime model only ever sees text — dumping raw TipTap JSON or a
 * unified diff would burn tokens and read as noise. Instead, compare a
 * structured snapshot of the canvas (the ProseMirror document JSON)
 * before vs after the user typed, then describe the change in one or two
 * sentences: what node type they added, what text they wrote, and (when
 * small enough to be useful) the new content verbatim so the AI can
 * pick the thread up.
 *
 * Returns `null` when nothing meaningful changed (whitespace-only churn,
 * identical doc structure with identical text) so the caller can skip
 * emitting a cue at all.
 *
 * Why a structural diff (not just `editor.getText()`):
 *   W24.I shipped a plain-text diff that fixed the empty-string cue for
 *   prose-only edits. It still leaves the AI blind to structural-only
 *   mutations — inserting an image, code block, table, callout, embed,
 *   horizontal rule, FAQ block, etc. — because their TipTap nodes carry
 *   no text. From the AI's side, the user "did something" but the cue
 *   evaluated to "" and was suppressed, so the AI could never quote it
 *   back. This module diffs the full ProseMirror doc node-by-node so
 *   every TipTap mutation the user makes surfaces to the realtime model.
 */
import type { JSONContent } from "@tiptap/core";

const MAX_VERBATIM_CHARS = 400;
const MAX_SNIPPET_CHARS = 240;

export interface UserEditSummary {
  /** The sentence handed to `sendNarrationCue` for the realtime model. */
  readonly cueText: string;
  /** Short kind label for logging/dedup ("added" / "removed" / "edited"). */
  readonly kind: "added" | "removed" | "edited";
}

/**
 * Build a narration cue describing the diff between a "before" plain-text
 * snapshot (last AI-synced canvas content) and an "after" snapshot (the
 * current editor text after the user's edit burst). Kept for the text-
 * only fallback path used by callers that don't have ProseMirror JSON
 * available — newer call sites should prefer `summarizeUserEditFromDoc`.
 */
export function summarizeUserEdit(
  before: string,
  after: string,
): UserEditSummary | null {
  const beforeNorm = before.trim().replace(/\s+/g, " ");
  const afterNorm = after.trim().replace(/\s+/g, " ");

  if (beforeNorm === afterNorm) return null;

  const beforeLines = splitLines(before);
  const afterLines = splitLines(after);

  if (afterNorm.startsWith(beforeNorm) && beforeNorm.length > 0) {
    const added = afterNorm.slice(beforeNorm.length).trim();
    if (added.length === 0) return null;
    return {
      kind: "added",
      cueText: buildCue(
        `The user just added new text to the canvas: ${quote(snippet(added, MAX_VERBATIM_CHARS))}`,
      ),
    };
  }

  if (beforeNorm.startsWith(afterNorm) && afterNorm.length > 0) {
    const removed = beforeNorm.slice(afterNorm.length).trim();
    if (removed.length === 0) return null;
    return {
      kind: "removed",
      cueText: buildCue(
        `The user just removed text from the end of the canvas: ${quote(snippet(removed, MAX_SNIPPET_CHARS))}`,
      ),
    };
  }

  if (beforeNorm === "" && afterNorm !== "") {
    return {
      kind: "added",
      cueText: buildCue(
        `The user just wrote on the canvas: ${quote(snippet(afterNorm, MAX_VERBATIM_CHARS))}`,
      ),
    };
  }

  const changedAfter = afterLines.find((line) => !beforeLines.includes(line));
  if (changedAfter && changedAfter.trim().length > 0) {
    return {
      kind: "edited",
      cueText: buildCue(
        `The user just edited the canvas. The changed line now reads: ${quote(snippet(changedAfter, MAX_SNIPPET_CHARS))}`,
      ),
    };
  }

  const tailSnippet = tail(afterNorm, MAX_SNIPPET_CHARS).trim();
  if (tailSnippet.length === 0) return null;
  return {
    kind: "edited",
    cueText: buildCue(
      `The user just edited the canvas. The canvas now ends with: ${quote(snippet(tailSnippet, MAX_SNIPPET_CHARS))}`,
    ),
  };
}

/**
 * Structural variant of `summarizeUserEdit`. Diffs the ProseMirror
 * document JSON before vs after the user's edit and describes the
 * change in terms of TipTap node types — heading, list item, image,
 * figure, code block, table, callout, embed, FAQ, HowTo, horizontal
 * rule, blockquote, AI image block, task list/item — so the AI sees
 * what KIND of thing the user just did, not just the plain-text tail.
 *
 * Falls back to plain-text diff via `summarizeUserEdit` when the
 * structural diff doesn't pinpoint a single node-level change (e.g.
 * the user edited text inside an existing paragraph). Returns `null`
 * when nothing meaningful changed, so callers can skip the cue and
 * avoid the empty-bodied cue regression (W24.I).
 */
export function summarizeUserEditFromDoc(
  before: JSONContent | null,
  after: JSONContent | null,
): UserEditSummary | null {
  const beforeNodes = topLevelNodes(before);
  const afterNodes = topLevelNodes(after);

  const beforeText = docPlainText(before);
  const afterText = docPlainText(after);

  // The full doc reduced to a structural signature (node types in
  // order). Two docs with the same signature are structurally identical;
  // any difference is a structural mutation worth describing.
  const beforeSig = signature(beforeNodes);
  const afterSig = signature(afterNodes);

  // Snapshot the multiset of leaf node types each side carries —
  // typically images / horizontal rules / code blocks. A purely
  // additive insert (sig goes from "p,p" → "p,image,p") surfaces here
  // as a delta we can describe by node type.
  const beforeLeaves = countByType(beforeNodes);
  const afterLeaves = countByType(afterNodes);

  // No structural change AND no text change → genuinely a no-op (e.g.
  // selection movement). Don't dispatch a cue.
  if (beforeSig === afterSig && beforeText === afterText) return null;

  // Pure structural change → describe the first new structural node.
  // Walk the after-doc and surface the first node whose path/index
  // isn't present in the before-doc, OR whose text differs from the
  // before-doc node at the same index. The "structural change" bucket
  // covers headings, lists, images, code blocks, tables, embeds,
  // callouts, FAQ, HowTo, horizontal rules, AI image blocks, etc. —
  // anything TipTap exposes as a node, regardless of whether the node
  // carries inline text.
  if (beforeSig !== afterSig) {
    const added = findFirstNewOrChangedNode(beforeNodes, afterNodes);
    if (added) {
      const describe = describeStructuralChange(added);
      if (describe) return describe;
    }

    const removed = findFirstRemovedNode(beforeNodes, afterNodes);
    if (removed) {
      const describe = describeRemoval(removed);
      if (describe) return describe;
    }

    // Leaf-count delta fallback — covers e.g. an image inserted inside
    // an unchanged paragraph (sig unchanged at paragraph level but a
    // child image type appeared).
    const newLeafType = firstAddedLeafType(beforeLeaves, afterLeaves);
    if (newLeafType) {
      const label = friendlyNodeLabel(newLeafType);
      return {
        kind: "added",
        cueText: buildCue(
          `The user just added ${indefiniteArticle(label)} ${label} to the canvas.`,
        ),
      };
    }
    const removedLeafType = firstAddedLeafType(afterLeaves, beforeLeaves);
    if (removedLeafType) {
      const label = friendlyNodeLabel(removedLeafType);
      return {
        kind: "removed",
        cueText: buildCue(
          `The user just removed ${indefiniteArticle(label)} ${label} from the canvas.`,
        ),
      };
    }
  }

  // Fall back to the plain-text diff for purely textual edits inside an
  // unchanged structure (or for whitespace-level churn we don't want to
  // ship as a structural cue). Defence-in-depth: the text path already
  // returns null for empty-bodied diffs so the AI never sees `""`.
  return summarizeUserEdit(beforeText, afterText);
}

interface NodeSnapshot {
  readonly type: string;
  readonly text: string;
  readonly attrs?: Record<string, unknown>;
  readonly children: NodeSnapshot[];
}

function topLevelNodes(doc: JSONContent | null): NodeSnapshot[] {
  if (!doc || !Array.isArray(doc.content)) return [];
  return doc.content.map(snapshot);
}

function snapshot(node: JSONContent | string): NodeSnapshot {
  if (typeof node === "string") {
    return { type: "text", text: node, children: [] };
  }
  const type = node.type ?? "unknown";
  const text = node.text ?? "";
  const childrenSource = Array.isArray(node.content) ? node.content : [];
  return {
    type,
    text,
    attrs: node.attrs as Record<string, unknown> | undefined,
    children: childrenSource.map(snapshot),
  };
}

function signature(nodes: NodeSnapshot[]): string {
  return nodes
    .map((n) => `${n.type}(${signature(n.children)})`)
    .join(",");
}

function countByType(nodes: NodeSnapshot[]): Map<string, number> {
  const counts = new Map<string, number>();
  const walk = (list: NodeSnapshot[]) => {
    for (const n of list) {
      counts.set(n.type, (counts.get(n.type) ?? 0) + 1);
      if (n.children.length > 0) walk(n.children);
    }
  };
  walk(nodes);
  return counts;
}

function firstAddedLeafType(
  before: Map<string, number>,
  after: Map<string, number>,
): string | null {
  for (const [type, count] of after) {
    const prior = before.get(type) ?? 0;
    if (count > prior && isUserVisibleNodeType(type)) return type;
  }
  return null;
}

function findFirstNewOrChangedNode(
  before: NodeSnapshot[],
  after: NodeSnapshot[],
): NodeSnapshot | null {
  for (let i = 0; i < after.length; i++) {
    const a = after[i];
    const b = before[i];
    if (!b) return a;
    if (b.type !== a.type) return a;
    if (nodeText(b) !== nodeText(a)) return a;
  }
  return null;
}

function findFirstRemovedNode(
  before: NodeSnapshot[],
  after: NodeSnapshot[],
): NodeSnapshot | null {
  if (after.length >= before.length) return null;
  for (let i = 0; i < before.length; i++) {
    const b = before[i];
    const a = after[i];
    if (!a || a.type !== b.type) return b;
  }
  return null;
}

function nodeText(node: NodeSnapshot): string {
  if (node.type === "text") return node.text;
  return node.children.map(nodeText).join("");
}

function describeStructuralChange(node: NodeSnapshot): UserEditSummary | null {
  const label = friendlyNodeLabel(node.type);
  const text = nodeText(node).trim();
  switch (node.type) {
    case "heading": {
      const level =
        typeof node.attrs?.level === "number" ? (node.attrs.level as number) : 1;
      if (text.length === 0) {
        return {
          kind: "added",
          cueText: buildCue(
            `The user just added an empty H${level} heading to the canvas.`,
          ),
        };
      }
      return {
        kind: "added",
        cueText: buildCue(
          `The user just added an H${level} heading to the canvas: ${quote(snippet(text, MAX_SNIPPET_CHARS))}`,
        ),
      };
    }
    case "paragraph": {
      if (text.length === 0) return null;
      return {
        kind: "added",
        cueText: buildCue(
          `The user just added a new paragraph to the canvas: ${quote(snippet(text, MAX_VERBATIM_CHARS))}`,
        ),
      };
    }
    case "bulletList":
    case "orderedList":
    case "taskList": {
      const items = node.children
        .map((c) => nodeText(c).trim())
        .filter((t) => t.length > 0);
      if (items.length === 0) {
        return {
          kind: "added",
          cueText: buildCue(
            `The user just added an empty ${label} to the canvas.`,
          ),
        };
      }
      const joined = items.map((item) => `• ${item}`).join(" ");
      return {
        kind: "added",
        cueText: buildCue(
          `The user just added a ${label} to the canvas with ${items.length} item${items.length === 1 ? "" : "s"}: ${quote(snippet(joined, MAX_VERBATIM_CHARS))}`,
        ),
      };
    }
    case "codeBlock":
    case "codeBlockLowlight": {
      const language = (node.attrs?.language as string | undefined) ?? undefined;
      const langSuffix = language ? ` (${language})` : "";
      if (text.length === 0) {
        return {
          kind: "added",
          cueText: buildCue(
            `The user just added an empty code block${langSuffix} to the canvas.`,
          ),
        };
      }
      return {
        kind: "added",
        cueText: buildCue(
          `The user just added a code block${langSuffix} to the canvas: ${quote(snippet(text, MAX_SNIPPET_CHARS))}`,
        ),
      };
    }
    case "blockquote": {
      if (text.length === 0) {
        return {
          kind: "added",
          cueText: buildCue(`The user just added an empty quote to the canvas.`),
        };
      }
      return {
        kind: "added",
        cueText: buildCue(
          `The user just added a quote to the canvas: ${quote(snippet(text, MAX_SNIPPET_CHARS))}`,
        ),
      };
    }
    case "image":
    case "figure":
    case "aiImageBlock": {
      const alt = (node.attrs?.alt as string | undefined)?.trim();
      const caption = findCaption(node);
      const src = (node.attrs?.src as string | undefined)?.trim();
      const detail =
        caption ?? alt ?? (src ? `from ${truncateUrl(src)}` : undefined);
      const tail = detail ? `: ${quote(snippet(detail, MAX_SNIPPET_CHARS))}` : ".";
      return {
        kind: "added",
        cueText: buildCue(
          `The user just inserted an image into the canvas${tail}`,
        ),
      };
    }
    case "horizontalRule":
      return {
        kind: "added",
        cueText: buildCue(`The user just added a horizontal rule to the canvas.`),
      };
    case "table":
      return {
        kind: "added",
        cueText: buildCue(`The user just added a table to the canvas.`),
      };
    case "embed":
    case "youtube": {
      const src =
        (node.attrs?.src as string | undefined) ??
        (node.attrs?.url as string | undefined);
      const tail = src ? `: ${truncateUrl(src)}` : ".";
      return {
        kind: "added",
        cueText: buildCue(
          `The user just embedded ${label === "embed" ? "media" : label}${tail}`,
        ),
      };
    }
    case "callout": {
      if (text.length === 0) {
        return {
          kind: "added",
          cueText: buildCue(`The user just added an empty callout to the canvas.`),
        };
      }
      return {
        kind: "added",
        cueText: buildCue(
          `The user just added a callout to the canvas: ${quote(snippet(text, MAX_SNIPPET_CHARS))}`,
        ),
      };
    }
    case "faq":
    case "faqItem":
    case "faqQuestion":
    case "faqAnswer":
      if (text.length === 0) {
        return {
          kind: "added",
          cueText: buildCue(`The user just added an FAQ block to the canvas.`),
        };
      }
      return {
        kind: "added",
        cueText: buildCue(
          `The user just added an FAQ block to the canvas: ${quote(snippet(text, MAX_SNIPPET_CHARS))}`,
        ),
      };
    case "howTo":
    case "howToStep":
    case "howToStepName":
    case "howToStepContent":
      if (text.length === 0) {
        return {
          kind: "added",
          cueText: buildCue(`The user just added a how-to block to the canvas.`),
        };
      }
      return {
        kind: "added",
        cueText: buildCue(
          `The user just added a how-to block to the canvas: ${quote(snippet(text, MAX_SNIPPET_CHARS))}`,
        ),
      };
    default:
      if (text.length === 0) return null;
      return {
        kind: "edited",
        cueText: buildCue(
          `The user just changed a ${label} on the canvas. It now reads: ${quote(snippet(text, MAX_SNIPPET_CHARS))}`,
        ),
      };
  }
}

function describeRemoval(node: NodeSnapshot): UserEditSummary | null {
  const label = friendlyNodeLabel(node.type);
  const article = indefiniteArticle(label);
  const text = nodeText(node).trim();
  if (text.length === 0) {
    return {
      kind: "removed",
      cueText: buildCue(
        `The user just removed ${article} ${label} from the canvas.`,
      ),
    };
  }
  return {
    kind: "removed",
    cueText: buildCue(
      `The user just removed ${article} ${label} from the canvas. It read: ${quote(snippet(text, MAX_SNIPPET_CHARS))}`,
    ),
  };
}

function indefiniteArticle(label: string): "a" | "an" {
  return /^[aeiou]/i.test(label) ? "an" : "a";
}

function findCaption(node: NodeSnapshot): string | undefined {
  for (const child of node.children) {
    if (child.type === "figcaption") {
      const t = nodeText(child).trim();
      if (t.length > 0) return t;
    }
    const inner = findCaption(child);
    if (inner) return inner;
  }
  return undefined;
}

function truncateUrl(url: string): string {
  if (url.length <= 80) return url;
  return `${url.slice(0, 79)}…`;
}

function friendlyNodeLabel(type: string): string {
  switch (type) {
    case "heading":
      return "heading";
    case "paragraph":
      return "paragraph";
    case "bulletList":
      return "bulleted list";
    case "orderedList":
      return "numbered list";
    case "taskList":
      return "task list";
    case "listItem":
    case "taskItem":
      return "list item";
    case "codeBlock":
    case "codeBlockLowlight":
      return "code block";
    case "blockquote":
      return "quote";
    case "image":
    case "figure":
    case "aiImageBlock":
      return "image";
    case "figcaption":
      return "image caption";
    case "horizontalRule":
      return "horizontal rule";
    case "table":
      return "table";
    case "tableRow":
      return "table row";
    case "tableCell":
    case "tableHeader":
      return "table cell";
    case "embed":
      return "embed";
    case "youtube":
      return "YouTube embed";
    case "callout":
      return "callout";
    case "faq":
      return "FAQ block";
    case "faqItem":
      return "FAQ item";
    case "faqQuestion":
      return "FAQ question";
    case "faqAnswer":
      return "FAQ answer";
    case "howTo":
      return "how-to block";
    case "howToStep":
      return "how-to step";
    default:
      return type.replace(/([A-Z])/g, " $1").trim().toLowerCase() || "block";
  }
}

function isUserVisibleNodeType(type: string): boolean {
  // Skip schema-internal node types that don't represent something a
  // user would describe — e.g. plain text nodes (covered by text diff),
  // doc root, hard breaks. Everything else is a user-facing block or
  // inline content the AI should be told about.
  return type !== "text" && type !== "doc" && type !== "hardBreak";
}

function docPlainText(doc: JSONContent | null): string {
  if (!doc) return "";
  const out: string[] = [];
  const walk = (node: JSONContent | string): void => {
    if (typeof node === "string") {
      out.push(node);
      return;
    }
    if (node.text) out.push(node.text);
    if (Array.isArray(node.content)) {
      for (const child of node.content) walk(child);
      // Block-level separator so paragraph boundaries register in the
      // text diff. Mirrors `editor.getText()`'s default behaviour.
      if (isBlock(node.type)) out.push("\n");
    }
  };
  walk(doc);
  return out.join("");
}

function isBlock(type: string | undefined): boolean {
  if (!type) return false;
  return (
    type === "paragraph" ||
    type === "heading" ||
    type === "blockquote" ||
    type === "codeBlock" ||
    type === "codeBlockLowlight" ||
    type === "bulletList" ||
    type === "orderedList" ||
    type === "taskList" ||
    type === "listItem" ||
    type === "taskItem"
  );
}

function buildCue(description: string): string {
  // The realtime model treats `[system narration cue]` prefixes as
  // out-of-band guidance (mirrors the tool-result cue convention). The
  // tail instruction tells the model how to weave the edit into the
  // ongoing conversation without breaking its interviewer persona.
  return `[system narration cue] ${description} Acknowledge their edit naturally in one short sentence as a human collaborator would (no tool names, no jargon) and continue the interview. If the edit suggests a new direction, follow it.`;
}

function snippet(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function tail(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `…${trimmed.slice(trimmed.length - max + 1)}`;
}

function splitLines(text: string): string[] {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function quote(text: string): string {
  // Use straight double quotes so the model picks up the exact span and
  // doesn't try to "interpret" smart-quote punctuation from the user.
  return `"${text.replace(/"/g, "'")}"`;
}
