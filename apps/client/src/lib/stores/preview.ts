import { writable } from "svelte/store";

export type DeviceKey = "full" | "mobile" | "tablet" | "laptop";
export type Orientation = "portrait" | "landscape";

export const DEVICE_PRESETS: Record<DeviceKey, { w: number; h: number } | null> = {
  full: null,
  mobile: { w: 390, h: 844 },
  tablet: { w: 834, h: 1112 },
  laptop: { w: 1440, h: 900 },
};

const DEVICE_KEY = "workspace:preview:device";
const ORIENT_KEY = "workspace:preview:orientation";

const readDevice = (): DeviceKey => {
  if (typeof window === "undefined") return "full";
  try {
    const value = window.localStorage.getItem(DEVICE_KEY);
    if (value && value in DEVICE_PRESETS) return value as DeviceKey;
  } catch {}
  return "full";
};

const readOrientation = (): Orientation => {
  if (typeof window === "undefined") return "portrait";
  try {
    const value = window.localStorage.getItem(ORIENT_KEY);
    if (value === "landscape") return "landscape";
  } catch {}
  return "portrait";
};

export const selectedDevice = writable<DeviceKey>(readDevice());
export const orientation = writable<Orientation>(readOrientation());

selectedDevice.subscribe((value) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DEVICE_KEY, value);
  } catch {}
});

orientation.subscribe((value) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ORIENT_KEY, value);
  } catch {}
});

export const currentWidth = (
  device: DeviceKey,
  orient: Orientation,
): number | null => {
  const preset = DEVICE_PRESETS[device];
  if (!preset) return null;
  return orient === "portrait" ? preset.w : preset.h;
};

export const currentHeight = (
  device: DeviceKey,
  orient: Orientation,
): number | null => {
  const preset = DEVICE_PRESETS[device];
  if (!preset) return null;
  return orient === "portrait" ? preset.h : preset.w;
};
