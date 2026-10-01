<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type {
    AgentMessage as AgentMessageType,
    MessagePart,
    ToolPart,
  } from "$lib/stores/agent";
  import ToolCallList from "./ToolCallList.svelte";
  import ThinkingIndicator from "./ThinkingIndicator.svelte";

  export let message: AgentMessageType;

  const dispatch = createEventDispatcher<{ retry: void }>();

  type ChipTone = "planner" | "coder" | "router" | "verifier" | "error";
  type RenderGroup =
    | { kind: "text"; text: string; lastIndex: number }
    | { kind: "tools"; calls: ToolPart[]; lastIndex: number }
    | { kind: "chip"; label: string; tone: ChipTone; lastIndex: number };

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
      } else if (part.kind === "chip") {
        out.push({ kind: "chip", label: part.label, tone: part.tone, lastIndex: i });
      } else {
        out.push({ kind: "text", text: part.text, lastIndex: i });
      }
    });
    return out;
  };

  type ChipKind = "active" | "check" | "warning" | "x" | "arrow";
  const chipKind = (tone: ChipTone, label: string): ChipKind => {
    if (/\bing\b|ing…|ing\.\.\./i.test(label.trim())) return "active";
    if (tone === "verifier") return "check";
    if (tone === "error") return /^verified/i.test(label.trim()) ? "warning" : "x";
    return "arrow";
  };
  const chipColor = (tone: ChipTone): string => {
    switch (tone) {
      case "verifier":
        return "#10b981";
      case "error":
        return "#ef4444";
      case "planner":
        return "var(--accent)";
      case "coder":
        return "var(--text-secondary)";
      case "router":
        return "var(--text-tertiary)";
    }
  };

  $: parts = (message.parts ?? []) as MessagePart[];
  $: groups = groupParts(parts);
  $: toolCount = parts.filter((p) => p.kind === "tool").length;
  $: isEmpty =
    !message.content &&
    !parts.some(
      (p) =>
        (p.kind === "text" && p.text.length > 0) ||
        p.kind === "tool" ||
        p.kind === "chip",
    );
  $: meta = toolCount > 0 ? `ran ${toolCount} tool${toolCount === 1 ? "" : "s"}` : "";

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

  {#if isEmpty && !message.interrupted}
    <ThinkingIndicator />
  {/if}

  {#each groups as group, gi (gi)}
    {#if group.kind === "text"}
      {#if group.text}
        <div
          class="text-[13.5px] leading-[1.7] whitespace-pre-wrap break-words"
          style="color: var(--text-primary); letter-spacing: -0.003em;"
        >
          {group.text}
        </div>
      {/if}
    {:else if group.kind === "tools"}
      <ToolCallList calls={group.calls} />
    {:else if group.kind === "chip"}
      {#if group.tone === "planner" || group.tone === "coder"}
        <ThinkingIndicator label={group.label} />
      {:else}
        {@const kind = chipKind(group.tone, group.label)}
        <span
          class="phase-note self-start inline-flex items-center gap-1.5 text-[12px] font-medium"
          style="color: {chipColor(group.tone)};"
        >
          <span class="phase-icon grid place-items-center" aria-hidden="true">
            {#if kind === "active"}
              <span
                class="phase-spinner"
                style="border-color: color-mix(in srgb, {chipColor(group.tone)} 30%, transparent); border-top-color: {chipColor(group.tone)};"
              ></span>
            {:else if kind === "check"}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            {:else if kind === "warning"}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M10.3 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.4 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            {:else if kind === "x"}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            {:else}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            {/if}
          </span>
          <span>{group.label.replace(/:\s*/, " · ")}</span>
        </span>
      {/if}
    {/if}
  {/each}

  {#if message.interrupted}
    <div
      class="flex items-center gap-2 text-[12.5px] mt-0.5"
      style="color: var(--text-tertiary);"
    >
      <span class="italic">Response was interrupted.</span>
      <button
        type="button"
        class="retry-btn inline-flex items-center gap-1 px-2 py-0.5 rounded-md border cursor-pointer"
        style="border-color: var(--border); background-color: var(--bg-panel); color: var(--text-secondary);"
        on:click={() => dispatch("retry")}
      >
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <polyline points="1 4 1 10 7 10" />
          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
        </svg>
        Try again
      </button>
    </div>
  {/if}
</div>

<style>
  .message-rise {
    animation: rise 240ms ease both;
  }
  @keyframes rise {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: none; }
  }
  .retry-btn {
    transition: color 150ms ease, border-color 150ms ease, background-color 150ms ease;
  }
  .retry-btn:hover {
    color: var(--text-primary);
    border-color: var(--border-strong);
  }
  .phase-note {
    line-height: 1.4;
    letter-spacing: -0.002em;
  }
  .phase-icon {
    width: 13px;
    height: 13px;
    flex-shrink: 0;
  }
  .phase-spinner {
    display: inline-block;
    width: 11px;
    height: 11px;
    border-width: 1.5px;
    border-style: solid;
    border-radius: 50%;
    animation: phase-spin 0.9s linear infinite;
  }
  @keyframes phase-spin {
    to { transform: rotate(360deg); }
  }
</style>
