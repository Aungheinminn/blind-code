<script lang="ts">
  import { onMount } from "svelte";
  import {
    listDesignTemplates,
    deleteDesignTemplate,
    type DesignTemplateSummary,
  } from "$lib/api/projects";
  import DesignTemplateCard from "$lib/components/design-studio/DesignTemplateCard.svelte";

  let templates: DesignTemplateSummary[] = [];
  let loading = true;
  let error = "";

  let deleteTarget: DesignTemplateSummary | null = null;
  let deleteBusy = false;
  let deleteError = "";

  const SWATCH_ORDER = [
    "primary",
    "secondary",
    "tertiary",
    "surface",
    "on-surface",
    "error",
  ] as const;

  const swatchesFor = (t: DesignTemplateSummary): { name: string; value: string }[] => {
    const colors = t.parsedTokens?.colors ?? {};
    const picked: { name: string; value: string }[] = [];
    for (const key of SWATCH_ORDER) {
      const v = colors[key];
      if (typeof v === "string") picked.push({ name: key, value: v });
    }
    return picked;
  };

  const loadTemplates = async () => {
    loading = true;
    error = "";
    try {
      const res = await listDesignTemplates();
      templates = res ?? [];
    } catch (e) {
      error = e instanceof Error ? e.message : "failed to load design templates";
    } finally {
      loading = false;
    }
  };

  const openDelete = (t: DesignTemplateSummary) => {
    deleteTarget = t;
    deleteError = "";
  };

  const closeDelete = () => {
    if (deleteBusy) return;
    deleteTarget = null;
    deleteError = "";
  };

  const submitDelete = async () => {
    if (!deleteTarget || deleteBusy) return;
    deleteBusy = true;
    deleteError = "";
    try {
      await deleteDesignTemplate(deleteTarget.id);
      const removedId = deleteTarget.id;
      deleteTarget = null;
      templates = templates.filter((t) => t.id !== removedId);
    } catch (e) {
      deleteError = e instanceof Error ? e.message : String(e);
    } finally {
      deleteBusy = false;
    }
  };

  const onEdit = (_t: DesignTemplateSummary) => {
    // TODO: wire edit flow — for now this button is a stub.
  };

  const onKeydown = (e: KeyboardEvent) => {
    if (e.key === "Escape") closeDelete();
  };

  onMount(loadTemplates);
</script>

<svelte:head>
  <title>Design — Blind Code</title>
</svelte:head>

<svelte:window on:keydown={onKeydown} />

<section class="page w-full max-w-[900px] mx-auto px-6 pt-14 pb-20">
  <header class="header">
    <div class="header-top">
      <h1>Design templates</h1>
      <a href="/design/new" class="new-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        <span>Create new</span>
      </a>
    </div>
    <p>
      Every project renders with a design template — a
      <a href="https://github.com/google-labs-code/design.md" target="_blank" rel="noreferrer">
        DESIGN.md
      </a>
      file that defines colors, typography, spacing, and component style.
      Three built-ins ship today.
    </p>
  </header>

  {#if loading}
    <p class="status">Loading…</p>
  {:else if error}
    <p class="status status-error">{error}</p>
  {:else if templates.length === 0}
    <p class="status">No templates found. Run <code>bun run db:seed:templates</code>.</p>
  {:else}
    <div class="grid">
      {#each templates as tpl (tpl.id)}
        <DesignTemplateCard
          template={tpl}
          swatches={swatchesFor(tpl)}
          on:edit={(e) => onEdit(e.detail)}
          on:delete={(e) => openDelete(e.detail)}
        />
      {/each}
    </div>
  {/if}
</section>

{#if deleteTarget}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-noninteractive-element-interactions -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center px-4"
    style="background-color: rgba(0, 0, 0, 0.55);"
    on:click|self={closeDelete}
    role="dialog"
    aria-modal="true"
    aria-labelledby="delete-template-title"
    tabindex="-1"
  >
    <div
      class="w-full max-w-md rounded-xl border shadow-xl"
      style="border-color: var(--border); background-color: var(--bg-secondary);"
    >
      <div class="px-5 pt-5 pb-4">
        <h2 id="delete-template-title" class="text-base font-semibold">Delete template</h2>
        <p class="mt-1 text-xs" style="color: var(--text-secondary);">
          "{deleteTarget.name}" will be permanently deleted. Projects using it will fall back to the default template.
        </p>
      </div>

      {#if deleteError}
        <div class="px-5 pb-2">
          <div
            class="rounded-md border px-3 py-2 text-xs"
            style="border-color: #ef4444; color: #ef4444; background-color: rgba(239, 68, 68, 0.08);"
          >
            {deleteError}
          </div>
        </div>
      {/if}

      <div class="px-5 pb-5 flex items-center justify-end gap-2">
        <button
          type="button"
          class="px-3 py-2 rounded-md text-sm font-medium border cursor-pointer disabled:opacity-50"
          style="border-color: var(--border); color: var(--text-secondary); background-color: var(--bg-panel);"
          disabled={deleteBusy}
          on:click={closeDelete}
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={deleteBusy}
          on:click={submitDelete}
          class="px-3 py-2 rounded-md text-sm font-medium text-white cursor-pointer disabled:opacity-50"
          style="background-color: #ef4444;"
        >
          {deleteBusy ? "Deleting…" : "Delete"}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .page {
    color: var(--text-primary);
  }
  .header-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 12px;
  }
  .header h1 {
    font-size: 24px;
    font-weight: 600;
    margin: 0;
  }
  .new-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 13px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background-color: var(--bg-panel);
    color: var(--text-primary);
    font-size: 13px;
    font-weight: 500;
    text-decoration: none;
    transition: background-color 150ms ease, border-color 150ms ease;
  }
  .new-btn:hover {
    background-color: var(--bg-tertiary);
    border-color: var(--border-strong);
  }
  .header p {
    font-size: 14px;
    line-height: 1.6;
    color: var(--text-secondary);
    margin: 0;
  }
  .header a {
    color: var(--accent);
    text-decoration: none;
  }
  .header a:hover {
    text-decoration: underline;
  }
  .status {
    margin-top: 32px;
    font-size: 13px;
    color: var(--text-secondary);
  }
  .status-error {
    color: var(--danger, #e5484d);
  }
  .status code {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12px;
    padding: 1px 6px;
    border-radius: 4px;
    background-color: var(--bg-panel);
  }
  .grid {
    margin-top: 32px;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 16px;
  }
</style>
