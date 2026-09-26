import matter from "gray-matter";
import { z } from "zod";
import type {
  DesignTemplateFrontmatter,
  DesignTemplateParsed,
} from "@vibe/shared";

const dimensionSchema = z.union([z.string(), z.number()]);

const typographySchema = z
  .object({
    fontFamily: z.string().optional(),
    fontSize: dimensionSchema.optional(),
    fontWeight: z.union([z.number(), z.string()]).optional(),
    lineHeight: dimensionSchema.optional(),
    letterSpacing: dimensionSchema.optional(),
    fontFeature: z.string().optional(),
    fontVariation: z.string().optional(),
  })
  .passthrough();

const omittedEntrySchema = z.union([
  z.string(),
  z.object({ section: z.string(), reason: z.string().optional() }),
]);

const frontmatterSchema = z
  .object({
    version: z.string().optional(),
    name: z.string().min(1, "name is required"),
    description: z.string().optional(),
    omitted: z.array(omittedEntrySchema).optional(),
    colors: z.record(z.string()).optional(),
    typography: z.record(typographySchema).optional(),
    rounded: z.record(dimensionSchema).optional(),
    spacing: z.record(dimensionSchema).optional(),
    components: z.record(z.record(z.string())).optional(),
  })
  .passthrough();

const REQUIRED_SECTIONS = [
  "Overview",
  "Colors",
  "Typography",
  "Layout",
  "Elevation",
  "Shapes",
  "Components",
  "Do's and Don'ts",
] as const;

const SECTION_ALIASES: Record<string, (typeof REQUIRED_SECTIONS)[number]> = {
  "brand & style": "Overview",
  "overview": "Overview",
  "colors": "Colors",
  "typography": "Typography",
  "layout": "Layout",
  "layout & spacing": "Layout",
  "elevation": "Elevation",
  "elevation & depth": "Elevation",
  "shapes": "Shapes",
  "components": "Components",
  "do's and don'ts": "Do's and Don'ts",
  "dos and don'ts": "Do's and Don'ts",
  "dos and donts": "Do's and Don'ts",
};

const canonicaliseSectionName = (raw: string): string => {
  const key = raw.trim().toLowerCase().replace(/[‘’]/g, "'");
  return SECTION_ALIASES[key] ?? raw.trim();
};

const extractH2Sections = (body: string): string[] => {
  const out: string[] = [];
  const lines = body.split(/\r?\n/);
  let inFence = false;
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = /^##\s+(.+?)\s*$/.exec(line);
    if (m) out.push(m[1]);
  }
  return out;
};

const collectOmitted = (tokens: DesignTemplateFrontmatter): Set<string> => {
  const set = new Set<string>();
  for (const entry of tokens.omitted ?? []) {
    const name = typeof entry === "string" ? entry : entry.section;
    set.add(canonicaliseSectionName(name));
  }
  return set;
};

const hexToRgb = (
  hex: string,
): { r: number; g: number; b: number } | null => {
  const clean = hex.replace(/^#/, "");
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return { r, g, b };
  }
  if (clean.length === 6 || clean.length === 8) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    if ([r, g, b].some((v) => Number.isNaN(v))) return null;
    return { r, g, b };
  }
  return null;
};

const relativeLuminance = (r: number, g: number, b: number): number => {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};

const contrastRatio = (a: string, b: string): number | null => {
  const rgbA = hexToRgb(a);
  const rgbB = hexToRgb(b);
  if (!rgbA || !rgbB) return null;
  const lA = relativeLuminance(rgbA.r, rgbA.g, rgbA.b);
  const lB = relativeLuminance(rgbB.r, rgbB.g, rgbB.b);
  const [lo, hi] = lA < lB ? [lA, lB] : [lB, lA];
  return (hi + 0.05) / (lo + 0.05);
};

export const parseTemplate = (source: string): DesignTemplateParsed => {
  const { data, content } = matter(source);
  const parsed = frontmatterSchema.safeParse(data);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new Error(
      `Invalid frontmatter: ${first.path.join(".") || "root"} — ${first.message}`,
    );
  }
  const tokens = parsed.data as DesignTemplateFrontmatter;

  const rawHeadings = extractH2Sections(content);
  const canonical = rawHeadings.map(canonicaliseSectionName);

  const seen = new Set<string>();
  for (const s of canonical) {
    if (seen.has(s)) throw new Error(`Duplicate section heading: "${s}"`);
    seen.add(s);
  }

  const omitted = collectOmitted(tokens);
  const missing: string[] = [];
  for (const req of REQUIRED_SECTIONS) {
    if (!seen.has(req) && !omitted.has(req)) missing.push(req);
  }
  if (missing.length > 0) {
    throw new Error(
      `Missing required sections: ${missing.join(", ")}. Add them as ## headings or list them in the frontmatter "omitted" field.`,
    );
  }

  const warnings: string[] = [];
  const on =
    tokens.colors?.["on-surface"] ??
    tokens.colors?.foreground ??
    tokens.colors?.["text-primary"];
  const surface = tokens.colors?.surface ?? tokens.colors?.card;
  const background =
    tokens.colors?.neutral ??
    tokens.colors?.background ??
    tokens.colors?.canvas;
  const checkPair = (fg: string | undefined, bg: string | undefined, label: string) => {
    if (!fg || !bg) return;
    const ratio = contrastRatio(fg, bg);
    if (ratio == null) return;
    if (ratio < 4.5) {
      throw new Error(
        `Contrast failure: ${label} pair (${fg} on ${bg}) is ${ratio.toFixed(2)}:1, below WCAG AA 4.5:1.`,
      );
    }
  };
  checkPair(on, background, "text/background");
  checkPair(on, surface, "text/surface");

  return { tokens, body: content, sections: canonical, warnings };
};

const dimensionToCss = (value: string | number): string =>
  typeof value === "number" ? `${value}px` : value;

const pick = <T,>(...vals: (T | undefined)[]): T | undefined =>
  vals.find((v) => v !== undefined);

type ShadcnDefaults = Record<string, string>;

const SHADCN_LIGHT_DEFAULTS: ShadcnDefaults = {
  background: "hsl(0 0% 100%)",
  foreground: "hsl(240 10% 3.9%)",
  card: "hsl(0 0% 100%)",
  "card-foreground": "hsl(240 10% 3.9%)",
  popover: "hsl(0 0% 100%)",
  "popover-foreground": "hsl(240 10% 3.9%)",
  primary: "hsl(240 5.9% 10%)",
  "primary-foreground": "hsl(0 0% 98%)",
  secondary: "hsl(240 4.8% 95.9%)",
  "secondary-foreground": "hsl(240 5.9% 10%)",
  muted: "hsl(240 4.8% 95.9%)",
  "muted-foreground": "hsl(240 3.8% 46.1%)",
  accent: "hsl(240 4.8% 95.9%)",
  "accent-foreground": "hsl(240 5.9% 10%)",
  destructive: "hsl(0 84.2% 60.2%)",
  "destructive-foreground": "hsl(0 0% 98%)",
  border: "hsl(240 5.9% 90%)",
  input: "hsl(240 5.9% 90%)",
  ring: "hsl(240 5.9% 10%)",
};

const buildShadcnMap = (tokens: DesignTemplateFrontmatter): ShadcnDefaults => {
  const c = tokens.colors ?? {};
  const value = (...names: string[]) =>
    pick(...names.map((n) => c[n]));
  return {
    background: value("background", "neutral", "canvas") ?? SHADCN_LIGHT_DEFAULTS.background,
    foreground: value("foreground", "on-surface", "text-primary") ?? SHADCN_LIGHT_DEFAULTS.foreground,
    card: value("card", "surface") ?? SHADCN_LIGHT_DEFAULTS.card,
    "card-foreground": value("card-foreground", "on-surface", "foreground") ?? SHADCN_LIGHT_DEFAULTS["card-foreground"],
    popover: value("popover", "surface") ?? SHADCN_LIGHT_DEFAULTS.popover,
    "popover-foreground": value("popover-foreground", "on-surface", "foreground") ?? SHADCN_LIGHT_DEFAULTS["popover-foreground"],
    primary: value("primary") ?? SHADCN_LIGHT_DEFAULTS.primary,
    "primary-foreground": value("primary-foreground", "on-primary") ?? SHADCN_LIGHT_DEFAULTS["primary-foreground"],
    secondary: value("secondary") ?? SHADCN_LIGHT_DEFAULTS.secondary,
    "secondary-foreground": value("secondary-foreground", "on-secondary") ?? SHADCN_LIGHT_DEFAULTS["secondary-foreground"],
    muted: value("muted", "secondary") ?? SHADCN_LIGHT_DEFAULTS.muted,
    "muted-foreground": value("muted-foreground") ?? SHADCN_LIGHT_DEFAULTS["muted-foreground"],
    accent: value("accent", "tertiary") ?? SHADCN_LIGHT_DEFAULTS.accent,
    "accent-foreground": value("accent-foreground", "on-accent", "on-tertiary") ?? SHADCN_LIGHT_DEFAULTS["accent-foreground"],
    destructive: value("destructive", "error") ?? SHADCN_LIGHT_DEFAULTS.destructive,
    "destructive-foreground": value("destructive-foreground", "on-error") ?? SHADCN_LIGHT_DEFAULTS["destructive-foreground"],
    border: value("border") ?? SHADCN_LIGHT_DEFAULTS.border,
    input: value("input", "border") ?? SHADCN_LIGHT_DEFAULTS.input,
    ring: value("ring", "primary") ?? SHADCN_LIGHT_DEFAULTS.ring,
  };
};

const CANONICAL_BODY_SECTIONS = new Set<string>([
  "Overview",
  "Colors",
  "Typography",
  "Layout",
  "Elevation",
  "Shapes",
  "Components",
  "Do's and Don'ts",
]);

export const sanitizeTemplateBody = (body: string): string => {
  const lines = body.split(/\r?\n/);
  const kept: string[] = [];
  let dropping = false;
  let inFence = false;

  const isKeptHeading = (raw: string): boolean => {
    const m = /^##\s+(.+?)\s*$/.exec(raw);
    if (!m) return false;
    const canonical = canonicaliseSectionName(m[1]);
    return CANONICAL_BODY_SECTIONS.has(canonical);
  };

  const isSectionHeading = (raw: string): boolean =>
    /^##\s+/.test(raw) || /^#\s+/.test(raw);

  for (const line of lines) {
    if (/^```/.test(line)) {
      inFence = !inFence;
      if (!dropping) kept.push(line);
      continue;
    }
    if (!inFence && isSectionHeading(line)) {
      if (/^#\s+/.test(line)) {
        dropping = false;
        continue;
      }
      dropping = !isKeptHeading(line);
    }
    if (!dropping) kept.push(line);
  }

  return kept.join("\n").trim();
};

export const templateToCss = (tokens: DesignTemplateFrontmatter): string => {
  const lines: string[] = [];
  lines.push(`@import "tailwindcss";`, "");
  lines.push(":root {");

  const shadcn = buildShadcnMap(tokens);
  for (const [name, value] of Object.entries(shadcn)) {
    lines.push(`  --${name}: ${value};`);
  }

  const radius = tokens.rounded?.md ?? tokens.rounded?.default ?? "0.5rem";
  lines.push(`  --radius: ${dimensionToCss(radius)};`);

  if (tokens.colors) {
    for (const [name, value] of Object.entries(tokens.colors)) {
      lines.push(`  --token-${name}: ${value};`);
    }
  }

  lines.push("}", "");
  lines.push("body {");
  lines.push("  margin: 0;");
  lines.push("  font-family: system-ui, -apple-system, sans-serif;");
  lines.push("}", "");

  lines.push("@theme inline {");
  for (const name of Object.keys(shadcn)) {
    lines.push(`  --color-${name}: hsl(var(--${name}));`);
  }
  lines.push(`  --radius: var(--radius);`);
  lines.push("}", "");

  return lines.join("\n");
};
