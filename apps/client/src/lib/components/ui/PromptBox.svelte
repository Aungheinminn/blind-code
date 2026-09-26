<script lang="ts">
  import { createEventDispatcher, onMount, tick } from "svelte";

  export let value = "";
  export let placeholder = "";
  export let minHeight = 96;
  export let maxHeight = 320;
  export let submitOnEnter = false;
  export let size: "sm" | "md" = "md";
  export let disabled = false;

  let textareaEl: HTMLTextAreaElement | undefined;
  let focused = false;

  const dispatch = createEventDispatcher<{ submit: void }>();

  export const autoGrow = async () => {
    await tick();
    if (!textareaEl) return;
    textareaEl.style.height = "auto";
    const scroll = textareaEl.scrollHeight;
    const clamped = Math.min(Math.max(scroll, minHeight), maxHeight);
    textareaEl.style.height = `${clamped}px`;
    textareaEl.style.overflowY = scroll > maxHeight ? "auto" : "hidden";
  };

  export const focus = () => textareaEl?.focus();

  const handleKeydown = (event: KeyboardEvent) => {
    if (submitOnEnter && event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      dispatch("submit");
    }
  };

  onMount(() => {
    autoGrow();
  });

  $: cardPadding = size === "sm" ? "p-3" : "p-4";
  $: cardGap = size === "sm" ? "gap-2.5" : "gap-3";
  $: textSize = size === "sm" ? "text-[14px]" : "text-base";
  $: bgVar = size === "sm" ? "var(--bg-tertiary)" : "var(--bg-panel)";
  $: shadow =
    size === "sm" ? "var(--composer-shadow)" : "0 20px 50px -30px rgba(0, 0, 0, 0.9)";
</script>

<div
  class="rounded-2xl border flex flex-col {cardPadding} {cardGap}"
  style="border-color: {focused ? 'var(--accent)' : 'var(--border)'}; background-color: {bgVar}; box-shadow: {shadow};"
>
  <textarea
    bind:this={textareaEl}
    bind:value
    on:input={autoGrow}
    on:keydown={handleKeydown}
    on:focus={() => (focused = true)}
    on:blur={() => (focused = false)}
    {placeholder}
    {disabled}
    class="w-full resize-none bg-transparent outline-none border-0 py-[3px] px-0.5 leading-[1.55] {textSize}"
    style="color: var(--text-primary); height: {minHeight}px; max-height: {maxHeight}px;"
  ></textarea>

  <div class="flex items-center justify-between gap-2 flex-wrap">
    <div class="flex items-center gap-3 min-w-0 flex-wrap">
      <slot name="left" />
    </div>
    <div class="flex items-center gap-2.5">
      <slot name="right" />
    </div>
  </div>
</div>
