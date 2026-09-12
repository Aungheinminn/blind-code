<script lang="ts">
  import SampleBuildCard from "./SampleBuildCard.svelte";

  const samples = [
    {
      name: "Pulse Dashboard",
      description: "Realtime metrics with chart widgets.",
      accent: "var(--accent)",
    },
    {
      name: "Kanban Board",
      description: "Drag-and-drop tasks across columns with filters.",
      accent: "#a855f7",
    },
    {
      name: "Expense Splitter",
      description: "Group bills, per-person balances, settle-up summary.",
      accent: "#22c55e",
    },
    {
      name: "Booking Calendar",
      description: "Slot picker with availability rules and confirmations.",
      accent: "#f97316",
    },
  ];
</script>

<section id="projects" class="flex flex-col gap-4">
  <div class="flex items-baseline justify-between gap-3">
    <h2
      class="m-0 text-[15px] font-semibold"
      style="color: var(--text-secondary); letter-spacing: 0.02em;"
    >
      Sample builds — start from one
    </h2>
  </div>

  <div class="grid gap-4 sample-grid">
    {#each samples as sample}
      <SampleBuildCard
        name={sample.name}
        description={sample.description}
        accent={sample.accent}
      />
    {/each}
  </div>
</section>

<style>
  .sample-grid {
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr));
  }
</style>
