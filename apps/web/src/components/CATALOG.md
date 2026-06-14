# Component Catalog

> This catalog helps developers and AI agents find the right component.
> It is the single source of truth for component discovery.

## Decision Tree: Which Component Do I Use?

### Need a button?

- Standard action --> `Button` from `@repo/ui/primitives/button`
- With loading spinner --> `LoadingButton` from `@repo/ui/composites/loading-button`
- Icon-only button --> `Button` with `size="icon"` from `@repo/ui/primitives/button`
- AI assist trigger --> `AiAssistButton` from `@repo/ui/composites/ai-assist-button`

### Need a modal/dialog?

- Form in a dialog --> `FormDialog` from `@repo/ui/composites/form-dialog`
- Destructive confirmation --> `ConfirmDialog` from `@repo/ui/composites/confirm-dialog`
- Custom dialog --> `Dialog` from `@repo/ui/primitives/dialog`
- Responsive (desktop: dialog, mobile: bottom sheet) --> `ResponsiveDialog` from `@repo/ui/composites/responsive-dialog`
- Slide-out panel --> `Sheet` from `@repo/ui/primitives/sheet`
- Detail side panel --> `DetailPanel` from `@/components/ui/layout/detail-panel`

### Need an empty state?

- Any empty state with icon + title + description --> `EmptyState` from `@repo/ui/composites/empty-state`
- With optional CTA button --> pass `ctaLabel` + `ctaOnClick` or `ctaHref`

### Need a status indicator?

- Status dot + label (active/paused/error/idle) --> `StatusBadge` from `@repo/ui/composites/status-badge`
- Visual status on avatar (pulse, shake, zzz, grayscale) --> `StatusOverlay` from `@repo/ui/composites/status-overlay`
- Generic label badge --> `Badge` from `@repo/ui/primitives/badge`

### Need a form field?

- Label + input + error message --> `FormField` from `@repo/ui/composites/form-field`
- Standalone text input --> `Input` from `@repo/ui/primitives/input`
- Multi-line text --> `Textarea` from `@repo/ui/primitives/textarea`
- Dropdown select --> `Select` from `@repo/ui/primitives/select`
- Searchable select --> `ComboboxSelect` from `@repo/ui/composites/combobox-select`
- Checkbox --> `Checkbox` from `@repo/ui/primitives/checkbox`
- Toggle switch --> `Switch` from `@repo/ui/primitives/switch`

### Need a data table?

- Full featured (sort, filter, virtual scroll, column resize) --> `DataTable` from `@/components/ui/data-display/data-table`
- Simple static table --> `Table` from `@repo/ui/primitives/table`

### Need a page wrapper?

- Standard page with breadcrumbs --> `PageShell` from `@/components/ui/layout/page-shell`
- Page header with breadcrumbs + actions --> `PageHeader` from `@/components/ui/layout/page-header`
- Tabbed detail page with back link --> `DetailLayout` from `@/components/ui/layout/detail-layout`
- Slide-out detail panel --> `DetailPanel` from `@/components/ui/layout/detail-panel`

### Need a tooltip?

- Icon + tooltip combo for info/help --> `InfoTooltip` from `@repo/ui/composites/info-tooltip`
- Custom tooltip on any element --> `Tooltip` from `@repo/ui/primitives/tooltip`

### Need a search input?

- Expandable search (icon that expands to input) --> `ExpandableSearch` from `@repo/ui/composites/expandable-search`

### Need filter UI?

- Filter chip display with remove buttons --> `FilterChips` from `@repo/ui/composites/filter-chips`
- Filter dropdown menu --> `TableFilter` from `@repo/ui/composites/table-filter`
- Checkbox filter option --> `FilterOption` from `@repo/ui/composites/filter-option`

### Need a display settings popover?

- View mode + grouping + ordering + properties --> `DisplayPopover` from `@repo/ui/composites/display-popover`

### Need a character counter?

- Shows count at 80%+ capacity, warns at 90%+ --> `CharacterCounter` from `@repo/ui/composites/character-counter`

### Need autosave feedback?

- Saving/saved/error indicator with retry --> `AutosaveIndicator` from `@repo/ui/composites/autosave-indicator`

### Need a collapsible list?

- Show N rows of badges then "+N more" --> `CollapsibleBadgeList` from `@repo/ui/composites/collapsible-badge-list`

### Need bulk actions?

- Bottom floating bar for multi-select actions --> `BottomBulkActionsBar` from `@repo/ui/composites/bottom-bulk-actions-bar`

### Need a dropdown/context menu in the sidebar?

- Sidebar dropdown menu --> `SidebarDropdownMenuContent` + `SidebarDropdownMenuItem` from `@repo/ui/composites/sidebar-menu`
- Sidebar context menu --> `SidebarContextMenuContent` + `SidebarContextMenuItem` from `@repo/ui/composites/sidebar-menu`
- Regular (non-sidebar) menus --> `DropdownMenu` / `ContextMenu` from `@repo/ui/primitives/`

### Need a sticky form footer?

- Save/cancel bar fixed at bottom --> `StickyFormFooter` from `@repo/ui/composites/sticky-form-footer`

---

## Quick Reference

| Need                    | Component                                               | Import Path                                   |
| ----------------------- | ------------------------------------------------------- | --------------------------------------------- |
| Button                  | `Button`                                                | `@repo/ui/primitives/button`                  |
| Loading button          | `LoadingButton`                                         | `@repo/ui/composites/loading-button`          |
| AI assist button        | `AiAssistButton`                                        | `@repo/ui/composites/ai-assist-button`        |
| Input                   | `Input`                                                 | `@repo/ui/primitives/input`                   |
| Textarea                | `Textarea`                                              | `@repo/ui/primitives/textarea`                |
| Label                   | `Label`                                                 | `@repo/ui/primitives/label`                   |
| Select                  | `Select`                                                | `@repo/ui/primitives/select`                  |
| Combobox select         | `ComboboxSelect`                                        | `@repo/ui/composites/combobox-select`         |
| Checkbox                | `Checkbox`                                              | `@repo/ui/primitives/checkbox`                |
| Switch                  | `Switch`                                                | `@repo/ui/primitives/switch`                  |
| Form field              | `FormField`                                             | `@repo/ui/composites/form-field`              |
| Form dialog             | `FormDialog`                                            | `@repo/ui/composites/form-dialog`             |
| Dialog                  | `Dialog`                                                | `@repo/ui/primitives/dialog`                  |
| Alert dialog            | `AlertDialog`                                           | `@repo/ui/primitives/alert-dialog`            |
| Confirm dialog          | `ConfirmDialog`                                         | `@repo/ui/composites/confirm-dialog`          |
| Responsive dialog       | `ResponsiveDialog`                                      | `@repo/ui/composites/responsive-dialog`       |
| Sheet                   | `Sheet`                                                 | `@repo/ui/primitives/sheet`                   |
| Empty state             | `EmptyState`                                            | `@repo/ui/composites/empty-state`             |
| Status badge            | `StatusBadge`                                           | `@repo/ui/composites/status-badge`            |
| Status overlay          | `StatusOverlay`                                         | `@repo/ui/composites/status-overlay`          |
| Generic badge           | `Badge`                                                 | `@repo/ui/primitives/badge`                   |
| Card                    | `Card`                                                  | `@repo/ui/primitives/card`                    |
| Tooltip                 | `Tooltip`                                               | `@repo/ui/primitives/tooltip`                 |
| Info tooltip            | `InfoTooltip`                                           | `@repo/ui/composites/info-tooltip`            |
| Dropdown menu           | `DropdownMenu`                                          | `@repo/ui/primitives/dropdown-menu`           |
| Context menu            | `ContextMenu`                                           | `@repo/ui/primitives/context-menu`            |
| Sidebar menu (dropdown) | `SidebarDropdownMenuContent`, `SidebarDropdownMenuItem` | `@repo/ui/composites/sidebar-menu`            |
| Sidebar menu (context)  | `SidebarContextMenuContent`, `SidebarContextMenuItem`   | `@repo/ui/composites/sidebar-menu`            |
| Command palette         | `Command`                                               | `@repo/ui/primitives/command`                 |
| Popover                 | `Popover`                                               | `@repo/ui/primitives/popover`                 |
| Tabs                    | `Tabs`                                                  | `@repo/ui/primitives/tabs`                    |
| Alert                   | `Alert`                                                 | `@repo/ui/primitives/alert`                   |
| Skeleton                | `Skeleton`                                              | `@repo/ui/primitives/skeleton`                |
| Separator               | `Separator`                                             | `@repo/ui/primitives/separator`               |
| Breadcrumb              | `Breadcrumb`                                            | `@repo/ui/primitives/breadcrumb`              |
| Collapsible             | `Collapsible`                                           | `@repo/ui/primitives/collapsible`             |
| Resizable panels        | `ResizablePanelGroup`                                   | `@repo/ui/primitives/resizable`               |
| Editor toolbar          | `EditorToolbar`                                         | `@repo/ui/primitives/editor-toolbar`          |
| File tree               | `FileTree`                                              | `@repo/ui/primitives/file-tree`               |
| Data table              | `DataTable`                                             | `@/components/ui/data-display/data-table`     |
| Simple table            | `Table`                                                 | `@repo/ui/primitives/table`                   |
| Page shell              | `PageShell`                                             | `@/components/ui/layout/page-shell`           |
| Page header             | `PageHeader`                                            | `@/components/ui/layout/page-header`          |
| Detail layout           | `DetailLayout`                                          | `@/components/ui/layout/detail-layout`        |
| Detail panel            | `DetailPanel`                                           | `@/components/ui/layout/detail-panel`         |
| Expandable search       | `ExpandableSearch`                                      | `@repo/ui/composites/expandable-search`       |
| Filter chips            | `FilterChips`                                           | `@repo/ui/composites/filter-chips`            |
| Filter option           | `FilterOption`                                          | `@repo/ui/composites/filter-option`           |
| Table filter            | `TableFilter`                                           | `@repo/ui/composites/table-filter`            |
| Display popover         | `DisplayPopover`                                        | `@repo/ui/composites/display-popover`         |
| Character counter       | `CharacterCounter`                                      | `@repo/ui/composites/character-counter`       |
| Autosave indicator      | `AutosaveIndicator`                                     | `@repo/ui/composites/autosave-indicator`      |
| Collapsible badge list  | `CollapsibleBadgeList`                                  | `@repo/ui/composites/collapsible-badge-list`  |
| Bulk actions bar        | `BottomBulkActionsBar`                                  | `@repo/ui/composites/bottom-bulk-actions-bar` |
| Sticky form footer      | `StickyFormFooter`                                      | `@repo/ui/composites/sticky-form-footer`      |
| Mention textarea        | `MentionTextarea`                                       | `@repo/ui/composites/mention-textarea`        |
| Budget reached dialog   | `BudgetReachedDialog`                                   | `@repo/ui/composites/budget-reached-dialog`   |
| Level ring              | `LevelRing`                                             | `@repo/ui/primitives/level-ring`              |

---

## Layer Architecture

```
ui/primitives/     -->  ui/composites/     -->  ui/data-display/  -->  ui/layout/
(shadcn base)          (built from prims)      (tables, stats)       (page structure)
                                                                            ^
                                                                       features/*
                                                                       (business logic)
                                                                            ^
                                                                        app/pages
```

### primitives/ (Layer 1) -- `@repo/ui`

- shadcn/ui base components + lightweight visual primitives
- Shared via `@repo/ui/primitives/*` from `packages/ui/`
- Zero business logic, zero API calls
- Import ONLY external packages (radix-ui, lucide-react, class-variance-authority)
- Never import from composites/, data-display/, layout/, or features/
- Components: `AlertDialog`, `Alert`, `Badge`, `Breadcrumb`, `Button`, `Card`, `Checkbox`, `Collapsible`, `Command`, `ContextMenu`, `Dialog`, `DropdownMenu`, `EditorToolbar`, `FileTree`, `Input`, `Label`, `LevelRing`, `Popover`, `Resizable`, `Select`, `Separator`, `Sheet`, `Skeleton`, `Switch`, `Table`, `Tabs`, `Textarea`, `Tooltip`

### composites/ (Layer 2) -- `@repo/ui`

- Built from primitives, still zero business logic, zero API calls
- May import from primitives/ only
- Components: `AiAssistButton`, `AutosaveIndicator`, `BottomBulkActionsBar`, `BudgetReachedDialog`, `CharacterCounter`, `CollapsibleBadgeList`, `ComboboxSelect`, `ConfirmDialog`, `DisplayPopover`, `EmptyState`, `ExpandableSearch`, `FilterChips`, `FilterOption`, `FormDialog`, `FormField`, `InfoTooltip`, `LoadingButton`, `MentionTextarea`, `ResponsiveDialog`, `SidebarMenu`, `StatusBadge`, `StatusOverlay`, `StickyFormFooter`, `TableFilter`

### data-display/ (Layer 3)

- Tables, stats, charts
- May import from primitives/ and composites/
- Zero business logic
- Components: `DataTable` (full-featured, virtualized, with sub-components)

### layout/ (Layer 4)

- Page structure components
- May import from any ui/ sublayer
- Zero business logic
- Components: `PageShell`, `PageHeader`, `DetailLayout`, `DetailPanel`

### features/ (Consumers, outside ui/)

- Feature-specific components (auth, settings, landing, etc.)
- May import from any ui/ layer and from hooks/
- Contains business logic, API calls, mutations
- NEVER imported by ui/ components

---

## Dependency Rules

| Layer              | Can import from                                    |
| ------------------ | -------------------------------------------------- |
| `ui/primitives/`   | External packages only (radix-ui, lucide, cva, cn) |
| `ui/composites/`   | `ui/primitives/`                                   |
| `ui/data-display/` | `ui/primitives/`, `ui/composites/`                 |
| `ui/layout/`       | Any `ui/*` sublayer                                |
| `features/*`       | Any `ui/*` layer, `hooks/`, `lib/`                 |
| `app/` pages       | `features/*`, `ui/*`, `hooks/`, `lib/`             |

**Critical rule:** `ui/` NEVER imports from `features/`. Data flows down only.

---

## Icon Size Hierarchy

Standard icon sizes for consistency across the app:

| Context                                         | Size     | Class             |
| ----------------------------------------------- | -------- | ----------------- |
| Inline status dots                              | 8px      | `h-2 w-2`         |
| Tiny metadata (pins, chevrons in compact lists) | 10px     | `h-2.5 w-2.5`     |
| Compact indicators (status, drag handles)       | 12px     | `h-3 w-3`         |
| **Menu item icons** (dropdown, context)         | **14px** | **`h-3.5 w-3.5`** |
| Standard button/header icons                    | 16px     | `h-4 w-4`         |
| Large action buttons                            | 20px     | `h-5 w-5`         |

**Menu items** (DropdownMenuItem, ContextMenuItem): Always use `h-3.5 w-3.5` for icons with `mr-2` gap.
**Sidebar menus**: Use `SidebarDropdownMenuItem` / `SidebarContextMenuItem` composites which enforce sidebar-consistent font size and hover styles.

---

## Color Tokens (Never Hardcode!)

Always use semantic tokens. They handle light/dark mode automatically via CSS variables.

| Instead of                            | Use                                          |
| ------------------------------------- | -------------------------------------------- |
| `text-blue-600` / `text-blue-500`     | `text-primary` or `text-info`                |
| `text-blue-400` (dark mode)           | `text-info` (handles both modes)             |
| `text-red-600` / `text-red-500`       | `text-error` or `text-destructive`           |
| `text-green-600` / `text-green-500`   | `text-success`                               |
| `text-yellow-600` / `text-amber-600`  | `text-warning`                               |
| `text-gray-500` / `text-gray-400`     | `text-muted-foreground`                      |
| `text-gray-900`                       | `text-foreground`                            |
| `bg-blue-50` / `bg-blue-100`          | `bg-info-subtle` or `bg-accent`              |
| `bg-red-50` / `bg-red-100`            | `bg-error-subtle` or `bg-destructive/10`     |
| `bg-green-50` / `bg-green-100`        | `bg-success-subtle`                          |
| `bg-yellow-50` / `bg-amber-50`        | `bg-warning-subtle`                          |
| `bg-gray-100` / `bg-gray-50`          | `bg-muted`                                   |
| `bg-white`                            | `bg-background` or `bg-card`                 |
| `border-gray-200` / `border-gray-300` | `border-border`                              |
| `border-blue-200`                     | `border-info/30` or `border-accent`          |
| `border-red-200`                      | `border-error/30` or `border-destructive/30` |
| `ring-blue-500`                       | `ring-ring`                                  |

---

## Naming Conventions

| Pattern                | Convention                                    | Example                                    |
| ---------------------- | --------------------------------------------- | ------------------------------------------ |
| Modal for forms        | `*Dialog`                                     | `CreateItemDialog`                         |
| Modal for confirmation | `ConfirmDialog` (use the composite)           | `ConfirmDialog` with variant="destructive" |
| Slide-out panels       | `*Sheet` or `DetailPanel`                     | `SettingsSheet`                            |
| Status indicators      | `StatusBadge` (use the composite)             | `StatusBadge status="active"`              |
| Data containers        | `*Card`                                       | `StatCard`                                 |
| Page wrappers          | `*Page`, `*Layout`, or `PageShell`            | `DashboardLayout`                          |
| List items             | `*Item` or `*Row`                             | `UserListItem`                             |
| Feature components     | Grouped by feature in `components/{feature}/` | `settings/SettingsForm.tsx`                |

---

## When to Create a New Component vs. Reuse Existing

**Create a new component when:**

- The pattern appears 3+ times across different features
- The component is purely presentational (no API logic)
- It composes existing primitives in a reusable way

**Reuse an existing component when:**

- A component in the catalog already handles your use case
- You can achieve the desired result by passing different props
- The existing component supports the variant you need

**Where to put new components:**

- Pure UI, composes primitives --> `packages/ui/src/composites/`
- Table/chart/stat display --> `ui/data-display/`
- Page structure --> `ui/layout/`
- Feature-specific with business logic --> `components/{feature}/`
- Shared across features with business logic --> `components/shared/`
