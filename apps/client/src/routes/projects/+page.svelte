<script lang="ts">
  import { onMount } from "svelte";
  import { listProjects, createProject, type Project } from "$lib/api/projects";

  let projects: Project[] = [];
  let loading = true;
  let error = "";

  let creating = false;
  let newName = "";
  let createBusy = false;

  const load = async () => {
    loading = true;
    error = "";
    try {
      projects = await listProjects();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
    }
  };

  onMount(load);

  const submitCreate = async () => {
    const name = newName.trim();
    if (!name || createBusy) return;
    createBusy = true;
    try {
      await createProject(name);
      newName = "";
      creating = false;
      await load();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      createBusy = false;
    }
  };

  const cancelCreate = () => {
    creating = false;
    newName = "";
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

<div class="px-6 py-8">
  <div class="max-w-5xl mx-auto">
    <div class="flex items-start justify-between gap-6">
      <div>
        <h1 class="text-2xl font-semibold">Projects</h1>
        <p class="mt-2 text-sm" style="color: var(--text-secondary);">
          Manage your workspaces and recent builds.
        </p>
      </div>
      {#if !creating}
        <button
          class="px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors cursor-pointer"
          style="background-color: var(--accent);"
          on:click={() => (creating = true)}
        >
          New project
        </button>
      {/if}
    </div>

    {#if creating}
      <form
        on:submit|preventDefault={submitCreate}
        class="mt-6 flex items-center gap-2 rounded-xl border p-3"
        style="border-color: var(--border); background-color: var(--bg-secondary);"
      >
        <input
          type="text"
          class="flex-1 text-sm px-3 py-2 rounded-md border bg-transparent outline-none"
          style="border-color: var(--border); color: var(--text-primary); background-color: var(--bg-panel);"
          placeholder="Project name"
          bind:value={newName}
        />
        <button
          type="submit"
          disabled={!newName.trim() || createBusy}
          class="px-3 py-2 rounded-md text-sm font-medium text-white transition-colors cursor-pointer disabled:opacity-50"
          style="background-color: var(--accent);"
        >
          {createBusy ? "Creating…" : "Create"}
        </button>
        <button
          type="button"
          class="px-3 py-2 rounded-md text-sm font-medium border cursor-pointer"
          style="border-color: var(--border); color: var(--text-secondary); background-color: var(--bg-tertiary);"
          on:click={cancelCreate}
        >
          Cancel
        </button>
      </form>
    {/if}

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
            href={`/projects/${project.id}`}
            class="rounded-xl border p-4 no-underline transition-transform"
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
