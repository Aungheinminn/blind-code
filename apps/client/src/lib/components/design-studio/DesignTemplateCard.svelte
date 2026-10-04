<script lang="ts">
  import { createEventDispatcher, onDestroy } from "svelte";
  import type { DesignTemplateSummary } from "$lib/api/projects";

  export let template: DesignTemplateSummary;
  export let swatches: { name: string; value: string }[] = [];
  export let variant: "active" | "archived" | "deleted" = "active";

  const dispatch = createEventDispatcher<{
    rename: DesignTemplateSummary;
    delete: DesignTemplateSummary;
    archive: DesignTemplateSummary;
    unarchive: DesignTemplateSummary;
    restore: DesignTemplateSummary;
    permanentDelete: DesignTemplateSummary;
  }>();

  let menuOpen = false;
  let menuAnchor: HTMLDivElement | null = null;

  $: canManage = !template.isReadOnly && template.origin !== "builtin";

  const toggleMenu = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    menuOpen = !menuOpen;
  };

  const handleWindowClick = (e: MouseEvent) => {
    if (!menuOpen || !menuAnchor) return;
    if (!menuAnchor.contains(e.target as Node)) menuOpen = false;
  };

  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === "Escape") menuOpen = false;
  };

  const fire = (name: "rename" | "delete" | "archive" | "unarchive" | "restore" | "permanentDelete") =>
    (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      menuOpen = false;
      dispatch(name, template);
    };

  const onRename = fire("rename");
  const onDelete = fire("delete");
  const onArchive = fire("archive");
  const onUnarchive = fire("unarchive");
  const onRestore = fire("restore");
  const onPermanentDelete = fire("permanentDelete");

  onDestroy(() => {
    menuOpen = false;
  });
</script>

<svelte:window on:click={handleWindowClick} on:keydown={handleKeydown} />

<article class="card" class:menu-open={menuOpen}>
  {#if variant === "deleted"}
    <div class="card-body">
      <div class="card-head">
        <h2>{template.name}</h2>
        <span class="chip chip-danger">deleted</span>
      </div>
      {#if template.description}
        <p class="desc">{template.description}</p>
      {/if}
      {#if swatches.length > 0}
        <div class="swatches" role="list" aria-label="Color palette">
          {#each swatches as s}
            <span
              class="swatch"
              role="listitem"
              title="{s.name} — {s.value}"
              style="background-color: {s.value};"
            ></span>
          {/each}
        </div>
      {/if}
    </div>
  {:else}
    <a
      class="card-body"
      href={`/design/new?id=${encodeURIComponent(template.id)}`}
      aria-label={canManage ? `Open ${template.name} in studio` : `Preview ${template.name}`}
    >
      <div class="card-head">
        <h2>{template.name}</h2>
        <span class="chip">{variant === "archived" ? "archived" : template.origin}</span>
      </div>
      {#if template.description}
        <p class="desc">{template.description}</p>
      {/if}
      {#if swatches.length > 0}
        <div class="swatches" role="list" aria-label="Color palette">
          {#each swatches as s}
            <span
              class="swatch"
              role="listitem"
              title="{s.name} — {s.value}"
              style="background-color: {s.value};"
            ></span>
          {/each}
        </div>
      {/if}
    </a>
  {/if}

  {#if canManage}
    <div class="kebab-wrap" bind:this={menuAnchor}>
      <button
        type="button"
        on:click={toggleMenu}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label="Template actions"
        title="More"
        class="kebab"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="12" cy="19" r="1.6" />
        </svg>
      </button>

      {#if menuOpen}
        <div class="menu" role="menu">
          {#if variant === "active"}
            <button type="button" role="menuitem" on:click={onRename} class="menu-item">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
              </svg>
              <span>Edit title</span>
            </button>
            <button type="button" role="menuitem" on:click={onArchive} class="menu-item">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="4" width="18" height="4" rx="1" />
                <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" />
                <line x1="10" y1="12" x2="14" y2="12" />
              </svg>
              <span>Archive</span>
            </button>
            <button type="button" role="menuitem" on:click={onDelete} class="menu-item menu-item-danger">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
              </svg>
              <span>Delete</span>
            </button>
          {:else if variant === "archived"}
            <button type="button" role="menuitem" on:click={onUnarchive} class="menu-item">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="4" width="18" height="4" rx="1" />
                <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" />
                <path d="M9 15l3 -3l3 3" />
                <line x1="12" y1="12" x2="12" y2="19" />
              </svg>
              <span>Unarchive</span>
            </button>
            <button type="button" role="menuitem" on:click={onDelete} class="menu-item menu-item-danger">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
              </svg>
              <span>Delete</span>
            </button>
          {:else}
            <button type="button" role="menuitem" on:click={onRestore} class="menu-item">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 12a9 9 0 1 0 3-6.7" />
                <polyline points="3 4 3 10 9 10" />
              </svg>
              <span>Restore</span>
            </button>
            <button type="button" role="menuitem" on:click={onPermanentDelete} class="menu-item menu-item-danger">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
              </svg>
              <span>Delete forever</span>
            </button>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</article>

<style>
  .card {
    position: relative;
    border: 1px solid var(--border);
    border-radius: 12px;
    background-color: var(--bg-panel);
    overflow: hidden;
    transition: border-color 150ms ease, box-shadow 150ms ease, transform 150ms ease;
  }
  .card:hover {
    border-color: var(--accent);
    box-shadow: 0 6px 20px -12px rgba(0, 0, 0, 0.35);
    transform: translateY(-1px);
  }
  .card.menu-open:hover {
    transform: none;
  }
  .card-body {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 20px;
    padding-right: 44px;
    text-decoration: none;
    color: inherit;
  }
  .card-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .card-head h2 {
    font-size: 16px;
    font-weight: 600;
    margin: 0;
    color: var(--text-primary);
    min-width: 0;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .chip {
    font-size: 10px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 2px 8px;
    border-radius: 999px;
    background-color: var(--bg-secondary);
    color: var(--text-secondary);
  }
  .chip-danger {
    background-color: rgba(239, 68, 68, 0.12);
    color: #ef4444;
  }
  .desc {
    margin: 0;
    font-size: 13px;
    line-height: 1.5;
    color: var(--text-secondary);
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .swatches {
    display: flex;
    gap: 6px;
    margin-top: auto;
  }
  .swatch {
    flex: 1;
    height: 28px;
    border-radius: 6px;
    border: 1px solid var(--border);
    box-sizing: border-box;
  }

  .kebab-wrap {
    position: absolute;
    top: 10px;
    right: 10px;
  }
  .kebab {
    width: 28px;
    height: 28px;
    display: grid;
    place-items: center;
    border-radius: 8px;
    border: 0;
    background: transparent;
    color: var(--text-tertiary);
    cursor: pointer;
    transition: background-color 150ms ease, color 150ms ease;
  }
  .kebab:hover {
    background-color: var(--bg-tertiary);
    color: var(--text-primary);
  }
  .menu {
    position: absolute;
    top: 34px;
    right: 0;
    width: 160px;
    padding: 4px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background-color: var(--bg-tertiary);
    box-shadow: 0 10px 30px -8px rgba(0, 0, 0, 0.6),
      0 2px 6px rgba(0, 0, 0, 0.4);
    z-index: 50;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 10px;
    border: 0;
    background: transparent;
    color: var(--text-primary);
    font-size: 12.5px;
    text-align: left;
    border-radius: 5px;
    cursor: pointer;
    transition: background-color 150ms ease;
  }
  .menu-item:hover {
    background-color: var(--bg-tertiary);
  }
  .menu-item-danger {
    color: #ef4444;
  }
</style>
