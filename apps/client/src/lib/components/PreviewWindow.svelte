<script lang="ts">
  export let url = "";
  export let title = "Preview";
</script>

<div class="h-full w-full" style="background-color: var(--bg-primary);">
  {#if url}
    <iframe class="h-full w-full border-0" src={url} {title}></iframe>
  {:else}
    <div class="flex h-full w-full items-center justify-center px-8">
      <div class="text-center">
        <div
          class="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4"
          style="background-color: var(--bg-tertiary);"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            style="color: var(--text-tertiary);"
          >
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
        </div>
        <p class="text-sm font-medium" style="color: var(--text-secondary);">No preview yet</p>
        <p class="text-xs mt-1" style="color: var(--text-tertiary);">
          Start a conversation with the agent to see your project come to life.
        </p>
      </div>
    </div>
  {/if}
</div>
