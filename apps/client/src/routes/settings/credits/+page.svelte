<script lang="ts">
  import { onMount } from "svelte";
  import { auth } from "$lib/stores/auth";
  import {
    getCreditsBalance,
    listCreditsTransactions,
    purchaseCreditsPack,
    type CreditsTransaction,
  } from "$lib/api/credits";
  import { CREDIT_PACKS } from "$lib/creditPacks";
  import { creditsBalance as globalCreditsBalance } from "$lib/stores/agent";

  const PAGE_SIZE = 25;

  let balance: number | null = null;
  let transactions: CreditsTransaction[] = [];
  let offset = 0;
  let hasMore = true;
  let loading = true;
  let loadingMore = false;
  let error = "";
  let purchasing: Record<string, boolean> = {};

  const REASON_LABELS: Record<CreditsTransaction["reason"], string> = {
    signup_grant: "Signup grant",
    agent_run: "Agent run",
    manual_grant: "Manual grant",
    topup: "Top-up",
    refund: "Refund",
    adjustment: "Adjustment",
  };

  const load = async () => {
    loading = true;
    error = "";
    try {
      const [balanceRes, txRes] = await Promise.all([
        getCreditsBalance(),
        listCreditsTransactions({ limit: PAGE_SIZE, offset: 0 }),
      ]);
      balance = balanceRes?.balance ?? 0;
      transactions = txRes?.items ?? [];
      offset = transactions.length;
      hasMore = transactions.length === PAGE_SIZE;
    } catch (e) {
      error = e instanceof Error ? e.message : "Could not load credits.";
    } finally {
      loading = false;
    }
  };

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    loadingMore = true;
    try {
      const res = await listCreditsTransactions({ limit: PAGE_SIZE, offset });
      const items = res?.items ?? [];
      transactions = [...transactions, ...items];
      offset += items.length;
      hasMore = items.length === PAGE_SIZE;
    } catch (e) {
      error = e instanceof Error ? e.message : "Could not load more.";
    } finally {
      loadingMore = false;
    }
  };

  onMount(() => {
    if ($auth.status === "authed") load();
  });

  $: if ($auth.status === "authed" && loading && !error && transactions.length === 0) {
    load();
  }

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  const formatDelta = (n: number): string => (n >= 0 ? `+${n.toLocaleString()}` : n.toLocaleString());

  const purchase = async (packId: string) => {
    if (purchasing[packId]) return;
    purchasing[packId] = true;
    error = "";
    try {
      const res = await purchaseCreditsPack(packId);
      balance = res?.balance ?? balance;
      globalCreditsBalance.set(res?.balance ?? balance ?? 0);
      // Refresh transaction list to show the new topup row at top.
      const tx = await listCreditsTransactions({ limit: PAGE_SIZE, offset: 0 });
      transactions = tx?.items ?? [];
      offset = transactions.length;
      hasMore = transactions.length === PAGE_SIZE;
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
  <title>Credits — Blind Code</title>
</svelte:head>

<div>
  <h1 class="text-2xl font-semibold">Credits</h1>
  <p class="mt-2 text-sm" style="color: var(--text-secondary);">
    Credits are spent only when you run on Blind Code's platform keys. Running on your own API key is free.
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
      class="mt-6 rounded-xl border px-5 py-4"
      style="border-color: var(--border); background-color: var(--bg-secondary);"
    >
      <div class="text-[11px] uppercase tracking-wider" style="color: var(--text-tertiary);">
        Balance
      </div>
      <div class="mt-1 text-3xl font-semibold tabular-nums" style="color: var(--text-primary);">
        {(balance ?? 0).toLocaleString()}
        <span class="text-base font-normal" style="color: var(--text-tertiary);">credits</span>
      </div>
    </div>

    <h2 class="mt-8 text-sm font-semibold" style="color: var(--text-primary);">
      Top up
    </h2>
    <p class="mt-1 text-xs" style="color: var(--text-tertiary);">
      Credits never expire. Running on your own API key is always free — add one in
      <a href="/settings/providers" style="color: var(--accent);">Settings → Providers</a>.
    </p>

    <div class="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
      {#each CREDIT_PACKS as p (p.id)}
        <div
          class="rounded-xl border px-4 py-4 relative pack-card"
          class:pack-card--highlight={p.highlight}
          style="border-color: {p.highlight
            ? 'var(--accent)'
            : 'var(--border)'}; background-color: var(--bg-secondary);"
        >
          {#if p.highlight}
            <span
              class="absolute -top-2 left-4 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider text-white"
              style="background-color: var(--accent);"
            >
              Popular
            </span>
          {/if}
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
            class="mt-4 w-full px-3 py-2 rounded-md text-xs font-medium cursor-pointer disabled:opacity-50"
            style="background-color: {p.highlight
              ? 'var(--accent)'
              : 'var(--bg-tertiary)'}; color: {p.highlight ? 'white' : 'var(--text-primary)'}; border: 1px solid {p.highlight ? 'var(--accent)' : 'var(--border)'};"
            on:click={() => purchase(p.id)}
            disabled={purchasing[p.id]}
          >
            {purchasing[p.id] ? "Processing…" : "Purchase"}
          </button>
        </div>
      {/each}
    </div>

    <h2 class="mt-8 text-sm font-semibold" style="color: var(--text-primary);">
      Transactions
    </h2>

    {#if transactions.length === 0}
      <div class="mt-3 text-sm" style="color: var(--text-tertiary);">
        No transactions yet.
      </div>
    {:else}
      <div class="mt-3 space-y-1">
        {#each transactions as t (t.id)}
          <div
            class="rounded-lg border px-4 py-2.5 flex items-center justify-between gap-3 text-sm"
            style="border-color: var(--border); background-color: var(--bg-secondary);"
          >
            <div class="min-w-0 flex-1">
              <div class="font-medium" style="color: var(--text-primary);">
                {REASON_LABELS[t.reason] ?? t.reason}
              </div>
              <div class="text-[11px] mt-0.5" style="color: var(--text-tertiary);">
                {formatDate(t.createdAt)}
                {#if t.meta?.model}
                  &nbsp;·&nbsp;{t.meta.model}
                {/if}
                {#if t.meta?.inputTokens !== undefined && t.meta?.outputTokens !== undefined}
                  &nbsp;·&nbsp;{t.meta.inputTokens.toLocaleString()}&nbsp;in / {t.meta.outputTokens.toLocaleString()}&nbsp;out
                {/if}
              </div>
            </div>
            <div class="shrink-0 text-right">
              <div
                class="font-semibold tabular-nums"
                style="color: {t.delta >= 0 ? '#22c55e' : 'var(--text-primary)'};"
              >
                {formatDelta(t.delta)}
              </div>
              <div class="text-[11px] tabular-nums" style="color: var(--text-tertiary);">
                → {t.balanceAfter.toLocaleString()}
              </div>
            </div>
          </div>
        {/each}
      </div>

      {#if hasMore}
        <div class="mt-4 flex justify-center">
          <button
            type="button"
            class="px-3 py-1.5 rounded-md text-xs border cursor-pointer disabled:opacity-50"
            style="border-color: var(--border); color: var(--text-secondary); background-color: var(--bg-panel);"
            on:click={loadMore}
            disabled={loadingMore}
          >
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
      {/if}
    {/if}
  {/if}
</div>
