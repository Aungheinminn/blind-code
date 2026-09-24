<script lang="ts">
  import { createEventDispatcher, tick } from "svelte";
  import { deleteAccount } from "$lib/api/auth";

  export let email: string;

  const dispatch = createEventDispatcher<{ close: void; deleted: void }>();

  let confirmText = "";
  let currentPassword = "";
  let busy = false;
  let error = "";
  let input: HTMLInputElement | undefined;

  const focusInput = async () => {
    await tick();
    input?.focus();
  };
  focusInput();

  $: canDelete = confirmText.trim() === email && currentPassword.length > 0 && !busy;

  const submit = async () => {
    if (!canDelete) return;
    busy = true;
    error = "";
    try {
      await deleteAccount(currentPassword);
      dispatch("deleted");
    } catch (err) {
      error = err instanceof Error ? err.message : "Could not delete account.";
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
  aria-labelledby="delete-account-title"
  tabindex="-1"
>
  <div
    class="w-full max-w-md rounded-xl border shadow-xl"
    style="border-color: var(--border); background-color: var(--bg-secondary);"
  >
    <div class="px-5 pt-5 pb-4">
      <h2 id="delete-account-title" class="text-base font-semibold" style="color: #ef4444;">
        Delete account
      </h2>
      <p class="mt-2 text-xs" style="color: var(--text-secondary);">
        Permanently deletes your account
        <span class="font-mono" style="color: var(--text-primary);">{email}</span>
        along with every project you own. All files, agent history, and
        integrations will be
        <span style="color: #ef4444;">gone and unrecoverable</span>.
      </p>
    </div>

    <form on:submit|preventDefault={submit} class="px-5 pb-4 space-y-3">
      <label class="block text-xs font-medium" style="color: var(--text-secondary);">
        Type <span class="font-mono" style="color: var(--text-primary);">{email}</span> to confirm
        <input
          type="text"
          bind:this={input}
          bind:value={confirmText}
          autocomplete="off"
          class="mt-1 w-full text-sm px-3 py-2 rounded-md border bg-transparent outline-none font-mono"
          style="border-color: var(--border); color: var(--text-primary); background-color: var(--bg-panel);"
        />
      </label>

      <label class="block text-xs font-medium" style="color: var(--text-secondary);">
        Current password
        <input
          type="password"
          bind:value={currentPassword}
          autocomplete="current-password"
          class="mt-1 w-full text-sm px-3 py-2 rounded-md border bg-transparent outline-none"
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
        {busy ? "Deleting…" : "Delete account"}
      </button>
    </div>
  </div>
</div>
