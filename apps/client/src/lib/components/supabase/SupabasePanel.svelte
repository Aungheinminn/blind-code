<script lang="ts">
  import { createEventDispatcher, onMount, tick } from "svelte";
  import {
    attachSupabaseProject,
    connectSupabase,
    disconnectSupabase,
    listAttachedSupabaseRefs,
    type PublicSupabaseIntegration,
  } from "$lib/api/projects";
  import type { SupabaseAccountProject } from "$lib/api/account";

  export let projectId: string;
  export let integration: PublicSupabaseIntegration | null = null;
  export let accountProjects: SupabaseAccountProject[] | null = null;
  export let loadingAccount = false;
  export let showClose = false;

  let attachedRefs = new Set<string>();

  onMount(async () => {
    try {
      const refs = await listAttachedSupabaseRefs();
      attachedRefs = new Set(refs ?? []);
    } catch {
      attachedRefs = new Set();
    }
  });

  $: selectableAccountProjects = (accountProjects ?? []).filter(
    (p) => p.id === integration?.projectRef || !attachedRefs.has(p.id),
  );

  const dispatch = createEventDispatcher<{
    close: void;
    changed: PublicSupabaseIntegration | null;
  }>();

  type Mode = "view" | "edit" | "select";
  const initialMode = (): Mode => {
    if (integration) return "view";
    return "select";
  };

  let mode: Mode = initialMode();
  let url = "";
  let anonKey = "";
  let serviceRoleKey = "";
  let databaseUrl = "";
  let selectedRef = "";
  let busy = false;
  let error = "";
  let urlInput: HTMLInputElement | undefined;

  const openEdit = async () => {
    mode = "edit";
    url = integration?.url ?? "";
    anonKey = integration?.anonKey ?? "";
    serviceRoleKey = "";
    databaseUrl = "";
    error = "";
    await tick();
    urlInput?.focus();
  };

  const openSelect = () => {
    mode = "select";
    error = "";
  };

  const cancel = () => {
    if (integration) {
      mode = "view";
      error = "";
    } else if (mode !== "select") {
      mode = "select";
      error = "";
    } else {
      dispatch("close");
    }
  };

  const attach = async () => {
    if (!selectedRef) {
      error = "Pick a Supabase project.";
      return;
    }
    busy = true;
    error = "";
    try {
      const updated = await attachSupabaseProject(projectId, selectedRef);
      const next = updated?.integrations?.supabase ?? null;
      dispatch("changed", next);
      if (next) {
        integration = next;
        mode = "view";
      }
    } catch (err) {
      error = err instanceof Error ? err.message : "Could not attach project.";
    } finally {
      busy = false;
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
        databaseUrl: databaseUrl.trim() || undefined,
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
      integration = null;
      mode = "edit";
      dispatch("changed", null);
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
</script>

<div class="px-5 pt-5 pb-4">
  <h2 class="text-base font-semibold">
    {#if mode === "view"}
      Supabase connected
    {:else if mode === "select"}
      Pick a Supabase project
    {:else if integration}
      Reconnect Supabase
    {:else}
      Connect Supabase
    {/if}
  </h2>
  <p class="mt-1 text-xs" style="color: var(--text-secondary);">
    {#if mode === "view"}
      This project's generated app talks to your Supabase database.
    {:else if mode === "select"}
      Choose one of your Supabase projects. Blind Code will fetch the API keys automatically.
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

{#if mode === "select"}
  <div class="px-5 pb-4 space-y-3">
    {#if loadingAccount}
      <div class="text-xs" style="color: var(--text-secondary);">
        Loading your Supabase projects…
      </div>
    {:else if selectableAccountProjects.length > 0}
      <label class="block text-xs font-medium" style="color: var(--text-secondary);">
        Supabase project
        <select
          bind:value={selectedRef}
          class="mt-1 w-full text-sm px-3 py-2 rounded-md border bg-transparent outline-none"
          style="border-color: var(--border); color: var(--text-primary); background-color: var(--bg-panel);"
        >
          <option value="">— select —</option>
          {#each selectableAccountProjects as p}
            <option value={p.id}>{p.name} ({p.region})</option>
          {/each}
        </select>
      </label>
    {:else if accountProjects && accountProjects.length > 0}
      <div class="text-xs" style="color: var(--text-secondary);">
        All your Supabase projects are already attached to other Blind Code projects. Detach one first, or
        <a
          href="https://supabase.com/dashboard/new"
          target="_blank"
          rel="noopener"
          style="color: var(--accent);"
        >create a new Supabase project</a>.
      </div>
    {:else}
      <div class="text-xs" style="color: var(--text-secondary);">
        No Supabase projects found on your account. Create one at
        <a
          href="https://supabase.com/dashboard/new"
          target="_blank"
          rel="noopener"
          style="color: var(--accent);"
        >supabase.com/dashboard/new</a>, then refresh this page.
      </div>
    {/if}

    <button
      type="button"
      class="text-xs underline cursor-pointer"
      style="color: var(--text-secondary); background: none; border: 0; padding: 0;"
      on:click={openEdit}
    >
      Or paste credentials manually →
    </button>

    {#if error}
      <div
        class="rounded-md border px-3 py-2 text-xs"
        style="border-color: #ef4444; color: #ef4444; background-color: rgba(239, 68, 68, 0.08);"
      >
        {error}
      </div>
    {/if}
  </div>
{:else if mode === "view" && integration}
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
        {integration.hasServiceRoleKey ? "Configured (server-side only)" : "Not configured"}
      </div>
    </div>
    <div>
      <div class="font-medium" style="color: var(--text-primary);">Table creation (run_sql)</div>
      <div class="mt-0.5">
        {#if integration.projectRef}
          Enabled — routed through the Supabase Management API using your account PAT. No database URL needed.
        {:else if integration.hasDatabaseUrl}
          Enabled — routed through the direct Postgres connection you provided.
        {:else}
          Not enabled. Attach this project via the /supabase page (recommended) or reconnect and paste a Postgres connection URL.
        {/if}
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
        placeholder="Optional — for privileged reads from server-side agent tools"
        class="mt-1 w-full text-xs font-mono px-3 py-2 rounded-md border bg-transparent outline-none resize-none"
        style="border-color: var(--border); color: var(--text-primary); background-color: var(--bg-panel);"
      ></textarea>
    </label>

    <label class="block text-xs font-medium" style="color: var(--text-secondary);">
      Database URL <span style="color: var(--text-secondary);">(optional)</span>
      <textarea
        rows="2"
        bind:value={databaseUrl}
        placeholder="postgresql://postgres.xxxx:password@aws-0-region.pooler.supabase.com:6543/postgres"
        class="mt-1 w-full text-xs font-mono px-3 py-2 rounded-md border bg-transparent outline-none resize-none"
        style="border-color: var(--border); color: var(--text-primary); background-color: var(--bg-panel);"
      ></textarea>
      <span class="mt-1 block" style="color: var(--text-secondary);">
        Supabase Dashboard → Project Settings → Database → Connection string.
        Required for AI to create tables. Stored server-side only.
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
      {#if showClose}
        <button
          type="button"
          class="px-3 py-2 rounded-md text-sm font-medium border cursor-pointer disabled:opacity-50"
          style="border-color: var(--border); color: var(--text-secondary); background-color: var(--bg-panel);"
          disabled={busy}
          on:click={() => dispatch("close")}
        >
          Close
        </button>
      {/if}
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
  {:else if mode === "select"}
    <button
      type="button"
      class="px-3 py-2 rounded-md text-sm font-medium border cursor-pointer disabled:opacity-50"
      style="border-color: var(--border); color: var(--text-secondary); background-color: var(--bg-panel);"
      disabled={busy}
      on:click={() => dispatch("close")}
    >
      Cancel
    </button>
    <button
      type="button"
      class="px-3 py-2 rounded-md text-sm font-medium text-white cursor-pointer disabled:opacity-50"
      style="background-color: var(--accent);"
      disabled={busy || !selectedRef}
      on:click={attach}
    >
      {busy ? "Attaching…" : "Attach"}
    </button>
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
