<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { theme, toggleTheme } from "$lib/stores/theme";
  import DeviceWidthToolbar from "./DeviceWidthToolbar.svelte";

  export let panelOpen = false;
  export let launcherHidden = false;

  const dispatch = createEventDispatcher<{
    restart: void;
    "toggle-launcher": void;
  }>();
</script>

<div
  class="flex items-center justify-between gap-2 px-3 h-[52px] shrink-0 border-b"
  style="background-color: var(--bg-primary); border-color: var(--border);"
>
  <div class="flex items-center">
    {#if !panelOpen}
      <DeviceWidthToolbar />
    {/if}
  </div>

  <div class="flex items-center gap-2">
    <button
      type="button"
      class="chrome-button"
      on:click={() => dispatch("restart")}
      title="Restart preview"
      aria-label="Restart preview"
    >
      <svg
        width="15"
        height="15"
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
          width="15"
          height="15"
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
          width="15"
          height="15"
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
    {#if !panelOpen}
      <button
        type="button"
        class="toggle-launcher-btn"
        class:active={launcherHidden}
        on:click={() => dispatch("toggle-launcher")}
        aria-pressed={launcherHidden}
      >
        {#if launcherHidden}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <span>Show status</span>
        {:else}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path
              d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-10-8-10-8a19.79 19.79 0 0 1 5.06-6.06M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a19.9 19.9 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"
            />
            <line x1="2" y1="2" x2="22" y2="22" />
          </svg>
          <span>Hide status</span>
        {/if}
      </button>
    {/if}
  </div>
</div>

<style>
  .chrome-button {
    width: 32px;
    height: 32px;
    border-radius: 9px;
    border: 1px solid var(--chrome-border);
    background: var(--chrome);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);
    cursor: pointer;
    transition:
      background 150ms ease,
      color 150ms ease,
      border-color 150ms ease;
  }
  .chrome-button:hover {
    background: var(--chrome-hover);
    color: var(--text-primary);
  }
  .toggle-launcher-btn {
    height: 32px;
    padding: 0 10px;
    border-radius: 9px;
    border: 1px solid var(--chrome-border);
    background: var(--chrome);
    color: var(--text-secondary);
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.01em;
    cursor: pointer;
    transition:
      background 150ms ease,
      color 150ms ease,
      border-color 150ms ease;
  }
  .toggle-launcher-btn:hover:not(.active) {
    background: var(--chrome-hover);
    color: var(--text-primary);
  }
  .toggle-launcher-btn.active {
    background: var(--accent);
    border-color: var(--accent);
    color: #ffffff;
  }
</style>
