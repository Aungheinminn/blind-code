<svelte:head>
  <title>Projects — Blind Code</title>
</svelte:head>

<div class="px-6 py-8">
  <div class="max-w-5xl mx-auto">
    <div class="flex items-start justify-between gap-6">
      <div>
        <h1 class="text-2xl font-semibold">Projects</h1>
        <p class="mt-2 text-sm" style="color: var(--text-secondary);">
          Manage your workspaces and recent builds.
        </p>
      </div>
      <button
        class="px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors cursor-pointer"
        style="background-color: var(--accent);"
      >
        New project
      </button>
    </div>

    <div class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {#each ["Marketing Site", "Design System", "Landing Page", "API Docs", "Internal Tools", "Prototype"] as project}
        <a
          href="/projects/alpha/workspace"
          class="rounded-xl border p-4 no-underline transition-transform"
          style="border-color: var(--border); background-color: var(--bg-secondary); color: var(--text-primary);"
        >
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium">{project}</span>
            <span class="text-[11px]" style="color: var(--text-tertiary);">Updated now</span>
          </div>
          <p class="mt-3 text-xs" style="color: var(--text-secondary);">
            Latest workspace ready for edits and previews.
          </p>
        </a>
      {/each}
    </div>
  </div>
</div>
