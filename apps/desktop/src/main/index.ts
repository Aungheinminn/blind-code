import { app, BrowserWindow, ipcMain, shell } from "electron";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  getServerUrl,
  startBundledServer,
  stopBundledServer,
} from "./server-manager";
import {
  RENDERER_ENTRY_URL,
  registerRendererProtocol,
  registerRendererSchemeAsPrivileged,
} from "./renderer-protocol";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

const isDev = !app.isPackaged;
const CLIENT_DEV_URL = process.env.CLIENT_DEV_URL ?? "http://localhost:5173";
const DEV_SERVER_URL =
  process.env.SERVER_URL ?? `http://127.0.0.1:${process.env.SERVER_PORT ?? 3001}`;

let mainWindow: BrowserWindow | null = null;

if (!isDev) {
  registerRendererSchemeAsPrivileged();
}

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

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (isDev) {
    mainWindow.loadURL(CLIENT_DEV_URL);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadURL(RENDERER_ENTRY_URL);
  }
}

ipcMain.handle("desktop:server-url", () => {
  return isDev ? DEV_SERVER_URL : getServerUrl();
});

app.whenReady().then(async () => {
  if (!isDev) {
    registerRendererProtocol(join(process.resourcesPath, "client"));
    try {
      await startBundledServer();
    } catch (err) {
      console.error("[main] failed to start bundled server:", err);
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

app.on("before-quit", () => {
  stopBundledServer();
});
