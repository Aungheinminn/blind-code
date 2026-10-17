<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import ProviderChip from "./ProviderChip.svelte";
  import DesignTemplatePicker from "$lib/components/workspace/agent/DesignTemplatePicker.svelte";
  import PromptBox from "$lib/components/ui/PromptBox.svelte";
  import Toggle from "$lib/components/ui/Toggle.svelte";
  import { auth } from "$lib/stores/auth";

  export let prompt = "";
  export let busy = false;
  export let error = "";
  export let selectedTemplateId: string | null = null;
  export let letAgentName = true;

  let box: PromptBox | undefined;
  let infoOpen = false;

  const closeInfoOnOutsideClick = (node: HTMLElement) => {
    const handler = (e: MouseEvent) => {
      if (!node.contains(e.target as Node)) infoOpen = false;
    };
    document.addEventListener("click", handler);
    return {
      destroy: () => document.removeEventListener("click", handler),
    };
  };

  const dispatch = createEventDispatcher<{
    create: string;
    "pick-template": string;
  }>();

  const suggestions: Array<{ name: string; prompt: string }> = [
    {
      name: "Habit tracker with streaks",
      prompt:
        "Build a habit tracker backed by a database that syncs across devices. Users add habits (name + color), check off today (re-click uncompletes), and remove habits with a confirm step and cascade-delete of check-ins. Current streak = consecutive days ending today; longest streak = max over all history. Day boundary is the user's local timezone. Check-ins are idempotent (unique on habit + date). Toggles are optimistic — update UI immediately, roll back and surface a non-blocking error on server rejection. Debounce rename edits by 400ms before persisting. Show a skeleton on initial load and a retry affordance on load failure.",
    },
    {
      name: "Team standup board",
      prompt:
        "Build a team daily standup board backed by a database so the whole team sees the same state. Entries are keyed by (teammate, date). Users add and remove teammates, and edit Yesterday / Today / Blockers inline. Autosave on blur with a 600ms debounce and expose save status (saving / saved / error). On concurrent edits to the same field, last write wins but surface a subtle 'updated by someone else' notice. Default view is today; a date picker browses past standups which are read-only once older than 7 days. Removing a teammate preserves their historical entries but hides them from the active board.",
    },
    {
      name: "Recipe finder",
      prompt:
        "Build a recipe finder backed by a database. Users add recipes (title, cook_time_minutes, image_url, ingredient list), search by ingredient with case-insensitive substring match, and toggle a 'under 30 minutes' filter that combines with search. Search input is debounced 250ms before querying. Results are paginated at 24 per page. Each recipe is deletable with a confirm step and cascade-delete of its ingredients. Validate image_url as a URL on submit; empty image_url is allowed and renders a placeholder. Store ingredient names normalized (trim + lowercase) for match; display original casing. All recipes save to the database and sync across devices.",
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
    submitOnEnter
    on:submit={onCreate}
  >
    <svelte:fragment slot="left">
      {#if $auth.status === "authed"}
        <DesignTemplatePicker
          placement="down"
          {selectedTemplateId}
          on:pick={(e) => dispatch("pick-template", e.detail.id)}
        />
      {/if}
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

  <div class="flex items-center justify-start gap-2.5 text-[13px]" style="color: var(--text-secondary);">
    <Toggle
      checked={letAgentName}
      size="sm"
      ariaLabel="Let the agent name the project"
      on:change={(e) => (letAgentName = e.detail)}
    />
    <span class="leading-none">Let the agent name the project</span>
    <div class="relative inline-flex items-center" use:closeInfoOnOutsideClick>
      <button
        type="button"
        on:click|stopPropagation={() => (infoOpen = !infoOpen)}
        aria-label="What does this do?"
        aria-expanded={infoOpen}
        class="info-btn"
        style="color: var(--text-tertiary);"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      </button>
      {#if infoOpen}
        <div
          class="info-badge"
          role="tooltip"
          style="background-color: var(--bg-panel); border-color: var(--border); color: var(--text-secondary);"
        >
          When on, the agent reads your prompt and generates a short project
          name — this uses a small amount of credits. When off, the project
          is named "Untitled Project" (free). You can rename it anytime from
          the workspace.
        </div>
      {/if}
    </div>
  </div>

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
  .info-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: pointer;
    border-radius: 9999px;
    transition: color 150ms ease;
    line-height: 0;
  }
  .info-btn:hover {
    color: var(--text-primary);
  }
  .info-badge {
    position: absolute;
    top: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
    width: 280px;
    padding: 8px 10px;
    border-radius: 8px;
    border: 1px solid;
    font-size: 12px;
    line-height: 1.4;
    text-align: left;
    z-index: 20;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
  }
</style>
