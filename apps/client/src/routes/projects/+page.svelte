<script lang="ts">
  import { onMount, tick } from "svelte";
  import { goto } from "$app/navigation";
  import { page as pageStore } from "$app/stores";
  import {
    listProjects,
    createProject,
    updateProject,
    deleteProject,
    type Project,
  } from "$lib/api/projects";
  import { auth } from "$lib/stores/auth";
  import ProjectCard from "$lib/components/projects/ProjectCard.svelte";

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
  let newDescription = "";
  let createBusy = false;
  let createError = "";
  let nameInput: HTMLInputElement | null = null;

  let editTarget: Project | null = null;
  let editName = "";
  let editDescription = "";
  let editBusy = false;
  let editError = "";
  let editNameInput: HTMLInputElement | null = null;

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
    newDescription = "";
    await tick();
    nameInput?.focus();
  };

  const closeCreate = () => {
    if (createBusy) return;
    showCreate = false;
    newName = "";
    newDescription = "";
    createError = "";
  };

  const submitCreate = async () => {
    const name = newName.trim();
    if (!name || createBusy) return;
    createBusy = true;
    createError = "";
    try {
      const description = newDescription.trim() ? newDescription : null;
      const project = await createProject({ name, description });
      if (!project?.id) throw new Error("Failed to create project.");
      goto(`/projects/${project.id}/workspace`);
    } catch (e) {
      createError = e instanceof Error ? e.message : String(e);
      createBusy = false;
    }
  };

  const openEdit = async (project: Project) => {
    editTarget = project;
    editName = project.name;
    editDescription = project.description ?? "";
    editError = "";
    await tick();
    editNameInput?.focus();
    editNameInput?.select();
  };

  const closeEdit = () => {
    if (editBusy) return;
    editTarget = null;
    editName = "";
    editDescription = "";
    editError = "";
  };

  const submitEdit = async () => {
    if (!editTarget || editBusy) return;
    const name = editName.trim();
    if (!name) return;
    const currentDesc = editTarget.description ?? "";
    const nextDesc = editDescription.trim() === "" ? null : editDescription;
    const nameChanged = name !== editTarget.name;
    const descChanged = (nextDesc ?? "") !== currentDesc;
    if (!nameChanged && !descChanged) {
      closeEdit();
      return;
    }
    editBusy = true;
    editError = "";
    try {
      const patch: { name?: string; description?: string | null } = {};
      if (nameChanged) patch.name = name;
      if (descChanged) patch.description = nextDesc;
      const updated = await updateProject(editTarget.id, patch);
      if (updated) {
        items = items.map((p) => (p.id === updated.id ? updated : p));
      }
      editTarget = null;
      editName = "";
      editDescription = "";
    } catch (e) {
      editError = e instanceof Error ? e.message : String(e);
    } finally {
      editBusy = false;
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
      await deleteProject(deleteTarget.id);
      const removedId = deleteTarget.id;
      deleteTarget = null;
      items = items.filter((p) => p.id !== removedId);
      total = Math.max(0, total - 1);
      if (items.length === 0 && page > 1) {
        page = page - 1;
      } else {
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
    if (e.key === "Escape") {
      closeCreate();
      closeEdit();
      closeDelete();
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
          <ProjectCard
            {project}
            on:edit={(e) => openEdit(e.detail)}
            on:delete={(e) => openDelete(e.detail)}
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

      <div class="px-5 py-5 space-y-4">
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

        <label class="block text-xs font-medium" style="color: var(--text-secondary);">
          Description
          <textarea
            rows="3"
            bind:value={newDescription}
            placeholder="What is this project for?"
            class="mt-1 w-full text-sm px-3 py-2 rounded-md border bg-transparent outline-none resize-none"
            style="border-color: var(--border); color: var(--text-primary); background-color: var(--bg-panel);"
          ></textarea>
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

{#if editTarget}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-noninteractive-element-interactions -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center px-4"
    style="background-color: rgba(0, 0, 0, 0.55);"
    on:click|self={closeEdit}
    role="dialog"
    aria-modal="true"
    aria-labelledby="edit-project-title"
    tabindex="-1"
  >
    <form
      on:submit|preventDefault={submitEdit}
      class="w-full max-w-md rounded-xl border shadow-xl"
      style="border-color: var(--border); background-color: var(--bg-secondary);"
    >
      <div class="px-5 pt-5 pb-4 border-b" style="border-color: var(--border);">
        <h2 id="edit-project-title" class="text-base font-semibold">Edit project</h2>
        <p class="mt-1 text-xs" style="color: var(--text-secondary);">
          Update the name or description.
        </p>
      </div>

      <div class="px-5 py-5 space-y-4">
        <label class="block text-xs font-medium" style="color: var(--text-secondary);">
          Project name
          <input
            type="text"
            bind:this={editNameInput}
            bind:value={editName}
            required
            class="mt-1 w-full text-sm px-3 py-2 rounded-md border bg-transparent outline-none"
            style="border-color: var(--border); color: var(--text-primary); background-color: var(--bg-panel);"
          />
        </label>

        <label class="block text-xs font-medium" style="color: var(--text-secondary);">
          Description
          <textarea
            rows="3"
            bind:value={editDescription}
            placeholder="What is this project for?"
            class="mt-1 w-full text-sm px-3 py-2 rounded-md border bg-transparent outline-none resize-none"
            style="border-color: var(--border); color: var(--text-primary); background-color: var(--bg-panel);"
          ></textarea>
        </label>

        {#if editError}
          <div
            class="rounded-md border px-3 py-2 text-xs"
            style="border-color: #ef4444; color: #ef4444; background-color: rgba(239, 68, 68, 0.08);"
          >
            {editError}
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
          disabled={editBusy}
          on:click={closeEdit}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!editName.trim() || editBusy}
          class="px-3 py-2 rounded-md text-sm font-medium text-white cursor-pointer disabled:opacity-50"
          style="background-color: var(--accent);"
        >
          {editBusy ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  </div>
{/if}

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
      <div class="px-5 pt-5 pb-4 border-b" style="border-color: var(--border);">
        <h2 id="delete-project-title" class="text-base font-semibold">Delete project</h2>
        <p class="mt-1 text-xs" style="color: var(--text-secondary);">
          "{deleteTarget.name}" will be permanently deleted. This cannot be undone.
        </p>
      </div>

      {#if deleteError}
        <div class="px-5 pt-4">
          <div
            class="rounded-md border px-3 py-2 text-xs"
            style="border-color: #ef4444; color: #ef4444; background-color: rgba(239, 68, 68, 0.08);"
          >
            {deleteError}
          </div>
        </div>
      {/if}

      <div
        class="px-5 py-4 flex items-center justify-end gap-2 border-t mt-4"
        style="border-color: var(--border); background-color: var(--bg-tertiary); border-bottom-left-radius: 0.75rem; border-bottom-right-radius: 0.75rem;"
      >
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
          {deleteBusy ? "Deleting…" : "Delete"}
        </button>
      </div>
    </div>
  </div>
{/if}
