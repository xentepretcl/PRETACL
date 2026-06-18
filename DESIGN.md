---
name: PRET-A-CL
description: Globe-based curatorial discovery platform for independent Chilean fashion brands
colors:
  ink: "#0a0a0a"
  paper: "#ffffff"
  ink-soft: "#666666"
  ink-muted: "#6a6a72"
  hairline: "rgba(0,0,0,0.14)"
  hairline-strong: "rgba(0,0,0,0.30)"
  tile-grey: "#e8e8e6"
  tile-grey-soft: "#ececef"
  canvas-grey: "#f4f4f2"
typography:
  display:
    fontFamily: '"Alte Haas Grotesk", "Helvetica Neue", Helvetica, Arial, sans-serif'
    fontSize: "88px"
    fontWeight: 700
    lineHeight: 0.85
    letterSpacing: "-4px"
  headline:
    fontFamily: '"Alte Haas Grotesk", "Helvetica Neue", Helvetica, Arial, sans-serif'
    fontSize: "44px"
    fontWeight: 700
    lineHeight: 0.95
    letterSpacing: "-1px"
  title:
    fontFamily: '"Alte Haas Grotesk", "Helvetica Neue", Helvetica, Arial, sans-serif'
    fontSize: "34px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.5px"
  subtitle:
    fontFamily: '"Alte Haas Grotesk", "Helvetica Neue", Helvetica, Arial, sans-serif'
    fontSize: "22px"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "0px"
  item-label:
    fontFamily: '"Alte Haas Grotesk", "Helvetica Neue", Helvetica, Arial, sans-serif'
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.5px"
  heading-sm:
    fontFamily: '"Alte Haas Grotesk", "Helvetica Neue", Helvetica, Arial, sans-serif'
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.3px"
  body:
    fontFamily: '"Alte Haas Grotesk", "Helvetica Neue", Helvetica, Arial, sans-serif'
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: "0.2px"
  label:
    fontFamily: '"Alte Haas Grotesk", "Helvetica Neue", Helvetica, Arial, sans-serif'
    fontSize: "10px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "1.5px"
rounded:
  sharp: "0px"
  tile: "2px"
spacing:
  xs: "8px"
  sm: "14px"
  md: "18px"
  lg: "32px"
  xl: "64px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.sharp}"
    padding: "14px 32px"
  button-primary-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
  button-ghost:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sharp}"
    padding: "14px 18px"
  button-ghost-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
  chip-filter:
    backgroundColor: "rgba(255,255,255,0.8)"
    textColor: "{colors.ink}"
    rounded: "{rounded.sharp}"
    padding: "12px 18px"
  chip-filter-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
  tile-product:
    backgroundColor: "{colors.tile-grey}"
    rounded: "{rounded.tile}"
---

# Design System: PRET-A-CL

## 1. Overview

**Creative North Star: "The Manifesto Wall"**

PRET-A-CL reads like a black-on-white protest poster, not a storefront: declarative all-caps grotesque sans, hairline rules instead of cards, and a globe of black spikes standing in for a product catalogue. The system rejects every retail tell — no sale badges, no rounded pill buttons, no carousels, no pastel softening — because the brand line is explicit: "NO ES RETAIL. ES CULTO." Density is generous (large display type, wide negative space at the globe home) but tightens hard once the user commits to a category or product, where information is delivered as a dense, declarative dossier (brand meta, history, price, single CTA).

Depth comes from contrast and hairlines, never from shadow-as-decoration. Motion is restrained and physical — drag-inertia grids, easing curves, no bounce — reinforcing that this is a tool for browsing, not a marketing animation reel.

**Key Characteristics:**
- Pure black ink (#0a0a0a) on pure white paper (#ffffff); no tinted neutrals, no warm cream
- Single typeface (Alte Haas Grotesk, falling back to Helvetica Neue) carries the entire system — no display/body pairing
- Zero border-radius by default; the rare 2px on lookbook tiles is the only softening in the system
- Flat by default; the one allowed elevation is a soft lift on floating overlay panels (hover card, hint), never on buttons or tiles
- All interactive labels are uppercase and letter-spaced — there is no sentence-case UI copy

## 2. Colors

Two colors carry the entire system — ink and paper — with grey reserved strictly for image placeholders and secondary text, never for decoration.

### Primary
- **Ink** (#0a0a0a): The single brand color. Used as text-on-white everywhere, and inverted to background on every primary action (CTA buttons, active filter chips, ticker strip, hover-invert states).

### Neutral
- **Paper** (#ffffff): The base background for every screen and overlay. Never tinted.
- **Ink Soft** (#666666): Secondary text — captions, prices in tile labels, brand-name byline in the lookbook caption bar.
- **Ink Muted** (#6a6a72): Tertiary/meta text — section eyebrows, globe intro copy, filter section labels. Slightly cooler than Ink Soft; reserve it for the Globe home screen's supporting copy only.
- **Hairline** (rgba(0,0,0,0.14)): Default divider/border weight — header underlines, panel separators.
- **Hairline Strong** (rgba(0,0,0,0.30)): Border weight for ghost buttons and unselected filter chips, where the control needs to read as clickable without filling.
- **Tile Grey** (#e8e8e6): Image-placeholder background behind product photos before they load, and the photo gutter background in the Product detail gallery.
- **Tile Grey Soft** (#ececef): Slightly lighter variant used for Lookbook-overlay tiles and the globe hover-card image well.
- **Canvas Grey** (#f4f4f2): The drag-viewport background behind the category lookbook grid — distinguishes the scrollable canvas from the white chrome around it.

### Named Rules
**The Two-Ink Rule.** The palette is ink and paper. Any third color is a placeholder-grey for unloaded imagery, never a decorative accent. If a screen needs a third *brand* color, that's a sign the screen has drifted off-system.

## 3. Typography

**Display Font:** "Alte Haas Grotesk", "Helvetica Neue", Helvetica, Arial, sans-serif (self-hosted webfont, regular + bold)
**Body Font:** "Alte Haas Grotesk", "Helvetica Neue", Helvetica, Arial, sans-serif (same family — there is no pairing)

**Character:** One typeface doing every job, from 88px hero to 10px tracked labels — confidence comes from scale and weight contrast, not from font variety.

### Hierarchy

An 8-step scale, each step a deliberate jump (≥1.12×, mostly ≥1.2×) from its neighbor: **10 → 13 → 16 → 18 → 22 → 34 → 44 → 88**. Icon glyphs (the ✕ close icon, the ticker's ◆ separator, the chip's ✓ checkmark) sit outside this scale — they're pictograms, not reading hierarchy.

- **Display** (700, 88px, line-height 0.85, letter-spacing -4px): The globe home hero wordmark ("PRET-A-CL©") only. Appears once per session.
- **Headline** (700, 44px, line-height 0.95, letter-spacing -1px): Brand name in the Product detail view (column 1).
- **Title** (700, 34px, line-height 1, letter-spacing -0.5px): Product name in the Product detail view.
- **Subtitle** (500, 22px, line-height 1): Price emphasis (Product detail) and the floating "PRET-A-CL" wordmark over the Lookbook grid.
- **Item label** (700, 18px, letter-spacing 0.5px, uppercase): Category names inside filter chips ("SUPERIOR", "VESTIDOS") — the largest text in a list-item context.
- **Heading-sm** (700, 16px, line-height 1.2, letter-spacing 0.3px, uppercase): Compact headings inside dense panels — the CatLookbook header wordmark, the selected-item name in its bottom strip.
- **Body** (500, 13px, line-height 1.5, letter-spacing 0.2px): Brand history copy, intro paragraph on the globe home, button microcopy, compact price text. Cap prose blocks at ~60ch (the Product column-1 history text is already constrained to 340px).
- **Label** (700, 10px, letter-spacing 1.5px, uppercase): Every eyebrow, caption, and meta string in the system — "MARCA", "REGIONES/CATEGORÍAS", tile captions, the brand ticker (which alone gets extra-wide 3.5px tracking for its marquee context). The most-used role in the system; every instance of this role uses the same size and tracking, no exceptions.

### Named Rules
**The All-Caps Chrome Rule.** Anything that is UI scaffolding rather than content (buttons, captions, eyebrows, nav labels) is uppercase and letter-spaced. Sentence case is reserved for nothing in this system — even body copy is uppercase. Lowercase, normal-tracked text would read as a bug, not a feature.

**The One Role, One Size Rule.** Every instance of the same semantic role (eyebrow, button text, price, caption) renders at the exact same size and letter-spacing everywhere it appears, never a pixel off "because this context felt smaller." Where two elements with the same role visually need to differ, that's a weight, color, or tracking change — never a silent size drift.

## 4. Spacing

A 5-step scale, exported as `S` from `src/tokens.js`: **xs 8 · sm 14 · md 18 · lg 32 · xl 64**. Use it for padding, margin, and gap values that are genuinely spacing (the gap between two elements), not for component dimensions (tile size, panel height, photo height) — those are content-driven and sized independently.

- **xs (8px):** Tightest gaps — button-row gaps, a label sitting directly under its control.
- **sm (14px):** Default control padding (vertical button/chip padding), gaps between adjacent inline controls.
- **md (18px):** Secondary block spacing — space between a heading and the paragraph below it, horizontal control padding.
- **lg (32px):** Section-level spacing — padding around a dense info column, space before a primary CTA.
- **xl (64px):** Page-edge offsets — the globe hero's distance from the viewport edge.

### Named Rules
**The Scale-or-Explain Rule.** A spacing value either comes from `S` or it's a measurement with a reason that isn't "spacing" (a tile's fixed width, a header's fixed height, a calculated grid offset). New magic-number paddings/margins/gaps should be caught in review.

## 5. Elevation

The system is flat at rest: every panel, tile, and button uses a hairline border or solid fill, never a shadow, to read as "in front of" something else. The one exception is floating overlay content that has no edge to anchor to — the globe's hover-preview card — which gets a soft ambient lift so it visibly detaches from the canvas behind it.

### Shadow Vocabulary
- **Overlay Lift** (`box-shadow: 0 12px 32px rgba(0,0,0,0.18)`): Applied to the globe hover-preview card and any future floating (non-edge-to-edge) panel. Paired with the existing `backdrop-filter: blur(12px)` glass treatment already used on that card. Do not apply to buttons, chips, or tiles — those stay flat and rely on the invert-on-hover treatment instead.

### Named Rules
**The Flat-Unless-Floating Rule.** If a surface touches the edge of its container (full-bleed overlays, tiles in a grid, buttons in a row), it is flat. If it floats free over other content with no container edge, it gets Overlay Lift. There is no third state.

## 6. Components

Every interactive element is blunt and confident: sharp corners, a 1px or solid-fill boundary, and a full ink/paper color-invert on hover rather than a tint or glow.

### Buttons
- **Shape:** Sharp corners throughout (0px radius) — no exceptions for buttons.
- **Primary (CTA):** Ink background, paper text, 700 weight, uppercase, letter-spacing 1.5–2px, padding 14–18px vertical / 24–32px horizontal. Used for "LOOKBOOK COMPLETO →", "VER LOOKBOOK", "COMPRAR EN [STORE] ↗". Hover drops opacity to ~0.86 and scales to 0.96 on press — a fade, not a color change, since it's already at full ink saturation.
- **Ghost (secondary):** Paper background, ink text, 1px hairline-strong border. Used for "LIMPIAR ✕", the wishlist button, and the close (✕) button. Hover inverts fully to ink background / paper text over 150ms; press scales to 0.9–0.96.

### Chips (filter chips)
- **Style:** Unselected — paper background at 80% opacity with backdrop blur, hairline-strong border, ink text. Selected — solid ink background, paper text, hairline border becomes pure black.
- **State:** Toggleable (multi-select), not single-select-radio. A checkbox glyph (✓ in a 16×16 bordered square) sits inside the chip and inverts with the rest of the chip on selection. A count badge (zero-padded, e.g. "04") sits between the checkbox and the label.

### Cards / Containers (product tiles)
- **Corner Style:** Sharp (0px) in the main Lookbook drag-grid; 2px in the Category Lookbook overlay grid only — the system's sole softening, used there to slightly distinguish the focused/selected tile's outline from its neighbors.
- **Background:** Tile Grey (#e8e8e6) or Tile Grey Soft (#ececef) showing through until the product photo loads.
- **Shadow Strategy:** None (see Elevation — tiles are flat, edge-to-edge in a grid).
- **Border:** None at rest; the selected tile in Category Lookbook gets a 2px solid ink outline with 2px offset.
- **Internal Padding:** Caption bar is a solid or gradient white scrim over the bottom of the image, 7–9px vertical / 9–10px horizontal padding, containing the uppercase product name (left) and price or brand name (right).

### Inputs / Fields
Not present in the current system — there are no text inputs, only drag/pointer interactions and click targets. If one is added, it should follow the Ghost button treatment (hairline border, sharp corners, invert-style focus ring) rather than a soft Material-style filled field.

### Navigation
There is no persistent nav bar. Wayfinding is the brand ticker (auto-scrolling marquee of all 15 brand names, ink background, paper text, 10.5px label type, 28s linear loop) at the top of the Globe home screen, plus a single ✕ close control on every overlay. Mobile/narrow treatment is not yet defined — the globe canvas and drag-grids are pointer/touch-driven already, but layout breakpoints have not been authored.

### Signature Component: The Globe
The home screen's product canvas is a hand-rolled `<canvas>` globe: a Fibonacci-distributed dot sphere with black "spikes" rising off it per product, grouped into four sectors (SUPERIOR / INFERIOR / VESTIDOS / ACCESORIOS). Hover and selection states change spike color/weight/length rather than introducing new chrome — depth and emphasis are conveyed by spike opacity (`rgba(0,0,0, depth-based)`), never by color hue. Any future "discovery" surface in this product should default to this kind of data-as-geometry treatment over a literal data table or card grid.

## 7. Do's and Don'ts

### Do:
- **Do** keep the palette to ink (#0a0a0a) and paper (#ffffff), with grey reserved for unloaded-image placeholders only (Tile Grey #e8e8e6, Tile Grey Soft #ececef, Canvas Grey #f4f4f2).
- **Do** set every UI chrome string (buttons, captions, eyebrows, nav labels) in uppercase with letter-spacing — this is the Label role and it is the most-used type role in the system.
- **Do** use 0px border-radius on every button, chip, and grid tile; the 2px tile radius in Category Lookbook is the sole sanctioned exception.
- **Do** invert ink/paper fully on hover for ghost buttons and active chips rather than introducing a tint or accent color.
- **Do** reserve Overlay Lift (`0 12px 32px rgba(0,0,0,0.18)` + blur) for floating, edge-free panels only (the globe hover card and similar future popovers).

### Don't:
- **Don't** build anything that reads as generic e-commerce — no product cards with sale badges, no carousels, no banner promos, no star ratings. This was named directly in PRODUCT.md's anti-references.
- **Don't** introduce corporate SaaS-cream minimalism — no pastel or cream backgrounds, no gradient-text headlines, no rounded pill buttons.
- **Don't** add shadows to buttons, chips, or grid tiles. Flat-by-default applies everywhere except genuinely floating overlay content (see The Flat-Unless-Floating Rule).
- **Don't** introduce a second typeface. Alte Haas Grotesk carries display through label; pairing in a serif or a mono would break The All-Caps Chrome Rule's confidence-through-scale logic.
- **Don't** simulate checkout inside PRET-A-CL. Every purchase path is an outbound link to the brand's own store — the product detail view's only commerce action is "COMPRAR EN [STORE] ↗".
