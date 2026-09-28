---
version: alpha
name: Paper
description: Warm off-white canvas with ink text and terracotta accents.
colors:
  primary: "#1A1C1E"
  secondary: "#6C7278"
  tertiary: "#B8422E"
  neutral: "#FAF8F5"
  surface: "#FFFFFF"
  on-surface: "#1A1C1E"
  error: "#B0261F"
  border: "#E7E3DC"
  muted-foreground: "#6C7278"
typography:
  headline-lg:
    fontFamily: Public Sans
    fontSize: 32px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Public Sans
    fontSize: 24px
    fontWeight: 600
    lineHeight: 1.25
  body-md:
    fontFamily: Public Sans
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.6
  body-sm:
    fontFamily: Public Sans
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  label-md:
    fontFamily: Public Sans
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1
    letterSpacing: 0.04em
rounded:
  sm: 4px
  md: 8px
  lg: 12px
  full: 9999px
elevation:
  sm: "0 1px 2px rgba(20,20,20,0.06)"
  md: "0 3px 10px rgba(20,20,20,0.08)"
  lg: "0 12px 28px rgba(20,20,20,0.10)"
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 48px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: 12px
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.md}"
    padding: 10px
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: 24px
---

# Paper

## Overview
Paper feels like an editorial print layout translated to screen. A warm off-white canvas, deep ink text, and restrained terracotta accents. Aimed at reading-heavy and productivity contexts where visual noise should get out of the way.

## Colors
`{colors.primary}` carries headlines, body copy, and primary button fills, always on top of `{colors.neutral}` or `{colors.surface}` to preserve contrast. `{colors.secondary}` supports metadata, dividers, and captions but is intentionally too light for body text on the canvas. Reserve `{colors.tertiary}` as the single accent — one call-to-action or active state per view, no more. `{colors.neutral}` is the page canvas, warmer than pure white to feel organic; `{colors.surface}` sits slightly brighter above it so cards read as lifted without any shadow. `{colors.muted-foreground}` handles placeholder text and quiet metadata; `{colors.border}` is the hairline that separates same-tone surfaces.

## Typography
Use `{typography.headline-lg}` for page titles and `{typography.headline-md}` for section titles — semibold with tightened tracking so headings stay confident without shouting. `{typography.body-md}` is the default reading size on a comfortable 1.6 leading; constrain text columns near 65ch so paragraphs stay easy to scan. Reach for `{typography.body-sm}` in compact controls and dense metadata rows. `{typography.label-md}` is small and slightly uppercase, reserved for dates, tags, and byline chips — never for body copy.

## Layout
Fluid single-column on mobile, two-column max on desktop inside a 1200px container. `{spacing.md}` is the standard gutter between cards and controls, `{spacing.lg}` the internal padding on grouped panels, and `{spacing.xl}` the vertical rhythm between ungrouped sections so the page breathes between ideas. `{spacing.xs}` is a half-step available for micro-adjustments only.

## Elevation
Depth comes from tonal contrast, not shadow. `{colors.surface}` reads as elevated over `{colors.neutral}` purely because it's brighter and warmer. Reserve `{elevation.sm}` for hover-lift on interactive cards; `{elevation.md}` and `{elevation.lg}` exist for menus and modals but should feel rare — most of the page stays flat and print-like.

## Shapes
Softly geometric. Cards use `{rounded.lg}`, controls use `{rounded.md}`, and pills use `{rounded.full}`. Never mix sharp corners into rounded contexts — the visual language stays consistent across the whole surface.

## Components
Primary buttons run a solid `{colors.primary}` fill with `{colors.surface}` text and `{rounded.md}` corners; hover lightens the fill roughly 8% via color-mix with no shadow change. Secondary buttons stay transparent with a 1px `{colors.border}` outline and `{colors.primary}` text. Disabled state drops to 40% opacity with a not-allowed cursor and no hover.

Inputs sit on `{colors.surface}` with a 1px `{colors.border}` outline and `{rounded.md}` corners. On focus the outline swaps to `{colors.primary}` at 1.5px thickness; on error it swaps to `{colors.error}`. Placeholder text uses `{colors.muted-foreground}`.

Cards live on `{colors.surface}` over `{colors.neutral}` with `{rounded.lg}` corners and `{spacing.lg}` padding. Rely on tonal contrast for resting hierarchy — reach for `{elevation.sm}` or higher only when a card genuinely needs to lift above the flow (hover, drag, modal).

## Do's and Don'ts
- Do maintain WCAG AA (4.5:1 for body text) between `{colors.on-surface}` and every background you place it on.
- Do reserve `{colors.tertiary}` for at most one element per view.
- Don't use `{colors.secondary}` for body text on `{colors.neutral}` — its contrast dips below AA.
- Don't add drop shadows to convey resting elevation; layer `{colors.surface}` over `{colors.neutral}` instead.
