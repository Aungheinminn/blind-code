<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { initTheme, theme, toggleTheme } from "$lib/stores/theme";
  import { auth, clearAuth, loadCurrentUser } from "$lib/stores/auth";
  import { logout } from "$lib/api/auth";
  import Sidebar from "$lib/components/Sidebar.svelte";
  import OutOfCreditsModal from "$lib/components/OutOfCreditsModal.svelte";
  import WelcomeModal from "$lib/components/WelcomeModal.svelte";
  import { creditsBalance, refreshCreditsBalance } from "$lib/stores/agent";
  import { formatCompact } from "$lib/format";
  import chevronLeftIcon from "$lib/assets/icons/chevron-left.svg?raw";
  import sunRaysIcon from "$lib/assets/icons/sun-rays.svg?raw";
  import moonIcon from "$lib/assets/icons/moon.svg?raw";
  import settingsGearIcon from "$lib/assets/icons/settings-gear.svg?raw";
  import logoutIcon from "$lib/assets/icons/logout.svg?raw";
  import "../app.css";

  const PUBLIC_ROUTES = ["/", "/login", "/signup"];
  const AUTH_ROUTES = ["/login", "/signup"];

  const isDesktopApp = () =>
    typeof window !== "undefined" &&
    Boolean((window as unknown as { desktop?: { isDesktop?: boolean } }).desktop?.isDesktop);

  const isPublic = (path: string) =>
    isDesktopApp() ? AUTH_ROUTES.includes(path) : PUBLIC_ROUTES.includes(path);
  const isAuthPage = (path: string) => AUTH_ROUTES.includes(path);
  const isFullscreen = (path: string) => path.includes("/workspace");
  const projectDetailIdRe = /^\/projects\/([^/]+)$/;
  const projectDetailId = (path: string) => path.match(projectDetailIdRe)?.[1] ?? null;
  const supabaseDetailRe = /^\/supabase\/[^/]+$/;

  let menuOpen = false;
  let menuAnchor: HTMLDivElement | null = null;

  onMount(() => {
    initTheme();
    loadCurrentUser();
  });

  // Pull the credits balance into the header whenever the session becomes authed.
  $: if ($auth.status === "authed") refreshCreditsBalance();

  $: creditsLabel =
    $creditsBalance === null ? "—" : formatCompact($creditsBalance);
  $: creditsFullLabel =
    $creditsBalance === null ? "—" : $creditsBalance.toLocaleString();
  $: lowBalance = $creditsBalance !== null && $creditsBalance < 50;

  $: {
    const state = $auth;
    const path = $page.url.pathname;
    if (state.status === "anonymous" && !isPublic(path)) {
      goto(`/login`);
    }
  }

  $: showSidebar =
    $auth.status === "authed" &&
    !isFullscreen($page.url.pathname) &&
    !isAuthPage($page.url.pathname);
  $: showHeader =
    !isFullscreen($page.url.pathname) && !isAuthPage($page.url.pathname);

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
    goto("/settings/providers");
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
    const path = $page.url.pathname;
    const pid = projectDetailId(path);
    if (pid) return goto(`/projects/${pid}/workspace`);
    if (supabaseDetailRe.test(path)) return goto("/supabase");
    if (path.startsWith("/design/") && path !== "/design") return goto("/design");
    goto("/");
  };
</script>

<svelte:window on:click={handleWindowClick} on:keydown={handleKeydown} />

<div
  class="min-h-screen flex"
  style="background-color: var(--bg-primary); color: var(--text-primary);"
>
  {#if showSidebar}
    <Sidebar />
  {/if}
  <div class="flex-1 flex flex-col min-w-0">
  {#if showHeader}
    <header
      class="sticky top-0 z-40 h-14 flex items-center justify-between px-6 border-b"
      style="border-color: var(--border); background-color: var(--bg-secondary);"
    >
      <div class="flex items-center gap-2">
        {#if $page.url.pathname !== "/"}
          <button
            type="button"
            class="back-icon-btn"
            on:click={goBack}
            aria-label="Go back"
            title="Back"
          >
            <span class="icon-20" aria-hidden="true">{@html chevronLeftIcon}</span>
          </button>
        {/if}
      </div>

      <div class="flex items-center gap-3 text-xs">
        {#if $auth.status === "authed" && $creditsBalance !== null}
          <a
            href="/settings/credits"
            class="credits-chip no-underline"
            class:credits-chip--low={lowBalance}
            title={lowBalance
              ? `Low balance: ${creditsFullLabel} credits`
              : `${creditsFullLabel} credits`}
          >
            <span
              class="w-1.5 h-1.5 rounded-full shrink-0"
              style="background-color: {lowBalance ? '#eab308' : 'var(--accent)'};"
              aria-hidden="true"
            ></span>
            <span class="tabular-nums">{creditsLabel}</span>
          </a>
        {/if}
        <button
          type="button"
          class="header-icon-btn"
          on:click={toggleTheme}
          title={$theme === "dark" ? "Switch to light" : "Switch to dark"}
          aria-label="Toggle theme"
        >
          {#if $theme === "dark"}
            <span class="icon-14" aria-hidden="true">{@html sunRaysIcon}</span>
          {:else}
            <span class="icon-14" aria-hidden="true">{@html moonIcon}</span>
          {/if}
        </button>
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
                  on:click={goToSettings}
                >
                  <span class="icon-14" aria-hidden="true">{@html settingsGearIcon}</span>
                  <span>Settings</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  class="w-full text-left px-3 py-2 text-[12px] cursor-pointer flex items-center gap-2 hover:opacity-90"
                  style="color: var(--text-primary); background-color: transparent;"
                  on:click={signOut}
                >
                  <span class="icon-14" aria-hidden="true">{@html logoutIcon}</span>
                  <span>Sign out</span>
                </button>
              </div>
            {/if}
          </div>
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
</div>

<OutOfCreditsModal />
<WelcomeModal />

<style>
  .header-icon-btn {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--bg-tertiary);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);
    cursor: pointer;
    transition: background 150ms ease, color 150ms ease, border-color 150ms ease;
  }
  .header-icon-btn:hover {
    background: var(--bg-panel);
    color: var(--text-primary);
    border-color: var(--border-strong);
  }
  .back-icon-btn {
    width: 28px;
    height: 28px;
    border: 0;
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 0;
    transition: color 150ms ease;
  }
  .back-icon-btn:hover {
    color: var(--text-primary);
  }
  .credits-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 28px;
    padding: 0 10px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background-color: var(--bg-tertiary);
    color: var(--text-secondary);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    transition: color 150ms ease, border-color 150ms ease, background-color 150ms ease;
  }
  .credits-chip:hover {
    color: var(--text-primary);
    border-color: var(--border-strong);
    background-color: var(--bg-panel);
  }
  .credits-chip--low {
    color: #eab308;
    border-color: color-mix(in srgb, #eab308 40%, transparent);
  }
  .icon-14 {
    display: inline-flex;
    width: 14px;
    height: 14px;
  }
  .icon-20 {
    display: inline-flex;
    width: 20px;
    height: 20px;
  }
</style>
