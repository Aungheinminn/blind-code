# Blind Code

Vibe-coding platform. Monorepo: `apps/client` (SvelteKit), `apps/server` (Elysia + Bun), `apps/desktop` (Electron), `packages/shared`.

```bash
bun install
bun run dev           # client + server
```

## API keys & platform fallback

Every provider (Anthropic, OpenAI, Google, OpenRouter, Supabase, Vercel) supports two sources: a **user key** that lives in the database (Settings → …) and a **platform key** that lives in the server env. The server resolves them in this order:

1. **User key** — if the signed-in user has one configured for that provider, it's used.
2. **Platform key** — otherwise, the server falls back to the `*_API_KEY` / `*_ACCESS_TOKEN` env var.
3. **Nothing** — the agent errors with a message that tells the user where to add a key.

See `apps/server/.env.example` for the full list of env vars. User keys are encrypted at rest with `ENCRYPTION_KEY` (AES-256-GCM).

### Per-prompt override

The composer has a `Key:` chip that cycles **Auto → Yours → Platform**:

- **Auto** (default): the cascade above.
- **Yours**: forces the user key for this prompt; errors if none is set.
- **Platform**: forces the env key for this prompt, even when a user key is set.

### Supabase & Vercel semantics

- **Supabase platform fallback** = `SUPABASE_ACCESS_TOKEN` is a PAT for Blind Code's Supabase org. The agent uses it to **auto-provision a per-user project** under that org. Browse endpoints (list orgs / projects) stay user-only — users without their own PAT don't see the platform org.
- **Vercel platform fallback** = `VERCEL_API_TOKEN` is a token for Blind Code's Vercel account; deploys from users without their own token land there. User-token deploys hit the user's own scope.

### Migrating from the local file store

Older installs stored provider keys in `~/.config/blind-code/auth.json`. Import them into a user's DB record with:

```bash
bun run --filter ./apps/server migrate:keys <userId> [--dry-run]
```

Idempotent — skips providers the user already has.
