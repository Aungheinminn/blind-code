<script lang="ts">
  import { page } from "$app/stores";
  import WorkspaceView from "$lib/components/WorkspaceView.svelte";

  $: projectId = $page.params.projectId;
</script>

<svelte:head>
  <title>Workspace — Blind Code</title>
</svelte:head>

<WorkspaceView {projectId} />
