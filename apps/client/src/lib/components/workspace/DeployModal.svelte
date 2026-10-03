<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount } from "svelte";
  import {
    checkVercelDeploymentStatus,
    startVercelDeploy,
    type PublicVercelIntegration,
  } from "$lib/api/projects";

  export let projectId: string;
  export let vercel: PublicVercelIntegration | null = null;

  const dispatch = createEventDispatcher<{
    close: void;
    deployed: PublicVercelIntegration | null;
  }>();

  type Status = "idle" | "verifying" | "deploying" | "success" | "error";

  let status: Status = vercel?.projectId ? "verifying" : "idle";
  let error = "";
  let justDeployedUrl = "";
  let copied = false;

  let pollTimer: ReturnType<typeof setTimeout> | null = null;

  const cancelPoll = () => {
    if (pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
  };

  const applyIntegration = (next: PublicVercelIntegration | null) => {
    dispatch("deployed", next);
    vercel = next;
  };

  const pollOnce = async () => {
    try {
      const res = await checkVercelDeploymentStatus(projectId);
      if (res?.active?.status === "ready") {
        justDeployedUrl = res.active.url;
        if (res.integration) applyIntegration(res.integration);
        status = "success";
        return;
      }
      if (res?.active?.status === "error") {
        error = res.active.error || "Deployment failed";
        status = "error";
        return;
      }
      if (res?.active?.status === "deploying") {
        pollTimer = setTimeout(pollOnce, 2500);
        return;
      }
      if (status === "deploying") {
        error = "Deployment status lost";
        status = "error";
      }
    } catch (e) {
      pollTimer = setTimeout(pollOnce, 3500);
    }
  };

  onMount(async () => {
    try {
      const res = await checkVercelDeploymentStatus(projectId);
      applyIntegration(res?.integration ?? null);
      if (res?.active?.status === "deploying") {
        status = "deploying";
        pollTimer = setTimeout(pollOnce, 2000);
        return;
      }
      if (res?.active?.status === "ready") {
        justDeployedUrl = res.active.url;
        status = "success";
        return;
      }
    } catch {}
    if (status === "verifying") status = "idle";
  });

  onDestroy(cancelPoll);

  $: currentUrl = justDeployedUrl || vercel?.productionUrl || "";
  $: busy = status === "deploying" || status === "verifying";
  $: hasConfirmedProject =
    status !== "verifying" && !!vercel?.projectName;

  const formatRelative = (iso?: string): string => {
    if (!iso) return "";
    const diffMs = Date.now() - new Date(iso).getTime();
    const s = Math.max(1, Math.round(diffMs / 1000));
    if (s < 60) return `${s}s ago`;
    const m = Math.round(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.round(h / 24);
    return `${d}d ago`;
  };

  const onBackdropClick = () => {
    if (busy) return;
    dispatch("close");
  };

  const onDeploy = async () => {
    cancelPoll();
    status = "deploying";
    error = "";
    try {
      await startVercelDeploy(projectId);
      pollTimer = setTimeout(pollOnce, 2000);
    } catch (e) {
      error = e instanceof Error ? e.message : "Deployment failed";
      status = "error";
    }
  };

  const onCopy = async () => {
    if (!currentUrl) return;
    try {
      await navigator.clipboard.writeText(currentUrl);
      copied = true;
      setTimeout(() => (copied = false), 1500);
    } catch {}
  };
</script>

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-noninteractive-element-interactions -->
<div
  class="fixed inset-0 z-50 flex items-center justify-center px-4"
  style="background-color: rgba(0, 0, 0, 0.55);"
  on:click|self={onBackdropClick}
  role="dialog"
  aria-modal="true"
  aria-labelledby="deploy-modal-title"
  tabindex="-1"
>
  <div
    class="w-full max-w-md rounded-xl border shadow-xl p-6"
    style="border-color: var(--border); background-color: var(--bg-secondary);"
  >
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h2
          id="deploy-modal-title"
          class="text-base font-semibold"
          style="color: var(--text-primary);"
        >
          Deploy to Vercel
        </h2>
        {#if hasConfirmedProject}
          <p class="mt-0.5 text-xs truncate" style="color: var(--text-tertiary);">
            Project: <span style="color: var(--text-secondary);">{vercel?.projectName}</span>
            {#if vercel?.lastDeployedAt && status === "idle"}
              · last deployed {formatRelative(vercel.lastDeployedAt)}
            {/if}
          </p>
        {/if}
      </div>
      <button
        type="button"
        class="close-btn"
        aria-label="Close"
        title="Close"
        on:click={() => dispatch("close")}
        disabled={busy}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>

    {#if status === "verifying"}
      <div class="mt-6 flex flex-col items-center gap-3 py-6">
        <div class="spinner" aria-hidden="true"></div>
        <p class="text-sm" style="color: var(--text-secondary);">
          Checking deployment status…
        </p>
      </div>
    {:else if status === "deploying"}
      <div class="mt-6 flex flex-col items-center gap-3 py-6">
        <div class="rocket-spinner" aria-hidden="true">
          <div class="spinner-ring"></div>
          <div class="rocket-stack">
            <svg
              class="rocket-icon"
              width="20"
              height="26"
              viewBox="0 0 24 32"
              fill="currentColor"
            >
              <path d="M12 1c-2.2 2-4.5 5.5-4.5 10.5V22h9V11.5C16.5 6.5 14.2 3 12 1z" />
              <circle cx="12" cy="11" r="1.6" fill="#0b0b0b" />
              <path d="M7.5 17L4 22l3.5-0.5z" />
              <path d="M16.5 17L20 22l-3.5-0.5z" />
            </svg>
            <div class="flame">
              <span class="flame-outer"></span>
              <span class="flame-inner"></span>
            </div>
          </div>
        </div>
        <p class="text-sm" style="color: var(--text-secondary);">
          Building &amp; deploying your app…
        </p>
        <p class="text-xs" style="color: var(--text-tertiary);">
          Usually takes 30–90 seconds
        </p>
      </div>
    {:else if status === "success"}
      <div class="mt-5 space-y-4">
        <div
          class="rounded-lg border px-3 py-2 text-sm break-all"
          style="border-color: var(--border); background-color: var(--bg-primary); color: var(--text-primary);"
        >
          <a href={currentUrl} target="_blank" rel="noopener noreferrer" style="color: var(--accent);">
            {currentUrl}
          </a>
        </div>
        <div class="flex gap-2">
          <a
            href={currentUrl}
            target="_blank"
            rel="noopener noreferrer"
            class="flex-1 text-center rounded-md px-3 py-2 text-sm font-medium"
            style="background-color: var(--accent); color: #fff;"
          >
            Open site
          </a>
          <button
            type="button"
            on:click={onCopy}
            class="rounded-md border px-3 py-2 text-sm"
            style="border-color: var(--border); color: var(--text-primary);"
          >
            {copied ? "Copied" : "Copy URL"}
          </button>
          <button
            type="button"
            on:click={onDeploy}
            class="rounded-md border px-3 py-2 text-sm"
            style="border-color: var(--border); color: var(--text-primary);"
          >
            Re-deploy
          </button>
        </div>
      </div>
    {:else if status === "error"}
      <div class="mt-5 space-y-3">
        <div
          class="rounded-lg border px-3 py-2 text-sm"
          style="border-color: #ef4444; color: #ef4444; background-color: rgba(239,68,68,0.08);"
        >
          {error}
        </div>
        <button
          type="button"
          on:click={onDeploy}
          class="w-full rounded-md px-3 py-2 text-sm font-medium"
          style="background-color: var(--accent); color: #fff;"
        >
          Retry
        </button>
      </div>
    {:else}
      <div class="mt-5 space-y-4">
        {#if currentUrl}
          <div>
            <div class="text-xs mb-1" style="color: var(--text-tertiary);">
              Current deployment
            </div>
            <div
              class="rounded-lg border px-3 py-2 text-sm break-all"
              style="border-color: var(--border); background-color: var(--bg-primary); color: var(--text-primary);"
            >
              <a href={currentUrl} target="_blank" rel="noopener noreferrer" style="color: var(--accent);">
                {currentUrl}
              </a>
            </div>
          </div>
        {:else}
          <p class="text-sm" style="color: var(--text-secondary);">
            Ship your app to a public URL on Vercel. Takes about a minute.
          </p>
        {/if}
        <button
          type="button"
          on:click={onDeploy}
          class="w-full rounded-md px-3 py-2 text-sm font-medium"
          style="background-color: var(--accent); color: #fff;"
        >
          {currentUrl ? "Re-deploy" : "Deploy"}
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  .close-btn {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--text-tertiary);
    background: transparent;
    border: none;
    cursor: pointer;
    transition: background 150ms ease, color 150ms ease;
  }
  .close-btn:hover:not(:disabled) {
    background: var(--chrome-hover);
    color: var(--text-primary);
  }
  .close-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .spinner {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 2px solid var(--border);
    border-top-color: var(--accent);
    animation: spin 0.9s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  .rocket-spinner {
    position: relative;
    width: 56px;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .spinner-ring {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: 2px solid var(--border);
    border-top-color: #22c55e;
    animation: spin 0.9s linear infinite;
  }
  .rocket-stack {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0;
    animation: rocket-bob 1.4s ease-in-out infinite;
  }
  .rocket-icon {
    color: #22c55e;
    filter: drop-shadow(0 1px 3px rgba(34, 197, 94, 0.4));
  }
  .flame {
    position: relative;
    width: 12px;
    height: 14px;
    margin-top: -2px;
    display: flex;
    justify-content: center;
  }
  .flame-outer,
  .flame-inner {
    position: absolute;
    top: 0;
    border-radius: 50% 50% 50% 50% / 25% 25% 75% 75%;
    transform-origin: center top;
  }
  .flame-outer {
    width: 10px;
    height: 14px;
    background: linear-gradient(
      to bottom,
      #fde68a 0%,
      #fb923c 50%,
      #ef4444 90%,
      transparent 100%
    );
    animation: flicker 0.22s ease-in-out infinite alternate;
    opacity: 0.95;
  }
  .flame-inner {
    width: 5px;
    height: 8px;
    background: linear-gradient(
      to bottom,
      #ffffff 0%,
      #fef3c7 55%,
      #fbbf24 100%
    );
    animation: flicker 0.18s ease-in-out infinite alternate-reverse;
  }
  @keyframes rocket-bob {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-2px);
    }
  }
  @keyframes flicker {
    from {
      transform: scaleY(1) scaleX(1);
      opacity: 0.9;
    }
    to {
      transform: scaleY(1.3) scaleX(0.8);
      opacity: 1;
    }
  }
</style>
