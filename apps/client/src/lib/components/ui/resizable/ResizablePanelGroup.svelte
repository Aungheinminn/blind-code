<script lang="ts">
  import { setContext } from "svelte";
  import { writable } from "svelte/store";
  import type { PanelConfig, ResizableContext, ResizableDirection } from "./context";
  import { RESIZABLE_CONTEXT } from "./context";

  export let direction: ResizableDirection = "horizontal";
  export let className = "";

  let restClass = "";
  $: restClass = ("class" in $$restProps ? $$restProps.class : "") as string;

  let groupElement: HTMLElement | null = null;
  const sizes = writable<Record<string, number>>({});
  const panels = new Map<string, PanelConfig>();

  const registerPanel = (id: string, config: PanelConfig, defaultSize: number) => {
    panels.set(id, config);
    sizes.update((current) => (current[id] === undefined ? { ...current, [id]: defaultSize } : current));
  };

  const updateSizes = (next: Record<string, number>) => {
    sizes.set(next);
  };

  const context: ResizableContext = {
    direction,
    groupElement,
    sizes,
    panels,
    registerPanel,
    updateSizes,
  };

  setContext(RESIZABLE_CONTEXT, context);

  $: context.direction = direction;
  $: context.groupElement = groupElement;
</script>

<div
  bind:this={groupElement}
  class={`flex h-full w-full ${direction === "horizontal" ? "flex-row" : "flex-col"} ${className} ${restClass}`}
  data-direction={direction}
  {...$$restProps}
>
  <slot />
</div>
