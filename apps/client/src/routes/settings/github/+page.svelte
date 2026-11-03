<script lang="ts">
  import { onMount } from "svelte";
  import { auth } from "$lib/stores/auth";
  import {
    connectGitHubAccount,
    disconnectGitHubAccount,
    getAccountIntegrations,
    type PublicGitHubAccountIntegration,
  } from "$lib/api/account";

  let integration: PublicGitHubAccountIntegration | null = null;
  let loading = true;
  let busy = false;
  let error = "";
  let accessToken = "";

  const load = async () => {
    loading = true;
    error = "";
    try {
      const data = await getAccountIntegrations();
      integration = data?.github ?? null;
    } catch (e) {
      integration = null;
      error = e instanceof Error ? e.message : "Could not load GitHub account.";
    } finally {
      loading = false;
    }
  };

  onMount(() => {
    if ($auth.status === "authed") load();
  });

  $: if ($auth.status === "authed" && loading && !integration && !error) {
    load();
  }

  const submit = async () => {
    const value = accessToken.trim();
    if (!value) {
      error = "Paste a personal access token.";
      return;
    }
    busy = true;
    error = "";
    try {
      const updated = await connectGitHubAccount(value);
      integration = updated?.github ?? null;
      accessToken = "";
    } catch (e) {
      error = e instanceof Error ? e.message : "Could not save token.";
    } finally {
      busy = false;
    }
  };

  const disconnect = async () => {
    busy = true;
    error = "";
    try {
      await disconnectGitHubAccount();
      integration = null;
    } catch (e) {
      error = e instanceof Error ? e.message : "Could not disconnect.";
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

<svelte:head>
  <title>GitHub — Blind Code</title>
</svelte:head>

<div>
  <h1 class="text-2xl font-semibold">GitHub</h1>
  <p class="mt-2 text-sm" style="color: var(--text-secondary);">
    Connect a GitHub personal access token to push your projects to your own repositories.
  </p>

  {#if error}
    <div
      class="mt-6 rounded-lg border px-4 py-3 text-sm"
      style="border-color: #ef4444; color: #ef4444; background-color: rgba(239, 68, 68, 0.08);"
    >
      {error}
    </div>
  {/if}

  {#if loading}
    <div class="mt-8 text-sm" style="color: var(--text-tertiary);">Loading…</div>
  {:else}
    <div
      class="mt-6 rounded-xl border shadow-sm"
      style="border-color: var(--border); background-color: var(--bg-secondary);"
    >
      {#if integration}
        <div class="flex items-center justify-between gap-3 px-4 py-3">
          <div class="flex items-center gap-3 min-w-0">
            {#if integration.avatarUrl}
              <img
                src={integration.avatarUrl}
                alt=""
                class="w-7 h-7 rounded-full shrink-0"
              />
            {:else}
              <span
                class="w-2 h-2 rounded-full shrink-0"
                style="background-color: #22c55e;"
                aria-hidden="true"
              ></span>
            {/if}
            <div class="min-w-0">
              <div class="text-sm font-medium">
                Connected as
                <a
                  href={`https://github.com/${integration.login}`}
                  target="_blank"
                  rel="noopener"
                  style="color: var(--accent);"
                >@{integration.login}</a>
                · ••••{integration.last4}
              </div>
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
      {:else}
        <div class="px-5 pt-4 pb-3">
          <h2 class="text-sm font-semibold">Connect your GitHub account</h2>
          <p class="mt-1 text-xs" style="color: var(--text-secondary);">
            Create a fine-grained token at
            <a
              href="https://github.com/settings/personal-access-tokens/new"
              target="_blank"
              rel="noopener"
              style="color: var(--accent);"
            >github.com/settings/personal-access-tokens</a>. We never show it back to you and store it encrypted server-side.
          </p>
          <ul class="mt-2 text-xs list-disc pl-5 space-y-0.5" style="color: var(--text-secondary);">
            <li>Repository access: <b>All repositories</b> (or the ones you want Blind Code to push to)</li>
            <li>Contents: <b>Read and write</b></li>
            <li>Administration: <b>Read and write</b> — only needed to create new repos from Blind Code</li>
          </ul>
        </div>

        <form on:submit|preventDefault={submit} class="px-5 pb-4 space-y-3">
          <textarea
            rows="2"
            bind:value={accessToken}
            placeholder="github_pat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            required
            class="w-full text-xs font-mono px-3 py-2 rounded-md border bg-transparent outline-none resize-none"
            style="border-color: var(--border); color: var(--text-primary); background-color: var(--bg-panel);"
          ></textarea>

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
  {/if}
</div>
