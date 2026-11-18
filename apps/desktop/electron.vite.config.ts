import { defineConfig, externalizeDepsPlugin, loadEnv } from "electron-vite";
import { resolve } from "node:path";

export default defineConfig(({ command, mode }) => {
  if (command === "build") {
    const appUrl = loadEnv(mode, __dirname, "MAIN_VITE_").MAIN_VITE_APP_URL?.trim();
    const isLocal = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(appUrl ?? "");
    if (!appUrl || !(isLocal || /^https:\/\//.test(appUrl))) {
      throw new Error(
        "MAIN_VITE_APP_URL must be the web app's https URL (e.g. https://app.example.com), or http://localhost:<port> for local testing — the packaged app loads it directly.",
      );
    }
  }

  return {
    main: {
      plugins: [externalizeDepsPlugin()],
      build: {
        rollupOptions: {
          input: {
            index: resolve(__dirname, "src/main/index.ts"),
          },
        },
      },
    },
    preload: {
      plugins: [externalizeDepsPlugin()],
      build: {
        rollupOptions: {
          input: {
            index: resolve(__dirname, "src/preload/index.ts"),
          },
        },
      },
    },
  };
});
