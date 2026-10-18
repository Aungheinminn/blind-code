<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { theme, toggleTheme } from "$lib/stores/theme";
  import DeviceWidthToolbar from "./DeviceWidthToolbar.svelte";
  import databaseIcon from "$lib/assets/icons/database.svg?raw";
  import rocketIcon from "$lib/assets/icons/rocket.svg?raw";
  import refreshCwIcon from "$lib/assets/icons/refresh-cw.svg?raw";
  import sunIcon from "$lib/assets/icons/sun.svg?raw";
  import moonIcon from "$lib/assets/icons/moon.svg?raw";
  import eyeIcon from "$lib/assets/icons/eye.svg?raw";
  import eyeOffIcon from "$lib/assets/icons/eye-off.svg?raw";

  export let panelOpen = false;
  export let launcherHidden = false;
  export let supabaseConnected = false;
  export let vercelDeployed = false;

  const dispatch = createEventDispatcher<{
    restart: void;
    "toggle-launcher": void;
    "open-supabase": void;
    "open-deploy": void;
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
      class="chrome-button relative"
      on:click={() => dispatch("open-supabase")}
      title={supabaseConnected ? "Supabase connected" : "Connect Supabase"}
      aria-label={supabaseConnected ? "Supabase connected" : "Connect Supabase"}
    >
      <span class="icon-15" aria-hidden="true">{@html databaseIcon}</span>
      {#if supabaseConnected}
        <span class="connected-dot" aria-hidden="true"></span>
      {/if}
    </button>
    <button
      type="button"
      class="chrome-button"
      class:deployed={vercelDeployed}
      on:click={() => dispatch("open-deploy")}
      title={vercelDeployed ? "Manage deployment" : "Deploy to Vercel"}
      aria-label={vercelDeployed ? "Manage deployment" : "Deploy to Vercel"}
    >
      <span
        class="icon-15"
        class:deployed-fill={vercelDeployed}
        aria-hidden="true"
      >{@html rocketIcon}</span>
    </button>
    <button
      type="button"
      class="chrome-button"
      on:click={() => dispatch("restart")}
      title="Restart preview"
      aria-label="Restart preview"
    >
      <span class="icon-15" aria-hidden="true">{@html refreshCwIcon}</span>
    </button>
    <button
      type="button"
      class="chrome-button"
      on:click={toggleTheme}
      title="Toggle theme"
      aria-label="Toggle theme"
    >
      {#if $theme === "dark"}
        <span class="icon-15" aria-hidden="true">{@html sunIcon}</span>
      {:else}
        <span class="icon-15" aria-hidden="true">{@html moonIcon}</span>
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
          <span class="icon-14" aria-hidden="true">{@html eyeIcon}</span>
          <span>Show status</span>
        {:else}
          <span class="icon-14" aria-hidden="true">{@html eyeOffIcon}</span>
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
  .chrome-button.deployed {
    color: #22c55e;
  }
  .chrome-button.deployed:hover {
    color: #16a34a;
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
  .connected-dot {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #22c55e;
    box-shadow: 0 0 0 2px var(--chrome);
  }
  .icon-14 {
    display: inline-flex;
    width: 14px;
    height: 14px;
  }
  .icon-15 {
    display: inline-flex;
    width: 15px;
    height: 15px;
  }
  .deployed-fill :global(svg) {
    fill: currentColor;
  }
</style>
