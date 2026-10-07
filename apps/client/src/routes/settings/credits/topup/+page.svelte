<script lang="ts">
  import { onMount } from "svelte";
  import { auth } from "$lib/stores/auth";
  import {
    getCreditsBalance,
    purchaseCreditsPack,
  } from "$lib/api/credits";
  import { CREDIT_PACKS } from "$lib/creditPacks";
  import { creditsBalance as globalCreditsBalance } from "$lib/stores/agent";

  let balance: number | null = null;
  let loading = true;
  let error = "";
  let purchasing: Record<string, boolean> = {};
  let justPurchased: Record<string, boolean> = {};

  const load = async () => {
    loading = true;
    error = "";
    try {
      const res = await getCreditsBalance();
      balance = res?.balance ?? 0;
    } catch (e) {
      error = e instanceof Error ? e.message : "Could not load balance.";
    } finally {
      loading = false;
    }
  };

  onMount(() => {
    if ($auth.status === "authed") load();
  });

  $: if ($auth.status === "authed" && loading && !error) load();

  const purchase = async (packId: string) => {
    if (purchasing[packId]) return;
    purchasing[packId] = true;
    error = "";
    try {
      const res = await purchaseCreditsPack(packId);
      balance = res?.balance ?? balance;
      globalCreditsBalance.set(res?.balance ?? balance ?? 0);
      justPurchased[packId] = true;
      setTimeout(() => {
        justPurchased[packId] = false;
      }, 1800);
    } catch (e) {
      error = e instanceof Error ? e.message : "Purchase failed.";
    } finally {
      purchasing[packId] = false;
    }
  };

  const pricePerThousand = (p: { credits: number; priceUsd: number }): string =>
    `$${((p.priceUsd / p.credits) * 1000).toFixed(2)}/1K`;
</script>

<svelte:head>
  <title>Top up — Blind Code</title>
</svelte:head>

<div>
  <div class="flex items-center gap-2 text-xs" style="color: var(--text-tertiary);">
    <a href="/settings/credits" class="back-link">← Credits</a>
  </div>

  <h1 class="mt-2 text-2xl font-semibold">Top up</h1>
  <p class="mt-2 text-sm" style="color: var(--text-secondary);">
    Credits never expire. Running on your own API key is always free — add one in
    <a href="/settings/providers" style="color: var(--accent);">Settings → Providers</a>.
  </p>

  {#if error}
    <div
      class="mt-6 rounded-lg border px-4 py-3 text-sm"
      style="border-color: #ef4444; color: #ef4444; background-color: rgba(239, 68, 68, 0.08);"
    >
      {error}
    </div>
  {/if}

  {#if !loading}
    <div
      class="mt-6 rounded-lg border px-4 py-3 text-sm"
      style="border-color: var(--border); background-color: var(--bg-secondary); color: var(--text-secondary);"
    >
      <span>Current balance:</span>
      <strong class="tabular-nums" style="color: var(--text-primary);">
        {(balance ?? 0).toLocaleString()}
      </strong>
      credits
    </div>
  {/if}

  <div class="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
    {#each CREDIT_PACKS as p (p.id)}
      <div
        class="rounded-xl border px-4 py-4"
        style="border-color: var(--border); background-color: var(--bg-secondary);"
      >
        <div class="flex items-baseline justify-between gap-2">
          <div class="text-sm font-semibold" style="color: var(--text-primary);">
            {p.name}
          </div>
          <div class="text-[11px] tabular-nums" style="color: var(--text-tertiary);">
            {pricePerThousand(p)}
          </div>
        </div>
        <div class="mt-2 flex items-baseline gap-1.5">
          <div class="text-2xl font-semibold tabular-nums" style="color: var(--text-primary);">
            ${p.priceUsd}
          </div>
          <div class="text-[12px]" style="color: var(--text-tertiary);">
            · {p.credits.toLocaleString()} credits
          </div>
        </div>
        {#if p.tagline}
          <p class="mt-2 text-xs" style="color: var(--text-secondary);">
            {p.tagline}
          </p>
        {/if}
        <button
          type="button"
          class="purchase-btn mt-4 w-full"
          class:purchase-btn--success={justPurchased[p.id]}
          on:click={() => purchase(p.id)}
          disabled={purchasing[p.id]}
        >
          {#if justPurchased[p.id]}
            Added ✓
          {:else if purchasing[p.id]}
            Processing…
          {:else}
            Purchase
          {/if}
        </button>
      </div>
    {/each}
  </div>
</div>

<style>
  .back-link {
    color: var(--text-tertiary);
    text-decoration: none;
    transition: color 150ms ease;
  }
  .back-link:hover {
    color: var(--text-primary);
  }
  .purchase-btn {
    padding: 8px 12px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background-color: var(--bg-tertiary);
    color: var(--text-primary);
    font-size: 12px;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    transition:
      background-color 150ms ease,
      border-color 150ms ease,
      color 150ms ease,
      transform 120ms ease;
  }
  .purchase-btn:hover:not(:disabled):not(.purchase-btn--success) {
    background-color: var(--accent);
    border-color: var(--accent);
    color: white;
    transform: translateY(-1px);
  }
  .purchase-btn:active:not(:disabled) {
    transform: none;
  }
  .purchase-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .purchase-btn--success {
    background-color: color-mix(in srgb, #22c55e 18%, transparent);
    border-color: color-mix(in srgb, #22c55e 55%, transparent);
    color: #22c55e;
    cursor: default;
  }
</style>
