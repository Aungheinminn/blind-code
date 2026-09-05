<script lang="ts">
  import type { AgentMessage } from "$lib/stores/agent";

  export let message: AgentMessage;

  $: isAgent = message.role === "agent";
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
