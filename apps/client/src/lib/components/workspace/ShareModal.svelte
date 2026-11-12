<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount } from "svelte";
  import { disableProjectShare, enableProjectShare, getProject } from "$lib/api/projects";
  import closeXIcon from "$lib/assets/icons/close-x.svg?raw";
  import linkIcon from "$lib/assets/icons/link.svg?raw";

  export let projectId: string;

  const dispatch = createEventDispatcher<{ close: void }>();

  let shareToken: string | null = null;
  let loading = true;
  let busy = false;
  let error = "";
  let copied = false;
  let copyTimer: ReturnType<typeof setTimeout> | undefined;

  $: shareUrl = shareToken ? `${window.location.origin}/share/${shareToken}` : "";

  onMount(async () => {
    try {
      const project = await getProject(projectId);
      shareToken = project?.shareToken ?? null;
    } catch (e) {
      error = e instanceof Error ? e.message : "Couldn't load sharing settings.";
    } finally {
      loading = false;
    }
  });

  onDestroy(() => clearTimeout(copyTimer));

  const run = async (fn: () => Promise<{ shareToken: string | null }>) => {
    busy = true;
    error = "";
    try {
      shareToken = (await fn()).shareToken;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      copied = true;
      clearTimeout(copyTimer);
      copyTimer = setTimeout(() => (copied = false), 1500);
    } catch {
      error = "Couldn't copy. Select the link and copy it instead.";
    }
  };

  const close = () => {
    if (!busy) dispatch("close");
  };
</script>

<svelte:window on:keydown={(e) => e.key === "Escape" && close()} />

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-noninteractive-element-interactions -->
<div
  class="fixed inset-0 z-50 flex items-center justify-center px-4"
  style="background-color: rgba(0, 0, 0, 0.55);"
  on:click|self={close}
  role="dialog"
  aria-modal="true"
  aria-labelledby="share-modal-title"
  tabindex="-1"
>
  <div
    class="w-full max-w-md rounded-xl border shadow-xl p-6"
    style="border-color: var(--border); background-color: var(--bg-secondary);"
  >
    <div class="flex items-start justify-between gap-3">
      <div class="flex items-start gap-2.5">
        <span class="icon-18 mt-0.5" aria-hidden="true">{@html linkIcon}</span>
        <div>
          <h2 id="share-modal-title" class="text-base font-semibold" style="color: var(--text-primary);">
            Share a preview
          </h2>
          <p class="mt-0.5 text-xs" style="color: var(--text-tertiary);">
            Anyone with the link can use the app and see its source files. They can't see the
            chat, change anything, or use your account.
          </p>
        </div>
      </div>
      <button type="button" class="close-btn" aria-label="Close" title="Close" on:click={close} disabled={busy}>
        <span class="icon-14" aria-hidden="true">{@html closeXIcon}</span>
      </button>
    </div>

    <div class="mt-5 space-y-3">
      {#if loading}
        <p class="text-sm" style="color: var(--text-secondary);">Loading…</p>
      {:else if shareToken}
        <div class="flex items-center gap-2">
          <input class="field flex-1" readonly value={shareUrl} on:focus={(e) => e.currentTarget.select()} />
          <button type="button" class="btn btn-primary" on:click={copy}>{copied ? "Copied" : "Copy"}</button>
        </div>
        <div class="flex items-center justify-between gap-3">
          <a href={shareUrl} target="_blank" rel="noopener" class="text-xs" style="color: var(--text-secondary);">
            Open link
          </a>
          <button
            type="button"
            class="btn"
            on:click={() => run(() => disableProjectShare(projectId))}
            disabled={busy}
          >
            {busy ? "Turning off…" : "Turn off link"}
          </button>
        </div>
        <p class="text-xs" style="color: var(--text-tertiary);">
          The link always shows the latest version. Turning it off breaks the link, and turning it
          back on gives you a new one.
        </p>
      {:else}
        <button
          type="button"
          class="btn btn-primary w-full"
          on:click={() => run(() => enableProjectShare(projectId))}
          disabled={busy}
        >
          {busy ? "Creating link…" : "Create share link"}
        </button>
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
  .close-btn:hover:not(:disabled) {
    background: var(--chrome-hover);
    color: var(--text-primary);
  }
  .icon-14 { display: inline-flex; width: 14px; height: 14px; }
  .icon-18 { display: inline-flex; width: 18px; height: 18px; color: var(--text-secondary); }
  .field {
    font-size: 13px;
    padding: 6px 10px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background-color: var(--bg-panel);
    color: var(--text-primary);
    outline: none;
    min-width: 0;
  }
  .btn {
    font-size: 13px;
    padding: 6px 12px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--bg-panel);
    color: var(--text-primary);
    cursor: pointer;
  }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-primary { background: var(--accent); border-color: var(--accent); color: #fff; }
</style>
