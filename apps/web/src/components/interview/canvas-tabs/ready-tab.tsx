import { useMemo } from "react";
import type { CanvasState } from "@/hooks/use-interview-session";
import { canvasToHtml, computeEeatScore } from "@/lib/interviews/article-completeness";

interface Props {
  canvas: CanvasState;
  guestName?: string;
}

interface VerbatimQuote {
  sectionId: string;
  sectionHeading: string | null;
  text: string;
  attributedTo: string;
}

/**
 * EEAT (Experience, Expertise, Authoritativeness, Trustworthiness) tab.
 * Shows derived EEAT signals from the draft body and lists the verbatim
 * direct quotes pulled from canvas sections so the author can verify the
 * AI captured the guest's words faithfully.
 */
export function ReadyTab({ canvas, guestName }: Props) {
  const htmlBody = useMemo(() => canvasToHtml(canvas), [canvas]);
  const guestAttribution = useMemo(() => (guestName ? { name: guestName } : null), [guestName]);
  const eeat = useMemo(() => computeEeatScore(htmlBody, guestAttribution), [htmlBody, guestAttribution]);

  const verbatimQuotes: VerbatimQuote[] = useMemo(() => {
    const out: VerbatimQuote[] = [];
    for (const section of canvas.sections) {
      for (const quote of section.quotes) {
        if (!quote.text.trim()) continue;
        out.push({
          sectionId: section.id,
          sectionHeading: section.heading,
          text: quote.text,
          attributedTo: quote.attributedTo,
        });
      }
    }
    return out;
  }, [canvas.sections]);

  const hasAnyCanvasContent = canvas.title !== null || canvas.sections.length > 0;

  return (
    <div className="space-y-5 h-[550px] overflow-y-auto border border-border bg-background rounded-lg p-5 shadow-sm">
      <div className="space-y-1">
        <h3 className="text-md font-semibold text-foreground">Publish Readiness (E-E-A-T)</h3>
        <p className="text-xs text-muted-foreground">Checks for Experience, Expertise, Authoritativeness, and Trustworthiness.</p>
      </div>

      <div className="space-y-4 pt-1">
        {/* Score Progress */}
        <div className="p-4 bg-muted/30 border border-border rounded-lg flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">E-E-A-T Score</span>
            <p className="text-xl font-black text-foreground">{Math.round(eeat.score)}%</p>
          </div>
          <div className="w-2/3 h-2.5 bg-muted rounded-full overflow-hidden border border-border">
            <div
              className="h-full bg-success transition-all duration-500 ease-in-out"
              style={{ width: `${eeat.score}%` }}
            />
          </div>
        </div>

        {/* Signal Items */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between border-b border-border pb-2 last:border-0">
            <div className="flex items-center gap-2.5">
              <span className={`w-2.5 h-2.5 rounded-full ${eeat.hasGuestAttribution ? "bg-success shadow-sm" : "bg-muted-foreground/30"}`} />
              <span className="text-xs font-medium text-foreground">Guest Speaker Attribution</span>
            </div>
            <span className="text-[10px] text-muted-foreground">{eeat.hasGuestAttribution ? "Active" : "None"}</span>
          </div>

          <div className="flex items-center justify-between border-b border-border pb-2 last:border-0">
            <div className="flex items-center gap-2.5">
              <span className={`w-2.5 h-2.5 rounded-full ${eeat.hasQuotes ? "bg-success shadow-sm" : "bg-muted-foreground/30"}`} />
              <span className="text-xs font-medium text-foreground">Verbatim Direct Quotes</span>
            </div>
            <span className="text-[10px] text-muted-foreground">{eeat.hasQuotes ? "Detected" : "None"}</span>
          </div>

          <div className="flex items-center justify-between border-b border-border pb-2 last:border-0">
            <div className="flex items-center gap-2.5">
              <span className={`w-2.5 h-2.5 rounded-full ${eeat.hasSourceCitations ? "bg-success shadow-sm" : "bg-muted-foreground/30"}`} />
              <span className="text-xs font-medium text-foreground">External Source Citations</span>
            </div>
            <span className="text-[10px] text-muted-foreground">{eeat.hasSourceCitations ? "Detected" : "None"}</span>
          </div>

          <div className="flex items-center justify-between border-b border-border pb-2 last:border-0">
            <div className="flex items-center gap-2.5">
              <span className={`w-2.5 h-2.5 rounded-full ${eeat.hasMetrics ? "bg-success shadow-sm" : "bg-muted-foreground/30"}`} />
              <span className="text-xs font-medium text-foreground">Factual Core Metrics</span>
            </div>
            <span className="text-[10px] text-muted-foreground">{eeat.hasMetrics ? "Detected" : "None"}</span>
          </div>
        </div>

        {/* Verbatim quote capture — the EEAT tab's headline feature. Quotes
            pulled from canvas sections appear in green so the author can
            confirm the AI captured the guest's voice rather than paraphrasing. */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Verbatim Capture</span>
            <span
              data-testid="eeat-verbatim-count"
              className="text-[10px] text-muted-foreground"
            >
              {verbatimQuotes.length} {verbatimQuotes.length === 1 ? "quote" : "quotes"}
            </span>
          </div>
          {verbatimQuotes.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              {hasAnyCanvasContent
                ? "Direct quotes from the guest will appear here as the conversation progresses."
                : "Waiting for the conversation to start..."}
            </p>
          ) : (
            <ul className="space-y-2">
              {verbatimQuotes.map((q, idx) => (
                <li
                  key={`${q.sectionId}-${idx}`}
                  data-testid="eeat-verbatim-quote"
                  className="border-l-2 border-success bg-success/10 px-3 py-2 rounded-r-md"
                >
                  <p className="text-xs text-foreground italic leading-relaxed">&ldquo;{q.text}&rdquo;</p>
                  {(q.attributedTo || q.sectionHeading) && (
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {q.attributedTo && <span>— {q.attributedTo}</span>}
                      {q.attributedTo && q.sectionHeading && <span> · </span>}
                      {q.sectionHeading && <span>{q.sectionHeading}</span>}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
