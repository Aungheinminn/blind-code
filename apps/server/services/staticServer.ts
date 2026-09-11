import { join, normalize } from "path";

const port = Number(process.env.PORT);
const host = process.env.HOST ?? "0.0.0.0";
const root = process.cwd();

if (!port || Number.isNaN(port)) {
  console.error("staticServer: PORT env var is required");
  process.exit(1);
}

const mime: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

const contentTypeFor = (path: string): string | undefined => {
  const dot = path.lastIndexOf(".");
  if (dot < 0) return undefined;
  return mime[path.slice(dot).toLowerCase()];
};

const resolveWithin = (root: string, urlPath: string): string | null => {
  const decoded = decodeURIComponent(urlPath.split("?")[0].split("#")[0]);
  const rel = decoded.replace(/^\/+/, "");
  const abs = normalize(join(root, rel));
  if (abs !== root && !abs.startsWith(root + "/")) return null;
  return abs;
};

Bun.serve({
  port,
  hostname: host,
  async fetch(req) {
    const url = new URL(req.url);
    let pathname = url.pathname;
    if (pathname.endsWith("/")) pathname += "index.html";

    const abs = resolveWithin(root, pathname);
    if (!abs) return new Response("Forbidden", { status: 403 });

    const file = Bun.file(abs);
    if (await file.exists()) {
      const ct = contentTypeFor(abs);
      return new Response(file, ct ? { headers: { "content-type": ct } } : undefined);
    }

    const fallback = Bun.file(join(root, "index.html"));
    if (await fallback.exists()) {
      return new Response(fallback, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`static server ready on http://${host}:${port}`);
