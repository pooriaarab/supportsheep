const PUBLIC_ARTICLES_ANCHOR = "/api/v1/public/articles";
const PUBLIC_ARTICLE_DETAIL_ANCHOR = "/api/v1/public/articles/{slug}";
const PUBLIC_SEARCH_ANCHOR = "/api/search";
const PUBLIC_FEED_ANCHOR = "/api/feed";
const MARKDOWN_NEGOTIATION_ANCHOR = "/api/markdown";
const API_DOCS_PATH = "/docs/api";
const STATUS_PATH = "/api/v1/health";

type LinksetEntry = {
  anchor: string;
  links: Array<{
    rel: string;
    href: string;
    type: string;
  }>;
};

function buildPublicApiEntry(siteUrl: string, path: string): LinksetEntry {
  return {
    anchor: `${siteUrl}${path}`,
    links: [
      {
        rel: "service-doc",
        href: `${siteUrl}${API_DOCS_PATH}`,
        type: "text/html",
      },
      {
        rel: "status",
        href: `${siteUrl}${STATUS_PATH}`,
        type: "application/json",
      },
    ],
  };
}

export function buildApiCatalog(siteUrl: string) {
  return {
    linkset: [
      buildPublicApiEntry(siteUrl, PUBLIC_ARTICLES_ANCHOR),
      buildPublicApiEntry(siteUrl, PUBLIC_ARTICLE_DETAIL_ANCHOR),
      buildPublicApiEntry(siteUrl, PUBLIC_SEARCH_ANCHOR),
      buildPublicApiEntry(siteUrl, PUBLIC_FEED_ANCHOR),
      buildPublicApiEntry(siteUrl, MARKDOWN_NEGOTIATION_ANCHOR),
    ],
  };
}
