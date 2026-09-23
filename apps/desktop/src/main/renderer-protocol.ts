import { net, protocol } from "electron";
import { existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { pathToFileURL } from "node:url";

const SCHEME = "app";

export function registerRendererSchemeAsPrivileged(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
      },
    },
  ]);
}

export function registerRendererProtocol(clientDir: string): void {
  protocol.handle(SCHEME, (request) => {
    const url = new URL(request.url);
    const raw = decodeURIComponent(url.pathname);
    const requested = raw === "/" || raw === "" ? "/index.html" : raw;

    const safe = normalize(requested).replace(/^([/\\])+/, "/");
    let filePath = join(clientDir, safe);

    if (!filePath.startsWith(clientDir)) {
      return new Response(null, { status: 403 });
    }

    if (!existsSync(filePath)) {
      if (extname(safe) === "") {
        filePath = join(clientDir, "index.html");
      } else {
        return new Response(null, { status: 404 });
      }
    }

    return net.fetch(pathToFileURL(filePath).toString());
  });
}

export const RENDERER_ENTRY_URL = `${SCHEME}://local/`;
