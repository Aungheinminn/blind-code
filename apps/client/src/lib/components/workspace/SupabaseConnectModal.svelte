<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";
  import SupabasePanel from "$lib/components/supabase/SupabasePanel.svelte";
  import type { PublicSupabaseIntegration } from "$lib/api/projects";
  import {
    getAccountIntegrations,
    listAccountSupabaseProjects,
    type SupabaseAccountProject,
  } from "$lib/api/account";

  export let projectId: string;
  export let integration: PublicSupabaseIntegration | null = null;

  const dispatch = createEventDispatcher<{
    close: void;
    changed: PublicSupabaseIntegration | null;
  }>();

  let busy = false;
  let accountProjects: SupabaseAccountProject[] | null = null;

  onMount(async () => {
    try {
      const acct = await getAccountIntegrations();
      if (acct?.supabase) accountProjects = await listAccountSupabaseProjects();
    } catch {
      accountProjects = null;
    }
  });

  const onBackdropClick = () => {
    if (busy) return;
    dispatch("close");
  };

  const onChanged = (e: CustomEvent<PublicSupabaseIntegration | null>) => {
    dispatch("changed", e.detail);
    if (e.detail === null) dispatch("close");
  };
</script>

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-noninteractive-element-interactions -->
<div
  class="fixed inset-0 z-50 flex items-center justify-center px-4"
  style="background-color: rgba(0, 0, 0, 0.55);"
  on:click|self={onBackdropClick}
  role="dialog"
  aria-modal="true"
  aria-labelledby="supabase-modal-title"
  tabindex="-1"
>
  <div
    id="supabase-modal-title"
    class="w-full max-w-md rounded-xl border shadow-xl"
    style="border-color: var(--border); background-color: var(--bg-secondary);"
  >
    <SupabasePanel
      {projectId}
      {integration}
      {accountProjects}
      showClose
      on:changed={onChanged}
      on:close={() => dispatch("close")}
    />
  </div>
</div>
