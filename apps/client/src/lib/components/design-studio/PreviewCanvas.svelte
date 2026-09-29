<script lang="ts">
  import { afterUpdate, createEventDispatcher, onDestroy } from "svelte";
  import { parseDraft, tokensFromDraft } from "./parseTemplate";
  import { renderMiniMarkdown } from "./miniMarkdown";
  import SwatchPopover from "./SwatchPopover.svelte";
  import ShapePopover from "./ShapePopover.svelte";
  import ElevationPopover from "./ElevationPopover.svelte";
  import TypographyDialog from "./TypographyDialog.svelte";
  import ComponentsDialog from "./ComponentsDialog.svelte";
  import InlineText from "./InlineText.svelte";
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
    return renderMiniMarkdown(src, p);
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

  type AnchorRect = { top: number; left: number; bottom: number; right: number; width: number; height: number };

  type OpenEditor =
    | { kind: "swatch"; name: string; value: string; anchor: AnchorRect }
    | { kind: "shape"; step: "sm" | "md" | "lg" | "full"; value: string; anchor: AnchorRect }
    | { kind: "elevation"; step: "sm" | "md" | "lg"; value: string; anchor: AnchorRect }
    | { kind: "typography" }
    | { kind: "components" };

  let openEditor: OpenEditor | null = null;
  let popoverEl: HTMLDivElement | null = null;

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
  };

  const applyName = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    applyDraftPatch((md) => patchTopLevelString(md, "name", trimmed));
  };

  const applyDescription = (desc: string) => {
    applyDraftPatch((md) => patchTopLevelString(md, "description", desc.trim()));
  };

  const rectFromEvent = (event: Event): AnchorRect | null => {
    const target = event.currentTarget as HTMLElement | null;
    if (!target) return null;
    const r = target.getBoundingClientRect();
    return { top: r.top, left: r.left, bottom: r.bottom, right: r.right, width: r.width, height: r.height };
  };

  const openSwatch = (event: Event, name: string, value: string) => {
    if (!editable) return;
    event.stopPropagation();
    const anchor = rectFromEvent(event);
    if (!anchor) return;
    openEditor = { kind: "swatch", name, value, anchor };
  };
  const openShape = (
    event: Event,
    step: "sm" | "md" | "lg" | "full",
    value: string,
  ) => {
    if (!editable) return;
    event.stopPropagation();
    const anchor = rectFromEvent(event);
    if (!anchor) return;
    openEditor = { kind: "shape", step, value, anchor };
  };
  const openElevation = (
    event: Event,
    step: "sm" | "md" | "lg",
    value: string,
  ) => {
    if (!editable) return;
    event.stopPropagation();
    const anchor = rectFromEvent(event);
    if (!anchor) return;
    openEditor = { kind: "elevation", step, value, anchor };
  };
  const openTypography = (event: Event) => {
    if (!editable) return;
    event.stopPropagation();
    openEditor = { kind: "typography" };
  };
  const openComponents = (event: Event) => {
    if (!editable) return;
    event.stopPropagation();
    openEditor = { kind: "components" };
  };

  const isAnchoredEditor = (
    e: OpenEditor | null,
  ): e is Extract<OpenEditor, { anchor: AnchorRect }> =>
    !!e && (e.kind === "swatch" || e.kind === "shape" || e.kind === "elevation");

  $: popoverStyle = (() => {
    if (!isAnchoredEditor(openEditor)) return "";
    const a = openEditor.anchor;
    const est = openEditor.kind === "shape" ? 220 : openEditor.kind === "elevation" ? 340 : 240;
    const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
    const left = Math.max(12, Math.min(a.left, vw - est - 12));
    const top = a.bottom + 8;
    return `top: ${top}px; left: ${left}px;`;
  })();

  const onWindowClick = (event: MouseEvent) => {
    if (!openEditor) return;
    if (!popoverEl) return;
    if (popoverEl.contains(event.target as Node)) return;
    closeEditor();
  };

  const onWindowKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape") closeEditor();
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

<svelte:window on:click={onWindowClick} on:keydown={onWindowKeydown} />

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
    {@const overviewSrc = parsed?.sections?.Overview ?? ""}
    {@const typographyProseSrc = parsed?.sections?.Typography ?? ""}
    {@const elevationProseSrc = parsed?.sections?.Elevation ?? ""}
    {@const shapesProseSrc = parsed?.sections?.Shapes ?? ""}
    {@const componentsProseSrc = parsed?.sections?.Components ?? ""}
    {@const layoutProseSrc = parsed?.sections?.Layout ?? ""}
    {@const dosProseSrc = parsed?.sections?.["Do's and Don'ts"] ?? ""}
    {@const overviewHtml = sectionHtml(parsed, "Overview")}
    {@const typographyProse = sectionHtml(parsed, "Typography")}
    {@const elevationProse = sectionHtml(parsed, "Elevation")}
    {@const shapesProse = sectionHtml(parsed, "Shapes")}
    {@const componentsProse = sectionHtml(parsed, "Components")}
    {@const layoutProse = sectionHtml(parsed, "Layout")}
    {@const dosProse = sectionHtml(parsed, "Do's and Don'ts")}
    <div class="scroll" bind:this={scrollEl}>
      {#if t.name || t.description || overviewHtml || editable}
        <div class="draft-heading">
          {#if t.name || editable}
            <div class="draft-title">
              <InlineText
                value={t.name}
                {editable}
                placeholder="Untitled template"
                on:apply={(e) => applyName(e.detail)}
              >
                <h1>{t.name || "Untitled template"}</h1>
              </InlineText>
            </div>
          {/if}
          {#if overviewHtml || editable}
            <InlineText
              value={overviewSrc || t.description || ""}
              multiline
              {editable}
              placeholder="Describe the template's mood, target use cases, what makes it distinct."
              on:apply={(e) => applyProse("Overview", e.detail)}
            >
              <div class="prose prose-heading">
                {#if overviewHtml}
                  {@html overviewHtml}
                {:else if t.description}
                  <p>{t.description}</p>
                {:else}
                  <p class="placeholder-prose">Click to add an overview…</p>
                {/if}
              </div>
            </InlineText>
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
              on:click={(e) => openSwatch(e, s.name, s.value)}
              on:keydown={(e) => {
                if (e.key === "Enter") openSwatch(e, s.name, s.value);
              }}
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
          on:keydown={(e) => {
            if (e.key === "Enter") openTypography(e);
          }}
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
        {#if typographyProse || editable}
          <InlineText
            value={typographyProseSrc}
            multiline
            {editable}
            placeholder="Describe when to use each type role."
            on:apply={(e) => applyProse("Typography", e.detail)}
          >
            <div class="prose">
              {#if typographyProse}
                {@html typographyProse}
              {:else}
                <p class="placeholder-prose">Click to add typography notes…</p>
              {/if}
            </div>
          </InlineText>
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
              on:click={(ev) => openElevation(ev, e.step, e.value)}
              aria-label="Edit elevation {e.step}"
            >
              {e.step}
            </button>
          {/each}
        </div>
        {#if elevationProse || editable}
          <InlineText
            value={elevationProseSrc}
            multiline
            {editable}
            placeholder="Describe when to use each elevation depth."
            on:apply={(e) => applyProse("Elevation", e.detail)}
          >
            <div class="prose">
              {#if elevationProse}
                {@html elevationProse}
              {:else}
                <p class="placeholder-prose">Click to add elevation notes…</p>
              {/if}
            </div>
          </InlineText>
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
              on:click={(e) => openShape(e, s.step, s.value)}
              aria-label="Edit rounded {s.step}"
            ></button>
          {/each}
        </div>
        {#if shapesProse || editable}
          <InlineText
            value={shapesProseSrc}
            multiline
            {editable}
            placeholder="Describe the shape language."
            on:apply={(e) => applyProse("Shapes", e.detail)}
          >
            <div class="prose">
              {#if shapesProse}
                {@html shapesProse}
              {:else}
                <p class="placeholder-prose">Click to add shape notes…</p>
              {/if}
            </div>
          </InlineText>
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
            on:keydown={(e) => {
              if (e.key === "Enter") openComponents(e);
            }}
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
        {#if componentsProse || editable}
          <InlineText
            value={componentsProseSrc}
            multiline
            {editable}
            placeholder="Describe how each component composes tokens."
            on:apply={(e) => applyProse("Components", e.detail)}
          >
            <div class="prose">
              {#if componentsProse}
                {@html componentsProse}
              {:else}
                <p class="placeholder-prose">Click to add component notes…</p>
              {/if}
            </div>
          </InlineText>
        {/if}
      </section>

      {#if layoutProse || editable}
        <section data-preview-section="layout" class="preview-section">
          <div class="section-label">Layout</div>
          <InlineText
            value={layoutProseSrc}
            multiline
            {editable}
            placeholder="Describe grid, spacing, container patterns."
            on:apply={(e) => applyProse("Layout", e.detail)}
          >
            <div class="prose">
              {#if layoutProse}
                {@html layoutProse}
              {:else}
                <p class="placeholder-prose">Click to add layout notes…</p>
              {/if}
            </div>
          </InlineText>
        </section>
      {/if}

      {#if dosProse || editable}
        <section data-preview-section="dos-donts" class="preview-section">
          <div class="section-label">Do's & Don'ts</div>
          <InlineText
            value={dosProseSrc}
            multiline
            {editable}
            placeholder="List the rules to embrace and the ones to avoid."
            on:apply={(e) => applyProse("Do's and Don'ts", e.detail)}
          >
            <div class="prose">
              {#if dosProse}
                {@html dosProse}
              {:else}
                <p class="placeholder-prose">Click to add do's and don'ts…</p>
              {/if}
            </div>
          </InlineText>
        </section>
      {/if}
    </div>
  {/if}
</div>

{#if openEditor && openEditor.kind === "swatch"}
  {@const s = openEditor}
  <div class="popover-anchor" style={popoverStyle} bind:this={popoverEl}>
    <SwatchPopover
      name={s.name}
      value={s.value}
      on:apply={(e) => applyColor(s.name, e.detail)}
      on:close={closeEditor}
    />
  </div>
{:else if openEditor && openEditor.kind === "shape"}
  {@const s = openEditor}
  <div class="popover-anchor" style={popoverStyle} bind:this={popoverEl}>
    <ShapePopover
      step={s.step}
      value={s.value}
      on:apply={(e) => applyShape(s.step, e.detail)}
      on:close={closeEditor}
    />
  </div>
{:else if openEditor && openEditor.kind === "elevation"}
  {@const s = openEditor}
  <div class="popover-anchor" style={popoverStyle} bind:this={popoverEl}>
    <ElevationPopover
      step={s.step}
      value={s.value}
      on:apply={(e) => applyElevation(s.step, e.detail)}
      on:close={closeEditor}
    />
  </div>
{:else if openEditor && openEditor.kind === "typography" && parsed}
  <div bind:this={popoverEl}>
    <TypographyDialog
      values={typographyValues}
      on:apply={(e) => applyTypography(e.detail)}
      on:close={closeEditor}
    />
  </div>
{:else if openEditor && openEditor.kind === "components" && parsed}
  <div bind:this={popoverEl}>
    <ComponentsDialog
      values={componentsValues}
      on:apply={(e) => applyComponents(e.detail)}
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

  .draft-heading {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .draft-title h1 {
    font-size: 22px;
    font-weight: 700;
    margin: 0;
    color: var(--text-primary);
  }
  .draft-heading .prose {
    margin: 0;
    font-size: 13.5px;
    color: var(--text-secondary);
    max-width: 640px;
  }
  .placeholder-prose {
    margin: 0;
    color: var(--text-tertiary);
    font-style: italic;
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
  }
  .prose-heading {
    margin-top: 0;
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
  .prose :global(h3),
  .prose :global(h4),
  .prose :global(h5),
  .prose :global(h6) {
    margin: 14px 0 6px;
    color: var(--text-primary);
    font-weight: 600;
    line-height: 1.3;
  }
  .prose :global(h3) {
    font-size: 14px;
  }
  .prose :global(h4) {
    font-size: 13px;
  }
  .prose :global(h5),
  .prose :global(h6) {
    font-size: 12px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-tertiary);
  }
  .prose :global(.token-color) {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 1px 6px 1px 4px;
    border-radius: 999px;
    background-color: var(--bg-secondary);
    border: 1px solid var(--border);
    font-size: 11.5px;
    line-height: 1.4;
    vertical-align: baseline;
  }
  .prose :global(.token-swatch) {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.15);
  }
  .prose :global(.token-color .token-name) {
    color: var(--text-primary);
    font-weight: 500;
  }
  .prose :global(.token-color .token-value) {
    color: var(--text-tertiary);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 10.5px;
  }
  .prose :global(.token-chip) {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 1px 7px;
    border-radius: 5px;
    background-color: var(--bg-secondary);
    border: 1px solid var(--border);
    font-size: 11.5px;
    line-height: 1.4;
    vertical-align: baseline;
  }
  .prose :global(.token-chip .token-name) {
    color: var(--text-primary);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 11px;
  }
  .prose :global(.token-chip .token-value) {
    color: var(--text-tertiary);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 10.5px;
  }

  .popover-anchor {
    position: fixed;
    z-index: 55;
  }
</style>
