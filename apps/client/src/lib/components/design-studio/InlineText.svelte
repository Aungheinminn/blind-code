<script lang="ts">
  import { createEventDispatcher, onDestroy, tick } from "svelte";

  export let value: string;
  export let multiline = false;
  export let placeholder = "";
  export let editable = true;
  export let displayClass = "";
  export let inputClass = "";

  let editing = false;
  let draft = value;
  let rootEl: HTMLDivElement | null = null;
  let inputEl: HTMLInputElement | HTMLTextAreaElement | null = null;
  let lastCommitted = value;

  const dispatch = createEventDispatcher<{ apply: string }>();

  $: if (!editing) {
    draft = value;
    lastCommitted = value;
  }

  const commitIfChanged = (next: string) => {
    if (next === lastCommitted) return;
    lastCommitted = next;
    dispatch("apply", next);
  };

  const autoGrow = () => {
    if (!(inputEl instanceof HTMLTextAreaElement)) return;
    const before = inputEl.clientHeight;
    inputEl.style.height = "auto";
    const scroll = inputEl.scrollHeight;
    // Only grow — never shrink below whatever the user has already set
    // (either via drag handle or previous autogrow). Capped at 480px.
    const next = Math.min(Math.max(scroll, before), 480);
    inputEl.style.height = `${next}px`;
  };

  const startEditing = async () => {
    if (!editable) return;
    if (editing) return;
    editing = true;
    draft = value;
    lastCommitted = value;
    await tick();
    inputEl?.focus();
    if (inputEl instanceof HTMLInputElement) inputEl.select();
    else inputEl?.setSelectionRange?.(inputEl.value.length, inputEl.value.length);
    autoGrow();
  };

  const stopEditing = () => {
    if (!editing) return;
    commitIfChanged(draft);
    editing = false;
  };

  const onBlur = () => {
    stopEditing();
  };

  const onKeydown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      draft = lastCommitted;
      editing = false;
      return;
    }
    if (e.key === "Enter" && !multiline && !e.shiftKey) {
      e.preventDefault();
      stopEditing();
    }
    if (e.key === "Enter" && multiline && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      stopEditing();
    }
  };

  const onDisplayKeydown = (e: KeyboardEvent) => {
    if (!editable) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      startEditing();
    }
  };

  onDestroy(() => {
    if (editing && draft !== lastCommitted) {
      dispatch("apply", draft);
    }
  });
</script>

<div class="inline-text {editing ? 'inline-text-editing' : ''}" bind:this={rootEl}>
  {#if editing}
    {#if multiline}
      <textarea
        bind:this={inputEl}
        bind:value={draft}
        on:input={autoGrow}
        on:blur={onBlur}
        on:keydown={onKeydown}
        class="inline-input inline-textarea {inputClass}"
        {placeholder}
        spellcheck="true"
        rows="4"
      ></textarea>
    {:else}
      <input
        type="text"
        bind:this={inputEl}
        bind:value={draft}
        on:blur={onBlur}
        on:keydown={onKeydown}
        class="inline-input {inputClass}"
        {placeholder}
        spellcheck="true"
      />
    {/if}
  {:else}
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <div
      class="inline-display {editable ? 'inline-display-editable' : ''} {displayClass}"
      on:click={startEditing}
      on:keydown={onDisplayKeydown}
      role={editable ? "button" : undefined}
      tabindex={editable ? 0 : -1}
      title={editable ? "Click to edit" : ""}
    >
      <slot>{value}</slot>
    </div>
  {/if}
</div>

<style>
  .inline-text {
    display: block;
    width: 100%;
  }
  .inline-display {
    display: block;
    padding: 4px 6px;
    border: 1px solid transparent;
    border-radius: 6px;
    transition: background-color 150ms ease, border-color 150ms ease;
    box-sizing: border-box;
  }
  .inline-display-editable {
    cursor: pointer;
  }
  .inline-display-editable:hover,
  .inline-display-editable:focus-visible {
    background-color: var(--bg-tertiary);
    outline: none;
  }
  .inline-input {
    display: block;
    width: 100%;
    padding: 4px 6px;
    font: inherit;
    color: inherit;
    background-color: var(--bg-panel);
    border: 1px solid var(--accent);
    border-radius: 6px;
    outline: none;
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 20%, transparent);
    resize: vertical;
    box-sizing: border-box;
  }
  .inline-textarea {
    min-height: 96px;
    max-height: 480px;
    overflow-y: auto;
    font-family: inherit;
    line-height: inherit;
    resize: vertical;
  }
</style>
