<script lang="ts">
  import { createEventDispatcher, onDestroy } from "svelte";
  import type { Project } from "$lib/api/projects";

  export let project: Project;
  export let variant: "active" | "archived" | "deleted" = "active";

  const dispatch = createEventDispatcher<{
    edit: Project;
    delete: Project;
    archive: Project;
    unarchive: Project;
    restore: Project;
    permanentDelete: Project;
  }>();

  let menuOpen = false;
  let menuAnchor: HTMLDivElement | null = null;

  const closeMenu = () => (menuOpen = false);

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

  const fire = (name: "edit" | "delete" | "archive" | "unarchive" | "restore" | "permanentDelete") =>
    (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      menuOpen = false;
      dispatch(name, project);
    };

  const onEdit = fire("edit");
  const onDelete = fire("delete");
  const onArchive = fire("archive");
  const onUnarchive = fire("unarchive");
  const onRestore = fire("restore");
  const onPermanentDelete = fire("permanentDelete");

  const formatDate = (iso: string): string => {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
    } catch {
      return "";
    }
  };

  onDestroy(closeMenu);
</script>

<svelte:window on:click={handleWindowClick} on:keydown={handleKeydown} />

<div
  class="relative rounded-xl border project-card"
  style="border-color: var(--border); background-color: var(--bg-secondary); color: var(--text-primary);"
>
  {#if variant === "deleted"}
    <div class="block p-4 pr-10" style="color: var(--text-primary);">
      <span class="block text-sm font-medium truncate">{project.name}</span>
      <p class="mt-3 text-xs line-clamp-2" style="color: var(--text-secondary);">
        {project.description ?? "No description."}
      </p>
      <span class="mt-3 block text-[11px]" style="color: var(--text-tertiary);">
        {formatDate(project.updatedAt)}
      </span>
      <span
        class="mt-2 inline-block text-[10px] px-1.5 py-0.5 rounded"
        style="background-color: rgba(239, 68, 68, 0.12); color: #ef4444;"
      >
        Deleted
      </span>
    </div>
  {:else}
    <a
      href={`/projects/${project.id}/workspace`}
      class="block p-4 pr-10 no-underline"
      style="color: var(--text-primary);"
    >
      <span class="block text-sm font-medium truncate">{project.name}</span>
      <p class="mt-3 text-xs line-clamp-2" style="color: var(--text-secondary);">
        {project.description ?? "No description."}
      </p>
      <span class="mt-3 block text-[11px]" style="color: var(--text-tertiary);">
        {formatDate(project.updatedAt)}
      </span>
      {#if project.isArchived}
        <span
          class="mt-2 inline-block text-[10px] px-1.5 py-0.5 rounded"
          style="background-color: var(--bg-tertiary); color: var(--text-tertiary);"
        >
          Archived
        </span>
      {/if}
    </a>
  {/if}

  <div class="absolute top-2 right-2" bind:this={menuAnchor}>
    <button
      type="button"
      on:click={toggleMenu}
      aria-haspopup="menu"
      aria-expanded={menuOpen}
      aria-label="Project actions"
      title="More"
      class="w-7 h-7 grid place-items-center rounded-md cursor-pointer kebab"
      style="color: var(--text-tertiary);"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="5" r="1.6" />
        <circle cx="12" cy="12" r="1.6" />
        <circle cx="12" cy="19" r="1.6" />
      </svg>
    </button>

    {#if menuOpen}
      <div
        role="menu"
        class="absolute right-0 mt-1 w-44 rounded-lg border shadow-lg py-1 z-10"
        style="border-color: var(--border); background-color: var(--bg-panel);"
      >
        {#if variant === "active"}
          <button
            type="button"
            role="menuitem"
            on:click={onEdit}
            class="w-full text-left px-3 py-2 text-[12.5px] cursor-pointer flex items-center gap-2 menu-item"
            style="color: var(--text-primary); background-color: transparent;"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
            </svg>
            <span>Edit</span>
          </button>
          <button
            type="button"
            role="menuitem"
            on:click={onArchive}
            class="w-full text-left px-3 py-2 text-[12.5px] cursor-pointer flex items-center gap-2 menu-item"
            style="color: var(--text-primary); background-color: transparent;"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="4" width="18" height="4" rx="1" />
              <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" />
              <line x1="10" y1="12" x2="14" y2="12" />
            </svg>
            <span>Archive</span>
          </button>
          <button
            type="button"
            role="menuitem"
            on:click={onDelete}
            class="w-full text-left px-3 py-2 text-[12.5px] cursor-pointer flex items-center gap-2 menu-item"
            style="color: #ef4444; background-color: transparent;"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
            </svg>
            <span>Delete</span>
          </button>
        {:else if variant === "archived"}
          <button
            type="button"
            role="menuitem"
            on:click={onUnarchive}
            class="w-full text-left px-3 py-2 text-[12.5px] cursor-pointer flex items-center gap-2 menu-item"
            style="color: var(--text-primary); background-color: transparent;"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="4" width="18" height="4" rx="1" />
              <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" />
              <path d="M9 15l3 -3l3 3" />
              <line x1="12" y1="12" x2="12" y2="19" />
            </svg>
            <span>Unarchive</span>
          </button>
          <button
            type="button"
            role="menuitem"
            on:click={onDelete}
            class="w-full text-left px-3 py-2 text-[12.5px] cursor-pointer flex items-center gap-2 menu-item"
            style="color: #ef4444; background-color: transparent;"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
            </svg>
            <span>Delete</span>
          </button>
        {:else}
          <button
            type="button"
            role="menuitem"
            on:click={onRestore}
            class="w-full text-left px-3 py-2 text-[12.5px] cursor-pointer flex items-center gap-2 menu-item"
            style="color: var(--text-primary); background-color: transparent;"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 12a9 9 0 1 0 3-6.7" />
              <polyline points="3 4 3 10 9 10" />
            </svg>
            <span>Restore</span>
          </button>
          <button
            type="button"
            role="menuitem"
            on:click={onPermanentDelete}
            class="w-full text-left px-3 py-2 text-[12.5px] cursor-pointer flex items-center gap-2 menu-item"
            style="color: #ef4444; background-color: transparent;"
          >
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
</div>

<style>
  .project-card {
    transition: border-color 150ms ease, box-shadow 150ms ease, transform 150ms ease;
  }
  .project-card:hover {
    border-color: var(--accent) !important;
    box-shadow: 0 6px 20px -12px rgba(0, 0, 0, 0.35);
    transform: translateY(-1px);
  }
  .kebab:hover {
    background-color: var(--bg-tertiary);
    color: var(--text-primary);
  }
  .menu-item:hover {
    background-color: var(--bg-tertiary);
  }
</style>
