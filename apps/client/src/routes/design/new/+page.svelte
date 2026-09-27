<script lang="ts">
  import PromptBox from "$lib/components/ui/PromptBox.svelte";
  import ProviderChip from "$lib/components/landing/ProviderChip.svelte";
  import SectionRail from "$lib/components/design-studio/SectionRail.svelte";
  import PreviewCanvas from "$lib/components/design-studio/PreviewCanvas.svelte";

  let draftName = "Untitled draft";
  let prompt = "";
  let activeSection: "colors" | "typography" | "elevation" | "shapes" | "components" =
    "colors";

  let status = "idle" as "idle" | "running";

  $: canSend = prompt.trim().length > 0 && status === "idle";

  const onSubmit = () => {
    if (!canSend) return;
    prompt = "";
  };

  const onSave = () => {};
</script>

<svelte:head>
  <title>Design studio — Blind Code</title>
</svelte:head>

<section class="studio">
  <div class="toolbar">
    <input
      type="text"
      bind:value={draftName}
      class="draft-name"
      aria-label="Draft name"
    />
    <div class="toolbar-right">
      <span class="status-pill status-{status}">
        <span class="status-dot" aria-hidden="true"></span>
        {status === "running" ? "generating" : "idle"}
      </span>
      <button
        type="button"
        class="save-btn"
        on:click={onSave}
        disabled
        title="Save the current draft (available once you generate one)"
      >
        Save template
      </button>
    </div>
  </div>

  <div class="canvas-wrap">
    <PreviewCanvas />
    <SectionRail bind:active={activeSection} />

    <div class="dock">
      {#if status === "running"}
        <span class="live-pill">
          <span class="live-dot" aria-hidden="true"></span>
          adjusting…
        </span>
      {/if}
      <form class="dock-box" on:submit|preventDefault={onSubmit}>
        <PromptBox
          bind:value={prompt}
          placeholder="Describe the vibe — one line is enough…"
          minHeight={44}
          maxHeight={140}
          size="sm"
          submitOnEnter
          on:submit={onSubmit}
        >
          <svelte:fragment slot="left">
            <ProviderChip />
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
  .status-running .status-dot {
    background-color: var(--accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 25%, transparent);
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
    background-color: var(--accent-hover, var(--accent));
    filter: brightness(1.05);
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
    gap: 6px;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 11.5px;
    font-weight: 500;
    color: var(--accent);
    background-color: color-mix(in srgb, var(--accent) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
  }
  .live-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: var(--accent);
    animation: pulse 1.4s ease-in-out infinite;
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
</style>
