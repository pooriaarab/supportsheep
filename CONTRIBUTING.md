# Contributing to BlogBat

Thank you for your interest in contributing. Here is how to get involved.

## Workflow

1. **Fork** the repository and clone your fork.
2. **Create a branch** from `main` with a descriptive name:
   ```bash
   git checkout -b feat/my-new-feature
   ```
3. **Make your changes.** Keep commits focused and atomic.
4. **Run checks locally** before pushing:
   ```bash
   bun run lint && bun run typecheck && bun run test
   ```
5. **Open a pull request** against `main`. Fill in the PR template completely.

## Commit style

Use [Conventional Commits](https://www.conventionalcommits.org/):

| Prefix | When to use |
|--------|-------------|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `chore:` | Tooling, dependencies, config |
| `docs:` | Documentation only |
| `refactor:` | Code change with no behavior change |
| `test:` | Adding or updating tests |

Example: `feat: add Gemini provider to AI selector`

## CI

Every pull request runs:

- `lint` — ESLint
- `typecheck` — TypeScript strict check
- `test` — Vitest unit tests
- `build` — full Turborepo build

A **Claude review bot** and an **automated security review** also run on each PR. Address any findings before asking for a merge.

## Code of conduct

All contributors are expected to follow the [Code of Conduct](CODE_OF_CONDUCT.md). Be respectful and constructive.
