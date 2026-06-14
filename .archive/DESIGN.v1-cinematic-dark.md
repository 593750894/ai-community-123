---
name: SeedLand · V
description: A premium, cinematic, hand-crafted community for AI video creators — dark by default, work-first, chrome second.
colors:
  background-light: "oklch(1 0 0)"
  background-dark: "oklch(0.16 0.02 255)"
  foreground-light: "oklch(0.145 0 0)"
  foreground-dark: "oklch(0.97 0.01 240)"
  card-light: "oklch(1 0 0)"
  card-dark: "oklch(0.21 0.025 255)"
  popover-light: "oklch(1 0 0)"
  popover-dark: "oklch(0.21 0.025 255)"
  primary-light: "oklch(0.205 0 0)"
  primary-dark: "oklch(0.78 0.16 220)"
  primary-foreground-light: "oklch(0.985 0 0)"
  primary-foreground-dark: "oklch(0.18 0.03 255)"
  secondary-light: "oklch(0.97 0 0)"
  secondary-dark: "oklch(0.27 0.03 255)"
  muted-light: "oklch(0.97 0 0)"
  muted-dark: "oklch(0.24 0.025 255)"
  muted-foreground-light: "oklch(0.556 0 0)"
  muted-foreground-dark: "oklch(0.68 0.02 240)"
  accent-light: "oklch(0.97 0 0)"
  accent-dark: "oklch(0.32 0.05 240)"
  border-light: "oklch(0.922 0 0)"
  border-dark: "oklch(1 0 0 / 8%)"
  input-light: "oklch(0.922 0 0)"
  input-dark: "oklch(1 0 0 / 12%)"
  ring-light: "oklch(0.708 0 0)"
  ring-dark: "oklch(0.7 0.16 220)"
  destructive-light: "oklch(0.577 0.245 27.325)"
  destructive-dark: "oklch(0.704 0.191 22.216)"
  accent-cyan: "oklch(0.78 0.16 220)"
  accent-violet: "oklch(0.7 0.2 295)"
  accent-pink: "oklch(0.78 0.18 350)"
  accent-amber: "oklch(0.82 0.15 75)"
  accent-emerald: "oklch(0.78 0.15 160)"
  brand-gradient-from-dark: "oklch(0.85 0.13 220)"
  brand-gradient-to-dark: "oklch(0.78 0.16 295)"
  brand-gradient-from-light: "oklch(0.5 0.16 220)"
  brand-gradient-to-light: "oklch(0.48 0.22 295)"
typography:
  display:
    fontFamily: "var(--font-sans)"
    fontSize: "clamp(1.875rem, 4vw, 3rem)"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "var(--font-sans)"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "var(--font-sans)"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.005em"
  body:
    fontFamily: "var(--font-sans)"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.7
    letterSpacing: "normal"
  meta:
    fontFamily: "var(--font-sans)"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "var(--font-sans)"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "0.08em"
  mono:
    fontFamily: "var(--font-system-mono)"
    fontSize: "0.85em"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  sm: "0.375rem"
  md: "0.5rem"
  lg: "0.625rem"
  xl: "0.875rem"
  2xl: "1.125rem"
  3xl: "1.375rem"
  4xl: "1.625rem"
  full: "9999px"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1rem"
  xl: "1.25rem"
  2xl: "1.5rem"
  3xl: "2rem"
components:
  button-default:
    backgroundColor: "{colors.primary-dark}"
    textColor: "{colors.primary-foreground-dark}"
    rounded: "{rounded.lg}"
    padding: "0 0.625rem"
    height: "2rem"
  button-outline:
    backgroundColor: "{colors.background-dark}"
    textColor: "{colors.foreground-dark}"
    rounded: "{rounded.lg}"
    padding: "0 0.625rem"
    height: "2rem"
  button-secondary:
    backgroundColor: "{colors.secondary-dark}"
    textColor: "{colors.foreground-dark}"
    rounded: "{rounded.lg}"
    padding: "0 0.625rem"
    height: "2rem"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.muted-foreground-dark}"
    rounded: "{rounded.lg}"
    padding: "0 0.625rem"
    height: "2rem"
  button-destructive:
    backgroundColor: "{colors.destructive-dark}"
    textColor: "{colors.destructive-dark}"
    rounded: "{rounded.lg}"
    padding: "0 0.625rem"
    height: "2rem"
  button-link:
    backgroundColor: "transparent"
    textColor: "{colors.primary-dark}"
    rounded: "{rounded.lg}"
    padding: "0"
    height: "2rem"
  card-default:
    backgroundColor: "{colors.card-dark}"
    textColor: "{colors.foreground-dark}"
    rounded: "{rounded.xl}"
    padding: "1rem"
  card-glass:
    backgroundColor: "{colors.card-dark}"
    textColor: "{colors.foreground-dark}"
    rounded: "{rounded.2xl}"
    padding: "1.25rem"
  card-accent:
    backgroundColor: "{colors.primary-dark}"
    textColor: "{colors.foreground-dark}"
    rounded: "{rounded.2xl}"
    padding: "1.25rem"
  card-dashed:
    backgroundColor: "{colors.border-dark}"
    textColor: "{colors.muted-foreground-dark}"
    rounded: "{rounded.2xl}"
    padding: "1.25rem"
  badge-default:
    backgroundColor: "{colors.muted-dark}"
    textColor: "{colors.muted-foreground-dark}"
    rounded: "{rounded.full}"
    padding: "0.125rem 0.5rem"
    height: "1.25rem"
  badge-primary:
    backgroundColor: "{colors.primary-dark}"
    textColor: "{colors.primary-dark}"
    rounded: "{rounded.full}"
    padding: "0.125rem 0.5rem"
    height: "1.25rem"
  badge-success:
    backgroundColor: "{colors.accent-emerald}"
    textColor: "{colors.accent-emerald}"
    rounded: "{rounded.full}"
    padding: "0.125rem 0.5rem"
    height: "1.25rem"
  badge-warning:
    backgroundColor: "{colors.accent-amber}"
    textColor: "{colors.accent-amber}"
    rounded: "{rounded.full}"
    padding: "0.125rem 0.5rem"
    height: "1.25rem"
  badge-destructive:
    backgroundColor: "{colors.destructive-dark}"
    textColor: "{colors.destructive-dark}"
    rounded: "{rounded.full}"
    padding: "0.125rem 0.5rem"
    height: "1.25rem"
  badge-tone-slate:
    backgroundColor: "oklch(0.6 0.02 260 / 0.10)"
    textColor: "oklch(0.78 0.03 260)"
    rounded: "{rounded.full}"
    padding: "0.125rem 0.5rem"
  badge-tone-zinc:
    backgroundColor: "oklch(0.6 0.005 260 / 0.10)"
    textColor: "oklch(0.78 0.01 260)"
    rounded: "{rounded.full}"
    padding: "0.125rem 0.5rem"
  badge-tone-stoneSoft:
    backgroundColor: "oklch(0.6 0.01 80 / 0.10)"
    textColor: "oklch(0.88 0.02 80)"
    rounded: "{rounded.full}"
    padding: "0.125rem 0.5rem"
  badge-tone-cyan:
    backgroundColor: "oklch(0.78 0.13 215 / 0.10)"
    textColor: "oklch(0.82 0.13 215)"
    rounded: "{rounded.full}"
    padding: "0.125rem 0.5rem"
  badge-tone-cyanDeep:
    backgroundColor: "oklch(0.78 0.13 215 / 0.10)"
    textColor: "oklch(0.92 0.06 215)"
    rounded: "{rounded.full}"
    padding: "0.125rem 0.5rem"
  badge-tone-sky:
    backgroundColor: "oklch(0.74 0.13 230 / 0.10)"
    textColor: "oklch(0.82 0.12 230)"
    rounded: "{rounded.full}"
    padding: "0.125rem 0.5rem"
  badge-tone-blue:
    backgroundColor: "oklch(0.62 0.18 255 / 0.10)"
    textColor: "oklch(0.78 0.14 255)"
    rounded: "{rounded.full}"
    padding: "0.125rem 0.5rem"
  badge-tone-indigo:
    backgroundColor: "oklch(0.55 0.18 275 / 0.10)"
    textColor: "oklch(0.78 0.14 275)"
    rounded: "{rounded.full}"
    padding: "0.125rem 0.5rem"
  badge-tone-violet:
    backgroundColor: "oklch(0.6 0.2 295 / 0.10)"
    textColor: "oklch(0.78 0.15 295)"
    rounded: "{rounded.full}"
    padding: "0.125rem 0.5rem"
  badge-tone-purple:
    backgroundColor: "oklch(0.6 0.2 310 / 0.10)"
    textColor: "oklch(0.78 0.15 310)"
    rounded: "{rounded.full}"
    padding: "0.125rem 0.5rem"
  badge-tone-fuchsia:
    backgroundColor: "oklch(0.66 0.25 330 / 0.10)"
    textColor: "oklch(0.8 0.17 330)"
    rounded: "{rounded.full}"
    padding: "0.125rem 0.5rem"
  badge-tone-rose:
    backgroundColor: "oklch(0.66 0.2 10 / 0.10)"
    textColor: "oklch(0.8 0.13 10)"
    rounded: "{rounded.full}"
    padding: "0.125rem 0.5rem"
  badge-tone-amber:
    backgroundColor: "oklch(0.78 0.16 75 / 0.10)"
    textColor: "oklch(0.85 0.13 75)"
    rounded: "{rounded.full}"
    padding: "0.125rem 0.5rem"
  badge-tone-yellowDeep:
    backgroundColor: "oklch(0.85 0.18 95 / 0.10)"
    textColor: "oklch(0.92 0.1 95)"
    rounded: "{rounded.full}"
    padding: "0.125rem 0.5rem"
  badge-tone-emerald:
    backgroundColor: "oklch(0.7 0.17 160 / 0.10)"
    textColor: "oklch(0.82 0.13 160)"
    rounded: "{rounded.full}"
    padding: "0.125rem 0.5rem"
  badge-tone-teal:
    backgroundColor: "oklch(0.7 0.13 190 / 0.10)"
    textColor: "oklch(0.82 0.1 190)"
    rounded: "{rounded.full}"
    padding: "0.125rem 0.5rem"
  filter-chip-default:
    backgroundColor: "{colors.card-dark}"
    textColor: "{colors.muted-foreground-dark}"
    rounded: "{rounded.full}"
    padding: "0.25rem 0.75rem"
  filter-chip-active:
    backgroundColor: "{colors.primary-dark}"
    textColor: "{colors.primary-dark}"
    rounded: "{rounded.full}"
    padding: "0.25rem 0.75rem"
  dialog:
    backgroundColor: "{colors.card-dark}"
    textColor: "{colors.foreground-dark}"
    rounded: "{rounded.xl}"
    padding: "1rem 1.25rem"
    width: "32.5rem"
---

# Design System: SeedLand · V

## 1. Overview: The Cinematic Studio

**Creative North Star: "The Cinematic Studio After Dark"**

SeedLand is a long-term professional home for AI video creators — the people shipping shorts, dramas, digital humans, and ad-grade pieces out of Kling, ComfyUI, Suno, and Seedance. The interface is dark by default, work-first, and quiet on purpose. Hero space belongs to 16:9 / 21:9 thumbnails; chrome (navbar, sidebar, right-panel) earns its pixels by subtraction. Where the surface speaks, it speaks in a blue-to-violet OKLCH palette built so 4K stills, cinematic grading, and motion light read truthfully on top.

The hand-crafted character lives in the details: 1–2px optical adjustments, colored shadows tinted toward the primary blue, ease-out-expo transitions instead of Tailwind's default linear 150ms. Surfaces use tonal layering (`surface-card`, `surface-glass`, `surface-glass-accent`, `surface-dashed`) rather than literal drop shadows. Light mode exists for OLED-paranoid users, coffee-shop daylight, and accessibility — but dark is the brand impression and dark is what every decision is balanced against first.

What this system explicitly rejects: the bright color-tag stampede of TikTok/Bilibili/Kuaishou; the cold grey checkbox energy of Notion/Salesforce dashboards; the late-night neon and emoji rain of Discord; and every "Web3 / NFT" cliché — rainbow gradients, glassmorphism pearls, "metaverse" framing.

**Key Characteristics:**
- Dark-by-default, with a fully tokenized light counterpart for accessibility — never both at once on the same screen.
- Single-accent discipline: one blue-violet primary; supporting accents (cyan, violet, pink, amber, emerald) are reserved for category coding, not decoration.
- OKLCH everywhere — light and dark, primitives and accents, never sRGB hex.
- Tonal layering over shadows: glass surfaces and inset highlights instead of drop shadows.
- Typography earns weight through hierarchy and tracking, not through font swaps — one sans family, system-mono for code.

## 2. Colors: The Blue-Violet Dark

The palette is a deliberately narrow blue-violet column in OKLCH, anchored at hue 220–295. It is engineered to sit *under* video stills without contaminating them. There is one primary; everything else is structural neutrals or capped category-coding accents.

### Primary
- **SeedLand Blue** (`oklch(0.78 0.16 220)` dark / `oklch(0.205 0 0)` light): The single brand accent. Used for active filter chips, primary CTAs, focus rings, and the brand wordmark gradient. In dark mode it is a luminous, slightly desaturated blue chosen to remain legible against `oklch(0.16 0.02 255)` background without screaming. In light mode the primary collapses to near-black — a deliberate inversion that keeps light feeling editorial rather than tinted.

### Secondary (Category Accents)
These five exist only to color-code domains (channels, work categories, tool types). They are never used for hierarchy or emphasis.
- **Accent Cyan** (`oklch(0.78 0.16 220)`): Tutorials, knowledge channels, "showcase" energy.
- **Accent Violet** (`oklch(0.7 0.2 295)`): Community feed, discussion, the "social" surface.
- **Accent Pink** (`oklch(0.78 0.18 350)`): Drama / narrative content, hot/new flagging.
- **Accent Amber** (`oklch(0.82 0.15 75)`): Collaboration, paid project tags, warm CTAs.
- **Accent Emerald** (`oklch(0.78 0.15 160)`): Success / verified state, tools category.

### Tertiary (Category Tone Palette)
The full **16-key `CATEGORY_TONE`** (`src/lib/category-tones.ts`) is the canonical pool for badge color-coding across posts, works, collaborations, and tools: `slate`, `zinc`, `stoneSoft`, `cyan`, `cyanDeep`, `sky`, `blue`, `indigo`, `violet`, `purple`, `fuchsia`, `rose`, `amber`, `yellowDeep`, `emerald`, `teal`. Every tone follows the same recipe (`bg-{tone}-500/10 text-{tone}-700 border-{tone}-500/40`, with `dark:` counterparts). New category metadata must pick from this map — no inline color strings.

### Neutral
- **Background Dark** (`oklch(0.16 0.02 255)`): The deep blue-tinted near-black that establishes the cinematic floor. A two-radial ambient gradient (blue at top, violet at bottom-right) is fixed-attached over it.
- **Background Light** (`oklch(1 0 0)`): Pure white. Paired with the same two-radial gradient at 6%/4% alpha — atmosphere without tinting copy.
- **Card Dark** (`oklch(0.21 0.025 255)`): The first tonal step up; the base for every `surface-card`.
- **Muted Dark** (`oklch(0.24 0.025 255)`): One step warmer; used for input chrome, skeleton states, hover backgrounds.
- **Border Dark** (`oklch(1 0 0 / 8%)`): White at 8% alpha — the "ghost border" that defines surfaces without weight.
- **Muted Foreground Dark** (`oklch(0.68 0.02 240)`): Body-secondary text; the supporting voice.
- **Foreground Dark** (`oklch(0.97 0.01 240)`): The voice itself — slightly cool white, never `#fff`.

### Named Rules
**The One Voice Rule.** SeedLand has one accent: the primary blue. The five named accents and the 16 tone keys are *category coding*, not visual hierarchy. On any given screen the primary owns ≤10% of the colored pixels. If two things are competing for attention with accent color, one of them is wrong.

**The OKLCH-Only Rule.** Every color in the system is declared in OKLCH — primitives, accents, gradients, shadows, scrollbars. sRGB hex is forbidden in new code. The Stitch linter warns; the warning is accepted and load-bearing.

**The Ghost Border Rule.** Dark-mode borders are `oklch(1 0 0 / 8%)` — white at 8% alpha — never a literal grey. The border defines the surface; it must not draw the eye.

**The Tinted Black Rule.** Pure `oklch(0 0 0)` is prohibited as a background. The background is always blue-tinted (`oklch(0.16 0.02 255)`). Pure black flattens video thumbnails; tinted black makes them sit forward.

## 3. Typography: Single Voice, Engineered Tracking

**Display Font:** `var(--font-sans)` — system sans stack (`ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Segoe UI", "Helvetica Neue", Arial, sans-serif`).
**Body Font:** Same — there is one font family.
**Mono Font:** `var(--font-system-mono)` — system mono stack (`ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace`). Used only for code blocks (`.static-prose code`) and `tabular-nums` counters.

**Character:** A single sans across the system, weighted by size, tracking, and color rather than family. Chinese rendering is deliberate — PingFang SC / Hiragino Sans GB / Microsoft YaHei are stacked ahead of Helvetica Neue so CJK leads sit on their proper metrics instead of falling back to a Latin-first font's CJK glyphs.

### Hierarchy
- **Display** (600, `clamp(1.875rem, 4vw, 3rem)`, `leading-tight`, `tracking-tight`): Hero headlines (`text-3xl sm:text-4xl lg:text-5xl`). Used once per page, never inside cards.
- **Headline** (600, `1.5rem` / `text-2xl`, `leading-tight`, `tracking-tight`): Section openers, page-header titles.
- **Title** (600, `1rem` / `text-base`, `leading-tight`, `tracking-tight`): `CardTitle` default. Tight tracking is non-negotiable on titles.
- **Body** (400, `0.875rem` / `text-sm`, `leading-relaxed` ≥ 1.7 for CJK paragraphs): All running copy. Max width 65–75ch enforced on prose blocks.
- **Meta** (400, `0.75rem` / `text-xs`, `text-muted-foreground`): Timestamps, author lines, secondary metadata, card descriptions.
- **Label** (500, `0.6875rem` / `11px`, `uppercase`, `tracking-wider`): The `label-section` utility — section labels like "热门频道", "最新作品". Always lowercase tone color `text-muted-foreground/70`.
- **Mono** (400, `0.85em` of inherited size): Inline code only, inside `.static-prose code` chips.

### Named Rules
**The One Family Rule.** No new top-level fonts are loaded. The system stack is the system. Don't add Inter, Manrope, IBM Plex, Geist, or any "premium-looking" web font without removing one first — and `var(--font-sans)` cannot be removed.

**The Tight-Title Rule.** Titles use `tracking-tight` (`-0.01em` to `-0.02em`). Body uses `tracking-normal`. Labels use `tracking-wider` (`+0.08em`). Mixing these is how the hierarchy reads at a glance.

**The CJK Leading Rule.** Chinese running paragraphs use `leading-relaxed` (≥1.7). Tighter leading collapses CJK ascenders into descenders and the page starts to look like a database dump.

## 4. Elevation: Tonal Layering, Not Shadows

SeedLand is **flat-by-default** with **tonal layering** instead of literal shadows. Depth is conveyed by stepping background lightness in OKLCH (`background` → `card` → `muted` → `accent`) and by hairline borders at 8% white alpha. The only shadow in the system is a 1px inset highlight at the top of glass surfaces — a tactile, "machined edge" feel rather than a drop-shadow lift.

The two ambient radial gradients on `body` (blue from top, violet from bottom-right, fixed-attached) substitute for the warm atmospheric glow drop-shadows would otherwise carry. Dialogs are the one exception: they use a real `shadow-2xl` because they need to break out of the page surface entirely.

### Shadow Vocabulary
- **Inset Highlight** (`box-shadow: 0 1px 0 0 rgba(0,0,0,0.07) inset` in light, `0 1px 0 0 rgba(255,255,255,0.04) inset` in dark): The `surface-glass` top edge. The only "shadow" most of the system uses.
- **Dialog Shadow** (`shadow-2xl` Tailwind default): Reserved for `DialogContent`. Modals are the one place a real drop shadow earns its lift.
- **Ambient Body Gradient** (two `radial-gradient` ellipses on `body`, fixed-attached): The cinematic floor lighting. Blue at top (18% alpha dark / 6% light), violet at bottom-right (12% / 4%). Never animated, never overridden per-page.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat. Hover lifts use `-translate-y-0.5` plus a border-color shift, not a shadow grow. If a card has a drop shadow at rest, it is wrong.

**The Inset Highlight Rule.** Glass surfaces (`surface-glass`, `surface-glass-accent`) carry a 1px inset highlight — light from above, like a milled bezel. This is the system's signature tactile detail; don't replace it with a `shadow-sm`.

**The Tonal Step Rule.** Depth steps in lightness, not blur. From back to front: `background` (0.16) → `card` (0.21) → `muted` (0.24) → `accent` (0.32). Each step is ~3% lightness, same hue, same chroma.

## 5. Components

### Buttons
- **Shape:** Lozenge with `rounded-lg` (`var(--radius-lg)` = `0.625rem`). The `xs` and `sm` sizes step down to `min(var(--radius-md), 10–12px)` for inline density.
- **Variants:** `default` (primary, filled), `outline` (bordered, transparent surface), `secondary` (muted fill), `ghost` (no chrome at rest), `destructive` (10% destructive fill, never solid red), `link` (underline-on-hover, no padding).
- **Sizes:** `xs` (h-6), `sm` (h-7), `default` (h-8), `lg` (h-9), plus icon variants `icon-xs` / `icon-sm` / `icon` / `icon-lg` — all square. The `default` size is `h-8` — deliberately compact; full-bleed CTAs use `lg` or compose their own padding.
- **States:** Focus uses a 3px `ring-ring/50` plus a border swap to `border-ring`. Active state translates the button down 1px (`active:translate-y-px`) for tactile click feedback, except when the button opens a popup (`aria-haspopup`). Hover on `default` is `[a]:hover:bg-primary/80` — only when the button is a link, because non-link buttons handle hover through the underlying primitive.
- **Destructive Tone Rule:** `destructive` is `bg-destructive/10` with `text-destructive`, never a solid red fill. Solid red is reserved for irrecoverable confirmations and is currently unused.

### Filter Chips
- **Style:** `rounded-full` pill, `border` 1px, `px-3 py-1`, `text-xs`. Inactive: `bg-card/40 text-muted-foreground` with `border-border/60`. Active: tone-colored background + `ring-1 ring-primary/40`.
- **Composition:** Optional leading emoji (`aria-hidden`), label, optional trailing count chip (`bg-foreground/15` when active, `bg-muted/60` when inactive, always `tabular-nums`).
- **Behavior:** Chips are `<Link>` elements — clicking navigates and the URL is the source of truth for active state. No local React state.
- **StatusChip variant:** Square `rounded-md` instead of pill, for status filters where pill shape would imply tag/category.

### Cards / Containers
Five `variant` keys, all radius-`xl` or larger:
- **`default`:** `surface-card` — `rounded-xl border-border/60 bg-card`, hover lifts border to `border-primary/40` and background to `bg-muted/40`. The workhorse.
- **`glass`:** `surface-glass` — `rounded-2xl` with the gradient `from-card/80 via-card/45 to-card/15` and the inset highlight. Used for hero panels, featured surfaces.
- **`accent`:** `surface-glass-accent` — same shape, primary-tinted (`border-primary/25 from-primary/10`). For CTA panels and brand moments.
- **`dashed`:** `surface-dashed` — `border-dashed` empty-state container. For upload zones and "nothing here yet" surfaces.
- **`plain`:** `rounded-xl bg-muted/50` — no border, no hover. For inline groupings inside other cards.
- **Internal Padding:** `CardHeader` / `CardContent` / `CardFooter` use `p-4 sm:p-5`. `CardFooter` carries a `border-t border-border/40` divider. `CardTitle` is `text-base font-semibold leading-tight tracking-tight`; `CardDescription` is `text-xs text-muted-foreground`.
- **Interactive flag:** Setting `interactive` adds `cursor-pointer transition-all hover:-translate-y-0.5` — the universal "this card is clickable" lift.

### Badges
- **Shape:** `rounded-full`, 1px border, sizes `sm` / `md` / `lg` (`h-4` / `h-5` / `h-6`).
- **Variants:** `default` (muted), `primary`, `accent` (fuchsia), `cyan`, `success` (emerald), `warning` (amber), `destructive`, `outline`, `ghost`.
- **Category Tone Variants:** Apply one of the 16 `CATEGORY_TONE` class strings from `src/lib/category-tones.ts` — `slate`, `zinc`, `stoneSoft`, `cyan`, `cyanDeep`, `sky`, `blue`, `indigo`, `violet`, `purple`, `fuchsia`, `rose`, `amber`, `yellowDeep`, `emerald`, `teal`. Never inline `bg-rose-500/10` strings; always pull from the map.
- **Composition:** Designed to carry icon + text (`gap-1`, `[10px]` text), small enough to sit inside card metadata rows without dominating.

### Dialog
- **Shape:** `rounded-xl border border-border/60 bg-card text-card-foreground shadow-2xl`, centered, `max-h-[90dvh]`.
- **Sizes:** `sm` (`max-w-[400px]`), `md` (`max-w-[520px]` — default), `lg` (`max-w-[720px]`).
- **Backdrop:** `bg-black/50` with `backdrop-blur-sm`. Click-outside-to-close is on by default; can be disabled per-dialog.
- **Structure:** `DialogHeader` (border-bottom, `px-5 py-4 pr-12` to clear the close button) → `DialogBody` (scrollable) → `DialogFooter` (border-top, right-aligned actions).
- **A11y contract:** Focus trap (Tab/Shift+Tab cycle), `Esc` to close, body scroll lock (ref-counted), focus return to opener on close, `role="dialog"` + `aria-modal="true"` + auto-wired `aria-labelledby` via `DialogTitle`.
- **Close button:** Always rendered top-right as `<Button variant="ghost" size="icon-sm">` with `<X className="size-4">` and `aria-label="关闭"`. The X icon comes from `lucide-react`.

### Inputs / Fields
- **Style:** Use the `focus-ring` utility — `outline-none transition-colors focus:border-primary/60 focus:ring-2 focus:ring-primary/20`. Invalid state swaps to `border-destructive` + `ring-destructive/20` via `aria-[invalid=true]`.
- **Placeholder:** Must meet 4.5:1 contrast — light grey is forbidden.

### Navigation (Layout Shell)
The app shell is composed in `src/app/layout.tsx`: top `Navbar`, left `Sidebar`, right `RightPanel`, bottom `MobileBottomNav` (mobile only). Inside a 1600px max-width wrap, the main column is `flex min-w-0 flex-1 flex-col`. Chrome is designed to be visually subtractive: borders at 8% white alpha, no shadows, no color fills — the work in the center is the figure and the chrome is the ground.

### Signature Surfaces
- **`surface-glass`:** The 2xl-radius, gradient-and-inset glass panel. The system's hero surface — used for community hero, page headers, featured cards. The inset highlight is the visual fingerprint of the brand.
- **`text-gradient-brand`:** The blue→violet OKLCH gradient applied to the SeedLand wordmark and key headlines. Used sparingly — once per page maximum.
- **`bg-grid`:** A 32px OKLCH grid overlay utility, available for empty-state and brand backgrounds when the radial gradient alone is too soft.
- **`animate-skeleton`:** Loading shimmer that respects light/dark — OKLCH alpha steps, 1.4s ease-in-out infinite. The only ambient motion in the system.

## 6. Do's and Don'ts

### Do:
- **Do** declare every new color in OKLCH. The frontmatter is OKLCH; the prose is OKLCH; the Stitch linter warning is accepted policy.
- **Do** treat the primary blue (`oklch(0.78 0.16 220)`) as the single voice — ≤10% of any screen, focus rings, active filter chips, primary CTAs, brand wordmark gradient only.
- **Do** pull category badge colors from the 16-key `CATEGORY_TONE` map in `src/lib/category-tones.ts`. New category metadata picks a tone key by name.
- **Do** use the named surface utilities — `surface-card`, `surface-card-hover`, `surface-glass`, `surface-glass-accent`, `surface-dashed`, `label-section`, `text-gradient-brand`, `focus-ring` — instead of re-inlining their class strings.
- **Do** lead with `var(--font-sans)` (system stack with `PingFang SC` / `Hiragino Sans GB` / `Microsoft YaHei` ahead of Helvetica) and `var(--font-system-mono)` for code. The system stack is the system.
- **Do** ship 1–2px optical adjustments, colored shadows tinted toward the primary, and ease-out-expo transitions — these are the protective moat against looking like a Salesforce dashboard.
- **Do** layer depth tonally (`background` → `card` → `muted` → `accent`, ~3% lightness per step) instead of with drop shadows.
- **Do** keep CJK body copy at `leading-relaxed` (≥1.7) and prose width at 65–75ch.
- **Do** respect `prefers-reduced-motion` for every animation, including page-enter, list stagger, and scroll-driven reveals — not just hover decorations.
- **Do** use a sun/moon toggle convention for the theme switcher (the established UI pattern in `src/components/layout/theme-toggle.tsx`).

### Don't:
- **Don't** use sRGB hex anywhere — not for tokens, not for accent variants, not in inline className gradients. OKLCH only.
- **Don't** add a new top-level font. `Inter`, `Manrope`, `IBM Plex`, `Geist`, `Cormorant`, and friends do not load here. The system stack stays.
- **Don't** invent new category badge colors with inline `bg-rose-500/10 text-rose-700 ...` strings. Always import the named tone from `CATEGORY_TONE`.
- **Don't** put drop shadows on cards at rest. Hover lift = `-translate-y-0.5` + border-color shift, never `shadow-md` growing in.
- **Don't** use pure `oklch(0 0 0)` or `oklch(1 0 0)` as a *background* — backgrounds are blue-tinted (`oklch(0.16 0.02 255)` dark) so video thumbnails sit forward.
- **Don't** use solid red (`bg-destructive` full) for destructive actions in normal UI. `bg-destructive/10` + `text-destructive` is the destructive button. Solid red is reserved for irrecoverable confirmations.
- **Don't** use more than one accent color per screen for emphasis. Two accents competing means the hierarchy is wrong.
- **Don't** ship marketing copy with em-dashes (`—`) as filler punctuation between clauses, "赋能", "打造", "全新升级", "颠覆", emoji rain, or exclamation marks. Errors say "连接失败，请重试" — not "哎呀出错了！".
- **Don't** make this look like抖音 / Bilibili / 快手 (color-tag avalanche, "为你推荐" feed pressure), Salesforce / Notion (cold grey checkbox energy, dashboard cards-on-cards), Discord / Slack (emoji rain, late-night neon stripes), or Web3 / NFT marketplaces (rainbow gradients, glassmorphism pearls, "metaverse" framing).
- **Don't** let chrome (navbar, sidebar, right-panel) compete with the work. Inside `/showcase`, `/community`, and any work-grid surface, chrome only subtracts.
- **Don't** elevate likes/followers as primary metrics. Vanity counters get muted-foreground type and `tabular-nums`; portfolio counts and verified-org badges get the visual weight.
- **Don't** swap out `lucide-react` for another icon set ad-hoc — it is the project-wide icon library. (Tracked for a future audit of icon-bundle size, but not a redesign.)
- **Don't** add new top-level CSS sections without tokenizing first — animation durations, easing curves, and motion tokens are currently inline (Track-N for future tokenization in `@theme`).
