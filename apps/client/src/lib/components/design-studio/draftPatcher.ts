// Targeted YAML+prose mutations for the strict design-template schema.
// We know the exact shape (see backend services/designTemplate.ts) so we
// avoid pulling in a full YAML parser: line-array iteration keyed to the
// known block layout is enough and preserves comments/formatting.

type Lines = string[];

const findFrontmatterBounds = (
  lines: Lines,
): { start: number; end: number } | null => {
  let start = -1;
  for (let i = 0; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();
    if (trimmed.length === 0) continue;
    if (trimmed === "---") {
      start = i;
      break;
    }
    return null;
  }
  if (start === -1) return null;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (lines[i].trim() === "---") return { start, end: i };
  }
  return null;
};

const findBlockRange = (
  lines: Lines,
  fmStart: number,
  fmEnd: number,
  key: string,
): { headerIdx: number; childStart: number; childEnd: number } | null => {
  const headerRe = new RegExp(`^${key}\\s*:\\s*$`);
  for (let i = fmStart + 1; i < fmEnd; i += 1) {
    const line = lines[i];
    const indent = line.length - line.trimStart().length;
    if (indent !== 0) continue;
    if (!headerRe.test(line.trim())) continue;
    let childEnd = fmEnd;
    for (let j = i + 1; j < fmEnd; j += 1) {
      const l = lines[j];
      if (l.trim().length === 0) continue;
      const li = l.length - l.trimStart().length;
      if (li === 0) {
        childEnd = j;
        break;
      }
    }
    return { headerIdx: i, childStart: i + 1, childEnd };
  }
  return null;
};

const setTopLevelString = (
  lines: Lines,
  fmStart: number,
  fmEnd: number,
  key: string,
  value: string,
): void => {
  const re = new RegExp(`^${key}\\s*:\\s*(.*)$`);
  const yaml = value.length === 0 ? "" : `"${value.replace(/"/g, '\\"')}"`;
  for (let i = fmStart + 1; i < fmEnd; i += 1) {
    const line = lines[i];
    const indent = line.length - line.trimStart().length;
    if (indent !== 0) continue;
    if (re.test(line.trim())) {
      if (yaml.length === 0) {
        lines[i] = `${key}: ""`;
      } else {
        lines[i] = `${key}: ${yaml}`;
      }
      return;
    }
  }
  lines.splice(fmEnd, 0, `${key}: ${yaml}`);
};

const setLeafInBlock = (
  lines: Lines,
  childStart: number,
  childEnd: number,
  key: string,
  value: string,
  indent = 2,
): void => {
  const re = new RegExp(`^\\s{${indent}}${escapeRe(key)}\\s*:\\s*(.*)$`);
  const pad = " ".repeat(indent);
  for (let i = childStart; i < childEnd; i += 1) {
    if (re.test(lines[i])) {
      lines[i] = `${pad}${key}: ${formatScalar(value)}`;
      return;
    }
  }
  lines.splice(childEnd, 0, `${pad}${key}: ${formatScalar(value)}`);
};

const setLeafInNested = (
  lines: Lines,
  childStart: number,
  childEnd: number,
  parentKey: string,
  leafKey: string,
  value: string,
  parentIndent = 2,
  leafIndent = 4,
): void => {
  const parentRe = new RegExp(`^\\s{${parentIndent}}${escapeRe(parentKey)}\\s*:\\s*$`);
  let headerIdx = -1;
  for (let i = childStart; i < childEnd; i += 1) {
    if (parentRe.test(lines[i])) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return;
  let subEnd = childEnd;
  for (let j = headerIdx + 1; j < childEnd; j += 1) {
    const l = lines[j];
    if (l.trim().length === 0) continue;
    const li = l.length - l.trimStart().length;
    if (li <= parentIndent) {
      subEnd = j;
      break;
    }
  }
  const leafRe = new RegExp(`^\\s{${leafIndent}}${escapeRe(leafKey)}\\s*:\\s*(.*)$`);
  const pad = " ".repeat(leafIndent);
  for (let i = headerIdx + 1; i < subEnd; i += 1) {
    if (leafRe.test(lines[i])) {
      lines[i] = `${pad}${leafKey}: ${formatScalar(value)}`;
      return;
    }
  }
  lines.splice(subEnd, 0, `${pad}${leafKey}: ${formatScalar(value)}`);
};

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const formatScalar = (value: string): string => {
  if (/^[a-zA-Z0-9._#-]+$/.test(value) || /^\d+px$/.test(value)) {
    if (value.startsWith("#")) return `"${value}"`;
    return value;
  }
  return `"${value.replace(/"/g, '\\"')}"`;
};

export const patchTopLevelString = (
  markdown: string,
  key: string,
  value: string,
): string => {
  const lines = markdown.split("\n");
  const fm = findFrontmatterBounds(lines);
  if (!fm) return markdown;
  setTopLevelString(lines, fm.start, fm.end, key, value);
  return lines.join("\n");
};

export const patchFrontmatterBlockLeaf = (
  markdown: string,
  block: string,
  leaf: string,
  value: string,
): string => {
  const lines = markdown.split("\n");
  const fm = findFrontmatterBounds(lines);
  if (!fm) return markdown;
  const range = findBlockRange(lines, fm.start, fm.end, block);
  if (!range) return markdown;
  setLeafInBlock(lines, range.childStart, range.childEnd, leaf, value);
  return lines.join("\n");
};

export const patchFrontmatterNestedLeaf = (
  markdown: string,
  block: string,
  role: string,
  leaf: string,
  value: string,
): string => {
  const lines = markdown.split("\n");
  const fm = findFrontmatterBounds(lines);
  if (!fm) return markdown;
  const range = findBlockRange(lines, fm.start, fm.end, block);
  if (!range) return markdown;
  setLeafInNested(lines, range.childStart, range.childEnd, role, leaf, value);
  return lines.join("\n");
};

const findSectionRange = (
  lines: Lines,
  bodyStart: number,
  section: string,
): { headerIdx: number; bodyStart: number; bodyEnd: number } | null => {
  const target = section.trim().toLowerCase();
  let inFence = false;
  for (let i = bodyStart; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^```/.test(line.trim())) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = /^##\s+(.+?)\s*$/.exec(line);
    if (!m) continue;
    if (m[1].trim().toLowerCase() !== target) continue;
    let end = lines.length;
    let localFence = false;
    for (let j = i + 1; j < lines.length; j += 1) {
      const l = lines[j];
      if (/^```/.test(l.trim())) {
        localFence = !localFence;
        continue;
      }
      if (localFence) continue;
      if (/^##\s+/.test(l) || /^#\s+/.test(l)) {
        end = j;
        break;
      }
    }
    return { headerIdx: i, bodyStart: i + 1, bodyEnd: end };
  }
  return null;
};

export const patchProseSection = (
  markdown: string,
  section: string,
  body: string,
): string => {
  const lines = markdown.split("\n");
  const fm = findFrontmatterBounds(lines);
  const bodyStart = fm ? fm.end + 1 : 0;
  const range = findSectionRange(lines, bodyStart, section);
  if (!range) return markdown;
  const bodyLines = body.split("\n");
  const before = lines.slice(0, range.bodyStart);
  const after = lines.slice(range.bodyEnd);
  const joined = ["", ...bodyLines, ""];
  return [...before, ...joined, ...after].join("\n");
};

export const readProseSection = (
  markdown: string,
  section: string,
): string => {
  const lines = markdown.split("\n");
  const fm = findFrontmatterBounds(lines);
  const bodyStart = fm ? fm.end + 1 : 0;
  const range = findSectionRange(lines, bodyStart, section);
  if (!range) return "";
  return lines.slice(range.bodyStart, range.bodyEnd).join("\n").trim();
};
