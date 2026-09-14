<script lang="ts">
  import PromptGenerator from "$lib/components/landing/PromptGenerator.svelte";
  import SampleBuilds from "$lib/components/landing/SampleBuilds.svelte";

  let prompt = "";

  const onSampleSelect = (e: CustomEvent<{ name: string; prompt: string }>) => {
    prompt = `name: ${e.detail.name}\n${e.detail.prompt}`;
  };
</script>

<svelte:head>
  <title>Blind Code — AI Coding Platform</title>
  <meta
    name="description"
    content="Describe the app you want to build. Watch the agent scaffold it with a live preview."
  />
</svelte:head>

<div
  class="w-full max-w-[900px] mx-auto px-6 pt-14 pb-20 flex flex-col gap-14"
  style="min-height: calc(100vh - 3.5rem);"
>
  <PromptGenerator bind:prompt />
  <SampleBuilds on:select={onSampleSelect} />
</div>
