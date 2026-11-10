<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import PromptBox from "$lib/components/ui/PromptBox.svelte";
  import ModelDropdown from "./ModelDropdown.svelte";
  import DesignTemplatePicker from "./DesignTemplatePicker.svelte";
  import { creditsBalance, keyPreference, type ProviderInfo } from "$lib/stores/agent";
  import { providerForModel } from "$lib/tierModels";
  import { formatCompact } from "$lib/format";
  import arrowUpIcon from "$lib/assets/icons/arrow-up.svg?raw";
  import plusIcon from "$lib/assets/icons/plus.svg?raw";
  import { MAX_PROMPT_IMAGES, prepareImage, toDataUrl, type PromptImage } from "$lib/images";

  export let isRunning = false;
  export let statusText = "idle";
  export let selectedModel = "";
  export let providers: ProviderInfo[] = [];
  export let projectId = "";

  let prompt = "";
  let box: PromptBox | undefined;
  let images: PromptImage[] = [];
  let imageError = "";
  let preparing = 0;
  let fileInput: HTMLInputElement | undefined;
  let dragging = false;
  const dispatch = createEventDispatcher<{
    submit: { text: string; images: PromptImage[] };
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

  const addFiles = async (files: Iterable<File>) => {
    imageError = "";
    for (const file of files) {
      if (!file.type.startsWith("image/")) continue;
      if (images.length + preparing >= MAX_PROMPT_IMAGES) {
        imageError = `Up to ${MAX_PROMPT_IMAGES} images per message.`;
        break;
      }
      preparing += 1;
      try {
        const img = await prepareImage(file);
        images = [...images, img];
      } catch (e) {
        imageError = e instanceof Error ? e.message : "Couldn't attach that image.";
      } finally {
        preparing -= 1;
      }
    }
  };

  const removeImage = (index: number) => {
    images = images.filter((_, i) => i !== index);
    imageError = "";
  };

  const onPaste = (event: ClipboardEvent) => {
    const files = [...(event.clipboardData?.files ?? [])].filter((f) => f.type.startsWith("image/"));
    if (files.length === 0) return;
    event.preventDefault();
    addFiles(files);
  };

  const hasFiles = (event: DragEvent) => event.dataTransfer?.types.includes("Files") ?? false;

  const onDragOver = (event: DragEvent) => {
    if (!hasFiles(event) || isRunning) return;
    event.preventDefault();
    dragging = true;
  };

  const onDrop = (event: DragEvent) => {
    dragging = false;
    if (!hasFiles(event) || isRunning) return;
    event.preventDefault();
    addFiles(event.dataTransfer?.files ?? []);
  };

  const onPick = (event: Event) => {
    const input = event.currentTarget as HTMLInputElement;
    addFiles(input.files ?? []);
    input.value = "";
  };

  const submit = () => {
    if (!canSend) return;
    dispatch("submit", { text: prompt.trim(), images });
    prompt = "";
    images = [];
    imageError = "";
    box?.autoGrow();
  };

  $: canSend =
    (prompt.trim().length > 0 || images.length > 0) && preparing === 0 && !isRunning;
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
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div
    class="relative"
    on:dragover={onDragOver}
    on:dragleave={() => (dragging = false)}
    on:drop={onDrop}
  >
  {#if dragging}
    <div class="drop-overlay" aria-hidden="true">Drop images to attach</div>
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
    on:paste={onPaste}
  >
    <svelte:fragment slot="top">
      {#if images.length > 0 || preparing > 0 || imageError}
        <div class="flex flex-wrap items-center gap-2">
          {#each images as img, i}
            <div class="thumb">
              <img src={toDataUrl(img)} alt="Attachment {i + 1}" />
              <button
                type="button"
                class="thumb-remove"
                on:click={() => removeImage(i)}
                aria-label="Remove image {i + 1}"
                title="Remove"
              >
                ×
              </button>
            </div>
          {/each}
          {#each Array(preparing) as _}
            <div class="thumb thumb--loading" aria-label="Preparing image"></div>
          {/each}
          {#if imageError}
            <span class="text-[11.5px]" style="color: #ef4444;">{imageError}</span>
          {/if}
        </div>
      {/if}
    </svelte:fragment>
    <svelte:fragment slot="left">
      <div
        class="flex items-center gap-2 min-w-0 text-[11px]"
        style="color: var(--text-tertiary);"
      >
        <button
          type="button"
          class="shrink-0 grid place-items-center w-7 h-7 rounded-md border attach-btn disabled:cursor-not-allowed disabled:opacity-50"
          on:click={() => fileInput?.click()}
          disabled={isRunning || images.length >= MAX_PROMPT_IMAGES}
          title="Attach images (or paste / drop them)"
          aria-label="Attach images"
        >
          <span class="icon-13" aria-hidden="true">{@html plusIcon}</span>
        </button>
        <input
          bind:this={fileInput}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          multiple
          class="hidden"
          on:change={onPick}
        />
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
          <span class="icon-15" aria-hidden="true">{@html arrowUpIcon}</span>
        </button>
      {/if}
    </svelte:fragment>
  </PromptBox>
  </div>
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
  .icon-15 { display: inline-flex; width: 15px; height: 15px; }
  .icon-13 { display: inline-flex; width: 13px; height: 13px; }
  .attach-btn {
    border-color: var(--border);
    background-color: var(--bg-panel);
    color: var(--text-secondary);
    cursor: pointer;
    transition: color 150ms ease, border-color 150ms ease;
  }
  .attach-btn:not(:disabled):hover {
    color: var(--text-primary);
    border-color: var(--border-strong);
  }
  .thumb {
    position: relative;
    width: 52px;
    height: 52px;
    border-radius: 8px;
    border: 1px solid var(--border);
    overflow: hidden;
    background-color: var(--bg-panel);
  }
  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .thumb--loading {
    animation: pulse 1s ease-in-out infinite alternate;
  }
  .thumb-remove {
    position: absolute;
    top: 2px;
    right: 2px;
    width: 18px;
    height: 18px;
    border-radius: 999px;
    border: 0;
    background: rgba(0, 0, 0, 0.65);
    color: white;
    font-size: 13px;
    line-height: 18px;
    cursor: pointer;
    padding: 0;
  }
  .drop-overlay {
    position: absolute;
    inset: 0;
    z-index: 2;
    display: grid;
    place-items: center;
    border: 1.5px dashed var(--accent);
    border-radius: 16px;
    background-color: color-mix(in srgb, var(--accent) 10%, var(--bg-tertiary));
    color: var(--text-primary);
    font-size: 13px;
    pointer-events: none;
  }
  @keyframes pulse {
    from { opacity: 0.4; }
    to { opacity: 0.9; }
  }
</style>
