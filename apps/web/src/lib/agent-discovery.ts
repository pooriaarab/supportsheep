import { createHash } from "node:crypto";

type AgentSkill = {
  name: string;
  type: "skill-md";
  description: string;
  url: string;
  digest: string;
};

type AgentCardSkill = {
  id: string;
  name: string;
  description: string;
  tags: string[];
  examples: string[];
  inputModes: string[];
  outputModes: string[];
};

const AGENT_DISCOVERY_LINKS = [
  { href: "/sitemap.xml", rel: "sitemap", type: "application/xml" },
  { href: "/robots.txt", rel: "robots", type: "text/plain" },
  { href: "/llms.txt", rel: "llms", type: "text/plain" },
  { href: "/llms-full.txt", rel: "alternate", type: "text/plain" },
  {
    href: "/.well-known/api-catalog",
    rel: "api-catalog",
    type: "application/linkset+json",
  },
  {
    href: "/.well-known/agent-skills/index.json",
    rel: "agent-skills",
    type: "application/json",
  },
  {
    href: "/.well-known/mcp/server-card.json",
    rel: "mcp-server-card",
    type: "application/json",
  },
  {
    href: "/.well-known/agent-card.json",
    rel: "agent-card",
    type: "application/json",
  },
  { href: "/docs/api", rel: "service-doc", type: "text/html" },
] as const;

export function buildAgentDiscoveryLinkHeader() {
  return AGENT_DISCOVERY_LINKS.map(
    (link) => `<${link.href}>; rel="${link.rel}"; type="${link.type}"`,
  ).join(", ");
}

export function buildMcpServerCard(siteUrl: string) {
  return {
    $schema:
      "https://static.modelcontextprotocol.io/schemas/mcp-server-card/v1.json",
    version: "1.0",
    protocolVersion: "2025-06-18",
    serverInfo: {
      name: "blogbat",
      version: "1.0.0",
    },
    documentationUrl: `${siteUrl}/docs`,
    transport: {
      type: "streamable-http",
      endpoint: "/api/v1/mcp",
    },
    capabilities: {
      tools: {
        listChanged: false,
      },
    },
    authentication: {
      required: true,
      schemes: ["bearer"],
    },
  } as const;
}

export function buildAgentCard(siteUrl: string) {
  const skills: AgentCardSkill[] = [
    {
      id: "list-public-articles",
      name: "List public articles",
      description:
        "Read paginated summaries of published BlogBat articles, optionally filtered by category or tag.",
      tags: ["blog", "articles", "discovery", "seo"],
      examples: [
        "List the newest BlogBat articles.",
        "Find published articles in the website tips category.",
      ],
      inputModes: ["text/plain", "application/json"],
      outputModes: ["application/json"],
    },
    {
      id: "read-public-article",
      name: "Read a public article",
      description:
        "Fetch the full read-only payload for a published article by slug.",
      tags: ["blog", "article", "content"],
      examples: ["Read the published article with slug low-cost-seo-packages."],
      inputModes: ["text/plain", "application/json"],
      outputModes: ["application/json", "text/markdown"],
    },
    {
      id: "search-public-articles",
      name: "Search public articles",
      description:
        "Search recent published BlogBat articles by title, body, excerpt, tags, and keywords.",
      tags: ["blog", "search", "articles"],
      examples: ["Search BlogBat for articles about local SEO."],
      inputModes: ["text/plain", "application/json"],
      outputModes: ["application/json"],
    },
  ];

  return {
    protocolVersion: "0.3.0",
    name: "BlogBat Public Content Agent",
    description:
      "Read-only machine interface for discovering, searching, and consuming published BlogBat content.",
    url: `${siteUrl}/api/v1/public/articles`,
    preferredTransport: "HTTP+JSON",
    additionalInterfaces: [
      {
        url: `${siteUrl}/api/v1/public/articles`,
        transport: "HTTP+JSON",
      },
      {
        url: `${siteUrl}/api/search`,
        transport: "HTTP+JSON",
      },
    ],
    provider: {
      organization: "BlogBat",
      url: "https://blogbat.com",
    },
    version: "1.0.0",
    documentationUrl: `${siteUrl}/docs/api`,
    capabilities: {
      streaming: false,
      pushNotifications: false,
      stateTransitionHistory: false,
    },
    securitySchemes: {},
    security: [],
    defaultInputModes: ["text/plain", "application/json"],
    defaultOutputModes: ["application/json", "text/markdown"],
    skills,
    supportsAuthenticatedExtendedCard: false,
  } as const;
}

const BLOGBAT_DISCOVERY_SKILL_PATH =
  "/.well-known/agent-skills/blogbat-discovery/SKILL.md";

export function getBlogBatDiscoverySkillMarkdown(siteUrl: string) {
  return `---
name: blogbat-discovery
description: Find and consume BlogBat public content, docs, and discovery metadata.
---

# BlogBat Discovery

Use this skill when you need published BlogBat content, documentation, or discovery endpoints.

## Public Resources

- Homepage: ${siteUrl}/
- Blog index: ${siteUrl}/blog
- Documentation: ${siteUrl}/docs
- RSS feed: ${siteUrl}/api/feed
- LLM index: ${siteUrl}/llms.txt
- LLM full archive: ${siteUrl}/llms-full.txt
- LLM article URL index: ${siteUrl}/llms-articles.txt
- Sitemap: ${siteUrl}/sitemap.xml
- Robots: ${siteUrl}/robots.txt

## Agent Access

- Use the sitemap and robots files for canonical URL discovery.
- Use the API catalog at ${siteUrl}/.well-known/api-catalog for public JSON endpoint discovery.
- Use the MCP server card at ${siteUrl}/.well-known/mcp/server-card.json for MCP discovery.
- Use the agent card at ${siteUrl}/.well-known/agent-card.json for public content capabilities.
- Request \`Accept: text/markdown\` or fetch \`/index.md\` for the homepage markdown representation.

## Auth Notes

- Public site content is readable without auth.
- The MCP endpoint at ${siteUrl}/api/v1/mcp requires a bearer token.
- Do not assume dashboard or other \`/api/v1/*\` routes are public.
`;
}

export function buildAgentSkillsIndex(siteUrl: string) {
  const skillMarkdown = getBlogBatDiscoverySkillMarkdown(siteUrl);
  const digest = createHash("sha256")
    .update(skillMarkdown, "utf8")
    .digest("hex");
  const skills: AgentSkill[] = [
    {
      name: "blogbat-discovery",
      type: "skill-md",
      description:
        "Find and consume BlogBat public content, docs, and discovery metadata.",
      url: BLOGBAT_DISCOVERY_SKILL_PATH,
      digest: `sha256:${digest}`,
    },
  ];

  return {
    $schema: "https://schemas.agentskills.io/discovery/0.2.0/schema.json",
    skills,
  } as const;
}
