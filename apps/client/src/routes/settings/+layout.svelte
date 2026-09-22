<script lang="ts">
  import { page } from "$app/stores";

  type Section = { href: string; label: string; match: (path: string) => boolean };

  const sections: Section[] = [
    {
      href: "/settings/providers",
      label: "Providers",
      match: (p) => p === "/settings/providers" || p.startsWith("/settings/providers/"),
    },
    {
      href: "/settings/supabase",
      label: "Supabase",
      match: (p) => p === "/settings/supabase" || p.startsWith("/settings/supabase/"),
    },
  ];

  $: activePath = $page.url.pathname;
</script>

<div class="flex min-h-[calc(100vh-3.5rem)]">
  <aside
    class="w-64 shrink-0 border-r py-6 px-3"
    style="border-color: var(--border); background-color: var(--bg-secondary);"
  >
    <div
      class="px-3 pb-3 text-[11px] uppercase tracking-wider font-semibold"
      style="color: var(--text-tertiary);"
    >
      Settings
    </div>
    <nav class="flex flex-col gap-0.5">
      {#each sections as s (s.href)}
        {@const active = s.match(activePath)}
        <a
          href={s.href}
          class="px-3 py-2 rounded-md text-sm no-underline"
          style={active
            ? "background-color: var(--bg-tertiary); color: var(--text-primary);"
            : "background-color: transparent; color: var(--text-secondary);"}
        >
          {s.label}
        </a>
      {/each}
    </nav>
  </aside>

  <section class="flex-1 min-w-0 px-8 py-8">
    <div class="max-w-3xl">
      <slot />
    </div>
  </section>
</div>
