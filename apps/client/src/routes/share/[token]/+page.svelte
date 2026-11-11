<script lang="ts">
  import { page } from "$app/stores";
  import { getSharedProject, type SharedProject } from "$lib/api/projects";
  import { assembleReactProject } from "$lib/preview/reactAssembler";
  import SandpackPreview from "$lib/components/SandpackPreview.svelte";

  let project: SharedProject | null = null;
  let error = "";
  let loadedToken = "";

  $: token = $page.params.token;
  $: if (token && token !== loadedToken) load(token);

  const load = async (t: string) => {
    loadedToken = t;
    project = null;
    error = "";
    try {
      project = await getSharedProject(t);
    } catch (e) {
      error = e instanceof Error ? e.message : "Couldn't load this preview.";
    }
  };

  $: files = project
    ? assembleReactProject(project.files, { supabase: project.supabase, designCss: project.designCss })
    : {};
</script>

<svelte:head>
  <title>{project ? `${project.name} — Blind Code` : "Shared preview — Blind Code"}</title>
</svelte:head>

<div class="h-screen flex flex-col" style="background-color: var(--bg-primary);">
  <header
    class="h-11 shrink-0 flex items-center justify-between gap-3 px-4 border-b"
    style="border-color: var(--border); background-color: var(--bg-secondary);"
  >
    <span class="text-sm font-medium truncate" style="color: var(--text-primary);">
      {project?.name ?? ""}
    </span>
    <a href="/" class="shrink-0 text-xs no-underline" style="color: var(--text-tertiary);">
      Made with Blind Code
    </a>
  </header>

  <div class="flex-1 min-h-0">
    {#if error}
      <div class="h-full grid place-items-center px-6 text-center text-sm" style="color: var(--text-secondary);">
        {error}
      </div>
    {:else}
      <SandpackPreview {files} framed={false} loading={!project} canFix={false} />
    {/if}
  </div>
</div>
