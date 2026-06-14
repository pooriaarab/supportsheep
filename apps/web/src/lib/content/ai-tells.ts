/**
 * HTML-aware AI-tell substitution.
 *
 * Walks HTML text nodes and rewrites a small, hand-picked set of AI-writing
 * tells (seamless, comprehensive, robust, streamline, leverage, navigate when
 * transitive, landscape, foster, delve, and the "in today's ..." preamble)
 * into more natural phrasing.
 *
 * Safety posture:
 *   - Operates only on HTML text nodes -- tags, attribute values, href URLs,
 *     and class names are never touched.
 *   - Skips content inside <code> and <pre> (and nested elements within them).
 *   - Preserves original case where possible (e.g. "Seamless" -> "Smooth").
 *   - Contextual guards for "navigate" avoid clobbering the geographic sense
 *     (website, site, page, menu, map, app, dashboard, ...).
 *   - Returns a changelog of every edit with before/after snippets for review.
 *   - Idempotent: running twice on already-rewritten text is a no-op because
 *     the replacement strings do not contain the target tokens.
 */

import rehypeParse from "rehype-parse";
import rehypeStringify from "rehype-stringify";
import { unified } from "unified";
import type { Element, Root, RootContent, Text } from "hast";

export interface AiTellChange {
  /** Canonical rule name that fired (e.g. "seamless", "in-todays"). */
  rule: string;
  /** Raw text that was matched in the source. */
  from: string;
  /** Replacement text that was substituted in. */
  to: string;
  /** ~60 characters of surrounding context (the *original* text). */
  context: string;
}

export interface DeAiTellResult {
  /** Rewritten HTML. Equal to the input when no rules fire. */
  html: string;
  /** Per-match change records, in document order. */
  changes: AiTellChange[];
  /** Count of matches per rule name. */
  counts: Record<string, number>;
}

/**
 * A substitution rule that operates over the text of a single HTML text node.
 *
 * `replace` must return an object { text, changes } where `text` is the new
 * node text and `changes` is one record per fired match. Returning an empty
 * `changes` array means the rule did not match.
 */
interface Rule {
  name: string;
  replace: (input: string) => { text: string; changes: AiTellChange[] };
}

/**
 * Tags whose entire subtree should be left alone. Code samples and preformatted
 * text frequently contain words like "seamless" inside identifier names
 * (e.g. `seamlessScroll`) and rewriting them would break code.
 */
const SKIP_TAGS: ReadonlySet<string> = new Set(["code", "pre", "kbd", "samp"]);

function contextSnippet(source: string, index: number, length: number): string {
  const pad = 30;
  const start = Math.max(0, index - pad);
  const end = Math.min(source.length, index + length + pad);
  let snippet = source.slice(start, end).replace(/\s+/g, " ").trim();
  if (start > 0) snippet = `...${snippet}`;
  if (end < source.length) snippet = `${snippet}...`;
  return snippet;
}

/**
 * Preserve capitalization of `original` on `replacement`.
 *   - All caps in original     -> All caps in replacement
 *   - Title-case in original   -> Title-case in replacement
 *   - Otherwise                -> replacement unchanged (assumed lowercase)
 */
function matchCase(original: string, replacement: string): string {
  if (!original || !replacement) return replacement;
  if (original === original.toUpperCase() && original.length > 1) {
    return replacement.toUpperCase();
  }
  const firstChar = original.charAt(0);
  if (firstChar === firstChar.toUpperCase() && firstChar !== firstChar.toLowerCase()) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

/**
 * Build a rule that scans for a word-boundary match of `pattern` and replaces
 * each hit with the first successful transform from `transforms`. When no
 * transform claims a match, the rule leaves it alone (used for contextual
 * rules like `navigate`).
 */
function buildRule(
  name: string,
  pattern: RegExp,
  transform: (match: RegExpExecArray, source: string) => string | null,
): Rule {
  return {
    name,
    replace(input: string) {
      if (!pattern.test(input)) {
        // Reset the regex state and bail -- no need to allocate anything.
        pattern.lastIndex = 0;
        return { text: input, changes: [] };
      }
      pattern.lastIndex = 0;

      const changes: AiTellChange[] = [];
      let out = "";
      let cursor = 0;
      let m: RegExpExecArray | null;

      while ((m = pattern.exec(input)) !== null) {
        const replacement = transform(m, input);
        if (replacement === null) {
          // Skip this match -- advance past it without touching.
          continue;
        }
        const matchStart = m.index;
        const matchEnd = matchStart + m[0].length;
        out += input.slice(cursor, matchStart);
        out += replacement;
        changes.push({
          rule: name,
          from: m[0],
          to: replacement,
          context: contextSnippet(input, matchStart, m[0].length),
        });
        cursor = matchEnd;
        // Avoid infinite loops for zero-width matches (shouldn't happen here,
        // but defensive).
        if (m[0].length === 0) pattern.lastIndex += 1;
      }
      if (changes.length === 0) return { text: input, changes: [] };
      out += input.slice(cursor);
      return { text: out, changes };
    },
  };
}

/**
 * `navigate` is preserved when the object is a navigable surface (website,
 * site, page, menu, map, app, dashboard, interface, sidebar). For any other
 * object ("navigate the process", "navigate the complexity", "navigate
 * challenges") we rewrite to "handle".
 */
const NAVIGATE_GEOGRAPHIC_CONTEXT =
  /\b(website|site|page|menu|map|app|application|dashboard|interface|sidebar|url|link|tab|modal)\b/i;

function stripSeamlessAdjectivePhrase(
  match: RegExpExecArray,
  _source: string,
): string | null {
  // Regex: /\b(seamless)\s+([a-zA-Z][a-zA-Z-]*)/g
  //   match[1] = the word "seamless" (with original casing)
  //   match[2] = the following noun to keep
  const seamlessWord = match[1] ?? "";
  const followingWord = match[2] ?? "";
  if (!followingWord) return null;
  // Re-capitalize the following word if "Seamless" was capitalized at the
  // start of a sentence, otherwise keep it in its original (lowercase) form.
  return matchCase(seamlessWord, followingWord);
}

const RULES: Rule[] = [
  // "In today's <stuff>," preamble -> delete the whole clause opener through
  // the trailing comma, and re-capitalize the next word. Handles
  //   "In today's fast-paced world, AI is ..."  ->  "AI is ..."
  //   "in today's digital landscape, teams ..." ->  "teams ..."
  // When no trailing comma is nearby (rare), only the "in today's " preamble
  // is removed so we never consume arbitrary amounts of sentence content.
  buildRule(
    "in-todays",
    /\b(In|in)\s+today['\u2019]s\s+[^,.!?\n]{1,80}?,\s+([a-zA-Z])/g,
    (m) => {
      // Capitalize whatever follows so the sentence still reads correctly.
      const nextChar = m[2] ?? "";
      return nextChar ? nextChar.toUpperCase() : "";
    },
  ),

  // "seamless <word>" -> "<word>" (delete the adjective)
  buildRule(
    "seamless",
    /\b(seamless|Seamless|SEAMLESS)\s+([a-zA-Z][a-zA-Z-]*)/g,
    stripSeamlessAdjectivePhrase,
  ),

  // "seamlessly" (adverb) -> "smoothly"
  buildRule(
    "seamlessly",
    /\b(seamlessly|Seamlessly|SEAMLESSLY)\b/g,
    (m) => matchCase(m[0], "smoothly"),
  ),

  // "comprehensive" -> "complete"
  buildRule(
    "comprehensive",
    /\b(comprehensive|Comprehensive|COMPREHENSIVE)\b/g,
    (m) => matchCase(m[0], "complete"),
  ),

  // "robust" -> "reliable"
  buildRule(
    "robust",
    /\b(robust|Robust|ROBUST)\b/g,
    (m) => matchCase(m[0], "reliable"),
  ),

  // "streamline(s|d)?" -> "simplify / simplifies / simplified"
  buildRule(
    "streamline",
    /\b(streamline|streamlines|streamlined|streamlining|Streamline|Streamlines|Streamlined|Streamlining|STREAMLINE|STREAMLINES|STREAMLINED|STREAMLINING)\b/g,
    (m) => {
      const original = m[0];
      const lower = original.toLowerCase();
      const mapping: Record<string, string> = {
        streamline: "simplify",
        streamlines: "simplifies",
        streamlined: "simplified",
        streamlining: "simplifying",
      };
      const rep = mapping[lower] ?? "simplify";
      return matchCase(original, rep);
    },
  ),

  // "navigate" (transitive, non-geographic) -> "handle"
  buildRule(
    "navigate",
    /\b(navigate|navigates|navigated|navigating|Navigate|Navigates|Navigated|Navigating|NAVIGATE|NAVIGATES|NAVIGATED|NAVIGATING)\b(\s+\w+(?:\s+\w+)?)?/g,
    (m, source) => {
      const verb = m[0];
      // Read ~40 chars of trailing context to decide if this is the geographic
      // sense. If we see "website", "page", "menu", etc. within a short window
      // after "navigate", keep the word as-is.
      const tail = source.slice(m.index, m.index + m[0].length + 40);
      if (NAVIGATE_GEOGRAPHIC_CONTEXT.test(tail)) return null;
      // Preserve any trailing words we matched (they were only consumed for
      // context detection -- we replace just the verb).
      const baseVerb = m[1] ?? verb;
      const lower = baseVerb.toLowerCase();
      const mapping: Record<string, string> = {
        navigate: "handle",
        navigates: "handles",
        navigated: "handled",
        navigating: "handling",
      };
      const rep = mapping[lower] ?? "handle";
      const replaced = matchCase(baseVerb, rep);
      // Return the replaced verb plus the unchanged tail the regex consumed.
      return replaced + (m[2] ?? "");
    },
  ),

  // "leverage" / "leverages" / "leveraged" / "leveraging" -> "use" / "uses" / ...
  buildRule(
    "leverage",
    /\b(leverage|leverages|leveraged|leveraging|Leverage|Leverages|Leveraged|Leveraging|LEVERAGE|LEVERAGES|LEVERAGED|LEVERAGING)\b/g,
    (m) => {
      const lower = m[0].toLowerCase();
      const mapping: Record<string, string> = {
        leverage: "use",
        leverages: "uses",
        leveraged: "used",
        leveraging: "using",
      };
      return matchCase(m[0], mapping[lower] ?? "use");
    },
  ),

  // "landscape" (metaphorical) -> "field"
  buildRule(
    "landscape",
    /\b(landscape|Landscape|LANDSCAPE)\b/g,
    (m) => matchCase(m[0], "field"),
  ),

  // "foster" / "fosters" / ... -> "build" / "builds" / ...
  buildRule(
    "foster",
    /\b(foster|fosters|fostered|fostering|Foster|Fosters|Fostered|Fostering|FOSTER|FOSTERS|FOSTERED|FOSTERING)\b/g,
    (m) => {
      const lower = m[0].toLowerCase();
      const mapping: Record<string, string> = {
        foster: "build",
        fosters: "builds",
        fostered: "built",
        fostering: "building",
      };
      return matchCase(m[0], mapping[lower] ?? "build");
    },
  ),

  // "delve" / "delves" / ... -> "explore"
  buildRule(
    "delve",
    /\b(delve|delves|delved|delving|Delve|Delves|Delved|Delving|DELVE|DELVES|DELVED|DELVING)\b/g,
    (m) => {
      const lower = m[0].toLowerCase();
      const mapping: Record<string, string> = {
        delve: "explore",
        delves: "explores",
        delved: "explored",
        delving: "exploring",
      };
      return matchCase(m[0], mapping[lower] ?? "explore");
    },
  ),
];

/**
 * Apply all substitution rules to a single text node's content.
 *
 * Rules run sequentially; each rule sees the text as modified by the preceding
 * rules. Because the rule replacements never introduce new target tokens,
 * rule order does not change the outcome in practice.
 */
export function applyRulesToText(input: string): {
  text: string;
  changes: AiTellChange[];
} {
  let text = input;
  const all: AiTellChange[] = [];
  for (const rule of RULES) {
    const { text: next, changes } = rule.replace(text);
    if (changes.length > 0) {
      text = next;
      all.push(...changes);
    }
  }
  return { text, changes: all };
}

/**
 * Recursively walks a HAST subtree and invokes `onText` for every text node
 * that is not inside a skipped ancestor (<code>, <pre>, etc.).
 *
 * Implemented directly instead of using unist-util-visit-parents so we do
 * not depend on a package that isn't a direct dependency of @repo/web.
 */
function walkTextNodes(
  node: Root | RootContent,
  insideSkip: boolean,
  onText: (text: Text) => void,
): void {
  if (node.type === "text") {
    if (!insideSkip) onText(node);
    return;
  }
  if (node.type === "element") {
    const el = node as Element;
    const nextSkip = insideSkip || SKIP_TAGS.has(el.tagName);
    if (Array.isArray(el.children)) {
      for (const child of el.children) {
        walkTextNodes(child, nextSkip, onText);
      }
    }
    return;
  }
  if (node.type === "root") {
    const root = node as Root;
    if (Array.isArray(root.children)) {
      for (const child of root.children) {
        walkTextNodes(child, insideSkip, onText);
      }
    }
  }
}

/**
 * HTML-aware de-AI-tell pass over an article body.
 *
 * Parses the input as an HTML fragment, rewrites text nodes that are not
 * inside <code>/<pre>, and re-serializes the tree. Attribute values, tag
 * names, and URL values are never passed through the substitution rules.
 */
export function deAiTellHtml(html: string): DeAiTellResult {
  if (!html) return { html: "", changes: [], counts: {} };

  const changes: AiTellChange[] = [];

  const processor = unified()
    .use(rehypeParse, { fragment: true })
    .use(() => (tree: Root) => {
      walkTextNodes(tree, false, (node) => {
        const value = typeof node.value === "string" ? node.value : "";
        if (!value) return;
        const { text, changes: nodeChanges } = applyRulesToText(value);
        if (nodeChanges.length > 0) {
          node.value = text;
          changes.push(...nodeChanges);
        }
      });
    })
    .use(rehypeStringify, { allowDangerousHtml: true });

  const out = String(processor.processSync(html));

  const counts: Record<string, number> = {};
  for (const c of changes) {
    counts[c.rule] = (counts[c.rule] ?? 0) + 1;
  }

  return { html: out, changes, counts };
}

/**
 * Exported for scripts/tests that want to inspect the rule set.
 */
export const RULE_NAMES: readonly string[] = RULES.map((r) => r.name);
