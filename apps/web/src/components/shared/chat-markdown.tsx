import { type ReactNode } from "react";

/**
 * Lightweight inline markdown renderer for chat messages.
 * Supports bold, inline code, code blocks, and headings.
 */

export function ChatMarkdown({ content }: { content: string }) {
  const blocks = parseMarkdownBlocks(content);

  return (
    <div className="space-y-1.5">
      {blocks.map((block) => (
        <MarkdownBlock key={block.key} block={block} />
      ))}
    </div>
  );
}

type MarkdownBlock =
  | { type: "code"; key: string; text: string }
  | { type: "heading"; key: string; text: string }
  | { type: "paragraph"; key: string; text: string };

function MarkdownBlock({ block }: { block: MarkdownBlock }) {
  if (block.type === "code") {
    return (
      <pre className="bg-background/50 border border-border rounded px-2 py-1.5 text-xs overflow-x-auto font-mono">
        {block.text}
      </pre>
    );
  }

  if (block.type === "heading") {
    return (
      <p className="font-semibold">
        <InlineMarkdown text={block.text} />
      </p>
    );
  }

  return (
    <p className="whitespace-pre-wrap break-words">
      <InlineMarkdown text={block.text} />
    </p>
  );
}

function parseMarkdownBlocks(content: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const keyCounts = new Map<string, number>();
  const lines = content.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      const text = codeLines.join("\n");
      blocks.push({
        type: "code",
        key: uniqueContentKey("code", text, keyCounts),
        text,
      });
      continue;
    }

    if (line.match(/^#{1,3}\s/)) {
      const text = line.replace(/^#{1,3}\s+/, "");
      blocks.push({
        type: "heading",
        key: uniqueContentKey("heading", text, keyCounts),
        text,
      });
      i++;
      continue;
    }

    if (line.trim() === "") {
      i++;
      continue;
    }

    blocks.push({
      type: "paragraph",
      key: uniqueContentKey("paragraph", line, keyCounts),
      text: line,
    });
    i++;
  }

  return blocks;
}

/* ---------- Inline formatting ---------- */

function InlineMarkdown({ text }: { text: string }) {
  return <>{parseInlineMarkdown(text)}</>;
}

type InlineMatch = {
  index: number;
  length: number;
  type: "bold" | "code";
  inner: string;
};

function parseInlineMarkdown(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const keyCounts = new Map<string, number>();
  let remaining = text;

  while (remaining.length > 0) {
    const match = findInlineMatch(remaining);

    if (!match) {
      parts.push(remaining);
      break;
    }

    if (match.index > 0) parts.push(remaining.slice(0, match.index));

    if (match.type === "bold") {
      parts.push(
        <strong key={uniqueContentKey("bold", match.inner, keyCounts)}>
          {match.inner}
        </strong>,
      );
    } else {
      parts.push(
        <code
          key={uniqueContentKey("code", match.inner, keyCounts)}
          className="bg-background/50 border border-border rounded px-1 py-0.5 text-xs font-mono"
        >
          {match.inner}
        </code>,
      );
    }

    remaining = remaining.slice(match.index + match.length);
  }

  return parts;
}

function findInlineMatch(text: string): InlineMatch | null {
  const boldMatch = text.match(/\*\*(.+?)\*\*/);
  const codeMatch = text.match(/`([^`]+)`/);
  let match: InlineMatch | null = null;

  if (boldMatch?.index !== undefined) {
    match = {
      index: boldMatch.index,
      length: boldMatch[0].length,
      type: "bold",
      inner: boldMatch[1],
    };
  }

  if (
    codeMatch?.index !== undefined &&
    (!match || codeMatch.index < match.index)
  ) {
    match = {
      index: codeMatch.index,
      length: codeMatch[0].length,
      type: "code",
      inner: codeMatch[1],
    };
  }

  return match;
}

function uniqueContentKey(
  prefix: string,
  content: string,
  counts: Map<string, number>,
): string {
  const base = `${prefix}:${content}`;
  const count = counts.get(base) ?? 0;
  counts.set(base, count + 1);
  return count === 0 ? base : `${base}:${count}`;
}
