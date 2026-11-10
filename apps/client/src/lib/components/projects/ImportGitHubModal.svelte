<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";
  import { listAccountGitHubRepos, type GitHubRepoSummary } from "$lib/api/account";
  import { importProjectFromGitHub, type GitHubImportResult } from "$lib/api/projects";
  import { HttpError } from "$lib/api/http";

  const dispatch = createEventDispatcher<{ close: void; imported: GitHubImportResult }>();

  let repos: GitHubRepoSummary[] | null = null;
  let notConnected = false;
  let selectedRepo = "";
  let branch = "";
  let busy = false;
  let error = "";

  $: selected = repos?.find((r) => r.fullName === selectedRepo) ?? null;

  onMount(async () => {
    try {
      repos = await listAccountGitHubRepos();
    } catch (e) {
      repos = [];
      if (e instanceof HttpError && e.status === 400) notConnected = true;
      else error = e instanceof Error ? e.message : "Could not list repositories.";
    }
  });

  export const close = () => {
    if (!busy) dispatch("close");
  };

  const submit = async () => {
    if (!selectedRepo || busy) return;
    busy = true;
    error = "";
    try {
      const result = await importProjectFromGitHub({
        fullName: selectedRepo,
        ...(branch.trim() ? { branch: branch.trim() } : {}),
      });
      dispatch("imported", result);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      busy = false;
    }
  };
</script>

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-noninteractive-element-interactions -->
<div
  class="fixed inset-0 z-50 flex items-center justify-center px-4"
  style="background-color: rgba(0, 0, 0, 0.55);"
  on:click|self={close}
  role="dialog"
  aria-modal="true"
  aria-labelledby="import-github-title"
  tabindex="-1"
>
  <form
    on:submit|preventDefault={submit}
    class="w-full max-w-md rounded-xl border shadow-xl"
    style="border-color: var(--border); background-color: var(--bg-secondary);"
  >
    <div class="px-5 pt-5 pb-4">
      <h2 id="import-github-title" class="text-base font-semibold">Import from GitHub</h2>
      <p class="mt-1 text-xs" style="color: var(--text-secondary);">
        Creates a project from a React app with <code>src/App.tsx</code> (like a Vite project or a
        Blind Code export). The repo is linked, so you can push changes back to it.
      </p>
    </div>

    <div class="px-5 pb-4 space-y-4">
      {#if notConnected}
        <p class="text-sm" style="color: var(--text-secondary);">
          Connect your GitHub account first.
        </p>
        <a
          href="/settings/github"
          class="block w-full text-center rounded-md px-3 py-2 text-sm font-medium"
          style="background-color: var(--accent); color: #fff;"
        >
          Connect GitHub
        </a>
      {:else}
        <label class="block text-xs font-medium" style="color: var(--text-secondary);">
          Repository
          <select
            bind:value={selectedRepo}
            disabled={repos === null || busy}
            class="mt-1 w-full text-sm px-3 py-2 rounded-md border outline-none"
            style="border-color: var(--border); color: var(--text-primary); background-color: var(--bg-panel);"
          >
            <option value="" disabled>
              {repos === null ? "Loading…" : repos.length ? "Select a repository" : "No repositories found"}
            </option>
            {#each repos ?? [] as r (r.id)}
              <option value={r.fullName}>{r.fullName}{r.private ? " 🔒" : ""}</option>
            {/each}
          </select>
        </label>

        <label class="block text-xs font-medium" style="color: var(--text-secondary);">
          Branch
          <input
            type="text"
            bind:value={branch}
            placeholder={selected?.defaultBranch ?? "main"}
            disabled={busy}
            class="mt-1 w-full text-sm px-3 py-2 rounded-md border bg-transparent outline-none"
            style="border-color: var(--border); color: var(--text-primary); background-color: var(--bg-panel);"
          />
        </label>
      {/if}

      {#if error}
        <div
          class="rounded-md border px-3 py-2 text-xs"
          style="border-color: #ef4444; color: #ef4444; background-color: rgba(239, 68, 68, 0.08);"
        >
          {error}
        </div>
      {/if}
    </div>

    <div class="px-5 pb-5 flex items-center justify-end gap-2">
      <button
        type="button"
        class="px-3 py-2 rounded-md text-sm font-medium border cursor-pointer disabled:opacity-50"
        style="border-color: var(--border); color: var(--text-secondary); background-color: var(--bg-panel);"
        disabled={busy}
        on:click={close}
      >
        Cancel
      </button>
      {#if !notConnected}
        <button
          type="submit"
          disabled={!selectedRepo || busy}
          class="px-3 py-2 rounded-md text-sm font-medium text-white cursor-pointer disabled:opacity-50"
          style="background-color: var(--accent);"
        >
          {busy ? "Importing…" : "Import"}
        </button>
      {/if}
    </div>
  </form>
</div>
