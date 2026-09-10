<script lang="ts">
  export let label = "Thinking…";
</script>

<div class="flex items-center gap-2.5 text-[13px] pb-2" style="color: var(--text-tertiary);">
  <span
    class="inline-block w-[13px] h-[13px] rounded-full spinner"
    style="border: 1.6px solid var(--border); border-top-color: var(--accent);"
    aria-hidden="true"
  ></span>
  <span>{label}</span>
</div>

<style>
  .spinner {
    animation: think-spin 800ms linear infinite;
  }
  @keyframes think-spin {
    to { transform: rotate(360deg); }
  }
</style>
