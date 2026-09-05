<script lang="ts">
  import { createEventDispatcher } from "svelte";

  export let disabled = false;

  let prompt = "";
  const dispatch = createEventDispatcher<{ submit: string; cancel: void }>();

  const submit = () => {
    const trimmed = prompt.trim();
    if (!trimmed || disabled) return;
    dispatch("submit", trimmed);
    prompt = "";
  };

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };
</script>

<div
  class="px-[18px] pt-[14px] pb-[18px] flex flex-col gap-[9px] border-t"
  style="border-color: var(--border);"
>
  <div
    class="flex items-end gap-2 rounded-xl border px-[11px] py-[11px] pl-[14px]"
    style="border-color: var(--border); background-color: var(--bg-tertiary);"
  >
    <textarea
      class="flex-1 resize-none bg-transparent text-[13.5px] outline-none min-h-[24px] max-h-[120px] py-[3px] leading-[1.5]"
      style="color: var(--text-primary);"
      placeholder="Describe what you want to build…"
      rows="1"
      bind:value={prompt}
      on:keydown={handleKeydown}
    ></textarea>
    <button
      type="button"
      class="shrink-0 w-8 h-8 rounded-[9px] flex items-center justify-center cursor-pointer transition-colors disabled:cursor-not-allowed"
      style="background-color: {prompt.trim() && !disabled
        ? 'var(--accent)'
        : 'var(--bg-panel)'}; color: {prompt.trim() && !disabled
        ? 'white'
        : 'var(--text-tertiary)'};"
      on:click={submit}
      disabled={!prompt.trim() || disabled}
      aria-label="Send message"
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M22 2L11 13" />
        <path d="M22 2l-7 20-4-9-9-4 20-7z" />
      </svg>
    </button>
  </div>
  <p class="text-[11px] text-center" style="color: var(--text-tertiary);">
    Press Enter to send · Shift+Enter for new line
  </p>
</div>
