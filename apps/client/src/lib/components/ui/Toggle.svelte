<script lang="ts">
  import { createEventDispatcher } from "svelte";

  export let checked = false;
  export let disabled = false;
  export let ariaLabel: string | undefined = undefined;

  const dispatch = createEventDispatcher<{ change: boolean }>();

  const handleClick = () => {
    if (disabled) return;
    dispatch("change", !checked);
  };
</script>

<button
  type="button"
  role="switch"
  aria-checked={checked}
  aria-label={ariaLabel}
  {disabled}
  on:click={handleClick}
  class="toggle"
  class:on={checked}
>
  <span class="knob" />
</button>

<style>
  .toggle {
    --track-off: color-mix(in oklab, var(--accent) 22%, var(--bg-tertiary));
    --track-on: var(--accent);
    position: relative;
    display: inline-block;
    width: 44px;
    height: 24px;
    padding: 0;
    border-radius: 9999px;
    border: none;
    background-color: var(--track-off);
    cursor: pointer;
    transition:
      background-color 150ms ease,
      opacity 150ms ease;
    outline: none;
  }
  .toggle:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }
  .toggle:focus-visible {
    box-shadow: 0 0 0 2px var(--bg-panel), 0 0 0 4px var(--accent);
  }
  .toggle.on {
    background-color: var(--track-on);
  }
  .knob {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 18px;
    height: 18px;
    border-radius: 9999px;
    background-color: #ffffff;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
    transition: transform 150ms ease;
  }
  .toggle.on .knob {
    transform: translateX(20px);
  }
</style>
