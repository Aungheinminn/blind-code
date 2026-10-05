<script lang="ts">
  import { onMount } from "svelte";
  import { auth } from "$lib/stores/auth";
  import {
    getAccountIntegrations,
    type PublicSupabaseAccountIntegration,
  } from "$lib/api/account";
  import AccountConnectCard from "$lib/components/supabase/AccountConnectCard.svelte";

  let integration: PublicSupabaseAccountIntegration | null = null;
  let platformFallbackAvailable = false;
  let loading = true;
  let error = "";

  const load = async () => {
    loading = true;
    error = "";
    try {
      const data = await getAccountIntegrations();
      integration = data?.supabase ?? null;
      platformFallbackAvailable = Boolean(data?.supabaseFallbackAvailable);
    } catch (e) {
      integration = null;
      error = e instanceof Error ? e.message : "Could not load Supabase account.";
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

  const onChanged = (e: CustomEvent<PublicSupabaseAccountIntegration | null>) => {
    integration = e.detail;
  };
</script>

<svelte:head>
  <title>Supabase — Blind Code</title>
</svelte:head>

<div>
  <h1 class="text-2xl font-semibold">Supabase</h1>
  <p class="mt-2 text-sm" style="color: var(--text-secondary);">
    Connect once with a Personal Access Token, then create or attach Supabase projects from the
    <a href="/supabase" style="color: var(--accent);">Bases</a> page.
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
    <div class="mt-6">
      <AccountConnectCard {integration} on:changed={onChanged} />
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
            Using platform Supabase
          </span>
        </div>
        <p class="mt-1.5 text-xs" style="color: var(--text-tertiary);">
          You haven't connected your own account. Blind Code will provision Supabase projects on your behalf. Connect your own PAT above to use your Supabase account instead.
        </p>
      </div>
    {/if}
  {/if}
</div>
