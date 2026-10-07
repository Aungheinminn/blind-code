<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import PromptBox from "$lib/components/ui/PromptBox.svelte";
  import ModelDropdown from "./ModelDropdown.svelte";
  import DesignTemplatePicker from "./DesignTemplatePicker.svelte";
  import { creditsBalance, keyPreference, type ProviderInfo } from "$lib/stores/agent";
  import { providerForModel } from "$lib/tierModels";

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
  $: lowBalance = $creditsBalance !== null && $creditsBalance < 500;
  $: creditsLabel = $creditsBalance === null ? "—" : $creditsBalance.toLocaleString();

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
              ? `Low balance: ${creditsLabel} credits. Add your own API key in Settings → Providers to run for free.`
              : `${creditsLabel} credits remaining. Add your own API key in Settings → Providers to run for free.`}
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
</style>
