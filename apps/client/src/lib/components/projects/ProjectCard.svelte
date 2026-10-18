<script lang="ts">
  import { createEventDispatcher, onDestroy } from "svelte";
  import type { Project } from "$lib/api/projects";
  import dotsVerticalIcon from "$lib/assets/icons/dots-vertical.svg?raw";
  import editPencilIcon from "$lib/assets/icons/edit-pencil.svg?raw";
  import settingsGearIcon from "$lib/assets/icons/settings-gear.svg?raw";
  import archiveIcon from "$lib/assets/icons/archive.svg?raw";
  import unarchiveIcon from "$lib/assets/icons/unarchive.svg?raw";
  import trashIcon from "$lib/assets/icons/trash.svg?raw";
  import restoreIcon from "$lib/assets/icons/restore.svg?raw";

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
  class:menu-open={menuOpen}
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
      <span class="icon-14" aria-hidden="true">{@html dotsVerticalIcon}</span>
    </button>

    {#if menuOpen}
      <div
        role="menu"
        class="absolute right-0 mt-1 w-44 rounded-lg border py-1 z-50"
        style="border-color: var(--border); background-color: var(--bg-tertiary); box-shadow: 0 10px 30px -8px rgba(0, 0, 0, 0.6), 0 2px 6px rgba(0, 0, 0, 0.4);"
      >
        {#if variant === "active"}
          <button
            type="button"
            role="menuitem"
            on:click={onEdit}
            class="w-full text-left px-3 py-2 text-[12.5px] cursor-pointer flex items-center gap-2 menu-item"
            style="color: var(--text-primary); background-color: transparent;"
          >
            <span class="icon-13" aria-hidden="true">{@html editPencilIcon}</span>
            <span>Edit</span>
          </button>
          <a
            role="menuitem"
            href={`/projects/${project.id}`}
            on:click={closeMenu}
            class="w-full text-left px-3 py-2 text-[12.5px] cursor-pointer flex items-center gap-2 menu-item no-underline"
            style="color: var(--text-primary); background-color: transparent;"
          >
            <span class="icon-13" aria-hidden="true">{@html settingsGearIcon}</span>
            <span>Settings</span>
          </a>
          <button
            type="button"
            role="menuitem"
            on:click={onArchive}
            class="w-full text-left px-3 py-2 text-[12.5px] cursor-pointer flex items-center gap-2 menu-item"
            style="color: var(--text-primary); background-color: transparent;"
          >
            <span class="icon-13" aria-hidden="true">{@html archiveIcon}</span>
            <span>Archive</span>
          </button>
          <button
            type="button"
            role="menuitem"
            on:click={onDelete}
            class="w-full text-left px-3 py-2 text-[12.5px] cursor-pointer flex items-center gap-2 menu-item"
            style="color: #ef4444; background-color: transparent;"
          >
            <span class="icon-13" aria-hidden="true">{@html trashIcon}</span>
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
            <span class="icon-13" aria-hidden="true">{@html unarchiveIcon}</span>
            <span>Unarchive</span>
          </button>
          <button
            type="button"
            role="menuitem"
            on:click={onDelete}
            class="w-full text-left px-3 py-2 text-[12.5px] cursor-pointer flex items-center gap-2 menu-item"
            style="color: #ef4444; background-color: transparent;"
          >
            <span class="icon-13" aria-hidden="true">{@html trashIcon}</span>
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
            <span class="icon-13" aria-hidden="true">{@html restoreIcon}</span>
            <span>Restore</span>
          </button>
          <button
            type="button"
            role="menuitem"
            on:click={onPermanentDelete}
            class="w-full text-left px-3 py-2 text-[12.5px] cursor-pointer flex items-center gap-2 menu-item"
            style="color: #ef4444; background-color: transparent;"
          >
            <span class="icon-13" aria-hidden="true">{@html trashIcon}</span>
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
  .project-card.menu-open:hover {
    transform: none;
  }
  .kebab:hover {
    background-color: var(--bg-tertiary);
    color: var(--text-primary);
  }
  .menu-item:hover {
    background-color: var(--bg-tertiary);
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
