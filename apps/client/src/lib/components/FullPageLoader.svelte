<script lang="ts">
  import { onDestroy } from "svelte";

  export let title: string = "Loading…";
  export let subtitle: string = "";
  export let scoped: boolean = false;
  export let rotatingTitles: string[] | null = null;
  export let rotateMs: number = 2200;

  let index = 0;
  let timer: ReturnType<typeof setInterval> | null = null;

  $: if (rotatingTitles && rotatingTitles.length > 0) {
    if (!timer) {
      timer = setInterval(() => {
        if (rotatingTitles && rotatingTitles.length > 0) {
          index = (index + 1) % rotatingTitles.length;
        }
      }, rotateMs);
    }
  } else if (timer) {
    clearInterval(timer);
    timer = null;
    index = 0;
  }

  $: displayTitle =
    rotatingTitles && rotatingTitles.length > 0
      ? rotatingTitles[index]
      : title;

  onDestroy(() => {
    if (timer) clearInterval(timer);
  });
</script>

<div
  class="{scoped ? 'absolute z-10' : 'fixed z-[60]'} inset-0 flex flex-col items-center justify-center gap-4 loading-overlay"
  aria-live="polite"
  role="status"
>
  <div class="loader-ring" aria-hidden="true"></div>
  <div class="flex flex-col items-center gap-1.5 text-center px-6">
    <span
      class="text-[16px] font-semibold tracking-tight loader-title"
      style="color: var(--text-primary);"
    >
      {#key displayTitle}
        <span class="loader-title-text">{displayTitle}</span>
      {/key}
    </span>
    {#if subtitle}
      <span class="text-[13px]" style="color: var(--text-secondary);">
        {subtitle}
      </span>
    {/if}
  </div>
</div>

<style>
  .loader-ring {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    border: 2.5px solid var(--border);
    border-top-color: var(--accent);
    animation: loader-spin 700ms linear infinite;
  }
  @keyframes loader-spin {
    to { transform: rotate(360deg); }
  }
  .loading-overlay {
    background-color: var(--chrome);
    backdrop-filter: blur(14px) saturate(140%);
    -webkit-backdrop-filter: blur(14px) saturate(140%);
  }
  .loader-title {
    display: inline-block;
    min-height: 1.1em;
  }
  .loader-title-text {
    display: inline-block;
    animation: title-fade 300ms ease-out;
  }
  @keyframes title-fade {
    from {
      opacity: 0;
      transform: translateY(2px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
