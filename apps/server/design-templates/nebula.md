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
Indigo primary anchors active navigation, primary buttons, and focused inputs. Secondary lightens the indigo one step for hovered navigation and softer emphasis. Reserve the electric teal tertiary for critical highlights, success states, and hover on primary CTAs — one tertiary element per screen, no more. Neutral is the app canvas: deep indigo-black, never pure black. Surface is the cool-gray card layer, lifted from canvas by tone rather than shadow.

## Typography
Geist Sans Semibold carries the headlines with tightened tracking for institutional weight. Inter Regular at 15px handles body copy comfortably in dense data views. Reserve Geist Mono in generously-tracked uppercase for metric names, KPIs, timestamps, and other machine-adjacent metadata — never for body copy.

## Layout
Fixed-max-width grid at 1440px on desktop, fluid below 1024px. Strict 8px spacing scale throughout. Data-heavy views use the md gutter between cards; single-focus views use the xl vertical rhythm so the primary content has room to breathe.

## Elevation
Depth is conveyed by tonal layers, not shadow. Surface reads as elevated purely because it's cooler and lighter than neutral. When a modal or popover truly must lift, add a 1px border-color outline before reaching for a shadow. Reserve the md and lg shadow steps for interactive states like drag or drop targets.

## Shapes
Modern-rounded. Cards use the lg radius, controls use md, chips and badges use full. Never mix sharp corners with rounded surfaces on the same screen — the visual language stays coherent.

## Components
Primary buttons run solid primary with on-surface text at the md radius. On hover, transition the background to tertiary over 150ms; disabled state drops to 40% opacity with a not-allowed cursor and no hover.

Inputs sit on surface with no visible border by default and the md radius. On focus, add a 1.5px primary ring rather than swapping the input's own outline. On error, swap the ring to the error red and pair it with helper text in the same red.

Cards use surface on neutral with the lg radius and lg padding. A 1px border-color outline is only for popovers and modals — resting cards stay borderless and let tonal contrast do the work.

## Do's and Don'ts
- Do maintain WCAG AA (4.5:1) for all body text on both canvas and surface.
- Do reserve the electric teal tertiary for one attention-critical element per view.
- Don't use pure white — always route text color through on-surface.
- Don't add drop shadows or heavy borders for resting hierarchy; lean on the tonal contrast between neutral and surface.
