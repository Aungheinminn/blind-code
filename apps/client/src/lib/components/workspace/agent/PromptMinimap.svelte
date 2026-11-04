<script lang="ts">
  import { createEventDispatcher } from "svelte";

  export let prompts: { id: string; content: string }[] = [];
  export let activeIds: Set<string> = new Set();

  const dispatch = createEventDispatcher<{ jump: string }>();

  let hoveredId: string | null = null;

  $: hovered = prompts.find((p) => p.id === hoveredId) ?? null;
  $: hoveredIndex = hovered ? prompts.indexOf(hovered) : -1;

  // Longer prompts get longer dashes so the strip reads like a sketch of the thread.
  const dashWidth = (content: string) => 6 + Math.min(content.trim().length, 120) / 12;
</script>

{#if prompts.length > 0}
  <nav class="minimap" aria-label="Jump to prompt" on:mouseleave={() => (hoveredId = null)}>
    {#each prompts as prompt (prompt.id)}
      <button
        type="button"
        class="dash-hit"
        aria-label={prompt.content}
        on:mouseenter={() => (hoveredId = prompt.id)}
        on:focus={() => (hoveredId = prompt.id)}
        on:blur={() => (hoveredId = null)}
        on:click={() => dispatch("jump", prompt.id)}
      >
        <span
          class="dash"
          class:active={activeIds.has(prompt.id)}
          class:hovered={hoveredId === prompt.id}
          style="width: {dashWidth(prompt.content)}px;"
        ></span>
      </button>
    {/each}

    {#if hovered}
      <div class="preview" style="top: {hoveredIndex * 10}px;" role="tooltip">
        {hovered.content}
      </div>
    {/if}
  </nav>
{/if}

<style>
  .minimap {
    position: absolute;
    left: 2px;
    top: 50%;
    transform: translateY(-50%);
    z-index: 5;
    display: flex;
    flex-direction: column;
  }
  .dash-hit {
    display: flex;
    align-items: center;
    height: 10px;
    padding: 0 6px 0 4px;
    background: none;
    border: 0;
    cursor: pointer;
  }
  .dash {
    display: block;
    height: 2px;
    border-radius: 1px;
    background-color: var(--border-strong);
    transition: background-color 120ms ease, width 120ms ease;
  }
  .dash.active {
    background-color: var(--text-tertiary);
  }
  .dash.hovered {
    background-color: var(--text-primary);
  }
  .preview {
    position: absolute;
    left: 26px;
    transform: translateY(-35%);
    width: max-content;
    max-width: min(280px, 70vw);
    padding: 10px 12px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background-color: var(--bg-panel);
    box-shadow: var(--panel-shadow);
    color: var(--text-primary);
    font-size: 13px;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
    display: -webkit-box;
    -webkit-line-clamp: 4;
    line-clamp: 4;
    -webkit-box-orient: vertical;
    overflow: hidden;
    pointer-events: none;
  }
</style>
