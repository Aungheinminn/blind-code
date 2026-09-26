<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";

  export let placement: "up" | "down" = "up";
  export let align: "left" | "right" = "right";
  export let disabled = false;
  export let menuMinWidth = 220;

  const dispatch = createEventDispatcher<{ open: void; close: void }>();

  let open = false;
  let wrap: HTMLDivElement | undefined;

  const setOpen = (v: boolean) => {
    if (v === open) return;
    open = v;
    dispatch(v ? "open" : "close");
  };

  const toggle = () => {
    if (disabled) return;
    setOpen(!open);
  };

  const close = () => setOpen(false);

  const onDocClick = (e: MouseEvent) => {
    if (!open || !wrap) return;
    if (!wrap.contains(e.target as Node)) setOpen(false);
  };

  const onKey = (e: KeyboardEvent) => {
    if (!open) return;
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  };

  onMount(() => {
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  });
</script>

<div class="wrap" bind:this={wrap}>
  <slot name="trigger" {open} {toggle} {disabled} />

  {#if open}
    <div
      class="menu"
      class:menu--up={placement === "up"}
      class:menu--down={placement === "down"}
      class:menu--left={align === "left"}
      class:menu--right={align === "right"}
      style="min-width: {menuMinWidth}px;"
      role="listbox"
    >
      <slot {close} />
    </div>
  {/if}
</div>

<style>
  .wrap {
    position: relative;
    display: inline-block;
    min-width: 0;
  }
  .menu {
    position: absolute;
    padding: 6px;
    border-radius: 10px;
    border: 1px solid var(--border);
    background-color: var(--bg-panel);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
    z-index: 40;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .menu--right {
    right: 0;
  }
  .menu--left {
    left: 0;
  }
  .menu--up {
    bottom: calc(100% + 6px);
  }
  .menu--down {
    top: calc(100% + 6px);
  }
  :global(.dropdown-section-label) {
    padding: 6px 8px 2px;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-tertiary);
  }
  :global(.dropdown-row) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 7px 8px;
    border: 0;
    background: transparent;
    color: var(--text-secondary);
    font-family: inherit;
    font-size: 12.5px;
    text-align: left;
    border-radius: 6px;
    cursor: pointer;
    width: 100%;
  }
  :global(.dropdown-row:hover:not(:disabled)) {
    background-color: var(--bg-tertiary);
    color: var(--text-primary);
  }
  :global(.dropdown-row--active) {
    background-color: var(--bg-tertiary);
    color: var(--text-primary);
  }
  :global(.dropdown-row--disabled) {
    color: var(--text-tertiary);
    cursor: not-allowed;
  }
  :global(.dropdown-row-label) {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  :global(.dropdown-row-hint) {
    font-size: 10.5px;
    color: var(--text-tertiary);
    flex-shrink: 0;
  }
</style>
