<script lang="ts">
  import { onMount } from "svelte";
  import SampleBuildCard from "./SampleBuildCard.svelte";
  import { listSampleBuilds, type SampleBuild } from "$lib/api/sampleBuilds";

  let samples: SampleBuild[] = [];
  let loadError = "";

  onMount(async () => {
    try {
      samples = (await listSampleBuilds()) ?? [];
    } catch (e) {
      loadError = e instanceof Error ? e.message : String(e);
    }
  });
</script>

<section id="projects" class="flex flex-col gap-4">
  <div class="flex items-baseline justify-between gap-3">
    <h2
      class="m-0 text-[15px] font-semibold"
      style="color: var(--text-secondary); letter-spacing: 0.02em;"
    >
      Sample builds — start from one
    </h2>
  </div>

  {#if loadError}
    <p class="text-[13px]" style="color: var(--text-secondary);">
      Couldn't load sample builds.
    </p>
  {:else}
    <div class="grid gap-4 sample-grid">
      {#each samples as sample (sample.id)}
        <SampleBuildCard
          name={sample.name}
          description={sample.description}
          accent={sample.accent}
          image={sample.image}
          prompt={sample.prompt}
          on:select
        />
      {/each}
    </div>
  {/if}
</section>

<style>
  .sample-grid {
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr));
  }
</style>
