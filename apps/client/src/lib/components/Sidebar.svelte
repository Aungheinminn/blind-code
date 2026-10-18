<script lang="ts">
  import { page } from "$app/stores";
  import homeIcon from "$lib/assets/icons/home.svg?raw";
  import folderIcon from "$lib/assets/icons/folder.svg?raw";
  import databaseIcon from "$lib/assets/icons/database.svg?raw";
  import designPaletteIcon from "$lib/assets/icons/design-palette.svg?raw";
  import settingsGearIcon from "$lib/assets/icons/settings-gear.svg?raw";
  import listHorizontalIcon from "$lib/assets/icons/list-horizontal.svg?raw";
  import archiveIcon from "$lib/assets/icons/archive.svg?raw";
  import trashIcon from "$lib/assets/icons/trash.svg?raw";

  type IconName =
    | "home"
    | "projects"
    | "supabase"
    | "design"
    | "settings"
    | "all"
    | "archive"
    | "trash";

  const ICON_MAP: Record<IconName, string> = {
    home: homeIcon,
    projects: folderIcon,
    supabase: databaseIcon,
    design: designPaletteIcon,
    settings: settingsGearIcon,
    all: listHorizontalIcon,
    archive: archiveIcon,
    trash: trashIcon,
  };

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
      href: "/design/new",
      icon: "design",
      isActive: (p) => p === "/design" || p.startsWith("/design/"),
      children: [
        {
          label: "All",
          href: "/design",
          icon: "all",
          isActive: (p) => p === "/design",
        },
        {
          label: "Archive",
          href: "/design/archive",
          icon: "archive",
          isActive: (p) => p === "/design/archive",
        },
        {
          label: "Deleted",
          href: "/design/deleted",
          icon: "trash",
          isActive: (p) => p === "/design/deleted",
        },
      ],
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
      <a
        href={item.href}
        class="nav-item"
        class:active
        aria-current={active ? "page" : undefined}
        aria-expanded={expanded[item.label] ? true : false}
        title={item.label}
        on:click={() => toggleExpand(item.label)}
      >
        <span class="icon" aria-hidden="true">
          {@html ICON_MAP[item.icon]}
        </span>
        <span class="label">{item.label}</span>
      </a>
      {#if expanded[item.label]}
        <div class="children" role="group" aria-label={`${item.label} views`}>
          {#each item.children as child}
            {@const childActive = child.isActive(activePath)}
            <a
              href={child.href}
              class="nav-item nav-sub"
              class:sub-active={childActive}
              aria-current={childActive ? "page" : undefined}
              title={child.label}
            >
              <span class="icon" aria-hidden="true">
                {@html ICON_MAP[child.icon]}
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
          {@html ICON_MAP[item.icon]}
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
    opacity: 0.9;
  }
  .nav-sub .icon {
    width: 14px;
    height: 14px;
  }
  .nav-sub .label {
    font-size: 9px;
  }
  .nav-sub.sub-active {
    background-color: transparent;
    color: var(--accent);
  }
  .nav-sub.sub-active:hover {
    background-color: var(--bg-panel);
    color: var(--accent);
  }
  .icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
  }
  .label {
    font-size: 9.5px;
    font-weight: 500;
    letter-spacing: 0.01em;
    line-height: 1;
  }
</style>
