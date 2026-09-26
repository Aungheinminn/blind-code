<script lang="ts">
  import { auth } from "$lib/stores/auth";
  import {
    connectError,
    connectLoading,
    loadConnect,
    providersState,
    removeKey,
    saveKey,
  } from "$lib/stores/connect";
  import type { ProviderStatus } from "$lib/api/connect";

  let loaded = false;

  let editing: Record<string, boolean> = {};
  let keyDrafts: Record<string, string> = {};
  let showKey: Record<string, boolean> = {};
  let savingKey: Record<string, boolean> = {};
  let rowError: Record<string, string> = {};

  $: if ($auth.status === "authed" && !loaded) {
    loaded = true;
    loadConnect();
  }

  const startEdit = (name: string) => {
    editing[name] = true;
    keyDrafts[name] = "";
    showKey[name] = false;
    rowError[name] = "";
  };

  const cancelEdit = (name: string) => {
    editing[name] = false;
    keyDrafts[name] = "";
    rowError[name] = "";
  };

  const submitKey = async (name: string) => {
    const value = (keyDrafts[name] ?? "").trim();
    if (!value) {
      rowError[name] = "enter a key first";
      return;
    }
    savingKey[name] = true;
    rowError[name] = "";
    try {
      await saveKey(name, value);
      editing[name] = false;
      keyDrafts[name] = "";
    } catch (e) {
      rowError[name] = e instanceof Error ? e.message : String(e);
    } finally {
      savingKey[name] = false;
    }
  };

  const clearKey = async (name: string) => {
    savingKey[name] = true;
    rowError[name] = "";
    try {
      await removeKey(name);
    } catch (e) {
      rowError[name] = e instanceof Error ? e.message : String(e);
    } finally {
      savingKey[name] = false;
    }
  };

  const sourceLabel = (p: ProviderStatus): string => {
    if (!p.configured) return "not connected";
    if (p.source === "env") return `from env · ••••${p.last4 ?? ""}`;
    return `••••${p.last4 ?? ""}`;
  };
</script>

<svelte:head>
  <title>Providers — Blind Code</title>
</svelte:head>

<div>
  <h1 class="text-2xl font-semibold">Providers</h1>
  <p class="mt-2 text-sm" style="color: var(--text-secondary);">
    Add an API key for each provider you want to use.
  </p>

  {#if $connectError}
    <div
      class="mt-6 rounded-lg border px-4 py-3 text-sm"
      style="border-color: #ef4444; color: #ef4444; background-color: rgba(239, 68, 68, 0.08);"
    >
      {$connectError}
    </div>
  {/if}

  {#if $connectLoading && $providersState.length === 0}
    <div class="mt-8 text-sm" style="color: var(--text-tertiary);">Loading…</div>
  {:else}
    <div class="mt-6 space-y-2">
      {#each $providersState as p (p.name)}
        <div
          class="rounded-lg border px-4 py-3"
          style="border-color: var(--border); background-color: var(--bg-secondary);"
        >
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-3 min-w-0">
              <span class="text-sm font-medium capitalize">{p.name}</span>
              <span class="text-[11px]" style="color: var(--text-tertiary);">
                {sourceLabel(p)}
              </span>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              {#if p.configured && p.source === "file"}
                <button
                  class="px-2.5 py-1.5 text-xs rounded-md border cursor-pointer"
                  style="border-color: var(--border); color: var(--text-secondary); background-color: var(--bg-tertiary);"
                  on:click={() => startEdit(p.name)}
                  disabled={savingKey[p.name]}
                >
                  Replace
                </button>
                <button
                  class="px-2.5 py-1.5 text-xs rounded-md border cursor-pointer"
                  style="border-color: var(--border); color: #ef4444; background-color: var(--bg-tertiary);"
                  on:click={() => clearKey(p.name)}
                  disabled={savingKey[p.name]}
                >
                  Remove
                </button>
              {:else if p.configured && p.source === "env"}
                <button
                  class="px-2.5 py-1.5 text-xs rounded-md border cursor-pointer"
                  style="border-color: var(--border); color: var(--text-secondary); background-color: var(--bg-tertiary);"
                  on:click={() => startEdit(p.name)}
                  disabled={savingKey[p.name]}
                >
                  Override
                </button>
              {:else}
                <button
                  class="px-2.5 py-1.5 text-xs rounded-md border cursor-pointer"
                  style="border-color: var(--border); color: var(--text-secondary); background-color: var(--bg-tertiary);"
                  on:click={() => startEdit(p.name)}
                  disabled={savingKey[p.name]}
                >
                  Add key
                </button>
              {/if}
            </div>
          </div>

          {#if editing[p.name]}
            <div class="mt-3 flex items-center gap-2">
              {#if showKey[p.name]}
                <input
                  type="text"
                  bind:value={keyDrafts[p.name]}
                  placeholder="paste API key"
                  autocomplete="off"
                  class="flex-1 min-w-0 h-8 text-xs px-2.5 rounded-md border bg-transparent outline-none"
                  style="border-color: var(--border); color: var(--text-primary); background-color: var(--bg-panel);"
                  on:keydown={(e) => e.key === "Enter" && submitKey(p.name)}
                />
              {:else}
                <input
                  type="password"
                  bind:value={keyDrafts[p.name]}
                  placeholder="paste API key"
                  autocomplete="off"
                  class="flex-1 min-w-0 h-8 text-xs px-2.5 rounded-md border bg-transparent outline-none"
                  style="border-color: var(--border); color: var(--text-primary); background-color: var(--bg-panel);"
                  on:keydown={(e) => e.key === "Enter" && submitKey(p.name)}
                />
              {/if}
              <button
                type="button"
                class="px-2 h-8 text-xs rounded-md border cursor-pointer"
                style="border-color: var(--border); color: var(--text-secondary); background-color: var(--bg-tertiary);"
                on:click={() => (showKey[p.name] = !showKey[p.name])}
              >
                {showKey[p.name] ? "Hide" : "Show"}
              </button>
              <button
                type="button"
                class="px-3 h-8 text-xs rounded-md text-white cursor-pointer disabled:opacity-50"
                style="background-color: var(--accent);"
                on:click={() => submitKey(p.name)}
                disabled={!keyDrafts[p.name]?.trim() || savingKey[p.name]}
              >
                {savingKey[p.name] ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                class="px-2 h-8 text-xs rounded-md border cursor-pointer"
                style="border-color: var(--border); color: var(--text-secondary); background-color: var(--bg-tertiary);"
                on:click={() => cancelEdit(p.name)}
                disabled={savingKey[p.name]}
              >
                Cancel
              </button>
            </div>
          {/if}

          {#if rowError[p.name]}
            <div class="mt-2 text-xs" style="color: #ef4444;">{rowError[p.name]}</div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>
