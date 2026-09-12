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

  let menuOpen = false;
  let menuAnchor: HTMLDivElement | null = null;

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
    menuOpen = false;
    try {
      await logout();
    } catch {}
    clearAuth();
    goto("/login");
  };

  const goToSettings = () => {
    menuOpen = false;
    goto("/settings/connect");
  };

  const initialFor = (user: { displayName: string; email: string }): string => {
    const source = user.displayName?.trim() || user.email;
    return source ? source[0].toUpperCase() : "?";
  };

  const handleWindowClick = (e: MouseEvent) => {
    if (!menuOpen || !menuAnchor) return;
    if (!menuAnchor.contains(e.target as Node)) menuOpen = false;
  };

  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === "Escape") menuOpen = false;
  };

  const goBack = () => {
    goto("/");
  };
</script>

<svelte:window on:click={handleWindowClick} on:keydown={handleKeydown} />

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
          <div class="relative" bind:this={menuAnchor}>
            <button
              type="button"
              class="w-8 h-8 rounded-full border cursor-pointer flex items-center justify-center overflow-hidden text-[12px] font-medium"
              style="border-color: var(--border); background-color: var(--bg-tertiary); color: var(--text-primary);"
              on:click={() => (menuOpen = !menuOpen)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Account menu"
            >
              {#if $auth.user.avatarUrl}
                <img
                  src={$auth.user.avatarUrl}
                  alt=""
                  class="w-full h-full object-cover"
                />
              {:else}
                {initialFor($auth.user)}
              {/if}
            </button>

            {#if menuOpen}
              <div
                role="menu"
                class="absolute right-0 mt-2 w-60 rounded-lg border shadow-lg py-1 z-50"
                style="border-color: var(--border); background-color: var(--bg-panel);"
              >
                <div
                  class="px-3 py-2 border-b"
                  style="border-color: var(--border);"
                >
                  <div class="text-[12px] font-medium truncate" style="color: var(--text-primary);">
                    {$auth.user.displayName}
                  </div>
                  <div class="text-[11px] truncate" style="color: var(--text-tertiary);">
                    {$auth.user.email}
                  </div>
                </div>

                <button
                  type="button"
                  role="menuitem"
                  class="w-full text-left px-3 py-2 text-[12px] cursor-pointer flex items-center gap-2 hover:opacity-90"
                  style="color: var(--text-primary); background-color: transparent;"
                  on:click={() => {
                    toggleTheme();
                  }}
                >
                  {#if $theme === "dark"}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
                    <span>Light theme</span>
                  {:else}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                    </svg>
                    <span>Dark theme</span>
                  {/if}
                </button>

                <button
                  type="button"
                  role="menuitem"
                  class="w-full text-left px-3 py-2 text-[12px] cursor-pointer flex items-center gap-2 hover:opacity-90"
                  style="color: var(--text-primary); background-color: transparent;"
                  on:click={goToSettings}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                  <span>Settings</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  class="w-full text-left px-3 py-2 text-[12px] cursor-pointer flex items-center gap-2 hover:opacity-90"
                  style="color: var(--text-primary); background-color: transparent;"
                  on:click={signOut}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  <span>Sign out</span>
                </button>
              </div>
            {/if}
          </div>
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
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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

  {#if $page.url.pathname !== "/" && !isFullscreen($page.url.pathname)}
    <button
      type="button"
      class="back-button fixed left-4 z-40"
      style="top: 4.5rem;"
      on:click={goBack}
      aria-label="Go back"
      title="Back"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="19" y1="12" x2="5" y2="12" />
        <polyline points="12 19 5 12 12 5" />
      </svg>
    </button>
  {/if}

  <slot />
</div>

<style>
  .back-button {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    border: 1px solid var(--chrome-border);
    background: var(--chrome);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);
    cursor: pointer;
    transition: background 150ms ease, color 150ms ease;
  }
  .back-button:hover {
    background: var(--chrome-hover);
    color: var(--text-primary);
  }
</style>
