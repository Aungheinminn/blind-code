---
version: alpha
name: Terminal
description: Monospace, high-contrast, phosphor-green on black. A CLI aesthetic ported to the browser.
colors:
  primary: "#00FF41"
  secondary: "#33FF66"
  tertiary: "#FFB800"
  neutral: "#000000"
  surface: "#0A0A0A"
  on-surface: "#00FF41"
  error: "#FF3B3B"
  border: "#1A1A1A"
  muted-foreground: "#4A9960"
typography:
  headline-lg:
    fontFamily: JetBrains Mono
    fontSize: 26px
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: 0em
  headline-md:
    fontFamily: JetBrains Mono
    fontSize: 20px
    fontWeight: 700
    lineHeight: 1.2
  body-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.4
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: 500
    lineHeight: 1
    letterSpacing: 0.1em
rounded:
  sm: 0px
  md: 0px
  lg: 0px
  full: 0px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
components:
  button-primary:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: 12px
  button-primary-hover:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.neutral}"
  input:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: 10px
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: 20px
---

# Terminal

## Overview
Terminal is a CLI aesthetic in the browser. Pure-black canvas, phosphor-green text, monospace everywhere, zero rounded corners. Aimed at developer tools, log viewers, ops dashboards, and anywhere a "hacker green screen" mood is a feature not a bug.

## Colors
- **Primary (`{colors.primary}`)** — phosphor green. The default text color and the color of every active surface.
- **Secondary (`{colors.secondary}`)** — a slightly softer green, used for hover states on primary text and for muted emphasis.
- **Tertiary (`{colors.tertiary}`)** — amber. Reserved for warnings and non-critical highlights.
- **Neutral (`{colors.neutral}`)** — pure black canvas. Do not lighten.
- **Surface (`{colors.surface}`)** — near-black card surface, one shade above the canvas.

## Typography
- **Everything is monospaced.** JetBrains Mono at all sizes. No serif, no sans-serif variants.
- **Headlines:** `{typography.headline-lg}` and `{typography.headline-md}` in Bold, no tracking adjustment.
- **Body:** `{typography.body-md}` at 14px, Regular.
- **Labels:** `{typography.label-md}` uppercase with generous tracking for headers and metadata.

## Layout
Fixed-column grid on desktop (1200px max), full-fluid below. Consistent 8px spacing scale. Prefer dense information layouts — this design language rewards content density over whitespace.

## Elevation & Depth
There is no elevation. `{colors.surface}` and `{colors.neutral}` are separated by a single-shade tonal difference, occasionally reinforced by a 1px `{colors.border}`. No shadows, ever.

## Shapes
Everything is sharp. `{rounded.md}` and `{rounded.lg}` both resolve to `0px`. Buttons, cards, inputs, chips — all rectangular. Do not soften any corner.

## Components
### Buttons
- **Primary:** `{colors.neutral}` background, `{colors.primary}` text, 1px `{colors.primary}` outline, `0px` corners.
- **Hover:** invert — swap backgroundColor to `{colors.primary}` and textColor to `{colors.neutral}`.
- **Disabled:** 40% opacity, `not-allowed` cursor, no hover.

### Inputs
- Default: `{colors.neutral}` fill, `{colors.primary}` text, 1px `{colors.border}` outline.
- Focused: swap outline to `{colors.primary}`.
- Error: swap outline to `{colors.error}`; use `{colors.error}` for the caret and helper text.

### Cards
- `{colors.surface}` on `{colors.neutral}`, `0px` corners, `{spacing.lg}` padding, optional 1px `{colors.border}` outline.

## Do's and Don'ts
- Do maintain the monospace discipline everywhere; even numeric labels are mono.
- Do keep `{colors.tertiary}` (amber) for warnings only; never mix with success/info states.
- Don't round any corner — the aesthetic depends on sharp edges.
- Don't introduce any color outside the palette; the constraint is the point.
