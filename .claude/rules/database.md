# Database & Firestore Rules

These rules apply to Firestore operations in the Next.js app.

## Firestore Access Patterns

### Admin SDK (Server-Side)
- Use `getDb()` from `@/lib/db` for Firestore admin access
- Firebase admin instances MUST be lazy-init function calls, never top-level constants

```typescript
// Good -- lazy init inside function body
export function someHandler() {
  const db = getDb();
  // ...
}

// Bad -- breaks module loading and serverless cold starts
const db = getDb(); // at module level
```

### Why Lazy Init Matters
Top-level Firebase initialization runs at import time. In serverless environments (Next.js API routes, edge functions), this causes:
- Cold start failures when credentials are not yet available
- Module-level side effects that break tree shaking
- Initialization order bugs across modules

### Query Patterns
- Always scope queries with `.where()` -- never read entire collections
- Use pagination for large result sets (`.limit()` + `.startAfter()`)
- Prefer `.get()` for one-time reads, `.onSnapshot()` for real-time
- Use composite indexes for multi-field queries

```typescript
// Good -- scoped query with pagination
const snapshot = await db
  .collection("items")
  .where("ownerId", "==", userId)
  .orderBy("createdAt", "desc")
  .limit(25)
  .get();

// Bad -- reads entire collection
const snapshot = await db.collection("items").get();
```

### Write Patterns
- Use `FieldValue.serverTimestamp()` for timestamps
- Use batch writes for multiple related updates
- Verify ownership/permissions before writing
- Use transactions for atomic read-modify-write operations

```typescript
import { FieldValue } from "firebase-admin/firestore";

await db.collection("items").add({
  name: body.name,
  ownerId: session.uid,
  createdAt: FieldValue.serverTimestamp(),
  updatedAt: FieldValue.serverTimestamp(),
});
```

### Security
- Never expose raw Firestore documents to clients without filtering
- Always validate document ownership before updates/deletes
- Use security rules on the client SDK and admin SDK checks on the server
