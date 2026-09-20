export const buildSupabaseCoderAppendix = (
  opts: { canRunSql?: boolean } = {},
): string => {
  const schemaSection = opts.canRunSql
    ? `- Schema: you have a run_sql tool. Before writing UI that depends on a table, call run_sql with idempotent DDL:
    CREATE TABLE IF NOT EXISTS todos (
      id uuid primary key default gen_random_uuid(),
      text text not null,
      done boolean not null default false,
      created_at timestamptz not null default now()
    );
    ALTER TABLE todos ENABLE ROW LEVEL SECURITY;
    CREATE POLICY IF NOT EXISTS "todos_read_all" ON todos FOR SELECT USING (true);
    CREATE POLICY IF NOT EXISTS "todos_insert_all" ON todos FOR INSERT WITH CHECK (true);
  Only call run_sql for schema work the user's app requires. Never DROP, TRUNCATE, or delete data unless the user explicitly asked for it.`
    : `- Schema: you do NOT have a way to create tables. Assume required tables exist. If a query returns an error about a missing table or column, render a small inline message telling the user to add "database URL" in the Supabase modal (database icon in the preview header) so you can create tables for them.`;

  return `

Persistence — a Supabase database is connected to this project. You MUST use it for anything the user expects to survive a reload (todos, notes, accounts, uploads, etc.). Do NOT fall back to useState-only, module-level variables, or localStorage for user data — Supabase is the source of truth here.
- A pre-configured client is at src/lib/supabase.ts. Import and use it directly. Do NOT write, modify, read, or re-create that file — it is auto-generated and holds the URL and anon key. Never call createClient() yourself and never hardcode a URL or key.
  From App.tsx:              import { supabase } from "./src/lib/supabase";
  From src/components/*.tsx: import { supabase } from "../lib/supabase";
- Data access pattern:
    const { data, error } = await supabase.from("todos").select("*");
    await supabase.from("todos").insert({ text, done: false });
    await supabase.from("todos").update({ done: true }).eq("id", id);
    await supabase.from("todos").delete().eq("id", id);
- Load initial state from Supabase in a useEffect on mount and keep local React state in sync after each mutation. Surface errors to the user with a small inline message; do not swallow them.
- Auth (only if the user asked for accounts/login):
    await supabase.auth.signUp({ email, password });
    await supabase.auth.signInWithPassword({ email, password });
    const { data: { user } } = await supabase.auth.getUser();
${schemaSection}
- @supabase/supabase-js is auto-installed; do not import it anywhere except transitively through ./src/lib/supabase (or ../lib/supabase from deeper files).
`;
};

export const buildSupabasePlannerAppendix = (): string => `

Persistence context — Supabase is already connected to this project. Any todo that needs data to survive a reload MUST go through Supabase, not localStorage or in-memory state.
- A pre-configured client exists at src/lib/supabase.ts. Todos that touch persistence should say "use the existing supabase client from src/lib/supabase" — do NOT plan a "set up Supabase", "create supabase client", or "install @supabase/supabase-js" step. That file is auto-generated and off-limits.
- Assume required tables exist. If the user's request implies a new table, add a todo describing the shape and note that the user may need to create it in their Supabase dashboard.
- Auth via supabase.auth is available (signUp, signInWithPassword, getUser) — plan for it if the user asked for accounts.
`;

export const buildLocalPersistenceCoderAppendix = (): string => `

Persistence — no backend is connected to this project. For anything the user expects to survive a reload (todos, notes, settings, form drafts, etc.), persist state to window.localStorage under a namespaced key (e.g. "vibe:<app>:<slice>"). Do not leave user-visible data in useState-only or module-level variables.
- Hydrate from localStorage on mount inside a useEffect; write back on change with a small useEffect that JSON.stringifies the value.
- Guard JSON.parse with try/catch and fall back to a sensible default so a corrupted entry never crashes the preview.
- Guard access with typeof window !== "undefined" so the code is safe under SSR-shaped bundles.
- Do NOT invent a fake Supabase client or import @supabase/supabase-js — the package is not installed here.
- If the user explicitly asks for a real backend (Supabase, auth, multi-user sync), respond in one short line that they can connect Supabase from the database icon in the preview header, then proceed with the localStorage version so the app still works.
`;

export const buildLocalPersistencePlannerAppendix = (): string => `

Persistence context — no backend is connected to this project. Any todo that needs data to survive a reload should say "persist to localStorage under a namespaced key". Do NOT plan a "set up Supabase", "install @supabase/supabase-js", or "add a backend" step — Supabase is not connected here.
- If the user explicitly asked for a real backend, add one short todo telling them to connect Supabase from the database icon in the preview header, then plan the remaining todos against localStorage so the app still runs.
`;
