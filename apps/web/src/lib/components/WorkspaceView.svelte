<script lang="ts">
  import ResizablePanelGroup from "$lib/components/ui/resizable/ResizablePanelGroup.svelte";
  import ResizablePanel from "$lib/components/ui/resizable/ResizablePanel.svelte";
  import ResizableHandle from "$lib/components/ui/resizable/ResizableHandle.svelte";

  let prompt = "";
  let isAgentRunning = false;

  type Message = {
    id: string;
    role: "user" | "agent";
    content: string;
    timestamp: Date;
  };

  let messages: Message[] = [
    {
      id: "welcome",
      role: "agent",
      content: "Hello! I'm your coding agent. Describe what you'd like to build and I'll get started.",
      timestamp: new Date(),
    },
  ];

  const sendPrompt = () => {
    if (!prompt.trim() || isAgentRunning) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: prompt.trim(),
      timestamp: new Date(),
    };
    messages = [...messages, userMsg];
    prompt = "";
    isAgentRunning = true;

    setTimeout(() => {
      const agentMsg: Message = {
        id: crypto.randomUUID(),
        role: "agent",
        content: "I'll work on that. Setting up the project structure and generating the initial files...",
        timestamp: new Date(),
      };
      messages = [...messages, agentMsg];
      isAgentRunning = false;
    }, 1500);
  };

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendPrompt();
    }
  };

  let previewUrl = "";
</script>

<div class="flex" style="height: calc(100vh - 3.5rem);">
  <ResizablePanelGroup direction="horizontal" className="flex-1">
    <ResizablePanel defaultSize={30} minSize={30} maxSize={45} className="flex flex-col border-r" style="border-color: var(--border); background-color: var(--bg-secondary);">
      <!-- LEFT: Agent Panel -->
      <div
        class="flex items-center justify-between px-4 h-11 border-b shrink-0"
        style="border-color: var(--border);"
      >
        <div class="flex items-center gap-2">
          <div class="w-2 h-2 rounded-full" style="background-color: {isAgentRunning ? 'var(--success)' : 'var(--text-tertiary)'};"></div>
          <span class="text-xs font-medium" style="color: var(--text-secondary);">
            Agent {isAgentRunning ? "— working..." : "— idle"}
          </span>
        </div>
        <div class="flex items-center gap-1.5">
          <button
            class="text-[11px] font-medium px-2.5 py-1 rounded-md border cursor-pointer transition-colors"
            style="border-color: var(--border); color: var(--text-secondary); background-color: var(--bg-tertiary);"
          >
            Clear
          </button>
        </div>
      </div>

      <!-- Messages area -->
      <div class="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {#each messages as message}
          <div class="flex gap-3 items-start">
            <div
              class="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5"
              style="background-color: {message.role === 'agent' ? 'var(--accent)' : 'var(--bg-tertiary)'}; color: {message.role === 'agent' ? 'white' : 'var(--text-secondary)'};"
            >
              {message.role === "agent" ? "AI" : "U"}
            </div>
            <div class="text-sm leading-relaxed" style="color: var(--text-primary);">
              {message.content}
            </div>
          </div>
        {/each}

        {#if isAgentRunning}
          <div class="flex gap-3 items-start">
            <div
              class="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 text-white"
              style="background-color: var(--accent);"
            >
              AI
            </div>
            <div class="flex items-center gap-1 pt-1">
              <span class="w-1.5 h-1.5 rounded-full animate-pulse" style="background-color: var(--text-tertiary);"></span>
              <span class="w-1.5 h-1.5 rounded-full animate-pulse" style="background-color: var(--text-tertiary); animation-delay: 0.2s;"></span>
              <span class="w-1.5 h-1.5 rounded-full animate-pulse" style="background-color: var(--text-tertiary); animation-delay: 0.4s;"></span>
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
            style="background-color: {prompt.trim() ? 'var(--accent)' : 'var(--bg-tertiary)'}; color: {prompt.trim() ? 'white' : 'var(--text-tertiary)'};"
            on:click={sendPrompt}
            disabled={!prompt.trim() || isAgentRunning}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
        <p class="text-[11px] mt-2 text-center" style="color: var(--text-tertiary);">
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </ResizablePanel>

    <ResizableHandle />

    <ResizablePanel defaultSize={70} minSize={55} maxSize={70} className="flex flex-col" style="background-color: var(--bg-primary);">
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
              <span class="w-1.5 h-1.5 rounded-full" style="background-color: var(--success);"></span>
              Live
            </div>
          {/if}
          <button
            class="text-[11px] font-medium px-2.5 py-1 rounded-md border cursor-pointer transition-colors"
            style="border-color: var(--border); color: var(--text-secondary); background-color: var(--bg-tertiary);"
            on:click={() => { /* refresh */ }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
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
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-tertiary);">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
            </div>
            <p class="text-sm font-medium" style="color: var(--text-secondary);">No preview yet</p>
            <p class="text-xs mt-1" style="color: var(--text-tertiary);">
              Start a conversation with the agent to see your project come to life.
            </p>
          </div>
        {/if}
      </div>
    </ResizablePanel>
  </ResizablePanelGroup>
</div>
