<script lang="ts">
  import type { AgentMessage } from "$lib/stores/agent";

  export let message: AgentMessage;

  $: isAgent = message.role === "agent";
  $: hasReasoning = Boolean(message.reasoning && message.reasoning.trim().length > 0);
  $: hasToolCalls = Boolean(message.toolCalls && message.toolCalls.length > 0);
  $: isEmptyAgent = isAgent && !message.content && !hasReasoning && !hasToolCalls;

  let manualExpanded: boolean | null = null;
  $: reasoningExpanded = manualExpanded ?? !message.content;

  const toggleReasoning = () => {
    manualExpanded = !reasoningExpanded;
  };
</script>

<div class="flex gap-[11px] items-start">
  <div
    class="w-[26px] h-[26px] rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0"
    style="background-color: {isAgent ? 'var(--accent)' : 'var(--bg-tertiary)'}; color: {isAgent
      ? 'white'
      : 'var(--text-secondary)'};"
  >
    {isAgent ? "AI" : "YOU"}
  </div>
  <div class="flex-1 min-w-0 pt-[3px]">
    {#if isEmptyAgent}
      <div
        class="inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5"
        style="border-color: var(--border); background-color: var(--bg-tertiary); color: var(--text-tertiary);"
      >
        <span
          class="w-1.5 h-1.5 rounded-full animate-pulse"
          style="background-color: var(--accent);"
          aria-hidden="true"
        ></span>
        <span class="text-[11px] uppercase tracking-wider font-semibold">Thinking</span>
        <span class="flex items-center gap-0.5">
          <span
            class="w-1 h-1 rounded-full animate-pulse"
            style="background-color: var(--text-tertiary);"
          ></span>
          <span
            class="w-1 h-1 rounded-full animate-pulse"
            style="background-color: var(--text-tertiary); animation-delay: 0.2s;"
          ></span>
          <span
            class="w-1 h-1 rounded-full animate-pulse"
            style="background-color: var(--text-tertiary); animation-delay: 0.4s;"
          ></span>
        </span>
      </div>
    {/if}
    {#if hasReasoning}
      <div
        class="mb-2 rounded-md border overflow-hidden"
        style="border-color: var(--border); background-color: var(--bg-tertiary);"
      >
        <button
          type="button"
          class="w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] cursor-pointer text-left"
          style="color: var(--text-tertiary); background-color: transparent;"
          on:click={toggleReasoning}
        >
          <span
            class="inline-block transition-transform"
            style="transform: rotate({reasoningExpanded ? 90 : 0}deg);"
          >▸</span>
          <span class="uppercase tracking-wider font-semibold">Thinking</span>
          {#if !message.content}
            <span
              class="ml-1 w-1.5 h-1.5 rounded-full animate-pulse"
              style="background-color: var(--accent);"
              aria-hidden="true"
            ></span>
          {/if}
        </button>
        {#if reasoningExpanded}
          <div
            class="px-3 pb-2 pt-0 text-[12.5px] leading-[1.55] whitespace-pre-wrap break-words italic"
            style="color: var(--text-secondary);"
          >
            {message.reasoning}
          </div>
        {/if}
      </div>
    {/if}
    {#if message.content}
      <div
        class="text-[13.5px] leading-[1.6] whitespace-pre-wrap break-words"
        style="color: {isAgent ? 'var(--text-primary)' : 'var(--text-secondary)'};"
      >
        {message.content}
      </div>
    {/if}
    {#if message.toolCalls && message.toolCalls.length > 0}
      <div class="mt-2 space-y-1">
        {#each message.toolCalls as call (call.id)}
          <div
            class="text-[11px] font-mono px-2 py-1 rounded-md border"
            style="border-color: var(--border); background-color: var(--bg-tertiary); color: var(--text-secondary);"
          >
            <span style="color: var(--accent);">◆</span>
            {call.name}({JSON.stringify(call.input).slice(0, 80)})
            {#if call.output === undefined}
              <span style="color: var(--text-tertiary);"> …</span>
            {:else}
              <span style="color: var(--success);"> ✓</span>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
