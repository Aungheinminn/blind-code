<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { auth } from "$lib/stores/auth";
  import {
    catalog,
    connectError,
    connectLoading,
    enabledModels,
    loadConnect,
    providersState,
    removeKey,
    saveEnabledModels,
    saveKey,
  } from "$lib/stores/connect";
  import type { ModelInfo, ProviderStatus } from "$lib/api/connect";

  type Tab = "keys" | "models";

  const TABS: Array<{ id: Tab; label: string }> = [
    { id: "keys", label: "Keys" },
    { id: "models", label: "Models" },
  ];

  let tab: Tab = "keys";
  let loaded = false;

  let editing: Record<string, boolean> = {};
  let keyDrafts: Record<string, string> = {};
  let showKey: Record<string, boolean> = {};
  let savingKey: Record<string, boolean> = {};
  let rowError: Record<string, string> = {};

  let selectedProvider: string = "";
  let modelFilter = "";
  let savingModels = false;

  onMount(() => {
    const initial = ($page.url.searchParams.get("tab") as Tab | null);
    if (initial === "keys" || initial === "models") tab = initial;
  });

  $: if ($auth.status === "authed" && !loaded) {
    loaded = true;
    loadConnect();
  }

  $: if (tab === "models" && !selectedProvider) {
    const firstConfigured = $providersState.find((p) => p.configured);
    if (firstConfigured) selectedProvider = firstConfigured.name;
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

  const toggleModel = async (provider: string, modelId: string) => {
    const current = new Set($enabledModels[provider] ?? []);
    if (current.has(modelId)) current.delete(modelId);
    else current.add(modelId);
    savingModels = true;
    try {
      await saveEnabledModels(provider, Array.from(current));
    } finally {
      savingModels = false;
    }
  };

  const filteredCatalog = (provider: string, filter: string): ModelInfo[] => {
    const list = $catalog[provider] ?? [];
    const q = filter.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (m) =>
        m.id.toLowerCase().includes(q) ||
        m.label.toLowerCase().includes(q) ||
        (m.tags ?? []).some((t) => t.toLowerCase().includes(q)),
    );
  };

  const sourceLabel = (p: ProviderStatus): string => {
    if (!p.configured) return "not connected";
    if (p.source === "env") return `from env · ••••${p.last4 ?? ""}`;
    return `••••${p.last4 ?? ""}`;
  };
</script>

<svelte:head>
  <title>Connect — Blind Code</title>
</svelte:head>

<div class="px-6 py-8">
  <div class="max-w-4xl mx-auto">
    <h1 class="text-2xl font-semibold">Connect</h1>
    <p class="mt-2 text-sm" style="color: var(--text-secondary);">
      Manage API keys and pick which models show up in the workspace.
    </p>

    <div class="mt-6 flex gap-1 border-b" style="border-color: var(--border);">
      {#each TABS as t (t.id)}
        <button
          type="button"
          class="px-4 py-2 text-sm cursor-pointer border-b-2 -mb-px"
          style={tab === t.id
            ? "border-color: var(--accent); color: var(--text-primary);"
            : "border-color: transparent; color: var(--text-tertiary);"}
          on:click={() => (tab = t.id)}
        >
          {t.label}
        </button>
      {/each}
    </div>

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
    {:else if tab === "keys"}
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
    {:else}
      <div class="mt-6 grid gap-4 md:grid-cols-[220px_1fr]">
        <aside
          class="rounded-lg border p-2"
          style="border-color: var(--border); background-color: var(--bg-secondary);"
        >
          {#each $providersState as p (p.name)}
            {@const count = ($enabledModels[p.name] ?? []).length}
            <button
              type="button"
              class="w-full text-left px-2.5 py-1.5 rounded-md text-sm cursor-pointer flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed"
              style={selectedProvider === p.name
                ? "background-color: var(--bg-tertiary); color: var(--text-primary);"
                : "background-color: transparent; color: var(--text-secondary);"}
              on:click={() => (selectedProvider = p.name)}
              disabled={!p.configured}
              title={p.configured ? "" : "Add a key first"}
            >
              <span class="capitalize">{p.name}</span>
              <span class="text-[11px]" style="color: var(--text-tertiary);">
                {p.configured ? count : "—"}
              </span>
            </button>
          {/each}
        </aside>

        <section>
          {#if !selectedProvider}
            <div class="text-sm" style="color: var(--text-tertiary);">
              Add an API key on the Keys tab, then pick a provider here.
            </div>
          {:else}
            <input
              type="text"
              bind:value={modelFilter}
              placeholder="filter…"
              class="w-full h-8 text-xs px-2.5 rounded-md border bg-transparent outline-none"
              style="border-color: var(--border); color: var(--text-primary); background-color: var(--bg-panel);"
            />
            <div class="mt-3 space-y-1">
              {#each filteredCatalog(selectedProvider, modelFilter) as m (m.id)}
                {@const checked = ($enabledModels[selectedProvider] ?? []).includes(m.id)}
                <label
                  class="flex items-center gap-3 px-3 py-2 rounded-md border cursor-pointer"
                  style={checked
                    ? "border-color: var(--accent); background-color: var(--bg-secondary);"
                    : "border-color: var(--border); background-color: transparent;"}
                >
                  <input
                    type="checkbox"
                    {checked}
                    disabled={savingModels}
                    on:change={() => toggleModel(selectedProvider, m.id)}
                  />
                  <div class="flex-1 min-w-0">
                    <div class="text-sm">{m.label}</div>
                    <div class="text-[11px] font-mono truncate" style="color: var(--text-tertiary);">
                      {m.id}
                    </div>
                  </div>
                  {#if m.tags}
                    <div class="flex gap-1 shrink-0">
                      {#each m.tags as tag}
                        <span
                          class="text-[10px] px-1.5 py-0.5 rounded"
                          style="background-color: var(--bg-tertiary); color: var(--text-secondary);"
                        >
                          {tag}
                        </span>
                      {/each}
                    </div>
                  {/if}
                </label>
              {:else}
                <div class="text-sm" style="color: var(--text-tertiary);">No matches.</div>
              {/each}
            </div>
          {/if}
        </section>
      </div>
    {/if}
  </div>
</div>
