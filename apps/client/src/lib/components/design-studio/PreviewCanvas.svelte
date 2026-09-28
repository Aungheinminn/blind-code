<script lang="ts">
  import { afterUpdate, createEventDispatcher, onDestroy } from "svelte";
  import { parseDraft, tokensFromDraft } from "./parseTemplate";
  import { renderMiniMarkdown } from "./miniMarkdown";
  import SwatchPopover from "./SwatchPopover.svelte";
  import ShapePopover from "./ShapePopover.svelte";
  import ElevationPopover from "./ElevationPopover.svelte";
  import TypographyDialog from "./TypographyDialog.svelte";
  import ComponentsDialog from "./ComponentsDialog.svelte";
  import ProseEditor from "./ProseEditor.svelte";
  import {
    patchFrontmatterBlockLeaf,
    patchFrontmatterNestedLeaf,
    patchProseSection,
    patchTopLevelString,
    readProseSection,
  } from "./draftPatcher";
  import { applyDraftPatch } from "$lib/stores/designAgent";

  export let hasDraft = false;
  export let draft: string | null = null;
  export let editable = false;

  $: parsed = draft ? parseDraft(draft) : null;
  $: tokens = parsed ? tokensFromDraft(parsed) : null;

  const sectionHtml = (
    p: ReturnType<typeof parseDraft>,
    key: string,
  ): string => {
    const src = p?.sections?.[key];
    if (!src || src.trim().length === 0) return "";
    return renderMiniMarkdown(src);
  };

  const dispatch = createEventDispatcher<{ sectionchange: string }>();

  let scrollEl: HTMLDivElement | null = null;
  let observer: IntersectionObserver | null = null;
  let observedIds: string[] = [];
  let lastEmitted: string | null = null;

  const rebindObserver = () => {
    if (typeof IntersectionObserver === "undefined") return;
    if (!scrollEl) return;
    const targets = Array.from(
      scrollEl.querySelectorAll<HTMLElement>("[data-preview-section]"),
    );
    const ids = targets.map((el) => el.dataset.previewSection ?? "");
    const sameSet =
      ids.length === observedIds.length &&
      ids.every((id, i) => id === observedIds[i]);
    if (sameSet && observer) return;

    observer?.disconnect();
    observedIds = ids;
    observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (!visible) return;
        const id = (visible.target as HTMLElement).dataset.previewSection;
        if (!id || id === lastEmitted) return;
        lastEmitted = id;
        dispatch("sectionchange", id);
      },
      {
        root: scrollEl,
        rootMargin: "-10% 0px -75% 0px",
        threshold: 0,
      },
    );
    for (const el of targets) observer.observe(el);
  };

  afterUpdate(() => {
    rebindObserver();
  });

  onDestroy(() => {
    observer?.disconnect();
    observer = null;
  });

  type OpenEditor =
    | { kind: "swatch"; name: string; value: string }
    | { kind: "shape"; step: "sm" | "md" | "lg" | "full"; value: string }
    | { kind: "elevation"; step: "sm" | "md" | "lg"; value: string }
    | { kind: "typography" }
    | { kind: "components" }
    | { kind: "prose"; section: string }
    | { kind: "name" }
    | { kind: "description" };

  let openEditor: OpenEditor | null = null;

  const closeEditor = () => (openEditor = null);

  const applyColor = (colorKey: string, hex: string) => {
    applyDraftPatch((md) => patchFrontmatterBlockLeaf(md, "colors", colorKey, hex));
    closeEditor();
  };

  const applyShape = (step: string, value: string) => {
    applyDraftPatch((md) => patchFrontmatterBlockLeaf(md, "rounded", step, value));
    closeEditor();
  };

  const applyElevation = (step: string, value: string) => {
    applyDraftPatch((md) => patchFrontmatterBlockLeaf(md, "elevation", step, value));
    closeEditor();
  };

  const applyTypography = (
    patches: Array<{ role: string; leaf: string; value: string }>,
  ) => {
    applyDraftPatch((md) => {
      let next = md;
      for (const p of patches) {
        next = patchFrontmatterNestedLeaf(next, "typography", p.role, p.leaf, p.value);
      }
      return next;
    });
    closeEditor();
  };

  const applyComponents = (
    patches: Array<{ component: string; leaf: string; value: string }>,
  ) => {
    applyDraftPatch((md) => {
      let next = md;
      for (const p of patches) {
        next = patchFrontmatterNestedLeaf(next, "components", p.component, p.leaf, p.value);
      }
      return next;
    });
    closeEditor();
  };

  const applyProse = (section: string, body: string) => {
    applyDraftPatch((md) => patchProseSection(md, section, body));
    closeEditor();
  };

  const applyName = (name: string) => {
    applyDraftPatch((md) => patchTopLevelString(md, "name", name));
    closeEditor();
  };

  const applyDescription = (desc: string) => {
    applyDraftPatch((md) => patchTopLevelString(md, "description", desc));
    closeEditor();
  };

  const openSwatch = (name: string, value: string) => {
    if (!editable) return;
    openEditor = { kind: "swatch", name, value };
  };
  const openShape = (step: "sm" | "md" | "lg" | "full", value: string) => {
    if (!editable) return;
    openEditor = { kind: "shape", step, value };
  };
  const openElevation = (step: "sm" | "md" | "lg", value: string) => {
    if (!editable) return;
    openEditor = { kind: "elevation", step, value };
  };
  const openTypography = () => {
    if (!editable) return;
    openEditor = { kind: "typography" };
  };
  const openComponents = () => {
    if (!editable) return;
    openEditor = { kind: "components" };
  };
  const openProse = (section: string) => {
    if (!editable) return;
    openEditor = { kind: "prose", section };
  };
  const openName = () => {
    if (!editable) return;
    openEditor = { kind: "name" };
  };
  const openDescription = () => {
    if (!editable) return;
    openEditor = { kind: "description" };
  };

  $: draftForEditors = draft ?? "";
  $: typographyValues = (parsed?.typography ?? {}) as any;
  $: componentsValues = (parsed?.components ?? {}) as any;
  $: shapeTiles = tokens
    ? ([
        { step: "sm", value: tokens.rounded.sm },
        { step: "md", value: tokens.rounded.md },
        { step: "lg", value: tokens.rounded.lg },
      ] as Array<{ step: "sm" | "md" | "lg"; value: string }>)
    : [];
  $: elevationTiles = tokens
    ? ([
        { step: "sm", value: tokens.elevation.sm },
        { step: "md", value: tokens.elevation.md },
        { step: "lg", value: tokens.elevation.lg },
      ] as Array<{ step: "sm" | "md" | "lg"; value: string }>)
    : [];
</script>

<div class="canvas">
  {#if !hasDraft || !tokens}
    <div class="empty">
      <div class="empty-illustration" aria-hidden="true">
        <span class="dot" style="background-color: #b5442e;"></span>
        <span class="dot" style="background-color: #e8ddc9;"></span>
        <span class="dot" style="background-color: #3c3630;"></span>
        <span class="dot" style="background-color: #7a5230;"></span>
      </div>
      <h2>Describe a design</h2>
      <p>
        One line is enough — a mood, a use case, a reference. The agent will
        draft a template you can see below and refine with more prompts.
      </p>
      {#if hasDraft && !tokens}
        <p class="empty-note">
          Draft received but frontmatter isn't parseable yet — waiting for the
          agent to finish writing it.
        </p>
      {/if}
    </div>
  {:else}
    {@const t = tokens}
    {@const overviewHtml = sectionHtml(parsed, "Overview")}
    {@const typographyProse = sectionHtml(parsed, "Typography")}
    {@const elevationProse = sectionHtml(parsed, "Elevation")}
    {@const shapesProse = sectionHtml(parsed, "Shapes")}
    {@const componentsProse = sectionHtml(parsed, "Components")}
    {@const layoutProse = sectionHtml(parsed, "Layout")}
    {@const dosProse = sectionHtml(parsed, "Do's and Don'ts")}
    <div class="scroll" bind:this={scrollEl}>
      {#if t.name || t.description || overviewHtml}
        <div class="draft-heading">
          {#if t.name}
            <h1
              class:editable
              on:click={openName}
              on:keydown={(e) => e.key === "Enter" && openName()}
              role={editable ? "button" : undefined}
              tabindex={editable ? 0 : -1}
              title={editable ? "Click to rename" : ""}
            >
              {t.name}
            </h1>
          {/if}
          {#if overviewHtml}
            <div
              class="prose"
              class:editable
              on:click={() => openProse("Overview")}
              on:keydown={(e) => e.key === "Enter" && openProse("Overview")}
              role={editable ? "button" : undefined}
              tabindex={editable ? 0 : -1}
              title={editable ? "Click to edit overview" : ""}
            >
              {@html overviewHtml}
            </div>
          {:else if t.description}
            <p
              class:editable
              on:click={openDescription}
              on:keydown={(e) => e.key === "Enter" && openDescription()}
              role={editable ? "button" : undefined}
              tabindex={editable ? 0 : -1}
              title={editable ? "Click to edit description" : ""}
            >
              {t.description}
            </p>
          {/if}
        </div>
      {/if}

      <section data-preview-section="colors" class="preview-section">
        <div class="section-label">Colors</div>
        <div class="swatch-strip">
          {#each t.swatches as s}
            <figure
              class="swatch"
              class:editable
              title="{s.name} — {s.value}{editable ? ' · click to edit' : ''}"
              on:click={() => openSwatch(s.name, s.value)}
              on:keydown={(e) => e.key === "Enter" && openSwatch(s.name, s.value)}
              role={editable ? "button" : undefined}
              tabindex={editable ? 0 : -1}
            >
              <span class="swatch-color" style="background-color: {s.value};"></span>
              <figcaption>
                <span class="swatch-name">{s.name}</span>
                <span class="swatch-value">{s.value}</span>
              </figcaption>
            </figure>
          {/each}
        </div>
      </section>

      <section data-preview-section="typography" class="preview-section">
        <div class="section-label">Typography</div>
        <div
          class="type-block"
          class:editable
          style="background-color: {t.colors.surface}; color: {t.colors.onSurface}; border-color: {t.colors.border};"
          on:click={openTypography}
          on:keydown={(e) => e.key === "Enter" && openTypography()}
          role={editable ? "button" : undefined}
          tabindex={editable ? 0 : -1}
          title={editable ? "Click to edit typography" : ""}
        >
          <div class="type-headline">Season Field Notes</div>
          <div class="type-body">
            Body text sample at 15px / 1.55 — the second line shows how longer
            paragraph copy wraps under a headline.
          </div>
          <div class="type-caption" style="color: {t.colors.mutedForeground};">
            Muted caption · used for metadata, labels, and secondary text
          </div>
        </div>
        {#if typographyProse}
          <div
            class="prose"
            class:editable
            on:click={() => openProse("Typography")}
            on:keydown={(e) => e.key === "Enter" && openProse("Typography")}
            role={editable ? "button" : undefined}
            tabindex={editable ? 0 : -1}
            title={editable ? "Click to edit typography notes" : ""}
          >
            {@html typographyProse}
          </div>
        {/if}
      </section>

      <section data-preview-section="elevation" class="preview-section">
        <div class="section-label">Elevation</div>
        <div class="elev-row">
          {#each elevationTiles as e}
            <button
              type="button"
              class="elev-tile"
              class:editable
              style="background-color: {t.colors.surface}; color: {t.colors.onSurface}; border-color: {t.colors.border}; box-shadow: {e.value};"
              disabled={!editable}
              title="elevation.{e.step} — {e.value}{editable ? ' · click to edit' : ''}"
              on:click={() => openElevation(e.step, e.value)}
              aria-label="Edit elevation {e.step}"
            >
              {e.step}
            </button>
          {/each}
        </div>
        {#if elevationProse}
          <div
            class="prose"
            class:editable
            on:click={() => openProse("Elevation")}
            on:keydown={(e) => e.key === "Enter" && openProse("Elevation")}
            role={editable ? "button" : undefined}
            tabindex={editable ? 0 : -1}
            title={editable ? "Click to edit elevation notes" : ""}
          >
            {@html elevationProse}
          </div>
        {/if}
      </section>

      <section data-preview-section="shapes" class="preview-section">
        <div class="section-label">Shapes</div>
        <div class="shape-row">
          {#each shapeTiles as s}
            <button
              type="button"
              class="shape-tile"
              class:editable
              style="background-color: {t.colors.primary}; border-radius: {s.value};"
              title="rounded.{s.step} — {s.value}{editable ? ' · click to edit' : ''}"
              disabled={!editable}
              on:click={() => openShape(s.step, s.value)}
              aria-label="Edit rounded {s.step}"
            ></button>
          {/each}
        </div>
        {#if shapesProse}
          <div
            class="prose"
            class:editable
            on:click={() => openProse("Shapes")}
            on:keydown={(e) => e.key === "Enter" && openProse("Shapes")}
            role={editable ? "button" : undefined}
            tabindex={editable ? 0 : -1}
            title={editable ? "Click to edit shapes notes" : ""}
          >
            {@html shapesProse}
          </div>
        {/if}
      </section>

      <section data-preview-section="components" class="preview-section">
        <div class="section-label">Components</div>
        <div class="component-grid">
          <div
            class="mock-card"
            class:editable
            style="background-color: {t.colors.surface}; color: {t.colors.onSurface}; border: 1px solid {t.colors.border}; border-radius: {t.rounded.lg};"
            on:click={openComponents}
            on:keydown={(e) => e.key === "Enter" && openComponents()}
            role={editable ? "button" : undefined}
            tabindex={editable ? 0 : -1}
            title={editable ? "Click to edit components" : ""}
          >
            <div class="mock-card-kicker" style="color: {t.colors.tertiary};">PROGRAM</div>
            <div class="mock-card-title">Community Grant</div>
            <p class="mock-card-body" style="color: {t.colors.mutedForeground};">
              Rounded corners, tonal border, resting elevation.
            </p>
            <div class="mock-card-actions">
              <button type="button" class="mock-btn" style="background-color: {t.colors.primary}; color: {t.colors.surface}; border-radius: {t.rounded.md};">Apply now</button>
              <button type="button" class="mock-btn" style="background-color: transparent; color: {t.colors.onSurface}; border: 1px solid {t.colors.border}; border-radius: {t.rounded.md};">Learn more</button>
            </div>
            <div class="mock-input-row">
              <input type="text" class="mock-input" placeholder="your@email" style="background-color: {t.colors.neutral}; color: {t.colors.onSurface}; border: 1px solid {t.colors.border}; border-radius: {t.rounded.md};" />
            </div>
          </div>
        </div>
        {#if componentsProse}
          <div
            class="prose"
            class:editable
            on:click={() => openProse("Components")}
            on:keydown={(e) => e.key === "Enter" && openProse("Components")}
            role={editable ? "button" : undefined}
            tabindex={editable ? 0 : -1}
            title={editable ? "Click to edit components notes" : ""}
          >
            {@html componentsProse}
          </div>
        {/if}
      </section>

      {#if layoutProse}
        <section data-preview-section="layout" class="preview-section">
          <div class="section-label">Layout</div>
          <div
            class="prose"
            class:editable
            on:click={() => openProse("Layout")}
            on:keydown={(e) => e.key === "Enter" && openProse("Layout")}
            role={editable ? "button" : undefined}
            tabindex={editable ? 0 : -1}
            title={editable ? "Click to edit layout notes" : ""}
          >
            {@html layoutProse}
          </div>
        </section>
      {/if}

      {#if dosProse}
        <section data-preview-section="dos-donts" class="preview-section">
          <div class="section-label">Do's & Don'ts</div>
          <div
            class="prose"
            class:editable
            on:click={() => openProse("Do's and Don'ts")}
            on:keydown={(e) => e.key === "Enter" && openProse("Do's and Don'ts")}
            role={editable ? "button" : undefined}
            tabindex={editable ? 0 : -1}
            title={editable ? "Click to edit do's and don'ts" : ""}
          >
            {@html dosProse}
          </div>
        </section>
      {/if}
    </div>
  {/if}
</div>

{#if openEditor && openEditor.kind === "swatch"}
  {@const s = openEditor}
  <div class="popover-mount">
    <SwatchPopover
      name={s.name}
      value={s.value}
      on:apply={(e) => applyColor(s.name, e.detail)}
      on:close={closeEditor}
    />
  </div>
{:else if openEditor && openEditor.kind === "shape"}
  {@const s = openEditor}
  <div class="popover-mount">
    <ShapePopover
      step={s.step}
      value={s.value}
      on:apply={(e) => applyShape(s.step, e.detail)}
      on:close={closeEditor}
    />
  </div>
{:else if openEditor && openEditor.kind === "elevation"}
  {@const s = openEditor}
  <div class="popover-mount">
    <ElevationPopover
      step={s.step}
      value={s.value}
      on:apply={(e) => applyElevation(s.step, e.detail)}
      on:close={closeEditor}
    />
  </div>
{:else if openEditor && openEditor.kind === "typography" && parsed}
  <TypographyDialog
    values={typographyValues}
    on:apply={(e) => applyTypography(e.detail)}
    on:close={closeEditor}
  />
{:else if openEditor && openEditor.kind === "components" && parsed}
  <ComponentsDialog
    values={componentsValues}
    on:apply={(e) => applyComponents(e.detail)}
    on:close={closeEditor}
  />
{:else if openEditor && openEditor.kind === "prose"}
  {@const s = openEditor}
  <div class="prose-editor-mount">
    <ProseEditor
      section={s.section}
      value={readProseSection(draftForEditors, s.section)}
      on:apply={(e) => applyProse(s.section, e.detail)}
      on:close={closeEditor}
    />
  </div>
{:else if openEditor && openEditor.kind === "name" && tokens}
  <div class="prose-editor-mount">
    <ProseEditor
      section="Name"
      value={tokens.name}
      on:apply={(e) => applyName(e.detail.trim())}
      on:close={closeEditor}
    />
  </div>
{:else if openEditor && openEditor.kind === "description" && tokens}
  <div class="prose-editor-mount">
    <ProseEditor
      section="Description"
      value={tokens.description}
      on:apply={(e) => applyDescription(e.detail.trim())}
      on:close={closeEditor}
    />
  </div>
{/if}

<style>
  .canvas {
    position: absolute;
    top: 0;
    left: 0;
    right: 48px;
    bottom: 0;
    overflow: hidden;
    background-color: var(--bg-primary);
  }
  .empty {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 24px 140px;
    text-align: center;
    color: var(--text-primary);
  }
  .empty-illustration {
    display: flex;
    gap: 10px;
    margin-bottom: 22px;
  }
  .empty-illustration .dot {
    width: 26px;
    height: 26px;
    border-radius: 999px;
    border: 1px solid var(--border);
    box-shadow: 0 2px 8px color-mix(in srgb, #000 12%, transparent);
  }
  .empty h2 {
    font-size: 20px;
    font-weight: 600;
    margin: 0 0 8px;
  }
  .empty p {
    max-width: 380px;
    font-size: 13.5px;
    line-height: 1.6;
    color: var(--text-secondary);
    margin: 0;
  }
  .empty-note {
    margin-top: 14px;
    font-size: 12px;
    color: var(--text-tertiary);
    font-style: italic;
  }

  .scroll {
    height: 100%;
    overflow-y: auto;
    padding: 28px 40px 160px;
    display: flex;
    flex-direction: column;
    gap: 34px;
  }

  .draft-heading h1 {
    font-size: 22px;
    font-weight: 700;
    margin: 0 0 6px;
    color: var(--text-primary);
    padding: 2px 6px;
    margin-left: -6px;
    border-radius: 6px;
    transition: background-color 150ms ease;
  }
  .draft-heading h1.editable {
    cursor: pointer;
  }
  .draft-heading h1.editable:hover {
    background-color: var(--bg-panel);
  }
  .draft-heading p,
  .draft-heading .prose {
    margin: 0;
    font-size: 13.5px;
    color: var(--text-secondary);
    max-width: 640px;
  }

  .preview-section {
    scroll-margin-top: 16px;
  }
  .section-label {
    font-size: 10.5px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-tertiary);
    margin-bottom: 14px;
  }

  .swatch-strip {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 12px;
    max-width: 900px;
  }
  .swatch {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 4px;
    border-radius: 8px;
    transition: outline-offset 120ms ease;
  }
  .swatch.editable {
    cursor: pointer;
  }
  .swatch.editable:hover,
  .swatch.editable:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 3px;
  }
  .swatch-color {
    display: block;
    height: 52px;
    border-radius: 6px;
    border: 1px solid var(--border);
  }
  .swatch figcaption {
    display: flex;
    flex-direction: column;
    gap: 1px;
    font-size: 11px;
    line-height: 1.3;
  }
  .swatch-name {
    color: var(--text-primary);
    font-weight: 500;
  }
  .swatch-value {
    color: var(--text-tertiary);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 10.5px;
  }

  .type-block {
    max-width: 640px;
    padding: 22px 24px;
    border-radius: 12px;
    border: 1px solid;
    display: flex;
    flex-direction: column;
    gap: 10px;
    transition: outline-offset 120ms ease;
  }
  .type-block.editable {
    cursor: pointer;
  }
  .type-block.editable:hover,
  .type-block.editable:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .type-headline {
    font-size: 28px;
    line-height: 1.15;
    font-weight: 700;
    letter-spacing: -0.01em;
  }
  .type-body {
    font-size: 15px;
    line-height: 1.55;
  }
  .type-caption {
    font-size: 12px;
    letter-spacing: 0.02em;
  }

  .elev-row,
  .shape-row {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
  }
  .elev-tile {
    width: 84px;
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 500;
    border-radius: 10px;
    border: 1px solid;
    padding: 0;
    transition: outline-offset 120ms ease;
  }
  .elev-tile.editable {
    cursor: pointer;
  }
  .elev-tile.editable:hover,
  .elev-tile.editable:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 3px;
  }
  .elev-tile:disabled {
    cursor: default;
  }
  .shape-tile {
    width: 60px;
    height: 60px;
    border: 0;
    padding: 0;
    transition: outline-offset 120ms ease;
  }
  .shape-tile.editable {
    cursor: pointer;
  }
  .shape-tile.editable:hover,
  .shape-tile.editable:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 3px;
  }
  .shape-tile:disabled {
    cursor: default;
  }

  .component-grid {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
  }
  .mock-card {
    width: 340px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    transition: outline-offset 120ms ease;
  }
  .mock-card.editable {
    cursor: pointer;
  }
  .mock-card.editable:hover,
  .mock-card.editable:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 3px;
  }
  .mock-card-kicker {
    font-size: 10.5px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    font-weight: 600;
  }
  .mock-card-title {
    font-size: 18px;
    font-weight: 700;
    line-height: 1.2;
  }
  .mock-card-body {
    font-size: 13px;
    line-height: 1.5;
    margin: 0;
  }
  .mock-card-actions {
    display: flex;
    gap: 8px;
    margin-top: 4px;
  }
  .mock-btn {
    padding: 8px 14px;
    font-size: 12.5px;
    font-weight: 600;
    border: 0;
    cursor: default;
  }
  .mock-input-row {
    margin-top: 6px;
  }
  .mock-input {
    width: 100%;
    padding: 8px 12px;
    font-size: 13px;
    outline: none;
  }

  .prose {
    margin-top: 14px;
    max-width: 720px;
    font-size: 13.5px;
    line-height: 1.6;
    color: var(--text-secondary);
    padding: 6px 8px;
    margin-left: -8px;
    border-radius: 6px;
    transition: background-color 150ms ease;
  }
  .prose.editable {
    cursor: pointer;
  }
  .prose.editable:hover,
  .prose.editable:focus-visible {
    background-color: var(--bg-panel);
    outline: none;
  }
  .prose :global(p) {
    margin: 0 0 10px;
  }
  .prose :global(p:last-child) {
    margin-bottom: 0;
  }
  .prose :global(ul) {
    margin: 0 0 10px;
    padding-left: 18px;
  }
  .prose :global(ul:last-child) {
    margin-bottom: 0;
  }
  .prose :global(li) {
    margin: 4px 0;
  }
  .prose :global(strong) {
    color: var(--text-primary);
    font-weight: 600;
  }
  .prose :global(code) {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12px;
    padding: 1px 5px;
    border-radius: 4px;
    background-color: var(--bg-panel);
    color: var(--text-primary);
    border: 1px solid var(--border);
  }
  .prose :global(a) {
    color: var(--accent);
    text-decoration: none;
  }
  .prose :global(a:hover) {
    text-decoration: underline;
  }
  .draft-heading .prose {
    margin-top: 6px;
    color: var(--text-secondary);
  }

  .popover-mount {
    position: fixed;
    z-index: 55;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }
  .prose-editor-mount {
    position: fixed;
    z-index: 55;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(560px, calc(100vw - 40px));
  }
</style>
