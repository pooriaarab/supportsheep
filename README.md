# supportsheep

An open-source, AI-assisted blog platform for writing, generating, editing, and publishing posts.

supportsheep is a full-featured blog platform where writers can draft and publish posts with AI assistance, apply SEO tooling, and serve a public blog — all from a single application. It supports multiple AI providers (Anthropic Claude, OpenAI, Google Gemini) and includes a rich-text editor, passwordless authentication, and an MCP server endpoint.

## Project status

supportsheep currently runs on **Firebase** (Firestore, Cloud Functions v2, Auth, Storage) hosted on **Netlify**. A migration to **Cloudflare** (Workers + D1) with **Better Auth** and full multi-tenancy is in progress. Public APIs and internal architecture may change during that transition.

## Tech stack

- **Monorepo:** Turborepo (bun workspaces)
- **Frontend:** Next.js 16 (App Router, React 19), TypeScript (strict), Tailwind v4, shadcn/ui
- **Editor:** TipTap rich-text editor
- **Backend:** Firebase (Firestore + Cloud Functions v2), Firebase Auth (passwordless magic links), Firebase Storage
- **Hosting:** Netlify
- **AI:** Multi-provider via Vercel AI SDK — Anthropic Claude, OpenAI, Google Gemini
- **MCP server:** `/api/v1/mcp`
- **Desktop:** Tauri wrapper (`apps/desktop`)

Monorepo layout:

```
apps/web        Next.js application
apps/desktop    Tauri desktop wrapper
packages/ui     Shared UI components
packages/types  Shared TypeScript types
packages/shared Shared utilities
```

## Getting started

**Prerequisites:** [bun](https://bun.sh) and Node.js 22+.

```bash
git clone https://github.com/pooriaarab/supportsheep.git
cd supportsheep
bun install
cp apps/web/.env.example apps/web/.env.local
# Fill in the values in apps/web/.env.local
bun run dev:next
```

Open [http://localhost:3000](http://localhost:3000).

## Testing

```bash
bun run lint          # ESLint
bun run typecheck     # TypeScript type-check
bun run test          # Vitest unit tests
bun run test:e2e      # Playwright end-to-end tests
```

## Configuration / self-hosting

All required environment variables are documented in [`apps/web/.env.example`](apps/web/.env.example). You will need:

- **Firebase project credentials** — create a Firebase project and copy the config values.
- **AI provider API keys** — supportsheep does not ship with shared keys. Each operator (or user) must supply their own keys for Anthropic, OpenAI, and/or Google Gemini.

Deployment currently targets Netlify (frontend) and Firebase (backend functions + database). See the env example for the full list of variables.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). PRs are automatically reviewed by a Claude review bot and an automated security review on every pull request.

## License

[MIT](LICENSE)
