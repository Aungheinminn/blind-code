<script lang="ts">
  export let url = "";
  export let title = "Preview";
</script>

<div class="flex h-full flex-col overflow-hidden" style="background-color: var(--bg-primary);">
  <div
    class="flex items-center justify-between border-b px-4 py-2"
    style="border-color: var(--border);"
  >
    <span class="text-xs font-medium" style="color: var(--text-secondary);">{title}</span>
    {#if url}
      <span
        class="flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-medium"
        style="background-color: var(--accent-subtle); color: var(--success);"
      >
        <span class="w-1.5 h-1.5 rounded-full" style="background-color: var(--success);"></span>
        Live
      </span>
    {/if}
  </div>
  <div class="flex-1">
    {#if url}
      <iframe class="h-full w-full border-0" src={url} title={title}></iframe>
    {:else}
      <div class="flex h-full items-center justify-center">
        <p class="text-xs" style="color: var(--text-tertiary);">No preview available</p>
      </div>
    {/if}
  </div>
</div>
