<script lang="ts">
  import { getContext, onDestroy } from "svelte";
  import { RESIZABLE_CONTEXT } from "./context";
  import type { ResizableContext } from "./context";

  export let defaultSize = 50;
  export let minSize = 20;
  export let maxSize = 80;
  export let className = "";
  export let style = "";

  let restClass = "";
  let restStyle = "";
  $: restClass = ("class" in $$restProps ? $$restProps.class : "") as string;
  $: restStyle = ("style" in $$restProps ? $$restProps.style : "") as string;

  const id = crypto.randomUUID();
  const context = getContext<ResizableContext>(RESIZABLE_CONTEXT);
  let currentSize = defaultSize;
  let unsubscribe: (() => void) | undefined;

  if (context) {
    context.registerPanel(id, { id, minSize, maxSize }, defaultSize);
    unsubscribe = context.sizes.subscribe((sizes) => {
      if (sizes[id] !== undefined) {
        currentSize = sizes[id];
      }
    });
  }

  $: if (context) {
    const panel = context.panels.get(id);
    if (panel) {
      panel.minSize = minSize;
      panel.maxSize = maxSize;
    }
  }

  onDestroy(() => {
    unsubscribe?.();
    context?.panels.delete(id);
  });
</script>

<div
  class={`${className} ${restClass}`}
  style={`flex-basis: ${currentSize}%; min-width: ${minSize}%; max-width: ${maxSize}%; ${style} ${restStyle}`}
  data-default-size={defaultSize}
  data-min-size={minSize}
  data-max-size={maxSize}
>
  <slot />
</div>
