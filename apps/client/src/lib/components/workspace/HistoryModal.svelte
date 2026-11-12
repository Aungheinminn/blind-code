<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";
  import {
    getProjectCheckpointFiles,
    listProjectCheckpoints,
    type CheckpointSummary,
  } from "$lib/api/projects";
  import { diffFileSets, diffLines, toHunks, type FileChange } from "$lib/diff";
  import closeXIcon from "$lib/assets/icons/close-x.svg?raw";
  import restoreIcon from "$lib/assets/icons/restore.svg?raw";

  export let projectId: string;
  export let currentFiles: Record<string, string> = {};
  export let isRunning = false;

  const dispatch = createEventDispatcher<{ close: void; restore: string }>();

  let versions: CheckpointSummary[] | null = null;
  let error = "";
  let selectedId: string | null = null;
  let selectedFiles: Record<string, string> | null = null;
  let filesError = "";
  let selectedPath: string | null = null;
  let confirming = false;
  const filesCache = new Map<string, Record<string, string>>();

  onMount(async () => {
    try {
      versions = await listProjectCheckpoints(projectId);
      if (versions.length > 0) select(versions[0].id);
    } catch (e) {
      versions = [];
      error = e instanceof Error ? e.message : "Couldn't load version history.";
    }
  });

  const select = async (id: string) => {
    selectedId = id;
    selectedPath = null;
    confirming = false;
    filesError = "";
    const cached = filesCache.get(id);
    if (cached) {
      selectedFiles = cached;
      return;
    }
    selectedFiles = null;
    try {
      const files = await getProjectCheckpointFiles(projectId, id);
      filesCache.set(id, files);
      if (selectedId === id) selectedFiles = files;
    } catch (e) {
      if (selectedId === id) filesError = e instanceof Error ? e.message : "Couldn't load this version.";
    }
  };

  $: selected = versions?.find((v) => v.id === selectedId) ?? null;
  $: changes = selectedFiles ? diffFileSets(selectedFiles, currentFiles) : [];
  $: if (selectedPath === null && changes.length > 0) selectedPath = changes[0].path;
  $: selectedChange = changes.find((c) => c.path === selectedPath) ?? null;
  $: hunks =
    selectedFiles && selectedChange
      ? (() => {
          const lines = diffLines(selectedFiles[selectedChange.path] ?? "", currentFiles[selectedChange.path] ?? "");
          return lines ? toHunks(lines) : null;
        })()
      : [];

  const formatWhen = (iso: string) => {
    const d = new Date(iso);
    const s = Math.max(1, Math.round((Date.now() - d.getTime()) / 1000));
    if (s < 60) return "just now";
    const m = Math.round(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h}h ago`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  const statusLabel: Record<FileChange["status"], string> = {
    added: "new",
    removed: "deleted",
    changed: "edited",
  };

  const restore = () => {
    if (!selectedId || isRunning) return;
    dispatch("restore", selectedId);
    dispatch("close");
  };

  const onKeydown = (e: KeyboardEvent) => {
    if (e.key === "Escape") dispatch("close");
  };
</script>

<svelte:window on:keydown={onKeydown} />

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-noninteractive-element-interactions -->
<div
  class="fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
  style="background-color: rgba(0, 0, 0, 0.55);"
  on:click|self={() => dispatch("close")}
  role="dialog"
  aria-modal="true"
  aria-labelledby="history-modal-title"
  tabindex="-1"
>
  <div
    class="w-full max-w-5xl h-full max-h-[720px] rounded-xl border shadow-xl flex flex-col overflow-hidden"
    style="border-color: var(--border); background-color: var(--bg-secondary);"
  >
    <div class="flex items-center justify-between gap-3 px-5 py-4 border-b" style="border-color: var(--border);">
      <div class="min-w-0">
        <h2 id="history-modal-title" class="text-base font-semibold" style="color: var(--text-primary);">
          Version history
        </h2>
        <p class="mt-0.5 text-xs" style="color: var(--text-tertiary);">
          A version is saved before each prompt. Pick one to see what's changed since, or restore it.
        </p>
      </div>
      <button type="button" class="close-btn" aria-label="Close" title="Close" on:click={() => dispatch("close")}>
        <span class="icon-14" aria-hidden="true">{@html closeXIcon}</span>
      </button>
    </div>

    {#if versions === null}
      <div class="flex-1 grid place-items-center text-sm" style="color: var(--text-secondary);">Loading…</div>
    {:else if error}
      <div class="flex-1 grid place-items-center text-sm" style="color: #ef4444;">{error}</div>
    {:else if versions.length === 0}
      <div class="flex-1 grid place-items-center text-sm px-6 text-center" style="color: var(--text-secondary);">
        No versions yet. One is saved each time you send the agent a prompt.
      </div>
    {:else}
      <div class="flex-1 min-h-0 flex flex-col md:flex-row">
        <ul class="version-list md:w-72 shrink-0 overflow-y-auto border-b md:border-b-0 md:border-r" style="border-color: var(--border);">
          {#each versions as v, i (v.id)}
            <li>
              <button
                type="button"
                class="version-row"
                class:active={v.id === selectedId}
                on:click={() => select(v.id)}
              >
                <span class="block text-[13px] truncate" style="color: var(--text-primary);">
                  {v.prompt ?? "Retried prompt"}
                </span>
                <span class="block mt-0.5 text-[11.5px]" style="color: var(--text-tertiary);">
                  {i === 0 ? "Before latest prompt" : "Before this prompt"} · {formatWhen(v.createdAt)} · {v.fileCount}
                  {v.fileCount === 1 ? "file" : "files"}
                </span>
              </button>
            </li>
          {/each}
        </ul>

        <div class="flex-1 min-w-0 min-h-0 flex flex-col">
          {#if selected}
            <div class="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b" style="border-color: var(--border);">
              <p class="text-[12.5px] min-w-0" style="color: var(--text-secondary);">
                {#if !selectedFiles}
                  {filesError || "Loading…"}
                {:else if changes.length === 0}
                  The project is the same as this version.
                {:else}
                  {changes.length} {changes.length === 1 ? "file has" : "files have"} changed since this version.
                {/if}
              </p>
              {#if selectedFiles && changes.length > 0}
                {#if confirming}
                  <div class="flex items-center gap-2 text-[12px]" style="color: var(--text-secondary);">
                    <span>Replace the current files with this version?</span>
                    <button type="button" class="btn btn-primary" on:click={restore} disabled={isRunning}>Restore</button>
                    <button type="button" class="btn" on:click={() => (confirming = false)}>Cancel</button>
                  </div>
                {:else}
                  <button
                    type="button"
                    class="btn flex items-center gap-1.5"
                    on:click={() => (confirming = true)}
                    disabled={isRunning}
                    title={isRunning ? "Wait for the agent to finish" : "Restore this version"}
                  >
                    <span class="icon-13" aria-hidden="true">{@html restoreIcon}</span>
                    Restore this version
                  </button>
                {/if}
              {/if}
            </div>

            {#if selectedFiles && changes.length > 0}
              <div class="flex-1 min-h-0 flex flex-col lg:flex-row">
                <ul class="lg:w-64 shrink-0 overflow-y-auto max-h-40 lg:max-h-none border-b lg:border-b-0 lg:border-r py-1" style="border-color: var(--border);">
                  {#each changes as c (c.path)}
                    <li>
                      <button
                        type="button"
                        class="file-row"
                        class:active={c.path === selectedPath}
                        on:click={() => (selectedPath = c.path)}
                      >
                        <span class="truncate font-mono text-[12px]">{c.path}</span>
                        <span class="shrink-0 text-[11px] tabular-nums">
                          <span class="status status-{c.status}">{statusLabel[c.status]}</span>
                          {#if c.added}<span class="add-count">+{c.added}</span>{/if}
                          {#if c.removed}<span class="del-count">−{c.removed}</span>{/if}
                        </span>
                      </button>
                    </li>
                  {/each}
                </ul>

                <div class="flex-1 min-w-0 overflow-auto diff-view">
                  {#if hunks === null}
                    <p class="p-4 text-[12.5px]" style="color: var(--text-secondary);">
                      This file changed too much to show line by line.
                    </p>
                  {:else}
                    {#each hunks as hunk}
                      {#if hunk.skippedBefore > 0}
                        <div class="skip">⋯ {hunk.skippedBefore} unchanged {hunk.skippedBefore === 1 ? "line" : "lines"}</div>
                      {/if}
                      {#each hunk.lines as line}
                        <div class="line line-{line.kind}"><span class="sign">{line.kind === "add" ? "+" : line.kind === "del" ? "−" : " "}</span>{line.text}</div>
                      {/each}
                    {/each}
                  {/if}
                </div>
              </div>
            {/if}
          {/if}
        </div>
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
  }
  .close-btn:hover {
    background: var(--chrome-hover);
    color: var(--text-primary);
  }
  .icon-14 { display: inline-flex; width: 14px; height: 14px; }
  .icon-13 { display: inline-flex; width: 13px; height: 13px; }
  .version-row,
  .file-row {
    width: 100%;
    text-align: left;
    background: transparent;
    border: 0;
    cursor: pointer;
    color: var(--text-secondary);
  }
  .version-row {
    display: block;
    padding: 10px 16px;
    border-bottom: 1px solid var(--border);
  }
  .file-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 6px 12px;
  }
  .version-row:hover,
  .file-row:hover {
    background: var(--chrome-hover);
  }
  .version-row.active,
  .file-row.active {
    background: color-mix(in srgb, var(--accent) 12%, transparent);
    color: var(--text-primary);
  }
  .status { color: var(--text-tertiary); margin-right: 6px; }
  .status-added { color: #22c55e; }
  .status-removed { color: #ef4444; }
  .add-count { color: #22c55e; margin-right: 4px; }
  .del-count { color: #ef4444; }
  .btn {
    font-size: 12px;
    padding: 5px 10px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--bg-panel);
    color: var(--text-primary);
    cursor: pointer;
  }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-primary { background: var(--accent); border-color: var(--accent); color: #fff; }
  .diff-view {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12px;
    line-height: 1.55;
    padding: 6px 0;
  }
  .line {
    white-space: pre;
    padding: 0 14px 0 0;
    color: var(--text-secondary);
  }
  .sign {
    display: inline-block;
    width: 22px;
    text-align: center;
    user-select: none;
  }
  .line-add { background: color-mix(in srgb, #22c55e 13%, transparent); color: var(--text-primary); }
  .line-del { background: color-mix(in srgb, #ef4444 13%, transparent); color: var(--text-primary); }
  .skip {
    padding: 2px 22px;
    color: var(--text-tertiary);
    background: var(--bg-primary);
    font-size: 11px;
  }
</style>
