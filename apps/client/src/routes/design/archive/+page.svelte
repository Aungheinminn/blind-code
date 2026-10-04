<script lang="ts">
  import { onMount } from "svelte";
  import {
    listDesignTemplates,
    deleteDesignTemplate,
    setDesignTemplateArchived,
    type DesignTemplateSummary,
  } from "$lib/api/projects";
  import DesignTemplateCard from "$lib/components/design-studio/DesignTemplateCard.svelte";

  let templates: DesignTemplateSummary[] = [];
  let loading = true;
  let error = "";
  let actionError = "";

  let searchInput = "";

  let deleteTarget: DesignTemplateSummary | null = null;
  let deleteBusy = false;
  let deleteError = "";

  $: filtered = (() => {
    const q = searchInput.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((t) => {
      const name = t.name.toLowerCase();
      const desc = (t.description ?? "").toLowerCase();
      return name.includes(q) || desc.includes(q);
    });
  })();

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

  const load = async () => {
    loading = true;
    error = "";
    try {
      const res = await listDesignTemplates({ filter: "archived" });
      templates = res ?? [];
    } catch (e) {
      error = e instanceof Error ? e.message : "failed to load archived templates";
    } finally {
      loading = false;
    }
  };

  const onUnarchive = async (t: DesignTemplateSummary) => {
    actionError = "";
    try {
      await setDesignTemplateArchived(t.id, false);
      templates = templates.filter((x) => x.id !== t.id);
    } catch (e) {
      actionError = e instanceof Error ? e.message : String(e);
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

  const onKeydown = (e: KeyboardEvent) => {
    if (e.key === "Escape") closeDelete();
  };

  onMount(load);
</script>

<svelte:head>
  <title>Archived templates — Blind Code</title>
</svelte:head>

<svelte:window on:keydown={onKeydown} />

<section class="page w-full max-w-[900px] mx-auto px-6 pt-14 pb-20">
  <header class="header">
    <h1>Archived templates</h1>
    <p>Design templates you've archived. Unarchive to bring them back to All.</p>
  </header>

  {#if actionError}
    <p class="status status-error">{actionError}</p>
  {/if}

  <div class="search-wrap">
    <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
    <input
      type="text"
      bind:value={searchInput}
      placeholder="Search archived templates…"
      class="search-input"
      disabled={templates.length === 0}
    />
    {#if searchInput}
      <button
        type="button"
        class="search-clear"
        aria-label="Clear search"
        on:click={() => (searchInput = "")}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    {/if}
  </div>

  {#if loading}
    <p class="status">Loading…</p>
  {:else if error}
    <p class="status status-error">{error}</p>
  {:else if templates.length === 0}
    <p class="status">No archived templates.</p>
  {:else if filtered.length === 0}
    <p class="status">No archived templates match "{searchInput}".</p>
  {:else}
    <div class="grid">
      {#each filtered as tpl (tpl.id)}
        <DesignTemplateCard
          variant="archived"
          template={tpl}
          swatches={swatchesFor(tpl)}
          on:unarchive={(e) => onUnarchive(e.detail)}
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
          "{deleteTarget.name}" will be moved to Deleted. You can restore it from there.
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
  .header h1 {
    font-size: 24px;
    font-weight: 600;
    margin: 0 0 8px;
  }
  .header p {
    font-size: 14px;
    line-height: 1.6;
    color: var(--text-secondary);
    margin: 0 0 16px;
  }
  .status {
    margin-top: 24px;
    font-size: 13px;
    color: var(--text-secondary);
  }
  .status-error {
    color: var(--danger, #e5484d);
  }
  .search-wrap {
    position: relative;
    display: flex;
    align-items: center;
    max-width: 320px;
    margin-top: 8px;
  }
  .search-icon {
    position: absolute;
    left: 10px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-tertiary);
    pointer-events: none;
  }
  .search-input {
    width: 100%;
    font-size: 13px;
    padding: 7px 32px 7px 30px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background-color: var(--bg-panel);
    color: var(--text-primary);
    outline: none;
  }
  .search-input:focus {
    border-color: var(--accent);
  }
  .search-input:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
  .search-clear {
    position: absolute;
    right: 6px;
    top: 50%;
    transform: translateY(-50%);
    width: 22px;
    height: 22px;
    display: grid;
    place-items: center;
    border-radius: 6px;
    border: 0;
    background: transparent;
    color: var(--text-tertiary);
    cursor: pointer;
  }
  .search-clear:hover {
    background-color: var(--bg-tertiary);
    color: var(--text-primary);
  }
  .grid {
    margin-top: 20px;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 16px;
  }
</style>
