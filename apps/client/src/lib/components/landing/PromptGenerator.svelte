<script lang="ts">
  let prompt = "";

  const suggestions = [
    "Habit tracker with streaks",
    "Team standup board",
    "Recipe finder",
  ];

  $: hintText = prompt.trim()
    ? `${prompt.trim().length} characters`
    : "Press Create to scaffold a new project";
  $: canCreate = prompt.trim().length > 0;

  const applySuggestion = (label: string) => {
    prompt = label;
  };

  const onCreate = () => {
    // TODO: wire to createProject + navigate to workspace
  };
</script>

<section class="flex flex-col gap-4">
  <div
    class="rounded-2xl border p-4 flex flex-col gap-3"
    style="border-color: var(--border); background-color: var(--bg-panel); box-shadow: 0 20px 50px -30px rgba(0, 0, 0, 0.9);"
  >
    <textarea
      rows="4"
      bind:value={prompt}
      placeholder="Describe the app you want to build…"
      class="w-full resize-y min-h-24 bg-transparent border-0 outline-none text-base leading-[1.55] px-1 pt-1"
      style="color: var(--text-primary);"
    ></textarea>

    <div class="flex items-center justify-between gap-3 flex-wrap">
      <span class="text-[12.5px]" style="color: var(--text-tertiary);">
        {hintText}
      </span>
      <div class="flex items-center gap-2.5">
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
      </div>
    </div>
  </div>

  <div class="flex gap-2 flex-wrap justify-center">
    {#each suggestions as label}
      <button
        type="button"
        on:click={() => applySuggestion(label)}
        class="px-[13px] py-[7px] rounded-full border text-[13px] cursor-pointer chip"
        style="background-color: var(--bg-secondary); border-color: var(--border); color: var(--text-secondary);"
      >
        {label}
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
