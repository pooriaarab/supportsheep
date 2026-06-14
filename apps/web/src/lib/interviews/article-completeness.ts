/**
 * Canvas → minimal HTML serialization. Shared by the SEO + Ready tabs so that
 * SEO meta extraction and EEAT scoring see the same body shape.
 */
export interface CanvasLike {
  title: string | null;
  sections: Array<{
    heading: string | null;
    bullets: string[];
    paragraphs: string[];
    quotes: Array<{ text: string; attributedTo: string }>;
  }>;
}

export function canvasToHtml(canvas: CanvasLike): string {
  let body = "";
  if (canvas.title) body += `<h1>${canvas.title}</h1>`;
  for (const s of canvas.sections) {
    if (s.heading) body += `<h2>${s.heading}</h2>`;
    for (const b of s.bullets) body += `<li>${b}</li>`;
    for (const p of s.paragraphs) body += `<p>${p}</p>`;
    for (const q of s.quotes) body += `<blockquote>${q.text}</blockquote>`;
  }
  return body;
}

export function shouldRegenerateImage(prevTitle: string | null, nextTitle: string | null): boolean {
  if (!nextTitle) return false;
  if (!prevTitle) return true;
  return diffSignificant(prevTitle, nextTitle);
}

function diffSignificant(a: string, b: string): boolean {
  // Word overlap heuristic — title change is significant if less than 70% of words are shared
  const aWords = new Set(a.toLowerCase().split(/\s+/).filter(Boolean));
  const bWords = new Set(b.toLowerCase().split(/\s+/).filter(Boolean));
  let shared = 0;
  for (const w of aWords) {
    if (bWords.has(w)) {
      shared++;
    }
  }
  const overlap = shared / Math.max(aWords.size, bWords.size, 1);
  return overlap < 0.7;
}

export interface SeoMeta {
  metaTitle: string | null;
  metaDescription: string | null;
  suggestedTags: string[];
}

export function extractSeoMeta(body: string): SeoMeta {
  const firstHeading = body.match(/<h[12][^>]*>([^<]+)<\/h[12]>/i)?.[1] ?? null;
  const firstParagraph = body.match(/<p[^>]*>([^<]+)<\/p>/i)?.[1] ?? null;
  const metaDescription = firstParagraph ? (firstParagraph.length > 155 ? `${firstParagraph.slice(0, 152).trim()}...` : firstParagraph.trim()) : null;
  
  // Extract frequency of words with length > 4 to suggest tags
  const words = body.replace(/<[^>]+>/g, " ").toLowerCase().split(/\s+/).filter((w) => w.length > 4 && /^[a-z]+$/.test(w));
  const freq = new Map<string, number>();
  for (const w of words) {
    freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  const suggestedTags = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([w]) => w);

  return { metaTitle: firstHeading, metaDescription, suggestedTags };
}

export interface EeatSignals {
  hasGuestAttribution: boolean;
  hasQuotes: boolean;
  hasSourceCitations: boolean;
  hasMetrics: boolean;
  score: number; // 0..100
}

export function computeEeatScore(body: string, guestAttribution: { name?: string } | null): EeatSignals {
  const hasGuestAttribution = !!guestAttribution?.name;
  const hasQuotes = /<blockquote/i.test(body);
  const hasSourceCitations = /<a [^>]*href=/i.test(body);
  const hasMetrics = /\b\d+(%|x|×|k|m| customers| users)\b/i.test(body);
  const signals = [hasGuestAttribution, hasQuotes, hasSourceCitations, hasMetrics];
  const score = (signals.filter(Boolean).length / signals.length) * 100;
  return { hasGuestAttribution, hasQuotes, hasSourceCitations, hasMetrics, score };
}
