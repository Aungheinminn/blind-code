<script lang="ts">
  export let label = "Thinking";
</script>

<span class="text-[13px] pb-2" style="color: var(--text-tertiary);">
  {label}<span class="dots" aria-hidden="true"
    ><span>.</span><span>.</span><span>.</span></span
  >
</span>

<style>
  .dots span {
    display: inline-block;
    animation: dot-blink 1.4s infinite ease-in-out both;
  }
  .dots span:nth-child(1) { animation-delay: 0s; }
  .dots span:nth-child(2) { animation-delay: 0.2s; }
  .dots span:nth-child(3) { animation-delay: 0.4s; }
  @keyframes dot-blink {
    0%, 80%, 100% { opacity: 0.2; }
    40%           { opacity: 1; }
  }
</style>
