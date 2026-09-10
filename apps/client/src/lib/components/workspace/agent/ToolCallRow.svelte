<script lang="ts">
  export let call: { id: string; name: string; input: unknown; output?: unknown };

  type IconKind = "list" | "read" | "write" | "todo" | "run" | "command" | "delete";

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
  const toggle = () => {
    open = !open;
  };

  $: kind = iconFor(call.name);
  $: arg = formatArg(call.input);
  $: hasOutput = call.output !== undefined;
  $: output = hasOutput ? formatOutput(call.output) : "";
</script>

<div>
  <button
    type="button"
    class="flex items-center gap-2.5 w-full px-3 py-2.5 text-left cursor-pointer tool-btn"
    style="color: var(--text-secondary);"
    on:click={toggle}
    aria-expanded={open}
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
    {#if !hasOutput}
      <span
        class="shrink-0 w-2 h-2 rounded-full animate-pulse"
        style="background-color: var(--accent);"
        aria-hidden="true"
      ></span>
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
    transition: background-color 150ms ease;
  }
  .tool-btn:hover {
    background-color: var(--bg-panel);
  }
</style>
