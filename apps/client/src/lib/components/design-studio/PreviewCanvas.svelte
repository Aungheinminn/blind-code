<script lang="ts">
  export let hasDraft = false;
  export let draft: string | null = null;
</script>

<div class="canvas">
  {#if !hasDraft}
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
    </div>
  {:else}
    <div class="scroll">
      <section data-preview-section="colors" class="preview-section">
        <div class="section-label">Draft markdown</div>
        <p class="section-hint">
          Phase&nbsp;3 will render this as swatches + type samples + components.
          For now, the raw draft:
        </p>
        <pre class="raw-draft">{draft ?? ""}</pre>
      </section>
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
  .scroll {
    height: 100%;
    overflow-y: auto;
    padding: 24px 32px 160px;
    display: flex;
    flex-direction: column;
    gap: 28px;
  }
  .preview-section {
    scroll-margin-top: 20px;
  }
  .section-label {
    font-size: 10.5px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-tertiary);
    margin-bottom: 10px;
  }
  .section-hint {
    font-size: 13px;
    color: var(--text-secondary);
    margin: 0 0 12px;
  }
  .raw-draft {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12px;
    line-height: 1.55;
    color: var(--text-primary);
    background-color: var(--bg-panel);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 14px 16px;
    white-space: pre-wrap;
    overflow-x: auto;
    margin: 0;
  }
</style>
