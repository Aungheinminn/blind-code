<script lang="ts">
  import { onDestroy } from "svelte";
  import PromptBox from "$lib/components/ui/PromptBox.svelte";
  import ProviderChip from "$lib/components/landing/ProviderChip.svelte";
  import SectionRail from "$lib/components/design-studio/SectionRail.svelte";
  import PreviewCanvas from "$lib/components/design-studio/PreviewCanvas.svelte";
  import {
    status,
    draftMarkdown,
    savedTemplate,
    errorMessage,
    sendDesignPrompt,
    cancelDesignAgent,
    resetDesignStudio,
  } from "$lib/stores/designAgent";

  let draftName = "Untitled draft";
  let prompt = "";
  let activeSection: "colors" | "typography" | "elevation" | "shapes" | "components" =
    "colors";

  $: isRunning = $status.phase === "running" || $status.phase === "connecting";
  $: canSend = prompt.trim().length > 0 && !isRunning;
  $: canSave = Boolean($draftMarkdown) && !isRunning && !$savedTemplate;

  const onSubmit = async () => {
    if (!canSend) return;
    const text = prompt.trim();
    prompt = "";
    await sendDesignPrompt(text);
  };

  const onCancel = () => {
    cancelDesignAgent();
  };

  const onSave = () => {
    if (!canSave) return;
    void sendDesignPrompt(`Save this template as "${draftName.trim() || "Untitled draft"}".`);
  };

  onDestroy(() => {
    resetDesignStudio();
  });
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
      {#if $savedTemplate}
        <a href="/design" class="status-pill status-saved" title="Open the template gallery">
          <span class="status-dot" aria-hidden="true"></span>
          saved · {$savedTemplate.name} →
        </a>
      {:else}
        <span class="status-pill status-{$status.phase}">
          <span class="status-dot" aria-hidden="true"></span>
          {$status.label}
        </span>
      {/if}
      <button
        type="button"
        class="save-btn"
        on:click={onSave}
        disabled={!canSave}
        title={canSave ? "Ask the agent to save this draft" : "Generate a draft first"}
      >
        Save template
      </button>
    </div>
  </div>

  {#if $errorMessage}
    <div class="error-bar" role="alert">
      {$errorMessage}
    </div>
  {/if}

  <div class="canvas-wrap">
    <PreviewCanvas hasDraft={Boolean($draftMarkdown)} draft={$draftMarkdown} />
    <SectionRail bind:active={activeSection} />

    <div class="dock">
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
  .status-running .status-dot,
  .status-connecting .status-dot {
    background-color: var(--accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 25%, transparent);
    animation: pulse 1.4s ease-in-out infinite;
  }
  .status-saved {
    color: #16a34a;
    border-color: color-mix(in srgb, #16a34a 30%, transparent);
    background-color: color-mix(in srgb, #16a34a 10%, transparent);
    text-decoration: none;
    transition: filter 150ms ease;
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
    padding: 4px 12px;
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
  .cancel-link {
    background: transparent;
    border: 0;
    padding: 0 0 0 4px;
    color: var(--accent);
    cursor: pointer;
    font-size: 11px;
    text-decoration: underline;
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
