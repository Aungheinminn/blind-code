<script lang="ts">
  import { onMount } from "svelte";
  import { initTheme } from "$lib/stores/theme";
  import "../app.css";

  onMount(() => {
    initTheme();
  });
</script>

<div class="min-h-screen" style="background-color: var(--bg-primary); color: var(--text-primary);">
  <slot />
</div>
