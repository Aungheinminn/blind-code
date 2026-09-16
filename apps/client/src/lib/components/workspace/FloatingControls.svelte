<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { theme, toggleTheme } from "$lib/stores/theme";
  import DeviceWidthToolbar from "./DeviceWidthToolbar.svelte";

  const dispatch = createEventDispatcher<{ restart: void }>();
</script>

<div class="absolute bottom-[19px] right-[19px] z-30 flex items-center gap-2">
  <DeviceWidthToolbar />
  <button
    type="button"
    class="chrome-button"
    on:click={() => dispatch("restart")}
    title="Restart preview"
    aria-label="Restart preview"
  >
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <polyline points="21 3 21 9 15 9" />
    </svg>
  </button>
  <button
    type="button"
    class="chrome-button"
    on:click={toggleTheme}
    title="Toggle theme"
    aria-label="Toggle theme"
  >
    {#if $theme === "dark"}
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="12" cy="12" r="4" />
        <path
          d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
        />
      </svg>
    {:else}
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
    {/if}
  </button>
</div>

<style>
  .chrome-button {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    border: 1px solid var(--chrome-border);
    background: var(--chrome);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);
    cursor: pointer;
    transition: background 150ms ease, color 150ms ease;
  }
  .chrome-button:hover {
    background: var(--chrome-hover);
    color: var(--text-primary);
  }
</style>
