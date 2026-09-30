<script lang="ts">
  import { onDestroy } from "svelte";

  export let call: { id: string; name: string; input: unknown; output?: unknown };

  type IconKind = "list" | "read" | "write" | "todo" | "run" | "command" | "delete";

  const isErrorOutput = (output: unknown): boolean => {
    if (output == null) return false;
    if (typeof output === "string") return /^\s*(error|failed)/i.test(output);
    if (typeof output === "object") {
      const o = output as Record<string, unknown>;
      if (typeof o.error === "string" && o.error.length > 0) return true;
      if (o.ok === false) return true;
    }
    return false;
  };

  const startedAt = Date.now();
  let now = Date.now();
  let timer: ReturnType<typeof setInterval> | null = null;
  const startTimer = () => {
    if (timer) return;
    timer = setInterval(() => (now = Date.now()), 1000);
  };
  const stopTimer = () => {
    if (!timer) return;
    clearInterval(timer);
    timer = null;
  };
  onDestroy(stopTimer);

  const iconFor = (name: string): IconKind => {
    const n = name.toLowerCase();
    if (n.includes("delete") || n.includes("remove") || n === "rm") return "delete";
    if (n.includes("todo")) return "todo";
    if (n.includes("write") || n.includes("edit") || n.includes("create")) return "write";
    if (n.includes("read") || n.includes("cat")) return "read";
    if (n.includes("list") || n.includes("ls") || n.includes("glob") || n.includes("dir")) return "list";
    if (n.includes("bash") || n.includes("shell") || n.includes("exec") || n.includes("command")) return "command";
    if (n.includes("run") || n.includes("start")) return "run";
    return "command";
  };

  const formatArg = (input: unknown): string => {
    if (input == null) return "";
    if (typeof input === "string") return input;
    if (typeof input === "object") {
      try {
        const keys = Object.keys(input as object);
        if (keys.length === 1) {
          const v = (input as Record<string, unknown>)[keys[0]];
          if (typeof v === "string") return v;
        }
        return JSON.stringify(input);
      } catch {
        return String(input);
      }
    }
    return String(input);
  };

  const formatOutput = (output: unknown): string => {
    if (output == null) return "";
    if (typeof output === "string") return output;
    try {
      return JSON.stringify(output, null, 2);
    } catch {
      return String(output);
    }
  };

  let open = false;
  let didAutoOpenError = false;
  const toggle = () => {
    if (!hasOutput) return;
    open = !open;
  };

  $: kind = iconFor(call.name);
  $: arg = formatArg(call.input);
  $: hasOutput = call.output !== undefined;
  $: hasError = hasOutput && isErrorOutput(call.output);
  $: output = hasOutput ? formatOutput(call.output) : "";
  $: elapsedSec = Math.max(0, Math.floor((now - startedAt) / 1000));
  $: if (hasOutput) stopTimer();
  else startTimer();
  $: showElapsed = !hasOutput && elapsedSec >= 3;
  $: isSlow = !hasOutput && elapsedSec >= 15;

  $: if (hasError && !didAutoOpenError) {
    open = true;
    didAutoOpenError = true;
  }
</script>

<div>
  <button
    type="button"
    class="flex items-center gap-2.5 w-full px-3 py-2.5 text-left tool-btn"
    class:no-output={!hasOutput}
    style="color: var(--text-secondary);"
    on:click={toggle}
    aria-expanded={open}
    aria-disabled={!hasOutput}
  >
    <span
      class="grid place-items-center w-[18px] h-[18px] shrink-0"
      style="color: {kind === 'delete' ? 'var(--danger)' : 'var(--accent)'};"
      aria-hidden="true"
    >
      {#if kind === "list"}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round">
          <path d="M3 7h18M3 12h18M3 17h12" />
        </svg>
      {:else if kind === "read"}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      {:else if kind === "write"}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
        </svg>
      {:else if kind === "todo"}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      {:else if kind === "run"}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 17l6-5-6-5M12 19h8" />
        </svg>
      {:else if kind === "delete"}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
          <path d="M10 11v5M14 11v5" />
        </svg>
      {:else}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2.5" y="4" width="19" height="16" rx="2.5" />
          <path d="M7 9.5l3 2.5-3 2.5M12.5 15h4.5" />
        </svg>
      {/if}
    </span>
    <span
      class="font-medium text-[12.5px] shrink-0"
      style="font-family: 'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--text-primary);"
    >
      {call.name}
    </span>
    <span
      class="text-[12px] truncate flex-1 min-w-0"
      style="font-family: 'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--text-tertiary);"
    >
      {arg}
    </span>
    {#if !hasOutput && showElapsed}
      <span
        class="text-[11px] tabular-nums shrink-0"
        style="color: {isSlow ? 'var(--warning, #d97706)' : 'var(--text-tertiary)'};"
        title={isSlow ? "Taking longer than usual…" : "Elapsed"}
      >
        {elapsedSec}s
      </span>
    {/if}
    {#if hasOutput}
      {#if hasError}
        <span
          class="grid place-items-center shrink-0"
          style="color: var(--danger, #e5484d); width: 14px; height: 14px;"
          title="Tool returned an error"
          aria-label="Error"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4" />
            <path d="M12 16h.01" />
          </svg>
        </span>
      {/if}
      <span
        class="grid place-items-center w-[14px] h-[14px] shrink-0"
        style="color: var(--text-tertiary); transform: rotate({open ? 180 : 0}deg); transition: transform 180ms ease;"
        aria-hidden="true"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </span>
    {:else}
      <span
        class="tool-spinner shrink-0"
        class:tool-spinner--slow={isSlow}
        style="border-color: color-mix(in srgb, {isSlow ? 'var(--warning, #d97706)' : 'var(--accent)'} 25%, transparent); border-top-color: {isSlow ? 'var(--warning, #d97706)' : 'var(--accent)'};"
        aria-label={isSlow ? "Taking longer than usual…" : "Running…"}
        title={isSlow ? "Taking longer than usual…" : "Running…"}
      ></span>
    {/if}
  </button>

  {#if open}
    <div class="px-3 pb-3 pl-[38px]">
      <pre
        class="m-0 px-3 py-2.5 rounded-lg border text-[12px] leading-[1.6] whitespace-pre-wrap break-words max-h-[220px] overflow-auto"
        style="background-color: var(--bg-panel); border-color: var(--border); color: var(--text-secondary); font-family: 'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace;"
      >{output || "(no output yet)"}</pre>
    </div>
  {/if}
</div>

<style>
  .tool-btn {
    background: transparent;
    border: 0;
    font-family: inherit;
    cursor: pointer;
    transition: background-color 150ms ease;
  }
  .tool-btn:hover {
    background-color: var(--bg-panel);
  }
  .tool-btn.no-output {
    cursor: default;
  }
  .tool-btn.no-output:hover {
    background-color: transparent;
  }
  .tool-spinner {
    display: inline-block;
    width: 12px;
    height: 12px;
    border-width: 1.5px;
    border-style: solid;
    border-radius: 50%;
    animation: tool-spin 0.9s linear infinite;
  }
  @keyframes tool-spin {
    to { transform: rotate(360deg); }
  }
</style>
