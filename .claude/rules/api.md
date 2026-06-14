# API Rules

These rules apply to files in `apps/web/src/app/api/` and related utilities.

## Next.js API Routes

### Use createApiHandler
All API routes MUST use the `createApiHandler` wrapper from `@/lib/create-api-handler`. It provides:
- Correlation ID propagation (x-correlation-id header)
- Auth verification (session cookie or admin role check)
- Zod schema validation for request bodies
- Automatic audit logging on success
- Standardized error responses

```typescript
import { createApiHandler } from "@/lib/create-api-handler";
import { z } from "zod";

const inputSchema = z.object({
  name: z.string().min(1),
});

export const POST = createApiHandler({
  auth: "user",
  input: inputSchema,
  audit: "create_item",
  handler: async ({ session, body }) => {
    // body is typed as { name: string }
    return NextResponse.json({ id: "new-id" }, { status: 201 });
  },
});
```

### Auth Levels
- `"user"` (default) -- requires valid session cookie
- `"admin"` -- requires session + admin role check
- `"none"` -- no auth required (health checks, public endpoints)

### Input Validation
- Validate all request body/params with Zod schemas via `input` config
- Never trust client input -- validation happens automatically before the handler
- Return proper HTTP status codes (400 for bad input, 401 for unauthorized, 500 for server errors)

### Response Format
- Always return JSON via `NextResponse.json()`
- Include meaningful error messages
- Use consistent response shapes across endpoints

### Route Versioning
- All routes live under `/api/v1/`
- Group related routes (e.g., `/api/v1/users/`, `/api/v1/items/`)

## Error Handling

### Automatic Error Handling
`createApiHandler` catches all errors and returns standardized responses via `handleApiError()`. You do not need try/catch in most handlers.

### Custom Errors
For specific error cases, throw or return early:
```typescript
handler: async ({ session, body }) => {
  const item = await getItem(body.id);
  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }
  // ...
},
```

## Audit Logging
Pass an `audit` action name to automatically log successful operations:
```typescript
export const DELETE = createApiHandler({
  auth: "admin",
  audit: "delete_item",
  handler: async ({ session, body }) => {
    // On success, an audit event is logged with actorId, action, and IP
    return NextResponse.json({ success: true });
  },
});
```
