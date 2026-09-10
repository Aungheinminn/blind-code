<script lang="ts">
  import ToolCallRow from "./ToolCallRow.svelte";

  export let calls: Array<{ id: string; name: string; input: unknown; output?: unknown }> = [];
</script>

<div
  class="rounded-xl border overflow-hidden"
  style="border-color: var(--border); background-color: var(--bg-tertiary);"
>
  {#each calls as call, i (call.id)}
    <div class:tool-row-divider={i < calls.length - 1}>
      <ToolCallRow {call} />
    </div>
  {/each}
</div>

<style>
  .tool-row-divider {
    border-bottom: 1px solid var(--border);
  }
</style>
