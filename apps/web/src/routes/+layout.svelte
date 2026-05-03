<script lang="ts">
  import { onMount } from "svelte";
  import { writable } from "svelte/store";
  import "../app.css";

  const theme = writable("dark");

  const applyTheme = (value: string) => {
    if (value === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("blind-code-theme", value);
  };

  onMount(() => {
    const stored = localStorage.getItem("blind-code-theme") ?? "dark";
    theme.set(stored);
    applyTheme(stored);
  });

  const toggleTheme = () => {
    theme.update((value) => {
      const next = value === "dark" ? "light" : "dark";
      applyTheme(next);
      return next;
    });
  };
</script>

<div class="min-h-screen" style="background-color: var(--bg-primary); color: var(--text-primary);">
  <!-- Top nav -->
  <header
    class="flex items-center justify-between px-5 h-14 border-b"
    style="border-color: var(--border); background-color: var(--bg-secondary);"
  >
    <a href="/" class="flex items-center gap-2.5 no-underline" style="color: var(--text-primary);">
      <div
        class="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white"
        style="background-color: var(--accent);"
      >
        BC
      </div>
      <span class="text-sm font-semibold tracking-tight">Blind Code</span>
    </a>

    <div class="flex items-center gap-3">
      <a
        href="/projects"
        class="text-xs font-medium px-3 py-1.5 rounded-md no-underline transition-colors"
        style="color: var(--text-secondary); background-color: transparent;"
      >
        Projects
      </a>
      <button
        class="w-8 h-8 rounded-lg flex items-center justify-center border transition-colors cursor-pointer"
        style="border-color: var(--border); background-color: var(--bg-tertiary); color: var(--text-secondary);"
        on:click={toggleTheme}
        title="Toggle theme"
      >
        {#if $theme === "dark"}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
        {:else}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        {/if}
      </button>
    </div>
  </header>

  <slot />
</div>
