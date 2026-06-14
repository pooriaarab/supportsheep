# Testing Rules

## Before Committing (ALWAYS)
```bash
bun run lint && bun run typecheck
```

## Unit Tests (Vitest)
```bash
cd apps/web && bunx vitest           # Watch mode
cd apps/web && bunx vitest run       # Single run
bun run test                         # Via Turborepo
```

- Test files: `src/**/*.test.{ts,tsx}` or `src/**/*.spec.{ts,tsx}`
- Place tests next to source in `__tests__/` directories
- Use `describe` / `it` / `expect` from Vitest (globals enabled)
- Path alias `@/` resolves to `./src/` in tests
- `server-only` is stubbed automatically via vitest.config.ts

## E2E Tests (Playwright)
```bash
cd apps/web && bunx playwright test          # Run all
cd apps/web && bunx playwright test --ui     # With UI
cd apps/web && bunx playwright show-report   # View HTML report
```

- Test files: `apps/web/tests/*.spec.ts`
- Dev server starts automatically (configured in playwright.config.ts)
- Runs Chromium, Firefox, and WebKit
- Screenshots and video captured on failure
- CI retries failed tests twice with single worker

## What to Test
- **Unit tests**: utilities, hooks, pure logic, error handling
- **E2E tests**: critical user flows (login, navigation, CRUD operations)
- **Manual checks**: UI changes in light/dark modes, responsive layouts (mobile, tablet, desktop)

## CI/CD
- All checks run on push to main and PRs
- Jobs: lint, typecheck, test, e2e, build
- Never skip or bypass CI checks
- Fix failing checks before merging
