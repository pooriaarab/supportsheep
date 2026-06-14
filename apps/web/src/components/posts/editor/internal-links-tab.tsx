"use client";

import { useCallback, useMemo, useState } from "react";
import type { Editor } from "@tiptap/react";
import { Button } from "@repo/ui/primitives/button";
import { EmptyState } from "@repo/ui/composites/empty-state";
import { Link2, Loader2, Sparkles, Check, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import {
  useSuggestLinksMutation,
  type LinkSuggestion,
} from "@/hooks/use-suggest-links-mutation";

interface InternalLinksTabProps {
  body: string;
  editor: Editor | null;
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findPhraseRange(
  editor: Editor,
  phrase: string,
): { from: number; to: number } | null {
  const needle = phrase.toLowerCase();
  if (!needle) return null;

  const { doc } = editor.state;
  const linkType = editor.schema.marks.link;

  const segments: { text: string; pos: number }[] = [];
  doc.descendants((node, pos) => {
    if (node.isTextblock) {
      segments.push({ text: node.textContent, pos: pos + 1 });
      return false;
    }
    return true;
  });

  for (const { text, pos } of segments) {
    const haystack = text.toLowerCase();
    let searchFrom = 0;
    while (searchFrom <= haystack.length - needle.length) {
      const idx = haystack.indexOf(needle, searchFrom);
      if (idx === -1) break;

      const from = pos + idx;
      const to = from + phrase.length;

      let hasExistingLink = false;
      if (linkType) {
        doc.nodesBetween(from, to, (node) => {
          if (node.marks.some((m) => m.type === linkType)) {
            hasExistingLink = true;
            return false;
          }
          return true;
        });
      }

      if (!hasExistingLink) return { from, to };
      searchFrom = idx + needle.length;
    }
  }

  return null;
}

function SuggestionCard({
  suggestion,
  inserted,
  onInsert,
}: {
  suggestion: LinkSuggestion;
  inserted: boolean;
  onInsert: () => void;
}) {
  return (
    <div className="rounded-md border border-border p-2.5 space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-foreground break-words">
          {suggestion.phrase}
        </span>
        {inserted && (
          <span className="flex items-center gap-0.5 text-[10px] text-success shrink-0">
            <Check className="size-3" /> Inserted
          </span>
        )}
      </div>
      <a
        href={suggestion.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 text-[11px] text-primary hover:underline break-all"
      >
        <ExternalLink className="size-3 shrink-0" />
        <span className="truncate">{suggestion.url}</span>
      </a>
      {suggestion.reason && (
        <p className="text-[11px] text-muted-foreground italic">
          {suggestion.reason}
        </p>
      )}
      <div className="pt-1">
        <Button
          size="sm"
          variant={inserted ? "outline" : "default"}
          className="h-7 text-[11px] w-full gap-1.5"
          disabled={inserted}
          onClick={onInsert}
        >
          <Link2 className="size-3" />
          {inserted ? "Inserted" : "Insert link"}
        </Button>
      </div>
    </div>
  );
}

export function InternalLinksTab({ body, editor }: InternalLinksTabProps) {
  const [suggestions, setSuggestions] = useState<LinkSuggestion[]>([]);
  const [insertedUrls, setInsertedUrls] = useState<Set<string>>(new Set());
  const [hasFetched, setHasFetched] = useState(false);

  const { mutate: suggestLinks, isPending } = useSuggestLinksMutation();

  const plainText = useMemo(() => htmlToPlainText(body), [body]);
  const canFetch = plainText.length > 0 && !isPending;

  const fetchSuggestions = useCallback(() => {
    if (!canFetch) return;
    suggestLinks(
      { content: plainText },
      {
        onSuccess: (data) => {
          setSuggestions(data);
          setInsertedUrls(new Set());
          setHasFetched(true);
        },
        onError: (err: unknown) => {
          const message =
            err instanceof Error ? err.message : "Failed to load suggestions";
          toast.error(message);
        },
      },
    );
  }, [canFetch, suggestLinks, plainText]);

  const handleInsert = useCallback(
    (suggestion: LinkSuggestion) => {
      if (!editor) {
        toast.error("Editor not ready");
        return;
      }

      const range = findPhraseRange(editor, suggestion.phrase);
      if (!range) {
        toast.error("Could not locate phrase in article");
        return;
      }

      editor
        .chain()
        .focus()
        .setTextSelection(range)
        .setLink({ href: suggestion.url })
        .setTextSelection(range.to)
        .run();

      setInsertedUrls((prev) => {
        const next = new Set(prev);
        next.add(suggestion.url);
        return next;
      });
      toast.success("Link inserted");
    },
    [editor],
  );

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 space-y-3 overflow-y-auto flex-1">
        <div className="space-y-1">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Internal Links
          </h3>
          <p className="text-[11px] text-muted-foreground">
            AI-suggested links to other pages on your site. Click to insert the
            anchor in your article.
          </p>
        </div>

        <Button
          size="sm"
          variant="outline"
          className="h-8 w-full gap-1.5 text-xs"
          disabled={!canFetch}
          onClick={fetchSuggestions}
        >
          {isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Sparkles className="size-3.5" />
          )}
          {isPending
            ? "Finding suggestions..."
            : hasFetched
              ? "Refresh suggestions"
              : "Find suggestions"}
        </Button>

        {isPending && suggestions.length === 0 && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isPending && hasFetched && suggestions.length === 0 && (
          <EmptyState
            icon={Link2}
            title="No suggestions found"
            description="Add more content or configure sitemaps under SEO settings to unlock internal link suggestions."
          />
        )}

        {suggestions.length > 0 && (
          <div className="space-y-2">
            {suggestions.map((suggestion) => (
              <SuggestionCard
                key={`${suggestion.url}-${suggestion.phrase}`}
                suggestion={suggestion}
                inserted={insertedUrls.has(suggestion.url)}
                onInsert={() => handleInsert(suggestion)}
              />
            ))}
          </div>
        )}

        {!hasFetched && !isPending && plainText.length === 0 && (
          <p className="text-[11px] text-muted-foreground italic">
            Start writing to receive internal link suggestions.
          </p>
        )}
      </div>
    </div>
  );
}
