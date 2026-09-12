<script lang="ts">
  export let name: string;
  export let description: string;
  export let accent: string;
</script>

<button
  type="button"
  class="text-left rounded-2xl border overflow-hidden flex flex-col cursor-pointer sample-card"
  style="border-color: var(--border); background-color: var(--bg-panel);"
>
  <div
    class="h-32 border-b p-3 flex flex-col gap-2"
    style="border-color: var(--border); background-color: var(--bg-secondary);"
  >
    <div class="flex gap-[5px]">
      <span
        class="w-2 h-2 rounded-full"
        style="background-color: var(--border-strong);"
      ></span>
      <span
        class="w-2 h-2 rounded-full"
        style="background-color: var(--border-strong);"
      ></span>
      <span
        class="w-2 h-2 rounded-full"
        style="background-color: var(--border-strong);"
      ></span>
    </div>
    <div
      class="flex-1 rounded-lg p-2.5 flex flex-col gap-[7px]"
      style="background-color: var(--bg-tertiary);"
    >
      <div class="h-2 w-[52%] rounded" style="background-color: {accent};"></div>
      <div
        class="h-1.5 w-[78%] rounded"
        style="background-color: var(--border-strong);"
      ></div>
      <div
        class="h-1.5 w-[64%] rounded"
        style="background-color: var(--border-strong);"
      ></div>
      <div
        class="h-1.5 w-[40%] rounded"
        style="background-color: var(--border-strong);"
      ></div>
    </div>
  </div>
  <div class="p-3.5 flex flex-col gap-1.5">
    <span
      class="text-[14.5px] font-semibold"
      style="color: var(--text-primary);"
    >
      {name}
    </span>
    <span
      class="text-[13px] leading-[1.45]"
      style="color: var(--text-secondary);"
    >
      {description}
    </span>
  </div>
</button>

<style>
  .sample-card {
    transition: border-color 150ms ease, transform 150ms ease;
  }
  .sample-card:hover {
    border-color: var(--border-strong);
  }
</style>
