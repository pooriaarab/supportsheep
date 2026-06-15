# supportsheep Development Guide

**supportsheep** (`supportsheep`) is the open-source blog platform at [supportsheep.com](https://supportsheep.com).

## Modular Rules
These detailed rules are loaded based on context. Read the relevant rule file when working in that area:

- @.claude/rules/api.md - API routes, createApiHandler, input validation
- @.claude/rules/database.md - Firestore patterns, collections, lazy initialization
- @.claude/rules/frontend.md - React components, design system, Tailwind, Next.js
- @.claude/rules/testing.md - Vitest, Playwright, CI/CD, manual testing
- @.claude/rules/security.md - Authentication, authorization, secrets management
- @.claude/rules/git-safety.md - Safe git operations, preventing data loss

## SEO/GEO/AEO Skills
Search, AI-search, and structured-data skills live under `.claude/skills/` (vendored from [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills)). Invoke with the Skill tool or a `/<name>` slash command:

- `seo-audit` - Audit, review, or diagnose traditional SEO issues (technical, on-page, content, CWV)
- `ai-seo` - Optimize content for AI search (AEO, GEO, LLMO, AI Overviews, ChatGPT/Perplexity/Claude citations)
- `schema-markup` - Add, fix, or optimize JSON-LD / schema.org structured data for rich results
- `programmatic-seo` - Build targeted SEO landing pages at scale from datasets
- `site-architecture` - Page hierarchy, navigation design, URL structure, internal linking
- `competitor-alternatives` - Build "alternatives to X" and comparison pages that rank

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Package Manager**: bun
- **Monorepo**: Turborepo with bun workspaces
- **Language**: TypeScript (strict mode)
- **UI**: React 19 functional components
- **Styling**: Tailwind CSS v4 with shadcn/ui components
- **Database**: Firebase Firestore (project: your-firebase-project-id)
- **Auth**: Firebase Auth (passwordless, admin-only)
- **Storage**: Firebase Storage (media uploads)
- **Backend**: Firebase Cloud Functions (v2)
- **AI**: Multi-provider (Anthropic Claude, OpenAI GPT, Google Gemini) via Vercel AI SDK
- **Editor**: TipTap (rich text with SEO sidebar)
- **MCP**: Model Context Protocol server at `/api/v1/mcp` (40 tools)
- **State**: TanStack Query (server state), useState (local state)
- **Tables**: TanStack Table + TanStack Virtual (virtualized DataTable)
- **Charts**: Recharts (dashboard analytics)
- **Hosting**: Netlify (supportsheep.com)
- **CI/CD**: GitHub Actions

> **Note**: This project is fully committed to **Firebase + Netlify**. All auth, database,
> and hosting use Firebase/Netlify -- there are no abstraction layers for swapping providers.

## Project Structure

```
apps/web/                       # Main Next.js application
  src/
    app/                        # Next.js App Router pages
      api/v1/                   # API routes (versioned)
        articles/               # CRUD for blog articles
        categories/             # CRUD for categories
        media/                  # Media file management
        generate/               # AI content generation (keyword, bulk, content-plan)
        seo/                    # SEO tools (internal links, sitemaps, suggest-links)
        config/                 # Blog configuration
        writing-skills/         # AI writing skills pipeline
        context-tags/           # Generation context/tone presets
        mcp/                    # MCP server endpoint (Bearer token auth)
        users/                  # User management
        api-keys/               # API key management
        auth/                   # Login/logout/session
      (dashboard)/              # Dashboard route group (authed)
        dashboard/              # Blog analytics dashboard
        posts/                  # Article editor and list
        categories/             # Category management
        media/                  # Media library
        generate/               # AI generation UIs
        writing/                # Writing skills and context tags
        seo/                    # SEO tools and analytics
        settings/               # App settings
        search/                 # Global search
      (public)/                 # Public blog pages
      login/                    # Login page
    components/                 # React components
      ui/                       # Design system layers
        primitives/             # shadcn/ui base components
        composites/             # Composed from primitives
        data-display/           # Tables, stats
        layout/                 # Page structure
      auth/                     # Auth feature components
      posts/                    # Post editor components
      settings/                 # Settings feature components
      shared/                   # Cross-feature shared components
      public/                   # Public blog page components
    lib/                        # Utilities, API clients, Firebase setup
      ai/                       # AI provider config and generation
      auth/                     # Auth utilities (session, middleware)
      db/                       # Firebase admin + client setup
      generation/               # Article generation pipeline
      mcp/                      # MCP server and tools
        tools/                  # Tool definitions (articles, categories, media, generation, seo, config)
    hooks/                      # React hooks

  functions/                    # Firebase Cloud Functions

packages/ui/                    # Shared UI package (@repo/ui)
packages/types/                 # Shared TypeScript types (@repo/types)
packages/shared/                # Shared utilities (@repo/shared)

.github/workflows/              # CI/CD workflows
.claude/                        # Claude Code configuration
  rules/                        # Context-specific rules
```

## Build & Development Commands

```bash
# Development
bun run dev                      # Start Next.js dev server (port 3000)
bun run build                    # Build the project
bun run start                    # Start production server

# Quality checks
bun run lint                     # Run ESLint across all packages
bun run lint:fix                 # Auto-fix lint issues
bun run typecheck                # Run TypeScript type checking

# Testing
cd apps/web && bunx vitest       # Run unit tests (watch mode)
cd apps/web && bunx vitest run   # Run unit tests (single run)
bun run test                     # Run unit tests via Turborepo
bun run test:e2e                 # Run Playwright E2E tests

# Cloud Functions
cd apps/web/functions
npm install && npm run build     # Build functions
bunx tsc --noEmit                # Type-check functions
firebase deploy --only functions # Deploy functions

# Before committing (ALWAYS run these)
bun run lint && bun run typecheck
```

## Implementation Philosophy

**Minimal Code Principle**: Each implementation should use the **least amount of code possible** while:

- Strictly adhering to existing codebase patterns and conventions
- Maintaining the highest standards of software engineering
- **NEVER** implementing anything not explicitly required for the current task
- Avoiding premature optimization or over-engineering
- Following YAGNI (You Aren't Gonna Need It) principle

## Code Style

### General
- TypeScript with strict mode
- React functional components with hooks
- Tailwind CSS for styling (no inline styles)
- Prefer `async/await` over Promise chains
- Use proper error handling with try/catch
- **Never use raw `console.*` calls** -- use `createLogger` from `@/lib/logger`

### File Naming
- Component files: kebab-case (e.g., `user-card.tsx`)
- Utility files: kebab-case (e.g., `date-utils.ts`)
- Hook files: kebab-case with `use-` prefix (e.g., `use-users-query.ts`)

### Naming Conventions
- Names MUST describe what code does, not how it is implemented
- NEVER use implementation details in names
- NEVER use temporal/historical context in names

### Comments
- Comments should explain WHAT the code does or WHY it exists
- NEVER add comments about "improvements" or what code "used to be"
- Prefer self-documenting code over comments

### Imports
- Always use `@/` alias for internal imports
- Import from layer-specific paths (e.g., `@/components/ui/primitives/button`)
- Never use old flat import paths (e.g., `@/components/ui/button`)

## Key Architectural Patterns

### Firebase Lazy Initialization (CRITICAL)
Firebase admin instances MUST be lazy-init function calls, never top-level constants.

```typescript
// Good -- lazy init inside function body
export function someHandler() {
  const db = getAdminDb();
}

// Bad -- breaks cold starts
const db = getAdminDb(); // at module level
```

### Firestore Collections
All collections accessed via `collections.*()` from `@/lib/db`. Key collections:
- `articles` -- Blog articles (status, SEO metadata, versions)
- `categories` -- Blog categories with ordering
- `media` -- Uploaded media files
- `blogConfig` -- Site configuration (doc: `settings`)
- `apiKeys` -- API keys for MCP and external access
- `contextTags` -- AI generation context/tone presets
- `writingSkills` -- AI writing skill definitions
- `internalLinkRules` -- SEO internal link rules
- `sitemaps` -- Sitemap URL sets

All blog collections use `blogId: "default"` (future multi-tenant).

### API Routes with createApiHandler
All API routes use `createApiHandler` for consistent auth, validation, error handling, and audit logging.

```typescript
export const POST = createApiHandler({
  auth: "user",
  input: myZodSchema,
  audit: "create_article",
  handler: async ({ session, body }) => {
    return NextResponse.json({ id }, { status: 201 });
  },
});
```

### MCP Server
MCP server at `/api/v1/mcp` provides 40 tools across 8 categories:
- **Articles**: search, get, list, create, update, save draft, publish, schedule, unpublish, delete
- **Categories**: list, create, update, delete, reorder
- **Media**: list, get, update metadata, delete
- **Generation**: keyword, bulk, content plan generation, list/get content plans
- **SEO**: score analysis, internal link suggestions
- **Config**: read and update blog configuration, including public shell and article theme settings
- **Context tags**: list, get, create, update, delete
- **Writing skills**: list, get, create, update, delete, reorder, run pipeline

Authentication via Bearer token (API keys stored in Firestore).

### Component Hierarchy (strict 4-layer system)
```
ui/primitives/  -->  ui/composites/  -->  ui/data-display/  -->  ui/layout/
                                                                       ^
                                                                  features/*
```

- primitives/ imports only external packages
- composites/ imports only from primitives/
- data-display/ imports from primitives/ and composites/
- layout/ imports from any ui/ sublayer
- features/ import from any ui/ layer and hooks/
- ui/ NEVER imports from features/

### Semantic Color Tokens
Never use hardcoded Tailwind color classes. Always use semantic tokens:
```tsx
// Correct
<span className="text-error">Error</span>

// Incorrect
<span className="text-red-500">Error</span>
```

### No Direct useEffect
Direct `useEffect` is banned via ESLint. Use:
- `useMountEffect()` for mount-only effects
- Derived state / `useMemo` for computed values
- TanStack Query for data fetching
- Event handlers for user actions
- `key` props for resets

## Commit Standards

- **Format**: `<type>: <description>` or `<type>(<scope>): <description>`
- **Types**: feat, fix, refactor, docs, test, chore
- Keep concise, imperative mood

## Pull Request Standards

- Title: Clear description under 70 characters
- Description: Summary of changes, test plan
- Always rebase onto main before creating PR
