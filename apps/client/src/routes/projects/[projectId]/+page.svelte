<script lang="ts">
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import {
    getProject,
    updateProject,
    deleteProject,
    type Project,
  } from "$lib/api/projects";
  import { auth } from "$lib/stores/auth";

  $: projectId = $page.params.projectId;
  let loadedFor = "";

  let project: Project | null = null;
  let loading = true;
  let error = "";

  let name = "";
  let description = "";
  let isArchived = false;

  let saveBusy = false;
  let saveMsg = "";
  let confirmingDelete = false;
  let deleteBusy = false;

  const load = async (id: string) => {
    loading = true;
    error = "";
    saveMsg = "";
    try {
      const p = await getProject(id);
      if (!p) {
        error = "Project not found.";
        project = null;
      } else {
        project = p;
        name = p.name;
        description = p.description ?? "";
        isArchived = p.isArchived;
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
    }
  };

  $: if ($auth.status === "authed" && projectId && loadedFor !== projectId) {
    loadedFor = projectId;
    load(projectId);
  }

  $: dirty =
    project !== null &&
    (name !== project.name ||
      description !== (project.description ?? "") ||
      isArchived !== project.isArchived);

  const save = async () => {
    if (!project || !dirty || saveBusy) return;
    saveBusy = true;
    saveMsg = "";
    try {
      const updated = await updateProject(project.id, {
        name: name.trim() || project.name,
        description: description.trim() === "" ? null : description,
        isArchived,
      });
      if (updated) {
        project = updated;
        name = updated.name;
        description = updated.description ?? "";
        isArchived = updated.isArchived;
        saveMsg = "Saved.";
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      saveBusy = false;
    }
  };

  const confirmDelete = async () => {
    if (!project || deleteBusy) return;
    deleteBusy = true;
    try {
      await deleteProject(project.id);
      goto("/projects");
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      deleteBusy = false;
      confirmingDelete = false;
    }
  };
</script>

<svelte:head>
  <title>{project?.name ?? "Project"} — Blind Code</title>
</svelte:head>

<div class="px-6 py-8">
  <div class="max-w-2xl mx-auto">
    <a
      href="/projects"
      class="text-xs no-underline"
      style="color: var(--text-tertiary);"
    >
      ← Back to projects
    </a>

    {#if loading}
      <div class="mt-6 text-sm" style="color: var(--text-tertiary);">Loading…</div>
    {:else if error && !project}
      <div
        class="mt-6 rounded-lg border px-4 py-3 text-sm"
        style="border-color: #ef4444; color: #ef4444; background-color: rgba(239, 68, 68, 0.08);"
      >
        {error}
      </div>
    {:else if project}
      <div class="mt-4 flex items-start justify-between gap-4">
        <h1 class="text-2xl font-semibold break-words">{project.name}</h1>
        <a
          href={`/projects/${project.id}/workspace`}
          class="shrink-0 px-3 py-2 rounded-lg text-sm font-medium text-white no-underline"
          style="background-color: var(--accent);"
        >
          Open workspace
        </a>
      </div>

      <p class="mt-1 text-xs font-mono" style="color: var(--text-tertiary);">
        {project.id}
      </p>

      {#if error}
        <div
          class="mt-4 rounded-lg border px-4 py-3 text-sm"
          style="border-color: #ef4444; color: #ef4444; background-color: rgba(239, 68, 68, 0.08);"
        >
          {error}
        </div>
      {/if}

      <form on:submit|preventDefault={save} class="mt-8 space-y-5">
        <div>
          <label
            for="project-name"
            class="block text-xs font-medium mb-1.5"
            style="color: var(--text-secondary);"
          >
            Name
          </label>
          <input
            id="project-name"
            type="text"
            class="w-full text-sm px-3 py-2 rounded-md border bg-transparent outline-none"
            style="border-color: var(--border); color: var(--text-primary); background-color: var(--bg-panel);"
            bind:value={name}
          />
        </div>

        <div>
          <label
            for="project-description"
            class="block text-xs font-medium mb-1.5"
            style="color: var(--text-secondary);"
          >
            Description
          </label>
          <textarea
            id="project-description"
            rows="4"
            class="w-full text-sm px-3 py-2 rounded-md border bg-transparent outline-none resize-none"
            style="border-color: var(--border); color: var(--text-primary); background-color: var(--bg-panel);"
            placeholder="What is this project for?"
            bind:value={description}
          ></textarea>
        </div>

        <label class="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" bind:checked={isArchived} />
          <span style="color: var(--text-secondary);">Archived</span>
        </label>

        <div class="flex items-center gap-3">
          <button
            type="submit"
            disabled={!dirty || saveBusy}
            class="px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors cursor-pointer disabled:opacity-50"
            style="background-color: var(--accent);"
          >
            {saveBusy ? "Saving…" : "Save changes"}
          </button>
          {#if saveMsg}
            <span class="text-xs" style="color: var(--success);">{saveMsg}</span>
          {/if}
        </div>
      </form>

      <div
        class="mt-12 rounded-xl border p-4"
        style="border-color: #ef4444; background-color: rgba(239, 68, 68, 0.05);"
      >
        <p class="text-sm font-medium" style="color: #ef4444;">Danger zone</p>
        <p class="mt-1 text-xs" style="color: var(--text-secondary);">
          Deleting a project removes it permanently. This cannot be undone.
        </p>
        {#if !confirmingDelete}
          <button
            type="button"
            class="mt-3 px-3 py-2 rounded-md text-sm font-medium border cursor-pointer"
            style="border-color: #ef4444; color: #ef4444; background-color: transparent;"
            on:click={() => (confirmingDelete = true)}
          >
            Delete project
          </button>
        {:else}
          <div class="mt-3 flex items-center gap-2">
            <button
              type="button"
              disabled={deleteBusy}
              class="px-3 py-2 rounded-md text-sm font-medium text-white cursor-pointer disabled:opacity-50"
              style="background-color: #ef4444;"
              on:click={confirmDelete}
            >
              {deleteBusy ? "Deleting…" : "Confirm delete"}
            </button>
            <button
              type="button"
              class="px-3 py-2 rounded-md text-sm font-medium border cursor-pointer"
              style="border-color: var(--border); color: var(--text-secondary); background-color: var(--bg-tertiary);"
              on:click={() => (confirmingDelete = false)}
            >
              Cancel
            </button>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>
