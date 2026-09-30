import landingBody from "./landing.html?raw";
import dashboardBody from "./dashboard.html?raw";
import type { ParsedDraft, PreviewTokens } from "../parseTemplate";

export type MockupId = "landing" | "dashboard";

const MOCKUP_BODIES: Record<MockupId, string> = {
  landing: landingBody,
  dashboard: dashboardBody,
};

const escapeCss = (v: string): string => v.replace(/[<>]/g, "");

const dim = (v: string | undefined, fallback: string): string => {
  if (!v) return fallback;
  const t = v.trim();
  if (/^\d+(\.\d+)?$/.test(t)) return `${t}px`;
  return t;
};

export const buildTokenVars = (
  tokens: PreviewTokens,
  parsed: ParsedDraft | null,
): string => {
  const c = tokens.colors;
  const r = tokens.rounded;
  const e = tokens.elevation;
  const s = parsed?.spacing ?? {};
  const t = parsed?.typography ?? {};

  const font = (role: string) => {
    const cfg = t[role] ?? {};
    return {
      family: cfg.fontFamily ?? "system-ui, -apple-system, sans-serif",
      size: dim(cfg.fontSize, "16px"),
      weight: cfg.fontWeight ?? "400",
      lh: cfg.lineHeight ?? "1.4",
      ls: cfg.letterSpacing ?? "normal",
    };
  };

  const hLg = font("headline-lg");
  const hMd = font("headline-md");
  const bMd = font("body-md");
  const bSm = font("body-sm");
  const lbl = font("label-md");

  const vars: Record<string, string> = {
    "--color-primary": c.primary,
    "--color-secondary": c.secondary,
    "--color-tertiary": c.tertiary,
    "--color-neutral": c.neutral,
    "--color-surface": c.surface,
    "--color-on-surface": c.onSurface,
    "--color-error": c.error,
    "--color-border": c.border,
    "--color-muted-foreground": c.mutedForeground,

    "--rounded-sm": r.sm,
    "--rounded-md": r.md,
    "--rounded-lg": r.lg,
    "--rounded-full": "9999px",

    "--elev-sm": e.sm,
    "--elev-md": e.md,
    "--elev-lg": e.lg,

    "--spacing-xs": dim(s.xs, "4px"),
    "--spacing-sm": dim(s.sm, "8px"),
    "--spacing-md": dim(s.md, "16px"),
    "--spacing-lg": dim(s.lg, "24px"),
    "--spacing-xl": dim(s.xl, "40px"),

    "--font-headline": hLg.family,
    "--font-body": bMd.family,
    "--font-label": lbl.family,

    "--h-lg-size": hLg.size,
    "--h-lg-weight": String(hLg.weight),
    "--h-lg-lh": String(hLg.lh),
    "--h-md-size": hMd.size,
    "--h-md-weight": String(hMd.weight),
    "--h-md-lh": String(hMd.lh),

    "--body-md-size": bMd.size,
    "--body-md-weight": String(bMd.weight),
    "--body-md-lh": String(bMd.lh),
    "--body-sm-size": bSm.size,
    "--body-sm-weight": String(bSm.weight),

    "--label-size": lbl.size,
    "--label-weight": String(lbl.weight),
    "--label-ls": String(lbl.ls),
  };

  return Object.entries(vars)
    .map(([k, v]) => `  ${k}: ${escapeCss(String(v))};`)
    .join("\n");
};

const BASE_CSS = `
  *, *::before, *::after { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: var(--color-neutral);
    color: var(--color-on-surface);
    font-family: var(--font-body);
    font-size: var(--body-md-size);
    font-weight: var(--body-md-weight);
    line-height: var(--body-md-lh);
    min-height: 100vh;
  }
  h1, h2, h3, h4, h5, h6 {
    font-family: var(--font-headline);
    margin: 0;
    letter-spacing: -0.01em;
  }
  a { color: inherit; text-decoration: none; }
  button {
    font-family: inherit;
    cursor: pointer;
    border: 0;
  }
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 10px 18px;
    font-size: var(--body-sm-size);
    font-weight: 600;
    border-radius: var(--rounded-md);
    transition: filter 150ms ease, opacity 150ms ease;
    gap: 6px;
  }
  .btn-primary {
    background: var(--color-primary);
    color: var(--color-surface);
  }
  .btn-primary:hover { filter: brightness(1.1); }
  .btn-secondary {
    background: transparent;
    color: var(--color-on-surface);
    border: 1px solid var(--color-border);
  }
  .btn-secondary:hover { background: color-mix(in srgb, var(--color-on-surface) 6%, transparent); }
  .btn-tertiary {
    background: var(--color-tertiary);
    color: var(--color-neutral);
  }
  .btn-tertiary:hover { filter: brightness(1.06); }
  .btn-disabled { opacity: 0.45; cursor: not-allowed; }
  .input {
    padding: 10px 14px;
    background: var(--color-surface);
    color: var(--color-on-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--rounded-md);
    font: inherit;
    outline: none;
    width: 100%;
  }
  .input:focus { border-color: var(--color-primary); }
  .card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--rounded-lg);
    padding: var(--spacing-lg);
  }
  .kicker {
    font-family: var(--font-label);
    font-size: var(--label-size);
    font-weight: var(--label-weight);
    letter-spacing: var(--label-ls);
    text-transform: uppercase;
    color: var(--color-tertiary);
  }
  .muted { color: var(--color-muted-foreground); }
`;

export const buildMockupHtml = (
  mockup: MockupId,
  tokens: PreviewTokens,
  parsed: ParsedDraft | null,
): string => {
  const vars = buildTokenVars(tokens, parsed);
  const body = MOCKUP_BODIES[mockup];

  const familiesToLoad = new Set<string>();
  if (parsed?.typography) {
    for (const role of Object.values(parsed.typography)) {
      const family = (role as Record<string, string>).fontFamily;
      if (
        family &&
        !/^(system-ui|sans-serif|monospace|serif)/i.test(family.trim())
      ) {
        familiesToLoad.add(family.trim().replace(/["']/g, ""));
      }
    }
  }
  const fontsHref =
    familiesToLoad.size > 0
      ? `https://fonts.googleapis.com/css2?${[...familiesToLoad]
          .map((f) => `family=${encodeURIComponent(f)}:wght@400;500;600;700`)
          .join("&")}&display=swap`
      : null;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
${fontsHref ? `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="${fontsHref}">` : ""}
<style>
:root {
${vars}
}
${BASE_CSS}
</style>
</head>
<body>
${body}
</body>
</html>`;
};

export const MOCKUP_OPTIONS: Array<{ id: MockupId; label: string }> = [
  { id: "landing", label: "Landing page" },
  { id: "dashboard", label: "Dashboard" },
];
