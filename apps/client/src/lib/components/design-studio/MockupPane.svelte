<script lang="ts">
  import type { ParsedDraft, PreviewTokens } from "./parseTemplate";
  import { buildMockupHtml, type MockupId } from "./mockups";

  export let tokens: PreviewTokens | null;
  export let parsed: ParsedDraft | null;
  export let mockup: MockupId = "landing";

  $: srcdoc = tokens ? buildMockupHtml(mockup, tokens, parsed) : "";
</script>

<div class="pane">
  {#if srcdoc}
    <iframe
      class="frame"
      title="Mockup preview"
      {srcdoc}
      sandbox="allow-same-origin"
      loading="eager"
    ></iframe>
  {:else}
    <div class="empty">
      Generate a draft first — the mockup renders once tokens are ready.
    </div>
  {/if}
</div>

<style>
  .pane {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 20px;
    background-color: var(--bg-primary);
    overflow: hidden;
    display: flex;
    align-items: stretch;
    justify-content: stretch;
  }
  .frame {
    width: 100%;
    height: 100%;
    border: 1px solid var(--border);
    border-radius: 12px;
    background-color: #ffffff;
    box-shadow: 0 12px 32px -18px rgba(0, 0, 0, 0.35);
  }
  .empty {
    flex: 1;
    display: grid;
    place-items: center;
    color: var(--text-secondary);
    font-size: 13.5px;
    padding: 40px;
    text-align: center;
  }
</style>
