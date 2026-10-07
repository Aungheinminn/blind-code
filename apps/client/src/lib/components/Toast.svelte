<script lang="ts">
  import { dismissToast, toasts, type ToastKind } from "$lib/stores/toast";

  const accent = (kind: ToastKind): string => {
    switch (kind) {
      case "success":
        return "#22c55e";
      case "error":
        return "#ef4444";
      default:
        return "var(--accent)";
    }
  };
</script>

{#if $toasts.length > 0}
  <div class="toast-stack" role="status" aria-live="polite">
    {#each $toasts as t (t.id)}
      <div
        class="toast"
        style="border-left: 3px solid {accent(t.kind)}; background-color: var(--bg-panel); border-color: var(--border); color: var(--text-primary);"
      >
        <span class="flex-1">{t.message}</span>
        <button
          type="button"
          class="toast-close"
          on:click={() => dismissToast(t.id)}
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    {/each}
  </div>
{/if}

<style>
  .toast-stack {
    position: fixed;
    right: 16px;
    bottom: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 100;
    max-width: 360px;
  }
  .toast {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px 10px 14px;
    border: 1px solid var(--border);
    border-radius: 8px;
    font-size: 13px;
    line-height: 1.4;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.18);
    animation: toast-in 180ms ease both;
  }
  @keyframes toast-in {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }
  .toast-close {
    border: 0;
    background: transparent;
    color: var(--text-tertiary);
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
    padding: 0 2px;
  }
  .toast-close:hover {
    color: var(--text-primary);
  }
</style>
