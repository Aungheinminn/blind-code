import { app, BrowserWindow, shell } from "electron";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

const isDev = !app.isPackaged;
const CLIENT_DEV_URL = process.env.CLIENT_DEV_URL ?? "http://localhost:5173";
const APP_URL = isDev ? CLIENT_DEV_URL : import.meta.env.MAIN_VITE_APP_URL;
const APP_ORIGIN = new URL(APP_URL).origin;

let mainWindow: BrowserWindow | null = null;

const escapeHtml = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

const offlinePage = (reason: string): string => {
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Blind Code</title>
<style>
  body { margin: 0; height: 100vh; display: grid; place-items: center; background: #0b0b0f; color: #e6e6eb; font: 14px -apple-system, system-ui, sans-serif; }
  main { text-align: center; max-width: 360px; }
  h1 { font-size: 18px; font-weight: 600; margin: 0 0 8px; }
  p { color: #9a9aa5; margin: 0 0 20px; }
  a { display: inline-block; padding: 8px 16px; border-radius: 8px; background: #2a2a33; color: #e6e6eb; text-decoration: none; }
</style></head>
<body><main>
  <h1>Can't reach Blind Code</h1>
  <p>Check your internet connection and try again.<br><small>${escapeHtml(reason)}</small></p>
  <a href="${escapeHtml(APP_URL)}">Retry</a>
</main></body></html>`;
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
};

const isAppUrl = (url: string): boolean => {
  try {
    return new URL(url).origin === APP_ORIGIN;
  } catch {
    return false;
  }
};

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#0b0b0f",
    webPreferences: {
      preload: join(__dirname, "../preload/index.mjs"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  const { webContents } = mainWindow;

  webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  // The offline page's Retry link navigates from data: back to the app, so it must be allowed.
  webContents.on("will-navigate", (event, url) => {
    if (isAppUrl(url)) return;
    event.preventDefault();
    if (url.startsWith("http:") || url.startsWith("https:")) shell.openExternal(url);
  });

  webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    // -3 is ERR_ABORTED: a navigation replaced by another one, not a real failure.
    if (!isMainFrame || errorCode === -3 || !isAppUrl(validatedURL)) return;
    webContents.loadURL(offlinePage(errorDescription));
  });

  mainWindow.loadURL(APP_URL);
  if (isDev) webContents.openDevTools({ mode: "detach" });
}

async function waitForUrl(url: string, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastErr: unknown = null;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { method: "HEAD" });
      if (res.status < 500) return;
    } catch (err) {
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(
    `dev server at ${url} did not respond within ${timeoutMs}ms: ${String(lastErr)}`,
  );
}

app.whenReady().then(async () => {
  if (isDev) {
    console.log(`[main] waiting for client dev server at ${CLIENT_DEV_URL}...`);
    try {
      await waitForUrl(CLIENT_DEV_URL);
    } catch (err) {
      console.error("[main]", err);
      app.quit();
      return;
    }
  }

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
