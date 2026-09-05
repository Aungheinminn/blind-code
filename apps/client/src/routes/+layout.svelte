<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { initTheme, theme, toggleTheme } from "$lib/stores/theme";
  import { auth, clearAuth, loadCurrentUser } from "$lib/stores/auth";
  import { logout } from "$lib/api/auth";
  import "../app.css";

  const PUBLIC_ROUTES = ["/", "/login", "/signup"];

  const isPublic = (path: string) => PUBLIC_ROUTES.includes(path);
  const isFullscreen = (path: string) => path.includes("/workspace");

  onMount(() => {
    initTheme();
    loadCurrentUser();
  });

  $: {
    const state = $auth;
    const path = $page.url.pathname;
    if (state.status === "anonymous" && !isPublic(path)) {
      goto(`/login`);
    }
  }

  const signOut = async () => {
    try {
      await logout();
    } catch {}
    clearAuth();
    goto("/login");
  };
</script>

<div class="min-h-screen" style="background-color: var(--bg-primary); color: var(--text-primary);">
  {#if !isFullscreen($page.url.pathname)}
    <header
      class="h-14 flex items-center justify-between px-6 border-b"
      style="border-color: var(--border); background-color: var(--bg-secondary);"
    >
      <a href="/" class="text-sm font-semibold no-underline" style="color: var(--text-primary);">
        Blind Code
      </a>
      <div class="flex items-center gap-3 text-xs">
        {#if $auth.status === "authed"}
          <span style="color: var(--text-secondary);">{$auth.user.email}</span>
          <button
            type="button"
            class="w-8 h-8 rounded-md border cursor-pointer flex items-center justify-center"
            style="border-color: var(--border); color: var(--text-secondary); background-color: var(--bg-tertiary);"
            on:click={toggleTheme}
            title={$theme === "dark" ? "Switch to light" : "Switch to dark"}
            aria-label="Toggle theme"
          >
            {#if $theme === "dark"}
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            {:else}
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            {/if}
          </button>
          <button
            type="button"
            class="w-8 h-8 rounded-md border cursor-pointer flex items-center justify-center"
            style="border-color: var(--border); color: var(--text-secondary); background-color: var(--bg-tertiary);"
            on:click={signOut}
            title="Sign out"
            aria-label="Sign out"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        {:else if $auth.status === "anonymous"}
          <button
            type="button"
            class="w-8 h-8 rounded-md border cursor-pointer flex items-center justify-center"
            style="border-color: var(--border); color: var(--text-secondary); background-color: var(--bg-tertiary);"
            on:click={toggleTheme}
            title={$theme === "dark" ? "Switch to light" : "Switch to dark"}
            aria-label="Toggle theme"
          >
            {#if $theme === "dark"}
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            {:else}
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            {/if}
          </button>
          <a
            href="/login"
            class="px-3 py-1.5 rounded-md no-underline"
            style="color: var(--text-secondary);"
          >
            Sign in
          </a>
          <a
            href="/signup"
            class="px-3 py-1.5 rounded-md text-white no-underline"
            style="background-color: var(--accent);"
          >
            Sign up
          </a>
        {/if}
      </div>
    </header>
  {/if}

  <slot />
</div>
