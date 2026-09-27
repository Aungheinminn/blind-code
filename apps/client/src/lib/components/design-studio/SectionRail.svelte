<script lang="ts">
  export let active:
    | "colors"
    | "typography"
    | "elevation"
    | "shapes"
    | "components" = "colors";

  type RailItem = {
    id: typeof active;
    label: string;
    letter: string;
  };

  const items: RailItem[] = [
    { id: "colors", label: "Colors", letter: "C" },
    { id: "typography", label: "Typography", letter: "T" },
    { id: "elevation", label: "Elevation", letter: "E" },
    { id: "shapes", label: "Shapes", letter: "S" },
    { id: "components", label: "Components", letter: "K" },
  ];

  const onPick = (id: typeof active) => {
    active = id;
    const el = document.querySelector(`[data-preview-section="${id}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };
</script>

<nav class="rail" aria-label="Jump to section">
  {#each items as item}
    <button
      type="button"
      class="rail-btn"
      class:active={active === item.id}
      title={item.label}
      aria-label={item.label}
      aria-current={active === item.id ? "true" : undefined}
      on:click={() => onPick(item.id)}
    >
      {item.letter}
    </button>
  {/each}
</nav>

<style>
  .rail {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: 48px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 12px 0;
    border-left: 1px solid var(--border);
    background-color: var(--bg-secondary);
    z-index: 5;
  }
  .rail-btn {
    width: 34px;
    height: 34px;
    border-radius: 8px;
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-secondary);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.02em;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background-color 150ms ease, color 150ms ease,
      border-color 150ms ease;
  }
  .rail-btn:hover {
    background-color: var(--bg-panel);
    color: var(--text-primary);
    border-color: var(--border);
  }
  .rail-btn.active {
    background-color: color-mix(in srgb, var(--accent) 14%, transparent);
    color: var(--accent);
    border-color: color-mix(in srgb, var(--accent) 40%, transparent);
  }
</style>
