<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { initTheme } from "$lib/stores/theme";
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
            class="px-3 py-1.5 rounded-md border cursor-pointer"
            style="border-color: var(--border); color: var(--text-secondary); background-color: var(--bg-tertiary);"
            on:click={signOut}
          >
            Sign out
          </button>
        {:else if $auth.status === "anonymous"}
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
