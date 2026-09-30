export type ParsedDraft = {
  name: string;
  description: string;
  colors: Record<string, string>;
  rounded: Record<string, string>;
  elevation: Record<string, string>;
  spacing: Record<string, string>;
  typography: Record<string, Record<string, string>>;
  components: Record<string, Record<string, string>>;
  sections: Record<string, string>;
};

const stripFrontmatter = (source: string): string | null => {
  const trimmed = source.replace(/^﻿/, "").trimStart();
  if (!trimmed.startsWith("---")) return null;
  const rest = trimmed.slice(3);
  const end = rest.search(/\n---\s*(?:\n|$)/);
  if (end === -1) return null;
  return rest.slice(0, end);
};

const bodyAfterFrontmatter = (source: string): string => {
  const trimmed = source.replace(/^﻿/, "").trimStart();
  if (!trimmed.startsWith("---")) return trimmed;
  const rest = trimmed.slice(3);
  const end = rest.search(/\n---\s*(?:\n|$)/);
  if (end === -1) return "";
  const afterMarker = rest.slice(end).replace(/^\n---\s*/, "");
  return afterMarker.replace(/^\n+/, "");
};

const SECTION_ALIASES: Record<string, string> = {
  "overview": "Overview",
  "brand & style": "Overview",
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

const canonicalSection = (raw: string): string => {
  const key = raw.trim().toLowerCase().replace(/[‘’]/g, "'");
  return SECTION_ALIASES[key] ?? raw.trim();
};

const parseBodySections = (body: string): Record<string, string> => {
  const out: Record<string, string> = {};
  const lines = body.split(/\r?\n/);
  let currentName: string | null = null;
  let buf: string[] = [];
  let inFence = false;

  const flush = () => {
    if (currentName == null) return;
    const text = buf.join("\n").trim();
    if (text.length > 0) out[currentName] = text;
    buf = [];
  };

  for (const raw of lines) {
    if (/^```/.test(raw)) {
      inFence = !inFence;
      buf.push(raw);
      continue;
    }
    if (!inFence) {
      const m = /^##\s+(.+?)\s*$/.exec(raw);
      if (m) {
        flush();
        currentName = canonicalSection(m[1]);
        continue;
      }
    }
    if (currentName != null) buf.push(raw);
  }
  flush();
  return out;
};

const unquote = (raw: string): string => {
  const v = raw.trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    return v.slice(1, -1);
  }
  return v;
};

const parseBlockMap = (
  lines: string[],
  startIdx: number,
  parentIndent: number,
): { entries: Record<string, string>; nextIdx: number } => {
  const entries: Record<string, string> = {};
  let i = startIdx;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim().length === 0) {
      i += 1;
      continue;
    }
    const indent = line.length - line.trimStart().length;
    if (indent <= parentIndent) break;
    const m = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(line.trim());
    if (!m) {
      i += 1;
      continue;
    }
    const [, key, rawValue] = m;
    if (rawValue.trim().length > 0) {
      entries[key] = unquote(rawValue);
    }
    i += 1;
  }
  return { entries, nextIdx: i };
};

const parseNestedBlockMap = (
  lines: string[],
  startIdx: number,
  parentIndent: number,
): {
  entries: Record<string, Record<string, string>>;
  nextIdx: number;
} => {
  const entries: Record<string, Record<string, string>> = {};
  let i = startIdx;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim().length === 0) {
      i += 1;
      continue;
    }
    const indent = line.length - line.trimStart().length;
    if (indent <= parentIndent) break;
    const m = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(line.trim());
    if (!m) {
      i += 1;
      continue;
    }
    const [, key, rawValue] = m;
    if (rawValue.trim().length > 0) {
      entries[key] = { _value: unquote(rawValue) };
      i += 1;
      continue;
    }
    const nested = parseBlockMap(lines, i + 1, indent);
    entries[key] = nested.entries;
    i = nested.nextIdx;
  }
  return { entries, nextIdx: i };
};

export const parseDraft = (source: string): ParsedDraft | null => {
  const fm = stripFrontmatter(source);
  if (fm == null) return null;

  const lines = fm.split(/\r?\n/);
  const result: ParsedDraft = {
    name: "",
    description: "",
    colors: {},
    rounded: {},
    elevation: {},
    spacing: {},
    typography: {},
    components: {},
    sections: parseBodySections(bodyAfterFrontmatter(source)),
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim().length === 0 || line.trimStart().startsWith("#")) {
      i += 1;
      continue;
    }
    const indent = line.length - line.trimStart().length;
    if (indent !== 0) {
      i += 1;
      continue;
    }
    const m = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(line);
    if (!m) {
      i += 1;
      continue;
    }
    const [, key, rawValue] = m;
    const value = rawValue.trim();
    if (value.length > 0) {
      if (key === "name") result.name = unquote(value);
      else if (key === "description") result.description = unquote(value);
      i += 1;
      continue;
    }
    if (key === "colors") {
      const parsed = parseBlockMap(lines, i + 1, indent);
      result.colors = parsed.entries;
      i = parsed.nextIdx;
      continue;
    }
    if (key === "rounded") {
      const parsed = parseBlockMap(lines, i + 1, indent);
      result.rounded = parsed.entries;
      i = parsed.nextIdx;
      continue;
    }
    if (key === "elevation") {
      const parsed = parseBlockMap(lines, i + 1, indent);
      result.elevation = parsed.entries;
      i = parsed.nextIdx;
      continue;
    }
    if (key === "spacing") {
      const parsed = parseBlockMap(lines, i + 1, indent);
      result.spacing = parsed.entries;
      i = parsed.nextIdx;
      continue;
    }
    if (key === "typography") {
      const parsed = parseNestedBlockMap(lines, i + 1, indent);
      result.typography = parsed.entries;
      i = parsed.nextIdx;
      continue;
    }
    if (key === "components") {
      const parsed = parseNestedBlockMap(lines, i + 1, indent);
      result.components = parsed.entries;
      i = parsed.nextIdx;
      continue;
    }
    i += 1;
  }

  return result;
};

export const dimensionToCss = (value: string | undefined, fallback: string): string => {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (/^\d+(\.\d+)?$/.test(trimmed)) return `${trimmed}px`;
  return trimmed;
};

export type PreviewTokens = {
  name: string;
  description: string;
  colors: {
    primary: string;
    secondary: string;
    tertiary: string;
    neutral: string;
    surface: string;
    onSurface: string;
    error: string;
    border: string;
    mutedForeground: string;
  };
  rounded: {
    sm: string;
    md: string;
    lg: string;
  };
  elevation: {
    sm: string;
    md: string;
    lg: string;
  };
  swatches: Array<{ name: string; value: string }>;
};

const pick = (map: Record<string, string>, ...keys: string[]): string | undefined => {
  for (const k of keys) {
    const v = map[k];
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
  }
  return undefined;
};

export const tokensFromDraft = (parsed: ParsedDraft): PreviewTokens => {
  const c = parsed.colors;
  const colors = {
    primary: pick(c, "primary") ?? "#6366f1",
    secondary: pick(c, "secondary") ?? "#818cf8",
    tertiary: pick(c, "tertiary", "accent") ?? "#22d3ee",
    neutral:
      pick(c, "neutral", "background", "canvas") ?? "#f8fafc",
    surface: pick(c, "surface", "card") ?? "#ffffff",
    onSurface:
      pick(c, "on-surface", "foreground", "text-primary") ?? "#0f172a",
    error: pick(c, "error", "destructive") ?? "#ef4444",
    border: pick(c, "border") ?? "#e2e8f0",
    mutedForeground: pick(c, "muted-foreground") ?? "#64748b",
  };
  const rounded = {
    sm: dimensionToCss(parsed.rounded.sm, "4px"),
    md: dimensionToCss(parsed.rounded.md ?? parsed.rounded.default, "8px"),
    lg: dimensionToCss(parsed.rounded.lg, "14px"),
  };
  const elevation = {
    sm: parsed.elevation.sm ?? "0 1px 2px rgba(0,0,0,0.12)",
    md: parsed.elevation.md ?? "0 3px 10px rgba(0,0,0,0.16)",
    lg: parsed.elevation.lg ?? "0 12px 32px rgba(0,0,0,0.22)",
  };
  const swatches = Object.entries(parsed.colors)
    .filter(([, v]) => typeof v === "string" && v.trim().length > 0)
    .map(([name, value]) => ({ name, value: value.trim() }));
  return {
    name: parsed.name,
    description: parsed.description,
    colors,
    rounded,
    elevation,
    swatches,
  };
};
