import type { Writable } from "svelte/store";

export type ResizableDirection = "horizontal" | "vertical";

export type PanelConfig = {
  id: string;
  minSize: number;
  maxSize: number;
};

export type ResizableContext = {
  direction: ResizableDirection;
  groupElement: HTMLElement | null;
  sizes: Writable<Record<string, number>>;
  panels: Map<string, PanelConfig>;
  registerPanel: (id: string, config: PanelConfig, defaultSize: number) => void;
  updateSizes: (next: Record<string, number>) => void;
};

export const RESIZABLE_CONTEXT = Symbol("ResizablePanelGroup");
