<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import {
    attachSupabaseProject,
    type Project,
  } from "$lib/api/projects";
  import type { SupabaseAccountProject } from "$lib/api/account";

  export let supabaseProject: SupabaseAccountProject;
  export let bcProjects: Project[] = [];

  const dispatch = createEventDispatcher<{
    close: void;
    attached: { bcProjectId: string };
  }>();

  let selectedBcId = "";
  let busy = false;
  let error = "";

  $: candidates = bcProjects.filter(
    (p) => !p.integrations?.supabase || p.integrations.supabase.projectRef === supabaseProject.id,
  );

  const submit = async () => {
    if (!selectedBcId) {
      error = "Pick a Blind Code project.";
      return;
    }
    busy = true;
    error = "";
    try {
      await attachSupabaseProject(selectedBcId, supabaseProject.id);
      dispatch("attached", { bcProjectId: selectedBcId });
    } catch (err) {
      error = err instanceof Error ? err.message : "Could not attach.";
    } finally {
      busy = false;
    }
  };

  const close = () => {
    if (busy) return;
    dispatch("close");
  };
</script>

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-noninteractive-element-interactions -->
<div
  class="fixed inset-0 z-50 flex items-center justify-center px-4"
  style="background-color: rgba(0, 0, 0, 0.55);"
  on:click|self={close}
  role="dialog"
  aria-modal="true"
  aria-labelledby="attach-modal-title"
  tabindex="-1"
>
  <div
    class="w-full max-w-md rounded-xl border shadow-xl"
    style="border-color: var(--border); background-color: var(--bg-secondary);"
  >
    <div class="px-5 pt-5 pb-4">
      <h2 id="attach-modal-title" class="text-base font-semibold">
        Attach “{supabaseProject.name}”
      </h2>
      <p class="mt-1 text-xs" style="color: var(--text-secondary);">
        Pick a Blind Code project. Its generated app will start talking to this Supabase database.
      </p>
    </div>

    <div class="px-5 pb-4 space-y-3">
      {#if candidates.length === 0}
        <div class="text-xs" style="color: var(--text-secondary);">
          Every Blind Code project already has a Supabase attached. Detach one first, or create a new project.
        </div>
      {:else}
        <label class="block text-xs font-medium" style="color: var(--text-secondary);">
          Blind Code project
          <select
            bind:value={selectedBcId}
            class="mt-1 w-full text-sm px-3 py-2 rounded-md border bg-transparent outline-none"
            style="border-color: var(--border); color: var(--text-primary); background-color: var(--bg-panel);"
          >
            <option value="">— select —</option>
            {#each candidates as p}
              <option value={p.id}>
                {p.name}{p.integrations?.supabase?.projectRef === supabaseProject.id ? " (already attached — will refresh keys)" : ""}
              </option>
            {/each}
          </select>
        </label>
      {/if}

      {#if error}
        <div
          class="rounded-md border px-3 py-2 text-xs"
          style="border-color: #ef4444; color: #ef4444; background-color: rgba(239, 68, 68, 0.08);"
        >
          {error}
        </div>
      {/if}
    </div>

    <div class="px-5 pb-5 flex items-center justify-end gap-2">
      <button
        type="button"
        class="px-3 py-2 rounded-md text-sm font-medium border cursor-pointer disabled:opacity-50"
        style="border-color: var(--border); color: var(--text-secondary); background-color: var(--bg-panel);"
        disabled={busy}
        on:click={close}
      >
        Cancel
      </button>
      <button
        type="button"
        class="px-3 py-2 rounded-md text-sm font-medium text-white cursor-pointer disabled:opacity-50"
        style="background-color: var(--accent);"
        disabled={busy || !selectedBcId || candidates.length === 0}
        on:click={submit}
      >
        {busy ? "Attaching…" : "Attach"}
      </button>
    </div>
  </div>
</div>
