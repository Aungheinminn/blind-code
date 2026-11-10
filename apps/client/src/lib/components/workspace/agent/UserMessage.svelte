<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import restoreIcon from "$lib/assets/icons/restore.svg?raw";
  import { toDataUrl, type PromptImage } from "$lib/images";

  export let content: string;
  export let images: PromptImage[] = [];
  export let checkpointId: string | undefined = undefined;
  export let restoreDisabled = false;

  const dispatch = createEventDispatcher<{ restore: string }>();

  let confirming = false;

  $: if (restoreDisabled) confirming = false;

  const confirmRestore = () => {
    confirming = false;
    if (checkpointId) dispatch("restore", checkpointId);
  };
</script>

<div class="group flex flex-col items-end gap-1 message-rise">
  {#if images.length > 0}
    <div class="flex flex-wrap justify-end gap-1.5 max-w-[86%]">
      {#each images as img, i}
        <div class="sent-image">
          <img src={toDataUrl(img)} alt="Attached image {i + 1}" />
        </div>
      {/each}
    </div>
  {/if}
  {#if content}
  <div
    class="max-w-[86%] px-[13px] py-[10px] border whitespace-pre-wrap break-words leading-[1.6] text-[13.5px]"
    style="border-color: var(--border); background-color: var(--bg-tertiary); color: var(--text-primary); border-radius: 14px 14px 4px 14px;"
  >
    {content}
  </div>
  {/if}

  {#if checkpointId && !restoreDisabled}
    {#if confirming}
      <div class="flex items-center gap-2 text-[12px]" style="color: var(--text-secondary);">
        <span>Restore files to before this prompt? Later changes will be lost.</span>
        <button type="button" class="restore-action" style="color: var(--text-primary);" on:click={confirmRestore}>
          Restore
        </button>
        <button type="button" class="restore-action" on:click={() => (confirming = false)}>Cancel</button>
      </div>
    {:else}
      <button
        type="button"
        class="restore-action flex items-center gap-1 text-[12px] opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
        style="color: var(--text-secondary);"
        title="Restore project files to before this prompt"
        on:click={() => (confirming = true)}
      >
        <span class="w-3 h-3 inline-flex">{@html restoreIcon}</span>
        Restore
      </button>
    {/if}
  {/if}
</div>

<style>
  .message-rise {
    animation: rise 240ms ease both;
  }
  .sent-image {
    display: block;
    width: 96px;
    height: 96px;
    border-radius: 10px;
    border: 1px solid var(--border);
    overflow: hidden;
  }
  .sent-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .restore-action {
    transition: opacity 120ms ease, color 120ms ease;
  }
  .restore-action:hover {
    color: var(--text-primary);
  }
  @keyframes rise {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: none; }
  }
</style>
