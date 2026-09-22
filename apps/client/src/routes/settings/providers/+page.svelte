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
    loadOpenRouterModels,
    openRouterError,
    openRouterFetchedAt,
    openRouterLoading,
    openRouterModels,
    providersState,
    removeKey,
    saveEnabledModels,
    saveKey,
  } from "$lib/stores/connect";
  import type { ModelInfo, OpenRouterModel, ProviderStatus } from "$lib/api/connect";

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

  const AVAILABLE_TAGS = ["free", "vision", "reasoning"] as const;
  let activeTags: Set<string> = new Set();
  const PAGE_SIZE = 25;
  let visibleCount = PAGE_SIZE;

  let customDraft = "";
  let addingCustom = false;
  let customError = "";

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

  $: if (selectedProvider) {
    modelFilter = "";
    activeTags = new Set();
    visibleCount = PAGE_SIZE;
    customDraft = "";
    customError = "";
  }

  $: if (
    selectedProvider === "openrouter" &&
    $openRouterModels.length === 0 &&
    !$openRouterLoading &&
    !$openRouterError
  ) {
    loadOpenRouterModels();
  }

  const toggleTag = (tag: string) => {
    const next = new Set(activeTags);
    if (next.has(tag)) next.delete(tag);
    else next.add(tag);
    activeTags = next;
    visibleCount = PAGE_SIZE;
  };

  const filterList = <T extends ModelInfo>(list: T[], query: string, tags: Set<string>): T[] => {
    const q = query.trim().toLowerCase();
    return list.filter((m) => {
      if (tags.size > 0) {
        const modelTags = m.tags ?? [];
        for (const tag of tags) {
          if (!modelTags.includes(tag as "fast" | "reasoning" | "vision" | "free")) return false;
        }
      }
      if (!q) return true;
      return (
        m.id.toLowerCase().includes(q) ||
        m.label.toLowerCase().includes(q) ||
        (m.tags ?? []).some((t) => t.toLowerCase().includes(q))
      );
    });
  };

  const augmentWithCustom = (list: ModelInfo[], provider: string): ModelInfo[] => {
    const enabled = $enabledModels[provider] ?? [];
    const known = new Set(list.map((m) => m.id));
    const extras: ModelInfo[] = enabled
      .filter((id) => !known.has(id))
      .map((id) => ({ id, label: id }));
    return [...extras, ...list];
  };

  const submitCustom = async () => {
    const id = customDraft.trim();
    if (!id || !selectedProvider) return;
    const current = $enabledModels[selectedProvider] ?? [];
    if (current.includes(id)) {
      customError = "already enabled";
      return;
    }
    addingCustom = true;
    customError = "";
    try {
      await saveEnabledModels(selectedProvider, [...current, id]);
      customDraft = "";
    } catch (e) {
      customError = e instanceof Error ? e.message : String(e);
    } finally {
      addingCustom = false;
    }
  };

  const formatFetchedAt = (ts: number | null): string => {
    if (!ts) return "";
    const diff = Date.now() - ts;
    if (diff < 60_000) return "just now";
    const mins = Math.floor(diff / 60_000);
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  };

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
      <div class="mt-6 grid gap-4 md:grid-cols-[220px_1fr] items-start">
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
            {@const isOpenRouter = selectedProvider === "openrouter"}
            {@const baseList = isOpenRouter
              ? $openRouterModels
              : ($catalog[selectedProvider] ?? [])}
            {@const sourceList = augmentWithCustom(baseList, selectedProvider)}
            {@const filtered = filterList(sourceList, modelFilter, activeTags)}
            {@const visible = filtered.slice(0, visibleCount)}

            <div class="flex items-center gap-2">
              <input
                type="text"
                bind:value={modelFilter}
                placeholder="filter…"
                class="flex-1 min-w-0 h-8 text-xs px-2.5 rounded-md border bg-transparent outline-none"
                style="border-color: var(--border); color: var(--text-primary); background-color: var(--bg-panel);"
              />
              {#if isOpenRouter}
                <button
                  type="button"
                  class="h-8 px-2.5 text-xs rounded-md border cursor-pointer disabled:opacity-50"
                  style="border-color: var(--border); color: var(--text-secondary); background-color: var(--bg-tertiary);"
                  on:click={() => loadOpenRouterModels(true)}
                  disabled={$openRouterLoading}
                  title={$openRouterFetchedAt ? `updated ${formatFetchedAt($openRouterFetchedAt)}` : ""}
                >
                  {$openRouterLoading ? "…" : "Refresh"}
                </button>
              {/if}
            </div>

            <div class="mt-2 flex items-center gap-2 flex-wrap">
              {#each AVAILABLE_TAGS as tag (tag)}
                {@const active = activeTags.has(tag)}
                <button
                  type="button"
                  class="text-[11px] px-2 py-1 rounded cursor-pointer border"
                  style={active
                    ? "border-color: var(--accent); color: var(--accent); background-color: transparent;"
                    : "border-color: var(--border); color: var(--text-tertiary); background-color: var(--bg-tertiary);"}
                  on:click={() => toggleTag(tag)}
                >
                  {tag}
                </button>
              {/each}
              <div class="ml-auto text-[11px]" style="color: var(--text-tertiary);">
                {filtered.length} {filtered.length === 1 ? "model" : "models"}
                {#if isOpenRouter && $openRouterFetchedAt}
                  · updated {formatFetchedAt($openRouterFetchedAt)}
                {/if}
              </div>
            </div>

            {#if $openRouterError && isOpenRouter}
              <div
                class="mt-3 rounded-md border px-3 py-2 text-xs"
                style="border-color: #ef4444; color: #ef4444; background-color: rgba(239, 68, 68, 0.08);"
              >
                {$openRouterError}
              </div>
            {/if}

            {#if isOpenRouter && $openRouterLoading && sourceList.length === 0}
              <div class="mt-6 text-sm" style="color: var(--text-tertiary);">
                Fetching models…
              </div>
            {:else}
              <div class="mt-3 space-y-1">
                {#each visible as m (m.id)}
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
              {#if filtered.length > visibleCount}
                <button
                  type="button"
                  class="mt-3 w-full text-xs py-2 rounded-md border cursor-pointer"
                  style="border-color: var(--border); color: var(--text-secondary); background-color: var(--bg-tertiary);"
                  on:click={() => (visibleCount += PAGE_SIZE)}
                >
                  Load {Math.min(PAGE_SIZE, filtered.length - visibleCount)} more
                </button>
              {/if}
            {/if}

            <div
              class="mt-4 pt-4 border-t"
              style="border-color: var(--border);"
            >
              <div
                class="text-[11px] uppercase tracking-wider font-semibold mb-2"
                style="color: var(--text-tertiary);"
              >
                Custom model id
              </div>
              <div class="flex items-center gap-2">
                <input
                  type="text"
                  bind:value={customDraft}
                  placeholder="e.g. gpt-4-turbo-2024-04-09"
                  autocomplete="off"
                  class="flex-1 min-w-0 h-8 text-xs px-2.5 rounded-md border bg-transparent outline-none font-mono"
                  style="border-color: var(--border); color: var(--text-primary); background-color: var(--bg-panel);"
                  on:keydown={(e) => e.key === "Enter" && submitCustom()}
                />
                <button
                  type="button"
                  class="h-8 px-3 text-xs rounded-md text-white cursor-pointer disabled:opacity-50"
                  style="background-color: var(--accent);"
                  on:click={submitCustom}
                  disabled={!customDraft.trim() || addingCustom}
                >
                  {addingCustom ? "…" : "Add"}
                </button>
              </div>
              {#if customError}
                <div class="mt-2 text-xs" style="color: #ef4444;">{customError}</div>
              {/if}
              <div class="mt-2 text-[11px]" style="color: var(--text-tertiary);">
                Not validated — the id must match what the provider accepts.
              </div>
            </div>
          {/if}
        </section>
      </div>
    {/if}
</div>
