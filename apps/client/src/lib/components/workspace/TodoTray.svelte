<script lang="ts">
  import type { Plan, TodoStatus } from "$lib/stores/agent";
  import TodoList from "./TodoList.svelte";

  export let plan: Plan | null = null;
  export let statuses: Record<string, TodoStatus> = {};
  export let isRunning = false;
  export let planError: string | null = null;

  let expanded = false;

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
    expanded = !expanded;
  };
</script>

<div
  class="absolute top-2 left-2 right-2 rounded-[12px] border overflow-hidden tray"
  style="z-index: 10; border-color: var(--chrome-border); background: var(--chrome); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);"
>
  {#if expanded && canExpand}
    <div class="px-[14px] pt-[12px] pb-2 max-h-[240px] overflow-y-auto">
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
    class="w-full flex items-center gap-[9px] px-[14px] py-[10px] text-left {canExpand ? 'cursor-pointer hover-row' : 'cursor-default'}"
    class:border-t={expanded && canExpand}
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
        <svg
          width="9"
          height="9"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          stroke-width="3.6"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
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

    <span
      class="text-[12.5px] font-semibold tracking-tight truncate"
      style="color: {finished ? 'var(--success)' : 'var(--text-primary)'};"
    >
      {statusText}
    </span>

    <div class="flex-1"></div>

    {#if canExpand}
      <svg
        class="shrink-0 transition-transform duration-200"
        style="transform: rotate({expanded ? 180 : 0}deg); color: var(--text-tertiary);"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    {/if}
  </button>
</div>

<style>
  .tray {
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
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
</style>
