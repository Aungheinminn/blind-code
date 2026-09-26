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
Paper feels like an editorial print layout translated to screen. Warm off-white canvas, deep ink text, restrained terracotta accents. Aimed at reading-heavy and productivity contexts where visual noise should get out of the way.

## Colors
- **Primary (`{colors.primary}`)** — headlines, body text, primary button surfaces. Always on `{colors.neutral}` or `{colors.surface}` to preserve contrast.
- **Secondary (`{colors.secondary}`)** — metadata, borders, captions. Never for body text on `{colors.neutral}`.
- **Tertiary (`{colors.tertiary}`)** — the single accent. Reserve for primary actions, active states, and error-adjacent emphasis. One tertiary per view.
- **Neutral (`{colors.neutral}`)** — the page canvas. Warmer than pure white to feel organic.
- **Surface (`{colors.surface}`)** — cards and inputs sit on this. Slightly brighter than the canvas to feel lifted without shadow.

## Typography
- **Headlines:** `{typography.headline-lg}` for page titles, `{typography.headline-md}` for section titles. Semibold, tightened tracking.
- **Body:** `{typography.body-md}` at 16px is the default. Constrain text columns to `65ch` for comfortable reading.
- **Labels:** `{typography.label-md}` in slight uppercase for metadata (dates, tags, byline). Do not use for body copy.

## Layout
Fluid single-column on mobile, two-column max on desktop with a 1200px container. 8px spacing scale (`{spacing.xs}` half-step for micro-adjustments). Related content sits in cards with `{spacing.lg}` internal padding; ungrouped content uses `{spacing.xl}` vertical rhythm between sections.

## Elevation & Depth
Depth comes from **tonal contrast**, not shadow. `{colors.surface}` sits on `{colors.neutral}` and reads as elevated purely because it's brighter. Reserve subtle borders (`{colors.border}`) for cases where two surfaces of the same tone must be distinguished.

## Shapes
Softly geometric. Cards use `{rounded.lg}`, controls use `{rounded.md}`, pills use `{rounded.full}`. Do not mix sharp corners into rounded contexts.

## Components
### Buttons
- **Default:** solid `{colors.primary}` fill with `{colors.surface}` text, `{rounded.md}` corners, `{spacing.sm}` × `{spacing.md}` padding.
- **Hover:** lighten fill by 8% via `color-mix`; no shadow change.
- **Secondary:** transparent fill, `{colors.primary}` text, 1px `{colors.border}`.
- **Disabled:** 40% opacity, `not-allowed` cursor, no hover transitions.

### Inputs
- Default: `{colors.surface}` fill, `{colors.border}` outline, `{rounded.md}` corners.
- Focused: swap outline to `{colors.primary}` at 1.5px.
- Error: swap outline to `{colors.error}`.

### Cards
- `{colors.surface}` on `{colors.neutral}`, `{rounded.lg}`, `{spacing.lg}` padding. No shadow — rely on tonal contrast.

## Do's and Don'ts
- Do maintain WCAG AA (4.5:1 for body text) at all times.
- Do reserve `{colors.tertiary}` for at most one element per view.
- Don't use `{colors.secondary}` for body text on `{colors.neutral}` — the contrast dips below AA.
- Don't add drop shadows to convey elevation; use `{colors.surface}` layering instead.
