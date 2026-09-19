<script lang="ts">
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { getProject, type Project, type PublicSupabaseIntegration } from "$lib/api/projects";
  import {
    getAccountIntegrations,
    listAccountSupabaseProjects,
    type SupabaseAccountProject,
  } from "$lib/api/account";
  import SupabasePanel from "$lib/components/supabase/SupabasePanel.svelte";

  $: projectId = $page.params.projectId;

  let project: Project | null = null;
  let integration: PublicSupabaseIntegration | null = null;
  let accountProjects: SupabaseAccountProject[] | null = null;
  let loading = true;
  let error = "";

  const load = async (id: string) => {
    loading = true;
    error = "";
    accountProjects = null;
    try {
      const [p, acct] = await Promise.all([
        getProject(id),
        getAccountIntegrations().catch(() => null),
      ]);
      if (!p) {
        error = "Project not found.";
        return;
      }
      project = p;
      integration = p.integrations?.supabase ?? null;
      if (acct?.supabase) {
        try {
          accountProjects = await listAccountSupabaseProjects();
        } catch {
          accountProjects = null;
        }
      }
    } catch (e) {
      error = e instanceof Error ? e.message : "Could not load project.";
    } finally {
      loading = false;
    }
  };

  let lastLoadedId = "";
  $: if (projectId && projectId !== lastLoadedId) {
    lastLoadedId = projectId;
    load(projectId);
  }

  const onChanged = (e: CustomEvent<PublicSupabaseIntegration | null>) => {
    integration = e.detail;
  };
</script>

<div class="mx-auto max-w-2xl px-6 py-8">
  <div class="mb-4 flex items-center gap-2 text-xs" style="color: var(--text-secondary);">
    <a href="/supabase" class="hover:underline" style="color: var(--text-secondary);">Supabase</a>
    <span aria-hidden="true">/</span>
    <span style="color: var(--text-primary);">
      {project?.name ?? projectId}
    </span>
  </div>

  {#if loading}
    <div class="text-xs" style="color: var(--text-secondary);">Loading…</div>
  {:else if error}
    <div
      class="rounded-md border px-3 py-2 text-xs"
      style="border-color: #ef4444; color: #ef4444; background-color: rgba(239, 68, 68, 0.08);"
    >
      {error}
    </div>
  {:else if project}
    <div
      class="rounded-xl border shadow-sm overflow-hidden"
      style="border-color: var(--border); background-color: var(--bg-secondary);"
    >
      <SupabasePanel
        projectId={project.id}
        {integration}
        {accountProjects}
        on:changed={onChanged}
        on:close={() => goto("/supabase")}
      />
    </div>

    <div class="mt-4 flex items-center justify-between text-xs" style="color: var(--text-secondary);">
      <a href={`/projects/${project.id}/workspace`} style="color: var(--accent);">
        Open project workspace →
      </a>
    </div>
  {/if}
</div>
