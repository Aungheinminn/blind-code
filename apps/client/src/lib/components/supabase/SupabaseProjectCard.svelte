<script lang="ts">
  import { createEventDispatcher, onDestroy } from "svelte";
  import { goto } from "$app/navigation";
  import type { SupabaseAccountProject } from "$lib/api/account";

  export let supabaseProject: SupabaseAccountProject;
  export let attachedBcProject: { id: string; name: string } | null = null;

  const dispatch = createEventDispatcher<{
    attach: SupabaseAccountProject;
    delete: SupabaseAccountProject;
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

  const handleGlobalKeydown = (e: KeyboardEvent) => {
    if (e.key === "Escape") menuOpen = false;
  };

  const onDeleteClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    menuOpen = false;
    dispatch("delete", supabaseProject);
  };

  onDestroy(closeMenu);

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return "";
    }
  };

  const handleClick = () => {
    if (attachedBcProject) {
      goto(`/supabase/${attachedBcProject.id}`);
    } else {
      dispatch("attach", supabaseProject);
    }
  };

  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };
</script>

<svelte:window on:click={handleWindowClick} on:keydown={handleGlobalKeydown} />

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
  role="button"
  tabindex="0"
  class="card relative"
  on:click={handleClick}
  on:keydown={handleKeydown}
>
  <div class="flex items-start justify-between gap-2 pr-8">
    <div class="min-w-0 flex-1">
      <div class="text-sm font-medium truncate">{supabaseProject.name}</div>
      <div class="mt-1 text-[11px] font-mono truncate" style="color: var(--text-tertiary);">
        {supabaseProject.id}
      </div>
    </div>
    {#if supabaseProject.status}
      <span
        class="text-[10px] px-1.5 py-0.5 rounded"
        style="background-color: var(--bg-tertiary); color: var(--text-tertiary);"
        title={supabaseProject.status}
      >
        {supabaseProject.status.replace(/^ACTIVE_/, "").replace(/_/g, " ").toLowerCase()}
      </span>
    {/if}
  </div>

  <div class="absolute top-2 right-2" bind:this={menuAnchor}>
    <button
      type="button"
      on:click={toggleMenu}
      aria-haspopup="menu"
      aria-expanded={menuOpen}
      aria-label="Supabase project actions"
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
        class="absolute right-0 mt-1 w-36 rounded-lg border shadow-lg py-1 z-10"
        style="border-color: var(--border); background-color: var(--bg-panel);"
      >
        <button
          type="button"
          role="menuitem"
          on:click={onDeleteClick}
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
      </div>
    {/if}
  </div>

  <div class="mt-3 flex items-center gap-3 text-[11px]" style="color: var(--text-secondary);">
    <span>{supabaseProject.region}</span>
    <span aria-hidden="true">·</span>
    <span>Created {formatDate(supabaseProject.created_at)}</span>
  </div>

  <div class="mt-3 flex items-center justify-between gap-2">
    {#if attachedBcProject}
      <span class="attach-badge attached">
        <span class="dot"></span>
        Attached to <span class="font-medium truncate max-w-[10rem]">{attachedBcProject.name}</span>
      </span>
      <span class="text-[11px]" style="color: var(--accent);">Manage →</span>
    {:else}
      <span class="attach-badge unattached">Not attached</span>
      <span class="text-[11px]" style="color: var(--accent);">Attach →</span>
    {/if}
  </div>
</div>

<style>
  .card {
    display: block;
    text-align: left;
    padding: 14px;
    border-radius: 12px;
    border: 1px solid var(--border);
    background-color: var(--bg-secondary);
    color: var(--text-primary);
    cursor: pointer;
    transition: border-color 150ms ease, transform 150ms ease;
  }
  .card:hover {
    border-color: var(--border-strong, var(--accent));
    transform: translateY(-1px);
  }
  .card:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .attach-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 8px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 500;
    border: 1px solid var(--border);
    background-color: var(--bg-panel);
    color: var(--text-secondary);
  }
  .attach-badge.attached {
    color: #16a34a;
    border-color: rgba(34, 197, 94, 0.35);
    background-color: rgba(34, 197, 94, 0.08);
  }
  .attach-badge.attached .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: #22c55e;
  }
  .kebab:hover {
    background-color: var(--bg-tertiary);
    color: var(--text-primary);
  }
  .menu-item:hover {
    background-color: var(--bg-tertiary);
  }
</style>
