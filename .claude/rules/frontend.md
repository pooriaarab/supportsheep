# Frontend & React Rules

These rules apply to files in `apps/web/src/`.

## Design System

### Component Catalog
Before creating or choosing a component, check `apps/web/src/components/CATALOG.md`. It contains a decision tree, quick reference table, and import paths for all available components.

### Component Layers
Components are organized into a strict 4-layer hierarchy under `components/ui/`:
- `ui/primitives/` -- shadcn/ui base components (Button, Dialog, Input, etc.)
- `ui/composites/` -- Composed from primitives (ConfirmDialog, EmptyState, StatusBadge, etc.)
- `ui/data-display/` -- Tables, stats (DataTable)
- `ui/layout/` -- Page structure (PageShell, DetailLayout, etc.)

**Dependency rules (strict):**
- primitives/ imports only external packages -- never from composites/, layout/, or features/
- composites/ imports only from primitives/
- data-display/ imports from primitives/ and composites/
- layout/ imports from any ui/ sublayer
- features/ import from any ui/ layer and hooks/
- ui/ NEVER imports from features/ -- data flows down only

### Import Paths
Always import components using their layer-specific paths:
```tsx
// Correct
import { Button } from "@/components/ui/primitives/button";
import { ConfirmDialog } from "@/components/ui/composites/confirm-dialog";
import { DataTable } from "@/components/ui/data-display/data-table";
import { PageShell } from "@/components/ui/layout/page-shell";

// Also correct -- shared package primitives
import { Button } from "@repo/ui/primitives/button";

// Incorrect -- old flat import paths
import { Button } from "@/components/ui/button";
```

### No API Logic in ui/ Components
Components in `ui/` (primitives, composites, data-display, layout) must contain zero business logic:
- No `useMutation`, `useQuery`, or `fetch` calls
- No API endpoint URLs
- No toast notifications tied to API results
- Put API logic in custom hooks (`hooks/use-*.ts`) or feature components

### Semantic Color Tokens
Never use hardcoded Tailwind color classes. Always use semantic tokens:
```tsx
// Correct -- semantic tokens handle light/dark automatically
<span className="text-error">Error</span>
<div className="bg-muted">Subtle background</div>
<div className="border-border">Standard border</div>

// Incorrect -- hardcoded colors
<span className="text-red-500">Error</span>
<div className="bg-gray-100">Subtle background</div>
<div className="border-gray-200">Standard border</div>
```

Key mappings:
| Instead of | Use |
|-----------|-----|
| `text-blue-600` | `text-primary` or `text-info` |
| `text-red-500` | `text-error` or `text-destructive` |
| `text-green-500` | `text-success` |
| `text-yellow-600` | `text-warning` |
| `text-gray-500` | `text-muted-foreground` |
| `bg-gray-100` | `bg-muted` |
| `bg-white` | `bg-background` or `bg-card` |
| `border-gray-200` | `border-border` |

### Component Naming Conventions
| Pattern | Convention |
|---------|-----------|
| Modal with form | `*Dialog` (e.g., `CreateItemDialog`) |
| Destructive confirmation | Use `ConfirmDialog` with `variant="destructive"` |
| Slide-out panel | `*Sheet` or `DetailPanel` |
| Status indicator | Use `StatusBadge` |
| Page wrapper | Use `PageShell` or `DetailLayout` |

### Composites for Common Patterns
Use existing composites instead of building from scratch:
- **Confirmation dialogs** --> `ConfirmDialog` (not raw AlertDialog boilerplate)
- **Empty states** --> `EmptyState` (not custom div+icon+text layouts)
- **Status indicators** --> `StatusBadge` (not custom colored dots)
- **Responsive modals** --> `ResponsiveDialog` (not manual breakpoint detection)
- **Search inputs** --> `ExpandableSearch` (not custom expanding input)

### Data Tables (CRITICAL)
**NEVER build custom table/list UIs** when the shared `DataTable` component exists. Any page that displays a list of items with columns, sorting, or filtering MUST use `DataTable` from `@/components/ui/data-display/data-table`.

When building a page with tabular data:
1. **Check** if it uses `DataTable` -- if not, migrate before merging
2. **Use shared composites**: `ExpandableSearch`, `DisplayPopover`, `FilterChips`, `EmptyState`
3. **Never** use custom `<div>` lists with `.map()` for data that should be in a table

**Every DataTable page MUST include:**
- **DisplayPopover** in the toolbar -- with grouping, ordering, display properties, and default settings
- **Bulk select** -- `enableRowSelection` + `BottomBulkActionsBar` + `ConfirmDialog` for destructive actions

## React Component Rules

### Component Structure
1. Imports (sorted)
2. Types (if needed)
3. Component function
4. Hooks first, then derived state, then handlers, then render

### Hooks Rules
- Call hooks at the top level only
- Use custom hooks for reusable logic
- Name custom hooks with `use` prefix
- **Never use `useEffect` directly** -- banned via ESLint. Use `useMountEffect()` for mount-only effects, derived state/`useMemo` for computed values, TanStack Query for data fetching, event handlers for user actions, or `key` props for resets.

### State Management
- Use TanStack Query for server state (API calls)
- Use `useState` for local component state
- Avoid prop drilling -- use context when needed

## Tailwind CSS
- Mobile-first responsive design
- Use shadcn/ui components from `@/components/ui/primitives/`
- Follow class ordering: layout --> sizing --> spacing --> typography --> colors --> effects --> states
- Use semantic color tokens -- never hardcoded colors (see above)

## Next.js App Router
- Use `"use client"` directive only when needed (hooks, event handlers, browser APIs)
- Prefer Server Components by default
- Use `force-dynamic` for API routes that need fresh data
- Handle loading/error states with loading.tsx and error.tsx

## Error Handling
- Show user-friendly error messages
- Use toast notifications (sonner) for action feedback
- Log errors to console in development
