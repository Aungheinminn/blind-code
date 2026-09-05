<script lang="ts">
  import { createEventDispatcher, onDestroy } from "svelte";

  export let hidden = false;
  export let isRunning = false;

  const dispatch = createEventDispatcher<{ open: void }>();

  const steps = [
    "Reading your files",
    "Architecting the layout",
    "Writing components",
    "Wiring up the preview",
  ];
  const gerunds = ["Reading…", "Architecting…", "Writing…", "Wiring up…"];

  let step = 0;
  let hasRun = false;
  let timer: ReturnType<typeof setInterval> | null = null;

  const stopTimer = () => {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };

  $: if (isRunning) {
    hasRun = true;
    if (timer === null) {
      step = 0;
      timer = setInterval(() => {
        step = step >= steps.length - 1 ? 0 : step + 1;
      }, 2000);
    }
  } else {
    stopTimer();
    step = hasRun ? steps.length : 0;
  }

  $: finished = step >= steps.length;
  $: todos = steps.map((label, i) => {
    const done = i < step;
    const active = i === step && !finished;
    return { label, done, active };
  });
  $: statusText = finished ? "Complete" : isRunning ? gerunds[step] ?? "Working…" : "Idle";
  $: statusCount = `${Math.min(step, steps.length)}/${steps.length}`;

  onDestroy(stopTimer);
</script>

<button
  type="button"
  class="absolute left-4 bottom-4 z-20 w-[290px] max-w-[calc(100%-32px)] rounded-[14px] border flex flex-col overflow-hidden cursor-pointer text-left transition-all duration-200 launcher"
  style="border-color: var(--chrome-border); background: var(--chrome); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08); opacity: {hidden
    ? 0
    : 1}; pointer-events: {hidden ? 'none' : 'auto'}; transform: {hidden
    ? 'translateX(-8px)'
    : 'translateX(0)'};"
  on:click={() => dispatch("open")}
  aria-label="Open agent panel"
>
  <div class="flex flex-col gap-[9px] px-[14px] pt-[14px] pb-3">
    {#each todos as todo (todo.label)}
      <div class="flex items-center gap-[9px]">
        <div
          class="w-[15px] h-[15px] shrink-0 rounded-full flex items-center justify-center"
          class:pulse={todo.active}
          style="border: 1.5px solid {todo.done
            ? 'var(--success)'
            : todo.active
            ? 'var(--accent)'
            : 'var(--border-strong)'}; background: {todo.done ? 'var(--success)' : 'transparent'};"
        >
          {#if todo.done}
            <span class="text-[9px] font-extrabold text-white leading-none">✓</span>
          {/if}
        </div>
        <span
          class="text-[12.5px] font-medium truncate"
          style="color: {todo.done
            ? 'var(--text-tertiary)'
            : todo.active
            ? 'var(--text-primary)'
            : 'var(--text-tertiary)'}; text-decoration: {todo.done ? 'line-through' : 'none'};"
        >
          {todo.label}
        </span>
      </div>
    {/each}
  </div>

  <div
    class="flex items-center gap-[9px] px-[14px] py-[11px] border-t"
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
      class="text-[12.5px] font-semibold tracking-tight"
      style="color: {finished ? 'var(--success)' : 'var(--text-primary)'};"
    >
      {statusText}
    </span>
    <div class="flex-1"></div>
    <span class="text-[11px] font-medium" style="color: var(--text-tertiary);">
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
  .pulse {
    animation: launcher-pulse 1.2s ease-in-out infinite;
  }
  @keyframes launcher-spin {
    to {
      transform: rotate(360deg);
    }
  }
  @keyframes launcher-pulse {
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
