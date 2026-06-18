---
target: Globe home screen (src/components/Globe.jsx)
total_score: 24
p0_count: 0
p1_count: 2
timestamp: 2026-06-18T00-55-01Z
slug: src-components-globe-jsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Hover changes spike/cursor, but sector→category mapping relies on labels that fade past ~75° rotation |
| 2 | Match System / Real World | 2 | Globe-as-catalog has no retail convention to anchor to; intentional, but real first-time orientation cost |
| 3 | User Control and Freedom | 3 | LIMPIAR and lookbook ✕ work; no deep-link/back state for a picked category |
| 4 | Consistency and Standards | 2 | index.css now declares "Alte Haas Grotesk" as primary font, contradicting DESIGN.md's single-typeface (Helvetica Neue) rule — see Anti-Patterns below for the live-render nuance |
| 5 | Error Prevention | 3 | 5px drag-vs-click threshold and zoom clamps (0.7-2.6) guard against mis-taps and runaway zoom |
| 6 | Recognition Rather Than Recall | 2 | Unfiltered globe's category labels rotate out of view; user must recall sector position rather than re-recognize it |
| 7 | Flexibility and Efficiency | 3 | Multi-select categories + direct spike-to-lookbook serve casual and intentional paths |
| 8 | Aesthetic and Minimalist Design | 3 | Disciplined flat system; the right-side hover card (blur+lift) is the one denser visual moment, used per DESIGN.md's documented exception |
| 9 | Error Recovery | 2 | Broken product images silently hide `<img>`, leaving an unexplained grey tile; no empty-state copy for thin filter results |
| 10 | Help and Documentation | 1 | No onboarding hint that the globe is draggable beyond a `cursor: grab` (invisible on touch) |
| **Total** | | **24/40** | **Acceptable — solid foundation, real gaps in discoverability** |

## Anti-Patterns Verdict

**LLM assessment**: Does not read as AI-generated SaaS template. The hand-rolled canvas globe, manifesto copy, and absence of card grids/rounded buttons/gradients are genuinely distinctive — a template generator would not produce this. The hover card's `backdrop-filter: blur(12px)` + soft lift is the one moment closest to a generic "frosted card," though it's the system's own documented sole exception (Overlay Lift), not slop.

**Deterministic scan** (`detect.mjs` on Globe.jsx, App.jsx, index.css): 4 hits, all `design-system-font` warnings — "Alte Haas Grotesk" used in index.css (lines 2, 9, 26, 32) is not declared in DESIGN.md's typography block.

**Browser evidence** (live render, detect.js overlay injected into the running page): only 3 findings fired, and they tell a *different* story than the CLI scan:
- `single-font`: only Helvetica Neue is actually rendering on the page.
- `all-caps-body` ×2: the hero eyebrow ("PLATAFORMA DE MODA CHILENA...") and the "REGIONES/CATEGORÍAS" label are uppercase body-role text.

**Reconciling the two**: the CLI scan is right that the CSS *declares* Alte Haas Grotesk, but the browser confirms it never paints — every component (`Globe.jsx`, `Lookbook.jsx`, `Product.jsx`) hardcodes `fontFamily: "Helvetica Neue"...` inline (14 occurrences across the three files), and inline styles win over the inherited `body` font. The new `@font-face` + its two `.ttf` files in `public/fonts/` are currently **dead code with zero visual effect**, not a live brand drift. This downgrades the issue from "ships wrong" to "decide and wire in, or delete" — see Priority Issues.

The `all-caps-body` findings are **false positives** for this project: DESIGN.md's "All-Caps Chrome Rule" explicitly mandates uppercase for all UI chrome including body-role text ("even body copy is uppercase... reserved for nothing in this system"). The generic detector doesn't know this project's documented exception.

## Overall Impression

The core mechanic (drag-to-rotate globe of product spikes) is the one thing here that couldn't have come from a template, and it's executed with real restraint — opacity-only depth shading, no color crutch, disciplined flat surfaces. The gap is entirely in discoverability: nothing teaches a first-timer that the globe is interactive, and the one legend explaining what the four regions mean rotates out of view exactly when it's needed. Biggest opportunity: a near-zero-cost onboarding cue (one-time drag hint) would likely move the Help & Documentation score from 1 to 3 on its own.

## What's Working

- **The globe-as-catalog metaphor** (Globe.jsx canvas: fibonacci dot sphere, lat/lng spikes) — fully custom math, not a wrapped library, and it's load-bearing for the thesis's "discovery over search" argument.
- **Spike depth-shading without color** — opacity-based depth cues honor the Two-Ink Rule while still reading as dimensional.
- **Drag-vs-tap disambiguation** (5px move threshold before treating a pointer-down as a drag) — small mechanic, but it's the difference between a globe that feels broken (every drag opens a product) and one that feels intentional.

## Priority Issues

**[P1] No drag/rotate affordance hint.**
Why it matters: PRODUCT.md's audience is "browsing not searching" — if a first-timer doesn't discover the drag in the first few seconds, they bounce, and the flagship interaction goes unseen.
Fix: one-time subtle directional cue (faint animated swipe arc), gated behind a `localStorage` "seen" flag, removed after first drag.
Suggested command: `/impeccable onboard`

**[P1] Category legend disappears at the globe's curve.**
Why it matters: SUPERIOR/INFERIOR/VESTIDOS/ACCESORIOS labels are the only explanation of what the four sectors mean, and they fade past `r[2] <= 0.25` — right when the user is mid-rotation trying to navigate, forcing memory recall instead of recognition.
Fix: persistent static legend (even a small corner key) independent of rotation state, or screen-anchored labels when 3D position would clip.
Suggested command: `/impeccable clarify`

**[P2] Mobile has no equivalent to the hover-preview card.**
Why it matters: under 768px `.pac-hovercard { display: none }` removes the desktop "preview before commit" step entirely, with no tap/hold replacement — and per PRODUCT.md, casual mobile browsing is the primary expected behavior, not the edge case.
Fix: lightweight tap-and-hold or single-tap preview sheet for touch.
Suggested command: `/impeccable adapt`

**[P3] Dead font-face CSS, decide or delete.**
Why it matters: `@font-face "Alte Haas Grotesk"` plus its two `.ttf` files are declared but currently paint nowhere (every component inline-overrides with Helvetica Neue). It's harmless today but it's a doc/CSS mismatch waiting to confuse the next person who reads DESIGN.md or extends the system.
Fix: either wire the new font into the inline `FONT`/`T.font` constants and update DESIGN.md's typography block deliberately, or remove the unused `@font-face` + font files.
Suggested command: `/impeccable typeset`

**[P3] Broken product images fail silently.**
Why it matters: `onError` just hides the `<img>`, leaving a bare grey tile with no signal — at ~15 externally-sourced brand catalogs, some image breakage is likely, and a silent grey square undercuts the "cult/editorial" confidence the brand is going for.
Fix: minimal text fallback inside the tile (brand initial or "IMG ✕" in Label-role type) instead of nothing.
Suggested command: `/impeccable harden`

## Persona Red Flags

**Jordan (first-timer):** Lands on a still globe with no instruction; the one legible CTA ("VER TODO EL LOOKBOOK →") bypasses the globe mechanic entirely, so the flagship interaction can be skipped by the exact user it's designed to delight.

**Riley (stress-tester):** Rapid category toggling while a spike is mid-hover can show a hover-card item that's no longer in the active filter set for one frame (ref-based state, not React state, so it lags a tick behind).

**Casey (mobile, low-intent browser):** The hover-preview card vanishing entirely on mobile removes the one low-commitment glance step Casey needs most — and mobile is the primary expected device per PRODUCT.md's audience description.

## Minor Observations

- Ticker loop (28s linear for 15 names doubled) is slow enough that a skimming user may lose patience before a name reappears.
- "LIMPIAR ✕" and the lookbook close "✕" reuse the same glyph for two different actions (clear-filter vs. close-overlay) — minor icon-meaning overload.
- The category count badge (`counts[k]`, zero-padded) is a nice editorial-dossier touch, consistent with DESIGN.md's "dense declarative dossier" language.

## Questions to Consider

1. If the globe's only legend disappears during the exact gesture it's designed to teach, is the globe teaching navigation or punishing it?
2. Is Alte Haas Grotesk a real, in-progress brand decision or leftover experimentation — and if real, does DESIGN.md's "single typeface, no pairing" argument survive the swap, or does the whole typography section need a rewrite rather than a patch?
3. Has the mobile discovery flow been tested on an actual phone, given the hover-card (the desktop "preview before commit" step) has no mobile equivalent at all right now?
