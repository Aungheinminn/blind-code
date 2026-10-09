<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { fly } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import type { ClarifyingQuestion } from "$lib/stores/agent";

  export let questions: ClarifyingQuestion[] = [];

  type Answer = { selected: string[]; custom: string };

  const dispatch = createEventDispatcher<{
    submit: { questions: ClarifyingQuestion[]; answers: Answer[] };
    dismiss: void;
  }>();

  let answers: Answer[] = questions.map(() => ({ selected: [], custom: "" }));
  let current = 0;

  $: total = questions.length;
  $: isLast = current === total - 1;
  $: currentQ = questions[current];
  $: currentA = answers[current];
  $: isAnswered =
    (currentA?.selected.length ?? 0) > 0 ||
    (currentA?.custom.trim() ?? "") !== "";

  const toggleOption = (opt: string) => {
    const a = answers[current];
    const q = questions[current];
    if (!a || !q) return;
    const allowMultiple = q.allow_multiple ?? false;
    if (a.selected.includes(opt)) {
      a.selected = a.selected.filter((o) => o !== opt);
    } else if (allowMultiple) {
      a.selected = [...a.selected, opt];
      a.custom = "";
    } else {
      a.selected = [opt];
      a.custom = "";
    }
    answers = answers;
  };

  const onCustom = (e: Event) => {
    const v = (e.target as HTMLInputElement).value;
    const a = answers[current];
    if (!a) return;
    a.custom = v;
    if (v.trim() !== "") a.selected = [];
    answers = answers;
  };

  const goBack = () => {
    if (current > 0) current -= 1;
  };

  const goNext = () => {
    if (isLast) {
      dispatch("submit", { questions, answers });
      return;
    }
    current += 1;
  };
</script>

<div
  class="rounded-[12px] border px-4 pt-3.5 pb-3.5"
  style="background-color: var(--bg-panel); border-color: var(--border);"
  transition:fly={{ y: 12, duration: 180, easing: cubicOut }}
>
  <div class="flex items-start gap-3 mb-3">
    <div
      class="mt-0.5 flex items-center justify-center rounded-md"
      style="width: 24px; height: 24px; background-color: var(--accent-weak, rgba(255,255,255,0.06)); color: var(--text-primary);"
    >
      <!-- help-circle -->
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    </div>
    <div class="flex-1 min-w-0">
      <div class="text-sm font-medium" style="color: var(--text-primary);">
        Clarifying questions
      </div>
      <div class="text-xs mt-0.5" style="color: var(--text-muted, #888);">
        Answer to help me build what you want.
      </div>
    </div>
    <span
      class="text-xs font-medium tabular-nums shrink-0 mt-0.5"
      style="color: var(--text-muted, #888);"
    >
      {current + 1}/{total}
    </span>
    <button
      type="button"
      class="ml-1 -mr-1 -mt-1 size-6 rounded hover:bg-[color:var(--hover,rgba(255,255,255,0.06))] flex items-center justify-center"
      style="color: var(--text-muted, #888);"
      aria-label="Skip all questions"
      on:click={() => dispatch("dismiss")}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  </div>

  <div class="flex gap-1 mb-3">
    {#each questions as _, i}
      <div
        class="h-1 flex-1 rounded-full"
        style="background-color: {i < current
          ? 'var(--accent, #e85c2a)'
          : i === current
          ? 'var(--accent-weak, rgba(232,92,42,0.6))'
          : 'var(--border)'};"
      ></div>
    {/each}
  </div>

  {#if currentQ}
    {#key current}
      <div
        class="rounded-lg border p-3 flex flex-col gap-2"
        style="background-color: var(--bg-elevated, rgba(255,255,255,0.03)); border-color: var(--border);"
        in:fly={{ x: 24, duration: 160, easing: cubicOut }}
      >
        <div class="text-sm font-medium" style="color: var(--text-primary);">
          {currentQ.question}
        </div>
        {#if currentQ.options && currentQ.options.length > 0}
          <div class="flex flex-col gap-1.5">
            {#each currentQ.options as opt (opt)}
              {@const checked = currentA?.selected.includes(opt) ?? false}
              <label
                class="flex items-start gap-2 text-sm cursor-pointer px-2 py-1.5 rounded hover:bg-[color:var(--hover,rgba(255,255,255,0.04))]"
                style="color: var(--text-secondary, var(--text-primary));"
              >
                <input
                  type={currentQ.allow_multiple ? "checkbox" : "radio"}
                  name={`q-${current}`}
                  checked={checked}
                  on:change={() => toggleOption(opt)}
                  class="mt-0.5 shrink-0 accent-[color:var(--accent,#e85c2a)]"
                />
                <span class="flex-1">{opt}</span>
              </label>
            {/each}
          </div>
        {/if}
        {#if currentQ.allow_custom !== false}
          <input
            type="text"
            placeholder="Or add your own answer"
            value={currentA?.custom ?? ""}
            on:input={onCustom}
            class="w-full text-sm rounded-md border px-2.5 py-1.5"
            style="background-color: var(--bg-panel); border-color: var(--border); color: var(--text-primary);"
          />
        {/if}
      </div>
    {/key}
  {/if}

  <div class="flex items-center justify-between gap-2 mt-3">
    <button
      type="button"
      class="text-xs font-medium px-2 py-1.5 rounded disabled:opacity-40"
      style="color: var(--text-muted, #888);"
      on:click={goBack}
      disabled={current === 0}
    >
      ← Back
    </button>
    <div class="flex items-center gap-2">
      <button
        type="button"
        class="text-xs font-medium px-3 py-1.5 rounded border"
        style="border-color: var(--border); color: var(--text-primary);"
        on:click={goNext}
      >
        {isLast ? "Skip & finish" : "Skip"}
      </button>
      <button
        type="button"
        class="text-xs font-medium px-3 py-1.5 rounded disabled:opacity-40"
        style="background-color: var(--accent, #e85c2a); color: white;"
        on:click={goNext}
        disabled={!isAnswered}
      >
        {isLast ? "✓ Submit" : "Next →"}
      </button>
    </div>
  </div>
</div>
