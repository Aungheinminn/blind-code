<script lang="ts">
  import type {
    AgentMessage as AgentMessageType,
    MessagePart,
    ToolPart,
  } from "$lib/stores/agent";
  import ToolCallList from "./ToolCallList.svelte";
  import ThinkingIndicator from "./ThinkingIndicator.svelte";

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
  const toggleReasoning = (partIndex: number) => {
    const idx = groups.findIndex(
      (g) => g.kind === "reasoning" && g.lastIndex === partIndex,
    );
    const isLast = idx === groups.length - 1;
    const current = partIndex in manualExpanded ? manualExpanded[partIndex] : isLast;
    manualExpanded = { ...manualExpanded, [partIndex]: !current };
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
    <ThinkingIndicator />
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
      {@const expanded = partIndex in manualExpanded ? manualExpanded[partIndex] : isLastGroup}
      <button
        type="button"
        class="reasoning-toggle flex items-start gap-1.5 text-left italic w-full min-w-0"
        style="color: var(--text-tertiary); font-size: 13.5px; line-height: 1.7; letter-spacing: -0.003em;"
        on:click|preventDefault|stopPropagation={() => toggleReasoning(partIndex)}
        aria-expanded={expanded}
      >
        <svg
          class="shrink-0"
          width="10"
          height="10"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
          stroke-linejoin="round"
          style="margin-top: 7px; transform: rotate({expanded ? 90 : 0}deg); transition: transform 150ms;"
          aria-hidden="true"
        >
          <polyline points="4 2 8 6 4 10" />
        </svg>
        {#if expanded}
          <span class="whitespace-pre-wrap break-words flex-1 min-w-0">{group.text}</span>
        {:else}
          <span class="truncate flex-1 min-w-0">{group.text}</span>
        {/if}
      </button>
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
  .reasoning-toggle {
    background: transparent;
    border: 0;
    padding: 0;
    margin: 0;
    font: inherit;
    cursor: pointer;
    appearance: none;
  }
  .reasoning-toggle:hover {
    color: var(--text-secondary);
  }
</style>
