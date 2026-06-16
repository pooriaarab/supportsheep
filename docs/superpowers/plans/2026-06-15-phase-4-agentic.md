# Phase 4: Agentic Customer Support & MCP

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Evolve Supportsheep into a "world-class agentic support platform" by extending the MCP server to directly answer troubleshooting questions and implementing a self-healing "Feedback" ingestion loop.

**Architecture:**
1. **MCP Customer Support Tool:** Add a tool to the existing MCP server (`src/lib/mcp/tools/articles.ts` or a new file) that allows external agents (like Claude in an IDE) to query the knowledge base specifically for "troubleshooting" or "how-to" resolutions.
2. **Self-Healing Docs (Feedback API):** Wire up the `FeedbackWidget` to a real API route. When an article gets a "Thumbs Down" (unhelpful), the API should trigger a background task (or directly use `@ai-sdk/anthropic`) to evaluate the article, generate an "Improved Draft" version, and insert it into the database with a "needs_review" flag for the admin.

---

### Task 1: MCP Support Tool

- [ ] **Step 1: Create `src/lib/mcp/tools/support.ts`**
Register a new tool `troubleshoot_issue` that takes a `query`. It should search the published articles using the existing `listPublishedArticles` or `searchArticles` logic, summarize the findings using `generateText`, and return a synthesized response. (Or simply return the raw markdown of the top 3 articles so the client agent can read them).

- [ ] **Step 2: Register in `src/lib/mcp/server.ts`**
Import and register the new support tool.

### Task 2: Agentic Feedback Loop

- [ ] **Step 1: Create the API Route**
Create `apps/web/src/app/api/v1/articles/[slug]/feedback/route.ts`. It accepts a POST with `{ type: "helpful" | "unhelpful" }`.
- [ ] **Step 2: Self-Healing Logic**
If the feedback is `unhelpful`, fetch the article body. Use `@ai-sdk/anthropic` to generate a critique and an improved version of the article. Update the existing article's `draftBody` with this new version and set its status to "draft" or leave it published but save the draft.
- [ ] **Step 3: Connect the Widget**
Update `FeedbackWidget` to `fetch()` this new route.