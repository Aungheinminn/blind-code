<script lang="ts">
  import type { Plan, TodoStatus } from "$lib/stores/agent";

  export let plan: Plan | null = null;
  export let statuses: Record<string, TodoStatus> = {};
  export let isRunning = false;
  export let planError: string | null = null;
  export let compact = false;

  $: showPlannerPending = isRunning && !plan && !planError;
</script>

{#if plan}
  <div class="flex flex-col" class:gap-2={!compact} class:gap-[9px]={compact}>
    {#each plan.todos as todo (todo.id)}
      {@const status = statuses[todo.id] ?? "pending"}
      <div class="flex items-start" class:gap-[9px]={compact} class:gap-2.5={!compact}>
        <div
          class="shrink-0 rounded-full flex items-center justify-center"
          class:pulse={status === "active"}
          class:w-[15px]={compact}
          class:h-[15px]={compact}
          class:w-4={!compact}
          class:h-4={!compact}
          style="margin-top: 2px; border: 1.5px solid {status === 'done'
            ? 'var(--success)'
            : status === 'skipped'
            ? 'var(--border-strong)'
            : status === 'active'
            ? 'var(--accent)'
            : 'var(--border-strong)'}; background: {status === 'done' ? 'var(--success)' : 'transparent'};"
        >
          {#if status === "done"}
            <span class="text-[9px] font-extrabold text-white leading-none">✓</span>
          {:else if status === "skipped"}
            <span class="text-[9px] font-bold leading-none" style="color: var(--text-tertiary);">–</span>
          {/if}
        </div>
        <div class="flex-1 min-w-0">
          <div
            class="font-medium"
            class:text-[12.5px]={compact}
            class:text-[13px]={!compact}
            class:truncate={compact}
            style="color: {status === 'done' || status === 'skipped'
              ? 'var(--text-tertiary)'
              : status === 'active'
              ? 'var(--text-primary)'
              : 'var(--text-secondary)'}; text-decoration: {status === 'done' || status === 'skipped' ? 'line-through' : 'none'};"
          >
            {todo.title}
          </div>
          {#if !compact && todo.rationale && status !== "done" && status !== "skipped"}
            <div class="text-[11.5px] mt-0.5" style="color: var(--text-tertiary);">
              {todo.rationale}
            </div>
          {/if}
        </div>
      </div>
    {/each}
  </div>
{:else if showPlannerPending}
  <div class="flex items-center gap-[9px]">
    <div class="spinner shrink-0"></div>
    <span class="text-[12.5px] font-medium" style="color: var(--text-secondary);">
      Planning…
    </span>
  </div>
{:else if planError}
  <div class="text-[12px]" style="color: var(--text-tertiary);">
    Planner unavailable — coding without a plan.
  </div>
{/if}

<style>
  .spinner {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 2px solid var(--border-strong);
    border-top-color: var(--accent);
    animation: todo-spin 700ms linear infinite;
  }
  .pulse {
    animation: todo-pulse 1.2s ease-in-out infinite;
  }
  @keyframes todo-spin {
    to {
      transform: rotate(360deg);
    }
  }
  @keyframes todo-pulse {
    0%,
    100% {
      transform: scale(1);
      opacity: 1;
    }
    50% {
      transform: scale(1.15);
      opacity: 0.75;
    }
  }
</style>
