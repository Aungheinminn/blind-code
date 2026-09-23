import { contextBridge, ipcRenderer } from "electron";

const desktopApi = {
  isDesktop: true,
  platform: process.platform as NodeJS.Platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
  getServerUrl: (): Promise<string> => ipcRenderer.invoke("desktop:server-url"),
} as const;

contextBridge.exposeInMainWorld("desktop", desktopApi);

export type DesktopApi = typeof desktopApi;
