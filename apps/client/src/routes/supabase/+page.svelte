<script lang="ts">
  import { onMount } from "svelte";
  import { listProjects, type Project } from "$lib/api/projects";

  let items: Project[] = [];
  let loading = true;
  let error = "";

  const load = async () => {
    loading = true;
    error = "";
    try {
      const page = await listProjects({ pageSize: 100 });
      items = page.items;
    } catch (e) {
      error = e instanceof Error ? e.message : "Could not load projects.";
    } finally {
      loading = false;
    }
  };

  onMount(load);

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString();
    } catch {
      return iso;
    }
  };
</script>

<div class="mx-auto max-w-5xl px-6 py-8">
  <div class="flex items-center justify-between mb-6">
    <div>
      <h1 class="text-xl font-semibold">Supabase</h1>
      <p class="text-xs mt-1" style="color: var(--text-secondary);">
        One Supabase connection per project. Click a project to connect, view, or update its integration.
      </p>
    </div>
  </div>

  {#if loading}
    <div class="text-xs" style="color: var(--text-secondary);">Loading projects…</div>
  {:else if error}
    <div
      class="rounded-md border px-3 py-2 text-xs"
      style="border-color: #ef4444; color: #ef4444; background-color: rgba(239, 68, 68, 0.08);"
    >
      {error}
    </div>
  {:else if items.length === 0}
    <div
      class="rounded-lg border px-6 py-10 text-center text-sm"
      style="border-color: var(--border); background-color: var(--bg-secondary); color: var(--text-secondary);"
    >
      No projects yet. <a href="/projects" style="color: var(--accent);">Create one</a> to add a Supabase integration.
    </div>
  {:else}
    <ul
      class="rounded-lg border divide-y overflow-hidden"
      style="border-color: var(--border); background-color: var(--bg-secondary);"
    >
      {#each items as project}
        {@const supa = project.integrations?.supabase ?? null}
        <li>
          <a
            href={`/supabase/${project.id}`}
            class="flex items-center gap-4 px-4 py-3 no-underline hover:opacity-90"
            style="color: var(--text-primary); background-color: transparent;"
          >
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium truncate">{project.name}</div>
              {#if supa}
                <div class="text-xs mt-0.5 font-mono truncate" style="color: var(--text-secondary);">
                  {supa.url}
                </div>
              {:else if project.description}
                <div class="text-xs mt-0.5 truncate" style="color: var(--text-secondary);">
                  {project.description}
                </div>
              {/if}
            </div>

            {#if supa}
              <div class="flex flex-col items-end gap-1 shrink-0 text-[11px]" style="color: var(--text-secondary);">
                <span class="status-badge connected">
                  <span class="dot"></span>
                  Connected
                </span>
                <span>{formatDate(supa.connectedAt)}</span>
              </div>
            {:else}
              <span class="status-badge not-connected shrink-0">Not connected</span>
            {/if}

            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="shrink-0 opacity-60"
              aria-hidden="true"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 8px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 500;
    border: 1px solid var(--border);
    background-color: var(--bg-panel);
  }
  .status-badge.connected {
    color: #16a34a;
    border-color: rgba(34, 197, 94, 0.35);
    background-color: rgba(34, 197, 94, 0.08);
  }
  .status-badge.connected .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: #22c55e;
  }
  .status-badge.not-connected {
    color: var(--text-secondary);
  }
</style>
