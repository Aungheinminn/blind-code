<script lang="ts">
  import { onMount, tick } from "svelte";
  import {
    listDesignTemplates,
    deleteDesignTemplate,
    setDesignTemplateArchived,
    getDesignTemplate,
    updateDesignTemplateFromDraft,
    type DesignTemplateSummary,
  } from "$lib/api/projects";
  import { patchTopLevelString } from "$lib/components/design-studio/draftPatcher";
  import DesignTemplateCard from "$lib/components/design-studio/DesignTemplateCard.svelte";

  let templates: DesignTemplateSummary[] = [];
  let loading = true;
  let error = "";

  let searchInput = "";

  let deleteTarget: DesignTemplateSummary | null = null;
  let deleteBusy = false;
  let deleteError = "";

  let renameTarget: DesignTemplateSummary | null = null;
  let renameValue = "";
  let renameBusy = false;
  let renameError = "";
  let renameInput: HTMLInputElement | null = null;

  $: builtins = templates.filter((t) => t.origin === "builtin");
  $: userTemplates = templates.filter((t) => t.origin !== "builtin");
  $: filteredUserTemplates = (() => {
    const q = searchInput.trim().toLowerCase();
    if (!q) return userTemplates;
    return userTemplates.filter((t) => {
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

  let archiveError = "";

  const onArchive = async (t: DesignTemplateSummary) => {
    archiveError = "";
    try {
      await setDesignTemplateArchived(t.id, true);
      templates = templates.filter((x) => x.id !== t.id);
    } catch (e) {
      archiveError = e instanceof Error ? e.message : String(e);
    }
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

  const openRename = async (t: DesignTemplateSummary) => {
    renameTarget = t;
    renameValue = t.name;
    renameError = "";
    await tick();
    renameInput?.focus();
    renameInput?.select();
  };

  const closeRename = () => {
    if (renameBusy) return;
    renameTarget = null;
    renameValue = "";
    renameError = "";
  };

  const submitRename = async () => {
    if (!renameTarget || renameBusy) return;
    const name = renameValue.trim();
    if (!name) return;
    if (name === renameTarget.name) {
      closeRename();
      return;
    }
    renameBusy = true;
    renameError = "";
    try {
      const full = await getDesignTemplate(renameTarget.id);
      if (!full) throw new Error("template not found");
      const nextMarkdown = patchTopLevelString(full.content, "name", name);
      const updated = await updateDesignTemplateFromDraft(renameTarget.id, {
        markdown: nextMarkdown,
        name,
      });
      if (!updated) throw new Error("save failed");
      const updatedId = renameTarget.id;
      templates = templates.map((t) =>
        t.id === updatedId ? { ...t, name: updated.name } : t,
      );
      renameTarget = null;
      renameValue = "";
    } catch (e) {
      renameError = e instanceof Error ? e.message : String(e);
    } finally {
      renameBusy = false;
    }
  };

  const onKeydown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      closeDelete();
      closeRename();
    }
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

  {#if archiveError}
    <p class="status status-error">{archiveError}</p>
  {/if}

  {#if loading}
    <p class="status">Loading…</p>
  {:else if error}
    <p class="status status-error">{error}</p>
  {:else if templates.length === 0}
    <p class="status">No templates found. Run <code>bun run db:seed:templates</code>.</p>
  {:else}
    {#if builtins.length > 0}
      <div class="section-heading">
        <h2>Built-in</h2>
        <span class="section-count">{builtins.length}</span>
      </div>
      <div class="grid">
        {#each builtins as tpl (tpl.id)}
          <DesignTemplateCard
            template={tpl}
            swatches={swatchesFor(tpl)}
            on:rename={(e) => openRename(e.detail)}
            on:archive={(e) => onArchive(e.detail)}
            on:delete={(e) => openDelete(e.detail)}
          />
        {/each}
      </div>
    {/if}

    <div class="section-heading section-heading-user">
      <div class="section-heading-left">
        <h2>My templates</h2>
        <span class="section-count">{userTemplates.length}</span>
      </div>
      <div class="search-wrap">
        <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          bind:value={searchInput}
          placeholder="Search my templates…"
          class="search-input"
          disabled={userTemplates.length === 0}
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
    </div>

    {#if userTemplates.length === 0}
      <p class="status">
        No custom templates yet. <a href="/design/new" class="inline-link">Create one</a> with the design agent.
      </p>
    {:else if filteredUserTemplates.length === 0}
      <p class="status">No custom templates match "{searchInput}".</p>
    {:else}
      <div class="grid">
        {#each filteredUserTemplates as tpl (tpl.id)}
          <DesignTemplateCard
            template={tpl}
            swatches={swatchesFor(tpl)}
            on:rename={(e) => openRename(e.detail)}
            on:archive={(e) => onArchive(e.detail)}
            on:delete={(e) => openDelete(e.detail)}
          />
        {/each}
      </div>
    {/if}
  {/if}
</section>

{#if renameTarget}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-noninteractive-element-interactions -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center px-4"
    style="background-color: rgba(0, 0, 0, 0.55);"
    on:click|self={closeRename}
    role="dialog"
    aria-modal="true"
    aria-labelledby="rename-template-title"
    tabindex="-1"
  >
    <form
      on:submit|preventDefault={submitRename}
      class="w-full max-w-md rounded-xl border shadow-xl"
      style="border-color: var(--border); background-color: var(--bg-secondary);"
    >
      <div class="px-5 pt-5 pb-4">
        <h2 id="rename-template-title" class="text-base font-semibold">Edit title</h2>
        <p class="mt-1 text-xs" style="color: var(--text-secondary);">
          Rename this template. This updates both the row name and the frontmatter
          <code>name</code> field.
        </p>
      </div>

      <div class="px-5 pb-4 space-y-4">
        <label class="block text-xs font-medium" style="color: var(--text-secondary);">
          Template name
          <input
            type="text"
            bind:this={renameInput}
            bind:value={renameValue}
            required
            maxlength="160"
            class="mt-1 w-full text-sm px-3 py-2 rounded-md border bg-transparent outline-none"
            style="border-color: var(--border); color: var(--text-primary); background-color: var(--bg-panel);"
          />
        </label>

        {#if renameError}
          <div
            class="rounded-md border px-3 py-2 text-xs"
            style="border-color: #ef4444; color: #ef4444; background-color: rgba(239, 68, 68, 0.08);"
          >
            {renameError}
          </div>
        {/if}
      </div>

      <div class="px-5 pb-5 flex items-center justify-end gap-2">
        <button
          type="button"
          class="px-3 py-2 rounded-md text-sm font-medium border cursor-pointer disabled:opacity-50"
          style="border-color: var(--border); color: var(--text-secondary); background-color: var(--bg-panel);"
          disabled={renameBusy}
          on:click={closeRename}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!renameValue.trim() || renameBusy}
          class="px-3 py-2 rounded-md text-sm font-medium text-white cursor-pointer disabled:opacity-50"
          style="background-color: var(--accent);"
        >
          {renameBusy ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  </div>
{/if}

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
          "{deleteTarget.name}" will be moved to Deleted. You can restore it from there. Projects using it will fall back to the default template.
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
  .section-heading {
    margin-top: 32px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }
  .section-heading-left {
    display: flex;
    align-items: baseline;
    gap: 10px;
  }
  .section-heading h2 {
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-tertiary);
    margin: 0;
  }
  .section-count {
    font-size: 11.5px;
    color: var(--text-tertiary);
    background-color: var(--bg-panel);
    border: 1px solid var(--border);
    padding: 1px 8px;
    border-radius: 999px;
  }
  .section-heading-user {
    margin-top: 40px;
  }
  .search-wrap {
    position: relative;
    display: flex;
    align-items: center;
    min-width: 240px;
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
    transition: border-color 150ms ease;
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
  .inline-link {
    color: var(--accent);
    text-decoration: none;
  }
  .inline-link:hover {
    text-decoration: underline;
  }
  .grid {
    margin-top: 14px;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 16px;
  }
</style>
