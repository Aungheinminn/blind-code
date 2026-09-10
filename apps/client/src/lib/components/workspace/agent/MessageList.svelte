<script lang="ts">
  import type { AgentMessage as AgentMessageType } from "$lib/stores/agent";
  import UserMessage from "./UserMessage.svelte";
  import AgentMessage from "./AgentMessage.svelte";
  import ThinkingIndicator from "./ThinkingIndicator.svelte";

  export let messages: AgentMessageType[] = [];
  export let isRunning = false;

  $: last = messages[messages.length - 1];
  $: showTypingIndicator = isRunning && (!last || last.role !== "agent");
</script>

<div class="flex-1 overflow-y-auto px-4 pt-[18px] pb-2 flex flex-col gap-5">
  {#each messages as message (message.id)}
    {#if message.role === "user"}
      <UserMessage content={message.content} />
    {:else}
      <AgentMessage {message} />
    {/if}
  {/each}

  {#if showTypingIndicator}
    <ThinkingIndicator />
  {/if}

  <div class="h-1 shrink-0"></div>
</div>
