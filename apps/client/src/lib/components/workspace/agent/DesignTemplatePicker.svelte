<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import Dropdown from "$lib/components/ui/Dropdown.svelte";
  import type { DesignTemplateSummary } from "$lib/api/projects";
  import DesignTemplateModal from "./DesignTemplateModal.svelte";

  export let projectId = "";
  export let disabled = false;
  export let placement: "up" | "down" = "up";
  export let selectedTemplateId: string | null = null;

  const dispatch = createEventDispatcher<{ pick: DesignTemplateSummary }>();

  let modalOpen = false;

  const openModal = (close: () => void) => {
    close();
    modalOpen = true;
  };

  const onPick = (e: CustomEvent<DesignTemplateSummary>) => {
    dispatch("pick", e.detail);
  };
</script>

<Dropdown {placement} align="left" {disabled} menuMinWidth={200}>
  <button
    slot="trigger"
    let:open
    let:toggle
    type="button"
    class="trigger"
    class:trigger--open={open}
    on:click={toggle}
    {disabled}
    aria-haspopup="listbox"
    aria-expanded={open}
    aria-label="Choose design template"
    title="Choose design template"
  >
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
      aria-hidden="true"
    >
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  </button>

  <svelte:fragment let:close>
    <button
      type="button"
      class="dropdown-row"
      on:click={() => openModal(close)}
    >
      <span class="dropdown-row-label plus-label">
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.2"
          stroke-linecap="round"
          aria-hidden="true"
        >
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
        Choose design template
      </span>
    </button>
  </svelte:fragment>
</Dropdown>

<DesignTemplateModal
  bind:open={modalOpen}
  {projectId}
  {selectedTemplateId}
  on:pick={onPick}
  on:close={() => (modalOpen = false)}
/>

<style>
  .trigger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    border-radius: 8px;
    border: 1px solid transparent;
    background-color: transparent;
    color: var(--text-tertiary);
    cursor: pointer;
    outline: none;
    transition:
      color 150ms ease,
      border-color 150ms ease,
      background-color 150ms ease;
  }
  .trigger:hover:not(:disabled),
  .trigger--open {
    color: var(--text-primary);
    background-color: var(--bg-tertiary);
    border-color: var(--border);
  }
  .trigger:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .plus-label {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: inherit;
  }
</style>
