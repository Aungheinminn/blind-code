import type { ParsedDraft } from "./parseTemplate";

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const escapeAttr = (s: string): string => escapeHtml(s);

const resolveTokenChip = (
  path: string,
  parsed: ParsedDraft | null | undefined,
): string | null => {
  if (!parsed) return null;
  const [group, ...rest] = path.split(".");
  if (!group || rest.length === 0) return null;
  const key = rest.join(".");
  if (group === "colors") {
    const hex = parsed.colors?.[key];
    if (!hex) return null;
    return `<span class="token-color"><span class="token-swatch" style="background-color: ${escapeAttr(
      hex,
    )};"></span><span class="token-name">${escapeHtml(
      key,
    )}</span><span class="token-value">${escapeHtml(hex)}</span></span>`;
  }
  if (group === "rounded") {
    const v = parsed.rounded?.[key];
    if (!v) return null;
    return `<span class="token-chip"><span class="token-name">rounded.${escapeHtml(
      key,
    )}</span><span class="token-value">${escapeHtml(v)}</span></span>`;
  }
  if (group === "elevation") {
    const v = parsed.elevation?.[key];
    if (!v) return null;
    return `<span class="token-chip"><span class="token-name">elevation.${escapeHtml(
      key,
    )}</span></span>`;
  }
  if (group === "typography") {
    const role = parsed.typography?.[key];
    if (!role) return null;
    const size = role.fontSize ?? "";
    const weight = role.fontWeight ?? "";
    const detail = [size, weight].filter(Boolean).join(" / ");
    return `<span class="token-chip"><span class="token-name">${escapeHtml(
      key,
    )}</span>${detail ? `<span class="token-value">${escapeHtml(detail)}</span>` : ""}</span>`;
  }
  if (group === "spacing") {
    return `<span class="token-chip"><span class="token-name">spacing.${escapeHtml(
      key,
    )}</span></span>`;
  }
  if (group === "components") {
    return `<span class="token-chip"><span class="token-name">${escapeHtml(
      key,
    )}</span></span>`;
  }
  return null;
};

const renderInline = (
  text: string,
  parsed: ParsedDraft | null | undefined,
): string => {
  let s = escapeHtml(text);
  // Resolve backtick-wrapped tokens first (e.g. `{colors.primary}`) so we
  // don't render them twice (once as a code chip, once as a token chip).
  s = s.replace(/`\{([a-zA-Z0-9_.-]+)\}`/g, (whole, path: string) => {
    const chip = resolveTokenChip(path, parsed);
    return chip ?? `<code>{${escapeHtml(path)}}</code>`;
  });
  // Bare tokens (not inside backticks).
  s = s.replace(/\{([a-zA-Z0-9_.-]+)\}/g, (whole, path: string) => {
    const chip = resolveTokenChip(path, parsed);
    return chip ?? whole;
  });
  s = s.replace(/`([^`]+)`/g, (_, code) => `<code>${code}</code>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, (_, bold) => `<strong>${bold}</strong>`);
  s = s.replace(
    /\bhttps?:\/\/[^\s<]+/g,
    (url) => `<a href="${url}" target="_blank" rel="noreferrer">${url}</a>`,
  );
  return s;
};

type Block =
  | { kind: "p"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "h"; level: number; text: string };

const parseBlocks = (source: string): Block[] => {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let paraBuf: string[] = [];
  let listBuf: string[] = [];

  const flushPara = () => {
    if (paraBuf.length === 0) return;
    const text = paraBuf.join(" ").trim();
    if (text.length > 0) blocks.push({ kind: "p", text });
    paraBuf = [];
  };
  const flushList = () => {
    if (listBuf.length === 0) return;
    blocks.push({ kind: "ul", items: listBuf.slice() });
    listBuf = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.length === 0) {
      flushPara();
      flushList();
      continue;
    }
    const heading = /^(#{3,6})\s+(.*)$/.exec(line);
    if (heading) {
      flushPara();
      flushList();
      blocks.push({ kind: "h", level: heading[1].length, text: heading[2] });
      continue;
    }
    const bullet = /^[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      flushPara();
      listBuf.push(bullet[1]);
      continue;
    }
    flushList();
    paraBuf.push(line);
  }
  flushPara();
  flushList();
  return blocks;
};

export const renderMiniMarkdown = (
  source: string,
  parsed?: ParsedDraft | null,
): string => {
  const blocks = parseBlocks(source);
  return blocks
    .map((b) => {
      if (b.kind === "p") return `<p>${renderInline(b.text, parsed)}</p>`;
      if (b.kind === "h") {
        const lvl = Math.min(6, Math.max(3, b.level));
        return `<h${lvl}>${renderInline(b.text, parsed)}</h${lvl}>`;
      }
      const items = b.items
        .map((it) => `<li>${renderInline(it, parsed)}</li>`)
        .join("");
      return `<ul>${items}</ul>`;
    })
    .join("");
};
