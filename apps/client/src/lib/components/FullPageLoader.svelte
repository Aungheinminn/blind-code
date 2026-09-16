<script lang="ts">
  export let title: string = "Loading…";
  export let subtitle: string = "";
  export let scoped: boolean = false;
</script>

<div
  class="{scoped ? 'absolute z-10' : 'fixed z-[60]'} inset-0 flex flex-col items-center justify-center gap-4 loading-overlay"
  aria-live="polite"
  role="status"
>
  <div class="loader-ring" aria-hidden="true"></div>
  <div class="flex flex-col items-center gap-1.5 text-center px-6">
    <span
      class="text-[16px] font-semibold tracking-tight"
      style="color: var(--text-primary);"
    >
      {title}
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
</style>
