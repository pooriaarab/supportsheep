/**
 * MCP HTTP Transport Route
 *
 * Handles Model Context Protocol requests over Streamable HTTP.
 * Authenticates via Bearer token against API keys in Firestore.
 *
 * POST /api/v1/mcp - Handle MCP JSON-RPC messages
 * GET  /api/v1/mcp - SSE stream for server-initiated messages
 * DELETE /api/v1/mcp - Close session
 */

import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpServer } from "@/lib/mcp/server";
import { validateMcpToken } from "@/lib/mcp/auth";
import { createLogger } from "@/lib/logger";

const log = createLogger("api:mcp");

async function handleMcpRequest(request: Request): Promise<Response> {
  // Authenticate. The resolved auth context carries the blog the key is bound
  // to — every tool operates against THAT blog, never a hardcoded default.
  const authHeader = request.headers.get("authorization");
  const auth = await validateMcpToken(authHeader);

  if (!auth) {
    return new Response(
      JSON.stringify({
        error: "Unauthorized",
        message: "Invalid or missing API key",
      }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    const server = createMcpServer({
      blogId: auth.blogId,
      ownerId: auth.ownerId,
    });
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // Stateless mode
      enableJsonResponse: true,
    });

    await server.connect(transport);
    const response = await transport.handleRequest(request);
    return response;
  } catch (error) {
    log.error("MCP request failed", { error });
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function POST(request: Request): Promise<Response> {
  return handleMcpRequest(request);
}

export async function GET(request: Request): Promise<Response> {
  return handleMcpRequest(request);
}

export async function DELETE(request: Request): Promise<Response> {
  return handleMcpRequest(request);
}
