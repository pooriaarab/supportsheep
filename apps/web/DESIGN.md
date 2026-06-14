# BlogBat Design System

BlogBat is the open-source blog platform at [blogbat.com](https://blogbat.com).
This document is the source of truth for the BlogBat brand and the design tokens
that drive the product UI.

## Brand story — the bat at dusk

The name is **BlogBat** ("blog" + "BAT"). The brand leans into a calm,
night-themed identity: a bat is nocturnal, quick, and navigates confidently in
the dark. That maps to a publishing tool that is fast, quietly capable, and
equally at home in light or dark mode.

The mark is a clean, geometric bat silhouette — two pointed ears, a rounded
head, and broad wings with a scalloped lower edge. It is tasteful and modern,
not cartoonish, and reads clearly down to favicon sizes.

## Logo

All logo assets live in `apps/web/public/`.

| Asset | File | Contents | Color behavior |
|-------|------|----------|----------------|
| Icon (standalone) | `logo.svg` | Bat mark only | `fill="currentColor"` — adapts to the surrounding text color |
| Header logo | `blogbat-header-logo.svg` | Bat icon + "BlogBat" wordmark | White fill — consumed via `next/image` on the dark header surface |
| Footer logo | `blogbat-footer-logo.svg` | Bat icon + "BlogBat" wordmark | White fill — consumed via `next/image` on the dark footer surface |
| Favicon | `favicon.svg` | Bat icon on a violet rounded square | Self-colored so it pops in browser tabs at any size |
| Favicon (raster) | `favicon.png` | 512×512 PNG of the favicon | Generated from `favicon.svg` |
| Apple touch icon | `apple-touch-icon.png` | 180×180 PNG of the favicon | Generated from `favicon.svg` |

### Usage rules

- The bat geometry is shared across every asset (a single path). Do not redraw
  it per-asset; scale `logo.svg`'s path.
- The standalone icon uses `currentColor` so it inherits text color. Use it
  inside buttons, inline chrome, or anywhere a single-color mark is needed.
- The header/footer wordmark logos are white because they sit on fixed dark
  brand surfaces. They are rendered through `next/image`, which strips CSS color
  context, so they carry their own fill.
- The favicon embeds the brand violet so it never depends on the tab background.
- Per-tenant blogs may override the header/footer logo via
  `config.publicAppearance.{header,footer}.logoUrl`; the BlogBat marks above are
  the defaults.

## Color palette

BlogBat's palette is a deep indigo/violet primary ("dusk") with a warm amber
accent (the bat-at-sunset highlight). All values are authored in OKLCH for
perceptually even light/dark pairs.

### Brand anchors

| Role | Hex (reference) | Notes |
|------|-----------------|-------|
| Primary / Dusk Violet | `#6D4AFF` | Brand primary, links, focus ring, favicon background |
| Primary (dark mode) | `#8F72FF` | Brightened so actions stay vivid on dark cards |
| Primary hover | `#5232D4` | Used via `bg-primary/90` |
| Accent / Dusk Amber | warm gold | Subtle warm highlight, paired sparingly with violet |
| Night background (dark) | `#141126` | The deep night surface |
| Brand surface (header/footer) | `#1D1133` / `#171325` | Fixed dark public chrome |

### Semantic token mapping

Tokens are defined in `apps/web/src/app/globals.css` under `:root` (light) and
`.dark` (dark) and exposed to Tailwind via the `@theme inline` block. **Always
use the semantic token — never a raw color.**

| Token | Light | Dark | Use |
|-------|-------|------|-----|
| `--background` / `bg-background` | near-white, faint violet | `#141126`-family | Page background |
| `--foreground` / `text-foreground` | near-black violet | near-white | Body text |
| `--card` / `bg-card` | white, faint violet | layered violet | Cards, popovers |
| `--primary` / `bg-primary` | dusk violet `#6D4AFF` | brighter violet | Primary actions, CTAs |
| `--primary-foreground` | white | night | Text on primary |
| `--secondary` / `bg-secondary` | pale violet | muted violet | Secondary surfaces, tags |
| `--muted` / `bg-muted` | pale violet-grey | muted violet | Subtle backgrounds |
| `--muted-foreground` | violet-grey | light violet-grey | Secondary text |
| `--accent` / `bg-accent` | warm amber tint | dim amber | Warm highlights, hover fills |
| `--border` / `border-border` | light violet | translucent violet | Standard borders |
| `--ring` / `ring-ring` | dusk violet | brighter violet | Focus rings |
| `--link` / `text-link` | dusk violet | brighter violet | Inline links |
| `--link-hover` | darker violet | lighter violet | Link hover |
| `--success` / `--warning` / `--error` / `--info` | status hues | status hues | Status (unchanged hues, brand-neutral) |
| `--destructive` | red | red | Destructive actions |

The neutrals carry a faint violet cast (OKLCH hue 285) so surfaces feel tied to
the primary rather than reading as cold grey.

### Accessibility

- Primary `#6D4AFF` on white and white on `#6D4AFF` both meet WCAG AA for
  UI/large text; `primary-foreground` is pure white/night for AAA on buttons.
- `muted-foreground` is tuned to stay AA against `background` and `card`.
- Status colors retain their conventional hues for recognizability.

## Typography

- **Product UI**: Geist Sans (`--font-geist-sans`), Geist Mono for code.
- **Public blog chrome**: IBM Plex Sans (`--font-ibm-plex-sans`).
- **Articles**: typography is theme-driven via `resolvePublicArticleTheme`
  (heading/body font classes per article theme).
- Headings (`h1`–`h4`) use `text-wrap: balance`; body `p` uses
  `text-wrap: pretty` to reduce orphans. Tabular numerals on data tables.

## Buttons (`packages/ui/src/primitives/button.tsx`)

The shadcn `Button` primitive is the only sanctioned button. States are
token-driven and consistent across variants:

| Variant | Rest | Hover | Active | Focus-visible |
|---------|------|-------|--------|---------------|
| `default` | `bg-primary` + `shadow-xs` | `bg-primary/90` | `bg-primary/80` | `ring-ring/50` 3px ring |
| `destructive` | `bg-destructive` + `shadow-xs` | `/90` | `/80` | destructive ring |
| `outline` | `border-border` + `bg-background` | `border-primary/40` + `bg-accent` | `bg-accent/80` | ring |
| `secondary` | `bg-secondary` | `/80` | `/70` | ring |
| `ghost` | transparent | `bg-accent` | `bg-accent/80` | ring |
| `link` | `text-primary` | underline + `text-link-hover` | — | ring |

- Press feedback: `active:scale-[0.97]` on all variants; disabled under
  `prefers-reduced-motion` (see `globals.css`).
- Focus is always a visible 3px ring (`focus-visible:ring-[3px]`) — never
  removed.

## Spacing & radius

- Radius scale from `--radius: 0.625rem`: `sm` (−4px) → `4xl` (+16px), exposed as
  `rounded-sm` … `rounded-4xl`.
- Shadows: `--shadow-subtle`, `--shadow-keystone`, `--shadow-floating`.
- Layout uses Tailwind's default spacing scale; public pages center on
  `max-w-6xl` with `px-4 sm:px-6` gutters.

## Dark mode

- Toggled by the `.dark` class (`@custom-variant dark`); `ThemeProvider` manages
  it and a `beforeInteractive` script applies cached theme CSS to prevent FOUC.
- Dark mode is the bat's home turf: deep violet-tinted surfaces layer up for
  depth, and the primary brightens (`#8F72FF`) so actions stay legible.
- Every token has a light and dark value — components must use tokens so they
  adapt automatically. Never hardcode a color in a component.
- Logos: the standalone `logo.svg` uses `currentColor` and adapts; the
  header/footer wordmarks are white on their fixed dark surfaces.
