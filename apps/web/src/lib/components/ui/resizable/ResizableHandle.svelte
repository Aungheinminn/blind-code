<script lang="ts">
  import { getContext } from "svelte";
  import { RESIZABLE_CONTEXT } from "./context";
  import type { ResizableContext } from "./context";

  export let className = "";

  let restClass = "";
  $: restClass = ("class" in $$restProps ? $$restProps.class : "") as string;

  const context = getContext<ResizableContext>(RESIZABLE_CONTEXT);
  const direction = context?.direction ?? "horizontal";
  let handleElement: HTMLDivElement | null = null;

  const getPointerPosition = (event: PointerEvent) => {
    if (direction === "horizontal") {
      return event.clientX;
    }
    return event.clientY;
  };

  const getAvailableSize = () => {
    const element = context?.groupElement;
    if (!element) return 0;
    return direction === "horizontal" ? element.clientWidth : element.clientHeight;
  };

  const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

  const collectPanels = () => {
    const entries = Array.from(context?.panels.values() ?? []);
    if (!entries.length) return [];
    return entries;
  };

  const handlePointerDown = (event: PointerEvent) => {
    if (!context || !handleElement) return;

    const group = context.groupElement;
    if (!group) return;

    const panels = collectPanels();
    if (panels.length < 2) return;

    const handleIndex = Array.from(group.querySelectorAll("[role=separator]")).indexOf(handleElement);
    if (handleIndex < 0 || handleIndex >= panels.length - 1) return;

    const left = panels[handleIndex];
    const right = panels[handleIndex + 1];

    let startSizes: Record<string, number> = {};
    context.sizes.subscribe((value) => (startSizes = value))();

    const start = getPointerPosition(event);
    const available = getAvailableSize();
    if (!available) return;

    const startLeft = startSizes[left.id] ?? 0;
    const startRight = startSizes[right.id] ?? 0;

    const onPointerMove = (moveEvent: PointerEvent) => {
      const delta = getPointerPosition(moveEvent) - start;
      const deltaPercent = (delta / available) * 100;

      const nextLeft = clamp(startLeft + deltaPercent, left.minSize, left.maxSize);
      const nextRight = clamp(startRight - deltaPercent, right.minSize, right.maxSize);

      const total = startLeft + startRight;
      const adjustedLeft = clamp(nextLeft, left.minSize, left.maxSize);
      const adjustedRight = clamp(total - adjustedLeft, right.minSize, right.maxSize);

      const newSizes = {
        ...startSizes,
        [left.id]: adjustedLeft,
        [right.id]: adjustedRight,
      };

      context.updateSizes(newSizes);
    };

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };
</script>

<div
  bind:this={handleElement}
  class={`relative flex ${direction === "horizontal" ? "w-2 items-stretch" : "h-2 items-center"} justify-center bg-transparent ${className} ${restClass}`}
  role="separator"
  aria-orientation={direction === "horizontal" ? "vertical" : "horizontal"}
  on:pointerdown={handlePointerDown}
  {...$$restProps}
>
  <div class={direction === "horizontal" ? "w-px" : "h-px"} style="background-color: var(--border);"></div>
  <div class={direction === "horizontal" ? "absolute inset-y-0 -left-1 -right-1" : "absolute inset-x-0 -top-1 -bottom-1"}></div>
</div>
