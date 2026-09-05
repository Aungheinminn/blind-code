<script lang="ts">
  import type { AgentMessage } from "$lib/stores/agent";
  import MessageItem from "./MessageItem.svelte";

  export let messages: AgentMessage[] = [];
  export let isRunning = false;
</script>

<div class="flex-1 overflow-y-auto px-[18px] py-[18px] flex flex-col gap-4">
  {#each messages as message (message.id)}
    <MessageItem {message} />
  {/each}

  {#if isRunning}
    <div class="flex gap-[11px] items-start">
      <div
        class="w-[26px] h-[26px] rounded-lg flex items-center justify-center text-[10px] font-bold text-white shrink-0"
        style="background-color: var(--accent);"
      >
        AI
      </div>
      <div class="flex items-center gap-1 pt-2">
        <span
          class="w-1.5 h-1.5 rounded-full animate-pulse"
          style="background-color: var(--text-tertiary);"
        ></span>
        <span
          class="w-1.5 h-1.5 rounded-full animate-pulse"
          style="background-color: var(--text-tertiary); animation-delay: 0.2s;"
        ></span>
        <span
          class="w-1.5 h-1.5 rounded-full animate-pulse"
          style="background-color: var(--text-tertiary); animation-delay: 0.4s;"
        ></span>
      </div>
    </div>
  {/if}
</div>
