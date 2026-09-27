const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const renderInline = (text: string): string => {
  let s = escapeHtml(text);
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
  | { kind: "ul"; items: string[] };

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

export const renderMiniMarkdown = (source: string): string => {
  const blocks = parseBlocks(source);
  return blocks
    .map((b) => {
      if (b.kind === "p") return `<p>${renderInline(b.text)}</p>`;
      const items = b.items
        .map((it) => `<li>${renderInline(it)}</li>`)
        .join("");
      return `<ul>${items}</ul>`;
    })
    .join("");
};
