import { useMemo } from "react";
import type { CanvasState } from "@/hooks/use-interview-session";
import { canvasToHtml, extractSeoMeta } from "@/lib/interviews/article-completeness";

interface Props {
  canvas: CanvasState;
}

/**
 * SEO tab. Prefers canvas-level SEO fields populated by AI tools
 * (`set_seo_meta`, `request_seo_score`, `suggest_internal_links`,
 * `keywords_updated`) and falls back to a client-side HTML derivation so the
 * tab is never empty once the draft has any content.
 */
export function SeoTab({ canvas }: Props) {
  const htmlBody = useMemo(() => canvasToHtml(canvas), [canvas]);
  const derived = useMemo(() => extractSeoMeta(htmlBody), [htmlBody]);

  const metaTitle = canvas.metaTitle ?? derived.metaTitle;
  const metaDescription = canvas.metaDescription ?? derived.metaDescription;
  const keywords = canvas.keywords && canvas.keywords.length > 0
    ? canvas.keywords
    : derived.suggestedTags;
  const keywordSource = canvas.keywords && canvas.keywords.length > 0
    ? "Keywords"
    : "Suggested Tags";
  const seoScore = canvas.seoScore ?? null;
  const internalLinks = canvas.internalLinkSuggestions ?? [];
  const hasAnyCanvasContent = canvas.title !== null || canvas.sections.length > 0;

  return (
    <div className="space-y-5 h-[550px] overflow-y-auto border border-border bg-background rounded-lg p-5 shadow-sm">
      <div className="space-y-1">
        <h3 className="text-md font-semibold text-foreground">SEO Meta & Suggestions</h3>
        <p className="text-xs text-muted-foreground">Dynamic SEO validation of your active draft.</p>
      </div>

      {seoScore && (
        <div
          data-testid="seo-score"
          className="p-4 bg-muted/30 border border-border rounded-lg flex items-center justify-between"
        >
          <div className="space-y-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">SEO Score</span>
            <p className="text-xl font-black text-foreground">{Math.round(seoScore.score)}%</p>
          </div>
          <div className="w-2/3 h-2.5 bg-muted rounded-full overflow-hidden border border-border">
            <div
              className="h-full bg-success transition-all duration-500 ease-in-out"
              style={{ width: `${Math.min(100, Math.max(0, seoScore.score))}%` }}
            />
          </div>
        </div>
      )}

      <div className="space-y-4 pt-1">
        <div className="space-y-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">Meta Title</label>
          <div className="p-3 bg-muted/40 border border-border rounded-md text-xs font-medium text-foreground">
            {metaTitle || <span className="text-muted-foreground italic">{hasAnyCanvasContent ? "Drafting content for title..." : "Waiting for article content..."}</span>}
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">Meta Description</label>
          <div className="p-3 bg-muted/40 border border-border rounded-md text-xs text-foreground leading-relaxed">
            {metaDescription || <span className="text-muted-foreground italic">{hasAnyCanvasContent ? "Drafting content for description..." : "Waiting for article content..."}</span>}
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">{keywordSource}</label>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {keywords.length === 0 ? (
              <span className="text-xs text-muted-foreground italic">Waiting for keywords...</span>
            ) : (
              keywords.map((tag) => (
                <span
                  key={tag}
                  data-testid="seo-keyword"
                  className="px-2 py-0.5 bg-primary/10 border border-primary/20 text-primary text-[10px] font-semibold rounded-full"
                >
                  {tag}
                </span>
              ))
            )}
          </div>
        </div>

        {seoScore && (seoScore.issues.length > 0 || seoScore.suggestions.length > 0) && (
          <div className="space-y-2">
            {seoScore.issues.length > 0 && (
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">Issues</label>
                <ul className="space-y-1">
                  {seoScore.issues.map((issue, idx) => (
                    <li
                      key={`issue-${idx}`}
                      data-testid="seo-issue"
                      className="text-xs text-foreground bg-warning/10 border border-warning/20 rounded-md px-2 py-1.5 leading-relaxed"
                    >
                      {issue}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {seoScore.suggestions.length > 0 && (
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">Suggestions</label>
                <ul className="space-y-1">
                  {seoScore.suggestions.map((suggestion, idx) => (
                    <li
                      key={`suggestion-${idx}`}
                      data-testid="seo-suggestion"
                      className="text-xs text-foreground bg-muted/40 border border-border rounded-md px-2 py-1.5 leading-relaxed"
                    >
                      {suggestion}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {internalLinks.length > 0 && (
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">Internal Link Suggestions</label>
            <ul className="space-y-1.5">
              {internalLinks.map((link, idx) => (
                <li
                  key={`${link.targetSlug}-${idx}`}
                  data-testid="seo-internal-link"
                  className="text-xs bg-muted/30 border border-border rounded-md px-2 py-1.5"
                >
                  <div className="font-medium text-foreground">&ldquo;{link.phrase}&rdquo; → {link.targetSlug}</div>
                  {link.reason && (
                    <div className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">{link.reason}</div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
