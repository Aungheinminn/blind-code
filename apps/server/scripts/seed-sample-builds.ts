import { db, hasDb, schema } from "../db/client";
import { sql } from "drizzle-orm";

const samples = [
  {
    slug: "pulse-dashboard",
    name: "Pulse Dashboard",
    description: "Realtime metrics with chart widgets.",
    accent: "var(--accent)",
    prompt:
      "Build a metrics dashboard with four KPI cards (Active Users, Revenue, Error Rate, Latency) and a sparkline chart under each. Feed the sparklines from mock realtime data that updates every 2 seconds. Include a top time-range selector (1h / 24h / 7d) that changes the mock data resolution.",
  },
  {
    slug: "kanban-board",
    name: "Kanban Board",
    description: "Drag-and-drop tasks across columns with filters.",
    accent: "#a855f7",
    prompt:
      "Build a drag-and-drop kanban board with three columns (Todo, Doing, Done). Cards have a title, description, and priority tag (low/med/high). Add a top filter to hide the Done column and a search field that filters by title. Persist state to localStorage.",
  },
  {
    slug: "expense-splitter",
    name: "Expense Splitter",
    description: "Group bills, per-person balances, settle-up summary.",
    accent: "#22c55e",
    prompt:
      "Build an expense splitter. The user can add people to a group, then add expenses with a payer, amount, and the participants who share it. Show per-person balances (owed vs owes) and a settle-up summary listing the minimum set of transfers to zero out balances.",
  },
  {
    slug: "booking-calendar",
    name: "Booking Calendar",
    description: "Slot picker with availability rules and confirmations.",
    accent: "#f97316",
    prompt:
      "Build a slot booking calendar for a single service. Show today plus the next 6 days as columns, each with eight 30-minute slots. Some slots are pre-booked (disabled). Clicking an open slot opens a confirmation modal that asks for name and email, then marks the slot booked.",
  },
  {
    slug: "habit-tracker",
    name: "Habit Tracker",
    description: "Daily check-ins with streak counters and weekly heatmap.",
    accent: "#ec4899",
    prompt:
      "Build a habit tracker. The user can add and remove habits, check each one off for today, and see current-streak and longest-streak counters. Under each habit show a 7-day dot heatmap of the last week. Persist state to localStorage so it survives reloads.",
  },
  {
    slug: "recipe-vault",
    name: "Recipe Vault",
    description: "Save recipes, filter by ingredients, scale servings on the fly.",
    accent: "#0ea5e9",
    prompt:
      "Build a recipe vault. The user can save recipes with a title, ingredients (name + quantity + unit), and steps. Include an ingredient filter that shows only recipes containing all selected ingredients, and a servings input that scales the ingredient quantities live. Persist recipes to localStorage.",
  },
];

if (!hasDb || !db) {
  console.error("[seed] DATABASE_URL not set");
  process.exit(1);
}

for (let i = 0; i < samples.length; i++) {
  const s = samples[i];
  await db
    .insert(schema.sampleBuilds)
    .values({ ...s, sortOrder: i })
    .onConflictDoUpdate({
      target: schema.sampleBuilds.slug,
      set: {
        name: s.name,
        description: s.description,
        accent: s.accent,
        prompt: s.prompt,
        sortOrder: i,
        updatedAt: sql`now()`,
      },
    });
  console.log(`[seed] upserted ${s.slug}`);
}

console.log(`[seed] done — ${samples.length} sample build(s)`);
process.exit(0);
