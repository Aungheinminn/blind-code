<script lang="ts">
  import { createEventDispatcher, tick } from "svelte";
  import {
    connectSupabase,
    disconnectSupabase,
    type PublicSupabaseIntegration,
  } from "$lib/api/projects";

  export let projectId: string;
  export let integration: PublicSupabaseIntegration | null = null;

  const dispatch = createEventDispatcher<{
    close: void;
    changed: PublicSupabaseIntegration | null;
  }>();

  let mode: "view" | "edit" = integration ? "view" : "edit";
  let url = "";
  let anonKey = "";
  let serviceRoleKey = "";
  let busy = false;
  let error = "";
  let urlInput: HTMLInputElement | undefined;

  const openEdit = async () => {
    mode = "edit";
    url = integration?.url ?? "";
    anonKey = integration?.anonKey ?? "";
    serviceRoleKey = "";
    error = "";
    await tick();
    urlInput?.focus();
  };

  const cancel = () => {
    if (integration) {
      mode = "view";
      error = "";
    } else {
      dispatch("close");
    }
  };

  const submit = async () => {
    error = "";
    if (!url.trim()) {
      error = "Supabase project URL is required.";
      return;
    }
    if (!anonKey.trim()) {
      error = "Anon key is required.";
      return;
    }
    busy = true;
    try {
      const updated = await connectSupabase(projectId, {
        url: url.trim(),
        anonKey: anonKey.trim(),
        serviceRoleKey: serviceRoleKey.trim() || undefined,
      });
      const next = updated?.integrations?.supabase ?? null;
      dispatch("changed", next);
      if (next) {
        integration = next;
        mode = "view";
      } else {
        dispatch("close");
      }
    } catch (err) {
      error = err instanceof Error ? err.message : "Could not save Supabase settings.";
    } finally {
      busy = false;
    }
  };

  const disconnect = async () => {
    busy = true;
    error = "";
    try {
      await disconnectSupabase(projectId);
      dispatch("changed", null);
      dispatch("close");
    } catch (err) {
      error = err instanceof Error ? err.message : "Could not disconnect.";
    } finally {
      busy = false;
    }
  };

  const maskKey = (key: string) => {
    if (!key) return "";
    if (key.length <= 12) return "•".repeat(key.length);
    return `${key.slice(0, 6)}…${key.slice(-6)}`;
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  $: if (integration && mode === "view") {
    error = "";
  }

  const onBackdropClick = () => {
    if (busy) return;
    dispatch("close");
  };
</script>

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-noninteractive-element-interactions -->
<div
  class="fixed inset-0 z-50 flex items-center justify-center px-4"
  style="background-color: rgba(0, 0, 0, 0.55);"
  on:click|self={onBackdropClick}
  role="dialog"
  aria-modal="true"
  aria-labelledby="supabase-modal-title"
  tabindex="-1"
>
  <div
    class="w-full max-w-md rounded-xl border shadow-xl"
    style="border-color: var(--border); background-color: var(--bg-secondary);"
  >
    <div class="px-5 pt-5 pb-4">
      <h2 id="supabase-modal-title" class="text-base font-semibold">
        {mode === "view" ? "Supabase connected" : integration ? "Reconnect Supabase" : "Connect Supabase"}
      </h2>
      <p class="mt-1 text-xs" style="color: var(--text-secondary);">
        {#if mode === "view"}
          This project's generated app talks to your Supabase database.
        {:else}
          Paste the values from
          <a
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noopener"
            style="color: var(--accent);"
          >Project Settings → API</a>.
        {/if}
      </p>
    </div>

    {#if mode === "view" && integration}
      <div class="px-5 pb-4 space-y-3 text-xs" style="color: var(--text-secondary);">
        <div>
          <div class="font-medium" style="color: var(--text-primary);">Project URL</div>
          <div class="mt-0.5 font-mono break-all">{integration.url}</div>
        </div>
        <div>
          <div class="font-medium" style="color: var(--text-primary);">Anon key</div>
          <div class="mt-0.5 font-mono">{maskKey(integration.anonKey)}</div>
        </div>
        <div>
          <div class="font-medium" style="color: var(--text-primary);">Service role key</div>
          <div class="mt-0.5">
            {integration.hasServiceRoleKey ? "Configured (server-side only)" : "Not configured — AI cannot create tables"}
          </div>
        </div>
        <div>
          <div class="font-medium" style="color: var(--text-primary);">Connected</div>
          <div class="mt-0.5">{formatDate(integration.connectedAt)}</div>
        </div>
      </div>
    {:else}
      <form on:submit|preventDefault={submit} class="px-5 pb-4 space-y-4">
        <label class="block text-xs font-medium" style="color: var(--text-secondary);">
          Project URL
          <input
            type="url"
            bind:this={urlInput}
            bind:value={url}
            placeholder="https://xxxxxxxx.supabase.co"
            required
            class="mt-1 w-full text-sm px-3 py-2 rounded-md border bg-transparent outline-none"
            style="border-color: var(--border); color: var(--text-primary); background-color: var(--bg-panel);"
          />
        </label>

        <label class="block text-xs font-medium" style="color: var(--text-secondary);">
          Anon public key
          <textarea
            rows="2"
            bind:value={anonKey}
            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…"
            required
            class="mt-1 w-full text-xs font-mono px-3 py-2 rounded-md border bg-transparent outline-none resize-none"
            style="border-color: var(--border); color: var(--text-primary); background-color: var(--bg-panel);"
          ></textarea>
        </label>

        <label class="block text-xs font-medium" style="color: var(--text-secondary);">
          Service role key <span style="color: var(--text-secondary);">(optional)</span>
          <textarea
            rows="2"
            bind:value={serviceRoleKey}
            placeholder="Optional — lets the AI create tables for you"
            class="mt-1 w-full text-xs font-mono px-3 py-2 rounded-md border bg-transparent outline-none resize-none"
            style="border-color: var(--border); color: var(--text-primary); background-color: var(--bg-panel);"
          ></textarea>
          <span class="mt-1 block" style="color: var(--text-secondary);">
            Stored server-side only. Never sent to the browser preview.
          </span>
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
    {/if}

    <div class="px-5 pb-5 flex items-center justify-between gap-2">
      {#if mode === "view" && integration}
        <button
          type="button"
          class="px-3 py-2 rounded-md text-sm font-medium border cursor-pointer disabled:opacity-50"
          style="border-color: #ef4444; color: #ef4444; background-color: transparent;"
          disabled={busy}
          on:click={disconnect}
        >
          {busy ? "Disconnecting…" : "Disconnect"}
        </button>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="px-3 py-2 rounded-md text-sm font-medium border cursor-pointer disabled:opacity-50"
            style="border-color: var(--border); color: var(--text-secondary); background-color: var(--bg-panel);"
            disabled={busy}
            on:click={() => dispatch("close")}
          >
            Close
          </button>
          <button
            type="button"
            class="px-3 py-2 rounded-md text-sm font-medium text-white cursor-pointer disabled:opacity-50"
            style="background-color: var(--accent);"
            disabled={busy}
            on:click={openEdit}
          >
            Reconnect
          </button>
        </div>
      {:else}
        <button
          type="button"
          class="px-3 py-2 rounded-md text-sm font-medium border cursor-pointer disabled:opacity-50"
          style="border-color: var(--border); color: var(--text-secondary); background-color: var(--bg-panel);"
          disabled={busy}
          on:click={cancel}
        >
          Cancel
        </button>
        <button
          type="button"
          class="px-3 py-2 rounded-md text-sm font-medium text-white cursor-pointer disabled:opacity-50"
          style="background-color: var(--accent);"
          disabled={busy || !url.trim() || !anonKey.trim()}
          on:click={submit}
        >
          {busy ? "Saving…" : integration ? "Save changes" : "Connect"}
        </button>
      {/if}
    </div>
  </div>
</div>
