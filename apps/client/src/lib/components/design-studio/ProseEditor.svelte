<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";

  export let section: string;
  export let value: string;

  let textareaEl: HTMLTextAreaElement | null = null;
  let draft = value;

  const dispatch = createEventDispatcher<{ apply: string; close: void }>();

  const onApply = () => {
    dispatch("apply", draft);
  };

  const onKeydown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      dispatch("close");
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      onApply();
    }
  };

  onMount(() => {
    textareaEl?.focus();
  });
</script>

<div
  class="editor"
  role="dialog"
  aria-label="Edit {section} prose"
  on:keydown={onKeydown}
>
  <div class="head">
    <span class="label">Editing · {section}</span>
    <span class="hint">⌘/Ctrl + Enter to apply · Esc to cancel</span>
  </div>
  <textarea
    bind:this={textareaEl}
    bind:value={draft}
    class="ta"
    spellcheck="true"
  ></textarea>
  <div class="actions">
    <button type="button" class="btn btn-ghost" on:click={() => dispatch("close")}>
      Cancel
    </button>
    <button type="button" class="btn btn-primary" on:click={onApply}>
      Apply
    </button>
  </div>
</div>

<style>
  .editor {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    margin-top: 8px;
    border-radius: 10px;
    border: 1px solid var(--accent);
    background-color: var(--bg-panel);
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    font-size: 10.5px;
  }
  .label {
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--accent);
    font-weight: 600;
  }
  .hint {
    color: var(--text-tertiary);
  }
  .ta {
    width: 100%;
    min-height: 120px;
    padding: 10px 12px;
    font-family: inherit;
    font-size: 13.5px;
    line-height: 1.55;
    resize: vertical;
    border: 1px solid var(--border);
    border-radius: 8px;
    background-color: var(--bg-secondary);
    color: var(--text-primary);
    outline: none;
  }
  .ta:focus {
    border-color: var(--accent);
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
  }
  .btn {
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    border: 1px solid var(--border);
    transition: background-color 150ms ease, filter 150ms ease;
  }
  .btn-ghost {
    background: transparent;
    color: var(--text-secondary);
  }
  .btn-ghost:hover {
    background-color: var(--bg-tertiary);
    color: var(--text-primary);
  }
  .btn-primary {
    background-color: var(--accent);
    border-color: var(--accent);
    color: #fff;
  }
  .btn-primary:hover {
    filter: brightness(1.05);
  }
</style>
