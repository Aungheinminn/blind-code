export type DiffLine = { kind: "same" | "add" | "del"; text: string };

export type FileChange = {
  path: string;
  status: "added" | "removed" | "changed";
  added: number;
  removed: number;
};

// Past this, the LCS table gets too big to build in the browser.
const MAX_CELLS = 4_000_000;

const splitLines = (s: string) => (s === "" ? [] : s.replace(/\n$/, "").split("\n"));

// Line diff from `before` to `after`, or null when the files are too large to
// diff. Common prefix and suffix are trimmed first, which keeps typical edits
// (a few lines changed in a long file) well under the size cap.
export const diffLines = (before: string, after: string): DiffLine[] | null => {
  const a = splitLines(before);
  const b = splitLines(after);
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const midA = a.slice(start, endA);
  const midB = b.slice(start, endB);
  const n = midA.length;
  const m = midB.length;
  if ((n + 1) * (m + 1) > MAX_CELLS) return null;

  const lcs = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = midA[i] === midB[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const out: DiffLine[] = a.slice(0, start).map((text) => ({ kind: "same", text }));
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (midA[i] === midB[j]) {
      out.push({ kind: "same", text: midA[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      out.push({ kind: "del", text: midA[i++] });
    } else {
      out.push({ kind: "add", text: midB[j++] });
    }
  }
  while (i < n) out.push({ kind: "del", text: midA[i++] });
  while (j < m) out.push({ kind: "add", text: midB[j++] });
  for (const text of a.slice(endA)) out.push({ kind: "same", text });
  return out;
};

export const diffFileSets = (
  before: Record<string, string>,
  after: Record<string, string>,
): FileChange[] => {
  const paths = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  const changes: FileChange[] = [];
  for (const path of paths) {
    const a = before[path];
    const b = after[path];
    if (a === b) continue;
    if (a === undefined) {
      changes.push({ path, status: "added", added: splitLines(b).length, removed: 0 });
    } else if (b === undefined) {
      changes.push({ path, status: "removed", added: 0, removed: splitLines(a).length });
    } else {
      const lines = diffLines(a, b);
      changes.push({
        path,
        status: "changed",
        added: lines ? lines.filter((l) => l.kind === "add").length : 0,
        removed: lines ? lines.filter((l) => l.kind === "del").length : 0,
      });
    }
  }
  return changes;
};

export type Hunk = { lines: DiffLine[]; skippedBefore: number };

// Keeps `context` unchanged lines around each change and collapses the rest.
export const toHunks = (lines: DiffLine[], context = 3): Hunk[] => {
  const keep = new Array(lines.length).fill(false);
  lines.forEach((l, i) => {
    if (l.kind === "same") return;
    for (let k = Math.max(0, i - context); k <= Math.min(lines.length - 1, i + context); k++) keep[k] = true;
  });
  const hunks: Hunk[] = [];
  let skipped = 0;
  let current: Hunk | null = null;
  lines.forEach((l, i) => {
    if (!keep[i]) {
      skipped++;
      current = null;
      return;
    }
    if (!current) {
      current = { lines: [], skippedBefore: skipped };
      hunks.push(current);
      skipped = 0;
    }
    current.lines.push(l);
  });
  return hunks;
};
