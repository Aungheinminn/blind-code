<script lang="ts">
  import { goto } from "$app/navigation";
</script>

<svelte:head>
  <title>Blind Code — AI Coding Platform</title>
  <meta name="description" content="Build, preview, and deploy with an AI coding agent." />
</svelte:head>

<div class="flex flex-col items-center justify-center px-6" style="min-height: calc(100vh - 3.5rem);">
  <div class="max-w-lg w-full text-center">
    <div
      class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-6"
      style="background-color: var(--accent-subtle); color: var(--accent);"
    >
      <span class="w-1.5 h-1.5 rounded-full" style="background-color: var(--success);"></span>
      Ready
    </div>

    <h1 class="text-3xl sm:text-4xl font-bold tracking-tight leading-tight">
      Code with AI,<br/>preview in real-time.
    </h1>

    <p class="mt-4 text-sm leading-relaxed max-w-md mx-auto" style="color: var(--text-secondary);">
      An AI-powered coding workspace. Describe what you want, watch the agent build it, and see live previews — all in one place.
    </p>

    <div class="mt-8 flex items-center justify-center gap-3">
      <button
        class="px-5 py-2.5 rounded-lg text-sm font-medium text-white transition-colors cursor-pointer"
        style="background-color: var(--accent);"
        on:mouseenter={(e) => e.currentTarget.style.backgroundColor = 'var(--accent-hover)'}
        on:mouseleave={(e) => e.currentTarget.style.backgroundColor = 'var(--accent)'}
        on:click={() => goto("/projects")}
      >
        View Projects
      </button>
      <a
        href="https://github.com"
        target="_blank"
        rel="noopener noreferrer"
        class="px-5 py-2.5 rounded-lg text-sm font-medium border no-underline transition-colors"
        style="border-color: var(--border); color: var(--text-secondary); background-color: var(--bg-secondary);"
      >
        GitHub
      </a>
    </div>
  </div>
</div>
