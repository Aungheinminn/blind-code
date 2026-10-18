<script lang="ts">
  import { createEventDispatcher, onDestroy } from "svelte";
  import type { DesignTemplateSummary } from "$lib/api/projects";
  import dotsVerticalIcon from "$lib/assets/icons/dots-vertical.svg?raw";
  import editPencilIcon from "$lib/assets/icons/edit-pencil.svg?raw";
  import archiveIcon from "$lib/assets/icons/archive.svg?raw";
  import unarchiveIcon from "$lib/assets/icons/unarchive.svg?raw";
  import trashIcon from "$lib/assets/icons/trash.svg?raw";
  import restoreIcon from "$lib/assets/icons/restore.svg?raw";

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
        <span class="icon-14" aria-hidden="true">{@html dotsVerticalIcon}</span>
      </button>

      {#if menuOpen}
        <div class="menu" role="menu">
          {#if variant === "active"}
            <button type="button" role="menuitem" on:click={onRename} class="menu-item">
              <span class="icon-13" aria-hidden="true">{@html editPencilIcon}</span>
              <span>Edit title</span>
            </button>
            <button type="button" role="menuitem" on:click={onArchive} class="menu-item">
              <span class="icon-13" aria-hidden="true">{@html archiveIcon}</span>
              <span>Archive</span>
            </button>
            <button type="button" role="menuitem" on:click={onDelete} class="menu-item menu-item-danger">
              <span class="icon-13" aria-hidden="true">{@html trashIcon}</span>
              <span>Delete</span>
            </button>
          {:else if variant === "archived"}
            <button type="button" role="menuitem" on:click={onUnarchive} class="menu-item">
              <span class="icon-13" aria-hidden="true">{@html unarchiveIcon}</span>
              <span>Unarchive</span>
            </button>
            <button type="button" role="menuitem" on:click={onDelete} class="menu-item menu-item-danger">
              <span class="icon-13" aria-hidden="true">{@html trashIcon}</span>
              <span>Delete</span>
            </button>
          {:else}
            <button type="button" role="menuitem" on:click={onRestore} class="menu-item">
              <span class="icon-13" aria-hidden="true">{@html restoreIcon}</span>
              <span>Restore</span>
            </button>
            <button type="button" role="menuitem" on:click={onPermanentDelete} class="menu-item menu-item-danger">
              <span class="icon-13" aria-hidden="true">{@html trashIcon}</span>
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
  .icon-13 {
    display: inline-flex;
    width: 13px;
    height: 13px;
  }
  .icon-14 {
    display: inline-flex;
    width: 14px;
    height: 14px;
  }
</style>
