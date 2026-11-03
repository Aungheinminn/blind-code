<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";
  import {
    getGitHubStatus,
    linkGitHubRepo,
    pushToGitHub,
    unlinkGitHubRepo,
    type GitHubPushResult,
    type PublicGitHubIntegration,
  } from "$lib/api/projects";
  import { listAccountGitHubRepos, type GitHubRepoSummary } from "$lib/api/account";
  import { HttpError } from "$lib/api/http";
  import closeXIcon from "$lib/assets/icons/close-x.svg?raw";
  import githubIcon from "$lib/assets/icons/github.svg?raw";

  export let projectId: string;
  export let projectName = "";
  export let github: PublicGitHubIntegration | null = null;

  const dispatch = createEventDispatcher<{
    close: void;
    changed: PublicGitHubIntegration | null;
  }>();

  type View = "loading" | "not-connected" | "setup" | "linked";

  let view: View = "loading";
  let busy = false;
  let error = "";
  let hasLocalChanges = false;
  let diverged = false;

  let setupMode: "create" | "link" = "create";
  let repoName = "";
  let repoPrivate = true;
  let repos: GitHubRepoSummary[] | null = null;
  let reposLoading = false;
  let selectedRepo = "";
  let linkBranch = "";

  let commitMessage = "";
  let newBranchName = "blind-code";
  let lastResult: GitHubPushResult | null = null;

  const slugify = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 100);

  const apply = (next: PublicGitHubIntegration | null) => {
    github = next;
    dispatch("changed", next);
  };

  const errorMessage = (e: unknown, fallback: string) =>
    e instanceof Error ? e.message : fallback;

  const loadStatus = async () => {
    try {
      const status = await getGitHubStatus(projectId);
      apply(status.integration);
      hasLocalChanges = status.hasLocalChanges;
      diverged = Boolean(status.remote?.diverged);
      if (status.remoteError) error = status.remoteError;
      if (!status.accountConnected) view = "not-connected";
      else view = status.integration ? "linked" : "setup";
    } catch (e) {
      error = errorMessage(e, "Could not load GitHub status.");
      view = github ? "linked" : "setup";
    }
  };

  onMount(() => {
    repoName = slugify(projectName) || "blind-code-app";
    loadStatus();
  });

  const loadRepos = async () => {
    if (repos || reposLoading) return;
    reposLoading = true;
    try {
      repos = await listAccountGitHubRepos();
    } catch (e) {
      error = errorMessage(e, "Could not list repositories.");
      repos = [];
    } finally {
      reposLoading = false;
    }
  };

  $: if (view === "setup" && setupMode === "link") loadRepos();

  const onSetup = async () => {
    busy = true;
    error = "";
    try {
      const project =
        setupMode === "create"
          ? await linkGitHubRepo(projectId, {
              mode: "create",
              name: repoName.trim(),
              private: repoPrivate,
            })
          : await linkGitHubRepo(projectId, {
              mode: "link",
              fullName: selectedRepo,
              branch: linkBranch.trim() || undefined,
            });
      apply(project?.integrations?.github ?? null);
      view = "linked";
      await loadStatus();
    } catch (e) {
      error = errorMessage(e, "Could not set up the repository.");
    } finally {
      busy = false;
    }
  };

  const onPush = async (opts: { force?: boolean; newBranch?: string } = {}) => {
    busy = true;
    error = "";
    lastResult = null;
    try {
      const result = await pushToGitHub(projectId, {
        message: commitMessage.trim() || undefined,
        ...opts,
      });
      lastResult = result;
      apply(result.integration);
      hasLocalChanges = false;
      diverged = false;
      commitMessage = "";
    } catch (e) {
      if (e instanceof HttpError && e.code === "diverged") diverged = true;
      error = errorMessage(e, "Push failed.");
    } finally {
      busy = false;
    }
  };

  const onUnlink = async () => {
    busy = true;
    error = "";
    try {
      await unlinkGitHubRepo(projectId);
      apply(null);
      lastResult = null;
      diverged = false;
      view = "setup";
    } catch (e) {
      error = errorMessage(e, "Could not unlink.");
    } finally {
      busy = false;
    }
  };

  const formatRelative = (iso?: string): string => {
    if (!iso) return "";
    const diffMs = Date.now() - new Date(iso).getTime();
    const s = Math.max(1, Math.round(diffMs / 1000));
    if (s < 60) return `${s}s ago`;
    const m = Math.round(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.round(h / 24)}d ago`;
  };

  const onBackdropClick = () => {
    if (busy) return;
    dispatch("close");
  };
</script>

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-noninteractive-element-interactions -->
<div
  class="fixed inset-0 z-50 flex items-center justify-center px-4"
  style="background-color: rgba(0, 0, 0, 0.55);"
  on:click|self={onBackdropClick}
  role="dialog"
  aria-modal="true"
  aria-labelledby="github-modal-title"
  tabindex="-1"
>
  <div
    class="w-full max-w-md rounded-xl border shadow-xl p-6"
    style="border-color: var(--border); background-color: var(--bg-secondary);"
  >
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0 flex items-start gap-2.5">
        <span class="icon-18 mt-0.5" aria-hidden="true">{@html githubIcon}</span>
        <div class="min-w-0">
          <h2
            id="github-modal-title"
            class="text-base font-semibold"
            style="color: var(--text-primary);"
          >
            Push to GitHub
          </h2>
          {#if view === "linked" && github}
            <p class="mt-0.5 text-xs truncate" style="color: var(--text-tertiary);">
              <a
                href={`${github.htmlUrl}/tree/${github.branch}`}
                target="_blank"
                rel="noopener noreferrer"
                style="color: var(--text-secondary);"
              >{github.owner}/{github.repo}</a>
              · {github.branch}
              {#if github.lastPushedAt}
                · pushed {formatRelative(github.lastPushedAt)}
              {/if}
            </p>
          {/if}
        </div>
      </div>
      <button
        type="button"
        class="close-btn"
        aria-label="Close"
        title="Close"
        on:click={() => dispatch("close")}
        disabled={busy}
      >
        <span class="icon-14" aria-hidden="true">{@html closeXIcon}</span>
      </button>
    </div>

    {#if error}
      <div
        class="mt-4 rounded-lg border px-3 py-2 text-sm"
        style="border-color: #ef4444; color: #ef4444; background-color: rgba(239,68,68,0.08);"
      >
        {error}
      </div>
    {/if}

    {#if view === "loading"}
      <div class="mt-6 flex flex-col items-center gap-3 py-6">
        <div class="spinner" aria-hidden="true"></div>
        <p class="text-sm" style="color: var(--text-secondary);">Checking GitHub…</p>
      </div>
    {:else if view === "not-connected"}
      <div class="mt-5 space-y-4">
        <p class="text-sm" style="color: var(--text-secondary);">
          Connect your GitHub account to push this project to a repository.
        </p>
        <a
          href="/settings/github"
          class="block w-full text-center rounded-md px-3 py-2 text-sm font-medium"
          style="background-color: var(--accent); color: #fff;"
        >
          Connect GitHub
        </a>
      </div>
    {:else if view === "setup"}
      <div class="mt-5 space-y-4">
        <div class="segmented" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={setupMode === "create"}
            class:active={setupMode === "create"}
            on:click={() => (setupMode = "create")}
          >New repository</button>
          <button
            type="button"
            role="tab"
            aria-selected={setupMode === "link"}
            class:active={setupMode === "link"}
            on:click={() => (setupMode = "link")}
          >Existing repository</button>
        </div>

        {#if setupMode === "create"}
          <label class="block">
            <span class="text-xs" style="color: var(--text-tertiary);">Repository name</span>
            <input
              class="field mt-1"
              bind:value={repoName}
              placeholder="my-app"
              maxlength="100"
            />
          </label>
          <label class="flex items-center gap-2 text-sm" style="color: var(--text-secondary);">
            <input type="checkbox" bind:checked={repoPrivate} />
            Private repository
          </label>
        {:else}
          <label class="block">
            <span class="text-xs" style="color: var(--text-tertiary);">Repository</span>
            <select class="field mt-1" bind:value={selectedRepo} disabled={reposLoading}>
              <option value="" disabled>
                {reposLoading ? "Loading…" : "Select a repository"}
              </option>
              {#each repos ?? [] as r (r.id)}
                <option value={r.fullName}>{r.fullName}{r.private ? " 🔒" : ""}</option>
              {/each}
            </select>
          </label>
          <label class="block">
            <span class="text-xs" style="color: var(--text-tertiary);">
              Branch (defaults to the repo's default branch)
            </span>
            <input class="field mt-1" bind:value={linkBranch} placeholder="main" />
          </label>
          <p class="text-xs" style="color: var(--text-tertiary);">
            If the repo already has files, you'll be asked before anything on it is replaced.
          </p>
        {/if}

        <button
          type="button"
          on:click={onSetup}
          class="w-full rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50"
          style="background-color: var(--accent); color: #fff;"
          disabled={busy ||
            (setupMode === "create" ? !repoName.trim() : !selectedRepo)}
        >
          {#if busy}
            Working…
          {:else}
            {setupMode === "create" ? "Create repository" : "Link repository"}
          {/if}
        </button>
      </div>
    {:else if github}
      <div class="mt-5 space-y-4">
        {#if lastResult}
          <div
            class="rounded-lg border px-3 py-2 text-sm"
            style="border-color: var(--border); background-color: var(--bg-primary); color: var(--text-primary);"
          >
            {#if lastResult.status === "noop"}
              Already up to date.
            {:else}
              Pushed
              <a
                href={lastResult.commitUrl}
                target="_blank"
                rel="noopener noreferrer"
                class="font-mono"
                style="color: var(--accent);"
              >{lastResult.commitSha.slice(0, 7)}</a>
              to {lastResult.branch}.
            {/if}
          </div>
        {:else if !diverged}
          <p class="text-sm" style="color: var(--text-secondary);">
            {#if !github.lastPushedAt}
              Nothing pushed yet.
            {:else if hasLocalChanges}
              You have changes that aren't on GitHub yet.
            {:else}
              Up to date with GitHub.
            {/if}
          </p>
        {/if}

        {#if diverged}
          <div
            class="rounded-lg border px-3 py-2 text-xs space-y-2"
            style="border-color: #f59e0b; color: var(--text-secondary); background-color: rgba(245,158,11,0.08);"
          >
            <p>
              <b style="color: var(--text-primary);">{github.branch}</b> has changes that
              didn't come from Blind Code. Push to a new branch, or replace the files on
              {github.branch} (its history is kept).
            </p>
            <div class="flex gap-2">
              <input
                class="field flex-1"
                bind:value={newBranchName}
                placeholder="blind-code"
                aria-label="New branch name"
              />
              <button
                type="button"
                class="rounded-md border px-3 py-1.5 text-xs whitespace-nowrap disabled:opacity-50"
                style="border-color: var(--border); color: var(--text-primary);"
                disabled={busy || !newBranchName.trim()}
                on:click={() => onPush({ newBranch: newBranchName.trim() })}
              >
                Push to new branch
              </button>
            </div>
            <button
              type="button"
              class="w-full rounded-md border px-3 py-1.5 text-xs disabled:opacity-50"
              style="border-color: #f59e0b; color: #b45309;"
              disabled={busy}
              on:click={() => onPush({ force: true })}
            >
              Replace files on {github.branch}
            </button>
          </div>
        {/if}

        <label class="block">
          <span class="text-xs" style="color: var(--text-tertiary);">Commit message</span>
          <input
            class="field mt-1"
            bind:value={commitMessage}
            placeholder="Update from Blind Code"
            maxlength="200"
          />
        </label>

        <div class="flex gap-2">
          <button
            type="button"
            on:click={() => onPush()}
            class="flex-1 rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50"
            style="background-color: var(--accent); color: #fff;"
            disabled={busy || diverged}
          >
            {busy ? "Pushing…" : "Push"}
          </button>
          <a
            href={github.htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            class="rounded-md border px-3 py-2 text-sm"
            style="border-color: var(--border); color: var(--text-primary);"
          >
            Open repo
          </a>
        </div>

        <button
          type="button"
          class="text-xs underline disabled:opacity-50"
          style="color: var(--text-tertiary);"
          disabled={busy}
          on:click={onUnlink}
        >
          Unlink repository
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  .close-btn {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--text-tertiary);
    background: transparent;
    border: none;
    cursor: pointer;
    transition: background 150ms ease, color 150ms ease;
  }
  .close-btn:hover:not(:disabled) {
    background: var(--chrome-hover);
    color: var(--text-primary);
  }
  .close-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .field {
    width: 100%;
    font-size: 13px;
    padding: 6px 10px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background-color: var(--bg-panel);
    color: var(--text-primary);
    outline: none;
  }
  .segmented {
    display: flex;
    gap: 2px;
    padding: 2px;
    border-radius: 8px;
    background: var(--bg-primary);
    border: 1px solid var(--border);
  }
  .segmented button {
    flex: 1;
    padding: 5px 8px;
    border-radius: 6px;
    font-size: 12px;
    color: var(--text-secondary);
    background: transparent;
    border: none;
    cursor: pointer;
  }
  .segmented button.active {
    background: var(--bg-secondary);
    color: var(--text-primary);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
  }
  .spinner {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 2px solid var(--border);
    border-top-color: var(--accent);
    animation: spin 0.9s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  .icon-14 {
    display: inline-flex;
    width: 14px;
    height: 14px;
  }
  .icon-18 {
    display: inline-flex;
    width: 18px;
    height: 18px;
    color: var(--text-primary);
  }
</style>
