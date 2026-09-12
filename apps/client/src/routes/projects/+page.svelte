<script lang="ts">
  import { onMount, tick } from "svelte";
  import { goto } from "$app/navigation";
  import { page as pageStore } from "$app/stores";
  import { listProjects, createProject, type Project } from "$lib/api/projects";
  import { auth } from "$lib/stores/auth";

  const PAGE_SIZE = 12;

  let items: Project[] = [];
  let total = 0;

  let loading = true;
  let error = "";

  let searchInput = "";
  let q = "";
  let page = 1;

  let mounted = false;
  let lastKey = "";
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  let showCreate = false;
  let newName = "";
  let createBusy = false;
  let createError = "";
  let nameInput: HTMLInputElement | null = null;

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
      const res = await listProjects({ q, page, pageSize: PAGE_SIZE });
      items = res.items;
      total = res.total;
      if (page > 1 && items.length === 0 && total > 0) {
        page = 1;
      }
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

  const openCreate = async () => {
    showCreate = true;
    createError = "";
    newName = "";
    await tick();
    nameInput?.focus();
  };

  const closeCreate = () => {
    if (createBusy) return;
    showCreate = false;
    newName = "";
    createError = "";
  };

  const submitCreate = async () => {
    const name = newName.trim();
    if (!name || createBusy) return;
    createBusy = true;
    createError = "";
    try {
      await createProject(name);
      showCreate = false;
      newName = "";
      lastKey = "";
      page = 1;
      q = "";
      searchInput = "";
    } catch (e) {
      createError = e instanceof Error ? e.message : String(e);
    } finally {
      createBusy = false;
    }
  };

  const onKeydown = (e: KeyboardEvent) => {
    if (e.key === "Escape") closeCreate();
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
    } catch {
      return "";
    }
  };
</script>

<svelte:head>
  <title>Projects — Blind Code</title>
</svelte:head>

<svelte:window on:keydown={onKeydown} />

<div class="px-6 py-8">
  <div class="max-w-5xl mx-auto">
    <div class="flex items-start justify-between gap-6">
      <div>
        <h1 class="text-2xl font-semibold">Projects</h1>
        <p class="mt-2 text-sm" style="color: var(--text-secondary);">
          Manage your workspaces and recent builds.
        </p>
      </div>
      <button
        class="px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors cursor-pointer"
        style="background-color: var(--accent);"
        on:click={openCreate}
      >
        New project
      </button>
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
        placeholder="Search by name or description…"
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

    {#if error}
      <div
        class="mt-6 rounded-lg border px-4 py-3 text-sm"
        style="border-color: #ef4444; color: #ef4444; background-color: rgba(239, 68, 68, 0.08);"
      >
        {error}
      </div>
    {/if}

    {#if loading && items.length === 0}
      <div class="mt-8 text-sm" style="color: var(--text-tertiary);">Loading…</div>
    {:else if items.length === 0}
      <div class="mt-16 text-center">
        {#if q}
          <p class="text-sm" style="color: var(--text-secondary);">
            No projects match "{q}".
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
          <p class="text-sm" style="color: var(--text-secondary);">No projects yet.</p>
          <p class="text-xs mt-1" style="color: var(--text-tertiary);">
            Create one to get started.
          </p>
        {/if}
      </div>
    {:else}
      <div class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {#each items as project (project.id)}
          <a
            href={`/projects/${project.id}/workspace`}
            class="block rounded-xl border transition-transform no-underline p-4"
            style="border-color: var(--border); background-color: var(--bg-secondary); color: var(--text-primary);"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="text-sm font-medium truncate">{project.name}</span>
              <span class="text-[11px] shrink-0" style="color: var(--text-tertiary);">
                {formatDate(project.updatedAt)}
              </span>
            </div>
            <p class="mt-3 text-xs line-clamp-2" style="color: var(--text-secondary);">
              {project.description ?? "No description."}
            </p>
            {#if project.isArchived}
              <span
                class="mt-3 inline-block text-[10px] px-1.5 py-0.5 rounded"
                style="background-color: var(--bg-tertiary); color: var(--text-tertiary);"
              >
                Archived
              </span>
            {/if}
          </a>
        {/each}
      </div>

      {#if totalPages > 1}
        <div class="mt-8 flex items-center justify-between gap-3">
          <span class="text-xs" style="color: var(--text-tertiary);">
            {total} project{total === 1 ? "" : "s"}
          </span>
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
        </div>
      {/if}
    {/if}
  </div>
</div>

{#if showCreate}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-noninteractive-element-interactions -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center px-4"
    style="background-color: rgba(0, 0, 0, 0.55);"
    on:click|self={closeCreate}
    role="dialog"
    aria-modal="true"
    aria-labelledby="create-project-title"
    tabindex="-1"
  >
    <form
      on:submit|preventDefault={submitCreate}
      class="w-full max-w-md rounded-xl border shadow-xl"
      style="border-color: var(--border); background-color: var(--bg-secondary);"
    >
      <div class="px-5 pt-5 pb-4 border-b" style="border-color: var(--border);">
        <h2 id="create-project-title" class="text-base font-semibold">New project</h2>
        <p class="mt-1 text-xs" style="color: var(--text-secondary);">
          Give it a short, memorable name. You can rename it later.
        </p>
      </div>

      <div class="px-5 py-5">
        <label class="block text-xs font-medium" style="color: var(--text-secondary);">
          Project name
          <input
            type="text"
            bind:this={nameInput}
            bind:value={newName}
            placeholder="e.g. landing-page"
            required
            class="mt-1 w-full text-sm px-3 py-2 rounded-md border bg-transparent outline-none"
            style="border-color: var(--border); color: var(--text-primary); background-color: var(--bg-panel);"
          />
        </label>

        {#if createError}
          <div
            class="mt-3 rounded-md border px-3 py-2 text-xs"
            style="border-color: #ef4444; color: #ef4444; background-color: rgba(239, 68, 68, 0.08);"
          >
            {createError}
          </div>
        {/if}
      </div>

      <div
        class="px-5 py-4 flex items-center justify-end gap-2 border-t"
        style="border-color: var(--border); background-color: var(--bg-tertiary); border-bottom-left-radius: 0.75rem; border-bottom-right-radius: 0.75rem;"
      >
        <button
          type="button"
          class="px-3 py-2 rounded-md text-sm font-medium border cursor-pointer disabled:opacity-50"
          style="border-color: var(--border); color: var(--text-secondary); background-color: var(--bg-panel);"
          disabled={createBusy}
          on:click={closeCreate}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!newName.trim() || createBusy}
          class="px-3 py-2 rounded-md text-sm font-medium text-white cursor-pointer disabled:opacity-50"
          style="background-color: var(--accent);"
        >
          {createBusy ? "Creating…" : "Create project"}
        </button>
      </div>
    </form>
  </div>
{/if}
