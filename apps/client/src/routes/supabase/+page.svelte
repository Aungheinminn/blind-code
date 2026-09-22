<script lang="ts">
  import { onMount } from "svelte";
  import { listProjects, type Project } from "$lib/api/projects";
  import {
    getAccountIntegrations,
    listAccountSupabaseProjects,
    type PublicSupabaseAccountIntegration,
    type SupabaseAccountProject,
  } from "$lib/api/account";
  import SupabaseProjectCard from "$lib/components/supabase/SupabaseProjectCard.svelte";
  import AttachProjectModal from "$lib/components/supabase/AttachProjectModal.svelte";
  import CreateProjectModal from "$lib/components/supabase/CreateProjectModal.svelte";
  import DeleteProjectModal from "$lib/components/supabase/DeleteProjectModal.svelte";

  let account: PublicSupabaseAccountIntegration | null = null;
  let accountLoading = true;
  let supabaseProjects: SupabaseAccountProject[] = [];
  let projectsLoading = false;
  let projectsError = "";
  let bcProjects: Project[] = [];
  let attaching: SupabaseAccountProject | null = null;
  let deleting: SupabaseAccountProject | null = null;
  let creating = false;

  $: attachmentByRef = new Map<string, { id: string; name: string }>(
    bcProjects
      .filter((p) => p.integrations?.supabase?.projectRef)
      .map((p) => [
        p.integrations!.supabase!.projectRef as string,
        { id: p.id, name: p.name },
      ]),
  );

  const loadAccount = async () => {
    accountLoading = true;
    try {
      const data = await getAccountIntegrations();
      account = data?.supabase ?? null;
    } catch {
      account = null;
    } finally {
      accountLoading = false;
    }
  };

  const loadProjects = async () => {
    if (!account) {
      supabaseProjects = [];
      bcProjects = [];
      return;
    }
    projectsLoading = true;
    projectsError = "";
    try {
      const [remote, local] = await Promise.all([
        listAccountSupabaseProjects(),
        listProjects({ pageSize: 100 }),
      ]);
      supabaseProjects = remote;
      bcProjects = local.items;
    } catch (e) {
      projectsError = e instanceof Error ? e.message : "Could not load projects.";
    } finally {
      projectsLoading = false;
    }
  };

  onMount(async () => {
    await loadAccount();
    if (account) await loadProjects();
  });

  const onAttached = async (e: CustomEvent<{ bcProjectId: string }>) => {
    attaching = null;
    // Refresh so the attached badge shows up immediately.
    await loadProjects();
  };

  const onCreated = async () => {
    creating = false;
    // Refresh grid — new project appears with COMING_UP status.
    await loadProjects();
  };

  const onDeleted = async () => {
    deleting = null;
    await loadProjects();
  };
</script>

<div class="mx-auto max-w-5xl px-6 py-8">
  <div class="mb-6 flex items-start justify-between gap-4">
    <div>
      <h1 class="text-xl font-semibold">Supabase</h1>
      <p class="text-xs mt-1" style="color: var(--text-secondary);">
        {#if account}
          Your Supabase projects. Click one to attach it to a Blind Code project or manage its current attachment.
        {:else}
          Connect your Supabase account once, then attach any of your Supabase projects to a Blind Code project.
        {/if}
      </p>
    </div>
    {#if account}
      <button
        type="button"
        class="shrink-0 px-3 py-2 rounded-md text-sm font-medium text-white cursor-pointer"
        style="background-color: var(--accent);"
        on:click={() => (creating = true)}
      >
        New project
      </button>
    {/if}
  </div>

  {#if !accountLoading && !account}
    <div
      class="mb-6 rounded-xl border px-5 py-4 flex items-center justify-between gap-4"
      style="border-color: var(--border); background-color: var(--bg-secondary);"
    >
      <div class="min-w-0">
        <div class="text-sm font-medium">Supabase account not connected</div>
        <div class="text-xs mt-0.5" style="color: var(--text-secondary);">
          Connect your account in Settings to see your projects and attach them here.
        </div>
      </div>
      <a
        href="/settings/supabase"
        class="shrink-0 px-3 py-2 rounded-md text-sm font-medium text-white no-underline"
        style="background-color: var(--accent);"
      >
        Connect in Settings →
      </a>
    </div>
  {/if}

  {#if account}
    {#if projectsLoading}
      <div class="text-xs" style="color: var(--text-secondary);">Loading Supabase projects…</div>
    {:else if projectsError}
      <div
        class="rounded-md border px-3 py-2 text-xs"
        style="border-color: #ef4444; color: #ef4444; background-color: rgba(239, 68, 68, 0.08);"
      >
        {projectsError}
      </div>
    {:else if supabaseProjects.length === 0}
      <div
        class="rounded-lg border px-6 py-10 text-center text-sm"
        style="border-color: var(--border); background-color: var(--bg-secondary); color: var(--text-secondary);"
      >
        No Supabase projects yet.
        <a
          href="https://supabase.com/dashboard/new"
          target="_blank"
          rel="noopener"
          style="color: var(--accent);"
        >Create one</a>
        on Supabase, then refresh this page.
      </div>
    {:else}
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {#each supabaseProjects as sp (sp.id)}
          <SupabaseProjectCard
            supabaseProject={sp}
            attachedBcProject={attachmentByRef.get(sp.id) ?? null}
            on:attach={(e) => (attaching = e.detail)}
            on:delete={(e) => (deleting = e.detail)}
          />
        {/each}
      </div>
    {/if}
  {/if}
</div>

{#if attaching}
  <AttachProjectModal
    supabaseProject={attaching}
    bcProjects={bcProjects}
    on:close={() => (attaching = null)}
    on:attached={onAttached}
  />
{/if}

{#if creating}
  <CreateProjectModal
    existingProjectCount={supabaseProjects.length}
    on:close={() => (creating = false)}
    on:created={onCreated}
  />
{/if}

{#if deleting}
  <DeleteProjectModal
    supabaseProject={deleting}
    attachedBcProjectName={attachmentByRef.get(deleting.id)?.name ?? null}
    on:close={() => (deleting = null)}
    on:deleted={onDeleted}
  />
{/if}
