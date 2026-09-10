<script lang="ts">
  import type {
    AgentMessage as AgentMessageType,
    MessagePart,
    ToolPart,
  } from "$lib/stores/agent";
  import ToolCallList from "./ToolCallList.svelte";

  export let message: AgentMessageType;

  type RenderGroup =
    | { kind: "text"; text: string; lastIndex: number }
    | { kind: "reasoning"; text: string; lastIndex: number }
    | { kind: "tools"; calls: ToolPart[]; lastIndex: number };

  const groupParts = (parts: MessagePart[]): RenderGroup[] => {
    const out: RenderGroup[] = [];
    parts.forEach((part, i) => {
      const last = out[out.length - 1];
      if (part.kind === "tool") {
        if (last && last.kind === "tools") {
          last.calls.push(part);
          last.lastIndex = i;
        } else {
          out.push({ kind: "tools", calls: [part], lastIndex: i });
        }
      } else {
        out.push({ kind: part.kind, text: part.text, lastIndex: i });
      }
    });
    return out;
  };

  $: parts = (message.parts ?? []) as MessagePart[];
  $: groups = groupParts(parts);
  $: toolCount = parts.filter((p) => p.kind === "tool").length;
  $: isEmpty = parts.length === 0 && !message.content;
  $: meta = toolCount > 0 ? `ran ${toolCount} tool${toolCount === 1 ? "" : "s"}` : "";

  // Reasoning collapse state, keyed by part index. A reasoning part is
  // considered "active" (streaming, inline) when it's the last group in the
  // message; once anything follows, it collapses to a pill with a toggle.
  let manualExpanded: Record<number, boolean> = {};
  const toggleReasoning = (i: number, currentlyExpanded: boolean) => {
    manualExpanded = { ...manualExpanded, [i]: !currentlyExpanded };
  };
  const isReasoningExpanded = (partIndex: number, isLastGroup: boolean): boolean => {
    if (partIndex in manualExpanded) return manualExpanded[partIndex];
    return isLastGroup;
  };
</script>

<div class="flex flex-col gap-2.5 message-rise">
  <div
    class="flex items-center gap-2 text-[11px] font-medium uppercase"
    style="color: var(--text-tertiary); letter-spacing: 0.09em;"
  >
    <span
      class="grid place-items-center w-[18px] h-[18px] rounded-md border shrink-0"
      style="background-color: var(--accent-subtle); border-color: var(--accent); color: var(--accent);"
      aria-hidden="true"
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2l2.2 6.1L20.5 10l-6.3 1.9L12 18l-2.2-6.1L3.5 10l6.3-1.9z" />
      </svg>
    </span>
    <span>Agent</span>
    <span class="flex-1 h-px" style="background-color: var(--border);"></span>
    {#if meta}
      <span class="normal-case tracking-normal" style="color: var(--text-tertiary);">
        {meta}
      </span>
    {/if}
  </div>

  {#if isEmpty}
    <div
      class="inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 self-start"
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

  {#each groups as group, gi (gi)}
    {@const isLastGroup = gi === groups.length - 1}
    {#if group.kind === "text"}
      {#if group.text}
        <div
          class="text-[13.5px] leading-[1.7] whitespace-pre-wrap break-words"
          style="color: var(--text-primary); letter-spacing: -0.003em;"
        >
          {group.text}
        </div>
      {/if}
    {:else if group.kind === "reasoning"}
      {@const partIndex = group.lastIndex}
      {@const expanded = isReasoningExpanded(partIndex, isLastGroup)}
      {#if isLastGroup && !(partIndex in manualExpanded)}
        <div
          class="px-3 py-2 rounded-md border text-[12.5px] leading-[1.55] whitespace-pre-wrap break-words italic"
          style="border-color: var(--border); background-color: var(--bg-tertiary); color: var(--text-secondary);"
        >
          {group.text}
        </div>
      {:else}
        <div>
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 cursor-pointer"
            style="border-color: var(--border); background-color: var(--bg-tertiary); color: var(--text-tertiary);"
            on:click={() => toggleReasoning(partIndex, expanded)}
            aria-expanded={expanded}
          >
            <span
              class="w-1.5 h-1.5 rounded-full"
              style="background-color: var(--accent);"
              aria-hidden="true"
            ></span>
            <span class="text-[11px] uppercase tracking-wider font-semibold">Thinking</span>
            <span
              class="text-[10px]"
              style="transform: rotate({expanded ? 90 : 0}deg); transition: transform 150ms;"
              aria-hidden="true"
            >▸</span>
          </button>
          {#if expanded}
            <div
              class="mt-1.5 px-3 py-2 rounded-md border text-[12.5px] leading-[1.55] whitespace-pre-wrap break-words italic"
              style="border-color: var(--border); background-color: var(--bg-tertiary); color: var(--text-secondary);"
            >
              {group.text}
            </div>
          {/if}
        </div>
      {/if}
    {:else if group.kind === "tools"}
      <ToolCallList calls={group.calls} />
    {/if}
  {/each}
</div>

<style>
  .message-rise {
    animation: rise 240ms ease both;
  }
  @keyframes rise {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: none; }
  }
</style>
