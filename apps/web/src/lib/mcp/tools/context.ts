/**
 * MCP Tool Context
 *
 * The per-request tenant scope resolved from the caller's API key. Every tool
 * closes over this and scopes its repo calls to `blogId` — never a hardcoded
 * default — so an agent's key only ever touches the blog it was issued for.
 */
export interface McpToolContext {
  /** The blog the API key is bound to. All repo calls scope to this. */
  blogId: string;
  /** The user who owns the API key. */
  ownerId: string;
}
