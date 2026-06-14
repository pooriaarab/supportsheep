# Security Rules

## Authentication
- All API routes must verify session via `createApiHandler` with `auth: "user"` or `auth: "admin"`
- Only use `auth: "none"` for health checks and truly public endpoints
- Never trust client-side session data -- always verify server-side
- Session cookies are HttpOnly, Secure, SameSite=Strict

## Authorization
- Verify user owns the resource before any read/update/delete
- Use `auth: "admin"` for admin-only operations
- Log authorization failures

## Input Validation
- Validate all input with Zod schemas via `createApiHandler({ input: schema })`
- Sanitize HTML content to prevent XSS (use `sanitizeArticleHtml` from `@/lib/sanitize/article-html`, backed by `sanitize-html`)
- Never interpolate user input into queries or commands
- Validate file uploads (type, size, content)

## Secrets Management
- Store secrets in environment variables (`.env.local`)
- Never commit `.env.local` files (gitignored)
- Never hardcode secrets, API keys, or credentials in source code
- Use `process.env` access in server-side code only

## Dangerous Operations
### Require Explicit Confirmation
- Deleting users or resources
- Bulk operations
- Changing user roles or permissions
- Any irreversible action

### Always Log
- Admin actions (deletions, role changes)
- Authentication events (login, logout, failed attempts)
- Authorization failures
- Use `logAuditEvent()` via createApiHandler's `audit` config

## Headers
- Set security headers via `security-headers.ts`
- Include correlation IDs on all responses
- Never expose internal error details to clients
