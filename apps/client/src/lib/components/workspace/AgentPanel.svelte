<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { AgentMessage, Plan, ProviderInfo, TodoStatus } from "$lib/stores/agent";
  import AgentPanelHeader from "./AgentPanelHeader.svelte";
  import ProviderSelector from "./ProviderSelector.svelte";
  import MessageList from "./MessageList.svelte";
  import PromptComposer from "./PromptComposer.svelte";
  import TodoList from "./TodoList.svelte";

  export let open = false;
  export let messages: AgentMessage[] = [];
  export let isRunning = false;
  export let providers: ProviderInfo[] = [];
  export let selectedProvider = "";
  export let selectedModel = "";
  export let modelPlaceholder = "";
  export let statusText = "idle";
  export let plan: Plan | null = null;
  export let todoStatuses: Record<string, TodoStatus> = {};
  export let planError: string | null = null;

  $: showTodos = plan !== null || (isRunning && !planError) || planError !== null;

  const dispatch = createEventDispatcher<{
    close: void;
    submit: string;
    cancel: void;
    back: void;
    "provider-change": string;
    "model-change": string;
  }>();

  const onSubmit = (event: CustomEvent<string>) => {
    dispatch("submit", event.detail);
  };
</script>

<div
  class="absolute top-3 bottom-3 left-3 w-[min(420px,calc(100%-24px))] rounded-[18px] border flex flex-col overflow-hidden"
  style="z-index: 25; border-color: var(--border); background-color: var(--bg-panel); box-shadow: var(--panel-shadow); transform: {open
    ? 'translateX(0)'
    : 'translateX(calc(-100% - 16px))'}; opacity: {open
    ? 1
    : 0}; transition: transform 300ms cubic-bezier(.22,.8,.28,1), opacity 200ms ease; pointer-events: {open
    ? 'auto'
    : 'none'};"
  aria-hidden={!open}
>
  <AgentPanelHeader
    {statusText}
    {isRunning}
    on:close={() => dispatch("close")}
    on:cancel={() => dispatch("cancel")}
    on:back={() => dispatch("back")}
  />

  <ProviderSelector
    {providers}
    {modelPlaceholder}
    bind:selectedProvider
    bind:selectedModel
  />

  {#if showTodos}
    <div
      class="border-b px-4 py-3 overflow-y-auto"
      style="border-color: var(--border); max-height: 40%;"
    >
      {#if plan?.summary}
        <div
          class="text-[11px] uppercase tracking-wider font-semibold mb-2"
          style="color: var(--text-tertiary);"
        >
          Plan
        </div>
        <div
          class="text-[12.5px] mb-3"
          style="color: var(--text-secondary);"
        >
          {plan.summary}
        </div>
      {/if}
      <TodoList {plan} statuses={todoStatuses} {isRunning} {planError} />
    </div>
  {/if}

  <MessageList {messages} {isRunning} />

  <PromptComposer disabled={isRunning} on:submit={onSubmit} />
</div>
