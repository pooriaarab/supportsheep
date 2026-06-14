import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  buildAgentCard,
  buildAgentDiscoveryLinkHeader,
  buildAgentSkillsIndex,
  buildMcpServerCard,
  getSupportsheepDiscoverySkillMarkdown,
} from "@/lib/agent-discovery";
import { resolvePublicSiteUrl } from "@/lib/public-site";

describe("agent discovery builders", () => {
  it("builds an MCP server card tied to the resolved origin", () => {
    const siteUrl = resolvePublicSiteUrl();
    const card = buildMcpServerCard(siteUrl);

    expect(card.serverInfo?.name).toBe("blogbat");
    expect(card.transport?.endpoint).toBe("/api/v1/mcp");
    expect(card.authentication).toEqual({
      required: true,
      schemes: ["bearer"],
    });
  });

  it("builds an agent skills index with digest metadata", () => {
    const siteUrl = resolvePublicSiteUrl();
    const index = buildAgentSkillsIndex(siteUrl);
    const expectedDigest = createHash("sha256")
      .update(getSupportsheepDiscoverySkillMarkdown(siteUrl), "utf8")
      .digest("hex");

    expect(index.skills.length).toBeGreaterThan(0);
    expect(index.$schema).toBe(
      "https://schemas.agentskills.io/discovery/0.2.0/schema.json",
    );
    expect(index.skills[0].type).toBe("skill-md");
    expect(index.skills[0].url).toBe(
      "/.well-known/agent-skills/blogbat-discovery/SKILL.md",
    );
    expect(index.skills[0].digest).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(index.skills[0].digest).toBe(`sha256:${expectedDigest}`);
  });

  it("builds a public agent card for content discovery", () => {
    const siteUrl = resolvePublicSiteUrl();
    const card = buildAgentCard(siteUrl);

    expect(card.protocolVersion).toBe("0.3.0");
    expect(card.url).toBe(`${siteUrl}/api/v1/public/articles`);
    expect(card.preferredTransport).toBe("HTTP+JSON");
    expect(card.defaultInputModes).toContain("text/plain");
    expect(card.defaultOutputModes).toContain("application/json");
    expect(card.security).toEqual([]);
    expect(card.skills.map((skill) => skill.id)).toEqual(
      expect.arrayContaining([
        "list-public-articles",
        "read-public-article",
        "search-public-articles",
      ]),
    );
  });

  it("builds a sitewide Link header for agent discovery surfaces", () => {
    const header = buildAgentDiscoveryLinkHeader();

    expect(header).toContain('</llms.txt>; rel="llms"');
    expect(header).toContain(
      '</.well-known/agent-skills/index.json>; rel="agent-skills"',
    );
    expect(header).toContain(
      '</.well-known/mcp/server-card.json>; rel="mcp-server-card"',
    );
    expect(header).toContain(
      '</.well-known/agent-card.json>; rel="agent-card"',
    );
  });
});
