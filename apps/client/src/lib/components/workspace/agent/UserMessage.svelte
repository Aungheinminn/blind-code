<script lang="ts">
  export let content: string;
</script>

<div class="flex justify-end message-rise">
  <div
    class="max-w-[86%] px-[13px] py-[10px] border whitespace-pre-wrap break-words leading-[1.6] text-[13.5px]"
    style="border-color: var(--border); background-color: var(--bg-tertiary); color: var(--text-primary); border-radius: 14px 14px 4px 14px;"
  >
    {content}
  </div>
</div>

<style>
  .message-rise {
    animation: rise 240ms ease both;
  }
  @keyframes rise {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: none; }
  }
</style>
