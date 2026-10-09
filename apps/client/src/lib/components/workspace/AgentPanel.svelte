<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { AgentMessage, ClarifyingQuestion, Plan, ProviderInfo, TodoStatus } from "$lib/stores/agent";
  import { clearPendingQuestions, pendingQuestions } from "$lib/stores/agent";
  import AgentPanelHeader from "./agent/AgentPanelHeader.svelte";
  import ClarifyingQuestionsPopup from "./agent/ClarifyingQuestionsPopup.svelte";
  import MessageList from "./agent/MessageList.svelte";
  import PromptComposer from "./agent/PromptComposer.svelte";
  import TodoTray from "./TodoTray.svelte";

  export let open = false;
  export let projectId = "";
  export let projectName = "";
  export let messages: AgentMessage[] = [];
  export let isRunning = false;
  export let providers: ProviderInfo[] = [];
  export let selectedModel = "";
  export let statusText = "idle";
  export let plan: Plan | null = null;
  export let todoStatuses: Record<string, TodoStatus> = {};
  export let planError: string | null = null;

  $: showTray = plan !== null || (isRunning && !planError) || planError !== null;

  let messageListAtTop = true;

  const dispatch = createEventDispatcher<{
    close: void;
    submit: string;
    cancel: void;
    retry: void;
    back: void;
    "model-change": string;
  }>();

  const onSubmit = (event: CustomEvent<string>) => {
    dispatch("submit", event.detail);
  };

  const formatAnswers = (
    questions: ClarifyingQuestion[],
    answers: { selected: string[]; custom: string }[],
  ): string => {
    const lines: string[] = ["Here are my answers to your clarifying questions:"];
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const a = answers[i];
      if (!q || !a) continue;
      lines.push("");
      lines.push(`Q${i + 1}: ${q.question}`);
      const picks = a.selected.length > 0 ? a.selected.join(", ") : "";
      const custom = a.custom.trim();
      const answerText =
        picks && custom
          ? `${picks}; also: ${custom}`
          : picks || custom || "(skipped — use your best judgement)";
      lines.push(`A: ${answerText}`);
    }
    lines.push("");
    lines.push("Please proceed with plan_task now.");
    return lines.join("\n");
  };

  const onQuestionsSubmit = (
    event: CustomEvent<{
      questions: ClarifyingQuestion[];
      answers: { selected: string[]; custom: string }[];
    }>,
  ) => {
    const text = formatAnswers(event.detail.questions, event.detail.answers);
    clearPendingQuestions();
    dispatch("submit", text);
  };

  const onQuestionsDismiss = () => {
    clearPendingQuestions();
    dispatch(
      "submit",
      "Skip the clarifying questions and proceed with your default assumptions — call plan_task now.",
    );
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
    {projectId}
    {projectName}
    on:close={() => dispatch("close")}
    on:back={() => dispatch("back")}
  />

  <div class="flex-1 relative flex flex-col min-h-0">
    {#if showTray}
      <TodoTray
        {plan}
        statuses={todoStatuses}
        {isRunning}
        {planError}
        compact={messageListAtTop && !isRunning}
      />
    {/if}
    <MessageList
      {messages}
      {isRunning}
      on:retry={() => dispatch("retry")}
      on:atTopChange={(e) => (messageListAtTop = e.detail)}
    />
  </div>

  {#if $pendingQuestions && $pendingQuestions.length > 0}
    <div class="px-4 pt-2">
      <ClarifyingQuestionsPopup
        questions={$pendingQuestions}
        on:submit={onQuestionsSubmit}
        on:dismiss={onQuestionsDismiss}
      />
    </div>
  {/if}

  <PromptComposer
    {isRunning}
    {statusText}
    {selectedModel}
    {providers}
    {projectId}
    on:submit={onSubmit}
    on:cancel={() => dispatch("cancel")}
    on:model-change={(e) => dispatch("model-change", e.detail)}
  />
</div>
