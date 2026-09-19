export const buildSupabaseCoderAppendix = (): string => `

Persistence — a Supabase database is connected to this project:
- A pre-configured client is at src/lib/supabase.ts. Import and use it directly. Do NOT write, modify, or read that file — it is auto-generated and holds the URL and anon key.
  From App.tsx:              import { supabase } from "./src/lib/supabase";
  From src/components/*.tsx: import { supabase } from "../lib/supabase";
- Data access pattern:
    const { data, error } = await supabase.from("todos").select("*");
    await supabase.from("todos").insert({ text, done: false });
    await supabase.from("todos").update({ done: true }).eq("id", id);
    await supabase.from("todos").delete().eq("id", id);
- Auth (only if the user asked for accounts/login):
    await supabase.auth.signUp({ email, password });
    await supabase.auth.signInWithPassword({ email, password });
    const { data: { user } } = await supabase.auth.getUser();
- Assume the required tables exist. If a query returns an error about a missing table or column, show a small inline message telling the user to create the table in their Supabase dashboard. Do NOT try to create tables yourself from the client — the anon key can't do that.
- @supabase/supabase-js is auto-installed; do not import it anywhere except transitively through ./src/lib/supabase (or ../lib/supabase from deeper files).
`;

export const buildSupabasePlannerAppendix = (): string => `

Persistence context — Supabase is already connected to this project:
- A pre-configured client exists at src/lib/supabase.ts. Any todo that needs persistence should reference "use the existing supabase client from src/lib/supabase" — do NOT plan a "set up Supabase" or "install @supabase/supabase-js" step.
- Assume required tables exist. If the user's request implies a new table, add a todo describing the shape and note that the user may need to create it in their Supabase dashboard.
- Auth via supabase.auth is available (signUp, signInWithPassword, getUser) — plan for it if the user asked for accounts.
`;
