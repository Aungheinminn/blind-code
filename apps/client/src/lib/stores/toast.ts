import { writable } from "svelte/store";

export type ToastKind = "success" | "info" | "error";

export type Toast = {
  id: string;
  kind: ToastKind;
  message: string;
};

export const toasts = writable<Toast[]>([]);

const makeId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export const showToast = (
  message: string,
  opts: { kind?: ToastKind; durationMs?: number } = {},
): void => {
  const id = makeId();
  const kind = opts.kind ?? "info";
  const duration = opts.durationMs ?? 5000;
  toasts.update((list) => [...list, { id, kind, message }]);
  if (duration > 0) {
    setTimeout(() => dismissToast(id), duration);
  }
};

export const dismissToast = (id: string): void => {
  toasts.update((list) => list.filter((t) => t.id !== id));
};
