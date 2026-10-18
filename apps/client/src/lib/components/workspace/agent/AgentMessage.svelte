<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type {
    AgentMessage as AgentMessageType,
    MessagePart,
    ToolPart,
  } from "$lib/stores/agent";
  import ToolCallList from "./ToolCallList.svelte";
  import ThinkingIndicator from "./ThinkingIndicator.svelte";
  import sparkleIcon from "$lib/assets/icons/sparkle.svg?raw";
  import checkIcon from "$lib/assets/icons/check.svg?raw";
  import warningTriangleIcon from "$lib/assets/icons/warning-triangle.svg?raw";
  import xCircleIcon from "$lib/assets/icons/x-circle.svg?raw";
  import chevronRightIcon from "$lib/assets/icons/chevron-right.svg?raw";
  import retryIcon from "$lib/assets/icons/retry.svg?raw";

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
    const trimmed = label.trim();
    if (/\w+ing(?:[…\.\s].*)?$/i.test(trimmed)) return "active";
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
      <span class="icon-10">{@html sparkleIcon}</span>
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
              <span class="icon-13">{@html checkIcon}</span>
            {:else if kind === "warning"}
              <span class="icon-13">{@html warningTriangleIcon}</span>
            {:else if kind === "x"}
              <span class="icon-13">{@html xCircleIcon}</span>
            {:else}
              <span class="icon-13">{@html chevronRightIcon}</span>
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
        <span class="icon-11" aria-hidden="true">{@html retryIcon}</span>
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
  .icon-10 { display: inline-flex; width: 10px; height: 10px; }
  .icon-11 { display: inline-flex; width: 11px; height: 11px; }
  .icon-13 { display: inline-flex; width: 13px; height: 13px; }
</style>
