<script lang="ts">
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import {
    getProject,
    updateProject,
    deleteProject,
    type AgentToolName,
    type AgentToolPermissions,
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

  const AGENT_TOOLS: Array<{
    key: AgentToolName;
    title: string;
    description: string;
  }> = [
    {
      key: "create_supabase_project",
      title: "create_supabase_project",
      description:
        "Let the agent provision a brand-new Supabase project on your account when the app it's building needs a backend. Uses one of your Supabase project slots.",
    },
    {
      key: "attach_supabase_project",
      title: "attach_supabase_project",
      description:
        "Let the agent link an existing Supabase project (by ref) to this workspace and fetch its API keys.",
    },
  ];

  const resolvePerm = (
    perms: AgentToolPermissions | null | undefined,
    key: AgentToolName,
  ): boolean => (perms?.[key] ?? true);

  let permBusy: Record<string, boolean> = {};

  const togglePerm = async (key: AgentToolName, next: boolean) => {
    if (!project) return;
    permBusy = { ...permBusy, [key]: true };
    try {
      const current: AgentToolPermissions = {
        create_supabase_project: resolvePerm(
          project.agentToolPermissions,
          "create_supabase_project",
        ),
        attach_supabase_project: resolvePerm(
          project.agentToolPermissions,
          "attach_supabase_project",
        ),
      };
      current[key] = next;
      const updated = await updateProject(project.id, {
        agentToolPermissions: current,
      });
      if (updated) project = updated;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      permBusy = { ...permBusy, [key]: false };
    }
  };

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
      <h1 class="mt-4 text-2xl font-semibold break-words">{project.name}</h1>

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

      <section class="mt-12">
        <h2 class="text-sm font-semibold" style="color: var(--text-primary);">
          Agent tool permissions
        </h2>
        <p class="mt-1 text-xs" style="color: var(--text-tertiary);">
          Control which Supabase-related tools the agent may call in this workspace.
          Both are on by default when you've connected Supabase at
          <a href="/settings/supabase" class="underline">/settings/supabase</a>.
        </p>

        <ul class="mt-4 space-y-3">
          {#each AGENT_TOOLS as t}
            {@const enabled = resolvePerm(project.agentToolPermissions, t.key)}
            {@const busy = permBusy[t.key]}
            <li
              class="flex items-start justify-between gap-4 rounded-lg border px-4 py-3"
              style="border-color: var(--border); background-color: var(--bg-panel);"
            >
              <div class="min-w-0">
                <div class="text-sm font-medium font-mono" style="color: var(--text-primary);">
                  {t.title}
                </div>
                <div class="mt-1 text-xs" style="color: var(--text-secondary);">
                  {t.description}
                </div>
              </div>
              <label class="flex items-center gap-2 text-xs shrink-0 cursor-pointer">
                <span style="color: var(--text-tertiary);">
                  {busy ? "…" : enabled ? "on" : "off"}
                </span>
                <input
                  type="checkbox"
                  checked={enabled}
                  disabled={busy}
                  on:change={(e) => togglePerm(t.key, e.currentTarget.checked)}
                />
              </label>
            </li>
          {/each}
        </ul>
      </section>

      <div class="mt-12">
        {#if !confirmingDelete}
          <button
            type="button"
            class="px-3 py-2 rounded-md text-sm font-medium border cursor-pointer"
            style="border-color: #ef4444; color: #ef4444; background-color: transparent;"
            on:click={() => (confirmingDelete = true)}
          >
            Delete project
          </button>
        {:else}
          <div class="flex items-center gap-2">
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
