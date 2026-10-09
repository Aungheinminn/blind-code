<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import PromptBox from "$lib/components/ui/PromptBox.svelte";
  import ModelDropdown from "./ModelDropdown.svelte";
  import DesignTemplatePicker from "./DesignTemplatePicker.svelte";
  import { creditsBalance, keyPreference, type ProviderInfo } from "$lib/stores/agent";
  import { providerForModel } from "$lib/tierModels";
  import { formatCompact } from "$lib/format";

  export let isRunning = false;
  export let statusText = "idle";
  export let selectedModel = "";
  export let providers: ProviderInfo[] = [];
  export let projectId = "";

  let prompt = "";
  let box: PromptBox | undefined;
  const dispatch = createEventDispatcher<{
    submit: string;
    cancel: void;
    "model-change": string;
  }>();

  // Credits chip is shown when the currently-selected model's resolved key
  // source would be the platform env (debit happens). Hidden when it'd be
  // the user's own key (free run).
  $: currentProvider = providerForModel(selectedModel);
  $: providerInfo = currentProvider
    ? providers.find((p) => p.name === currentProvider) ?? null
    : null;
  $: resolvedSource = (() => {
    if (!providerInfo?.configured) return null;
    if ($keyPreference === "platform") return "env" as const;
    if ($keyPreference === "user") return providerInfo.source === "user" ? ("user" as const) : null;
    return providerInfo.source;
  })();
  $: showCreditsChip = resolvedSource === "env" && $creditsBalance !== null;
  $: lowBalance = $creditsBalance !== null && $creditsBalance < 50;
  $: criticallyLow =
    showCreditsChip && $creditsBalance !== null && $creditsBalance < 20;
  $: creditsLabel = $creditsBalance === null ? "—" : formatCompact($creditsBalance);
  $: creditsFullLabel =
    $creditsBalance === null ? "—" : $creditsBalance.toLocaleString();

  // Per-session dismiss: dismisses while open; shows again on next page load
  // so the user doesn't forget they're running on fumes.
  let bannerDismissed = false;
  const dismissBanner = () => (bannerDismissed = true);

  const submit = () => {
    const trimmed = prompt.trim();
    if (!trimmed || isRunning) return;
    dispatch("submit", trimmed);
    prompt = "";
    box?.autoGrow();
  };

  $: canSend = prompt.trim().length > 0 && !isRunning;
</script>

<div class="px-4 pt-3 pb-3.5">
  {#if criticallyLow && !bannerDismissed}
    <div class="low-balance-banner">
      <span class="flex-1">
        Low on platform credits ({creditsFullLabel} left). Add your own API key in
        <a href="/settings/providers" class="banner-link">Settings → Providers</a>
        to keep running for free.
      </span>
      <button
        type="button"
        class="banner-close"
        on:click={dismissBanner}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  {/if}
  <PromptBox
    bind:this={box}
    bind:value={prompt}
    placeholder="Describe what you want to build…"
    minHeight={68}
    maxHeight={220}
    size="sm"
    submitOnEnter
    on:submit={submit}
  >
    <svelte:fragment slot="left">
      <div
        class="flex items-center gap-2 min-w-0 text-[11px]"
        style="color: var(--text-tertiary);"
      >
        {#if projectId}
          <DesignTemplatePicker {projectId} disabled={isRunning} />
        {/if}
        {#if showCreditsChip}
          <a
            href="/settings/credits"
            class="shrink-0 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border no-underline credits-chip"
            class:credits-chip--low={lowBalance}
            title={lowBalance
              ? `Low balance: ${creditsFullLabel} credits. Add your own API key in Settings → Providers to run for free.`
              : `${creditsFullLabel} credits remaining. Add your own API key in Settings → Providers to run for free.`}
          >
            <span
              class="w-1.5 h-1.5 rounded-full shrink-0"
              style="background-color: {lowBalance ? '#eab308' : 'var(--accent)'};"
              aria-hidden="true"
            ></span>
            <span class="tabular-nums">{creditsLabel}</span>
          </a>
        {/if}
        <span class="truncate">{statusText}</span>
      </div>
    </svelte:fragment>

    <svelte:fragment slot="right">
      <ModelDropdown
        value={selectedModel}
        {providers}
        disabled={isRunning}
        on:change={(e) => dispatch("model-change", e.detail)}
      />
      {#if isRunning}
        <button
          type="button"
          class="shrink-0 grid place-items-center w-8 h-8 rounded-[10px] border cursor-pointer stop-btn"
          style="border-color: var(--border); background-color: var(--bg-panel); color: var(--text-primary);"
          on:click={() => dispatch("cancel")}
          title="Stop"
          aria-label="Stop agent"
        >
          <span
            class="w-[10px] h-[10px] rounded-[3px]"
            style="background-color: currentColor;"
            aria-hidden="true"
          ></span>
        </button>
      {:else}
        <button
          type="button"
          class="shrink-0 grid place-items-center w-8 h-8 rounded-[10px] cursor-pointer send-btn disabled:cursor-not-allowed"
          style="background-color: var(--accent); color: white; opacity: {canSend
            ? 1
            : 0.45};"
          on:click={submit}
          disabled={!canSend}
          aria-label="Send message"
          title="Send"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 19V5" />
            <path d="M5 12l7-7 7 7" />
          </svg>
        </button>
      {/if}
    </svelte:fragment>
  </PromptBox>
</div>

<style>
  .send-btn {
    transition: transform 120ms ease, opacity 150ms ease;
    border: 0;
  }
  .send-btn:not(:disabled):hover {
    transform: translateY(-1px);
  }
  .stop-btn {
    transition: border-color 150ms ease, color 150ms ease;
  }
  .stop-btn:hover {
    border-color: var(--border-strong);
    color: var(--text-primary);
  }
  .credits-chip {
    border-color: var(--border);
    color: var(--text-secondary);
    background-color: var(--bg-panel);
    transition: color 150ms ease, border-color 150ms ease;
  }
  .credits-chip:hover {
    color: var(--text-primary);
    border-color: var(--border-strong);
  }
  .credits-chip--low {
    color: #eab308;
    border-color: color-mix(in srgb, #eab308 40%, transparent);
  }
  .low-balance-banner {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px 8px 12px;
    margin-bottom: 8px;
    border: 1px solid color-mix(in srgb, #eab308 40%, transparent);
    background-color: color-mix(in srgb, #eab308 10%, transparent);
    border-radius: 8px;
    font-size: 12px;
    color: var(--text-primary);
    line-height: 1.4;
  }
  .banner-link {
    color: #eab308;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .banner-close {
    border: 0;
    background: transparent;
    color: var(--text-tertiary);
    font-size: 16px;
    line-height: 1;
    cursor: pointer;
    padding: 0 2px;
  }
  .banner-close:hover {
    color: var(--text-primary);
  }
</style>
