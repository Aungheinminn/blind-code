---
version: alpha
name: Nebula
description: Deep indigo canvas with electric teal accents. Built for focus-heavy dashboards.
colors:
  primary: "#6366F1"
  secondary: "#818CF8"
  tertiary: "#22D3EE"
  neutral: "#0D0E12"
  surface: "#161920"
  on-surface: "#F3F4F6"
  error: "#EF4444"
  border: "#2A2E39"
  muted-foreground: "#9CA3AF"
typography:
  headline-lg:
    fontFamily: Geist Sans
    fontSize: 30px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Geist Sans
    fontSize: 22px
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: -0.01em
  body-md:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.55
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
  label-md:
    fontFamily: Geist Mono
    fontSize: 11px
    fontWeight: 500
    lineHeight: 1
    letterSpacing: 0.08em
rounded:
  sm: 4px
  md: 8px
  lg: 14px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.md}"
    padding: 12px
  button-primary-hover:
    backgroundColor: "{colors.tertiary}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.md}"
    padding: 10px
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: 20px
---

# Nebula

## Overview
Nebula is engineered for high-focus productivity interfaces — data-heavy dashboards, admin consoles, developer tools. Deep indigo-black canvas contrasted against cool-gray surfaces establishes structure without visible borders. An electric teal accent snaps attention to anomalies and terminal states.

## Colors
- **Primary (`{colors.primary}`)** — indigo used for active navigation, primary buttons, focused inputs.
- **Secondary (`{colors.secondary}`)** — lighter indigo for hovered navigation and secondary emphasis.
- **Tertiary (`{colors.tertiary}`)** — electric teal, reserved for critical highlights, success states, and hover on primary CTAs. One tertiary element per screen.
- **Neutral (`{colors.neutral}`)** — the app canvas. Deep indigo-black, never pure black.
- **Surface (`{colors.surface}`)** — cool-gray card surfaces, slightly lifted from canvas via tonal contrast.

## Typography
- **Headlines:** `{typography.headline-lg}` and `{typography.headline-md}` — Geist Sans Semibold with tightened tracking for institutional weight.
- **Body:** `{typography.body-md}` in Inter Regular at 15px for dense-data comfort.
- **Labels:** `{typography.label-md}` in Geist Mono, uppercase with generous tracking. Use for metric names, KPIs, timestamps, and metadata only.

## Layout
Fixed-max-width grid at 1440px on desktop, fluid below 1024px. Strict 8px spacing scale. Data-heavy views use `{spacing.md}` gutters between cards; single-focus views use `{spacing.xl}` vertical rhythm.

## Elevation & Depth
Depth is conveyed by **tonal layers**, not shadow. `{colors.surface}` reads as elevated because it's cooler and lighter than `{colors.neutral}`. Modals and popovers use the same surface color plus a 1px `{colors.border}` outline. Do not add drop shadows.

## Shapes
Modern-rounded. Cards use `{rounded.lg}`, controls use `{rounded.md}`, chips and badges use `{rounded.full}`. Never mix sharp corners with rounded surfaces on the same screen.

## Components
### Buttons
- **Primary:** solid `{colors.primary}` with `{colors.on-surface}` text.
- **Hover:** transition backgroundColor to `{colors.tertiary}` over 150ms.
- **Disabled:** 40% opacity, `not-allowed` cursor, no hover transition.

### Inputs
- Default: `{colors.surface}` fill, no visible border, `{rounded.md}` corners.
- Focused: 1.5px `{colors.primary}` ring, no border-color change on the input itself.
- Error: 1.5px `{colors.error}` ring plus helper text in `{colors.error}`.

### Cards
- `{colors.surface}` on `{colors.neutral}`, `{rounded.lg}`, `{spacing.lg}` padding. Optional 1px `{colors.border}` outline for popovers and modals only.

## Do's and Don'ts
- Do maintain WCAG AA (4.5:1) for all body text on both `{colors.neutral}` and `{colors.surface}`.
- Do reserve `{colors.tertiary}` for one attention-critical element per view.
- Don't use pure white (`#FFFFFF`) — always route through `{colors.on-surface}`.
- Don't add drop shadows or heavy borders; rely on tonal contrast for hierarchy.
