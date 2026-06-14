import "server-only";

export interface SeoStatRow {
  date: string;
  url: string;
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface GscRow {
  keys?: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export function buildSeoStatDocId(date: string, url: string): string {
  const path = new URL(url).pathname.replace(/^\//, "").replace(/\//g, "__") || "root";
  return `${date}__${path}`;
}

export function parseGscRow(row: GscRow, date: string): SeoStatRow | null {
  const keys = row.keys;
  if (!Array.isArray(keys) || keys.length < 2) {
    return null;
  }
  const [url, query] = keys;
  if (typeof url !== "string" || typeof query !== "string") {
    return null;
  }
  return {
    date,
    url,
    query,
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr,
    position: row.position,
  };
}
