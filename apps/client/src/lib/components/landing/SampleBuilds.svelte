<script lang="ts">
  import SampleBuildCard from "./SampleBuildCard.svelte";

  const samples = [
    {
      name: "Pulse Dashboard",
      description: "Realtime metrics with chart widgets.",
      accent: "var(--accent)",
      prompt:
        "Build a metrics dashboard with four KPI cards (Active Users, Revenue, Error Rate, Latency) and a sparkline chart under each. Feed the sparklines from mock realtime data that updates every 2 seconds. Include a top time-range selector (1h / 24h / 7d) that changes the mock data resolution.",
    },
    {
      name: "Kanban Board",
      description: "Drag-and-drop tasks across columns with filters.",
      accent: "#a855f7",
      prompt:
        "Build a drag-and-drop kanban board with three columns (Todo, Doing, Done). Cards have a title, description, and priority tag (low/med/high). Add a top filter to hide the Done column and a search field that filters by title. Persist state to localStorage.",
    },
    {
      name: "Expense Splitter",
      description: "Group bills, per-person balances, settle-up summary.",
      accent: "#22c55e",
      prompt:
        "Build an expense splitter. The user can add people to a group, then add expenses with a payer, amount, and the participants who share it. Show per-person balances (owed vs owes) and a settle-up summary listing the minimum set of transfers to zero out balances.",
    },
    {
      name: "Booking Calendar",
      description: "Slot picker with availability rules and confirmations.",
      accent: "#f97316",
      prompt:
        "Build a slot booking calendar for a single service. Show today plus the next 6 days as columns, each with eight 30-minute slots. Some slots are pre-booked (disabled). Clicking an open slot opens a confirmation modal that asks for name and email, then marks the slot booked.",
    },
    {
      name: "Habit Tracker",
      description: "Daily check-ins with streak counters and weekly heatmap.",
      accent: "#ec4899",
      prompt:
        "Build a habit tracker. The user can add and remove habits, check each one off for today, and see current-streak and longest-streak counters. Under each habit show a 7-day dot heatmap of the last week. Persist state to localStorage so it survives reloads.",
    },
    {
      name: "Recipe Vault",
      description: "Save recipes, filter by ingredients, scale servings on the fly.",
      accent: "#0ea5e9",
      prompt:
        "Build a recipe vault. The user can save recipes with a title, ingredients (name + quantity + unit), and steps. Include an ingredient filter that shows only recipes containing all selected ingredients, and a servings input that scales the ingredient quantities live. Persist recipes to localStorage.",
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
        prompt={sample.prompt}
        on:select
      />
    {/each}
  </div>
</section>

<style>
  .sample-grid {
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr));
  }
</style>
