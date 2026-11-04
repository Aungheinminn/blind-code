<script lang="ts">
  import { afterUpdate, createEventDispatcher } from "svelte";
  import type { AgentMessage as AgentMessageType } from "$lib/stores/agent";
  import UserMessage from "./UserMessage.svelte";
  import AgentMessage from "./AgentMessage.svelte";
  import ThinkingIndicator from "./ThinkingIndicator.svelte";
  import PromptMinimap from "./PromptMinimap.svelte";

  export let messages: AgentMessageType[] = [];
  export let isRunning = false;

  const dispatch = createEventDispatcher<{ retry: void; atTopChange: boolean }>();

  $: last = messages[messages.length - 1];
  $: showTypingIndicator = isRunning && (!last || last.role !== "agent");

  let scroller: HTMLDivElement;
  let stickToBottom = true;
  let atTop = true;

  const AT_TOP_THRESHOLD = 40;

  $: prompts = messages.filter((m) => m.role === "user");
  let activePromptIds = new Set<string>();

  const promptElement = (id: string) =>
    scroller?.querySelector<HTMLElement>(`[data-prompt-id="${CSS.escape(id)}"]`) ?? null;

  // A prompt counts as in view while any part of its turn (the prompt plus the
  // replies up to the next prompt) overlaps the visible scroll area.
  const updateActivePrompts = () => {
    if (!scroller) return;
    const viewTop = scroller.scrollTop;
    const viewBottom = viewTop + scroller.clientHeight;
    const starts = prompts.map((p) => promptElement(p.id)?.offsetTop ?? 0);
    const next = new Set<string>();
    prompts.forEach((p, i) => {
      const start = starts[i];
      const end = starts[i + 1] ?? scroller.scrollHeight;
      if (start < viewBottom && end > viewTop) next.add(p.id);
    });
    activePromptIds = next;
  };

  const jumpToPrompt = (event: CustomEvent<string>) => {
    const el = promptElement(event.detail);
    if (!el || !scroller) return;
    scroller.scrollTo({ top: Math.max(el.offsetTop - 12, 0), behavior: "smooth" });
  };

  const onScroll = () => {
    if (!scroller) return;
    const distance = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
    stickToBottom = distance < 40;
    const nextAtTop = scroller.scrollTop < AT_TOP_THRESHOLD;
    if (nextAtTop !== atTop) {
      atTop = nextAtTop;
      dispatch("atTopChange", atTop);
    }
    updateActivePrompts();
  };

  // Track messages/typing so this fires on every stream update; keep the
  // caller pinned to the bottom unless they've scrolled up themselves.
  $: void messages, void showTypingIndicator;
  afterUpdate(() => {
    if (stickToBottom && scroller) {
      scroller.scrollTop = scroller.scrollHeight;
    }
    updateActivePrompts();
  });
</script>

<div class="flex-1 relative flex flex-col min-h-0">
  <PromptMinimap {prompts} activeIds={activePromptIds} on:jump={jumpToPrompt} />
  <div
    bind:this={scroller}
    on:scroll={onScroll}
    class="flex-1 relative overflow-y-auto px-4 pt-[18px] pb-2 flex flex-col gap-5"
  >
    {#each messages as message (message.id)}
      {#if message.role === "user"}
        <div data-prompt-id={message.id}>
          <UserMessage content={message.content} />
        </div>
      {:else}
        <AgentMessage {message} on:retry={() => dispatch("retry")} />
      {/if}
    {/each}

    {#if showTypingIndicator}
      <ThinkingIndicator />
    {/if}

    <div class="h-1 shrink-0"></div>
  </div>
</div>
