<script lang="ts">
  import { onMount } from "svelte";
  import {
    listDesignTemplates,
    type DesignTemplateSummary,
  } from "$lib/api/projects";

  let templates: DesignTemplateSummary[] = [];
  let loading = true;
  let error = "";

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

  onMount(async () => {
    try {
      const res = await listDesignTemplates();
      templates = res ?? [];
    } catch (e) {
      error = e instanceof Error ? e.message : "failed to load design templates";
    } finally {
      loading = false;
    }
  });
</script>

<svelte:head>
  <title>Design — Blind Code</title>
</svelte:head>

<section class="page w-full max-w-[900px] mx-auto px-6 pt-14 pb-20">
  <header class="header">
    <h1>Design templates</h1>
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
        {@const swatches = swatchesFor(tpl)}
        <article class="card">
          <div class="card-head">
            <h2>{tpl.name}</h2>
            <span class="chip">{tpl.origin}</span>
          </div>
          {#if tpl.description}
            <p class="desc">{tpl.description}</p>
          {/if}
          {#if swatches.length > 0}
            <div class="swatches" role="list" aria-label="Color palette">
              {#each swatches as s}
                <span
                  class="swatch"
                  role="listitem"
                  title="{s.name} — {s.value}"
                  style="background-color: {s.value};"
                ></span>
              {/each}
            </div>
          {/if}
        </article>
      {/each}
    </div>

    <div class="soon">
      <p>
        Switching a project's template and importing your own DESIGN.md is
        coming to this page. For now, projects default to <strong>Paper</strong>.
      </p>
    </div>
  {/if}
</section>

<style>
  .page {
    color: var(--text-primary);
  }
  .header h1 {
    font-size: 24px;
    font-weight: 600;
    margin: 0 0 12px;
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
  .card {
    padding: 20px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background-color: var(--bg-panel);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .card-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .card-head h2 {
    font-size: 16px;
    font-weight: 600;
    margin: 0;
  }
  .chip {
    font-size: 10px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 2px 8px;
    border-radius: 999px;
    background-color: var(--bg-secondary);
    color: var(--text-secondary);
  }
  .desc {
    margin: 0;
    font-size: 13px;
    line-height: 1.5;
    color: var(--text-secondary);
  }
  .swatches {
    display: flex;
    gap: 6px;
    margin-top: auto;
  }
  .swatch {
    flex: 1;
    height: 28px;
    border-radius: 6px;
    border: 1px solid var(--border);
    box-sizing: border-box;
  }
  .soon {
    margin-top: 32px;
    padding: 16px 20px;
    border: 1px dashed var(--border);
    border-radius: 8px;
    background-color: var(--bg-panel);
  }
  .soon p {
    margin: 0;
    font-size: 13px;
    color: var(--text-secondary);
  }
</style>
