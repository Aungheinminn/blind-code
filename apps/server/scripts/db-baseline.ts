// One-time step for databases that were built with `drizzle-kit push` before
// migrations were checked in: records the baseline migration as applied so
// `db:migrate` doesn't try to recreate tables that already exist.
import postgres from "postgres";
import { readMigrationFiles } from "drizzle-orm/migrator";

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error("DATABASE_URL not set.");
  process.exit(1);
}

const [baseline] = readMigrationFiles({ migrationsFolder: "./drizzle" });
if (!baseline) {
  console.error("No migrations found in ./drizzle.");
  process.exit(1);
}

const sql = postgres(url, { prepare: false, onnotice: () => {} });

try {
  const [{ exists }] = await sql<{ exists: boolean }[]>`
    select to_regclass('public.projects') is not null as exists`;
  if (!exists) {
    console.log("Fresh database (no projects table) — run `bun run db:migrate` instead.");
    process.exit(0);
  }

  // Same shape drizzle's migrator creates, so `db:migrate` picks it up as-is.
  await sql`create schema if not exists drizzle`;
  await sql`
    create table if not exists drizzle.__drizzle_migrations (
      id serial primary key,
      hash text not null,
      created_at bigint
    )`;

  const applied = await sql`select 1 from drizzle.__drizzle_migrations limit 1`;
  if (applied.length > 0) {
    console.log("Migrations already recorded — nothing to do.");
    process.exit(0);
  }

  await sql`
    insert into drizzle.__drizzle_migrations (hash, created_at)
    values (${baseline.hash}, ${baseline.folderMillis})`;
  console.log("Baseline recorded. Future schema changes: db:generate, then db:migrate.");
} finally {
  await sql.end();
}
