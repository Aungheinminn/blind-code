<script lang="ts">
  import { page } from "$app/stores";

  type IconName =
    | "home"
    | "projects"
    | "supabase"
    | "design"
    | "settings"
    | "all"
    | "archive"
    | "trash";

  type NavItem = {
    label: string;
    href: string;
    icon: IconName;
    isActive: (path: string) => boolean;
    children?: Array<{
      label: string;
      href: string;
      icon: IconName;
      isActive: (path: string) => boolean;
    }>;
  };

  const items: NavItem[] = [
    { label: "Home", href: "/", icon: "home", isActive: (p) => p === "/" },
    {
      label: "Design",
      href: "/design",
      icon: "design",
      isActive: (p) => p === "/design" || p.startsWith("/design/"),
    },
    {
      label: "Projects",
      href: "/projects",
      icon: "projects",
      isActive: (p) => p === "/projects" || /^\/projects\//.test(p),
      children: [
        {
          label: "All",
          href: "/projects",
          icon: "all",
          isActive: (p) => p === "/projects",
        },
        {
          label: "Archive",
          href: "/projects/archive",
          icon: "archive",
          isActive: (p) => p === "/projects/archive",
        },
        {
          label: "Deleted",
          href: "/projects/deleted",
          icon: "trash",
          isActive: (p) => p === "/projects/deleted",
        },
      ],
    },
    {
      label: "Bases",
      href: "/supabase",
      icon: "supabase",
      isActive: (p) => p === "/supabase" || p.startsWith("/supabase/"),
    },
    {
      label: "Settings",
      href: "/settings/providers",
      icon: "settings",
      isActive: (p) => p.startsWith("/settings"),
    },
  ];

  $: activePath = $page.url.pathname;

  const expanded: Record<string, boolean> = {};
  $: for (const item of items) {
    if (item.children && item.isActive(activePath) && expanded[item.label] === undefined) {
      expanded[item.label] = true;
    }
  }

  const toggleExpand = (label: string) => {
    expanded[label] = !expanded[label];
  };

  const iconSvg = (name: IconName): string => {
    switch (name) {
      case "home":
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12L12 3l9 9" /><path d="M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10" /></svg>`;
      case "projects":
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>`;
      case "supabase":
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v6c0 1.66 4 3 9 3s9-1.34 9-3V5" /><path d="M3 11v6c0 1.66 4 3 9 3s9-1.34 9-3v-6" /></svg>`;
      case "design":
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor" /><circle cx="17.5" cy="10.5" r=".5" fill="currentColor" /><circle cx="8.5" cy="7.5" r=".5" fill="currentColor" /><circle cx="6.5" cy="12.5" r=".5" fill="currentColor" /><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.999 6.056 17.5 2 12 2z" /></svg>`;
      case "settings":
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>`;
      case "all":
        return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" /></svg>`;
      case "archive":
        return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="4" rx="1" /><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" /><line x1="10" y1="12" x2="14" y2="12" /></svg>`;
      case "trash":
        return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" /></svg>`;
    }
  };
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
    {#if item.children}
      <button
        type="button"
        class="nav-item nav-item-btn"
        class:active
        aria-expanded={expanded[item.label] ? true : false}
        aria-current={active ? "page" : undefined}
        title={item.label}
        on:click={() => toggleExpand(item.label)}
      >
        <span class="icon" aria-hidden="true">
          {@html iconSvg(item.icon)}
        </span>
        <span class="label">{item.label}</span>
      </button>
      {#if expanded[item.label]}
        <div class="children" role="group" aria-label={`${item.label} views`}>
          {#each item.children as child}
            {@const childActive = child.isActive(activePath)}
            <a
              href={child.href}
              class="nav-item nav-sub"
              class:active={childActive}
              aria-current={childActive ? "page" : undefined}
              title={child.label}
            >
              <span class="icon" aria-hidden="true">
                {@html iconSvg(child.icon)}
              </span>
              <span class="label">{child.label}</span>
            </a>
          {/each}
        </div>
      {/if}
    {:else}
      <a
        href={item.href}
        class="nav-item"
        class:active
        aria-current={active ? "page" : undefined}
        title={item.label}
      >
        <span class="icon" aria-hidden="true">
          {@html iconSvg(item.icon)}
        </span>
        <span class="label">{item.label}</span>
      </a>
    {/if}
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
  .nav-item-btn {
    appearance: none;
    background: transparent;
    border: 0;
    width: 100%;
    font: inherit;
  }
  .nav-item:hover {
    background-color: var(--bg-panel);
    color: var(--text-primary);
  }
  .nav-item.active {
    background-color: var(--accent);
    color: #ffffff;
  }
  .children {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-top: 2px;
  }
  .nav-sub {
    padding: 6px 2px;
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
