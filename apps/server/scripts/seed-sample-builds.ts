import { db, hasDb, schema } from "../db/client";
import { sql } from "drizzle-orm";

const samples = [
  {
    slug: "pulse-dashboard",
    name: "Pulse Dashboard",
    description: "Realtime KPI metrics backed by a database.",
    accent: "var(--accent)",
    image: "/samples/pulse-dashboard.svg",
    prompt:
      "Build a metrics dashboard backed by a database. Four KPIs — Active Users, Revenue, Error Rate, Latency — each with a current value, a delta vs the previous period of the same length, and a sparkline of recent readings. Readings are stored in a time-series table and aggregated per bucket: 1h view uses 1-minute buckets, 24h uses 15-minute, 7d uses 1-hour. Switching range re-queries and smoothly re-animates the numbers. On first mount, seed a few hundred mock readings per KPI if the table is empty, then simulate a new reading every 2 seconds as a bounded random walk. Delta sign-to-sentiment is positive-good for Users/Revenue and positive-bad for Errors/Latency — reflect that in the delta tone. Handle the empty state with a 'seeding' indicator.",
  },
  {
    slug: "kanban-board",
    name: "Kanban Board",
    description: "Drag-and-drop board that syncs to the database.",
    accent: "#a855f7",
    image: "/samples/kanban-board.svg",
    prompt:
      "Build a drag-and-drop kanban board backed by a database. Three columns (Todo, Doing, Done); cards have a title, description, and priority (low/med/high). Position within a column is stored as a fractional index so reorders only update the moved card. Drag between columns updates column and position atomically. Drops are optimistic — reflect the move immediately, roll back on server rejection with a toast. Inline add at the top of a column via '+ Add card'; title is required, Esc cancels. Title search is client-side with a 150ms debounce. Toggle to collapse the Done column. Delete requires confirmation. All moves, edits, and deletes save to the database.",
  },
  {
    slug: "expense-splitter",
    name: "Expense Splitter",
    description: "Group bills saved to a database with settle-up math.",
    accent: "#22c55e",
    image: "/samples/expense-splitter.svg",
    prompt:
      "Build an expense splitter backed by a database. Users create a group, add people, then add expenses: payer (one of the people), amount, description, and the subset of participants who share it. Validate amount > 0 and at least one participant. Compute per-person balance as (sum paid by them for shared expenses) minus (sum of their equal shares). Settle-up uses the standard greedy minimum-transfer algorithm: repeatedly match the largest creditor with the largest debtor until balances are zero. Store amounts as integer cents to avoid float drift; display rounded to 2 decimals. Expense edits re-run the balance computation live. Deleting an expense is undoable for 5 seconds (toast with undo). Everything persists to the database.",
  },
  {
    slug: "booking-calendar",
    name: "Booking Calendar",
    description: "Shared slot booking with database-backed availability.",
    accent: "#f97316",
    image: "/samples/booking-calendar.svg",
    prompt:
      "Build a slot booking calendar for a single service, backed by a database. Show today plus the next 6 days; each day has eight 30-minute slots from 9:00 to 13:00. Bookings are keyed by (date, time) with a unique constraint — two users racing on the same slot result in one succeeding and the other seeing a 'slot just taken' message. Confirmation modal collects name and email with required-field and email-format validation. Insert the booking optimistically; roll back on uniqueness violation. Past dates are read-only. Weekends default to available (configurable). The page refetches periodically so open viewers see new bookings within a few seconds. Store times as UTC and render in the viewer's local timezone.",
  },
  {
    slug: "habit-tracker",
    name: "Habit Tracker",
    description: "Habits and check-ins saved to a database with streak math.",
    accent: "#ec4899",
    image: "/samples/habit-tracker.svg",
    prompt:
      "Build a habit tracker backed by a database that syncs across devices. Users add habits (name + color), check off today or any past day in the 7-day row (re-click uncompletes), and remove habits with confirm and cascade-delete of check-ins. Current streak = consecutive days ending today; longest streak = max over all history. Day boundary is the user's local timezone. Check-ins are idempotent (unique on habit + date); re-clicking a day toggles it off. Writes are optimistic with rollback on failure. Rename edits debounce 400ms. Show a skeleton on initial load and a retry affordance on load failure. Everything saves to the database.",
  },
  {
    slug: "recipe-vault",
    name: "Recipe Vault",
    description: "Database-backed recipes with ingredient filter and scaling.",
    accent: "#0ea5e9",
    image: "/samples/recipe-vault.svg",
    prompt:
      "Build a recipe vault backed by a database. Each recipe has a title, servings (default 4), an ordered ingredient list (name + quantity + unit), and an ordered step list. Form validation: title required; servings integer ≥ 1; ingredient quantity ≥ 0. An ingredient filter (multi-select) narrows the recipe list to recipes containing ALL selected ingredients (AND logic, case-insensitive match on normalized name). A per-recipe servings input scales displayed quantities proportionally without rewriting the stored row — e.g., 4 → 6 multiplies all quantities by 1.5. Deleting a recipe cascades its ingredients and steps and is undoable for 5 seconds. All recipes save to the database and sync across devices.",
  },
];

if (!hasDb || !db) {
  console.error("[seed] DATABASE_URL not set");
  process.exit(1);
}

await db.execute(sql`
  CREATE TABLE IF NOT EXISTS sample_builds (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug varchar(80) NOT NULL UNIQUE,
    name varchar(160) NOT NULL,
    description text NOT NULL,
    accent varchar(40) NOT NULL,
    prompt text NOT NULL,
    image text,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
  )
`);
console.log("[seed] ensured sample_builds table");

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
        image: s.image,
        prompt: s.prompt,
        sortOrder: i,
        updatedAt: sql`now()`,
      },
    });
  console.log(`[seed] upserted ${s.slug}`);
}

console.log(`[seed] done — ${samples.length} sample build(s)`);
process.exit(0);
