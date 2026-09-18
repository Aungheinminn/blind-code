<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import ProviderChip from "./ProviderChip.svelte";
  import PromptBox from "$lib/components/ui/PromptBox.svelte";

  export let prompt = "";
  export let busy = false;
  export let error = "";

  let box: PromptBox | undefined;

  const dispatch = createEventDispatcher<{ create: string }>();

  const suggestions: Array<{ name: string; prompt: string }> = [
    {
      name: "Habit tracker with streaks",
      prompt:
        "Build a habit tracker where the user can add habits, check them off each day, see current and longest streaks, and view a 7-day dot heatmap per habit. Persist state to localStorage.",
    },
    {
      name: "Team standup board",
      prompt:
        "Build a daily standup board with three columns per teammate: Yesterday, Today, and Blockers. Support adding/removing teammates and editing each field inline. Persist state to localStorage.",
    },
    {
      name: "Recipe finder",
      prompt:
        "Build a recipe finder. The user types an ingredient and sees matching mock recipes from a local list, each with a title, image placeholder, and cook time. Include a filter for recipes under 30 minutes.",
    },
  ];

  $: hintText = error
    ? error
    : prompt.trim()
      ? `${prompt.trim().length} characters`
      : "";
  $: canCreate = prompt.trim().length > 0 && !busy;

  const applySuggestion = (s: { name: string; prompt: string }) => {
    prompt = s.prompt;
    box?.autoGrow();
  };

  const onCreate = () => {
    if (!canCreate) return;
    dispatch("create", prompt.trim());
  };
</script>

<section class="flex flex-col gap-4">
  <PromptBox
    bind:this={box}
    bind:value={prompt}
    placeholder="Describe the app you want to build…"
    minHeight={96}
    maxHeight={320}
    size="md"
  >
    <svelte:fragment slot="left">
      <ProviderChip />
      {#if hintText}
        <span
          class="text-[12.5px] truncate"
          style="color: {error ? '#ef4444' : 'var(--text-tertiary)'};"
        >
          {hintText}
        </span>
      {/if}
    </svelte:fragment>

    <svelte:fragment slot="right">
      <a
        href="/projects"
        class="px-[18px] py-2.5 rounded-[10px] border no-underline text-[14.5px] font-medium view-projects-btn"
        style="border-color: var(--border); color: var(--text-secondary);"
      >
        View Projects
      </a>
      <button
        type="button"
        on:click={onCreate}
        disabled={!canCreate}
        class="px-[22px] py-[11px] rounded-[10px] border-0 text-[14.5px] font-semibold text-white create-btn"
        style="background-color: {canCreate ? 'var(--accent)' : 'var(--bg-tertiary)'}; color: {canCreate ? '#ffffff' : 'var(--text-tertiary)'}; cursor: {canCreate ? 'pointer' : 'not-allowed'};"
      >
        Create
      </button>
    </svelte:fragment>
  </PromptBox>

  <div class="flex gap-2 flex-wrap justify-center">
    {#each suggestions as s}
      <button
        type="button"
        on:click={() => applySuggestion(s)}
        class="px-[13px] py-[7px] rounded-full border text-[13px] cursor-pointer chip"
        style="background-color: var(--bg-secondary); border-color: var(--border); color: var(--text-secondary);"
      >
        {s.name}
      </button>
    {/each}
  </div>
</section>

<style>
  .view-projects-btn {
    transition: background-color 150ms ease, color 150ms ease, border-color 150ms ease;
  }
  .view-projects-btn:hover {
    background-color: var(--bg-tertiary);
    color: var(--text-primary);
    border-color: var(--border-strong);
  }
  .create-btn {
    transition: background-color 150ms ease;
  }
  .create-btn:not(:disabled):hover {
    background-color: var(--accent-hover) !important;
  }
  .chip {
    transition: color 150ms ease, border-color 150ms ease;
  }
  .chip:hover {
    color: var(--text-primary);
    border-color: var(--border-strong);
  }
</style>
