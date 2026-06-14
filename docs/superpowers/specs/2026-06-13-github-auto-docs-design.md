# Phase 2: GitHub Auto-Docs Integration (Ferndesk Parity)

## Overview
This phase adds Ferndesk's killer feature to Supportsheep: the ability to automatically draft support articles when a GitHub Pull Request is merged. 

## Architecture
1. **GitHub App / Webhook Integration:** Add an API endpoint (`/api/v1/integrations/github/webhook`) to receive `pull_request.closed` events.
2. **AI Drafting Pipeline:** When a PR is merged, pass the PR description and diff to Anthropic's Claude. Instruct Claude to write a user-facing support article summarizing the new feature or bug fix.
3. **Draft Storage:** Save the generated article to the D1 database as a "draft" (`status: "draft"`), notifying the tenant that a new article is ready for review.

## Implementation Steps
- [ ] 1. Define the D1 schema for GitHub integrations (to store the installation ID per tenant).
- [ ] 2. Create the GitHub Webhook API route.
- [ ] 3. Create the AI generation prompt pipeline.
- [ ] 4. Add the Admin UI for users to connect their GitHub repositories.