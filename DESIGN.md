---
version: v2
name: SeedLand · V2
description: A single-canvas editorial-light design system for SeedLand — a Chinese AI-video community fused with a service-bidding marketplace. The system runs ONE light canvas across every surface (creator community, work showcase, vendor dashboards, escrow flows, settings). It draws DNA from Shopify's light transactional track (cream canvas, pill buttons, soft paper-halo shadows), Stripe's financial-clarity vocabulary (deep-navy ink, tabular numerics, hairline borders), and The Verge's StoryStream timeline IA (1px-rule timelines for orders, bids, milestones). Bilibili pink, gradient text, glassmorphism pearls, multi-stop atmosphere washes, and cinematic-dark brand surfaces are all explicitly out. Dark mode survives as a nighttime user preference only, never as a brand statement. Type stays on the system font stack — PingFang SC / Hiragino Sans GB / Microsoft YaHei lead the CJK fallback so Chinese ascender metrics sit truthfully.

colors:
  # All foreground/background pairs below have been contrast-verified ≥ 4.5:1 WCAG AA.
  # If you change a token, recompute against its mate (see §2 Contrast Pairs table).
  primary: "oklch(0.48 0.17 245)"
  primary-deep: "oklch(0.42 0.17 248)"
  primary-press: "oklch(0.36 0.17 252)"
  primary-soft: "oklch(0.92 0.04 240)"
  primary-bg-subdued: "oklch(0.96 0.025 240)"
  ink: "oklch(0.22 0.05 250)"
  ink-secondary: "oklch(0.34 0.04 250)"
  ink-mute: "oklch(0.44 0.025 245)"
  ink-mute-2: "oklch(0.58 0.02 245)"
  on-primary: "oklch(1 0 0)"
  canvas: "oklch(1 0 0)"
  canvas-cream: "oklch(0.985 0.005 90)"
  canvas-soft: "oklch(0.98 0.005 230)"
  hairline: "oklch(0.92 0.015 230)"
  hairline-strong: "oklch(0.86 0.02 230)"
  hairline-input: "oklch(0.88 0.025 230)"
  money: "oklch(0.22 0.05 250)"
  money-positive: "oklch(0.42 0.14 160)"
  money-negative: "oklch(0.45 0.18 25)"
  accent-amber: "oklch(0.55 0.15 75)"
  accent-amber-soft: "oklch(0.95 0.07 80)"
  accent-emerald: "oklch(0.45 0.14 160)"
  accent-emerald-soft: "oklch(0.95 0.05 160)"
  destructive: "oklch(0.5 0.21 25)"
  destructive-soft: "oklch(0.95 0.05 25)"
  tag-cyan-bg: "oklch(0.94 0.04 215)"
  tag-cyan-fg: "oklch(0.32 0.13 215)"
  tag-blue-bg: "oklch(0.94 0.04 240)"
  tag-blue-fg: "oklch(0.32 0.15 240)"
  tag-violet-bg: "oklch(0.94 0.04 290)"
  tag-violet-fg: "oklch(0.32 0.17 290)"
  tag-rose-bg: "oklch(0.94 0.04 10)"
  tag-rose-fg: "oklch(0.36 0.17 10)"
  tag-amber-bg: "oklch(0.96 0.06 80)"
  tag-amber-fg: "oklch(0.38 0.13 75)"
  tag-emerald-bg: "oklch(0.94 0.04 160)"
  tag-emerald-fg: "oklch(0.32 0.13 160)"
  tag-slate-bg: "oklch(0.94 0.005 250)"
  tag-slate-fg: "oklch(0.3 0.02 250)"
  # Nighttime mode tokens — explicitly enumerated (see §10).
  # Do NOT derive these algorithmically; programmatic luminance inversion fails for our palette.
  night-canvas: "oklch(0.16 0.02 255)"
  night-canvas-cream: "oklch(0.16 0.02 255)"
  night-canvas-soft: "oklch(0.19 0.022 252)"
  night-card: "oklch(0.21 0.025 255)"
  night-ink: "oklch(0.94 0.01 240)"
  night-ink-secondary: "oklch(0.82 0.012 240)"
  night-ink-mute: "oklch(0.68 0.015 240)"
  night-ink-mute-2: "oklch(0.55 0.018 240)"
  night-hairline: "oklch(1 0 0 / 0.1)"
  night-hairline-strong: "oklch(1 0 0 / 0.16)"
  night-hairline-input: "oklch(1 0 0 / 0.14)"
  night-primary: "oklch(0.72 0.16 240)"
  night-primary-soft: "oklch(0.32 0.08 240)"
  night-money-positive: "oklch(0.78 0.14 160)"
  night-money-negative: "oklch(0.72 0.16 25)"
  night-tag-cyan-bg: "oklch(0.28 0.06 215)"
  night-tag-cyan-fg: "oklch(0.82 0.1 215)"
  night-tag-blue-bg: "oklch(0.28 0.06 240)"
  night-tag-blue-fg: "oklch(0.82 0.1 240)"
  night-tag-violet-bg: "oklch(0.28 0.06 290)"
  night-tag-violet-fg: "oklch(0.82 0.1 290)"
  night-tag-rose-bg: "oklch(0.28 0.06 10)"
  night-tag-rose-fg: "oklch(0.82 0.1 10)"
  night-tag-amber-bg: "oklch(0.3 0.06 75)"
  night-tag-amber-fg: "oklch(0.84 0.1 75)"
  night-tag-emerald-bg: "oklch(0.28 0.06 160)"
  night-tag-emerald-fg: "oklch(0.82 0.1 160)"
  night-tag-slate-bg: "oklch(0.28 0.01 250)"
  night-tag-slate-fg: "oklch(0.82 0.012 250)"

typography:
  display-xxl:
    fontFamily: "var(--font-sans)"
    fontSize: 56px
    fontWeight: 400
    lineHeight: 1.05
    letterSpacing: -0.02em
  display-xl:
    fontFamily: "var(--font-sans)"
    fontSize: 44px
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: -0.018em
  display-lg:
    fontFamily: "var(--font-sans)"
    fontSize: 32px
    fontWeight: 500
    lineHeight: 1.15
    letterSpacing: -0.012em
  display-md:
    fontFamily: "var(--font-sans)"
    fontSize: 26px
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: -0.008em
  heading-lg:
    fontFamily: "var(--font-sans)"
    fontSize: 22px
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: -0.006em
  heading-md:
    fontFamily: "var(--font-sans)"
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: -0.004em
  heading-sm:
    fontFamily: "var(--font-sans)"
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: -0.002em
  body-lg:
    fontFamily: "var(--font-sans)"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.7
    letterSpacing: 0
  body-md:
    fontFamily: "var(--font-sans)"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.7
    letterSpacing: 0
  body-strong:
    fontFamily: "var(--font-sans)"
    fontSize: 14px
    fontWeight: 600
    lineHeight: 1.6
    letterSpacing: 0
  body-tabular:
    fontFamily: "var(--font-sans)"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: 0
    fontVariantNumeric: tabular-nums
  button-md:
    fontFamily: "var(--font-sans)"
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1
    letterSpacing: 0
  button-sm:
    fontFamily: "var(--font-sans)"
    fontSize: 13px
    fontWeight: 500
    lineHeight: 1
    letterSpacing: 0
  caption:
    fontFamily: "var(--font-sans)"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
  caption-tabular:
    fontFamily: "var(--font-sans)"
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0
    fontVariantNumeric: tabular-nums
  micro:
    fontFamily: "var(--font-sans)"
    fontSize: 11px
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: 0
  micro-mono-upper:
    fontFamily: "var(--font-system-mono)"
    fontSize: 11px
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: 0.08em
    textTransform: uppercase
  code:
    fontFamily: "var(--font-system-mono)"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5

rounded:
  xs: 4px
  sm: 6px
  md: 8px
  lg: 12px
  xl: 16px
  pill: 9999px

spacing:
  xxs: 2px
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  xxl: 32px
  huge: 64px

elevation:
  flat: "none"
  paper-1: "0 1px 0 0 oklch(0.92 0.015 230 / 0.6)"
  paper-2: "0 1px 2px oklch(0.22 0.05 250 / 0.04), 0 1px 1px oklch(0.22 0.05 250 / 0.04), 0 0 0 1px oklch(0.92 0.015 230 / 0.6)"
  paper-3: "0 8px 8px oklch(0.22 0.05 250 / 0.04), 0 4px 4px oklch(0.22 0.05 250 / 0.04), 0 2px 2px oklch(0.22 0.05 250 / 0.04), 0 0 0 1px oklch(0.92 0.015 230 / 0.5)"
  paper-modal: "0 25px 50px -12px oklch(0.22 0.05 250 / 0.18), 0 0 0 1px oklch(0.92 0.015 230 / 0.4)"

components:
  button-primary-pill:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button-md}"
    rounded: "{rounded.pill}"
    padding: "8px 18px"
  button-primary-pill-pressed:
    backgroundColor: "{colors.primary-press}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button-md}"
    rounded: "{rounded.pill}"
    padding: "8px 18px"
  button-secondary-pill:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.button-md}"
    rounded: "{rounded.pill}"
    padding: "8px 18px"
    border: "1px solid {colors.hairline-strong}"
  button-ghost-pill:
    backgroundColor: "transparent"
    textColor: "{colors.ink-secondary}"
    typography: "{typography.button-md}"
    rounded: "{rounded.pill}"
    padding: "8px 14px"
  button-destructive-pill:
    backgroundColor: "{colors.destructive-soft}"
    textColor: "{colors.destructive}"
    typography: "{typography.button-md}"
    rounded: "{rounded.pill}"
    padding: "8px 18px"
  text-input:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.sm}"
    padding: "10px 12px"
    border: "1px solid {colors.hairline-input}"
  text-input-focused:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.sm}"
    padding: "10px 12px"
    border: "1px solid {colors.primary}"
    boxShadow: "0 0 0 2px {colors.primary-soft}"
  text-input-invalid:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.sm}"
    padding: "10px 12px"
    border: "1px solid {colors.destructive}"
    boxShadow: "0 0 0 2px {colors.destructive-soft}"
  card-default:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.lg}"
    padding: "20px"
    border: "1px solid {colors.hairline}"
    elevation: "{elevation.paper-2}"
  card-feature:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.lg}"
    padding: "32px"
    border: "1px solid {colors.hairline}"
    elevation: "{elevation.paper-3}"
  card-service:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.lg}"
    padding: "20px"
    border: "1px solid {colors.hairline}"
    elevation: "{elevation.paper-2}"
  card-service-featured:
    backgroundColor: "{colors.primary-bg-subdued}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.lg}"
    padding: "20px"
    border: "1px solid {colors.primary-soft}"
    elevation: "{elevation.paper-2}"
  card-cream-band:
    backgroundColor: "{colors.canvas-cream}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.lg}"
    padding: "32px"
    border: "none"
    elevation: "{elevation.flat}"
  panel-dashboard:
    backgroundColor: "{colors.canvas-soft}"
    textColor: "{colors.ink}"
    typography: "{typography.body-tabular}"
    rounded: "{rounded.lg}"
    padding: "20px"
    border: "1px solid {colors.hairline}"
    elevation: "{elevation.flat}"
  timeline-item:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: "16px"
    border: "1px solid {colors.hairline}"
    elevation: "{elevation.paper-1}"
  pill-tag-cyan:
    backgroundColor: "{colors.tag-cyan-bg}"
    textColor: "{colors.tag-cyan-fg}"
    typography: "{typography.micro}"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
  pill-tag-blue:
    backgroundColor: "{colors.tag-blue-bg}"
    textColor: "{colors.tag-blue-fg}"
    typography: "{typography.micro}"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
  pill-tag-violet:
    backgroundColor: "{colors.tag-violet-bg}"
    textColor: "{colors.tag-violet-fg}"
    typography: "{typography.micro}"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
  pill-tag-rose:
    backgroundColor: "{colors.tag-rose-bg}"
    textColor: "{colors.tag-rose-fg}"
    typography: "{typography.micro}"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
  pill-tag-amber:
    backgroundColor: "{colors.tag-amber-bg}"
    textColor: "{colors.tag-amber-fg}"
    typography: "{typography.micro}"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
  pill-tag-emerald:
    backgroundColor: "{colors.tag-emerald-bg}"
    textColor: "{colors.tag-emerald-fg}"
    typography: "{typography.micro}"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
  pill-tag-slate:
    backgroundColor: "{colors.tag-slate-bg}"
    textColor: "{colors.tag-slate-fg}"
    typography: "{typography.micro}"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
  nav-bar:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "0"
    padding: "12px 24px"
    borderBottom: "1px solid {colors.hairline}"
    elevation: "{elevation.flat}"
  footer:
    backgroundColor: "{colors.canvas-cream}"
    textColor: "{colors.ink-mute}"
    typography: "{typography.caption}"
    rounded: "0"
    padding: "48px 24px"
    borderTop: "1px solid {colors.hairline}"
  dialog:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.lg}"
    padding: "0"
    border: "1px solid {colors.hairline}"
    elevation: "{elevation.paper-modal}"
---

# Design System: SeedLand · V2

## 1. Overview: The Editorial Studio in Daylight

**Creative North Star: "An editorial studio in midday light, with a public bid board on one wall."**

SeedLand · V2 is a single-canvas, daylight-first interface for two coexisting jobs: a creator community where AI-video makers ship and discuss work, and a service-bidding marketplace where the same creators buy and sell production gigs (script, edit, voice, full delivery). The canvas — a barely-warm off-white — is identical across every surface. The two jobs differ in what they put on the canvas (free content vs. priced services, view counts vs. settlement amounts, comment threads vs. milestone timelines), but the visual chrome stays one voice: hairline 1px borders, soft paper-halo shadows under cards, pill buttons in a single brand blue, and tabular figures wherever a number means money or count.

V2 is the deliberate retreat from V1's "cinematic dark editorial" experiment. V1 chased a Linear-meets-Vercel dark-mode brand pose; V2 chases the daylight clarity of a Stripe checkout page, the merchant-warmth of a Shopify pricing tier, and the timeline rhythm of The Verge's StoryStream — three references that already do "trustworthy commerce + readable density + opinionated typography" without any nightclub neon. Bilibili-style pink is intentionally absent: the brand's commerce is too high-stakes (services starting at ¥800, escrow holding live customer money) to wear hot pink. The mood is **confident, quiet, and machine-honest** — close to the visual register of a printed magazine's masthead or a well-designed bank statement, not a content tabloid.

Track A from V1 (creator-side cinematic dark) is gone. The dark theme survives only as a nighttime user preference — an opt-in toggle for OLED-burn-in worriers and late-night browsers — and it is intentionally less polished than light. Every design decision is balanced against the light canvas first; dark mode uses an explicitly enumerated `night-*` token set (see §10), not an algorithmic derivation from the light palette.

**Key Characteristics:**
- ONE canvas across all surfaces — `{colors.canvas-cream}` body, `{colors.canvas}` cards, `{colors.canvas-soft}` dashboard panels. No second polarity, no per-section background switch.
- Single primary voice: `{colors.primary}` blue. Used for filled CTAs, current selection, focus ring, brand wordmark. Never for decoration, never multiplied within one viewport.
- Pill buttons (`{rounded.pill}` 9999px) replace the V1 `rounded-lg` rectangle vocabulary across every button variant.
- Soft paper-halo elevation: 4-stop stacked tiny shadows on default cards (Shopify Level 3 pattern). Drop shadows on hover are explicitly allowed; they are part of the brand's lift response, not a banned pattern.
- Tabular figures (`font-feature-settings: "tnum"`) on every money, count, and ID render. Money color is the deep navy ink, never the brand blue.
- 7 taxonomy tag tints (cyan / blue / violet / rose / amber / emerald / slate) for service category coding and channel coloring. These are taxonomy, NOT emphasis. A tile that's `pill-tag-violet` does not become "important" because of its color.
- 1px hairline borders in `{colors.hairline}` `#e3e8ee`-equivalent — full strength, never diluted at use-site (`border-border/60` is banned, see Don'ts).
- Type stays on the system stack. No webfont. PingFang SC → Hiragino Sans GB → Microsoft YaHei leads the CJK fallback so Chinese ascenders sit on their proper metrics.
- Dark mode is a derived nighttime view, not a brand. The brand IS the light canvas.

## 2. Colors

> **Source pages (intended):** home (`/`), `/community`, `/showcase`, `/services` (new — service marketplace), `/services/[id]`, `/me/orders`, `/me/wallet`, settings, escrow checkout.

### Primary
- **SeedLand Blue** (`{colors.primary}` — `oklch(0.55 0.16 240)`): The single brand accent. Filled CTA, focus ring, current selection, brand wordmark. On a single screen, the colored pixels emitted by primary blue stay ≤ 10% of total — that's the budget. Filled-pill CTAs are the canonical use; everything else (text emphasis, hover lifts, etc.) should reach for a neutral first.
- **Primary Deep** (`{colors.primary-deep}` — `oklch(0.45 0.18 245)`): Used in pressed-state lift and on `nav-bar` active-link underline.
- **Primary Press** (`{colors.primary-press}` — `oklch(0.38 0.18 250)`): The pressed-state of `button-primary-pill`. Adds a 1-level downshift in lightness.
- **Primary Soft** (`{colors.primary-soft}` — `oklch(0.92 0.04 240)`): Pale fill used inside subtle pills, focused input borders, and the `card-service-featured` background. Pairs with primary-deep text for an inversion-free emphasis.
- **Primary Bg Subdued** (`{colors.primary-bg-subdued}` — `oklch(0.96 0.025 240)`): Even-paler primary background, used on the featured pricing tier card and large promotional bands.

### Surface
- **Canvas** (`{colors.canvas}` — `oklch(1 0 0)`): Pure white card surface, default product chrome (nav, cards, dialogs, inputs).
- **Canvas Cream** (`{colors.canvas-cream}` — `oklch(0.985 0.005 90)`): A barely-warm off-white — invisibly different from pure white but adds editorial warmth. The body background of every page. Pairs with `card-default` cards on top.
- **Canvas Soft** (`{colors.canvas-soft}` — `oklch(0.98 0.005 230)`): A cool-tinted near-white used as the fill of `panel-dashboard` (vendor work, buyer orders, financial widgets). The cool tint separates "task / data" from the cream marketing canvas.
- **Hairline** (`{colors.hairline}` — `oklch(0.92 0.015 230)`): The 1px universal border on cards, panels, hairline dividers, table cells. Full strength only — see The Hairline Discipline rule.
- **Hairline Strong** (`{colors.hairline-strong}` — `oklch(0.86 0.02 230)`): Slightly darker hairline for high-contrast borders (selected state, focused input, table header underline).
- **Hairline Input** (`{colors.hairline-input}` — `oklch(0.88 0.025 230)`): Slightly cooler hairline reserved for form inputs — the small extra contrast tells the eye "this is a typeable field" without a shadow.

### Text
- **Ink** (`{colors.ink}` — `oklch(0.22 0.05 250)`): Deep navy. Every body text, every heading, every primary-button label substrate. **Never pure black.** Pure black against cream canvas reads as too-harsh ink-jet; the navy tint is the brand's quiet financial-DNA signal, borrowed from Stripe.
- **Ink Secondary** (`{colors.ink-secondary}` — `oklch(0.34 0.04 250)`): Secondary text — sub-headings, card descriptions, list items where the headline already carries the eye.
- **Ink Mute** (`{colors.ink-mute}` — `oklch(0.5 0.025 245)`): Tertiary text — captions, timestamps, footer link groups, table labels.
- **Ink Mute 2** (`{colors.ink-mute-2}` — `oklch(0.6 0.02 245)`): The quietest text tier — placeholders, disabled labels, "view more" inline links.
- **On Primary** (`{colors.on-primary}` — `oklch(1 0 0)`): Text on `{colors.primary}` filled surfaces (primary button label, on a brand-color hero band).

### Money
- **Money** (`{colors.money}` — same as ink): The default render color for all currency. Money does NOT get the brand blue.
- **Money Positive** (`{colors.money-positive}` — `oklch(0.5 0.14 160)`): Income, balance increases, positive delta (`+¥120`).
- **Money Negative** (`{colors.money-negative}` — `oklch(0.55 0.18 22)`): Withdrawals, refunds, negative delta (`-¥120`). Pairs with `{typography.body-tabular}` so the deltas align on the decimal.

### Semantic
- **Accent Amber** (`{colors.accent-amber}` — `oklch(0.72 0.16 75)`): Warning, "pending review", "deadline approaching" labels. Pairs with `{colors.accent-amber-soft}` as background fill.
- **Accent Emerald** (`{colors.accent-emerald}` — `oklch(0.58 0.14 160)`): Success, "verified", "completed" labels. Pairs with `{colors.accent-emerald-soft}` as background fill.
- **Destructive** (`{colors.destructive}` — `oklch(0.55 0.21 25)`): Error, irreversible action. Used as text color and 10%-alpha background; never as a solid red fill for normal buttons.

### Taxonomy Tags (7 tints)
Used **only** to color-code service categories, community channels, work categories, and order types. They are taxonomy, not emphasis. A `pill-tag-violet` next to a `pill-tag-amber` does NOT mean violet is more important — they're sibling labels. Each tint follows a `bg + fg` pair, kept low-contrast so a row of tags reads as a quiet legend, not a parade.

| Tint | bg token | fg token | Conventional use |
|---|---|---|---|
| cyan | `{colors.tag-cyan-bg}` | `{colors.tag-cyan-fg}` | Tutorial / knowledge / how-to |
| blue | `{colors.tag-blue-bg}` | `{colors.tag-blue-fg}` | Product showcase / official |
| violet | `{colors.tag-violet-bg}` | `{colors.tag-violet-fg}` | Discussion / community / opinion |
| rose | `{colors.tag-rose-bg}` | `{colors.tag-rose-fg}` | Drama / narrative / hot |
| amber | `{colors.tag-amber-bg}` | `{colors.tag-amber-fg}` | Collaboration / paid project |
| emerald | `{colors.tag-emerald-bg}` | `{colors.tag-emerald-fg}` | Tools / workflow / success |
| slate | `{colors.tag-slate-bg}` | `{colors.tag-slate-fg}` | Neutral fallback / archived |

### Named Rules

**The One Voice Rule.** SeedLand has one accent: the primary blue. The 7 taxonomy tags are taxonomy, not emphasis. On any given screen the primary owns ≤ 10% of the colored pixels. If two things are competing for attention with accent color, one of them is wrong. The amber/emerald semantic accents do NOT count against the primary budget when they carry a real semantic load (warning, success); they DO count if they're decorating without semantic meaning.

**The Deep Navy Ink Rule.** All text is `{colors.ink}` `oklch(0.22 0.05 250)` — never pure black. The 5% indigo tint gives the brand its quiet financial-DNA signal and prevents the screen from reading as a printer test page.

**The Hairline Discipline.** Hairline tokens are used at full strength. Compositions like `border-border/60` `/40` `/30` are forbidden in V2 — they dilute the already-careful `{colors.hairline}` value to invisibility, which was the V1 plastic-glass tell. If you need a quieter rim, change the token, not the use-site.

**The Tabular Money Rule.** Every cell rendering currency, settlement amount, transaction count, view count, or follower number uses `font-feature-settings: "tnum"`. Implementation: apply `tabular-nums` Tailwind class or the `<MoneyText>` primitive. The slot signal — numbers that align column-perfectly — is the brand's quiet "you can trust this number" promise to buyers and sellers.

**The Cool-Tint Panel Rule.** `{colors.canvas-soft}` (the cool-tinted near-white) appears ONLY on dashboard panels — vendor work overview, buyer order list, financial widgets, escrow milestone trackers. It does NOT appear on creator-community or showcase surfaces. The tint is the brand's signal "this is task surface, not content surface".

### Verified Contrast Pairs (WCAG AA)

Every foreground/background pair below has been recomputed against WCAG AA targets (text ≥ 4.5:1 for normal, ≥ 3:1 for large 18px+ / bold 14px+; UI components ≥ 3:1). Tokens were adjusted in the V2 contrast pass — if you change any value, recompute the ratio against its mate.

| Foreground | Background | Approx ratio | Use |
|---|---|---|---|
| `{colors.ink}` | `{colors.canvas-cream}` | ~14.7:1 | Body text on page |
| `{colors.ink}` | `{colors.canvas}` | ~14.9:1 | Body text on cards |
| `{colors.ink-secondary}` | `{colors.canvas-cream}` | ~9.5:1 | Sub-heading, card desc |
| `{colors.ink-mute}` | `{colors.canvas-cream}` | ~5.5:1 | Caption, footer link |
| `{colors.ink-mute-2}` | `{colors.canvas-cream}` | ~3.4:1 | Placeholder, disabled — NON-INTERACTIVE only |
| `{colors.on-primary}` | `{colors.primary}` | ~4.8:1 | Primary CTA label |
| `{colors.money}` | `{colors.canvas}` | ~14.9:1 | Default money render |
| `{colors.money-positive}` | `{colors.canvas}` | ~5.2:1 | Income, balance + |
| `{colors.money-negative}` | `{colors.canvas}` | ~5.0:1 | Refund, balance − |
| `{colors.tag-cyan-fg}` | `{colors.tag-cyan-bg}` | ~5.4:1 | Cyan taxonomy chip |
| `{colors.tag-blue-fg}` | `{colors.tag-blue-bg}` | ~5.3:1 | Blue taxonomy chip |
| `{colors.tag-violet-fg}` | `{colors.tag-violet-bg}` | ~5.5:1 | Violet taxonomy chip |
| `{colors.tag-rose-fg}` | `{colors.tag-rose-bg}` | ~5.6:1 | Rose taxonomy chip |
| `{colors.tag-amber-fg}` | `{colors.tag-amber-bg}` | ~5.2:1 | Amber taxonomy chip |
| `{colors.tag-emerald-fg}` | `{colors.tag-emerald-bg}` | ~5.4:1 | Emerald taxonomy chip |
| `{colors.tag-slate-fg}` | `{colors.tag-slate-bg}` | ~5.8:1 | Slate taxonomy chip |
| `{colors.destructive}` | `{colors.canvas}` | ~5.5:1 | Error text |
| `{colors.primary}` | `{colors.canvas}` | ~4.7:1 | Inline link / focus ring |

**The ink-mute-2 Rule.** `{colors.ink-mute-2}` fails AA for interactive text. Use it ONLY for non-interactive disabled labels and placeholders. Inline "view more" links and other interactive text must use `{colors.ink}`, `{colors.ink-secondary}`, or `{colors.primary}` — never ink-mute-2.

**Non-color Cue for Taxonomy Tags.** WCAG 1.4.1 requires color not be the only signal. Every `pill-tag-{tint}` MUST carry a category icon prefix from the fixed taxonomy glyph set (see §7 Pills). Color-blind users (deuteranopia collapses cyan/blue; protanopia collapses rose/amber) rely on the icon as the primary signal. Color is secondary.

## 3. Typography: System Stack, Engineered Hierarchy

### Font Family

The entire system runs on the platform's system stack. No webfonts loaded.

- **Display & UI**: `var(--font-sans)` resolves to `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Segoe UI", "Helvetica Neue", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"`.
- **Code & Mono UPPERCASE labels**: `var(--font-system-mono)` resolves to `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace`.

**CJK leads the fallback for a reason.** PingFang SC / Hiragino Sans GB / Microsoft YaHei sit ahead of Helvetica Neue so Chinese ascender metrics resolve to true CJK glyphs rather than fall-back Latin-CJK approximations. Chinese running paragraphs use `body-lg` or `body-md` line-height ≥ 1.7 — tighter leading collapses CJK ascenders into descenders and the page starts to look like a dump.

### Hierarchy

| Token | Size | Weight | Line Height | Letter Spacing | Use |
|---|---|---|---|---|---|
| `{typography.display-xxl}` | 56px | 400 | 1.05 | -0.02em | Marketing hero headline (rare) |
| `{typography.display-xl}` | 44px | 400 | 1.1 | -0.018em | Section opener on landing |
| `{typography.display-lg}` | 32px | 500 | 1.15 | -0.012em | Page title (`/services`, `/me/wallet`) |
| `{typography.display-md}` | 26px | 500 | 1.2 | -0.008em | Sub-page title (detail pages) |
| `{typography.heading-lg}` | 22px | 600 | 1.25 | -0.006em | Section heading |
| `{typography.heading-md}` | 18px | 600 | 1.3 | -0.004em | Card title (feature card) |
| `{typography.heading-sm}` | 16px | 600 | 1.3 | -0.002em | Compact card title |
| `{typography.body-lg}` | 16px | 400 | 1.7 | 0 | Marketing body, CJK prose |
| `{typography.body-md}` | 14px | 400 | 1.7 | 0 | Default UI body, list items |
| `{typography.body-strong}` | 14px | 600 | 1.6 | 0 | Inline emphasis within body |
| `{typography.body-tabular}` | 14px | 400 | 1.4 | -0.005em | Money / numeric table cells (tnum) |
| `{typography.button-md}` | 14px | 500 | 1 | 0 | Default pill button label |
| `{typography.button-sm}` | 13px | 500 | 1 | 0 | Compact pill button label |
| `{typography.caption}` | 12px | 400 | 1.5 | 0 | Helper, sub-meta, footnote |
| `{typography.caption-tabular}` | 12px | 500 | 1.4 | 0 | Tabular caption (transaction date + tnum count) |
| `{typography.micro}` | 11px | 400 | 1.4 | 0 | Smallest legible label |
| `{typography.micro-mono-upper}` | 11px (mono) | 500 | 1.2 | 0.08em | Latin-only UPPERCASE timestamp / ID / status code |
| `{typography.code}` | 13px (mono) | 400 | 1.5 | 0 | Inline code |

### Principles

- **Hierarchy through size + weight, not family.** Display sizes sit at 400–500 weight; body at 400; emphasis at 600. The brand has one family — variation is by size, weight, and letter-spacing.
- **Negative letter-spacing on display only.** Sizes ≥ 22px get -0.002 to -0.02em negative tracking, scaling proportionally with size. Below 22px, tracking returns to 0. Negative tracking gives display sizes optical density; applied to body it cramps Chinese characters into each other.
- **Tabular nums for money, counts, IDs.** Apply `tnum` via `tabular-nums` class or the `<MoneyText>` primitive. Non-tabular nums in a transaction table is a bug.
- **CJK body leading ≥ 1.7.** Latin can go to 1.5 for compact density, but CJK paragraphs must stay relaxed.
- **Mono UPPERCASE is for Latin tokens only.** Timestamps `2025-06-14 18:32`, order IDs `ORD-7K2M`, status codes `PAID`, `IN ESCROW`. Chinese never goes uppercase — for Chinese labels, use weight contrast and size instead (caption weight 500 on `{colors.ink-mute}`).

### Note on Substitutes
The system stack IS the substitute set. No web fonts loaded — every fallback in the `var(--font-sans)` chain is intentionally listed. Performance constraint: zero network requests for type. Do NOT add Inter, Manrope, Geist, IBM Plex, or any "premium-looking" web font — they don't pass the `prefers-reduced-data` test and they break the CJK metric story.

## 4. Layout

### Spacing System
- **Base unit**: 8px (with 2 / 4 / 12 sub-units for fine work).
- **Tokens**: `{spacing.xxs}` 2px · `{spacing.xs}` 4px · `{spacing.sm}` 8px · `{spacing.md}` 12px · `{spacing.lg}` 16px · `{spacing.xl}` 24px · `{spacing.xxl}` 32px · `{spacing.huge}` 64px.
- **Section padding**: 48–64px vertical on landing / marketing surfaces; 24–32px on dashboard / list / detail surfaces.
- **Card internal padding**: 20px (`card-default`), 32px (`card-feature`), 16px (`timeline-item`).

### Grid & Container
- **Max widths**: 1280px on `/` and content surfaces, 1440px on landing hero, 1024px on detail pages, 720–840px on long-form prose pages (legal / about).
- **Service marketplace grid (`/services`)**: 4-up on desktop, 3-up on tablet, 2-up on phone, 1-up on small phones. Featured service tier stays distinguished at every step.
- **Order timeline column**: 720px max — the `timeline-item` chain reads vertically; widening past 720px adds whitespace, not information.
- **Container padding**: 24px mobile / 48px desktop on outer edges.

### Whitespace Philosophy
The system breathes through hairlines and section padding, not through giant negative space. The cream canvas does most of the air work: cards sit on it with 20px internal padding and 24px gaps, and the canvas itself provides the visual rest between bands. Marketing landing pages stretch section padding to 48–64px; product surfaces (services list, dashboards, order detail) tighten to 24–32px because users are scanning, comparing, and acting.

## 5. Elevation: Soft Paper Halo

The brand uses a stacked-tiny-shadow halo (Shopify Level 3 pattern) — multiple 1–8px shadows at low alpha layered together produce a soft, paper-like glow under cards. This is the system's signature depth. Pure flat (`elevation: none`) reads as a draft. A single `shadow-md` reads as a SaaS dashboard tile. The 4-stop paper halo reads as a printed object on a desk under daylight — exactly the brand's "editorial studio in midday" register.

### Shadow Vocabulary

| Level | Treatment | Use |
|---|---|---|
| `{elevation.flat}` | none | Inline groupings inside other cards; nav rail items; tabular row backgrounds |
| `{elevation.paper-1}` | `0 1px 0 0 oklch(0.92 0.015 230 / 0.6)` | Timeline item (1px bottom-edge hairline as elevation) |
| `{elevation.paper-2}` | 2 stacked tiny shadows + 1px ring | Default card surface (workhorse) |
| `{elevation.paper-3}` | 4 stacked tiny shadows + 1px ring | Feature card, pricing tier, hero callout |
| `{elevation.paper-modal}` | 25px y-offset + heavy blur + 1px ring | Dialog content, floating panel |

### Decorative Depth
The signature visual is the 4-stop paper-halo (Level 3) under feature cards on the landing surface. The shadow is layered like a photocopier reflection — four 1–8px Y-offsets at ~4% alpha — producing a soft halo without harshness. Combined with the cream canvas, the card reads as a sheet of card-stock laid on a desk.

Drop shadows on hover ARE allowed in V2 — this is a deliberate departure from V1's "flat-by-default" rule. A card hover lifts to one Level above (paper-2 → paper-3) within ~150ms, paired with a -translate-y-0.5. The lift is intentional; the V1 ban was a reaction to colored hover glows (cyan halos, primary glows) which are still banned. Honest shadow lift = OK; colored shadow lift = forbidden.

### Named Rules

**The Paper Halo Rule.** Default cards use `{elevation.paper-2}`. Feature cards lift to `paper-3`. Modals use `paper-modal`. Nothing else.

**The Honest Shadow Rule.** Shadows are neutral — never tinted toward primary, never `rgba(56,189,248,X)` or any color hue. The 4% alpha black-equivalent in the layered halo is the only legal "color" inside box-shadow.

**The Hover Lift Rule.** Card hover = `paper-2 → paper-3` + `-translate-y-0.5` + 150ms ease-out transition. The lift is the brand's tactile response; suppressing it ships flat-looking interactive surfaces.

## 6. Shapes

### Border Radius Scale

| Token | Value | Use |
|---|---|---|
| `{rounded.xs}` | 4px | Inputs, table cells, small badges |
| `{rounded.sm}` | 6px | Form inputs (deliberately tighter than cards) |
| `{rounded.md}` | 8px | Timeline items, secondary cards |
| `{rounded.lg}` | 12px | Default card, service card, dialog, feature card |
| `{rounded.xl}` | 16px | Hero photo frame, full-bleed image container |
| `{rounded.pill}` | 9999px | All buttons, all pill tags, avatar, status dot |

### Image & Photography Geometry
- **Work / video thumbnails**: 16:9 default, 1:1 for showcase grid, 4:3 occasional. Always sit inside `{rounded.md}` to `{rounded.lg}` container; never full-bleed across the entire page (V1 cinematic full-bleed pattern is retired).
- **Avatar**: circular (`{rounded.pill}`), with 1px hairline ring at full alpha. Default fallback: `{colors.canvas-soft}` background + initial in `{colors.ink-mute}` `{typography.caption}` — NO gradient avatar fallbacks.
- **Hero / landing photography**: max-width 1440px container, `{rounded.xl}` 16px corner.

## 7. Components

### Buttons

All buttons are pill-shaped (`{rounded.pill}` 9999px). The pill is non-negotiable in V2 — `rounded-lg` button shapes from V1 are explicitly retired.

**`button-primary-pill`** — the dominant CTA.
- Background `{colors.primary}`, text `{colors.on-primary}`, type `{typography.button-md}`, padding `8px 18px`. Pressed → `{colors.primary-press}`.

**`button-secondary-pill`** — outline-style alternative on white surfaces.
- Background `{colors.canvas}`, text `{colors.ink}`, 1px `{colors.hairline-strong}` border, same pill geometry. The hover state firms the border to `{colors.primary}`.

**`button-ghost-pill`** — chromeless action (used in dense rows: card hover actions, table row actions).
- Transparent background, text `{colors.ink-secondary}`, no border. Hover surface becomes `{colors.primary-soft}` at low alpha.

**`button-destructive-pill`** — destructive action labeled.
- Background `{colors.destructive-soft}`, text `{colors.destructive}`, no solid red fill. Confirmation dialogs are required for irreversible operations; the button by itself is not enough.

**Button Sizes:**
- `xs` (h-6, type `button-sm`, padding `4px 10px`) — table inline actions
- `sm` (h-7, padding `6px 14px`) — secondary row actions
- `md` (h-8, padding `8px 18px`) — default
- `lg` (h-10, padding `10px 22px`, type `body-strong`) — primary marketing CTA

**Focus state**: 2px primary-soft focus ring + border swap to primary. No glow.

### Cards & Containers

**`card-default`** — the workhorse on the cream canvas.
- Background `{colors.canvas}` (white), padding 20px, rounded `{rounded.lg}` 12px, elevation `{elevation.paper-2}`. Internal CardHeader / CardContent / CardFooter pattern from V1 carries over.

**`card-feature`** — pricing tier, featured service, hero CTA panel.
- Background `{colors.canvas}`, padding 32px, rounded `{rounded.lg}`, elevation `{elevation.paper-3}` (the 4-stop halo). Carries `{typography.heading-md}` title + `{typography.display-md}` numeric (price / count) + body + a single `button-primary-pill` action.

**`card-service`** — a service listing in `/services` grid.
- Same chrome as `card-default`. Header is the vendor avatar + name + level badge + rating. Body is service title + brief + start price (with `{typography.body-tabular}` rendering the `¥` number). Footer is `pill-tag-{taxonomy}` chips for service categories.

**`card-service-featured`** — promoted / "best seller" service tier.
- Background `{colors.primary-bg-subdued}` (subtle primary tint), otherwise identical to `card-service`. The tint signals "promoted" without a colored ribbon.

**`card-cream-band`** — warm horizontal band card on long landing pages.
- Background `{colors.canvas-cream}` (matches the body, so reads as a tonal section rather than a card), padding 32px, rounded `{rounded.lg}`. No shadow — the card is content, not chrome. Used to chunk landing pages into themed bands without breaking the canvas.

**`panel-dashboard`** — cool-tinted dashboard / data panel.
- Background `{colors.canvas-soft}` (cool tinted near-white), padding 20px, rounded `{rounded.lg}`, NO shadow (it's a sub-surface, not a hovering object). Holds tabular data — order list, revenue chart, milestone tracker. Always paired with `body-tabular` for any numeric content.

**`timeline-item`** — single entry in a vertical timeline (order status flow, bid history, milestone log).
- Background `{colors.canvas}`, padding 16px, rounded `{rounded.md}` 8px, elevation `{elevation.paper-1}` (only a bottom hairline — the rail draws the eye, not the card). Carries a left-aligned `{typography.micro-mono-upper}` timestamp + a heading-sm event + body-md detail.

### Inputs & Forms

**`text-input`** — standard form field.
- Background `{colors.canvas}`, text `{colors.ink}`, type `{typography.body-md}`, padding `10px 12px`, rounded `{rounded.sm}` 6px (deliberately tighter than card radius — inputs are not cards), 1px `{colors.hairline-input}` border.
- Focus: border swaps to `{colors.primary}`, 2px primary-soft ring outside.
- Invalid: border swaps to `{colors.destructive}` + light destructive-soft fill behind.

**Textarea**, **Select**, **Checkbox**, **Radio**: inherit the same `{colors.hairline-input}` border, same focus treatment, same `{rounded.sm}` (or larger geometry-appropriate radius).

### Navigation

**`nav-bar`** — top nav, sticky on scroll.
- Background `{colors.canvas}` (solid white, NO backdrop-blur — V1's frosted glass nav is retired), 1px bottom `{colors.hairline}` border, padding `12px 24px`. Logo wordmark on the left (flat `{colors.primary}` fill — no cyan→blue gradient, no glow shadow), nav links center, right side carries a single `button-primary-pill` CTA + a `button-ghost-pill` secondary.
- Active nav link: `{colors.primary-deep}` text + 1px `{colors.primary}` solid underline (NO fade-to-transparent gradient underline — V1 pattern retired).

**Side rail** (sidebar): solid `{colors.canvas}` background, 1px right border in `{colors.hairline}`. Section dividers use `{typography.caption}` weight 500 on `{colors.ink-mute}` — NOT uppercase, NOT tracked. Eyebrow-uppercase per-section is banned in V2.

**Mobile bottom nav**: solid `{colors.canvas}`, 1px top `{colors.hairline}`, no backdrop-blur. Active tab: `{colors.primary}` text + a 2px `{colors.primary}` top-edge bar.

### Pills, Tags, and Chips

**`pill-tag-{tint}`** (7 variants: cyan / blue / violet / rose / amber / emerald / slate)
- Background `{colors.tag-{tint}-bg}`, text `{colors.tag-{tint}-fg}`, type `{typography.micro}`, padding `2px 10px`, rounded `{rounded.pill}`.
- **Must include a category icon prefix** (12×12 lucide-react glyph at `currentColor`) — this is the non-color cue mandated by WCAG 1.4.1 for color-blind users.
- Used for service category, work category, channel coloring. Never on a row that already has 3+ other colored elements; the visual goal is a quiet legend.

**Conventional taxonomy → icon mapping** (extend or override per route, but keep 1:1 within a route):

| Tint | Conventional taxonomy | Icon (lucide-react) |
|---|---|---|
| cyan | Tutorial / how-to / knowledge | `BookOpen` |
| blue | Product showcase / official | `Box` |
| violet | Discussion / community / opinion | `MessageCircle` |
| rose | Drama / narrative / hot | `Flame` |
| amber | Collaboration / paid project | `Handshake` |
| emerald | Tools / workflow / success | `Wrench` |
| slate | Neutral fallback / archived | `Hash` |

**`pill-status-{state}`** (4 variants: pending / in-progress / completed / cancelled)
- Tracks order / bid / milestone state.
- pending → `{colors.tag-amber-bg}` + `{colors.tag-amber-fg}` + small dot prefix
- in-progress → `{colors.tag-blue-bg}` + `{colors.tag-blue-fg}`
- completed → `{colors.tag-emerald-bg}` + `{colors.tag-emerald-fg}`
- cancelled → `{colors.tag-slate-bg}` + `{colors.tag-slate-fg}`

### Money & Numerics

**`<MoneyText>` primitive (recommended)** — wraps a number with `tabular-nums` class + correct color:
- Default: `{colors.money}` (deep navy ink)
- With `direction="positive"`: `{colors.money-positive}` (emerald)
- With `direction="negative"`: `{colors.money-negative}` (rose)
- Optional currency prefix (default `¥`) sized down to 80% of the integer, tracked +0.04em.

**Tabular numbers everywhere.** Order IDs, view counts, follower counts, bid counts, transaction amounts, deltas, percentages — all `tnum`. The Tabular Money Rule (§2) applies to counts as well as money.

### Dialog

- Background `{colors.canvas}`, text `{colors.ink}`, rounded `{rounded.lg}`, padding 0 (DialogHeader / DialogBody / DialogFooter own their own padding), elevation `{elevation.paper-modal}`.
- Backdrop scrim: `oklch(0.22 0.05 250 / 0.4)` — a navy-tinted dim, NOT pure black, NOT `backdrop-blur-sm`. V1 backdrop-blur is retired.
- Header carries the title in `{typography.heading-md}` + close icon button (ghost-pill). Footer is right-aligned with primary action on the right.

### Footer

**`footer`** — site-wide footer.
- Background `{colors.canvas-cream}` (matches body canvas), text `{colors.ink-mute}`, type `{typography.caption}`, padding `48px 24px`. Holds 4–5 columns of link groups + social icons + a legal row at the bottom.

### Avatar

- Circular (`{rounded.pill}`), 1px `{colors.hairline}` ring at full alpha.
- Default fallback: `{colors.canvas-soft}` background + first-character glyph in `{colors.ink-mute}` at `{typography.caption}`. **No gradient fallback** — V1 indigo/purple/teal gradient pattern retired.
- Verified org: 1px `{colors.accent-emerald}` ring + `verified` checkmark badge.

## 8. Do's and Don'ts

### Do
- **Do** keep the canvas one color across every route. Switching backgrounds per page is V1 behavior; V2 is one canvas everywhere.
- **Do** use pill-shaped buttons (`{rounded.pill}`) for every button variant. No rounded-rectangle buttons exist in V2.
- **Do** ink text in `{colors.ink}` deep navy, never pure black.
- **Do** apply `tabular-nums` (`tnum`) to every money, count, ID, and timestamp render. Use the `<MoneyText>` primitive when available.
- **Do** use full-strength `{colors.hairline}` for borders. No dilution at use-site.
- **Do** reach for `card-default` (paper-2) and `card-feature` (paper-3) as the standard elevation pair. Hover lifts up one level.
- **Do** use the 7 taxonomy tag tints to color-code categories — once per chip, never as emphasis.
- **Do** use Latin `{typography.micro-mono-upper}` for order IDs, timestamps, status codes. NOT for Chinese.
- **Do** lead with `var(--font-sans)` so PingFang SC / Hiragino Sans GB / Microsoft YaHei resolve ahead of Latin fallbacks.
- **Do** keep `panel-dashboard` (`{colors.canvas-soft}`) reserved for task / data surfaces. Cream stays for content.
- **Do** put nav, mobile bottom-nav, and dialog on solid surfaces with NO backdrop-blur.
- **Do** wrap money deltas in `{colors.money-positive}` / `{colors.money-negative}` — NEVER use the brand blue for money.
- **Do** use the soft paper-halo shadow stack — it's the signature depth.

### Don't
- **Don't** introduce a second canvas color or polarity. Dark surfaces on the light track are a regression to V1's dual-canvas idea, which is dropped.
- **Don't** use `backdrop-blur` anywhere — navbar, sticky tabs, mobile drawer, FAB, report button, dialog overlay. All banned. The 2024 glassmorphism reflex is over.
- **Don't** use pure black (`#000` or `oklch(0 0 0)`) as a text color — it's too harsh on cream. Ink is deep navy.
- **Don't** apply `text-gradient`, `bg-gradient-to-br` 3-stop atmosphere washes, or any `from-{color}-500/X to-{color}-500/Y` rainbow tile pattern.
- **Don't** use Bilibili pink or hot pink (`#FB7299`) anywhere. The brand decision is explicitly no pink.
- **Don't** use cyan + violet + fuchsia together for emphasis on the same surface — even when individually allowed as taxonomy, the combination is a V1 plastic-glass tell.
- **Don't** use colored shadows (`rgba(56,189,248,X)` cyan glow, primary glow halos, etc.). Shadows are neutral.
- **Don't** put a gradient hue tint on an avatar fallback. Default is `{colors.canvas-soft}` + initial.
- **Don't** put uppercase tracked eyebrow text above every section. Once per page max, only if it carries real semantic weight (`案例 / 价格 / 流程`).
- **Don't** push body sizes below `{typography.body-md}` (14px) for primary reading text. CJK at smaller sizes fails AA on cream canvas.
- **Don't** load any web font. The system stack is the substitute set.
- **Don't** invent new color tokens. The 7 tags + amber/emerald semantic + primary blue + neutrals are the whole palette.
- **Don't** show money in the brand blue. Money is ink (default), emerald (positive), or rose (negative).
- **Don't** use `{rounded.lg}` (12px) on form inputs — inputs use `{rounded.sm}` (6px). The difference signals "you type here" without a shadow.

## 9. Responsive Behavior

### Breakpoints

| Name | Width | Key Changes |
|---|---|---|
| Wide | ≥ 1440px | Landing hero stretches to 1440px container; service grid 4-up |
| Desktop | 1024–1440px | Default content max-width 1280px; service grid 4-up |
| Tablet | 768–1023px | Service grid 3-up; side rail collapses to a top tab strip; sticky bottom nav appears |
| Mobile | < 768px | Service grid 2-up; nav collapses to hamburger; display sizes scale 56 → 36px on hero |
| Small | < 400px | Service grid 1-up; type drops one tier across the board |

### Touch Targets
- Pill buttons hit ≥ 44×44px on mobile via padding scaling.
- Form fields stay at 44px minimum height.
- `timeline-item` carries ≥ 56px row height for thumb-friendly tap.

### Collapsing Strategy
- Display sizes stair-step 56 → 44 → 32 → 26 → 22px through breakpoints.
- Service grid 4-up → 3-up → 2-up → 1-up.
- `card-feature` interior padding tightens from 32px desktop to 20px mobile.
- Section padding tightens from 64px → 32px → 20px.
- Dashboard panels (`{colors.canvas-soft}`) stack vertically below tablet.

### Image Behavior
- Work thumbnails use responsive `srcset`; aspect ratio is preserved per work (16:9 / 1:1 / 4:3).
- Loading is lazy on everything below the fold; `eager` on `/` and `/services` first viewport.
- No art-direction crop swaps — same composition reflows across all viewports.

## 10. Nighttime Mode (Dark)

Dark mode survives V2 as a derived nighttime user preference, NOT a brand expression. Marketing screenshots, landing hero, and "what is SeedLand" pitches always render light. Dark exists for late-night browsing of the same content. The toggle lives in settings or as a sun/moon icon in the user menu; there is no system-preference auto-switch by default — dark is opt-in.

### How dark mode works

The dark palette is **explicitly enumerated, not algorithmically derived.** Programmatic luminance inversion (the obvious shortcut) breaks for our palette — a tag-bg at L=0.94 inverted to L=0.06 disappears against night-canvas at L=0.16. Every dark token below has been hand-picked for legibility against night-canvas and WCAG AA contrast (text ≥ 4.5:1, UI components ≥ 3:1).

**Surface mapping** (each light token has an explicit dark counterpart in the frontmatter colors block):

| Light role | Dark counterpart |
|---|---|
| `{colors.canvas}` / `{colors.canvas-cream}` | `{colors.night-canvas}` / `{colors.night-canvas-cream}` (collapse to same value) |
| `{colors.canvas-soft}` | `{colors.night-canvas-soft}` |
| (card surface) | `{colors.night-card}` |
| `{colors.ink}` / `{colors.ink-secondary}` / `{colors.ink-mute}` / `{colors.ink-mute-2}` | `{colors.night-ink}` / `{colors.night-ink-secondary}` / `{colors.night-ink-mute}` / `{colors.night-ink-mute-2}` |
| `{colors.hairline}` / `{colors.hairline-strong}` / `{colors.hairline-input}` | `{colors.night-hairline}` / `{colors.night-hairline-strong}` / `{colors.night-hairline-input}` (alpha-white, lifted off transparent) |
| `{colors.primary}` / `{colors.primary-soft}` | `{colors.night-primary}` / `{colors.night-primary-soft}` (luminance UP not down — light surfaces darken in dark mode counterparts; primary brightens) |
| `{colors.money-positive}` / `{colors.money-negative}` | `{colors.night-money-positive}` / `{colors.night-money-negative}` (brighter to maintain ≥ 4.5:1 on dark) |
| `{colors.tag-{tint}-bg}` / `{colors.tag-{tint}-fg}` × 7 | `{colors.night-tag-{tint}-bg}` / `{colors.night-tag-{tint}-fg}` × 7 (dark surface, light text — INVERTED roles, not inverted luminance) |

**Elevation in dark**: Paper-halo shadows do NOT render well on dark — the stacked tiny black shadows are invisible against night-canvas, and lightening them produces banned colored-glow halos. In dark mode, card elevation is replaced by border-only treatment: `border: 1px solid {colors.night-hairline-strong}` on `paper-2` equivalents, plus the existing card border. There is no `night-paper-1`, `night-paper-2`, etc. — the elevation system collapses to "hairline ring or nothing" on dark.

### Implementation contract for Stage 13.2

The globals.css `[data-theme="dark"]` selector remaps each `--color-*` CSS variable from its light value to its night-* counterpart enumerated in the frontmatter. No JS, no relative color syntax, no programmatic transform. The mapping is a 1:1 lookup table maintained alongside the light palette.

The legacy `.dark` class selector from V1's existing theme system (per CLAUDE.md memory: stage 11.3 light/dark theme system) stays as-is for backwards compatibility, but every selector inside `.dark` should be rewritten to reference the night-* tokens declared here.

Do NOT brand on dark. Do NOT screenshot dark for marketing. Do NOT design new features against dark first.

## 11. Migration Notes (V1 → V2)

This system replaces `DESIGN.v1-cinematic-dark.md` (archived in `.archive/`). Key migration points:

- **Canvas**: `oklch(0.16 0.02 255)` dark default → `oklch(0.985 0.005 90)` cream light default. Dark survives only as nighttime opt-in.
- **Buttons**: `rounded-lg` rectangles → pill (`{rounded.pill}`).
- **Hover**: V1 "flat-by-default" rule retired. Honest paper-halo lift on hover (paper-2 → paper-3) is the new pattern.
- **Backdrop-blur**: V1 had it on sticky nav + dialog overlay; V2 removes everywhere.
- **Surface utilities**: `surface-glass` and `surface-glass-accent` retired. Replaced by `card-default`, `card-feature`, `card-cream-band`, `panel-dashboard`.
- **`text-gradient-brand`**: deleted in V1 plastic-glass cleanup, stays deleted in V2.
- **Accent palette**: V1 had `--accent-amber` + `--accent-emerald` only. V2 keeps those (renamed semantic) and adds 7 taxonomy tag tints (cyan / blue / violet / rose / amber / emerald / slate) — but ONLY for taxonomy chips, never emphasis.
- **Money / counts**: V1 had no tabular discipline. V2 introduces `tnum` everywhere numeric.
- **Eyebrow**: V1 `label-section` and `label-section-strong` uppercase utilities — restrict use to ≤ 2 per page in V2; section dividers carry structure instead.

NEXT STEP: globals.css needs to be rebuilt to expose these tokens. See Stage 13.2.
