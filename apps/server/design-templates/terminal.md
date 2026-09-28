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
elevation:
  sm: "0 0 0 1px #1a1a1a"
  md: "0 0 12px rgba(0,255,65,0.20)"
  lg: "0 0 32px rgba(0,255,65,0.35)"
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
Terminal is a CLI aesthetic in the browser. Pure-black canvas, phosphor-green text, monospace everywhere, zero rounded corners. Aimed at developer tools, log viewers, ops dashboards, and anywhere a "hacker green screen" mood is a feature, not a bug.

## Colors
`{colors.primary}` is the default text color and the color of every active surface. `{colors.secondary}` is a slightly softer green for hover on primary text and for muted emphasis. Reserve `{colors.tertiary}` for warnings and non-critical highlights — never for success or info. `{colors.neutral}` is the pure-black canvas and must not be lightened. `{colors.surface}` is a near-black card layer one tonal shade above the canvas, just enough to read as elevated without breaking the ink discipline. `{colors.on-surface}` names the phosphor as the semantic text color; `{colors.muted-foreground}` handles less-critical metadata; `{colors.border}` is the same-shade hairline used to separate stacked surfaces.

## Typography
Everything is monospaced — JetBrains Mono at every size, no serif or sans-serif variants. `{typography.headline-lg}` and `{typography.headline-md}` run bold with no tracking adjustment. `{typography.body-md}` sits at 14px regular for legibility in dense logs; `{typography.body-sm}` compresses supporting rows. `{typography.label-md}` stays uppercase with generous tracking for section headers and machine-readable metadata.

## Layout
Fixed-column grid on desktop (1200px max), full-fluid below. `{spacing.sm}` and `{spacing.md}` handle inline and gutter rhythm; `{spacing.lg}` sets card padding; `{spacing.xl}` separates primary sections. Prefer dense information layouts — this design language rewards content density over whitespace.

## Elevation
There is no true elevation. `{colors.surface}` and `{colors.neutral}` are separated by a single tonal shade, occasionally reinforced by a 1px `{colors.border}` outline. `{elevation.md}` is a soft phosphor glow that can hint at focus or hover; `{elevation.lg}` reserves the same glow at higher intensity for critical states. Never use a soft ambient drop shadow — the aesthetic depends on sharp edges and clean tonal layers.

## Shapes
Everything is sharp. `{rounded.sm}`, `{rounded.md}`, and `{rounded.lg}` all resolve to 0px — buttons, cards, inputs, chips are all rectangular. Do not soften any corner; the aesthetic depends on it.

## Components
Primary buttons run a `{colors.neutral}` background with `{colors.primary}` text and a 1px `{colors.primary}` outline at `{rounded.md}` corners. On hover, invert — background becomes `{colors.primary}` and text becomes `{colors.neutral}`. Disabled state drops to 40% opacity with a not-allowed cursor and no hover.

Inputs use `{colors.neutral}` fill, `{colors.primary}` text, and a 1px `{colors.border}` outline. On focus, swap the outline to `{colors.primary}`; on error, swap the outline and caret to `{colors.error}` and pair with helper text in the same red.

Cards live on `{colors.surface}` over `{colors.neutral}` with `{rounded.lg}` corners and `{spacing.lg}` padding. A 1px `{colors.border}` outline is optional for popovers and modals; resting cards stay borderless and rely on the single-shade tonal jump.

## Do's and Don'ts
- Do maintain the monospace discipline everywhere; even numeric labels stay mono.
- Do keep `{colors.tertiary}` for warnings only; never mix with success or info states.
- Don't round any corner — the aesthetic depends on sharp edges.
- Don't introduce any color outside the palette; the constraint is the point.
