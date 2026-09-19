<script lang="ts">
  import { createEventDispatcher, tick } from "svelte";
  import {
    deleteAccountSupabaseProject,
    type SupabaseAccountProject,
  } from "$lib/api/account";

  export let supabaseProject: SupabaseAccountProject;
  export let attachedBcProjectName: string | null = null;

  const dispatch = createEventDispatcher<{
    close: void;
    deleted: { ref: string; detachedBcProjects: number };
  }>();

  let confirmText = "";
  let busy = false;
  let error = "";
  let input: HTMLInputElement | undefined;

  const focusInput = async () => {
    await tick();
    input?.focus();
  };
  focusInput();

  $: canDelete = confirmText.trim() === supabaseProject.name && !busy;

  const submit = async () => {
    if (!canDelete) return;
    busy = true;
    error = "";
    try {
      const result = await deleteAccountSupabaseProject(supabaseProject.id);
      dispatch("deleted", {
        ref: result.ref,
        detachedBcProjects: result.detachedBcProjects,
      });
    } catch (err) {
      error = err instanceof Error ? err.message : "Could not delete project.";
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
  aria-labelledby="delete-project-title"
  tabindex="-1"
>
  <div
    class="w-full max-w-md rounded-xl border shadow-xl"
    style="border-color: var(--border); background-color: var(--bg-secondary);"
  >
    <div class="px-5 pt-5 pb-4">
      <h2 id="delete-project-title" class="text-base font-semibold" style="color: #ef4444;">
        Delete Supabase project
      </h2>
      <p class="mt-2 text-xs" style="color: var(--text-secondary);">
        Permanently deletes <span class="font-mono" style="color: var(--text-primary);">{supabaseProject.name}</span>
        from your Supabase account. All tables, data, auth users, and storage in this project will be
        <span style="color: #ef4444;">gone and unrecoverable</span>.
      </p>
      {#if attachedBcProjectName}
        <p class="mt-2 text-xs" style="color: var(--text-secondary);">
          Blind Code project <span class="font-medium" style="color: var(--text-primary);">{attachedBcProjectName}</span>
          is currently attached to it. That attachment will be cleared so the Blind Code project doesn't point at a dead database.
        </p>
      {/if}
    </div>

    <form on:submit|preventDefault={submit} class="px-5 pb-4 space-y-3">
      <label class="block text-xs font-medium" style="color: var(--text-secondary);">
        Type <span class="font-mono" style="color: var(--text-primary);">{supabaseProject.name}</span> to confirm
        <input
          type="text"
          bind:this={input}
          bind:value={confirmText}
          autocomplete="off"
          class="mt-1 w-full text-sm px-3 py-2 rounded-md border bg-transparent outline-none font-mono"
          style="border-color: var(--border); color: var(--text-primary); background-color: var(--bg-panel);"
        />
      </label>

      {#if error}
        <div
          class="rounded-md border px-3 py-2 text-xs"
          style="border-color: #ef4444; color: #ef4444; background-color: rgba(239, 68, 68, 0.08);"
        >
          {error}
        </div>
      {/if}
    </form>

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
        style="background-color: #ef4444;"
        disabled={!canDelete}
        on:click={submit}
      >
        {busy ? "Deleting…" : "Delete project"}
      </button>
    </div>
  </div>
</div>
