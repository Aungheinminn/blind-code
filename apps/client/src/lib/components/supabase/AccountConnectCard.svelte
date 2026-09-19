<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import {
    connectSupabaseAccount,
    disconnectSupabaseAccount,
    type PublicSupabaseAccountIntegration,
  } from "$lib/api/account";

  export let integration: PublicSupabaseAccountIntegration | null = null;

  const dispatch = createEventDispatcher<{
    changed: PublicSupabaseAccountIntegration | null;
  }>();

  let accessToken = "";
  let busy = false;
  let error = "";

  const submit = async () => {
    error = "";
    if (!accessToken.trim()) {
      error = "Paste a Personal Access Token.";
      return;
    }
    busy = true;
    try {
      const updated = await connectSupabaseAccount(accessToken.trim());
      const next = updated?.supabase ?? null;
      integration = next;
      accessToken = "";
      dispatch("changed", next);
    } catch (err) {
      error = err instanceof Error ? err.message : "Could not save token.";
    } finally {
      busy = false;
    }
  };

  const disconnect = async () => {
    busy = true;
    error = "";
    try {
      await disconnectSupabaseAccount();
      integration = null;
      dispatch("changed", null);
    } catch (err) {
      error = err instanceof Error ? err.message : "Could not disconnect.";
    } finally {
      busy = false;
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };
</script>

<div
  class="rounded-xl border shadow-sm"
  style="border-color: var(--border); background-color: var(--bg-secondary);"
>
  {#if integration}
    <div class="flex items-center justify-between gap-3 px-4 py-3">
      <div class="flex items-center gap-3 min-w-0">
        <span
          class="w-2 h-2 rounded-full shrink-0"
          style="background-color: #22c55e;"
          aria-hidden="true"
        ></span>
        <div class="min-w-0">
          <div class="text-sm font-medium">Supabase account connected</div>
          <div class="text-[11px] mt-0.5" style="color: var(--text-secondary);">
            Since {formatDate(integration.connectedAt)}
          </div>
        </div>
      </div>
      <button
        type="button"
        class="px-3 py-1.5 rounded-md text-xs font-medium border cursor-pointer disabled:opacity-50"
        style="border-color: var(--border); color: var(--text-secondary); background-color: var(--bg-panel);"
        disabled={busy}
        on:click={disconnect}
      >
        {busy ? "Disconnecting…" : "Disconnect"}
      </button>
    </div>
    {#if error}
      <div
        class="mx-4 mb-3 rounded-md border px-3 py-2 text-xs"
        style="border-color: #ef4444; color: #ef4444; background-color: rgba(239, 68, 68, 0.08);"
      >
        {error}
      </div>
    {/if}
  {:else}
    <div class="px-5 pt-4 pb-3">
      <h2 class="text-sm font-semibold">Connect your Supabase account</h2>
      <p class="mt-1 text-xs" style="color: var(--text-secondary);">
        One-time setup. Paste a Personal Access Token from
        <a
          href="https://supabase.com/dashboard/account/tokens"
          target="_blank"
          rel="noopener"
          style="color: var(--accent);"
        >supabase.com/dashboard/account/tokens</a>. We never show it back to you and store it server-side only.
      </p>
    </div>

    <form on:submit|preventDefault={submit} class="px-5 pb-4 space-y-3">
      <textarea
        rows="2"
        bind:value={accessToken}
        placeholder="sbp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
        required
        class="w-full text-xs font-mono px-3 py-2 rounded-md border bg-transparent outline-none resize-none"
        style="border-color: var(--border); color: var(--text-primary); background-color: var(--bg-panel);"
      ></textarea>

      {#if error}
        <div
          class="rounded-md border px-3 py-2 text-xs"
          style="border-color: #ef4444; color: #ef4444; background-color: rgba(239, 68, 68, 0.08);"
        >
          {error}
        </div>
      {/if}

      <div class="flex items-center justify-end">
        <button
          type="submit"
          class="px-3 py-2 rounded-md text-sm font-medium text-white cursor-pointer disabled:opacity-50"
          style="background-color: var(--accent);"
          disabled={busy || !accessToken.trim()}
        >
          {busy ? "Connecting…" : "Connect"}
        </button>
      </div>
    </form>
  {/if}
</div>
