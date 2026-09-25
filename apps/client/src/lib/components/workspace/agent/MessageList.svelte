<script lang="ts">
  import { afterUpdate, createEventDispatcher } from "svelte";
  import type { AgentMessage as AgentMessageType } from "$lib/stores/agent";
  import UserMessage from "./UserMessage.svelte";
  import AgentMessage from "./AgentMessage.svelte";
  import ThinkingIndicator from "./ThinkingIndicator.svelte";

  export let messages: AgentMessageType[] = [];
  export let isRunning = false;

  const dispatch = createEventDispatcher<{ retry: void }>();

  $: last = messages[messages.length - 1];
  $: showTypingIndicator = isRunning && (!last || last.role !== "agent");

  let scroller: HTMLDivElement;
  let stickToBottom = true;

  const onScroll = () => {
    if (!scroller) return;
    const distance = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
    stickToBottom = distance < 40;
  };

  // Track messages/typing so this fires on every stream update; keep the
  // caller pinned to the bottom unless they've scrolled up themselves.
  $: void messages, void showTypingIndicator;
  afterUpdate(() => {
    if (stickToBottom && scroller) {
      scroller.scrollTop = scroller.scrollHeight;
    }
  });
</script>

<div
  bind:this={scroller}
  on:scroll={onScroll}
  class="flex-1 overflow-y-auto px-4 pt-[18px] pb-2 flex flex-col gap-5"
>
  {#each messages as message (message.id)}
    {#if message.role === "user"}
      <UserMessage content={message.content} />
    {:else}
      <AgentMessage {message} on:retry={() => dispatch("retry")} />
    {/if}
  {/each}

  {#if showTypingIndicator}
    <ThinkingIndicator />
  {/if}

  <div class="h-1 shrink-0"></div>
</div>
