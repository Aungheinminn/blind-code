<script lang="ts">
  import { afterUpdate, createEventDispatcher, onDestroy } from "svelte";
  import { parseDraft, tokensFromDraft } from "./parseTemplate";
  import { renderMiniMarkdown } from "./miniMarkdown";

  export let hasDraft = false;
  export let draft: string | null = null;

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
          {#if t.name}<h1>{t.name}</h1>{/if}
          {#if overviewHtml}
            <div class="prose">{@html overviewHtml}</div>
          {:else if t.description}
            <p>{t.description}</p>
          {/if}
        </div>
      {/if}

      <section data-preview-section="colors" class="preview-section">
        <div class="section-label">Colors</div>
        <div class="swatch-strip">
          {#each t.swatches as s}
            <figure class="swatch" title="{s.name} — {s.value}">
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
          style="background-color: {t.colors.surface}; color: {t.colors.onSurface}; border-color: {t.colors.border};"
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
          <div class="prose">{@html typographyProse}</div>
        {/if}
      </section>

      <section data-preview-section="elevation" class="preview-section">
        <div class="section-label">Elevation</div>
        <div class="elev-row">
          <div
            class="elev-tile elev-sm"
            style="background-color: {t.colors.surface}; color: {t.colors.onSurface}; border-color: {t.colors.border};"
          >
            sm
          </div>
          <div
            class="elev-tile elev-md"
            style="background-color: {t.colors.surface}; color: {t.colors.onSurface}; border-color: {t.colors.border};"
          >
            md
          </div>
          <div
            class="elev-tile elev-lg"
            style="background-color: {t.colors.surface}; color: {t.colors.onSurface}; border-color: {t.colors.border};"
          >
            lg
          </div>
        </div>
        {#if elevationProse}
          <div class="prose">{@html elevationProse}</div>
        {/if}
      </section>

      <section data-preview-section="shapes" class="preview-section">
        <div class="section-label">Shapes</div>
        <div class="shape-row">
          <div
            class="shape-tile"
            style="background-color: {t.colors.primary}; border-radius: {t.rounded.sm};"
          ></div>
          <div
            class="shape-tile"
            style="background-color: {t.colors.primary}; border-radius: {t.rounded.md};"
          ></div>
          <div
            class="shape-tile"
            style="background-color: {t.colors.primary}; border-radius: {t.rounded.lg};"
          ></div>
        </div>
        {#if shapesProse}
          <div class="prose">{@html shapesProse}</div>
        {/if}
      </section>

      <section data-preview-section="components" class="preview-section">
        <div class="section-label">Components</div>
        <div class="component-grid">
          <div
            class="mock-card"
            style="background-color: {t.colors.surface}; color: {t.colors.onSurface}; border: 1px solid {t.colors.border}; border-radius: {t.rounded.lg};"
          >
            <div class="mock-card-kicker" style="color: {t.colors.tertiary};">
              PROGRAM
            </div>
            <div class="mock-card-title">Community Grant</div>
            <p class="mock-card-body" style="color: {t.colors.mutedForeground};">
              Rounded corners, tonal border, resting elevation.
            </p>
            <div class="mock-card-actions">
              <button
                type="button"
                class="mock-btn"
                style="background-color: {t.colors.primary}; color: {t.colors.surface}; border-radius: {t.rounded.md};"
              >
                Apply now
              </button>
              <button
                type="button"
                class="mock-btn"
                style="background-color: transparent; color: {t.colors.onSurface}; border: 1px solid {t.colors.border}; border-radius: {t.rounded.md};"
              >
                Learn more
              </button>
            </div>
            <div class="mock-input-row">
              <input
                type="text"
                class="mock-input"
                placeholder="your@email"
                style="background-color: {t.colors.neutral}; color: {t.colors.onSurface}; border: 1px solid {t.colors.border}; border-radius: {t.rounded.md};"
              />
            </div>
          </div>
        </div>
        {#if componentsProse}
          <div class="prose">{@html componentsProse}</div>
        {/if}
      </section>

      {#if layoutProse}
        <section data-preview-section="layout" class="preview-section">
          <div class="section-label">Layout</div>
          <div class="prose">{@html layoutProse}</div>
        </section>
      {/if}

      {#if dosProse}
        <section data-preview-section="dos-donts" class="preview-section">
          <div class="section-label">Do's & Don'ts</div>
          <div class="prose">{@html dosProse}</div>
        </section>
      {/if}
    </div>
  {/if}
</div>

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
  }
  .draft-heading p {
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
  }
  .swatch-color {
    display: block;
    height: 52px;
    border-radius: 8px;
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
  }
  .elev-sm {
    box-shadow: 0 1px 2px color-mix(in srgb, #000 12%, transparent);
  }
  .elev-md {
    box-shadow: 0 3px 10px color-mix(in srgb, #000 16%, transparent);
  }
  .elev-lg {
    box-shadow: 0 12px 32px color-mix(in srgb, #000 22%, transparent);
  }
  .shape-tile {
    width: 60px;
    height: 60px;
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
</style>
