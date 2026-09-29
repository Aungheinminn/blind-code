<script lang="ts">
  import { createEventDispatcher, onDestroy, tick } from "svelte";

  export let value: string;
  export let multiline = false;
  export let placeholder = "";
  export let editable = true;
  export let displayClass = "";
  export let inputClass = "";
  export let saveDelayMs = 900;

  let editing = false;
  let draft = value;
  let rootEl: HTMLDivElement | null = null;
  let inputEl: HTMLInputElement | HTMLTextAreaElement | null = null;
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let lastCommitted = value;

  const dispatch = createEventDispatcher<{ apply: string }>();

  $: if (!editing) {
    draft = value;
    lastCommitted = value;
  }

  const clearTimer = () => {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
  };

  const commitIfChanged = (next: string) => {
    if (next === lastCommitted) return;
    lastCommitted = next;
    dispatch("apply", next);
  };

  const scheduleCommit = () => {
    clearTimer();
    saveTimer = setTimeout(() => {
      commitIfChanged(draft);
      saveTimer = null;
    }, saveDelayMs);
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
  };

  const stopEditing = () => {
    if (!editing) return;
    clearTimer();
    commitIfChanged(draft);
    editing = false;
  };

  const onInput = () => {
    scheduleCommit();
  };

  const onBlur = () => {
    stopEditing();
  };

  const onKeydown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      draft = lastCommitted;
      clearTimer();
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
    clearTimer();
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
        on:input={onInput}
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
        on:input={onInput}
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
    margin: -4px -6px;
    border-radius: 6px;
    transition: background-color 150ms ease;
  }
  .inline-display-editable {
    cursor: text;
  }
  .inline-display-editable:hover,
  .inline-display-editable:focus-visible {
    background-color: var(--bg-panel);
    outline: none;
  }
  .inline-input {
    width: 100%;
    padding: 4px 6px;
    margin: -4px -6px;
    font: inherit;
    color: inherit;
    background-color: var(--bg-panel);
    border: 1px solid var(--accent);
    border-radius: 6px;
    outline: none;
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 20%, transparent);
    resize: vertical;
  }
  .inline-textarea {
    min-height: 96px;
    font-family: inherit;
    line-height: inherit;
  }
</style>
