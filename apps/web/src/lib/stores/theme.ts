import { writable } from "svelte/store";

export const theme = writable("dark");

export const applyTheme = (value: string) => {
  if (value === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
  localStorage.setItem("blind-code-theme", value);
};

export const toggleTheme = () => {
  theme.update((value) => {
    const next = value === "dark" ? "light" : "dark";
    applyTheme(next);
    return next;
  });
};

export const initTheme = () => {
  const stored = localStorage.getItem("blind-code-theme") ?? "dark";
  theme.set(stored);
  applyTheme(stored);
};