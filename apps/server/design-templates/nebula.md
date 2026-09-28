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
elevation:
  sm: "0 1px 2px rgba(0,0,0,0.35)"
  md: "0 6px 18px rgba(0,0,0,0.45)"
  lg: "0 20px 44px rgba(0,0,0,0.55)"
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
Nebula is engineered for high-focus productivity interfaces — data-heavy dashboards, admin consoles, developer tools. A deep indigo-black canvas contrasted against cool-gray surfaces establishes structure without visible borders. The electric teal accent snaps attention to anomalies and terminal states.

## Colors
`{colors.primary}` anchors active navigation, primary buttons, and focused inputs. `{colors.secondary}` lightens the indigo one step for hovered navigation and softer emphasis. Reserve `{colors.tertiary}` for critical highlights, success states, and hover on primary CTAs — one tertiary element per screen, no more. `{colors.neutral}` is the app canvas: deep indigo-black, never pure black. `{colors.surface}` is the cool-gray card layer, lifted from canvas by tone rather than shadow. `{colors.on-surface}` is the primary text on both; `{colors.muted-foreground}` handles metadata and helper text; `{colors.border}` is a single-pixel hairline used only where two same-tone surfaces need to be told apart.

## Typography
Use `{typography.headline-lg}` for page titles and `{typography.headline-md}` for panel and section titles — Geist Sans Semibold with tightened tracking for institutional weight. `{typography.body-md}` handles the default reading experience at 15px comfortable for dense data views; `{typography.body-sm}` compresses supporting descriptions and inline metadata. `{typography.label-md}` runs in Geist Mono, generously tracked and uppercase — reserved for metric names, KPIs, timestamps, and other machine-adjacent metadata, never for body copy.

## Layout
Fixed-max-width grid at 1440px on desktop, fluid below 1024px. Data-heavy views use `{spacing.md}` between cards, `{spacing.lg}` for panel padding, and `{spacing.xl}` for vertical rhythm between primary sections so the surface has room to breathe. `{spacing.sm}` handles inline control gaps; `{spacing.xs}` is a micro-adjustment step.

## Elevation
Depth is conveyed by tonal layers, not shadow. `{colors.surface}` reads as elevated purely because it's cooler and lighter than `{colors.neutral}`. When a modal or popover truly must lift, use a 1px `{colors.border}` outline plus `{elevation.md}` before reaching for anything stronger. Reserve `{elevation.lg}` for critical states like a drop target during a drag.

## Shapes
Modern-rounded. Cards use `{rounded.lg}`, controls use `{rounded.md}`, chips and badges use `{rounded.full}`. Never mix sharp corners with rounded surfaces on the same screen — the visual language stays coherent.

## Components
Primary buttons run a solid `{colors.primary}` fill with `{colors.on-surface}` text at `{rounded.md}` corners; on hover, transition the background to `{colors.tertiary}` over 150ms. Disabled state drops to 40% opacity with a not-allowed cursor and no hover.

Inputs sit on `{colors.surface}` with no visible border by default and `{rounded.md}` corners. On focus, add a 1.5px `{colors.primary}` ring rather than swapping the input's own outline. On error, swap the ring to `{colors.error}` and pair with helper text in the same color.

Cards use `{colors.surface}` on `{colors.neutral}` with `{rounded.lg}` corners and `{spacing.lg}` padding. A 1px `{colors.border}` outline is reserved for popovers and modals — resting cards stay borderless and let tonal contrast do the work.

## Do's and Don'ts
- Do maintain WCAG AA (4.5:1) for `{colors.on-surface}` against both `{colors.neutral}` and `{colors.surface}`.
- Do reserve `{colors.tertiary}` for one attention-critical element per view.
- Don't use pure white — always route text color through `{colors.on-surface}`.
- Don't add drop shadows or heavy borders for resting hierarchy; lean on the tonal contrast between `{colors.neutral}` and `{colors.surface}`.
