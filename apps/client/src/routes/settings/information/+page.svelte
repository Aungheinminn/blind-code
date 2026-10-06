<script lang="ts">
  import { onMount } from "svelte";
  import { auth } from "$lib/stores/auth";
  import { getAccountIntegrations } from "$lib/api/account";

  let supabaseFallback = false;
  let vercelFallback = false;
  let loading = true;
  let error = "";

  const load = async () => {
    loading = true;
    error = "";
    try {
      const data = await getAccountIntegrations();
      supabaseFallback = Boolean(data?.supabaseFallbackAvailable);
      vercelFallback = Boolean(data?.vercelFallbackAvailable);
    } catch (e) {
      error = e instanceof Error ? e.message : "Could not load status.";
    } finally {
      loading = false;
    }
  };

  onMount(() => {
    if ($auth.status === "authed") load();
  });

  $: if ($auth.status === "authed" && loading && !error) load();

  type Card = {
    title: string;
    status: "available" | "unavailable" | "neutral";
    statusLabel: string;
    body: string;
  };

  $: cards = [
    {
      title: "Providers (Anthropic, OpenAI, Google, OpenRouter)",
      status: "neutral",
      statusLabel: "Cascade: your key → default",
      body:
        "When you add a key in Settings → Providers, Blind Code uses it. If you haven't, we fall back to our default for that provider (when one is configured). Open the model picker in the composer to switch between Auto, Yours, and Default for a single prompt.",
    } satisfies Card,
    {
      title: "Supabase",
      status: supabaseFallback ? "available" : "unavailable",
      statusLabel: supabaseFallback
        ? "Platform fallback available"
        : "Platform fallback not configured",
      body: supabaseFallback
        ? "If you haven't connected your own account, Blind Code will auto-provision Supabase projects for you on its own account whenever the agent needs a database."
        : "No platform Supabase account is configured. Connect your own Personal Access Token in Settings → Supabase so the agent can create a database for you.",
    } satisfies Card,
    {
      title: "Vercel",
      status: vercelFallback ? "available" : "unavailable",
      statusLabel: vercelFallback
        ? "Platform fallback available"
        : "Platform fallback not configured",
      body: vercelFallback
        ? "If you haven't connected your own account, deploys go to Blind Code's Vercel. Connect your own token in Settings → Vercel to deploy under your own account instead."
        : "No platform Vercel account is configured. Connect your own API token in Settings → Vercel to enable deploys.",
    } satisfies Card,
  ];

  const dotColor = (s: Card["status"]): string =>
    s === "available" ? "var(--accent)" : s === "unavailable" ? "#eab308" : "#22c55e";
</script>

<svelte:head>
  <title>Information — Blind Code</title>
</svelte:head>

<div>
  <h1 class="text-2xl font-semibold">Information</h1>
  <p class="mt-2 text-sm" style="color: var(--text-secondary);">
    How Blind Code uses your keys and when platform defaults apply.
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
    <div class="mt-6 space-y-3">
      {#each cards as c (c.title)}
        <div
          class="rounded-lg border px-4 py-3 text-sm"
          style="border-color: var(--border); background-color: var(--bg-secondary);"
        >
          <div class="flex items-center gap-2">
            <span
              class="w-2 h-2 rounded-full shrink-0"
              style="background-color: {dotColor(c.status)};"
              aria-hidden="true"
            ></span>
            <span class="text-[13px] font-medium" style="color: var(--text-primary);">
              {c.title}
            </span>
          </div>
          <div class="mt-0.5 ml-4 text-[11px]" style="color: var(--text-tertiary);">
            {c.statusLabel}
          </div>
          <p class="mt-2 text-xs leading-relaxed" style="color: var(--text-secondary);">
            {c.body}
          </p>
        </div>
      {/each}
    </div>
  {/if}
</div>
