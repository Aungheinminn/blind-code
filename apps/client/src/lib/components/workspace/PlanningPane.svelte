<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { Plan, TodoStatus } from "$lib/stores/agent";

  export let plan: Plan | null = null;
  export let todoStatuses: Record<string, TodoStatus> = {};
  export let isRunning = false;
  export let planError: string | null = null;

  const dispatch = createEventDispatcher<{ retry: void }>();

  type UiState = "empty" | "planning" | "ready" | "error";

  $: state = (plan
    ? "ready"
    : planError
      ? "error"
      : isRunning
        ? "planning"
        : "empty") as UiState;

  $: todos = plan?.todos ?? [];
  $: statusOf = (id: string): TodoStatus => todoStatuses[id] ?? "pending";
  $: doneCount = todos.filter((t) => statusOf(t.id) === "done").length;
  $: countedTotal = todos.filter((t) => statusOf(t.id) !== "skipped").length;
  $: progressPct =
    countedTotal > 0 ? Math.round((doneCount / countedTotal) * 100) : 0;

  const skeletonRows: Array<{ w: string; delay: string }> = [
    { w: "78%", delay: "0s" },
    { w: "62%", delay: "0.15s" },
    { w: "84%", delay: "0.3s" },
    { w: "54%", delay: "0.45s" },
    { w: "70%", delay: "0.6s" },
    { w: "46%", delay: "0.75s" },
  ];
</script>

<div
  class="planning-pane"
  style="background: var(--bg-panel); border: 1px solid var(--border);"
>
  <div class="pane-header" style="border-bottom: 1px solid var(--border);">
    <span
      class="text-[12px] font-medium tracking-[0.08em] uppercase"
      style="color: var(--text-tertiary);"
    >
      Plan
    </span>
    {#if state === "planning"}
      <span
        class="flex items-center gap-2 text-[12px]"
        style="color: var(--accent);"
      >
        <span class="status-dot" style="background: var(--accent);"></span>
        Drafting
      </span>
    {:else if state === "ready"}
      <span
        class="text-[12px] font-medium tabular-nums"
        style="color: var(--text-secondary); font-family: ui-monospace, SFMono-Regular, Menlo, monospace;"
      >
        {doneCount}/{countedTotal}
      </span>
    {:else if state === "error"}
      <span
        class="flex items-center gap-2 text-[12px]"
        style="color: var(--warning);"
      >
        <span style="width: 6px; height: 6px; border-radius: 50%; background: var(--warning);"></span>
        Unavailable
      </span>
    {/if}
  </div>

  <div class="pane-body">
    {#if state === "empty"}
      <div class="flex flex-col gap-7 px-7 pt-24 pb-7">
        <div class="flex flex-col gap-4">
          <div
            class="w-10 h-10 flex items-center justify-center"
            style="border-radius: 12px; border: 1px solid var(--border); background: var(--bg-tertiary);"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" stroke-width="1.6" stroke-linecap="round">
              <circle cx="5" cy="6" r="1.6" />
              <circle cx="5" cy="12" r="1.6" />
              <circle cx="5" cy="18" r="1.6" />
              <path d="M10 6h10M10 12h10M10 18h6" />
            </svg>
          </div>
          <div class="flex flex-col gap-1.5">
            <div
              class="text-[16px] font-medium"
              style="color: var(--text-primary);"
            >
              No plan yet
            </div>
            <div
              class="text-[14px] leading-[1.55]"
              style="color: var(--text-secondary);"
            >
              Your plan will appear here once you describe what you want to build.
            </div>
          </div>
        </div>
        <div class="flex flex-col gap-3.5" style="opacity: 0.5;">
          {#each ["72%", "56%", "64%"] as w, i}
            <div class="flex items-center gap-3">
              <span
                class="w-4 h-4 shrink-0"
                style="border-radius: 50%; border: 1.5px dashed var(--border-strong); box-sizing: border-box;"
              ></span>
              <span
                class="h-2 rounded"
                style="width: {w}; background: var(--bg-tertiary);"
              ></span>
            </div>
          {/each}
        </div>
      </div>
    {:else if state === "planning"}
      <div class="flex flex-col gap-7 px-5 py-6">
        <div class="flex flex-col gap-2.5">
          <div
            class="text-[14px]"
            style="color: var(--text-secondary);"
          >
            Thinking through your request…
          </div>
          <div class="flex flex-col gap-2.5 pt-1">
            {#each ["100%", "92%", "60%"] as w}
              <span
                class="shimmer-bar"
                style="width: {w};"
              ></span>
            {/each}
          </div>
        </div>
        <div class="flex flex-col">
          {#each skeletonRows as row}
            <div class="flex items-center gap-3 py-2.5">
              <span
                class="w-4 h-4 shrink-0 breathe"
                style="border-radius: 50%; border: 1.5px solid var(--border-strong); box-sizing: border-box; animation-delay: {row.delay};"
              ></span>
              <span
                class="h-[9px] rounded breathe"
                style="width: {row.w}; background: var(--bg-tertiary); animation-delay: {row.delay};"
              ></span>
            </div>
          {/each}
        </div>
      </div>
    {:else if state === "ready"}
      <div class="flex flex-col">
        <div class="px-5 pt-5 pb-4 flex flex-col gap-3.5">
          {#if plan?.summary}
            <div
              class="text-[14px] leading-[1.6]"
              style="color: var(--text-secondary);"
            >
              {plan.summary}
            </div>
          {/if}
          {#if countedTotal > 0}
            <div
              class="h-[3px] overflow-hidden"
              style="border-radius: 2px; background: var(--bg-tertiary);"
            >
              <div
                class="h-full"
                style="width: {progressPct}%; background: var(--success); border-radius: 2px; transition: width 300ms cubic-bezier(0.22, 0.8, 0.28, 1);"
              ></div>
            </div>
          {/if}
        </div>
        <div class="px-2 pb-4 flex flex-col gap-0.5">
          {#each todos as todo (todo.id)}
            {@const s = statusOf(todo.id)}
            {#if s === "done"}
              <div class="flex gap-3 px-3 py-2.5">
                <span
                  class="w-[18px] h-[18px] shrink-0 flex items-center justify-center"
                  style="border-radius: 50%; background: var(--success); margin-top: 1px;"
                >
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="#0a0a0a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M2.5 6.2l2.3 2.3 4.7-5" />
                  </svg>
                </span>
                <span
                  class="flex-1 min-w-0 text-[14px] leading-[1.45] break-words"
                  style="color: var(--text-secondary);"
                >
                  {todo.title}
                </span>
              </div>
            {:else if s === "active"}
              <div
                class="flex gap-3 p-3"
                style="border-radius: 10px; background: var(--accent-soft); border: 1px solid rgba(59, 130, 246, 0.22);"
              >
                <span
                  class="w-[18px] h-[18px] shrink-0 flex items-center justify-center pulse-ring"
                  style="border-radius: 50%; border: 2px solid var(--accent); box-sizing: border-box; margin-top: 1px;"
                >
                  <span style="width: 6px; height: 6px; border-radius: 50%; background: var(--accent);"></span>
                </span>
                <div class="flex-1 min-w-0 flex flex-col gap-1">
                  <span
                    class="text-[14px] leading-[1.45] font-medium break-words"
                    style="color: var(--text-primary);"
                  >
                    {todo.title}
                  </span>
                  {#if todo.rationale}
                    <span
                      class="text-[12.5px] leading-[1.5] break-words"
                      style="color: var(--text-secondary);"
                    >
                      {todo.rationale}
                    </span>
                  {/if}
                </div>
              </div>
            {:else if s === "skipped"}
              <div class="flex gap-3 px-3 py-2.5">
                <span
                  class="w-[18px] h-[18px] shrink-0 flex items-center justify-center"
                  style="margin-top: 1px;"
                >
                  <span
                    style="width: 10px; height: 1.5px; border-radius: 1px; background: var(--text-tertiary);"
                  ></span>
                </span>
                <div class="flex-1 min-w-0 flex flex-col gap-1">
                  <span
                    class="text-[14px] leading-[1.45] break-words"
                    style="color: var(--text-tertiary); text-decoration: line-through; text-decoration-color: var(--border-strong);"
                  >
                    {todo.title}
                  </span>
                  {#if todo.rationale}
                    <span
                      class="text-[12.5px] leading-[1.5] break-words"
                      style="color: var(--text-tertiary);"
                    >
                      Skipped · {todo.rationale}
                    </span>
                  {/if}
                </div>
              </div>
            {:else}
              <div class="flex gap-3 px-3 py-2.5 pending-row">
                <span
                  class="w-[18px] h-[18px] shrink-0"
                  style="border-radius: 50%; border: 1.5px solid var(--border-strong); box-sizing: border-box; margin-top: 1px;"
                ></span>
                <div class="flex-1 min-w-0 flex flex-col gap-1">
                  <span
                    class="text-[14px] leading-[1.45] break-words"
                    style="color: var(--text-primary);"
                  >
                    {todo.title}
                  </span>
                  {#if todo.rationale}
                    <span
                      class="text-[12.5px] leading-[1.5] break-words"
                      style="color: var(--text-tertiary);"
                    >
                      {todo.rationale}
                    </span>
                  {/if}
                </div>
              </div>
            {/if}
          {/each}
        </div>
      </div>
    {:else}
      <div class="flex flex-col gap-4 px-5 py-6">
        <div
          class="p-[18px] flex flex-col gap-3.5"
          style="background: var(--bg-tertiary); border: 1px solid var(--border); border-radius: 14px;"
        >
          <div class="flex gap-3 items-start">
            <span
              class="w-7 h-7 shrink-0 flex items-center justify-center"
              style="border-radius: 8px; background: var(--warning-soft);"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" stroke-width="2" stroke-linecap="round">
                <path d="M12 8v5M12 16.5v.5" />
                <circle cx="12" cy="12" r="9.5" />
              </svg>
            </span>
            <div class="flex flex-col gap-1.5">
              <div
                class="text-[14px] font-medium leading-[1.45]"
                style="color: var(--text-primary);"
              >
                Planner unavailable — coding without a plan.
              </div>
              <div
                class="text-[13px] leading-[1.55]"
                style="color: var(--text-secondary);"
              >
                The agent is still building. Follow progress in the chat.
              </div>
            </div>
          </div>
          <div class="flex gap-2" style="padding-left: 40px;">
            <button
              type="button"
              class="retry-btn"
              on:click={() => dispatch("retry")}
            >
              Retry planning
            </button>
          </div>
        </div>
      </div>
    {/if}
  </div>

  {#if state === "empty" || state === "planning" || state === "error"}
    <div
      class="pane-footer"
      style="border-top: 1px solid var(--border); color: var(--text-tertiary);"
    >
      {#if state === "planning"}
        Usually takes a few seconds
      {:else}
        Once code is written, this becomes the live preview.
      {/if}
    </div>
  {/if}
</div>

<style>
  .planning-pane {
    height: 100%;
    width: 100%;
    border-radius: 18px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .pane-header {
    height: 60px;
    padding: 0 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex: none;
  }
  .pane-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }
  .pane-footer {
    padding: 16px 20px;
    font-size: 12px;
    line-height: 1.5;
    flex: none;
  }
  .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    animation: dot 1.4s ease-in-out infinite;
  }
  .shimmer-bar {
    height: 10px;
    border-radius: 5px;
    background: linear-gradient(
      90deg,
      var(--bg-tertiary) 0,
      var(--border) 50%,
      var(--bg-tertiary) 100%
    );
    background-size: 400px 100%;
    animation: shimmer 1.6s linear infinite;
  }
  .breathe {
    animation: breathe 1.8s ease-in-out infinite;
  }
  .pulse-ring {
    animation: pulse-ring 1.8s ease-out infinite;
  }
  .pending-row {
    border-radius: 10px;
    transition: background 150ms ease;
  }
  .pending-row:hover {
    background: var(--chrome-hover);
  }
  .retry-btn {
    height: 32px;
    padding: 0 14px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--bg-panel);
    color: var(--text-primary);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background 150ms ease;
  }
  .retry-btn:hover {
    background: var(--chrome-hover);
  }
  @keyframes dot {
    0%,
    100% {
      opacity: 0.3;
      transform: scale(0.85);
    }
    50% {
      opacity: 1;
      transform: scale(1);
    }
  }
  @keyframes shimmer {
    0% {
      background-position: -200px 0;
    }
    100% {
      background-position: 200px 0;
    }
  }
  @keyframes breathe {
    0%,
    100% {
      opacity: 0.35;
    }
    50% {
      opacity: 0.9;
    }
  }
  @keyframes pulse-ring {
    0% {
      box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.55);
    }
    70% {
      box-shadow: 0 0 0 7px rgba(59, 130, 246, 0);
    }
    100% {
      box-shadow: 0 0 0 0 rgba(59, 130, 246, 0);
    }
  }
</style>
