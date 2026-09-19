<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { goto } from "$app/navigation";
  import type { SupabaseAccountProject } from "$lib/api/account";

  export let supabaseProject: SupabaseAccountProject;
  export let attachedBcProject: { id: string; name: string } | null = null;

  const dispatch = createEventDispatcher<{
    attach: SupabaseAccountProject;
  }>();

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return "";
    }
  };

  const handleClick = () => {
    if (attachedBcProject) {
      goto(`/supabase/${attachedBcProject.id}`);
    } else {
      dispatch("attach", supabaseProject);
    }
  };

  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
  role="button"
  tabindex="0"
  class="card"
  on:click={handleClick}
  on:keydown={handleKeydown}
>
  <div class="flex items-start justify-between gap-2">
    <div class="min-w-0 flex-1">
      <div class="text-sm font-medium truncate">{supabaseProject.name}</div>
      <div class="mt-1 text-[11px] font-mono truncate" style="color: var(--text-tertiary);">
        {supabaseProject.id}
      </div>
    </div>
    {#if supabaseProject.status}
      <span
        class="text-[10px] px-1.5 py-0.5 rounded"
        style="background-color: var(--bg-tertiary); color: var(--text-tertiary);"
        title={supabaseProject.status}
      >
        {supabaseProject.status.replace(/^ACTIVE_/, "").replace(/_/g, " ").toLowerCase()}
      </span>
    {/if}
  </div>

  <div class="mt-3 flex items-center gap-3 text-[11px]" style="color: var(--text-secondary);">
    <span>{supabaseProject.region}</span>
    <span aria-hidden="true">·</span>
    <span>Created {formatDate(supabaseProject.created_at)}</span>
  </div>

  <div class="mt-3 flex items-center justify-between gap-2">
    {#if attachedBcProject}
      <span class="attach-badge attached">
        <span class="dot"></span>
        Attached to <span class="font-medium truncate max-w-[10rem]">{attachedBcProject.name}</span>
      </span>
      <span class="text-[11px]" style="color: var(--accent);">Manage →</span>
    {:else}
      <span class="attach-badge unattached">Not attached</span>
      <span class="text-[11px]" style="color: var(--accent);">Attach →</span>
    {/if}
  </div>
</div>

<style>
  .card {
    display: block;
    text-align: left;
    padding: 14px;
    border-radius: 12px;
    border: 1px solid var(--border);
    background-color: var(--bg-secondary);
    color: var(--text-primary);
    cursor: pointer;
    transition: border-color 150ms ease, transform 150ms ease;
  }
  .card:hover {
    border-color: var(--border-strong, var(--accent));
    transform: translateY(-1px);
  }
  .card:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .attach-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 8px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 500;
    border: 1px solid var(--border);
    background-color: var(--bg-panel);
    color: var(--text-secondary);
  }
  .attach-badge.attached {
    color: #16a34a;
    border-color: rgba(34, 197, 94, 0.35);
    background-color: rgba(34, 197, 94, 0.08);
  }
  .attach-badge.attached .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: #22c55e;
  }
</style>
