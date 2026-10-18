<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { page } from "$app/stores";
  import PromptBox from "$lib/components/ui/PromptBox.svelte";
  import ProviderChip from "$lib/components/landing/ProviderChip.svelte";
  import SectionRail from "$lib/components/design-studio/SectionRail.svelte";
  import PreviewCanvas from "$lib/components/design-studio/PreviewCanvas.svelte";
  import MockupPane from "$lib/components/design-studio/MockupPane.svelte";
  import { MOCKUP_OPTIONS, type MockupId } from "$lib/components/design-studio/mockups";
  import { parseDraft, tokensFromDraft } from "$lib/components/design-studio/parseTemplate";
  import { patchTopLevelString } from "$lib/components/design-studio/draftPatcher";
  import { getDesignTemplate } from "$lib/api/projects";
  import {
    status,
    draftMarkdown,
    saveProposal,
    savedTemplate,
    isSaving,
    errorMessage,
    editingTemplateId,
    sendDesignPrompt,
    cancelDesignAgent,
    commitSave,
    dismissSaveProposal,
    resetDesignStudio,
    seedEditingTemplate,
    applyDraftPatch,
  } from "$lib/stores/designAgent";
  import eyeIcon from "$lib/assets/icons/eye.svg?raw";
  import editPencilIcon from "$lib/assets/icons/edit-pencil.svg?raw";
  import plusIcon from "$lib/assets/icons/plus.svg?raw";
  import pageWireframeIcon from "$lib/assets/icons/page-wireframe.svg?raw";
  import dashboardGridIcon from "$lib/assets/icons/dashboard-grid.svg?raw";
  import designPaletteIcon from "$lib/assets/icons/design-palette.svg?raw";
  import monitorIcon from "$lib/assets/icons/monitor.svg?raw";

  let draftName = "Untitled draft";
  let prompt = "";
  let loadingTemplate = false;
  let loadError = "";
  let viewOnly = false;
  let viewMode: "tokens" | "mockup" = "tokens";
  let activeMockup: MockupId = "landing";
  let activeSection:
    | "colors"
    | "typography"
    | "elevation"
    | "shapes"
    | "components"
    | "layout"
    | "dos-donts" = "colors";

  $: isEditing = Boolean($editingTemplateId) && !viewOnly;

  $: isRunning = $status.phase === "running" || $status.phase === "connecting";
  $: canSend = prompt.trim().length > 0 && !isRunning;
  $: canSave =
    Boolean($draftMarkdown) &&
    !isRunning &&
    !$savedTemplate &&
    !$isSaving;

  $: syncNameFromDraft($draftMarkdown);

  function syncNameFromDraft(md: string | null) {
    if (!md) return;
    const parsed = parseDraft(md);
    const fmName = parsed?.name?.trim();
    if (fmName && fmName !== draftName) draftName = fmName;
  }

  $: mockupParsed = $draftMarkdown ? parseDraft($draftMarkdown) : null;
  $: mockupTokens = mockupParsed ? tokensFromDraft(mockupParsed) : null;

  const onSubmit = async () => {
    if (!canSend) return;
    const text = prompt.trim();
    prompt = "";
    await sendDesignPrompt(text);
  };

  const onCancel = () => {
    cancelDesignAgent();
  };

  const onSaveClick = async () => {
    if (!canSave) return;
    await commitSave({
      name: draftName.trim() || undefined,
    });
  };

  const onPopupSave = async () => {
    if (!$saveProposal) return;
    await commitSave({
      name: draftName.trim() || $saveProposal.name,
      description: $saveProposal.description,
    });
  };

  const onPopupLater = () => {
    dismissSaveProposal();
  };

  const onNameInput = () => {
    if (!$draftMarkdown) return;
    const trimmed = draftName.trim();
    if (!trimmed) return;
    applyDraftPatch((md) => patchTopLevelString(md, "name", trimmed));
  };

  const onSectionChange = (id: string) => {
    activeSection = id as typeof activeSection;
  };

  onMount(async () => {
    const id = $page.url.searchParams.get("id");
    if (!id) return;
    loadingTemplate = true;
    loadError = "";
    try {
      const row = await getDesignTemplate(id);
      if (!row) throw new Error("template not found");
      viewOnly = row.origin === "builtin";
      seedEditingTemplate({
        id: row.id,
        content: row.content,
        name: row.name,
      });
      draftName = row.name;
    } catch (err) {
      loadError = err instanceof Error ? err.message : "failed to load template";
    } finally {
      loadingTemplate = false;
    }
  });

  onDestroy(() => {
    resetDesignStudio();
  });
</script>

<svelte:head>
  <title>Design studio — Blind Code</title>
</svelte:head>

<section class="studio">
  <div class="toolbar">
    <div class="toolbar-left">
      <span
        class="mode-chip"
        class:mode-chip-edit={isEditing}
        class:mode-chip-view={viewOnly}
        aria-label={viewOnly ? "Preview mode" : isEditing ? "Editing" : "New template"}
        title={viewOnly ? "Preview (read-only)" : isEditing ? "Editing an existing template" : "New template"}
      >
        {#if viewOnly}
          <span class="icon-16" aria-hidden="true">{@html eyeIcon}</span>
        {:else if isEditing}
          <span class="icon-16" aria-hidden="true">{@html editPencilIcon}</span>
        {:else}
          <span class="icon-16" aria-hidden="true">{@html plusIcon}</span>
        {/if}
      </span>
      <input
        type="text"
        bind:value={draftName}
        on:input={onNameInput}
        class="draft-name"
        aria-label="Draft name"
        maxlength="160"
        disabled={loadingTemplate || viewOnly}
        readonly={viewOnly}
      />
    </div>
    <div class="toolbar-right">
      <div class="mockup-slot">
        {#if viewMode === "mockup"}
          <div class="mockup-switcher" role="tablist" aria-label="Mockup type">
            {#each MOCKUP_OPTIONS as opt}
              <button
                type="button"
                role="tab"
                aria-selected={activeMockup === opt.id}
                class="view-switcher-btn"
                class:active={activeMockup === opt.id}
                on:click={() => (activeMockup = opt.id)}
                title={opt.label}
                aria-label={opt.label}
              >
                {#if opt.id === "landing"}
                  <span class="icon-16" aria-hidden="true">{@html pageWireframeIcon}</span>
                {:else if opt.id === "dashboard"}
                  <span class="icon-16" aria-hidden="true">{@html dashboardGridIcon}</span>
                {/if}
              </button>
            {/each}
          </div>
        {/if}
      </div>
      <div class="view-switcher" role="tablist" aria-label="Preview mode">
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === "tokens"}
          class="view-switcher-btn"
          class:active={viewMode === "tokens"}
          on:click={() => (viewMode = "tokens")}
          title="Tokens · swatches, samples, and prose"
          aria-label="Tokens view"
        >
          <span class="icon-16" aria-hidden="true">{@html designPaletteIcon}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === "mockup"}
          class="view-switcher-btn"
          class:active={viewMode === "mockup"}
          on:click={() => (viewMode = "mockup")}
          disabled={!mockupTokens}
          title={mockupTokens ? "Mockup · full site with this theme" : "Generate a draft first"}
          aria-label="Mockup view"
        >
          <span class="icon-16" aria-hidden="true">{@html monitorIcon}</span>
        </button>
      </div>
      {#if $savedTemplate}
        <a href="/design" class="status-pill status-saved" title="Open the template gallery">
          <span class="status-dot" aria-hidden="true"></span>
          saved · {$savedTemplate.name} →
        </a>
      {/if}
      {#if !viewOnly}
        <button
          type="button"
          class="save-btn"
          on:click={onSaveClick}
          disabled={!canSave}
          title={canSave
            ? isEditing
              ? "Save your edits to this template"
              : "Save this draft as a new template"
            : "Generate a draft first"}
        >
          {$isSaving
            ? "Saving…"
            : isEditing
              ? "Save changes"
              : "Save template"}
        </button>
      {/if}
    </div>
  </div>

  {#if loadError}
    <div class="error-bar" role="alert">
      Couldn't load template: {loadError}
    </div>
  {:else if $errorMessage}
    <div class="error-bar" role="alert">
      {$errorMessage}
    </div>
  {/if}

  {#if loadingTemplate}
    <div class="loading-bar" role="status">Loading template…</div>
  {/if}

  <div class="canvas-wrap">
    {#if viewMode === "mockup"}
      <MockupPane
        tokens={mockupTokens}
        parsed={mockupParsed}
        bind:mockup={activeMockup}
      />
    {:else}
      <PreviewCanvas
        hasDraft={Boolean($draftMarkdown)}
        draft={$draftMarkdown}
        editable={Boolean($draftMarkdown) && !isRunning && !viewOnly}
        on:sectionchange={(e) => onSectionChange(e.detail)}
      />
      <SectionRail bind:active={activeSection} />
    {/if}

    {#if !viewOnly && viewMode !== "mockup"}
    <div class="dock">
      {#if $saveProposal && !$savedTemplate}
        <div class="proposal" role="dialog" aria-live="polite">
          <div class="proposal-body">
            <span class="proposal-title">Ready to save as</span>
            <strong class="proposal-name">"{$saveProposal.name}"</strong>
            <span class="proposal-hint">
              — or keep iterating and save later.
            </span>
          </div>
          <div class="proposal-actions">
            <button
              type="button"
              class="proposal-later"
              on:click={onPopupLater}
              disabled={$isSaving}
            >
              Later
            </button>
            <button
              type="button"
              class="proposal-save"
              on:click={onPopupSave}
              disabled={$isSaving}
            >
              {$isSaving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      {/if}
      {#if isRunning}
        <span class="live-pill">
          <span class="live-dot" aria-hidden="true"></span>
          {$status.label}
          <button
            type="button"
            class="cancel-link"
            on:click={onCancel}
            title="Cancel this run"
          >
            cancel
          </button>
        </span>
      {/if}
      <form class="dock-box" on:submit|preventDefault={onSubmit}>
        <PromptBox
          bind:value={prompt}
          placeholder={$draftMarkdown
            ? "Refine — 'make the accent warmer', 'tighten the type scale'…"
            : "Describe the vibe — one line is enough…"}
          minHeight={44}
          maxHeight={140}
          size="sm"
          submitOnEnter
          disabled={isRunning}
          on:submit={onSubmit}
        >
          <svelte:fragment slot="left">
            <ProviderChip placement="up" />
          </svelte:fragment>

          <svelte:fragment slot="right">
            <button
              type="submit"
              class="send-btn"
              disabled={!canSend}
              style="background-color: {canSend
                ? 'var(--accent)'
                : 'var(--bg-tertiary)'}; color: {canSend
                ? '#ffffff'
                : 'var(--text-tertiary)'}; cursor: {canSend
                ? 'pointer'
                : 'not-allowed'};"
            >
              Send
            </button>
          </svelte:fragment>
        </PromptBox>
      </form>
    </div>
    {/if}
  </div>
</section>

<style>
  .studio {
    display: flex;
    flex-direction: column;
    height: calc(100vh - 56px);
    min-height: 0;
  }
  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 20px;
    border-bottom: 1px solid var(--border);
    background-color: var(--bg-secondary);
  }
  .toolbar-left {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    flex: 1;
  }
  .mode-chip {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    background-color: var(--bg-tertiary);
    color: var(--text-tertiary);
    border: 1px solid var(--border);
  }
  .mode-chip-edit {
    background-color: color-mix(in srgb, var(--accent) 15%, transparent);
    color: var(--accent);
    border-color: color-mix(in srgb, var(--accent) 35%, transparent);
  }
  .mode-chip-view {
    background-color: var(--bg-tertiary);
    color: var(--text-secondary);
    border-color: var(--border);
  }
  .loading-bar {
    padding: 8px 20px;
    font-size: 12.5px;
    color: var(--text-secondary);
    background-color: var(--bg-secondary);
    border-bottom: 1px solid var(--border);
  }
  .draft-name {
    flex: 1;
    max-width: 320px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 6px;
    padding: 4px 8px;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
    outline: none;
    transition: border-color 150ms ease, background-color 150ms ease;
  }
  .draft-name:hover,
  .draft-name:focus {
    border-color: var(--border);
    background-color: var(--bg-panel);
  }
  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .view-switcher {
    display: inline-flex;
    padding: 2px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background-color: var(--bg-panel);
    gap: 2px;
  }
  .view-switcher-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    color: var(--text-secondary);
    background: transparent;
    border: 0;
    border-radius: 6px;
    cursor: pointer;
    transition: background-color 150ms ease, color 150ms ease, opacity 150ms ease;
  }
  .view-switcher-btn:hover:not(:disabled):not(.active) {
    color: var(--text-primary);
  }
  .view-switcher-btn.active {
    background-color: var(--accent);
    color: #ffffff;
  }
  .view-switcher-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .mockup-switcher {
    display: inline-flex;
    padding: 2px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background-color: var(--bg-panel);
    gap: 2px;
  }
  .mockup-slot {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    min-width: 64px;
    flex-shrink: 0;
  }
  .status-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 11.5px;
    font-weight: 500;
    letter-spacing: 0.02em;
    border: 1px solid var(--border);
    color: var(--text-secondary);
    background-color: var(--bg-panel);
  }
  .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: var(--text-tertiary);
  }
  .status-saved {
    color: #16a34a;
    border-color: color-mix(in srgb, #16a34a 30%, transparent);
    background-color: color-mix(in srgb, #16a34a 10%, transparent);
    text-decoration: none;
    transition: filter 150ms ease;
    max-width: 220px;
    white-space: nowrap;
    overflow: hidden;
  }
  .status-saved > :not(.status-dot) {
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }
  .status-saved:hover {
    filter: brightness(0.95);
  }
  .status-saved .status-dot {
    background-color: #16a34a;
  }
  .save-btn {
    padding: 7px 14px;
    border-radius: 8px;
    border: 0;
    font-size: 13px;
    font-weight: 600;
    background-color: var(--accent);
    color: #ffffff;
    cursor: pointer;
    transition: background-color 150ms ease, opacity 150ms ease;
  }
  .save-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .save-btn:not(:disabled):hover {
    filter: brightness(1.05);
  }

  .error-bar {
    padding: 8px 20px;
    font-size: 12.5px;
    color: #b91c1c;
    background-color: color-mix(in srgb, #ef4444 10%, transparent);
    border-bottom: 1px solid color-mix(in srgb, #ef4444 30%, transparent);
  }

  .canvas-wrap {
    flex: 1;
    position: relative;
    min-height: 0;
    background-color: var(--bg-primary);
    overflow: hidden;
  }

  .dock {
    position: absolute;
    left: 50%;
    bottom: 20px;
    transform: translateX(-50%);
    width: min(560px, calc(100% - 96px));
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    z-index: 10;
  }
  .dock-box {
    width: 100%;
  }
  .live-pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 5px 14px;
    border-radius: 999px;
    font-size: 11.5px;
    font-weight: 500;
    color: var(--accent);
    background-color: var(--bg-panel);
    border: 1px solid var(--border);
    box-shadow: 0 6px 20px -12px rgba(0, 0, 0, 0.35);
  }
  .live-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: var(--accent);
    animation: pulse 1.4s ease-in-out infinite;
  }
  .cancel-link {
    background: transparent;
    border: 0;
    padding: 0 0 0 4px;
    color: var(--accent);
    cursor: pointer;
    font-size: 11px;
    text-decoration: underline;
  }
  .proposal {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 14px;
    border-radius: 12px;
    border: 1px solid var(--border);
    background-color: var(--bg-panel);
    box-shadow: 0 12px 32px -18px rgba(0, 0, 0, 0.35);
  }
  .proposal-body {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 6px;
    font-size: 12.5px;
    color: var(--text-secondary);
  }
  .proposal-title {
    color: var(--text-tertiary);
  }
  .proposal-name {
    color: var(--text-primary);
    font-weight: 600;
  }
  .proposal-hint {
    color: var(--text-tertiary);
    font-size: 11.5px;
  }
  .proposal-actions {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
  }
  .proposal-later,
  .proposal-save {
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    border: 1px solid var(--border);
    transition: background-color 150ms ease, filter 150ms ease, opacity 150ms ease;
  }
  .proposal-later {
    background-color: transparent;
    color: var(--text-secondary);
  }
  .proposal-later:hover:not(:disabled) {
    background-color: var(--bg-tertiary);
    color: var(--text-primary);
  }
  .proposal-save {
    background-color: var(--accent);
    color: #ffffff;
    border-color: var(--accent);
  }
  .proposal-save:hover:not(:disabled) {
    filter: brightness(1.05);
  }
  .proposal-later:disabled,
  .proposal-save:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
  @keyframes pulse {
    0%,
    100% {
      opacity: 0.4;
    }
    50% {
      opacity: 1;
    }
  }
  .send-btn {
    padding: 7px 16px;
    border-radius: 8px;
    border: 0;
    font-size: 13px;
    font-weight: 600;
    transition: background-color 150ms ease, filter 150ms ease;
  }
  .send-btn:not(:disabled):hover {
    filter: brightness(1.05);
  }
  .icon-16 {
    display: inline-flex;
    width: 16px;
    height: 16px;
  }
</style>
