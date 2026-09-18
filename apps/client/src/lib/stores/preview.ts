import { writable } from "svelte/store";

export type DeviceKey = "mobile" | "tablet" | "laptop";
export type Orientation = "portrait" | "landscape";

export const DEVICE_PRESETS: Record<DeviceKey, { w: number; h: number }> = {
  mobile: { w: 393, h: 852 },
  tablet: { w: 768, h: 1024 },
  laptop: { w: 1440, h: 900 },
};

const DEVICE_KEY = "workspace:preview:device";
const ORIENT_KEY = "workspace:preview:orientation";

const readDevice = (): DeviceKey => {
  if (typeof window === "undefined") return "laptop";
  try {
    const value = window.localStorage.getItem(DEVICE_KEY);
    if (value && value in DEVICE_PRESETS) return value as DeviceKey;
  } catch {}
  return "laptop";
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

export const currentWidth = (device: DeviceKey, orient: Orientation): number => {
  const preset = DEVICE_PRESETS[device];
  return orient === "portrait" ? preset.w : preset.h;
};

export const currentHeight = (device: DeviceKey, orient: Orientation): number => {
  const preset = DEVICE_PRESETS[device];
  return orient === "portrait" ? preset.h : preset.w;
};
