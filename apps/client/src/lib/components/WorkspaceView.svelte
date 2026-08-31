<script lang="ts">
  import { onMount } from "svelte";
  import { theme, toggleTheme } from "$lib/stores/theme";
  import {
    messages,
    isRunning,
    providers,
    selectedProvider,
    selectedModel,
    loadProviders,
    sendPrompt,
    cancelAgent,
  } from "$lib/stores/agent";

  export let projectId: string = "default";

  let prompt = "";
  let previewUrl = "";

  onMount(() => {
    loadProviders();
  });

  const submit = () => {
    if (!prompt.trim() || $isRunning) return;
    const text = prompt;
    prompt = "";
    sendPrompt(projectId, text);
  };

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  $: currentProvider = $providers.find((p) => p.name === $selectedProvider);
  $: modelPlaceholder = currentProvider?.defaultModel ?? "";
</script>

<div class="flex" style="height: 100vh;">
  <div
    class="w-[40%] flex flex-col border-t-2 border-r-2 border-b-2 rounded-tr-2xl rounded-br-2xl"
    style="border-color: var(--border); background-color: var(--bg-tertiary);"
  >
    <!-- LEFT: Agent Panel -->
    <div
      class="flex items-center justify-between px-4 h-11 border-b shrink-0"
      style="border-color: var(--border);"
    >
      <div class="flex items-center gap-2">
        <div
          class="w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-bold text-white"
          style="background-color: var(--accent);"
        >
          BC
        </div>
        <a
          href="/projects"
          class="text-[11px] font-medium px-2 py-1 rounded-md no-underline"
          style="color: var(--text-secondary);">Projects</a
        >
      </div>
    </div>

    <!-- Provider / Model selector -->
    <div
      class="flex items-center gap-2 px-4 py-2 border-b shrink-0"
      style="border-color: var(--border);"
    >
      <select
        class="text-[11px] px-2 py-1 rounded-md border bg-transparent outline-none cursor-pointer"
        style="border-color: var(--border); color: var(--text-primary); background-color: var(--bg-panel);"
        bind:value={$selectedProvider}
      >
        {#each $providers as p}
          <option value={p.name} disabled={!p.configured}>
            {p.name}{p.configured ? "" : " (no key)"}
          </option>
        {/each}
      </select>
      <input
        type="text"
        class="flex-1 text-[11px] px-2 py-1 rounded-md border bg-transparent outline-none"
        style="border-color: var(--border); color: var(--text-primary); background-color: var(--bg-panel);"
        placeholder={modelPlaceholder}
        bind:value={$selectedModel}
      />
    </div>

    <!-- Agent Status -->
    <div
      class="flex items-center gap-2 px-4 py-2 border-b shrink-0"
      style="border-color: var(--border);"
    >
      <div
        class="w-2 h-2 rounded-full"
        style="background-color: {$isRunning ? 'var(--success)' : 'var(--text-tertiary)'};"
      ></div>
      <span class="text-xs font-medium" style="color: var(--text-secondary);">
        Agent {$isRunning ? "— working..." : "— idle"}
      </span>
      {#if $isRunning}
        <button
          class="ml-auto text-[11px] font-medium px-2.5 py-1 rounded-md border cursor-pointer transition-colors"
          style="border-color: var(--border); color: var(--text-secondary); background-color: var(--bg-tertiary);"
          on:click={cancelAgent}
        >
          Cancel
        </button>
      {/if}
    </div>

    <!-- Messages area -->
    <div class="flex-1 overflow-y-auto px-4 py-4 space-y-3">
      {#each $messages as message (message.id)}
        <div class="flex gap-3 items-start">
          <div
            class="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5"
            style="background-color: {message.role === 'agent'
              ? 'var(--accent)'
              : 'var(--bg-tertiary)'}; color: {message.role === 'agent'
              ? 'white'
              : 'var(--text-secondary)'};"
          >
            {message.role === "agent" ? "AI" : "U"}
          </div>
          <div class="flex-1 min-w-0">
            {#if message.content}
              <div
                class="text-sm leading-relaxed whitespace-pre-wrap break-words"
                style="color: var(--text-primary);"
              >
                {message.content}
              </div>
            {/if}
            {#if message.toolCalls && message.toolCalls.length > 0}
              <div class="mt-2 space-y-1">
                {#each message.toolCalls as call (call.id)}
                  <div
                    class="text-[11px] font-mono px-2 py-1 rounded-md border"
                    style="border-color: var(--border); background-color: var(--bg-panel); color: var(--text-secondary);"
                  >
                    <span style="color: var(--accent);">◆</span>
                    {call.name}({JSON.stringify(call.input).slice(0, 80)})
                    {#if call.output === undefined}
                      <span style="color: var(--text-tertiary);"> …</span>
                    {:else}
                      <span style="color: var(--success);"> ✓</span>
                    {/if}
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      {/each}

      {#if $isRunning}
        <div class="flex gap-3 items-start">
          <div
            class="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 text-white"
            style="background-color: var(--accent);"
          >
            AI
          </div>
          <div class="flex items-center gap-1 pt-1">
            <span
              class="w-1.5 h-1.5 rounded-full animate-pulse"
              style="background-color: var(--text-tertiary);"
            ></span>
            <span
              class="w-1.5 h-1.5 rounded-full animate-pulse"
              style="background-color: var(--text-tertiary); animation-delay: 0.2s;"
            ></span>
            <span
              class="w-1.5 h-1.5 rounded-full animate-pulse"
              style="background-color: var(--text-tertiary); animation-delay: 0.4s;"
            ></span>
          </div>
        </div>
      {/if}
    </div>

    <!-- Input area -->
    <div class="shrink-0 px-4 pb-4 pt-2">
      <div
        class="flex items-end gap-2 rounded-xl border px-3 py-2"
        style="border-color: var(--border-strong); background-color: var(--bg-panel);"
      >
        <textarea
          class="flex-1 resize-none bg-transparent text-sm outline-none min-h-[36px] max-h-[120px] py-1"
          style="color: var(--text-primary);"
          placeholder="Describe what you want to build..."
          rows="1"
          bind:value={prompt}
          on:keydown={handleKeydown}
        ></textarea>
        <button
          class="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-colors"
          style="background-color: {prompt.trim()
            ? 'var(--accent)'
            : 'var(--bg-tertiary)'}; color: {prompt.trim() ? 'white' : 'var(--text-tertiary)'};"
          on:click={submit}
          disabled={!prompt.trim() || $isRunning}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <line x1="22" y1="2" x2="11" y2="13" /><polygon
              points="22 2 15 22 11 13 2 9 22 2"
            />
          </svg>
        </button>
      </div>
      <p class="text-[11px] mt-2 text-center" style="color: var(--text-tertiary);">
        Press Enter to send · Shift+Enter for new line
      </p>
    </div>
  </div>

  <div
    class="w-[60%] flex flex-col border-t-2 border-b-2 border-l-2 border-transparent"
    style="background-color: var(--bg-primary);"
  >
    <!-- RIGHT: Preview Panel -->
    <div
      class="flex items-center justify-between px-4 h-11 border-b shrink-0"
      style="border-color: var(--border);"
    >
      <div class="flex items-center gap-2">
        <span class="text-xs font-medium" style="color: var(--text-secondary);">Preview</span>
      </div>
      <div class="flex items-center gap-1.5">
        {#if previewUrl}
          <div
            class="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px]"
            style="background-color: var(--bg-tertiary); color: var(--text-tertiary);"
          >
            <span class="w-1.5 h-1.5 rounded-full" style="background-color: var(--success);"
            ></span>
            Live
          </div>
        {/if}
        <button
          class="w-7 h-7 rounded-md border cursor-pointer transition-colors flex items-center justify-center"
          style="border-color: var(--border); color: var(--text-secondary); background-color: var(--bg-tertiary);"
          on:click={() => {}}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="23 4 23 10 17 10" /><path
              d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"
            />
          </svg>
        </button>
        <button
          class="w-7 h-7 rounded-md border cursor-pointer transition-colors flex items-center justify-center"
          style="border-color: var(--border); color: var(--text-secondary); background-color: var(--bg-tertiary);"
          on:click={toggleTheme}
          title="Toggle theme"
        >
          {#if $theme === "dark"}
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line
                x1="12"
                y1="21"
                x2="12"
                y2="23"
              /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line
                x1="18.36"
                y1="18.36"
                x2="19.78"
                y2="19.78"
              /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line
                x1="4.22"
                y1="19.78"
                x2="5.64"
                y2="18.36"
              /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          {:else}
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          {/if}
        </button>
      </div>
    </div>

    <!-- Preview content -->
    <div class="flex-1 flex items-center justify-center">
      {#if previewUrl}
        <iframe class="w-full h-full border-0" src={previewUrl} title="Preview"></iframe>
      {:else}
        <div class="text-center px-8">
          <div
            class="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4"
            style="background-color: var(--bg-tertiary);"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              style="color: var(--text-tertiary);"
            >
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line
                x1="8"
                y1="21"
                x2="16"
                y2="21"
              /><line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </div>
          <p class="text-sm font-medium" style="color: var(--text-secondary);">No preview yet</p>
          <p class="text-xs mt-1" style="color: var(--text-tertiary);">
            Start a conversation with the agent to see your project come to life.
          </p>
        </div>
      {/if}
    </div>
  </div>
</div>
