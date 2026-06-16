# Phase 3: Ferndesk Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Achieve full feature parity with Ferndesk by implementing the GitHub OAuth UI, integrating real AI logic into the Voice/Chat widgets, and creating an OpenAPI spec ingestion tool.

**Architecture:** We will build 3 separate features in parallel:
1.  **GitHub Connection UI:** Add a frontend component to `/settings/integrations` that allows users to link their GitHub repository (mock OAuth/App install link) and see their generated drafts.
2.  **Widget Customization & Real AI:** Update the `SupportChatWidget` to pass the knowledge base context to the `AiChatWidget`. Update `SupportVoiceWidget` to trigger a simulated or actual WebRTC voice session (based on existing LiveKit/Tavus/OpenAI code). Add `systemPrompt` and `greeting` fields to the `BlogConfig` support schema.
3.  **OpenAPI Spec Ingestion:** Create a new page under `/settings/import` to upload an OpenAPI spec, and an API route that parses it and generates drafted API documentation articles.

**Tech Stack:** Next.js (App Router), React, TailwindCSS, Drizzle ORM, `@ai-sdk/anthropic`.

---

### Task 1: GitHub Integration UI

**Goal:** Create a settings panel for connecting GitHub and viewing auto-docs status.

- [ ] **Step 1: Add GitHub Integration Panel**
Create or modify a component in `apps/web/src/app/(dashboard)/settings/integrations/github-panel.tsx`.
- [ ] **Step 2: Add Webhook Instructions**
Provide UI instructions for the user on how to configure the webhook in their GitHub repository (pointing to `https://api.supportsheep.com/api/v1/integrations/github/webhook`).

### Task 2: Widget Customization & AI Context

**Goal:** Let users customize their chat/voice widgets and hook up the context.

- [ ] **Step 1: Update Schema**
Modify `packages/types/src/index.ts` and `apps/web/src/lib/blog-config.ts` to add `systemPrompt: string` and `greeting: string` to the `support` configuration object.
- [ ] **Step 2: Update Settings UI**
Modify `apps/web/src/app/(dashboard)/settings/support/page.tsx` to include textareas for `systemPrompt` and `greeting`.
- [ ] **Step 3: Hook up AiChatWidget**
Ensure the `AiChatWidget` in `shell.tsx` receives the `systemPrompt` and `greeting` from the config and passes them to the AI chat endpoint.

### Task 3: OpenAPI Spec Ingestion

**Goal:** Allow users to upload an OpenAPI YAML/JSON file and draft articles from it.

- [ ] **Step 1: Create Import UI**
Create a new tab or section in `apps/web/src/app/(dashboard)/settings/import/openapi/page.tsx` with a file upload or text area for the OpenAPI spec.
- [ ] **Step 2: Create Ingestion API Route**
Create `apps/web/src/app/api/v1/import/openapi/route.ts` that takes the spec, extracts endpoints, and inserts drafted articles into the D1 database.
