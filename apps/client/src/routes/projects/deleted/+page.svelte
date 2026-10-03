<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { page as pageStore } from "$app/stores";
  import {
    listProjects,
    restoreProject,
    hardDeleteProject,
    type Project,
  } from "$lib/api/projects";
  import { auth } from "$lib/stores/auth";
  import ProjectCard from "$lib/components/projects/ProjectCard.svelte";

  const PAGE_SIZE = 12;

  let items: Project[] = [];
  let total = 0;
  let loading = true;
  let error = "";
  let actionError = "";

  let searchInput = "";
  let q = "";
  let page = 1;

  let mounted = false;
  let lastKey = "";
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  let deleteTarget: Project | null = null;
  let deleteBusy = false;
  let deleteError = "";

  onMount(() => {
    const params = $pageStore.url.searchParams;
    q = params.get("q") ?? "";
    searchInput = q;
    page = Math.max(1, Number(params.get("page") ?? "1") || 1);
    mounted = true;
  });

  $: totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  $: if (mounted && $auth.status === "authed") {
    const key = `${q}::${page}`;
    if (key !== lastKey) {
      lastKey = key;
      load();
      syncUrl();
    }
  }

  const load = async () => {
    loading = true;
    error = "";
    try {
      const res = await listProjects({
        q,
        page,
        pageSize: PAGE_SIZE,
        filter: "deleted",
      });
      items = res.items;
      total = res.total;
      if (page > 1 && items.length === 0 && total > 0) page = 1;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
    }
  };

  const syncUrl = () => {
    const url = new URL($pageStore.url);
    if (q) url.searchParams.set("q", q);
    else url.searchParams.delete("q");
    if (page > 1) url.searchParams.set("page", String(page));
    else url.searchParams.delete("page");
    goto(`${url.pathname}${url.search}`, {
      keepFocus: true,
      replaceState: true,
      noScroll: true,
    });
  };

  const onSearchInput = (e: Event) => {
    const val = (e.target as HTMLInputElement).value;
    searchInput = val;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      q = val.trim();
      page = 1;
    }, 250);
  };

  const clearSearch = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    searchInput = "";
    q = "";
    page = 1;
  };

  const goToPage = (n: number) => {
    const next = Math.min(totalPages, Math.max(1, n));
    if (next !== page) page = next;
  };

  const onRestore = async (project: Project) => {
    actionError = "";
    try {
      await restoreProject(project.id);
      items = items.filter((p) => p.id !== project.id);
      total = Math.max(0, total - 1);
      if (items.length === 0 && page > 1) page = page - 1;
      else {
        lastKey = "";
        load();
      }
    } catch (e) {
      actionError = e instanceof Error ? e.message : String(e);
    }
  };

  const openDelete = (project: Project) => {
    deleteTarget = project;
    deleteError = "";
  };

  const closeDelete = () => {
    if (deleteBusy) return;
    deleteTarget = null;
    deleteError = "";
  };

  const submitDelete = async () => {
    if (!deleteTarget || deleteBusy) return;
    deleteBusy = true;
    deleteError = "";
    try {
      await hardDeleteProject(deleteTarget.id);
      const removedId = deleteTarget.id;
      deleteTarget = null;
      items = items.filter((p) => p.id !== removedId);
      total = Math.max(0, total - 1);
      if (items.length === 0 && page > 1) page = page - 1;
      else {
        lastKey = "";
        load();
      }
    } catch (e) {
      deleteError = e instanceof Error ? e.message : String(e);
    } finally {
      deleteBusy = false;
    }
  };

  const onKeydown = (e: KeyboardEvent) => {
    if (e.key === "Escape") closeDelete();
  };
</script>

<svelte:head>
  <title>Deleted projects — Blind Code</title>
</svelte:head>

<svelte:window on:keydown={onKeydown} />

<div class="w-full max-w-[900px] mx-auto px-6 pt-14 pb-20">
  <div>
    <div>
      <h1 class="text-2xl font-semibold">Deleted projects</h1>
      <p class="mt-2 text-sm" style="color: var(--text-secondary);">
        Projects you've deleted. Restore to bring them back, or delete forever.
      </p>
    </div>

    <div class="mt-6 relative">
      <svg
        class="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        style="color: var(--text-tertiary);"
      >
        <circle cx="11" cy="11" r="7" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        type="text"
        value={searchInput}
        on:input={onSearchInput}
        placeholder="Search deleted projects…"
        class="w-full text-sm pl-9 pr-9 py-2 rounded-md border bg-transparent outline-none"
        style="border-color: var(--border); color: var(--text-primary); background-color: var(--bg-panel);"
      />
      {#if searchInput}
        <button
          type="button"
          on:click={clearSearch}
          aria-label="Clear search"
          class="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 grid place-items-center rounded cursor-pointer"
          style="color: var(--text-tertiary);"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      {/if}
    </div>

    {#if error || actionError}
      <div
        class="mt-6 rounded-lg border px-4 py-3 text-sm"
        style="border-color: #ef4444; color: #ef4444; background-color: rgba(239, 68, 68, 0.08);"
      >
        {error || actionError}
      </div>
    {/if}

    {#if loading && items.length === 0}
      <div class="mt-8 text-sm" style="color: var(--text-tertiary);">Loading…</div>
    {:else if items.length === 0}
      <div class="mt-16 text-center">
        {#if q}
          <p class="text-sm" style="color: var(--text-secondary);">
            No deleted projects match "{q}".
          </p>
          <button
            type="button"
            on:click={clearSearch}
            class="mt-2 text-xs underline cursor-pointer"
            style="color: var(--text-tertiary);"
          >
            Clear search
          </button>
        {:else}
          <p class="text-sm" style="color: var(--text-secondary);">No deleted projects.</p>
        {/if}
      </div>
    {:else}
      <div class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {#each items as project (project.id)}
          <ProjectCard
            variant="deleted"
            {project}
            on:restore={(e) => onRestore(e.detail)}
            on:permanentDelete={(e) => openDelete(e.detail)}
          />
        {/each}
      </div>

      <div class="mt-8 flex items-center justify-between gap-3">
        <span class="text-xs" style="color: var(--text-tertiary);">
          {total} project{total === 1 ? "" : "s"}
        </span>
        {#if totalPages > 1}
          <div class="flex items-center gap-2">
            <button
              type="button"
              on:click={() => goToPage(page - 1)}
              disabled={page <= 1 || loading}
              class="px-3 py-1.5 rounded-md border text-xs font-medium cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              style="border-color: var(--border); color: var(--text-secondary); background-color: var(--bg-panel);"
            >
              Prev
            </button>
            <span class="text-xs" style="color: var(--text-secondary);">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              on:click={() => goToPage(page + 1)}
              disabled={page >= totalPages || loading}
              class="px-3 py-1.5 rounded-md border text-xs font-medium cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              style="border-color: var(--border); color: var(--text-secondary); background-color: var(--bg-panel);"
            >
              Next
            </button>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

{#if deleteTarget}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-noninteractive-element-interactions -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center px-4"
    style="background-color: rgba(0, 0, 0, 0.55);"
    on:click|self={closeDelete}
    role="dialog"
    aria-modal="true"
    aria-labelledby="delete-project-title"
    tabindex="-1"
  >
    <div
      class="w-full max-w-md rounded-xl border shadow-xl"
      style="border-color: var(--border); background-color: var(--bg-secondary);"
    >
      <div class="px-5 pt-5 pb-4">
        <h2 id="delete-project-title" class="text-base font-semibold">Delete forever</h2>
        <p class="mt-1 text-xs" style="color: var(--text-secondary);">
          "{deleteTarget.name}" and all its files, chat history, and plans will be permanently deleted. This cannot be undone.
        </p>
      </div>

      {#if deleteError}
        <div class="px-5 pb-2">
          <div
            class="rounded-md border px-3 py-2 text-xs"
            style="border-color: #ef4444; color: #ef4444; background-color: rgba(239, 68, 68, 0.08);"
          >
            {deleteError}
          </div>
        </div>
      {/if}

      <div class="px-5 pb-5 flex items-center justify-end gap-2">
        <button
          type="button"
          class="px-3 py-2 rounded-md text-sm font-medium border cursor-pointer disabled:opacity-50"
          style="border-color: var(--border); color: var(--text-secondary); background-color: var(--bg-panel);"
          disabled={deleteBusy}
          on:click={closeDelete}
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={deleteBusy}
          on:click={submitDelete}
          class="px-3 py-2 rounded-md text-sm font-medium text-white cursor-pointer disabled:opacity-50"
          style="background-color: #ef4444;"
        >
          {deleteBusy ? "Deleting…" : "Delete forever"}
        </button>
      </div>
    </div>
  </div>
{/if}
