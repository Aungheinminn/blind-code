<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { AgentMessage, Plan, ProviderInfo, TodoStatus } from "$lib/stores/agent";
  import AgentPanelHeader from "./agent/AgentPanelHeader.svelte";
  import ProviderSelector from "./agent/ProviderSelector.svelte";
  import MessageList from "./agent/MessageList.svelte";
  import PromptComposer from "./agent/PromptComposer.svelte";
  import TodoTray from "./TodoTray.svelte";

  export let open = false;
  export let projectId = "";
  export let projectName = "";
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

  $: showTray = plan !== null || (isRunning && !planError) || planError !== null;

  const dispatch = createEventDispatcher<{
    close: void;
    submit: string;
    cancel: void;
    retry: void;
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
    {projectId}
    {projectName}
    on:close={() => dispatch("close")}
    on:back={() => dispatch("back")}
  />

  <ProviderSelector
    {providers}
    {modelPlaceholder}
    bind:selectedProvider
    bind:selectedModel
  />

  <div class="flex-1 relative flex flex-col min-h-0">
    {#if showTray}
      <TodoTray {plan} statuses={todoStatuses} {isRunning} {planError} />
    {/if}
    <MessageList {messages} {isRunning} on:retry={() => dispatch("retry")} />
  </div>

  <PromptComposer
    {isRunning}
    {statusText}
    on:submit={onSubmit}
    on:cancel={() => dispatch("cancel")}
  />
</div>
