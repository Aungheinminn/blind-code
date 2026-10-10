<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";
  import { portal } from "$lib/actions/portal";
  import {
    listDesignTemplates,
    setProjectDesignTemplate,
    type DesignTemplateSummary,
  } from "$lib/api/projects";
  import {
    activeDesignTemplateName,
    loadDesignTemplate,
  } from "$lib/stores/agent";

  export let open = false;
  export let projectId = "";
  export let selectedTemplateId: string | null = null;

  const dispatch = createEventDispatcher<{
    pick: DesignTemplateSummary;
    close: void;
  }>();

  $: activeName = projectId
    ? $activeDesignTemplateName
    : (templates.find((t) => t.id === selectedTemplateId)?.name ?? null);

  let templates: DesignTemplateSummary[] = [];
  let loading = false;
  let loaded = false;
  let error = "";
  let saving = false;

  const SWATCH_KEYS = ["primary", "tertiary", "surface", "on-surface"] as const;

  const swatchesFor = (t: DesignTemplateSummary) => {
    const colors = t.parsedTokens?.colors ?? {};
    return SWATCH_KEYS.map((k) => colors[k]).filter(
      (v): v is string => typeof v === "string",
    );
  };

  $: builtins = templates.filter((t) => t.origin === "builtin");
  $: others = templates.filter((t) => t.origin !== "builtin");

  const ensureLoaded = async () => {
    if (loaded || loading) return;
    loading = true;
    error = "";
    try {
      const res = await listDesignTemplates();
      templates = res ?? [];
      loaded = true;
    } catch (e) {
      error = e instanceof Error ? e.message : "failed to load";
    } finally {
      loading = false;
    }
  };

  $: if (open && !loaded && !loading) ensureLoaded();

  const close = () => {
    if (saving) return;
    error = "";
    dispatch("close");
  };

  const pick = async (t: DesignTemplateSummary) => {
    if (saving) return;
    if (!projectId) {
      if (t.id !== selectedTemplateId) dispatch("pick", t);
      dispatch("close");
      return;
    }
    if (t.name === $activeDesignTemplateName) {
      close();
      return;
    }
    saving = true;
    try {
      await setProjectDesignTemplate(projectId, t.id);
      await loadDesignTemplate(projectId);
      dispatch("pick", t);
      dispatch("close");
    } catch (e) {
      error = e instanceof Error ? e.message : "failed to save";
    } finally {
      saving = false;
    }
  };

  const onKey = (e: KeyboardEvent) => {
    if (open && e.key === "Escape") close();
  };

  onMount(() => {
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });
</script>

{#if open}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-noninteractive-element-interactions -->
  <div
    use:portal
    class="backdrop"
    on:click|self={close}
    role="dialog"
    aria-modal="true"
    aria-labelledby="design-modal-title"
    tabindex="-1"
  >
    <div class="modal">
      <div class="modal-head">
        <h2 id="design-modal-title">Choose design template</h2>
        <button
          type="button"
          class="close"
          on:click={close}
          disabled={saving}
          aria-label="Close"
          title="Close"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M18 6L6 18" />
            <path d="M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="modal-body">
        {#if loading}
          <p class="status">Loading…</p>
        {:else if error}
          <p class="status status-error">{error}</p>
        {:else}
          <section class="group">
            <div class="group-label">Built-in</div>
            <div class="grid">
              {#each builtins as t (t.id)}
                {@const isActive = t.name === activeName}
                {@const swatches = swatchesFor(t)}
                <button
                  type="button"
                  class="card"
                  class:card--active={isActive}
                  on:click={() => pick(t)}
                  disabled={saving}
                  aria-pressed={isActive}
                >
                  <div class="card-swatches" aria-hidden="true">
                    {#each swatches as s}
                      <span class="card-swatch" style="background-color: {s};"></span>
                    {/each}
                  </div>
                  <div class="card-body">
                    <div class="card-title">
                      {t.name}
                      {#if isActive}
                        <span class="active-dot" aria-hidden="true"></span>
                      {/if}
                    </div>
                    {#if t.description}
                      <div class="card-desc">{t.description}</div>
                    {/if}
                  </div>
                </button>
              {/each}
            </div>
          </section>

          <section class="group">
            <div class="group-label">Your templates</div>
            {#if others.length === 0}
              <div class="empty">
                Import your own DESIGN.md to see it here. Coming soon.
              </div>
            {:else}
              <div class="grid">
                {#each others as t (t.id)}
                  {@const isActive = t.name === activeName}
                  {@const swatches = swatchesFor(t)}
                  <button
                    type="button"
                    class="card"
                    class:card--active={isActive}
                    on:click={() => pick(t)}
                    disabled={saving}
                    aria-pressed={isActive}
                  >
                    <div class="card-swatches" aria-hidden="true">
                      {#each swatches as s}
                        <span class="card-swatch" style="background-color: {s};"></span>
                      {/each}
                    </div>
                    <div class="card-body">
                      <div class="card-title">
                        {t.name}
                        {#if isActive}
                          <span class="active-dot" aria-hidden="true"></span>
                        {/if}
                      </div>
                      {#if t.description}
                        <div class="card-desc">{t.description}</div>
                      {/if}
                    </div>
                  </button>
                {/each}
              </div>
            {/if}
          </section>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background-color: rgba(0, 0, 0, 0.55);
  }
  .modal {
    width: 100%;
    max-width: 640px;
    max-height: 82vh;
    display: flex;
    flex-direction: column;
    background-color: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 14px;
    box-shadow: 0 24px 48px rgba(0, 0, 0, 0.4);
    overflow: hidden;
  }
  .modal-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 18px 12px;
    border-bottom: 1px solid var(--border);
  }
  .modal-head h2 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary);
  }
  .close {
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    padding: 0;
    border-radius: 6px;
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    transition:
      background-color 150ms ease,
      color 150ms ease;
  }
  .close:hover:not(:disabled) {
    background-color: var(--bg-tertiary);
    color: var(--text-primary);
  }
  .modal-body {
    padding: 16px 18px 20px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
  .status {
    margin: 0;
    font-size: 13px;
    color: var(--text-tertiary);
  }
  .status-error {
    color: var(--danger, #e5484d);
  }
  .group {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .group-label {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-tertiary);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }
  @media (max-width: 560px) {
    .grid {
      grid-template-columns: 1fr;
    }
  }
  .card {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
    background-color: var(--bg-panel);
    border: 1px solid var(--border);
    border-radius: 10px;
    cursor: pointer;
    text-align: left;
    color: inherit;
    font-family: inherit;
    transition:
      border-color 150ms ease,
      transform 120ms ease;
  }
  .card:hover:not(:disabled) {
    border-color: var(--border-strong);
    transform: translateY(-1px);
  }
  .card:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .card--active {
    border-color: var(--accent);
  }
  .card-swatches {
    display: flex;
    gap: 4px;
    height: 24px;
  }
  .card-swatch {
    flex: 1;
    border-radius: 4px;
    border: 1px solid var(--border);
    box-sizing: border-box;
  }
  .card-body {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .card-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
  }
  .active-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: var(--accent);
  }
  .card-desc {
    font-size: 11.5px;
    line-height: 1.4;
    color: var(--text-secondary);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .empty {
    padding: 14px;
    font-size: 12px;
    color: var(--text-tertiary);
    border: 1px dashed var(--border);
    border-radius: 8px;
    background-color: var(--bg-panel);
  }
</style>
