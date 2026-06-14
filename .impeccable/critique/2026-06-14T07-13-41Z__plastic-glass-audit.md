---
target: plastic-glass UI audit
total_score: 25
p0_count: 3
p1_count: 2
timestamp: 2026-06-14T07-13-41Z
slug: plastic-glass-audit
---
# Plastic-Glass Audit — SeedLand · V

## Design Health Score: 25/40 (Acceptable)

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | OK |
| 2 | Match System / Real World | 3 | OK |
| 3 | User Control and Freedom | 3 | OK |
| 4 | Consistency and Standards | 1 | Plastic-glass pattern drift across 5 independent implementations (rank medals ×2, avatar gradients ×4, hero 3-stop gradient ×4, glass play button ×2) |
| 5 | Error Prevention | 3 | OK |
| 6 | Recognition Rather Than Recall | 3 | OK |
| 7 | Flexibility and Efficiency | 3 | OK |
| 8 | Aesthetic and Minimalist Design | 1 | One Voice broken by 5-color accent palette; glassmorphism pearl is the default not the exception; blur-3xl glow appears 4×; rainbow tiles on home/community |
| 9 | Error Recovery | 3 | OK |
| 10 | Help and Documentation | 2 | DESIGN.md is excellent but implementation has drifted significantly |
| **Total** | | **25/40** | Functions work; visual design has not delivered DESIGN.md's "cinematic, hand-crafted" promise |

## Anti-Patterns Verdict

**Does this look AI-generated? Yes.** The code violates every Web3/NFT anti-pattern DESIGN.md explicitly bans:

- **Rainbow gradients**: home QUICK_ENTRIES 4 tiles, hot-post rank medals ×2, avatar fallbacks 4×, community-hero 4-color icons, channel-header 4-color stats
- **Glassmorphism pearls**: `surface-glass` 3-stop gradient (inherited site-wide), home `blur-3xl`, community-hero `blur-3xl`, channel-header per-channel blur, work-card thumbnail radial highlight + scrim, work-card frosted play button
- **Metaverse atmosphere**: 4 sites use `from-primary/10 via-transparent to-fuchsia-500/6`
- **Ghost border over-dilution**: `border-border/60` ×20+ (DESIGN.md explicitly bans this)
- **backdrop-blur abuse**: navbar, mobile-nav, sticky tabs, dialog overlay, FAB, report-button
- **Gradient text overuse**: `text-gradient-brand` used 2× in hero H1 (rule: once per page max)
- **One Voice broken**: 5 accent hues hoisted to `:root`; Badge has `cyan` and `accent`(fuchsia) variants

Detector caught only 2 sites (both gradient-text); human readers found 70+ contextual violations.

## What's Working

1. DESIGN.md itself is exceptionally well-written — the failure is implementation drift, not design intent
2. Token + utility abstraction layer exists (`surface-card`, `label-section`, `focus-ring`)
3. Dark background hue (`oklch(0.16 0.02 255)`) is correctly tinted-blue

## Priority Issues

### [P0] `globals.css` surface utilities are the root of the glass feel
- Replace `surface-glass` 3-stop gradient with flat `bg-card` + single 1px inset highlight
- Flatten `surface-glass-accent` to `bg-primary/[0.06] border-primary/30`
- Delete `text-gradient-brand` utility
- Body radial: drop violet stop, keep single blue at low alpha
- Restore `border-border` (full strength) on surface-card; bump dark `bg-card/40` → `bg-card/80`
- Suggested: `/impeccable quieter`

### [P0] Home hero `QUICK_ENTRIES` rainbow tiles + double gradient text + blur-3xl
- Drop the `tone` array; render 4 tiles as flat `surface-card border-border`
- Delete the `blur-3xl bg-primary/20` glow
- Reduce `text-gradient-brand` to zero in hero (or one phrase max)
- Sticky tabs: solid `bg-background`, no backdrop-blur
- Suggested: `/impeccable quieter`

### [P0] WorkCard / PostCard hover cyan-glow + frosted play button + 9-hue category badges
- Remove all `hover:shadow-[…rgba(56,189,248,…)]` from work-card / post-card / tool-card
- Strip white radial highlight on thumbnails
- Replace `bg-white/15 backdrop-blur-md ring-white/30` play button with flat `bg-foreground/10`
- Drop `backdrop-blur` from duration chip
- Collapse 9-hue category badges to monochrome
- Fix silent bug: post-card hover-shadow uses CSS-var interpolation that doesn't render
- Suggested: `/impeccable quieter` + `/impeccable distill`

### [P1] Community + static page shells share `primary→fuchsia` atmosphere (4 sites)
- Drop fuchsia stop everywhere; delete `blur-3xl` glow pearls
- Extract shared `<HeroShell>` to prevent future drift
- Suggested: `/impeccable extract` + `/impeccable quieter`

### [P1] Chrome backdrop-blur abuse + cyan-glow logo
- Logo → flat `bg-primary` (no cyan→blue gradient, no glow)
- navbar / mobile-nav → solid bg, no backdrop-blur
- Dialog overlay → no backdrop-blur-sm; replace `shadow-2xl` with inset highlight
- Suggested: `/impeccable quieter`

## Persona Red Flags

- **Casey (mobile)**: Sticky top tabs + bottom nav both `backdrop-blur` flicker on iOS Safari; mobile-nav active-tab cyan glow conflicts with the restrained tone
- **Sam (a11y)**: `border-border/60` dilutes edge to ~5%, low-vision users lose card boundaries; `bg-card/40` over body radial may fail AA contrast
- **Alex (peer expert)**: Reads as "AI copied a SaaS template without reading the project's own DESIGN.md" — exactly the judgment this project tries to escape

## Minor Observations

- `post-card.tsx:73` hover-shadow uses `rgba(var(--color-primary)/0.06)` which Tailwind cannot resolve — shadow has been dead code for months
- `label-section` utility used by every sidebar section heading — parent impeccable skill bans "tiny uppercase eyebrows above every section"
- Avatar gradient fallbacks drift across 4 independent files (messages/page, message-bubble, group-member-list, collaboration-card, work-card)
- Hot-post rank medals duplicated as `rankStyle` array in 2 files

## Questions to Consider

- If the home hero loses the rainbow tiles + blur + gradient text, can the H1 + 2 CTAs carry the first viewport? (Yes — DESIGN.md says "silence beats shouting")
- Should the 5 accent hues be demoted to taxonomy-only, or pruned down to 1-2 only (cyan + amber)?
- Should `glass` and `accent` variants be removed from the Card primitive's type union to prevent future drift?
