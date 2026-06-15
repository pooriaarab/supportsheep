/**
 * MCP Server Factory
 *
 * Creates and configures the Model Context Protocol server with all blog tools.
 * Used by the /api/v1/mcp route handler.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerArticleTools } from "./tools/articles";
import { registerCategoryTools } from "./tools/categories";
import { registerMediaTools } from "./tools/media";
import { registerGenerationTools } from "./tools/generation";
import { registerSeoTools } from "./tools/seo";
import { registerConfigTools } from "./tools/config";
import { registerContextTagTools } from "./tools/context-tags";
import { registerWritingSkillTools } from "./tools/writing-skills";
import { registerInterviewTools } from "./tools/interviews";
import type { McpToolContext } from "./tools/context";

export function createMcpServer(ctx: McpToolContext): McpServer {
  const server = new McpServer({
    name: "supportsheep",
    version: "1.0.0",
  });

  registerArticleTools(server, ctx);
  registerCategoryTools(server, ctx);
  registerMediaTools(server, ctx);
  registerGenerationTools(server, ctx);
  registerSeoTools(server, ctx);
  registerConfigTools(server, ctx);
  registerContextTagTools(server, ctx);
  registerWritingSkillTools(server, ctx);
  registerInterviewTools(server, ctx);

  return server;
}
