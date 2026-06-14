import { useMutation } from "@tanstack/react-query";

export interface LinkSuggestion {
  phrase: string;
  url: string;
  reason: string;
}

async function suggestLinks(
  content: string,
  sitemapId?: string,
): Promise<LinkSuggestion[]> {
  const res = await fetch("/api/v1/seo/suggest-links", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, sitemapId }),
  });
  if (!res.ok) {
    const err = (await res.json()) as { error: string };
    throw new Error(err.error || "Failed to suggest links");
  }
  const json = (await res.json()) as {
    data: { suggestions: LinkSuggestion[] };
  };
  return json.data.suggestions;
}

export function useSuggestLinksMutation() {
  return useMutation({
    mutationFn: ({
      content,
      sitemapId,
    }: {
      content: string;
      sitemapId?: string;
    }) => suggestLinks(content, sitemapId),
  });
}
