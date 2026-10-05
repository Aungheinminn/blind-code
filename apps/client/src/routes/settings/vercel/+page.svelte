<script lang="ts">
  import { onMount } from "svelte";
  import { auth } from "$lib/stores/auth";
  import {
    connectVercelAccount,
    disconnectVercelAccount,
    getAccountIntegrations,
    type PublicVercelAccountIntegration,
  } from "$lib/api/account";

  let integration: PublicVercelAccountIntegration | null = null;
  let platformFallbackAvailable = false;
  let loading = true;
  let busy = false;
  let error = "";
  let apiToken = "";

  const load = async () => {
    loading = true;
    error = "";
    try {
      const data = await getAccountIntegrations();
      integration = data?.vercel ?? null;
      platformFallbackAvailable = Boolean(data?.vercelFallbackAvailable);
    } catch (e) {
      integration = null;
      error = e instanceof Error ? e.message : "Could not load Vercel account.";
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
    const value = apiToken.trim();
    if (!value) {
      error = "Paste an API token.";
      return;
    }
    busy = true;
    error = "";
    try {
      const updated = await connectVercelAccount(value);
      integration = updated?.vercel ?? null;
      apiToken = "";
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
      await disconnectVercelAccount();
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
  <title>Vercel — Blind Code</title>
</svelte:head>

<div>
  <h1 class="text-2xl font-semibold">Vercel</h1>
  <p class="mt-2 text-sm" style="color: var(--text-secondary);">
    Connect a Vercel API token to deploy under your own Vercel account.
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
            <span
              class="w-2 h-2 rounded-full shrink-0"
              style="background-color: #22c55e;"
              aria-hidden="true"
            ></span>
            <div class="min-w-0">
              <div class="text-sm font-medium">
                Vercel account connected · ••••{integration.last4}
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
          <h2 class="text-sm font-semibold">Connect your Vercel account</h2>
          <p class="mt-1 text-xs" style="color: var(--text-secondary);">
            Paste an API token from
            <a
              href="https://vercel.com/account/settings/tokens"
              target="_blank"
              rel="noopener"
              style="color: var(--accent);"
            >vercel.com/account/settings/tokens</a>. We never show it back to you and store it server-side only.
          </p>
        </div>

        <form on:submit|preventDefault={submit} class="px-5 pb-4 space-y-3">
          <textarea
            rows="2"
            bind:value={apiToken}
            placeholder="vercel_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            required
            class="w-full text-xs font-mono px-3 py-2 rounded-md border bg-transparent outline-none resize-none"
            style="border-color: var(--border); color: var(--text-primary); background-color: var(--bg-panel);"
          ></textarea>

          <div class="flex items-center justify-end">
            <button
              type="submit"
              class="px-3 py-2 rounded-md text-sm font-medium text-white cursor-pointer disabled:opacity-50"
              style="background-color: var(--accent);"
              disabled={busy || !apiToken.trim()}
            >
              {busy ? "Connecting…" : "Connect"}
            </button>
          </div>
        </form>
      {/if}
    </div>

    {#if !integration && platformFallbackAvailable}
      <div
        class="mt-4 rounded-lg border px-4 py-3 text-sm"
        style="border-color: var(--border); background-color: var(--bg-secondary); color: var(--text-secondary);"
      >
        <div class="flex items-center gap-2">
          <span
            class="w-2 h-2 rounded-full shrink-0"
            style="background-color: var(--accent);"
            aria-hidden="true"
          ></span>
          <span class="text-[13px] font-medium" style="color: var(--text-primary);">
            Using platform Vercel
          </span>
        </div>
        <p class="mt-1.5 text-xs" style="color: var(--text-tertiary);">
          You haven't connected your own account. Deploys will go to Blind Code's Vercel. Connect your own token above to deploy under your own Vercel account instead.
        </p>
      </div>
    {/if}
  {/if}
</div>
