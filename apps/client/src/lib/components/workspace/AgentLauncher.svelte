<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { Plan, TodoStatus } from "$lib/stores/agent";
  import TodoList from "./TodoList.svelte";

  export let hidden = false;
  export let isRunning = false;
  export let plan: Plan | null = null;
  export let statuses: Record<string, TodoStatus> = {};
  export let planError: string | null = null;

  const dispatch = createEventDispatcher<{ open: void }>();

  $: totalTodos = plan?.todos.length ?? 0;
  $: doneOrSkipped = plan
    ? plan.todos.filter((t) => {
        const s = statuses[t.id] ?? "pending";
        return s === "done" || s === "skipped";
      }).length
    : 0;
  $: activeTodo = plan?.todos.find((t) => (statuses[t.id] ?? "pending") === "active") ?? null;
  $: finished = plan !== null && !isRunning && doneOrSkipped === totalTodos && totalTodos > 0;
  $: hasContent = plan !== null || (isRunning && !planError) || planError !== null;
  $: statusText = !hasContent
    ? "Idle"
    : finished
    ? "Complete"
    : activeTodo
    ? activeTodo.title
    : isRunning
    ? plan
      ? "Working…"
      : "Planning…"
    : "Idle";
  $: statusCount = plan ? `${doneOrSkipped}/${totalTodos}` : "";
</script>

<button
  type="button"
  class="absolute left-[19px] bottom-[19px] z-20 w-[290px] max-w-[calc(100%-38px)] rounded-[14px] border flex flex-col overflow-hidden cursor-pointer text-left transition-all duration-200 launcher"
  style="border-color: var(--chrome-border); background: var(--chrome); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08); opacity: {hidden
    ? 0
    : 1}; pointer-events: {hidden ? 'none' : 'auto'}; transform: {hidden
    ? 'translateX(-8px)'
    : 'translateX(0)'};"
  on:click={() => dispatch("open")}
  aria-label="Open agent panel"
>
  {#if hasContent}
    <div class="px-[14px] pt-[14px] pb-3">
      <TodoList {plan} {statuses} {isRunning} {planError} compact />
    </div>
  {/if}

  <div
    class="flex items-center gap-[9px] px-[14px] py-[11px]"
    class:border-t={hasContent}
    style="border-color: var(--border);"
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
    <span
      class="text-[12.5px] font-semibold tracking-tight truncate"
      style="color: {finished ? 'var(--success)' : 'var(--text-primary)'};"
    >
      {statusText}
    </span>
    <div class="flex-1"></div>
    <span class="text-[11px] font-medium shrink-0" style="color: var(--text-tertiary);">
      {statusCount}
    </span>
  </div>
</button>

<style>
  .launcher {
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
  }
  .launcher:hover {
    background: var(--chrome-hover);
  }
  .spinner {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 2px solid var(--border-strong);
    border-top-color: var(--accent);
    animation: launcher-spin 700ms linear infinite;
  }
  @keyframes launcher-spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
