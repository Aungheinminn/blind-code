<script lang="ts">
  import { tick } from "svelte";
  import { listProjects, createProject, type Project } from "$lib/api/projects";
  import { auth } from "$lib/stores/auth";

  let projects: Project[] = [];
  let loading = true;
  let error = "";
  let loaded = false;

  let showCreate = false;
  let newName = "";
  let createBusy = false;
  let createError = "";
  let nameInput: HTMLInputElement | null = null;

  const load = async () => {
    loading = true;
    error = "";
    try {
      projects = (await listProjects()).items;
      loaded = true;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
    }
  };

  $: if ($auth.status === "authed" && !loaded) load();

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
      await load();
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

    {#if error}
      <div
        class="mt-6 rounded-lg border px-4 py-3 text-sm"
        style="border-color: #ef4444; color: #ef4444; background-color: rgba(239, 68, 68, 0.08);"
      >
        {error}
      </div>
    {/if}

    {#if loading}
      <div class="mt-8 text-sm" style="color: var(--text-tertiary);">Loading…</div>
    {:else if projects.length === 0}
      <div class="mt-16 text-center">
        <p class="text-sm" style="color: var(--text-secondary);">No projects yet.</p>
        <p class="text-xs mt-1" style="color: var(--text-tertiary);">
          Create one to get started.
        </p>
      </div>
    {:else}
      <div class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {#each projects as project (project.id)}
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
