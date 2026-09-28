<script lang="ts">
  import { createEventDispatcher } from "svelte";

  export let title: string;
  export let busy = false;

  const dispatch = createEventDispatcher<{ apply: void; close: void }>();

  const onBackdrop = (e: MouseEvent) => {
    if (e.target === e.currentTarget) dispatch("close");
  };

  const onKeydown = (e: KeyboardEvent) => {
    if (e.key === "Escape") dispatch("close");
  };
</script>

<svelte:window on:keydown={onKeydown} />

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-noninteractive-element-interactions -->
<div
  class="backdrop"
  role="dialog"
  aria-modal="true"
  aria-label={title}
  on:click={onBackdrop}
>
  <div class="dialog">
    <header class="head">
      <h2>{title}</h2>
      <button
        type="button"
        class="close-btn"
        aria-label="Close"
        on:click={() => dispatch("close")}
      >
        ×
      </button>
    </header>

    <div class="body">
      <slot />
    </div>

    <footer class="actions">
      <button
        type="button"
        class="btn btn-ghost"
        on:click={() => dispatch("close")}
        disabled={busy}
      >
        Cancel
      </button>
      <button
        type="button"
        class="btn btn-primary"
        on:click={() => dispatch("apply")}
        disabled={busy}
      >
        {busy ? "Applying…" : "Apply"}
      </button>
    </footer>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: grid;
    place-items: center;
    padding: 24px;
    background-color: rgba(0, 0, 0, 0.55);
  }
  .dialog {
    width: 100%;
    max-width: 520px;
    max-height: calc(100vh - 48px);
    display: flex;
    flex-direction: column;
    border-radius: 14px;
    border: 1px solid var(--border);
    background-color: var(--bg-panel);
    box-shadow: 0 30px 80px -20px rgba(0, 0, 0, 0.6);
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 16px 20px 12px;
    border-bottom: 1px solid var(--border);
  }
  .head h2 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary);
  }
  .close-btn {
    width: 28px;
    height: 28px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--text-tertiary);
    font-size: 20px;
    line-height: 1;
    cursor: pointer;
  }
  .close-btn:hover {
    background-color: var(--bg-tertiary);
    color: var(--text-primary);
  }
  .body {
    padding: 16px 20px;
    overflow-y: auto;
    flex: 1;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px 20px 16px;
    border-top: 1px solid var(--border);
  }
  .btn {
    padding: 7px 14px;
    border-radius: 6px;
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
    border: 1px solid var(--border);
    transition: background-color 150ms ease, filter 150ms ease, opacity 150ms ease;
  }
  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .btn-ghost {
    background: transparent;
    color: var(--text-secondary);
  }
  .btn-ghost:hover:not(:disabled) {
    background-color: var(--bg-tertiary);
    color: var(--text-primary);
  }
  .btn-primary {
    background-color: var(--accent);
    border-color: var(--accent);
    color: #fff;
  }
  .btn-primary:hover:not(:disabled) {
    filter: brightness(1.05);
  }
</style>
