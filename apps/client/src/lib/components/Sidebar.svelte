<script lang="ts">
  import { page } from "$app/stores";

  type NavItem = {
    label: string;
    href: string;
    icon: "home" | "projects" | "supabase" | "settings";
    isActive: (path: string) => boolean;
  };

  const items: NavItem[] = [
    { label: "Home", href: "/", icon: "home", isActive: (p) => p === "/" },
    {
      label: "Projects",
      href: "/projects",
      icon: "projects",
      isActive: (p) => p === "/projects" || /^\/projects\//.test(p),
    },
    {
      label: "Bases",
      href: "/supabase",
      icon: "supabase",
      isActive: (p) => p === "/supabase" || p.startsWith("/supabase/"),
    },
    {
      label: "Settings",
      href: "/settings/connect",
      icon: "settings",
      isActive: (p) => p.startsWith("/settings"),
    },
  ];

  $: activePath = $page.url.pathname;
</script>

<aside class="sidebar" aria-label="Primary">
  <a
    href="/"
    class="brand"
    title="Blind Code — Home"
    aria-label="Blind Code — Home"
  >
    BC
  </a>
  <div class="brand-sep" aria-hidden="true"></div>

  {#each items as item}
    {@const active = item.isActive(activePath)}
    <a
      href={item.href}
      class="nav-item"
      class:active
      aria-current={active ? "page" : undefined}
      title={item.label}
    >
      <span class="icon" aria-hidden="true">
        {#if item.icon === "home"}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 12L12 3l9 9" />
            <path d="M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10" />
          </svg>
        {:else if item.icon === "projects"}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          </svg>
        {:else if item.icon === "supabase"}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M3 5v6c0 1.66 4 3 9 3s9-1.34 9-3V5" />
            <path d="M3 11v6c0 1.66 4 3 9 3s9-1.34 9-3v-6" />
          </svg>
        {:else}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        {/if}
      </span>
      <span class="label">{item.label}</span>
    </a>
  {/each}
</aside>

<style>
  .sidebar {
    width: 60px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    padding: 10px 4px;
    gap: 2px;
    border-right: 1px solid var(--border);
    background-color: var(--bg-secondary);
    position: sticky;
    top: 0;
    height: 100vh;
    align-self: flex-start;
    z-index: 50;
  }
  .brand {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 36px;
    margin: 2px 4px 6px;
    border-radius: 8px;
    background-color: var(--accent);
    color: #ffffff;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-decoration: none;
  }
  .brand:hover {
    filter: brightness(1.06);
  }
  .brand-sep {
    height: 1px;
    margin: 0 8px 6px;
    background-color: var(--border);
  }
  .nav-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    padding: 8px 2px;
    border-radius: 8px;
    color: var(--text-secondary);
    text-decoration: none;
    cursor: pointer;
    transition: background-color 150ms ease, color 150ms ease;
  }
  .nav-item:hover {
    background-color: var(--bg-panel);
    color: var(--text-primary);
  }
  .nav-item.active {
    background-color: var(--accent);
    color: #ffffff;
  }
  .icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .label {
    font-size: 9.5px;
    font-weight: 500;
    letter-spacing: 0.01em;
    line-height: 1;
  }
</style>
