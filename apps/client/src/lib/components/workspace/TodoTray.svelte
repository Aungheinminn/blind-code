<script lang="ts">
  import { slide } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import type { Plan, TodoStatus } from "$lib/stores/agent";
  import TodoList from "./TodoList.svelte";
  import checkIcon from "$lib/assets/icons/check.svg?raw";
  import chevronDownIcon from "$lib/assets/icons/chevron-down.svg?raw";

  export let plan: Plan | null = null;
  export let statuses: Record<string, TodoStatus> = {};
  export let isRunning = false;
  export let planError: string | null = null;
  export let compact = false;

  let expanded = false;
  let userOverride = false;

  $: if (!compact) userOverride = false;
  $: effectivelyCompact = compact && !userOverride;

  $: totalTodos = plan?.todos.length ?? 0;
  $: doneOrSkipped = plan
    ? plan.todos.filter((t) => {
        const s = statuses[t.id] ?? "pending";
        return s === "done" || s === "skipped";
      }).length
    : 0;
  $: activeTodo = plan?.todos.find((t) => (statuses[t.id] ?? "pending") === "active") ?? null;
  $: finished = plan !== null && !isRunning && doneOrSkipped === totalTodos && totalTodos > 0;
  $: statusText = finished
    ? "Complete"
    : activeTodo
    ? activeTodo.title
    : isRunning
    ? plan
      ? "Working…"
      : "Planning…"
    : planError
    ? "Coding without a plan"
    : "Idle";
  $: statusCount = plan ? `${doneOrSkipped}/${totalTodos}` : "";
  $: canExpand = plan !== null && totalTodos > 0;

  const toggle = () => {
    if (!canExpand) return;
    if (effectivelyCompact) {
      userOverride = true;
      expanded = true;
      return;
    }
    if (expanded) {
      expanded = false;
      if (compact) userOverride = false;
      return;
    }
    expanded = true;
  };
</script>

<div
  class="absolute top-2 rounded-[12px] border overflow-hidden tray"
  class:tray-compact={effectivelyCompact}
  style="z-index: 10; border-color: var(--chrome-border); background: var(--chrome); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08); {effectivelyCompact ? 'left: 10px; right: auto;' : 'left: 8px; right: 8px;'}"
>
  {#if expanded && canExpand}
    <div
      class="px-[14px] pt-[12px] pb-2"
      transition:slide={{ duration: 220, easing: cubicOut }}
    >
      {#if plan?.summary}
        <div
          class="text-[11px] uppercase tracking-wider font-semibold mb-1.5"
          style="color: var(--text-tertiary);"
        >
          Plan
        </div>
        <div class="text-[12.5px] mb-2.5" style="color: var(--text-secondary);">
          {plan.summary}
        </div>
      {/if}
      <TodoList {plan} {statuses} {isRunning} {planError} compact />
    </div>
  {/if}

  <button
    type="button"
    class="flex items-center text-left tray-btn {canExpand ? 'cursor-pointer hover-row' : 'cursor-default'}"
    class:border-t={expanded && canExpand}
    class:tray-btn-compact={effectivelyCompact}
    style="border-color: var(--border);"
    on:click={toggle}
    aria-expanded={expanded}
    aria-label={expanded ? "Collapse plan" : "Expand plan"}
    disabled={!canExpand}
  >
    {#if isRunning && !finished}
      <div class="spinner shrink-0"></div>
    {:else if finished}
      <div
        class="w-[15px] h-[15px] shrink-0 rounded-full flex items-center justify-center"
        style="background-color: var(--success);"
      >
        <span class="icon-9" style="color: white;" aria-hidden="true">{@html checkIcon}</span>
      </div>
    {:else}
      <div
        class="w-[15px] h-[15px] shrink-0 rounded-full"
        style="border: 1.5px solid var(--border-strong);"
      ></div>
    {/if}

    {#if statusCount}
      <span class="text-[11px] font-semibold shrink-0 tabular-nums" style="color: var(--text-tertiary);">
        {statusCount}
      </span>
    {/if}

    {#if !effectivelyCompact}
      <span
        class="text-[12.5px] font-semibold tracking-tight truncate tray-label"
        style="color: {finished ? 'var(--success)' : 'var(--text-primary)'};"
      >
        {statusText}
      </span>

      <div class="flex-1"></div>

      {#if canExpand}
        <span
          class="icon-12 shrink-0 transition-transform duration-200"
          style="transform: rotate({expanded ? 180 : 0}deg); color: var(--text-tertiary);"
          aria-hidden="true"
        >{@html chevronDownIcon}</span>
      {/if}
    {/if}
  </button>
</div>

<style>
  .tray {
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    transition:
      left 220ms cubic-bezier(0.22, 0.8, 0.28, 1),
      right 220ms cubic-bezier(0.22, 0.8, 0.28, 1);
  }
  .tray-btn {
    width: 100%;
    padding: 10px 14px;
    gap: 9px;
    min-height: 36px;
    transition: padding 220ms cubic-bezier(0.22, 0.8, 0.28, 1);
  }
  .tray-btn-compact {
    width: auto;
    padding: 10px 12px;
    gap: 7px;
  }
  .tray-label {
    animation: tray-label-fade 220ms ease-out;
  }
  @keyframes tray-label-fade {
    from {
      opacity: 0;
      transform: translateX(-4px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
  .hover-row:hover {
    background: var(--chrome-hover);
  }
  .spinner {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 2px solid var(--border-strong);
    border-top-color: var(--accent);
    animation: tray-spin 700ms linear infinite;
  }
  @keyframes tray-spin {
    to {
      transform: rotate(360deg);
    }
  }
  .icon-9 {
    display: inline-flex;
    width: 9px;
    height: 9px;
  }
  .icon-12 {
    display: inline-flex;
    width: 12px;
    height: 12px;
  }
</style>
